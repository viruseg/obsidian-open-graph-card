import { App } from 'obsidian';
import {
    InstalledScriptSettings,
    OpenGraphCardScriptModule,
    OpenGraphCardScriptResultBlock
} from '../types';

interface LoadedScriptRuntime {
    id: string;
    module: OpenGraphCardScriptModule;
}

/**
 * Выполняет пользовательские OpenGraphCardScript модули и управляет их CSS.
 */
export class ScriptRuntime {
    private loaded = new Map<string, LoadedScriptRuntime>();

    constructor(private readonly app: App) {}

    async loadScript(script: InstalledScriptSettings): Promise<void> {
        const code = await this.readScriptCode(script.localPath);
        const module = await this.importModuleFromCode(code);
        this.validateModule(module);

        this.injectStyle(script.id, module.cssStyles);
        this.loaded.set(script.id, {
            id: script.id,
            module
        });
    }

    async reloadScript(script: InstalledScriptSettings): Promise<void> {
        this.unloadScript(script.id);
        await this.loadScript(script);
    }

    unloadScript(scriptId: string): void {
        this.removeStyle(scriptId);
        this.loaded.delete(scriptId);
    }

    unloadAll(): void {
        const ids = Array.from(this.loaded.keys());
        for (const id of ids) {
            this.unloadScript(id);
        }
    }

    hasScriptLoaded(scriptId: string): boolean {
        return this.loaded.has(scriptId);
    }

    getCookie(scriptId: string, url: string): string {
        const loadedScript = this.loaded.get(scriptId);
        if (!loadedScript) {
            return '';
        }

        const result = loadedScript.module.getCookie(url);
        return typeof result === 'string' ? result : '';
    }

    async processContent(
        scriptId: string,
        url: string,
        htmlString: string
    ): Promise<OpenGraphCardScriptResultBlock[]> {
        const loadedScript = this.loaded.get(scriptId);
        if (!loadedScript) {
            throw new Error(`Script ${scriptId} is not loaded`);
        }

        const result = await loadedScript.module.processContent(url, htmlString);
        this.validateProcessResult(result);
        return result;
    }

    private async readScriptCode(localPath: string): Promise<string> {
        const adapter = this.app.vault.adapter as any;
        return adapter.read(localPath);
    }

    private async importModuleFromCode(code: string): Promise<OpenGraphCardScriptModule> {
        const blob = new Blob([code], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        try {
            return await import(/* webpackIgnore: true */ blobUrl) as OpenGraphCardScriptModule;
        } finally {
            URL.revokeObjectURL(blobUrl);
        }
    }

    private validateModule(module: OpenGraphCardScriptModule): void {
        if (!module || typeof module !== 'object') {
            throw new Error('Script module is invalid');
        }

        if (typeof module.processContent !== 'function') {
            throw new Error('Script export processContent must be a function');
        }

        if (typeof module.cssStyles !== 'string') {
            throw new Error('Script export cssStyles must be a string');
        }

        if (typeof module.getCookie !== 'function') {
            throw new Error('Script export getCookie must be a function');
        }
    }

    private validateProcessResult(value: unknown): asserts value is OpenGraphCardScriptResultBlock[] {
        if (!Array.isArray(value)) {
            throw new Error('processContent result must be an array');
        }

        for (const item of value) {
            if (!item || typeof item !== 'object') {
                throw new Error('processContent result items must be objects');
            }

            const block = item as OpenGraphCardScriptResultBlock;
            if (typeof block.className !== 'string' || block.className.trim() === '') {
                throw new Error('processContent block.className must be a non-empty string');
            }

            if (typeof block.htmlContent !== 'string') {
                throw new Error('processContent block.htmlContent must be a string');
            }
        }
    }

    private injectStyle(scriptId: string, cssStyles: string): void {
        this.removeStyle(scriptId);

        const styleEl = document.createElement('style');
        styleEl.id = this.getStyleElementId(scriptId);
        styleEl.textContent = `.og-card {\n${cssStyles}\n}`;
        document.head.appendChild(styleEl);
    }

    private removeStyle(scriptId: string): void {
        const existing = document.getElementById(this.getStyleElementId(scriptId));
        if (existing) {
            existing.remove();
        }
    }

    private getStyleElementId(scriptId: string): string {
        return `og-script-style-${scriptId}`;
    }
}
