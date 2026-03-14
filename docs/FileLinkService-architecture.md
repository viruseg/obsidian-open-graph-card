# Архитектура FileLinkService

## Обзор

`FileLinkService` — сервис для отслеживания связей между файлами в плагине obsidian-open-graph-card. Обеспечивает целостность данных при удалении и переименовании файлов.

## Структура данных

### Основная структура связей

```typescript
interface FileLinksData {
  // card-id → информация о связях
  [cardId: string]: CardLinks;
}

interface CardLinks {
  /** Путь к пользовательской заметке, содержащей карточку */
  userNotePath: string;
  
  /** Путь к сгенерированной заметке с ссылками на изображения */
  generatedNotePath: string | null;
  
  /** Множество путей к локальным изображениям карточки */
  imagePaths: string[];
}
```

### Обратные индексы для быстрого поиска

```typescript
interface FileLinkIndexes {
  /** Путь любого файла → card-id */
  pathToCardId: Map<string, string>;
  
  /** card-id → данные о связях */
  cardIdToLinks: Map<string, CardLinks>;
}
```

### Сериализация

Для сохранения в `data.json` используется преобразование:

```typescript
// Сохранение: Map → Record
function serialize(indexes: FileLinkIndexes): Record<string, CardLinks> {
  const result: Record<string, CardLinks> = {};
  for (const [cardId, links] of indexes.cardIdToLinks) {
    result[cardId] = links;
  }
  return result;
}

// Загрузка: Record → Map
function deserialize(data: Record<string, CardLinks>): FileLinkIndexes {
  const pathToCardId = new Map<string, string>();
  const cardIdToLinks = new Map<string, CardLinks>();
  
  for (const [cardId, links] of Object.entries(data)) {
    cardIdToLinks.set(cardId, links);
    
    // Строим обратный индекс
    pathToCardId.set(links.userNotePath, cardId);
    if (links.generatedNotePath) {
      pathToCardId.set(links.generatedNotePath, cardId);
    }
    for (const imagePath of links.imagePaths) {
      pathToCardId.set(imagePath, cardId);
    }
  }
  
  return { pathToCardId, cardIdToLinks };
}
```

## TypeScript интерфейсы

### Типы данных

```typescript
// src/types/links.ts

/** Связи карточки с файлами */
export interface CardLinks {
  userNotePath: string;
  generatedNotePath: string | null;
  imagePaths: string[];
}

/** Данные для сохранения в data.json */
export type FileLinksData = Record<string, CardLinks>;

/** Результат поиска связей */
export interface FileLinkSearchResult {
  cardId: string;
  links: CardLinks;
}

/** События плагина */
export interface FileLinkEvents {
  'og-card-created': { cardId: string; userNotePath: string };
  'og-card-deleted': { cardId: string };
  'og-card-images-downloaded': { cardId: string; imagePaths: string[] };
  'og-card-images-restored': { cardId: string };
}
```

### Интерфейс сервиса

```typescript
// src/services/FileLinkService.ts

export interface IFileLinkService {
  // === Управление связями ===
  
  /** Зарегистрировать новую карточку */
  registerCard(cardId: string, userNotePath: string): void;
  
  /** Удалить регистрацию карточки */
  unregisterCard(cardId: string): void;
  
  /** Обновить связи изображений карточки */
  updateImageLinks(cardId: string, imagePaths: string[]): void;
  
  /** Обновить путь к сгенерированной заметке */
  updateGeneratedNotePath(cardId: string, notePath: string | null): void;
  
  // === Поиск связей ===
  
  /** Найти card-id по пути файла */
  findCardIdByPath(path: string): string | null;
  
  /** Получить связи по card-id */
  getLinks(cardId: string): CardLinks | null;
  
  /** Получить все пути файлов для card-id */
  getAllPaths(cardId: string): string[];
  
  // === Обработка событий ===
  
  /** Обработать удаление файла */
  handleFileDelete(path: string): Promise<void>;
  
  /** Обработать переименование файла */
  handleFileRename(oldPath: string, newPath: string): Promise<void>;
  
  // === Персистентность ===
  
  /** Загрузить данные из data.json */
  loadData(): Promise<void>;
  
  /** Сохранить данные в data.json */
  saveData(): Promise<void>;
}
```

## Методы FileLinkService

### Основные методы

| Метод | Описание |
|-------|----------|
| `registerCard(cardId, userNotePath)` | Регистрирует новую карточку при её создании |
| `unregisterCard(cardId)` | Удаляет все связи карточки при её удалении |
| `updateImageLinks(cardId, imagePaths)` | Обновляет список путей к изображениям |
| `updateGeneratedNotePath(cardId, notePath)` | Обновляет путь к сгенерированной заметке |

### Методы поиска

| Метод | Описание |
|-------|----------|
| `findCardIdByPath(path)` | Находит card-id по любому связанному пути |
| `getLinks(cardId)` | Возвращает все связи карточки |
| `getAllPaths(cardId)` | Возвращает все пути файлов карточки |

### Методы обработки событий

