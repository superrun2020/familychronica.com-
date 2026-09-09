from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUTPUT = ASSETS / "brand" / "familychronica-youtube-banner-2560x1440.jpg"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "Arial Bold.ttf" if bold else "Arial.ttf"
    return ImageFont.truetype(f"/System/Library/Fonts/Supplemental/{name}", size)


hero = Image.open(ASSETS / "hero-commercial-v2.jpg").convert("RGB")
scale = max(2560 / hero.width, 1440 / hero.height)
hero = hero.resize((round(hero.width * scale), round(hero.height * scale)), Image.Resampling.LANCZOS)
left = (hero.width - 2560) // 2
top = (hero.height - 1440) // 2
canvas = hero.crop((left, top, left + 2560, top + 1440))
canvas = ImageEnhance.Contrast(canvas).enhance(0.96)

# Keep the text readable while preserving the warm photographic setting.
shade = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
shade_draw = ImageDraw.Draw(shade)
for x in range(1500):
    alpha = max(0, round(198 * (1 - x / 1500) ** 1.35))
    shade_draw.line((x, 0, x, 1440), fill=(20, 29, 24, alpha))
canvas = Image.alpha_composite(canvas.convert("RGBA"), shade)

logo_master = Image.open(ASSETS / "brand" / "familychronica-logo-horizontal-master.png").convert("RGBA")
logo = logo_master.crop((0, 0, 470, logo_master.height))
logo.thumbnail((165, 130), Image.Resampling.LANCZOS)

# YouTube's universal safe region is 1546x423 in the center of a 2560x1440 banner.
safe_x, safe_y = (2560 - 1546) // 2, (1440 - 423) // 2
logo_x = safe_x + 44
logo_y = safe_y + 46
canvas.alpha_composite(logo, (logo_x, logo_y))

draw = ImageDraw.Draw(canvas)
tagline = "Every life deserves to be remembered."
subline = "Family stories, voices and photographs - preserved together."
draw.text((logo_x + 186, logo_y + 24), "FamilyChronica", font=font(67, True), fill=(255, 250, 239, 255))
draw.text((logo_x + 6, logo_y + 195), tagline, font=font(46, True), fill=(255, 250, 239, 255))
draw.text((logo_x + 6, logo_y + 258), subline, font=font(25), fill=(239, 228, 205, 255))

canvas.convert("RGB").save(OUTPUT, quality=91, optimize=True, progressive=True)
print(OUTPUT)
