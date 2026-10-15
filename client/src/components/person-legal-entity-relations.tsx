import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Link2, UserRound } from "lucide-react";
import type { PersonViaFacility, RegistryPersonLink } from "@shared/healthcare-legal-entity";
import type { HealthcareLegalEntityCopy } from "@/i18n/healthcare-legal-entity-translations";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Response = { facilities: PersonViaFacility[]; direct: RegistryPersonLink[] };
export function PersonLegalEntityRelations({ personId }: { personId: string }) {
  const c = useI18n().t.healthcareLegalEntity as HealthcareLegalEntityCopy;
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, refetch } = useQuery<Response>({
    queryKey: ["/api/healthcare-legal-entities/persons", personId],
    queryFn: async () => {
      const response = await fetch(`/api/healthcare-legal-entities/persons/${personId}`, { credentials: "include" });
      if (!response.ok) throw new Error("request_failed");
      return response.json();
    },
    enabled: !!personId,
  });
  return (
    <Card className="border-primary/20 bg-primary/[0.02]" data-testid="person-legal-entity-relations">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Link2 className="h-4 w-4" /></div>
          <div><h3 className="font-semibold">{c.title}</h3><p className="mt-1 text-xs text-muted-foreground">{c.registryNote}</p></div>
        </div>
        {isLoading ? <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : isError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-sm"><span>{c.loadError}</span><Button variant="outline" size="sm" onClick={() => refetch()}>{c.retry}</Button></div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{c.indirectPeople}</div>
              {data?.facilities?.length ? (
                <div className="space-y-2">
                  {data.facilities.map((item, i) => (
                    <RelationRow key={`${item.facilityId}-${item.legalEntityId || ""}-${i}`} title={item.legalEntityName || "—"} subtitle={`${item.facilityName} · ${item.facilityType}`} role={item.role || ""} action={c.details} onClick={item.legalEntityId ? () => setLocation(`/healthcare-legal-entities?id=${item.legalEntityId}`) : undefined} />
                  ))}
                </div>
              ) : <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">{c.noIndirectPeople}</p>}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><UserRound className="h-3.5 w-3.5" />{c.people}</div>
              {data?.direct?.length ? (
                <div className="space-y-2">
                  {data.direct.map((item) => <RelationRow key={item.id} title={item.personName} subtitle={item.role} role={item.validTo ? c.ended : c.current} action={c.details} onClick={() => setLocation(`/healthcare-legal-entities?id=${item.legalEntityId}`)} />)}
                </div>
              ) : <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">{c.noPeople}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
function RelationRow({ title, subtitle, role, action, onClick }: { title: string; subtitle: string; role: string; action: string; onClick?: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2.5"><div className="min-w-0"><div className="truncate text-sm font-medium">{title}</div><div className="truncate text-xs text-muted-foreground">{subtitle}</div>{role && <div className="mt-1 text-[11px] text-muted-foreground">{role}</div>}</div>{onClick && <Button variant="outline" size="sm" onClick={onClick}>{action}</Button>}</div>;
}
