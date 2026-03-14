import { Editor } from 'obsidian';
import { CardInfo, UrlInfo } from './card';

/**
 * Колбэки для ContextMenuHandler
 */
export interface ContextMenuHandlerCallbacks {
    getCardUnderCursor: (editor: Editor, targetLine?: number) => CardInfo | null;
    replaceWithOpenGraph: (editor: Editor, view: any, urlInfo: UrlInfo, userText?: string) => Promise<void>;
    updateCardUserText: (editor: Editor, cardInfo: CardInfo, newText: string) => Promise<void>;
    toggleCardOrientation: (editor: Editor, cardInfo: CardInfo) => void;
}
