from pathlib import Path

import fitz

pdf_path = Path(".agents/outputs/nexus_pulse_test_results/NEXUS_Pulse_regresny_testovaci_formular_oprav_SK.pdf")
output_dir = Path(".agents/outputs/nexus_pulse_test_results/regression-form-preview")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(pdf_path)
for index, page in enumerate(document):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    pixmap.save(output_dir / f"page-{index + 1:02}.png")

print(f"Rendered {document.page_count} pages into {output_dir}")