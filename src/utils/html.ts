/**
 * Утилиты для работы с HTML
 */

import { ImageDataUrlInfo } from '../types';

/**
 * Экранирует специальные HTML символы
 * @param str - строка для экранирования
 * @returns экранированная строка
 */
export function escapeHTML(str: string): string {
    const map: Record<string, string> = {
        '&': '\x26amp;',
        '<': '\x26lt;',
        '>': '\x26gt;',
        "'": '\x26#39;',
        '"': '\x26quot;'
    };
    return str.replace(/[&<>'"]/g, tag => map[tag] || tag);
}

/**
 * Извлекает card-id из HTML карточки
 * @param html - HTML-код карточки
 * @returns card-id или null, если не найден
 */
export function extractCardId(html: string): string | null {
    const match = html.match(/<div class="og-card[^"]*"\s+card-id="(\d+)"/);
    return match ? match[1] : null;
}

/**
 * Извлекает URL из HTML карточки
 * @param html - HTML-код карточки
 * @returns URL или null, если не найден
 */
export function extractUrl(html: string): string | null {
    const match = html.match(/<div class="og-url"><a href="([^"]+)">/);
    return match ? match[1] : null;
}

/**
 * Извлекает пользовательский текст из HTML карточки
 * @param html - HTML-код карточки
 * @returns пользовательский текст или пустая строка
 */
export function extractUserText(html: string): string {
    const userTextRegex = /<div class="og-user-text">([\s\S]*?)<\/div>(?:\s*)(?:<|\\x3C)!--og-user-text-end-->/i;
    const match = html.match(userTextRegex);
    return match ? match[1].trim() : '';
}

/**
 * Проверяет, является ли карточка вертикальной
 * @param html - HTML-код карточки
 * @returns true, если карточка вертикальная
 */
export function isVerticalCard(html: string): boolean {
    return html.includes('og-card-vertical');
}

/**
 * Извлекает все значения атрибутов src из тегов <img> в HTML карточки
 * @param html - HTML-код карточки
 * @returns массив путей/URL из атрибутов src
 */
export function getImageSourcesFromCard(html: string): string[] {
    const sources: string[] = [];
    // Ищем все img теги с классом og-image или og-screenshot (порядок атрибутов может быть любым)
    const imgRegex = /<img[^>]*class="og-(?:image|screenshot)"[^>]*>/gi;
    const srcRegex = /src="([^"]+)"/i;

    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
        const srcMatch = srcRegex.exec(imgMatch[0]);
        if (srcMatch) {
            sources.push(srcMatch[1]);
        }
    }
    return sources;
}

/**
 * Извлекает информацию о data-url из всех изображений в карточке
 * @param html - HTML-код карточки
 * @returns массив информации об изображениях с их data-url
 */
export function getImageDataUrlsFromCard(html: string): ImageDataUrlInfo[] {
    const result: ImageDataUrlInfo[] = [];
    // Ищем все img теги с классом og-image или og-screenshot
    const imgRegex = /<img[^>]*class="og-(?:image|screenshot)"[^>]*>/gi;
    const srcRegex = /src="([^"]+)"/i;
    const dataUrlRegex = /data-url="([^"]+)"/i;

    let elementIndex = 0;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
        const imgTag = imgMatch[0];
        const srcMatch = srcRegex.exec(imgTag);
        const dataUrlMatch = dataUrlRegex.exec(imgTag);

        if (srcMatch) {
            result.push({
                elementIndex: elementIndex,
                src: srcMatch[1],
                dataUrl: dataUrlMatch ? dataUrlMatch[1] : null
            });
        }
        elementIndex++;
    }
    return result;
}

/**
 * Заменяет src изображения в карточке по индексу элемента
 * @param html - HTML-код карточки
 * @param elementIndex - индекс изображения (порядковый номер img тега)
 * @param newSrc - новый src для изображения
 * @param dataUrl - новый data-url (null для удаления, undefined для сохранения текущего)
 * @returns модифицированный HTML-код карточки
 */
export function replaceImageInCard(
    html: string,
    elementIndex: number,
    newSrc: string,
    dataUrl?: string | null
): string {
    const imgRegex = /<img([^>]*class="og-(?:image|screenshot)"[^>]*?)>/gi;
    let currentIndex = 0;

    return html.replace(imgRegex, (fullMatch: string, attrs: string) => {
        if (currentIndex !== elementIndex) {
            currentIndex++;
            return fullMatch;
        }
        currentIndex++;

        // Заменяем src
        let newAttrs = attrs.replace(/src="[^"]*"/i, `src="${newSrc}"`);

        // Обрабатываем data-url
        const hasDataUrl = /data-url="[^"]*"/i.test(newAttrs);

        if (dataUrl === null) {
            // Удаляем data-url
            newAttrs = newAttrs.replace(/\s*data-url="[^"]*"/i, '');
        } else if (dataUrl !== undefined) {
            // Устанавливаем новый data-url
            if (hasDataUrl) {
                newAttrs = newAttrs.replace(/data-url="[^"]*"/i, `data-url="${dataUrl}"`);
            } else {
                newAttrs += ` data-url="${dataUrl}"`;
            }
        }
        // Если dataUrl === undefined, оставляем как есть

        return `<img${newAttrs}>`;
    });
}
