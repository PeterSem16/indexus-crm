import { useState, useMemo, useCallback, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, FileText, Globe, Copy, Trash2, Settings, Eye,
  GripVertical, ChevronDown, ChevronRight, Loader2, CheckCircle2, X, Code,
  Clock, Users, ClipboardList, ArrowUp, ArrowDown, EyeOff,
  Columns, LayoutGrid, Maximize2, Palette, Type, Italic, Pencil, Mail, Info
} from "lucide-react";
import type { WebForm, WebFormSubmission } from "@shared/schema";

const COUNTRIES = [
  { code: "SK", name: "Slovensko", lang: "sk", flag: "🇸🇰" },
  { code: "CZ", name: "Česko", lang: "cs", flag: "🇨🇿" },
  { code: "HU", name: "Maďarsko", lang: "hu", flag: "🇭🇺" },
  { code: "RO", name: "Rumunsko", lang: "ro", flag: "🇷🇴" },
  { code: "IT", name: "Taliansko", lang: "it", flag: "🇮🇹" },
  { code: "DE", name: "Nemecko", lang: "de", flag: "🇩🇪" },
  { code: "GB", name: "UK", lang: "en", flag: "🇬🇧" },
];

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Telefón" },
  { value: "date", label: "Dátum" },
  { value: "number", label: "Číslo" },
  { value: "checkbox", label: "Zaškrtávacie políčko" },
  { value: "select", label: "Výber (vlastné možnosti)" },
  { value: "select_insurance", label: "Zdravotná poisťovňa" },
  { value: "select_hospital", label: "Nemocnica" },
  { value: "select_product", label: "Typ odberu (zostava)" },
  { value: "select_source", label: "Ako ste sa dozvedeli" },
  { value: "select_payment", label: "Spôsob platby" },
  { value: "textarea", label: "Textové pole (veľké)" },
];

const CUSTOMER_FIELDS = [
  { key: "firstName", label: "Meno", type: "text", section: "personal" },
  { key: "lastName", label: "Priezvisko", type: "text", section: "personal" },
  { key: "maidenName", label: "Rodné priezvisko", type: "text", section: "personal" },
  { key: "titleBefore", label: "Titul pred", type: "text", section: "personal" },
  { key: "titleAfter", label: "Titul za", type: "text", section: "personal" },
  { key: "email", label: "Email", type: "email", section: "personal" },
  { key: "phone", label: "Telefón", type: "tel", section: "personal" },
  { key: "mobile", label: "Mobil", type: "tel", section: "personal" },
  { key: "dateOfBirth", label: "Dátum narodenia", type: "date", section: "personal" },
  { key: "nationalId", label: "Rodné číslo", type: "text", section: "personal" },
  { key: "idCardNumber", label: "Číslo OP", type: "text", section: "personal" },
  { key: "address", label: "Ulica a číslo", type: "text", section: "address" },
  { key: "city", label: "Mesto", type: "text", section: "address" },
  { key: "postalCode", label: "PSČ", type: "text", section: "address" },
  { key: "region", label: "Kraj", type: "text", section: "address" },
  { key: "healthInsuranceId", label: "Zdravotná poisťovňa", type: "select_insurance", section: "medical" },
  { key: "bankAccount", label: "IBAN", type: "text", section: "banking" },
  { key: "bankName", label: "Názov banky", type: "text", section: "banking" },
  { key: "bankSwift", label: "SWIFT/BIC", type: "text", section: "banking" },
  { key: "useCorrespondenceAddress", label: "Iná korešpondenčná adresa", type: "checkbox", section: "address" },
  { key: "corrName", label: "Meno príjemcu (kor.)", type: "text", section: "correspondence" },
  { key: "corrAddress", label: "Ulica a číslo (kor.)", type: "text", section: "correspondence" },
  { key: "corrCity", label: "Mesto (kor.)", type: "text", section: "correspondence" },
  { key: "corrPostalCode", label: "PSČ (kor.)", type: "text", section: "correspondence" },
  { key: "corrRegion", label: "Kraj (kor.)", type: "text", section: "correspondence" },
  { key: "corrCountry", label: "Krajina (kor.)", type: "text", section: "correspondence" },
  { key: "newsletter", label: "Newsletter", type: "checkbox", section: "consent" },
];

const SPECIAL_FIELDS = [
  { key: "productSetId", label: "Typ odberu (zostava)", type: "select_product", section: "delivery" },
  { key: "hospitalId", label: "Nemocnica", type: "select_hospital", section: "delivery" },
  { key: "expectedDeliveryDate", label: "Predpokladaný termín pôrodu", type: "date", section: "delivery" },
  { key: "howDidYouHear", label: "Ako ste sa o nás dozvedeli", type: "select_source", section: "source" },
  { key: "paymentMethod", label: "Spôsob platby", type: "select_payment", section: "delivery" },
];

const DEFAULT_SECTIONS = [
  { title: "Údaje o matke", sortOrder: 0, columns: 2 },
  { title: "Pôrod a odber", sortOrder: 1, columns: 2 },
  { title: "Ako ste sa o nás dozvedeli", sortOrder: 2, columns: 1 },
];

const DEFAULT_FIELDS = [
  { customerField: "firstName", fieldType: "text", label: "Meno", isRequired: true, sortOrder: 0, sectionIndex: 0, validationRules: JSON.stringify({ minLength: 2, maxLength: 50 }), columnSpan: 1 },
  { customerField: "lastName", fieldType: "text", label: "Priezvisko", isRequired: true, sortOrder: 1, sectionIndex: 0, validationRules: JSON.stringify({ minLength: 2, maxLength: 50 }), columnSpan: 1 },
  { customerField: "email", fieldType: "email", label: "Email", isRequired: true, sortOrder: 2, sectionIndex: 0, validationRules: JSON.stringify({ pattern: "email" }), columnSpan: 1 },
  { customerField: "phone", fieldType: "tel", label: "Telefón", isRequired: true, sortOrder: 3, sectionIndex: 0, validationRules: JSON.stringify({ pattern: "phone", minLength: 9 }), columnSpan: 1 },
  { customerField: "address", fieldType: "text", label: "Ulica a číslo", isRequired: false, sortOrder: 4, sectionIndex: 0, columnSpan: 2 },
  { customerField: "city", fieldType: "text", label: "Mesto", isRequired: false, sortOrder: 5, sectionIndex: 0, columnSpan: 1 },
  { customerField: "postalCode", fieldType: "text", label: "PSČ", isRequired: false, sortOrder: 6, sectionIndex: 0, validationRules: JSON.stringify({ pattern: "postalCode", maxLength: 10 }), columnSpan: 1 },
  { customerField: "dateOfBirth", fieldType: "date", label: "Dátum narodenia", isRequired: false, sortOrder: 7, sectionIndex: 0, columnSpan: 1 },
  { customerField: "nationalId", fieldType: "text", label: "Rodné číslo", isRequired: false, sortOrder: 8, sectionIndex: 0, validationRules: JSON.stringify({ pattern: "nationalId" }), columnSpan: 1 },
  { customerField: "healthInsuranceId", fieldType: "select_insurance", label: "Zdravotná poisťovňa", isRequired: false, sortOrder: 9, sectionIndex: 0, columnSpan: 2 },
  { customerField: "productSetId", fieldType: "select_product", label: "Typ odberu", isRequired: true, sortOrder: 0, sectionIndex: 1, columnSpan: 2 },
  { customerField: "hospitalId", fieldType: "select_hospital", label: "Nemocnica", isRequired: true, sortOrder: 1, sectionIndex: 1, columnSpan: 1 },
  { customerField: "expectedDeliveryDate", fieldType: "date", label: "Predpokladaný termín pôrodu", isRequired: true, sortOrder: 2, sectionIndex: 1, columnSpan: 1 },
  { customerField: "paymentMethod", fieldType: "select_payment", label: "Spôsob platby", isRequired: false, sortOrder: 3, sectionIndex: 1, columnSpan: 2 },
  { customerField: "howDidYouHear", fieldType: "select_source", label: "Ako ste sa o nás dozvedeli", isRequired: false, sortOrder: 0, sectionIndex: 2, columnSpan: 1 },
];

const FORM_WIDTHS = [
  { value: "xl", label: "Úzky (640px)" },
  { value: "2xl", label: "Stredný (768px)" },
  { value: "3xl", label: "Štandard (896px)" },
  { value: "4xl", label: "Široký (960px)" },
  { value: "5xl", label: "Veľmi široký (1024px)" },
  { value: "6xl", label: "3/4 strany (1152px)" },
  { value: "full", label: "Celá strana" },
];

