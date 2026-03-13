# Debug Mode - AGENTS.md

Debugging information for the Open Graph Card plugin.

## Common Issues

### Card Not Detected in Live Preview
- Check if `posAtDOM()` is throwing - see [`lastContextEventTarget`](src/ui/ContextMenuHandler.ts:28)
- Verify HTML comment markers exist: `<!--og-card-end-->`
- Card parsing regex handles both `<` and `\x3C` escapes

### Proxy Connection Failures
- Check proxy URL format: `http://` or `socks5://` prefix required
- HTTP proxy uses `HttpsProxyAgent`, SOCKS uses `SocksProxyAgent`
- See proxy selection logic in [`FetchService.createAgent()`](src/services/FetchService.ts:17)

### Image Download Issues
- Images use different fetch methods based on proxy setting
- Check [`ImageService.downloadAndSave()`](src/services/ImageService.ts:23) for buffer handling
- Extension extraction from URL pathname may fail silently

### Steam Data Not Loading
- Requires `wants_mature_content=1` cookie for age-gated content
- Screenshots parsed from JSON in `data-props` attribute
- Rating requires both positive and negative vote counts
- See [`SteamParser`](src/parsers/SteamParser.ts) for extraction logic

## Debug Logging Points
- `console.error('Error when extracting a position from the DOM', e)` - posAtDOM failure in [`ContextMenuHandler`](src/ui/ContextMenuHandler.ts)
- `console.error('Clipboard access error', e)` - electron clipboard issues
- `console.error('Error parsing Steam data-props', e)` - JSON parse failure in [`SteamParser`](src/parsers/SteamParser.ts)
- `console.error('Error downloading image', error)` - image fetch failure in [`ImageService`](src/services/ImageService.ts)

## Build Issues
- Must use `node-fetch@2` (CommonJS) - v3+ is ESM only
- Run `npm run build` after changes - no watch mode configured

## Key Files for Debugging
- [`main.ts`](main.ts) - Plugin entry point, card detection logic
- [`src/ui/ContextMenuHandler.ts`](src/ui/ContextMenuHandler.ts) - Context menu, Live Preview integration
- [`src/services/FetchService.ts`](src/services/FetchService.ts) - HTTP requests, proxy handling
- [`src/services/ImageService.ts`](src/services/ImageService.ts) - Image download and management
- [`src/parsers/SteamParser.ts`](src/parsers/SteamParser.ts) - Steam-specific data extraction
- [`src/utils/html.ts`](src/utils/html.ts) - HTML parsing utilities
