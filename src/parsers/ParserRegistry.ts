import { OpenGraphParser } from './OpenGraphParser';
import { DefaultParser } from './DefaultParser';

/**
 * Реестр парсеров для выбора подходящего парсера по URL
 */
export class ParserRegistry {
    private parsers: OpenGraphParser[] = [];
    private defaultParser = new DefaultParser();

    /**
     * Возвращает подходящий парсер для данного URL
     * @param url - URL для парсинга
     * @returns Парсер, способный обработать данный URL
     */
    getParser(url: string): OpenGraphParser {
        try {
            const hostname = new URL(url).hostname;
            const parser = this.parsers.find(p => p.canParse(hostname));
            return parser || this.defaultParser;
        } catch {
            return this.defaultParser;
        }
    }

    /**
     * Регистрирует новый парсер
     */
    registerParser(parser: OpenGraphParser): void {
        this.parsers.unshift(parser); // Добавляем в начало для приоритета
    }
}

// Singleton экземпляр для удобства
export const parserRegistry = new ParserRegistry();
