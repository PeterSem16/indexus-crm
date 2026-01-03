import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { useAuth } from "@/contexts/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Task, User, Customer, TaskComment } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  MessageSquare,
  UserPlus,
  Eye,
  Send,
  Trash2
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
  const { t } = useI18n();
  const { selectedCountries } = useCountryFilter();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [reassignUserId, setReassignUserId] = useState("");
  const [newComment, setNewComment] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    assignedUserId: "",
  });

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

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
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      return apiRequest("POST", `/api/tasks/${id}/resolve`, { resolution });
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
    onError: () => {
      toast({
        title: t.common.error,
        description: t.tasks.resolveFailed,
        variant: "destructive",
      });
    },
  });

  const reassignTaskMutation = useMutation({
    mutationFn: async ({ id, newAssignedUserId }: { id: string; newAssignedUserId: string }) => {
      return apiRequest("POST", `/api/tasks/${id}/reassign`, { newAssignedUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: t.common.success,
        description: t.tasks.taskReassigned,
      });
      setReassignDialogOpen(false);
      setSelectedTask(null);
      setReassignUserId("");
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.tasks.reassignFailed,
        variant: "destructive",
      });
    },
  });

  const { data: taskComments = [] } = useQuery<TaskComment[]>({
    queryKey: ["/api/tasks", selectedTask?.id, "comments"],
    enabled: !!selectedTask && detailsDialogOpen,
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      return apiRequest("POST", `/api/tasks/${taskId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", selectedTask?.id, "comments"] });
      toast({
        title: t.common.success,
        description: t.tasks.commentAdded,
      });
      setNewComment("");
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", selectedTask?.id, "comments"] });
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
    updateTaskMutation.mutate({ id: task.id, status: newStatus });
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setEditForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      assignedUserId: task.assignedUserId,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedTask) return;
    updateTaskMutation.mutate({
      id: selectedTask.id,
      title: editForm.title,
      description: editForm.description,
      priority: editForm.priority,
      status: editForm.status,
      assignedUserId: editForm.assignedUserId,
    });
  };

  const handleResolveTask = (task: Task) => {
    setSelectedTask(task);
    setResolutionText("");
    setResolveDialogOpen(true);
  };

  const handleReassignTask = (task: Task) => {
    setSelectedTask(task);
    setReassignUserId("");
    setReassignDialogOpen(true);
  };

  const handleViewDetails = (task: Task) => {
    setSelectedTask(task);
    setDetailsDialogOpen(true);
  };

  const handleSubmitResolve = () => {
    if (!selectedTask || !resolutionText.trim()) return;
    resolveTaskMutation.mutate({ id: selectedTask.id, resolution: resolutionText });
  };

  const handleSubmitReassign = () => {
    if (!selectedTask || !reassignUserId) return;
    reassignTaskMutation.mutate({ id: selectedTask.id, newAssignedUserId: reassignUserId });
  };

  const handleAddComment = () => {
    if (!selectedTask || !newComment.trim()) return;
    addCommentMutation.mutate({ taskId: selectedTask.id, content: newComment });
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

    return (
      <Card className="hover-elevate" data-testid={`task-card-${task.id}`}>
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
              </div>
              <h3 className="font-medium text-sm truncate" data-testid={`task-title-${task.id}`}>
                {task.title}
              </h3>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                {assignedUser && (
                  <div className="flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    <span>{assignedUser.fullName || assignedUser.username}</span>
                  </div>
                )}
                {createdByUser && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">{t.tasks.createdBy}:</span>
                    <span>{createdByUser.fullName || createdByUser.username}</span>
                  </div>
                )}
                {task.dueDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(task.dueDate), "dd.MM.yyyy")}</span>
                  </div>
                )}
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
                  onClick={() => handleViewDetails(task)}
                  data-testid={`task-details-${task.id}`}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {t.tasks.viewDetails}
                </Button>
                {isActive && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleResolveTask(task)}
                      data-testid={`task-resolve-${task.id}`}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {t.tasks.resolve}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
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

  const userStatistics = users.map(u => {
    const userTasks = filteredTasks.filter(t => t.assignedUserId === u.id);
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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <UserIcon className="h-5 w-5 text-primary" />
          </div>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="my" className="w-full">
          <TabsList>
            <TabsTrigger value="my" data-testid="tab-my-tasks">
              {t.tasks.myTasks} ({myTasks.length})
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all-tasks">
              {t.tasks.allTasks} ({allTasks.length})
            </TabsTrigger>
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
          <TabsContent value="reporting" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">{t.tasks.userStatistics}</h2>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.tasks.editTask}</DialogTitle>
            <DialogDescription>{t.tasks.editTaskDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                    <SelectItem value="completed">{t.tasks.statuses.completed}</SelectItem>
                    <SelectItem value="cancelled">{t.tasks.statuses.cancelled}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t.quickCreate.assignedTo}</label>
              <Select value={editForm.assignedUserId} onValueChange={(val) => setEditForm({ ...editForm, assignedUserId: val })}>
                <SelectTrigger data-testid="select-edit-assigned">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.id).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateTaskMutation.isPending}>
              {updateTaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.tasks.resolveTask}</DialogTitle>
            <DialogDescription>{t.tasks.resolveTaskDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTask && (
              <div className="p-3 rounded-md bg-muted">
                <h4 className="font-medium text-sm">{selectedTask.title}</h4>
                {selectedTask.description && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedTask.description}</p>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">{t.tasks.resolution}</label>
              <Textarea
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder={t.tasks.resolution}
                className="min-h-[100px]"
                data-testid="input-resolve-resolution"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button 
              onClick={handleSubmitResolve} 
              disabled={resolveTaskMutation.isPending || !resolutionText.trim()}
            >
              {resolveTaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.tasks.resolve}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.tasks.reassignTask}</DialogTitle>
            <DialogDescription>{t.tasks.reassignTaskDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTask && (
              <div className="p-3 rounded-md bg-muted">
                <h4 className="font-medium text-sm">{selectedTask.title}</h4>
                <div className="text-xs text-muted-foreground mt-1">
                  {t.quickCreate.assignedTo}: {getUser(selectedTask.assignedUserId)?.fullName || getUser(selectedTask.assignedUserId)?.username}
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">{t.tasks.reassignTo}</label>
              <Select value={reassignUserId} onValueChange={setReassignUserId}>
                <SelectTrigger data-testid="select-reassign-user">
                  <SelectValue placeholder={t.common.select} />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.id && u.id !== selectedTask?.assignedUserId).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button 
              onClick={handleSubmitReassign} 
              disabled={reassignTaskMutation.isPending || !reassignUserId}
            >
              {reassignTaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.tasks.reassign}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.tasks.viewDetails}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
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
                {selectedTask.description && (
                  <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                )}
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
                <h4 className="font-medium flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4" />
                  {t.tasks.comments}
                </h4>
                <ScrollArea className="h-[200px] pr-4">
                  {taskComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t.tasks.noComments}</p>
                  ) : (
                    <div className="space-y-3">
                      {taskComments.map((comment) => {
                        const commentUser = getUser(comment.userId);
                        return (
                          <div key={comment.id} className="p-3 rounded-md bg-muted text-sm">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-medium">{commentUser?.fullName || commentUser?.username}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(comment.createdAt), "dd.MM.yyyy HH:mm")}
                                </span>
                                {comment.userId === user?.id && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => deleteCommentMutation.mutate({ taskId: selectedTask.id, commentId: comment.id })}
                                    data-testid={`delete-comment-${comment.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <p>{comment.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
                <div className="flex gap-2 mt-3">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={t.tasks.commentPlaceholder}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddComment()}
                    data-testid="input-new-comment"
                  />
                  <Button 
                    size="icon" 
                    onClick={handleAddComment} 
                    disabled={addCommentMutation.isPending || !newComment.trim()}
                    data-testid="button-add-comment"
                  >
                    {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
