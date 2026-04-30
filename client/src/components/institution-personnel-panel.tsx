import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { CollaboratorFormWizard } from "@/components/collaborator-form-wizard";
import type { Collaborator } from "@shared/schema";

function getLocalizedCategoryName(cat: any, locale: string): string {
  const localeMap: Record<string, string | null> = {
    sk: cat.nameSk || cat.name_sk, cs: cat.nameCs || cat.name_cs, en: cat.nameEn || cat.name_en,
    hu: cat.nameHu || cat.name_hu, ro: cat.nameRo || cat.name_ro, it: cat.nameIt || cat.name_it, de: cat.nameDe || cat.name_de,
  };
  return localeMap[locale] || cat.name || "";
}
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Plus,
  Phone,
  Mail,
  Smartphone,
  Star,
  Loader2,
  UserPlus,
  Search,
  Stethoscope,
  X,
  Trash2,
  Pencil,
  Save,
  StickyNote,
  Crown,
  Heart,
  Baby,
  HeartPulse,
  GraduationCap,
  Building2,
  User,
  HandHeart,
  Milk,
  Package,
  FileSignature,
  AlertTriangle,
  Receipt,
  ClipboardList,
  MoreHorizontal,
  UserCheck,
} from "lucide-react";

const CBC_ACTIVITY_META: Record<string, { icon: any; cls: string; labels: Record<string, string> }> = {
  sampling_kits: {
    icon: Package,
    cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
    labels: { sk: "Odberové sady", cs: "Odběrové sady", en: "Sampling kits", hu: "Mintavételi készletek", ro: "Truse de prelevare", it: "Kit di prelievo", de: "Probenahme-Sets" },
  },
  employee_agreements: {
    icon: FileSignature,
    cls: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
    labels: { sk: "Dohody so zamestnancami", cs: "Dohody se zaměstnanci", en: "Employee agreements", hu: "Munkavállalói megállapodások", ro: "Acorduri cu angajații", it: "Accordi con i dipendenti", de: "Mitarbeitervereinbarungen" },
  },
  nonconforming_work: {
    icon: AlertTriangle,
    cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
    labels: { sk: "Nezhodné práce", cs: "Neshodné práce", en: "Nonconforming work", hu: "Nem megfelelő munka", ro: "Lucrări neconforme", it: "Lavori non conformi", de: "Nicht konforme Arbeiten" },
  },
  invoicing: {
    icon: Receipt,
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    labels: { sk: "Fakturácia", cs: "Fakturace", en: "Invoicing", hu: "Számlázás", ro: "Facturare", it: "Fatturazione", de: "Rechnungsstellung" },
  },
  sampling_device_docs: {
    icon: ClipboardList,
    cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
    labels: { sk: "Dokumentácia odberového zariadenia", cs: "Dokumentace odběrového zařízení", en: "Sampling device documentation", hu: "Mintavevő eszköz dokumentációja", ro: "Documentația dispozitivului de prelevare", it: "Documentazione del dispositivo di prelievo", de: "Dokumentation des Probenahmegeräts" },
  },
  other: {
    icon: MoreHorizontal,
    cls: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
    labels: { sk: "Iné", cs: "Jiné", en: "Other", hu: "Egyéb", ro: "Altele", it: "Altro", de: "Sonstiges" },
  },
};

