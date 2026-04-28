import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone, Mail, MessageSquare, Send, Target,
  ArrowRight, Clock, CheckCircle, XCircle, AlertTriangle,
  PhoneMissed, PhoneOff, MailOpen, MousePointerClick,
  UserPlus, RefreshCw, StickyNote, Tag, Filter,
  Search, ChevronDown, ChevronUp, Megaphone
} from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { useI18n } from "@/i18n";

interface EntityCampaignTimelineProps {
  entityType: "customer" | "hospital" | "clinic" | "collaborator";
  entityId: string;
  entityName?: string;
}

interface TimelineEntry {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  campaignId: string;
  campaignName: string | null;
  campaignContactId: string | null;
  channel: string;
  action: string;
  status: string | null;
  previousStatus: string | null;
  dispositionCode: string | null;
  phaseId: string | null;
  phaseName: string | null;
  phaseNumber: number | null;
  userId: string | null;
  userName: string | null;
  notes: string | null;
  metadata: any;
  createdAt: string;
}

const channelIcons: Record<string, any> = {
  phone: Phone,
  email: Mail,
  sms: MessageSquare,
  mailchimp: Send,
};

const channelColors: Record<string, string> = {
  phone: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  email: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  sms: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  mailchimp: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

const actionIcons: Record<string, any> = {
  call_made: Phone,
  call_answered: CheckCircle,
  call_missed: PhoneMissed,
  call_failed: PhoneOff,
  email_sent: Mail,
  email_opened: MailOpen,
  email_clicked: MousePointerClick,
  email_bounced: AlertTriangle,
  sms_sent: MessageSquare,
  sms_delivered: CheckCircle,
  sms_failed: XCircle,
  mailchimp_sent: Send,
  mailchimp_opened: MailOpen,
  mailchimp_clicked: MousePointerClick,
  mailchimp_bounced: AlertTriangle,
  mailchimp_unsubscribed: XCircle,
  status_change: ArrowRight,
  callback_scheduled: Clock,
  note_added: StickyNote,
  disposition_set: Tag,
  phase_entered: ArrowRight,
  phase_completed: CheckCircle,
  phase_skipped: RefreshCw,
  contact_added: UserPlus,
  contact_completed: CheckCircle,
  contact_requeued: RefreshCw,
};

const actionColors: Record<string, string> = {
  call_answered: "text-green-500",
  call_missed: "text-yellow-500",
  call_failed: "text-red-500",
  call_made: "text-blue-500",
  email_sent: "text-purple-500",
  email_opened: "text-green-500",
  email_clicked: "text-blue-500",
  email_bounced: "text-red-500",
  sms_sent: "text-green-500",
  sms_delivered: "text-green-500",
  sms_failed: "text-red-500",
  mailchimp_sent: "text-orange-500",
  mailchimp_opened: "text-green-500",
  mailchimp_clicked: "text-blue-500",
  mailchimp_bounced: "text-red-500",
  mailchimp_unsubscribed: "text-red-500",
  status_change: "text-blue-500",
  callback_scheduled: "text-yellow-500",
  note_added: "text-gray-500",
  disposition_set: "text-indigo-500",
  phase_entered: "text-cyan-500",
  phase_completed: "text-green-500",
  phase_skipped: "text-gray-400",
  contact_added: "text-green-500",
  contact_completed: "text-green-500",
  contact_requeued: "text-orange-500",
};

function getActionLabel(action: string, t: any): string {
  return t?.campaignTimeline?.actions?.[action] || action;
}

function getChannelLabel(channel: string, t: any): string {
  return t?.campaignTimeline?.channels?.[channel] || channel;
}

function getStatusBadgeVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  switch (status) {
    case "completed": return "default";
    case "contacted": return "secondary";
    case "failed": case "not_interested": return "destructive";
    default: return "outline";
  }
}

