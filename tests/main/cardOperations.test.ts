/**
 * Тесты для операций с HTML карточки
 *
 * Эти тесты проверяют парсинг и манипуляции с HTML кодом карточек,
 * включая извлечение card-id, URL, пользовательского текста и т.д.
 */

import {
  extractCardId,
  extractUrl,
  extractUserText,
  isVerticalCard,
  getImageSourcesFromCard,
  getImageDataUrlsFromCard,
  replaceImageInCard
} from '../../src/utils/html';

// Реальные примеры HTML карточек из задачи
const DOTA_CARD_HTML = '<div class="og-card" card-id="og_1773609380817_523se3gh"><img src="Attachments/og-image-1773609380724.jpg" class="og-image" alt="" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/capsule_616x353.jpg?t=1769535998" /><div class="og-content"><div class="og-title">Dota 2</div><div class="og-rating"><span class="steamdb_rating_good">80.74%</span></div><div class="og-description">Ежедневно миллионы игроков по всему миру сражаются от лица одного из более сотни героев Dota 2, и даже после тысячи часов в ней есть чему научиться. Благодаря регулярным обновлениям игра живёт своей жизнью: геймплей, возможности и герои постоянно преображаются.</div><div class="og-tags"><div class="og-tag">Бесплатная игра</div><div class="og-tag">MOBA</div><div class="og-tag">Для нескольких игроков</div><div class="og-tag">Стратегия</div><div class="og-tag">Киберспорт</div></div><div class="og-screenshots"><img src="Attachments/screenshot-0-1773609380741.jpg" class="og-screenshot" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/ss_ad8eee787704745ccdecdfde3a5cd2733704898d.116x65.jpg?t=1769535998" /></div><div class="og-url"><a href="https://store.steampowered.com/app/570/Dota_2/">https://store.steampowered.com/app/570/Dota_2/</a></div></div><!--og-card-end og_1773609380817_523se3gh--></div>';

const CS_CARD_HTML = '<div class="og-card" card-id="og_1773609653075_9cmzevsw"><img src="Attachments/og-image-1773609652937.jpg" class="og-image" alt="" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/capsule_616x353.jpg?t=1749053861" /><div class="og-content"><div class="og-title">Counter-Strike 2</div><div class="og-rating"><span class="steamdb_rating_good">86.01%</span></div><div class="og-description">Более двух десятилетий Counter-Strike служит примером первоклассной соревновательной игры, путь развития которой определяют миллионы игроков со всего мира. Теперь пришло время нового этапа — Counter-Strike 2.</div><div class="og-tags"><div class="og-tag">Шутер от первого лица</div><div class="og-tag">Шутер</div><div class="og-tag">Для нескольких игроков</div><div class="og-tag">Соревновательная</div><div class="og-tag">Экшен</div></div><div class="og-screenshots"><img src="Attachments/screenshot-0-1773609652956.jpg" class="og-screenshot" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/ss_796601d9d67faf53486eeb26d0724347cea67ddc.116x65.jpg?t=1749053861" /></div><div class="og-url"><a href="https://store.steampowered.com/app/730/CounterStrike_2?snr=1_7_15__79">https://store.steampowered.com/app/730/CounterStrike_2?snr=1_7_15__79</a></div></div><!--og-card-end og_1773609653075_9cmzevsw--></div>';

// Карточка с пользовательским текстом
const CARD_WITH_USER_TEXT = '<div class="og-card" card-id="og_1234567890123_abcdefgh"><img src="image.jpg" class="og-image" /><div class="og-content"><div class="og-title">Test Game</div><div class="og-url"><a href="https://example.com">https://example.com</a></div></div><div class="og-user-text">Мой комментарий к игре</div><!--og-user-text-end--></div><!--og-card-end og_1234567890123_abcdefgh--></div>';

// Вертикальная карточка
const VERTICAL_CARD_HTML = '<div class="og-card og-card-vertical" card-id="og_9999999999999_vertical"><img src="image.jpg" class="og-image" /><div class="og-content"><div class="og-title">Vertical Card</div><div class="og-url"><a href="https://example.com">https://example.com</a></div></div><!--og-card-end og_9999999999999_vertical--></div>';

