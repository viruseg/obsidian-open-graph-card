import {
  escapeHTML,
  extractCardId,
  extractUrl,
  extractUserText,
  isVerticalCard,
  getImageSourcesFromCard,
  getImageDataUrlsFromCard,
  replaceImageInCard
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

  // Тесты с реальными card-id (формат og_{timestamp}_{random})
  describe('with real card-id format (og_{timestamp}_{random})', () => {
    // Карточка Dota 2
    const dotaCardHtml = '<div class="og-card" card-id="og_1773609380817_523se3gh"><img src="Attachments/og-image-1773609380724.jpg" class="og-image" alt="" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/capsule_616x353.jpg?t=1769535998" /><div class="og-content"><div class="og-title">Dota 2</div><div class="og-rating"><span class="steamdb_rating_good">80.74%</span></div><div class="og-description">Ежедневно миллионы игроков по всему миру сражаются от лица одного из более сотни героев Dota 2, и даже после тысячи часов в ней есть чему научиться. Благодаря регулярным обновлениям игра живёт своей жизнью: геймплей, возможности и герои постоянно преображаются.</div><div class="og-tags"><div class="og-tag">Бесплатная игра</div><div class="og-tag">MOBA</div><div class="og-tag">Для нескольких игроков</div><div class="og-tag">Стратегия</div><div class="og-tag">Киберспорт</div></div><div class="og-screenshots"><img src="Attachments/screenshot-0-1773609380741.jpg" class="og-screenshot" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/ss_ad8eee787704745ccdecdfde3a5cd2733704898d.116x65.jpg?t=1769535998" /></div><div class="og-url"><a href="https://store.steampowered.com/app/570/Dota_2/">https://store.steampowered.com/app/570/Dota_2/</a></div></div><!--og-card-end og_1773609380817_523se3gh--></div>';

    // Карточка Counter-Strike 2
    const csCardHtml = '<div class="og-card" card-id="og_1773609653075_9cmzevsw"><img src="Attachments/og-image-1773609652937.jpg" class="og-image" alt="" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/capsule_616x353.jpg?t=1749053861" /><div class="og-content"><div class="og-title">Counter-Strike 2</div><div class="og-rating"><span class="steamdb_rating_good">86.01%</span></div><div class="og-description">Более двух десятилетий Counter-Strike служит примером первоклассной соревновательной игры, путь развития которой определяют миллионы игроков со всего мира. Теперь пришло время нового этапа — Counter-Strike 2.</div><div class="og-tags"><div class="og-tag">Шутер от первого лица</div><div class="og-tag">Шутер</div><div class="og-tag">Для нескольких игроков</div><div class="og-tag">Соревновательная</div><div class="og-tag">Экшен</div></div><div class="og-screenshots"><img src="Attachments/screenshot-0-1773609652956.jpg" class="og-screenshot" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/ss_796601d9d67faf53486eeb26d0724347cea67ddc.116x65.jpg?t=1749053861" /></div><div class="og-url"><a href="https://store.steampowered.com/app/730/CounterStrike_2?snr=1_7_15__79">https://store.steampowered.com/app/730/CounterStrike_2?snr=1_7_15__79</a></div></div><!--og-card-end og_1773609653075_9cmzevsw--></div>';

    it('should extract real card-id with og_ prefix, timestamp and random suffix', () => {
      expect(extractCardId(dotaCardHtml)).toBe('og_1773609380817_523se3gh');
      expect(extractCardId(csCardHtml)).toBe('og_1773609653075_9cmzevsw');
    });

    it('should extract card-id containing letters and underscores', () => {
      const html = '<div class="og-card" card-id="og_1773609380817_abc123xyz">content</div>';
      expect(extractCardId(html)).toBe('og_1773609380817_abc123xyz');
    });

    it('should extract card-id from card with vertical class', () => {
      const html = '<div class="og-card og-card-vertical" card-id="og_1234567890123_abcdefgh">content</div>';
      expect(extractCardId(html)).toBe('og_1234567890123_abcdefgh');
    });

    it('should extract first card-id when multiple cards in HTML', () => {
      const multiCardHtml = dotaCardHtml + '\n' + csCardHtml;
      expect(extractCardId(multiCardHtml)).toBe('og_1773609380817_523se3gh');
    });

    it('should extract card-id from complex real card HTML', () => {
      // Проверяем, что card-id извлекается из полной HTML карточки
      const result = extractCardId(dotaCardHtml);
      expect(result).not.toBeNull();
      expect(result).toMatch(/^og_\d+_[a-z0-9]+$/);
    });
  });
});