const FORM_LAYOUTS = [
  { value: "standard", label: "Štandard", desc: "Farebný header s formulárom pod ním" },
  { value: "minimal", label: "Minimálny", desc: "Biely formulár bez farebného headeru" },
  { value: "split", label: "Rozdelený", desc: "Farebný panel vľavo, formulár vpravo" },
  { value: "card", label: "Kartový", desc: "Formulár ako plávajúca karta na pozadí" },
  { value: "hero", label: "Hero", desc: "Veľký header s obrázkom a formulár pod ním" },
];

const FONT_SIZES = [
  { value: "xs", label: "XS (12px)" },
  { value: "sm", label: "SM (14px)" },
  { value: "base", label: "Base (16px)" },
  { value: "lg", label: "LG (18px)" },
  { value: "xl", label: "XL (20px)" },
  { value: "2xl", label: "2XL (24px)" },
  { value: "3xl", label: "3XL (30px)" },
  { value: "4xl", label: "4XL (36px)" },
];

const FONT_WEIGHTS = [
  { value: "light", label: "Tenké" },
  { value: "normal", label: "Normálne" },
  { value: "medium", label: "Stredné" },
  { value: "semibold", label: "Polotučné" },
  { value: "bold", label: "Tučné" },
  { value: "extrabold", label: "Extra tučné" },
];

