import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import {
  Building2, MapPin, Phone, Mail, Link2, User, Stethoscope, Hospital,
  Loader2, ExternalLink, Smartphone,
} from "lucide-react";

export type EntityRef = { type: "hospital" | "clinic" | "customer"; id: string };

function fullPageUrl(entity: EntityRef): string {
  if (entity.type === "customer") return `/customers?view=${encodeURIComponent(entity.id)}`;
  return `/medical-partner-network?entityType=${entity.type}&entityId=${encodeURIComponent(entity.id)}`;
}

function Row({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function EntityDetailDrawer({ entity, onClose }: { entity: EntityRef | null; onClose: () => void }) {
  const { t } = useI18n();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/entity-detail", entity?.type, entity?.id],
    queryFn: async () => {
      if (!entity) return null;
      const endpoint = entity.type === "hospital" ? "hospitals" : entity.type === "clinic" ? "clinics" : "customers";
      const res = await fetch(`/api/${endpoint}/${entity.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load entity");
      return res.json();
    },
    enabled: !!entity,
  });

  const isInstitution = entity?.type === "hospital" || entity?.type === "clinic";
  const typeLabel = entity?.type === "hospital" ? t.backOffice.hospitalLabel
    : entity?.type === "clinic" ? t.backOffice.clinicLabel
    : t.backOffice.customerLabel;

  const name = data
    ? (isInstitution
      ? (data.fullName || data.name || "—")
      : `${data.firstName || ""} ${data.lastName || ""}`.trim() || "—")
    : "—";

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
            {entity?.type === "hospital" ? <Hospital className="h-5 w-5 text-blue-600 shrink-0" /> :
             entity?.type === "clinic" ? <Stethoscope className="h-5 w-5 text-emerald-600 shrink-0" /> :
             <User className="h-5 w-5 text-violet-600 shrink-0" />}
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
                {isInstitution && data.name && <Row icon={Building2}><span className="font-medium">{data.name}</span></Row>}
                {!isInstitution && <Row icon={User}><span className="font-medium">{name}</span></Row>}
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

            {entity?.type === "customer" && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => window.open(fullPageUrl(entity), "_blank", "noopener,noreferrer")}
                data-testid="btn-entity-open-full"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {t.backOffice.openContact}
              </Button>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground" data-testid="text-entity-no-data">{t.common.noData}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
