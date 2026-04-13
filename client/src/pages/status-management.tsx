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
import { STATUS_ACTION_TYPES, RESCHEDULE_PERIOD_OPTIONS } from "@shared/schema";

const ACTION_LABELS: Record<string, string> = {
  none: "Žiadna",
  callback: "Spätné volanie",
  reschedule: "Preplánovať hovor",
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
  reschedule: "bg-sky-100 text-sky-700",
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
                    parentId: null,
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
                    rescheduleOptions: null,
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
                          {(() => {
                            const parents = catStatuses.filter(s => !s.parentId);
                            const childMap: Record<string, StatusDefinition[]> = {};
                            for (const s of catStatuses) {
                              if (s.parentId) {
                                if (!childMap[s.parentId]) childMap[s.parentId] = [];
                                childMap[s.parentId].push(s);
                              }
                            }
                            const renderStatusRow = (status: StatusDefinition, isChild: boolean) => (
                              <div
                                key={status.id}
                                className={`grid grid-cols-[1fr_120px_140px_80px_80px_80px_80px_60px_60px] gap-2 items-center px-5 py-2.5 hover:bg-muted/30 transition-colors text-sm ${isChild ? "bg-muted/10" : ""}`}
                                data-testid={`row-status-${status.id}`}
                              >
                                <div className={isChild ? "pl-6" : ""}>
                                  <div className="flex items-center gap-1.5">
                                    {isChild && <span className="text-muted-foreground">└</span>}
                                    <div className="font-medium">{status.name}</div>
                                    {status.parentId && <Badge variant="outline" className="text-[8px] px-1 py-0 border-sky-300 text-sky-600">Pod</Badge>}
                                  </div>
                                  <div className={`text-xs text-muted-foreground font-mono ${isChild ? "pl-5" : ""}`}>{status.code}</div>
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
                                  {(status as any).rescheduleOptions?.length > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 border-sky-300 text-sky-600">Prepl.</Badge>}
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
                                <div className="flex">
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
                                  {!isChild && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-sky-500"
                                      title="Pridať podstatus"
                                      onClick={() => {
                                        setIsNewStatus(true);
                                        setEditingStatus({
                                          id: "",
                                          categoryId: cat.id,
                                          parentId: status.id,
                                          name: "",
                                          code: "",
                                          icon: "",
                                          color: status.color,
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
                                          rescheduleOptions: null,
                                          sortOrder: (childMap[status.id]?.length || 0) + 1,
                                          isActive: true,
                                          visibleInCampaigns: true,
                                          createdAt: new Date(),
                                          updatedAt: new Date(),
                                        });
                                      }}
                                      data-testid={`button-add-substatus-${status.id}`}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
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
                            );
                            return parents.map(parent => (
                              <div key={parent.id}>
                                {renderStatusRow(parent, false)}
                                {(childMap[parent.id] || []).map(child => renderStatusRow(child, true))}
                              </div>
                            ));
                          })()}
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
                              parentId: null,
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
                              rescheduleOptions: null,
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
          allStatuses={statuses}
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

    </div>
  );
}


function StatusEditDialog({
  status,
  categories,
  allStatuses,
  isNew,
  onSave,
  onClose,
  isPending,
}: {
  status: StatusDefinition;
  categories: StatusCategory[];
  allStatuses: StatusDefinition[];
  isNew: boolean;
  onSave: (data: any) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({ ...status, rescheduleOptions: (status as any).rescheduleOptions || [] });

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const parentCandidates = useMemo(() => {
    return allStatuses.filter(s => !s.parentId && s.id !== status.id);
  }, [allStatuses, status.id]);

  const toggleRescheduleOption = (value: string) => {
    const current: string[] = form.rescheduleOptions || [];
    if (current.includes(value)) {
      update("rescheduleOptions", current.filter((v: string) => v !== value));
    } else {
      update("rescheduleOptions", [...current, value]);
    }
  };

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
              <Label>Nadradený status</Label>
              <Select value={form.parentId || "__none__"} onValueChange={(v) => update("parentId", v === "__none__" ? null : v)}>
                <SelectTrigger data-testid="select-status-parent">
                  <SelectValue placeholder="Žiadny (hlavný status)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Žiadny (hlavný status) —</SelectItem>
                  {parentCandidates.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Ikona</Label>
              <Input value={form.icon || ""} onChange={(e) => update("icon", e.target.value)} placeholder="napr. PhoneOff" data-testid="input-status-icon" />
            </div>
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

          {(form.defaultAction === "reschedule" || form.defaultAction === "callback") && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Možnosti preplánovania</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Vyberte časové obdobia, ktoré bude agent vidieť pri tomto statuse
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {RESCHEDULE_PERIOD_OPTIONS.map((opt) => {
                    const isSelected = (form.rescheduleOptions || []).includes(opt.value);
                    return (
                      <div
                        key={opt.value}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-transparent bg-muted/30 hover:bg-muted/50"
                        }`}
                        onClick={() => toggleRescheduleOption(opt.value)}
                        data-testid={`reschedule-opt-${opt.value}`}
                      >
                        <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                          isSelected ? "bg-primary border-primary" : "border-gray-300"
                        }`}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <span className="text-sm">{opt.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

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
