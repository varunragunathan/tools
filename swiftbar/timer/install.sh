#!/usr/bin/env bash
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/timer.1s.py"

PLUGINS_DIR=$(defaults read com.ameba.SwiftBar PluginDirectory 2>/dev/null || true)
if [ -z "$PLUGINS_DIR" ]; then
  PLUGINS_DIR="${HOME}/Library/Application Support/SwiftBar/Plugins"
fi

if [[ ! -d "$PLUGINS_DIR" ]]; then
  echo "❌  SwiftBar plugins directory not found: $PLUGINS_DIR"
  echo "    Open SwiftBar and configure a plugins directory first."
  exit 1
fi

chmod +x "$SCRIPT"
ln -sf "$SCRIPT" "${PLUGINS_DIR}/timer.1s.py"
echo "✅  Installed: ${PLUGINS_DIR}/timer.1s.py"
