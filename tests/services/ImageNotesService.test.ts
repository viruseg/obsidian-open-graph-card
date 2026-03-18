import { ImageNotesService } from '../../src/services/ImageNotesService';

const createMockApp = (): any => ({
    vault: {
        getAbstractFileByPath: jest.fn().mockReturnValue(null),
        modify: jest.fn(),
        create: jest.fn(),
        createFolder: jest.fn(),
        delete: jest.fn(),
        read: jest.fn(),
        getConfig: jest.fn().mockReturnValue('/'),
    }
});

describe('ImageNotesService', () => {
    it('should remove stale image links before adding current ones on sync', async () => {
        const app = createMockApp();
        const imageService = {} as any;
        const fileLinkService = {
            getCardLinks: jest.fn().mockReturnValue({
                userNotePaths: ['note.md'],
                generatedNotePath: 'open-graph-card/card1.md',
                imagePaths: new Set(['old.png', 'keep.png'])
            }),
            setGeneratedNote: jest.fn(),
            addImage: jest.fn(),
            removeImage: jest.fn(),
            clearGeneratedNote: jest.fn()
        } as any;

        const service = new ImageNotesService(app, imageService, fileLinkService);
        const cardHtml = '<div class="og-card" card-id="card1"><img class="og-image" src="keep.png" data-url="https://a" /><img class="og-image" src="new.png" data-url="https://b" /></div>';

        await service.syncNote('card1', cardHtml);

        expect(fileLinkService.removeImage).toHaveBeenCalledWith('card1', 'old.png');
        expect(fileLinkService.removeImage).not.toHaveBeenCalledWith('card1', 'keep.png');
        expect(fileLinkService.addImage).toHaveBeenCalledWith('card1', 'keep.png');
        expect(fileLinkService.addImage).toHaveBeenCalledWith('card1', 'new.png');
    });
});
