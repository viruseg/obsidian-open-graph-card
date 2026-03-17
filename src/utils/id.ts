/**
 * Генерирует уникальный ID карточки
 * Формат: og_{timestamp}_{random}
 * - timestamp: миллисекунды с epoch
 * - random: 8 случайных символов (a-z0-9)
 *
 * @example
 * generateCardId() // "og_1710521234567_a3b5c7d9"
 */
export function generateCardId(): string {
    const timestamp = Date.now();
    const random = generateRandomString(8);
    return `og_${timestamp}_${random}`;
}

/**
 * Генерирует случайную строку заданной длины из символов a-z0-9
 * Использует crypto.getRandomValues() для криптографически безопасной генерации
 */
function generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
    }
    return result;
}
