const LEGAL_FORM_LABELS: Record<string, string> = {
  spolocnostsrucenimobmedzenym: "s.r.o.",
  spolocnostsro: "s.r.o.",
  sro: "s.r.o.",
  akciovaspolocnost: "a.s.",
  as: "a.s.",
  verejnaobchodnaspolocnost: "v.o.s.",
  komanditnaspolocnost: "k.s.",
  druzstvo: "družstvo",
};

export function formatLegalForm(value?: string | null): string {
  if (!value) return "";
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLocaleLowerCase();
  return LEGAL_FORM_LABELS[key] || value;
}
