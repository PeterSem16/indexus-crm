import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { CHART_PALETTE } from "@/lib/chart-colors";
import { 
  ArrowLeft, Users, Settings, BarChart3, FileText, 
  Play, Pause, CheckCircle, Clock, Phone, User, Calendar,
  RefreshCw, Download, Filter, MoreHorizontal, Trash2, CheckCheck,
  Copy, Save, ScrollText, History, ArrowRight, Mail, MessageSquare, FileEdit, Package, Shield,
  Plus, ChevronDown, ChevronRight, ListChecks,
  ThumbsUp, ThumbsDown, CalendarPlus, PhoneOff, AlertCircle, XCircle, Zap, Star,
  CircleDot, Info, Heart, Ban, Bell, Send, Target, Flag, Eye, EyeOff,
  Volume2, VolumeX, UserCheck, UserX, Briefcase, Gift, Home, MapPin, Globe,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataTable, type SortConfig } from "@/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Campaign, type CampaignContact, type Customer, COUNTRIES, type OperatorScript, operatorScriptSchema, type CampaignDisposition, DISPOSITION_ACTION_TYPES } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScriptBuilder } from "@/components/script-builder";
import { ScriptRunner } from "@/components/script-runner";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { CriteriaBuilder, type CriteriaGroup, criteriaToDescription } from "@/components/criteria-builder";
import { ScheduleEditor, type ScheduleConfig, getDefaultScheduleConfig } from "@/components/schedule-editor";
import { CampaignContactsFilter, type CampaignContactFilters, applyContactFilters } from "@/components/campaign-contacts-filter";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ICON_PICKER_SET: { name: string; icon: LucideIcon }[] = [
  { name: "Phone", icon: Phone },
  { name: "PhoneOff", icon: PhoneOff },
  { name: "Mail", icon: Mail },
  { name: "MessageSquare", icon: MessageSquare },
  { name: "Send", icon: Send },
  { name: "ThumbsUp", icon: ThumbsUp },
  { name: "ThumbsDown", icon: ThumbsDown },
  { name: "CheckCircle", icon: CheckCircle },
  { name: "XCircle", icon: XCircle },
  { name: "AlertCircle", icon: AlertCircle },
  { name: "Ban", icon: Ban },
  { name: "Clock", icon: Clock },
  { name: "Calendar", icon: Calendar },
  { name: "CalendarPlus", icon: CalendarPlus },
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Zap", icon: Zap },
  { name: "Bell", icon: Bell },
  { name: "Info", icon: Info },
  { name: "Flag", icon: Flag },
  { name: "Target", icon: Target },
  { name: "Eye", icon: Eye },
  { name: "EyeOff", icon: EyeOff },
  { name: "User", icon: User },
  { name: "UserCheck", icon: UserCheck },
  { name: "UserX", icon: UserX },
  { name: "Users", icon: Users },
  { name: "Home", icon: Home },
  { name: "MapPin", icon: MapPin },
  { name: "Globe", icon: Globe },
  { name: "Briefcase", icon: Briefcase },
  { name: "Gift", icon: Gift },
  { name: "FileText", icon: FileText },
  { name: "Volume2", icon: Volume2 },
  { name: "VolumeX", icon: VolumeX },
  { name: "CircleDot", icon: CircleDot },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_PICKER_SET.map(i => [i.name, i.icon])
);

