# claude-usage

A macOS menu bar widget that shows your **Claude Pro usage** at a glance — no more opening Settings to check how much of your 5-hour window or weekly limit you've burned through.

```
◈  70%  ·  W 67%
```

Click to expand:

```
◈  70%  ·  W 67%
─────────────────────────────
5-Hour Window
███████░░░  70.0%
Resets in 2h 54m

Weekly
███████░░░  67.0%
Resets in 24h 54m
─────────────────────────────
Updated 11:05 AM    Refresh
Open Config
```

Color coding: green → orange at 75% → red at 90% (configurable).

---

## Requirements

- macOS
- [SwiftBar](https://github.com/swiftbar/SwiftBar) installed
- Python 3 (`python3 --version` to check; install via `brew install python` if needed)
- [Claude Code](https://claude.ai/code) installed and logged in (your OAuth token lives in Keychain — the widget reads it from there)

---

## Install

```bash
git clone https://github.com/varunragunathan/tools.git
cd tools/claude-usage
./install.sh
```

That's it. Then in SwiftBar: **click the menu bar icon → Refresh All**.

### Custom refresh interval

The default is every **5 minutes**. Pass any interval as an argument:

```bash
./install.sh 2m    # every 2 minutes
./install.sh 30s   # every 30 seconds
./install.sh 10m   # every 10 minutes
```

Interval format: a number followed by `s` (seconds), `m` (minutes), `h` (hours), or `d` (days).

---

## Configuration

The installer creates `~/.config/claude-usage/config.json`:

```json
{
  "warn_threshold": 75,
  "critical_threshold": 90
}
```

| Key | Default | Description |
|---|---|---|
| `warn_threshold` | `75` | % at which the bar turns orange |
| `critical_threshold` | `90` | % at which the bar turns red |

Edit the file and SwiftBar will pick up changes on the next refresh. You can also click **Open Config** in the widget dropdown.

---

## How it works

Claude Code stores an OAuth token in your macOS Keychain under `Claude Code-credentials`. This widget reads that token and calls the same internal usage endpoint that Claude Code uses:

```
GET https://api.anthropic.com/api/oauth/usage
```

The response returns utilization percentages (0–100) and reset timestamps directly — no scraping, no browser automation.

---

## Uninstall

```bash
# Remove the SwiftBar plugin
rm "$(defaults read com.ameba.SwiftBar PluginDirectory)/claude-usage.*.py"

# Remove config (optional)
rm -rf ~/.config/claude-usage
```

---

## Disclaimer

This widget reads your **own** account data using a token already present on your machine. However, Anthropic's Terms of Service specify that OAuth tokens issued to Claude Pro/Max accounts should only be used within Claude Code and claude.ai — not third-party tools. Use this at your own discretion.

There is an [open GitHub issue](https://github.com/anthropics/claude-code/issues/19880) requesting a proper public API for this data. If that ships, this tool will be updated to use it.

---

## Contributing

PRs welcome. The plugin is a single Python file with no dependencies beyond the standard library — keep it that way.

---

## License

MIT — see [LICENSE](../LICENSE).
