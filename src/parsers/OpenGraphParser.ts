import { CardData } from '../types';

/**
 * Абстрактный базовый класс для парсеров Open Graph метаданных
 */
export abstract class OpenGraphParser {
    /**
     * Проверяет, может ли этот парсер обработать данный URL
     */
    abstract canParse(hostname: string): boolean;

    /**
     * Парсит документ и возвращает данные карточки
     */
    abstract parse(doc: Document, url: string): Promise<CardData>;

    /**
     * Извлекает базовые Open Graph данные из документа
     */
    protected extractBasicData(doc: Document, url: string): Partial<CardData> {
        let image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

        // Преобразуем относительный URL изображения в абсолютный
        if (image && !image.startsWith('http')) {
            try {
                image = new URL(image, url).href;
            } catch (e) {
                // Игнорируем ошибки парсинга URL
            }
        }

        return {
            title: doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                   doc.querySelector('title')?.textContent || '',
            description: doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                         doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            image,
            url
        };
    }

    /**
     * Возвращает дополнительные заголовки для HTTP-запроса
     */
    getHeaders(): Record<string, string> {
        return {
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        };
    }
}

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
