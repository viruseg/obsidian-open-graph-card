/**
 * Утилиты для работы с редактором
 */

import { Editor, EditorPosition } from 'obsidian';
import { UrlInfo } from '../types';

/**
 * Находит URL под курсором в редакторе
 * Поддерживает как обычные URL, так и markdown-ссылки
 * @param editor - экземпляр редактора Obsidian
 * @returns информация о URL или null, если URL не найден
 */
export function getUrlUnderCursor(editor: Editor): UrlInfo | null {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);

    // Сначала проверяем markdown-ссылки: [текст](url)
    const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
    let match;
    while ((match = mdLinkRegex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (cursor.ch >= start && cursor.ch <= end) {
            return { url: match[2], from: { line: cursor.line, ch: start }, to: { line: cursor.line, ch: end } };
        }
    }

    // Затем проверяем обычные URL
    const urlRegex = /(https?:\/\/[^\s>)]+)/g;
    while ((match = urlRegex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (cursor.ch >= start && cursor.ch <= end) {
            return { url: match[1], from: { line: cursor.line, ch: start }, to: { line: cursor.line, ch: end } };
        }
    }

    return null;
}

/**
 * Устанавливает курсор в указанную позицию
 * Используется для предотвращения прыжков прокрутки после вставки карточки
 * @param editor - экземпляр редактора Obsidian
 * @param pos - позиция курсора
 */
export function setCursorWithScrollPrevention(editor: Editor, pos: EditorPosition): void {
    editor.setCursor(pos);
}
