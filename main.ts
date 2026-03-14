import { Plugin, Editor, MarkdownView, Notice, TFile, TAbstractFile, EventRef } from 'obsidian';
import { t } from "./i18n";
import { OpenGraphSettings, DEFAULT_SETTINGS, FileLinksData, FileDeletedEventData, FileRenamedEventData, CardLinks } from './src/types';
import { PluginContext } from './src/core/PluginContext';
import { parserRegistry } from './src/parsers';
import { CardData, ScreenshotData } from './src/types';
import { ContextMenuHandler, CardInfo, UrlInfo } from './src/ui';
import { SettingsTab } from './src/ui';
import { HtmlBuilder, ImageData } from './src/builders';
import { CARD_BOUNDS } from './src/utils/constants';
import { extractCardId, getImageDataUrlsFromCard, replaceImageInCard } from './src/utils/html';

/**
 * Данные по умолчанию для связей файлов
 */
const DEFAULT_FILE_LINKS_DATA: FileLinksData = {
    version: 1,
    cardLinks: {}
};

export default class OpenGraphPlugin extends Plugin {
    settings: OpenGraphSettings;
    private fileLinksData: FileLinksData = DEFAULT_FILE_LINKS_DATA;
    private context!: PluginContext;
    private contextMenuHandler!: ContextMenuHandler;