describe('Операции с HTML карточки', () => {
  describe('Извлечение card-id', () => {
    it('должен извлекать card-id из карточки Dota 2', () => {
      const cardId = extractCardId(DOTA_CARD_HTML);
      expect(cardId).toBe('og_1773609380817_523se3gh');
    });

    it('должен извлекать card-id из карточки Counter-Strike 2', () => {
      const cardId = extractCardId(CS_CARD_HTML);
      expect(cardId).toBe('og_1773609653075_9cmzevsw');
    });

    it('должен извлекать card-id из вертикальной карточки', () => {
      const cardId = extractCardId(VERTICAL_CARD_HTML);
      expect(cardId).toBe('og_9999999999999_vertical');
    });

    it('card-id должен соответствовать формату og_{timestamp}_{random}', () => {
      const cardId = extractCardId(DOTA_CARD_HTML);
      expect(cardId).toMatch(/^og_\d+_[a-z0-9]+$/);
    });

    it('должен возвращать null для HTML без card-id', () => {
      const html = '<div class="og-card">no card-id</div>';
      expect(extractCardId(html)).toBeNull();
    });
  });

  describe('Извлечение URL', () => {
    it('должен извлекать URL из карточки Dota 2', () => {
      const url = extractUrl(DOTA_CARD_HTML);
      expect(url).toBe('https://store.steampowered.com/app/570/Dota_2/');
    });

    it('должен извлекать URL из карточки Counter-Strike 2', () => {
      const url = extractUrl(CS_CARD_HTML);
      expect(url).toBe('https://store.steampowered.com/app/730/CounterStrike_2?snr=1_7_15__79');
    });

    it('должен извлекать URL с параметрами запроса', () => {
      const url = extractUrl(CS_CARD_HTML);
      expect(url).toContain('?snr=');
    });

    it('должен возвращать null для HTML без URL', () => {
      const html = '<div class="og-card">no url</div>';
      expect(extractUrl(html)).toBeNull();
    });
  });

  describe('Извлечение пользовательского текста', () => {
    it('должен извлекать пользовательский текст из карточки', () => {
      const userText = extractUserText(CARD_WITH_USER_TEXT);
      expect(userText).toBe('Мой комментарий к игре');
    });

    it('должен возвращать пустую строку для карточки без пользовательского текста', () => {
      const userText = extractUserText(DOTA_CARD_HTML);
      expect(userText).toBe('');
    });

    it('должен возвращать пустую строку для пустого HTML', () => {
      expect(extractUserText('')).toBe('');
    });
  });

  describe('Проверка ориентации карточки', () => {
    it('должен возвращать true для вертикальной карточки', () => {
      expect(isVerticalCard(VERTICAL_CARD_HTML)).toBe(true);
    });

    it('должен возвращать false для горизонтальной карточки', () => {
      expect(isVerticalCard(DOTA_CARD_HTML)).toBe(false);
      expect(isVerticalCard(CS_CARD_HTML)).toBe(false);
    });

    it('должен возвращать false для пустой строки', () => {
      expect(isVerticalCard('')).toBe(false);
    });
  });

  describe('Извлечение источников изображений', () => {
    it('должен извлекать все изображения из карточки Dota 2', () => {
      const sources = getImageSourcesFromCard(DOTA_CARD_HTML);
      expect(sources.length).toBe(2); // og-image + og-screenshot
      expect(sources).toContain('Attachments/og-image-1773609380724.jpg');
      expect(sources).toContain('Attachments/screenshot-0-1773609380741.jpg');
    });

    it('должен извлекать все изображения из карточки Counter-Strike 2', () => {
      const sources = getImageSourcesFromCard(CS_CARD_HTML);
      expect(sources.length).toBe(2);
      expect(sources).toContain('Attachments/og-image-1773609652937.jpg');
      expect(sources).toContain('Attachments/screenshot-0-1773609652956.jpg');
    });

    it('должен возвращать пустой массив для HTML без изображений', () => {
      const html = '<div class="og-card">no images</div>';
      expect(getImageSourcesFromCard(html)).toEqual([]);
    });
  });

  describe('Извлечение data-url из изображений', () => {
    it('должен извлекать data-url из изображений карточки Dota 2', () => {
      const info = getImageDataUrlsFromCard(DOTA_CARD_HTML);
      expect(info.length).toBe(2);

      // Проверяем основное изображение
      expect(info[0].src).toBe('Attachments/og-image-1773609380724.jpg');
      expect(info[0].dataUrl).toBe('https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/capsule_616x353.jpg?t=1769535998');

      // Проверяем скриншот
      expect(info[1].src).toBe('Attachments/screenshot-0-1773609380741.jpg');
      expect(info[1].dataUrl).toContain('steam/apps/570/ss_');
    });

    it('должен извлекать data-url из изображений карточки Counter-Strike 2', () => {
      const info = getImageDataUrlsFromCard(CS_CARD_HTML);
      expect(info.length).toBe(2);

      expect(info[0].src).toBe('Attachments/og-image-1773609652937.jpg');
      expect(info[0].dataUrl).toContain('steam/apps/730/');

      expect(info[1].src).toBe('Attachments/screenshot-0-1773609652956.jpg');
      expect(info[1].dataUrl).toContain('steam/apps/730/ss_');
    });

    it('должен правильно отслеживать индексы элементов', () => {
      const info = getImageDataUrlsFromCard(DOTA_CARD_HTML);
      expect(info[0].elementIndex).toBe(0);
      expect(info[1].elementIndex).toBe(1);
    });
  });

  describe('Замена изображений в карточке', () => {
    it('должен заменять src изображения по индексу', () => {
      const newHtml = replaceImageInCard(DOTA_CARD_HTML, 0, 'new-image.jpg', undefined);
      expect(newHtml).toContain('src="new-image.jpg"');
      expect(newHtml).not.toContain('src="Attachments/og-image-1773609380724.jpg"');
    });

    it('должен сохранять data-url при undefined', () => {
      const newHtml = replaceImageInCard(DOTA_CARD_HTML, 0, 'new-image.jpg', undefined);
      expect(newHtml).toContain('data-url="https://shared.fastly.steamstatic.com');
    });

    it('должен обновлять data-url при передаче нового значения', () => {
      const newHtml = replaceImageInCard(DOTA_CARD_HTML, 0, 'new-image.jpg', 'https://new-url.com/image.jpg');
      expect(newHtml).toContain('data-url="https://new-url.com/image.jpg"');
    });

    it('должен удалять data-url при передаче null', () => {
      const newHtml = replaceImageInCard(DOTA_CARD_HTML, 0, 'new-image.jpg', null);
      // Проверяем, что data-url удалён из первого изображения (og-image)
      // Извлекаем только первое изображение из результата
      const firstImgMatch = newHtml.match(/<img[^>]*class="og-image"[^>]*>/);
      expect(firstImgMatch).not.toBeNull();
      expect(firstImgMatch![0]).not.toContain('data-url=');
    });

    it('не должен изменять другие изображения', () => {
      const newHtml = replaceImageInCard(DOTA_CARD_HTML, 0, 'new-image.jpg', undefined);
      // Второе изображение должно остаться неизменным
      expect(newHtml).toContain('src="Attachments/screenshot-0-1773609380741.jpg"');
    });
  });
});

