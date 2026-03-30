import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Search, FileText, Download, Printer, User, Phone, Mail, MapPin, Calendar,
  FileCheck, CreditCard, AlertTriangle, FlaskConical, Activity, MessageSquare,
  Shield, Baby, Building2, Heart, Clock, CheckCircle2, XCircle, ChevronRight,
  BarChart3, Briefcase, Receipt, Scale, Beaker, History, Target, Loader2
} from "lucide-react";

type Customer = any;
type AuditReport = {
  customer: Customer;
  contracts: any[];
  documentInvoices: any[];
  invoices: any[];
  debtRecords: any[];
  notes: any[];
  potentialCase: any;
  collections: any[];
  labResults: any[];
  activityLogs: any[];
  contactHistory: any[];
  consents: any[];
  emailNotifications: any[];
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("sk-SK"); } catch { return d; }
}
function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("sk-SK"); } catch { return d; }
}
function formatCurrency(amount: number | string | null | undefined, currency?: string) {
  if (amount === null || amount === undefined) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return `${num.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || "EUR"}`;
}

function StatusBadge({ status, variant }: { status: string | null | undefined; variant?: "default" | "success" | "warning" | "danger" | "info" }) {
  if (!status) return <Badge variant="outline" className="text-[10px]">N/A</Badge>;
  const colors: Record<string, string> = {
    success: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300",
    warning: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300",
    danger: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300",
    info: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300",
    default: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300",
  };
  return <Badge variant="outline" className={`text-[10px] font-semibold ${colors[variant || "default"]}`}>{status}</Badge>;
}

function SectionTitle({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4" data-testid={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {count !== undefined && count > 0 && (
        <Badge className="ml-2 text-xs">{count}</Badge>
      )}
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: any; icon?: any }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-dashed border-muted last:border-0">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <span className="text-sm text-muted-foreground min-w-[140px] shrink-0">{label}:</span>
      <span className="text-sm font-medium break-all">{value || "—"}</span>
    </div>
  );
}

