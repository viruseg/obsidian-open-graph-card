/**
 * Тесты для утилит работы с HTML через DOMParser
 */

import {
    escapeHTML,
    extractCardId,
    extractUrl,
    extractUserText,
    isVerticalCard,
    getImageSourcesFromCard,
    getImageDataUrlsFromCard,
    replaceImageInCard,
    parseCardHtml,
    serializeCard,
    extractTitle,
    extractDescription,
    extractTags,
    toggleCardOrientation,
    replaceCardId,
    findAllCards
} from '../../src/utils/html';

describe('escapeHTML', () => {
    it('should escape special characters', () => {
        expect(escapeHTML('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
    });

    it('should escape ampersand', () => {
        expect(escapeHTML('test & test')).toBe('test &amp; test');
    });

    it('should escape quotes', () => {
        expect(escapeHTML('"test"')).toBe('&quot;test&quot;');
    });

    it('should escape single quotes', () => {
        expect(escapeHTML("'test'")).toBe('&#39;test&#39;');
    });

    it('should return empty string for empty input', () => {
        expect(escapeHTML('')).toBe('');
    });

    it('should handle string without special characters', () => {
        expect(escapeHTML('hello world')).toBe('hello world');
    });

    it('should escape all special characters in one string', () => {
        expect(escapeHTML('<div class="test" data-value=\'1\'>&</div>')).toBe(
            '&lt;div class=&quot;test&quot; data-value=&#39;1&#39;&gt;&amp;&lt;/div&gt;'
        );
    });
});

describe('parseCardHtml', () => {
    it('should parse valid card HTML', () => {
        const html = '<div class="og-card" card-id="test123">content</div>';
        const result = parseCardHtml(html);

        expect(result).not.toBeNull();
        expect(result!.card).toBeInstanceOf(HTMLElement);
        expect(result!.doc).toBeInstanceOf(Document);
    });

    it('should return null for invalid HTML', () => {
        expect(parseCardHtml('not a card')).toBeNull();
    });

    it('should return null for empty string', () => {
        expect(parseCardHtml('')).toBeNull();
    });

    it('should return null for HTML without og-card class', () => {
        const html = '<div class="other-class">content</div>';
        expect(parseCardHtml(html)).toBeNull();
    });

    it('should parse card with nested elements', () => {
        const html = '<div class="og-card" card-id="123"><div class="og-content"><div class="og-title">Title</div></div></div>';
        const result = parseCardHtml(html);

        expect(result).not.toBeNull();
        expect(result!.card.querySelector('.og-title')?.textContent).toBe('Title');
    });
});

describe('serializeCard', () => {
    it('should serialize card element back to HTML string', () => {
        const html = '<div class="og-card" card-id="test123">content</div>';
        const parsed = parseCardHtml(html);

        expect(parsed).not.toBeNull();
        const serialized = serializeCard(parsed!.card);
        expect(serialized).toContain('og-card');
        expect(serialized).toContain('test123');
    });
});

describe('extractCardId', () => {
    it('should extract card-id from HTML', () => {
        const html = '<div class="og-card" card-id="123456789">content</div>';
        expect(extractCardId(html)).toBe('123456789');
    });

    it('should extract card-id with additional classes', () => {
        const html = '<div class="og-card og-card-vertical" card-id="987654321">content</div>';
        expect(extractCardId(html)).toBe('987654321');
    });

    it('should return null if no card-id found', () => {
        const html = '<div class="og-card">content</div>';
        expect(extractCardId(html)).toBeNull();
    });

    it('should return null for empty string', () => {
        expect(extractCardId('')).toBeNull();
    });

    it('should return null for non-matching HTML', () => {
        const html = '<div class="other-class">content</div>';
        expect(extractCardId(html)).toBeNull();
    });

    describe('with real card-id format (og_{timestamp}_{random})', () => {
        const dotaCardHtml = '<div class="og-card" card-id="og_1773609380817_523se3gh"><img src="Attachments/og-image.jpg" class="og-image" alt="" data-url="https://example.com/image.jpg" /><div class="og-content"><div class="og-title">Dota 2</div><div class="og-url"><a href="https://store.steampowered.com/app/570/Dota_2/">https://store.steampowered.com/app/570/Dota_2/</a></div></div><!--og-card-end og_1773609380817_523se3gh--></div>';

        it('should extract real card-id with og_ prefix, timestamp and random suffix', () => {
            expect(extractCardId(dotaCardHtml)).toBe('og_1773609380817_523se3gh');
        });

        it('should extract card-id containing letters and underscores', () => {
            const html = '<div class="og-card" card-id="og_1773609380817_abc123xyz">content</div>';
            expect(extractCardId(html)).toBe('og_1773609380817_abc123xyz');
        });

        it('should extract card-id from card with vertical class', () => {
            const html = '<div class="og-card og-card-vertical" card-id="og_1234567890123_abcdefgh">content</div>';
            expect(extractCardId(html)).toBe('og_1234567890123_abcdefgh');
        });
    });
});

describe('extractUrl', () => {
    it('should extract URL from card HTML', () => {
        const html = '<div class="og-card"><div class="og-url"><a href="https://example.com">link</a></div></div>';
        expect(extractUrl(html)).toBe('https://example.com');
    });

    it('should return null if no URL found', () => {
        const html = '<div class="og-card">content</div>';
        expect(extractUrl(html)).toBeNull();
    });

    it('should return null for empty string', () => {
        expect(extractUrl('')).toBeNull();
    });

    it('should extract URL with complex path', () => {
        const html = '<div class="og-card"><div class="og-url"><a href="https://example.com/path/to/page?query=value">link</a></div></div>';
        expect(extractUrl(html)).toBe('https://example.com/path/to/page?query=value');
    });
});

describe('extractUserText', () => {
    it('should extract user text from card', () => {
        const html = '<div class="og-card"><div class="og-user-text">My custom text</div></div>';
        expect(extractUserText(html)).toBe('My custom text');
    });

    it('should return empty string if no user text found', () => {
        const html = '<div class="og-card">content</div>';
        expect(extractUserText(html)).toBe('');
    });

    it('should return empty string for empty input', () => {
        expect(extractUserText('')).toBe('');
    });

    it('should handle multiline text with br tags', () => {
        const html = '<div class="og-card"><div class="og-user-text">Line 1<br>Line 2<br>Line 3</div></div>';
        expect(extractUserText(html)).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle multiline text with br self-closing tags', () => {
        const html = '<div class="og-card"><div class="og-user-text">Line 1<br/>Line 2<br/>Line 3</div></div>';
        expect(extractUserText(html)).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should trim whitespace', () => {
        const html = '<div class="og-card"><div class="og-user-text">  trimmed text  </div></div>';
        expect(extractUserText(html)).toBe('trimmed text');
    });
});

describe('isVerticalCard', () => {
    it('should return true for vertical card', () => {
        const html = '<div class="og-card og-card-vertical">content</div>';
        expect(isVerticalCard(html)).toBe(true);
    });

    it('should return false for horizontal card', () => {
        const html = '<div class="og-card">content</div>';
        expect(isVerticalCard(html)).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(isVerticalCard('')).toBe(false);
    });
});

describe('getImageSourcesFromCard', () => {
    it('should extract all image src attributes', () => {
        const html = '<div class="og-card"><img class="og-image" src="image1.png"><img class="og-screenshot" src="image2.png"></div>';
        const sources = getImageSourcesFromCard(html);
        expect(sources).toContain('image1.png');
        expect(sources).toContain('image2.png');
        expect(sources.length).toBe(2);
    });

    it('should return empty array if no images', () => {
        const html = '<div class="og-card">no images</div>';
        expect(getImageSourcesFromCard(html)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
        expect(getImageSourcesFromCard('')).toEqual([]);
    });

    it('should extract all images regardless of class', () => {
        const html = '<div class="og-card"><img class="other" src="other.png"><img class="og-image" src="og.png"></div>';
        const sources = getImageSourcesFromCard(html);
        expect(sources).toEqual(['other.png', 'og.png']);
    });

    it('should extract URLs with complex paths', () => {
        const html = '<div class="og-card"><img class="og-image" src="https://example.com/path/to/image.png?query=value"></div>';
        const sources = getImageSourcesFromCard(html);
        expect(sources).toEqual(['https://example.com/path/to/image.png?query=value']);
    });
});

describe('getImageDataUrlsFromCard', () => {
    it('should extract image data-url info', () => {
        const html = '<div class="og-card"><img class="og-image" src="local.png" data-url="https://example.com/img.png"></div>';
        const info = getImageDataUrlsFromCard(html);
        expect(info.length).toBe(1);
        expect(info[0].src).toBe('local.png');
        expect(info[0].dataUrl).toBe('https://example.com/img.png');
        expect(info[0].elementIndex).toBe(0);
    });

    it('should return null for dataUrl if not present', () => {
        const html = '<div class="og-card"><img class="og-image" src="local.png"></div>';
        const info = getImageDataUrlsFromCard(html);
        expect(info.length).toBe(1);
        expect(info[0].dataUrl).toBeNull();
    });

    it('should return empty array for no images', () => {
        const html = '<div class="og-card">no images</div>';
        expect(getImageDataUrlsFromCard(html)).toEqual([]);
    });

    it('should track element index correctly', () => {
        const html = `<div class="og-card">
            <img class="og-image" src="img1.png">
            <img class="og-screenshot" src="img2.png">
            <img class="og-image" src="img3.png">
        </div>`;
        const info = getImageDataUrlsFromCard(html);
        expect(info.length).toBe(3);
        expect(info[0].elementIndex).toBe(0);
        expect(info[1].elementIndex).toBe(1);
        expect(info[2].elementIndex).toBe(2);
    });
});

describe('replaceImageInCard', () => {
    it('should replace image src by index', () => {
        const html = '<div class="og-card"><img class="og-image" src="old.png" /></div>';
        const newHtml = replaceImageInCard(html, 0, 'new.png', undefined);
        expect(newHtml).toContain('src="new.png"');
        expect(newHtml).not.toContain('old.png');
    });

    it('should not modify other images', () => {
        const html = '<div class="og-card"><img class="og-image" src="img1.png" /><img class="og-image" src="img2.png" /></div>';
        const newHtml = replaceImageInCard(html, 0, 'new.png', undefined);
        expect(newHtml).toContain('src="new.png"');
        expect(newHtml).toContain('src="img2.png"');
    });

    it('should add data-url when provided', () => {
        const html = '<div class="og-card"><img class="og-image" src="local.png" /></div>';
        const newHtml = replaceImageInCard(html, 0, 'new.png', 'https://example.com/img.png');
        expect(newHtml).toContain('data-url="https://example.com/img.png"');
    });

    it('should update existing data-url', () => {
        const html = '<div class="og-card"><img class="og-image" src="local.png" data-url="https://old.com/img.png" /></div>';
        const newHtml = replaceImageInCard(html, 0, 'new.png', 'https://new.com/img.png');
        expect(newHtml).toContain('data-url="https://new.com/img.png"');
        expect(newHtml).not.toContain('https://old.com/img.png');
    });

    it('should remove data-url when null is passed', () => {
        const html = '<div class="og-card"><img class="og-image" src="local.png" data-url="https://example.com/img.png" /></div>';
        const newHtml = replaceImageInCard(html, 0, 'new.png', null);
        expect(newHtml).not.toContain('data-url');
    });

    it('should preserve data-url when undefined is passed', () => {
        const html = '<div class="og-card"><img class="og-image" src="local.png" data-url="https://example.com/img.png" /></div>';
        const newHtml = replaceImageInCard(html, 0, 'new.png', undefined);
        expect(newHtml).toContain('data-url="https://example.com/img.png"');
    });

    it('should handle screenshot class', () => {
        const html = '<div class="og-card"><img class="og-screenshot" src="old.png" /></div>';
        const newHtml = replaceImageInCard(html, 0, 'new.png', undefined);
        expect(newHtml).toContain('src="new.png"');
    });

    it('should return original HTML if index out of bounds', () => {
        const html = '<div class="og-card"><img class="og-image" src="img.png" /></div>';
        const newHtml = replaceImageInCard(html, 5, 'new.png', undefined);
        expect(newHtml).toBe(html);
    });
});

describe('extractTitle', () => {
    it('should extract title from card', () => {
        const html = '<div class="og-card"><div class="og-content"><div class="og-title">Test Title</div></div></div>';
        expect(extractTitle(html)).toBe('Test Title');
    });

    it('should return empty string for card without title', () => {
        const html = '<div class="og-card">no title</div>';
        expect(extractTitle(html)).toBe('');
    });
});

describe('extractDescription', () => {
    it('should extract description from card', () => {
        const html = '<div class="og-card"><div class="og-content"><div class="og-description">Test description</div></div></div>';
        expect(extractDescription(html)).toBe('Test description');
    });

    it('should return empty string for card without description', () => {
        const html = '<div class="og-card">no description</div>';
        expect(extractDescription(html)).toBe('');
    });
});

describe('extractTags', () => {
    it('should extract all tags from card', () => {
        const html = '<div class="og-card"><div class="og-tags"><div class="og-tag">Tag1</div><div class="og-tag">Tag2</div></div></div>';
        const tags = extractTags(html);
        expect(tags).toEqual(['Tag1', 'Tag2']);
    });

    it('should return empty array for card without tags', () => {
        const html = '<div class="og-card">no tags</div>';
        expect(extractTags(html)).toEqual([]);
    });
});

describe('toggleCardOrientation', () => {
    it('should add vertical class to horizontal card', () => {
        const html = '<div class="og-card" card-id="test">content</div>';
        const result = toggleCardOrientation(html);
        expect(result).toContain('og-card-vertical');
    });

    it('should remove vertical class from vertical card', () => {
        const html = '<div class="og-card og-card-vertical" card-id="test">content</div>';
        const result = toggleCardOrientation(html);
        expect(result).not.toContain('og-card-vertical');
    });

    it('should toggle back and forth', () => {
        const html = '<div class="og-card" card-id="test">content</div>';
        const toggled1 = toggleCardOrientation(html);
        expect(toggled1).toContain('og-card-vertical');

        const toggled2 = toggleCardOrientation(toggled1);
        expect(toggled2).not.toContain('og-card-vertical');
    });
});

describe('replaceCardId', () => {
    it('should replace card-id in attribute', () => {
        const html = '<div class="og-card" card-id="old-id">content</div>';
        const result = replaceCardId(html, 'new-id');
        expect(extractCardId(result)).toBe('new-id');
    });

    it('should replace card-id in end marker comment', () => {
        const html = '<div class="og-card" card-id="old-id">content<!--og-card-end old-id--></div>';
        const result = replaceCardId(html, 'new-id');
        expect(result).toContain('<!--og-card-end new-id-->');
    });
});

describe('findAllCards', () => {
    it('should find all cards in content', () => {
        const content = `
Some text
<div class="og-card" card-id="card1">content1<!--og-card-end card1--></div>
More text
<div class="og-card" card-id="card2">content2<!--og-card-end card2--></div>
`;
        const cards = findAllCards(content);
        expect(cards.length).toBe(2);
        expect(cards[0].cardId).toBe('card1');
        expect(cards[1].cardId).toBe('card2');
    });

    it('should return empty array for content without cards', () => {
        const content = 'Just some text without cards';
        expect(findAllCards(content)).toEqual([]);
    });

    it('should calculate correct offsets', () => {
        const content = 'prefix<div class="og-card" card-id="test">content<!--og-card-end test--></div>suffix';
        const cards = findAllCards(content);
        expect(cards.length).toBe(1);
        expect(cards[0].startOffset).toBe(6);
        expect(cards[0].endOffset).toBe(content.indexOf('suffix'));
    });
});

describe('CARD_REGEX completeness', () => {
    it('should include closing </div> tag in found card', () => {
        const cardHtml = '<div class="og-card" card-id="og_test123"><div class="og-content">Test</div><!--og-card-end og_test123--></div>';
        const content = `Some text before\n${cardHtml}\nSome text after`;

        const cards = findAllCards(content);
        expect(cards.length).toBe(1);
        expect(cards[0].html).toBe(cardHtml);
        expect(cards[0].html.endsWith('</div>')).toBe(true);
    });

    it('should not include extra content after closing div', () => {
        const cardHtml = '<div class="og-card" card-id="test"><div class="og-content">Content</div><!--og-card-end test--></div>';
        const content = `${cardHtml}Extra text that should not be included`;

        const cards = findAllCards(content);
        expect(cards.length).toBe(1);
        expect(cards[0].html).toBe(cardHtml);
        expect(cards[0].html).not.toContain('Extra text');
    });

    it('should not include content before card start', () => {
        const cardHtml = '<div class="og-card" card-id="test"><div class="og-content">Content</div><!--og-card-end test--></div>';
        const content = `Text before card that should not be included${cardHtml}`;

        const cards = findAllCards(content);
        expect(cards.length).toBe(1);
        expect(cards[0].html).toBe(cardHtml);
        expect(cards[0].html).not.toContain('Text before');
    });

    it('should find complete card with all nested elements', () => {
        const cardHtml = '<div class="og-card" card-id="og_123"><img src="image.jpg" class="og-image" alt="" data-url="https://example.com/img.jpg" /><div class="og-content"><div class="og-title">Title</div><div class="og-url"><a href="https://example.com">https://example.com</a></div><div class="og-user-text">Comment</div></div><!--og-card-end og_123--></div>';
        const content = `# Header\n\n${cardHtml}\n\n## Footer`;

        const cards = findAllCards(content);
        expect(cards.length).toBe(1);
        expect(cards[0].html).toBe(cardHtml);

        expect(cards[0].html).toContain('<img');
        expect(cards[0].html).toContain('og-title');
        expect(cards[0].html).toContain('og-url');
        expect(cards[0].html).toContain('og-user-text');
        expect(cards[0].html).toContain('<!--og-card-end og_123-->');
        expect(cards[0].html.endsWith('</div>')).toBe(true);
    });

    it('should handle multiple cards with correct boundaries', () => {
        const card1 = '<div class="og-card" card-id="card1">Content1<!--og-card-end card1--></div>';
        const card2 = '<div class="og-card" card-id="card2">Content2<!--og-card-end card2--></div>';
        const content = `Start\n${card1}\nMiddle\n${card2}\nEnd`;

        const cards = findAllCards(content);
        expect(cards.length).toBe(2);
        expect(cards[0].html).toBe(card1);
        expect(cards[1].html).toBe(card2);
        expect(cards[0].html).not.toContain('Middle');
        expect(cards[1].html).not.toContain('Middle');
    });

    it('should correctly extract card from real note context', () => {
        const noteContent = `# My Games

Some intro text.

<div class="og-card" card-id="og_1773826622296_yi81ntbw"><img src="Attachments/og-image.jpg" class="og-image" alt="" data-url="https://example.com/image.jpg" /><div class="og-content"><div class="og-title">Game Title</div><div class="og-url"><a href="https://store.steampowered.com/app/123/">https://store.steampowered.com/app/123/</a></div></div><!--og-card-end og_1773826622296_yi81ntbw--></div>

## Notes

- Item 1
- Item 2`;

        const cards = findAllCards(noteContent);
        expect(cards.length).toBe(1);

        const foundCard = cards[0].html;

        expect(foundCard.startsWith('<div class="og-card"')).toBe(true);
        expect(foundCard.endsWith('</div>')).toBe(true);
        expect(foundCard).toContain('<!--og-card-end og_1773826622296_yi81ntbw-->');
        expect(foundCard).not.toContain('## Notes');
        expect(foundCard).not.toContain('Item 1');
        expect(foundCard).not.toContain('My Games');

        const parsed = parseCardHtml(foundCard);
        expect(parsed).not.toBeNull();
        expect(extractCardId(foundCard)).toBe('og_1773826622296_yi81ntbw');
        expect(extractTitle(foundCard)).toBe('Game Title');
    });
});

describe('DOMParser consistency', () => {
    const fullCardHtml = '<div class="og-card" card-id="og_test123"><img src="image.jpg" class="og-image" alt="" data-url="https://example.com/img.jpg" /><div class="og-content"><div class="og-title">Test Game</div><div class="og-description">Description text</div><div class="og-tags"><div class="og-tag">Tag1</div><div class="og-tag">Tag2</div></div><div class="og-url"><a href="https://example.com">https://example.com</a></div><div class="og-user-text">User comment</div></div><!--og-card-end og_test123--></div>';

    it('should extract all data consistently through DOMParser', () => {
        expect(extractCardId(fullCardHtml)).toBe('og_test123');
        expect(extractTitle(fullCardHtml)).toBe('Test Game');
        expect(extractDescription(fullCardHtml)).toBe('Description text');
        expect(extractUrl(fullCardHtml)).toBe('https://example.com');
        expect(extractUserText(fullCardHtml)).toBe('User comment');
        expect(extractTags(fullCardHtml)).toEqual(['Tag1', 'Tag2']);
        expect(getImageSourcesFromCard(fullCardHtml)).toEqual(['image.jpg']);
        expect(isVerticalCard(fullCardHtml)).toBe(false);
    });

    it('should maintain card-id through modifications', () => {
        const originalId = extractCardId(fullCardHtml);

        let modified = toggleCardOrientation(fullCardHtml);
        expect(extractCardId(modified)).toBe(originalId);

        modified = replaceImageInCard(fullCardHtml, 0, 'new.jpg', undefined);
        expect(extractCardId(modified)).toBe(originalId);
    });
});
