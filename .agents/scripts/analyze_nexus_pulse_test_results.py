from pathlib import Path
import json
import re

import fitz


FILES = [
    Path("attached_assets/NEXUS_Pulse_komplexny_testovaci_formular_SK_2026_09_10_melicha_1789110011368.pdf"),
    Path("attached_assets/NEXUS_Pulse_komplexny_testovaci_formular_SK_seman_1789110053949.pdf"),
]
OUT = Path(".agents/outputs/nexus_pulse_test_results")
OUT.mkdir(parents=True, exist_ok=True)


def norm(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def main():
    for source in FILES:
        stem = source.stem
        doc = fitz.open(source)
        pages = []
        widgets = []
        for page_number, page in enumerate(doc, 1):
            pages.append(
                {
                    "page": page_number,
                    "text": page.get_text("text"),
                }
            )
            page_widgets = page.widgets()
            if page_widgets:
                for widget in page_widgets:
                    widgets.append(
                        {
                            "page": page_number,
                            "name": widget.field_name,
                            "type": widget.field_type_string,
                            "value": widget.field_value,
                            "label": norm(widget.field_label),
                            "rect": [round(x, 1) for x in widget.rect],
                        }
                    )

        (OUT / f"{stem}.pages.json").write_text(
            json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (OUT / f"{stem}.widgets.json").write_text(
            json.dumps(widgets, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (OUT / f"{stem}.txt").write_text(
            "\n\n".join(f"=== PAGE {p['page']} ===\n{p['text']}" for p in pages),
            encoding="utf-8",
        )

        # Render a low-resolution contact sheet so layout/marks are visually inspected.
        thumb_width, thumb_height = 180, 255
        columns = 5
        rows = (len(doc) + columns - 1) // columns
        sheet = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, columns * thumb_width, rows * thumb_height), 0)
        sheet.clear_with(0xFFFFFF)
        for index, page in enumerate(doc):
            pix = page.get_pixmap(matrix=fitz.Matrix(thumb_width / page.rect.width, thumb_height / page.rect.height), alpha=False)
            x = (index % columns) * thumb_width
            y = (index // columns) * thumb_height
            sheet.copy(pix, fitz.IRect(x, y, x + pix.width, y + pix.height))
        sheet.save(str(OUT / f"{stem}.contact-sheet.png"))

        print(f"{source.name}: pages={len(doc)} widgets={len(widgets)}")
        print(f"  non-empty widgets={sum(1 for w in widgets if norm(w['value']))}")
        for widget in widgets:
            if norm(widget["value"]):
                print(f"  p{widget['page']} {widget['name']} = {widget['value']!r}")


if __name__ == "__main__":
    main()