| Метод | Описание |
|-------|----------|
| `handleFileDelete(path)` | Обрабатывает удаление файла через vault.on('delete') |
| `handleFileRename(oldPath, newPath)` | Обрабатывает переименование файла через vault.on('rename') |

## Диаграмма взаимодействия компонентов

```mermaid
flowchart TB
    subgraph Plugin[OpenGraphPlugin]
        A[main.ts]
        B[PluginContext]
    end
    
    subgraph Services
        C[FileLinkService]
        D[ImageNotesService]
        E[ImageService]
    end
    
    subgraph UI
        F[ContextMenuHandler]
    end
    
    subgraph Events
        G[vault.on delete]
        H[vault.on rename]
        I[workspace.trigger]
    end
    
    A --> B
    B --> C
    B --> D
    B --> E
    
    F -->|create card| C
    F -->|download images| E
    F -->|sync note| D
    
    D -->|updateGeneratedNotePath| C
    E -->|updateImageLinks| C
    
    G -->|handleFileDelete| C
    H -->|handleFileRename| C
    
    C -->|deleteNote| D
    C -->|deleteLocalImages| E
    C -->|restoreCardImages| E
    
    I -->|og-card-created| C
    I -->|og-card-deleted| C
```

## Потоки событий

### 1. Создание карточки

```mermaid
sequenceDiagram
    participant User
    participant ContextMenuHandler
    participant FileLinkService
    participant ImageNotesService
    participant Plugin
    
    User->>ContextMenuHandler: Create card
    ContextMenuHandler->>FileLinkService: registerCard(cardId, notePath)
    ContextMenuHandler->>Plugin: workspace.trigger(og-card-created)
    Plugin->>FileLinkService: saveData()
```

### 2. Скачивание изображений

```mermaid
sequenceDiagram
    participant User
    participant ContextMenuHandler
    participant ImageService
    participant ImageNotesService
    participant FileLinkService
    
    User->>ContextMenuHandler: Download images
    ContextMenuHandler->>ImageService: downloadCardImages()
    ImageService-->>ContextMenuHandler: imagePaths[]
    ContextMenuHandler->>FileLinkService: updateImageLinks(cardId, imagePaths)
    ContextMenuHandler->>ImageNotesService: syncNote(cardId, cardHtml)
    ImageNotesService->>FileLinkService: updateGeneratedNotePath(cardId, notePath)
    FileLinkService->>FileLinkService: saveData()
```

### 3. Удаление пользовательской заметки

```mermaid
sequenceDiagram
    participant Vault
    participant FileLinkService
    participant ImageNotesService
    participant ImageService
    
    Vault->>FileLinkService: handleFileDelete(userNotePath)
    FileLinkService->>FileLinkService: findCardIdByPath(userNotePath)
    
    alt Card found
        FileLinkService->>FileLinkService: getLinks(cardId)
        
        alt Has generated note
            FileLinkService->>ImageNotesService: deleteNote(cardId)
        end
        
        alt Has local images
            FileLinkService->>ImageService: deleteLocalImages(imagePaths)
        end
        
        FileLinkService->>FileLinkService: unregisterCard(cardId)
        FileLinkService->>FileLinkService: saveData()
    end
```

### 4. Удаление сгенерированной заметки

```mermaid
sequenceDiagram
    participant Vault
    participant FileLinkService
    participant ImageService
    participant Editor
    
    Vault->>FileLinkService: handleFileDelete(generatedNotePath)
    FileLinkService->>FileLinkService: findCardIdByPath(generatedNotePath)
    
    alt Card found
        FileLinkService->>FileLinkService: getLinks(cardId)
        
        alt Has local images
            loop For each image
                FileLinkService->>ImageService: restoreImageUrl(imagePath)
                ImageService-->>FileLinkService: originalUrl
                FileLinkService->>Editor: updateCardInNote(userNotePath, cardId, newHtml)
            end
            
            FileLinkService->>ImageService: deleteLocalImages(imagePaths)
        end
        
        FileLinkService->>FileLinkService: updateGeneratedNotePath(cardId, null)
        FileLinkService->>FileLinkService: updateImageLinks(cardId, [])
        FileLinkService->>FileLinkService: saveData()
    end
```

### 5. Удаление изображения

```mermaid
sequenceDiagram
    participant Vault
    participant FileLinkService
    participant ImageNotesService
    participant Editor
    
    Vault->>FileLinkService: handleFileDelete(imagePath)
    FileLinkService->>FileLinkService: findCardIdByPath(imagePath)
    
    alt Card found
        FileLinkService->>FileLinkService: getLinks(cardId)
        
        Note over FileLinkService: Find image index in card
        FileLinkService->>FileLinkService: extractDataUrlFromCard(cardHtml, imageIndex)
        
        alt Has data-url
            FileLinkService->>Editor: replaceImageInNote(userNotePath, cardId, imageIndex, dataUrl)
        end
        
        FileLinkService->>FileLinkService: removeImageFromLinks(cardId, imagePath)
        FileLinkService->>ImageNotesService: syncNote(cardId, newCardHtml)
        FileLinkService->>FileLinkService: saveData()
    end
```

