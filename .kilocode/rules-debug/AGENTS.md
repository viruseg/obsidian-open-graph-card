# Debug Mode - AGENTS.md

Debugging information for the Open Graph Card plugin.

## Common Issues

### Card Not Detected in Live Preview
- Check if `posAtDOM()` is throwing - see [`lastContextEventTarget`](main.ts:19)
- Verify HTML comment markers exist: `<!--og-card-end-->`
- Card parsing regex handles both `<` and `\x3C` escapes

### Proxy Connection Failures
- Check proxy URL format: `http://` or `socks5://` prefix required
- HTTP proxy uses `HttpsProxyAgent`, SOCKS uses `SocksProxyAgent`
- See proxy selection logic at [`main.ts:340-347`](main.ts:340)

### Image Download Issues
- Images use different fetch methods based on proxy setting
- Check [`downloadAndSaveImage()`](main.ts:269) for buffer handling
- Extension extraction from URL pathname may fail silently

### Steam Data Not Loading
- Requires `wants_mature_content=1` cookie for age-gated content
- Screenshots parsed from JSON in `data-props` attribute
- Rating requires both positive and negative vote counts

## Debug Logging Points
- `console.error('Error when extracting a position from the DOM', e)` - posAtDOM failure
- `console.error('Clipboard access error', e)` - electron clipboard issues
- `console.error('Error parsing Steam data-props', e)` - JSON parse failure
- `console.error('Error downloading image', error)` - image fetch failure

## Build Issues
- Must use `node-fetch@2` (CommonJS) - v3+ is ESM only
- Run `npm run build` after changes - no watch mode configured
