import { App, TFile } from 'obsidian';
import { FileLinkService } from './FileLinkService';
import { ImageNotesService } from './ImageNotesService';

/**
 * Информация о сломанных связях карточки.
 */
interface BrokenLinks {
    /** Пути к удалённым пользовательским заметкам */
    userNotePaths: string[];
    /** Флаг удаления сгенерированной заметки */
    generatedNotePath: boolean;
    /** Пути к удалённым изображениям */
    imagePaths: string[];
}

/**
 * Статистика проверки целостности.
 */
interface IntegrityCheckStats {
    /** Проверено карточек */
    cardsChecked: number;
    /** Удалено пользовательских заметок */
    userNotesRemoved: number;
    /** Удалено сгенерированных заметок */
    generatedNotesRemoved: number;
    /** Удалено изображений */
    imagesRemoved: number;
    /** Удалено карточек */
    cardsRemoved: number;
    /** Карточки не найдены в файлах */
    cardsNotFoundInFiles: number;
}

/**
 * Сервис для проверки целостности связей при запуске.
 * Проверяет существование всех связанных файлов и удаляет сломанные связи.
 */
export class IntegrityService {
    private checkScheduled: boolean = false;
    /** Кэш содержимого файлов для оптимизации поиска карточек */
    private fileContentCache: Map<string, string | null> = new Map();

    /**
     * @param app - экземпляр приложения Obsidian
     * @param fileLinkService - сервис для отслеживания связей между файлами
     * @param imageNotesService - сервис для управления заметками с изображениями
     */
    constructor(
        private app: App,
        private fileLinkService: FileLinkService,
        private imageNotesService: ImageNotesService
    ) {}

    /**
     * Запланировать проверку целостности после полной загрузки vault.
     * Защита от повторного вызова.
     */
    scheduleCheck(): void {
        if (this.checkScheduled) return;
        this.checkScheduled = true;

        // Запуск после полной готовности workspace
        this.app.workspace.onLayoutReady(() => {
            this.checkIntegrity().catch(err => {
                console.error('[IntegrityService] Check failed:', err);
            });
        });
    }

    /**
     * Выполнить проверку целостности всех связей.
     * Проверяет существование файлов и удаляет сломанные связи.
     */
    async checkIntegrity(): Promise<void> {
        console.log('[IntegrityService] Starting integrity check...');

        // Очищаем кэш перед началом проверки
        this.fileContentCache.clear();

        const allCardIds = this.fileLinkService.getAllCardIds();
        const cardsToDelete: string[] = [];
        const stats: IntegrityCheckStats = {
            cardsChecked: 0,
            userNotesRemoved: 0,
            generatedNotesRemoved: 0,
            imagesRemoved: 0,
            cardsRemoved: 0,
            cardsNotFoundInFiles: 0
        };

        console.log(`[IntegrityService] Checking ${allCardIds.length} cards...`);

        for (const cardId of allCardIds) {
            stats.cardsChecked++;
            const links = this.fileLinkService.getCardLinks(cardId);
            if (!links) continue;

            const brokenLinks: BrokenLinks = {
                userNotePaths: [],
                generatedNotePath: false,
                imagePaths: []
            };

            // Проверяем пользовательские заметки
            for (const notePath of links.userNotePaths) {
                try {
                    const file = this.app.vault.getAbstractFileByPath(notePath);
                    const exists = file && 'stat' in file;
                    if (!exists) {
                        brokenLinks.userNotePaths.push(notePath);
                        console.log(`[IntegrityService] File not found: ${notePath}`);
                        continue; // Файл не существует, нет смысла искать карточку
                    }

                    // Проверяем наличие карточки в файле
                    const cardInFile = await this.cardExistsInFile(notePath, cardId, file as TFile);
                    if (!cardInFile) {
                        console.log(`[IntegrityService] Card ${cardId} not found in file: ${notePath}`);
                        brokenLinks.userNotePaths.push(notePath);
                        stats.cardsNotFoundInFiles++;
                    }
                } catch {
                    brokenLinks.userNotePaths.push(notePath);
                    console.log(`[IntegrityService] File not found: ${notePath}`);
                }
            }

            // Проверяем сгенерированную заметку
            if (links.generatedNotePath && !(await this.fileExists(links.generatedNotePath))) {
                brokenLinks.generatedNotePath = true;
                console.log(`[IntegrityService] File not found: ${links.generatedNotePath}`);
            }

            // Проверяем изображения
            for (const imagePath of links.imagePaths) {
                if (!(await this.fileExists(imagePath))) {
                    brokenLinks.imagePaths.push(imagePath);
                    console.log(`[IntegrityService] File not found: ${imagePath}`);
                }
            }

            // Если есть сломанные связи - очищаем
            if (brokenLinks.userNotePaths.length > 0 ||
                brokenLinks.generatedNotePath ||
                brokenLinks.imagePaths.length > 0) {
                const removed = await this.cleanupBrokenLinks(cardId, brokenLinks);
                stats.userNotesRemoved += removed.userNotes;
                stats.generatedNotesRemoved += removed.generatedNotes;
                stats.imagesRemoved += removed.images;
            }

            // Если после очистки не осталось пользовательских заметок - помечаем на удаление
            if (!this.fileLinkService.hasUserNotes(cardId)) {
                cardsToDelete.push(cardId);
            }
        }

        // Удаляем карточки без пользовательских заметок
        for (const cardId of cardsToDelete) {
            this.fileLinkService.unregisterCard(cardId);
            stats.cardsRemoved++;
        }

        console.log(
            `[IntegrityService] Check complete. ` +
            `Checked ${stats.cardsChecked} cards, ` +
            `removed ${stats.userNotesRemoved} user notes, ` +
            `${stats.generatedNotesRemoved} generated notes, ` +
            `${stats.imagesRemoved} images, ` +
            `${stats.cardsRemoved} orphaned cards. ` +
            `Cards not found in files: ${stats.cardsNotFoundInFiles}`
        );
    }

