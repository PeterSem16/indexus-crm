import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Edit, Trash2, Users, UserPlus, ArrowLeft, GripVertical, RotateCcw, Building2, Search, X } from "lucide-react";
import type { User } from "@shared/schema";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n/I18nProvider";

const GROUP_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#84cc16", "#f97316",
];

type TaskGroup = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number | null;
  displayAlias?: string | null;
  isBackOffice?: boolean | null;
  roleSortOrders?: Record<string, number>;
  members: { userId: string; fullName: string; avatarUrl?: string | null }[];
};

const emptyForm = () => ({
  name: "",
  description: "",
  color: GROUP_COLORS[0],
  displayAlias: "",
  isBackOffice: false,
  memberUserIds: [] as string[],
});

export default function TaskGroupsPage() {
  const { t } = useI18n();
  const tg = t.tasks.taskGroups;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<TaskGroup | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [memberSearch, setMemberSearch] = useState("");

  const ROLES = [
    { value: "admin", label: tg.roleAdmin },
    { value: "manager", label: tg.roleManager },
    { value: "user", label: tg.roleUser },
  ] as const;

  const [localGroups, setLocalGroups] = useState<TaskGroup[] | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const [localRoleGroups, setLocalRoleGroups] = useState<Record<string, TaskGroup[] | null>>({});
  const roleDragItem = useRef<number | null>(null);
  const roleDragOverItem = useRef<number | null>(null);

  const { data: groups = [], isLoading } = useQuery<TaskGroup[]>({
    queryKey: ["/api/task-groups"],
  });

  const displayGroups = localGroups ?? groups;

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, displayAlias: form.displayAlias || null };
      if (editGroup) {
        return apiRequest("PUT", `/api/task-groups/${editGroup.id}`, payload);
      }
      return apiRequest("POST", "/api/task-groups", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      setLocalGroups(null);
      toast({ title: editGroup ? tg.groupUpdated : tg.groupCreated });
      setDialogOpen(false);
      setEditGroup(null);
      setForm(emptyForm());
    },
    onError: () => {
      toast({ title: tg.saveFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/task-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      setLocalGroups(null);
      toast({ title: tg.groupDeleted });
    },
    onError: () => {
      toast({ title: tg.deleteFailed, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ordered: TaskGroup[]) => {
      const order = ordered.map((g, i) => ({ id: g.id, sortOrder: i }));
      return apiRequest("PUT", "/api/task-groups-reorder", { order });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      toast({ title: tg.orderSaved });
    },
    onError: () => {
      toast({ title: tg.orderFailed, variant: "destructive" });
    },
  });

  const reorderRoleMutation = useMutation({
    mutationFn: async ({ role, ordered }: { role: string; ordered: TaskGroup[] }) => {
      const order = ordered.map((g, i) => ({ id: g.id, sortOrder: i }));
      return apiRequest("PUT", "/api/task-groups-reorder-role", { role, order });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      toast({ title: tg.roleOrderSaved });
    },
    onError: () => {
      toast({ title: tg.roleOrderFailed, variant: "destructive" });
    },
  });

  const clearRoleMutation = useMutation({
    mutationFn: async (role: string) => apiRequest("DELETE", `/api/task-groups-reorder-role/${role}`),
    onSuccess: (_, role) => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      setLocalRoleGroups(prev => ({ ...prev, [role]: null }));
      toast({ title: tg.roleOrderReset });
    },
    onError: () => {
      toast({ title: tg.resetFailed, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditGroup(null);
    setForm(emptyForm());
    setMemberSearch("");
    setDialogOpen(true);
  };

  const openEdit = (g: TaskGroup) => {
    setEditGroup(g);
    setForm({
      name: g.name,
      description: g.description || "",
      color: g.color || GROUP_COLORS[0],
      displayAlias: g.displayAlias || "",
      isBackOffice: g.isBackOffice ?? false,
      memberUserIds: g.members.map(m => m.userId),
    });
    setMemberSearch("");
    setDialogOpen(true);
  };

  const toggleMember = (uid: string) => {
    setForm(f => ({
      ...f,
      memberUserIds: f.memberUserIds.includes(uid)
        ? f.memberUserIds.filter(id => id !== uid)
        : [...f.memberUserIds, uid],
    }));
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
    if (dragItem.current === null || dragItem.current === index) return;
    const base = localGroups ?? groups;
    const reordered = [...base];
    const [moved] = reordered.splice(dragItem.current, 1);
    reordered.splice(index, 0, moved);
    dragItem.current = index;
    setLocalGroups(reordered);
  };

  const handleDragEnd = () => {
    if (localGroups) {
      reorderMutation.mutate(localGroups);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const getRoleDisplayGroups = (role: string): TaskGroup[] => {
    const local = localRoleGroups[role];
    if (local) return local;
    const hasRoleOrder = groups.some(g => g.roleSortOrders && role in g.roleSortOrders);
    if (hasRoleOrder) {
      return [...groups].sort((a, b) => {
        const aOrder = a.roleSortOrders?.[role] ?? a.sortOrder ?? 0;
        const bOrder = b.roleSortOrders?.[role] ?? b.sortOrder ?? 0;
        return aOrder - bOrder;
      });
    }
    return [...groups];
  };

  const roleHasCustomOrder = (role: string): boolean => {
    return groups.some(g => g.roleSortOrders && role in g.roleSortOrders);
  };

  const handleRoleDragStart = (index: number) => {
    roleDragItem.current = index;
  };

  const handleRoleDragEnter = (role: string, index: number) => {
    roleDragOverItem.current = index;
    if (roleDragItem.current === null || roleDragItem.current === index) return;
    const base = localRoleGroups[role] ?? getRoleDisplayGroups(role);
    const reordered = [...base];
    const [moved] = reordered.splice(roleDragItem.current, 1);
    reordered.splice(index, 0, moved);
    roleDragItem.current = index;
    setLocalRoleGroups(prev => ({ ...prev, [role]: reordered }));
  };

  const handleRoleDragEnd = (role: string) => {
    const ordered = localRoleGroups[role];
    if (ordered) {
      reorderRoleMutation.mutate({ role, ordered });
    }
    roleDragItem.current = null;
    roleDragOverItem.current = null;
  };

  const selectedMembers = users.filter(u => form.memberUserIds.includes(u.id));
  const memberQuery = memberSearch.trim().toLowerCase();
  const filteredUsers = memberQuery
    ? users.filter(u =>
        (u.fullName || u.username || "").toLowerCase().includes(memberQuery) ||
        (u.email || "").toLowerCase().includes(memberQuery)
      )
    : users;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/tasks")}
            data-testid="btn-back-to-tasks"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t.tasks.title}
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-task-groups-title">{tg.title}</h1>
            <p className="text-muted-foreground text-sm">{tg.globalOrderDesc}</p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="btn-create-group">
          <Plus className="h-4 w-4 mr-2" />
          {tg.newGroup}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="global">
          <TabsList>
            <TabsTrigger value="global" data-testid="tab-order-global">{tg.globalOrder}</TabsTrigger>
            {ROLES.map(r => (
              <TabsTrigger key={r.value} value={r.value} data-testid={`tab-order-${r.value}`}>
                {r.label}
                {roleHasCustomOrder(r.value) && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Global ordering tab */}
          <TabsContent value="global" className="mt-4">
            <p className="text-xs text-muted-foreground mb-3">{tg.globalOrderDesc}</p>
            {displayGroups.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">{tg.noGroups}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {displayGroups.map((group, index) => (
                  <Card
                    key={group.id}
                    data-testid={`task-group-card-${group.id}`}
                    className="cursor-grab active:cursor-grabbing select-none"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: group.color || "#3b82f6" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm" data-testid={`text-group-name-${group.id}`}>{group.name}</span>
                            {group.displayAlias && (
                              <Badge variant="secondary" className="text-xs" data-testid={`text-group-alias-${group.id}`}>
                                {tg.aliasPrefix} {group.displayAlias}
                              </Badge>
                            )}
                            {group.isBackOffice && (
                              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400" data-testid={`badge-back-office-${group.id}`}>
                                <Building2 className="h-2.5 w-2.5 mr-1" />
                                {tg.backOffice}
                              </Badge>
                            )}
                            {group.description && (
                              <span className="text-xs text-muted-foreground truncate">— {group.description}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <UserPlus className="h-3 w-3 text-muted-foreground" />
                            {group.members.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">{tg.noMembers}</span>
                            ) : (
                              <div className="flex gap-1 flex-wrap">
                                {group.members.slice(0, 5).map(m => (
                                  <div key={m.userId} className="flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs">
                                    <Avatar className="h-3.5 w-3.5">
                                      <AvatarImage src={m.avatarUrl || undefined} className="object-cover" />
                                      <AvatarFallback className="text-[6px] bg-primary text-primary-foreground">
                                        {m.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{m.fullName}</span>
                                  </div>
                                ))}
                                {group.members.length > 5 && (
                                  <span className="text-xs text-muted-foreground">+{group.members.length - 5}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(group)}
                            data-testid={`btn-edit-group-${group.id}`}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive" data-testid={`btn-delete-group-${group.id}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{tg.deleteTitle}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {tg.deleteDesc}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{tg.cancel}</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteMutation.mutate(group.id)}
                                >
                                  {tg.deleteTitle.replace("?", "")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {reorderMutation.isPending && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {tg.savingOrder}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Per-role ordering tabs */}
          {ROLES.map(r => {
            const roleGroups = getRoleDisplayGroups(r.value);
            const hasCustom = roleHasCustomOrder(r.value);
            return (
              <TabsContent key={r.value} value={r.value} className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground">
                    {hasCustom
                      ? `${r.label}: ${tg.roleOrderSaved}`
                      : tg.globalOrderDesc
                    }
                  </p>
                  {hasCustom && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-4 shrink-0"
                      onClick={() => clearRoleMutation.mutate(r.value)}
                      disabled={clearRoleMutation.isPending}
                      data-testid={`btn-reset-role-order-${r.value}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      {tg.roleOrderReset}
                    </Button>
                  )}
                </div>
                {groups.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground text-sm">{tg.noGroupsOrder}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {roleGroups.map((group, index) => (
                      <Card
                        key={group.id}
                        data-testid={`role-group-card-${r.value}-${group.id}`}
                        className="cursor-grab active:cursor-grabbing select-none"
                        draggable
                        onDragStart={() => handleRoleDragStart(index)}
                        onDragEnter={() => handleRoleDragEnter(r.value, index)}
                        onDragEnd={() => handleRoleDragEnd(r.value)}
                        onDragOver={e => e.preventDefault()}
                      >
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{index + 1}.</span>
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: group.color || "#3b82f6" }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{group.displayAlias || group.name}</span>
                                {group.displayAlias && (
                                  <span className="text-xs text-muted-foreground">({group.name})</span>
                                )}
                                {group.isBackOffice && (
                                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400">
                                    <Building2 className="h-2.5 w-2.5 mr-1" />
                                    {tg.backOffice}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {reorderRoleMutation.isPending && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {tg.savingOrder}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Create / Edit drawer (Sheet) */}
      <Sheet open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setEditGroup(null); setMemberSearch(""); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col gap-0" data-testid="sheet-group-form">
          <SheetHeader className="px-6 py-5 border-b text-left space-y-1.5">
            <SheetTitle className="flex items-center gap-2.5 text-lg">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: `${form.color}1f`, color: form.color }}
              >
                <Users className="h-4 w-4" />
              </span>
              {editGroup ? tg.editGroup : tg.newGroupTitle}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {editGroup ? tg.editGroup : tg.newGroupTitle}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="group-name" className="text-sm font-medium">{tg.groupName} *</Label>
              <Input
                id="group-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={tg.groupNamePlaceholder}
                data-testid="input-group-name"
              />
            </div>

            {/* Alias */}
            <div className="space-y-1.5">
              <Label htmlFor="group-alias" className="text-sm font-medium">{tg.groupAlias}</Label>
              <Input
                id="group-alias"
                value={form.displayAlias}
                onChange={e => setForm(f => ({ ...f, displayAlias: e.target.value }))}
                placeholder={tg.groupAliasPlaceholder}
                data-testid="input-group-alias"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="group-desc" className="text-sm font-medium">{tg.groupDesc}</Label>
              <Textarea
                id="group-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={tg.groupDesc}
                className="resize-none min-h-[64px]"
                data-testid="input-group-description"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{tg.groupColor}</Label>
              <div className="flex flex-wrap gap-2">
                {GROUP_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`${tg.groupColor} ${color}`}
                    aria-pressed={form.color === color}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${form.color === color ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm(f => ({ ...f, color }))}
                    data-testid={`color-${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Back Office flag */}
            <label
              htmlFor="group-back-office"
              className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                id="group-back-office"
                checked={form.isBackOffice}
                onCheckedChange={checked => setForm(f => ({ ...f, isBackOffice: checked === true }))}
                className="mt-0.5"
                data-testid="checkbox-back-office"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-amber-500" />
                  {tg.backOffice}
                </span>
                <span className="text-xs text-muted-foreground">{tg.backOfficeDesc}</span>
              </div>
            </label>

            {/* Members */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  {tg.groupMembers}
                  {form.memberUserIds.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]" data-testid="badge-member-count">
                      {form.memberUserIds.length}
                    </Badge>
                  )}
                </Label>
                {form.memberUserIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, memberUserIds: [] }))}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="btn-clear-members"
                  >
                    {t.common.clearAll}
                  </button>
                )}
              </div>

              {/* Selected chips */}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5" data-testid="selected-members">
                  {selectedMembers.map(u => (
                    <span
                      key={u.id}
                      className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 text-foreground pl-1 pr-1.5 py-0.5 text-xs"
                      data-testid={`chip-member-${u.id}`}
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={u.avatarUrl || undefined} className="object-cover" />
                        <AvatarFallback className="text-[6px] bg-primary text-primary-foreground">
                          {(u.fullName || u.username).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[120px] truncate">{u.fullName || u.username}</span>
                      <button
                        type="button"
                        onClick={() => toggleMember(u.id)}
                        aria-label={u.fullName || u.username}
                        className="rounded-full hover:bg-primary/20 p-0.5"
                        data-testid={`chip-remove-${u.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder={t.common.search}
                  className="pl-8 h-9"
                  data-testid="input-member-search"
                />
              </div>

              {/* List */}
              <ScrollArea className="h-56 rounded-lg border">
                <div className="p-1.5 space-y-0.5">
                  {filteredUsers.length === 0 ? (
                    <div className="py-10 text-center text-xs text-muted-foreground" data-testid="text-no-members">
                      {t.common.noResults}
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const checked = form.memberUserIds.includes(u.id);
                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          key={u.id}
                          onClick={() => toggleMember(u.id)}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleMember(u.id); } }}
                          aria-pressed={checked}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-md text-left cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? "bg-primary/5" : "hover:bg-muted"}`}
                          data-testid={`member-toggle-${u.id}`}
                        >
                          <Checkbox checked={checked} className="pointer-events-none shrink-0" />
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={u.avatarUrl || undefined} className="object-cover" />
                            <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                              {(u.fullName || u.username).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{u.fullName || u.username}</div>
                            {u.email && <div className="text-xs text-muted-foreground truncate">{u.email}</div>}
                          </div>
                          {u.role && <Badge variant="secondary" className="text-[10px] py-0 shrink-0">{u.role}</Badge>}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
              {form.memberUserIds.length > 0 && (
                <p className="text-xs text-muted-foreground" data-testid="text-members-selected">
                  {form.memberUserIds.length} {tg.membersSelected}
                </p>
              )}
            </div>
          </div>

          <SheetFooter className="px-6 py-4 border-t gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { setDialogOpen(false); setEditGroup(null); setMemberSearch(""); }}
              data-testid="btn-cancel-group"
            >
              {tg.cancel}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || saveMutation.isPending}
              data-testid="btn-save-group"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editGroup ? tg.saveChanges : tg.createGroup}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
