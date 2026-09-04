from pathlib import Path
import sys

sys.path.insert(0, "/tmp/fc-video-libs")

from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
WIDTH, HEIGHT, FPS, SECONDS = 1280, 720, 20, 12
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

VIDEOS = [
    (
        "news-voice-first-launch.png",
        "news-voice-first-launch.mp4",
        ["Their voice.", "Their memories.", "One family chronicle."],
    ),
    (
        "news-family-photos.png",
        "news-family-photos.mp4",
        ["Every photograph", "has a story", "worth hearing."],
    ),
    (
        "news-across-distance.png",
        "news-across-distance.mp4",
        ["Miles apart.", "One shared", "family history."],
    ),
]


def ease(value):
    return value * value * (3 - 2 * value)


def make_frame(source, index, lines):
    progress = index / (FPS * SECONDS - 1)
    zoom = 1.0 + 0.055 * ease(progress)
    crop_w, crop_h = int(source.width / zoom), int(source.height / zoom)
    drift = int((source.width - crop_w) * progress)
    left = min(source.width - crop_w, drift)
    top = (source.height - crop_h) // 2
    frame = source.crop((left, top, left + crop_w, top + crop_h)).resize(
        (WIDTH, HEIGHT), Image.Resampling.LANCZOS
    ).convert("RGBA")

    shade = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    shade_draw.rectangle((0, 0, 720, HEIGHT), fill=(8, 35, 29, 148))
    shade_draw.rectangle((0, 0, WIDTH, HEIGHT), fill=(0, 0, 0, 15))
    frame = Image.alpha_composite(frame, shade)

    draw = ImageDraw.Draw(frame)
    title = ImageFont.truetype(FONT_BOLD, 64)
    kicker = ImageFont.truetype(FONT_BOLD, 18)
    cta = ImageFont.truetype(FONT_BOLD, 22)
    small = ImageFont.truetype(FONT, 18)

    fade_in = min(1.0, index / (FPS * 0.7))
    fade_out = min(1.0, (FPS * SECONDS - index) / (FPS * 0.65))
    alpha = int(255 * min(fade_in, fade_out))
    coral = (242, 163, 140, alpha)
    white = (255, 255, 255, alpha)

    draw.text((70, 70), "FAMILYCHRONICA", font=kicker, fill=coral)
    y = 205
    for line in lines:
        draw.text((70, y), line, font=title, fill=white)
        y += 72
    draw.text((70, 500), "Record one story today.", font=cta, fill=white)
    draw.text((70, 542), "familychronica.com/app", font=small, fill=coral)
    return frame.convert("RGB")


for image_name, video_name, lines in VIDEOS:
    source = Image.open(ASSETS / image_name).convert("RGB")
    writer = imageio_ffmpeg.write_frames(
        str(ASSETS / video_name),
        (WIDTH, HEIGHT),
        fps=FPS,
        codec="libx264",
        pix_fmt_in="rgb24",
        pix_fmt_out="yuv420p",
        output_params=["-movflags", "+faststart", "-crf", "24", "-preset", "medium"],
    )
    writer.send(None)
    for frame_index in range(FPS * SECONDS):
        writer.send(make_frame(source, frame_index, lines).tobytes())
    writer.close()
    print(f"Generated {video_name}")
