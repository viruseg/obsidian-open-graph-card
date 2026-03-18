import { EventRef, Menu, Editor, MarkdownView, Notice } from 'obsidian';
import { PluginContext } from '../core/PluginContext';
import { getUrlUnderCursor } from '../utils/editor';
import { extractCardId } from '../utils/html';
import { generateCardId } from '../utils/id';
import { t } from '../../i18n';
import { CardDescriptionModal } from './modals/CardDescriptionModal';
import { CardInfo, UrlInfo, ContextMenuHandlerCallbacks } from '../types';

export class ContextMenuHandler {
    private lastContextEventTarget: HTMLElement | null = null;

    constructor(
        private context: PluginContext,
        private callbacks: ContextMenuHandlerCallbacks
    ) {}

    setLastContextEventTarget(target: HTMLElement | null): void {
        this.lastContextEventTarget = target;
    }

    createHandler(): EventRef {
        return this.context.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
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

            const cardInfo = this.callbacks.getCardUnderCursor(editor, targetLine);

            if (cardInfo) {
                this.addCardMenuItems(menu, editor, view, cardInfo);
            } else {
                this.addUrlMenuItems(menu, editor, view);
            }
        });
    }

    private addCardMenuItems(menu: Menu, editor: Editor, view: MarkdownView, cardInfo: CardInfo): void {
        // --- Пункт меню "Обновить карточку" ---
        menu.addItem((item) => {
            item
                .setTitle(t('updateCard'))
                .setIcon('sync')
                .onClick(async () => {
                    // Получаем HTML карточки до обновления
                    const cardHtml = editor.getRange(cardInfo.from, cardInfo.to);
                    // Извлекаем card-id для удаления заметки
                    const cardId = extractCardId(cardHtml);
                    // Очищаем локальные изображения
                    await this.context.imageService.cleanupCardImages(cardHtml);
                    // Удаляем заметку с изображениями
                    if (cardId) {
                        await this.context.imageNotesService.deleteNote(cardId);
                    }
                    // Создаём новую карточку
                    await this.callbacks.replaceWithOpenGraph(editor, view, { url: cardInfo.url, from: cardInfo.from, to: cardInfo.to }, cardInfo.userText);
                });
        });

        // --- Пункт меню "Удалить карточку" ---
        menu.addItem((item) => {
            item
                .setTitle(t('removeCard'))
                .setIcon('trash')
                .onClick(async () => {
                    // Получаем HTML карточки до удаления
                    const cardHtml = editor.getRange(cardInfo.from, cardInfo.to);
                    // Извлекаем card-id для удаления заметки
                    const cardId = extractCardId(cardHtml);
                    // Очищаем локальные изображения (в массовой операции для предотвращения ENOENT)
                    this.context.fileLinkService.startBatchOperation();
                    try {
                        await this.context.imageService.cleanupCardImages(cardHtml);
                    } finally {
                        this.context.fileLinkService.endBatchOperation();
                    }
                    // Удаляем заметку с изображениями (только если она пустая)
                    if (cardId) {
                        await this.context.imageNotesService.deleteNote(cardId);
                    }
                    // Заменяем карточку на URL
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
                        this.context.app,
                        cardInfo.userText,
                        async (newText) => {
                            await this.callbacks.updateCardUserText(editor, cardInfo, newText);
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
                    this.callbacks.toggleCardOrientation(editor, cardInfo);
                });
        });

        // --- Пункты меню для работы с изображениями ---
        this.addImageMenuItems(menu, editor, view, cardInfo, cardHtml);
    }

    private addUrlMenuItems(menu: Menu, editor: Editor, view: MarkdownView): void {
        const urlInfo = getUrlUnderCursor(editor);

        if (urlInfo) {
            menu.addItem((item) => {
                item
                    .setTitle(t('loadCard'))
                    .setIcon('link')
                    .onClick(async () => {
                        await this.callbacks.replaceWithOpenGraph(editor, view, urlInfo);
                    });
            });
        }

        // --- Логика для ссылки в буфере обмена ---
        this.addClipboardMenuItems(menu, editor, view);
    }

    private addClipboardMenuItems(menu: Menu, editor: Editor, view: MarkdownView): void {
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
                            await this.callbacks.replaceWithOpenGraph(editor, view, { url: clipboardText, from, to });
                        });
                });
            }
        } catch (e) {
            console.error('Clipboard access error', e);
        }
    }

    /**
     * Добавляет пункты меню для работы с изображениями
     */
    private addImageMenuItems(
        menu: Menu,
        editor: Editor,
        view: MarkdownView,
        cardInfo: CardInfo,
        cardHtml: string
    ): void {
        const classification = this.context.imageService.classifyCardImageSources(cardHtml);

        menu.addSeparator();

        // Пункт "Загрузить изображения" - показываем только если есть URL изображения
        if (classification.hasUrlImages) {
            menu.addItem((item) => {
                item
                    .setTitle(t('downloadCardImages'))
                    .setIcon('download')
                    .onClick(async () => {
                        await this.handleDownloadImages(editor, view, cardInfo, cardHtml);
                    });
            });
        }

        // Пункт "Восстановить изображения" - показываем только если есть локальные изображения
        if (classification.hasLocalImages) {
            menu.addItem((item) => {
                item
                    .setTitle(t('restoreCardImages'))
                    .setIcon('upload')
                    .onClick(async () => {
                        await this.handleRestoreImages(editor, cardInfo, cardHtml);
                    });
            });
        }
    }

    /**
     * Обработчик скачивания изображений карточки
     */
    private async handleDownloadImages(
        editor: Editor,
        view: MarkdownView,
        cardInfo: CardInfo,
        cardHtml: string
    ): Promise<void> {
        const notice = new Notice(t('downloadingCardImages'), 0);

        try {
            const extractedCardId = extractCardId(cardHtml);
            const cardId = extractedCardId || generateCardId();
            const sourcePath = view.file?.path || '';

            // Проверяем, зарегистрирована ли карточка
            const existingCardLinks = this.context.fileLinkService.getCardLinks(cardId);
            const isRegistered = !!existingCardLinks;

            const { result, updatedHtml } = await this.context.imageService.downloadCardImages(
                cardHtml,
                cardId,
                sourcePath
            );

            if (result.downloadedCount > 0) {
                editor.replaceRange(updatedHtml, cardInfo.from, cardInfo.to);

                // Регистрируем карточку в FileLinkService если она ещё не зарегистрирована
                // Это должно происходить ДО вызова syncNote, т.к. syncNote вызывает setGeneratedNote и addImage
                if (!isRegistered) {
                    this.context.fileLinkService.registerCard(cardId, sourcePath);
                }

                // Синхронизируем заметку с изображениями
                // syncNote сам вызовет setGeneratedNote и addImage для каждого изображения
                await this.context.imageNotesService.syncNote(cardId, updatedHtml);

                // Триггерим событие о скачивании изображений
                const localImagePaths = this.extractLocalImagePaths(updatedHtml, cardId);
                this.context.app.workspace.trigger('og-card-images-downloaded' as any, {
                    cardId,
                    imagePaths: localImagePaths
                });

                new Notice(t('imagesDownloaded', result.downloadedCount.toString()));
            } else {
                new Notice(t('noImagesToDownload'));
            }

            if (result.errors.length > 0) {
                console.error('Image download errors:', result.errors);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            new Notice(t('loadingError', errorMsg));
        } finally {
            notice.hide();
        }
    }

    /**
     * Обработчик восстановления URL изображений
     */
    private async handleRestoreImages(
        editor: Editor,
        cardInfo: CardInfo,
        cardHtml: string
    ): Promise<void> {
        const notice = new Notice(t('restoringCardImages'), 0);

        try {
            const cardId = extractCardId(cardHtml);

            // Начинаем массовую операцию (предотвращает обработку событий удаления отдельных изображений)
            this.context.fileLinkService.startBatchOperation();

            let result;
            let updatedHtml: string;
            try {
                const restoreResult = await this.context.imageService.restoreCardImages(cardHtml, cardId || '');
                result = restoreResult.result;
                updatedHtml = restoreResult.updatedHtml;
            } finally {
                // Завершаем массовую операцию
                this.context.fileLinkService.endBatchOperation();
            }

            if (result.restoredCount > 0) {
                editor.replaceRange(updatedHtml, cardInfo.from, cardInfo.to);

                // Синхронизируем заметку с изображениями
                // syncNote удалит заметку, т.к. локальных изображений больше нет
                // При удалении заметки сработает событие og-card:generated-note-deleted,
                // которое вызовет unregisterCard и очистит все связи
                if (cardId) {
                    await this.context.imageNotesService.syncNote(cardId, updatedHtml);
                }

                // Триггерим событие о восстановлении URL
                this.context.app.workspace.trigger('og-card-images-restored' as any, {
                    cardId,
                    restoredCount: result.restoredCount
                });

                new Notice(t('imagesRestored', result.restoredCount.toString()));
            } else {
                new Notice(t('noImagesToRestore'));
            }

            if (result.errors.length > 0) {
                console.error('Image restore errors:', result.errors);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            new Notice(t('loadingError', errorMsg));
        } finally {
            notice.hide();
        }
    }

    /**
     * Извлекает пути локальных изображений из HTML карточки
     */
    private extractLocalImagePaths(cardHtml: string, cardId: string): string[] {
        const paths: string[] = [];
        const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
        let match;

        while ((match = imgRegex.exec(cardHtml)) !== null) {
            const src = match[1];
            // Локальные пути не начинаются с http:// или https://
            if (src && !src.startsWith('http://') && !src.startsWith('https://')) {
                paths.push(src);
            }
        }

        return paths;
    }
}