const FONT_FAMILIES = [
  { value: "inherit", label: "Predvolený" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Georgia', serif", label: "Georgia (serif)" },
  { value: "'Arial', sans-serif", label: "Arial" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Open Sans', sans-serif", label: "Open Sans" },
  { value: "'Lato', sans-serif", label: "Lato" },
  { value: "'Montserrat', sans-serif", label: "Montserrat" },
];

function FontStyleEditor({ prefix, formData, setFormData, showFamily, showItalic }: {
  prefix: string; formData: any; setFormData: (d: any) => void;
  showFamily?: boolean; showItalic?: boolean;
}) {
  const sizeKey = `${prefix}FontSize`;
  const weightKey = `${prefix}FontWeight`;
  const styleKey = `${prefix}FontStyle`;
  const familyKey = `${prefix}FontFamily`;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Veľkosť</Label>
        <Select value={formData[sizeKey] || "sm"} onValueChange={v => setFormData({ ...formData, [sizeKey]: v })}>
          <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{FONT_SIZES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Hrúbka</Label>
        <Select value={formData[weightKey] || "normal"} onValueChange={v => setFormData({ ...formData, [weightKey]: v })}>
          <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{FONT_WEIGHTS.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {showItalic !== false && (
        <Button
          type="button" size="sm"
          variant={formData[styleKey] === "italic" ? "default" : "outline"}
          className="h-7 w-7 p-0"
          onClick={() => setFormData({ ...formData, [styleKey]: formData[styleKey] === "italic" ? "normal" : "italic" })}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
      )}
      {showFamily !== false && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Font</Label>
          <Select value={formData[familyKey] || "inherit"} onValueChange={v => setFormData({ ...formData, [familyKey]: v })}>
            <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FONT_FAMILIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function LayoutIcon({ layout, isActive }: { layout: string; isActive: boolean }) {
  const color = isActive ? "text-primary" : "text-gray-400";
  const bg = isActive ? "bg-primary/10" : "bg-gray-100";
  const accent = isActive ? "bg-primary/40" : "bg-gray-300";
  const form = isActive ? "bg-primary/15" : "bg-gray-200";

  if (layout === "standard") return (
    <div className={`w-full h-12 rounded ${bg} flex flex-col overflow-hidden`}>
      <div className={`h-4 ${accent}`} />
      <div className={`flex-1 mx-1.5 my-1 rounded-sm ${form}`} />
    </div>
  );
  if (layout === "minimal") return (
    <div className={`w-full h-12 rounded ${bg} flex flex-col p-1.5`}>
      <div className={`h-1.5 w-1/2 mx-auto rounded ${accent} mb-1`} />
      <div className={`flex-1 rounded-sm ${form}`} />
    </div>
  );
  if (layout === "split") return (
    <div className={`w-full h-12 rounded ${bg} flex overflow-hidden`}>
      <div className={`w-1/3 ${accent}`} />
      <div className={`flex-1 m-1 rounded-sm ${form}`} />
    </div>
  );
  if (layout === "card") return (
    <div className={`w-full h-12 rounded ${accent} flex items-center justify-center p-1.5`}>
      <div className={`w-full h-full rounded-sm bg-white/80 shadow-sm`} />
    </div>
  );
  return (
    <div className={`w-full h-12 rounded ${bg} flex flex-col overflow-hidden`}>
      <div className={`h-6 ${accent}`} />
      <div className={`flex-1 mx-2 -mt-1 rounded-sm ${form} shadow-sm`} />
    </div>
  );
}

function EmailLayoutIcon({ layout, brandColor, isActive }: { layout: string; brandColor: string; isActive: boolean }) {
  const c = isActive ? brandColor : "#9ca3af";
  const bg = isActive ? brandColor + "15" : "#f3f4f6";
  if (layout === "minimal") return (
    <svg viewBox="0 0 48 36" className="w-full h-8 mx-auto"><rect x="4" y="2" width="40" height="32" rx="3" fill="white" stroke={c} strokeWidth="0.8"/><rect x="8" y="6" width="20" height="2" rx="1" fill={c}/><rect x="8" y="11" width="32" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="8" y="15" width="32" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="8" y="19" width="24" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="8" y="26" width="32" height="6" rx="2" fill={bg} stroke={c} strokeWidth="0.5"/></svg>
  );
  if (layout === "sidebar") return (
    <svg viewBox="0 0 48 36" className="w-full h-8 mx-auto"><rect x="4" y="2" width="4" height="32" rx="2" fill={c}/><rect x="8" y="2" width="36" height="32" rx="0 3 3 0" fill="white" stroke="#e5e7eb" strokeWidth="0.5"/><rect x="12" y="6" width="14" height="1.5" rx="0.5" fill={c} opacity="0.5"/><rect x="12" y="10" width="24" height="2" rx="1" fill="#374151"/><rect x="12" y="15" width="28" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="12" y="19" width="28" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="12" y="26" width="28" height="6" rx="2" fill={bg} stroke={c} strokeWidth="0.5"/></svg>
  );
  if (layout === "elegant") return (
    <svg viewBox="0 0 48 36" className="w-full h-8 mx-auto"><rect x="4" y="2" width="40" height="32" rx="3" fill="white" stroke="#e5e7eb" strokeWidth="0.5"/><text x="24" y="8" textAnchor="middle" fontSize="3" fill={c} fontWeight="600">COMPANY</text><line x1="10" y1="10" x2="38" y2="10" stroke={c} strokeWidth="0.5" opacity="0.4"/><rect x="10" y="13" width="28" height="2" rx="1" fill="#374151" opacity="0.3"/><rect x="8" y="18" width="32" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="8" y="22" width="32" height="1.5" rx="0.5" fill="#e5e7eb"/><line x1="10" y1="28" x2="38" y2="28" stroke={c} strokeWidth="0.5" opacity="0.4"/></svg>
  );
  if (layout === "bold") return (
    <svg viewBox="0 0 48 36" className="w-full h-8 mx-auto"><rect x="4" y="2" width="40" height="14" rx="3 3 0 0" fill={c}/><rect x="12" y="6" width="24" height="3" rx="1" fill="white" opacity="0.9"/><rect x="14" y="10" width="20" height="1.5" rx="0.5" fill="white" opacity="0.5"/><rect x="4" y="16" width="40" height="18" rx="0 0 3 3" fill="white" stroke="#e5e7eb" strokeWidth="0.5"/><rect x="8" y="19" width="32" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="8" y="23" width="32" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="8" y="28" width="32" height="4" rx="1.5" fill={bg} stroke={c} strokeWidth="0.5"/></svg>
  );
  return (
    <svg viewBox="0 0 48 36" className="w-full h-8 mx-auto"><rect x="4" y="2" width="40" height="12" rx="3 3 0 0" fill={c}/><rect x="12" y="6" width="24" height="2.5" rx="1" fill="white" opacity="0.9"/><rect x="4" y="14" width="40" height="20" rx="0 0 3 3" fill="white" stroke="#e5e7eb" strokeWidth="0.5"/><rect x="8" y="17" width="32" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="8" y="21" width="32" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="8" y="25" width="24" height="1.5" rx="0.5" fill="#e5e7eb"/><rect x="8" y="30" width="32" height="3" rx="1" fill={bg} stroke={c} strokeWidth="0.5"/></svg>
  );
}

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex gap-1.5">
        <input type="color" value={value || "#000000"} onChange={e => onChange(e.target.value)} className="h-8 w-10 rounded border cursor-pointer shrink-0" />
        <Input value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-xs font-mono flex-1" />
      </div>
    </div>
  );
}

function parseValidationRules(rules: string | null | undefined): Record<string, any> {
  if (!rules) return {};
  try { return JSON.parse(rules); } catch { return {}; }
}

export default function WebFormsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [editingForm, setEditingForm] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingSubmissions, setViewingSubmissions] = useState<string | null>(null);
  const [embedDialogForm, setEmbedDialogForm] = useState<any>(null);
  const [previewFormSlug, setPreviewFormSlug] = useState<string | null>(null);

  const { data: forms = [], isLoading } = useQuery<WebForm[]>({ queryKey: ["/api/web-forms"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/web-forms", data);
      if (!res.ok) throw new Error("Failed to create form");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/web-forms"] });
      setIsCreating(false);
      toast({ title: "Formulár vytvorený" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/web-forms/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/web-forms"] });
      toast({ title: "Formulár vymazaný" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/web-forms/${id}`, { isActive });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/web-forms"] }),
  });

  const handleCreateForm = (countryCode: string) => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (!country) return;
    const slug = `${countryCode.toLowerCase()}-registracia`;
    const sectionIds = DEFAULT_SECTIONS.map((_, i) => `sec-${Date.now()}-${i}`);
    const sectionsWithIds = DEFAULT_SECTIONS.map((s, i) => ({ ...s, id: sectionIds[i] }));
    const fieldsWithSectionIds = DEFAULT_FIELDS.map(({ sectionIndex, ...f }) => ({
      ...f,
      sectionId: sectionIndex !== undefined ? sectionIds[sectionIndex] : null,
    }));
    createMutation.mutate({
      name: `Registrácia - ${country.name}`,
      slug,
      countryCode,
      language: country.lang,
      headerTitle: "Mám záujem o odber",
      headerSubtitle: "Objednajte si odber pupočníkovej krvi, tkaniva pupočníka alebo placenty a uchovajte vášmu bábätku jedinečný liečebný zdroj.",
      contactInfo: "Tel.: +421 2 321 654 00 | info@cordbloodcenter.sk",
      gdprText: "Poskytnutím vašich údajov zaslaním vyplneného formulára súhlasíte so spracovaním vašich osobných údajov na účel vybavenia žiadosti.",
      gdprPregnancyText: "Som si vedomá, že táto služba je určená pre tehotné ženy.",
      gdprMarketingText: "Súhlasím so zasielaním marketingových e-mailov a elektronických newslettrov.",
      successMessage: "Ďakujeme za vašu registráciu! Budeme vás kontaktovať.",
      brandColor: "#16a34a",
      textColor: "#ffffff",
      headingColor: "#ffffff",
      bgColor: "#f3f4f6",
      formWidth: "3xl",
      isActive: true,
      sections: sectionsWithIds,
      fields: fieldsWithSectionIds,
    });
  };

  const getFormUrl = (slug: string) => `${window.location.origin}/f/${slug}`;
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Skopírované do schránky" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-web-forms-title">Web Formuláre</h1>
          <p className="text-sm text-muted-foreground">Vytvárajte a spravujte registračné formuláre pre klientov</p>
        </div>
        <Select onValueChange={handleCreateForm}>
          <SelectTrigger className="w-[200px]" data-testid="select-create-form">
            <Plus className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Nový formulár" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map(c => (
              <SelectItem key={c.code} value={c.code} data-testid={`create-form-${c.code}`}>
                {c.flag} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : forms.length === 0 ? (
        <Card className="py-20">
          <CardContent className="text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-2">Žiadne formuláre</h3>
            <p className="text-sm text-muted-foreground mb-4">Vytvorte prvý registračný formulár pre vašich klientov</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map(form => {
            const country = COUNTRIES.find(c => c.code === form.countryCode);
            return (
              <Card key={form.id} className="relative" data-testid={`card-form-${form.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{country?.flag}</span>
                      <div>
                        <CardTitle className="text-sm font-semibold">{form.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">/{form.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={form.isActive ? "default" : "secondary"} className="text-[10px]">
                        {form.isActive ? "Aktívny" : "Neaktívny"}
                      </Badge>
                      <Switch checked={form.isActive} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: form.id, isActive: checked })} data-testid={`switch-active-${form.id}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>{country?.name} ({form.language?.toUpperCase()})</span>
                  </div>
                  <div className="text-xs bg-muted/50 rounded px-2 py-1.5 font-mono truncate" data-testid={`text-form-url-${form.id}`}>
                    {getFormUrl(form.slug)}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPreviewFormSlug(form.slug)} data-testid={`btn-preview-${form.id}`}>
                      <Eye className="h-3 w-3 mr-1" /> Náhľad
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyToClipboard(getFormUrl(form.slug))} data-testid={`btn-copy-url-${form.id}`}>
                      <Copy className="h-3 w-3 mr-1" /> URL
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEmbedDialogForm(form)} data-testid={`btn-embed-${form.id}`}>
                      <Code className="h-3 w-3 mr-1" /> Embed
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingForm(form)} data-testid={`btn-edit-${form.id}`}>
                      <Settings className="h-3 w-3 mr-1" /> Upraviť
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setViewingSubmissions(form.id)} data-testid={`btn-submissions-${form.id}`}>
                      <ClipboardList className="h-3 w-3 mr-1" /> Žiadosti
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { if (confirm("Naozaj vymazať tento formulár?")) deleteMutation.mutate(form.id); }} data-testid={`btn-delete-${form.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {previewFormSlug && (
        <Dialog open onOpenChange={(o) => !o && setPreviewFormSlug(null)}>
          <DialogContent className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="flex items-center justify-between">
                <span>Náhľad formulára</span>
                <div className="flex items-center gap-2 mr-6">
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(getFormUrl(previewFormSlug))} data-testid="btn-preview-copy-url">
                    <Copy className="h-3 w-3 mr-1" /> Kopírovať URL
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(getFormUrl(previewFormSlug), "_blank")} data-testid="btn-preview-open-new">
                    Nové okno
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <iframe src={`/f/${previewFormSlug}`} className="w-full h-full border-0" style={{ height: "calc(90vh - 60px)" }} data-testid="iframe-preview" />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!embedDialogForm} onOpenChange={(o) => !o && setEmbedDialogForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Embed kód pre WordPress</DialogTitle></DialogHeader>
          {embedDialogForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">iframe (odporúčaný)</Label>
                <Textarea readOnly rows={3} className="font-mono text-xs"
                  value={`<iframe src="${getFormUrl(embedDialogForm.slug)}" width="100%" height="900" frameborder="0" style="border:none;max-width:800px;margin:0 auto;display:block"></iframe>`}
                  data-testid="textarea-embed-iframe"
                />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(`<iframe src="${getFormUrl(embedDialogForm.slug)}" width="100%" height="900" frameborder="0" style="border:none;max-width:800px;margin:0 auto;display:block"></iframe>`)} data-testid="btn-copy-iframe">
                  <Copy className="h-3 w-3 mr-1" /> Kopírovať
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium">Priamy link</Label>
                <Input readOnly value={getFormUrl(embedDialogForm.slug)} className="font-mono text-xs" data-testid="input-embed-url" />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(getFormUrl(embedDialogForm.slug))} data-testid="btn-copy-direct">
                  <Copy className="h-3 w-3 mr-1" /> Kopírovať
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {editingForm && <FormEditorSheet form={editingForm} onClose={() => setEditingForm(null)} />}
      {viewingSubmissions && <SubmissionsSheet formId={viewingSubmissions} onClose={() => setViewingSubmissions(null)} />}
    </div>
  );
}

function SectionFieldsBuilder({
  editSections, setEditSections, editFields, setEditFields
}: {
  editSections: any[]; setEditSections: (s: any[]) => void;
  editFields: any[]; setEditFields: (f: any[]) => void;
}) {
  const [editingField, setEditingField] = useState<any>(null);
  const [editingFieldIdx, setEditingFieldIdx] = useState<number>(-1);

  const allFieldKeys = [...CUSTOMER_FIELDS, ...SPECIAL_FIELDS];
  const usedFieldKeys = new Set(editFields.map((f: any) => f.customerField));
  const availableFields = allFieldKeys.filter(f => !usedFieldKeys.has(f.key));

  const fieldsBySection = useMemo(() => {
    const map = new Map<string | null, any[]>();
    editFields.forEach((f, idx) => {
      const secId = f.sectionId || null;
      const existing = map.get(secId) || [];
      existing.push({ ...f, _globalIdx: idx });
      map.set(secId, existing);
    });
    for (const [key, fields] of map.entries()) {
      fields.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    return map;
  }, [editFields]);

  const addFieldToSection = (sectionId: string | null, fieldDef?: any) => {
    const newField = fieldDef ? {
      _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerField: fieldDef.key,
      fieldType: fieldDef.type,
      label: fieldDef.label,
      isRequired: false,
      sortOrder: editFields.length,
      sectionId,
      placeholder: "",
      helpText: "",
      validationRules: null,
      options: null,
      defaultValue: null,
      isVisible: true,
      columnSpan: 1,
    } : {
      _key: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerField: null,
      fieldType: "text",
      label: "Nové pole",
      isRequired: false,
      sortOrder: editFields.length,
      sectionId,
      placeholder: "",
      helpText: "",
      validationRules: null,
      options: null,
      defaultValue: null,
      isVisible: true,
      columnSpan: 1,
    };
    setEditFields([...editFields, newField]);
  };

  const moveFieldInSection = (globalIdx: number, direction: "up" | "down") => {
    const field = editFields[globalIdx];
    const secId = field.sectionId || null;
    const sectionFields = (fieldsBySection.get(secId) || []);
    const localIdx = sectionFields.findIndex((f: any) => f._globalIdx === globalIdx);
    const targetLocalIdx = direction === "up" ? localIdx - 1 : localIdx + 1;
    if (targetLocalIdx < 0 || targetLocalIdx >= sectionFields.length) return;
    const targetGlobalIdx = sectionFields[targetLocalIdx]._globalIdx;
    const arr = [...editFields];
    const tempSort = arr[globalIdx].sortOrder;
    arr[globalIdx] = { ...arr[globalIdx], sortOrder: arr[targetGlobalIdx].sortOrder };
    arr[targetGlobalIdx] = { ...arr[targetGlobalIdx], sortOrder: tempSort };
    setEditFields(arr);
  };

  const removeField = (globalIdx: number) => {
    setEditFields(editFields.filter((_, i) => i !== globalIdx));
  };

  const moveFieldToSection = (globalIdx: number, newSectionId: string | null) => {
    const arr = [...editFields];
    arr[globalIdx] = { ...arr[globalIdx], sectionId: newSectionId };
    setEditFields(arr);
  };

  const openFieldEditor = (field: any, idx: number) => {
    setEditingField({ ...field });
    setEditingFieldIdx(idx);
  };

  const saveFieldEdit = () => {
    if (editingFieldIdx < 0) return;
    const arr = [...editFields];
    arr[editingFieldIdx] = { ...editingField };
    setEditFields(arr);
    setEditingField(null);
    setEditingFieldIdx(-1);
  };

  const addSection = () => {
    setEditSections([...editSections, {
      id: `new-${Date.now()}`,
      title: "Nová sekcia",
      sortOrder: editSections.length,
      columns: 2,
      isVisible: true,
    }]);
  };

  const moveSectionUp = (idx: number) => {
    if (idx <= 0) return;
    const arr = [...editSections];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    arr.forEach((s, i) => s.sortOrder = i);
    setEditSections(arr);
  };

  const moveSectionDown = (idx: number) => {
    if (idx >= editSections.length - 1) return;
    const arr = [...editSections];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    arr.forEach((s, i) => s.sortOrder = i);
    setEditSections(arr);
  };

  const deleteSection = (idx: number) => {
    const removedId = editSections[idx]?.id;
    setEditSections(editSections.filter((_, i) => i !== idx));
    if (removedId) {
      setEditFields(editFields.map(f => f.sectionId === removedId ? { ...f, sectionId: null } : f));
    }
  };

  const sortedSections = [...editSections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const orphanFields = fieldsBySection.get(null) || [];

  return (
    <div className="space-y-4">
      {sortedSections.map((section, sIdx) => {
        const sectionFields = fieldsBySection.get(section.id) || [];
        const cols = section.columns || 2;
        return (
          <div key={section.id} className="border rounded-xl overflow-hidden" data-testid={`section-${section.id}`}>
            <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2">
              <div className="flex items-center gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveSectionUp(sIdx)} disabled={sIdx === 0}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveSectionDown(sIdx)} disabled={sIdx === sortedSections.length - 1}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={section.title}
                onChange={e => {
                  const arr = [...editSections];
                  const realIdx = editSections.findIndex(s => s.id === section.id);
                  arr[realIdx] = { ...arr[realIdx], title: e.target.value };
                  setEditSections(arr);
                }}
                className="h-7 text-sm font-semibold flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-1"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <Columns className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={String(cols)} onValueChange={v => {
                  const arr = [...editSections];
                  const realIdx = editSections.findIndex(s => s.id === section.id);
                  arr[realIdx] = { ...arr[realIdx], columns: Number(v) };
                  setEditSections(arr);
                }}>
                  <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 stĺp.</SelectItem>
                    <SelectItem value="2">2 stĺp.</SelectItem>
                    <SelectItem value="3">3 stĺp.</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="secondary" className="text-[10px]">{sectionFields.length} polí</Badge>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteSection(editSections.findIndex(s => s.id === section.id))}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="p-3">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {sectionFields.map((field: any, fi: number) => {
                  const span = Math.min(field.columnSpan || 1, cols);
                  const typeLabel = FIELD_TYPES.find(ft => ft.value === field.fieldType)?.label || field.fieldType;
                  return (
                    <div
                      key={field._key || field.id || fi}
                      className="border border-dashed border-gray-300 rounded-lg p-2 bg-gray-50/50 hover:bg-blue-50/50 hover:border-blue-300 transition-colors group cursor-pointer"
                      style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}
                      onClick={() => openFieldEditor(field, field._globalIdx)}
                      data-testid={`field-card-${field.customerField || fi}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-medium text-gray-700 truncate">{field.label}</span>
                          {field.isRequired && <span className="text-red-500 text-[10px] font-bold shrink-0">*</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); moveFieldInSection(field._globalIdx, "up"); }} disabled={fi === 0}>
                            <ArrowUp className="h-2.5 w-2.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); moveFieldInSection(field._globalIdx, "down"); }} disabled={fi === sectionFields.length - 1}>
                            <ArrowDown className="h-2.5 w-2.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); removeField(field._globalIdx); }}>
                            <X className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="outline" className="text-[9px] h-4">{typeLabel}</Badge>
                        {(field.columnSpan || 1) > 1 && <Badge variant="secondary" className="text-[9px] h-4"><Maximize2 className="h-2 w-2 mr-0.5" /> {field.columnSpan}</Badge>}
                        {!field.isVisible && <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {sectionFields.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Prázdna sekcia - pridajte polia
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                {availableFields.slice(0, 5).map(f => (
                  <Button key={f.key} size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => addFieldToSection(section.id, f)}>
                    <Plus className="h-2.5 w-2.5 mr-0.5" /> {f.label}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => addFieldToSection(section.id)}>
                  <Plus className="h-2.5 w-2.5 mr-0.5" /> Vlastné pole
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {orphanFields.length > 0 && (
        <div className="border rounded-xl overflow-hidden border-orange-200">
          <div className="bg-orange-50 px-4 py-2.5 flex items-center gap-2">
            <span className="text-sm font-semibold text-orange-700">Polia bez sekcie</span>
            <Badge variant="secondary" className="text-[10px]">{orphanFields.length}</Badge>
          </div>
          <div className="p-3 space-y-1">
            {orphanFields.map((field: any, fi: number) => (
              <div key={field._key || field.id || fi} className="flex items-center gap-2 p-2 border rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => openFieldEditor(field, field._globalIdx)}>
                <span className="text-xs font-medium flex-1">{field.label}</span>
                <Select value="_move" onValueChange={v => { if (v !== "_move") moveFieldToSection(field._globalIdx, v); }}>
                  <SelectTrigger className="h-6 w-[140px] text-[10px]"><SelectValue placeholder="Presunúť do sekcie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_move" disabled>Presunúť do...</SelectItem>
                    {editSections.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); removeField(field._globalIdx); }}>
                  <X className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={addSection} className="flex-1">
          <Plus className="h-3 w-3 mr-1" /> Pridať sekciu
        </Button>
      </div>

      {availableFields.length > 0 && (
        <div>
          <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-2">Dostupné polia na pridanie</Label>
          <div className="flex flex-wrap gap-1">
            {availableFields.map(f => (
              <Button key={f.key} size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => addFieldToSection(editSections[0]?.id || null, f)}>
                <Plus className="h-2.5 w-2.5 mr-0.5" /> {f.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!editingField} onOpenChange={(o) => { if (!o) { setEditingField(null); setEditingFieldIdx(-1); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Upraviť pole: {editingField?.label}
            </DialogTitle>
          </DialogHeader>
          {editingField && (
            <FieldEditDialog
              field={editingField}
              setField={setEditingField}
              sections={editSections}
              sectionColumns={(editSections.find((s: any) => s.id === editingField.sectionId)?.columns) || 2}
              onSave={saveFieldEdit}
              onCancel={() => { setEditingField(null); setEditingFieldIdx(-1); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldEditDialog({ field, setField, sections, sectionColumns, onSave, onCancel }: {
  field: any; setField: (f: any) => void; sections: any[]; sectionColumns: number;
  onSave: () => void; onCancel: () => void;
}) {
  const rules = parseValidationRules(field.validationRules);

  const updateRules = (key: string, value: any) => {
    const newRules = { ...rules, [key]: value };
    if (value === "" || value === null || value === undefined || value === false) delete newRules[key];
    setField({ ...field, validationRules: JSON.stringify(newRules) });
  };

  const maxCols = sectionColumns;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Názov poľa</Label>
          <Input value={field.label} onChange={e => setField({ ...field, label: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Typ poľa</Label>
          <Select value={field.fieldType} onValueChange={v => setField({ ...field, fieldType: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Sekcia</Label>
          <Select value={field.sectionId || "_none"} onValueChange={v => setField({ ...field, sectionId: v === "_none" ? null : v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Bez sekcie</SelectItem>
              {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Šírka poľa</Label>
          <Select value={String(field.columnSpan || 1)} onValueChange={v => setField({ ...field, columnSpan: Number(v) })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 stĺpec</SelectItem>
              {maxCols >= 2 && <SelectItem value="2">2 stĺpce (celý riadok)</SelectItem>}
              {maxCols >= 3 && <SelectItem value="3">3 stĺpce (celý riadok)</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Placeholder</Label>
          <Input value={field.placeholder || ""} onChange={e => setField({ ...field, placeholder: e.target.value })} className="h-8 text-sm" placeholder="Napr. Zadajte meno..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nápoveď (help text)</Label>
          <Input value={field.helpText || ""} onChange={e => setField({ ...field, helpText: e.target.value })} className="h-8 text-sm" placeholder="Napr. Formát: +421..." />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Predvolená hodnota</Label>
        <Input value={field.defaultValue || ""} onChange={e => setField({ ...field, defaultValue: e.target.value })} className="h-8 text-sm" />
      </div>

      {field.fieldType === "select" && (
        <div className="space-y-1">
          <Label className="text-xs">Možnosti (každá na nový riadok)</Label>
          <Textarea value={field.options || ""} onChange={e => setField({ ...field, options: e.target.value })} rows={3} className="text-sm" placeholder={"Možnosť 1\nMožnosť 2\nMožnosť 3"} />
        </div>
      )}

      <Separator />
      <div>
        <Label className="text-xs font-semibold mb-3 block">Validácia a viditeľnosť</Label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Switch checked={field.isRequired} onCheckedChange={checked => setField({ ...field, isRequired: checked })} />
            <Label className="text-xs">Povinné pole</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={field.isVisible !== false} onCheckedChange={checked => setField({ ...field, isVisible: checked })} />
            <Label className="text-xs">Viditeľné</Label>
          </div>
        </div>

        {(field.fieldType === "text" || field.fieldType === "textarea" || field.fieldType === "tel") && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Min. dĺžka</Label>
              <Input type="number" value={rules.minLength || ""} onChange={e => updateRules("minLength", e.target.value ? Number(e.target.value) : "")} className="h-7 text-sm" placeholder="napr. 2" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Max. dĺžka</Label>
              <Input type="number" value={rules.maxLength || ""} onChange={e => updateRules("maxLength", e.target.value ? Number(e.target.value) : "")} className="h-7 text-sm" placeholder="napr. 100" />
            </div>
          </div>
        )}

        {field.fieldType === "number" && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Min. hodnota</Label>
              <Input type="number" value={rules.min ?? ""} onChange={e => updateRules("min", e.target.value ? Number(e.target.value) : "")} className="h-7 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Max. hodnota</Label>
              <Input type="number" value={rules.max ?? ""} onChange={e => updateRules("max", e.target.value ? Number(e.target.value) : "")} className="h-7 text-sm" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Vzor validácie</Label>
            <Select value={rules.pattern || "_none"} onValueChange={v => updateRules("pattern", v === "_none" ? "" : v)}>
              <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Žiadny</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Telefónne číslo</SelectItem>
                <SelectItem value="postalCode">PSČ</SelectItem>
                <SelectItem value="nationalId">Rodné číslo</SelectItem>
                <SelectItem value="iban">IBAN</SelectItem>
                <SelectItem value="custom">Vlastný regex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rules.pattern === "custom" && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Regex vzor</Label>
              <Input value={rules.customPattern || ""} onChange={e => updateRules("customPattern", e.target.value)} className="h-7 text-sm font-mono" placeholder="^[A-Z].*" />
            </div>
          )}
        </div>

        <div className="space-y-1 mt-3">
          <Label className="text-[11px] text-muted-foreground">Vlastná chybová správa</Label>
          <Input value={rules.errorMessage || ""} onChange={e => updateRules("errorMessage", e.target.value)} className="h-7 text-sm" placeholder="Napr. Zadajte platné telefónne číslo" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>Zrušiť</Button>
        <Button size="sm" onClick={onSave}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Uložiť pole</Button>
      </div>
    </div>
  );
}

function LayoutPreview({ sections, fields, formData }: { sections: any[]; fields: any[]; formData: any }) {
  const brandColor = formData.brandColor || "#16a34a";
  const textColor = formData.textColor || "#ffffff";
  const sectionColor = formData.sectionColor || brandColor;
  const bgColor = formData.bgColor || "#f3f4f6";
  const layout = formData.formLayout || "standard";

  const grouped = useMemo(() => {
    const result: Array<{ section: any; fields: any[] }> = [];
    const fieldsBySection: Map<string, any[]> = new Map();
    const noSection: any[] = [];
    const sortedFields = [...fields].filter((f: any) => f.isVisible !== false).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const field of sortedFields) {
      if (field.sectionId) {
        const existing = fieldsBySection.get(field.sectionId) || [];
        existing.push(field);
        fieldsBySection.set(field.sectionId, existing);
      } else {
        noSection.push(field);
      }
    }
    const sortedSections = [...sections].filter((s: any) => s.isVisible !== false).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const sec of sortedSections) {
      const secFields = fieldsBySection.get(sec.id) || [];
      if (secFields.length > 0) result.push({ section: sec, fields: secFields });
    }
    if (noSection.length > 0) result.push({ section: { title: null, columns: 2 }, fields: noSection });
    return result;
  }, [sections, fields]);

  const renderFields = () => (
    <div className="space-y-2">
      {grouped.map((group, gi) => {
        const cols = group.section?.columns || 2;
        return (
          <div key={gi}>
            {group.section?.title && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="h-px flex-1" style={{ backgroundColor: sectionColor + "30" }} />
                <span className="text-[8px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: sectionColor }}>{group.section.title}</span>
                <div className="h-px flex-1" style={{ backgroundColor: sectionColor + "30" }} />
              </div>
            )}
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {group.fields.map((field: any, fi: number) => {
                const span = Math.min(field.columnSpan || 1, cols);
                return (
                  <div key={fi} className="border border-dashed border-gray-200 rounded p-1 bg-gray-50/50" style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}>
                    <div className="flex items-center gap-0.5">
                      <span className="text-[7px] text-gray-500 truncate">{field.label}</span>
                      {field.isRequired && <span className="text-red-400 text-[7px]">*</span>}
                    </div>
                    <div className="mt-0.5 h-3 rounded bg-gray-100 border border-gray-200" />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="border-t pt-1 space-y-0.5">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded border border-gray-300" /><span className="text-[7px] text-gray-400">GDPR</span></div>
      </div>
      <div className="rounded h-5 flex items-center justify-center text-white text-[8px] font-semibold" style={{ backgroundColor: brandColor }}>Odoslať</div>
    </div>
  );

  const renderHeader = (compact?: boolean) => (
    <div className={`text-center ${compact ? "py-2 px-3" : "py-3 px-4"}`} style={{ backgroundColor: brandColor }}>
      <div className={`font-bold ${compact ? "text-[9px]" : "text-[10px]"} mb-0.5`} style={{ color: textColor }}>{formData.headerTitle || "Mám záujem o odber"}</div>
      {formData.headerSubtitle && <div className="text-[7px] leading-tight" style={{ color: textColor + "cc" }}>{formData.headerSubtitle}</div>}
    </div>
  );

  if (layout === "minimal") {
    return (
      <div className="rounded-xl overflow-hidden border bg-white">
        <div className="p-3">
          <div className="text-center mb-2">
            <div className="font-bold text-[10px] mb-0.5" style={{ color: brandColor }}>{formData.headerTitle || "Mám záujem o odber"}</div>
            {formData.headerSubtitle && <div className="text-[7px] text-gray-500 leading-tight">{formData.headerSubtitle}</div>}
          </div>
          {renderFields()}
        </div>
      </div>
    );
  }

  if (layout === "split") {
    return (
      <div className="rounded-xl overflow-hidden border flex" style={{ backgroundColor: bgColor }}>
        <div className="w-1/3 p-2 flex flex-col justify-center" style={{ backgroundColor: brandColor }}>
          <div className="font-bold text-[8px] mb-1" style={{ color: textColor }}>{formData.headerTitle || "Mám záujem"}</div>
          {formData.headerSubtitle && <div className="text-[6px] leading-tight" style={{ color: textColor + "bb" }}>{formData.headerSubtitle}</div>}
        </div>
        <div className="flex-1 bg-white p-2">
          {renderFields()}
        </div>
      </div>
    );
  }

  if (layout === "card") {
    return (
      <div className="rounded-xl overflow-hidden border p-3" style={{ backgroundColor: brandColor + "15" }}>
        <div className="bg-white rounded-lg shadow-sm p-2.5 space-y-2">
          <div className="text-center">
            <div className="font-bold text-[10px]" style={{ color: brandColor }}>{formData.headerTitle || "Mám záujem o odber"}</div>
            {formData.headerSubtitle && <div className="text-[7px] text-gray-500">{formData.headerSubtitle}</div>}
          </div>
          {renderFields()}
        </div>
      </div>
    );
  }

  if (layout === "hero") {
    return (
      <div className="rounded-xl overflow-hidden border" style={{ backgroundColor: bgColor }}>
        <div className="py-5 px-4 text-center" style={{ backgroundColor: brandColor }}>
          <div className="font-bold text-xs mb-1" style={{ color: textColor }}>{formData.headerTitle || "Mám záujem o odber"}</div>
          {formData.headerSubtitle && <div className="text-[8px] leading-tight" style={{ color: textColor + "cc" }}>{formData.headerSubtitle}</div>}
          {formData.contactInfo && <div className="text-[7px] mt-1" style={{ color: textColor + "88" }}>{formData.contactInfo}</div>}
        </div>
        <div className="bg-white mx-2 -mt-2 rounded-lg shadow-sm mb-2 p-2.5">
          {renderFields()}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border" style={{ backgroundColor: bgColor }}>
      {renderHeader()}
      <div className="bg-white mx-2 -mt-1.5 rounded-lg shadow-sm mb-2 p-2.5">
        {renderFields()}
      </div>
    </div>
  );
}

function ConfirmEmailPreview({ formData, editSections, editFields }: { formData: any; editSections: any[]; editFields: any[] }) {
  const brandColor = formData.brandColor || "#16a34a";
  const emailLayout = formData.confirmEmailLayout || "modern";
  const greeting = (formData.confirmEmailGreeting || "Dobrý deň p. {{priezvisko}},")
    .replace(/\{\{priezvisko\}\}/g, "Nováková").replace(/\{\{meno\}\}/g, "Jana").replace(/\{\{email\}\}/g, "jana@example.com");
  const bodyText = (formData.confirmEmailBody || "ďakujeme za Váš záujem. Čoskoro Vás budeme kontaktovať.")
    .replace(/\{\{priezvisko\}\}/g, "Nováková").replace(/\{\{meno\}\}/g, "Jana").replace(/\{\{email\}\}/g, "jana@example.com");
  const footerText = formData.confirmEmailFooter || "V prípade akýchkoľvek otázok nás neváhajte kontaktovať.";
  const signatureText = formData.confirmEmailSignature || "Cord Blood Center";
  const title = formData.headerTitle || "Potvrdenie registrácie";

  const sampleData: Record<string, string> = {};
  editFields.forEach((f: any) => {
    const key = f.customerField || f.label;
    if (f.fieldType === "date") sampleData[key] = "15.06.2026";
    else if (f.fieldType === "email" || f.customerField === "email") sampleData[key] = "jana@example.com";
    else if (f.fieldType === "tel" || f.customerField === "phone" || f.customerField === "mobile") sampleData[key] = "+421 900 123 456";
    else if (f.customerField === "firstName") sampleData[key] = "Jana";
    else if (f.customerField === "lastName") sampleData[key] = "Nováková";
    else sampleData[key] = "vzorová hodnota";
  });

  const sectionMap = new Map(editSections.map((s: any) => [s.id, s]));
  const grouped: Record<string, any[]> = {};
  const sorted = [...editFields].sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
  for (const field of sorted) {
    const key = field.sectionId || "__none";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(field);
  }

  const renderDataTable = () => {
    if (formData.confirmEmailShowData === false) return null;
    return (
      <div style={{ margin: "20px 0", padding: "16px", background: "#f9fafb", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
        <p style={{ margin: "0 0 10px 0", color: "#6b7280", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Kópia vyplnených údajov</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {Object.entries(grouped).map(([secId, secFields]) => {
              const sec = sectionMap.get(secId);
              return (
                <Fragment key={secId}>{sec?.title && (
                  <tr><td colSpan={2} style={{ padding: "10px 0 6px 0", borderBottom: `2px solid ${brandColor}22` }}>
                    <strong style={{ color: brandColor, textTransform: "uppercase", fontSize: "9px", letterSpacing: "1px" }}>{sec.title}</strong>
                  </td></tr>
                )}
                {secFields.map((field: any) => {
                  const val = sampleData[field.customerField || field.label] || "vzorová hodnota";
                  return (
                    <tr key={field._key || field.id}>
                      <td style={{ padding: "4px 8px 4px 0", color: "#6b7280", fontSize: "11px", whiteSpace: "nowrap", verticalAlign: "top" }}>{field.label}</td>
                      <td style={{ padding: "4px 0", color: "#111827", fontSize: "11px" }}>{val}</td>
                    </tr>
                  );
                })}</Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFooter = () => (
    <>
      <p style={{ margin: "20px 0 0 0", color: "#6b7280", fontSize: "11px", lineHeight: 1.6 }}>{footerText}</p>
      <div style={{ margin: "16px 0 0 0", padding: "12px 0 0 0", borderTop: "1px solid #e5e7eb" }}>
        <p style={{ margin: 0, color: "#111827", fontSize: "11px", fontWeight: 600 }}>{signatureText}</p>
      </div>
    </>
  );

  const renderCopyright = () => (
    <p style={{ margin: "12px 0 0 0", textAlign: "center", color: "#9ca3af", fontSize: "9px" }}>&copy; {new Date().getFullYear()} {signatureText}. Tento e-mail bol odoslaný automaticky.</p>
  );

  if (emailLayout === "minimal") {
    return (
      <div className="border rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: "#f3f4f6" }}>
        <div className="p-4">
          <div className="max-w-[520px] mx-auto">
            <div style={{ background: "#fff", padding: "28px" }}>
              <h2 style={{ margin: "0 0 20px 0", color: brandColor, fontSize: "16px", fontWeight: 700, borderBottom: `2px solid ${brandColor}`, paddingBottom: "10px" }}>{title}</h2>
              <p style={{ margin: "0 0 12px 0", color: "#111827", fontSize: "13px", lineHeight: 1.6 }}>{greeting}</p>
              <p style={{ margin: "0 0 20px 0", color: "#374151", fontSize: "12px", lineHeight: 1.7 }}>{bodyText}</p>
              {renderDataTable()}{renderFooter()}
            </div>
            {renderCopyright()}
          </div>
        </div>
      </div>
    );
  }

  if (emailLayout === "sidebar") {
    return (
      <div className="border rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: "#f3f4f6" }}>
        <div className="p-4">
          <div className="max-w-[520px] mx-auto flex">
            <div style={{ width: "6px", background: brandColor, borderRadius: "6px 0 0 6px", flexShrink: 0 }} />
            <div style={{ background: "#fff", padding: "28px", borderRadius: "0 6px 6px 0", flex: 1 }}>
              <p style={{ margin: "0 0 4px 0", color: brandColor, fontSize: "9px", textTransform: "uppercase", letterSpacing: "2px", fontWeight: 600 }}>{signatureText}</p>
              <h2 style={{ margin: "0 0 20px 0", color: "#111827", fontSize: "16px", fontWeight: 700 }}>{title}</h2>
              <p style={{ margin: "0 0 12px 0", color: "#111827", fontSize: "13px", lineHeight: 1.6 }}>{greeting}</p>
              <p style={{ margin: "0 0 20px 0", color: "#374151", fontSize: "12px", lineHeight: 1.7 }}>{bodyText}</p>
              {renderDataTable()}{renderFooter()}
            </div>
          </div>
          {renderCopyright()}
        </div>
      </div>
    );
  }

  if (emailLayout === "elegant") {
    return (
      <div className="border rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: "#f3f4f6" }}>
        <div className="p-4">
          <div className="max-w-[520px] mx-auto">
            <div style={{ padding: "20px 28px", textAlign: "center" }}>
              <p style={{ margin: 0, color: brandColor, fontSize: "10px", textTransform: "uppercase", letterSpacing: "3px", fontWeight: 600 }}>{signatureText}</p>
            </div>
            <div style={{ height: "1px", background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`, margin: "0 20px" }} />
            <div style={{ background: "#fff", padding: "28px" }}>
              <h2 style={{ margin: "0 0 20px 0", color: "#111827", fontSize: "17px", fontWeight: 300, textAlign: "center" }}>{title}</h2>
              <p style={{ margin: "0 0 12px 0", color: "#111827", fontSize: "13px", lineHeight: 1.6 }}>{greeting}</p>
              <p style={{ margin: "0 0 20px 0", color: "#374151", fontSize: "12px", lineHeight: 1.7 }}>{bodyText}</p>
              {renderDataTable()}{renderFooter()}
            </div>
            <div style={{ height: "1px", background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`, margin: "0 20px" }} />
            {renderCopyright()}
          </div>
        </div>
      </div>
    );
  }

  if (emailLayout === "bold") {
    return (
      <div className="border rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: "#f3f4f6" }}>
        <div className="p-4">
          <div className="max-w-[520px] mx-auto">
            <div style={{ background: brandColor, padding: "32px 28px", borderRadius: "12px 12px 0 0", textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px 0", color: "#fff", fontSize: "18px", fontWeight: 800 }}>{title}</h2>
              <p style={{ margin: 0, color: "#ffffffdd", fontSize: "12px" }}>{greeting}</p>
            </div>
            <div style={{ background: "#fff", padding: "28px", borderRadius: "0 0 12px 12px" }}>
              <p style={{ margin: "0 0 20px 0", color: "#374151", fontSize: "12px", lineHeight: 1.7 }}>{bodyText}</p>
              {renderDataTable()}{renderFooter()}
            </div>
            {renderCopyright()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: "#f3f4f6" }}>
      <div className="p-4">
        <div className="max-w-[520px] mx-auto">
          <div style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)`, padding: "24px 28px", borderRadius: "12px 12px 0 0", textAlign: "center" }}>
            <h2 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: 700 }}>{title}</h2>
          </div>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "0 0 12px 12px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
            <p style={{ margin: "0 0 12px 0", color: "#111827", fontSize: "13px", lineHeight: 1.6 }}>{greeting}</p>
            <p style={{ margin: "0 0 20px 0", color: "#374151", fontSize: "12px", lineHeight: 1.7 }}>{bodyText}</p>
            {renderDataTable()}{renderFooter()}
          </div>
          {renderCopyright()}
        </div>
      </div>
    </div>
  );
}

function FormEditorSheet({ form, onClose }: { form: WebForm; onClose: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<any>({});
  const [editFields, setEditFields] = useState<any[]>([]);
  const [editSections, setEditSections] = useState<any[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: formDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/web-forms", form.id],
    staleTime: Infinity,
  });

  useEffect(() => {
    if (formDetail && !hydrated) {
      const { sections, fields, id, createdAt, updatedAt, createdBy, ...editableData } = formDetail;
      setFormData(editableData);
      setEditSections((sections || []).map((s: any) => ({ ...s, columns: s.columns || 2 })));
      setEditFields((fields || []).map((f: any, i: number) => ({
        ...f,
        columnSpan: f.columnSpan || 1,
        _key: f.id || `field-${Date.now()}-${i}`,
      })));
      setHydrated(true);
    }
  }, [formDetail, hydrated]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/web-forms/${form.id}`, data);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/web-forms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/web-forms", form.id] });
      toast({ title: "Formulár uložený" });
      onClose();
    },
    onError: (e: any) => {
      setSaveError(e.message);
      toast({ title: "Chyba pri ukladaní", description: e.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    setSaveError(null);
    const sectionColMap = new Map(editSections.map((s: any) => [s.id, s.columns || 2]));

    let sortOrderCounter = 0;
    const sortedSections = [...editSections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const normalizedFields: any[] = [];

    for (const sec of sortedSections) {
      const secFields = editFields
        .filter(f => f.sectionId === sec.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      for (const f of secFields) {
        const { _key, _globalIdx, id: _fId, ...rest } = f;
        const maxCols = sectionColMap.get(f.sectionId) || 2;
        normalizedFields.push({ ...rest, sortOrder: sortOrderCounter++, columnSpan: Math.min(f.columnSpan || 1, maxCols) });
      }
    }

    const orphans = editFields.filter(f => !f.sectionId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const f of orphans) {
      const { _key, _globalIdx, id: _fId, ...rest } = f;
      normalizedFields.push({ ...rest, sortOrder: sortOrderCounter++, columnSpan: Math.min(f.columnSpan || 1, 2) });
    }

    const cleanSections = editSections.map(s => {
      const cleaned: any = { ...s };
      return cleaned;
    });

    updateMutation.mutate({
      ...formData,
      sections: cleanSections,
      fields: normalizedFields,
    });
  };

  if (detailLoading || !hydrated) {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="sm:max-w-[1100px]">
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[1200px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upraviť formulár: {form.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <div className="flex gap-5">
            <div className="flex-1 min-w-0 space-y-6">
          <Tabs defaultValue="builder">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="builder" data-testid="tab-builder">
                <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Štruktúra
              </TabsTrigger>
              <TabsTrigger value="design" data-testid="tab-design">
                <Palette className="h-3.5 w-3.5 mr-1" /> Dizajn
              </TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">
                <Settings className="h-3.5 w-3.5 mr-1" /> Základné
              </TabsTrigger>
              <TabsTrigger value="texts" data-testid="tab-texts">Texty & GDPR</TabsTrigger>
              <TabsTrigger value="email" data-testid="tab-email">
                <Mail className="h-3.5 w-3.5 mr-1" /> Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="builder" className="mt-4">
              <SectionFieldsBuilder
                editSections={editSections}
                setEditSections={setEditSections}
                editFields={editFields}
                setEditFields={setEditFields}
              />
            </TabsContent>

            <TabsContent value="design" className="mt-4 space-y-6">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Layout stránky</h4>
                <div className="grid grid-cols-5 gap-2">
                  {FORM_LAYOUTS.map(layout => (
                    <button
                      key={layout.value}
                      type="button"
                      className={`p-2 rounded-lg border-2 text-center transition-all hover:shadow-md ${formData.formLayout === layout.value || (!formData.formLayout && layout.value === "standard") ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                      onClick={() => setFormData({ ...formData, formLayout: layout.value })}
                      data-testid={`layout-${layout.value}`}
                    >
                      <LayoutIcon layout={layout.value} isActive={formData.formLayout === layout.value || (!formData.formLayout && layout.value === "standard")} />
                      <div className="text-[10px] font-medium mt-1.5">{layout.label}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {FORM_LAYOUTS.find(l => l.value === (formData.formLayout || "standard"))?.desc}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Farby</h4>
                <div className="grid grid-cols-3 gap-3">
                  <ColorInput label="Hlavná farba (header)" value={formData.brandColor || "#16a34a"} onChange={v => setFormData({ ...formData, brandColor: v })} />
                  <ColorInput label="Farba písma (header)" value={formData.textColor || "#ffffff"} onChange={v => setFormData({ ...formData, textColor: v })} />
                  <ColorInput label="Farba nadpisov sekcií" value={formData.sectionColor || formData.brandColor || "#16a34a"} onChange={v => setFormData({ ...formData, sectionColor: v })} />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <ColorInput label="Pozadie stránky" value={formData.bgColor || "#f3f4f6"} onChange={v => setFormData({ ...formData, bgColor: v })} />
                  <ColorInput label="Farba nadpisu" value={formData.headingColor || "#ffffff"} onChange={v => setFormData({ ...formData, headingColor: v })} />
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Šírka formulára</Label>
                    <Select value={formData.formWidth || "3xl"} onValueChange={v => setFormData({ ...formData, formWidth: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{FORM_WIDTHS.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5" /> Typografia
                </h4>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Nadpis formulára</Label>
                    <FontStyleEditor prefix="title" formData={formData} setFormData={setFormData} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Podnadpis</Label>
                    <FontStyleEditor prefix="subtitle" formData={formData} setFormData={setFormData} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Nadpisy sekcií</Label>
                    <FontStyleEditor prefix="section" formData={formData} setFormData={setFormData} showFamily={false} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Popisky polí</Label>
                    <FontStyleEditor prefix="label" formData={formData} setFormData={setFormData} showFamily={false} showItalic={false} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Tlačidlo odoslať</Label>
                    <FontStyleEditor prefix="button" formData={formData} setFormData={setFormData} showFamily={false} showItalic={false} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Názov formulára</Label>
                  <Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} data-testid="input-form-name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Slug (URL)</Label>
                  <Input value={formData.slug || ""} onChange={e => setFormData({ ...formData, slug: e.target.value })} data-testid="input-form-slug" />
                </div>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Krajina</Label>
                  <Select value={formData.countryCode} onValueChange={v => setFormData({ ...formData, countryCode: v })}>
                    <SelectTrigger data-testid="select-form-country"><SelectValue /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Jazyk</Label>
                  <Select value={formData.language || "sk"} onValueChange={v => setFormData({ ...formData, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sk">Slovenčina</SelectItem>
                      <SelectItem value="cs">Čeština</SelectItem>
                      <SelectItem value="hu">Maďarčina</SelectItem>
                      <SelectItem value="ro">Rumunčina</SelectItem>
                      <SelectItem value="it">Taliančina</SelectItem>
                      <SelectItem value="de">Nemčina</SelectItem>
                      <SelectItem value="en">Angličtina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="texts" className="space-y-4 mt-4">
              <div className="space-y-1">
                <Label className="text-xs">Nadpis formulára</Label>
                <Input value={formData.headerTitle || ""} onChange={e => setFormData({ ...formData, headerTitle: e.target.value })} data-testid="input-header-title" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Podnadpis</Label>
                <Textarea value={formData.headerSubtitle || ""} onChange={e => setFormData({ ...formData, headerSubtitle: e.target.value })} rows={2} data-testid="input-header-subtitle" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kontaktné informácie (pod nadpisom)</Label>
                <Input value={formData.contactInfo || ""} onChange={e => setFormData({ ...formData, contactInfo: e.target.value })} placeholder="Napr. Tel.: +421 2 321 654 00 | info@cordbloodcenter.sk" data-testid="input-contact-info" />
              </div>
              <Separator />
              <div className="space-y-1">
                <Label className="text-xs">GDPR text</Label>
                <Textarea value={formData.gdprText || ""} onChange={e => setFormData({ ...formData, gdprText: e.target.value })} rows={3} data-testid="input-gdpr-text" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">GDPR marketing text</Label>
                <Textarea value={formData.gdprMarketingText || ""} onChange={e => setFormData({ ...formData, gdprMarketingText: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">GDPR tehotenstvo text</Label>
                <Textarea value={formData.gdprPregnancyText || ""} onChange={e => setFormData({ ...formData, gdprPregnancyText: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Správa po odoslaní</Label>
                <Textarea value={formData.successMessage || ""} onChange={e => setFormData({ ...formData, successMessage: e.target.value })} rows={2} />
              </div>
            </TabsContent>

            <TabsContent value="email" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Potvrdzujúci email</h4>
                  <p className="text-[11px] text-muted-foreground">Email sa odošle zákazníkovi po odoslaní formulára</p>
                </div>
                <Switch
                  checked={formData.confirmEmailEnabled !== false}
                  onCheckedChange={v => setFormData({ ...formData, confirmEmailEnabled: v })}
                  data-testid="switch-confirm-email"
                />
              </div>
              {formData.confirmEmailEnabled !== false && (
                <>
                  <Separator />
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-700">
                      Dostupné premenné: <code className="bg-blue-100 px-1 rounded">{"{{meno}}"}</code> <code className="bg-blue-100 px-1 rounded">{"{{priezvisko}}"}</code> <code className="bg-blue-100 px-1 rounded">{"{{email}}"}</code>. Email sa odosiela z emailu nastaveného v Billing Company pre danú krajinu.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">Layout emailu</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {([
                        { value: "modern", label: "Modern", desc: "Gradient header + biely obsah" },
                        { value: "minimal", label: "Minimal", desc: "Čistý bez headeru" },
                        { value: "sidebar", label: "Sidebar", desc: "Farebný pruh vľavo" },
                        { value: "elegant", label: "Elegant", desc: "Jemné linky, ľahký štýl" },
                        { value: "bold", label: "Bold", desc: "Veľký farebný header" },
                      ] as const).map(l => (
                        <button
                          key={l.value}
                          type="button"
                          className={`p-2 rounded-lg border-2 text-center transition-all hover:shadow-md ${(formData.confirmEmailLayout || "modern") === l.value ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                          onClick={() => setFormData({ ...formData, confirmEmailLayout: l.value })}
                          data-testid={`email-layout-${l.value}`}
                        >
                          <EmailLayoutIcon layout={l.value} brandColor={formData.brandColor || "#16a34a"} isActive={(formData.confirmEmailLayout || "modern") === l.value} />
                          <div className="text-[10px] font-medium mt-1">{l.label}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {({
                        modern: "Gradient header s logom a bielym obsahom",
                        minimal: "Čistý dizajn bez headeru, iba farebný nadpis",
                        sidebar: "Farebný pruh vľavo s elegantným obsahom",
                        elegant: "Jemné gradientové linky, ľahký štýl",
                        bold: "Veľký farebný header s pozdravom",
                      } as Record<string, string>)[formData.confirmEmailLayout || "modern"]}
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-xs">Predmet emailu</Label>
                    <Input
                      value={formData.confirmEmailSubject || ""}
                      onChange={e => setFormData({ ...formData, confirmEmailSubject: e.target.value })}
                      placeholder="Potvrdenie registrácie - Cord Blood Center"
                      data-testid="input-email-subject"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pozdrav</Label>
                    <Input
                      value={formData.confirmEmailGreeting || ""}
                      onChange={e => setFormData({ ...formData, confirmEmailGreeting: e.target.value })}
                      placeholder="Dobrý deň p. {{priezvisko}},"
                      data-testid="input-email-greeting"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hlavný text emailu</Label>
                    <Textarea
                      value={formData.confirmEmailBody || ""}
                      onChange={e => setFormData({ ...formData, confirmEmailBody: e.target.value })}
                      placeholder="ďakujeme za Váš záujem. Čoskoro Vás budeme kontaktovať."
                      rows={3}
                      data-testid="input-email-body"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">Zobraziť kópiu vyplnených údajov</Label>
                      <p className="text-[10px] text-muted-foreground">Zákazník uvidí v emaili zhrnutie odoslaných polí</p>
                    </div>
                    <Switch
                      checked={formData.confirmEmailShowData !== false}
                      onCheckedChange={v => setFormData({ ...formData, confirmEmailShowData: v })}
                      data-testid="switch-email-show-data"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Päta emailu</Label>
                    <Textarea
                      value={formData.confirmEmailFooter || ""}
                      onChange={e => setFormData({ ...formData, confirmEmailFooter: e.target.value })}
                      placeholder="V prípade akýchkoľvek otázok nás neváhajte kontaktovať."
                      rows={2}
                      data-testid="input-email-footer"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Podpis</Label>
                    <Input
                      value={formData.confirmEmailSignature || ""}
                      onChange={e => setFormData({ ...formData, confirmEmailSignature: e.target.value })}
                      placeholder="Cord Blood Center"
                      data-testid="input-email-signature"
                    />
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Náhľad emailu</h4>
                    <ConfirmEmailPreview formData={formData} editSections={editSections} editFields={editFields} />
                  </div>
                </>
              )}
            </TabsContent>

          </Tabs>
          </div>

            <div className="w-[260px] shrink-0 sticky top-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Náhľad</span>
                  <Badge variant="outline" className="text-[9px]">
                    {FORM_LAYOUTS.find(l => l.value === (formData.formLayout || "standard"))?.label || "Štandard"}
                  </Badge>
                </div>
                <LayoutPreview sections={editSections} fields={editFields} formData={formData} />
              </div>
            </div>
          </div>

          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mt-4">
              Chyba: {saveError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
            <Button variant="outline" onClick={onClose}>Zrušiť</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="btn-save-form">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Uložiť
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SubmissionsSheet({ formId, onClose }: { formId: string; onClose: () => void }) {
  const { data: submissions = [], isLoading } = useQuery<WebFormSubmission[]>({
    queryKey: ["/api/web-forms", formId, "submissions"],
    queryFn: async () => {
      const res = await fetch(`/api/web-forms/${formId}/submissions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Žiadosti z formulára ({submissions.length})</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">Žiadne žiadosti</div>
          ) : (
            <div className="space-y-2">
              {submissions.map(sub => {
                const data = JSON.parse(sub.data || "{}");
                return (
                  <div key={sub.id} className="border rounded-lg p-3 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedSubmission(sub)} data-testid={`submission-${sub.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{data.firstName} {data.lastName}</span>
                        <span className="text-xs text-muted-foreground">{data.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sub.isNewCustomer ? (
                          <Badge variant="default" className="text-[10px]">Nová klientka</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Existujúca</Badge>
                        )}
                        {sub.isOtpVerified && <Badge variant="outline" className="text-[10px] border-green-300 text-green-700">OTP</Badge>}
                        <Badge variant="outline" className="text-[10px]">{sub.status}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span><Clock className="h-3 w-3 inline mr-1" />{new Date(sub.createdAt).toLocaleString("sk")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedSubmission && (
          <Dialog open onOpenChange={(o) => !o && setSelectedSubmission(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Detail žiadosti</DialogTitle></DialogHeader>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {Object.entries(JSON.parse(selectedSubmission.data || "{}")).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm border-b pb-1">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-medium">{String(value || "—")}</span>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </SheetContent>
    </Sheet>
  );
}
