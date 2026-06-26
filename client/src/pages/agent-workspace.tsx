import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/contexts/permissions-context";
import { SopPanel } from "@/components/agent/SopPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { NexusPulseView } from "@/components/nexus-pulse-view";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mail,
  MessageSquare,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Coffee,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Send,
  Star,
  Calendar,
  FileText,
  FileSignature,
  History,
  User,
  Building,
  Building2,
  Stethoscope,
  Handshake,
  MapPin,
  AlertCircle,
  SkipForward,
  ThumbsUp,
  ThumbsDown,
  CalendarPlus,
  StickyNote,
  Headphones,
  Loader2,
  Hash,
  Megaphone,
  ArrowRight,
  ArrowLeft,
  CircleDot,
  Info,
  Zap,
  Ban,
  Heart,
  Bell,
  Flag,
  Target,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Home,
  Globe,
  Briefcase,
  Gift,
  Volume2,
  VolumeX,
  Paperclip,
  X,
  File as FileIcon,
  Maximize2,
  Minimize2,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ListTodo,
  ListChecks,
  Pencil,
  UserCircle,
  Mic,
  MicOff,
  LogOut,
  Grid3X3,
  CalendarClock,
  PhoneForwarded,
  PhoneIncoming,
  PhoneMissed,
  MailPlus,
  MessageSquarePlus,
  RotateCcw,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Inbox,
  Reply,
  Forward,
  Search,
  HelpCircle,
  BookOpen,
  ChevronUp,
  Download,
  ChevronsUpDown,
  Check,
  CheckSquare,
  Navigation,
  SlidersHorizontal,
  RotateCw,
  CheckCircle2,
  Circle,
  GripVertical,
  Shield,
  ClipboardCheck,
  DollarSign,
  TrendingUp,
  MessageCircle,
  CalendarCheck,
  Archive,
  Package,
  Tag,
  Layers,
  type LucideIcon,
  Code2,
  CheckCheck,
  ClipboardList,
  Save,
} from "lucide-react";
import type { CSSProperties } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getInboundRingtonePreset } from "@/lib/inbound-ringtones";
import { useToast } from "@/hooks/use-toast";
import { useSip } from "@/contexts/sip-context";
import { useCall } from "@/contexts/call-context";
import { format, addBusinessDays, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, isWithinInterval, isBefore } from "date-fns";
import { sk } from "date-fns/locale";
import { useAgentSession } from "@/contexts/agent-session-context";
import { CustomerDetailsContent } from "@/pages/customers";
import { StatusBadge } from "@/components/status-badge";
import { CallRecordingPlayer } from "@/components/call-recording-player";
import { CustomerForm, type CustomerFormData } from "@/components/customer-form";
import { HospitalFormWizard } from "@/components/hospital-form-wizard";
import { ClinicFormSheet } from "@/components/clinic-form-wizard";
import { CollaboratorFormWizard } from "@/components/collaborator-form-wizard";
import { InboundCallPopup, InboundQueueStatus } from "@/components/agent/InboundCallPopup";
import { VoicemailNotifications } from "@/components/agent/VoicemailNotifications";
import type { Campaign, Customer, CampaignContact, CampaignDisposition, AgentBreakType, Hospital, Clinic, Collaborator } from "@shared/schema";
import { DISPOSITION_NAME_TRANSLATIONS } from "@shared/schema";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { getCountryFlag } from "@/lib/countries";
import { COUNTRY_TO_LOCALE } from "@/i18n/translations";
import { BackOfficePanel } from "@/components/back-office-panel";
import { BackOfficeQuestionsInbox } from "@/components/back-office-questions-inbox";
import { MobileAgentWorkspace } from "@/components/mobile-agent-workspace";
import { useIsMobile } from "@/hooks/use-mobile";

// Inline i18n for status-list manual action buttons (mission status list).
// Kept local (like the builder's sl() helper) to avoid editing 7 locale blocks in translations.ts.
const SL_ACTION_T: Record<string, Record<string, string>> = {
  runEmail:      { sk: "Poslať e-mail", en: "Send email", cs: "Odeslat e-mail", hu: "E-mail küldése", ro: "Trimite email", it: "Invia email", de: "E-Mail senden" },
  runStatus:     { sk: "Nastaviť status", en: "Set status", cs: "Nastavit stav", hu: "Státusz beállítása", ro: "Setează status", it: "Imposta stato", de: "Status setzen" },
  runCallback:   { sk: "Naplánovať callback", en: "Schedule callback", cs: "Naplánovat callback", hu: "Visszahívás ütemezése", ro: "Programează callback", it: "Pianifica richiamo", de: "Rückruf planen" },
  cbConfirm:     { sk: "Naplánovať", en: "Schedule", cs: "Naplánovat", hu: "Ütemezés", ro: "Programează", it: "Pianifica", de: "Planen" },
  cbNoteLabel:   { sk: "Poznámka k preplánovanému hovoru", en: "Callback note", cs: "Poznámka k přeplánování", hu: "Visszahívás megjegyzése", ro: "Notă callback", it: "Nota richiamo", de: "Rückruf-Notiz" },
  cbNotePh:      { sk: "Dôvod preplánov., čo povedal zákazník...", en: "Reason, what customer said...", cs: "Důvod přeplánování...", hu: "Visszahívás oka...", ro: "Motiv reprogramare...", it: "Motivo ripianificazione...", de: "Grund für Umplanung..." },
  forEveryone:   { sk: "pre všetkých agentov", en: "for all agents", cs: "pro všechny agenty", hu: "minden ügynöknek", ro: "pentru toți agenții", it: "per tutti gli agenti", de: "für alle Agenten" },
  emailSent:     { sk: "E-mail odoslaný", en: "Email sent", cs: "E-mail odeslán", hu: "E-mail elküldve", ro: "Email trimis", it: "Email inviata", de: "E-Mail gesendet" },
  emailFailed:   { sk: "E-mail sa nepodarilo odoslať", en: "Email could not be sent", cs: "E-mail se nepodařilo odeslat", hu: "Az e-mailt nem sikerült elküldeni", ro: "E-mailul nu a putut fi trimis", it: "Impossibile inviare l'email", de: "E-Mail konnte nicht gesendet werden" },
  statusSet:     { sk: "Status nastavený", en: "Status set", cs: "Stav nastaven", hu: "Státusz beállítva", ro: "Status setat", it: "Stato impostato", de: "Status gesetzt" },
  callbackSet:   { sk: "Callback naplánovaný", en: "Callback scheduled", cs: "Callback naplánován", hu: "Visszahívás ütemezve", ro: "Callback programat", it: "Richiamo pianificato", de: "Rückruf geplant" },
  actionFailed:  { sk: "Akcia zlyhala", en: "Action failed", cs: "Akce selhala", hu: "A művelet sikertelen", ro: "Acțiunea a eșuat", it: "Azione fallita", de: "Aktion fehlgeschlagen" },
  actionsTitle:  { sk: "Akcie", en: "Actions", cs: "Akce", hu: "Műveletek", ro: "Acțiuni", it: "Azioni", de: "Aktionen" },
};
const slt = (key: string, locale: string): string => SL_ACTION_T[key]?.[locale] ?? SL_ACTION_T[key]?.en ?? key;

const SLU: Record<string, Record<string, string>> = {
  statusListTitle: { sk: "Status list kampane", en: "Campaign Status List", cs: "Status list kampaně", hu: "Kampány állapotlista", ro: "Status list campanie", it: "Lista stato campagna", de: "Kampagnen-Statusliste" },
  options: { sk: "Možnosti", en: "Options", cs: "Možnosti", hu: "Lehetőségek", ro: "Opțiuni", it: "Opzioni", de: "Optionen" },
  notLinked: { sk: "Tento kontakt nie je prepojený s touto kampaňou. Uloženie stavu nie je k dispozícii.", en: "This contact is not linked to this campaign. Status saving is not available.", cs: "Tento kontakt není spojen s touto kampaní. Uložení stavu není k dispozici.", hu: "Ez a kapcsolat nincs összekapcsolva ezzel a kampánnyal. Az állapot mentése nem elérhető.", ro: "Acest contact nu este legat de această campanie. Salvarea nu e disponibilă.", it: "Questo contatto non è collegato a questa campagna. Il salvataggio non è disponibile.", de: "Dieser Kontakt ist nicht mit dieser Kampagne verknüpft. Status-Speichern nicht verfügbar." },
  requiredMissing: { sk: "Povinné nevyplnené:", en: "Required missing:", cs: "Povinné nevyplněné:", hu: "Kötelező hiányzó:", ro: "Obligatoriu lipsă:", it: "Obbligatorio mancante:", de: "Pflichtfeld fehlt:" },
  stepsAutoSaved: { sk: "krokov uložených automaticky", en: "steps saved automatically", cs: "kroků uloženo automaticky", hu: "lépés automatikusan mentve", ro: "pași salvați automat", it: "passi salvati automaticamente", de: "Schritte automatisch gespeichert" },
  clickToSave: { sk: "Kliknutím na krok ho okamžite uložíte", en: "Click a step to save it immediately", cs: "Kliknutím na krok ho okamžitě uložíte", hu: "Kattintson egy lépésre az azonnali mentéshez", ro: "Faceți clic pe un pas pentru a-l salva imediat", it: "Fai clic su un passo per salvarlo immediatamente", de: "Klicken Sie auf einen Schritt, um ihn sofort zu speichern" },
  notConfigured: { sk: "Status list nie je nakonfigurovaný", en: "Status list is not configured", cs: "Status list není nakonfigurován", hu: "Az állapotlista nincs konfigurálva", ro: "Lista de stare nu este configurată", it: "Lista stato non configurata", de: "Statusliste nicht konfiguriert" },
  notConfiguredHint: { sk: "Nakonfigurujte ho v Nastaveniach kampane", en: "Configure it in Campaign Settings", cs: "Nakonfigurujte ho v Nastavení kampaně", hu: "Konfigurálja a kampánybeállításokban", ro: "Configurați-o în Setările campaniei", it: "Configuralo nelle Impostazioni della campagna", de: "In den Kampagneneinstellungen konfigurieren" },
};
const slu = (key: string, locale: string): string => SLU[key]?.[locale] ?? SLU[key]?.en ?? key;

// Prefill value for the reschedule picker: N business days out at the rule's
// configured time-of-day (callbackTime "HH:MM", default 09:00). Format matches
// DateTimePicker's "YYYY-MM-DDTHH:MM".
function slPrefillDt(automation: any): string {
  const offset = Math.max(1, automation?.callbackOffsetDays ?? 1);
  const d = addBusinessDays(new Date(), offset);
  let hh = 9, mm = 0;
  const t = automation?.callbackTime;
  if (typeof t === "string" && /^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":").map(Number);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) { hh = h; mm = m; }
  }
  d.setHours(hh, mm, 0, 0);
  const yyyy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mo}-${dd}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Per-item manual action buttons rendered on the agent's mission status list.
// Only appear for items that have a configured send_email_group / set_contact_status / set_callback automation.
function SlActionButtons({ automations, onRun, running, locale, dispositions }: {
  automations: any[];
  onRun: (automation: any, opts?: { callbackDate?: string; callbackNote?: string }) => void;
  running: Set<string>;
  locale: string;
  dispositions: any[];
}) {
  const actionable = (automations || []).filter((a: any) =>
    a.actionType === "send_email_group" || a.actionType === "set_contact_status" || a.actionType === "set_callback"
  );
  if (actionable.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {actionable.map((a: any) => {
        const isRunning = running.has(String(a.id));
        if (a.actionType === "send_email_group") {
          return (
            <Button key={a.id} type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1"
              disabled={isRunning} onClick={() => onRun(a)} data-testid={`btn-sl-email-${a.id}`}>
              {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3 text-green-600" />}
              {slt("runEmail", locale)}
            </Button>
          );
        }
        if (a.actionType === "set_contact_status") {
          const disp = (dispositions || []).find((d: any) => String(d.id) === String(a.dispositionId));
          const isCallback = !!disp && ["callback", "schedule_email", "schedule_sms"].includes(disp.actionType);
          return <SlStatusButton key={a.id} automation={a} isRunning={isRunning} onRun={onRun} locale={locale} isCallback={isCallback} />;
        }
        return <SlCallbackButton key={a.id} automation={a} isRunning={isRunning} onRun={onRun} locale={locale} />;
      })}
    </div>
  );
}

// "Set status" button. For a plain disposition it just runs the action; for a
// callback-type disposition it opens a reschedule picker (prefilled from the rule's
// term) so the agent can override the callback time before scheduling.
function SlStatusButton({ automation, isRunning, onRun, locale, isCallback, label }: {
  automation: any; isRunning: boolean; onRun: (automation: any, opts?: { callbackDate?: string; callbackNote?: string }) => void; locale: string; isCallback: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dt, setDt] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) { setDt(slPrefillDt(automation)); setNote(""); }
  }, [open, automation.callbackOffsetDays, automation.callbackTime]);

  if (!isCallback) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1"
        disabled={isRunning} onClick={() => onRun(automation)} data-testid={`btn-sl-status-${automation.id}`}>
        {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Tag className="h-3 w-3 text-purple-600" />}
        {label ?? slt("runStatus", locale)}
      </Button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1"
          disabled={isRunning} data-testid={`btn-sl-status-${automation.id}`}>
          {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Tag className="h-3 w-3 text-purple-600" />}
          {label ?? slt("runStatus", locale)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 overflow-hidden" align="start">
        <div className="bg-purple-50 dark:bg-purple-900/30 px-3 py-2 flex items-center gap-2 border-b border-purple-200 dark:border-purple-700">
          <Tag className="h-3.5 w-3.5 text-purple-600" />
          <span className="text-xs font-semibold text-purple-800 dark:text-purple-200">{slt("runStatus", locale)}</span>
          <span className="ml-auto text-[9px] text-purple-500 font-medium">{slt("forEveryone", locale)}</span>
        </div>
        <div className="p-3 space-y-2.5">
          <DateTimePicker value={dt} onChange={(v) => setDt(v)} includeTime data-testid={`input-sl-status-callback-${automation.id}`} />
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">{slt("cbNoteLabel", locale)}</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={slt("cbNotePh", locale)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid={`input-sl-status-note-${automation.id}`}
            />
          </div>
          <Button size="sm" className="w-full h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white" disabled={!dt || isRunning}
            onClick={() => { onRun(automation, { callbackDate: dt, callbackNote: note || undefined }); setNote(""); setOpen(false); }}
            data-testid={`btn-sl-status-confirm-${automation.id}`}>
            {slt("cbConfirm", locale)}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SlCallbackButton({ automation, isRunning, onRun, locale, label }: {
  automation: any; isRunning: boolean; onRun: (automation: any, opts?: { callbackDate?: string; callbackNote?: string }) => void; locale: string; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dt, setDt] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) { setDt(slPrefillDt(automation)); setNote(""); }
  }, [open, automation.callbackOffsetDays, automation.callbackTime]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1"
          disabled={isRunning} data-testid={`btn-sl-callback-${automation.id}`}>
          {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3 text-cyan-600" />}
          {label ?? slt("runCallback", locale)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 overflow-hidden" align="start">
        <div className="bg-cyan-50 dark:bg-cyan-900/30 px-3 py-2 flex items-center gap-2 border-b border-cyan-200 dark:border-cyan-700">
          <Phone className="h-3.5 w-3.5 text-cyan-600" />
          <span className="text-xs font-semibold text-cyan-800 dark:text-cyan-200">{slt("runCallback", locale)}</span>
          <span className="ml-auto text-[9px] text-cyan-500 font-medium">{slt("forEveryone", locale)}</span>
        </div>
        <div className="p-3 space-y-2.5">
          <DateTimePicker value={dt} onChange={(v) => setDt(v)} includeTime data-testid={`input-sl-callback-${automation.id}`} />
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">{slt("cbNoteLabel", locale)}</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={slt("cbNotePh", locale)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid={`input-sl-callback-note-${automation.id}`}
            />
          </div>
          <Button size="sm" className="w-full h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white" disabled={!dt || isRunning}
            onClick={() => { onRun(automation, { callbackDate: dt, callbackNote: note || undefined }); setNote(""); setOpen(false); }}
            data-testid={`btn-sl-callback-confirm-${automation.id}`}>
            {slt("cbConfirm", locale)}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type AgentStatus = "available" | "busy" | "break" | "wrap_up" | "offline";

type ChannelType = "phone" | "email" | "sms" | "mixed";

interface PhoneMatch {
  entityType: "customer" | "hospital" | "clinic" | "collaborator";
  id: string;
  name: string;
  phone: string;
  subtype?: string;
}

interface EnrichedCampaignContact extends CampaignContact {
  customer: Customer | null;
  hospital?: Hospital | null;
  clinic?: Clinic | null;
  collaborator?: Collaborator | null;
}

interface TaskItem {
  id: string;
  contact: Customer;
  campaignId: string;
  campaignName: string;
  campaignContactId: string | null;
  channel: ChannelType;
  startedAt: Date;
  status: "active" | "waiting" | "wrap_up";
  direction?: "inbound" | "outbound";
  contactType?: string;
  clinicData?: any;
  hospitalData?: any;
  collaboratorData?: any;
}

interface ContactHistory {
  id: string;
  type: "call" | "email" | "sms" | "disposition";
  direction?: "inbound" | "outbound";
  date: string;
  duration?: number;
  status?: string;
  statusCode?: string;
  notes?: string;
  agentName?: string;
  agentId?: string;
  content?: string;
  details?: string;
  campaignName?: string;
  campaignId?: string;
  action?: string;
  previousStatus?: string;
  newStatus?: string;
  htmlBody?: string;
  fullContent?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  sentiment?: "positive" | "neutral" | "negative" | "angry" | null;
  callLogId?: string | null;
  dispositionCode?: string | null;
  dispositionName?: string | null;
  dispositionColor?: string | null;
  dispositionIcon?: string | null;
  dispositionChecklistNames?: string[] | null;
  metadata?: any;
}

interface TimelineEntry {
  id: string;
  type: "call" | "email" | "sms" | "note" | "system";
  direction?: "inbound" | "outbound";
  timestamp: Date;
  content: string;
  details?: string;
  status?: string;
  htmlBody?: string;
  fullContent?: string;
  agentName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  sentiment?: string | null;
}

const DIAL_CODE_MAP: Record<string, string> = {
  SK: "+421", CZ: "+420", HU: "+36", RO: "+40", IT: "+39", DE: "+49",
};

function buildE164Phone(countryCode: string, localPhone: string): string {
  if (!localPhone) return "";
  const dialCode = DIAL_CODE_MAP[countryCode];
  return dialCode ? `${dialCode} ${localPhone}` : localPhone;
}

function parseInboundPhone(phone: string): { countryCode: string; localPhone: string } {
  if (!phone) return { countryCode: "", localPhone: "" };
  let cleaned = phone.replace(/[\s\-().]/g, "");

  // Normalize 00XXXX → +XXXX
  if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);

  // Sorted longest-prefix-first to avoid partial matches (421 before 40, 420 before 40)
  const prefixMap: { prefix: string; countryCode: string }[] = [
    { prefix: "+421", countryCode: "SK" },
    { prefix: "+420", countryCode: "CZ" },
    { prefix: "+36", countryCode: "HU" },
    { prefix: "+40", countryCode: "RO" },
    { prefix: "+39", countryCode: "IT" },
    { prefix: "+49", countryCode: "DE" },
  ];

  // Try direct match with + prefix
  for (const { prefix, countryCode } of prefixMap) {
    if (cleaned.startsWith(prefix)) {
      return { countryCode, localPhone: cleaned.slice(prefix.length) };
    }
  }

  // Try without leading 0 (national format: 0 + country-code + number)
  if (cleaned.startsWith("0")) {
    const withoutZero = cleaned.slice(1);
    for (const { prefix, countryCode } of prefixMap) {
      const digits = prefix.slice(1); // strip the +
      if (withoutZero.startsWith(digits)) {
        return { countryCode, localPhone: withoutZero.slice(digits.length) };
      }
    }
  }

  // Try matching raw digits (no leading 0, no +)
  for (const { prefix, countryCode } of prefixMap) {
    const digits = prefix.slice(1);
    if (cleaned.startsWith(digits)) {
      return { countryCode, localPhone: cleaned.slice(digits.length) };
    }
  }

  return { countryCode: "", localPhone: cleaned };
}

function getEntityDisplayInfo(cc: EnrichedCampaignContact): { name: string; initials: string; subtitle: string; type: string } | null {
  if (cc.contactType === "hospital" && cc.hospital) {
    const h = cc.hospital as any;
    const name = h.name || "Hospital";
    return { name, initials: name.substring(0, 2).toUpperCase(), subtitle: h.phone || h.email || "Hospital", type: "hospital" };
  }
  if (cc.contactType === "clinic" && cc.clinic) {
    const c = cc.clinic as any;
    const name = c.clinicName || c.name || "Clinic";
    const doctor = c.doctorName || "";
    return { name: doctor ? `${name} — ${doctor}` : name, initials: (name[0] || "") + (doctor?.[0] || ""), subtitle: c.phone || c.email || "Clinic", type: "clinic" };
  }
  if (cc.contactType === "collaborator" && cc.collaborator) {
    const col = cc.collaborator as any;
    const fn = col.firstName || col.name || "";
    const ln = col.lastName || "";
    const name = `${fn} ${ln}`.trim() || "Collaborator";
    return { name, initials: (fn?.[0] || "") + (ln?.[0] || ""), subtitle: col.phone || col.email || "Collaborator", type: "collaborator" };
  }
  if (cc.customer) {
    const cust = cc.customer;
    return { name: `${cust.firstName || ""} ${cust.lastName || ""}`.trim() || "—", initials: (cust.firstName?.[0] || "") + (cust.lastName?.[0] || ""), subtitle: cust.phone || cust.email || "—", type: "customer" };
  }
  return null;
}

function SentimentBadge({ sentiment, size = "sm" }: { sentiment?: string | null; size?: "sm" | "md" }) {
  if (!sentiment) return null;
  const config: Record<string, { label: string; className: string }> = {
    positive: { label: "+", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-200 dark:border-green-800" },
    neutral: { label: "~", className: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 border-gray-200 dark:border-gray-700" },
    negative: { label: "−", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800" },
    angry: { label: "!", className: "bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300 border-red-300 dark:border-red-700" },
  };
  const c = config[sentiment];
  if (!c) return null;
  const sizeClass = size === "sm" ? "text-[9px] h-4 w-4 min-w-4" : "text-[10px] h-5 w-5 min-w-5";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-bold shrink-0 ${sizeClass} ${c.className}`}
      title={sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
      data-testid={`sentiment-${sentiment}`}
    >
      {c.label}
    </span>
  );
}

function getStatusConfig(t: any): Record<AgentStatus, { label: string; color: string; icon: React.ReactNode }> {
  return {
    available: { label: t.agentSession.statusAvailable, color: "bg-green-500", icon: <Headphones className="h-4 w-4" /> },
    busy: { label: t.agentSession.statusBusy, color: "bg-red-500", icon: <PhoneCall className="h-4 w-4" /> },
    break: { label: t.agentSession.statusBreak, color: "bg-yellow-500", icon: <Coffee className="h-4 w-4" /> },
    wrap_up: { label: t.agentSession.statusWrapUp, color: "bg-blue-500", icon: <FileText className="h-4 w-4" /> },
    offline: { label: t.agentSession.statusOffline, color: "bg-gray-500", icon: <PhoneOff className="h-4 w-4" /> },
  };
}


const CHANNEL_CONFIG: Record<ChannelType, { icon: typeof Phone; label: string; color: string; bg: string }> = {
  phone: { icon: Phone, label: "Telefón", color: "text-blue-500", bg: "bg-blue-500" },
  email: { icon: Mail, label: "Email", color: "text-green-500", bg: "bg-green-500" },
  sms: { icon: MessageSquare, label: "SMS", color: "text-orange-500", bg: "bg-orange-500" },
  mixed: { icon: Users, label: "Mix", color: "text-purple-500", bg: "bg-purple-500" },
};

const DISPOSITION_ICON_MAP: Record<string, typeof Phone> = {
  ThumbsUp, ThumbsDown, CalendarPlus, PhoneOff, AlertCircle, XCircle, Phone, Clock,
  Calendar, MessageSquare, FileText, Info, User, Mail, Star, Zap, CheckCircle,
  Send, Ban, Heart, Bell, Flag, Target, Eye, EyeOff, UserCheck, UserX, Users,
  Home, MapPin, Globe, Briefcase, Gift, Volume2, VolumeX, CircleDot,
  CheckCircle2, Circle,
};

const DISPOSITION_COLOR_MAP: Record<string, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

const DISPOSITION_HEX_MAP: Record<string, string> = {
  green: "#10B981",
  blue: "#3B82F6",
  orange: "#F97316",
  red: "#EF4444",
  gray: "#6B7280",
  yellow: "#F59E0B",
  purple: "#8B5CF6",
};

interface ScriptElement {
  id: string;
  type: string;
  label?: string;
  content?: string;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string; nextStepId?: string }[];
  action?: string;
  actionLabel?: string;
  actionIcon?: string;
  variant?: string;
  emailTemplateId?: string;
}

interface ScriptStep {
  id: string;
  title: string;
  description?: string;
  elements: ScriptElement[];
  isEndStep?: boolean;
  nextStepId?: string;
}

interface ParsedScript {
  version: number;
  name?: string;
  description?: string;
  startStepId?: string;
  steps: ScriptStep[];
}

function TopBar({
  status,
  onStatusChange,
  stats,
  quotas,
  isQuotaBlocked,
  workTime,
  breakTypes,
  activeBreakName,
  activeBreakType,
  breakTime,
  breakElapsedSeconds,
  onStartBreak,
  onEndBreak,
  isOnBreak,
  onEndSession,
  isSessionActive,
  t,
  onOpenScheduledQueue,
  scheduledQueueCounts,
  abandonedCallsCount,
  onOpenAbandonedCalls,
  onOpenMyActivity,
  inboundRingtoneEnabled,
  onToggleInboundRingtone,
}: {
  status: AgentStatus;
  onStatusChange: (status: AgentStatus) => void;
  stats: { calls: number; emails: number; sms: number };
  quotas: { calls: number | null; emails: number | null; sms: number | null } | null;
  isQuotaBlocked: (type: "calls" | "emails" | "sms") => boolean;
  workTime: string;
  breakTypes: AgentBreakType[];
  activeBreakName: string | null;
  activeBreakType: AgentBreakType | null;
  breakTime: string;
  breakElapsedSeconds: number;
  onStartBreak: (breakTypeId: string) => void;
  onEndBreak: () => void;
  isOnBreak: boolean;
  onEndSession: () => void;
  isSessionActive: boolean;
  t: any;
  onOpenScheduledQueue?: () => void;
  scheduledQueueCounts?: { total: number; overdue: number };
  abandonedCallsCount?: number;
  onOpenAbandonedCalls?: () => void;
  onOpenMyActivity?: () => void;
  inboundRingtoneEnabled?: boolean;
  onToggleInboundRingtone?: () => void;
}) {
  const STATUS_CONFIG = getStatusConfig(t);
  const config = STATUS_CONFIG[status];
  const { user: topBarUser } = useAuth();
  const { data: fwdData } = useQuery<{ enabled: boolean; number: string | null }>({
    queryKey: ["/api/users", topBarUser?.id, "call-forwarding"],
    queryFn: () => fetch(`/api/users/${topBarUser!.id}/call-forwarding`, { credentials: "include" }).then(r => r.json()),
    enabled: !!topBarUser?.id && !!isSessionActive,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const callForwardingActive = !!(fwdData?.enabled && fwdData?.number);

  return (
    <div className="shrink-0">
      {/* Row 1: Agent status bar */}
      <div className="h-12 border-b bg-card flex items-center justify-between px-4 gap-2">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                data-testid="dropdown-agent-status"
              >
                <span className={`h-2 w-2 rounded-full ${config.color} ${status === "available" ? "animate-pulse" : ""}`} />
                {config.icon}
                <span className="font-medium text-xs">{config.label}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {(["available", "busy", "wrap_up"] as AgentStatus[]).map((key) => {
                const value = STATUS_CONFIG[key];
                return (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => onStatusChange(key)}
                    className="gap-3 py-2"
                    data-testid={`menu-item-status-${key}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${value.color}`} />
                    {value.icon}
                    <span className="font-medium">{value.label}</span>
                  </DropdownMenuItem>
                );
              })}
              <Separator className="my-1" />
              {breakTypes.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs text-muted-foreground font-medium">{t.agentSession.breaks}</div>
                  {breakTypes.map((bt) => (
                    <DropdownMenuItem
                      key={bt.id}
                      onClick={() => onStartBreak(bt.id)}
                      className="gap-3 py-2"
                      data-testid={`menu-item-break-${bt.id}`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                      <Coffee className="h-4 w-4" />
                      <span className="font-medium">{bt.name}</span>
                      {bt.maxDurationMinutes && (
                        <span className="ml-auto text-xs text-muted-foreground">{bt.maxDurationMinutes}m</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <Separator className="my-1" />
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {isSessionActive && (
            <Button variant="outline" size="sm" onClick={onEndSession} data-testid="button-end-session" className="text-destructive border-destructive/30 gap-1">
              <LogOut className="h-3.5 w-3.5" />
              <span className="text-xs hidden xl:inline">{t.agentSession.endShift}</span>
            </Button>
          )}

          {isSessionActive && onToggleInboundRingtone && (
            callForwardingActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleInboundRingtone}
                data-testid="button-toggle-inbound-ringtone"
                aria-pressed={!!inboundRingtoneEnabled}
                title={`Inbound calls forwarded → ${fwdData?.number}`}
                className="gap-1.5 text-orange-600 border-orange-400/60 dark:text-orange-400 dark:border-orange-500/40"
              >
                <PhoneForwarded className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[10px] font-mono leading-none max-w-[80px] truncate hidden sm:inline">{fwdData?.number}</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleInboundRingtone}
                data-testid="button-toggle-inbound-ringtone"
                aria-pressed={!!inboundRingtoneEnabled}
                title={inboundRingtoneEnabled ? t.agentWorkspace.inboundRingtoneOn : t.agentWorkspace.inboundRingtoneOff}
                className={`gap-1 ${inboundRingtoneEnabled ? "text-green-600 border-green-500/40 dark:text-green-400" : "text-muted-foreground"}`}
              >
                {inboundRingtoneEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </Button>
            )
          )}

          {isOnBreak && activeBreakName && (() => {
            const expectedMin = activeBreakType?.expectedDurationMinutes;
            const isExceeded = expectedMin ? breakElapsedSeconds > expectedMin * 60 : false;
            const exceededBy = expectedMin ? Math.max(0, Math.floor((breakElapsedSeconds - expectedMin * 60) / 60)) : 0;
            return (
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className={`gap-1 ${isExceeded ? "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 animate-pulse border border-red-300 dark:border-red-700" : "text-yellow-700 dark:text-yellow-300"}`}
                  data-testid="badge-break-active"
                >
                  {isExceeded ? <AlertTriangle className="h-3 w-3" /> : <Coffee className="h-3 w-3" />}
                  <span className="text-xs">{activeBreakName}</span>
                  <span className="font-mono text-[10px]">{breakTime}</span>
                </Badge>
                {isExceeded && (
                  <Badge variant="destructive" className="gap-1 text-[10px]" data-testid="badge-break-exceeded">
                    <AlertTriangle className="h-3 w-3" />
                    +{exceededBy}m
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={onEndBreak} data-testid="button-end-break">
                  <Play className="h-3 w-3 mr-1" />
                  <span className="text-xs">{t.agentSession.continueWork}</span>
                </Button>
              </div>
            );
          })()}

          <Separator orientation="vertical" className="h-6 mx-1" />

          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono text-[11px] font-semibold" data-testid="text-work-time">{workTime}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className={`flex items-center gap-1 text-xs ${isQuotaBlocked("calls") ? "opacity-50" : ""}`} data-testid="stat-calls">
              <Phone className={`h-3 w-3 ${isQuotaBlocked("calls") ? "text-destructive" : "text-blue-500"}`} />
              <span className={`font-bold ${isQuotaBlocked("calls") ? "text-destructive" : "text-blue-600 dark:text-blue-400"}`}>
                {stats.calls}{quotas?.calls !== null && quotas?.calls !== undefined ? `/${quotas.calls}` : ""}
              </span>
            </div>
            <div className={`flex items-center gap-1 text-xs ${isQuotaBlocked("emails") ? "opacity-50" : ""}`} data-testid="stat-emails">
              <Mail className={`h-3 w-3 ${isQuotaBlocked("emails") ? "text-destructive" : "text-green-500"}`} />
              <span className={`font-bold ${isQuotaBlocked("emails") ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                {stats.emails}{quotas?.emails !== null && quotas?.emails !== undefined ? `/${quotas.emails}` : ""}
              </span>
            </div>
            <div className={`flex items-center gap-1 text-xs ${isQuotaBlocked("sms") ? "opacity-50" : ""}`} data-testid="stat-sms">
              <MessageSquare className={`h-3 w-3 ${isQuotaBlocked("sms") ? "text-destructive" : "text-orange-500"}`} />
              <span className={`font-bold ${isQuotaBlocked("sms") ? "text-destructive" : "text-orange-600 dark:text-orange-400"}`}>
                {stats.sms}{quotas?.sms !== null && quotas?.sms !== undefined ? `/${quotas.sms}` : ""}
              </span>
            </div>
          </div>

          {onOpenScheduledQueue && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenScheduledQueue}
                className="gap-1.5 relative"
                data-testid="btn-open-scheduled-queue"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                <span className="text-xs hidden xl:inline">{t.agentWorkspace.queue}</span>
                {scheduledQueueCounts && scheduledQueueCounts.total > 0 && (
                  <Badge
                    variant={scheduledQueueCounts.overdue > 0 ? "destructive" : "secondary"}
                    className="text-[9px] h-4 min-w-[16px] px-1 ml-0.5"
                    data-testid="badge-scheduled-total"
                  >
                    {scheduledQueueCounts.total}
                  </Badge>
                )}
                {scheduledQueueCounts && scheduledQueueCounts.overdue > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                  </span>
                )}
              </Button>
            </>
          )}

          {onOpenAbandonedCalls && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenAbandonedCalls}
                className="gap-1.5 relative"
                data-testid="btn-open-abandoned-calls"
              >
                <PhoneOff className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs hidden xl:inline">{t.agentWorkspace.missedLabel}</span>
                {(abandonedCallsCount || 0) > 0 && (
                  <Badge
                    variant="destructive"
                    className="text-[9px] h-4 min-w-[16px] px-1 ml-0.5"
                    data-testid="badge-abandoned-total"
                  >
                    {abandonedCallsCount}
                  </Badge>
                )}
              </Button>
            </>
          )}
          {onOpenMyActivity && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenMyActivity}
                className="gap-1.5"
                data-testid="btn-open-my-activity"
              >
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs hidden xl:inline">{t.agentWorkspace.todayCallsButtonLabel}</span>
              </Button>
            </>
          )}
        </div>
      </div>

    </div>
  );
}

function TaskListPanel({
  tasks,
  activeTaskId,
  onSelectTask,
  campaigns,
  inboundQueues,
  sessionInboundQueueIds,
  selectedCampaignId,
  onSelectCampaign,
  showOnlyAssigned,
  onToggleAssigned,
  channelFilter,
  onChannelFilterChange,
  onLoadNextContact,
  isLoadingContact,
  campaignContacts,
  onSelectCampaignContact,
  currentUserId,
  onOpenContactsModal,
  isAutoMode,
  onToggleAutoMode,
  autoCountdown,
  onOpenTasksModal,
  onCancelTask,
  agentStatus,
  contactsDisabled,
  callContactId,
  callIsActive,
  inboundCallbacks,
  onMarkInboundCallbackDone,
}: {
  tasks: TaskItem[];
  activeTaskId: string | null;
  onSelectTask: (task: TaskItem) => void;
  campaigns: { id: string; name: string; contactCount: number; status: string; channel: string; callerIdNumber?: string | null; workingHoursStart?: string | null; workingHoursEnd?: string | null }[];
  inboundQueues?: { id: string; name: string; didNumber: string | null }[];
  sessionInboundQueueIds?: string[];
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string) => void;
  showOnlyAssigned: boolean;
  onToggleAssigned: (value: boolean) => void;
  channelFilter: string;
  onChannelFilterChange: (v: string) => void;
  onLoadNextContact: () => void;
  isLoadingContact: boolean;
  campaignContacts: EnrichedCampaignContact[];
  onSelectCampaignContact: (contact: EnrichedCampaignContact) => void;
  currentUserId?: string;
  isAutoMode: boolean;
  onToggleAutoMode: () => void;
  autoCountdown: number | null;
  onOpenContactsModal: () => void;
  onOpenTasksModal: () => void;
  onCancelTask: (taskId: string) => void;
  agentStatus: AgentStatus;
  contactsDisabled?: boolean;
  callContactId?: string | null;
  callIsActive?: boolean;
  inboundCallbacks?: InboundCb[];
  onMarkInboundCallbackDone?: (id: number) => void;
}) {
  const { t } = useI18n();
  const filteredCampaigns = useMemo(() => {
    if (channelFilter === "all") return campaigns;
    return campaigns.filter((c) => c.channel === channelFilter);
  }, [campaigns, channelFilter]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([]));
  const toggleGroup = (id: string) => setExpandedGroups(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const nContacts = (n: number) => {
    const s = n === 1 ? t.agentWorkspace.contactSingular : (n >= 2 && n <= 4) ? t.agentWorkspace.contactFew : t.agentWorkspace.contactPlural;
    return `${n} ${s}`;
  };

  return (
    <div className="w-72 border-r bg-card flex flex-col h-full shrink-0">
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Headphones className="h-4 w-4 text-primary" />
            {t.agentWorkspace.workspace}
          </h3>
          <div className="flex items-center gap-1">
            {tasks.length > 0 && (
              <Badge variant="secondary">{tasks.length}</Badge>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="btn-queue-settings">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3" align="end">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.agentWorkspace.queueSettings}</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-assigned"
                    checked={showOnlyAssigned}
                    onCheckedChange={(checked) => onToggleAssigned(!!checked)}
                    data-testid="checkbox-show-assigned"
                  />
                  <Label htmlFor="show-assigned" className="text-xs cursor-pointer">{t.agentWorkspace.onlyAssigned}</Label>
                </div>
                <Select value={channelFilter} onValueChange={onChannelFilterChange}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-channel-filter">
                    <SelectValue placeholder={t.agentWorkspace.allChannels} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.agentWorkspace.allChannels}</SelectItem>
                    <SelectItem value="phone">Telefón</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="mixed">Zmiešané</SelectItem>
                  </SelectContent>
                </Select>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="border-b">
          <div className="px-3 py-2 flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t.agentWorkspace.activeTasks} ({tasks.length})
            </span>
            <Button size="icon" variant="ghost" onClick={onOpenTasksModal} data-testid="btn-maximize-tasks">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="max-h-48">
            <div className="px-2 pb-2 space-y-1">
              {tasks.map((task) => {
                const ChIcon = CHANNEL_CONFIG[task.channel].icon;
                const isActive = activeTaskId === task.id;
                const isOnCall = !!(callIsActive && callContactId && task.contact.id === callContactId);
                const elapsed = Math.floor((Date.now() - task.startedAt.getTime()) / 1000);
                const mins = Math.floor(elapsed / 60);
                const taskAc = task.channel === "phone" ? "#B5622E" : task.channel === "email" ? "#5B4FCF" : task.channel === "sms" ? "#2E75B6" : "#5A7A5A";

                return (
                  <div
                    key={task.id}
                    className="group flex items-center gap-2.5 px-2.5 py-2 cursor-pointer transition-all duration-150"
                    style={{
                      background: isActive ? `${taskAc}12` : "hsl(var(--card))",
                      border: `1.5px solid ${isActive ? taskAc : taskAc + "30"}`,
                      borderRadius: "12px",
                      boxShadow: isActive ? `0 3px 10px ${taskAc}25` : "0 1px 4px rgba(0,0,0,0.05)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = `${taskAc}65`;
                        el.style.boxShadow = `0 4px 12px ${taskAc}20`;
                        el.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = `${taskAc}30`;
                        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)";
                        el.style.transform = "";
                      }
                    }}
                    onClick={() => onSelectTask(task)}
                    data-testid={`task-item-${task.id}`}
                  >
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 relative"
                      style={{ background: taskAc, boxShadow: `0 2px 8px ${taskAc}50` }}
                    >
                      <ChIcon className="h-4 w-4 text-white" />
                      {task.status === "active" && (
                        <span className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white animate-pulse ${isOnCall ? "bg-red-500" : "bg-green-500"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate text-foreground">
                        {task.contact.firstName} {task.contact.lastName}
                      </p>
                      <p className="text-[10px] truncate text-muted-foreground">
                        {task.campaignName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isOnCall && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                          In Call
                        </span>
                      )}
                      {!isOnCall && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${taskAc}18`, color: taskAc }}>{mins}m</span>}
                      {!isOnCall && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); onCancelTask(task.id); }}
                          data-testid={`btn-cancel-task-${task.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {t.agentWorkspace.campaigns}
        </span>
      </div>
      <div className="px-2 pb-2 space-y-1">
        {filteredCampaigns.map((campaign) => {
          const chConfig = CHANNEL_CONFIG[campaign.channel as ChannelType] || CHANNEL_CONFIG.phone;
          const ChIcon = chConfig.icon;
          const isSelected = selectedCampaignId === campaign.id;
          const ac = "#4A7FA6";
          const scheduleInfo = (campaign.workingHoursStart && campaign.workingHoursEnd)
            ? `${campaign.workingHoursStart} – ${campaign.workingHoursEnd}`
            : null;
          const inboundDids = (sessionInboundQueueIds || [])
            .map(qId => (inboundQueues || []).find(q => q.id === qId))
            .filter(Boolean)
            .map(q => q!.didNumber)
            .filter(Boolean);

          return (
            <div
              key={campaign.id}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all duration-150"
              style={{
                background: isSelected ? ac : "#F0F5FA",
                border: `1.5px solid ${isSelected ? ac : ac + "28"}`,
                borderRadius: "14px",
                boxShadow: isSelected ? `0 4px 14px ${ac}35` : "0 1px 3px rgba(0,0,0,0.05)",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = `${ac}60`;
                  el.style.boxShadow = `0 4px 12px ${ac}18`;
                  el.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = `${ac}28`;
                  el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
                  el.style.transform = "";
                }
              }}
              onClick={() => onSelectCampaign(campaign.id)}
              data-testid={`btn-queue-${campaign.id}`}
            >
              <div
                className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: isSelected ? "rgba(255,255,255,0.22)" : ac,
                  boxShadow: isSelected ? "none" : `0 2px 6px ${ac}45`,
                }}
              >
                <ChIcon className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={`block truncate text-xs font-semibold leading-tight${isSelected ? "" : " text-foreground"}`}
                  style={{ color: isSelected ? "#fff" : undefined }}
                >
                  {campaign.name}
                </span>
                {(campaign.callerIdNumber || scheduleInfo || inboundDids.length > 0) && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {scheduleInfo && (
                      <span className="flex items-center gap-0.5 text-[9px]" style={{ color: isSelected ? "rgba(255,255,255,0.75)" : "#607080" }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {scheduleInfo}
                      </span>
                    )}
                    {campaign.callerIdNumber && (
                      <span className="flex items-center gap-0.5 text-[9px]" style={{ color: isSelected ? "rgba(255,255,255,0.75)" : "#607080" }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6.07 6.07l.96-.96a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        {campaign.callerIdNumber}
                      </span>
                    )}
                    {inboundDids.length > 0 && (
                      inboundDids.length === 1 ? (
                        <span
                          className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={isSelected
                            ? { background: "rgba(134,239,172,0.25)", color: "#bbf7d0", border: "1px solid rgba(134,239,172,0.35)" }
                            : { background: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }
                          }
                        >
                          <PhoneIncoming width={8} height={8} strokeWidth={2.5} />
                          Inbound line: {inboundDids[0]}
                        </span>
                      ) : (
                        <span
                          className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={isSelected
                            ? { background: "rgba(134,239,172,0.25)", color: "#bbf7d0", border: "1px solid rgba(134,239,172,0.35)" }
                            : { background: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }
                          }
                          title={inboundDids.join(", ")}
                        >
                          <PhoneIncoming width={8} height={8} strokeWidth={2.5} />
                          Inbound lines: {inboundDids.join(", ")}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: isSelected ? "rgba(255,255,255,0.25)" : `${ac}18`,
                  color: isSelected ? "#fff" : ac,
                }}
              >
                {campaign.contactCount}
              </span>
            </div>
          );
        })}
        {filteredCampaigns.length === 0 && (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground">{t.agentWorkspace.noCampaigns || "No missions"}</p>
          </div>
        )}
      </div>

      <div className="px-2 pb-2 space-y-1.5">
        <InboundQueueStatus userId={currentUserId} />
      </div>

      {selectedCampaignId && (
        <div className={`border-t flex flex-col flex-1 min-h-0 relative ${contactsDisabled ? "pointer-events-none" : ""}`}>
          {contactsDisabled && (
            <div className="absolute inset-0 bg-background/70 z-10 flex items-center justify-center rounded-sm">
              <p className="text-xs text-muted-foreground font-medium px-3 text-center">Najprv uložte záznam</p>
            </div>
          )}
          <div
            className="px-3 py-2 flex items-center justify-between gap-1 rounded-md mx-1 mt-1"
            data-testid="contacts-header"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t.agentWorkspace.contacts} ({campaignContacts.length})
              </span>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onOpenContactsModal(); }} data-testid="btn-maximize-contacts"><Maximize2 className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {autoCountdown !== null && (
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {autoCountdown}s
                </Badge>
              )}
              <Button size="sm" variant={isAutoMode ? "default" : "ghost"} onClick={onToggleAutoMode} className={`text-xs gap-1 ${isAutoMode ? "bg-green-600 text-white" : ""}`} data-testid="btn-auto-mode">
                {isAutoMode ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                Auto
              </Button>
              <Button size="sm" variant="ghost" onClick={onLoadNextContact} disabled={isLoadingContact || campaignContacts.length === 0 || isAutoMode || agentStatus === "wrap_up" || agentStatus === "break"} className="text-xs gap-1" data-testid="btn-next-contact">
                {isLoadingContact ? <Loader2 className="h-3 w-3 animate-spin" /> : <SkipForward className="h-3 w-3" />}
                {t.agentWorkspace.nextBtn}
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="px-2 pb-3 pt-1 space-y-2">
              {(() => {
                const now = new Date();
                const isDue = (cc: EnrichedCampaignContact) => cc.callbackDate && new Date(cc.callbackDate) <= now;
                const isMine = (cc: EnrichedCampaignContact) => cc.assignedTo === currentUserId;
                const isTeam = (cc: EnrichedCampaignContact) => !cc.assignedTo;
                const isCb = (cc: EnrichedCampaignContact) => cc.status === "callback_scheduled";
                const sortByDate = (a: EnrichedCampaignContact, b: EnrichedCampaignContact) => {
                  const aDate = a.callbackDate ? new Date(a.callbackDate).getTime() : Infinity;
                  const bDate = b.callbackDate ? new Date(b.callbackDate).getTime() : Infinity;
                  return aDate - bDate;
                };

                const contactGroups = [
                  {
                    id: "due",
                    label: t.agentWorkspace.groupDue,
                    items: [
                      ...campaignContacts.filter(cc => isCb(cc) && isMine(cc) && isDue(cc)).sort(sortByDate),
                      ...campaignContacts.filter(cc => isCb(cc) && isTeam(cc) && isDue(cc)).sort(sortByDate),
                    ],
                    ac: "#B5622E",
                    Icon: PhoneCall,
                  },
                  {
                    id: "my-cb",
                    label: t.agentWorkspace.groupMyCb,
                    items: campaignContacts.filter(cc => isCb(cc) && (isMine(cc) || isTeam(cc)) && !isDue(cc)).sort(sortByDate),
                    ac: "#5B4FCF",
                    Icon: Clock,
                  },
                  {
                    id: "team-cb",
                    label: t.agentWorkspace.groupTeamCb,
                    items: campaignContacts.filter(cc => isCb(cc) && cc.assignedTo && !isMine(cc) && !isDue(cc)).sort(sortByDate),
                    ac: "#2E75B6",
                    Icon: Users,
                  },
                  {
                    id: "other-cb",
                    label: t.agentWorkspace.groupOtherCb,
                    items: campaignContacts.filter(cc => isCb(cc) && cc.assignedTo && cc.assignedTo !== currentUserId).sort(sortByDate),
                    ac: "#7A6858",
                    Icon: User,
                  },
                  {
                    id: "pending",
                    label: t.agentWorkspace.groupPending,
                    items: campaignContacts.filter(cc => cc.status === "pending"),
                    ac: "#5A7A5A",
                    Icon: Users,
                  },
                ].filter(g => g.items.length > 0);

                if (contactGroups.length === 0 && (!inboundCallbacks || inboundCallbacks.length === 0)) {
                  return (
                    <div className="text-center py-6">
                      <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">Žiadne čakajúce kontakty</p>
                    </div>
                  );
                }
                if (contactGroups.length === 0) return null;

                const typeIconMap: Record<string, typeof User> = {
                  hospital: Building2,
                  clinic: Stethoscope,
                  collaborator: Handshake,
                  customer: User,
                };

                return contactGroups.map(({ id, label, items, ac, Icon }) => {
                  const isOpen = expandedGroups.has(id);
                  const isDisabled = agentStatus === "wrap_up" || agentStatus === "break";
                  return (
                    <div
                      key={id}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: "hsl(var(--card))",
                        border: `1.5px solid ${ac}40`,
                        boxShadow: `0 2px 10px ${ac}15`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150"
                        style={{
                          background: isOpen ? `${ac}14` : `${ac}08`,
                          borderBottom: isOpen ? `1px solid ${ac}30` : "none",
                        }}
                      >
                        <div
                          className="h-9 w-9 rounded-2xl flex items-center justify-center shrink-0"
                          style={{ background: ac, boxShadow: `0 2px 6px ${ac}40` }}
                        >
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-foreground">{label}</div>
                          <div className="text-[10px] mt-0.5 text-muted-foreground">{nContacts(items.length)}</div>
                        </div>
                        <span
                          className="text-xs font-bold min-w-[26px] h-6 flex items-center justify-center rounded-full px-1.5 shrink-0"
                          style={{ background: ac, color: "#fff" }}
                        >
                          {items.length}
                        </span>
                        {isOpen
                          ? <ChevronUp className="h-3.5 w-3.5 shrink-0" style={{ color: ac }} />
                          : <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: ac }} />
                        }
                      </button>

                      {isOpen && (
                        <div className="p-2 space-y-1.5" style={{ background: "hsl(var(--card))" }}>
                          {items.map(cc => {
                            const entityDisplay = getEntityDisplayInfo(cc);
                            if (!entityDisplay) return null;
                            const callbackDateStr = cc.callbackDate ? format(new Date(cc.callbackDate), "dd.MM. HH:mm") : null;
                            const TypeIcon = typeIconMap[entityDisplay.type] || User;
                            return (
                              <div
                                key={cc.id}
                                className={`rounded-xl px-2.5 py-2 transition-all duration-200 ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                style={{
                                  background: "hsl(var(--background))",
                                  border: `1px solid ${ac}25`,
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                }}
                                onMouseEnter={isDisabled ? undefined : (e) => {
                                  const el = e.currentTarget as HTMLElement;
                                  el.style.borderColor = `${ac}60`;
                                  el.style.boxShadow = `0 4px 10px ${ac}18`;
                                  el.style.transform = "translateY(-1px)";
                                }}
                                onMouseLeave={isDisabled ? undefined : (e) => {
                                  const el = e.currentTarget as HTMLElement;
                                  el.style.borderColor = `${ac}25`;
                                  el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
                                  el.style.transform = "translateY(0)";
                                }}
                                onClick={() => { if (!isDisabled) onSelectCampaignContact(cc); }}
                                data-testid={`contact-item-${cc.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                                    style={{ background: `${ac}15`, border: `1.5px solid ${ac}30` }}
                                  >
                                    <TypeIcon className="h-3.5 w-3.5" style={{ color: ac }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>
                                      {entityDisplay.name}
                                    </p>
                                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                      {callbackDateStr ? (
                                        <>
                                          <Calendar className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                          <span className="text-[10px] text-muted-foreground">{callbackDateStr}</span>
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground">{entityDisplay.subtitle}</span>
                                      )}
                                    </div>
                                    {cc.callbackNote && (
                                      <p className="text-[9px] mt-0.5 truncate italic text-muted-foreground" title={cc.callbackNote}>
                                        📝 {cc.callbackNote}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {cc.attemptCount > 0 && (
                                      <span
                                        className="text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full"
                                        style={{ background: `${ac}18`, color: ac }}
                                      >
                                        {cc.attemptCount}x
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      className="h-7 w-7 rounded-xl flex items-center justify-center transition-all duration-150"
                                      style={{ background: ac, color: "#fff", boxShadow: `0 2px 5px ${ac}40` }}
                                      onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.12)")}
                                      onMouseLeave={e => (e.currentTarget.style.filter = "none")}
                                      onClick={e => { e.stopPropagation(); if (!isDisabled) onSelectCampaignContact(cc); }}
                                      data-testid={`btn-call-${cc.id}`}
                                    >
                                      <Phone className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Mimo misie — out-of-mission inbound callbacks */}
      {inboundCallbacks && inboundCallbacks.length > 0 && (
        <div className="border-t px-2 py-2 shrink-0">
          {(() => {
            const ac = "#C45A11";
            const isOpen = expandedGroups.has("mimo-misie");
            return (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "hsl(var(--card))", border: `1.5px solid ${ac}40`, boxShadow: `0 2px 10px ${ac}15` }}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup("mimo-misie")}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150"
                  style={{ background: isOpen ? `${ac}14` : `${ac}08`, borderBottom: isOpen ? `1px solid ${ac}30` : "none" }}
                >
                  <div className="h-9 w-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: ac, boxShadow: `0 2px 6px ${ac}40` }}>
                    <PhoneIncoming className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-foreground">Mimo misie</div>
                    <div className="text-[10px] mt-0.5 text-muted-foreground">{inboundCallbacks.length} {inboundCallbacks.length === 1 ? "callback" : inboundCallbacks.length >= 2 && inboundCallbacks.length <= 4 ? "callbacky" : "callbackov"}</div>
                  </div>
                  <span className="text-xs font-bold min-w-[26px] h-6 flex items-center justify-center rounded-full px-1.5 shrink-0" style={{ background: ac, color: "#fff" }}>
                    {inboundCallbacks.length}
                  </span>
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5 shrink-0" style={{ color: ac }} /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: ac }} />}
                </button>
                {isOpen && (
                  <div className="p-2 space-y-1.5" style={{ background: "hsl(var(--card))" }}>
                    {inboundCallbacks.map(cb => {
                      const cbDate = cb.callbackDate ? format(new Date(cb.callbackDate), "dd.MM. HH:mm") : null;
                      const isOverdue = !cb.calledBack && cb.callbackDate && new Date(cb.callbackDate) < new Date();
                      const isDone = cb.calledBack;
                      return (
                        <div
                          key={cb.id}
                          className={`rounded-xl px-2.5 py-2 transition-all duration-200 ${isDone ? "opacity-50" : ""}`}
                          style={{ background: isDone ? "hsl(var(--muted))" : "hsl(var(--background))", border: `1px solid ${isDone ? "#16a34a40" : `${ac}25`}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                          onMouseEnter={e => { if (!isDone) { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${ac}60`; el.style.boxShadow = `0 4px 10px ${ac}18`; } }}
                          onMouseLeave={e => { if (!isDone) { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${ac}25`; el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; } }}
                          data-testid={`inbound-cb-item-${cb.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ background: isDone ? "#16a34a15" : `${ac}15`, border: `1.5px solid ${isDone ? "#16a34a40" : `${ac}30`}` }}>
                              {isDone ? <CheckCheck className="h-3.5 w-3.5 text-green-600" /> : <PhoneIncoming className="h-3.5 w-3.5" style={{ color: ac }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold truncate ${isDone ? "line-through text-muted-foreground" : ""}`} style={isDone ? {} : { color: "hsl(var(--foreground))" }}>{cb.name || cb.phone}</p>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {isDone ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                                    <Check className="h-2.5 w-2.5" />
                                    {t.agentWorkspace.inboundCallbackDone}
                                  </span>
                                ) : (
                                  <>
                                    {cb.name && <span className="text-[10px] text-muted-foreground truncate">{cb.phone}</span>}
                                    {cbDate && (
                                      <>
                                        <Calendar className="h-2.5 w-2.5 shrink-0" style={{ color: isOverdue ? "#ef4444" : "currentColor" }} />
                                        <span className="text-[10px]" style={{ color: isOverdue ? "#ef4444" : "hsl(var(--muted-foreground))" }}>{cbDate}</span>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                              {cb.notes && !isDone && (
                                <p className="text-[9px] mt-0.5 truncate italic text-muted-foreground" title={cb.notes}>📝 {cb.notes}</p>
                              )}
                            </div>
                            {!isDone && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  title="Označiť ako vybavené"
                                  className="h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-150"
                                  style={{ background: "#16a34a20", color: "#16a34a" }}
                                  onMouseEnter={e => (e.currentTarget.style.background = "#16a34a30")}
                                  onMouseLeave={e => (e.currentTarget.style.background = "#16a34a20")}
                                  onClick={e => { e.stopPropagation(); onMarkInboundCallbackDone?.(cb.id); }}
                                  data-testid={`btn-icb-done-${cb.id}`}
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function ScriptViewer({ script, contact, campaignContactId, campaignId, initialStepId, onAction }: { script: string | null; contact?: Customer | null; campaignContactId?: string | null; campaignId?: string | null; initialStepId?: string | null; onAction?: (action: string, data?: any) => void }) {
  const { user: authUser } = useAuth();
  const SCRIPT_VARIABLES: Record<string, string> = {
    "{{customer.firstName}}": contact?.firstName || "",
    "{{customer.lastName}}": contact?.lastName || "",
    "{{customer.fullName}}": `${contact?.firstName || ""} ${contact?.lastName || ""}`.trim(),
    "{{customer.titleBefore}}": (contact as any)?.titleBefore || "",
    "{{customer.titleAfter}}": (contact as any)?.titleAfter || "",
    "{{customer.email}}": contact?.email || "",
    "{{customer.phone}}": contact?.phone || "",
    "{{customer.address}}": contact?.address || "",
    "{{customer.city}}": contact?.city || "",
    "{{customer.postalCode}}": contact?.postalCode || "",
    "{{customer.country}}": contact?.country || "",
    "{{customer.greeting}}": (contact as any)?.titleBefore
      ? `${(contact as any).titleBefore} ${contact?.lastName || ""}`
      : contact?.lastName || "",
    "{{agent.name}}": authUser?.fullName || authUser?.username || "",
    "{{campaign.name}}": "",
    "{{date.today}}": new Date().toLocaleDateString(),
  };

  const substituteVariables = (text: string): string => {
    if (!text) return text;
    let result = text;
    for (const [key, value] of Object.entries(SCRIPT_VARIABLES)) {
      result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value || key);
    }
    return result;
  };
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [stepHistory, setStepHistory] = useState<number[]>([0]);
  const [stepInitialized, setStepInitialized] = useState(false);

  useEffect(() => {
    setVisitedSteps(prev => {
      const next = new Set(prev);
      next.add(currentStepIndex);
      return next;
    });
  }, [currentStepIndex]);

  useEffect(() => {
    if (!initialStepId || stepInitialized) return;
    try {
      if (!script) return;
      const parsed = JSON.parse(script);
      if (!parsed?.steps) return;
      const idx = parsed.steps.findIndex((s: any) => s.id === initialStepId);
      if (idx >= 0) {
        setCurrentStepIndex(idx);
        setStepHistory([idx]);
        setVisitedSteps(new Set([idx]));
      }
      setStepInitialized(true);
    } catch {}
  }, [initialStepId, script, stepInitialized]);

  const saveScriptStep = useCallback((stepId: string) => {
    if (!campaignContactId || !campaignId) return;
    fetch(`/api/campaigns/${campaignId}/contacts/${campaignContactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ currentScriptStepId: stepId }),
    }).catch(() => {});
  }, [campaignContactId, campaignId]);

  if (!script) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Pre túto kampaň nie je definovaný scenár</p>
        </div>
      </div>
    );
  }

  let parsedScript: ParsedScript | null = null;
  try {
    parsedScript = JSON.parse(script);
  } catch {
    const lines = script.split("\n");
    return (
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Scenár
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100%-2rem)]">
                <div className="space-y-1.5">
                  {lines.map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed text-foreground">{substituteVariables(line) || "\u00A0"}</p>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!parsedScript || !parsedScript.steps || parsedScript.steps.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Scenár neobsahuje žiadne kroky</p>
        </div>
      </div>
    );
  }

  const stepIdToIndex: Record<string, number> = {};
  parsedScript.steps.forEach((s, i) => { stepIdToIndex[s.id] = i; });

  const hasIdBasedNav = parsedScript.steps.some(s => s.nextStepId || s.elements.some(el => el.options?.some(o => o.nextStepId)));

  const currentStep = parsedScript.steps[currentStepIndex];
  const totalSteps = parsedScript.steps.length;

  const handleValueChange = (elementId: string, value: string) => {
    setSelectedValues(prev => ({ ...prev, [elementId]: value }));

    if (currentStep && onAction) {
      const element = currentStep.elements.find((el: any) => el.id === elementId);
      if (element && (element.type === "radio" || element.type === "select" || element.type === "outcome") && element.options) {
        const selectedOpt = element.options.find((o: any) => o.value === value);
        if (selectedOpt?.dispositionCode) {
          onAction("setDisposition", { dispositionCode: selectedOpt.dispositionCode });
        }
      }
    }
  };

  const navigateToStep = (idx: number) => {
    setStepHistory(prev => [...prev, idx]);
    setCurrentStepIndex(idx);
    if (parsedScript?.steps[idx]) {
      saveScriptStep(parsedScript.steps[idx].id);
    }
  };

  const handleStepClick = (idx: number) => {
    navigateToStep(idx);
  };

  const goBack = () => {
    if (stepHistory.length > 1) {
      const newHistory = [...stepHistory];
      newHistory.pop();
      const prevIdx = newHistory[newHistory.length - 1];
      setStepHistory(newHistory);
      setCurrentStepIndex(prevIdx);
    } else {
      setCurrentStepIndex(Math.max(0, currentStepIndex - 1));
    }
  };

  const goNext = () => {
    if (hasIdBasedNav) {
      for (const el of currentStep.elements) {
        if ((el.type === "radio" || el.type === "outcome") && el.options) {
          const selected = selectedValues[el.id];
          if (selected) {
            const opt = el.options.find(o => o.value === selected);
            if (opt?.nextStepId && stepIdToIndex[opt.nextStepId] !== undefined) {
              navigateToStep(stepIdToIndex[opt.nextStepId]);
              return;
            }
          }
        }
      }
      if (currentStep.nextStepId && stepIdToIndex[currentStep.nextStepId] !== undefined) {
        navigateToStep(stepIdToIndex[currentStep.nextStepId]);
        return;
      }
    }
    if (currentStepIndex < totalSteps - 1) {
      navigateToStep(currentStepIndex + 1);
    }
  };

  const renderFormattedText = (text: string) => {
    if (!text) return text;
    if (/<[a-z][\s\S]*>/i.test(text) || /&nbsp;/.test(text)) {
      return <span dangerouslySetInnerHTML={{ __html: text }} />;
    }
    const parts = text.split(/("(?:[^"\\]|\\.)*")/g);
    if (parts.length <= 1) return text;
    return parts.map((part, i) => {
      if (part.startsWith('"') && part.endsWith('"')) {
        return <em key={i}>{part}</em>;
      }
      return part;
    });
  };

  const renderElement = (element: ScriptElement) => {
    switch (element.type) {
      case "heading":
        return (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              {element.label && <h4 className="font-semibold text-primary text-sm">{substituteVariables(element.label)}</h4>}
              {element.content && (
                <p className={`text-foreground text-sm leading-relaxed ${element.label ? "mt-1.5" : ""}`}>{renderFormattedText(substituteVariables(element.content))}</p>
              )}
            </CardContent>
          </Card>
        );

      case "paragraph":
        return (
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="p-4">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">{substituteVariables(element.label)}</label>
              )}
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{renderFormattedText(substituteVariables(element.content || ""))}</p>
            </CardContent>
          </Card>
        );

      case "textInput":
        return (
          <Card>
            <CardContent className="p-4 space-y-2">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <Input
                value={selectedValues[element.id] || ""}
                onChange={(e) => handleValueChange(element.id, e.target.value)}
                placeholder={substituteVariables(element.placeholder || element.content || "")}
                data-testid={`input-script-${element.id}`}
              />
            </CardContent>
          </Card>
        );

      case "emailInput": {
        const emailVal = selectedValues[element.id] || "";
        const emailValid = !emailVal || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
        return (
          <Card>
            <CardContent className="p-4 space-y-2">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <Input
                type="email"
                value={emailVal}
                onChange={(e) => handleValueChange(element.id, e.target.value)}
                placeholder={substituteVariables(element.placeholder || "email@example.com")}
                className={!emailValid ? "border-destructive focus-visible:ring-destructive" : ""}
                data-testid={`input-script-email-${element.id}`}
              />
              {!emailValid && (
                <p className="text-[11px] text-destructive" data-testid={`text-email-error-${element.id}`}>
                  {t.agentWorkspace?.invalidEmail || "Invalid email address"}
                </p>
              )}
            </CardContent>
          </Card>
        );
      }

      case "select":
        if (!element.options) return null;
        return (
          <Card>
            <CardContent className="p-4 space-y-2">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <Select
                value={selectedValues[element.id] || "_none"}
                onValueChange={(v) => handleValueChange(element.id, v)}
              >
                <SelectTrigger data-testid={`select-script-${element.id}`}>
                  <SelectValue placeholder={substituteVariables(element.placeholder || "Vyberte možnosť")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{substituteVariables(element.placeholder || "Vyberte možnosť")}</SelectItem>
                  {element.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        );

      case "radio":
        if (!element.options) return null;
        return (
          <Card>
            <CardContent className="p-4 space-y-3">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <div className="space-y-2">
                {element.options.map((opt) => {
                  const isSelected = selectedValues[element.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleValueChange(element.id, opt.value)}
                      className={`w-full text-left rounded-md p-3 flex items-center gap-3 border transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-primary/40"
                          : "bg-card border-border/50 hover-elevate"
                      }`}
                      data-testid={`btn-script-radio-${opt.value}`}
                    >
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className={`text-sm ${isSelected ? "font-medium text-primary" : "text-foreground"}`}>{opt.label}</span>
                      {opt.nextStepId && isSelected && (
                        <ChevronRight className="h-4 w-4 ml-auto text-primary/60" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );

      case "outcome":
        if (!element.options) return null;
        return (
          <Card>
            <CardContent className="p-4 space-y-3">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                {element.options.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={selectedValues[element.id] === opt.value ? "default" : "outline"}
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => handleValueChange(element.id, opt.value)}
                    data-testid={`btn-script-outcome-${opt.value}`}
                  >
                    {selectedValues[element.id] === opt.value && <CheckCircle className="h-3.5 w-3.5" />}
                    {opt.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case "textarea":
        return (
          <Card>
            <CardContent className="p-4 space-y-2">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <Textarea
                value={selectedValues[element.id] || ""}
                onChange={(e) => handleValueChange(element.id, e.target.value)}
                placeholder={element.placeholder || element.content || ""}
                className="min-h-[80px] resize-none text-sm"
                data-testid={`textarea-script-${element.id}`}
              />
            </CardContent>
          </Card>
        );

      case "checkbox":
        return (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={element.id}
                  checked={selectedValues[element.id] === "true"}
                  onCheckedChange={(checked) => handleValueChange(element.id, checked ? "true" : "false")}
                  data-testid={`checkbox-script-${element.id}`}
                />
                <Label htmlFor={element.id} className="text-sm cursor-pointer">{element.label}</Label>
              </div>
            </CardContent>
          </Card>
        );


      case "action_button": {
        const iconMap: Record<string, any> = { mail: Mail, phone: Phone, calendar: CalendarPlus, file: FileText };
        const ActionIcon = iconMap[element.actionIcon || ""] || null;
        const variantMap: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
          primary: "default", secondary: "secondary", outline: "outline", destructive: "destructive",
        };
        const btnVariant = variantMap[element.variant || ""] || "default";
        return (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-2">
              {element.content && (
                <p className="text-sm text-foreground leading-relaxed">{substituteVariables(element.content)}</p>
              )}
              <Button
                className="w-full gap-2"
                variant={btnVariant}
                onClick={() => {
                  const hasEmailAction = element.action === "openEmail";
                  if (element.action && onAction) {
                    onAction(element.action, { elementId: element.id, stepId: currentStep?.id, emailTemplateId: element.emailTemplateId });
                  }
                  if (element.dispositionCode && onAction) {
                    if (hasEmailAction) {
                      onAction("scheduleCallbackOnly", { elementId: element.id, stepId: currentStep?.id, dispositionCode: element.dispositionCode });
                    } else {
                      onAction("setDisposition", { elementId: element.id, stepId: currentStep?.id, dispositionCode: element.dispositionCode });
                    }
                  }
                }}
                data-testid={`btn-script-action-${element.id}`}
              >
                {ActionIcon && <ActionIcon className="h-4 w-4" />}
                {substituteVariables(element.actionLabel || element.label || "Vykonať akciu")}
              </Button>
            </CardContent>
          </Card>
        );
      }

      case "jump_link": {
        const jumpVariantMap: Record<string, "default" | "outline" | "secondary"> = {
          primary: "default", secondary: "secondary", outline: "outline",
        };
        const jumpBtnVariant = jumpVariantMap[element.variant || ""] || "outline";
        const jumpTargetIdx = element.jumpTargetStepId ? stepIdToIndex[element.jumpTargetStepId] : undefined;
        const isSameStep = !element.jumpTargetStepId;
        const handleJump = () => {
          if (jumpTargetIdx !== undefined) {
            navigateToStep(jumpTargetIdx);
          }
          if (element.anchorId) {
            const delay = isSameStep ? 0 : 100;
            setTimeout(() => {
              const anchorEl = document.querySelector(`[data-anchor-id="${element.anchorId}"]`);
              if (anchorEl) anchorEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }, delay);
          }
        };
        const canJump = isSameStep ? !!element.anchorId : jumpTargetIdx !== undefined;
        return (
          <div>
            {element.variant === "link" ? (
              <button
                className={`text-sm text-primary underline underline-offset-2 flex items-center gap-1.5 transition-colors ${canJump ? "cursor-pointer hover:text-primary/80" : "opacity-50 cursor-not-allowed"}`}
                onClick={canJump ? handleJump : undefined}
                data-testid={`btn-script-jump-${element.id}`}
              >
                <Navigation className="h-3.5 w-3.5" />
                {substituteVariables(element.label || "Jump Link")}
              </button>
            ) : (
              <Button
                variant={jumpBtnVariant}
                size="sm"
                className="gap-1.5"
                disabled={!canJump}
                onClick={handleJump}
                data-testid={`btn-script-jump-${element.id}`}
              >
                <Navigation className="h-3.5 w-3.5" />
                {substituteVariables(element.label || "Jump Link")}
              </Button>
            )}
          </div>
        );
      }

      case "note": {
        const noteStyles: Record<string, string> = {
          info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-300",
          warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-300",
          success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-300",
          error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-300",
        };
        const noteIcons: Record<string, any> = { info: AlertCircle, warning: AlertCircle, success: CheckCircle, error: XCircle };
        const noteVariant = element.style || element.variant || "info";
        const NoteIcon = noteIcons[noteVariant] || AlertCircle;
        return (
          <Card className={noteStyles[noteVariant] || noteStyles.info}>
            <CardContent className="p-4 flex items-start gap-3">
              <NoteIcon className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                {element.label && <p className="text-xs font-semibold uppercase tracking-wide mb-1">{substituteVariables(element.label)}</p>}
                <p className="text-sm leading-relaxed">{substituteVariables(element.content || "")}</p>
              </div>
            </CardContent>
          </Card>
        );
      }

      case "divider":
        return (
          <div className="py-2">
            <Separator className="bg-border" />
          </div>
        );

      default:
        if (element.content || element.label) {
          return (
            <Card>
              <CardContent className="p-4">
                {element.label && (
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{substituteVariables(element.label)}</label>
                )}
                {element.content && (
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{renderFormattedText(substituteVariables(element.content || ""))}</p>
                )}
              </CardContent>
            </Card>
          );
        }
        return null;
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden relative">
      <div className="w-[25%] min-w-[180px] border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kroky</span>
            <Badge variant="secondary" className="text-[10px]" data-testid="badge-script-progress">
              {visitedSteps.size}/{totalSteps}
            </Badge>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {parsedScript.steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => handleStepClick(idx)}
                className={`w-full text-left rounded-md p-2.5 transition-colors flex items-start gap-2.5 ${
                  idx === currentStepIndex
                    ? "bg-primary/10 border border-primary/30"
                    : "hover-elevate border border-transparent"
                }`}
                data-testid={`btn-script-step-${idx}`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  idx === currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : visitedSteps.has(idx)
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {visitedSteps.has(idx) && idx !== currentStepIndex ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-medium leading-tight truncate ${
                    idx === currentStepIndex ? "text-primary" : "text-foreground"
                  }`}>{substituteVariables(step.title)}</p>
                  {step.isEndStep && (
                    <Badge variant="secondary" className="text-[9px] mt-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                      Koniec
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="w-[75%] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {currentStepIndex + 1}
            </div>
            <span className="font-semibold text-sm truncate">{substituteVariables(currentStep.title)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              disabled={currentStepIndex === 0 && stepHistory.length <= 1}
              data-testid="btn-script-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              disabled={currentStepIndex === totalSteps - 1 && !currentStep.nextStepId}
              data-testid="btn-script-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-4">
            {currentStep.description && (
              <Card className="bg-muted/20 border-border/40">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground leading-relaxed italic">{substituteVariables(currentStep.description)}</p>
                </CardContent>
              </Card>
            )}
            {currentStep.elements.map((element) => (
              <div key={element.id} {...(element.type !== "jump_link" && element.anchorId ? { "data-anchor-id": element.anchorId } : {})}>
                {renderElement(element)}
              </div>
            ))}
          </div>
        </ScrollArea>

        {currentStep.isEndStep && (
          <div className="px-4 py-2.5 border-t bg-green-50 dark:bg-green-950/20 text-center">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                Toto je konečný krok scenára
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-3 right-3 z-10">
        <Badge variant="secondary" className="shadow-sm text-[10px] font-mono" data-testid="badge-script-floating-progress">
          {currentStepIndex + 1} / {totalSteps}
        </Badge>
      </div>
    </div>
  );
}

function CommunicationCanvas({
  contact,
  campaign,
  activeChannel,
  onChannelChange,
  timeline,
  onSendEmail,
  onSendSms,
  isSendingEmail,
  isSendingSms,
  onMakeCall,
  isSipRegistered,
  onOpenScriptModal,
  onUpdateContact,
  isUpdatingContact,
  externalPhoneSubTab,
  callState,
  callDuration,
  ringDuration,
  hungUpBy,
  isMuted,
  isOnHold,
  volume,
  micVolume,
  onEndCall,
  onOpenDisposition,
  onToggleMute,
  onToggleHold,
  onSendDtmf,
  onVolumeChange,
  onMicVolumeChange,
  callerNumber,
  contactHistory,
  onOpenHistoryDetail,
  onCreateContract,
  contactType,
  hospitalData,
  clinicData,
  collaboratorData,
  campaignContactId,
  pendingEmailTemplateId,
  onPendingEmailTemplateHandled,
  initialScriptStepId,
  onScriptAction,
  backOfficeModeActive,
  contactCountry,
  ccCallbackNote,
  ccCallbackStatusListItemId,
  onCloseCallAfterStatusList,
  phoneOverride,
  onPhoneOverrideChange,
  onClearContact,
  customerMessages,
  campaignEmailMode,
  campaignEmailAddress,
}: {
  contact: Customer | null;
  campaign: Campaign | null;
  activeChannel: string;
  onChannelChange: (ch: string) => void;
  timeline: TimelineEntry[];
  onSendEmail: (data: { to: string[]; subject: string; body: string; mailboxId?: string | null; cc?: string; documentIds?: string[]; attachments?: { name: string; contentBase64: string; contentType: string }[]; compositionDurationSeconds?: number | null }) => void;
  onSendSms: (data: { to: string[]; message: string; compositionDurationSeconds?: number | null }) => void;
  isSendingEmail: boolean;
  isSendingSms: boolean;
  onMakeCall?: (phoneNumber: string) => void;
  isSipRegistered?: boolean;
  onOpenScriptModal: () => void;
  onUpdateContact?: (data: CustomerFormData) => void;
  isUpdatingContact?: boolean;
  externalPhoneSubTab?: "card" | "details" | "documents" | "history" | null;
  callState?: string;
  callDuration?: number;
  ringDuration?: number;
  hungUpBy?: "user" | "customer" | null;
  isMuted?: boolean;
  isOnHold?: boolean;
  volume?: number;
  micVolume?: number;
  onEndCall?: () => void;
  onOpenDisposition?: () => void;
  onToggleMute?: () => void;
  onToggleHold?: () => void;
  onSendDtmf?: (digit: string) => void;
  onVolumeChange?: (vol: number) => void;
  onMicVolumeChange?: (vol: number) => void;
  callerNumber?: string;
  contactHistory?: ContactHistory[];
  onOpenHistoryDetail?: (entry: TimelineEntry | ContactHistory) => void;
  onCreateContract?: () => void;
  contactType?: string;
  hospitalData?: Hospital | null;
  clinicData?: Clinic | null;
  collaboratorData?: Collaborator | null;
  campaignContactId?: string | null;
  pendingEmailTemplateId?: string | null;
  onPendingEmailTemplateHandled?: () => void;
  initialScriptStepId?: string | null;
  onScriptAction?: (action: string, data?: any) => void;
  backOfficeModeActive?: boolean;
  contactCountry?: string | null;
  ccCallbackNote?: string | null;
  ccCallbackStatusListItemId?: string | null;
  onCloseCallAfterStatusList?: () => void;
  phoneOverride?: string | null;
  onPhoneOverrideChange?: (p: string | null) => void;
  onClearContact?: () => void;
  customerMessages?: any[];
  campaignEmailMode?: "system" | "user" | "custom";
  campaignEmailAddress?: string;
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const smsChatEndRef = useRef<HTMLDivElement>(null);
  const emailChatEndRef = useRef<HTMLDivElement>(null);
  const [smsSearch, setSmsSearch] = useState("");

  useEffect(() => {
    if (activeChannel === "sms") {
      smsChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [contactHistory?.length, customerMessages?.length, activeChannel]);

  useEffect(() => {
    if (activeChannel === "email") {
      emailChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [contactHistory?.length, timeline?.length, activeChannel]);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailIsHtml, setEmailIsHtml] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [selectedFromAccount, setSelectedFromAccount] = useState<string>("");
  const [emailAttachment, setEmailAttachment] = useState<File | null>(null);
  const [templateAttachments, setTemplateAttachments] = useState<{fileName: string; mimeType: string; size: number; contentBase64: string}[]>([]);
  const [emailCc, setEmailCc] = useState("");
  const [showCcField, setShowCcField] = useState(false);
  const [smsCc, setSmsCc] = useState("");
  const [smsCcCountry, setSmsCcCountry] = useState("SK");
  const [showSmsCcField, setShowSmsCcField] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [emailTemplateCategoryId, setEmailTemplateCategoryId] = useState<string>("");
  const [smsTemplateCategoryId, setSmsTemplateCategoryId] = useState<string>("");
  const [emailTemplateSearch, setEmailTemplateSearch] = useState("");
  const [smsTemplateSearch, setSmsTemplateSearch] = useState("");
  const [emailTemplatePopoverOpen, setEmailTemplatePopoverOpen] = useState(false);
  const [smsTemplatePopoverOpen, setSmsTemplatePopoverOpen] = useState(false);
  const [selectedEmailTemplateName, setSelectedEmailTemplateName] = useState("");
  const [selectedSmsTemplateName, setSelectedSmsTemplateName] = useState("");
  const [emailHtmlEditMode, setEmailHtmlEditMode] = useState(false);
  const [emailPreviewExpanded, setEmailPreviewExpanded] = useState(false);
  const [emailTemplateLangs, setEmailTemplateLangs] = useState<Set<string>>(new Set());
  const [smsTemplateLangs, setSmsTemplateLangs] = useState<Set<string>>(new Set());
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [emailOpenedAt, setEmailOpenedAt] = useState<number | null>(null);
  const [smsOpenedAt, setSmsOpenedAt] = useState<number | null>(null);
  const [clChecked, setClChecked] = useState<Set<string>>(new Set());
  const [clYesNo, setClYesNo] = useState<Record<string, "yes" | "no">>({});
  const [clTextValues, setClTextValues] = useState<Record<string, string>>({});
  const [clNotes, setClNotes] = useState<Record<string, string>>({});
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);
  const [dbSlChecked, setDbSlChecked] = useState<Set<string>>(new Set());
  const [slActiveTab, setSlActiveTab] = useState<'acquisition' | 'contract' | 'retention'>('acquisition');
  const { data: dbStatusList = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaign?.id, "status-list"],
    enabled: !!campaign?.id,
  });
  const { data: dbSlState = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaign?.id, "contacts", campaignContactId, "status-list-state"],
    enabled: !!campaign?.id && !!campaignContactId,
  });
  // Resolve each status-list automation's disposition so the "Set status" button can
  // open a reschedule picker for callback-type dispositions (legacy table the builder
  // writes to and the server reads from).
  const { data: slDispositions = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaign?.id, "dispositions-sl"],
    queryFn: () => fetch(`/api/campaigns/${campaign?.id}/dispositions`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(`Request failed: ${r.status}`); return r.json(); }),
    enabled: !!campaign?.id && (dbStatusList as any[]).length > 0,
  });

  const [slRunningOption, setSlRunningOption] = useState<string | null>(null);
  const handleSlOptionSelect = useCallback(async (option: any) => {
    if (!campaign?.id || !campaignContactId) return;
    setSlRunningOption(option.id);
    let isDefinitive = false;
    try {
      for (const automation of (option.automations || [])) {
        const autoId = String(automation.id);
        const res = await apiRequest(
          "POST",
          `/api/campaigns/${campaign.id}/contacts/${campaignContactId}/status-list-actions/${autoId}/run`,
          { callbackDate: null, callbackNote: null, contactCountry: contact?.country ?? null },
        );
        const data = await res.json().catch(() => ({}));
        if (automation.actionType === "set_contact_status" && !data?.callbackDate) {
          isDefinitive = true;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/callbacks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
      toast({ title: option.label, description: "Možnosť vykonaná" });
      if (isDefinitive) {
        onCloseCallAfterStatusList?.();
      }
    } catch {
      toast({ title: "Chyba pri vykonaní možnosti", variant: "destructive" });
    } finally {
      setSlRunningOption(null);
    }
  }, [campaign?.id, campaignContactId, contact?.country, onCloseCallAfterStatusList, toast]);

  useEffect(() => {
    // All rows in dbSlState are confirmed (existence-based model)
    if (dbSlState) {
      const confirmedIds = new Set<string>(
        (dbSlState as any[]).map((s: any) => String(s.statusListItemId))
      );
      setDbSlChecked(confirmedIds);
    }
  }, [dbSlState]);

  // Restore last active tab from localStorage when contact/campaign changes
  useEffect(() => {
    if (!campaign?.id || !campaignContactId) return;
    const stored = localStorage.getItem(`sl-tab-${campaign.id}-${campaignContactId}`);
    if (stored === 'acquisition' || stored === 'contract' || stored === 'retention') {
      setSlActiveTab(stored);
    } else {
      setSlActiveTab('acquisition');
    }
  }, [campaign?.id, campaignContactId]);

  // Auto-run: items with confirmationType === "auto" fire their actions when the
  // status list loads and are hidden from the agent view.
  const slAutoRunRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!Array.isArray(dbStatusList) || !dbStatusList.length || !campaignContactId || !campaign?.id) return;
    const confirmedIds = new Set<string>((dbSlState as any[]).map((s: any) => String(s.statusListItemId)));
    const autoItems = (dbStatusList as any[]).filter((i: any) => i.confirmationType === "auto" && !i.isHidden);
    for (const autoItem of autoItems) {
      const key = `${campaign.id}:${campaignContactId}:${autoItem.id}`;
      if (!confirmedIds.has(String(autoItem.id)) && !slAutoRunRef.current.has(key)) {
        slAutoRunRef.current.add(key);
        void apiRequest("POST", `/api/campaigns/${campaign.id}/contacts/${campaignContactId}/status-list-state/${autoItem.id}`, {
          confirm: true, contactCountry: null,
        });
        for (const auto of (autoItem.automations || [])) {
          handleSlRunAction(auto);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, campaignContactId, dbStatusList, dbSlState]);

  const handleSlToggle = useCallback(async (itemId: string, newChecked: boolean) => {
    setDbSlChecked(prev => {
      const next = new Set(prev);
      if (newChecked) next.add(itemId); else next.delete(itemId);
      return next;
    });
    // Auto-switch to the tab of the item that was just checked
    if (newChecked) {
      const checkedItem = (dbStatusList as any[]).find((i: any) => String(i.id) === itemId);
      if (checkedItem?.tab === 'acquisition' || checkedItem?.tab === 'contract' || checkedItem?.tab === 'retention') {
        const tab = checkedItem.tab as 'acquisition' | 'contract' | 'retention';
        setSlActiveTab(tab);
        if (campaign?.id && campaignContactId) {
          localStorage.setItem(`sl-tab-${campaign.id}-${campaignContactId}`, tab);
        }
      }
    }
    if (!campaign?.id || !campaignContactId) return;
    try {
      await apiRequest("POST", `/api/campaigns/${campaign.id}/contacts/${campaignContactId}/status-list-state/${itemId}`, {
        confirm: newChecked,
        contactCountry: contactCountry ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id, "contacts", campaignContactId, "status-list-state"] });
    } catch {
      setDbSlChecked(prev => {
        const next = new Set(prev);
        if (newChecked) next.delete(itemId); else next.add(itemId);
        return next;
      });
    }
  }, [campaign?.id, campaignContactId, contactCountry, toast]);

  // Manual ("run now") trigger for a single configured status-list automation.
  const [slRunningAuto, setSlRunningAuto] = useState<Set<string>>(new Set());
  const [slQuestionAnswers, setSlQuestionAnswers] = useState<Record<string, any>>({});
  const [slHighlightedStep, setSlHighlightedStep] = useState<string | null>(null);

  const scrollToSlStep = useCallback((targetStepId: string) => {
    const el = document.getElementById(`sl-step-${targetStepId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setSlHighlightedStep(targetStepId);
      setTimeout(() => setSlHighlightedStep(s => s === targetStepId ? null : s), 1800);
    }
  }, []);
  const handleSlRunAction = useCallback(async (automation: any, opts?: { callbackDate?: string; callbackNote?: string }) => {
    if (!campaign?.id || !campaignContactId) return;
    const autoId = String(automation.id);
    setSlRunningAuto(prev => new Set(prev).add(autoId));
    try {
      const res = await apiRequest(
        "POST",
        `/api/campaigns/${campaign.id}/contacts/${campaignContactId}/status-list-actions/${autoId}/run`,
        { callbackDate: opts?.callbackDate ?? null, callbackNote: opts?.callbackNote ?? null, contactCountry: contactCountry ?? null },
      );
      const data = await res.json().catch(() => ({}));
      const okFlag = data?.ok !== false;
      let msg = slt("statusSet", locale);
      if (automation.actionType === "send_email_group") msg = okFlag ? slt("emailSent", locale) : slt("emailFailed", locale);
      else if (automation.actionType === "set_callback") msg = slt("callbackSet", locale);
      else if (automation.actionType === "set_contact_status" && data?.callbackDate) msg = slt("callbackSet", locale);
      toast({ title: msg, variant: okFlag ? undefined : "destructive" });
      // Refresh contact lists/queue so a scheduled callback re-appears and status changes show
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id, "contacts", campaignContactId, "status-list-state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/callbacks"] });
      // The scheduled-call queue (panel + badge) is backed by /api/agent/scheduled-queue,
      // so a status-list set_callback must invalidate it too, otherwise the rescheduled
      // call won't appear until a manual refresh.
      queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
    } catch {
      toast({ title: slt("actionFailed", locale), variant: "destructive" });
    } finally {
      setSlRunningAuto(prev => { const n = new Set(prev); n.delete(autoId); return n; });
    }
  }, [campaign?.id, campaignContactId, contactCountry, locale, toast]);

  // Toggle a status-list question answer locally. For radio fields, clears all
  // other radio answers in the same group first (exclusive-select semantics).
  const handleSlQuestionAnswer = useCallback((q: any, value: any, allGroupQs: any[], groupMode?: string) => {
    const ft = q.fieldType || "checkbox";
    setSlQuestionAnswers(prev => {
      const next = { ...prev };
      if (ft === "radio") {
        allGroupQs.filter((gq: any) => (gq.fieldType || "checkbox") === "radio")
          .forEach((gq: any) => { delete next[gq.id]; });
      } else if (groupMode === "ONE") {
        allGroupQs.forEach((gq: any) => { delete next[gq.id]; });
      }
      if ((ft === "checkbox" || ft === "radio") && next[q.id] === value) {
        delete next[q.id];
      } else if (groupMode === "ONE" && prev[q.id] !== undefined) {
        // was answered → keep cleared (deselect completed above)
      } else {
        next[q.id] = value;
      }
      return next;
    });
  }, []);

  const [phoneSubTab, setPhoneSubTab] = useState<"card" | "details" | "documents" | "sop" | "history">(externalPhoneSubTab || "card");
  const localPhoneOverride = phoneOverride ?? null;
  const lastAutoSavedPhoneRef = useRef<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    const entityPhone = clinicData?.phone || collaboratorData?.phone || null;
    lastAutoSavedPhoneRef.current = entityPhone;
    setAutoSaveStatus("idle");
  }, [contact?.id, clinicData?.id, collaboratorData?.id]);

  useEffect(() => {
    if (!phoneOverride || phoneOverride === lastAutoSavedPhoneRef.current) return;
    const timer = setTimeout(async () => {
      if (!phoneOverride || phoneOverride === lastAutoSavedPhoneRef.current) return;
      let url = "";
      let method = "PATCH";
      if (clinicData) { url = `/api/clinics/${clinicData.id}`; method = "PUT"; }
      else if (collaboratorData) { url = `/api/collaborators/${collaboratorData.id}`; method = "PUT"; }
      else if (contact) { url = `/api/customers/${contact.id}`; method = "PATCH"; }
      if (!url) return;
      setAutoSaveStatus("saving");
      try {
        const r = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone: phoneOverride }),
        });
        if (r.ok) {
          lastAutoSavedPhoneRef.current = phoneOverride;
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus("idle"), 2500);
        } else {
          setAutoSaveStatus("idle");
        }
      } catch {
        setAutoSaveStatus("idle");
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [phoneOverride, clinicData?.id, collaboratorData?.id, contact?.id]);

  const handleManualSavePhone = async () => {
    if (!localPhoneOverride) return;
    let url = "";
    let method = "PATCH";
    if (clinicData) { url = `/api/clinics/${clinicData.id}`; method = "PUT"; }
    else if (collaboratorData) { url = `/api/collaborators/${collaboratorData.id}`; method = "PUT"; }
    else if (contact) { url = `/api/customers/${contact.id}`; method = "PATCH"; }
    if (!url) return;
    setAutoSaveStatus("saving");
    try {
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: localPhoneOverride }),
      });
      if (r.ok) {
        lastAutoSavedPhoneRef.current = localPhoneOverride;
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2500);
      } else {
        setAutoSaveStatus("idle");
      }
    } catch {
      setAutoSaveStatus("idle");
    }
  };

  useEffect(() => {
    if (externalPhoneSubTab) {
      setPhoneSubTab(externalPhoneSubTab);
    }
  }, [externalPhoneSubTab]);

  useEffect(() => {
    setPhoneSubTab("card");
    setSelectedEmails(contact?.email ? [contact.email] : []);
    setSelectedPhones(contact?.phone ? [contact.phone] : []);
    setEmailSubject("");
    setEmailMessage("");
    setEmailIsHtml(false);
    setSmsMessage("");
    setSelectedFromAccount("");
    setEmailAttachment(null);
    setTemplateAttachments([]);
    setEmailCc("");
    setShowCcField(false);
    setSmsCc("");
    setShowSmsCcField(false);
    setSelectedDocuments([]);
    setDbSlChecked(new Set());
    setSlQuestionAnswers({});
  }, [contact?.id]);

  // Auto-select phone when it loads after contact (lazy hydration)
  useEffect(() => {
    if (contact?.phone) {
      setSelectedPhones(prev => prev.length === 0 ? [contact.phone!] : prev);
    }
  }, [contact?.phone]);

  useEffect(() => {
    if (activeChannel === "email") {
      setEmailOpenedAt(Date.now());
      if (contact?.email) {
        setSelectedEmails([contact.email]);
      }
    } else if (activeChannel === "sms") {
      setSmsOpenedAt(Date.now());
      if (contact?.phone) {
        setSelectedPhones([contact.phone]);
      }
    }
  }, [activeChannel, contact?.id]);

  const emailDefaultAppliedRef = useRef<string | null>(null);
  const smsDefaultAppliedRef = useRef<string | null>(null);

  const { data: allEmailTemplatesRaw = [] } = useQuery<{ id: string; name: string; subject: string | null; content: string; contentHtml: string | null; categoryId: string | null; language: string | null }[]>({
    queryKey: ["/api/message-templates", "email"],
    queryFn: async () => {
      const res = await fetch(`/api/message-templates?type=email&isActive=true`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!contact,
  });

  const { data: allSmsTemplatesRaw = [] } = useQuery<{ id: string; name: string; content: string; categoryId: string | null; language: string | null }[]>({
    queryKey: ["/api/message-templates", "sms"],
    queryFn: async () => {
      const res = await fetch(`/api/message-templates?type=sms&isActive=true`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!contact,
  });

  const emailTemplates = useMemo(() => {
    if (emailTemplateLangs.size === 0) return allEmailTemplatesRaw;
    return allEmailTemplatesRaw.filter(t => !t.language || emailTemplateLangs.has(t.language));
  }, [allEmailTemplatesRaw, emailTemplateLangs]);

  const smsTemplates = useMemo(() => {
    if (smsTemplateLangs.size === 0) return allSmsTemplatesRaw;
    return allSmsTemplatesRaw.filter(t => !t.language || smsTemplateLangs.has(t.language));
  }, [allSmsTemplatesRaw, smsTemplateLangs]);

  useEffect(() => {
    emailDefaultAppliedRef.current = null;
    smsDefaultAppliedRef.current = null;
  }, [contact?.id]);

  const timelineEndRef = useRef<HTMLDivElement>(null);
  const clLoadedForContactRef = useRef<string | null>(null);

  type WsCLItemType = "checkbox" | "yes_no" | "text";
  type WsCLAutomation = "none" | "openDisposition" | "switchEmail" | "switchSms";
  type WsCLItemSize = "sm" | "base" | "lg";
  interface WsCLItem { id: string; label: string; type: WsCLItemType; required: boolean; hasNotes: boolean; automationAction: WsCLAutomation; bold?: boolean; italic?: boolean; size?: WsCLItemSize; }
  interface WsCLSubsection { id: string; title: string; icon?: string; bold?: boolean; italic?: boolean; color?: string; selectionMode?: "or" | "and"; items: WsCLItem[]; }
  interface WsCLSection { id: string; title: string; icon?: string; bold?: boolean; italic?: boolean; color?: string; selectionMode?: "or" | "and"; subsections: WsCLSubsection[]; items: WsCLItem[]; }
  interface WsCLConfig { enabled: boolean; sections: WsCLSection[]; }

  const WS_CL_ICON_MAP: Record<string, LucideIcon> = {
    CheckCircle2, Phone, Mail, User, Calendar, Heart, Shield, FileText, Star, Flag, Target, Home, MapPin, Bell, Send, Briefcase, Stethoscope, ClipboardCheck, AlertCircle, Info, DollarSign, TrendingUp, BookOpen, MessageCircle, ListChecks, Zap, Eye, UserCheck, Building2, CalendarCheck, PhoneCall,
  };
  const WsClIcon = ({ name, className, style }: { name?: string; className?: string; style?: CSSProperties }) => {
    if (!name) return null;
    const Ic = WS_CL_ICON_MAP[name];
    if (Ic) return <Ic className={className || "h-4 w-4"} style={style} />;
    return <span className={`leading-none select-none ${className || ""}`} style={style}>{name}</span>;
  };

  const internalChecklistConfig = useMemo((): WsCLConfig => {
    try {
      const s = JSON.parse(campaign?.settings || "{}");
      const ic = s.internalChecklist || {};
      const mi = (i: any): WsCLItem => ({ id: i.id || crypto.randomUUID(), label: i.label || "", type: (i.type || "checkbox") as WsCLItemType, required: !!i.required, hasNotes: !!i.hasNotes, automationAction: (i.automationAction || "none") as WsCLAutomation, bold: !!i.bold, italic: !!i.italic, size: (i.size || "base") as WsCLItemSize });
      if (ic.items && !ic.sections) {
        return { enabled: ic.enabled === true, sections: ic.items.length > 0 ? [{ id: "default", title: "Status list", icon: "", bold: false, italic: false, color: "", subsections: [], items: ic.items.map(mi) }] : [] };
      }
      return {
        enabled: ic.enabled === true,
        sections: (ic.sections || []).map((sec: any) => ({
          id: sec.id, title: sec.title || "Sekcia", icon: sec.icon || "", bold: !!sec.bold, italic: !!sec.italic, color: sec.color || "",
          selectionMode: (sec.selectionMode === "or" ? "or" : "and") as "or" | "and",
          subsections: (sec.subsections || []).map((sub: any) => ({ id: sub.id, title: sub.title || "Podsekcia", icon: sub.icon || "", bold: !!sub.bold, italic: !!sub.italic, color: sub.color || "", selectionMode: (sub.selectionMode === "or" ? "or" : "and") as "or" | "and", items: (sub.items || []).map(mi) })),
          items: (sec.items || []).map(mi),
        })),
      };
    } catch { return { enabled: false, sections: [] }; }
  }, [campaign?.settings]);

  const showScript = useMemo(() => {
    try { return JSON.parse(campaign?.settings || "{}").showScript !== false; } catch { return true; }
  }, [campaign?.settings]);

  useEffect(() => {
    setClChecked(new Set());
    setClYesNo({});
    setClTextValues({});
    setClNotes({});
    clLoadedForContactRef.current = null;
  }, [contact?.id]);

  useEffect(() => {
    if (!contact?.id || clLoadedForContactRef.current === contact?.id) return;
    const clEntries = (contactHistory || []).filter((h: any) => h.action === "checklist_response");
    if (clEntries.length === 0) return;
    const latest = clEntries[0];
    const sections: any[] = latest.metadata?.sections || [];
    const allItems = sections.flatMap((s: any) => [
      ...(s.items || []),
      ...(s.subsections || []).flatMap((sub: any) => sub.items || []),
    ]);
    const newChecked = new Set<string>();
    const newYesNo: Record<string, "yes" | "no"> = {};
    const newTextValues: Record<string, string> = {};
    const newNotes: Record<string, string> = {};
    for (const item of allItems) {
      if (item.type === "checkbox" && item.checked) newChecked.add(item.id);
      if (item.type === "yes_no" && (item.answer === "yes" || item.answer === "no")) newYesNo[item.id] = item.answer;
      if (item.type === "text" && item.value) newTextValues[item.id] = item.value;
      if (item.note) newNotes[item.id] = item.note;
    }
    setClChecked(newChecked);
    setClYesNo(newYesNo);
    setClTextValues(newTextValues);
    setClNotes(newNotes);
    clLoadedForContactRef.current = contact?.id;
  }, [contactHistory, contact?.id]);


  const getCustomerLanguage = (customer: Customer | null): string => {
    if (!customer?.country) return "sk";
    const normalizedCountry = customer.country.toUpperCase();
    return COUNTRY_TO_LOCALE[normalizedCountry] || "sk";
  };

  const language = getCustomerLanguage(contact);

  const { data: sharedMailboxes = [] } = useQuery<{ id: string; email: string; displayName: string; isDefault: boolean }[]>({
    queryKey: ["/api/users", user?.id, "ms365-shared-mailboxes"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/users/${user.id}/ms365-shared-mailboxes`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: personalMs365 } = useQuery<{ email: string; displayName: string; hasTokens: boolean } | null>({
    queryKey: ["/api/users", user?.id, "ms365-connection"],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/users/${user.id}/ms365-connection`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id,
  });

  const allEmailAccounts = useMemo(() => {
    const accounts: { id: string; email: string; displayName: string; type: string; isDefault: boolean }[] = [];
    if (personalMs365?.hasTokens && personalMs365?.email) {
      accounts.push({ id: "personal", email: personalMs365.email, displayName: personalMs365.displayName || personalMs365.email, type: "personal", isDefault: false });
    }
    sharedMailboxes.forEach(mailbox => {
      accounts.push({ id: mailbox.id, email: mailbox.email, displayName: mailbox.displayName || mailbox.email, type: "shared", isDefault: mailbox.isDefault });
    });
    return accounts;
  }, [personalMs365, sharedMailboxes]);

  useEffect(() => {
    if (contact && allEmailAccounts.length > 0 && !selectedFromAccount) {
      const defaultMailbox = allEmailAccounts.find(m => m.isDefault);
      if (defaultMailbox) {
        setSelectedFromAccount(defaultMailbox.id || "");
      } else if (allEmailAccounts[0]) {
        setSelectedFromAccount(allEmailAccounts[0].id || "");
      }
    }
  }, [contact, allEmailAccounts, selectedFromAccount]);

  useEffect(() => {
    if (campaignEmailMode === "system") {
      setSelectedFromAccount("system");
    } else if (campaignEmailMode === "user") {
      setSelectedFromAccount("personal");
    } else if (campaignEmailMode === "custom" && campaignEmailAddress) {
      const match = allEmailAccounts.find(a => a.email.toLowerCase() === campaignEmailAddress.toLowerCase());
      if (match) setSelectedFromAccount(match.id || "personal");
    }
  }, [campaignEmailMode, campaignEmailAddress, allEmailAccounts]);

  const { data: templateCategories = [] } = useQuery<{ id: string; name: string; icon: string | null; color: string | null; isActive: boolean }[]>({
    queryKey: ["/api/template-categories"],
    enabled: !!contact,
  });

  useEffect(() => {
    if (language) {
      setEmailTemplateLangs(new Set([language]));
      setSmsTemplateLangs(new Set([language]));
    }
  }, [language]);

  const emailCategoriesWithTemplates = useMemo(() => {
    const catIds = new Set(emailTemplates.map(t => t.categoryId).filter(Boolean));
    return templateCategories.filter(c => c.isActive && catIds.has(c.id));
  }, [templateCategories, emailTemplates]);

  const smsCategoriesWithTemplates = useMemo(() => {
    const catIds = new Set(smsTemplates.map(t => t.categoryId).filter(Boolean));
    return templateCategories.filter(c => c.isActive && catIds.has(c.id));
  }, [templateCategories, smsTemplates]);

  const filteredEmailTemplates = useMemo(() => {
    let list = emailTemplates;
    if (emailTemplateCategoryId && emailTemplateCategoryId !== "__all__") {
      list = list.filter(t => t.categoryId === emailTemplateCategoryId);
    }
    if (emailTemplateSearch.trim()) {
      const q = emailTemplateSearch.trim().toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [emailTemplates, emailTemplateCategoryId, emailTemplateSearch]);

  const filteredSmsTemplates = useMemo(() => {
    let list = smsTemplates;
    if (smsTemplateCategoryId && smsTemplateCategoryId !== "__all__") {
      list = list.filter(t => t.categoryId === smsTemplateCategoryId);
    }
    if (smsTemplateSearch.trim()) {
      const q = smsTemplateSearch.trim().toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [smsTemplates, smsTemplateCategoryId, smsTemplateSearch]);

  const { data: customerDocuments = [] } = useQuery<{ id: string; name: string; type: string; url: string }[]>({
    queryKey: ["/api/customers", contact?.id, "documents-for-email"],
    queryFn: async () => {
      if (!contact?.id) return [];
      const res = await fetch(`/api/customers/${contact.id}/documents`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      const docs: { id: string; name: string; type: string; url: string }[] = [];
      if (Array.isArray(data)) {
        data.forEach((doc: any) => {
          if (doc.type === "contract" && doc.pdfPath) {
            docs.push({ id: `contract-${doc.id}`, name: `${t.contracts?.title || "Zmluva"} ${doc.number || String(doc.id)}`, type: "contract", url: `/api/contract-instances/${doc.id}/pdf` });
          } else if (doc.type === "invoice" && doc.pdfPath) {
            docs.push({ id: `invoice-${doc.id}`, name: `${t.invoices?.title || "Faktúra"} ${doc.number || String(doc.id)}`, type: "invoice", url: `/api/invoices/${doc.id}/pdf` });
          }
        });
      }
      return docs;
    },
    enabled: !!contact?.id,
  });

  const replaceTemplateVars = useCallback((content: string): string => {
    if (!content) return content;
    const selectedAccount = allEmailAccounts.find(a => a.id === selectedFromAccount);
    const userPhone = user?.phone ? `${(user as any)?.phonePrefix || ""}${user.phone}` : "";
    const now = new Date();
    const cl = clinicData as any;
    const hosp = hospitalData as any;
    const collab = collaboratorData as any;
    const doctorFullName = cl ? `${cl.doctorTitle || ""} ${cl.doctorFirstName || ""} ${cl.doctorLastName || ""}`.replace(/\s+/g, " ").trim() : "";
    const replacements: Record<string, string> = {
      "{{customer.firstName}}": contact?.firstName || "",
      "{{customer.lastName}}": contact?.lastName || "",
      "{{customer.fullName}}": contact ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim() : "",
      "{{customer.email}}": contact?.email || "",
      "{{customer.email2}}": (contact as any)?.email2 || "",
      "{{customer.phone}}": contact?.phone || "",
      "{{customer.phone2}}": (contact as any)?.phone2 || "",
      "{{customer.address}}": contact?.address || "",
      "{{customer.city}}": contact?.city || "",
      "{{customer.postalCode}}": contact?.postalCode || "",
      "{{customer.country}}": contact?.country || "",
      "{{customer.birthDate}}": (contact as any)?.birthDate || "",
      "{{customer.deliveryDate}}": (contact as any)?.deliveryDate || "",
      "{{user.fullName}}": user?.fullName || "",
      "{{user.email}}": selectedAccount?.email || user?.email || "",
      "{{user.phone}}": userPhone,
      "{{user.position}}": (user as any)?.position || "",
      "{{user.signature}}": (user as any)?.signature || "",
      "{{clinic.name}}": cl?.clinicName || cl?.name || "",
      "{{clinic.doctorName}}": doctorFullName,
      "{{clinic.doctorTitle}}": cl?.doctorTitle || "",
      "{{clinic.doctorFirstName}}": cl?.doctorFirstName || "",
      "{{clinic.doctorLastName}}": cl?.doctorLastName || "",
      "{{clinic.address}}": cl?.address || "",
      "{{clinic.city}}": cl?.city || "",
      "{{clinic.postalCode}}": cl?.postalCode || "",
      "{{clinic.countryCode}}": cl?.countryCode || "",
      "{{clinic.phone}}": cl?.phone || "",
      "{{clinic.email}}": cl?.email || "",
      "{{clinic.website}}": cl?.website || "",
      "{{clinic.notes}}": cl?.notes || "",
      "{{clinic.contractStatus}}": cl?.contractStatus || "",
      "{{hospital.name}}": hosp?.name || "",
      "{{hospital.fullName}}": hosp?.fullName || hosp?.name || "",
      "{{hospital.streetNumber}}": hosp?.streetNumber || "",
      "{{hospital.city}}": hosp?.city || "",
      "{{hospital.postalCode}}": hosp?.postalCode || "",
      "{{hospital.region}}": hosp?.region || "",
      "{{hospital.countryCode}}": hosp?.countryCode || "",
      "{{hospital.contactPerson}}": hosp?.contactPerson || "",
      "{{hospital.phone}}": hosp?.phone || "",
      "{{hospital.email}}": hosp?.email || "",
      "{{collaborator.titleBefore}}": collab?.titleBefore || (collab ? "MUDr." : ""),
      "{{collaborator.firstName}}": collab?.firstName || "",
      "{{collaborator.lastName}}": collab?.lastName || "",
      "{{collaborator.titleAfter}}": collab?.titleAfter || "",
      "{{collaborator.fullName}}": collab ? `${collab.titleBefore || "MUDr."} ${collab.firstName || ""} ${collab.lastName || ""} ${collab.titleAfter || ""}`.replace(/\s+/g, " ").trim() : "",
      "{{collaborator.phone}}": collab?.phone || "",
      "{{collaborator.mobile}}": collab?.mobile || "",
      "{{collaborator.email}}": collab?.email || "",
      "{{collaborator.companyName}}": collab?.companyName || "",
      "{{system.today}}": now.toLocaleDateString("sk-SK"),
      "{{date.today}}": now.toLocaleDateString("sk-SK"),
      "{{system.currentDate}}": now.toLocaleDateString("sk-SK"),
      "{{system.currentTime}}": now.toLocaleTimeString("sk-SK"),
      "{{system.currentDateTime}}": now.toLocaleString("sk-SK"),
      "{{system.year}}": now.getFullYear().toString(),
      "{{system.month}}": (now.getMonth() + 1).toString().padStart(2, "0"),
      "{{system.day}}": now.getDate().toString().padStart(2, "0"),
      "{{company.name}}": "Cord Blood Center Group",
      "{{company.address}}": "Gallayova 11, 841 02 Bratislava",
      "{{company.phone}}": "+421 2 59 200 700",
      "{{company.email}}": "info@cordbloodcenter.com",
      "{{company.web}}": "www.cordbloodcenter.com",
    };
    let result = content;
    for (const [variable, value] of Object.entries(replacements)) {
      result = result.split(variable).join(value);
    }
    result = result.replace(/\{\{[^}]+\}\}/g, "");
    return result;
  }, [contact, user, allEmailAccounts, selectedFromAccount, clinicData, hospitalData, collaboratorData]);

  const applyEmailTemplate = useCallback((template: any) => {
    const subject = replaceTemplateVars(template.subject || "");
    const hasHtmlContent = !!(template.contentHtml && template.contentHtml.trim().length > 0);
    const contentLooksLikeHtml = !!(template.content && /<[a-zA-Z][^>]*>/.test(template.content));
    const formatIsHtml = !!(template.format && template.format.toLowerCase() === "html");
    const isHtml = formatIsHtml || hasHtmlContent || contentLooksLikeHtml;
    // Prefer contentHtml if present; otherwise fall back to content (may contain HTML tags)
    const rawContent = isHtml ? (template.contentHtml || template.content || "") : (template.content || "");
    const content = replaceTemplateVars(rawContent);
    setEmailSubject(subject);
    setEmailMessage(content);
    setEmailIsHtml(isHtml);
    setEmailHtmlEditMode(false);
    setSelectedEmailTemplateName(template.name);
    setEmailTemplateSearch("");
    setEmailTemplatePopoverOpen(false);
    fetch(`/api/message-templates/${template.id}/use`, { method: "POST", credentials: "include" });

    if (template.attachments?.length > 0) {
      fetch(`/api/message-templates/${template.id}/attachments`, { credentials: "include" })
        .then(r => r.json())
        .then((atts: any[]) => {
          const valid = atts.filter((a: any) => a.contentBase64 && !a.error);
          setTemplateAttachments(valid);
        })
        .catch(() => setTemplateAttachments([]));
    } else {
      setTemplateAttachments([]);
    }
  }, [replaceTemplateVars]);

  useEffect(() => {
    if (activeChannel !== "email" && activeChannel !== "sms") return;
    if (!campaign?.id) return;
    try {
      const settings = JSON.parse(campaign.settings || "{}");
      if (activeChannel === "email") {
        const key = `${contact?.id ?? ""}-${campaign.id}-email`;
        if (emailDefaultAppliedRef.current === key) return;
        if (settings.defaultEmailCategoryId) {
          setEmailTemplateCategoryId(settings.defaultEmailCategoryId);
        }
        if (settings.defaultEmailTemplateId && emailTemplates.length > 0) {
          const tmpl = emailTemplates.find(t => t.id === settings.defaultEmailTemplateId);
          if (tmpl) {
            applyEmailTemplate(tmpl);
            emailDefaultAppliedRef.current = key;
          }
        } else if (!settings.defaultEmailTemplateId && settings.defaultEmailCategoryId) {
          emailDefaultAppliedRef.current = key;
        }
      } else if (activeChannel === "sms") {
        const key = `${contact?.id ?? ""}-${campaign.id}-sms`;
        if (smsDefaultAppliedRef.current === key) return;
        if (settings.defaultSmsCategoryId) {
          setSmsTemplateCategoryId(settings.defaultSmsCategoryId);
        }
        if (settings.defaultSmsTemplateId && smsTemplates.length > 0) {
          const tmpl = smsTemplates.find(t => t.id === settings.defaultSmsTemplateId);
          if (tmpl) {
            const content = replaceTemplateVars(tmpl.content || "");
            setSmsMessage(content);
            setSelectedSmsTemplateName(tmpl.name);
            setSmsTemplateSearch("");
            setSmsTemplatePopoverOpen(false);
            fetch(`/api/message-templates/${tmpl.id}/use`, { method: "POST", credentials: "include" });
            smsDefaultAppliedRef.current = key;
          }
        } else if (!settings.defaultSmsTemplateId && settings.defaultSmsCategoryId) {
          smsDefaultAppliedRef.current = key;
        }
      }
    } catch {}
  }, [activeChannel, contact?.id, campaign?.id, campaign?.settings, emailTemplates, smsTemplates, applyEmailTemplate, replaceTemplateVars]);

  const handleSelectEmailTemplate = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      applyEmailTemplate(template);
    }
  };

  const handleScriptEmailTemplate = useCallback((templateId: string) => {
    const template = allEmailTemplatesRaw.find(t => t.id === templateId);
    if (template) {
      applyEmailTemplate(template);
      return;
    }
    fetch(`/api/message-templates/${templateId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(t => { if (t) applyEmailTemplate(t); })
      .catch(() => {});
  }, [allEmailTemplatesRaw, applyEmailTemplate]);

  useEffect(() => {
    if (pendingEmailTemplateId) {
      handleScriptEmailTemplate(pendingEmailTemplateId);
      onPendingEmailTemplateHandled?.();
    }
  }, [pendingEmailTemplateId]);

  const handleSelectSmsTemplate = (templateId: string) => {
    const template = smsTemplates.find(t => t.id === templateId);
    if (template) {
      const content = replaceTemplateVars(template.content || "");
      setSmsMessage(content);
      setSelectedSmsTemplateName(template.name);
      setSmsTemplateSearch("");
      setSmsTemplatePopoverOpen(false);
      fetch(`/api/message-templates/${templateId}/use`, { method: "POST", credentials: "include" });
    }
  };

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline.length]);

  const handleSendEmail = async () => {
    if (selectedEmails.length === 0 || !emailSubject || !emailMessage) {
      toast({ title: t.common.error, description: t.customers?.details?.fillAllFields || "Vyplňte všetky povinné polia", variant: "destructive" });
      return;
    }
    let pcAttachments: Array<{ name: string; contentType: string; contentBase64: string }> = [];
    if (emailAttachment) {
      const fileBuffer = await emailAttachment.arrayBuffer();
      const base64 = btoa(new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      pcAttachments.push({ name: emailAttachment.name, contentType: emailAttachment.type || 'application/octet-stream', contentBase64: base64 });
    }
    for (const ta of templateAttachments) {
      pcAttachments.push({ name: ta.fileName, contentType: ta.mimeType, contentBase64: ta.contentBase64 });
    }
    const compositionDurationSeconds = emailOpenedAt ? Math.round((Date.now() - emailOpenedAt) / 1000) : null;
    onSendEmail({
      to: selectedEmails,
      subject: emailSubject,
      body: emailMessage,
      mailboxId: selectedFromAccount === "personal" ? null : selectedFromAccount || null,
      cc: emailCc.trim() || undefined,
      documentIds: selectedDocuments.length > 0 ? selectedDocuments : undefined,
      attachments: pcAttachments.length > 0 ? pcAttachments : undefined,
      compositionDurationSeconds,
    });
    setEmailSubject("");
    setEmailMessage("");
    setEmailIsHtml(false);
    setSelectedEmails([]);
    setEmailAttachment(null);
    setTemplateAttachments([]);
    setEmailCc("");
    setShowCcField(false);
    setSelectedDocuments([]);
    setEmailOpenedAt(null);
  };

  const handleSendSms = async () => {
    const allPhones = [...selectedPhones];
    if (smsCc.trim()) allPhones.push(smsCc.trim());
    if (allPhones.length === 0 || !smsMessage) {
      toast({ title: t.common.error, description: t.customers?.details?.fillAllFields || "Vyplňte všetky povinné polia", variant: "destructive" });
      return;
    }
    const compositionDurationSeconds = smsOpenedAt ? Math.round((Date.now() - smsOpenedAt) / 1000) : null;
    onSendSms({ to: allPhones, message: smsMessage, compositionDurationSeconds });
    setSmsMessage("");
    setSelectedPhones([]);
    setSmsCc("");
    setShowSmsCcField(false);
    setSmsOpenedAt(null);
  };

  const smsCharCount = smsMessage.length;
  const smsCount = Math.ceil(smsCharCount / 160) || 1;

  const mergedHistory = useMemo(() => {
    const historyItems = (contactHistory || []);
    const timelineIds = new Set(timeline.map(t => t.id));
    const persistentAsTimeline: TimelineEntry[] = historyItems
      .filter(h => !timelineIds.has(h.id))
      .map(h => ({
        id: h.id,
        type: h.type === "disposition" ? "system" as const : h.type as TimelineEntry["type"],
        direction: h.direction,
        timestamp: new Date(h.date),
        content: h.content || h.notes || "",
        details: h.details || h.campaignName || "",
        status: h.status,
        htmlBody: h.htmlBody,
        fullContent: h.fullContent,
        agentName: h.agentName,
        recipientEmail: h.recipientEmail,
        recipientPhone: h.recipientPhone,
        sentiment: h.sentiment || null,
        callLogId: (h as any).callLogId || null,
      }));
    const all = [...timeline, ...persistentAsTimeline];
    return {
      all: all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      email: all.filter(e => e.type === "email").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      sms: all.filter(e => e.type === "sms").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    };
  }, [timeline, contactHistory]);

  const unreadEmailCount = useMemo(() => {
    const inbound = mergedHistory.email.filter(e => e.direction === "inbound");
    if (!emailOpenedAt) return inbound.length;
    return inbound.filter(e => new Date(e.timestamp).getTime() > emailOpenedAt).length;
  }, [mergedHistory.email, emailOpenedAt]);

  const unreadSmsCount = useMemo(() => {
    const inbound = (customerMessages || []).filter(m => m.direction === "inbound");
    if (!smsOpenedAt) return inbound.length;
    return inbound.filter(m => new Date(m.date).getTime() > smsOpenedAt).length;
  }, [customerMessages, smsOpenedAt]);

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-rose-50 via-orange-50/80 to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900" style={{ contain: 'paint' }}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -left-10 w-[420px] h-[420px] rounded-[60%_40%_30%_70%/60%_30%_70%_40%] bg-gradient-to-br from-rose-300/40 via-pink-200/30 to-rose-400/20 dark:from-rose-700/15 dark:via-pink-700/10 dark:to-rose-600/8 blur-3xl" />
          <div className="absolute top-[15%] right-[5%] w-[380px] h-[380px] rounded-[40%_60%_70%_30%/50%_60%_30%_60%] bg-gradient-to-bl from-orange-300/35 via-amber-200/25 to-yellow-300/20 dark:from-orange-700/12 dark:via-amber-700/8 dark:to-yellow-700/6 blur-3xl" />
          <div className="absolute bottom-[0%] left-[10%] w-[450px] h-[450px] rounded-[50%_60%_30%_60%/40%_70%_50%_60%] bg-gradient-to-tr from-amber-300/30 via-orange-200/25 to-rose-300/20 dark:from-amber-700/10 dark:via-orange-700/8 dark:to-rose-700/6 blur-3xl" />
          <div className="absolute top-[55%] right-[20%] w-[350px] h-[350px] rounded-[60%_40%_60%_40%/50%_60%_30%_70%] bg-gradient-to-tl from-pink-300/30 via-rose-200/20 to-orange-200/15 dark:from-pink-700/10 dark:via-rose-700/6 dark:to-orange-700/5 blur-3xl" />
          <div className="absolute -top-5 right-[35%] w-[320px] h-[320px] rounded-[30%_60%_40%_70%/60%_40%_70%_30%] bg-gradient-to-b from-yellow-200/30 via-amber-200/20 to-orange-300/25 dark:from-yellow-700/8 dark:via-amber-700/6 dark:to-orange-700/8 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] h-[140px] rounded-full border-2 border-rose-300/30 dark:border-rose-600/15 animate-ping" style={{ animationDuration: '4s' }} />
          <div className="absolute top-[35%] left-[40%] w-[100px] h-[100px] rounded-full border-2 border-orange-300/25 dark:border-orange-600/10 animate-ping" style={{ animationDuration: '5s', animationDelay: '1.5s' }} />
          <div className="absolute top-[55%] left-[55%] w-[120px] h-[120px] rounded-full border-2 border-amber-300/25 dark:border-amber-600/10 animate-ping" style={{ animationDuration: '6s', animationDelay: '3s' }} />
          <div className="absolute top-[30%] left-[55%] w-[80px] h-[80px] rounded-full border border-pink-300/20 dark:border-pink-600/10 animate-ping" style={{ animationDuration: '7s', animationDelay: '0.5s' }} />
          <div className="absolute top-[60%] left-[35%] w-[90px] h-[90px] rounded-full border border-rose-200/20 dark:border-rose-700/10 animate-ping" style={{ animationDuration: '5.5s', animationDelay: '2.5s' }} />
        </div>
        <div className="text-center max-w-sm relative z-10">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-white/70 dark:bg-card/60 shadow-lg shadow-rose-200/20 dark:shadow-none border border-white/60 dark:border-white/10 flex items-center justify-center">
            <Headphones className="h-11 w-11 text-primary/40" />
          </div>
          <h3 className="font-semibold text-xl mb-2 text-foreground/70">{t.agentWorkspace.readyToWork}</h3>
          <p className="text-sm text-muted-foreground/70 leading-relaxed">
            {t.agentWorkspace.readyToWorkDesc}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-background dark:bg-slate-900">
      <div className="h-12 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 relative z-10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="font-semibold text-sm" data-testid="text-canvas-contact-name">
              {contact.firstName} {contact.lastName}
            </span>
          </div>
          {campaign && (
            <>
              <Separator orientation="vertical" className="h-5 shrink-0" />
              <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                <Megaphone className="h-3.5 w-3.5" />
                <span className="text-xs">{campaign.name}</span>
              </div>
            </>
          )}
          <StatusBadge status={(contact.status as any) || "pending"} className="text-[10px] h-5 shrink-0" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {autoSaveStatus === "saving" && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t.agentWorkspace.savingPhone}
            </span>
          )}
          {autoSaveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
              <CheckCircle className="h-3 w-3" />
              {t.agentWorkspace.savedPhone}
            </span>
          )}
          {localPhoneOverride && localPhoneOverride !== lastAutoSavedPhoneRef.current && autoSaveStatus === "idle" && (
            <button
              onClick={handleManualSavePhone}
              title={t.agentWorkspace.savePhoneLabel}
              className="flex items-center gap-1 text-[10px] h-6 px-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors shrink-0"
            >
              <Save className="h-3 w-3" />
              {t.agentWorkspace.savePhoneLabel}
            </button>
          )}
          {(() => {
            const effectivePhone = localPhoneOverride || clinicData?.phone || collaboratorData?.phone || contact?.phone;
            if (!effectivePhone) return null;
            const cs = callState || "idle";
            const fmtDur = (s?: number) => `${String(Math.floor((s||0)/60)).padStart(2,"0")}:${String((s||0)%60).padStart(2,"0")}`;
            const isCustomerHungUp = cs === "ended" && hungUpBy === "customer";
            const isEnded = cs === "ended";
            const isActive = cs === "active" || cs === "on_hold";
            const isConnecting = cs === "connecting" || cs === "ringing";
            const phone = effectivePhone;

            if (isCustomerHungUp) {
              return (
                <button
                  onClick={() => onEndCall?.()}
                  data-testid="btn-call-from-canvas"
                  className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-bold text-white animate-pulse"
                  style={{ background: "#DC2626", boxShadow: "0 0 0 3px rgba(220,38,38,0.35)", animationDuration: "0.6s" }}
                >
                  <PhoneOff className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.agentWorkspace.callStateHungUp}</span>
                </button>
              );
            }

            if (isEnded) {
              return (
                <button
                  onClick={() => onEndCall?.()}
                  data-testid="btn-call-from-canvas"
                  className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold text-white"
                  style={{ background: "#EA580C" }}
                >
                  <PhoneOff className="h-3.5 w-3.5 shrink-0" />
                  {t.agentWorkspace.callStateEnd}
                </button>
              );
            }

            if (isActive) {
              return (
                <div className="flex items-center gap-1.5">
                  <button
                    data-testid="btn-call-status-active"
                    className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold text-white animate-pulse"
                    style={{ background: "#2563EB", animationDuration: "2s" }}
                    disabled
                  >
                    <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                    {t.agentWorkspace.callStateActive} · {fmtDur(callDuration)}
                    {cs === "on_hold" && <span className="ml-1 opacity-70">· {t.agentWorkspace.callStateHold}</span>}
                  </button>
                  <button
                    data-testid="btn-call-from-canvas"
                    onClick={() => onEndCall?.()}
                    className="flex items-center gap-1 h-8 px-2 rounded-md text-xs font-semibold text-white"
                    style={{ background: "#DC2626" }}
                    title={t.callBar?.endCall || "Ukončiť hovor"}
                  >
                    <PhoneOff className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </div>
              );
            }

            if (isConnecting) {
              return (
                <div className="flex items-center gap-1.5">
                  <button
                    data-testid="btn-call-status-connecting"
                    className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold text-white animate-pulse"
                    style={{ background: "#0891B2", animationDuration: "1s" }}
                    disabled
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {cs === "ringing"
                        ? `${t.agentWorkspace.callStateRinging}${ringDuration ? " " + ringDuration + "s" : ""}`
                        : t.agentWorkspace.callStateConnecting}
                    </span>
                  </button>
                  <button
                    data-testid="btn-call-from-canvas"
                    onClick={() => onEndCall?.()}
                    className="flex items-center gap-1 h-8 px-2 rounded-md text-xs font-semibold text-white"
                    style={{ background: "#DC2626" }}
                    title={t.callBar?.endCall || "Ukončiť hovor"}
                  >
                    <PhoneOff className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </div>
              );
            }

            return (
              <Button
                size="sm"
                onClick={() => isSipRegistered && onMakeCall ? onMakeCall(phone) : undefined}
                disabled={!isSipRegistered || !onMakeCall}
                data-testid="btn-call-from-canvas"
                className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {phone}
              </Button>
            );
          })()}
        </div>
      </div>

      <div className="border-b bg-card shrink-0">
        <div className="flex">
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeChannel === "phone"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChannelChange("phone")}
            data-testid="tab-phone"
          >
            <Phone className="h-3.5 w-3.5" />
            HOVOR
          </button>
          {showScript && (
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeChannel === "script"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChannelChange("script")}
            data-testid="tab-script"
          >
            <FileText className="h-3.5 w-3.5" />
            SCRIPT
          </button>
          )}
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeChannel === "email"
                ? "border-[#c2673a] text-[#c2673a]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChannelChange("email")}
            data-testid="tab-email"
          >
            <Mail className="h-3.5 w-3.5" />
            EMAIL
            {unreadEmailCount > 0 && activeChannel !== "email" && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadEmailCount > 9 ? "9+" : unreadEmailCount}
              </span>
            )}
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeChannel === "sms"
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChannelChange("sms")}
            data-testid="tab-sms"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            SMS
            {unreadSmsCount > 0 && activeChannel !== "sms" && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadSmsCount > 9 ? "9+" : unreadSmsCount}
              </span>
            )}
          </button>
          {(dbStatusList.length > 0 || (internalChecklistConfig.enabled && internalChecklistConfig.sections.length > 0)) && (
            <button
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeChannel === "checklist"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onChannelChange("checklist")}
              data-testid="tab-checklist"
            >
              <ListChecks className="h-3.5 w-3.5" />
              STATUS LIST
            </button>
          )}
          <div className="ml-auto flex items-center pr-2">
          </div>
        </div>
      </div>


      {showScript && activeChannel === "script" && (
        <div className="flex flex-col flex-1 relative overflow-y-auto">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 z-10"
            onClick={onOpenScriptModal}
            data-testid="btn-maximize-script"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <ScriptViewer script={campaign?.script || null} contact={contact} campaignContactId={campaignContactId} campaignId={campaign?.id} initialStepId={initialScriptStepId} onAction={onScriptAction} />
        </div>
      )}

      {activeChannel === "phone" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {contactType === "customer" && (
            <div className="border-b bg-card/50 flex items-center shrink-0 z-10">
              <button
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                  phoneSubTab === "card"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPhoneSubTab("card")}
                data-testid="subtab-customer-card"
              >
                <Pencil className="h-3 w-3" />
                {t.agentWorkspace.customerCard}
              </button>
              <button
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                  phoneSubTab === "details"
                    ? "border-purple-500 text-purple-600 dark:text-purple-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPhoneSubTab("details")}
                data-testid="subtab-customer-details"
              >
                <Eye className="h-3 w-3" />
                {t.agentWorkspace.customerDetail}
              </button>
              <button
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                  phoneSubTab === "documents"
                    ? "border-green-500 text-green-600 dark:text-green-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPhoneSubTab("documents")}
                data-testid="subtab-customer-documents"
              >
                <FileText className="h-3 w-3" />
                {t.agentWorkspace.customerDocumentsTab}
              </button>
              <button
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                  phoneSubTab === "sop"
                    ? "border-amber-500 text-amber-600 dark:text-amber-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPhoneSubTab("sop")}
                data-testid="subtab-sop"
              >
                <BookOpen className="h-3 w-3" />
                {t.agentWorkspace.sopTab || "SOP"}
              </button>
              {onClearContact && (
                <button
                  type="button"
                  onClick={onClearContact}
                  className="ml-auto mr-2 flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title={t.agentWorkspace.myShiftCloseCard}
                  data-testid="btn-close-contact-card"
                >
                  <X className="h-3.5 w-3.5" />
                  {t.agentWorkspace.myShiftCloseCard}
                </button>
              )}
            </div>
          )}


          {phoneSubTab === "card" && contact && (
            <>
              {contactType === "hospital" && hospitalData ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <HospitalFormWizard
                    key={hospitalData.id}
                    mode="inline"
                    initialData={hospitalData}
                    onSuccess={() => {}}
                  />
                </div>
              ) : contactType === "clinic" && clinicData ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <ClinicFormSheet
                    key={clinicData.id}
                    open={true}
                    onOpenChange={() => {}}
                    initialData={clinicData}
                    onSuccess={async () => {
                      try {
                        const r = await fetch(`/api/clinics/${contact.id}`, { credentials: "include" });
                        if (r.ok) { const d = await r.json(); onPhoneOverrideChange?.(d.phone || null); }
                      } catch {}
                    }}
                    onPhoneChange={(p) => onPhoneOverrideChange?.(p || null)}
                    onCallPhone={(p) => onMakeCall?.(p)}
                    mode="inline"
                  />
                </div>
              ) : contactType === "collaborator" && collaboratorData ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <CollaboratorFormWizard
                    key={collaboratorData.id}
                    mode="inline"
                    initialData={collaboratorData}
                    onSuccess={async () => {
                      try {
                        const r = await fetch(`/api/collaborators/${contact.id}`, { credentials: "include" });
                        if (r.ok) { const d = await r.json(); onPhoneOverrideChange?.(d.phone || null); }
                      } catch {}
                    }}
                    onPhoneChange={(p) => onPhoneOverrideChange?.(p || null)}
                  />
                </div>
              ) : (
                <ScrollArea className="flex-1 isolate">
                  <div className="px-4 pb-4">
                    <CustomerForm
                      key={contact.id}
                      initialData={contact}
                      onSubmit={(data) => onUpdateContact?.(data)}
                      isLoading={isUpdatingContact}
                      useCardLayout
                      onPhoneChange={(p) => onPhoneOverrideChange?.(p || null)}
                    />
                  </div>
                </ScrollArea>
              )}
            </>
          )}

          {phoneSubTab === "details" && contact && (
            <ScrollArea className="flex-1">
              <div className="px-4 pb-4">
                <CustomerDetailsContent customer={contact} onEdit={() => {}} compact visibleTabs={["overview", "potential", "gdpr", "notes"]} hideEditButton useCardLayout onCreateContract={onCreateContract} />
              </div>
            </ScrollArea>
          )}

          {phoneSubTab === "documents" && contact && (
            <CustomerDocumentsPanel customerId={contact.id} />
          )}

          {phoneSubTab === "sop" && (
            <SopPanel campaignId={campaign?.id} userId={user?.id?.toString()} />
          )}

        </div>
      )}

      {activeChannel === "email" && (
        <div className="flex-1 flex overflow-hidden">

          {/* ── RIGHT: Email history bubbles (top) + compose card (bottom) ── */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 p-3 gap-2">

            {/* ── Email history bubbles (SMS style) ── */}
            {(() => {
              const emailItems = [...mergedHistory.email].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              const inboundName =
                contactType === "clinic" ? (clinicData?.name || "")
                : contactType === "hospital" ? (hospitalData?.name || "")
                : contactType === "collaborator" ? (`${collaboratorData?.firstName || ""} ${collaboratorData?.lastName || ""}`.trim())
                : (`${contact?.firstName || ""} ${contact?.lastName || ""}`.trim());
              const inboundInitial = (inboundName[0] || "?").toUpperCase();
              const inboundFirstName = inboundName.split(" ")[0] || "?";
              return (
                <div className="shrink-0 flex flex-col rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-[#eae7e2] dark:bg-stone-950" style={{ maxHeight: "42%" }}>
                  {/* panel header */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-white/70 dark:bg-stone-900/60 border-b border-stone-200 dark:border-stone-700 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-[#c2673a]" />
                      <span className="text-[10px] font-semibold text-[#c2673a]">Email história</span>
                      {emailItems.length > 0 && <span className="text-[10px] text-muted-foreground">({emailItems.length})</span>}
                    </div>
                    {unreadEmailCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse inline-block" />
                        {unreadEmailCount} {unreadEmailCount === 1 ? "nový" : "nové"}
                      </span>
                    )}
                  </div>
                  {/* bubbles */}
                  <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-[80px]">
                    {emailItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-1 text-stone-400 dark:text-stone-600 py-3">
                        <Mail className="h-5 w-5 opacity-25" />
                        <p className="text-[10px]">Žiadne emaily</p>
                      </div>
                    ) : emailItems.map((entry, idx) => {
                      const isOut = entry.direction !== "inbound";
                      const isUnread = !isOut && emailOpenedAt !== null && new Date(entry.timestamp).getTime() > (emailOpenedAt ?? 0);
                      const agentDisplayName = entry.agentName || user?.name || user?.username || "?";
                      const agentInitial = agentDisplayName[0]?.toUpperCase() || "?";
                      const agentFirstName = agentDisplayName.split(" ")[0] || "?";
                      const subject = entry.content || "(bez predmetu)";
                      const prevEntry = emailItems[idx - 1];
                      const showDateSep = !prevEntry || new Date(entry.timestamp).getTime() - new Date(prevEntry.timestamp).getTime() > 10 * 60 * 1000;
                      return (
                        <div key={entry.id || idx}>
                          {showDateSep && (
                            <div className="flex justify-center my-2">
                              <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 bg-white/80 dark:bg-stone-800/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                                {format(new Date(entry.timestamp), "d. M. yyyy, HH:mm", { locale: sk })}
                              </span>
                            </div>
                          )}
                          <div className={`flex items-end gap-2 ${isOut ? "justify-end" : "justify-start"}`}>
                            {!isOut && (
                              <div className="flex flex-col items-center gap-0.5 shrink-0 mb-1">
                                <Avatar className="h-7 w-7 ring-2 ring-white dark:ring-stone-700 shadow-sm">
                                  <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                                    {inboundInitial}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-[8px] font-medium text-stone-500 dark:text-stone-400 max-w-[44px] truncate leading-tight text-center">{inboundFirstName}</span>
                              </div>
                            )}
                            <button
                              onClick={() => onOpenHistoryDetail?.(entry as any)}
                              className={`max-w-[70%] px-4 py-2.5 text-left hover:opacity-90 active:scale-[0.98] transition-all ${
                                isOut
                                  ? "bg-gradient-to-br from-[#c2673a] to-[#a8502a] rounded-2xl rounded-br-none shadow-md"
                                  : `bg-white dark:bg-stone-800 rounded-2xl rounded-bl-none shadow-md border-l-[3px] ${isUnread ? "border-red-400 ring-1 ring-red-200 dark:ring-red-900" : "border-[#c2673a]/70 dark:border-[#c2673a]/50"}`
                              }`}
                            >
                              <p className={`text-[13px] font-semibold leading-snug flex items-center gap-1.5 ${isOut ? "text-white" : "text-stone-800 dark:text-stone-100"}`}>
                                <Mail className="h-3 w-3 shrink-0 opacity-60" />
                                <span className="truncate">{subject}</span>
                              </p>
                              <div className={`flex items-center gap-1.5 mt-1 ${isOut ? "justify-end" : "justify-start"}`}>
                                <span className={`text-[10px] font-medium ${isOut ? "text-white/60" : "text-stone-400 dark:text-stone-500"}`}>
                                  {format(new Date(entry.timestamp), "HH:mm")}
                                </span>
                                <span className={`text-[9px] ${isOut ? "text-white/40" : "text-stone-300 dark:text-stone-600"}`}>· zobraziť</span>
                                {isUnread && <span className="text-[9px] font-bold text-red-500 dark:text-red-400">● nové</span>}
                              </div>
                            </button>
                            {isOut && (
                              <div className="flex flex-col items-center gap-0.5 shrink-0 mb-1">
                                <Avatar className="h-7 w-7 ring-2 ring-white dark:ring-stone-700 shadow-sm">
                                  {entry.agentName === (user?.name || user?.username) && user?.avatarUrl && (
                                    <AvatarImage src={user.avatarUrl} alt={agentFirstName} />
                                  )}
                                  <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-[#c2673a] to-[#a8502a] text-white">
                                    {agentInitial}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-[8px] font-medium text-stone-500 dark:text-stone-400 max-w-[44px] truncate leading-tight text-center">{agentFirstName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={emailChatEndRef} />
                  </div>
                </div>
              );
            })()}

            {/* ── Compose card (flex-1, template visible) ── */}
            <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden shadow-sm border border-border">

            {/* Email-client header bar */}
            <div className="bg-card border-b border-border px-4 py-2.5 flex items-center gap-3 shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c2673a]/15 shrink-0">
                <Mail className="h-3.5 w-3.5 text-[#c2673a]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-foreground font-semibold text-sm truncate leading-tight">
                  {emailSubject || <span className="text-muted-foreground font-normal italic">— {t.customers?.details?.subject || "Subject"} —</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {selectedEmails.length > 0 ? (
                    <span className="text-muted-foreground text-[11px] truncate">→ {selectedEmails.join(", ")}</span>
                  ) : (
                    <span className="text-muted-foreground/60 text-[11px] italic">{t.customers?.details?.selectEmail || "No recipient selected"}</span>
                  )}
                  {selectedFromAccount && allEmailAccounts.find(a => (a.id || "personal") === selectedFromAccount) && (
                    <span className="text-muted-foreground/50 text-[10px] shrink-0">
                      via {allEmailAccounts.find(a => (a.id || "personal") === selectedFromAccount)?.displayName}
                    </span>
                  )}
                </div>
              </div>
              {emailIsHtml && (
                <div className="flex items-center gap-0.5 shrink-0 bg-muted rounded-lg p-0.5">
                  <button type="button" onClick={() => setEmailHtmlEditMode(false)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${!emailHtmlEditMode ? "bg-[#c2673a] text-white shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>Preview</button>
                  <button type="button" onClick={() => setEmailHtmlEditMode(true)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${emailHtmlEditMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>Edit HTML</button>
                </div>
              )}
              <button type="button" onClick={() => setEmailPreviewExpanded(true)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Zobraziť na celú obrazovku" data-testid="btn-email-preview-expand">
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Email body — template/plain text editor visible */}
            <div className="flex-1 min-h-0 overflow-hidden" data-testid="wysiwyg-email-message">
              {emailIsHtml ? (
                emailHtmlEditMode ? (
                  <textarea
                    className="w-full h-full px-4 py-3 text-xs font-mono resize-none focus-visible:outline-none bg-slate-950 text-slate-200"
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    spellCheck={false}
                    data-testid="textarea-email-html-edit"
                  />
                ) : (
                  <iframe
                    srcDoc={emailMessage}
                    sandbox="allow-same-origin"
                    className="w-full h-full bg-white"
                    title="Email preview"
                  />
                )
              ) : (
                <textarea
                  className="w-full h-full px-4 py-4 text-sm resize-none focus-visible:outline-none bg-white dark:bg-card text-foreground leading-relaxed"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder={t.customers?.details?.writeEmailPlaceholder || "Write your email..."}
                  disabled={isSendingEmail}
                  data-testid="textarea-email-message"
                />
              )}
            </div>

            {/* Bottom action bar */}
            <div className="shrink-0 border-t border-border bg-card px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="text-[11px] space-y-0.5">
                {selectedEmails.length === 0 && <div className="text-destructive">• {t.customers?.details?.selectEmail || "Vyberte aspoň jeden email"}</div>}
                {!emailSubject && <div className="text-amber-600 dark:text-amber-500">• {t.customers?.details?.enterSubject || "Zadajte predmet"}</div>}
                {!emailMessage && <div className="text-amber-600 dark:text-amber-500">• {t.customers?.details?.enterMessage || "Zadajte správu"}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setEmailSubject(""); setEmailMessage(""); setEmailIsHtml(false); setEmailHtmlEditMode(false); setSelectedEmails([]); setEmailAttachment(null); setTemplateAttachments([]); setEmailCc(""); setShowCcField(false); setSelectedDocuments([]); }} data-testid="button-cancel-email">
                  {t.common?.cancel || "Cancel"}
                </Button>
                <Button onClick={handleSendEmail} disabled={selectedEmails.length === 0 || !emailSubject || !emailMessage || isSendingEmail} className="h-8 px-4 text-xs font-semibold bg-[#c2673a] hover:bg-[#a8502a] text-white border-0 shadow-sm disabled:opacity-40" data-testid="btn-send-email">
                  {isSendingEmail ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                  {t.customers?.details?.sendEmail || "Send Email"}
                </Button>
              </div>
            </div>

            </div>{/* end compose card */}

            {/* Expanded dialog */}
            {emailPreviewExpanded && (
              <Dialog open={emailPreviewExpanded} onOpenChange={setEmailPreviewExpanded}>
                <DialogContent className="max-w-5xl w-full h-[90vh] !flex !flex-col p-0 gap-0 overflow-hidden rounded-xl">
                  <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border flex-shrink-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c2673a]/15 shrink-0">
                      <Mail className="h-3.5 w-3.5 text-[#c2673a]" />
                    </div>
                    <span className="text-sm font-semibold flex-1 truncate text-foreground">{emailSubject || "Email preview"}</span>
                    <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
                      <button type="button" onClick={() => setEmailHtmlEditMode(false)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${!emailHtmlEditMode ? "bg-[#c2673a] text-white shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>Preview</button>
                      <button type="button" onClick={() => setEmailHtmlEditMode(true)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${emailHtmlEditMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>Edit HTML</button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden bg-stone-100 dark:bg-stone-950 p-3">
                    <div className="h-full rounded-xl overflow-hidden shadow-lg border border-stone-200/60 dark:border-stone-700/60">
                      {emailHtmlEditMode ? (
                        <textarea
                          className="h-full w-full px-4 py-3 text-xs font-mono resize-none focus-visible:outline-none bg-[#1a1a1a] text-stone-300"
                          value={emailMessage}
                          onChange={(e) => setEmailMessage(e.target.value)}
                          spellCheck={false}
                        />
                      ) : (
                        <iframe
                          srcDoc={emailMessage}
                          sandbox="allow-same-origin"
                          className="h-full w-full bg-white"
                          title="Email preview expanded"
                        />
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* ── LEFT: Compact form sidebar ── */}
          <div className="w-[290px] shrink-0 flex flex-col order-first border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 overflow-y-auto">
            <div className="p-4 space-y-4">

              {/* FROM ACCOUNT */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                  {t.customers?.details?.fromAccount || "FROM ACCOUNT"}
                </Label>
                <Select
                  value={campaignEmailMode === "system" ? "system" : selectedFromAccount}
                  onValueChange={(v) => { if (campaignEmailMode !== "system") setSelectedFromAccount(v); }}
                  disabled={campaignEmailMode === "system"}
                >
                  <SelectTrigger data-testid="select-from-account" className="text-sm h-9 bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700">
                    <SelectValue placeholder={t.customers?.details?.selectAccount || "Select account"} />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignEmailMode === "system" && (
                      <SelectItem value="system">
                        <div className="flex items-center gap-2">
                          <span>{t.customers?.details?.systemAccount || "System INDEXUS"}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">System</Badge>
                        </div>
                      </SelectItem>
                    )}
                    {allEmailAccounts.map((account) => (
                      <SelectItem key={account.id || "personal"} value={account.id || "personal"}>
                        <div className="flex items-center gap-2">
                          <span>{account.displayName}</span>
                          {account.type === "personal" && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {t.customers?.details?.personalAccount || "Personal"}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-stone-200 dark:border-stone-700/60" />

              {/* SUBJECT */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                  {t.customers?.details?.subject || "SUBJECT"}
                </Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={t.customers?.details?.emailSubjectPlaceholder || "Email subject..."}
                  disabled={isSendingEmail}
                  data-testid="input-email-subject"
                  className="h-9 bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-sm"
                />
              </div>

              <div className="border-t border-stone-200 dark:border-stone-700/60" />

              {/* TEMPLATE */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                    {t.configuration?.messageTemplates || "TEMPLATE"}
                  </Label>
                  <button
                    type="button"
                    onClick={() => setEmailIsHtml(v => !v)}
                    data-testid="btn-toggle-html"
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${emailIsHtml ? "bg-[#c2673a] text-white border-[#c2673a]" : "bg-white dark:bg-stone-800 text-stone-500 border-stone-300 dark:border-stone-600 hover:bg-stone-100"}`}
                    title={emailIsHtml ? "Prepnúť na plain text" : "Prepnúť na HTML editor"}
                  >
                    <Code2 className="h-3 w-3" />
                    HTML
                  </button>
                </div>
                <div className="flex items-center gap-0.5 flex-wrap">
                  {[
                    { code: "sk", flag: "🇸🇰" },
                    { code: "cs", flag: "🇨🇿" },
                    { code: "en", flag: "🇬🇧" },
                    { code: "hu", flag: "🇭🇺" },
                    { code: "ro", flag: "🇷🇴" },
                    { code: "it", flag: "🇮🇹" },
                    { code: "de", flag: "🇩🇪" },
                  ].map(({ code, flag }) => (
                    <button
                      key={code}
                      type="button"
                      className={`text-base px-1 py-0.5 rounded border transition-all ${emailTemplateLangs.has(code) ? "border-[#c2673a] bg-[#c2673a]/10 shadow-sm" : "border-transparent opacity-40 hover:opacity-70"}`}
                      onClick={() => {
                        setEmailTemplateLangs(prev => {
                          const next = new Set(prev);
                          if (next.has(code)) next.delete(code);
                          else next.add(code);
                          return next;
                        });
                      }}
                      title={code.toUpperCase()}
                      data-testid={`email-lang-flag-${code}`}
                    >
                      {flag}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {emailCategoriesWithTemplates.length > 0 && (
                    <Select value={emailTemplateCategoryId} onValueChange={(val) => { setEmailTemplateCategoryId(val); }}>
                      <SelectTrigger data-testid="select-email-template-category" className="text-sm h-9 bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700">
                        <SelectValue placeholder={t.configuration?.selectCategory || "Select category"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t.sop?.all || "All"}</SelectItem>
                        {emailCategoriesWithTemplates.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Popover open={emailTemplatePopoverOpen} onOpenChange={setEmailTemplatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between text-sm font-normal h-9 bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700" data-testid="select-email-template" disabled={emailTemplates.length === 0}>
                        <span className="truncate">{selectedEmailTemplateName || (emailTemplates.length === 0 ? (t.konfigurator?.noMessageTemplates || "No templates") : (t.configuration?.selectTemplate || "Select template"))}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="flex items-center border-b px-3 py-2">
                        <Search className="h-4 w-4 mr-2 shrink-0 opacity-50" />
                        <input
                          className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          placeholder={t.configuration?.searchTemplate || "Search template..."}
                          value={emailTemplateSearch}
                          onChange={(e) => setEmailTemplateSearch(e.target.value)}
                          data-testid="input-search-email-template"
                        />
                        {emailTemplateSearch && (
                          <button onClick={() => setEmailTemplateSearch("")} className="ml-1 opacity-50 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {filteredEmailTemplates.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">{t.konfigurator?.noMessageTemplates || "No templates"}</p>
                        ) : (
                          filteredEmailTemplates.map((template) => (
                            <button
                              key={template.id}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                              onClick={() => handleSelectEmailTemplate(template.id)}
                              data-testid={`email-template-option-${template.id}`}
                            >
                              <Check className={`h-4 w-4 shrink-0 ${selectedEmailTemplateName === template.name ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate flex-1">{template.name}</span>
                              {(template as any).attachments?.length > 0 && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="border-t border-stone-200 dark:border-stone-700/60" />

              {/* TO */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                  {t.customers?.details?.to || "TO"}
                </Label>
                <div className="space-y-1.5">
                  {contact?.email && (
                    <div className="flex items-center gap-2">
                      <Checkbox id="aw-email1" checked={selectedEmails.includes(contact.email)} onCheckedChange={(checked) => {
                        if (checked) setSelectedEmails([...selectedEmails, contact.email!]);
                        else setSelectedEmails(selectedEmails.filter(e => e !== contact.email));
                      }} data-testid="checkbox-email-primary" />
                      <Label htmlFor="aw-email1" className="font-normal cursor-pointer text-xs truncate">{contact.email}</Label>
                    </div>
                  )}
                  {(contact as any)?.email2 && (
                    <div className="flex items-center gap-2">
                      <Checkbox id="aw-email2" checked={selectedEmails.includes((contact as any).email2)} onCheckedChange={(checked) => {
                        if (checked) setSelectedEmails([...selectedEmails, (contact as any).email2!]);
                        else setSelectedEmails(selectedEmails.filter(e => e !== (contact as any).email2));
                      }} data-testid="checkbox-email-secondary" />
                      <Label htmlFor="aw-email2" className="font-normal cursor-pointer text-xs truncate">{(contact as any).email2}</Label>
                    </div>
                  )}
                </div>
              </div>

              {/* CC */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest">CC</Label>
                  <Button variant="ghost" size="sm" onClick={() => setShowCcField(!showCcField)} className="h-5 px-1 text-xs text-stone-500 hover:text-stone-700" data-testid="button-toggle-cc">
                    {showCcField ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>
                {showCcField && (
                  <Input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder={t.customers?.details?.ccPlaceholder || "email@example.com"} className="h-9 text-sm bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700" data-testid="input-email-cc" />
                )}
              </div>

              <div className="border-t border-stone-200 dark:border-stone-700/60" />

              {/* ATTACHMENT */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                  {t.customers?.details?.attachment || "ATTACHMENT"}
                </Label>
                {!emailAttachment ? (
                  <label
                    htmlFor="aw-email-attachment-input"
                    className="flex flex-col items-center justify-center w-full h-14 border-2 border-dashed border-stone-300 dark:border-stone-600 rounded-lg cursor-pointer bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 transition-colors group"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files?.[0]; if (file) setEmailAttachment(file); }}
                    data-testid="dropzone-email-attachment"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#c2673a] transition-colors" />
                      <p className="text-[10px] text-stone-500 group-hover:text-stone-700 transition-colors">
                        <span className="font-medium text-[#c2673a]">{t.common?.clickToUpload || "Click to upload"}</span> {t.common?.orDragDrop || "or drag and drop"}
                      </p>
                    </div>
                    <input id="aw-email-attachment-input" type="file" className="hidden" onChange={(e) => setEmailAttachment(e.target.files?.[0] || null)} data-testid="input-email-attachment" />
                  </label>
                ) : (
                  <div className="flex items-center gap-2 p-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800">
                    <FileIcon className="w-4 h-4 text-[#c2673a] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{emailAttachment.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(emailAttachment.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEmailAttachment(null)} data-testid="button-remove-attachment">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* TEMPLATE ATTACHMENTS */}
              {templateAttachments.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {t.customers?.details?.templateAttachments || "TEMPLATE ATTACHMENTS"} ({templateAttachments.length})
                  </Label>
                  <div className="space-y-1">
                    {templateAttachments.map((ta, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-1.5 border rounded-md bg-amber-50 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-800/50">
                        <FileIcon className="w-3.5 h-3.5 text-[#c2673a] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate" data-testid={`template-att-name-${idx}`}>{ta.fileName}</p>
                          <p className="text-[9px] text-muted-foreground">{(ta.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setTemplateAttachments(prev => prev.filter((_, i) => i !== idx))} data-testid={`btn-remove-tpl-att-${idx}`}>
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CUSTOMER DOCUMENTS */}
              {customerDocuments.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                    {t.customers?.details?.customerDocuments || "CUSTOMER DOCUMENTS"}
                  </Label>
                  <div className="space-y-1 max-h-28 overflow-y-auto border border-stone-200 dark:border-stone-700 rounded-md p-2 bg-white dark:bg-stone-800">
                    {customerDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2">
                        <Checkbox id={`aw-doc-${doc.id}`} checked={selectedDocuments.includes(doc.id)} onCheckedChange={(checked) => {
                          if (checked) setSelectedDocuments([...selectedDocuments, doc.id]);
                          else setSelectedDocuments(selectedDocuments.filter(d => d !== doc.id));
                        }} data-testid={`checkbox-doc-${doc.id}`} />
                        <Label htmlFor={`aw-doc-${doc.id}`} className="font-normal cursor-pointer text-[11px] truncate flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {doc.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {activeChannel === "sms" && (
        <div className="flex-1 flex overflow-hidden">

          {/* ── RIGHT: SMS preview + compose ── */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 p-3">
            <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden shadow-sm border border-border">

              {/* SMS header bar */}
              <div className="bg-card border-b border-border px-4 py-2.5 flex items-center gap-3 shrink-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c2673a]/15 shrink-0">
                  <MessageSquare className="h-3.5 w-3.5 text-[#c2673a]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-foreground font-semibold text-sm leading-tight">SMS</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(selectedPhones.length > 0 || smsCc.trim()) ? (
                      <span className="text-muted-foreground text-[11px] truncate">
                        → {[...selectedPhones, ...(smsCc.trim() ? [smsCc] : [])].join(", ")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 text-[11px] italic">{t.customers?.details?.noRecipient || "No recipient selected"}</span>
                    )}
                  </div>
                </div>
                <span className={`text-[11px] font-mono shrink-0 tabular-nums ${smsMessage.length >= 160 ? 'text-destructive font-semibold' : smsMessage.length > 130 ? 'text-amber-500' : 'text-muted-foreground/60'}`}>
                  {smsCharCount}/160
                  {smsCount > 1 && <span className="ml-1 text-[10px] text-muted-foreground/40">×{smsCount}</span>}
                </span>
              </div>

              {/* SMS Chat Timeline */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#eae7e2] dark:bg-stone-950">
                {/* Search bar */}
                <div className="shrink-0 px-3 pt-2.5 pb-1.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
                    <input
                      type="text"
                      value={smsSearch}
                      onChange={e => setSmsSearch(e.target.value)}
                      placeholder="Hľadať v správach..."
                      className="w-full pl-9 pr-8 py-2 text-[12px] rounded-xl bg-white dark:bg-stone-800 border border-stone-300/70 dark:border-stone-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/60 placeholder:text-stone-400 dark:placeholder:text-stone-500 transition-all"
                      data-testid="input-sms-search"
                    />
                    {smsSearch && (
                      <button onClick={() => setSmsSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Messages scroll area */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                  {(() => {
                    const historySmsMsgIds = new Set<string>();
                    const historySms = (contactHistory || [])
                      .filter((h: any) => h.type === "sms")
                      .map((h: any) => {
                        historySmsMsgIds.add(h.id.replace(/^msg-/, ""));
                        return h;
                      });
                    // Merge fresh customerMessages (refetch every 5s) so inbound replies appear immediately
                    const freshSms = (customerMessages || [])
                      .filter((m: any) => m.type === "sms" && !historySmsMsgIds.has(m.id))
                      .map((m: any) => ({
                        id: m.id,
                        type: "sms",
                        direction: m.direction || "outbound",
                        date: m.sentAt || m.createdAt,
                        fullContent: (m.content || "").replace(/\s*\[R:[0-9a-f]+\]/gi, "").trim(),
                        content: (m.content || "").replace(/\s*\[R:[0-9a-f]+\]/gi, "").trim().substring(0, 100),
                        agentName: null,
                        agentId: m.userId,
                        status: m.status,
                        statusCode: m.status,
                        sentiment: m.aiSentiment || null,
                        aiAlertLevel: m.aiAlertLevel,
                        aiHasAngryTone: m.aiHasAngryTone,
                      }));
                    const smsThread = [...historySms, ...freshSms]
                      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    const items: any[] = [...smsThread];
                    if (smsMessage) {
                      items.push({ _draft: true, id: "draft", direction: "outbound", date: new Date().toISOString(), fullContent: smsMessage, content: smsMessage });
                    }

                    // Derive inbound contact display name from contactType
                    const inboundName =
                      contactType === "clinic" ? (clinicData?.name || "")
                      : contactType === "hospital" ? (hospitalData?.name || "")
                      : contactType === "collaborator" ? (`${collaboratorData?.firstName || ""} ${collaboratorData?.lastName || ""}`.trim())
                      : (`${contact?.firstName || ""} ${contact?.lastName || ""}`.trim());
                    const inboundInitial = inboundName[0]?.toUpperCase() || "?";
                    const inboundFirstName = inboundName.split(" ")[0] || "?";

                    // Apply search filter
                    const searchQ = smsSearch.trim().toLowerCase();
                    const displayItems = searchQ
                      ? items.filter((m: any) => (m.fullContent || m.content || "").toLowerCase().includes(searchQ))
                      : items;

                    if (items.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-stone-400 dark:text-stone-600">
                          <MessageSquare className="h-7 w-7 opacity-30" />
                          <p className="text-[11px]">{t.customers?.details?.writeSmsPlaceholder || "Write your SMS message..."}</p>
                        </div>
                      );
                    }

                    if (displayItems.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-stone-400 dark:text-stone-600">
                          <Search className="h-7 w-7 opacity-30" />
                          <p className="text-[11px]">Žiadne správy nezodpovedajú hľadaniu</p>
                        </div>
                      );
                    }

                    return displayItems.map((msg: any, idx: number) => {
                      const isOut = msg.direction !== "inbound";
                      const text = msg.fullContent || msg.content || "—";
                      const prevMsg = displayItems[idx - 1];
                      const showDateSep = !prevMsg || (!msg._draft && new Date(msg.date).getTime() - new Date(prevMsg.date).getTime() > 10 * 60 * 1000);
                      const msgSentiment = msg.sentiment || null;
                      const isNegativeSent = !isOut && (msgSentiment === "negative" || msgSentiment === "angry" || msg.aiHasAngryTone);
                      return (
                        <div key={msg.id || idx}>
                          {showDateSep && !msg._draft && (
                            <div className="flex justify-center my-2">
                              <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 bg-white/80 dark:bg-stone-800/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                                {format(new Date(msg.date), "d. M. yyyy, HH:mm", { locale: sk })}
                              </span>
                            </div>
                          )}
                          <div className={`flex items-end gap-2 ${isOut ? "justify-end" : "justify-start"}`}>
                            {!isOut && (
                              <div className="flex flex-col items-center gap-0.5 shrink-0 mb-1">
                                <Avatar className={`h-7 w-7 ring-2 shadow-sm ${isNegativeSent ? "ring-red-300 dark:ring-red-700" : "ring-white dark:ring-stone-700"}`}>
                                  <AvatarFallback className={`text-[10px] font-bold text-white ${isNegativeSent ? "bg-gradient-to-br from-red-400 to-rose-500" : "bg-gradient-to-br from-emerald-400 to-teal-500"}`}>
                                    {inboundInitial}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-[8px] font-medium text-stone-500 dark:text-stone-400 max-w-[44px] truncate leading-tight text-center">
                                  {inboundFirstName}
                                </span>
                              </div>
                            )}
                            <div className={`max-w-[70%] ${
                              isOut
                                ? msg._draft
                                  ? "px-4 py-2.5 bg-white/90 border-2 border-dashed border-blue-300 dark:bg-stone-800/80 dark:border-blue-700 rounded-2xl rounded-br-none shadow-sm"
                                  : "px-4 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-indigo-700 rounded-2xl rounded-br-none shadow-md"
                                : isNegativeSent
                                  ? "px-4 py-2.5 bg-red-50 dark:bg-red-950/60 rounded-2xl rounded-bl-none shadow-md border-l-[3px] border-red-500 dark:border-red-600"
                                  : "px-4 py-2.5 bg-white dark:bg-stone-800 rounded-2xl rounded-bl-none shadow-md border-l-[3px] border-emerald-400 dark:border-emerald-500"
                            }`}>
                              <p className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                                isOut
                                  ? msg._draft
                                    ? "font-normal text-blue-700 dark:text-blue-300 italic"
                                    : "font-semibold text-white"
                                  : isNegativeSent
                                    ? "font-semibold text-red-800 dark:text-red-200"
                                    : "font-semibold text-stone-800 dark:text-stone-100"
                              }`}>{text}</p>
                              {!msg._draft && (
                                <div className={`flex items-center gap-1.5 mt-1 ${isOut ? "justify-end" : "justify-start"}`}>
                                  <span className={`text-[10px] font-medium ${isOut ? "text-blue-100 dark:text-blue-300" : isNegativeSent ? "text-red-400 dark:text-red-500" : "text-stone-400 dark:text-stone-500"}`}>
                                    {format(new Date(msg.date), "HH:mm")}
                                  </span>
                                  {!isOut && msgSentiment && (
                                    <SentimentBadge sentiment={msgSentiment} size="sm" />
                                  )}
                                  {isOut && (
                                    <span className={`text-[10px] ${msg.status === "delivered" || msg.status === "read" ? "text-blue-100" : "text-blue-200/70"}`}>
                                      {msg.status === "delivered" || msg.status === "read" ? "✓✓" : "✓"}
                                    </span>
                                  )}
                                </div>
                              )}
                              {msg._draft && (
                                <p className="text-[10px] font-medium text-blue-400 dark:text-blue-500 mt-0.5 italic">náhľad</p>
                              )}
                            </div>
                            {isOut && (() => {
                              const isCurrentUser = msg._draft || msg.agentId === user?.id;
                              const agentInitial = ((msg._draft ? (user?.name || user?.username) : msg.agentName) || "?")[0]?.toUpperCase();
                              const agentFirstName = ((msg._draft ? (user?.name || user?.username) : msg.agentName) || "").split(" ")[0] || "—";
                              return (
                                <div className="flex flex-col items-center gap-0.5 shrink-0 mb-1">
                                  <Avatar className="h-7 w-7 ring-2 ring-white dark:ring-stone-700 shadow-sm">
                                    {isCurrentUser && user?.avatarUrl && (
                                      <AvatarImage src={user.avatarUrl} alt={user?.name || user?.username || ""} />
                                    )}
                                    <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                                      {agentInitial}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-[8px] font-medium text-stone-500 dark:text-stone-400 max-w-[44px] truncate leading-tight text-center">
                                    {agentFirstName}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <div ref={smsChatEndRef} />
                </div>
              </div>

              {/* Compose + action bar */}
              <div className="shrink-0 border-t border-border bg-card px-4 py-2.5 flex items-end gap-3">
                <div className="flex-1 min-w-0">
                  <Textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder={t.customers?.details?.writeSmsPlaceholder || "Write your SMS..."}
                    rows={2}
                    maxLength={160}
                    disabled={isSendingSms}
                    className="text-xs resize-none"
                    style={{ minHeight: 52, maxHeight: 80 }}
                    data-testid="input-sms-message"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0 pb-0.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => { setSmsMessage(""); setSelectedPhones([]); setSmsCc(""); setShowSmsCcField(false); }}
                    data-testid="button-cancel-sms"
                  >
                    {t.common?.cancel || "Cancel"}
                  </Button>
                  <Button
                    onClick={handleSendSms}
                    disabled={(selectedPhones.length === 0 && !smsCc.trim()) || !smsMessage || isSendingSms}
                    className="h-8 px-4 text-xs font-semibold bg-[#c2673a] hover:bg-[#a8502a] text-white border-0 shadow-sm disabled:opacity-40"
                    data-testid="btn-send-sms"
                  >
                    {isSendingSms ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                    {t.customers?.details?.sendSms || "Send SMS"}
                  </Button>
                </div>
              </div>

            </div>
          </div>

          {/* ── LEFT: Compact form sidebar ── */}
          <div className="w-[290px] shrink-0 flex flex-col order-first border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 overflow-y-auto">
            <div className="p-4 space-y-4">

              {/* Template */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {t.configuration?.messageTemplates || "Template"}
                </Label>
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { code: "sk", flag: "🇸🇰" },
                    { code: "cs", flag: "🇨🇿" },
                    { code: "en", flag: "🇬🇧" },
                    { code: "hu", flag: "🇭🇺" },
                    { code: "ro", flag: "🇷🇴" },
                    { code: "it", flag: "🇮🇹" },
                    { code: "de", flag: "🇩🇪" },
                  ].map(({ code, flag }) => (
                    <button
                      key={code}
                      type="button"
                      className={`text-base px-1 py-0.5 rounded border transition-all ${smsTemplateLangs.has(code) ? "border-[#c2673a] bg-[#c2673a]/10 shadow-sm" : "border-transparent opacity-40 hover:opacity-70"}`}
                      onClick={() => {
                        setSmsTemplateLangs(prev => {
                          const next = new Set(prev);
                          if (next.has(code)) next.delete(code);
                          else next.add(code);
                          return next;
                        });
                      }}
                      title={code.toUpperCase()}
                      data-testid={`sms-lang-flag-${code}`}
                    >
                      {flag}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {smsCategoriesWithTemplates.length > 0 && (
                    <Select value={smsTemplateCategoryId} onValueChange={(val) => { setSmsTemplateCategoryId(val); }}>
                      <SelectTrigger data-testid="select-sms-template-category" className="text-xs h-8">
                        <SelectValue placeholder={t.configuration?.selectCategory || "Select category"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t.sop?.all || "All"}</SelectItem>
                        {smsCategoriesWithTemplates.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Popover open={smsTemplatePopoverOpen} onOpenChange={setSmsTemplatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between text-xs font-normal h-8" data-testid="select-sms-template" disabled={smsTemplates.length === 0}>
                        <span className="truncate">{selectedSmsTemplateName || (smsTemplates.length === 0 ? (t.konfigurator?.noMessageTemplates || "No templates") : (t.configuration?.selectTemplate || "Select template"))}</span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="flex items-center border-b px-3 py-2">
                        <Search className="h-3.5 w-3.5 mr-2 shrink-0 opacity-50" />
                        <input
                          className="flex h-8 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                          placeholder={t.configuration?.searchTemplate || "Search template..."}
                          value={smsTemplateSearch}
                          onChange={(e) => setSmsTemplateSearch(e.target.value)}
                          data-testid="input-search-sms-template"
                        />
                        {smsTemplateSearch && (
                          <button onClick={() => setSmsTemplateSearch("")} className="ml-1 opacity-50 hover:opacity-100"><X className="h-3 w-3" /></button>
                        )}
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {filteredSmsTemplates.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">{t.konfigurator?.noMessageTemplates || "No templates"}</p>
                        ) : (
                          filteredSmsTemplates.map((template) => (
                            <button
                              key={template.id}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/50 transition-colors"
                              onClick={() => handleSelectSmsTemplate(template.id)}
                              data-testid={`sms-template-option-${template.id}`}
                            >
                              <Check className={`h-3.5 w-3.5 shrink-0 ${selectedSmsTemplateName === template.name ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate">{template.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="border-t border-stone-200 dark:border-stone-700/60" />

              {/* Recipients */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {t.customers?.details?.to || "To"}
                </Label>
                <div className="space-y-1.5">
                  {contact?.phone && (
                    <div className="flex items-center gap-2">
                      <Checkbox id="aw-sms-phone1" checked={selectedPhones.includes(contact.phone)} onCheckedChange={(checked) => {
                        if (checked) setSelectedPhones([...selectedPhones, contact.phone!]);
                        else setSelectedPhones(selectedPhones.filter(p => p !== contact.phone));
                      }} data-testid="checkbox-phone-primary" />
                      <Label htmlFor="aw-sms-phone1" className="font-normal cursor-pointer text-xs">
                        {getCountryFlag(contact.country || "SK")} {contact.phone}
                      </Label>
                    </div>
                  )}
                  {(contact as any)?.phone2 && (
                    <div className="flex items-center gap-2">
                      <Checkbox id="aw-sms-phone2" checked={selectedPhones.includes((contact as any).phone2)} onCheckedChange={(checked) => {
                        if (checked) setSelectedPhones([...selectedPhones, (contact as any).phone2!]);
                        else setSelectedPhones(selectedPhones.filter(p => p !== (contact as any).phone2));
                      }} data-testid="checkbox-phone-secondary" />
                      <Label htmlFor="aw-sms-phone2" className="font-normal cursor-pointer text-xs">
                        {getCountryFlag(contact?.country || "SK")} {(contact as any).phone2}
                      </Label>
                    </div>
                  )}
                  {!contact?.phone && !(contact as any)?.phone2 && (
                    <p className="text-[11px] text-muted-foreground italic">{t.customers?.details?.noPhone || "No phone number"}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-stone-200 dark:border-stone-700/60" />

              {/* CC */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">CC</Label>
                  <Button variant="ghost" size="sm" onClick={() => setShowSmsCcField(!showSmsCcField)} className="h-5 px-1 text-xs" data-testid="button-toggle-sms-cc">
                    {showSmsCcField ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>
                {showSmsCcField && (
                  <div className="flex gap-2">
                    <Select value={smsCcCountry} onValueChange={setSmsCcCountry}>
                      <SelectTrigger className="w-20 h-8 text-xs" data-testid="select-sms-cc-country">
                        <SelectValue>{getCountryFlag(smsCcCountry)} {smsCcCountry}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SK">{getCountryFlag("SK")} SK</SelectItem>
                        <SelectItem value="CZ">{getCountryFlag("CZ")} CZ</SelectItem>
                        <SelectItem value="HU">{getCountryFlag("HU")} HU</SelectItem>
                        <SelectItem value="RO">{getCountryFlag("RO")} RO</SelectItem>
                        <SelectItem value="IT">{getCountryFlag("IT")} IT</SelectItem>
                        <SelectItem value="DE">{getCountryFlag("DE")} DE</SelectItem>
                        <SelectItem value="US">{getCountryFlag("US")} US</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={smsCc} onChange={(e) => setSmsCc(e.target.value)} placeholder={t.customers?.details?.ccPhonePlaceholder || "+421..."} className="flex-1 text-xs h-8" data-testid="input-sms-cc" />
                  </div>
                )}
              </div>

              {/* Validation hints */}
              {(selectedPhones.length === 0 && !smsCc.trim()) && (
                <p className="text-[11px] text-destructive">• {t.customers?.details?.selectPhone || "Select at least one phone number"}</p>
              )}
              {!smsMessage && (
                <p className="text-[11px] text-amber-600 dark:text-amber-500">• {t.customers?.details?.writeSms || "Enter SMS message"}</p>
              )}

            </div>
          </div>

        </div>
      )}

      {activeChannel === "checklist" && (() => {
        if (dbStatusList.length > 0) {
          const dbVisibleItems = (dbStatusList as any[]).filter((i: any) => !i.isHidden && i.itemType !== "option" && i.confirmationType !== "auto");
          const hasSlTabAssignment = (dbStatusList as any[]).some((i: any) => !i.parentId && i.tab && i.itemType !== "option" && !i.isHidden);
          const slTabItems = hasSlTabAssignment
            ? dbVisibleItems.filter((i: any) => !i.tab || i.tab === slActiveTab)
            : dbVisibleItems;
          const dbConfirmed = dbVisibleItems.filter((i: any) => dbSlChecked.has(String(i.id))).length;
          const dbTotal = dbVisibleItems.length;
          const dbRequiredMissing = dbVisibleItems.filter((i: any) => i.required && !dbSlChecked.has(String(i.id)));
          const progress = dbTotal > 0 ? Math.round((dbConfirmed / dbTotal) * 100) : 0;

          // Per-phase stats for pipeline timeline
          const phaseStats = [
            { key: 'acquisition' as const, label: 'Acquisition',
              cardActive: 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-600 shadow-lg ring-1 ring-blue-400/40',
              labelColor: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500', pctColor: 'text-blue-500',
              barGradient: 'linear-gradient(90deg, #60a5fa 0%, #2563eb 100%)' },
            { key: 'contract' as const, label: 'Contract',
              cardActive: 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-600 shadow-lg ring-1 ring-violet-400/40',
              labelColor: 'text-violet-600 dark:text-violet-400', dotColor: 'bg-violet-500', pctColor: 'text-violet-500',
              barGradient: 'linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)' },
            { key: 'retention' as const, label: 'Retention',
              cardActive: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-600 shadow-lg ring-1 ring-emerald-400/40',
              labelColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500', pctColor: 'text-emerald-500',
              barGradient: 'linear-gradient(90deg, #34d399 0%, #059669 100%)' },
          ].map(ph => {
            const phItems = dbVisibleItems.filter((i: any) => {
              if (i.tab) return i.tab === ph.key;
              if (i.parentId) {
                const parent = (dbStatusList as any[]).find((p: any) => p.id === i.parentId);
                return (parent?.tab || null) === ph.key;
              }
              return false;
            });
            const confirmed = phItems.filter((i: any) => dbSlChecked.has(String(i.id))).length;
            return { ...ph, total: phItems.length, confirmed, pct: phItems.length > 0 ? Math.round((confirmed / phItems.length) * 100) : 0 };
          });

          return (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* ── Nexus Pulse Header + Phase Pipeline ─────────────── */}
              <div className="px-3 pt-2.5 pb-2.5 border-b bg-gradient-to-br from-primary/5 via-background to-background shrink-0">
                {/* ── Phase Journey Pipeline (tabs + progress) ─── */}
                {hasSlTabAssignment ? (
                  <div className="flex items-stretch gap-1">
                    {phaseStats.flatMap((ph, idx) => {
                      const isActive = slActiveTab === ph.key;
                      const isComplete = ph.total > 0 && ph.confirmed === ph.total;
                      const isStarted = ph.confirmed > 0;
                      const nodes: JSX.Element[] = [];
                      if (idx > 0) {
                        nodes.push(
                          <div key={`sep-${ph.key}`} className="flex items-center shrink-0 self-center px-0.5">
                            <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                          </div>
                        );
                      }
                      nodes.push(
                        <button
                          key={ph.key}
                          type="button"
                          onClick={() => {
                            setSlActiveTab(ph.key);
                            if (campaign?.id && campaignContactId) {
                              localStorage.setItem(`sl-tab-${campaign.id}-${campaignContactId}`, ph.key);
                            }
                          }}
                          className={`flex-1 rounded-xl border p-2.5 transition-all duration-200 text-left relative overflow-hidden ${
                            isActive ? ph.cardActive : 'bg-muted/20 dark:bg-muted/10 border-border/40 hover:bg-muted/50 hover:border-border/70'
                          }`}
                          data-testid={`sl-phase-${ph.key}`}
                        >
                          {/* Completion tick */}
                          {isComplete && (
                            <div className="absolute top-1.5 right-1.5">
                              <CheckCircle className={`h-3 w-3 ${ph.dotColor}`} />
                            </div>
                          )}
                          {/* Phase label row */}
                          <div className="flex items-center gap-1.5 mb-2 pr-4">
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${
                              isComplete ? 'bg-emerald-500' : isStarted ? ph.dotColor : 'bg-muted-foreground/20'
                            }`} />
                            <span className={`text-[9px] font-extrabold uppercase tracking-widest leading-none transition-colors ${
                              isActive ? ph.labelColor : 'text-muted-foreground/50'
                            }`}>
                              {ph.label}
                            </span>
                          </div>
                          {/* Mini progress bar */}
                          <div className="h-1.5 bg-black/5 dark:bg-white/8 rounded-full overflow-hidden mb-1.5">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: ph.total > 0 ? `${ph.pct}%` : '0%',
                                background: isComplete
                                  ? '#10b981'
                                  : ph.pct > 0
                                  ? ph.barGradient
                                  : 'transparent',
                              }}
                            />
                          </div>
                          {/* Count + pct */}
                          {ph.total > 0 ? (
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-[9px] tabular-nums font-semibold leading-none transition-colors ${
                                isActive ? ph.labelColor : 'text-muted-foreground/40'
                              }`}>
                                {ph.confirmed}/{ph.total}
                              </span>
                              <span className={`text-[9px] font-bold tabular-nums leading-none transition-colors ${
                                isComplete ? 'text-emerald-500' : isActive ? ph.pctColor : 'text-muted-foreground/30'
                              }`}>
                                {ph.pct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-muted-foreground/25 italic leading-none">—</span>
                          )}
                        </button>
                      );
                      return nodes;
                    })}
                  </div>
                ) : (
                  /* Fallback overall bar when no tab assignment */
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium tabular-nums">{progress}%</span>
                  </div>
                )}
              </div>

              {/* ── Not linked warning ─────────────────────────────── */}
              {!campaignContactId && (
                <div className="mx-3 mt-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-2.5 px-3 py-2.5 shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-800 dark:text-amber-300">{slu("notLinked", locale)}</span>
                </div>
              )}

              {/* ── Options panel ──────────────────────────────────── */}
              {(() => {
                const dbOptions = (dbStatusList as any[]).filter((i: any) => i.itemType === "option" && !i.isHidden);
                if (dbOptions.length === 0) return null;
                return (
                  <div className="mx-3 mt-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-gradient-to-br from-amber-50 to-amber-50/30 dark:from-amber-950/30 dark:to-transparent shrink-0 overflow-hidden" data-testid="status-list-options-panel">
                    <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                      <div className="h-5 w-5 rounded-md bg-amber-500/15 flex items-center justify-center shrink-0">
                        <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">{slu("options", locale)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                      {dbOptions.map((opt: any) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSlOptionSelect(opt)}
                          disabled={slRunningOption === opt.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-md shadow-black/10 transition-all hover:scale-105 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:scale-100"
                          style={{ backgroundColor: opt.color || "#6b7280" }}
                          data-testid={`option-btn-${opt.id}`}
                        >
                          {slRunningOption === opt.id && <Loader2 className="h-3 w-3 animate-spin" />}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}


              {/* ── Items list ─────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
                {slTabItems.map((item: any) => {
                  if (item.parentId) return null;
                  const childItems = (dbStatusList as any[]).filter((c: any) => !c.isHidden && c.parentId === String(item.id));
                  const isChecked = dbSlChecked.has(String(item.id));
                  const isInfo = item.confirmationType === "info";
                  return (
                  <div
                    id={`sl-step-${item.stepId}`}
                    key={item.id}
                    className={`relative rounded-xl border transition-all duration-200 overflow-hidden ${
                      isChecked
                        ? "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/60 shadow-sm"
                        : slHighlightedStep === item.stepId
                        ? "bg-primary/5 border-primary/60 shadow-md ring-2 ring-primary/30"
                        : item.tab === 'acquisition'
                        ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40 hover:border-blue-300/60 dark:hover:border-blue-700/50 hover:shadow-sm"
                        : item.tab === 'contract'
                        ? "bg-violet-50/50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/40 hover:border-violet-300/60 dark:hover:border-violet-700/50 hover:shadow-sm"
                        : item.tab === 'retention'
                        ? "bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-300/60 dark:hover:border-emerald-700/50 hover:shadow-sm"
                        : "bg-card border-border hover:border-primary/25 dark:hover:border-primary/35 hover:shadow-sm"
                    }`}
                  >
                    {/* Left accent bar */}
                    <div className={`absolute inset-y-0 left-0 w-[3px] rounded-l-xl transition-all duration-300 ${
                      isChecked ? "bg-emerald-500"
                      : item.tab === 'acquisition' ? "bg-blue-400/70"
                      : item.tab === 'contract' ? "bg-violet-400/70"
                      : item.tab === 'retention' ? "bg-emerald-400/70"
                      : isInfo ? "bg-blue-400" : "bg-muted-foreground/15"
                    }`} />
                    <div className="flex items-start gap-3 pl-4 pr-3 py-3">
                      {/* Checkbox / Info icon */}
                      <div className="shrink-0 mt-0.5">
                        {isInfo ? (
                          <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                            <Info className="h-3 w-3 text-blue-500" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSlToggle(String(item.id), !isChecked)}
                            className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                              isChecked
                                ? "bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30"
                                : "border-muted-foreground/30 bg-background hover:border-emerald-400 dark:hover:border-emerald-600"
                            }`}
                            data-testid={`sl-check-${item.id}`}
                          >
                            {isChecked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </button>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm leading-snug ${isChecked ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-semibold"}`}>
                          {item.label}
                          {item.required && <span className="ml-1 text-rose-500 text-[10px] font-bold">*</span>}
                        </div>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>}
                      {(() => {
                        const visibleQs = (item.questions || []).filter((q: any) => !q.isHidden);
                        if (visibleQs.length === 0) return null;
                        // Group by groupName so radio/checkbox sets stay together
                        const groups: Record<string, any[]> = {};
                        visibleQs.forEach((q: any) => {
                          const k = q.groupName || "__ungrouped__";
                          if (!groups[k]) groups[k] = [];
                          groups[k].push(q);
                        });
                        // Step-level exclusivity: when EVERY group in this step uses "ONE" mode,
                        // selecting any question clears ALL sub-questions across all groups.
                        const allGroupsAreOne = Object.values(groups).every(
                          (gList: any[]) => gList[0]?.logicOperator === "ONE"
                        );
                        return (
                          <div className="mt-2 pt-1.5 border-t border-dashed space-y-2" data-testid={`sl-questions-${item.id}`}>
                            {Object.entries(groups).map(([gk, gqs]) => (
                              <div key={gk}>
                                {gk !== "__ungrouped__" && (
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{gk}</p>
                                    {(gqs as any[])[0]?.logicOperator === "ONE" && (
                                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">1×</span>
                                    )}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-1">
                                  {(gqs as any[]).map((q: any) => {
                                    const ft = q.fieldType || "checkbox";
                                    const answered = slQuestionAnswers[q.id] !== undefined;
                                    const groupMode = (gqs as any[])[0]?.logicOperator === "ONE" ? "ONE" : undefined;
                                    // When all groups are 1× mode, pass ALL step questions so that
                                    // selecting one option clears every other option in the step.
                                    const exclusiveQs = (groupMode === "ONE" && allGroupsAreOne)
                                      ? visibleQs
                                      : gqs as any[];
                                    const hasActionable = (q.automations || []).some((a: any) =>
                                      a.actionType === "set_contact_status" || a.actionType === "set_callback" || a.actionType === "send_email_group"
                                    );
                                    const doAutoConfirmParent = () => {
                                      if (item.autoConfirmOnSubQuestion && !dbSlChecked.has(String(item.id))) {
                                        handleSlToggle(String(item.id), true);
                                        for (const a of (item.automations || [])) handleSlRunAction(a);
                                      }
                                    };
                                    if (ft === "yesno") {
                                      return (
                                        <div key={q.id} className="w-full" data-testid={`sl-question-${q.id}`}>
                                          {q.questionText && <p className="text-[10px] text-foreground/70 mb-1">{q.questionText}</p>}
                                          <div className="flex gap-1">
                                            <button type="button"
                                              onClick={() => { handleSlQuestionAnswer(q, "yes", exclusiveQs, groupMode); if (hasActionable) for (const a of (q.automations || [])) handleSlRunAction(a); doAutoConfirmParent(); }}
                                              className={`px-2.5 py-1 text-xs rounded border font-semibold transition-colors ${slQuestionAnswers[q.id] === "yes" ? "bg-green-500 border-green-500 text-white" : "border-border hover:bg-green-50 dark:hover:bg-green-950/20 text-foreground"}`}
                                              data-testid={`btn-sl-q-yes-${q.id}`}>Áno</button>
                                            <button type="button"
                                              onClick={() => { handleSlQuestionAnswer(q, "no", exclusiveQs, groupMode); if (hasActionable) for (const a of (q.automations || [])) handleSlRunAction(a); doAutoConfirmParent(); }}
                                              className={`px-2.5 py-1 text-xs rounded border font-semibold transition-colors ${slQuestionAnswers[q.id] === "no" ? "bg-red-500 border-red-500 text-white" : "border-border hover:bg-red-50 dark:hover:bg-red-950/20 text-foreground"}`}
                                              data-testid={`btn-sl-q-no-${q.id}`}>Nie</button>
                                          </div>
                                        </div>
                                      );
                                    }
                                    // checkbox / radio — render as styled choice pill
                                    const cbAuto = (q.automations || []).find((a: any) => a.actionType === "set_callback");
                                    const stAuto = (q.automations || []).find((a: any) => a.actionType === "set_contact_status");
                                    if (cbAuto) {
                                      return (
                                        <div key={q.id} data-testid={`sl-question-${q.id}`}>
                                          <SlCallbackButton
                                            automation={cbAuto}
                                            isRunning={slRunningAuto.has(String(cbAuto.id))}
                                            onRun={(a, opts) => { handleSlQuestionAnswer(q, true, exclusiveQs, groupMode); handleSlRunAction(a, opts); doAutoConfirmParent(); }}
                                            locale={locale}
                                            label={q.questionText}
                                          />
                                        </div>
                                      );
                                    }
                                    if (stAuto) {
                                      const stDisp = (slDispositions as any[]).find((d: any) => String(d.id) === String(stAuto.dispositionId));
                                      const isCallback = !!stDisp && ["callback", "schedule_email", "schedule_sms"].includes(stDisp.actionType);
                                      return (
                                        <div key={q.id} data-testid={`sl-question-${q.id}`}>
                                          <SlStatusButton
                                            automation={stAuto}
                                            isRunning={slRunningAuto.has(String(stAuto.id))}
                                            onRun={(a, opts) => { handleSlQuestionAnswer(q, true, exclusiveQs, groupMode); handleSlRunAction(a, opts); doAutoConfirmParent(); }}
                                            locale={locale}
                                            isCallback={isCallback}
                                            label={q.questionText}
                                          />
                                        </div>
                                      );
                                    }
                                    // No actionable automations: plain interactive choice chip
                                    // ONE mode: show radio-dot indicator regardless of fieldType
                                    const isOneMode = groupMode === "ONE";
                                    return (
                                      <button
                                        key={q.id}
                                        type="button"
                                        onClick={() => { handleSlQuestionAnswer(q, true, exclusiveQs, groupMode); doAutoConfirmParent(); }}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                          answered
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background border-border hover:border-primary/50 text-foreground"
                                        }`}
                                        style={q.color ? (answered ? { backgroundColor: q.color, borderColor: q.color, color: "#fff" } : { borderColor: q.color, color: q.color }) : undefined}
                                        data-testid={`btn-sl-q-${q.id}`}
                                      >
                                        {(ft === "radio" || isOneMode) && (
                                          <div className={`w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center shrink-0 ${answered ? "border-white" : "border-current"}`}>
                                            {answered && <div className="w-1 h-1 rounded-full bg-white" />}
                                          </div>
                                        )}
                                        {ft === "checkbox" && !isOneMode && (
                                          <div className={`w-2.5 h-2.5 rounded border-2 flex items-center justify-center shrink-0 ${answered ? "border-white" : "border-current"}`}>
                                            {answered && <Check className="h-1.5 w-1.5 text-white" />}
                                          </div>
                                        )}
                                        {q.questionText}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {(() => {
                        const itemState = (dbSlState as any[]).find((s: any) => String(s.statusListItemId) === String(item.id));
                        if (!itemState?.confirmedAt) return null;
                        const statusAuto = (item.automations || []).find((a: any) => a.actionType === "set_contact_status" && a.dispositionId);
                        const disp = statusAuto ? (slDispositions as any[]).find((d: any) => String(d.id) === String(statusAuto.dispositionId)) : null;
                        const dispName = disp ? (DISPOSITION_NAME_TRANSLATIONS[disp.code]?.[locale] || disp.name) : null;
                        const dispColor = disp?.color || "gray";
                        const dispColorMap: Record<string, string> = {
                          green: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
                          red: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
                          blue: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
                          orange: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
                          yellow: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
                          purple: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
                          gray: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
                        };
                        const dispBadgeCls = dispColorMap[dispColor] || dispColorMap.gray;
                        const agentInitial = itemState.confirmedByName
                          ? itemState.confirmedByName.charAt(0).toUpperCase()
                          : "?";
                        const hasCallbackNote = ccCallbackStatusListItemId === String(item.id) && !!ccCallbackNote;
                        return (
                          <div className="mt-1.5 space-y-1" data-testid={`sl-status-set-${item.id}`}>
                            {dispName && (
                              <span className={`inline-flex items-center gap-1 text-[10px] h-4 px-1.5 rounded-full border font-semibold ${dispBadgeCls}`} data-testid={`sl-status-name-${item.id}`}>
                                <Tag className="h-2.5 w-2.5" />{dispName}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <div className="h-4 w-4 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center overflow-hidden shrink-0" data-testid={`sl-agent-avatar-${item.id}`}>
                                {itemState.confirmedByAvatar ? (
                                  <img src={itemState.confirmedByAvatar} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-300">{agentInitial}</span>
                                )}
                              </div>
                              {itemState.confirmedByName && (
                                <span className="text-[10px] font-medium text-muted-foreground" data-testid={`sl-agent-name-${item.id}`}>{itemState.confirmedByName}</span>
                              )}
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400" data-testid={`sl-status-time-${item.id}`}>
                                ✓ {new Date(itemState.confirmedAt).toLocaleString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            {hasCallbackNote && (
                              <div className="flex items-start gap-1.5 px-2 py-1 rounded border bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-800" data-testid={`sl-callback-note-${item.id}`}>
                                <Phone className="h-2.5 w-2.5 text-cyan-500 mt-0.5 shrink-0" />
                                <p className="text-[10px] text-cyan-700 dark:text-cyan-300 leading-relaxed">{ccCallbackNote}</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <SlActionButtons automations={item.automations} onRun={handleSlRunAction} running={slRunningAuto} locale={locale} dispositions={slDispositions} />
                      {item.nextStepId && item.nextStepId !== "—" && (() => {
                        const targetItem = (dbStatusList as any[]).find((i: any) => i.stepId === item.nextStepId);
                        const targetExists = !!targetItem;
                        return (
                          <button
                            type="button"
                            onClick={() => scrollToSlStep(item.nextStepId)}
                            disabled={!targetExists}
                            className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-default group"
                            data-testid={`sl-nextstep-btn-${item.id}`}
                          >
                            <div className="flex items-center justify-center h-4 w-4 rounded bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
                              <ArrowRight className="h-2.5 w-2.5" />
                            </div>
                            <span className="font-mono text-muted-foreground/70 group-hover:text-primary/70 transition-colors">{item.nextStepId}</span>
                            {targetItem && <span className="truncate max-w-[160px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">{targetItem.label}</span>}
                          </button>
                        );
                      })()}
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground/30 shrink-0 pt-0.5">{item.stepId}</span>
                  </div>
                {childItems.length > 0 && (
                  <div className="border-t border-dashed border-border/40 bg-muted/20 px-4 py-2.5 space-y-2">
                    {childItems.map((child: any) => {
                      const childChecked = dbSlChecked.has(String(child.id));
                      return (
                        <div key={child.id} className="flex items-start gap-2.5">
                          <div className="w-0.5 self-stretch bg-border/40 shrink-0 ml-1 rounded-full" />
                          <button
                            type="button"
                            onClick={() => handleSlToggle(String(child.id), !childChecked)}
                            className={`mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${childChecked ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30 bg-background hover:border-emerald-400"}`}
                            data-testid={`sl-check-${child.id}`}
                          >
                            {childChecked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs leading-snug ${childChecked ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-foreground/90"}`}>
                              {child.label}
                              {child.required && <span className="ml-1 text-rose-500">*</span>}
                            </span>
                            {child.description && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{child.description}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
                ); })}
              </div>

              {/* ── Nexus Pulse Footer ─────────────────────────────── */}
              <div className="px-4 pb-3 pt-2.5 border-t bg-gradient-to-b from-transparent to-muted/20 shrink-0 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold shrink-0 tabular-nums ${progress === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{progress}%</span>
                </div>
                {dbRequiredMissing.length > 0 && (
                  <p className="text-[10px] text-rose-500 font-semibold text-center">{slu("requiredMissing", locale)} {dbRequiredMissing.map((i: any) => i.label).join(", ")}</p>
                )}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 justify-center">
                  <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                  {dbConfirmed > 0
                    ? `${dbConfirmed} ${slu("stepsAutoSaved", locale)}`
                    : slu("clickToSave", locale)}
                </div>
              </div>
            </div>
          );
        }
        const clSections = internalChecklistConfig.sections;
        const allClItems = clSections.flatMap(s => [...s.items, ...s.subsections.flatMap(sub => sub.items)]);
        const totalClItems = allClItems.length;

        const isItemAnswered = (item: { id: string; type: string }) => {
          if (item.type === "checkbox") return clChecked.has(item.id);
          if (item.type === "yes_no") return !!clYesNo[item.id];
          if (item.type === "text") return !!clTextValues[item.id]?.trim();
          return false;
        };

        const answeredCount = allClItems.filter(isItemAnswered).length;
        const requiredUnanswered = allClItems.filter(i => i.required && !isItemAnswered(i));

        if (!internalChecklistConfig.enabled || totalClItems === 0) {
          return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-16 px-6 gap-3">
              <div className="h-14 w-14 rounded-2xl bg-muted/50 border border-border flex items-center justify-center">
                <ListChecks className="h-7 w-7 opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">{slu("notConfigured", locale)}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{slu("notConfiguredHint", locale)}</p>
              </div>
            </div>
          );
        }

        const clHistoryEntries = (contactHistory || []).filter(h => h.action === "checklist_response");

        const triggerAutomation = (action: string) => {
          if (action === "openDisposition") onOpenDisposition?.();
          else if (action === "switchEmail") onChannelChange("email");
          else if (action === "switchSms") onChannelChange("sms");
        };

        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            {totalClItems > 0 && (
              <div className="px-4 pt-3 pb-1 shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Zodpovedané: {answeredCount}/{totalClItems}</span>
                  {requiredUnanswered.length > 0 && (
                    <span className="text-[10px] text-rose-500">* {requiredUnanswered.length} povinné nezodpovedané</span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${totalClItems > 0 ? (answeredCount / totalClItems) * 100 : 0}%` }} />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {clSections.map(sec => {
                const sAccent = sec.color || "";
                return (
                <div key={sec.id} className="rounded-xl border overflow-hidden shadow-sm" style={sAccent ? { borderLeftColor: sAccent, borderLeftWidth: "3px", borderColor: sAccent + "50" } : undefined}>
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30" style={sAccent ? { background: `linear-gradient(to right, ${sAccent}15, transparent)` } : { background: "hsl(var(--muted)/0.25)" }}>
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={sAccent ? { backgroundColor: sAccent + "25", color: sAccent } : { backgroundColor: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}>
                      <WsClIcon name={sec.icon || ""} className="h-3.5 w-3.5" style={sAccent ? { color: sAccent } : undefined} />
                      {!sec.icon && <ListChecks className="h-3.5 w-3.5" style={sAccent ? { color: sAccent } : undefined} />}
                    </div>
                    <p className={`text-xs flex-1 ${sec.bold ? "font-bold" : "font-semibold"} ${sec.italic ? "italic" : ""}`} style={sAccent ? { color: sAccent } : { color: "hsl(var(--muted-foreground))" }}>{sec.title}</p>
                  </div>
                  {sec.items.length > 0 && (
                  <div className="space-y-1.5 p-2.5 pb-1">
                    {sec.items.map(item => {
                      const answered = isItemAnswered(item);
                      const szCls = item.size === "sm" ? "text-xs" : item.size === "lg" ? "text-base" : "text-sm";
                      return (
                        <div key={item.id} className={`rounded-lg border p-3 transition-all ${answered ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-900/10" : "border-border bg-card/50"}`}>
                          <div className="flex items-start gap-2.5">
                            {item.required && <span className="text-[10px] text-rose-500 font-bold mt-0.5 shrink-0">*</span>}

                            {item.type === "checkbox" && (
                              <button
                                className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${clChecked.has(item.id) ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40 hover:border-emerald-400"}`}
                                onClick={() => {
                                  setClChecked(prev => { const next = new Set(prev); if (next.has(item.id)) { next.delete(item.id); } else { if (sec.selectionMode === "or") sec.items.filter(i => i.type === "checkbox").forEach(i => next.delete(i.id)); next.add(item.id); } return next; });
                                  if (item.automationAction !== "none" && !clChecked.has(item.id)) triggerAutomation(item.automationAction);
                                }}
                                data-testid={`cl-check-${item.id}`}
                              >
                                {clChecked.has(item.id) && <Check className="h-3 w-3 text-white" />}
                              </button>
                            )}

                            <div className="flex-1 min-w-0">
                              <span className={`${szCls} block mb-1.5 ${item.bold ? "font-bold" : ""} ${item.italic ? "italic" : ""} ${item.type === "checkbox" && clChecked.has(item.id) ? "text-muted-foreground line-through" : ""}`}>{item.label}</span>

                              {item.type === "yes_no" && (
                                <div className="flex gap-2">
                                  <button
                                    className={`text-xs px-3 py-1 rounded-md border transition-colors ${clYesNo[item.id] === "yes" ? "border-emerald-500 bg-emerald-500 text-white" : "border-emerald-400 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"}`}
                                    onClick={() => {
                                      const wasYes = clYesNo[item.id] === "yes";
                                      setClYesNo(prev => ({ ...prev, [item.id]: "yes" }));
                                      if (!wasYes && item.automationAction !== "none") triggerAutomation(item.automationAction);
                                    }}
                                    data-testid={`cl-yes-${item.id}`}
                                  >Áno</button>
                                  <button
                                    className={`text-xs px-3 py-1 rounded-md border transition-colors ${clYesNo[item.id] === "no" ? "border-rose-500 bg-rose-500 text-white" : "border-rose-400 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"}`}
                                    onClick={() => {
                                      setClYesNo(prev => ({ ...prev, [item.id]: "no" }));
                                    }}
                                    data-testid={`cl-no-${item.id}`}
                                  >Nie</button>
                                  {clYesNo[item.id] && (
                                    <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => setClYesNo(prev => { const n = { ...prev }; delete n[item.id]; return n; })}>
                                      ✕ zrušiť
                                    </button>
                                  )}
                                </div>
                              )}

                              {item.type === "text" && (
                                <input
                                  className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                                  placeholder="Zadajte odpoveď..."
                                  value={clTextValues[item.id] || ""}
                                  onChange={e => setClTextValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  data-testid={`cl-text-${item.id}`}
                                />
                              )}

                              {item.hasNotes && (
                                <textarea
                                  className="mt-1.5 w-full text-xs rounded-md border border-border bg-background p-2 resize-none min-h-[44px] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                                  placeholder="Poznámka..."
                                  value={clNotes[item.id] || ""}
                                  onChange={e => setClNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  data-testid={`cl-note-${item.id}`}
                                />
                              )}

                              {item.automationAction !== "none" && answered && (
                                <button
                                  className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline"
                                  onClick={() => triggerAutomation(item.automationAction)}
                                >
                                  ⚡ {item.automationAction === "openDisposition" ? "Otvoriť Disposíciu" : item.automationAction === "switchEmail" ? "Prejsť na Email" : "Prejsť na SMS"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                  {sec.subsections.map(sub => {
                    const subAccent = sub.color || sAccent;
                    return (
                    <div key={sub.id} className="mx-2.5 mb-2 rounded-lg border border-border/50 overflow-hidden" style={subAccent ? { borderLeftColor: subAccent, borderLeftWidth: "2px" } : undefined}>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/20" style={subAccent ? { background: `linear-gradient(to right, ${subAccent}0D, transparent)` } : { background: "hsl(var(--muted)/0.15)" }}>
                        <div className="h-5 w-5 rounded flex items-center justify-center shrink-0" style={subAccent ? { backgroundColor: subAccent + "20", color: subAccent } : { color: "hsl(var(--muted-foreground))" }}>
                          <WsClIcon name={sub.icon || ""} className="h-3 w-3" style={subAccent ? { color: subAccent } : undefined} />
                          {!sub.icon && <ChevronRight className="h-3 w-3" />}
                        </div>
                        <p className={`text-[11px] flex-1 ${sub.bold ? "font-bold" : "font-medium"} ${sub.italic ? "italic" : ""}`} style={sub.color ? { color: sub.color } : { color: "hsl(var(--muted-foreground))" }}>↳ {sub.title}</p>
                      </div>
                      <div className="space-y-1.5 p-2">
                        {sub.items.map(item => {
                          const answered = isItemAnswered(item);
                          const szCls = item.size === "sm" ? "text-xs" : item.size === "lg" ? "text-base" : "text-sm";
                          return (
                            <div key={item.id} className={`rounded-lg border p-3 transition-all ${answered ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-900/10" : "border-border bg-card/50"}`}>
                              <div className="flex items-start gap-2.5">
                                {item.required && <span className="text-[10px] text-rose-500 font-bold mt-0.5 shrink-0">*</span>}
                                {item.type === "checkbox" && (
                                  <button className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${clChecked.has(item.id) ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40 hover:border-emerald-400"}`}
                                    onClick={() => { setClChecked(prev => { const next = new Set(prev); if (next.has(item.id)) { next.delete(item.id); } else { if (sub.selectionMode === "or") sub.items.filter(i => i.type === "checkbox").forEach(i => next.delete(i.id)); next.add(item.id); } return next; }); if (item.automationAction !== "none" && !clChecked.has(item.id)) triggerAutomation(item.automationAction); }}
                                    data-testid={`cl-check-${item.id}`}>
                                    {clChecked.has(item.id) && <Check className="h-3 w-3 text-white" />}
                                  </button>
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className={`${szCls} block mb-1.5 ${item.bold ? "font-bold" : ""} ${item.italic ? "italic" : ""} ${item.type === "checkbox" && clChecked.has(item.id) ? "text-muted-foreground line-through" : ""}`}>{item.label}</span>
                                  {item.type === "yes_no" && (
                                    <div className="flex gap-2">
                                      <button className={`text-xs px-3 py-1 rounded-md border transition-colors ${clYesNo[item.id] === "yes" ? "border-emerald-500 bg-emerald-500 text-white" : "border-emerald-400 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"}`} onClick={() => { const was = clYesNo[item.id] === "yes"; setClYesNo(p => ({ ...p, [item.id]: "yes" })); if (!was && item.automationAction !== "none") triggerAutomation(item.automationAction); }} data-testid={`cl-yes-${item.id}`}>Áno</button>
                                      <button className={`text-xs px-3 py-1 rounded-md border transition-colors ${clYesNo[item.id] === "no" ? "border-rose-500 bg-rose-500 text-white" : "border-rose-400 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"}`} onClick={() => setClYesNo(p => ({ ...p, [item.id]: "no" }))} data-testid={`cl-no-${item.id}`}>Nie</button>
                                      {clYesNo[item.id] && <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => setClYesNo(p => { const n = { ...p }; delete n[item.id]; return n; })}>✕ zrušiť</button>}
                                    </div>
                                  )}
                                  {item.type === "text" && <input className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40" placeholder="Zadajte odpoveď..." value={clTextValues[item.id] || ""} onChange={e => setClTextValues(p => ({ ...p, [item.id]: e.target.value }))} data-testid={`cl-text-${item.id}`} />}
                                  {item.hasNotes && <textarea className="mt-1.5 w-full text-xs rounded-md border border-border bg-background p-2 resize-none min-h-[44px] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40" placeholder="Poznámka..." value={clNotes[item.id] || ""} onChange={e => setClNotes(p => ({ ...p, [item.id]: e.target.value }))} data-testid={`cl-note-${item.id}`} />}
                                  {item.automationAction !== "none" && answered && <button className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline" onClick={() => triggerAutomation(item.automationAction)}>⚡ {item.automationAction === "openDisposition" ? "Otvoriť Disposíciu" : item.automationAction === "switchEmail" ? "Prejsť na Email" : "Prejsť na SMS"}</button>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
                );
              })}

              {clHistoryEntries.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Predchádzajúce záznamy</p>
                  <div className="space-y-2">
                    {clHistoryEntries.slice(0, 5).map(entry => {
                      const prevSections = entry.metadata?.sections || [];
                      const prevItemsFlat = prevSections.flatMap((s: any) => [
                        ...(s.items || []),
                        ...(s.subsections || []).flatMap((sub: any) => sub.items || []),
                      ]);
                      const doneCount = prevItemsFlat.filter((i: any) => i.checked || i.answer === "yes" || (i.value && String(i.value).trim())).length;
                      return (
                        <div key={entry.id} className="rounded-md border border-border/50 p-2.5 bg-muted/30">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <CheckSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="text-xs font-medium">Status list</span>
                              <span className="text-xs text-muted-foreground">({doneCount}/{prevItemsFlat.length || totalClItems} zodp.)</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(entry.date), "d.M.yyyy HH:mm", { locale: sk })}</span>
                          </div>
                          {(() => {
                            const answered = prevItemsFlat.filter((i: any) => i.checked || i.answer === "yes" || (i.value && String(i.value).trim()));
                            if (answered.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {answered.map((i: any) => (
                                  <span key={i.id} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                    {i.type === "text" ? `${i.label}: ${i.value}` : i.label}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t bg-card/80 shrink-0">
              {requiredUnanswered.length > 0 && (
                <p className="text-[10px] text-rose-500 mb-2 text-center">Vyplňte povinné položky: {requiredUnanswered.map(i => i.label).join(", ")}</p>
              )}
              <Button
                className="w-full gap-2"
                disabled={answeredCount === 0 || requiredUnanswered.length > 0 || isSavingChecklist || !campaign?.id}
                onClick={async () => {
                  if (!campaign?.id) return;
                  setIsSavingChecklist(true);
                  const mapItemPayload = (item: WsCLItem) => ({ id: item.id, label: item.label, type: item.type, checked: item.type === "checkbox" ? clChecked.has(item.id) : false, answer: item.type === "yes_no" ? (clYesNo[item.id] || null) : null, value: item.type === "text" ? (clTextValues[item.id] || "") : null, note: clNotes[item.id] || "" });
                  const payload = {
                    sections: clSections.map(sec => ({
                      id: sec.id,
                      title: sec.title,
                      icon: sec.icon || "",
                      items: sec.items.map(mapItemPayload),
                      subsections: sec.subsections.map(sub => ({
                        id: sub.id,
                        title: sub.title,
                        icon: sub.icon || "",
                        items: sub.items.map(mapItemPayload),
                      })),
                    })),
                  };
                  if (!campaignContactId) {
                    setIsSavingChecklist(false);
                    toast({ title: "Status list uložený" });
                    return;
                  }
                  try {
                    await apiRequest("POST", `/api/campaigns/${campaign.id}/contacts/${campaignContactId}/checklist-response`, payload);
                    queryClient.invalidateQueries({ queryKey: ["/api/entity-history", contact?.id] });
                    clLoadedForContactRef.current = contact?.id || null;
                    toast({ title: "Status list uložený" });
                  } catch {
                    toast({ title: "Chyba pri ukladaní status listu", variant: "destructive" });
                  } finally {
                    setIsSavingChecklist(false);
                  }
                }}
                data-testid="btn-save-checklist"
              >
                {isSavingChecklist ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
                Uložiť status list{answeredCount > 0 ? ` (${answeredCount}/${totalClItems})` : ""}
              </Button>
            </div>
          </div>
        );
      })()}


      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t.agentWorkspace.history} — {contact?.firstName} {contact?.lastName}
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start shrink-0">
              <TabsTrigger value="all" data-testid="history-modal-tab-all">
                {t.common?.all || "All"} ({mergedHistory.all.length})
              </TabsTrigger>
              <TabsTrigger value="email" data-testid="history-modal-tab-email">
                <Mail className="h-3.5 w-3.5 mr-1" />
                Email ({mergedHistory.email.length})
              </TabsTrigger>
              <TabsTrigger value="sms" data-testid="history-modal-tab-sms">
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                SMS ({mergedHistory.sms.length})
              </TabsTrigger>
            </TabsList>
            {(["all", "email", "sms"] as const).map((tabKey) => (
              <TabsContent key={tabKey} value={tabKey} className="flex-1 mt-0 overflow-hidden">
                <ScrollArea className="h-[55vh]">
                  <div className="p-3 space-y-2">
                    {(tabKey === "all" ? mergedHistory.all : tabKey === "email" ? mergedHistory.email : mergedHistory.sms).length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        {tabKey === "email" ? <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" /> :
                         tabKey === "sms" ? <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" /> :
                         <History className="h-10 w-10 mx-auto mb-3 opacity-20" />}
                        <p className="text-sm font-medium">{t.agentWorkspace.noHistory || "No communication history"}</p>
                      </div>
                    ) : (tabKey === "all" ? mergedHistory.all : tabKey === "email" ? mergedHistory.email : mergedHistory.sms).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border border-border/50 cursor-pointer hover-elevate transition-colors"
                        data-testid={`history-modal-entry-${entry.id}`}
                        onClick={() => { onOpenHistoryDetail?.(entry as any); setShowHistoryModal(false); }}
                      >
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          entry.type === "call" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" :
                          entry.type === "email" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400" :
                          entry.type === "sms" ? "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400" :
                          entry.type === "note" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" :
                          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {entry.type === "call" && <PhoneCall className="h-3.5 w-3.5" />}
                          {entry.type === "email" && <Mail className="h-3.5 w-3.5" />}
                          {entry.type === "sms" && <MessageSquare className="h-3.5 w-3.5" />}
                          {entry.type === "note" && <FileText className="h-3.5 w-3.5" />}
                          {entry.type === "system" && <AlertCircle className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] h-5 capitalize">
                              {entry.type === "call" ? "Hovor" : entry.type === "email" ? "Email" : entry.type === "sms" ? "SMS" : entry.type === "note" ? "Poznámka" : "Systém"}
                            </Badge>
                            {entry.direction && (
                              <Badge variant="secondary" className="text-[10px] h-5">
                                {entry.direction === "inbound" ? "Prichádzajúci" : "Odchádzajúci"}
                              </Badge>
                            )}
                            {entry.status && (
                              <Badge variant="secondary" className="text-[10px] h-5">{entry.status}</Badge>
                            )}
                            {(entry.type === "email" || entry.type === "sms") && (entry as any).sentiment && (
                              <SentimentBadge sentiment={(entry as any).sentiment} size="sm" />
                            )}
                            {entry.recipientEmail && (
                              <span className="text-[10px] text-muted-foreground truncate">{entry.recipientEmail}</span>
                            )}
                            {entry.recipientPhone && (
                              <span className="text-[10px] text-muted-foreground">{entry.recipientPhone}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                              {format(new Date(entry.timestamp), "d.M.yyyy HH:mm", { locale: sk })}
                            </span>
                          </div>
                          <p className="text-xs text-foreground mt-1 line-clamp-2">{entry.content}</p>
                          {entry.details && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{entry.details?.replace(/<[^>]*>/g, '')}</p>
                          )}
                          {entry.agentName && (
                            <div className="flex items-center gap-1 mt-1">
                              <UserCircle className="h-3 w-3 text-muted-foreground/60" />
                              <span className="text-[10px] text-muted-foreground">{entry.agentName}</span>
                            </div>
                          )}
                          {entry.type === "call" && (entry as any).callLogId && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <CallRecordingPlayer callLogId={(entry as any).callLogId} compact />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function CustomerDocumentsPanel({ customerId }: { customerId: string }) {
  const { t } = useI18n();
  const [typeFilter, setTypeFilter] = useState<"all" | "contract" | "invoice">("all");
  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/documents`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!customerId,
  });

  const filteredDocs = typeFilter === "all" ? documents : documents.filter((d: any) => d.type === typeFilter);
  const contractCount = documents.filter((d: any) => d.type === "contract").length;
  const invoiceCount = documents.filter((d: any) => d.type === "invoice").length;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
        <FileText className="h-10 w-10 mb-3 opacity-30" />
        <span className="text-sm">{t.customers?.details?.noDocuments || "No documents"}</span>
      </div>
    );
  }

  const handleDownloadPdf = (doc: any) => {
    window.open(`/api/customers/${customerId}/documents/${doc.type}/${doc.id}/pdf`, "_blank");
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 pt-3 pb-2 flex gap-1.5" data-testid="doc-type-filter">
        <Button
          size="sm"
          variant={typeFilter === "all" ? "default" : "outline"}
          className="h-6 text-[10px] px-2 rounded-full"
          onClick={() => setTypeFilter("all")}
          data-testid="filter-doc-all"
        >
          {t.common?.all || "All"} ({documents.length})
        </Button>
        <Button
          size="sm"
          variant={typeFilter === "contract" ? "default" : "outline"}
          className="h-6 text-[10px] px-2 rounded-full"
          onClick={() => setTypeFilter("contract")}
          data-testid="filter-doc-contract"
        >
          {t.customers?.details?.contract || "Contracts"} ({contractCount})
        </Button>
        <Button
          size="sm"
          variant={typeFilter === "invoice" ? "default" : "outline"}
          className="h-6 text-[10px] px-2 rounded-full"
          onClick={() => setTypeFilter("invoice")}
          data-testid="filter-doc-invoice"
        >
          {t.customers?.details?.invoice || "Invoices"} ({invoiceCount})
        </Button>
      </div>
      <ScrollArea className="flex-1">
      <div className="px-4 py-2 space-y-2">
        {filteredDocs.map((doc: any) => (
          <div
            key={`${doc.type}-${doc.id}`}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            data-testid={`doc-row-${doc.type}-${doc.id}`}
          >
            <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
              doc.type === "contract"
                ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                : "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400"
            }`}>
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium truncate">
                  {doc.number || doc.id}
                </span>
                <Badge variant={doc.type === "contract" ? "default" : "secondary"} className="text-[9px] h-4 px-1.5 shrink-0">
                  {doc.type === "contract" ? (t.customers?.details?.contract || "Contract") : (t.customers?.details?.invoice || "Invoice")}
                </Badge>
                {doc.status && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] h-4 px-1.5 shrink-0 ${
                      doc.status === "active" || doc.status === "paid" ? "text-green-600 border-green-300" :
                      doc.status === "cancelled" || doc.status === "overdue" ? "text-red-600 border-red-300" :
                      "text-yellow-600 border-yellow-300"
                    }`}
                  >
                    {doc.status}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {doc.totalAmount && (
                  <span className="text-[10px] font-semibold text-foreground">
                    {Number(doc.totalAmount).toLocaleString()} {doc.currency || "EUR"}
                  </span>
                )}
                {doc.createdAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                )}
                {doc.createdByName && (
                  <span className="text-[10px] text-muted-foreground">
                    {doc.createdByName}
                  </span>
                )}
              </div>
            </div>
            {doc.pdfPath && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => handleDownloadPdf(doc)}
                data-testid={`btn-download-doc-${doc.id}`}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
    </div>
  );
}

function CustomerInfoPanel({
  contact,
  contactType,
  campaign,
  callNotes,
  onAddNote,
  onDisposition,
  onQuickAction,
  rightTab,
  onRightTabChange,
  contactHistory,
  dispositions,
  currentUserId,
  onOpenDispositionModal,
  callState,
  callDuration,
  ringDuration,
  hungUpBy,
  onEndCall,
  onOpenDispositionFromCall,
  isMuted,
  isOnHold,
  volume,
  micVolume,
  onToggleMute,
  onToggleHold,
  onSendDtmf,
  onVolumeChange,
  onMicVolumeChange,
  callerNumber,
  onEditCustomer,
  onViewCustomer,
  onOpenHistoryDetail,
  inboundMatches,
  onSelectMatch,
  wrapUpElapsed,
  unknownCallerPhone,
  onCreateFromCall,
  forwardedCallActive,
  onOpenDispositionFromForwardedCall,
  onEndForwardedCall,
  acwStartedAt,
  onCloseAcwTask,
  onCloseCallAfterStatusList,
  isStatusListMode,
  campaignContactId,
}: {
  contact: Customer | null;
  contactType?: string;
  campaign: Campaign | null;
  callNotes: string;
  onAddNote: (note: string) => Promise<void> | void;
  onDisposition: (value: string, parentCode?: string, callbackDateTime?: string, callbackAssignedTo?: string | null, callbackNote?: string) => void;
  onQuickAction: (action: string) => void;
  rightTab: string;
  onRightTabChange: (tab: string) => void;
  contactHistory: ContactHistory[];
  dispositions: CampaignDisposition[];
  currentUserId?: string;
  onOpenDispositionModal: () => void;
  callState: string;
  callDuration: number;
  ringDuration: number;
  hungUpBy: "user" | "customer" | null;
  onEndCall: () => void;
  onOpenDispositionFromCall: () => void;
  wrapUpElapsed?: number;
  isMuted: boolean;
  isOnHold: boolean;
  volume: number;
  micVolume: number;
  onToggleMute: () => void;
  onToggleHold: () => void;
  onSendDtmf: (digit: string) => void;
  onVolumeChange: (vol: number) => void;
  onMicVolumeChange: (vol: number) => void;
  callerNumber: string;
  onEditCustomer: () => void;
  onViewCustomer: () => void;
  onOpenHistoryDetail?: (entry: ContactHistory) => void;
  inboundMatches?: PhoneMatch[];
  onSelectMatch?: (match: PhoneMatch, mode: "card" | "details" | "open") => void;
  unknownCallerPhone?: string | null;
  onCreateFromCall?: (type: "customer" | "hospital" | "clinic" | "person") => void;
  forwardedCallActive?: { callId: string; callerNumber: string; callerName?: string; startedAt: Date } | null;
  onOpenDispositionFromForwardedCall?: () => void;
  onEndForwardedCall?: () => void;
  acwStartedAt?: number | null;
  onCloseAcwTask?: () => void;
  onCloseCallAfterStatusList?: () => void;
  isStatusListMode?: boolean;
  campaignContactId?: string | null;
}) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const callContext = useCall();
  const [acwElapsed, setAcwElapsed] = useState(0);
  useEffect(() => {
    if (!acwStartedAt) { setAcwElapsed(0); return; }
    const iv = setInterval(() => setAcwElapsed(Math.floor((Date.now() - acwStartedAt) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [acwStartedAt]);
  const [newNote, setNewNote] = useState("");
  const [showDialpad, setShowDialpad] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [faqExpandedId, setFaqExpandedId] = useState<string | null>(null);
  const [faqSearchQuery, setFaqSearchQuery] = useState("");
  const [historyMaximized, setHistoryMaximized] = useState(false);
  const [expandedSlItems, setExpandedSlItems] = useState<Set<string>>(new Set());
  const [faqMaximized, setFaqMaximized] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [matchesExpanded, setMatchesExpanded] = useState(false);
  const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
  const dialPadButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  const hasCall = callState === "connecting" || callState === "ringing" || callState === "active" || callState === "on_hold" || (callState === "ended" && hungUpBy);

  const [forwardedElapsed, setForwardedElapsed] = useState(0);
  useEffect(() => {
    if (!forwardedCallActive) { setForwardedElapsed(0); return; }
    setForwardedElapsed(Math.floor((Date.now() - forwardedCallActive.startedAt.getTime()) / 1000));
    const iv = setInterval(() => setForwardedElapsed(Math.floor((Date.now() - forwardedCallActive.startedAt.getTime()) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [forwardedCallActive]);

  const [selectedNote, setSelectedNote] = useState<{ content: string; userName: string; createdAt: string } | null>(null);

  // Notes endpoint depends on contact type: customers keep the legacy customer-notes
  // table; clinic/hospital/collaborator use the generic entity-notes endpoint.
  const notesEndpoint = contact?.id
    ? (contactType && contactType !== "customer"
        ? `/api/entity-notes/${contactType}/${contact.id}`
        : `/api/customers/${contact.id}/notes`)
    : null;

  const { data: customerNotes = [], refetch: refetchNotes } = useQuery<Array<{ id: string; content: string; userId: string; userName: string; createdAt: string }>>({
    queryKey: [notesEndpoint],
    queryFn: async () => {
      const res = await fetch(notesEndpoint!, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!notesEndpoint,
    staleTime: 0,
  });

  const handleAddNote = async () => {
    if (!newNote.trim() || !contact?.id) return;
    const noteText = newNote;
    setNewNote("");
    await onAddNote(noteText);
    refetchNotes();
  };

  if (!contact) {
    if (unknownCallerPhone) {
      return (
        <div className="w-64 border-l bg-card flex flex-col shrink-0">
          <div className="p-4 border-b border-border bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-1">
              <PhoneIncoming className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Neznámy volajúci</span>
            </div>
            <p className="text-sm font-mono font-bold text-foreground">{unknownCallerPhone}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Vyberte typ záznamu, ktorý chcete vytvoriť</p>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {([
              { type: "customer" as const, label: "Zákazník", icon: <User className="h-5 w-5" />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 border-blue-200 dark:border-blue-800" },
              { type: "hospital" as const, label: "Nemocnica", icon: <Building2 className="h-5 w-5" />, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 border-purple-200 dark:border-purple-800" },
              { type: "clinic" as const, label: "Ambulancia", icon: <Stethoscope className="h-5 w-5" />, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-950/30 hover:bg-teal-100 dark:hover:bg-teal-950/50 border-teal-200 dark:border-teal-800" },
              { type: "person" as const, label: "Osoba", icon: <Users className="h-5 w-5" />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 border-amber-200 dark:border-amber-800" },
            ]).map(({ type, label, icon, color, bg }) => (
              <button
                key={type}
                onClick={() => onCreateFromCall?.(type)}
                data-testid={`btn-create-from-call-${type}`}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${bg}`}
              >
                <span className={color}>{icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${color}`}>{label}</p>
                  <p className="text-[11px] text-muted-foreground">Vytvoriť nový záznam</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="w-64 border-l bg-card flex items-center justify-center shrink-0">
        <div className="text-center p-6">
          <User className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground">{t.agentWorkspace.noContact}</p>
        </div>
      </div>
    );
  }

  const leadScore = (contact as any).leadScore || 0;
  const stars = Math.round(leadScore / 20);

  return (
    <div className="w-64 flex flex-col shrink-0 bg-card border-l border-border">
      <div className="p-3 bg-card/80 border-b border-border">
        <div className="flex items-start gap-2.5">
          <Avatar className="h-10 w-10 shrink-0" style={{ boxShadow: "0 0 0 2px #B5622E55" }}>
            <AvatarFallback className="font-bold text-xs text-white" style={{ background: "linear-gradient(135deg, #B5622E 0%, #D4854F 100%)" }}>
              {contact.firstName?.[0]}{contact.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h2 className="font-bold text-sm truncate flex-1 text-foreground" data-testid="text-contact-name">
                {contact.firstName} {contact.lastName}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge className="text-[10px] border-0 font-medium bg-muted text-muted-foreground">
                {contact.status || "Nový"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {acwStartedAt && !["active", "ringing", "connecting", "on_hold"].includes(callState) && (
        <div className="border-b px-3 py-2 bg-amber-50 dark:bg-amber-950/30" data-testid="acw-banner">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">ACW — After Call Work</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  {String(Math.floor(acwElapsed / 60)).padStart(2, "0")}:{String(acwElapsed % 60).padStart(2, "0")}
                </p>
              </div>
            </div>
            {onCloseAcwTask && (
              <button
                onClick={onCloseAcwTask}
                data-testid="button-close-acw-task"
                className="shrink-0 text-[11px] font-medium px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white transition-colors"
              >
                {t.agentWorkspace.acwCloseTask || "Zatvoriť task"}
              </button>
            )}
          </div>
        </div>
      )}

      {hasCall && (
        <div className={`border-b px-3 py-2 space-y-2 ${
          (callState === "connecting" || callState === "ringing")
            ? "bg-green-50 dark:bg-green-950/30"
            : (callState === "active" || callState === "on_hold")
              ? "bg-blue-50 dark:bg-blue-950/30"
              : hungUpBy === "customer"
                ? "bg-red-50 dark:bg-red-950/30"
                : "bg-orange-50 dark:bg-orange-950/30"
        }`} data-testid="call-controls-card">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                (callState === "connecting" || callState === "ringing") ? "bg-green-500 animate-pulse" :
                (callState === "active") ? "bg-blue-500 animate-pulse" :
                (callState === "on_hold") ? "bg-orange-500" :
                "bg-red-500"
              }`} />
              <span className="text-xs font-semibold truncate">
                {(callState === "connecting") ? t.callBar.connecting :
                 (callState === "ringing") ? t.callBar.ringing :
                 (callState === "on_hold") ? t.callBar.onHold :
                 (callState === "ended" && hungUpBy === "customer") ? t.callBar.customerHungUp :
                 (callState === "ended") ? t.callBar.callEnded :
                 t.callBar.active}
              </span>
            </div>
            <span className="font-mono text-sm font-bold tabular-nums shrink-0">
              {(callState === "active" || callState === "on_hold") ? fmtTime(callDuration) :
               (callState === "connecting" || callState === "ringing") ? fmtTime(ringDuration) : ""}
            </span>
          </div>

          {callerNumber && (
            <div className="text-[11px] text-muted-foreground font-mono">{callerNumber}</div>
          )}

          {inboundMatches && inboundMatches.length > 0 && (() => {
            const colorMap: Record<string, string> = {
              customer: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
              hospital: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
              clinic: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
              collaborator: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            };
            const labelMap: Record<string, string> = {
              customer: "Zákazník", hospital: "Nemocnica", clinic: "Klinika", collaborator: "Spolupracovník",
            };
            return (
              <div className="pt-0.5">
                <button
                  onClick={() => setMatchesExpanded(p => !p)}
                  className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
                  data-testid="btn-toggle-inbound-matches"
                >
                  <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground flex-1">
                    {inboundMatches.length} {inboundMatches.length === 1 ? "zhoda" : inboundMatches.length < 5 ? "zhody" : "zhôd"}
                  </span>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${matchesExpanded ? "rotate-180" : ""}`} />
                </button>
                {matchesExpanded && (
                  <div className="space-y-0.5 mt-0.5 max-h-48 overflow-y-auto">
                    {inboundMatches.map((match) => (
                      <button
                        key={`${match.entityType}-${match.id}`}
                        onClick={() => { onSelectMatch?.(match, match.entityType === "customer" ? "card" : "open"); setMatchesExpanded(false); }}
                        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-md hover:bg-muted/70 transition-colors"
                        data-testid={`btn-phone-match-${match.entityType}-${match.id}`}
                      >
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${colorMap[match.entityType] || "bg-muted text-muted-foreground"}`}>
                          {labelMap[match.entityType] || match.entityType}
                        </span>
                        <span className="text-[11px] font-medium truncate flex-1 min-w-0">{match.name}</span>
                        {match.subtype && <span className="text-[10px] text-muted-foreground truncate">{match.subtype}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {(callState === "active" || callState === "on_hold") && callContext.isRecording && (
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50">
              <div className={`w-2 h-2 rounded-full shrink-0 ${callContext.isRecordingPaused ? "bg-orange-500" : "bg-red-500 animate-pulse"}`} />
              <span className={`text-[11px] font-semibold ${callContext.isRecordingPaused ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"}`}>
                {callContext.isRecordingPaused ? "REC PAUSED" : "REC"}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 ml-auto"
                onClick={() => {
                  if (callContext.isRecordingPaused) {
                    callContext.resumeRecordingFn.current?.();
                  } else {
                    callContext.pauseRecordingFn.current?.();
                  }
                }}
                data-testid="button-toggle-recording-pause"
                title={callContext.isRecordingPaused ? t.callBar.resumeRecording : t.callBar.pauseRecording}
              >
                {callContext.isRecordingPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </Button>
            </div>
          )}

          {(callState === "active" || callState === "on_hold") && (
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                size="icon"
                variant={isMuted ? "destructive" : "outline"}
                onClick={onToggleMute}
                data-testid="button-card-mute"
                title={isMuted ? t.callBar.unmute : t.callBar.mute}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>

              <Button
                size="icon"
                variant={isOnHold ? "secondary" : "outline"}
                onClick={onToggleHold}
                data-testid="button-card-hold"
                title={isOnHold ? t.callBar.resume : t.callBar.hold}
              >
                {isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>

              <Popover open={showDialpad} onOpenChange={setShowDialpad}>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="outline" data-testid="button-card-dialpad" title={t.callBar.dialpad}>
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="center" side="left">
                  <div className="grid grid-cols-3 gap-1">
                    {dialPadButtons.map((digit) => (
                      <Button
                        key={digit}
                        variant="outline"
                        size="sm"
                        className="h-9 text-sm font-semibold"
                        onClick={() => onSendDtmf(digit)}
                        data-testid={`button-card-dtmf-${digit}`}
                      >
                        {digit}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={showVolume} onOpenChange={setShowVolume}>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="outline" data-testid="button-card-volume" title={t.callBar.volume}>
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 space-y-3" align="center" side="left">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Volume2 className="h-3 w-3" /> {t.callBar.speaker}</span>
                      <span className="text-xs font-mono">{volume}%</span>
                    </div>
                    <Slider value={[volume]} onValueChange={([v]) => onVolumeChange(v)} max={100} step={1} data-testid="slider-card-speaker" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Mic className="h-3 w-3" /> {t.callBar.microphone}</span>
                      <span className="text-xs font-mono">{micVolume}%</span>
                    </div>
                    <Slider value={[micVolume]} onValueChange={([v]) => onMicVolumeChange(v)} max={100} step={1} data-testid="slider-card-mic" />
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => { onEndCall(); if (!isStatusListMode) onOpenDispositionFromCall(); }}
                className="gap-1 ml-auto"
                data-testid="button-card-end-call"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                <span className="text-xs">{t.callBar.endCall}</span>
              </Button>
            </div>
          )}

          {(callState === "connecting" || callState === "ringing") && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { onEndCall(); if (!isStatusListMode) onOpenDispositionFromCall(); }}
              className="w-full gap-1.5"
              data-testid="button-card-cancel-call"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              {t.callBar.endCall}
            </Button>
          )}

          {!isStatusListMode && callState === "ended" && hungUpBy && (
            <div className="space-y-1">
              {(wrapUpElapsed ?? 0) > 0 && (
                <div
                  className={`flex items-center justify-center gap-1 text-[11px] font-semibold rounded px-2 py-0.5 transition-colors ${
                    (wrapUpElapsed ?? 0) >= 10
                      ? "bg-red-100 text-red-700"
                      : (wrapUpElapsed ?? 0) >= 5
                      ? "bg-amber-100 text-amber-700"
                      : "bg-stone-100 text-stone-500"
                  }`}
                  data-testid="text-wrapup-elapsed"
                >
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {t.agentWorkspace.wrapUpPending}: {String(Math.floor((wrapUpElapsed ?? 0) / 60)).padStart(2, "0")}:{String((wrapUpElapsed ?? 0) % 60).padStart(2, "0")}
                </div>
              )}
              <Button
                size="sm"
                onClick={onOpenDispositionFromCall}
                className={`w-full gap-1.5 text-white transition-all duration-300 ${
                  (wrapUpElapsed ?? 0) >= 10
                    ? "bg-red-600 hover:bg-red-500 animate-pulse ring-2 ring-red-400 ring-offset-1"
                    : (wrapUpElapsed ?? 0) >= 5
                    ? "bg-amber-600 hover:bg-amber-500 animate-pulse"
                    : "bg-red-900 hover:bg-red-800"
                }`}
                data-testid="button-card-disposition"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {t.agentWorkspace.enterDisposition}
              </Button>
            </div>
          )}

          {isStatusListMode && callState === "ended" && hungUpBy && !acwStartedAt && (
            <div className="space-y-1.5" data-testid="status-list-call-ended-section">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                <PhoneOff className="h-3 w-3 shrink-0" />
                <span>
                  {hungUpBy === "customer"
                    ? (t.callBar.customerHungUp || "Zákazník položil")
                    : (t.callBar.callEnded || "Hovor ukončený")}
                </span>
                {(wrapUpElapsed ?? 0) > 0 && (
                  <span className="font-mono ml-1" data-testid="text-status-list-wrapup-elapsed">
                    {String(Math.floor((wrapUpElapsed ?? 0) / 60)).padStart(2, "0")}:{String((wrapUpElapsed ?? 0) % 60).padStart(2, "0")}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                onClick={onCloseCallAfterStatusList}
                className="w-full gap-1.5 bg-stone-700 hover:bg-stone-600 text-white"
                data-testid="button-close-status-list-call"
              >
                <PhoneOff className="h-3.5 w-3.5 shrink-0" />
                {t.agentWorkspace.acwCloseTask || "Zatvoriť"}
              </Button>
            </div>
          )}
        </div>
      )}

      {!hasCall && forwardedCallActive && (
        <div className="border-b px-3 py-2 space-y-2 bg-green-50 dark:bg-green-950/30" data-testid="forwarded-call-panel">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold truncate text-green-800 dark:text-green-300">Presmerovaný hovor</span>
            </div>
            <span className="font-mono text-sm font-bold tabular-nums shrink-0 text-green-800 dark:text-green-300">
              {fmtTime(forwardedElapsed)}
            </span>
          </div>
          {forwardedCallActive.callerNumber && (
            <div className="text-[11px] text-muted-foreground font-mono">{forwardedCallActive.callerNumber}</div>
          )}
          <div className="flex gap-1.5 pt-0.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1 text-xs h-7"
              onClick={onOpenDispositionFromForwardedCall}
              data-testid="button-forwarded-disposition"
            >
              <FileText className="h-3 w-3 shrink-0" />
              Dispozícia
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1 text-xs h-7 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={onEndForwardedCall}
              data-testid="button-forwarded-end-work"
            >
              <PhoneOff className="h-3 w-3 shrink-0" />
              Ukončiť prácu
            </Button>
          </div>
        </div>
      )}

      <div className="border-b border-border bg-card/60 dark:bg-card">
        <div className="flex">
          {(["actions", "profile", "history", "faq"] as const).map((tab) => (
            <button
              key={tab}
              className="flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-colors"
              style={{
                borderBottomColor: rightTab === tab ? "#B5622E" : "transparent",
                color: rightTab === tab ? "#B5622E" : "hsl(var(--muted-foreground))",
              }}
              onClick={() => onRightTabChange(tab)}
              data-testid={`tab-${tab}`}
            >
              {tab === "actions" ? t.agentWorkspace.actions
                : tab === "profile" ? t.agentWorkspace.profile
                : tab === "history" ? t.agentWorkspace.history
                : "FAQ"}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {rightTab === "profile" && (
          <div className="p-3 space-y-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#B5622E22" }}>
                  <Phone className="h-3.5 w-3.5" style={{ color: "#B5622E" }} />
                </div>
                <span className="text-sm font-medium truncate text-foreground" data-testid="text-contact-phone">
                  {contact.phone || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-violet-50 border border-violet-200 dark:bg-violet-950/20 dark:border-violet-900/30">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#5B4FCF22" }}>
                  <Mail className="h-3.5 w-3.5" style={{ color: "#5B4FCF" }} />
                </div>
                <span className="text-sm truncate text-foreground" data-testid="text-contact-email">
                  {contact.email || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border dark:bg-muted/20">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#9A887822" }}>
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm text-foreground">{[contact.address, contact.city].filter(Boolean).join(", ") || "—"}</span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border dark:bg-muted/20">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#9A887822" }}>
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm text-foreground">{contact.country || "SK"}</span>
              </div>
            </div>

            {campaign && (
              <div className="pt-2 border-t border-border">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-muted-foreground">
                  Kampaň
                </h4>
                <div className="p-2.5 rounded-xl bg-card border border-border">
                  <p className="text-sm font-medium text-foreground">{campaign.name}</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">{campaign.type} / {campaign.channel}</p>
                </div>
              </div>
            )}

          </div>
        )}

        {rightTab === "history" && (() => {
          const [histSearchQuery, setHistSearchQuery] = [historySearchQuery, setHistorySearchQuery];
          const [histTypeFilter, setHistTypeFilter] = [historyTypeFilter, setHistoryTypeFilter];

          const typeLabels: Record<string, string> = { all: t.agentWorkspace.historyAll, call: t.agentWorkspace.historyCalls, email: t.agentWorkspace.historyEmailsFilter, sms: t.agentWorkspace.historySmsFilter, disposition: t.agentWorkspace.historyDispositionsFilter };
          const typeCounts = contactHistory.reduce((acc, item) => {
            acc[item.type] = (acc[item.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const filteredHistory = contactHistory.filter((item) => {
            if (histTypeFilter !== "all" && item.type !== histTypeFilter) return false;
            if (histSearchQuery.trim()) {
              const q = histSearchQuery.toLowerCase();
              const searchable = [
                item.content,
                item.notes,
                item.details?.replace(/<[^>]*>/g, ''),
                item.agentName,
                item.campaignName,
                (item as any).recipientEmail,
                (item as any).recipientPhone,
                (item as any).fullContent,
                item.status,
              ].filter(Boolean).join(" ").toLowerCase();
              if (!searchable.includes(q)) return false;
            }
            return true;
          });

          const highlightMatch = (text: string | undefined | null) => {
            if (!text || !histSearchQuery.trim()) return text || "";
            const q = histSearchQuery.trim();
            const idx = text.toLowerCase().indexOf(q.toLowerCase());
            if (idx === -1) return text;
            return (
              <>{text.substring(0, idx)}<mark className="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded-sm px-0.5">{text.substring(idx, idx + q.length)}</mark>{text.substring(idx + q.length)}</>
            );
          };

          const renderHistoryContent = (isModal: boolean) => (
            <>
              <div className={`${isModal ? "p-4" : "p-2"} space-y-2 border-b`}>
                <div className="flex items-center gap-2">
                  {!isModal && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => setHistoryMaximized(true)}
                      data-testid="btn-history-maximize"
                      title={t.agentWorkspace.historyMaximize}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <div className="relative flex-1">
                    <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isModal ? "h-4 w-4" : "h-3.5 w-3.5"} text-muted-foreground`} />
                    <Input
                      value={histSearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      placeholder={t.agentWorkspace.historySearchPlaceholder}
                      className={`${isModal ? "pl-9 h-9 text-sm" : "pl-8 h-8 text-xs"}`}
                      data-testid={isModal ? "input-history-search-modal" : "input-history-search"}
                    />
                    {histSearchQuery && (
                      <button
                        onClick={() => setHistorySearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                {["all", "call", "email", "sms", "disposition"].map((t) => {
                  const count = t === "all" ? contactHistory.length : (typeCounts[t] || 0);
                  if (t !== "all" && count === 0) return null;
                  const isActive = histTypeFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setHistoryTypeFilter(t)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${isModal ? "text-xs" : "text-[10px]"} font-medium transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "bg-muted/40 text-muted-foreground border border-transparent hover-elevate"
                      }`}
                      data-testid={`btn-history-filter-${t}`}
                    >
                      {t === "call" && <Phone className={isModal ? "h-3 w-3" : "h-2.5 w-2.5"} />}
                      {t === "email" && <Mail className={isModal ? "h-3 w-3" : "h-2.5 w-2.5"} />}
                      {t === "sms" && <MessageSquare className={isModal ? "h-3 w-3" : "h-2.5 w-2.5"} />}
                      {t === "disposition" && <ListChecks className={isModal ? "h-3 w-3" : "h-2.5 w-2.5"} />}
                      {typeLabels[t]}
                      <span className={`${isModal ? "text-[10px]" : "text-[9px]"} ${isActive ? "text-primary" : "text-muted-foreground/70"}`}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`flex-1 overflow-auto ${isModal ? "max-h-[65vh]" : ""}`}>
              {filteredHistory.length === 0 && (
                <div className="text-center py-8">
                  {contactHistory.length === 0 ? (
                    <>
                      <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                      <p className={`${isModal ? "text-sm" : "text-xs"} text-muted-foreground`}>{t.agentWorkspace.historyNoComm}</p>
                    </>
                  ) : (
                    <>
                      <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                      <p className={`${isModal ? "text-sm" : "text-xs"} text-muted-foreground`}>{t.agentWorkspace.historyNoResults} "{histSearchQuery}"</p>
                    </>
                  )}
                </div>
              )}

              {filteredHistory.length > 0 && (
                <div className={`${isModal ? "p-4 space-y-2" : "p-2 space-y-2"}`}>
                  {filteredHistory.map((item) => {
                    const isClickable = item.type === "email" || item.type === "sms";
                    const plainDetails = item.details?.replace(/<[^>]*>/g, '') || "";
                    const isCall = item.type === "call";
                    const contentText = item.content || item.notes || "";

                    const itemAc = item.type === "call" ? "#B5622E" : item.type === "email" ? "#5B4FCF" : item.type === "sms" ? "#2E75B6" : "#7A6858";
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl overflow-visible transition-all duration-200 ${isClickable ? "cursor-pointer group" : ""}`}
                        data-testid={`history-item-${item.id}`}
                        style={{
                          background: "hsl(var(--card))",
                          border: `1px solid ${itemAc}25`,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                        }}
                        onClick={() => { if (isClickable && onOpenHistoryDetail) onOpenHistoryDetail(item); }}
                        onMouseEnter={isClickable ? (e) => {
                          const el = e.currentTarget as HTMLElement;
                          el.style.borderColor = `${itemAc}60`;
                          el.style.boxShadow = `0 4px 12px ${itemAc}20`;
                          el.style.transform = "translateY(-1px)";
                        } : undefined}
                        onMouseLeave={isClickable ? (e) => {
                          const el = e.currentTarget as HTMLElement;
                          el.style.borderColor = `${itemAc}25`;
                          el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)";
                          el.style.transform = "translateY(0)";
                        } : undefined}
                      >
                        <div className={`flex items-start gap-2.5 ${isModal ? "p-3" : "p-2.5"}`}>
                          <div
                            className={`flex ${isModal ? "h-9 w-9" : "h-7 w-7"} shrink-0 items-center justify-center rounded-full mt-0.5`}
                            style={{ background: `${itemAc}15`, border: `1.5px solid ${itemAc}30` }}
                          >
                            {item.type === "call" && <Phone className={isModal ? "h-4 w-4" : "h-3 w-3"} style={{ color: itemAc }} />}
                            {item.type === "email" && <Mail className={isModal ? "h-4 w-4" : "h-3 w-3"} style={{ color: itemAc }} />}
                            {item.type === "sms" && <MessageSquare className={isModal ? "h-4 w-4" : "h-3 w-3"} style={{ color: itemAc }} />}
                            {item.type === "disposition" && <ListChecks className={isModal ? "h-4 w-4" : "h-3 w-3"} style={{ color: itemAc }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.direction && (
                                <span className={`${isModal ? "text-xs" : "text-[9px]"} font-semibold`} style={{ color: itemAc }}>
                                  {item.direction === "inbound" ? t.agentWorkspace.historyInbound : t.agentWorkspace.historyOutbound}
                                </span>
                              )}
                              {item.type === "disposition" && (
                                <span className={`${isModal ? "text-xs" : "text-[9px]"} font-semibold`} style={{ color: itemAc }}>{t.agentWorkspace.historyDispositionType}</span>
                              )}
                              {(item as any).dispositionName && (() => {
                                const dColor = (item as any).dispositionColor || "gray";
                                const colorMap: Record<string, string> = {
                                  green: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
                                  red: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
                                  blue: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
                                  orange: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
                                  yellow: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
                                  purple: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
                                  gray: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
                                };
                                const cls = colorMap[dColor] || colorMap.gray;
                                return (
                                  <>
                                    <span className={`inline-flex items-center gap-1 ${isModal ? "text-[10px] h-5 px-2" : "text-[9px] h-4 px-1.5"} rounded-full border font-semibold ${cls}`}>
                                      {(item as any).dispositionName}
                                    </span>
                                    {(item as any).dispositionChecklistNames?.map((name: string, idx: number) => (
                                      <span key={idx} className={`inline-flex items-center gap-0.5 ${isModal ? "text-[10px] h-5 px-2" : "text-[9px] h-4 px-1.5"} rounded-full border font-semibold ${cls} opacity-75`}>
                                        ↳ {name}
                                      </span>
                                    ))}
                                  </>
                                );
                              })()}
                              {item.status && item.type !== "disposition" && (
                                <span
                                  className={`inline-flex items-center ${isModal ? "text-[10px] h-5 px-2" : "text-[9px] h-4 px-1.5"} rounded-full font-medium`}
                                  style={{ background: `${itemAc}15`, color: itemAc, border: `1px solid ${itemAc}25` }}
                                >{item.status}</span>
                              )}
                              {(item.type === "email" || item.type === "sms") && item.sentiment && (
                                <SentimentBadge sentiment={item.sentiment} size={isModal ? "md" : "sm"} />
                              )}
                              <span className={`${isModal ? "text-xs" : "text-[9px]"} ml-auto text-muted-foreground`}>
                                {format(new Date(item.date), isModal ? "d. MMMM yyyy, HH:mm" : "d.M. HH:mm", { locale: sk })}
                              </span>
                            </div>
                            {(item as any).action === "checklist_response" ? (() => {
                              const chkSections: any[] = (item as any).metadata?.sections || [];
                              const answeredItems = chkSections.flatMap((s: any) => [
                                ...(s.items || []).map((i: any) => ({ ...i, _sColor: s.color || "" })),
                                ...(s.subsections || []).flatMap((sub: any) => (sub.items || []).map((i: any) => ({ ...i, _sColor: s.color || "" }))),
                              ]).filter((i: any) => i.checked || i.answer === "yes" || (i.value && String(i.value).trim()));
                              if (answeredItems.length === 0) {
                                return <p className={`${isModal ? "text-sm mt-1" : "text-[11px] mt-0.5"} font-medium leading-snug text-muted-foreground`}>Žiadne položky nezodpovedané</p>;
                              }
                              return (
                                <div className="flex flex-wrap gap-1 mt-1 max-w-full">
                                  {answeredItems.map((i: any) => {
                                    const c = i._sColor;
                                    const badgeStyle = c ? { backgroundColor: `${c}18`, color: c, borderColor: `${c}40` } : undefined;
                                    const badgeCls = c ? "" : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                                    const label = i.type === "text" ? `${i.label}: ${i.value}` : `✓ ${i.label}`;
                                    return (
                                      <span key={i.id} title={label} className={`inline-flex items-center gap-0.5 ${isModal ? "text-[10px] px-2 py-0.5" : "text-[9px] px-1.5 py-0.5"} rounded-full border font-medium max-w-[200px] truncate ${badgeCls}`} style={badgeStyle}>
                                        {label}
                                      </span>
                                    );
                                  })}
                                </div>
                              );
                            })() : (item as any).action === "status_list_confirmation" ? (() => {
                              const meta = (item as any).metadata || {};
                              const confirmed = meta.confirmed !== false;
                              const labelPart = meta.itemLabel || contentText?.replace(/^Krok (potvrdený|odpotvrdený):\s*/i, "").trim() || "—";
                              const descPart = (meta.itemDescription as string | null) || null;
                              const isExpanded = expandedSlItems.has(item.id);
                              return (
                                <div className="mt-1.5">
                                  <div
                                    role={descPart ? "button" : undefined}
                                    tabIndex={descPart ? 0 : undefined}
                                    onClick={descPart ? () => setExpandedSlItems(prev => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    }) : undefined}
                                    className={`rounded-lg border overflow-hidden transition-all duration-150 ${
                                      confirmed
                                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50"
                                        : "bg-stone-100/80 border-stone-200 dark:bg-stone-800/40 dark:border-stone-700/60"
                                    } ${descPart ? "cursor-pointer hover:brightness-[0.97] dark:hover:brightness-110" : ""}`}
                                  >
                                    <div className={`flex items-start gap-2 ${isModal ? "p-2.5" : "p-2"}`}>
                                      <div className={`shrink-0 ${isModal ? "h-8 w-8" : "h-6 w-6"} rounded-full flex items-center justify-center ${
                                        confirmed ? "bg-emerald-100 dark:bg-emerald-900/60" : "bg-stone-200 dark:bg-stone-700"
                                      }`}>
                                        {confirmed
                                          ? <Check className={`${isModal ? "h-4 w-4" : "h-3.5 w-3.5"} text-emerald-600 dark:text-emerald-400`} />
                                          : <X className={`${isModal ? "h-4 w-4" : "h-3.5 w-3.5"} text-stone-500 dark:text-stone-400`} />
                                        }
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`${isModal ? "text-[10px]" : "text-[9px]"} font-bold uppercase tracking-wide ${
                                            confirmed ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500"
                                          }`}>
                                            {confirmed ? "Potvrdený krok" : "Odpotvrdený krok"}
                                          </span>
                                          {descPart && (
                                            <ChevronDown className={`h-3 w-3 text-muted-foreground/60 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                          )}
                                        </div>
                                        <p className={`${isModal ? "text-sm" : "text-[11px]"} font-semibold leading-snug text-foreground mt-0.5 ${!isExpanded ? "line-clamp-2" : ""}`}>
                                          {highlightMatch(labelPart)}
                                        </p>
                                      </div>
                                    </div>
                                    {isExpanded && descPart && (
                                      <div className={`border-t ${
                                        confirmed ? "border-emerald-200 dark:border-emerald-800/50" : "border-stone-200 dark:border-stone-700"
                                      } ${isModal ? "px-3 py-2.5" : "px-2.5 py-2"}`}>
                                        <p className={`${isModal ? "text-xs" : "text-[10px]"} text-muted-foreground leading-relaxed whitespace-pre-wrap`}>
                                          {descPart}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })() : (
                              <>
                                <p className={`${isModal ? "text-sm mt-1" : "text-[11px] mt-0.5"} font-medium ${isModal ? "" : "line-clamp-2"} leading-snug text-foreground`}>
                                  {isCall
                                    ? (highlightMatch(contentText.replace(/^(Hovor (odchádzajúci|prichádzajúci)|Prichádzajúci hovor): /, "")) || "—")
                                    : (highlightMatch(contentText) || "—")}
                                </p>
                                {!isCall && plainDetails && (
                                  <p className={`${isModal ? "text-xs mt-1" : "text-[10px] mt-0.5"} ${isModal ? "line-clamp-3" : "line-clamp-2"} leading-snug text-muted-foreground`}>
                                    {highlightMatch(plainDetails)}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                          {isClickable && (
                            <ExternalLink className={`${isModal ? "h-4 w-4" : "h-3 w-3"} shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground`} />
                          )}
                        </div>
                        {isCall && item.callLogId && (
                          <div className={`${isModal ? "px-3 pb-2" : "px-2.5 pb-2"}`} onClick={(e) => e.stopPropagation()}>
                            <CallRecordingPlayer callLogId={item.callLogId} compact />
                          </div>
                        )}
                        <div className={`flex items-center gap-2 ${isModal ? "px-3 pb-2.5 text-xs" : "px-2.5 pb-2 text-[9px]"} flex-wrap text-muted-foreground`}>
                          {item.agentName && (
                            <span className="flex items-center gap-0.5">
                              <UserCircle className={isModal ? "h-3 w-3" : "h-2.5 w-2.5"} />
                              {item.agentName}
                            </span>
                          )}
                          {item.campaignName && (
                            <span
                              className={`inline-flex items-center ${isModal ? "text-xs px-2 py-0.5" : "text-[9px] px-1.5 py-0.5"} rounded-full truncate ${isModal ? "max-w-[200px]" : "max-w-[120px]"} bg-muted text-muted-foreground`}
                              title={item.campaignName}
                            >
                              {item.campaignName}
                            </span>
                          )}
                          {isCall && !item.callLogId && item.details && (
                            <span>{item.details}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {filteredHistory.length > 0 && (
              <div className={`${isModal ? "px-4 py-2" : "px-3 py-1.5"} border-t bg-muted/20 text-center`}>
                <span className={`${isModal ? "text-xs" : "text-[10px]"} text-muted-foreground`}>
                  {filteredHistory.length} {filteredHistory.length === 1 ? t.agentWorkspace.historyRecordSingular : filteredHistory.length < 5 ? t.agentWorkspace.historyRecordFew : t.agentWorkspace.historyRecordPlural}
                  {histSearchQuery && ` ${t.agentWorkspace.historyFor} "${histSearchQuery}"`}
                </span>
              </div>
            )}
            </>
          );

          return (
          <>
            <div className="flex flex-col h-full">
              {renderHistoryContent(false)}
            </div>

            <Dialog open={historyMaximized} onOpenChange={setHistoryMaximized}>
              <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                <div className="flex items-center justify-between px-5 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold" data-testid="text-history-modal-title">{t.agentWorkspace.communicationHistory}</h2>
                    {contact && (
                      <Badge variant="outline" className="text-xs ml-2">
                        {contact.firstName} {contact.lastName}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {renderHistoryContent(true)}
                </div>
              </DialogContent>
            </Dialog>
          </>
          );
        })()}

        {rightTab === "faq" && (() => {
          const sampleFaqData: Record<string, Array<{ id: string; question: string; answer: string; category: string }>> = {
            en: [
              { id: "1", question: "What is cord blood?", answer: "Cord blood is the blood that remains in the umbilical cord and placenta after birth. It contains stem cells that can be used to treat various diseases.", category: "General" },
              { id: "2", question: "Is the collection painful?", answer: "No, cord blood collection is completely painless for both the mother and the baby. It is performed after birth and after the umbilical cord is cut.", category: "Collection" },
              { id: "3", question: "How long can it be stored?", answer: "Stem cells from cord blood can be stored in cryopreservation virtually indefinitely. Studies confirm viability even after 25+ years.", category: "Storage" },
              { id: "4", question: "What diseases can be treated?", answer: "Stem cells from cord blood are used to treat more than 80 diseases including leukemia, lymphomas, anemia, metabolic disorders and immunodeficiencies.", category: "Treatment" },
              { id: "5", question: "How much does it cost?", answer: "The price depends on the chosen service package. The basic package starts from 990€. For more detailed pricing information, see the current price list or contact our advisor.", category: "Pricing" },
              { id: "6", question: "When should I decide?", answer: "Ideally, you should decide before week 34 of pregnancy so we have time to prepare all necessary documents and the collection kit. In urgent cases, we can arrange faster processing.", category: "Process" },
              { id: "7", question: "What if I have a cesarean section?", answer: "Cord blood collection is also possible with a cesarean section. The procedure is equally safe and painless. Inform your maternity hospital and our coordinator.", category: "Collection" },
              { id: "8", question: "Is it compatible for siblings?", answer: "Yes, cord blood is more likely to be compatible between siblings (25% full match). For the child itself, the match is 100%. Storing for one child can help the entire family.", category: "Treatment" },
            ],
            sk: [
              { id: "1", question: "Čo je pupočníková krv?", answer: "Pupočníková krv je krv, ktorá zostáva v pupočníku a placente po pôrode. Obsahuje kmeňové bunky, ktoré môžu byť použité na liečbu rôznych ochorení.", category: "Všeobecné" },
              { id: "2", question: "Je odber bolestivý?", answer: "Nie, odber pupočníkovej krvi je úplne bezbolestný pre matku aj dieťa. Vykonáva sa až po pôrode a prestrihnutí pupočníka.", category: "Odber" },
              { id: "3", question: "Ako dlho sa dá uchovávať?", answer: "Kmeňové bunky z pupočníkovej krvi je možné uchovávať v kryokonzervácii prakticky neobmedzene dlho. Štúdie potvrdzujú životaschopnosť aj po 25+ rokoch.", category: "Uchovávanie" },
              { id: "4", question: "Aké ochorenia sa dajú liečiť?", answer: "Kmeňové bunky z pupočníkovej krvi sa používajú na liečbu viac ako 80 ochorení vrátane leukémie, lymfómov, anemie, metabolických porúch a imunodeficiencií.", category: "Liečba" },
              { id: "5", question: "Koľko to stojí?", answer: "Cena závisí od zvoleného balíka služieb. Základný balík začína od 990€. Podrobnejšie informácie o cenách nájdete v aktuálnom cenníku alebo kontaktujte nášho poradcu.", category: "Cena" },
              { id: "6", question: "Kedy sa mám rozhodnúť?", answer: "Ideálne je rozhodnúť sa do 34. týždňa tehotenstva, aby sme stihli pripraviť všetky potrebné dokumenty a odberový set. V urgentných prípadoch vieme zabezpečiť aj rýchlejšie spracovanie.", category: "Proces" },
              { id: "7", question: "Čo ak mám cisársky rez?", answer: "Odber pupočníkovej krvi je možný aj pri cisárskom reze. Postup je rovnako bezpečný a bezbolestný. Informujte o tom vašu pôrodnicu a nášho koordinátora.", category: "Odber" },
              { id: "8", question: "Je to kompatibilné pre súrodencov?", answer: "Áno, pupočníková krv je s vyššou pravdepodobnosťou kompatibilná medzi súrodencami (25% plná zhoda). Pre samotné dieťa je zhoda 100%. Uchovanie pre jedného potomka môže pomôcť celej rodine.", category: "Liečba" },
            ],
            cs: [
              { id: "1", question: "Co je pupečníková krev?", answer: "Pupečníková krev je krev, která zůstává v pupečníku a placentě po porodu. Obsahuje kmenové buňky, které mohou být použity k léčbě různých onemocnění.", category: "Obecné" },
              { id: "2", question: "Je odběr bolestivý?", answer: "Ne, odběr pupečníkové krve je zcela bezbolestný pro matku i dítě. Provádí se až po porodu a přestřižení pupečníku.", category: "Odběr" },
              { id: "3", question: "Jak dlouho lze uchovávat?", answer: "Kmenové buňky z pupečníkové krve lze uchovávat v kryokonzervaci prakticky neomezeně dlouho. Studie potvrzují životaschopnost i po 25+ letech.", category: "Uchovávání" },
              { id: "4", question: "Jaká onemocnění lze léčit?", answer: "Kmenové buňky z pupečníkové krve se používají k léčbě více než 80 onemocnění včetně leukémie, lymfomů, anémie, metabolických poruch a imunodeficiencí.", category: "Léčba" },
              { id: "5", question: "Kolik to stojí?", answer: "Cena závisí na zvoleném balíčku služeb. Základní balíček začíná od 990€. Podrobnější informace o cenách najdete v aktuálním ceníku nebo kontaktujte našeho poradce.", category: "Cena" },
              { id: "6", question: "Kdy se mám rozhodnout?", answer: "Ideálně je rozhodnout se do 34. týdne těhotenství, abychom stihli připravit všechny potřebné dokumenty a odběrový set.", category: "Proces" },
              { id: "7", question: "Co když mám císařský řez?", answer: "Odběr pupečníkové krve je možný i při císařském řezu. Postup je stejně bezpečný a bezbolestný. Informujte o tom vaši porodnici a našeho koordinátora.", category: "Odběr" },
              { id: "8", question: "Je to kompatibilní pro sourozence?", answer: "Ano, pupečníková krev je s vyšší pravděpodobností kompatibilní mezi sourozenci (25% plná shoda). Pro samotné dítě je shoda 100%.", category: "Léčba" },
            ],
            hu: [
              { id: "1", question: "Mi az a köldökzsinórvér?", answer: "A köldökzsinórvér a születés után a köldökzsinórban és a méhlepényben maradó vér. Őssejteket tartalmaz, amelyek különböző betegségek kezelésére használhatók.", category: "Általános" },
              { id: "2", question: "Fájdalmas a gyűjtés?", answer: "Nem, a köldökzsinórvér gyűjtése teljesen fájdalommentes az anya és a baba számára egyaránt. A születés és a köldökzsinór elvágása után végzik.", category: "Gyűjtés" },
              { id: "3", question: "Meddig tárolható?", answer: "A köldökzsinórvérből nyert őssejtek kriőkonzerválással gyakorlatilag korlátlanul tárolhatók. Tanulmányok 25+ év után is igazolják az életképességet.", category: "Tárolás" },
              { id: "4", question: "Milyen betegségek kezelhetők?", answer: "A köldökzsinórvérből nyert őssejteket több mint 80 betegség kezelésére használják, beleértve a leukémiát, limfómákat, anémiát és immunhiányos állapotokat.", category: "Kezelés" },
              { id: "5", question: "Mennyibe kerül?", answer: "Az ár a választott szolgáltatási csomagtól függ. Az alapcsomag 990€-tól indul. Részletesebb árinformációkért tekintse meg az aktuális árlistát.", category: "Árazás" },
              { id: "6", question: "Mikor kell döntenem?", answer: "Ideális esetben a terhesség 34. hetéig kell dönteni, hogy legyen idő az összes szükséges dokumentum és gyűjtőkészlet előkészítésére.", category: "Folyamat" },
              { id: "7", question: "Mi van, ha császármetszésem lesz?", answer: "A köldökzsinórvér gyűjtése császármetszés esetén is lehetséges. Az eljárás ugyanolyan biztonságos és fájdalommentes.", category: "Gyűjtés" },
              { id: "8", question: "Kompatibilis a testvérek számára?", answer: "Igen, a köldökzsinórvér nagyobb valószínűséggel kompatibilis a testvérek között (25% teljes egyezés). A gyermek számára 100%-os az egyezés.", category: "Kezelés" },
            ],
            ro: [
              { id: "1", question: "Ce este sângele din cordonul ombilical?", answer: "Sângele din cordonul ombilical este sângele care rămâne în cordonul ombilical și placentă după naștere. Conține celule stem care pot fi folosite pentru tratarea diverselor boli.", category: "General" },
              { id: "2", question: "Este colectarea dureroasă?", answer: "Nu, colectarea sângelui din cordonul ombilical este complet nedureroasă atât pentru mamă, cât și pentru copil. Se efectuează după naștere.", category: "Colectare" },
              { id: "3", question: "Cât timp poate fi depozitat?", answer: "Celulele stem din sângele cordonului ombilical pot fi depozitate prin crioconservare practic la nesfârșit. Studiile confirmă viabilitatea chiar și după 25+ ani.", category: "Depozitare" },
              { id: "4", question: "Ce boli pot fi tratate?", answer: "Celulele stem sunt folosite pentru tratarea a peste 80 de boli, inclusiv leucemie, limfoame, anemie și imunodeficiențe.", category: "Tratament" },
              { id: "5", question: "Cât costă?", answer: "Prețul depinde de pachetul de servicii ales. Pachetul de bază pornește de la 990€.", category: "Prețuri" },
              { id: "6", question: "Când trebuie să mă decid?", answer: "Ideal este să vă decideți înainte de săptămâna 34 de sarcină pentru a avea timp să pregătim toate documentele necesare.", category: "Proces" },
              { id: "7", question: "Ce se întâmplă dacă am cezariană?", answer: "Colectarea sângelui din cordonul ombilical este posibilă și în cazul cezarianei. Procedura este la fel de sigură și nedureroasă.", category: "Colectare" },
              { id: "8", question: "Este compatibil pentru frați?", answer: "Da, sângele din cordonul ombilical este mai probabil compatibil între frați (25% potrivire completă). Pentru copil, potrivirea este de 100%.", category: "Tratament" },
            ],
            it: [
              { id: "1", question: "Cos'è il sangue del cordone ombelicale?", answer: "Il sangue del cordone ombelicale è il sangue che rimane nel cordone ombelicale e nella placenta dopo il parto. Contiene cellule staminali utilizzabili per il trattamento di varie malattie.", category: "Generale" },
              { id: "2", question: "La raccolta è dolorosa?", answer: "No, la raccolta del sangue del cordone ombelicale è completamente indolore sia per la madre che per il bambino. Viene eseguita dopo il parto.", category: "Raccolta" },
              { id: "3", question: "Per quanto tempo può essere conservato?", answer: "Le cellule staminali possono essere conservate in crioconservazione praticamente a tempo indeterminato. Gli studi confermano la vitalità anche dopo 25+ anni.", category: "Conservazione" },
              { id: "4", question: "Quali malattie possono essere trattate?", answer: "Le cellule staminali sono utilizzate per trattare oltre 80 malattie tra cui leucemia, linfomi, anemia e immunodeficienze.", category: "Trattamento" },
              { id: "5", question: "Quanto costa?", answer: "Il prezzo dipende dal pacchetto di servizi scelto. Il pacchetto base parte da 990€.", category: "Prezzi" },
              { id: "6", question: "Quando devo decidere?", answer: "Idealmente bisogna decidere entro la 34a settimana di gravidanza per avere tempo di preparare tutti i documenti necessari.", category: "Processo" },
              { id: "7", question: "E se ho un taglio cesareo?", answer: "La raccolta del sangue cordonale è possibile anche con taglio cesareo. La procedura è ugualmente sicura e indolore.", category: "Raccolta" },
              { id: "8", question: "È compatibile per i fratelli?", answer: "Sì, il sangue cordonale è più probabilmente compatibile tra fratelli (25% corrispondenza completa). Per il bambino stesso, la corrispondenza è del 100%.", category: "Trattamento" },
            ],
            de: [
              { id: "1", question: "Was ist Nabelschnurblut?", answer: "Nabelschnurblut ist das Blut, das nach der Geburt in der Nabelschnur und Plazenta verbleibt. Es enthält Stammzellen, die zur Behandlung verschiedener Krankheiten verwendet werden können.", category: "Allgemein" },
              { id: "2", question: "Ist die Entnahme schmerzhaft?", answer: "Nein, die Nabelschnurblutentnahme ist für Mutter und Kind völlig schmerzfrei. Sie wird nach der Geburt und dem Durchtrennen der Nabelschnur durchgeführt.", category: "Entnahme" },
              { id: "3", question: "Wie lange kann es gelagert werden?", answer: "Stammzellen aus Nabelschnurblut können durch Kryokonservierung praktisch unbegrenzt gelagert werden. Studien bestätigen die Lebensfähigkeit auch nach 25+ Jahren.", category: "Lagerung" },
              { id: "4", question: "Welche Krankheiten können behandelt werden?", answer: "Stammzellen aus Nabelschnurblut werden zur Behandlung von über 80 Krankheiten eingesetzt, darunter Leukämie, Lymphome, Anämie und Immundefizienzen.", category: "Behandlung" },
              { id: "5", question: "Was kostet es?", answer: "Der Preis hängt vom gewählten Servicepaket ab. Das Basispaket beginnt ab 990€.", category: "Preise" },
              { id: "6", question: "Wann muss ich mich entscheiden?", answer: "Idealerweise sollten Sie sich vor der 34. Schwangerschaftswoche entscheiden, damit genug Zeit bleibt, alle notwendigen Dokumente vorzubereiten.", category: "Prozess" },
              { id: "7", question: "Was ist bei einem Kaiserschnitt?", answer: "Die Nabelschnurblutentnahme ist auch bei einem Kaiserschnitt möglich. Das Verfahren ist ebenso sicher und schmerzfrei.", category: "Entnahme" },
              { id: "8", question: "Ist es für Geschwister kompatibel?", answer: "Ja, Nabelschnurblut ist mit höherer Wahrscheinlichkeit zwischen Geschwistern kompatibel (25% volle Übereinstimmung). Für das Kind selbst beträgt die Übereinstimmung 100%.", category: "Behandlung" },
            ],
          };
          const campaignFaqs = sampleFaqData[locale] || sampleFaqData.en;

          const [expandedFaqId, setExpandedFaqId] = [faqExpandedId, setFaqExpandedId];
          const [faqSearch, setFaqSearch] = [faqSearchQuery, setFaqSearchQuery];

          const categories = [...new Set(campaignFaqs.map(f => f.category))];
          const filteredFaqs = campaignFaqs.filter(f => {
            if (!faqSearch.trim()) return true;
            const q = faqSearch.toLowerCase();
            return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
          });
          const groupedFaqs = categories.map(cat => ({
            category: cat,
            items: filteredFaqs.filter(f => f.category === cat),
          })).filter(g => g.items.length > 0);

          const renderFaqContent = (isModal: boolean) => (
            <>
              <div
                className={isModal ? "p-4 space-y-2" : "p-2 space-y-1.5"}
                style={{ borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#B5622E22" }}>
                    <BookOpen className={isModal ? "h-4 w-4" : "h-3.5 w-3.5"} style={{ color: "#B5622E" }} />
                  </div>
                  <span
                    className={`${isModal ? "text-xs" : "text-[10px]"} font-semibold uppercase tracking-wider text-muted-foreground`}
                  >
                    {t.campaigns.faq.frequentlyAsked}
                  </span>
                  <span
                    className={`${isModal ? "text-xs ml-auto px-1.5 py-0.5" : "text-[9px] ml-auto px-1 py-0.5"} rounded-md font-medium bg-muted text-muted-foreground`}
                  >
                    {filteredFaqs.length}
                  </span>
                  {!isModal && (
                    <button
                      onClick={() => setFaqMaximized(true)}
                      data-testid="btn-faq-maximize"
                      className="p-1 rounded-md text-muted-foreground"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isModal ? "h-4 w-4" : "h-3 w-3"} text-muted-foreground`} />
                  <Input
                    value={faqSearch}
                    onChange={(e) => setFaqSearchQuery(e.target.value)}
                    placeholder={t.campaigns.faq.searchPlaceholder}
                    className={isModal ? "pl-9 h-9 text-sm rounded-xl" : "pl-7 h-7 text-xs rounded-xl"}
                    data-testid={isModal ? "input-faq-search-modal" : "input-faq-search"}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HelpCircle className={isModal ? "h-12 w-12 mx-auto mb-3 opacity-20" : "h-8 w-8 mx-auto mb-2 opacity-20"} />
                    <p className={isModal ? "text-sm" : "text-xs"}>{t.campaigns.faq.noFaqs}</p>
                  </div>
                ) : (
                  <div className={isModal ? "p-4 space-y-5" : "p-2 space-y-3"}>
                    {groupedFaqs.map((group) => (
                      <div key={group.category}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div
                            className={isModal ? "h-2 w-2 rounded-full" : "h-1.5 w-1.5 rounded-full"}
                            style={{ background: "#B5622E" }}
                          />
                          <span
                            className={`${isModal ? "text-xs" : "text-[10px]"} font-semibold uppercase tracking-wider text-muted-foreground`}
                          >
                            {group.category}
                          </span>
                          <span
                            className={isModal ? "text-[11px]" : "text-[9px]"}
                            style={{ color: "#9A887888" }}
                          >
                            ({group.items.length})
                          </span>
                        </div>
                        <div className={isModal ? "space-y-2" : "space-y-1"}>
                          {group.items.map((faq) => {
                            const isExpanded = expandedFaqId === faq.id;
                            return (
                              <div
                                key={faq.id}
                                className="rounded-xl overflow-hidden transition-all"
                                style={{
                                  background: "hsl(var(--card))",
                                  border: `1px solid hsl(var(--border))`,
                                  borderLeft: isExpanded ? "3px solid #B5622E" : `1px solid hsl(var(--border))`,
                                }}
                                data-testid={`faq-item-${faq.id}`}
                              >
                                <button
                                  onClick={() => setFaqExpandedId(isExpanded ? null : faq.id)}
                                  className={`w-full flex items-start gap-2 ${isModal ? "p-3" : "p-2"} text-left`}
                                  data-testid={`btn-faq-toggle-${faq.id}`}
                                >
                                  <HelpCircle
                                    className={isModal ? "h-4 w-4 shrink-0 mt-0.5" : "h-3.5 w-3.5 shrink-0 mt-0.5"}
                                    style={{ color: isExpanded ? "#B5622E" : "hsl(var(--muted-foreground))" }}
                                  />
                                  <span
                                    className={`${isModal ? "text-sm" : "text-[11px]"} font-medium flex-1 leading-snug text-foreground`}
                                  >
                                    {faq.question}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className={isModal ? "h-4 w-4 shrink-0 mt-0.5" : "h-3 w-3 shrink-0 mt-0.5"} style={{ color: "#B5622E" }} />
                                  ) : (
                                    <ChevronDown className={`${isModal ? "h-4 w-4" : "h-3 w-3"} shrink-0 mt-0.5 text-muted-foreground`} />
                                  )}
                                </button>
                                {isExpanded && (
                                  <div
                                    className={`${isModal ? "px-3 pb-3 pt-1 ml-6" : "px-2 pb-2 pt-0.5 ml-5"} border-t border-border`}
                                  >
                                    <p
                                      className={`${isModal ? "text-sm" : "text-[11px]"} leading-relaxed text-muted-foreground`}
                                    >
                                      {faq.answer}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          );

          return (
            <>
            <div className="flex flex-col h-full">
              {renderFaqContent(false)}
            </div>

            <Dialog open={faqMaximized} onOpenChange={setFaqMaximized}>
              <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                <div className="flex items-center justify-between px-5 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold" data-testid="text-faq-modal-title">{t.campaigns.faq.frequentlyAsked}</h2>
                  </div>
                </div>
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {renderFaqContent(true)}
                </div>
              </DialogContent>
            </Dialog>
            </>
          );
        })()}

        {rightTab === "actions" && (
          <div className="p-3 space-y-3">
            {/* Quick Actions */}
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-muted-foreground">
                <Zap className="h-3 w-3" style={{ color: "#B5622E" }} />
                {t.agentWorkspace.quickActions}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "call", icon: Phone, label: t.agentWorkspace.callAction, color: "#B5622E", disabled: !(contact.phone || localPhoneOverride), testId: "btn-quick-call" },
                  { key: "email", icon: Mail, label: t.agentWorkspace.emailAction, color: "#5B4FCF", disabled: !contact.email, testId: "btn-quick-email" },
                  { key: "sms", icon: MessageSquare, label: t.agentWorkspace.smsAction, color: "#2E75B6", disabled: !(contact.phone || localPhoneOverride), testId: "btn-quick-sms" },
                  { key: "task", icon: CalendarPlus, label: t.agentWorkspace.taskAction, color: "#7A6858", disabled: false, testId: "btn-quick-task" },
                ].map(({ key, icon: Icon, label, color, disabled, testId }) => (
                  <button
                    key={key}
                    onClick={() => !disabled && onQuickAction(key)}
                    disabled={disabled}
                    data-testid={testId}
                    className="flex items-center gap-2 p-2 rounded-xl text-left transition-all"
                    style={{
                      background: "hsl(var(--card))",
                      border: `1px solid hsl(var(--border))`,
                      borderLeft: `3px solid ${color}`,
                      color: "hsl(var(--foreground))",
                      opacity: disabled ? 0.4 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                    <span className="text-xs font-medium truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Add Note */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                  <StickyNote className="h-3 w-3" style={{ color: "#B5622E" }} />
                  {t.agentWorkspace.addNote || "Pridať poznámku"}
                </h4>
                <button
                  onClick={() => setNoteExpanded(!noteExpanded)}
                  data-testid="btn-toggle-note-expand"
                  className="p-1 rounded-md transition-colors text-muted-foreground"
                >
                  {noteExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Textarea
                placeholder={t.agentWorkspace.notePlaceholder || "Poznámka..."}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                className="text-xs resize-none transition-all rounded-xl"
                style={{ minHeight: noteExpanded ? "200px" : "60px" }}
                rows={noteExpanded ? 8 : 3}
                data-testid="input-call-notes"
              />
              <div className="flex justify-end mt-1.5">
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  data-testid="btn-add-note"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: newNote.trim() ? "#B5622E" : "hsl(var(--muted))",
                    color: newNote.trim() ? "#FFFFFF" : "hsl(var(--muted-foreground))",
                    cursor: newNote.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  <Send className="h-3 w-3" />
                  {t.customers?.details?.addNote || "Pridať"}
                </button>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Notes list */}
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-muted-foreground">
                <FileText className="h-3 w-3" style={{ color: "#B5622E" }} />
                {t.customers?.tabs?.notes || "Poznámky"}
              </h4>
              {customerNotes.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-30" />
                  <p className="text-[10px]">{t.customers?.details?.noNotes || "Žiadne poznámky"}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {customerNotes.slice(0, 10).map((note) => (
                    <div
                      key={note.id}
                      className="p-2.5 rounded-xl cursor-pointer transition-all"
                      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      onClick={() => setSelectedNote(note)}
                      data-testid={`note-entry-${note.id}`}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px #B5622E18"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <User className="h-3 w-3 shrink-0" style={{ color: "#B5622E" }} />
                        <span className="text-[10px] font-medium truncate text-foreground">{note.userName}</span>
                        <span className="text-[10px] ml-auto shrink-0 text-muted-foreground">
                          {format(new Date(note.createdAt), "d.M. HH:mm", { locale: sk })}
                        </span>
                      </div>
                      <p className="text-[11px] line-clamp-2 text-foreground/80">{note.content}</p>
                    </div>
                  ))}
                  {customerNotes.length > 10 && (
                    <p className="text-[10px] text-center text-muted-foreground">
                      +{customerNotes.length - 10} {t.agentWorkspace.moreNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <Dialog open={!!selectedNote} onOpenChange={(open) => !open && setSelectedNote(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" />
                {t.customers?.tabs?.notes || "Poznámka"}
              </DialogTitle>
            </DialogHeader>
            {selectedNote && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{selectedNote.userName}</span>
                  <span className="mx-1">•</span>
                  <Clock className="h-3.5 w-3.5" />
                  <span>{format(new Date(selectedNote.createdAt), "d.M.yyyy HH:mm", { locale: sk })}</span>
                </div>
                <Separator />
                <div className="text-sm whitespace-pre-wrap">{selectedNote.content}</div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </ScrollArea>
    </div>
  );
}

interface ScheduledItem {
  id: string;
  campaignContactId: string;
  type: "callback" | "email" | "sms";
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactType?: "customer" | "clinic" | "hospital" | "collaborator";
  campaignId: string;
  campaignName: string;
  scheduledAt: string;
  notes: string;
  status: string;
  stepName?: string | null;
  stepIndex?: number | null;
  dispositionCode?: string | null;
  dispositionName?: string | null;
  dispositionChecklistCodes?: string[] | null;
  dispositionChecklistNames?: string[] | null;
  callbackStatusListLabel?: string | null;
  campaignQueueDisplayMode?: string | null;
  isOutsideMission?: boolean;
  inboundCallbackId?: number;
  calledBack?: boolean;
}

interface InboundCb {
  id: number;
  userId: string;
  assignedTo: string | null;
  customerId: string | null;
  phone: string;
  name: string | null;
  campaignId: string | null;
  callbackDate: string | null;
  notes: string | null;
  calledBack: boolean;
  createdAt: string;
}

function ReschedulePopover({ item, onReschedule, t }: { item: ScheduledItem; onReschedule: (id: string, campaignId: string, newDate: string) => void; t: any }) {
  const [popOpen, setPopOpen] = useState(false);
  const [dateVal, setDateVal] = useState("");
  const [timeVal, setTimeVal] = useState("09:00");

  useEffect(() => {
    if (popOpen) {
      const d = new Date(item.scheduledAt);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const useDate = d > new Date() ? d : tomorrow;
      const yyyy = useDate.getFullYear();
      const mm = String(useDate.getMonth() + 1).padStart(2, "0");
      const dd = String(useDate.getDate()).padStart(2, "0");
      setDateVal(`${yyyy}-${mm}-${dd}`);
      setTimeVal(useDate.getHours().toString().padStart(2, "0") + ":" + useDate.getMinutes().toString().padStart(2, "0"));
    }
  }, [popOpen, item.scheduledAt]);

  return (
    <Popover open={popOpen} onOpenChange={setPopOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={t.agentWorkspace.reschedule}
          data-testid={`btn-scheduled-reschedule-${item.id}`}
        >
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <div className="space-y-3">
          <p className="text-sm font-medium">{t.agentWorkspace.reschedule}</p>
          <DateTimePicker
            value={dateVal && timeVal ? `${dateVal}T${timeVal}` : ""}
            onChange={(val) => {
              if (val) {
                const [dp, tp] = val.split("T");
                setDateVal(dp);
                setTimeVal((tp || "09:00").substring(0, 5));
              }
            }}
            includeTime
            data-testid={`input-reschedule-datetime-${item.id}`}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              data-testid={`btn-confirm-reschedule-${item.id}`}
              onClick={() => {
                if (dateVal && timeVal) {
                  const newDate = new Date(`${dateVal}T${timeVal}:00`).toISOString();
                  onReschedule(item.campaignContactId, item.campaignId, newDate);
                  setPopOpen(false);
                }
              }}
            >
              <Check className="h-3 w-3 mr-1" />
              OK
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPopOpen(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MyActivityPanel({
  open,
  onOpenChange,
  stats,
  onMakeCall,
  onCallFromShift,
  onOpenEntity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: { calls: number; emails: number; sms: number };
  onMakeCall?: (phone: string) => void;
  onCallFromShift?: (item: any) => void;
  onOpenEntity?: (type: string, id: string, campaignContactId?: string | null, campaignId?: string | null) => void;
}) {
  const { t } = useI18n();
  const [filterType, setFilterType] = useState<"all" | "call" | "email" | "sms" | "missed" | "break">("all");

  const { data: items = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/agent/today-activity"],
    queryFn: async () => {
      const res = await fetch("/api/agent/today-activity", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });

  const getCallInfo = (item: any) => {
    const s = item.status;
    const isIn = item.direction === "inbound";
    if (s === "answered" || s === "completed") return { label: isIn ? t.agentWorkspace.todayCallsInboundBadge : t.agentWorkspace.todayCallsOutboundBadge, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30", icon: isIn ? <PhoneIncoming className="h-3 w-3" /> : <PhoneCall className="h-3 w-3" /> };
    if (s === "no_answer") return { label: t.agentWorkspace.myShiftFilterMissed, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", icon: <PhoneMissed className="h-3 w-3" /> };
    if (s === "busy") return { label: "Busy", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30", icon: <PhoneOff className="h-3 w-3" /> };
    if (s === "failed" || s === "cancelled") return { label: isIn ? "Cancelled" : "Failed", color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30", icon: <PhoneOff className="h-3 w-3" /> };
    return { label: s || "—", color: "text-muted-foreground", bg: "bg-muted", icon: <Phone className="h-3 w-3" /> };
  };

  const formatDuration = (secs: number | null) => {
    if (!secs || secs <= 0) return null;
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  const callItems = items.filter(i => i.itemType === "call");
  const emailItems = items.filter(i => i.itemType === "email");
  const smsItems = items.filter(i => i.itemType === "sms");
  const breakItems = items.filter(i => i.itemType === "break");
  const missedItems = callItems.filter(i => i.status === "no_answer" || i.status === "busy");
  const answeredCalls = callItems.filter(i => i.status === "answered" || i.status === "completed");
  const totalDur = answeredCalls.reduce((sum: number, c: any) => sum + (c.durationSeconds || 0), 0);

  const filtered = filterType === "all" ? items
    : filterType === "call" ? callItems
    : filterType === "email" ? emailItems
    : filterType === "sms" ? smsItems
    : filterType === "break" ? breakItems
    : missedItems;

  const filterTabs: { key: typeof filterType; label: string; count: number }[] = [
    { key: "all", label: t.agentWorkspace.myShiftFilterAll, count: items.length },
    { key: "call", label: t.agentWorkspace.myShiftFilterCalls, count: callItems.length },
    { key: "email", label: t.agentWorkspace.myShiftFilterEmail, count: emailItems.length },
    { key: "sms", label: t.agentWorkspace.myShiftFilterSms, count: smsItems.length },
    { key: "missed", label: t.agentWorkspace.myShiftFilterMissed, count: missedItems.length },
    { key: "break", label: "Prestávky", count: breakItems.length },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] !flex !flex-col p-0">
        <div className="flex items-center gap-3 pl-5 pr-14 pt-5 pb-3 border-b flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "#B5622E18" }}>
            <History className="h-5 w-5" style={{ color: "#B5622E" }} />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold">{t.agentWorkspace.todayCallsPanelTitle}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(), "EEEE d. MMMM yyyy", { locale: sk })}</p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors mr-1" title={t.agentWorkspace.todayCallsRefresh} data-testid="btn-my-activity-refresh">
            <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t.agentWorkspace.todayCallsRefresh}</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b flex-shrink-0 bg-muted/20">
          <div className="text-center">
            <div className="text-xl font-bold text-foreground">{callItems.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{t.agentWorkspace.myShiftFilterCalls}</div>
          </div>
          <div className="text-center border-l">
            <div className="text-xl font-bold" style={{ color: "#B5622E" }}>{missedItems.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{t.agentWorkspace.myShiftFilterMissed}</div>
          </div>
          <div className="text-center border-l">
            <div className="text-xl font-bold" style={{ color: "#5E7A5A" }}>{emailItems.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{t.agentWorkspace.myShiftFilterEmail}</div>
          </div>
          <div className="text-center border-l">
            <div className="text-xl font-bold" style={{ color: "#A0946A" }}>{formatDuration(totalDur) || "0s"}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{t.agentWorkspace.todayCallsDuration}</div>
          </div>
        </div>

        <div className="flex items-center gap-1 px-4 py-2 border-b flex-shrink-0 bg-muted/10 overflow-x-auto">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors"
              style={filterType === tab.key
                ? { background: "#B5622E", color: "#fff" }
                : {}}
              data-testid={`btn-shift-filter-${tab.key}`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="px-1 rounded text-[10px]"
                  style={filterType === tab.key
                    ? { background: "rgba(255,255,255,0.22)", color: "#fff" }
                    : {}}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-15" />
              <p className="text-sm font-medium">{t.agentWorkspace.todayCallsEmpty}</p>
              <p className="text-xs mt-1 opacity-70">{t.agentWorkspace.todayCallsEmptyHint}</p>
            </div>
          ) : (
            <div>
              {filtered.map((item) => {
                const sortTime = item.startedAt || item.sortTime;
                if (item.itemType === "call") {
                  const info = getCallInfo(item);
                  const dur = formatDuration(item.durationSeconds);
                  const isIn = item.direction === "inbound";
                  const displayName = item.customerName || item.phoneNumber;
                  return (
                    <div
                      key={item.id}
                      data-testid={`my-shift-call-${item.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 border-b border-l-2 transition-colors hover:bg-muted/30"
                      style={{ borderLeftColor: isIn ? "#5E7A5A" : "#B5622E" }}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${info.bg} ${info.color}`}>
                        {isIn ? <PhoneIncoming className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.customerName && onOpenEntity && item.entityId ? (
                            <button
                              type="button"
                              onClick={() => { onOpenEntity(item.contactType || "customer", item.entityId, item.campaignContactId, item.campaignId); onOpenChange(false); }}
                              className="text-sm font-medium truncate text-left hover:underline hover:text-primary transition-colors"
                              data-testid={`btn-shift-open-entity-${item.id}`}
                              title={item.customerName}
                            >
                              {item.customerName}
                            </button>
                          ) : (
                            <span className="text-sm font-medium truncate">{displayName}</span>
                          )}
                          {item.customerName && <span className="text-[11px] text-muted-foreground truncate">{item.phoneNumber}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
                            {info.icon}{info.label}
                          </span>
                          {isIn && item.inboundQueueName && (
                            <span className="text-[10px] text-muted-foreground"><span className="opacity-60">{t.agentWorkspace.todayCallsQueue}</span> {item.inboundQueueName}</span>
                          )}
                          {dur && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" />{dur}
                            </span>
                          )}
                          {item.dispositionCode && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                              <FileText className="h-2.5 w-2.5" />{item.dispositionCode}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {onOpenEntity && item.entityId && (
                          <button
                            type="button"
                            onClick={() => { onOpenEntity(item.contactType || "customer", item.entityId, item.campaignContactId, item.campaignId); onOpenChange(false); }}
                            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border transition-colors"
                            style={{ background: "#B5622E18", color: "#B5622E", borderColor: "#B5622E30" }}
                            title={t.agentWorkspace.myShiftOpenCard}
                            data-testid={`btn-shift-open-card-${item.id}`}
                          >
                            <User className="h-3 w-3" />
                            {t.agentWorkspace.myShiftOpenCard}
                          </button>
                        )}
                        <div className="text-right flex flex-col items-end gap-1">
                          <div className="text-xs font-medium text-foreground">{format(new Date(sortTime), "HH:mm")}</div>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal"
                            style={isIn ? { borderColor: "#5E7A5A60", color: "#5E7A5A" } : { borderColor: "#B5622E60", color: "#B5622E" }}>
                            {isIn ? t.agentWorkspace.todayCallsInboundBadge : t.agentWorkspace.todayCallsOutboundBadge}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (item.itemType === "email") {
                  return (
                    <div key={item.id} data-testid={`my-shift-email-${item.id}`} className="flex items-center gap-3 px-5 py-2.5 border-b border-l-2 transition-colors hover:bg-muted/30" style={{ borderLeftColor: "#A0946A" }}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.entityName || "—"}</div>
                        {item.subject && <div className="text-[11px] text-muted-foreground truncate mt-0.5">📧 {item.subject}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-foreground">{format(new Date(sortTime), "HH:mm")}</div>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal border-blue-300 text-blue-600 dark:text-blue-400 mt-0.5">Email</Badge>
                      </div>
                    </div>
                  );
                }
                if (item.itemType === "sms") {
                  return (
                    <div key={item.id} data-testid={`my-shift-sms-${item.id}`} className="flex items-center gap-3 px-5 py-2.5 border-b border-l-2 transition-colors hover:bg-muted/30" style={{ borderLeftColor: "#5E7A5A" }}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.entityName || "—"}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-foreground">{format(new Date(sortTime), "HH:mm")}</div>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal border-green-300 text-green-600 dark:text-green-400 mt-0.5">SMS</Badge>
                      </div>
                    </div>
                  );
                }
                if (item.itemType === "break") {
                  const isActive = !item.endedAt;
                  const dur = item.durationSeconds ? formatDuration(item.durationSeconds) : null;
                  return (
                    <div key={item.id} data-testid={`my-shift-break-${item.id}`} className="flex items-center gap-3 px-5 py-2.5 border-b border-l-2 border-l-orange-300 transition-colors hover:bg-muted/30">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                        <Coffee className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.breakTypeName || "Prestávka"}</div>
                        {dur && <div className="text-[11px] text-muted-foreground mt-0.5">{dur}</div>}
                        {isActive && <div className="text-[11px] text-orange-500 mt-0.5">Aktívna prestávka</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-foreground">{format(new Date(sortTime), "HH:mm")}</div>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal border-orange-300 text-orange-600 dark:text-orange-400 mt-0.5">Break</Badge>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-2 border-t bg-muted/20 flex-shrink-0">
          <p className="text-[11px] text-muted-foreground">
            {callItems.length} {callItems.length === 1 ? t.agentWorkspace.todayCallsWord1 : callItems.length >= 2 && callItems.length <= 4 ? t.agentWorkspace.todayCallsWord234 : t.agentWorkspace.todayCallsWord5plus} · {answeredCalls.length} {t.agentWorkspace.todayCallsAnswered}
            {emailItems.length > 0 && ` · ${emailItems.length} ${t.agentWorkspace.todayEmailsSent}`}
            {smsItems.length > 0 && ` · ${smsItems.length} ${t.agentWorkspace.todaySmsSent}`}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduledQueuePanel({
  open,
  onOpenChange,
  onOpenContact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenContact?: (contactId: string, campaignId: string, campaignContactId: string, channel: "phone" | "email" | "sms", contactType?: string, contactPhone?: string) => void;
}) {
  const [filterType, setFilterType] = useState<"all" | "callback" | "email" | "sms">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "overdue" | "today" | "thisWeek" | "nextWeek" | "later">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"date" | "name" | "campaign">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: scheduledItems = [], isLoading } = useQuery<ScheduledItem[]>({
    queryKey: ["/api/agent/scheduled-queue"],
    queryFn: async () => {
      const res = await fetch("/api/agent/scheduled-queue", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });

  // Reset filters every time the queue opens so a previously selected type/time
  // filter (e.g. "Emails") never hides the items the user expects to see.
  useEffect(() => {
    if (open) {
      setFilterType("all");
      setTimeFilter("all");
      setSearchQuery("");
    }
  }, [open]);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const nextWeekStart = addDays(weekEnd, 1);
  const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });

  const counts = useMemo(() => {
    const n = new Date();
    let overdue = 0, today = 0, thisWeek = 0, nextW = 0, later = 0;
    const typeCounts = { callback: 0, email: 0, sms: 0 };
    for (const item of scheduledItems) {
      const d = new Date(item.scheduledAt);
      typeCounts[item.type]++;
      if (isBefore(d, n)) overdue++;
      else if (isWithinInterval(d, { start: todayStart, end: todayEnd })) today++;
      else if (isWithinInterval(d, { start: todayStart, end: weekEnd })) thisWeek++;
      else if (isWithinInterval(d, { start: nextWeekStart, end: nextWeekEnd })) nextW++;
      else later++;
    }
    return { overdue, today, thisWeek, nextWeek: nextW, later, ...typeCounts };
  }, [scheduledItems]);

  const filteredItems = useMemo(() => {
    const n = new Date();
    let items = scheduledItems;
    if (filterType !== "all") items = items.filter(item => item.type === filterType);
    if (timeFilter !== "all") {
      items = items.filter(item => {
        const d = new Date(item.scheduledAt);
        switch (timeFilter) {
          case "overdue": return isBefore(d, n);
          case "today": return isWithinInterval(d, { start: todayStart, end: todayEnd });
          case "thisWeek": return isWithinInterval(d, { start: todayStart, end: weekEnd });
          case "nextWeek": return isWithinInterval(d, { start: nextWeekStart, end: nextWeekEnd });
          case "later": return !isBefore(d, nextWeekEnd);
          default: return true;
        }
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(item =>
        (item.contactName || "").toLowerCase().includes(q) ||
        (item.contactPhone || "").toLowerCase().includes(q) ||
        (item.contactEmail || "").toLowerCase().includes(q) ||
        (item.campaignName || "").toLowerCase().includes(q) ||
        (item.notes || "").toLowerCase().includes(q)
      );
    }
    items = [...items].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      else if (sortField === "name") cmp = (a.contactName || "").localeCompare(b.contactName || "");
      else if (sortField === "campaign") cmp = (a.campaignName || "").localeCompare(b.campaignName || "");
      return sortDir === "desc" ? -cmp : cmp;
    });
    return items;
  }, [scheduledItems, filterType, timeFilter, searchQuery, sortField, sortDir]);

  const isOverdue = (scheduledAt: string) => new Date(scheduledAt) < new Date();

  const getTypeIcon = (type: string) => {
    if (type === "callback") return <PhoneForwarded className="h-3.5 w-3.5" />;
    if (type === "email") return <MailPlus className="h-3.5 w-3.5" />;
    return <MessageSquarePlus className="h-3.5 w-3.5" />;
  };

  const getTypeColor = (type: string) => {
    if (type === "callback") return "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400";
    if (type === "email") return "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400";
    return "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400";
  };

  const getTypeLabel = (type: string) => {
    if (type === "callback") return t.agentWorkspace.callbackLabel;
    if (type === "email") return "Email";
    return "SMS";
  };

  const toggleSort = (field: "date" | "name" | "campaign") => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: "date" | "name" | "campaign" }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const timeFilters: { key: typeof timeFilter; label: string; count: number; icon: any; color: string }[] = [
    { key: "all", label: t.agentWorkspace.scheduledAll, count: scheduledItems.length, icon: CalendarClock, color: "text-foreground" },
    { key: "overdue", label: t.agentWorkspace.scheduledOverdue, count: counts.overdue, icon: AlertTriangle, color: "text-destructive" },
    { key: "today", label: t.agentWorkspace.scheduledToday, count: counts.today, icon: Clock, color: "text-orange-500" },
    { key: "thisWeek", label: t.agentWorkspace.scheduledThisWeek, count: counts.thisWeek, icon: Calendar, color: "text-blue-500" },
    { key: "nextWeek", label: t.agentWorkspace.scheduledNextWeek, count: counts.nextWeek, icon: Calendar, color: "text-indigo-500" },
    { key: "later", label: t.agentWorkspace.scheduledLater, count: counts.later, icon: Calendar, color: "text-muted-foreground" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] !flex !flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between pl-5 pr-14 pt-5 pb-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold flex items-center gap-2" data-testid="text-scheduled-queue-title">
                {t.agentWorkspace.scheduledQueueTitle}
                <Badge variant="secondary" className="text-[10px] font-normal" data-testid="badge-scheduled-total">
                  {scheduledItems.length}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {counts.overdue > 0 && (
                  <span className="text-destructive font-medium">{counts.overdue} {t.agentWorkspace.scheduledOverdue}</span>
                )}
                {counts.overdue > 0 && counts.today > 0 && <span> · </span>}
                {counts.today > 0 && (
                  <span>{counts.today} {t.agentWorkspace.scheduledToday}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="w-48 border-r bg-muted/30 flex-shrink-0 flex flex-col py-2 px-2 overflow-y-auto">
            <div className="space-y-0.5 mb-3">
              {timeFilters.map(tf => {
                const Icon = tf.icon;
                const isActive = timeFilter === tf.key;
                return (
                  <button
                    key={tf.key}
                    onClick={() => setTimeFilter(tf.key)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground"
                    }`}
                    data-testid={`btn-time-filter-${tf.key}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isActive ? "" : tf.color}`} />
                    <span className="flex-1 text-left truncate">{tf.label}</span>
                    {tf.count > 0 && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        isActive ? "bg-primary-foreground/20 text-primary-foreground"
                          : tf.key === "overdue" ? "bg-destructive/10 text-destructive"
                          : "bg-muted-foreground/10 text-muted-foreground"
                      }`}>
                        {tf.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <Separator className="mb-3" />
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2.5 mb-1.5">{t.agentWorkspace.scheduledType}</p>
            <div className="space-y-0.5">
              {(["all", "callback", "email", "sms"] as const).map(type => {
                const isActive = filterType === type;
                const count = type === "all" ? scheduledItems.length : counts[type];
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      isActive ? "bg-accent font-medium" : "hover:bg-muted"
                    }`}
                    data-testid={`btn-scheduled-filter-${type}`}
                  >
                    {type === "all" ? <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /> : getTypeIcon(type)}
                    <span className="flex-1 text-left">
                      {type === "all" ? t.agentWorkspace.scheduledAll : type === "callback" ? t.agentWorkspace.scheduledCalls : type === "email" ? t.agentWorkspace.scheduledEmails : t.agentWorkspace.scheduledSms}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t.common.search || "Search..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-7 text-xs"
                  data-testid="input-scheduled-search"
                />
              </div>
              <div className="flex items-center border rounded-md h-7 overflow-hidden">
                <button
                  onClick={() => toggleSort("date")}
                  className={`px-2 h-full flex items-center gap-1 text-[10px] border-r transition-colors ${sortField === "date" ? "bg-accent font-medium" : "hover:bg-muted"}`}
                  data-testid="btn-sort-date"
                >
                  {t.agentWorkspace.sortByDate}
                  <SortIcon field="date" />
                </button>
                <button
                  onClick={() => toggleSort("name")}
                  className={`px-2 h-full flex items-center gap-1 text-[10px] border-r transition-colors ${sortField === "name" ? "bg-accent font-medium" : "hover:bg-muted"}`}
                  data-testid="btn-sort-name"
                >
                  {t.agentWorkspace.sortByName}
                  <SortIcon field="name" />
                </button>
                <button
                  onClick={() => toggleSort("campaign")}
                  className={`px-2 h-full flex items-center gap-1 text-[10px] transition-colors ${sortField === "campaign" ? "bg-accent font-medium" : "hover:bg-muted"}`}
                  data-testid="btn-sort-campaign"
                >
                  {t.agentWorkspace.sortByCampaign}
                  <SortIcon field="campaign" />
                </button>
              </div>
            </div>

            <div className="hidden sm:grid grid-cols-[1fr_140px_80px_120px_90px] gap-2 px-4 py-1.5 border-b bg-muted/40 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex-shrink-0">
              <span>{t.agentWorkspace.scheduledContact}</span>
              <span>{t.agentWorkspace.scheduledDate}</span>
              <span>{t.agentWorkspace.scheduledStep || "Step"}</span>
              <span>{t.agentWorkspace.scheduledCampaign}</span>
              <span className="text-right">{t.agentWorkspace.scheduledActions}</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-15" />
                  {scheduledItems.length > 0 ? (
                    <>
                      <p className="text-sm">{t.agentWorkspace.noFilteredItems}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => { setFilterType("all"); setTimeFilter("all"); setSearchQuery(""); }}
                        data-testid="btn-clear-scheduled-filters"
                      >
                        {t.agentWorkspace.scheduledAll}
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm">{t.agentWorkspace.noScheduledItems}</p>
                  )}
                </div>
              ) : (
                <div>
                  {filteredItems.map((item, idx) => {
                    const itemOverdue = isOverdue(item.scheduledAt);
                    return (
                      <div
                        key={item.id}
                        data-testid={`scheduled-item-${item.id}`}
                        className={`grid grid-cols-1 sm:grid-cols-[1fr_140px_80px_120px_90px] gap-x-2 gap-y-0.5 items-center px-4 py-2.5 border-b transition-colors hover:bg-muted/30 ${
                          itemOverdue ? "bg-destructive/[0.03]" : idx % 2 === 0 ? "" : "bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                            itemOverdue ? "bg-destructive/10 text-destructive" : getTypeColor(item.type)
                          }`}>
                            {itemOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : getTypeIcon(item.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <button
                                className="text-sm font-medium line-clamp-2 break-words text-left hover:underline cursor-pointer leading-tight"
                                data-testid={`text-scheduled-name-${item.id}`}
                                onClick={() => {
                                  if (onOpenContact) {
                                    const channel = item.type === "callback" ? "phone" : item.type;
                                    onOpenContact(item.contactId, item.campaignId, item.campaignContactId, channel as "phone" | "email" | "sms", item.contactType, item.isOutsideMission ? item.contactPhone : undefined);
                                    onOpenChange(false);
                                  }
                                }}
                              >
                                {item.contactName || t.agentWorkspace.unknownContact}
                              </button>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                                {getTypeLabel(item.type)}
                              </Badge>
                              {itemOverdue && (
                                <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 gap-0.5 shrink-0">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {t.agentWorkspace.overdueLabel}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                              {item.contactPhone && (
                                <span className="flex items-center gap-0.5">
                                  <Phone className="h-2.5 w-2.5" />
                                  {item.contactPhone}
                                </span>
                              )}
                              {item.contactEmail && (
                                <span className="flex items-center gap-0.5 truncate">
                                  <Mail className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">{item.contactEmail}</span>
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1 italic">{item.notes}</p>
                            )}
                          </div>
                        </div>

                        {item.calledBack && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                            <Check className="h-2.5 w-2.5" />
                            {t.agentWorkspace.inboundCallbackDone}
                          </span>
                        )}
                        <div className={`text-xs ${itemOverdue ? "text-destructive font-medium" : "text-foreground"}`}>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>{format(new Date(item.scheduledAt), "d.M.yyyy", { locale: sk })}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5 shrink-0" />
                            <span>{format(new Date(item.scheduledAt), "HH:mm")}</span>
                          </div>
                        </div>

                        <div className="flex items-center">
                          {item.callbackStatusListLabel ? (
                            <div className="flex flex-col gap-0.5 items-start" data-testid={`text-scheduled-step-${item.id}`}>
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 max-w-[170px] truncate"
                                title={item.callbackStatusListLabel}
                              >
                                {item.callbackStatusListLabel}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                ↳ {item.dispositionName || item.dispositionCode || getTypeLabel(item.type)}
                              </span>
                            </div>
                          ) : item.campaignQueueDisplayMode === "last_status" ? (
                            item.dispositionCode ? (
                              <div className="flex flex-col gap-0.5 items-start" data-testid={`text-scheduled-step-${item.id}`}>
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                                  title={item.dispositionName || item.dispositionCode}
                                >
                                  {item.dispositionName || item.dispositionCode}
                                </span>
                                {item.dispositionChecklistNames?.map((name, idx) => (
                                  <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                                    ↳ {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/50">—</span>
                            )
                          ) : item.stepName ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate"
                              style={{
                                backgroundColor: `hsl(${((item.stepIndex || 1) * 67) % 360}, 65%, 92%)`,
                                color: `hsl(${((item.stepIndex || 1) * 67) % 360}, 70%, 30%)`,
                              }}
                              title={`${item.stepIndex}. ${item.stepName}`}
                              data-testid={`text-scheduled-step-${item.id}`}
                            >
                              {item.stepIndex}. {item.stepName}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">—</span>
                          )}
                        </div>

                        <div className="text-[11px] text-muted-foreground truncate">
                          {item.isOutsideMission ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                              <PhoneIncoming className="h-2.5 w-2.5 shrink-0" />
                              {t.agentWorkspace.outsideMissionLabel}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Megaphone className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.campaignName}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-0.5">
                          {item.type === "callback" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={t.agentWorkspace.callNow}
                              data-testid={`btn-scheduled-call-${item.id}`}
                              onClick={() => {
                                if (onOpenContact) {
                                  onOpenContact(item.contactId, item.campaignId, item.campaignContactId, "phone", item.contactType, item.isOutsideMission ? item.contactPhone : undefined);
                                  onOpenChange(false);
                                }
                              }}
                            >
                              <PhoneCall className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                          )}
                          {(item.type === "email" || item.type === "sms") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={t.agentWorkspace.sendNow}
                              data-testid={`btn-scheduled-send-${item.id}`}
                              onClick={() => {
                                if (onOpenContact) {
                                  onOpenContact(item.contactId, item.campaignId, item.campaignContactId, item.type as "email" | "sms", item.contactType, item.isOutsideMission ? item.contactPhone : undefined);
                                  onOpenChange(false);
                                }
                              }}
                            >
                              <Send className="h-3.5 w-3.5 text-green-500" />
                            </Button>
                          )}
                          <ReschedulePopover
                            item={item}
                            t={t}
                            onReschedule={async (contactId, campaignId, newDate) => {
                              try {
                                if (item.isOutsideMission && item.inboundCallbackId) {
                                  await apiRequest("PATCH", `/api/agent/inbound-callbacks/${item.inboundCallbackId}`, { callbackDate: newDate });
                                  queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
                                  queryClient.invalidateQueries({ queryKey: ["/api/agent/inbound-callbacks"] });
                                } else {
                                  await apiRequest("PATCH", `/api/campaigns/${campaignId}/contacts/${contactId}`, {
                                    callbackDate: newDate,
                                    status: "callback_scheduled",
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
                                  queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
                                }
                                toast({ title: t.agentWorkspace.reschedule, description: format(new Date(newDate), "dd.MM.yyyy HH:mm") });
                              } catch (e) {
                                toast({ title: t.agentWorkspace.errorLabel, description: String(e), variant: "destructive" });
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={t.agentWorkspace.cancelItem}
                            data-testid={`btn-scheduled-cancel-${item.id}`}
                            onClick={async () => {
                              try {
                                if (item.isOutsideMission && item.inboundCallbackId) {
                                  await apiRequest("DELETE", `/api/agent/inbound-callbacks/${item.inboundCallbackId}`, {});
                                  queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
                                  queryClient.invalidateQueries({ queryKey: ["/api/agent/inbound-callbacks"] });
                                } else {
                                  await apiRequest("PATCH", `/api/campaigns/${item.campaignId}/contacts/${item.id}`, {
                                    status: "pending",
                                    callbackDate: null,
                                    assignedTo: null,
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
                                  queryClient.invalidateQueries({ queryKey: ["/api/campaigns", item.campaignId, "contacts"] });
                                }
                                toast({ title: t.agentWorkspace.cancelItem, description: t.agentWorkspace.itemCancelled });
                              } catch (e) {
                                toast({ title: t.agentWorkspace.errorLabel, description: String(e), variant: "destructive" });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t bg-muted/20 flex-shrink-0">
              <p className="text-[11px] text-muted-foreground">
                {filteredItems.length} / {scheduledItems.length} {t.agentWorkspace.scheduledTotal}
                {timeFilter !== "all" && <span className="ml-1">· {timeFilters.find(f => f.key === timeFilter)?.label}</span>}
                {filterType !== "all" && <span className="ml-1">· {filterType === "callback" ? t.agentWorkspace.scheduledCalls : filterType === "email" ? t.agentWorkspace.scheduledEmails : t.agentWorkspace.scheduledSms}</span>}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentWorkspacePage() {
  const { t, locale } = useI18n();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const nContacts = (n: number) => {
    const s = n === 1 ? t.agentWorkspace.contactSingular : (n >= 2 && n <= 4) ? t.agentWorkspace.contactFew : t.agentWorkspace.contactPlural;
    return `${n} ${s}`;
  };
  const { makeCall, isRegistered: isSipRegistered, isRegistering: isSipRegistering, register: sipRegister, incomingCall: sipIncomingCall, answerIncomingCall, rejectIncomingCall, setIncomingCallWithRef, setAnsweredIncomingSession, incomingCallRef } = useSip();
  const callContext = useCall();
  const [, setLocation] = useLocation();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const prevSidebarOpenRef = useRef(sidebarOpen);

  const agentSession = useAgentSession();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [currentContact, setCurrentContact] = useState<Customer | null>(null);
  const [currentPhoneOverride, setCurrentPhoneOverride] = useState<string | null>(null);
  const [currentContactType, setCurrentContactType] = useState<string>("customer");
  const [currentHospitalData, setCurrentHospitalData] = useState<Hospital | null>(null);
  const [currentClinicData, setCurrentClinicData] = useState<Clinic | null>(null);
  const [currentCollaboratorData, setCurrentCollaboratorData] = useState<Collaborator | null>(null);
  const [currentCampaignContactId, setCurrentCampaignContactId] = useState<string | null>(null);
  const [disposedContactIds, setDisposedContactIds] = useState<Set<string>>(new Set());
  const [sessionLoginOpen, setSessionLoginOpen] = useState(true);
  const [activeChannel, setActiveChannel] = useState("phone");
  const [phoneSubTabOverride, setPhoneSubTabOverride] = useState<"card" | "details" | "documents" | "history" | null>(null);
  const [rightTab, setRightTab] = useState("actions");
  const [callNotes, setCallNotes] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [stats, setStats] = useState({ calls: 0, emails: 0, sms: 0 });
  const [quotas, setQuotas] = useState<{ calls: number | null; emails: number | null; sms: number | null } | null>(null);
  const quotaCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const quotaDataRef = useRef<{ usage: { calls: number; emails: number; sms: number } } | null>(null);

  const fetchQuotaCheck = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/quota-check`, { credentials: "include" });
      if (!res.ok) {
        console.warn(`[QuotaCheck] Failed to fetch quotas for campaign ${campaignId}: ${res.status}`);
        return;
      }
      const data = await res.json();
      console.log(`[QuotaCheck] Response:`, JSON.stringify(data));
      const hasAnyQuota = data.quotas && (data.quotas.calls !== null || data.quotas.emails !== null || data.quotas.sms !== null);
      if (hasAnyQuota) {
        setQuotas(data.quotas);
        if (data.usage) {
          quotaDataRef.current = { usage: data.usage };
          setStats({
            calls: data.usage.calls || 0,
            emails: data.usage.emails || 0,
            sms: data.usage.sms || 0,
          });
        }
      } else {
        setQuotas(null);
        quotaDataRef.current = null;
      }
    } catch (err) {
      console.error(`[QuotaCheck] Error:`, err);
    }
  }, []);

  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const tasksRef = useRef<TaskItem[]>([]);
  tasksRef.current = tasks;
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isLoadingInboundContact, setIsLoadingInboundContact] = useState(false);
  const [acwStartedAt, setAcwStartedAt] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [scheduledQueueOpen, setScheduledQueueOpen] = useState(false);
  const [abandonedCallsOpen, setAbandonedCallsOpen] = useState(false);
  const [myActivityOpen, setMyActivityOpen] = useState(false);
  const [abandonedCallsFilter, setAbandonedCallsFilter] = useState<"all" | "pending" | "handled">("all");
  const [missedCallNotifs, setMissedCallNotifs] = useState<Array<{ id: number; title: string; description: string }>>([]);
  const pendingCallbackAbandonedIdRef = useRef<string | null>(null);
  const [historyDetailModal, setHistoryDetailModal] = useState<TimelineEntry | ContactHistory | null>(null);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [modalExpandedGroups, setModalExpandedGroups] = useState<Set<string>>(new Set(["due", "my-cb", "team-cb", "other-cb", "pending"]));
  const toggleModalGroup = (id: string) => setModalExpandedGroups(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [createTaskForm, setCreateTaskForm] = useState({ title: "", description: "", priority: "medium", assignedUserId: "", dueDate: "", groupId: "" });
  const [dispositionModalOpen, setDispositionModalOpen] = useState(false);
  const [dispositionOpenedAt, setDispositionOpenedAt] = useState<number | null>(null);
  const [dispositionChannelFilter, setDispositionChannelFilter] = useState<"phone" | "email" | "sms" | null>(null);
  const [modalSelectedParent, setModalSelectedParent] = useState<string | null>(null);
  const [modalCallbackDate, setModalCallbackDate] = useState("");
  const [modalCallbackTime, setModalCallbackTime] = useState("09:00");
  const [modalCallbackAssign, setModalCallbackAssign] = useState<"me" | "all">("me");
  const [modalCallbackNote, setModalCallbackNote] = useState("");
  const [activeDispCategory, setActiveDispCategory] = useState<string>("__all__");
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [multiSelectedCodes, setMultiSelectedCodes] = useState<string[]>([]);
  const [checklistParentId, setChecklistParentId] = useState<string | null>(null);
  const [checklistSelectedCodes, setChecklistSelectedCodes] = useState<string[]>([]);
  const [checklistCallbackDate, setChecklistCallbackDate] = useState("");
  const [checklistCallbackTime, setChecklistCallbackTime] = useState("09:00");
  const [checklistCallbackAssign, setChecklistCallbackAssign] = useState<"me" | "all">("me");
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [pendingEmailTemplateId, setPendingEmailTemplateId] = useState<string | null>(null);
  const [mandatoryDisposition, setMandatoryDisposition] = useState(false);
  const [isNonMissionInboundDisposition, setIsNonMissionInboundDisposition] = useState(false);
  const [callEndTimestamp, setCallEndTimestamp] = useState<number | null>(null);
  const [wrapUpElapsed, setWrapUpElapsed] = useState(0);
  const wrapUpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevCallStateRef = useRef(callContext.callState);
  const isMobile = useIsMobile();

  const inboundPhone = callContext.callInfo?.direction === "inbound" ? callContext.callInfo?.phoneNumber : null;
  const { data: inboundPhoneMatches = [] } = useQuery<PhoneMatch[]>({
    queryKey: ["/api/phone/lookup-all", inboundPhone],
    queryFn: async () => {
      if (!inboundPhone || inboundPhone === "Unknown") return [];
      const res = await fetch(`/api/phone/lookup-all?phone=${encodeURIComponent(inboundPhone)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!inboundPhone && inboundPhone !== "Unknown" && callContext.callState !== "idle",
    staleTime: 60000,
  });

  const handleSelectInboundMatch = async (
    match: PhoneMatch,
    mode: "card" | "details" | "open",
    inboundTaskContext?: { callId?: string; campaignId?: string; campaignName?: string; callerNumber?: string }
  ) => {
    try {
      let contact: Customer | null = null;
      if (match.entityType === "customer") {
        const res = await fetch(`/api/customers/${match.id}`, { credentials: "include" });
        if (!res.ok) return;
        const customer: Customer = await res.json();
        contact = customer;
        setCurrentContact(customer);
        setCurrentContactType("customer");
        setCurrentHospitalData(null);
        setCurrentClinicData(null);
        setCurrentCollaboratorData(null);
        setActiveChannel("phone");
        setPhoneSubTabOverride(mode === "card" ? "card" : "details");
        setTimeout(() => setPhoneSubTabOverride(null), 100);
      } else if (match.entityType === "hospital") {
        const res = await fetch(`/api/hospitals/${match.id}`, { credentials: "include" });
        if (!res.ok) return;
        const hospital = await res.json();
        const virtualCustomer: Customer = {
          id: hospital.id, firstName: hospital.name || "", lastName: "",
          email: hospital.email || null, phone: hospital.phone || null,
          countryCode: hospital.countryCode || null,
        } as Customer;
        contact = virtualCustomer;
        setCurrentContact(virtualCustomer);
        setCurrentContactType("hospital");
        setCurrentHospitalData(hospital);
        setCurrentClinicData(null);
        setCurrentCollaboratorData(null);
        setActiveChannel("phone");
        setPhoneSubTabOverride(mode === "card" ? "card" : "details");
        setTimeout(() => setPhoneSubTabOverride(null), 100);
      } else if (match.entityType === "clinic") {
        const res = await fetch(`/api/clinics/${match.id}`, { credentials: "include" });
        if (!res.ok) return;
        const clinic = await res.json();
        const virtualCustomer: Customer = {
          id: clinic.id, firstName: clinic.clinicName || clinic.name || "",
          lastName: clinic.doctorName || "",
          email: clinic.email || null, phone: clinic.phone || null,
          countryCode: clinic.countryCode || null,
        } as Customer;
        contact = virtualCustomer;
        setCurrentContact(virtualCustomer);
        setCurrentContactType("clinic");
        setCurrentHospitalData(null);
        setCurrentClinicData(clinic);
        setCurrentCollaboratorData(null);
        setActiveChannel("phone");
        setPhoneSubTabOverride(mode === "card" ? "card" : "details");
        setTimeout(() => setPhoneSubTabOverride(null), 100);
      } else if (match.entityType === "collaborator") {
        const res = await fetch(`/api/collaborators/${match.id}`, { credentials: "include" });
        if (!res.ok) return;
        const collaborator = await res.json();
        const virtualCustomer: Customer = {
          id: collaborator.id, firstName: collaborator.firstName || collaborator.name || "",
          lastName: collaborator.lastName || "",
          email: collaborator.email || null, phone: collaborator.phone || null,
          countryCode: collaborator.countryCode || null,
        } as Customer;
        contact = virtualCustomer;
        setCurrentContact(virtualCustomer);
        setCurrentContactType("collaborator");
        setCurrentHospitalData(null);
        setCurrentClinicData(null);
        setCurrentCollaboratorData(collaborator);
        setActiveChannel("phone");
        setPhoneSubTabOverride(mode === "card" ? "card" : "details");
        setTimeout(() => setPhoneSubTabOverride(null), 100);
      }

      // Sync selected identity to sip-phone — sip-phone updates localCustomerIdRef AND PATCHes call log
      if (contact) {
        callContext.updateCallCustomerFn.current?.(String(contact.id));
      }

      if (inboundTaskContext && contact) {
        const newTask: TaskItem = {
          id: `task-inbound-${Date.now()}`,
          contact,
          campaignId: inboundTaskContext.campaignId || "",
          campaignName: inboundTaskContext.campaignName || "Inbound",
          campaignContactId: null,
          channel: "phone",
          startedAt: new Date(),
          status: "active",
          direction: "inbound",
        };
        const dupTask1 = tasksRef.current.find(t => !t.campaignContactId && t.contact?.id === contact.id);
        if (dupTask1) {
          setActiveTaskId(dupTask1.id);
        } else {
          setTasks((prev) => [...prev, newTask]);
          setActiveTaskId(newTask.id);
          setTimeline([{
            id: `sys-inbound-${Date.now()}`,
            type: "system",
            timestamp: new Date(),
            content: `Prichádzajúci hovor od ${match.name} (${inboundTaskContext.callerNumber || ""})`,
            details: "Inbound call",
          }]);
        }
      }
    } catch (e) {
      console.error("Error loading inbound match entity:", e);
    }
  };
  const callWasActiveRef = useRef(false);
  const [ringDuration, setRingDuration] = useState(0);
  const ringTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [callActiveContactId, setCallActiveContactId] = useState<string | number | null>(null);
  const callActiveContactIdSetRef = useRef(false);
  const [modalFilter, setModalFilter] = useState<"all" | "my_callbacks" | "team_callbacks" | "pending" | "due">("all");
  const [modalSort, setModalSort] = useState<"callback_asc" | "name_asc" | "attempts_desc">("callback_asc");
  const [modalSearch, setModalSearch] = useState("");
  const [modalSearchField, setModalSearchField] = useState("all");
  const [showModalFieldPicker, setShowModalFieldPicker] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedLoginCampaignIds, setSelectedLoginCampaignIds] = useState<string[]>([]);
  const [selectedLoginQueueIds, setSelectedLoginQueueIds] = useState<string[]>([]);
  const [loginBackOffice, setLoginBackOffice] = useState(false);
  const [backOfficeModeActive, setBackOfficeModeActive] = useState(false);
  const [mainWorkspaceTab, setMainWorkspaceTab] = useState<"pulse" | "back_office">("pulse");
  const prevStatusBeforeBackOffice = useRef<AgentStatus | null>(null);
  const [allowInboundInBO, setAllowInboundInBO] = useState(false);
  const [contractWizardOpen, setContractWizardOpen] = useState(false);
  const [pendingInboundMatches, setPendingInboundMatches] = useState<{ phone: string; matches: PhoneMatch[]; callId?: string } | null>(null);
  const [pendingUnknownCaller, setPendingUnknownCaller] = useState<{ phone: string } | null>(null);
  const [createFromCallType, setCreateFromCallType] = useState<"customer" | "hospital" | "clinic" | "person" | null>(null);
  const [createIsLoading, setCreateIsLoading] = useState(false);
  const [contractWizardStep, setContractWizardStep] = useState(1);
  const [contractForm, setContractForm] = useState({ categoryId: "", customerId: "", billingDetailsId: "", currency: "EUR", notes: "", numberRangeId: "" });
  const [inboundCalls, setInboundCalls] = useState<Array<{
    callId: string; callerNumber: string; callerName?: string;
    queueName: string; queueId: string; waitTime: number;
    channelId: string; timestamp: number;
    hasSipInvitation?: boolean;
    sipInvitation?: any;
    recordCalls?: boolean;
    ringtoneId?: string;
    isQueueWaiting?: boolean;
  }>>([]);
  const inboundCallsRef = useRef(inboundCalls);
  inboundCallsRef.current = inboundCalls;

  const [forwardedCallActive, setForwardedCallActive] = useState<{
    callId: string; callerNumber: string; callerName?: string; startedAt: Date;
  } | null>(null);
  const forwardedCallActiveRef = useRef(forwardedCallActive);
  forwardedCallActiveRef.current = forwardedCallActive;
  const sessionQueueIdsRef = useRef<string[]>([]);
  const cancelledCallIdsRef = useRef<Set<string>>(new Set());
  const openingContactsRef = useRef<Set<string>>(new Set());
  const pendingCcIdRef = useRef<string | null>(null);
  const filteredCallerNumbersRef = useRef<Map<string, number>>(new Map());
  const acceptingCallRef = useRef(false);
  const wasInboundCallRef = useRef(false);
  const dialingRef = useRef(false);

  // Register callback so sip-phone triggers wasInboundCallRef=true on every answered inbound call
  useEffect(() => {
    callContext.onInboundAnsweredFn.current = () => {
      wasInboundCallRef.current = true;
    };
  }, []);
  const dispositionContextRef = useRef<{
    taskId: string | null;
    contactId: string | null;
    campaignContactId: string | null;
    campaignId: string | null;
    isInboundCall: boolean;
  } | null>(null);

  const [inboundRingtoneEnabled, setInboundRingtoneEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem("indexus.pulse.inboundRingtone") === "1"; } catch { return false; }
  });
  const inboundRingtoneEnabledRef = useRef(inboundRingtoneEnabled);
  inboundRingtoneEnabledRef.current = inboundRingtoneEnabled;
  const inboundAudioCtxRef = useRef<AudioContext | null>(null);
  const inboundRingtoneIntervalRef = useRef<number | null>(null);
  const inboundRingtoneActiveRef = useRef(false);

  const stopInboundRingtone = useCallback(() => {
    inboundRingtoneActiveRef.current = false;
    if (inboundRingtoneIntervalRef.current !== null) {
      window.clearInterval(inboundRingtoneIntervalRef.current);
      inboundRingtoneIntervalRef.current = null;
    }
  }, []);

  const playInboundRingtoneBurst = useCallback((presetId?: string) => {
    try {
      let ctx = inboundAudioCtxRef.current;
      if (!ctx || ctx.state === "closed") {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        ctx = new Ctor() as AudioContext;
        inboundAudioCtxRef.current = ctx;
      }
      const doPlay = (c: AudioContext) => {
        try {
          const preset = getInboundRingtonePreset(presetId);
          preset.play(c, c.currentTime);
        } catch {}
      };
      if (ctx.state === "suspended") {
        ctx.resume().then(() => doPlay(ctx!)).catch(() => {});
      } else {
        doPlay(ctx);
      }
    } catch (err) {
      console.warn("[Pulse] Inbound ringtone playback failed:", err);
    }
  }, []);

  const startInboundRingtone = useCallback((presetId?: string) => {
    if (inboundRingtoneActiveRef.current) return;
    inboundRingtoneActiveRef.current = true;
    const preset = getInboundRingtonePreset(presetId);
    playInboundRingtoneBurst(preset.id);
    if (inboundRingtoneIntervalRef.current !== null) {
      window.clearInterval(inboundRingtoneIntervalRef.current);
    }
    inboundRingtoneIntervalRef.current = window.setInterval(() => {
      if (!inboundRingtoneActiveRef.current) return;
      playInboundRingtoneBurst(preset.id);
    }, preset.intervalMs);
  }, [playInboundRingtoneBurst]);

  const toggleInboundRingtone = useCallback(() => {
    setInboundRingtoneEnabled(prev => {
      const next = !prev;
      try { window.localStorage.setItem("indexus.pulse.inboundRingtone", next ? "1" : "0"); } catch {}
      if (!next) {
        stopInboundRingtone();
      } else {
        try {
          const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (Ctor && !inboundAudioCtxRef.current) {
            inboundAudioCtxRef.current = new Ctor();
          }
          if (inboundAudioCtxRef.current && inboundAudioCtxRef.current.state === "suspended") {
            inboundAudioCtxRef.current.resume().catch(() => {});
          }
        } catch {}
      }
      return next;
    });
  }, [stopInboundRingtone]);

  const { canAccessModule } = usePermissions();
  const hasModuleAccess = user && canAccessModule("nexusPulse");
  const canBackOfficeAgenda = !!user && canAccessModule("back_office_agenda");
  useEffect(() => {
    if (!canBackOfficeAgenda) {
      setLoginBackOffice(false);
      setBackOfficeModeActive(false);
      setMainWorkspaceTab("pulse");
    }
  }, [canBackOfficeAgenda]);

  const { data: workspaceAccess = [] } = useQuery<any[]>({
    queryKey: ["/api/agent-workspace-access/current"],
    enabled: !!hasModuleAccess,
  });

  const { data: allUsersForTasks = [] } = useQuery<Array<{ id: string; username: string; fullName: string | null }>>({
    queryKey: ["/api/users"],
    enabled: !!hasModuleAccess,
  });

  const { data: taskGroupsForCreate = [] } = useQuery<any[]>({
    queryKey: ["/api/task-groups"],
    enabled: !!hasModuleAccess,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; priority: string; assignedUserId: string; customerId?: string; dueDate?: string; country?: string; groupId?: string }) => {
      const payload: any = {
        title: data.title,
        priority: data.priority,
        assignedUserId: data.assignedUserId,
      };
      if (data.description) payload.description = data.description;
      if (data.dueDate) payload.dueDate = new Date(data.dueDate).toISOString();
      if (data.customerId) payload.customerId = data.customerId;
      if (data.country) payload.country = data.country;
      if (data.groupId) payload.tags = [`group_id:${data.groupId}`];
      return apiRequest("POST", "/api/tasks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: t.quickCreate.taskCreated, description: t.quickCreate.taskCreatedDesc });
      setCreateTaskDialogOpen(false);
      setCreateTaskForm({ title: "", description: "", priority: "medium", assignedUserId: "", dueDate: "", groupId: "" });
    },
    onError: (e: any) => {
      console.error("[CreateTask] Error:", e);
      toast({ title: t.quickCreate.createFailed, description: e?.message || String(e), variant: "destructive" });
    },
  });

  const allowedCountries = useMemo(() => {
    return workspaceAccess.map((a: any) => a.countryCode);
  }, [workspaceAccess]);

  const hasAccess = user && hasModuleAccess;

  const { data: scheduledQueueItems = [] } = useQuery<ScheduledItem[]>({
    queryKey: ["/api/agent/scheduled-queue"],
    queryFn: async () => {
      const res = await fetch("/api/agent/scheduled-queue", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!hasAccess && agentSession.isSessionActive,
    refetchInterval: 60000,
  });

  type BOAgendaItem = {
    task: { id: string; title: string; priority: string; dueDate: string | null; boState: string | null; status: string; country: string | null };
    confirmation: { id: string; confirmedAt: string } | null;
  };
  const { data: boAgendaItems = [] } = useQuery<BOAgendaItem[]>({
    queryKey: ["/api/back-office/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/back-office/tasks", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!hasAccess && sessionLoginOpen && !agentSession.isSessionActive,
    refetchInterval: 30000,
  });

  const scheduledQueueCounts = useMemo(() => {
    const now = new Date();
    const overdue = scheduledQueueItems.filter(item => new Date(item.scheduledAt) < now);
    return { total: scheduledQueueItems.length, overdue: overdue.length };
  }, [scheduledQueueItems]);

  const { data: agentInboundCallbacks = [] } = useQuery<InboundCb[]>({
    queryKey: ["/api/agent/inbound-callbacks"],
    queryFn: async () => {
      const res = await fetch("/api/agent/inbound-callbacks", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!hasAccess && agentSession.isSessionActive,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (quotaCheckIntervalRef.current) {
      clearInterval(quotaCheckIntervalRef.current);
      quotaCheckIntervalRef.current = null;
    }
    if (selectedCampaignId) {
      fetchQuotaCheck(selectedCampaignId);
      quotaCheckIntervalRef.current = setInterval(() => {
        if (selectedCampaignId) fetchQuotaCheck(selectedCampaignId);
      }, 120000);
    } else {
      setQuotas(null);
      quotaDataRef.current = null;
    }
    return () => {
      if (quotaCheckIntervalRef.current) {
        clearInterval(quotaCheckIntervalRef.current);
        quotaCheckIntervalRef.current = null;
      }
    };
  }, [selectedCampaignId, fetchQuotaCheck]);

  const isQuotaBlocked = useCallback((type: "calls" | "emails" | "sms") => {
    if (!quotas) return false;
    const limit = quotas[type];
    if (limit === null || limit === undefined) return false;
    return stats[type] >= limit;
  }, [quotas, stats]);

  useEffect(() => {
    if (user && hasModuleAccess && !hasAccess && workspaceAccess !== undefined) {
      setLocation("/");
    }
  }, [user, hasModuleAccess, hasAccess, setLocation, workspaceAccess]);

  useEffect(() => {
    if (hasAccess && !agentSession.isSessionActive && !agentSession.isLoading) {
      setSessionLoginOpen(true);
      setSelectedLoginCampaignIds([]);
    }
  }, [hasAccess, agentSession.isSessionActive, agentSession.isLoading]);

  useEffect(() => {
    if (agentSession.isSessionActive) {
      prevSidebarOpenRef.current = sidebarOpen;
      setSidebarOpen(false);
      document.documentElement.setAttribute('data-agent-fullscreen', 'true');
      callContext.setPreventAutoReset(true);
    } else {
      document.documentElement.removeAttribute('data-agent-fullscreen');
      callContext.setPreventAutoReset(false);
    }
  }, [agentSession.isSessionActive]);

  useEffect(() => {
    return () => {
      setSidebarOpen(prevSidebarOpenRef.current);
      document.documentElement.removeAttribute('data-agent-fullscreen');
      callContext.setPreventAutoReset(false);
      if (ringTimerRef.current) {
        clearInterval(ringTimerRef.current);
        ringTimerRef.current = null;
      }
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const curr = callContext.callState;
    if (curr === "connecting" || curr === "ringing") {
      callWasActiveRef.current = true;
      if (!ringTimerRef.current) {
        const startTime = Date.now();
        setRingDuration(0);
        ringTimerRef.current = setInterval(() => {
          setRingDuration(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
      }
    }
    if (curr === "active" || curr === "on_hold") {
      callWasActiveRef.current = true;
      if (ringTimerRef.current) {
        clearInterval(ringTimerRef.current);
        ringTimerRef.current = null;
      }
    }
    if ((callWasActiveRef.current || wasInboundCallRef.current) && curr === "ended") {
      if (ringTimerRef.current) {
        clearInterval(ringTimerRef.current);
        ringTimerRef.current = null;
      }
      callWasActiveRef.current = false;
      const isInboundCall = wasInboundCallRef.current || callContext.callDirection === "inbound";
      const campSettings = (() => { try { return selectedCampaign?.settings ? JSON.parse(selectedCampaign.settings) : {}; } catch { return {}; } })();
      if (campSettings.workflowMode === "status_list") {
        // status_list mode: always start ACW immediately for any call (inbound or outbound)
        setAcwStartedAt(Date.now());
      } else if (isInboundCall || (currentContact && currentCampaignContactId)) {
        // Normal mode: open disposition modal
        dispositionContextRef.current = {
          taskId: activeTaskId,
          contactId: currentContact?.id ?? null,
          campaignContactId: currentCampaignContactId,
          campaignId: selectedCampaignId,
          isInboundCall: isInboundCall,
        };
        setCallEndTimestamp(Date.now());
        setDispositionChannelFilter("phone");
        const isNMInbound = isInboundCall && !currentCampaignContactId;
        setIsNonMissionInboundDisposition(isNMInbound);
        // Non-mission inbound with no campaign: not mandatory (agent uses dedicated scheduler)
        setMandatoryDisposition(!isNMInbound);
        // Auto-open disposition based on campaign setting autoOpenDisposition (default true).
        // Opens regardless of who hung up — the agent always needs to record the call outcome.
        const autoOpenDisposition = campSettings.autoOpenDisposition !== false;
        if (autoOpenDisposition) {
          setDispositionModalOpen(true);
        }
      }
      if (pendingCallbackAbandonedIdRef.current) {
        const abandonedId = pendingCallbackAbandonedIdRef.current;
        pendingCallbackAbandonedIdRef.current = null;
        fetch(`/api/agent/abandoned-calls/${abandonedId}/called-back`, {
          method: "POST",
          credentials: "include",
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/agent/abandoned-calls"] });
        }).catch(console.error);
      }
    }
    if (callWasActiveRef.current && curr === "idle") {
      const wasInbound = wasInboundCallRef.current;
      const prevState = prevCallStateRef.current;
      callWasActiveRef.current = false;
      if (ringTimerRef.current) {
        clearInterval(ringTimerRef.current);
        ringTimerRef.current = null;
      }
      if (pendingCallbackAbandonedIdRef.current) {
        const abandonedId = pendingCallbackAbandonedIdRef.current;
        pendingCallbackAbandonedIdRef.current = null;
        fetch(`/api/agent/abandoned-calls/${abandonedId}/called-back`, {
          method: "POST",
          credentials: "include",
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/agent/abandoned-calls"] });
        }).catch(console.error);
      }
      // Direct active→idle transition (caller hung up via remoteHangupFn, skipping "ended")
      // Trigger disposition the same way the normal "ended" path does.
      if (prevState !== "ended" && (wasInbound || callContext.callDirection === "inbound")) {
        dispositionContextRef.current = {
          taskId: activeTaskId,
          contactId: currentContact?.id ?? null,
          campaignContactId: currentCampaignContactId,
          campaignId: selectedCampaignId,
          isInboundCall: true,
        };
        setCallEndTimestamp(Date.now());
        setDispositionChannelFilter("phone");
        const isNMInbound = !currentCampaignContactId;
        setIsNonMissionInboundDisposition(isNMInbound);
        setMandatoryDisposition(!isNMInbound);
        const campSettings = (() => { try { return selectedCampaign?.settings ? JSON.parse(selectedCampaign.settings) : {}; } catch { return {}; } })();
        if (campSettings.autoOpenDisposition !== false && campSettings.workflowMode !== "status_list") {
          setDispositionModalOpen(true);
        }
      }
    }
    // Always clear inbound tracking on idle regardless of callWasActiveRef gate
    if (curr === "idle") {
      wasInboundCallRef.current = false;
      callContext.setCallDirection(null);
      setRingDuration(0);
    }
    prevCallStateRef.current = curr;
  }, [callContext.callState, callContext.callDirection, currentContact, currentCampaignContactId]);

  // Track which contact is on the active call — set once when call goes active, cleared on idle.
  // Uses a guard ref to prevent re-setting when agent switches tasks mid-call.
  useEffect(() => {
    const isActive = ["active", "on_hold", "connecting", "ringing"].includes(callContext.callState);
    if (isActive && currentContact && !callActiveContactIdSetRef.current) {
      setCallActiveContactId(currentContact.id);
      callActiveContactIdSetRef.current = true;
    } else if (callContext.callState === "idle") {
      setCallActiveContactId(null);
      callActiveContactIdSetRef.current = false;
    }
  }, [callContext.callState, currentContact?.id]);

  // Post-call wrap-up timer: count seconds elapsed since call ended, until disposition is submitted
  useEffect(() => {
    if (callEndTimestamp !== null) {
      const startMs = callEndTimestamp;
      setWrapUpElapsed(Math.floor((Date.now() - startMs) / 1000));
      wrapUpTimerRef.current = setInterval(() => {
        setWrapUpElapsed(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
      return () => {
        if (wrapUpTimerRef.current) {
          clearInterval(wrapUpTimerRef.current);
          wrapUpTimerRef.current = null;
        }
      };
    } else {
      if (wrapUpTimerRef.current) {
        clearInterval(wrapUpTimerRef.current);
        wrapUpTimerRef.current = null;
      }
      setWrapUpElapsed(0);
    }
  }, [callEndTimestamp]);

  // Gentle beep alert at exactly 10 seconds of post-call wait
  useEffect(() => {
    if (wrapUpElapsed === 10 && mandatoryDisposition) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      } catch (_) {}
    }
  }, [wrapUpElapsed, mandatoryDisposition]);

  const { data: allCampaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!hasAccess,
  });

  const { data: assignedCampaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/user/assigned-campaigns"],
    enabled: !!hasAccess,
  });

  const baseCampaigns = showOnlyAssigned ? assignedCampaigns : allCampaigns;

  const campaignFilters = useMemo(() => {
    const now = new Date();
    const isAvailable = (c: Campaign) => {
      if (c.status === "paused" || c.status === "draft" || c.status === "completed" || c.status === "cancelled") return false;
      if (c.startDate && new Date(c.startDate) > now) return false;
      if (c.endDate && new Date(c.endDate) < now) return false;
      return true;
    };
    const countryFilter = (c: Campaign) => {
      if (user?.role === "admin") return true;
      if (allowedCountries.length === 0) return true;
      if (!c.countryCodes || c.countryCodes.length === 0) return true;
      return c.countryCodes.some((code: string) => allowedCountries.includes(code));
    };
    return { isAvailable, countryFilter };
  }, [allowedCountries, user?.role]);

  const campaigns = useMemo(() => {
    return baseCampaigns.filter((c) => campaignFilters.isAvailable(c) && campaignFilters.countryFilter(c));
  }, [baseCampaigns, campaignFilters]);

  const loginCampaigns = useMemo(() => {
    const source = assignedCampaigns.length > 0 ? assignedCampaigns : allCampaigns;
    return source.filter((c) => campaignFilters.isAvailable(c) && campaignFilters.countryFilter(c));
  }, [allCampaigns, assignedCampaigns, campaignFilters]);

  const { data: myQueues = [] } = useQuery<Array<{
    id: string; name: string; description: string | null; countryCode: string | null;
    didNumber: string | null; strategy: string; isActive: boolean;
    activeFrom: string | null; activeTo: string | null;
    waiting: number; activeAgents: number; activeCalls: number;
    afterHoursAction: string | null; afterHoursTarget: string | null;
    afterHoursVoicemailBoxId: string | null; afterHoursVoicemailBoxName: string | null;
  }>>({
    queryKey: ["/api/agent/my-queues"],
    enabled: !!hasAccess,
    refetchInterval: 10000,
  });

  const shiftDataCampaignIds = agentSession.isSessionActive
    ? ((((agentSession.session as any)?.campaignIds as string[]) || selectedLoginCampaignIds) || []).join(",")
    : loginCampaigns.map(c => c.id).join(",");
  const { data: shiftData, refetch: refetchShiftData } = useQuery<{
    callerIdNumber: string | null;
    contactsHandled: number;
    totalCallsToday: number;
    conversionsToday: number;
    totalBreakMinutes: number;
    totalBreakSeconds: number;
    totalCallMinutes: number;
    totalWorkMinutes: number;
    dispositionsToday: number;
    campaignData: Record<string, { workingHoursStart: string; workingHoursEnd: string; dailyCallQuota: number | null; contactsToday: number; maxContactsPerDay: number | null; conversionGoal: number }>;
  }>({
    queryKey: [`/api/agent-sessions/shift-data?campaignIds=${shiftDataCampaignIds}`],
    enabled: !!hasAccess,
    refetchOnMount: true,
    staleTime: 0,
    refetchInterval: agentSession.isSessionActive ? 30000 : false,
  });

  const { data: scheduledForecast, refetch: refetchForecast } = useQuery<{ byDate: Record<string, number> }>({
    queryKey: [`/api/agent/scheduled-forecast?campaignIds=${shiftDataCampaignIds}`],
    enabled: !!hasAccess,
    refetchOnMount: true,
    staleTime: 0,
  });

  useEffect(() => {
    if (sessionLoginOpen && !agentSession.isSessionActive) {
      refetchShiftData();
      refetchForecast();
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/my-queues"] });
    }
  }, [sessionLoginOpen, agentSession.isSessionActive]);

  const { data: abandonedCalls = [] } = useQuery<any[]>({
    queryKey: ["/api/agent/abandoned-calls"],
    enabled: !!hasAccess && agentSession.isSessionActive,
    refetchInterval: 30000,
  });

  const { data: legacyCampaignDispositions = [] } = useQuery<CampaignDisposition[]>({
    queryKey: ["/api/campaigns", selectedCampaignId, "dispositions"],
    enabled: !!selectedCampaignId,
  });

  const { data: nexusPulseData } = useQuery<{ categories: any[]; statuses: any[]; assignments: any[] }>({
    queryKey: ["/api/campaigns", selectedCampaignId, "assigned-statuses"],
    enabled: !!selectedCampaignId,
  });

  const { data: fwdDataPage } = useQuery<{ enabled: boolean; number: string | null }>({
    queryKey: ["/api/users", user?.id, "call-forwarding"],
    queryFn: () => fetch(`/api/users/${user!.id}/call-forwarding`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const callForwardingActive = !!(fwdDataPage?.enabled && fwdDataPage?.number);

  // Use NexusPulse ONLY when assigned statuses exist AND no legacy parent dispositions
  // (same logic as campaign-detail AgentPreview previewUseNexus)
  const legacyActiveParents = useMemo(
    () => legacyCampaignDispositions.filter((d: any) => !d.parentId && d.isActive !== false),
    [legacyCampaignDispositions]
  );
  const useNexusPulse = (nexusPulseData?.statuses?.length ?? 0) > 0 && legacyActiveParents.length === 0;

  const campaignDispositions = useMemo<any[]>(() => {
    if (useNexusPulse) {
      return (nexusPulseData?.statuses || []).map((s: any) => ({
        ...s,
        actionType: s.defaultAction,
        channel: s.allowPhone ? "phone" : s.allowEmail ? "email" : s.allowSms ? "sms" : "phone",
        isActive: s.isActive !== false,
      }));
    }
    return legacyCampaignDispositions;
  }, [useNexusPulse, nexusPulseData, legacyCampaignDispositions]);

  const dispositionCategories = useMemo<any[]>(() => {
    if (!useNexusPulse) return [];
    const cats = nexusPulseData?.categories || [];
    if (cats.length === 0) return [];
    const usedCatIds = new Set(campaignDispositions.map((d: any) => d.categoryId).filter(Boolean));
    return cats
      .filter((c: any) => usedCatIds.has(c.id))
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [useNexusPulse, nexusPulseData, campaignDispositions]);

  const dispChannelAllowed = (d: any, ch: "phone" | "email" | "sms" | null): boolean => {
    if (!ch) return true;
    if (ch === "phone") return d.allowPhone != null ? d.allowPhone === true : d.channel === "phone";
    if (ch === "email") return d.allowEmail != null ? d.allowEmail === true : d.channel === "email";
    if (ch === "sms")   return d.allowSms   != null ? d.allowSms   === true : d.channel === "sms";
    return true;
  };

  const { data: contractCategories = [] } = useQuery<Array<{ id: number; value: string; label: string }>>({
    queryKey: ["/api/contracts/categories"],
    enabled: contractWizardOpen,
  });
  const { data: contractBillingDetails = [] } = useQuery<Array<{ id: string; companyName: string; countryCode: string }>>({
    queryKey: ["/api/billing-details"],
    enabled: contractWizardOpen,
  });
  const contractCustomerCountry = currentContact?.country || "SK";
  const { data: contractNumberRanges = [] } = useQuery<Array<{ id: string; name: string; countryCode: string; type: string; prefix: string | null; suffix: string | null; digitsToGenerate: number; startNumber: number; endNumber: number; lastNumberUsed: number | null; isActive: boolean }>>(
    {
      queryKey: ["/api/configurator/number-ranges", contractCustomerCountry],
      queryFn: async () => {
        const res = await fetch(`/api/configurator/number-ranges?countries=${contractCustomerCountry}`, { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      },
      enabled: contractWizardOpen,
    }
  );
  const activeContractRanges = contractNumberRanges.filter(nr => nr.isActive && nr.type === "contract" && (nr.countryCode === contractCustomerCountry || !nr.countryCode));

  const createContractMutation = useMutation({
    mutationFn: async (data: typeof contractForm) => apiRequest("POST", "/api/contracts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setContractWizardOpen(false);
      setContractWizardStep(1);
      setContractForm({ categoryId: "", customerId: "", billingDetailsId: "", currency: "EUR", notes: "", numberRangeId: "" });
      toast({ title: t.contractsModule?.contractSigned || "Zmluva vytvorená", description: t.contractsModule?.contractSignedMessage || "Zmluva bola úspešne vytvorená" });
    },
    onError: (error: Error) => {
      toast({ title: t.contractsModule?.saveError || "Chyba", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenContractWizard = useCallback(() => {
    if (currentContact) {
      setContractForm(prev => ({ ...prev, customerId: currentContact.id }));
      setContractWizardStep(1);
      setContractWizardOpen(true);
    }
  }, [currentContact]);

  const userLocale = useMemo(() => {
    const countryToLang: Record<string, string> = { SK: 'sk', CZ: 'cs', AT: 'de', HU: 'hu', RO: 'ro', IT: 'it', DE: 'de', US: 'en' };
    if (user?.countries?.length) {
      return countryToLang[user.countries[0]] || locale;
    }
    return locale;
  }, [user?.countries, locale]);

  const getDispName = (disp: { code: string; name: string }) => {
    return disp.name;
  };

  const { data: rawCampaignContacts = [] } = useQuery<EnrichedCampaignContact[]>({
    queryKey: ["/api/campaigns", selectedCampaignId, "contacts"],
    enabled: !!selectedCampaignId && !!hasAccess,
    refetchInterval: 10000,
  });

  const pendingCampaignContacts = useMemo(() => {
    return rawCampaignContacts.filter((cc) => {
      if (!(cc.customer || cc.hospital || cc.clinic || cc.collaborator)) return false;
      if (!(cc.status === "pending" || cc.status === "callback_scheduled")) return false;
      if (disposedContactIds.has(cc.id)) return false;
      return true;
    });
  }, [rawCampaignContacts, disposedContactIds]);

  const currentCampaignContact = useMemo(() => {
    if (!currentCampaignContactId) return null;
    return rawCampaignContacts.find(cc => cc.id === currentCampaignContactId) || null;
  }, [rawCampaignContacts, currentCampaignContactId]);

  // When currentCampaignContactId is null (e.g. inbound call matched to a contact),
  // try to find the campaign contact by matching the current contact's ID against rawCampaignContacts.
  const effectiveCampaignContactId = useMemo(() => {
    if (currentCampaignContactId) return currentCampaignContactId;
    if (!currentContact?.id || !selectedCampaignId) return null;
    const contactIdStr = String(currentContact.id);
    // Primary lookup based on declared contactType
    let matched = rawCampaignContacts.find((cc: any) => {
      if (currentContactType === "hospital") return String(cc.hospitalId) === contactIdStr;
      if (currentContactType === "clinic") return String(cc.clinicId) === contactIdStr;
      if (currentContactType === "collaborator") return String(cc.collaboratorId) === contactIdStr;
      return String(cc.customerId) === contactIdStr;
    });
    // Fallback: contactType may be wrong (e.g. "customer" set as default for a hospital loaded via
    // inbound lookup or manual search) — try all four fields so outbound calls still resolve.
    if (!matched) {
      matched = rawCampaignContacts.find((cc: any) =>
        String(cc.hospitalId) === contactIdStr ||
        String(cc.clinicId) === contactIdStr ||
        String(cc.collaboratorId) === contactIdStr ||
        String(cc.customerId) === contactIdStr
      );
    }
    return matched?.id || null;
  }, [currentCampaignContactId, currentContact?.id, currentContactType, rawCampaignContacts, selectedCampaignId]);

  const selectedCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  const campaignEmailMode = useMemo<"system" | "user" | "custom">(() => {
    if (!selectedCampaign?.settings) return "user";
    try { return (JSON.parse(selectedCampaign.settings).nexusPulseEmailMode as "system" | "user" | "custom") || "user"; } catch { return "user"; }
  }, [selectedCampaign?.settings]);

  const campaignEmailAddress = useMemo(() => {
    if (!selectedCampaign?.settings) return "";
    try { return JSON.parse(selectedCampaign.settings).nexusPulseEmailAddress || ""; } catch { return ""; }
  }, [selectedCampaign?.settings]);

  // Page-level status list state — hoisted here so MobileAgentWorkspace can access it
  const [mobileDbSlChecked, setMobileDbSlChecked] = useState<Set<string>>(new Set());
  const { data: mobileDbStatusList = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", selectedCampaignId, "status-list"],
    enabled: !!selectedCampaignId && isMobile,
  });
  const { data: mobileDbSlState = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", selectedCampaignId, "contacts", effectiveCampaignContactId, "status-list-state"],
    enabled: !!selectedCampaignId && !!effectiveCampaignContactId && isMobile,
  });
  useEffect(() => {
    if (!isMobile) return;
    const confirmedIds = new Set<string>((mobileDbSlState as any[]).map((s: any) => String(s.statusListItemId)));
    const autoItems = (mobileDbStatusList as any[]).filter((i: any) => i.confirmationType === "auto" && !i.isHidden);
    const autoChecked = autoItems.filter((i: any) => confirmedIds.has(String(i.id)));
    setMobileDbSlChecked(new Set([...Array.from(confirmedIds), ...autoChecked.map((i: any) => String(i.id))]));
  }, [mobileDbSlState, mobileDbStatusList, isMobile]);
  const handleMobileSlToggle = useCallback(async (itemId: string, newChecked: boolean) => {
    if (!selectedCampaignId || !effectiveCampaignContactId) return;
    setMobileDbSlChecked(prev => {
      const next = new Set(prev);
      if (newChecked) next.add(itemId); else next.delete(itemId);
      return next;
    });
    try {
      await apiRequest("POST", `/api/campaigns/${selectedCampaignId}/contacts/${effectiveCampaignContactId}/status-list-state/${itemId}`, {
        confirm: newChecked,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", selectedCampaignId, "contacts", effectiveCampaignContactId, "status-list-state"] });
    } catch {
      setMobileDbSlChecked(prev => {
        const next = new Set(prev);
        if (newChecked) next.delete(itemId); else next.add(itemId);
        return next;
      });
    }
  }, [selectedCampaignId, effectiveCampaignContactId]);

  const isStatusListMode = useMemo(() => {
    try { return selectedCampaign?.settings ? JSON.parse(selectedCampaign.settings).workflowMode === "status_list" : false; }
    catch { return false; }
  }, [selectedCampaign?.settings]);

  const campaignAutoSettings = useMemo(() => {
    if (!selectedCampaign?.settings) return { autoMode: false, autoDelaySeconds: 5, contactSortField: "createdAt", contactSortOrder: "desc", contactSortRules: [] as any[], assignmentMode: "global", agentContactFilters: [] as any[] };
    try {
      const s = JSON.parse(selectedCampaign.settings);
      return {
        autoMode: !!s.autoMode,
        autoDelaySeconds: s.autoDelaySeconds || 5,
        contactSortField: s.contactSortField || "createdAt",
        contactSortOrder: s.contactSortOrder || "desc",
        contactSortRules: Array.isArray(s.contactSortRules) ? s.contactSortRules : [],
        assignmentMode: s.assignmentMode === "per-agent" ? "per-agent" : "global",
        agentContactFilters: Array.isArray(s.agentContactFilters) ? s.agentContactFilters : [],
      };
    } catch { return { autoMode: false, autoDelaySeconds: 5, contactSortField: "createdAt", contactSortOrder: "desc", contactSortRules: [] as any[], assignmentMode: "global", agentContactFilters: [] as any[] }; }
  }, [selectedCampaign]);

  const sortedPendingContacts = useMemo(() => {
    const LEGACY_FIELD_MAP: Record<string, string> = { dateOfBirth: "customer.dateOfBirth", country: "customer.countryCode" };
    const resolveFieldValue = (contact: any, fieldPath: string): any => {
      const resolved = LEGACY_FIELD_MAP[fieldPath] || fieldPath;
      if (resolved.includes(".")) {
        const [entity, field] = resolved.split(".", 2);
        const obj = contact[entity];
        if (!obj) return null;
        return obj[field] ?? null;
      }
      return (contact as any)[resolved] ?? null;
    };
    const evalOp = (val: any, op: string, condVal: string): boolean => {
      const strVal = val == null ? "" : String(val).toLowerCase();
      const cv = condVal.toLowerCase();
      switch (op) {
        case "equals": return strVal === cv;
        case "not_equals": return strVal !== cv;
        case "contains": return strVal.includes(cv);
        case "starts_with": return strVal.startsWith(cv);
        case "ends_with": return strVal.endsWith(cv);
        case "greater_than": { const n=parseFloat(strVal),c=parseFloat(cv); return !isNaN(n)&&!isNaN(c)?n>c:strVal>cv; }
        case "less_than": { const n=parseFloat(strVal),c=parseFloat(cv); return !isNaN(n)&&!isNaN(c)?n<c:strVal<cv; }
        case "greater_or_equal": { const n=parseFloat(strVal),c=parseFloat(cv); return !isNaN(n)&&!isNaN(c)?n>=c:strVal>=cv; }
        case "less_or_equal": { const n=parseFloat(strVal),c=parseFloat(cv); return !isNaN(n)&&!isNaN(c)?n<=c:strVal<=cv; }
        case "is_empty": return val==null||strVal==="";
        case "is_not_empty": return val!=null&&strVal!=="";
        case "is_true": return val===true||strVal==="true"||strVal==="1";
        case "is_false": return val===false||strVal==="false"||strVal==="0"||strVal==="";
        default: return true;
      }
    };
    const toComparable = (val: any): number | string => {
      if (val == null) return "";
      if (typeof val === "boolean") return val ? 1 : 0;
      if (typeof val === "number") return val;
      const str = String(val);
      const d = Date.parse(str);
      if (!isNaN(d)) return d;
      const n = Number(str);
      if (!isNaN(n) && str.trim() !== "") return n;
      return str.toLowerCase();
    };
    const sortByField = (arr: any[], field: string, direction: string) =>
      [...arr].sort((a, b) => {
        const av = toComparable(resolveFieldValue(a, field));
        const bv = toComparable(resolveFieldValue(b, field));
        let cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return direction === "desc" ? -cmp : cmp;
      });

    // ── Per-agent mode: show only contacts assigned to current user by filter ──
    if (campaignAutoSettings.assignmentMode === "per-agent") {
      const filters: any[] = campaignAutoSettings.agentContactFilters;
      const myFilter = filters.find((f: any) => f.agentId === user?.id);
      if (!myFilter) return []; // no filter for this agent → show nothing

      let pool: any[];
      if (myFilter.isRemainder) {
        // remainder: contacts not matched by any explicit filter
        const explicitIds = new Set<string>();
        filters.filter((f: any) => !f.isRemainder).forEach((f: any) => {
          pendingCampaignContacts.forEach(c => {
            const matches = (f.conditions || []).every((cond: any) =>
              !cond.field || !cond.op ? true : evalOp(resolveFieldValue(c, cond.field), cond.op, cond.value || "")
            );
            if (matches) explicitIds.add(c.id);
          });
        });
        pool = pendingCampaignContacts.filter(c => !explicitIds.has(c.id));
      } else {
        pool = pendingCampaignContacts.filter(c =>
          (myFilter.conditions || []).length === 0 ||
          (myFilter.conditions || []).every((cond: any) =>
            !cond.field || !cond.op ? true : evalOp(resolveFieldValue(c, cond.field), cond.op, cond.value || "")
          )
        );
      }
      return sortByField(pool, myFilter.sortField || "createdAt", myFilter.sortDirection || "desc");
    }

    // ── Global sort rules ──
    const rules = campaignAutoSettings.contactSortRules;
    if (rules.length === 0) {
      if (!campaignAutoSettings.autoMode) return pendingCampaignContacts;
      return sortByField(pendingCampaignContacts, campaignAutoSettings.contactSortField, campaignAutoSettings.contactSortOrder);
    }

    const checkCondition = (contact: any, rule: any): boolean => {
      if (!rule.conditionField || !rule.conditionOp) return true;
      return evalOp(resolveFieldValue(contact, rule.conditionField), rule.conditionOp, rule.conditionValue || "");
    };
    const matchesContactType = (contact: any, contactType: string): boolean => !contactType || contact.contactType === contactType;

    return [...pendingCampaignContacts].sort((a, b) => {
      for (const rule of rules) {
        const aMatch = matchesContactType(a, rule.contactType) && checkCondition(a, rule);
        const bMatch = matchesContactType(b, rule.contactType) && checkCondition(b, rule);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        if (aMatch && bMatch) {
          const aVal = toComparable(resolveFieldValue(a, rule.sortField));
          const bVal = toComparable(resolveFieldValue(b, rule.sortField));
          let cmp = typeof aVal === "number" && typeof bVal === "number" ? aVal - bVal : String(aVal).localeCompare(String(bVal));
          if (cmp !== 0) return rule.sortDirection === "desc" ? -cmp : cmp;
        }
      }
      return 0;
    });
  }, [pendingCampaignContacts, campaignAutoSettings, user?.id]);

  const { data: campaignContactCounts = {} } = useQuery<Record<string, { total: number; pending: number }>>({
    queryKey: ["/api/campaigns/contact-counts"],
    enabled: !!hasAccess,
  });

  const sessionCampaignIds = useMemo(() => {
    const fromSession = (agentSession.session as any)?.campaignIds as string[] | null;
    if (fromSession && fromSession.length > 0) return fromSession;
    return selectedLoginCampaignIds;
  }, [(agentSession.session as any)?.campaignIds, selectedLoginCampaignIds]);

  const sessionInboundQueueIds = useMemo(() => {
    const fromSession = (agentSession.session as any)?.inboundQueueIds as string[] | null;
    if (fromSession && fromSession.length > 0) return fromSession;
    return selectedLoginQueueIds;
  }, [(agentSession.session as any)?.inboundQueueIds, selectedLoginQueueIds]);
  sessionQueueIdsRef.current = sessionInboundQueueIds;

  const { data: agentVoicemails = [] } = useQuery<any[]>({
    queryKey: ["/api/voicemail-messages", "agent-unread-all"],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "unread" });
      const res = await fetch(`/api/voicemail-messages?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!hasAccess && agentSession.isSessionActive && sessionInboundQueueIds.length > 0,
    refetchInterval: 15000,
  });

  const activeCampaigns = useMemo(() => {
    if (agentSession.isSessionActive && sessionCampaignIds.length === 0) {
      return [];
    }
    return campaigns
      .filter((c) => c.status === "active" || c.status === "paused")
      .filter((c) => sessionCampaignIds.length === 0 || sessionCampaignIds.includes(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        contactCount: campaignContactCounts[c.id]?.pending ?? 0,
        status: c.status,
        channel: c.channel || "phone",
        callerIdNumber: (c as any).callerIdNumber || null,
        workingHoursStart: shiftData?.campaignData?.[c.id]?.workingHoursStart || null,
        workingHoursEnd: shiftData?.campaignData?.[c.id]?.workingHoursEnd || null,
      }));
  }, [campaigns, campaignContactCounts, sessionCampaignIds, agentSession.isSessionActive, shiftData]);

  useEffect(() => {
    if (agentSession.isSessionActive && !selectedCampaignId && sessionCampaignIds.length > 0) {
      setSelectedCampaignId(sessionCampaignIds[0]);
    }
  }, [agentSession.isSessionActive, sessionCampaignIds, selectedCampaignId]);

  const { data: customerMessages = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", currentContact?.id, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${currentContact!.id}/messages`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!currentContact?.id,
    refetchInterval: 5000,
  });

  const { data: persistentHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/entity-history", currentContact?.id],
    queryFn: async () => {
      const inboundPhone = (currentContact as any)?._inboundPhone as string | undefined;
      if (inboundPhone) {
        const res = await fetch(`/api/agent/inbound-history?phone=${encodeURIComponent(inboundPhone)}`, { credentials: "include" });
        return res.ok ? res.json() : [];
      }
      const pathMap: Record<string, string> = {
        hospital: "hospitals", clinic: "clinics",
        collaborator: "collaborators", person: "collaborators",
      };
      const seg = pathMap[currentContactType || "customer"] || "customers";
      const res = await fetch(`/api/${seg}/${currentContact!.id}/contact-history`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!currentContact?.id || !!(currentContact as any)?._inboundPhone,
    refetchInterval: 15000,
  });

  const contactHistory: ContactHistory[] = useMemo(() => {
    return persistentHistory.map((item: any) => ({
      id: item.id,
      type: item.type as ContactHistory["type"],
      direction: item.direction,
      date: item.timestamp || new Date().toISOString(),
      duration: item.duration,
      status: item.status,
      statusCode: item.statusCode,
      notes: item.notes,
      agentName: item.agentName,
      agentId: item.agentId,
      content: item.content,
      details: item.details,
      campaignName: item.campaignName,
      campaignId: item.campaignId,
      action: item.action,
      previousStatus: item.previousStatus,
      newStatus: item.newStatus,
      sentiment: item.sentiment || null,
      callLogId: item.callLogId || null,
      dispositionCode: item.dispositionCode || null,
      dispositionName: item.dispositionName || null,
      dispositionColor: item.dispositionColor || null,
      dispositionIcon: item.dispositionIcon || null,
      dispositionChecklistNames: item.dispositionChecklistNames || null,
      metadata: item.metadata || null,
    }));
  }, [persistentHistory]);

  useEffect(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (!isAutoMode || currentContact || sortedPendingContacts.length === 0) {
      setAutoCountdown(null);
      return;
    }
    const delay = campaignAutoSettings.autoDelaySeconds;
    setAutoCountdown(delay);
    let remaining = delay;
    autoTimerRef.current = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        if (autoTimerRef.current) clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
        setAutoCountdown(null);
        const next = sortedPendingContacts[0];
        if (next?.customer) {
          pendingCcIdRef.current = next.id ? String(next.id) : null;
          setCurrentCampaignContactId(next.id);
          loadContact(next.customer);
        }
      } else {
        setAutoCountdown(remaining);
      }
    }, 1000);
    return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
  }, [isAutoMode, currentContact, sortedPendingContacts, campaignAutoSettings.autoDelaySeconds]);

  useEffect(() => {
    setIsAutoMode(false);
    setAutoCountdown(null);
  }, [selectedCampaignId]);

  const dispositionMutation = useMutation({
    mutationFn: async (data: { contactId: string; campaignId: string; disposition: string; notes: string; callbackDateTime?: string; parentCode?: string; callbackAssignedTo?: string | null; callbackNote?: string; callMeta?: Record<string, any>; checklistCodes?: string[] }) => {
      // Resolve effective disposition for action: checklist children override parent's action
      const ACTION_PRIORITY = ['dnd', 'complete', 'callback', 'schedule_sms', 'schedule_email', 'convert', 'send_email', 'send_sms', 'none'];
      const parentDisp = campaignDispositions.find(d => d.code === data.disposition)
        || campaignDispositions.find(d => d.code === data.parentCode);
      let disp = parentDisp;
      if (data.checklistCodes?.length) {
        const selectedChildren = (data.checklistCodes
          .map(code => campaignDispositions.find(d => d.code === code))
          .filter(Boolean) as any[]);
        // Only override if at least one child has a meaningful action
        const withAction = selectedChildren.filter(c => c.actionType && c.actionType !== 'none');
        if (withAction.length > 0) {
          const sorted = [...withAction].sort(
            (a, b) => ACTION_PRIORITY.indexOf(a.actionType ?? 'none') - ACTION_PRIORITY.indexOf(b.actionType ?? 'none')
          );
          disp = sorted[0];
        }
      }

      const actionStatusMap: Record<string, string> = {
        callback: "callback_scheduled",
        schedule_email: "callback_scheduled",
        schedule_sms: "callback_scheduled",
        dnd: "not_interested",
        complete: "completed",
        convert: "contacted",
        send_email: "contacted",
        send_sms: "contacted",
        none: "contacted",
      };
      const newStatus = actionStatusMap[disp?.actionType || "none"] || "contacted";
      
      const updateData: Record<string, any> = {
        status: newStatus,
        lastAttemptAt: new Date().toISOString(),
        notes: data.notes || undefined,
        dispositionCode: data.disposition,
        incrementAttempt: true,
        assignedTo: user?.id || null,
        callMeta: data.callMeta || undefined,
      };

      if (data.checklistCodes?.length) {
        updateData.dispositionChecklistCodes = data.checklistCodes;
      }
      
      if (data.callbackDateTime && (disp?.actionType === "callback" || disp?.actionType === "schedule_email" || disp?.actionType === "schedule_sms")) {
        updateData.callbackDate = data.callbackDateTime;
        updateData.status = "callback_scheduled";
        if (data.callbackAssignedTo) {
          updateData.assignedTo = data.callbackAssignedTo;
        }
        if (data.callbackNote) {
          updateData.callbackNote = data.callbackNote;
        }
      }

      if (!data.callbackDateTime && disp?.actionType === "callback" && disp?.callbackOffsetDays) {
        const cbDate = addBusinessDays(new Date(), disp.callbackOffsetDays);
        cbDate.setHours(9, 0, 0, 0);
        updateData.callbackDate = cbDate.toISOString();
        updateData.status = "callback_scheduled";
      }
      
      const res = await apiRequest("PATCH", `/api/campaigns/${data.campaignId}/contacts/${data.contactId}`, updateData);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Chyba pri aktualizácii kontaktu");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", selectedCampaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/contact-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/callbacks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", selectedCampaignId, "assigned-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", selectedCampaignId, "dispositions"] });
      if (currentContact?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/entity-history", currentContact.id] });
      }
      refetchShiftData();
    },
    onError: (error: Error) => {
      toast({ title: t.agentWorkspace.errorLabel, description: error.message, variant: "destructive" });
    },
  });

  const handleDisposition = (value: string, parentCode?: string, callbackDateTime?: string, callbackAssignedTo?: string | null, callbackNote?: string, notesOverride?: string, checklistCodes?: string[]) => {
    const disp = campaignDispositions.find(d => d.code === value)
      || campaignDispositions.find(d => d.code === parentCode);

    const assignLabel = callbackAssignedTo ? "osobný" : "pre všetkých";
    const dispositionElapsed = callEndTimestamp ? Math.round((Date.now() - callEndTimestamp) / 1000) : undefined;
    const dispositionFormDurationSeconds = dispositionOpenedAt ? Math.round((Date.now() - dispositionOpenedAt) / 1000) : null;
    setDispositionOpenedAt(null);
    const timing = callContext.callTiming;
    const callMeta = {
      ringDurationSeconds: timing.ringDurationSeconds,
      talkDurationSeconds: timing.talkDurationSeconds,
      dispositionDurationSeconds: dispositionElapsed || null,
      dispositionFormDurationSeconds: dispositionFormDurationSeconds || null,
      hungUpBy: timing.hungUpBy,
      ringStartTime: timing.ringStartTime ? new Date(timing.ringStartTime).toISOString() : null,
      callStartTime: timing.callStartTime ? new Date(timing.callStartTime).toISOString() : null,
      callEndTime: timing.callEndTime ? new Date(timing.callEndTime).toISOString() : null,
    };

    setTimeline((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        type: "system",
        timestamp: new Date(),
        content: `Výsledok: ${disp?.name || value}`,
        details: `Kontakt ukončený - ${disp?.name || value}${callbackDateTime ? ` (callback ${assignLabel}: ${callbackDateTime})` : ""}${timing.ringDurationSeconds ? ` | Ring: ${timing.ringDurationSeconds}s` : ""}${timing.talkDurationSeconds ? ` | Hovor: ${timing.talkDurationSeconds}s` : ""}${dispositionElapsed !== undefined ? ` | Wrap-up: ${dispositionElapsed}s` : ""}${dispositionFormDurationSeconds ? ` | Formulár: ${dispositionFormDurationSeconds}s` : ""}${timing.hungUpBy ? ` | Ukončil: ${timing.hungUpBy}` : ""}`,
      },
    ]);

    const dCtx = dispositionContextRef.current;
    dispositionContextRef.current = null;

    const effectiveCampaignContactId = dCtx?.campaignContactId ?? currentCampaignContactId;
    const effectiveCampaignId = dCtx?.campaignId ?? selectedCampaignId;
    const effectiveTaskId = dCtx?.taskId ?? activeTaskId;
    const isNewContactActive = !!(dCtx?.contactId && currentContact?.id && dCtx.contactId !== currentContact.id);

    if (effectiveCampaignContactId && effectiveCampaignId) {
      dispositionMutation.mutate({
        contactId: effectiveCampaignContactId,
        campaignId: effectiveCampaignId,
        disposition: value,
        notes: notesOverride !== undefined ? notesOverride : callNotes,
        callbackDateTime,
        parentCode,
        callbackAssignedTo,
        callbackNote: callbackNote || undefined,
        callMeta,
        checklistCodes,
      });
    }

    // Create out-of-mission inbound callback when: no campaign contact, inbound call, and callback was scheduled
    if (!effectiveCampaignContactId && (dCtx?.isInboundCall || wasInboundCallRef.current) && callbackDateTime) {
      const inboundPhone = (callContext.callInfo as any)?.phoneNumber || (currentContact as any)?.phone || "";
      const inboundName = currentContact ? `${(currentContact as any).firstName || ""} ${(currentContact as any).lastName || ""}`.trim() : "";
      apiRequest("POST", "/api/agent/inbound-callbacks", {
        customerId: currentContact?.id ? String(currentContact.id) : undefined,
        phone: inboundPhone || "unknown",
        name: inboundName || undefined,
        campaignId: effectiveCampaignId || undefined,
        callbackDate: callbackDateTime,
        assignedTo: callbackAssignedTo || user?.id || undefined,
        notes: callbackNote || undefined,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/agent/inbound-callbacks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
      }).catch(console.error);
    }

    toast({
      title: t.agentWorkspace.contactFinished,
      description: `${t.agentWorkspace.resultLabel}: ${disp?.name || value}`,
    });

    setDispositionModalOpen(false);
    setModalSelectedParent(null);
    setChecklistParentId(null);
    setChecklistSelectedCodes([]);
    setMandatoryDisposition(false);
    setDispositionChannelFilter(null);
    setCallEndTimestamp(null);
    setRingDuration(0);

    const keepContactOpenAfterDisposition = (() => {
      try { return selectedCampaign?.settings ? JSON.parse(selectedCampaign.settings).keepContactOpenAfterDisposition === true : false; } catch { return false; }
    })();

    if (!isNewContactActive) {
      callContext.resetCallTiming();
      callContext.setCallState("idle");
      callContext.setCallDuration(0);
      agentSession.updateStatus("wrap_up").catch(() => {});
    }

    if (effectiveCampaignContactId) {
      setDisposedContactIds(prev => new Set(prev).add(effectiveCampaignContactId));
    }

    if (keepContactOpenAfterDisposition && !isNewContactActive) {
      setAcwStartedAt(Date.now());
    } else {
      if (effectiveTaskId) {
        setTasks((prev) => prev.filter((t) => t.id !== effectiveTaskId));
        if (activeTaskId === effectiveTaskId) setActiveTaskId(null);
      }
      if (!isNewContactActive) {
        setCurrentContact(null);
        setCurrentPhoneOverride(null);
        setCurrentCampaignContactId(null);
        setCallNotes("");
        setTimeline([]);
        setActiveChannel("phone");
      }
      if (!isNewContactActive) {
        const isAuto = isAutoMode || campaignAutoSettings.autoMode;
        const wrapUpDelay = isAuto ? (campaignAutoSettings.autoDelaySeconds || 5) * 1000 : 2000;
        setTimeout(async () => {
          try {
            await agentSession.updateStatus("available");
            if (isAuto) handleNextContact(true);
          } catch {}
        }, wrapUpDelay);
      }
    }
  };

  const handleCloseCallAfterStatusList = useCallback(async () => {
    // Capture timing BEFORE reset so we can persist call meta
    const timing = callContext.callTiming;
    const dispositionElapsed = callEndTimestamp ? Math.round((Date.now() - callEndTimestamp) / 1000) : null;

    // Prevent the callState→idle useEffect from auto-opening disposition
    callWasActiveRef.current = false;
    prevCallStateRef.current = "idle";

    // Force-reset call context (callState→idle, hungUpBy→null) + clear wrapup state
    setAcwStartedAt(null);
    callContext.forceResetCallFn.current?.();
    callContext.resetCallTiming();
    setCallEndTimestamp(null);
    setMandatoryDisposition(false);
    setRingDuration(0);

    // Persist call meta to campaign contact (non-critical)
    if (currentCampaignContactId && selectedCampaignId) {
      try {
        await apiRequest("PATCH", `/api/campaigns/${selectedCampaignId}/contacts/${currentCampaignContactId}`, {
          callMeta: {
            ringDurationSeconds: timing.ringDurationSeconds,
            talkDurationSeconds: timing.talkDurationSeconds,
            dispositionDurationSeconds: dispositionElapsed,
            hungUpBy: timing.hungUpBy,
            ringStartTime: timing.ringStartTime ? new Date(timing.ringStartTime).toISOString() : null,
            callStartTime: timing.callStartTime ? new Date(timing.callStartTime).toISOString() : null,
            callEndTime: timing.callEndTime ? new Date(timing.callEndTime).toISOString() : null,
          },
        });
      } catch { /* non-critical */ }
    }

    // Clear task / contact state (same as handleCloseAcwTask)
    if (activeTaskId) {
      setTasks((prev) => prev.filter((t) => t.id !== activeTaskId));
      setActiveTaskId(null);
    }
    setCurrentContact(null);
    setCurrentPhoneOverride(null);
    setCurrentCampaignContactId(null);
    setCallNotes("");
    setTimeline([]);
    setActiveChannel("phone");

    const isAuto = isAutoMode || campaignAutoSettings.autoMode;
    const wrapUpDelay = isAuto ? (campaignAutoSettings.autoDelaySeconds || 5) * 1000 : 2000;
    setTimeout(async () => {
      try {
        await agentSession.updateStatus("available");
        if (isAuto) handleNextContact(true);
      } catch {}
    }, wrapUpDelay);
  }, [callContext, callEndTimestamp, currentCampaignContactId, selectedCampaignId, activeTaskId, isAutoMode, campaignAutoSettings, agentSession]);

  const handleCloseAcwTask = useCallback(async () => {
    // If the call is still in a non-idle state (preventAutoReset=true blocked the idle timer),
    // reset the SIP context directly — calling forceResetCallFn on an already-terminated
    // session triggers a second SessionState.Terminated event which briefly shows "Ukončiť hovor".
    if (["ended", "ringing", "connecting"].includes(callContext.callState)) {
      callContext.setCallState("idle");
      callContext.setCallInfo(null);
      callContext.resetCallTiming();
    }
    const acwSeconds = acwStartedAt ? Math.round((Date.now() - acwStartedAt) / 1000) : null;
    setAcwStartedAt(null);
    if (currentCampaignContactId && selectedCampaignId && acwSeconds !== null) {
      try {
        await apiRequest("PATCH", `/api/campaigns/${selectedCampaignId}/contacts/${currentCampaignContactId}`, {
          callMeta: { acwDurationSeconds: acwSeconds },
        });
      } catch { /* ignore — non-critical */ }
    }
    if (activeTaskId) {
      setTasks((prev) => prev.filter((t) => t.id !== activeTaskId));
      setActiveTaskId(null);
    }
    setCurrentContact(null);
    setCurrentPhoneOverride(null);
    setCurrentCampaignContactId(null);
    setCallNotes("");
    setTimeline([]);
    setActiveChannel("phone");
    const isAuto = isAutoMode || campaignAutoSettings.autoMode;
    const wrapUpDelay = isAuto ? (campaignAutoSettings.autoDelaySeconds || 5) * 1000 : 2000;
    setTimeout(async () => {
      try {
        await agentSession.updateStatus("available");
        if (isAuto) handleNextContact(true);
      } catch {}
    }, wrapUpDelay);
  }, [callContext, acwStartedAt, currentCampaignContactId, selectedCampaignId, activeTaskId, isAutoMode, campaignAutoSettings, agentSession]);

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string[]; subject: string; body: string; mailboxId?: string | null; cc?: string; documentIds?: string[]; attachments?: { name: string; contentBase64: string; contentType: string }[]; customerId?: string; contactType?: string; compositionDurationSeconds?: number | null; useSystemMailbox?: boolean; campaignCountryCode?: string }) => {
      const res = await apiRequest("POST", "/api/ms365/send-email-from-mailbox", {
        to: data.to,
        subject: data.subject,
        body: data.body,
        isHtml: true,
        mailboxId: data.mailboxId,
        cc: data.cc,
        documentIds: data.documentIds,
        attachments: data.attachments,
        customerId: data.customerId,
        contactType: data.contactType,
        compositionDurationSeconds: data.compositionDurationSeconds,
        useSystemMailbox: data.useSystemMailbox,
        campaignCountryCode: data.campaignCountryCode,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.agentWorkspace.emailSendError);
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({
        title: t.agentWorkspace.emailSent,
        description: `${t.agentWorkspace.emailSentDesc} ${variables.to.join(", ")}`,
      });
      setStats((prev) => ({ ...prev, emails: prev.emails + 1 }));
      setTimeline((prev) => [
        ...prev,
        {
          id: `email-${Date.now()}`,
          type: "email",
          direction: "outbound",
          timestamp: new Date(),
          content: variables.subject,
          details: variables.body.substring(0, 100),
        },
      ]);
      if (variables.customerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "activity-logs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/entity-history", variables.customerId] });
      }
      if (currentCampaignContactId && selectedCampaignId) {
        const campaignSettings = selectedCampaign?.settings ? JSON.parse(selectedCampaign.settings) : {};
        if (campaignSettings.dispositionMode === "script") {
          // disposition is controlled by call script - do nothing here
        } else {
          setDispositionChannelFilter("email");
          setDispositionModalOpen(true);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: t.agentWorkspace.errorLabel,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async (data: { to: string[]; message: string; customerId?: string; compositionDurationSeconds?: number | null }) => {
      const res = await apiRequest("POST", "/api/send-sms", {
        to: data.to,
        message: data.message,
        customerId: data.customerId,
        compositionDurationSeconds: data.compositionDurationSeconds,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.agentWorkspace.smsSendError);
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({
        title: t.agentWorkspace.smsSent,
        description: `${t.agentWorkspace.smsSentDesc} ${variables.to.join(", ")}`,
      });
      setStats((prev) => ({ ...prev, sms: prev.sms + 1 }));
      setTimeline((prev) => [
        ...prev,
        {
          id: `sms-${Date.now()}`,
          type: "sms",
          direction: "outbound",
          timestamp: new Date(),
          content: variables.message,
        },
      ]);
      if (variables.customerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "activity-logs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/entity-history", variables.customerId] });
      }
      if (currentCampaignContactId) {
        setDispositionChannelFilter("sms");
        setDispositionModalOpen(true);
      }
    },
    onError: (error: Error) => {
      toast({
        title: t.agentWorkspace.errorLabel,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!currentContact) throw new Error("No contact");
      const serializedData = {
        ...data,
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toISOString() : null,
      };
      return apiRequest("PATCH", `/api/customers/${currentContact.id}`, serializedData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      if (currentContact?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", currentContact.id] });
      }
      if (variables.phone !== undefined) {
        setCurrentContact(prev => prev ? { ...prev, phone: variables.phone || null } : prev);
      }
      toast({ title: t.agentWorkspace.customerUpdated });
    },
    onError: () => {
      toast({ title: t.agentWorkspace.customerUpdateError, variant: "destructive" });
    },
  });

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-lg font-semibold mb-2">Prístup zamietnutý</h2>
          <p className="text-muted-foreground">
            Nemáte oprávnenie na prístup do NEXUS Pulse. Kontaktujte administrátora.
          </p>
        </Card>
      </div>
    );
  }

  const handleToggleAutoMode = () => {
    if (!campaignAutoSettings.autoMode) {
      toast({ title: t.agentWorkspace.autoModeNotAllowed, description: t.agentWorkspace.autoModeNotAllowedDesc, variant: "destructive" });
      return;
    }
    setIsAutoMode(prev => !prev);
  };

  const handleStatusChange = async (newStatus: AgentStatus) => {
    try {
      if (agentSession.activeBreak) {
        await agentSession.endBreak();
        refetchShiftData();
      }
      await agentSession.updateStatus(newStatus);
      const STATUS_CONFIG = getStatusConfig(t);
      toast({
        title: STATUS_CONFIG[newStatus].label,
        description: `${STATUS_CONFIG[newStatus].label}`,
      });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.shiftStartError, variant: "destructive" });
    }
  };

  const handleToggleAllowInboundInBO = async () => {
    const next = !allowInboundInBO;
    setAllowInboundInBO(next);
    if (mainWorkspaceTab === "back_office" && agentSession.isSessionActive) {
      if (next) {
        if (agentSession.activeBreak) await agentSession.endBreak().catch(() => {});
        await agentSession.updateStatus("available").catch(() => {});
      } else {
        await agentSession.startSystemBreak("Back Office agenda").catch(() => {});
      }
    }
  };

  const handleSwitchToBackOffice = async () => {
    if (!canBackOfficeAgenda) return;
    if (mainWorkspaceTab === "back_office") return;
    setMainWorkspaceTab("back_office");
    if (agentSession.isSessionActive && !allowInboundInBO) {
      prevStatusBeforeBackOffice.current = agentSession.status as AgentStatus;
      await agentSession.startSystemBreak("Back Office agenda").catch(() => {});
    }
  };

  // Open the Back Office panel when the new-task toast is clicked. The toast may be
  // triggered from another page, so a sessionStorage flag survives the navigation and
  // is consumed on mount; a custom event handles the already-mounted case.
  const switchToBoRef = useRef(handleSwitchToBackOffice);
  switchToBoRef.current = handleSwitchToBackOffice;
  const canBackOfficeAgendaRef = useRef(canBackOfficeAgenda);
  canBackOfficeAgendaRef.current = canBackOfficeAgenda;
  useEffect(() => {
    const openBo = () => {
      // Len pre role s povoleným modulom Back Office Agenda.
      if (!canBackOfficeAgendaRef.current) return;
      // Clear the navigation flag on every open path so a same-page toast click does not
      // leave a stale flag that re-opens BO on a later remount.
      try { sessionStorage.removeItem("indexus:pendingOpenBackOffice"); } catch { /* ignore */ }
      if (agentSession.isSessionActive) setBackOfficeModeActive(true);
      void switchToBoRef.current();
    };
    try {
      if (sessionStorage.getItem("indexus:pendingOpenBackOffice") === "1") {
        openBo();
      }
    } catch { /* sessionStorage may be unavailable */ }
    window.addEventListener("indexus:open-back-office", openBo);
    return () => window.removeEventListener("indexus:open-back-office", openBo);
  }, [agentSession.isSessionActive]);

  const handleSwitchToPulse = async () => {
    if (mainWorkspaceTab === "pulse") return;
    setMainWorkspaceTab("pulse");
    if (agentSession.isSessionActive) {
      if (agentSession.activeBreak) await agentSession.endBreak().catch(() => {});
      await agentSession.updateStatus("available").catch(() => {});
      prevStatusBeforeBackOffice.current = null;
    }
  };

  const handleStartBreak = async (breakTypeId: string) => {
    try {
      await agentSession.startBreak(breakTypeId);
      toast({ title: t.agentSession.statusBreak, description: t.agentSession.statusBreak });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.breakError, variant: "destructive" });
    }
  };

  const handleEndBreak = async () => {
    try {
      await agentSession.endBreak();
      refetchShiftData();
      toast({ title: t.agentSession.continueWork, description: t.agentSession.continueWork });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.breakEndError, variant: "destructive" });
    }
  };

  const handleStartSession = async () => {
    try {
      if (callContext.callState !== "idle") {
        callContext.forceResetCallFn.current?.();
      } else {
        callContext.resetCallTiming();
        callContext.setCallInfo(null);
      }
      callWasActiveRef.current = false;
      prevCallStateRef.current = "idle";
      setDispositionModalOpen(false);
      setMandatoryDisposition(false);
      setCallEndTimestamp(null);
      setRingDuration(0);
      setCallNotes("");

      const loginIds = selectedLoginCampaignIds.length > 0 ? selectedLoginCampaignIds : (selectedCampaignId ? [selectedCampaignId] : []);
      await agentSession.startSession(loginIds.length > 0 ? loginIds[0] : null, loginIds, selectedLoginQueueIds);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/assigned-campaigns"] });
      if (loginIds.length > 0) {
        setSelectedCampaignId(loginIds[0]);
        fetchQuotaCheck(loginIds[0]);
      }
      // Auto-set "Only Assigned" filter based on campaign settings
      const shouldDefaultOnlyAssigned = loginCampaigns
        .filter(c => loginIds.includes(c.id))
        .some(c => {
          try { return !!(c.settings && JSON.parse(c.settings).defaultOnlyAssigned); } catch { return false; }
        });
      if (shouldDefaultOnlyAssigned) setShowOnlyAssigned(true);
      setSessionLoginOpen(false);
      if (loginBackOffice && canBackOfficeAgenda) {
        setBackOfficeModeActive(true);
        setMainWorkspaceTab("back_office");
        prevStatusBeforeBackOffice.current = "available";
        agentSession.startSystemBreak("Back Office agenda").catch(() => {});
      }
      toast({ title: t.agentSession.shiftStarted, description: t.agentSession.shiftStartedDesc });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.shiftStartError, variant: "destructive" });
    }
  };

  const handleEndSession = async () => {
    try {
      callContext.forceResetCallFn.current?.();

      setDispositionModalOpen(false);
      setMandatoryDisposition(false);
      setCallEndTimestamp(null);
      setRingDuration(0);
      setCallNotes("");
      callWasActiveRef.current = false;
      prevCallStateRef.current = "idle";
      if (ringTimerRef.current) {
        clearInterval(ringTimerRef.current);
        ringTimerRef.current = null;
      }

      await agentSession.endSession();
      setSidebarOpen(prevSidebarOpenRef.current);
      setSessionLoginOpen(true);
      setCurrentContact(null);
      setCurrentPhoneOverride(null);
      setCurrentCampaignContactId(null);
      setTasks([]);
      setActiveTaskId(null);
      setTimeline([]);
      setStats({ calls: 0, emails: 0, sms: 0 });
      setQuotas(null);
      setIsAutoMode(false);
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      setAutoCountdown(null);
      setBackOfficeModeActive(false);
      setLoginBackOffice(false);
      setMainWorkspaceTab("pulse");
      setAllowInboundInBO(false);
      prevStatusBeforeBackOffice.current = null;
      toast({ title: t.agentSession.shiftEnded, description: t.agentSession.shiftEndedDesc });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.shiftEndError, variant: "destructive" });
    }
  };

  const handleSendEmail = async (data: { to: string[]; subject: string; body: string; mailboxId?: string | null; cc?: string; documentIds?: string[]; attachments?: { name: string; contentBase64: string; contentType: string }[]; compositionDurationSeconds?: number | null }) => {
    if (!currentContact) {
      toast({ title: t.agentWorkspace.errorLabel, description: t.agentWorkspace.noContactSelected, variant: "destructive" });
      return;
    }
    if (selectedCampaignId) {
      try {
        const qRes = await fetch(`/api/campaigns/${selectedCampaignId}/quota-check`, { credentials: "include" });
        if (qRes.ok) {
          const qData = await qRes.json();
          const hasAnyQuota = qData.quotas && (qData.quotas.calls !== null || qData.quotas.emails !== null || qData.quotas.sms !== null);
          if (hasAnyQuota) {
            setQuotas(qData.quotas);
            if (qData.usage) {
              quotaDataRef.current = { usage: qData.usage };
              setStats({ calls: qData.usage.calls || 0, emails: qData.usage.emails || 0, sms: qData.usage.sms || 0 });
            }
          }
          if (qData.blocked?.emails) {
            toast({
              title: t.agentWorkspace?.quotaReached || "Daily quota reached",
              description: t.agentWorkspace?.emailQuotaReached || "You have reached your daily email limit for this campaign.",
              variant: "destructive",
            });
            return;
          }
        }
      } catch {}
    }
    if (isQuotaBlocked("emails")) {
      toast({
        title: t.agentWorkspace?.quotaReached || "Daily quota reached",
        description: t.agentWorkspace?.emailQuotaReached || "You have reached your daily email limit for this campaign.",
        variant: "destructive",
      });
      return;
    }
    const effectiveMailboxId = campaignEmailMode === "system" ? undefined : data.mailboxId;
    sendEmailMutation.mutate({
      to: data.to,
      subject: data.subject,
      body: data.body,
      mailboxId: effectiveMailboxId,
      useSystemMailbox: campaignEmailMode === "system" ? true : undefined,
      campaignCountryCode: campaignEmailMode === "system" ? (selectedCampaign?.countryCodes?.[0] || "SK") : undefined,
      cc: data.cc,
      documentIds: data.documentIds,
      attachments: data.attachments,
      customerId: currentContact.id,
      contactType: currentContactType || "customer",
      compositionDurationSeconds: data.compositionDurationSeconds,
    });
  };

  const handleSendSms = async (data: { to: string[]; message: string; compositionDurationSeconds?: number | null }) => {
    if (!currentContact) {
      toast({ title: t.agentWorkspace.errorLabel, description: t.agentWorkspace.noContactSelected, variant: "destructive" });
      return;
    }
    if (selectedCampaignId) {
      try {
        const qRes = await fetch(`/api/campaigns/${selectedCampaignId}/quota-check`, { credentials: "include" });
        if (qRes.ok) {
          const qData = await qRes.json();
          const hasAnyQuota = qData.quotas && (qData.quotas.calls !== null || qData.quotas.emails !== null || qData.quotas.sms !== null);
          if (hasAnyQuota) {
            setQuotas(qData.quotas);
            if (qData.usage) {
              quotaDataRef.current = { usage: qData.usage };
              setStats({ calls: qData.usage.calls || 0, emails: qData.usage.emails || 0, sms: qData.usage.sms || 0 });
            }
          }
          if (qData.blocked?.sms) {
            toast({
              title: t.agentWorkspace?.quotaReached || "Daily quota reached",
              description: t.agentWorkspace?.smsQuotaReached || "You have reached your daily SMS limit for this campaign.",
              variant: "destructive",
            });
            return;
          }
        }
      } catch {}
    }
    if (isQuotaBlocked("sms")) {
      toast({
        title: t.agentWorkspace?.quotaReached || "Daily quota reached",
        description: t.agentWorkspace?.smsQuotaReached || "You have reached your daily SMS limit for this campaign.",
        variant: "destructive",
      });
      return;
    }
    sendSmsMutation.mutate({
      to: data.to,
      message: data.message,
      customerId: currentContact.id,
      compositionDurationSeconds: data.compositionDurationSeconds,
    });
  };

  const handleAddNote = async (note: string) => {
    if (!currentContact) return;
    setCallNotes((prev) => prev + (prev ? "\n" : "") + note);
    setTimeline((prev) => [
      ...prev,
      {
        id: `note-${Date.now()}`,
        type: "note",
        timestamp: new Date(),
        content: note,
      },
    ]);
    // Customers persist to the legacy customer-notes table; clinic/hospital/collaborator
    // contacts persist to the generic entity-notes endpoint. The query key must match the
    // one CustomerInfoPanel uses so the optimistic update lands in the right cache.
    const noteType = currentContactType || "customer";
    const notesUrl = noteType !== "customer"
      ? `/api/entity-notes/${noteType}/${currentContact.id}`
      : `/api/customers/${currentContact.id}/notes`;
    const tempNote = {
      id: `temp-${Date.now()}`,
      content: note,
      userId: user?.id || "",
      userName: user?.name || user?.username || "Ja",
      createdAt: new Date().toISOString(),
    };
    const notesKey = [notesUrl];
    queryClient.setQueryData(notesKey, (old: any) => [tempNote, ...(old || [])]);
    try {
      await apiRequest("POST", notesUrl, { content: note });
      queryClient.refetchQueries({ queryKey: notesKey });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", currentContact.id, "activity-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entity-history", currentContact.id] });
    } catch (err) {
      console.error("Failed to save note:", err);
      queryClient.setQueryData(notesKey, (old: any) => (old || []).filter((n: any) => n.id !== tempNote.id));
      toast({ title: t.agentWorkspace.errorLabel, description: t.agentWorkspace.noteSaveError, variant: "destructive" });
    }
  };

  const loadContact = (
    customer: Customer,
    overrideContactType?: string,
    overrideClinicData?: Clinic | null,
    overrideHospitalData?: Hospital | null,
    overrideCollaboratorData?: Collaborator | null,
  ) => {
    const lcLockKey = `lc-${customer.id}`;
    if (openingContactsRef.current.has(lcLockKey)) return;
    openingContactsRef.current.add(lcLockKey);
    setTimeout(() => openingContactsRef.current.delete(lcLockKey), 1000);

    setCurrentContact(customer);
    agentSession.updateStatus("busy").catch(() => {});
    setCallNotes("");
    const defaultTab = selectedCampaign?.defaultActiveTab || "phone";
    setActiveChannel(defaultTab);
    setRightTab("actions");

    const resolvedContactType = overrideContactType ?? currentContactType ?? "customer";
    const resolvedClinicData = overrideClinicData !== undefined ? overrideClinicData : currentClinicData;
    const resolvedHospitalData = overrideHospitalData !== undefined ? overrideHospitalData : currentHospitalData;
    const resolvedCollaboratorData = overrideCollaboratorData !== undefined ? overrideCollaboratorData : currentCollaboratorData;

    const effectiveCcId = pendingCcIdRef.current ?? currentCampaignContactId;
    const campaignChannel = (selectedCampaign?.channel || "phone") as ChannelType;
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      contact: customer,
      campaignId: selectedCampaignId!,
      campaignName: selectedCampaign?.name || "",
      campaignContactId: effectiveCcId,
      channel: campaignChannel,
      startedAt: new Date(),
      status: "active",
      contactType: resolvedContactType,
      clinicData: resolvedClinicData,
      hospitalData: resolvedHospitalData,
      collaboratorData: resolvedCollaboratorData,
    };
    const dupTask2 = tasksRef.current.find(t =>
      effectiveCcId
        ? t.campaignContactId === effectiveCcId
        : !t.campaignContactId && t.contact?.id === customer.id
    );
    if (dupTask2) {
      setActiveTaskId(dupTask2.id);
    } else {
      setTasks((prev) => [...prev, newTask]);
      setActiveTaskId(newTask.id);
      setTimeline([
        {
          id: `sys-start-${Date.now()}`,
          type: "system",
          timestamp: new Date(),
          content: `Konverzácia začatá s ${customer.firstName} ${customer.lastName}`,
          details: `Kampaň: ${selectedCampaign?.name || ""}`,
        },
      ]);
    }
  };

  const handleNextContact = (skipStatusCheck = false) => {
    if (!skipStatusCheck) {
      const currentStatus = agentSession.status;
      if (currentStatus === "wrap_up" || currentStatus === "break") return;
    }
    if (sortedPendingContacts.length > 0) {
      const nextEnriched = sortedPendingContacts[0];
      handleSelectCampaignContact(nextEnriched);
    }
  };

  const handleSelectCampaignContact = (enrichedContact: EnrichedCampaignContact) => {
    const currentStatus = agentSession.status;
    if (currentStatus === "wrap_up" || currentStatus === "break") return;
    if (callContext.callState === "ended") {
      callContext.resetCallTiming();
      callContext.setCallState("idle");
    }
    pendingCcIdRef.current = enrichedContact.id ? String(enrichedContact.id) : null;
    setCurrentCampaignContactId(enrichedContact.id);
    setCurrentHospitalData(null);
    setCurrentClinicData(null);
    setCurrentCollaboratorData(null);

    if (enrichedContact.contactType === "hospital" && enrichedContact.hospital) {
      setCurrentContactType("hospital");
      setCurrentHospitalData(enrichedContact.hospital as Hospital);
      const h = enrichedContact.hospital as any;
      const virtualCustomer: Customer = {
        id: h.id,
        firstName: h.name || "",
        lastName: "",
        email: h.email || null,
        phone: h.phone || null,
        countryCode: h.countryCode || null,
      } as Customer;
      loadContact(virtualCustomer, "hospital", null, enrichedContact.hospital as Hospital, null);
    } else if (enrichedContact.contactType === "clinic" && enrichedContact.clinic) {
      setCurrentContactType("clinic");
      setCurrentClinicData(enrichedContact.clinic as Clinic);
      const c = enrichedContact.clinic as any;
      const virtualCustomer: Customer = {
        id: c.id,
        firstName: c.clinicName || c.name || "",
        lastName: c.doctorName || "",
        email: c.email || null,
        phone: c.phone || null,
        countryCode: c.countryCode || null,
      } as Customer;
      loadContact(virtualCustomer, "clinic", enrichedContact.clinic as Clinic, null, null);
    } else if (enrichedContact.contactType === "collaborator" && enrichedContact.collaborator) {
      setCurrentContactType("collaborator");
      setCurrentCollaboratorData(enrichedContact.collaborator as Collaborator);
      const col = enrichedContact.collaborator as any;
      const virtualCustomer: Customer = {
        id: col.id,
        firstName: col.firstName || col.name || "",
        lastName: col.lastName || "",
        email: col.email || null,
        phone: col.phone || null,
        countryCode: col.countryCode || null,
      } as Customer;
      loadContact(virtualCustomer, "collaborator", null, null, enrichedContact.collaborator as Collaborator);
    } else if (enrichedContact.customer) {
      setCurrentContactType("customer");
      loadContact(enrichedContact.customer, "customer", null, null, null);
    }
    // Pre-fill call notes with callback note if present (overrides the "" set by loadContact)
    if ((enrichedContact as any).callbackNote) {
      setCallNotes((enrichedContact as any).callbackNote);
    }
  };

  const handleSelectTask = (task: TaskItem) => {
    setActiveTaskId(task.id);
    setCurrentContact(task.contact);
    setCurrentPhoneOverride(null);
    setCurrentContactType((task.contactType || "customer") as any);
    setCurrentHospitalData(task.hospitalData || null);
    setCurrentClinicData(task.clinicData || null);
    setCurrentCollaboratorData(task.collaboratorData || null);
    setSelectedCampaignId(task.campaignId);
    setCurrentCampaignContactId(task.campaignContactId);
  };

  const handleCancelTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (activeTaskId === taskId) {
      setActiveTaskId(null);
      setCurrentContact(null);
      setCurrentPhoneOverride(null);
      setCurrentCampaignContactId(null);
      setCallNotes("");
      setTimeline([]);
      agentSession.updateStatus("available").catch(() => {});
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    toast({
      title: t.agentWorkspace.taskCancelled,
      description: task ? `${task.contact.firstName || ""} ${task.contact.lastName || ""}`.trim() : "",
    });
  };

  const handleMakeCall = async (phoneNumber: string) => {
    if (selectedCampaignId) {
      try {
        const qRes = await fetch(`/api/campaigns/${selectedCampaignId}/quota-check`, { credentials: "include" });
        if (qRes.ok) {
          const qData = await qRes.json();
          const hasAnyQuota = qData.quotas && (qData.quotas.calls !== null || qData.quotas.emails !== null || qData.quotas.sms !== null);
          if (hasAnyQuota) {
            setQuotas(qData.quotas);
            if (qData.usage) {
              quotaDataRef.current = { usage: qData.usage };
              setStats({ calls: qData.usage.calls || 0, emails: qData.usage.emails || 0, sms: qData.usage.sms || 0 });
            }
          }
          if (qData.blocked?.calls) {
            toast({
              title: t.agentWorkspace?.quotaReached || "Daily quota reached",
              description: t.agentWorkspace?.callQuotaReached || "You have reached your daily call limit for this campaign.",
              variant: "destructive",
            });
            return;
          }
        }
      } catch {}
    }
    if (isQuotaBlocked("calls")) {
      toast({
        title: t.agentWorkspace?.quotaReached || "Daily quota reached",
        description: t.agentWorkspace?.callQuotaReached || "You have reached your daily call limit for this campaign.",
        variant: "destructive",
      });
      return;
    }
    if (makeCall && currentContact) {
      const customerName = `${currentContact.firstName || ""} ${currentContact.lastName || ""}`.trim();
      makeCall({
        phoneNumber,
        customerId: currentContact.id,
        customerName: customerName || undefined,
        campaignId: selectedCampaignId || undefined,
        campaignName: selectedCampaign?.name || undefined,
        callerIdNumber: (selectedCampaign as any)?.callerIdNumber || undefined,
      });
      setStats((prev) => ({ ...prev, calls: prev.calls + 1 }));
      setTimeline((prev) => [
        ...prev,
        {
          id: `call-${Date.now()}`,
          type: "call",
          direction: "outbound",
          timestamp: new Date(),
          content: `Hovor na ${phoneNumber}`,
        },
      ]);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "call": {
        setActiveChannel("phone");
        const phoneToCall = currentPhoneOverride || currentClinicData?.phone || currentCollaboratorData?.phone || currentContact?.phone;
        if (phoneToCall && isSipRegistered) {
          handleMakeCall(phoneToCall);
        }
        break;
      }
      case "email":
        setActiveChannel("email");
        break;
      case "sms":
        setActiveChannel("sms");
        break;
      case "task":
        {
          const contactName = currentContact
            ? `${currentContact.firstName || ""} ${currentContact.lastName || ""}`.trim()
            : "";
          setCreateTaskForm({
            title: contactName ? `${contactName} — ` : "",
            description: "",
            priority: "medium",
            assignedUserId: user?.id || "",
            dueDate: "",
            groupId: "",
          });
          setCreateTaskDialogOpen(true);
        }
        break;
    }
  };

  const handleOpenScheduledContact = async (contactId: string, campaignId: string, campaignContactId: string, channel: "phone" | "email" | "sms", contactType?: string, contactPhone?: string) => {
    const lockKey = campaignContactId || contactId;
    if (openingContactsRef.current.has(lockKey)) return;
    openingContactsRef.current.add(lockKey);
    try {
    const existingTask = tasksRef.current.find(t =>
      campaignContactId
        ? t.campaignContactId === campaignContactId
        : t.contact?.id === contactId
    );
    if (existingTask) {
      setActiveTaskId(existingTask.id);
      return;
    }
    try {
      const quotaType = channel === "phone" ? "calls" : channel === "email" ? "emails" : "sms";
      let blocked = false;
      try {
        const qRes = await fetch(`/api/campaigns/${campaignId}/quota-check`, { credentials: "include" });
        if (qRes.ok) {
          const qData = await qRes.json();
          if (qData.blocked && qData.blocked[quotaType]) blocked = true;
          const hasAnyQuota = qData.quotas && (qData.quotas.calls !== null || qData.quotas.emails !== null || qData.quotas.sms !== null);
          if (hasAnyQuota && campaignId === selectedCampaignId) {
            setQuotas(qData.quotas);
            if (qData.usage) {
              quotaDataRef.current = { usage: qData.usage };
              setStats({
                calls: qData.usage.calls || 0,
                emails: qData.usage.emails || 0,
                sms: qData.usage.sms || 0,
              });
            }
          }
        }
      } catch {}
      if (blocked) {
        const quotaMsg = quotaType === "calls"
          ? (t.agentWorkspace?.callQuotaReached || "Daily call quota reached")
          : quotaType === "emails"
          ? (t.agentWorkspace?.emailQuotaReached || "Daily email quota reached")
          : (t.agentWorkspace?.smsQuotaReached || "Daily SMS quota reached");
        toast({ title: t.agentWorkspace?.quotaReached || "Quota reached", description: quotaMsg, variant: "destructive" });
        return;
      }
      let customer: any;
      let _clinicEntity: any = null;
      let _hospitalEntity: any = null;
      let _collaboratorEntity: any = null;
      const cType = contactType || "customer";
      if (cType === "clinic") {
        const res = await fetch(`/api/clinics/${contactId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Clinic not found");
        const clinic = await res.json();
        _clinicEntity = clinic;
        customer = {
          id: clinic.id,
          firstName: clinic.doctorFirstName || "",
          lastName: clinic.doctorLastName || clinic.name || "",
          phone: clinic.phone || "",
          email: clinic.email || "",
          displayName: clinic.doctorLastName
            ? `${clinic.doctorFirstName || ""} ${clinic.doctorLastName}`.trim() + (clinic.name ? ` (${clinic.name})` : "")
            : clinic.name || "",
          _contactType: "clinic",
          _clinicId: clinic.id,
        };
      } else if (cType === "hospital") {
        const res = await fetch(`/api/hospitals/${contactId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Hospital not found");
        const hospital = await res.json();
        _hospitalEntity = hospital;
        customer = {
          id: hospital.id,
          firstName: "",
          lastName: hospital.name || "",
          phone: hospital.phone || "",
          email: hospital.email || "",
          displayName: hospital.name || "",
          _contactType: "hospital",
          _hospitalId: hospital.id,
        };
      } else if (cType === "collaborator") {
        const res = await fetch(`/api/collaborators/${contactId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Collaborator not found");
        const collab = await res.json();
        _collaboratorEntity = collab;
        customer = {
          id: collab.id,
          firstName: collab.firstName || "",
          lastName: collab.lastName || "",
          phone: collab.phone || "",
          email: collab.email || "",
          displayName: `${collab.firstName || ""} ${collab.lastName || ""}`.trim(),
          _contactType: "collaborator",
          _collaboratorId: collab.id,
        };
      } else if (!contactId && contactPhone) {
        // Virtual contact: inbound caller with no customer record
        customer = {
          id: "",
          firstName: contactPhone,
          lastName: "",
          phone: contactPhone,
          email: "",
          displayName: contactPhone,
          _contactType: "customer",
          _isVirtual: true,
          _inboundPhone: contactPhone,
        };
      } else {
        const res = await fetch(`/api/customers/${contactId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Customer not found");
        customer = await res.json();
      }

      if (selectedCampaignId !== campaignId) {
        setSelectedCampaignId(campaignId);
      }
      setCurrentCampaignContactId(campaignContactId);
      setCurrentContact(customer);
      setCurrentContactType(cType as any);
      setCurrentClinicData(_clinicEntity);
      setCurrentHospitalData(_hospitalEntity);
      setCurrentCollaboratorData(_collaboratorEntity);
      agentSession.updateStatus("busy").catch(() => {});
      setCallNotes("");
      setActiveChannel(channel);
      setRightTab("actions");

      const campaign = campaigns?.find((c: any) => c.id === campaignId);
      const campaignChannel = (campaign?.channel || "phone") as ChannelType;
      const newTask: TaskItem = {
        id: `task-${Date.now()}`,
        contact: customer,
        campaignId,
        campaignName: campaign?.name || "",
        campaignContactId,
        channel: campaignChannel,
        startedAt: new Date(),
        status: "active",
        contactType: cType,
        clinicData: _clinicEntity,
        hospitalData: _hospitalEntity,
        collaboratorData: _collaboratorEntity,
      };
      const dupTask3 = tasksRef.current.find(t =>
        newTask.campaignContactId
          ? t.campaignContactId === newTask.campaignContactId
          : !t.campaignContactId && t.contact?.id === customer.id
      );
      if (dupTask3) {
        setActiveTaskId(dupTask3.id);
      } else {
        setTasks((prev) => [...prev, newTask]);
        setActiveTaskId(newTask.id);
        setTimeline([
          {
            id: `start-${Date.now()}`,
            type: "note",
            timestamp: new Date(),
            content: `Kontakt otvorený z naplánovanej fronty (${channel === "phone" ? "spätné volanie" : channel})`,
          },
        ]);
      }
    } catch (err) {
      toast({ title: t.agentWorkspace.errorLabel, description: t.agentWorkspace.contactLoadError, variant: "destructive" });
    }
    } finally {
      openingContactsRef.current.delete(lockKey);
    }
  };

  useEffect(() => {
    if (!user?.id || !agentSession.isSessionActive) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/inbound-calls?userId=${user.id}`;
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = () => {
      console.log(`[AgentWS] Connecting to ${wsUrl}`);
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        console.log(`[AgentWS] Connected to inbound-calls WebSocket`);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`[AgentWS] Received message:`, data.type, data);
          if (data.type === "inbound-call") {
            const allowedQueues = sessionQueueIdsRef.current;
            if (allowedQueues.length === 0) {
              console.log(`[AgentWS] Ignoring inbound call ${data.callId} - no inbound queues selected in session`);
              const num = data.callerNumber?.replace(/[\s\-\(\)]/g, "");
              if (num) filteredCallerNumbersRef.current.set(num, Date.now());
              return;
            }
            if (!allowedQueues.includes(data.queueId)) {
              console.log(`[AgentWS] Ignoring inbound call ${data.callId} - queue ${data.queueId} not in selected queues [${allowedQueues.join(',')}]`);
              const num = data.callerNumber?.replace(/[\s\-\(\)]/g, "");
              if (num) filteredCallerNumbersRef.current.set(num, Date.now());
              return;
            }
            console.log(`[AgentWS] === INBOUND CALL POPUP === from ${data.callerNumber}`);
            setInboundCalls(prev => {
              if (prev.some(c => c.callId === data.callId)) return prev;
              return [...prev, {
                callId: data.callId,
                callerNumber: data.callerNumber,
                callerName: data.callerName,
                queueName: data.queueName,
                queueId: data.queueId,
                waitTime: data.waitTime || 0,
                channelId: data.channelId,
                timestamp: Date.now(),
                recordCalls: data.recordCalls ?? false,
                ringtoneId: data.ringtoneId ?? undefined,
                isQueueWaiting: data.isQueueWaiting ?? false,
              }];
            });
          } else if (data.type === "call-hangup") {
            // Server confirmed caller hung up — terminate SIP session WITHOUT marking agent as hanger-upper
            console.log("[AgentWS] Server-side call-hangup received, triggering remote hangup");
            callContext.remoteHangupFn.current?.();
          } else if (data.type === "call-cancelled") {
            const cancelledNum = data.callerNumber?.replace(/[\s\-\(\)]/g, "");
            setInboundCalls(prev => prev.filter(c => {
              if (c.callId === data.callId) return false;
              if (cancelledNum && c.callerNumber?.replace(/[\s\-\(\)]/g, "") === cancelledNum && c.queueId === (data.queueId || c.queueId)) return false;
              return true;
            }));
            // If this was a forwarded call the agent was working on, prompt disposition
            if (forwardedCallActiveRef.current?.callId === data.callId) {
              setForwardedCallActive(null);
              if (!isStatusListMode) {
                setDispositionChannelFilter("phone");
                setMandatoryDisposition(true);
                setDispositionModalOpen(true);
              }
            }
            queryClient.invalidateQueries({ queryKey: ["/api/agent/abandoned-calls"] });
            const reason = data.reason || "caller_hangup";
            const wasQueueWaiting = inboundCallsRef.current.find(c => c.callId === data.callId)?.isQueueWaiting;
            if (!cancelledCallIdsRef.current.has(data.callId) && reason !== "answered_by_other" && !wasQueueWaiting) {
              cancelledCallIdsRef.current.add(data.callId);
              setTimeout(() => cancelledCallIdsRef.current.delete(data.callId), 10000);
              const callerDisplay = data.callerName || data.callerNumber || "";
              const queueDisplay = data.queueName ? ` (${data.queueName})` : "";
              let description = `${callerDisplay}${queueDisplay} ${t.agentWorkspace.callerHangupDesc}`;
              if (reason === "timeout") {
                description = `${callerDisplay}${queueDisplay} ${t.agentWorkspace.redirectedTimeout}`;
              } else if (reason === "no_agents") {
                description = `${callerDisplay}${queueDisplay} ${t.agentWorkspace.redirectedNoAgents}`;
              }
              const notifId = Date.now();
              setMissedCallNotifs(prev => [...prev, {
                id: notifId,
                title: reason === "caller_hangup" ? t.agentWorkspace.missedCallToast : t.agentWorkspace.redirectedCallToast,
                description,
              }]);
              setTimeout(() => setMissedCallNotifs(prev => prev.filter(n => n.id !== notifId)), 15000);
            } else {
              console.log("[AgentWS] call-cancelled WS: suppressing toast, reason:", reason, "wasQueueWaiting:", wasQueueWaiting);
            }
          }
        } catch (err) {
          console.error(`[AgentWS] Failed to parse message:`, err);
        }
      };
      ws.onclose = (event) => {
        console.log(`[AgentWS] Disconnected (code: ${event.code}), reconnecting in 5s...`);
        reconnectTimer = setTimeout(connect, 5000);
      };
      ws.onerror = (event) => {
        console.error(`[AgentWS] WebSocket error`);
      };
    };

    connect();

    return () => {
      ws?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [user?.id, agentSession.isSessionActive]);

  useEffect(() => {
    if (!agentSession.isSessionActive) return;
    const staleTimer = setInterval(() => {
      const now = Date.now();
      setInboundCalls(prev => {
        const fresh = prev.filter(c => {
          const age = now - c.timestamp;
          if (age > 60000 && !c.hasSipInvitation) {
            console.log(`[AgentWS] Auto-removing stale inbound call ${c.callId} (${c.callerNumber}) - ${Math.round(age / 1000)}s old`);
            return false;
          }
          return true;
        });
        return fresh.length !== prev.length ? fresh : prev;
      });
      for (const [num, ts] of filteredCallerNumbersRef.current.entries()) {
        if (now - ts > 60000) filteredCallerNumbersRef.current.delete(num);
      }
    }, 15000);
    return () => clearInterval(staleTimer);
  }, [agentSession.isSessionActive]);

  const oldestRingtoneCall = inboundCalls.find(c => !c.isQueueWaiting);
  const oldestInboundRingtoneId = oldestRingtoneCall?.ringtoneId;
  useEffect(() => {
    const hasRingableInbound = inboundCalls.some(c => !c.isQueueWaiting);
    if (hasRingableInbound && inboundRingtoneEnabled && agentSession.isSessionActive) {
      stopInboundRingtone();
      startInboundRingtone(oldestInboundRingtoneId);
    } else {
      stopInboundRingtone();
    }
  }, [inboundCalls.length, oldestInboundRingtoneId, inboundRingtoneEnabled, agentSession.isSessionActive, startInboundRingtone, stopInboundRingtone]);

  useEffect(() => {
    if (!inboundRingtoneEnabled) return;
    const ctx = inboundAudioCtxRef.current;
    if (ctx && ctx.state === "running") return;
    const prime = () => {
      try {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        let c = inboundAudioCtxRef.current;
        if (!c || c.state === "closed") {
          c = new Ctor() as AudioContext;
          inboundAudioCtxRef.current = c;
        }
        if (c.state === "suspended") { c.resume().catch(() => {}); }
      } catch {}
    };
    const onGesture = () => { prime(); cleanup(); };
    const cleanup = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchstart", onGesture);
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    window.addEventListener("touchstart", onGesture, { once: true });
    return cleanup;
  }, [inboundRingtoneEnabled]);

  // On mobile: always prime AudioContext on first gesture so ringtone can play
  // without requiring the user to explicitly enable the opt-in toggle.
  useEffect(() => {
    if (!isMobile) return;
    const prime = () => {
      try {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        let c = inboundAudioCtxRef.current;
        if (!c || c.state === "closed") {
          c = new Ctor() as AudioContext;
          inboundAudioCtxRef.current = c;
        }
        if (c.state === "suspended") { c.resume().catch(() => {}); }
      } catch {}
    };
    const onGesture = () => { prime(); cleanup(); };
    const cleanup = () => {
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("pointerdown", onGesture);
    };
    window.addEventListener("touchstart", onGesture, { once: true, passive: true });
    window.addEventListener("pointerdown", onGesture, { once: true });
    return cleanup;
  }, [isMobile]);

  // On mobile: play ringtone for direct SIP incoming call (sipIncomingCall).
  // Desktop is handled by the SipPhone component's own oscillator.
  useEffect(() => {
    if (!isMobile) return;
    if (sipIncomingCall && agentSession.isSessionActive) {
      stopInboundRingtone();
      startInboundRingtone();
    } else {
      stopInboundRingtone();
    }
  }, [sipIncomingCall, isMobile, agentSession.isSessionActive, startInboundRingtone, stopInboundRingtone]);

  useEffect(() => {
    return () => {
      stopInboundRingtone();
      const ctx = inboundAudioCtxRef.current;
      if (ctx && ctx.state !== "closed") {
        try { ctx.close(); } catch {}
      }
      inboundAudioCtxRef.current = null;
    };
  }, [stopInboundRingtone]);

  useEffect(() => {
    if (sipIncomingCall && agentSession.isSessionActive) {
      const callerNum = sipIncomingCall.callerNumber?.replace(/[\s\-\(\)]/g, "");
      const invitation = sipIncomingCall.invitation;

      const filteredAt = callerNum ? filteredCallerNumbersRef.current.get(callerNum) : undefined;
      const wasRecentlyFiltered = filteredAt && (Date.now() - filteredAt) < 30000;
      if (wasRecentlyFiltered) {
        console.log("[AgentWS] SIP INVITE from recently filtered queue call, auto-rejecting:", callerNum);
        try { invitation?.reject?.(); } catch {}
        if (callerNum) filteredCallerNumbersRef.current.delete(callerNum);
        return;
      }

      // Normalize to last 9 digits to handle +421/00421/0 prefix mismatches
      const normPhone = (p?: string | null) => { const d = (p || "").replace(/\D/g, ""); return d.slice(-9); };
      const callerLast9 = normPhone(sipIncomingCall.callerNumber);

      setInboundCalls(prev => {
        // Original guard: skip if this exact invitation object is already linked.
        const alreadyLinked = prev.some(c => c.hasSipInvitation && c.sipInvitation && c.sipInvitation === invitation);
        if (alreadyLinked) return prev;

        const directUnlinked = prev.filter(c => !c.hasSipInvitation && c.channelId === "sip-webrtc");
        const directMatch = directUnlinked.find(c => {
          const n = normPhone(c.callerNumber);
          return callerLast9.length >= 7 && n === callerLast9;
        });
        if (directMatch) {
          console.log("[AgentWS] SIP INVITE re-linked to existing direct SIP call:", directMatch.callId, directMatch.callerNumber);
          return prev.map(c => c.callId === directMatch.callId ? { ...c, hasSipInvitation: true, sipInvitation: invitation } : c);
        }

        const queueUnlinked = prev.filter(c => !c.hasSipInvitation && c.channelId !== "sip-webrtc");
        if (queueUnlinked.length > 0) {
          const matchByNumber = queueUnlinked.find(c => {
            const n = normPhone(c.callerNumber);
            return callerLast9.length >= 7 && n === callerLast9;
          });
          const target = matchByNumber || queueUnlinked[queueUnlinked.length - 1];
          console.log("[AgentWS] SIP INVITE linked to queue call:", target.callId, target.callerNumber);
          return prev.map(c => c.callId === target.callId ? { ...c, hasSipInvitation: true, sipInvitation: invitation } : c);
        }

        console.log("[AgentWS] SIP incoming call (direct, no queue):", callerNum);
        return [...prev, {
          callId: `sip-${Date.now()}`,
          callerNumber: sipIncomingCall.callerNumber,
          callerName: sipIncomingCall.callerName,
          queueName: "Inbound",
          queueId: "sip-direct",
          waitTime: 0,
          channelId: "sip-webrtc",
          timestamp: Date.now(),
          hasSipInvitation: true,
          sipInvitation: invitation,
        }];
      });
    } else if (!sipIncomingCall) {
      const currentCalls = inboundCallsRef.current;
      const linkedCalls = currentCalls.filter(c => c.hasSipInvitation);
      if (linkedCalls.length > 0) {
        const directSipCalls = linkedCalls.filter(c => c.channelId === "sip-webrtc");
        const queueLinkedCalls = linkedCalls.filter(c => c.channelId !== "sip-webrtc");

        if (directSipCalls.length > 0) {
          console.log("[AgentWS] Direct SIP invite ended, removing calls:", directSipCalls.map(c => `${c.callId} (${c.callerNumber})`));
          const directCallIds = new Set(directSipCalls.map(c => c.callId));
          directSipCalls.forEach(c => {
            if (!cancelledCallIdsRef.current.has(c.callId)) {
              cancelledCallIdsRef.current.add(c.callId);
              setTimeout(() => cancelledCallIdsRef.current.delete(c.callId), 10000);
              const callerDisplay = c.callerName || c.callerNumber || t.agentWorkspace.unknownContact;
              const queueDisplay = c.queueName ? ` (${c.queueName})` : "";
              toast({
                title: t.agentWorkspace.missedCallLabel,
                description: `${callerDisplay}${queueDisplay} — ${t.agentWorkspace.callerHungUp}`,
                variant: "destructive",
              });
            }
          });
          setInboundCalls(prev => prev.filter(c => !directCallIds.has(c.callId)));
        }

        if (queueLinkedCalls.length > 0) {
          console.log("[AgentWS] Queue SIP invite ended, unlinking SIP (call still in queue):", queueLinkedCalls.map(c => `${c.callId} (${c.callerNumber})`));
          setInboundCalls(prev => prev.map(c => {
            if (queueLinkedCalls.some(ql => ql.callId === c.callId)) {
              return { ...c, hasSipInvitation: false, sipInvitation: undefined };
            }
            return c;
          }));
        }
      }
    }
  }, [sipIncomingCall, agentSession.isSessionActive]);

  type InboundCallEntry = typeof inboundCalls[number];

  const handleAcceptInboundCall = useCallback(async (call: InboundCallEntry | null) => {
    if (!call) return;
    if (acceptingCallRef.current) {
      console.log("[AgentWS] Accept already in progress, ignoring duplicate click");
      return;
    }
    acceptingCallRef.current = true;
    wasInboundCallRef.current = true;
    setIsLoadingInboundContact(true);

    const removeCall = () => setInboundCalls(prev => prev.filter(c => c.callId !== call.callId));
    const callerNumber = call.callerNumber;

    const setupCallContext = async () => {
      setActiveChannel("phone");
      setRightTab("actions");
      setCallNotes("");
      agentSession.updateStatus("busy").catch(() => {});

      callContext.setAutoRecord(!!call.recordCalls);

      if (call.callId && !call.callId.startsWith("sip-")) {
        apiRequest("POST", `/api/inbound-calls/${call.callId}/answer`, { userId: user?.id }).catch(() => {});
      }

      // Fetch ALL entity matches for this number so agent can pick the right one
      let anyFound = false;
      try {
        const allRes = await fetch(`/api/phone/lookup-all?phone=${encodeURIComponent(callerNumber)}`, { credentials: "include" });
        if (allRes.ok) {
          const allMatches: PhoneMatch[] = await allRes.json();
          if (allMatches.length > 1) {
            // Multiple matches — show entity selection modal; agent will pick
            anyFound = true;
            setPendingInboundMatches({ phone: callerNumber, matches: allMatches, callId: call.callId });
            setTimeline([{
              id: `sys-inbound-${Date.now()}`,
              type: "system",
              timestamp: new Date(),
              content: `Prichádzajúci hovor od ${callerNumber} — ${allMatches.length} zhôd, vyberte kontakt`,
            }]);
          } else if (allMatches.length === 1) {
            // Single match — auto-load it (customer or any other entity type)
            anyFound = true;
            const m = allMatches[0];
            if (m.entityType === "customer") {
              const custRes = await fetch(`/api/customers/${m.id}`, { credentials: "include" });
              if (custRes.ok) {
                const customer = await custRes.json();
                setCurrentContact(customer);
                setCurrentCampaignContactId(null);
                const newTask: TaskItem = {
                  id: `task-inbound-${Date.now()}`,
                  contact: customer,
                  campaignId: selectedCampaignId || "",
                  campaignName: selectedCampaign?.name || "Inbound",
                  campaignContactId: null,
                  channel: "phone",
                  startedAt: new Date(),
                  status: "active",
                  direction: "inbound",
                };
                const dupTask4 = tasksRef.current.find(t => !t.campaignContactId && t.contact?.id === customer.id);
                if (dupTask4) {
                  setActiveTaskId(dupTask4.id);
                } else {
                  setTasks((prev) => [...prev, newTask]);
                  setActiveTaskId(newTask.id);
                  setTimeline([{
                    id: `sys-inbound-${Date.now()}`,
                    type: "system",
                    timestamp: new Date(),
                    content: `Prichádzajúci hovor od ${m.name} (${callerNumber})`,
                    details: "Inbound call",
                  }]);
                }
              }
            } else {
              // Hospital / clinic / collaborator — load entity, set card, and create task
              await handleSelectInboundMatch(m, "card", {
                callId: call.callId,
                campaignId: selectedCampaignId || "",
                campaignName: selectedCampaign?.name || "Inbound",
                callerNumber,
              });
            }
          }
        }
      } catch (lookupErr) {
        console.warn("[AgentWS] lookup-all failed:", lookupErr);
      }

      if (!anyFound) {
        setPendingUnknownCaller({ phone: callerNumber });
        setTimeline([{
          id: `sys-inbound-${Date.now()}`,
          type: "system",
          timestamp: new Date(),
          content: `Prichádzajúci hovor od ${callerNumber} (neznámy kontakt)`,
        }]);
      } else {
        setPendingUnknownCaller(null);
      }
      setIsLoadingInboundContact(false);
    };

    try {
      if (call.hasSipInvitation || call.sipInvitation) {
        console.log("[AgentWS] Accepting inbound call via SIP:", callerNumber);

        let invitation = call.sipInvitation || incomingCallRef?.current?.invitation;

        if (!invitation) {
          await new Promise(r => setTimeout(r, 200));
          invitation = incomingCallRef?.current?.invitation;
        }

        if (!invitation) {
          toast({ title: t.agentWorkspace.errorLabel, description: t.agentWorkspace.sipInviteNotReady, variant: "destructive" });
          acceptingCallRef.current = false;
          return;
        }

        const invState = invitation.state;
        console.log("[AgentWS] SIP invitation state:", invState);

        if (invState === "Terminated" || invState === "Canceled") {
          toast({ title: t.agentWorkspace.callCancelledLabel, description: t.agentWorkspace.callerHungUp });
          removeCall();
          acceptingCallRef.current = false;
          return;
        }

        invitation._inboundQueueId = call.queueId;
        invitation._inboundQueueName = call.queueName;
        invitation._inboundCallLogId = call.callId;
        invitation._inboundCallerNumber = callerNumber;
        invitation._inboundCallerName = call.callerName;
        invitation._inboundRecordCalls = !!call.recordCalls;

        if (invState === "Established") {
          console.log("[AgentWS] Call already established, proceeding directly");
        } else {
          try {
            await invitation.accept({
              sessionDescriptionHandlerOptions: {
                constraints: { audio: true, video: false }
              }
            });
            console.log("[AgentWS] SIP accept succeeded");
          } catch (acceptErr: any) {
            console.warn("[AgentWS] SIP accept threw:", acceptErr?.message);
            const postState = invitation.state;
            if (postState !== "Established" && postState !== "Establishing") {
              toast({ title: t.agentWorkspace.errorLabel, description: t.agentWorkspace.callAcceptError, variant: "destructive" });
              removeCall();
              setIncomingCallWithRef(null);
              acceptingCallRef.current = false;
              return;
            }
            console.log("[AgentWS] Call is", postState, "despite accept error - proceeding");
          }
        }

        removeCall();
        setIncomingCallWithRef(null);
        const shouldAutoRecord = !!call.recordCalls || callContext.autoRecord;
        const inboundOptions = { autoRecord: shouldAutoRecord };
        console.log("[AgentWS] Inbound options:", { recordCalls: !!call.recordCalls, globalAutoRecord: callContext.autoRecord, shouldAutoRecord });
        console.log("[AgentWS] handleInboundAnsweredFn registered:", !!callContext.handleInboundAnsweredFn.current);
        if (callContext.handleInboundAnsweredFn.current) {
          console.log("[AgentWS] Calling handleInboundAnswered directly");
          callContext.handleInboundAnsweredFn.current(invitation, inboundOptions);
        } else {
          console.warn("[AgentWS] handleInboundAnsweredFn not registered, queuing session");
          callContext.queuedInboundSession.current = { session: invitation, options: inboundOptions };
          callContext.setAutoRecord(shouldAutoRecord);
          setAnsweredIncomingSession(invitation);
        }
        toast({ title: t.agentWorkspace.callAccepted, description: `${t.agentWorkspace.connectedWith} ${callerNumber}` });
        await setupCallContext();
      } else {
        // Fallback: even if not linked via useEffect (number format mismatch), check incomingCallRef
        const fallbackInvite = incomingCallRef?.current?.invitation;
        if (fallbackInvite && fallbackInvite.state !== "Terminated" && fallbackInvite.state !== "Canceled") {
          console.log("[AgentWS] hasSipInvitation=false but invite found in ref, accepting via SIP fallback");
          fallbackInvite._inboundQueueId = call.queueId;
          fallbackInvite._inboundQueueName = call.queueName;
          fallbackInvite._inboundCallLogId = call.callId;
          fallbackInvite._inboundCallerNumber = callerNumber;
          fallbackInvite._inboundCallerName = call.callerName;
          fallbackInvite._inboundRecordCalls = !!call.recordCalls;
          try {
            if (fallbackInvite.state !== "Established") {
              await fallbackInvite.accept({ sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } } });
            }
          } catch (acceptErr: any) {
            const postState = fallbackInvite.state;
            if (postState !== "Established" && postState !== "Establishing") {
              toast({ title: t.agentWorkspace.errorLabel, description: t.agentWorkspace.callAcceptError, variant: "destructive" });
              acceptingCallRef.current = false;
              return;
            }
          }
          removeCall();
          setIncomingCallWithRef(null);
          const shouldAutoRecord = !!call.recordCalls || callContext.autoRecord;
          if (callContext.handleInboundAnsweredFn.current) {
            callContext.handleInboundAnsweredFn.current(fallbackInvite, { autoRecord: shouldAutoRecord });
          } else {
            callContext.queuedInboundSession.current = { session: fallbackInvite, options: { autoRecord: shouldAutoRecord } };
            callContext.setAutoRecord(shouldAutoRecord);
            setAnsweredIncomingSession(fallbackInvite);
          }
          toast({ title: t.agentWorkspace.callAccepted, description: `${t.agentWorkspace.connectedWith} ${callerNumber}` });
          await setupCallContext();
        } else {
          await apiRequest("POST", `/api/inbound-calls/${call.callId}/answer`, { userId: user?.id });
          toast({ title: t.agentWorkspace.callAccepted });
          removeCall();
          await setupCallContext();
          setForwardedCallActive({ callId: call.callId, callerNumber, callerName: call.callerName, startedAt: new Date() });
        }
      }
    } catch (err: any) {
      console.error("[AgentWS] Error accepting call:", err);
      toast({ title: t.agentWorkspace.errorLabel, description: err.message || t.agentWorkspace.callAcceptError, variant: "destructive" });
      setIsLoadingInboundContact(false);
    } finally {
      acceptingCallRef.current = false;
    }
  }, [incomingCallRef, setIncomingCallWithRef, setAnsweredIncomingSession, callContext, toast, user?.id, agentSession, selectedCampaignId, selectedCampaign]);

  const handleRejectInboundCall = useCallback((call: InboundCallEntry | null) => {
    if (!call) return;
    const removeCall = () => setInboundCalls(prev => prev.filter(c => c.callId !== call.callId));
    if (call.hasSipInvitation || call.sipInvitation) {
      if (call.sipInvitation) {
        try { call.sipInvitation.reject(); } catch (e) { console.warn("[AgentWS] Direct reject failed:", e); }
      } else {
        rejectIncomingCall();
      }
      setIncomingCallWithRef(null);
      removeCall();
      toast({ title: t.agentWorkspace.callRejected });
    } else {
      apiRequest("POST", `/api/inbound-calls/${call.callId}/reject`, { userId: user?.id })
        .then(() => removeCall())
        .catch(() => removeCall());
    }
  }, [rejectIncomingCall, setIncomingCallWithRef, toast, user?.id]);

  const activeBreakTypeObj = agentSession.activeBreak
    ? agentSession.breakTypes.find(bt => bt.id === agentSession.activeBreak?.breakTypeId) || null
    : null;
  const activeBreakName = activeBreakTypeObj?.name || (agentSession.activeBreak as any)?.breakTypeName || (agentSession.activeBreak ? t.agentSession.statusBreak : null);

  return (
    <div className={`flex flex-col ${agentSession.isSessionActive ? "h-screen" : "h-[calc(100vh-8rem)] -m-6"}`}>
      <InboundCallPopup
        inboundCalls={inboundCalls}
        onAccept={(call) => handleAcceptInboundCall(call)}
        onReject={(call) => handleRejectInboundCall(call)}
        onDismiss={(callId) => setInboundCalls(prev => prev.filter(c => c.callId !== callId))}
        agentStatus={agentSession.status}
        activeCallState={callContext.callState}
      />
      {missedCallNotifs.length > 0 && (
        <div className="fixed bottom-4 left-4 z-[200] flex flex-col gap-2 max-w-xs w-full pointer-events-none" data-testid="missed-call-notifs">
          {missedCallNotifs.map(notif => (
            <div
              key={notif.id}
              className="pointer-events-auto animate-in slide-in-from-bottom-3 duration-300 rounded-xl overflow-hidden shadow-2xl border border-red-800/40"
              style={{ background: "linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 60%, #1f0808 100%)" }}
              data-testid={`missed-call-notif-${notif.id}`}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5" style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.35)" }}>
                  <PhoneOff className="h-4 w-4 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-red-300 leading-tight">{notif.title}</p>
                  <p className="text-[11px] text-red-400/80 mt-0.5 leading-snug">{notif.description}</p>
                </div>
                <button
                  onClick={() => setMissedCallNotifs(prev => prev.filter(n => n.id !== notif.id))}
                  className="shrink-0 mt-0.5 p-1 rounded-md text-red-500/60 hover:text-red-300 hover:bg-red-900/40 transition-colors"
                  data-testid={`btn-close-notif-${notif.id}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="h-[2px] w-full bg-red-900/30">
                <div className="h-full bg-red-500/60 animate-[shrink_15s_linear_forwards]" style={{ width: "100%" }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {agentSession.isSessionActive && (
        <VoicemailNotifications
          queueIds={sessionInboundQueueIds}
          onCallback={(phoneNumber) => {
            if (makeCall) {
              makeCall({ phoneNumber });
            }
          }}
        />
      )}
      <Dialog open={sessionLoginOpen && !agentSession.isSessionActive} onOpenChange={(open) => { if (!open) { setSessionLoginOpen(false); setLocation("/"); } }}>
        <DialogContent className={isMobile ? "w-full max-w-full h-full max-h-full rounded-none p-0 overflow-hidden gap-0 flex flex-col" : "sm:max-w-3xl p-0 overflow-hidden gap-0 flex flex-col max-h-[90vh]"} hideCloseButton>
          <DialogTitle className="sr-only">{t.agentSession.shiftLogin}</DialogTitle>

          {/* ── MOBILE: zjednodušená hlavička ── */}
          {isMobile ? (
            <div className="shrink-0 px-5 pt-6 pb-4 border-b bg-gradient-to-br from-card to-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Headphones className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold leading-tight">Prihlásiť sa na zmenu</p>
                  <p className="text-sm text-muted-foreground truncate">{(user as any)?.fullName || user?.username || ""}</p>
                </div>
              </div>
            </div>
          ) : (
          <div className="relative px-5 pt-4 pb-4 shrink-0 overflow-hidden bg-gradient-to-br from-card via-card to-muted/40 dark:from-card dark:to-muted/20">
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, hsl(355 85% 42% / 0.08) 0%, transparent 70%)" }} />
            <div className="absolute bottom-0 left-0 w-36 h-20 pointer-events-none" style={{ background: "radial-gradient(ellipse, hsl(355 85% 42% / 0.05) 0%, transparent 70%)" }} />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 bg-card border border-border">
                <Headphones className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-sm leading-tight text-foreground">{t.agentSession.shiftLogin}</h2>
                <p className="text-[11px] mt-0.5 text-muted-foreground">{t.agentSession.shiftLoginDesc}</p>
              </div>
              <div className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3 py-2 shrink-0">
                <div className="relative shrink-0">
                  <Avatar className="h-7 w-7 border border-border">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={(user as any)?.fullName || user?.username || ""} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                      {((user as any)?.fullName || user?.username || "").split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-card bg-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-tight truncate max-w-[140px]">{(user as any)?.fullName || user?.username || "—"}</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{user?.email || ""}</p>
                </div>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">{t.agentSession.onlineStatus}</span>
              </div>
              <DialogClose className="shrink-0 rounded-md p-1.5 opacity-70 hover:opacity-100 hover:bg-accent transition-opacity focus:outline-none focus:ring-2 focus:ring-ring">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </div>
          )}

          {/* ── MOBILE: jednoduchý obsah (len výber misií + frônt) ── */}
          {isMobile ? (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {/* Kampane */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t.agentWorkspace.campaigns}</p>
                  <div className="space-y-2">
                    {loginCampaigns.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-1">Žiadne dostupné kampane</p>
                    ) : loginCampaigns.map((campaign) => {
                      const isChecked = selectedLoginCampaignIds.includes(campaign.id);
                      return (
                        <button
                          key={campaign.id}
                          onClick={() => setSelectedLoginCampaignIds(prev => prev.includes(campaign.id) ? prev.filter(id => id !== campaign.id) : [...prev, campaign.id])}
                          className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                            isChecked ? "bg-primary/5 border-primary/30" : "bg-card border-border"
                          }`}
                          data-testid={`login-campaign-${campaign.id}`}
                        >
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isChecked ? "bg-primary/10" : "bg-muted"}`}>
                            <Headphones className={`h-5 w-5 ${isChecked ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold truncate">{campaign.name}</p>
                            {campaign.countryCodes?.length > 0 && (
                              <p className="text-xs text-muted-foreground">{campaign.countryCodes.map((c: string) => getCountryFlag(c)).join(" ")}</p>
                            )}
                          </div>
                          <div className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${isChecked ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                            {isChecked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inbound fronty */}
                {myQueues.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t.agentSession.inboundQueues}</p>
                    <div className="space-y-2">
                      {myQueues.map((queue) => {
                        const isChecked = selectedLoginQueueIds.includes(queue.id);
                        return (
                          <button
                            key={queue.id}
                            onClick={() => setSelectedLoginQueueIds(prev => prev.includes(queue.id) ? prev.filter(id => id !== queue.id) : [...prev, queue.id])}
                            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                              isChecked ? "bg-green-500/5 border-green-500/30" : "bg-card border-border"
                            }`}
                            data-testid={`login-queue-${queue.id}`}
                          >
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isChecked ? "bg-green-500/10" : "bg-muted"}`}>
                              <PhoneIncoming className={`h-5 w-5 ${isChecked ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-semibold truncate">{queue.name}</p>
                              {queue.didNumber && <p className="text-xs text-muted-foreground">{queue.didNumber}</p>}
                            </div>
                            <div className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${isChecked ? "bg-green-500 border-green-500" : "border-muted-foreground/30"}`}>
                              {isChecked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Štart tlačidlo */}
              <div className="px-4 pb-6 pt-3 shrink-0 border-t bg-card/80">
                <button
                  onClick={handleStartSession}
                  disabled={selectedLoginCampaignIds.length === 0 && selectedLoginQueueIds.length === 0}
                  className="w-full h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/25 active:scale-[0.98] transition-all disabled:opacity-40"
                  data-testid="button-start-session"
                >
                  <Headphones className="h-6 w-6" />
                  Spustiť zmenu
                </button>
                {selectedLoginCampaignIds.length === 0 && selectedLoginQueueIds.length === 0 && (
                  <p className="text-center text-sm mt-2 text-muted-foreground">Vyberte aspoň jednu misiu alebo frontu</p>
                )}
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-2 flex-1 min-h-0 overflow-hidden divide-x divide-border">

            {/* ─── Ľavý stĺpec: Today's Activities + Scheduled Calls ─── */}
            <div className="overflow-y-auto px-4 py-4 bg-muted/10 dark:bg-muted/5">
              {(() => {
                const selectedCamps = loginCampaigns.filter(c => selectedLoginCampaignIds.includes(c.id));
                const maxCallQuota = selectedCamps.length > 0
                  ? selectedCamps.reduce((m, c) => { const q = shiftData?.campaignData?.[c.id]?.dailyCallQuota ?? 0; return Math.max(m, q); }, 0) || null
                  : null;
                const maxContactsQuota = selectedCamps.length > 0
                  ? selectedCamps.reduce((m, c) => { const q = shiftData?.campaignData?.[c.id]?.maxContactsPerDay ?? 0; return Math.max(m, q); }, 0) || null
                  : null;
                const conversionGoalPct = selectedCamps.length > 0
                  ? selectedCamps.reduce((m, c) => { const g = shiftData?.campaignData?.[c.id]?.conversionGoal ?? 0; return Math.max(m, g); }, 0)
                  : 0;
                const contactsVal = shiftData?.contactsHandled ?? 0;
                const callsVal = shiftData?.totalCallsToday ?? 0;
                const convsVal = shiftData?.conversionsToday ?? 0;
                const breakOver = (shiftData?.totalBreakMinutes || 0) >= 60;
                const totalH = Math.floor((shiftData?.totalWorkMinutes || 0) / 60);
                const totalM = (shiftData?.totalWorkMinutes || 0) % 60;
                const convTarget = conversionGoalPct > 0 && maxContactsQuota ? Math.round(conversionGoalPct / 100 * maxContactsQuota) : null;
                const convRateActual = contactsVal > 0 ? (convsVal / contactsVal) * 100 : 0;
                const hasTodayData = shiftData && (contactsVal > 0 || callsVal > 0 || (shiftData.totalBreakSeconds ?? shiftData.totalBreakMinutes * 60) > 0 || shiftData.dispositionsToday > 0 || shiftData.totalCallMinutes > 0 || convsVal > 0);

                const KpiBar = ({ label, value, quota, suffix = "", color = "hsl(355 85% 42%)" }: { label: string; value: number; quota: number | null; suffix?: string; color?: string }) => {
                  const pct = quota ? Math.min(100, Math.round((value / quota) * 100)) : 0;
                  const fmt = (v: number) => suffix === "%" ? v.toFixed(1) + "%" : String(v);
                  return (
                    <div className="mb-2 last:mb-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                        <span className="text-[10px] font-semibold text-foreground">
                          {fmt(value)}{quota !== null && <span className="text-muted-foreground">/{suffix === "%" ? fmt(quota) : quota}</span>}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-muted">
                        <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {/* Sekcia: Today's Progress */}
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.agentSession.dailyTargetReached}</p>
                      {shiftData && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">{totalH > 0 ? `${totalH}h ` : ""}{totalM}m {t.agentSession.workLabel}</span>
                          <button onClick={() => refetchShiftData()} className="flex items-center gap-1 px-1 py-0.5 rounded-md transition-colors hover:bg-muted text-muted-foreground" title="Refresh shift data">
                            <RotateCw className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {hasTodayData ? (
                      <div className="grid grid-cols-2 gap-x-3 mb-1">
                        <KpiBar label={t.agentSession.contactsToday} value={contactsVal} quota={maxContactsQuota} />
                        <KpiBar label={t.agentSession.callsToday} value={callsVal} quota={maxCallQuota} />
                        <KpiBar label={t.agentSession.conversionsToday} value={convsVal} quota={convTarget} color="#16A34A" />
                        <KpiBar label={t.agentSession.conversionRate} value={convRateActual} quota={conversionGoalPct > 0 ? conversionGoalPct : null} suffix="%" color="#7C3AED" />
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic mb-3">—</p>
                    )}

                    {/* Prestávka */}
                    {shiftData && ((shiftData.totalBreakSeconds ?? shiftData.totalBreakMinutes * 60) > 0) && (
                      <div className="mt-1 pt-2 border-t border-border">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-muted-foreground">{t.agentSession.breakTimeUsed}</span>
                          <span className={`text-[10px] font-semibold ${breakOver ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                            {shiftData.totalBreakMinutes > 0 ? `${shiftData.totalBreakMinutes} min` : `${shiftData.totalBreakSeconds ?? 0} s`}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-muted">
                          <div className="h-1 rounded-full transition-all" style={{ width: `${Math.min(100, Math.round(((shiftData.totalBreakSeconds ?? shiftData.totalBreakMinutes * 60) / 3600) * 100))}%`, background: breakOver ? "#DC2626" : "#F97316" }} />
                        </div>
                      </div>
                    )}

                    {/* Scheduled Calls Forecast — 3 pracovné dni */}
                    {(() => {
                      const byDate = scheduledForecast?.byDate ?? {};
                      const todayBase = new Date();
                      const todayDow = todayBase.getDay();
                      const workDays: { key: string; label: string; count: number }[] = [];
                      const iter = new Date(todayBase);
                      let calOffset = 0;
                      while (workDays.length < 3) {
                        const dow = iter.getDay();
                        if (dow !== 0 && dow !== 6) {
                          const key = iter.toISOString().slice(0, 10);
                          const count = byDate[key] ?? 0;
                          let label: string;
                          if (calOffset === 0) label = t.agentSession.scheduledToday;
                          else if (calOffset === 1 && todayDow >= 1 && todayDow <= 4) label = t.agentSession.scheduledTomorrow;
                          else label = iter.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
                          workDays.push({ key, label, count });
                        }
                        iter.setDate(iter.getDate() + 1);
                        calOffset++;
                      }
                      const totalForecast = workDays.reduce((s, d) => s + d.count, 0);
                      const maxCount = Math.max(...workDays.map(d => d.count), 1);
                      return (
                        <div className="mt-2 pt-2 border-t border-border">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t.agentSession.scheduledCallsTitle}</span>
                            <span className="text-[10px] font-bold text-foreground">{totalForecast}</span>
                          </div>
                          {totalForecast === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic">{t.agentSession.scheduledNoData}</p>
                          ) : (
                            <div className="space-y-1">
                              {workDays.map(({ key, label, count }) => (
                                <div key={key}>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[10px] text-muted-foreground">{label}</span>
                                    <span className="text-[10px] font-semibold text-foreground">{count}</span>
                                  </div>
                                  <div className="h-1 rounded-full bg-muted">
                                    <div className="h-1 rounded-full transition-all" style={{ width: count > 0 ? `${Math.round((count / maxCount) * 100)}%` : "0%", background: "#3B82F6" }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Back Office agenda — grafické počítadlá — len pre role s povoleným modulom */}
                    {canBackOfficeAgenda && (() => {
                      const isDone = (it: BOAgendaItem) => it.task.status === "completed" || !!it.confirmation || it.task.boState === "done";
                      const newCount = boAgendaItems.filter(it => !isDone(it) && (it.task.boState === null || it.task.boState === "received")).length;
                      const pendingCount = boAgendaItems.filter(it => !isDone(it) && (it.task.boState === "in_progress" || it.task.boState === "waiting_agent")).length;
                      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
                      const doneWeekCount = boAgendaItems.filter(it => it.confirmation?.confirmedAt && new Date(it.confirmation.confirmedAt) >= weekStart).length;
                      return (
                        <div className="mt-2 pt-2 border-t border-border">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t.agentSession.backOfficeAgendaTitle}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-2 text-center" data-testid="bo-agenda-new">
                              <div className="text-lg font-bold text-blue-700 dark:text-blue-300 leading-none">{newCount}</div>
                              <div className="text-[9px] font-medium text-blue-600/80 dark:text-blue-400/80 mt-1 leading-tight">{t.backOffice.agendaNew}</div>
                            </div>
                            <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-2 text-center" data-testid="bo-agenda-pending">
                              <div className="text-lg font-bold text-amber-700 dark:text-amber-300 leading-none">{pendingCount}</div>
                              <div className="text-[9px] font-medium text-amber-600/80 dark:text-amber-400/80 mt-1 leading-tight">{t.backOffice.agendaPending}</div>
                            </div>
                            <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-2 text-center" data-testid="bo-agenda-done-week">
                              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-none">{doneWeekCount}</div>
                              <div className="text-[9px] font-medium text-emerald-600/80 dark:text-emerald-400/80 mt-1 leading-tight">{t.backOffice.agendaDoneWeek}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>

            {/* ─── Pravý stĺpec: Kampane + Inbound + Prihlásenie ─── */}
            <div className="flex flex-col min-h-0">

              {/* Scrollovateľná časť */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

                {/* Upozornenie na presmerovanie hovoru */}
                {callForwardingActive && (
                  <div className="rounded-xl px-3 py-2.5 flex items-start gap-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <PhoneForwarded className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-blue-800 dark:text-blue-400">{t.agentSession.callForwardingActive}</p>
                      <p className="text-[11px] mt-0.5 text-blue-700 dark:text-blue-500">
                        {t.agentSession.callForwardingWarning} <span className="font-mono font-semibold">{fwdDataPage?.number}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Kampane */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.agentWorkspace.campaigns}</span>
                    {selectedLoginCampaignIds.length > 0 && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "hsl(355 85% 42% / 0.10)", color: "hsl(355 85% 42%)" }}>
                        {selectedLoginCampaignIds.length} {selectedLoginCampaignIds.length === 1 ? t.agentSession.selectedOne : t.agentSession.selected}
                      </span>
                    )}
                  </div>
                  <ScrollArea className="max-h-56">
                    <div className="space-y-1.5 pr-1">
                      {loginCampaigns.length === 0 ? (
                        <div className="text-center py-5">
                          <Megaphone className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-xs text-muted-foreground">{t.agentWorkspace.noCampaigns || "Žiadne kampane"}</p>
                        </div>
                      ) : (
                        loginCampaigns.map((campaign) => {
                          const chConfig = CHANNEL_CONFIG[campaign.channel as ChannelType] || CHANNEL_CONFIG.phone;
                          const ChIcon = chConfig.icon;
                          const isChecked = selectedLoginCampaignIds.includes(campaign.id);
                          const channelHex: Record<string, string> = { phone: "#3B82F6", email: "#22C55E", sms: "#F97316", mixed: "#A855F7" };
                          const barColor = channelHex[campaign.channel] || "#3B82F6";
                          return (
                            <div
                              key={campaign.id}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
                              style={{
                                background: isChecked ? "hsl(var(--primary) / 0.06)" : "hsl(var(--card))",
                                border: `1px solid ${isChecked ? "hsl(var(--primary) / 0.3)" : "hsl(var(--border))"}`,
                                boxShadow: isChecked ? "inset 0 0 0 1px #E8C8C840" : "none",
                              }}
                              onClick={() => setSelectedLoginCampaignIds(prev => prev.includes(campaign.id) ? prev.filter(id => id !== campaign.id) : [...prev, campaign.id])}
                              data-testid={`login-campaign-${campaign.id}`}
                            >
                              <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: isChecked ? "hsl(355 85% 42%)" : barColor, minHeight: 28 }} />
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: isChecked ? "hsl(355 85% 42% / 0.10)" : "hsl(var(--muted))" }}>
                                <ChIcon className="h-3.5 w-3.5" style={{ color: isChecked ? "hsl(355 85% 42%)" : barColor }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold text-foreground leading-tight">{campaign.name}</p>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: isChecked ? "hsl(355 85% 42% / 0.10)" : "hsl(var(--muted))", color: isChecked ? "hsl(355 85% 42%)" : barColor }}>{chConfig.label}</span>
                                    <div className="rounded flex items-center justify-center transition-colors" style={{ width: 18, height: 18, background: isChecked ? "hsl(355 85% 42%)" : "transparent", border: `2px solid ${isChecked ? "hsl(355 85% 42%)" : "hsl(var(--border))"}` }}
                                         data-testid={`checkbox-login-campaign-${campaign.id}`}>
                                      {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {campaign.countryCodes && campaign.countryCodes.length > 0 && (
                                    <span className="text-[10px]">{campaign.countryCodes.map((code: string) => getCountryFlag(code)).join(" ")}</span>
                                  )}
                                  {campaign.startDate && (
                                    <span className="text-[10px] text-muted-foreground">{format(new Date(campaign.startDate), "dd.MM.yy")} – {campaign.endDate ? format(new Date(campaign.endDate), "dd.MM.yy") : "..."}</span>
                                  )}
                                </div>
                                {(() => {
                                  const cd = shiftData?.campaignData?.[campaign.id];
                                  const wStart = cd?.workingHoursStart || "09:00";
                                  const wEnd = cd?.workingHoursEnd || "17:00";
                                  const quota = cd?.dailyCallQuota ?? null;
                                  const callerId = campaign.callerIdNumber ?? null;
                                  return (
                                    <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                                      <div className="flex items-center gap-1">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                        <span className="text-[10px] font-medium text-muted-foreground">{wStart} – {wEnd}</span>
                                      </div>
                                      {callerId && (
                                        <div className="flex items-center gap-1">
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6.07 6.07l.96-.96a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                          <span className="text-[10px] font-medium text-muted-foreground">{callerId}</span>
                                        </div>
                                      )}
                                      {quota !== null && (
                                        <div className="flex items-center gap-1">
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                                          <span className="text-[10px] font-medium text-muted-foreground">
                                            {quota} {t.agentSession.calls}{t.agentSession.perDay}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Inbound fronty */}
                {myQueues.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.agentSession.inboundQueues}</span>
                      {selectedLoginQueueIds.length > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                          {selectedLoginQueueIds.length} {selectedLoginQueueIds.length === 1 ? t.agentSession.selectedOne : t.agentSession.selected}
                        </span>
                      )}
                    </div>
                    <ScrollArea className="max-h-44">
                      <div className="space-y-1.5 pr-1">
                        {myQueues.map((queue) => {
                          const isChecked = selectedLoginQueueIds.includes(queue.id);
                          const isAfterHours = (() => {
                            if (!queue.activeTo) return false;
                            const [h, m] = queue.activeTo.split(":").map(Number);
                            const endMin = h * 60 + m;
                            const now = new Date();
                            const nowMin = now.getHours() * 60 + now.getMinutes();
                            return nowMin >= endMin;
                          })();
                          const afterHoursLabel = (() => {
                            if (!isAfterHours || !queue.afterHoursAction) return null;
                            if (queue.afterHoursAction === "voicemail") return queue.afterHoursVoicemailBoxName ? `${t.agentSession.afterHoursVoicemail} → ${queue.afterHoursVoicemailBoxName}` : t.agentSession.afterHoursVoicemail;
                            if (queue.afterHoursAction === "hangup") return t.agentSession.afterHoursHangup;
                            if (queue.afterHoursAction === "transfer") return queue.afterHoursTarget ? `${t.agentSession.afterHoursTransfer} → ${queue.afterHoursTarget}` : t.agentSession.afterHoursTransfer;
                            if (queue.afterHoursAction === "queue") return queue.afterHoursTarget ? `${t.agentSession.afterHoursQueue} → ${queue.afterHoursTarget}` : t.agentSession.afterHoursOtherQueue;
                            return queue.afterHoursAction;
                          })();
                          return (
                            <div
                              key={queue.id}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
                              style={{
                                background: isChecked ? (isAfterHours ? "hsl(48 96% 53% / 0.12)" : "hsl(143 71% 52% / 0.08)") : "hsl(var(--card))",
                                border: `1px solid ${isChecked ? (isAfterHours ? "hsl(48 96% 53% / 0.5)" : "hsl(143 71% 52% / 0.5)") : "hsl(var(--border))"}`,
                              }}
                              onClick={() => setSelectedLoginQueueIds(prev => prev.includes(queue.id) ? prev.filter(id => id !== queue.id) : [...prev, queue.id])}
                              data-testid={`login-queue-${queue.id}`}
                            >
                              <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: isAfterHours ? "#D97706" : "#16A34A", minHeight: 28 }} />
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isChecked ? (isAfterHours ? "bg-amber-100 dark:bg-amber-950/40" : "bg-green-100 dark:bg-green-950/40") : (isAfterHours ? "bg-amber-50 dark:bg-amber-950/20" : "bg-green-50 dark:bg-green-950/20")}`}>
                                <PhoneIncoming className={`h-3.5 w-3.5 ${isAfterHours ? "text-amber-600" : "text-green-600"}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate text-foreground">{queue.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                                  {queue.activeFrom && queue.activeTo && <span>{queue.activeFrom} – {queue.activeTo}</span>}
                                  {queue.didNumber && <><span className="text-muted-foreground/50">·</span><span>{queue.didNumber}</span></>}
                                </div>
                                {isAfterHours && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400">
                                      {t.agentSession.afterHoursBadge}
                                    </span>
                                    {afterHoursLabel && (
                                      <span className="text-[10px] truncate text-amber-700 dark:text-amber-500">{afterHoursLabel}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {queue.waiting > 0 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">{queue.waiting} {t.agentSession.waiting}</span>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isAfterHours ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400" : "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"}`}>{queue.activeAgents} {t.agentSession.online}</span>
                                <div className="rounded flex items-center justify-center ml-0.5" style={{ width: 18, height: 18, background: isChecked ? (isAfterHours ? "#D97706" : "#16A34A") : "transparent", border: `2px solid ${isChecked ? (isAfterHours ? "#D97706" : "#16A34A") : "hsl(var(--border))"}` }}
                                     data-testid={`checkbox-login-queue-${queue.id}`}>
                                  {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* Fixná päta — upozornenie + prihlásenie */}
              <div className="px-4 pb-4 pt-3 shrink-0 border-t border-border bg-card/60">
                {(() => {
                  const parseHHMM = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
                  const now = new Date();
                  const nowMin = now.getHours() * 60 + now.getMinutes();
                  const WARN_THRESHOLD = 30;
                  const campWarnings = selectedLoginCampaignIds.flatMap(id => {
                    const cd = shiftData?.campaignData?.[id];
                    if (!cd?.workingHoursEnd) return [];
                    const endMin = parseHHMM(cd.workingHoursEnd);
                    const remaining = endMin - nowMin;
                    if (remaining < 0 || remaining >= WARN_THRESHOLD) return [];
                    return [{ name: loginCampaigns.find(c => c.id === id)?.name || id, remaining, endTime: cd.workingHoursEnd, kind: "mission" as const }];
                  });
                  const queueWarnings = selectedLoginQueueIds.flatMap(id => {
                    const q = myQueues.find(q => q.id === id);
                    if (!q?.activeTo) return [];
                    const endMin = parseHHMM(q.activeTo);
                    const remaining = endMin - nowMin;
                    if (remaining < 0 || remaining >= WARN_THRESHOLD) return [];
                    return [{ name: q.name, remaining, endTime: q.activeTo, kind: "inbound" as const }];
                  });
                  const allWarnings = [...campWarnings, ...queueWarnings];
                  if (allWarnings.length === 0) return null;
                  const minRemaining = Math.min(...allWarnings.map(w => w.remaining));
                  const names = allWarnings.map(w => w.name).join(", ");
                  return (
                    <div className="mb-3 rounded-xl px-3 py-2.5 flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="shift-end-warning">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">{t.agentSession.shiftEndingSoon}</p>
                        <p className="text-[11px] mt-0.5 leading-relaxed text-amber-700 dark:text-amber-500">
                          {t.agentSession.shiftEndingWarn} <span className="font-medium">{names}</span> {t.agentSession.shiftEndingRemains} <span className="font-semibold">{minRemaining}{t.agentSession.shiftEndingSuffix}</span>
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Back Office sekcia — len pre role s povoleným modulom "Back Office Agenda" */}
                {canBackOfficeAgenda && (
                <div
                  className={`rounded-xl px-3 py-2.5 mb-3 border cursor-pointer transition-all ${loginBackOffice ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}
                  onClick={() => setLoginBackOffice(v => !v)}
                  data-testid="login-back-office-toggle"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: loginBackOffice ? "hsl(var(--primary) / 0.10)" : "hsl(var(--muted))" }}>
                      <ClipboardList className="h-3.5 w-3.5" style={{ color: loginBackOffice ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{t.agentSession.backOfficeAgendaTitle}</p>
                      <p className="text-[10px] text-muted-foreground">{t.agentSession.backOfficeAgendaSubtitle}</p>
                    </div>
                    <div className="rounded flex items-center justify-center" style={{ width: 18, height: 18, background: loginBackOffice ? "hsl(var(--primary))" : "transparent", border: `2px solid ${loginBackOffice ? "hsl(var(--primary))" : "hsl(var(--border))"}` }}>
                      {loginBackOffice && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                  </div>
                  {loginBackOffice && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 pl-9">
                      ⚠ {t.agentSession.backOfficeModeWarning}
                    </p>
                  )}
                </div>
                )}

                <Button
                  className="w-full gap-2 h-11 font-semibold"
                  onClick={handleStartSession}
                  disabled={selectedLoginCampaignIds.length === 0 && selectedLoginQueueIds.length === 0 && !loginBackOffice}
                  data-testid="button-start-session"
                >
                  <Headphones className="h-4 w-4" />
                  {t.agentSession.startShift}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                {selectedLoginCampaignIds.length === 0 && selectedLoginQueueIds.length === 0 && !loginBackOffice && (
                  <p className="text-center text-[11px] mt-2 text-muted-foreground">{t.agentSession.selectAtLeastOne}</p>
                )}
              </div>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {!isMobile && (
      <TopBar
        status={agentSession.status}
        onStatusChange={handleStatusChange}
        stats={stats}
        quotas={quotas}
        isQuotaBlocked={isQuotaBlocked}
        workTime={agentSession.workTime}
        breakTypes={agentSession.breakTypes}
        activeBreakName={activeBreakName}
        activeBreakType={activeBreakTypeObj}
        breakTime={agentSession.breakTime}
        breakElapsedSeconds={agentSession.breakElapsedSeconds}
        onStartBreak={handleStartBreak}
        onEndBreak={handleEndBreak}
        isOnBreak={!!agentSession.activeBreak}
        onEndSession={handleEndSession}
        isSessionActive={agentSession.isSessionActive}
        t={t}
        onOpenScheduledQueue={() => setScheduledQueueOpen(true)}
        scheduledQueueCounts={scheduledQueueCounts}
        abandonedCallsCount={abandonedCalls.filter((c: any) => !c.calledBack).length}
        onOpenAbandonedCalls={() => setAbandonedCallsOpen(true)}
        onOpenMyActivity={() => setMyActivityOpen(true)}
        inboundRingtoneEnabled={inboundRingtoneEnabled}
        onToggleInboundRingtone={toggleInboundRingtone}
      />
      )}

      {/* ── Hlavné záložky: PULSE / BACK OFFICE ── */}
      {(() => {
        const hasMissions = sessionCampaignIds.length > 0 || sessionInboundQueueIds.length > 0;
        if (!agentSession.isSessionActive || !backOfficeModeActive || !canBackOfficeAgenda) return null;
        if (!hasMissions) return null;
        return (
          <div className="flex items-center gap-0 border-b bg-card shrink-0 px-4" style={{ minHeight: 36 }}>
            <button
              type="button"
              onClick={handleSwitchToPulse}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors relative ${
                mainWorkspaceTab === "pulse"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="main-tab-pulse"
            >
              {mainWorkspaceTab === "pulse" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm" style={{ background: "hsl(var(--primary))" }} />
              )}
              <Headphones className="h-3.5 w-3.5" />
              PULSE
            </button>
            <button
              type="button"
              onClick={handleSwitchToBackOffice}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors relative ${
                mainWorkspaceTab === "back_office"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="main-tab-back-office"
            >
              {mainWorkspaceTab === "back_office" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm" style={{ background: "hsl(var(--primary))" }} />
              )}
              <ClipboardList className="h-3.5 w-3.5" />
              BACK OFFICE
            </button>
          </div>
        );
      })()}

      {/* ── BACK OFFICE — celá obrazovka ── */}
      {agentSession.isSessionActive && backOfficeModeActive && canBackOfficeAgenda && mainWorkspaceTab === "back_office" && (
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          <BackOfficePanel
            country={((user as any)?.countries || []).join(",") || undefined}
            fullScreen
            hasInboundQueues={sessionInboundQueueIds.length > 0}
            allowInbound={allowInboundInBO}
            onToggleAllowInbound={handleToggleAllowInboundInBO}
          />
        </div>
      )}

      {/* ── PULSE — štandardné rozloženie ── */}
      <div className={`flex flex-1 overflow-hidden ${agentSession.isSessionActive && backOfficeModeActive && mainWorkspaceTab === "back_office" ? "hidden" : ""}`} style={{ minHeight: 0 }}>
        <div className={`flex flex-col h-full shrink-0 w-72${isMobile ? " hidden" : ""}`}>
          <BackOfficeQuestionsInbox />
          <div className="flex-1 min-h-0 flex">
        <TaskListPanel
          tasks={tasks}
          activeTaskId={activeTaskId}
          onSelectTask={handleSelectTask}
          campaigns={activeCampaigns}
          inboundQueues={myQueues.map(q => ({ id: q.id, name: q.name, didNumber: q.didNumber }))}
          sessionInboundQueueIds={sessionInboundQueueIds}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={(id: string) => { setSelectedCampaignId(id); setDisposedContactIds(new Set()); queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] }); queryClient.invalidateQueries({ queryKey: ["/api/user/assigned-campaigns"] }); }}
          showOnlyAssigned={showOnlyAssigned}
          onToggleAssigned={setShowOnlyAssigned}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
          onLoadNextContact={handleNextContact}
          isLoadingContact={false}
          campaignContacts={sortedPendingContacts}
          onSelectCampaignContact={handleSelectCampaignContact}
          currentUserId={user?.id}
          isAutoMode={isAutoMode}
          onToggleAutoMode={handleToggleAutoMode}
          autoCountdown={autoCountdown}
          onOpenContactsModal={() => { setModalFilter("all"); setModalSearch(""); setContactsModalOpen(true); }}
          onOpenTasksModal={() => setTasksModalOpen(true)}
          onCancelTask={handleCancelTask}
          agentStatus={agentSession.status}
          contactsDisabled={createFromCallType !== null}
          callContactId={callActiveContactId}
          callIsActive={["active", "on_hold", "connecting", "ringing"].includes(callContext.callState)}
          inboundCallbacks={agentInboundCallbacks}
          onMarkInboundCallbackDone={async (id) => {
            try {
              await apiRequest("PATCH", `/api/agent/inbound-callbacks/${id}`, { calledBack: true });
              queryClient.invalidateQueries({ queryKey: ["/api/agent/inbound-callbacks"] });
              queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
            } catch (e) {
              console.error("Failed to mark inbound callback done:", e);
            }
          }}
        />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>

        {/* ── MOBILE LAYOUT ─────────────────────────────────────── */}
        {isMobile && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <MobileAgentWorkspace
              contact={currentContact}
              campaign={selectedCampaign}
              campaignContacts={sortedPendingContacts}
              currentCampaignContactId={effectiveCampaignContactId}
              onSelectContact={(cc) => handleSelectCampaignContact(cc)}
              callState={callContext.callState}
              callDuration={callContext.callDuration}
              ringDuration={ringDuration}
              hungUpBy={callContext.callTiming.hungUpBy}
              isMuted={callContext.isMuted}
              isOnHold={callContext.isOnHold}
              callerNumber={callContext.callInfo?.phoneNumber || ""}
              onEndCall={() => callContext.endCallFn.current?.()}
              onToggleMute={() => callContext.toggleMuteFn.current?.()}
              onToggleHold={() => callContext.toggleHoldFn.current?.()}
              onSendDtmf={(digit) => callContext.sendDtmfFn.current?.(digit)}
              onMakeCall={handleMakeCall}
              isSipRegistered={isSipRegistered}
              sipIncomingCall={sipIncomingCall}
              onAnswerIncoming={answerIncomingCall}
              onRejectIncoming={rejectIncomingCall}
              onOpenDisposition={() => { setDispositionChannelFilter("phone"); setMandatoryDisposition(true); setDispositionModalOpen(true); }}
              isStatusListMode={isStatusListMode}
              dbStatusList={mobileDbStatusList}
              dbSlChecked={mobileDbSlChecked}
              onSlToggle={handleMobileSlToggle}
              agentStatus={agentSession.status}
              isOnBreak={!!agentSession.activeBreak}
              workTime={agentSession.workTime}
              breakTypes={agentSession.breakTypes}
              onEndSession={handleEndSession}
              onStartBreak={handleStartBreak}
              onEndBreak={handleEndBreak}
              contactType={currentContactType}
              onClearContact={() => {
                pendingCcIdRef.current = null;
                setCurrentCampaignContactId(null);
                setCurrentContact(null);
                agentSession.updateStatus("available").catch(() => {});
              }}
              onFullLogout={logout}
              t={t}
              locale={locale}
              currentUserId={user?.id}
              volume={callContext.volume}
              micVolume={callContext.micVolume}
              onVolumeChange={(vol) => callContext.onVolumeChangeFn.current?.(vol)}
              onMicVolumeChange={(vol) => callContext.onMicVolumeChangeFn.current?.(vol)}
            />
          </div>
        )}

        {!isMobile && isLoadingInboundContact && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6 select-none">
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-24 w-24 rounded-full opacity-30 animate-ping" style={{ background: "hsl(var(--primary))", animationDuration: "1.4s" }} />
                <span className="absolute inline-flex h-16 w-16 rounded-full opacity-20 animate-ping" style={{ background: "hsl(var(--primary))", animationDuration: "1.0s", animationDelay: "0.2s" }} />
                <div className="relative flex items-center justify-center h-14 w-14 rounded-full shadow-2xl" style={{ background: "hsl(var(--primary))" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 11.9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z" />
                  </svg>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>{t.agentWorkspace.inboundContactLoading}</p>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 3].map(i => (
                    <span
                      key={i}
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        background: "hsl(var(--primary))",
                        animation: "inboundDot 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.18}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isMobile && (() => {
          const parsedPhone = parseInboundPhone(pendingUnknownCaller?.phone || "");
          if (createFromCallType !== null) {
            /* ── Inline create form — shown in CENTER panel ── */
            return (
              <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden border-r">
                {createFromCallType === "customer" && (
                  <CustomerForm
                    initialData={{ phone: buildE164Phone(parsedPhone.countryCode, parsedPhone.localPhone), country: parsedPhone.countryCode } as any}
                    isLoading={createIsLoading}
                    onSubmit={async (data) => {
                      setCreateIsLoading(true);
                      try {
                        const res = await apiRequest("POST", "/api/customers", data);
                        const created = await res.json();
                        queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
                        setCreateFromCallType(null);
                        setPendingUnknownCaller(null);
                        if (created?.id) {
                          const custRes = await fetch(`/api/customers/${created.id}`, { credentials: "include" });
                          if (custRes.ok) setCurrentContact(await custRes.json());
                        }
                        // Open disposition only if call already ended; otherwise let the call-end handler do it
                        if (!isStatusListMode && !["connecting", "ringing", "active", "on_hold"].includes(callContext.callState)) {
                          setDispositionChannelFilter("phone");
                          setMandatoryDisposition(true);
                          setDispositionModalOpen(true);
                        }
                      } catch (e: any) {
                        toast({ title: "Chyba", description: e?.message || "Zákazníka sa nepodarilo vytvoriť", variant: "destructive" });
                      } finally {
                        setCreateIsLoading(false);
                      }
                    }}
                    useCardLayout
                  />
                )}
                {createFromCallType === "hospital" && (
                  <HospitalFormWizard
                    mode="inline"
                    prefillData={{ countryCode: parsedPhone.countryCode }}
                    onSuccess={() => {
                      setCreateFromCallType(null);
                      setPendingUnknownCaller(null);
                      queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
                      if (!isStatusListMode && !["connecting", "ringing", "active", "on_hold"].includes(callContext.callState)) {
                        setDispositionChannelFilter("phone");
                        setMandatoryDisposition(true);
                        setDispositionModalOpen(true);
                      }
                    }}
                  />
                )}
                {createFromCallType === "clinic" && (
                  <ClinicFormSheet
                    open={true}
                    onOpenChange={(open) => { if (!open) setCreateFromCallType(null); }}
                    prefillData={{ phone: buildE164Phone(parsedPhone.countryCode, parsedPhone.localPhone), countryCode: parsedPhone.countryCode }}
                    mode="inline"
                    onSuccess={() => {
                      setCreateFromCallType(null);
                      setPendingUnknownCaller(null);
                      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
                      if (!isStatusListMode && !["connecting", "ringing", "active", "on_hold"].includes(callContext.callState)) {
                        setDispositionChannelFilter("phone");
                        setMandatoryDisposition(true);
                        setDispositionModalOpen(true);
                      }
                    }}
                  />
                )}
                {createFromCallType === "person" && (
                  <CollaboratorFormWizard
                    mode="inline"
                    prefillData={{ phone: buildE164Phone(parsedPhone.countryCode, parsedPhone.localPhone), countryCode: parsedPhone.countryCode, countryCodes: parsedPhone.countryCode ? [parsedPhone.countryCode] : [] }}
                    onSuccess={() => {
                      setCreateFromCallType(null);
                      setPendingUnknownCaller(null);
                      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
                      if (!isStatusListMode && !["connecting", "ringing", "active", "on_hold"].includes(callContext.callState)) {
                        setDispositionChannelFilter("phone");
                        setMandatoryDisposition(true);
                        setDispositionModalOpen(true);
                      }
                    }}
                  />
                )}
              </div>
            );
          }
          return (
            <CommunicationCanvas
              contact={currentContact}
              campaign={selectedCampaign}
              activeChannel={activeChannel}
              onChannelChange={setActiveChannel}
              timeline={timeline}
              onSendEmail={handleSendEmail}
              onSendSms={handleSendSms}
              isSendingEmail={sendEmailMutation.isPending}
              isSendingSms={sendSmsMutation.isPending}
              onMakeCall={handleMakeCall}
              isSipRegistered={isSipRegistered}
              onOpenScriptModal={() => setScriptModalOpen(true)}
              onUpdateContact={(data) => updateContactMutation.mutate(data)}
              isUpdatingContact={updateContactMutation.isPending}
              externalPhoneSubTab={phoneSubTabOverride}
              callState={callContext.callState}
              callDuration={callContext.callDuration}
              ringDuration={ringDuration}
              hungUpBy={callContext.callTiming.hungUpBy}
              isMuted={callContext.isMuted}
              isOnHold={callContext.isOnHold}
              volume={callContext.volume}
              micVolume={callContext.micVolume}
              onEndCall={() => callContext.endCallFn.current?.()}
              onOpenDisposition={() => { setDispositionChannelFilter(null); setDispositionModalOpen(true); }}
              onToggleMute={() => callContext.toggleMuteFn.current?.()}
              onToggleHold={() => callContext.toggleHoldFn.current?.()}
              onSendDtmf={(digit) => callContext.sendDtmfFn.current?.(digit)}
              onVolumeChange={(vol) => callContext.onVolumeChangeFn.current?.(vol)}
              onMicVolumeChange={(vol) => callContext.onMicVolumeChangeFn.current?.(vol)}
              callerNumber={callContext.callInfo?.phoneNumber || ""}
              contactHistory={contactHistory}
              onOpenHistoryDetail={(entry) => setHistoryDetailModal(entry)}
              onCreateContract={handleOpenContractWizard}
              contactType={currentContactType}
              hospitalData={currentHospitalData}
              clinicData={currentClinicData}
              collaboratorData={currentCollaboratorData}
              campaignContactId={effectiveCampaignContactId}
              initialScriptStepId={currentCampaignContact?.currentScriptStepId || null}
              pendingEmailTemplateId={pendingEmailTemplateId}
              onPendingEmailTemplateHandled={() => setPendingEmailTemplateId(null)}
              backOfficeModeActive={backOfficeModeActive}
              contactCountry={currentContact?.country || null}
              ccCallbackNote={currentCampaignContact?.callbackNote ?? null}
              ccCallbackStatusListItemId={currentCampaignContact?.callbackStatusListItemId ?? null}
              onCloseCallAfterStatusList={handleCloseCallAfterStatusList}
              phoneOverride={currentPhoneOverride}
              onPhoneOverrideChange={setCurrentPhoneOverride}
              customerMessages={customerMessages}
              campaignEmailMode={campaignEmailMode}
              campaignEmailAddress={campaignEmailAddress}
              onClearContact={() => {
                pendingCcIdRef.current = null;
                setCurrentCampaignContactId(null);
                setCurrentContact(null);
              }}
              onScriptAction={(action, data) => {
                if (action === "openEmail") {
                  setActiveChannel("email");
                  if (data?.emailTemplateId) {
                    setPendingEmailTemplateId(data.emailTemplateId);
                  }
                } else if (action === "openPhone" || action === "makeCall") {
                  setActiveChannel("phone");
                } else if (action === "openDisposition") {
                  setDispositionChannelFilter(null);
                  setDispositionModalOpen(true);
                } else if (action === "openEmailDisposition") {
                  setDispositionChannelFilter("email");
                  setDispositionModalOpen(true);
                } else if (action === "openPhoneDisposition") {
                  setDispositionChannelFilter("phone");
                  setDispositionModalOpen(true);
                } else if (action === "scheduleCallbackOnly" && data?.dispositionCode) {
                  try {
                    const disp = campaignDispositions.find((d: any) => d.code === data.dispositionCode);
                    const parentDisp = disp?.parentId ? campaignDispositions.find((d: any) => d.id === disp.parentId) : undefined;
                    if (disp?.callbackOffsetDays && currentCampaignContactId && selectedCampaignId) {
                      const cbDate = addBusinessDays(new Date(), disp.callbackOffsetDays);
                      cbDate.setHours(9, 0, 0, 0);
                      apiRequest("PATCH", `/api/campaigns/${selectedCampaignId}/contacts/${currentCampaignContactId}`, {
                        status: "callback_scheduled",
                        callbackDate: cbDate.toISOString(),
                        dispositionCode: data.dispositionCode,
                        assignedTo: user?.id || null,
                        lastAttemptAt: new Date().toISOString(),
                      }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", selectedCampaignId, "contacts"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/agent/callbacks"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
                        toast({ title: t.agentWorkspace.contactFinished, description: `Callback: ${cbDate.toLocaleDateString()}` });
                      }).catch(() => {});
                    }
                  } catch {}
                } else if (action === "setDisposition" && data?.dispositionCode) {
                  try {
                    const disp = campaignDispositions.find((d: any) => d.code === data.dispositionCode);
                    const parentDisp = disp?.parentId ? campaignDispositions.find((d: any) => d.id === disp.parentId) : undefined;
                    const isCallbackType = disp?.actionType === "callback" || disp?.actionType === "schedule_email" || disp?.actionType === "schedule_sms"
                      || parentDisp?.actionType === "callback" || parentDisp?.actionType === "schedule_email" || parentDisp?.actionType === "schedule_sms";
                    if (isCallbackType) {
                      if (disp?.callbackOffsetDays) {
                        const cbDate = addBusinessDays(new Date(), disp.callbackOffsetDays);
                        cbDate.setHours(9, 0, 0, 0);
                        handleDisposition(data.dispositionCode, parentDisp?.code, cbDate.toISOString(), user?.id || null);
                      } else {
                        setModalSelectedParent(parentDisp?.id || disp?.id || null);
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setModalCallbackDate(tomorrow.toISOString().split("T")[0]);
                        setModalCallbackTime("09:00");
                        setDispositionChannelFilter(null);
                        setDispositionModalOpen(true);
                      }
                    } else {
                      handleDisposition(data.dispositionCode, parentDisp?.code);
                    }
                  } catch {}
                }
              }}
            />
          );
        })()}

        {!isMobile && (
          <CustomerInfoPanel
            contact={currentContact}
            contactType={currentContactType}
            campaign={selectedCampaign}
            callNotes={callNotes}
            onAddNote={handleAddNote}
            onDisposition={handleDisposition}
            onQuickAction={handleQuickAction}
            rightTab={rightTab}
            onRightTabChange={setRightTab}
            contactHistory={contactHistory}
            dispositions={campaignDispositions}
            currentUserId={user?.id}
            onOpenDispositionModal={() => { setDispositionChannelFilter(null); setDispositionModalOpen(true); }}
            callState={callContext.callState}
            callDuration={callContext.callDuration}
            ringDuration={ringDuration}
            hungUpBy={callContext.callTiming.hungUpBy}
            onEndCall={() => callContext.endCallFn.current?.()}
            onOpenDispositionFromCall={() => { if (isStatusListMode) return; setDispositionChannelFilter("phone"); setMandatoryDisposition(true); setDispositionModalOpen(true); }}
            isMuted={callContext.isMuted}
            isOnHold={callContext.isOnHold}
            volume={callContext.volume}
            micVolume={callContext.micVolume}
            onToggleMute={() => callContext.toggleMuteFn.current?.()}
            onToggleHold={() => callContext.toggleHoldFn.current?.()}
            onSendDtmf={(digit) => callContext.sendDtmfFn.current?.(digit)}
            onVolumeChange={(vol) => callContext.onVolumeChangeFn.current?.(vol)}
            onMicVolumeChange={(vol) => callContext.onMicVolumeChangeFn.current?.(vol)}
            callerNumber={callContext.callInfo?.phoneNumber || ""}
            onEditCustomer={() => { setActiveChannel("phone"); setPhoneSubTabOverride("card"); setTimeout(() => setPhoneSubTabOverride(null), 100); }}
            onViewCustomer={() => { setActiveChannel("phone"); setPhoneSubTabOverride("details"); setTimeout(() => setPhoneSubTabOverride(null), 100); }}
            onOpenHistoryDetail={(entry) => setHistoryDetailModal(entry)}
            wrapUpElapsed={wrapUpElapsed}
            inboundMatches={inboundPhoneMatches}
            onSelectMatch={handleSelectInboundMatch}
            unknownCallerPhone={pendingUnknownCaller?.phone}
            onCreateFromCall={(type) => setCreateFromCallType(type)}
            forwardedCallActive={forwardedCallActive}
            onOpenDispositionFromForwardedCall={() => { setDispositionChannelFilter("phone"); setMandatoryDisposition(true); setDispositionModalOpen(true); }}
            onEndForwardedCall={() => { setForwardedCallActive(null); setDispositionChannelFilter("phone"); setMandatoryDisposition(true); setDispositionModalOpen(true); }}
            acwStartedAt={acwStartedAt}
            onCloseAcwTask={handleCloseAcwTask}
            onCloseCallAfterStatusList={handleCloseCallAfterStatusList}
            phoneOverride={currentPhoneOverride}
            onPhoneOverrideChange={setCurrentPhoneOverride}
            isStatusListMode={isStatusListMode}
            campaignContactId={effectiveCampaignContactId}
          />
        )}
        </div>{/* end center+right relative wrapper */}
      </div>

      <Dialog open={contactsModalOpen} onOpenChange={setContactsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col overflow-hidden p-0 gap-0">
          {/* S&T Header */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: "#B5622E18" }}>
              <Users className="h-5 w-5" style={{ color: "#B5622E" }} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight">{t.agentWorkspace.campaignContacts}</DialogTitle>
              {selectedCampaign && (
                <p className="text-xs mt-0.5 font-medium truncate" style={{ color: "#9A8878" }}>{selectedCampaign.name}</p>
              )}
            </div>
          </div>

          {/* S&T Search + filter area */}
          <div className="px-6 pt-3 pb-3 border-b shrink-0 space-y-2.5">
            {/* Search bar + field picker + sort */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder={modalSearchField === "all"
                    ? "Hľadať meno, telefón, email, mesto…"
                    : `Hľadať podľa: ${({"name":"Meno","phone":"Telefón","email":"Email","city":"Mesto","address":"Adresa","zip":"PSČ","ico":"IČO"})[modalSearchField] || "všetky polia"}`}
                  value={modalSearch}
                  onChange={(e) => { setModalSearch(e.target.value); setShowSearchSuggestions(true); }}
                  onFocus={() => modalSearch && setShowSearchSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 180)}
                  className="w-full h-9 pl-9 pr-8 rounded-xl border bg-background text-sm focus:outline-none transition-colors"
                  style={{ borderColor: modalSearch ? "#B5622E" : undefined }}
                  data-testid="input-modal-search"
                />
                {modalSearch && (
                  <button onClick={() => { setModalSearch(""); setShowSearchSuggestions(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {/* Autocomplete suggestions dropdown */}
                {showSearchSuggestions && modalSearchField !== "all" && modalSearch.trim() && (() => {
                  const q = modalSearch.trim().toLowerCase().replace(/\s/g,"");
                  const extractField = (cc: any): string[] => {
                    switch (modalSearchField) {
                      case "name": return [(getEntityDisplayInfo(cc)?.name || "")].filter(Boolean);
                      case "phone": return [cc.customer?.phone, cc.customer?.mobile, cc.hospital?.phone, cc.clinic?.phone, cc.collaborator?.phone, cc.collaborator?.mobile].filter(Boolean);
                      case "email": return [cc.customer?.email, cc.hospital?.email, cc.clinic?.email, cc.collaborator?.email].filter(Boolean);
                      case "city": return [cc.customer?.city, cc.hospital?.city, cc.clinic?.city, cc.collaborator?.city].filter(Boolean);
                      case "address": return [cc.customer?.address, cc.hospital?.address, cc.clinic?.address].filter(Boolean);
                      case "zip": return [cc.customer?.zip, cc.hospital?.zip, cc.clinic?.zip].filter(Boolean);
                      case "region": return [cc.customer?.region, cc.hospital?.region, cc.clinic?.region, cc.collaborator?.region].filter(Boolean);
                      case "district": return [cc.customer?.district, cc.hospital?.district, cc.clinic?.district, cc.collaborator?.district].filter(Boolean);
                      case "country": return [cc.customer?.country, cc.hospital?.countryCode, cc.clinic?.countryCode, cc.collaborator?.countryCode].filter(Boolean);
                      case "ico": return [cc.hospital?.ico, cc.clinic?.ico].filter(Boolean);
                      default: return [];
                    }
                  };
                  const seen = new Set<string>();
                  const suggestions: { value: string; contactName: string }[] = [];
                  rawCampaignContacts.forEach(cc => {
                    const vals = extractField(cc);
                    const name = getEntityDisplayInfo(cc)?.name || "";
                    vals.forEach(v => {
                      const vNorm = String(v).replace(/\s/g,"").toLowerCase();
                      if (vNorm.includes(q) && !seen.has(String(v))) {
                        seen.add(String(v));
                        suggestions.push({ value: String(v), contactName: name });
                      }
                    });
                  });
                  suggestions.sort((a, b) => a.value.localeCompare(b.value, "sk"));
                  if (suggestions.length === 0) return null;
                  return (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-2xl z-[200] max-h-52 overflow-y-auto">
                      <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {({"name":t.agentWorkspace.fieldPickerName,"phone":t.agentWorkspace.fieldPickerPhone,"email":t.agentWorkspace.fieldPickerEmail,"city":t.agentWorkspace.fieldPickerCity,"address":t.agentWorkspace.fieldPickerAddress,"zip":t.agentWorkspace.fieldPickerZip,"ico":t.agentWorkspace.fieldPickerIco})[modalSearchField]}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">— {suggestions.length} {t.agentWorkspace.resultsCount}</span>
                      </div>
                      {suggestions.slice(0, 15).map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); setModalSearch(s.value); setShowSearchSuggestions(false); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-between gap-2"
                        >
                          <span className="font-medium truncate">{s.value}</span>
                          {modalSearchField !== "name" && s.contactName && (
                            <span className="text-muted-foreground/60 text-[10px] truncate max-w-[130px] shrink-0">{s.contactName}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              {/* Field picker */}
              <div className="relative">
                <button
                  onClick={() => setShowModalFieldPicker(v => !v)}
                  className="h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  style={modalSearchField !== "all" ? { background: "#B5622E", color: "#fff", borderColor: "#B5622E" } : {}}
                  data-testid="btn-modal-field-picker"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {({"all":t.agentWorkspace.fieldPickerAll,"name":t.agentWorkspace.fieldPickerName,"phone":t.agentWorkspace.fieldPickerPhone,"email":t.agentWorkspace.fieldPickerEmail,"city":t.agentWorkspace.fieldPickerCity,"address":t.agentWorkspace.fieldPickerAddress,"zip":t.agentWorkspace.fieldPickerZip,"region":t.agentWorkspace.fieldPickerRegion,"district":t.agentWorkspace.fieldPickerDistrict,"country":t.agentWorkspace.fieldPickerCountry,"ico":t.agentWorkspace.fieldPickerIco})[modalSearchField] ?? t.agentWorkspace.fieldPickerAll}
                </button>
                {showModalFieldPicker && (
                  <div className="absolute right-0 top-10 z-50 bg-background border rounded-xl shadow-xl py-1 w-40">
                    {([[  "all",t.agentWorkspace.fieldPickerAllFields],["name",t.agentWorkspace.fieldPickerName],["phone",t.agentWorkspace.fieldPickerPhone],["email",t.agentWorkspace.fieldPickerEmail],["city",t.agentWorkspace.fieldPickerCity],["address",t.agentWorkspace.fieldPickerAddress],["zip",t.agentWorkspace.fieldPickerZip],["region",t.agentWorkspace.fieldPickerRegion],["district",t.agentWorkspace.fieldPickerDistrict],["country",t.agentWorkspace.fieldPickerCountry],["ico",t.agentWorkspace.fieldPickerIco]] as [string,string][]).map(([val, lbl]) => (
                      <button key={val} onClick={() => { setModalSearchField(val); setShowModalFieldPicker(false); setModalSearch(""); setShowSearchSuggestions(false); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center justify-between"
                        style={modalSearchField === val ? { color: "#B5622E", fontWeight: 700 } : {}}>
                        {lbl}
                        {modalSearchField === val && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#B5622E" }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Sort */}
              <Select value={modalSort} onValueChange={(v) => setModalSort(v as typeof modalSort)}>
                <SelectTrigger className="h-9 text-xs w-[150px]" data-testid="select-modal-sort">
                  <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="callback_asc">{t.agentWorkspace.sortCallbackAsc}</SelectItem>
                  <SelectItem value="name_asc">{t.agentWorkspace.sortNameAsc}</SelectItem>
                  <SelectItem value="attempts_desc">{t.agentWorkspace.sortAttemptsDesc}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Filter tabs */}
            <div className="flex gap-1.5">
              {([
                { key: "all", label: t.agentWorkspace.filterAll },
                { key: "due", label: t.agentWorkspace.filterDue },
                { key: "my_callbacks", label: t.agentWorkspace.filterMyCB },
                { key: "team_callbacks", label: t.agentWorkspace.filterTeamCB },
                { key: "pending", label: t.agentWorkspace.filterPending },
              ] as const).map(tab => (
                <button key={tab.key}
                  onClick={() => setModalFilter(tab.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                  style={modalFilter === tab.key
                    ? { background: "#B5622E", color: "#fff" }
                    : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                  data-testid={`btn-modal-filter-${tab.key}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6">
            {(() => {
              const now = new Date();
              const isCbM = (cc: typeof sortedPendingContacts[0]) => cc.status === "callback_scheduled";
              const isDueM = (cc: typeof sortedPendingContacts[0]) => !!(cc.callbackDate && new Date(cc.callbackDate) <= now);
              const isMineM = (cc: typeof sortedPendingContacts[0]) => cc.assignedTo === user?.id;
              const isTeamM = (cc: typeof sortedPendingContacts[0]) => !cc.assignedTo;
              const sortByDateM = (a: typeof sortedPendingContacts[0], b: typeof sortedPendingContacts[0]) => {
                const aDate = a.callbackDate ? new Date(a.callbackDate).getTime() : Infinity;
                const bDate = b.callbackDate ? new Date(b.callbackDate).getTime() : Infinity;
                return aDate - bDate;
              };

              const modalCtConfig: Record<string, { icon: typeof User; textColor: string }> = {
                hospital: { icon: Building2, textColor: "#C0392B" },
                clinic: { icon: Stethoscope, textColor: "#27AE60" },
                collaborator: { icon: Handshake, textColor: "#E67E22" },
                customer: { icon: User, textColor: "#2980B9" },
              };

              const renderModalCard = (cc: typeof sortedPendingContacts[0], ac: string) => {
                const entityInfo = getEntityDisplayInfo(cc);
                if (!entityInfo) return null;
                const callbackDateStr = cc.callbackDate ? format(new Date(cc.callbackDate), "dd.MM.yyyy HH:mm") : null;
                const mCfg = modalCtConfig[entityInfo.type] || modalCtConfig.customer;
                const MIcon = mCfg.icon;
                return (
                  <div
                    key={cc.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-150"
                    style={{
                      background: "hsl(var(--card))",
                      border: `1px solid ${ac}25`,
                      borderRadius: "12px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = `${ac}60`;
                      el.style.boxShadow = `0 4px 12px ${ac}20`;
                      el.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = `${ac}25`;
                      el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
                      el.style.transform = "";
                    }}
                    onClick={() => { handleSelectCampaignContact(cc); setContactsModalOpen(false); }}
                    data-testid={`modal-contact-${cc.id}`}
                  >
                    <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${ac}18` }}>
                      <MIcon className="h-4 w-4" style={{ color: ac }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">{entityInfo.name}</p>
                      <p className="text-xs truncate text-muted-foreground">{entityInfo.subtitle}</p>
                      {cc.callbackNote && (
                        <p className="text-[10px] mt-0.5 truncate italic" style={{ color: "#B08060" }} title={cc.callbackNote}>📝 {cc.callbackNote}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* Disposition badge — show for all disposed contacts */}
                      {cc.dispositionCode && cc.status !== "pending" && cc.status !== "callback_scheduled" && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full truncate max-w-[110px] text-center"
                          style={{ background: `${cc.dispositionColor || "#888"}22`, color: cc.dispositionColor || "#888", border: `1px solid ${cc.dispositionColor || "#888"}44` }}
                          title={cc.dispositionName || cc.dispositionCode}
                        >
                          {cc.dispositionName || cc.dispositionCode}
                        </span>
                      )}
                      {!cc.dispositionCode && cc.status !== "pending" && cc.status !== "callback_scheduled" && (() => {
                        const statusCfg: Record<string, { label: string; color: string; icon: JSX.Element }> = {
                          sms_sent:      { label: "SMS", color: "#0ea5e9", icon: <MessageSquare className="h-2.5 w-2.5" /> },
                          email_sent:    { label: "Email", color: "#c2673a", icon: <Mail className="h-2.5 w-2.5" /> },
                          called:        { label: "Volané", color: "#22c55e", icon: <Phone className="h-2.5 w-2.5" /> },
                          voicemail:     { label: "Voicemail", color: "#8b5cf6", icon: <Mic className="h-2.5 w-2.5" /> },
                          completed:     { label: t.agentWorkspace.statusCompleted, color: "#22c55e", icon: <CheckCircle className="h-2.5 w-2.5" /> },
                          not_interested:{ label: t.agentWorkspace.statusNotInterested, color: "#f59e0b", icon: <XCircle className="h-2.5 w-2.5" /> },
                          failed:        { label: t.agentWorkspace.statusFailed, color: "#ef4444", icon: <XCircle className="h-2.5 w-2.5" /> },
                        };
                        const cfg = statusCfg[cc.status];
                        const color = cfg?.color || "#888";
                        return (
                          <span
                            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: `${color}20`, color, border: `1px solid ${color}45` }}
                          >
                            {cfg?.icon}
                            {cfg?.label || cc.status}
                          </span>
                        );
                      })()}
                      <div className="flex items-center gap-1.5">
                        {callbackDateStr && (
                          <span className="text-[10px] flex items-center gap-0.5 font-medium" style={{ color: ac }}>
                            <Calendar className="h-3 w-3" />{callbackDateStr}
                          </span>
                        )}
                        {cc.attemptCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ac}18`, color: ac }}>{cc.attemptCount}x</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };

              // Grouped view when no search/filter active
              if (modalFilter === "all" && !modalSearch) {
                const groups = [
                  { id: "due", label: t.agentWorkspace.groupDue, ac: "#B5622E", Icon: PhoneCall, items: [...sortedPendingContacts.filter(cc => isCbM(cc) && isDueM(cc))].sort(sortByDateM) },
                  { id: "my-cb", label: t.agentWorkspace.groupMyCb, ac: "#5B4FCF", Icon: Clock, items: sortedPendingContacts.filter(cc => isCbM(cc) && isMineM(cc) && !isDueM(cc)).sort(sortByDateM) },
                  { id: "team-cb", label: t.agentWorkspace.groupTeamCb, ac: "#2E75B6", Icon: Users, items: sortedPendingContacts.filter(cc => isCbM(cc) && isTeamM(cc) && !isDueM(cc)).sort(sortByDateM) },
                  { id: "other-cb", label: t.agentWorkspace.groupOtherCb, ac: "#7A6858", Icon: User, items: sortedPendingContacts.filter(cc => isCbM(cc) && cc.assignedTo && !isMineM(cc) && !isDueM(cc)).sort(sortByDateM) },
                  { id: "pending", label: t.agentWorkspace.groupPending, ac: "#5A7A5A", Icon: Users, items: sortedPendingContacts.filter(cc => cc.status === "pending") },
                ].filter(g => g.items.length > 0);

                if (groups.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Users className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                      <p className="text-sm text-muted-foreground">{t.agentWorkspace.noContacts}</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 py-3">
                    {groups.map(({ id, label, ac, Icon, items }) => {
                      const isOpen = modalExpandedGroups.has(id);
                      return (
                        <div
                          key={id}
                          className="rounded-2xl overflow-hidden"
                          style={{ background: "hsl(var(--card))", border: `1.5px solid ${ac}40`, boxShadow: `0 2px 10px ${ac}15` }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleModalGroup(id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
                            style={{ background: isOpen ? `${ac}14` : `${ac}08`, borderBottom: isOpen ? `1px solid ${ac}30` : "none" }}
                          >
                            <div className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: ac, boxShadow: `0 2px 8px ${ac}50` }}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-foreground">{label}</div>
                              <div className="text-xs mt-0.5 text-muted-foreground">{nContacts(items.length)}</div>
                            </div>
                            <span className="text-sm font-bold min-w-[30px] h-7 flex items-center justify-center rounded-full px-2 shrink-0" style={{ background: ac, color: "#fff" }}>
                              {items.length}
                            </span>
                            {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: ac }} /> : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: ac }} />}
                          </button>
                          {isOpen && (
                            <div className="p-3 space-y-2" style={{ background: "hsl(var(--card))" }}>
                              {items.map(cc => renderModalCard(cc, ac))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // Flat filtered view — search ALL contacts (not just pending) so disposed contacts are still findable
              const searchPool = modalSearch ? rawCampaignContacts : sortedPendingContacts;
              let filtered = searchPool.filter(cc => {
                const entityInfo = getEntityDisplayInfo(cc);
                if (!entityInfo) return false;
                if (modalSearch) {
                  const q = modalSearch.toLowerCase();
                  const ql = q.replace(/\s/g, "");
                  const fieldChecks: Record<string, boolean> = {
                    name:    (entityInfo?.name || "").toLowerCase().includes(q),
                    phone:   [(cc.customer?.phone||""),(cc.customer?.mobile||""),(cc.hospital?.phone||""),(cc.clinic?.phone||""),(cc.collaborator?.phone||""),(cc.collaborator?.mobile||""),(entityInfo?.subtitle||"")].some(p => p.replace(/\s/g,"").includes(ql)),
                    email:   (cc.customer?.email||cc.hospital?.email||cc.clinic?.email||cc.collaborator?.email||"").toLowerCase().includes(q),
                    city:    (cc.customer?.city||cc.hospital?.city||cc.clinic?.city||cc.collaborator?.city||"").toLowerCase().includes(q),
                    address: (cc.customer?.address||cc.hospital?.address||cc.clinic?.address||"").toLowerCase().includes(q),
                    zip:      (cc.customer?.zip||cc.hospital?.zip||cc.clinic?.zip||"").toLowerCase().includes(q),
                    region:   [cc.customer?.region,cc.hospital?.region,cc.clinic?.region,cc.collaborator?.region].filter(Boolean).join(" ").toLowerCase().includes(q),
                    district: [cc.customer?.district,cc.hospital?.district,cc.clinic?.district,cc.collaborator?.district].filter(Boolean).join(" ").toLowerCase().includes(q),
                    country:  [cc.customer?.country,cc.hospital?.countryCode,cc.clinic?.countryCode,cc.collaborator?.countryCode].filter(Boolean).join(" ").toLowerCase().includes(q),
                    ico:      (cc.hospital?.ico||cc.clinic?.ico||"").toLowerCase().includes(q),
                  };
                  const matches = modalSearchField === "all"
                    ? Object.values(fieldChecks).some(Boolean)
                    : (fieldChecks[modalSearchField] ?? false);
                  if (!matches) return false;
                }
                switch (modalFilter) {
                  case "my_callbacks": return isCbM(cc) && isMineM(cc);
                  case "team_callbacks": return isCbM(cc) && isTeamM(cc);
                  case "due": return isCbM(cc) && isDueM(cc);
                  case "pending": return cc.status === "pending";
                  default: return true;
                }
              });

              filtered = [...filtered].sort((a, b) => {
                switch (modalSort) {
                  case "callback_asc": return (a.callbackDate ? new Date(a.callbackDate).getTime() : Infinity) - (b.callbackDate ? new Date(b.callbackDate).getTime() : Infinity);
                  case "name_asc": return (getEntityDisplayInfo(a)?.name || "").localeCompare(getEntityDisplayInfo(b)?.name || "", "sk");
                  case "attempts_desc": return (b.attemptCount || 0) - (a.attemptCount || 0);
                  default: return 0;
                }
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-12">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground">{t.agentWorkspace.noContactsFiltered}</p>
                  </div>
                );
              }

              const flatAc = modalFilter === "due" ? "#B5622E" : modalFilter === "my_callbacks" ? "#5B4FCF" : modalFilter === "team_callbacks" ? "#2E75B6" : modalFilter === "pending" ? "#5A7A5A" : "#7A6858";
              return (
                <div className="space-y-2 py-3">
                  <div className="text-xs px-1 pb-1 font-medium text-muted-foreground">
                    {nContacts(filtered.length)}
                  </div>
                  {filtered.map(cc => renderModalCard(cc, flatAc))}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={tasksModalOpen} onOpenChange={setTasksModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              {t.agentWorkspace.activeTasks}
              <Badge variant="secondary" className="ml-2">{tasks.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6 overflow-hidden">
            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Žiadne aktívne úlohy</p>
              </div>
            ) : (
              <div className="space-y-3 py-3">
                {tasks.map((task) => {
                  const chConfig = CHANNEL_CONFIG[task.channel];
                  const ChIcon = chConfig.icon;
                  const isActive = activeTaskId === task.id;
                  const _mCallIsActive = ["active", "on_hold", "connecting", "ringing"].includes(callContext.callState);
                  const isOnCall = !!(_mCallIsActive && currentContact?.id && task.contact.id === currentContact.id);
                  const elapsed = Math.floor((Date.now() - task.startedAt.getTime()) / 1000);
                  const mins = Math.floor(elapsed / 60);
                  const secs = elapsed % 60;
                  const taskAc = task.channel === "phone" ? "#B5622E" : task.channel === "email" ? "#5B4FCF" : task.channel === "sms" ? "#2E75B6" : "#5A7A5A";
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-150"
                      style={{
                        background: isActive ? `${taskAc}10` : "hsl(var(--card))",
                        border: `1.5px solid ${isActive ? taskAc : taskAc + "35"}`,
                        borderRadius: "16px",
                        boxShadow: isActive ? `0 4px 16px ${taskAc}25` : "0 2px 8px rgba(0,0,0,0.06)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          const el = e.currentTarget as HTMLElement;
                          el.style.borderColor = `${taskAc}70`;
                          el.style.boxShadow = `0 6px 20px ${taskAc}20`;
                          el.style.transform = "translateY(-1px)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          const el = e.currentTarget as HTMLElement;
                          el.style.borderColor = `${taskAc}35`;
                          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                          el.style.transform = "";
                        }
                      }}
                      onClick={() => { handleSelectTask(task); setTasksModalOpen(false); }}
                      data-testid={`modal-task-${task.id}`}
                    >
                      <div
                        className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 relative"
                        style={{ background: taskAc, boxShadow: `0 3px 10px ${taskAc}50` }}
                      >
                        <ChIcon className="h-5 w-5 text-white" />
                        {task.status === "active" && (
                          <span className={`absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white animate-pulse ${isOnCall ? "bg-red-500" : "bg-green-500"}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-foreground">{task.contact.firstName} {task.contact.lastName}</p>
                        <p className="text-xs truncate mt-0.5 text-muted-foreground">{task.campaignName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-xs font-mono font-bold px-2.5 py-1 rounded-full"
                          style={{ background: `${taskAc}18`, color: taskAc }}
                        >
                          {mins}:{secs.toString().padStart(2, "0")}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-xl hover:bg-red-50 hover:text-red-500 text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); handleCancelTask(task.id); }}
                          data-testid={`btn-modal-cancel-task-${task.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Sheet open={dispositionModalOpen} onOpenChange={(open) => { if (!open && mandatoryDisposition) return; if (open && !dispositionOpenedAt) setDispositionOpenedAt(Date.now()); setDispositionModalOpen(open); if (!open) { setModalSelectedParent(null); setModalCallbackDate(""); setModalCallbackTime("09:00"); setModalCallbackAssign("me"); setModalCallbackNote(""); setDispositionChannelFilter(null); setActiveDispCategory("__all__"); setMultiSelectMode(false); setMultiSelectedCodes([]); setChecklistParentId(null); setChecklistSelectedCodes([]); setChecklistCallbackAssign("me"); setIsNonMissionInboundDisposition(false); } }}>
        <SheetContent
          side="right"
          className={`w-full sm:max-w-[720px] p-0 flex flex-col gap-0 ${mandatoryDisposition ? "[&>button]:hidden" : ""}`}
          onPointerDownOutside={mandatoryDisposition ? (e) => e.preventDefault() : undefined}
          onEscapeKeyDown={mandatoryDisposition ? (e) => e.preventDefault() : undefined}
        >
          {/* Sticky header — Stone & Terracotta */}
          {(() => {
            const dispAc = dispositionChannelFilter === "phone" ? "#B5622E"
              : dispositionChannelFilter === "email" ? "#5B4FCF"
              : dispositionChannelFilter === "sms" ? "#2E75B6"
              : "#7A6858";
            const DispIcon = dispositionChannelFilter === "email" ? Mail
              : dispositionChannelFilter === "sms" ? MessageSquare
              : Phone;
            return (
              <SheetHeader className="px-5 py-4 border-b space-y-0" style={{ background: "#FFFFFF", borderBottomColor: `${dispAc}35` }}>
                <div className="flex items-center gap-3">
                  <div className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: dispAc, boxShadow: `0 2px 8px ${dispAc}45` }}>
                    <DispIcon className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-sm font-bold leading-tight text-foreground">
                      {checklistParentId
                        ? t.agentWorkspace.checklistStep2
                        : modalSelectedParent
                        ? t.statusEngine.disp.subcatTitle
                        : dispositionChannelFilter === "phone" ? t.statusEngine.disp.resultPhone
                        : dispositionChannelFilter === "email" ? t.statusEngine.disp.resultEmail
                        : dispositionChannelFilter === "sms" ? t.statusEngine.disp.resultSms
                        : mandatoryDisposition ? t.statusEngine.disp.resultMandatory
                        : t.statusEngine.disp.resultContact}
                    </SheetTitle>
                    {currentContact && (
                      <SheetDescription className="flex items-center gap-1.5 text-xs mt-0.5">
                        <User className="h-3 w-3 shrink-0" style={{ color: dispAc }} />
                        <span className="font-semibold truncate text-foreground">{currentContact.firstName} {currentContact.lastName}</span>
                        {dispositionChannelFilter === "email" && currentContact.email
                          ? <span className="text-muted-foreground">· {currentContact.email}</span>
                          : currentContact.phone
                          ? <span className="text-muted-foreground">· {currentContact.phone}</span>
                          : null}
                      </SheetDescription>
                    )}
                    {mandatoryDisposition && (
                      <p className="text-xs text-destructive mt-0.5">{t.statusEngine.disp.mandatoryPrompt}</p>
                    )}
                  </div>
                </div>
              </SheetHeader>
            );
          })()}

          {/* Body */}
          <ScrollArea className="flex-1 min-h-0 bg-background">
            <div className="px-4 py-4 space-y-4">
              {campaignDispositions.length === 0 ? (
                <div className="text-center py-16">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-sm font-medium">Žiadne výsledky pre túto kampaň</p>
                  <p className="text-xs text-muted-foreground mt-1">Priraďte statusy v Nexus Pulse v detaile kampane.</p>
                </div>
              ) : checklistParentId ? (() => {
                /* ---- Step 2: Dvojkrokový výber (Checklist) ---- */
                const clParent = campaignDispositions.find((d: any) => d.id === checklistParentId);
                const clChildren = campaignDispositions.filter((d: any) => d.parentId === checklistParentId && d.isActive);
                const clColorClass = DISPOSITION_COLOR_MAP[clParent?.color || "gray"] || DISPOSITION_COLOR_MAP.gray;
                return (
                  <div className="space-y-4">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs -ml-2" onClick={() => { setChecklistParentId(null); setChecklistSelectedCodes([]); }} data-testid="btn-checklist-back">
                      <ChevronLeft className="h-3.5 w-3.5" />
                      {t.agentWorkspace.checklistBack}
                    </Button>

                    {clParent && (() => {
                      const ClIcon = DISPOSITION_ICON_MAP[clParent.icon || ""] || CircleDot;
                      return (
                        <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${clColorClass}`}>
                          <ClIcon className="h-5 w-5 shrink-0" />
                          <div>
                            <div className="text-sm font-semibold">{getDispName(clParent)}</div>
                            <div className="text-xs opacity-70">{clParent.code}</div>
                          </div>
                        </div>
                      );
                    })()}

                    <div>
                      <p className="text-sm font-medium mb-3">{t.agentWorkspace.checklistSelectSubstatuses}</p>
                      <div className="space-y-2">
                        {clChildren.map((child: any) => {
                          const isChecked = checklistSelectedCodes.includes(child.code);
                          const ChildIcon = DISPOSITION_ICON_MAP[child.icon || ""] || CircleDot;
                          const actionLabels: Record<string, { label: string; cls: string }> = {
                            callback:       { label: t.agentWorkspace.actionLabelCallback,      cls: "bg-blue-100 text-blue-700" },
                            schedule_email: { label: t.agentWorkspace.actionLabelScheduleEmail, cls: "bg-indigo-100 text-indigo-700" },
                            schedule_sms:   { label: t.agentWorkspace.actionLabelScheduleSms,   cls: "bg-violet-100 text-violet-700" },
                            dnd:            { label: t.agentWorkspace.actionLabelDnd,           cls: "bg-red-100 text-red-700" },
                            complete:       { label: t.agentWorkspace.actionLabelComplete,      cls: "bg-green-100 text-green-700" },
                            convert:        { label: t.agentWorkspace.actionLabelConvert,       cls: "bg-emerald-100 text-emerald-700" },
                            send_email:     { label: t.agentWorkspace.actionLabelSendEmail,     cls: "bg-sky-100 text-sky-700" },
                            send_sms:       { label: t.agentWorkspace.actionLabelSendSms,       cls: "bg-teal-100 text-teal-700" },
                          };
                          const actionInfo = actionLabels[child.actionType];
                          const accentHex = DISPOSITION_HEX_MAP[child.color || "gray"] || DISPOSITION_HEX_MAP.gray;
                          return (
                            <div
                              key={child.id}
                              role="radio"
                              aria-checked={isChecked}
                              tabIndex={0}
                              onClick={() => setChecklistSelectedCodes(isChecked ? [] : [child.code])}
                              onKeyDown={(e) => e.key === " " && setChecklistSelectedCodes(isChecked ? [] : [child.code])}
                              className="relative flex items-center cursor-pointer rounded-xl overflow-hidden transition-all duration-150 group select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              style={{
                                border: `1.5px solid ${isChecked ? accentHex : "hsl(var(--border))"}`,
                                background: isChecked ? `${accentHex}10` : "hsl(var(--card))",
                                boxShadow: isChecked ? `0 2px 8px ${accentHex}28` : "0 1px 2px rgba(0,0,0,0.04)",
                              }}
                              data-testid={`checklist-item-${child.code}`}
                            >
                              <div className="w-1 self-stretch shrink-0 transition-all rounded-l-xl" style={{ background: isChecked ? accentHex : "transparent" }} />
                              <div
                                className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 my-3 ml-3 transition-all"
                                style={{ background: isChecked ? `${accentHex}22` : "hsl(var(--muted))" }}
                              >
                                <ChildIcon className="h-4 w-4" style={{ color: isChecked ? accentHex : "hsl(var(--muted-foreground))" }} />
                              </div>
                              <div className="flex-1 py-3 px-3">
                                <p className="text-sm font-semibold leading-tight" style={{ color: isChecked ? accentHex : "hsl(var(--foreground))" }}>
                                  {getDispName(child)}
                                </p>
                                {actionInfo && (
                                  <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${actionInfo.cls}`}>
                                    {actionInfo.label}
                                  </span>
                                )}
                              </div>
                              <div className="pr-4 shrink-0">
                                {isChecked
                                  ? <CheckCircle2 className="h-5 w-5 transition-all" style={{ color: accentHex }} />
                                  : <Circle className="h-5 w-5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground italic">{t.agentWorkspace.checklistOptionalHint}</p>

                    {/* Full scheduling form – shown when parent or any child requires callback */}
                    {(() => {
                      const anyCallback = clParent?.actionType === "callback" || clParent?.actionType === "schedule_email" || clParent?.actionType === "schedule_sms"
                        || clChildren.some((c: any) => c.actionType === "callback" || c.actionType === "schedule_email" || c.actionType === "schedule_sms");
                      if (!anyCallback) return null;
                      return (
                        <div className="space-y-3 rounded-md border p-3 bg-card">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.statusEngine.disp.scheduleCallback}</div>
                          <DateTimePicker
                            value={checklistCallbackDate && checklistCallbackTime ? `${checklistCallbackDate}T${checklistCallbackTime}` : ""}
                            onChange={(val) => {
                              if (val) {
                                const [dp, tp] = val.split("T");
                                setChecklistCallbackDate(dp);
                                setChecklistCallbackTime((tp || "09:00").substring(0, 5));
                              } else {
                                setChecklistCallbackDate("");
                                setChecklistCallbackTime("09:00");
                              }
                            }}
                            includeTime
                            data-testid="input-checklist-callback-datetime"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: t.statusEngine.disp.tomorrow, days: 1 },
                              { label: "2d", days: 2 },
                              { label: "3d", days: 3 },
                              { label: "5d", days: 5 },
                              { label: "1t", days: 7 },
                              { label: "2t", days: 14 },
                              { label: "1m", days: 30 },
                              { label: "2m", days: 60 },
                              { label: "3m", days: 90 },
                              { label: "6m", days: 180 },
                              { label: "9m", days: 270 },
                              { label: "1r", days: 365 },
                            ].map((preset) => (
                              <Button key={preset.days} type="button" size="sm" variant="outline" className="text-[11px] h-6 px-2"
                                onClick={() => {
                                  const d = preset.days <= 5
                                    ? addBusinessDays(new Date(), preset.days)
                                    : (() => { const dt = new Date(); dt.setDate(dt.getDate() + preset.days); return dt; })();
                                  setChecklistCallbackDate(d.toISOString().split("T")[0]);
                                }}
                                data-testid={`btn-checklist-cb-preset-${preset.days}`}
                              >
                                {preset.label}
                              </Button>
                            ))}
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">{t.statusEngine.disp.assignToLabel}</label>
                            <div className="flex gap-2 mt-1">
                              <Button size="sm" variant={checklistCallbackAssign === "me" ? "default" : "outline"} className="flex-1 gap-1 text-xs" onClick={() => setChecklistCallbackAssign("me")} disabled={!user?.id} data-testid="btn-checklist-cb-assign-me">
                                <User className="h-3 w-3" /> {t.statusEngine.disp.assignToMe}
                              </Button>
                              <Button size="sm" variant={checklistCallbackAssign === "all" ? "default" : "outline"} className="flex-1 gap-1 text-xs" onClick={() => setChecklistCallbackAssign("all")} data-testid="btn-checklist-cb-assign-all">
                                <Users className="h-3 w-3" /> {t.statusEngine.disp.assignToAll}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })() : modalSelectedParent ? (() => {
                /* ---- Detail parent (children + callback form) ---- */
                const parent = campaignDispositions.find(d => d.id === modalSelectedParent);
                const children = campaignDispositions.filter((d: any) => d.parentId === modalSelectedParent && d.isActive && dispChannelAllowed(d, dispositionChannelFilter));
                const cbAssignTo = modalCallbackAssign === "me" && user?.id ? user.id : "all";
                const needsCallback = parent?.actionType === "callback" || parent?.actionType === "schedule_email" || parent?.actionType === "schedule_sms"
                  || children.some(c => c.actionType === "callback" || c.actionType === "schedule_email" || c.actionType === "schedule_sms");

                return (
                  <div className="space-y-4">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs -ml-2" onClick={() => { setModalSelectedParent(null); setModalCallbackDate(""); setModalCallbackTime("09:00"); setModalCallbackNote(""); }} data-testid="btn-modal-disposition-back">
                      <ChevronLeft className="h-3.5 w-3.5" />
                      {t.agentWorkspace.checklistBackToList}
                    </Button>

                    {parent && (() => {
                      const ParentIcon = DISPOSITION_ICON_MAP[parent.icon || ""] || CircleDot;
                      return (
                        <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center gap-2">
                          <ParentIcon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">{getDispName(parent)}</span>
                        </div>
                      );
                    })()}

                    {needsCallback && (
                      <div className="space-y-3 rounded-md border p-3 bg-card">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.statusEngine.disp.scheduleCallback}</div>
                        <DateTimePicker
                          value={modalCallbackDate && modalCallbackTime ? `${modalCallbackDate}T${modalCallbackTime}` : ""}
                          onChange={(val) => {
                            if (val) {
                              const [dp, tp] = val.split("T");
                              setModalCallbackDate(dp);
                              setModalCallbackTime((tp || "09:00").substring(0, 5));
                            } else {
                              setModalCallbackDate("");
                              setModalCallbackTime("09:00");
                            }
                          }}
                          includeTime
                          data-testid="input-modal-callback-datetime"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: t.statusEngine.disp.tomorrow, days: 1 },
                            { label: "2d", days: 2 },
                            { label: "3d", days: 3 },
                            { label: "5d", days: 5 },
                            { label: "1t", days: 7 },
                            { label: "2t", days: 14 },
                            { label: "1m", days: 30 },
                            { label: "2m", days: 60 },
                            { label: "3m", days: 90 },
                            { label: "6m", days: 180 },
                            { label: "9m", days: 270 },
                            { label: "1r", days: 365 },
                          ].map((preset) => (
                            <Button key={preset.days} type="button" size="sm" variant="outline" className="text-[11px] h-6 px-2"
                              onClick={() => {
                                const d = preset.days <= 5
                                  ? addBusinessDays(new Date(), preset.days)
                                  : (() => { const dt = new Date(); dt.setDate(dt.getDate() + preset.days); return dt; })();
                                setModalCallbackDate(d.toISOString().split("T")[0]);
                              }}
                              data-testid={`btn-cb-preset-${preset.days}`}
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">{t.statusEngine.disp.assignToLabel}</label>
                          <div className="flex gap-2 mt-1">
                            <Button size="sm" variant={modalCallbackAssign === "me" ? "default" : "outline"} className="flex-1 gap-1 text-xs" onClick={() => setModalCallbackAssign("me")} disabled={!user?.id} data-testid="btn-modal-cb-assign-me">
                              <User className="h-3 w-3" /> {t.statusEngine.disp.assignToMe}
                            </Button>
                            <Button size="sm" variant={modalCallbackAssign === "all" ? "default" : "outline"} className="flex-1 gap-1 text-xs" onClick={() => setModalCallbackAssign("all")} data-testid="btn-modal-cb-assign-all">
                              <Users className="h-3 w-3" /> {t.statusEngine.disp.assignToAll}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">{t.statusEngine.disp.cbNoteLabel}</label>
                          <Textarea
                            value={modalCallbackNote}
                            onChange={(e) => setModalCallbackNote(e.target.value)}
                            placeholder={t.statusEngine.disp.cbNotePlaceholder}
                            className="mt-1 min-h-[60px] max-h-[120px] text-sm"
                            data-testid="input-modal-callback-note"
                          />
                        </div>
                      </div>
                    )}

                    {children.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.statusEngine.disp.reasonTitle}</div>
                        <div className="flex flex-col gap-2">
                          {children.map((child) => {
                            const IconComp = DISPOSITION_ICON_MAP[child.icon || ""] || CircleDot;
                            const accentHex2 = DISPOSITION_HEX_MAP[child.color || "gray"] || DISPOSITION_HEX_MAP.gray;
                            const isScheduleType = parent?.actionType === "callback" || parent?.actionType === "schedule_email" || parent?.actionType === "schedule_sms"
                              || child.actionType === "callback" || child.actionType === "schedule_email" || child.actionType === "schedule_sms";
                            return (
                              <button
                                key={child.id}
                                onClick={() => {
                                  if (child.callbackOffsetDays) {
                                    const cbDate = addBusinessDays(new Date(), child.callbackOffsetDays);
                                    cbDate.setHours(9, 0, 0, 0);
                                    handleDisposition(child.code, parent?.code, cbDate.toISOString(), cbAssignTo, modalCallbackNote || undefined);
                                  } else {
                                    handleDisposition(child.code, parent?.code, isScheduleType && modalCallbackDate && modalCallbackTime ? `${modalCallbackDate}T${modalCallbackTime}` : undefined, isScheduleType ? cbAssignTo : undefined, isScheduleType ? modalCallbackNote || undefined : undefined);
                                  }
                                }}
                                className="relative flex items-center cursor-pointer rounded-xl overflow-hidden transition-all duration-150 group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:scale-[1.01]"
                                style={{
                                  border: `1.5px solid hsl(var(--border))`,
                                  background: "hsl(var(--card))",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLElement).style.border = `1.5px solid ${accentHex2}`;
                                  (e.currentTarget as HTMLElement).style.background = `${accentHex2}08`;
                                  (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${accentHex2}28`;
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLElement).style.border = `1.5px solid hsl(var(--border))`;
                                  (e.currentTarget as HTMLElement).style.background = "hsl(var(--card))";
                                  (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
                                }}
                                data-testid={`modal-disposition-${child.code}`}
                              >
                                <div className="w-1 self-stretch shrink-0 rounded-l-xl transition-all" style={{ background: accentHex2 }} />
                                <div
                                  className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 my-3 ml-3"
                                  style={{ background: `${accentHex2}20` }}
                                >
                                  <IconComp className="h-3.5 w-3.5" style={{ color: accentHex2 }} />
                                </div>
                                <span className="text-sm font-semibold flex-1 px-3 py-3" style={{ color: "hsl(var(--foreground))" }}>
                                  {getDispName(child)}
                                  {child.callbackOffsetDays && <span className="ml-2 text-[10px] font-normal text-muted-foreground">{child.callbackOffsetDays}d</span>}
                                </span>
                                <span className="pr-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">›</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(parent?.actionType === "callback" || parent?.actionType === "schedule_email" || parent?.actionType === "schedule_sms" || parent?.requiresCallback) && (
                      <Button className="w-full" disabled={!modalCallbackDate || (parent?.requiresNote && !callNotes.trim())} onClick={() => { handleDisposition(parent!.code, undefined, modalCallbackDate && modalCallbackTime ? `${modalCallbackDate}T${modalCallbackTime}` : undefined, cbAssignTo, modalCallbackNote || undefined); }} data-testid="btn-modal-disposition-confirm-callback">
                        <CalendarPlus className="h-4 w-4 mr-1" />
                        {parent?.actionType === "schedule_email" ? t.agentWorkspace.actionLabelScheduleEmail : parent?.actionType === "schedule_sms" ? t.agentWorkspace.actionLabelScheduleSms : t.agentWorkspace.actionLabelCallback}
                      </Button>
                    )}
                    {!(parent?.actionType === "callback" || parent?.actionType === "schedule_email" || parent?.actionType === "schedule_sms" || parent?.requiresCallback) && children.length === 0 && (
                      <Button className="w-full" disabled={parent?.requiresNote && !callNotes.trim()} onClick={() => { handleDisposition(parent!.code, undefined, undefined, undefined, undefined); }} data-testid="btn-modal-disposition-confirm-simple">
                        <Check className="h-4 w-4 mr-1" />
                        Potvrdiť výsledok
                      </Button>
                    )}
                  </div>
                );
              })() : (() => {
                /* ---- Hlavný zoznam: rovnaký vizuál ako Nexus Pulse náhľad v kampani ---- */
                const channelFiltered = campaignDispositions.filter((d: any) => {
                  if (!d.isActive) return false;
                  // Always include children (parentId set) so childCount badge works correctly
                  if (d.parentId) return true;
                  return dispChannelAllowed(d, dispositionChannelFilter);
                });

                const selectedSet = new Set(
                  multiSelectMode
                    ? campaignDispositions
                        .filter((d: any) => multiSelectedCodes.includes(d.code))
                        .map((d: any) => d.id)
                    : []
                );

                return (
                  <div className="space-y-3">
                    {multiSelectMode && (
                      <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground bg-muted/20">
                        Klikni viac statusov pre multi-výber. Prvý sa použije ako hlavný, ostatné sa pripoja do poznámky.
                      </div>
                    )}
                    <NexusPulseView
                      categories={dispositionCategories}
                      statuses={channelFiltered}
                      getStatusName={(s) => getDispName(s as any)}
                      multiSelectMode={multiSelectMode}
                      selectedIds={selectedSet}
                      emptyMessage="Žiadne výsledky pre túto kampaň."
                      onSelectStatus={(disp: any) => {
                        // Detect children WITHOUT channel filter so we never miss them
                        const hasChildren = campaignDispositions.some((d: any) => d.parentId === disp.id && d.isActive);
                        const isCallback = disp.actionType === "callback" || disp.actionType === "schedule_email" || disp.actionType === "schedule_sms" || disp.requiresCallback;
                        const needsConfig = hasChildren || isCallback || disp.requiresNote;

                        if (multiSelectMode) {
                          if (needsConfig) return; // can't bulk-select items requiring config
                          setMultiSelectedCodes((prev) =>
                            prev.includes(disp.code) ? prev.filter((c) => c !== disp.code) : [...prev, disp.code]
                          );
                          return;
                        }

                        if (hasChildren) {
                          setChecklistParentId(disp.id);
                          setChecklistSelectedCodes([]);
                          // Pre-fill callback date from disposition offset (or default 1 business day)
                          if (disp.actionType === "callback" || disp.actionType === "schedule_email" || disp.actionType === "schedule_sms") {
                            const offsetDays = disp.callbackOffsetDays || 1;
                            const cbDate = addBusinessDays(new Date(), offsetDays);
                            setChecklistCallbackDate(cbDate.toISOString().split("T")[0]);
                            setChecklistCallbackTime("09:00");
                          } else {
                            setChecklistCallbackDate("");
                            setChecklistCallbackTime("09:00");
                          }
                        } else if (needsConfig) {
                          setModalSelectedParent(disp.id);
                          if (isCallback) {
                            const offsetDays = disp.callbackOffsetDays || 1;
                            const cbDate = addBusinessDays(new Date(), offsetDays);
                            setModalCallbackDate(cbDate.toISOString().split("T")[0]);
                            setModalCallbackTime("09:00");
                          }
                        } else {
                          handleDisposition(disp.code);
                        }
                      }}
                    />
                  </div>
                );
              })()}

              {/* Dedicated callback scheduler for non-mission inbound calls */}
              {isNonMissionInboundDisposition && !modalSelectedParent && !checklistParentId && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#B5622E" }}>
                      <CalendarPlus className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-sm font-semibold">Naplánovať spätné volanie</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Dátum</label>
                      <input
                        type="date"
                        value={modalCallbackDate}
                        onChange={(e) => setModalCallbackDate(e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="input-inbound-cb-date"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Čas</label>
                      <input
                        type="time"
                        value={modalCallbackTime}
                        onChange={(e) => setModalCallbackTime(e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="input-inbound-cb-time"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={modalCallbackAssign === "me" ? "default" : "outline"} className="flex-1 gap-1 text-xs h-8" onClick={() => setModalCallbackAssign("me")} disabled={!user?.id} data-testid="btn-inbound-cb-assign-me">
                      <User className="h-3 w-3" /> Mne
                    </Button>
                    <Button size="sm" variant={modalCallbackAssign === "all" ? "default" : "outline"} className="flex-1 gap-1 text-xs h-8" onClick={() => setModalCallbackAssign("all")} data-testid="btn-inbound-cb-assign-all">
                      <Users className="h-3 w-3" /> Všetkým
                    </Button>
                  </div>
                  <Textarea
                    value={modalCallbackNote}
                    onChange={(e) => setModalCallbackNote(e.target.value)}
                    placeholder="Poznámka k hovoru (voliteľné)..."
                    className="min-h-[50px] max-h-[100px] text-sm"
                    data-testid="input-inbound-cb-note"
                  />
                  <Button
                    className="w-full"
                    disabled={!modalCallbackDate}
                    onClick={async () => {
                      const cbAssignTo = modalCallbackAssign === "me" ? (user?.id || "all") : "all";
                      const inboundPhone = (callContext?.callInfo as any)?.phoneNumber
                        || (currentContact as any)?.phone
                        || "";
                      const inboundName = currentContact
                        ? `${(currentContact as any).firstName || ""} ${(currentContact as any).lastName || ""}`.trim()
                        : "";
                      try {
                        await apiRequest("POST", "/api/agent/inbound-callbacks", {
                          customerId: currentContact?.id ? String(currentContact.id) : undefined,
                          phone: inboundPhone || "unknown",
                          name: inboundName || undefined,
                          callbackDate: `${modalCallbackDate}T${modalCallbackTime}`,
                          assignedTo: cbAssignTo,
                          notes: modalCallbackNote || undefined,
                        });
                        queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/agent/inbound-callbacks"] });
                        toast({ title: "Callback naplánovaný", description: `${modalCallbackDate} ${modalCallbackTime}` });
                      } catch (e) {
                        toast({ title: "Chyba", description: "Nepodarilo sa naplánovať callback", variant: "destructive" });
                        return;
                      }
                      setIsNonMissionInboundDisposition(false);
                      setDispositionModalOpen(false);
                      setModalCallbackDate("");
                      setModalCallbackTime("09:00");
                      setModalCallbackAssign("me");
                      setModalCallbackNote("");
                    }}
                    data-testid="btn-inbound-cb-confirm"
                  >
                    <CalendarPlus className="h-4 w-4 mr-1" /> Naplánovať callback
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setIsNonMissionInboundDisposition(false);
                      setDispositionModalOpen(false);
                      setModalCallbackDate("");
                      setModalCallbackTime("09:00");
                      setModalCallbackAssign("me");
                      setModalCallbackNote("");
                    }}
                    data-testid="btn-inbound-cb-skip"
                  >
                    Zatvoriť bez preplanovania
                  </Button>
                </div>
              )}

              {/* Notes always visible (both main list and parent-detail) */}
              {campaignDispositions.length > 0 && (() => {
                const activeDisp = modalSelectedParent
                  ? campaignDispositions.find((d: any) => d.id === modalSelectedParent)
                  : checklistParentId
                  ? campaignDispositions.find((d: any) => d.id === checklistParentId)
                  : null;
                const noteRequired = activeDisp?.requiresNote;
                return (
                  <div className="pt-2 border-t">
                    <Label htmlFor="disp-notes" className={`text-xs font-medium flex items-center gap-1 ${noteRequired ? "text-amber-700" : "text-muted-foreground"}`}>
                      Poznámka k hovoru
                      {noteRequired
                        ? <span className="text-amber-600 font-semibold">*&nbsp;(povinná)</span>
                        : <span className="text-muted-foreground font-normal">(voliteľné)</span>}
                    </Label>
                    <Textarea
                      id="disp-notes"
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      placeholder={noteRequired ? "Poznámka je povinná pre tento výsledok..." : "Doplňte krátku poznámku..."}
                      className={`mt-1 min-h-[60px] max-h-[120px] text-sm ${noteRequired && !callNotes.trim() ? "border-amber-400 focus:ring-amber-400" : ""}`}
                      data-testid="input-disp-notes"
                    />
                    {noteRequired && !callNotes.trim() && (
                      <p className="text-[11px] text-amber-600 mt-1">Vyplňte poznámku pred uložením výsledku.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </ScrollArea>

          {/* Sticky footer for checklist confirm */}
          {checklistParentId && !multiSelectMode && campaignDispositions.length > 0 && (() => {
            const clConfirmParent = campaignDispositions.find((d: any) => d.id === checklistParentId);
            // Determine effective action from selected children
            const CHECKLIST_ACTION_PRIORITY = ['dnd', 'complete', 'callback', 'schedule_sms', 'schedule_email', 'convert', 'send_email', 'send_sms'];
            const selectedChildren = checklistSelectedCodes
              .map(code => campaignDispositions.find((d: any) => d.code === code))
              .filter(Boolean) as any[];
            const withAction = selectedChildren.filter((c: any) => c.actionType && c.actionType !== 'none');
            const sortedByPriority = [...withAction].sort(
              (a, b) => CHECKLIST_ACTION_PRIORITY.indexOf(a.actionType) - CHECKLIST_ACTION_PRIORITY.indexOf(b.actionType)
            );
            const effectiveChild = sortedByPriority[0];
            const aw = t.agentWorkspace as any;
            const actionLabels: Record<string, string> = {
              callback: `⏰ ${aw.actionWillScheduleCall ?? "Schedule call"}`,
              schedule_email: `📧 ${aw.actionWillScheduleEmail ?? "Schedule email"}`,
              schedule_sms: `💬 ${aw.actionWillScheduleSms ?? "Schedule SMS"}`,
              dnd: `🚫 ${aw.actionWillDnd ?? t.statusEngine.dnd}`,
              complete: `✓ ${aw.actionWillComplete ?? t.statusEngine.complete}`,
              convert: `★ ${aw.actionWillConvert ?? t.statusEngine.convert}`,
              send_email: `📤 ${aw.actionWillSendEmail ?? "Send email"}`,
              send_sms: `📱 ${aw.actionWillSendSms ?? "Send SMS"}`,
            };
            const effectiveActionLabel = effectiveChild
              ? actionLabels[effectiveChild.actionType]
              : clConfirmParent?.actionType && clConfirmParent.actionType !== 'none'
                ? actionLabels[clConfirmParent.actionType]
                : null;
            const needsCallbackDate =
              clConfirmParent?.actionType === "callback" ||
              clConfirmParent?.actionType === "schedule_email" ||
              clConfirmParent?.actionType === "schedule_sms" ||
              selectedChildren.some((c: any) => c.actionType === "callback" || c.actionType === "schedule_email" || c.actionType === "schedule_sms");
            const clAssignTo = checklistCallbackAssign === "me" && user?.id ? user.id : null;
            return (
              <div className="border-t bg-background px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    {checklistSelectedCodes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t.statusEngine.disp.checklistHint}</p>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{t.statusEngine.disp.checkedCount}: <strong>{checklistSelectedCodes.length}</strong></p>
                        {effectiveActionLabel && (
                          <p className="text-xs text-primary font-medium">{effectiveActionLabel}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    disabled={needsCallbackDate && !checklistCallbackDate}
                    onClick={() => {
                      if (clConfirmParent) {
                        handleDisposition(
                          clConfirmParent.code, undefined,
                          needsCallbackDate && checklistCallbackDate && checklistCallbackTime
                            ? new Date(`${checklistCallbackDate}T${checklistCallbackTime}:00`).toISOString() : undefined,
                          clAssignTo ?? undefined, undefined, undefined, checklistSelectedCodes
                        );
                      }
                      setChecklistParentId(null);
                      setChecklistSelectedCodes([]);
                      setChecklistCallbackDate("");
                      setChecklistCallbackTime("09:00");
                      setChecklistCallbackAssign("me");
                    }}
                    data-testid="btn-checklist-confirm"
                  >
                    <Target className="h-4 w-4 mr-1" />
                    {needsCallbackDate ? "Naplánovať a uložiť" : "Uložiť výsledok"}
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* Sticky footer for multi-select */}
          {multiSelectMode && !modalSelectedParent && campaignDispositions.length > 0 && (
            <div className="border-t bg-background px-6 py-3 flex items-center gap-2">
              <div className="text-xs text-muted-foreground flex-1">
                {multiSelectedCodes.length === 0
                  ? "Žiadny výber"
                  : `Vybraté: ${multiSelectedCodes.length} (prvý = hlavný)`}
              </div>
              <Button variant="outline" size="sm" onClick={() => setMultiSelectedCodes([])} disabled={multiSelectedCodes.length === 0} data-testid="btn-multi-clear">
                Vymazať výber
              </Button>
              <Button
                size="sm"
                disabled={multiSelectedCodes.length === 0}
                onClick={() => {
                  if (multiSelectedCodes.length === 0) return;
                  const [primary, ...rest] = multiSelectedCodes;
                  let finalNotes = callNotes;
                  if (rest.length > 0) {
                    const labels = rest.map((c) => {
                      const d = campaignDispositions.find((x: any) => x.code === c);
                      return d ? getDispName(d) : c;
                    });
                    const tag = `+ Ďalšie výsledky: ${labels.join(", ")}`;
                    finalNotes = callNotes ? `${callNotes}\n${tag}` : tag;
                    setCallNotes(finalNotes);
                  }
                  handleDisposition(primary, undefined, undefined, undefined, undefined, finalNotes);
                }}
                data-testid="btn-multi-confirm"
              >
                <Target className="h-4 w-4 mr-1" />
                Potvrdiť ({multiSelectedCodes.length})
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ScheduledQueuePanel open={scheduledQueueOpen} onOpenChange={setScheduledQueueOpen} onOpenContact={handleOpenScheduledContact} />
      <MyActivityPanel
        open={myActivityOpen}
        onOpenChange={setMyActivityOpen}
        stats={stats}
        onCallFromShift={async (item: any) => {
          setMyActivityOpen(false);
          if (item.campaignId && item.campaignContactId && item.entityId && item.contactType) {
            await handleOpenScheduledContact(
              item.entityId,
              item.campaignId,
              item.campaignContactId,
              "phone",
              item.contactType,
              item.phoneNumber
            );
          }
          if (item.phoneNumber && makeCall) {
            makeCall({
              phoneNumber: item.phoneNumber,
              customerId: item.entityId || undefined,
              campaignId: item.campaignId || undefined,
              customerName: item.customerName || undefined,
              callerIdNumber: undefined,
            });
            setStats(prev => ({ ...prev, calls: prev.calls + 1 }));
          }
        }}
        onOpenEntity={async (type, id, campaignContactId, campaignId) => {
          setMyActivityOpen(false);
          if (campaignContactId && campaignId) {
            handleOpenScheduledContact(id, campaignId, campaignContactId, "phone", type);
            return;
          }
          // No campaign context — fetch entity directly and load into workspace
          try {
            if (type === "customer") {
              const res = await fetch(`/api/customers/${id}`, { credentials: "include" });
              if (res.ok) {
                const customer = await res.json();
                setCurrentContact(customer);
                setCurrentContactType("customer");
                setCurrentCampaignContactId(null);
                setCurrentClinicData(null);
                setCurrentHospitalData(null);
                setCurrentCollaboratorData(null);
                setRightTab("actions");
              }
            } else if (type === "clinic") {
              const res = await fetch(`/api/clinics/${id}`, { credentials: "include" });
              if (res.ok) {
                const clinic = await res.json();
                const virtual = { id: clinic.id, firstName: clinic.doctorFirstName || "", lastName: clinic.doctorLastName || clinic.name || "", phone: clinic.phone || "", email: clinic.email || "", displayName: clinic.name || "" };
                setCurrentContact(virtual as any);
                setCurrentContactType("clinic");
                setCurrentCampaignContactId(null);
                setCurrentClinicData(clinic);
                setCurrentHospitalData(null);
                setCurrentCollaboratorData(null);
                setRightTab("actions");
              }
            } else if (type === "hospital") {
              const res = await fetch(`/api/hospitals/${id}`, { credentials: "include" });
              if (res.ok) {
                const hospital = await res.json();
                const virtual = { id: hospital.id, firstName: "", lastName: hospital.name || "", phone: hospital.phone || "", email: hospital.email || "", displayName: hospital.name || "" };
                setCurrentContact(virtual as any);
                setCurrentContactType("hospital");
                setCurrentCampaignContactId(null);
                setCurrentClinicData(null);
                setCurrentHospitalData(hospital);
                setCurrentCollaboratorData(null);
                setRightTab("actions");
              }
            } else if (type === "collaborator") {
              const res = await fetch(`/api/collaborators/${id}`, { credentials: "include" });
              if (res.ok) {
                const collab = await res.json();
                const virtual = { id: collab.id, firstName: collab.firstName || "", lastName: collab.lastName || "", phone: collab.phone || "", email: collab.email || "", displayName: `${collab.firstName || ""} ${collab.lastName || ""}`.trim() };
                setCurrentContact(virtual as any);
                setCurrentContactType("collaborator");
                setCurrentCampaignContactId(null);
                setCurrentClinicData(null);
                setCurrentHospitalData(null);
                setCurrentCollaboratorData(collab);
                setRightTab("actions");
              }
            }
          } catch {}
        }}
      />

      <Dialog open={createTaskDialogOpen} onOpenChange={setCreateTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-purple-500" />
              {t.quickCreate.newTask}
            </DialogTitle>
            <DialogDescription>{t.quickCreate.newTaskDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t.quickCreate.taskTitle}</label>
              <Input
                value={createTaskForm.title}
                onChange={(e) => setCreateTaskForm({ ...createTaskForm, title: e.target.value })}
                placeholder={t.quickCreate.taskTitle}
                data-testid="input-create-task-title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t.quickCreate.taskDescription}</label>
              <Textarea
                value={createTaskForm.description}
                onChange={(e) => setCreateTaskForm({ ...createTaskForm, description: e.target.value })}
                placeholder={t.quickCreate.taskDescription}
                className="resize-none"
                rows={3}
                data-testid="input-create-task-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t.quickCreate.priority}</label>
                <Select value={createTaskForm.priority} onValueChange={(val) => setCreateTaskForm({ ...createTaskForm, priority: val })}>
                  <SelectTrigger data-testid="select-create-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t.quickCreate.priorityLow}</SelectItem>
                    <SelectItem value="medium">{t.quickCreate.priorityMedium}</SelectItem>
                    <SelectItem value="high">{t.quickCreate.priorityHigh}</SelectItem>
                    <SelectItem value="urgent">{t.quickCreate.priorityUrgent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{t.tasks?.deadline || "Termín"}</label>
                <Input
                  type="date"
                  value={createTaskForm.dueDate}
                  onChange={(e) => setCreateTaskForm({ ...createTaskForm, dueDate: e.target.value })}
                  className="h-9"
                  data-testid="input-create-task-duedate"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t.quickCreate.assignedTo}</label>
              <Select value={createTaskForm.assignedUserId} onValueChange={(val) => setCreateTaskForm({ ...createTaskForm, assignedUserId: val })}>
                <SelectTrigger data-testid="select-create-task-assigned">
                  <SelectValue placeholder={t.quickCreate.assignedTo} />
                </SelectTrigger>
                <SelectContent>
                  {allUsersForTasks.filter((u: any) => u.id).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {taskGroupsForCreate.length > 0 && (
              <div>
                <label className="text-sm font-medium">Priradiť do skupiny</label>
                <Select value={createTaskForm.groupId || "__none__"} onValueChange={(val) => setCreateTaskForm({ ...createTaskForm, groupId: val === "__none__" ? "" : val })}>
                  <SelectTrigger data-testid="select-create-task-group">
                    <SelectValue placeholder="Bez skupiny" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Bez skupiny</SelectItem>
                    {taskGroupsForCreate.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.displayAlias || g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {currentContact && (
              <div className="p-2 bg-muted rounded-md text-xs text-muted-foreground flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                {t.quickCreate.linkedCustomer}: {currentContact.firstName} {currentContact.lastName}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTaskDialogOpen(false)} data-testid="btn-cancel-create-task">
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => {
                if (!createTaskForm.title.trim() || !createTaskForm.assignedUserId) return;
                createTaskMutation.mutate({
                  title: createTaskForm.title.trim(),
                  description: createTaskForm.description.trim(),
                  priority: createTaskForm.priority,
                  assignedUserId: createTaskForm.assignedUserId,
                  customerId: (currentContactType === "customer" && currentContact?.id) ? currentContact.id : undefined,
                  dueDate: createTaskForm.dueDate || undefined,
                  country: selectedCampaign?.country || undefined,
                  groupId: createTaskForm.groupId || undefined,
                });
              }}
              disabled={createTaskMutation.isPending || !createTaskForm.title.trim() || !createTaskForm.assignedUserId}
              data-testid="btn-submit-create-task"
            >
              {createTaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={abandonedCallsOpen} onOpenChange={(open) => { setAbandonedCallsOpen(open); if (!open) setAbandonedCallsFilter("all"); }} modal={false}>
        <DialogContent className="sm:max-w-[580px] max-h-[82vh] flex flex-col overflow-hidden p-0 gap-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-4 pb-4 pr-12 shrink-0">
            <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#B5622E18" }}>
              <PhoneOff className="h-5 w-5" style={{ color: "#B5622E" }} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold leading-tight">{t.agentWorkspace.missedCallsTitle}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {abandonedCalls.filter((c: any) => !c.calledBack).length} {t.agentWorkspace.missedUnhandledCount} · {abandonedCalls.filter((c: any) => !!c.calledBack).length} {t.agentWorkspace.missedHandledCount}
              </p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 px-5 pb-3 border-b shrink-0">
            {(["all", "pending", "handled"] as const).map((f) => {
              const labels = { all: t.agentWorkspace.filterAll, pending: t.agentWorkspace.filterPending, handled: t.agentWorkspace.filterHandled };
              const count = f === "all" ? abandonedCalls.length : f === "pending" ? abandonedCalls.filter((c: any) => !c.calledBack).length : abandonedCalls.filter((c: any) => !!c.calledBack).length;
              return (
                <button key={f} onClick={() => setAbandonedCallsFilter(f)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all border"
                  style={abandonedCallsFilter === f
                    ? { background: "#B5622E", color: "#fff", borderColor: "#B5622E" }
                    : {}}
                >
                  {labels[f]}{count > 0 ? ` ${count}` : ""}
                </button>
              );
            })}
          </div>

          {/* Sections */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {(() => {
              const allFiltered = abandonedCalls.filter((c: any) =>
                abandonedCallsFilter === "all" ? true
                : abandonedCallsFilter === "pending" ? !c.calledBack
                : !!c.calledBack
              );
              const pendingCalls = allFiltered.filter((c: any) => !c.calledBack);
              const handledCalls = allFiltered.filter((c: any) => !!c.calledBack);

              const renderCallRow = (call: any) => {
                const isCalledBack = !!call.calledBack;
                const waitSec = call.waitDurationSeconds || 0;
                const waitStr = waitSec > 0 ? (waitSec >= 60 ? `${Math.floor(waitSec / 60)}m ${waitSec % 60}s` : `${waitSec}s`) : null;
                const callTs = call.completedAt || call.enteredQueueAt || call.createdAt;
                const missedTime = callTs ? (() => { try { return format(new Date(callTs), "HH:mm"); } catch { return ""; } })() : "";
                const timeAgo = (() => {
                  if (!callTs) return "";
                  const diff = Date.now() - new Date(callTs).getTime();
                  if (isNaN(diff) || diff < 0) return "";
                  const mins = Math.floor(diff / 60000);
                  if (mins < 60) return `${mins}${t.agentWorkspace.agoMinutes}`;
                  return `${Math.floor(mins / 60)}${t.agentWorkspace.agoHours} ${mins % 60}${t.agentWorkspace.agoMinutes}`;
                })();
                return (
                  <div
                    key={call.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors"
                    data-testid={`abandoned-call-${call.id}`}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isCalledBack ? "bg-green-100 dark:bg-green-900/30" : "bg-red-50 dark:bg-red-900/20"}`}>
                      {isCalledBack
                        ? <PhoneForwarded className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                        : <PhoneOff className="h-3.5 w-3.5 text-red-400 dark:text-red-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate leading-tight">
                        {call.customerName || call.callerName || call.callerNumber}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono shrink-0">{call.callerNumber}</span>
                        {call.queueName && (
                          <span className="text-[10px] text-muted-foreground/60 truncate">· {call.queueName}</span>
                        )}
                        {!isCalledBack && (() => {
                          const s = call.status;
                          const r = call.abandonReason;
                          const label = s === "no_agents" ? t.agentWorkspace.noAgentsStatus
                            : s === "timeout" ? t.agentWorkspace.timeoutStatus
                            : s === "overflow" ? t.agentWorkspace.overflowStatus
                            : r === "caller_hangup" ? t.agentWorkspace.callerHangup
                            : t.agentWorkspace.missedStatus;
                          const color = s === "no_agents" ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            : s === "timeout" || s === "overflow" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                            : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300";
                          return (
                            <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${color}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-mono tabular-nums text-foreground">{missedTime}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight">{timeAgo}</div>
                      </div>
                      {waitStr && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hidden sm:inline">
                          {waitStr}
                        </span>
                      )}
                      {isCalledBack ? (
                        <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 font-medium shrink-0">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {call.calledBackByUserName ? call.calledBackByUserName : t.agentWorkspace.handledBy}
                        </span>
                      ) : (
                        <Button size="sm" variant="default" className="h-7 text-xs gap-1 px-2.5 shrink-0"
                          onClick={async () => {
                            const phoneNum = call.customerPhone || call.callerNumber;
                            if (!phoneNum || !makeCall) return;
                            pendingCallbackAbandonedIdRef.current = call.id;
                            if (call.customerId) {
                              try {
                                const custRes = await fetch(`/api/customers/${call.customerId}`, { credentials: "include" });
                                if (custRes.ok) { const customer = await custRes.json(); setCurrentContact(customer); setCurrentContactType("customer"); setCurrentCampaignContactId(null); setRightTab("actions"); }
                              } catch (e) { console.error("Failed to load customer:", e); }
                            } else {
                              try {
                                const lookupRes = await fetch(`/api/customers/lookup-phone?phone=${encodeURIComponent(phoneNum)}`, { credentials: "include" });
                                if (lookupRes.ok) { const matched = await lookupRes.json(); if (matched?.id) { const custRes = await fetch(`/api/customers/${matched.id}`, { credentials: "include" }); if (custRes.ok) { const customer = await custRes.json(); setCurrentContact(customer); setCurrentContactType("customer"); setCurrentCampaignContactId(null); setRightTab("actions"); } } }
                              } catch (e) { console.error("Failed to lookup customer:", e); }
                            }
                            makeCall({ phoneNumber: phoneNum, customerName: call.customerName || call.callerName || undefined, customerId: call.customerId || undefined, callerIdNumber: (selectedCampaign as any)?.callerIdNumber || undefined });
                            if (!isSipRegistered && !isSipRegistering) sipRegister();
                            setAbandonedCallsOpen(false);
                          }}
                          data-testid={`btn-callback-${call.id}`}
                        >
                          <Phone className="h-3 w-3" /> {t.agentWorkspace.callBackBtn}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              };

              if (allFiltered.length === 0) return (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-3 text-green-500/40" />
                  <p className="font-medium text-sm">{abandonedCallsFilter === "handled" ? t.agentWorkspace.noHandledCalls : t.agentWorkspace.noMissedCalls}</p>
                  <p className="text-xs mt-1 text-muted-foreground/70">{t.agentWorkspace.allCallsHandled}</p>
                </div>
              );

              return (
                <div className="pb-4">
                  {/* Pending section */}
                  {pendingCalls.length > 0 && (
                    <>
                      <div className="flex items-center gap-3 mx-4 mt-4 mb-2 p-3 rounded-xl" style={{ background: "#B5622E12" }}>
                        <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#B5622E" }}>
                          <PhoneOff className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm" style={{ color: "#3D2E20" }}>{t.agentWorkspace.sectionUnhandled}</p>
                          <p className="text-xs" style={{ color: "#9A8878" }}>{pendingCalls.length} {t.agentWorkspace.callsCount}</p>
                        </div>
                        <div className="h-7 w-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style={{ background: "#B5622E" }}>
                          {pendingCalls.length}
                        </div>
                      </div>
                      <div className="space-y-1.5 px-4">
                        {pendingCalls.map((call: any) => renderCallRow(call))}
                      </div>
                    </>
                  )}

                  {/* Handled section */}
                  {handledCalls.length > 0 && (
                    <>
                      <div className="flex items-center gap-3 mx-4 mt-4 mb-2 p-3 rounded-xl" style={{ background: "#5E7A5A12" }}>
                        <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#5E7A5A" }}>
                          <PhoneForwarded className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm" style={{ color: "#3D2E20" }}>{t.agentWorkspace.sectionHandled}</p>
                          <p className="text-xs" style={{ color: "#9A8878" }}>{handledCalls.length} {t.agentWorkspace.callsCount}</p>
                        </div>
                        <div className="h-7 w-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style={{ background: "#5E7A5A" }}>
                          {handledCalls.length}
                        </div>
                      </div>
                      <div className="space-y-1.5 px-4">
                        {handledCalls.map((call: any) => renderCallRow(call))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDetailModal} onOpenChange={(open) => !open && setHistoryDetailModal(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0">
          {historyDetailModal && (() => {
            const entry = historyDetailModal;
            const isEmail = (entry as any).type === "email" || !!(entry as any).htmlBody;
            const isSms = (entry as any).type === "sms";
            const timestamp = (entry as any).timestamp instanceof Date
              ? (entry as any).timestamp
              : new Date((entry as any).timestamp || (entry as any).date);
            const htmlBody = (entry as any).htmlBody || (entry as any).details || "";
            const fullContent = (entry as any).fullContent || (entry as any).content || "";
            const direction = (entry as any).direction;
            const agentName = (entry as any).agentName;
            const status = (entry as any).status;
            const recipientEmail = (entry as any).recipientEmail;
            const recipientPhone = (entry as any).recipientPhone;
            const subject = isEmail ? ((entry as any).content || "Email") : null;

            return (
              <>
                <div className="px-5 pt-4 pb-3 border-b bg-background rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isEmail ? "bg-indigo-50 dark:bg-indigo-900/30" : "bg-sky-50 dark:bg-sky-900/30"}`}>
                      {isEmail ? (
                        direction === "outbound"
                          ? <Send className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                          : <Inbox className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                      ) : (
                        direction === "outbound"
                          ? <Send className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                          : <Inbox className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold leading-snug" data-testid="text-history-detail-title">
                          {isEmail ? (subject || "Email") : t.agentWorkspace.historySmsTitle}
                        </h3>
                        {status && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{status}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(timestamp, "d. MMMM yyyy, HH:mm:ss", { locale: sk })}
                        </span>
                        {agentName && (
                          <span className="flex items-center gap-1">
                            <UserCircle className="h-3 w-3" />
                            {agentName}
                          </span>
                        )}
                        {isEmail && recipientEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {recipientEmail}
                          </span>
                        )}
                        {isSms && recipientPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {recipientPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-auto" style={{ maxHeight: "60vh" }}>
                  {isEmail && htmlBody ? (
                    <div className="p-2 h-full">
                      <iframe
                        ref={(iframe) => {
                          if (iframe) {
                            const tryResize = () => {
                              try {
                                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                                if (doc?.body) {
                                  const h = Math.max(doc.body.scrollHeight + 40, 300);
                                  iframe.style.height = h + "px";
                                }
                              } catch {}
                            };
                            iframe.onload = tryResize;
                            setTimeout(tryResize, 200);
                            setTimeout(tryResize, 600);
                          }
                        }}
                        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#333;margin:16px;word-wrap:break-word}img{max-width:100%;height:auto}a{color:#1a73e8;text-decoration:none}table{border-collapse:collapse;max-width:100%}td,th{padding:4px 8px}pre{white-space:pre-wrap;word-wrap:break-word}@media(prefers-color-scheme:dark){body{color:#e0e0e0;background:#0a0a0a}a{color:#8ab4f8}}</style></head><body>${htmlBody.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/on\w+\s*=/gi, 'data-blocked=')}</body></html>`}
                        className="w-full border-0 rounded-md bg-white dark:bg-gray-950"
                        style={{ minHeight: "400px", width: "100%" }}
                        sandbox="allow-same-origin"
                        title="Email obsah"
                        data-testid="iframe-email-content"
                      />
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className={`rounded-lg p-4 ${direction === "outbound" ? "bg-primary/5 border border-primary/10" : "bg-muted/30 border border-border/30"}`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-history-detail-content">
                          {isSms ? fullContent : (entry as any).content || ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={scriptModalOpen} onOpenChange={setScriptModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Scenár kampane
              {selectedCampaign && (
                <Badge variant="secondary" className="ml-2">{selectedCampaign.name}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 -mx-6 px-6">
            <div className="h-full max-h-[65vh]">
              <ScriptViewer script={selectedCampaign?.script || null} contact={currentContact} campaignContactId={currentCampaignContactId} campaignId={selectedCampaignId} initialStepId={currentCampaignContact?.currentScriptStepId} onAction={(action, data) => {
                if (action === "openEmail") {
                  setActiveChannel("email");
                  if (data?.emailTemplateId) {
                    setPendingEmailTemplateId(data.emailTemplateId);
                  }
                }
                else if (action === "openPhone" || action === "makeCall") setActiveChannel("phone");
                else if (action === "openDisposition") { setDispositionChannelFilter(null); setDispositionModalOpen(true); }
                else if (action === "openEmailDisposition") { setDispositionChannelFilter("email"); setDispositionModalOpen(true); }
                else if (action === "openPhoneDisposition") { setDispositionChannelFilter("phone"); setDispositionModalOpen(true); }
                else if (action === "scheduleCallbackOnly" && data?.dispositionCode) {
                  try {
                    const disp = campaignDispositions.find((d: any) => d.code === data.dispositionCode);
                    const parentDisp = disp?.parentId ? campaignDispositions.find((d: any) => d.id === disp.parentId) : undefined;
                    if (disp?.callbackOffsetDays && currentCampaignContactId && selectedCampaignId) {
                      const cbDate = addBusinessDays(new Date(), disp.callbackOffsetDays);
                      cbDate.setHours(9, 0, 0, 0);
                      apiRequest("PATCH", `/api/campaigns/${selectedCampaignId}/contacts/${currentCampaignContactId}`, {
                        status: "callback_scheduled",
                        callbackDate: cbDate.toISOString(),
                        dispositionCode: data.dispositionCode,
                        assignedTo: user?.id || null,
                        lastAttemptAt: new Date().toISOString(),
                      }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", selectedCampaignId, "contacts"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/agent/callbacks"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
                        toast({ title: t.agentWorkspace.contactFinished, description: `Callback: ${cbDate.toLocaleDateString()}` });
                      }).catch(() => {});
                    }
                  } catch {}
                }
                else if (action === "setDisposition" && data?.dispositionCode) {
                  try {
                    const disp = campaignDispositions.find((d: any) => d.code === data.dispositionCode);
                    const parentDisp = disp?.parentId ? campaignDispositions.find((d: any) => d.id === disp.parentId) : undefined;
                    const isCallbackType = disp?.actionType === "callback" || disp?.actionType === "schedule_email" || disp?.actionType === "schedule_sms"
                      || parentDisp?.actionType === "callback" || parentDisp?.actionType === "schedule_email" || parentDisp?.actionType === "schedule_sms";
                    if (isCallbackType) {
                      if (disp?.callbackOffsetDays) {
                        const cbDate = addBusinessDays(new Date(), disp.callbackOffsetDays);
                        cbDate.setHours(9, 0, 0, 0);
                        handleDisposition(data.dispositionCode, parentDisp?.code, cbDate.toISOString(), user?.id || null);
                      } else {
                        setModalSelectedParent(parentDisp?.id || disp?.id || null);
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setModalCallbackDate(tomorrow.toISOString().split("T")[0]);
                        setModalCallbackTime("09:00");
                        setDispositionChannelFilter(null);
                        setDispositionModalOpen(true);
                      }
                    } else {
                      handleDisposition(data.dispositionCode, parentDisp?.code);
                    }
                  } catch {}
                }
                setScriptModalOpen(false);
              }} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contractWizardOpen} onOpenChange={setContractWizardOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t.contractsModule?.wizardTitle || "Nová zmluva"} - {contractWizardStep}/3</DialogTitle>
            <DialogDescription>
              {contractWizardStep === 1 && (t.contractsModule?.wizardStep1 || "Vyberte kategóriu zmluvy")}
              {contractWizardStep === 2 && (t.contractsModule?.wizardStep2 || "Doplňte údaje")}
              {contractWizardStep === 3 && (t.contractsModule?.wizardStep3 || "Potvrďte vytvorenie")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-2 mb-6">
              {[1, 2, 3].map(step => (
                <div key={step} className={`flex-1 h-2 rounded-full ${step <= contractWizardStep ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            {contractWizardStep === 1 && (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{t.contractsModule?.templateCategory || "Kategória zmluvy"}</Label>
                  <Select value={contractForm.categoryId} onValueChange={(v) => setContractForm({ ...contractForm, categoryId: v })}>
                    <SelectTrigger data-testid="select-aw-contract-category"><SelectValue placeholder={t.contractsModule?.selectTemplate || "Vyberte kategóriu"} /></SelectTrigger>
                    <SelectContent>
                      {contractCategories.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">Žiadne kategórie zmlúv</div>
                      ) : contractCategories.map(cat => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Klient</Label>
                  <div className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/30">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{currentContact?.firstName} {currentContact?.lastName}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">{currentContact?.country}</Badge>
                  </div>
                </div>
              </div>
            )}
            {contractWizardStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{t.contractsModule?.billingCompany || "Fakturačná spoločnosť"}</Label>
                    <Select value={contractForm.billingDetailsId} onValueChange={(v) => setContractForm({ ...contractForm, billingDetailsId: v })}>
                      <SelectTrigger data-testid="select-aw-contract-billing"><SelectValue placeholder={t.contractsModule?.selectBillingCompany || "Vyberte"} /></SelectTrigger>
                      <SelectContent>
                        {contractBillingDetails.map(bd => (
                          <SelectItem key={bd.id} value={bd.id}>{bd.companyName} ({bd.countryCode})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.contractsModule?.currency || "Mena"}</Label>
                    <Select value={contractForm.currency} onValueChange={(v) => setContractForm({ ...contractForm, currency: v })}>
                      <SelectTrigger data-testid="select-aw-contract-currency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="CZK">CZK</SelectItem>
                        <SelectItem value="HUF">HUF</SelectItem>
                        <SelectItem value="RON">RON</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{t.contractsModule?.selectNumberRange || "Číselník zmluvy"}</Label>
                    <Select value={contractForm.numberRangeId} onValueChange={(v) => setContractForm({ ...contractForm, numberRangeId: v })}>
                      <SelectTrigger data-testid="select-aw-contract-range"><SelectValue placeholder={t.contractsModule?.selectNumberRangePlaceholder || "Vyberte číselník"} /></SelectTrigger>
                      <SelectContent>
                        {activeContractRanges.length === 0 ? (
                          <div className="px-2 py-4 text-center text-sm text-muted-foreground">{t.contractsModule?.noContractNumberRanges || "Žiadne číselníky"}</div>
                        ) : activeContractRanges.map(range => {
                          const next = (range.lastNumberUsed || 0) + 1;
                          const formatted = `${range.prefix || ""}${String(next).padStart(range.digitsToGenerate || 6, "0")}${range.suffix || ""}`;
                          return <SelectItem key={range.id} value={range.id}><span className="font-medium">{range.name}</span> <span className="text-xs text-muted-foreground ml-1">({formatted})</span></SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.contractsModule?.notes || "Poznámky"} ({t.customers?.details?.optional || "voliteľné"})</Label>
                    <Textarea value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} placeholder="Interné poznámky k zmluve..." data-testid="textarea-aw-contract-notes" />
                  </div>
                </div>
              </div>
            )}
            {contractWizardStep === 3 && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t.contractsModule?.preview || "Súhrn"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2 flex-wrap">
                      <span className="text-muted-foreground">{t.contractsModule?.templateCategory || "Kategória"}:</span>
                      <span className="font-medium">{contractCategories.find(c => String(c.id) === contractForm.categoryId)?.label}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between gap-2 flex-wrap">
                      <span className="text-muted-foreground">{t.contractsModule?.client || "Klient"}:</span>
                      <span className="font-medium">{currentContact?.firstName} {currentContact?.lastName}</span>
                    </div>
                    <div className="flex justify-between gap-2 flex-wrap">
                      <span className="text-muted-foreground">{t.contractsModule?.billingCompany || "Spoločnosť"}:</span>
                      <span>{contractBillingDetails.find(b => b.id === contractForm.billingDetailsId)?.companyName}</span>
                    </div>
                    <div className="flex justify-between gap-2 flex-wrap">
                      <span className="text-muted-foreground">{t.contractsModule?.currency || "Mena"}:</span>
                      <span>{contractForm.currency}</span>
                    </div>
                    {contractForm.numberRangeId && (
                      <>
                        <Separator className="my-2" />
                        <div className="flex justify-between gap-2 flex-wrap">
                          <span className="text-muted-foreground">{t.contractsModule?.selectNumberRange || "Číselník"}:</span>
                          <span className="font-medium">{activeContractRanges.find(r => r.id === contractForm.numberRangeId)?.name}</span>
                        </div>
                      </>
                    )}
                    {contractForm.notes && (
                      <>
                        <Separator className="my-2" />
                        <div>
                          <span className="text-muted-foreground">{t.contractsModule?.notes || "Poznámky"}:</span>
                          <p className="mt-1 text-sm">{contractForm.notes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => {
              if (contractWizardStep > 1) setContractWizardStep(contractWizardStep - 1);
              else setContractWizardOpen(false);
            }}>
              {contractWizardStep > 1 ? (t.contractsModule?.back || "Späť") : (t.contractsModule?.cancel || "Zrušiť")}
            </Button>
            {contractWizardStep < 3 ? (
              <Button
                onClick={() => setContractWizardStep(contractWizardStep + 1)}
                disabled={(contractWizardStep === 1 && !contractForm.categoryId) || (contractWizardStep === 2 && (!contractForm.billingDetailsId || (activeContractRanges.length > 0 && !contractForm.numberRangeId)))}
                data-testid="button-aw-wizard-next"
              >
                {t.contractsModule?.next || "Ďalej"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => createContractMutation.mutate(contractForm)} disabled={createContractMutation.isPending} data-testid="button-aw-create-contract">
                {createContractMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.contractsModule?.saving || "Ukladám..."}</>
                ) : (
                  <><FileSignature className="h-4 w-4 mr-2" />{t.contractsModule?.createAndGeneratePdf || "Vytvoriť zmluvu"}</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-accept entity selection modal — shown when multiple phone matches exist */}
      <Dialog open={!!pendingInboundMatches} onOpenChange={(open) => { if (!open) setPendingInboundMatches(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-entity-selection">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneIncoming className="h-5 w-5 text-green-600" />
              {t.agentWorkspace.inboundSelectTitle}
            </DialogTitle>
            <DialogDescription>
              {t.agentWorkspace.inboundSelectDesc.replace("{phone}", pendingInboundMatches?.phone || "")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
            {pendingInboundMatches?.matches.map((match) => {
              const colorMap: Record<string, string> = {
                customer: "bg-blue-100 text-blue-700 border-blue-200",
                hospital: "bg-purple-100 text-purple-700 border-purple-200",
                clinic: "bg-cyan-100 text-cyan-700 border-cyan-200",
                collaborator: "bg-amber-100 text-amber-700 border-amber-200",
              };
              const labelMap: Record<string, string> = {
                customer: t.agentWorkspace.entityTypeCustomer,
                hospital: t.agentWorkspace.entityTypeHospital,
                clinic: t.agentWorkspace.entityTypeClinic,
                collaborator: t.agentWorkspace.entityTypeCollaborator,
              };
              const iconMap: Record<string, React.ReactNode> = {
                customer: <User className="h-4 w-4 shrink-0" />,
                hospital: <Building2 className="h-4 w-4 shrink-0" />,
                clinic: <Building2 className="h-4 w-4 shrink-0" />,
                collaborator: <Users className="h-4 w-4 shrink-0" />,
              };
              return (
                <button
                  key={`${match.entityType}-${match.id}`}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left group"
                  data-testid={`btn-select-entity-${match.entityType}-${match.id}`}
                  onClick={async () => {
                    const ctx = pendingInboundMatches
                      ? { callId: pendingInboundMatches.callId, campaignId: selectedCampaignId || "", campaignName: selectedCampaign?.name || "Inbound", callerNumber: pendingInboundMatches.phone }
                      : undefined;
                    setPendingInboundMatches(null);
                    await handleSelectInboundMatch(match, "card", ctx);
                  }}
                >
                  <div className={`p-2 rounded-md border ${colorMap[match.entityType] || "bg-muted"}`}>
                    {iconMap[match.entityType]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{match.name}</div>
                    {match.subtype && (
                      <div className="text-xs text-muted-foreground truncate">{match.subtype}</div>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${colorMap[match.entityType] || "bg-muted"}`}>
                    {labelMap[match.entityType] || match.entityType}
                  </span>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingInboundMatches(null)} data-testid="btn-entity-selection-skip">
              {t.agentWorkspace.inboundSelectSkip}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
