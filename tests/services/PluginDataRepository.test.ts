import { PluginDataRepository } from '../../src/services/PluginDataRepository';
import { OpenGraphSettings } from '../../src/types';

const scriptEngineDefaults = {
    hashWatchEnabled: true,
    hashWatchIntervalSec: 60,
    globalAutoUpdateEnabled: true,
    autoUpdateTimerEnabled: true,
    autoUpdateOnStartup: true,
    autoUpdateIntervalSec: 3600
};

describe('PluginDataRepository', () => {
    it('should preserve fileLinks when saving settings', async () => {
        const existing = {
            saveImagesLocally: false,
            scripts: [],
            scriptEngine: scriptEngineDefaults,
            fileLinks: {
                version: 1,
                cardLinks: {
                    card1: {
                        userNotePaths: ['note.md'],
                        generatedNotePath: null,
                        imagePaths: ['img.png']
                    }
                }
            }
        };

        const loadData = jest.fn().mockResolvedValue(existing);
        const saveData = jest.fn().mockResolvedValue(undefined);
        const repository = new PluginDataRepository(loadData, saveData);

        const settings: OpenGraphSettings = {
            saveImagesLocally: true,
            scripts: [],
            scriptEngine: scriptEngineDefaults
        };
        await repository.saveSettings(settings);

        expect(saveData).toHaveBeenCalledWith(
            expect.objectContaining({
                saveImagesLocally: true,
                fileLinks: existing.fileLinks
            })
        );
    });

    it('should preserve settings fields when saving file links', async () => {
        const existing = {
            saveImagesLocally: true,
            scripts: [],
            scriptEngine: scriptEngineDefaults,
            fileLinks: {
                version: 1,
                cardLinks: {}
            }
        };

        const loadData = jest.fn().mockResolvedValue(existing);
        const saveData = jest.fn().mockResolvedValue(undefined);
        const repository = new PluginDataRepository(loadData, saveData);

        await repository.saveFileLinks({
            version: 1,
            cardLinks: {
                card2: {
                    userNotePaths: ['note-2.md'],
                    generatedNotePath: null,
                    imagePaths: []
                }
            }
        });

        expect(saveData).toHaveBeenCalledWith(
            expect.objectContaining({
                saveImagesLocally: true,
                scripts: [],
                scriptEngine: scriptEngineDefaults,
                fileLinks: {
                    version: 1,
                    cardLinks: {
                        card2: {
                            userNotePaths: ['note-2.md'],
                            generatedNotePath: null,
                            imagePaths: []
                        }
                    }
                }
            })
        );
    });
});
