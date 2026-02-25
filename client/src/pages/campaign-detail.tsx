import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { CHART_PALETTE } from "@/lib/chart-colors";
import { 
  ArrowLeft, Users, Settings, BarChart3, FileText, FileDown,
  Play, Pause, CheckCircle, CheckCircle2, Clock, Phone, PhoneMissed, User, Calendar,
  RefreshCw, Download, Filter, MoreHorizontal, Trash2, CheckCheck,
  Copy, Save, ScrollText, History, ArrowRight, Mail, MessageSquare, FileEdit, Package, Shield,
  Plus, ChevronDown, ChevronLeft, ChevronRight, ListChecks, Upload, FileUp, AlertTriangle,
  ThumbsUp, ThumbsDown, CalendarPlus, PhoneOff, AlertCircle, XCircle, Zap, Star,
  CircleDot, Info, Heart, Ban, Bell, Send, Target, Flag, Eye, EyeOff,
  Volume2, VolumeX, UserCheck, UserX, Briefcase, Gift, Home, MapPin, Globe, Wand2,
  Variable, Building2, Building, Loader2, Tag,
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
import { type Campaign, type CampaignContact, type Customer, COUNTRIES, type OperatorScript, operatorScriptSchema, type CampaignDisposition, DISPOSITION_ACTION_TYPES, DISPOSITION_NAME_TRANSLATIONS } from "@shared/schema";
import { Input } from "@/components/ui/input";

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
          { id: "el_notes", type: "textarea" as const, label: "Notes", placeholder: "..." },
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
import { format } from "date-fns";
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
} from "@/components/ui/dialog";
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

