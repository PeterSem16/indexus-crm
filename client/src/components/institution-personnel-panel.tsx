import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";

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
} from "lucide-react";

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
  const [assignDepartment, setAssignDepartment] = useState("");
  const [assignPosition, setAssignPosition] = useState("");
  const [assignRole, setAssignRole] = useState("");
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
    setAssignDepartment("");
    setAssignPosition("");
    setAssignRole("");
    setAssignCategoryId("");
    setAssignIsPrimary(false);
  }

  function handleAssign() {
    if (!selectedCollabId) return;
    assignMutation.mutate({
      personId: selectedCollabId,
      department: assignDepartment || null,
      position: assignPosition || null,
      role: assignRole || null,
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

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">{mpnT.department || "Department"}</Label>
                    <Input className="h-8 mt-1" value={assignDepartment} onChange={e => setAssignDepartment(e.target.value)} data-testid="input-department" />
                  </div>
                  <div>
                    <Label className="text-xs">{mpnT.position || "Position"}</Label>
                    <Input className="h-8 mt-1" value={assignPosition} onChange={e => setAssignPosition(e.target.value)} data-testid="input-position" />
                  </div>
                  <div>
                    <Label className="text-xs">{mpnT.role || "Role"}</Label>
                    <Input className="h-8 mt-1" value={assignRole} onChange={e => setAssignRole(e.target.value)} data-testid="input-role" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{mpnT.category || "Category"}</Label>
                    <Select value={assignCategoryId} onValueChange={setAssignCategoryId}>
                      <SelectTrigger className="h-8 mt-1" data-testid="select-category">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categoriesQuery.data || []).map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.id}>{getLocalizedCategoryName(cat, locale)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm h-8">
                      <input
                        type="checkbox"
                        checked={assignIsPrimary}
                        onChange={e => setAssignIsPrimary(e.target.checked)}
                        data-testid="checkbox-primary"
                      />
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      {mpnT.primaryContact || "Primary"}
                    </label>
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

            {clinicDoctor && (
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
                          {p.is_primary && (
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          )}
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

export function InstitutionPersonnelManager({ entityType, entityId, entityName }: { entityType: string; entityId: string; entityName: string }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const mpnT = (t as any).medicalPartnerNetwork || {};

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [collabSearch, setCollabSearch] = useState("");
  const [selectedCollabId, setSelectedCollabId] = useState("");
  const [assignDepartment, setAssignDepartment] = useState("");
  const [assignPosition, setAssignPosition] = useState("");
  const [assignRole, setAssignRole] = useState("");
  const [assignCategoryId, setAssignCategoryId] = useState("");
  const [assignIsPrimary, setAssignIsPrimary] = useState(false);
  const [assignNotes, setAssignNotes] = useState("");
  const [editingId, setEditingId] = useState<string>("");
  const [editData, setEditData] = useState<any>({});

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
    queryKey: ["/api/collaborators/lookup", debouncedSearch],
    queryFn: () => fetch(`/api/collaborators/lookup?q=${encodeURIComponent(debouncedSearch)}`, { credentials: "include" }).then(r => r.json()),
    enabled: showAssignForm && debouncedSearch.length >= 2,
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/institutions/${entityType}/${entityId}/personnel`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/institutions", entityType, entityId, "personnel"] });
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
    setAssignDepartment("");
    setAssignPosition("");
    setAssignRole("");
    setAssignCategoryId("");
    setAssignIsPrimary(false);
    setAssignNotes("");
  }

  function handleAssign() {
    if (!selectedCollabId) return;
    assignMutation.mutate({
      personId: selectedCollabId,
      department: assignDepartment || null,
      position: assignPosition || null,
      role: assignRole || null,
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
        department: null,
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
      department: p.department || "",
      position: p.position || "",
      role: p.role || "",
      categoryId: p.category_id || "",
      isPrimary: !!p.is_primary,
      notes: p.notes || "",
    });
  }

  function saveEdit() {
    if (!editingId || editingId.length === 0) return;
    updateMutation.mutate({
      assignmentId: editingId,
      data: {
        department: editData.department || null,
        position: editData.position || null,
        role: editData.role || null,
        categoryId: editData.categoryId && editData.categoryId !== "_none" ? editData.categoryId : null,
        isPrimary: editData.isPrimary,
        notes: editData.notes || null,
      },
    });
  }

  const data = personnelQuery.data;
  const assigned = data?.assigned || [];
  const legacy = data?.legacy || [];
  const allPersonnel = [...assigned, ...legacy];

  if (personnelQuery.isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4" data-testid="institution-personnel-manager">
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
                  <div className="p-3 text-xs text-muted-foreground">{t.common?.noResults || "No results"}</div>
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{mpnT.department || "Department"}</Label>
              <Input className="h-8 mt-1" value={assignDepartment} onChange={e => setAssignDepartment(e.target.value)} data-testid="input-assign-department" />
            </div>
            <div>
              <Label className="text-xs">{mpnT.position || "Position"}</Label>
              <Input className="h-8 mt-1" value={assignPosition} onChange={e => setAssignPosition(e.target.value)} data-testid="input-assign-position" />
            </div>
            <div>
              <Label className="text-xs">{mpnT.role || "Role"}</Label>
              <Input className="h-8 mt-1" value={assignRole} onChange={e => setAssignRole(e.target.value)} data-testid="input-assign-role" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{mpnT.category || "Category"}</Label>
              <Select value={assignCategoryId} onValueChange={setAssignCategoryId}>
                <SelectTrigger className="h-8 mt-1" data-testid="select-assign-category"><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {(categoriesQuery.data || []).map((cat: any) => (<SelectItem key={cat.id} value={cat.id}>{getLocalizedCategoryName(cat, locale)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm h-8">
                <input type="checkbox" checked={assignIsPrimary} onChange={e => setAssignIsPrimary(e.target.checked)} data-testid="checkbox-assign-primary" />
                <Star className="h-3.5 w-3.5 text-amber-500" />
                {mpnT.primaryContact || "Primary"}
              </label>
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

      {allPersonnel.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{mpnT.noPersonnel || "No personnel assigned"}</p>
        </div>
      )}

      <div className="space-y-1">
        {allPersonnel.map((p: any, idx: number) => {
          const fullName = [p.title_before, p.first_name, p.last_name, p.title_after].filter(Boolean).join(" ");
          const isLegacy = p.source === "legacy_link";
          const isEditing = editingId.length > 0 && editingId === p.assignment_id;

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
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">{mpnT.department || "Department"}</Label>
                    <Input className="h-8 mt-1" value={editData.department} onChange={e => setEditData({ ...editData, department: e.target.value })} data-testid="input-edit-department" />
                  </div>
                  <div>
                    <Label className="text-xs">{mpnT.position || "Position"}</Label>
                    <Input className="h-8 mt-1" value={editData.position} onChange={e => setEditData({ ...editData, position: e.target.value })} data-testid="input-edit-position" />
                  </div>
                  <div>
                    <Label className="text-xs">{mpnT.role || "Role"}</Label>
                    <Input className="h-8 mt-1" value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })} data-testid="input-edit-role" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{mpnT.category || "Category"}</Label>
                    <Select value={editData.categoryId} onValueChange={v => setEditData({ ...editData, categoryId: v })}>
                      <SelectTrigger className="h-8 mt-1" data-testid="select-edit-category"><SelectValue placeholder="-" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">-</SelectItem>
                        {(categoriesQuery.data || []).map((cat: any) => (<SelectItem key={cat.id} value={cat.id}>{getLocalizedCategoryName(cat, locale)}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm h-8">
                      <input type="checkbox" checked={editData.isPrimary} onChange={e => setEditData({ ...editData, isPrimary: e.target.checked })} data-testid="checkbox-edit-primary" />
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      {mpnT.primaryContact || "Primary"}
                    </label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{mpnT.notes || "Notes"}</Label>
                  <Textarea className="mt-1 h-16 text-sm" value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} data-testid="textarea-edit-notes" />
                </div>
              </div>
            );
          }

          const details = [p.department, p.position, p.role].filter(Boolean).join(" · ");
          const catName = p.category_name
            ? (p.category_id ? getLocalizedCategoryName((categoriesQuery.data || []).find((c: any) => c.id === p.category_id) || { name: p.category_name }, locale) : p.category_name)
            : null;

          return (
            <div key={p.assignment_id || `legacy-${idx}`} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/40 transition-colors group" data-testid={`card-person-drawer-${p.person_id}`}>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="font-medium text-sm truncate">{fullName}</span>
                {p.is_primary && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                {catName && <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">{catName}</Badge>}
                {isLegacy && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">Legacy</Badge>}
                {p.is_active === false && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">{t.common?.inactive || "Inactive"}</Badge>}
              </div>
              {details && <span className="text-[11px] text-muted-foreground truncate max-w-[200px] hidden sm:inline">{details}</span>}
              {(p.email || p.phone) && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[150px] hidden md:inline">{p.email || p.phone}</span>
              )}
              <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary"
                  onClick={() => startEditing(p)} disabled={convertLegacyMutation.isPending} data-testid={`button-edit-person-${p.person_id}`}>
                  {convertLegacyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
                </Button>
                {p.assignment_id && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMutation.mutate(p.assignment_id)} disabled={removeMutation.isPending} data-testid={`button-remove-person-drawer-${p.person_id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
