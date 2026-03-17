import { IntegrityService } from '../../src/services/IntegrityService';
import { FileLinkService } from '../../src/services/FileLinkService';
import { ImageNotesService } from '../../src/services/ImageNotesService';
import { TFile } from 'obsidian';

// Мок для App
const createMockApp = () => ({
  vault: {
    getAbstractFileByPath: jest.fn(),
    cachedRead: jest.fn()
  },
  workspace: {
    onLayoutReady: jest.fn((callback: () => void) => callback())
  }
});

type MockApp = ReturnType<typeof createMockApp>;

// Мок для TFile
const createMockTFile = (path: string): TFile => ({
  path,
  name: path.split('/').pop() || path,
  vault: {} as any,
  extension: path.split('.').pop() || '',
  basename: path.split('/').pop()?.split('.')[0] || '',
  parent: null,
  stat: { ctime: 0, mtime: 0, size: 0 }
});

// Мок для TFolder (папка не имеет свойства stat)
const createMockTFolder = (path: string) => ({
  path,
  name: path.split('/').pop() || path,
  vault: {} as any,
  parent: null,
  children: []
});

describe('IntegrityService', () => {
  let mockApp: MockApp;
  let mockFileLinkService: jest.Mocked<FileLinkService>;
  let mockImageNotesService: jest.Mocked<ImageNotesService>;

  beforeEach(() => {
    mockApp = createMockApp();

    mockFileLinkService = {
      getAllCardIds: jest.fn(),
      getCardLinks: jest.fn(),
      removeUserNote: jest.fn(),
      clearGeneratedNote: jest.fn(),
      removeImage: jest.fn(),
      hasUserNotes: jest.fn(),
      unregisterCard: jest.fn()
    } as any;

    mockImageNotesService = {
      syncNote: jest.fn(),
      deleteNote: jest.fn()
    } as any;

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Очистка если нужно
  });

  // ========================================
  // Тесты для scheduleCheck
  // ========================================
  describe('scheduleCheck', () => {
    it('should call checkIntegrity via onLayoutReady', () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue([]);

      service.scheduleCheck();

      // onLayoutReady должен быть вызван
      expect(mockApp.workspace.onLayoutReady).toHaveBeenCalled();
      // checkIntegrity должен быть вызван немедленно (мок onLayoutReady вызывает callback)
      expect(mockFileLinkService.getAllCardIds).toHaveBeenCalled();
    });

    it('should not schedule multiple checks', () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue([]);

      // Вызываем scheduleCheck дважды
      service.scheduleCheck();
      service.scheduleCheck();

      // onLayoutReady должен быть вызван только один раз
      expect(mockApp.workspace.onLayoutReady).toHaveBeenCalledTimes(1);
    });

    it('should handle async checkIntegrity errors', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      const error = new Error('Test error');
      mockFileLinkService.getAllCardIds.mockImplementation(() => {
        throw error;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      service.scheduleCheck();

      // Ждём асинхронного выполнения
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[IntegrityService] Check failed:',
        error
      );

      consoleErrorSpy.mockRestore();
    });
  });

  // ========================================
  // Тесты для checkIntegrity
  // ========================================
  describe('checkIntegrity', () => {
    it('should remove broken user note paths', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['existing-note.md', 'deleted-note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      // existing-note.md существует, deleted-note.md - нет
      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(createMockTFile('existing-note.md'))
        .mockReturnValueOnce(null);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledWith(
        'card1',
        'deleted-note.md'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Removed broken user note: deleted-note.md')
      );

      consoleLogSpy.mockRestore();
    });

    it('should remove broken generated note path', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['note.md'],
        generatedNotePath: 'deleted-generated.md',
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      // note.md существует, generated - нет
      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(createMockTFile('note.md'))
        .mockReturnValueOnce(null);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(mockFileLinkService.clearGeneratedNote).toHaveBeenCalledWith('card1');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Removed broken generated note for card: card1')
      );

      consoleLogSpy.mockRestore();
    });

    it('should remove broken image paths', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['note.md'],
        generatedNotePath: null,
        imagePaths: new Set(['existing.png', 'deleted.png'])
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      // note.md и existing.png существуют, deleted.png - нет
      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(createMockTFile('note.md'))
        .mockReturnValueOnce(createMockTFile('existing.png'))
        .mockReturnValueOnce(null);

      // note.md содержит карточку
      mockApp.vault.cachedRead.mockResolvedValue('<div class="og-card" card-id="card1"></div><!--og-card-end card1-->');

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(mockFileLinkService.removeImage).toHaveBeenCalledWith(
        'card1',
        'deleted.png'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Removed broken image: deleted.png')
      );

      consoleLogSpy.mockRestore();
    });

    it('should unregister card with no user notes', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['deleted-note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });

      // После удаления заметки hasUserNotes возвращает false
      mockFileLinkService.hasUserNotes.mockReturnValue(false);

      // deleted-note.md не существует
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).toHaveBeenCalled();
      expect(mockFileLinkService.unregisterCard).toHaveBeenCalledWith('card1');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 orphaned cards')
      );

      consoleLogSpy.mockRestore();
    });

    it('should keep valid links', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['note.md'],
        generatedNotePath: 'generated.md',
        imagePaths: new Set(['image.png'])
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      // Все файлы существуют
      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(createMockTFile('note.md'))
        .mockReturnValueOnce(createMockTFile('generated.md'))
        .mockReturnValueOnce(createMockTFile('image.png'));

      // Файл содержит карточку
      mockApp.vault.cachedRead.mockResolvedValue('<div class="og-card" card-id="card1"></div><!--og-card-end card1-->');

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).not.toHaveBeenCalled();
      expect(mockFileLinkService.clearGeneratedNote).not.toHaveBeenCalled();
      expect(mockFileLinkService.removeImage).not.toHaveBeenCalled();
      expect(mockFileLinkService.unregisterCard).not.toHaveBeenCalled();
    });

    it('should handle multiple cards', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1', 'card2', 'card3']);

      // card1 - все файлы существуют
      mockFileLinkService.getCardLinks
        .mockReturnValueOnce({
          userNotePaths: ['note1.md'],
          generatedNotePath: null,
          imagePaths: new Set()
        })
        // card2 - сломанный путь заметки
        .mockReturnValueOnce({
          userNotePaths: ['deleted-note.md'],
          generatedNotePath: null,
          imagePaths: new Set()
        })
        // card3 - все файлы существуют
        .mockReturnValueOnce({
          userNotePaths: ['note3.md'],
          generatedNotePath: null,
          imagePaths: new Set()
        });

      // card1 - note1.md существует
      // card2 - deleted-note.md не существует
      // card3 - note3.md существует
      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(createMockTFile('note1.md'))
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(createMockTFile('note3.md'));

      // note1.md и note3.md содержат карточки
      mockApp.vault.cachedRead
        .mockResolvedValueOnce('<div class="og-card" card-id="card1"></div><!--og-card-end card1-->')
        .mockResolvedValueOnce('<div class="og-card" card-id="card3"></div><!--og-card-end card3-->');

      mockFileLinkService.hasUserNotes
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false) // card2 после удаления сломанной заметки
        .mockReturnValueOnce(true);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledWith(
        'card2',
        'deleted-note.md'
      );
      expect(mockFileLinkService.unregisterCard).toHaveBeenCalledWith('card2');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 orphaned cards')
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle card with null links', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue(null);

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).not.toHaveBeenCalled();
      expect(mockFileLinkService.unregisterCard).not.toHaveBeenCalled();
    });

    it('should handle empty card list', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue([]);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(mockFileLinkService.getCardLinks).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('0 orphaned cards')
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle card with multiple broken user notes', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['deleted1.md', 'deleted2.md', 'existing.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(null) // deleted1.md
        .mockReturnValueOnce(null) // deleted2.md
        .mockReturnValueOnce(createMockTFile('existing.md'));

      // existing.md содержит карточку
      mockApp.vault.cachedRead.mockResolvedValue('<div class="og-card" card-id="card1"></div><!--og-card-end card1-->');

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledTimes(2);
      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledWith(
        'card1',
        'deleted1.md'
      );
      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledWith(
        'card1',
        'deleted2.md'
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle card with multiple broken images', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['note.md'],
        generatedNotePath: null,
        imagePaths: new Set(['deleted1.png', 'deleted2.png', 'existing.png'])
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(createMockTFile('note.md'))
        .mockReturnValueOnce(null) // deleted1.png
        .mockReturnValueOnce(null) // deleted2.png
        .mockReturnValueOnce(createMockTFile('existing.png'));

      // note.md содержит карточку
      mockApp.vault.cachedRead.mockResolvedValue('<div class="og-card" card-id="card1"></div><!--og-card-end card1-->');

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(mockFileLinkService.removeImage).toHaveBeenCalledTimes(2);
      expect(mockFileLinkService.removeImage).toHaveBeenCalledWith(
        'card1',
        'deleted1.png'
      );
      expect(mockFileLinkService.removeImage).toHaveBeenCalledWith(
        'card1',
        'deleted2.png'
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle all types of broken links in one card', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['deleted-note.md'],
        generatedNotePath: 'deleted-generated.md',
        imagePaths: new Set(['deleted-image.png'])
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(false);

      // Все файлы не существуют
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledWith(
        'card1',
        'deleted-note.md'
      );
      expect(mockFileLinkService.clearGeneratedNote).toHaveBeenCalledWith('card1');
      expect(mockFileLinkService.removeImage).toHaveBeenCalledWith(
        'card1',
        'deleted-image.png'
      );
      expect(mockFileLinkService.unregisterCard).toHaveBeenCalledWith('card1');

      consoleLogSpy.mockRestore();
    });
  });

  // ========================================
  // Тесты для fileExists (косвенно)
  // ========================================
  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['existing.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      mockApp.vault.getAbstractFileByPath.mockReturnValue(createMockTFile('existing.md'));
      // existing.md содержит карточку
      mockApp.vault.cachedRead.mockResolvedValue('<div class="og-card" card-id="card1"></div><!--og-card-end card1-->');

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).not.toHaveBeenCalled();
    });

    it('should return false for non-existing file', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['non-existing.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(false);

      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledWith(
        'card1',
        'non-existing.md'
      );
    });

    it('should handle exception in getAbstractFileByPath', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['error-file.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(false);

      mockApp.vault.getAbstractFileByPath.mockImplementation(() => {
        throw new Error('Vault error');
      });

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledWith(
        'card1',
        'error-file.md'
      );
    });

    it('should return false for folder (not a file)', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['some-folder'],
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(false);

      // Возвращаем папку вместо файла (без свойства stat)
      mockApp.vault.getAbstractFileByPath.mockReturnValue(createMockTFolder('some-folder'));

      await service.checkIntegrity();

      // Папка должна считаться несуществующим файлом
      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledWith(
        'card1',
        'some-folder'
      );
    });

    it('should return false for null result from getAbstractFileByPath', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['null-file.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(false);

      // Возвращаем null
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledWith(
        'card1',
        'null-file.md'
      );
    });

    it('should return false for undefined result from getAbstractFileByPath', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['undefined-file.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(false);

      // Возвращаем undefined
      mockApp.vault.getAbstractFileByPath.mockReturnValue(undefined);

      await service.checkIntegrity();

      expect(mockFileLinkService.removeUserNote).toHaveBeenCalledWith(
        'card1',
        'undefined-file.md'
      );
    });
  });

  // ========================================
  // Тесты для cleanupBrokenLinks (косвенно)
  // ========================================
  describe('cleanupBrokenLinks', () => {
    it('should handle null links during cleanup gracefully', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);

      // Возвращаем данные с несуществующим файлом
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['deleted.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });

      // После удаления hasUserNotes возвращает false
      mockFileLinkService.hasUserNotes.mockReturnValue(false);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      // Не должно выбросить ошибку
      await service.checkIntegrity();

      // Проверяем что карточка была удалена
      expect(mockFileLinkService.unregisterCard).toHaveBeenCalledWith('card1');
    });
  });

  // ========================================
  // Дополнительные тесты
  // ========================================
  describe('additional tests', () => {
    it('should log start and completion messages', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue([]);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[IntegrityService] Starting integrity check...'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Check complete')
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle generatedNotePath null correctly', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['note.md'],
        generatedNotePath: null, // null - не проверяем
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      mockApp.vault.getAbstractFileByPath.mockReturnValue(createMockTFile('note.md'));
      // note.md содержит карточку
      mockApp.vault.cachedRead.mockResolvedValue('<div class="og-card" card-id="card1"></div><!--og-card-end card1-->');

      await service.checkIntegrity();

      // getAbstractFileByPath вызывается для note.md (1 раз)
      // Для generatedNotePath = null не должен вызываться дополнительный раз
      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledTimes(1);
    });

    it('should handle empty imagePaths set', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['note.md'],
        generatedNotePath: null,
        imagePaths: new Set() // пустой Set
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      mockApp.vault.getAbstractFileByPath.mockReturnValue(createMockTFile('note.md'));

      await service.checkIntegrity();

      expect(mockFileLinkService.removeImage).not.toHaveBeenCalled();
    });

    it('should handle empty userNotePaths array', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: [], // пустой массив
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(false);

      await service.checkIntegrity();

      expect(mockFileLinkService.unregisterCard).toHaveBeenCalledWith('card1');
    });

    it('should process cards in order', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1', 'card2', 'card3']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      mockApp.vault.getAbstractFileByPath.mockReturnValue(createMockTFile('note.md'));
      // note.md содержит все три карточки
      mockApp.vault.cachedRead.mockResolvedValue(
        '<div class="og-card" card-id="card1"></div>' +
        '<div class="og-card" card-id="card2"></div>' +
        '<div class="og-card" card-id="card3"></div>'
      );

      await service.checkIntegrity();

      expect(mockFileLinkService.getCardLinks).toHaveBeenCalledTimes(3);
    });

    it('should collect and log integrity check statistics', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1', 'card2']);

      // card1 - имеет сломанную пользовательскую заметку и сломанное изображение
      mockFileLinkService.getCardLinks
        .mockReturnValueOnce({
          userNotePaths: ['deleted-note.md'],
          generatedNotePath: 'deleted-generated.md',
          imagePaths: new Set(['deleted-image.png'])
        })
        // cleanupBrokenLinks вызывает getCardLinks снова для card1
        .mockReturnValueOnce({
          userNotePaths: [],
          generatedNotePath: 'deleted-generated.md',
          imagePaths: new Set(['deleted-image.png'])
        })
        // card2 - все файлы существуют
        .mockReturnValueOnce({
          userNotePaths: ['existing-note.md'],
          generatedNotePath: null,
          imagePaths: new Set()
        });

      mockFileLinkService.hasUserNotes
        .mockReturnValueOnce(false) // card1 после удаления сломанной заметки
        .mockReturnValueOnce(true); // card2

      // Все файлы не существуют для card1
      mockApp.vault.getAbstractFileByPath
        .mockReturnValueOnce(null) // deleted-note.md
        .mockReturnValueOnce(null) // deleted-generated.md
        .mockReturnValueOnce(null) // deleted-image.png
        .mockReturnValueOnce(createMockTFile('existing-note.md')); // card2

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      // Проверяем что статистика логируется в финальном сообщении
      const completeLog = consoleLogSpy.mock.calls.find(
        call => call[0].includes('Check complete')
      );
      expect(completeLog).toBeDefined();
      expect(completeLog[0]).toContain('Checked 2 cards');
      expect(completeLog[0]).toContain('1 user notes');
      expect(completeLog[0]).toContain('1 generated notes');
      expect(completeLog[0]).toContain('1 images');
      expect(completeLog[0]).toContain('1 orphaned cards');

      consoleLogSpy.mockRestore();
    });

    it('should log number of cards to check', async () => {
      const service = new IntegrityService(
        mockApp as any,
        mockFileLinkService,
        mockImageNotesService
      );

      mockFileLinkService.getAllCardIds.mockReturnValue(['card1', 'card2', 'card3']);
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });
      mockFileLinkService.hasUserNotes.mockReturnValue(true);

      mockApp.vault.getAbstractFileByPath.mockReturnValue(createMockTFile('note.md'));

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.checkIntegrity();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[IntegrityService] Checking 3 cards...'
      );

      consoleLogSpy.mockRestore();
    });
  });
});
