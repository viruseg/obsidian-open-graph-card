/**
 * Провайдер HTTP-заголовков, адаптированных под текущее окружение
 */
export class RequestHeadersProvider {
    /**
     * Возвращает базовые заголовки для HTML-запросов
     */
    getHtmlHeaders(): Record<string, string> {
        return {
            'Accept-Language': this.buildAcceptLanguage(),
            'User-Agent': this.browserUserAgent()
        };
    }

    /**
     * Возвращает базовые заголовки для бинарных запросов
     */
    getBinaryHeaders(): Record<string, string> {
        return {
            'User-Agent': this.browserUserAgent()
        };
    }

    private buildAcceptLanguage(): string {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
        const language = locale.split('-')[0] || 'en';

        if (locale.toLowerCase() === 'en-us') {
            return 'en-US,en;q=0.9';
        }

        return `${locale},${language};q=0.9,en-US;q=0.8,en;q=0.7`;
    }

    private browserUserAgent(): string {
        return navigator.userAgent;
    }
}
