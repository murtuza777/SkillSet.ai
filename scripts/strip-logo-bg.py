"""Make near-white pixels transparent on the SkillSet logo PNG."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "public" / "logo.png"
OUT_PUBLIC = ROOT / "apps" / "web" / "public" / "logo.png"
OUT_ICON = ROOT / "apps" / "web" / "src" / "app" / "icon.png"


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source: {SRC}")

    img = Image.open(SRC).convert("RGBA")
    pixels = img.load()
    assert pixels is not None
    w, h = img.size

    # Pixels with high luminance and low saturation = background paper white
    threshold = 245
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (r, g, b, 0)
            elif max(r, g, b) - min(r, g, b) < 18 and (r + g + b) / 3 >= 238:
                pixels[x, y] = (r, g, b, 0)

    OUT_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    OUT_ICON.parent.mkdir(parents=True, exist_ok=True)

    img.save(OUT_PUBLIC, "PNG", optimize=True)

    # Favicon / app icon: square, reasonable size
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    square = img.crop((left, top, left + side, top + side)).resize(
        (512, 512), Image.Resampling.LANCZOS
    )
    square.save(OUT_ICON, "PNG", optimize=True)

    print(f"Wrote {OUT_PUBLIC}")
    print(f"Wrote {OUT_ICON}")


if __name__ == "__main__":
    main()
