import { CardData } from '../types';

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

    withUserText(userText?: string): this {
        this.data.userText = userText;
        return this;
    }

    build(): CardData {
        return {
            title: this.data.title || '',
            description: this.data.description || '',
            url: this.data.url || '',
            image: this.data.image,
            userText: this.data.userText
        };
    }

    reset(): this {
        this.data = {};
        return this;
    }
}
