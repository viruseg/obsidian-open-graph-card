# Code Mode - AGENTS.md

Coding patterns and conventions for the Open Graph Card plugin.

## Code Style

### HTML Generation
- Generate HTML as template literals with proper indentation
- Always include HTML comment markers: `<!--og-card-end-->` and `<!--og-user-text-end-->`
- Use [`escapeHTML()`](main.ts:512) for all user-provided content

### Adding New Translations
1. Add key to [`i18n/en.ts`](i18n/en.ts) first (default fallback)
2. Add same key to [`i18n/ru.ts`](i18n/ru.ts) or other locale files
3. Use placeholders `{0}`, `{1}` for dynamic values
4. Call via `t('key', arg1, arg2)` from [`i18n/index.ts`](i18n/index.ts)

### Proxy Detection Pattern
```typescript
if (proxyUrl.startsWith('socks')) {
    agent = new SocksProxyAgent(proxyUrl);
} else if (proxyUrl.startsWith('http')) {
    agent = new HttpsProxyAgent(proxyUrl);
}
```

### Fetch Strategy
- Use `requestUrl()` from Obsidian API for direct requests
- Use `node-fetch` with agent for proxy requests
- Always set User-Agent header for external sites

### Steam Detection
Check hostname: `parsedUrl.hostname === 'store.steampowered.com'`

## Common Gotchas
- `node-fetch@2` required (CommonJS) - do not upgrade to v3+
- `posAtDOM()` can throw - wrap in try/catch
- Card parsing must handle both `<` and `\x3C` for HTML entities
