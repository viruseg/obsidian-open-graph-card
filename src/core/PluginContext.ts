import { App } from 'obsidian';
import { OpenGraphSettings } from '../types';
import { FetchService } from '../services/FetchService';
import { ImageService } from '../services/ImageService';
import { ImageNotesService } from '../services/ImageNotesService';

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

    constructor(app: App, getSettings: () => OpenGraphSettings) {
        this.app = app;
        this.getSettings = getSettings;

        // Инициализация сервисов
        this.fetchService = new FetchService(getSettings);
        this.imageService = new ImageService(app, this.fetchService);
        this.imageNotesService = new ImageNotesService(app, this.imageService);
    }
}
