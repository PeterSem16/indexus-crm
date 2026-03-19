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
  Columns, LayoutGrid, Maximize2, Palette, Type, Italic, Pencil, Mail, Info, Send,
  BarChart3, TrendingUp, UserPlus, UserCheck, ShieldCheck, Calendar
} from "lucide-react";
import type { WebForm, WebFormSubmission } from "@shared/schema";

const COUNTRIES_DATA = [
  { code: "SK", nameKey: "countrySK" as const, lang: "sk", flag: "🇸🇰" },
  { code: "CZ", nameKey: "countryCZ" as const, lang: "cs", flag: "🇨🇿" },
  { code: "HU", nameKey: "countryHU" as const, lang: "hu", flag: "🇭🇺" },
  { code: "RO", nameKey: "countryRO" as const, lang: "ro", flag: "🇷🇴" },
  { code: "IT", nameKey: "countryIT" as const, lang: "it", flag: "🇮🇹" },
  { code: "DE", nameKey: "countryDE" as const, lang: "de", flag: "🇩🇪" },
  { code: "GB", nameKey: "countryGB" as const, lang: "en", flag: "🇬🇧" },
];

const COUNTRY_NAMES: Record<string, Record<string, string>> = {
  SK: { sk: "Slovensko", cs: "Slovensko", en: "Slovakia", hu: "Szlovákia", ro: "Slovacia", it: "Slovacchia", de: "Slowakei" },
  CZ: { sk: "Česko", cs: "Česko", en: "Czech Republic", hu: "Csehország", ro: "Cehia", it: "Repubblica Ceca", de: "Tschechien" },
  HU: { sk: "Maďarsko", cs: "Maďarsko", en: "Hungary", hu: "Magyarország", ro: "Ungaria", it: "Ungheria", de: "Ungarn" },
  RO: { sk: "Rumunsko", cs: "Rumunsko", en: "Romania", hu: "Románia", ro: "România", it: "Romania", de: "Rumänien" },
  IT: { sk: "Taliansko", cs: "Itálie", en: "Italy", hu: "Olaszország", ro: "Italia", it: "Italia", de: "Italien" },
  DE: { sk: "Nemecko", cs: "Německo", en: "Germany", hu: "Németország", ro: "Germania", it: "Germania", de: "Deutschland" },
  GB: { sk: "UK", cs: "UK", en: "UK", hu: "UK", ro: "UK", it: "UK", de: "UK" },
};

function getCountryName(code: string, locale: string): string {
  return COUNTRY_NAMES[code]?.[locale] || COUNTRY_NAMES[code]?.en || code;
}

function getFieldTypes(t: any) {
  return [
    { value: "text", label: t.webForms.fieldText },
    { value: "email", label: t.webForms.fieldEmail },
    { value: "tel", label: t.webForms.fieldPhone },
    { value: "date", label: t.webForms.fieldDate },
    { value: "number", label: t.webForms.fieldNumber },
    { value: "checkbox", label: t.webForms.fieldCheckbox },
    { value: "select", label: t.webForms.fieldSelect },
    { value: "select_insurance", label: t.webForms.fieldInsurance },
    { value: "select_hospital", label: t.webForms.fieldHospital },
    { value: "select_product", label: t.webForms.fieldProduct },
    { value: "select_source", label: t.webForms.fieldSource },
    { value: "select_payment", label: t.webForms.fieldPayment },
    { value: "textarea", label: t.webForms.fieldTextarea },
  ];
}

function getCustomerFields(t: any) {
  return [
    { key: "firstName", label: t.webForms.firstName, type: "text", section: "personal" },
    { key: "lastName", label: t.webForms.lastName, type: "text", section: "personal" },
    { key: "maidenName", label: t.webForms.maidenName, type: "text", section: "personal" },
    { key: "titleBefore", label: t.webForms.titleBefore, type: "text", section: "personal" },
    { key: "titleAfter", label: t.webForms.titleAfter, type: "text", section: "personal" },
    { key: "email", label: t.webForms.email, type: "email", section: "personal" },
    { key: "phone", label: t.webForms.phone, type: "tel", section: "personal" },
    { key: "mobile", label: t.webForms.mobile, type: "tel", section: "personal" },
    { key: "dateOfBirth", label: t.webForms.dateOfBirth, type: "date", section: "personal" },
    { key: "nationalId", label: t.webForms.nationalId, type: "text", section: "personal" },
    { key: "idCardNumber", label: t.webForms.idCardNumber, type: "text", section: "personal" },
    { key: "address", label: t.webForms.streetAndNumber, type: "text", section: "address" },
    { key: "city", label: t.webForms.city, type: "text", section: "address" },
    { key: "postalCode", label: t.webForms.postalCode, type: "text", section: "address" },
    { key: "region", label: t.webForms.region, type: "text", section: "address" },
    { key: "healthInsuranceId", label: t.webForms.healthInsurance, type: "select_insurance", section: "medical" },
    { key: "bankAccount", label: t.webForms.iban, type: "text", section: "banking" },
    { key: "bankName", label: t.webForms.bankName, type: "text", section: "banking" },
    { key: "bankSwift", label: t.webForms.swift, type: "text", section: "banking" },
    { key: "useCorrespondenceAddress", label: t.webForms.correspondenceAddr, type: "checkbox", section: "address" },
    { key: "corrName", label: t.webForms.corrRecipient, type: "text", section: "correspondence" },
    { key: "corrAddress", label: t.webForms.corrStreet, type: "text", section: "correspondence" },
    { key: "corrCity", label: t.webForms.corrCity, type: "text", section: "correspondence" },
    { key: "corrPostalCode", label: t.webForms.corrPostalCode, type: "text", section: "correspondence" },
    { key: "corrRegion", label: t.webForms.corrRegion, type: "text", section: "correspondence" },
    { key: "corrCountry", label: t.webForms.corrCountry, type: "text", section: "correspondence" },
    { key: "newsletter", label: t.webForms.newsletterLabel, type: "checkbox", section: "consent" },
  ];
}

