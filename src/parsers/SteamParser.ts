import { OpenGraphParser } from './OpenGraphParser';
import { CardData, RatingData, ScreenshotData } from '../types';
import { STEAM_RATING_CLASSES } from '../utils/constants';

/**
 * Steam-специфичный парсер для store.steampowered.com
 * Извлекает расширенные данные: рейтинг, теги, скриншоты
 */
export class SteamParser extends OpenGraphParser {
    private static readonly HOSTNAME = 'store.steampowered.com';

    canParse(hostname: string): boolean {
        return hostname === SteamParser.HOSTNAME;
    }

    async parse(doc: Document, url: string): Promise<CardData> {
        const basic = this.extractBasicData(doc, url);

        // Steam использует #appHubAppName для названия
        const title = doc.getElementById('appHubAppName')?.textContent?.trim() || basic.title || '';

        // Извлечение рейтинга по формуле SteamDB Bayesian
        const rating = this.extractRating(doc);

        // Извлечение тегов
        const tags = this.extractTags(doc);

        // Извлечение скриншотов
        const screenshots = this.extractScreenshots(doc);

        return {
            title,
            description: basic.description || '',
            image: basic.image,
            url: basic.url || url,
            rating,
            tags,
            screenshots
        };
    }

    /**
     * Возвращает дополнительные заголовки для Steam-запросов
     */
    getHeaders(): Record<string, string> {
        return {
            ...super.getHeaders(),
            // Cookie для отображения контента 18+ игр
            'Cookie': 'wants_mature_content=1;path=/'
        };
    }

    /**
     * Извлекает рейтинг из страницы Steam
     * Использует формулу SteamDB Bayesian:
     * score = average - (average - 0.5) * (2 ** -Math.log10(totalVotes + 1))
     */
    private extractRating(doc: Document): RatingData | undefined {
        const positiveVoteText = doc.querySelector('label[for="review_type_positive"] .user_reviews_count');
        const negativeVoteText = doc.querySelector('label[for="review_type_negative"] .user_reviews_count');

        if (!positiveVoteText || !negativeVoteText) {
            return undefined;
        }

        const posVotesText = positiveVoteText.textContent?.replace(/[(.,\s)]/g, '') || '0';
        const negVotesText = negativeVoteText.textContent?.replace(/[(.,\s)]/g, '') || '0';

        const positiveVotes = Number.parseInt(posVotesText, 10);
        const negativeVotes = Number.parseInt(negVotesText, 10);
        const totalVotes = positiveVotes + negativeVotes;

        if (totalVotes === 0) {
            return undefined;
        }

        // SteamDB Bayesian формула
        const average = positiveVotes / totalVotes;
        const score = average - (average - 0.5) * (2 ** -Math.log10(totalVotes + 1));

        // Определение класса рейтинга
        let ratingClass: string;
        if (totalVotes < 500) {
            ratingClass = STEAM_RATING_CLASSES.WHITE;
        } else if (score > 0.74) {
            ratingClass = STEAM_RATING_CLASSES.GOOD;
        } else if (score > 0.49) {
            ratingClass = STEAM_RATING_CLASSES.AVERAGE;
        } else {
            ratingClass = STEAM_RATING_CLASSES.POOR;
        }

        return {
            score,
            className: ratingClass
        };
    }

    /**
     * Извлекает теги из страницы Steam
     * Возвращает до 5 популярных тегов
     */
    private extractTags(doc: Document): string[] {
        const tagNodes = doc.querySelectorAll('.popular_tags a');
        return Array.from(tagNodes)
            .map(a => a.textContent?.trim() || '')
            .filter(t => t !== '')
            .slice(0, 5);
    }

    /**
     * Извлекает скриншоты из data-props атрибута карусели
     */
    private extractScreenshots(doc: Document): ScreenshotData[] {
        const carouselDiv = doc.querySelector('.gamehighlight_desktopcarousel');
        if (!carouselDiv) {
            return [];
        }

        const dataProps = carouselDiv.getAttribute('data-props');
        if (!dataProps) {
            return [];
        }

        try {
            const parsedData = JSON.parse(dataProps);

            if (!parsedData.screenshots || !Array.isArray(parsedData.screenshots)) {
                return [];
            }

            const thumbnails: string[] = parsedData.screenshots
                .map((s: any) => s.thumbnail)
                .filter((src: string) => src);

            return thumbnails.map(src => ({
                originalUrl: src,
                localPath: null
            }));
        } catch (e) {
            console.error('Error parsing Steam data-props', e);
            return [];
        }
    }
}
