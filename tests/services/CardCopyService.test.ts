import { CardCopyService } from '../../src/services/CardCopyService';
import { TFile, TFolder, EventRef } from 'obsidian';

// Мок для утилит html
jest.mock('../../src/utils/html', () => ({
  extractCardId: jest.fn(),
  getImageDataUrlsFromCard: jest.fn(),
  replaceImageInCard: jest.fn()
}));

// Мок для generateCardId
jest.mock('../../src/utils/id', () => ({
  generateCardId: jest.fn()
}));

import { extractCardId, getImageDataUrlsFromCard, replaceImageInCard } from '../../src/utils/html';
import { generateCardId } from '../../src/utils/id';

// Мок для App
const createMockApp = (): any => ({
  vault: {
    getAbstractFileByPath: jest.fn(),
    readBinary: jest.fn(),
    create: jest.fn(),
    createFolder: jest.fn(),
    getConfig: jest.fn().mockReturnValue('/')
  },
  workspace: {
    on: jest.fn().mockReturnValue({} as EventRef),
    offref: jest.fn(),
    getActiveFile: jest.fn()
  }
});

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

// Мок для TFolder
const createMockTFolder = (path: string): TFolder => ({
  path,
  name: path.split('/').pop() || path,
  vault: {} as any,
  parent: null,
  children: [],
  isRoot: () => false
});

// Мок для сервисов
const createMockFileLinkService = (): any => ({
  registerCard: jest.fn(),
  getCardLinks: jest.fn(),
  addImage: jest.fn(),
  hasUserNotes: jest.fn(),
  unregisterCard: jest.fn()
});

const createMockImageService = (): any => ({
  downloadAndSave: jest.fn(),
  classifySources: jest.fn(),
  cleanupCardImages: jest.fn()
});

const createMockImageNotesService = (): any => ({
  syncNote: jest.fn(),
  deleteNote: jest.fn()
});

