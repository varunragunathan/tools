#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# <swiftbar.title>Claude Usage</swiftbar.title>
# <swiftbar.version>1.1.0</swiftbar.version>
# <swiftbar.author>varunragunathan</swiftbar.author>
# <swiftbar.desc>Claude Pro 5hr window and weekly usage percentages</swiftbar.desc>
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>false</swiftbar.hideRunInTerminal>
# <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>

import json
import subprocess
import urllib.request
import urllib.error
import os
import time
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────

CONFIG_DIR  = os.path.expanduser("~/.config/claude-usage")
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")
CACHE_PATH  = os.path.join(CONFIG_DIR, "cache.json")

# Minimum seconds between real API calls regardless of SwiftBar's refresh rate.
# The usage endpoint rate-limits aggressively; 60s is a safe floor.
MIN_FETCH_INTERVAL = 60

DEFAULTS = {
    "warn_threshold": 75,     # % → orange
    "critical_threshold": 90, # % → red
}

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH) as f:
                return {**DEFAULTS, **json.load(f)}
        except Exception:
            pass
    return DEFAULTS

# ── Cache ─────────────────────────────────────────────────────────────────────

def load_cache():
    """Return (data, fetched_at_epoch) or (None, 0)."""
    try:
        with open(CACHE_PATH) as f:
            c = json.load(f)
            return c.get("data"), c.get("fetched_at", 0)
    except Exception:
        return None, 0

def save_cache(data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CACHE_PATH, "w") as f:
        json.dump({"fetched_at": time.time(), "data": data}, f)

# ── Auth ──────────────────────────────────────────────────────────────────────

def get_access_token():
    """Read Claude Code OAuth token from macOS Keychain."""
    result = subprocess.run(
        ["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        return None, "Claude Code credentials not found in Keychain"
    try:
        creds = json.loads(result.stdout.strip())
        if "claudeAiOauth" in creds:
            token = creds["claudeAiOauth"].get("accessToken")
            if token:
                return token, None
        token = creds.get("claudeAiOauth.accessToken")
        if token:
            return token, None
        return None, "Could not find accessToken in credentials"
    except (json.JSONDecodeError, AttributeError) as e:
        return None, f"Failed to parse credentials: {e}"

# ── API ───────────────────────────────────────────────────────────────────────

USAGE_URL = "https://api.anthropic.com/api/oauth/usage"

def fetch_usage(token):
    headers = {
        "Authorization": f"Bearer {token}",
        "anthropic-beta": "oauth-2025-04-20",
        "Accept": "application/json",
        "User-Agent": "claude-code/2.0.32",
    }
    req = urllib.request.Request(USAGE_URL, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

# ── Formatting ────────────────────────────────────────────────────────────────

GREEN  = "#34C759"
ORANGE = "#FF9500"
RED    = "#FF3B30"
GRAY   = "#8E8E93"
WHITE  = "#FFFFFF"

def color_for(pct, cfg):
    if pct >= cfg["critical_threshold"]: return RED
    if pct >= cfg["warn_threshold"]:     return ORANGE
    return GREEN

def bar(pct, width=10):
    filled = round(pct / 100 * width)
    return "█" * filled + "░" * (width - filled)

def time_until(iso_str):
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        secs = int((dt - datetime.now(timezone.utc)).total_seconds())
        if secs <= 0:
            return "resetting soon"
        h, rem = divmod(secs, 3600)
        m = rem // 60
        return f"{h}h {m}m" if h > 0 else f"{m}m"
    except Exception:
        return None

def age_str(fetched_at):
    secs = int(time.time() - fetched_at)
    if secs < 60:   return f"{secs}s ago"
    if secs < 3600: return f"{secs // 60}m ago"
    return f"{secs // 3600}h ago"

# ── SwiftBar output ───────────────────────────────────────────────────────────

def print_error(msg):
    print("◈ Claude ⚠ | color=#FF3B30")
    print("---")
    print(f"{msg} | color={RED}")
    print("---")
    print("Refresh | refresh=true")

def render(data, cfg, stale=False, fetched_at=0):
    win  = data.get("five_hour") or {}
    week = data.get("seven_day") or {}
    opus = data.get("seven_day_opus") or {}

    win_pct  = float(win.get("utilization", 0))
    week_pct = float(week.get("utilization", 0))
    opus_pct = float(opus.get("utilization", 0))
    win_reset  = win.get("resets_at")
    week_reset = week.get("resets_at")

    win_color  = color_for(win_pct, cfg)
    week_color = color_for(week_pct, cfg)
    title_color = win_color if win_pct >= week_pct else week_color

    stale_mark = " ·" if stale else ""
    print(f"◈  {win_pct:.0f}%  ·  W {week_pct:.0f}%{stale_mark} | color={title_color}")
    print("---")

    # 5-Hour window
    print(f"5-Hour Window | color={WHITE} font=.AppleSystemUIFontBold size=12")
    print(f"{bar(win_pct)}  {win_pct:.1f}% | color={win_color} font=Menlo size=13")
    t = time_until(win_reset)
    if t:
        print(f"Resets in {t} | color={GRAY} size=11")

    print("---")

    # Weekly
    print(f"Weekly | color={WHITE} font=.AppleSystemUIFontBold size=12")
    print(f"{bar(week_pct)}  {week_pct:.1f}% | color={week_color} font=Menlo size=13")
    t = time_until(week_reset)
    if t:
        print(f"Resets in {t} | color={GRAY} size=11")

    # Opus (only if > 0)
    if opus_pct > 0:
        opus_color = color_for(opus_pct, cfg)
        print("---")
        print(f"Weekly Opus | color={WHITE} font=.AppleSystemUIFontBold size=12")
        print(f"{bar(opus_pct)}  {opus_pct:.1f}% | color={opus_color} font=Menlo size=13")

    # Footer
    print("---")
    if stale and fetched_at:
        print(f"Data from {age_str(fetched_at)} (rate limited) | color={GRAY} size=10")
    else:
        now = datetime.now().strftime("%-I:%M %p")
        print(f"Updated {now} | color={GRAY} size=10")
    print("Refresh | refresh=true")
    print("---")
    print(f"Open Config | bash=/usr/bin/open param1={CONFIG_PATH} terminal=false")

def main():
    cfg = load_config()
    cached_data, fetched_at = load_cache()

    # Respect the minimum fetch interval — serve cache if too soon
    age = time.time() - fetched_at
    if cached_data and age < MIN_FETCH_INTERVAL:
        render(cached_data, cfg, stale=False, fetched_at=fetched_at)
        return

    token, err = get_access_token()
    if err:
        if cached_data:
            render(cached_data, cfg, stale=True, fetched_at=fetched_at)
        else:
            print_error(err)
        return

    try:
        data = fetch_usage(token)
        save_cache(data)
        render(data, cfg)
    except urllib.error.HTTPError as e:
        if e.code == 429:
            if cached_data:
                render(cached_data, cfg, stale=True, fetched_at=fetched_at)
            else:
                print_error("Rate limited — will retry shortly")
        elif e.code == 401:
            print_error("Token expired — restart Claude Code to refresh")
        else:
            if cached_data:
                render(cached_data, cfg, stale=True, fetched_at=fetched_at)
            else:
                print_error(f"API error {e.code}")
    except Exception as e:
        if cached_data:
            render(cached_data, cfg, stale=True, fetched_at=fetched_at)
        else:
            print_error(f"Network error: {e}")

if __name__ == "__main__":
    main()
