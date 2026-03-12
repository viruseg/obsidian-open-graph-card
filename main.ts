import { Plugin, Editor, MarkdownView, Notice, TFile } from 'obsidian';
import { t } from "./i18n";
import { OpenGraphSettings, DEFAULT_SETTINGS } from './src/types';
import { PluginContext } from './src/core/PluginContext';
import { parserRegistry } from './src/parsers';
import { CardData, ScreenshotData } from './src/types';
import { ContextMenuHandler, CardInfo, UrlInfo } from './src/ui';
import { SettingsTab } from './src/ui';
import { HtmlBuilder, ImageData } from './src/builders';

export default class OpenGraphPlugin extends Plugin {
    settings: OpenGraphSettings;
    private context!: PluginContext;
    private contextMenuHandler!: ContextMenuHandler;

    async onload() {
        await this.loadSettings();

        // Инициализация контекста с сервисами
        this.context = new PluginContext(this.app, () => this.settings);

        // Инициализация обработчика контекстного меню
        this.contextMenuHandler = new ContextMenuHandler(this.context, {
            getCardUnderCursor: this.getCardUnderCursor.bind(this),
            replaceWithOpenGraph: this.replaceWithOpenGraph.bind(this),
            updateCardUserText: this.updateCardUserText.bind(this),
            toggleCardOrientation: this.toggleCardOrientation.bind(this)
        });

        this.addSettingTab(new SettingsTab(this.app, this, this.settings, this.saveSettings.bind(this)));

        // Отслеживаем глобальный клик ПКМ, чтобы поймать целевой DOM элемент ДО рендера контекстного меню
        this.registerDomEvent(document, 'contextmenu', (e: MouseEvent) => {
            this.contextMenuHandler.setLastContextEventTarget(e.target as HTMLElement);
        }, { capture: true });

        // Регистрируем обработчик контекстного меню
        this.registerEvent(this.contextMenuHandler.createHandler());
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getCardUnderCursor(editor: Editor, targetLine?: number): CardInfo | null {
        // Если targetLine пришел из события мыши по DOM, используем его, иначе берём курсор
        const baseLine = targetLine !== undefined ? targetLine : editor.getCursor().line;

        let startLine = -1;
        let cardId: string | null = null;

        // 1. Ищем начало карточки поднимаясь вверх по строкам
        for (let i = baseLine; i >= Math.max(0, baseLine - 100); i--) {
            const lineText = editor.getLine(i);
            if (lineText.includes('<div class="og-card')) {
                startLine = i;
                // Пытаемся извлечь card-id из начала карточки
                const cardIdMatch = lineText.match(/<div class="og-card[^"]*"\s+card-id="(\d+)"/);
                if (cardIdMatch) {
                    cardId = cardIdMatch[1];
                }
                break;
            }
        }

        // 2. Ищем вниз (на случай, если posAtDOM указал чуть выше из-за пустых строк перед блоком)
        if (startLine === -1) {
            for (let i = baseLine + 1; i <= Math.min(editor.lineCount() - 1, baseLine + 10); i++) {
                const lineText = editor.getLine(i);
                if (lineText.includes('<div class="og-card')) {
                    startLine = i;
                    // Пытаемся извлечь card-id из начала карточки
                    const cardIdMatch = lineText.match(/<div class="og-card[^"]*"\s+card-id="(\d+)"/);
                    if (cardIdMatch) {
                        cardId = cardIdMatch[1];
                    }
                    break;
                }
            }
        }

        if (startLine === -1) return null;

        // Собираем текст карточки для парсинга (запас вниз 200 строк)
        const maxLookForward = Math.min(editor.lineCount() - 1, startLine + 200);
        const lines: string[] =[];
        for (let i = startLine; i <= maxLookForward; i++) {
            lines.push(editor.getLine(i));
        }
        const htmlStr = lines.join('\n');

        // Ищем конец карточки с учётом card-id
        let endRegex = new RegExp(`(?:<|\\\\x3C)!--og-card-end ${cardId}-->(?:\\s*)<\\/div>`, 'i');
        const endMatch = htmlStr.match(endRegex);

        if (!endMatch) return null;

        // Вырезаем только ту часть, которая относится к нашей карточке
        const fullCardHtml = htmlStr.substring(0, endMatch.index! + endMatch[0].length);
        const matchedLines = fullCardHtml.split('\n');
        const endLine = startLine + matchedLines.length - 1;

        // Если клик был не по DOM (использовался обычный курсор), проверяем что он реально находится внутри карточки
        if (targetLine === undefined) {
            const cursorLine = editor.getCursor().line;
            if (cursorLine < startLine || cursorLine > endLine) {
                return null;
            }
        }

        const endCh = matchedLines[matchedLines.length - 1].length;

        // Вытаскиваем URL
        const urlMatch = fullCardHtml.match(/<div class="og-url"><a href="([^"]+)">/);
        const url = urlMatch ? urlMatch[1] : null;

        if (!url) return null;

        // Вытаскиваем пользовательский текст между <div class="og-user-text"> и закрывающим тэгом / комментарием
        let userText = '';
        const userTextRegex = /<div class="og-user-text">([\s\S]*?)<\/div>(?:\s*)(?:<|\\x3C)!--og-user-text-end-->/i;
        const userMatch = fullCardHtml.match(userTextRegex);

        if (userMatch) {
            userText = userMatch[1].trim();
        }

        const startCh = editor.getLine(startLine).indexOf('<div class="og-card');

        return {
            url,
            userText,
            from: { line: startLine, ch: startCh },
            to: { line: endLine, ch: endCh }
        };
    }

