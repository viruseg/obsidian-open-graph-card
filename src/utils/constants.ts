export const CSS_CLASSES = {
    CARD: 'og-card',
    CARD_VERTICAL: 'og-card-vertical',
    IMAGE: 'og-image',
    CONTENT: 'og-content',
    TITLE: 'og-title',
    DESCRIPTION: 'og-description',
    TAGS: 'og-tags',
    TAG: 'og-tag',
    SCREENSHOTS: 'og-screenshots',
    SCREENSHOT: 'og-screenshot',
    URL: 'og-url',
    USER_TEXT: 'og-user-text',
    RATING: 'og-rating'
} as const;

export const STEAM_RATING_CLASSES = {
    GOOD: 'steamdb_rating_good',
    AVERAGE: 'steamdb_rating_average',
    POOR: 'steamdb_rating_poor',
    WHITE: 'steamdb_rating_white'
} as const;

export const CARD_BOUNDS = {
    LOOK_UP_LINES: 100,
    LOOK_DOWN_LINES: 10,
    LOOK_FORWARD_LINES: 200
} as const;
