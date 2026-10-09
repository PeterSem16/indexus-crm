import { RecordTagsBadges } from "@/components/record-tags-badges";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { useAuth } from "@/contexts/auth-context";
import { useTaskSettingsAccess } from "@/hooks/use-task-settings-access";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getTaskGroupId, isPulseNotificationTask } from "@/lib/task-query-controls";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, startOfYear, endOfYear, subYears } from "date-fns";
import type { Task, User, Customer, TaskComment } from "@shared/schema";
import type { TaskAttachment } from "@shared/task-attachments";
import { TaskAttachmentList, TaskAttachmentPicker } from "@/components/tasks/task-attachments";
import { TaskCommentsDialog } from "@/components/tasks/task-comments-dialog";
import { TaskCancelConfirmationDialog } from "@/components/tasks/task-cancel-confirmation-dialog";
import { TaskResolutionDialog } from "@/components/tasks/task-resolution-dialog";
import { TaskReassignDialog } from "@/components/tasks/task-reassign-dialog";
import type { TaskReassignPayload } from "@/components/tasks/task-reassign-dialog.helpers";
import { invalidateTaskReassignment } from "@/components/tasks/task-reassign-cache";
import { useTaskAssignmentOptions } from "@/hooks/use-task-assignment-options";
import { TaskModalArtwork } from "@/components/tasks/task-modal-artwork";
import { TaskTimingStatus } from "@/components/tasks/task-timing";
import { TaskRequestBrief } from "@/components/tasks/task-request-brief";
import "@/components/tasks/checklist-notes.css";
import "@/components/nexus/nexus-signal-tasks.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Play, 
  MoreHorizontal,
  Plus,
  Search,
  User as UserIcon,
  Calendar,
  Loader2,
  XCircle,
  Edit,
  BarChart3,
  TrendingUp,
  UserPlus,
  Eye,
  Trash2,
  Square,
  CheckSquare,
  ListChecks,
  Settings,
  Sparkles,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

const priorityConfig = {
  low: { color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: Clock },
  medium: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Clock },
  high: { color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", icon: AlertCircle },
  urgent: { color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: AlertCircle },
};