function CustomerHistorySection({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [filterType, setFilterType] = useState("all");

  const { data: activityLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "activity-logs"],
    enabled: !!customerId,
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "documents"],
    enabled: !!customerId,
  });

  const { data: notes = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "notes"],
    enabled: !!customerId,
  });

  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "messages"],
    enabled: !!customerId,
  });

  const { data: customerEmails = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "emails"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/emails`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!customerId,
  });

  const { data: callLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "call-logs"],
    queryFn: async () => {
      const res = await fetch(`/api/call-logs?customerId=${customerId}&includeRecordings=true`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!customerId,
  });

  const { data: inboundCallLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/inbound-call-logs/by-customer", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/inbound-call-logs/by-customer/${customerId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!customerId,
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: contactHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "contact-history-audit"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/audit-report`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.contactHistory || [];
    },
    enabled: !!customerId,
  });

  const getUserName = (userId: string) => {
    const user = users.find((u: any) => u.id === userId);
    return user?.fullName || user?.username || "System";
  };

  type TimelineEvent = {
    id: string;
    type: string;
    title: string;
    description: string;
    date: string;
    userName: string;
    icon: any;
    color: string;
    details?: string;
  };

  const events: TimelineEvent[] = [];

  activityLogs.forEach((log: any) => {
    let details: any = {};
    if (log.details) {
      try { details = typeof log.details === "string" ? JSON.parse(log.details) : log.details; } catch { details = {}; }
    }

    let type = "data";
    let title = log.action?.replace(/_/g, " ") || "Activity";
    let description = log.entityName || customerName;
    let icon = <Clock className="h-4 w-4" />;
    let color = "border-blue-400";
    let extraDetails = "";

    switch (log.action) {
      case "create":
        title = "Vytvorenie záznamu";
        description = `Nový ${log.entityType || "záznam"} vytvorený`;
        icon = <CheckCircle2 className="h-4 w-4 text-green-500" />;
        color = "border-green-500";
        type = "data";
        break;
      case "update":
        title = "Aktualizácia údajov";
        icon = <Clock className="h-4 w-4 text-blue-500" />;
        color = "border-blue-500";
        type = "data";
        if (details?.changes && Array.isArray(details.changes)) {
          const fields = details.changes.filter((f: string) => !["updatedAt", "createdAt"].includes(f));
          if (fields.length > 0) description = `Zmenené polia: ${fields.join(", ")}`;
          if (details.changes.includes("status") || details.changes.includes("clientStatus")) {
            title = "Zmena statusu";
            type = "status";
            color = "border-orange-500";
            icon = <Activity className="h-4 w-4 text-orange-500" />;
          }
          if (details.changes.includes("pipelineStageId")) {
            title = "Presun v pipeline";
            type = "pipeline";
            color = "border-cyan-500";
            icon = <ChevronRight className="h-4 w-4 text-cyan-500" />;
          }
        }
        if (details?.oldValues && details?.newValues) {
          const changed = Object.keys(details.newValues).filter(k => details.oldValues[k] !== details.newValues[k] && !["updatedAt","createdAt"].includes(k));
          extraDetails = changed.map(k => `${k}: "${details.oldValues[k] || "—"}" → "${details.newValues[k] || "—"}"`).join("\n");
        }
        break;
      case "pipeline_move":
      case "stage_changed":
        title = "Presun v pipeline";
        type = "pipeline";
        icon = <ChevronRight className="h-4 w-4 text-cyan-500" />;
        color = "border-cyan-500";
        description = `${details?.fromStageName || "—"} → ${details?.toStageName || "—"}`;
        break;
      case "create_note":
      case "note_added":
      case "add_note":
        title = "Pridanie poznámky";
        type = "note";
        icon = <MessageSquare className="h-4 w-4 text-amber-500" />;
        color = "border-amber-500";
        description = details?.content?.substring(0, 150) || details?.note?.substring(0, 150) || "Poznámka";
        break;
      case "email_sent":
        title = "Odoslaný email";
        type = "email";
        icon = <Mail className="h-4 w-4 text-blue-500" />;
        color = "border-blue-400";
        description = details?.subject || details?.to || "Email";
        break;
      case "send_sms":
        title = "Odoslaná SMS";
        type = "call";
        icon = <Phone className="h-4 w-4 text-emerald-500" />;
        color = "border-emerald-500";
        description = `SMS na ${details?.to || details?.phone || "—"}`;
        break;
      case "campaign_joined":
        title = "Pridaný do kampane";
        type = "campaign";
        icon = <Target className="h-4 w-4 text-violet-500" />;
        color = "border-violet-500";
        description = details?.campaignName || "Kampaň";
        break;
      case "campaign_left":
        title = "Odstránený z kampane";
        type = "campaign";
        icon = <Target className="h-4 w-4 text-red-400" />;
        color = "border-red-400";
        description = details?.campaignName || "Kampaň";
        break;
      case "campaign_status_changed":
        title = "Zmena statusu v kampani";
        type = "campaign";
        icon = <Target className="h-4 w-4 text-violet-500" />;
        color = "border-violet-500";
        description = `${details?.campaignName || "Kampaň"}: ${details?.previousStatus || "—"} → ${details?.newStatus || details?.status || "—"}`;
        break;
      case "campaign_note_added":
        title = "Poznámka ku kampani";
        type = "campaign";
        icon = <Target className="h-4 w-4 text-violet-500" />;
        color = "border-violet-500";
        description = details?.campaignName || "Kampaň";
        break;
      case "upload_file":
        title = "Nahraný súbor";
        type = "document";
        icon = <FileCheck className="h-4 w-4 text-purple-500" />;
        color = "border-purple-500";
        description = details?.fileName || "Súbor";
        break;
      case "consent_granted":
        title = "Udelenie súhlasu";
        type = "consent";
        icon = <Shield className="h-4 w-4 text-green-500" />;
        color = "border-green-500";
        description = details?.consentType || "Súhlas";
        break;
      case "consent_revoked":
        title = "Odvolanie súhlasu";
        type = "consent";
        icon = <Shield className="h-4 w-4 text-red-500" />;
        color = "border-red-500";
        description = details?.consentType || "Súhlas";
        break;
      case "add_product":
        title = "Pridanie produktu";
        type = "product";
        icon = <Briefcase className="h-4 w-4 text-indigo-500" />;
        color = "border-indigo-500";
        description = details?.productName || "Produkt";
        break;
      case "remove_product":
        title = "Odobratie produktu";
        type = "product";
        icon = <Briefcase className="h-4 w-4 text-red-500" />;
        color = "border-red-500";
        description = details?.productName || "Produkt";
        break;
      case "marketing_action":
        title = "Webový formulár";
        type = "campaign";
        icon = <Target className="h-4 w-4 text-orange-500" />;
        color = "border-orange-500";
        description = details?.message || details?.formName || "Marketing";
        break;
      default:
        title = log.action?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Aktivita";
        description = log.entityName || customerName;
    }

    events.push({
      id: log.id,
      type,
      title,
      description,
      date: log.createdAt,
      userName: getUserName(log.userId),
      icon,
      color,
      details: extraDetails || undefined,
    });
  });

  documents.forEach((doc: any) => {
    const docType = doc.documentType || doc.type;
    const isContract = docType === "contract";
    const docNumber = doc.contractNumber || doc.invoiceNumber || doc.number || "";
    const amount = doc.totalAmount || doc.amount;
    const currency = doc.domesticCurrency || doc.currency;
    let desc = docNumber;
    if (amount && currency) desc += ` — ${amount} ${currency}`;

    events.push({
      id: `doc-${doc.id}`,
      type: "document",
      title: isContract ? "Zmluva" : "Faktúra",
      description: desc || "Dokument",
      date: doc.issueDate || doc.validFrom || doc.createdAt,
      userName: getUserName(doc.createdBy),
      icon: isContract ? <FileText className="h-4 w-4 text-emerald-500" /> : <Receipt className="h-4 w-4 text-amber-500" />,
      color: isContract ? "border-emerald-500" : "border-amber-500",
    });
  });

  notes.forEach((note: any) => {
    const alreadyInLogs = events.some(e => e.type === "note" && e.id === note.id);
    if (!alreadyInLogs) {
      events.push({
        id: `note-${note.id}`,
        type: "note",
        title: "Poznámka",
        description: note.content?.substring(0, 200) || "—",
        date: note.createdAt,
        userName: getUserName(note.userId),
        icon: <MessageSquare className="h-4 w-4 text-amber-500" />,
        color: "border-amber-500",
      });
    }
  });

  messages.forEach((msg: any) => {
    const isInbound = msg.direction === "inbound";
    const isSms = msg.type === "sms";
    events.push({
      id: `msg-${msg.id}`,
      type: isSms ? "call" : "email",
      title: isSms ? (isInbound ? "Prijatá SMS" : "Odoslaná SMS") : (isInbound ? "Prijatý email" : "Odoslaný email"),
      description: msg.subject || msg.content?.substring(0, 100) || "—",
      date: msg.sentAt || msg.createdAt,
      userName: getUserName(msg.userId),
      icon: isSms
        ? <Phone className="h-4 w-4 text-emerald-500" />
        : (isInbound ? <Mail className="h-4 w-4 text-green-500" /> : <Mail className="h-4 w-4 text-blue-500" />),
      color: isSms ? "border-emerald-500" : (isInbound ? "border-green-500" : "border-blue-400"),
    });
  });

  customerEmails.forEach((email: any) => {
    const isOutbound = email.direction === "outbound";
    events.push({
      id: `email-${email.id}`,
      type: "email",
      title: isOutbound ? "Odoslaný email" : "Prijatý email",
      description: `${email.subject || "(bez predmetu)"}${email.bodyPreview ? ` — ${email.bodyPreview.substring(0, 100)}` : ""}`,
      date: email.receivedAt || email.createdAt,
      userName: email.senderName || email.senderEmail || "—",
      icon: isOutbound ? <Mail className="h-4 w-4 text-blue-500" /> : <Mail className="h-4 w-4 text-green-500" />,
      color: isOutbound ? "border-blue-400" : "border-green-500",
    });
  });

  callLogs.forEach((call: any) => {
    const isOutbound = call.direction === "outbound";
    const duration = call.durationSeconds
      ? `${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, '0')}`
      : "—";
    const statusLabels: Record<string, string> = {
      completed: "Dokončený", answered: "Zodvihnutý", failed: "Neúspešný",
      missed: "Zmeškaný", no_answer: "Bez odpovede", busy: "Obsadené",
      cancelled: "Zrušený", initiated: "Iniciovaný", ringing: "Zvoní",
    };
    let desc = `${call.phoneNumber} — ${statusLabels[call.status] || call.status}`;
    if (call.durationSeconds) desc += ` — Trvanie: ${duration}`;
    if (call.notes) desc += ` — ${call.notes}`;

    events.push({
      id: `call-${call.id}`,
      type: "call",
      title: isOutbound ? "Odchádzajúci hovor" : "Prichádzajúci hovor",
      description: desc,
      date: call.startedAt || call.createdAt,
      userName: getUserName(call.userId),
      icon: isOutbound ? <Phone className="h-4 w-4 text-violet-500" /> : <Phone className="h-4 w-4 text-cyan-500" />,
      color: isOutbound ? "border-violet-500" : "border-cyan-500",
    });
  });

  inboundCallLogs.forEach((log: any) => {
    const statusLabels: Record<string, string> = {
      queued: "Vo fronte", ringing: "Zvoní", answered: "Zodvihnutý",
      completed: "Dokončený", abandoned: "Zmeškaný", timeout: "Timeout",
    };
    const isAbandoned = ["abandoned", "timeout", "overflow"].includes(log.status);
    let desc = `${log.callerNumber} — ${statusLabels[log.status] || log.status}`;
    if (log.queueName) desc += ` | Fronta: ${log.queueName}`;
    if (log.agentName) desc += ` | Agent: ${log.agentName}`;

    events.push({
      id: `inbound-${log.id}`,
      type: "call",
      title: isAbandoned ? "Zmeškaný hovor (Fronta)" : "Prichádzajúci hovor (Fronta)",
      description: desc,
      date: log.enteredQueueAt || log.createdAt,
      userName: log.agentName || "System",
      icon: isAbandoned ? <XCircle className="h-4 w-4 text-red-500" /> : <Phone className="h-4 w-4 text-cyan-500" />,
      color: isAbandoned ? "border-red-500" : "border-cyan-500",
    });
  });

  contactHistory.forEach((ch: any) => {
    events.push({
      id: `contact-${ch.id || Math.random()}`,
      type: ch.contactType === "email" ? "email" : "call",
      title: `Kontakt — ${ch.contactType || "hovor"}`,
      description: `${ch.disposition || ch.result || "Kontakt"}${ch.notes ? ` — ${ch.notes}` : ""}`,
      date: ch.contactedAt || ch.createdAt,
      userName: ch.agentName || getUserName(ch.agentId),
      icon: ch.contactType === "email" ? <Mail className="h-4 w-4 text-indigo-500" /> : <Phone className="h-4 w-4 text-emerald-500" />,
      color: ch.contactType === "email" ? "border-indigo-500" : "border-emerald-500",
    });
  });

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const typeCounts: Record<string, number> = { all: events.length };
  events.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });

  const filterTabs = [
    { id: "all", label: "Všetko", icon: History, color: "bg-slate-100 dark:bg-slate-800" },
    { id: "data", label: "Dáta", icon: Clock, color: "bg-blue-50 dark:bg-blue-900/30" },
    { id: "document", label: "Dokumenty", icon: FileText, color: "bg-emerald-50 dark:bg-emerald-900/30" },
    { id: "note", label: "Poznámky", icon: MessageSquare, color: "bg-amber-50 dark:bg-amber-900/30" },
    { id: "email", label: "Emaily", icon: Mail, color: "bg-blue-50 dark:bg-blue-900/30" },
    { id: "call", label: "Hovory", icon: Phone, color: "bg-cyan-50 dark:bg-cyan-900/30" },
    { id: "status", label: "Status", icon: Activity, color: "bg-orange-50 dark:bg-orange-900/30" },
    { id: "pipeline", label: "Pipeline", icon: ChevronRight, color: "bg-cyan-50 dark:bg-cyan-900/30" },
    { id: "campaign", label: "Misie", icon: Target, color: "bg-violet-50 dark:bg-violet-900/30" },
    { id: "consent", label: "Súhlas", icon: Shield, color: "bg-green-50 dark:bg-green-900/30" },
    { id: "product", label: "Produkty", icon: Briefcase, color: "bg-indigo-50 dark:bg-indigo-900/30" },
  ].filter(t => (typeCounts[t.id] || 0) > 0 || t.id === "all");

  const filtered = filterType === "all" ? events : events.filter(e => e.type === filterType);

  const groupByMonth = (items: TimelineEvent[]) => {
    const groups: Record<string, TimelineEvent[]> = {};
    items.forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("sk-SK", { month: "long", year: "numeric" }).toUpperCase();
      if (!groups[`${key}|${label}`]) groups[`${key}|${label}`] = [];
      groups[`${key}|${label}`].push(e);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const grouped = groupByMonth(filtered);

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionTitle icon={History} title="Kompletná História Zákazníka" count={events.length} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {filterTabs.map(tab => {
            const count = typeCounts[tab.id] || 0;
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all min-w-[64px] ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                    : `${tab.color} text-foreground hover:shadow-sm`
                }`}
                data-testid={`tab-audit-${tab.id}`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="text-lg font-bold leading-none">{count}</span>
                <span className="text-[10px] leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="max-h-[800px] overflow-y-auto space-y-6 pr-1">
          {grouped.map(([key, items]) => {
            const label = key.split("|")[1];
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground tracking-wider">{label}</span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                  <div className="flex-1 border-t border-dashed" />
                </div>
                <div className="relative ml-3 pl-6 border-l-2 border-muted space-y-0">
                  {items.map((event, i) => (
                    <div key={event.id || i} className="relative pb-4 last:pb-0" data-testid={`audit-event-${i}`}>
                      <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-background border-2 ${event.color} flex items-center justify-center`}>
                        <div className={`w-2 h-2 rounded-full ${event.color.replace("border-", "bg-")}`} />
                      </div>
                      <div className="bg-card border rounded-lg p-3 ml-1 hover:shadow-sm transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-0.5">{event.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{event.title}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5 break-words leading-relaxed">{event.description}</p>
                            {event.details && (
                              <pre className="text-xs text-muted-foreground mt-1.5 bg-muted/30 rounded p-2 whitespace-pre-wrap font-mono">{event.details}</pre>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[11px] text-muted-foreground">{formatDateTime(event.date)}</div>
                            <div className="text-[10px] text-muted-foreground/70 mt-0.5">{event.userName}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Žiadne záznamy v tejto kategórii</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerAuditReport({ customerId }: { customerId: string }) {
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: report, isLoading } = useQuery<AuditReport>({
    queryKey: ["/api/customers", customerId, "audit-report"],
    enabled: !!customerId,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!report) return;
    const c = report.customer;
    let csv = "Section,Field,Value\n";
    csv += `Customer,Name,"${c.titleBefore || ''} ${c.firstName} ${c.lastName} ${c.titleAfter || ''}"\n`;
    csv += `Customer,Email,"${c.email || ''}"\n`;
    csv += `Customer,Phone,"${c.phone || ''}"\n`;
    csv += `Customer,Mobile,"${c.mobile || ''}"\n`;
    csv += `Customer,Status,"${c.clientStatus || ''}"\n`;
    csv += `Customer,National ID,"${c.nationalId || ''}"\n`;
    csv += `Customer,Date of Birth,"${c.dateOfBirth || ''}"\n`;
    csv += `Customer,City,"${c.city || ''}"\n`;
    csv += `Customer,Country,"${c.country || ''}"\n`;
    csv += `Customer,Registration Date,"${c.registrationDate || ''}"\n`;
    csv += `\nContracts\nContract Number,Status,Product Type,Company,Expected Collection,Created\n`;
    report.contracts.forEach(ct => {
      csv += `"${ct.contractNumber || ''}","${ct.contractStatus || ''}","${ct.productType || ''}","${ct.companyName || ''}","${ct.expectedCollectionDate || ''}","${formatDate(ct.createdAt)}"\n`;
    });
    csv += `\nInvoices\nInvoice Number,Amount,Paid,Status,Due Date,Issue Date\n`;
    report.invoices.forEach(inv => {
      csv += `"${inv.invoiceNumber || ''}","${inv.totalAmount || ''}","${inv.paidAmount || ''}","${inv.status || ''}","${formatDate(inv.dueDate)}","${formatDate(inv.issueDate)}"\n`;
    });
    csv += `\nDebt Records\nInvoice,Amount,Debt Amount,Status,Phase\n`;
    report.debtRecords.forEach(d => {
      csv += `"${d.invoiceNumber || ''}","${d.amount || ''}","${d.debtAmount || ''}","${d.status || ''}","${d.phase || ''}"\n`;
    });
    csv += `\nCollections\nCBU Number,Status,Collection Date,Hospital\n`;
    report.collections.forEach(col => {
      csv += `"${col.cbuNumber || ''}","${col.state || ''}","${formatDate(col.collectionDate)}","${col.hospitalName || ''}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `customer-audit-${c.firstName}-${c.lastName}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!report) return <div className="text-center py-12 text-muted-foreground">Customer not found</div>;

  const c = report.customer;
  const totalInvoiceAmount = report.invoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.totalAmount) || 0), 0);
  const totalPaid = report.invoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.paidAmount) || 0), 0);
  const totalDebt = report.debtRecords.reduce((sum: number, d: any) => sum + (parseFloat(d.debtAmount) || 0), 0);

  return (
    <div ref={reportRef} className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-report-title">
            Customer Audit Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Generated: {new Date().toLocaleString("sk-SK")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-1.5" />
            Print / PDF
          </Button>
        </div>
      </div>

      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent print:border print:bg-white">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="p-4 rounded-2xl bg-primary/10 shrink-0 print:bg-gray-100">
              <User className="h-12 w-12 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold mb-1" data-testid="text-customer-name">
                {c.titleBefore} {c.firstName} {c.lastName} {c.titleAfter}
              </h2>
              <div className="flex flex-wrap gap-2 mb-3">
                <StatusBadge status={c.clientStatus} variant={c.clientStatus === "acquired" ? "success" : c.clientStatus === "terminated" ? "danger" : "info"} />
                <StatusBadge status={c.status} variant={c.status === "active" ? "success" : "warning"} />
                {c.leadStatus && <StatusBadge status={`Lead: ${c.leadStatus}`} variant={c.leadStatus === "hot" ? "danger" : c.leadStatus === "warm" ? "warning" : "info"} />}
                {c.leadScore && <Badge variant="outline" className="text-[10px]">Score: {c.leadScore}</Badge>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-1">
                <InfoRow label="Email" value={c.email} icon={Mail} />
                <InfoRow label="Phone" value={c.phone} icon={Phone} />
                <InfoRow label="Mobile" value={c.mobile} icon={Phone} />
                <InfoRow label="Birth Date" value={formatDate(c.dateOfBirth)} icon={Calendar} />
                <InfoRow label="National ID" value={c.nationalId} icon={Shield} />
                <InfoRow label="ID Card" value={c.idCardNumber} icon={FileCheck} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 print:grid-cols-5">
        {[
          { label: "Contracts", count: report.contracts.length, icon: FileText, color: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
          { label: "Invoices", count: report.invoices.length, icon: Receipt, color: "text-green-600 bg-green-50 dark:bg-green-950" },
          { label: "Collections", count: report.collections.length, icon: Beaker, color: "text-purple-600 bg-purple-50 dark:bg-purple-950" },
          { label: "Debt Records", count: report.debtRecords.length, icon: AlertTriangle, color: report.debtRecords.length > 0 ? "text-red-600 bg-red-50 dark:bg-red-950" : "text-gray-600 bg-gray-50 dark:bg-gray-950" },
          { label: "Activities", count: report.activityLogs.length + report.contactHistory.length, icon: Activity, color: "text-amber-600 bg-amber-50 dark:bg-amber-950" },
        ].map((stat) => (
          <Card key={stat.label} className={`${stat.color} border-0`}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className="h-8 w-8 opacity-60" />
              <div>
                <div className="text-2xl font-black">{stat.count}</div>
                <div className="text-xs font-medium opacity-80">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:grid-cols-3">
        <Card className="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">Total Invoiced</div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(totalInvoiceAmount)}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Total Paid</div>
            <div className="text-xl font-black text-blue-700 dark:text-blue-300">{formatCurrency(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card className={`${totalDebt > 0 ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800'}`}>
          <CardContent className="p-4">
            <div className={`text-xs font-medium mb-1 ${totalDebt > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>Total Debt</div>
            <div className={`text-xl font-black ${totalDebt > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>{formatCurrency(totalDebt)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle icon={MapPin} title="Address & Personal Details" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
            <InfoRow label="Address" value={c.address} icon={MapPin} />
            <InfoRow label="City" value={c.city} />
            <InfoRow label="Postal Code" value={c.postalCode} />
            <InfoRow label="Region" value={c.region} />
            <InfoRow label="Country" value={c.country} />
            <InfoRow label="Bank Account" value={c.bankAccount} icon={CreditCard} />
            {c.useCorrespondenceAddress && (
              <>
                <Separator className="col-span-full my-2" />
                <InfoRow label="Corr. Address" value={`${c.corrAddress || ''}, ${c.corrCity || ''} ${c.corrPostalCode || ''}`} icon={MapPin} />
                <InfoRow label="Corr. Country" value={c.corrCountry} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {report.potentialCase && (
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={Baby} title="Potential Case / Pregnancy" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <InfoRow label="Case Status" value={<StatusBadge status={report.potentialCase.caseStatus} variant={report.potentialCase.caseStatus === "realized" ? "success" : report.potentialCase.caseStatus === "cancelled" ? "danger" : "info"} />} />
              <InfoRow label="Product Type" value={report.potentialCase.productType} />
              <InfoRow label="Payment Type" value={report.potentialCase.paymentType} />
              <InfoRow label="Expected Date" value={report.potentialCase.expectedDateYear ? `${report.potentialCase.expectedDateDay || '?'}.${report.potentialCase.expectedDateMonth || '?'}.${report.potentialCase.expectedDateYear}` : "—"} icon={Calendar} />
              <InfoRow label="Multiple Pregnancy" value={report.potentialCase.isMultiplePregnancy ? "Yes" : "No"} />
              <InfoRow label="Sales Channel" value={report.potentialCase.salesChannel} />
              <InfoRow label="Info Source" value={report.potentialCase.infoSource} />
              {report.potentialCase.notes && <InfoRow label="Notes" value={report.potentialCase.notes} icon={MessageSquare} />}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle icon={FileText} title="Contracts" count={report.contracts.length} />
        </CardHeader>
        <CardContent>
          {report.contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No contracts found</p>
          ) : (
            <div className="space-y-3">
              {report.contracts.map((ct: any, i: number) => (
                <div key={ct.id || i} className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors" data-testid={`contract-row-${i}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="font-bold text-sm">{ct.contractNumber || `Contract #${i + 1}`}</span>
                    </div>
                    <StatusBadge status={ct.contractStatus} variant={ct.contractStatus === "active" || ct.contractStatus === "signed" ? "success" : ct.contractStatus === "cancelled" ? "danger" : "default"} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Product:</span> <span className="font-medium">{ct.productType || "—"}</span></div>
                    <div><span className="text-muted-foreground">Company:</span> <span className="font-medium">{ct.companyName || "—"}</span></div>
                    <div><span className="text-muted-foreground">Template:</span> <span className="font-medium">{ct.contractTemplate || "—"}</span></div>
                    <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{formatDate(ct.createdAt)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle icon={Receipt} title="Invoices" count={report.invoices.length} />
        </CardHeader>
        <CardContent>
          {report.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No invoices found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 font-semibold text-xs text-muted-foreground">Invoice #</th>
                    <th className="py-2 px-3 font-semibold text-xs text-muted-foreground">Amount</th>
                    <th className="py-2 px-3 font-semibold text-xs text-muted-foreground">Paid</th>
                    <th className="py-2 px-3 font-semibold text-xs text-muted-foreground">Status</th>
                    <th className="py-2 px-3 font-semibold text-xs text-muted-foreground">Issue Date</th>
                    <th className="py-2 px-3 font-semibold text-xs text-muted-foreground">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {report.invoices.map((inv: any, i: number) => (
                    <tr key={inv.id || i} className="border-b last:border-0 hover:bg-muted/30" data-testid={`invoice-row-${i}`}>
                      <td className="py-2 px-3 font-medium">{inv.invoiceNumber || inv.variableSymbol || `#${i + 1}`}</td>
                      <td className="py-2 px-3">{formatCurrency(inv.totalAmount || inv.amount, inv.currency)}</td>
                      <td className="py-2 px-3">{formatCurrency(inv.paidAmount, inv.currency)}</td>
                      <td className="py-2 px-3">
                        <StatusBadge status={inv.status || inv.invoiceStatus} variant={inv.fullyPaid || inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "warning"} />
                      </td>
                      <td className="py-2 px-3 text-xs">{formatDate(inv.issueDate)}</td>
                      <td className="py-2 px-3 text-xs">{formatDate(inv.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {report.debtRecords.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-3">
            <SectionTitle icon={AlertTriangle} title="Debt Collection" count={report.debtRecords.length} />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.debtRecords.map((d: any, i: number) => (
                <div key={d.id || i} className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30" data-testid={`debt-row-${i}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="font-bold text-sm">{d.invoiceNumber || d.contractNumber || `Debt #${i + 1}`}</span>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge status={d.status} variant="danger" />
                      <StatusBadge status={d.phase} variant="warning" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Amount:</span> <span className="font-bold text-red-600">{formatCurrency(d.debtAmount, d.currency)}</span></div>
                    <div><span className="text-muted-foreground">Original:</span> <span className="font-medium">{formatCurrency(d.amount, d.currency)}</span></div>
                    <div><span className="text-muted-foreground">Oldest Due:</span> <span className="font-medium">{formatDate(d.oldestDueDate)}</span></div>
                    <div><span className="text-muted-foreground">Last Action:</span> <span className="font-medium">{formatDate(d.lastActionDate)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle icon={Beaker} title="Collections & Lab Results" count={report.collections.length} />
        </CardHeader>
        <CardContent>
          {report.collections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No collections found</p>
          ) : (
            <div className="space-y-4">
              {report.collections.map((col: any, i: number) => {
                const lr = report.labResults.find((l: any) => l.collection?.id === col.id);
                return (
                  <div key={col.id || i} className="p-4 rounded-lg border bg-card" data-testid={`collection-row-${i}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Beaker className="h-5 w-5 text-purple-500" />
                        <span className="font-bold">{col.cbuNumber || `Collection #${i + 1}`}</span>
                      </div>
                      <StatusBadge status={col.state} variant={col.state === "stored" || col.state === "processed" ? "success" : col.state === "rejected" ? "danger" : "info"} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                      <div><span className="text-muted-foreground">Collection Date:</span> <span className="font-medium">{formatDate(col.collectionDate)}</span></div>
                      <div><span className="text-muted-foreground">Hospital:</span> <span className="font-medium">{col.hospitalName || "—"}</span></div>
                      <div><span className="text-muted-foreground">Product:</span> <span className="font-medium">{col.productType || "—"}</span></div>
                      <div><span className="text-muted-foreground">Storage:</span> <span className="font-medium">{col.storageLocation || "—"}</span></div>
                    </div>
                    {lr && lr.results && lr.results.length > 0 && (
                      <div className="mt-2 p-3 rounded bg-muted/50">
                        <div className="flex items-center gap-1.5 mb-2">
                          <FlaskConical className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs font-bold">Lab Results</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          {lr.results.map((r: any, ri: number) => (
                            <div key={ri}>
                              <span className="text-muted-foreground">{r.testName || r.parameter || `Test ${ri + 1}`}:</span>{" "}
                              <span className="font-bold">{r.result || r.value || "—"}</span>
                              {r.unit && <span className="text-muted-foreground ml-0.5">{r.unit}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle icon={MessageSquare} title="Notes" count={report.notes.length} />
        </CardHeader>
        <CardContent>
          {report.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notes found</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {report.notes.map((note: any, i: number) => (
                <div key={note.id || i} className="p-3 rounded-lg border bg-amber-50/30 dark:bg-amber-950/20" data-testid={`note-row-${i}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</span>
                    {note.isPrivate && <Badge variant="outline" className="text-[9px]">Private</Badge>}
                  </div>
                  <p className="text-sm">{note.note}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {report.consents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={Shield} title="Consents (GDPR)" count={report.consents.length} />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {report.consents.map((consent: any, i: number) => (
                <div key={consent.id || i} className="flex items-center gap-2 p-2 rounded border text-sm">
                  {consent.granted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span className="font-medium">{consent.consentType || consent.type || `Consent #${i + 1}`}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(consent.grantedAt || consent.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CustomerHistorySection customerId={customerId} customerName={report.customer?.fullName || report.customer?.firstName || "—"} />
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [activeReport, setActiveReport] = useState("customer-audit");
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");

  const { data: searchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", { search: debouncedSearch, page: 1, limit: 15 }],
    enabled: debouncedSearch.length >= 2,
  });
  const customers = Array.isArray(searchResults) ? searchResults : (searchResults as any)?.data || [];

  const handleSearchChange = (val: string) => {
    setCustomerSearch(val);
    setSelectedCustomerId(null);
    setTimeout(() => setDebouncedSearch(val), 300);
  };

  const selectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id);
    setSelectedCustomerName(`${cust.firstName} ${cust.lastName}`);
    setCustomerSearch(`${cust.firstName} ${cust.lastName}`);
    setDebouncedSearch("");
  };

  const reportTypes = [
    { id: "customer-audit", label: "Customer Audit", icon: User, description: "Complete customer 360° view with all records" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-7 w-7 text-primary" />
            Management Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive analytics and audit reports across INDEXUS
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Report Types</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              {reportTypes.map((rt) => (
                <button
                  key={rt.id}
                  onClick={() => setActiveReport(rt.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 ${
                    activeReport === rt.id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "hover:bg-muted"
                  }`}
                  data-testid={`button-report-${rt.id}`}
                >
                  <rt.icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-bold">{rt.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{rt.description}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 ml-auto mt-0.5 opacity-40" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-3">
          {activeReport === "customer-audit" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search customer by name, email, phone..."
                      value={customerSearch}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10"
                      data-testid="input-customer-search"
                    />
                    {debouncedSearch.length >= 2 && customers.length > 0 && !selectedCustomerId && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto">
                        {customers.map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex items-center gap-3 border-b last:border-0"
                            data-testid={`customer-result-${c.id}`}
                          >
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{c.firstName} {c.lastName}</div>
                              <div className="text-xs text-muted-foreground">{c.email || c.phone || c.nationalId || ""}</div>
                            </div>
                            <Badge variant="outline" className="text-[9px] shrink-0">{c.clientStatus || c.status || "—"}</Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedCustomerId && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge className="text-sm py-1 px-3">
                        <User className="h-3.5 w-3.5 mr-1.5" />
                        {selectedCustomerName}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedCustomerId(null); setCustomerSearch(""); setSelectedCustomerName(""); }}
                        data-testid="button-clear-customer"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedCustomerId ? (
                <CustomerAuditReport customerId={selectedCustomerId} />
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-16 text-center">
                    <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground">Select a Customer</h3>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Search and select a customer above to generate the complete audit report
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          nav, header, aside, .print\\:hidden, [data-testid="button-export-csv"], [data-testid="button-print"], [data-testid="input-customer-search"] {
            display: none !important;
          }
          body { background: white !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:border { border: 1px solid #e5e7eb !important; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
