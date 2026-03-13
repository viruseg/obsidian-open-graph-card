# Ask Mode - AGENTS.md

Documentation context for the Open Graph Card plugin.

## Plugin Overview
This Obsidian plugin converts URLs into visual Open Graph cards in markdown notes. It provides special handling for Steam store pages with additional metadata.

## Key Features
- URL to Open Graph card conversion
- Steam store integration with ratings, tags, and screenshots
- Proxy support (HTTP and SOCKS5)
- Local image saving option
- Context menu integration in editor

## User-Facing Settings
- **Proxy**: HTTP or SOCKS5 proxy URL for bypassing restrictions
- **Save Images Locally**: Downloads images to vault instead of hotlinking

## Context Menu Actions
- **Update card**: Re-fetches OG data for existing card
- **Update card (proxy)**: Same via proxy
- **Remove card**: Reverts card back to original URL
- **Load Open Graph card**: Creates card from URL under cursor
- **Paste as Open Graph card**: Creates card from clipboard URL
- **Download images**: Downloads all remote images to vault (shown when card has URL images)
- **Restore image URLs**: Restores original URLs and deletes local files (shown when card has local images)

## Supported Languages
- English (en) - default
- Russian (ru)

## CSS Classes
- `.og-card` - main container
- `.og-image` - cover image
- `.og-content` - text content wrapper
- `.og-title`, `.og-description`, `.og-url` - content sections
- `.og-tags`, `.og-tag` - Steam tags
- `.og-screenshots`, `.og-screenshot` - Steam screenshots
- `.og-rating` - Steam rating with color classes
- `.og-user-text` - user notes section
- `.og-card-vertical` - alternative vertical layout
