# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

This is a monorepo of small, self-contained developer tools. Each tool lives in its own subdirectory with its own `README.md` and installer.

```
tools/
  claude-usage/     # macOS SwiftBar widget for Claude Pro usage
    claude_usage.py # SwiftBar plugin (pure stdlib Python, no deps)
    install.sh      # symlinks plugin into SwiftBar's plugins dir
```

## claude-usage

**No build step.** The plugin is a single Python 3 script run directly by SwiftBar.

- Install: `cd claude-usage && ./install.sh [interval]` (default interval: `5m`)
- Uninstall: remove the symlink from SwiftBar's plugins directory
- Config: `~/.config/claude-usage/config.json` (warn/critical thresholds)

The plugin reads an OAuth token from macOS Keychain (`Claude Code-credentials`) and calls `https://api.anthropic.com/api/oauth/usage`. No external Python dependencies.

SwiftBar plugin format: first line printed = menu bar title, `---` = separator, subsequent lines = dropdown items. Params like `color=`, `font=`, `bash=`, `refresh=true` are appended after `|`.
