export const CSS_CLASSES = {
    CARD: 'og-card',
    CARD_VERTICAL: 'og-card-vertical',
    IMAGE: 'og-image',
    CONTENT: 'og-content',
    TITLE: 'og-title',
    DESCRIPTION: 'og-description',
    URL: 'og-url',
    USER_TEXT: 'og-user-text'
} as const;

export const CARD_BOUNDS = {
    LOOK_UP_LINES: 10,
    LOOK_DOWN_LINES: 10,
    LOOK_FORWARD_LINES: 20
} as const;

export const CARD_REGEX = /<div[^>]*class="[^"]*og-card[^"]*"[^>]*>[\s\S]*?<!--og-card-end[^>]*--><\/div>/g;
