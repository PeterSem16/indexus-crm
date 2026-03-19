import { useState, useMemo, useCallback, useEffect } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, FileText, Globe, Copy, Trash2, Settings, Eye,
  GripVertical, ChevronDown, ChevronRight, Loader2, CheckCircle2, X, Code,
  Clock, Users, ClipboardList, ArrowUp, ArrowDown, EyeOff, AlertCircle
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
  { title: "Údaje o matke", sortOrder: 0 },
  { title: "Pôrod a odber", sortOrder: 1 },
  { title: "Ako ste sa o nás dozvedeli", sortOrder: 2 },
];

const DEFAULT_FIELDS = [
  { customerField: "firstName", fieldType: "text", label: "Meno", isRequired: true, sortOrder: 0, sectionIndex: 0, validationRules: JSON.stringify({ minLength: 2, maxLength: 50 }) },
  { customerField: "lastName", fieldType: "text", label: "Priezvisko", isRequired: true, sortOrder: 1, sectionIndex: 0, validationRules: JSON.stringify({ minLength: 2, maxLength: 50 }) },
  { customerField: "email", fieldType: "email", label: "Email", isRequired: true, sortOrder: 2, sectionIndex: 0, validationRules: JSON.stringify({ pattern: "email" }) },
  { customerField: "phone", fieldType: "tel", label: "Telefón", isRequired: true, sortOrder: 3, sectionIndex: 0, validationRules: JSON.stringify({ pattern: "phone", minLength: 9 }) },
  { customerField: "address", fieldType: "text", label: "Ulica a číslo", isRequired: false, sortOrder: 4, sectionIndex: 0 },
  { customerField: "city", fieldType: "text", label: "Mesto", isRequired: false, sortOrder: 5, sectionIndex: 0 },
  { customerField: "postalCode", fieldType: "text", label: "PSČ", isRequired: false, sortOrder: 6, sectionIndex: 0, validationRules: JSON.stringify({ pattern: "postalCode", maxLength: 10 }) },
  { customerField: "dateOfBirth", fieldType: "date", label: "Dátum narodenia", isRequired: false, sortOrder: 7, sectionIndex: 0 },
  { customerField: "nationalId", fieldType: "text", label: "Rodné číslo", isRequired: false, sortOrder: 8, sectionIndex: 0, validationRules: JSON.stringify({ pattern: "nationalId" }) },
  { customerField: "healthInsuranceId", fieldType: "select_insurance", label: "Zdravotná poisťovňa", isRequired: false, sortOrder: 9, sectionIndex: 0 },
  { customerField: "productSetId", fieldType: "select_product", label: "Typ odberu", isRequired: true, sortOrder: 0, sectionIndex: 1 },
  { customerField: "hospitalId", fieldType: "select_hospital", label: "Nemocnica", isRequired: true, sortOrder: 1, sectionIndex: 1 },
  { customerField: "expectedDeliveryDate", fieldType: "date", label: "Predpokladaný termín pôrodu", isRequired: true, sortOrder: 2, sectionIndex: 1 },
  { customerField: "paymentMethod", fieldType: "select_payment", label: "Spôsob platby", isRequired: false, sortOrder: 3, sectionIndex: 1 },
  { customerField: "howDidYouHear", fieldType: "select_source", label: "Ako ste sa o nás dozvedeli", isRequired: false, sortOrder: 0, sectionIndex: 2 },
];

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
      gdprText: "Poskytnutím vašich údajov zaslaním vyplneného formulára súhlasíte so spracovaním vašich osobných údajov na účel vybavenia žiadosti.",
      gdprPregnancyText: "Som si vedomá, že táto služba je určená pre tehotné ženy.",
      gdprMarketingText: "Súhlasím so zasielaním marketingových e-mailov a elektronických newslettrov.",
      successMessage: "Ďakujeme za vašu registráciu! Budeme vás kontaktovať.",
      brandColor: "#16a34a",
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
                      <Switch
                        checked={form.isActive}
                        onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: form.id, isActive: checked })}
                        data-testid={`switch-active-${form.id}`}
                      />
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
          <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden">
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
              <iframe
                src={`/f/${previewFormSlug}`}
                className="w-full h-full border-0"
                style={{ height: "calc(85vh - 60px)" }}
                data-testid="iframe-preview"
              />
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

      {editingForm && (
        <FormEditorSheet form={editingForm} onClose={() => setEditingForm(null)} />
      )}

      {viewingSubmissions && (
        <SubmissionsSheet formId={viewingSubmissions} onClose={() => setViewingSubmissions(null)} />
      )}
    </div>
  );
}

function parseValidationRules(rules: string | null | undefined): Record<string, any> {
  if (!rules) return {};
  try { return JSON.parse(rules); } catch { return {}; }
}

