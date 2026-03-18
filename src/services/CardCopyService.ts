import { App, Editor, EditorChange, EventRef } from 'obsidian';
import { FileLinkService } from './FileLinkService';
import { ImageService } from './ImageService';
import { ImageNotesService } from './ImageNotesService';
import { extractCardId, getImageDataUrlsFromCard, replaceCardId as replaceCardIdInHtml } from '../utils/html';
import { generateCardId } from '../utils/id';
import { CARD_REGEX } from '../utils/constants';

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
 * Интерфейс для хранения информации о вырезанной карточке
 */
interface CutSourceInfo {
    cardId: string;
    notePath: string;
}

/**
 * Сервис для обнаружения и обработки копирования карточек.
 * Отслеживает вставку и дублирование карточек, генерирует новые ID,
 * копирует локальные изображения и обновляет связи.
 */
export class CardCopyService {
    /** Защита от двойной обработки */
    private processedChanges: Set<string> = new Set();

    /** Ссылки на подписки событий */
    private editorChangeEventRef: EventRef | null = null;
    private editorPasteEventRef: EventRef | null = null;
    private editorCutEventRef: EventRef | null = null;

    /** Флаг для временной приостановки обработки */
    private processingSuspended: boolean = false;

    /** Отслеживание вырезанных card-id */
    private cutCardIds: Set<string> = new Set();

    /** Информация об источнике вырезания */
    private cutSourceNote: CutSourceInfo | null = null;

    /** Таймер для очистки устаревших cutCardIds */
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

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

        // Регистрируем на событие вырезания
        this.editorCutEventRef = this.app.workspace.on('editor-cut', this.handleCut, this);

        // Запускаем периодическую очистку устаревших cutCardIds
        this.cleanupTimer = setInterval(() => this.cleanupExpiredCutCardIds(), 60000);
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

        if (this.editorCutEventRef) {
            this.app.workspace.offref(this.editorCutEventRef);
            this.editorCutEventRef = null;
        }

        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        this.processedChanges.clear();
        this.cutCardIds.clear();
        this.cutSourceNote = null;
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
     * Обрабатывает вырезание (Ctrl+X)
     */
    private handleCut(evt: ClipboardEvent, editor: Editor): void {
        // Получаем выделенный текст
        const selection = editor.getSelection();

        // Проверяем, содержит ли выделение карточку
        if (!this.containsCard(selection)) return;

        // Извлекаем card-id вырезаемой карточки
        const cardId = extractCardId(selection);
        if (cardId) {
            this.cutCardIds.add(cardId);

            // Запоминаем заметку из которой вырезаем
            const notePath = this.getCurrentNotePath();
            if (notePath) {
                this.cutSourceNote = { cardId, notePath };
            }
        }
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
     * Очищает устаревшие cutCardIds (старше 1 минуты)
     */
    private cleanupExpiredCutCardIds(): void {
        // Если cutSourceNote существует более 1 минуты, очищаем
        // Это защита от случая, когда пользователь вырезал, но не вставил
        if (this.cutSourceNote) {
            this.cutSourceNote = null;
        }

        // Очищаем все cutCardIds при периодической очистке
        // Если вставка не произошла в течение 60 секунд, считаем операцию отменённой
        if (this.cutCardIds.size > 0) {
            this.cutCardIds.clear();
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
     * Группирует карточки по card-id
     */
    private groupCardsById(cards: DetectedCard[]): Map<string, DetectedCard[]> {
        const groups = new Map<string, DetectedCard[]>();

        for (const card of cards) {
            const existing = groups.get(card.cardId) || [];
            existing.push(card);
            groups.set(card.cardId, existing);
        }

        return groups;
    }

    /**
     * Определяет какие карточки нужно обработать (копии)
     * Возвращает массив карточек-копий
     */
    private identifyCopies(
        cardGroups: Map<string, DetectedCard[]>,
        notePath: string
    ): DetectedCard[] {
        const copies: DetectedCard[] = [];

        for (const [cardId, cards] of cardGroups) {
            // Проверяем, зарегистрирована ли карточка в системе
            const existingLinks = this.fileLinkService.getCardLinks(cardId);

            // Случай 1: Карточка новая (не зарегистрирована)
            if (!existingLinks) {
                // Не добавляем в copies - будет зарегистрирована отдельно
                continue;
            }

            // Случай 2: Карточка из другой заметки
            const hasLinkToCurrentNote = existingLinks.userNotePaths.includes(notePath);
            if (!hasLinkToCurrentNote) {
                // Все экземпляры - копии из другой заметки
                copies.push(...cards);
                continue;
            }

            // Случай 3: Карточка уже в текущей заметке
            if (cards.length === 1) {
                // Одна карточка = оригинал, не трогаем
                // Но проверяем cut
                if (this.cutCardIds.has(cardId)) {
                    // Cut без вставки в ту же заметку = перемещение в другую заметку
                    // Обрабатываем как копию (будет вставлена в другую заметку)
                    copies.push(cards[0]);
                    this.cutCardIds.delete(cardId);
                }
                continue;
            }

            // Случай 4: Несколько карточек с одинаковым ID
            // Сортируем по позиции (первая = оригинал)
            cards.sort((a, b) => a.startOffset - b.startOffset);

            if (this.cutCardIds.has(cardId)) {
                // Cut + paste: первая = вставленная (перемещённая)
                // Обрабатываем первую
                copies.push(cards[0]);
                this.cutCardIds.delete(cardId);

                // Остальные если есть - копии
                if (cards.length > 1) {
                    copies.push(...cards.slice(1));
                }
            } else {
                // Copy + paste: первая = оригинал, остальные = копии
                copies.push(...cards.slice(1));
            }
        }

        return copies;
    }

    /**
     * Обрабатывает все карточки в редакторе
     */
    private async processCardsInEditor(editor: Editor, notePath: string): Promise<void> {
        const content = editor.getValue();
        const cards = this.detectCards(content);

        // Группируем карточки по card-id
        const cardGroups = this.groupCardsById(cards);

        // Определяем копии
        const copies = this.identifyCopies(cardGroups, notePath);

        // Обрабатываем только копии
        for (const card of copies) {
            await this.processCardCopy(card, notePath, editor);
        }

        // Регистрируем новые карточки (которых нет в системе)
        for (const [cardId, cardList] of cardGroups) {
            if (!this.fileLinkService.getCardLinks(cardId)) {
                this.fileLinkService.registerCard(cardId, notePath);
            }
        }

        // Обрабатываем cutSourceNote если был cut
        if (this.cutSourceNote) {
            // Если вставили в другую заметку - удаляем связь с исходной
            if (this.cutSourceNote.notePath !== notePath) {
                this.fileLinkService.removeUserNote(
                    this.cutSourceNote.cardId,
                    this.cutSourceNote.notePath
                );
            }
            this.cutSourceNote = null;
        }
    }

    /**
     * Обнаруживает все карточки в тексте
     */
    private detectCards(content: string): DetectedCard[] {
        const cards: DetectedCard[] = [];
        CARD_REGEX.lastIndex = 0;

        let match;
        while ((match = CARD_REGEX.exec(content)) !== null) {
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
     * Обрабатывает копию карточки.
     * Генерирует новый ID, обновляет HTML, регистрирует связи.
     */
    private async processCardCopy(
        card: DetectedCard,
        notePath: string,
        editor: Editor
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
     * Заменяет card-id в HTML через DOMParser
     */
    private replaceCardId(html: string, oldCardId: string, newCardId: string): string {
        return replaceCardIdInHtml(html, newCardId);
    }
}
