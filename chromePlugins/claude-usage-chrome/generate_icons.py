#!/usr/bin/env python3
"""Generate PNG icons for the Claude Usage Chrome extension."""

import math, os, struct, zlib

def png(size, pixels):
    def chunk(tag, data):
        c = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", c)

    raw = bytearray()
    for row in range(size):
        raw += b"\x00"
        for col in range(size):
            r, g, b, a = pixels[row * size + col]
            raw += bytes([r, g, b, a])

    sig  = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))  # RGBA
    idat = chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend

def make_icon(size):
    bg     = (28, 28, 30, 255)    # #1C1C1E
    track  = (58, 58, 60, 255)    # #3A3A3C
    win_c  = (204, 119, 34, 255)  # amber  — 5-hour bar
    week_c = (10, 132, 255, 255)  # blue   — weekly bar

    pad  = max(1, size // 10)
    barH = max(2, size // 4)
    barW = size - pad * 2
    y1   = pad
    y2   = size - barH - pad

    # notional fill levels for the icon (just for visual design, not live data)
    fill1 = int(barW * 0.70)
    fill2 = int(barW * 0.45)

    pixels = []
    for row in range(size):
        for col in range(size):
            in_bar1 = (y1 <= row < y1 + barH) and (pad <= col < pad + barW)
            in_bar2 = (y2 <= row < y2 + barH) and (pad <= col < pad + barW)

            if in_bar1:
                px = win_c  if col < pad + fill1 else track
            elif in_bar2:
                px = week_c if col < pad + fill2 else track
            else:
                px = bg
            pixels.append(px)

    return png(size, pixels)

if __name__ == "__main__":
    os.makedirs("icons", exist_ok=True)
    for size in [16, 48, 128]:
        path = f"icons/icon{size}.png"
        with open(path, "wb") as f:
            f.write(make_icon(size))
        print(f"  {path}")
