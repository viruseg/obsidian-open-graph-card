/**
 * Утилиты для работы с HTML карточек через DOMParser
 */

import { ImageDataUrlInfo } from '../types';
import { CARD_REGEX } from './constants';

/**
 * Парсит HTML-код карточки и возвращает Document и элемент карточки
 * @param html - HTML-код карточки
 * @returns объект с Document и элементом карточки, или null если парсинг не удался
 */
export function parseCardHtml(html: string): { doc: Document; card: HTMLElement } | null {
    if (!html || html.trim() === '') {
        return null;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const card = doc.querySelector('.og-card') as HTMLElement | null;

    if (!card) {
        return null;
    }

    return { doc, card };
}

/**
 * Сериализует элемент карточки обратно в HTML-строку
 * @param card - элемент карточки
 * @returns HTML-строка
 */
export function serializeCard(card: HTMLElement): string {
    return card.outerHTML;
}

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
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return null;
    }

    return parsed.card.getAttribute('card-id');
}

/**
 * Извлекает URL из HTML карточки
 * @param html - HTML-код карточки
 * @returns URL или null, если не найден
 */
export function extractUrl(html: string): string | null {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return null;
    }

    const link = parsed.card.querySelector('.og-url a');
    return link ? link.getAttribute('href') : null;
}

/**
 * Извлекает пользовательский текст из HTML карточки
 * @param html - HTML-код карточки
 * @returns пользовательский текст или пустая строка
 */
export function extractUserText(html: string): string {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return '';
    }

    const userTextDiv = parsed.card.querySelector('.og-user-text');
    return userTextDiv ? userTextDiv.textContent?.trim() || '' : '';
}

/**
 * Проверяет, является ли карточка вертикальной
 * @param html - HTML-код карточки
 * @returns true, если карточка вертикальная
 */
export function isVerticalCard(html: string): boolean {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return false;
    }

    return parsed.card.classList.contains('og-card-vertical');
}

/**
 * Извлекает все значения атрибутов src из тегов <img> в HTML карточки
 * @param html - HTML-код карточки
 * @returns массив путей/URL из атрибутов src
 */
export function getImageSourcesFromCard(html: string): string[] {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return [];
    }

    const images = parsed.card.querySelectorAll('img.og-image, img.og-screenshot');
    const sources: string[] = [];

    images.forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
            sources.push(src);
        }
    });

    return sources;
}

/**
 * Извлекает информацию о data-url из всех изображений в карточке
 * @param html - HTML-код карточки
 * @returns массив информации об изображениях с их data-url
 */
export function getImageDataUrlsFromCard(html: string): ImageDataUrlInfo[] {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return [];
    }

    const images = parsed.card.querySelectorAll('img.og-image, img.og-screenshot');
    const result: ImageDataUrlInfo[] = [];

    images.forEach((img, index) => {
        const src = img.getAttribute('src');
        const dataUrl = img.getAttribute('data-url');

        if (src) {
            result.push({
                elementIndex: index,
                src,
                dataUrl: dataUrl || null
            });
        }
    });

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
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return html;
    }

    const images = parsed.card.querySelectorAll('img.og-image, img.og-screenshot');
    const targetImg = images[elementIndex] as HTMLImageElement | undefined;

    if (!targetImg) {
        return html;
    }

    targetImg.setAttribute('src', newSrc);

    if (dataUrl === null) {
        targetImg.removeAttribute('data-url');
    } else if (dataUrl !== undefined) {
        targetImg.setAttribute('data-url', dataUrl);
    }

    return serializeCard(parsed.card);
}

/**
 * Извлекает заголовок из HTML карточки
 * @param html - HTML-код карточки
 * @returns заголовок или пустая строка
 */
export function extractTitle(html: string): string {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return '';
    }

    const titleDiv = parsed.card.querySelector('.og-title');
    return titleDiv ? titleDiv.textContent?.trim() || '' : '';
}

/**
 * Извлекает описание из HTML карточки
 * @param html - HTML-код карточки
 * @returns описание или пустая строка
 */
export function extractDescription(html: string): string {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return '';
    }

    const descDiv = parsed.card.querySelector('.og-description');
    return descDiv ? descDiv.textContent?.trim() || '' : '';
}

/**
 * Добавляет или обновляет пользовательский текст в карточке
 * @param html - HTML-код карточки
 * @param text - текст для добавления/обновления
 * @returns модифицированный HTML-код карточки
 */
export function updateUserText(html: string, text: string): string {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return html;
    }

    const existingUserText = parsed.card.querySelector('.og-user-text');
    const existingEndMarker = parsed.card.querySelector('comment[data-type="og-user-text-end"]');

    if (text.trim() === '') {
        if (existingUserText) {
            existingUserText.remove();
        }
        return serializeCard(parsed.card);
    }

    if (existingUserText) {
        existingUserText.textContent = text;
    } else {
        const userTextDiv = parsed.doc.createElement('div');
        userTextDiv.className = 'og-user-text';
        userTextDiv.textContent = text;

        const contentDiv = parsed.card.querySelector('.og-content');
        if (contentDiv) {
            contentDiv.appendChild(userTextDiv);
        }
    }

    return serializeCard(parsed.card);
}

/**
 * Переключает ориентацию карточки (горизонтальная/вертикальная)
 * @param html - HTML-код карточки
 * @returns модифицированный HTML-код карточки
 */
export function toggleCardOrientation(html: string): string {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return html;
    }

    parsed.card.classList.toggle('og-card-vertical');

    return serializeCard(parsed.card);
}

/**
 * Заменяет card-id в карточке
 * @param html - HTML-код карточки
 * @param newCardId - новый card-id
 * @returns модифицированный HTML-код карточки
 */
export function replaceCardId(html: string, newCardId: string): string {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return html;
    }

    parsed.card.setAttribute('card-id', newCardId);

    const iterator = parsed.doc.createNodeIterator(
        parsed.card,
        NodeFilter.SHOW_COMMENT
    );

    let commentNode: Comment | null;
    while ((commentNode = iterator.nextNode() as Comment | null)) {
        if (commentNode.textContent?.startsWith('og-card-end')) {
            commentNode.textContent = `og-card-end ${newCardId}`;
            break;
        }
    }

    return serializeCard(parsed.card);
}

/**
 * Находит все карточки в тексте заметки и возвращает их позиции
 * @param content - полное содержимое заметки
 * @returns массив объектов с cardId, html, startOffset, endOffset
 */
export function findAllCards(content: string): Array<{
    cardId: string;
    html: string;
    startOffset: number;
    endOffset: number;
}> {
    const results: Array<{
        cardId: string;
        html: string;
        startOffset: number;
        endOffset: number;
    }> = [];

    CARD_REGEX.lastIndex = 0;

    let match;
    while ((match = CARD_REGEX.exec(content)) !== null) {
        const html = match[0];
        const cardId = extractCardId(html);

        if (cardId) {
            results.push({
                cardId,
                html,
                startOffset: match.index,
                endOffset: match.index + html.length
            });
        }
    }

    return results;
}

/**
 * Извлекает все теги из карточки
 * @param html - HTML-код карточки
 * @returns массив тегов
 */
export function extractTags(html: string): string[] {
    const parsed = parseCardHtml(html);
    if (!parsed) {
        return [];
    }

    const tagElements = parsed.card.querySelectorAll('.og-tag');
    const tags: string[] = [];

    tagElements.forEach(tagEl => {
        const tagText = tagEl.textContent?.trim();
        if (tagText) {
            tags.push(tagText);
        }
    });

    return tags;
}
