"""Draws the BidVerdict icon set (navy tile, white check, green badge) with PIL.
Usage: python3 scripts/make_icons.py   (writes extension/icons/*.png and store/icon128.png)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
NAVY = (19, 41, 75, 255)
WHITE = (255, 255, 255, 255)
GREEN = (34, 197, 94, 255)
S = 1024  # supersampled canvas


def stroke(d, pts, w, fill):
    d.line(pts, fill=fill, width=w, joint="curve")
    r = w // 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse((x - r, y - r, x + r, y + r), fill=fill)


def tile(padded: bool, badge: bool) -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = 128 if padded else 16
    d.rounded_rectangle((pad, pad, S - pad, S - pad), radius=180 if padded else 210, fill=NAVY)
    # check mark, scaled to the tile
    span = S - 2 * pad
    p = lambda fx, fy: (pad + fx * span, pad + fy * span)
    stroke(d, [p(0.24, 0.53), p(0.42, 0.71), p(0.76, 0.32)], int(span * (0.13 if padded else 0.16)), WHITE)
    if badge:
        cx, cy, r = pad + span * 0.80, pad + span * 0.80, span * 0.17
        d.ellipse((cx - r - 26, cy - r - 26, cx + r + 26, cy + r + 26), fill=NAVY)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GREEN)
    return img


def main():
    out = ROOT / "extension" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    big = tile(padded=True, badge=True)      # 128/48: Chrome Web Store wants 96px art + 16px transparent padding
    small = tile(padded=False, badge=False)  # 16/32: full-bleed, no badge, so it reads at toolbar size
    for size, src in ((128, big), (48, big), (32, small), (16, small)):
        src.resize((size, size), Image.LANCZOS).save(out / f"icon{size}.png")
    (ROOT / "store").mkdir(exist_ok=True)
    big.resize((128, 128), Image.LANCZOS).save(ROOT / "store" / "icon128.png")
    print("icons written to", out)


if __name__ == "__main__":
    main()
