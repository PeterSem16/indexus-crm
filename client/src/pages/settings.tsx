import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { COUNTRIES, type ComplaintType, type CooperationType, type VipStatus, type HealthInsurance, type LeadScoringCriteria } from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import { Droplets, Globe, Shield, Save, Loader2, Plus, Trash2, Settings2, Heart, FlaskConical, Pencil, Star, Target, RefreshCw, Phone, Upload, FileText, CheckCircle, AlertCircle, Users, User, Check, Server, Eye, EyeOff, Link2, Smartphone, Copy, XCircle, Clock, CheckCircle2, Activity, Sparkles, Wand2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { AriSettingsTab } from "@/components/configurator/AriSettingsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Configuration list manager component
interface ConfigItem {
  id: string;
  name: string;
  countryCode?: string | null;
  code?: string;
  isActive: boolean;
}

function ConfigListManager({ 
  title, 
  description, 
  apiPath, 
  queryKey,
  showCode = false,
  requireCountry = false,
  countries = COUNTRIES as readonly { code: string; name: string; flag?: string }[],
}: { 
  title: string; 
  description: string; 
  apiPath: string;
  queryKey: string;
  showCode?: boolean;
  requireCountry?: boolean;
  countries?: readonly { code: string; name: string; flag?: string }[];
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCountryCode, setNewCountryCode] = useState<string>("__global__");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editCountryCode, setEditCountryCode] = useState<string>("__global__");

  const { data: items = [], isLoading } = useQuery<ConfigItem[]>({
    queryKey: [queryKey],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; code?: string; countryCode?: string | null }) =>
      apiRequest("POST", apiPath, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setNewName("");
      setNewCode("");
      setNewCountryCode("");
      toast({ title: t.settings.itemAdded });
    },
    onError: () => {
      toast({ title: t.settings.addFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${apiPath}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setDeleteId(null);
      toast({ title: t.settings.itemDeleted });
    },
    onError: () => {
      toast({ title: t.settings.deleteFailed, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; code?: string; countryCode?: string | null }) =>
      apiRequest("PATCH", `${apiPath}/${data.id}`, { name: data.name, code: data.code, countryCode: data.countryCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setEditingItem(null);
      toast({ title: t.settings.itemUpdated });
    },
    onError: () => {
      toast({ title: t.settings.updateFailed, variant: "destructive" });
    },
  });

  const handleStartEdit = (item: ConfigItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCode(item.code || "");
    setEditCountryCode(item.countryCode || "__global__");
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    if (!editName.trim()) {
      toast({ title: t.settings.nameRequired, variant: "destructive" });
      return;
    }
    if (showCode && !editCode.trim()) {
      toast({ title: t.settings.codeRequired, variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: editingItem.id,
      name: editName.trim(),
      code: showCode ? editCode.trim() : undefined,
      countryCode: editCountryCode === "__global__" ? null : editCountryCode,
    });
  };

  const handleAdd = () => {
    if (!newName.trim()) {
      toast({ title: t.settings.nameRequired, variant: "destructive" });
      return;
    }
    if (showCode && !newCode.trim()) {
      toast({ title: t.settings.codeRequired, variant: "destructive" });
      return;
    }
    if (requireCountry && (!newCountryCode || newCountryCode === "__global__")) {
      toast({ title: t.settings.countryRequired, variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      code: showCode ? newCode.trim() : undefined,
      countryCode: newCountryCode === "__global__" ? null : newCountryCode,
    });
  };

  const getCountryName = (code: string | null | undefined) => {
    if (!code) return t.settings.global;
    const country = countries.find(c => c.code === code);
    return country?.name || code;
  };
  
  // Filter items to only show those belonging to user's countries (or global items)
  const filteredItems = useMemo(() => {
    const countryCodes = countries.map(c => c.code);
    return items.filter(item => !item.countryCode || countryCodes.includes(item.countryCode as string));
  }, [items, countries]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            placeholder={t.settings.namePlaceholder}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            data-testid={`input-new-${queryKey}`}
          />
          {showCode && (
            <Input
              placeholder={t.settings.codePlaceholder}
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              data-testid={`input-new-code-${queryKey}`}
            />
          )}
          <Select value={newCountryCode} onValueChange={setNewCountryCode}>
            <SelectTrigger data-testid={`select-country-${queryKey}`}>
              <SelectValue placeholder={requireCountry ? t.settings.selectCountry : t.settings.global} />
            </SelectTrigger>
            <SelectContent>
              {!requireCountry && <SelectItem value="__global__">{t.settings.globalAllCountries}</SelectItem>}
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={createMutation.isPending} data-testid={`button-add-${queryKey}`}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            {t.common.add}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{t.settings.noItems}</p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              data-testid={`config-item-${item.id}`}
            >
              {editingItem?.id === item.id ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    data-testid={`input-edit-name-${item.id}`}
                  />
                  {showCode && (
                    <Input
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-24"
                      placeholder={t.settings.codePlaceholder}
                      data-testid={`input-edit-code-${item.id}`}
                    />
                  )}
                  <Select value={editCountryCode} onValueChange={setEditCountryCode}>
                    <SelectTrigger className="w-32" data-testid={`select-edit-country-${item.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!requireCountry && <SelectItem value="__global__">{t.settings.globalAllCountries}</SelectItem>}
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid={`button-save-edit-${item.id}`}>
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingItem(null)} data-testid={`button-cancel-edit-${item.id}`}>
                    {t.common.cancel}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{item.name}</span>
                    {showCode && item.code && (
                      <Badge variant="outline">{item.code}</Badge>
                    )}
                    <Badge variant="secondary">{getCountryName(item.countryCode)}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleStartEdit(item)}
                      data-testid={`button-edit-${item.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteId(item.id)}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.confirmDeleteMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const LEAD_SCORING_FIELDS = [
  'hasPhone', 'hasEmail', 'hasAddress', 'hasCase', 'newsletterOptIn',
  'caseStatus', 'hasExpectedDate', 'hasFatherInfo', 'hasProduct',
  'clientStatus', 'daysFromCreation'
] as const;

const LEAD_SCORING_CONDITIONS = ['equals', 'not_empty', 'greater_than', 'less_than', 'contains'] as const;
const LEAD_SCORING_CATEGORIES = ['profile', 'engagement', 'behavior', 'demographic'] as const;

interface CriteriaFormData {
  name: string;
  description: string;
  category: string;
  field: string;
  condition: string;
  value: string;
  points: number;
  isActive: boolean;
  countryCode: string | null;
}

function LeadScoringCriteriaManager({ countries }: { countries: readonly { code: string; name: string; flag?: string }[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState<LeadScoringCriteria | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const defaultFormData: CriteriaFormData = {
    name: '',
    description: '',
    category: 'profile',
    field: 'hasPhone',
    condition: 'not_empty',
    value: '',
    points: 10,
    isActive: true,
    countryCode: null,
  };

  const [formData, setFormData] = useState<CriteriaFormData>(defaultFormData);

  const { data: criteria, isLoading } = useQuery<LeadScoringCriteria[]>({
    queryKey: ['/api/lead-scoring-criteria'],
  });

  const saveMutation = useMutation({
    mutationFn: (data: CriteriaFormData) => {
      if (editingCriteria) {
        return apiRequest("PATCH", `/api/lead-scoring-criteria/${editingCriteria.id}`, data);
      }
      return apiRequest("POST", "/api/lead-scoring-criteria", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring-criteria'] });
      toast({ title: t.success.saved });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/lead-scoring-criteria/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring-criteria'] });
      toast({ title: t.success.deleted });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/lead-scoring-criteria/seed-defaults"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring-criteria'] });
      toast({ title: t.success.saved });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    try {
      await apiRequest("POST", "/api/lead-scoring/recalculate-all");
      toast({ title: t.success.updated });
    } catch {
      toast({ title: t.errors.generic, variant: "destructive" });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCriteria(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: LeadScoringCriteria) => {
    setEditingCriteria(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category,
      field: item.field,
      condition: item.condition,
      value: item.value || '',
      points: item.points,
      isActive: item.isActive,
      countryCode: item.countryCode,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCriteria(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.field) {
      toast({ title: t.errors.required, variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  const getFieldLabel = (field: string) => {
    const key = field as keyof typeof t.leadScoring.fieldOptions;
    return t.leadScoring.fieldOptions[key] || field;
  };

  const getConditionLabel = (condition: string) => {
    const key = condition as keyof typeof t.leadScoring.conditions;
    return t.leadScoring.conditions[key] || condition;
  };

  const getCategoryLabel = (category: string) => {
    const key = category as keyof typeof t.leadScoring.categories;
    return t.leadScoring.categories[key] || category;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleOpenAdd} data-testid="button-add-criteria">
            <Plus className="h-4 w-4 mr-2" />
            {t.leadScoring.addCriteria}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => seedMutation.mutate()} 
            disabled={seedMutation.isPending}
            data-testid="button-seed-defaults"
          >
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {t.leadScoring.seedDefaults}
          </Button>
        </div>
        <Button
          variant="secondary"
          onClick={handleRecalculateAll}
          disabled={isRecalculating}
          data-testid="button-recalculate-all"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
          {isRecalculating ? t.leadScoring.recalculatingAll : t.leadScoring.recalculateAll}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !criteria || criteria.length === 0 ? (
        <div className="text-center p-6 text-muted-foreground">
          {t.leadScoring.noCriteria}
        </div>
      ) : (
        <div className="space-y-3">
          {criteria.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-muted/50 justify-between"
              data-testid={`criteria-item-${item.id}`}
            >
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                <Switch
                  checked={item.isActive}
                  onCheckedChange={(checked) => {
                    apiRequest("PATCH", `/api/lead-scoring-criteria/${item.id}`, { isActive: checked })
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring-criteria'] });
                      })
                      .catch(() => {
                        toast({ title: t.errors.saveFailed, variant: "destructive" });
                      });
                  }}
                  data-testid={`switch-criteria-${item.id}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {getFieldLabel(item.field)} {getConditionLabel(item.condition)} {item.value ? `"${item.value}"` : ''}
                  </p>
                </div>
                <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
                <Badge variant={item.points > 0 ? "default" : "destructive"}>
                  {item.points > 0 ? '+' : ''}{item.points} {t.leadScoring.fields.points}
                </Badge>
                {item.countryCode && (
                  <Badge variant="secondary">{item.countryCode}</Badge>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleOpenEdit(item)}
                  data-testid={`button-edit-criteria-${item.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleteId(item.id)}
                  data-testid={`button-delete-criteria-${item.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCriteria ? t.leadScoring.editCriteria : t.leadScoring.addCriteria}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.leadScoring.fields.name} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-criteria-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t.leadScoring.description}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-criteria-description"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.leadScoring.fields.category}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger data-testid="select-criteria-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SCORING_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {getCategoryLabel(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t.leadScoring.fields.field}</Label>
                <Select
                  value={formData.field}
                  onValueChange={(v) => setFormData({ ...formData, field: v })}
                >
                  <SelectTrigger data-testid="select-criteria-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SCORING_FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {getFieldLabel(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.leadScoring.fields.condition}</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(v) => setFormData({ ...formData, condition: v })}
                >
                  <SelectTrigger data-testid="select-criteria-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SCORING_CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {getConditionLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t.leadScoring.fields.value}</Label>
                <Input
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={formData.condition === 'not_empty' ? '-' : ''}
                  disabled={formData.condition === 'not_empty'}
                  data-testid="input-criteria-value"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.leadScoring.fields.points}</Label>
                <Input
                  type="number"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                  data-testid="input-criteria-points"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.leadScoring.fields.countryCode}</Label>
                <Select
                  value={formData.countryCode || "all"}
                  onValueChange={(v) => setFormData({ ...formData, countryCode: v === "all" ? null : v })}
                >
                  <SelectTrigger data-testid="select-criteria-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.common.allCountries}</SelectItem>
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                id="isActive"
                data-testid="switch-criteria-active"
              />
              <Label htmlFor="isActive">{t.leadScoring.fields.isActive}</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-criteria">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t.common.save}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.leadScoring.deleteCriteria}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.leadScoring.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete-criteria"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SipSettingsFormData {
  server: string;
  port: number;
  wsPath: string;
  realm: string;
  transport: string;
  isEnabled: boolean;
  turnServer: string;
  turnUsername: string;
  turnPassword: string;
}

const defaultSipSettings: SipSettingsFormData = {
  server: "",
  port: 5060,
  wsPath: "/ws",
  realm: "",
  transport: "wss",
  isEnabled: false,
  turnServer: "",
  turnUsername: "",
  turnPassword: "",
};


interface SipSettingsData {
  server?: string;
  port?: number;
  wsPath?: string;
  realm?: string;
  transport?: string;
  isEnabled?: boolean;
  turnServer?: string;
  turnUsername?: string;
  turnPassword?: string;
}

function SipSettingsTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useI18n();
  
  const [formData, setFormData] = useState<SipSettingsFormData>(defaultSipSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{created: number; updated: number; errors?: string[]} | null>(null);

  const { data: sipSettings, isLoading: loadingSettings } = useQuery<SipSettingsData | null>({
    queryKey: ["/api/sip-settings"],
    retry: false,
  });

  const importMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const response = await apiRequest("POST", "/api/sip-extensions/import-csv", { csvData });
      return response.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/sip-extensions/available"] });
      toast({ 
        title: t.success.saved,
        description: `${data.created} ${t.common.created}, ${data.updated} ${t.common.updated}`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: t.errors.saveFailed, 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    const text = await csvFile.text();
    importMutation.mutate(text);
  };

  useEffect(() => {
    if (sipSettings) {
      setFormData({
        server: sipSettings.server || "",
        port: sipSettings.port || 5060,
        wsPath: sipSettings.wsPath || "/ws",
        realm: sipSettings.realm || "",
        transport: sipSettings.transport || "wss",
        isEnabled: sipSettings.isEnabled || false,
        turnServer: sipSettings.turnServer || "",
        turnUsername: sipSettings.turnUsername || "",
        turnPassword: sipSettings.turnPassword || "",
      });
    }
  }, [sipSettings]);

  const handleSave = async () => {
    if (!formData.server.trim()) {
      toast({ title: t.settings.sipServer.serverRequired, variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/sip-settings", formData);
      queryClient.invalidateQueries({ queryKey: ["/api/sip-settings"] });
      toast({ title: t.settings.sipServer.settingsSaved });
    } catch (error: any) {
      toast({ 
        title: t.settings.sipServer.saveError, 
        description: error.message || t.settings.sipServer.saveErrorDesc,
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>{t.settings.sipServer.title}</CardTitle>
            <CardDescription>
              {t.settings.sipServer.description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Switch
              id="sip-enabled"
              checked={formData.isEnabled}
              onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
              disabled={!isAdmin}
              data-testid="switch-sip-enabled"
            />
            <Label htmlFor="sip-enabled">
              {t.settings.sipServer.enableSip}
            </Label>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="server-address">{t.settings.sipServer.serverAddress}</Label>
              <Input
                id="server-address"
                placeholder={t.settings.sipServer.serverAddressPlaceholder}
                value={formData.server}
                onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                disabled={!isAdmin}
                data-testid="input-sip-server-address"
              />
              <p className="text-xs text-muted-foreground">
                {t.settings.sipServer.serverAddressHint}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="server-port">{t.settings.sipServer.port}</Label>
              <Input
                id="server-port"
                type="number"
                placeholder="5060"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 5060 })}
                disabled={!isAdmin}
                data-testid="input-sip-server-port"
              />
              <p className="text-xs text-muted-foreground">
                {t.settings.sipServer.portHint}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ws-path">{t.settings.sipServer.wsPath}</Label>
              <Input
                id="ws-path"
                placeholder="/ws"
                value={formData.wsPath}
                onChange={(e) => setFormData({ ...formData, wsPath: e.target.value })}
                disabled={!isAdmin}
                data-testid="input-sip-ws-path"
              />
              <p className="text-xs text-muted-foreground">
                {t.settings.sipServer.wsPathHint}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="realm">{t.settings.sipServer.realm}</Label>
              <Input
                id="realm"
                placeholder="asterisk"
                value={formData.realm}
                onChange={(e) => setFormData({ ...formData, realm: e.target.value })}
                disabled={!isAdmin}
                data-testid="input-sip-realm"
              />
              <p className="text-xs text-muted-foreground">
                {t.settings.sipServer.realmHint}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport">{t.settings.sipServer.protocol}</Label>
              <Select
                value={formData.transport}
                onValueChange={(value) => setFormData({ ...formData, transport: value })}
                disabled={!isAdmin}
              >
                <SelectTrigger id="transport" data-testid="select-sip-transport">
                  <SelectValue placeholder={t.settings.sipServer.protocolPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wss">WSS (WebSocket Secure)</SelectItem>
                  <SelectItem value="ws">WS (WebSocket)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t.settings.sipServer.protocolHint}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{t.settings.sipServer.turnTitle}</h3>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {t.settings.sipServer.turnBadge}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.settings.sipServer.turnDescription}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="turn-server">{t.settings.sipServer.turnServerUrl}</Label>
              <Input
                id="turn-server"
                placeholder={t.settings.sipServer.turnServerUrlPlaceholder}
                value={formData.turnServer}
                onChange={(e) => setFormData({ ...formData, turnServer: e.target.value })}
                disabled={!isAdmin}
                data-testid="input-turn-server"
              />
              <p className="text-xs text-muted-foreground">
                {t.settings.sipServer.turnServerUrlHint}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="turn-username">{t.settings.sipServer.turnUsername}</Label>
              <Input
                id="turn-username"
                placeholder="turn_user"
                value={formData.turnUsername}
                onChange={(e) => setFormData({ ...formData, turnUsername: e.target.value })}
                disabled={!isAdmin}
                data-testid="input-turn-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="turn-password">{t.settings.sipServer.turnPassword}</Label>
              <Input
                id="turn-password"
                type="password"
                placeholder="••••••••"
                value={formData.turnPassword}
                onChange={(e) => setFormData({ ...formData, turnPassword: e.target.value })}
                disabled={!isAdmin}
                data-testid="input-turn-password"
              />
            </div>

            <div className="flex items-end pb-0.5">
              {formData.turnServer ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  {t.settings.sipServer.turnConfigured}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                  {t.settings.sipServer.turnNotSet}
                </div>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                data-testid="button-save-sip-settings"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.settings.sipServer.saving}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t.settings.sipServer.saveSettings}
                  </>
                )}
              </Button>
            </div>
          )}

          {!isAdmin && (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                {t.settings.sipServer.adminOnly}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{t.settings.sipImport.title}</CardTitle>
              <CardDescription>
                {t.settings.sipImport.description}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t.settings.sipImport.csvFile}</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    setCsvFile(e.target.files?.[0] || null);
                    setImportResult(null);
                  }}
                  className="flex-1"
                  data-testid="input-csv-upload"
                />
                <Button
                  onClick={handleCsvUpload}
                  disabled={!csvFile || importMutation.isPending}
                  data-testid="button-import-csv"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.common.loading}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {t.settings.sipImport.importButton}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {importResult && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{t.settings.sipImport.importComplete}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{t.settings.sipImport.created}: {importResult.created}</p>
                  <p>{t.settings.sipImport.updated}: {importResult.updated}</p>
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-2 p-2 rounded bg-destructive/10 text-sm">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>{t.errors.importErrors || "Chyby pri importe"}:</span>
                    </div>
                    <ul className="list-disc list-inside mt-1 text-muted-foreground">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li>...{t.common.andMore || "a ďalších"} {importResult.errors.length - 5}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t.settings.sipImport.csvFormat}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {t.settings.sipImport.formatDescription}
              </p>
              <code className="block text-xs bg-background p-2 rounded">
                country,extension,sip_username,sip_password<br/>
                SK,2003,2003,heslo123<br/>
                CZ,2100,2100,heslo456
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.sipServer.howItWorks}</CardTitle>
          <CardDescription>
            {t.settings.sipServer.howItWorksDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Badge>1</Badge>
              <div>
                <p className="font-medium text-sm">{t.settings.sipServer.step1Title}</p>
                <p className="text-sm text-muted-foreground">
                  {t.settings.sipServer.step1Desc}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Badge>2</Badge>
              <div>
                <p className="font-medium text-sm">{t.settings.sipServer.step2Title}</p>
                <p className="text-sm text-muted-foreground">
                  {t.settings.sipServer.step2Desc}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Badge>3</Badge>
              <div>
                <p className="font-medium text-sm">{t.settings.sipServer.step3Title}</p>
                <p className="text-sm text-muted-foreground">
                  {t.settings.sipServer.step3Desc}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Badge>4</Badge>
              <div>
                <p className="font-medium text-sm">{t.settings.sipServer.step4Title}</p>
                <p className="text-sm text-muted-foreground">
                  {t.settings.sipServer.step4Desc}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface UdidRegistration {
  id: string;
  udid: string;
  firstName: string;
  lastName: string;
  product: string;
  version: string;
  serial: string;
  status: "pending" | "approved" | "rejected";
  note: string;
  collectedAt: string;
}

function IosDevicesTab() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: registrations = [], isLoading } = useQuery<UdidRegistration[]>({
    queryKey: ["/api/udid-registrations"],
    refetchInterval: 15000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status?: string; note?: string }) =>
      apiRequest("PATCH", `/api/udid-registrations/${id}`, { status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/udid-registrations"] });
      toast({ title: "Device updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/udid-registrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/udid-registrations"] });
      toast({ title: "Device removed" });
    },
  });

  const copyUdid = (udid: string, id: string) => {
    navigator.clipboard.writeText(udid);
    setCopiedId(id);
    toast({ title: "UDID copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pending = registrations.filter((r) => r.status === "pending");
  const approved = registrations.filter((r) => r.status === "approved");
  const rejected = registrations.filter((r) => r.status === "rejected");

  const statusIcon = (status: string) => {
    if (status === "pending") return <Clock className="h-4 w-4 text-yellow-500" />;
    if (status === "approved") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const statusBadge = (status: string) => {
    const variant = status === "pending" ? "outline" : status === "approved" ? "default" : "destructive";
    return <Badge variant={variant as any}>{status}</Badge>;
  };

  const renderDevice = (reg: UdidRegistration) => (
    <div key={reg.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`udid-device-${reg.id}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {statusIcon(reg.status)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all" data-testid={`udid-value-${reg.id}`}>
              {reg.udid}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => copyUdid(reg.udid, reg.id)}
              data-testid={`button-copy-udid-${reg.id}`}
            >
              {copiedId === reg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          {(reg.firstName || reg.lastName) && (
            <div className="text-sm font-medium mt-1">
              {reg.firstName} {reg.lastName}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-0.5">
            {reg.product && <span>{reg.product}</span>}
            {reg.version && <span> &middot; iOS {reg.version}</span>}
            {reg.serial && <span> &middot; S/N: {reg.serial}</span>}
            <span> &middot; {new Date(reg.collectedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {reg.status !== "approved" && (
          <Button
            variant="outline"
            size="sm"
            className="text-green-600 border-green-200 hover:bg-green-50"
            onClick={() => updateMutation.mutate({ id: reg.id, status: "approved" })}
            disabled={updateMutation.isPending}
            data-testid={`button-approve-${reg.id}`}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approve
          </Button>
        )}
        {reg.status !== "rejected" && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => updateMutation.mutate({ id: reg.id, status: "rejected" })}
            disabled={updateMutation.isPending}
            data-testid={`button-reject-${reg.id}`}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Reject
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => deleteMutation.mutate(reg.id)}
          disabled={deleteMutation.isPending}
          data-testid={`button-delete-udid-${reg.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                iOS Device Registrations
              </CardTitle>
              <CardDescription>
                Manage UDID registration requests for Ad Hoc distribution (max 100 devices).
                Share the registration link with users who need the app installed on their iPhone.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/udid`);
                  toast({ title: "Registration link copied" });
                }}
                data-testid="button-copy-udid-link"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy Registration Link
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="text-2xl font-bold text-yellow-600" data-testid="count-pending">{pending.length}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600" data-testid="count-approved">{approved.length}</div>
              <div className="text-xs text-muted-foreground">Approved</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg border">
              <div className="text-2xl font-bold" data-testid="count-total">{registrations.length}</div>
              <div className="text-xs text-muted-foreground">Total / 100</div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No device registrations yet</p>
              <p className="text-sm mt-1">Share the registration link with users to collect their device UDIDs</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-yellow-600 mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Pending Approval ({pending.length})
                  </h4>
                  <div className="space-y-2">
                    {pending.map(renderDevice)}
                  </div>
                </div>
              )}
              {approved.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Approved ({approved.length})
                  </h4>
                  <div className="space-y-2">
                    {approved.map(renderDevice)}
                  </div>
                </div>
              )}
              {rejected.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Rejected ({rejected.length})
                  </h4>
                  <div className="space-y-2">
                    {rejected.map(renderDevice)}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SipPhoneSection() {
  const { t } = useI18n();
  const [sipSubTab, setSipSubTab] = useState("sip-server");
  return (
    <Tabs value={sipSubTab} onValueChange={setSipSubTab}>
      <TabsList>
        <TabsTrigger value="sip-server" data-testid="tab-sip-server">
          <Phone className="h-4 w-4 mr-2" />
          {t.settings.sipServer.title}
        </TabsTrigger>
        <TabsTrigger value="asterisk-ari" data-testid="tab-asterisk-ari">
          <Server className="h-4 w-4 mr-2" />
          Asterisk ARI
        </TabsTrigger>
        <TabsTrigger value="ios-devices" data-testid="tab-ios-devices">
          <Smartphone className="h-4 w-4 mr-2" />
          iOS Devices
        </TabsTrigger>
      </TabsList>
      <TabsContent value="sip-server" className="mt-4">
        <SipSettingsTab />
      </TabsContent>
      <TabsContent value="asterisk-ari" className="mt-4">
        <AriSettingsTab />
      </TabsContent>
      <TabsContent value="ios-devices" className="mt-4">
        <IosDevicesTab />
      </TabsContent>
    </Tabs>
  );
}

// =================== CBC Activities Manager ===================
const CBC_ICON_OPTIONS = [
  "Activity", "Package", "FileSignature", "AlertTriangle", "Receipt", "ClipboardList",
  "MoreHorizontal", "Heart", "HeartPulse", "Stethoscope", "Building2", "Hospital",
  "Network", "User", "Users", "Briefcase", "FileText", "Mail", "Phone", "Star",
  "CheckCircle", "Award", "Microscope", "Pill", "Syringe", "TestTube",
  "FlaskConical", "Calendar", "Clipboard", "Database", "Folder", "Globe",
  "Layers", "Settings", "Shield", "TrendingUp", "Truck", "Zap", "Baby", "Milk",
];
const CBC_COLOR_OPTIONS = [
  "sky", "blue", "violet", "purple", "orange", "amber", "emerald", "green",
  "teal", "indigo", "rose", "pink", "fuchsia", "lime", "slate",
];
const CBC_SCOPE_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: "hospital", labelKey: "hospital" },
  { value: "clinic", labelKey: "clinic" },
  { value: "network", labelKey: "network" },
  { value: "midwife", labelKey: "midwife" },
  { value: "nurse", labelKey: "nurse" },
];
const CBC_COLOR_DOT_CLASS: Record<string, string> = {
  sky: "bg-sky-500", blue: "bg-blue-500", violet: "bg-violet-500", purple: "bg-purple-500",
  orange: "bg-orange-500", amber: "bg-amber-500", emerald: "bg-emerald-500", green: "bg-green-500",
  teal: "bg-teal-500", indigo: "bg-indigo-500", rose: "bg-rose-500", pink: "bg-pink-500",
  fuchsia: "bg-fuchsia-500", lime: "bg-lime-500", slate: "bg-slate-500",
};
const CBC_COLOR_TILE_CLASS: Record<string, string> = {
  sky: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  violet: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  teal: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  pink: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800",
  fuchsia: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:border-fuchsia-800",
  lime: "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950 dark:text-lime-300 dark:border-lime-800",
  slate: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
};

interface CbcActivityItem {
  id: string; code: string; name: string;
  nameEn?: string | null; nameSk?: string | null; nameCs?: string | null;
  nameHu?: string | null; nameRo?: string | null; nameIt?: string | null; nameDe?: string | null;
  description?: string | null; descriptionSk?: string | null; descriptionEn?: string | null;
  entityScope: string; icon: string; color: string;
  shortcut?: string | null; sortOrder: number; isActive: boolean; isDefault: boolean;
}

function CbcActivityIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ((LucideIcons as any)[name] || LucideIcons.Activity) as any;
  return <Icon className={className || "h-4 w-4"} />;
}

function CbcActivitiesManager() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const _raw = (t.settings as any).cbcActivities || {};
  const aT: Record<string, string> = {
    ..._raw,
    addActivity: _raw.addButton || _raw.addActivity || "Add activity",
    editActivity: _raw.editTitle || _raw.editActivity || "Edit activity",
    loadDefaults: _raw.seedDefaults || _raw.loadDefaults || "Load defaults",
    empty: _raw.emptyState || _raw.empty || "No activities yet.",
    activeLabel: _raw.isActiveLabel || _raw.activeLabel || "Active",
    translations: _raw.translationsLabel || _raw.translations || "Translations",
    preview: _raw.previewLabel || _raw.preview || "Preview",
    filterByScope: _raw.scopeLabel || _raw.filterByScope || "Type",
    allScopes: _raw.scopeFilterAll || _raw.allScopes || "All",
    confirmDeleteTitle: _raw.confirmDelete || _raw.confirmDeleteTitle || "Delete activity?",
    shortcutLabel: _raw.shortcutLabel || _raw.codeLabel || "Shortcut",
  };
  const scopeLabels: Record<string, string> = {
    hospital: aT.scopeHospital || "Hospital",
    clinic: aT.scopeClinic || "Clinic",
    network: aT.scopeNetwork || "Network",
    midwife: aT.scopeMidwife || "Midwife",
    nurse: aT.scopeNurse || "Nurse",
  };

  const [editing, setEditing] = useState<CbcActivityItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<string>("__all__");

  const [form, setForm] = useState({
    code: "", name: "", description: "",
    nameEn: "", nameSk: "", nameCs: "", nameHu: "", nameRo: "", nameIt: "", nameDe: "",
    entityScope: "hospital", icon: "Activity", color: "slate", shortcut: "", sortOrder: 0, isActive: true,
  });

  const { data: items = [], isLoading } = useQuery<CbcActivityItem[]>({
    queryKey: ["/api/cbc-activities"],
  });

  const filteredItems = useMemo(() => {
    if (scopeFilter === "__all__") return items;
    return items.filter((i) => i.entityScope === scopeFilter);
  }, [items, scopeFilter]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/cbc-activities", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cbc-activities"] });
      toast({ title: aT.added || "Activity added" });
      resetForm();
    },
    onError: (e: any) => toast({ title: e?.message || "Error", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/cbc-activities/${editing?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cbc-activities"] });
      toast({ title: aT.updated || "Activity updated" });
      resetForm();
    },
    onError: (e: any) => toast({ title: e?.message || "Error", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/cbc-activities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cbc-activities"] });
      setDeleteId(null);
      toast({ title: aT.deleted || "Activity deleted" });
    },
    onError: (e: any) => toast({ title: e?.message || "Error", variant: "destructive" }),
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/cbc-activities/seed-defaults", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cbc-activities"] });
      toast({ title: aT.seeded || "Default activities loaded" });
    },
    onError: (e: any) => toast({ title: e?.message || "Error", variant: "destructive" }),
  });

  const aiTranslateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cbc-activities/ai-translate", {
        text: form.name.trim(),
        sourceLang: locale,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setForm((prev) => ({
        ...prev,
        nameSk: data.sk || prev.nameSk,
        nameCs: data.cs || prev.nameCs,
        nameEn: data.en || prev.nameEn,
        nameHu: data.hu || prev.nameHu,
        nameRo: data.ro || prev.nameRo,
        nameIt: data.it || prev.nameIt,
        nameDe: data.de || prev.nameDe,
      }));
      toast({ title: aT.aiTranslated || "Translations generated" });
    },
    onError: (e: any) => toast({ title: e?.message || "Error", variant: "destructive" }),
  });

  const aiSampleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cbc-activities/ai-sample", {
        name: form.name.trim(),
        entityScope: form.entityScope,
        lang: locale,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.description) {
        setForm((prev) => ({ ...prev, description: data.description }));
        toast({ title: aT.aiGenerated || "Description generated" });
      }
    },
    onError: (e: any) => toast({ title: e?.message || "Error", variant: "destructive" }),
  });

  function runAiTranslate() {
    if (!form.name.trim()) {
      toast({ title: aT.enterNameFirst || "Enter the name first", variant: "destructive" });
      return;
    }
    aiTranslateMutation.mutate();
  }
  function runAiSample() {
    if (!form.name.trim()) {
      toast({ title: aT.enterNameFirst || "Enter the name first", variant: "destructive" });
      return;
    }
    aiSampleMutation.mutate();
  }

  function resetForm() {
    setShowForm(false);
    setEditing(null);
    setForm({
      code: "", name: "", description: "",
      nameEn: "", nameSk: "", nameCs: "", nameHu: "", nameRo: "", nameIt: "", nameDe: "",
      entityScope: "hospital", icon: "Activity", color: "slate", shortcut: "", sortOrder: 0, isActive: true,
    });
  }

  function openAdd() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(item: CbcActivityItem) {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description || "",
      nameEn: item.nameEn || "", nameSk: item.nameSk || "", nameCs: item.nameCs || "",
      nameHu: item.nameHu || "", nameRo: item.nameRo || "", nameIt: item.nameIt || "", nameDe: item.nameDe || "",
      entityScope: item.entityScope, icon: item.icon, color: item.color,
      shortcut: item.shortcut || "", sortOrder: item.sortOrder, isActive: item.isActive,
    });
    setShowForm(true);
  }

  function submit() {
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: aT.nameAndCodeRequired || "Name and code are required", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      sortOrder: Number(form.sortOrder) || 0,
    };
    if (editing) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  }

  return (
    <div className="space-y-4" data-testid="cbc-activities-manager">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">{aT.filterByScope || "Type"}</Label>
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="h-9 w-44 text-sm" data-testid="select-cbc-scope-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{aT.allScopes || "All"}</SelectItem>
              {CBC_SCOPE_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{scopeLabels[s.value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {items.length === 0 && (
            <Button type="button" size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-cbc-seed">
              {aT.loadDefaults || "Load defaults"}
            </Button>
          )}
          <Button type="button" size="sm" onClick={openAdd} data-testid="button-cbc-add">
            <Plus className="h-3.5 w-3.5 mr-1" /> {aT.addActivity || "Add activity"}
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground py-6 text-center">…</div>}

      {!isLoading && filteredItems.length === 0 && (
        <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-muted-foreground/30 rounded">
          {aT.empty || "No activities yet."}
        </div>
      )}

      <div className="grid gap-2">
        {filteredItems.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-md border border-border bg-card hover-elevate" data-testid={`row-cbc-${item.id}`}>
            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-md border ${CBC_COLOR_TILE_CLASS[item.color] || CBC_COLOR_TILE_CLASS.slate}`}>
              <CbcActivityIcon name={item.icon} className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm font-medium text-foreground" data-testid={`text-cbc-name-${item.id}`}>{item.name}</div>
                <Badge variant="outline" className="text-[10px]">{scopeLabels[item.entityScope] || item.entityScope}</Badge>
                {item.shortcut && <Badge variant="secondary" className="text-[10px] font-mono">{item.shortcut}</Badge>}
                {!item.isActive && <Badge variant="outline" className="text-[10px] text-muted-foreground">{aT.inactive || "Inactive"}</Badge>}
              </div>
              {item.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</div>}
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.code}</div>
            </div>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(item)} data-testid={`button-cbc-edit-${item.id}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(item.id)} data-testid={`button-cbc-delete-${item.id}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? (aT.editActivity || "Edit activity") : (aT.addActivity || "Add activity")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{aT.nameLabel || "Name"} *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-cbc-name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{aT.codeLabel || "Code"} *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="sampling_kits" className="font-mono text-sm" data-testid="input-cbc-code" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{aT.descriptionLabel || "Long description"}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={runAiSample}
                  disabled={aiSampleMutation.isPending}
                  data-testid="button-cbc-ai-sample"
                  title={aT.aiGenerate || "Generate sample with AI"}
                >
                  {aiSampleMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>{aT.aiGenerate || "Generate with AI"}</span>
                </Button>
              </div>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="textarea-cbc-description"
              />
            </div>

            <details className="rounded-md border border-border p-3 space-y-2">
              <summary className="cursor-pointer text-xs font-medium text-foreground">{aT.translations || "Translations"}</summary>
              <div className="flex items-center justify-end mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={runAiTranslate}
                  disabled={aiTranslateMutation.isPending}
                  data-testid="button-cbc-ai-translate"
                  title={aT.aiTranslate || "Translate with AI"}
                >
                  {aiTranslateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  <span>{aT.aiTranslate || "Translate with AI"}</span>
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                {[
                  { key: "nameSk", label: "SK" }, { key: "nameCs", label: "CS" }, { key: "nameEn", label: "EN" },
                  { key: "nameHu", label: "HU" }, { key: "nameRo", label: "RO" }, { key: "nameIt", label: "IT" }, { key: "nameDe", label: "DE" },
                ].map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                    <Input
                      value={(form as any)[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="h-8 text-xs"
                      data-testid={`input-cbc-${f.key}`}
                    />
                  </div>
                ))}
              </div>
            </details>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{aT.scopeLabel || "Type by institution"}</Label>
                <Select value={form.entityScope} onValueChange={(v) => setForm({ ...form, entityScope: v })}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-cbc-scope"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CBC_SCOPE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{scopeLabels[s.value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{aT.shortcutLabel || "Shortcut"}</Label>
                <Input value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} placeholder="SK" className="h-9 text-sm" data-testid="input-cbc-shortcut" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{aT.sortOrderLabel || "Sort order"}</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="h-9 text-sm" data-testid="input-cbc-sort" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{aT.iconLabel || "Icon"}</Label>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto border border-border rounded p-2" data-testid="picker-cbc-icon">
                {CBC_ICON_OPTIONS.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setForm({ ...form, icon: iconName })}
                    title={iconName}
                    className={`inline-flex items-center justify-center w-9 h-9 rounded border transition-colors ${form.icon === iconName ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
                    data-testid={`icon-option-${iconName}`}
                  >
                    <CbcActivityIcon name={iconName} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{aT.colorLabel || "Color"}</Label>
              <div className="flex flex-wrap gap-1.5" data-testid="picker-cbc-color">
                {CBC_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    title={color}
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all ${form.color === color ? "border-foreground scale-110" : "border-transparent"}`}
                    data-testid={`color-option-${color}`}
                  >
                    <span className={`w-5 h-5 rounded-full ${CBC_COLOR_DOT_CLASS[color]}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border p-3 bg-muted/30">
              <Label className="text-xs text-muted-foreground">{aT.preview || "Preview"}</Label>
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${CBC_COLOR_TILE_CLASS[form.color] || CBC_COLOR_TILE_CLASS.slate}`}>
                  <CbcActivityIcon name={form.icon} className="h-3.5 w-3.5" />
                  <span>{form.name || aT.nameLabel || "Name"}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} data-testid="switch-cbc-active" />
              <Label className="text-xs cursor-pointer">{aT.activeLabel || "Active"}</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={resetForm} data-testid="button-cbc-cancel">{t.common.cancel}</Button>
              <Button type="button" onClick={submit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-cbc-save">{t.common.save}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{aT.confirmDeleteTitle || "Delete activity?"}</AlertDialogTitle>
            <AlertDialogDescription>{aT.confirmDeleteMessage || "This activity will be removed from all positions that use it."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} data-testid="button-cbc-confirm-delete">{t.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("config");

  // Filter countries based on user's assigned countries
  const userCountries = useMemo(() => {
    if (!user?.assignedCountries || user.assignedCountries.length === 0) {
      return COUNTRIES; // Admins with no specific countries see all
    }
    return COUNTRIES.filter(c => user.assignedCountries.includes(c.code));
  }, [user?.assignedCountries]);

  // Get default country code for tabs
  const defaultCountryCode = userCountries[0]?.code || COUNTRIES[0].code;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.settings.title}
        description={t.settings.description}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings2 className="h-4 w-4 mr-2" />
            {t.settings.tabs.config}
          </TabsTrigger>
          <TabsTrigger value="insurance" data-testid="tab-insurance">
            <Heart className="h-4 w-4 mr-2" />
            {t.settings.tabs.insurance}
          </TabsTrigger>
          <TabsTrigger value="laboratories" data-testid="tab-laboratories">
            <FlaskConical className="h-4 w-4 mr-2" />
            {t.settings.tabs.laboratories}
          </TabsTrigger>
          <TabsTrigger value="leadscoring" data-testid="tab-leadscoring">
            <Target className="h-4 w-4 mr-2" />
            {t.leadScoring.criteria}
          </TabsTrigger>
          <TabsTrigger value="cbc-activities" data-testid="tab-cbc-activities">
            <Activity className="h-4 w-4 mr-2" />
            {(t.settings as any).cbcActivities?.tabTitle || "CBC Activities"}
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Shield className="h-4 w-4 mr-2" />
            {t.settings.tabs.system}
          </TabsTrigger>
          <TabsTrigger value="sip" data-testid="tab-sip">
            <Phone className="h-4 w-4 mr-2" />
            {t.settings.sipServer.sipTelephony}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.complaintTypes}</CardTitle>
              <CardDescription>
                {t.settings.complaintTypesDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title={t.settings.complaintTypes}
                description={t.settings.complaintTypesDesc}
                apiPath="/api/config/complaint-types"
                queryKey="/api/config/complaint-types"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.settings.cooperationTypes}</CardTitle>
              <CardDescription>
                {t.settings.cooperationTypesDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title={t.settings.cooperationTypes}
                description={t.settings.cooperationTypesDesc}
                apiPath="/api/config/cooperation-types"
                queryKey="/api/config/cooperation-types"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.settings.vipStatuses}</CardTitle>
              <CardDescription>
                {t.settings.cooperationTypesDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title={t.settings.vipStatuses}
                description={t.settings.vipStatuses}
                apiPath="/api/config/vip-statuses"
                queryKey="/api/config/vip-statuses"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.healthInsurance}</CardTitle>
              <CardDescription>
                {t.settings.insuranceDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigListManager
                title={t.settings.healthInsurance}
                description={t.settings.insuranceDesc}
                apiPath="/api/config/health-insurance"
                queryKey="/api/config/health-insurance"
                showCode={true}
                requireCountry={true}
                countries={userCountries}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="laboratories" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.laboratories}</CardTitle>
              <CardDescription>
                {t.settings.laboratoriesDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LaboratoryConfigManager countries={userCountries} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leadscoring" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.leadScoring.criteria}</CardTitle>
              <CardDescription>
                {t.leadScoring.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadScoringCriteriaManager countries={userCountries} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cbc-activities" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{(t.settings as any).cbcActivities?.title || "CBC Activities"}</CardTitle>
              <CardDescription>
                {(t.settings as any).cbcActivities?.description || "Manage activities that can be assigned per position. Each activity is scoped to an institution type and shown as an icon tile."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CbcActivitiesManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Droplets className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{t.settings.aboutNexus}</CardTitle>
                  <CardDescription>{t.settings.crmDescription}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t.settings.version}</span>
                  <Badge variant="secondary">v1.0.0</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t.settings.environment}</span>
                  <Badge>{t.settings.production}</Badge>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  {t.settings.nexusDescription}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{t.settings.supportedCountries}</CardTitle>
                  <CardDescription>{t.settings.regionsAvailable}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {userCountries.map((country) => (
                    <div
                      key={country.code}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm">{country.name}</p>
                        <p className="text-xs text-muted-foreground">{country.code}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{t.settings.userRoles}</CardTitle>
                  <CardDescription>{t.settings.accessLevels}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge>{t.users.roles.admin}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {t.settings.adminDescription}
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge variant="secondary">{t.users.roles.manager}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {t.settings.managerDescription}
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge variant="outline">{t.users.roles.user}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {t.settings.userDescription}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sip" className="mt-6">
          <SipPhoneSection />
        </TabsContent>

      </Tabs>
    </div>
  );
}

interface LabItem {
  id: string;
  name: string;
  countryCode: string;
  isActive: boolean;
  apiUrl?: string | null;
  apiKey?: string | null;
  linkedApiKeyId?: string | null;
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
}

function LaboratoryConfigManager({ countries }: { countries: readonly { code: string; name: string; flag?: string }[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newCountryCode, setNewCountryCode] = useState<string>("");
  const [editingLab, setEditingLab] = useState<LabItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCountryCode, setEditCountryCode] = useState("");
  const [editApiUrl, setEditApiUrl] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editLinkedApiKeyId, setEditLinkedApiKeyId] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: labs = [], isLoading } = useQuery<LabItem[]>({
    queryKey: ["/api/config/laboratories"],
  });

  const { data: availableApiKeys = [] } = useQuery<ApiKeyItem[]>({
    queryKey: ["/api/api-keys"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; countryCode: string }) =>
      apiRequest("POST", "/api/config/laboratories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/laboratories"] });
      setNewName("");
      setNewCountryCode("");
      toast({ title: t.settings.itemAdded });
    },
    onError: () => {
      toast({ title: t.settings.addFailed, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; countryCode: string; apiUrl: string | null; apiKey: string | null; linkedApiKeyId: string | null }) =>
      apiRequest("PATCH", `/api/config/laboratories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/laboratories"] });
      setEditingLab(null);
      toast({ title: t.settings.itemUpdated });
    },
    onError: () => {
      toast({ title: t.settings.updateFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/config/laboratories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/laboratories"] });
      setDeleteId(null);
      toast({ title: t.settings.itemDeleted });
    },
    onError: () => {
      toast({ title: t.settings.deleteFailed, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!newName.trim()) {
      toast({ title: t.settings.nameRequired, variant: "destructive" });
      return;
    }
    if (!newCountryCode) {
      toast({ title: t.settings.countryRequired || "Country is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({ name: newName.trim(), countryCode: newCountryCode });
  };

  const handleStartEdit = (lab: LabItem) => {
    setEditingLab(lab);
    setEditName(lab.name);
    setEditCountryCode(lab.countryCode);
    setEditApiUrl(lab.apiUrl || "");
    setEditApiKey(lab.apiKey || "");
    setEditLinkedApiKeyId(lab.linkedApiKeyId || "");
    setShowApiKey(false);
  };

  const handleSaveEdit = () => {
    if (!editingLab || !editName.trim()) return;
    updateMutation.mutate({
      id: editingLab.id,
      name: editName.trim(),
      countryCode: editCountryCode,
      apiUrl: editApiUrl.trim() || null,
      apiKey: editApiKey.trim() || null,
      linkedApiKeyId: (editLinkedApiKeyId && editLinkedApiKeyId !== "none") ? editLinkedApiKeyId : null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={t.settings.addNewItem || "Name"}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1"
          data-testid="input-new-lab-name"
        />
        <Select value={newCountryCode} onValueChange={setNewCountryCode}>
          <SelectTrigger className="w-[140px]" data-testid="select-new-lab-country">
            <SelectValue placeholder={t.settings.country || "Country"} />
          </SelectTrigger>
          <SelectContent>
            {countries.map(c => (
              <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} disabled={createMutation.isPending} data-testid="button-add-lab">
          <Plus className="h-4 w-4 mr-1" />
          {t.common.add || "Add"}
        </Button>
      </div>

      <div className="space-y-2">
        {labs.map((lab) => (
          <div key={lab.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{lab.name}</span>
                <Badge variant="outline">{countries.find(c => c.code === lab.countryCode)?.flag} {lab.countryCode}</Badge>
                {lab.apiUrl && <Badge variant="secondary" className="text-xs"><Link2 className="h-3 w-3 mr-1" />API</Badge>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => handleStartEdit(lab)} data-testid={`button-edit-lab-${lab.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteId(lab.id)} data-testid={`button-delete-lab-${lab.id}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {labs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {t.settings.noItems || "No items"}
          </div>
        )}
      </div>

      <Dialog open={!!editingLab} onOpenChange={(open) => { if (!open) setEditingLab(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.common.edit} - {editingLab?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.settings.name || "Name"}</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} data-testid="input-edit-lab-name" />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.country || "Country"}</Label>
              <Select value={editCountryCode} onValueChange={setEditCountryCode}>
                <SelectTrigger data-testid="select-edit-lab-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                API URL
              </Label>
              <Input
                value={editApiUrl}
                onChange={(e) => setEditApiUrl(e.target.value)}
                placeholder="https://lab.example.com"
                data-testid="input-edit-lab-api-url"
              />
              <p className="text-xs text-muted-foreground">
                {t.settings.labApiUrlHint || "Base URL of the laboratory API for CBU report downloads"}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                API Key (Configurator)
              </Label>
              <Select value={editLinkedApiKeyId} onValueChange={setEditLinkedApiKeyId}>
                <SelectTrigger data-testid="select-edit-lab-api-key">
                  <SelectValue placeholder="Select API Key from Configurator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- None --</SelectItem>
                  {availableApiKeys.filter((k: ApiKeyItem) => k.isActive).map((k: ApiKeyItem) => (
                    <SelectItem key={k.id} value={k.id}>{k.name} ({k.keyPrefix}...)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t.settings.labApiKeyHint || "Select the API key from Configurator → API Keys that is used for LAB communication"}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingLab(null)}>{t.common.cancel}</Button>
              <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid="button-save-lab-edit">
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t.common.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.confirmDeleteTitle || "Delete?"}</AlertDialogTitle>
            <AlertDialogDescription>{t.settings.confirmDeleteDescription || "This action cannot be undone."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
