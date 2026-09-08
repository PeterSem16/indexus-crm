from pathlib import Path
import fitz

sources = [
    (
        Path("attached_assets/NEXUS_Pulse_Checklist_pre_externeho_testera_SK_1788851712483.pdf"),
        Path(".agents/outputs/nexus-checklist-source-pages"),
    ),
    (
        Path("/tmp/nexus-dotx-pdf/Notes_2026_09_04_1788851185341.pdf"),
        Path(".agents/outputs/nexus-notes-source-pages"),
    ),
]

for source, out in sources:
    out.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(source)
    print(f"{source}: pages={doc.page_count}")
    for index, page in enumerate(doc):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
        target = out / f"page-{index + 1:02d}.png"
        pix.save(target)
        print(target)