### 6. Переименование файла

```mermaid
sequenceDiagram
    participant Vault
    participant FileLinkService
    participant Editor
    participant ImageNotesService
    
    Vault->>FileLinkService: handleFileRename(oldPath, newPath)
    FileLinkService->>FileLinkService: findCardIdByPath(oldPath)
    
    alt Card found
        FileLinkService->>FileLinkService: getLinks(cardId)
        
        alt Is user note
            FileLinkService->>FileLinkService: updateUserNotePath(cardId, newPath)
        end
        
        alt Is generated note
            FileLinkService->>FileLinkService: updateGeneratedNotePath(cardId, newPath)
        end
        
        alt Is image
            FileLinkService->>Editor: updateImagePathInNote(userNotePath, cardId, oldPath, newPath)
            FileLinkService->>FileLinkService: updateImagePath(cardId, oldPath, newPath)
            FileLinkService->>ImageNotesService: syncNote(cardId, newCardHtml)
        end
        
        FileLinkService->>FileLinkService: saveData()
    end
```

## Интеграция с существующей архитектурой

### Изменения в PluginContext

```typescript
// src/core/PluginContext.ts
import { FileLinkService } from '../services/FileLinkService';

export class PluginContext {
    readonly fileLinkService: FileLinkService;
    
    constructor(app: App, getSettings: () => OpenGraphSettings, plugin: Plugin) {
        // ... existing services
        
        this.fileLinkService = new FileLinkService(app, plugin);
    }
}
```

### Изменения в main.ts

```typescript
// main.ts
export default class OpenGraphPlugin extends Plugin {
    async onload() {
        // ... existing initialization
        
        // Загружаем связи
        await this.context.fileLinkService.loadData();
        
        // Регистрируем обработчики событий
        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile) {
                    this.context.fileLinkService.handleFileDelete(file.path);
                }
            })
        );
        
        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                if (file instanceof TFile) {
                    this.context.fileLinkService.handleFileRename(oldPath, file.path);
                }
            })
        );
    }
}
```

### Изменения в ContextMenuHandler

```typescript
// src/ui/ContextMenuHandler.ts
// При создании карточки:
this.context.fileLinkService.registerCard(cardId, notePath);

// При скачивании изображений:
this.context.fileLinkService.updateImageLinks(cardId, imagePaths);

// При удалении карточки:
this.context.fileLinkService.unregisterCard(cardId);
```

### Изменения в ImageNotesService

```typescript
// src/services/ImageNotesService.ts
// После создания/обновления заметки:
this.fileLinkService.updateGeneratedNotePath(cardId, notePath);

// После удаления заметки:
this.fileLinkService.updateGeneratedNotePath(cardId, null);
```

## Кастомные события

```typescript
// Определение событий
declare module 'obsidian' {
    interface Workspace {
        on(name: 'og-card-created', callback: (data: { cardId: string; userNotePath: string }) => void, ctx?: any): EventRef;
        on(name: 'og-card-deleted', callback: (data: { cardId: string }) => void, ctx?: any): EventRef;
        on(name: 'og-card-images-downloaded', callback: (data: { cardId: string; imagePaths: string[] }) => void, ctx?: any): EventRef;
        on(name: 'og-card-images-restored', callback: (data: { cardId: string }) => void, ctx?: any): EventRef;
    }
}

// Триггеры
this.app.workspace.trigger('og-card-created', { cardId, userNotePath });
this.app.workspace.trigger('og-card-deleted', { cardId });
this.app.workspace.trigger('og-card-images-downloaded', { cardId, imagePaths });
this.app.workspace.trigger('og-card-images-restored', { cardId });
```

## Обработка ошибок

```typescript
class FileLinkService {
    private async safeSaveData(): Promise<void> {
        try {
            await this.saveData();
        } catch (error) {
            console.error('FileLinkService: Failed to save data', error);
            // Не прерываем выполнение, данные можно восстановить
        }
    }
    
    private async safeDeleteFile(path: string): Promise<boolean> {
        try {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                await this.app.vault.delete(file);
                return true;
            }
        } catch (error) {
            console.error(`FileLinkService: Failed to delete ${path}`, error);
        }
        return false;
    }
}
```

## Производительность

- **Обратный индекс** `pathToCardId` обеспечивает O(1) поиск card-id по пути
- **Сохранение данных** только при изменениях (не при каждом событии)
- **Batch операции** для массовых изменений (например, при удалении папки)

## Тестирование

Ключевые сценарии для тестирования:

1. Создание карточки → проверка регистрации связей
2. Скачивание изображений → проверка обновления путей
3. Удаление пользовательской заметки → проверка каскадного удаления
4. Удаление сгенерированной заметки → проверка восстановления URL
5. Удаление изображения → проверка обновления карточки
6. Переименование файлов → проверка обновления всех путей
7. Перезапуск плагина → проверка загрузки данных