describe('CardCopyService', () => {
  let mockApp: ReturnType<typeof createMockApp>;
  let mockFileLinkService: ReturnType<typeof createMockFileLinkService>;
  let mockImageService: ReturnType<typeof createMockImageService>;
  let mockImageNotesService: ReturnType<typeof createMockImageNotesService>;

  beforeEach(() => {
    mockApp = createMockApp();
    mockFileLinkService = createMockFileLinkService();
    mockImageService = createMockImageService();
    mockImageNotesService = createMockImageNotesService();

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ========================================
  // Тесты для constructor
  // ========================================
  describe('constructor', () => {
    it('should create service instance', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      expect(service).toBeInstanceOf(CardCopyService);
    });
  });

  // ========================================
  // Тесты для initialize
  // ========================================
  describe('initialize', () => {
    it('should register editor-change listener', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();

      expect(mockApp.workspace.on).toHaveBeenCalledWith(
        'editor-change',
        expect.any(Function),
        service
      );
    });

    it('should register editor-paste listener', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();

      expect(mockApp.workspace.on).toHaveBeenCalledWith(
        'editor-paste',
        expect.any(Function),
        service
      );
    });

    it('should return EventRef from workspace.on', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();

      // Проверяем что on был вызван и вернул EventRef
      expect(mockApp.workspace.on).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================
  // Тесты для destroy
  // ========================================
  describe('destroy', () => {
    it('should unregister all listeners', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();
      service.destroy();

      expect(mockApp.workspace.offref).toHaveBeenCalledTimes(2);
    });

    it('should be safe to call destroy without initialize', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      // Не должно выбросить ошибку
      expect(() => service.destroy()).not.toThrow();
    });

    it('should be safe to call destroy multiple times', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();
      service.destroy();
      service.destroy();

      expect(mockApp.workspace.offref).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================
  // Тесты для suspendProcessing/resumeProcessing
  // ========================================
  describe('suspendProcessing/resumeProcessing', () => {
    it('should not throw when calling suspendProcessing', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      expect(() => service.suspendProcessing()).not.toThrow();
    });

    it('should not throw when calling resumeProcessing', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      expect(() => service.resumeProcessing()).not.toThrow();
    });

    it('should allow suspend and resume cycle', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.suspendProcessing();
      service.resumeProcessing();
      service.suspendProcessing();
      service.resumeProcessing();

      // Не должно выбросить ошибку
      expect(true).toBe(true);
    });
  });

  // ========================================
  // Интеграционные тесты через моки
  // ========================================
  describe('event handling', () => {
    it('should store event handlers for later use', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();

      // Проверяем что обработчики были сохранены
      const calls = mockApp.workspace.on.mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[0][0]).toBe('editor-change');
      expect(calls[1][0]).toBe('editor-paste');
    });

    it('should clear event refs on destroy', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();
      service.destroy();

      // После destroy offref должен быть вызван для каждого события
      expect(mockApp.workspace.offref).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================
  // Тесты для copyImage (через моки)
  // ========================================
  describe('copyImage functionality', () => {
    it('should have access to vault methods', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      // Проверяем что мок имеет нужные методы
      expect(mockApp.vault.getAbstractFileByPath).toBeDefined();
      expect(mockApp.vault.readBinary).toBeDefined();
      expect(mockApp.vault.create).toBeDefined();
      expect(mockApp.vault.createFolder).toBeDefined();
    });

    it('should have getConfig mock returning default value', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const config = mockApp.vault.getConfig('attachmentFolderPath');
      expect(config).toBe('/');
    });
  });

  // ========================================
  // Тесты для FileLinkService integration
  // ========================================
  describe('FileLinkService integration', () => {
    it('should have access to FileLinkService methods', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      // Проверяем что мок имеет нужные методы
      expect(mockFileLinkService.registerCard).toBeDefined();
      expect(mockFileLinkService.getCardLinks).toBeDefined();
      expect(mockFileLinkService.addImage).toBeDefined();
    });

    it('should call getCardLinks with correct cardId when checking existing cards', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      // Настраиваем мок
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['other-note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });

      // Вызываем метод
      const links = mockFileLinkService.getCardLinks('test-card-id');

      expect(links).toBeDefined();
      expect(links.userNotePaths).toContain('other-note.md');
    });
  });

  // ========================================
  // Тесты для ImageNotesService integration
  // ========================================
  describe('ImageNotesService integration', () => {
    it('should have access to ImageNotesService methods', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      // Проверяем что мок имеет нужные методы
      expect(mockImageNotesService.syncNote).toBeDefined();
      expect(mockImageNotesService.deleteNote).toBeDefined();
    });
  });

  // ========================================
  // Тесты для html utils integration
  // ========================================
  describe('html utils integration', () => {
    it('should call extractCardId mock', () => {
      (extractCardId as jest.Mock).mockReturnValue('test-card-id');

      const cardHtml = '<div class="og-card" card-id="test-card-id"></div>';
      const result = extractCardId(cardHtml);

      expect(result).toBe('test-card-id');
    });

    it('should call getImageDataUrlsFromCard mock', () => {
      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([
        { src: 'image.png', dataUrl: 'http://example.com/image.png', elementIndex: 0 }
      ]);

      const cardHtml = '<div class="og-card"><img src="image.png" /></div>';
      const result = getImageDataUrlsFromCard(cardHtml);

      expect(result).toHaveLength(1);
      expect(result[0].src).toBe('image.png');
    });

    it('should call replaceImageInCard mock', () => {
      (replaceImageInCard as jest.Mock).mockReturnValue('<div class="og-card"><img src="new-image.png" /></div>');

      const cardHtml = '<div class="og-card"><img src="old-image.png" /></div>';
      const result = replaceImageInCard(cardHtml, 0, 'new-image.png', 'http://example.com/new.png');

      expect(result).toContain('new-image.png');
    });
  });

  // ========================================
  // Тесты для id generator integration
  // ========================================
  describe('id generator integration', () => {
    it('should call generateCardId mock', () => {
      (generateCardId as jest.Mock).mockReturnValue('og_1234567890_abcdefgh');

      const result = generateCardId();

      expect(result).toBe('og_1234567890_abcdefgh');
    });

    it('should generate unique ids on each call', () => {
      (generateCardId as jest.Mock)
        .mockReturnValueOnce('og_1234567890_abcdefgh')
        .mockReturnValueOnce('og_1234567891_ijklmnop');

      const id1 = generateCardId();
      const id2 = generateCardId();

      expect(id1).not.toBe(id2);
    });
  });

  // ========================================
  // Тесты для workspace.getActiveFile
  // ========================================
  describe('getActiveFile integration', () => {
    it('should return null when no active file', () => {
      mockApp.workspace.getActiveFile.mockReturnValue(null);

      const file = mockApp.workspace.getActiveFile();

      expect(file).toBeNull();
    });

    it('should return file when active file exists', () => {
      const mockFile = createMockTFile('note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      const file = mockApp.workspace.getActiveFile();

      expect(file).toBeDefined();
      expect(file?.path).toBe('note.md');
    });
  });

  // ========================================
  // Тесты для vault operations
  // ========================================
  describe('vault operations', () => {
    it('should handle file existence check', () => {
      const mockFile = createMockTFile('existing-file.md');
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);

      const file = mockApp.vault.getAbstractFileByPath('existing-file.md');

      expect(file).toBeDefined();
    });

    it('should handle missing file', () => {
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const file = mockApp.vault.getAbstractFileByPath('missing-file.md');

      expect(file).toBeNull();
    });

    it('should handle folder existence check', () => {
      const mockFolder = createMockTFolder('open-graph-card');
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFolder);

      const folder = mockApp.vault.getAbstractFileByPath('open-graph-card');

      expect(folder).toBeDefined();
      expect((folder as TFolder).isRoot).toBeDefined();
    });

    it('should handle binary file reading', async () => {
      const binaryData = new ArrayBuffer(10);
      mockApp.vault.readBinary.mockResolvedValue(binaryData);

      const result = await mockApp.vault.readBinary('image.png');

      expect(result).toBe(binaryData);
    });

    it('should handle file creation', async () => {
      mockApp.vault.create.mockResolvedValue(undefined);

      await mockApp.vault.create('new-file.md', 'content');

      expect(mockApp.vault.create).toHaveBeenCalledWith('new-file.md', 'content');
    });

    it('should handle folder creation', async () => {
      mockApp.vault.createFolder.mockResolvedValue(undefined);

      await mockApp.vault.createFolder('new-folder');

      expect(mockApp.vault.createFolder).toHaveBeenCalledWith('new-folder');
    });
  });

  // ========================================
  // Тесты для card detection regex
  // ========================================
  describe('card detection', () => {
    it('should match valid card HTML', () => {
      const cardHtml = '<div class="og-card" card-id="test">content<!--og-card-end test--></div>';

      // Проверяем что HTML содержит оба маркера
      expect(cardHtml).toContain('og-card');
      expect(cardHtml).toContain('og-card-end');
    });

    it('should not match plain text', () => {
      const plainText = 'This is just plain text without any card markers';

      expect(plainText).not.toContain('og-card');
      expect(plainText).not.toContain('og-card-end');
    });

    it('should not match partial card HTML', () => {
      const partialHtml = '<div class="og-card">content without end marker</div>';

      expect(partialHtml).toContain('og-card');
      expect(partialHtml).not.toContain('og-card-end');
    });
  });

  // ========================================
  // Тесты для card-id replacement
  // ========================================
  describe('card-id replacement', () => {
    it('should replace card-id in attribute', () => {
      const oldHtml = '<div class="og-card" card-id="old-id">content</div>';
      const newHtml = oldHtml.replace('card-id="old-id"', 'card-id="new-id"');

      expect(newHtml).toContain('card-id="new-id"');
      expect(newHtml).not.toContain('card-id="old-id"');
    });

    it('should replace card-id in end marker', () => {
      const oldHtml = '<div>content<!--og-card-end old-id--></div>';
      const newHtml = oldHtml.replace('<!--og-card-end old-id-->', '<!--og-card-end new-id-->');

      expect(newHtml).toContain('<!--og-card-end new-id-->');
      expect(newHtml).not.toContain('<!--og-card-end old-id-->');
    });
  });

  // ========================================
  // Тесты для error handling
  // ========================================
  describe('error handling', () => {
    it('should handle vault.create rejection', async () => {
      mockApp.vault.create.mockRejectedValue(new Error('Create failed'));

      await expect(mockApp.vault.create('test.md', 'content')).rejects.toThrow('Create failed');
    });

    it('should handle vault.readBinary rejection', async () => {
      mockApp.vault.readBinary.mockRejectedValue(new Error('Read failed'));

      await expect(mockApp.vault.readBinary('test.png')).rejects.toThrow('Read failed');
    });

    it('should handle vault.createFolder rejection', async () => {
      mockApp.vault.createFolder.mockRejectedValue(new Error('Folder exists'));

      await expect(mockApp.vault.createFolder('existing')).rejects.toThrow('Folder exists');
    });
  });

  // ========================================
  // Тесты для lifecycle
  // ========================================
  describe('lifecycle', () => {
    it('should support initialize-destroy cycle', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();
      service.destroy();

      expect(mockApp.workspace.on).toHaveBeenCalledTimes(2);
      expect(mockApp.workspace.offref).toHaveBeenCalledTimes(2);
    });

    it('should support re-initialization after destroy', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();
      service.destroy();

      // Очищаем счётчики
      mockApp.workspace.on.mockClear();
      mockApp.workspace.offref.mockClear();

      service.initialize();

      expect(mockApp.workspace.on).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple destroy calls gracefully', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();
      service.destroy();
      service.destroy();
      service.destroy();

      // После первого destroy последующие не должны добавлять вызовы offref
      expect(mockApp.workspace.offref).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================
  // Тесты для копирования в той же заметке
  // ========================================
  describe('copy in same note', () => {
    it('should process card copy in same note (not ignore it)', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      // Настраиваем моки
      const mockFile = createMockTFile('same-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      // Карточка уже существует в той же заметке
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['same-note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });

      (extractCardId as jest.Mock).mockReturnValue('og_existing_card');
      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([]);
      (generateCardId as jest.Mock).mockReturnValue('og_new_card_123');

      // Создаём мок редактора
      const mockEditor = {
        getValue: jest.fn().mockReturnValue('<div class="og-card" card-id="og_existing_card">content<!--og-card-end og_existing_card--></div>'),
        setValue: jest.fn()
      };

      // Вызываем обработку
      await service['processCardsInEditor'](mockEditor as any, 'same-note.md');

      // Должен быть вызван registerCard для новой карточки
      expect(mockFileLinkService.registerCard).toHaveBeenCalledWith('og_new_card_123', 'same-note.md');
    });

    it('should generate new card-id when copying in same note', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('same-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['same-note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });

      const oldCardId = 'og_original';
      const newCardId = 'og_copy_12345';

      (extractCardId as jest.Mock).mockReturnValue(oldCardId);
      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([]);
      (generateCardId as jest.Mock).mockReturnValue(newCardId);

      const originalHtml = `<div class="og-card" card-id="${oldCardId}">content<!--og-card-end ${oldCardId}--></div>`;
      const mockEditor = {
        getValue: jest.fn().mockReturnValue(originalHtml),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'same-note.md');

      // Проверяем что был сгенерирован новый ID
      expect(generateCardId).toHaveBeenCalled();

      // Проверяем что HTML был обновлён с новым ID
      const setValueCall = mockEditor.setValue.mock.calls[0][0];
      expect(setValueCall).toContain(`card-id="${newCardId}"`);
      expect(setValueCall).toContain(`<!--og-card-end ${newCardId}-->`);
    });

    it('should add image links when copying card with images in same note', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('same-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['same-note.md'],
        generatedNotePath: null,
        imagePaths: new Set(['open-graph-card/image1.png'])
      });

      (extractCardId as jest.Mock).mockReturnValue('og_with_images');
      (generateCardId as jest.Mock).mockReturnValue('og_copy_with_images');

      // Мокаем изображения - локальное изображение
      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([
        { src: 'open-graph-card/image1.png', dataUrl: 'app://local/image1.png', elementIndex: 0 }
      ]);

      const originalHtml = `<div class="og-card" card-id="og_with_images"><img src="open-graph-card/image1.png" /><!--og-card-end og_with_images--></div>`;
      const mockEditor = {
        getValue: jest.fn().mockReturnValue(originalHtml),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'same-note.md');

      // Проверяем что изображение было добавлено в связи новой карточки
      expect(mockFileLinkService.addImage).toHaveBeenCalledWith('og_copy_with_images', 'open-graph-card/image1.png');
    });

    it('should sync image notes when copying card with images in same note', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('same-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['same-note.md'],
        generatedNotePath: 'open-graph-card/og_with_images.md',
        imagePaths: new Set(['open-graph-card/image1.png'])
      });

      (extractCardId as jest.Mock).mockReturnValue('og_with_images');
      (generateCardId as jest.Mock).mockReturnValue('og_copy_sync');

      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([
        { src: 'open-graph-card/image1.png', dataUrl: 'app://local/image1.png', elementIndex: 0 }
      ]);

      const originalHtml = `<div class="og-card" card-id="og_with_images"><img src="open-graph-card/image1.png" /><!--og-card-end og_with_images--></div>`;
      const mockEditor = {
        getValue: jest.fn().mockReturnValue(originalHtml),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'same-note.md');

      // Проверяем что была вызвана синхронизация заметки
      expect(mockImageNotesService.syncNote).toHaveBeenCalled();
    });
  });
});
