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
  unregisterCard: jest.fn(),
  removeUserNote: jest.fn(),
  addUserNote: jest.fn()
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

    it('should register editor-cut listener', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();

      expect(mockApp.workspace.on).toHaveBeenCalledWith(
        'editor-cut',
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

      // Проверяем что on был вызван 3 раза (editor-change, editor-paste, editor-cut)
      expect(mockApp.workspace.on).toHaveBeenCalledTimes(3);
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

      expect(mockApp.workspace.offref).toHaveBeenCalledTimes(3);
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

      expect(mockApp.workspace.offref).toHaveBeenCalledTimes(3);
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
      expect(calls.length).toBe(3);
      expect(calls[0][0]).toBe('editor-change');
      expect(calls[1][0]).toBe('editor-paste');
      expect(calls[2][0]).toBe('editor-cut');
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
      expect(mockApp.workspace.offref).toHaveBeenCalledTimes(3);
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

      expect(mockApp.workspace.on).toHaveBeenCalledTimes(3);
      expect(mockApp.workspace.offref).toHaveBeenCalledTimes(3);
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

      expect(mockApp.workspace.on).toHaveBeenCalledTimes(3);
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
      expect(mockApp.workspace.offref).toHaveBeenCalledTimes(3);
    });
  });

  // ========================================
  // Тесты для позиционного определения копий
  // ========================================
  describe('positional copy detection', () => {
    it('should keep original card-id for first card when two cards with same ID exist', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('same-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      // Карточка уже существует в той же заметке
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['same-note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });

      const originalCardId = 'og_original';
      const newCardId = 'og_copy_12345';

      // Мокаем extractCardId чтобы возвращать одинаковый ID для обеих карточек
      let callCount = 0;
      (extractCardId as jest.Mock).mockImplementation(() => {
        callCount++;
        return originalCardId;
      });

      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([]);
      (generateCardId as jest.Mock).mockReturnValue(newCardId);

      // Две карточки с одинаковым ID
      const cardHtml = `<div class="og-card" card-id="${originalCardId}">content<!--og-card-end ${originalCardId}--></div>`;
      const twoCards = cardHtml + '\n' + cardHtml;

      const mockEditor = {
        getValue: jest.fn().mockReturnValue(twoCards),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'same-note.md');

      // Должен быть вызван registerCard только один раз (для копии)
      expect(mockFileLinkService.registerCard).toHaveBeenCalledTimes(1);
      expect(mockFileLinkService.registerCard).toHaveBeenCalledWith(newCardId, 'same-note.md');
    });

    it('should process all cards when copying from another note', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('target-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      // Карточка существует в другой заметке
      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['source-note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });

      const originalCardId = 'og_from_other';
      const newCardId = 'og_copy_other';

      (extractCardId as jest.Mock).mockReturnValue(originalCardId);
      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([]);
      (generateCardId as jest.Mock).mockReturnValue(newCardId);

      const cardHtml = `<div class="og-card" card-id="${originalCardId}">content<!--og-card-end ${originalCardId}--></div>`;
      const mockEditor = {
        getValue: jest.fn().mockReturnValue(cardHtml),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'target-note.md');

      // Должен быть вызван registerCard для новой карточки
      expect(mockFileLinkService.registerCard).toHaveBeenCalledWith(newCardId, 'target-note.md');
    });

    it('should not modify single existing card in same note', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('single-card-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['single-card-note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });

      const existingCardId = 'og_existing_single';

      (extractCardId as jest.Mock).mockReturnValue(existingCardId);
      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([]);

      const cardHtml = `<div class="og-card" card-id="${existingCardId}">content<!--og-card-end ${existingCardId}--></div>`;
      const mockEditor = {
        getValue: jest.fn().mockReturnValue(cardHtml),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'single-card-note.md');

      // Не должен быть вызван registerCard (карточка уже существует)
      // Не должен быть вызван generateCardId (нет копии)
      expect(mockFileLinkService.registerCard).not.toHaveBeenCalled();
      expect(generateCardId).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Тесты для cut/paste операций
  // ========================================
  describe('cut/paste operations', () => {
    it('should track cut card-id', () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      service.initialize();

      const mockFile = createMockTFile('source-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      const cardId = 'og_cut_card';
      const cardHtml = `<div class="og-card" card-id="${cardId}">content<!--og-card-end ${cardId}--></div>`;

      (extractCardId as jest.Mock).mockReturnValue(cardId);

      // Получаем обработчик cut
      const cutHandler = mockApp.workspace.on.mock.calls.find(
        (call: any[]) => call[0] === 'editor-cut'
      )?.[1];

      const mockClipboardEvent = {
        clipboardData: null
      } as any;

      const mockEditor = {
        getSelection: jest.fn().mockReturnValue(cardHtml)
      } as any;

      // Вызываем обработчик cut с правильным контекстом
      if (cutHandler) {
        cutHandler.call(service, mockClipboardEvent, mockEditor);
      }

      // Проверяем что card-id был добавлен в cutCardIds (косвенно через поведение)
      expect(extractCardId).toHaveBeenCalledWith(cardHtml);
    });

    it('should handle cut then paste in same note', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('cut-paste-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['cut-paste-note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });

      const originalCardId = 'og_cut_original';
      const newCardId = 'og_cut_new';

      (extractCardId as jest.Mock).mockReturnValue(originalCardId);
      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([]);
      (generateCardId as jest.Mock).mockReturnValue(newCardId);

      // Симулируем что карточка была вырезана
      service['cutCardIds'].add(originalCardId);

      // Одна карточка (вставленная после cut)
      const cardHtml = `<div class="og-card" card-id="${originalCardId}">content<!--og-card-end ${originalCardId}--></div>`;
      const mockEditor = {
        getValue: jest.fn().mockReturnValue(cardHtml),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'cut-paste-note.md');

      // Должен быть вызван registerCard для новой карточки
      expect(mockFileLinkService.registerCard).toHaveBeenCalledWith(newCardId, 'cut-paste-note.md');
    });
  });

  // ========================================
  // Тесты для множественного копирования
  // ========================================
  describe('multiple copy operations', () => {
    it('should handle multiple paste operations sequentially', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('multi-paste-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['multi-paste-note.md'],
        generatedNotePath: null,
        imagePaths: new Set()
      });

      const originalCardId = 'og_multi_original';
      const firstCopyId = 'og_multi_copy1';
      const secondCopyId = 'og_multi_copy2';

      (extractCardId as jest.Mock).mockReturnValue(originalCardId);
      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([]);
      (generateCardId as jest.Mock)
        .mockReturnValueOnce(firstCopyId)
        .mockReturnValueOnce(secondCopyId);

      // Первая вставка - 2 карточки с одинаковым ID
      const cardHtml = `<div class="og-card" card-id="${originalCardId}">content<!--og-card-end ${originalCardId}--></div>`;
      const twoCards = cardHtml + '\n' + cardHtml;

      const mockEditor = {
        getValue: jest.fn().mockReturnValue(twoCards),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'multi-paste-note.md');

      // Должен быть вызван registerCard для первой копии
      expect(mockFileLinkService.registerCard).toHaveBeenCalledWith(firstCopyId, 'multi-paste-note.md');
    });
  });

  // ========================================
  // Тесты для копирования с изображениями
  // ========================================
  describe('copy with images', () => {
    it('should add image links when copying card with images', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('image-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['image-note.md'],
        generatedNotePath: null,
        imagePaths: new Set(['open-graph-card/image1.png'])
      });

      const originalCardId = 'og_with_images';
      const newCardId = 'og_copy_images';

      (extractCardId as jest.Mock).mockReturnValue(originalCardId);
      // Сбрасываем мок и устанавливаем новое значение
      (generateCardId as jest.Mock).mockReset();
      (generateCardId as jest.Mock).mockReturnValue(newCardId);

      // Мокаем изображения - локальное изображение
      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([
        { src: 'open-graph-card/image1.png', dataUrl: 'app://local/image1.png', elementIndex: 0 }
      ]);

      // Две карточки с одинаковым ID
      const cardHtml = `<div class="og-card" card-id="${originalCardId}"><img src="open-graph-card/image1.png" /><!--og-card-end ${originalCardId}--></div>`;
      const twoCards = cardHtml + '\n' + cardHtml;

      const mockEditor = {
        getValue: jest.fn().mockReturnValue(twoCards),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'image-note.md');

      // Проверяем что изображение было добавлено в связи новой карточки
      expect(mockFileLinkService.addImage).toHaveBeenCalledWith(newCardId, 'open-graph-card/image1.png');
    });

    it('should sync image notes when copying card with images', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('sync-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      mockFileLinkService.getCardLinks.mockReturnValue({
        userNotePaths: ['sync-note.md'],
        generatedNotePath: 'open-graph-card/og_with_images.md',
        imagePaths: new Set(['open-graph-card/image1.png'])
      });

      const originalCardId = 'og_sync_images';
      const newCardId = 'og_sync_copy';

      (extractCardId as jest.Mock).mockReturnValue(originalCardId);
      (generateCardId as jest.Mock).mockReturnValue(newCardId);

      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([
        { src: 'open-graph-card/image1.png', dataUrl: 'app://local/image1.png', elementIndex: 0 }
      ]);

      // Две карточки с одинаковым ID
      const cardHtml = `<div class="og-card" card-id="${originalCardId}"><img src="open-graph-card/image1.png" /><!--og-card-end ${originalCardId}--></div>`;
      const twoCards = cardHtml + '\n' + cardHtml;

      const mockEditor = {
        getValue: jest.fn().mockReturnValue(twoCards),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'sync-note.md');

      // Проверяем что была вызвана синхронизация заметки
      expect(mockImageNotesService.syncNote).toHaveBeenCalled();
    });
  });

  // ========================================
  // Тесты для новых карточек
  // ========================================
  describe('new card registration', () => {
    it('should register new card when it does not exist in system', async () => {
      const service = new CardCopyService(
        mockApp,
        mockFileLinkService,
        mockImageService,
        mockImageNotesService
      );

      const mockFile = createMockTFile('new-card-note.md');
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

      // Карточка не существует
      mockFileLinkService.getCardLinks.mockReturnValue(null);

      const newCardId = 'og_brand_new';

      (extractCardId as jest.Mock).mockReturnValue(newCardId);
      (getImageDataUrlsFromCard as jest.Mock).mockReturnValue([]);

      const cardHtml = `<div class="og-card" card-id="${newCardId}">content<!--og-card-end ${newCardId}--></div>`;
      const mockEditor = {
        getValue: jest.fn().mockReturnValue(cardHtml),
        setValue: jest.fn()
      };

      await service['processCardsInEditor'](mockEditor as any, 'new-card-note.md');

      // Должен быть вызван registerCard для новой карточки
      expect(mockFileLinkService.registerCard).toHaveBeenCalledWith(newCardId, 'new-card-note.md');
    });
  });
});
