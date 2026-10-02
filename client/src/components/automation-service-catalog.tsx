import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { Link } from "wouter";
import { serviceVisual } from "./automation-service-visuals";
import { AUTOMATION_TRIGGER_PRESETS, type AutomationTriggerPreset } from "@/lib/automation-trigger-presets";
import { triggerPresetIcons } from "./automation-trigger-context";
import { ArrowRight, Phone } from "lucide-react";

export const SERVICE_IDS = [
  "create_task", "notify_user", "send_email", "send_sms", "webhook",
  "update_entity", "assign_user", "add_tag", "remove_tag",
] as const;
export type ServiceId = typeof SERVICE_IDS[number];
export type InboundService = {
  id: string;
  eventType: string;
  actionType: ServiceId;
  config: Record<string, unknown>;
  conditions: { field: string; op: string; value?: number } | null;
};

export type ServiceCatalogData = {
  managedServices: { id: string; label: string; executor: string; configApi: string }[];
  statusListServices: { value: string; label: string; executor: "per_mission"; configApi: string }[];
  inboundServices: InboundService[];
  outboundServices: InboundService[];
  modules: { value: string; label: string }[];
  eventTypes: { value: string; label: string; availableIn: string[] }[];
  actionTypes: {
    value: string; label: string; availableIn: string[];
    recipientTypes: string[]; purpose: string; needs: string[];
  }[];
  proposedPulseEvents?: string[];
  proposedPulseServices?: { value: string; requires: string[] }[];
  integrationStatus: { module: string; state: string; availableIn: string[]; legacyActions?: string[] }[];
};

