import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapPin, Navigation } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { queryClient } from "@/lib/queryClient";
import type { FinderContext, FinderSelection } from "@shared/provider-finder";
import { ProviderFinder } from "./ProviderFinder";
import { finderApi } from "./api";
import "./provider-finder.css";

type Customer = { id: string; country: string; firstName: string; lastName: string; address?: string | null; city?: string | null; postalCode?: string | null };
type SavedFinderSelection = FinderSelection & { name?: string; address?: string; city?: string; personName?: string; unavailable?: boolean };
type Placement = "inline" | "header";

function customerFinderKey(customerId: string) {
  return ["/api/provider-finder/customers", customerId];
}

function SavedSelectionCard({ customerId }: { customerId: string }) {
  const { t } = useI18n();
  const c = t.providerFinder;
  const key = customerFinderKey(customerId);
  const saved = useQuery<SavedFinderSelection | null>({
    queryKey: key,
    queryFn: () => finderApi(`/api/provider-finder/customers/${customerId}`),
    staleTime: 0,
  });
  const clear = useMutation({
    mutationFn: () => finderApi(`/api/provider-finder/customers/${customerId}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  if (!saved.data && !clear.isError && !saved.isError) return null;
  return <div className="pf-root pf-stack">
    {saved.data && <div className="pf-selected-card"><div>
      <span className="pf-kicker">{c.selected}</span><strong style={{ display: "block" }}>{saved.data.unavailable ? c.unavailable : saved.data.name}</strong>
      {!saved.data.unavailable && <p className="pf-note">{saved.data.address}, {saved.data.city}{saved.data.personName ? ` · ${saved.data.personName}` : ""}</p>}
    </div><button type="button" className="pf-button" disabled={clear.isPending} onClick={() => clear.mutate()}>{c.clear}</button></div>}
    {(clear.isError || saved.isError) && <p className="pf-error" role="alert">{c.error}</p>}
  </div>;
}

export function CustomerProviderFinderSummary({ customerId }: { customerId: string }) {
  return <SavedSelectionCard customerId={customerId} />;
}

export function CustomerProviderFinder({ customer, placement = "inline" }: { customer: Customer; placement?: Placement }) {
  const { t, locale } = useI18n(); const c = t.providerFinder;
  const { isHidden } = useModuleFieldPermissions("customers");
  const [open, setOpen] = useState(false);
  const contexts = useQuery<FinderContext[]>({ queryKey: ["/api/provider-finder/contexts", customer.country],
    queryFn: () => finderApi(`/api/provider-finder/contexts/${encodeURIComponent(customer.country)}`), enabled: open, staleTime: 0 });
  const key = customerFinderKey(customer.id);
  const save = useMutation({ mutationFn: (selection: FinderSelection | null) => finderApi(`/api/provider-finder/customers/${customer.id}`, selection ? "PUT" : "DELETE", selection || undefined),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: key }); setOpen(false); } });
  const context = contexts.data?.find(x => x.billingCompanyId === "country") || contexts.data?.[0];
  return <div className={placement === "header" ? "pf-root pf-header-root" : "pf-root pf-stack"}>
    {placement === "header" ? <button type="button" className="pf-header-launch" onClick={() => setOpen(true)}
      title={c.title} aria-label={c.title} data-testid="open-customer-provider-finder">
      <span className="pf-header-launch-art" aria-hidden="true"><MapPin className="pf-header-pin" size={20} strokeWidth={2.2} /><Navigation className="pf-header-nav" size={9} strokeWidth={2.7} /></span>
    </button> : <div><Button variant="outline" type="button" onClick={() => setOpen(true)} data-testid="open-customer-provider-finder"><MapPin size={15} className="mr-2" />{c.title}</Button></div>}
    {placement === "inline" && <SavedSelectionCard customerId={customer.id} />}
    {placement === "inline" && save.isError && <p className="pf-error" role="alert">{c.error}</p>}
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
