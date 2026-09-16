import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import type { AgentBreakType } from "@shared/schema";
import type { Locale } from "@/i18n/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Coffee,
  Utensils,
  Clock,
  Timer,
  BookOpen,
  Briefcase,
  Heart,
  Phone,
  MessageSquare,
  Pause,
  Moon,
  Sun,
  Zap,
  Shield,
  Star,
  Music,
  Headphones,
  Dumbbell,
  Cigarette,
  Droplets,
  Brain,
  Stethoscope,
  GraduationCap,
  Users,
  AlertTriangle,
} from "lucide-react";

const ICON_OPTIONS: { name: string; icon: typeof Coffee }[] = [
  { name: "Coffee", icon: Coffee },
  { name: "Utensils", icon: Utensils },
  { name: "Clock", icon: Clock },
  { name: "Timer", icon: Timer },
  { name: "BookOpen", icon: BookOpen },
  { name: "Briefcase", icon: Briefcase },
  { name: "Heart", icon: Heart },
  { name: "Phone", icon: Phone },
  { name: "MessageSquare", icon: MessageSquare },
  { name: "Pause", icon: Pause },
  { name: "Moon", icon: Moon },
  { name: "Sun", icon: Sun },
  { name: "Zap", icon: Zap },
  { name: "Shield", icon: Shield },
  { name: "Star", icon: Star },
  { name: "Music", icon: Music },
  { name: "Headphones", icon: Headphones },
  { name: "Dumbbell", icon: Dumbbell },
  { name: "Cigarette", icon: Cigarette },
  { name: "Droplets", icon: Droplets },
  { name: "Brain", icon: Brain },
  { name: "Stethoscope", icon: Stethoscope },
  { name: "GraduationCap", icon: GraduationCap },
  { name: "Users", icon: Users },
];

const COLOR_OPTIONS = [
  "#EAB308", "#F59E0B", "#F97316", "#EF4444", "#EC4899",
  "#A855F7", "#8B5CF6", "#6366F1", "#3B82F6", "#0EA5E9",
  "#06B6D4", "#14B8A6", "#10B981", "#22C55E", "#84CC16",
  "#64748B", "#78716C", "#9333EA",
];

const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "sk", label: "Slovenčina" },
  { code: "cs", label: "Čeština" },
  { code: "hu", label: "Magyar" },
  { code: "ro", label: "Română" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
];

function getIconComponent(iconName: string | null | undefined) {
  if (!iconName) return Coffee;
  const found = ICON_OPTIONS.find((i) => i.name === iconName);
  return found ? found.icon : Coffee;
}

interface BreakTypeFormData {
  name: string;
  icon: string;
  color: string;
  isActive: boolean;
  isDefault: boolean;
  maxDurationMinutes: number | null;
  expectedDurationMinutes: number | null;
  translations: Record<string, string>;
}

const defaultFormData: BreakTypeFormData = {
  name: "",
  icon: "Coffee",
  color: "#EAB308",
  isActive: true,
  isDefault: false,
  maxDurationMinutes: null,
  expectedDurationMinutes: null,
  translations: {},
};

