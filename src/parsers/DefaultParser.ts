import { CardData } from '../types';
import { OpenGraphParser } from './OpenGraphParser';

/**
 * Парсер по умолчанию для обычных сайтов
 */
export class DefaultParser extends OpenGraphParser {
    canParse(hostname: string): boolean {
        // Fallback для всех сайтов
        return true;
    }

    async parse(doc: Document, url: string): Promise<CardData> {
        const basic = this.extractBasicData(doc, url);
        return {
            title: basic.title || '',
            description: basic.description || '',
            image: basic.image,
            url: basic.url || url
        };
    }
}
