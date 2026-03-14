import { requestUrl } from 'obsidian';

/**
 * Сервис для выполнения HTTP-запросов
 */
export class FetchService {
    /**
     * Выполняет HTTP-запрос и возвращает HTML-текст
     * @param url - URL для запроса
     * @param headers - заголовки запроса
     * @returns HTML-текст ответа
     */
    async fetchHtml(url: string, headers?: Record<string, string>): Promise<string> {
        const requestHeaders = headers || {
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
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
        const requestHeaders = headers || {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        const response = await requestUrl({ url, headers: requestHeaders });
        return response.arrayBuffer;
    }
}
