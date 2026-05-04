import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { CHART_PALETTE } from "@/lib/chart-colors";
import { 
  ArrowLeft, Users, Settings, BarChart3, FileText, FileDown,
  Play, Pause, CheckCircle, CheckCircle2, Clock, Phone, PhoneMissed, User, Calendar,
  RefreshCw, Download, Filter, MoreHorizontal, Trash2, CheckCheck,
  Copy, Save, ScrollText, History, ArrowRight, Mail, MessageSquare, FileEdit, Package, Shield,
  Plus, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ListChecks, Upload, FileUp, AlertTriangle,
  ThumbsUp, ThumbsDown, CalendarPlus, PhoneOff, AlertCircle, XCircle, Zap, Star,
  CircleDot, Info, Heart, Ban, Bell, Send, Target, Flag, Eye, EyeOff,
  Volume2, VolumeX, UserCheck, UserX, Briefcase, Gift, Home, MapPin, Globe, Wand2,
  Variable, Building2, Building, Loader2, Tag, Layers, BookOpen, ArrowUpDown, GripVertical, ArrowUp, ArrowDown,
  Search, HelpCircle, Pencil, X, Check, CheckSquare, Settings2,
  Flame, Stethoscope, PenTool, Archive, Rocket, DollarSign, RotateCcw, Monitor, MousePointerClick,
  FolderOpen, Wifi, WifiOff, Smartphone, ShieldAlert, ShieldCheck, Handshake, Hourglass,
  ClipboardCheck, PhoneForwarded, FileQuestion, FileWarning, FileX, MailPlus, MailCheck, MailWarning, MailX,
  MinusCircle, Slash, FolderClosed, TrendingUp, CalendarClock, MessageCircle,
  UserPlus, UserMinus, PhoneCall, BookMarked, Newspaper, Image, FileSignature, CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataTable, type SortConfig } from "@/components/data-table";
import { ContactCriteriaBuilder, type PreviewCounts } from "@/components/contact-criteria-builder";
import CampaignPhasesTab from "@/components/campaigns/CampaignPhasesTab";
import CampaignReportingPhases from "@/components/campaigns/CampaignReportingPhases";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Campaign, type CampaignContact, type Customer, COUNTRIES, type OperatorScript, operatorScriptSchema, type CampaignDisposition, DISPOSITION_ACTION_TYPES, DISPOSITION_NAME_TRANSLATIONS, RESCHEDULE_PERIOD_OPTIONS, STATUS_ACTION_TYPES } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

function getDefaultSalesScript(lang: string): OperatorScript {
  const texts: Record<string, { greeting: string; intro: string; introNote: string; interestQ: string; interestOpts: { value: string; label: string }[]; productQ: string; productOpts: { value: string; label: string }[]; objectionQ: string; objectionOpts: { value: string; label: string }[]; closing: string; closingNote: string; noInterest: string; noInterestNote: string; thankYou: string; thankYouNote: string; name: string; desc: string }> = {
    sk: {
      name: "Predajny scenar", desc: "Zakladny predajny scenar pre kampane",
      greeting: "Pozdrav", intro: "Dobry den, volam z {firma}. Hovorim s {meno}?",
      introNote: "Predstavte sa a overte identitu klienta.",
      interestQ: "Ma klient zaujem?", interestOpts: [{ value: "yes", label: "Ano, ma zaujem" }, { value: "partial", label: "Ciastocny zaujem" }, { value: "no", label: "Nema zaujem" }],
      productQ: "O aky produkt ma zaujem?", productOpts: [{ value: "cord_blood", label: "Pupocnikova krv" }, { value: "cord_tissue", label: "Pupocnikove tkanivo" }, { value: "both", label: "Obe sluzby" }],
      objectionQ: "Namietka klienta", objectionOpts: [{ value: "price", label: "Vysoka cena" }, { value: "thinking", label: "Chce rozmysliet" }, { value: "competitor", label: "Ma konkurenciu" }, { value: "none", label: "Ziadna namietka" }],
      closing: "Dohodnutie dalsieho kroku", closingNote: "Dohodnite stretnutie, zaslanie ponuky alebo zavolanie neskôr.",
      noInterest: "Klient nema zaujem", noInterestNote: "Podakujte za cas a zaznamenajte dovod odmietnutia.",
      thankYou: "Rozlucenie", thankYouNote: "Dakujem za vas cas. Prajem pekny den!",
    },
    en: {
      name: "Sales Script", desc: "Basic sales call script for campaigns",
      greeting: "Greeting", intro: "Hello, I am calling from {company}. Am I speaking with {name}?",
      introNote: "Introduce yourself and verify the client identity.",
      interestQ: "Is the client interested?", interestOpts: [{ value: "yes", label: "Yes, interested" }, { value: "partial", label: "Partial interest" }, { value: "no", label: "Not interested" }],
      productQ: "Which product is of interest?", productOpts: [{ value: "cord_blood", label: "Cord blood" }, { value: "cord_tissue", label: "Cord tissue" }, { value: "both", label: "Both services" }],
      objectionQ: "Client objection", objectionOpts: [{ value: "price", label: "High price" }, { value: "thinking", label: "Wants to think" }, { value: "competitor", label: "Has competitor" }, { value: "none", label: "No objection" }],
      closing: "Agree on next step", closingNote: "Schedule a meeting, send a quote, or call back later.",
      noInterest: "Client not interested", noInterestNote: "Thank them for their time and record the reason for rejection.",
      thankYou: "Farewell", thankYouNote: "Thank you for your time. Have a nice day!",
    },
    cs: {
      name: "Prodejni scenar", desc: "Zakladni prodejni scenar pro kampane",
      greeting: "Pozdrav", intro: "Dobry den, volam z {firma}. Mluvim s {jmeno}?",
      introNote: "Predstavte se a overte identitu klienta.",
      interestQ: "Ma klient zajem?", interestOpts: [{ value: "yes", label: "Ano, ma zajem" }, { value: "partial", label: "Castecny zajem" }, { value: "no", label: "Nema zajem" }],
      productQ: "O jaky produkt ma zajem?", productOpts: [{ value: "cord_blood", label: "Pupecnikova krev" }, { value: "cord_tissue", label: "Pupecnikova tkan" }, { value: "both", label: "Obe sluzby" }],
      objectionQ: "Namitka klienta", objectionOpts: [{ value: "price", label: "Vysoka cena" }, { value: "thinking", label: "Chce rozmyslet" }, { value: "competitor", label: "Ma konkurenci" }, { value: "none", label: "Zadna namitka" }],
      closing: "Dohodnuti dalsiho kroku", closingNote: "Dohodnete schuzku, zaslani nabidky nebo zavolani pozdeji.",
      noInterest: "Klient nema zajem", noInterestNote: "Podekujte za cas a zaznamenejte duvod odmitnuti.",
      thankYou: "Rozlouceni", thankYouNote: "Dekuji za vas cas. Preji hezky den!",
    },
    hu: {
      name: "Ertekesitesi szkript", desc: "Alap ertekesitesi hivasi szkript",
      greeting: "Udvozles", intro: "Jo napot, a {ceg} cegtol hivom. {nev}-vel beszelek?",
      introNote: "Mutatkozzon be es ellenorizze az ugyfelet.",
      interestQ: "Erdeklodik az ugyfel?", interestOpts: [{ value: "yes", label: "Igen, erdeklodik" }, { value: "partial", label: "Reszben erdeklodik" }, { value: "no", label: "Nem erdeklodik" }],
      productQ: "Melyik termek erdekli?", productOpts: [{ value: "cord_blood", label: "Koeldokver" }, { value: "cord_tissue", label: "Koeldokszovet" }, { value: "both", label: "Mindketto" }],
      objectionQ: "Ugyfel ellenvetese", objectionOpts: [{ value: "price", label: "Magas ar" }, { value: "thinking", label: "Gondolkodni akar" }, { value: "competitor", label: "Van versenytars" }, { value: "none", label: "Nincs ellenvetés" }],
      closing: "Kovetkezo lepes egyeztetese", closingNote: "Egyeztessen talalkozot, ajanlatkuldesset vagy visszahivast.",
      noInterest: "Ugyfel nem erdeklodik", noInterestNote: "Koszonje meg az idot es rogzitse az elutasitas okat.",
      thankYou: "Bucsuzas", thankYouNote: "Koszonom az idejet. Szep napot kivanok!",
    },
    ro: {
      name: "Script de vanzare", desc: "Script de baza pentru apeluri de vanzare",
      greeting: "Salut", intro: "Buna ziua, sun de la {companie}. Vorbesc cu {nume}?",
      introNote: "Prezentati-va si verificati identitatea clientului.",
      interestQ: "Clientul este interesat?", interestOpts: [{ value: "yes", label: "Da, interesat" }, { value: "partial", label: "Partial interesat" }, { value: "no", label: "Nu este interesat" }],
      productQ: "Ce produs il intereseaza?", productOpts: [{ value: "cord_blood", label: "Sange din cordon" }, { value: "cord_tissue", label: "Tesut din cordon" }, { value: "both", label: "Ambele servicii" }],
      objectionQ: "Obiectia clientului", objectionOpts: [{ value: "price", label: "Pret ridicat" }, { value: "thinking", label: "Vrea sa se gandeasca" }, { value: "competitor", label: "Are concurenta" }, { value: "none", label: "Fara obiectii" }],
      closing: "Stabilirea pasului urmator", closingNote: "Programati o intalnire, trimiteti o oferta sau sunati mai tarziu.",
      noInterest: "Client neinteresat", noInterestNote: "Multumiti pentru timp si inregistrati motivul refuzului.",
      thankYou: "La revedere", thankYouNote: "Va multumesc pentru timpul acordat. O zi buna!",
    },
    it: {
      name: "Script di vendita", desc: "Script di base per chiamate di vendita",
      greeting: "Saluto", intro: "Buongiorno, chiamo da {azienda}. Parlo con {nome}?",
      introNote: "Presentatevi e verificate l'identita del cliente.",
      interestQ: "Il cliente e interessato?", interestOpts: [{ value: "yes", label: "Si, interessato" }, { value: "partial", label: "Parzialmente" }, { value: "no", label: "Non interessato" }],
      productQ: "Quale prodotto interessa?", productOpts: [{ value: "cord_blood", label: "Sangue cordonale" }, { value: "cord_tissue", label: "Tessuto cordonale" }, { value: "both", label: "Entrambi" }],
      objectionQ: "Obiezione del cliente", objectionOpts: [{ value: "price", label: "Prezzo alto" }, { value: "thinking", label: "Vuole pensarci" }, { value: "competitor", label: "Ha concorrenza" }, { value: "none", label: "Nessuna obiezione" }],
      closing: "Accordo sul prossimo passo", closingNote: "Fissate un incontro, inviate un preventivo o richiamate.",
      noInterest: "Cliente non interessato", noInterestNote: "Ringraziate per il tempo e registrate il motivo del rifiuto.",
      thankYou: "Commiato", thankYouNote: "Grazie per il suo tempo. Buona giornata!",
    },
    de: {
      name: "Verkaufsskript", desc: "Basis-Verkaufsskript fuer Kampagnen",
      greeting: "Begruessung", intro: "Guten Tag, ich rufe von {Firma} an. Spreche ich mit {Name}?",
      introNote: "Stellen Sie sich vor und bestaetigen Sie die Identitaet des Kunden.",
      interestQ: "Hat der Kunde Interesse?", interestOpts: [{ value: "yes", label: "Ja, interessiert" }, { value: "partial", label: "Teilweise" }, { value: "no", label: "Kein Interesse" }],
      productQ: "Welches Produkt interessiert?", productOpts: [{ value: "cord_blood", label: "Nabelschnurblut" }, { value: "cord_tissue", label: "Nabelschnurgewebe" }, { value: "both", label: "Beide" }],
      objectionQ: "Einwand des Kunden", objectionOpts: [{ value: "price", label: "Hoher Preis" }, { value: "thinking", label: "Moechte ueberlegen" }, { value: "competitor", label: "Hat Konkurrenz" }, { value: "none", label: "Kein Einwand" }],
      closing: "Naechsten Schritt vereinbaren", closingNote: "Vereinbaren Sie ein Treffen, senden Sie ein Angebot oder rufen Sie spaeter an.",
      noInterest: "Kein Interesse", noInterestNote: "Bedanken Sie sich und notieren Sie den Ablehnungsgrund.",
      thankYou: "Verabschiedung", thankYouNote: "Vielen Dank fuer Ihre Zeit. Schoenen Tag noch!",
    },
  };
  const tx = texts[lang] || texts.en;
  return {
    version: 1,
    name: tx.name,
    description: tx.desc,
    startStepId: "step_greeting",
    steps: [
      {
        id: "step_greeting", title: tx.greeting, description: tx.introNote,
        elements: [{ id: "el_greeting", type: "paragraph" as const, content: tx.intro }],
        nextStepId: "step_interest",
      },
      {
        id: "step_interest", title: tx.interestQ,
        elements: [{ id: "el_interest", type: "radio" as const, label: tx.interestQ, required: true, options: tx.interestOpts.map(o => ({ ...o, nextStepId: o.value === "no" ? "step_no_interest" : "step_product" })) }],
      },
      {
        id: "step_product", title: tx.productQ,
        elements: [{ id: "el_product", type: "select" as const, label: tx.productQ, required: true, options: tx.productOpts }],
        nextStepId: "step_objection",
      },
      {
        id: "step_objection", title: tx.objectionQ,
        elements: [
          { id: "el_objection", type: "select" as const, label: tx.objectionQ, options: tx.objectionOpts },
          { id: "el_notes", type: "textarea" as const, label: "Poznámky", placeholder: "..." },
        ],
        nextStepId: "step_closing",
      },
      {
        id: "step_closing", title: tx.closing, description: tx.closingNote,
        elements: [{ id: "el_closing_note", type: "textarea" as const, label: tx.closing, placeholder: "..." }],
        nextStepId: "step_thanks",
      },
      {
        id: "step_no_interest", title: tx.noInterest, description: tx.noInterestNote,
        elements: [{ id: "el_no_interest_note", type: "textarea" as const, label: tx.noInterest, placeholder: "..." }],
        nextStepId: "step_thanks",
      },
      {
        id: "step_thanks", title: tx.thankYou, description: tx.thankYouNote,
        elements: [{ id: "el_thanks", type: "paragraph" as const, content: tx.thankYouNote }],
        isEndStep: true,
      },
    ],
  };
}

import { Switch } from "@/components/ui/switch";
import { ScriptBuilder } from "@/components/script-builder";
import { ScriptRunner } from "@/components/script-runner";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { format, addBusinessDays } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS, type Locale } from "date-fns/locale";

const DATE_LOCALE_MAP: Record<string, Locale> = {
  SK: sk, CZ: cs, HU: hu, RO: ro, IT: it, DE: de, US: enUS
};
const DATE_FORMAT_MAP: Record<string, string> = {
  SK: "dd.MM.yyyy", CZ: "dd.MM.yyyy", HU: "yyyy.MM.dd",
  RO: "dd.MM.yyyy", IT: "dd/MM/yyyy", DE: "dd.MM.yyyy", US: "MM/dd/yyyy"
};
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CriteriaBuilder, type CriteriaGroup, criteriaToDescription } from "@/components/criteria-builder";
import { ScheduleEditor, type ScheduleConfig, getDefaultScheduleConfig } from "@/components/schedule-editor";
import { CampaignContactsFilter, type CampaignContactFilters, applyContactFilters } from "@/components/campaign-contacts-filter";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import type { MessageTemplate } from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NexusPulseView } from "@/components/nexus-pulse-view";

const ICON_PICKER_SET: { name: string; icon: LucideIcon }[] = [
  { name: "Phone", icon: Phone }, { name: "PhoneOff", icon: PhoneOff }, { name: "PhoneMissed", icon: PhoneMissed },
  { name: "PhoneForwarded", icon: PhoneForwarded }, { name: "Mail", icon: Mail }, { name: "MailPlus", icon: MailPlus },
  { name: "MailCheck", icon: MailCheck }, { name: "MailWarning", icon: MailWarning }, { name: "MailX", icon: MailX },
  { name: "MessageSquare", icon: MessageSquare }, { name: "MessageCircle", icon: MessageCircle },
  { name: "Send", icon: Send }, { name: "Bell", icon: Bell }, { name: "Calendar", icon: Calendar },
  { name: "CalendarPlus", icon: CalendarPlus }, { name: "CalendarClock", icon: CalendarClock },
  { name: "Clock", icon: Clock }, { name: "Hourglass", icon: Hourglass },
  { name: "CheckCircle", icon: CheckCircle }, { name: "CheckCircle2", icon: CheckCircle2 },
  { name: "CheckSquare", icon: CheckSquare }, { name: "XCircle", icon: XCircle },
  { name: "AlertCircle", icon: AlertCircle }, { name: "AlertTriangle", icon: AlertTriangle },
  { name: "ThumbsUp", icon: ThumbsUp }, { name: "ThumbsDown", icon: ThumbsDown },
  { name: "Star", icon: Star }, { name: "Heart", icon: Heart }, { name: "Zap", icon: Zap },
  { name: "Flame", icon: Flame }, { name: "Target", icon: Target }, { name: "Flag", icon: Flag },
  { name: "Eye", icon: Eye }, { name: "EyeOff", icon: EyeOff },
  { name: "User", icon: User }, { name: "Users", icon: Users },
  { name: "UserCheck", icon: UserCheck }, { name: "UserX", icon: UserX },
  { name: "Briefcase", icon: Briefcase }, { name: "Building", icon: Building },
  { name: "Globe", icon: Globe }, { name: "MapPin", icon: MapPin }, { name: "Home", icon: Home },
  { name: "Shield", icon: Shield }, { name: "ShieldAlert", icon: ShieldAlert },
  { name: "ShieldCheck", icon: ShieldCheck }, { name: "Package", icon: Package },
  { name: "FileText", icon: FileText }, { name: "Search", icon: Search },
  { name: "Filter", icon: Filter }, { name: "Copy", icon: Copy },
  { name: "RefreshCw", icon: RefreshCw }, { name: "RotateCcw", icon: RotateCcw },
  { name: "Play", icon: Play }, { name: "Pause", icon: Pause },
  { name: "Info", icon: Info }, { name: "HelpCircle", icon: HelpCircle },
  { name: "Settings", icon: Settings }, { name: "Layers", icon: Layers },
  { name: "Tag", icon: Tag }, { name: "BookOpen", icon: BookOpen },
  { name: "Ban", icon: Ban }, { name: "Slash", icon: Slash },
  { name: "MinusCircle", icon: MinusCircle }, { name: "ListChecks", icon: ListChecks },
  { name: "Archive", icon: Archive }, { name: "FolderClosed", icon: FolderClosed },
  { name: "Stethoscope", icon: Stethoscope }, { name: "PenTool", icon: PenTool },
  { name: "Rocket", icon: Rocket }, { name: "DollarSign", icon: DollarSign },
  { name: "Monitor", icon: Monitor }, { name: "Handshake", icon: Handshake },
  { name: "TrendingUp", icon: TrendingUp }, { name: "Gift", icon: Gift },
  { name: "Wand2", icon: Wand2 }, { name: "Smartphone", icon: Smartphone },
  { name: "Volume2", icon: Volume2 }, { name: "VolumeX", icon: VolumeX },
  { name: "CircleDot", icon: CircleDot }, { name: "FolderOpen", icon: FolderOpen },
  { name: "UserPlus", icon: UserPlus }, { name: "UserMinus", icon: UserMinus },
  { name: "PhoneCall", icon: PhoneCall }, { name: "BookMarked", icon: BookMarked },
  { name: "Newspaper", icon: Newspaper }, { name: "Image", icon: Image },
  { name: "FileSignature", icon: FileSignature }, { name: "CalendarCheck", icon: CalendarCheck },
  { name: "FileX", icon: FileX }, { name: "FileQuestion", icon: FileQuestion },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_PICKER_SET.map(i => [i.name, i.icon])
);

