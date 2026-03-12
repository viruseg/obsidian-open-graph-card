import { Plugin, Editor, MarkdownView, Menu, requestUrl, Notice, PluginSettingTab, App, Setting, TFile, Modal } from 'obsidian';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { t } from "./i18n";

interface OpenGraphSettings {
    proxy: string;
    saveImagesLocally: boolean;
}

const DEFAULT_SETTINGS: OpenGraphSettings = {
    proxy: '',
    saveImagesLocally: false
}

export default class OpenGraphPlugin extends Plugin {
    settings: OpenGraphSettings;
    lastContextEventTarget: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new OpenGraphSettingTab(this.app, this));

        // Отслеживаем глобальный клик ПКМ, чтобы поймать целевой DOM элемент ДО рендера контекстного меню
        this.registerDomEvent(document, 'contextmenu', (e: MouseEvent) => {
            this.lastContextEventTarget = e.target as HTMLElement;
        }, { capture: true });

        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
                if (!editor) return;

                let targetLine: number | undefined = undefined;

                // Если мы кликнули по отрендеренной HTML-карточке, пытаемся найти её настоящую строку в редакторе (Live Preview)
                if (this.lastContextEventTarget) {
                    const cardElement = this.lastContextEventTarget.closest('.og-card');
                    if (cardElement) {
                        try {
                            const cm = (editor as any).cm;
                            if (cm && typeof cm.posAtDOM === 'function') {
                                const pos = cm.posAtDOM(cardElement);
                                if (pos !== null && pos !== undefined) {
                                    targetLine = editor.offsetToPos(pos).line;
                                }
                            }
                        } catch (e) {
                            console.error('Error when extracting a position from the DOM', e);
                        }
                    }
                }

                const cardInfo = this.getCardUnderCursor(editor, targetLine);

                if (cardInfo) {
                    // --- Логика для существующей карточки под курсором ---
                    menu.addItem((item) => {
                        item
                            .setTitle(t('updateCard'))
                            .setIcon('sync')
                            .onClick(async () => {
                                await this.replaceWithOpenGraph(editor, view, { url: cardInfo.url, from: cardInfo.from, to: cardInfo.to }, false, cardInfo.userText);
                            });
                    });

                    if (this.settings.proxy && this.settings.proxy.trim() !== '') {
                        menu.addItem((item) => {
                            item
                                .setTitle(t('updateCardProxy'))
                                .setIcon('sync')
                                .onClick(async () => {
                                    await this.replaceWithOpenGraph(editor, view, { url: cardInfo.url, from: cardInfo.from, to: cardInfo.to }, true, cardInfo.userText);
                                });
                        });
                    }

                    menu.addItem((item) => {
                        item
                            .setTitle(t('removeCard'))
                            .setIcon('trash')
                            .onClick(async () => {
                                const replacement = cardInfo.url + (cardInfo.userText ? '\n' + cardInfo.userText : '');
                                editor.replaceRange(replacement, cardInfo.from, cardInfo.to);
                            });
                    });

                    // --- Пункт меню "Описание карточки" ---
                    menu.addItem((item) => {
                        item
                            .setTitle(t('cardDescription'))
                            .setIcon('text')
                            .onClick(() => {
                                new CardDescriptionModal(
                                    this.app,
                                    cardInfo.userText,
                                    async (newText) => {
                                        await this.updateCardUserText(editor, cardInfo, newText);
                                    }
                                ).open();
                            });
                    });

                    // --- Пункт меню переключения ориентации ---
                    // Проверяем ориентацию через HTML-код карточки (работает и в Live Preview, и при редактировании HTML)
                    const cardHtml = editor.getRange(cardInfo.from, cardInfo.to);
                    const isVertical = cardHtml.includes('og-card-vertical');
                    menu.addItem((item) => {
                        item
                            .setTitle(isVertical ? t('changeToHorizontal') : t('changeToVertical'))
                            .setIcon(isVertical ? 'arrow-right' : 'arrow-down')
                            .onClick(() => {
                                this.toggleCardOrientation(editor, cardInfo);
                            });
                    });

                } else {
                    const urlInfo = this.getUrlUnderCursor(editor);

                    if (urlInfo) {
                        menu.addItem((item) => {
                            item
                                .setTitle(t('loadCard'))
                                .setIcon('link')
                                .onClick(async () => {
                                    await this.replaceWithOpenGraph(editor, view, urlInfo, false);
                                });
                        });

                        if (this.settings.proxy && this.settings.proxy.trim() !== '') {
                            menu.addItem((item) => {
                                item
                                    .setTitle(t('loadCardProxy'))
                                    .setIcon('globe')
                                    .onClick(async () => {
                                        await this.replaceWithOpenGraph(editor, view, urlInfo, true);
                                    });
                            });
                        }
                    }

                    // --- Логика для ссылки в буфере обмена ---
                    try {
                        // @ts-ignore
                        const clipboardText = require('electron').clipboard.readText().trim();
                        const isUrl = /^https?:\/\/[^\s>)]+$/i.test(clipboardText);

                        if (isUrl) {
                            menu.addSeparator();

                            menu.addItem((item) => {
                                item
                                    .setTitle(t('pasteCard'))
                                    .setIcon('paste')
                                    .onClick(async () => {
                                        const from = editor.getCursor('from');
                                        const to = editor.getCursor('to');
                                        await this.replaceWithOpenGraph(editor, view, { url: clipboardText, from, to }, false);
                                    });
                            });

                            if (this.settings.proxy && this.settings.proxy.trim() !== '') {
                                menu.addItem((item) => {
                                    item
                                        .setTitle(t('pasteCardProxy'))
                                        .setIcon('globe')
                                        .onClick(async () => {
                                            const from = editor.getCursor('from');
                                            const to = editor.getCursor('to');
                                            await this.replaceWithOpenGraph(editor, view, { url: clipboardText, from, to }, true);
                                        });
                                });
                            }
                        }
                    } catch (e) {
                        console.error('Clipboard access error', e);
                    }
                }
            })
        );
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getUrlUnderCursor(editor: Editor): { url: string, from: any, to: any } | null {
        const cursor = editor.getCursor();
        const lineText = editor.getLine(cursor.line);

        const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
        let match;
        while ((match = mdLinkRegex.exec(lineText)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (cursor.ch >= start && cursor.ch <= end) {
                return { url: match[2], from: { line: cursor.line, ch: start }, to: { line: cursor.line, ch: end } };
            }
        }

        const urlRegex = /(https?:\/\/[^\s>)]+)/g;
        while ((match = urlRegex.exec(lineText)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (cursor.ch >= start && cursor.ch <= end) {
                return { url: match[1], from: { line: cursor.line, ch: start }, to: { line: cursor.line, ch: end } };
            }
        }

        return null;
    }

    getCardUnderCursor(editor: Editor, targetLine?: number): { url: string, userText: string, from: any, to: any } | null {
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
        try {
            let buffer: ArrayBuffer;
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };

            if (useProxy && this.settings.proxy) {
                const proxyUrl = this.settings.proxy.trim();
                let agent;
                if (proxyUrl.startsWith('socks')) {
                    agent = new SocksProxyAgent(proxyUrl);
                } else if (proxyUrl.startsWith('http')) {
                    agent = new HttpsProxyAgent(proxyUrl);
                }
                const response = await fetch(url, { agent, headers, follow: 5 });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const buf = await response.buffer();
                buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            } else {
                const response = await requestUrl({ url, headers });
                buffer = response.arrayBuffer;
            }

            let ext = 'jpg';
            try {
                const pathname = new URL(url).pathname;
                const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
                if (match) ext = match[1];
            } catch (e) {}

            const filename = `${baseFilename}-${Date.now()}.${ext}`;
            const attachmentPath = await this.app.fileManager.getAvailablePathForAttachment(filename, sourcePath);

            return await this.app.vault.createBinary(attachmentPath, buffer);
        } catch (error) {
            console.error('Error downloading image', error);
            return null;
        }
    }

    async replaceWithOpenGraph(editor: Editor, view: MarkdownView, urlInfo: { url: string, from: any, to: any }, useProxy: boolean, userText: string = '') {
        new Notice(useProxy ? t('loadingProxy') : t('loading'));

        try {
            let isSteam = false;
            try {
                const parsedUrl = new URL(urlInfo.url);
                if (parsedUrl.hostname === 'store.steampowered.com') {
                    isSteam = true;
                }
            } catch (e) {
                console.error('Invalid URL', e);
            }

            const headers: Record<string, string> = {
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            };

            if (isSteam) {
                headers['Cookie'] = 'wants_mature_content=1;path=/';
            }

            let html = '';

            if (useProxy && this.settings.proxy) {
                const proxyUrl = this.settings.proxy.trim();
                let agent;

                if (proxyUrl.startsWith('socks')) {
                    agent = new SocksProxyAgent(proxyUrl);
                } else if (proxyUrl.startsWith('http')) {
                    agent = new HttpsProxyAgent(proxyUrl);
                } else {
                    new Notice(t('proxyError'));
                    return;
                }

                const response = await fetch(urlInfo.url, {
                    headers,
                    agent,
                    follow: 5
                });

                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                html = await response.text();
            } else {
                const response = await requestUrl({ url: urlInfo.url, headers });
                html = response.text;
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            let title =
                isSteam && doc.getElementById('appHubAppName')?.textContent ||
                doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                doc.title ||
                t('untitled');

            let description =
                doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
                '';

            let image =
                doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                '';

            if (image && !image.startsWith('http')) {
                try { image = new URL(image, urlInfo.url).href; } catch (e) {}
            }

            title = this.escapeHTML(title);
            description = this.escapeHTML(description);
            const safeUrl = this.escapeHTML(urlInfo.url);

            const sourcePath = view?.file?.path || '';

            let imageHtml = '';
            if (image) {
                const originalImageUrl = image;
                if (this.settings.saveImagesLocally) {
                    new Notice(t('downloadingCover'));
                    const imgFile = await this.downloadAndSaveImage(image, 'og-image', sourcePath, useProxy);
                    if (imgFile) {
                        image = encodeURI(imgFile.name);
                    }
                }
                const dataUrlAttr = this.settings.saveImagesLocally ? ` data-url="${this.escapeHTML(originalImageUrl)}"` : '';
                imageHtml = `<img src="${this.escapeHTML(image)}" class="og-image" alt="${title}"${dataUrlAttr} />`;
            }

            let extraHtml = '';
            let ratingHtml = '';

            if (isSteam) {
                const positiveVoteText = doc.querySelector('label[for="review_type_positive"] .user_reviews_count');
                const negativeVoteText = doc.querySelector('label[for="review_type_negative"] .user_reviews_count');

                if (positiveVoteText && negativeVoteText) {
                    const posVotesText = positiveVoteText.textContent?.replace(/[(.,\s)]/g, '') || '0';
                    const negVotesText = negativeVoteText.textContent?.replace(/[(.,\s)]/g, '') || '0';

                    const positiveVotes = Number.parseInt(posVotesText, 10);
                    const negativeVotes = Number.parseInt(negVotesText, 10);
                    const totalVotes = positiveVotes + negativeVotes;

                    if (totalVotes > 0) {
                        const average = positiveVotes / totalVotes;
                        const score = average - (average - 0.5) * (2 ** -Math.log10(totalVotes + 1));

                        let ratingClass = 'poor';
                        if (totalVotes < 500) {
                            ratingClass = 'white';
                        } else if (score > 0.74) {
                            ratingClass = 'good';
                        } else if (score > 0.49) {
                            ratingClass = 'average';
                        }

                        const className = `steamdb_rating_${ratingClass}`;
                        const textContent = (score * 100).toFixed(2) + '%';
                        ratingHtml = `<div class="og-rating"><span class="${className}">${textContent}</span></div>`;
                    }
                }

                let screenshots: string[] =[];
                const carouselDiv = doc.querySelector('.gamehighlight_desktopcarousel');
                if (carouselDiv) {
                    const dataProps = carouselDiv.getAttribute('data-props');
                    if (dataProps) {
                        try {
                            const parsedData = JSON.parse(dataProps);
                            let rawThumbnails: string[] =[];

                            if (parsedData.screenshots && Array.isArray(parsedData.screenshots)) {
                                rawThumbnails.push(...parsedData.screenshots.map((s: any) => s.thumbnail));
                            }
                            screenshots = rawThumbnails.filter((src: string) => src);
                        } catch (e) {
                            console.error('Error parsing Steam data-props', e);
                        }
                    }
                }

                // Создаём массив пар {originalUrl, localPath}
                let screenshotData: {originalUrl: string, localPath: string | null}[] = screenshots.map(src => ({originalUrl: src, localPath: null}));
                if (this.settings.saveImagesLocally && screenshots.length > 0) {
                    new Notice(t('downloadingScreenshots', screenshots.length.toString()));
                    const downloadPromises = screenshots.map((src, index) =>
                        this.downloadAndSaveImage(src, `screenshot-${index}`, sourcePath, useProxy)
                    );

                    const files = await Promise.all(downloadPromises);
                    screenshotData = screenshots.map((src, i) => ({
                        originalUrl: src,
                        localPath: files[i] ? encodeURI(files[i]!.name) : null
                    })).filter(d => d.localPath !== null || d.originalUrl);
                }

                let screenshotsHtml = '';
                if (screenshotData.length > 0) {
                    screenshotsHtml = `<div class="og-screenshots">` +
                        screenshotData.map(d => {
                            const src = d.localPath || d.originalUrl;
                            const dataUrlAttr = this.settings.saveImagesLocally && d.localPath ? ` data-url="${this.escapeHTML(d.originalUrl)}"` : '';
                            return `<img src="${this.escapeHTML(src)}" class="og-screenshot"${dataUrlAttr} />`;
                        }).join('') +
                        `</div>`;
                }

                const tagNodes = doc.querySelectorAll('.popular_tags a');
                const tags = Array.from(tagNodes)
                    .map(a => a.textContent?.trim() || '')
                    .filter(t => t !== '')
                    .slice(0, 5);

                let tagsHtml = '';
                if (tags.length > 0) {
                    tagsHtml = `<div class="og-tags">` +
                        tags.map(t => `<div class="og-tag">${this.escapeHTML(t)}</div>`).join('') +
                        `</div>`;
                }

                extraHtml = tagsHtml + screenshotsHtml;
            }

            // Добавляем пользовательский текст если он есть
            let userTextHtml = '';
            if (userText && userText.trim() !== '') {
                userTextHtml = `<div class="og-user-text">${this.escapeHTML(userText)}</div><!--og-user-text-end-->`;
            }

            // Генерируем уникальный идентификатор карточки на основе timestamp
            const cardId = Date.now();

            const htmlBlock = `<div class="og-card" card-id="${cardId}">${imageHtml}<div class="og-content"><div class="og-title">${title}</div>${ratingHtml}<div class="og-description">${description}</div>${extraHtml}<div class="og-url"><a href="${safeUrl}">${safeUrl}</a></div>${userTextHtml}</div><!--og-card-end ${cardId}--></div>`;

            editor.replaceRange(htmlBlock, urlInfo.from, urlInfo.to);
            // Устанавливаем курсор в начало карточки для предотвращения прыжков прокрутки
            editor.setCursor(urlInfo.from);
            new Notice(t('cardCreated'));
        } catch (error) {
            console.error(error);
            new Notice(t('loadingError', error.message));
        }
    }

    async updateCardUserText(editor: Editor, cardInfo: { url: string, userText: string, from: any, to: any }, newText: string) {
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
            // Формируем новый блок с пользовательским текстом
            const escapedText = this.escapeHTML(newText);
            const userTextBlock = `<div class="og-user-text">${escapedText}</div><!--og-user-text-end-->`;

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

    toggleCardOrientation(editor: Editor, cardInfo: { url: string, userText: string, from: any, to: any }) {
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

    escapeHTML(str: string) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
}

class OpenGraphSettingTab extends PluginSettingTab {
    plugin: OpenGraphPlugin;

    constructor(app: App, plugin: OpenGraphPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: t('settingsTitle')});

        new Setting(containerEl)
            .setName(t('proxyName'))
            .setDesc(t('proxyDesc'))
            .addText(text => text
                .setPlaceholder('socks5://127.0.0.1:1080')
                .setValue(this.plugin.settings.proxy)
                .onChange(async (value) => {
                    this.plugin.settings.proxy = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('saveImagesName'))
            .setDesc(t('saveImagesDesc'))
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.saveImagesLocally)
                    .onChange(async (value) => {
                        this.plugin.settings.saveImagesLocally = value;
                        await this.plugin.saveSettings();
                    }));
    }
}

class CardDescriptionModal extends Modal {
    private text: string;
    private onSave: (text: string) => void;
    private textarea: HTMLTextAreaElement;

    constructor(app: App, currentText: string, onSave: (text: string) => void) {
        super(app);
        this.text = currentText;
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: t('cardDescription') });

        this.textarea = contentEl.createEl('textarea', {
            attr: {
                style: 'width: 100%; height: 200px; resize: vertical; margin-bottom: 1em;'
            }
        });
        this.textarea.value = this.text;

        const buttonContainer = contentEl.createDiv({
            attr: {
                style: 'display: flex; justify-content: flex-end; gap: 0.5em;'
            }
        });

        const saveButton = buttonContainer.createEl('button', { text: t('save'), attr: { class: 'mod-cta' } });
        saveButton.addEventListener('click', () => {
            this.onSave(this.textarea.value);
            this.close();
        });

        const cancelButton = buttonContainer.createEl('button', { text: t('cancel') });
        cancelButton.addEventListener('click', () => {
            this.close();
        });

        // Фокус на textarea при открытии
        this.textarea.focus();
        // Выделение всего текста описания
        this.textarea.select();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}