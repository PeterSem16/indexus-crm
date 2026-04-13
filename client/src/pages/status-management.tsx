import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Database,
  Search,
  Filter,
  Settings2,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  MessageSquare,
  ArrowLeft,
  RotateCcw,
  Eye,
  Check,
} from "lucide-react";
import type { StatusCategory, StatusDefinition } from "@shared/schema";
import { STATUS_ACTION_TYPES } from "@shared/schema";

const ACTION_LABELS: Record<string, string> = {
  none: "Žiadna",
  callback: "Spätné volanie",
  do_not_call: "Nevolať",
  complete: "Dokončiť",
  conversion: "Konverzia",
  send_email: "Odoslať email",
  send_sms: "Odoslať SMS",
  schedule_email: "Schedule email",
  schedule_sms: "Schedule SMS",
  assign_owner: "Priradiť vlastníkovi",
  move_queue: "Presunúť do fronty",
  start_onboarding: "Spustiť onboarding",
  create_task: "Vytvoriť task",
  verify_contact: "Verifikácia kontaktu",
};

const CATEGORY_COLORS: Record<string, string> = {
  gray: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600",
  blue: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-600",
  green: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-600",
  purple: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-600",
  cyan: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900 dark:text-cyan-200 dark:border-cyan-600",
  teal: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900 dark:text-teal-200 dark:border-teal-600",
  orange: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-600",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-600",
  red: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-600",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-600",
};

const ACTION_COLORS: Record<string, string> = {
  none: "bg-gray-100 text-gray-700",
  callback: "bg-blue-100 text-blue-700",
  do_not_call: "bg-red-100 text-red-700",
  complete: "bg-emerald-100 text-emerald-700",
  conversion: "bg-green-100 text-green-700",
  send_email: "bg-cyan-100 text-cyan-700",
  send_sms: "bg-purple-100 text-purple-700",
  schedule_email: "bg-sky-100 text-sky-700",
  schedule_sms: "bg-indigo-100 text-indigo-700",
  assign_owner: "bg-amber-100 text-amber-700",
  move_queue: "bg-orange-100 text-orange-700",
  start_onboarding: "bg-teal-100 text-teal-700",
  create_task: "bg-violet-100 text-violet-700",
  verify_contact: "bg-yellow-100 text-yellow-700",
};