function FieldEditor({ field, index, sectionsOptions, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: {
  field: any; index: number; sectionsOptions: { id: string; title: string }[];
  onUpdate: (idx: number, updated: any) => void; onRemove: (idx: number) => void;
  onMoveUp: (idx: number) => void; onMoveDown: (idx: number) => void;
  isFirst: boolean; isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const rules = parseValidationRules(field.validationRules);

  const updateRules = (key: string, value: any) => {
    const newRules = { ...rules, [key]: value };
    if (value === "" || value === null || value === undefined || value === false) delete newRules[key];
    onUpdate(index, { ...field, validationRules: JSON.stringify(newRules) });
  };

  const fieldTypeLabel = FIELD_TYPES.find(ft => ft.value === field.fieldType)?.label || field.fieldType;

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => onMoveUp(index)} disabled={isFirst}>
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => onMoveDown(index)} disabled={isLast}>
          <ArrowDown className="h-3 w-3" />
        </Button>
        <Collapsible open={expanded} onOpenChange={setExpanded} className="flex-1 min-w-0">
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-1 py-0.5 hover:bg-muted/50 rounded">
            {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
            <span className="text-sm font-medium truncate">{field.label}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">{fieldTypeLabel}</Badge>
            {field.isRequired && <Badge variant="default" className="text-[10px] shrink-0 bg-red-500">*</Badge>}
            {!field.isVisible && <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />}
            {(rules.minLength || rules.maxLength || rules.pattern || rules.min || rules.max) && (
              <Badge variant="secondary" className="text-[10px] shrink-0">validácia</Badge>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-3 pb-2 px-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Názov poľa</Label>
                  <Input value={field.label} onChange={e => onUpdate(index, { ...field, label: e.target.value })} className="h-7 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Typ poľa</Label>
                  <Select value={field.fieldType} onValueChange={v => onUpdate(index, { ...field, fieldType: v })}>
                    <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Placeholder</Label>
                  <Input value={field.placeholder || ""} onChange={e => onUpdate(index, { ...field, placeholder: e.target.value })} className="h-7 text-sm" placeholder="Napr. Zadajte meno..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Nápoveď (help text)</Label>
                  <Input value={field.helpText || ""} onChange={e => onUpdate(index, { ...field, helpText: e.target.value })} className="h-7 text-sm" placeholder="Napr. Formát: +421..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Sekcia</Label>
                  <Select value={field.sectionId || "_none"} onValueChange={v => onUpdate(index, { ...field, sectionId: v === "_none" ? null : v })}>
                    <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Bez sekcie</SelectItem>
                      {sectionsOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Predvolená hodnota</Label>
                  <Input value={field.defaultValue || ""} onChange={e => onUpdate(index, { ...field, defaultValue: e.target.value })} className="h-7 text-sm" />
                </div>
              </div>

              {field.fieldType === "select" && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Možnosti (každá na nový riadok)</Label>
                  <Textarea value={field.options || ""} onChange={e => onUpdate(index, { ...field, options: e.target.value })} rows={3} className="text-sm" placeholder={"Možnosť 1\nMožnosť 2\nMožnosť 3"} />
                </div>
              )}

              <Separator />
              <div>
                <Label className="text-[11px] text-muted-foreground font-semibold mb-2 block">Validácia</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Switch checked={field.isRequired} onCheckedChange={checked => onUpdate(index, { ...field, isRequired: checked })} />
                    <Label className="text-[11px]">Povinné</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch checked={field.isVisible !== false} onCheckedChange={checked => onUpdate(index, { ...field, isVisible: checked })} />
                    <Label className="text-[11px]">Viditeľné</Label>
                  </div>
                </div>

                {(field.fieldType === "text" || field.fieldType === "textarea" || field.fieldType === "tel") && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
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
                  <div className="grid grid-cols-2 gap-2 mt-2">
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

                <div className="grid grid-cols-2 gap-2 mt-2">
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

                <div className="space-y-1 mt-2">
                  <Label className="text-[11px] text-muted-foreground">Vlastná chybová správa</Label>
                  <Input value={rules.errorMessage || ""} onChange={e => updateRules("errorMessage", e.target.value)} className="h-7 text-sm" placeholder="Napr. Zadajte platné telefónne číslo" />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive shrink-0" onClick={() => onRemove(index)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function FormEditorSheet({ form, onClose }: { form: WebForm; onClose: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<any>({ ...form });

  const { data: formDetail } = useQuery<any>({
    queryKey: ["/api/web-forms", form.id],
    staleTime: Infinity,
  });

  const [editFields, setEditFields] = useState<any[]>([]);
  const [editSections, setEditSections] = useState<any[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (formDetail && !hydrated) {
      setEditSections(formDetail.sections || []);
      setEditFields(formDetail.fields || []);
      setHydrated(true);
    }
  }, [formDetail, hydrated]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/web-forms/${form.id}`, data);
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/web-forms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/web-forms", form.id] });
      toast({ title: "Formulár uložený" });
      onClose();
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      ...formData,
      sections: editSections,
      fields: editFields.map((f: any, i: number) => ({ ...f, sortOrder: i })),
    });
  };

  const updateField = useCallback((idx: number, updated: any) => {
    setEditFields(prev => prev.map((f, i) => i === idx ? updated : f));
  }, []);

  const removeField = useCallback((idx: number) => {
    setEditFields(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const moveField = useCallback((idx: number, direction: "up" | "down") => {
    setEditFields(prev => {
      const arr = [...prev];
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }, []);

  const addField = (fieldDef: typeof CUSTOMER_FIELDS[0] | typeof SPECIAL_FIELDS[0]) => {
    setEditFields(prev => [...prev, {
      customerField: fieldDef.key,
      fieldType: fieldDef.type,
      label: fieldDef.label,
      isRequired: false,
      sortOrder: prev.length,
      sectionId: editSections[0]?.id || null,
      placeholder: "",
      helpText: "",
      validationRules: null,
      options: null,
      defaultValue: null,
      isVisible: true,
    }]);
  };

  const addCustomField = () => {
    setEditFields(prev => [...prev, {
      customerField: null,
      fieldType: "text",
      label: "Nové pole",
      isRequired: false,
      sortOrder: prev.length,
      sectionId: editSections[0]?.id || null,
      placeholder: "",
      helpText: "",
      validationRules: null,
      options: null,
      defaultValue: null,
      isVisible: true,
    }]);
  };

  const addSection = () => {
    setEditSections(prev => [...prev, {
      id: `new-${Date.now()}`,
      title: "Nová sekcia",
      sortOrder: prev.length,
      isVisible: true,
    }]);
  };

  const allFieldKeys = [...CUSTOMER_FIELDS, ...SPECIAL_FIELDS];
  const usedFieldKeys = new Set(editFields.map((f: any) => f.customerField));
  const availableFields = allFieldKeys.filter(f => !usedFieldKeys.has(f.key));

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[750px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upraviť formulár: {form.name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <Tabs defaultValue="fields">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="settings">Základné</TabsTrigger>
              <TabsTrigger value="fields">Polia ({editFields.length})</TabsTrigger>
              <TabsTrigger value="sections">Sekcie ({editSections.length})</TabsTrigger>
              <TabsTrigger value="texts">Texty & GDPR</TabsTrigger>
            </TabsList>

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
                    <SelectContent>
                      {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Farba značky</Label>
                  <div className="flex gap-2">
                    <input type="color" value={formData.brandColor || "#16a34a"} onChange={e => setFormData({ ...formData, brandColor: e.target.value })} className="h-9 w-12 rounded border cursor-pointer" />
                    <Input value={formData.brandColor || "#16a34a"} onChange={e => setFormData({ ...formData, brandColor: e.target.value })} className="flex-1" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fields" className="space-y-3 mt-4">
              <div className="space-y-1.5">
                {editFields.map((field: any, idx: number) => (
                  <FieldEditor
                    key={idx}
                    field={field}
                    index={idx}
                    sectionsOptions={editSections.map((s: any) => ({ id: s.id, title: s.title }))}
                    onUpdate={updateField}
                    onRemove={removeField}
                    onMoveUp={(i) => moveField(i, "up")}
                    onMoveDown={(i) => moveField(i, "down")}
                    isFirst={idx === 0}
                    isLast={idx === editFields.length - 1}
                  />
                ))}
              </div>

              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Pridať zákaznícke pole</Label>
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={addCustomField}>
                    <Plus className="h-2.5 w-2.5 mr-1" /> Vlastné pole
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {availableFields.map(f => (
                    <Button key={f.key} size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => addField(f)}>
                      <Plus className="h-2.5 w-2.5 mr-1" /> {f.label}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sections" className="space-y-3 mt-4">
              {editSections.map((section: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Input value={section.title} onChange={e => {
                    const updated = [...editSections];
                    updated[idx] = { ...updated[idx], title: e.target.value };
                    setEditSections(updated);
                  }} className="h-7 text-sm flex-1" />
                  <Switch checked={section.isVisible !== false} onCheckedChange={checked => {
                    const updated = [...editSections];
                    updated[idx] = { ...updated[idx], isVisible: checked };
                    setEditSections(updated);
                  }} />
                  <Label className="text-[10px]">Viditeľná</Label>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => {
                    const removedId = editSections[idx]?.id;
                    setEditSections(prev => prev.filter((_, i) => i !== idx));
                    if (removedId) {
                      setEditFields(prev => prev.map(f => f.sectionId === removedId ? { ...f, sectionId: null } : f));
                    }
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addSection}>
                <Plus className="h-3 w-3 mr-1" /> Pridať sekciu
              </Button>
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
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Zrušiť</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending || !hydrated} data-testid="btn-save-form">
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
