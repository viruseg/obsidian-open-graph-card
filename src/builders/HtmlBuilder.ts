import { CardData, RatingData, ScreenshotData, ImageData } from '../types';
import { CSS_CLASSES } from '../utils/constants';
import { escapeHTML } from '../utils/html';

/**
 * Строитель HTML для карточек Open Graph
 */
export class HtmlBuilder {
    private cardId: number;

    constructor(cardId: number) {
        this.cardId = cardId;
    }

    /**
     * Строит полный HTML карточки
     */
    buildCard(data: CardData, imageData?: ImageData, screenshotData?: ScreenshotData[]): string {
        const imageHtml = imageData ? this.buildImage(imageData) : '';
        const contentHtml = this.buildContent(data, screenshotData);

        return `<div class="${CSS_CLASSES.CARD}" card-id="${this.cardId}">${imageHtml}${contentHtml}<!--og-card-end ${this.cardId}--></div>`;
    }

    /**
     * Строит HTML для изображения карточки
     */
    buildImage(data: ImageData): string {
        if (!data.src) return '';

        const dataUrlAttr = data.showDataUrl && data.originalUrl
            ? ` data-url="${escapeHTML(data.originalUrl)}"`
            : '';

        return `<img src="${escapeHTML(data.src)}" class="${CSS_CLASSES.IMAGE}" alt=""${dataUrlAttr} />`;
    }

    /**
     * Строит HTML для контента карточки
     */
    private buildContent(data: CardData, screenshotData?: ScreenshotData[]): string {
        const title = escapeHTML(data.title || '');
        const description = escapeHTML(data.description || '');
        const safeUrl = escapeHTML(data.url);

        const ratingHtml = data.rating ? this.buildRating(data.rating) : '';
        const tagsHtml = data.tags && data.tags.length > 0 ? this.buildTags(data.tags) : '';
        const screenshotsHtml = screenshotData && screenshotData.length > 0
            ? this.buildScreenshots(screenshotData)
            : '';
        const userTextHtml = data.userText ? this.buildUserText(data.userText) : '';

        const extraHtml = tagsHtml + screenshotsHtml;

        return `<div class="${CSS_CLASSES.CONTENT}">` +
            `<div class="${CSS_CLASSES.TITLE}">${title}</div>` +
            ratingHtml +
            `<div class="${CSS_CLASSES.DESCRIPTION}">${description}</div>` +
            extraHtml +
            `<div class="${CSS_CLASSES.URL}"><a href="${safeUrl}">${safeUrl}</a></div>` +
            userTextHtml +
            `</div>`;
    }

    /**
     * Строит HTML для рейтинга
     */
    buildRating(rating: RatingData): string {
        const textContent = (rating.score * 100).toFixed(2) + '%';
        return `<div class="${CSS_CLASSES.RATING}"><span class="${rating.className}">${textContent}</span></div>`;
    }

    /**
     * Строит HTML для тегов
     */
    buildTags(tags: string[]): string {
        if (!tags || tags.length === 0) return '';

        const tagsHtml = tags.map(t => `<div class="${CSS_CLASSES.TAG}">${escapeHTML(t)}</div>`).join('');
        return `<div class="${CSS_CLASSES.TAGS}">${tagsHtml}</div>`;
    }

    /**
     * Строит HTML для скриншотов
     */
    buildScreenshots(screenshots: ScreenshotData[]): string {
        if (!screenshots || screenshots.length === 0) return '';

        const screenshotsHtml = screenshots.map(s => {
            const src = s.localPath || s.originalUrl;
            const dataUrlAttr = s.localPath ? ` data-url="${escapeHTML(s.originalUrl)}"` : '';
            return `<img src="${escapeHTML(src)}" class="${CSS_CLASSES.SCREENSHOT}"${dataUrlAttr} />`;
        }).join('');

        return `<div class="${CSS_CLASSES.SCREENSHOTS}">${screenshotsHtml}</div>`;
    }

    /**
     * Строит HTML для пользовательского текста
     */
    buildUserText(text: string): string {
        if (!text || text.trim() === '') return '';
        return `<div class="${CSS_CLASSES.USER_TEXT}">${escapeHTML(text)}</div><!--og-user-text-end-->`;
    }

    /**
     * Генерирует уникальный ID карточки на основе timestamp
     */
    static generateCardId(): number {
        return Date.now();
    }
}
