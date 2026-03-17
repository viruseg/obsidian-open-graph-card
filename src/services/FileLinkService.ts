import { App, TAbstractFile, EventRef } from 'obsidian';
import {
    CardLinks,
    FileLinkIndexes,
    CardLinksJSON,
    FileLinksData,
    FileLinkInfo,
    FileDeletedEventData,
    FileRenamedEventData,
    UserNoteEventData
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
        imageToCards: new Map()
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
     * Регистрирует новую карточку с путём(ями) к заметке пользователя.
     * Создаёт пустой CardLinks с generatedNotePath: null и пустым Set изображений.
     * @param cardId - уникальный идентификатор карточки
     * @param userNotePaths - путь или массив путей к заметкам пользователя
     */
    registerCard(cardId: string, userNotePaths: string | string[]): void {
        // Проверяем, не зарегистрирована ли уже карточка
        if (this.cardLinksMap.has(cardId)) {
            console.warn(`FileLinkService: Card ${cardId} already registered`);
            return;
        }

        // Нормализуем в массив
        const paths = Array.isArray(userNotePaths) ? userNotePaths : [userNotePaths];

        // Создаём связи для новой карточки
        const cardLinks: CardLinks = {
            userNotePaths: paths,
            generatedNotePath: null,
            imagePaths: new Set()
        };

        // Сохраняем в основное хранилище
        this.cardLinksMap.set(cardId, cardLinks);

        // Обновляем индексы для всех путей
        for (const path of paths) {
            this.indexes.userNoteToCard.set(path, cardId);
        }

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

    // ========================================
    // Методы управления userNotePaths
    // ========================================

    /**
     * Добавляет путь к заметке пользователя в существующую карточку.
     * @returns true если путь был добавлен, false если уже существует или карточка не найдена
     */
    addUserNote(cardId: string, notePath: string): boolean {
        const cardLinks = this.cardLinksMap.get(cardId);
        if (!cardLinks) {
            console.warn(`FileLinkService: Card ${cardId} not found`);
            return false;
        }

        // Проверяем, не существует ли уже этот путь
        if (cardLinks.userNotePaths.includes(notePath)) {
            return false;
        }

        // Добавляем путь
        cardLinks.userNotePaths.push(notePath);

        // Обновляем индекс
        this.indexes.userNoteToCard.set(notePath, cardId);

        // Сохраняем данные
        this.saveData();

        // Триггерим событие
        this.app.workspace.trigger('og-card:user-note-added', {
            cardId,
            notePath,
            allNotePaths: cardLinks.userNotePaths
        } as UserNoteEventData);

        return true;
    }

    /**
     * Удаляет путь к заметке пользователя из массива userNotePaths.
     * @returns объект с информацией об удалении и оставшихся путях
     */
    removeUserNote(cardId: string, notePath: string): { removed: boolean; remaining: string[] } {
        const cardLinks = this.cardLinksMap.get(cardId);
        if (!cardLinks) {
            console.warn(`FileLinkService: Card ${cardId} not found`);
            return { removed: false, remaining: [] };
        }

        const index = cardLinks.userNotePaths.indexOf(notePath);
        if (index === -1) {
            return { removed: false, remaining: cardLinks.userNotePaths };
        }

        // Удаляем путь
        cardLinks.userNotePaths.splice(index, 1);

        // Удаляем из индекса
        this.indexes.userNoteToCard.delete(notePath);

        // Сохраняем данные
        this.saveData();

        const remaining = cardLinks.userNotePaths;

        // Триггерим соответствующее событие
        if (remaining.length === 0) {
            this.app.workspace.trigger('og-card:last-user-note-deleted', {
                cardId,
                notePath,
                allNotePaths: []
            } as UserNoteEventData);
        } else {
            this.app.workspace.trigger('og-card:user-note-removed', {
                cardId,
                notePath,
                allNotePaths: remaining
            } as UserNoteEventData);
        }

        return { removed: true, remaining };
    }

    /**
     * Проверяет наличие пользовательских заметок у карточки.
     */
    hasUserNotes(cardId: string): boolean {
        const cardLinks = this.cardLinksMap.get(cardId);
        return cardLinks ? cardLinks.userNotePaths.length > 0 : false;
    }

    /**
     * Возвращает все пути к заметкам пользователя для карточки.
     */
    getUserNotePaths(cardId: string): string[] {
        const cardLinks = this.cardLinksMap.get(cardId);
        return cardLinks ? [...cardLinks.userNotePaths] : [];
    }

    /**
     * Добавляет изображение в связи карточки.
     * Поддерживает связь "один ко многим" - одно изображение может принадлежать нескольким карточкам.
     */
    addImage(cardId: string, imagePath: string): void {
        const cardLinks = this.cardLinksMap.get(cardId);
        if (!cardLinks) {
            console.warn(`FileLinkService: Card ${cardId} not found`);
            return;
        }

        // Проверяем, есть ли уже такая связь
        const alreadyInCardLinks = cardLinks.imagePaths.has(imagePath);
        const cardIds = this.indexes.imageToCards.get(imagePath);
        const alreadyInIndex = cardIds?.has(cardId);

        // Если связь уже существует - ничего не делаем
        if (alreadyInCardLinks && alreadyInIndex) {
            return;
        }

        // Добавляем изображение в CardLinks если его ещё нет
        if (!alreadyInCardLinks) {
            cardLinks.imagePaths.add(imagePath);
        }

        // Добавляем cardId в индекс imageToCards
        if (!cardIds) {
            this.indexes.imageToCards.set(imagePath, new Set([cardId]));
        } else if (!alreadyInIndex) {
            cardIds.add(cardId);
        }

        this.saveData();
    }

    /**
     * Удаляет изображение из связей карточки.
     * Не удаляет запись из индекса если есть другие карточки ссылающиеся на это изображение.
     * @returns true если изображение больше не имеет ссылок (можно удалить файл)
     */
    removeImage(cardId: string, imagePath: string): boolean {
        const cardLinks = this.cardLinksMap.get(cardId);
        if (!cardLinks) {
            console.warn(`FileLinkService: Card ${cardId} not found`);
            return false;
        }

        // Удаляем изображение из CardLinks если оно есть
        if (cardLinks.imagePaths.has(imagePath)) {
            cardLinks.imagePaths.delete(imagePath);
        }

        // Удаляем cardId из индекса imageToCards
        const cardIds = this.indexes.imageToCards.get(imagePath);
        if (cardIds) {
            cardIds.delete(cardId);
            // Если больше нет карточек ссылающихся на это изображение - удаляем запись
            if (cardIds.size === 0) {
                this.indexes.imageToCards.delete(imagePath);
                this.saveData();
                return true; // Изображение больше не имеет ссылок
            }
        }

        this.saveData();
        return false;
    }

    /**
     * Полностью удаляет карточку из всех структур.
     * @returns Массив путей к изображениям, которые больше не имеют ссылок (можно удалить файлы)
     */
    unregisterCard(cardId: string): string[] {
        const cardLinks = this.cardLinksMap.get(cardId);
        if (!cardLinks) {
            return [];
        }

        // Удаляем все пути к заметкам пользователя из индекса
        for (const userNotePath of cardLinks.userNotePaths) {
            this.indexes.userNoteToCard.delete(userNotePath);
        }

        if (cardLinks.generatedNotePath) {
            this.indexes.generatedNoteToCard.delete(cardLinks.generatedNotePath);
        }

        // Собираем изображения без ссылок после удаления
        const orphanedImages: string[] = [];
        for (const imagePath of cardLinks.imagePaths) {
            const cardIds = this.indexes.imageToCards.get(imagePath);
            if (cardIds) {
                cardIds.delete(cardId);
                if (cardIds.size === 0) {
                    this.indexes.imageToCards.delete(imagePath);
                    orphanedImages.push(imagePath);
                }
            }
        }

        // Удаляем из основного хранилища
        this.cardLinksMap.delete(cardId);

        // Сохраняем данные
        this.saveData();

        return orphanedImages;
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

        // Проверяем изображение (возвращаем первый card-id из Set)
        const imageCardIds = this.indexes.imageToCards.get(filePath);
        if (imageCardIds && imageCardIds.size > 0) {
            const firstCardId = imageCardIds.values().next().value!;
            return {
                cardId: firstCardId,
                fileType: 'image',
                cardLinks: this.cardLinksMap.get(firstCardId) ?? null
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
     * Возвращает первый card-id из Set (для обратной совместимости).
     */
    getCardIdByImage(imagePath: string): string | null {
        const cardIds = this.indexes.imageToCards.get(imagePath);
        return cardIds && cardIds.size > 0 ? cardIds.values().next().value! : null;
    }

    /**
     * Возвращает все card-id для изображения.
     */
    getCardIdsByImage(imagePath: string): Set<string> {
        return this.indexes.imageToCards.get(imagePath) ?? new Set();
    }

    /**
     * Проверяет, есть ли ссылки на изображение от карточек.
     */
    hasImageReferences(imagePath: string): boolean {
        const cardIds = this.indexes.imageToCards.get(imagePath);
        return cardIds ? cardIds.size > 0 : false;
    }

    /**
     * Возвращает все зарегистрированные card-id.
     */
    getAllCardIds(): string[] {
        return Array.from(this.cardLinksMap.keys());
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
        this.indexes.imageToCards.clear();
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

        // Для пользовательской заметки используем новую логику
        if (fileInfo.fileType === 'userNote') {
            // Удаляем путь из массива userNotePaths
            const { remaining } = this.removeUserNote(fileInfo.cardId, file.path);

            // Триггерим событие с информацией об оставшихся путях
            const eventData: FileDeletedEventData = {
                deletedPath: file.path,
                cardId: fileInfo.cardId,
                fileType: 'userNote',
                cardLinks: fileInfo.cardLinks,
                remainingUserNotePaths: remaining
            };

            // Событие уже триггерится в removeUserNote, но для обратной совместимости
            // триггерим также og-card:user-note-deleted
            this.app.workspace.trigger('og-card:user-note-deleted', eventData);
            return;
        }

        const eventData: FileDeletedEventData = {
            deletedPath: file.path,
            cardId: fileInfo.cardId,
            fileType: fileInfo.fileType as 'generatedNote' | 'image',
            cardLinks: fileInfo.cardLinks,
            remainingUserNotePaths: fileInfo.cardLinks.userNotePaths
        };

        // Триггерим соответствующее событие
        switch (fileInfo.fileType) {
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
                // Находим индекс пути в массиве
                const pathIndex = cardLinks.userNotePaths.indexOf(oldPath);
                if (pathIndex !== -1) {
                    // Обновляем индекс
                    this.indexes.userNoteToCard.delete(oldPath);
                    this.indexes.userNoteToCard.set(file.path, fileInfo.cardId);
                    // Обновляем путь в массиве
                    cardLinks.userNotePaths[pathIndex] = file.path;
                }
                break;

            case 'generatedNote':
                // Обновляем индекс
                this.indexes.generatedNoteToCard.delete(oldPath);
                this.indexes.generatedNoteToCard.set(file.path, fileInfo.cardId);
                // Обновляем связь
                cardLinks.generatedNotePath = file.path;
                break;

            case 'image':
                // Обновляем индекс imageToCards
                const imageCardIds = this.indexes.imageToCards.get(oldPath);
                if (imageCardIds) {
                    this.indexes.imageToCards.delete(oldPath);
                    this.indexes.imageToCards.set(file.path, imageCardIds);
                }
                // Обновляем связь в CardLinks для текущей карточки
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
                userNotePaths: links.userNotePaths,
                generatedNotePath: links.generatedNotePath,
                imagePaths: Array.from(links.imagePaths)
            });
        }

        return result;
    }

    /**
     * Восстанавливает Map из массива и перестраивает индексы.
     * Поддерживает миграцию старого формата (userNotePath -> userNotePaths).
     */
    private deserialize(data: Record<string, CardLinksJSON & { userNotePath?: string }>): void {
        // Очищаем текущие структуры
        this.cardLinksMap.clear();
        this.indexes.userNoteToCard.clear();
        this.indexes.generatedNoteToCard.clear();
        this.indexes.imageToCards.clear();

        // Восстанавливаем из JSON
        for (const [cardId, linksJSON] of Object.entries(data)) {
            // Миграция старого формата: userNotePath -> userNotePaths
            let userNotePaths: string[];
            if ('userNotePaths' in linksJSON && Array.isArray(linksJSON.userNotePaths)) {
                userNotePaths = linksJSON.userNotePaths;
            } else if ('userNotePath' in linksJSON && typeof linksJSON.userNotePath === 'string') {
                // Старый формат - мигрируем
                userNotePaths = [linksJSON.userNotePath];
            } else {
                // Нет данных - пустой массив
                userNotePaths = [];
            }

            const cardLinks: CardLinks = {
                userNotePaths,
                generatedNotePath: linksJSON.generatedNotePath,
                imagePaths: new Set(linksJSON.imagePaths)
            };

            this.cardLinksMap.set(cardId, cardLinks);

            // Восстанавливаем индексы для всех путей
            for (const userNotePath of userNotePaths) {
                this.indexes.userNoteToCard.set(userNotePath, cardId);
            }

            if (linksJSON.generatedNotePath) {
                this.indexes.generatedNoteToCard.set(linksJSON.generatedNotePath, cardId);
            }

            // Восстанавливаем индекс изображений (один ко многим)
            for (const imagePath of linksJSON.imagePaths) {
                let cardIds = this.indexes.imageToCards.get(imagePath);
                if (!cardIds) {
                    cardIds = new Set();
                    this.indexes.imageToCards.set(imagePath, cardIds);
                }
                cardIds.add(cardId);
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
                userNotePaths: links.userNotePaths,
                generatedNotePath: links.generatedNotePath,
                imagePaths: Array.from(links.imagePaths)
            };
        }

        return result;
    }
}
