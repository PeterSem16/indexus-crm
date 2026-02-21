import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Phone,
  Plus,
  Pencil,
  Trash2,
  TreePine,
  ArrowRight,
  Hash,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface IvrMenuOption {
  id?: string;
  menuId?: string;
  dtmfKey: string;
  label: string;
  action: string;
  targetId: string | null;
  announcementId: string | null;
  sortOrder: number;
}

interface IvrMenu {
  id: string;
  name: string;
  description: string | null;
  countryCode: string;
  promptMessageId: string | null;
  invalidMessageId: string | null;
  timeoutMessageId: string | null;
  maxRetries: number;
  timeout: number;
  isActive: boolean;
  options: IvrMenuOption[];
}

interface IvrMessage {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface InboundQueue {
  id: string;
  name: string;
  isActive: boolean;
}

const COUNTRIES = ["SK", "CZ", "HU", "RO", "IT", "DE", "US"];

const DTMF_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"];

const ACTION_TYPES = [
  { value: "queue", label: "Queue" },
  { value: "submenu", label: "Submenu" },
  { value: "transfer", label: "Transfer" },
  { value: "hangup", label: "Hangup" },
  { value: "voicemail", label: "Voicemail" },
  { value: "repeat", label: "Repeat" },
];

interface MenuFormData {
  name: string;
  description: string;
  countryCode: string;
  promptMessageId: string;
  invalidMessageId: string;
  timeoutMessageId: string;
  maxRetries: number;
  timeout: number;
  isActive: boolean;
  options: IvrMenuOption[];
}

const defaultFormData: MenuFormData = {
  name: "",
  description: "",
  countryCode: "SK",
  promptMessageId: "",
  invalidMessageId: "",
  timeoutMessageId: "",
  maxRetries: 3,
  timeout: 10,
  isActive: true,
  options: [],
};

const defaultOption: IvrMenuOption = {
  dtmfKey: "1",
  label: "",
  action: "queue",
  targetId: null,
  announcementId: null,
  sortOrder: 0,
};

export function IvrMenusTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<IvrMenu | null>(null);
  const [formData, setFormData] = useState<MenuFormData>(defaultFormData);
  const [previewMenuId, setPreviewMenuId] = useState<string | null>(null);

  const { data: menus = [], isLoading } = useQuery<IvrMenu[]>({
    queryKey: ["/api/ivr-menus"],
  });

  const { data: ivrMessages = [] } = useQuery<IvrMessage[]>({
    queryKey: ["/api/ivr-messages"],
  });

  const { data: inboundQueues = [] } = useQuery<InboundQueue[]>({
    queryKey: ["/api/inbound-queues"],
  });

