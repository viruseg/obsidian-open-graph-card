import { App } from 'obsidian';
import { OpenGraphSettings, FileLinksData } from '../types';
import { FetchService } from '../services/FetchService';
import { ImageService } from '../services/ImageService';
import { ImageNotesService } from '../services/ImageNotesService';
import { FileLinkService } from '../services/FileLinkService';
import { CardCopyService } from '../services/CardCopyService';
import { IntegrityService } from '../services/IntegrityService';
import { RequestHeadersProvider } from '../services/RequestHeadersProvider';
import { ScriptService } from '../services/ScriptService';

interface PluginContextOverrides {
    fetchService?: FetchService;
    imageService?: ImageService;
    imageNotesService?: ImageNotesService;
    fileLinkService?: FileLinkService;
    cardCopyService?: CardCopyService;
    integrityService?: IntegrityService;
    scriptService?: ScriptService;
}

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

    /** Провайдер заголовков HTTP-запросов */
    readonly requestHeadersProvider: RequestHeadersProvider;

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

    /** Сервис пользовательских OpenGraphCardScript скриптов */
    readonly scriptService: ScriptService;

    constructor(
        app: App,
        pluginId: string,
        getSettings: () => OpenGraphSettings,
        getFileLinksData: () => FileLinksData,
        saveSettings: () => Promise<void>,
        saveFileLinksData: () => Promise<void>,
        overrides: PluginContextOverrides = {}
    ) {
        this.app = app;
        this.getSettings = getSettings;

        // Инициализация сервисов
        this.requestHeadersProvider = new RequestHeadersProvider();
        this.fetchService = overrides.fetchService ?? new FetchService(this.requestHeadersProvider);
        this.fileLinkService = overrides.fileLinkService ?? new FileLinkService(app, getFileLinksData, saveFileLinksData);
        this.imageService = overrides.imageService ?? new ImageService(app, this.fetchService);

        // Устанавливаем FileLinkService в ImageService для проверки ссылок
        this.imageService.setFileLinkService(this.fileLinkService);

        this.imageNotesService = overrides.imageNotesService ?? new ImageNotesService(app, this.imageService, this.fileLinkService);

        // Инициализация новых сервисов
        this.cardCopyService = overrides.cardCopyService ?? new CardCopyService(
            app,
            this.fileLinkService,
            this.imageService,
            this.imageNotesService
        );
        this.integrityService = overrides.integrityService ?? new IntegrityService(app, this.fileLinkService);
        this.scriptService = overrides.scriptService ?? new ScriptService(
            app,
            pluginId,
            getSettings,
            saveSettings
        );
    }
}
