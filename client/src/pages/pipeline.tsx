import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, User as UserIcon, Calendar, DollarSign, Phone, Mail, FileText, Loader2, Settings, MoreHorizontal, Trash2, Edit, Clock, CheckCircle2, MessageSquare, X, Activity, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Deal, type PipelineStage, type Pipeline, type Customer, type Campaign, type User, type DealActivity, DEAL_SOURCES, COUNTRIES, DEAL_ACTIVITY_TYPES } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { sk } from "date-fns/locale";

interface StageWithDeals extends PipelineStage {
  deals: Deal[];
}

interface KanbanData {
  pipeline: Pipeline;
  stages: StageWithDeals[];
}

interface DealCardProps {
  deal: Deal;
  isDragging?: boolean;
  customers: Customer[];
  users: User[];
  onSelect?: (deal: Deal) => void;
}

function DealCard({ deal, isDragging, customers, users, onSelect }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatCurrency = (value: string | null, currency: string | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: currency || "EUR",
    }).format(parseFloat(value));
  };

  const customer = deal.customerId ? customers.find(c => c.id === deal.customerId) : null;
  const assignedUser = deal.assignedUserId ? users.find(u => u.id === deal.assignedUserId) : null;

  const handleClick = (e: React.MouseEvent) => {
    if (onSelect) {
      e.stopPropagation();
      onSelect(deal);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border rounded-md p-3 mb-2 cursor-move hover-elevate"
      {...attributes}
      {...listeners}
      onClick={handleClick}
      data-testid={`deal-card-${deal.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm line-clamp-2">{deal.title}</h4>
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
      
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {customer && (
          <div className="flex items-center gap-1">
            <UserIcon className="h-3 w-3" />
            <span className="truncate">{customer.firstName} {customer.lastName}</span>
          </div>
        )}

        {deal.value && parseFloat(deal.value) > 0 && (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            <span className="font-medium text-foreground">
              {formatCurrency(deal.value, deal.currency)}
            </span>
          </div>
        )}

        {deal.probability !== null && deal.probability !== undefined && deal.probability > 0 && (
          <Badge variant="outline" className="text-xs">
            {deal.probability}%
          </Badge>
        )}
        
        {deal.expectedCloseDate && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(deal.expectedCloseDate), "d. M. yyyy", { locale: sk })}</span>
          </div>
        )}

        {assignedUser && (
          <div className="flex items-center gap-1 pt-1 border-t">
            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium">
              {assignedUser.fullName?.charAt(0) || assignedUser.username.charAt(0).toUpperCase()}
            </div>
            <span className="truncate">{assignedUser.fullName || assignedUser.username}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface StageColumnProps {
  stage: StageWithDeals;
  onAddDeal: (stageId: string) => void;
  customers: Customer[];
  users: User[];
  onSelectDeal: (deal: Deal) => void;
}

function StageColumn({ stage, onAddDeal, customers, users, onSelectDeal }: StageColumnProps) {
  const totalValue = stage.deals.reduce((sum, deal) => {
    return sum + (deal.value ? parseFloat(deal.value) : 0);
  }, 0);

  return (
    <div 
      className="flex flex-col min-w-[280px] max-w-[280px] bg-muted/30 rounded-lg"
      data-testid={`stage-column-${stage.id}`}
    >
      <div 
        className="p-3 border-b flex items-center justify-between"
        style={{ borderTopColor: stage.color || "#3b82f6", borderTopWidth: "3px" }}
      >
        <div>
          <h3 className="font-medium text-sm">{stage.name}</h3>
          <div className="text-xs text-muted-foreground mt-0.5">
            {stage.deals.length} príležitostí · {new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(totalValue)}
          </div>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => onAddDeal(stage.id)}
          data-testid={`button-add-deal-${stage.id}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="p-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext items={stage.deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
          {stage.deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} customers={customers} users={users} onSelect={onSelectDeal} />
          ))}
        </SortableContext>
        
        {stage.deals.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Žiadne príležitosti
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { toast } = useToast();
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [newDealStageId, setNewDealStageId] = useState<string | null>(null);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isNewActivityOpen, setIsNewActivityOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditDealOpen, setIsEditDealOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const { data: pipelines, isLoading: pipelinesLoading, refetch: refetchPipelines } = useQuery<Pipeline[]>({
    queryKey: ["/api/pipelines"],
  });

  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !activePipelineId) {
      setActivePipelineId(pipelines[0].id);
    }
  }, [pipelines, activePipelineId]);

  const { data: kanbanData, isLoading: kanbanLoading, refetch: refetchKanban } = useQuery<KanbanData>({
    queryKey: ["/api/pipelines", activePipelineId, "kanban"],
    enabled: !!activePipelineId,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: dealActivities = [], refetch: refetchActivities } = useQuery<DealActivity[]>({
    queryKey: ["/api/deals", selectedDeal?.id, "activities"],
    enabled: !!selectedDeal?.id,
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: { type: string; subject: string; description?: string; dueAt?: string; priority?: string; reminderAt?: string }) => {
      if (!selectedDeal) throw new Error("No deal selected");
      return apiRequest("POST", `/api/deals/${selectedDeal.id}/activities`, data);
    },
    onSuccess: () => {
      refetchActivities();
      setIsNewActivityOpen(false);
      toast({ title: "Aktivita vytvorená" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť aktivitu", variant: "destructive" });
    },
  });

  const completeActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return apiRequest("PATCH", `/api/activities/${activityId}/complete`);
    },
    onSuccess: () => {
      refetchActivities();
      toast({ title: "Aktivita dokončená" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa dokončiť aktivitu", variant: "destructive" });
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Deal> }) => {
      return apiRequest("PATCH", `/api/deals/${id}`, data);
    },
    onSuccess: () => {
      refetchKanban();
      setIsEditDealOpen(false);
      setEditingDeal(null);
      toast({ title: "Príležitosť aktualizovaná" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa aktualizovať príležitosť", variant: "destructive" });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/deals/${id}`);
    },
    onSuccess: () => {
      refetchKanban();
      setIsDetailOpen(false);
      setSelectedDeal(null);
      toast({ title: "Príležitosť odstránená" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa odstrániť príležitosť", variant: "destructive" });
    },
  });

  const createPipelineMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; countryCodes: string[] }) => {
      return apiRequest("POST", "/api/pipelines", data);
    },
    onSuccess: () => {
      refetchPipelines();
      toast({ title: "Pipeline vytvorený" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť pipeline", variant: "destructive" });
    },
  });

  const deletePipelineMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/pipelines/${id}`);
    },
    onSuccess: () => {
      refetchPipelines();
      setActivePipelineId(null);
      toast({ title: "Pipeline odstránený" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa odstrániť pipeline", variant: "destructive" });
    },
  });

  const seedDefaultMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/pipelines/seed-default");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Pipeline vytvorený", description: "Predvolený predajný proces bol vytvorený" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť pipeline", variant: "destructive" });
    },
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: { 
      title: string; 
      stageId: string; 
      pipelineId: string; 
      value?: string; 
      source?: string; 
      notes?: string;
      customerId?: string;
      campaignId?: string;
      assignedUserId?: string;
      probability?: number;
    }) => {
      return apiRequest("POST", "/api/deals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines", activePipelineId, "kanban"] });
      setIsNewDealOpen(false);
      setNewDealStageId(null);
      toast({ title: "Príležitosť vytvorená" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť príležitosť", variant: "destructive" });
    },
  });

  const moveDealMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      return apiRequest("PATCH", `/api/deals/${dealId}/stage`, { stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines", activePipelineId, "kanban"] });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa presunúť príležitosť", variant: "destructive" });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDealId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDealId(null);

    if (!over) return;

    const activeDealId = active.id as string;
    const overId = over.id as string;

    if (!kanbanData) return;

    const sourceStage = kanbanData.stages.find(s => s.deals.some(d => d.id === activeDealId));
    let targetStageId: string | null = null;

    const targetStage = kanbanData.stages.find(s => s.id === overId);
    if (targetStage) {
      targetStageId = targetStage.id;
    } else {
      const targetDealStage = kanbanData.stages.find(s => s.deals.some(d => d.id === overId));
      if (targetDealStage) {
        targetStageId = targetDealStage.id;
      }
    }

    if (targetStageId && sourceStage && sourceStage.id !== targetStageId) {
      moveDealMutation.mutate({ dealId: activeDealId, stageId: targetStageId });
    }
  };

  const handleAddDeal = (stageId: string) => {
    setNewDealStageId(stageId);
    setIsNewDealOpen(true);
  };

  const handleCreateDeal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (!newDealStageId || !activePipelineId) return;

    const probabilityStr = formData.get("probability") as string;
    const probability = probabilityStr ? parseInt(probabilityStr, 10) : undefined;

    createDealMutation.mutate({
      title: formData.get("title") as string,
      stageId: newDealStageId,
      pipelineId: activePipelineId,
      value: formData.get("value") as string || undefined,
      source: formData.get("source") as string || undefined,
      notes: formData.get("notes") as string || undefined,
      customerId: formData.get("customerId") as string || undefined,
      campaignId: formData.get("campaignId") as string || undefined,
      assignedUserId: formData.get("assignedUserId") as string || undefined,
      probability,
    });
  };

  const activeDeal = activeDealId && kanbanData 
    ? kanbanData.stages.flatMap(s => s.deals).find(d => d.id === activeDealId)
    : null;

  const handleSelectDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsDetailOpen(true);
  };

  const handleCreateActivity = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createActivityMutation.mutate({
      type: formData.get("type") as string,
      subject: formData.get("subject") as string,
      description: formData.get("description") as string || undefined,
      dueAt: formData.get("dueAt") as string || undefined,
      priority: formData.get("priority") as string || "normal",
      reminderAt: formData.get("reminderAt") as string || undefined,
    });
  };

  const selectedCustomer = selectedDeal?.customerId 
    ? customers.find(c => c.id === selectedDeal.customerId) 
    : null;
  const selectedAssignedUser = selectedDeal?.assignedUserId 
    ? users.find(u => u.id === selectedDeal.assignedUserId) 
    : null;
  const selectedCampaign = selectedDeal?.campaignId 
    ? campaigns.find(c => c.id === selectedDeal.campaignId) 
    : null;

  if (pipelinesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pipelines || pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Žiadne predajné procesy</h2>
          <p className="text-muted-foreground mb-4">Začnite vytvorením predvoleného predajného procesu</p>
        </div>
        <Button 
          onClick={() => seedDefaultMutation.mutate()}
          disabled={seedDefaultMutation.isPending}
          data-testid="button-seed-pipeline"
        >
          {seedDefaultMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Vytvoriť predvolený proces
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader 
        title="Predajný pipeline" 
        description="Sledujte obchodné príležitosti v jednotlivých fázach"
      />

      <div className="flex items-center gap-4 p-4 border-b">
        <Select value={activePipelineId || ""} onValueChange={setActivePipelineId}>
          <SelectTrigger className="w-[250px]" data-testid="select-pipeline">
            <SelectValue placeholder="Vyberte pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsSettingsOpen(true)}
          data-testid="button-pipeline-settings"
        >
          <Settings className="h-4 w-4 mr-1" />
          Nastavenia
        </Button>
      </div>

      {kanbanLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : kanbanData ? (
        <div className="flex-1 overflow-x-auto p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full">
              {kanbanData.stages.map((stage) => (
                <StageColumn 
                  key={stage.id} 
                  stage={stage} 
                  onAddDeal={handleAddDeal}
                  customers={customers}
                  users={users}
                  onSelectDeal={handleSelectDeal}
                />
              ))}
            </div>

            <DragOverlay>
              {activeDeal ? <DealCard deal={activeDeal} isDragging customers={customers} users={users} onSelect={handleSelectDeal} /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      ) : null}

      <Dialog open={isNewDealOpen} onOpenChange={setIsNewDealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nová príležitosť</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDeal} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="title">Názov *</Label>
              <Input 
                id="title" 
                name="title" 
                placeholder="Napr. Novák - Cord Blood Premium" 
                required
                data-testid="input-deal-title"
              />
            </div>

            <div>
              <Label htmlFor="customerId">Zákazník</Label>
              <Select name="customerId">
                <SelectTrigger data-testid="select-deal-customer">
                  <SelectValue placeholder="Vyberte zákazníka" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="value">Hodnota (EUR)</Label>
                <Input 
                  id="value" 
                  name="value" 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  data-testid="input-deal-value"
                />
              </div>

              <div>
                <Label htmlFor="probability">Pravdepodobnosť (%)</Label>
                <Input 
                  id="probability" 
                  name="probability" 
                  type="number" 
                  min="0"
                  max="100"
                  placeholder="0"
                  data-testid="input-deal-probability"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="assignedUserId">Pridelený obchodník</Label>
              <Select name="assignedUserId">
                <SelectTrigger data-testid="select-deal-user">
                  <SelectValue placeholder="Vyberte obchodníka" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName || u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="campaignId">Kampaň</Label>
              <Select name="campaignId">
                <SelectTrigger data-testid="select-deal-campaign">
                  <SelectValue placeholder="Vyberte kampaň" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="source">Zdroj</Label>
              <Select name="source">
                <SelectTrigger data-testid="select-deal-source">
                  <SelectValue placeholder="Vyberte zdroj" />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Poznámky</Label>
              <Textarea 
                id="notes" 
                name="notes" 
                placeholder="Dodatočné informácie..."
                data-testid="input-deal-notes"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsNewDealOpen(false)}>
                Zrušiť
              </Button>
              <Button type="submit" disabled={createDealMutation.isPending} data-testid="button-create-deal">
                {createDealMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Vytvoriť
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-lg">{selectedDeal?.title}</SheetTitle>
              <div className="flex items-center gap-1">
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => {
                    if (selectedDeal) {
                      setEditingDeal(selectedDeal);
                      setIsEditDealOpen(true);
                    }
                  }}
                  data-testid="button-edit-deal"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => {
                    if (selectedDeal && confirm("Naozaj chcete odstrániť túto príležitosť?")) {
                      deleteDealMutation.mutate(selectedDeal.id);
                    }
                  }}
                  disabled={deleteDealMutation.isPending}
                  data-testid="button-delete-deal"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </SheetHeader>
          
          {selectedDeal && (
            <div className="py-4 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Hodnota</p>
                  <p className="font-medium">
                    {selectedDeal.value 
                      ? new Intl.NumberFormat("sk-SK", { style: "currency", currency: selectedDeal.currency || "EUR" }).format(parseFloat(selectedDeal.value))
                      : "-"
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pravdepodobnosť</p>
                  <p className="font-medium">{selectedDeal.probability ?? 0}%</p>
                </div>
              </div>

              {selectedCustomer && (
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Zákazník</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {selectedCustomer.firstName?.[0]}{selectedCustomer.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                      {selectedCustomer.email && (
                        <p className="text-xs text-muted-foreground">{selectedCustomer.email}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedAssignedUser && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pridelený obchodník</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {selectedAssignedUser.fullName?.[0] || selectedAssignedUser.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{selectedAssignedUser.fullName || selectedAssignedUser.username}</span>
                  </div>
                </div>
              )}

              {selectedCampaign && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Kampaň</p>
                  <p className="text-sm">{selectedCampaign.name}</p>
                </div>
              )}

              {selectedDeal.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Poznámky</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedDeal.notes}</p>
                </div>
              )}

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Aktivity
                  </h4>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setIsNewActivityOpen(true)}
                    data-testid="button-new-activity"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Pridať
                  </Button>
                </div>

                {dealActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Žiadne aktivity
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Nadchádzajúce aktivity */}
                    {dealActivities.filter(a => !a.completedAt).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-2">Nadchádzajúce</p>
                        <div className="space-y-2">
                          {dealActivities
                            .filter(a => !a.completedAt)
                            .sort((a, b) => {
                              if (!a.dueAt && !b.dueAt) return 0;
                              if (!a.dueAt) return 1;
                              if (!b.dueAt) return -1;
                              return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
                            })
                            .map((activity) => {
                              const priorityColors: Record<string, string> = {
                                urgent: "border-l-4 border-l-red-500",
                                high: "border-l-4 border-l-orange-500",
                                normal: "",
                                low: "border-l-4 border-l-gray-300",
                              };
                              const isOverdue = activity.dueAt && new Date(activity.dueAt) < new Date();
                              return (
                                <div 
                                  key={activity.id}
                                  className={`p-3 border rounded-md ${priorityColors[activity.priority || "normal"]} ${isOverdue ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                                  data-testid={`activity-${activity.id}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <Badge variant="outline" className="text-xs">
                                          {DEAL_ACTIVITY_TYPES.find(t => t.value === activity.type)?.label || activity.type}
                                        </Badge>
                                        {activity.priority === "urgent" && (
                                          <Badge variant="destructive" className="text-xs">Urgentné</Badge>
                                        )}
                                        {activity.priority === "high" && (
                                          <Badge className="text-xs bg-orange-500">Vysoká</Badge>
                                        )}
                                        {isOverdue && (
                                          <Badge variant="destructive" className="text-xs">Po termíne</Badge>
                                        )}
                                      </div>
                                      <p className="font-medium text-sm">{activity.subject}</p>
                                      {activity.description && (
                                        <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                                      )}
                                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                                        {activity.dueAt && (
                                          <p className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                                            <Clock className="h-3 w-3" />
                                            {format(new Date(activity.dueAt), "d. M. yyyy HH:mm", { locale: sk })}
                                          </p>
                                        )}
                                        {activity.reminderAt && (
                                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Bell className="h-3 w-3" />
                                            {format(new Date(activity.reminderAt), "d. M. HH:mm", { locale: sk })}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => completeActivityMutation.mutate(activity.id)}
                                      disabled={completeActivityMutation.isPending}
                                      data-testid={`button-complete-activity-${activity.id}`}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Dokončené aktivity (história) */}
                    {dealActivities.filter(a => a.completedAt).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-2">História komunikácie</p>
                        <div className="space-y-2">
                          {dealActivities
                            .filter(a => a.completedAt)
                            .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
                            .map((activity) => (
                              <div 
                                key={activity.id}
                                className="p-3 border rounded-md bg-muted/30"
                                data-testid={`activity-${activity.id}`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <Badge variant="secondary" className="text-xs">
                                        {DEAL_ACTIVITY_TYPES.find(t => t.value === activity.type)?.label || activity.type}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(activity.completedAt!), "d. M. yyyy HH:mm", { locale: sk })}
                                      </span>
                                    </div>
                                    <p className="text-sm">{activity.subject}</p>
                                    {activity.description && (
                                      <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                                    )}
                                    {activity.outcome && (
                                      <p className="text-xs mt-1 text-muted-foreground">
                                        Výsledok: {activity.outcome}
                                      </p>
                                    )}
                                  </div>
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isNewActivityOpen} onOpenChange={setIsNewActivityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nová aktivita</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateActivity} className="space-y-4">
            <div>
              <Label htmlFor="activity-type">Typ *</Label>
              <Select name="type" required>
                <SelectTrigger data-testid="select-activity-type">
                  <SelectValue placeholder="Vyberte typ" />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="activity-subject">Predmet *</Label>
              <Input 
                id="activity-subject" 
                name="subject" 
                placeholder="Napr. Zavolať zákazníkovi" 
                required
                data-testid="input-activity-subject"
              />
            </div>

            <div>
              <Label htmlFor="activity-dueAt">Termín</Label>
              <Input 
                id="activity-dueAt" 
                name="dueAt" 
                type="datetime-local"
                data-testid="input-activity-dueAt"
              />
            </div>

            <div>
              <Label htmlFor="activity-description">Popis</Label>
              <Textarea 
                id="activity-description" 
                name="description" 
                placeholder="Dodatočné informácie..."
                data-testid="input-activity-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="activity-priority">Priorita</Label>
                <Select name="priority" defaultValue="normal">
                  <SelectTrigger data-testid="select-activity-priority">
                    <SelectValue placeholder="Vyberte prioritu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Nízka</SelectItem>
                    <SelectItem value="normal">Normálna</SelectItem>
                    <SelectItem value="high">Vysoká</SelectItem>
                    <SelectItem value="urgent">Urgentná</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="activity-reminderAt">Pripomienka</Label>
                <Input 
                  id="activity-reminderAt" 
                  name="reminderAt" 
                  type="datetime-local"
                  data-testid="input-activity-reminderAt"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsNewActivityOpen(false)}>
                Zrušiť
              </Button>
              <Button type="submit" disabled={createActivityMutation.isPending} data-testid="button-create-activity">
                {createActivityMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Vytvoriť
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nastavenia Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-3">Existujúce predajné procesy</h4>
              <div className="space-y-2">
                {pipelines.map((pipeline) => (
                  <div key={pipeline.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="font-medium">{pipeline.name}</p>
                      {pipeline.description && (
                        <p className="text-sm text-muted-foreground">{pipeline.description}</p>
                      )}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {pipeline.countryCodes?.map((c: string) => (
                          <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pipeline.isDefault && (
                        <Badge variant="outline">Predvolený</Badge>
                      )}
                      {!pipeline.isDefault && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Naozaj chcete odstrániť pipeline "${pipeline.name}"?`)) {
                              deletePipelineMutation.mutate(pipeline.id);
                            }
                          }}
                          disabled={deletePipelineMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3">Vytvoriť nový predajný proces</h4>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createPipelineMutation.mutate({
                    name: formData.get("pipelineName") as string,
                    description: formData.get("pipelineDescription") as string || undefined,
                    countryCodes: ["SK"],
                  });
                  (e.target as HTMLFormElement).reset();
                }}
                className="space-y-3"
              >
                <div>
                  <Label htmlFor="pipelineName">Názov *</Label>
                  <Input 
                    id="pipelineName" 
                    name="pipelineName" 
                    placeholder="Napr. VIP Zákazníci" 
                    required
                    data-testid="input-pipeline-name"
                  />
                </div>
                <div>
                  <Label htmlFor="pipelineDescription">Popis</Label>
                  <Input 
                    id="pipelineDescription" 
                    name="pipelineDescription" 
                    placeholder="Voliteľný popis..."
                    data-testid="input-pipeline-description"
                  />
                </div>
                <Button type="submit" disabled={createPipelineMutation.isPending}>
                  {createPipelineMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Vytvoriť pipeline
                </Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Deal Dialog */}
      <Dialog open={isEditDealOpen} onOpenChange={(open) => { setIsEditDealOpen(open); if (!open) setEditingDeal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upraviť príležitosť</DialogTitle>
          </DialogHeader>
          {editingDeal && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updateDealMutation.mutate({
                  id: editingDeal.id,
                  data: {
                    title: formData.get("editTitle") as string,
                    value: formData.get("editValue") as string || "0",
                    probability: parseInt(formData.get("editProbability") as string) || 0,
                    notes: formData.get("editNotes") as string || null,
                  },
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="editTitle">Názov *</Label>
                <Input 
                  id="editTitle" 
                  name="editTitle" 
                  defaultValue={editingDeal.title}
                  required
                  data-testid="input-edit-deal-title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editValue">Hodnota (EUR)</Label>
                  <Input 
                    id="editValue" 
                    name="editValue" 
                    type="number"
                    step="0.01"
                    defaultValue={editingDeal.value || "0"}
                    data-testid="input-edit-deal-value"
                  />
                </div>
                <div>
                  <Label htmlFor="editProbability">Pravdepodobnosť (%)</Label>
                  <Input 
                    id="editProbability" 
                    name="editProbability" 
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={editingDeal.probability || 0}
                    data-testid="input-edit-deal-probability"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="editNotes">Poznámky</Label>
                <Textarea 
                  id="editNotes" 
                  name="editNotes" 
                  defaultValue={editingDeal.notes || ""}
                  data-testid="input-edit-deal-notes"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsEditDealOpen(false); setEditingDeal(null); }}>
                  Zrušiť
                </Button>
                <Button type="submit" disabled={updateDealMutation.isPending}>
                  {updateDealMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Uložiť
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