export function AutomationServiceCatalog({
  catalog, onSelect, onSelectInbound, onSelectOutbound, onSelectTrigger, onManage, compact = false,
}: {
  catalog: ServiceCatalogData;
  onSelect: (service: ServiceId) => void;
  onSelectInbound?: (service: InboundService) => void;
  onSelectOutbound?: (service: InboundService) => void;
  onSelectTrigger?: (preset: AutomationTriggerPreset) => void;
  onManage?: (serviceId: string) => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const copy = t.automationServices;
  const canManageStatusList = user?.role === "admin" || user?.role === "manager";
  const services = catalog.actionTypes;
  const moduleNames = (ids: string[]) => ids.map(id =>
    id === "call" ? `${copy.inboundTitle} / ${copy.outboundTitle}` :
    id === "communication" ? copy.triggerPresets.moduleLabel :
    catalog.modules.find(m => m.value === id)?.label || id).join(" · ");

  return (
    <div className="space-y-6" data-testid="automation-service-catalog">
      <div>
        <h2 className="text-xl font-semibold">{copy.heading}</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{copy.intro}</p>
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-2 text-xs">
          <a href="#automation-pulse-services" className="rounded-md border px-3 py-2 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            Nexus Pulse · {copy.inboundTitle} / {copy.outboundTitle}: {copy.available} · {copy.pulseTitle}: {copy.planned}
          </a>
          <a href="#automation-status-list" className="rounded-md border px-3 py-2 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            {copy.statusList.heading}: {copy.statusList.source}
          </a>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {services.map(service => {
          const id = service.value as ServiceId;
          const visual = serviceVisual(id);
          const Icon = visual.icon;
          return (
            <Card key={id} className={`border-border/80 transition-colors ${visual.border}`}>
              <CardContent className="p-4 flex flex-col gap-3 h-full">
                <div className="flex items-start gap-3">
                  <span className={`rounded-xl p-2.5 shrink-0 ${visual.tile} ${visual.accent}`}><Icon className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-semibold leading-6">{copy.names[id] || service.label}</h3>
                    <Badge variant="secondary" className="mt-1 text-[10px]">{copy.available}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground flex-1">{copy.descriptions[id] || service.purpose}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{copy.where}: </span>{moduleNames(service.availableIn)}
                </p>
                <Button variant="outline" size="sm" className="w-full justify-between"
                  data-testid={`choose-service-${id}`} onClick={() => onSelect(id)}>
                  {copy.start}<ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!compact && (
        <>
          <section className="rounded-lg border p-4 space-y-3" data-testid="automation-trigger-presets">
            <div>
              <h3 className="font-semibold">{copy.triggerPresets.heading}</h3>
              <p className="text-sm text-muted-foreground mt-1">{copy.triggerPresets.info}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {AUTOMATION_TRIGGER_PRESETS.filter(preset =>
                catalog.eventTypes.some(event => event.value === preset.eventType && event.availableIn.includes(preset.module))
              ).map(preset => {
                const Icon = triggerPresetIcons[preset.id];
                return <Button key={preset.id} variant="outline" className="h-auto min-h-12 min-w-0 justify-start gap-2 text-left whitespace-normal"
                  disabled={!onSelectTrigger} onClick={() => onSelectTrigger?.(preset)}
                  data-testid={`choose-trigger-${preset.id}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="block">{copy.triggerPresets.labels[preset.id]}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {copy.triggerPresets.details[preset.id].source}
                    </span>
                  </span>
                </Button>;
              })}
            </div>
          </section>
          <section className="rounded-lg border p-4 space-y-3" data-testid="automation-managed-services">
            <div>
              <h3 className="font-semibold">{copy.managed.heading}</h3>
              <p className="text-sm text-muted-foreground mt-1">{copy.managed.info}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(catalog.managedServices || []).map(service => {
                const visual = serviceVisual(service.id);
                const Icon = visual.icon;
                const isNotification = service.id === "notification_rules";
                return <Card key={service.id} className={`border-border/80 ${visual.border}`}>
                  <CardContent className="p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-xl p-2.5 ${visual.tile} ${visual.accent}`}><Icon className="h-5 w-5" /></span>
                      <div>
                        <h4 className="font-semibold">{isNotification ? copy.managed.notificationTitle : service.id === "metric_alerts" ? copy.managed.alertTitle : service.label}</h4>
                        <Badge variant="secondary" className="text-[10px]">{copy.managed.existing}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">
                      {isNotification ? copy.managed.notificationInfo : service.id === "metric_alerts" ? copy.managed.alertInfo : service.label}
                    </p>
                    <Button variant="outline" size="sm" className="w-full justify-between"
                      disabled={!onManage || !["notification_rules", "metric_alerts"].includes(service.id)}
                      onClick={() => onManage?.(service.id)} data-testid={`manage-service-${service.id}`}>
                      {copy.managed.manage}<ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>;
              })}
            </div>
          </section>
          <section className="rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Phone className="h-4 w-4" />{copy.inboundTitle}<Badge variant="secondary">{copy.available}</Badge></h3>
            <p className="text-sm text-muted-foreground">{copy.inboundInfo}</p>
            <p className="text-xs text-muted-foreground">{copy.inboundGuard}</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(catalog.inboundServices || []).map(service => (
                <Card key={service.id} className={`border-border/80 transition-colors ${serviceVisual(service.id).border}`}>
                  <CardContent className="p-4 flex flex-col gap-2 h-full">
                    <div className="flex items-center gap-3">
                      {(() => { const visual = serviceVisual(service.id); const Icon = visual.icon; return (
                        <span className={`rounded-xl p-2 shrink-0 ${visual.tile} ${visual.accent}`}><Icon className="h-5 w-5" /></span>
                      ); })()}
                      <h4 className="font-semibold leading-snug">{copy.inboundNames[service.id] || service.id}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground flex-1">{copy.inboundDescriptions[service.id]}</p>
                    <Badge variant="outline" className="w-fit text-[10px]">
                      {t.automationDraft.eventCodeLabels[service.eventType] || service.eventType}
                    </Badge>
                    <Button variant="outline" size="sm" className="w-full justify-between"
                      onClick={() => onSelectInbound?.(service)} disabled={!onSelectInbound}
                      data-testid={`choose-inbound-${service.id}`}>
                      {copy.start}<ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
          <section className="rounded-lg border p-4 space-y-3" data-testid="automation-outbound-services">
            <h3 className="font-semibold flex items-center gap-2"><Phone className="h-4 w-4" />{copy.outboundTitle}<Badge variant="secondary">{copy.available}</Badge></h3>
            <p className="text-sm text-muted-foreground">{copy.outboundInfo}</p>
            <p className="text-xs text-muted-foreground">{copy.outboundGuard}</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(catalog.outboundServices || []).map(service => {
                const visual = serviceVisual(service.id);
                const Icon = visual.icon;
                return <Card key={service.id} className={`border-border/80 transition-colors ${visual.border}`}>
                  <CardContent className="p-4 flex flex-col gap-2 h-full">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-xl p-2 shrink-0 ${visual.tile} ${visual.accent}`}><Icon className="h-5 w-5" /></span>
                      <h4 className="font-semibold leading-snug">{copy.outboundNames[service.id as keyof typeof copy.outboundNames] || service.id}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground flex-1">{copy.outboundDescriptions[service.id as keyof typeof copy.outboundDescriptions]}</p>
                    <Badge variant="outline" className="w-fit text-[10px]">
                      {t.automationDraft.eventCodeLabels[service.eventType] || service.eventType}
                    </Badge>
                    <Button variant="outline" size="sm" className="w-full justify-between"
                      onClick={() => onSelectOutbound?.(service)} disabled={!onSelectOutbound}
                      data-testid={`choose-outbound-${service.id}`}>
                      {copy.start}<ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>;
              })}
            </div>
          </section>
          {catalog.proposedPulseEvents && catalog.proposedPulseServices && <section id="automation-pulse-services" className="rounded-lg border p-4 space-y-4 scroll-mt-4">
            <div>
              <h3 className="font-semibold">{copy.pulseTitle}</h3>
              <p className="text-sm text-muted-foreground mt-1">{copy.pulseInfo}</p>
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.sources}</p>
            <div className="flex flex-wrap gap-2">
              {catalog.proposedPulseEvents.map(event => (
                <Badge key={event} variant="outline" className="py-1.5">{copy.pulse[event as keyof typeof copy.pulse] || event}</Badge>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catalog.proposedPulseServices.map(service => {
                const key = service.value as keyof typeof copy.pulseServices;
                return (
                  <div key={key} className="rounded-md border bg-muted/20 p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm">{copy.pulseServices[key] || key}</h4>
                      <Badge variant="outline" className="text-[10px] shrink-0">{copy.planned}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{copy.pulseServiceInfo[key]}</p>
                  </div>
                );
              })}
            </div>
          </section>
          }
          <section id="automation-status-list" className="rounded-lg border p-4 space-y-4 scroll-mt-4" data-testid="automation-status-list-services">
            <div>
              <h3 className="font-semibold">{copy.statusList.heading}<Badge variant="secondary" className="ml-2">{copy.statusList.source}</Badge></h3>
              <p className="text-sm text-muted-foreground mt-1">{copy.statusList.info}</p>
            </div>
            <p className="text-sm text-muted-foreground">{copy.statusList.editorNotice}</p>
            {canManageStatusList && (
              <Button asChild variant="outline" size="sm">
                <Link href="/campaigns">{copy.statusList.manage}<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            )}
          </section>
        </>
      )}
    </div>
  );
}