import { TFile } from 'obsidian';
import { ImageService } from '../../src/services/ImageService';

const createMockApp = (): any => ({
    vault: {
        getAbstractFileByPath: jest.fn(),
        delete: jest.fn()
    },
    fileManager: {
        getAvailablePathForAttachment: jest.fn()
    }
});

describe('ImageService.restoreCardImages', () => {
    it('should delete local file when image belongs only to current card', async () => {
        const app = createMockApp();
        const localImage = 'Attachments/local-image.jpg';
        app.vault.getAbstractFileByPath.mockReturnValue(new TFile(localImage));

        const service = new ImageService(app, {} as any);
        const fileLinkService = {
            hasImageReferencesExcludingCard: jest.fn().mockReturnValue(false)
        } as any;
        service.setFileLinkService(fileLinkService);

        const cardHtml = '<div class="og-card" card-id="card1"><img class="og-image" src="Attachments/local-image.jpg" data-url="https://example.com/image.jpg" /></div>';
        const { result, updatedHtml } = await service.restoreCardImages(cardHtml, 'card1');

        expect(fileLinkService.hasImageReferencesExcludingCard).toHaveBeenCalledWith(localImage, 'card1');
        expect(app.vault.delete).toHaveBeenCalledTimes(1);
        expect(result.restoredCount).toBe(1);
        expect(updatedHtml).toContain('src="https://example.com/image.jpg"');
        expect(updatedHtml).not.toContain('data-url=');
    });

    it('should not delete local file when image is shared with another card', async () => {
        const app = createMockApp();
        const localImage = 'Attachments/shared-image.jpg';
        app.vault.getAbstractFileByPath.mockReturnValue(new TFile(localImage));

        const service = new ImageService(app, {} as any);
        const fileLinkService = {
            hasImageReferencesExcludingCard: jest.fn().mockReturnValue(true)
        } as any;
        service.setFileLinkService(fileLinkService);

        const cardHtml = '<div class="og-card" card-id="card1"><img class="og-image" src="Attachments/shared-image.jpg" data-url="https://example.com/shared.jpg" /></div>';
        const { result, updatedHtml } = await service.restoreCardImages(cardHtml, 'card1');

        expect(fileLinkService.hasImageReferencesExcludingCard).toHaveBeenCalledWith(localImage, 'card1');
        expect(app.vault.delete).not.toHaveBeenCalled();
        expect(result.restoredCount).toBe(1);
        expect(updatedHtml).toContain('src="https://example.com/shared.jpg"');
    });

    it('should fallback to generic reference check when cardId is empty', async () => {
        const app = createMockApp();
        const localImage = 'Attachments/fallback.jpg';
        app.vault.getAbstractFileByPath.mockReturnValue(new TFile(localImage));

        const service = new ImageService(app, {} as any);
        const fileLinkService = {
            hasImageReferencesExcludingCard: jest.fn(),
            hasImageReferences: jest.fn().mockReturnValue(false)
        } as any;
        service.setFileLinkService(fileLinkService);

        const cardHtml = '<div class="og-card" card-id=""><img class="og-image" src="Attachments/fallback.jpg" data-url="https://example.com/fallback.jpg" /></div>';
        const { result } = await service.restoreCardImages(cardHtml, '');

        expect(fileLinkService.hasImageReferencesExcludingCard).not.toHaveBeenCalled();
        expect(fileLinkService.hasImageReferences).toHaveBeenCalledWith(localImage);
        expect(app.vault.delete).toHaveBeenCalledTimes(1);
        expect(result.restoredCount).toBe(1);
    });
});
