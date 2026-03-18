import { FileLinkService } from '../../src/services/FileLinkService';
import { FileLinksData, CardLinksJSON } from '../../src/types/fileLinks';

// Мок для App с полным API
const createMockApp = () => ({
  vault: {
    getAbstractFileByPath: jest.fn(),
    read: jest.fn(),
    write: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
    on: jest.fn().mockReturnValue({}), // EventRef
    off: jest.fn(),
    offref: jest.fn()
  },
  workspace: {
    on: jest.fn(),
    off: jest.fn(),
    trigger: jest.fn(),
    getActiveFile: jest.fn()
  }
});

type MockApp = ReturnType<typeof createMockApp>;

// Мок для TAbstractFile
const createMockFile = (path: string) => ({
  path,
  name: path.split('/').pop() || path,
  vault: {} as any
});

describe('FileLinkService', () => {
  let mockApp: MockApp;
  let mockData: FileLinksData;
  let saveDataMock: jest.Mock;

  beforeEach(() => {
    mockApp = createMockApp();
    mockData = {
      version: 1,
      cardLinks: {}
    };
    saveDataMock = jest.fn().mockResolvedValue(undefined);
    jest.clearAllMocks();
  });

  // ========================================
  // Тесты для registerCard()
  // ========================================
  describe('registerCard', () => {
    it('should register card with single userNotePath as string', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.registerCard('card1', 'note1.md');

      const links = service.getCardLinks('card1');
      expect(links).toBeDefined();
      expect(links?.userNotePaths).toEqual(['note1.md']);
      expect(saveDataMock).toHaveBeenCalledTimes(1);
    });

    it('should register card with multiple userNotePaths as array', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.registerCard('card1', ['note1.md', 'note2.md']);

      const links = service.getCardLinks('card1');
      expect(links?.userNotePaths).toEqual(['note1.md', 'note2.md']);
    });

    it('should add entry to userNoteToCard index for each path', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.registerCard('card1', ['note1.md', 'note2.md']);

      expect(service.getCardIdByUserNote('note1.md')).toBe('card1');
      expect(service.getCardIdByUserNote('note2.md')).toBe('card1');
    });

    it('should not register duplicate card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.registerCard('card1', 'note1.md');
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      service.registerCard('card1', 'note2.md');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'FileLinkService: Card card1 already registered'
      );
      expect(service.getCardLinks('card1')?.userNotePaths).toEqual(['note1.md']);

      consoleWarnSpy.mockRestore();
    });

    it('should initialize with empty generatedNotePath and imagePaths', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.registerCard('card1', 'note1.md');

      const links = service.getCardLinks('card1');
      expect(links?.generatedNotePath).toBeNull();
      expect(links?.imagePaths.size).toBe(0);
    });
  });

  // ========================================
  // Тесты для addUserNote()
  // ========================================
  describe('addUserNote', () => {
    it('should add new note path to existing card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      const result = service.addUserNote('card1', 'note2.md');

      expect(result).toBe(true);
      const links = service.getCardLinks('card1');
      expect(links?.userNotePaths).toContain('note1.md');
      expect(links?.userNotePaths).toContain('note2.md');
    });

    it('should return false if card does not exist', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = service.addUserNote('nonexistent', 'note.md');

      expect(result).toBe(false);
      consoleWarnSpy.mockRestore();
    });

    it('should not add duplicate paths', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      service.addUserNote('card1', 'note1.md');

      const links = service.getCardLinks('card1');
      expect(links?.userNotePaths.filter(p => p === 'note1.md').length).toBe(1);
    });

    it('should trigger og-card:user-note-added event', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      service.addUserNote('card1', 'note2.md');

      expect(mockApp.workspace.trigger).toHaveBeenCalledWith(
        'og-card:user-note-added',
        expect.objectContaining({
          cardId: 'card1',
          notePath: 'note2.md'
        })
      );
    });

    it('should add entry to userNoteToCard index', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      service.addUserNote('card1', 'note2.md');

      expect(service.getCardIdByUserNote('note2.md')).toBe('card1');
    });

    it('should save data after adding note', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      saveDataMock.mockClear();

      service.addUserNote('card1', 'note2.md');

      expect(saveDataMock).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // Тесты для removeUserNote()
  // ========================================
  describe('removeUserNote', () => {
    it('should remove note path from card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md', 'note2.md']);

      const result = service.removeUserNote('card1', 'note1.md');

      expect(result.removed).toBe(true);
      expect(result.remaining).toEqual(['note2.md']);
    });

    it('should return removed=false if path not found', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      const result = service.removeUserNote('card1', 'nonexistent.md');

      expect(result.removed).toBe(false);
    });

    it('should trigger og-card:user-note-removed when paths remain', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md', 'note2.md']);

      service.removeUserNote('card1', 'note1.md');

      expect(mockApp.workspace.trigger).toHaveBeenCalledWith(
        'og-card:user-note-removed',
        expect.objectContaining({
          cardId: 'card1',
          notePath: 'note1.md'
        })
      );
    });

    it('should trigger og-card:last-user-note-deleted when no paths remain', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      service.removeUserNote('card1', 'note1.md');

      expect(mockApp.workspace.trigger).toHaveBeenCalledWith(
        'og-card:last-user-note-deleted',
        expect.objectContaining({
          cardId: 'card1',
          notePath: 'note1.md'
        })
      );
    });

    it('should remove entry from userNoteToCard index', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md', 'note2.md']);

      service.removeUserNote('card1', 'note1.md');

      expect(service.getCardIdByUserNote('note1.md')).toBeNull();
      expect(service.getCardIdByUserNote('note2.md')).toBe('card1');
    });

    it('should return removed=false for nonexistent card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = service.removeUserNote('nonexistent', 'note.md');

      expect(result.removed).toBe(false);
      expect(result.remaining).toEqual([]);
      consoleWarnSpy.mockRestore();
    });

    it('should save data after removing note', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md', 'note2.md']);
      saveDataMock.mockClear();

      service.removeUserNote('card1', 'note1.md');

      expect(saveDataMock).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // Тесты для hasUserNotes()
  // ========================================
  describe('hasUserNotes', () => {
    it('should return true when card has user notes', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      expect(service.hasUserNotes('card1')).toBe(true);
    });

    it('should return false when card has no user notes', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      service.removeUserNote('card1', 'note1.md');

      expect(service.hasUserNotes('card1')).toBe(false);
    });

    it('should return false for nonexistent card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      expect(service.hasUserNotes('nonexistent')).toBe(false);
    });

    it('should return true when card has multiple user notes', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md', 'note2.md']);

      expect(service.hasUserNotes('card1')).toBe(true);
    });
  });

  // ========================================
  // Тесты для getUserNotePaths()
  // ========================================
  describe('getUserNotePaths', () => {
    it('should return all user note paths', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md', 'note2.md']);

      const paths = service.getUserNotePaths('card1');

      expect(paths).toEqual(['note1.md', 'note2.md']);
    });

    it('should return empty array for nonexistent card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      expect(service.getUserNotePaths('nonexistent')).toEqual([]);
    });

    it('should return a copy of the array', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md']);

      const paths1 = service.getUserNotePaths('card1');
      const paths2 = service.getUserNotePaths('card1');

      expect(paths1).not.toBe(paths2); // Different references
      expect(paths1).toEqual(paths2); // Same content
    });
  });

  // ========================================
  // Тесты для getAllCardIds()
  // ========================================
  describe('getAllCardIds', () => {
    it('should return all registered card IDs', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.registerCard('card2', 'note2.md');

      const ids = service.getAllCardIds();

      expect(ids).toContain('card1');
      expect(ids).toContain('card2');
      expect(ids.length).toBe(2);
    });

    it('should return empty array when no cards registered', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      expect(service.getAllCardIds()).toEqual([]);
    });

    it('should not include unregistered cards', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.registerCard('card2', 'note2.md');

      service.unregisterCard('card1');

      const ids = service.getAllCardIds();
      expect(ids).not.toContain('card1');
      expect(ids).toContain('card2');
    });
  });

  describe('multiple cards per user note path', () => {
    it('should keep links for all cards when several cards share one user note', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.registerCard('card1', 'shared-note.md');
      service.registerCard('card2', 'shared-note.md');

      const cardIds = service.getCardIdsByUserNote('shared-note.md');

      expect(cardIds.has('card1')).toBe(true);
      expect(cardIds.has('card2')).toBe(true);
      expect(cardIds.size).toBe(2);
    });

    it('should remove user note from all cards on file delete', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.registerCard('card1', 'shared-note.md');
      service.registerCard('card2', 'shared-note.md');
      mockApp.workspace.trigger.mockClear();

      const file = createMockFile('shared-note.md');
      service.handleFileDelete(file as any);

      expect(service.getUserNotePaths('card1')).toEqual([]);
      expect(service.getUserNotePaths('card2')).toEqual([]);

      const deletionEvents = mockApp.workspace.trigger.mock.calls.filter(
        (call: any[]) => call[0] === 'og-card:user-note-deleted'
      );
      expect(deletionEvents).toHaveLength(2);
    });

    it('should rename user note path for all linked cards', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.registerCard('card1', 'shared-note.md');
      service.registerCard('card2', 'shared-note.md');
      mockApp.workspace.trigger.mockClear();

      const renamedFile = createMockFile('renamed-note.md');
      service.handleFileRename(renamedFile as any, 'shared-note.md');

      expect(service.getUserNotePaths('card1')).toContain('renamed-note.md');
      expect(service.getUserNotePaths('card2')).toContain('renamed-note.md');
      expect(service.getCardIdsByUserNote('shared-note.md').size).toBe(0);

      const renameEvents = mockApp.workspace.trigger.mock.calls.filter(
        (call: any[]) => call[0] === 'og-card:file-renamed'
      );
      expect(renameEvents).toHaveLength(2);
    });
  });

  // ========================================
  // Тесты для setGeneratedNote/clearGeneratedNote
  // ========================================
  describe('setGeneratedNote and clearGeneratedNote', () => {
    it('should set generated note path', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      service.setGeneratedNote('card1', 'generated.md');

      const links = service.getCardLinks('card1');
      expect(links?.generatedNotePath).toBe('generated.md');
      expect(service.getCardIdByGeneratedNote('generated.md')).toBe('card1');
    });

    it('should clear generated note path', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.setGeneratedNote('card1', 'generated.md');

      service.clearGeneratedNote('card1');

      const links = service.getCardLinks('card1');
      expect(links?.generatedNotePath).toBeNull();
      expect(service.getCardIdByGeneratedNote('generated.md')).toBeNull();
    });

    it('should update index when changing generated note', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.setGeneratedNote('card1', 'generated1.md');

      service.setGeneratedNote('card1', 'generated2.md');

      expect(service.getCardIdByGeneratedNote('generated1.md')).toBeNull();
      expect(service.getCardIdByGeneratedNote('generated2.md')).toBe('card1');
    });

    it('should warn when setting generated note for nonexistent card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      service.setGeneratedNote('nonexistent', 'generated.md');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'FileLinkService: Card nonexistent not found'
      );
      consoleWarnSpy.mockRestore();
    });

    it('should save data after setting generated note', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      saveDataMock.mockClear();

      service.setGeneratedNote('card1', 'generated.md');

      expect(saveDataMock).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // Тесты для addImage/removeImage
  // ========================================
  describe('addImage and removeImage', () => {
    it('should add image to card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      service.addImage('card1', 'image.png');

      const links = service.getCardLinks('card1');
      expect(links?.imagePaths.has('image.png')).toBe(true);
      expect(service.getCardIdByImage('image.png')).toBe('card1');
    });

    it('should remove image from card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.addImage('card1', 'image.png');

      service.removeImage('card1', 'image.png');

      const links = service.getCardLinks('card1');
      expect(links?.imagePaths.has('image.png')).toBe(false);
      expect(service.getCardIdByImage('image.png')).toBeNull();
    });

    it('should not add duplicate images', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.addImage('card1', 'image.png');
      saveDataMock.mockClear();

      service.addImage('card1', 'image.png');

      const links = service.getCardLinks('card1');
      expect(links?.imagePaths.size).toBe(1);
      expect(saveDataMock).not.toHaveBeenCalled();
    });

    it('should warn when adding image to nonexistent card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      service.addImage('nonexistent', 'image.png');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'FileLinkService: Card nonexistent not found'
      );
      consoleWarnSpy.mockRestore();
    });

    it('should add multiple images', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      service.addImage('card1', 'image1.png');
      service.addImage('card1', 'image2.png');

      const links = service.getCardLinks('card1');
      expect(links?.imagePaths.size).toBe(2);
      expect(links?.imagePaths.has('image1.png')).toBe(true);
      expect(links?.imagePaths.has('image2.png')).toBe(true);
    });

    it('should detect references excluding current card when another card uses image', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.registerCard('card1', 'note1.md');
      service.registerCard('card2', 'note2.md');
      service.addImage('card1', 'shared.png');
      service.addImage('card2', 'shared.png');

      expect(service.hasImageReferencesExcludingCard('shared.png', 'card1')).toBe(true);
      expect(service.hasImageReferencesExcludingCard('shared.png', 'card2')).toBe(true);
    });

    it('should return false for references excluding current card when image belongs only to current card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.registerCard('card1', 'note1.md');
      service.addImage('card1', 'exclusive.png');

      expect(service.hasImageReferencesExcludingCard('exclusive.png', 'card1')).toBe(false);
    });

    it('should return false for references excluding current card when image is missing', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      expect(service.hasImageReferencesExcludingCard('missing.png', 'card1')).toBe(false);
    });
  });

  // ========================================
  // Тесты для unregisterCard()
  // ========================================
  describe('unregisterCard', () => {
    it('should remove card from all structures', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md', 'note2.md']);
      service.setGeneratedNote('card1', 'generated.md');
      service.addImage('card1', 'image.png');

      service.unregisterCard('card1');

      expect(service.getCardLinks('card1')).toBeNull();
      expect(service.getCardIdByUserNote('note1.md')).toBeNull();
      expect(service.getCardIdByUserNote('note2.md')).toBeNull();
      expect(service.getCardIdByGeneratedNote('generated.md')).toBeNull();
      expect(service.getCardIdByImage('image.png')).toBeNull();
    });

    it('should do nothing for nonexistent card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      // Should not throw
      service.unregisterCard('nonexistent');
    });

    it('should save data after unregistering', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      saveDataMock.mockClear();

      service.unregisterCard('card1');

      expect(saveDataMock).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // Тесты для findFileLink()
  // ========================================
  describe('findFileLink', () => {
    it('should find user note', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      const result = service.findFileLink('note1.md');

      expect(result.cardId).toBe('card1');
      expect(result.fileType).toBe('userNote');
      expect(result.cardLinks).not.toBeNull();
    });

    it('should find generated note', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.setGeneratedNote('card1', 'generated.md');

      const result = service.findFileLink('generated.md');

      expect(result.cardId).toBe('card1');
      expect(result.fileType).toBe('generatedNote');
    });

    it('should find image', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.addImage('card1', 'image.png');

      const result = service.findFileLink('image.png');

      expect(result.cardId).toBe('card1');
      expect(result.fileType).toBe('image');
    });

    it('should return unknown for unlinked file', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      const result = service.findFileLink('unlinked.md');

      expect(result.cardId).toBeNull();
      expect(result.fileType).toBe('unknown');
      expect(result.cardLinks).toBeNull();
    });
  });

  // ========================================
  // Тесты для getSerializedData()
  // ========================================
  describe('getSerializedData', () => {
    it('should serialize userNotePaths as array', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md', 'note2.md']);
      service.setGeneratedNote('card1', 'generated.md');
      service.addImage('card1', 'image.png');

      const data = service.getSerializedData();

      expect(data['card1'].userNotePaths).toEqual(['note1.md', 'note2.md']);
      expect(data['card1'].generatedNotePath).toBe('generated.md');
      expect(data['card1'].imagePaths).toContain('image.png');
    });

    it('should return empty object when no cards registered', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      const data = service.getSerializedData();

      expect(data).toEqual({});
    });

    it('should serialize imagePaths as array', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.addImage('card1', 'image1.png');
      service.addImage('card1', 'image2.png');

      const data = service.getSerializedData();

      expect(Array.isArray(data['card1'].imagePaths)).toBe(true);
      expect(data['card1'].imagePaths).toContain('image1.png');
      expect(data['card1'].imagePaths).toContain('image2.png');
    });
  });

  // ========================================
  // Тесты для deserialize (initialize)
  // ========================================
  describe('deserialize (via initialize)', () => {
    it('should deserialize userNotePaths array correctly', () => {
      mockData = {
        version: 1,
        cardLinks: {
          'card1': {
            userNotePaths: ['note1.md', 'note2.md'],
            generatedNotePath: 'generated.md',
            imagePaths: ['image.png']
          }
        }
      };

      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.initialize();

      expect(service.getCardIdByUserNote('note1.md')).toBe('card1');
      expect(service.getCardIdByUserNote('note2.md')).toBe('card1');
      expect(service.getCardIdByGeneratedNote('generated.md')).toBe('card1');
      expect(service.getCardIdByImage('image.png')).toBe('card1');
    });

    it('should migrate old userNotePath string to userNotePaths array', () => {
      mockData = {
        version: 1,
        cardLinks: {
          'card1': {
            userNotePath: 'note1.md', // Old format
            generatedNotePath: null,
            imagePaths: []
          } as any // Cast to bypass type check for old format
        }
      };

      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.initialize();

      const links = service.getCardLinks('card1');
      expect(links?.userNotePaths).toEqual(['note1.md']);
      expect(service.getCardIdByUserNote('note1.md')).toBe('card1');
    });

    it('should handle empty cardLinks', () => {
      mockData = {
        version: 1,
        cardLinks: {}
      };

      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.initialize();

      expect(service.getAllCardIds()).toEqual([]);
    });

    it('should restore imagePaths as Set', () => {
      mockData = {
        version: 1,
        cardLinks: {
          'card1': {
            userNotePaths: ['note1.md'],
            generatedNotePath: null,
            imagePaths: ['image1.png', 'image2.png']
          }
        }
      };

      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.initialize();

      const links = service.getCardLinks('card1');
      expect(links?.imagePaths).toBeInstanceOf(Set);
      expect(links?.imagePaths.size).toBe(2);
    });
  });

  // ========================================
  // Тесты для initialize() и dispose()
  // ========================================
  describe('initialize and dispose', () => {
    it('should subscribe to vault events on initialize', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      service.initialize();

      expect(mockApp.vault.on).toHaveBeenCalledWith('delete', expect.any(Function));
      expect(mockApp.vault.on).toHaveBeenCalledWith('rename', expect.any(Function));
    });

    it('should unsubscribe from vault events on dispose', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.initialize();

      service.dispose();

      expect(mockApp.vault.offref).toHaveBeenCalledTimes(2);
    });

    it('should clear all structures on dispose', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.setGeneratedNote('card1', 'generated.md');
      service.addImage('card1', 'image.png');

      service.dispose();

      expect(service.getAllCardIds()).toEqual([]);
      expect(service.getCardIdByUserNote('note1.md')).toBeNull();
      expect(service.getCardIdByGeneratedNote('generated.md')).toBeNull();
      expect(service.getCardIdByImage('image.png')).toBeNull();
    });
  });

  // ========================================
  // Тесты для handleFileDelete()
  // ========================================
  describe('handleFileDelete', () => {
    it('should handle user note deletion', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md', 'note2.md']);

      const file = createMockFile('note1.md');
      service.handleFileDelete(file as any);

      expect(service.getCardIdByUserNote('note1.md')).toBeNull();
      expect(service.getCardIdByUserNote('note2.md')).toBe('card1');
    });

    it('should trigger og-card:user-note-deleted event on user note deletion', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', ['note1.md', 'note2.md']);

      const file = createMockFile('note1.md');
      service.handleFileDelete(file as any);

      expect(mockApp.workspace.trigger).toHaveBeenCalledWith(
        'og-card:user-note-deleted',
        expect.objectContaining({
          deletedPath: 'note1.md',
          cardId: 'card1',
          fileType: 'userNote'
        })
      );
    });

    it('should handle generated note deletion', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.setGeneratedNote('card1', 'generated.md');

      const file = createMockFile('generated.md');
      service.handleFileDelete(file as any);

      expect(mockApp.workspace.trigger).toHaveBeenCalledWith(
        'og-card:generated-note-deleted',
        expect.objectContaining({
          deletedPath: 'generated.md',
          cardId: 'card1',
          fileType: 'generatedNote'
        })
      );
    });

    it('should handle image deletion', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.addImage('card1', 'image.png');

      const file = createMockFile('image.png');
      service.handleFileDelete(file as any);

      expect(mockApp.workspace.trigger).toHaveBeenCalledWith(
        'og-card:image-deleted',
        expect.objectContaining({
          deletedPath: 'image.png',
          cardId: 'card1',
          fileType: 'image'
        })
      );
    });

    it('should skip image deletion during batch operation', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.addImage('card1', 'image.png');
      service.startBatchOperation();

      const file = createMockFile('image.png');
      service.handleFileDelete(file as any);

      expect(mockApp.workspace.trigger).not.toHaveBeenCalled();
    });

    it('should do nothing for unlinked file', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      const file = createMockFile('unlinked.md');
      service.handleFileDelete(file as any);

      // No events should be triggered
      expect(mockApp.workspace.trigger).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Тесты для handleFileRename()
  // ========================================
  describe('handleFileRename', () => {
    it('should handle user note rename', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      const file = createMockFile('note-renamed.md');
      service.handleFileRename(file as any, 'note1.md');

      expect(service.getCardIdByUserNote('note1.md')).toBeNull();
      expect(service.getCardIdByUserNote('note-renamed.md')).toBe('card1');
      const links = service.getCardLinks('card1');
      expect(links?.userNotePaths).toContain('note-renamed.md');
    });

    it('should handle generated note rename', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.setGeneratedNote('card1', 'generated.md');

      const file = createMockFile('generated-renamed.md');
      service.handleFileRename(file as any, 'generated.md');

      expect(service.getCardIdByGeneratedNote('generated.md')).toBeNull();
      expect(service.getCardIdByGeneratedNote('generated-renamed.md')).toBe('card1');
    });

    it('should handle image rename', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.addImage('card1', 'image.png');

      const file = createMockFile('image-renamed.png');
      service.handleFileRename(file as any, 'image.png');

      expect(service.getCardIdByImage('image.png')).toBeNull();
      expect(service.getCardIdByImage('image-renamed.png')).toBe('card1');
    });

    it('should update image path for all cards sharing same image', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      service.registerCard('card2', 'note2.md');
      service.addImage('card1', 'shared.png');
      service.addImage('card2', 'shared.png');

      const file = createMockFile('shared-renamed.png');
      service.handleFileRename(file as any, 'shared.png');

      const card1Links = service.getCardLinks('card1');
      const card2Links = service.getCardLinks('card2');

      expect(card1Links?.imagePaths.has('shared.png')).toBe(false);
      expect(card2Links?.imagePaths.has('shared.png')).toBe(false);
      expect(card1Links?.imagePaths.has('shared-renamed.png')).toBe(true);
      expect(card2Links?.imagePaths.has('shared-renamed.png')).toBe(true);
    });

    it('should trigger og-card:file-renamed event', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      const file = createMockFile('note-renamed.md');
      service.handleFileRename(file as any, 'note1.md');

      expect(mockApp.workspace.trigger).toHaveBeenCalledWith(
        'og-card:file-renamed',
        expect.objectContaining({
          oldPath: 'note1.md',
          newPath: 'note-renamed.md',
          cardId: 'card1',
          fileType: 'userNote'
        })
      );
    });

    it('should do nothing for unlinked file', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      const file = createMockFile('unlinked-renamed.md');
      service.handleFileRename(file as any, 'unlinked.md');

      expect(mockApp.workspace.trigger).not.toHaveBeenCalled();
    });

    it('should save data after rename', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');
      saveDataMock.mockClear();

      const file = createMockFile('note-renamed.md');
      service.handleFileRename(file as any, 'note1.md');

      expect(saveDataMock).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // Тесты для batch operations
  // ========================================
  describe('batch operations', () => {
    it('should track batch operation state', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      expect(service.isBatchOperationInProgress()).toBe(false);

      service.startBatchOperation();
      expect(service.isBatchOperationInProgress()).toBe(true);

      service.endBatchOperation();
      expect(service.isBatchOperationInProgress()).toBe(false);
    });
  });

  // ========================================
  // Тесты для getCardLinks()
  // ========================================
  describe('getCardLinks', () => {
    it('should return null for nonexistent card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );

      expect(service.getCardLinks('nonexistent')).toBeNull();
    });

    it('should return CardLinks for existing card', () => {
      const service = new FileLinkService(
        mockApp as any,
        () => mockData,
        saveDataMock
      );
      service.registerCard('card1', 'note1.md');

      const links = service.getCardLinks('card1');

      expect(links).not.toBeNull();
      expect(links?.userNotePaths).toEqual(['note1.md']);
    });
  });
});