type EnrichedContact = CampaignContact & { customer?: Customer; hospital?: any; clinic?: any };

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const CONTACT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  no_answer: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  callback_scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  not_interested: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon 
}: { 
  title: string; 
  value: string | number; 
  description?: string;
  icon: any;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignDetailsCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [editName, setEditName] = useState(campaign.name);
  const [editStartDate, setEditStartDate] = useState(campaign.startDate ? format(new Date(campaign.startDate), "yyyy-MM-dd") : "");
  const [editEndDate, setEditEndDate] = useState(campaign.endDate ? format(new Date(campaign.endDate), "yyyy-MM-dd") : "");
  const [editCountries, setEditCountries] = useState<string[]>(campaign.countryCodes || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditName(campaign.name);
    setEditStartDate(campaign.startDate ? format(new Date(campaign.startDate), "yyyy-MM-dd") : "");
    setEditEndDate(campaign.endDate ? format(new Date(campaign.endDate), "yyyy-MM-dd") : "");
    setEditCountries(campaign.countryCodes || []);
  }, [campaign]);

  const hasChanges = editName !== campaign.name 
    || editStartDate !== (campaign.startDate ? format(new Date(campaign.startDate), "yyyy-MM-dd") : "")
    || editEndDate !== (campaign.endDate ? format(new Date(campaign.endDate), "yyyy-MM-dd") : "")
    || JSON.stringify(editCountries.sort()) !== JSON.stringify((campaign.countryCodes || []).sort());

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        name: editName,
        startDate: editStartDate || null,
        endDate: editEndDate || null,
        countryCodes: editCountries,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
      toast({ title: t.campaigns.detail.settingsSaved });
    } catch {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleCountry = (code: string) => {
    setEditCountries(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileEdit className="w-5 h-5" />
            {t.campaigns.detail.editCampaignDetails || t.campaigns.detail.settings}
          </CardTitle>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={saving || !editName.trim()} data-testid="button-save-campaign-details">
            <Save className="w-4 h-4 mr-2" />
            {saving ? t.campaigns.detail.saving : t.common.save}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t.campaigns.name}</Label>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            data-testid="input-edit-campaign-name"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t.campaigns.startDate}</Label>
            <DateTimePicker
              value={editStartDate}
              onChange={setEditStartDate}
              countryCode={editCountries[0] || "SK"}
              includeTime={false}
              placeholder={t.campaigns.startDate}
              data-testid="input-edit-start-date"
            />
          </div>
          <div className="space-y-2">
            <Label>{t.campaigns.endDate}</Label>
            <DateTimePicker
              value={editEndDate}
              onChange={setEditEndDate}
              countryCode={editCountries[0] || "SK"}
              includeTime={false}
              placeholder={t.campaigns.endDate}
              data-testid="input-edit-end-date"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t.campaigns.detail.country}</Label>
          <div className="flex flex-wrap gap-1.5">
            {COUNTRIES.map(c => (
              <Badge
                key={c.code}
                variant={editCountries.includes(c.code) ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => toggleCountry(c.code)}
                data-testid={`chip-edit-country-${c.code}`}
              >
                {c.flag} {c.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignSopSettingsCard({ campaignId }: { campaignId: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/sop/categories"] });
  const { data: articles = [] } = useQuery<any[]>({ queryKey: ["/api/sop/articles"] });
  const { data: linkedArticleIds = [], isLoading } = useQuery<string[]>({
    queryKey: ["/api/sop/campaign", campaignId, "article-ids"],
    queryFn: async () => {
      const res = await fetch(`/api/sop/articles/campaign/${campaignId}`, { credentials: "include" });
      if (!res.ok) return [];
      const arts = await res.json();
      return arts.map((a: any) => a.id);
    },
  });

  const linkMutation = useMutation({
    mutationFn: async ({ articleId, link }: { articleId: string; link: boolean }) => {
      if (link) await apiRequest("POST", `/api/sop/articles/${articleId}/campaigns`, { campaignId });
      else await apiRequest("DELETE", `/api/sop/articles/${articleId}/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop/campaign", campaignId, "article-ids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sop/articles/campaign", campaignId] });
    },
  });

  const toggleCategory = (categoryId: string, link: boolean) => {
    const catArticles = articles.filter((a: any) => a.categoryId === categoryId && a.isPublished);
    catArticles.forEach((a: any) => {
      const isLinked = linkedArticleIds.includes(a.id);
      if (link && !isLinked) linkMutation.mutate({ articleId: a.id, link: true });
      if (!link && isLinked) linkMutation.mutate({ articleId: a.id, link: false });
    });
    toast({ title: link ? t.sop.campaignLinked : t.sop.campaignUnlinked });
  };

  const publishedArticles = articles.filter((a: any) => a.isPublished);
  const activeCategories = categories.filter((c: any) => c.isActive);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          {t.sop.sopSettings}
        </CardTitle>
        <CardDescription>{t.sop.sopSettingsDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-4">{t.sop.loading}</div>
        ) : activeCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t.sop.noCategories}</p>
        ) : (
          <div className="space-y-4">
            {activeCategories.map((cat: any) => {
              const catArticles = publishedArticles.filter((a: any) => a.categoryId === cat.id);
              const linkedCount = catArticles.filter((a: any) => linkedArticleIds.includes(a.id)).length;
              const allLinked = catArticles.length > 0 && linkedCount === catArticles.length;
              return (
                <div key={cat.id} className="border rounded-lg p-3" data-testid={`sop-settings-cat-${cat.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{cat.name}</span>
                      {cat.countryCode && <span className="text-xs" title={cat.countryCode}>{{"SK":"🇸🇰","CZ":"🇨🇿","AT":"🇦🇹","US":"🇬🇧","HU":"🇭🇺","RO":"🇷🇴","IT":"🇮🇹","DE":"🇩🇪","GB":"🇬🇧"}[cat.countryCode] || cat.countryCode}</span>}
                      <Badge variant="outline" className="text-[10px] h-4">{linkedCount}/{catArticles.length}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant={allLinked ? "destructive" : "outline"} size="sm" className="h-7 text-xs" onClick={() => toggleCategory(cat.id, !allLinked)} data-testid={`sop-toggle-cat-${cat.id}`}>
                        {allLinked ? t.sop.unlinkCampaign : t.sop.linkCampaign} {t.sop.all}
                      </Button>
                    </div>
                  </div>
                  {catArticles.length > 0 && (
                    <div className="space-y-1 ml-7">
                      {catArticles.map((art: any) => {
                        const isLinked = linkedArticleIds.includes(art.id);
                        return (
                          <label key={art.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5" data-testid={`sop-toggle-article-${art.id}`}>
                            <input
                              type="checkbox"
                              checked={isLinked}
                              onChange={() => linkMutation.mutate({ articleId: art.id, link: !isLinked })}
                              className="rounded border-gray-300"
                            />
                            <span className={isLinked ? "font-medium" : "text-muted-foreground"}>{art.title}</span>
                            {art.countryCode && <span className="text-xs opacity-70" title={art.countryCode}>{{"SK":"🇸🇰","CZ":"🇨🇿","AT":"🇦🇹","US":"🇬🇧","HU":"🇭🇺","RO":"🇷🇴","IT":"🇮🇹","DE":"🇩🇪","GB":"🇬🇧"}[art.countryCode] || art.countryCode}</span>}
                            {art.priority === "critical" && <Badge variant="destructive" className="text-[9px] h-4">!</Badge>}
                            {art.priority === "high" && <Badge className="text-[9px] h-4 bg-orange-500">!</Badge>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CriteriaCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<CriteriaGroup[]>(() => {
    try {
      return campaign.criteria ? JSON.parse(campaign.criteria) : [];
    } catch {
      return [];
    }
  });
  const [hasChanges, setHasChanges] = useState(false);

  const saveCriteriaMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        criteria: JSON.stringify(criteria),
      });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  const handleCriteriaChange = (newCriteria: CriteriaGroup[]) => {
    setCriteria(newCriteria);
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>{t.campaigns.detail.targetCriteria}</CardTitle>
            <CardDescription>
              {t.campaigns.detail.targetCriteriaDesc}
            </CardDescription>
          </div>
          {hasChanges && (
            <Button
              onClick={() => saveCriteriaMutation.mutate()}
              disabled={saveCriteriaMutation.isPending}
              data-testid="button-save-criteria"
            >
              {saveCriteriaMutation.isPending ? t.campaigns.detail.saving : t.common.save}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CriteriaBuilder
          criteria={criteria}
          onChange={handleCriteriaChange}
          readonly={campaign.status !== "draft"}
        />
      </CardContent>
    </Card>
  );
}

type ContactSortRule = {
  id: string;
  contactType: string;
  sortField: string;
  sortDirection: "asc" | "desc";
  conditionField: string;
  conditionOp: string;
  conditionValue: string;
};

type SortFieldOption = { value: string; entity: string; labelKey?: string; label?: string; group: string };

const SORT_FIELD_OPTIONS: SortFieldOption[] = [
  { value: "createdAt", entity: "contact", labelKey: "sortFieldCreatedAt", group: "Campaign Contact" },
  { value: "status", entity: "contact", labelKey: "sortFieldStatus", group: "Campaign Contact" },
  { value: "attemptCount", entity: "contact", labelKey: "sortFieldAttemptCount", group: "Campaign Contact" },
  { value: "priorityScore", entity: "contact", labelKey: "sortFieldPriorityScore", group: "Campaign Contact" },
  { value: "callbackDate", entity: "contact", labelKey: "sortFieldNextContactDate", group: "Campaign Contact" },
  { value: "dispositionCode", entity: "contact", labelKey: "sortFieldLastCallResult", group: "Campaign Contact" },
  { value: "lastAttemptAt", entity: "contact", labelKey: "sortFieldLastAttemptAt", group: "Campaign Contact" },
  { value: "contactedAt", entity: "contact", labelKey: "sortFieldContactedAt", group: "Campaign Contact" },
  { value: "completedAt", entity: "contact", labelKey: "sortFieldCompletedAt", group: "Campaign Contact" },
  { value: "assignedTo", entity: "contact", labelKey: "sortFieldAssignedTo", group: "Campaign Contact" },
  { value: "notes", entity: "contact", labelKey: "sortFieldNotes", group: "Campaign Contact" },

  { value: "customer.titleBefore", entity: "customer", label: "Titul pred menom", group: "Customer" },
  { value: "customer.firstName", entity: "customer", labelKey: "sortFieldName", group: "Customer" },
  { value: "customer.lastName", entity: "customer", labelKey: "sortFieldLastName", group: "Customer" },
  { value: "customer.maidenName", entity: "customer", labelKey: "sortFieldMaidenName", group: "Customer" },
  { value: "customer.titleAfter", entity: "customer", label: "Titul za menom", group: "Customer" },
  { value: "customer.phone", entity: "customer", labelKey: "sortFieldPhone", group: "Customer" },
  { value: "customer.mobile", entity: "customer", labelKey: "sortFieldMobile", group: "Customer" },
  { value: "customer.mobile2", entity: "customer", label: "Mobil 2", group: "Customer" },
  { value: "customer.otherContact", entity: "customer", label: "Iný kontakt", group: "Customer" },
  { value: "customer.email", entity: "customer", labelKey: "sortFieldEmail", group: "Customer" },
  { value: "customer.email2", entity: "customer", label: "Email 2", group: "Customer" },
  { value: "customer.dateOfBirth", entity: "customer", labelKey: "sortFieldDateOfBirth", group: "Customer" },
  { value: "customer.idCardNumber", entity: "customer", label: "Číslo OP", group: "Customer" },
  { value: "customer.nationalId", entity: "customer", labelKey: "sortFieldNationalId", group: "Customer" },
  { value: "customer.country", entity: "customer", labelKey: "sortFieldCountry", group: "Customer" },
  { value: "customer.city", entity: "customer", labelKey: "sortFieldCity", group: "Customer" },
  { value: "customer.address", entity: "customer", labelKey: "sortFieldAddress", group: "Customer" },
  { value: "customer.postalCode", entity: "customer", labelKey: "sortFieldPostalCode", group: "Customer" },
  { value: "customer.region", entity: "customer", labelKey: "sortFieldRegion", group: "Customer" },
  { value: "customer.district", entity: "customer", label: "Okres", group: "Customer" },
  { value: "customer.useCorrespondenceAddress", entity: "customer", label: "Korešpondenčná adresa", group: "Customer" },
  { value: "customer.corrCity", entity: "customer", label: "Mesto (korešp.)", group: "Customer" },
  { value: "customer.corrAddress", entity: "customer", label: "Adresa (korešp.)", group: "Customer" },
  { value: "customer.corrPostalCode", entity: "customer", label: "PSČ (korešp.)", group: "Customer" },
  { value: "customer.corrRegion", entity: "customer", label: "Oblasť (korešp.)", group: "Customer" },
  { value: "customer.corrCountry", entity: "customer", label: "Krajina (korešp.)", group: "Customer" },
  { value: "customer.bankAccount", entity: "customer", label: "IBAN", group: "Customer" },
  { value: "customer.bankCode", entity: "customer", label: "Kód banky", group: "Customer" },
  { value: "customer.bankName", entity: "customer", label: "Názov banky", group: "Customer" },
  { value: "customer.bankSwift", entity: "customer", label: "SWIFT", group: "Customer" },
  { value: "customer.gynecologistName", entity: "customer", label: "Gynekológ – meno", group: "Customer" },
  { value: "customer.gynecologistPhone", entity: "customer", label: "Gynekológ – telefón", group: "Customer" },
  { value: "customer.gynecologistEmail", entity: "customer", label: "Gynekológ – email", group: "Customer" },
  { value: "customer.expectedDeliveryDate", entity: "customer", label: "Termín pôrodu", group: "Customer" },
  { value: "customer.hospitalName", entity: "customer", label: "Pôrodnica", group: "Customer" },
  { value: "customer.registrationSource", entity: "customer", label: "Zdroj registrácie", group: "Customer" },
  { value: "customer.registrationDate", entity: "customer", label: "Dátum registrácie", group: "Customer" },
  { value: "customer.clientStatus", entity: "customer", labelKey: "sortFieldClientStatus", group: "Customer" },
  { value: "customer.leadStatus", entity: "customer", labelKey: "sortFieldLeadStatus", group: "Customer" },
  { value: "customer.leadScore", entity: "customer", labelKey: "sortFieldLeadScore", group: "Customer" },
  { value: "customer.serviceType", entity: "customer", labelKey: "sortFieldServiceType", group: "Customer" },
  { value: "customer.newsletter", entity: "customer", labelKey: "sortFieldNewsletter", group: "Customer" },
  { value: "customer.notes", entity: "customer", labelKey: "sortFieldNotes", group: "Customer" },
  { value: "customer.createdAt", entity: "customer", labelKey: "sortFieldCreatedAt", group: "Customer" },

  { value: "hospital.name", entity: "hospital", labelKey: "sortFieldName", group: "Hospital" },
  { value: "hospital.fullName", entity: "hospital", labelKey: "sortFieldFullName", group: "Hospital" },
  { value: "hospital.contactPerson", entity: "hospital", labelKey: "sortFieldContactPerson", group: "Hospital" },
  { value: "hospital.streetNumber", entity: "hospital", label: "Ulica a číslo", group: "Hospital" },
  { value: "hospital.city", entity: "hospital", labelKey: "sortFieldCity", group: "Hospital" },
  { value: "hospital.postalCode", entity: "hospital", label: "PSČ", group: "Hospital" },
  { value: "hospital.region", entity: "hospital", labelKey: "sortFieldRegion", group: "Hospital" },
  { value: "hospital.district", entity: "hospital", label: "Okres", group: "Hospital" },
  { value: "hospital.countryCode", entity: "hospital", labelKey: "sortFieldCountry", group: "Hospital" },
  { value: "hospital.phone", entity: "hospital", labelKey: "sortFieldPhone", group: "Hospital" },
  { value: "hospital.email", entity: "hospital", labelKey: "sortFieldEmail", group: "Hospital" },
  { value: "hospital.isActive", entity: "hospital", labelKey: "sortFieldIsActive", group: "Hospital" },
  { value: "hospital.autoRecruiting", entity: "hospital", labelKey: "sortFieldAutoRecruiting", group: "Hospital" },
  { value: "hospital.svetZdravia", entity: "hospital", labelKey: "sortFieldSvetZdravia", group: "Hospital" },
  { value: "hospital.latitude", entity: "hospital", label: "GPS šírka", group: "Hospital" },
  { value: "hospital.longitude", entity: "hospital", label: "GPS dĺžka", group: "Hospital" },
  { value: "hospital.createdAt", entity: "hospital", labelKey: "sortFieldCreatedAt", group: "Hospital" },

  { value: "clinic.name", entity: "clinic", labelKey: "sortFieldName", group: "Clinic" },
  { value: "clinic.doctorName", entity: "clinic", labelKey: "sortFieldDoctorName", group: "Clinic" },
  { value: "clinic.doctorTitle", entity: "clinic", labelKey: "sortFieldDoctorTitle", group: "Clinic" },
  { value: "clinic.doctorFirstName", entity: "clinic", label: "Krstné meno lekára", group: "Clinic" },
  { value: "clinic.doctorLastName", entity: "clinic", label: "Priezvisko lekára", group: "Clinic" },
  { value: "clinic.idZz", entity: "clinic", label: "ID ZZ", group: "Clinic" },
  { value: "clinic.pzsCode", entity: "clinic", label: "Kód PZS", group: "Clinic" },
  { value: "clinic.pzsName", entity: "clinic", label: "Názov PZS", group: "Clinic" },
  { value: "clinic.ico", entity: "clinic", label: "IČO", group: "Clinic" },
  { value: "clinic.address", entity: "clinic", label: "Adresa", group: "Clinic" },
  { value: "clinic.street", entity: "clinic", label: "Ulica", group: "Clinic" },
  { value: "clinic.streetNumber", entity: "clinic", label: "Súpisné číslo", group: "Clinic" },
  { value: "clinic.orientationNumber", entity: "clinic", label: "Orientačné číslo", group: "Clinic" },
  { value: "clinic.city", entity: "clinic", labelKey: "sortFieldCity", group: "Clinic" },
  { value: "clinic.postalCode", entity: "clinic", label: "PSČ", group: "Clinic" },
  { value: "clinic.region", entity: "clinic", label: "Oblasť (Kraj)", group: "Clinic" },
  { value: "clinic.district", entity: "clinic", label: "Okres", group: "Clinic" },
  { value: "clinic.countryCode", entity: "clinic", labelKey: "sortFieldCountry", group: "Clinic" },
  { value: "clinic.phone", entity: "clinic", labelKey: "sortFieldPhone", group: "Clinic" },
  { value: "clinic.phone2", entity: "clinic", label: "Telefón 2", group: "Clinic" },
  { value: "clinic.phone3", entity: "clinic", label: "Telefón 3", group: "Clinic" },
  { value: "clinic.email", entity: "clinic", labelKey: "sortFieldEmail", group: "Clinic" },
  { value: "clinic.email2", entity: "clinic", label: "Email 2", group: "Clinic" },
  { value: "clinic.email3", entity: "clinic", label: "Email 3", group: "Clinic" },
  { value: "clinic.website", entity: "clinic", labelKey: "sortFieldWebsite", group: "Clinic" },
  { value: "clinic.isActive", entity: "clinic", labelKey: "sortFieldIsActive", group: "Clinic" },
  { value: "clinic.isReferredByDoctor", entity: "clinic", labelKey: "sortFieldIsReferredByDoctor", group: "Clinic" },
  { value: "clinic.isFromConference", entity: "clinic", labelKey: "sortFieldIsFromConference", group: "Clinic" },
  { value: "clinic.conferenceName", entity: "clinic", labelKey: "sortFieldConferenceName", group: "Clinic" },
  { value: "clinic.conferenceDate", entity: "clinic", labelKey: "sortFieldConferenceDate", group: "Clinic" },
  { value: "clinic.leadSource", entity: "clinic", labelKey: "sortFieldLeadSource", group: "Clinic" },
  { value: "clinic.leadSourceDate", entity: "clinic", labelKey: "sortFieldLeadSourceDate", group: "Clinic" },
  { value: "clinic.leadSourceNotes", entity: "clinic", labelKey: "sortFieldLeadSourceNotes", group: "Clinic" },
  { value: "clinic.initialStatus", entity: "clinic", labelKey: "sortFieldInitialStatus", group: "Clinic" },
  { value: "clinic.interestCooperation", entity: "clinic", labelKey: "sortFieldInterestCooperation", group: "Clinic" },
  { value: "clinic.interestContract", entity: "clinic", labelKey: "sortFieldInterestContract", group: "Clinic" },
  { value: "clinic.contractStatus", entity: "clinic", labelKey: "sortFieldContractStatus", group: "Clinic" },
  { value: "clinic.contractSentDate", entity: "clinic", labelKey: "sortFieldContractSentDate", group: "Clinic" },
  { value: "clinic.contractReturnedDate", entity: "clinic", labelKey: "sortFieldContractReturnedDate", group: "Clinic" },
  { value: "clinic.lastCallResult", entity: "clinic", labelKey: "sortFieldLastCallResult", group: "Clinic" },
  { value: "clinic.lastCallNote", entity: "clinic", label: "Posledná poznámka z hovoru", group: "Clinic" },
  { value: "clinic.nextContactDate", entity: "clinic", labelKey: "sortFieldNextContactDate", group: "Clinic" },
  { value: "clinic.hasFlyers", entity: "clinic", labelKey: "sortFieldHasFlyers", group: "Clinic" },
  { value: "clinic.flyersSentDate", entity: "clinic", labelKey: "sortFieldFlyersSentDate", group: "Clinic" },
  { value: "clinic.flyersLocation", entity: "clinic", label: "Umiestnenie letákov", group: "Clinic" },
  { value: "clinic.notes", entity: "clinic", labelKey: "sortFieldNotes", group: "Clinic" },
  { value: "clinic.createdAt", entity: "clinic", labelKey: "sortFieldCreatedAt", group: "Clinic" },

  { value: "collaborator.titleBefore", entity: "collaborator", label: "Titul pred menom", group: "Collaborator" },
  { value: "collaborator.firstName", entity: "collaborator", labelKey: "sortFieldName", group: "Collaborator" },
  { value: "collaborator.middleName", entity: "collaborator", label: "Stredné meno", group: "Collaborator" },
  { value: "collaborator.lastName", entity: "collaborator", labelKey: "sortFieldLastName", group: "Collaborator" },
  { value: "collaborator.maidenName", entity: "collaborator", label: "Rodné meno", group: "Collaborator" },
  { value: "collaborator.titleAfter", entity: "collaborator", label: "Titul za menom", group: "Collaborator" },
  { value: "collaborator.countryCode", entity: "collaborator", labelKey: "sortFieldCountry", group: "Collaborator" },
  { value: "collaborator.birthNumber", entity: "collaborator", label: "Rodné číslo", group: "Collaborator" },
  { value: "collaborator.birthYear", entity: "collaborator", label: "Rok narodenia", group: "Collaborator" },
  { value: "collaborator.birthMonth", entity: "collaborator", label: "Mesiac narodenia", group: "Collaborator" },
  { value: "collaborator.birthDay", entity: "collaborator", label: "Deň narodenia", group: "Collaborator" },
  { value: "collaborator.birthPlace", entity: "collaborator", label: "Miesto narodenia", group: "Collaborator" },
  { value: "collaborator.maritalStatus", entity: "collaborator", label: "Rodinný stav", group: "Collaborator" },
  { value: "collaborator.professionalClassification", entity: "collaborator", label: "Profesijné zaradenie", group: "Collaborator" },
  { value: "collaborator.highestEducation", entity: "collaborator", label: "Najvyššie vzdelanie", group: "Collaborator" },
  { value: "collaborator.workplaceName", entity: "collaborator", label: "Pracovisko", group: "Collaborator" },
  { value: "collaborator.isManager", entity: "collaborator", label: "Manažér", group: "Collaborator" },
  { value: "collaborator.collaboratorType", entity: "collaborator", labelKey: "sortFieldCollaboratorType", group: "Collaborator" },
  { value: "collaborator.partnerCategory", entity: "collaborator", label: "Kategória partnera", group: "Collaborator" },
  { value: "collaborator.agreementType", entity: "collaborator", label: "Typ zmluvy", group: "Collaborator" },
  { value: "collaborator.leadSource", entity: "collaborator", label: "Zdroj kontaktu", group: "Collaborator" },
  { value: "collaborator.conferenceName", entity: "collaborator", label: "Názov konferencie", group: "Collaborator" },
  { value: "collaborator.isReferredByDoctor", entity: "collaborator", label: "Odporúčaný lekárom", group: "Collaborator" },
  { value: "collaborator.isFromConference", entity: "collaborator", label: "Z konferencie", group: "Collaborator" },
  { value: "collaborator.phone", entity: "collaborator", labelKey: "sortFieldPhone", group: "Collaborator" },
  { value: "collaborator.mobile", entity: "collaborator", label: "Mobil", group: "Collaborator" },
  { value: "collaborator.mobile2", entity: "collaborator", label: "Mobil 2", group: "Collaborator" },
  { value: "collaborator.otherContact", entity: "collaborator", label: "Iný kontakt", group: "Collaborator" },
  { value: "collaborator.email", entity: "collaborator", labelKey: "sortFieldEmail", group: "Collaborator" },
  { value: "collaborator.bankAccountIban", entity: "collaborator", label: "IBAN", group: "Collaborator" },
  { value: "collaborator.swiftCode", entity: "collaborator", label: "SWIFT", group: "Collaborator" },
  { value: "collaborator.clientContact", entity: "collaborator", labelKey: "sortFieldClientContact", group: "Collaborator" },
  { value: "collaborator.isActive", entity: "collaborator", labelKey: "sortFieldCollaboratorIsActive", group: "Collaborator" },
  { value: "collaborator.svetZdravia", entity: "collaborator", labelKey: "sortFieldSvetZdravia", group: "Collaborator" },
  { value: "collaborator.companyName", entity: "collaborator", label: "Názov spoločnosti", group: "Collaborator" },
  { value: "collaborator.ico", entity: "collaborator", label: "IČO", group: "Collaborator" },
  { value: "collaborator.dic", entity: "collaborator", label: "DIČ", group: "Collaborator" },
  { value: "collaborator.icDph", entity: "collaborator", label: "IČ DPH", group: "Collaborator" },
  { value: "collaborator.monthRewards", entity: "collaborator", labelKey: "sortFieldMonthRewards", group: "Collaborator" },
  { value: "collaborator.rewardType", entity: "collaborator", labelKey: "sortFieldRewardType", group: "Collaborator" },
  { value: "collaborator.fixedRewardAmount", entity: "collaborator", label: "Fixná odmena – suma", group: "Collaborator" },
  { value: "collaborator.fixedRewardCurrency", entity: "collaborator", label: "Fixná odmena – mena", group: "Collaborator" },
  { value: "collaborator.mobileAppEnabled", entity: "collaborator", labelKey: "sortFieldMobileAppEnabled", group: "Collaborator" },
  { value: "collaborator.lastMobileLogin", entity: "collaborator", labelKey: "sortFieldLastMobileLogin", group: "Collaborator" },
  { value: "collaborator.mobileLastActiveAt", entity: "collaborator", label: "Posledná aktivita v app", group: "Collaborator" },
  { value: "collaborator.canEditHospitals", entity: "collaborator", label: "Môže upravovať nemocnice", group: "Collaborator" },
  { value: "collaborator.preferredLanguage", entity: "collaborator", label: "Preferovaný jazyk", group: "Collaborator" },
  { value: "collaborator.note", entity: "collaborator", label: "Poznámka", group: "Collaborator" },
  { value: "collaborator.createdAt", entity: "collaborator", labelKey: "sortFieldCreatedAt", group: "Collaborator" },
];

const CONDITION_OPS = [
  { value: "equals", labelKey: "sortRuleEquals" },
  { value: "not_equals", labelKey: "sortRuleNotEquals" },
  { value: "contains", labelKey: "sortRuleContains" },
  { value: "starts_with", labelKey: "sortRuleStartsWith" },
  { value: "ends_with", labelKey: "sortRuleEndsWith" },
  { value: "greater_than", labelKey: "sortRuleGreaterThan" },
  { value: "less_than", labelKey: "sortRuleLessThan" },
  { value: "greater_or_equal", labelKey: "sortRuleGreaterOrEqual" },
  { value: "less_or_equal", labelKey: "sortRuleLessOrEqual" },
  { value: "is_empty", labelKey: "sortRuleIsEmpty" },
  { value: "is_not_empty", labelKey: "sortRuleIsNotEmpty" },
  { value: "is_true", labelKey: "sortRuleIsTrue" },
  { value: "is_false", labelKey: "sortRuleIsFalse" },
];

function getFieldLabel(field: SortFieldOption, t: any): string {
  if (field.labelKey) {
    const tr = (t.campaigns.detail as any)[field.labelKey];
    if (tr) return tr;
  }
  if (field.label) return field.label;
  return field.value.split(".").pop() || field.value;
}

function newSortRule(): ContactSortRule {
  return { id: crypto.randomUUID(), contactType: "", sortField: "createdAt", sortDirection: "desc", conditionField: "", conditionOp: "", conditionValue: "" };
}

function resolveContactFieldValue(contact: any, fieldPath: string): any {
  if (fieldPath.includes(".")) {
    const [entity, field] = fieldPath.split(".", 2);
    const obj = contact[entity];
    if (!obj) return null;
    return obj[field] ?? null;
  }
  return contact[fieldPath] ?? null;
}

function checkRuleCondition(contact: any, rule: ContactSortRule): boolean {
  if (!rule.conditionField || !rule.conditionOp) return true;
  const val = resolveContactFieldValue(contact, rule.conditionField);
  const strVal = val == null ? "" : String(val).toLowerCase();
  const condVal = (rule.conditionValue || "").toLowerCase();
  switch (rule.conditionOp) {
    case "equals": return strVal === condVal;
    case "not_equals": return strVal !== condVal;
    case "contains": return strVal.includes(condVal);
    case "starts_with": return strVal.startsWith(condVal);
    case "ends_with": return strVal.endsWith(condVal);
    case "greater_than": { const n = parseFloat(strVal), c = parseFloat(condVal); return !isNaN(n) && !isNaN(c) ? n > c : strVal > condVal; }
    case "less_than": { const n = parseFloat(strVal), c = parseFloat(condVal); return !isNaN(n) && !isNaN(c) ? n < c : strVal < condVal; }
    case "greater_or_equal": { const n = parseFloat(strVal), c = parseFloat(condVal); return !isNaN(n) && !isNaN(c) ? n >= c : strVal >= condVal; }
    case "less_or_equal": { const n = parseFloat(strVal), c = parseFloat(condVal); return !isNaN(n) && !isNaN(c) ? n <= c : strVal <= condVal; }
    case "is_empty": return val == null || strVal === "";
    case "is_not_empty": return val != null && strVal !== "";
    case "is_true": return val === true || strVal === "true" || strVal === "1";
    case "is_false": return val === false || strVal === "false" || strVal === "0" || strVal === "";
    default: return true;
  }
}

function countMatchingContacts(contacts: any[], rule: ContactSortRule): number {
  return contacts.filter(c => {
    if (rule.contactType && c.contactType !== rule.contactType) return false;
    return checkRuleCondition(c, rule);
  }).length;
}

const KNOWN_FIELD_VALUES: Record<string, string[]> = {
  "status": ["pending", "contacted", "completed", "failed", "no_answer", "callback_scheduled", "not_interested"],
  "customer.clientStatus": ["potential", "in_process", "acquired", "terminated"],
  "customer.leadStatus": ["cold", "warm", "hot", "qualified"],
  "customer.serviceType": ["cord_blood", "cord_tissue", "both"],
  "customer.newsletter": ["true", "false"],
  "customer.useCorrespondenceAddress": ["true", "false"],
  "customer.registrationSource": ["web_form", "phone", "email", "in_person", "referral"],
  "clinic.leadSource": ["new_contact", "former_collaborator", "current_collaborator", "doctor_referral", "conference"],
  "clinic.initialStatus": ["new", "interested", "not_interested", "in_progress", "contracted"],
  "clinic.interestCooperation": ["yes", "no", "maybe", "pending"],
  "clinic.interestContract": ["yes", "no", "maybe", "pending"],
  "clinic.contractStatus": ["draft", "sent", "signed", "returned", "terminated"],
  "clinic.isReferredByDoctor": ["true", "false"],
  "clinic.isFromConference": ["true", "false"],
  "clinic.isActive": ["true", "false"],
  "clinic.hasFlyers": ["true", "false"],
  "hospital.isActive": ["true", "false"],
  "hospital.autoRecruiting": ["true", "false"],
  "hospital.svetZdravia": ["true", "false"],
  "collaborator.isActive": ["true", "false"],
  "collaborator.svetZdravia": ["true", "false"],
  "collaborator.clientContact": ["true", "false"],
  "collaborator.monthRewards": ["true", "false"],
  "collaborator.mobileAppEnabled": ["true", "false"],
  "collaborator.canEditHospitals": ["true", "false"],
  "collaborator.isManager": ["true", "false"],
  "collaborator.isReferredByDoctor": ["true", "false"],
  "collaborator.isFromConference": ["true", "false"],
  "collaborator.collaboratorType": ["doctor", "nurse", "midwife", "other"],
  "collaborator.rewardType": ["fixed", "percentage"],
  "collaborator.preferredLanguage": ["sk", "en", "cs", "hu", "ro", "it", "de"],
  "collaborator.maritalStatus": ["single", "married", "divorced", "widowed"],
};

function getDistinctFieldValues(contacts: any[], fieldPath: string, contactType: string): string[] {
  const knownVals = KNOWN_FIELD_VALUES[fieldPath];
  if (knownVals) return knownVals;
  const vals = new Set<string>();
  for (const c of contacts) {
    if (contactType && c.contactType !== contactType) continue;
    const v = resolveContactFieldValue(c, fieldPath);
    if (v != null && String(v).trim() !== "") {
      vals.add(String(v));
    }
  }
  const arr = Array.from(vals).sort((a, b) => a.localeCompare(b));
  return arr.length <= 200 ? arr : [];
}

function applySortRulesToContacts(contacts: any[], rules: ContactSortRule[]): any[] {
  if (!rules || rules.length === 0) return contacts;
  const sorted = [...contacts];
  sorted.sort((a, b) => {
    for (const rule of rules) {
      const aTypeMatch = !rule.contactType || a.contactType === rule.contactType;
      const bTypeMatch = !rule.contactType || b.contactType === rule.contactType;
      if (!aTypeMatch && !bTypeMatch) continue;
      if (!aTypeMatch) return 1;
      if (!bTypeMatch) return -1;
      const aCondMatch = checkRuleCondition(a, rule);
      const bCondMatch = checkRuleCondition(b, rule);
      if (!aCondMatch && !bCondMatch) continue;
      if (!aCondMatch) return 1;
      if (!bCondMatch) return -1;
      const aVal = resolveContactFieldValue(a, rule.sortField);
      const bVal = resolveContactFieldValue(b, rule.sortField);
      const aStr = aVal == null ? "" : String(aVal);
      const bStr = bVal == null ? "" : String(bVal);
      const aNum = parseFloat(aStr);
      const bNum = parseFloat(bStr);
      let cmp = 0;
      if (!isNaN(aNum) && !isNaN(bNum)) {
        cmp = aNum - bNum;
      } else {
        cmp = aStr.localeCompare(bStr);
      }
      if (cmp !== 0) return rule.sortDirection === "desc" ? -cmp : cmp;
    }
    return 0;
  });
  return sorted;
}

function SortRulesDialog({ campaign, open, onOpenChange, contacts }: { campaign: Campaign; open: boolean; onOpenChange: (open: boolean) => void; contacts: any[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [sortRules, setSortRules] = useState<ContactSortRule[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!open) return;
    try {
      if (campaign.settings) {
        const s = JSON.parse(campaign.settings);
        const LEGACY_FIELD_MAP: Record<string, string> = { dateOfBirth: "customer.dateOfBirth", priorityScore: "priorityScore", createdAt: "createdAt" };
        if (Array.isArray(s.contactSortRules) && s.contactSortRules.length > 0) {
          setSortRules(s.contactSortRules.map((r: any) => ({ ...newSortRule(), ...r, id: r.id || crypto.randomUUID() })));
        } else if (s.contactSortField) {
          const mappedField = LEGACY_FIELD_MAP[s.contactSortField] || s.contactSortField;
          setSortRules([{ id: crypto.randomUUID(), contactType: "", sortField: mappedField, sortDirection: s.contactSortOrder || "desc", conditionField: "", conditionOp: "", conditionValue: "" }]);
        } else {
          setSortRules([]);
        }
      } else {
        setSortRules([]);
      }
    } catch {
      setSortRules([]);
    }
    setHasChanges(false);
  }, [campaign.settings, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let existing: Record<string, any> = {};
      try {
        if (campaign.settings) existing = JSON.parse(campaign.settings);
      } catch {}
      const cleanRules = sortRules.map((r, i) => ({
        id: r.id, contactType: r.contactType, sortField: r.sortField, sortDirection: r.sortDirection,
        conditionField: r.conditionField, conditionOp: r.conditionOp, conditionValue: r.conditionValue, priority: i,
      }));
      const merged = {
        ...existing,
        contactSortRules: cleanRules,
        contactSortField: cleanRules[0]?.sortField || "createdAt",
        contactSortOrder: cleanRules[0]?.sortDirection || "desc",
      };
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, { settings: JSON.stringify(merged) });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  const addRule = () => { setSortRules(prev => [...prev, newSortRule()]); setHasChanges(true); };
  const removeRule = (id: string) => { setSortRules(prev => prev.filter(r => r.id !== id)); setHasChanges(true); };
  const updateRule = (id: string, updates: Partial<ContactSortRule>) => { setSortRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r)); setHasChanges(true); };
  const moveRule = (index: number, direction: "up" | "down") => {
    setSortRules(prev => {
      const arr = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
    setHasChanges(true);
  };

  const filteredFieldOptions = (contactType: string) => {
    if (!contactType) return SORT_FIELD_OPTIONS;
    return SORT_FIELD_OPTIONS.filter(f => f.entity === "contact" || f.entity === contactType);
  };

  const groupedFieldOptions = (contactType: string) => {
    const fields = filteredFieldOptions(contactType);
    const groups: Record<string, SortFieldOption[]> = {};
    fields.forEach(f => { (groups[f.group] = groups[f.group] || []).push(f); });
    return groups;
  };

  const needsValue = (op: string) => !["is_empty", "is_not_empty", "is_true", "is_false"].includes(op);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5" />
            {t.campaigns.detail.sortRulesTitle}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {t.campaigns.detail.sortRulesDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto -mx-6 px-6" style={{ maxHeight: "calc(85vh - 200px)" }}>
          <div className="space-y-3 pb-4">
            {sortRules.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border rounded-lg border-dashed">
                <ArrowUpDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">{t.campaigns.detail.sortRuleNoRules}</p>
                <p className="text-xs mt-1 max-w-md mx-auto">{t.campaigns.detail.sortRuleNoRulesDesc}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={addRule} data-testid="button-add-first-sort-rule">
                  <Plus className="w-4 h-4 mr-1" />
                  {t.campaigns.detail.sortRuleAdd}
                </Button>
              </div>
            ) : (
              sortRules.map((rule, index) => {
                const groups = groupedFieldOptions(rule.contactType);
                const condGroups = groupedFieldOptions(rule.contactType);
                return (
                  <div key={rule.id} className="border rounded-lg bg-muted/20" data-testid={`sort-rule-${index}`}>
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40 rounded-t-lg">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                        <Badge variant="outline" className="text-xs font-mono">
                          #{index + 1}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{t.campaigns.detail.sortRulePriority}</span>
                        <Badge variant="secondary" className="text-xs ml-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" data-testid={`sort-rule-${index}-match-count`}>
                          {countMatchingContacts(contacts, rule)} / {contacts.length} {t.campaigns.detail.contactsLabel || "kontaktov"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveRule(index, "up")} disabled={index === 0} data-testid={`sort-rule-${index}-move-up`}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveRule(index, "down")} disabled={index === sortRules.length - 1} data-testid={`sort-rule-${index}-move-down`}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeRule(rule.id)} data-testid={`sort-rule-${index}-remove`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">{t.campaigns.detail.sortRuleContactType}</Label>
                          <Select value={rule.contactType || "__all__"} onValueChange={(v) => updateRule(rule.id, { contactType: v === "__all__" ? "" : v, sortField: "createdAt", conditionField: "", conditionOp: "", conditionValue: "" })}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`sort-rule-${index}-contact-type`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">{t.campaigns.detail.sortRuleAllTypes}</SelectItem>
                              <SelectItem value="customer">Customer</SelectItem>
                              <SelectItem value="hospital">Hospital</SelectItem>
                              <SelectItem value="clinic">Clinic</SelectItem>
                              <SelectItem value="collaborator">Collaborator</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs font-medium">{t.campaigns.detail.sortRuleField}</Label>
                          <Select value={rule.sortField} onValueChange={(v) => updateRule(rule.id, { sortField: v })}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`sort-rule-${index}-sort-field`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {Object.entries(groups).map(([group, fields]) => (
                                <div key={group}>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">{group}</div>
                                  {fields.map(f => (
                                    <SelectItem key={f.value} value={f.value} className="pl-4 text-xs">
                                      {getFieldLabel(f, t)}
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">{t.campaigns.detail.sortRuleDirection}</Label>
                          <Select value={rule.sortDirection} onValueChange={(v) => updateRule(rule.id, { sortDirection: v as "asc" | "desc" })}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`sort-rule-${index}-direction`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asc">{t.campaigns.detail.sortRuleAsc}</SelectItem>
                              <SelectItem value="desc">{t.campaigns.detail.sortRuleDesc}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="border-t pt-2">
                        <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                          <Filter className="w-3 h-3" />
                          {t.campaigns.detail.sortRuleCondition}
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Select value={rule.conditionField || "__none__"} onValueChange={(v) => updateRule(rule.id, { conditionField: v === "__none__" ? "" : v, conditionOp: v === "__none__" ? "" : (rule.conditionOp || "equals"), conditionValue: v === "__none__" ? "" : rule.conditionValue })}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`sort-rule-${index}-cond-field`}>
                              <SelectValue placeholder={t.campaigns.detail.sortRuleConditionField} />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              <SelectItem value="__none__">—</SelectItem>
                              {Object.entries(condGroups).map(([group, fields]) => (
                                <div key={group}>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">{group}</div>
                                  {fields.map(f => (
                                    <SelectItem key={f.value} value={f.value} className="pl-4 text-xs">
                                      {getFieldLabel(f, t)}
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                          {rule.conditionField && (
                            <Select value={rule.conditionOp || "equals"} onValueChange={(v) => updateRule(rule.id, { conditionOp: v })}>
                              <SelectTrigger className="h-8 text-xs" data-testid={`sort-rule-${index}-cond-op`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITION_OPS.map(op => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {(t.campaigns.detail as any)[op.labelKey] || op.value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {rule.conditionField && needsValue(rule.conditionOp) && (() => {
                            const distinctVals = getDistinctFieldValues(contacts, rule.conditionField, rule.contactType);
                            if (distinctVals.length > 0) {
                              return (
                                <Select value={rule.conditionValue || "__custom__"} onValueChange={(v) => updateRule(rule.id, { conditionValue: v === "__custom__" ? "" : v })}>
                                  <SelectTrigger className="h-8 text-xs" data-testid={`sort-rule-${index}-cond-value`}>
                                    <SelectValue placeholder={t.campaigns.detail.sortRuleConditionValue} />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-52">
                                    <SelectItem value="__custom__" className="text-muted-foreground italic text-xs">— {t.campaigns.detail.sortRuleConditionValue} —</SelectItem>
                                    {distinctVals.map(v => (
                                      <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            }
                            return <Input className="h-8 text-xs" placeholder={t.campaigns.detail.sortRuleConditionValue} value={rule.conditionValue} onChange={(e) => updateRule(rule.id, { conditionValue: e.target.value })} data-testid={`sort-rule-${index}-cond-value`} />;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" size="sm" onClick={addRule} data-testid="button-add-sort-rule">
            <Plus className="w-4 h-4 mr-1" />
            {t.campaigns.detail.sortRuleAdd}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-sort-rules">
              {t.common.cancel}
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !hasChanges} data-testid="button-save-sort-rules">
              {saveMutation.isPending ? t.campaigns.detail.saving : t.common.save}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AutoModeCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [autoMode, setAutoMode] = useState(false);
  const [autoDelaySeconds, setAutoDelaySeconds] = useState(5);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    try {
      if (campaign.settings) {
        const s = JSON.parse(campaign.settings);
        setAutoMode(!!s.autoMode);
        setAutoDelaySeconds(s.autoDelaySeconds || 5);
      } else {
        setAutoMode(false);
        setAutoDelaySeconds(5);
      }
    } catch {
      setAutoMode(false);
      setAutoDelaySeconds(5);
    }
    setHasChanges(false);
  }, [campaign.settings]);

  const saveAutoModeMutation = useMutation({
    mutationFn: async () => {
      let existing: Record<string, any> = {};
      try {
        if (campaign.settings) existing = JSON.parse(campaign.settings);
      } catch {}
      const merged = { ...existing, autoMode, autoDelaySeconds };
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, { settings: JSON.stringify(merged) });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>{t.campaigns.detail.autoMode}</CardTitle>
            <CardDescription>{t.campaigns.detail.autoModeDesc}</CardDescription>
          </div>
          {hasChanges && (
            <Button onClick={() => saveAutoModeMutation.mutate()} disabled={saveAutoModeMutation.isPending} data-testid="button-save-auto-mode">
              {saveAutoModeMutation.isPending ? t.campaigns.detail.saving : t.common.save}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch checked={autoMode} onCheckedChange={(checked) => { setAutoMode(checked); setHasChanges(true); }} data-testid="switch-auto-mode" />
          <Label className="text-sm font-medium">{t.campaigns.detail.autoMode}</Label>
        </div>
        {autoMode && (
          <div className="space-y-4 pl-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Oneskorenie (sekundy)</Label>
              <Input type="number" min={1} max={120} value={autoDelaySeconds} onChange={(e) => { setAutoDelaySeconds(parseInt(e.target.value) || 5); setHasChanges(true); }} className="w-32" data-testid="input-auto-delay" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SchedulingCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleConfig>(() => {
    const defaults = getDefaultScheduleConfig();
    try {
      if (campaign.settings) {
        const parsed = JSON.parse(campaign.settings);
        return {
          maxAttemptsPerContact: parsed.maxAttemptsPerContact ?? defaults.maxAttemptsPerContact,
          minHoursBetweenAttempts: parsed.minHoursBetweenAttempts ?? defaults.minHoursBetweenAttempts,
          weeklySchedule: parsed.weeklySchedule ?? defaults.weeklySchedule,
        };
      }
      return defaults;
    } catch {
      return defaults;
    }
  });
  const [hasChanges, setHasChanges] = useState(false);

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      let existing: Record<string, any> = {};
      try {
        if (campaign.settings) existing = JSON.parse(campaign.settings);
      } catch {}
      const merged = { ...existing, ...schedule };
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        settings: JSON.stringify(merged),
      });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.scheduleSaved });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.scheduleError, variant: "destructive" });
    },
  });

  const handleScheduleChange = (newSchedule: ScheduleConfig) => {
    setSchedule(newSchedule);
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>{t.campaigns.detail.scheduling}</CardTitle>
            <CardDescription>
              {t.campaigns.detail.schedulingDesc}
            </CardDescription>
          </div>
          {hasChanges && (
            <Button
              onClick={() => saveScheduleMutation.mutate()}
              disabled={saveScheduleMutation.isPending}
              data-testid="button-save-schedule"
            >
              {saveScheduleMutation.isPending ? t.campaigns.detail.saving : t.common.save}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScheduleEditor
          schedule={schedule}
          onChange={handleScheduleChange}
          readonly={false}
        />
      </CardContent>
    </Card>
  );
}

function KpiTargetField({ 
  icon: Icon, label, description, hint, value, onChange, unit, min = 0, max = 999, testId 
}: {
  icon: any; label: string; description: string; hint: string;
  value: number; onChange: (v: number) => void; unit?: string;
  min?: number; max?: number; testId: string;
}) {
  return (
    <div className="space-y-1.5 p-4 rounded-lg border bg-muted/20">
      <Label className="text-sm font-medium flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-center gap-2 pt-1">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-28"
          data-testid={testId}
        />
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      <p className="text-xs text-muted-foreground/70 italic">{hint}</p>
    </div>
  );
}

const RECOMMENDED_CAMPAIGN_TARGETS = {
  campaignTotalContactsTarget: 500,
  campaignCompletionTarget: 80,
  campaignConversionTarget: 15,
  campaignRevenueTarget: 50000,
  campaignDurationDays: 30,
};

const RECOMMENDED_OPERATOR_TARGETS = {
  agentDailyCallsTarget: 80,
  agentDailyContactsTarget: 40,
  agentDailySuccessTarget: 8,
  agentConversionRateTarget: 20,
  agentAvgCallDurationTarget: 180,
  agentMaxIdleMinutes: 5,
  agentCallbackComplianceTarget: 95,
};

function KpiTargetsCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [targets, setTargets] = useState({
    campaignTotalContactsTarget: 0,
    campaignCompletionTarget: 0,
    campaignConversionTarget: 0,
    campaignRevenueTarget: 0,
    campaignDurationDays: 0,
    agentDailyCallsTarget: 0,
    agentDailyContactsTarget: 0,
    agentDailySuccessTarget: 0,
    agentConversionRateTarget: 0,
    agentAvgCallDurationTarget: 0,
    agentMaxIdleMinutes: 0,
    agentCallbackComplianceTarget: 0,
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    try {
      if (campaign.settings) {
        const s = JSON.parse(campaign.settings);
        if (s.kpiTargets) {
          setTargets(prev => ({ ...prev, ...s.kpiTargets }));
        }
      }
    } catch {}
  }, [campaign.settings]);

  const saveKpiMutation = useMutation({
    mutationFn: async () => {
      let existing: Record<string, any> = {};
      try {
        if (campaign.settings) existing = JSON.parse(campaign.settings);
      } catch {}
      const merged = { ...existing, kpiTargets: targets };
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        settings: JSON.stringify(merged),
      });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  const updateTarget = (key: string, value: number) => {
    setTargets(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const loadRecommendedCampaignTargets = () => {
    setTargets(prev => ({ ...prev, ...RECOMMENDED_CAMPAIGN_TARGETS }));
    setHasChanges(true);
  };

  const loadRecommendedOperatorTargets = () => {
    setTargets(prev => ({ ...prev, ...RECOMMENDED_OPERATOR_TARGETS }));
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5" />
            {t.campaigns.detail.kpiTargets}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t.campaigns.detail.kpiTotalContactsDesc}
          </p>
        </div>
        {hasChanges && (
          <Button
            onClick={() => saveKpiMutation.mutate()}
            disabled={saveKpiMutation.isPending}
            data-testid="button-save-kpi"
          >
            {saveKpiMutation.isPending ? t.campaigns.detail.saving : t.common.save}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5" />
            {t.campaigns.detail.kpiTargets}
          </CardTitle>
          <CardDescription>
            {t.campaigns.detail.kpiTotalContactsDesc}
          </CardDescription>
          <Button variant="outline" size="sm" className="mt-2" onClick={loadRecommendedCampaignTargets} data-testid="button-load-recommended-campaign">
            <Wand2 className="h-4 w-4 mr-1" />
            {t.campaigns.detail.kpiLoadRecommended || 'Load recommended values'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiTargetField
              icon={Users}
              label={t.campaigns.detail.kpiTotalContacts}
              description={t.campaigns.detail.kpiTotalContactsDesc}
              hint={t.campaigns.detail.kpiTotalContactsHint}
              value={targets.campaignTotalContactsTarget}
              onChange={(v) => updateTarget("campaignTotalContactsTarget", v)}
              unit=""
              max={100000}
              testId="input-campaign-total-contacts"
            />
            <KpiTargetField
              icon={CheckCircle}
              label={t.campaigns.detail.completionRate}
              description={t.campaigns.detail.completionRateDesc}
              hint={t.campaigns.detail.kpiCompletionRateHint}
              value={targets.campaignCompletionTarget}
              onChange={(v) => updateTarget("campaignCompletionTarget", v)}
              unit="%"
              max={100}
              testId="input-campaign-completion"
            />
            <KpiTargetField
              icon={Target}
              label={t.campaigns.detail.kpiMinConversionRate}
              description={t.campaigns.detail.kpiMinConversionRateDesc}
              hint={t.campaigns.detail.kpiConversionRateHint}
              value={targets.campaignConversionTarget}
              onChange={(v) => updateTarget("campaignConversionTarget", v)}
              unit="%"
              max={100}
              testId="input-campaign-conversion"
            />
            <KpiTargetField
              icon={Flag}
              label={t.campaigns.detail.kpiTargetRevenue}
              description={t.campaigns.detail.kpiTargetRevenueDesc}
              hint={t.campaigns.detail.kpiRevenueHint}
              value={targets.campaignRevenueTarget}
              onChange={(v) => updateTarget("campaignRevenueTarget", v)}
              unit="EUR"
              max={10000000}
              testId="input-campaign-revenue"
            />
            <KpiTargetField
              icon={Calendar}
              label={t.campaigns.detail.kpiPlannedDuration}
              description={t.campaigns.detail.kpiPlannedDurationDesc}
              hint={t.campaigns.detail.kpiPlannedDurationHint}
              value={targets.campaignDurationDays}
              onChange={(v) => updateTarget("campaignDurationDays", v)}
              unit={t.common.days}
              max={365}
              testId="input-campaign-duration"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-5 h-5" />
            {t.campaigns.detail.operator}
          </CardTitle>
          <CardDescription>
            {t.campaigns.detail.kpiDailyCallTarget}
          </CardDescription>
          <Button variant="outline" size="sm" className="mt-2" onClick={loadRecommendedOperatorTargets} data-testid="button-load-recommended-operator">
            <Wand2 className="h-4 w-4 mr-1" />
            {t.campaigns.detail.kpiLoadRecommended || 'Load recommended values'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiTargetField
              icon={Phone}
              label={t.campaigns.detail.kpiDailyCallTarget}
              description={t.campaigns.detail.kpiDailyCallTargetDesc}
              hint={t.campaigns.detail.kpiDailyCallTargetHint}
              value={targets.agentDailyCallsTarget}
              onChange={(v) => updateTarget("agentDailyCallsTarget", v)}
              unit=""
              max={500}
              testId="input-agent-daily-calls"
            />
            <KpiTargetField
              icon={UserCheck}
              label={t.campaigns.detail.kpiDailyContactTarget}
              description={t.campaigns.detail.kpiDailyContactTargetDesc}
              hint={t.campaigns.detail.kpiDailyContactTargetHint}
              value={targets.agentDailyContactsTarget}
              onChange={(v) => updateTarget("agentDailyContactsTarget", v)}
              unit=""
              max={500}
              testId="input-agent-daily-contacts"
            />
            <KpiTargetField
              icon={Star}
              label={t.campaigns.detail.kpiDailyConversionTarget}
              description={t.campaigns.detail.kpiDailyConversionTargetDesc}
              hint={t.campaigns.detail.kpiDailyConversionTargetHint}
              value={targets.agentDailySuccessTarget}
              onChange={(v) => updateTarget("agentDailySuccessTarget", v)}
              unit=""
              max={100}
              testId="input-agent-daily-success"
            />
            <KpiTargetField
              icon={Target}
              label={t.campaigns.detail.kpiMinConversionRate}
              description={t.campaigns.detail.kpiMinConversionRateDesc}
              hint={t.campaigns.detail.kpiAgentConversionRateHint}
              value={targets.agentConversionRateTarget}
              onChange={(v) => updateTarget("agentConversionRateTarget", v)}
              unit="%"
              max={100}
              testId="input-agent-conversion-rate"
            />
            <KpiTargetField
              icon={Clock}
              label={t.campaigns.detail.kpiAvgCallDuration}
              description={t.campaigns.detail.kpiAvgCallDurationDesc}
              hint={t.campaigns.detail.kpiAvgCallDurationHint}
              value={targets.agentAvgCallDurationTarget}
              onChange={(v) => updateTarget("agentAvgCallDurationTarget", v)}
              unit=""
              max={60}
              testId="input-agent-avg-call-duration"
            />
            <KpiTargetField
              icon={Clock}
              label={t.campaigns.detail.kpiMaxIdleTime}
              description={t.campaigns.detail.kpiMaxIdleTimeDesc}
              hint={t.campaigns.detail.kpiMaxIdleTimeHint}
              value={targets.agentMaxIdleMinutes}
              onChange={(v) => updateTarget("agentMaxIdleMinutes", v)}
              unit=""
              max={30}
              testId="input-agent-max-idle"
            />
            <KpiTargetField
              icon={CalendarPlus}
              label={t.campaigns.detail.callbackScheduled}
              description={t.campaigns.detail.callbackScheduledDesc}
              hint={t.campaigns.detail.kpiCallbackComplianceHint}
              value={targets.agentCallbackComplianceTarget}
              onChange={(v) => updateTarget("agentCallbackComplianceTarget", v)}
              unit="%"
              max={100}
              testId="input-agent-callback-compliance"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const ACTION_TYPE_COLORS: Record<string, string> = {
  callback: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  dnd: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  complete: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  convert: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  send_email: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  send_sms: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  schedule_email: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  schedule_sms: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  none: "bg-muted text-muted-foreground",
};

const STATUS_ACTION_LABELS: Record<string, string> = {
  none: "Žiadna", callback: "Spätné volanie", reschedule: "Preplánovať hovor",
  do_not_call: "Nevolať", complete: "Dokončiť", conversion: "Konverzia",
  send_email: "Odoslať email", send_sms: "Odoslať SMS",
  schedule_email: "Naplánovať email", schedule_sms: "Naplánovať SMS",
  assign_owner: "Priradiť vlastníkovi", move_queue: "Presunúť do fronty",
  start_onboarding: "Spustiť onboarding", create_task: "Vytvoriť task",
  verify_contact: "Verifikácia kontaktu",
};

const STATUS_ACTION_COLORS: Record<string, string> = {
  none: "bg-gray-100 text-gray-700", callback: "bg-blue-100 text-blue-700",
  reschedule: "bg-sky-100 text-sky-700", do_not_call: "bg-red-100 text-red-700",
  complete: "bg-emerald-100 text-emerald-700", conversion: "bg-green-100 text-green-700",
  send_email: "bg-cyan-100 text-cyan-700", send_sms: "bg-purple-100 text-purple-700",
};

const CATEGORY_COLORS_MAP: Record<string, string> = {
  gray: "bg-gray-100 text-gray-800 border-gray-300", blue: "bg-blue-100 text-blue-800 border-blue-300",
  green: "bg-green-100 text-green-800 border-green-300", purple: "bg-purple-100 text-purple-800 border-purple-300",
  cyan: "bg-cyan-100 text-cyan-800 border-cyan-300", teal: "bg-teal-100 text-teal-800 border-teal-300",
  orange: "bg-orange-100 text-orange-800 border-orange-300", emerald: "bg-emerald-100 text-emerald-800 border-emerald-300",
  red: "bg-red-100 text-red-800 border-red-300", yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
};

const PULSE_STATUS_COLORS: Record<string, string> = {
  gray: "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700",
  blue: "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700",
  green: "bg-green-50 hover:bg-green-100 border-green-200 text-green-700",
  purple: "bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700",
  cyan: "bg-cyan-50 hover:bg-cyan-100 border-cyan-200 text-cyan-700",
  teal: "bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-700",
  orange: "bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700",
  emerald: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700",
  red: "bg-red-50 hover:bg-red-100 border-red-200 text-red-700",
  yellow: "bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700",
  indigo: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700",
  sky: "bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700",
  amber: "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700",
  lime: "bg-lime-50 hover:bg-lime-100 border-lime-200 text-lime-700",
  violet: "bg-violet-50 hover:bg-violet-100 border-violet-200 text-violet-700",
  rose: "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700",
  pink: "bg-pink-50 hover:bg-pink-100 border-pink-200 text-pink-700",
  fuchsia: "bg-fuchsia-50 hover:bg-fuchsia-100 border-fuchsia-200 text-fuchsia-700",
  slate: "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700",
};

function getStatusIcon(iconName: string | null | undefined): LucideIcon | null {
  if (!iconName) return null;
  return ICON_MAP[iconName] || null;
}

const PULSE_CATEGORY_COLORS: Record<string, { bg: string; border: string; icon: string; hoverBg: string }> = {
  gray: { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500", hoverBg: "hover:bg-slate-100" },
  blue: { bg: "bg-sky-50", border: "border-sky-200", icon: "text-sky-500", hoverBg: "hover:bg-sky-100" },
  green: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-500", hoverBg: "hover:bg-emerald-100" },
  purple: { bg: "bg-violet-50", border: "border-violet-200", icon: "text-violet-500", hoverBg: "hover:bg-violet-100" },
  cyan: { bg: "bg-cyan-50", border: "border-cyan-200", icon: "text-cyan-500", hoverBg: "hover:bg-cyan-100" },
  teal: { bg: "bg-teal-50", border: "border-teal-200", icon: "text-teal-500", hoverBg: "hover:bg-teal-100" },
  orange: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-500", hoverBg: "hover:bg-amber-100" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-500", hoverBg: "hover:bg-emerald-100" },
  red: { bg: "bg-rose-50", border: "border-rose-200", icon: "text-rose-500", hoverBg: "hover:bg-rose-100" },
  yellow: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-500", hoverBg: "hover:bg-amber-100" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-200", icon: "text-indigo-500", hoverBg: "hover:bg-indigo-100" },
  sky: { bg: "bg-sky-50", border: "border-sky-200", icon: "text-sky-500", hoverBg: "hover:bg-sky-100" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-500", hoverBg: "hover:bg-amber-100" },
  lime: { bg: "bg-lime-50", border: "border-lime-200", icon: "text-lime-600", hoverBg: "hover:bg-lime-100" },
  violet: { bg: "bg-violet-50", border: "border-violet-200", icon: "text-violet-500", hoverBg: "hover:bg-violet-100" },
  rose: { bg: "bg-rose-50", border: "border-rose-200", icon: "text-rose-500", hoverBg: "hover:bg-rose-100" },
  pink: { bg: "bg-pink-50", border: "border-pink-200", icon: "text-pink-500", hoverBg: "hover:bg-pink-100" },
  fuchsia: { bg: "bg-fuchsia-50", border: "border-fuchsia-200", icon: "text-fuchsia-500", hoverBg: "hover:bg-fuchsia-100" },
  slate: { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500", hoverBg: "hover:bg-slate-100" },
};

// ─── Campaign Disposition Manager ────────────────────────────────────────────

const ACTION_TYPE_LABEL: Record<string, { label: string; className: string }> = {
  callback:       { label: "Naplánovať hovor",  className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  schedule_email: { label: "Naplánovať email",  className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  schedule_sms:   { label: "Naplánovať SMS",    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  dnd:            { label: "Nezavolávať (DND)", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  complete:       { label: "Uzatvoriť",         className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  convert:        { label: "Konvertovať",       className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  send_email:     { label: "Poslať email",      className: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  send_sms:       { label: "Poslať SMS",        className: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  none:           { label: "Bez akcie",         className: "bg-muted text-muted-foreground" },
};

const DISP_COLORS = ["green","blue","orange","red","gray","yellow","purple"] as const;
const DISP_COLOR_STYLES: Record<string,string> = {
  green:  "bg-green-100  text-green-800  border-green-200  dark:bg-green-900/40  dark:text-green-200",
  blue:   "bg-blue-100   text-blue-800   border-blue-200   dark:bg-blue-900/40   dark:text-blue-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200",
  red:    "bg-red-100    text-red-800    border-red-200    dark:bg-red-900/40    dark:text-red-200",
  gray:   "bg-gray-100   text-gray-800   border-gray-200   dark:bg-gray-800      dark:text-gray-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200",
};
const DISP_COLOR_DOTS: Record<string,string> = {
  green:"bg-green-500", blue:"bg-blue-500", orange:"bg-orange-500",
  red:"bg-red-500", gray:"bg-gray-400", yellow:"bg-yellow-500", purple:"bg-purple-500",
};
const DISP_ICON_NAMES = [
  "CircleDot","ThumbsUp","ThumbsDown","CalendarPlus","PhoneOff","AlertCircle","XCircle",
  "Phone","Clock","Calendar","MessageSquare","FileText","Info","User","Mail","Star",
  "CheckCircle","Send","Ban","Heart","Bell","Flag","Target","Eye","Users","Home","MapPin",
  "Globe","Briefcase","Zap","UserCheck","UserX","Gift","Volume2","VolumeX",
] as const;
const DISP_ICON_MAP: Record<string, LucideIcon> = {
  CircleDot,ThumbsUp,ThumbsDown,CalendarPlus,PhoneOff,AlertCircle,XCircle,Phone,Clock,
  Calendar,MessageSquare,FileText,Info,User,Mail,Star,CheckCircle,Send,Ban,Heart,Bell,
  Flag,Target,Eye,Users,Home,MapPin,Globe,Briefcase,Zap,UserCheck,UserX,Gift,Volume2,VolumeX,
};
const DISP_ACTIONS = [
  { value:"none",           label:"Bez akcie"                 },
  { value:"callback",       label:"Naplánovať hovor"          },
  { value:"complete",       label:"Uzatvoriť kontakt"         },
  { value:"dnd",            label:"Nezavolávať (DND)"         },
  { value:"convert",        label:"Konvertovať kontakt"       },
  { value:"send_email",     label:"Poslať email ihneď"        },
  { value:"send_sms",       label:"Poslať SMS ihneď"          },
  { value:"schedule_email", label:"Naplánovať email"          },
  { value:"schedule_sms",   label:"Naplánovať SMS"            },
];

function nameToCode(name: string): string {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\s_]/g,"").trim().replace(/\s+/g,"_").slice(0,30);
}

type DispForm = { name:string; code:string; color:string; icon:string; actionType:string; callbackOffsetDays:number|null; childrenType:string; requiresNote:boolean; requiresCallback:boolean; isFinal:boolean; isConversion:boolean };
const EMPTY_FORM: DispForm = { name:"", code:"", color:"gray", icon:"CircleDot", actionType:"none", callbackOffsetDays:null, childrenType:"radio", requiresNote:false, requiresCallback:false, isFinal:false, isConversion:false };

function CampaignDispositionManager({ campaignId }: { campaignId: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [addingChildFor, setAddingChildFor] = useState<string|null>(null);
  const [childPickMode, setChildPickMode] = useState<"new"|"existing">("new");
  const [addingParent, setAddingParent] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewStep2, setPreviewStep2] = useState<string|null>(null);
  const [previewChecked, setPreviewChecked] = useState<string[]>([]);
  const [previewNote, setPreviewNote] = useState("");
  const [previewCallbackDate, setPreviewCallbackDate] = useState("");
  const [previewCallbackTime, setPreviewCallbackTime] = useState("09:00");
  const [previewAssigneeMode, setPreviewAssigneeMode] = useState<"me"|"all">("me");
  const [form, setForm] = useState<DispForm>(EMPTY_FORM);
  const [codeManual, setCodeManual] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importSearch, setImportSearch] = useState("");
  const [existingSearch, setExistingSearch] = useState("");

  const { data: dispositions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/dispositions`,{credentials:"include"}).then(r=>r.json()),
  });

  const parents = dispositions.filter((d:any)=>!d.parentId);
  const activeParents = parents.filter((d:any)=>d.isActive);
  const childrenOf = (id:string) => dispositions.filter((d:any)=>d.parentId===id && d.isActive);
  const invalidate = () => queryClient.invalidateQueries({queryKey:["/api/campaigns",campaignId,"dispositions"]});

  const { data: globalStatuses = [] } = useQuery<any[]>({ queryKey: ["/api/status-definitions"] });
  const { data: globalCategories = [] } = useQuery<any[]>({ queryKey: ["/api/status-categories"] });
  const { data: assignedStatusesData } = useQuery<{ categories: any[]; statuses: any[]; assignments: any[] }>({
    queryKey: ["/api/campaigns", campaignId, "assigned-statuses"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/assigned-statuses`, { credentials: "include" }).then(r => r.json()),
  });
  const previewUseNexus = !!(assignedStatusesData?.statuses?.length) && activeParents.length === 0;
  const previewNexusStatuses = previewUseNexus
    ? (assignedStatusesData!.statuses.map((s: any) => ({ ...s, actionType: s.defaultAction, isActive: s.isActive !== false })))
    : [];
  const previewNexusCategories = assignedStatusesData?.categories || [];

  const existingCodes = new Set(dispositions.map((d:any) => d.code));

  const createMut = useMutation({
    mutationFn: async (data:any) => {
      const res = await apiRequest("POST",`/api/campaigns/${campaignId}/dispositions`,data);
      if(!res.ok) throw new Error((await res.json()).error||"Chyba pri vytváraní");
      return res.json();
    },
    onSuccess: () => { invalidate(); setAddingParent(false); setAddingChildFor(null); setForm(EMPTY_FORM); setCodeManual(false); toast({title: t.statusEngine.disp.toastAdded}); },
    onError: (e:any)=>toast({title: t.statusEngine.disp.toastError, description:e.message, variant:"destructive"}),
  });

  const updateMut = useMutation({
    mutationFn: async ({id,data}:{id:string;data:any}) => {
      const res = await apiRequest("PATCH",`/api/campaigns/${campaignId}/dispositions/${id}`,data);
      if(!res.ok) throw new Error((await res.json()).error||"Error saving");
      return res.json();
    },
    onSuccess: () => { invalidate(); setEditingId(null); setForm(EMPTY_FORM); toast({title: t.statusEngine.disp.toastSaved}); },
    onError: (e:any)=>toast({title: t.statusEngine.disp.toastError, description:e.message, variant:"destructive"}),
  });

  const linkExistMut = useMutation({
    mutationFn: async ({id, parentId}:{id:string;parentId:string}) => {
      const res = await apiRequest("PATCH",`/api/campaigns/${campaignId}/dispositions/${id}`,{parentId});
      if(!res.ok) throw new Error((await res.json()).error||"Error linking");
      return res.json();
    },
    onSuccess: () => { invalidate(); setAddingChildFor(null); setChildPickMode("new"); toast({title: t.statusEngine.disp.toastLinked}); },
    onError: (e:any)=>toast({title: t.statusEngine.disp.toastError, description:e.message, variant:"destructive"}),
  });

  const deleteMut = useMutation({
    mutationFn: async (id:string) => {
      const res = await apiRequest("DELETE",`/api/campaigns/${campaignId}/dispositions/${id}`);
      if(!res.ok) throw new Error("Error deleting");
    },
    onSuccess: () => { invalidate(); toast({title: t.statusEngine.disp.toastDeleted}); },
    onError: (e:any)=>toast({title: t.statusEngine.disp.toastError, description:e.message, variant:"destructive"}),
  });

  const reorderMut = useMutation({
    mutationFn: async (items: {id:string;sortOrder:number}[]) => {
      const res = await apiRequest("POST",`/api/campaigns/${campaignId}/dispositions/reorder`,{items});
      if(!res.ok) throw new Error("Error reordering");
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (e:any)=>toast({title: t.statusEngine.disp.toastError, description:e.message, variant:"destructive"}),
  });

  const moveParent = (parentId:string, dir:-1|1) => {
    const sorted = [...activeParents].sort((a:any,b:any)=>(a.sortOrder??0)-(b.sortOrder??0));
    const idx = sorted.findIndex((p:any)=>p.id===parentId);
    const swapIdx = idx+dir;
    if(swapIdx<0||swapIdx>=sorted.length) return;
    const items = sorted.map((p:any,i:number)=>{
      if(i===idx) return {id:p.id, sortOrder: sorted[swapIdx].sortOrder??swapIdx*10};
      if(i===swapIdx) return {id:p.id, sortOrder: sorted[idx].sortOrder??idx*10};
      return {id:p.id, sortOrder: p.sortOrder??i*10};
    });
    reorderMut.mutate(items);
  };

  const importFromGlobalMut = useMutation({
    mutationFn: async ({status, parentId}:{status:any; parentId:string}) => {
      const code = existingCodes.has(status.code) ? `${status.code}_${Date.now()}` : status.code;
      const payload = {
        name: status.name,
        code,
        color: status.color || "gray",
        icon: status.icon || "CircleDot",
        actionType: status.defaultAction || "none",
        callbackOffsetDays: status.callbackOffsetDays || null,
        childrenType: "radio",
        channel: "phone",
        isActive: true,
        sortOrder: dispositions.length + 1,
        parentId,
        requiresNote: status.requiresNote || false,
        requiresCallback: status.requiresCallback || false,
        isFinal: status.isFinal || false,
        isConversion: status.isConversion || false,
      };
      const res = await apiRequest("POST",`/api/campaigns/${campaignId}/dispositions`,payload);
      if(!res.ok) throw new Error((await res.json()).error||"Chyba pri importovaní");
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({title: t.statusEngine.disp.toastAdded}); },
    onError: (e:any)=>toast({title: t.statusEngine.disp.toastError, description:e.message, variant:"destructive"}),
  });

  const importCategoryMut = useMutation({
    mutationFn: async (cat:any) => {
      const catStatuses = (globalStatuses as any[]).filter((s:any)=>s.categoryId===cat.id && s.isActive && !s.parentId);
      const parentCode = existingCodes.has(cat.code) ? `${cat.code}_${Date.now()}` : cat.code;
      const parentPayload = {
        name: cat.name,
        code: parentCode,
        color: cat.color || "gray",
        icon: cat.icon || "CircleDot",
        actionType: catStatuses.length > 0 ? "none" : "none",
        childrenType: "radio",
        channel: "phone",
        isActive: true,
        sortOrder: dispositions.length + 1,
        parentId: null,
      };
      const parentRes = await apiRequest("POST",`/api/campaigns/${campaignId}/dispositions`,parentPayload);
      if(!parentRes.ok) throw new Error("Chyba pri vytváraní rodičovského výsledku");
      const parent = await parentRes.json();
      for (let i = 0; i < catStatuses.length; i++) {
        const s = catStatuses[i];
        const childCode = existingCodes.has(s.code) ? `${s.code}_${i}` : s.code;
        await apiRequest("POST",`/api/campaigns/${campaignId}/dispositions`,{
          name: s.name, code: childCode,
          color: s.color || cat.color || "gray",
          icon: s.icon || "CircleDot",
          actionType: s.defaultAction || "none",
          callbackOffsetDays: s.callbackOffsetDays || null,
          childrenType: "radio", channel: "phone", isActive: true,
          sortOrder: i * 10, parentId: parent.id,
          requiresNote: s.requiresNote || false,
          requiresCallback: s.requiresCallback || false,
          isFinal: s.isFinal || false,
          isConversion: s.isConversion || false,
        });
      }
      return { count: catStatuses.length + 1, catName: cat.name };
    },
    onSuccess: (data) => {
      invalidate(); setShowImportPanel(false); setImportSearch("");
      toast({title: t.statusEngine.disp.toastAdded, description:`${data.catName}: ${data.count}`});
    },
    onError: (e:any)=>toast({title: t.statusEngine.disp.toastError, description:e.message, variant:"destructive"}),
  });

  const seedMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST",`/api/campaigns/${campaignId}/dispositions/seed`,{force: true});
      if(!res.ok) throw new Error("Error seeding defaults");
      return res.json();
    },
    onSuccess: (data:any) => { invalidate(); toast({title: t.statusEngine.disp.toastResetSuccess, description:`${Array.isArray(data)?data.length:0}`}); },
    onError: (e:any)=>toast({title: t.statusEngine.disp.toastError, description:e.message, variant:"destructive"}),
  });

  const typeMut = useMutation({
    mutationFn: async ({id,childrenType}:{id:string;childrenType:string}) => {
      const res = await apiRequest("PATCH",`/api/campaigns/${campaignId}/dispositions/${id}`,{childrenType});
      if(!res.ok) throw new Error("Error updating type");
      return res.json();
    },
    onSuccess: (_,vars) => { invalidate(); toast({title: vars.childrenType==="checklist" ? t.statusEngine.disp.listChoice : t.statusEngine.disp.oneChoice}); },
    onError: (e:any)=>toast({title: t.statusEngine.disp.toastError, description:e.message, variant:"destructive"}),
  });

  const startEdit = (disp:any) => {
    setEditingId(disp.id);
    setForm({ name:disp.name, code:disp.code, color:disp.color||"gray", icon:disp.icon||"CircleDot", actionType:disp.actionType||"none", callbackOffsetDays:disp.callbackOffsetDays??null, childrenType:disp.childrenType||"radio", requiresNote:(disp as any).requiresNote||false, requiresCallback:(disp as any).requiresCallback||false, isFinal:(disp as any).isFinal||false, isConversion:(disp as any).isConversion||false });
    setCodeManual(true);
    setExpandedId(disp.parentId||disp.id);
  };

  const cancelEdit = () => { setEditingId(null); setAddingParent(false); setAddingChildFor(null); setForm(EMPTY_FORM); setCodeManual(false); };

  const saveForm = (parentId?:string|null) => {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim()||nameToCode(form.name.trim()),
      color: form.color, icon: form.icon,
      actionType: form.actionType,
      callbackOffsetDays: form.actionType==="callback" ? form.callbackOffsetDays : null,
      childrenType: form.childrenType,
      requiresNote: form.requiresNote,
      requiresCallback: form.requiresCallback,
      isFinal: form.isFinal,
      isConversion: form.isConversion,
      channel:"phone", isActive:true,
      sortOrder: dispositions.length+1,
      parentId: parentId??null,
    };
    if(editingId) updateMut.mutate({id:editingId,data:payload});
    else createMut.mutate(payload);
  };

  // ── Inline form ──────────────────────────────────────────────────────────
  const DispFormUI = ({parentId}:{parentId?:string|null}) => (
    <div className="space-y-3 p-3 rounded-lg border bg-muted/20" onClick={e=>e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{t.statusEngine.name}</label>
          <input autoFocus value={form.name} placeholder={parentId?t.statusEngine.disp.namePHChild:t.statusEngine.disp.namePH}
            className="w-full h-8 mt-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            onChange={e=>{const n=e.target.value;setForm(f=>({...f,name:n,...(!codeManual?{code:nameToCode(n)}:{})}));}} />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{t.statusEngine.code}</label>
          <input value={form.code} placeholder={t.statusEngine.disp.codePH}
            className="w-full h-8 mt-1 rounded-md border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            onChange={e=>{setCodeManual(true);setForm(f=>({...f,code:e.target.value}));}} />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{t.statusEngine.color}</label>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {DISP_COLORS.map(c=>(
            <button key={c} onClick={()=>setForm(f=>({...f,color:c}))}
              className={`w-6 h-6 rounded-full border-2 transition-all ${DISP_COLOR_DOTS[c]} ${form.color===c?"border-foreground scale-110":"border-transparent"}`}
              title={c}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{t.statusEngine.icon}</label>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {DISP_ICON_NAMES.map(n=>{const I=DISP_ICON_MAP[n]||CircleDot; return(
            <button key={n} onClick={()=>setForm(f=>({...f,icon:n}))}
              className={`w-7 h-7 rounded border flex items-center justify-center transition-all ${form.icon===n?"bg-primary text-primary-foreground border-primary":"hover:bg-muted"}`}
              title={n}
            ><I className="h-3.5 w-3.5"/></button>
          );})}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{t.statusEngine.defaultAction}</label>
          <select value={form.actionType} onChange={e=>setForm(f=>({...f,actionType:e.target.value}))}
            className="w-full h-8 mt-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none">
            {DISP_ACTIONS.map(a=><option key={a.value} value={a.value}>{(t.statusEngine.actions as Record<string,string>)[a.value] ?? a.label}</option>)}
          </select>
        </div>
        {form.actionType==="callback" && (
          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{t.statusEngine.callbackOffsetDays}</label>
            <input type="number" min={0} max={365} value={form.callbackOffsetDays??""} placeholder={t.statusEngine.disp.cbDaysPH}
              className="w-full h-8 mt-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
              onChange={e=>setForm(f=>({...f,callbackOffsetDays:e.target.value?Number(e.target.value):null}))} />
          </div>
        )}
      </div>
      <div className="border-t pt-2 mt-1">
        <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-2 block">{t.statusEngine.disp.subresults}</label>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { key: "requiresNote" as const,     label: t.statusEngine.requiresNote,     cls: "text-amber-700 bg-amber-50 border-amber-200" },
            { key: "requiresCallback" as const, label: t.statusEngine.requiresCallback, cls: "text-blue-700 bg-blue-50 border-blue-200" },
            { key: "isFinal" as const,          label: t.statusEngine.isFinal,          cls: "text-red-700 bg-red-50 border-red-200" },
            { key: "isConversion" as const,     label: t.statusEngine.isConversion,     cls: "text-green-700 bg-green-50 border-green-200" },
          ] as { key: keyof DispForm & string; label: string; cls: string }[]).map(({key, label, cls})=>(
            <button key={key} type="button"
              onClick={()=>setForm(f=>({...f,[key]:!f[key as keyof DispForm]}))}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium transition-all ${form[key as keyof DispForm] ? cls : "text-muted-foreground bg-muted/30 border-muted"}`}>
              {form[key as keyof DispForm]
                ? <Check className="h-3 w-3 shrink-0"/>
                : <div className="h-3 w-3 rounded-sm border border-current shrink-0"/>}
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1 border-t mt-1">
        <Button variant="ghost" size="sm" onClick={cancelEdit}>{t.statusEngine.cancel}</Button>
        <Button size="sm" disabled={!form.name.trim()||createMut.isPending||updateMut.isPending} onClick={()=>saveForm(parentId)}>
          {(createMut.isPending||updateMut.isPending)?<Loader2 className="h-3.5 w-3.5 animate-spin mr-1"/>:<Check className="h-3.5 w-3.5 mr-1"/>}
          {editingId ? t.statusEngine.save : t.statusEngine.addStatus}
        </Button>
      </div>
    </div>
  );

  // ── Agent Preview ────────────────────────────────────────────────────────
  const AgentPreview = () => {
    if (previewUseNexus) {
      return (
        <div className="space-y-3">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-1 pb-1 border-b">
            <div className="w-2 h-2 rounded-full bg-primary/60 shrink-0"/>
            {t.statusEngine.disp.simClick}
          </div>
          <NexusPulseView
            categories={previewNexusCategories}
            statuses={previewNexusStatuses}
            getStatusName={(s) => s.name}
            onSelectStatus={(s) => {
              toast({ title: t.statusEngine.disp.simChecked, description: s.name });
            }}
          />
        </div>
      );
    }

    const colorBorderMap: Record<string,string> = {
      gray:"border-l-gray-400", red:"border-l-red-500", orange:"border-l-orange-500",
      amber:"border-l-amber-500", yellow:"border-l-yellow-400", green:"border-l-green-500",
      teal:"border-l-teal-500", cyan:"border-l-cyan-500", blue:"border-l-blue-500",
      indigo:"border-l-indigo-500", violet:"border-l-violet-500", purple:"border-l-purple-500",
      pink:"border-l-pink-500", rose:"border-l-rose-500",
    };
    return (
      <div className="space-y-2">
        {/* Hint */}
        {activeParents.length > 0 && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-1">
            {previewStep2
              ? <><div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0"/>{t.statusEngine.disp.simRunning}</>
              : <><ArrowRight className="h-3 w-3 shrink-0"/>{t.statusEngine.disp.simClick}</>
            }
          </div>
        )}

        {activeParents.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            {t.statusEngine.disp.noResults}
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden divide-y">
            {activeParents.map((parent:any) => {
              const kids = childrenOf(parent.id);
              const I = DISP_ICON_MAP[parent.icon||""]||CircleDot;
              const ai = ACTION_TYPE_LABEL[parent.actionType||"none"];
              const isSimulating = previewStep2 === parent.id;
              const isChecklist = parent.childrenType === "checklist";
              const borderCls = colorBorderMap[parent.color||"gray"] || "border-l-gray-400";
              return (
                <div key={parent.id} className={`transition-colors ${isSimulating?"bg-indigo-50/60 dark:bg-indigo-950/20":"bg-card"}`}>
                  <button
                    onClick={()=>{
                      if(isSimulating){ setPreviewStep2(null); setPreviewChecked([]); setPreviewNote(""); setPreviewCallbackDate(""); }
                      else { setPreviewStep2(parent.id); setPreviewChecked([]); setPreviewNote(""); setPreviewCallbackDate(""); }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors border-l-4 ${borderCls} ${isSimulating?"ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700":""}`}
                    data-testid={`preview-disp-${parent.id}`}
                  >
                    <I className="h-5 w-5 shrink-0 opacity-80"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm">{parent.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {kids.length>0
                          ? <span className="text-[11px] text-muted-foreground">{isChecklist?"☑ "+t.statusEngine.disp.listChoice:"◉ "+t.statusEngine.disp.oneChoice} · {kids.length} {t.statusEngine.disp.subCount}</span>
                          : <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ai.className}`}>{(t.statusEngine.actions as Record<string,string>)[parent.actionType] ?? ai.label}</span>
                        }
                      </div>
                    </div>
                    {kids.length>0
                      ? isSimulating ? <ChevronDown className="h-4 w-4 text-indigo-500 shrink-0"/> : <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0"/>
                      : <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0"/>
                    }
                  </button>

                  {kids.length>0 && (
                    <div className={`border-t border-dashed transition-colors ${isSimulating?"border-indigo-200 dark:border-indigo-800":"border-muted"}`}>
                      {kids.map((child:any, idx:number)=>{
                        const CI = DISP_ICON_MAP[child.icon||""]||CircleDot;
                        const cai = ACTION_TYPE_LABEL[child.actionType||"none"];
                        const isLast = idx === kids.length-1;
                        const isChecked = previewChecked.includes(child.code);
                        return (
                          <div key={child.id}
                            className={`flex items-center gap-2 pl-5 pr-3 py-2 text-sm border-b border-dashed last:border-b-0 transition-colors
                              ${isSimulating
                                ? isChecklist
                                  ? isChecked ? "bg-indigo-100/80 dark:bg-indigo-900/40 cursor-pointer" : "bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-100/60 cursor-pointer"
                                  : "bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-100/60 cursor-pointer"
                                : "bg-muted/10"
                              }`}
                            onClick={isSimulating && !isChecklist ? ()=>{
                              setPreviewStep2(null); setPreviewChecked([]); setPreviewNote(""); setPreviewCallbackDate("");
                              toast({title: t.statusEngine.disp.simSaved, description:`${parent.name} → ${child.name}`});
                            } : undefined}
                          >
                            <span className="font-mono text-[11px] text-muted-foreground/40 shrink-0 select-none">{isLast?"└":"├"}──</span>
                            {isSimulating && isChecklist && (
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={v=>setPreviewChecked(prev=>v?[...prev,child.code]:prev.filter((x:string)=>x!==child.code))}
                                className="shrink-0"
                                onClick={(e:React.MouseEvent)=>e.stopPropagation()}
                              />
                            )}
                            {isSimulating && !isChecklist && (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 shrink-0"/>
                            )}
                            {!isSimulating && <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0"/>}
                            <CI className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
                            <span className="flex-1 truncate text-sm">{child.name}</span>
                            <span className={`text-[10px] px-1 py-0.5 rounded shrink-0 ${cai.className}`}>{(t.statusEngine.actions as Record<string,string>)[child.actionType] ?? cai.label}</span>
                          </div>
                        );
                      })}
                      {isSimulating && isChecklist && (
                        <div className="flex items-center justify-between gap-2 px-5 py-2 bg-indigo-50 dark:bg-indigo-950/40 border-t border-indigo-200 dark:border-indigo-800">
                          <span className="text-xs text-indigo-600 dark:text-indigo-400">
                            {previewChecked.length>0 ? `${previewChecked.length} ${t.statusEngine.disp.simChecked}` : t.statusEngine.disp.simCheckAtLeastOne}
                          </span>
                          <Button size="sm" className="h-7 text-xs" disabled={previewChecked.length===0}
                            onClick={()=>{
                              const names = kids.filter((k:any)=>previewChecked.includes(k.code)).map((k:any)=>k.name).join(", ");
                              setPreviewStep2(null); setPreviewChecked([]);
                              toast({title: t.statusEngine.disp.simSaved, description:`${parent.name}: ${names}`});
                            }}
                          >
                            <Check className="h-3 w-3 mr-1"/>{t.statusEngine.disp.simConfirm} ({previewChecked.length})
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {isSimulating && (() => {
                    const needsCb = parent.requiresCallback || parent.actionType==="callback"||parent.actionType==="schedule_email"||parent.actionType==="schedule_sms";
                    const needsNote = parent.requiresNote;
                    if (!needsCb && !needsNote && kids.length > 0) return null;
                    const canConfirm = (!needsCb || previewCallbackDate) && (!needsNote || previewNote.trim());
                    return (
                      <div className="border-t border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 px-4 py-3 space-y-2">
                        {needsCb && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <input type="date"
                              value={previewCallbackDate}
                              min={new Date().toISOString().split("T")[0]}
                              onChange={e => setPreviewCallbackDate(e.target.value)}
                              className="h-7 text-xs border rounded px-2 bg-background"
                            />
                            <input type="time"
                              value={previewCallbackTime}
                              onChange={e => setPreviewCallbackTime(e.target.value)}
                              className="h-7 text-xs border rounded px-2 bg-background w-24"
                            />
                          </div>
                        )}
                        {needsNote && (
                          <textarea rows={2} value={previewNote} onChange={e=>setPreviewNote(e.target.value)}
                            placeholder={t.statusEngine.disp.simNotePlaceholder}
                            className="w-full text-xs border rounded px-2 py-1 bg-background resize-none border-amber-300 focus:border-amber-500 outline-none"
                          />
                        )}
                        <div className="flex items-center justify-between gap-2">
                          {(needsCb || needsNote) && !canConfirm && (
                            <span className="text-xs text-muted-foreground">
                              {needsNote && !previewNote.trim() ? t.statusEngine.disp.simFillNote : t.statusEngine.disp.simSelectDate}
                            </span>
                          )}
                          <span/>
                          <Button size="sm" className="h-7 text-xs" disabled={!canConfirm}
                            onClick={()=>{
                              setPreviewStep2(null); setPreviewChecked([]); setPreviewNote(""); setPreviewCallbackDate("");
                              const desc = [
                                needsCb && previewCallbackDate ? `📅 ${previewCallbackDate} ${previewCallbackTime}` : null,
                                needsNote && previewNote ? `📝 ${previewNote.slice(0,40)}` : null,
                              ].filter(Boolean).join(" · ") || (t.statusEngine.actions as Record<string,string>)[parent.actionType] || t.statusEngine.actions.none;
                              toast({title: t.statusEngine.disp.simSaved, description:`${parent.name} · ${desc}`});
                            }}
                          >
                            <Check className="h-3 w-3 mr-1"/>
                            {needsCb ? t.statusEngine.disp.simSchedule : t.statusEngine.disp.simConfirmResult}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
        {activeParents.length > 0 && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-1">
            <span>◉ = {t.statusEngine.disp.oneChoice}</span>
            <span>☑ = {t.statusEngine.disp.listChoice}</span>
            <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3"/>= {t.statusEngine.disp.directAction}</span>
          </div>
        )}
      </div>
    );
  };


  if(isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/></div>;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold">{t.statusEngine.disp.resultsTitle}</p>
          <p className="text-xs text-muted-foreground">
            {activeParents.length} {t.statusEngine.disp.mainCount} · {dispositions.filter((d:any)=>d.parentId&&d.isActive).length} {t.statusEngine.disp.subCount}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={previewMode?"default":"outline"} size="sm" className="gap-1.5"
            onClick={()=>{setPreviewMode(v=>!v);setPreviewStep2(null);setPreviewChecked([]);}}>
            <Eye className="h-3.5 w-3.5"/>
            {previewMode ? t.statusEngine.disp.closePreview : t.statusEngine.disp.agentPreview}
          </Button>
          {!previewMode && (<>
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={()=>{setShowImportPanel(v=>!v);setImportSearch("");}}
              data-testid="btn-import-category">
              <ListChecks className="h-3.5 w-3.5"/>
              {showImportPanel ? t.statusEngine.disp.closeImport : t.statusEngine.disp.importGroup}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={()=>seedMut.mutate()} disabled={seedMut.isPending}>
              {seedMut.isPending?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<RefreshCw className="h-3.5 w-3.5"/>}
              {t.statusEngine.reseedDefaults}
            </Button>
          </>)}
        </div>
      </div>

      {/* ── Import kategórie panel ── */}
      {!previewMode && showImportPanel && (()=>{
        const cats = (globalCategories as any[]).filter((c:any)=>c.isActive);
        const q = importSearch.toLowerCase();
        const filtered = cats.filter((c:any)=>{
          if(!q) return true;
          if(c.name.toLowerCase().includes(q)) return true;
          return (globalStatuses as any[]).some((s:any)=>s.categoryId===c.id && s.isActive && !s.parentId && s.name.toLowerCase().includes(q));
        });
        return (
          <div className="border rounded-lg bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">{t.statusEngine.disp.importGroup}</p>
              <p className="text-[11px] text-muted-foreground">{t.statusEngine.disp.oneChoice}</p>
            </div>
            <input
              className="w-full text-sm border rounded-md px-3 py-1.5 bg-background"
              placeholder={t.statusEngine.disp.searchGroup}
              value={importSearch}
              onChange={e=>setImportSearch(e.target.value)}
              data-testid="input-import-search"
            />
            {filtered.length===0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Žiadna skupina nezodpovedá filtru</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {filtered.map((cat:any)=>{
                  const statuses = (globalStatuses as any[]).filter((s:any)=>s.categoryId===cat.id && s.isActive && !s.parentId);
                  const colorCls = DISP_COLOR_STYLES[cat.color||"gray"]||DISP_COLOR_STYLES.gray;
                  const CatIcon = DISP_ICON_MAP[cat.icon||""]||CircleDot;
                  return (
                    <div key={cat.id} className={`rounded-md border p-2.5 space-y-1.5 ${colorCls}`}>
                      <div className="flex items-center gap-1.5">
                        <CatIcon className="h-3.5 w-3.5 shrink-0"/>
                        <span className="text-sm font-semibold flex-1">{cat.name}</span>
                        <span className="text-[10px] opacity-60">{statuses.length} statusov</span>
                      </div>
                      {statuses.length>0 && (
                        <div className="space-y-0.5 pl-5">
                          {statuses.slice(0,4).map((s:any)=>(
                            <div key={s.id} className="text-[11px] opacity-80 flex items-center gap-1">
                              <span className="opacity-50">├──</span>
                              <span>{s.name}</span>
                              {existingCodes.has(s.code) && <span className="text-[9px] bg-white/40 rounded px-1">už v kampani</span>}
                            </div>
                          ))}
                          {statuses.length>4 && <div className="text-[10px] opacity-50">+{statuses.length-4} ďalších</div>}
                        </div>
                      )}
                      <Button size="sm" className="w-full text-xs h-7 gap-1 mt-1"
                        onClick={()=>importCategoryMut.mutate(cat)}
                        disabled={importCategoryMut.isPending}
                        data-testid={`btn-import-cat-${cat.id}`}>
                        {importCategoryMut.isPending ? <Loader2 className="h-3 w-3 animate-spin"/> : <Plus className="h-3 w-3"/>}
                        {t.statusEngine.disp.importGroup}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Info banner ── */}
      {previewMode ? (
        <div className="text-xs bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-md px-3 py-2 text-indigo-700 dark:text-indigo-300">
          {t.statusEngine.disp.agentPreview}
        </div>
      ) : (
        <div className="text-xs bg-muted/50 border rounded-md px-3 py-2 text-muted-foreground">
          {t.statusEngine.disp.managerHintA} <strong>{t.statusEngine.disp.managerHintThis}</strong>. {t.statusEngine.disp.managerHintB} <Pencil className="h-3 w-3 inline mx-0.5"/>{t.statusEngine.disp.managerHintEdit} <Trash2 className="h-3 w-3 inline mx-0.5"/>{t.statusEngine.disp.managerHintDelete}
        </div>
      )}

      {/* ── Content ── */}
      {previewMode ? <AgentPreview/> : (
        <div className="space-y-2">
          {activeParents.length===0 && !addingParent && (
            <div className="text-center py-12 border-2 border-dashed rounded-xl">
              <ListChecks className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2"/>
              <p className="text-sm text-muted-foreground font-medium">{t.statusEngine.disp.noResults}</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">{t.statusEngine.disp.hintNoResults}</p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" onClick={()=>seedMut.mutate()} disabled={seedMut.isPending} className="gap-1">
                  {seedMut.isPending?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<RefreshCw className="h-3.5 w-3.5"/>}
                  {t.statusEngine.reseedDefaults}
                </Button>
                <Button size="sm" variant="outline" onClick={()=>{setAddingParent(true);setForm(EMPTY_FORM);}} className="gap-1">
                  <Plus className="h-3.5 w-3.5"/>{t.statusEngine.disp.addResult}
                </Button>
              </div>
            </div>
          )}

          {activeParents.map((parent:any)=>{
            const kids=childrenOf(parent.id);
            const isExpanded=expandedId===parent.id;
            const isEditingThis=editingId===parent.id;
            const isChecklist=parent.childrenType==="checklist";
            const colorCls=DISP_COLOR_STYLES[parent.color||"gray"]||DISP_COLOR_STYLES.gray;
            const ParentIcon=DISP_ICON_MAP[parent.icon||""]||CircleDot;
            const ai=ACTION_TYPE_LABEL[parent.actionType||"none"];
            return (
              <Card key={parent.id} className="overflow-hidden" data-testid={`card-disp-${parent.id}`}>
                {/* ── Parent row ── */}
                <div className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none ${isExpanded?"border-b bg-muted/30":""}`}
                  onClick={()=>!isEditingThis&&setExpandedId(isExpanded?null:parent.id)}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${colorCls}`}>
                    <ParentIcon className="h-4 w-4"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold">{parent.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ai.className}`}>{(t.statusEngine.actions as Record<string,string>)[parent.actionType] ?? ai.label}</span>
                      {kids.length>0 && <span className="text-[10px] text-muted-foreground">{kids.length} {t.statusEngine.disp.subCount} · {isChecklist?t.statusEngine.disp.checklistBtn:t.statusEngine.disp.radioBtn}</span>}
                      {parent.requiresNote && <span className="text-[9px] font-medium px-1 py-0.5 rounded border border-amber-300 text-amber-700 bg-amber-50">N</span>}
                      {parent.requiresCallback && <span className="text-[9px] font-medium px-1 py-0.5 rounded border border-blue-300 text-blue-700 bg-blue-50">CB</span>}
                      {parent.isFinal && <span className="text-[9px] font-medium px-1 py-0.5 rounded border border-red-300 text-red-700 bg-red-50">F</span>}
                      {parent.isConversion && <span className="text-[9px] font-medium px-1 py-0.5 rounded border border-green-300 text-green-700 bg-green-50">K</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e=>e.stopPropagation()}>
                    <div className="flex flex-col gap-0 mr-1">
                      <Button variant="ghost" size="icon" className="h-4 w-5 rounded-sm" disabled={reorderMut.isPending} onClick={()=>moveParent(parent.id,-1)} data-testid={`btn-up-${parent.id}`}>
                        <ArrowUp className="h-2.5 w-2.5"/>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-4 w-5 rounded-sm" disabled={reorderMut.isPending} onClick={()=>moveParent(parent.id,1)} data-testid={`btn-down-${parent.id}`}>
                        <ArrowDown className="h-2.5 w-2.5"/>
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>startEdit(parent)} data-testid={`btn-edit-${parent.id}`}>
                      <Pencil className="h-3 w-3"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={()=>deleteMut.mutate(parent.id)} disabled={deleteMut.isPending} data-testid={`btn-delete-${parent.id}`}>
                      <Trash2 className="h-3 w-3"/>
                    </Button>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isExpanded?"rotate-180":""}`}/>
                </div>

                {/* ── Expanded body ── */}
                {isExpanded && (
                  <div className="px-3 py-3 space-y-3">
                    {isEditingThis && <DispFormUI parentId={null}/>}

                    {!isEditingThis && (
                      <>
                        {/* Children section */}
                        {kids.length>0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{t.statusEngine.disp.subresults} ({kids.length})</p>
                              <div className="flex rounded-md border overflow-hidden text-xs">
                                <button onClick={()=>typeMut.mutate({id:parent.id,childrenType:"radio"})} disabled={typeMut.isPending}
                                  className={`px-2.5 py-1 flex items-center gap-1 transition-colors ${!isChecklist?"bg-primary text-primary-foreground font-medium":"hover:bg-muted text-muted-foreground"}`}>
                                  <CircleDot className="h-3 w-3"/>{t.statusEngine.disp.radioBtn}
                                </button>
                                <button onClick={()=>typeMut.mutate({id:parent.id,childrenType:"checklist"})} disabled={typeMut.isPending}
                                  className={`px-2.5 py-1 flex items-center gap-1 border-l transition-colors ${isChecklist?"bg-primary text-primary-foreground font-medium":"hover:bg-muted text-muted-foreground"}`}>
                                  <CheckSquare className="h-3 w-3"/>{t.statusEngine.disp.checklistBtn}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {kids.map((child:any)=>{
                                const isEditingChild=editingId===child.id;
                                const CI=DISP_ICON_MAP[child.icon||""]||CircleDot;
                                const cai=ACTION_TYPE_LABEL[child.actionType||"none"];
                                return (
                                  <div key={child.id}>
                                    {isEditingChild ? (
                                      <DispFormUI parentId={parent.id}/>
                                    ) : (
                                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 group hover:bg-muted/50 transition-colors" data-testid={`row-child-${child.id}`}>
                                        {isChecklist?<Checkbox disabled checked={false} className="opacity-40 shrink-0"/>:<CircleDot className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>}
                                        <CI className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
                                        <span className="text-sm flex-1">{child.name}</span>
                                        <span className={`text-[10px] font-medium px-1 py-0.5 rounded shrink-0 ${cai.className}`}>{(t.statusEngine.actions as Record<string,string>)[child.actionType] ?? cai.label}</span>
                                        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0 transition-opacity">
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>startEdit(child)} data-testid={`btn-edit-child-${child.id}`}>
                                            <Pencil className="h-2.5 w-2.5"/>
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={()=>deleteMut.mutate(child.id)} data-testid={`btn-delete-child-${child.id}`}>
                                            <Trash2 className="h-2.5 w-2.5"/>
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Add child */}
                        {addingChildFor===parent.id ? (
                          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                            {/* Toggle: Nový / Existujúci */}
                            <div className="flex gap-1 p-0.5 bg-muted rounded-md w-fit">
                              <button
                                onClick={()=>setChildPickMode("new")}
                                className={`text-xs px-3 py-1 rounded transition-colors ${childPickMode==="new"?"bg-white dark:bg-slate-800 shadow font-medium":"text-muted-foreground hover:text-foreground"}`}
                                data-testid={`btn-child-mode-new-${parent.id}`}
                              >
                                <Plus className="h-3 w-3 inline mr-1"/>Nový
                              </button>
                              <button
                                onClick={()=>{setChildPickMode("existing");setExistingSearch("");}}
                                className={`text-xs px-3 py-1 rounded transition-colors ${childPickMode==="existing"?"bg-white dark:bg-slate-800 shadow font-medium":"text-muted-foreground hover:text-foreground"}`}
                                data-testid={`btn-child-mode-existing-${parent.id}`}
                              >
                                <ListChecks className="h-3 w-3 inline mr-1"/>Prepojiť zo Definícií
                              </button>
                            </div>

                            {childPickMode==="new" ? (
                              <DispFormUI parentId={parent.id}/>
                            ) : (
                              (() => {
                                const q = existingSearch.toLowerCase();
                                const activeCats = (globalCategories as any[]).filter((c:any)=>c.isActive);
                                const matchedCats = activeCats.filter((c:any)=>{
                                  if(!q) return true;
                                  if(c.name.toLowerCase().includes(q)) return true;
                                  return (globalStatuses as any[]).some((s:any)=>s.categoryId===c.id && s.isActive && !s.parentId && s.name.toLowerCase().includes(q));
                                });
                                return (
                                  <div className="space-y-2">
                                    <p className="text-[11px] text-muted-foreground">
                                      Vyberte status zo globálnych definícií — importuje sa ako nový podvýsledok tohto rodiča:
                                    </p>
                                    <input
                                      className="w-full text-xs border rounded px-2 py-1 bg-background"
                                      placeholder={t.statusEngine.search}
                                      value={existingSearch}
                                      onChange={e=>setExistingSearch(e.target.value)}
                                      data-testid={`input-global-search-${parent.id}`}
                                    />
                                    {matchedCats.length===0 ? (
                                      <p className="text-xs text-muted-foreground py-1 text-center">{t.statusEngine.disp.noResults}</p>
                                    ) : (
                                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {matchedCats.map((cat:any)=>{
                                          const catStatuses = (globalStatuses as any[]).filter((s:any)=>
                                            s.categoryId===cat.id && s.isActive && !s.parentId &&
                                            (!q || s.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q))
                                          );
                                          if(catStatuses.length===0) return null;
                                          const CatColorCls = CATEGORY_COLORS_MAP[cat.color||"gray"]||CATEGORY_COLORS_MAP.gray;
                                          return (
                                            <div key={cat.id}>
                                              <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm mb-1 border ${CatColorCls}`}>{cat.name}</div>
                                              <div className="space-y-0.5 pl-2">
                                                {catStatuses.map((s:any)=>{
                                                  const SIcon = DISP_ICON_MAP[s.icon||""]||CircleDot;
                                                  const colorCls = DISP_COLOR_STYLES[s.color||cat.color||"gray"]||DISP_COLOR_STYLES.gray;
                                                  const alreadyIn = existingCodes.has(s.code);
                                                  return (
                                                    <button key={s.id}
                                                      onClick={()=>!alreadyIn && importFromGlobalMut.mutate({status:s, parentId:parent.id})}
                                                      disabled={importFromGlobalMut.isPending}
                                                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left w-full transition-all hover:shadow-sm ${colorCls} ${alreadyIn?"opacity-40 cursor-default":"hover:brightness-95"} disabled:opacity-50`}
                                                      title={alreadyIn ? t.statusEngine.disp.alreadyInCampaign : t.statusEngine.disp.importAsChild}
                                                      data-testid={`btn-import-global-${s.id}`}
                                                    >
                                                      <SIcon className="h-3.5 w-3.5 shrink-0"/>
                                                      <span className="text-xs font-medium flex-1">{s.name}</span>
                                                      <span className="text-[9px] opacity-50 font-mono">{s.code}</span>
                                                      {alreadyIn
                                                        ? <span className="text-[9px] bg-white/30 rounded px-1">v kampani</span>
                                                        : <Badge className={`text-[8px] px-1 py-0 ${STATUS_ACTION_COLORS[s.defaultAction]||""}`}>{STATUS_ACTION_LABELS[s.defaultAction]||s.defaultAction}</Badge>
                                                      }
                                                      {importFromGlobalMut.isPending && <Loader2 className="h-3 w-3 animate-spin"/>}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            )}

                            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={()=>{setAddingChildFor(null);setChildPickMode("new");}}>
                              {t.statusEngine.cancel}
                            </Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={()=>{setAddingChildFor(parent.id);setEditingId(null);setChildPickMode("new");setForm(EMPTY_FORM);setCodeManual(false);}} data-testid={`btn-add-child-${parent.id}`}>
                            <Plus className="h-3.5 w-3.5"/>{t.statusEngine.disp.addSubresult}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Add parent form */}
          {addingParent && (
            <Card className="p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{t.statusEngine.disp.addResult}</p>
              <DispFormUI parentId={null}/>
            </Card>
          )}

          {/* Add parent button */}
          {activeParents.length>0 && !addingParent && (
            <Button variant="outline" className="w-full gap-1.5" onClick={()=>{setAddingParent(true);setEditingId(null);setAddingChildFor(null);setForm(EMPTY_FORM);setCodeManual(false);}} data-testid="btn-add-parent-disp">
              <Plus className="h-4 w-4"/>{t.statusEngine.disp.addResult}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function DispositionsTab({ campaignId, embedded }: { campaignId: string; embedded?: boolean }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<"engine" | "assign" | "campaign">("engine");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingStatus, setEditingStatus] = useState<any | null>(null);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [isNewStatus, setIsNewStatus] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "status"; id: string; name: string } | null>(null);

  const [pulseCategory, setPulseCategory] = useState<string>("all");
  const [pulseStack, setPulseStack] = useState<any[]>([]);
  const [pulseReschedule, setPulseReschedule] = useState<string | null>(null);
  const [pulseCallbackDate, setPulseCallbackDate] = useState("");
  const [pulseCallbackTime, setPulseCallbackTime] = useState("09:00");
  const [pulseNotes, setPulseNotes] = useState("");
  const [pulseExpandedCats, setPulseExpandedCats] = useState<Set<string>>(new Set());
  const { data: categories = [], isLoading: catLoading } = useQuery<any[]>({
    queryKey: ["/api/status-categories"],
  });
  const { data: allStatuses = [], isLoading: statusLoading } = useQuery<any[]>({
    queryKey: ["/api/status-definitions"],
  });
  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "status-assignments"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/status-assignments`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
  });
  const assignedIds = useMemo(() => new Set(assignments.map((a: any) => a.statusDefinitionId)), [assignments]);
  const assignedStatuses = useMemo(() => allStatuses.filter((s: any) => assignedIds.has(s.id)), [allStatuses, assignedIds]);

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/status-definitions/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/status-definitions"] });
      toast({ title: t.statusEngine.seedSuccess, description: t.statusEngine.seedDescription });
    },
    onError: (error: any) => { toast({ title: "Chyba", description: error.message, variant: "destructive" }); },
  });

  const saveStatusMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, createdAt, updatedAt, ...payload } = data;
      if (isNewStatus) return apiRequest("POST", "/api/status-definitions", payload);
      return apiRequest("PATCH", `/api/status-definitions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status-definitions"] });
      setEditingStatus(null); setIsNewStatus(false);
      toast({ title: "Uložené" });
    },
    onError: (error: any) => { toast({ title: "Chyba", description: error.message, variant: "destructive" }); },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, createdAt, updatedAt, ...payload } = data;
      if (isNewCategory) return apiRequest("POST", "/api/status-categories", payload);
      return apiRequest("PATCH", `/api/status-categories/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status-categories"] });
      setEditingCategory(null); setIsNewCategory(false);
      toast({ title: "Uložené" });
    },
    onError: (error: any) => { toast({ title: "Chyba", description: error.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      if (type === "category") return apiRequest("DELETE", `/api/status-categories/${id}`);
      return apiRequest("DELETE", `/api/status-definitions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/status-definitions"] });
      setDeleteTarget(null);
      toast({ title: "Odstránené" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (ids: string[]) => apiRequest("POST", `/api/campaigns/${campaignId}/status-assignments`, { statusDefinitionIds: ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-assignments"] });
      toast({ title: t.common?.saved || "Uložené" });
    },
    onError: (error: any) => { toast({ title: "Chyba", description: error.message, variant: "destructive" }); },
  });

  const assignAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${campaignId}/status-assignments/assign-all`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-assignments"] });
      toast({ title: t.statusEngine.disp.allStatusesAssigned });
    },
    onError: (error: any) => { toast({ title: "Chyba", description: error.message, variant: "destructive" }); },
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/campaigns/${campaignId}/status-assignments`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-assignments"] });
      toast({ title: "Priradenia vymazané" });
    },
  });

  const toggleAssignment = (statusId: string) => {
    const newIds = assignedIds.has(statusId)
      ? [...assignedIds].filter(id => id !== statusId)
      : [...assignedIds, statusId];
    saveMutation.mutate(newIds);
  };

  const toggleCategoryAssignment = (catId: string) => {
    const catStatusIds = allStatuses.filter((s: any) => s.categoryId === catId && s.isActive).map((s: any) => s.id);
    const allSelected = catStatusIds.every((id: string) => assignedIds.has(id));
    let newIds: string[];
    if (allSelected) {
      newIds = [...assignedIds].filter(id => !catStatusIds.includes(id));
    } else {
      newIds = [...new Set([...assignedIds, ...catStatusIds])];
    }
    saveMutation.mutate(newIds);
  };

  const toggleExpandCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const statusesByCategory = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of allStatuses) {
      if (!map[s.categoryId]) map[s.categoryId] = [];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) continue;
      }
      map[s.categoryId].push(s);
    }
    return map;
  }, [allStatuses, searchQuery]);

  const filteredCategories = useMemo(() => {
    if (filterCategory === "all") return categories;
    return categories.filter((c: any) => c.id === filterCategory);
  }, [categories, filterCategory]);

  const parentStatuses = useMemo(() => assignedStatuses.filter((s: any) => !s.parentId), [assignedStatuses]);
  const childMap = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const s of assignedStatuses) {
      if (s.parentId) {
        if (!map[s.parentId]) map[s.parentId] = [];
        map[s.parentId].push(s);
      }
    }
    return map;
  }, [assignedStatuses]);

  const pulseCurrentStatus = pulseStack.length > 0 ? pulseStack[pulseStack.length - 1] : null;
  const pulseActiveStatus = pulseCurrentStatus;
  const pulseHasChildren = pulseCurrentStatus ? (childMap[pulseCurrentStatus.id] || []).length > 0 : false;

  const pulseStatusesByCat = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of parentStatuses) {
      if (!map[s.categoryId]) map[s.categoryId] = [];
      map[s.categoryId].push(s);
    }
    return map;
  }, [parentStatuses]);

  const pulseVisibleCategories = useMemo(() => {
    return categories.filter((c: any) => (pulseStatusesByCat[c.id] || []).length > 0);
  }, [categories, pulseStatusesByCat]);

  const pulseVisibleStatuses = useMemo(() => {
    if (pulseCategory === "all") return parentStatuses;
    return parentStatuses.filter((s: any) => s.categoryId === pulseCategory);
  }, [parentStatuses, pulseCategory]);

  const isLoading = catLoading || statusLoading;
  const isEmpty = categories.length === 0;

  const [guideOpen, setGuideOpen] = useState(false);

  const STATUS_ENGINE_GUIDE = [
    { step: 1, mode: "engine" as const,
      title: t.statusEngine.disp.tab1, desc: t.statusEngine.subtitle, action: t.statusEngine.addCategory },
    { step: 2, mode: "assign" as const,
      title: t.statusEngine.selectForCampaign, desc: t.statusEngine.selectForCampaign, action: t.statusEngine.assignAll },
    { step: 3, mode: "campaign" as const,
      title: t.statusEngine.disp.tab2, desc: t.statusEngine.disp.subtitle, action: t.statusEngine.disp.agentPreview },
  ] as const;

  const content = (
    <div className="space-y-4">
      {/* Header + tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-lg font-semibold">{t.statusEngine.disp.title}</h3>
            <p className="text-sm text-muted-foreground">{t.statusEngine.disp.subtitle}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setGuideOpen(v => !v)}
            title={t.statusEngine.disp.wizard}
            data-testid="btn-status-engine-guide"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {[
            { key: "engine" as const, icon: Settings2, label: t.statusEngine.disp.tab1 },
            { key: "campaign" as const, icon: ListChecks, label: t.statusEngine.disp.tab2 },
          ].map(tab => (
            <Button
              key={tab.key}
              variant={viewMode === tab.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode(tab.key)}
              className="h-7 text-xs"
              data-testid={`button-mode-${tab.key}`}
            >
              <tab.icon className="h-3.5 w-3.5 mr-1" />
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Collapsible guide */}
      {guideOpen && (
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              {t.statusEngine.disp.wizard}
            </p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setGuideOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-3">
            {STATUS_ENGINE_GUIDE.map(({ step, mode, title, desc, action }) => (
              <div
                key={step}
                className={`flex gap-3 p-3 rounded-md border cursor-pointer transition-colors ${viewMode === mode ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300" : "bg-white dark:bg-background border-amber-100 hover:bg-amber-50"}`}
                onClick={() => { setViewMode(mode); setGuideOpen(false); }}
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
                  {step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{title}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{desc}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 font-medium">→ {action}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-3 italic">
            Po nastavení agenti vidia výsledky v dialógu "Ukončiť hovor" v pracovnej ploche.
          </p>
        </div>
      )}

      {/* Active tab description */}
      {viewMode === "engine" && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
          <Settings2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span><strong>{t.statusEngine.disp.tab1}:</strong> {t.statusEngine.subtitle}</span>
        </div>
      )}
      {viewMode === "assign" && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
          <CheckSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span><strong>{t.statusEngine.disp.tab2}:</strong> {t.statusEngine.disp.subtitle}</span>
        </div>
      )}
      {viewMode === "campaign" && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
          <ListChecks className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span><strong>{t.statusEngine.disp.title}:</strong> {t.statusEngine.disp.subtitle}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && viewMode === "engine" && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-3 items-center flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t.statusEngine.search} value={searchQuery} onChange={(e: any) => setSearchQuery(e.target.value)} className="pl-9" data-testid="input-search-status" />
              </div>
              {categories.length > 0 && (
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[220px]" data-testid="select-filter-category">
                    <SelectValue placeholder={t.statusEngine.category} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.statusEngine.allCategories}</SelectItem>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-2">
              {isEmpty ? (
                <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-statuses" className="bg-blue-600 hover:bg-blue-700">
                  {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Layers className="h-4 w-4 mr-2" />}
                  {t.statusEngine.seedDefaults}
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setIsNewCategory(true); setEditingCategory({ id: "", name: "", code: "", color: "gray", icon: "", sortOrder: categories.length + 1, isActive: true, createdAt: new Date(), updatedAt: new Date() }); }} data-testid="button-add-category">
                    <Plus className="h-4 w-4 mr-1" /> Kategória
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { if (categories.length === 0) return; setIsNewStatus(true); setEditingStatus({ id: "", categoryId: categories[0].id, parentId: null, name: "", code: "", icon: "", color: "gray", defaultAction: "none", isFinal: false, isConversion: false, requiresNote: false, requiresCallback: false, allowRecontact: true, allowEmail: true, allowSms: true, allowPhone: true, isSystemStatus: false, callbackOffsetDays: null, rescheduleOptions: null, sortOrder: allStatuses.length + 1, isActive: true, visibleInCampaigns: true, createdAt: new Date(), updatedAt: new Date() }); }} data-testid="button-add-status">
                    <Plus className="h-4 w-4 mr-1" /> Status
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-reseed-statuses" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                    {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    {t.statusEngine.reseedDefaults}
                  </Button>
                </>
              )}
            </div>
          </div>

          {!isEmpty && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                <CardContent className="p-3 text-center">
                  <div className="text-xl font-bold text-blue-700">{categories.length}</div>
                  <div className="text-xs text-blue-600">Kategórie</div>
                </CardContent>
              </Card>
              <Card className="bg-green-50 dark:bg-green-950 border-green-200">
                <CardContent className="p-3 text-center">
                  <div className="text-xl font-bold text-green-700">{allStatuses.length}</div>
                  <div className="text-xs text-green-600">Statusy</div>
                </CardContent>
              </Card>
              <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200">
                <CardContent className="p-3 text-center">
                  <div className="text-xl font-bold text-purple-700">{assignedIds.size}</div>
                  <div className="text-xs text-purple-600">Priradených</div>
                </CardContent>
              </Card>
            </div>
          )}

          {isEmpty && (
            <Card className="p-8 text-center">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h4 className="font-semibold mb-1">{t.statusEngine.noStatuses}</h4>
              <p className="text-sm text-muted-foreground">{t.statusEngine.seedDefaults}</p>
            </Card>
          )}

          <div className="space-y-3">
            {filteredCategories.map((cat: any) => {
              const catStatuses = statusesByCategory[cat.id] || [];
              const isExpanded = expandedCategories.has(cat.id);
              const colorClass = CATEGORY_COLORS_MAP[cat.color] || CATEGORY_COLORS_MAP.gray;

              return (
                <Card key={cat.id} className="overflow-hidden" data-testid={`card-category-${cat.id}`}>
                  <div className={`flex items-center justify-between p-3 cursor-pointer border-l-4 ${colorClass}`} onClick={() => toggleExpandCategory(cat.id)} data-testid={`button-toggle-category-${cat.id}`}>
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div>
                        <div className="font-semibold text-sm">{cat.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{cat.code}</div>
                      </div>
                      <Badge variant="secondary" className="text-xs">{catStatuses.length}</Badge>
                    </div>
                    <div className="flex gap-1" onClick={(e: any) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setIsNewCategory(false); setEditingCategory(cat); }} data-testid={`button-edit-category-${cat.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteTarget({ type: "category", id: cat.id, name: cat.name })} data-testid={`button-delete-category-${cat.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t">
                      <div className="p-2 bg-muted/30">
                        <div className="grid grid-cols-[1fr_100px_120px_60px_60px_60px_50px_50px_50px] gap-1 text-[10px] font-medium text-muted-foreground px-2">
                          <div>Názov</div><div>Akcia</div><div>Meta</div>
                          <div className="text-center"><Phone className="h-3 w-3 inline" /></div>
                          <div className="text-center"><Mail className="h-3 w-3 inline" /></div>
                          <div className="text-center"><MessageSquare className="h-3 w-3 inline" /></div>
                          <div></div>
                          <div className="text-center" title={t.statusEngine.defaultAction}><Zap className="h-3 w-3 inline text-amber-500" /></div>
                          <div></div>
                        </div>
                      </div>
                      {catStatuses.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">Žiadne statusy</div>
                      ) : (
                        <div className="divide-y">
                          {(() => {
                            const parents = catStatuses.filter((s: any) => !s.parentId);
                            const localChildMap: Record<string, any[]> = {};
                            for (const s of catStatuses) {
                              if (s.parentId) {
                                if (!localChildMap[s.parentId]) localChildMap[s.parentId] = [];
                                localChildMap[s.parentId].push(s);
                              }
                            }
                            const renderRow = (status: any, isChild: boolean) => (
                              <div key={status.id} className={`grid grid-cols-[1fr_100px_120px_60px_60px_60px_50px_50px_50px] gap-1 items-center px-3 py-2 hover:bg-muted/30 text-sm ${isChild ? "bg-muted/10" : ""}`} data-testid={`row-status-${status.id}`}>
                                <div className={isChild ? "pl-5" : ""}>
                                  <div className="flex items-center gap-1">
                                    {isChild && <span className="text-muted-foreground text-xs">└</span>}
                                    <span className="font-medium text-sm">{status.name}</span>
                                    {status.parentId && <Badge variant="outline" className="text-[7px] px-0.5 py-0 border-sky-300 text-sky-600">Pod</Badge>}
                                  </div>
                                  <div className={`text-[10px] text-muted-foreground font-mono ${isChild ? "pl-4" : ""}`}>{status.code}</div>
                                </div>
                                <div>
                                  <Badge className={`text-[9px] px-1 py-0 ${STATUS_ACTION_COLORS[status.defaultAction] || ""}`}>
                                    {STATUS_ACTION_LABELS[status.defaultAction] || status.defaultAction}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-0.5">
                                  {status.isFinal && <Badge variant="outline" className="text-[8px] px-0.5 py-0 border-red-300 text-red-600">F</Badge>}
                                  {status.isConversion && <Badge variant="outline" className="text-[8px] px-0.5 py-0 border-green-300 text-green-600">K</Badge>}
                                  {status.requiresNote && <Badge variant="outline" className="text-[8px] px-0.5 py-0 border-amber-300 text-amber-600">N</Badge>}
                                  {status.requiresCallback && <Badge variant="outline" className="text-[8px] px-0.5 py-0 border-blue-300 text-blue-600">CB</Badge>}
                                </div>
                                <div className="text-center">{status.allowPhone ? <CheckCircle className="h-3.5 w-3.5 text-green-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-400 mx-auto" />}</div>
                                <div className="text-center">{status.allowEmail ? <CheckCircle className="h-3.5 w-3.5 text-green-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-400 mx-auto" />}</div>
                                <div className="text-center">{status.allowSms ? <CheckCircle className="h-3.5 w-3.5 text-green-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-400 mx-auto" />}</div>
                                <div className="flex">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setIsNewStatus(false); setEditingStatus(status); }} data-testid={`button-edit-status-${status.id}`}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  {!isChild && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-sky-500" title={t.statusEngine.disp.addSubstatus} onClick={() => {
                                      setIsNewStatus(true);
                                      setEditingStatus({ id: "", categoryId: cat.id, parentId: status.id, name: "", code: "", icon: "", color: status.color, defaultAction: "none", isFinal: false, isConversion: false, requiresNote: false, requiresCallback: false, allowRecontact: true, allowEmail: true, allowSms: true, allowPhone: true, isSystemStatus: false, callbackOffsetDays: null, rescheduleOptions: null, sortOrder: (localChildMap[status.id]?.length || 0) + 1, isActive: true, visibleInCampaigns: true, createdAt: new Date(), updatedAt: new Date() });
                                    }} data-testid={`button-add-substatus-${status.id}`}>
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                <div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                                    title="Vytvoriť automatizáciu pre tento status"
                                    onClick={() => {
                                      const catCode = categories.find((c: any) => c.id === status.categoryId)?.code || "";
                                      const params = new URLSearchParams({
                                        prefillStatusCode: status.code,
                                        prefillStatusName: status.name,
                                        prefillStatusCategory: catCode,
                                      });
                                      setLocation(`/automations?${params.toString()}`);
                                    }}
                                    data-testid={`button-create-automation-${status.id}`}
                                  >
                                    <Zap className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => setDeleteTarget({ type: "status", id: status.id, name: status.name })} data-testid={`button-delete-status-${status.id}`}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                            return parents.map((parent: any) => (
                              <div key={parent.id}>
                                {renderRow(parent, false)}
                                {(localChildMap[parent.id] || []).map((child: any) => renderRow(child, true))}
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                      <div className="p-2 border-t bg-muted/20">
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                          setIsNewStatus(true);
                          setEditingStatus({ id: "", categoryId: cat.id, parentId: null, name: "", code: "", icon: "", color: cat.color, defaultAction: "none", isFinal: false, isConversion: false, requiresNote: false, requiresCallback: false, allowRecontact: true, allowEmail: true, allowSms: true, allowPhone: true, isSystemStatus: false, callbackOffsetDays: null, rescheduleOptions: null, sortOrder: (catStatuses.length + 1), isActive: true, visibleInCampaigns: true, createdAt: new Date(), updatedAt: new Date() });
                        }} data-testid={`button-add-status-to-${cat.id}`}>
                          <Plus className="h-3 w-3 mr-1" /> {t.statusEngine.addStatus}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {!isLoading && viewMode === "assign" && (
        <>
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{assignedIds.size} / {allStatuses.filter((s: any) => s.isActive).length} priradených</Badge>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => assignAllMutation.mutate()} disabled={assignAllMutation.isPending} data-testid="button-assign-all-statuses">
                <CheckSquare className="h-4 w-4 mr-1" /> Priradiť všetky
              </Button>
              <Button variant="ghost" size="sm" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending} className="text-red-600" data-testid="button-clear-campaign-statuses">
                <Trash2 className="h-4 w-4 mr-1" /> Vymazať
              </Button>
            </div>
          </div>

          {categories.length === 0 && (
            <Card className="p-8 text-center">
              <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="font-medium">{t.statusEngine.disp.tab1}</p>
            </Card>
          )}

          {categories.map((cat: any) => {
            const catStatuses = allStatuses.filter((s: any) => s.categoryId === cat.id && s.isActive);
            if (catStatuses.length === 0) return null;
            const allCatSelected = catStatuses.every((s: any) => assignedIds.has(s.id));
            const someCatSelected = catStatuses.some((s: any) => assignedIds.has(s.id));
            const colorClass = CATEGORY_COLORS_MAP[cat.color] || CATEGORY_COLORS_MAP.gray;

            return (
              <Card key={cat.id} className={`overflow-hidden border-l-4 ${colorClass}`} data-testid={`card-assign-cat-${cat.id}`}>
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded border-2 cursor-pointer flex items-center justify-center transition-colors ${allCatSelected ? "bg-primary border-primary" : someCatSelected ? "bg-primary/30 border-primary" : "border-gray-300"}`}
                      onClick={() => toggleCategoryAssignment(cat.id)}
                      data-testid={`checkbox-category-${cat.id}`}
                    >
                      {(allCatSelected || someCatSelected) && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="font-medium text-sm">{cat.name}</span>
                    <span className="text-xs text-muted-foreground">({catStatuses.length})</span>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {catStatuses.map((status: any) => {
                      const isAssigned = assignedIds.has(status.id);
                      return (
                        <div key={status.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isAssigned ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-muted/30 hover:bg-muted/50"}`} onClick={() => toggleAssignment(status.id)} data-testid={`status-toggle-${status.id}`}>
                          <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isAssigned ? "bg-primary border-primary" : "border-gray-300"}`}>
                            {isAssigned && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{status.name}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge className={`text-[9px] px-1 py-0 ${STATUS_ACTION_COLORS[status.defaultAction] || ""}`}>
                                {STATUS_ACTION_LABELS[status.defaultAction] || status.defaultAction}
                              </Badge>
                              {status.isFinal && <Badge variant="outline" className="text-[8px] px-0.5 py-0 border-red-300 text-red-500">F</Badge>}
                              {status.isConversion && <Badge variant="outline" className="text-[8px] px-0.5 py-0 border-green-300 text-green-500">K</Badge>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}



      {!isLoading && viewMode === "campaign" && <CampaignDispositionManager campaignId={campaignId} />}

      {editingStatus && (
        <StatusEditDialogCampaign
          status={editingStatus}
          categories={categories}
          allStatuses={allStatuses}
          isNew={isNewStatus}
          onSave={(data: any) => saveStatusMutation.mutate(data)}
          onClose={() => { setEditingStatus(null); setIsNewStatus(false); }}
          isPending={saveStatusMutation.isPending}
        />
      )}

      {editingCategory && (
        <CategoryEditDialogCampaign
          category={editingCategory}
          isNew={isNewCategory}
          onSave={(data: any) => saveCategoryMutation.mutate(data)}
          onClose={() => { setEditingCategory(null); setIsNewCategory(false); }}
          isPending={saveCategoryMutation.isPending}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstrániť {deleteTarget?.type === "category" ? "kategóriu" : "status"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete odstrániť <strong>{deleteTarget?.name}</strong>?
              {deleteTarget?.type === "category" && " Všetky statusy v tejto kategórii budú tiež odstránené."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.statusEngine.cancel}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTarget && deleteMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id })}>
              {t.statusEngine.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (embedded) return content;
  return <TabsContent value="dispositions" className="space-y-4">{content}</TabsContent>;
}

function StatusEditDialogCampaign({ status, categories, allStatuses, isNew, onSave, onClose, isPending }: {
  status: any; categories: any[]; allStatuses: any[]; isNew: boolean;
  onSave: (data: any) => void; onClose: () => void; isPending: boolean;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({ ...status });
  const [, setLocation] = useLocation();
  const parentOptions = allStatuses.filter((s: any) => !s.parentId && s.id !== status.id);

  const categoryCode = useMemo(
    () => categories.find((c: any) => c.id === form.categoryId)?.code || "",
    [categories, form.categoryId]
  );
  const { data: linkedRules = [] } = useQuery<Array<{ id: string; name: string; enabled: boolean; module: string }>>({
    queryKey: ["/api/automation/rules/by-status", form.code, categoryCode],
    queryFn: async () => {
      if (!form.code && !categoryCode) return [];
      const params = new URLSearchParams();
      if (form.code) params.set("code", form.code);
      if (categoryCode) params.set("category", categoryCode);
      const res = await fetch(`/api/automation/rules/by-status?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isNew && !!form.code,
  });

  const goCreateAutomation = () => {
    const params = new URLSearchParams({
      prefillStatusCode: form.code,
      prefillStatusName: form.name,
      prefillStatusCategory: categoryCode,
    });
    onClose();
    setLocation(`/automations?${params.toString()}`);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nový status" : "Upraviť status"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Názov</Label>
              <Input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} data-testid="input-status-name" />
            </div>
            <div>
              <Label className="text-xs">Kód</Label>
              <Input value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} data-testid="input-status-code" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Kategória</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger data-testid="select-status-category"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div />
          </div>

          <div>
            <Label className="text-xs">Nadradený status (pod-status)</Label>
            <Select value={form.parentId || "__none__"} onValueChange={(v) => setForm({ ...form, parentId: v === "__none__" ? null : v })}>
              <SelectTrigger data-testid="select-parent-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Žiadny (hlavný status) —</SelectItem>
                {parentOptions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t.statusEngine.color}</Label>
              <Select value={form.color || "gray"} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger data-testid="select-status-color"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["gray","blue","green","purple","cyan","teal","orange","emerald","red","yellow"].map(c => (
                    <SelectItem key={c} value={c}><span className={`inline-block w-3 h-3 rounded mr-2 bg-${c}-400`} />{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t.statusEngine.icon}</Label>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 h-9" data-testid="button-status-icon">
                    {(() => { const Ic = getStatusIcon(form.icon); return Ic ? <Ic className="h-4 w-4" /> : <CircleDot className="h-4 w-4 text-muted-foreground" />; })()}
                    <span className="text-xs truncate">{form.icon || "Vybrať ikonu"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[280px] p-2 z-[9999] max-h-[300px] overflow-y-auto" align="start">
                  <div className="grid grid-cols-7 gap-1">
                    {ICON_PICKER_SET.map(({ name, icon: Ic }) => (
                      <button key={name} type="button" onClick={() => setForm({ ...form, icon: name })} className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${form.icon === name ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1" : "hover:bg-muted"}`} title={name} data-testid={`icon-opt-${name}`}>
                        <Ic className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {!isNew && form.code && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-sm text-amber-900">Súvisiace automatizácie</h4>
                    <p className="text-xs text-amber-800/80 mt-0.5">
                      Pravidlá, ktoré sa spustia keď agent zvolí tento status (email, SMS, task, tag, pridelenie agenta…).
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0"
                  onClick={goCreateAutomation}
                  data-testid="button-create-linked-automation"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Vytvoriť pravidlo
                </Button>
              </div>
              {linkedRules.length > 0 ? (
                <div className="space-y-1.5">
                  {linkedRules.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between bg-white rounded border border-amber-200/70 px-3 py-1.5 text-xs"
                      data-testid={`linked-rule-${r.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{r.module}</Badge>
                        <span className="font-medium">{r.name}</span>
                        {!r.enabled && <Badge variant="outline" className="text-[9px] text-muted-foreground">vypnuté</Badge>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => { onClose(); setLocation(`/automations`); }}
                        title="Otvoriť v Automations"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-800/60 italic">{t.statusEngine.disp.noAutomations}</p>
              )}
            </div>
          )}

          <details className="border rounded-md p-2">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Zastarané nastavenia (defaultAction, callback offset)
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Tieto polia sú nahradené automatizáciami vyššie. Ponechané pre spätnú kompatibilitu.
              </p>
              <div>
                <Label className="text-xs">Predvolená akcia</Label>
                <Select value={form.defaultAction} onValueChange={(v) => setForm({ ...form, defaultAction: v })}>
                  <SelectTrigger data-testid="select-status-action"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_ACTION_TYPES.map((a: string) => <SelectItem key={a} value={a}>{STATUS_ACTION_LABELS[a] || a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </details>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {([
              { key: "isFinal",          label: t.statusEngine.isFinal },
              { key: "isConversion",     label: t.statusEngine.isConversion },
              { key: "requiresNote",     label: t.statusEngine.requiresNote },
              { key: "requiresCallback", label: t.statusEngine.requiresCallback },
              { key: "allowPhone",       label: t.statusEngine.allowPhone },
              { key: "allowEmail",       label: t.statusEngine.allowEmail },
              { key: "allowSms",        label: t.statusEngine.allowSms },
              { key: "isActive",         label: t.statusEngine.active },
            ] as {key: string; label: string}[]).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1">
                <Label className="text-xs">{label}</Label>
                <Switch checked={!!form[key]} onCheckedChange={(v) => setForm({ ...form, [key]: v })} data-testid={`switch-${key}`} />
              </div>
            ))}
          </div>

          {(form.defaultAction === "reschedule" || form.defaultAction === "callback") && (
            <div>
              <Label className="text-xs font-medium">Reschedule períody</Label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {RESCHEDULE_PERIOD_OPTIONS.map((opt: any) => {
                  const checked = (form.rescheduleOptions || []).includes(opt.value);
                  return (
                    <label key={opt.value} className={`flex items-center gap-1.5 p-1.5 rounded border text-xs cursor-pointer ${checked ? "border-sky-400 bg-sky-50" : "border-gray-200"}`}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        const current = form.rescheduleOptions || [];
                        const next = checked ? current.filter((v: string) => v !== opt.value) : [...current, opt.value];
                        setForm({ ...form, rescheduleOptions: next });
                      }} className="rounded" />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.statusEngine.cancel}</Button>
          <Button onClick={() => onSave(form)} disabled={isPending || !form.name || !form.code} data-testid="button-save-status">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {t.statusEngine.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryEditDialogCampaign({ category, isNew, onSave, onClose, isPending }: {
  category: any; isNew: boolean;
  onSave: (data: any) => void; onClose: () => void; isPending: boolean;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({ ...category });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? t.statusEngine.addCategory : t.statusEngine.editCategory}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Názov</Label>
              <Input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} data-testid="input-category-name" />
            </div>
            <div>
              <Label className="text-xs">Kód</Label>
              <Input value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} data-testid="input-category-code" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t.statusEngine.color}</Label>
              <Select value={form.color || "gray"} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["gray","blue","green","purple","cyan","teal","orange","emerald","red","yellow"].map(c => (
                    <SelectItem key={c} value={c}><span className={`inline-block w-3 h-3 rounded mr-2 bg-${c}-400`} />{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t.statusEngine.icon}</Label>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 h-9" data-testid="button-category-icon">
                    {(() => { const Ic = getStatusIcon(form.icon); return Ic ? <Ic className="h-4 w-4" /> : <FolderOpen className="h-4 w-4 text-muted-foreground" />; })()}
                    <span className="text-xs truncate">{form.icon || "Vybrať ikonu"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[280px] p-2 z-[9999] max-h-[300px] overflow-y-auto" align="start">
                  <div className="grid grid-cols-7 gap-1">
                    {ICON_PICKER_SET.map(({ name, icon: Ic }) => (
                      <button key={name} type="button" onClick={() => setForm({ ...form, icon: name })} className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${form.icon === name ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1" : "hover:bg-muted"}`} title={name} data-testid={`cat-icon-opt-${name}`}>
                        <Ic className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t.statusEngine.active}</Label>
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.statusEngine.cancel}</Button>
          <Button onClick={() => onSave(form)} disabled={isPending || !form.name || !form.code} data-testid="button-save-category">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {t.statusEngine.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuotasCard({ campaignId, assignedAgentIds, allUsers, t }: {
  campaignId: string;
  assignedAgentIds: string[];
  allUsers: Array<{ id: string; fullName: string; role: string; roleId: string | null }>;
  t: any;
}) {
  const { toast } = useToast();
  const [quotaEdits, setQuotaEdits] = useState<Record<string, { calls?: string; emails?: string; sms?: string }>>({});
  const [savingQuotas, setSavingQuotas] = useState<Record<string, boolean>>({});

  type OperatorSettingsRow = { id: string; userId: string; campaignId: string; dailyCallQuota?: number | null; dailyEmailQuota?: number | null; dailySmsQuota?: number | null; maxContactsPerDay?: number | null };
  const settingsQueryKey = ["/api/campaigns", campaignId, "operator-settings"] as const;

  const { data: operatorSettings = [] } = useQuery<OperatorSettingsRow[]>({
    queryKey: [...settingsQueryKey],
    enabled: !!campaignId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const getQuotaValue = (userId: string, field: "calls" | "emails" | "sms") => {
    if (quotaEdits[userId]?.[field] !== undefined) return quotaEdits[userId][field]!;
    const settings = operatorSettings.find(s => s.userId === userId);
    if (!settings) return "";
    const map: Record<string, any> = { calls: settings.dailyCallQuota, emails: settings.dailyEmailQuota, sms: settings.dailySmsQuota };
    return map[field] != null ? String(map[field]) : "";
  };

  const updateQuotaField = (userId: string, field: "calls" | "emails" | "sms", value: string) => {
    setQuotaEdits(prev => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }));
  };

  const saveQuotas = async (userId: string) => {
    setSavingQuotas(prev => ({ ...prev, [userId]: true }));
    try {
      const edits = quotaEdits[userId] || {};
      const settings = operatorSettings.find(s => s.userId === userId);
      const body: any = {};
      if (edits.calls !== undefined) body.dailyCallQuota = edits.calls === "" ? null : parseInt(edits.calls);
      else if (settings) body.dailyCallQuota = settings.dailyCallQuota;
      if (edits.emails !== undefined) body.dailyEmailQuota = edits.emails === "" ? null : parseInt(edits.emails);
      else if (settings) body.dailyEmailQuota = settings.dailyEmailQuota;
      if (edits.sms !== undefined) body.dailySmsQuota = edits.sms === "" ? null : parseInt(edits.sms);
      else if (settings) body.dailySmsQuota = settings.dailySmsQuota;
      console.log("[QuotasSave] Saving quotas for user", userId, "body:", JSON.stringify(body));
      const res = await apiRequest("PATCH", `/api/campaigns/${campaignId}/agents/${userId}/quotas`, body);
      const savedRow: OperatorSettingsRow = await res.json();
      console.log("[QuotasSave] Save result:", JSON.stringify(savedRow));

      queryClient.setQueryData<OperatorSettingsRow[]>([...settingsQueryKey], (old) => {
        if (!old) return [savedRow];
        const idx = old.findIndex(s => s.userId === userId);
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = savedRow;
          return updated;
        }
        return [...old, savedRow];
      });

      setQuotaEdits(prev => { const n = { ...prev }; delete n[userId]; return n; });
      toast({ title: t.campaigns?.detail?.quotasSaved || "Quotas saved" });

      queryClient.invalidateQueries({ queryKey: [...settingsQueryKey] });
    } catch (err: any) {
      console.error("[QuotasSave] Error saving quotas:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingQuotas(prev => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          {t.campaigns?.detail?.dailyQuotas || "Daily Quotas"}
        </CardTitle>
        <CardDescription>
          {t.campaigns?.detail?.dailyQuotasDesc || "Set daily limits per agent for calls, emails and SMS. Leave empty for unlimited."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {assignedAgentIds.map((userId) => {
            const user = allUsers.find(u => u.id === userId);
            if (!user) return null;
            const hasEdits = !!quotaEdits[userId];
            return (
              <div key={userId} className="border rounded-lg p-4 space-y-3" data-testid={`quota-card-${userId}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <p className="font-medium text-sm">{user.fullName}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => saveQuotas(userId)}
                    disabled={!hasEdits || savingQuotas[userId]}
                    data-testid={`button-save-quota-${userId}`}
                  >
                    {savingQuotas[userId] ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    {t.campaigns?.detail?.saveQuotas || "Save"}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" />{t.campaigns?.detail?.callQuota || "Calls"}</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="∞"
                      className="h-8 mt-1"
                      value={getQuotaValue(userId, "calls")}
                      onChange={(e) => updateQuotaField(userId, "calls", e.target.value)}
                      data-testid={`input-call-quota-${userId}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" />{t.campaigns?.detail?.emailQuota || "Emails"}</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="∞"
                      className="h-8 mt-1"
                      value={getQuotaValue(userId, "emails")}
                      onChange={(e) => updateQuotaField(userId, "emails", e.target.value)}
                      data-testid={`input-email-quota-${userId}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><MessageSquare className="w-3 h-3" />SMS</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="∞"
                      className="h-8 mt-1"
                      value={getQuotaValue(userId, "sms")}
                      onChange={(e) => updateQuotaField(userId, "sms", e.target.value)}
                      data-testid={`input-sms-quota-${userId}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CampaignDetailPage() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id || "";
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();

  const userLocale = useMemo(() => {
    const countryToLang: Record<string, string> = { SK: 'sk', CZ: 'cs', AT: 'de', HU: 'hu', RO: 'ro', IT: 'it', DE: 'de', US: 'en' };
    if (user?.countries?.length) {
      return countryToLang[user.countries[0]] || locale;
    }
    return locale;
  }, [user?.countries, locale]);

  const getDispName = (_code: string, fallbackName: string) => {
    return fallbackName;
  };
  const [activeTab, setActiveTab] = useState("overview");
  const [settingsSubTab, setSettingsSubTab] = useState("general");
  
  const [contactFilters, setContactFilters] = useState<CampaignContactFilters>({});
  const [selectedContact, setSelectedContact] = useState<EnrichedContact | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [scriptContent, setScriptContent] = useState<string>("");
  const [scriptModified, setScriptModified] = useState(false);
  const [structuredScript, setStructuredScript] = useState<OperatorScript | null>(null);
  const [scriptMode, setScriptMode] = useState<"builder" | "preview" | "legacy">("builder");
  const [structuredScriptModified, setStructuredScriptModified] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importContactType, setImportContactType] = useState<"customer" | "clinic" | "hospital" | "collaborator">("customer");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; duplicates?: number; updated?: number; errors: string[]; importedContactIds?: string[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importPhase, setImportPhase] = useState<"upload" | "processing" | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [showRequeueDialog, setShowRequeueDialog] = useState(false);
  const [showSortRulesDialog, setShowSortRulesDialog] = useState(false);
  const [requeueDispositions, setRequeueDispositions] = useState<Set<string>>(new Set());
  const [requeueStatuses, setRequeueStatuses] = useState<Set<string>>(new Set());
  const [requeueCallbackFrom, setRequeueCallbackFrom] = useState("");
  const [requeueCallbackTo, setRequeueCallbackTo] = useState("");
  const [requeuePage, setRequeuePage] = useState(0);
  const REQUEUE_PAGE_SIZE = 20;
  const [contactsPage, setContactsPage] = useState(1);

  const { data: campaign, isLoading: loadingCampaign } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: contacts = [], isLoading: loadingContacts } = useQuery<EnrichedContact[]>({
    queryKey: ["/api/campaigns", campaignId, "contacts"],
    enabled: !!campaignId,
  });

  const { data: stats } = useQuery<{
    totalContacts: number;
    pendingContacts: number;
    contactedContacts: number;
    completedContacts: number;
    failedContacts: number;
    noAnswerContacts: number;
    callbackContacts: number;
    notInterestedContacts: number;
  }>({
    queryKey: ["/api/campaigns", campaignId, "stats"],
    enabled: !!campaignId,
  });

  const { data: agentStatsData = [], isError: agentStatsError, error: agentStatsErrorMsg, isLoading: agentStatsLoading } = useQuery<Array<{
    userId: string;
    name: string;
    avatarUrl: string | null;
    totalContacts: number;
    contactedToday: number;
    completedTotal: number;
    completedToday: number;
    noAnswerTotal: number;
    callbackTotal: number;
    notInterestedTotal: number;
    failedTotal: number;
    totalDispositions: number;
    dispositionsToday: number;
    avgAttemptsPerContact: number;
    lastActiveAt: string | null;
  }>>({
    queryKey: ["/api/campaigns", campaignId, "agent-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/agent-stats`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch agent stats: ${res.status}`);
      return res.json();
    },
    enabled: !!campaignId,
    refetchInterval: 30000,
    staleTime: 0,
    retry: 3,
    retryDelay: 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const selectedCustomerId = selectedContact?.customerId;
  
  const { data: contactActivityLogs = [] } = useQuery<Array<{
    id: string;
    action: string;
    entityName: string | null;
    details: any;
    createdAt: string;
  }>>({
    queryKey: ["/api/customers", selectedCustomerId, "activity-logs"],
    enabled: !!selectedCustomerId,
  });

  const { data: pipelineStages = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/pipeline-stages"],
  });

  const { data: campaignAgents = [] } = useQuery<Array<{ id: string; userId: string; campaignId: string; dailyCallQuota?: number | null; dailyEmailQuota?: number | null; dailySmsQuota?: number | null; maxContactsPerDay?: number | null }>>({
    queryKey: ["/api/campaigns", campaignId, "agents"],
    enabled: !!campaignId,
  });

  const { data: allUsers = [] } = useQuery<Array<{ id: string; fullName: string; role: string; roleId: string | null }>>({
    queryKey: ["/api/users"],
  });

  const { data: roles = [] } = useQuery<Array<{ id: string; name: string; legacyRole: string | null }>>({
    queryKey: ["/api/roles"],
  });

  const { data: campaignDispositions = [] } = useQuery<CampaignDisposition[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    enabled: !!campaignId,
  });

  const dispositionMap = useMemo(() => {
    const map: Record<string, { name: string; color: string; icon: string; actionType: string }> = {};
    for (const d of campaignDispositions) {
      map[d.code] = { name: d.name, color: d.color || "gray", icon: d.icon || "", actionType: d.actionType };
    }
    return map;
  }, [campaignDispositions]);

  const callCenterRoleId = roles.find(r => r.name === "Call Center")?.id;
  const representantRoleId = roles.find(r => r.name?.toLowerCase().includes("representant") || r.name?.toLowerCase().includes("reprezentant"))?.id;
  const assignableUsers = allUsers.filter(u => 
    u.role === "admin" || u.role === "callCenter" || u.role === "representant" ||
    (callCenterRoleId && u.roleId === callCenterRoleId) ||
    (representantRoleId && u.roleId === representantRoleId)
  );
  const assignedAgentIds = campaignAgents.map(a => a.userId);

  const getStageName = (stageId: string) => {
    const stage = pipelineStages.find(s => s.id === stageId);
    return stage?.name || stageId;
  };

  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateConfig, setGenerateConfig] = useState<import("@/components/contact-criteria-builder").ContactGenerateConfig>({
    customer: { enabled: true, criteria: [] },
    hospital: { enabled: false, criteria: [] },
    clinic: { enabled: false, criteria: [] },
    collaborator: { enabled: false, criteria: [] },
  });
  const [previewCounts, setPreviewCounts] = useState<PreviewCounts | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPreviewCounts = useCallback(async (cfg: typeof generateConfig) => {
    if (!campaignId) return;
    const contactSources: string[] = [];
    if (cfg.customer.enabled) contactSources.push("customer");
    if (cfg.hospital.enabled) contactSources.push("hospital");
    if (cfg.clinic.enabled) contactSources.push("clinic");
    if (cfg.collaborator.enabled) contactSources.push("collaborator");
    if (contactSources.length === 0) {
      setPreviewCounts(null);
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/preview-contacts-count`, {
        contactSources,
        customerCriteria: cfg.customer.enabled ? cfg.customer.criteria : undefined,
        hospitalCriteria: cfg.hospital.enabled ? cfg.hospital.criteria : undefined,
        clinicCriteria: cfg.clinic.enabled ? cfg.clinic.criteria : undefined,
        collaboratorCriteria: cfg.collaborator.enabled ? cfg.collaborator.criteria : undefined,
      });
      const data = await res.json();
      setPreviewCounts(data);
    } catch {
      setPreviewCounts(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (!showGenerateDialog) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      fetchPreviewCounts(generateConfig);
    }, 400);
    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [generateConfig, showGenerateDialog, fetchPreviewCounts]);

  const generateContactsMutation = useMutation({
    mutationFn: async () => {
      const contactSources: string[] = [];
      if (generateConfig.customer.enabled) contactSources.push("customer");
      if (generateConfig.hospital.enabled) contactSources.push("hospital");
      if (generateConfig.clinic.enabled) contactSources.push("clinic");
      if (generateConfig.collaborator.enabled) contactSources.push("collaborator");
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/generate-contacts`, {
        contactSources,
        customerCriteria: generateConfig.customer.enabled ? generateConfig.customer.criteria : undefined,
        hospitalCriteria: generateConfig.hospital.enabled ? generateConfig.hospital.criteria : undefined,
        clinicCriteria: generateConfig.clinic.enabled ? generateConfig.clinic.criteria : undefined,
        collaboratorCriteria: generateConfig.collaborator.enabled ? generateConfig.collaborator.criteria : undefined,
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: t.campaigns.detail.contactsGenerated,
        description: `${data.count}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      setShowGenerateDialog(false);
    },
    onError: () => {
      toast({
        title: t.campaigns.detail.error,
        variant: "destructive",
      });
    },
  });

  const deleteImportMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/contacts/delete-batch`, { contactIds });
      return await res.json();
    },
    onSuccess: (data: any) => {
      setImportResult(null);
      setSelectedContacts(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/contact-counts"] });
      toast({ title: t.campaigns.detail.importDeleted, description: `Vymazaných: ${data.deleted} kontaktov` });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.importDeleteError, variant: "destructive" });
    },
  });

  const importContactsMutation = useMutation({
    mutationFn: async (file: File) => {
      setImportProgress(0);
      setImportPhase("upload");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("updateExisting", String(updateExisting));
      formData.append("contactType", importContactType);
      return new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/campaigns/${campaignId}/contacts/import`);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setImportProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.upload.onload = () => {
          setImportProgress(100);
          setImportPhase("processing");
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error || t.campaigns.detail.importFailed));
            }
          } catch { reject(new Error(t.campaigns.detail.importFailed)); }
        };
        xhr.onerror = () => reject(new Error(t.campaigns.detail.networkError));
        xhr.send(formData);
      });
    },
    onSuccess: (data) => {
      setImportPhase(null);
      setImportProgress(0);
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      toast({
        title: t.campaigns.detail.importCompleted,
        description: `${data.created} / ${data.skipped}`,
      });
    },
    onError: (err: any) => {
      setImportPhase(null);
      setImportProgress(0);
      toast({ title: t.campaigns.detail.importError, description: err.message, variant: "destructive" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: string; data: any }) => {
      return apiRequest("PATCH", `/api/campaigns/${campaignId}/contacts/${contactId}`, data);
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.contactUpdated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      setSelectedContact(null);
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.contactUpdateError, variant: "destructive" });
    },
  });

  const updateAgentsMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/agents`, { userIds });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.operatorsUpdated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "agents"] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.operatorsError, variant: "destructive" });
    },
  });

  const updateCampaignStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return apiRequest("PATCH", `/api/campaigns/${campaignId}`, { status: newStatus });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.statusUpdated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.statusUpdateError, variant: "destructive" });
    },
  });

  const cloneCampaignMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/clone`, {});
    },
    onSuccess: (newCampaign: any) => {
      toast({ title: t.campaigns.detail.statusUpdated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      window.location.href = `/campaigns/${newCampaign.id}`;
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  const saveAsTemplateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/save-as-template`, {});
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-templates"] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.settingsError, variant: "destructive" });
    },
  });

  const bulkUpdateContactsMutation = useMutation({
    mutationFn: async ({ contactIds, data }: { contactIds: string[]; data: any }) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/contacts/bulk-update`, { contactIds, ...data });
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: t.campaigns.detail.contactUpdated, description: `${data.count || selectedContacts.size}` });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      setSelectedContacts(new Set());
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.contactUpdateError, variant: "destructive" });
    },
  });

  const requeueMatchingContacts = useMemo(() => {
    if (!showRequeueDialog) return [];
    return contacts.filter((c: any) => {
      if (c.status === "pending") return false;

      if (requeueStatuses.size > 0 && !requeueStatuses.has(c.status)) return false;

      if (requeueDispositions.size > 0) {
        if (!c.dispositionCode || !requeueDispositions.has(c.dispositionCode)) return false;
      }

      if (requeueCallbackFrom || requeueCallbackTo) {
        if (!c.callbackDate) return false;
        const cbDate = new Date(c.callbackDate);
        if (requeueCallbackFrom && cbDate < new Date(requeueCallbackFrom)) return false;
        if (requeueCallbackTo) {
          const toDate = new Date(requeueCallbackTo);
          toDate.setHours(23, 59, 59, 999);
          if (cbDate > toDate) return false;
        }
      }

      return true;
    });
  }, [contacts, showRequeueDialog, requeueStatuses, requeueDispositions, requeueCallbackFrom, requeueCallbackTo]);

  useEffect(() => {
    if (requeueMatchingContacts.length > 0) {
      const maxPage = Math.ceil(requeueMatchingContacts.length / REQUEUE_PAGE_SIZE) - 1;
      if (requeuePage > maxPage) {
        setRequeuePage(maxPage);
      }
    } else {
      setRequeuePage(0);
    }
  }, [requeueMatchingContacts.length, requeuePage]);

  const requeueMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/contacts/bulk-update`, {
        contactIds,
        requeue: true,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: t.campaigns.detail.requeueTitle, description: `${data.count}` });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      setShowRequeueDialog(false);
      setRequeueDispositions(new Set());
      setRequeueStatuses(new Set());
      setRequeueCallbackFrom("");
      setRequeueCallbackTo("");
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  const saveScriptMutation = useMutation({
    mutationFn: async (script: string) => {
      return apiRequest("PATCH", `/api/campaigns/${campaignId}`, { script });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      setScriptModified(false);
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.settingsError, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (campaign?.script !== undefined) {
      const scriptValue = campaign.script || "";
      setScriptContent(scriptValue);
      setScriptModified(false);
      
      // Try to parse as structured script
      try {
        if (scriptValue.startsWith("{")) {
          const parsed = JSON.parse(scriptValue);
          const validated = operatorScriptSchema.safeParse(parsed);
          if (validated.success) {
            setStructuredScript(validated.data);
            setScriptMode("builder");
          } else {
            // Invalid JSON structure, keep as legacy but init empty structured
            setStructuredScript({ version: 1, steps: [] });
            setScriptMode("legacy");
          }
        } else if (scriptValue.trim()) {
          // Plain text script - keep in legacy mode
          setStructuredScript({ version: 1, steps: [] });
          setScriptMode("legacy");
        } else {
          // Empty script - start fresh in builder mode
          setStructuredScript({ version: 1, steps: [] });
          setScriptMode("builder");
        }
      } catch {
        // JSON parse error, keep as legacy
        setStructuredScript({ version: 1, steps: [] });
        setScriptMode("legacy");
      }
      setStructuredScriptModified(false);
    }
  }, [campaign?.script]);

  useEffect(() => { setContactsPage(1); }, [contactFilters, contacts]);

  const handleBulkStatusUpdate = (newStatus: string) => {
    if (selectedContacts.size === 0) return;
    bulkUpdateContactsMutation.mutate({ 
      contactIds: Array.from(selectedContacts), 
      data: { status: newStatus } 
    });
  };

  const handleExportContacts = () => {
    const dataToExport = selectedContacts.size > 0
      ? sortedFilteredContacts.filter((c: any) => selectedContacts.has(c.id))
      : sortedFilteredContacts;
    
    const headers = [t.common.firstName, t.common.lastName, t.common.email, t.common.phone, t.common.status, t.campaigns.detail.result, t.common.code, t.campaigns.detail.attempts, t.campaigns.detail.lastAttempt, t.campaigns.detail.country];
    const rows = dataToExport.map((c: any) => [
      c.customer?.firstName || "",
      c.customer?.lastName || "",
      c.customer?.email || "",
      c.customer?.phone || "",
      (t.campaigns.contactStatuses as Record<string, string>)[c.status] || c.status,
      c.dispositionCode ? getDispName(c.dispositionCode, dispositionMap[c.dispositionCode]?.name || c.dispositionCode) : "",
      c.dispositionCode || "",
      c.attemptCount || 0,
      c.lastAttemptAt ? format(new Date(c.lastAttemptAt), "yyyy-MM-dd HH:mm") : "",
      c.customer?.country || "",
    ]);
    
    const csvContent = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campaign-${campaign?.name || campaignId}-contacts.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: t.campaigns.detail.exportContacts, description: `${dataToExport.length}` });
  };

  if (loadingCampaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <p>Campaign not found</p>
        <Link href="/campaigns">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaigns
          </Button>
        </Link>
      </div>
    );
  }

  const filteredContacts = applyContactFilters(contacts as any, contactFilters);
  let parsedSortRules: ContactSortRule[] = [];
  try {
    const s = JSON.parse(campaign?.settings || "{}");
    if (Array.isArray(s.contactSortRules)) parsedSortRules = s.contactSortRules;
  } catch {}
  const sortedFilteredContacts = parsedSortRules.length > 0
    ? applySortRulesToContacts(filteredContacts, parsedSortRules)
    : filteredContacts;
  const contactsPerPage = 20;
  const totalContactPages = Math.max(1, Math.ceil(sortedFilteredContacts.length / contactsPerPage));
  const paginatedContacts = sortedFilteredContacts.slice((contactsPage - 1) * contactsPerPage, contactsPage * contactsPerPage);

  const progressPercentage = stats 
    ? ((stats.completedContacts + stats.notInterestedContacts) / Math.max(stats.totalContacts, 1)) * 100
    : 0;

  const getContactName = (contact: EnrichedContact) => {
    if (contact.contactType === "hospital" && contact.hospital) return contact.hospital.name || "Nemocnica";
    if (contact.contactType === "clinic" && contact.clinic) return contact.clinic.name || "Klinika";
    if (contact.customer) return `${contact.customer.firstName} ${contact.customer.lastName}`;
    return t.campaigns.detail.unknownContact;
  };

  const getContactDetail = (contact: EnrichedContact) => {
    if (contact.contactType === "hospital" && contact.hospital) return contact.hospital.email || contact.hospital.phone || "-";
    if (contact.contactType === "clinic" && contact.clinic) return contact.clinic.email || contact.clinic.phone || "-";
    return contact.customer?.phone || contact.customer?.email || "-";
  };

  const getContactCountry = (contact: EnrichedContact) => {
    if (contact.contactType === "hospital" && contact.hospital) return contact.hospital.countryCode;
    if (contact.contactType === "clinic" && contact.clinic) return contact.clinic.countryCode;
    return contact.customer?.country;
  };

  const CONTACT_TYPE_LABELS: Record<string, string> = { customer: "Zákazník", hospital: "Nemocnica", clinic: "Klinika" };
  const CONTACT_TYPE_COLORS: Record<string, string> = {
    customer: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    hospital: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    clinic: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  };

  const contactColumns = [
    {
      key: "customer",
      header: t.campaigns.detail.contacts,
      sortable: true,
      sortValue: (contact: EnrichedContact) => getContactName(contact),
      cell: (contact: EnrichedContact) => (
        <div>
          <div className="font-medium flex items-center gap-2">
            {getContactName(contact)}
            {contact.contactType && contact.contactType !== "customer" && (
              <Badge className={`text-[10px] px-1.5 py-0 ${CONTACT_TYPE_COLORS[contact.contactType] || ""}`}>
                {CONTACT_TYPE_LABELS[contact.contactType] || contact.contactType}
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {getContactDetail(contact)}
          </div>
        </div>
      ),
    },
    {
      key: "country",
      header: t.campaigns.detail.country,
      sortable: true,
      sortValue: (contact: EnrichedContact) => getContactCountry(contact) || "",
      cell: (contact: EnrichedContact) => {
        const countryCode = getContactCountry(contact);
        if (!countryCode) return <span>-</span>;
        const countryData = COUNTRIES[countryCode as keyof typeof COUNTRIES] as { name: string } | undefined;
        return <span>{countryData?.name || countryCode}</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.status,
      cell: (contact: EnrichedContact) => {
        const STATUS_SK: Record<string, string> = {
          pending: t.campaigns.contactStatuses.pending,
          contacted: t.campaigns.contactStatuses.contacted,
          completed: t.campaigns.contactStatuses.completed,
          failed: t.campaigns.contactStatuses.failed,
          no_answer: t.campaigns.contactStatuses.no_answer,
          callback_scheduled: t.campaigns.contactStatuses.callback_scheduled,
          not_interested: t.campaigns.contactStatuses.not_interested,
        };
        return (
          <Badge className={CONTACT_STATUS_COLORS[contact.status] || ""}>
            {STATUS_SK[contact.status] || contact.status.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      key: "attemptCount",
      header: t.campaigns.detail.attempts,
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.attemptCount || 0,
      cell: (contact: EnrichedContact) => (
        <span>{contact.attemptCount || 0}</span>
      ),
    },
    {
      key: "lastAttemptAt",
      header: t.campaigns.detail.lastAttempt,
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.lastAttemptAt ? new Date(contact.lastAttemptAt) : null,
      cell: (contact: EnrichedContact) => (
        <span>
          {contact.lastAttemptAt ? format(new Date(contact.lastAttemptAt), "dd.MM.yyyy HH:mm") : "-"}
        </span>
      ),
    },
    {
      key: "priorityScore",
      header: t.campaigns.detail.priority,
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.priorityScore || 0,
      cell: (contact: EnrichedContact) => {
        const score = contact.priorityScore || 50;
        const colors = score >= 75 
          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          : score >= 50 
          ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
        return (
          <Badge variant="outline" className={colors}>
            {score >= 75 ? t.campaigns.detail.priorityHigh : score >= 50 ? t.campaigns.detail.priorityMedium : t.campaigns.detail.priorityLow}
          </Badge>
        );
      },
    },
    {
      key: "assignedTo",
      header: t.campaigns.detail.operator,
      sortable: true,
      sortValue: (contact: EnrichedContact) => {
        const agent = allUsers.find(u => u.id === contact.assignedTo);
        return agent?.fullName || contact.assignedTo || "";
      },
      cell: (contact: EnrichedContact) => {
        if (!contact.assignedTo) return <span className="text-muted-foreground">-</span>;
        const agent = allUsers.find(u => u.id === contact.assignedTo);
        return (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{agent?.fullName || contact.assignedTo}</span>
          </div>
        );
      },
    },
    {
      key: "disposition",
      header: t.campaigns.detail.result,
      sortable: true,
      sortValue: (contact: EnrichedContact) => {
        const dc = (contact as any).dispositionCode;
        return dc ? getDispName(dc, dispositionMap[dc]?.name || dc) : "";
      },
      cell: (contact: EnrichedContact) => {
        const dc = (contact as any).dispositionCode;
        const disp = dc ? dispositionMap[dc] : null;
        const hasCallback = contact.status === "callback_scheduled" && contact.callbackDate;
        const hasNotes = contact.notes && contact.notes.trim().length > 0;

        const colorClasses: Record<string, string> = {
          green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
          orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
          red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
          yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
          gray: "bg-muted text-muted-foreground",
        };

        if (!disp && !hasCallback && !hasNotes) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <div className="space-y-1 max-w-[220px]">
            {disp && (
              <Badge variant="secondary" className={`text-xs ${colorClasses[disp.color] || colorClasses.gray}`} data-testid={`badge-disposition-${dc}`}>
                {getDispName(dc, disp.name)}
              </Badge>
            )}
            {hasCallback && (
              <div className="flex items-center gap-1 text-xs">
                <CalendarPlus className="w-3 h-3 text-blue-500" />
                <span>{format(new Date(contact.callbackDate!), "dd.MM. HH:mm")}</span>
              </div>
            )}
            {hasNotes && (
              <p className="text-xs text-muted-foreground truncate" title={contact.notes!}>
                {contact.notes}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon" data-testid="button-back-campaigns">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge className={STATUS_COLORS[campaign.status]}>
              {t.campaigns.statuses[campaign.status as keyof typeof t.campaigns.statuses] || campaign.status}
            </Badge>
          </div>
          <p className="text-muted-foreground line-clamp-2">
            {campaign.description || ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.status === "draft" && (
            <Button 
              onClick={() => updateCampaignStatusMutation.mutate("active")}
              data-testid="button-activate-campaign"
            >
              <Play className="w-4 h-4 mr-2" />
              {t.campaigns.statuses.active}
            </Button>
          )}
          {campaign.status === "active" && (
            <Button 
              variant="outline"
              onClick={() => updateCampaignStatusMutation.mutate("paused")}
              data-testid="button-pause-campaign"
            >
              <Pause className="w-4 h-4 mr-2" />
              {t.campaigns.statuses.paused}
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button 
              onClick={() => updateCampaignStatusMutation.mutate("active")}
              data-testid="button-resume-campaign"
            >
              <Play className="w-4 h-4 mr-2" />
              {t.campaigns.statuses.active}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-campaign-more">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => cloneCampaignMutation.mutate()}
                disabled={cloneCampaignMutation.isPending}
                data-testid="button-clone-campaign"
              >
                <Copy className="w-4 h-4 mr-2" />
                {t.common.copy}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => saveAsTemplateMutation.mutate()}
                disabled={saveAsTemplateMutation.isPending}
                data-testid="button-save-as-template"
              >
                <Save className="w-4 h-4 mr-2" />
                {t.common.save}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileText className="w-4 h-4 mr-2" />
            {t.campaigns.detail.overview}
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <Users className="w-4 h-4 mr-2" />
            {t.campaigns.detail.contacts}
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-reporting">
            <BarChart3 className="w-4 h-4 mr-2" />
            {t.campaigns.detail.reporting}
          </TabsTrigger>
          <TabsTrigger value="script" data-testid="tab-script">
            <ScrollText className="w-4 h-4 mr-2" />
            {t.campaigns.detail.script}
          </TabsTrigger>
          {campaign?.channel === "email" && (
            <TabsTrigger value="mailchimp" data-testid="tab-mailchimp">
              <Mail className="w-4 h-4 mr-2" />
              Mailchimp
            </TabsTrigger>
          )}
          <TabsTrigger value="phases" data-testid="tab-phases">
            <Layers className="w-4 h-4 mr-2" />
            Fázy
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-2" />
            {t.campaigns.detail.settings}
          </TabsTrigger>
          
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title={t.campaigns.detail.totalContacts}
              value={stats?.totalContacts || 0}
              icon={Users}
            />
            <StatsCard
              title={t.campaigns.detail.pendingContacts}
              value={stats?.pendingContacts || 0}
              description={`${((stats?.pendingContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              icon={Clock}
            />
            <StatsCard
              title={t.campaigns.detail.completedContacts}
              value={stats?.completedContacts || 0}
              description={`${((stats?.completedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              icon={CheckCircle}
            />
            <StatsCard
              title={t.campaigns.detail.callbackScheduled}
              value={stats?.callbackContacts || 0}
              icon={Phone}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t.campaigns.detail.progress}</CardTitle>
              <CardDescription>
                {stats?.completedContacts || 0} / {stats?.totalContacts || 0}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progressPercentage} className="h-3" />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns.detail.campaignSummary}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.type}</span>
                  <Badge variant="outline">{campaign.type}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.detail.country}</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {campaign.countryCodes?.map(code => (
                      <Badge key={code} variant="secondary" className="text-xs">
                        {COUNTRIES.find(c => c.code === code)?.flag} {code}
                      </Badge>
                    ))}
                    {(!campaign.countryCodes || campaign.countryCodes.length === 0) && (
                      <span>{t.common.allCountries}</span>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.startDate}</span>
                  <span>{campaign.startDate ? format(new Date(campaign.startDate), DATE_FORMAT_MAP[campaign.countryCodes?.[0] || "SK"] || "dd.MM.yyyy", { locale: DATE_LOCALE_MAP[campaign.countryCodes?.[0] || "SK"] || sk }) : "-"}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.endDate}</span>
                  <span>{campaign.endDate ? format(new Date(campaign.endDate), DATE_FORMAT_MAP[campaign.countryCodes?.[0] || "SK"] || "dd.MM.yyyy", { locale: DATE_LOCALE_MAP[campaign.countryCodes?.[0] || "SK"] || sk }) : "-"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns.detail.statusDistribution}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    {t.campaigns.contactStatuses.completed}
                  </span>
                  <span className="font-medium">{stats?.completedContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    {t.campaigns.contactStatuses.contacted}
                  </span>
                  <span className="font-medium">{stats?.contactedContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    {t.campaigns.contactStatuses.no_answer}
                  </span>
                  <span className="font-medium">{stats?.noAnswerContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    {t.campaigns.contactStatuses.callback_scheduled}
                  </span>
                  <span className="font-medium">{stats?.callbackContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    {t.campaigns.contactStatuses.not_interested}
                  </span>
                  <span className="font-medium">{stats?.notInterestedContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    {t.campaigns.contactStatuses.failed}
                  </span>
                  <span className="font-medium">{stats?.failedContacts || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <CampaignContactsFilter
                filters={contactFilters}
                onFiltersChange={setContactFilters}
                onClear={() => setContactFilters({})}
                countryCodes={campaign.countryCodes || []}
              />
              {selectedContacts.size > 0 && (
                <div className="flex items-center gap-2 pl-2 border-l">
                  <span className="text-sm font-medium">
                    {selectedContacts.size} {t.campaigns.detail.selected}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-bulk-actions">
                        <MoreHorizontal className="w-4 h-4 mr-2" />
                        {t.campaigns.detail.bulkActions}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate("completed")} data-testid="menu-bulk-completed">
                        <CheckCheck className="w-4 h-4 mr-2" />
                        {t.campaigns.detail.markCompleted}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate("not_interested")} data-testid="menu-bulk-not-interested">
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t.campaigns.detail.markNotInterested}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate("pending")} data-testid="menu-bulk-pending">
                        <Clock className="w-4 h-4 mr-2" />
                        {t.campaigns.detail.resetPending}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          if (window.confirm(`Naozaj chcete vymazať ${selectedContacts.size} kontaktov z kampane? Táto akcia je nevratná.`)) {
                            deleteImportMutation.mutate(Array.from(selectedContacts));
                          }
                        }}
                        data-testid="menu-bulk-delete"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Vymazať z kampane ({selectedContacts.size})
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelectedContacts(new Set())} data-testid="menu-clear-selection">
                        {t.campaigns.detail.clearSelection}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredContacts.length} / {contacts.length} kontaktov
              </span>
              <Button
                variant="outline"
                onClick={() => setShowSortRulesDialog(true)}
                data-testid="button-open-sort-rules"
              >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                {t.campaigns.detail.sortRulesConfigureBtn}
                {(() => { try { const s = JSON.parse(campaign.settings || "{}"); const c = (s.contactSortRules || []).length; return c > 0 ? <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">{c}</Badge> : null; } catch { return null; } })()}
              </Button>
              <Button
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-600 dark:from-amber-600 dark:to-orange-600 dark:border-amber-700"
                onClick={() => {
                  setRequeueDispositions(new Set());
                  setRequeueStatuses(new Set());
                  setRequeueCallbackFrom("");
                  setRequeueCallbackTo("");
                  setShowRequeueDialog(true);
                }}
                data-testid="button-requeue-contacts"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t.campaigns.detail.requeueButton}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setImportFile(null);
                  setImportResult(null);
                  setShowImportDialog(true);
                }}
                data-testid="button-import-contacts"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowGenerateDialog(true)}
                disabled={generateContactsMutation.isPending}
                data-testid="button-generate-contacts"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${generateContactsMutation.isPending ? "animate-spin" : ""}`} />
                {t.campaigns.detail.generateContacts}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportContacts}
                data-testid="button-export-contacts"
              >
                <Download className="w-4 h-4 mr-2" />
                {selectedContacts.size > 0 ? `Export (${selectedContacts.size})` : "Export"}
              </Button>
            </div>
          </div>

          {loadingContacts ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <DataTable
                columns={contactColumns}
                data={paginatedContacts as EnrichedContact[]}
                getRowKey={(contact) => contact.id}
                onRowClick={(contact) => setSelectedContact(contact)}
                selectable
                selectedKeys={selectedContacts}
                onSelectionChange={setSelectedContacts}
                sortConfig={sortConfig}
                onSortChange={setSortConfig}
              />
              {totalContactPages > 1 && (
                <div className="flex items-center justify-between pt-3 px-1">
                  <span className="text-sm text-muted-foreground">
                    {(contactsPage - 1) * contactsPerPage + 1}–{Math.min(contactsPage * contactsPerPage, sortedFilteredContacts.length)} z {sortedFilteredContacts.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={contactsPage <= 1} onClick={() => setContactsPage(1)} data-testid="btn-contacts-first">
                      <ChevronLeft className="w-4 h-4" /><ChevronLeft className="w-4 h-4 -ml-2" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={contactsPage <= 1} onClick={() => setContactsPage(p => p - 1)} data-testid="btn-contacts-prev">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm px-3 font-medium">{contactsPage} / {totalContactPages}</span>
                    <Button variant="outline" size="sm" disabled={contactsPage >= totalContactPages} onClick={() => setContactsPage(p => p + 1)} data-testid="btn-contacts-next">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={contactsPage >= totalContactPages} onClick={() => setContactsPage(totalContactPages)} data-testid="btn-contacts-last">
                      <ChevronRight className="w-4 h-4" /><ChevronRight className="w-4 h-4 -ml-2" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-0" data-testid="tab-content-settings">
          <div className="flex border rounded-lg overflow-hidden min-h-[500px]">
              <div className="w-56 border-r bg-muted/20 py-3 px-3 flex flex-col gap-1 shrink-0">
                  {[
                    { value: "general", icon: Settings, label: t.campaigns.detail.general, desc: "Základné nastavenia" },
                    { value: "scheduling", icon: Clock, label: t.campaigns.detail.scheduling, desc: "Pracovné hodiny" },
                    { value: "operators", icon: Shield, label: t.campaigns.detail.operator, desc: "Priradení operátori" },
                    { value: "dispositions", icon: CheckCheck, label: t.campaigns.detail.dispositions, desc: "Stavy a výsledky" },
                    { value: "kpi", icon: Target, label: t.campaigns.detail.kpiTargets, desc: "Ciele a metriky" },
                  ].map((tab) => {
                    const isActive = settingsSubTab === tab.value;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setSettingsSubTab(tab.value)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full transition-all ${
                          isActive
                            ? "bg-background shadow-sm border border-border"
                            : "hover:bg-background/60"
                        }`}
                        data-testid={`subtab-${tab.value}`}
                      >
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          <tab.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm font-medium truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{tab.label}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{tab.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {settingsSubTab === "general" && (
                    <div className="space-y-6">
                      <CampaignDetailsCard campaign={campaign} />
                      <Card>
                        <CardHeader>
                          <CardTitle>{t.campaigns.detail.defaultAgentTab}</CardTitle>
                          <CardDescription>
                            {t.campaigns.detail.defaultAgentTabDesc}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Select 
                            value={campaign.defaultActiveTab || "phone"} 
                            onValueChange={(v) => {
                              apiRequest("PATCH", `/api/campaigns/${campaign.id}`, { defaultActiveTab: v })
                                .then(() => {
                                  toast({ title: t.campaigns.detail.settingsSaved });
                                  queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
                                })
                                .catch(() => toast({ title: t.campaigns.detail.error, variant: "destructive" }));
                            }}
                          >
                            <SelectTrigger className="w-64" data-testid="select-default-active-tab">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="phone">{t.campaigns.detail.phone}</SelectItem>
                              <SelectItem value="script">{t.campaigns.detail.script}</SelectItem>
                              <SelectItem value="email">{t.campaigns.detail.email}</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                            </SelectContent>
                          </Select>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle>Disposition Mode</CardTitle>
                          <CardDescription>
                            Nastavte, kde sa vyberá dispozícia hovoru — či cez tlačidlá v call scripte alebo cez tlačidlo ukončenia hovoru.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Select
                            value={(() => {
                              try {
                                const s = campaign.settings ? JSON.parse(campaign.settings) : {};
                                return s.dispositionMode || "end_call";
                              } catch { return "end_call"; }
                            })()}
                            onValueChange={(v) => {
                              let existing: any = {};
                              try { if (campaign.settings) existing = JSON.parse(campaign.settings); } catch {}
                              const merged = { ...existing, dispositionMode: v };
                              apiRequest("PATCH", `/api/campaigns/${campaign.id}`, { settings: JSON.stringify(merged) })
                                .then(() => {
                                  toast({ title: t.campaigns.detail.settingsSaved });
                                  queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
                                })
                                .catch(() => toast({ title: t.campaigns.detail.error, variant: "destructive" }));
                            }}
                          >
                            <SelectTrigger className="w-80" data-testid="select-disposition-mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="end_call">Tlačidlo ukončenia hovoru (predvolené)</SelectItem>
                              <SelectItem value="script">Výber v call scripte (dispozícia z voľby)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-2">
                            {(() => {
                              try {
                                const s = campaign.settings ? JSON.parse(campaign.settings) : {};
                                return s.dispositionMode === "script"
                                  ? "Dispozícia sa nastaví automaticky pri výbere možnosti v call scripte. Priraďte dispozície k jednotlivým možnostiam v script builderi."
                                  : "Dispozícia sa vyberá manuálne po ukončení hovoru cez štandardné tlačidlo.";
                              } catch { return ""; }
                            })()}
                          </p>
                        </CardContent>
                      </Card>
                      <CampaignSopSettingsCard campaignId={campaign.id} />
                      <AutoModeCard campaign={campaign} />
                      <CriteriaCard campaign={campaign} />
                    </div>
                  )}

                  {settingsSubTab === "scheduling" && (
                    <div className="space-y-6">
                      <SchedulingCard campaign={campaign} />
                    </div>
                  )}

                  {settingsSubTab === "operators" && (
                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            {t.campaigns.detail.assignedOperators}
                          </CardTitle>
                          <CardDescription>
                            {t.campaigns.detail.assignedOperatorsDesc}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {assignableUsers.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                {t.campaigns.detail.noOperatorsAvailable}
                              </p>
                            ) : (
                              <div className="grid gap-3">
                                {assignableUsers.map((user) => {
                                  const isAssigned = assignedAgentIds.includes(user.id);
                                  return (
                                    <div 
                                      key={user.id} 
                                      className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${isAssigned ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAssigned ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                          <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <p className="font-medium">{user.fullName}</p>
                                          <p className="text-sm text-muted-foreground">{roles.find(r => r.id === user.roleId)?.name || user.role}</p>
                                        </div>
                                      </div>
                                      <Button
                                        variant={isAssigned ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                          const newAgentIds = isAssigned
                                            ? assignedAgentIds.filter(id => id !== user.id)
                                            : [...assignedAgentIds, user.id];
                                          updateAgentsMutation.mutate(newAgentIds);
                                        }}
                                        disabled={updateAgentsMutation.isPending}
                                        data-testid={`button-toggle-agent-settings-${user.id}`}
                                      >
                                        {isAssigned ? (
                                          <>
                                            <CheckCheck className="w-4 h-4 mr-2" />
                                            {t.campaigns.detail.assigned}
                                          </>
                                        ) : (
                                          t.campaigns.detail.assign
                                        )}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                      {assignedAgentIds.length > 0 && (
                        <QuotasCard
                          campaignId={campaignId}
                          assignedAgentIds={assignedAgentIds}
                          allUsers={allUsers}
                          t={t}
                        />
                      )}
                    </div>
                  )}

                  {settingsSubTab === "dispositions" && (
                    <div className="space-y-4">
                      <DispositionsTab campaignId={campaignId} embedded />
                    </div>
                  )}

                  {settingsSubTab === "kpi" && (
                    <div className="space-y-6">
                      <KpiTargetsCard campaign={campaign} />
                    </div>
                  )}
                </div>
          </div>
        </TabsContent>

        

        <TabsContent value="reporting" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title={t.campaigns.detail.contactRate}
              value={`${((stats?.contactedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              description={`${t.campaigns.contactStatuses.contacted} / ${t.campaigns.detail.totalContacts}`}
              icon={Phone}
            />
            <StatsCard
              title={t.campaigns.detail.completionRate}
              value={`${((stats?.completedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              description={`${t.campaigns.detail.completedContacts} / ${t.campaigns.detail.totalContacts}`}
              icon={CheckCircle}
            />
            <StatsCard
              title={t.campaigns.detail.conversionRate}
              value={`${(((stats?.completedContacts || 0) / Math.max((stats?.contactedContacts || 0) + (stats?.completedContacts || 0), 1)) * 100).toFixed(1)}%`}
              description={`${t.campaigns.detail.completedContacts} / ${t.campaigns.contactStatuses.contacted}`}
              icon={Users}
            />
            <StatsCard
              title={t.campaigns.detail.avgAttempts}
              value={contacts.length > 0 
                ? (contacts.reduce((sum, c) => sum + (c.attemptCount || 0), 0) / contacts.length).toFixed(1)
                : "0"
              }
              description={t.campaigns.detail.contacts}
              icon={RefreshCw}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.campaigns.detail.successful}</p>
                    <p className="text-2xl font-bold">{stats?.completedContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.campaigns.detail.pendingContacts}</p>
                    <p className="text-2xl font-bold">{stats?.pendingContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Phone className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.campaigns.contactStatuses.no_answer}</p>
                    <p className="text-2xl font-bold">{stats?.noAnswerContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Users className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.campaigns.detail.notInterested}</p>
                    <p className="text-2xl font-bold">{stats?.notInterestedContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns.detail.statusDistribution}</CardTitle>
              </CardHeader>
              <CardContent>
                {stats && stats.totalContacts > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: t.campaigns.contactStatuses.pending, value: stats.pendingContacts || 0, color: CHART_PALETTE[3] },
                          { name: t.campaigns.contactStatuses.contacted, value: stats.contactedContacts || 0, color: CHART_PALETTE[1] },
                          { name: t.campaigns.contactStatuses.completed, value: stats.completedContacts || 0, color: CHART_PALETTE[0] },
                          { name: t.campaigns.contactStatuses.no_answer, value: stats.noAnswerContacts || 0, color: CHART_PALETTE[2] },
                          { name: t.campaigns.contactStatuses.not_interested, value: stats.notInterestedContacts || 0, color: CHART_PALETTE[4] },
                          { name: t.campaigns.contactStatuses.failed, value: stats.failedContacts || 0, color: CHART_PALETTE[6] },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {[
                          { color: CHART_PALETTE[3] },
                          { color: CHART_PALETTE[1] },
                          { color: CHART_PALETTE[0] },
                          { color: CHART_PALETTE[2] },
                          { color: CHART_PALETTE[4] },
                          { color: CHART_PALETTE[6] },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    {t.campaigns.detail.noDataAvailable}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns.detail.attemptDistribution}</CardTitle>
              </CardHeader>
              <CardContent>
                {contacts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={(() => {
                        const attemptCounts: Record<number, number> = {};
                        contacts.forEach(c => {
                          const attempts = c.attemptCount || 0;
                          attemptCounts[attempts] = (attemptCounts[attempts] || 0) + 1;
                        });
                        return Object.entries(attemptCounts)
                          .map(([attempts, count]) => ({
                            attempts: `${attempts} pokusov`,
                            count,
                          }))
                          .sort((a, b) => parseInt(a.attempts) - parseInt(b.attempts));
                      })()}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <XAxis dataKey="attempts" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    {t.campaigns.detail.noDataAvailable}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle>{t.campaigns.detail.campaignSummary}</CardTitle>
              </div>
              <Button variant="outline" data-testid="button-export-report">
                <Download className="w-4 h-4 mr-2" />
                {t.campaigns.detail.exportReport}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns.detail.totalContacts}</p>
                  <p className="text-2xl font-bold">{stats?.totalContacts || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns.detail.successRate}</p>
                  <p className="text-2xl font-bold">
                    {((stats?.completedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns.detail.pendingContacts}</p>
                  <p className="text-2xl font-bold">{stats?.pendingContacts || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns.detail.callbackScheduled}</p>
                  <p className="text-2xl font-bold">{stats?.callbackContacts || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {(() => {
            let kpiTargets: Record<string, number> = {};
            try {
              if (campaign.settings) {
                const s = JSON.parse(campaign.settings);
                if (s.kpiTargets) kpiTargets = s.kpiTargets;
              }
            } catch {}
            const hasAnyTarget = Object.values(kpiTargets).some(v => v > 0);
            if (!hasAnyTarget) return null;

            const totalContacts = stats?.totalContacts || 0;
            const completedContacts = stats?.completedContacts || 0;
            const contactedContacts = stats?.contactedContacts || 0;
            const processedContacts = completedContacts + contactedContacts + (stats?.noAnswerContacts || 0) + (stats?.notInterestedContacts || 0) + (stats?.failedContacts || 0);
            const completionPct = totalContacts > 0 ? (processedContacts / totalContacts * 100) : 0;
            const conversionPct = processedContacts > 0 ? (completedContacts / processedContacts * 100) : 0;

            const campaignKpis = [
              { key: "campaignTotalContactsTarget", label: t.campaigns.detail.totalContacts, current: totalContacts, unit: "" },
              { key: "campaignCompletionTarget", label: t.campaigns.detail.completionRate, current: parseFloat(completionPct.toFixed(1)), unit: "%" },
              { key: "campaignConversionTarget", label: t.campaigns.detail.conversionRate, current: parseFloat(conversionPct.toFixed(1)), unit: "%" },
            ].filter(k => (kpiTargets[k.key] || 0) > 0);

            return (
              <Card data-testid="card-kpi-tracking">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    {t.campaigns.detail.kpiTracking}
                  </CardTitle>
                  <CardDescription>
                    {t.campaigns.detail.kpiTrackingDesc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {campaignKpis.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        {t.campaigns.detail.kpiTargets}
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {campaignKpis.map(kpi => {
                          const target = kpiTargets[kpi.key] || 0;
                          const pct = target > 0 ? Math.min((kpi.current / target) * 100, 100) : 0;
                          const status = pct >= 100 ? "text-green-600 dark:text-green-400" : pct >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
                          const bgStatus = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";
                          return (
                            <div key={kpi.key} className="p-4 rounded-lg border space-y-3" data-testid={`kpi-progress-${kpi.key}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">{kpi.label}</span>
                                <span className={`text-sm font-bold ${status}`}>{pct.toFixed(0)}%</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${bgStatus}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span>{t.campaigns.detail.current}: {kpi.current}{kpi.unit}</span>
                                <span>{t.campaigns.detail.target}: {target}{kpi.unit}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(kpiTargets.campaignRevenueTarget || 0) > 0 && (
                    <div className="p-4 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Flag className="w-4 h-4 text-muted-foreground" />
                          {t.campaigns.detail.targetRevenue}
                        </span>
                        <span className="text-sm font-bold text-muted-foreground">
                          {(kpiTargets.campaignRevenueTarget || 0).toLocaleString("sk-SK")} EUR
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.campaigns.detail.revenueTrackingDesc}
                      </p>
                    </div>
                  )}

                  {(kpiTargets.agentDailyCallsTarget || 0) > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {t.campaigns.detail.dailyOperatorTargets}
                      </h4>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {[
                          { key: "agentDailyCallsTarget", label: t.campaigns.detail.callsPerDay, icon: Phone },
                          { key: "agentDailyContactsTarget", label: t.campaigns.detail.contactsPerDay, icon: UserCheck },
                          { key: "agentDailySuccessTarget", label: t.campaigns.detail.conversionsPerDay, icon: Star },
                          { key: "agentConversionRateTarget", label: t.campaigns.detail.conversionRate, icon: Target, unit: "%" },
                          { key: "agentAvgCallDurationTarget", label: t.campaigns.detail.kpiAvgCallDuration, icon: Clock, unit: " min" },
                          { key: "agentMaxIdleMinutes", label: t.campaigns.detail.kpiMaxIdleTime, icon: Clock, unit: " min" },
                          { key: "agentCallbackComplianceTarget", label: t.campaigns.detail.dispActionCallback, icon: CalendarPlus, unit: "%" },
                        ].filter(k => (kpiTargets[k.key] || 0) > 0).map(kpi => {
                          const IconComp = kpi.icon;
                          return (
                            <div key={kpi.key} className="p-3 rounded-lg border flex items-center gap-3" data-testid={`kpi-agent-${kpi.key}`}>
                              <IconComp className="w-4 h-4 text-primary shrink-0" />
                              <div>
                                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                                <p className="text-sm font-bold">{kpiTargets[kpi.key]}{kpi.unit || ""}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(kpiTargets.campaignDurationDays || 0) > 0 && (
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{t.campaigns.detail.kpiPlannedDuration}:</span>
                        <span className="font-semibold">{kpiTargets.campaignDurationDays} {t.campaigns.detail.workingDays}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          <Card data-testid="card-agent-performance">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t.campaigns.detail.operatorPerformance}
              </CardTitle>
              <CardDescription>
                {t.campaigns.detail.operatorPerformanceDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentStatsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">{t.campaigns.detail.loadingOperatorStats}</p>
                </div>
              ) : agentStatsError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-destructive" />
                  <p className="text-sm">{t.campaigns.detail.operatorStatsError}</p>
                  <p className="text-xs mt-1">{agentStatsErrorMsg?.message || t.campaigns.detail.refreshPage}</p>
                </div>
              ) : agentStatsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t.campaigns.detail.noDataAvailable}</p>
                  <p className="text-xs mt-1">{t.campaigns.detail.operatorAssignmentDesc}</p>
                </div>
              ) : (() => {
                  const kpiTgts: Record<string, number> = {};
                  try {
                    if (campaign.settings) {
                      const s = JSON.parse(campaign.settings);
                      if (s.kpiTargets) Object.assign(kpiTgts, s.kpiTargets);
                    }
                  } catch {}

                  return (<>{agentStatsData.map(agent => {
                    const dailyContactsTarget = kpiTgts.agentDailyContactsTarget || 0;
                    const dailyCallsTarget = kpiTgts.agentDailyCallsTarget || 0;
                    const dailySuccessTarget = kpiTgts.agentDailySuccessTarget || 0;
                    const conversionTarget = kpiTgts.agentConversionRateTarget || 0;

                    const contactedTodayPct = dailyContactsTarget > 0 
                      ? Math.min((agent.contactedToday / dailyContactsTarget) * 100, 100) : 0;
                    const dispositionsTodayPct = dailyCallsTarget > 0 
                      ? Math.min((agent.dispositionsToday / dailyCallsTarget) * 100, 100) : 0;
                    const completedTodayPct = dailySuccessTarget > 0 
                      ? Math.min((agent.completedToday / dailySuccessTarget) * 100, 100) : 0;

                    const processedTotal = agent.completedTotal + agent.noAnswerTotal + agent.notInterestedTotal + agent.failedTotal;
                    const conversionPct = processedTotal > 0 ? ((agent.completedTotal / processedTotal) * 100) : 0;
                    const conversionFulfillPct = conversionTarget > 0 ? Math.min((conversionPct / conversionTarget) * 100, 100) : 0;

                    const hasAnyDailyTarget = dailyContactsTarget > 0 || dailyCallsTarget > 0 || dailySuccessTarget > 0 || conversionTarget > 0;

                    const getBarColor = (pct: number) =>
                      pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : pct >= 30 ? "bg-orange-500" : "bg-red-500";
                    const getTextColor = (pct: number) =>
                      pct >= 100 ? "text-green-600 dark:text-green-400" : pct >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";

                    return (
                      <div key={agent.userId} className="p-4 rounded-lg border space-y-3" data-testid={`agent-perf-card-${agent.userId}`}>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              {agent.avatarUrl && <AvatarImage src={agent.avatarUrl} alt={agent.name} />}
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold" data-testid={`text-agent-perf-name-${agent.userId}`}>{agent.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {agent.totalContacts} kontaktov celkom
                                {agent.lastActiveAt && ` · Posledná aktivita: ${new Date(agent.lastActiveAt).toLocaleDateString("sk-SK")} ${new Date(agent.lastActiveAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {agent.completedTotal} {t.campaigns.detail.successful}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <PhoneMissed className="w-3 h-3 mr-1" />
                              {agent.noAnswerTotal} {t.campaigns.contactStatuses.no_answer}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <CalendarPlus className="w-3 h-3 mr-1" />
                              {agent.callbackTotal} callback
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <Ban className="w-3 h-3 mr-1" />
                              {agent.notInterestedTotal} {t.campaigns.detail.notInterested}
                            </Badge>
                          </div>
                        </div>

                        {hasAnyDailyTarget && (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {dailyContactsTarget > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Kontakty dnes</span>
                                  <span className={`text-xs font-bold ${getTextColor(contactedTodayPct)}`}>
                                    {agent.contactedToday}/{dailyContactsTarget}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${getBarColor(contactedTodayPct)}`} style={{ width: `${contactedTodayPct}%` }} />
                                </div>
                              </div>
                            )}
                            {dailyCallsTarget > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">{t.campaigns.detail.dispositionsToday}</span>
                                  <span className={`text-xs font-bold ${getTextColor(dispositionsTodayPct)}`}>
                                    {agent.dispositionsToday}/{dailyCallsTarget}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${getBarColor(dispositionsTodayPct)}`} style={{ width: `${dispositionsTodayPct}%` }} />
                                </div>
                              </div>
                            )}
                            {dailySuccessTarget > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Konverzie dnes</span>
                                  <span className={`text-xs font-bold ${getTextColor(completedTodayPct)}`}>
                                    {agent.completedToday}/{dailySuccessTarget}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${getBarColor(completedTodayPct)}`} style={{ width: `${completedTodayPct}%` }} />
                                </div>
                              </div>
                            )}
                            {conversionTarget > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">{t.campaigns.detail.conversionRate}</span>
                                  <span className={`text-xs font-bold ${getTextColor(conversionFulfillPct)}`}>
                                    {conversionPct.toFixed(1)}%/{conversionTarget}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${getBarColor(conversionFulfillPct)}`} style={{ width: `${conversionFulfillPct}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-5 text-center pt-2 border-t">
                          <div>
                            <p className="text-lg font-bold">{agent.totalContacts}</p>
                            <p className="text-xs text-muted-foreground">{t.campaigns.detail.contacts}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{agent.totalDispositions}</p>
                            <p className="text-xs text-muted-foreground">{t.campaigns.detail.dispositions}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{agent.dispositionsToday}</p>
                            <p className="text-xs text-muted-foreground">{t.campaigns.detail.kpiDailyCallTarget}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{agent.avgAttemptsPerContact}</p>
                            <p className="text-xs text-muted-foreground">{t.campaigns.detail.avgAttempts}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{processedTotal > 0 ? conversionPct.toFixed(0) : 0}%</p>
                            <p className="text-xs text-muted-foreground">{t.campaigns.detail.conversionRate}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}</>);
                })()}
              </CardContent>
            </Card>

          <CampaignReportingPhases campaignId={campaign.id} />

          <div className="flex items-center gap-2">
            <Link href={`/campaigns/${campaign.id}/reports`}>
              <Button variant="outline" data-testid="button-campaign-reports-full">
                <BarChart3 className="w-4 h-4 mr-2" />
                {t.campaignReports?.openFullReports || 'Open Full Reports'}
              </Button>
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="script" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="w-5 h-5" />
                  {t.campaigns.detail.scriptBuilder}
                </CardTitle>
                <CardDescription>
                  {t.campaigns.detail.scriptBuilder}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" data-testid="button-load-script-template">
                      <FileDown className="w-4 h-4 mr-2" />
                      {t.campaigns.detail.loadTemplate || "Load template"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => {
                      const script = getDefaultSalesScript(locale);
                      setStructuredScript(script);
                      setStructuredScriptModified(true);
                      setScriptMode("builder");
                    }} data-testid="menu-load-sales-script">
                      {t.campaigns.detail.salesScript || "Sales script"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Select
                  value={scriptMode}
                  onValueChange={(v) => setScriptMode(v as "builder" | "preview" | "legacy")}
                >
                  <SelectTrigger className="w-40" data-testid="select-script-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="builder">Editor</SelectItem>
                    <SelectItem value="preview">{t.campaigns.detail.preview}</SelectItem>
                    <SelectItem value="legacy">{t.campaigns.detail.textMode}</SelectItem>
                  </SelectContent>
                </Select>
                {scriptMode !== "legacy" && (
                  <Button
                    onClick={() => {
                      if (structuredScript) {
                        saveScriptMutation.mutate(JSON.stringify(structuredScript));
                        setStructuredScriptModified(false);
                      }
                    }}
                    disabled={!structuredScriptModified || saveScriptMutation.isPending}
                    data-testid="button-save-structured-script"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveScriptMutation.isPending ? t.campaigns.detail.saving : t.common.save}
                  </Button>
                )}
                {scriptMode === "legacy" && (
                  <Button
                    onClick={() => saveScriptMutation.mutate(scriptContent)}
                    disabled={!scriptModified || saveScriptMutation.isPending}
                    data-testid="button-save-script"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveScriptMutation.isPending ? t.campaigns.detail.saving : t.common.save}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {scriptMode === "builder" && (
                <div className="min-h-[500px]">
                  <ScriptBuilder
                    script={structuredScript}
                    onChange={(newScript) => {
                      setStructuredScript(newScript);
                      setStructuredScriptModified(true);
                    }}
                    onSave={(s) => {
                      setStructuredScript(s);
                      saveScriptMutation.mutate(JSON.stringify(s));
                      setStructuredScriptModified(false);
                    }}
                    isSaving={saveScriptMutation.isPending}
                    campaignId={campaign.id}
                  />
                  {structuredScriptModified && (
                    <div className="mt-4 flex items-center gap-2">
                      <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20">
                        {t.campaigns.detail.saving}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
              
              {scriptMode === "preview" && structuredScript && (
                <div className="min-h-[500px]">
                  <ScriptRunner
                    script={structuredScript}
                    onComplete={(session) => {
                      toast({ 
                        title: t.campaigns.detail.settingsSaved, 
                        description: `${session.responses.length}` 
                      });
                    }}
                  />
                </div>
              )}
              
              <div className="flex gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/campaigns/${id}/generate-acquisition-script`, {
                        method: "POST",
                        credentials: "include",
                      });
                      if (res.ok) {
                        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", id] });
                        toast({ title: "Akvizičný scenár vygenerovaný", description: "Scenár bol úspešne nastavený pre kampaň." });
                      }
                    } catch {}
                  }}
                  data-testid="btn-generate-acquisition-script"
                >
                  <Wand2 className="h-4 w-4" />
                  Generovať akvizičný scenár
                </Button>
              </div>

              {scriptMode === "legacy" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="script-editor">{t.campaigns.detail.scriptBuilder}</Label>
                    <Textarea
                      id="script-editor"
                      placeholder={t.campaigns.detail.scriptBuilder}
                      value={scriptContent.startsWith("{") ? "" : scriptContent}
                      onChange={(e) => {
                        setScriptContent(e.target.value);
                        setScriptModified(true);
                      }}
                      className="min-h-[400px] font-mono text-sm"
                      data-testid="textarea-script"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {scriptModified && (
                      <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20">
                        {t.campaigns.detail.saving}
                      </Badge>
                    )}
                    {!scriptModified && scriptContent && !scriptContent.startsWith("{") && (
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20">
                        {t.common.saved}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
        </TabsContent>

        {campaign?.channel === "email" && (
          <TabsContent value="mailchimp" className="space-y-6">
            <MailchimpSyncSection campaignId={campaignId!} campaignName={campaign?.name || ""} countryCodes={campaign?.countryCodes || []} />
          </TabsContent>
        )}

        <TabsContent value="phases" className="space-y-6">
          {campaign && <CampaignPhasesTab campaignId={campaign.id} />}
        </TabsContent>

      </Tabs>

      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.campaigns.detail.contactDetail}</DialogTitle>
            <DialogDescription>
              {selectedContact?.customer 
                ? `${selectedContact.customer.firstName} ${selectedContact.customer.lastName}`
                : t.campaigns.detail.unknownContact
              }
            </DialogDescription>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={CONTACT_STATUS_COLORS[selectedContact.status]}>
                    {t.campaigns.contactStatuses[selectedContact.status as keyof typeof t.campaigns.contactStatuses] || selectedContact.status}
                  </Badge>
                </div>
                {(selectedContact as any).dispositionCode && dispositionMap[(selectedContact as any).dispositionCode] && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t.campaigns.detail.result}</span>
                    <Badge variant="secondary" className={`text-xs ${
                      {
                        green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                        blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                        orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
                        red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                        yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                        gray: "bg-muted text-muted-foreground",
                      }[dispositionMap[(selectedContact as any).dispositionCode]?.color] || "bg-muted text-muted-foreground"
                    }`}>
                      {getDispName((selectedContact as any).dispositionCode, dispositionMap[(selectedContact as any).dispositionCode]?.name)}
                    </Badge>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.detail.attempts}</span>
                  <span>{selectedContact.attemptCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.detail.phone}</span>
                  <span>{selectedContact.customer?.phone || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.detail.email}</span>
                  <span>{selectedContact.customer?.email || "-"}</span>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.campaigns.detail.changeStatus}</label>
                <Select
                  value={selectedContact.status}
                  onValueChange={(value) => {
                    updateContactMutation.mutate({
                      contactId: selectedContact.id,
                      data: { status: value },
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-update-contact-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t.campaigns.contactStatuses.pending}</SelectItem>
                    <SelectItem value="contacted">{t.campaigns.contactStatuses.contacted}</SelectItem>
                    <SelectItem value="completed">{t.campaigns.contactStatuses.completed}</SelectItem>
                    <SelectItem value="no_answer">{t.campaigns.contactStatuses.no_answer}</SelectItem>
                    <SelectItem value="callback_scheduled">{t.campaigns.contactStatuses.callback_scheduled}</SelectItem>
                    <SelectItem value="not_interested">{t.campaigns.contactStatuses.not_interested}</SelectItem>
                    <SelectItem value="failed">{t.campaigns.contactStatuses.failed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">{t.campaigns.detail.customerHistory}</label>
                </div>
                <ScrollArea className="h-48 rounded-md border p-2">
                  {contactActivityLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t.campaigns.detail.noHistory}</p>
                  ) : (
                    <div className="space-y-2">
                      {contactActivityLogs.slice(0, 10).map((log) => {
                        const details = log.details || {};
                        const getActionLabel = (action: string) => {
                          const labels: Record<string, string> = {
                            create: t.campaigns.detail.created,
                            update: t.campaigns.detail.updated,
                            delete: t.campaigns.detail.remove,
                            pipeline_move: "Pipeline",
                            stage_changed: "Pipeline",
                            campaign_joined: t.campaigns.detail.campaignJoined,
                            campaign_left: t.campaigns.detail.campaignLeft,
                            email_sent: t.campaigns.detail.emailSent,
                            sms_sent: t.campaigns.detail.smsSent,
                            note_added: t.campaigns.detail.noteAdded,
                          };
                          return labels[action] || action;
                        };
                        
                        const getActionIcon = (action: string) => {
                          if (action === "pipeline_move" || action === "stage_changed") return ArrowRight;
                          if (action === "campaign_joined" || action === "campaign_left") return Users;
                          if (action === "email_sent") return Mail;
                          if (action === "sms_sent") return MessageSquare;
                          if (action === "note_added") return FileEdit;
                          if (action === "update") return FileEdit;
                          return Clock;
                        };
                        
                        const Icon = getActionIcon(log.action);
                        
                        return (
                          <div key={log.id} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
                            <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{getActionLabel(log.action)}</p>
                              {(log.action === "pipeline_move" || log.action === "stage_changed") && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">{details.fromStageName || (details.fromStageId ? getStageName(details.fromStageId) : "—")}</Badge>
                                  <ArrowRight className="h-2.5 w-2.5" />
                                  <Badge className="text-[10px] px-1 py-0 bg-cyan-600 text-white">{details.toStageName || (details.toStageId ? getStageName(details.toStageId) : "—")}</Badge>
                                </div>
                              )}
                              {log.action === "campaign_joined" && details.campaignName && (
                                <p className="text-muted-foreground">{details.campaignName}</p>
                              )}
                              <p className="text-muted-foreground">{format(new Date(log.createdAt), "dd.MM.yyyy HH:mm")}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={(open) => { if (!open) { setShowImportDialog(false); setImportFile(null); setImportResult(null); setUpdateExisting(false); setImportContactType("customer"); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.campaigns.detail.importContacts}</DialogTitle>
            <DialogDescription>
              Importovať kontakty z CSV/Excel súboru
            </DialogDescription>
          </DialogHeader>

          {importResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">{t.campaigns.detail.importCompleted}</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Vytvorených: {importResult.created} kontaktov
                    {(importResult.updated || 0) > 0 && `, aktualizovaných: ${importResult.updated}`}
                    {(importResult.duplicates || 0) > 0 && `, duplikátov: ${importResult.duplicates}`}
                    {importResult.skipped > 0 && `, preskočených: ${importResult.skipped}`}
                  </p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Chyby ({importResult.errors.length})
                  </p>
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{err}</p>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              <div className="flex justify-between gap-2 flex-wrap">
                {importResult.importedContactIds && importResult.importedContactIds.length > 0 && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (importResult.importedContactIds) {
                        deleteImportMutation.mutate(importResult.importedContactIds);
                      }
                    }}
                    disabled={deleteImportMutation.isPending}
                    data-testid="button-delete-last-import"
                  >
                    {deleteImportMutation.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{t.campaigns.detail.deleting}</>
                    ) : (
                      <><Trash2 className="w-4 h-4 mr-2" />{t.campaigns.detail.deleteLastImport} ({importResult.importedContactIds.length})</>
                    )}
                  </Button>
                )}
                <Button onClick={() => { setShowImportDialog(false); setImportFile(null); setImportResult(null); }} data-testid="button-close-import">
                  {t.campaigns.detail.close}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Typ kontaktu</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { value: "customer" as const, label: "Zákazník", icon: User },
                    { value: "clinic" as const, label: "Ambulancia", icon: Building2 },
                    { value: "hospital" as const, label: "Nemocnica", icon: Building2 },
                    { value: "collaborator" as const, label: "Spoluprac.", icon: Users },
                  ]).map((ct) => (
                    <button
                      key={ct.value}
                      type="button"
                      onClick={() => setImportContactType(ct.value)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-md border text-center transition-all ${
                        importContactType === ct.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                      data-testid={`button-import-type-${ct.value}`}
                    >
                      <ct.icon className={`w-4 h-4 ${importContactType === ct.value ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-[11px] font-medium leading-tight">{ct.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={`relative border-2 border-dashed rounded-md p-4 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) setImportFile(file);
                }}
                data-testid="dropzone-import"
              >
                {importFile ? (
                  <div className="flex items-center gap-3 justify-center">
                    <FileUp className="h-5 w-5 text-primary shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-medium truncate max-w-[200px]">{importFile.name}</p>
                      <p className="text-[11px] text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs h-7 shrink-0" onClick={() => setImportFile(null)} data-testid="button-remove-file">
                      {t.campaigns.detail.remove}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm font-medium">{t.campaigns.detail.dragFileHere}</p>
                    <p className="text-[11px] text-muted-foreground">{t.campaigns.detail.orClickToSelect}</p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setImportFile(file);
                      }}
                      data-testid="input-import-file"
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 gap-1.5"
                  onClick={() => {
                    window.open(`/api/campaigns/contacts/import-template?type=${importContactType}`, "_blank");
                  }}
                  data-testid="button-download-template"
                >
                  <Download className="w-3.5 h-3.5" />
                  Vzorový CSV ({importContactType === "customer" ? "Zákazník" : importContactType === "clinic" ? "Ambulancia" : importContactType === "hospital" ? "Nemocnica" : "Spoluprac."})
                </Button>
              </div>

              <details className="group">
                <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                  {t.campaigns.detail.expectedColumns}
                </summary>
                <div className="mt-2 p-2 bg-muted/50 rounded-md">
                  <div className="flex flex-wrap gap-1">
                    {(importContactType === "customer" ? [
                      "meno", "priezvisko", "telefon", "telefon_2", "email", "krajina", "datum_ocakavaneho_porodu", "extra_pole_1", "extra_pole_2"
                    ] : importContactType === "clinic" ? [
                      "nazov", "lekar_meno", "lekar_priezvisko", "lekar_titul", "adresa", "mesto", "psc", "krajina", "telefon", "email", "web", "poznamka"
                    ] : importContactType === "hospital" ? [
                      "nazov", "plny_nazov", "ulica_cislo", "mesto", "psc", "krajina", "kontaktna_osoba", "telefon", "email"
                    ] : [
                      "meno", "priezvisko", "titul_pred", "titul_za", "telefon", "mobil", "email", "krajina", "typ_spoluprace", "poznamka"
                    ]).map(col => (
                      <span key={col} className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border">{col}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    <strong>krajina</strong> (SK, CZ, HU, RO, IT, DE, US) · <strong>formát</strong>: CSV (;) / Excel (.xlsx)
                  </p>
                </div>
              </details>

              <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-update-existing">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="rounded border-muted-foreground/50"
                />
                <span className="text-sm">{t.campaigns.detail.updateExisting}</span>
              </label>

              {importPhase && (
                <div className="space-y-2" data-testid="import-progress">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{importPhase === "upload" ? t.campaigns.detail.uploadingFile : t.campaigns.detail.processingContacts}</span>
                    <span>{importPhase === "upload" ? `${importProgress}%` : ""}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    {importPhase === "upload" ? (
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      />
                    ) : (
                      <div className="h-full rounded-full bg-primary animate-pulse w-full" />
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={importContactsMutation.isPending} data-testid="button-cancel-import">
                  {t.campaigns.detail.cancel}
                </Button>
                <Button
                  onClick={() => { if (importFile) importContactsMutation.mutate(importFile); }}
                  disabled={!importFile || importContactsMutation.isPending}
                  data-testid="button-start-import"
                >
                  {importContactsMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      {t.campaigns.detail.importing}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {t.campaigns.detail.import}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SortRulesDialog campaign={campaign} open={showSortRulesDialog} onOpenChange={setShowSortRulesDialog} contacts={contacts} />

      <Dialog open={showRequeueDialog} onOpenChange={(open) => { setShowRequeueDialog(open); if (!open) setRequeuePage(0); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              {t.campaigns.detail.requeueTitle}
            </DialogTitle>
            <DialogDescription>
              {t.campaigns.detail.requeueDesc}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: "calc(90vh - 200px)" }}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 p-4 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-amber-500" />
                    <label className="text-sm font-semibold">{t.campaigns.detail.requeueByStatus}</label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "contacted", label: t.campaigns.contactStatuses.contacted },
                      { value: "completed", label: t.campaigns.contactStatuses.completed },
                      { value: "failed", label: t.campaigns.contactStatuses.failed },
                      { value: "no_answer", label: t.campaigns.contactStatuses.no_answer },
                      { value: "callback_scheduled", label: t.campaigns.contactStatuses.callback_scheduled },
                      { value: "not_interested", label: t.campaigns.contactStatuses.not_interested },
                    ].map(s => (
                      <Badge
                        key={s.value}
                        variant={requeueStatuses.has(s.value) ? "default" : "outline"}
                        className={`cursor-pointer select-none ${requeueStatuses.has(s.value) ? "bg-amber-500 text-white dark:bg-amber-600" : ""}`}
                        onClick={() => {
                          setRequeueStatuses(prev => {
                            const next = new Set(prev);
                            next.has(s.value) ? next.delete(s.value) : next.add(s.value);
                            return next;
                          });
                          setRequeuePage(0);
                        }}
                        data-testid={`requeue-status-${s.value}`}
                      >
                        {requeueStatuses.has(s.value) && <CheckCircle className="w-3 h-3 mr-1" />}
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.campaigns.detail.requeueEmptyStatus}</p>
                </div>

                <div className="space-y-3 p-4 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    <label className="text-sm font-semibold">{t.campaigns.detail.requeueByCallback}</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t.campaigns.detail.from}</label>
                      <Input
                        type="date"
                        value={requeueCallbackFrom}
                        onChange={(e) => { setRequeueCallbackFrom(e.target.value); setRequeuePage(0); }}
                        data-testid="requeue-callback-from"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t.campaigns.detail.to}</label>
                      <Input
                        type="date"
                        value={requeueCallbackTo}
                        onChange={(e) => { setRequeueCallbackTo(e.target.value); setRequeuePage(0); }}
                        data-testid="requeue-callback-to"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-amber-500" />
                  <label className="text-sm font-semibold">{t.campaigns.detail.requeueByDisposition}</label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {campaignDispositions.filter(d => !d.parentId).map(d => {
                    const colorMap: Record<string, string> = {
                      green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-700",
                      blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-700",
                      orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-700",
                      red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",
                      yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
                      gray: "",
                    };
                    const children = campaignDispositions.filter(ch => ch.parentId === d.id);
                    const allCodes = [d.code, ...children.map(ch => ch.code)];
                    const isSelected = allCodes.some(code => requeueDispositions.has(code));
                    return (
                      <Badge
                        key={d.id}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer select-none ${isSelected ? "bg-amber-500 text-white dark:bg-amber-600 border-amber-600" : colorMap[d.color || "gray"] || ""}`}
                        onClick={() => {
                          setRequeueDispositions(prev => {
                            const next = new Set(prev);
                            if (isSelected) {
                              allCodes.forEach(code => next.delete(code));
                            } else {
                              allCodes.forEach(code => next.add(code));
                            }
                            return next;
                          });
                          setRequeuePage(0);
                        }}
                        data-testid={`requeue-disp-${d.code}`}
                      >
                        {isSelected && <CheckCircle className="w-3 h-3 mr-1 shrink-0" />}
                        {getDispName(d.code, d.name)}
                        {children.length > 0 && <span className="opacity-60 ml-1">+{children.length}</span>}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{t.campaigns.detail.requeueEmptyDisp}</p>
              </div>

              <div className="rounded-lg border">
                <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{t.campaigns.detail.requeueMatchingContacts}</span>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {requeueMatchingContacts.length}
                    </Badge>
                  </div>
                  {requeueMatchingContacts.length > REQUEUE_PAGE_SIZE && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={requeuePage === 0}
                        onClick={() => setRequeuePage(p => Math.max(0, p - 1))}
                        data-testid="requeue-prev-page"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground px-2">
                        {requeuePage + 1} / {Math.ceil(requeueMatchingContacts.length / REQUEUE_PAGE_SIZE)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(requeuePage + 1) * REQUEUE_PAGE_SIZE >= requeueMatchingContacts.length}
                        onClick={() => setRequeuePage(p => p + 1)}
                        data-testid="requeue-next-page"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {requeueMatchingContacts.length > 0 ? (
                  <div className="divide-y max-h-[200px] overflow-y-auto">
                    {requeueMatchingContacts
                      .slice(requeuePage * REQUEUE_PAGE_SIZE, (requeuePage + 1) * REQUEUE_PAGE_SIZE)
                      .map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="font-medium">
                            {c.customer?.firstName} {c.customer?.lastName}
                          </span>
                          <div className="flex items-center gap-2">
                            {c.dispositionCode && (
                              <Badge variant="outline" className="text-xs">
                                {getDispName(c.dispositionCode, dispositionMap[c.dispositionCode]?.name || c.dispositionCode)}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {(t.campaigns.contactStatuses as Record<string, string>)[c.status] || c.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {t.campaigns.detail.noDataAvailable}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <Separator />
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {t.campaigns.detail.requeueStatusReset}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRequeueDialog(false)} data-testid="button-requeue-cancel">
                {t.campaigns.detail.cancel}
              </Button>
              <Button
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-600 dark:from-amber-600 dark:to-orange-600"
                disabled={requeueMatchingContacts.length === 0 || requeueMutation.isPending}
                onClick={() => {
                  requeueMutation.mutate(requeueMatchingContacts.map((c: any) => c.id));
                }}
                data-testid="button-requeue-confirm"
              >
                {requeueMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t.campaigns.detail.requeueProcessing}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t.campaigns.detail.requeueConfirm} ({requeueMatchingContacts.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Generovať kontakty
            </DialogTitle>
            <DialogDescription>
              Vyberte zdroje kontaktov a nastavte pokročilé filtre s kombinovaním podmienok (AND/OR).
            </DialogDescription>
          </DialogHeader>

          <ContactCriteriaBuilder
            config={generateConfig}
            onChange={setGenerateConfig}
            previewCounts={previewCounts}
            previewLoading={previewLoading}
          />

          {!generateConfig.customer.enabled && !generateConfig.hospital.enabled && !generateConfig.clinic.enabled && (
            <p className="text-sm text-muted-foreground text-center py-2">Vyberte aspoň jeden zdroj kontaktov.</p>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Zrušiť</Button>
            <Button
              onClick={() => generateContactsMutation.mutate()}
              disabled={generateContactsMutation.isPending || (!generateConfig.customer.enabled && !generateConfig.hospital.enabled && !generateConfig.clinic.enabled) || (previewCounts?.total === 0)}
              data-testid="btn-confirm-generate"
            >
              {generateContactsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generovať{previewCounts && !previewLoading ? ` (${previewCounts.total})` : ""} kontaktov
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function MailchimpSyncSection({ campaignId, campaignName, countryCodes }: { campaignId: string; campaignName: string; countryCodes: string[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const mc = t.campaigns.mailchimp;
  const [selectedListId, setSelectedListId] = useState("");
  const [subject, setSubject] = useState(campaignName);
  const [emailHtml, setEmailHtml] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [mcSubTab, setMcSubTab] = useState<"editor" | "sync" | "stats" | "summary">("summary");
  const [showNewAudience, setShowNewAudience] = useState(false);
  const [newAudienceName, setNewAudienceName] = useState("");
  const [newAudienceFromEmail, setNewAudienceFromEmail] = useState("");
  const [newAudienceFromName, setNewAudienceFromName] = useState("");
  const [testFname, setTestFname] = useState("");
  const [testLname, setTestLname] = useState("");
  const [testCompany, setTestCompany] = useState("");
  const [testSendMethod, setTestSendMethod] = useState<"ms365" | "mailchimp">("ms365");
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [showNewSegment, setShowNewSegment] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState({ subscribe: true, unsubscribe: true, campaign: true, cleaned: true });
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<"email" | "display" | "">("");
  const [displayedCode, setDisplayedCode] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [showSettingsEdit, setShowSettingsEdit] = useState(false);
  const [editFromName, setEditFromName] = useState("");
  const [editReplyTo, setEditReplyTo] = useState("");
  const [editSubjectLine, setEditSubjectLine] = useState("");
  const [mcDetailTab, setMcDetailTab] = useState<"clicks" | "opens" | "bounces" | "unsubs" | "domains" | "sent">("clicks");

  const { data: syncInfo, isLoading: syncLoading } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "mailchimp", "sync"],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/mailchimp/sync`);
      return res.json();
    },
  });

  const { data: audiences = [] } = useQuery<any[]>({
    queryKey: ["/api/config/mailchimp-settings", countryCodes[0] || "SK", "audiences"],
    enabled: !syncInfo?.mailchimpCampaignId,
    queryFn: async () => {
      const res = await fetch(`/api/config/mailchimp-settings/${countryCodes[0] || "SK"}/audiences`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const countryCode = countryCodes[0] || "SK";

  const { data: listTags = [] } = useQuery<any[]>({
    queryKey: ["/api/config/mailchimp-settings", countryCode, "audiences", selectedListId, "tags"],
    enabled: !!selectedListId && !syncInfo?.mailchimpCampaignId,
    queryFn: async () => {
      const res = await fetch(`/api/config/mailchimp-settings/${countryCode}/audiences/${selectedListId}/tags`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: listSegments = [] } = useQuery<any[]>({
    queryKey: ["/api/config/mailchimp-settings", countryCode, "audiences", selectedListId, "segments"],
    enabled: !!selectedListId && !syncInfo?.mailchimpCampaignId,
    queryFn: async () => {
      const res = await fetch(`/api/config/mailchimp-settings/${countryCode}/audiences/${selectedListId}/segments`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: listWebhooks = [] } = useQuery<any[]>({
    queryKey: ["/api/config/mailchimp-settings", countryCode, "audiences", selectedListId, "webhooks"],
    enabled: !!selectedListId && !syncInfo?.mailchimpCampaignId,
    queryFn: async () => {
      const res = await fetch(`/api/config/mailchimp-settings/${countryCode}/audiences/${selectedListId}/webhooks`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: campaignStats } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "stats"],
  });
  const totalCampaignContacts = campaignStats?.totalContacts || 0;

  const { data: emailTemplates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/message-templates"],
  });

  const htmlTemplates = emailTemplates.filter(t => t.type === "email");

  const quillRef = useRef<any>(null);

  const mergeVars = [
    { tag: "*|FNAME|*", label: "Meno", icon: "👤" },
    { tag: "*|LNAME|*", label: "Priezvisko", icon: "👤" },
    { tag: "*|EMAIL|*", label: "Email", icon: "✉️" },
    { tag: "*|PHONE|*", label: "Telefón", icon: "📞" },
    { tag: "*|COMPANY|*", label: "Firma", icon: "🏢" },
    { tag: "*|CITY|*", label: "Mesto", icon: "📍" },
    { tag: "*|ADDRESS|*", label: "Adresa", icon: "🏠" },
  ];

  const insertMergeVar = (tag: string) => {
    const editor = quillRef.current?.getEditor?.();
    if (editor) {
      const range = editor.getSelection(true);
      editor.insertText(range.index, tag);
      editor.setSelection(range.index + tag.length);
    } else {
      setEmailHtml(prev => prev + tag);
    }
    setContentSaved(false);
  };

  const { data: mcContent } = useQuery<{ html: string; plainText: string }>({
    queryKey: ["/api/campaigns", campaignId, "mailchimp", "content"],
    enabled: !!syncInfo?.mailchimpCampaignId,
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/mailchimp/content`);
      if (!res.ok) return { html: "", plainText: "" };
      return res.json();
    },
  });

  useEffect(() => {
    if (mcContent?.html && !emailHtml) {
      setEmailHtml(mcContent.html);
      setContentSaved(true);
    }
  }, [mcContent]);

  const createAudienceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/config/mailchimp-settings/${countryCodes[0] || "SK"}/audiences`, {
        name: newAudienceName,
        fromEmail: newAudienceFromEmail,
        fromName: newAudienceFromName,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/mailchimp-settings", countryCodes[0] || "SK", "audiences"] });
      setSelectedListId(data.id);
      setShowNewAudience(false);
      setNewAudienceName("");
      setNewAudienceFromEmail("");
      setNewAudienceFromName("");
      toast({ title: "Audience vytvorená", description: `${data.name} bola vytvorená v Mailchimp.` });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/config/mailchimp-settings/${countryCode}/audiences/${selectedListId}/tags`, { name: newTagName });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/mailchimp-settings", countryCode, "audiences", selectedListId, "tags"] });
      setNewTagName("");
      setShowNewTag(false);
      toast({ title: mc.tagCreated, description: data.name });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const createSegmentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/config/mailchimp-settings/${countryCode}/audiences/${selectedListId}/segments`, { name: newSegmentName });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/mailchimp-settings", countryCode, "audiences", selectedListId, "segments"] });
      setNewSegmentName("");
      setShowNewSegment(false);
      toast({ title: mc.segmentCreated, description: data.name });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = { listId: selectedListId, subject };
      if (selectedSegmentId && selectedSegmentId !== "all") body.segmentId = selectedSegmentId;
      if (selectedTags.length > 0) body.tags = selectedTags;
      if (webhookEnabled) {
        if (webhookUrl) body.webhookUrl = webhookUrl;
        body.webhookEvents = webhookEvents;
      }
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/mailchimp/create`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "mailchimp", "sync"] });
      toast({ title: "Mailchimp kampaň vytvorená" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/mailchimp/sync-contacts`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "mailchimp", "sync"] });
      toast({ title: "Kontakty synchronizované", description: `Pridané: ${data.added}, Aktualizované: ${data.updated}` });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const saveContentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/campaigns/${campaignId}/mailchimp/content`, {
        html: emailHtml,
        subject,
      });
      return res.json();
    },
    onSuccess: () => {
      setContentSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "mailchimp", "sync"] });
      toast({ title: "Obsah uložený do Mailchimp" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const testMergeFields: Record<string, string> = {};
      if (testFname) testMergeFields.FNAME = testFname;
      if (testLname) testMergeFields.LNAME = testLname;
      if (testCompany) testMergeFields.COMPANY = testCompany;
      await apiRequest("POST", `/api/campaigns/${campaignId}/mailchimp/test-email`, {
        testEmails: [testEmail],
        testMergeFields: Object.keys(testMergeFields).length > 0 ? testMergeFields : undefined,
        sendMethod: testSendMethod,
      });
    },
    onSuccess: () => {
      toast({ title: "Testovací email odoslaný", description: `Na adresu: ${testEmail}` });
      setShowTestEmail(false);
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const requestVerificationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/mailchimp/send-verification`);
      return res.json();
    },
    onSuccess: (data: any) => {
      setVerificationSent(true);
      setVerificationMethod(data.method);
      if (data.method === "email") {
        setVerificationEmail(data.email);
      } else if (data.method === "display") {
        setDisplayedCode(data.code);
      }
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const sendCampaignMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/campaigns/${campaignId}/mailchimp/send`, { verificationCode });
    },
    onSuccess: () => {
      setShowSendConfirm(false);
      setVerificationSent(false);
      setVerificationCode("");
      setDisplayedCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "mailchimp", "sync"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "mailchimp", "stats"] });
      toast({ title: "Kampaň odoslaná!", description: "Mailchimp kampaň bola úspešne odoslaná." });
    },
    onError: (err: any) => {
      toast({ title: "Chyba pri odosielaní", description: err.message, variant: "destructive" });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/campaigns/${campaignId}/mailchimp/schedule`, { scheduleTime: scheduleDate });
    },
    onSuccess: () => {
      setShowScheduleDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "mailchimp", "sync"] });
      toast({ title: "Kampaň naplánovaná" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const unscheduleMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/campaigns/${campaignId}/mailchimp/unschedule`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "mailchimp", "sync"] });
      toast({ title: "Plánovanie zrušené" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const replicateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/mailchimp/replicate`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Kampaň zduplikovaná v Mailchimp" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/campaigns/${campaignId}/mailchimp/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "mailchimp", "sync"] });
      toast({ title: "Odosielanie zrušené" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const deleteMcCampaignMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/campaigns/${campaignId}/mailchimp`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "mailchimp", "sync"] });
      toast({ title: "Mailchimp kampaň vymazaná" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (editSubjectLine) body.subject_line = editSubjectLine;
      if (editFromName) body.from_name = editFromName;
      if (editReplyTo) body.reply_to = editReplyTo;
      if (previewText) body.preview_text = previewText;
      await apiRequest("PATCH", `/api/campaigns/${campaignId}/mailchimp/settings`, body);
    },
    onSuccess: () => {
      setShowSettingsEdit(false);
      toast({ title: "Nastavenia aktualizované" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const { data: mcChecklist } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "mailchimp", "checklist"],
    enabled: !!syncInfo?.mailchimpCampaignId && syncInfo?.status !== "sent",
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/mailchimp/checklist`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: mcClickDetails } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "mailchimp", "click-details"],
    enabled: !!syncInfo?.mailchimpCampaignId && syncInfo?.status === "sent" && mcDetailTab === "clicks",
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/mailchimp/click-details`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: mcOpenDetails } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "mailchimp", "open-details"],
    enabled: !!syncInfo?.mailchimpCampaignId && syncInfo?.status === "sent" && mcDetailTab === "opens",
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/mailchimp/open-details`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: mcBounceDetails } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "mailchimp", "bounce-details"],
    enabled: !!syncInfo?.mailchimpCampaignId && syncInfo?.status === "sent" && mcDetailTab === "bounces",
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/mailchimp/bounce-details`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: mcUnsubDetails } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "mailchimp", "unsubscribes"],
    enabled: !!syncInfo?.mailchimpCampaignId && syncInfo?.status === "sent" && mcDetailTab === "unsubs",
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/mailchimp/unsubscribes`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: mcDomainPerf } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "mailchimp", "domain-performance"],
    enabled: !!syncInfo?.mailchimpCampaignId && syncInfo?.status === "sent" && mcDetailTab === "domains",
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/mailchimp/domain-performance`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: mcStats } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "mailchimp", "stats"],
    enabled: !!syncInfo?.mailchimpCampaignId,
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/mailchimp/stats`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 60000,
  });

  const handleSelectTemplate = (templateId: string) => {
    const template = htmlTemplates.find(t => t.id === templateId);
    if (template) {
      setEmailHtml(template.contentHtml || template.content || "");
      if (template.subject) setSubject(template.subject);
      setContentSaved(false);
    }
  };

  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ]
  }), []);

  if (syncLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!syncInfo?.mailchimpCampaignId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {mc.createTitle}
          </CardTitle>
          <CardDescription>
            {mc.createDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{mc.emailSubject}</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder={mc.emailSubjectPlaceholder} data-testid="input-mc-subject" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{mc.audienceLabel}</Label>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowNewAudience(!showNewAudience)} data-testid="btn-toggle-new-audience">
                <Plus className="w-3.5 h-3.5 mr-1" />
                {showNewAudience ? mc.selectExisting : mc.createNew}
              </Button>
            </div>
            {!showNewAudience ? (
              audiences.length > 0 ? (
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger data-testid="select-mc-audience-campaign">
                    <SelectValue placeholder={mc.selectAudiencePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {audiences.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.memberCount} {mc.contacts})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-amber-600">
                  {mc.noAudiences}
                </p>
              )
            ) : (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="space-y-1.5">
                  <Label className="text-xs">{mc.audienceName}</Label>
                  <Input
                    value={newAudienceName}
                    onChange={e => setNewAudienceName(e.target.value)}
                    placeholder={mc.audienceNamePlaceholder}
                    data-testid="input-new-audience-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">From Email</Label>
                    <Input
                      value={newAudienceFromEmail}
                      onChange={e => setNewAudienceFromEmail(e.target.value)}
                      placeholder="info@firma.sk"
                      type="email"
                      data-testid="input-new-audience-email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">From Name</Label>
                    <Input
                      value={newAudienceFromName}
                      onChange={e => setNewAudienceFromName(e.target.value)}
                      placeholder="Firma s.r.o."
                      data-testid="input-new-audience-from-name"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => createAudienceMutation.mutate()}
                  disabled={createAudienceMutation.isPending || !newAudienceName || !newAudienceFromEmail}
                  data-testid="btn-create-audience"
                >
                  {createAudienceMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {mc.createAudience}
                </Button>
              </div>
            )}
          </div>
          {selectedListId && (
            <div className="border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs mb-2"
                onClick={() => setShowAdvanced(!showAdvanced)}
                data-testid="btn-toggle-advanced"
              >
                <Settings className="w-3.5 h-3.5 mr-1" />
                {showAdvanced ? mc.hideAdvanced : mc.advancedSettings}
                {(selectedTags.length > 0 || selectedSegmentId || webhookEnabled) && (
                  <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">
                    {[selectedTags.length > 0, !!selectedSegmentId, webhookEnabled].filter(Boolean).length}
                  </Badge>
                )}
              </Button>

              {showAdvanced && (
                <div className="space-y-4 p-3 border rounded-lg bg-muted/20">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        {mc.tagsLabel}
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setShowNewTag(!showNewTag)}
                        data-testid="btn-toggle-new-tag"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {mc.createTag}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{mc.tagsDesc}</p>
                    {showNewTag && (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newTagName}
                          onChange={e => setNewTagName(e.target.value)}
                          placeholder={mc.createTagPlaceholder}
                          className="h-7 text-xs flex-1"
                          data-testid="input-new-tag-name"
                          onKeyDown={e => { if (e.key === "Enter" && newTagName.trim()) createTagMutation.mutate(); }}
                        />
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!newTagName.trim() || createTagMutation.isPending}
                          onClick={() => createTagMutation.mutate()}
                          data-testid="btn-create-tag"
                        >
                          {createTagMutation.isPending ? "..." : mc.createTag}
                        </Button>
                      </div>
                    )}
                    {listTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {listTags.map((t: any) => (
                          <Button
                            key={t.name}
                            type="button"
                            variant={selectedTags.includes(t.name) ? "default" : "outline"}
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => {
                              setSelectedTags(prev =>
                                prev.includes(t.name) ? prev.filter(x => x !== t.name) : [...prev, t.name]
                              );
                            }}
                            data-testid={`tag-${t.name}`}
                          >
                            {t.name}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">{mc.noTags}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5" />
                        {mc.segmentLabel}
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setShowNewSegment(!showNewSegment)}
                        data-testid="btn-toggle-new-segment"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {mc.createSegment}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{mc.segmentDesc}</p>
                    {showNewSegment && (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newSegmentName}
                          onChange={e => setNewSegmentName(e.target.value)}
                          placeholder={mc.createSegmentPlaceholder}
                          className="h-7 text-xs flex-1"
                          data-testid="input-new-segment-name"
                          onKeyDown={e => { if (e.key === "Enter" && newSegmentName.trim()) createSegmentMutation.mutate(); }}
                        />
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!newSegmentName.trim() || createSegmentMutation.isPending}
                          onClick={() => createSegmentMutation.mutate()}
                          data-testid="btn-create-segment"
                        >
                          {createSegmentMutation.isPending ? "..." : mc.createSegment}
                        </Button>
                      </div>
                    )}
                    <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
                      <SelectTrigger className="h-8" data-testid="select-mc-segment">
                        <SelectValue placeholder={mc.allContactsNoSegment} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{mc.allContacts}</SelectItem>
                        {listSegments.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} ({s.memberCount} {mc.contacts}) — {s.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      {mc.webhookLabel}
                    </Label>
                    <p className="text-xs text-muted-foreground">{mc.webhookDesc}</p>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer" data-testid="toggle-mc-webhook">
                        <input
                          type="checkbox"
                          checked={webhookEnabled}
                          onChange={e => setWebhookEnabled(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">{mc.webhookAutoEnabled || "Automatický webhook"}</span>
                      </label>
                    </div>
                    {webhookEnabled && (
                      <div className="space-y-2 pl-6">
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 font-mono flex items-center gap-1.5">
                          <Globe className="w-3 h-3 flex-shrink-0" />
                          <span>{mc.webhookAutoUrl || "URL sa vytvorí automaticky"}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(webhookEvents).map(([key, checked]) => (
                            <label key={key} className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => setWebhookEvents(prev => ({ ...prev, [key]: e.target.checked }))}
                                className="w-3 h-3"
                              />
                              {key}
                            </label>
                          ))}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{mc.webhookCustomUrl || "Vlastná URL (voliteľné)"}</Label>
                          <Input
                            value={webhookUrl}
                            onChange={e => setWebhookUrl(e.target.value)}
                            placeholder={mc.webhookPlaceholder}
                            className="h-7 text-xs"
                            data-testid="input-mc-webhook-url"
                          />
                        </div>
                      </div>
                    )}
                    {listWebhooks.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">{mc.existingWebhooks}</p>
                        {listWebhooks.map((w: any) => (
                          <div key={w.id} className="text-xs bg-muted/50 rounded px-2 py-1 mb-1 flex items-center justify-between">
                            <span className="truncate">{w.url}</span>
                            <span className="text-muted-foreground ml-2 flex-shrink-0">
                              {Object.entries(w.events || {}).filter(([_, v]) => v).map(([k]) => k).join(", ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !selectedListId}
            data-testid="btn-create-mc-campaign"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mc.createInMailchimp}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isSent = syncInfo.status === "sent";
  const statusLabels: Record<string, string> = {
    created: mc.statusCreated,
    synced: mc.statusSynced,
    content_set: mc.statusContentSet,
    sent: mc.statusSent,
    scheduled: mc.statusScheduled,
    paused: mc.statusPaused,
    cancelled: mc.statusCancelled,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">{mc.campaignTitle}</h3>
            <p className="text-xs text-muted-foreground">{mc.campaignId}: {syncInfo.mailchimpCampaignId}</p>
          </div>
          <Badge variant={isSent ? "default" : "secondary"} data-testid="badge-mc-sync-status">
            {statusLabels[syncInfo.status] || syncInfo.status}
          </Badge>
        </div>
      </div>

      <Tabs value={mcSubTab} onValueChange={(v) => setMcSubTab(v as any)}>
        <TabsList>
          <TabsTrigger value="summary" data-testid="mc-tab-summary">
            <FileText className="w-4 h-4 mr-2" />
            {mc.summaryTab}
          </TabsTrigger>
          <TabsTrigger value="editor" data-testid="mc-tab-editor">
            <FileText className="w-4 h-4 mr-2" />
            {mc.editorTab}
          </TabsTrigger>
          <TabsTrigger value="sync" data-testid="mc-tab-sync">
            <Users className="w-4 h-4 mr-2" />
            {mc.contactsSendTab}
          </TabsTrigger>
          <TabsTrigger value="stats" data-testid="mc-tab-stats">
            <BarChart3 className="w-4 h-4 mr-2" />
            {mc.statsTab}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-5 h-5" />
                {mc.summaryTitle}
              </CardTitle>
              <CardDescription>{mc.summaryDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.summaryName}</span>
                    <span className="text-sm font-medium text-right">{campaignName}</span>
                  </div>
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.summaryMailchimpId}</span>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{syncInfo.mailchimpCampaignId}</span>
                  </div>
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.summaryStatus}</span>
                    <Badge variant={isSent ? "default" : "secondary"}>{statusLabels[syncInfo.status] || syncInfo.status}</Badge>
                  </div>
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.summarySubject}</span>
                    <span className="text-sm font-medium text-right max-w-[60%] truncate">{subject || "—"}</span>
                  </div>
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.summarySyncedContacts}</span>
                    <span className="text-sm font-bold">{syncInfo.syncedContacts || 0}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.summaryAudience}</span>
                    <span className="text-sm font-medium">{syncInfo.mailchimpListId ? syncInfo.mailchimpListId.substring(0, 10) + "..." : "—"}</span>
                  </div>
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.webhookLabel}</span>
                    <div className="flex items-center gap-1.5">
                      {syncInfo.webhookRegistered ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-xs text-green-600 font-medium">{mc.webhookActive || "Aktívny"}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{mc.webhookInactive || "Neaktívny"}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.summaryLastSync}</span>
                    <span className="text-sm">{syncInfo.lastSyncAt ? new Date(syncInfo.lastSyncAt).toLocaleString("sk") : "—"}</span>
                  </div>
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.summaryCreatedAt}</span>
                    <span className="text-sm">{syncInfo.createdAt ? new Date(syncInfo.createdAt).toLocaleString("sk") : "—"}</span>
                  </div>
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.summaryTags}</span>
                    <span className="text-sm">{syncInfo.tags?.length > 0 ? syncInfo.tags.join(", ") : mc.summaryNoTags}</span>
                  </div>
                  <div className="flex justify-between items-start border-b pb-2">
                    <span className="text-sm text-muted-foreground">{mc.summarySegment}</span>
                    <span className="text-sm">{syncInfo.segmentName || mc.summaryNoSegment}</span>
                  </div>
                </div>
              </div>
              {mcStats?.stats && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-2">{mc.statsTitle}</p>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{mcStats.stats.emailsSent}</p>
                      <p className="text-[10px] text-muted-foreground">{mc.emailsSent}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{mcStats.stats.uniqueOpens}</p>
                      <p className="text-[10px] text-muted-foreground">{mc.opened}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{mcStats.stats.uniqueClicks}</p>
                      <p className="text-[10px] text-muted-foreground">{mc.clicks}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{mcStats.stats.bounces}</p>
                      <p className="text-[10px] text-muted-foreground">{mc.bounces}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{mcStats.stats.unsubscribes}</p>
                      <p className="text-[10px] text-muted-foreground">{mc.unsubscribed}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          {syncInfo.webhookRegistered && syncInfo.webhookUrl && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900" data-testid="webhook-status-banner">
              <Globe className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-green-700 dark:text-green-400">{mc.webhookActive || "Webhook aktívny"}</p>
                <p className="text-[11px] text-green-600 dark:text-green-500 font-mono truncate">{syncInfo.webhookUrl}</p>
              </div>
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            </div>
          )}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{mc.emailSubject}</Label>
                  <Input
                    value={subject}
                    onChange={e => { setSubject(e.target.value); setContentSaved(false); }}
                    placeholder="Predmet emailovej kampane"
                    disabled={isSent}
                    data-testid="input-mc-subject-editor"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{mc.template}</Label>
                  <Select onValueChange={handleSelectTemplate} disabled={isSent || htmlTemplates.length === 0}>
                    <SelectTrigger data-testid="select-mc-template">
                      <SelectValue placeholder={htmlTemplates.length === 0 ? mc.noTemplates : mc.selectTemplate} />
                    </SelectTrigger>
                    <SelectContent>
                      {htmlTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{mc.emailContent}</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">{mc.insertVariable}</span>
                    {mergeVars.map(mv => (
                      <Button
                        key={mv.tag}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs font-mono"
                        onClick={() => insertMergeVar(mv.tag)}
                        title={`${mv.label} — ${mv.tag}`}
                        data-testid={`btn-merge-${mv.tag.replace(/\*\|/g, "").replace(/\|/g, "").toLowerCase()}`}
                      >
                        {mv.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="border rounded-md" data-testid="mc-email-editor">
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={emailHtml}
                    onChange={(val) => { setEmailHtml(val); setContentSaved(false); }}
                    modules={quillModules}
                    readOnly={isSent}
                    style={{ minHeight: '300px' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Použite premenné ako <code className="bg-muted px-1 rounded">*|FNAME|*</code>, <code className="bg-muted px-1 rounded">*|LNAME|*</code>, <code className="bg-muted px-1 rounded">*|COMPANY|*</code> pre personalizáciu. Mailchimp ich nahradí údajmi kontaktu.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {contentSaved && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {mc.contentSaved}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTestEmail(!showTestEmail)}
                    disabled={!emailHtml || isSent}
                    data-testid="btn-mc-toggle-test"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {mc.testEmail}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveContentMutation.mutate()}
                    disabled={saveContentMutation.isPending || !emailHtml || isSent || contentSaved}
                    data-testid="btn-mc-save-content"
                  >
                    {saveContentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {mc.saveToMailchimp}
                  </Button>
                </div>
              </div>

              {showTestEmail && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center gap-4">
                    <p className="text-xs font-medium text-muted-foreground">{mc.sendMethod}</p>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="testSendMethod"
                          checked={testSendMethod === "ms365"}
                          onChange={() => setTestSendMethod("ms365")}
                          className="w-3.5 h-3.5"
                          data-testid="radio-test-ms365"
                        />
                        <span className="text-xs font-medium">{mc.ms365Method}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="testSendMethod"
                          checked={testSendMethod === "mailchimp"}
                          onChange={() => setTestSendMethod("mailchimp")}
                          className="w-3.5 h-3.5"
                          data-testid="radio-test-mailchimp"
                        />
                        <span className="text-xs font-medium">{mc.mailchimpMethod}</span>
                      </label>
                    </div>
                  </div>
                  {testSendMethod === "ms365" && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Email sa odošle cez váš MS365 účet s nahradenými premennými. Uvidíte skutočné údaje namiesto placeholderov.
                    </p>
                  )}
                  {testSendMethod === "mailchimp" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Mailchimp testovací email zobrazí premenné ako &lt;&lt; Test First Name &gt;&gt; namiesto reálnych údajov.
                    </p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Email *</Label>
                      <Input
                        value={testEmail}
                        onChange={e => setTestEmail(e.target.value)}
                        placeholder="test@example.com"
                        type="email"
                        data-testid="input-mc-test-email"
                      />
                    </div>
                    {testSendMethod === "ms365" && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Meno (FNAME)</Label>
                          <Input
                            value={testFname}
                            onChange={e => setTestFname(e.target.value)}
                            placeholder="Ján"
                            data-testid="input-mc-test-fname"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Priezvisko (LNAME)</Label>
                          <Input
                            value={testLname}
                            onChange={e => setTestLname(e.target.value)}
                            placeholder="Novák"
                            data-testid="input-mc-test-lname"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Firma (COMPANY)</Label>
                          <Input
                            value={testCompany}
                            onChange={e => setTestCompany(e.target.value)}
                            placeholder="Firma s.r.o."
                            data-testid="input-mc-test-company"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => testEmailMutation.mutate()}
                      disabled={testEmailMutation.isPending || !testEmail || !contentSaved}
                      data-testid="btn-mc-send-test"
                    >
                      {testEmailMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Odoslať test ({testSendMethod === "ms365" ? "MS365" : "Mailchimp"})
                    </Button>
                  </div>
                </div>
              )}
              {showTestEmail && !contentSaved && (
                <p className="text-xs text-amber-600">
                  Najprv uložte obsah do Mailchimp, aby bol testovací email aktuálny.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import kontaktov z kampane</CardTitle>
              <CardDescription>
                Importujte kontakty vygenerované v záložke "Contacts" do Mailchimp audience.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{totalCampaignContacts}</p>
                  <p className="text-xs text-muted-foreground">Kontaktov v kampani</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{syncInfo.syncedContacts || 0}</p>
                  <p className="text-xs text-muted-foreground">Synchronizované</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{syncInfo.lastSyncAt ? new Date(syncInfo.lastSyncAt).toLocaleDateString("sk") : "—"}</p>
                  <p className="text-xs text-muted-foreground">Posledná sync.</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{syncInfo.status === "synced" ? "✓" : "○"}</p>
                  <p className="text-xs text-muted-foreground">Stav</p>
                </div>
              </div>

              {totalCampaignContacts === 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Nemáte žiadne kontakty v kampani. Prejdite na záložku "Contacts" a vygenerujte alebo importujte kontakty.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => syncContactsMutation.mutate()}
                  disabled={syncContactsMutation.isPending || totalCampaignContacts === 0}
                  data-testid="btn-sync-mc-contacts"
                >
                  {syncContactsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {syncInfo.syncedContacts > 0 ? "Aktualizovať kontakty" : "Importovať kontakty"} ({totalCampaignContacts})
                </Button>
                {syncInfo.syncedContacts > 0 && totalCampaignContacts > syncInfo.syncedContacts && (
                  <span className="text-xs text-amber-600">
                    +{totalCampaignContacts - syncInfo.syncedContacts} nových kontaktov od poslednej synchronizácie
                  </span>
                )}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-400 font-medium mb-1">Synchronizované údaje kontaktov:</p>
                <div className="flex flex-wrap gap-2">
                  {["FNAME (Meno)", "LNAME (Priezvisko)", "EMAIL", "PHONE (Telefón)", "COMPANY (Firma)", "CITY (Mesto)", "ADDRESS (Adresa)"].map(f => (
                    <span key={f} className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-mono">{f}</span>
                  ))}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                  Tieto premenné môžete použiť v emailovom editore pre personalizáciu.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Odoslanie kampane</CardTitle>
              <CardDescription>
                {isSent
                  ? "Kampaň bola úspešne odoslaná."
                  : "Po uložení obsahu a synchronizácii kontaktov môžete kampaň odoslať."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSent ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Kampaň bola odoslaná</span>
                  {syncInfo.lastSyncAt && (
                    <span className="text-sm text-muted-foreground ml-2">
                      ({new Date(syncInfo.lastSyncAt).toLocaleString("sk")})
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {(!contentSaved || syncInfo.status === "created") && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        {!contentSaved && <p>Uložte obsah emailu do Mailchimp pred odoslaním.</p>}
                        {syncInfo.status === "created" && <p>Synchronizujte kontakty pred odoslaním kampane.</p>}
                      </div>
                    </div>
                  )}

                  {mcChecklist && (
                    <div className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle className={`w-4 h-4 ${mcChecklist.isReady ? "text-green-600" : "text-amber-500"}`} />
                        Checklist ({mcChecklist.isReady ? "pripravené" : "nie je pripravené"})
                      </div>
                      {mcChecklist.items?.map((item: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs pl-6">
                          {item.type === "success" ? (
                            <CheckCircle className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-3 h-3 mt-0.5 text-amber-500 flex-shrink-0" />
                          )}
                          <div>
                            <span className="font-medium">{item.heading}</span>
                            {item.details && <p className="text-muted-foreground">{item.details}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setShowSendConfirm(true)}
                      disabled={!contentSaved || syncInfo.syncedContacts === 0 || (mcChecklist && !mcChecklist.isReady)}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="btn-mc-send-campaign"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Odoslať teraz ({syncInfo.syncedContacts || 0})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowScheduleDialog(true)}
                      disabled={!contentSaved || syncInfo.syncedContacts === 0}
                      data-testid="btn-mc-schedule"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Naplánovať
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowSettingsEdit(true)} data-testid="btn-mc-edit-settings">
                      <Settings className="w-4 h-4 mr-2" />
                      Nastavenia
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => replicateMutation.mutate()} disabled={replicateMutation.isPending} data-testid="btn-mc-replicate">
                      <Copy className="w-4 h-4 mr-2" />
                      Duplikovať
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => {
                      if (confirm("Naozaj chcete vymazať Mailchimp kampaň? Táto akcia je nevratná.")) {
                        deleteMcCampaignMutation.mutate();
                      }
                    }} data-testid="btn-mc-delete">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Vymazať
                    </Button>
                  </div>

                  {syncInfo.status === "scheduled" && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Kampaň je naplánovaná na odoslanie.</span>
                      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => unscheduleMutation.mutate()} disabled={unscheduleMutation.isPending}>
                        Zrušiť plánovanie
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={showSendConfirm} onOpenChange={(open) => {
            setShowSendConfirm(open);
            if (!open) { setVerificationSent(false); setVerificationCode(""); setDisplayedCode(""); }
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Odoslať Mailchimp kampaň?
                </DialogTitle>
                <DialogDescription className="space-y-2">
                  <p>Email bude doručený na <strong>{syncInfo.syncedContacts || 0}</strong> kontaktov.</p>
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400 mt-2">
                    <p className="font-semibold">Po odoslaní sa začne spracovanie, ktoré sa už nedá zastaviť!</p>
                    <p className="mt-1">Pre potvrdenie je potrebný overovací kód.</p>
                  </div>
                </DialogDescription>
              </DialogHeader>

              {mcChecklist && !mcChecklist.isReady && (
                <div className="space-y-1.5 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Kampaň nie je pripravená (Mailchimp Checklist)
                  </p>
                  {mcChecklist.items?.filter((i: any) => i.type === "error" || i.type === "warning").map((item: any, idx: number) => (
                    <div key={idx} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                      <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{item.heading}</span>
                        {item.details && <span className="text-amber-600 dark:text-amber-500"> — {item.details}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!verificationSent ? (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowSendConfirm(false)}>Zrušiť</Button>
                  <Button
                    onClick={() => requestVerificationMutation.mutate()}
                    disabled={requestVerificationMutation.isPending || (mcChecklist && !mcChecklist.isReady)}
                    className="bg-amber-600 hover:bg-amber-700"
                    data-testid="btn-mc-request-code"
                  >
                    {requestVerificationMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Shield className="w-4 h-4 mr-2" />
                    {mc.requestCode}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {verificationMethod === "email" && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                      <p>{mc.codeEmailSent} <strong>{verificationEmail}</strong></p>
                      <p className="text-xs text-muted-foreground mt-1">{mc.codeValidMinutes}</p>
                    </div>
                  )}
                  {verificationMethod === "display" && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm">
                      <p className="text-xs text-muted-foreground mb-2">{mc.codeEmailFailed}</p>
                      <div className="text-center py-2 bg-white dark:bg-gray-900 rounded border">
                        <span className="text-2xl font-bold tracking-[6px] text-primary">{displayedCode}</span>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{mc.verificationCode}</Label>
                    <Input
                      value={verificationCode}
                      onChange={e => setVerificationCode(e.target.value.toUpperCase())}
                      placeholder={mc.enterCode}
                      maxLength={6}
                      className="text-center text-lg tracking-widest font-mono"
                      data-testid="input-mc-verification-code"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={() => requestVerificationMutation.mutate()} disabled={requestVerificationMutation.isPending}>
                      {mc.sendNewCode}
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowSendConfirm(false)}>{mc.cancel}</Button>
                      <Button
                        onClick={() => sendCampaignMutation.mutate()}
                        disabled={sendCampaignMutation.isPending || verificationCode.length < 4}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="btn-mc-confirm-send"
                      >
                        {sendCampaignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {mc.confirmAndSend}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Naplánovať odoslanie</DialogTitle>
                <DialogDescription>
                  Vyberte dátum a čas, kedy sa má kampaň automaticky odoslať.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Dátum a čas odoslania (UTC)</Label>
                  <Input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    data-testid="input-mc-schedule-date"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Zrušiť</Button>
                <Button
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending || !scheduleDate}
                  data-testid="btn-mc-confirm-schedule"
                >
                  {scheduleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Naplánovať
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showSettingsEdit} onOpenChange={setShowSettingsEdit}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upraviť nastavenia kampane</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Predmet (Subject Line)</Label>
                  <Input value={editSubjectLine} onChange={e => setEditSubjectLine(e.target.value)} placeholder="Predmet emailu" data-testid="input-edit-subject" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Od (From Name)</Label>
                  <Input value={editFromName} onChange={e => setEditFromName(e.target.value)} placeholder="Meno odosielateľa" data-testid="input-edit-from-name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Reply-To email</Label>
                  <Input value={editReplyTo} onChange={e => setEditReplyTo(e.target.value)} placeholder="reply@firma.sk" data-testid="input-edit-reply-to" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Preview text</Label>
                  <Input value={previewText} onChange={e => setPreviewText(e.target.value)} placeholder="Text zobrazený v náhľade emailu" data-testid="input-edit-preview-text" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSettingsEdit(false)}>Zrušiť</Button>
                <Button onClick={() => updateSettingsMutation.mutate()} disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Uložiť
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {mcStats?.stats ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-5 h-5" />
                    Mailchimp štatistiky
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{mcStats.stats.emailsSent}</p>
                      <p className="text-xs text-muted-foreground">Odoslaných</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{mcStats.stats.uniqueOpens}</p>
                      <p className="text-xs text-muted-foreground">Otvorených ({(mcStats.stats.openRate * 100).toFixed(1)}%)</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{mcStats.stats.uniqueClicks}</p>
                      <p className="text-xs text-muted-foreground">Kliknutí ({(mcStats.stats.clickRate * 100).toFixed(1)}%)</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{mcStats.stats.bounces}</p>
                      <p className="text-xs text-muted-foreground">Bounce</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{mcStats.stats.unsubscribes}</p>
                      <p className="text-xs text-muted-foreground">Odhlásených</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap gap-1">
                    {(["clicks", "opens", "bounces", "unsubs", "domains"] as const).map(tab => (
                      <Button
                        key={tab}
                        variant={mcDetailTab === tab ? "default" : "ghost"}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setMcDetailTab(tab)}
                        data-testid={`btn-mc-detail-${tab}`}
                      >
                        {{ clicks: "Kliknutia", opens: "Otvorenia", bounces: "Bounce", unsubs: "Odhlásenia", domains: "Domény", sent: "Odoslané" }[tab]}
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  {mcDetailTab === "clicks" && (
                    mcClickDetails?.urlsClicked?.length > 0 ? (
                      <div className="space-y-2">
                        {mcClickDetails.urlsClicked.map((u: any) => (
                          <div key={u.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                            <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[60%]">{u.url}</a>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>{u.totalClicks} kliknutí</span>
                              <span>{u.uniqueClicks} unikátnych</span>
                              <span>{(u.clickPercentage * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">Žiadne kliknutia.</p>
                  )}

                  {mcDetailTab === "opens" && (
                    mcOpenDetails?.members?.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground mb-2">Celkovo otvorení: {mcOpenDetails.totalOpens} ({mcOpenDetails.totalItems} kontaktov)</p>
                        <div className="max-h-64 overflow-auto">
                          {mcOpenDetails.members.slice(0, 50).map((m: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-1 px-2 text-xs border-b last:border-0">
                              <span>{m.emailAddress}</span>
                              <span className="text-muted-foreground">{m.opensCount}x otvorené</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <p className="text-sm text-muted-foreground">Žiadne otvorenia.</p>
                  )}

                  {mcDetailTab === "bounces" && (
                    mcBounceDetails ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="p-2 rounded bg-red-50 dark:bg-red-950/30">
                            <p className="text-lg font-bold text-red-600">{mcBounceDetails.hardBounces}</p>
                            <p className="text-xs text-muted-foreground">Hard bounce</p>
                          </div>
                          <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30">
                            <p className="text-lg font-bold text-amber-600">{mcBounceDetails.softBounces}</p>
                            <p className="text-xs text-muted-foreground">Soft bounce</p>
                          </div>
                          <div className="p-2 rounded bg-gray-50 dark:bg-gray-950/30">
                            <p className="text-lg font-bold">{mcBounceDetails.syntaxErrors}</p>
                            <p className="text-xs text-muted-foreground">Syntax chyby</p>
                          </div>
                        </div>
                        {mcBounceDetails.members?.length > 0 && (
                          <div className="max-h-48 overflow-auto">
                            {mcBounceDetails.members.map((m: any, i: number) => (
                              <div key={i} className="flex items-center justify-between py-1 px-2 text-xs border-b last:border-0">
                                <span>{m.emailAddress}</span>
                                <Badge variant={m.type === "hard" ? "destructive" : "secondary"} className="text-[10px] h-4">{m.type}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">Žiadne bounce.</p>
                  )}

                  {mcDetailTab === "unsubs" && (
                    mcUnsubDetails?.unsubscribes?.length > 0 ? (
                      <div className="max-h-48 overflow-auto">
                        {mcUnsubDetails.unsubscribes.map((u: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-1 px-2 text-xs border-b last:border-0">
                            <span>{u.emailAddress}</span>
                            <span className="text-muted-foreground">{u.timestamp ? new Date(u.timestamp).toLocaleString("sk") : ""}</span>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground mt-2">Celkovo: {mcUnsubDetails.totalItems}</p>
                      </div>
                    ) : <p className="text-sm text-muted-foreground">Žiadne odhlásenia.</p>
                  )}

                  {mcDetailTab === "domains" && (
                    mcDomainPerf?.domains?.length > 0 ? (
                      <div className="overflow-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="py-1 px-2">Doména</th>
                              <th className="py-1 px-2 text-right">Odoslaných</th>
                              <th className="py-1 px-2 text-right">Doručených</th>
                              <th className="py-1 px-2 text-right">Otvorených</th>
                              <th className="py-1 px-2 text-right">Kliknutí</th>
                              <th className="py-1 px-2 text-right">Bounce</th>
                              <th className="py-1 px-2 text-right">Odhlásenía</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mcDomainPerf.domains.map((d: any) => (
                              <tr key={d.domain} className="border-b last:border-0">
                                <td className="py-1 px-2 font-medium">{d.domain}</td>
                                <td className="py-1 px-2 text-right">{d.emailsSent}</td>
                                <td className="py-1 px-2 text-right">{d.delivered}</td>
                                <td className="py-1 px-2 text-right">{d.opens}</td>
                                <td className="py-1 px-2 text-right">{d.clicks}</td>
                                <td className="py-1 px-2 text-right">{d.bounces}</td>
                                <td className="py-1 px-2 text-right">{d.unsubs}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="text-sm text-muted-foreground">Žiadne dáta o doménach.</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Štatistiky budú dostupné po odoslaní kampane.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
