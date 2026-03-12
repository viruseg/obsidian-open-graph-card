/**
 * Утилиты для работы с HTML
 */

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
