import { App, TAbstractFile, EventRef } from 'obsidian';
import {
    CardLinks,
    FileLinkIndexes,
    CardLinksJSON,
    FileLinksData,
    FileLinkInfo,
    FileDeletedEventData,
    FileRenamedEventData
} from '../types';

/**
 * Сервис для отслеживания связей между файлами в плагине.
 * Обеспечивает целостность данных при удалении и переименовании файлов.
 */
export class FileLinkService {
    private app: App;
    private getData: () => FileLinksData;
    private saveData: () => Promise<void>;

    // Основное хранилище связей
    private cardLinksMap: Map<string, CardLinks> = new Map();

    // Обратные индексы для O(1) поиска
    private indexes: FileLinkIndexes = {
        userNoteToCard: new Map(),
        generatedNoteToCard: new Map(),
        imageToCard: new Map()
    };

    // Ссылки на подписки событий
    private deleteEventRef: EventRef | null = null;
    private renameEventRef: EventRef | null = null;

    // Флаг массовой операции
    private batchOperationInProgress: boolean = false;

    constructor(
        app: App,
        getData: () => FileLinksData,
        saveData: () => Promise<void>
    ) {
        this.app = app;
        this.getData = getData;
        this.saveData = saveData;
    }

    // ========================================
    // Методы управления массовыми операциями
    // ========================================

    startBatchOperation(): void {
        this.batchOperationInProgress = true;
    }

    endBatchOperation(): void {
        this.batchOperationInProgress = false;
    }

    isBatchOperationInProgress(): boolean {
        return this.batchOperationInProgress;
    }

    // ========================================
    // Методы регистрации связей
    // ========================================

    /**
     * Регистрирует новую карточку с путём к заметке пользователя.
     * Создаёт пустой CardLinks с generatedNotePath: null и пустым Set изображений.
     */
    registerCard(cardId: string, userNotePath: string): void {
        // Проверяем, не зарегистрирована ли уже карточка
        if (this.cardLinksMap.has(cardId)) {
            console.warn(`FileLinkService: Card ${cardId} already registered`);
            return;
        }

        // Создаём связи для новой карточки
        const cardLinks: CardLinks = {
            userNotePath,
            generatedNotePath: null,
            imagePaths: new Set()
        };

        // Сохраняем в основное хранилище
        this.cardLinksMap.set(cardId, cardLinks);

        // Обновляем индекс
        this.indexes.userNoteToCard.set(userNotePath, cardId);

        // Сохраняем данные
        this.saveData();
    }

    /**
     * Устанавливает путь к сгенерированной заметке.
     */
    setGeneratedNote(cardId: string, generatedNotePath: string): void {
        const cardLinks = this.cardLinksMap.get(cardId);
        if (!cardLinks) {
            console.warn(`FileLinkService: Card ${cardId} not found`);
            return;
        }

        // Удаляем старый индекс если был
        if (cardLinks.generatedNotePath) {
            this.indexes.generatedNoteToCard.delete(cardLinks.generatedNotePath);
        }

        // Обновляем путь
        cardLinks.generatedNotePath = generatedNotePath;

        // Добавляем новый индекс
        this.indexes.generatedNoteToCard.set(generatedNotePath, cardId);

        // Сохраняем данные
        this.saveData();
    }

    /**
     * Удаляет связь сгенерированной заметки.
     */
    clearGeneratedNote(cardId: string): void {
        const cardLinks = this.cardLinksMap.get(cardId);
        if (!cardLinks) {
            return;
        }

        // Удаляем индекс если был
        if (cardLinks.generatedNotePath) {
            this.indexes.generatedNoteToCard.delete(cardLinks.generatedNotePath);
        }

        // Очищаем путь
        cardLinks.generatedNotePath = null;

        // Сохраняем данные
        this.saveData();
    }

    /**
     * Добавляет изображение в связи карточки.
     */
    addImage(cardId: string, imagePath: string): void {
        const cardLinks = this.cardLinksMap.get(cardId);
        if (!cardLinks) {
            console.warn(`FileLinkService: Card ${cardId} not found`);
            return;
        }

        // Добавляем изображение если его ещё нет
        if (!cardLinks.imagePaths.has(imagePath)) {
            cardLinks.imagePaths.add(imagePath);
            this.indexes.imageToCard.set(imagePath, cardId);
            this.saveData();
        }
    }

    /**
     * Удаляет изображение из связей.
     */
    removeImage(cardId: string, imagePath: string): void {
        const cardLinks = this.cardLinksMap.get(cardId);
        if (!cardLinks) {
            console.warn(`FileLinkService: Card ${cardId} not found`);
            return;
        }

        // Удаляем изображение если оно есть
        if (cardLinks.imagePaths.has(imagePath)) {
            cardLinks.imagePaths.delete(imagePath);
            this.indexes.imageToCard.delete(imagePath);
            this.saveData();
        }
    }