const CATEGORY_STYLE: Record<string, { icon: any; color: string; bg: string }> = {
  hospital_director: { icon: Building2, color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900" },
  department_head: { icon: Crown, color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-900" },
  head_nurse: { icon: HeartPulse, color: "text-pink-700 dark:text-pink-300", bg: "bg-pink-100 dark:bg-pink-900" },
  delivery_midwife: { icon: Baby, color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900" },
  department_doctor: { icon: Stethoscope, color: "text-sky-700 dark:text-sky-300", bg: "bg-sky-100 dark:bg-sky-900" },
  department_nurse: { icon: Heart, color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-100 dark:bg-rose-900" },
  neonatology_head: { icon: Crown, color: "text-teal-700 dark:text-teal-300", bg: "bg-teal-100 dark:bg-teal-900" },
  neonatology_doctor: { icon: Stethoscope, color: "text-teal-700 dark:text-teal-300", bg: "bg-teal-100 dark:bg-teal-900" },
  neonatology_nurse: { icon: Heart, color: "text-teal-700 dark:text-teal-300", bg: "bg-teal-100 dark:bg-teal-900" },
  gynecologist: { icon: Stethoscope, color: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-100 dark:bg-indigo-900" },
  pediatrician: { icon: Stethoscope, color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900" },
  prenatal_instructor: { icon: GraduationCap, color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-900" },
  doula: { icon: HandHeart, color: "text-fuchsia-700 dark:text-fuchsia-300", bg: "bg-fuchsia-100 dark:bg-fuchsia-900" },
  lactation_consultant: { icon: Milk, color: "text-lime-700 dark:text-lime-300", bg: "bg-lime-100 dark:bg-lime-900" },
};
const DEFAULT_CATEGORY_STYLE = { icon: User, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800" };

function getCategoryStyle(code: string | null | undefined) {
  if (!code) return DEFAULT_CATEGORY_STYLE;
  return CATEGORY_STYLE[code] || DEFAULT_CATEGORY_STYLE;
}

const SCOPE_BADGE: Record<string, { label: string; className: string }> = {
  hospital: { label: "Hospital", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" },
  clinic: { label: "Clinic", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
  independent: { label: "Independent", className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800" },
};

function PrimaryContactCard({ clinicDoctor, entityId, categories, locale, mpnT, onPositionSaved, countryCode, inlineMode }: {
  clinicDoctor: any;
  entityId: string;
  categories: any[];
  locale: string;
  mpnT: any;
  onPositionSaved: () => void;
  countryCode?: string;
  inlineMode?: boolean;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [selectedPositionId, setSelectedPositionId] = useState(clinicDoctor.positionCategoryId || "_none");
  const [savePersonOpen, setSavePersonOpen] = useState(false);

  const collabPrefill = (() => {
    let title = clinicDoctor.doctorTitle || "";
    let first = clinicDoctor.doctorFirstName || "";
    let last = clinicDoctor.doctorLastName || "";
    if (!first && !last && clinicDoctor.fullName) {
      const parts = String(clinicDoctor.fullName).trim().split(/\s+/);
      if (parts[0] && /\.$/.test(parts[0])) { title = parts.shift() || ""; }
      first = parts.shift() || "";
      last = parts.join(" ");
    }
    return {
      titleBefore: title,
      firstName: first,
      lastName: last,
      email: clinicDoctor.email || "",
      phone: clinicDoctor.phone || "",
      countryCode: clinicDoctor.countryCode || countryCode || "SK",
      countryCodes: [clinicDoctor.countryCode || countryCode || "SK"],
      collaboratorType: "doctor",
    };
  })();

  async function assignToClinic(collabId: string) {
    try {
      await apiRequest("POST", `/api/institutions/clinic/${entityId}/personnel`, {
        personId: collabId, department: null, position: null, role: null,
        categoryId: clinicDoctor.positionCategoryId || null, isPrimary: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/institutions", "clinic", entityId, "personnel"] });
    } catch (err: any) {
      toast({ title: t.common?.warning || "Warning", description: err?.message || "Person created but assignment to clinic failed", variant: "destructive" });
    }
  }

  useEffect(() => {
    setSelectedPositionId(clinicDoctor.positionCategoryId || "_none");
  }, [clinicDoctor.positionCategoryId]);

  const savePositionMutation = useMutation({
    mutationFn: (positionCategoryId: string | null) =>
      apiRequest("PATCH", `/api/institutions/clinic/${entityId}/doctor-position`, { positionCategoryId }),
    onSuccess: () => {
      toast({ title: t.success?.saved || "Saved" });
      onPositionSaved();
    },
    onError: (err: any) => { toast({ title: err.message || "Error", variant: "destructive" }); },
  });

  function handlePositionChange(val: string) {
    setSelectedPositionId(val);
    savePositionMutation.mutate(val === "_none" ? null : val);
  }

  const selectedCat = categories.find((c: any) => c.id === selectedPositionId);

  return (
    <div className="rounded-xl border-2 border-teal-300 dark:border-teal-700 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/40 dark:to-background p-4 shadow-sm" data-testid="personnel-primary-contact">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          <Badge className="text-[10px] px-1.5 py-0 bg-teal-600 text-white border-teal-700 dark:bg-teal-700">
            {mpnT.doctor || "Doctor"}
          </Badge>
        </div>
        {clinicDoctor.fullName && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-teal-300 dark:border-teal-700 hover:bg-teal-100 dark:hover:bg-teal-900" onClick={() => setSavePersonOpen(true)} data-testid="button-save-doctor-as-person-personnel">
            <UserPlus className="h-3 w-3 mr-1" />
            {(t.clinics as any)?.saveAsPerson || "Uložiť ako osobu"}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-200 dark:bg-teal-800 flex items-center justify-center ring-2 ring-teal-400 dark:ring-teal-600 ring-offset-2 ring-offset-background">
          <Stethoscope className="h-6 w-6 text-teal-700 dark:text-teal-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base text-foreground">{clinicDoctor.fullName}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {clinicDoctor.phone && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 text-teal-500" />
                <span>{clinicDoctor.phone}</span>
              </div>
            )}
            {clinicDoctor.email && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 text-teal-500" />
                <span>{clinicDoctor.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-teal-200 dark:border-teal-800">
        <Label className="text-xs font-medium text-teal-700 dark:text-teal-300">{mpnT.position || "Position"}</Label>
        <Select value={selectedPositionId} onValueChange={handlePositionChange}>
          <SelectTrigger className="h-8 mt-1 border-teal-200 dark:border-teal-700" data-testid="select-doctor-position">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">—</SelectItem>
            {categories.filter((c: any) => {
              if (c.isActive === false || c.is_active === false) return false;
              const sc = c.entityScope || c.entity_scope;
              return sc === "clinic";
            }).map((cat: any) => {
              const scope = cat.entityScope || cat.entity_scope || "hospital";
              const scopeStyle = SCOPE_BADGE[scope] || SCOPE_BADGE.hospital;
              const catName = getLocalizedCategoryName(cat, locale);
              return (
                <SelectItem key={cat.id} value={cat.id}>
                  <div className="flex items-center gap-2">
                    <span>{catName}</span>
                    <span className={`inline-flex text-[9px] px-1.5 py-0 rounded-full border font-medium ${scopeStyle.className}`}>
                      {scopeStyle.label}
                    </span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {savePositionMutation.isPending && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{t.common?.loading || "Saving..."}</span>
          </div>
        )}
      </div>

      {savePersonOpen && (() => {
        const inlinePortalTarget = inlineMode && typeof document !== "undefined"
          ? document.querySelector('[data-testid="clinic-card-tabbed-inline"]')
          : null;
        const drawerNode = (
          <>
            <div
              className={inlinePortalTarget
                ? "absolute inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200"
                : "fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200"}
              onClick={() => setSavePersonOpen(false)}
              data-testid="save-person-drawer-backdrop"
            />
            <div
              className={inlinePortalTarget
                ? "absolute inset-0 z-[51] bg-background shadow-2xl animate-in fade-in duration-200 flex flex-col"
                : "fixed inset-y-0 right-0 z-[51] w-[820px] max-w-[95vw] bg-background border-l shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col"}
              data-testid="save-person-drawer"
            >
              <CollaboratorFormWizard
                prefillData={collabPrefill as any}
                onCreated={async (collab) => { await assignToClinic(collab.id); }}
                onSuccess={() => setSavePersonOpen(false)}
                onCancel={() => setSavePersonOpen(false)}
              />
            </div>
          </>
        );
        return inlinePortalTarget ? createPortal(drawerNode, inlinePortalTarget) : drawerNode;
      })()}
    </div>
  );
}

interface PersonnelPanelProps {
  entityType: "hospital" | "clinic";
  entityId: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstitutionPersonnelPanel({
  entityType,
  entityId,
  entityName,
  open,
  onOpenChange,
}: PersonnelPanelProps) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [collabSearch, setCollabSearch] = useState("");
  const [selectedCollabId, setSelectedCollabId] = useState("");
  const [assignCategoryId, setAssignCategoryId] = useState("");
  const [assignIsPrimary, setAssignIsPrimary] = useState(false);

  const personnelQuery = useQuery<any>({
    queryKey: ["/api/institutions", entityType, entityId, "personnel"],
    queryFn: () => fetch(`/api/institutions/${entityType}/${entityId}/personnel`, { credentials: "include" }).then(r => r.json()),
    enabled: open,
  });

  const categoriesQuery = useQuery<any[]>({
    queryKey: ["/api/mpn/categories"],
    enabled: open,
  });

  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(collabSearch), 300);
    return () => clearTimeout(timer);
  }, [collabSearch]);

  const collabLookupQuery = useQuery<any[]>({
    queryKey: ["/api/collaborators/lookup", debouncedSearch],
    queryFn: () => fetch(`/api/collaborators/lookup?q=${encodeURIComponent(debouncedSearch)}`, { credentials: "include" }).then(r => r.json()),
    enabled: open && showAssignForm && debouncedSearch.length >= 2,
  });

  const filteredCollabs = collabLookupQuery.data || [];

  const assignMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/institutions/${entityType}/${entityId}/personnel`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/institutions", entityType, entityId, "personnel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      toast({ title: t.success?.saved || "Saved" });
      resetAssignForm();
    },
    onError: (err: any) => {
      toast({ title: err.message || "Error", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiRequest("DELETE", `/api/institutions/${entityType}/${entityId}/personnel/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/institutions", entityType, entityId, "personnel"] });
      toast({ title: t.success?.saved || "Removed" });
    },
  });

  function resetAssignForm() {
    setShowAssignForm(false);
    setCollabSearch("");
    setSelectedCollabId("");
    setAssignCategoryId("");
    setAssignIsPrimary(false);
  }

  function handleAssign() {
    if (!selectedCollabId) return;
    const cat = (categoriesQuery.data || []).find((c: any) => c.id === assignCategoryId);
    const position = cat ? getLocalizedCategoryName(cat, locale) : null;
    assignMutation.mutate({
      personId: selectedCollabId,
      department: "Gynekologické oddelenie",
      position: position,
      role: null,
      categoryId: assignCategoryId || null,
      isPrimary: assignIsPrimary,
    });
  }

  const data = personnelQuery.data;
  const assigned = data?.assigned || [];
  const legacy = data?.legacy || [];
  const clinicDoctor = data?.clinicDoctor;
  const allPersonnel = [...assigned, ...legacy];

  const mpnT = (t as any).medicalPartnerNetwork || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="dialog-title-personnel">
            <Users className="h-5 w-5" />
            {mpnT.personnel || "Personnel"} — {entityName}
          </DialogTitle>
        </DialogHeader>

        {personnelQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {allPersonnel.length + (clinicDoctor ? 1 : 0)} {mpnT.persons || "persons"}
              </span>
              <Button
                size="sm"
                onClick={() => setShowAssignForm(!showAssignForm)}
                data-testid="button-add-personnel"
              >
                {showAssignForm ? (
                  <><X className="h-4 w-4 mr-1.5" />{t.common?.cancel || "Cancel"}</>
                ) : (
                  <><UserPlus className="h-4 w-4 mr-1.5" />{mpnT.addPerson || "Add person"}</>
                )}
              </Button>
            </div>

            {showAssignForm && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30" data-testid="form-assign-personnel">
                <div>
                  <Label className="text-xs font-medium">{mpnT.searchCollaborator || "Search collaborator"}</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8 h-9"
                      placeholder={mpnT.searchCollaboratorPlaceholder || "Name, email..."}
                      value={collabSearch}
                      onChange={e => { setCollabSearch(e.target.value); setSelectedCollabId(""); }}
                      data-testid="input-search-collaborator"
                    />
                  </div>
                  {debouncedSearch.length >= 2 && !selectedCollabId && (
                    <div className="mt-1 border rounded max-h-48 overflow-y-auto bg-background shadow-md">
                      {collabLookupQuery.isLoading ? (
                        <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t.common?.loading || "Loading..."}
                        </div>
                      ) : filteredCollabs.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground">{t.common?.noResults || "No results"}</div>
                      ) : (
                        filteredCollabs.map((c: any) => {
                          const fullName = [c.titleBefore, c.firstName, c.lastName, c.titleAfter].filter(Boolean).join(" ");
                          const contact = c.email || c.phone || c.mobile || "";
                          return (
                            <button
                              key={c.id}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0"
                              onClick={() => {
                                setSelectedCollabId(c.id);
                                setCollabSearch(fullName);
                              }}
                              data-testid={`option-collaborator-${c.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{fullName}</span>
                                {c.collaboratorType && (
                                  <Badge variant="outline" className="text-[9px] ml-2">{c.collaboratorType}</Badge>
                                )}
                              </div>
                              {contact && (
                                <div className="text-xs text-muted-foreground mt-0.5">{contact}</div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                  {selectedCollabId && (
                    <Badge variant="secondary" className="mt-1">{collabSearch}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{mpnT.position || "Position"}</Label>
                    <Select value={assignCategoryId} onValueChange={setAssignCategoryId}>
                      <SelectTrigger className="h-8 mt-1" data-testid="select-position">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categoriesQuery.data || []).filter((c: any) => { if (c.isActive === false || c.is_active === false) return false; if (entityType === "clinic") { const sc = c.entityScope || c.entity_scope; return sc === "clinic"; } return true; }).map((cat: any) => (<SelectItem key={cat.id} value={cat.id}><span className="flex items-center gap-2">{getLocalizedCategoryName(cat, locale)}{cat.entityScope && <Badge variant="outline" className={`text-[9px] px-1.5 py-0 leading-tight ${cat.entityScope === 'hospital' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800' : cat.entityScope === 'clinic' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800' : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>{cat.entityScope === 'hospital' ? 'Hospital' : cat.entityScope === 'clinic' ? 'Clinic' : 'Independent'}</Badge>}</span></SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleAssign}
                  disabled={!selectedCollabId || assignMutation.isPending}
                  data-testid="button-confirm-assign"
                >
                  {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  <Plus className="h-4 w-4 mr-1.5" />
                  {mpnT.assignPerson || "Assign"}
                </Button>
              </div>
            )}

            {clinicDoctor && !assigned.some((p: any) => p.is_primary) && (
              <div className="border rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20" data-testid="card-clinic-doctor">
                <div className="flex items-center gap-2 mb-1">
                  <Stethoscope className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">{clinicDoctor.fullName}</span>
                  <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300">
                    {mpnT.clinicDoctors || "Clinic doctor"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {clinicDoctor.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{clinicDoctor.phone}</span>}
                  {clinicDoctor.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{clinicDoctor.email}</span>}
                </div>
              </div>
            )}

            {allPersonnel.length === 0 && !clinicDoctor && (
              <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-personnel">
                {mpnT.noPersonnel || "No personnel assigned"}
              </div>
            )}

            <div className="space-y-2">
              {allPersonnel.map((p: any, idx: number) => {
                const fullName = [p.title_before, p.first_name, p.last_name, p.title_after].filter(Boolean).join(" ");
                const isLegacy = p.source === "legacy_link";
                return (
                  <div key={p.assignment_id || `legacy-${idx}`} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors" data-testid={`card-person-${p.person_id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{fullName}</span>
                          {Array.isArray(p.recommended_by) && p.recommended_by.length > 0 && (() => {
                            const tx = (t.clinics as any) || {};
                            const recBy = p.recommended_by as Array<{ personName: string }>;
                            const names = recBy.map(r => r.personName).join(", ");
                            let label: string;
                            if (recBy.length === 1) {
                              const lastWord = recBy[0].personName.split(" ").pop() || "";
                              const isFemale = /(ová|á)$/.test(lastWord);
                              const tpl = (isFemale ? tx.recommendedByFemale : tx.recommendedByMale) || "Recommended by {name}";
                              label = tpl.replace("{name}", recBy[0].personName);
                            } else {
                              const tpl = tx.recommendedByMultiple || "Recommended by: {names}";
                              label = tpl.replace("{names}", names);
                            }
                            return (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 inline-flex items-center gap-1" title={names} data-testid={`badge-personnel-recommended-by-${p.person_id}`}>
                                <UserCheck className="h-2.5 w-2.5" />
                                {label}
                              </Badge>
                            );
                          })()}
                          {p.category_name && (
                            <Badge variant="outline" className="text-[10px]">{
                              p.category_id 
                                ? getLocalizedCategoryName((categoriesQuery.data || []).find((c: any) => c.id === p.category_id) || { name: p.category_name }, locale)
                                : p.category_name
                            }</Badge>
                          )}
                          {isLegacy && (
                            <Badge variant="secondary" className="text-[10px]">Legacy</Badge>
                          )}
                          {p.is_active === false && (
                            <Badge variant="destructive" className="text-[10px]">{t.common?.inactive || "Inactive"}</Badge>
                          )}
                          {p.is_active !== false && (
                            <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100">{t.common?.active || "Active"}</Badge>
                          )}
                          {p.has_agreement && p.agreement_valid && !p.agreement_expired && (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200 hover:bg-emerald-100">✓ Agreement</Badge>
                          )}
                          {p.has_agreement && p.agreement_expired && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100">⚠ Expired</Badge>
                          )}
                          {p.has_agreement && !p.agreement_valid && !p.agreement_expired && (
                            <Badge className="text-[10px] bg-red-100 text-red-800 border border-red-300 dark:bg-red-900 dark:text-red-200 hover:bg-red-100">✗ Invalid</Badge>
                          )}
                          {!p.has_agreement && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">No Agreement</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          {(p.department || p.position || p.role) && (
                            <span className="text-xs text-muted-foreground">
                              {[p.department, p.position, p.role].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 flex-wrap text-xs text-muted-foreground">
                          {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
                          {p.mobile && <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" />{p.mobile}</span>}
                          {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                        </div>
                      </div>
                      {p.assignment_id && !isLegacy && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeMutation.mutate(p.assignment_id)}
                          disabled={removeMutation.isPending}
                          data-testid={`button-remove-person-${p.person_id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InstitutionPersonnelManager({ entityType, entityId, entityName, countryCode, inlineMode }: { entityType: string; entityId: string; entityName: string; countryCode?: string; inlineMode?: boolean }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const mpnT = (t as any).medicalPartnerNetwork || {};

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [collabSearch, setCollabSearch] = useState("");
  const [selectedCollabId, setSelectedCollabId] = useState("");
  const [assignCategoryId, setAssignCategoryId] = useState("");
  const [assignIsPrimary, setAssignIsPrimary] = useState(false);
  const [assignNotes, setAssignNotes] = useState("");
  const [editingId, setEditingId] = useState<string>("");
  const [editData, setEditData] = useState<any>({});
  const [drawerCollaborator, setDrawerCollaborator] = useState<Collaborator | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingCollaborator, setIsLoadingCollaborator] = useState(false);
  const [nestedNewPersonOpen, setNestedNewPersonOpen] = useState(false);
  const [nestedNewPersonPrefill, setNestedNewPersonPrefill] = useState("");

  const openCollaboratorDrawer = async (personId: string) => {
    setIsLoadingCollaborator(true);
    try {
      const res = await fetch(`/api/collaborators/${personId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDrawerCollaborator(data);
      setIsDrawerOpen(true);
    } catch {
      toast({ title: "Chyba pri načítaní spolupracovníka", variant: "destructive" });
    } finally {
      setIsLoadingCollaborator(false);
    }
  };

  const closeCollaboratorDrawer = () => {
    setIsDrawerOpen(false);
    setDrawerCollaborator(null);
    personnelQuery.refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
  };

  const personnelQuery = useQuery<any>({
    queryKey: ["/api/institutions", entityType, entityId, "personnel"],
    queryFn: () => fetch(`/api/institutions/${entityType}/${entityId}/personnel`, { credentials: "include" }).then(r => r.json()),
  });

  const categoriesQuery = useQuery<any[]>({
    queryKey: ["/api/mpn/categories"],
  });

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(collabSearch), 300);
    return () => clearTimeout(timer);
  }, [collabSearch]);

  const collabLookupQuery = useQuery<any[]>({
    queryKey: ["/api/collaborators/lookup", debouncedSearch, countryCode],
    queryFn: () => {
      const params = new URLSearchParams({ q: debouncedSearch });
      if (countryCode) params.set("countries", countryCode);
      return fetch(`/api/collaborators/lookup?${params.toString()}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: showAssignForm && debouncedSearch.length >= 2,
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/institutions/${entityType}/${entityId}/personnel`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/institutions", entityType, entityId, "personnel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      toast({ title: t.success?.saved || "Saved" });
      resetAssignForm();
    },
    onError: (err: any) => { toast({ title: err.message || "Error", variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ assignmentId, data }: { assignmentId: string; data: any }) =>
      apiRequest("PUT", `/api/institutions/${entityType}/${entityId}/personnel/${assignmentId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/institutions", entityType, entityId, "personnel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      toast({ title: t.success?.saved || "Saved" });
      setEditingId("");
    },
    onError: (err: any) => { toast({ title: err.message || "Error", variant: "destructive" }); },
  });

  const removeMutation = useMutation({
    mutationFn: (assignmentId: string) => apiRequest("DELETE", `/api/institutions/${entityType}/${entityId}/personnel/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/institutions", entityType, entityId, "personnel"] });
      toast({ title: t.success?.saved || "Removed" });
    },
  });

  function resetAssignForm() {
    setShowAssignForm(false);
    setCollabSearch("");
    setSelectedCollabId("");
    setAssignCategoryId("");
    setAssignIsPrimary(false);
    setAssignNotes("");
  }

  function getCategoryPosition(catId: string): string {
    const cat = (categoriesQuery.data || []).find((c: any) => c.id === catId);
    return cat ? getLocalizedCategoryName(cat, locale) : "";
  }

  function handleAssign() {
    if (!selectedCollabId) return;
    const position = getCategoryPosition(assignCategoryId);
    assignMutation.mutate({
      personId: selectedCollabId,
      department: "Gynekologické oddelenie",
      position: position || null,
      role: null,
      categoryId: assignCategoryId || null,
      isPrimary: assignIsPrimary,
      notes: assignNotes || null,
    });
  }

  const convertLegacyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/institutions/${entityType}/${entityId}/personnel`, data),
    onSuccess: async (res) => {
      const row = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/institutions", entityType, entityId, "personnel"] });
      setEditingId(row.id);
      setEditData({
        department: row.department || "",
        position: row.position || "",
        role: row.role || "",
        categoryId: row.categoryId || "",
        isPrimary: !!row.isPrimary,
        notes: row.notes || "",
      });
    },
    onError: (err: any) => { toast({ title: err.message || "Error", variant: "destructive" }); },
  });

  function startEditing(p: any) {
    if (!p.assignment_id && p.person_id) {
      convertLegacyMutation.mutate({
        personId: p.person_id,
        department: "Gynekologické oddelenie",
        position: null,
        role: null,
        categoryId: null,
        isPrimary: false,
        notes: null,
      });
      return;
    }
    setEditingId(p.assignment_id);
    setEditData({
      categoryId: p.category_id || "",
      isPrimary: !!p.is_primary,
      notes: p.notes || "",
    });
  }

  function saveEdit() {
    if (!editingId || editingId.length === 0) return;
    const position = getCategoryPosition(editData.categoryId);
    updateMutation.mutate({
      assignmentId: editingId,
      data: {
        department: "Gynekologické oddelenie",
        position: position || null,
        role: null,
        categoryId: editData.categoryId && editData.categoryId !== "_none" ? editData.categoryId : null,
        isPrimary: editData.isPrimary,
        notes: editData.notes || null,
      },
    });
  }

  const data = personnelQuery.data;
  const assigned = data?.assigned || [];
  const legacy = data?.legacy || [];
  const _combined = [...assigned, ...legacy];
  const _seenPersonIds = new Set<string>();
  const allPersonnel = _combined.filter((p: any) => {
    const key = p.person_id || p.assignment_id;
    if (!key) return true;
    if (_seenPersonIds.has(key)) return false;
    _seenPersonIds.add(key);
    return true;
  });
  const clinicDoctor = entityType === "clinic" ? data?.clinicDoctor : null;

  if (personnelQuery.isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className={inlineMode ? "space-y-4 relative" : "space-y-4"} data-testid="institution-personnel-manager">
      {clinicDoctor && !allPersonnel.some((p: any) => p.is_primary) && (
        <PrimaryContactCard
          clinicDoctor={clinicDoctor}
          entityId={entityId}
          categories={categoriesQuery.data || []}
          locale={locale}
          mpnT={mpnT}
          onPositionSaved={() => personnelQuery.refetch()}
          countryCode={countryCode}
          inlineMode={inlineMode}
        />
      )}

      {(() => {
        const primaryPersonnel = allPersonnel.filter((p: any) => p.is_primary);
        if (primaryPersonnel.length === 0 && !clinicDoctor) return null;
        if (primaryPersonnel.length === 0 && clinicDoctor) return null;
        return primaryPersonnel.map((p: any) => {
          const fullName = [p.title_before, p.first_name, p.last_name, p.title_after].filter(Boolean).join(" ");
          const catCode = p.category_code || ((categoriesQuery.data || []).find((c: any) => c.id === p.category_id)?.code);
          const catName = p.category_id
            ? getLocalizedCategoryName((categoriesQuery.data || []).find((c: any) => c.id === p.category_id) || { name: p.category_name }, locale)
            : null;
          const catStyle = getCategoryStyle(catCode);
          const CatIcon = catStyle.icon;
          const isPrimaryEditing = editingId.length > 0 && editingId === p.assignment_id;

          if (isPrimaryEditing) {
            return (
              <div key={p.assignment_id || p.person_id} className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 shadow-sm space-y-3" data-testid={`card-edit-primary-${p.person_id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{fullName}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit-primary">
                      {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      {t.common.save}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId("")} data-testid="button-cancel-edit-primary">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{mpnT.position || "Position"}</Label>
                    <Select value={editData.categoryId} onValueChange={v => setEditData({ ...editData, categoryId: v })}>
                      <SelectTrigger className="h-8 mt-1" data-testid="select-edit-primary-position"><SelectValue placeholder="-" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">-</SelectItem>
                        {(categoriesQuery.data || []).filter((c: any) => { if (c.isActive === false || c.is_active === false) return false; if (entityType === "clinic") { const sc = c.entityScope || c.entity_scope; return sc === "clinic"; } return true; }).map((cat: any) => (<SelectItem key={cat.id} value={cat.id}><span className="flex items-center gap-2">{getLocalizedCategoryName(cat, locale)}{cat.entityScope && <Badge variant="outline" className={`text-[9px] px-1.5 py-0 leading-tight ${cat.entityScope === 'hospital' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800' : cat.entityScope === 'clinic' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800' : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>{cat.entityScope === 'hospital' ? 'Hospital' : cat.entityScope === 'clinic' ? 'Clinic' : 'Independent'}</Badge>}</span></SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{mpnT.notes || "Notes"}</Label>
                  <Textarea className="mt-1 h-16 text-sm" value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} data-testid="textarea-edit-primary-notes" />
                </div>
              </div>
            );
          }

          return (
            <div key={p.assignment_id || p.person_id} className="rounded-xl border-2 border-border bg-gradient-to-br from-muted/30 to-background p-4 shadow-sm" data-testid={`personnel-primary-person-${p.person_id}`}>
              <div className="flex items-center gap-2 mb-3">
                {catName && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${catStyle.color} border-current/30`}>{catName}</Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className={`flex-shrink-0 w-12 h-12 rounded-full ${catStyle.bg} flex items-center justify-center ring-2 ring-amber-400 dark:ring-amber-600 ring-offset-2 ring-offset-background cursor-pointer hover:ring-primary/50 transition-all`}
                  onClick={() => p.person_id && openCollaboratorDrawer(p.person_id)}
                  disabled={isLoadingCollaborator}
                  data-testid={`icon-primary-collab-${p.person_id}`}
                >
                  <CatIcon className={`h-6 w-6 ${catStyle.color}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    className="font-semibold text-base text-foreground cursor-pointer hover:text-primary hover:underline transition-colors text-left"
                    onClick={() => p.person_id && openCollaboratorDrawer(p.person_id)}
                    disabled={isLoadingCollaborator}
                    data-testid={`link-primary-collab-${p.person_id}`}
                  >{fullName}</button>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {p.phone && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 text-amber-500" />
                        <span>{p.phone}</span>
                      </div>
                    )}
                    {p.email && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 text-amber-500" />
                        <span>{p.email}</span>
                      </div>
                    )}
                    {p.mobile && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Smartphone className="h-3.5 w-3.5 text-amber-500" />
                        <span>{p.mobile}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (p.assignment_id) removeMutation.mutate(p.assignment_id);
                    }} disabled={removeMutation.isPending || !p.assignment_id} data-testid={`button-remove-primary-${p.person_id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                <Label className="text-xs font-medium text-amber-700 dark:text-amber-300">{mpnT.position || "Position"}</Label>
                <Select
                  value={p.category_id || "_none"}
                  onValueChange={(val) => {
                    const position = val === "_none" ? null : getLocalizedCategoryName((categoriesQuery.data || []).find((c: any) => c.id === val) || { name: "" }, locale);
                    updateMutation.mutate({
                      assignmentId: p.assignment_id,
                      data: {
                        department: p.department || null,
                        position: position || null,
                        role: p.role || null,
                        categoryId: val === "_none" ? null : val,
                        isPrimary: true,
                        notes: p.notes || null,
                      },
                    });
                  }}
                >
                  <SelectTrigger className="h-8 mt-1 border-amber-200 dark:border-amber-700" data-testid={`select-primary-position-${p.person_id}`}>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {(categoriesQuery.data || []).filter((c: any) => {
                      if (c.isActive === false || c.is_active === false) return false;
                      if (entityType === "clinic") {
                        const sc = c.entityScope || c.entity_scope;
                        return sc === "clinic";
                      }
                      return true;
                    }).map((cat: any) => {
                      const scope = cat.entityScope || cat.entity_scope || "hospital";
                      const scopeStyle = SCOPE_BADGE[scope] || SCOPE_BADGE.hospital;
                      const cName = getLocalizedCategoryName(cat, locale);
                      return (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <span>{cName}</span>
                            <span className={`inline-flex text-[9px] px-1.5 py-0 rounded-full border font-medium ${scopeStyle.className}`}>
                              {scopeStyle.label}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        });
      })()}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
            <Users className="h-3 w-3 mr-1" />{allPersonnel.length}
          </Badge>
          <span className="text-sm text-muted-foreground">{mpnT.personnelAssigned || "personnel assigned"}</span>
        </div>
        <Button size="sm" onClick={() => setShowAssignForm(!showAssignForm)} data-testid="button-add-personnel-drawer">
          {showAssignForm ? (<><X className="h-4 w-4 mr-1.5" />{t.common?.cancel || "Cancel"}</>) : (<><UserPlus className="h-4 w-4 mr-1.5" />{mpnT.addPerson || "Add person"}</>)}
        </Button>
      </div>

      {showAssignForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30" data-testid="form-assign-personnel-drawer">
          <div>
            <Label className="text-xs font-medium">{mpnT.searchCollaborator || "Search collaborator"}</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 h-9" placeholder={mpnT.searchCollaboratorPlaceholder || "Name, email..."} value={collabSearch}
                onChange={e => { setCollabSearch(e.target.value); setSelectedCollabId(""); }} data-testid="input-search-collab-drawer" />
            </div>
            {debouncedSearch.length >= 2 && !selectedCollabId && (
              <div className="mt-1 border rounded max-h-48 overflow-y-auto bg-background shadow-md">
                {collabLookupQuery.isLoading ? (
                  <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />{t.common?.loading || "Loading..."}</div>
                ) : (collabLookupQuery.data || []).length === 0 ? (
                  <div className="p-3 space-y-2">
                    <div className="text-xs text-muted-foreground">{t.common?.noResults || "No results"}</div>
                    <Button type="button" variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => { setNestedNewPersonPrefill(collabSearch); setNestedNewPersonOpen(true); }} data-testid="button-add-new-person-personnel">
                      <UserPlus className="h-3 w-3" /> {(mpnT as any).addNewPerson || mpnT.addPerson || "Add new person"}
                    </Button>
                  </div>
                ) : (
                  (collabLookupQuery.data || []).map((c: any) => {
                    const fullName = [c.titleBefore, c.firstName, c.lastName, c.titleAfter].filter(Boolean).join(" ");
                    return (
                      <button key={c.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0"
                        onClick={() => { setSelectedCollabId(c.id); setCollabSearch(fullName); }} data-testid={`option-collab-drawer-${c.id}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{fullName}</span>
                          {c.collaboratorType && <Badge variant="outline" className="text-[9px] ml-2">{c.collaboratorType}</Badge>}
                        </div>
                        {(c.email || c.phone) && <div className="text-xs text-muted-foreground mt-0.5">{c.email || c.phone}</div>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
            {selectedCollabId && <Badge variant="secondary" className="mt-1">{collabSearch}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{mpnT.position || "Position"}</Label>
              <Select value={assignCategoryId} onValueChange={setAssignCategoryId}>
                <SelectTrigger className="h-8 mt-1" data-testid="select-assign-position"><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {(categoriesQuery.data || []).filter((c: any) => { if (c.isActive === false || c.is_active === false) return false; if (entityType === "clinic") { const sc = c.entityScope || c.entity_scope; return sc === "clinic"; } return true; }).map((cat: any) => (<SelectItem key={cat.id} value={cat.id}><span className="flex items-center gap-2">{getLocalizedCategoryName(cat, locale)}{cat.entityScope && <Badge variant="outline" className={`text-[9px] px-1.5 py-0 leading-tight ${cat.entityScope === 'hospital' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800' : cat.entityScope === 'clinic' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800' : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>{cat.entityScope === 'hospital' ? 'Hospital' : cat.entityScope === 'clinic' ? 'Clinic' : 'Independent'}</Badge>}</span></SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">{mpnT.notes || "Notes"}</Label>
            <Textarea className="mt-1 h-16 text-sm" value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder={mpnT.notesPlaceholder || "Notes..."} data-testid="textarea-assign-notes" />
          </div>

          <Button size="sm" onClick={handleAssign} disabled={!selectedCollabId || assignMutation.isPending} data-testid="button-confirm-assign-drawer">
            {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            <Plus className="h-4 w-4 mr-1.5" />
            {mpnT.assignPerson || "Assign"}
          </Button>
        </div>
      )}

      {allPersonnel.length === 0 && !clinicDoctor && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{mpnT.noPersonnel || "No personnel assigned"}</p>
        </div>
      )}

      {allPersonnel.length > 0 && (() => {
        const cats = categoriesQuery.data || [];
        const counts: Record<string, { count: number; name: string; code: string }> = {};
        let uncategorized = 0;
        for (const p of allPersonnel) {
          if (p.category_id) {
            const cat = cats.find((c: any) => c.id === p.category_id);
            const code = cat?.code || p.category_code || "unknown";
            const name = cat ? getLocalizedCategoryName(cat, locale) : (p.category_name || code);
            if (!counts[code]) counts[code] = { count: 0, name, code };
            counts[code].count++;
          } else {
            uncategorized++;
          }
        }
        const entries = Object.values(counts).sort((a, b) => b.count - a.count);
        if (entries.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1.5 mb-2" data-testid="personnel-category-summary">
            {entries.map(e => {
              const style = getCategoryStyle(e.code);
              const Icon = style.icon;
              return (
                <span key={e.code} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${style.bg} ${style.color} font-medium`}>
                  <Icon className="h-3 w-3" />
                  {e.count} {e.name}
                </span>
              );
            })}
            {uncategorized > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                <User className="h-3 w-3" />
                {uncategorized} {mpnT.uncategorized || "Uncategorized"}
              </span>
            )}
          </div>
        );
      })()}

      <div className="space-y-1">
        {allPersonnel.filter((p: any) => !p.is_primary).map((p: any, idx: number) => {
          const fullName = [p.title_before, p.first_name, p.last_name, p.title_after].filter(Boolean).join(" ");
          const isLegacy = p.source === "legacy_link";
          const isEditing = editingId.length > 0 && editingId === p.assignment_id;
          const catCode = p.category_code || ((categoriesQuery.data || []).find((c: any) => c.id === p.category_id)?.code);
          const catStyle = getCategoryStyle(catCode);
          const CatIcon = catStyle.icon;

          if (isEditing) {
            return (
              <div key={p.assignment_id} className="border-2 border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3" data-testid={`card-edit-person-${p.person_id}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{fullName}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit-person">
                      {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      {t.common.save}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId("")} data-testid="button-cancel-edit-person">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{mpnT.position || "Position"}</Label>
                    <Select value={editData.categoryId} onValueChange={v => setEditData({ ...editData, categoryId: v })}>
                      <SelectTrigger className="h-8 mt-1" data-testid="select-edit-position"><SelectValue placeholder="-" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">-</SelectItem>
                        {(categoriesQuery.data || []).filter((c: any) => { if (c.isActive === false || c.is_active === false) return false; if (entityType === "clinic") { const sc = c.entityScope || c.entity_scope; return sc === "clinic"; } return true; }).map((cat: any) => (<SelectItem key={cat.id} value={cat.id}><span className="flex items-center gap-2">{getLocalizedCategoryName(cat, locale)}{cat.entityScope && <Badge variant="outline" className={`text-[9px] px-1.5 py-0 leading-tight ${cat.entityScope === 'hospital' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800' : cat.entityScope === 'clinic' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800' : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>{cat.entityScope === 'hospital' ? 'Hospital' : cat.entityScope === 'clinic' ? 'Clinic' : 'Independent'}</Badge>}</span></SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{mpnT.notes || "Notes"}</Label>
                  <Textarea className="mt-1 h-16 text-sm" value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} data-testid="textarea-edit-notes" />
                </div>
              </div>
            );
          }

          const personCategory = p.partner_category
            ? (categoriesQuery.data || []).find((c: any) => c.code === p.partner_category || c.id === p.partner_category)
            : null;
          const catName = personCategory ? getLocalizedCategoryName(personCategory, locale) : null;
          const assignmentCatName = p.category_name
            ? (p.category_id ? getLocalizedCategoryName((categoriesQuery.data || []).find((c: any) => c.id === p.category_id) || { name: p.category_name }, locale) : p.category_name)
            : null;
          const assignmentRaw = [p.department, p.position, p.role, assignmentCatName].filter(Boolean);
          const seenLower = new Set<string>();
          const assignmentParts = assignmentRaw.filter((s: string) => {
            const k = String(s).trim().toLowerCase();
            if (!k || seenLower.has(k)) return false;
            seenLower.add(k);
            return true;
          });
          const assignmentText = assignmentParts.length > 0 ? assignmentParts.join(" — ") : null;
          const entityKindBase = entityType === "hospital"
            ? (locale === "sk" || locale === "cs" ? "V nemocnici" : "At hospital")
            : entityType === "clinic"
            ? (locale === "sk" || locale === "cs" ? "Na klinike" : "At clinic")
            : (locale === "sk" || locale === "cs" ? "V sieti" : "In network");
          const entityKindLabel = entityName ? `${entityKindBase} ${entityName}` : entityKindBase;
          const professionLabel = locale === "sk" || locale === "cs" ? "Profesia" : "Profession";
          const activitiesLabel = locale === "sk"
            ? "Činnosti pre CBC"
            : locale === "cs"
            ? "Činnosti pro CBC"
            : locale === "hu"
            ? "Tevékenységek a CBC-hez"
            : locale === "ro"
            ? "Activități pentru CBC"
            : locale === "it"
            ? "Attività per CBC"
            : locale === "de"
            ? "Aktivitäten für CBC"
            : "Activities for CBC";

          return (
            <div key={p.assignment_id || `legacy-${idx}`} className="flex items-start gap-3 px-3 py-2 rounded-md border border-transparent hover:border-border hover:bg-muted/40 transition-colors group" data-testid={`card-person-drawer-${p.person_id}`}>
              <button
                type="button"
                className={`flex-shrink-0 w-8 h-8 mt-0.5 rounded-full ${catStyle.bg} flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all`}
                onClick={() => p.person_id && openCollaboratorDrawer(p.person_id)}
                disabled={isLoadingCollaborator}
                data-testid={`icon-open-collab-${p.person_id}`}
              >
                <CatIcon className={`h-4 w-4 ${catStyle.color}`} />
              </button>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className="font-semibold text-sm cursor-pointer hover:text-primary hover:underline transition-colors text-left truncate"
                    onClick={() => p.person_id && openCollaboratorDrawer(p.person_id)}
                    disabled={isLoadingCollaborator}
                    data-testid={`link-open-collab-${p.person_id}`}
                  >{fullName}</button>
                  {p.is_active === false ? (
                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">{t.common?.inactive || "Inactive"}</Badge>
                  ) : (
                    <Badge className="text-[9px] px-1.5 py-0 shrink-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100">{t.common?.active || "Active"}</Badge>
                  )}
                  {p.has_agreement && p.agreement_valid && !p.agreement_expired && (
                    <Badge className="text-[9px] px-1.5 py-0 shrink-0 bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200 hover:bg-emerald-100">✓ Agreement</Badge>
                  )}
                  {p.has_agreement && p.agreement_expired && (
                    <Badge className="text-[9px] px-1.5 py-0 shrink-0 bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100">⚠ Expired</Badge>
                  )}
                  {p.has_agreement && !p.agreement_valid && !p.agreement_expired && (
                    <Badge className="text-[9px] px-1.5 py-0 shrink-0 bg-red-100 text-red-800 border border-red-300 dark:bg-red-900 dark:text-red-200 hover:bg-red-100">✗ Invalid</Badge>
                  )}
                  {!p.has_agreement && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 text-muted-foreground">No Agreement</Badge>
                  )}
                  {isLegacy && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">Legacy</Badge>}
                </div>
                {catName && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-muted-foreground shrink-0 w-[80px]">{professionLabel}:</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 gap-1 shrink-0 ${catStyle.color} border-current/30`}
                      data-testid={`badge-profession-${p.person_id}`}
                    >
                      <CatIcon className="h-2.5 w-2.5" />
                      {catName}
                    </Badge>
                  </div>
                )}
                {(assignmentText || p.assignment_id) && (
                  <div className="flex items-baseline gap-1.5 text-[11px] flex-wrap">
                    <span className="text-muted-foreground shrink-0 max-w-full truncate" title={entityKindLabel}>
                      {entityKindBase} <span className="font-medium text-foreground/80">{entityName}</span>:
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md shrink-0 bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                      <Building2 className="h-2.5 w-2.5 opacity-70" />
                      {assignmentText || (locale === "sk" || locale === "cs" ? "Bez zaradenia" : "No role set")}
                    </span>
                    {p.assignment_id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        title={locale === "sk" || locale === "cs" ? "Upraviť zaradenie v tejto nemocnici" : "Edit assignment in this hospital"}
                        onClick={() => {
                          setEditingId(p.assignment_id);
                          setEditData({
                            categoryId: p.category_id || "",
                            isPrimary: !!p.is_primary,
                            notes: p.notes || "",
                          });
                        }}
                        data-testid={`button-edit-assignment-${p.person_id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
                {(() => {
                  const activityCodes: string[] = p.assignment_id
                    ? (Array.isArray(p.assignment_cbc_activity_codes) ? p.assignment_cbc_activity_codes : [])
                    : (Array.isArray(p.cbc_activities) ? p.cbc_activities : []);
                  if (activityCodes.length === 0) return null;
                  return (
                  <div className="flex items-start gap-1.5 text-[11px]">
                    <span className="text-muted-foreground shrink-0 w-[80px] pt-0.5">{activitiesLabel}:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {activityCodes.map((code: string) => {
                        const meta = CBC_ACTIVITY_META[code];
                        if (!meta) return null;
                        const Icon = meta.icon;
                        const label = meta.labels[locale] || meta.labels.en;
                        return (
                          <Badge
                            key={code}
                            variant="outline"
                            title={label}
                            className={`text-[10px] px-1.5 py-0 gap-1 shrink-0 ${meta.cls}`}
                            data-testid={`badge-cbc-${code}-${p.person_id}`}
                          >
                            <Icon className="h-2.5 w-2.5" />
                            {label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  );
                })()}
              </div>
              <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {p.assignment_id && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMutation.mutate(p.assignment_id)} disabled={removeMutation.isPending} data-testid={`button-remove-person-drawer-${p.person_id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isDrawerOpen && drawerCollaborator && (() => {
        const inlinePortalTarget = inlineMode && typeof document !== "undefined"
          ? document.querySelector('[data-testid="clinic-card-tabbed-inline"]')
          : null;
        const drawerNode = (
          <>
            <div
              className={inlinePortalTarget
                ? "absolute inset-0 z-[60] bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200"
                : "fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200"}
              onClick={closeCollaboratorDrawer}
              data-testid="collaborator-drawer-backdrop"
            />
            <div className={inlinePortalTarget
              ? "absolute inset-0 z-[61] bg-background shadow-2xl animate-in fade-in duration-200 flex flex-col"
              : "fixed inset-y-0 right-0 z-[61] w-[820px] max-w-[95vw] bg-background border-l shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col"}>
              <CollaboratorFormWizard
                initialData={drawerCollaborator}
                onSuccess={closeCollaboratorDrawer}
                onCancel={closeCollaboratorDrawer}
              />
            </div>
          </>
        );
        return inlinePortalTarget ? createPortal(drawerNode, inlinePortalTarget) : drawerNode;
      })()}

      {nestedNewPersonOpen && (() => {
        const inlinePortalTarget = inlineMode && typeof document !== "undefined"
          ? document.querySelector('[data-testid="clinic-card-tabbed-inline"]')
          : null;
        const drawerNode = (
          <>
            <div
              className={inlinePortalTarget
                ? "absolute inset-0 z-[60] bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200"
                : "fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200"}
              onClick={() => setNestedNewPersonOpen(false)}
              data-testid="nested-add-person-backdrop"
            />
            <div className={inlinePortalTarget
              ? "absolute inset-0 z-[61] bg-background shadow-2xl animate-in fade-in duration-200 flex flex-col"
              : "fixed inset-y-0 right-0 z-[61] w-[820px] max-w-[95vw] bg-background border-l shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col"}>
              <CollaboratorFormWizard
                prefillData={{ lastName: nestedNewPersonPrefill, countryCode: (countryCode || "SK") }}
                onSuccess={() => setNestedNewPersonOpen(false)}
                onCancel={() => setNestedNewPersonOpen(false)}
                onCreated={async (created: any) => {
                  if (created?.id) {
                    const fullName = [created.titleBefore, created.firstName, created.lastName, created.titleAfter].filter(Boolean).join(" ");
                    setSelectedCollabId(created.id);
                    setCollabSearch(fullName);
                    queryClient.invalidateQueries({ queryKey: ["/api/collaborators/lookup"] });
                  }
                  setNestedNewPersonOpen(false);
                }}
              />
            </div>
          </>
        );
        return inlinePortalTarget ? createPortal(drawerNode, inlinePortalTarget) : drawerNode;
      })()}
    </div>
  );
}
