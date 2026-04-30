import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as LucideIcons from "lucide-react";
import { Briefcase, Building2, Hospital, Network, Plus, Pencil, Trash2, X, Star, Activity } from "lucide-react";

type EntityType = "hospital" | "clinic" | "network";

interface AssignmentRow {
  assignment: {
    id: string;
    personId: string;
    entityType: EntityType;
    entityId: string;
    categoryId: string | null;
    department: string | null;
    position: string | null;
    isPrimary: boolean | null;
    isActive: boolean | null;
    notes: string | null;
    cbcActivityCodes?: string[] | null;
  };
  categoryName: string | null;
  categoryCode: string | null;
}

interface InstitutionLite { id: string; name: string; countryCode?: string | null; }

interface PartnerCategoryLite {
  id: string; name: string; code: string;
  entityScope?: string | null;
  isActive?: boolean | null;
  nameSk?: string | null; nameCs?: string | null; nameEn?: string | null;
  nameHu?: string | null; nameRo?: string | null; nameIt?: string | null; nameDe?: string | null;
}

interface CbcActivityLite {
  id: string; code: string; name: string;
  entityScope: string;
  icon: string; color: string;
  isActive: boolean;
  nameSk?: string | null; nameCs?: string | null; nameEn?: string | null;
  nameHu?: string | null; nameRo?: string | null; nameIt?: string | null; nameDe?: string | null;
}

function getLocalizedCategoryName(cat: PartnerCategoryLite | CbcActivityLite, locale: string): string {
  const map: Record<string, string | null | undefined> = {
    sk: (cat as any).nameSk, cs: (cat as any).nameCs, en: (cat as any).nameEn,
    hu: (cat as any).nameHu, ro: (cat as any).nameRo, it: (cat as any).nameIt, de: (cat as any).nameDe,
  };
  return map[locale] || cat.name || "";
}

interface Props {
  personId?: string;
  personCountryCodes: string[];
  t: any;
  locale: string;
}

const ENTITY_ICON: Record<EntityType, JSX.Element> = {
  hospital: <Hospital className="h-3.5 w-3.5" />,
  clinic: <Building2 className="h-3.5 w-3.5" />,
  network: <Network className="h-3.5 w-3.5" />,
};

const ENTITY_BADGE_CLASS: Record<EntityType, string> = {
  hospital: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800",
  clinic: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800",
  network: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800",
};

const COLOR_TILE_CLASS: Record<string, string> = {
  sky: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  violet: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  teal: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  pink: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800",
  fuchsia: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:border-fuchsia-800",
  lime: "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950 dark:text-lime-300 dark:border-lime-800",
  slate: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
};

function getColorClass(color: string | undefined | null): string {
  return COLOR_TILE_CLASS[color || "slate"] || COLOR_TILE_CLASS.slate;
}

function getLucideIcon(name: string | undefined | null) {
  const Icon = (LucideIcons as any)[name || "Activity"] || Activity;
  return Icon;
}

