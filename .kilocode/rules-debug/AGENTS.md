# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build Commands
- Build: `npm run build` (uses esbuild with `--platform=node --external:obsidian --external:electron --format=cjs`)
- No lint or test commands configured

## Architecture Overview

```mermaid
flowchart TB
    subgraph Entry
        A[main.ts] --> B[OpenGraphPlugin]
    end
    
    subgraph Core
        B --> C[PluginContext]
    end
    
    subgraph Services
        E[FetchService]
        F[FileLinkService]
        G[ImageService]
        H[ImageNotesService]
    end
    
    subgraph Parsers
        I[OpenGraphParser]
        J[SteamParser]
        K[ParserRegistry]
    end
    
    subgraph Builders
        L[CardBuilder]
        M[HtmlBuilder]
    end
    
    subgraph UI
        N[ContextMenuHandler]
        O[SettingsTab]
        P[CardDescriptionModal]
    end
    
    subgraph Utils
        Q[editor.ts]
        R[html.ts]
        S[constants.ts]
    end
    
    B --> N
    N --> E
    N --> F
    N --> G
    N --> H
    C --> E
    C --> F
    C --> G
    C --> H
    E --> I
    B --> M
    F --> G
    F --> H
```

## Project Structure

```
src/
├── types/              # TypeScript interfaces and types
│   ├── index.ts        # Re-exports all types
│   ├── settings.ts     # OpenGraphSettings, DEFAULT_SETTINGS
│   ├── card.ts         # CardData, CardInfo, UrlInfo, RatingData, ScreenshotData
│   ├── image.ts        # ImageSourceClassification, ImageDataUrlInfo, ImageDownloadResult, ImageRestoreResult
│   └── fileLinks.ts    # CardLinks, FileLinkIndexes, FileLinksData, FileLinkInfo, FileDeletedEventData, FileRenamedEventData
│
├── core/
│   └── PluginContext.ts    # Dependency Injection container
│
├── services/
│   ├── FetchService.ts     # HTTP requests with proxy support
│   ├── FileLinkService.ts  # File links tracking and events
│   ├── ImageService.ts     # Image download, classification, cleanup
│   └── ImageNotesService.ts # Image notes synchronization
│
├── parsers/
│   ├── OpenGraphParser.ts  # Abstract base parser + DefaultParser
│   ├── SteamParser.ts      # Steam-specific parser
│   └── ParserRegistry.ts   # Parser selection by hostname
│
├── builders/
│   ├── CardBuilder.ts      # CardData builder pattern
│   └── HtmlBuilder.ts      # HTML markup generation
│
├── ui/
│   ├── ContextMenuHandler.ts   # Context menu logic
│   ├── SettingsTab.ts          # Settings UI
│   └── modals/
│       └── CardDescriptionModal.ts
│
└── utils/
    ├── constants.ts       # CSS_CLASSES, STEAM_RATING_CLASSES, CARD_BOUNDS
    ├── editor.ts          # getUrlUnderCursor, setCursorWithScrollPrevention
    └── html.ts            # escapeHTML, extractCardId, extractUrl, extractUserText, getImageDataUrlsFromCard, replaceImageInCard
```

## Key Modules

### PluginContext ([`src/core/PluginContext.ts`](src/core/PluginContext.ts))
Dependency Injection container that holds:
- `app: App` - Obsidian app instance
- `getSettings: () => OpenGraphSettings` - Settings accessor
- `fetchService: FetchService` - HTTP requests
- `fileLinkService: FileLinkService` - File links tracking and events
- `imageService: ImageService` - Image operations
- `imageNotesService: ImageNotesService` - Image notes synchronization

### FetchService ([`src/services/FetchService.ts`](src/services/FetchService.ts))
- [`fetchHtml()`](src/services/FetchService.ts:44) - Fetch HTML content with optional proxy
- [`fetchBinary()`](src/services/FetchService.ts:80) - Fetch binary data (images)
- [`createAgent()`](src/services/FetchService.ts:17) - Creates proxy agent (HTTP/SOCKS5)

### FileLinkService ([`src/services/FileLinkService.ts`](src/services/FileLinkService.ts))
- [`registerCard()`](src/services/FileLinkService.ts:53) — Register card with user note path
- [`setGeneratedNote()`](src/services/FileLinkService.ts:80) — Set generated note path
- [`addImage()`](src/services/FileLinkService.ts:126) — Add image to card links
- [`removeImage()`](src/services/FileLinkService.ts:144) — Remove image from card links
- [`unregisterCard()`](src/services/FileLinkService.ts:162) — Remove card and all links
- [`findFileLink()`](src/services/FileLinkService.ts:200) — Find card by file path
- [`handleFileDelete()`](src/services/FileLinkService.ts:309) — Handle file deletion events
- [`handleFileRename()`](src/services/FileLinkService.ts:342) — Handle file rename events

