#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_SRC="$SCRIPT_DIR/claude_usage.py"

# ── SwiftBar plugins directory ────────────────────────────────────────────────
# SwiftBar lets users set a custom plugins dir; try to read it from preferences.
PREF_DIR=$(defaults read com.ameba.SwiftBar PluginDirectory 2>/dev/null || true)
if [ -n "$PREF_DIR" ]; then
    SWIFTBAR_PLUGINS="$PREF_DIR"
else
    SWIFTBAR_PLUGINS="$HOME/Library/Application Support/SwiftBar/Plugins"
fi

# ── Refresh interval ──────────────────────────────────────────────────────────
# Default: 5m. Pass as first argument, e.g.: ./install.sh 2m
INTERVAL="${1:-5m}"

if ! echo "$INTERVAL" | grep -qE '^[0-9]+[smhd]$'; then
    echo "❌  Invalid interval '$INTERVAL'"
    echo "    Use a number followed by s, m, h, or d  (e.g. 30s, 5m, 1h)"
    exit 1
fi

# ── Checks ────────────────────────────────────────────────────────────────────
if [ ! -f "$PLUGIN_SRC" ]; then
    echo "❌  Plugin script not found at $PLUGIN_SRC"
    exit 1
fi

if ! command -v python3 &>/dev/null; then
    echo "❌  python3 not found. Install via: brew install python"
    exit 1
fi

if [ ! -d "$SWIFTBAR_PLUGINS" ]; then
    echo "❌  SwiftBar plugins directory not found:"
    echo "    $SWIFTBAR_PLUGINS"
    echo ""
    echo "    Make sure SwiftBar is installed, then either:"
    echo "    1. Open SwiftBar and configure a plugins directory, or"
    echo "    2. Create it manually: mkdir -p \"$SWIFTBAR_PLUGINS\""
    exit 1
fi

# ── Remove old versions ───────────────────────────────────────────────────────
OLD=$(find "$SWIFTBAR_PLUGINS" -name "claude-usage.*.py" 2>/dev/null)
if [ -n "$OLD" ]; then
    echo "$OLD" | xargs rm -f
    echo "  Removed old plugin(s)"
fi

# ── Install ───────────────────────────────────────────────────────────────────
PLUGIN_NAME="claude-usage.${INTERVAL}.py"
PLUGIN_DEST="$SWIFTBAR_PLUGINS/$PLUGIN_NAME"

chmod +x "$PLUGIN_SRC"
ln -sf "$PLUGIN_SRC" "$PLUGIN_DEST"

# ── Config ────────────────────────────────────────────────────────────────────
CONFIG_DIR="$HOME/.config/claude-usage"
CONFIG_FILE="$CONFIG_DIR/config.json"
mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONFIG_FILE" ]; then
    cat > "$CONFIG_FILE" << 'EOF'
{
  "warn_threshold": 75,
  "critical_threshold": 90
}
EOF
    echo "  Created config: $CONFIG_FILE"
else
    echo "  Config exists:  $CONFIG_FILE"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "✓  Installed: $PLUGIN_NAME"
echo "   Source:    $PLUGIN_SRC"
echo "   Plugin:    $PLUGIN_DEST"
echo ""
echo "   Refresh SwiftBar to activate (click SwiftBar icon → Refresh All)."
echo ""
echo "   To change the refresh interval:"
echo "   ./install.sh 2m   # every 2 minutes"
echo "   ./install.sh 10m  # every 10 minutes"
echo "   ./install.sh 30s  # every 30 seconds"
