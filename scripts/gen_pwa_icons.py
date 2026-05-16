#!/usr/bin/env python3
"""Generate PWA icons from the existing source icon.

Outputs:
  public/icons/icon-192.png         (standard)
  public/icons/icon-512.png         (standard)
  public/icons/maskable-512.png     (with safe-area padding so iOS/Android can crop)
  public/icons/apple-touch-180.png  (iOS home-screen icon)
"""
from __future__ import annotations

import os
import sys
from PIL import Image

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "..", "src-tauri", "icons", "_source.png")
OUT_DIR = os.path.join(HERE, "..", "public", "icons")


def ensure_out() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)


def standard(size: int, name: str) -> None:
    img = Image.open(SRC).convert("RGBA")
    img = img.resize((size, size), Image.LANCZOS)
    out = os.path.join(OUT_DIR, name)
    img.save(out, "PNG", optimize=True)
    print(f"wrote {out}")


def maskable(size: int, name: str) -> None:
    """Add ~12% safe padding around the inner art so platforms can crop the icon."""
    img = Image.open(SRC).convert("RGBA")
    inner_size = int(size * 0.78)
    img = img.resize((inner_size, inner_size), Image.LANCZOS)

    bg = Image.new("RGBA", (size, size), (11, 13, 23, 255))
    off = (size - inner_size) // 2
    bg.alpha_composite(img, (off, off))
    out = os.path.join(OUT_DIR, name)
    bg.save(out, "PNG", optimize=True)
    print(f"wrote {out}")


def main() -> None:
    if not os.path.exists(SRC):
        sys.stderr.write(f"missing source icon: {SRC}\n")
        sys.exit(1)
    ensure_out()
    standard(192, "icon-192.png")
    standard(512, "icon-512.png")
    standard(180, "apple-touch-180.png")
    maskable(512, "maskable-512.png")


if __name__ == "__main__":
    main()
