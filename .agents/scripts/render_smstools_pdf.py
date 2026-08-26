import fitz
from pathlib import Path
src = Path('attached_assets/SMSTOOLS-API-dokumentacia_1787727770880.pdf')
out = Path('.agents/outputs/smstools-pages')
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open(src)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    pix.save(out / f'page-{i+1:02d}.png')
print(f'rendered {doc.page_count} pages to {out}')
