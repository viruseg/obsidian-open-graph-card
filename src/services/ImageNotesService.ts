import { App, TFile, TFolder } from 'obsidian';
import { ImageService } from './ImageService';
import { FileLinkService } from './FileLinkService';
import { getImageDataUrlsFromCard } from '../utils/html';

/**
 * Сервис для управления заметками с markdown-ссылками на локальные изображения карточек.
 * Каждая карточка с локальными изображениями имеет соответствующую заметку.
 */
export class ImageNotesService {
    /** Имя подпапки для заметок в папке вложений */
    private static readonly NOTES_SUBFOLDER = 'open-graph-card';

    /**
     * @param app - экземпляр приложения Obsidian
     * @param imageService - сервис для работы с изображениями
     * @param fileLinkService - сервис для отслеживания связей между файлами
     */
    constructor(
        private app: App,
        private imageService: ImageService,
        private fileLinkService: FileLinkService
    ) {}

    /**
     * Синхронизировать заметку с карточкой.
     * Создаёт/обновляет заметку если есть локальные изображения.
     * Удаляет заметку если локальных изображений нет.
     *
     * @param cardId - ID карточки
     * @param cardHtml - HTML-код карточки
     */
    async syncNote(cardId: string, cardHtml: string): Promise<void> {
        try {
            const localPaths = this.extractLocalImagePaths(cardHtml);

            if (localPaths.length === 0) {
                // Локальных изображений нет - удаляем заметку
                await this.deleteNote(cardId);
                return;
            }

            // Есть локальные изображения - создаём/обновляем заметку
            const notePath = this.getNotePath(cardId);
            const content = this.createNoteContent(localPaths);

            const existingFile = this.app.vault.getAbstractFileByPath(notePath);

            if (existingFile instanceof TFile) {
                // Обновляем существующую заметку
                await this.app.vault.modify(existingFile, content);
            } else {
                // Создаём новую заметку (папка создаётся автоматически)
                await this.ensureNotesFolder();
                await this.app.vault.create(notePath, content);
            }

            // Регистрируем связи в FileLinkService
            this.fileLinkService.setGeneratedNote(cardId, notePath);
            for (const imagePath of localPaths) {
                this.fileLinkService.addImage(cardId, imagePath);
            }
        } catch (error) {
            console.error('ImageNotesService: Error syncing image note:', error);
        }
    }

    /**
     * Удалить заметку карточки.
     *
     * @param cardId - ID карточки
     */
    async deleteNote(cardId: string): Promise<void> {
        try {
            const notePath = this.getNotePath(cardId);
            const file = this.app.vault.getAbstractFileByPath(notePath);

            if (file instanceof TFile) {
                await this.app.vault.delete(file);
            }

            // Удаляем связь сгенерированной заметки
            this.fileLinkService.clearGeneratedNote(cardId);
        } catch (error) {
            console.error('Error deleting image note:', error);
        }
    }

    /**
     * Удалить заметку карточки, если она пустая.
     *
     * @param cardId - ID карточки
     * @returns true если заметка была удалена, false если заметка не пустая или не существует
     */
    async deleteNoteIfEmpty(cardId: string): Promise<boolean> {
        try {
            const notePath = this.getNotePath(cardId);
            const file = this.app.vault.getAbstractFileByPath(notePath);

            if (!(file instanceof TFile)) {
                return false;
            }

            const content = await this.app.vault.read(file);
            const trimmedContent = content.trim();

            // Проверяем, является ли заметка пустой
            if (this.isEmptyNoteContent(trimmedContent)) {
                await this.app.vault.delete(file);
                this.fileLinkService.clearGeneratedNote(cardId);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error deleting empty image note:', error);
            return false;
        }
    }

    /**
     * Проверить, является ли содержимое заметки пустым.
     *
     * @param content - содержимое заметки (уже обрезанное)
     * @returns true если содержимое пустое
     */
    private isEmptyNoteContent(content: string): boolean {
        return content.trim() === '';
    }

    /**
     * Получить путь к заметке относительно корня хранилища.
     *
     * @param cardId - ID карточки
     * @returns путь к файлу заметки
     */
    getNotePath(cardId: string): string {
        const notesFolder = this.getNotesFolder();
        return `${notesFolder}/${cardId}.md`;
    }

    /**
     * Получить путь к папке плагина в папке вложений.
     *
     * @returns путь к папке заметок
     */
    private getNotesFolder(): string {
        const attachmentFolderPath = this.app.vault.getConfig('attachmentFolderPath') as string || '/';

        if (attachmentFolderPath === '/' || attachmentFolderPath === '') {
            return ImageNotesService.NOTES_SUBFOLDER;
        }

        return `${attachmentFolderPath}/${ImageNotesService.NOTES_SUBFOLDER}`;
    }

    /**
     * Извлечь локальные пути изображений из HTML карточки.
     * Локальные изображения имеют атрибут data-url с оригинальным URL.
     *
     * @param cardHtml - HTML-код карточки
     * @returns массив локальных путей к изображениям
     */
    private extractLocalImagePaths(cardHtml: string): string[] {
        const imageData = getImageDataUrlsFromCard(cardHtml);

        // Фильтруем только локальные изображения (имеют data-url)
        return imageData
            .filter(img => img.dataUrl !== null)
            .map(img => img.src);
    }

    /**
     * Создать содержимое заметки с markdown-ссылками.
     *
     * @param imagePaths - массив путей к изображениям
     * @returns содержимое заметки в формате markdown
     */
    private createNoteContent(imagePaths: string[]): string {
        const lines: string[] = [];

        for (const path of imagePaths) {
            lines.push(`![](${encodeURI(path)})`);
        }

        return lines.join('\n');
    }

    /**
     * Убедиться, что папка для заметок существует.
     * Создаёт папку и все необходимые родительские папки.
     */
    private async ensureNotesFolder(): Promise<void> {
        const notesFolder = this.getNotesFolder();
        const existing = this.app.vault.getAbstractFileByPath(notesFolder);

        if (existing instanceof TFolder) {
            return;
        }

        // Создаём папку (vault.create создаёт и родительские папки)
        await this.app.vault.createFolder(notesFolder);
    }
}
