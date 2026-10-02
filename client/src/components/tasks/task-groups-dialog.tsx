import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useTaskSettingsAccess } from "@/hooks/use-task-settings-access";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Building2, ChevronDown, ChevronUp, Edit, GripVertical, Loader2, Plus, Search, Trash2, Users, UserPlus, X, UserRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskModalArtwork } from "./task-modal-artwork";
import {
  createEmptyTaskGroupForm,
  createTaskGroupForm,
  createTaskGroupPayload,
  DEFAULT_TASK_GROUP_COLOR,
  isTaskGroupFormDirty,
  type TaskGroupForm,
  type TaskGroupMember,
} from "./task-groups-dialog.helpers";

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
  members: TaskGroupMember[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type AssignmentSettingsUser = {
  id: string;
  fullName: string | null;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  isActive: boolean;
};

type AssignmentSettings = {
  configured: boolean;
  allowedUserIds: string[];
  users: AssignmentSettingsUser[];
  updatedAt: string | null;
};

const GROUP_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#84cc16", "#f97316",
];
const ORDER_ROLES = ["admin", "manager", "user"] as const;

function userDisplayName(user: Pick<User, "fullName" | "username">) {
  return user.fullName || user.username;
}

function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every(id => right.includes(id));
}

function UserAvatar({ user }: { user: Pick<User, "fullName" | "username" | "avatarUrl"> }) {
  const name = userDisplayName(user);
  return (
    <Avatar className="h-7 w-7 shrink-0">
      <AvatarImage src={user.avatarUrl || undefined} className="object-cover" />
      <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
        {name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

export function TaskGroupsDialog({ open, onOpenChange }: Props) {
  const { canManage, isPending } = useTaskSettingsAccess();
  useEffect(() => {
    if (open && !isPending && !canManage) onOpenChange(false);
  }, [open, isPending, canManage, onOpenChange]);
  if (!canManage || !open) return null;
  return <AdminTaskGroupsDialog open={open} onOpenChange={onOpenChange} />;
}

function AdminTaskGroupsDialog({ open, onOpenChange }: Props) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const tg = t.tasks.taskGroups;
  const canManage = true; // Mounted only after the server confirms administrator access.

  const [editingGroup, setEditingGroup] = useState<TaskGroup | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<TaskGroupForm>(createEmptyTaskGroupForm);
  const [initialForm, setInitialForm] = useState<TaskGroupForm>(createEmptyTaskGroupForm);
  const [memberSearch, setMemberSearch] = useState("");
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [discardClosesDialog, setDiscardClosesDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskGroup | null>(null);
  const [nameError, setNameError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [groupsError, setGroupsError] = useState(false);
  const [usersError, setUsersError] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("groups");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentDraft, setAssignmentDraft] = useState<string[]>([]);
  const [assignmentBaseline, setAssignmentBaseline] = useState<string[]>([]);
  const [assignmentUpdatedAt, setAssignmentUpdatedAt] = useState<string | null>(null);
  const [assignmentSnapshotLoaded, setAssignmentSnapshotLoaded] = useState(false);
  const [assignmentConflict, setAssignmentConflict] = useState(false);
  const [assignmentSaveError, setAssignmentSaveError] = useState<string | null>(null);
  const assignmentRefreshAuthorizedRef = useRef(false);
  const [assignmentActorId, setAssignmentActorId] = useState<string | undefined>(currentUser?.id);

  const {
    data: groups = [],
    isLoading: groupsLoading,
    isError: groupsQueryFailed,
  } = useQuery<TaskGroup[]>({
    queryKey: ["/api/task-settings/groups", currentUser?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/task-settings/groups");
      return response.json();
    },
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersQueryFailed,
  } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const {
    data: assignmentSettings,
    isLoading: assignmentSettingsLoading,
    isFetching: assignmentSettingsFetching,
    isError: assignmentSettingsFailed,
    refetch: retryAssignmentSettings,
  } = useQuery<AssignmentSettings>({
    queryKey: ["/api/task-settings/users", currentUser?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/task-settings/users");
      return response.json();
    },
    enabled: open && !!currentUser?.id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const assignmentDraftIsDirty = !sameIds(assignmentDraft, assignmentBaseline);
  useEffect(() => {
    if (assignmentActorId === currentUser?.id) return;
    setAssignmentActorId(currentUser?.id);
    setAssignmentDraft([]);
    setAssignmentBaseline([]);
    setAssignmentUpdatedAt(null);
    setAssignmentSnapshotLoaded(false);
    setAssignmentConflict(false);
    setAssignmentSaveError(null);
    setAssignmentSearch("");
    assignmentRefreshAuthorizedRef.current = false;
  }, [assignmentActorId, currentUser?.id]);
  const effectiveAssignmentIds = useMemo(() => assignmentSettings
    ? assignmentSettings.configured
      ? assignmentSettings.allowedUserIds
      : assignmentSettings.users.filter(candidate => candidate.isActive).map(candidate => candidate.id)
    : [], [assignmentSettings]);
  useEffect(() => {
    if (!assignmentSettings) return;
    const mayRefreshDirtyDraft = assignmentRefreshAuthorizedRef.current;
    assignmentRefreshAuthorizedRef.current = false;
    if (!assignmentSnapshotLoaded) {
      setAssignmentUpdatedAt(assignmentSettings.updatedAt);
      setAssignmentDraft(effectiveAssignmentIds);
      setAssignmentBaseline(effectiveAssignmentIds);
      setAssignmentSnapshotLoaded(true);
    } else if (assignmentDraftIsDirty && mayRefreshDirtyDraft) {
      // An explicit refresh updates the comparison baseline without replacing the staged draft.
      setAssignmentUpdatedAt(assignmentSettings.updatedAt);
      setAssignmentBaseline(effectiveAssignmentIds);
      setAssignmentConflict(false);
    } else if (!assignmentDraftIsDirty) {
      setAssignmentUpdatedAt(assignmentSettings.updatedAt);
      setAssignmentDraft(effectiveAssignmentIds);
      setAssignmentBaseline(effectiveAssignmentIds);
    }
  // Synchronize only when the server returns a different settings snapshot; local draft
  // changes and rerenders must never reapply the server's unconfigured empty array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentSettings, currentUser?.id]);

  const assignmentUsers = assignmentSettings?.users || [];
  const visibleAssignmentUsers = useMemo(() => {
    const query = normalizeSearchText(assignmentSearch.trim());
    return assignmentUsers.filter(candidate =>
      !query || [candidate.fullName, candidate.username, candidate.email]
        .filter((value): value is string => !!value)
        .some(value => normalizeSearchText(value).includes(query)),
    );
  }, [assignmentUsers, assignmentSearch]);
  const toggleAssignmentUser = (userId: string) => {
    setAssignmentDraft(previous => previous.includes(userId)
      ? previous.filter(id => id !== userId)
      : [...previous, userId]);
  };
  const refreshAssignmentSettings = async () => {
    const hadDraft = assignmentDraftIsDirty;
    assignmentRefreshAuthorizedRef.current = true;
    const result = await retryAssignmentSettings();
    assignmentRefreshAuthorizedRef.current = false;
    if (!result.data) return;
    const latestIds = result.data.configured
      ? result.data.allowedUserIds
      : result.data.users.filter(candidate => candidate.isActive).map(candidate => candidate.id);
    setAssignmentUpdatedAt(result.data.updatedAt);
    setAssignmentBaseline(latestIds);
    if (!hadDraft) setAssignmentDraft(latestIds);
    setAssignmentConflict(false);
  };
  const saveAssignmentUsers = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/task-settings/users", {
        allowedUserIds: assignmentDraft,
        expectedUpdatedAt: assignmentUpdatedAt,
      });
      return response.json() as Promise<AssignmentSettings>;
    },
    onSuccess: async settings => {
      queryClient.setQueryData(["/api/task-settings/users", currentUser?.id], settings);
      setAssignmentBaseline(settings.allowedUserIds);
      setAssignmentDraft(settings.allowedUserIds);
      setAssignmentUpdatedAt(settings.updatedAt);
      setAssignmentConflict(false);
      setAssignmentSaveError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/tasks/assignment-options"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
        queryClient.invalidateQueries({
          predicate: query => query.queryKey[0] === "/api/tasks" && query.queryKey.includes("reassign-targets"),
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/task-settings/groups"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/tasks/people"] }),
      ]);
    },
    onError: (error: any) => {
      if (error?.status === 409) {
        setAssignmentConflict(true);
        setAssignmentSaveError(null);
        return;
      }
      setAssignmentSaveError(error instanceof Error ? error.message : tg.serverError);
    },
  });

  useEffect(() => {
    setGroupsError(groupsQueryFailed);
  }, [groupsQueryFailed]);
  useEffect(() => {
    setUsersError(usersQueryFailed);
  }, [usersQueryFailed]);

  const formIsDirty = isTaskGroupFormDirty(form, initialForm);
  const selectedMemberIds = new Set(form.memberUserIds);
  const userById = new Map(users.map(candidate => [candidate.id, candidate]));
  const existingMembersById = new Map(
    (editingGroup?.members || []).map(member => [member.userId, member]),
  );
  const selectedMembers = form.memberUserIds.map(id => {
    const user = userById.get(id);
    if (user) return user;
    const formerMember = existingMembersById.get(id);
    if (!formerMember) return null;
    return {
      id,
      username: formerMember.fullName,
      fullName: formerMember.fullName,
      email: "",
      avatarUrl: formerMember.avatarUrl || null,
      isActive: false,
    } as User;
  }).filter((candidate): candidate is User => candidate !== null);
  const selectedInactiveCount = selectedMembers.filter(candidate => !candidate.isActive).length;

  const activeUsers = useMemo(() => users.filter(candidate => candidate.isActive), [users]);
  const filteredUsers = useMemo(() => {
    const query = memberSearch.trim().toLocaleLowerCase();
    const candidateUsers = activeUsers.filter(candidate =>
      !query
      || [candidate.fullName, candidate.username, candidate.email]
        .filter(Boolean)
        .some(value => value!.toLocaleLowerCase().includes(query)),
    );
    const selectedInactiveUsers = selectedMembers.filter(candidate => !candidate.isActive);
    const visibleIds = new Set(candidateUsers.map(candidate => candidate.id));
    return [
      ...candidateUsers,
      ...selectedInactiveUsers.filter(candidate =>
        !visibleIds.has(candidate.id)
        && (!query || [candidate.fullName, candidate.username, candidate.email]
          .filter(Boolean)
          .some(value => value!.toLocaleLowerCase().includes(query))),
      ),
    ];
  }, [activeUsers, memberSearch, selectedMembers]);

  const invalidateTaskGroupCaches = async (groupId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/task-settings/groups"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/people"] }),
      ...(groupId ? [
        queryClient.invalidateQueries({ queryKey: [`/api/task-groups/${groupId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/task-groups/${groupId}/members`] }),
      ] : []),
    ]);
  };

  const resetEditor = () => {
    const blank = createEmptyTaskGroupForm();
    setEditingGroup(null);
    setEditorOpen(false);
    setForm(blank);
    setInitialForm(blank);
    setMemberSearch("");
    setNameError(false);
    setSaveError(null);
  };

  const closeEditor = () => {
    if (saveMutation.isPending) return;
    if (formIsDirty) {
      setDiscardClosesDialog(false);
      setDiscardConfirmationOpen(true);
      return;
    }
    resetEditor();
  };

  const requestDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (saveMutation.isPending || deleteMutation.isPending || saveAssignmentUsers.isPending) return;
    if (formIsDirty || assignmentDraftIsDirty) {
      setDiscardClosesDialog(true);
      setDiscardConfirmationOpen(true);
      return;
    }
    resetEditor();
    onOpenChange(false);
  };

  const openCreate = () => {
    const blank = createEmptyTaskGroupForm();
    setEditingGroup(null);
    setEditorOpen(true);
    setForm(blank);
    setInitialForm(blank);
    setMemberSearch("");
    setNameError(false);
    setSaveError(null);
  };

  const openEdit = (group: TaskGroup) => {
    const initial = createTaskGroupForm(group);
    setEditingGroup(group);
    setEditorOpen(true);
    setForm(initial);
    setInitialForm(initial);
    setMemberSearch("");
    setNameError(false);
    setSaveError(null);
  };

  const toggleMember = (userId: string) => {
    setForm(previous => ({
      ...previous,
      memberUserIds: selectedMemberIds.has(userId)
        ? previous.memberUserIds.filter(id => id !== userId)
        : [...previous.memberUserIds, userId],
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = createTaskGroupPayload(form);
      const response = editingGroup
        ? await apiRequest("PUT", `/api/task-groups/${editingGroup.id}`, payload)
        : await apiRequest("POST", "/api/task-groups", payload);
      return response.json();
    },
    onSuccess: async () => {
      await invalidateTaskGroupCaches(editingGroup?.id);
      toast({ title: editingGroup ? tg.groupUpdated : tg.groupCreated });
      resetEditor();
    },
    onError: error => {
      const message = error instanceof Error ? error.message : tg.serverError;
      setSaveError(message);
      toast({ title: tg.saveFailed, description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (groupId: string) => apiRequest("DELETE", `/api/task-groups/${groupId}`),
    onSuccess: async (_, groupId) => {
      await invalidateTaskGroupCaches(groupId);
      setDeleteTarget(null);
      toast({ title: tg.groupDeleted });
    },
    onError: error => {
      const message = error instanceof Error ? error.message : tg.serverError;
      setDeleteError(message);
      toast({ title: tg.deleteFailed, description: message, variant: "destructive" });
    },
  });

  const save = () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setSaveError(null);
    saveMutation.mutate();
  };

  const confirmDiscard = () => {
    setDiscardConfirmationOpen(false);
    const shouldCloseDialog = discardClosesDialog;
    setDiscardClosesDialog(false);
    resetEditor();
    if (assignmentDraftIsDirty) {
      setAssignmentDraft(assignmentBaseline);
      setAssignmentConflict(false);
      setAssignmentSaveError(null);
    }
    if (shouldCloseDialog) onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={requestDialogOpenChange}>
        <DialogContent
          className="task-modern-modal task-groups-dialog-content flex h-[90dvh] min-h-0 max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-2xl p-0"
          overlayClassName="task-modern-modal-overlay"
          data-testid="dialog-task-groups"
        >
          <TaskModalArtwork variant="groups" compact />
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {editorOpen
                ? (editingGroup ? tg.editGroup : tg.newGroupTitle)
                : activeSettingsTab === "users" ? t.tasks.workspace.settings : tg.dialogTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">{tg.title}</DialogDescription>
          </DialogHeader>

          <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TabsList className="mx-6 mt-3 grid w-auto shrink-0 grid-cols-2" aria-label={tg.settingsTabsLabel}>
              <TabsTrigger value="users" data-testid="tab-assigned-users">{tg.assignedUsersTab}</TabsTrigger>
              <TabsTrigger value="groups" data-testid="tab-task-groups">{tg.groupsTab}</TabsTrigger>
            </TabsList>
            <TabsContent value="users" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {assignmentSettingsFailed ? (
                  <div className="m-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                    <p className="text-destructive" role="alert">{tg.assignmentLoadFailed}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => void refreshAssignmentSettings()}
                      disabled={assignmentSettingsFetching}
                      data-testid="btn-retry-assignment-settings"
                    >
                      {assignmentSettingsFetching && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      {tg.assignmentRetry}
                    </Button>
                  </div>
                ) : assignmentSettingsLoading || !assignmentSettings ? (
                  <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tg.assignmentLoading}
                  </div>
                ) : (
                  <>
                    <div className="shrink-0 space-y-3 px-6 pt-4">
                      <div>
                        <h2 className="text-sm font-semibold">{tg.assignedUsersTitle}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">{tg.assignedUsersDescription}</p>
                      </div>
                      {assignmentConflict && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="alert">
                          <p>{tg.assignmentConflict}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => void refreshAssignmentSettings()}
                            disabled={assignmentSettingsFetching}
                          >
                            {assignmentSettingsFetching && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            {tg.assignmentRefresh}
                          </Button>
                        </div>
                      )}
                      {assignmentDraft.length === 0 && (
                        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100" role="alert">
                          {tg.noAssignedUsersWarning}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium" data-testid="text-assignment-selected-count">
                          {tg.assignedUsersSelected.replace("{count}", String(assignmentDraft.length))}
                        </p>
                        {assignmentDraft.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setAssignmentDraft([])}
                            disabled={saveAssignmentUsers.isPending}
                            data-testid="btn-clear-assigned-users"
                          >
                            {tg.clearAssignedUsers}
                          </Button>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={assignmentSearch}
                          onChange={event => setAssignmentSearch(event.target.value)}
                          placeholder={tg.searchAssignedUsers}
                          className="h-9 pl-8"
                          data-testid="input-assignment-user-search"
                        />
                      </div>
                      {assignmentSaveError && <p className="text-sm text-destructive" role="alert">{assignmentSaveError}</p>}
                    </div>
                    <div className="mx-6 mb-4 mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border p-1.5" data-testid="assignment-user-list">
                      {visibleAssignmentUsers.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">{tg.noAssignmentUsersFound}</div>
                      ) : visibleAssignmentUsers.map(candidate => {
                        const checked = assignmentDraft.includes(candidate.id);
                        const displayName = candidate.fullName || candidate.username;
                        return (
                          <div
                            key={candidate.id}
                            role="button"
                            tabIndex={candidate.isActive && !saveAssignmentUsers.isPending ? 0 : -1}
                            aria-pressed={checked}
                            aria-disabled={!candidate.isActive || saveAssignmentUsers.isPending}
                            onClick={() => {
                              if (candidate.isActive && !saveAssignmentUsers.isPending) toggleAssignmentUser(candidate.id);
                            }}
                            onKeyDown={event => {
                              if ((event.key === "Enter" || event.key === " ") && candidate.isActive && !saveAssignmentUsers.isPending) {
                                event.preventDefault();
                                toggleAssignmentUser(candidate.id);
                              }
                            }}
                            className={`flex items-center gap-2.5 rounded-md p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${candidate.isActive ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed opacity-60"} ${checked ? "bg-primary/5" : ""}`}
                            data-testid={`assignment-user-${candidate.id}`}
                          >
                            <Checkbox checked={checked} disabled={!candidate.isActive} className="pointer-events-none shrink-0" />
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={candidate.avatarUrl || undefined} className="object-cover" />
                              <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                                {displayName.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{displayName}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {[candidate.email, candidate.username].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            {!candidate.isActive && <Badge variant="outline" className="text-[10px]">{tg.inactive}</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
            <TabsContent value="groups" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          {editorOpen ? (
            <div className="task-modern-modal-body task-groups-editor-body flex min-h-0 flex-1 flex-col overflow-hidden">
              <ScrollArea className="min-h-0 flex-1">
                <fieldset disabled={saveMutation.isPending} className="m-0 min-w-0 space-y-5 border-0 px-6 py-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="group-name">{tg.groupName} *</Label>
                    <Input
                      id="group-name"
                      value={form.name}
                      onChange={event => {
                        setForm(previous => ({ ...previous, name: event.target.value }));
                        if (event.target.value.trim()) setNameError(false);
                      }}
                      placeholder={tg.groupNamePlaceholder}
                      data-testid="input-group-name"
                      aria-invalid={nameError}
                    />
                    {nameError && <p className="text-sm text-destructive" role="alert">{tg.nameRequired}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="group-desc">{tg.groupDesc}</Label>
                    <Textarea
                      id="group-desc"
                      value={form.description}
                      onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))}
                      placeholder={tg.groupDesc}
                      className="min-h-16 resize-y"
                      data-testid="input-group-description"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{tg.groupColor}</Label>
                    <div className="flex flex-wrap gap-2">
                      {GROUP_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`${tg.groupColor} ${color}`}
                          aria-pressed={form.color === color}
                          className={`h-7 w-7 rounded-full border-2 transition-transform ${form.color === color ? "scale-110 border-foreground" : "border-transparent hover:scale-105"}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setForm(previous => ({ ...previous, color }))}
                          data-testid={`color-${color}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="group-alias">{tg.groupAlias}</Label>
                    <Input
                      id="group-alias"
                      value={form.displayAlias}
                      onChange={event => setForm(previous => ({ ...previous, displayAlias: event.target.value }))}
                      placeholder={tg.groupAliasPlaceholder}
                      data-testid="input-group-alias"
                    />
                  </div>

                  <label htmlFor="group-back-office" className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 p-3 hover:bg-muted/50">
                    <Checkbox
                      id="group-back-office"
                      checked={form.isBackOffice}
                      onCheckedChange={checked => setForm(previous => ({ ...previous, isBackOffice: checked === true }))}
                      className="mt-0.5"
                      data-testid="checkbox-back-office"
                    />
                    <span className="space-y-0.5">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Building2 className="h-3.5 w-3.5 text-amber-500" />
                        {tg.backOffice}
                      </span>
                      <span className="block text-xs text-muted-foreground">{tg.backOfficeDesc}</span>
                    </span>
                  </label>

                  <section className="space-y-2.5 border-t pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="flex items-center gap-1.5">
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        {tg.groupMembers}
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]" data-testid="badge-member-count">
                          {form.memberUserIds.length}
                        </Badge>
                      </Label>
                      {form.memberUserIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setForm(previous => ({ ...previous, memberUserIds: [] }))}
                          className="text-xs text-muted-foreground hover:text-foreground"
                          data-testid="btn-clear-members"
                        >
                          {t.common.clearAll}
                        </button>
                      )}
                    </div>

                    {selectedMembers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5" data-testid="selected-members">
                        {selectedMembers.map(member => (
                          <span
                            key={member.id}
                            className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 py-0.5 pl-1 pr-1.5 text-xs"
                            data-testid={`chip-member-${member.id}`}
                          >
                            <UserAvatar user={member} />
                            <span className="max-w-[150px] truncate">{userDisplayName(member)}</span>
                            {!member.isActive && (
                              <Badge variant="outline" className="px-1 py-0 text-[9px]">{tg.inactive}</Badge>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleMember(member.id)}
                              aria-label={userDisplayName(member)}
                              className="rounded-full p-0.5 hover:bg-primary/20"
                              data-testid={`chip-remove-${member.id}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {selectedInactiveCount > 0 && (
                      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200" role="status">
                        {tg.inactiveMemberWarning}
                      </p>
                    )}

                    {usersError && <p className="text-sm text-destructive" role="alert">{tg.usersLoadFailed}</p>}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={memberSearch}
                          onChange={event => setMemberSearch(event.target.value)}
                          placeholder={t.common.search}
                          className="h-9 pl-8"
                          data-testid="input-member-search"
                        />
                      </div>
                      <ScrollArea className="h-52 rounded-lg border">
                        <div className="space-y-0.5 p-1.5">
                          {usersLoading ? (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {tg.activeUsers}
                            </div>
                          ) : filteredUsers.length === 0 ? (
                            <div className="py-8 text-center text-xs text-muted-foreground" data-testid="text-no-members">
                              {t.common.noResults}
                            </div>
                          ) : filteredUsers.map(candidate => {
                            const checked = selectedMemberIds.has(candidate.id);
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                key={candidate.id}
                                onClick={() => {
                                  if (!saveMutation.isPending) toggleMember(candidate.id);
                                }}
                                onKeyDown={event => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    if (!saveMutation.isPending) toggleMember(candidate.id);
                                  }
                                }}
                                aria-pressed={checked}
                                aria-disabled={saveMutation.isPending}
                                className={`flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${saveMutation.isPending ? "cursor-wait opacity-60" : `cursor-pointer ${checked ? "bg-primary/5" : "hover:bg-muted"}`}`}
                                data-testid={`member-toggle-${candidate.id}`}
                              >
                                <Checkbox checked={checked} className="pointer-events-none shrink-0" />
                                <UserAvatar user={candidate} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm">{userDisplayName(candidate)}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {candidate.email || candidate.username}
                                  </span>
                                </span>
                                {!candidate.isActive && (
                                  <Badge variant="outline" className="text-[10px]">{tg.inactive}</Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground" data-testid="text-members-selected">
                        {form.memberUserIds.length} {tg.membersSelected}
                      </p>
                    </div>
                  </section>
                  {saveError && <p className="text-sm text-destructive" role="alert">{saveError}</p>}
                </fieldset>
              </ScrollArea>
              <DialogFooter className="task-modern-modal-footer shrink-0">
                <Button variant="outline" onClick={closeEditor} data-testid="btn-cancel-group">
                  {tg.cancel}
                </Button>
                <Button
                  onClick={save}
                  disabled={!canManage || saveMutation.isPending}
                  data-testid="btn-save-group"
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingGroup ? tg.saveChanges : tg.createGroup}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="task-modern-modal-body task-groups-list-body flex min-h-0 flex-1 flex-col space-y-4">
              {!canManage && (
                <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground" role="status">
                  {tg.readOnly}
                </p>
              )}
              {groupsError && <p className="text-sm text-destructive" role="alert">{tg.groupsLoadFailed}</p>}
              {groupsLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {tg.title}
                </div>
              ) : groups.length === 0 ? (
                <div className="rounded-lg border border-dashed py-12 text-center">
                  <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">{tg.noGroups}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groups.map(group => (
                    <div
                      key={group.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                      data-testid={`task-group-card-${group.id}`}
                    >
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color || DEFAULT_TASK_GROUP_COLOR }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium" data-testid={`text-group-name-${group.id}`}>{group.name}</span>
                          {group.displayAlias && (
                            <Badge variant="secondary" className="text-xs" data-testid={`text-group-alias-${group.id}`}>
                              {tg.aliasPrefix} {group.displayAlias}
                            </Badge>
                          )}
                          {group.isBackOffice && (
                            <Badge variant="outline" className="border-amber-500 text-xs text-amber-700 dark:text-amber-300">
                              <Building2 className="mr-1 h-3 w-3" />
                              {tg.backOffice}
                            </Badge>
                          )}
                        </div>
                        {group.description && <p className="mt-0.5 text-xs text-muted-foreground">{group.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <UserPlus className="h-3.5 w-3.5" />
                          {group.members.length === 0 ? (
                            <span className="italic">{tg.noMembers}</span>
                          ) : group.members.slice(0, 4).map(member => (
                            <span key={member.userId} className="rounded-full border px-2 py-0.5">{member.fullName}</span>
                          ))}
                          {group.members.length > 4 && <span>+{group.members.length - 4}</span>}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(group)}
                            aria-label={`${tg.editGroup}: ${group.name}`}
                            data-testid={`btn-edit-group-${group.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(group);
                            }}
                            aria-label={`${tg.deleteTitle} ${group.name}`}
                            data-testid={`btn-delete-group-${group.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canManage && (
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <details className="min-w-0 flex-1 rounded-lg border px-3 py-2">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      {tg.advanced}
                      <span className="ml-auto text-muted-foreground">⌄</span>
                    </summary>
                    <div className="mt-3">
                      <TaskGroupOrdering groups={groups} />
                    </div>
                  </details>
                  <Button onClick={openCreate} data-testid="btn-create-group">
                    <Plus className="mr-2 h-4 w-4" />
                    {tg.newGroup}
                  </Button>
                </div>
              )}
            </div>
          )}
            </TabsContent>
          </Tabs>
          {activeSettingsTab === "users" && !assignmentSettingsFailed && assignmentSettings && (
            <DialogFooter className="task-modern-modal-footer shrink-0 flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAssignmentDraft(assignmentBaseline);
                  setAssignmentConflict(false);
                  setAssignmentSaveError(null);
                }}
                disabled={saveAssignmentUsers.isPending || !assignmentDraftIsDirty}
                data-testid="btn-cancel-assignment-users"
              >
                {tg.cancel}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setAssignmentSaveError(null);
                  saveAssignmentUsers.mutate();
                }}
                disabled={(!assignmentDraftIsDirty && assignmentSettings.configured) || saveAssignmentUsers.isPending || assignmentSettingsFetching}
                data-testid="btn-save-assignment-users"
              >
                {saveAssignmentUsers.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tg.saveAssignedUsers}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardConfirmationOpen} onOpenChange={setDiscardConfirmationOpen}>
        <AlertDialogContent className="task-modern-modal task-modern-modal--nested task-group-alert" overlayClassName="task-modern-modal-overlay task-modern-modal-overlay--nested">
          <TaskModalArtwork variant="edit" compact />
          <AlertDialogHeader>
            <AlertDialogTitle>{tg.changesTitle}</AlertDialogTitle>
            <AlertDialogDescription>{tg.changesDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="task-modern-modal-footer task-group-alert-footer">
            <AlertDialogCancel disabled={deleteMutation.isPending}>{tg.cancel}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDiscard}>
              {tg.discardChanges}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={value => {
        if (!value && !deleteMutation.isPending) setDeleteTarget(null);
      }}>
        <AlertDialogContent className="task-modern-modal task-modern-modal--nested task-group-alert" overlayClassName="task-modern-modal-overlay task-modern-modal-overlay--nested">
          <TaskModalArtwork variant="delete" compact />
          <AlertDialogHeader>
            <AlertDialogTitle>{tg.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {tg.deleteDesc}
              {deleteTarget && <span className="mt-2 block font-medium text-foreground">{deleteTarget.name}</span>}
              {deleteError && <span className="mt-2 block text-destructive">{deleteError}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="task-modern-modal-footer task-group-alert-footer">
            <AlertDialogCancel disabled={deleteMutation.isPending}>{tg.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={event => {
                event.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tg.deleteTitle.replace("?", "")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TaskGroupOrdering({ groups }: { groups: TaskGroup[] }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const tg = t.tasks.taskGroups;

  const invalidateGroups = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/task-settings/groups"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/people"] }),
  ]);
  const globalMutation = useMutation({
    mutationFn: async (ordered: TaskGroup[]) => apiRequest("PUT", "/api/task-groups-reorder", {
      order: ordered.map((group, index) => ({ id: group.id, sortOrder: index })),
    }),
    onSuccess: async () => {
      await invalidateGroups();
      toast({ title: tg.orderSaved });
    },
    onError: () => toast({ title: tg.orderFailed, variant: "destructive" }),
  });
  const roleMutation = useMutation({
    mutationFn: async ({ role, ordered }: { role: string; ordered: TaskGroup[] }) => apiRequest(
      "PUT",
      "/api/task-groups-reorder-role",
      { role, order: ordered.map((group, index) => ({ id: group.id, sortOrder: index })) },
    ),
    onSuccess: async () => {
      await invalidateGroups();
      toast({ title: tg.roleOrderSaved });
    },
    onError: () => toast({ title: tg.roleOrderFailed, variant: "destructive" }),
  });
  const clearRoleMutation = useMutation({
    mutationFn: async (role: string) => apiRequest("DELETE", `/api/task-groups-reorder-role/${role}`),
    onSuccess: async () => {
      await invalidateGroups();
      toast({ title: tg.roleOrderReset });
    },
    onError: () => toast({ title: tg.resetFailed, variant: "destructive" }),
  });

  const roleGroups = (role: string) => {
    const hasCustomOrder = groups.some(group => group.roleSortOrders && role in group.roleSortOrders);
    if (!hasCustomOrder) return groups;
    return [...groups].sort((left, right) =>
      (left.roleSortOrders?.[role] ?? left.sortOrder ?? 0)
      - (right.roleSortOrders?.[role] ?? right.sortOrder ?? 0),
    );
  };
  const moveItem = (items: TaskGroup[], index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= items.length) return items;
    const ordered = [...items];
    [ordered[index], ordered[destination]] = [ordered[destination], ordered[index]];
    return ordered;
  };

  const renderOrderList = (items: TaskGroup[], role?: string) => (
    <ol className="space-y-1">
      {items.map((group, index) => (
        <li key={group.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
          <span className="w-5 text-right text-xs text-muted-foreground">{index + 1}.</span>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color || DEFAULT_TASK_GROUP_COLOR }} />
          <span className="min-w-0 flex-1 truncate">{group.displayAlias || group.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === 0 || globalMutation.isPending || roleMutation.isPending}
            aria-label={tg.moveUp.replace("{name}", group.name)}
            onClick={() => {
              const ordered = moveItem(items, index, -1);
              if (role) roleMutation.mutate({ role, ordered });
              else globalMutation.mutate(ordered);
            }}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === items.length - 1 || globalMutation.isPending || roleMutation.isPending}
            aria-label={tg.moveDown.replace("{name}", group.name)}
            onClick={() => {
              const ordered = moveItem(items, index, 1);
              if (role) roleMutation.mutate({ role, ordered });
              else globalMutation.mutate(ordered);
            }}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div>
          <h3 className="text-sm font-medium">{tg.globalOrder}</h3>
          <p className="text-xs text-muted-foreground">{tg.globalOrderDesc}</p>
        </div>
        {groups.length ? renderOrderList(groups) : <p className="text-xs text-muted-foreground">{tg.noGroupsOrder}</p>}
      </section>
      {ORDER_ROLES.map(role => {
        const ordered = roleGroups(role);
        const hasCustomOrder = groups.some(group => group.roleSortOrders && role in group.roleSortOrders);
        const roleLabel = role === "admin" ? tg.roleAdmin : role === "manager" ? tg.roleManager : tg.roleUser;
        return (
          <section key={role} className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">{roleLabel}</h3>
                <p className="text-xs text-muted-foreground">
                  {roleLabel}: {hasCustomOrder ? tg.roleOrderSaved : tg.globalOrder}
                </p>
              </div>
              {hasCustomOrder && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => clearRoleMutation.mutate(role)}
                  disabled={clearRoleMutation.isPending}
                  data-testid={`btn-reset-role-order-${role}`}
                >
                  {tg.roleOrderReset}
                </Button>
              )}
            </div>
            {groups.length ? renderOrderList(ordered, role) : <p className="text-xs text-muted-foreground">{tg.noGroupsOrder}</p>}
          </section>
        );
      })}
    </div>
  );
}