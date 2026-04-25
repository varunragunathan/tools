# Claude Usage — Chrome Extension

Shows Claude Pro usage directly in the Chrome toolbar — no click needed, no token setup.

Uses your active **claude.ai** browser session, so it just works as long as you're logged in.

The toolbar icon draws two live progress bars (top = 5-hour window, bottom = weekly).
The badge number shows the exact 5-hour window %. Hover for both percentages as a tooltip.
Click the icon for full detail with reset countdown times.

## Install

```bash
cd claude-usage-chrome
python3 generate_icons.py   # one-time icon generation
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select this `claude-usage-chrome` folder

That's it. As long as you're logged in to claude.ai, usage appears immediately.

## Thresholds

Click the icon → **Settings** to adjust warning (orange) and critical (red) thresholds.
Defaults: 75% = orange, 90% = red.

## Notes

- If the badge shows **–**, log in to claude.ai and click Refresh in the popup.
- Data refreshes every 60 seconds.
