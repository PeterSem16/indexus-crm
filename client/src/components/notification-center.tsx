import { useState } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { sk } from "date-fns/locale";
import { 
  Bell, Mail, MessageSquare, UserPlus, RefreshCw, AlertTriangle, 
  Clipboard, Clock, CheckCircle, AtSign, Info, X, Check, CheckCheck,
  Filter, Trash2, Plus, Edit, Power, Settings, ChevronRight, ChevronLeft,
  Users, User, Shield
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Role, User as UserType } from "@shared/schema";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const NOTIFICATION_ICONS: Record<string, any> = {
  new_email: Mail,
  new_sms: MessageSquare,
  new_customer: UserPlus,
  status_change: RefreshCw,
  sentiment_alert: AlertTriangle,
  sentiment_negative: AlertTriangle,
  task_assigned: Clipboard,
  task_due: Clock,
  task_completed: CheckCircle,
  mention: AtSign,
  system: Info,
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const TRIGGER_TYPES = [
  { value: "new_email", label: "Nový email", icon: Mail },
  { value: "new_sms", label: "Nová SMS", icon: MessageSquare },
  { value: "new_customer", label: "Nový zákazník", icon: UserPlus },
  { value: "status_change", label: "Zmena stavu", icon: RefreshCw },
  { value: "sentiment_negative", label: "Negatívny sentiment", icon: AlertTriangle },
  { value: "task_overdue", label: "Úloha po termíne", icon: Clock },
  { value: "task_assigned", label: "Priradená úloha", icon: Clipboard },
];

const TARGET_TYPES = [
  { value: "all", label: "Všetci používatelia" },
  { value: "role", label: "Podľa role" },
  { value: "specific_users", label: "Konkrétni používatelia" },
  { value: "assignee", label: "Priradený používateľ" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Nízka" },
  { value: "normal", label: "Normálna" },
  { value: "high", label: "Vysoká" },
  { value: "urgent", label: "Urgentná" },
];

interface NotificationRule {
  id: string;
  name: string;
  description?: string | null;
  triggerType: string;
  triggerConditions?: any;
  countryCodes?: string[] | null;
  targetType: string;
  targetRoles?: string[] | null;
  targetUserIds?: string[] | null;
  notificationTitle: string;
  notificationMessage?: string | null;
  priority: string;
  sendPush: boolean;
  sendEmail: boolean;
  sendSms: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface NotificationItemProps {
  notification: any;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

function NotificationItem({ notification, onMarkRead, onDismiss }: NotificationItemProps) {
  const Icon = NOTIFICATION_ICONS[notification.type] || Info;
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { 
    addSuffix: true, 
    locale: sk 
  });

  return (
    <div 
      className={cn(
        "p-3 border-b last:border-b-0 hover-elevate cursor-pointer transition-colors",
        !notification.isRead && "bg-primary/5"
      )}
      onClick={() => !notification.isRead && onMarkRead(notification.id)}
      data-testid={`notification-item-${notification.id}`}
    >
      <div className="flex gap-3">
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          notification.priority === "urgent" ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300" :
          notification.priority === "high" ? "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300" :
          "bg-muted text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm truncate",
                !notification.isRead && "font-medium"
              )}>
                {notification.title}
              </p>
              {notification.message && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {notification.message}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(notification.id);
              }}
              data-testid={`dismiss-notification-${notification.id}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            {notification.countryCode && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                {notification.countryCode}
              </Badge>
            )}
            {notification.priority !== "normal" && (
              <Badge className={cn("text-xs px-1 py-0", PRIORITY_COLORS[notification.priority])}>
                {notification.priority === "urgent" ? "Urgentné" : 
                 notification.priority === "high" ? "Vysoká" : "Nízka"}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    isConnected,
    markAsRead, 
    markAllAsRead, 
    dismiss,
    dismissAll
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === "unread") return !n.isRead;
    return true;
  });

  const unreadNotifications = notifications.filter(n => !n.isRead);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notification-bell"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          {!isConnected && (
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-yellow-500" title="Odpojené" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-96 p-0" 
        align="end"
        data-testid="notification-center-popover"
      >
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notifikácie</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsRead()}
                className="text-xs h-7"
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Všetky prečítané
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-3 pt-2">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="all" className="text-xs" data-testid="tab-notifications-all">
                Všetky
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs" data-testid="tab-notifications-unread">
                Neprečítané ({unreadCount})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-0">
            <ScrollArea className="h-[400px]">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Žiadne notifikácie</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={markAsRead}
                      onDismiss={dismiss}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="unread" className="mt-0">
            <ScrollArea className="h-[400px]">
              {unreadNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Všetko prečítané</p>
                </div>
              ) : (
                <div className="divide-y">
                  {unreadNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={markAsRead}
                      onDismiss={dismiss}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator />
        <div className="p-2 flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => dismissAll()}
            data-testid="button-dismiss-all"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Vymazať všetky
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setIsOpen(false)}
            data-testid="button-view-all-notifications"
          >
            Zobraziť všetky
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const WIZARD_STEPS = [
  { id: 1, title: "Základné info", description: "Názov a popis pravidla" },
  { id: 2, title: "Spúšťač", description: "Kedy sa má notifikácia odoslať" },
  { id: 3, title: "Cieľová skupina", description: "Komu sa má notifikácia odoslať" },
  { id: 4, title: "Obsah a doručenie", description: "Text notifikácie a kanály" },
];

export function NotificationRulesManager() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    triggerType: "new_email",
    triggerConditions: null as any,
    countryCodes: [] as string[],
    targetType: "all",
    targetRoles: [] as string[],
    targetUserIds: [] as string[],
    notificationTitle: "",
    notificationMessage: "",
    priority: "normal",
    sendPush: true,
    sendEmail: false,
    sendSms: false,
    isActive: true,
  });

  const { data: rules = [], isLoading } = useQuery<NotificationRule[]>({
    queryKey: ["/api/notification-rules"],
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/notification-rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-rules"] });
      toast({ title: "Pravidlo vytvorené" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Chyba pri vytváraní pravidla", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PUT", `/api/notification-rules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-rules"] });
      toast({ title: "Pravidlo aktualizované" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Chyba pri aktualizácii pravidla", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/notification-rules/${id}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-rules"] });
    },
    onError: () => {
      toast({ title: "Chyba pri prepínaní pravidla", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/notification-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-rules"] });
      toast({ title: "Pravidlo vymazané" });
    },
    onError: () => {
      toast({ title: "Chyba pri mazaní pravidla", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      triggerType: "new_email",
      triggerConditions: null,
      countryCodes: [],
      targetType: "all",
      targetRoles: [],
      targetUserIds: [],
      notificationTitle: "",
      notificationMessage: "",
      priority: "normal",
      sendPush: true,
      sendEmail: false,
      sendSms: false,
      isActive: true,
    });
    setWizardStep(1);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingRule(null);
    resetForm();
  };

  const openEditDialog = (rule: NotificationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      triggerType: rule.triggerType,
      triggerConditions: rule.triggerConditions || null,
      countryCodes: rule.countryCodes || [],
      targetType: rule.targetType,
      targetRoles: rule.targetRoles || [],
      targetUserIds: rule.targetUserIds || [],
      notificationTitle: rule.notificationTitle,
      notificationMessage: rule.notificationMessage || "",
      priority: rule.priority,
      sendPush: rule.sendPush,
      sendEmail: rule.sendEmail,
      sendSms: rule.sendSms,
      isActive: rule.isActive,
    });
    setWizardStep(1);
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.notificationTitle) {
      toast({ title: "Vyplňte názov a titulok notifikácie", variant: "destructive" });
      return;
    }
    
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const canGoNext = () => {
    switch (wizardStep) {
      case 1: return formData.name.length > 0;
      case 2: return formData.triggerType.length > 0;
      case 3: 
        if (formData.targetType === "role") return formData.targetRoles.length > 0;
        if (formData.targetType === "specific_users") return formData.targetUserIds.length > 0;
        if (formData.targetType === "assignee") return formData.targetUserIds.length === 1;
        return true;
      case 4: return formData.notificationTitle.length > 0;
      default: return true;
    }
  };

  const toggleRoleSelection = (roleId: string) => {
    const current = formData.targetRoles;
    if (current.includes(roleId)) {
      setFormData({ ...formData, targetRoles: current.filter(r => r !== roleId) });
    } else {
      setFormData({ ...formData, targetRoles: [...current, roleId] });
    }
  };

  const toggleUserSelection = (userId: string) => {
    const current = formData.targetUserIds;
    if (formData.targetType === "assignee") {
      setFormData({ ...formData, targetUserIds: current.includes(userId) ? [] : [userId] });
    } else {
      if (current.includes(userId)) {
        setFormData({ ...formData, targetUserIds: current.filter(u => u !== userId) });
      } else {
        setFormData({ ...formData, targetUserIds: [...current, userId] });
      }
    }
  };

  const getTriggerLabel = (value: string) => {
    return TRIGGER_TYPES.find(t => t.value === value)?.label || value;
  };

  const getTargetLabel = (value: string) => {
    return TARGET_TYPES.find(t => t.value === value)?.label || value;
  };

  const renderWizardStep = () => {
    switch (wizardStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Názov pravidla *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Napr.: Upozornenie na nový email"
                data-testid="input-rule-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Popis</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Voliteľný popis pravidla..."
                data-testid="input-rule-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priorita</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger data-testid="select-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Label>Vyberte spúšťač notifikácie</Label>
            <div className="grid grid-cols-1 gap-2">
              {TRIGGER_TYPES.map((trigger) => {
                const Icon = trigger.icon;
                const isSelected = formData.triggerType === trigger.value;
                return (
                  <div
                    key={trigger.value}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover-elevate",
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    )}
                    onClick={() => setFormData({ ...formData, triggerType: trigger.value })}
                    data-testid={`trigger-${trigger.value}`}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{trigger.label}</p>
                    </div>
                    {isSelected && <Check className="h-5 w-5 text-primary" />}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <Label>Vyberte cieľovú skupinu</Label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {TARGET_TYPES.map((target) => {
                const isSelected = formData.targetType === target.value;
                const Icon = target.value === "all" ? Users : target.value === "role" ? Shield : target.value === "assignee" ? User : Users;
                return (
                  <div
                    key={target.value}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover-elevate",
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    )}
                    onClick={() => setFormData({ 
                      ...formData, 
                      targetType: target.value,
                      targetRoles: [],
                      targetUserIds: []
                    })}
                    data-testid={`target-${target.value}`}
                  >
                    <Icon className={cn("h-5 w-5", isSelected && "text-primary")} />
                    <span className={cn("text-sm font-medium", isSelected && "text-primary")}>{target.label}</span>
                  </div>
                );
              })}
            </div>

            {formData.targetType === "role" && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Vyberte role (môžete vybrať viacero)</Label>
                <ScrollArea className="h-[200px] border rounded-lg p-2">
                  <div className="space-y-2">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-md cursor-pointer hover-elevate",
                          formData.targetRoles.includes(role.id) && "bg-primary/10"
                        )}
                        onClick={() => toggleRoleSelection(role.id)}
                        data-testid={`role-${role.id}`}
                      >
                        <Checkbox 
                          checked={formData.targetRoles.includes(role.id)} 
                          onCheckedChange={() => toggleRoleSelection(role.id)}
                        />
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{role.name}</p>
                          {role.description && (
                            <p className="text-xs text-muted-foreground">{role.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {roles.length === 0 && (
                      <p className="text-sm text-muted-foreground p-4 text-center">Žiadne role</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {formData.targetType === "specific_users" && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Vyberte používateľov (môžete vybrať viacero)</Label>
                <ScrollArea className="h-[200px] border rounded-lg p-2">
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-md cursor-pointer hover-elevate",
                          formData.targetUserIds.includes(user.id) && "bg-primary/10"
                        )}
                        onClick={() => toggleUserSelection(user.id)}
                        data-testid={`user-${user.id}`}
                      >
                        <Checkbox 
                          checked={formData.targetUserIds.includes(user.id)} 
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.fullName}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    ))}
                    {users.length === 0 && (
                      <p className="text-sm text-muted-foreground p-4 text-center">Žiadni používatelia</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {formData.targetType === "assignee" && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Vyberte jedného priradeného používateľa</Label>
                <ScrollArea className="h-[200px] border rounded-lg p-2">
                  <div className="space-y-2">
                    {users.map((user) => {
                      const isSelected = formData.targetUserIds.includes(user.id);
                      return (
                        <div
                          key={user.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-md cursor-pointer hover-elevate",
                            isSelected && "bg-primary/10 border border-primary"
                          )}
                          onClick={() => toggleUserSelection(user.id)}
                          data-testid={`assignee-${user.id}`}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                          )}>
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{user.fullName}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      );
                    })}
                    {users.length === 0 && (
                      <p className="text-sm text-muted-foreground p-4 text-center">Žiadni používatelia</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notificationTitle">Titulok notifikácie *</Label>
              <Input
                id="notificationTitle"
                value={formData.notificationTitle}
                onChange={(e) => setFormData({ ...formData, notificationTitle: e.target.value })}
                placeholder="Napr.: Nový email od zákazníka"
                data-testid="input-notification-title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notificationMessage">Text notifikácie</Label>
              <Textarea
                id="notificationMessage"
                value={formData.notificationMessage}
                onChange={(e) => setFormData({ ...formData, notificationMessage: e.target.value })}
                placeholder="Voliteľný text správy..."
                data-testid="input-notification-message"
              />
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <Label>Kanály doručenia</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Push notifikácia</p>
                      <p className="text-xs text-muted-foreground">Zobrazí sa v aplikácii</p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.sendPush}
                    onCheckedChange={(v) => setFormData({ ...formData, sendPush: v })}
                    data-testid="switch-send-push"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-xs text-muted-foreground">Odošle sa na email používateľa</p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.sendEmail}
                    onCheckedChange={(v) => setFormData({ ...formData, sendEmail: v })}
                    data-testid="switch-send-email"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">SMS</p>
                      <p className="text-xs text-muted-foreground">Odošle sa na telefónne číslo</p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.sendSms}
                    onCheckedChange={(v) => setFormData({ ...formData, sendSms: v })}
                    data-testid="switch-send-sms"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Notifikačné pravidlá</h2>
          <p className="text-sm text-muted-foreground">
            Nastavte automatické notifikácie pre rôzne udalosti
          </p>
        </div>
        <Button onClick={() => { resetForm(); setEditingRule(null); setShowDialog(true); }} data-testid="button-add-rule">
          <Plus className="h-4 w-4 mr-2" />
          Pridať pravidlo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Settings className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg">Žiadne pravidlá</p>
            <p className="text-sm">Vytvorte prvé pravidlo pre automatické notifikácie</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => {
            const TriggerIcon = TRIGGER_TYPES.find(t => t.value === rule.triggerType)?.icon || Bell;
            return (
              <Card key={rule.id} className={cn(!rule.isActive && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                      rule.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <TriggerIcon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{rule.name}</h3>
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "Aktívne" : "Neaktívne"}
                        </Badge>
                        <Badge variant="outline" className={PRIORITY_COLORS[rule.priority]}>
                          {PRIORITY_OPTIONS.find(p => p.value === rule.priority)?.label}
                        </Badge>
                      </div>
                      
                      {rule.description && (
                        <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          Spúšťač: {getTriggerLabel(rule.triggerType)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Cieľ: {getTargetLabel(rule.targetType)}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {rule.sendPush && <Badge variant="outline" className="text-xs">Push</Badge>}
                          {rule.sendEmail && <Badge variant="outline" className="text-xs">Email</Badge>}
                          {rule.sendSms && <Badge variant="outline" className="text-xs">SMS</Badge>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, isActive: checked })}
                        data-testid={`toggle-rule-${rule.id}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(rule)}
                        data-testid={`edit-rule-${rule.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(rule.id)}
                        data-testid={`delete-rule-${rule.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => {
        if (!open) handleCloseDialog();
        else setShowDialog(open);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Upraviť pravidlo" : "Nové notifikačné pravidlo"}</DialogTitle>
            <DialogDescription>
              Krok {wizardStep} z {WIZARD_STEPS.length}: {WIZARD_STEPS[wizardStep - 1]?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center gap-2 py-2">
            {WIZARD_STEPS.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors cursor-pointer",
                    wizardStep === step.id 
                      ? "bg-primary text-primary-foreground" 
                      : wizardStep > step.id 
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                  onClick={() => {
                    if (step.id <= wizardStep || (step.id === wizardStep + 1 && canGoNext())) {
                      setWizardStep(step.id);
                    }
                  }}
                  data-testid={`wizard-step-${step.id}`}
                >
                  {wizardStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                {step.id < WIZARD_STEPS.length && (
                  <div className={cn(
                    "w-8 h-0.5",
                    wizardStep > step.id ? "bg-primary" : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>
          
          <div className="py-4 min-h-[300px]">
            {renderWizardStep()}
          </div>
          
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div>
              {wizardStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={() => setWizardStep(wizardStep - 1)}
                  data-testid="button-wizard-back"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Späť
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCloseDialog} data-testid="button-cancel-rule">
                Zrušiť
              </Button>
              {wizardStep < WIZARD_STEPS.length ? (
                <Button 
                  onClick={() => setWizardStep(wizardStep + 1)}
                  disabled={!canGoNext()}
                  data-testid="button-wizard-next"
                >
                  Ďalej
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  disabled={createMutation.isPending || updateMutation.isPending || !canGoNext()}
                  data-testid="button-save-rule"
                >
                  {editingRule ? "Uložiť zmeny" : "Vytvoriť pravidlo"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NotificationCenterPage() {
  const { 
    notifications, 
    unreadCount, 
    isLoading,
    markAsRead, 
    markAllAsRead, 
    dismiss,
    dismissAll,
    refetch
  } = useNotifications();
  const [activeTab, setActiveTab] = useState<string>("history");
  const [filter, setFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread" && n.isRead) return false;
    if (filter === "read" && !n.isRead) return false;
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    return true;
  });

  const notificationTypes = Array.from(new Set(notifications.map(n => n.type)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifikačné centrum</h1>
          <p className="text-muted-foreground">
            Správa notifikácií a automatických pravidiel
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="history" data-testid="tab-history">
            <Bell className="h-4 w-4 mr-2" />
            História ({unreadCount} neprečítaných)
          </TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">
            <Settings className="h-4 w-4 mr-2" />
            Pravidlá
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="history" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Tabs value={filter} onValueChange={setFilter}>
                  <TabsList>
                    <TabsTrigger value="all" data-testid="filter-all">Všetky</TabsTrigger>
                    <TabsTrigger value="unread" data-testid="filter-unread">Neprečítané</TabsTrigger>
                    <TabsTrigger value="read" data-testid="filter-read">Prečítané</TabsTrigger>
                  </TabsList>
                </Tabs>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  data-testid="select-type-filter"
                >
                  <option value="all">Všetky typy</option>
                  {notificationTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button onClick={() => markAllAsRead()} variant="outline" data-testid="button-mark-all-read-page">
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Označiť všetky ako prečítané
                  </Button>
                )}
                <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh-notifications">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Obnoviť
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg">
                  <Bell className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg">Žiadne notifikácie</p>
                  <p className="text-sm">Keď prídu nové notifikácie, zobrazia sa tu</p>
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={cn(
                      "p-4 border rounded-lg hover-elevate cursor-pointer",
                      !notification.isRead && "bg-primary/5 border-primary/20"
                    )}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                    data-testid={`notification-row-${notification.id}`}
                  >
                    <div className="flex gap-4">
                      <div className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                        notification.priority === "urgent" ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300" :
                        notification.priority === "high" ? "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {(() => {
                          const Icon = NOTIFICATION_ICONS[notification.type] || Info;
                          return <Icon className="h-5 w-5" />;
                        })()}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className={cn("font-medium", !notification.isRead && "text-primary")}>
                              {notification.title}
                            </h3>
                            {notification.message && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {notification.message}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                data-testid={`mark-read-${notification.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                dismiss(notification.id);
                              }}
                              data-testid={`dismiss-${notification.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: sk })}
                          </span>
                          {notification.countryCode && (
                            <Badge variant="outline" className="text-xs">
                              {notification.countryCode}
                            </Badge>
                          )}
                          {notification.priority !== "normal" && (
                            <Badge className={cn("text-xs", PRIORITY_COLORS[notification.priority])}>
                              {notification.priority}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {notification.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="rules" className="mt-6">
          <NotificationRulesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