export default function StatusManagement() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editingStatus, setEditingStatus] = useState<StatusDefinition | null>(null);
  const [editingCategory, setEditingCategory] = useState<StatusCategory | null>(null);
  const [isNewStatus, setIsNewStatus] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "status"; id: string; name: string } | null>(null);
  const [pulsePreviewOpen, setPulsePreviewOpen] = useState(false);

  const { data: categories = [], isLoading: catLoading } = useQuery<StatusCategory[]>({
    queryKey: ["/api/status-categories"],
  });

  const { data: statuses = [], isLoading: statusLoading } = useQuery<StatusDefinition[]>({
    queryKey: ["/api/status-definitions"],
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/status-definitions/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/status-definitions"] });
      toast({ title: "Seed úspešný", description: "Všetky kategórie a statusy boli naplnené." });
    },
    onError: (error: any) => {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/status-definitions/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/status-definitions"] });
      toast({ title: "Vymazané", description: "Všetky statusy a kategórie boli odstránené." });
    },
  });

  const saveStatusMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, createdAt, updatedAt, ...payload } = data;
      if (isNewStatus) {
        return apiRequest("POST", "/api/status-definitions", payload);
      }
      return apiRequest("PATCH", `/api/status-definitions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status-definitions"] });
      setEditingStatus(null);
      setIsNewStatus(false);
      toast({ title: "Uložené" });
    },
    onError: (error: any) => {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, createdAt, updatedAt, ...payload } = data;
      if (isNewCategory) {
        return apiRequest("POST", "/api/status-categories", payload);
      }
      return apiRequest("PATCH", `/api/status-categories/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status-categories"] });
      setEditingCategory(null);
      setIsNewCategory(false);
      toast({ title: "Uložené" });
    },
    onError: (error: any) => {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      if (type === "category") {
        return apiRequest("DELETE", `/api/status-categories/${id}`);
      }
      return apiRequest("DELETE", `/api/status-definitions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/status-definitions"] });
      setDeleteTarget(null);
      toast({ title: "Odstránené" });
    },
  });

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statusesByCategory = useMemo(() => {
    const map: Record<string, StatusDefinition[]> = {};
    for (const s of statuses) {
      if (!map[s.categoryId]) map[s.categoryId] = [];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) continue;
      }
      map[s.categoryId].push(s);
    }
    return map;
  }, [statuses, searchQuery]);

  const filteredCategories = useMemo(() => {
    if (filterCategory === "all") return categories;
    return categories.filter((c) => c.id === filterCategory);
  }, [categories, filterCategory]);

  const isLoading = catLoading || statusLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isEmpty = categories.length === 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-status-management-title">
            Status Engine
          </h1>
          <p className="text-muted-foreground mt-1">
            Správa kategórií, statusov, akcií a meta pravidiel pre kampane
          </p>
        </div>
        <div className="flex gap-2">
          {isEmpty ? (
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              data-testid="button-seed-statuses"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
              Naplniť predvolené statusy
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsNewCategory(true);
                  setEditingCategory({
                    id: "",
                    name: "",
                    code: "",
                    color: "gray",
                    icon: "",
                    sortOrder: categories.length + 1,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  });
                }}
                data-testid="button-add-category"
              >
                <Plus className="h-4 w-4 mr-1" />
                Kategória
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (categories.length === 0) return;
                  setIsNewStatus(true);
                  setEditingStatus({
                    id: "",
                    categoryId: categories[0].id,
                    name: "",
                    code: "",
                    icon: "",
                    color: "gray",
                    defaultAction: "none",
                    isFinal: false,
                    isConversion: false,
                    requiresNote: false,
                    requiresCallback: false,
                    allowRecontact: true,
                    allowEmail: true,
                    allowSms: true,
                    allowPhone: true,
                    isSystemStatus: false,
                    callbackOffsetDays: null,
                    sortOrder: statuses.length + 1,
                    isActive: true,
                    visibleInCampaigns: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  });
                }}
                data-testid="button-add-status"
              >
                <Plus className="h-4 w-4 mr-1" />
                Status
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPulsePreviewOpen(true)}
                data-testid="button-nexus-pulse-preview"
              >
                <Eye className="h-4 w-4 mr-1" />
                Nexus Pulse
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                data-testid="button-clear-statuses"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </>
          )}
        </div>
      </div>

      {!isEmpty && (
        <>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hľadať status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-status"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[260px]" data-testid="select-filter-category">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrovať kategóriu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky kategórie</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{categories.length}</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">Kategórie</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950 border-green-200">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{statuses.length}</div>
                <div className="text-sm text-green-600 dark:text-green-400">Statusy celkom</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {statuses.filter((s) => s.isActive).length}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">Aktívne</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {filteredCategories.map((cat) => {
              const catStatuses = statusesByCategory[cat.id] || [];
              const isExpanded = expandedCategories.has(cat.id);
              const colorClass = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.gray;

              return (
                <Card key={cat.id} className="overflow-hidden" data-testid={`card-category-${cat.id}`}>
                  <div
                    className={`flex items-center justify-between p-4 cursor-pointer border-l-4 ${colorClass}`}
                    onClick={() => toggleCategory(cat.id)}
                    data-testid={`button-toggle-category-${cat.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      <div>
                        <div className="font-semibold text-base">{cat.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{cat.code}</div>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {catStatuses.length} statusov
                      </Badge>
                      {!cat.isActive && (
                        <Badge variant="outline" className="text-red-500 border-red-300">
                          neaktívna
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setIsNewCategory(false);
                          setEditingCategory(cat);
                        }}
                        data-testid={`button-edit-category-${cat.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => setDeleteTarget({ type: "category", id: cat.id, name: cat.name })}
                        data-testid={`button-delete-category-${cat.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t">
                      <div className="p-3 bg-muted/30">
                        <div className="grid grid-cols-[1fr_120px_140px_80px_80px_80px_80px_60px_60px] gap-2 text-xs font-medium text-muted-foreground px-2">
                          <div>Názov / Kód</div>
                          <div>Predvolená akcia</div>
                          <div>Meta pravidlá</div>
                          <div className="text-center">
                            <Phone className="h-3 w-3 inline" />
                          </div>
                          <div className="text-center">
                            <Mail className="h-3 w-3 inline" />
                          </div>
                          <div className="text-center">
                            <MessageSquare className="h-3 w-3 inline" />
                          </div>
                          <div className="text-center">Aktívny</div>
                          <div></div>
                          <div></div>
                        </div>
                      </div>
                      {catStatuses.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                          {searchQuery ? "Žiadne výsledky" : "Žiadne statusy v tejto kategórii"}
                        </div>
                      ) : (
                        <div className="divide-y">
                          {catStatuses.map((status) => (
                            <div
                              key={status.id}
                              className="grid grid-cols-[1fr_120px_140px_80px_80px_80px_80px_60px_60px] gap-2 items-center px-5 py-2.5 hover:bg-muted/30 transition-colors text-sm"
                              data-testid={`row-status-${status.id}`}
                            >
                              <div>
                                <div className="font-medium">{status.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{status.code}</div>
                              </div>
                              <div>
                                <Badge className={`text-[10px] px-1.5 py-0 ${ACTION_COLORS[status.defaultAction] || ""}`}>
                                  {ACTION_LABELS[status.defaultAction] || status.defaultAction}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {status.isFinal && <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-300 text-red-600">Finálny</Badge>}
                                {status.isConversion && <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-600">Konverzia</Badge>}
                                {status.requiresNote && <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-600">Poznámka</Badge>}
                                {status.requiresCallback && <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-300 text-blue-600">Callback</Badge>}
                                {status.isSystemStatus && <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-300 text-purple-600">Systém</Badge>}
                              </div>
                              <div className="text-center">
                                {status.allowPhone ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                              </div>
                              <div className="text-center">
                                {status.allowEmail ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                              </div>
                              <div className="text-center">
                                {status.allowSms ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                              </div>
                              <div className="text-center">
                                {status.isActive ? (
                                  <Badge className="bg-green-100 text-green-700 text-[10px]">Áno</Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-700 text-[10px]">Nie</Badge>
                                )}
                              </div>
                              <div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setIsNewStatus(false);
                                    setEditingStatus(status);
                                  }}
                                  data-testid={`button-edit-status-${status.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500"
                                  onClick={() => setDeleteTarget({ type: "status", id: status.id, name: status.name })}
                                  data-testid={`button-delete-status-${status.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="p-3 border-t bg-muted/20">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setIsNewStatus(true);
                            setEditingStatus({
                              id: "",
                              categoryId: cat.id,
                              name: "",
                              code: "",
                              icon: "",
                              color: cat.color,
                              defaultAction: "none",
                              isFinal: false,
                              isConversion: false,
                              requiresNote: false,
                              requiresCallback: false,
                              allowRecontact: true,
                              allowEmail: true,
                              allowSms: true,
                              allowPhone: true,
                              isSystemStatus: false,
                              callbackOffsetDays: null,
                              sortOrder: (catStatuses.length + 1),
                              isActive: true,
                              visibleInCampaigns: true,
                              createdAt: new Date(),
                              updatedAt: new Date(),
                            });
                          }}
                          data-testid={`button-add-status-to-${cat.id}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Pridať status do tejto kategórie
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

      {isEmpty && (
        <Card className="p-12 text-center">
          <Database className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Žiadne statusy</h3>
          <p className="text-muted-foreground mb-4">
            Klikni na "Naplniť predvolené statusy" pre naimportovanie kompletného setu 9 kategórií a 120+ statusov.
          </p>
        </Card>
      )}

      {editingStatus && (
        <StatusEditDialog
          status={editingStatus}
          categories={categories}
          isNew={isNewStatus}
          onSave={(data) => saveStatusMutation.mutate(data)}
          onClose={() => {
            setEditingStatus(null);
            setIsNewStatus(false);
          }}
          isPending={saveStatusMutation.isPending}
        />
      )}

      {editingCategory && (
        <CategoryEditDialog
          category={editingCategory}
          isNew={isNewCategory}
          onSave={(data) => saveCategoryMutation.mutate(data)}
          onClose={() => {
            setEditingCategory(null);
            setIsNewCategory(false);
          }}
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
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id })}
            >
              Odstrániť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pulsePreviewOpen && (
        <NexusPulsePreview
          categories={categories}
          statuses={statuses.filter(s => s.isActive)}
          onClose={() => setPulsePreviewOpen(false)}
        />
      )}
    </div>
  );
}

function NexusPulsePreview({ categories, statuses, onClose }: {
  categories: StatusCategory[];
  statuses: StatusDefinition[];
  onClose: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<StatusDefinition | null>(null);
  const [channelFilter, setChannelFilter] = useState<"all" | "phone" | "email" | "sms">("all");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackTime, setCallbackTime] = useState("09:00");
  const [notes, setNotes] = useState("");

  const STATUS_COLORS: Record<string, string> = {
    gray: "bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-800",
    blue: "bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-800",
    green: "bg-green-100 hover:bg-green-200 border-green-300 text-green-800",
    purple: "bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-800",
    cyan: "bg-cyan-100 hover:bg-cyan-200 border-cyan-300 text-cyan-800",
    teal: "bg-teal-100 hover:bg-teal-200 border-teal-300 text-teal-800",
    orange: "bg-orange-100 hover:bg-orange-200 border-orange-300 text-orange-800",
    emerald: "bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-800",
    red: "bg-red-100 hover:bg-red-200 border-red-300 text-red-800",
    yellow: "bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-800",
  };

  const statusesByCat = useMemo(() => {
    const map: Record<string, StatusDefinition[]> = {};
    for (const s of statuses) {
      if (!map[s.categoryId]) map[s.categoryId] = [];
      map[s.categoryId].push(s);
    }
    return map;
  }, [statuses]);

  const filteredStatuses = useMemo(() => {
    let sts = selectedCategory === "all" ? statuses : statuses.filter(s => s.categoryId === selectedCategory);
    if (channelFilter === "phone") sts = sts.filter(s => s.allowPhone);
    if (channelFilter === "email") sts = sts.filter(s => s.allowEmail);
    if (channelFilter === "sms") sts = sts.filter(s => s.allowSms);
    return sts;
  }, [statuses, selectedCategory, channelFilter]);

  const visibleCategories = useMemo(() => {
    return categories.filter(c => (statusesByCat[c.id] || []).length > 0).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, statusesByCat]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-5 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            <DialogTitle className="text-white text-xl font-bold">
              Nexus Pulse — Simulátor dispozícií
            </DialogTitle>
          </div>
          <p className="text-blue-100 text-sm mt-1">
            Náhľad rozhrania agenta pre výber statusov po ukončení hovoru
          </p>
          <div className="flex gap-2 mt-3">
            {(["all", "phone", "email", "sms"] as const).map(ch => (
              <Button
                key={ch}
                variant={channelFilter === ch ? "secondary" : "ghost"}
                size="sm"
                className={channelFilter === ch ? "bg-white/20 text-white hover:bg-white/30" : "text-blue-200 hover:bg-white/10 hover:text-white"}
                onClick={() => setChannelFilter(ch)}
                data-testid={`pulse-channel-${ch}`}
              >
                {ch === "all" && "Všetky kanály"}
                {ch === "phone" && <><Phone className="h-3.5 w-3.5 mr-1" /> Telefón</>}
                {ch === "email" && <><Mail className="h-3.5 w-3.5 mr-1" /> Email</>}
                {ch === "sms" && <><MessageSquare className="h-3.5 w-3.5 mr-1" /> SMS</>}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!selectedStatus ? (
            <>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                  data-testid="pulse-cat-all"
                >
                  Všetky ({filteredStatuses.length})
                </Button>
                {visibleCategories.map(cat => {
                  const catCount = (statusesByCat[cat.id] || []).filter(s => {
                    if (channelFilter === "phone") return s.allowPhone;
                    if (channelFilter === "email") return s.allowEmail;
                    if (channelFilter === "sms") return s.allowSms;
                    return true;
                  }).length;
                  if (catCount === 0) return null;
                  return (
                    <Button
                      key={cat.id}
                      variant={selectedCategory === cat.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(cat.id)}
                      data-testid={`pulse-cat-${cat.id}`}
                    >
                      {cat.name} ({catCount})
                    </Button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {filteredStatuses.map((status) => {
                  const colorClass = STATUS_COLORS[status.color || "gray"] || STATUS_COLORS.gray;
                  return (
                    <button
                      key={status.id}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${colorClass} hover:shadow-md active:scale-[0.98]`}
                      onClick={() => setSelectedStatus(status)}
                      data-testid={`pulse-status-${status.id}`}
                    >
                      <div className="font-semibold text-sm">{status.name}</div>
                      <div className="text-xs opacity-70 mt-0.5 flex items-center gap-1">
                        <Badge className={`${ACTION_COLORS[status.defaultAction] || ""} text-[9px] px-1 py-0`}>
                          {ACTION_LABELS[status.defaultAction] || status.defaultAction}
                        </Badge>
                        {status.isFinal && <span className="text-red-600 font-bold">F</span>}
                        {status.isConversion && <span className="text-green-600 font-bold">K</span>}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {status.allowPhone && <Phone className="h-3 w-3 text-blue-500" />}
                        {status.allowEmail && <Mail className="h-3 w-3 text-purple-500" />}
                        {status.allowSms && <MessageSquare className="h-3 w-3 text-teal-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredStatuses.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Žiadne statusy pre vybraný filter</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedStatus(null); setNotes(""); setCallbackDate(""); }}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Späť
                </Button>
                <h3 className="font-semibold text-lg">{selectedStatus.name}</h3>
                <Badge className={`${ACTION_COLORS[selectedStatus.defaultAction] || ""}`}>
                  {ACTION_LABELS[selectedStatus.defaultAction]}
                </Badge>
              </div>

              <Card className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">Finálny:</span>
                    <Badge variant={selectedStatus.isFinal ? "destructive" : "secondary"}>
                      {selectedStatus.isFinal ? "Áno" : "Nie"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">Konverzia:</span>
                    <Badge variant={selectedStatus.isConversion ? "default" : "secondary"} className={selectedStatus.isConversion ? "bg-green-600" : ""}>
                      {selectedStatus.isConversion ? "Áno" : "Nie"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">Systémový:</span>
                    <span>{selectedStatus.isSystemStatus ? "Áno" : "Nie"}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">Kód:</span>
                    <code className="text-xs bg-muted px-1 rounded">{selectedStatus.code}</code>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-3">
                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${selectedStatus.allowPhone ? "bg-blue-50 border-blue-200" : "bg-muted/30 border-transparent"}`}>
                    <Phone className={`h-5 w-5 ${selectedStatus.allowPhone ? "text-blue-500" : "text-muted-foreground"}`} />
                    <div>
                      <div className="text-sm font-medium">Telefón</div>
                      <div className="text-xs text-muted-foreground">{selectedStatus.allowPhone ? "Povolený" : "Nepovolený"}</div>
                    </div>
                    {selectedStatus.allowPhone && <Check className="h-4 w-4 text-green-500 ml-auto" />}
                  </div>
                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${selectedStatus.allowEmail ? "bg-purple-50 border-purple-200" : "bg-muted/30 border-transparent"}`}>
                    <Mail className={`h-5 w-5 ${selectedStatus.allowEmail ? "text-purple-500" : "text-muted-foreground"}`} />
                    <div>
                      <div className="text-sm font-medium">Email</div>
                      <div className="text-xs text-muted-foreground">{selectedStatus.allowEmail ? "Povolený" : "Nepovolený"}</div>
                    </div>
                    {selectedStatus.allowEmail && <Check className="h-4 w-4 text-green-500 ml-auto" />}
                  </div>
                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${selectedStatus.allowSms ? "bg-teal-50 border-teal-200" : "bg-muted/30 border-transparent"}`}>
                    <MessageSquare className={`h-5 w-5 ${selectedStatus.allowSms ? "text-teal-500" : "text-muted-foreground"}`} />
                    <div>
                      <div className="text-sm font-medium">SMS</div>
                      <div className="text-xs text-muted-foreground">{selectedStatus.allowSms ? "Povolený" : "Nepovolený"}</div>
                    </div>
                    {selectedStatus.allowSms && <Check className="h-4 w-4 text-green-500 ml-auto" />}
                  </div>
                </div>

                {selectedStatus.requiresCallback && (
                  <>
                    <Separator />
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <Label className="text-sm font-medium flex items-center gap-1 mb-2">
                        <Phone className="h-4 w-4" />
                        Callback — povinné polia
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Dátum</Label>
                          <Input type="date" value={callbackDate} onChange={(e: any) => setCallbackDate(e.target.value)} data-testid="pulse-callback-date" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Čas</Label>
                          <Input type="time" value={callbackTime} onChange={(e: any) => setCallbackTime(e.target.value)} data-testid="pulse-callback-time" />
                        </div>
                      </div>
                      {selectedStatus.callbackOffsetDays && (
                        <p className="text-xs text-blue-600 mt-2">
                          Predvolený offset: +{selectedStatus.callbackOffsetDays} dní od teraz
                        </p>
                      )}
                    </div>
                  </>
                )}

                {selectedStatus.requiresNote && (
                  <>
                    <Separator />
                    <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                      <Label className="text-sm font-medium mb-2 block">Poznámka (povinná)</Label>
                      <textarea
                        className="w-full p-2 border rounded-md text-sm min-h-[80px] resize-none bg-white dark:bg-gray-900"
                        placeholder="Agent musí vyplniť poznámku..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        data-testid="pulse-notes"
                      />
                    </div>
                  </>
                )}
              </Card>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setSelectedStatus(null); setNotes(""); setCallbackDate(""); }}>
                  Zrušiť
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  disabled={
                    (selectedStatus.requiresNote && !notes.trim()) ||
                    (selectedStatus.requiresCallback && !callbackDate)
                  }
                  data-testid="pulse-confirm"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Potvrdiť dispozíciu
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusEditDialog({
  status,
  categories,
  isNew,
  onSave,
  onClose,
  isPending,
}: {
  status: StatusDefinition;
  categories: StatusCategory[];
  isNew: boolean;
  onSave: (data: any) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({ ...status });

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nový status" : `Upraviť: ${status.name}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Názov</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} data-testid="input-status-name" />
            </div>
            <div>
              <Label>Kód</Label>
              <Input value={form.code} onChange={(e) => update("code", e.target.value)} data-testid="input-status-code" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Kategória</Label>
              <Select value={form.categoryId} onValueChange={(v) => update("categoryId", v)}>
                <SelectTrigger data-testid="select-status-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ikona</Label>
              <Input value={form.icon || ""} onChange={(e) => update("icon", e.target.value)} placeholder="napr. PhoneOff" data-testid="input-status-icon" />
            </div>
            <div>
              <Label>Farba</Label>
              <Select value={form.color || "gray"} onValueChange={(v) => update("color", v)}>
                <SelectTrigger data-testid="select-status-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["gray", "blue", "green", "purple", "cyan", "teal", "orange", "emerald", "red", "yellow"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Predvolená akcia</Label>
              <Select value={form.defaultAction} onValueChange={(v) => update("defaultAction", v)}>
                <SelectTrigger data-testid="select-status-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ACTION_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Callback offset (dni)</Label>
              <Input
                type="number"
                value={form.callbackOffsetDays ?? ""}
                onChange={(e) => update("callbackOffsetDays", e.target.value ? parseInt(e.target.value) : null)}
                placeholder="napr. 7"
                data-testid="input-callback-offset"
              />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Meta pravidlá</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "isFinal", label: "Finálny status" },
                { key: "isConversion", label: "Počítať do konverzie" },
                { key: "requiresNote", label: "Vyžaduje poznámku" },
                { key: "requiresCallback", label: "Vyžaduje callback dátum" },
                { key: "allowRecontact", label: "Povoliť opätovný kontakt" },
                { key: "allowPhone", label: "Povoliť telefón" },
                { key: "allowEmail", label: "Povoliť email" },
                { key: "allowSms", label: "Povoliť SMS" },
                { key: "isSystemStatus", label: "Systémový status" },
                { key: "visibleInCampaigns", label: "Viditeľný v kampaniach" },
                { key: "isActive", label: "Aktívny" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-sm">{label}</Label>
                  <Switch
                    checked={!!(form as any)[key]}
                    onCheckedChange={(v) => update(key, v)}
                    data-testid={`switch-status-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Poradie</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => update("sortOrder", parseInt(e.target.value) || 0)}
              data-testid="input-sort-order"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Zrušiť</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={isPending || !form.name || !form.code || !form.categoryId}
            data-testid="button-save-status"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Uložiť
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryEditDialog({
  category,
  isNew,
  onSave,
  onClose,
  isPending,
}: {
  category: StatusCategory;
  isNew: boolean;
  onSave: (data: any) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({ ...category });
  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nová kategória" : `Upraviť: ${category.name}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Názov</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} data-testid="input-category-name" />
          </div>
          <div>
            <Label>Kód</Label>
            <Input value={form.code} onChange={(e) => update("code", e.target.value)} data-testid="input-category-code" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Farba</Label>
              <Select value={form.color} onValueChange={(v) => update("color", v)}>
                <SelectTrigger data-testid="select-category-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["gray", "blue", "green", "purple", "cyan", "teal", "orange", "emerald", "red", "yellow"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ikona</Label>
              <Input value={form.icon || ""} onChange={(e) => update("icon", e.target.value)} placeholder="napr. PhoneOff" data-testid="input-category-icon" />
            </div>
          </div>
          <div>
            <Label>Poradie</Label>
            <Input type="number" value={form.sortOrder} onChange={(e) => update("sortOrder", parseInt(e.target.value) || 0)} data-testid="input-category-sort" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Aktívna</Label>
            <Switch checked={form.isActive} onCheckedChange={(v) => update("isActive", v)} data-testid="switch-category-active" />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Zrušiť</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={isPending || !form.name || !form.code}
            data-testid="button-save-category"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Uložiť
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