  const promptMessages = ivrMessages.filter((m) => m.type === "ivr_prompt" && m.isActive);
  const allActiveMessages = ivrMessages.filter((m) => m.isActive);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/ivr-menus", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ivr-menus"] });
      closeDialog();
      toast({ title: "IVR menu created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PUT", `/api/ivr-menus/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ivr-menus"] });
      closeDialog();
      toast({ title: "IVR menu updated successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ivr-menus/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ivr-menus"] });
      toast({ title: "IVR menu deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingMenu(null);
    setFormData(defaultFormData);
  };

  const openCreate = () => {
    setEditingMenu(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEdit = (menu: IvrMenu) => {
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      description: menu.description || "",
      countryCode: menu.countryCode || "SK",
      promptMessageId: menu.promptMessageId || "",
      invalidMessageId: menu.invalidMessageId || "",
      timeoutMessageId: menu.timeoutMessageId || "",
      maxRetries: menu.maxRetries,
      timeout: menu.timeout,
      isActive: menu.isActive,
      options: (menu.options || []).map((o) => ({
        ...o,
        targetId: o.targetId || null,
        announcementId: o.announcementId || null,
      })),
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Menu name is required", variant: "destructive" });
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description || null,
      countryCode: formData.countryCode,
      promptMessageId: formData.promptMessageId || null,
      invalidMessageId: formData.invalidMessageId || null,
      timeoutMessageId: formData.timeoutMessageId || null,
      maxRetries: formData.maxRetries,
      timeout: formData.timeout,
      isActive: formData.isActive,
      options: formData.options.map((o, i) => ({
        dtmfKey: o.dtmfKey,
        label: o.label,
        action: o.action,
        targetId: o.targetId || null,
        announcementId: o.announcementId || null,
        sortOrder: i,
      })),
    };

    if (editingMenu) {
      updateMutation.mutate({ id: editingMenu.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const addOption = () => {
    const usedKeys = formData.options.map((o) => o.dtmfKey);
    const nextKey = DTMF_KEYS.find((k) => !usedKeys.includes(k)) || "1";
    setFormData((f) => ({
      ...f,
      options: [
        ...f.options,
        { ...defaultOption, dtmfKey: nextKey, sortOrder: f.options.length },
      ],
    }));
  };

  const removeOption = (index: number) => {
    setFormData((f) => ({
      ...f,
      options: f.options.filter((_, i) => i !== index),
    }));
  };

  const updateOption = (index: number, updates: Partial<IvrMenuOption>) => {
    setFormData((f) => ({
      ...f,
      options: f.options.map((o, i) => (i === index ? { ...o, ...updates } : o)),
    }));
  };

  const moveOption = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.options.length) return;
    setFormData((f) => {
      const opts = [...f.options];
      [opts[index], opts[newIndex]] = [opts[newIndex], opts[index]];
      return { ...f, options: opts.map((o, i) => ({ ...o, sortOrder: i })) };
    });
  };

  const getMessageName = (id: string | null) => {
    if (!id) return null;
    return ivrMessages.find((m) => m.id === id)?.name || null;
  };

  const getActionLabel = (action: string) =>
    ACTION_TYPES.find((a) => a.value === action)?.label || action;

  const getTargetLabel = (option: IvrMenuOption) => {
    if (!option.targetId) return null;
    switch (option.action) {
      case "queue":
        return inboundQueues.find((q) => q.id === option.targetId)?.name || "Unknown queue";
      case "submenu":
        return menus.find((m) => m.id === option.targetId)?.name || "Unknown menu";
      case "transfer":
        return option.targetId;
      default:
        return null;
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-ivr-menus-title">
            IVR Menus
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage IVR decision trees for inbound call routing
          </p>
        </div>
        <Button onClick={openCreate} data-testid="btn-create-ivr-menu">
          <Plus className="h-4 w-4 mr-2" />
          Create Menu
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : menus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <TreePine className="h-12 w-12 mb-3 opacity-30" />
            <p>No IVR menus configured yet</p>
            <Button className="mt-4" onClick={openCreate} data-testid="btn-create-first-ivr-menu">
              <Plus className="h-4 w-4 mr-2" />
              Create First Menu
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {menus.map((menu) => (
            <Card key={menu.id} className={!menu.isActive ? "opacity-60" : ""} data-testid={`card-ivr-menu-${menu.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <TreePine className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base" data-testid={`text-ivr-menu-name-${menu.id}`}>
                        {menu.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {menu.countryCode && (
                          <Badge variant="outline" className="text-xs">{menu.countryCode}</Badge>
                        )}
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-options-count-${menu.id}`}>
                          <Hash className="h-3 w-3 mr-1" />
                          {menu.options?.length || 0} options
                        </Badge>
                        {getMessageName(menu.promptMessageId) && (
                          <Badge variant="outline" className="text-xs">
                            Prompt: {getMessageName(menu.promptMessageId)}
                          </Badge>
                        )}
                        {!menu.isActive && (
                          <Badge variant="destructive" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      {menu.description && (
                        <p className="text-xs text-muted-foreground mt-1">{menu.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPreviewMenuId(previewMenuId === menu.id ? null : menu.id)}
                      data-testid={`btn-preview-ivr-menu-${menu.id}`}
                    >
                      <TreePine className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(menu)} data-testid={`btn-edit-ivr-menu-${menu.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this IVR menu?")) deleteMutation.mutate(menu.id);
                      }}
                      data-testid={`btn-delete-ivr-menu-${menu.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {previewMenuId === menu.id && (
                <CardContent className="border-t pt-4">
                  <MenuTreePreview menu={menu} menus={menus} inboundQueues={inboundQueues} />
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ivr-menu-form">
          <DialogHeader>
            <DialogTitle>{editingMenu ? "Edit IVR Menu" : "Create IVR Menu"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main IVR Menu"
                  data-testid="input-ivr-menu-name"
                />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the menu purpose..."
                  data-testid="input-ivr-menu-description"
                />
              </div>
              <div>
                <Label>Country</Label>
                <Select value={formData.countryCode} onValueChange={(v) => setFormData((f) => ({ ...f, countryCode: v }))}>
                  <SelectTrigger data-testid="select-ivr-menu-country"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prompt Message</Label>
                <Select
                  value={formData.promptMessageId || "none"}
                  onValueChange={(v) => setFormData((f) => ({ ...f, promptMessageId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger data-testid="select-prompt-message"><SelectValue placeholder="Select prompt..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No prompt</SelectItem>
                    {promptMessages.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Invalid Input Message</Label>
                <Select
                  value={formData.invalidMessageId || "none"}
                  onValueChange={(v) => setFormData((f) => ({ ...f, invalidMessageId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger data-testid="select-invalid-message"><SelectValue placeholder="Select message..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No message</SelectItem>
                    {allActiveMessages.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Timeout Message</Label>
                <Select
                  value={formData.timeoutMessageId || "none"}
                  onValueChange={(v) => setFormData((f) => ({ ...f, timeoutMessageId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger data-testid="select-timeout-message"><SelectValue placeholder="Select message..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No message</SelectItem>
                    {allActiveMessages.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Retries</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={formData.maxRetries}
                  onChange={(e) => setFormData((f) => ({ ...f, maxRetries: Math.min(5, Math.max(1, parseInt(e.target.value) || 3)) }))}
                  data-testid="input-max-retries"
                />
              </div>
              <div>
                <Label>Timeout (seconds)</Label>
                <Input
                  type="number"
                  min={3}
                  max={30}
                  value={formData.timeout}
                  onChange={(e) => setFormData((f) => ({ ...f, timeout: Math.min(30, Math.max(3, parseInt(e.target.value) || 10)) }))}
                  data-testid="input-timeout"
                />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData((f) => ({ ...f, isActive: v }))}
                  data-testid="switch-ivr-menu-active"
                />
                <Label>Active</Label>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  DTMF Options
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addOption}
                  disabled={formData.options.length >= DTMF_KEYS.length}
                  data-testid="btn-add-dtmf-option"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Option
                </Button>
              </div>

              {formData.options.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No DTMF options configured. Add options for callers to press.
                </p>
              ) : (
                <div className="space-y-3">
                  {formData.options.map((option, index) => (
                    <DtmfOptionRow
                      key={index}
                      option={option}
                      index={index}
                      total={formData.options.length}
                      usedKeys={formData.options.map((o) => o.dtmfKey).filter((_, i) => i !== index)}
                      inboundQueues={inboundQueues}
                      ivrMenus={menus}
                      ivrMessages={allActiveMessages}
                      editingMenuId={editingMenu?.id || null}
                      onUpdate={(updates) => updateOption(index, updates)}
                      onRemove={() => removeOption(index)}
                      onMove={(dir) => moveOption(index, dir)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="btn-cancel-ivr-menu">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving} data-testid="btn-save-ivr-menu">
              {editingMenu ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DtmfOptionRow({
  option,
  index,
  total,
  usedKeys,
  inboundQueues,
  ivrMenus,
  ivrMessages,
  editingMenuId,
  onUpdate,
  onRemove,
  onMove,
}: {
  option: IvrMenuOption;
  index: number;
  total: number;
  usedKeys: string[];
  inboundQueues: InboundQueue[];
  ivrMenus: IvrMenu[];
  ivrMessages: IvrMessage[];
  editingMenuId: string | null;
  onUpdate: (updates: Partial<IvrMenuOption>) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const availableKeys = DTMF_KEYS.filter((k) => !usedKeys.includes(k) || k === option.dtmfKey);
  const needsTarget = ["queue", "submenu", "transfer"].includes(option.action);
  const availableMenus = ivrMenus.filter((m) => m.id !== editingMenuId);

  return (
    <div className="border rounded-lg p-3 space-y-2" data-testid={`dtmf-option-row-${index}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMove("up")}
            disabled={index === 0}
            className="h-7 w-7"
            data-testid={`btn-move-up-${index}`}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMove("down")}
            disabled={index === total - 1}
            className="h-7 w-7"
            data-testid={`btn-move-down-${index}`}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="w-20">
          <Select value={option.dtmfKey} onValueChange={(v) => onUpdate({ dtmfKey: v })}>
            <SelectTrigger data-testid={`select-dtmf-key-${index}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableKeys.map((k) => (
                <SelectItem key={k} value={k}>Key {k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[120px]">
          <Input
            value={option.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Option label (e.g. Sales)"
            data-testid={`input-option-label-${index}`}
          />
        </div>

        <div className="w-32">
          <Select
            value={option.action}
            onValueChange={(v) => onUpdate({ action: v, targetId: null })}
          >
            <SelectTrigger data-testid={`select-action-type-${index}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {needsTarget && (
          <div className="w-48">
            {option.action === "queue" && (
              <Select
                value={option.targetId || "none"}
                onValueChange={(v) => onUpdate({ targetId: v === "none" ? null : v })}
              >
                <SelectTrigger data-testid={`select-target-queue-${index}`}><SelectValue placeholder="Select queue..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No queue</SelectItem>
                  {inboundQueues.filter((q) => q.isActive).map((q) => (
                    <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {option.action === "submenu" && (
              <Select
                value={option.targetId || "none"}
                onValueChange={(v) => onUpdate({ targetId: v === "none" ? null : v })}
              >
                <SelectTrigger data-testid={`select-target-submenu-${index}`}><SelectValue placeholder="Select menu..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No menu</SelectItem>
                  {availableMenus.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {option.action === "transfer" && (
              <Input
                value={option.targetId || ""}
                onChange={(e) => onUpdate({ targetId: e.target.value || null })}
                placeholder="+421..."
                data-testid={`input-transfer-number-${index}`}
              />
            )}
          </div>
        )}

        <div className="w-40">
          <Select
            value={option.announcementId || "none"}
            onValueChange={(v) => onUpdate({ announcementId: v === "none" ? null : v })}
          >
            <SelectTrigger data-testid={`select-announcement-${index}`}><SelectValue placeholder="Announcement" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No announcement</SelectItem>
              {ivrMessages.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          data-testid={`btn-remove-option-${index}`}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function MenuTreePreview({
  menu,
  menus,
  inboundQueues,
}: {
  menu: IvrMenu;
  menus: IvrMenu[];
  inboundQueues: InboundQueue[];
}) {
  const getTargetLabel = (option: IvrMenuOption) => {
    if (!option.targetId) return null;
    switch (option.action) {
      case "queue":
        return inboundQueues.find((q) => q.id === option.targetId)?.name || "Unknown";
      case "submenu":
        return menus.find((m) => m.id === option.targetId)?.name || "Unknown";
      case "transfer":
        return option.targetId;
      default:
        return null;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "queue":
        return <Phone className="h-3 w-3" />;
      case "submenu":
        return <TreePine className="h-3 w-3" />;
      case "transfer":
        return <ArrowRight className="h-3 w-3" />;
      default:
        return <Hash className="h-3 w-3" />;
    }
  };

  const actionLabel = (action: string) => {
    const a = ACTION_TYPES.find((at) => at.value === action);
    return a?.label || action;
  };

  const sorted = [...(menu.options || [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-2" data-testid={`tree-preview-${menu.id}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <TreePine className="h-4 w-4 text-primary" />
        {menu.name}
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground ml-6">No options configured</p>
      ) : (
        <div className="ml-6 space-y-1">
          {sorted.map((option, i) => {
            const target = getTargetLabel(option);
            return (
              <div
                key={i}
                className="flex items-center gap-2 text-sm"
                data-testid={`tree-option-${menu.id}-${option.dtmfKey}`}
              >
                <div className="flex items-center gap-1 min-w-[40px]">
                  <Badge variant="outline" className="text-xs font-mono">
                    {option.dtmfKey}
                  </Badge>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{option.label || "Untitled"}</span>
                <Badge variant="secondary" className="text-xs gap-1">
                  {getActionIcon(option.action)}
                  {actionLabel(option.action)}
                </Badge>
                {target && (
                  <span className="text-xs text-muted-foreground">
                    <ArrowRight className="h-3 w-3 inline mr-1" />
                    {target}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
