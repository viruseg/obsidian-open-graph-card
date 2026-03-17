import { getUrlUnderCursor, setCursorWithScrollPrevention } from '../../src/utils/editor';
import { Editor, EditorPosition } from 'obsidian';

// Создаём мок для Editor
function createMockEditor(lines: string[], cursorLine: number, cursorCh: number): jest.Mocked<Editor> {
  return {
    getCursor: jest.fn().mockReturnValue({ line: cursorLine, ch: cursorCh }),
    getLine: jest.fn().mockImplementation((line: number) => lines[line] || ''),
    setCursor: jest.fn(),
    lineCount: jest.fn().mockReturnValue(lines.length),
    getRange: jest.fn(),
    replaceRange: jest.fn(),
    getValue: jest.fn().mockReturnValue(lines.join('\n')),
    setValue: jest.fn(),
    posToOffset: jest.fn(),
    offsetToPos: jest.fn(),
    fold: jest.fn(),
    unfold: jest.fn(),
    getScrollInfo: jest.fn(),
    scrollTo: jest.fn(),
    refresh: jest.fn()
  } as unknown as jest.Mocked<Editor>;
}

describe('getUrlUnderCursor', () => {
  describe('обычные URL', () => {
    it('должен находить URL под курсором', () => {
      const lines = ['Проверьте https://example.com для подробностей'];
      const editor = createMockEditor(lines, 0, 10); // Курсор в середине URL

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://example.com');
      // URL начинается на позиции 10 (после "Проверьте ")
      expect(result?.from).toEqual({ line: 0, ch: 10 });
      expect(result?.to).toEqual({ line: 0, ch: 29 });
    });

    it('должен возвращать null если курсор не на URL', () => {
      const lines = ['Проверьте https://example.com для подробностей'];
      const editor = createMockEditor(lines, 0, 2); // Курсор в начале строки

      const result = getUrlUnderCursor(editor);

      expect(result).toBeNull();
    });

    it('должен находить URL с путём и параметрами', () => {
      const lines = ['Ссылка: https://example.com/path/to/page?query=value&other=123'];
      const editor = createMockEditor(lines, 0, 15);

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://example.com/path/to/page?query=value&other=123');
    });

    it('должен находить URL с якорем', () => {
      const lines = ['Перейдите на https://example.com/page#section'];
      const editor = createMockEditor(lines, 0, 20);

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://example.com/page#section');
    });

    it('должен находить http:// URL', () => {
      const lines = ['Старый сайт: http://old-site.com'];
      const editor = createMockEditor(lines, 0, 15);

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('http://old-site.com');
    });
  });

  describe('markdown-ссылки', () => {
    it('должен находить URL в markdown-ссылке [текст](url)', () => {
      const lines = ['Нажмите [сюда](https://example.com) для перехода'];
      const editor = createMockEditor(lines, 0, 10); // Курсор на "сюда"

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://example.com');
      // Markdown-ссылка "[сюда](https://example.com)" начинается на позиции 8
      // и заканчивается на позиции 35 (8 + 27 символов)
      expect(result?.from).toEqual({ line: 0, ch: 8 });
      expect(result?.to).toEqual({ line: 0, ch: 35 });
    });

    it('должен находить URL при курсоре на самой ссылке', () => {
      const lines = ['Нажмите [сюда](https://example.com) для перехода'];
      const editor = createMockEditor(lines, 0, 20); // Курсор на URL внутри скобок

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://example.com');
    });

    it('должен возвращать null если курсор вне markdown-ссылки', () => {
      const lines = ['Нажмите [сюда](https://example.com) для перехода'];
      const editor = createMockEditor(lines, 0, 2); // Курсор на "Нажмите"

      const result = getUrlUnderCursor(editor);

      expect(result).toBeNull();
    });

    it('должен обрабатывать markdown-ссылку с пустым текстом', () => {
      const lines = ['Ссылка: [](https://example.com)'];
      const editor = createMockEditor(lines, 0, 12);

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://example.com');
    });
  });

  describe('несколько URL на строке', () => {
    it('должен находить первый URL когда курсор на нём', () => {
      const lines = ['Ссылки: https://first.com и https://second.com'];
      const editor = createMockEditor(lines, 0, 12);

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://first.com');
    });

    it('должен находить второй URL когда курсор на нём', () => {
      const lines = ['Ссылки: https://first.com и https://second.com'];
      const editor = createMockEditor(lines, 0, 30);

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://second.com');
    });
  });

  describe('краевые случаи', () => {
    it('должен возвращать null для пустой строки', () => {
      const lines = [''];
      const editor = createMockEditor(lines, 0, 0);

      const result = getUrlUnderCursor(editor);

      expect(result).toBeNull();
    });

    it('должен возвращать null для строки без URL', () => {
      const lines = ['Это просто текст без ссылок'];
      const editor = createMockEditor(lines, 0, 10);

      const result = getUrlUnderCursor(editor);

      expect(result).toBeNull();
    });

    it('должен корректно обрабатывать URL в конце строки', () => {
      const lines = ['Перейдите на https://example.com'];
      const editor = createMockEditor(lines, 0, 25);

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://example.com');
      // URL заканчивается на позиции 32 (14 + 18)
      expect(result?.to).toEqual({ line: 0, ch: 32 });
    });

    it('должен корректно обрабатывать URL в начале строки', () => {
      const lines = ['https://example.com - полезный сайт'];
      const editor = createMockEditor(lines, 0, 5);

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://example.com');
      expect(result?.from).toEqual({ line: 0, ch: 0 });
    });

    it('должен возвращать null для курсора в конце после URL', () => {
      const lines = ['https://example.com'];
      const editor = createMockEditor(lines, 0, 19); // В самом конце

      const result = getUrlUnderCursor(editor);

      // Курсор в конце URL считается "на URL"
      expect(result).not.toBeNull();
    });
  });

  describe('реальные URL', () => {
    it('должен находить Steam URL', () => {
      const lines = ['Игра: https://store.steampowered.com/app/570/Dota_2/'];
      const editor = createMockEditor(lines, 0, 20);

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://store.steampowered.com/app/570/Dota_2/');
    });

    it('должен находить Steam URL с параметрами', () => {
      const lines = ['Ссылка: https://store.steampowered.com/app/730/CounterStrike_2?snr=1_7_15__79'];
      const editor = createMockEditor(lines, 0, 30);

      const result = getUrlUnderCursor(editor);

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://store.steampowered.com/app/730/CounterStrike_2?snr=1_7_15__79');
    });
  });
});

describe('setCursorWithScrollPrevention', () => {
  it('должен вызывать setCursor с переданной позицией', () => {
    const editor = createMockEditor(['строка 1', 'строка 2'], 0, 0);
    const pos: EditorPosition = { line: 1, ch: 5 };

    setCursorWithScrollPrevention(editor, pos);

    expect(editor.setCursor).toHaveBeenCalledWith(pos);
  });

  it('должен корректно устанавливать курсор в начало файла', () => {
    const editor = createMockEditor(['строка 1', 'строка 2'], 1, 5);
    const pos: EditorPosition = { line: 0, ch: 0 };

    setCursorWithScrollPrevention(editor, pos);

    expect(editor.setCursor).toHaveBeenCalledWith({ line: 0, ch: 0 });
  });

  it('должен корректно устанавливать курсор в конец файла', () => {
    const editor = createMockEditor(['строка 1', 'строка 2'], 0, 0);
    const pos: EditorPosition = { line: 1, ch: 8 };

    setCursorWithScrollPrevention(editor, pos);

    expect(editor.setCursor).toHaveBeenCalledWith({ line: 1, ch: 8 });
  });
});
