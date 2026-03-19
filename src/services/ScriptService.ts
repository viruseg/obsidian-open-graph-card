import { App, Notice, requestUrl } from 'obsidian';
import {
    DomainRule,
    InstalledScriptSettings,
    OpenGraphCardScriptMetadata,
    OpenGraphCardScriptResultBlock,
    OpenGraphSettings
} from '../types';
import { generateCardId } from '../utils/id';
import { normalizeDomainRules, hasDomainCollision, matchesDomain } from '../utils/scriptDomains';
import { calculateScriptHash } from '../utils/scriptHash';
import { parseScriptMetadata } from '../utils/scriptMetadata';
import { ScriptRuntime } from './ScriptRuntime';
import { t } from '../../i18n';

type GetSettings = () => OpenGraphSettings;
type SaveSettings = () => Promise<void>;

interface ScriptMatch {
    script: InstalledScriptSettings;
    rules: DomainRule[];
}

/**
 * Сервис для управления пользовательскими OpenGraphCardScript скриптами.
 */
export class ScriptService {
    private static readonly HASH_WATCH_MIN_INTERVAL_SEC = 10;
    private static readonly AUTO_UPDATE_MIN_INTERVAL_SEC = 60;

    private runtime: ScriptRuntime;
    private hashWatchTimer: number | null = null;
    private autoUpdateTimer: number | null = null;

    constructor(
        private readonly app: App,
        private readonly pluginId: string,
        private readonly getSettings: GetSettings,
        private readonly saveSettings: SaveSettings
    ) {
        this.runtime = new ScriptRuntime(this.app);
    }

    async initialize(): Promise<void> {
        await this.ensureScriptsDirectory();
        await this.reloadEnabledScripts();

        const settings = this.getSettings();
        if (settings.scriptEngine.autoUpdateOnStartup) {
            await this.checkForUpdates();
        }

        await this.checkLocalFileChangesByHash();
        this.startTimers();
    }

    dispose(): void {
        this.stopTimers();
        this.runtime.unloadAll();
    }

    async installFromUrl(url: string): Promise<void> {
        const existingScript = this.getSettings().scripts.find(script => script.url === url);
        if (existingScript) {
            new Notice(t('scriptAlreadyInstalled'));
            return;
        }

        const scriptCode = await this.downloadScript(url);
        const metadata = parseScriptMetadata(scriptCode);
        const id = generateCardId();
        const localPath = `${this.getScriptsDirectoryPath()}/${id}.js`;
        const hash = await calculateScriptHash(scriptCode);

        await this.writeScriptFile(localPath, scriptCode);

        const script: InstalledScriptSettings = {
            id,
            url,
            name: metadata.name,
            version: metadata.version,
            author: metadata.author,
            localPath,
            autoUpdate: true,
            enabled: true,
            domains: metadata.domains,
            cover: metadata.cover,
            fileHash: hash
        };

        this.getSettings().scripts.push(script);
        this.applyCollisionPolicy(script.id);
        await this.saveSettings();
        await this.reloadEnabledScripts();
    }

    async removeScript(scriptId: string): Promise<void> {
        const settings = this.getSettings();
        const scriptIndex = settings.scripts.findIndex(script => script.id === scriptId);
        if (scriptIndex < 0) {
            return;
        }

        const [script] = settings.scripts.splice(scriptIndex, 1);
        this.runtime.unloadScript(scriptId);

        const adapter = this.app.vault.adapter as any;
        if (await adapter.exists(script.localPath)) {
            await adapter.remove(script.localPath);
        }

        await this.saveSettings();
    }

    async updateScript(scriptId: string): Promise<void> {
        const script = this.getSettings().scripts.find(item => item.id === scriptId);
        if (!script) {
            throw new Error(`Script ${scriptId} not found`);
        }

        await this.updateScriptFromRemote(script);
    }

    async updateAllScriptsManually(): Promise<void> {
        const scripts = [...this.getSettings().scripts];
        for (const script of scripts) {
            try {
                await this.updateScriptFromRemote(script);
            } catch (error) {
                console.error('[OG Scripts]', error);
                new Notice(t('scriptUpdateError', script.name));
            }
        }
    }

    async updateScriptContent(scriptId: string, scriptCode: string): Promise<void> {
        const script = this.getSettings().scripts.find(item => item.id === scriptId);
        if (!script) {
            throw new Error(`Script ${scriptId} not found`);
        }

        await this.applyScriptCode(script, scriptCode, null);
    }