    async downloadAndSaveImage(url: string, baseFilename: string, sourcePath: string, useProxy: boolean): Promise<TFile | null> {
        return await this.context.imageService.downloadAndSave(url, baseFilename, sourcePath, useProxy);
    }

    async replaceWithOpenGraph(editor: Editor, view: MarkdownView, urlInfo: UrlInfo, useProxy: boolean, userText: string = '') {
        new Notice(useProxy ? t('loadingProxy') : t('loading'));

        try {
            // Получаем подходящий парсер для URL
            const ogParser = parserRegistry.getParser(urlInfo.url);

            // Получаем заголовки от парсера
            const headers = ogParser.getHeaders();

            let html = '';
            try {
                html = await this.context.fetchService.fetchHtml(urlInfo.url, useProxy, headers);
            } catch (error) {
                if (useProxy) {
                    new Notice(t('proxyError'));
                    return;
                }
                throw error;
            }

            const domParser = new DOMParser();
            const doc = domParser.parseFromString(html, 'text/html');

            // Используем парсер для извлечения данных
            const cardData = await ogParser.parse(doc, urlInfo.url);

            // Добавляем пользовательский текст
            cardData.userText = userText;

            const sourcePath = view?.file?.path || '';

            // Обработка изображения
            let imageData: ImageData | undefined;
            if (cardData.image) {
                let image = cardData.image;
                const originalImageUrl = image;
                if (this.settings.saveImagesLocally) {
                    new Notice(t('downloadingCover'));
                    const imgFile = await this.downloadAndSaveImage(image, 'og-image', sourcePath, useProxy);
                    if (imgFile) {
                        image = encodeURI(imgFile.path);
                    }
                }
                imageData = {
                    src: image,
                    originalUrl: originalImageUrl,
                    showDataUrl: this.settings.saveImagesLocally
                };
            }

            // Обработка скриншотов (Steam)
            let screenshotData: ScreenshotData[] | undefined;
            if (cardData.screenshots && cardData.screenshots.length > 0) {
                screenshotData = cardData.screenshots;

                if (this.settings.saveImagesLocally) {
                    new Notice(t('downloadingScreenshots', cardData.screenshots.length.toString()));
                    const downloadPromises = cardData.screenshots.map((s, index) =>
                        this.downloadAndSaveImage(s.originalUrl, `screenshot-${index}`, sourcePath, useProxy)
                    );

                    const files = await Promise.all(downloadPromises);
                    screenshotData = cardData.screenshots.map((s, i) => ({
                        originalUrl: s.originalUrl,
                        localPath: files[i] ? encodeURI(files[i]!.path) : null
                    })).filter(d => d.localPath !== null || d.originalUrl);
                }
            }

            // Генерируем HTML с помощью HtmlBuilder
            const cardId = HtmlBuilder.generateCardId();
            const htmlBuilder = new HtmlBuilder(cardId);
            const htmlBlock = htmlBuilder.buildCard(cardData, imageData, screenshotData);

            editor.replaceRange(htmlBlock, urlInfo.from, urlInfo.to);
            // Устанавливаем курсор в начало карточки для предотвращения прыжков прокрутки
            editor.setCursor(urlInfo.from);
            new Notice(t('cardCreated'));
        } catch (error) {
            console.error(error);
            new Notice(t('loadingError', error.message));
        }
    }