describe('Работа с несколькими карточками', () => {
  const multiCardHtml = DOTA_CARD_HTML + '\n\n' + CS_CARD_HTML;

  describe('Извлечение card-id из нескольких карточек', () => {
    it('должен извлекать card-id первой карточки', () => {
      const cardId = extractCardId(multiCardHtml);
      expect(cardId).toBe('og_1773609380817_523se3gh');
    });

    it('разные карточки должны иметь разные card-id', () => {
      const dotaId = extractCardId(DOTA_CARD_HTML);
      const csId = extractCardId(CS_CARD_HTML);
      expect(dotaId).not.toBe(csId);
    });
  });

  describe('Извлечение URL из нескольких карточек', () => {
    it('должен извлекать URL первой карточки', () => {
      const url = extractUrl(multiCardHtml);
      expect(url).toBe('https://store.steampowered.com/app/570/Dota_2/');
    });
  });

  describe('Извлечение изображений из нескольких карточек', () => {
    it('должен извлекать все изображения из обеих карточек', () => {
      const sources = getImageSourcesFromCard(multiCardHtml);
      expect(sources.length).toBe(4); // 2 изображения из каждой карточки
    });
  });
});

describe('Регулярные выражения для card-id', () => {
  // Тесты для проверки исправленного регулярного выражения
  describe('Регулярное выражение должно захватывать полный card-id', () => {
    it('должен захватывать card-id с буквами', () => {
      const html = '<div class="og-card" card-id="og_123_abcdef">content</div>';
      expect(extractCardId(html)).toBe('og_123_abcdef');
    });

    it('должен захватывать card-id с цифрами', () => {
      const html = '<div class="og-card" card-id="og_1234567890_12345678">content</div>';
      expect(extractCardId(html)).toBe('og_1234567890_12345678');
    });

    it('должен захватывать card-id со смешанными символами', () => {
      const html = '<div class="og-card" card-id="og_1773609380817_523se3gh">content</div>';
      expect(extractCardId(html)).toBe('og_1773609380817_523se3gh');
    });

    it('должен захватывать card-id с подчёркиваниями', () => {
      const html = '<div class="og-card" card-id="og_1234567890123_abc_123_xyz">content</div>';
      expect(extractCardId(html)).toBe('og_1234567890123_abc_123_xyz');
    });

    it('не должен обрезать card-id после первой последовательности цифр', () => {
      // Этот тест проверяет, что старое регулярное выражение (\d+) не используется
      const html = '<div class="og-card" card-id="og_1773609380817_523se3gh">content</div>';
      const result = extractCardId(html);
      expect(result).not.toBe('1773609380817'); // Старое поведение
      expect(result).toBe('og_1773609380817_523se3gh'); // Новое поведение
    });
  });
});

describe('Парсинг маркеров конца карточки', () => {
  it('должен находить маркер конца карточки с card-id', () => {
    const endMarkerRegex = /<!--og-card-end og_1773609380817_523se3gh-->/;
    expect(DOTA_CARD_HTML).toMatch(endMarkerRegex);
  });

  it('должен находить маркер конца пользовательского текста', () => {
    const userTextEndRegex = /<!--og-user-text-end-->/;
    expect(CARD_WITH_USER_TEXT).toMatch(userTextEndRegex);
  });

  it('маркер конца должен содержать тот же card-id что и атрибут', () => {
    const cardId = extractCardId(DOTA_CARD_HTML);
    const endMarkerRegex = new RegExp(`<!--og-card-end ${cardId}-->`);
    expect(DOTA_CARD_HTML).toMatch(endMarkerRegex);
  });
});
