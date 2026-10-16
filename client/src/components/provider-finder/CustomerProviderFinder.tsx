import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { queryClient } from "@/lib/queryClient";
import type { FinderContext, FinderSelection } from "@shared/provider-finder";
import { ProviderFinder } from "./ProviderFinder";
import { finderApi } from "./api";
import "./provider-finder.css";

export function CustomerProviderFinder({ customer }: { customer: { id: string; country: string; firstName: string; lastName: string; address?: string | null; city?: string | null; postalCode?: string | null } }) {
  const { t, locale } = useI18n(); const c = t.providerFinder;
  const { isHidden } = useModuleFieldPermissions("customers");
  const [open, setOpen] = useState(false);
  const contexts = useQuery<FinderContext[]>({ queryKey: ["/api/provider-finder/contexts", customer.country],
    queryFn: () => finderApi(`/api/provider-finder/contexts/${encodeURIComponent(customer.country)}`), enabled: open, staleTime: 0 });
  const key = ["/api/provider-finder/customers", customer.id];
  const saved = useQuery<(FinderSelection & { name?: string; address?: string; city?: string; personName?: string; unavailable?: boolean }) | null>({
    queryKey: key, queryFn: () => finderApi(`/api/provider-finder/customers/${customer.id}`), staleTime: 0,
  });
  const save = useMutation({ mutationFn: (selection: FinderSelection | null) => finderApi(`/api/provider-finder/customers/${customer.id}`, selection ? "PUT" : "DELETE", selection || undefined),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: key }); setOpen(false); } });
  const context = contexts.data?.find(x => x.billingCompanyId === "country") || contexts.data?.[0];
  return <div className="pf-root pf-stack">
    <div><Button variant="outline" type="button" onClick={() => setOpen(true)} data-testid="open-customer-provider-finder"><MapPin size={15} className="mr-2" />{c.title}</Button></div>
    {saved.data && <div className="pf-selected-card"><div>
      <span className="pf-kicker">{c.selected}</span><strong style={{ display: "block" }}>{saved.data.unavailable ? c.unavailable : saved.data.name}</strong>
      {!saved.data.unavailable && <p className="pf-note">{saved.data.address}, {saved.data.city}{saved.data.personName ? ` · ${saved.data.personName}` : ""}</p>}
    </div><button type="button" className="pf-button" disabled={save.isPending} onClick={() => save.mutate(null)}>{c.clear}</button></div>}
    {(save.isError || saved.isError) && <p className="pf-error" role="alert">{c.error}</p>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="pf-host-dialog z-[10050]" overlayClassName="z-[10040]">
      <DialogTitle className="sr-only">{c.title}</DialogTitle>
      {context ? <ProviderFinder key={`${customer.id}:${context.country}`} context={context}
        prefix={`/api/provider-finder/context/country/${context.country}`} locale={locale}
        initialAddress={[!isHidden("address") && customer.address, !isHidden("postal_code") && customer.postalCode, !isHidden("city") && customer.city].filter(Boolean).join(", ")}
        customerName={[!isHidden("first_name") && customer.firstName, !isHidden("last_name") && customer.lastName].filter(Boolean).join(" ")} onClose={() => setOpen(false)}
        onSelect={selection => save.mutateAsync(selection).then(() => {})} />
        : <div className="pf-root pf-panel"><h2 className="pf-title">{c.title}</h2>
          {contexts.isLoading ? <p>{c.loading}</p> : contexts.isError ? <div role="alert">{c.error}
            <button type="button" className="pf-button" onClick={() => void contexts.refetch()}>{c.search}</button></div> : <p>{c.noContexts}</p>}
          <button type="button" className="pf-button" onClick={() => setOpen(false)}>{c.close}</button>
        </div>}
    </DialogContent></Dialog>
  </div>;
}