const ICON_PICKER_SET: { name: string; icon: LucideIcon }[] = [
  { name: "Phone", icon: Phone },
  { name: "PhoneOff", icon: PhoneOff },
  { name: "Mail", icon: Mail },
  { name: "MessageSquare", icon: MessageSquare },
  { name: "Send", icon: Send },
  { name: "ThumbsUp", icon: ThumbsUp },
  { name: "ThumbsDown", icon: ThumbsDown },
  { name: "CheckCircle", icon: CheckCircle },
  { name: "XCircle", icon: XCircle },
  { name: "AlertCircle", icon: AlertCircle },
  { name: "Ban", icon: Ban },
  { name: "Clock", icon: Clock },
  { name: "Calendar", icon: Calendar },
  { name: "CalendarPlus", icon: CalendarPlus },
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Zap", icon: Zap },
  { name: "Bell", icon: Bell },
  { name: "Info", icon: Info },
  { name: "Flag", icon: Flag },
  { name: "Target", icon: Target },
  { name: "Eye", icon: Eye },
  { name: "EyeOff", icon: EyeOff },
  { name: "User", icon: User },
  { name: "UserCheck", icon: UserCheck },
  { name: "UserX", icon: UserX },
  { name: "Users", icon: Users },
  { name: "Home", icon: Home },
  { name: "MapPin", icon: MapPin },
  { name: "Globe", icon: Globe },
  { name: "Briefcase", icon: Briefcase },
  { name: "Gift", icon: Gift },
  { name: "FileText", icon: FileText },
  { name: "Volume2", icon: Volume2 },
  { name: "VolumeX", icon: VolumeX },
  { name: "CircleDot", icon: CircleDot },
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

function AutoModeCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [autoMode, setAutoMode] = useState(false);
  const [autoDelaySeconds, setAutoDelaySeconds] = useState(5);
  const [contactSortField, setContactSortField] = useState("createdAt");
  const [contactSortOrder, setContactSortOrder] = useState("desc");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    try {
      if (campaign.settings) {
        const s = JSON.parse(campaign.settings);
        setAutoMode(!!s.autoMode);
        setAutoDelaySeconds(s.autoDelaySeconds || 5);
        setContactSortField(s.contactSortField || "createdAt");
        setContactSortOrder(s.contactSortOrder || "desc");
      }
    } catch {}
  }, [campaign.settings]);

  const saveAutoModeMutation = useMutation({
    mutationFn: async () => {
      let existing: Record<string, any> = {};
      try {
        if (campaign.settings) existing = JSON.parse(campaign.settings);
      } catch {}
      const merged = { ...existing, autoMode, autoDelaySeconds, contactSortField, contactSortOrder };
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>{t.campaigns.detail.autoMode}</CardTitle>
            <CardDescription>
              {t.campaigns.detail.autoModeDesc}
            </CardDescription>
          </div>
          {hasChanges && (
            <Button
              onClick={() => saveAutoModeMutation.mutate()}
              disabled={saveAutoModeMutation.isPending}
              data-testid="button-save-auto-mode"
            >
              {saveAutoModeMutation.isPending ? t.campaigns.detail.saving : t.common.save}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={autoMode}
            onCheckedChange={(checked) => { setAutoMode(checked); setHasChanges(true); }}
            data-testid="switch-auto-mode"
          />
          <Label className="text-sm font-medium">{t.campaigns.detail.autoMode}</Label>
        </div>
        {autoMode && (
          <div className="space-y-4 pl-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Oneskorenie (sekundy)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={autoDelaySeconds}
                onChange={(e) => { setAutoDelaySeconds(parseInt(e.target.value) || 5); setHasChanges(true); }}
                className="w-32"
                data-testid="input-auto-delay"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t.campaigns.detail.sortContactsBy}</Label>
              <Select value={contactSortField} onValueChange={(v) => { setContactSortField(v); setHasChanges(true); }}>
                <SelectTrigger className="w-64" data-testid="select-sort-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">{t.campaigns.detail.sortByCreatedAt}</SelectItem>
                  <SelectItem value="dateOfBirth">{t.campaigns.detail.sortByDateOfBirth}</SelectItem>
                  <SelectItem value="priorityScore">{t.campaigns.detail.priority}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t.campaigns.detail.sortDirection}</Label>
              <Select value={contactSortOrder} onValueChange={(v) => { setContactSortOrder(v); setHasChanges(true); }}>
                <SelectTrigger className="w-64" data-testid="select-sort-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">{t.campaigns.detail.sortDesc}</SelectItem>
                  <SelectItem value="asc">{t.campaigns.detail.sortAsc}</SelectItem>
                </SelectContent>
              </Select>
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
  none: "bg-muted text-muted-foreground",
};

function DispositionsTab({ campaignId, embedded }: { campaignId: string; embedded?: boolean }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();

  const userLocale = useMemo(() => {
    const countryToLang: Record<string, string> = { SK: 'sk', CZ: 'cs', HU: 'hu', RO: 'ro', IT: 'it', DE: 'de', US: 'en' };
    if (user?.countries?.length) {
      return countryToLang[user.countries[0]] || locale;
    }
    return locale;
  }, [user?.countries, locale]);

  const getDispName = (code: string, fallbackName: string) => {
    return DISPOSITION_NAME_TRANSLATIONS[code]?.[userLocale] || fallbackName;
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [newDisp, setNewDisp] = useState({ name: "", code: "", icon: "", color: "#6b7280", actionType: "none" });

  const actionLabels: Record<string, string> = {
    none: t.campaigns.detail.dispActionNone,
    callback: t.campaigns.detail.dispActionCallback,
    dnd: t.campaigns.detail.dispActionDnd,
    complete: t.campaigns.detail.dispActionComplete,
    convert: t.campaigns.detail.dispActionConvert,
    send_email: t.campaigns.detail.dispActionEmail,
    send_sms: t.campaigns.detail.dispActionSms,
  };

  const { data: dispositions = [], isLoading } = useQuery<CampaignDisposition[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    enabled: !!campaignId,
  });

  const parents = dispositions.filter(d => !d.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenMap = dispositions.reduce((acc, d) => {
    if (d.parentId) {
      if (!acc[d.parentId]) acc[d.parentId] = [];
      acc[d.parentId].push(d);
    }
    return acc;
  }, {} as Record<string, CampaignDisposition[]>);

  const toggleExpand = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const seedMutation = useMutation({
    mutationFn: (force: boolean = false) => apiRequest("POST", `/api/campaigns/${campaignId}/dispositions/seed`, { language: locale, force }),
    onSuccess: () => {
      toast({ title: t.campaigns.detail.dispDefaultsCreated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
    },
    onError: () => toast({ title: t.campaigns.detail.error, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/campaigns/${campaignId}/dispositions`, data),
    onSuccess: () => {
      toast({ title: t.campaigns.detail.dispCreated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
      setShowAddForm(false);
      setAddingSubFor(null);
      setNewDisp({ name: "", code: "", icon: "", color: "#6b7280", actionType: "none" });
    },
    onError: () => toast({ title: t.campaigns.detail.dispCreateError, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/campaigns/${campaignId}/dispositions/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
    },
    onError: () => toast({ title: t.campaigns.detail.error, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/campaigns/${campaignId}/dispositions/${id}`),
    onSuccess: () => {
      toast({ title: t.campaigns.detail.dispDeleted });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
    },
    onError: () => toast({ title: t.campaigns.detail.dispDeleteError, variant: "destructive" }),
  });

  const handleCreate = (parentId?: string) => {
    if (!newDisp.name || !newDisp.code) return;
    createMutation.mutate({
      campaignId,
      parentId: parentId || null,
      name: newDisp.name,
      code: newDisp.code,
      icon: newDisp.icon || null,
      color: newDisp.color || null,
      actionType: newDisp.actionType,
    });
  };

  const renderAddForm = (parentId?: string) => (
    <div className="flex flex-wrap items-end gap-2 p-3 rounded-md border bg-muted/30" data-testid="disposition-add-form">
      <div className="space-y-1">
        <Label className="text-xs">{t.campaigns.detail.dispName}</Label>
        <Input
          value={newDisp.name}
          onChange={e => setNewDisp(p => ({ ...p, name: e.target.value }))}
          placeholder={t.campaigns.detail.dispName}
          className="w-40"
          data-testid="input-disposition-name"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t.common.code}</Label>
        <Input
          value={newDisp.code}
          onChange={e => setNewDisp(p => ({ ...p, code: e.target.value }))}
          placeholder="kod"
          className="w-32"
          data-testid="input-disposition-code"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t.campaigns.detail.dispSelectIcon}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-28 gap-2 justify-start" data-testid="input-disposition-icon">
              {newDisp.icon && ICON_MAP[newDisp.icon] ? (() => {
                const Ic = ICON_MAP[newDisp.icon];
                return <Ic className="h-4 w-4 shrink-0" />;
              })() : <CircleDot className="h-4 w-4 shrink-0 opacity-40" />}
              <span className="text-xs truncate">{newDisp.icon || t.common.select}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="grid grid-cols-6 gap-1" data-testid="icon-picker-grid">
              {ICON_PICKER_SET.map(({ name, icon: Ic }) => (
                <Button
                  key={name}
                  size="icon"
                  variant={newDisp.icon === name ? "default" : "ghost"}
                  onClick={() => setNewDisp(p => ({ ...p, icon: name }))}
                  title={name}
                  data-testid={`icon-pick-${name}`}
                >
                  <Ic className="h-4 w-4" />
                </Button>
              ))}
            </div>
            {newDisp.icon && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-1"
                onClick={() => setNewDisp(p => ({ ...p, icon: "" }))}
                data-testid="button-clear-icon"
              >
                {t.common.clear}
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t.common.status}</Label>
        <Input
          type="color"
          value={newDisp.color}
          onChange={e => setNewDisp(p => ({ ...p, color: e.target.value }))}
          className="w-14"
          data-testid="input-disposition-color"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t.common.actions}</Label>
        <Select value={newDisp.actionType} onValueChange={v => setNewDisp(p => ({ ...p, actionType: v }))}>
          <SelectTrigger className="w-32" data-testid="select-disposition-action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISPOSITION_ACTION_TYPES.map(at => (
              <SelectItem key={at} value={at}>{actionLabels[at] || at}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        onClick={() => handleCreate(parentId)}
        disabled={createMutation.isPending || !newDisp.name || !newDisp.code}
        data-testid="button-save-disposition"
      >
        {createMutation.isPending ? "..." : t.campaigns.detail.dispSave}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => { setShowAddForm(false); setAddingSubFor(null); }}
        data-testid="button-cancel-disposition"
      >
        {t.campaigns.detail.cancel}
      </Button>
    </div>
  );

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-dispositions-title">{t.campaigns.detail.dispTitle}</h3>
          <p className="text-sm text-muted-foreground">{t.campaigns.detail.dispTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (dispositions.length > 0) {
                if (window.confirm(t.campaigns?.detail?.dispResetConfirm || "Existujúce dispozície budú nahradené predvolenými. Pokračovať?")) {
                  seedMutation.mutate(true);
                }
              } else {
                seedMutation.mutate(false);
              }
            }}
            disabled={seedMutation.isPending}
            data-testid="button-seed-dispositions"
          >
            <ListChecks className="w-4 h-4 mr-2" />
            {seedMutation.isPending
              ? t.campaigns.detail.dispLoadDefaultsLoading
              : dispositions.length > 0
                ? (t.campaigns?.detail?.dispReloadDefaults || "Obnoviť predvolené")
                : t.campaigns.detail.dispLoadDefaults}
          </Button>
          <Button
            onClick={() => { setShowAddForm(true); setAddingSubFor(null); setNewDisp({ name: "", code: "", icon: "", color: "#6b7280", actionType: "none" }); }}
            data-testid="button-add-disposition"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t.campaigns.detail.dispAddResult}
          </Button>
        </div>
      </div>

      {showAddForm && !addingSubFor && renderAddForm()}

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 animate-spin" />
        </div>
      ) : parents.length === 0 && !showAddForm ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-no-dispositions">
          {t.campaigns.detail.noDataAvailable}
        </div>
      ) : (
        <div className="space-y-3">
          {parents.map(parent => {
            const children = (childrenMap[parent.id] || []).sort((a, b) => a.sortOrder - b.sortOrder);
            const isExpanded = expandedParents.has(parent.id);
            return (
              <Card key={parent.id} data-testid={`card-disposition-${parent.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {children.length > 0 && (
                      <Button size="icon" variant="ghost" onClick={() => toggleExpand(parent.id)} data-testid={`button-expand-${parent.id}`}>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                    )}
                    {(() => {
                      const ParentIcon = ICON_MAP[parent.icon || ""] || CircleDot;
                      return <ParentIcon className="w-4 h-4 shrink-0" style={parent.color ? { color: parent.color } : undefined} />;
                    })()}
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${!parent.isActive ? "line-through text-muted-foreground" : ""}`} data-testid={`text-disposition-name-${parent.id}`}>
                        {getDispName(parent.code, parent.name)}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">{parent.code}</span>
                    </div>
                    <Badge className={ACTION_TYPE_COLORS[parent.actionType] || ACTION_TYPE_COLORS.none} data-testid={`badge-action-${parent.id}`}>
                      {actionLabels[parent.actionType] || parent.actionType}
                    </Badge>
                    <Switch
                      checked={parent.isActive}
                      onCheckedChange={checked => toggleActiveMutation.mutate({ id: parent.id, isActive: checked })}
                      data-testid={`switch-active-${parent.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setAddingSubFor(parent.id); setShowAddForm(false); setNewDisp({ name: "", code: "", icon: "", color: parent.color || "#6b7280", actionType: "none" }); }}
                      data-testid={`button-add-sub-${parent.id}`}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(parent.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-disposition-${parent.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {addingSubFor === parent.id && (
                    <div className="mt-3">
                      {renderAddForm(parent.id)}
                    </div>
                  )}

                  {isExpanded && children.length > 0 && (
                    <div className="mt-3 ml-8 space-y-2">
                      {children.map(child => (
                        <div key={child.id} className="flex flex-wrap items-center gap-3 p-2 rounded-md border" data-testid={`row-disposition-${child.id}`}>
                          {(() => {
                            const ChildIcon = ICON_MAP[child.icon || ""] || CircleDot;
                            return <ChildIcon className="w-3.5 h-3.5 shrink-0" style={child.color ? { color: child.color } : undefined} />;
                          })()}
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${!child.isActive ? "line-through text-muted-foreground" : ""}`} data-testid={`text-disposition-name-${child.id}`}>
                              {getDispName(child.code, child.name)}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">{child.code}</span>
                          </div>
                          {child.actionType !== "none" && (
                            <Badge className={ACTION_TYPE_COLORS[child.actionType] || ACTION_TYPE_COLORS.none}>
                              {actionLabels[child.actionType] || child.actionType}
                            </Badge>
                          )}
                          <Switch
                            checked={child.isActive}
                            onCheckedChange={checked => toggleActiveMutation.mutate({ id: child.id, isActive: checked })}
                            data-testid={`switch-active-${child.id}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(child.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-disposition-${child.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  if (embedded) return content;
  return <TabsContent value="dispositions" className="space-y-4">{content}</TabsContent>;
}

export default function CampaignDetailPage() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id || "";
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();

  const userLocale = useMemo(() => {
    const countryToLang: Record<string, string> = { SK: 'sk', CZ: 'cs', HU: 'hu', RO: 'ro', IT: 'it', DE: 'de', US: 'en' };
    if (user?.countries?.length) {
      return countryToLang[user.countries[0]] || locale;
    }
    return locale;
  }, [user?.countries, locale]);

  const getDispName = (code: string, fallbackName: string) => {
    return DISPOSITION_NAME_TRANSLATIONS[code]?.[userLocale] || fallbackName;
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
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; duplicates?: number; updated?: number; errors: string[]; importedContactIds?: string[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importPhase, setImportPhase] = useState<"upload" | "processing" | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [showRequeueDialog, setShowRequeueDialog] = useState(false);
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

  const { data: campaignAgents = [] } = useQuery<Array<{ id: string; userId: string; campaignId: string }>>({
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
  const callCenterUsers = allUsers.filter(u => u.role === "admin" || u.role === "callCenter" || (callCenterRoleId && u.roleId === callCenterRoleId));
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
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/generate-contacts`, {
        contactSources,
        customerCriteria: generateConfig.customer.enabled ? generateConfig.customer.criteria : undefined,
        hospitalCriteria: generateConfig.hospital.enabled ? generateConfig.hospital.criteria : undefined,
        clinicCriteria: generateConfig.clinic.enabled ? generateConfig.clinic.criteria : undefined,
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
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      toast({ title: t.campaigns.detail.importDeleted, description: `${data.deleted}` });
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
      ? filteredContacts.filter((c: any) => selectedContacts.has(c.id))
      : filteredContacts;
    
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
  const contactsPerPage = 20;
  const totalContactPages = Math.max(1, Math.ceil(filteredContacts.length / contactsPerPage));
  const paginatedContacts = filteredContacts.slice((contactsPage - 1) * contactsPerPage, contactsPage * contactsPerPage);

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
          <p className="text-muted-foreground">
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
          <Link href={`/campaigns/${campaign.id}/reports`}>
            <Button variant="outline" data-testid="button-campaign-reports">
              <BarChart3 className="w-4 h-4 mr-2" />
              {t.campaignReports?.reports || 'Reports'}
            </Button>
          </Link>
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
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-2" />
            {t.campaigns.detail.settings}
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
                    {(contactsPage - 1) * contactsPerPage + 1}–{Math.min(contactsPage * contactsPerPage, filteredContacts.length)} z {filteredContacts.length}
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

        <TabsContent value="settings" className="space-y-4">
          <Tabs value={settingsSubTab} onValueChange={setSettingsSubTab}>
            <TabsList>
              <TabsTrigger value="general" data-testid="subtab-general">
                <Settings className="w-4 h-4 mr-2" />
                {t.campaigns.detail.general}
              </TabsTrigger>
              <TabsTrigger value="scheduling" data-testid="subtab-scheduling">
                <Clock className="w-4 h-4 mr-2" />
                {t.campaigns.detail.scheduling}
              </TabsTrigger>
              <TabsTrigger value="operators" data-testid="subtab-operators">
                <Shield className="w-4 h-4 mr-2" />
                {t.campaigns.detail.operator}
              </TabsTrigger>
              <TabsTrigger value="dispositions" data-testid="subtab-dispositions">
                <CheckCheck className="w-4 h-4 mr-2" />
                {t.campaigns.detail.dispositions}
              </TabsTrigger>
              <TabsTrigger value="kpi" data-testid="subtab-kpi">
                <Target className="w-4 h-4 mr-2" />
                {t.campaigns.detail.kpiTargets}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
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

              <AutoModeCard campaign={campaign} />
              <CriteriaCard campaign={campaign} />
            </TabsContent>

            <TabsContent value="scheduling" className="space-y-6">
              <SchedulingCard campaign={campaign} />
            </TabsContent>

            <TabsContent value="operators" className="space-y-6">
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
                    {callCenterUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {t.campaigns.detail.noOperatorsAvailable}
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {callCenterUsers.map((user) => {
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
                <Card>
                  <CardHeader>
                    <CardTitle>{t.campaigns.detail.campaignSummary}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm">
                        {assignedAgentIds.length} {t.campaigns.detail.operator}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {t.campaigns.detail.assignedOperators}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="dispositions" className="space-y-4">
              <DispositionsTab campaignId={campaignId} embedded />
            </TabsContent>

            <TabsContent value="kpi" className="space-y-6">
              <KpiTargetsCard campaign={campaign} />
            </TabsContent>
          </Tabs>
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
                    isSaving={saveScriptMutation.isPending}
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
          
          {scriptMode === "builder" && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Variable className="h-4 w-4 text-primary" />
                    {t.campaigns.detail.scriptVariablesTitle || "Dostupné premenné"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t.campaigns.detail.scriptVariablesDesc || "Tieto premenné sa v agentskom workspace automaticky nahradia skutočnými údajmi kontaktu. Vkladajte ich do textových elementov scenára."}
                  </p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kontakt</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {[
                          { key: "{{customer.firstName}}", label: "Meno" },
                          { key: "{{customer.lastName}}", label: "Priezvisko" },
                          { key: "{{customer.fullName}}", label: "Celé meno" },
                          { key: "{{customer.greeting}}", label: "Oslovenie" },
                          { key: "{{customer.titleBefore}}", label: "Titul pred" },
                          { key: "{{customer.titleAfter}}", label: "Titul za" },
                          { key: "{{customer.email}}", label: "Email" },
                          { key: "{{customer.phone}}", label: "Telefón" },
                          { key: "{{customer.address}}", label: "Adresa" },
                          { key: "{{customer.city}}", label: "Mesto" },
                          { key: "{{customer.postalCode}}", label: "PSČ" },
                          { key: "{{customer.country}}", label: "Krajina" },
                        ].map((v) => (
                          <Badge key={v.key} variant="secondary" className="text-[10px] font-mono cursor-default" title={v.key}>
                            {v.key}
                            <span className="ml-1 font-sans text-muted-foreground">({v.label})</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Systém</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {[
                          { key: "{{date.today}}", label: "Dnešný dátum" },
                          { key: "{{agent.name}}", label: "Meno agenta" },
                          { key: "{{campaign.name}}", label: "Názov kampane" },
                        ].map((v) => (
                          <Badge key={v.key} variant="secondary" className="text-[10px] font-mono cursor-default" title={v.key}>
                            {v.key}
                            <span className="ml-1 font-sans text-muted-foreground">({v.label})</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t.campaigns.detail.scriptGuideTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                    <li>{t.campaigns.detail.scriptGuideSteps}</li>
                    <li>{t.campaigns.detail.scriptGuideHeadings}</li>
                    <li>{t.campaigns.detail.scriptGuideSelect}</li>
                    <li>{t.campaigns.detail.scriptGuideCheckbox}</li>
                    <li>{t.campaigns.detail.scriptGuideText}</li>
                    <li>{t.campaigns.detail.scriptGuideNotes}</li>
                    <li>{t.campaigns.detail.scriptGuideOutcome}</li>
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {campaign?.channel === "email" && (
          <TabsContent value="mailchimp" className="space-y-6">
            <MailchimpSyncSection campaignId={campaignId!} campaignName={campaign?.name || ""} countryCodes={campaign?.countryCodes || []} />
          </TabsContent>
        )}

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

      <Dialog open={showImportDialog} onOpenChange={(open) => { if (!open) { setShowImportDialog(false); setImportFile(null); setImportResult(null); setUpdateExisting(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.campaigns.detail.importContacts}</DialogTitle>
            <DialogDescription>
              {t.campaigns.detail.importContacts}
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
              <div
                className={`relative border-2 border-dashed rounded-md p-8 text-center transition-colors ${
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
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="h-8 w-8 text-primary" />
                    <p className="text-sm font-medium">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(importFile.size / 1024).toFixed(1)} KB
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setImportFile(null)} data-testid="button-remove-file">
                      {t.campaigns.detail.remove}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">{t.campaigns.detail.dragFileHere}</p>
                    <p className="text-xs text-muted-foreground">{t.campaigns.detail.orClickToSelect}</p>
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

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    window.open("/api/campaigns/contacts/import-template", "_blank");
                  }}
                  data-testid="button-download-template"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t.campaigns.detail.downloadSampleCsv}
                </Button>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs font-medium mb-2">{t.campaigns.detail.expectedColumns}:</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      "meno", "priezvisko", "telefon", "telefon_2",
                      "email", "krajina", "datum_ocakavaneho_porodu", "extra_pole_1", "extra_pole_2"
                    ].map(col => (
                      <span key={col} className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{col}</span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>krajina</strong> (SK, CZ, HU, RO, IT, DE, US) &middot; <strong>datum</strong> (YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.campaigns.detail.supportedFormats}
                  </p>
                </CardContent>
              </Card>

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
  const { toast } = useToast();
  const [selectedListId, setSelectedListId] = useState("");
  const [subject, setSubject] = useState(campaignName);
  const [emailHtml, setEmailHtml] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [mcSubTab, setMcSubTab] = useState<"editor" | "sync" | "stats">("editor");
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
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState({ subscribe: true, unsubscribe: true, campaign: true, cleaned: false, upemail: false });
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = { listId: selectedListId, subject };
      if (selectedSegmentId && selectedSegmentId !== "all") body.segmentId = selectedSegmentId;
      if (selectedTags.length > 0) body.tags = selectedTags;
      if (webhookUrl) {
        body.webhookUrl = webhookUrl;
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
            Vytvoriť Mailchimp kampaň
          </CardTitle>
          <CardDescription>
            Prepojte túto kampaň s Mailchimp a synchronizujte kontakty.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Predmet emailu</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Predmet emailovej kampane" data-testid="input-mc-subject" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Audience (zoznam)</Label>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowNewAudience(!showNewAudience)} data-testid="btn-toggle-new-audience">
                <Plus className="w-3.5 h-3.5 mr-1" />
                {showNewAudience ? "Vybrať existujúcu" : "Vytvoriť novú"}
              </Button>
            </div>
            {!showNewAudience ? (
              audiences.length > 0 ? (
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger data-testid="select-mc-audience-campaign">
                    <SelectValue placeholder="Vyberte audience..." />
                  </SelectTrigger>
                  <SelectContent>
                    {audiences.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.memberCount} kontaktov)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-amber-600">
                  Žiadne audience. Vytvorte novú alebo nastavte Mailchimp v konfigurátor &gt; Email & GSM &gt; Mailchimp.
                </p>
              )
            ) : (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="space-y-1.5">
                  <Label className="text-xs">Názov audience</Label>
                  <Input
                    value={newAudienceName}
                    onChange={e => setNewAudienceName(e.target.value)}
                    placeholder="Napr. SK Zákazníci"
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
                  Vytvoriť audience
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
                {showAdvanced ? "Skryť rozšírené nastavenia" : "Rozšírené nastavenia"}
                {(selectedTags.length > 0 || selectedSegmentId || webhookUrl) && (
                  <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">
                    {[selectedTags.length > 0, !!selectedSegmentId, !!webhookUrl].filter(Boolean).length}
                  </Badge>
                )}
              </Button>

              {showAdvanced && (
                <div className="space-y-4 p-3 border rounded-lg bg-muted/20">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      Tagy
                    </Label>
                    <p className="text-xs text-muted-foreground">Odoslať kampaň len kontaktom s vybranými tagmi (voliteľné).</p>
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
                      <p className="text-xs text-muted-foreground italic">Žiadne tagy v audience.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5" />
                      Segment
                    </Label>
                    <p className="text-xs text-muted-foreground">Odoslať kampaň len vybranému segmentu (voliteľné).</p>
                    <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
                      <SelectTrigger className="h-8" data-testid="select-mc-segment">
                        <SelectValue placeholder="Všetci kontakty (bez segmentu)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Všetci kontakty</SelectItem>
                        {listSegments.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} ({s.memberCount} kontaktov) — {s.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      Webhook
                    </Label>
                    <p className="text-xs text-muted-foreground">URL pre notifikácie o udalostiach (subscribe, unsubscribe, campaign).</p>
                    <Input
                      value={webhookUrl}
                      onChange={e => setWebhookUrl(e.target.value)}
                      placeholder="https://vasa-domena.sk/webhook/mailchimp"
                      className="h-8 text-sm"
                      data-testid="input-mc-webhook-url"
                    />
                    {webhookUrl && (
                      <div className="flex flex-wrap gap-2 mt-1">
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
                    )}
                    {listWebhooks.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Existujúce webhooky:</p>
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
            Vytvoriť v Mailchimp
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isSent = syncInfo.status === "sent";
  const statusLabels: Record<string, string> = {
    created: "Vytvorená",
    synced: "Kontakty synchronizované",
    content_set: "Obsah nastavený",
    sent: "Odoslaná",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">Mailchimp kampaň</h3>
            <p className="text-xs text-muted-foreground">ID: {syncInfo.mailchimpCampaignId}</p>
          </div>
          <Badge variant={isSent ? "default" : "secondary"} data-testid="badge-mc-sync-status">
            {statusLabels[syncInfo.status] || syncInfo.status}
          </Badge>
        </div>
      </div>

      <Tabs value={mcSubTab} onValueChange={(v) => setMcSubTab(v as any)}>
        <TabsList>
          <TabsTrigger value="editor" data-testid="mc-tab-editor">
            <FileText className="w-4 h-4 mr-2" />
            Email editor
          </TabsTrigger>
          <TabsTrigger value="sync" data-testid="mc-tab-sync">
            <Users className="w-4 h-4 mr-2" />
            Kontakty & Odoslanie
          </TabsTrigger>
          <TabsTrigger value="stats" data-testid="mc-tab-stats">
            <BarChart3 className="w-4 h-4 mr-2" />
            Štatistiky
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Predmet emailu</Label>
                  <Input
                    value={subject}
                    onChange={e => { setSubject(e.target.value); setContentSaved(false); }}
                    placeholder="Predmet emailovej kampane"
                    disabled={isSent}
                    data-testid="input-mc-subject-editor"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Šablóna</Label>
                  <Select onValueChange={handleSelectTemplate} disabled={isSent || htmlTemplates.length === 0}>
                    <SelectTrigger data-testid="select-mc-template">
                      <SelectValue placeholder={htmlTemplates.length === 0 ? "Žiadne šablóny" : "Vybrať šablónu..."} />
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
                  <Label>Obsah emailu</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Vložiť premennú:</span>
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
                      Obsah uložený v Mailchimp
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
                    Testovací email
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveContentMutation.mutate()}
                    disabled={saveContentMutation.isPending || !emailHtml || isSent || contentSaved}
                    data-testid="btn-mc-save-content"
                  >
                    {saveContentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Uložiť obsah do Mailchimp
                  </Button>
                </div>
              </div>

              {showTestEmail && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center gap-4">
                    <p className="text-xs font-medium text-muted-foreground">Spôsob odoslania:</p>
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
                        <span className="text-xs font-medium">MS365 (s premennými)</span>
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
                        <span className="text-xs font-medium">Mailchimp test</span>
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
                      disabled={!contentSaved || syncInfo.syncedContacts === 0}
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

              {!verificationSent ? (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowSendConfirm(false)}>Zrušiť</Button>
                  <Button
                    onClick={() => requestVerificationMutation.mutate()}
                    disabled={requestVerificationMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700"
                    data-testid="btn-mc-request-code"
                  >
                    {requestVerificationMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Shield className="w-4 h-4 mr-2" />
                    Vyžiadať overovací kód
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {verificationMethod === "email" && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                      <p>Overovací kód bol odoslaný na email: <strong>{verificationEmail}</strong></p>
                      <p className="text-xs text-muted-foreground mt-1">Kód je platný 10 minút.</p>
                    </div>
                  )}
                  {verificationMethod === "display" && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm">
                      <p className="text-xs text-muted-foreground mb-2">Email nemohol byť odoslaný. Zadajte zobrazený kód:</p>
                      <div className="text-center py-2 bg-white dark:bg-gray-900 rounded border">
                        <span className="text-2xl font-bold tracking-[6px] text-primary">{displayedCode}</span>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Overovací kód</Label>
                    <Input
                      value={verificationCode}
                      onChange={e => setVerificationCode(e.target.value.toUpperCase())}
                      placeholder="Zadajte 6-znakový kód"
                      maxLength={6}
                      className="text-center text-lg tracking-widest font-mono"
                      data-testid="input-mc-verification-code"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={() => requestVerificationMutation.mutate()} disabled={requestVerificationMutation.isPending}>
                      Poslať nový kód
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowSendConfirm(false)}>Zrušiť</Button>
                      <Button
                        onClick={() => sendCampaignMutation.mutate()}
                        disabled={sendCampaignMutation.isPending || verificationCode.length < 4}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="btn-mc-confirm-send"
                      >
                        {sendCampaignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Potvrdiť a odoslať
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
