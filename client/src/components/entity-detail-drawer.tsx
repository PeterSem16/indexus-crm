import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import {
  Building2, MapPin, Phone, Mail, Link2, User, Stethoscope, Hospital,
  Loader2, Smartphone,
} from "lucide-react";
import type { Customer } from "@shared/schema";
import { CustomerDetailsContent } from "@/pages/customers";

export type EntityRef = { type: "hospital" | "clinic" | "customer"; id: string };

function Row({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

// Hospital / clinic: lightweight reference card. It has no nested portal UI, so it can
// safely sit at z-[10030] above the Back Office drawers.
function InstitutionDetailDrawer({ entity, onClose }: { entity: EntityRef | null; onClose: () => void }) {
  const { t } = useI18n();

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

  const typeLabel = entity?.type === "hospital" ? t.backOffice.hospitalLabel : t.backOffice.clinicLabel;
  const name = data ? (data.fullName || data.name || "—") : "—";
  const address = data ? [data.address, data.city, data.postalCode].filter(Boolean).join(", ") : "";
  const country = data?.country || data?.countryCode;

  return (
    <Sheet open={!!entity} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto z-[10030]"
        data-testid="entity-detail-drawer"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 pr-6 min-w-0">
            {entity?.type === "hospital"
              ? <Hospital className="h-5 w-5 text-blue-600 shrink-0" />
              : <Stethoscope className="h-5 w-5 text-emerald-600 shrink-0" />}
            <span className="truncate">{isLoading ? "…" : name}</span>
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data ? (
          <div className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{typeLabel}</Badge>
              {data.isActive === true && <Badge className="bg-green-600 text-white text-xs">{t.common.active}</Badge>}
              {data.isActive === false && <Badge variant="destructive" className="text-xs">{t.common.inactive}</Badge>}
              {data.status === "active" && <Badge className="bg-green-600 text-white text-xs">{t.common.active}</Badge>}
              {data.status === "inactive" && <Badge variant="destructive" className="text-xs">{t.common.inactive}</Badge>}
              {data.status && data.status !== "active" && data.status !== "inactive" && (
                <Badge variant="secondary" className="text-xs">{data.status}</Badge>
              )}
              {country && <Badge variant="outline">{country}</Badge>}
            </div>

            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                {data.name && <Row icon={Building2}><span className="font-medium">{data.name}</span></Row>}
                {address && <Row icon={MapPin}>{address}</Row>}
                {data.phone && (
                  <Row icon={Phone}>
                    <a href={`tel:${data.phone}`} className="hover:text-foreground" data-testid="link-entity-phone">{data.phone}</a>
                  </Row>
                )}
                {data.mobile && (
                  <Row icon={Smartphone}>
                    <a href={`tel:${data.mobile}`} className="hover:text-foreground" data-testid="link-entity-mobile">{data.mobile}</a>
                  </Row>
                )}
                {data.email && (
                  <Row icon={Mail}>
                    <a href={`mailto:${data.email}`} className="hover:text-foreground truncate" data-testid="link-entity-email">{data.email}</a>
                  </Row>
                )}
                {data.website && (
                  <Row icon={Link2}>
                    <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{data.website}</a>
                  </Row>
                )}
                {data.notes && (
                  <Row icon={Building2}><span className="text-muted-foreground italic">{data.notes}</span></Row>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground" data-testid="text-entity-no-data">{t.common.noData}</div>
        )}
      </SheetContent>
    </Sheet>
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