const statusConfig = {
  pending: { color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: Clock },
  in_progress: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Play },
  completed: { color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
  cancelled: { color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", icon: XCircle },
};

export default function TasksPage() {
  const { t, locale } = useI18n();
  const { selectedCountries } = useCountryFilter();
  const { user } = useAuth();
  const { canManage: canManageTaskSettings } = useTaskSettingsAccess();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<string>("my");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // If the page is opened with ?group=<id>, activate that group tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const groupId = params.get("group");
    if (groupId) {
      setActiveTab(`group_${groupId}`);
    }
  }, []);
  const [reportDateRange, setReportDateRange] = useState<string>("this_month");
  const [reportStartDate, setReportStartDate] = useState<Date>(startOfMonth(new Date()));
  const [reportEndDate, setReportEndDate] = useState<Date>(endOfMonth(new Date()));
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskPendingCancellation, setTaskPendingCancellation] = useState<Task | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [taskNotifyAgent, setTaskNotifyAgent] = useState(true);
  const [editAttachments, setEditAttachments] = useState<TaskAttachment[]>([]);
  const [editUploading, setEditUploading] = useState(false);
  const editAttachmentsChangedRef = useRef(false);
  const commentScopeRef = useRef<string | undefined>(selectedTask?.id);
  commentScopeRef.current = selectedTask?.id;
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    assignedUserId: "",
    groupId: "",
    resolution: "",
  });

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers/lookup"],
  });

  const { data: taskGroupsList = [] } = useQuery<any[]>({
    queryKey: ["/api/task-groups"],
  });
  const { data: taskAssignmentOptions, isLoading: taskAssignmentOptionsLoading, isError: taskAssignmentOptionsFailed, refetch: retryTaskAssignmentOptions } = useTaskAssignmentOptions();
  const eligibleTaskAssignees = taskAssignmentOptions?.users || [];
  const eligibleTaskGroups = taskAssignmentOptions?.groups || [];
  const canResolveTasks = !taskAssignmentOptionsLoading && !taskAssignmentOptionsFailed && taskAssignmentOptions?.canResolve === true;

  useEffect(() => {
    if (!canResolveTasks && resolveDialogOpen) setResolveDialogOpen(false);
  }, [canResolveTasks, resolveDialogOpen]);

  // Sort groups by current user's role-specific sort order, falling back to global sortOrder
  const sortedTaskGroupsList = [...taskGroupsList].sort((a: any, b: any) => {
    const userRole = user?.role;
    const aOrder = (userRole && a.roleSortOrders && userRole in a.roleSortOrders)
      ? a.roleSortOrders[userRole]
      : (a.sortOrder ?? 0);
    const bOrder = (userRole && b.roleSortOrders && userRole in b.roleSortOrders)
      ? b.roleSortOrders[userRole]
      : (b.sortOrder ?? 0);
    return aOrder - bOrder;
  });

  // Groups the current user belongs to (has tasks tagged with group_id:<id>)
  const myGroupIds = taskGroupsList
    .filter((g: any) => g.members?.some((m: any) => m.userId === user?.id))
    .map((g: any) => g.id);

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Task>) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: t.common.success,
        description: t.tasks.taskUpdated,
      });
      setEditDialogOpen(false);
      setSelectedTask(null);
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.tasks.updateFailed,
        variant: "destructive",
      });
    },
  });

  const resolveTaskMutation = useMutation({
    mutationFn: async ({ id, resolution, notifyAgent }: { id: string; resolution: string; notifyAgent: boolean }) => {
      return apiRequest("POST", `/api/tasks/${id}/resolve`, { resolution, notifyAgent });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: t.common.success,
        description: t.tasks.taskResolved,
      });
      setResolveDialogOpen(false);
      setSelectedTask(null);
      setResolutionText("");
    },
    onError: (_error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.id, "checklist"] });
      toast({
        title: t.common.error,
        description: t.tasks.resolveFailed,
        variant: "destructive",
      });
    },
  });

  const reassignTaskMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: TaskReassignPayload }) => {
      return apiRequest("POST", `/api/tasks/${id}/reassign`, payload);
    },
    onSuccess: async () => {
      await invalidateTaskReassignment();
      toast({
        title: t.common.success,
        description: t.tasks.taskReassigned,
      });
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.tasks.reassignFailed,
        variant: "destructive",
      });
    },
  });

  const { data: taskComments = [], isLoading: taskCommentsLoading, isError: taskCommentsError, refetch: retryTaskComments } = useQuery<TaskComment[]>({
    queryKey: ["/api/tasks", selectedTask?.id, "comments"],
    enabled: !!selectedTask && detailsDialogOpen,
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ taskId, content, attachments }: { taskId: string; content: string; attachments: TaskAttachment[] }) => {
      return apiRequest("POST", `/api/tasks/${taskId}/comments`, { content, attachments });
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.taskId, "comments"] });
      toast({
        title: t.common.success,
        description: t.tasks.commentAdded,
      });
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.tasks.commentFailed,
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ taskId, commentId }: { taskId: string; commentId: string }) => {
      return apiRequest("DELETE", `/api/tasks/${taskId}/comments/${commentId}`);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.taskId, "comments"] });
    },
  });

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const matchesCountry = selectedCountries.length === 0 || 
      !task.country || 
      selectedCountries.includes(task.country as typeof selectedCountries[number]);
    return matchesSearch && matchesStatus && matchesPriority && matchesCountry;
  });

  const myTasks = filteredTasks.filter(task => task.assignedUserId === user?.id);
  const allTasks = filteredTasks;

  const getUser = (userId: string) => users.find(u => u.id === userId);
  const getCustomer = (customerId: string | null) => customerId ? customers.find(c => c.id === customerId) : null;

  const handleStatusChange = (task: Task, newStatus: string) => {
    if (newStatus === "completed" && !canResolveTasks) return;
    if (newStatus === "cancelled") {
      setTaskPendingCancellation(task);
      return;
    }
    if (newStatus === "completed" && task.status !== "completed" && isPulseNotificationTask(task)) {
      setSelectedTask(task);
      setResolutionText("");
      setTaskNotifyAgent(true);
      setResolveDialogOpen(true);
      return;
    }
    updateTaskMutation.mutate({ id: task.id, status: newStatus });
  };

  const confirmTaskCancellation = async (taskId: string) => {
    if (!taskPendingCancellation || taskPendingCancellation.id !== taskId) return false;
    try {
      await updateTaskMutation.mutateAsync({ id: taskId, status: "cancelled" });
      return true;
    } catch {
      return false;
    }
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setEditAttachments(task.attachments || []);
    setEditUploading(false);
    editAttachmentsChangedRef.current = false;
    const existingGroupTag = (task.tags || []).find((tag: string) => tag.startsWith("group_id:"));
    const existingGroupId = existingGroupTag ? existingGroupTag.replace("group_id:", "") : "";
    setEditForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      assignedUserId: task.assignedUserId,
      groupId: existingGroupId,
      resolution: task.resolution || "",
    });
    setTaskNotifyAgent(isPulseNotificationTask(task));
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedTask || editUploading || updateTaskMutation.isPending) return;
    if (editForm.status === "completed" && selectedTask.status !== "completed" && !canResolveTasks) return;
    const existingTags: string[] = (selectedTask.tags || []).filter((tag: string) => !tag.startsWith("group_id:"));
    const newTags = editForm.groupId
      ? [...existingTags, `group_id:${editForm.groupId}`]
      : existingTags;
    const isPulseCompletion = selectedTask.status !== "completed"
      && editForm.status === "completed"
      && isPulseNotificationTask(selectedTask);
    if (isPulseCompletion && !editForm.resolution.trim()) {
      toast({ title: t.tasks.resolveTaskDesc, variant: "destructive" });
      return;
    }
    updateTaskMutation.mutate({
      id: selectedTask.id,
      title: editForm.title,
      description: editForm.description,
      priority: editForm.priority,
      status: editForm.status,
      assignedUserId: editForm.assignedUserId,
      tags: newTags,
      ...(isPulseCompletion ? { resolution: editForm.resolution } : {}),
      ...(selectedTask.status !== "completed" && editForm.status === "completed" && selectedTask.createdByUserId
        ? { notifyAgent: taskNotifyAgent }
        : {}),
      ...(editAttachmentsChangedRef.current ? { attachments: editAttachments } : {}),
    } as any);
  };

  const handleResolveTask = (task: Task) => {
    if (!canResolveTasks) return;
    setSelectedTask(task);
    setResolutionText("");
    setTaskNotifyAgent(isPulseNotificationTask(task));
    setResolveDialogOpen(true);
  };

  const handleReassignTask = (task: Task) => {
    setSelectedTask(task);
    setReassignDialogOpen(true);
  };

  const handleViewDetails = (task: Task) => {
    setSelectedTask(task);
    setDetailsDialogOpen(true);
  };

  const handleSubmitResolve = () => {
    if (!selectedTask || !resolutionText.trim()) return;
    resolveTaskMutation.mutate({
      id: selectedTask.id,
      resolution: resolutionText,
      notifyAgent: taskNotifyAgent,
    });
  };

  const handleSubmitReassign = async (taskId: string, payload: TaskReassignPayload): Promise<boolean> => {
    if (!selectedTask || selectedTask.id !== taskId || reassignTaskMutation.isPending) return false;
    try {
      await reassignTaskMutation.mutateAsync({ id: taskId, payload });
      setReassignDialogOpen(false);
      setSelectedTask(current => current?.id === taskId ? null : current);
      return true;
    } catch {
      return false;
    }
  };

  const taskCardColors = {
    pending: "border-l-4 border-l-amber-400 bg-amber-50/30 dark:bg-amber-900/10",
    in_progress: "border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10",
    completed: "border-l-4 border-l-green-500 bg-green-50/30 dark:bg-green-900/10",
    cancelled: "border-l-4 border-l-slate-400 bg-slate-50/30 dark:bg-slate-800/20",
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const assignedUser = getUser(task.assignedUserId);
    const createdByUser = getUser(task.createdByUserId);
    const resolvedByUser = task.resolvedByUserId ? getUser(task.resolvedByUserId) : null;
    const linkedCustomer = getCustomer(task.customerId || null);
    const PriorityIcon = priorityConfig[task.priority as keyof typeof priorityConfig]?.icon || Clock;
    const StatusIcon = statusConfig[task.status as keyof typeof statusConfig]?.icon || Clock;
    const isResolved = task.status === "completed" && task.resolution;
    const isActive = task.status !== "completed" && task.status !== "cancelled";
    const cardColor = taskCardColors[task.status as keyof typeof taskCardColors] || "";

    return (
      <Card className={`hover-elevate rounded-l-none ${cardColor}`} data-testid={`task-card-${task.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className={priorityConfig[task.priority as keyof typeof priorityConfig]?.color || ""}>
                  <PriorityIcon className="h-3 w-3 mr-1" />
                  {t.tasks.priorities[task.priority as keyof typeof t.tasks.priorities] || task.priority}
                </Badge>
                <Badge className={statusConfig[task.status as keyof typeof statusConfig]?.color || ""}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {t.tasks.statuses[task.status as keyof typeof t.tasks.statuses] || task.status}
                </Badge>
                {(() => {
                  const groupIdTag = (task.tags || []).find((tag: string) => tag.startsWith("group_id:"));
                  if (!groupIdTag) return null;
                  const gid = groupIdTag.replace("group_id:", "");
                  const grp = taskGroupsList.find((g: any) => g.id === gid);
                  if (!grp) return null;
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: grp.color || "#3b82f6", color: grp.color || "#3b82f6" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: grp.color || "#3b82f6" }} />
                      {grp.name}
                    </span>
                  );
                })()}
              </div>
              <h3 className="font-medium text-sm truncate" data-testid={`task-title-${task.id}`}>
                {task.title}
              </h3>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
              <ChecklistSection taskId={task.id} canEdit={isActive} />
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                {assignedUser && (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={assignedUser.avatarUrl || undefined} className="object-cover" />
                      <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-medium">
                        {(assignedUser.fullName || assignedUser.username).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{assignedUser.fullName || assignedUser.username}</span>
                  </div>
                )}
                {createdByUser && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{t.tasks.createdBy}:</span>
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={createdByUser.avatarUrl || undefined} className="object-cover" />
                      <AvatarFallback className="bg-muted text-muted-foreground text-[6px] font-medium">
                        {(createdByUser.fullName || createdByUser.username).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{createdByUser.fullName || createdByUser.username}</span>
                  </div>
                )}
                {task.dueDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(task.dueDate), "dd.MM.yyyy")}</span>
                  </div>
                )}
                <TaskTimingStatus task={task} />
              </div>
              {linkedCustomer && (
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">{t.tasks.linkedTo}: </span>
                  <span className="font-medium">{linkedCustomer.firstName} {linkedCustomer.lastName}</span>
                </div>
              )}
              {isResolved && (
                <div className="mt-3 p-2 rounded-md bg-green-50 dark:bg-green-900/20 text-xs">
                  <div className="font-medium text-green-700 dark:text-green-300 mb-1">{t.tasks.resolution}:</div>
                  <p className="text-muted-foreground line-clamp-2">{task.resolution}</p>
                  {resolvedByUser && task.resolvedAt && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t.tasks.resolvedBy}: {resolvedByUser.fullName || resolvedByUser.username} ({format(new Date(task.resolvedAt), "dd.MM.yyyy HH:mm")})
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"
                  onClick={() => handleViewDetails(task)}
                  data-testid={`task-details-${task.id}`}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {t.tasks.viewDetails}
                </Button>
                {isActive && (
                  <>
                    {canResolveTasks ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-300 text-green-600 dark:border-green-700 dark:text-green-400"
                        onClick={() => handleResolveTask(task)}
                        data-testid={`task-resolve-${task.id}`}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t.tasks.resolve}
                      </Button>
                    ) : (
                      <span className="max-w-xs text-xs text-muted-foreground" role="status">
                        {taskAssignmentOptionsLoading
                          ? t.tasks.taskGroups.assignmentLoading
                          : taskAssignmentOptionsFailed
                            ? t.tasks.taskGroups.assignmentLoadFailed
                            : t.tasks.taskGroups.noEligibleResolvers}
                      </span>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
                      onClick={() => handleReassignTask(task)}
                      data-testid={`task-reassign-${task.id}`}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      {t.tasks.reassign}
                    </Button>
                  </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid={`task-menu-${task.id}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditTask(task)} data-testid={`task-edit-${task.id}`}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t.common.edit}
                    </DropdownMenuItem>
                    {task.status !== "in_progress" && isActive && (
                      <DropdownMenuItem 
                        onClick={() => handleStatusChange(task, "in_progress")}
                        data-testid={`task-start-${task.id}`}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {t.tasks.startWorking}
                      </DropdownMenuItem>
                    )}
                    {isActive && (
                      <DropdownMenuItem 
                        onClick={() => handleStatusChange(task, "cancelled")}
                        data-testid={`task-cancel-${task.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {t.tasks.cancel}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const TaskList = ({ tasks }: { tasks: Task[] }) => {
    if (tasks.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t.tasks.noTasks}</p>
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    );
  };

  const pendingCount = filteredTasks.filter(t => t.status === "pending").length;
  const inProgressCount = filteredTasks.filter(t => t.status === "in_progress").length;
  const completedCount = filteredTasks.filter(t => t.status === "completed").length;

  const handleReportDateRangeChange = (preset: string) => {
    setReportDateRange(preset);
    const now = new Date();
    switch (preset) {
      case "this_month":
        setReportStartDate(startOfMonth(now));
        setReportEndDate(endOfMonth(now));
        break;
      case "last_month":
        setReportStartDate(startOfMonth(subMonths(now, 1)));
        setReportEndDate(endOfMonth(subMonths(now, 1)));
        break;
      case "quarter":
        setReportStartDate(startOfQuarter(now));
        setReportEndDate(endOfQuarter(now));
        break;
      case "half_year":
        setReportStartDate(subMonths(now, 6));
        setReportEndDate(now);
        break;
      case "year":
        setReportStartDate(startOfYear(now));
        setReportEndDate(endOfYear(now));
        break;
      default:
        break;
    }
  };

  const reportFilteredTasks = filteredTasks.filter(task => {
    const taskDate = new Date(task.createdAt);
    return taskDate >= reportStartDate && taskDate <= reportEndDate;
  });

  const userStatistics = users.map(u => {
    const userTasks = reportFilteredTasks.filter(t => t.assignedUserId === u.id);
    const total = userTasks.length;
    const completed = userTasks.filter(t => t.status === "completed").length;
    const inProgress = userTasks.filter(t => t.status === "in_progress").length;
    const pending = userTasks.filter(t => t.status === "pending").length;
    const cancelled = userTasks.filter(t => t.status === "cancelled").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return {
      user: u,
      total,
      completed,
      inProgress,
      pending,
      cancelled,
      completionRate,
    };
  }).filter(stat => stat.total > 0).sort((a, b) => b.total - a.total);

  const UserReportingCard = ({ stat }: { stat: typeof userStatistics[number] }) => (
    <Card data-testid={`user-stats-${stat.user.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={stat.user.avatarUrl || undefined} className="object-cover" />
            <AvatarFallback className="bg-primary text-primary-foreground font-medium">
              {(stat.user.fullName || stat.user.username).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-base">{stat.user.fullName || stat.user.username}</CardTitle>
            <p className="text-sm text-muted-foreground">{stat.user.email}</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-lg font-semibold">
          {stat.total}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t.tasks.completionRate}</span>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">{stat.completionRate}%</span>
          </div>
          <Progress value={stat.completionRate} className="h-2" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between p-2 rounded-md bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>{t.tasks.statuses.completed}</span>
            </div>
            <span className="font-semibold">{stat.completed}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-600" />
              <span>{t.tasks.statuses.in_progress}</span>
            </div>
            <span className="font-semibold">{stat.inProgress}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-600" />
              <span>{t.tasks.statuses.pending}</span>
            </div>
            <span className="font-semibold">{stat.pending}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-500" />
              <span>{t.tasks.statuses.cancelled}</span>
            </div>
            <span className="font-semibold">{stat.cancelled}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-tasks-title">{t.tasks.title}</h1>
          <p className="text-muted-foreground">{t.tasks.description}</p>
        </div>
        {canManageTaskSettings && <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/task-groups")}
          data-testid="btn-task-groups-settings"
        >
          <Settings className="h-4 w-4 mr-2" />
          {t.tasks.workspace.settings}
        </Button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t.tasks.pending}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t.tasks.inProgress}</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t.tasks.completed}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.tasks.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-task-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <SelectValue placeholder={t.common.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all}</SelectItem>
            <SelectItem value="pending">{t.tasks.statuses.pending}</SelectItem>
            <SelectItem value="in_progress">{t.tasks.statuses.in_progress}</SelectItem>
            <SelectItem value="completed">{t.tasks.statuses.completed}</SelectItem>
            <SelectItem value="cancelled">{t.tasks.statuses.cancelled}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-priority-filter">
            <SelectValue placeholder={t.quickCreate.priority} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all}</SelectItem>
            <SelectItem value="low">{t.tasks.priorities.low}</SelectItem>
            <SelectItem value="medium">{t.tasks.priorities.medium}</SelectItem>
            <SelectItem value="high">{t.tasks.priorities.high}</SelectItem>
            <SelectItem value="urgent">{t.tasks.priorities.urgent}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {taskAssignmentOptionsFailed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm" role="alert">
          <span>{t.tasks.taskGroups.assignmentLoadFailed}</span>
          <Button variant="outline" size="sm" onClick={() => void retryTaskAssignmentOptions()}>
            {t.tasks.taskGroups.assignmentRetry}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="my" data-testid="tab-my-tasks">
              {t.tasks.myTasks} ({myTasks.length})
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all-tasks">
              {t.tasks.allTasks} ({allTasks.length})
            </TabsTrigger>
            {sortedTaskGroupsList
              .filter((g: any) => g.members?.some((m: any) => m.userId === user?.id))
              .map((g: any) => {
                const groupTasks = filteredTasks.filter(task =>
                  (task.tags || []).some((tag: string) => tag === `group_id:${g.id}`)
                );
                const pendingCount = tasks.filter(task =>
                  (task.tags || []).some((tag: string) => tag === `group_id:${g.id}`) &&
                  (task.status === "pending" || task.status === "in_progress")
                ).length;
                return (
                  <TabsTrigger key={g.id} value={`group_${g.id}`} data-testid={`tab-group-${g.id}`}>
                    <ListChecks className="h-3.5 w-3.5 mr-1" />
                    {g.displayAlias || g.name} ({groupTasks.length})
                    {pendingCount > 0 && (
                      <span
                        className="ml-1.5 inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-semibold min-w-[16px] h-4 px-1 leading-none"
                        data-testid={`badge-group-pending-${g.id}`}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            <TabsTrigger value="reporting" data-testid="tab-reporting">
              <BarChart3 className="h-4 w-4 mr-1" />
              {t.tasks.reporting}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="my" className="mt-4">
            <TaskList tasks={myTasks} />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <TaskList tasks={allTasks} />
          </TabsContent>
          {sortedTaskGroupsList
            .filter((g: any) => g.members?.some((m: any) => m.userId === user?.id))
            .map((g: any) => {
              const groupTasks = filteredTasks.filter(task =>
                (task.tags || []).some((tag: string) => tag === `group_id:${g.id}`)
              );
              return (
                <TabsContent key={g.id} value={`group_${g.id}`} className="mt-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color || '#3b82f6' }} />
                    <span className="text-sm font-medium">{g.name}</span>
                    {g.description && <span className="text-xs text-muted-foreground">— {g.description}</span>}
                  </div>
                  <TaskList tasks={groupTasks} />
                </TabsContent>
              );
            })}
          <TabsContent value="reporting" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{t.tasks.userStatistics}</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={reportDateRange === "this_month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleReportDateRangeChange("this_month")}
                    data-testid="report-this-month"
                  >
                    {t.tasks.thisMonth}
                  </Button>
                  <Button
                    variant={reportDateRange === "last_month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleReportDateRangeChange("last_month")}
                    data-testid="report-last-month"
                  >
                    {t.tasks.lastMonth}
                  </Button>
                  <Button
                    variant={reportDateRange === "quarter" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleReportDateRangeChange("quarter")}
                    data-testid="report-quarter"
                  >
                    {t.tasks.quarter}
                  </Button>
                  <Button
                    variant={reportDateRange === "half_year" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleReportDateRangeChange("half_year")}
                    data-testid="report-half-year"
                  >
                    {t.tasks.halfYear}
                  </Button>
                  <Button
                    variant={reportDateRange === "year" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleReportDateRangeChange("year")}
                    data-testid="report-year"
                  >
                    {t.tasks.year}
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                <Calendar className="h-4 w-4 inline mr-1" />
                {format(reportStartDate, "dd.MM.yyyy")} - {format(reportEndDate, "dd.MM.yyyy")}
                <span className="ml-2">({reportFilteredTasks.length} {t.tasks.tasksCount})</span>
              </div>
              {userStatistics.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t.tasks.noUsersWithTasks}</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {userStatistics.map((stat) => (
                    <UserReportingCard key={stat.user.id} stat={stat} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="task-modern-modal sm:max-w-md max-h-[90dvh] overflow-y-auto" overlayClassName="task-modern-modal-overlay">
          <TaskModalArtwork variant="edit" />
          <DialogHeader>
            <DialogTitle>{t.tasks.editTask}</DialogTitle>
            <DialogDescription>{t.tasks.editTaskDesc}</DialogDescription>
          </DialogHeader>
          <div className="task-modern-modal-body space-y-4">
            <div>
              <label className="text-sm font-medium">{t.quickCreate.taskTitle}</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                data-testid="input-edit-task-title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t.quickCreate.taskDescription}</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="resize-none"
                data-testid="input-edit-task-description"
              />
            </div>
            <TaskAttachmentPicker
              key={selectedTask?.id}
              attachments={editAttachments}
              onChange={files => { editAttachmentsChangedRef.current = true; setEditAttachments(files); }}
              onBusyChange={setEditUploading}
              disabled={updateTaskMutation.isPending}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t.quickCreate.priority}</label>
                <Select value={editForm.priority} onValueChange={(val) => setEditForm({ ...editForm, priority: val })}>
                  <SelectTrigger data-testid="select-edit-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t.tasks.priorities.low}</SelectItem>
                    <SelectItem value="medium">{t.tasks.priorities.medium}</SelectItem>
                    <SelectItem value="high">{t.tasks.priorities.high}</SelectItem>
                    <SelectItem value="urgent">{t.tasks.priorities.urgent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{t.common.status}</label>
                <Select value={editForm.status} onValueChange={(val) => setEditForm({ ...editForm, status: val })}>
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t.tasks.statuses.pending}</SelectItem>
                    <SelectItem value="in_progress">{t.tasks.statuses.in_progress}</SelectItem>
                    <SelectItem value="completed" disabled={!canResolveTasks}>{t.tasks.statuses.completed}</SelectItem>
                    <SelectItem value="cancelled">{t.tasks.statuses.cancelled}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!canResolveTasks && (
              <p className="text-xs text-muted-foreground" role="status">
                {taskAssignmentOptionsLoading
                  ? t.tasks.taskGroups.assignmentLoading
                  : taskAssignmentOptionsFailed
                    ? t.tasks.taskGroups.assignmentLoadFailed
                    : t.tasks.taskGroups.noEligibleResolvers}
              </p>
            )}
            {selectedTask && selectedTask.status !== "completed" && editForm.status === "completed"
              && isPulseNotificationTask(selectedTask) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="standalone-edit-resolution">
                    {t.tasks.resolutionDialog.resolution} <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    id="standalone-edit-resolution"
                    value={editForm.resolution}
                    onChange={event => setEditForm({ ...editForm, resolution: event.target.value })}
                    placeholder={t.tasks.resolutionDialog.placeholder}
                    data-testid="standalone-edit-resolution"
                  />
                </div>
              )}
            {selectedTask?.status !== "completed" && editForm.status === "completed" && selectedTask?.createdByUserId && (
              <div className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-3">
                <Checkbox
                  id="standalone-edit-notify-agent"
                  checked={taskNotifyAgent}
                  onCheckedChange={checked => setTaskNotifyAgent(checked === true)}
                  data-testid="standalone-edit-notify-agent"
                />
                <label htmlFor="standalone-edit-notify-agent" className="cursor-pointer">
                  <span className="block text-sm font-medium">{t.tasks.resolutionDialog.notify}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t.tasks.resolutionDialog.notifyHint}</span>
                </label>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">{t.quickCreate.assignedTo}</label>
              <Select value={editForm.assignedUserId} onValueChange={(val) => setEditForm({ ...editForm, assignedUserId: val })}>
                <SelectTrigger data-testid="select-edit-assigned">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedTask?.assignedUserId && !eligibleTaskAssignees.some(candidate => candidate.id === selectedTask.assignedUserId) && (
                    <SelectItem value={selectedTask.assignedUserId} disabled>
                      {(getUser(selectedTask.assignedUserId)?.fullName || getUser(selectedTask.assignedUserId)?.username || selectedTask.assignedUserId)} — {t.tasks.taskGroups.excludedCurrentAssignee}
                    </SelectItem>
                  )}
                  {eligibleTaskAssignees.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Priradiť do skupiny</label>
              <Select value={editForm.groupId || "__none__"} onValueChange={(val) => setEditForm({ ...editForm, groupId: val === "__none__" ? "" : val })}>
                <SelectTrigger data-testid="select-edit-group">
                  <SelectValue placeholder="Bez skupiny" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Bez skupiny</SelectItem>
                  {editForm.groupId && !eligibleTaskGroups.some(group => group.id === editForm.groupId) && taskGroupsList.some((group: any) => group.id === editForm.groupId) && (
                    <SelectItem value={editForm.groupId} disabled>
                      {taskGroupsList.find((group: any) => group.id === editForm.groupId)?.displayAlias || taskGroupsList.find((group: any) => group.id === editForm.groupId)?.name} — {t.tasks.taskGroups.excludedCurrentGroup}
                    </SelectItem>
                  )}
                  {eligibleTaskGroups.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.displayAlias || g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="task-modern-modal-footer">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateTaskMutation.isPending || editUploading} data-testid="btn-save-standalone-task-edit">
              {updateTaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskResolutionDialog
        open={resolveDialogOpen}
        onOpenChange={open => { if (!resolveTaskMutation.isPending) setResolveDialogOpen(open); }}
        task={selectedTask}
        resolution={resolutionText}
        onResolutionChange={setResolutionText}
        onConfirm={handleSubmitResolve}
        saving={resolveTaskMutation.isPending}
        canResolve={canResolveTasks}
        notifyAgent={taskNotifyAgent}
        onNotifyAgentChange={setTaskNotifyAgent}
      />

      <TaskReassignDialog
        open={reassignDialogOpen}
        taskId={selectedTask?.id || null}
        taskTitle={selectedTask?.title || ""}
        assignedUserId={selectedTask?.assignedUserId}
        taskGroupId={getTaskGroupId(selectedTask?.tags || [])}
        submitting={reassignTaskMutation.isPending}
        onOpenChange={setReassignDialogOpen}
        onConfirm={handleSubmitReassign}
      />

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="task-modern-modal sm:max-w-lg max-h-[90dvh] overflow-y-auto" overlayClassName="task-modern-modal-overlay">
          <TaskModalArtwork variant="detail" />
          <DialogHeader>
            <DialogTitle>{t.tasks.viewDetails}</DialogTitle>
            {selectedTask && <RecordTagsBadges entityType="task" entityId={selectedTask.id} tags={selectedTask.tags} />}
          </DialogHeader>
          {selectedTask && (
            <div className="task-modern-modal-body space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={priorityConfig[selectedTask.priority as keyof typeof priorityConfig]?.color || ""}>
                    {t.tasks.priorities[selectedTask.priority as keyof typeof t.tasks.priorities] || selectedTask.priority}
                  </Badge>
                  <Badge className={statusConfig[selectedTask.status as keyof typeof statusConfig]?.color || ""}>
                    {t.tasks.statuses[selectedTask.status as keyof typeof t.tasks.statuses] || selectedTask.status}
                  </Badge>
                </div>
                <h3 className="font-semibold">{selectedTask.title}</h3>
                <div className="nexus-signal-tasks rounded-lg">
                  <TaskRequestBrief
                    description={selectedTask.description}
                    locale={locale}
                    taskId={selectedTask.id}
                    heading={t.tasks.requestFromSubmitter}
                    originalLabel={t.tasks.originalRequest}
                    emptyLabel={t.tasks.noDescription}
                    categoryLabels={{
                      ChangeData: t.quickCreate.catChangeData,
                      WrongPhone: t.quickCreate.catWrongPhone,
                      WrongEmail: t.quickCreate.catWrongEmail,
                      WrongAddress: t.quickCreate.catWrongAddress,
                      Document: t.quickCreate.catDocument,
                      Complaint: t.quickCreate.catComplaint,
                      Other: t.quickCreate.catOther,
                    }}
                  >
                    <TaskAttachmentList attachments={selectedTask.attachments || []} className="mt-3" />
                  </TaskRequestBrief>
                </div>
                <TaskTimingStatus task={selectedTask} />
                <div className="text-xs text-muted-foreground">
                  {t.quickCreate.assignedTo}: {getUser(selectedTask.assignedUserId)?.fullName || getUser(selectedTask.assignedUserId)?.username}
                </div>
                {selectedTask.createdByUserId && (
                  <div className="text-xs text-muted-foreground">
                    {t.tasks.createdBy}: {getUser(selectedTask.createdByUserId)?.fullName || getUser(selectedTask.createdByUserId)?.username}
                  </div>
                )}
                {selectedTask.resolution && (
                  <div className="mt-3 p-3 rounded-md bg-green-50 dark:bg-green-900/20">
                    <div className="font-medium text-sm text-green-700 dark:text-green-300">{t.tasks.resolution}</div>
                    <p className="text-sm mt-1">{selectedTask.resolution}</p>
                    {selectedTask.resolvedByUserId && selectedTask.resolvedAt && (
                      <div className="text-xs text-muted-foreground mt-2">
                        {t.tasks.resolvedBy}: {getUser(selectedTask.resolvedByUserId)?.fullName || getUser(selectedTask.resolvedByUserId)?.username} ({format(new Date(selectedTask.resolvedAt), "dd.MM.yyyy HH:mm")})
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <TaskCommentsDialog
                  key={selectedTask.id}
                  taskId={selectedTask.id}
                  taskTitle={selectedTask.title}
                  comments={taskComments}
                  currentUserId={user?.id}
                  resolveUser={getUser}
                  loading={taskCommentsLoading}
                  error={taskCommentsError}
                  onRetry={() => { void retryTaskComments(); }}
                  submitting={addCommentMutation.isPending}
                  uploadKey={selectedTask.id}
                  onSubmit={async (content, attachments) => {
                    try {
                      await addCommentMutation.mutateAsync({ taskId: selectedTask.id, content, attachments });
                      return true;
                    } catch {
                      return false;
                    }
                  }}
                  onDelete={(commentId) => deleteCommentMutation.mutate({ taskId: selectedTask.id, commentId })}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <TaskCancelConfirmationDialog
        open={!!taskPendingCancellation}
        taskId={taskPendingCancellation?.id ?? null}
        taskTitle={taskPendingCancellation?.title ?? ""}
        onOpenChange={(open) => { if (!open) setTaskPendingCancellation(null); }}
        onConfirm={confirmTaskCancellation}
      />
    </div>
  );
}

export function ChecklistSection({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const { t } = useI18n();
  type ChecklistItem = { id: string; label: string; required: boolean; doneAt: string | null; doneByUserId: string | null; position: number; note?: string | null };
  type AiChecklistStatus = { status: "idle" | "generating" | "generated" | "preserved" | "failed" | "unavailable"; errorCode?: string };
  const [newLabelState, setNewLabelState] = useState<{ taskId: string; value: string }>({ taskId, value: "" });
  const [editingState, setEditingState] = useState<{ taskId: string; itemId: string; value: string } | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [openNoteEditor, setOpenNoteEditor] = useState<string | null>(null);
  const attemptedAutoGeneration = useRef(new Set<string>());
  const invalidatedGeneratedChecklist = useRef(new Set<string>());
  const manuallyAddedChecklistItems = useRef(new Set<string>());
  const newLabel = newLabelState.taskId === taskId ? newLabelState.value : "";
  const editing = editingState?.taskId === taskId ? editingState : null;

  useEffect(() => {
    setNewLabelState({ taskId, value: "" });
    setEditingState(null);
    setOpenNoteEditor(null);
  }, [taskId]);

  const itemsQuery = useQuery<ChecklistItem[]>({
    queryKey: ["/api/tasks", taskId, "checklist"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, { credentials: "include" });
      if (!res.ok) throw new Error(`Checklist request failed (${res.status})`);
      return res.json();
    },
  });
  const items = itemsQuery.data ?? [];
  const aiStatusQuery = useQuery<AiChecklistStatus>({
    queryKey: ["/api/tasks", taskId, "checklist", "ai"],
    enabled: itemsQuery.isSuccess,
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/checklist/ai`, { credentials: "include" });
      if (!res.ok) throw new Error(`AI checklist status request failed (${res.status})`);
      return res.json();
    },
    refetchInterval: (query) => query.state.data?.status === "generating" ? 1500 : false,
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean; currentTaskId: string }) => apiRequest("PATCH", `/api/task-checklist/${id}`, { done }),
    onSuccess: (_result, variables) => queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.currentTaskId, "checklist"] }),
  });
  const addMut = useMutation({
    mutationFn: async ({ label, currentTaskId }: { label: string; currentTaskId: string }) => apiRequest("POST", `/api/tasks/${currentTaskId}/checklist`, { label, required: false, position: items.length }),
    onSuccess: (_result, variables) => {
      manuallyAddedChecklistItems.current.add(variables.currentTaskId);
      setNewLabelState((previous) => previous.taskId === variables.currentTaskId ? { taskId: variables.currentTaskId, value: "" } : previous);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.currentTaskId, "checklist"] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: async ({ id }: { id: string; currentTaskId: string }) => apiRequest("DELETE", `/api/task-checklist/${id}`),
    onSuccess: (_result, variables) => queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.currentTaskId, "checklist"] }),
  });
  const editMut = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string; currentTaskId: string }) => apiRequest("PATCH", `/api/task-checklist/${id}`, { label }),
    onSuccess: (_result, variables) => {
      setEditingState((previous) => previous?.taskId === variables.currentTaskId ? null : previous);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.currentTaskId, "checklist"] });
    },
  });
  const noteMut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string; currentTaskId: string }) =>
      apiRequest("PATCH", `/api/task-checklist/${id}`, { note }),
    onSuccess: (_result, variables) => {
      setOpenNoteEditor((current) => current === `${variables.currentTaskId}:${variables.id}` ? null : current);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.currentTaskId, "checklist"] });
    },
  });
  const aiGenerationMut = useMutation({
    mutationFn: async ({ currentTaskId, retry }: { currentTaskId: string; retry: boolean }) =>
      apiRequest("POST", `/api/tasks/${currentTaskId}/checklist/ai`, retry ? { retry: true } : {}),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.currentTaskId, "checklist", "ai"] });
    },
  });

  useEffect(() => {
    if (
      canEdit &&
      itemsQuery.isSuccess &&
      items.length === 0 &&
      aiStatusQuery.data?.status === "idle" &&
      !attemptedAutoGeneration.current.has(taskId)
    ) {
      attemptedAutoGeneration.current.add(taskId);
      aiGenerationMut.mutate({ currentTaskId: taskId, retry: false });
    }
  }, [canEdit, taskId, itemsQuery.isSuccess, items.length, aiStatusQuery.data?.status]);

  useEffect(() => {
    if (aiStatusQuery.data?.status === "generated" && !invalidatedGeneratedChecklist.current.has(taskId)) {
      invalidatedGeneratedChecklist.current.add(taskId);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "checklist"] });
    }
  }, [taskId, aiStatusQuery.data?.status]);

  if (itemsQuery.isLoading) return null;
  if (itemsQuery.isSuccess && items.length === 0 && !canEdit) return null;

  const doneCount = items.filter((i) => !!i.doneAt).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const aiStatus = aiStatusQuery.data?.status;
  const showGenerationError = aiGenerationMut.isError && aiGenerationMut.variables?.currentTaskId === taskId;
  const showAiError = items.length === 0 && !manuallyAddedChecklistItems.current.has(taskId) &&
    (aiStatus === "failed" || aiStatus === "unavailable" || showGenerationError);
  const showMutationError = [toggleMut, addMut, deleteMut, editMut, noteMut].some((mutation) =>
    mutation.isError && (mutation.variables as { currentTaskId?: string } | undefined)?.currentTaskId === taskId,
  );

  return (
    <section className="task-checklist" data-testid={`checklist-${taskId}`} aria-labelledby={`checklist-heading-${taskId}`}>
      <div className="task-checklist-heading">
        <div className="task-checklist-title">
          <span className="task-checklist-icon" aria-hidden="true"><ListChecks className="h-4 w-4" /></span>
          <h3 id={`checklist-heading-${taskId}`}>{t.tasks.checklistTitle}</h3>
        </div>
        {aiStatus === "generated" && (
          <span
            className="task-checklist-ai-note"
            data-testid={`checklist-ai-status-${taskId}`}
          >
            <Sparkles className="h-3 w-3" />{t.tasks.checklistAiProposal}
          </span>
        )}
      </div>
      {items.length > 0 && (
        <div className="task-checklist-progress">
          <div
            className="task-checklist-progress-track"
            role="progressbar"
            aria-label={t.tasks.checklistTitle}
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={doneCount}
            data-testid={`checklist-progress-${taskId}`}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="task-checklist-progress-count">{doneCount} / {items.length}</span>
        </div>
      )}
      {itemsQuery.isError && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{t.tasks.checklistLoadError}</p>}
      {aiStatusQuery.isError && !aiStatusQuery.data && itemsQuery.isSuccess && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert" data-testid={`checklist-ai-status-${taskId}`}>
          {t.tasks.checklistAiLoadError}
        </p>
      )}
      {aiStatus === "generating" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" data-testid={`checklist-ai-status-${taskId}`}>
          <Loader2 className="h-3 w-3 animate-spin" />{t.tasks.checklistAiGenerating}
        </div>
      )}
      {showAiError && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-red-600 dark:text-red-400" role="alert" data-testid={`checklist-ai-status-${taskId}`}>
          <span>{aiStatus === "unavailable" ? t.tasks.checklistAiUnavailable : t.tasks.checklistAiFailed}</span>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
              disabled={aiGenerationMut.isPending}
              onClick={() => aiGenerationMut.mutate({ currentTaskId: taskId, retry: true })}
              data-testid={`button-checklist-ai-retry-${taskId}`}
            >
              {aiGenerationMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {t.tasks.checklistAiRetry}
            </Button>
          )}
        </div>
      )}
      {items.map((it) => {
        const done = !!it.doneAt;
        const noteKey = `${taskId}:${it.id}`;
        const noteValue = noteDrafts[noteKey] ?? it.note ?? "";
        const noteEditorOpen = openNoteEditor === noteKey;
        return (
          <div key={it.id} className={`task-checklist-row${done ? " is-done" : ""}`} data-testid={`checklist-item-${it.id}`}>
            <button
              type="button"
              disabled={!canEdit || toggleMut.isPending}
              onClick={() => {
                if (!done) {
                  setNoteDrafts((previous) => ({ ...previous, [noteKey]: previous[noteKey] ?? it.note ?? "" }));
                  setOpenNoteEditor(noteKey);
                }
                toggleMut.mutate({ id: it.id, done: !done, currentTaskId: taskId });
              }}
              className="task-checklist-toggle"
              aria-label={`${done ? t.tasks.checklistMarkIncomplete : t.tasks.checklistMarkComplete}: ${it.label}`}
              aria-pressed={done}
              data-testid={`button-toggle-${it.id}`}
            >
              {done ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </button>
            {canEdit && editing?.itemId === it.id ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Input
                  value={editing.value}
                  onChange={(e) => setEditingState({ ...editing, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editing.value.trim()) editMut.mutate({ id: it.id, label: editing.value.trim(), currentTaskId: taskId });
                    if (e.key === "Escape") setEditingState(null);
                  }}
                  aria-label={t.tasks.checklistEdit}
                  className="h-9 text-sm"
                  data-testid={`input-edit-checklist-${it.id}`}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  disabled={!editing.value.trim() || editMut.isPending}
                  aria-label={t.tasks.checklistSave}
                  onClick={() => editMut.mutate({ id: it.id, label: editing.value.trim(), currentTaskId: taskId })}
                  data-testid={`button-save-checklist-${it.id}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label={t.tasks.checklistCancel} onClick={() => setEditingState(null)}>
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="task-checklist-content">
                <div className="task-checklist-line">
                  <span className="task-checklist-label">
                    {it.label}
                    {it.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  {canEdit && (
                    <div className="task-checklist-actions">
                      {done && !noteEditorOpen && !it.note && (
                        <button
                          type="button"
                          onClick={() => {
                            setNoteDrafts((previous) => ({ ...previous, [noteKey]: previous[noteKey] ?? "" }));
                            setOpenNoteEditor(noteKey);
                          }}
                          className="task-checklist-note-trigger"
                          data-testid={`button-add-checklist-note-${it.id}`}
                        >
                          {t.tasks.checklistNoteAdd}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingState({ taskId, itemId: it.id, value: it.label })}
                        className="task-checklist-action"
                        aria-label={`${t.tasks.checklistEdit}: ${it.label}`}
                        data-testid={`button-edit-checklist-${it.id}`}
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMut.mutate({ id: it.id, currentTaskId: taskId })}
                        className="task-checklist-action is-remove"
                        aria-label={`${t.tasks.checklistRemove}: ${it.label}`}
                        title={t.tasks.checklistRemove}
                        data-testid={`button-delete-checklist-${it.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                {it.note?.trim() && !noteEditorOpen && (
                  <div className="task-checklist-note" data-testid={`checklist-note-${it.id}`}>
                    <span className="task-checklist-note-caption">{t.tasks.checklistNoteLabel}</span>
                    <p>{it.note}</p>
                    {canEdit && (
                      <button
                        type="button"
                        className="task-checklist-note-edit"
                        onClick={() => {
                          setNoteDrafts((previous) => ({ ...previous, [noteKey]: previous[noteKey] ?? it.note ?? "" }));
                          setOpenNoteEditor(noteKey);
                        }}
                        data-testid={`button-edit-checklist-note-${it.id}`}
                      >
                        {t.tasks.checklistNoteEdit}
                      </button>
                    )}
                  </div>
                )}
                {canEdit && noteEditorOpen && (
                  <div className="task-checklist-note-editor" data-testid={`checklist-note-editor-${it.id}`}>
                    <Textarea
                      value={noteValue}
                      maxLength={240}
                      rows={2}
                      placeholder={t.tasks.checklistNotePlaceholder}
                      aria-label={`${t.tasks.checklistNoteLabel}: ${it.label}`}
                      onChange={(event) => setNoteDrafts((previous) => ({ ...previous, [noteKey]: event.target.value.slice(0, 240) }))}
                      data-testid={`input-checklist-note-${it.id}`}
                    />
                    <div className="task-checklist-note-footer">
                      <span>{noteValue.length}/240</span>
                      <div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNoteDrafts((previous) => ({ ...previous, [noteKey]: it.note ?? "" }));
                            setOpenNoteEditor(null);
                          }}
                        >
                          {t.tasks.checklistNoteCancel}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={noteMut.isPending}
                          onClick={() => noteMut.mutate({ id: it.id, note: noteValue.trim(), currentTaskId: taskId })}
                          data-testid={`button-save-checklist-note-${it.id}`}
                        >
                          {t.tasks.checklistNoteSave}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {showMutationError && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{t.tasks.checklistMutationError}</p>}
      {canEdit && (
        <div className="task-checklist-add">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabelState({ taskId, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newLabel.trim()) {
                e.preventDefault();
                addMut.mutate({ label: newLabel.trim(), currentTaskId: taskId });
              }
            }}
            placeholder={t.tasks.checklistAddPlaceholder}
            aria-label={t.tasks.checklistAddPlaceholder}
            className="h-9 text-sm"
            data-testid={`input-checklist-add-${taskId}`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!newLabel.trim() || addMut.isPending}
            onClick={() => addMut.mutate({ label: newLabel.trim(), currentTaskId: taskId })}
            className="h-9 px-3"
            aria-label={t.tasks.checklistAdd}
            data-testid={`button-checklist-add-${taskId}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </section>
  );
}