    async onload() {
        await this.loadSettings();
        await this.loadFileLinksData();

        // Инициализация контекста с сервисами
        this.context = new PluginContext(
            this.app,
            () => this.settings,
            () => this.fileLinksData,
            this.saveFileLinksData.bind(this)
        );

        // Инициализация FileLinkService
        this.context.fileLinkService.initialize();

        // Подписка на события FileLinkService
        this.registerFileLinkEvents();

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

    onunload() {
        // Освобождаем ресурсы FileLinkService
        if (this.context?.fileLinkService) {
            this.context.fileLinkService.dispose();
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Загружает данные связей файлов из data.json
     */
    private async loadFileLinksData(): Promise<void> {
        const data = await this.loadData();
        if (data?.fileLinks) {
            this.fileLinksData = {
                version: data.fileLinks.version ?? 1,
                cardLinks: data.fileLinks.cardLinks ?? {}
            };
        }
    }

    /**
     * Возвращает текущие данные связей файлов
     */
    getFileLinksData(): FileLinksData {
        return this.fileLinksData;
    }

    /**
     * Сохраняет данные связей файлов в data.json
     */
    async saveFileLinksData(): Promise<void> {
        const data = await this.loadData() ?? {};
        data.fileLinks = this.context?.fileLinkService?.getSerializedData() ?? this.fileLinksData;
        await this.saveData(data);
    }

    /**
     * Подписывается на кастомные события от FileLinkService
     */
    private registerFileLinkEvents(): void {
        // Событие удаления пользовательской заметки
        this.registerEvent(this.app.workspace.on('og-card:user-note-deleted' as any, (data: FileDeletedEventData) => {
            this.handleUserNoteDeleted(data);
        }));

        // Событие удаления сгенерированной заметки
        this.registerEvent(this.app.workspace.on('og-card:generated-note-deleted' as any, (data: FileDeletedEventData) => {
            this.handleGeneratedNoteDeleted(data);
        }));

        // Событие удаления изображения
        this.registerEvent(this.app.workspace.on('og-card:image-deleted' as any, (data: FileDeletedEventData) => {
            this.handleImageDeleted(data);
        }));

        // Событие переименования файла
        this.registerEvent(this.app.workspace.on('og-card:file-renamed' as any, (data: FileRenamedEventData) => {
            this.handleFileRenamed(data);
        }));
    }

    /**
     * Обрабатывает удаление пользовательской заметки
     */
    private async handleUserNoteDeleted(data: FileDeletedEventData): Promise<void> {
        // Сначала удаляем связи, чтобы последующие события удаления файлов не обрабатывались
        this.context.fileLinkService.unregisterCard(data.cardId);

        // Удаляем сгенерированную заметку если она есть
        if (data.cardLinks.generatedNotePath) {
            const genNoteFile = this.app.vault.getAbstractFileByPath(data.cardLinks.generatedNotePath);
            if (genNoteFile) {
                try {
                    await this.app.vault.trash(genNoteFile, true);
                } catch (error) {
                    console.error(`OpenGraphPlugin: Failed to delete generated note:`, error);
                }
            }
        }

        // Удаляем все локальные изображения
        for (const imagePath of data.cardLinks.imagePaths) {
            const imageFile = this.app.vault.getAbstractFileByPath(imagePath);
            if (imageFile) {
                try {
                    await this.app.vault.trash(imageFile, true);
                } catch (error) {
                    // Игнорируем ошибку, если файл уже удалён
                    if (!error.message?.includes('ENOENT')) {
                        console.error(`OpenGraphPlugin: Failed to delete image:`, error);
                    }
                }
            }
        }
    }

    /**
     * Обрабатывает удаление сгенерированной заметки
     */
    private async handleGeneratedNoteDeleted(data: FileDeletedEventData): Promise<void> {
        // Сначала удаляем связи, чтобы последующие события удаления файлов не обрабатывались
        this.context.fileLinkService.unregisterCard(data.cardId);

        // Удаляем все локальные изображения
        for (const imagePath of data.cardLinks.imagePaths) {
            const imageFile = this.app.vault.getAbstractFileByPath(imagePath);
            if (imageFile) {
                try {
                    await this.app.vault.trash(imageFile, true);
                } catch (error) {
                    // Игнорируем ошибку, если файл уже удалён
                    if (!error.message?.includes('ENOENT')) {
                        console.error(`OpenGraphPlugin: Failed to delete image:`, error);
                    }
                }
            }
        }
    }

    /**
     * Обрабатывает удаление изображения
     * Восстановление URL в карточке выполняется в handleRestoreImages через restoreCardImages()
     */
    private async handleImageDeleted(data: FileDeletedEventData): Promise<void> {
        console.log(`OpenGraphPlugin: Image deleted: ${data.deletedPath}`);

        // 1. Удаляем изображение из связей
        this.context.fileLinkService.removeImage(data.cardId, data.deletedPath);

        // 2. Обновляем сгенерированную заметку (убираем ссылку на изображение)
        if (data.cardLinks.generatedNotePath) {
            const genNoteFile = this.app.vault.getAbstractFileByPath(data.cardLinks.generatedNotePath);
            if (genNoteFile instanceof TFile) {
                try {
                    let content = await this.app.vault.read(genNoteFile);
                    // Удаляем ссылку на изображение из заметки
                    const imageLinkRegex = new RegExp(`!\\[\\^?[^\\]]*\\]\\(${this.escapeRegex(data.deletedPath)}\\)\\s*`, 'g');
                    content = content.replace(imageLinkRegex, '');
                    await this.app.vault.modify(genNoteFile, content);
                    console.log(`OpenGraphPlugin: Updated generated note, removed image link`);
                } catch (error) {
                    console.error(`OpenGraphPlugin: Failed to update generated note:`, error);
                }
            }
        }
        // Примечание: Восстановление URL в карточке не выполняется здесь.
        // При массовом удалении изображений (выгрузка) это делает handleRestoreImages через restoreCardImages().
        // При одиночном удалении пользователем изображения через файловый менеджер -
        // карточка сохраняет локальный путь (битая ссылка), что ожидаемое поведение.
    }

    /**
     * Восстанавливает URL изображения в карточке из data-url атрибута
     */
    private async restoreImageUrlInCard(data: FileDeletedEventData): Promise<void> {
        const userNotePath = data.cardLinks.userNotePath;
        const userNoteFile = this.app.vault.getAbstractFileByPath(userNotePath);

        if (!(userNoteFile instanceof TFile)) {
            return;
        }

        try {
            let content = await this.app.vault.read(userNoteFile);

            // Ищем карточку по card-id
            const cardRegex = new RegExp(
                `(<div class="og-card[^"]*"\\s+card-id="${data.cardId}"[\\s\\S]*?<!--og-card-end ${data.cardId}-->\\s*</div>)`,
                'i'
            );

            const cardMatch = content.match(cardRegex);
            if (!cardMatch) {
                console.log(`OpenGraphPlugin: Card ${data.cardId} not found in user note`);
                return;
            }

            const cardHtml = cardMatch[1];

            // Получаем информацию об изображениях с data-url
            const imageDataUrls = getImageDataUrlsFromCard(cardHtml);

            // Ищем изображение с удалённым путём
            let updatedCardHtml = cardHtml;
            for (const imgInfo of imageDataUrls) {
                if (imgInfo.src === data.deletedPath && imgInfo.dataUrl) {
                    // Заменяем локальный путь на URL из data-url
                    updatedCardHtml = replaceImageInCard(updatedCardHtml, imgInfo.elementIndex, imgInfo.dataUrl);
                    console.log(`OpenGraphPlugin: Restored image URL: ${imgInfo.dataUrl}`);
                    break;
                }
            }

            // Заменяем карточку в контенте
            if (updatedCardHtml !== cardHtml) {
                content = content.replace(cardRegex, updatedCardHtml);
                await this.app.vault.modify(userNoteFile, content);
                console.log(`OpenGraphPlugin: Updated card in user note`);
            }
        } catch (error) {
            console.error(`OpenGraphPlugin: Failed to restore image URL in card:`, error);
        }
    }

    /**
     * Обрабатывает переименование файла
     */
    private handleFileRenamed(data: FileRenamedEventData): void {
        console.log(`OpenGraphPlugin: File renamed: ${data.oldPath} -> ${data.newPath} (${data.fileType})`);
        // Обновление путей происходит автоматически в FileLinkService.handleFileRename()
    }

    /**
     * Экранирует специальные символы для использования в регулярном выражении
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getCardUnderCursor(editor: Editor, targetLine?: number): CardInfo | null {
        // Если targetLine пришел из события мыши по DOM, используем его, иначе берём курсор
        const baseLine = targetLine !== undefined ? targetLine : editor.getCursor().line;

        let startLine = -1;
        let cardId: string | null = null;

        // 1. Ищем начало карточки поднимаясь вверх по строкам
        for (let i = baseLine; i >= Math.max(0, baseLine - CARD_BOUNDS.LOOK_UP_LINES); i--) {
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
            for (let i = baseLine + 1; i <= Math.min(editor.lineCount() - 1, baseLine + CARD_BOUNDS.LOOK_DOWN_LINES); i++) {
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

        // Собираем текст карточки для парсинга (запас вниз 20 строк)
        const maxLookForward = Math.min(editor.lineCount() - 1, startLine + CARD_BOUNDS.LOOK_FORWARD_LINES);
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

    async downloadAndSaveImage(url: string, baseFilename: string, sourcePath: string): Promise<TFile | null> {
        return await this.context.imageService.downloadAndSave(url, baseFilename, sourcePath);
    }

    async replaceWithOpenGraph(editor: Editor, view: MarkdownView, urlInfo: UrlInfo, userText: string = '') {
        new Notice(t('loading'));

        try {
            // Получаем подходящий парсер для URL
            const ogParser = parserRegistry.getParser(urlInfo.url);

            // Получаем заголовки от парсера
            const headers = ogParser.getHeaders();

            const html = await this.context.fetchService.fetchHtml(urlInfo.url, headers);

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
                    const imgFile = await this.downloadAndSaveImage(image, 'og-image', sourcePath);
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
                        this.downloadAndSaveImage(s.originalUrl, `screenshot-${index}`, sourcePath)
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

            // Регистрируем карточку в FileLinkService
            this.context.fileLinkService.registerCard(cardId.toString(), sourcePath);

            // Добавляем изображения в связи
            if (imageData?.src && this.settings.saveImagesLocally) {
                this.context.fileLinkService.addImage(cardId.toString(), imageData.src);
            }
            if (screenshotData) {
                for (const s of screenshotData) {
                    if (s.localPath) {
                        this.context.fileLinkService.addImage(cardId.toString(), s.localPath);
                    }
                }
            }

            // Синхронизируем заметку с изображениями если есть локальные изображения
            if (this.settings.saveImagesLocally) {
                await this.context.imageNotesService.syncNote(cardId.toString(), htmlBlock);
            }

            // Триггерим событие о создании карточки
            this.app.workspace.trigger('og-card-created' as any, {
                cardId: cardId.toString(),
                userNotePath: sourcePath
            });
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
