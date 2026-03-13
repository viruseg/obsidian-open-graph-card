# Code Mode - AGENTS.md

Coding patterns and conventions for the Open Graph Card plugin.

## Code Style

### HTML Generation
- Generate HTML via [`HtmlBuilder`](src/builders/HtmlBuilder.ts) class
- Always include HTML comment markers: `<!--og-card-end-->` and `<!--og-user-text-end-->`
- Use [`escapeHTML()`](src/utils/html.ts) for all user-provided content

### Adding New Translations
1. Add key to [`i18n/en.ts`](i18n/en.ts) first (default fallback)
2. Add same key to [`i18n/ru.ts`](i18n/ru.ts) or other locale files
3. Use placeholders `{0}`, `{1}` for dynamic values
4. Call via `t('key', arg1, arg2)` from [`i18n/index.ts`](i18n/index.ts)

### Proxy Detection Pattern
```typescript
// See FetchService.createAgent()
if (proxyUrl.startsWith('socks')) {
    agent = new SocksProxyAgent(proxyUrl);
} else if (proxyUrl.startsWith('http')) {
    agent = new HttpsProxyAgent(proxyUrl);
}
```

### Fetch Strategy
- Use [`FetchService.fetchHtml()`](src/services/FetchService.ts:44) for HTML content
- Use [`FetchService.fetchBinary()`](src/services/FetchService.ts:80) for binary data (images)
- Always set User-Agent header for external sites

### Steam Detection
Check hostname via parser: [`SteamParser.canParse()`](src/parsers/SteamParser.ts) checks for `store.steampowered.com`

## Module Organization

### Creating New Parser
1. Create class extending [`OpenGraphParser`](src/parsers/OpenGraphParser.ts)
2. Implement `canParse(hostname: string): boolean`
3. Implement `parse(doc: Document, url: string): Promise<CardData>`
4. Register in [`ParserRegistry`](src/parsers/ParserRegistry.ts)

### Creating New Service
1. Create service class in `src/services/`
2. Add to [`PluginContext`](src/core/PluginContext.ts) interface
3. Initialize in [`OpenGraphPlugin`](main.ts) onload method

## Image Operations Pattern
```typescript
// Download images to vault
const { result, updatedHtml } = await imageService.downloadCardImages(cardHtml, cardId, sourcePath, useProxy);
// result.downloadedCount, result.errors

// Restore original URLs
const { result, updatedHtml } = await imageService.restoreCardImages(cardHtml);
// result.restoredCount, result.errors

// Check image sources
const { hasUrlImages, hasLocalImages } = imageService.classifyCardImageSources(cardHtml);
```

## Common Gotchas
- `node-fetch@2` required (CommonJS) - do not upgrade to v3+
- `posAtDOM()` can throw - wrap in try/catch
- Card parsing must handle both `<` and `\x3C` for HTML entities
- CSS classes must use [`CSS_CLASSES`](src/utils/constants.ts) constants
- Local images store original URL in `data-url` attribute
- Use [`replaceImageInCard()`](src/utils/html.ts:123) to update image src while preserving data-url
