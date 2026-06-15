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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Edit, Trash2, Users, UserPlus, ArrowLeft, GripVertical, RotateCcw, Building2 } from "lucide-react";
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setEditGroup(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editGroup ? tg.editGroup : tg.newGroupTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="group-name" className="text-sm font-medium">{tg.groupName} *</Label>
              <Input
                id="group-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={tg.groupNamePlaceholder}
                className="mt-1"
                data-testid="input-group-name"
              />
            </div>
            <div>
              <Label htmlFor="group-alias" className="text-sm font-medium">{tg.groupAlias}</Label>
              <Input
                id="group-alias"
                value={form.displayAlias}
                onChange={e => setForm(f => ({ ...f, displayAlias: e.target.value }))}
                placeholder={tg.groupAliasPlaceholder}
                className="mt-1"
                data-testid="input-group-alias"
              />
            </div>
            <div>
              <Label htmlFor="group-desc" className="text-sm font-medium">{tg.groupDesc}</Label>
              <Textarea
                id="group-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={tg.groupDesc}
                className="mt-1 resize-none min-h-[60px]"
                data-testid="input-group-description"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">{tg.groupColor}</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {GROUP_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`h-6 w-6 rounded-full border-2 transition-all ${form.color === color ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm(f => ({ ...f, color }))}
                    data-testid={`color-${color}`}
                  />
                ))}
              </div>
            </div>
            {/* Back Office flag */}
            <div className="flex items-start gap-3 rounded-md border p-3 bg-muted/30">
              <Checkbox
                id="group-back-office"
                checked={form.isBackOffice}
                onCheckedChange={checked => setForm(f => ({ ...f, isBackOffice: checked === true }))}
                data-testid="checkbox-back-office"
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="group-back-office" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                  <Building2 className="h-3.5 w-3.5 text-amber-500" />
                  {tg.backOffice}
                </Label>
                <p className="text-xs text-muted-foreground">{tg.backOfficeDesc}</p>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">{tg.groupMembers}</Label>
              <ScrollArea className="h-48 rounded-md border p-2">
                <div className="space-y-1">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleMember(u.id)}
                      data-testid={`member-toggle-${u.id}`}
                    >
                      <Checkbox
                        checked={form.memberUserIds.includes(u.id)}
                        onCheckedChange={() => toggleMember(u.id)}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.avatarUrl || undefined} className="object-cover" />
                        <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                          {(u.fullName || u.username).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{u.fullName || u.username}</span>
                      {u.role && <Badge variant="secondary" className="text-[10px] py-0">{u.role}</Badge>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {form.memberUserIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{form.memberUserIds.length} {tg.membersSelected}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tg.cancel}</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || saveMutation.isPending}
              data-testid="btn-save-group"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editGroup ? tg.saveChanges : tg.createGroup}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
