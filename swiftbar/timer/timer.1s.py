#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# <swiftbar.title>Timer / Stopwatch</swiftbar.title>
# <swiftbar.version>2.0.0</swiftbar.version>
# <swiftbar.author>varunragunathan</swiftbar.author>
# <swiftbar.desc>Stopwatch and countdown timer in the menu bar</swiftbar.desc>
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>

import json, os, subprocess, sys, time

STATE_DIR  = os.path.expanduser("~/.config/swiftbar-timer")
STATE_PATH = os.path.join(STATE_DIR, "state.json")

DEFAULTS = {
    "mode":      "stopwatch",  # "stopwatch" | "timer"
    "running":   False,
    "start":     None,         # epoch of current run start
    "accum":     0.0,          # accumulated seconds
    "duration":  300,          # timer mode: countdown from N seconds
    "notified":  False,        # timer: True once the done notification fires
}

# ── State ─────────────────────────────────────────────────────────────────────

def load():
    try:
        with open(STATE_PATH) as f:
            return {**DEFAULTS, **json.load(f)}
    except Exception:
        return dict(DEFAULTS)

def save(s):
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(STATE_PATH, "w") as f:
        json.dump(s, f)

def elapsed(s):
    acc = s.get("accum", 0.0)
    if s.get("running") and s.get("start"):
        acc += time.time() - s["start"]
    return acc

# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_start():
    s = load()
    if s["running"]:
        return
    if s["mode"] == "timer" and elapsed(s) >= s["duration"]:
        return  # done — must reset first
    s["running"] = True
    s["start"]   = time.time()
    save(s)

def cmd_pause():
    s = load()
    if s["running"]:
        s["accum"]   = elapsed(s)
        s["running"] = False
        s["start"]   = None
        save(s)

def cmd_reset():
    s = load()
    s.update(running=False, start=None, accum=0.0, notified=False)
    save(s)

def cmd_mode(mode):
    s = load()
    s.update(mode=mode, running=False, start=None, accum=0.0, notified=False)
    save(s)

def cmd_set_duration(secs):
    s = load()
    s.update(duration=int(secs), running=False, start=None, accum=0.0, notified=False)
    save(s)

# ── Formatting ────────────────────────────────────────────────────────────────

def fmt(secs):
    secs = max(0, int(secs))
    h, rem = divmod(secs, 3600)
    m, s   = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"

def fmt_dur(secs):
    secs = int(secs)
    if secs < 60:             return f"{secs}s"
    if secs % 3600 == 0:      return f"{secs // 3600}h"
    if secs % 60  == 0:       return f"{secs // 60}m"
    m, s = divmod(secs, 60);  return f"{m}m {s}s"

# ── SwiftBar helpers ──────────────────────────────────────────────────────────

script = os.path.realpath(__file__)

def run(*args):
    """Build a SwiftBar bash= action string for this script."""
    parts = [f"bash=python3", f"param1={script}"]
    for i, a in enumerate(args, 2):
        parts.append(f"param{i}={a}")
    return " ".join(parts) + " terminal=false"

GREEN  = "#34C759"
ORANGE = "#FF9500"
RED    = "#FF3B30"
GRAY   = "#8E8E93"
WHITE  = "#FFFFFF"

DURATIONS = [
    (60,   "1 minute"),
    (120,  "2 minutes"),
    (300,  "5 minutes"),
    (600,  "10 minutes"),
    (900,  "15 minutes"),
    (1500, "25 minutes  (Pomodoro)"),
    (1800, "30 minutes"),
    (2700, "45 minutes"),
    (3600, "1 hour"),
]

# ── Main ──────────────────────────────────────────────────────────────────────

args = sys.argv[1:]
if "--start"        in args: cmd_start();                                   sys.exit()
if "--pause"        in args: cmd_pause();                                   sys.exit()
if "--reset"        in args: cmd_reset();                                   sys.exit()
if "--mode-sw"      in args: cmd_mode("stopwatch");                         sys.exit()
if "--mode-timer"   in args: cmd_mode("timer");                             sys.exit()
if "--set-duration" in args:
    idx = args.index("--set-duration")
    if idx + 1 < len(args): cmd_set_duration(args[idx + 1])
    sys.exit()

# ── Render ────────────────────────────────────────────────────────────────────

s    = load()
mode = s["mode"]
el   = elapsed(s)

if mode == "stopwatch":
    color = GREEN if s["running"] else GRAY
    print(f"{fmt(el)} | color={color}")
    print("---")
    if s["running"]:
        print(f"Pause  | {run('--pause')} color={ORANGE}")
    else:
        print(f"Start  | {run('--start')} color={GREEN}")
    print(f"Reset  | {run('--reset')} color={RED}")
    print("---")
    print(f"⏳ Switch to Timer | {run('--mode-timer')}")

else:  # timer
    remaining = s["duration"] - el
    done      = el > 0 and remaining <= 0

    if done:
        remaining = 0
        if not s.get("notified"):
            # Fire a macOS notification once
            subprocess.Popen([
                "osascript", "-e",
                'display notification "Time\'s up!" with title "⏰ Timer" sound name "Glass"'
            ])
            ns = load()
            ns["notified"] = True
            save(ns)

    if done:
        color = RED
    elif remaining <= s["duration"] * 0.25:
        color = ORANGE
    elif s["running"]:
        color = GREEN
    else:
        color = GRAY

    print(f"{fmt(remaining)} | color={color}")
    print("---")

    if done:
        print(f"⏰ Time's up! | color={RED}")
    elif s["running"]:
        print(f"Pause  | {run('--pause')} color={ORANGE}")
    else:
        print(f"Start  | {run('--start')} color={GREEN}")
    print(f"Reset  | {run('--reset')} color={RED}")

    print("---")

    # Duration submenu
    cur = s["duration"]
    print(f"Duration: {fmt_dur(cur)} | color={WHITE}")
    for secs, label in DURATIONS:
        check = "✓ " if secs == cur else "   "
        print(f"--{check}{label} | {run('--set-duration', str(secs))}")

    print("---")
    print(f"⏱ Switch to Stopwatch | {run('--mode-sw')}")
