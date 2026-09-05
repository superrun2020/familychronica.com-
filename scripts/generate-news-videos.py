from pathlib import Path
import os
import subprocess
import tempfile
import textwrap
import re
import shutil

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SCRIPTS = ROOT / "news-video-scripts"
FFMPEG = Path(os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or "/tmp/fc-video-libs/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1")
WIDTH, HEIGHT = 1280, 720
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

VIDEOS = [
    {
        "slug": "voice-first-family-archive",
        "title": "Sunday Mornings on Willow Street",
        "images": ["news-voice-first-launch.png", "family-hero.jpg", "testimonial.jpg", "chronicle.jpg", "story-book.jpg", "memory-film.jpg"],
        "chapters": ["One question at the kitchen table", "Mary remembers Willow Street", "Her original voice stays with the story", "A photograph finds its people", "The family reviews every detail", "One memory becomes a chapter", "A private space with clear choices", "One question every Sunday", "Voices and photographs form a timeline", "The family approves a printed edition", "The book is not the beginning", "Record one story today"],
    },
    {
        "slug": "every-photograph-has-a-story",
        "title": "The Lake Photograph",
        "images": ["news-family-photos.png", "photo-book.jpg", "family-tree.jpg", "archive-box.jpg", "memory-film.jpg", "story-book.jpg"],
        "chapters": ["A photograph without a date", "The station wagon offers a clue", "Who remembers this day?", "Robert tells what he knows", "Susan remembers why the trip mattered", "Two voices return context to the image", "Suggestions are reviewed, not assumed", "Different memories can remain different", "The lake becomes a family chapter", "Ten photographs, one at a time", "Preserve what the family genuinely knows", "Ask what the picture cannot show"],
    },
    {
        "slug": "one-family-history-across-distance",
        "title": "Three Countries, One Family History",
        "images": ["news-across-distance.png", "family-hero.jpg", "chronicle.jpg", "family-tree.jpg", "news-family-photos.png", "story-book.jpg"],
        "chapters": ["A family across eight time zones", "Stories scattered through messages", "One question travels to London", "Lian remembers one suitcase", "Wei remembers a tin of tea", "Both versions remain connected", "The original language stays with the story", "Each relative contributes differently", "Private memories keep their boundaries", "Three countries form one timeline", "A book travels back to the grandparents", "Miles apart, one shared history"],
    },
]


def draw_slide(image_path, title, chapter, index, total, output):
    image = Image.open(image_path).convert("RGB")
    image = ImageOps.fit(image, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS)
    image = ImageEnhance.Brightness(image).enhance(0.7).convert("RGBA")
    shade = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    shade_draw.rectangle((0, 0, 790, HEIGHT), fill=(7, 31, 26, 150))
    image = Image.alpha_composite(image, shade)
    draw = ImageDraw.Draw(image)
    kicker = ImageFont.truetype(FONT_BOLD, 17)
    title_font = ImageFont.truetype(FONT_BOLD, 28)
    chapter_font = ImageFont.truetype(FONT_BOLD, 58)
    small = ImageFont.truetype(FONT, 17)
    draw.text((72, 66), "FAMILYCHRONICA  |  ILLUSTRATIVE STORY", font=kicker, fill=(244, 166, 143))
    draw.text((72, 116), title, font=title_font, fill=(235, 239, 236))
    lines = textwrap.wrap(chapter, width=24)
    y = 245
    for line in lines:
        draw.text((72, y), line, font=chapter_font, fill="white")
        y += 70
    draw.text((72, 615), "familychronica.com/app", font=small, fill=(244, 166, 143))
    track_left, track_right = 72, 650
    draw.rounded_rectangle((track_left, 668, track_right, 674), radius=3, fill=(255, 255, 255, 80))
    progress = track_left + int((track_right - track_left) * ((index + 1) / total))
    draw.rounded_rectangle((track_left, 668, progress, 674), radius=3, fill=(244, 166, 143))
    image.convert("RGB").save(output, quality=88, optimize=True)


def build_video(config):
    slug = config["slug"]
    with tempfile.TemporaryDirectory(prefix=f"fc-{slug}-") as temp_name:
        temp = Path(temp_name)
        audio = temp / "narration.aiff"
        subprocess.run(["say", "-v", "Samantha", "-r", "100", "-f", str(SCRIPTS / f"{slug}.txt"), "-o", str(audio)], check=True)
        probe = subprocess.run([str(FFMPEG), "-hide_banner", "-i", str(audio)], capture_output=True, text=True)
        match = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", probe.stderr)
        if not match:
            raise RuntimeError(f"Could not read narration duration for {slug}")
        hours, minutes, seconds = match.groups()
        duration = (int(hours) * 3600 + int(minutes) * 60 + float(seconds)) / 0.78

        slides = []
        for index, chapter in enumerate(config["chapters"]):
            slide = temp / f"slide-{index:02d}.jpg"
            image_name = config["images"][index % len(config["images"])]
            draw_slide(ASSETS / image_name, config["title"], chapter, index, len(config["chapters"]), slide)
            slides.append(slide)

        concat = temp / "slides.txt"
        with concat.open("w") as handle:
            for slide in slides:
                handle.write(f"file '{slide}'\n")
                handle.write("duration 25\n")
            handle.write(f"file '{slides[-1]}'\n")

        output = ASSETS / f"news-{slug}.mp4"
        subprocess.run([
            str(FFMPEG), "-y", "-hide_banner", "-loglevel", "error",
            "-stream_loop", "-1", "-f", "concat", "-safe", "0", "-i", str(concat),
            "-i", str(audio), "-t", f"{duration:.2f}", "-r", "24",
            "-c:v", "libx264", "-tune", "stillimage", "-preset", "medium", "-crf", "29",
            "-pix_fmt", "yuv420p", "-filter:a", "atempo=0.78", "-c:a", "aac", "-b:a", "96k",
            "-movflags", "+faststart", str(output),
        ], check=True)
        print(f"Generated {output.name}")


for video in VIDEOS:
    build_video(video)