    /**
     * Проверить существование файла в хранилище.
     *
     * @param path - путь к файлу
     * @returns true если файл существует и является файлом (не папкой)
     */
    private async fileExists(path: string): Promise<boolean> {
        try {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!file) {
                return false;
            }
            // Проверяем что это файл, а не папка
            return 'stat' in file;
        } catch {
            return false;
        }
    }

    /**
     * Проверяет наличие карточки в файле пользователя.
     *
     * @param filePath - путь к файлу
     * @param cardId - ID карточки для поиска
     * @param file - опционально, уже полученный объект файла
     * @returns true если карточка найдена в файле
     */
    private async cardExistsInFile(filePath: string, cardId: string, file?: TFile): Promise<boolean> {
        // Получаем содержимое из кэша или читаем файл
        let content = this.fileContentCache.get(filePath);

        if (content === undefined) {
            // Если файл не передан, получаем его
            if (!file) {
                const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
                if (!abstractFile || !('stat' in abstractFile)) {
                    this.fileContentCache.set(filePath, null);
                    return false;
                }
                file = abstractFile as TFile;
            }

            try {
                content = await this.app.vault.cachedRead(file);
                this.fileContentCache.set(filePath, content ?? null);
            } catch (error) {
                console.error(`[IntegrityService] Error reading file ${filePath}:`, error);
                this.fileContentCache.set(filePath, null);
                return false;
            }
        }

        if (content === null || content === undefined) {
            return false;
        }

        // Ищем card-id в атрибуте или комментарии-маркере
        const attributePattern = `card-id="${cardId}"`;
        const commentPattern = `<!--og-card-end ${cardId}-->`;

        return content.includes(attributePattern) || content.includes(commentPattern);
    }

    /**
     * Очистить сломанные связи карточки.
     *
     * @param cardId - ID карточки
     * @param broken - информация о сломанных связях
     * @returns количество удалённых связей каждого типа
     */
    private async cleanupBrokenLinks(cardId: string, broken: BrokenLinks): Promise<{
        userNotes: number;
        generatedNotes: number;
        images: number;
    }> {
        const links = this.fileLinkService.getCardLinks(cardId);
        if (!links) {
            return { userNotes: 0, generatedNotes: 0, images: 0 };
        }

        let userNotes = 0;
        let generatedNotes = 0;
        let images = 0;

        // Удаляем сломанные пути пользовательских заметок
        for (const notePath of broken.userNotePaths) {
            this.fileLinkService.removeUserNote(cardId, notePath);
            console.log(`[IntegrityService] Removed broken user note: ${notePath}`);
            userNotes++;
        }

        // Если сгенерированная заметка удалена - удаляем связь
        if (broken.generatedNotePath && links.generatedNotePath) {
            this.fileLinkService.clearGeneratedNote(cardId);
            console.log(`[IntegrityService] Removed broken generated note for card: ${cardId}`);
            generatedNotes++;
        }

        // Удаляем сломанные изображения
        for (const imagePath of broken.imagePaths) {
            this.fileLinkService.removeImage(cardId, imagePath);
            console.log(`[IntegrityService] Removed broken image: ${imagePath}`);
            images++;
        }

        return { userNotes, generatedNotes, images };
    }
}
