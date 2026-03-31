import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
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
  const { t } = useI18n();
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
    enabled: open && showAssignForm,
  });

  const collabLookupQuery = useQuery<any[]>({
    queryKey: ["/api/collaborators/lookup"],
    enabled: open && showAssignForm,
  });

  const filteredCollabs = (collabLookupQuery.data || []).filter((c: any) => {
    if (collabSearch.length < 2) return false;
    const search = collabSearch.toLowerCase();
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    return fullName.includes(search) || c.lastName?.toLowerCase().includes(search) || c.firstName?.toLowerCase().includes(search);
  }).slice(0, 20);

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
                  {collabSearch.length >= 2 && !selectedCollabId && (
                    <div className="mt-1 border rounded max-h-40 overflow-y-auto bg-background">
                      {filteredCollabs.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">{t.common?.noResults || "No results"}</div>
                      ) : (
                        filteredCollabs.map((c: any) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0 flex items-center justify-between"
                            onClick={() => {
                              setSelectedCollabId(c.id);
                              setCollabSearch(`${c.firstName} ${c.lastName}`.trim());
                            }}
                            data-testid={`option-collaborator-${c.id}`}
                          >
                            <span className="font-medium">
                              {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                            </span>
                            <span className="text-xs text-muted-foreground">{c.countryCode || ""}</span>
                          </button>
                        ))
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
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
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
                            <Badge variant="outline" className="text-[10px]">{p.category_name}</Badge>
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
