import { App } from 'obsidian';
import { OpenGraphSettings } from '../types';
import { FetchService } from '../services/FetchService';
import { ImageService } from '../services/ImageService';

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

    constructor(app: App, getSettings: () => OpenGraphSettings) {
        this.app = app;
        this.getSettings = getSettings;

        // Инициализация сервисов
        this.fetchService = new FetchService(getSettings);
        this.imageService = new ImageService(app, this.fetchService);
    }
}
