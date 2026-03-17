import { App, Editor, EditorChange, EventRef } from 'obsidian';
import { FileLinkService } from './FileLinkService';
import { ImageService } from './ImageService';
import { ImageNotesService } from './ImageNotesService';
import { extractCardId, getImageDataUrlsFromCard } from '../utils/html';
import { generateCardId } from '../utils/id';

/**
 * Интерфейс для информации об обнаруженной карточке
 */
interface DetectedCard {
    cardId: string;
    html: string;
    startOffset: number;
    endOffset: number;
}

/**
 * Сервис для обнаружения и обработки копирования карточек.
 * Отслеживает вставку и дублирование карточек, генерирует новые ID,
 * копирует локальные изображения и обновляет связи.
 */
export class CardCopyService {
    /** Regex для поиска HTML-блоков карточек */
    private readonly CARD_REGEX = /<div[^>]*class="[^"]*og-card[^"]*"[^>]*>[\s\S]*?<!--og-card-end[^>]*-->/g;

    /** Защита от двойной обработки */
    private processedChanges: Set<string> = new Set();

    /** Ссылки на подписки событий */
    private editorChangeEventRef: EventRef | null = null;
    private editorPasteEventRef: EventRef | null = null;

    /** Флаг для временной приостановки обработки */
    private processingSuspended: boolean = false;

    /**
     * @param app - экземпляр приложения Obsidian
     * @param fileLinkService - сервис для отслеживания связей между файлами
     * @param imageService - сервис для работы с изображениями
     * @param imageNotesService - сервис для управления заметками с изображениями
     */
    constructor(
        private app: App,
        private fileLinkService: FileLinkService,
        private imageService: ImageService,
        private imageNotesService: ImageNotesService
    ) {}

    /**
     * Инициализирует слушатели событий
     */
    initialize(): void {
        // Регистрируем на событие изменения редактора
        this.editorChangeEventRef = this.app.workspace.on('editor-change', this.handleEditorChange, this);

        // Регистрируем на событие вставки
        this.editorPasteEventRef = this.app.workspace.on('editor-paste', this.handlePaste, this);
    }

    /**
     * Освобождает ресурсы
     */
    destroy(): void {
        if (this.editorChangeEventRef) {
            this.app.workspace.offref(this.editorChangeEventRef);
            this.editorChangeEventRef = null;
        }

        if (this.editorPasteEventRef) {
            this.app.workspace.offref(this.editorPasteEventRef);
            this.editorPasteEventRef = null;
        }

        this.processedChanges.clear();
    }

    /**
     * Приостанавливает обработку изменений
     */
    suspendProcessing(): void {
        this.processingSuspended = true;
    }

    /**
     * Возобновляет обработку изменений
     */
    resumeProcessing(): void {
        this.processingSuspended = false;
    }

    /**
     * Обрабатывает изменения в редакторе
     */
    private handleEditorChange(editor: Editor, info: EditorChange): void {
        // Пропускаем если обработка приостановлена
        if (this.processingSuspended) return;

        // Пропускаем если нет изменений
        if (!info || !info.text) return;

        // Проверяем, содержит ли изменение карточку
        if (!this.containsCard(info.text)) return;

        // Защита от двойной обработки
        const changeKey = this.getChangeKey(info);
        if (this.processedChanges.has(changeKey)) return;
        this.processedChanges.add(changeKey);

        // Очищаем старые ключи (защита от утечки памяти)
        this.cleanupOldChangeKeys();

        // Получаем путь текущей заметки
        const notePath = this.getCurrentNotePath();
        if (!notePath) return;

        // Обрабатываем карточки асинхронно
        this.processCardsInEditor(editor, notePath);
    }

    /**
     * Обрабатывает вставку из буфера
     */
    private handlePaste(evt: ClipboardEvent, editor: Editor): void {
        // Пропускаем если обработка приостановлена
        if (this.processingSuspended) return;

        const clipboardData = evt.clipboardData;
        if (!clipboardData) return;

        const text = clipboardData.getData('text/plain');
        if (!text || !this.containsCard(text)) return;

        // Получаем путь текущей заметки
        const notePath = this.getCurrentNotePath();
        if (!notePath) return;

        // Откладываем обработку чтобы текст успел вставиться
        setTimeout(() => {
            this.processCardsInEditor(editor, notePath);
        }, 50);
    }

    /**
     * Проверяет, содержит ли текст HTML-код карточки
     */
    private containsCard(text: string): boolean {
        return text.includes('og-card') && text.includes('og-card-end');
    }

    /**
     * Генерирует уникальный ключ для защиты от двойной обработки
     */
    private getChangeKey(change: EditorChange): string {
        const line = change.from?.line ?? 0;
        const ch = change.from?.ch ?? 0;
        const textHash = this.simpleHash(change.text || '');
        return `${line}-${ch}-${textHash}`;
    }

    /**
     * Простой хеш строки для создания уникального ключа
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }

    /**
     * Очищает старые ключи для защиты от утечки памяти
     */
    private cleanupOldChangeKeys(): void {
        // Ограничиваем размер Set
        if (this.processedChanges.size > 100) {
            const keysToDelete = Array.from(this.processedChanges).slice(0, 50);
            for (const key of keysToDelete) {
                this.processedChanges.delete(key);
            }
        }
    }

    /**
     * Получает путь текущей заметки
     */
    private getCurrentNotePath(): string | null {
        const file = this.app.workspace.getActiveFile();
        return file?.path || null;
    }

    /**
     * Обрабатывает все карточки в редакторе
     */
    private async processCardsInEditor(editor: Editor, notePath: string): Promise<void> {
        const content = editor.getValue();
        const cards = this.detectCards(content);

        for (const card of cards) {
            await this.processCard(card, notePath, editor);
        }
    }

    /**
     * Обнаруживает все карточки в тексте
     */
    private detectCards(content: string): DetectedCard[] {
        const cards: DetectedCard[] = [];
        this.CARD_REGEX.lastIndex = 0;

        let match;
        while ((match = this.CARD_REGEX.exec(content)) !== null) {
            const html = match[0];
            const cardId = extractCardId(html);

            if (cardId) {
                cards.push({
                    cardId,
                    html,
                    startOffset: match.index,
                    endOffset: match.index + html.length
                });
            }
        }

        return cards;
    }

    /**
     * Обрабатывает обнаруженную карточку
     */
    private async processCard(card: DetectedCard, notePath: string, editor: Editor): Promise<void> {
        const oldCardId = card.cardId;

        // Проверяем, есть ли уже такая карточка в системе
        const existingLinks = this.fileLinkService.getCardLinks(oldCardId);

        if (existingLinks) {
            // Карточка уже существует - это копия (в той же или другой заметке)
            // Обрабатываем одинаково: генерируем новый ID, регистрируем связи
            await this.handleCardCopy(card, notePath, editor, existingLinks);
        } else {
            // Карточка новая (например, вставлена из буфера обмена с другого источника)
            // Просто регистрируем
            this.fileLinkService.registerCard(oldCardId, notePath);
        }
    }

    /**
     * Обрабатывает копию карточки.
     * Не копирует файлы изображений - новая карточка использует те же изображения, что и оригинал.
     */
    private async handleCardCopy(
        card: DetectedCard,
        notePath: string,
        editor: Editor,
        existingLinks: ReturnType<typeof this.fileLinkService.getCardLinks>
    ): Promise<void> {
        const oldCardId = card.cardId;
        const newCardId = generateCardId();

        // Генерируем новый HTML с обновлённым ID
        const newHtml = this.replaceCardId(card.html, oldCardId, newCardId);

        // Получаем информацию об изображениях
        const imageDataUrls = getImageDataUrlsFromCard(card.html);
        const localImages = imageDataUrls.filter(img => img.dataUrl !== null);

        // Приостанавливаем обработку изменений
        this.suspendProcessing();

        try {
            // Заменяем HTML в редакторе
            const content = editor.getValue();
            const newContent = content.substring(0, card.startOffset) + newHtml + content.substring(card.endOffset);
            editor.setValue(newContent);

            // Регистрируем новую карточку
            this.fileLinkService.registerCard(newCardId, notePath);

            // Добавляем изображения в связи (используем существующие пути)
            // Изображения теперь общие между оригиналом и копией
            for (const img of localImages) {
                this.fileLinkService.addImage(newCardId, img.src);
            }

            // Синхронизируем заметку с изображениями
            await this.imageNotesService.syncNote(newCardId, newHtml);
        } finally {
            // Возобновляем обработку
            this.resumeProcessing();
        }
    }

    /**
     * Заменяет card-id в HTML
     */
    private replaceCardId(html: string, oldCardId: string, newCardId: string): string {
        // Заменяем в атрибуте card-id
        let result = html.replace(
            new RegExp(`card-id="${this.escapeRegex(oldCardId)}"`, 'g'),
            `card-id="${newCardId}"`
        );

        // Заменяем в маркере конца карточки
        result = result.replace(
            new RegExp(`<!--og-card-end ${this.escapeRegex(oldCardId)}-->`, 'g'),
            `<!--og-card-end ${newCardId}-->`
        );

        return result;
    }

    /**
     * Экранирует специальные символы для использования в regex
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

}
