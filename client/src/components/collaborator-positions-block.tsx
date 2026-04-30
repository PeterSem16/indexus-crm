import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Briefcase, Building2, Hospital, Network, Plus, Pencil, Trash2, X, Star } from "lucide-react";

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
  };
  categoryName: string | null;
  categoryCode: string | null;
}

interface InstitutionLite { id: string; name: string; countryCode?: string | null; }

interface PartnerCategoryLite {
  id: string; name: string; code: string;
  nameSk?: string | null; nameCs?: string | null; nameEn?: string | null;
  nameHu?: string | null; nameRo?: string | null; nameIt?: string | null; nameDe?: string | null;
}

function getLocalizedCategoryName(cat: PartnerCategoryLite, locale: string): string {
  const map: Record<string, string | null | undefined> = {
    sk: cat.nameSk, cs: cat.nameCs, en: cat.nameEn,
    hu: cat.nameHu, ro: cat.nameRo, it: cat.nameIt, de: cat.nameDe,
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

export function CollaboratorPositionsBlock({ personId, personCountryCodes, t, locale }: Props) {
  const { toast } = useToast();
  const pT = (t.collaborators?.positions || {}) as any;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formEntityType, setFormEntityType] = useState<EntityType>("hospital");
  const [formEntityId, setFormEntityId] = useState<string>("");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formDepartment, setFormDepartment] = useState<string>("");
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

  const hospitalsQuery = useQuery<InstitutionLite[]>({
    queryKey: ["/api/hospitals"],
    enabled,
  });
  const clinicsQuery = useQuery<InstitutionLite[]>({
    queryKey: ["/api/clinics"],
    enabled,
  });
  const networksQuery = useQuery<InstitutionLite[]>({
    queryKey: ["/api/hospital-networks"],
    enabled,
  });
  const categoriesQuery = useQuery<PartnerCategoryLite[]>({
    queryKey: ["/api/mpn/categories"],
    enabled,
  });

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
    setFormDepartment("");
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
    setFormDepartment(row.assignment.department || "");
    setShowForm(true);
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
      // Use the institution-personnel route so partnerCategory sync runs (matches institution side behaviour).
      return apiRequest("POST", `/api/institutions/${formEntityType}/${formEntityId}/personnel`, {
        personId,
        department: formDepartment || null,
        position: positionText,
        role: null,
        categoryId: formCategoryId || null,
        isPrimary: formIsPrimary,
      });
    },
    onSuccess: (_d, _v) => {
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
        department: formDepartment || null,
        position: positionText,
        categoryId: formCategoryId || null,
        isPrimary: formIsPrimary,
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

  // Render the "must save first" hint when person has no id yet
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
            return (
              <div
                key={row.assignment.id}
                className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-background hover-elevate"
                data-testid={`row-position-${row.assignment.id}`}
              >
                <Badge className={`text-[10px] px-1.5 py-0 ${ENTITY_BADGE_CLASS[row.assignment.entityType]} flex items-center gap-1`}>
                  {ENTITY_ICON[row.assignment.entityType]}
                  {typeLabel}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate" data-testid={`text-position-institution-${row.assignment.id}`}>{instName}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span data-testid={`text-position-name-${row.assignment.id}`}>{positionName}</span>
                    {row.assignment.isPrimary && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-700 dark:text-amber-300">
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        {pT.isPrimary || "Primary"}
                      </Badge>
                    )}
                    {row.assignment.department && <span>· {row.assignment.department}</span>}
                  </div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditForm(row)} data-testid={`button-edit-position-${row.assignment.id}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(row.assignment.id)} data-testid={`button-delete-position-${row.assignment.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
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
              <Select value={formEntityType} onValueChange={(v) => { setFormEntityType(v as EntityType); setFormEntityId(""); }}>
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

            <div className="space-y-1">
              <Label className="text-xs">{pT.position || "Position"}</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-position-category">
                  <SelectValue placeholder={pT.selectPosition || "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {(categoriesQuery.data || []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{getLocalizedCategoryName(cat, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{pT.department || "Department"}</Label>
              <Input
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
                className="h-9 text-sm"
                data-testid="input-position-department"
              />
            </div>
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