describe('extractUrl', () => {
  it('should extract URL from card HTML', () => {
    const html = '<div class="og-url"><a href="https://example.com">link</a></div>';
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
    const html = '<div class="og-url"><a href="https://example.com/path/to/page?query=value">link</a></div>';
    expect(extractUrl(html)).toBe('https://example.com/path/to/page?query=value');
  });
});

describe('extractUserText', () => {
  it('should extract user text from card', () => {
    const html = '<div class="og-user-text">My custom text</div><!--og-user-text-end-->';
    expect(extractUserText(html)).toBe('My custom text');
  });

  it('should return empty string if no user text found', () => {
    const html = '<div class="og-card">content</div>';
    expect(extractUserText(html)).toBe('');
  });

  it('should return empty string for empty input', () => {
    expect(extractUserText('')).toBe('');
  });

  it('should handle multiline text', () => {
    const html = '<div class="og-user-text">Line 1\nLine 2\nLine 3</div><!--og-user-text-end-->';
    expect(extractUserText(html)).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should trim whitespace', () => {
    const html = '<div class="og-user-text">  trimmed text  </div><!--og-user-text-end-->';
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

  it('should only extract og-image and og-screenshot classes', () => {
    const html = '<div><img class="other" src="other.png"><img class="og-image" src="og.png"></div>';
    const sources = getImageSourcesFromCard(html);
    expect(sources).toEqual(['og.png']);
  });

  it('should extract URLs with complex paths', () => {
    const html = '<img class="og-image" src="https://example.com/path/to/image.png?query=value">';
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
    const html = '<div><img class="og-image" src="img1.png" /><img class="og-image" src="img2.png" /></div>';
    const newHtml = replaceImageInCard(html, 0, 'new.png', undefined);
    expect(newHtml).toContain('src="new.png"');
    expect(newHtml).toContain('src="img2.png"');
  });

  it('should add data-url when provided', () => {
    const html = '<img class="og-image" src="local.png" />';
    const newHtml = replaceImageInCard(html, 0, 'new.png', 'https://example.com/img.png');
    expect(newHtml).toContain('data-url="https://example.com/img.png"');
  });

  it('should update existing data-url', () => {
    const html = '<img class="og-image" src="local.png" data-url="https://old.com/img.png" />';
    const newHtml = replaceImageInCard(html, 0, 'new.png', 'https://new.com/img.png');
    expect(newHtml).toContain('data-url="https://new.com/img.png"');
    expect(newHtml).not.toContain('https://old.com/img.png');
  });

  it('should remove data-url when null is passed', () => {
    const html = '<img class="og-image" src="local.png" data-url="https://example.com/img.png" />';
    const newHtml = replaceImageInCard(html, 0, 'new.png', null);
    expect(newHtml).not.toContain('data-url');
  });

  it('should preserve data-url when undefined is passed', () => {
    const html = '<img class="og-image" src="local.png" data-url="https://example.com/img.png" />';
    const newHtml = replaceImageInCard(html, 0, 'new.png', undefined);
    expect(newHtml).toContain('data-url="https://example.com/img.png"');
  });

  it('should handle screenshot class', () => {
    const html = '<img class="og-screenshot" src="old.png" />';
    const newHtml = replaceImageInCard(html, 0, 'new.png', undefined);
    expect(newHtml).toContain('src="new.png"');
  });

  it('should return original HTML if index out of bounds', () => {
    const html = '<img class="og-image" src="img.png" />';
    const newHtml = replaceImageInCard(html, 5, 'new.png', undefined);
    expect(newHtml).toBe(html);
  });
});
