import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, Search, Megaphone, PlayCircle, CheckCircle, Clock, XCircle, ExternalLink, FileText } from "lucide-react";
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
import { format } from "date-fns";

const campaignFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["marketing", "sales", "follow_up", "retention", "upsell", "other"]),
  status: z.enum(["draft", "active", "paused", "completed", "cancelled"]),
  countryCodes: z.array(z.string()).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  criteria: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

const CAMPAIGN_TYPES = ["marketing", "sales", "follow_up", "retention", "upsell", "other"] as const;
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
        status: initialData.status as any,
        countryCodes: initialData.countryCodes || [],
        startDate: initialData.startDate ? format(new Date(initialData.startDate), "yyyy-MM-dd") : "",
        endDate: initialData.endDate ? format(new Date(initialData.endDate), "yyyy-MM-dd") : "",
        criteria: initialData.criteria || "",
      };
    }
    if (templateData) {
      return {
        name: "",
        description: templateData.description || "",
        type: templateData.type as any,
        status: "draft" as const,
        countryCodes: templateData.countryCodes || [],
        startDate: "",
        endDate: "",
        criteria: templateData.criteria || "",
      };
    }
    return {
      name: "",
      description: "",
      type: "marketing" as const,
      status: "draft" as const,
      countryCodes: [],
      startDate: "",
      endDate: "",
      criteria: "",
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

export default function CampaignsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
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
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-campaign" data-tour="create-campaign">
          <Plus className="h-4 w-4 mr-2" />
          {t.campaigns?.addCampaign || "Add Campaign"}
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
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
          </CardHeader>
          <CardContent data-tour="campaign-list">
            <DataTable
              columns={columns}
              data={filteredCampaigns}
              isLoading={isLoading}
              emptyMessage={t.campaigns?.noCampaigns || "No campaigns found"}
              getRowKey={(campaign) => campaign.id}
              onRowClick={(campaign) => setLocation(`/campaigns/${campaign.id}`)}
            />
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
    </div>
  );
}
