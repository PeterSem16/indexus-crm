import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, Search, Megaphone, PlayCircle, CheckCircle, Clock, XCircle, ExternalLink, FileText, Calendar, LayoutList, ChevronLeft, ChevronRight, BarChart3, TrendingUp, Phone, RefreshCw, Users, Mail, MessageSquare } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Campaign, type CampaignTemplate, COUNTRIES } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { sk } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const campaignFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["marketing", "sales", "follow_up", "retention", "upsell", "other"]),
  channel: z.enum(["phone", "email", "sms", "mixed"]),
  status: z.enum(["draft", "active", "paused", "completed", "cancelled"]),
  countryCodes: z.array(z.string()).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  criteria: z.string().optional(),
  script: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

const CAMPAIGN_TYPES = ["marketing", "sales", "follow_up", "retention", "upsell", "other"] as const;
const CAMPAIGN_CHANNELS = ["phone", "email", "sms", "mixed"] as const;
const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed", "cancelled"] as const;

function CampaignForm({
  initialData,
  templateData,
  onSubmit,
  isLoading,
  onCancel,
  t,
}: {
  initialData?: Campaign;
  templateData?: CampaignTemplate | null;
  onSubmit: (data: CampaignFormData) => void;
  isLoading: boolean;
  onCancel: () => void;
  t: any;
}) {
  const getDefaultValues = () => {
    if (initialData) {
      return {
        name: initialData.name,
        description: initialData.description || "",
        type: initialData.type as any,
        channel: (initialData.channel || "phone") as any,
        status: initialData.status as any,
        countryCodes: initialData.countryCodes || [],
        startDate: initialData.startDate ? format(new Date(initialData.startDate), "yyyy-MM-dd") : "",
        endDate: initialData.endDate ? format(new Date(initialData.endDate), "yyyy-MM-dd") : "",
        criteria: initialData.criteria || "",
        script: initialData.script || "",
      };
    }
    if (templateData) {
      return {
        name: "",
        description: templateData.description || "",
        type: templateData.type as any,
        channel: "phone" as const,
        status: "draft" as const,
        countryCodes: templateData.countryCodes || [],
        startDate: "",
        endDate: "",
        criteria: templateData.criteria || "",
        script: templateData.script || "",
      };
    }
    return {
      name: "",
      description: "",
      type: "marketing" as const,
      channel: "phone" as const,
      status: "draft" as const,
      countryCodes: [],
      startDate: "",
      endDate: "",
      criteria: "",
      script: "",
    };
  };

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: getDefaultValues(),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.campaigns?.campaignName || "Campaign Name"}</FormLabel>
              <FormControl>
                <Input placeholder={t.campaigns?.campaignName || "Campaign Name"} {...field} data-testid="input-campaign-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.campaigns?.description || "Description"}</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder={t.campaigns?.description || "Description"} 
                  {...field} 
                  data-testid="input-campaign-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.campaigns?.type || "Type"}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-campaign-type">
                      <SelectValue placeholder={t.campaigns?.selectType || "Select type"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t.campaigns?.types?.[type] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="channel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.campaigns?.channel || "Kanál"}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-campaign-channel">
                      <SelectValue placeholder={t.campaigns?.selectChannel || "Vybrať kanál"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CAMPAIGN_CHANNELS.map((channel) => (
                      <SelectItem key={channel} value={channel}>
                        {t.campaigns?.channels?.[channel] || channel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.campaigns?.status || "Status"}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-campaign-status">
                      <SelectValue placeholder={t.campaigns?.selectStatus || "Select status"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CAMPAIGN_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t.campaigns?.statuses?.[status] || status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.campaigns?.startDate || "Start Date"}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-campaign-start-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.campaigns?.endDate || "End Date"}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-campaign-end-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="countryCodes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.campaigns?.targetCountries || "Target Countries"}</FormLabel>
              <div className="grid grid-cols-4 gap-2">
                {COUNTRIES.map((country) => (
                  <div key={country.code} className="flex items-center gap-2">
                    <Checkbox
                      id={`country-${country.code}`}
                      checked={field.value.includes(country.code)}
                      onCheckedChange={(checked) => {
                        const newValue = checked
                          ? [...field.value, country.code]
                          : field.value.filter((c) => c !== country.code);
                        field.onChange(newValue);
                      }}
                      data-testid={`checkbox-country-${country.code}`}
                    />
                    <Label htmlFor={`country-${country.code}`} className="text-sm">
                      {country.flag} {country.code}
                    </Label>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-campaign">
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-save-campaign">
            {isLoading ? t.common.saving : t.common.save}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function CampaignCalendar({ 
  campaigns, 
  onCampaignClick 
}: { 
  campaigns: Campaign[];
  onCampaignClick: (campaign: Campaign) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });
    
    const startDay = start.getDay();
    const paddingDays = startDay === 0 ? 6 : startDay - 1;
    const prevMonth = subMonths(start, 1);
    const prevMonthEnd = endOfMonth(prevMonth);
    
    const paddedDays: Date[] = [];
    for (let i = paddingDays - 1; i >= 0; i--) {
      const day = new Date(prevMonthEnd);
      day.setDate(prevMonthEnd.getDate() - i);
      paddedDays.push(day);
    }
    
    return [...paddedDays, ...allDays];
  }, [currentMonth]);

  const getCampaignsForDay = (day: Date) => {
    const dayStart = startOfDay(day);
    return campaigns.filter((campaign) => {
      if (!campaign.startDate && !campaign.endDate) return false;
      const start = campaign.startDate ? startOfDay(new Date(campaign.startDate)) : null;
      const end = campaign.endDate ? endOfDay(new Date(campaign.endDate)) : null;
      
      if (start && end) {
        return isWithinInterval(dayStart, { start, end });
      }
      if (start) {
        return isSameDay(dayStart, start);
      }
      if (end && campaign.endDate) {
        return isSameDay(dayStart, endOfDay(new Date(campaign.endDate)));
      }
      return false;
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
      active: "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200",
      paused: "bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200",
      completed: "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200",
      cancelled: "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200",
    };
    return colors[status] || colors.draft;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {format(currentMonth, "LLLL yyyy", { locale: sk })}
        </h3>
        <div className="flex gap-2">
          <Button 
            size="icon" 
            variant="outline"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            size="icon" 
            variant="outline"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
        
        {days.map((day, index) => {
          const dayCampaigns = getCampaignsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          
          return (
            <div
              key={index}
              className={`min-h-[100px] border rounded-md p-1 ${
                isCurrentMonth ? "bg-card" : "bg-muted/30"
              } ${isCurrentDay ? "ring-2 ring-primary" : ""}`}
            >
              <div className={`text-sm font-medium mb-1 ${
                isCurrentMonth ? "" : "text-muted-foreground"
              }`}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayCampaigns.slice(0, 3).map((campaign) => (
                  <Tooltip key={campaign.id}>
                    <TooltipTrigger asChild>
                      <div
                        onClick={() => onCampaignClick(campaign)}
                        className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer ${getStatusColor(campaign.status)}`}
                        data-testid={`calendar-campaign-${campaign.id}`}
                      >
                        {campaign.name}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-muted-foreground">
                          {campaign.startDate && format(new Date(campaign.startDate), "dd.MM.yyyy")}
                          {campaign.startDate && campaign.endDate && " - "}
                          {campaign.endDate && format(new Date(campaign.endDate), "dd.MM.yyyy")}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {dayCampaigns.length > 3 && (
                  <div className="text-xs text-muted-foreground pl-1">
                    +{dayCampaigns.length - 3} ďalšie
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [agentsDialogCampaign, setAgentsDialogCampaign] = useState<Campaign | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: users = [] } = useQuery<{ id: string; firstName: string; lastName: string; role: string }[]>({
    queryKey: ["/api/users"],
  });

  const { data: currentCampaignAgents = [] } = useQuery<{ id: string; userId: string; campaignId: string }[]>({
    queryKey: ["/api/campaigns", agentsDialogCampaign?.id, "agents"],
    enabled: !!agentsDialogCampaign,
  });

  const { data: templates = [] } = useQuery<CampaignTemplate[]>({
    queryKey: ["/api/campaign-templates"],
  });

  const createMutation = useMutation({
    mutationFn: (data: CampaignFormData) => apiRequest("POST", "/api/campaigns", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setIsDialogOpen(false);
      toast({ title: t.campaigns?.created || "Campaign created" });
    },
    onError: () => {
      toast({ title: "Error", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CampaignFormData & { id: string }) => 
      apiRequest("PATCH", `/api/campaigns/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setIsDialogOpen(false);
      setEditingCampaign(null);
      toast({ title: t.campaigns?.updated || "Campaign updated" });
    },
    onError: () => {
      toast({ title: "Error", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setDeletingCampaign(null);
      toast({ title: t.campaigns?.deleted || "Campaign deleted" });
    },
    onError: () => {
      toast({ title: "Error", variant: "destructive" });
    },
  });

  const updateAgentsMutation = useMutation({
    mutationFn: (data: { campaignId: string; userIds: string[] }) => 
      apiRequest("POST", `/api/campaigns/${data.campaignId}/agents`, { userIds: data.userIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", agentsDialogCampaign?.id, "agents"] });
      setAgentsDialogCampaign(null);
      setSelectedAgentIds([]);
      toast({ title: "Agenti priradení" });
    },
    onError: () => {
      toast({ title: "Chyba pri priraďovaní agentov", variant: "destructive" });
    },
  });

  // Set initial selected agents when dialog opens
  useMemo(() => {
    if (agentsDialogCampaign && currentCampaignAgents.length >= 0) {
      setSelectedAgentIds(currentCampaignAgents.map(a => a.userId));
    }
  }, [currentCampaignAgents, agentsDialogCampaign]);

  const callCenterUsers = useMemo(() => {
    return users.filter(u => u.role === "callCenter" || u.role === "admin");
  }, [users]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchesSearch = 
        campaign.name.toLowerCase().includes(search.toLowerCase()) ||
        (campaign.description?.toLowerCase().includes(search.toLowerCase()));
      
      const matchesCountry = 
        selectedCountries.length === 0 || 
        (campaign.countryCodes && campaign.countryCodes.some(c => selectedCountries.includes(c as any)));
      
      return matchesSearch && matchesCountry;
    });
  }, [campaigns, search, selectedCountries]);

  const handleSubmit = (data: CampaignFormData) => {
    if (editingCampaign) {
      updateMutation.mutate({ ...data, id: editingCampaign.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; icon: any }> = {
      draft: { variant: "secondary", icon: Clock },
      active: { variant: "default", icon: PlayCircle },
      paused: { variant: "outline", icon: Clock },
      completed: { variant: "default", icon: CheckCircle },
      cancelled: { variant: "destructive", icon: XCircle },
    };
    const config = variants[status] || variants.draft;
    const Icon = config.icon;
    const statusLabels = t.campaigns?.statuses as Record<string, string> | undefined;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {statusLabels?.[status] || status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeLabels = t.campaigns?.types as Record<string, string> | undefined;
    return (
      <Badge variant="outline">
        {typeLabels?.[type] || type}
      </Badge>
    );
  };

  const columns = [
    {
      key: "name",
      header: t.campaigns?.campaignName || "Name",
      cell: (campaign: Campaign) => (
        <div className="font-medium">{campaign.name}</div>
      ),
    },
    {
      key: "type",
      header: t.campaigns?.type || "Type",
      cell: (campaign: Campaign) => getTypeBadge(campaign.type),
    },
    {
      key: "channel",
      header: (t.campaigns as any)?.channel || "Kanál",
      cell: (campaign: Campaign) => {
        const channelConfig: Record<string, { icon: typeof Phone; label: string; color: string }> = {
          phone: { icon: Phone, label: "Telefón", color: "text-blue-500" },
          email: { icon: Mail, label: "Email", color: "text-green-500" },
          sms: { icon: MessageSquare, label: "SMS", color: "text-orange-500" },
          mixed: { icon: Users, label: "Mix", color: "text-purple-500" },
        };
        const config = channelConfig[campaign.channel || "phone"] || channelConfig.phone;
        const Icon = config.icon;
        return (
          <Badge variant="outline" className="gap-1">
            <Icon className={`h-3 w-3 ${config.color}`} />
            {(t.campaigns as any)?.channels?.[campaign.channel || "phone"] || config.label}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: t.campaigns?.status || "Status",
      cell: (campaign: Campaign) => getStatusBadge(campaign.status),
    },
    {
      key: "countryCodes",
      header: t.campaigns?.targetCountries || "Countries",
      cell: (campaign: Campaign) => (
        <div className="flex gap-1 flex-wrap">
          {campaign.countryCodes?.map((code) => {
            const country = COUNTRIES.find(c => c.code === code);
            return (
              <span key={code} title={country?.name}>
                {country?.flag}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      key: "dates",
      header: t.campaigns?.dates || "Dates",
      cell: (campaign: Campaign) => (
        <div className="text-sm text-muted-foreground">
          {campaign.startDate && format(new Date(campaign.startDate), "dd.MM.yyyy")}
          {campaign.startDate && campaign.endDate && " - "}
          {campaign.endDate && format(new Date(campaign.endDate), "dd.MM.yyyy")}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (campaign: Campaign) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setAgentsDialogCampaign(campaign)}
            title="Priradiť agentov"
            data-testid={`button-assign-agents-${campaign.id}`}
          >
            <Users className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setEditingCampaign(campaign);
              setIsDialogOpen(true);
            }}
            data-testid={`button-edit-campaign-${campaign.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDeletingCampaign(campaign)}
            data-testid={`button-delete-campaign-${campaign.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={t.campaigns?.title || "Campaigns"}
        description={t.campaigns?.description || "Manage marketing and sales campaigns"}
      >
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => setIsComparisonOpen(true)} 
            data-testid="button-compare-campaigns"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Porovnať kampane
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-campaign" data-tour="create-campaign">
            <Plus className="h-4 w-4 mr-2" />
            {t.campaigns?.addCampaign || "Add Campaign"}
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t.campaigns?.searchPlaceholder || "Search campaigns..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-campaigns"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant={viewMode === "list" ? "default" : "ghost"}
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={viewMode === "calendar" ? "default" : "ghost"}
                onClick={() => setViewMode("calendar")}
                data-testid="button-view-calendar"
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent data-tour="campaign-list">
            {viewMode === "list" ? (
              <DataTable
                columns={columns}
                data={filteredCampaigns}
                isLoading={isLoading}
                emptyMessage={t.campaigns?.noCampaigns || "No campaigns found"}
                getRowKey={(campaign) => campaign.id}
                onRowClick={(campaign) => setLocation(`/campaigns/${campaign.id}`)}
              />
            ) : (
              <CampaignCalendar 
                campaigns={filteredCampaigns} 
                onCampaignClick={(campaign) => setLocation(`/campaigns/${campaign.id}`)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingCampaign(null);
          setSelectedTemplate(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign 
                ? (t.campaigns?.editCampaign || "Edit Campaign")
                : (t.campaigns?.addCampaign || "Add Campaign")}
            </DialogTitle>
            <DialogDescription>
              {editingCampaign 
                ? (t.campaigns?.editCampaignDesc || "Update campaign details")
                : (t.campaigns?.addCampaignDesc || "Create a new marketing or sales campaign")}
            </DialogDescription>
          </DialogHeader>
          
          {!editingCampaign && templates.length > 0 && (
            <div className="space-y-2 pb-4 border-b">
              <Label className="text-sm font-medium">Použiť šablónu</Label>
              <Select 
                value={selectedTemplate?.id || ""} 
                onValueChange={(value) => {
                  const template = templates.find(t => t.id === value);
                  setSelectedTemplate(template || null);
                }}
              >
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Vybrať šablónu (voliteľné)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Bez šablóny</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <CampaignForm
            key={selectedTemplate?.id || "new"}
            initialData={editingCampaign || undefined}
            templateData={selectedTemplate}
            onSubmit={handleSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
            onCancel={() => {
              setIsDialogOpen(false);
              setEditingCampaign(null);
              setSelectedTemplate(null);
            }}
            t={t}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCampaign} onOpenChange={() => setDeletingCampaign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.campaigns?.deleteCampaign || "Delete Campaign"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.campaigns?.deleteConfirm || "Are you sure you want to delete this campaign? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCampaign && deleteMutation.mutate(deletingCampaign.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isComparisonOpen} onOpenChange={(open) => {
        setIsComparisonOpen(open);
        if (!open) setSelectedForComparison([]);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Porovnanie kampaní</DialogTitle>
            <DialogDescription>
              Vyberte kampane na porovnanie ich výkonnosti
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vybrať kampane (max 4)</Label>
              <div className="grid gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`compare-${campaign.id}`}
                      checked={selectedForComparison.includes(campaign.id)}
                      onCheckedChange={(checked) => {
                        if (checked && selectedForComparison.length < 4) {
                          setSelectedForComparison([...selectedForComparison, campaign.id]);
                        } else if (!checked) {
                          setSelectedForComparison(selectedForComparison.filter(id => id !== campaign.id));
                        }
                      }}
                      data-testid={`checkbox-compare-${campaign.id}`}
                    />
                    <Label htmlFor={`compare-${campaign.id}`} className="flex-1 cursor-pointer">
                      {campaign.name}
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      {campaign.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {selectedForComparison.length >= 2 && (
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-4">Porovnanie vybraných kampaní</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">Metrika</th>
                          {selectedForComparison.map(id => {
                            const campaign = campaigns.find(c => c.id === id);
                            return (
                              <th key={id} className="text-center p-2 font-medium min-w-[120px]">
                                {campaign?.name}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2 text-muted-foreground">Typ</td>
                          {selectedForComparison.map(id => {
                            const campaign = campaigns.find(c => c.id === id);
                            return (
                              <td key={id} className="text-center p-2">
                                <Badge variant="outline">{campaign?.type}</Badge>
                              </td>
                            );
                          })}
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 text-muted-foreground">Stav</td>
                          {selectedForComparison.map(id => {
                            const campaign = campaigns.find(c => c.id === id);
                            return (
                              <td key={id} className="text-center p-2">
                                {getStatusBadge(campaign?.status || "draft")}
                              </td>
                            );
                          })}
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 text-muted-foreground">Obdobie</td>
                          {selectedForComparison.map(id => {
                            const campaign = campaigns.find(c => c.id === id);
                            return (
                              <td key={id} className="text-center p-2 text-xs">
                                {campaign?.startDate && format(new Date(campaign.startDate), "dd.MM.yy")}
                                {campaign?.startDate && campaign?.endDate && " - "}
                                {campaign?.endDate && format(new Date(campaign.endDate), "dd.MM.yy")}
                              </td>
                            );
                          })}
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 text-muted-foreground">Krajiny</td>
                          {selectedForComparison.map(id => {
                            const campaign = campaigns.find(c => c.id === id);
                            return (
                              <td key={id} className="text-center p-2">
                                <div className="flex justify-center gap-1">
                                  {campaign?.countryCodes?.map((code) => {
                                    const country = COUNTRIES.find(c => c.code === code);
                                    return <span key={code}>{country?.flag}</span>;
                                  })}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Pre zobrazenie detailných štatistík kontaktov otvorte jednotlivé kampane.
                  </p>
                </div>
              </div>
            )}

            {selectedForComparison.length < 2 && (
              <div className="text-center text-muted-foreground py-8">
                Vyberte aspoň 2 kampane na porovnanie
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsComparisonOpen(false);
                setSelectedForComparison([]);
              }}
              data-testid="button-close-comparison"
            >
              Zavrieť
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!agentsDialogCampaign} onOpenChange={(open) => {
        if (!open) {
          setAgentsDialogCampaign(null);
          setSelectedAgentIds([]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Priradiť agentov</DialogTitle>
            <DialogDescription>
              Vyberte agentov pre kampaň: {agentsDialogCampaign?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dostupní agenti</Label>
              <div className="grid gap-2 max-h-64 overflow-y-auto border rounded-md p-2">
                {callCenterUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Žiadni agenti nie sú k dispozícii
                  </p>
                ) : (
                  callCenterUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`agent-${user.id}`}
                        checked={selectedAgentIds.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAgentIds([...selectedAgentIds, user.id]);
                          } else {
                            setSelectedAgentIds(selectedAgentIds.filter(id => id !== user.id));
                          }
                        }}
                        data-testid={`checkbox-agent-${user.id}`}
                      />
                      <Label htmlFor={`agent-${user.id}`} className="flex-1 cursor-pointer">
                        {user.firstName} {user.lastName}
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {user.role}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setAgentsDialogCampaign(null);
                setSelectedAgentIds([]);
              }}
              data-testid="button-cancel-agents"
            >
              Zrušiť
            </Button>
            <Button 
              onClick={() => {
                if (agentsDialogCampaign) {
                  updateAgentsMutation.mutate({
                    campaignId: agentsDialogCampaign.id,
                    userIds: selectedAgentIds,
                  });
                }
              }}
              disabled={updateAgentsMutation.isPending}
              data-testid="button-save-agents"
            >
              {updateAgentsMutation.isPending ? "Ukladám..." : "Uložiť"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