    async updateCardUserText(editor: Editor, cardInfo: CardInfo, newText: string) {
        // Получаем текущий HTML карточки
        const cardHtml = editor.getRange(cardInfo.from, cardInfo.to);

        // Пытаемся извлечь card-id из карточки
        const cardIdMatch = cardHtml.match(/<div class="og-card[^"]*"\s+card-id="(\d+)"/);
        const cardId = cardIdMatch ? cardIdMatch[1] : null;

        // Ищем позицию <!--og-card-end--> (с card-id или без) для вставки/обновления пользовательского текста
        let cardEndMarker: string;
        let cardEndIndex: number;

        if (cardId) {
            cardEndMarker = `<!--og-card-end ${cardId}-->`;
            cardEndIndex = cardHtml.indexOf(cardEndMarker);
        } else {
            cardEndIndex = -1;
        }

        if (cardEndIndex === -1) {
            new Notice(t('cardEndMarkerNotFound'));
            return;
        }

        let newCardHtml: string;

        // Проверяем, есть ли уже og-user-text в карточке
        const userTextRegex = /<div class="og-user-text">[\s\S]*?<\/div>(?:\s*)(?:<|\\x3C)!--og-user-text-end-->/i;
        const existingUserTextMatch = cardHtml.match(userTextRegex);

        if (newText.trim() === '') {
            // Если текст пустой, удаляем блок og-user-text если он есть
            if (existingUserTextMatch) {
                newCardHtml = cardHtml.replace(userTextRegex, '');
            } else {
                return; // Нечего удалять
            }
        } else {
            // Используем HtmlBuilder для генерации блока пользовательского текста
            const htmlBuilder = new HtmlBuilder(parseInt(cardId || '0'));
            const userTextBlock = htmlBuilder.buildUserText(newText);

            if (existingUserTextMatch) {
                // Заменяем существующий блок
                newCardHtml = cardHtml.replace(userTextRegex, userTextBlock);
            } else {
                // Вставляем новый блок перед </div>, который находится перед <!--og-card-end-->
                const beforeMarker = cardHtml.substring(0, cardEndIndex);
                // Ищем последний </div> перед маркером
                const closingDivIndex = beforeMarker.lastIndexOf('</div>');

                if (closingDivIndex !== -1) {
                    const beforeDiv = cardHtml.substring(0, closingDivIndex);
                    const fromDivToEnd = cardHtml.substring(closingDivIndex);
                    newCardHtml = beforeDiv + userTextBlock + fromDivToEnd;
                } else {
                    // Fallback: если </div> не найден, вставляем перед <!--og-card-end-->
                    const afterMarker = cardHtml.substring(cardEndIndex);
                    newCardHtml = beforeMarker + userTextBlock + afterMarker;
                }
            }
        }

        editor.replaceRange(newCardHtml, cardInfo.from, cardInfo.to);
        // Устанавливаем курсор в начало карточки для предотвращения прыжков прокрутки
        editor.setCursor(cardInfo.from);
    }

    toggleCardOrientation(editor: Editor, cardInfo: CardInfo) {
        const cardHtml = editor.getRange(cardInfo.from, cardInfo.to);
        const isVertical = cardHtml.includes('og-card-vertical');

        let newCardHtml: string;

        if (isVertical) {
            // Удаляем класс og-card-vertical
            newCardHtml = cardHtml.replace(/<div class="og-card og-card-vertical"/, '<div class="og-card"');
        } else {
            // Добавляем класс og-card-vertical
            newCardHtml = cardHtml.replace(/<div class="og-card"(?=\s+card-id=")/, '<div class="og-card og-card-vertical"');
        }

        editor.replaceRange(newCardHtml, cardInfo.from, cardInfo.to);
        // Устанавливаем курсор в начало карточки для предотвращения прыжков прокрутки
        editor.setCursor(cardInfo.from);
    }

}
