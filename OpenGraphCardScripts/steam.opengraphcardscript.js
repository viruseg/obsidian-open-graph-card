/**
 * ==OpenGraphCardScript==
 * @name Steam Extended Content
 * @version 1.0.2
 * @author Open Graph Card
 * @domains store.steampowered.com
 * @cover true
 * ==/OpenGraphCardScript==
 */

export const cssStyles = `
.og-steam-rating {
    font-size: 0.85em;
    font-weight: 600;
}

.og-steam-rating-poor { color: var(--color-red); }
.og-steam-rating-white { color: var(--text-muted); }
.og-steam-rating-good { color: var(--color-green); }
.og-steam-rating-average { color: var(--color-orange); }

.og-steam-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
}

.og-steam-tag {
    background-color: var(--background-modifier-border);
    color: var(--text-normal);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8em;
    white-space: nowrap;
}

.og-steam-screenshots {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.og-steam-screenshots::-webkit-scrollbar {
    height: 4px;
}

.og-steam-screenshots::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: 4px;
}

.og-steam-screenshot {
    height: 70px !important;
    width: auto !important;
    border-radius: 4px;
    object-fit: cover;
    margin: 0 !important;
}
`;

export function getCookie(url) {
    return 'wants_mature_content=1;path=/;lastagecheckage=1-January-1948;birthtime=-694317599';
}

export function processContent(url, htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const blocks = [];

    const rating = extractRating(doc);
    if (rating) {
        blocks.push({
            className: 'og-steam-rating',
            htmlContent: `<span class="${rating.className}">${rating.textContent}</span>`
        });
    }

    const tags = extractTags(doc);
    if (tags.length > 0) {
        blocks.push({
            className: 'og-steam-tags',
            htmlContent: tags.map(tag => `<div class="og-steam-tag">${escapeHtml(tag)}</div>`).join('')
        });
    }

    const screenshots = extractScreenshots(doc, url);
    if (screenshots.length > 0) {
        blocks.push({
            className: 'og-steam-screenshots',
            htmlContent: screenshots.map(src => `<img src="${escapeHtml(src)}" class="og-steam-screenshot" />`).join('')
        });
    }

    return blocks;
}

function extractRating(doc) {
    const positiveVoteText = doc.querySelector('label[for="review_type_positive"] .user_reviews_count');
    const negativeVoteText = doc.querySelector('label[for="review_type_negative"] .user_reviews_count');
    if (!positiveVoteText || !negativeVoteText) {
        return null;
    }

    const posVotesText = (positiveVoteText.textContent || '').replace(/[(.,\s)]/g, '') || '0';
    const negVotesText = (negativeVoteText.textContent || '').replace(/[(.,\s)]/g, '') || '0';

    const positiveVotes = Number.parseInt(posVotesText, 10);
    const negativeVotes = Number.parseInt(negVotesText, 10);
    const totalVotes = positiveVotes + negativeVotes;
    if (totalVotes === 0) {
        return null;
    }

    const average = positiveVotes / totalVotes;
    const score = average - (average - 0.5) * (2 ** -Math.log10(totalVotes + 1));

    let ratingClass = 'og-steam-rating-white';
    if (totalVotes < 500) {
        ratingClass = 'og-steam-rating-white';
    } else if (score > 0.74) {
        ratingClass = 'og-steam-rating-good';
    } else if (score > 0.49) {
        ratingClass = 'og-steam-rating-average';
    } else {
        ratingClass = 'og-steam-rating-poor';
    }

    return {
        className: ratingClass,
        textContent: `${(score * 100).toFixed(2)}%`
    };
}

function extractTags(doc) {
    const tagNodes = doc.querySelectorAll('.popular_tags a');
    return Array.from(tagNodes)
        .map(node => (node.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 5);
}

function extractScreenshots(doc, baseUrl) {
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

        return parsedData.screenshots
            .map(item => item && item.thumbnail)
            .filter(Boolean)
            .map(src => normalizeUrl(src, baseUrl));
    } catch {
        return [];
    }
}

function normalizeUrl(url, baseUrl) {
    try {
        return new URL(url, baseUrl).href;
    } catch {
        return url;
    }
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}