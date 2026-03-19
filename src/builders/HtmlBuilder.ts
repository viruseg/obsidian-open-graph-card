import { CardData, ImageData } from '../types';
import { CSS_CLASSES } from '../utils/constants';
import { escapeHTML } from '../utils/html';

export class HtmlBuilder {
    private cardId: string;

    constructor(cardId: string) {
        this.cardId = cardId;
    }

    buildCard(data: CardData, imageData?: ImageData, includeImage: boolean = true): string {
        const imageHtml = includeImage && imageData ? this.buildImage(imageData) : '';
        const contentHtml = this.buildContent(data);

        return `<div class="${CSS_CLASSES.CARD}" card-id="${this.cardId}">${imageHtml}${contentHtml}<!--og-card-end ${this.cardId}--></div>`;
    }

    buildImage(data: ImageData): string {
        if (!data.src) return '';

        const dataUrlAttr = data.showDataUrl && data.originalUrl
            ? ` data-url="${escapeHTML(data.originalUrl)}"`
            : '';

        return `<img src="${escapeHTML(data.src)}" class="${CSS_CLASSES.IMAGE}" alt=""${dataUrlAttr} />`;
    }

    private buildContent(data: CardData): string {
        const title = escapeHTML(data.title || '');
        const description = escapeHTML(data.description || '');
        const safeUrl = escapeHTML(data.url);

        const userTextHtml = data.userText ? this.buildUserText(data.userText) : '';

        return `<div class="${CSS_CLASSES.CONTENT}">` +
            `<div class="${CSS_CLASSES.TITLE}">${title}</div>` +
            `<div class="${CSS_CLASSES.DESCRIPTION}">${description}</div>` +
            `<div class="${CSS_CLASSES.URL}"><a href="${safeUrl}">${safeUrl}</a></div>` +
            userTextHtml +
            `</div>`;
    }

    buildUserText(text: string): string {
        if (!text || text.trim() === '') return '';
        return `<div class="${CSS_CLASSES.USER_TEXT}">${escapeHTML(text)}</div><!--og-user-text-end-->`;
    }
}