export function CollaboratorPositionsBlock({ personId, personCountryCodes, t, locale }: Props) {
  const { toast } = useToast();
  const pT = (t.collaborators?.positions || {}) as any;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formEntityType, setFormEntityType] = useState<EntityType>("hospital");
  const [formEntityId, setFormEntityId] = useState<string>("");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formActivityCodes, setFormActivityCodes] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const enabled = !!personId;

  const assignmentsQuery = useQuery<AssignmentRow[]>({
    queryKey: ["/api/mpn/assignments", { personId }],
    queryFn: async () => {
      const res = await fetch(`/api/mpn/assignments?personId=${encodeURIComponent(personId!)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load assignments");
      return res.json();
    },
    enabled,
  });

  const hospitalsQuery = useQuery<InstitutionLite[]>({ queryKey: ["/api/hospitals"], enabled });
  const clinicsQuery = useQuery<InstitutionLite[]>({ queryKey: ["/api/clinics"], enabled });
  const networksQuery = useQuery<InstitutionLite[]>({ queryKey: ["/api/hospital-networks"], enabled });
  const categoriesQuery = useQuery<PartnerCategoryLite[]>({ queryKey: ["/api/mpn/categories"], enabled });
  const activitiesQuery = useQuery<CbcActivityLite[]>({ queryKey: ["/api/cbc-activities"], enabled });

  const institutionsByType = useMemo(() => ({
    hospital: hospitalsQuery.data || [],
    clinic: clinicsQuery.data || [],
    network: networksQuery.data || [],
  }), [hospitalsQuery.data, clinicsQuery.data, networksQuery.data]);

  const filteredInstitutions = useMemo(() => {
    const list = institutionsByType[formEntityType] || [];
    if (!personCountryCodes || personCountryCodes.length === 0) return list;
    return list.filter((inst) => !inst.countryCode || personCountryCodes.includes(inst.countryCode));
  }, [institutionsByType, formEntityType, personCountryCodes]);

  // Filter Position dropdown by entityScope matching the selected entity type.
  // For "network" we accept network + independent + no-scope; for hospital/clinic strict match.
  const filteredCategories = useMemo(() => {
    const all = categoriesQuery.data || [];
    return all.filter((c) => {
      if (c.isActive === false) return false;
      const scope = (c as any).entityScope || (c as any).entity_scope;
      if (formEntityType === "network") {
        return !scope || scope === "network" || scope === "independent";
      }
      return scope === formEntityType;
    });
  }, [categoriesQuery.data, formEntityType]);

  // Filter Activities by entity type. Map "network" → activities scoped to network,
  // for hospital/clinic strict match. Always allow midwife/nurse alongside hospital
  // since those are role-scoped in the same context.
  const filteredActivities = useMemo(() => {
    const all = activitiesQuery.data || [];
    return all.filter((a) => {
      if (a.isActive === false) return false;
      const sc = a.entityScope;
      if (formEntityType === "hospital") return sc === "hospital" || sc === "midwife" || sc === "nurse";
      if (formEntityType === "clinic") return sc === "clinic" || sc === "midwife" || sc === "nurse";
      if (formEntityType === "network") return sc === "network" || sc === "hospital";
      return true;
    });
  }, [activitiesQuery.data, formEntityType]);

  const activityByCode = useMemo(() => {
    const map = new Map<string, CbcActivityLite>();
    (activitiesQuery.data || []).forEach((a) => map.set(a.code, a));
    return map;
  }, [activitiesQuery.data]);

  const institutionLookup = useMemo(() => {
    const map = new Map<string, { name: string; type: EntityType }>();
    (hospitalsQuery.data || []).forEach((h) => map.set(`hospital:${h.id}`, { name: h.name, type: "hospital" }));
    (clinicsQuery.data || []).forEach((c) => map.set(`clinic:${c.id}`, { name: c.name, type: "clinic" }));
    (networksQuery.data || []).forEach((n) => map.set(`network:${n.id}`, { name: n.name, type: "network" }));
    return map;
  }, [hospitalsQuery.data, clinicsQuery.data, networksQuery.data]);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormEntityType("hospital");
    setFormEntityId("");
    setFormCategoryId("");
    setFormIsPrimary(false);
    setFormActivityCodes([]);
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(row: AssignmentRow) {
    setEditingId(row.assignment.id);
    setFormEntityType(row.assignment.entityType);
    setFormEntityId(row.assignment.entityId);
    setFormCategoryId(row.assignment.categoryId || "");
    setFormIsPrimary(!!row.assignment.isPrimary);
    setFormActivityCodes(Array.isArray(row.assignment.cbcActivityCodes) ? row.assignment.cbcActivityCodes : []);
    setShowForm(true);
  }

  function toggleActivity(code: string) {
    setFormActivityCodes((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  }

  function invalidateAll(entityType: EntityType, entityId: string) {
    queryClient.invalidateQueries({ queryKey: ["/api/mpn/assignments", { personId }] });
    queryClient.invalidateQueries({ queryKey: ["/api/mpn/assignments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/institutions", entityType, entityId, "personnel"] });
    queryClient.invalidateQueries({ queryKey: ["/api/mpn/entity-personnel-counts"] });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!personId) throw new Error("No personId");
      const cat = (categoriesQuery.data || []).find((c) => c.id === formCategoryId);
      const positionText = cat ? getLocalizedCategoryName(cat, locale) : null;
      return apiRequest("POST", `/api/institutions/${formEntityType}/${formEntityId}/personnel`, {
        personId,
        position: positionText,
        role: null,
        categoryId: formCategoryId || null,
        isPrimary: formIsPrimary,
        cbcActivityCodes: formActivityCodes,
      });
    },
    onSuccess: () => {
      invalidateAll(formEntityType, formEntityId);
      toast({ title: t.success?.saved || "Saved" });
      resetForm();
    },
    onError: async (err: any) => {
      let msg = err?.message || "Error";
      if (typeof msg === "string" && msg.includes("already assigned")) {
        msg = pT.alreadyAssigned || "Already assigned";
      }
      toast({ title: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("No assignment id");
      const cat = (categoriesQuery.data || []).find((c) => c.id === formCategoryId);
      const positionText = cat ? getLocalizedCategoryName(cat, locale) : null;
      return apiRequest("PUT", `/api/institutions/${formEntityType}/${formEntityId}/personnel/${editingId}`, {
        position: positionText,
        categoryId: formCategoryId || null,
        isPrimary: formIsPrimary,
        cbcActivityCodes: formActivityCodes,
      });
    },
    onSuccess: () => {
      invalidateAll(formEntityType, formEntityId);
      toast({ title: t.success?.saved || "Saved" });
      resetForm();
    },
    onError: (err: any) => toast({ title: err?.message || "Error", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: AssignmentRow) => {
      return apiRequest(
        "DELETE",
        `/api/institutions/${row.assignment.entityType}/${row.assignment.entityId}/personnel/${row.assignment.id}`,
      );
    },
    onSuccess: (_d, row) => {
      invalidateAll(row.assignment.entityType, row.assignment.entityId);
      toast({ title: t.success?.saved || "Removed" });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ title: err?.message || "Error", variant: "destructive" }),
  });

  const rows = (assignmentsQuery.data || []).filter((r) => r.assignment.isActive !== false);

  if (!personId) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4" data-testid="positions-block-savefirst">
        <div className="flex items-start gap-3">
          <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">{pT.sectionTitle || "Positions"}</div>
            <div className="text-xs text-muted-foreground">{pT.saveAfterCreate || "Save the person first."}</div>
          </div>
        </div>
      </div>
    );
  }

  const canSubmit = !!formEntityId && !!formCategoryId && !!formEntityType;
  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3" data-testid="positions-block">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-foreground">{pT.sectionTitle || "Positions"}</div>
            {rows.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid="badge-positions-count">{rows.length}</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{pT.sectionDescription || ""}</div>
        </div>
        {!showForm && (
          <Button type="button" size="sm" variant="outline" onClick={openAddForm} data-testid="button-add-position">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {pT.addPosition || "Add"}
          </Button>
        )}
      </div>

      {assignmentsQuery.isLoading && (
        <div className="text-xs text-muted-foreground py-2" data-testid="text-positions-loading">…</div>
      )}

      {!assignmentsQuery.isLoading && rows.length === 0 && !showForm && (
        <div className="text-xs text-muted-foreground py-3 text-center border border-dashed border-muted-foreground/30 rounded" data-testid="text-positions-empty">
          {pT.empty || "No positions yet."}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => {
            const inst = institutionLookup.get(`${row.assignment.entityType}:${row.assignment.entityId}`);
            const instName = inst?.name || row.assignment.entityId;
            const cat = (categoriesQuery.data || []).find((c) => c.id === row.assignment.categoryId);
            const positionName = cat ? getLocalizedCategoryName(cat, locale) : (row.categoryName || row.assignment.position || "—");
            const typeLabel = pT[`type${row.assignment.entityType.charAt(0).toUpperCase()}${row.assignment.entityType.slice(1)}`]
              || row.assignment.entityType;
            const codes: string[] = Array.isArray(row.assignment.cbcActivityCodes) ? row.assignment.cbcActivityCodes : [];
            return (
              <div
                key={row.assignment.id}
                className="flex items-start gap-3 p-2.5 rounded-md border border-border bg-background hover-elevate"
                data-testid={`row-position-${row.assignment.id}`}
              >
                <Badge className={`text-[10px] px-1.5 py-0 ${ENTITY_BADGE_CLASS[row.assignment.entityType]} flex items-center gap-1 mt-0.5`}>
                  {ENTITY_ICON[row.assignment.entityType]}
                  {typeLabel}
                </Badge>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-sm font-medium text-foreground truncate" data-testid={`text-position-institution-${row.assignment.id}`}>{instName}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span data-testid={`text-position-name-${row.assignment.id}`}>{positionName}</span>
                    {row.assignment.isPrimary && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-700 dark:text-amber-300">
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        {pT.isPrimary || "Primary"}
                      </Badge>
                    )}
                  </div>
                  {codes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-0.5" data-testid={`activities-tiles-${row.assignment.id}`}>
                      {codes.map((code) => {
                        const a = activityByCode.get(code);
                        if (!a) return null;
                        const Icon = getLucideIcon(a.icon);
                        const label = getLocalizedCategoryName(a, locale);
                        return (
                          <span
                            key={code}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${getColorClass(a.color)}`}
                            title={label}
                            data-testid={`activity-tile-${row.assignment.id}-${code}`}
                          >
                            <Icon className="h-3 w-3" />
                            <span className="leading-tight">{label}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditForm(row)} data-testid={`button-edit-position-${row.assignment.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(row.assignment.id)} data-testid={`button-delete-position-${row.assignment.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3" data-testid="form-position">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-foreground">
              {editingId ? (pT.editPosition || "Edit position") : (pT.addPosition || "Add position")}
            </div>
            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={resetForm} data-testid="button-cancel-position">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{pT.institutionType || "Type"}</Label>
              <Select value={formEntityType} onValueChange={(v) => { setFormEntityType(v as EntityType); setFormEntityId(""); setFormCategoryId(""); setFormActivityCodes([]); }}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-position-entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hospital">{pT.typeHospital || "Hospital"}</SelectItem>
                  <SelectItem value="clinic">{pT.typeClinic || "Clinic"}</SelectItem>
                  <SelectItem value="network">{pT.typeNetwork || "Network"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{pT.institution || "Institution"}</Label>
              <Select value={formEntityId} onValueChange={setFormEntityId} disabled={!!editingId}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-position-institution">
                  <SelectValue placeholder={pT.selectInstitution || "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredInstitutions.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {pT.noInstitutionsForCountry || "No institutions"}
                    </div>
                  ) : (
                    filteredInstitutions.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{pT.position || "Position"}</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-position-category">
                  <SelectValue placeholder={pT.selectPosition || "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {pT.noPositionsForType || "No positions for this type"}
                    </div>
                  ) : (
                    filteredCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{getLocalizedCategoryName(cat, locale)}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{pT.activitiesLabel || "Activities for CBC"}</Label>
            {filteredActivities.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 px-2 border border-dashed border-muted-foreground/30 rounded">
                {pT.noActivitiesForType || "No activities defined for this type. Add them in Settings → CBC Activities."}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5" data-testid="activity-picker">
                {filteredActivities.map((a) => {
                  const Icon = getLucideIcon(a.icon);
                  const checked = formActivityCodes.includes(a.code);
                  const label = getLocalizedCategoryName(a, locale);
                  return (
                    <button
                      type="button"
                      key={a.code}
                      onClick={() => toggleActivity(a.code)}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors ${checked ? getColorClass(a.color) + " ring-2 ring-offset-1 ring-primary/40" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                      data-testid={`activity-toggle-${a.code}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="position-isprimary"
                checked={formIsPrimary}
                onCheckedChange={(v) => setFormIsPrimary(!!v)}
                data-testid="checkbox-position-primary"
              />
              <Label htmlFor="position-isprimary" className="text-xs cursor-pointer">{pT.isPrimary || "Primary"}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={resetForm} data-testid="button-form-cancel">
                {t.common?.cancel || "Cancel"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canSubmit || submitting}
                onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}
                data-testid="button-save-position"
              >
                {t.common?.save || "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pT.confirmDelete || "Remove position?"}</AlertDialogTitle>
            <AlertDialogDescription>{pT.sectionDescription || ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-delete-cancel">{t.common?.cancel || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const row = rows.find((r) => r.assignment.id === deleteId);
                if (row) deleteMutation.mutate(row);
              }}
              data-testid="button-confirm-delete-position"
            >
              {t.common?.delete || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