export function BreakTypesTab() {
  const { t } = useI18n();
  const ui = t.campaigns.inboundUi;
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BreakTypeFormData>(defaultFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: breakTypes = [], isLoading } = useQuery<AgentBreakType[]>({
    queryKey: ["/api/agent-break-types", { all: true }],
    queryFn: () => fetch("/api/agent-break-types?all=true", { credentials: "include" }).then(r => r.json()),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/agent-break-types"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/agent-break-types", data),
    onSuccess: () => {
      invalidateAll();
      setDialogOpen(false);
      toast({ title: ui.created });
    },
    onError: () => {
      toast({ title: ui.error, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/agent-break-types/${id}`, data),
    onSuccess: () => {
      invalidateAll();
      setDialogOpen(false);
      toast({ title: ui.updated });
    },
    onError: () => {
      toast({ title: ui.error, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agent-break-types/${id}`),
    onSuccess: () => {
      invalidateAll();
      setDeleteConfirmId(null);
      toast({ title: ui.deleted });
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEdit = (bt: AgentBreakType) => {
    setEditingId(bt.id);
    const trans = (bt.translations as Record<string, string>) || {};
    setFormData({
      name: bt.name,
      icon: bt.icon || "Coffee",
      color: bt.color || "#EAB308",
      isActive: bt.isActive ?? true,
      isDefault: bt.isDefault ?? false,
      maxDurationMinutes: bt.maxDurationMinutes ?? null,
      expectedDurationMinutes: bt.expectedDurationMinutes ?? null,
      translations: trans,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: ui.nameRequired, variant: "destructive" });
      return;
    }
    const payload = {
      name: formData.name,
      icon: formData.icon,
      color: formData.color,
      isActive: formData.isActive,
      isDefault: formData.isDefault,
      maxDurationMinutes: formData.maxDurationMinutes || null,
      expectedDurationMinutes: formData.expectedDurationMinutes || null,
      translations: formData.translations,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const labels = {
    title: t.campaigns.inboundUi.breaks,
    subtitle: t.campaigns.inboundUi.breaksSubtitle,
    addNew: t.campaigns.inboundUi.addNew,
    edit: ui.editBreak,
    name: t.campaigns.inboundUi.name,
    icon: ui.icon,
    color: ui.color,
    active: ui.activeLabel,
    default: t.campaigns.inboundUi.default,
    maxDuration: ui.maxDurationMinutes,
    expectedDuration: ui.expectedDurationMinutes,
    translations: t.campaigns.inboundUi.translations,
    save: ui.save,
    cancel: ui.cancel,
    delete: ui.delete,
    deleteConfirm: ui.deleteConfirm,
    noBreakTypes: t.campaigns.inboundUi.noBreakTypes,
    status: t.campaigns.inboundUi.status,
    duration: t.campaigns.inboundUi.duration,
    actions: t.campaigns.inboundUi.actions,
    expectedDurationHint: ui.expectedDurationHint,
  };

  const IconComponent = getIconComponent(formData.icon);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-background to-orange-50 p-5 shadow-sm dark:border-amber-900/50 dark:from-amber-950/25 dark:to-orange-950/15">
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-600/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700/80 dark:text-amber-300/80">{t.campaigns.title}</p>
              <h2 className="text-xl font-semibold tracking-tight" data-testid="text-break-types-title">{labels.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
            </div>
          </div>
          <Button onClick={openCreate} className="shrink-0 bg-amber-600 text-white shadow-sm hover:bg-amber-700" data-testid="button-add-break-type">
            <Plus className="h-4 w-4" />
            {labels.addNew}
          </Button>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="border-amber-200 bg-background/70 px-3 py-1 text-amber-800 dark:border-amber-800 dark:text-amber-200">
            <Coffee className="mr-1.5 h-3.5 w-3.5" /> {breakTypes.length} {t.campaigns.inboundUi.breaks}
          </Badge>
          <Badge variant="outline" className="border-emerald-200 bg-background/70 px-3 py-1 text-emerald-800 dark:border-emerald-800 dark:text-emerald-200">
            {breakTypes.filter(bt => bt.isActive).length} {t.campaigns.inboundUi.active.toLowerCase()}
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : breakTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Coffee className="h-12 w-12 mb-3 opacity-30" />
            <p>{labels.noBreakTypes}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-amber-200/80 shadow-sm dark:border-amber-900/50">
          <Table>
            <TableHeader>
              <TableRow className="bg-amber-50/60 hover:bg-amber-50/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/20">
                <TableHead className="w-12"></TableHead>
                <TableHead>{labels.name}</TableHead>
                <TableHead>{labels.translations}</TableHead>
                <TableHead>{labels.duration}</TableHead>
                <TableHead>{labels.status}</TableHead>
                <TableHead className="w-24 text-right">{labels.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakTypes.map((bt) => {
                const Icon = getIconComponent(bt.icon);
                const trans = (bt.translations as Record<string, string>) || {};
                const translatedCount = Object.keys(trans).filter(k => trans[k]).length;
                return (
                  <TableRow key={bt.id} data-testid={`row-break-type-${bt.id}`}>
                    <TableCell>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: bt.color || "#EAB308" }}
                      >
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{bt.name}</span>
                        {bt.isDefault && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            {labels.default}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {SUPPORTED_LOCALES.map((loc) => (
                          <Badge
                            key={loc.code}
                            variant={trans[loc.code] ? "default" : "outline"}
                            className={`text-[10px] px-1 py-0 ${trans[loc.code] ? "" : "opacity-40"}`}
                          >
                            {loc.code.toUpperCase()}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-0.5">
                        {bt.expectedDurationMinutes && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Timer className="h-3 w-3" />
                            <span>{bt.expectedDurationMinutes} min</span>
                          </div>
                        )}
                        {bt.maxDurationMinutes && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{t.campaigns.inboundUi.max} {bt.maxDurationMinutes} min</span>
                          </div>
                        )}
                        {!bt.expectedDurationMinutes && !bt.maxDurationMinutes && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={bt.isActive ? "default" : "secondary"} className={bt.isActive ? "bg-green-600" : ""}>
                         {bt.isActive ? t.campaigns.inboundUi.active : t.campaigns.inboundUi.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(bt)}
                          data-testid={`button-edit-break-${bt.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(bt.id)}
                          className="text-destructive"
                          data-testid={`button-delete-break-${bt.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? labels.edit : labels.addNew}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{labels.name}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={ui.namePlaceholder}
                data-testid="input-break-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{labels.icon}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-icon-picker">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ backgroundColor: formData.color }}
                      >
                        <IconComponent className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm">{formData.icon}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="start">
                    <div className="grid grid-cols-6 gap-1.5">
                      {ICON_OPTIONS.map(({ name, icon: Ic }) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon: name })}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                            formData.icon === name
                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                              : "hover:bg-muted"
                          }`}
                          data-testid={`icon-option-${name}`}
                        >
                          <Ic className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{labels.color}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-color-picker">
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: formData.color }} />
                      <span className="text-sm">{formData.color}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-3" align="start">
                    <div className="grid grid-cols-6 gap-1.5">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: c })}
                          className={`w-7 h-7 rounded-full transition-transform ${
                            formData.color === c ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: c }}
                          data-testid={`color-option-${c}`}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{labels.expectedDuration}</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.expectedDurationMinutes ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, expectedDurationMinutes: e.target.value ? parseInt(e.target.value) : null })
                  }
                  placeholder="15"
                  data-testid="input-expected-duration"
                />
                <p className="text-[11px] text-muted-foreground">{labels.expectedDurationHint}</p>
              </div>
              <div className="space-y-2">
                <Label>{labels.maxDuration}</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.maxDurationMinutes ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, maxDurationMinutes: e.target.value ? parseInt(e.target.value) : null })
                  }
                  placeholder="60"
                  data-testid="input-max-duration"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  data-testid="switch-active"
                />
                <Label>{labels.active}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={(v) => setFormData({ ...formData, isDefault: v })}
                  data-testid="switch-default"
                />
                <Label>{labels.default}</Label>
              </div>
            </div>

            <div className="space-y-3">
              <Label>{labels.translations}</Label>
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                {SUPPORTED_LOCALES.map((loc) => (
                  <div key={loc.code} className="flex items-center gap-2">
                    <Badge variant="outline" className="w-8 text-center text-[10px] shrink-0">
                      {loc.code.toUpperCase()}
                    </Badge>
                    <Input
                      value={formData.translations[loc.code] || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          translations: { ...formData.translations, [loc.code]: e.target.value },
                        })
                      }
                      placeholder={loc.label}
                      className="h-8 text-sm"
                      data-testid={`input-translation-${loc.code}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-muted/30">
              <Label className="text-xs text-muted-foreground mb-2 block">
                {ui.preview}
              </Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: formData.color }}
                >
                  <IconComponent className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium">{formData.name || "..."}</span>
                {formData.expectedDurationMinutes && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Timer className="h-3 w-3" />
                    {formData.expectedDurationMinutes}m
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-break">
              {labels.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-break"
            >
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{labels.delete}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{labels.deleteConfirm}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {labels.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-break"
            >
              {labels.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
