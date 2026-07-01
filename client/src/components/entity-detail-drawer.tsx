import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { User, Stethoscope, Hospital, Loader2 } from "lucide-react";
import type { Customer } from "@shared/schema";
import { CustomerDetailsContent } from "@/pages/customers";
import { HospitalEditDrawer } from "@/pages/hospitals";
import { ClinicFormSheet } from "@/components/clinic-form-wizard";
import { queryClient } from "@/lib/queryClient";

export type EntityRef = { type: "hospital" | "clinic" | "customer"; id: string };

// Hospital / clinic: open the SAME full detail card used on the Hospitals / MPN pages
// (HospitalEditDrawer / ClinicFormSheet), so the agent can fully work with the entity
// without leaving Back Office. We fetch the full record first, then mount the real card.
//
// Z-INDEX: both cards are elevated to z-[9994] — above the Back Office host drawer
// (content z-[9991]) but BELOW their own portalled popups (Dialog z-[9996], Popover
// z-[9999], Select z-[10000]) so every dropdown/dialog inside the card stays clickable.
// Do NOT raise this above 9995 or the card's selects/dialogs will hide behind it.
function InstitutionDetailDrawer({ entity, onClose }: { entity: EntityRef | null; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/entity-detail", entity?.type, entity?.id],
    queryFn: async () => {
      if (!entity) return null;
      const endpoint = entity.type === "hospital" ? "hospitals" : "clinics";
      const res = await fetch(`/api/${endpoint}/${entity.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load entity");
      return res.json();
    },
    enabled: !!entity,
  });

  // While the full record loads, show a lightweight elevated sheet for instant feedback.
  if (entity && (isLoading || !data)) {
    return (
      <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto z-[9994]"
          data-testid="entity-detail-drawer"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 pr-6 min-w-0">
              {entity.type === "hospital"
                ? <Hospital className="h-5 w-5 text-blue-600 shrink-0" />
                : <Stethoscope className="h-5 w-5 text-emerald-600 shrink-0" />}
              <span className="truncate">…</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!entity || !data) return null;

  if (entity.type === "hospital") {
    return (
      <HospitalEditDrawer
        hospital={data}
        portalToBody
        backdropClassName="z-[9993]"
        panelClassName="z-[9994]"
        onClose={onClose}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
          queryClient.invalidateQueries({ queryKey: ["/api/entity-detail", entity.type, entity.id] });
          onClose();
        }}
      />
    );
  }

  return (
    <ClinicFormSheet
      open
      initialData={data}
      sheetContentClassName="z-[9994]"
      onOpenChange={(o) => { if (!o) onClose(); }}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
        queryClient.invalidateQueries({ queryKey: ["/api/entity-detail", entity.type, entity.id] });
        onClose();
      }}
    />
  );
}

// Customer: the FULL client card (all tabs + fields), reused verbatim from the customers
// page so the agent can actually work with the client without leaving Back Office.
//
// Z-INDEX: the host sheet is z-[9994] on purpose — above the Back Office drawer (content
// z-[9991]) but BELOW the card's own portalled popups (Dialog z-[9996], Popover z-[9999],
// Select z-[10000]). That keeps every dropdown/dialog inside the card clickable on top of
// the sheet. Do NOT raise this above 9995 or the card's selects/dialogs will hide behind it.
function CustomerFullCardDrawer({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const { t } = useI18n();

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ["/api/customers", customerId],
    enabled: !!customerId,
  });

  const name = customer
    ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "—"
    : "—";

  return (
    <Sheet open={!!customerId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl p-0 gap-0 overflow-hidden flex flex-col z-[9994]"
        data-testid="drawer-customer-full"
      >
        <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b bg-muted/30 pr-12">
          <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <User className="h-[18px] w-[18px] text-violet-600" />
          </div>
          <div className="min-w-0">
            <SheetTitle className="text-base font-semibold truncate" data-testid="text-customer-full-name">
              {isLoading ? "…" : name}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">{t.backOffice.customerLabel}</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : customer ? (
            <CustomerDetailsContent customer={customer} onEdit={() => {}} hideEditButton />
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground" data-testid="text-customer-no-data">{t.common.noData}</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EntityDetailDrawer({ entity, onClose }: { entity: EntityRef | null; onClose: () => void }) {
  const institutionEntity = entity && entity.type !== "customer" ? entity : null;
  const customerId = entity && entity.type === "customer" ? entity.id : null;
  return (
    <>
      <InstitutionDetailDrawer entity={institutionEntity} onClose={onClose} />
      <CustomerFullCardDrawer customerId={customerId} onClose={onClose} />
    </>
  );
}
