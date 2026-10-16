import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { FinderContext, FinderResult, FinderSelection } from "@shared/provider-finder";
import type { Locale } from "@/i18n";
import { providerFinderTranslations } from "@/i18n/provider-finder-translations";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ProviderFinder } from "./ProviderFinder";
import { finderApi } from "./api";
import "./provider-finder.css";

export function PublicProviderFinder({ slug, locale, address, onChange }: {
  slug: string; locale: Locale; address: string; onChange: (selection: FinderSelection | null) => void;
}) {
  const prefix = `/api/public/web-form/${encodeURIComponent(slug)}/providers`;
  const config = useQuery<FinderContext | null>({
    queryKey: [prefix, "config"], queryFn: async () => {
      try { return await finderApi(`${prefix}/config`); }
      catch (e) { if ((e as any).status === 404) return null; throw e; }
    }, staleTime: 0, retry: false,
  });
  const [selected, setSelected] = useState<FinderResult | null>(null);
  const [selection, setSelection] = useState<FinderSelection | null>(null);
  const [open, setOpen] = useState(false);
  const changeRef = useRef(onChange); changeRef.current = onChange;
  useEffect(() => {
    setSelected(null); setSelection(null); setOpen(false); changeRef.current(null);
  }, [address, slug]);
  const c = providerFinderTranslations[locale] || providerFinderTranslations.en;
  if (config.isLoading || config.data === null) return null;
  if (config.isError) return <div className="pf-root pf-message pf-error" role="alert">{c.error}
    <button type="button" className="pf-button" onClick={() => void config.refetch()}>{c.search}</button></div>;
  if (!config.data) return null;

  const personName = selection?.personId ? selected?.people.find(person => person.id === selection.personId)?.name : "";
  return <div className="pf-root pf-stack" data-testid="public-provider-finder">
    {!selection || !selected ? <button type="button" className="pf-button" onClick={() => setOpen(true)}>
      <MapPin size={15} />{c.title}
    </button> : <div className="pf-selected-card"><div>
      <span className="pf-kicker">{c.selected}</span>
      <strong style={{ display: "block" }}>{selected.name}</strong>
      <p>{selected.address}, {selected.city}{personName ? ` · ${personName}` : ""}</p>
      <p className="pf-note">{c.publicHint}</p>
    </div><div className="pf-row">
      <button type="button" className="pf-button" onClick={() => setOpen(true)}>{c.change}</button>
      <button type="button" className="pf-button" onClick={() => {
        setSelected(null); setSelection(null); changeRef.current(null); setOpen(false);
      }}>{c.clear}</button>
    </div></div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="pf-host-dialog z-[10050]" overlayClassName="z-[10040]">
      <DialogTitle className="sr-only">{c.title}</DialogTitle>
      <ProviderFinder context={config.data} prefix={prefix} initialAddress={address} locale={locale} publicView
        onClose={() => setOpen(false)}
        onSelect={(nextSelection, result) => {
          setSelection(nextSelection); setSelected(result); changeRef.current(nextSelection); setOpen(false);
        }} />
    </DialogContent></Dialog>
  </div>;
}
