import { requestUrl } from 'obsidian';
import { RequestHeadersProvider } from './RequestHeadersProvider';

/**
 * Сервис для выполнения HTTP-запросов
 */
export class FetchService {
    constructor(
        private readonly requestHeadersProvider: RequestHeadersProvider = new RequestHeadersProvider()
    ) {}

    /**
     * Выполняет HTTP-запрос и возвращает HTML-текст
     * @param url - URL для запроса
     * @param headers - заголовки запроса
     * @returns HTML-текст ответа
     */
    async fetchHtml(url: string, headers?: Record<string, string>): Promise<string> {
        const requestHeaders = {
            ...this.requestHeadersProvider.getHtmlHeaders(),
            ...headers
        };

        const response = await requestUrl({ url, headers: requestHeaders });
        return response.text;
    }

    /**
     * Выполняет HTTP-запрос и возвращает бинарные данные
     * @param url - URL для запроса
     * @param headers - заголовки запроса
     * @returns ArrayBuffer с бинарными данными
     */
    async fetchBinary(url: string, headers?: Record<string, string>): Promise<ArrayBuffer> {
        const requestHeaders = {
            ...this.requestHeadersProvider.getBinaryHeaders(),
            ...headers
        };

        const response = await requestUrl({ url, headers: requestHeaders });
        return response.arrayBuffer;
    }
}
