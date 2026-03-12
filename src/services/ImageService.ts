import { App, TFile } from 'obsidian';
import { FetchService } from './FetchService';
import { ImageSourceClassification } from '../types';
import { getImageSourcesFromCard } from '../utils/html';

/**
 * Сервис для работы с изображениями
 */
export class ImageService {
    constructor(
        private app: App,
        private fetchService: FetchService
    ) {}

    /**
     * Скачивает изображение и сохраняет его в хранилище
     * @param url - URL изображения
     * @param baseFilename - базовое имя файла
     * @param sourcePath - путь к файлу-источнику (для определения папки сохранения)
     * @param useProxy - использовать ли прокси
     * @returns TFile если успешно, null если ошибка
     */
    async downloadAndSave(url: string, baseFilename: string, sourcePath: string, useProxy: boolean): Promise<TFile | null> {
        try {
            const buffer = await this.fetchService.fetchBinary(url, useProxy);

            let ext = 'jpg';
            try {
                const pathname = new URL(url).pathname;
                const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
                if (match) ext = match[1];
            } catch (e) {}

            const filename = `${baseFilename}-${Date.now()}.${ext}`;
            const attachmentPath = await this.app.fileManager.getAvailablePathForAttachment(filename, sourcePath);

            return await this.app.vault.createBinary(attachmentPath, buffer);
        } catch (error) {
            console.error('Error downloading image', error);
            return null;
        }
    }

    /**
     * Классифицирует источники изображений по типу (локальные пути или URL)
     * @param sources - массив всех источников изображений
     * @returns объект классификации с типом и разделёнными путями
     */
    classifySources(sources: string[]): ImageSourceClassification {
        const urlPattern = /^https?:\/\//i;
        const localPaths: string[] = [];
        const urlPaths: string[] = [];

        for (const source of sources) {
            if (urlPattern.test(source)) {
                urlPaths.push(source);
            } else {
                localPaths.push(source);
            }
        }

        // Определяем тип источников
        let type: 'local' | 'url' | 'mixed' | 'empty';
        if (localPaths.length === 0 && urlPaths.length === 0) {
            type = 'empty';
        } else if (localPaths.length > 0 && urlPaths.length > 0) {
            type = 'mixed';
        } else if (localPaths.length > 0) {
            type = 'local';
        } else {
            type = 'url';
        }

        return { type, localPaths, urlPaths };
    }

    /**
     * Удаляет локальные файлы изображений из хранилища
     * @param paths - массив локальных путей к файлам
     */
    async deleteLocalImages(paths: string[]): Promise<void> {
        for (const path of paths) {
            try {
                const file = this.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    await this.app.vault.delete(file);
                }
            } catch (error) {
                console.error(`Failed to delete image: ${path}`, error);
            }
        }
    }

    /**
     * Координирующий метод для очистки локальных изображений карточки
     * @param cardHtml - HTML-код карточки
     * Удаляет локальные изображения, URL игнорируются
     */
    async cleanupCardImages(cardHtml: string): Promise<void> {
        const sources = getImageSourcesFromCard(cardHtml);
        const classification = this.classifySources(sources);

        // Удаляем локальные пути (URL игнорируются)
        if (classification.localPaths.length > 0) {
            await this.deleteLocalImages(classification.localPaths);
        }
    }
}
