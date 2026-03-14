import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { t } from '../../i18n';
import { OpenGraphSettings } from '../types';

export class SettingsTab extends PluginSettingTab {
    private settings: OpenGraphSettings;
    private saveSettings: () => Promise<void>;

    constructor(app: App, plugin: Plugin, settings: OpenGraphSettings, saveSettings: () => Promise<void>) {
        super(app, plugin);
        this.settings = settings;
        this.saveSettings = saveSettings;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: t('settingsTitle') });

        new Setting(containerEl)
            .setName(t('saveImagesName'))
            .setDesc(t('saveImagesDesc'))
            .addToggle(toggle => toggle
                .setValue(this.settings.saveImagesLocally)
                .onChange(async (value) => {
                    this.settings.saveImagesLocally = value;
                    await this.saveSettings();
                }));
    }
}
