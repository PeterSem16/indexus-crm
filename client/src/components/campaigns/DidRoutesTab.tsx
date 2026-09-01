import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Phone,
  Plus,
  Pencil,
  Trash2,
  PhoneIncoming,
  PhoneForwarded,
  Voicemail,
  PhoneOff,
  GitBranch,
  User,
  Menu,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DidRoute {
  id: string;
  didNumber: string;
  name: string | null;
  description: string | null;
  countryCode: string | null;
  action: string;
  targetQueueId: string | null;
  targetIvrMenuId: string | null;
  targetUserId: string | null;
  targetExtension: string | null;
  voicemailBox: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InboundQueue {
  id: string;
  name: string;
  didNumber: string | null;
  isActive: boolean;
}

interface IvrMenu {
  id: string;
  name: string;
  isActive: boolean;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  sipExtension?: string;
}

const COUNTRY_OPTIONS = [
  { value: "SK", label: "Slovensko" },
  { value: "CZ", label: "Česko" },
  { value: "AT", label: "Rakúsko" },
  { value: "HU", label: "Maďarsko" },
  { value: "RO", label: "Rumunsko" },
  { value: "IT", label: "Taliansko" },
  { value: "DE", label: "Nemecko" },
  { value: "US", label: "USA" },
];

const emptyForm = (): Partial<DidRoute> => ({
  didNumber: "",
  name: "",
  description: "",
  countryCode: "",
  action: "hangup",
  targetQueueId: "",
  targetIvrMenuId: "",
  targetUserId: "",
  targetExtension: "",
  voicemailBox: "",
  priority: 0,
  isActive: true,
});

export function DidRoutesTab() {
  const { t } = useI18n();
  const dr = (t as any).campaigns?.didRoutes || {};
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<DidRoute | null>(null);
  const [form, setForm] = useState<Partial<DidRoute>>(emptyForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const ACTION_OPTIONS = [
    { value: "inbound_queue", label: dr.actionInboundQueue || "Inbound Queue", icon: PhoneIncoming },
    { value: "ivr_menu", label: dr.actionIvrMenu || "IVR Menu", icon: Menu },
    { value: "pjsip_user", label: dr.actionPjsipUser || "PJSIP User", icon: User },
    { value: "transfer", label: dr.actionTransfer || "Transfer", icon: PhoneForwarded },
    { value: "voicemail", label: dr.actionVoicemail || "Voicemail", icon: Voicemail },
    { value: "hangup", label: dr.actionHangup || "Hangup", icon: PhoneOff },
  ];

  const { data: routes = [], isLoading } = useQuery<DidRoute[]>({
    queryKey: ["/api/did-routes"],
  });

  const { data: queues = [] } = useQuery<InboundQueue[]>({
    queryKey: ["/api/inbound-queues"],
  });

  const { data: ivrMenus = [] } = useQuery<IvrMenu[]>({
    queryKey: ["/api/ivr-menus"],
  });

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users"],
  });

  const { data: voicemailBoxes = [] } = useQuery<any[]>({
    queryKey: ["/api/voicemail-boxes"],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<DidRoute>) => apiRequest("POST", "/api/did-routes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/did-routes"] });
      setIsDialogOpen(false);
      toast({ title: dr.routeCreated || "DID route created" });
    },
    onError: (err: any) => {
      toast({ title: dr.error || "Error", description: err?.message || (dr.createError || "Failed to create"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DidRoute> }) => apiRequest("PUT", `/api/did-routes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/did-routes"] });
      setIsDialogOpen(false);
      setEditingRoute(null);
      toast({ title: dr.routeUpdated || "DID route updated" });
    },
    onError: (err: any) => {
      toast({ title: dr.error || "Error", description: err?.message || (dr.updateError || "Failed to update"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/did-routes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/did-routes"] });
      setDeleteConfirm(null);
      toast({ title: dr.routeDeleted || "DID route deleted" });
    },
    onError: (err: any) => {
      toast({ title: dr.error || "Error", description: err?.message || (dr.deleteError || "Failed to delete"), variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingRoute(null);
    setForm(emptyForm());
    setIsDialogOpen(true);
  };

  const openEdit = (route: DidRoute) => {
    const linkedQueue = route.action === "inbound_queue" ? findQueueForRoute(route) : undefined;
    setEditingRoute(route);
    setForm({
      didNumber: route.didNumber,
      name: route.name || "",
      description: route.description || "",
      countryCode: route.countryCode || "",
      action: route.action,
      targetQueueId: route.targetQueueId || linkedQueue?.id || "",
      targetIvrMenuId: route.targetIvrMenuId || "",
      targetUserId: route.targetUserId || "",
      targetExtension: route.targetExtension || "",
      voicemailBox: route.voicemailBox || "",
      priority: route.priority,
      isActive: route.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.didNumber?.trim()) {
      toast({ title: dr.error || "Error", description: dr.didNumberRequired || "DID number is required", variant: "destructive" });
      return;
    }
    if (editingRoute) {
      updateMutation.mutate({ id: editingRoute.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const getActionLabel = (action: string) => {
    return ACTION_OPTIONS.find(a => a.value === action)?.label || action;
  };

  const getActionIcon = (action: string) => {
    const opt = ACTION_OPTIONS.find(a => a.value === action);
    if (!opt) return GitBranch;
    return opt.icon;
  };

  const findQueueForRoute = (route: Pick<DidRoute, "action" | "targetQueueId" | "didNumber">) => {
    if (route.action !== "inbound_queue") return undefined;
    const byId = route.targetQueueId
      ? queues.find(q => String(q.id) === String(route.targetQueueId))
      : undefined;
    if (byId) return byId;

    // Older routes linked the DID to the queue's didNumber instead of targetQueueId.
    return queues.find(q => q.didNumber && q.didNumber === route.didNumber);
  };

  const getTargetDisplay = (route: DidRoute) => {
    switch (route.action) {
      case "inbound_queue": {
        const queue = findQueueForRoute(route);
        return queue ? queue.name : route.targetQueueId || dr.selectQueue || "-";
      }
      case "ivr_menu": {
        const menu = ivrMenus.find(m => m.id === route.targetIvrMenuId);
        return menu ? menu.name : route.targetIvrMenuId || "-";
      }
      case "pjsip_user": {
        const user = users.find(u => u.id === route.targetUserId);
        return user ? `${user.firstName} ${user.lastName}` : route.targetUserId || "-";
      }
      case "transfer":
        return route.targetExtension || "-";
      case "voicemail": {
        const box = voicemailBoxes.find((b: any) => b.id === route.voicemailBox);
        return box ? `${box.name}${box.extension ? ` (${box.extension})` : ""}` : route.voicemailBox || "-";
      }
      default:
        return "-";
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const activeRouteCount = routes.filter(route => route.isActive).length;
  const inboundRouteCount = routes.filter(route => route.action === "inbound_queue").length;
  const selectedQueue = form.targetQueueId
    ? queues.find(q => String(q.id) === String(form.targetQueueId))
    : undefined;
  const queueOptions = queues.filter(q =>
    q.isActive || String(q.id) === String(form.targetQueueId || "")
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-orange-50 p-5 shadow-sm dark:border-violet-900/60 dark:from-violet-950/30 dark:via-background dark:to-orange-950/20">
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-violet-300/20 blur-2xl dark:bg-violet-600/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700/80 dark:text-violet-300/80">
                <Sparkles className="h-3 w-3" />
                {dr.action || "Action"}
              </p>
              <h3 className="text-xl font-semibold tracking-tight" data-testid="text-did-routes-title">{dr.title || "DID Routing"}</h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {dr.description || "Configure routing of incoming calls by DID number"}
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="shrink-0 bg-violet-600 text-white shadow-sm hover:bg-violet-700" data-testid="button-add-did-route">
            <Plus className="mr-2 h-4 w-4" />
            {dr.addDid || "Add DID"}
          </Button>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Badge variant="outline" className="border-violet-200 bg-white/70 px-3 py-1 text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            {activeRouteCount} {dr.active || "Active"}
          </Badge>
          <Badge variant="outline" className="border-orange-200 bg-white/70 px-3 py-1 text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
            <PhoneIncoming className="mr-1.5 h-3.5 w-3.5" />
            {inboundRouteCount} {dr.target || "Target"}
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-white/70 px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-200">
            <GitBranch className="mr-1.5 h-3.5 w-3.5" />
            {routes.length} {dr.action || "Action"}
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{dr.loading || "Loading..."}</div>
      ) : routes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">{dr.noRoutes || "No DID routes"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {dr.noRoutesHint || "Add a DID number and configure where incoming calls should be routed"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-violet-200/70 shadow-sm dark:border-violet-900/50">
          <Table>
            <TableHeader className="bg-violet-50/70 dark:bg-violet-950/20">
              <TableRow>
                <TableHead>{dr.didNumber || "DID Number"}</TableHead>
                <TableHead>{dr.name || "Name"}</TableHead>
                <TableHead>{dr.countryCode || "Country"}</TableHead>
                <TableHead>{dr.action || "Action"}</TableHead>
                <TableHead>{dr.target || "Target"}</TableHead>
                <TableHead>{dr.priority || "Priority"}</TableHead>
                <TableHead>{dr.status || "Status"}</TableHead>
                <TableHead className="text-right">{dr.actions || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => {
                const ActionIcon = getActionIcon(route.action);
                return (
                  <TableRow key={route.id} className="transition-colors hover:bg-violet-50/45 dark:hover:bg-violet-950/20" data-testid={`row-did-route-${route.id}`}>
                    <TableCell className="font-mono font-medium" data-testid={`text-did-number-${route.id}`}>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        {route.didNumber}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-did-name-${route.id}`}>{route.name || "-"}</TableCell>
                    <TableCell>
                      {route.countryCode ? (
                        <Badge variant="outline">{route.countryCode}</Badge>
                      ) : "-"}
                    </TableCell>
                     <TableCell>
                      <div className="flex items-center gap-2">
                         <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300">
                           <ActionIcon className="h-4 w-4" />
                         </span>
                        <span>{getActionLabel(route.action)}</span>
                      </div>
                    </TableCell>
                     <TableCell data-testid={`text-did-target-${route.id}`}>
                       <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                         route.action === "inbound_queue" && findQueueForRoute(route)
                           ? "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
                           : "border-muted bg-muted/40 text-muted-foreground"
                       }`}>
                         {route.action === "inbound_queue" && findQueueForRoute(route)
                           ? <PhoneIncoming className="h-3.5 w-3.5" />
                           : <AlertCircle className="h-3.5 w-3.5" />}
                         {getTargetDisplay(route)}
                       </span>
                     </TableCell>
                    <TableCell>{route.priority}</TableCell>
                    <TableCell>
                      <Badge variant={route.isActive ? "default" : "secondary"} data-testid={`badge-did-status-${route.id}`}>
                        {route.isActive ? (dr.active || "Active") : (dr.inactive || "Inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(route)} data-testid={`button-edit-did-${route.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(route.id)} data-testid={`button-delete-did-${route.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); setEditingRoute(null); } }}>
         <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto overflow-x-hidden rounded-2xl border-violet-200/80 p-0 shadow-2xl dark:border-violet-900/60">
           <DialogHeader className="border-b border-violet-200/60 bg-gradient-to-r from-violet-50 via-white to-orange-50 px-6 py-5 dark:border-violet-900/40 dark:from-violet-950/30 dark:via-background dark:to-orange-950/20">
             <DialogTitle className="flex items-center gap-3 text-lg" data-testid="text-did-dialog-title">
               <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
                 <GitBranch className="h-4 w-4" />
               </span>
               {editingRoute ? (dr.editRoute || "Edit DID Route") : (dr.createRoute || "New DID Route")}
             </DialogTitle>
          </DialogHeader>

           <div className="space-y-4 bg-background px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{dr.didNumberLabel || "DID Number"} *</Label>
                <Input
                  placeholder="+421212345678"
                  value={form.didNumber || ""}
                  onChange={(e) => setForm({ ...form, didNumber: e.target.value })}
                  data-testid="input-did-number"
                />
              </div>
              <div className="space-y-2">
                <Label>{dr.name || "Name"}</Label>
                <Input
                  placeholder={dr.namePlaceholder || "Main line SK"}
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="input-did-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{dr.countryCode || "Country"}</Label>
                <Select value={form.countryCode || "none"} onValueChange={(v) => setForm({ ...form, countryCode: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="select-did-country">
                    <SelectValue placeholder={dr.selectCountry || "Select country"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{dr.noCountry || "— None —"}</SelectItem>
                    {COUNTRY_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{dr.priority || "Priority"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.priority ?? 0}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                  data-testid="input-did-priority"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{dr.routingAction || "Routing Action"} *</Label>
              <Select value={form.action || "hangup"} onValueChange={(v) => setForm({ ...form, action: v })}>
                <SelectTrigger data-testid="select-did-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

             {form.action === "inbound_queue" && (
               <div className="rounded-xl border border-orange-200/80 bg-orange-50/35 p-3.5 space-y-2.5 dark:border-orange-900/60 dark:bg-orange-950/15">
                <Label>{dr.targetQueue || "Target Queue"}</Label>
                <Select value={form.targetQueueId || ""} onValueChange={(v) => setForm({ ...form, targetQueueId: v })}>
                  <SelectTrigger data-testid="select-did-target-queue">
                    <SelectValue placeholder={dr.selectQueue || "Select queue"} />
                  </SelectTrigger>
                  <SelectContent>
                     {queueOptions.map(q => (
                       <SelectItem key={q.id} value={String(q.id)}>
                         <span className="flex items-center gap-2">
                           <PhoneIncoming className="h-3.5 w-3.5 text-orange-600" />
                           {q.name}
                           {!q.isActive && <span className="text-xs text-muted-foreground">({dr.inactive || "Inactive"})</span>}
                         </span>
                       </SelectItem>
                    ))}
                     {form.targetQueueId && !selectedQueue && (
                       <SelectItem value={String(form.targetQueueId)}>
                         {String(form.targetQueueId)}
                       </SelectItem>
                     )}
                  </SelectContent>
                </Select>
                 {selectedQueue && (
                   <div className="flex items-center gap-2 text-xs text-orange-800 dark:text-orange-200">
                     <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                     <span>{selectedQueue.name}</span>
                     {!selectedQueue.isActive && <Badge variant="outline" className="border-orange-300 px-1.5 py-0 text-[10px]">{dr.inactive || "Inactive"}</Badge>}
                   </div>
                 )}
              </div>
            )}

            {form.action === "ivr_menu" && (
              <div className="space-y-2">
                <Label>{dr.targetIvrMenu || "IVR Menu"}</Label>
                <Select value={form.targetIvrMenuId || ""} onValueChange={(v) => setForm({ ...form, targetIvrMenuId: v })}>
                  <SelectTrigger data-testid="select-did-target-ivr">
                    <SelectValue placeholder={dr.selectIvrMenu || "Select IVR menu"} />
                  </SelectTrigger>
                  <SelectContent>
                    {ivrMenus.filter((m: any) => m.isActive !== false).map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.action === "pjsip_user" && (
              <div className="space-y-2">
                <Label>{dr.targetPjsipUser || "PJSIP User"}</Label>
                <Select value={form.targetUserId || ""} onValueChange={(v) => setForm({ ...form, targetUserId: v })}>
                  <SelectTrigger data-testid="select-did-target-user">
                    <SelectValue placeholder={dr.selectUser || "Select user"} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u: any) => u.sipExtension).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.sipExtension})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.action === "transfer" && (
              <div className="space-y-2">
                <Label>{dr.targetExtension || "Target number / extension"}</Label>
                <Input
                  placeholder={dr.targetExtensionPlaceholder || "e.g. +421900123456 or 100"}
                  value={form.targetExtension || ""}
                  onChange={(e) => setForm({ ...form, targetExtension: e.target.value })}
                  data-testid="input-did-target-extension"
                />
              </div>
            )}

            {form.action === "voicemail" && (
              <div className="space-y-2">
                <Label>{dr.voicemailBox || "Voicemail Box"}</Label>
                <Select value={form.voicemailBox || "__none__"} onValueChange={(v) => setForm({ ...form, voicemailBox: v === "__none__" ? "" : v })}>
                  <SelectTrigger data-testid="select-did-voicemail-box">
                    <SelectValue placeholder={dr.selectVoicemailBox || "Select voicemail box..."} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{dr.noVoicemailBox || "None"}</SelectItem>
                    {voicemailBoxes.filter((b: any) => b.isActive).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}{b.extension ? ` (${b.extension})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {voicemailBoxes.filter((b: any) => b.isActive).length === 0 && (
                  <p className="text-xs text-yellow-600">{dr.noVoicemailBoxesWarning || "No voicemail boxes configured. Create them in the Voicemails tab."}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>{dr.descriptionLabel || "Description"}</Label>
              <Textarea
                placeholder={dr.descriptionPlaceholder || "Optional description..."}
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                data-testid="input-did-description"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive ?? true}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                data-testid="switch-did-active"
              />
              <Label>{dr.isActive || "Active"}</Label>
            </div>
          </div>

           <DialogFooter className="border-t border-violet-200/60 bg-muted/20 px-6 py-4 dark:border-violet-900/40">
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); setEditingRoute(null); }} data-testid="button-did-cancel">
              {dr.cancel || "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={isPending} data-testid="button-did-save">
              {isPending ? (dr.saving || "Saving...") : editingRoute ? (dr.save || "Save") : (dr.create || "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dr.confirmDelete || "Delete DID route?"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{dr.deleteWarning || "This action cannot be undone."}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-did-delete-cancel">{dr.cancel || "Cancel"}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} data-testid="button-did-delete-confirm">
              {dr.delete || "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
