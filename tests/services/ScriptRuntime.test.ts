import { App } from 'obsidian';
import { ScriptRuntime } from '../../src/services/ScriptRuntime';

describe('ScriptRuntime', () => {
    let app: App;
    let runtime: ScriptRuntime;

    beforeEach(() => {
        app = new App();
        runtime = new ScriptRuntime(app);
    });

    it('should unload all scripts without throw', () => {
        expect(() => runtime.unloadAll()).not.toThrow();
    });
});