    async toggleScriptEnabled(scriptId: string, enabled: boolean): Promise<void> {
        const script = this.getSettings().scripts.find(item => item.id === scriptId);
        if (!script) {
            return;
        }

        script.enabled = enabled;
        this.applyCollisionPolicy(script.id);
        await this.saveSettings();
        await this.reloadEnabledScripts();
    }

    async setScriptAutoUpdate(scriptId: string, autoUpdate: boolean): Promise<void> {
        const script = this.getSettings().scripts.find(item => item.id === scriptId);
        if (!script) {
            return;
        }

        script.autoUpdate = autoUpdate;
        await this.saveSettings();
    }

    async checkForUpdates(): Promise<void> {
        const settings = this.getSettings();
        if (!settings.scriptEngine.globalAutoUpdateEnabled) {
            return;
        }

        for (const script of settings.scripts) {
            if (!script.autoUpdate) {
                continue;
            }

            try {
                const remoteCode = await this.downloadScript(script.url);
                const remoteMetadata = parseScriptMetadata(remoteCode);
                const remoteHash = await calculateScriptHash(remoteCode);

                const hasVersionUpdate = compareVersions(remoteMetadata.version, script.version) > 0;
                const hasFileChanged = remoteHash !== script.fileHash;
                if (!hasVersionUpdate && !hasFileChanged) {
                    continue;
                }

                await this.applyScriptCode(script, remoteCode, remoteHash);
            } catch (error) {
                console.error('[OG Scripts]', error);
                new Notice(t('scriptUpdateError', script.name));
            }
        }
    }

    async checkLocalFileChangesByHash(): Promise<void> {
        const settings = this.getSettings();
        for (const script of settings.scripts) {
            try {
                const adapter = this.app.vault.adapter as any;
                if (!(await adapter.exists(script.localPath))) {
                    continue;
                }

                const scriptCode = await this.readScriptFile(script.localPath);
                const currentHash = await calculateScriptHash(scriptCode);
                if (currentHash === script.fileHash) {
                    continue;
                }

                await this.applyScriptCode(script, scriptCode, currentHash);
            } catch (error) {
                console.error('[OG Scripts]', error);
                new Notice(t('scriptHashChangeError', script.name));
            }
        }
    }

    getMatchingScript(url: string): InstalledScriptSettings | null {
        let hostname: string;
        try {
            hostname = new URL(url).hostname.toLowerCase();
        } catch {
            return null;
        }

        const matches: ScriptMatch[] = [];
        for (const script of this.getSettings().scripts) {
            if (!script.enabled) {
                continue;
            }

            let rules: DomainRule[];
            try {
                rules = normalizeDomainRules(script.domains);
            } catch {
                continue;
            }

            if (matchesDomain(rules, hostname)) {
                matches.push({ script, rules });
            }
        }

        if (matches.length > 1) {
            console.error('[OG Scripts] Multiple scripts matched same URL', url, matches.map(item => item.script.name));
            return null;
        }

        return matches.length === 1 ? matches[0].script : null;
    }

    getCookie(scriptId: string, url: string): string {
        return this.runtime.getCookie(scriptId, url);
    }

    async processContent(scriptId: string, url: string, htmlString: string): Promise<OpenGraphCardScriptResultBlock[]> {
        return this.runtime.processContent(scriptId, url, htmlString);
    }

    async readScriptContent(scriptId: string): Promise<string> {
        const script = this.getSettings().scripts.find(item => item.id === scriptId);
        if (!script) {
            throw new Error(`Script ${scriptId} not found`);
        }

        return this.readScriptFile(script.localPath);
    }

    private async reloadEnabledScripts(): Promise<void> {
        this.runtime.unloadAll();

        for (const script of this.getSettings().scripts) {
            if (!script.enabled) {
                continue;
            }

            try {
                await this.runtime.loadScript(script);
            } catch (error) {
                script.enabled = false;
                console.error('[OG Scripts]', error);
                new Notice(t('scriptRuntimeError', script.name));
            }
        }

        await this.saveSettings();
    }