type EnrichedContact = CampaignContact & { customer?: Customer };

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const CONTACT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  no_answer: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  callback_scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  not_interested: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon 
}: { 
  title: string; 
  value: string | number; 
  description?: string;
  icon: any;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function CriteriaCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<CriteriaGroup[]>(() => {
    try {
      return campaign.criteria ? JSON.parse(campaign.criteria) : [];
    } catch {
      return [];
    }
  });
  const [hasChanges, setHasChanges] = useState(false);

  const saveCriteriaMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        criteria: JSON.stringify(criteria),
      });
    },
    onSuccess: () => {
      toast({ title: t.common?.saved || "Criteria saved successfully" });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní kritérií", variant: "destructive" });
    },
  });

  const handleCriteriaChange = (newCriteria: CriteriaGroup[]) => {
    setCriteria(newCriteria);
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>{t.campaigns?.detail?.targetCriteria || "Target Criteria"}</CardTitle>
            <CardDescription>
              {t.campaigns?.detail?.targetCriteriaDesc || "Define which customers should be included in this campaign"}
            </CardDescription>
          </div>
          {hasChanges && (
            <Button
              onClick={() => saveCriteriaMutation.mutate()}
              disabled={saveCriteriaMutation.isPending}
              data-testid="button-save-criteria"
            >
              {saveCriteriaMutation.isPending ? (t.common?.saving || "Saving...") : (t.common?.save || "Save")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CriteriaBuilder
          criteria={criteria}
          onChange={handleCriteriaChange}
          readonly={campaign.status !== "draft"}
        />
      </CardContent>
    </Card>
  );
}

function SchedulingCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleConfig>(() => {
    try {
      return campaign.settings ? JSON.parse(campaign.settings) : getDefaultScheduleConfig();
    } catch {
      return getDefaultScheduleConfig();
    }
  });
  const [hasChanges, setHasChanges] = useState(false);

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        settings: JSON.stringify(schedule),
      });
    },
    onSuccess: () => {
      toast({ title: t.common?.saved || "Schedule saved successfully" });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní rozvrhu", variant: "destructive" });
    },
  });

  const handleScheduleChange = (newSchedule: ScheduleConfig) => {
    setSchedule(newSchedule);
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>{t.campaigns?.detail?.scheduling || "Scheduling"}</CardTitle>
            <CardDescription>
              {t.campaigns?.detail?.schedulingDesc || "Configure working hours and contact frequency limits"}
            </CardDescription>
          </div>
          {hasChanges && (
            <Button
              onClick={() => saveScheduleMutation.mutate()}
              disabled={saveScheduleMutation.isPending}
              data-testid="button-save-schedule"
            >
              {saveScheduleMutation.isPending ? (t.common?.saving || "Saving...") : (t.common?.save || "Save")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScheduleEditor
          schedule={schedule}
          onChange={handleScheduleChange}
          readonly={false}
        />
      </CardContent>
    </Card>
  );
}

const ACTION_TYPE_COLORS: Record<string, string> = {
  callback: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  dnd: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  complete: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  convert: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  none: "bg-muted text-muted-foreground",
};

function DispositionsTab({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [newDisp, setNewDisp] = useState({ name: "", code: "", icon: "", color: "#6b7280", actionType: "none" });

  const { data: dispositions = [], isLoading } = useQuery<CampaignDisposition[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    enabled: !!campaignId,
  });

  const parents = dispositions.filter(d => !d.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenMap = dispositions.reduce((acc, d) => {
    if (d.parentId) {
      if (!acc[d.parentId]) acc[d.parentId] = [];
      acc[d.parentId].push(d);
    }
    return acc;
  }, {} as Record<string, CampaignDisposition[]>);

  const toggleExpand = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${campaignId}/dispositions/seed`),
    onSuccess: () => {
      toast({ title: "Predvolené výsledky boli vytvorené" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
    },
    onError: () => toast({ title: "Chyba", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/campaigns/${campaignId}/dispositions`, data),
    onSuccess: () => {
      toast({ title: "Výsledok pridaný" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
      setShowAddForm(false);
      setAddingSubFor(null);
      setNewDisp({ name: "", code: "", icon: "", color: "#6b7280", actionType: "none" });
    },
    onError: () => toast({ title: "Chyba pri vytváraní", variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/campaigns/${campaignId}/dispositions/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
    },
    onError: () => toast({ title: "Chyba", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/campaigns/${campaignId}/dispositions/${id}`),
    onSuccess: () => {
      toast({ title: "Výsledok zmazaný" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
    },
    onError: () => toast({ title: "Chyba pri mazaní", variant: "destructive" }),
  });

  const handleCreate = (parentId?: string) => {
    if (!newDisp.name || !newDisp.code) return;
    createMutation.mutate({
      campaignId,
      parentId: parentId || null,
      name: newDisp.name,
      code: newDisp.code,
      icon: newDisp.icon || null,
      color: newDisp.color || null,
      actionType: newDisp.actionType,
    });
  };

  const renderAddForm = (parentId?: string) => (
    <div className="flex flex-wrap items-end gap-2 p-3 rounded-md border bg-muted/30" data-testid="disposition-add-form">
      <div className="space-y-1">
        <Label className="text-xs">Názov</Label>
        <Input
          value={newDisp.name}
          onChange={e => setNewDisp(p => ({ ...p, name: e.target.value }))}
          placeholder="Názov"
          className="w-40"
          data-testid="input-disposition-name"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Kód</Label>
        <Input
          value={newDisp.code}
          onChange={e => setNewDisp(p => ({ ...p, code: e.target.value }))}
          placeholder="kod"
          className="w-32"
          data-testid="input-disposition-code"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Ikona</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-28 gap-2 justify-start" data-testid="input-disposition-icon">
              {newDisp.icon && ICON_MAP[newDisp.icon] ? (() => {
                const Ic = ICON_MAP[newDisp.icon];
                return <Ic className="h-4 w-4 shrink-0" />;
              })() : <CircleDot className="h-4 w-4 shrink-0 opacity-40" />}
              <span className="text-xs truncate">{newDisp.icon || "Vybrať"}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="grid grid-cols-6 gap-1" data-testid="icon-picker-grid">
              {ICON_PICKER_SET.map(({ name, icon: Ic }) => (
                <Button
                  key={name}
                  size="icon"
                  variant={newDisp.icon === name ? "default" : "ghost"}
                  onClick={() => setNewDisp(p => ({ ...p, icon: name }))}
                  title={name}
                  data-testid={`icon-pick-${name}`}
                >
                  <Ic className="h-4 w-4" />
                </Button>
              ))}
            </div>
            {newDisp.icon && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-1"
                onClick={() => setNewDisp(p => ({ ...p, icon: "" }))}
                data-testid="button-clear-icon"
              >
                Odstrániť ikonu
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Farba</Label>
        <Input
          type="color"
          value={newDisp.color}
          onChange={e => setNewDisp(p => ({ ...p, color: e.target.value }))}
          className="w-14"
          data-testid="input-disposition-color"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Akcia</Label>
        <Select value={newDisp.actionType} onValueChange={v => setNewDisp(p => ({ ...p, actionType: v }))}>
          <SelectTrigger className="w-32" data-testid="select-disposition-action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISPOSITION_ACTION_TYPES.map(at => (
              <SelectItem key={at} value={at}>{at}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        onClick={() => handleCreate(parentId)}
        disabled={createMutation.isPending || !newDisp.name || !newDisp.code}
        data-testid="button-save-disposition"
      >
        {createMutation.isPending ? "..." : "Uložiť"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => { setShowAddForm(false); setAddingSubFor(null); }}
        data-testid="button-cancel-disposition"
      >
        Zrušiť
      </Button>
    </div>
  );

  return (
    <TabsContent value="dispositions" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-dispositions-title">Výsledky kontaktu</h3>
          <p className="text-sm text-muted-foreground">Definujte možné výsledky kontaktovania pre túto kampaň</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dispositions.length === 0 && (
            <Button
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              data-testid="button-seed-dispositions"
            >
              <ListChecks className="w-4 h-4 mr-2" />
              {seedMutation.isPending ? "Vytváranie..." : "Načítať predvolené"}
            </Button>
          )}
          <Button
            onClick={() => { setShowAddForm(true); setAddingSubFor(null); setNewDisp({ name: "", code: "", icon: "", color: "#6b7280", actionType: "none" }); }}
            data-testid="button-add-disposition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Pridať výsledok
          </Button>
        </div>
      </div>

      {showAddForm && !addingSubFor && renderAddForm()}

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 animate-spin" />
        </div>
      ) : parents.length === 0 && !showAddForm ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-no-dispositions">
          Žiadne výsledky kontaktu. Kliknite na "Načítať predvolené" alebo pridajte vlastné.
        </div>
      ) : (
        <div className="space-y-3">
          {parents.map(parent => {
            const children = (childrenMap[parent.id] || []).sort((a, b) => a.sortOrder - b.sortOrder);
            const isExpanded = expandedParents.has(parent.id);
            return (
              <Card key={parent.id} data-testid={`card-disposition-${parent.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {children.length > 0 && (
                      <Button size="icon" variant="ghost" onClick={() => toggleExpand(parent.id)} data-testid={`button-expand-${parent.id}`}>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                    )}
                    {(() => {
                      const ParentIcon = ICON_MAP[parent.icon || ""] || CircleDot;
                      return <ParentIcon className="w-4 h-4 shrink-0" style={parent.color ? { color: parent.color } : undefined} />;
                    })()}
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${!parent.isActive ? "line-through text-muted-foreground" : ""}`} data-testid={`text-disposition-name-${parent.id}`}>
                        {parent.name}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">{parent.code}</span>
                    </div>
                    <Badge className={ACTION_TYPE_COLORS[parent.actionType] || ACTION_TYPE_COLORS.none} data-testid={`badge-action-${parent.id}`}>
                      {parent.actionType}
                    </Badge>
                    <Switch
                      checked={parent.isActive}
                      onCheckedChange={checked => toggleActiveMutation.mutate({ id: parent.id, isActive: checked })}
                      data-testid={`switch-active-${parent.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setAddingSubFor(parent.id); setShowAddForm(false); setNewDisp({ name: "", code: "", icon: "", color: parent.color || "#6b7280", actionType: "none" }); }}
                      data-testid={`button-add-sub-${parent.id}`}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(parent.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-disposition-${parent.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {addingSubFor === parent.id && (
                    <div className="mt-3">
                      {renderAddForm(parent.id)}
                    </div>
                  )}

                  {isExpanded && children.length > 0 && (
                    <div className="mt-3 ml-8 space-y-2">
                      {children.map(child => (
                        <div key={child.id} className="flex flex-wrap items-center gap-3 p-2 rounded-md border" data-testid={`row-disposition-${child.id}`}>
                          {(() => {
                            const ChildIcon = ICON_MAP[child.icon || ""] || CircleDot;
                            return <ChildIcon className="w-3.5 h-3.5 shrink-0" style={child.color ? { color: child.color } : undefined} />;
                          })()}
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${!child.isActive ? "line-through text-muted-foreground" : ""}`} data-testid={`text-disposition-name-${child.id}`}>
                              {child.name}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">{child.code}</span>
                          </div>
                          {child.actionType !== "none" && (
                            <Badge className={ACTION_TYPE_COLORS[child.actionType] || ACTION_TYPE_COLORS.none}>
                              {child.actionType}
                            </Badge>
                          )}
                          <Switch
                            checked={child.isActive}
                            onCheckedChange={checked => toggleActiveMutation.mutate({ id: child.id, isActive: checked })}
                            data-testid={`switch-active-${child.id}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(child.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-disposition-${child.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </TabsContent>
  );
}

export default function CampaignDetailPage() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id || "";
  const { t } = useI18n();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [contactFilters, setContactFilters] = useState<CampaignContactFilters>({});
  const [selectedContact, setSelectedContact] = useState<EnrichedContact | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [scriptContent, setScriptContent] = useState<string>("");
  const [scriptModified, setScriptModified] = useState(false);
  const [structuredScript, setStructuredScript] = useState<OperatorScript | null>(null);
  const [scriptMode, setScriptMode] = useState<"builder" | "preview" | "legacy">("builder");
  const [structuredScriptModified, setStructuredScriptModified] = useState(false);

  const { data: campaign, isLoading: loadingCampaign } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: contacts = [], isLoading: loadingContacts } = useQuery<EnrichedContact[]>({
    queryKey: ["/api/campaigns", campaignId, "contacts"],
    enabled: !!campaignId,
  });

  const { data: stats } = useQuery<{
    totalContacts: number;
    pendingContacts: number;
    contactedContacts: number;
    completedContacts: number;
    failedContacts: number;
    noAnswerContacts: number;
    callbackContacts: number;
    notInterestedContacts: number;
  }>({
    queryKey: ["/api/campaigns", campaignId, "stats"],
    enabled: !!campaignId,
  });

  const selectedCustomerId = selectedContact?.customerId;
  
  const { data: contactActivityLogs = [] } = useQuery<Array<{
    id: string;
    action: string;
    entityName: string | null;
    details: any;
    createdAt: string;
  }>>({
    queryKey: ["/api/customers", selectedCustomerId, "activity-logs"],
    enabled: !!selectedCustomerId,
  });

  const { data: pipelineStages = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/pipeline-stages"],
  });

  const { data: campaignAgents = [] } = useQuery<Array<{ id: string; userId: string; campaignId: string }>>({
    queryKey: ["/api/campaigns", campaignId, "agents"],
    enabled: !!campaignId,
  });

  const { data: allUsers = [] } = useQuery<Array<{ id: string; fullName: string; role: string; roleId: string | null }>>({
    queryKey: ["/api/users"],
  });

  const { data: roles = [] } = useQuery<Array<{ id: string; name: string; legacyRole: string | null }>>({
    queryKey: ["/api/roles"],
  });

  const callCenterRoleId = roles.find(r => r.name === "Call Center")?.id;
  const callCenterUsers = allUsers.filter(u => u.role === "admin" || (callCenterRoleId && u.roleId === callCenterRoleId));
  const assignedAgentIds = campaignAgents.map(a => a.userId);

  const getStageName = (stageId: string) => {
    const stage = pipelineStages.find(s => s.id === stageId);
    return stage?.name || stageId;
  };

  const generateContactsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/generate-contacts`);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Contacts generated",
        description: `${data.count} contacts were generated for this campaign.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate contacts.",
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: string; data: any }) => {
      return apiRequest("PATCH", `/api/campaigns/${campaignId}/contacts/${contactId}`, data);
    },
    onSuccess: () => {
      toast({ title: "Contact updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      setSelectedContact(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
    },
  });

  const updateAgentsMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/agents`, { userIds });
    },
    onSuccess: () => {
      toast({ title: "Operátori boli aktualizovaní" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "agents"] });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa aktualizovať operátorov.", variant: "destructive" });
    },
  });

  const updateCampaignStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return apiRequest("PATCH", `/api/campaigns/${campaignId}`, { status: newStatus });
    },
    onSuccess: () => {
      toast({ title: "Campaign status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update campaign status.", variant: "destructive" });
    },
  });

  const cloneCampaignMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/clone`, {});
    },
    onSuccess: (newCampaign: any) => {
      toast({ title: "Kampaň naklonovaná" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      window.location.href = `/campaigns/${newCampaign.id}`;
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa naklonovať kampaň.", variant: "destructive" });
    },
  });

  const saveAsTemplateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/save-as-template`, {});
    },
    onSuccess: () => {
      toast({ title: "Šablóna uložená" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-templates"] });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa uložiť šablónu.", variant: "destructive" });
    },
  });

  const bulkUpdateContactsMutation = useMutation({
    mutationFn: async ({ contactIds, data }: { contactIds: string[]; data: any }) => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/contacts/bulk-update`, { contactIds, ...data });
    },
    onSuccess: (data: any) => {
      toast({ title: "Kontakty aktualizované", description: `${data.count || selectedContacts.size} kontaktov bolo aktualizovaných.` });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      setSelectedContacts(new Set());
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa aktualizovať kontakty.", variant: "destructive" });
    },
  });

  const saveScriptMutation = useMutation({
    mutationFn: async (script: string) => {
      return apiRequest("PATCH", `/api/campaigns/${campaignId}`, { script });
    },
    onSuccess: () => {
      toast({ title: "Skript uložený" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      setScriptModified(false);
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa uložiť skript.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (campaign?.script !== undefined) {
      const scriptValue = campaign.script || "";
      setScriptContent(scriptValue);
      setScriptModified(false);
      
      // Try to parse as structured script
      try {
        if (scriptValue.startsWith("{")) {
          const parsed = JSON.parse(scriptValue);
          const validated = operatorScriptSchema.safeParse(parsed);
          if (validated.success) {
            setStructuredScript(validated.data);
            setScriptMode("builder");
          } else {
            // Invalid JSON structure, keep as legacy but init empty structured
            setStructuredScript({ version: 1, steps: [] });
            setScriptMode("legacy");
          }
        } else if (scriptValue.trim()) {
          // Plain text script - keep in legacy mode
          setStructuredScript({ version: 1, steps: [] });
          setScriptMode("legacy");
        } else {
          // Empty script - start fresh in builder mode
          setStructuredScript({ version: 1, steps: [] });
          setScriptMode("builder");
        }
      } catch {
        // JSON parse error, keep as legacy
        setStructuredScript({ version: 1, steps: [] });
        setScriptMode("legacy");
      }
      setStructuredScriptModified(false);
    }
  }, [campaign?.script]);

  const handleBulkStatusUpdate = (newStatus: string) => {
    if (selectedContacts.size === 0) return;
    bulkUpdateContactsMutation.mutate({ 
      contactIds: Array.from(selectedContacts), 
      data: { status: newStatus } 
    });
  };

  const handleExportContacts = () => {
    const dataToExport = selectedContacts.size > 0
      ? filteredContacts.filter((c: any) => selectedContacts.has(c.id))
      : filteredContacts;
    
    const headers = ["Meno", "Priezvisko", "Email", "Telefón", "Status", "Pokusy", "Posledný pokus", "Krajina"];
    const rows = dataToExport.map((c: any) => [
      c.customer?.firstName || "",
      c.customer?.lastName || "",
      c.customer?.email || "",
      c.customer?.phone || "",
      c.status,
      c.attemptCount || 0,
      c.lastAttemptAt ? format(new Date(c.lastAttemptAt), "yyyy-MM-dd HH:mm") : "",
      c.customer?.country || "",
    ]);
    
    const csvContent = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campaign-${campaign?.name || campaignId}-contacts.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export dokončený", description: `${dataToExport.length} kontaktov bolo exportovaných.` });
  };

  if (loadingCampaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <p>Campaign not found</p>
        <Link href="/campaigns">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaigns
          </Button>
        </Link>
      </div>
    );
  }

  const filteredContacts = applyContactFilters(contacts as any, contactFilters);

  const progressPercentage = stats 
    ? ((stats.completedContacts + stats.notInterestedContacts) / Math.max(stats.totalContacts, 1)) * 100
    : 0;

  const contactColumns = [
    {
      key: "customer",
      header: t.campaigns?.detail?.contacts || "Kontakt",
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.customer ? `${contact.customer.lastName} ${contact.customer.firstName}` : "",
      cell: (contact: EnrichedContact) => (
        <div>
          <div className="font-medium">
            {contact.customer ? `${contact.customer.firstName} ${contact.customer.lastName}` : "Neznámy"}
          </div>
          <div className="text-sm text-muted-foreground">
            {contact.customer?.phone || contact.customer?.email || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "country",
      header: "Krajina",
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.customer?.country || "",
      cell: (contact: EnrichedContact) => {
        const countryCode = contact.customer?.country;
        if (!countryCode) return <span>-</span>;
        const countryData = COUNTRIES[countryCode as keyof typeof COUNTRIES] as { name: string } | undefined;
        return <span>{countryData?.name || countryCode}</span>;
      },
    },
    {
      key: "status",
      header: t.campaigns?.status || "Status",
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.status,
      cell: (contact: EnrichedContact) => (
        <Badge className={CONTACT_STATUS_COLORS[contact.status] || ""}>
          {contact.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "attemptCount",
      header: "Pokusy",
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.attemptCount || 0,
      cell: (contact: EnrichedContact) => (
        <span>{contact.attemptCount || 0}</span>
      ),
    },
    {
      key: "lastAttemptAt",
      header: "Posledný pokus",
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.lastAttemptAt ? new Date(contact.lastAttemptAt) : null,
      cell: (contact: EnrichedContact) => (
        <span>
          {contact.lastAttemptAt ? format(new Date(contact.lastAttemptAt), "dd.MM.yyyy HH:mm") : "-"}
        </span>
      ),
    },
    {
      key: "priorityScore",
      header: "Priorita",
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.priorityScore || 0,
      cell: (contact: EnrichedContact) => {
        const score = contact.priorityScore || 50;
        const colors = score >= 75 
          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          : score >= 50 
          ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
        return (
          <Badge variant="outline" className={colors}>
            {score >= 75 ? "Vysoká" : score >= 50 ? "Stredná" : "Nízka"}
          </Badge>
        );
      },
    },
    {
      key: "assignedTo",
      header: "Operátor",
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.assignedTo || "",
      cell: (contact: EnrichedContact) => (
        <span>{contact.assignedTo || "-"}</span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon" data-testid="button-back-campaigns">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge className={STATUS_COLORS[campaign.status]}>
              {t.campaigns?.statuses?.[campaign.status as keyof typeof t.campaigns.statuses] || campaign.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {campaign.description || "Bez popisu"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.status === "draft" && (
            <Button 
              onClick={() => updateCampaignStatusMutation.mutate("active")}
              data-testid="button-activate-campaign"
            >
              <Play className="w-4 h-4 mr-2" />
              Aktivovať
            </Button>
          )}
          {campaign.status === "active" && (
            <Button 
              variant="outline"
              onClick={() => updateCampaignStatusMutation.mutate("paused")}
              data-testid="button-pause-campaign"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pozastaviť
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button 
              onClick={() => updateCampaignStatusMutation.mutate("active")}
              data-testid="button-resume-campaign"
            >
              <Play className="w-4 h-4 mr-2" />
              Obnoviť
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-campaign-more">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => cloneCampaignMutation.mutate()}
                disabled={cloneCampaignMutation.isPending}
                data-testid="button-clone-campaign"
              >
                <Copy className="w-4 h-4 mr-2" />
                Klonovať kampaň
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => saveAsTemplateMutation.mutate()}
                disabled={saveAsTemplateMutation.isPending}
                data-testid="button-save-as-template"
              >
                <Save className="w-4 h-4 mr-2" />
                Uložiť ako šablónu
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileText className="w-4 h-4 mr-2" />
            {t.campaigns?.detail?.overview || "Overview"}
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <Users className="w-4 h-4 mr-2" />
            {t.campaigns?.detail?.contacts || "Contacts"}
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-2" />
            {t.campaigns?.detail?.settings || "Settings"}
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-reporting">
            <BarChart3 className="w-4 h-4 mr-2" />
            {t.campaigns?.detail?.reporting || "Reporting"}
          </TabsTrigger>
          <TabsTrigger value="script" data-testid="tab-script">
            <ScrollText className="w-4 h-4 mr-2" />
            Skript pre operátorov
          </TabsTrigger>
          <TabsTrigger value="agents" data-testid="tab-agents">
            <Shield className="w-4 h-4 mr-2" />
            Operátori
          </TabsTrigger>
          <TabsTrigger value="dispositions" data-testid="tab-dispositions">
            <CheckCheck className="w-4 h-4 mr-2" />
            Výsledky kontaktu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title={t.campaigns?.detail?.totalContacts || "Total Contacts"}
              value={stats?.totalContacts || 0}
              icon={Users}
            />
            <StatsCard
              title={t.campaigns?.detail?.pendingContacts || "Pending"}
              value={stats?.pendingContacts || 0}
              description={`${((stats?.pendingContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              icon={Clock}
            />
            <StatsCard
              title={t.campaigns?.detail?.completedContacts || "Completed"}
              value={stats?.completedContacts || 0}
              description={`${((stats?.completedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              icon={CheckCircle}
            />
            <StatsCard
              title={t.campaigns?.detail?.callbackScheduled || "Callbacks"}
              value={stats?.callbackContacts || 0}
              icon={Phone}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t.campaigns?.detail?.progress || "Campaign Progress"}</CardTitle>
              <CardDescription>
                {stats?.completedContacts || 0} of {stats?.totalContacts || 0} contacts processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progressPercentage} className="h-3" />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="outline">{campaign.type}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Countries</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {campaign.countryCodes?.map(code => (
                      <Badge key={code} variant="secondary" className="text-xs">
                        {COUNTRIES.find(c => c.code === code)?.flag} {code}
                      </Badge>
                    ))}
                    {(!campaign.countryCodes || campaign.countryCodes.length === 0) && (
                      <span>All countries</span>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start Date</span>
                  <span>{campaign.startDate ? format(new Date(campaign.startDate), "PP") : "-"}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End Date</span>
                  <span>{campaign.endDate ? format(new Date(campaign.endDate), "PP") : "-"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    Completed
                  </span>
                  <span className="font-medium">{stats?.completedContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    Contacted
                  </span>
                  <span className="font-medium">{stats?.contactedContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    No Answer
                  </span>
                  <span className="font-medium">{stats?.noAnswerContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    Callback
                  </span>
                  <span className="font-medium">{stats?.callbackContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    Not Interested
                  </span>
                  <span className="font-medium">{stats?.notInterestedContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    Failed
                  </span>
                  <span className="font-medium">{stats?.failedContacts || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <CampaignContactsFilter
                filters={contactFilters}
                onFiltersChange={setContactFilters}
                onClear={() => setContactFilters({})}
                countryCodes={campaign.countryCodes || []}
              />
              {selectedContacts.size > 0 && (
                <div className="flex items-center gap-2 pl-2 border-l">
                  <span className="text-sm font-medium">
                    {selectedContacts.size} vybraných
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-bulk-actions">
                        <MoreHorizontal className="w-4 h-4 mr-2" />
                        Hromadné akcie
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate("completed")} data-testid="menu-bulk-completed">
                        <CheckCheck className="w-4 h-4 mr-2" />
                        Označiť ako dokončené
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate("not_interested")} data-testid="menu-bulk-not-interested">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Označiť ako nezaujíma
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate("pending")} data-testid="menu-bulk-pending">
                        <Clock className="w-4 h-4 mr-2" />
                        Resetovať na čakajúce
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelectedContacts(new Set())} data-testid="menu-clear-selection">
                        Zrušiť výber
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredContacts.length} / {contacts.length} kontaktov
              </span>
              <Button
                variant="outline"
                onClick={() => generateContactsMutation.mutate()}
                disabled={generateContactsMutation.isPending}
                data-testid="button-generate-contacts"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${generateContactsMutation.isPending ? "animate-spin" : ""}`} />
                Generovať
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportContacts}
                data-testid="button-export-contacts"
              >
                <Download className="w-4 h-4 mr-2" />
                {selectedContacts.size > 0 ? `Export (${selectedContacts.size})` : "Export"}
              </Button>
            </div>
          </div>

          {loadingContacts ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <DataTable
              columns={contactColumns}
              data={filteredContacts as EnrichedContact[]}
              getRowKey={(contact) => contact.id}
              onRowClick={(contact) => setSelectedContact(contact)}
              selectable
              selectedKeys={selectedContacts}
              onSelectionChange={setSelectedContacts}
              sortConfig={sortConfig}
              onSortChange={setSortConfig}
            />
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <SchedulingCard campaign={campaign} />

          <Card>
            <CardHeader>
              <CardTitle>{t.campaigns?.detail?.operatorAssignment || "Operator Assignment"}</CardTitle>
              <CardDescription>
                {t.campaigns?.detail?.operatorAssignmentDesc || "Manage operators assigned to this campaign"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Add and configure operators for this campaign. Set workload limits and language preferences.
              </p>
            </CardContent>
          </Card>

          <CriteriaCard campaign={campaign} />
        </TabsContent>

        <TabsContent value="reporting" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Miera kontaktovania"
              value={`${((stats?.contactedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              description="Kontaktovaní / Celkovo"
              icon={Phone}
            />
            <StatsCard
              title="Miera dokončenia"
              value={`${((stats?.completedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              description="Dokončení / Celkovo"
              icon={CheckCircle}
            />
            <StatsCard
              title="Konverzný pomer"
              value={`${(((stats?.completedContacts || 0) / Math.max((stats?.contactedContacts || 0) + (stats?.completedContacts || 0), 1)) * 100).toFixed(1)}%`}
              description="Dokončení / Kontaktovaní"
              icon={Users}
            />
            <StatsCard
              title="Priemer pokusov"
              value={contacts.length > 0 
                ? (contacts.reduce((sum, c) => sum + (c.attemptCount || 0), 0) / contacts.length).toFixed(1)
                : "0"
              }
              description="Na kontakt"
              icon={RefreshCw}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Úspešné</p>
                    <p className="text-2xl font-bold">{stats?.completedContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Čakajúce</p>
                    <p className="text-2xl font-bold">{stats?.pendingContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Phone className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bez odpovede</p>
                    <p className="text-2xl font-bold">{stats?.noAnswerContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Users className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nezáujem</p>
                    <p className="text-2xl font-bold">{stats?.notInterestedContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns?.detail?.statusDistribution || "Contact Status Distribution"}</CardTitle>
              </CardHeader>
              <CardContent>
                {stats && stats.totalContacts > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Pending", value: stats.pendingContacts || 0, color: CHART_PALETTE[3] },
                          { name: "Contacted", value: stats.contactedContacts || 0, color: CHART_PALETTE[1] },
                          { name: "Completed", value: stats.completedContacts || 0, color: CHART_PALETTE[0] },
                          { name: "No Answer", value: stats.noAnswerContacts || 0, color: CHART_PALETTE[2] },
                          { name: "Not Interested", value: stats.notInterestedContacts || 0, color: CHART_PALETTE[4] },
                          { name: "Failed", value: stats.failedContacts || 0, color: CHART_PALETTE[6] },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {[
                          { color: CHART_PALETTE[3] },
                          { color: CHART_PALETTE[1] },
                          { color: CHART_PALETTE[0] },
                          { color: CHART_PALETTE[2] },
                          { color: CHART_PALETTE[4] },
                          { color: CHART_PALETTE[6] },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    {t.campaigns?.detail?.noDataAvailable || "No data available"}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns?.detail?.attemptDistribution || "Attempt Distribution"}</CardTitle>
              </CardHeader>
              <CardContent>
                {contacts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={(() => {
                        const attemptCounts: Record<number, number> = {};
                        contacts.forEach(c => {
                          const attempts = c.attemptCount || 0;
                          attemptCounts[attempts] = (attemptCounts[attempts] || 0) + 1;
                        });
                        return Object.entries(attemptCounts)
                          .map(([attempts, count]) => ({
                            attempts: `${attempts} attempts`,
                            count,
                          }))
                          .sort((a, b) => parseInt(a.attempts) - parseInt(b.attempts));
                      })()}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <XAxis dataKey="attempts" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    {t.campaigns?.detail?.noDataAvailable || "No data available"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle>{t.campaigns?.detail?.campaignSummary || "Campaign Summary"}</CardTitle>
              </div>
              <Button variant="outline" data-testid="button-export-report">
                <Download className="w-4 h-4 mr-2" />
                {t.campaigns?.detail?.exportReport || "Export Report"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns?.detail?.totalContacts || "Total Contacts"}</p>
                  <p className="text-2xl font-bold">{stats?.totalContacts || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns?.detail?.successRate || "Success Rate"}</p>
                  <p className="text-2xl font-bold">
                    {((stats?.completedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns?.detail?.pendingContacts || "Pending"}</p>
                  <p className="text-2xl font-bold">{stats?.pendingContacts || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns?.detail?.callbackScheduled || "Callback Scheduled"}</p>
                  <p className="text-2xl font-bold">{stats?.callbackContacts || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="script" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="w-5 h-5" />
                  Skript pre operátorov
                </CardTitle>
                <CardDescription>
                  Interaktívny skript s výberovými poľami, zaškrtávacími tlačidlami a ďalšími prvkami
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={scriptMode}
                  onValueChange={(v) => setScriptMode(v as "builder" | "preview" | "legacy")}
                >
                  <SelectTrigger className="w-40" data-testid="select-script-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="builder">Editor</SelectItem>
                    <SelectItem value="preview">Náhľad</SelectItem>
                    <SelectItem value="legacy">Textový režim</SelectItem>
                  </SelectContent>
                </Select>
                {scriptMode !== "legacy" && (
                  <Button
                    onClick={() => {
                      if (structuredScript) {
                        saveScriptMutation.mutate(JSON.stringify(structuredScript));
                        setStructuredScriptModified(false);
                      }
                    }}
                    disabled={!structuredScriptModified || saveScriptMutation.isPending}
                    data-testid="button-save-structured-script"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveScriptMutation.isPending ? "Ukladám..." : "Uložiť skript"}
                  </Button>
                )}
                {scriptMode === "legacy" && (
                  <Button
                    onClick={() => saveScriptMutation.mutate(scriptContent)}
                    disabled={!scriptModified || saveScriptMutation.isPending}
                    data-testid="button-save-script"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveScriptMutation.isPending ? "Ukladám..." : "Uložiť skript"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {scriptMode === "builder" && (
                <div className="min-h-[500px]">
                  <ScriptBuilder
                    script={structuredScript}
                    onChange={(newScript) => {
                      setStructuredScript(newScript);
                      setStructuredScriptModified(true);
                    }}
                    isSaving={saveScriptMutation.isPending}
                  />
                  {structuredScriptModified && (
                    <div className="mt-4 flex items-center gap-2">
                      <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20">
                        Neuložené zmeny
                      </Badge>
                    </div>
                  )}
                </div>
              )}
              
              {scriptMode === "preview" && structuredScript && (
                <div className="min-h-[500px]">
                  <ScriptRunner
                    script={structuredScript}
                    onComplete={(session) => {
                      toast({ 
                        title: "Skript dokončený", 
                        description: `Vyplnených ${session.responses.length} odpovedí` 
                      });
                    }}
                  />
                </div>
              )}
              
              {scriptMode === "legacy" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="script-editor">Obsah skriptu (textový režim)</Label>
                    <Textarea
                      id="script-editor"
                      placeholder="Napíšte skript pre operátorov...

Príklad:
1. Pozdrav: 'Dobrý deň, volám z [Názov spoločnosti]...'
2. Overenie identity: 'Môžem hovoriť s pánom/pani [Meno]?'
3. Účel hovoru: 'Volám vám ohľadom...'
4. Otázky pre klienta:
   - Otázka 1
   - Otázka 2
5. Záver hovoru: 'Ďakujem za váš čas...'"
                      value={scriptContent.startsWith("{") ? "" : scriptContent}
                      onChange={(e) => {
                        setScriptContent(e.target.value);
                        setScriptModified(true);
                      }}
                      className="min-h-[400px] font-mono text-sm"
                      data-testid="textarea-script"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {scriptModified && (
                      <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20">
                        Neuložené zmeny
                      </Badge>
                    )}
                    {!scriptModified && scriptContent && !scriptContent.startsWith("{") && (
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20">
                        Uložené
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {scriptMode === "builder" && (
            <Card>
              <CardHeader>
                <CardTitle>Návod na tvorbu skriptu</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li><strong>Kroky:</strong> Rozdeľte skript do logických krokov (napr. Pozdrav, Overenie, Ponuka, Záver)</li>
                  <li><strong>Nadpisy a odseky:</strong> Použite pre textové inštrukcie a informácie</li>
                  <li><strong>Výberové polia:</strong> Pre otázky s jednoznačnou odpoveďou (napr. "Má záujem?" - Áno/Nie/Premyslí si)</li>
                  <li><strong>Zaškrtávacie polia:</strong> Pre zoznam položiek, ktoré treba overiť alebo splniť</li>
                  <li><strong>Textové polia:</strong> Pre poznámky a voľné odpovede klienta</li>
                  <li><strong>Poznámky:</strong> Pre dôležité upozornenia a tipy pre operátora</li>
                  <li><strong>Výsledok hovoru:</strong> Pre zaznamenanie finálneho stavu hovoru</li>
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Priradení operátori
              </CardTitle>
              <CardDescription>
                Vyberte operátorov, ktorí budú pracovať na tejto kampani
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {callCenterUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Žiadni operátori nie sú k dispozícii. Najprv vytvorte používateľov s rolou "Call Center".
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {callCenterUsers.map((user) => {
                      const isAssigned = assignedAgentIds.includes(user.id);
                      return (
                        <div 
                          key={user.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${isAssigned ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAssigned ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium">{user.fullName}</p>
                              <p className="text-sm text-muted-foreground">{roles.find(r => r.id === user.roleId)?.name || user.role}</p>
                            </div>
                          </div>
                          <Button
                            variant={isAssigned ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              const newAgentIds = isAssigned
                                ? assignedAgentIds.filter(id => id !== user.id)
                                : [...assignedAgentIds, user.id];
                              updateAgentsMutation.mutate(newAgentIds);
                            }}
                            disabled={updateAgentsMutation.isPending}
                            data-testid={`button-toggle-agent-${user.id}`}
                          >
                            {isAssigned ? (
                              <>
                                <CheckCheck className="w-4 h-4 mr-2" />
                                Priradený
                              </>
                            ) : (
                              "Priradiť"
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {assignedAgentIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Zhrnutie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm">
                    {assignedAgentIds.length} {assignedAgentIds.length === 1 ? 'operátor' : assignedAgentIds.length < 5 ? 'operátori' : 'operátorov'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    priradených k tejto kampani
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <DispositionsTab campaignId={campaignId} />
      </Tabs>

      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
            <DialogDescription>
              {selectedContact?.customer 
                ? `${selectedContact.customer.firstName} ${selectedContact.customer.lastName}`
                : "Unknown contact"
              }
            </DialogDescription>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={CONTACT_STATUS_COLORS[selectedContact.status]}>
                    {selectedContact.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Attempts</span>
                  <span>{selectedContact.attemptCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{selectedContact.customer?.phone || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{selectedContact.customer?.email || "-"}</span>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium">Update Status</label>
                <Select
                  value={selectedContact.status}
                  onValueChange={(value) => {
                    updateContactMutation.mutate({
                      contactId: selectedContact.id,
                      data: { status: value },
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-update-contact-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="callback_scheduled">Callback</SelectItem>
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">História zákazníka</label>
                </div>
                <ScrollArea className="h-48 rounded-md border p-2">
                  {contactActivityLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Žiadna história</p>
                  ) : (
                    <div className="space-y-2">
                      {contactActivityLogs.slice(0, 10).map((log) => {
                        const details = log.details || {};
                        const getActionLabel = (action: string) => {
                          const labels: Record<string, string> = {
                            create: "Vytvorenie",
                            update: "Úprava",
                            delete: "Zmazanie",
                            pipeline_move: "Presun v pipeline",
                            stage_changed: "Presun v pipeline",
                            campaign_joined: "Pridaný do kampane",
                            campaign_left: "Odstránený z kampane",
                            email_sent: "Email odoslaný",
                            sms_sent: "SMS odoslaná",
                            note_added: "Poznámka pridaná",
                          };
                          return labels[action] || action;
                        };
                        
                        const getActionIcon = (action: string) => {
                          if (action === "pipeline_move" || action === "stage_changed") return ArrowRight;
                          if (action === "campaign_joined" || action === "campaign_left") return Users;
                          if (action === "email_sent") return Mail;
                          if (action === "sms_sent") return MessageSquare;
                          if (action === "note_added") return FileEdit;
                          if (action === "update") return FileEdit;
                          return Clock;
                        };
                        
                        const Icon = getActionIcon(log.action);
                        
                        return (
                          <div key={log.id} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
                            <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{getActionLabel(log.action)}</p>
                              {(log.action === "pipeline_move" || log.action === "stage_changed") && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">{details.fromStageName || (details.fromStageId ? getStageName(details.fromStageId) : "—")}</Badge>
                                  <ArrowRight className="h-2.5 w-2.5" />
                                  <Badge className="text-[10px] px-1 py-0 bg-cyan-600 text-white">{details.toStageName || (details.toStageId ? getStageName(details.toStageId) : "—")}</Badge>
                                </div>
                              )}
                              {log.action === "campaign_joined" && details.campaignName && (
                                <p className="text-muted-foreground">{details.campaignName}</p>
                              )}
                              <p className="text-muted-foreground">{format(new Date(log.createdAt), "dd.MM.yyyy HH:mm")}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