export default function EntityCampaignTimeline({ entityType, entityId, entityName }: EntityCampaignTimelineProps) {
  const { t } = useI18n();
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const { data: timeline = [], isLoading } = useQuery<TimelineEntry[]>({
    queryKey: ["/api/entity-campaign-timeline", entityType, entityId],
    enabled: !!entityId,
    refetchInterval: 15000,
  });

  const filteredTimeline = useMemo(() => {
    let entries = timeline;
    if (filterChannel !== "all") {
      entries = entries.filter(e => e.channel === filterChannel);
    }
    if (filterAction !== "all") {
      entries = entries.filter(e => e.action === filterAction);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(e =>
        (e.campaignName || "").toLowerCase().includes(q) ||
        (e.notes || "").toLowerCase().includes(q) ||
        (e.userName || "").toLowerCase().includes(q) ||
        (e.dispositionCode || "").toLowerCase().includes(q) ||
        (e.phaseName || "").toLowerCase().includes(q)
      );
    }
    return entries;
  }, [timeline, filterChannel, filterAction, searchQuery]);

  const displayTimeline = showAll ? filteredTimeline : filteredTimeline.slice(0, 20);

  const uniqueChannels = useMemo(() => {
    return [...new Set(timeline.map(e => e.channel))];
  }, [timeline]);

  const uniqueActions = useMemo(() => {
    return [...new Set(timeline.map(e => e.action))];
  }, [timeline]);

  const campaignStats = useMemo(() => {
    const campaigns = new Map<string, { name: string; count: number; channels: Set<string> }>();
    timeline.forEach(e => {
      if (!campaigns.has(e.campaignId)) {
        campaigns.set(e.campaignId, { name: e.campaignName || "Kampaň", count: 0, channels: new Set() });
      }
      const s = campaigns.get(e.campaignId)!;
      s.count++;
      s.channels.add(e.channel);
    });
    return campaigns;
  }, [timeline]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {(t as any)?.campaignTimeline?.title || "Campaign History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="campaign-timeline-title">
          <Target className="h-5 w-5" />
          {(t as any)?.campaignTimeline?.title || "Campaign History"}
        </CardTitle>
        <CardDescription>
          {(t as any)?.campaignTimeline?.description || "All campaign results (calls, emails, SMS, Mailchimp) and phase tracking"}
        </CardDescription>
        {campaignStats.size > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Array.from(campaignStats.entries()).map(([campaignId, stats]) => (
              <Badge key={campaignId} variant="secondary" className="text-xs">
                <Megaphone className="h-3 w-3 mr-1" />
                {stats.name} ({stats.count}x)
                {Array.from(stats.channels).map(ch => {
                  const Icon = channelIcons[ch] || Target;
                  return <Icon key={ch} className="h-3 w-3 ml-1 inline" />;
                })}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={(t as any)?.campaignTimeline?.searchPlaceholder || "Search timeline..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-campaign-timeline-search"
            />
          </div>
          <Select value={filterChannel} onValueChange={setFilterChannel}>
            <SelectTrigger className="w-[140px]" data-testid="select-campaign-timeline-channel">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{(t as any)?.campaignTimeline?.allChannels || "All channels"}</SelectItem>
              {uniqueChannels.map(ch => (
                <SelectItem key={ch} value={ch}>{getChannelLabel(ch, t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[160px]" data-testid="select-campaign-timeline-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{(t as any)?.campaignTimeline?.allActions || "All actions"}</SelectItem>
              {uniqueActions.map(a => (
                <SelectItem key={a} value={a}>{getActionLabel(a, t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredTimeline.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-campaign-timeline-empty">
            {timeline.length === 0
              ? ((t as any)?.campaignTimeline?.noHistory || "No campaign history for this contact")
              : ((t as any)?.campaignTimeline?.noFiltered || "No results for selected filters")}
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-1">
              {displayTimeline.map((entry) => {
                const ActionIcon = actionIcons[entry.action] || Target;
                const color = actionColors[entry.action] || "text-muted-foreground";
                const isExpanded = expanded.has(entry.id);

                return (
                  <div key={entry.id} className="relative pl-12 py-2 group" data-testid={`timeline-entry-${entry.id}`}>
                    <div className={`absolute left-3 top-3 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-background ${color.replace("text-", "border-")}`}>
                      <div className={`w-2 h-2 rounded-full ${color.replace("text-", "bg-")}`} />
                    </div>
                    
                    <div
                      className="bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(entry.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <ActionIcon className={`h-4 w-4 ${color} flex-shrink-0`} />
                          <span className="font-medium text-sm">{getActionLabel(entry.action, t)}</span>
                          <Badge className={`text-xs ${channelColors[entry.channel] || ""}`}>
                            {getChannelLabel(entry.channel, t)}
                          </Badge>
                          {entry.status && (
                            <Badge variant={getStatusBadgeVariant(entry.status)} className="text-xs">
                              {entry.status}
                            </Badge>
                          )}
                          {entry.phaseName && (
                            <Badge variant="outline" className="text-xs">
                              {((t as any)?.campaignTimeline?.phase || "Phase")} {entry.phaseNumber || ""}: {entry.phaseName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.createdAt), "d.M.yyyy HH:mm", { locale: sk })}
                          </span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Megaphone className="h-3 w-3" />
                        <span>{entry.campaignName || ((t as any)?.campaignTimeline?.defaultCampaign || "Campaign")}</span>
                        {entry.userName && (
                          <>
                            <span>•</span>
                            <span>{entry.userName}</span>
                          </>
                        )}
                        {entry.dispositionCode && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs py-0">
                              <Tag className="h-3 w-3 mr-1" />
                              {entry.dispositionCode}
                            </Badge>
                          </>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2 text-sm">
                          {entry.previousStatus && entry.status && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{(t as any)?.campaignTimeline?.statusChange || "Status change:"}</span>
                              <Badge variant="outline" className="text-xs">{entry.previousStatus}</Badge>
                              <ArrowRight className="h-3 w-3" />
                              <Badge variant={getStatusBadgeVariant(entry.status)} className="text-xs">{entry.status}</Badge>
                            </div>
                          )}
                          {entry.notes && (
                            <div>
                              <span className="text-muted-foreground">{(t as any)?.campaignTimeline?.note || "Note: "}</span>
                              <span>{entry.notes}</span>
                            </div>
                          )}
                          {entry.metadata && typeof entry.metadata === "object" && Object.keys(entry.metadata).length > 0 && (
                            <div className="bg-muted/50 rounded p-2">
                              <span className="text-muted-foreground text-xs font-medium">{(t as any)?.campaignTimeline?.metadata || "Metadata:"}</span>
                              <div className="grid grid-cols-2 gap-1 mt-1">
                                {Object.entries(entry.metadata).map(([key, value]) => (
                                  <div key={key} className="text-xs">
                                    <span className="text-muted-foreground">{key}: </span>
                                    <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTimeline.length > 20 && !showAll && (
              <div className="text-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAll(true)}
                  data-testid="button-show-all-timeline"
                >
                  Zobraziť všetky ({filteredTimeline.length})
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
