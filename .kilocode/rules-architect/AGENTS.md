# Architect Mode - AGENTS.md

Architecture constraints and design patterns for the Open Graph Card plugin.

## Architecture Overview

```mermaid
flowchart TD
    A[User Action] --> B{Context Menu}
    B --> C[URL Detection]
    B --> D[Card Detection]
    C --> E[replaceWithOpenGraph]
    D --> E
    E --> F{Proxy?}
    F -->|Yes| G[node-fetch + agent]
    F -->|No| H[requestUrl API]
    G --> I[HTML Parse]
    H --> I
    I --> J{Steam URL?}
    J -->|Yes| K[Extract Extra Data]
    J -->|No| L[Standard OG Data]
    K --> M[Build HTML Card]
    L --> M
    M --> N[Insert in Editor]
```

## Design Constraints

### Single File Architecture
- Main plugin logic in [`main.ts`](main.ts) (~560 lines)
- Settings tab as inner class
- No separate service layers

### External Dependencies
- Must remain `isDesktopOnly: true` due to:
  - `electron` clipboard access
  - `node-fetch` for proxy support
  - File system operations

### Card Format
Cards are stored as HTML blocks in markdown with specific markers:
- Opening: `<div class="og-card">`
- Closing: `<!--og-card-end-->\n</div>`
- User text end: `<!--og-user-text-end-->`

### Extension Points
1. **New metadata sources**: Add hostname detection in [`replaceWithOpenGraph()`](main.ts:311)
2. **New locales**: Add file to `i18n/` and import in [`index.ts`](i18n/index.ts)
3. **Card layouts**: Add CSS class and toggle in settings

## Performance Considerations
- Card parsing looks up to 100 lines up, 10 lines down, 200 lines forward
- Image downloads use `Promise.all()` for parallel processing
- No caching - each update re-fetches all data
