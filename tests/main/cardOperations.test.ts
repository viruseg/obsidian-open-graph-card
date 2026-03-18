/**
 * Тесты для операций с HTML карточки через DOMParser
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
    replaceImageInCard,
    extractTitle,
    extractDescription,
    extractTags,
    toggleCardOrientation,
    replaceCardId,
    findAllCards,
    parseCardHtml,
    serializeCard,
    injectCustomBlocksIntoCard
} from '../../src/utils/html';
import { TEST_NOTE_CONTENT, TEST_CARDS } from '../fixtures/testNote';

const DOTA_CARD_HTML = '<div class="og-card" card-id="og_1773609380817_523se3gh"><img src="Attachments/og-image-1773609380724.jpg" class="og-image" alt="" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/capsule_616x353.jpg?t=1769535998" /><div class="og-content"><div class="og-title">Dota 2</div><div class="og-rating"><span class="steamdb_rating_good">80.74%</span></div><div class="og-description">Ежедневно миллионы игроков по всему миру сражаются от лица одного из более сотни героев Dota 2, и даже после тысячи часов в ней есть чему научиться. Благодаря регулярным обновлениям игра живёт своей жизнью: геймплей, возможности и герои постоянно преображаются.</div><div class="og-tags"><div class="og-tag">Бесплатная игра</div><div class="og-tag">MOBA</div><div class="og-tag">Для нескольких игроков</div><div class="og-tag">Стратегия</div><div class="og-tag">Киберспорт</div></div><div class="og-screenshots"><img src="Attachments/screenshot-0-1773609380741.jpg" class="og-screenshot" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/ss_ad8eee787704745ccdecdfde3a5cd2733704898d.116x65.jpg?t=1769535998" /></div><div class="og-url"><a href="https://store.steampowered.com/app/570/Dota_2/">https://store.steampowered.com/app/570/Dota_2/</a></div></div><!--og-card-end og_1773609380817_523se3gh--></div>';

const CS_CARD_HTML = '<div class="og-card" card-id="og_1773609653075_9cmzevsw"><img src="Attachments/og-image-1773609652937.jpg" class="og-image" alt="" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/capsule_616x353.jpg?t=1749053861" /><div class="og-content"><div class="og-title">Counter-Strike 2</div><div class="og-rating"><span class="steamdb_rating_good">86.01%</span></div><div class="og-description">Более двух десятилетий Counter-Strike служит примером первоклассной соревновательной игры, путь развития которой определяют миллионы игроков со всего мира. Теперь пришло время нового этапа — Counter-Strike 2.</div><div class="og-tags"><div class="og-tag">Шутер от первого лица</div><div class="og-tag">Шутер</div><div class="og-tag">Для нескольких игроков</div><div class="og-tag">Соревновательная</div><div class="og-tag">Экшен</div></div><div class="og-screenshots"><img src="Attachments/screenshot-0-1773609652956.jpg" class="og-screenshot" data-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/ss_796601d9d67faf53486eeb26d0724347cea67ddc.116x65.jpg?t=1749053861" /></div><div class="og-url"><a href="https://store.steampowered.com/app/730/CounterStrike_2?snr=1_7_15__79">https://store.steampowered.com/app/730/CounterStrike_2?snr=1_7_15__79</a></div></div><!--og-card-end og_1773609653075_9cmzevsw--></div>';

const CARD_WITH_USER_TEXT = '<div class="og-card" card-id="og_1234567890123_abcdefgh"><img src="image.jpg" class="og-image" /><div class="og-content"><div class="og-title">Test Game</div><div class="og-url"><a href="https://example.com">https://example.com</a></div><div class="og-user-text">Мой комментарий к игре</div></div><!--og-card-end og_1234567890123_abcdefgh--></div>';

const VERTICAL_CARD_HTML = '<div class="og-card og-card-vertical" card-id="og_9999999999999_vertical"><img src="image.jpg" class="og-image" /><div class="og-content"><div class="og-title">Vertical Card</div><div class="og-url"><a href="https://example.com">https://example.com</a></div></div><!--og-card-end og_9999999999999_vertical--></div>';

describe('Операции с HTML карточки через DOMParser', () => {
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
            expect(sources.length).toBe(2);
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

            expect(info[0].src).toBe('Attachments/og-image-1773609380724.jpg');
            expect(info[0].dataUrl).toBe('https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/capsule_616x353.jpg?t=1769535998');

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
            const imageData = getImageDataUrlsFromCard(newHtml);
            expect(imageData[0].dataUrl).toBeNull();
        });

        it('не должен изменять другие изображения', () => {
            const newHtml = replaceImageInCard(DOTA_CARD_HTML, 0, 'new-image.jpg', undefined);
            expect(newHtml).toContain('src="Attachments/screenshot-0-1773609380741.jpg"');
        });
    });

    describe('Извлечение заголовка и описания', () => {
        it('должен извлекать заголовок из карточки', () => {
            expect(extractTitle(DOTA_CARD_HTML)).toBe('Dota 2');
            expect(extractTitle(CS_CARD_HTML)).toBe('Counter-Strike 2');
        });

        it('должен извлекать описание из карточки', () => {
            const desc = extractDescription(DOTA_CARD_HTML);
            expect(desc).toContain('Ежедневно миллионы игроков');
        });
    });

    describe('Извлечение тегов', () => {
        it('должен извлекать теги из карточки', () => {
            const tags = extractTags(DOTA_CARD_HTML);
            expect(tags).toContain('Бесплатная игра');
            expect(tags).toContain('MOBA');
            expect(tags).toContain('Киберспорт');
        });
    });

    describe('Переключение ориентации', () => {
        it('должен переключать карточку в вертикальный режим', () => {
            const newHtml = toggleCardOrientation(DOTA_CARD_HTML);
            expect(isVerticalCard(newHtml)).toBe(true);
        });

        it('должен переключать вертикальную карточку в горизонтальный режим', () => {
            const newHtml = toggleCardOrientation(VERTICAL_CARD_HTML);
            expect(isVerticalCard(newHtml)).toBe(false);
        });

        it('должен работать как toggle', () => {
            let html = DOTA_CARD_HTML;
            html = toggleCardOrientation(html);
            expect(isVerticalCard(html)).toBe(true);
            html = toggleCardOrientation(html);
            expect(isVerticalCard(html)).toBe(false);
        });
    });

    describe('Замена card-id', () => {
        it('должен заменять card-id в карточке', () => {
            const newCardId = 'og_new_id_123';
            const newHtml = replaceCardId(DOTA_CARD_HTML, newCardId);
            expect(extractCardId(newHtml)).toBe(newCardId);
        });

        it('должен обновлять маркер конца карточки', () => {
            const newCardId = 'og_new_id_456';
            const newHtml = replaceCardId(DOTA_CARD_HTML, newCardId);
            expect(newHtml).toContain(`<!--og-card-end ${newCardId}-->`);
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
        it('должен извлекать изображения из первой карточки при парсинге нескольких', () => {
            const sources = getImageSourcesFromCard(multiCardHtml);
            expect(sources.length).toBe(2);
        });

        it('должен извлекать изображения из каждой карточки отдельно', () => {
            const cards = findAllCards(multiCardHtml);
            let totalImages = 0;
            for (const card of cards) {
                totalImages += getImageSourcesFromCard(card.html).length;
            }
            expect(totalImages).toBe(4);
        });
    });

    describe('findAllCards', () => {
        it('должен находить все карточки в тексте', () => {
            const cards = findAllCards(multiCardHtml);
            expect(cards.length).toBe(2);
            expect(cards[0].cardId).toBe('og_1773609380817_523se3gh');
            expect(cards[1].cardId).toBe('og_1773609653075_9cmzevsw');
        });
    });
});

describe('Парсинг через DOMParser', () => {
    it('должен успешно парсить валидную карточку', () => {
        const result = parseCardHtml(DOTA_CARD_HTML);
        expect(result).not.toBeNull();
        expect(result!.card).toBeInstanceOf(HTMLElement);
    });

    it('должен возвращать null для невалидного HTML', () => {
        expect(parseCardHtml('invalid')).toBeNull();
        expect(parseCardHtml('')).toBeNull();
    });

    it('должен корректно сериализовать карточку', () => {
        const parsed = parseCardHtml(DOTA_CARD_HTML);
        expect(parsed).not.toBeNull();

        const serialized = serializeCard(parsed!.card);
        expect(serialized).toContain('og-card');
        expect(serialized).toContain('Dota 2');
    });
});

describe('Вставка пользовательских блоков', () => {
    it('должен вставлять блоки после og-title и до og-url', () => {
        const input = '<div class="og-card" card-id="og_1"><div class="og-content"><div class="og-title">Title</div><div class="og-description">Desc</div><div class="og-url"><a href="https://example.com">https://example.com</a></div></div><!--og-card-end og_1--></div>';
        const updated = injectCustomBlocksIntoCard(
            input,
            [
                { className: 'custom-title', htmlContent: '<h1>Custom Title</h1>' },
                { className: 'custom-body', htmlContent: '<p>Custom Body</p>' }
            ],
            (html) => {
                const template = document.createElement('template');
                template.innerHTML = html;
                return template.content;
            }
        );

        const titleIndex = updated.indexOf('class="og-title"');
        const customTitleIndex = updated.indexOf('class="custom-title"');
        const customBodyIndex = updated.indexOf('class="custom-body"');
        const urlIndex = updated.indexOf('class="og-url"');

        expect(titleIndex).toBeGreaterThan(-1);
        expect(customTitleIndex).toBeGreaterThan(titleIndex);
        expect(customBodyIndex).toBeGreaterThan(customTitleIndex);
        expect(urlIndex).toBeGreaterThan(customBodyIndex);
    });
});

describe('Тесты с реальной заметкой из fixtures', () => {
    let allCards: Array<{ cardId: string; html: string }>;

    beforeAll(() => {
        allCards = findAllCards(TEST_NOTE_CONTENT);
    });

    it('должен найти все 5 карточек в тестовой заметке', () => {
        expect(allCards.length).toBe(5);
    });

    it('должен извлечь правильные данные из каждой карточки', () => {
        const cardIds = allCards.map(c => c.cardId);
        expect(cardIds).toContain(TEST_CARDS.CS2.cardId);
        expect(cardIds).toContain(TEST_CARDS.DOTA2.cardId);
        expect(cardIds).toContain(TEST_CARDS.STREETS_OF_ROGUE_2.cardId);
        expect(cardIds).toContain(TEST_CARDS.ASSAULT_ANDROID_CACTUS.cardId);
        expect(cardIds).toContain(TEST_CARDS.XX_20.cardId);
    });

    it('должен проверить что Dota 2 имеет пользовательский текст', () => {
        const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);
        expect(dotaCard).toBeDefined();
        expect(extractUserText(dotaCard!.html)).toBe(TEST_CARDS.DOTA2.userText);
    });

    it('должен проверить что Assault Android Cactus вертикальная', () => {
        const cactusCard = allCards.find(c => c.cardId === TEST_CARDS.ASSAULT_ANDROID_CACTUS.cardId);
        expect(cactusCard).toBeDefined();
        expect(isVerticalCard(cactusCard!.html)).toBe(true);
    });

    it('должен проверить URL каждой карточки', () => {
        for (const card of allCards) {
            const url = extractUrl(card.html);
            expect(url).not.toBeNull();
            expect(url).toMatch(/^https:\/\//);
        }
    });
});
