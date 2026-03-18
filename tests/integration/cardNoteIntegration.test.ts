/**
 * Интеграционные тесты для работы с карточками в контексте заметки
 * Тестируют все функции html.ts через DOMParser на реальной заметке с 5 карточками
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
    serializeCard
} from '../../src/utils/html';
import { TEST_NOTE_CONTENT, TEST_CARDS } from '../fixtures/testNote';

describe('Интеграционные тесты карточек в заметке', () => {
    let allCards: Array<{ cardId: string; html: string; startOffset: number; endOffset: number }>;

    beforeAll(() => {
        allCards = findAllCards(TEST_NOTE_CONTENT);
    });

    describe('Поиск карточек в заметке', () => {
        it('должен найти все 5 карточек в заметке', () => {
            expect(allCards.length).toBe(5);
        });

        it('должен извлечь правильные card-id для всех карточек', () => {
            const expectedIds = [
                TEST_CARDS.CS2.cardId,
                TEST_CARDS.DOTA2.cardId,
                TEST_CARDS.STREETS_OF_ROGUE_2.cardId,
                TEST_CARDS.ASSAULT_ANDROID_CACTUS.cardId,
                TEST_CARDS.XX_20.cardId
            ];

            const actualIds = allCards.map(c => c.cardId);
            expect(actualIds).toEqual(expectedIds);
        });

        it('должен найти карточку по card-id среди всех карточек', () => {
            const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);
            expect(dotaCard).toBeDefined();
            expect(dotaCard!.html).toContain('Dota 2');
        });

        it('должен правильно определять смещения карточек', () => {
            for (const card of allCards) {
                const extractedFromContent = TEST_NOTE_CONTENT.substring(card.startOffset, card.endOffset);
                expect(extractedFromContent).toBe(card.html);
            }
        });
    });

    describe('Извлечение данных из конкретных карточек', () => {
        it('должен извлечь URL из карточки Counter-Strike 2', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            expect(cs2Card).toBeDefined();

            const url = extractUrl(cs2Card!.html);
            expect(url).toBe(TEST_CARDS.CS2.url);
        });

        it('должен извлечь URL из карточки Dota 2', () => {
            const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);
            expect(dotaCard).toBeDefined();

            const url = extractUrl(dotaCard!.html);
            expect(url).toBe(TEST_CARDS.DOTA2.url);
        });

        it('должен извлечь заголовок из конкретной карточки', () => {
            const streetsCard = allCards.find(c => c.cardId === TEST_CARDS.STREETS_OF_ROGUE_2.cardId);
            expect(streetsCard).toBeDefined();

            const title = extractTitle(streetsCard!.html);
            expect(title).toBe('Streets of Rogue 2');
        });

        it('должен извлечь пользовательский текст из карточки Dota 2', () => {
            const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);
            expect(dotaCard).toBeDefined();

            const userText = extractUserText(dotaCard!.html);
            expect(userText).toBe(TEST_CARDS.DOTA2.userText);
        });

        it('должен вернуть пустую строку для карточки без пользовательского текста', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            expect(cs2Card).toBeDefined();

            const userText = extractUserText(cs2Card!.html);
            expect(userText).toBe('');
        });

        it('должен проверить что Assault Android Cactus вертикальная', () => {
            const cactusCard = allCards.find(c => c.cardId === TEST_CARDS.ASSAULT_ANDROID_CACTUS.cardId);
            expect(cactusCard).toBeDefined();

            expect(isVerticalCard(cactusCard!.html)).toBe(true);
        });

        it('должен проверить что Counter-Strike 2 горизонтальная', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            expect(cs2Card).toBeDefined();

            expect(isVerticalCard(cs2Card!.html)).toBe(false);
        });

        it('должен извлечь теги из карточки Counter-Strike 2', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            expect(cs2Card).toBeDefined();

            const tags = extractTags(cs2Card!.html);
            expect(tags).toContain('Шутер от первого лица');
            expect(tags).toContain('Экшен');
            expect(tags.length).toBe(5);
        });

        it('должен извлечь описание из карточки 20XX', () => {
            const xx20Card = allCards.find(c => c.cardId === TEST_CARDS.XX_20.cardId);
            expect(xx20Card).toBeDefined();

            const description = extractDescription(xx20Card!.html);
            expect(description).toContain('аркадная игра-бродилка');
        });
    });

    describe('Работа с изображениями', () => {
        it('должен извлечь все изображения из карточки Counter-Strike 2', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            expect(cs2Card).toBeDefined();

            const sources = getImageSourcesFromCard(cs2Card!.html);
            expect(sources.length).toBe(TEST_CARDS.CS2.imageCount);
        });

        it('должен извлечь все изображения из карточки Streets of Rogue 2', () => {
            const streetsCard = allCards.find(c => c.cardId === TEST_CARDS.STREETS_OF_ROGUE_2.cardId);
            expect(streetsCard).toBeDefined();

            const sources = getImageSourcesFromCard(streetsCard!.html);
            expect(sources.length).toBe(TEST_CARDS.STREETS_OF_ROGUE_2.imageCount);
        });

        it('должен извлечь data-url из изображений', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            expect(cs2Card).toBeDefined();

            const imageData = getImageDataUrlsFromCard(cs2Card!.html);
            expect(imageData.length).toBeGreaterThan(0);

            const firstImage = imageData[0];
            expect(firstImage.src).toContain('Attachments/');
            expect(firstImage.dataUrl).toContain('steamstatic.com');
        });

        it('должен правильно отслеживать индексы изображений', () => {
            const streetsCard = allCards.find(c => c.cardId === TEST_CARDS.STREETS_OF_ROGUE_2.cardId);
            expect(streetsCard).toBeDefined();

            const imageData = getImageDataUrlsFromCard(streetsCard!.html);
            for (let i = 0; i < imageData.length; i++) {
                expect(imageData[i].elementIndex).toBe(i);
            }
        });
    });

    describe('Манипуляции с конкретными карточками', () => {
        it('должен заменить изображение в конкретной карточке по индексу', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            expect(cs2Card).toBeDefined();

            const newSrc = 'new-image.jpg';
            const newHtml = replaceImageInCard(cs2Card!.html, 0, newSrc, undefined);

            const newSources = getImageSourcesFromCard(newHtml);
            expect(newSources[0]).toBe(newSrc);

            const originalSecondSource = getImageSourcesFromCard(cs2Card!.html)[1];
            expect(newSources[1]).toBe(originalSecondSource);
        });

        it('должен добавить data-url при замене изображения', () => {
            const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);
            expect(dotaCard).toBeDefined();

            const newSrc = 'local-image.jpg';
            const newDataUrl = 'https://example.com/remote-image.jpg';
            const newHtml = replaceImageInCard(dotaCard!.html, 0, newSrc, newDataUrl);

            const imageData = getImageDataUrlsFromCard(newHtml);
            expect(imageData[0].src).toBe(newSrc);
            expect(imageData[0].dataUrl).toBe(newDataUrl);
        });

        it('должен удалить data-url при передаче null', () => {
            const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);
            expect(dotaCard).toBeDefined();

            const imageDataBefore = getImageDataUrlsFromCard(dotaCard!.html);
            expect(imageDataBefore[0].dataUrl).not.toBeNull();

            const newHtml = replaceImageInCard(dotaCard!.html, 0, 'new-image.jpg', null);
            const imageDataAfter = getImageDataUrlsFromCard(newHtml);
            expect(imageDataAfter[0].dataUrl).toBeNull();
        });

        it('должен переключить ориентацию карточки Counter-Strike 2', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            expect(cs2Card).toBeDefined();

            expect(isVerticalCard(cs2Card!.html)).toBe(false);

            const toggledHtml = toggleCardOrientation(cs2Card!.html);
            expect(isVerticalCard(toggledHtml)).toBe(true);

            const toggledAgain = toggleCardOrientation(toggledHtml);
            expect(isVerticalCard(toggledAgain)).toBe(false);
        });

        it('должен переключить ориентацию вертикальной карточки', () => {
            const cactusCard = allCards.find(c => c.cardId === TEST_CARDS.ASSAULT_ANDROID_CACTUS.cardId);
            expect(cactusCard).toBeDefined();

            expect(isVerticalCard(cactusCard!.html)).toBe(true);

            const toggledHtml = toggleCardOrientation(cactusCard!.html);
            expect(isVerticalCard(toggledHtml)).toBe(false);
        });

        it('должен заменить card-id в карточке', () => {
            const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);
            expect(dotaCard).toBeDefined();

            const newCardId = 'og_new_test_id_123';
            const newHtml = replaceCardId(dotaCard!.html, newCardId);

            expect(extractCardId(newHtml)).toBe(newCardId);
            expect(newHtml).toContain(`<!--og-card-end ${newCardId}-->`);
        });
    });

    describe('Изоляция изменений', () => {
        it('не должен изменять другие карточки при модификации одной', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);

            expect(cs2Card).toBeDefined();
            expect(dotaCard).toBeDefined();

            const originalDotaHtml = dotaCard!.html;
            const modifiedCs2Html = replaceImageInCard(cs2Card!.html, 0, 'new.jpg', undefined);

            expect(extractUrl(modifiedCs2Html)).toBe(TEST_CARDS.CS2.url);
            expect(originalDotaHtml).toBe(dotaCard!.html);
        });

        it('должен сохранить все данные карточки при изменении одного элемента', () => {
            const streetsCard = allCards.find(c => c.cardId === TEST_CARDS.STREETS_OF_ROGUE_2.cardId);
            expect(streetsCard).toBeDefined();

            const originalTitle = extractTitle(streetsCard!.html);
            const originalTags = extractTags(streetsCard!.html);
            const originalUrl = extractUrl(streetsCard!.html);

            const modifiedHtml = replaceImageInCard(streetsCard!.html, 0, 'new.jpg', undefined);

            expect(extractTitle(modifiedHtml)).toBe(originalTitle);
            expect(extractTags(modifiedHtml)).toEqual(originalTags);
            expect(extractUrl(modifiedHtml)).toBe(originalUrl);
        });
    });

    describe('DOMParser функциональность', () => {
        it('должен успешно парсить карточку через parseCardHtml', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            expect(cs2Card).toBeDefined();

            const parsed = parseCardHtml(cs2Card!.html);
            expect(parsed).not.toBeNull();
            expect(parsed!.card).toBeInstanceOf(HTMLElement);
            expect(parsed!.doc).toBeInstanceOf(Document);
        });

        it('должен возвращать null для некорректного HTML', () => {
            const parsed = parseCardHtml('not a card html');
            expect(parsed).toBeNull();
        });

        it('должен вернуть null для пустой строки', () => {
            const parsed = parseCardHtml('');
            expect(parsed).toBeNull();
        });

        it('должен корректно сериализовать карточку', () => {
            const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);
            expect(dotaCard).toBeDefined();

            const parsed = parseCardHtml(dotaCard!.html);
            expect(parsed).not.toBeNull();

            const serialized = serializeCard(parsed!.card);
            expect(serialized).toContain('og-card');
            expect(serialized).toContain(TEST_CARDS.DOTA2.cardId);
        });
    });

    describe('Граничные случаи', () => {
        it('должен обработать карточку в начале заметки (после заголовков)', () => {
            const firstCardIndex = TEST_NOTE_CONTENT.indexOf(allCards[0].html);
            expect(firstCardIndex).toBeGreaterThan(0);
        });

        it('должен обработать карточку после markdown таблицы', () => {
            const streetsCard = allCards.find(c => c.cardId === TEST_CARDS.STREETS_OF_ROGUE_2.cardId);
            expect(streetsCard).toBeDefined();

            const beforeCard = TEST_NOTE_CONTENT.substring(
                Math.max(0, streetsCard!.startOffset - 100),
                streetsCard!.startOffset
            );
            expect(beforeCard).toContain('|');
        });

        it('должен обработать карточку рядом с код-блоком', () => {
            const streetsCard = allCards.find(c => c.cardId === TEST_CARDS.STREETS_OF_ROGUE_2.cardId);
            expect(streetsCard).toBeDefined();

            const afterCard = TEST_NOTE_CONTENT.substring(
                streetsCard!.endOffset,
                Math.min(TEST_NOTE_CONTENT.length, streetsCard!.endOffset + 100)
            );
            expect(afterCard).toContain('```');
        });

        it('должен обработать карточку с рейтингом', () => {
            const cs2Card = allCards.find(c => c.cardId === TEST_CARDS.CS2.cardId);
            expect(cs2Card).toBeDefined();

            const parsed = parseCardHtml(cs2Card!.html);
            expect(parsed).not.toBeNull();

            const rating = parsed!.card.querySelector('.og-rating');
            expect(rating).not.toBeNull();
            expect(rating!.textContent).toContain('86.01%');
        });

        it('должен обработать карточку без рейтинга', () => {
            const streetsCard = allCards.find(c => c.cardId === TEST_CARDS.STREETS_OF_ROGUE_2.cardId);
            expect(streetsCard).toBeDefined();

            const parsed = parseCardHtml(streetsCard!.html);
            expect(parsed).not.toBeNull();

            const rating = parsed!.card.querySelector('.og-rating');
            expect(rating).toBeNull();
        });
    });

    describe('Валидация целостности данных', () => {
        it('должен сохранить card-id при всех манипуляциях', () => {
            const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);
            expect(dotaCard).toBeDefined();

            let html = dotaCard!.html;
            const originalId = extractCardId(html);

            html = toggleCardOrientation(html);
            expect(extractCardId(html)).toBe(originalId);

            html = replaceImageInCard(html, 0, 'new.jpg', undefined);
            expect(extractCardId(html)).toBe(originalId);
        });

        it('должен сохранить URL при переключении ориентации', () => {
            const cactusCard = allCards.find(c => c.cardId === TEST_CARDS.ASSAULT_ANDROID_CACTUS.cardId);
            expect(cactusCard).toBeDefined();

            const originalUrl = extractUrl(cactusCard!.html);
            const toggledHtml = toggleCardOrientation(cactusCard!.html);

            expect(extractUrl(toggledHtml)).toBe(originalUrl);
        });

        it('должен сохранить пользовательский текст при других манипуляциях', () => {
            const dotaCard = allCards.find(c => c.cardId === TEST_CARDS.DOTA2.cardId);
            expect(dotaCard).toBeDefined();

            const originalUserText = extractUserText(dotaCard!.html);

            const toggledHtml = toggleCardOrientation(dotaCard!.html);
            expect(extractUserText(toggledHtml)).toBe(originalUserText);

            const replacedHtml = replaceImageInCard(dotaCard!.html, 0, 'new.jpg', undefined);
            expect(extractUserText(replacedHtml)).toBe(originalUserText);
        });
    });
});