function getSpecialFields(t: any) {
  return [
    { key: "productSetId", label: t.webForms.productType, type: "select_product", section: "delivery" },
    { key: "hospitalId", label: t.webForms.hospital, type: "select_hospital", section: "delivery" },
    { key: "expectedDeliveryDate", label: t.webForms.expectedDueDate, type: "date", section: "delivery" },
    { key: "howDidYouHear", label: t.webForms.howDidYouHear, type: "select_source", section: "source" },
    { key: "paymentMethod", label: t.webForms.paymentMethod, type: "select_payment", section: "delivery" },
  ];
}

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

function getFormWidths(t: any) {
  return [
    { value: "xl", label: t.webForms.widthNarrow },
    { value: "2xl", label: t.webForms.widthMedium },
    { value: "3xl", label: t.webForms.widthStandard },
    { value: "4xl", label: t.webForms.widthWide },
    { value: "5xl", label: t.webForms.widthVeryWide },
    { value: "6xl", label: t.webForms.widthThreeQuarter },
    { value: "full", label: t.webForms.widthFull },
  ];
}

function getFormLayouts(t: any) {
  return [
    { value: "standard", label: t.webForms.layoutStandard, desc: t.webForms.layoutStandardDesc },
    { value: "minimal", label: t.webForms.layoutMinimal, desc: t.webForms.layoutMinimalDesc },
    { value: "split", label: t.webForms.layoutSplit, desc: t.webForms.layoutSplitDesc },
    { value: "card", label: t.webForms.layoutCard, desc: t.webForms.layoutCardDesc },
    { value: "hero", label: t.webForms.layoutHero, desc: t.webForms.layoutHeroDesc },
  ];
}

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

function getFontWeights(t: any) {
  return [
    { value: "light", label: t.webForms.weightThin },
    { value: "normal", label: t.webForms.weightNormal },
    { value: "medium", label: t.webForms.weightMedium },
    { value: "semibold", label: t.webForms.weightSemibold },
    { value: "bold", label: t.webForms.weightBold },
    { value: "extrabold", label: t.webForms.weightExtrabold },
  ];
}

function getFontFamilies(t: any) {
  return [
    { value: "inherit", label: t.webForms.fontDefault },
    { value: "'Inter', sans-serif", label: "Inter" },
    { value: "'Georgia', serif", label: "Georgia (serif)" },
    { value: "'Arial', sans-serif", label: "Arial" },
    { value: "'Playfair Display', serif", label: "Playfair Display" },
    { value: "'Roboto', sans-serif", label: "Roboto" },
    { value: "'Open Sans', sans-serif", label: "Open Sans" },
    { value: "'Lato', sans-serif", label: "Lato" },
    { value: "'Montserrat', sans-serif", label: "Montserrat" },
  ];
}

