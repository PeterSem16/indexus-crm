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

const ACTION_OPTIONS = [
  { value: "inbound_queue", label: "Inbound Queue", icon: PhoneIncoming },
  { value: "ivr_menu", label: "IVR Menu", icon: Menu },
  { value: "pjsip_user", label: "PJSIP Telefón", icon: User },
  { value: "transfer", label: "Presmerovanie", icon: PhoneForwarded },
  { value: "voicemail", label: "Odkazová služba", icon: Voicemail },
  { value: "hangup", label: "Zavesiť", icon: PhoneOff },
];

const COUNTRY_OPTIONS = [
  { value: "SK", label: "Slovensko" },
  { value: "CZ", label: "Česko" },
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
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<DidRoute | null>(null);
  const [form, setForm] = useState<Partial<DidRoute>>(emptyForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const createMutation = useMutation({
    mutationFn: (data: Partial<DidRoute>) => apiRequest("POST", "/api/did-routes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/did-routes"] });
      setIsDialogOpen(false);
      toast({ title: "DID smerovanie vytvorené" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa vytvoriť", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DidRoute> }) => apiRequest("PUT", `/api/did-routes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/did-routes"] });
      setIsDialogOpen(false);
      setEditingRoute(null);
      toast({ title: "DID smerovanie aktualizované" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa aktualizovať", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/did-routes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/did-routes"] });
      setDeleteConfirm(null);
      toast({ title: "DID smerovanie vymazané" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa vymazať", variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingRoute(null);
    setForm(emptyForm());
    setIsDialogOpen(true);
  };

  const openEdit = (route: DidRoute) => {
    setEditingRoute(route);
    setForm({
      didNumber: route.didNumber,
      name: route.name || "",
      description: route.description || "",
      countryCode: route.countryCode || "",
      action: route.action,
      targetQueueId: route.targetQueueId || "",
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
      toast({ title: "Chyba", description: "DID číslo je povinné", variant: "destructive" });
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

  const getTargetDisplay = (route: DidRoute) => {
    switch (route.action) {
      case "inbound_queue": {
        const queue = queues.find(q => q.id === route.targetQueueId);
        return queue ? queue.name : route.targetQueueId || "-";
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
      case "voicemail":
        return route.voicemailBox || "-";
      default:
        return "-";
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-did-routes-title">DID Smerovanie</h3>
          <p className="text-sm text-muted-foreground">
            Konfigurácia smerovania prichádzajúcich hovorov podľa DID čísla
          </p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-did-route">
          <Plus className="w-4 h-4 mr-2" />
          Pridať DID
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Načítavam...</div>
      ) : routes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Žiadne DID smerovania</p>
            <p className="text-sm text-muted-foreground mt-1">
              Pridajte DID číslo a nastavte kam sa majú prichádzajúce hovory smerovať
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DID Číslo</TableHead>
                <TableHead>Názov</TableHead>
                <TableHead>Krajina</TableHead>
                <TableHead>Akcia</TableHead>
                <TableHead>Cieľ</TableHead>
                <TableHead>Priorita</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => {
                const ActionIcon = getActionIcon(route.action);
                return (
                  <TableRow key={route.id} data-testid={`row-did-route-${route.id}`}>
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
                        <ActionIcon className="w-4 h-4" />
                        <span>{getActionLabel(route.action)}</span>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-did-target-${route.id}`}>{getTargetDisplay(route)}</TableCell>
                    <TableCell>{route.priority}</TableCell>
                    <TableCell>
                      <Badge variant={route.isActive ? "default" : "secondary"} data-testid={`badge-did-status-${route.id}`}>
                        {route.isActive ? "Aktívne" : "Neaktívne"}
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-did-dialog-title">
              {editingRoute ? "Upraviť DID smerovanie" : "Nové DID smerovanie"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>DID Číslo *</Label>
                <Input
                  placeholder="+421212345678"
                  value={form.didNumber || ""}
                  onChange={(e) => setForm({ ...form, didNumber: e.target.value })}
                  data-testid="input-did-number"
                />
              </div>
              <div className="space-y-2">
                <Label>Názov</Label>
                <Input
                  placeholder="Hlavná linka SK"
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="input-did-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Krajina</Label>
                <Select value={form.countryCode || "none"} onValueChange={(v) => setForm({ ...form, countryCode: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="select-did-country">
                    <SelectValue placeholder="Vyberte krajinu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Žiadna —</SelectItem>
                    {COUNTRY_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorita</Label>
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
              <Label>Akcia smerovania *</Label>
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
              <div className="space-y-2">
                <Label>Cieľová fronta</Label>
                <Select value={form.targetQueueId || ""} onValueChange={(v) => setForm({ ...form, targetQueueId: v })}>
                  <SelectTrigger data-testid="select-did-target-queue">
                    <SelectValue placeholder="Vyberte frontu" />
                  </SelectTrigger>
                  <SelectContent>
                    {queues.filter(q => q.isActive).map(q => (
                      <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.action === "ivr_menu" && (
              <div className="space-y-2">
                <Label>IVR Menu</Label>
                <Select value={form.targetIvrMenuId || ""} onValueChange={(v) => setForm({ ...form, targetIvrMenuId: v })}>
                  <SelectTrigger data-testid="select-did-target-ivr">
                    <SelectValue placeholder="Vyberte IVR menu" />
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
                <Label>PJSIP Používateľ</Label>
                <Select value={form.targetUserId || ""} onValueChange={(v) => setForm({ ...form, targetUserId: v })}>
                  <SelectTrigger data-testid="select-did-target-user">
                    <SelectValue placeholder="Vyberte používateľa" />
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
                <Label>Cieľové číslo / klapka</Label>
                <Input
                  placeholder="napr. +421900123456 alebo 100"
                  value={form.targetExtension || ""}
                  onChange={(e) => setForm({ ...form, targetExtension: e.target.value })}
                  data-testid="input-did-target-extension"
                />
              </div>
            )}

            {form.action === "voicemail" && (
              <div className="space-y-2">
                <Label>Schránka odkazovej služby</Label>
                <Input
                  placeholder="napr. 1000"
                  value={form.voicemailBox || ""}
                  onChange={(e) => setForm({ ...form, voicemailBox: e.target.value })}
                  data-testid="input-did-voicemail-box"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Popis</Label>
              <Textarea
                placeholder="Voliteľný popis..."
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
              <Label>Aktívne</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); setEditingRoute(null); }} data-testid="button-did-cancel">
              Zrušiť
            </Button>
            <Button onClick={handleSave} disabled={isPending} data-testid="button-did-save">
              {isPending ? "Ukladám..." : editingRoute ? "Uložiť" : "Vytvoriť"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vymazať DID smerovanie?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Táto akcia je nezvratná.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-did-delete-cancel">Zrušiť</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} data-testid="button-did-delete-confirm">
              Vymazať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
