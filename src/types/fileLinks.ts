/**
 * Связи карточки по card-id
 */
export interface CardLinks {
    /** Путь к заметке пользователя */
    userNotePath: string;
    /** Путь к сгенерированной заметке (card-id.md) */
    generatedNotePath: string | null;
    /** Множество путей к локальным изображениям */
    imagePaths: Set<string>;
}

/**
 * Обратные индексы для O(1) поиска
 */
export interface FileLinkIndexes {
    /** путь файла → card-id (для пользовательских заметок) */
    userNoteToCard: Map<string, string>;
    /** путь файла → card-id (для сгенерированных заметок) */
    generatedNoteToCard: Map<string, string>;
    /** путь файла → card-id (для изображений) */
    imageToCard: Map<string, string>;
}

/**
 * Сериализуемая версия CardLinks для JSON
 */
export interface CardLinksJSON {
    userNotePath: string;
    generatedNotePath: string | null;
    imagePaths: string[];
}

/**
 * Данные для сохранения в data.json
 */
export interface FileLinksData {
    /** Версия схемы данных */
    version: number;
    /** Связи по card-id */
    cardLinks: Record<string, CardLinksJSON>;
}

/**
 * Результат поиска связей файла
 */
export interface FileLinkInfo {
    /** card-id если найден */
    cardId: string | null;
    /** Тип файла */
    fileType: 'userNote' | 'generatedNote' | 'image' | 'unknown';
    /** Связи карточки если найдены */
    cardLinks: CardLinks | null;
}

/**
 * Данные события при удалении файла
 */
export interface FileDeletedEventData {
    /** Путь удалённого файла */
    deletedPath: string;
    /** card-id */
    cardId: string;
    /** Тип удалённого файла */
    fileType: 'userNote' | 'generatedNote' | 'image';
    /** Связи карточки */
    cardLinks: CardLinks;
}

/**
 * Данные события при переименовании файла
 */
export interface FileRenamedEventData {
    /** Старый путь */
    oldPath: string;
    /** Новый путь */
    newPath: string;
    /** card-id */
    cardId: string;
    /** Тип файла */
    fileType: 'userNote' | 'generatedNote' | 'image';
}
