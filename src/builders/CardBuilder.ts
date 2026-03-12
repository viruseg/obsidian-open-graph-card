import { CardData, RatingData, ScreenshotData } from '../types';

/**
 * Строитель данных карточки Open Graph
 * Используется для пошаговой сборки CardData
 */
export class CardBuilder {
    private data: Partial<CardData> = {};

    withTitle(title: string): this {
        this.data.title = title;
        return this;
    }

    withDescription(description: string): this {
        this.data.description = description;
        return this;
    }

    withImage(image?: string): this {
        this.data.image = image;
        return this;
    }

    withUrl(url: string): this {
        this.data.url = url;
        return this;
    }

    withRating(rating?: RatingData): this {
        this.data.rating = rating;
        return this;
    }

    withTags(tags?: string[]): this {
        this.data.tags = tags;
        return this;
    }

    withScreenshots(screenshots?: ScreenshotData[]): this {
        this.data.screenshots = screenshots;
        return this;
    }

    withUserText(userText?: string): this {
        this.data.userText = userText;
        return this;
    }

    /**
     * Возвращает собранные данные карточки
     */
    build(): CardData {
        return {
            title: this.data.title || '',
            description: this.data.description || '',
            url: this.data.url || '',
            image: this.data.image,
            rating: this.data.rating,
            tags: this.data.tags,
            screenshots: this.data.screenshots,
            userText: this.data.userText
        };
    }

    /**
     * Сбрасывает строитель для повторного использования
     */
    reset(): this {
        this.data = {};
        return this;
    }
}
