import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { FinderContext, FinderResult, FinderSelection } from "@shared/provider-finder";
import type { Locale } from "@/i18n";
import { providerFinderTranslations } from "@/i18n/provider-finder-translations";
import { ProviderFinder } from "./ProviderFinder";
import { finderApi } from "./api";

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
  const [choosing, setChoosing] = useState(true);
  const changeRef = useRef(onChange); changeRef.current = onChange;
  useEffect(() => { setSelected(null); setChoosing(true); changeRef.current(null); }, [address, slug]);
  const c = providerFinderTranslations[locale] || providerFinderTranslations.en;
  if (config.isLoading || config.data === null) return null;
  if (config.isError) return <div className="pf-root pf-message pf-error" role="alert">{c.error}
    <button type="button" className="pf-button" onClick={() => void config.refetch()}>{c.search}</button></div>;
  if (!config.data) return null;
  return <div className="pf-root" data-testid="public-provider-finder">
    {selected && !choosing ? <div className="pf-selected-card"><div><span className="pf-kicker">{c.selected}</span>
      <strong style={{ display: "block" }}>{selected.name}</strong><p>{selected.address}, {selected.city}</p>
      <p className="pf-note">{c.publicHint}</p></div><button type="button" className="pf-button" onClick={() => {
        setChoosing(true); setSelected(null); onChange(null);
      }}>{c.clear}</button></div> : <ProviderFinder context={config.data} prefix={prefix} initialAddress={address} locale={locale} publicView
        onInvalidate={() => { setSelected(null); onChange(null); }}
        onSelect={(selection, result) => { setSelected(result); setChoosing(false); onChange(selection); }} />}
  </div>;
}
