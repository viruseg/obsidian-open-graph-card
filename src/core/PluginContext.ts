import { App } from 'obsidian';
import { OpenGraphSettings, FileLinksData } from '../types';
import { FetchService } from '../services/FetchService';
import { ImageService } from '../services/ImageService';
import { ImageNotesService } from '../services/ImageNotesService';
import { FileLinkService } from '../services/FileLinkService';
import { CardCopyService } from '../services/CardCopyService';
import { IntegrityService } from '../services/IntegrityService';

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

    /** Сервис для обнаружения и обработки копирования карточек */
    readonly cardCopyService: CardCopyService;

    /** Сервис для проверки целостности связей при запуске */
    readonly integrityService: IntegrityService;

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

        // Устанавливаем FileLinkService в ImageService для проверки ссылок
        this.imageService.setFileLinkService(this.fileLinkService);

        this.imageNotesService = new ImageNotesService(app, this.imageService, this.fileLinkService);

        // Инициализация новых сервисов
        this.cardCopyService = new CardCopyService(
            app,
            this.fileLinkService,
            this.imageService,
            this.imageNotesService
        );
        this.integrityService = new IntegrityService(
            app,
            this.fileLinkService,
            this.imageNotesService
        );
    }
}
