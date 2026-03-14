import { App, TFile } from 'obsidian';
import { FetchService } from './FetchService';
import { ImageSourceClassification, ImageDownloadResult, ImageRestoreResult, ImageDataUrlInfo } from '../types';
import { getImageSourcesFromCard, getImageDataUrlsFromCard, replaceImageInCard } from '../utils/html';

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
     * @returns TFile если успешно, null если ошибка
     */
    async downloadAndSave(url: string, baseFilename: string, sourcePath: string): Promise<TFile | null> {
        try {
            const buffer = await this.fetchService.fetchBinary(url);

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

    /**
     * Классифицирует источники изображений в карточке
     * @param cardHtml - HTML-код карточки
     * @returns объект с флагами наличия URL и локальных изображений
     */
    classifyCardImageSources(cardHtml: string): { hasUrlImages: boolean; hasLocalImages: boolean } {
        const imageData = getImageDataUrlsFromCard(cardHtml);
        const urlPattern = /^https?:\/\//i;

        let hasUrlImages = false;
        let hasLocalImages = false;

        for (const img of imageData) {
            if (img.dataUrl) {
                // Изображение имеет data-url - это локальное изображение
                hasLocalImages = true;
            } else if (urlPattern.test(img.src)) {
                // Изображение без data-url с URL - это удалённое изображение
                hasUrlImages = true;
            }
        }

        return { hasUrlImages, hasLocalImages };
    }

    /**
     * Скачивает все удалённые изображения в карточке и сохраняет их локально
     * @param cardHtml - HTML-код карточки
     * @param cardId - ID карточки для генерации имён файлов
     * @param sourcePath - путь к файлу-источнику
     * @returns результат операции скачивания
     */
    async downloadCardImages(
        cardHtml: string,
        cardId: string,
        sourcePath: string
    ): Promise<{ result: ImageDownloadResult; updatedHtml: string }> {
        const imageData = getImageDataUrlsFromCard(cardHtml);
        const urlPattern = /^https?:\/\//i;
        const errors: string[] = [];
        let downloadedCount = 0;
        let updatedHtml = cardHtml;

        for (const img of imageData) {
            // Пропускаем изображения, которые уже имеют локальный путь (data-url)
            if (img.dataUrl) continue;

            // Пропускаем не-URL изображения
            if (!urlPattern.test(img.src)) continue;

            try {
                const file = await this.downloadAndSave(img.src, `og-${cardId}`, sourcePath);
                if (file) {
                    updatedHtml = replaceImageInCard(updatedHtml, img.elementIndex, file.path, img.src);
                    downloadedCount++;
                } else {
                    errors.push(`Failed to download: ${img.src}`);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`Error downloading ${img.src}: ${errorMsg}`);
            }
        }

        return {
            result: {
                success: downloadedCount > 0,
                downloadedCount,
                failedCount: errors.length,
                errors
            },
            updatedHtml
        };
    }

    /**
     * Восстанавливает URL изображений из data-url атрибутов и удаляет локальные файлы
     * @param cardHtml - HTML-код карточки
     * @returns результат операции восстановления
     */
    async restoreCardImages(cardHtml: string): Promise<{ result: ImageRestoreResult; updatedHtml: string }> {
        const imageData = getImageDataUrlsFromCard(cardHtml);
        const errors: string[] = [];
        let restoredCount = 0;
        let updatedHtml = cardHtml;

        for (const img of imageData) {
            // Пропускаем изображения без data-url
            if (!img.dataUrl) continue;

            try {
                // Удаляем локальный файл
                const file = this.app.vault.getAbstractFileByPath(img.src);
                if (file instanceof TFile) {
                    await this.app.vault.delete(file);
                }

                // Восстанавливаем URL из data-url
                updatedHtml = replaceImageInCard(updatedHtml, img.elementIndex, img.dataUrl, null);
                restoredCount++;
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`Error restoring ${img.src}: ${errorMsg}`);
            }
        }

        return {
            result: {
                success: restoredCount > 0,
                restoredCount,
                failedCount: errors.length,
                errors
            },
            updatedHtml
        };
    }
}
