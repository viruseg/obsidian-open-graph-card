import { Plugin, Editor, MarkdownView, Notice, TFile, TAbstractFile, sanitizeHTMLToDom } from 'obsidian';
import { t } from "./i18n";
import {
    OpenGraphSettings,
    DEFAULT_SETTINGS,
    FileLinksData,
    FileDeletedEventData,
    FileRenamedEventData,
    UserNoteEventData,
    CardInfo,
    UrlInfo,
    ImageData,
    CardData,
    OpenGraphCardScriptResultBlock
} from './src/types';
import { PluginContext } from './src/core/PluginContext';
import { PluginDataRepository } from './src/services/PluginDataRepository';
import { parserRegistry } from './src/parsers';
import { ContextMenuHandler } from './src/ui';
import { SettingsTab } from './src/ui';
import { HtmlBuilder } from './src/builders';
import { CARD_BOUNDS } from './src/utils/constants';
import {
    extractCardId,
    getImageDataUrlsFromCard,
    replaceImageInCard,
    extractUrl,
    extractUserText,
    toggleCardOrientation as toggleOrientation,
    updateUserText,
    parseCardHtml,
    serializeCard,
    injectCustomBlocksIntoCard
} from './src/utils/html';
import { generateCardId } from './src/utils/id';

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
    private dataRepository!: PluginDataRepository;

    async onload() {
        this.dataRepository = new PluginDataRepository(
            this.loadData.bind(this),
            this.saveData.bind(this)
        );

        await this.loadSettings();
        await this.loadFileLinksData();

        // Инициализация контекста с сервисами
        this.context = new PluginContext(
            this.app,
            this.manifest.id,
            () => this.settings,
            () => this.fileLinksData,
            this.saveSettings.bind(this),
            this.saveFileLinksData.bind(this)
        );

        // Инициализация FileLinkService
        this.context.fileLinkService.initialize();

        // Инициализация CardCopyService
        this.context.cardCopyService.initialize();

        // Инициализация движка пользовательских скриптов
        await this.context.scriptService.initialize();

        // Запуск проверки целостности через 10 секунд
        this.context.integrityService.scheduleCheck();

        // Подписка на события FileLinkService
        this.registerFileLinkEvents();

        // Инициализация обработчика контекстного меню
        this.contextMenuHandler = new ContextMenuHandler(this.context, {
            getCardUnderCursor: this.getCardUnderCursor.bind(this),
            replaceWithOpenGraph: this.replaceWithOpenGraph.bind(this),
            updateCardUserText: this.updateCardUserText.bind(this),
            toggleCardOrientation: this.toggleCardOrientation.bind(this)
        });

        this.addSettingTab(new SettingsTab(
            this.app,
            this,
            this.settings,
            this.context.scriptService,
            {
                saveSettings: this.saveSettings.bind(this),
                onScriptEngineSettingsChanged: () => {
                    this.context.scriptService.restartTimers();
                }
            }
        ));

        // Отслеживаем глобальный клик ПКМ, чтобы поймать целевой DOM элемент ДО рендера контекстного меню
        this.registerDomEvent(document, 'contextmenu', (e: MouseEvent) => {
            this.contextMenuHandler.setLastContextEventTarget(e.target as HTMLElement);
        }, { capture: true });

        // Регистрируем обработчик контекстного меню
        this.registerEvent(this.contextMenuHandler.createHandler());
    }

    onunload() {
        // Освобождаем ресурсы CardCopyService
        if (this.context?.cardCopyService) {
            this.context.cardCopyService.destroy();
        }

        // Освобождаем ресурсы FileLinkService
        if (this.context?.fileLinkService) {
            this.context.fileLinkService.dispose();
        }

        // Освобождаем ресурсы ScriptService
        if (this.context?.scriptService) {
            this.context.scriptService.dispose();
        }
    }

    async loadSettings() {
        this.settings = await this.dataRepository.loadSettings(DEFAULT_SETTINGS);
    }

    async saveSettings() {
        await this.dataRepository.saveSettings(this.settings);
    }

    /**
     * Загружает данные связей файлов из data.json
     */
    private async loadFileLinksData(): Promise<void> {
        const fileLinks = await this.dataRepository.loadFileLinks();
        if (fileLinks) {
            // Миграция: если fileLinks содержит карточки напрямую (без cardLinks)
            let cardLinks: Record<string, any> = {};
            if (fileLinks.cardLinks) {
                // Новый формат
                cardLinks = fileLinks.cardLinks;
            } else {
                // Старый формат - карточки напрямую в fileLinks
                // Проверяем есть ли поля которые выглядят как cardId (начинаются с og_)
                for (const key of Object.keys(fileLinks)) {
                    if (key.startsWith('og_')) {
                        cardLinks[key] = fileLinks[key];
                    }
                }
            }

            this.fileLinksData = {
                version: fileLinks.version ?? 1,
                cardLinks: cardLinks
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
        await this.dataRepository.saveFileLinks({
            version: 1,
            cardLinks: this.context?.fileLinkService?.getSerializedData() ?? {}
        });
    }

    /**
     * Подписывается на кастомные события от FileLinkService
     */
    private registerFileLinkEvents(): void {
        // Событие удаления одной пользовательской заметки (но есть другие)
        this.registerEvent((this.app.workspace as any).on('og-card:user-note-removed', (data: UserNoteEventData) => {
            this.handleUserNoteRemoved(data);
        }));

        // Событие удаления последней пользовательской заметки
        this.registerEvent((this.app.workspace as any).on('og-card:last-user-note-deleted', (data: UserNoteEventData) => {
            this.handleLastUserNoteDeleted(data);
        }));

        // Событие удаления сгенерированной заметки
        this.registerEvent((this.app.workspace as any).on('og-card:generated-note-deleted', (data: FileDeletedEventData) => {
            this.handleGeneratedNoteDeleted(data);
        }));

        // Событие удаления изображения
        this.registerEvent((this.app.workspace as any).on('og-card:image-deleted', (data: FileDeletedEventData) => {
            this.handleImageDeleted(data);
        }));

        // Событие переименования файла
        this.registerEvent((this.app.workspace as any).on('og-card:file-renamed', (data: FileRenamedEventData) => {
            this.handleFileRenamed(data);
        }));
    }

    /**
     * Обрабатывает удаление одной пользовательской заметки (но есть другие)
     */
    private async handleUserNoteRemoved(data: UserNoteEventData): Promise<void> {
        console.log(`[OpenGraphPlugin] User note removed: ${data.notePath}, remaining: ${data.allNotePaths.length}`);
        // Ничего не делаем - карточка остаётся в других заметках
    }

    /**
     * Обрабатывает удаление последней пользовательской заметки
     */
    private async handleLastUserNoteDeleted(data: UserNoteEventData): Promise<void> {
        console.log(`[OpenGraphPlugin] Last user note deleted for card: ${data.cardId}`);

        // Удаляем сгенерированную заметку
        await this.context.imageNotesService.deleteNote(data.cardId);

        // Удаляем карточку из реестра и получаем изображения без ссылок
        const orphanedImages = this.context.fileLinkService.unregisterCard(data.cardId);

        // Удаляем только изображения, на которые нет ссылок от других карточек
        if (orphanedImages.length > 0) {
            await this.context.imageService.deleteLocalImages(orphanedImages);
        }
    }

    /**
     * Обрабатывает удаление сгенерированной заметки
     */
    private async handleGeneratedNoteDeleted(data: FileDeletedEventData): Promise<void> {
        // Удаляем карточку из реестра и получаем изображения без ссылок
        const orphanedImages = this.context.fileLinkService.unregisterCard(data.cardId);

        // Удаляем только изображения, на которые нет ссылок от других карточек
        for (const imagePath of orphanedImages) {
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
                // Проверяем существование файла перед чтением (защита от ENOENT при массовых операциях)
                if (!(await (this.app.vault.adapter as any).exists(genNoteFile.path))) {
                    console.log(`OpenGraphPlugin: Generated note no longer exists: ${data.cardLinks.generatedNotePath}`);
                    return;
                }
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
        const userNotePath = data.cardLinks.userNotePaths[0];
        if (!userNotePath) {
            return;
        }
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
        const baseLine = targetLine !== undefined ? targetLine : editor.getCursor().line;

        let startLine = -1;
        let cardId: string | null = null;

        for (let i = baseLine; i >= Math.max(0, baseLine - CARD_BOUNDS.LOOK_UP_LINES); i--) {
            const lineText = editor.getLine(i);
            if (lineText.includes('<div class="og-card')) {
                startLine = i;
                const cardIdMatch = lineText.match(/<div class="og-card[^"]*"\s+card-id="([^"]+)"/);
                if (cardIdMatch) {
                    cardId = cardIdMatch[1];
                }
                break;
            }
        }

        if (startLine === -1) {
            for (let i = baseLine + 1; i <= Math.min(editor.lineCount() - 1, baseLine + CARD_BOUNDS.LOOK_DOWN_LINES); i++) {
                const lineText = editor.getLine(i);
                if (lineText.includes('<div class="og-card')) {
                    startLine = i;
                    const cardIdMatch = lineText.match(/<div class="og-card[^"]*"\s+card-id="([^"]+)"/);
                    if (cardIdMatch) {
                        cardId = cardIdMatch[1];
                    }
                    break;
                }
            }
        }

        if (startLine === -1) return null;

        const maxLookForward = Math.min(editor.lineCount() - 1, startLine + CARD_BOUNDS.LOOK_FORWARD_LINES);
        const lines: string[] =[];
        for (let i = startLine; i <= maxLookForward; i++) {
            lines.push(editor.getLine(i));
        }
        const htmlStr = lines.join('\n');

        let endRegex = new RegExp(`(?:<|\\\\x3C)!--og-card-end ${cardId}-->(?:\\s*)<\\/div>`, 'i');
        const endMatch = htmlStr.match(endRegex);

        if (!endMatch) return null;

        const fullCardHtml = htmlStr.substring(0, endMatch.index! + endMatch[0].length);
        const matchedLines = fullCardHtml.split('\n');
        const endLine = startLine + matchedLines.length - 1;

        if (targetLine === undefined) {
            const cursorLine = editor.getCursor().line;
            if (cursorLine < startLine || cursorLine > endLine) {
                return null;
            }
        }

        const endCh = matchedLines[matchedLines.length - 1].length;

        const url = extractUrl(fullCardHtml);
        if (!url) return null;

        const userText = extractUserText(fullCardHtml);

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
            const selectedScript = this.context.scriptService.getMatchingScript(urlInfo.url);
            const headers: Record<string, string> = {};
            if (selectedScript) {
                const cookie = this.context.scriptService.getCookie(selectedScript.id, urlInfo.url);
                if (cookie.trim() !== '') {
                    headers.Cookie = cookie;
                }
            }

            const html = await this.context.fetchService.fetchHtml(urlInfo.url, headers);

            const domParser = new DOMParser();
            const doc = domParser.parseFromString(html, 'text/html');

            // Используем парсер по умолчанию для извлечения данных
            const ogParser = parserRegistry.getParser(urlInfo.url);
            const cardData = await ogParser.parse(doc, urlInfo.url);

            // Добавляем пользовательский текст
            cardData.userText = userText;

            let customBlocks: OpenGraphCardScriptResultBlock[] = [];
            if (selectedScript) {
                try {
                    customBlocks = await this.context.scriptService.processContent(selectedScript.id, urlInfo.url, html);
                } catch (error) {
                    console.error('[OG Scripts]', error);
                    new Notice(t('scriptRuntimeError', selectedScript.name));
                }
            }

            const sourcePath = view?.file?.path || '';

            let imageData: ImageData | undefined;
            if (cardData.image) {
                imageData = {
                    src: cardData.image,
                    originalUrl: cardData.image,
                    showDataUrl: false
                };
            }

            const cardId = generateCardId();
            const htmlBuilder = new HtmlBuilder(cardId);
            const includeCover = selectedScript ? selectedScript.cover : true;
            let htmlBlock = htmlBuilder.buildCard(cardData, imageData, includeCover);

            if (customBlocks.length > 0) {
                htmlBlock = injectCustomBlocksIntoCard(
                    htmlBlock,
                    customBlocks,
                    (blockHtml) => sanitizeHTMLToDom(blockHtml)
                );
            }

            if (this.settings.saveImagesLocally) {
                const downloadResult = await this.context.imageService.downloadCardImages(htmlBlock, cardId, sourcePath);
                htmlBlock = downloadResult.updatedHtml;

                if (downloadResult.result.downloadedCount > 0) {
                    new Notice(t('imagesDownloaded', downloadResult.result.downloadedCount.toString()));
                }

                for (const error of downloadResult.result.errors) {
                    console.error('[OG Plugin] Image download error:', error);
                }
            }

            editor.replaceRange(htmlBlock, urlInfo.from, urlInfo.to);
            editor.setCursor(urlInfo.from);
            new Notice(t('cardCreated'));

            this.context.fileLinkService.registerCard(cardId, sourcePath);

            if (this.settings.saveImagesLocally) {
                const imageDataUrls = getImageDataUrlsFromCard(htmlBlock);
                for (const img of imageDataUrls) {
                    if (img.dataUrl && !img.src.startsWith('http')) {
                        this.context.fileLinkService.addImage(cardId, img.src);
                    }
                }

                await this.context.imageNotesService.syncNote(cardId, htmlBlock);
            }

            (this.app.workspace as any).trigger('og-card-created', {
                cardId,
                userNotePath: sourcePath
            });
        } catch (error) {
            console.error(error);
            new Notice(t('loadingError', error.message));
        }
    }

    async updateCardUserText(editor: Editor, cardInfo: CardInfo, newText: string) {
        const cardHtml = editor.getRange(cardInfo.from, cardInfo.to);
        const cardId = extractCardId(cardHtml);

        const parsed = parseCardHtml(cardHtml);
        if (!parsed) {
            new Notice(t('cardEndMarkerNotFound'));
            return;
        }

        let newCardHtml: string;

        if (newText.trim() === '') {
            const existingUserText = parsed.card.querySelector('.og-user-text');
            if (existingUserText) {
                existingUserText.remove();
                newCardHtml = serializeCard(parsed.card);
            } else {
                return;
            }
        } else {
            const htmlBuilder = new HtmlBuilder(cardId || '0');
            const userTextBlock = htmlBuilder.buildUserText(newText);

            const existingUserText = parsed.card.querySelector('.og-user-text');
            if (existingUserText) {
                const tempDiv = parsed.doc.createElement('div');
                tempDiv.innerHTML = userTextBlock;
                const newUserTextNode = tempDiv.firstElementChild;
                if (newUserTextNode) {
                    existingUserText.replaceWith(newUserTextNode);
                }
                newCardHtml = serializeCard(parsed.card);
            } else {
                const contentDiv = parsed.card.querySelector('.og-content');
                if (contentDiv) {
                    const tempDiv = parsed.doc.createElement('div');
                    tempDiv.innerHTML = userTextBlock;
                    while (tempDiv.firstChild) {
                        contentDiv.appendChild(tempDiv.firstChild);
                    }
                }
                newCardHtml = serializeCard(parsed.card);
            }
        }

        editor.replaceRange(newCardHtml, cardInfo.from, cardInfo.to);
        editor.setCursor(cardInfo.from);
    }

    toggleCardOrientation(editor: Editor, cardInfo: CardInfo) {
        const cardHtml = editor.getRange(cardInfo.from, cardInfo.to);
        const newCardHtml = toggleOrientation(cardHtml);
        editor.replaceRange(newCardHtml, cardInfo.from, cardInfo.to);
        editor.setCursor(cardInfo.from);
    }
}