    /**
     * Полностью удаляет карточку из всех структур.
     */
    unregisterCard(cardId: string): void {
        const cardLinks = this.cardLinksMap.get(cardId);
        if (!cardLinks) {
            return;
        }

        // Удаляем из индексов
        this.indexes.userNoteToCard.delete(cardLinks.userNotePath);

        if (cardLinks.generatedNotePath) {
            this.indexes.generatedNoteToCard.delete(cardLinks.generatedNotePath);
        }

        for (const imagePath of cardLinks.imagePaths) {
            this.indexes.imageToCard.delete(imagePath);
        }

        // Удаляем из основного хранилища
        this.cardLinksMap.delete(cardId);

        // Сохраняем данные
        this.saveData();
    }

    // ========================================
    // Методы поиска
    // ========================================

    /**
     * Возвращает связи карточки по card-id.
     */
    getCardLinks(cardId: string): CardLinks | null {
        return this.cardLinksMap.get(cardId) ?? null;
    }

    /**
     * Определяет тип файла и возвращает card-id и CardLinks если найдены.
     */
    findFileLink(filePath: string): FileLinkInfo {
        // Проверяем пользовательскую заметку
        const userNoteCardId = this.indexes.userNoteToCard.get(filePath);
        if (userNoteCardId) {
            return {
                cardId: userNoteCardId,
                fileType: 'userNote',
                cardLinks: this.cardLinksMap.get(userNoteCardId) ?? null
            };
        }

        // Проверяем сгенерированную заметку
        const generatedNoteCardId = this.indexes.generatedNoteToCard.get(filePath);
        if (generatedNoteCardId) {
            return {
                cardId: generatedNoteCardId,
                fileType: 'generatedNote',
                cardLinks: this.cardLinksMap.get(generatedNoteCardId) ?? null
            };
        }

        // Проверяем изображение
        const imageCardId = this.indexes.imageToCard.get(filePath);
        if (imageCardId) {
            return {
                cardId: imageCardId,
                fileType: 'image',
                cardLinks: this.cardLinksMap.get(imageCardId) ?? null
            };
        }

        // Ничего не найдено
        return {
            cardId: null,
            fileType: 'unknown',
            cardLinks: null
        };
    }

    /**
     * Быстрый поиск card-id по пути заметки пользователя.
     */
    getCardIdByUserNote(userNotePath: string): string | null {
        return this.indexes.userNoteToCard.get(userNotePath) ?? null;
    }

    /**
     * Быстрый поиск card-id по пути сгенерированной заметки.
     */
    getCardIdByGeneratedNote(generatedNotePath: string): string | null {
        return this.indexes.generatedNoteToCard.get(generatedNotePath) ?? null;
    }

    /**
     * Быстрый поиск card-id по пути изображения.
     */
    getCardIdByImage(imagePath: string): string | null {
        return this.indexes.imageToCard.get(imagePath) ?? null;
    }

    // ========================================
    // Методы обработки событий
    // ========================================

