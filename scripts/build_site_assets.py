"""Copies the Chrome Web Store graphics into the website as web-sized images.
Usage: python3 scripts/build_site_assets.py   (writes server/public/img/)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "store"
OUT = ROOT / "server" / "public" / "img"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for i in range(1, 6):
        im = Image.open(SRC / "images" / f"screenshot-{i}.png").convert("RGB")
        im.save(OUT / f"screenshot-{i}.webp", "WEBP", quality=86, method=6)
        im.resize((640, 400), Image.LANCZOS).save(OUT / f"screenshot-{i}-640.webp", "WEBP", quality=84, method=6)
    # Social preview (Open Graph wants about 1200x630): the marquee tile on a navy canvas.
    marquee = Image.open(SRC / "images" / "promo-marquee-1400x560.png").convert("RGB")
    og = Image.new("RGB", (1200, 630), (19, 41, 75))
    m = marquee.resize((1200, 480), Image.LANCZOS)
    og.paste(m, (0, 75))
    og.save(OUT / "og.jpg", "JPEG", quality=88)
    for size in (32, 128):
        Image.open(ROOT / "extension" / "icons" / f"icon{size}.png").save(OUT / f"icon{size}.png")
    for f in sorted(OUT.iterdir()):
        print(f"{f.name:28} {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