function FontStyleEditor({ prefix, formData, setFormData, showFamily, showItalic }: {
  prefix: string; formData: any; setFormData: (d: any) => void;
  showFamily?: boolean; showItalic?: boolean;
}) {
  const { t } = useI18n();
  const FONT_WEIGHTS = getFontWeights(t);
  const FONT_FAMILIES = getFontFamilies(t);
  const sizeKey = `${prefix}FontSize`;
  const weightKey = `${prefix}FontWeight`;
  const styleKey = `${prefix}FontStyle`;
  const familyKey = `${prefix}FontFamily`;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">{t.webForms.fontSize}</Label>
        <Select value={formData[sizeKey] || "sm"} onValueChange={v => setFormData({ ...formData, [sizeKey]: v })}>
          <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{FONT_SIZES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">{t.webForms.fontWeight}</Label>
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
          <Label className="text-[10px] text-muted-foreground">{t.webForms.fontLabel}</Label>
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
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [editingForm, setEditingForm] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingSubmissions, setViewingSubmissions] = useState<string | null>(null);
  const [embedDialogForm, setEmbedDialogForm] = useState<any>(null);
  const [previewFormSlug, setPreviewFormSlug] = useState<string | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<string>("30");
  const [showStats, setShowStats] = useState(true);

  const { data: forms = [], isLoading } = useQuery<WebForm[]>({ queryKey: ["/api/web-forms"] });

  const { data: statsData = [] } = useQuery<any[]>({
    queryKey: ["/api/web-forms/stats"],
    queryFn: async () => {
      const res = await fetch("/api/web-forms/stats", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/web-forms", data);
      if (!res.ok) throw new Error("Failed to create form");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/web-forms"] });
      setIsCreating(false);
      toast({ title: t.webForms.formCreated });
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
      toast({ title: t.webForms.formDeleted });
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
    const country = COUNTRIES_DATA.find(c => c.code === countryCode);
    if (!country) return;
    const slug = `${countryCode.toLowerCase()}-registracia`;
    const sectionIds = DEFAULT_SECTIONS.map((_, i) => `sec-${Date.now()}-${i}`);
    const sectionsWithIds = DEFAULT_SECTIONS.map((s, i) => ({ ...s, id: sectionIds[i] }));
    const fieldsWithSectionIds = DEFAULT_FIELDS.map(({ sectionIndex, ...f }) => ({
      ...f,
      sectionId: sectionIndex !== undefined ? sectionIds[sectionIndex] : null,
    }));
    createMutation.mutate({
      name: `Registrácia - ${getCountryName(countryCode, locale)}`,
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
    toast({ title: t.webForms.copiedToClipboard });
  };

  const filteredStats = useMemo(() => {
    if (!statsData.length) return [];
    const now = new Date();
    if (statsPeriod === "all") return statsData;
    const days = parseInt(statsPeriod);
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + (days === 1 ? 0 : 0));
    cutoff.setHours(0, 0, 0, 0);
    if (days === 1) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return statsData.filter((s: any) => new Date(s.createdAt) >= today);
    }
    return statsData.filter((s: any) => new Date(s.createdAt) >= cutoff);
  }, [statsData, statsPeriod]);

  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; total: number; newClients: number; existing: number }>();
    const days = statsPeriod === "all" ? 90 : parseInt(statsPeriod);
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, total: 0, newClients: 0, existing: 0 });
    }
    for (const s of filteredStats) {
      const key = new Date(s.createdAt).toISOString().slice(0, 10);
      const entry = map.get(key);
      if (entry) {
        entry.total++;
        if (s.isNewCustomer) entry.newClients++;
        else entry.existing++;
      }
    }
    return Array.from(map.values());
  }, [filteredStats, statsPeriod]);

  const statsByForm = useMemo(() => {
    const map = new Map<string, { formName: string; count: number; newClients: number }>();
    for (const s of filteredStats) {
      const e = map.get(s.formId) || { formName: s.formName, count: 0, newClients: 0 };
      e.count++;
      if (s.isNewCustomer) e.newClients++;
      map.set(s.formId, e);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filteredStats]);

  const statsByCountry = useMemo(() => {
    const map = new Map<string, { code: string; count: number; newClients: number }>();
    for (const s of filteredStats) {
      const code = s.countryCode || "??";
      const e = map.get(code) || { code, count: 0, newClients: 0 };
      e.count++;
      if (s.isNewCustomer) e.newClients++;
      map.set(code, e);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filteredStats]);

  const totalNew = filteredStats.filter((s: any) => s.isNewCustomer).length;
  const totalExisting = filteredStats.length - totalNew;
  const totalOtp = filteredStats.filter((s: any) => s.isOtpVerified).length;
  const maxDaily = Math.max(...dailyData.map(d => d.total), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-web-forms-title">{t.webForms.title}</h1>
          <p className="text-sm text-muted-foreground">{t.webForms.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={showStats ? "default" : "outline"} size="sm" onClick={() => setShowStats(!showStats)} data-testid="btn-toggle-stats">
            <BarChart3 className="h-4 w-4 mr-1" /> {t.webForms.statsTitle}
          </Button>
          <Select onValueChange={handleCreateForm}>
            <SelectTrigger className="w-[200px]" data-testid="select-create-form">
              <Plus className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t.webForms.newForm} />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES_DATA.map(c => (
                <SelectItem key={c.code} value={c.code} data-testid={`create-form-${c.code}`}>
                  {c.flag} {getCountryName(c.code, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showStats && (
        <div className="space-y-4" data-testid="stats-panel">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t.webForms.statsSubtitle}
            </h2>
            <div className="flex gap-1">
              {[
                { value: "1", label: t.webForms.statsToday },
                { value: "7", label: t.webForms.statsLast7Days },
                { value: "30", label: t.webForms.statsLast30Days },
                { value: "all", label: t.webForms.statsAllTime },
              ].map(p => (
                <Button key={p.value} variant={statsPeriod === p.value ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setStatsPeriod(p.value)} data-testid={`btn-period-${p.value}`}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card data-testid="stat-total">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.webForms.statsTotalRegistrations}</p>
                    <p className="text-2xl font-bold">{filteredStats.length}</p>
                  </div>
                  <ClipboardList className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            <Card data-testid="stat-new">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.webForms.statsNewClients}</p>
                    <p className="text-2xl font-bold text-green-600">{totalNew}</p>
                  </div>
                  <UserPlus className="h-8 w-8 text-green-600/20" />
                </div>
              </CardContent>
            </Card>
            <Card data-testid="stat-existing">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.webForms.statsExistingClients}</p>
                    <p className="text-2xl font-bold text-blue-600">{totalExisting}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-blue-600/20" />
                </div>
              </CardContent>
            </Card>
            <Card data-testid="stat-otp">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.webForms.statsOtpVerified}</p>
                    <p className="text-2xl font-bold text-violet-600">{totalOtp}</p>
                  </div>
                  <ShieldCheck className="h-8 w-8 text-violet-600/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" data-testid="chart-daily">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t.webForms.statsDailyChart}</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredStats.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">{t.webForms.statsNoData}</div>
                ) : (
                  <div className="flex items-end gap-[2px] h-[140px]">
                    {dailyData.map((d, i) => {
                      const h = Math.max((d.total / maxDaily) * 100, d.total > 0 ? 4 : 0);
                      const newH = d.newClients > 0 ? Math.max((d.newClients / maxDaily) * 100, 2) : 0;
                      const existH = h - newH;
                      const isToday = d.date === new Date().toISOString().slice(0, 10);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end group relative" data-testid={`bar-${d.date}`}>
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border rounded px-2 py-1 text-[10px] shadow-md hidden group-hover:block whitespace-nowrap z-10">
                            <div className="font-medium">{new Date(d.date + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" })}</div>
                            <div>{d.total} {t.webForms.statsRegistrations}</div>
                            {d.newClients > 0 && <div className="text-green-600">{d.newClients} {t.webForms.statsNewClients.toLowerCase()}</div>}
                          </div>
                          <div className="w-full flex flex-col" style={{ height: `${h}%` }}>
                            {existH > 0 && <div className="w-full rounded-t-[2px] bg-blue-400/60" style={{ height: `${(existH / h) * 100}%` }} />}
                            {newH > 0 && <div className={`w-full ${existH > 0 ? '' : 'rounded-t-[2px]'} rounded-b-[2px] bg-green-500/70`} style={{ height: `${(newH / h) * 100}%` }} />}
                          </div>
                          {d.total === 0 && <div className="w-full h-[1px] bg-muted" />}
                          {isToday && <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/70" /> {t.webForms.statsNewClients}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400/60" /> {t.webForms.statsExistingClients}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card data-testid="stats-by-form">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t.webForms.statsByForm}</CardTitle>
                </CardHeader>
                <CardContent>
                  {statsByForm.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t.webForms.statsNoData}</p>
                  ) : (
                    <div className="space-y-2">
                      {statsByForm.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="truncate text-xs max-w-[70%]">{f.formName}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">{f.count}</Badge>
                            {f.newClients > 0 && <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">{f.newClients} {t.webForms.statsNewClients.toLowerCase()}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="stats-by-country">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t.webForms.statsByCountry}</CardTitle>
                </CardHeader>
                <CardContent>
                  {statsByCountry.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t.webForms.statsNoData}</p>
                  ) : (
                    <div className="space-y-2">
                      {statsByCountry.map((c, i) => {
                        const cd = COUNTRIES_DATA.find(x => x.code === c.code);
                        return (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-xs">
                              <span>{cd?.flag || "🏳️"}</span>
                              <span>{getCountryName(c.code, locale)}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">{c.count}</Badge>
                              {c.newClients > 0 && <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">{c.newClients}</Badge>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : forms.length === 0 ? (
        <Card className="py-20">
          <CardContent className="text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-2">{t.webForms.noForms}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.webForms.noFormsDesc}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map(form => {
            const country = COUNTRIES_DATA.find(c => c.code === form.countryCode);
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
                        {form.isActive ? t.webForms.active : t.webForms.inactive}
                      </Badge>
                      <Switch checked={form.isActive} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: form.id, isActive: checked })} data-testid={`switch-active-${form.id}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>{country ? getCountryName(country.code, locale) : ''} ({form.language?.toUpperCase()})</span>
                  </div>
                  <div className="text-xs bg-muted/50 rounded px-2 py-1.5 font-mono truncate" data-testid={`text-form-url-${form.id}`}>
                    {getFormUrl(form.slug)}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPreviewFormSlug(form.slug)} data-testid={`btn-preview-${form.id}`}>
                      <Eye className="h-3 w-3 mr-1" /> {t.webForms.preview}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyToClipboard(getFormUrl(form.slug))} data-testid={`btn-copy-url-${form.id}`}>
                      <Copy className="h-3 w-3 mr-1" /> URL
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEmbedDialogForm(form)} data-testid={`btn-embed-${form.id}`}>
                      <Code className="h-3 w-3 mr-1" /> Embed
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingForm(form)} data-testid={`btn-edit-${form.id}`}>
                      <Settings className="h-3 w-3 mr-1" /> {t.webForms.edit}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setViewingSubmissions(form.id)} data-testid={`btn-submissions-${form.id}`}>
                      <ClipboardList className="h-3 w-3 mr-1" /> {t.webForms.submissions}
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { if (confirm(t.webForms.confirmDelete)) deleteMutation.mutate(form.id); }} data-testid={`btn-delete-${form.id}`}>
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
                <span>{t.webForms.formPreview}</span>
                <div className="flex items-center gap-2 mr-6">
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(getFormUrl(previewFormSlug))} data-testid="btn-preview-copy-url">
                    <Copy className="h-3 w-3 mr-1" /> {t.webForms.copyUrl}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(getFormUrl(previewFormSlug), "_blank")} data-testid="btn-preview-open-new">
                    {t.webForms.newWindow}
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
          <DialogHeader><DialogTitle>{t.webForms.embedTitle}</DialogTitle></DialogHeader>
          {embedDialogForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t.webForms.iframeRecommended}</Label>
                <Textarea readOnly rows={3} className="font-mono text-xs"
                  value={`<iframe src="${getFormUrl(embedDialogForm.slug)}" width="100%" height="900" frameborder="0" style="border:none;max-width:800px;margin:0 auto;display:block"></iframe>`}
                  data-testid="textarea-embed-iframe"
                />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(`<iframe src="${getFormUrl(embedDialogForm.slug)}" width="100%" height="900" frameborder="0" style="border:none;max-width:800px;margin:0 auto;display:block"></iframe>`)} data-testid="btn-copy-iframe">
                  <Copy className="h-3 w-3 mr-1" /> {t.webForms.copy}
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t.webForms.directLink}</Label>
                <Input readOnly value={getFormUrl(embedDialogForm.slug)} className="font-mono text-xs" data-testid="input-embed-url" />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(getFormUrl(embedDialogForm.slug))} data-testid="btn-copy-direct">
                  <Copy className="h-3 w-3 mr-1" /> {t.webForms.copy}
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
  const { t } = useI18n();
  const FIELD_TYPES = getFieldTypes(t);
  const CUSTOMER_FIELDS = getCustomerFields(t);
  const SPECIAL_FIELDS = getSpecialFields(t);
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
      label: t.webForms.newField,
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
      title: t.webForms.newSection,
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
                    <SelectItem value="1">{t.webForms.col1}</SelectItem>
                    <SelectItem value="2">{t.webForms.col2}</SelectItem>
                    <SelectItem value="3">{t.webForms.col3}</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="secondary" className="text-[10px]">{sectionFields.length} {t.webForms.fieldsCount}</Badge>
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
                  {t.webForms.emptySection}
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                {availableFields.slice(0, 5).map(f => (
                  <Button key={f.key} size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => addFieldToSection(section.id, f)}>
                    <Plus className="h-2.5 w-2.5 mr-0.5" /> {f.label}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => addFieldToSection(section.id)}>
                  <Plus className="h-2.5 w-2.5 mr-0.5" /> {t.webForms.customField}
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {orphanFields.length > 0 && (
        <div className="border rounded-xl overflow-hidden border-orange-200">
          <div className="bg-orange-50 px-4 py-2.5 flex items-center gap-2">
            <span className="text-sm font-semibold text-orange-700">{t.webForms.fieldsNoSection}</span>
            <Badge variant="secondary" className="text-[10px]">{orphanFields.length}</Badge>
          </div>
          <div className="p-3 space-y-1">
            {orphanFields.map((field: any, fi: number) => (
              <div key={field._key || field.id || fi} className="flex items-center gap-2 p-2 border rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => openFieldEditor(field, field._globalIdx)}>
                <span className="text-xs font-medium flex-1">{field.label}</span>
                <Select value="_move" onValueChange={v => { if (v !== "_move") moveFieldToSection(field._globalIdx, v); }}>
                  <SelectTrigger className="h-6 w-[140px] text-[10px]"><SelectValue placeholder={t.webForms.moveToSection} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_move" disabled>{t.webForms.moveTo}</SelectItem>
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
          <Plus className="h-3 w-3 mr-1" /> {t.webForms.addSection}
        </Button>
      </div>

      {availableFields.length > 0 && (
        <div>
          <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-2">{t.webForms.availableFields}</Label>
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
              {t.webForms.editFieldTitle} {editingField?.label}
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
  const { t } = useI18n();
  const FIELD_TYPES = getFieldTypes(t);
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
          <Label className="text-xs">{t.webForms.fieldName}</Label>
          <Input value={field.label} onChange={e => setField({ ...field, label: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t.webForms.fieldType}</Label>
          <Select value={field.fieldType} onValueChange={v => setField({ ...field, fieldType: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t.webForms.sectionLabel}</Label>
          <Select value={field.sectionId || "_none"} onValueChange={v => setField({ ...field, sectionId: v === "_none" ? null : v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{t.webForms.noSection}</SelectItem>
              {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t.webForms.fieldWidth}</Label>
          <Select value={String(field.columnSpan || 1)} onValueChange={v => setField({ ...field, columnSpan: Number(v) })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t.webForms.oneCol}</SelectItem>
              {maxCols >= 2 && <SelectItem value="2">{t.webForms.twoCols}</SelectItem>}
              {maxCols >= 3 && <SelectItem value="3">{t.webForms.threeCols}</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t.webForms.placeholder}</Label>
          <Input value={field.placeholder || ""} onChange={e => setField({ ...field, placeholder: e.target.value })} className="h-8 text-sm" placeholder="Napr. Zadajte meno..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t.webForms.helpText}</Label>
          <Input value={field.helpText || ""} onChange={e => setField({ ...field, helpText: e.target.value })} className="h-8 text-sm" placeholder="Napr. Formát: +421..." />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t.webForms.defaultValue}</Label>
        <Input value={field.defaultValue || ""} onChange={e => setField({ ...field, defaultValue: e.target.value })} className="h-8 text-sm" />
      </div>

      {field.fieldType === "select" && (
        <div className="space-y-1">
          <Label className="text-xs">{t.webForms.optionsPerLine}</Label>
          <Textarea value={field.options || ""} onChange={e => setField({ ...field, options: e.target.value })} rows={3} className="text-sm" placeholder={"Možnosť 1\nMožnosť 2\nMožnosť 3"} />
        </div>
      )}

      <Separator />
      <div>
        <Label className="text-xs font-semibold mb-3 block">{t.webForms.validationVisibility}</Label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Switch checked={field.isRequired} onCheckedChange={checked => setField({ ...field, isRequired: checked })} />
            <Label className="text-xs">{t.webForms.requiredField}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={field.isVisible !== false} onCheckedChange={checked => setField({ ...field, isVisible: checked })} />
            <Label className="text-xs">{t.webForms.visible}</Label>
          </div>
        </div>

        {(field.fieldType === "text" || field.fieldType === "textarea" || field.fieldType === "tel") && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{t.webForms.minLength}</Label>
              <Input type="number" value={rules.minLength || ""} onChange={e => updateRules("minLength", e.target.value ? Number(e.target.value) : "")} className="h-7 text-sm" placeholder="napr. 2" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{t.webForms.maxLength}</Label>
              <Input type="number" value={rules.maxLength || ""} onChange={e => updateRules("maxLength", e.target.value ? Number(e.target.value) : "")} className="h-7 text-sm" placeholder="napr. 100" />
            </div>
          </div>
        )}

        {field.fieldType === "number" && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{t.webForms.minValue}</Label>
              <Input type="number" value={rules.min ?? ""} onChange={e => updateRules("min", e.target.value ? Number(e.target.value) : "")} className="h-7 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{t.webForms.maxValue}</Label>
              <Input type="number" value={rules.max ?? ""} onChange={e => updateRules("max", e.target.value ? Number(e.target.value) : "")} className="h-7 text-sm" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t.webForms.validationPattern}</Label>
            <Select value={rules.pattern || "_none"} onValueChange={v => updateRules("pattern", v === "_none" ? "" : v)}>
              <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t.webForms.patternNone}</SelectItem>
                <SelectItem value="email">{t.webForms.patternEmail}</SelectItem>
                <SelectItem value="phone">{t.webForms.patternPhone}</SelectItem>
                <SelectItem value="postalCode">{t.webForms.patternPostal}</SelectItem>
                <SelectItem value="nationalId">{t.webForms.patternNationalId}</SelectItem>
                <SelectItem value="iban">{t.webForms.patternIban}</SelectItem>
                <SelectItem value="custom">{t.webForms.patternCustom}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rules.pattern === "custom" && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{t.webForms.regexPattern}</Label>
              <Input value={rules.customPattern || ""} onChange={e => updateRules("customPattern", e.target.value)} className="h-7 text-sm font-mono" placeholder="^[A-Z].*" />
            </div>
          )}
        </div>

        <div className="space-y-1 mt-3">
          <Label className="text-[11px] text-muted-foreground">{t.webForms.customErrorMsg}</Label>
          <Input value={rules.errorMessage || ""} onChange={e => updateRules("errorMessage", e.target.value)} className="h-7 text-sm" placeholder="Napr. Zadajte platné telefónne číslo" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>{t.webForms.cancel}</Button>
        <Button size="sm" onClick={onSave}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t.webForms.saveField}</Button>
      </div>
    </div>
  );
}

function LayoutPreview({ sections, fields, formData }: { sections: any[]; fields: any[]; formData: any }) {
  const { t } = useI18n();
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
      <div className="rounded h-5 flex items-center justify-center text-white text-[8px] font-semibold" style={{ backgroundColor: brandColor }}>{t.webForms.submit}</div>
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
  const { t } = useI18n();
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
    else sampleData[key] = t.webForms.sampleValue;
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
        <p style={{ margin: "0 0 10px 0", color: "#6b7280", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>{t.webForms.dataCopy}</p>
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
                  const val = sampleData[field.customerField || field.label] || t.webForms.sampleValue;
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
    <p style={{ margin: "12px 0 0 0", textAlign: "center", color: "#9ca3af", fontSize: "9px" }}>&copy; {new Date().getFullYear()} {signatureText}. {t.webForms.autoEmailNote}</p>
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
  const { t, locale } = useI18n();
  const FORM_WIDTHS = getFormWidths(t);
  const FORM_LAYOUTS = getFormLayouts(t);
  const { toast } = useToast();
  const [formData, setFormData] = useState<any>({});
  const [editFields, setEditFields] = useState<any[]>([]);
  const [editSections, setEditSections] = useState<any[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testEmailAddr, setTestEmailAddr] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);

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
      toast({ title: t.webForms.formSaved });
      onClose();
    },
    onError: (e: any) => {
      setSaveError(e.message);
      toast({ title: t.webForms.saveError, description: e.message, variant: "destructive" });
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
          <SheetTitle>{t.webForms.editFormTitle} {form.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <div className="flex gap-5">
            <div className="flex-1 min-w-0 space-y-6">
          <Tabs defaultValue="builder">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="builder" data-testid="tab-builder">
                <LayoutGrid className="h-3.5 w-3.5 mr-1" /> {t.webForms.tabStructure}
              </TabsTrigger>
              <TabsTrigger value="design" data-testid="tab-design">
                <Palette className="h-3.5 w-3.5 mr-1" /> {t.webForms.tabDesign}
              </TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">
                <Settings className="h-3.5 w-3.5 mr-1" /> {t.webForms.tabBasic}
              </TabsTrigger>
              <TabsTrigger value="texts" data-testid="tab-texts">{t.webForms.tabTexts}</TabsTrigger>
              <TabsTrigger value="email" data-testid="tab-email">
                <Mail className="h-3.5 w-3.5 mr-1" /> {t.webForms.tabEmail}
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
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t.webForms.pageLayout}</h4>
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
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t.webForms.colors}</h4>
                <div className="grid grid-cols-3 gap-3">
                  <ColorInput label={t.webForms.mainColorHeader} value={formData.brandColor || "#16a34a"} onChange={v => setFormData({ ...formData, brandColor: v })} />
                  <ColorInput label={t.webForms.fontColorHeader} value={formData.textColor || "#ffffff"} onChange={v => setFormData({ ...formData, textColor: v })} />
                  <ColorInput label={t.webForms.sectionHeadingColor} value={formData.sectionColor || formData.brandColor || "#16a34a"} onChange={v => setFormData({ ...formData, sectionColor: v })} />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <ColorInput label={t.webForms.pageBackground} value={formData.bgColor || "#f3f4f6"} onChange={v => setFormData({ ...formData, bgColor: v })} />
                  <ColorInput label={t.webForms.headingColor} value={formData.headingColor || "#ffffff"} onChange={v => setFormData({ ...formData, headingColor: v })} />
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t.webForms.formWidth}</Label>
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
                  <Type className="h-3.5 w-3.5" /> {t.webForms.typography}
                </h4>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">{t.webForms.formTitleTypo}</Label>
                    <FontStyleEditor prefix="title" formData={formData} setFormData={setFormData} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">{t.webForms.subtitleTypo}</Label>
                    <FontStyleEditor prefix="subtitle" formData={formData} setFormData={setFormData} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">{t.webForms.sectionHeadings}</Label>
                    <FontStyleEditor prefix="section" formData={formData} setFormData={setFormData} showFamily={false} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">{t.webForms.fieldLabelsTypo}</Label>
                    <FontStyleEditor prefix="label" formData={formData} setFormData={setFormData} showFamily={false} showItalic={false} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">{t.webForms.submitButton}</Label>
                    <FontStyleEditor prefix="button" formData={formData} setFormData={setFormData} showFamily={false} showItalic={false} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t.webForms.formName}</Label>
                  <Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} data-testid="input-form-name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.webForms.slugUrl}</Label>
                  <Input value={formData.slug || ""} onChange={e => setFormData({ ...formData, slug: e.target.value })} data-testid="input-form-slug" />
                </div>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t.webForms.country}</Label>
                  <Select value={formData.countryCode} onValueChange={v => setFormData({ ...formData, countryCode: v })}>
                    <SelectTrigger data-testid="select-form-country"><SelectValue /></SelectTrigger>
                    <SelectContent>{COUNTRIES_DATA.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {getCountryName(c.code, locale)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.webForms.language}</Label>
                  <Select value={formData.language || "sk"} onValueChange={v => setFormData({ ...formData, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sk">{t.webForms.langSk}</SelectItem>
                      <SelectItem value="cs">{t.webForms.langCs}</SelectItem>
                      <SelectItem value="hu">{t.webForms.langHu}</SelectItem>
                      <SelectItem value="ro">{t.webForms.langRo}</SelectItem>
                      <SelectItem value="it">{t.webForms.langIt}</SelectItem>
                      <SelectItem value="de">{t.webForms.langDe}</SelectItem>
                      <SelectItem value="en">{t.webForms.langEn}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">{t.webForms.progressPipeline}</h4>
                  <p className="text-[11px] text-muted-foreground">{t.webForms.progressPipelineDesc}</p>
                </div>
                <Switch
                  checked={formData.showProgressPipeline !== false}
                  onCheckedChange={v => setFormData({ ...formData, showProgressPipeline: v })}
                  data-testid="switch-progress-pipeline"
                />
              </div>
            </TabsContent>

            <TabsContent value="texts" className="space-y-4 mt-4">
              <div className="space-y-1">
                <Label className="text-xs">{t.webForms.formTitleTypo}</Label>
                <Input value={formData.headerTitle || ""} onChange={e => setFormData({ ...formData, headerTitle: e.target.value })} data-testid="input-header-title" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.webForms.subtitleTypo}</Label>
                <Textarea value={formData.headerSubtitle || ""} onChange={e => setFormData({ ...formData, headerSubtitle: e.target.value })} rows={2} data-testid="input-header-subtitle" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.webForms.contactInfo}</Label>
                <Input value={formData.contactInfo || ""} onChange={e => setFormData({ ...formData, contactInfo: e.target.value })} placeholder="Napr. Tel.: +421 2 321 654 00 | info@cordbloodcenter.sk" data-testid="input-contact-info" />
              </div>
              <Separator />
              <div className="space-y-1">
                <Label className="text-xs">{t.webForms.gdprText}</Label>
                <Textarea value={formData.gdprText || ""} onChange={e => setFormData({ ...formData, gdprText: e.target.value })} rows={3} data-testid="input-gdpr-text" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.webForms.gdprMarketing}</Label>
                <Textarea value={formData.gdprMarketingText || ""} onChange={e => setFormData({ ...formData, gdprMarketingText: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.webForms.gdprPregnancy}</Label>
                <Textarea value={formData.gdprPregnancyText || ""} onChange={e => setFormData({ ...formData, gdprPregnancyText: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.webForms.successMessage}</Label>
                <Textarea value={formData.successMessage || ""} onChange={e => setFormData({ ...formData, successMessage: e.target.value })} rows={2} />
              </div>
            </TabsContent>

            <TabsContent value="email" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">{t.webForms.confirmEmail}</h4>
                  <p className="text-[11px] text-muted-foreground">{t.webForms.confirmEmailDesc}</p>
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
                      {t.webForms.availableVarsInfo} <code className="bg-blue-100 px-1 rounded">{"{{meno}}"}</code> <code className="bg-blue-100 px-1 rounded">{"{{priezvisko}}"}</code> <code className="bg-blue-100 px-1 rounded">{"{{email}}"}</code>. {t.webForms.availableVarsNote}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">{t.webForms.emailLayout}</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {([
                        { value: "modern", label: t.webForms.emailModern, desc: t.webForms.emailModernDesc },
                        { value: "minimal", label: t.webForms.emailMinimal, desc: t.webForms.emailMinimalDesc },
                        { value: "sidebar", label: t.webForms.emailSidebar, desc: t.webForms.emailSidebarDesc },
                        { value: "elegant", label: t.webForms.emailElegant, desc: t.webForms.emailElegantDesc },
                        { value: "bold", label: t.webForms.emailBold, desc: t.webForms.emailBoldDesc },
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
                        modern: t.webForms.emailModernDesc,
                        minimal: t.webForms.emailMinimalDesc,
                        sidebar: t.webForms.emailSidebarDesc,
                        elegant: t.webForms.emailElegantDesc,
                        bold: t.webForms.emailBoldDesc,
                      } as Record<string, string>)[formData.confirmEmailLayout || "modern"]}
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-xs">{t.webForms.emailSubject}</Label>
                    <Input
                      value={formData.confirmEmailSubject || ""}
                      onChange={e => setFormData({ ...formData, confirmEmailSubject: e.target.value })}
                      placeholder="Potvrdenie registrácie - Cord Blood Center"
                      data-testid="input-email-subject"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.webForms.greeting}</Label>
                    <Input
                      value={formData.confirmEmailGreeting || ""}
                      onChange={e => setFormData({ ...formData, confirmEmailGreeting: e.target.value })}
                      placeholder="Dobrý deň p. {{priezvisko}},"
                      data-testid="input-email-greeting"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.webForms.emailBody}</Label>
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
                      <Label className="text-xs">{t.webForms.showDataCopy}</Label>
                      <p className="text-[10px] text-muted-foreground">{t.webForms.showDataCopyDesc}</p>
                    </div>
                    <Switch
                      checked={formData.confirmEmailShowData !== false}
                      onCheckedChange={v => setFormData({ ...formData, confirmEmailShowData: v })}
                      data-testid="switch-email-show-data"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.webForms.emailFooter}</Label>
                    <Textarea
                      value={formData.confirmEmailFooter || ""}
                      onChange={e => setFormData({ ...formData, confirmEmailFooter: e.target.value })}
                      placeholder="V prípade akýchkoľvek otázok nás neváhajte kontaktovať."
                      rows={2}
                      data-testid="input-email-footer"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.webForms.signatureLabel}</Label>
                    <Input
                      value={formData.confirmEmailSignature || ""}
                      onChange={e => setFormData({ ...formData, confirmEmailSignature: e.target.value })}
                      placeholder="Cord Blood Center"
                      data-testid="input-email-signature"
                    />
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t.webForms.emailPreview}</h4>
                    <ConfirmEmailPreview formData={formData} editSections={editSections} editFields={editFields} />
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t.webForms.sendTestEmail}</h4>
                    <div className="flex gap-2">
                      <Input
                        value={testEmailAddr}
                        onChange={e => setTestEmailAddr(e.target.value)}
                        placeholder="vas@email.sk"
                        className="text-sm"
                        data-testid="input-test-email"
                      />
                      <Button
                        size="sm"
                        disabled={!testEmailAddr || testEmailSending}
                        data-testid="btn-send-test-email"
                        onClick={async () => {
                          setTestEmailSending(true);
                          try {
                            const res = await apiRequest("POST", `/api/web-forms/${form.id}/test-email`, { testEmail: testEmailAddr });
                            const data = await res.json();
                            if (data.success) {
                              toast({ title: t.webForms.testEmailSent, description: `Email bol odoslaný na ${testEmailAddr} z ${data.fromEmail}` });
                            } else {
                              toast({ title: t.webForms.error, description: data.error || t.webForms.sendFailed, variant: "destructive" });
                            }
                          } catch (e: any) {
                            toast({ title: t.webForms.error, description: e.message || t.webForms.sendFailed, variant: "destructive" });
                          } finally {
                            setTestEmailSending(false);
                          }
                        }}
                      >
                        {testEmailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">{t.webForms.testEmailDesc}</p>
                  </div>
                </>
              )}
            </TabsContent>

          </Tabs>
          </div>

            <div className="w-[260px] shrink-0 sticky top-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.webForms.preview}</span>
                  <Badge variant="outline" className="text-[9px]">
                    {FORM_LAYOUTS.find(l => l.value === (formData.formLayout || "standard"))?.label || t.webForms.layoutStandard}
                  </Badge>
                </div>
                <LayoutPreview sections={editSections} fields={editFields} formData={formData} />
              </div>
            </div>
          </div>

          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mt-4">
              {t.webForms.error}: {saveError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
            <Button variant="outline" onClick={onClose}>{t.webForms.cancel}</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="btn-save-form">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {t.webForms.save}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SubmissionsSheet({ formId, onClose }: { formId: string; onClose: () => void }) {
  const { t } = useI18n();
  const { data: submissions = [], isLoading } = useQuery<WebFormSubmission[]>({
    queryKey: ["/api/web-forms", formId, "submissions"],
    queryFn: async () => {
      const res = await fetch(`/api/web-forms/${formId}/submissions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: formDetail } = useQuery<any>({
    queryKey: ["/api/web-forms", formId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/web-forms/${formId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: refData } = useQuery<{ hospitals: any[]; healthInsuranceCompanies: any[]; productSets: any[] }>({
    queryKey: ["/api/web-forms", formId, "ref-data", formDetail?.countryCode],
    queryFn: async () => {
      const countryCode = formDetail?.countryCode || "";
      const [h, hi, ps] = await Promise.all([
        fetch(`/api/hospitals${countryCode ? `?countries=${countryCode}` : ""}`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
        fetch("/api/config/health-insurance", { credentials: "include" }).then(r => r.ok ? r.json() : []),
        fetch("/api/product-sets", { credentials: "include" }).then(r => r.ok ? r.json() : []),
      ]);
      return { hospitals: h, healthInsuranceCompanies: hi, productSets: ps };
    },
    enabled: !!formDetail,
  });

  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  const fieldLabels: Record<string, string> = {
    firstName: t.webForms.firstName,
    lastName: t.webForms.lastName,
    email: t.webForms.email,
    phone: t.webForms.phone,
    mobile: t.webForms.mobile,
    dateOfBirth: t.webForms.dateOfBirth,
    nationalId: t.webForms.nationalId,
    address: t.webForms.submAddress,
    city: t.webForms.city,
    postalCode: t.webForms.postalCode,
    region: t.webForms.region,
    country: t.webForms.country,
    useCorrespondenceAddress: t.webForms.submCorrespondenceAddr,
    corrName: t.webForms.submCorrName,
    corrAddress: t.webForms.submCorrAddress,
    corrCity: t.webForms.submCorrCity,
    corrPostalCode: t.webForms.submCorrPostal,
    corrRegion: t.webForms.submCorrRegion,
    corrCountry: t.webForms.submCorrCountry,
    productSetId: t.webForms.submProduct,
    hospitalId: t.webForms.submHospital,
    healthInsuranceId: t.webForms.submInsurance,
    expectedDeliveryDate: t.webForms.submDueDate,
    expectedDueDate: t.webForms.submDueDate,
    paymentMethod: t.webForms.submPayment,
    howDidYouHear: t.webForms.submHowHeard,
    newsletter: t.webForms.newsletterLabel,
    notes: t.webForms.submNotes,
    partnerName: t.webForms.submPartnerName,
    partnerPhone: t.webForms.submPartnerPhone,
    partnerEmail: t.webForms.submPartnerEmail,
    gynecologist: t.webForms.submGynecologist,
    gynecologistPhone: t.webForms.submGynecologistPhone,
    iban: t.webForms.submIban,
  };

  const paymentLabels: Record<string, string> = {
    bank_transfer: t.webForms.payBankTransfer,
    installments: t.webForms.payInstallments,
    cash: t.webForms.payCash,
    card: t.webForms.payCard,
  };

  const formatValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === "") return "—";

    if (key === "healthInsuranceId" && refData?.healthInsuranceCompanies) {
      const found = refData.healthInsuranceCompanies.find((c: any) => c.id === value);
      if (found) return found.name;
    }
    if (key === "hospitalId" && refData?.hospitals) {
      const found = refData.hospitals.find((h: any) => h.id === value);
      if (found) return found.name;
    }
    if (key === "productSetId" && refData?.productSets) {
      const found = refData.productSets.find((p: any) => p.id === value);
      if (found) return found.name;
    }
    if (key === "paymentMethod") {
      return paymentLabels[value] || String(value);
    }
    if ((key === "dateOfBirth" || key === "expectedDeliveryDate" || key === "expectedDueDate") && typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
      }
    }
    if (key === "useCorrespondenceAddress") {
      return value ? t.webForms.yes : t.webForms.no;
    }
    if (key === "newsletter") {
      return value === true || value === "true" ? t.webForms.yes : t.webForms.no;
    }
    if (key === "country") {
      return getCountryName(value, "sk") || String(value);
    }
    return String(value);
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t.webForms.formSubmissions} ({submissions.length})</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">{t.webForms.noSubmissions}</div>
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
                          <Badge variant="default" className="text-[10px]">{t.webForms.newClient}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">{t.webForms.existingClient}</Badge>
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
              <DialogHeader><DialogTitle>{t.webForms.submissionDetail}</DialogTitle></DialogHeader>
              {!refData ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {Object.entries(JSON.parse(selectedSubmission.data || "{}")).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm border-b pb-1">
                      <span className="text-muted-foreground">{fieldLabels[key] || key}</span>
                      <span className="font-medium text-right max-w-[60%]">{formatValue(key, value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </SheetContent>
    </Sheet>
  );
}
