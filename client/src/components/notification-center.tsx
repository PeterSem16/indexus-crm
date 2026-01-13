import { useState } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { sk } from "date-fns/locale";
import { 
  Bell, Mail, MessageSquare, UserPlus, RefreshCw, AlertTriangle, 
  Clipboard, Clock, CheckCircle, AtSign, Info, X, Check, CheckCheck,
  Filter, Trash2, Plus, Edit, Power, Settings, ChevronRight
} from "lucide-react";
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

function NotificationRulesManager() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  
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

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/notification-rules", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-rules"] });
      toast({ title: "Pravidlo vytvorené" });
      setShowDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Chyba pri vytváraní pravidla", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/notification-rules/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-rules"] });
      toast({ title: "Pravidlo aktualizované" });
      setShowDialog(false);
      setEditingRule(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Chyba pri aktualizácii pravidla", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest(`/api/notification-rules/${id}/toggle`, { 
        method: "PATCH", 
        body: JSON.stringify({ isActive }) 
      });
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
      return apiRequest(`/api/notification-rules/${id}`, { method: "DELETE" });
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

  const getTriggerLabel = (value: string) => {
    return TRIGGER_TYPES.find(t => t.value === value)?.label || value;
  };

  const getTargetLabel = (value: string) => {
    return TARGET_TYPES.find(t => t.value === value)?.label || value;
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Upraviť pravidlo" : "Nové notifikačné pravidlo"}</DialogTitle>
            <DialogDescription>
              Nastavte, kedy a komu sa má odosielať notifikácia
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Názov pravidla</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Napr.: Upozornenie na nový email"
                  data-testid="input-rule-name"
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
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Spúšťač (kedy)</Label>
                <Select value={formData.triggerType} onValueChange={(v) => setFormData({ ...formData, triggerType: v })}>
                  <SelectTrigger data-testid="select-trigger-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((trigger) => (
                      <SelectItem key={trigger.value} value={trigger.value}>
                        <div className="flex items-center gap-2">
                          <trigger.icon className="h-4 w-4" />
                          {trigger.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cieľová skupina (komu)</Label>
                <Select value={formData.targetType} onValueChange={(v) => setFormData({ ...formData, targetType: v })}>
                  <SelectTrigger data-testid="select-target-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPES.map((target) => (
                      <SelectItem key={target.value} value={target.value}>{target.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="notificationTitle">Titulok notifikácie</Label>
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
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.sendPush}
                    onCheckedChange={(v) => setFormData({ ...formData, sendPush: v })}
                    data-testid="switch-send-push"
                  />
                  <Label>Push notifikácia (v aplikácii)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.sendEmail}
                    onCheckedChange={(v) => setFormData({ ...formData, sendEmail: v })}
                    data-testid="switch-send-email"
                  />
                  <Label>Email</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.sendSms}
                    onCheckedChange={(v) => setFormData({ ...formData, sendSms: v })}
                    data-testid="switch-send-sms"
                  />
                  <Label>SMS</Label>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} data-testid="button-cancel-rule">
              Zrušiť
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-rule"
            >
              {editingRule ? "Uložiť zmeny" : "Vytvoriť pravidlo"}
            </Button>
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
