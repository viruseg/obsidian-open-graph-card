import { EditorPosition } from 'obsidian';

export interface UrlInfo {
    url: string;
    from: EditorPosition;
    to: EditorPosition;
}

export interface CardInfo {
    url: string;
    userText: string;
    from: EditorPosition;
    to: EditorPosition;
    cardId?: string;
}

export interface CardData {
    title: string;
    description: string;
    image?: string;
    url: string;
    userText?: string;
}
