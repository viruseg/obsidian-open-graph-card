import { App } from 'obsidian';
import { ScriptService } from '../../src/services/ScriptService';
import { OpenGraphSettings } from '../../src/types';

describe('ScriptService', () => {
    it('should return null when no scripts configured', () => {
        const app = new App();
        const settings: OpenGraphSettings = {
            saveImagesLocally: false,
            scripts: [],
            scriptEngine: {
                hashWatchEnabled: true,
                hashWatchIntervalSec: 60,
                globalAutoUpdateEnabled: true,
                autoUpdateOnStartup: true,
                autoUpdateIntervalSec: 3600
            }
        };

        const service = new ScriptService(app, 'obsidian-open-graph-card', () => settings, async () => undefined);
        expect(service.getMatchingScript('https://store.steampowered.com/app/570')).toBeNull();
    });
});
