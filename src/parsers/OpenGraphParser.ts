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
    getExtraHeaders(): Record<string, string> {
        return {};
    }
}
