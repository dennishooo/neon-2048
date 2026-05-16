#!/usr/bin/env python3
"""Generate a 1024x1024 app icon used as the source for `tauri icon`.

Produces a rounded-square neon tile with a "2048" wordmark.
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 1024
RADIUS = 220
OUT = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons", "_source.png")


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main() -> None:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # Background gradient (neon: violet -> cyan -> pink)
    grad = Image.new("RGB", (SIZE, SIZE), (11, 13, 23))
    px = grad.load()
    assert px is not None
    c1 = (124, 92, 255)   # violet
    c2 = (34, 211, 238)   # cyan
    c3 = (244, 114, 182)  # pink
    for y in range(SIZE):
        t = y / (SIZE - 1)
        if t < 0.5:
            col = lerp(c1, c2, t * 2)
        else:
            col = lerp(c2, c3, (t - 0.5) * 2)
        for x in range(SIZE):
            px[x, y] = col

    # Rounded mask
    mask = Image.new("L", (SIZE, SIZE), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), RADIUS, fill=255)

    img.paste(grad, (0, 0), mask)

    # Inner glassy highlight band
    highlight = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    hd.rounded_rectangle((40, 40, SIZE - 41, int(SIZE * 0.52)), RADIUS - 40,
                         fill=(255, 255, 255, 60))
    highlight = highlight.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(highlight)

    # Wordmark "2048"
    draw = ImageDraw.Draw(img)
    font = None
    for candidate in [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]:
        if os.path.exists(candidate):
            try:
                font = ImageFont.truetype(candidate, 380)
                break
            except OSError:
                continue
    if font is None:
        font = ImageFont.load_default()

    text = "2048"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (SIZE - tw) // 2 - bbox[0]
    ty = (SIZE - th) // 2 - bbox[1] - 10

    # Soft shadow
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.text((tx + 4, ty + 8), text, font=font, fill=(0, 0, 0, 160))
    shadow = shadow.filter(ImageFilter.GaussianBlur(6))
    img.alpha_composite(shadow)

    # Main text
    draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 245))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, "PNG")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