### ImageService ([`src/services/ImageService.ts`](src/services/ImageService.ts))
- [`downloadAndSave()`](src/services/ImageService.ts:23) - Download and save image to vault
- [`classifySources()`](src/services/ImageService.ts:49) - Classify image sources as local/url/mixed
- [`cleanupCardImages()`](src/services/ImageService.ts:99) - Delete local images when card is removed
- [`classifyCardImageSources()`](src/services/ImageService.ts:114) - Classify card images as URL/local
- [`downloadCardImages()`](src/services/ImageService.ts:141) - Download all remote images in card
- [`restoreCardImages()`](src/services/ImageService.ts:189) - Restore URLs from data-url attributes

### ImageNotesService ([`src/services/ImageNotesService.ts`](src/services/ImageNotesService.ts))
- [`syncNote()`](src/services/ImageNotesService.ts:30) - Synchronize note with card images
- [`deleteNote()`](src/services/ImageNotesService.ts:64) - Delete card's note
- [`getNotePath()`](src/services/ImageNotesService.ts:83) - Get note path by card ID

### ParserRegistry ([`src/parsers/ParserRegistry.ts`](src/parsers/ParserRegistry.ts))
- [`getParser(url)`](src/parsers/ParserRegistry.ts:16) - Returns appropriate parser for URL
- [`registerParser()`](src/parsers/ParserRegistry.ts:41) - Add custom parser
- Singleton instance: [`parserRegistry`](src/parsers/ParserRegistry.ts:47)

### SteamParser ([`src/parsers/SteamParser.ts`](src/parsers/SteamParser.ts))
Extends OpenGraphParser for Steam-specific data:
- Uses `#appHubAppName` for title
- [`extractRating()`](src/parsers/SteamParser.ts:58) - SteamDB Bayesian formula
- [`extractTags()`](src/parsers/SteamParser.ts:103) - Up to 5 popular tags
- [`extractScreenshots()`](src/parsers/SteamParser.ts:114) - From data-props JSON

### HtmlBuilder ([`src/builders/HtmlBuilder.ts`](src/builders/HtmlBuilder.ts))
- [`buildCard()`](src/builders/HtmlBuilder.ts:27) - Generate complete card HTML
- [`buildImage()`](src/builders/HtmlBuilder.ts:37) - Image HTML with data-url attribute
- [`buildRating()`](src/builders/HtmlBuilder.ts:77) - Rating display with CSS class
- [`buildTags()`](src/builders/HtmlBuilder.ts:85) - Tags container
- [`buildScreenshots()`](src/builders/HtmlBuilder.ts:95) - Screenshots grid
- [`generateCardId()`](src/builders/HtmlBuilder.ts:118) - Timestamp-based unique ID

### html.ts utilities ([`src/utils/html.ts`](src/utils/html.ts))
- [`escapeHTML()`](src/utils/html.ts:12) - Escape special HTML characters
- [`extractCardId()`](src/utils/html.ts:28) - Extract card-id from HTML
- [`extractUrl()`](src/utils/html.ts:38) - Extract URL from card HTML
- [`extractUserText()`](src/utils/html.ts:48) - Extract user text from card
- [`getImageSourcesFromCard()`](src/utils/html.ts:68) - Get all img src values
- [`getImageDataUrlsFromCard()`](src/utils/html.ts:89) - Get image data-url info array
- [`replaceImageInCard()`](src/utils/html.ts:123) - Replace image src by index

### ContextMenuHandler ([`src/ui/ContextMenuHandler.ts`](src/ui/ContextMenuHandler.ts))
- [`createHandler()`](src/ui/ContextMenuHandler.ts:40) - Create editor-menu event handler
- [`addCardMenuItems()`](src/ui/ContextMenuHandler.ts:74) - Add card context menu items
- [`addImageMenuItems()`](src/ui/ContextMenuHandler.ts:226) - Add image-related menu items
- [`handleDownloadImages()`](src/ui/ContextMenuHandler.ts:265) - Download images handler
- [`handleRestoreImages()`](src/ui/ContextMenuHandler.ts:306) - Restore image URLs handler

## Architecture Patterns

### Card Boundary Detection
Cards use HTML comment markers for parsing: `<!--og-card-end-->` and `<!--og-user-text-end-->`. These markers are essential for the [`getCardUnderCursor()`](main.ts:49) function to locate card boundaries in markdown.

