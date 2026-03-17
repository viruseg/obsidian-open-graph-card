/**
 * Связи карточки по card-id
 */
export interface CardLinks {
    /** Массив путей к заметкам пользователя */
    userNotePaths: string[];
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
    /** путь файла → Set<card-id> (для изображений, один ко многим) */
    imageToCards: Map<string, Set<string>>;
}

/**
 * Сериализуемая версия CardLinks для JSON
 */
export interface CardLinksJSON {
    userNotePaths: string[];
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
    /** Оставшиеся пути к заметкам пользователя после удаления */
    remainingUserNotePaths: string[];
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

/**
 * Типы событий для пользовательских заметок
 */
export type UserNoteEventType =
    | 'og-card:user-note-added'       // Добавлена новая заметка
    | 'og-card:user-note-removed'     // Удалена одна заметка (но есть другие)
    | 'og-card:last-user-note-deleted'; // Удалена последняя заметка

/**
 * Данные для событий user-note
 */
export interface UserNoteEventData {
    /** card-id */
    cardId: string;
    /** Путь к заметке */
    notePath: string;
    /** Все пути (до или после изменения) */
    allNotePaths: string[];
}