    private applyCollisionPolicy(changedScriptId: string): void {
        const scripts = this.getSettings().scripts;
        const changedScript = scripts.find(script => script.id === changedScriptId);
        if (!changedScript) {
            return;
        }

        let changedRules: DomainRule[];
        try {
            changedRules = normalizeDomainRules(changedScript.domains);
        } catch {
            changedScript.enabled = false;
            return;
        }

        for (const script of scripts) {
            if (script.id === changedScript.id) {
                continue;
            }

            let candidateRules: DomainRule[];
            try {
                candidateRules = normalizeDomainRules(script.domains);
            } catch {
                script.enabled = false;
                continue;
            }

            if (!hasDomainCollision(changedRules, candidateRules)) {
                continue;
            }

            changedScript.enabled = false;
            script.enabled = false;
            new Notice(t('scriptCollisionNotice', changedScript.name, script.name));
        }
    }

    private async updateScriptFromRemote(script: InstalledScriptSettings): Promise<void> {
        const remoteCode = await this.downloadScript(script.url);
        await this.applyScriptCode(script, remoteCode, null);
    }

    private async applyScriptCode(
        script: InstalledScriptSettings,
        scriptCode: string,
        precomputedHash: string | null
    ): Promise<void> {
        const metadata = parseScriptMetadata(scriptCode);
        const fileHash = precomputedHash || await calculateScriptHash(scriptCode);

        await this.writeScriptFile(script.localPath, scriptCode);

        script.name = metadata.name;
        script.version = metadata.version;
        script.author = metadata.author;
        script.domains = metadata.domains;
        script.cover = metadata.cover;
        script.fileHash = fileHash;

        this.applyCollisionPolicy(script.id);
        await this.saveSettings();
        await this.reloadEnabledScripts();
    }

    private async downloadScript(url: string): Promise<string> {
        const response = await requestUrl({ url });
        return response.text;
    }

    private async ensureScriptsDirectory(): Promise<void> {
        const adapter = this.app.vault.adapter as any;
        const scriptsDir = this.getScriptsDirectoryPath();
        if (!(await adapter.exists(scriptsDir))) {
            await adapter.mkdir(scriptsDir);
        }
    }

    private async writeScriptFile(path: string, content: string): Promise<void> {
        const adapter = this.app.vault.adapter as any;
        await adapter.write(path, content);
    }

    private async readScriptFile(path: string): Promise<string> {
        const adapter = this.app.vault.adapter as any;
        return adapter.read(path);
    }

    private getScriptsDirectoryPath(): string {
        return `.obsidian/plugins/${this.pluginId}/scripts`;
    }

    private startTimers(): void {
        this.stopTimers();

        const settings = this.getSettings();
        const hashIntervalSec = Math.max(
            ScriptService.HASH_WATCH_MIN_INTERVAL_SEC,
            Number(settings.scriptEngine.hashWatchIntervalSec) || 60
        );

        if (settings.scriptEngine.hashWatchEnabled) {
            this.hashWatchTimer = window.setInterval(() => {
                this.checkLocalFileChangesByHash().catch(error => {
                    console.error('[OG Scripts]', error);
                });
            }, hashIntervalSec * 1000);
        }

        if (settings.scriptEngine.globalAutoUpdateEnabled && settings.scriptEngine.autoUpdateTimerEnabled) {
            const updateIntervalSec = Math.max(
                ScriptService.AUTO_UPDATE_MIN_INTERVAL_SEC,
                Number(settings.scriptEngine.autoUpdateIntervalSec) || 3600
            );
            this.autoUpdateTimer = window.setInterval(() => {
                this.checkForUpdates().catch(error => {
                    console.error('[OG Scripts]', error);
                });
            }, updateIntervalSec * 1000);
        }
    }

    restartTimers(): void {
        this.startTimers();
    }

    private stopTimers(): void {
        if (this.hashWatchTimer !== null) {
            window.clearInterval(this.hashWatchTimer);
            this.hashWatchTimer = null;
        }
        if (this.autoUpdateTimer !== null) {
            window.clearInterval(this.autoUpdateTimer);
            this.autoUpdateTimer = null;
        }
    }
}

function compareVersions(left: string, right: string): number {
    const leftParts = left.split('.').map(part => Number.parseInt(part, 10) || 0);
    const rightParts = right.split('.').map(part => Number.parseInt(part, 10) || 0);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let i = 0; i < length; i++) {
        const a = leftParts[i] ?? 0;
        const b = rightParts[i] ?? 0;
        if (a > b) {
            return 1;
        }
        if (a < b) {
            return -1;
        }
    }

    return 0;
}
