export interface InstalledScriptSettings {
    id: string;
    url: string;
    name: string;
    version: string;
    author: string;
    localPath: string;
    autoUpdate: boolean;
    enabled: boolean;
    domains: string[];
    cover: boolean;
    fileHash: string;
}

export interface ScriptEngineSettings {
    hashWatchEnabled: boolean;
    hashWatchIntervalSec: number;
    globalAutoUpdateEnabled: boolean;
    autoUpdateTimerEnabled: boolean;
    autoUpdateOnStartup: boolean;
    autoUpdateIntervalSec: number;
}

export interface OpenGraphSettings {
    saveImagesLocally: boolean;
    scripts: InstalledScriptSettings[];
    scriptEngine: ScriptEngineSettings;
}

export const DEFAULT_SETTINGS: OpenGraphSettings = {
    saveImagesLocally: false,
    scripts: [],
    scriptEngine: {
        hashWatchEnabled: true,
        hashWatchIntervalSec: 3600,
        globalAutoUpdateEnabled: true,
        autoUpdateTimerEnabled: true,
        autoUpdateOnStartup: true,
        autoUpdateIntervalSec: 3600
    }
};