### Card ID System
Each card has a unique `card-id` attribute (timestamp-based). The end marker includes the ID: `<!--og-card-end {cardId}-->`. This prevents mismatched card boundaries when multiple cards exist.

### Live Preview Integration
Uses CodeMirror's `posAtDOM()` method to map DOM elements back to editor positions. See [`lastContextEventTarget`](src/ui/ContextMenuHandler.ts:28) pattern for context menu handling.

### Steam-Specific Handling
- Detects Steam via `store.steampowered.com` hostname
- Uses `#appHubAppName` element for title (falls back to og:title)
- Rating uses SteamDB Bayesian formula: `score = average - (average - 0.5) * (2 ** -Math.log10(totalVotes + 1))`
- Screenshots parsed from JSON in `.gamehighlight_desktopcarousel` data-props attribute
- Cookie header `wants_mature_content=1` for 18+ content

### Proxy Architecture
Dual proxy support via `https-proxy-agent` (HTTP) and `socks-proxy-agent` (SOCKS5). Proxy URL prefix determines agent type. See [`createAgent()`](src/services/FetchService.ts:17).

### i18n Pattern
Uses `moment.locale()` for language detection. Translation keys use `{0}`, `{1}` placeholders substituted via [`t()`](i18n/index.ts:6) function.

### CSS Classes
All CSS classes are centralized in [`src/utils/constants.ts`](src/utils/constants.ts):
- `CSS_CLASSES` - Card structure classes (og-card, og-image, og-content, etc.)
- `STEAM_RATING_CLASSES` - Rating display classes (steamdb_rating_good, etc.)

### Card Bounds Constants
Defined in [`CARD_BOUNDS`](src/utils/constants.ts:24):
- `LOOK_UP_LINES: 10` - Lines to search upward for card start
- `LOOK_DOWN_LINES: 10` - Lines to search downward for card start
- `LOOK_FORWARD_LINES: 20` - Lines to search forward for card end

### Image Notes Sync
Each card with local images has a corresponding note file with markdown links.
Notes are stored in `{attachmentFolderPath}/open-graph-card/{card-id}.md`.
The [`ImageNotesService`](src/services/ImageNotesService.ts) maintains sync between card content and note file.
- Note created when card has local images
- Note updated when images are added/removed
- Note deleted when card is deleted or has no local images

## File Links Architecture

### Links Structure
Each card can have the following links:
- **User Note ↔ Card** — User's markdown file containing the card
- **Generated Note ↔ Card** — Auto-generated note with image links (named `{card-id}.md`)
- **Images ↔ Card** — Local image files downloaded from card

### Event Flow
1. **Card Created** → `registerCard(cardId, userNotePath)`
2. **Images Downloaded** → `addImage(cardId, imagePath)` for each image
3. **Generated Note Created** → `setGeneratedNote(cardId, notePath)`

### File Deletion Handling
- **User Note Deleted** → Delete generated note, remove all links
- **Generated Note Deleted** → Delete all local images, remove all links
- **Image Deleted** → Update generated note, replace local path with URL in card

### Custom Events
- `og-card-created` — Card created in user note
- `og-card-images-downloaded` — Images downloaded to local storage
- `og-card-images-restored` — Images restored to remote URLs
- `og-card:user-note-deleted` — User note file deleted
- `og-card:generated-note-deleted` — Generated note file deleted
- `og-card:image-deleted` — Linked image file deleted
- `og-card:file-renamed` — Linked file renamed

## Extension Points

### Adding a New Parser
1. Create a class extending [`OpenGraphParser`](src/parsers/OpenGraphParser.ts:6)
2. Implement `canParse(hostname: string): boolean`
3. Implement `parse(doc: Document, url: string): Promise<CardData>`
4. Register via [`parserRegistry.registerParser()`](src/parsers/ParserRegistry.ts:41)

### Adding New Card Features
1. Extend [`CardData`](src/types/card.ts) interface
2. Update [`CardBuilder`](src/builders/CardBuilder.ts) with new method
3. Update [`HtmlBuilder`](src/builders/HtmlBuilder.ts) to render new feature
4. Add CSS to `styles.css`

## Key Dependencies
- `node-fetch@2` (CommonJS version required for esbuild)
- Obsidian API: `requestUrl()` for non-proxy requests, `node-fetch` for proxy requests
- `https-proxy-agent` and `socks-proxy-agent` for proxy support

## Desktop-Only Requirement
Plugin must remain `isDesktopOnly: true` due to:
- `electron` clipboard access in [`ContextMenuHandler`](src/ui/ContextMenuHandler.ts:184)
- `node-fetch` for proxy support
- File system operations for image management
