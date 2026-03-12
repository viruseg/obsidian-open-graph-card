import { requestUrl } from 'obsidian';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { OpenGraphSettings } from '../types';

/**
 * Сервис для выполнения HTTP-запросов с поддержкой прокси
 */
export class FetchService {
    constructor(private getSettings: () => OpenGraphSettings) {}

    /**
     * Создаёт прокси-агент на основе настроек
     * @returns HttpsProxyAgent, SocksProxyAgent или undefined если прокси не настроен
     */
    private createAgent(): HttpsProxyAgent | SocksProxyAgent | undefined {
        const proxyUrl = this.getSettings().proxy;
        if (!proxyUrl || proxyUrl.trim() === '') return undefined;

        if (proxyUrl.startsWith('socks')) {
            return new SocksProxyAgent(proxyUrl);
        } else if (proxyUrl.startsWith('http')) {
            return new HttpsProxyAgent(proxyUrl);
        }
        return undefined;
    }

    /**
     * Проверяет, настроен ли прокси
     */
    isProxyConfigured(): boolean {
        const proxyUrl = this.getSettings().proxy;
        return !!proxyUrl && proxyUrl.trim() !== '';
    }

    /**
     * Выполняет HTTP-запрос и возвращает HTML-текст
     * @param url - URL для запроса
     * @param useProxy - использовать ли прокси
     * @param headers - заголовки запроса
     * @returns HTML-текст ответа
     */
    async fetchHtml(url: string, useProxy: boolean, headers?: Record<string, string>): Promise<string> {
        const requestHeaders = headers || {
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        };

        if (useProxy && this.isProxyConfigured()) {
            const agent = this.createAgent();
            if (!agent) {
                throw new Error('Proxy is not properly configured');
            }

            const response = await fetch(url, {
                headers: requestHeaders,
                agent,
                follow: 5
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            return await response.text();
        } else {
            const response = await requestUrl({ url, headers: requestHeaders });
            return response.text;
        }
    }

    /**
     * Выполняет HTTP-запрос и возвращает бинарные данные
     * @param url - URL для запроса
     * @param useProxy - использовать ли прокси
     * @param headers - заголовки запроса
     * @returns ArrayBuffer с бинарными данными
     */
    async fetchBinary(url: string, useProxy: boolean, headers?: Record<string, string>): Promise<ArrayBuffer> {
        const requestHeaders = headers || {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        if (useProxy && this.isProxyConfigured()) {
            const agent = this.createAgent();
            if (!agent) {
                throw new Error('Proxy is not properly configured');
            }

            const response = await fetch(url, { agent, headers: requestHeaders, follow: 5 });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const buf = await response.buffer();
            return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        } else {
            const response = await requestUrl({ url, headers: requestHeaders });
            return response.arrayBuffer;
        }
    }
}
