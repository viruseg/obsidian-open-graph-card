import { App, Modal, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { t } from '../../i18n';
import { OpenGraphSettings } from '../types';
import { ScriptService } from '../services/ScriptService';

interface SettingsTabCallbacks {
    saveSettings: () => Promise<void>;
    onScriptEngineSettingsChanged: () => void;
}

class ScriptEditorModal extends Modal {
    private readonly scriptId: string;
    private readonly scriptService: ScriptService;
    private readonly onSaved: () => Promise<void>;
    private textarea!: HTMLTextAreaElement;

    constructor(app: App, scriptId: string, scriptService: ScriptService, onSaved: () => Promise<void>) {
        super(app);
        this.scriptId = scriptId;
        this.scriptService = scriptService;
        this.onSaved = onSaved;
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: t('scriptEditTitle') });

        this.textarea = contentEl.createEl('textarea', {
            attr: {
                style: 'width: 100%; min-height: 420px; font-family: var(--font-monospace);'
            }
        });

        try {
            this.textarea.value = await this.scriptService.readScriptContent(this.scriptId);
        } catch (error) {
            console.error('[OG Scripts]', error);
            new Notice(t('scriptReadError'));
            this.close();
            return;
        }

        const buttonRow = contentEl.createDiv({
            attr: {
                style: 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;'
            }
        });

        const saveButton = buttonRow.createEl('button', {
            text: t('save'),
            cls: 'mod-cta'
        });
        const cancelButton = buttonRow.createEl('button', { text: t('cancel') });

        saveButton.onclick = async () => {
            try {
                await this.scriptService.updateScriptContent(this.scriptId, this.textarea.value);
                await this.onSaved();
                new Notice(t('scriptSaved'));
                this.close();
            } catch (error) {
                console.error('[OG Scripts]', error);
                new Notice(t('scriptSaveError'));
            }
        };
        cancelButton.onclick = () => this.close();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

export class SettingsTab extends PluginSettingTab {
    private readonly settings: OpenGraphSettings;
    private readonly scriptService: ScriptService;
    private readonly callbacks: SettingsTabCallbacks;

    constructor(
        app: App,
        plugin: Plugin,
        settings: OpenGraphSettings,
        scriptService: ScriptService,
        callbacks: SettingsTabCallbacks
    ) {
        super(app, plugin);
        this.settings = settings;
        this.scriptService = scriptService;
        this.callbacks = callbacks;
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
                    await this.callbacks.saveSettings();
                }));

        containerEl.createEl('h3', { text: t('scriptEngineTitle') });

        new Setting(containerEl)
            .setName(t('hashWatchEnabledName'))
            .setDesc(t('hashWatchEnabledDesc'))
            .addToggle(toggle => toggle
                .setValue(this.settings.scriptEngine.hashWatchEnabled)
                .onChange(async (value) => {
                    this.settings.scriptEngine.hashWatchEnabled = value;
                    await this.callbacks.saveSettings();
                    this.callbacks.onScriptEngineSettingsChanged();
                }));

        new Setting(containerEl)
            .setName(t('hashWatchIntervalName'))
            .setDesc(t('hashWatchIntervalDesc'))
            .addText(text => text
                .setPlaceholder('60')
                .setValue(String(this.settings.scriptEngine.hashWatchIntervalSec))
                .onChange(async (value) => {
                    const parsed = Number.parseInt(value, 10);
                    this.settings.scriptEngine.hashWatchIntervalSec = Number.isFinite(parsed) ? parsed : 60;
                    await this.callbacks.saveSettings();
                    this.callbacks.onScriptEngineSettingsChanged();
                }));

        new Setting(containerEl)
            .setName(t('globalAutoUpdateName'))
            .setDesc(t('globalAutoUpdateDesc'))
            .addToggle(toggle => toggle
                .setValue(this.settings.scriptEngine.globalAutoUpdateEnabled)
                .onChange(async (value) => {
                    this.settings.scriptEngine.globalAutoUpdateEnabled = value;
                    await this.callbacks.saveSettings();
                    this.callbacks.onScriptEngineSettingsChanged();
                }));

        new Setting(containerEl)
            .setName(t('autoUpdateOnStartupName'))
            .setDesc(t('autoUpdateOnStartupDesc'))
            .addToggle(toggle => toggle
                .setValue(this.settings.scriptEngine.autoUpdateOnStartup)
                .onChange(async (value) => {
                    this.settings.scriptEngine.autoUpdateOnStartup = value;
                    await this.callbacks.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('autoUpdateIntervalName'))
            .setDesc(t('autoUpdateIntervalDesc'))
            .addText(text => text
                .setPlaceholder('3600')
                .setValue(String(this.settings.scriptEngine.autoUpdateIntervalSec))
                .onChange(async (value) => {
                    const parsed = Number.parseInt(value, 10);
                    this.settings.scriptEngine.autoUpdateIntervalSec = Number.isFinite(parsed) ? parsed : 3600;
                    await this.callbacks.saveSettings();
                    this.callbacks.onScriptEngineSettingsChanged();
                }));

        containerEl.createEl('h3', { text: t('scriptsTitle') });
        this.renderScriptInstaller(containerEl);
        this.renderScriptsList(containerEl);
    }

    private renderScriptInstaller(containerEl: HTMLElement): void {
        let scriptUrl = '';

        new Setting(containerEl)
            .setName(t('scriptUrlName'))
            .setDesc(t('scriptUrlDesc'))
            .addText(text => text
                .setPlaceholder('https://example.com/script.js')
                .onChange(value => {
                    scriptUrl = value.trim();
                }))
            .addButton(button => button
                .setButtonText(t('scriptDownloadButton'))
                .setCta()
                .onClick(async () => {
                    if (!scriptUrl) {
                        new Notice(t('scriptUrlRequired'));
                        return;
                    }

                    try {
                        await this.scriptService.installFromUrl(scriptUrl);
                        await this.callbacks.saveSettings();
                        new Notice(t('scriptInstalled'));
                        this.display();
                    } catch (error) {
                        console.error('[OG Scripts]', error);
                        new Notice(t('scriptInstallError'));
                    }
                }));

        new Setting(containerEl)
            .setName(t('scriptsUpdateAllName'))
            .setDesc(t('scriptsUpdateAllDesc'))
            .addButton(button => button
                .setButtonText(t('scriptsUpdateAllButton'))
                .onClick(async () => {
                    await this.scriptService.updateAllScriptsManually();
                    await this.callbacks.saveSettings();
                    this.display();
                }));
    }

    private renderScriptsList(containerEl: HTMLElement): void {
        if (this.settings.scripts.length === 0) {
            containerEl.createEl('p', { text: t('scriptsEmpty') });
            return;
        }

        for (const script of this.settings.scripts) {
            const scriptContainer = containerEl.createDiv('og-script-settings-item');
            scriptContainer.createEl('h4', {
                text: `${script.name} ${script.version}`
            });
            scriptContainer.createEl('p', { text: `${t('scriptAuthorLabel')}: ${script.author}` });
            scriptContainer.createEl('p', { text: `${t('scriptDomainsLabel')}: ${script.domains.join(', ')}` });

            new Setting(scriptContainer)
                .setName(t('scriptEnabledName'))
                .addToggle(toggle => toggle
                    .setValue(script.enabled)
                    .onChange(async (value) => {
                        await this.scriptService.toggleScriptEnabled(script.id, value);
                        await this.callbacks.saveSettings();
                        this.display();
                    }));

            new Setting(scriptContainer)
                .setName(t('scriptAutoUpdateName'))
                .setDesc(t('scriptAutoUpdateDesc'))
                .addToggle(toggle => toggle
                    .setValue(script.autoUpdate)
                    .onChange(async (value) => {
                        await this.scriptService.setScriptAutoUpdate(script.id, value);
                        await this.callbacks.saveSettings();
                    }));

            new Setting(scriptContainer)
                .addButton(button => button
                    .setButtonText(t('scriptUpdateButton'))
                    .onClick(async () => {
                        try {
                            await this.scriptService.updateScript(script.id);
                            await this.callbacks.saveSettings();
                            this.display();
                        } catch (error) {
                            console.error('[OG Scripts]', error);
                            new Notice(t('scriptUpdateError', script.name));
                        }
                    }))
                .addButton(button => button
                    .setButtonText(t('scriptViewButton'))
                    .onClick(() => {
                        new ScriptEditorModal(this.app, script.id, this.scriptService, async () => {
                            await this.callbacks.saveSettings();
                            this.display();
                        }).open();
                    }))
                .addButton(button => button
                    .setWarning()
                    .setButtonText(t('scriptRemoveButton'))
                    .onClick(async () => {
                        await this.scriptService.removeScript(script.id);
                        await this.callbacks.saveSettings();
                        this.display();
                    }));
        }
    }
}
