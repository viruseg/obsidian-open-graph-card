import { App } from 'obsidian';
import { OpenGraphSettings, FileLinksData } from '../types';
import { FetchService } from '../services/FetchService';
import { ImageService } from '../services/ImageService';
import { ImageNotesService } from '../services/ImageNotesService';
import { FileLinkService } from '../services/FileLinkService';

/**
 * Dependency Injection контейнер для сервисов плагина
 */
export class PluginContext {
    /** Экземпляр приложения Obsidian */
    readonly app: App;

    /** Функция для получения текущих настроек */
    readonly getSettings: () => OpenGraphSettings;

    /** Сервис для HTTP-запросов */
    readonly fetchService: FetchService;

    /** Сервис для работы с изображениями */
    readonly imageService: ImageService;

    /** Сервис для управления заметками с изображениями карточек */
    readonly imageNotesService: ImageNotesService;

    /** Сервис для отслеживания связей между файлами */
    readonly fileLinkService: FileLinkService;

    constructor(
        app: App,
        getSettings: () => OpenGraphSettings,
        getFileLinksData: () => FileLinksData,
        saveFileLinksData: () => Promise<void>
    ) {
        this.app = app;
        this.getSettings = getSettings;

        // Инициализация сервисов
        this.fetchService = new FetchService();
        this.imageService = new ImageService(app, this.fetchService);
        this.fileLinkService = new FileLinkService(app, getFileLinksData, saveFileLinksData);
        this.imageNotesService = new ImageNotesService(app, this.imageService, this.fileLinkService);
    }
}