    /**
     * Инициализирует сервис при загрузке плагина.
     * Загружает данные из getData(), восстанавливает Map и Set, подписывается на события.
     */
    initialize(): void {
        // Загружаем данные
        const data = this.getData();
        this.deserialize(data.cardLinks);

        // Подписываемся на события vault
        this.deleteEventRef = this.app.vault.on('delete', (file: TAbstractFile) => {
            this.handleFileDelete(file);
        });

        this.renameEventRef = this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
            this.handleFileRename(file, oldPath);
        });
    }

    /**
     * Отписывается от событий и очищает структуры данных.
     */
    dispose(): void {
        // Отписываемся от событий
        if (this.deleteEventRef) {
            this.app.vault.offref(this.deleteEventRef);
            this.deleteEventRef = null;
        }

        if (this.renameEventRef) {
            this.app.vault.offref(this.renameEventRef);
            this.renameEventRef = null;
        }

        // Очищаем структуры
        this.cardLinksMap.clear();
        this.indexes.userNoteToCard.clear();
        this.indexes.generatedNoteToCard.clear();
        this.indexes.imageToCard.clear();
    }

    /**
     * Обрабатывает удаление файла.
     * Триггерит события для каждого типа файла.
     */
    handleFileDelete(file: TAbstractFile): void {
        const fileInfo = this.findFileLink(file.path);

        // Если файл не связан с карточками — ничего не делаем
        if (!fileInfo.cardId || !fileInfo.cardLinks || fileInfo.fileType === 'unknown') {
            return;
        }

        const eventData: FileDeletedEventData = {
            deletedPath: file.path,
            cardId: fileInfo.cardId,
            fileType: fileInfo.fileType as 'userNote' | 'generatedNote' | 'image',
            cardLinks: fileInfo.cardLinks
        };

        // Триггерим соответствующее событие
        switch (fileInfo.fileType) {
            case 'userNote':
                this.app.workspace.trigger('og-card:user-note-deleted', eventData);
                break;
            case 'generatedNote':
                this.app.workspace.trigger('og-card:generated-note-deleted', eventData);
                break;
            case 'image':
                // Пропускаем обработку отдельных изображений при массовой операции
                if (this.batchOperationInProgress) {
                    return;
                }
                this.app.workspace.trigger('og-card:image-deleted', eventData);
                break;
        }
    }

    /**
     * Обрабатывает переименование файла.
     * Обновляет пути во всех структурах и триггерит событие.
     */
    handleFileRename(file: TAbstractFile, oldPath: string): void {
        const fileInfo = this.findFileLink(oldPath);

        // Если файл не связан с карточками — ничего не делаем
        if (!fileInfo.cardId || !fileInfo.cardLinks || fileInfo.fileType === 'unknown') {
            return;
        }

        const cardLinks = this.cardLinksMap.get(fileInfo.cardId);
        if (!cardLinks) {
            return;
        }

        // Обновляем пути в зависимости от типа файла
        switch (fileInfo.fileType) {
            case 'userNote':
                // Обновляем индекс
                this.indexes.userNoteToCard.delete(oldPath);
                this.indexes.userNoteToCard.set(file.path, fileInfo.cardId);
                // Обновляем связь
                (cardLinks as CardLinks & { userNotePath: string }).userNotePath = file.path;
                break;

            case 'generatedNote':
                // Обновляем индекс
                this.indexes.generatedNoteToCard.delete(oldPath);
                this.indexes.generatedNoteToCard.set(file.path, fileInfo.cardId);
                // Обновляем связь
                cardLinks.generatedNotePath = file.path;
                break;

            case 'image':
                // Обновляем индекс
                this.indexes.imageToCard.delete(oldPath);
                this.indexes.imageToCard.set(file.path, fileInfo.cardId);
                // Обновляем связь
                cardLinks.imagePaths.delete(oldPath);
                cardLinks.imagePaths.add(file.path);
                break;
        }

        // Триггерим событие
        const eventData: FileRenamedEventData = {
            oldPath,
            newPath: file.path,
            cardId: fileInfo.cardId,
            fileType: fileInfo.fileType as 'userNote' | 'generatedNote' | 'image'
        };

        this.app.workspace.trigger('og-card:file-renamed', eventData);

        // Сохраняем данные
        this.saveData();
    }

    // ========================================
    // Сериализация
    // ========================================

    /**
     * Преобразует Map<string, CardLinks> в массив CardLinksJSON.
     */
    private serialize(): CardLinksJSON[] {
        const result: CardLinksJSON[] = [];

        for (const [cardId, links] of this.cardLinksMap) {
            result.push({
                userNotePath: links.userNotePath,
                generatedNotePath: links.generatedNotePath,
                imagePaths: Array.from(links.imagePaths)
            });
        }

        return result;
    }

    /**
     * Восстанавливает Map из массива и перестраивает индексы.
     */
    private deserialize(data: Record<string, CardLinksJSON>): void {
        // Очищаем текущие структуры
        this.cardLinksMap.clear();
        this.indexes.userNoteToCard.clear();
        this.indexes.generatedNoteToCard.clear();
        this.indexes.imageToCard.clear();

        // Восстанавливаем из JSON
        for (const [cardId, linksJSON] of Object.entries(data)) {
            const cardLinks: CardLinks = {
                userNotePath: linksJSON.userNotePath,
                generatedNotePath: linksJSON.generatedNotePath,
                imagePaths: new Set(linksJSON.imagePaths)
            };

            this.cardLinksMap.set(cardId, cardLinks);

            // Восстанавливаем индексы
            this.indexes.userNoteToCard.set(linksJSON.userNotePath, cardId);

            if (linksJSON.generatedNotePath) {
                this.indexes.generatedNoteToCard.set(linksJSON.generatedNotePath, cardId);
            }

            for (const imagePath of linksJSON.imagePaths) {
                this.indexes.imageToCard.set(imagePath, cardId);
            }
        }
    }

    /**
     * Возвращает сериализованные данные для сохранения.
     */
    getSerializedData(): Record<string, CardLinksJSON> {
        const result: Record<string, CardLinksJSON> = {};

        for (const [cardId, links] of this.cardLinksMap) {
            result[cardId] = {
                userNotePath: links.userNotePath,
                generatedNotePath: links.generatedNotePath,
                imagePaths: Array.from(links.imagePaths)
            };
        }

        return result;
    }
}
