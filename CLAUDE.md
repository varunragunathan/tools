# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

This is a monorepo of small, self-contained developer tools organized by platform.

```
tools/
  swiftbar/
    claude-usage/         # macOS SwiftBar widget for Claude Pro usage
      claude_usage.py     # SwiftBar plugin (pure stdlib Python, no deps)
      install.sh          # symlinks plugin into SwiftBar's plugins dir
  chromePlugins/
    claude-usage-chrome/  # Chrome extension for Claude Pro usage
      manifest.json       # MV3 manifest
      background.js       # service worker: fetch, badge, dynamic icon
      popup.html/css/js   # toolbar popup with usage detail
      options.html/css/js # settings page (thresholds)
      generate_icons.py   # generates icons/icon{16,48,128}.png
```

## swiftbar/claude-usage

**No build step.** Single Python 3 script run directly by SwiftBar.

- Install: `cd swiftbar/claude-usage && ./install.sh [interval]` (default: `5m`)
- Uninstall: remove the symlink from SwiftBar's plugins directory
- Config: `~/.config/claude-usage/config.json` (warn/critical thresholds, show_time_in_preview)

Reads an OAuth token from macOS Keychain (`Claude Code-credentials`) and calls
`https://api.anthropic.com/api/oauth/usage`. No external Python dependencies.

SwiftBar plugin format: first line = menu bar title, `---` = separator, subsequent lines = dropdown
items. Params like `color=`, `font=`, `bash=`, `refresh=true` are appended after `|`.

## chromePlugins/claude-usage-chrome

**No build step.** Load unpacked in Chrome developer mode.

- Setup: `cd chromePlugins/claude-usage-chrome && python3 generate_icons.py`
- Load: `chrome://extensions` → Developer mode → Load unpacked → select this folder
- Auth: uses the active `claude.ai` browser session via `chrome.scripting.executeScript` —
  no token needed, but a claude.ai tab must be open

The background service worker injects fetch calls into an existing claude.ai tab so session
cookies are sent automatically. Draws a live two-bar icon (5-hr window + weekly) directly
in the toolbar using OffscreenCanvas.
