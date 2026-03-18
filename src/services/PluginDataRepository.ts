import { FileLinksData, OpenGraphSettings } from '../types';

type DataLoader = () => Promise<any>;
type DataSaver = (data: any) => Promise<void>;

/**
 * Репозиторий для безопасной работы с data.json
 * Сохраняет настройки и fileLinks без взаимного затирания.
 */
export class PluginDataRepository {
    constructor(
        private readonly loadData: DataLoader,
        private readonly saveData: DataSaver
    ) {}

    /**
     * Загружает все данные плагина.
     */
    async loadAll(): Promise<Record<string, any>> {
        return (await this.loadData()) ?? {};
    }

    /**
     * Загружает настройки, ограничиваясь ключами defaults.
     */
    async loadSettings(defaults: OpenGraphSettings): Promise<OpenGraphSettings> {
        const data = await this.loadAll();
        const result: OpenGraphSettings = { ...defaults };

        for (const key of Object.keys(defaults) as Array<keyof OpenGraphSettings>) {
            if (key in data) {
                result[key] = data[key] as OpenGraphSettings[typeof key];
            }
        }

        return result;
    }

    /**
     * Сохраняет настройки, не затирая fileLinks.
     */
    async saveSettings(settings: OpenGraphSettings): Promise<void> {
        const data = await this.loadAll();
        const merged = {
            ...data,
            ...settings
        };
        await this.saveData(merged);
    }

    /**
     * Загружает секцию fileLinks из data.json.
     */
    async loadFileLinks(): Promise<any> {
        const data = await this.loadAll();
        return data.fileLinks ?? null;
    }

    /**
     * Сохраняет секцию fileLinks, не затирая настройки.
     */
    async saveFileLinks(fileLinks: FileLinksData): Promise<void> {
        const data = await this.loadAll();
        data.fileLinks = fileLinks;
        await this.saveData(data);
    }
}
