"""Generate small, antialiased phone-call GIFs from the ISC-licensed Lucide glyph.
Requires Pillow and ImageMagick, used only at authoring time; no runtime dependency.
"""
import io
import math
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
source = (ROOT / "node_modules/lucide-react/dist/esm/icons/phone-call.js").read_text()
paths = re.findall(r'd: "([^"]+)"', source)
palettes = {
    "info": ("#316bd8", "#edf4ff"),
    "positive": ("#13835a", "#eaf8f0"),
    "negative": ("#c73951", "#fff0f3"),
    "urgent": ("#b9620b", "#fff5e5"),
    "deadline": ("#7851b8", "#f5effd"),
}
out = ROOT / "server/assets/automation-email"
for name, (accent, background) in palettes.items():
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" viewBox="0 0 24 24" fill="none" stroke="' + accent + '" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + "".join(f'<path d="{path}"/>' for path in paths) + "</svg>"
    glyph = Image.open(io.BytesIO(subprocess.run(
        ["convert", "-background", "none", "svg:-", "png:-"], input=svg.encode(), stdout=subprocess.PIPE, check=True
    ).stdout)).convert("RGBA").resize((210, 210), Image.Resampling.LANCZOS)
    frames = []
    for index in range(16):
        phase = index / 16
        image = Image.new("RGB", (384, 384), "white")
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((35, 43, 349, 357), radius=88, fill="#e8edf3")
        draw.rounded_rectangle((35, 31, 349, 345), radius=88, fill=background)
        # Ring expands gently behind the handset, which remains legible in frame one.
        radius = 122 + 28 * phase
        ring = tuple(round(a * (1-phase) * .25 + 255 * (1-(1-phase)*.25)) for a in tuple(bytes.fromhex(accent[1:])))
        draw.ellipse((192-radius, 187-radius, 192+radius, 187+radius), outline=ring, width=5)
        angle = 3 * math.sin(phase * math.tau)
        receiver = glyph.rotate(angle, Image.Resampling.BICUBIC, expand=False)
        image.paste(receiver, (87, 80), receiver)
        draw.ellipse((269, 264, 346, 341), fill=accent, outline="white", width=8)
        if name == "positive":
            draw.line([(289,303),(302,316),(326,288)], fill="white", width=8)
        elif name == "negative":
            draw.line([(294,289),(323,318)], fill="white", width=7)
            draw.line([(323,289),(294,318)], fill="white", width=7)
        elif name == "deadline":
            draw.ellipse((286,281,329,325), outline="white", width=5)
            draw.line([(307,288),(307,304),(319,310)], fill="white", width=5)
        else:
            draw.line([(307,284),(307,308)], fill="white", width=7)
            draw.ellipse((303,316,311,324), fill="white")
        frames.append(image.resize((128, 128), Image.Resampling.LANCZOS))
    # Finite animation: considerate of motion sensitivity; readable static fallback.
    frames[0].save(out / f"automation-phone-{name}.gif", save_all=True,
                   append_images=frames[1:], duration=90, loop=2, disposal=2, optimize=True)
