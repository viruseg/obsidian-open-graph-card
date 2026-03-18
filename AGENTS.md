# AGENTS.md

Инструкции для AI-агентов, работающих с этим репозиторием.

## Команды

### Сборка и тестирование
```bash
npm run build           # Сборка через esbuild
npm test                # Запуск всех тестов
npm run test:coverage   # Тесты с покрытием кода
npx jest tests/path/to/test.test.ts  # Запуск конкретного тест-файла
npx jest -t "test name"              # Запуск теста по названию
npx jest --watch                     # Режим наблюдения
```

### Линтинг
Линтер не настроен. Проверяйте типы через `npx tsc --noEmit`.

## Архитектура проекта

Obsidian-плагин для отображения ссылок как Open Graph карточек. Карточки управляются через контекстное меню, плагин отслеживает файловые связи.

### Структура
```
src/
├── types/          # TypeScript интерфейсы и типы
├── core/           # PluginContext — DI-контейнер
├── services/       # Бизнес-логика (Fetch, Image, FileLink, etc.)
├── parsers/        # OpenGraphParser + специфичные парсеры (Steam)
├── builders/       # CardBuilder, HtmlBuilder
├── ui/             # ContextMenuHandler, SettingsTab, modals
└── utils/          # Утилиты (html, editor, id, constants)
```

### Ключевые сервисы
- **PluginContext** — DI-контейнер, держит все сервисы
- **FetchService** — HTTP-запросы через Obsidian API
- **FileLinkService** — отслеживание связей карточки↔файлы
- **ImageService** — загрузка/удаление изображений
- **CardCopyService** — обнаружение копирования карточек
- **IntegrityService** — проверка целостности при запуске

### Парсеры
Базовый класс `OpenGraphParser` (abstract). Для добавления нового парсера:
1. Наследовать от `OpenGraphParser`
2. Реализовать `canParse(hostname)` и `parse(doc, url)`
3. Зарегистрировать через `parserRegistry.registerParser()`

## Стиль кода

### TypeScript
- Строгая типизация, явные типы для публичных API
- Интерфейсы в `src/types/`, реэкспорт через `index.ts`
- Константы в `src/utils/constants.ts` с `as const`
- `readonly` для неизменяемых полей

### Форматирование
- Отступы: 4 пробела
- JSDoc-комментарии на русском языке
- Имена: PascalCase для классов/интерфейсов, camelCase для методов/переменных
- Префикс `og-` для CSS-классов карточек

### Импорты
```typescript
import { Something } from 'obsidian';           // Внешние модули
import { LocalType } from '../types';           // Внутренние модули
import { helper } from '../utils/html';         // Утилиты
```

### Экспорты
```typescript
export * from './module';     // В index.ts файлах
export class Service { }      // Для классов
export interface Type { }     // Для типов
```

### Обработка ошиб
```typescript
try {
    await operation();
} catch (error) {
    console.error('Context:', error);
    new Notice(t('errorMessage'));
}
```

### Тестирование
- Jest + ts-jest
- Моки для `obsidian` и `electron` в `tests/__mocks__/`
- Описательные названия тестов на английском: `describe('functionName', () => {})`

## Важные паттерны

### Card ID
Формат: `og_{timestamp}_{random}` (8 символов). Генерация через `generateCardId()`.

### Границы карточки
HTML-маркеры: `<!--og-card-end {cardId}-->`, `<!--og-user-text-end-->`.

### Связи файлов
Карточка отслеживает:
- `userNotePaths: string[]` — заметки пользователя с карточкой
- `generatedNotePath` — автосгенерированная заметка с изображениями
- `imagePaths: Set<string>` — локальные изображения

### События
Кастомные события с префиксом `og-card:` (например, `og-card:image-deleted`).

## Ограничения

- `isDesktopOnly: true` — требуется electron для буфера обмена
- Использовать Obsidian API (`requestUrl`) для HTTP-запросов
- Избегать прямого доступа к файловой системе, использовать `app.vault`
