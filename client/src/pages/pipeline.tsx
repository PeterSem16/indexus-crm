import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  DndContext, 
  DragOverlay, 
  pointerWithin, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, User as UserIcon, Calendar, DollarSign, Phone, Mail, FileText, Loader2, Settings, MoreHorizontal, Trash2, Edit, Clock, CheckCircle2, MessageSquare, X, Activity, Bell, BarChart3, TrendingUp, ArrowRight, HelpCircle, ChevronRight, Users, LayoutGrid, List, Archive, Coins, Globe, UserPlus, Megaphone, Share2, Building, Link2, Star, Facebook, Linkedin, Zap, Play, Pause } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCountryFilter } from "@/contexts/country-filter-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { type Deal, type PipelineStage, type Pipeline, type Customer, type Campaign, type User, type DealActivity, type Product, type DealProduct, type BillingDetails, type AutomationRule, DEAL_SOURCES, COUNTRIES, DEAL_ACTIVITY_TYPES, AUTOMATION_TRIGGER_TYPES, AUTOMATION_ACTION_TYPES, CUSTOMER_TRACKED_FIELDS } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  onScheduleActivity?: (dealId: string) => void;
}

function DealCard({ deal, isDragging, customers, users, onSelect, onScheduleActivity }: DealCardProps) {
  const [activitiesOpen, setActivitiesOpen] = useState(false);
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

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<DealActivity[]>({
    queryKey: ['/api/deals', deal.id, 'activities'],
    enabled: activitiesOpen,
  });

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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-4 w-4" />;
      case "meeting": return <Users className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "task": return <CheckCircle2 className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getSourceIcon = (source: string | null) => {
    switch (source) {
      case "web": return <Globe className="h-3 w-3" />;
      case "referral": return <UserPlus className="h-3 w-3" />;
      case "campaign": return <Megaphone className="h-3 w-3" />;
      case "partner": return <Building className="h-3 w-3" />;
      case "social": return <Share2 className="h-3 w-3" />;
      case "direct": return <Link2 className="h-3 w-3" />;
      case "cold_call": return <Phone className="h-3 w-3" />;
      case "event": return <Star className="h-3 w-3" />;
      default: return <HelpCircle className="h-3 w-3" />;
    }
  };

  const getSourceLabel = (source: string | null) => {
    switch (source) {
      case "web": return "Web";
      case "referral": return "Odporúčanie";
      case "campaign": return "Kampaň";
      case "partner": return "Partner";
      case "social": return "Sociálne siete";
      case "direct": return "Priamy";
      case "cold_call": return "Cold call";
      case "event": return "Event";
      default: return source || "Neznámy";
    }
  };

  const formatDueDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Dnes";
    if (diffDays === 1) return "Zajtra";
    if (diffDays < 0) return `Pred ${Math.abs(diffDays)} dňami`;
    return `O ${diffDays} dní`;
  };

  const pendingActivities = activities.filter(a => !a.isCompleted);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border rounded-md p-3 mb-2 cursor-move hover-elevate relative"
      {...attributes}
      {...listeners}
      onClick={handleClick}
      data-testid={`deal-card-${deal.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm line-clamp-2 flex-1">{deal.title}</h4>
        <div className="flex items-center gap-1 shrink-0">
          <Popover open={activitiesOpen} onOpenChange={setActivitiesOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivitiesOpen(!activitiesOpen);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                data-testid={`button-deal-activities-${deal.id}`}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start" side="right">
              <div className="p-3 border-b">
                <h4 className="font-medium text-sm">Aktivity</h4>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {activitiesLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    Načítavam...
                  </div>
                ) : pendingActivities.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Žiadne naplánované aktivity
                  </div>
                ) : (
                  <div className="divide-y">
                    {pendingActivities.map((activity) => (
                      <div key={activity.id} className="p-3 flex items-start gap-3">
                        <div className="mt-0.5">
                          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getActivityIcon(activity.type)}
                            <span className="font-medium text-sm truncate">{activity.subject}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {activity.dueAt && formatDueDate(activity.dueAt)}
                            {activity.userId && users.find(u => u.id === activity.userId) && (
                              <> · {users.find(u => u.id === activity.userId)?.fullName}</>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivitiesOpen(false);
                    onScheduleActivity?.(deal.id);
                  }}
                  data-testid={`button-schedule-activity-${deal.id}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Naplánovať aktivitu
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {customer && (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                {customer.firstName?.charAt(0)}{customer.lastName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
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

        <div className="flex items-center gap-2 flex-wrap">
          {deal.probability !== null && deal.probability !== undefined && deal.probability > 0 && (
            <Badge variant="outline" className="text-xs">
              {deal.probability}%
            </Badge>
          )}

          {deal.source && (
            <Badge variant="secondary" className="text-xs gap-1">
              {getSourceIcon(deal.source)}
              {getSourceLabel(deal.source)}
            </Badge>
          )}

          {deal.campaignId && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Megaphone className="h-3 w-3" />
              Kampaň
            </Badge>
          )}
        </div>
        
        {deal.expectedCloseDate && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(deal.expectedCloseDate), "d. M. yyyy", { locale: sk })}</span>
          </div>
        )}

        {assignedUser && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px] bg-green-100 text-green-700">
                {assignedUser.fullName?.charAt(0) || assignedUser.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
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
  onEditStage: (stage: PipelineStage) => void;
  onDeleteStage: (stage: StageWithDeals) => void;
}

function StageColumn({ stage, onAddDeal, customers, users, onSelectDeal, onEditStage, onDeleteStage }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = stage.deals.reduce((sum, deal) => {
    return sum + (deal.value ? parseFloat(deal.value) : 0);
  }, 0);

  const stageColor = stage.color || "#3b82f6";
  
  return (
    <div 
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] max-w-[280px] rounded-lg transition-colors ${isOver ? 'ring-2 ring-primary' : ''}`}
      style={{ 
        backgroundColor: isOver ? `${stageColor}15` : `${stageColor}10`,
        borderTop: `3px solid ${stageColor}`
      }}
      data-testid={`stage-column-${stage.id}`}
    >
      <div 
        className="p-3 border-b flex items-center justify-between"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h3 className="font-medium text-sm truncate">{stage.name}</h3>
            {stage.probability !== null && stage.probability !== undefined && stage.probability > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1">{stage.probability}%</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {stage.deals.length} príležitostí · {new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(totalValue)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-stage-menu-${stage.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditStage(stage)} data-testid={`menu-edit-stage-${stage.id}`}>
                <Edit className="h-4 w-4 mr-2" />
                Upraviť fázu
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDeleteStage(stage)}
                className="text-destructive"
                data-testid={`menu-delete-stage-${stage.id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Odstrániť fázu
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7"
            onClick={() => onAddDeal(stage.id)}
            data-testid={`button-add-deal-${stage.id}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="p-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext items={stage.deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
          {stage.deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} customers={customers} users={users} onSelect={onSelectDeal} onScheduleActivity={() => onSelectDeal(deal)} />
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

interface DealProductsSectionProps {
  dealId: string;
  dealStatus: string | null;
  onProcessWon: () => void;
  isProcessing: boolean;
}

function DealProductsSection({ dealId, dealStatus, onProcessWon, isProcessing }: DealProductsSectionProps) {
  const { toast } = useToast();
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  const { data: dealProductsData = [], refetch: refetchDealProducts } = useQuery<DealProduct[]>({
    queryKey: ["/api/deals", dealId, "products"],
  });

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const addProductMutation = useMutation({
    mutationFn: async (data: { productId: string; quantity: number; unitPrice: string }) => {
      return apiRequest("POST", `/api/deals/${dealId}/products`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "products"] });
      refetchDealProducts();
      setIsAddingProduct(false);
      setSelectedProductId("");
      setQuantity("1");
      setUnitPrice("");
      toast({ title: "Produkt pridaný" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa pridať produkt", variant: "destructive" });
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/deal-products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "products"] });
      refetchDealProducts();
      toast({ title: "Produkt odstránený" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa odstrániť produkt", variant: "destructive" });
    },
  });

  const handleAddProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast({ title: "Chyba", description: "Vyberte produkt", variant: "destructive" });
      return;
    }

    addProductMutation.mutate({ 
      productId: selectedProductId, 
      quantity: parseInt(quantity) || 1, 
      unitPrice: unitPrice || "0" 
    });
  };

  const totalValue = dealProductsData.reduce((sum, dp) => {
    const price = parseFloat(dp.unitPrice || "0");
    return sum + (price * dp.quantity);
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Produkty
        </h4>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setIsAddingProduct(!isAddingProduct)}
          data-testid="button-add-product"
        >
          <Plus className="h-3 w-3 mr-1" />
          Pridať
        </Button>
      </div>

      {isAddingProduct && (
        <form onSubmit={handleAddProduct} className="p-3 bg-muted/50 rounded-md mb-3 space-y-3">
          <div>
            <Label htmlFor="productId">Produkt</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger data-testid="select-product">
                <SelectValue placeholder="Vyberte produkt" />
              </SelectTrigger>
              <SelectContent>
                {allProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="quantity">Množstvo</Label>
              <Input 
                type="number" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)} 
                min="1" 
                data-testid="input-quantity" 
              />
            </div>
            <div>
              <Label htmlFor="unitPrice">Cena/ks</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={unitPrice} 
                onChange={(e) => setUnitPrice(e.target.value)} 
                placeholder="0.00" 
                data-testid="input-unit-price" 
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingProduct(false)}>
              Zrušiť
            </Button>
            <Button type="submit" size="sm" disabled={addProductMutation.isPending}>
              {addProductMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Pridať
            </Button>
          </div>
        </form>
      )}

      {dealProductsData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Žiadne produkty
        </p>
      ) : (
        <div className="space-y-2">
          {dealProductsData.map((dp) => {
            const product = allProducts.find(p => p.id === dp.productId);
            return (
              <div key={dp.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div>
                  <p className="text-sm font-medium">{product?.name || "Neznámy produkt"}</p>
                  <p className="text-xs text-muted-foreground">
                    {dp.quantity}x · {dp.unitPrice ? `${parseFloat(dp.unitPrice).toFixed(2)} EUR` : "-"}
                  </p>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => removeProductMutation.mutate(dp.id)}
                  disabled={removeProductMutation.isPending}
                  data-testid={`button-remove-product-${dp.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <div className="flex justify-between pt-2 border-t text-sm">
            <span className="font-medium">Celkom:</span>
            <span className="font-medium">{totalValue.toFixed(2)} EUR</span>
          </div>
        </div>
      )}

      {dealStatus === "won" && dealProductsData.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <Button 
            onClick={onProcessWon}
            disabled={isProcessing}
            className="w-full"
            data-testid="button-process-won"
          >
            {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vytvoriť zmluvu a faktúru
          </Button>
        </div>
      )}
    </div>
  );
}

interface PipelineReportsProps {
  stages: StageWithDeals[];
  pipeline: Pipeline;
}

function PipelineReports({ stages, pipeline }: PipelineReportsProps) {
  const parseValue = (value: string | null): number => {
    if (!value || value.trim() === "") return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const allDeals = stages.flatMap(s => s.deals);
  const totalDeals = allDeals.length;
  const totalValue = allDeals.reduce((sum, d) => sum + parseValue(d.value), 0);
  
  const weightedValue = allDeals.reduce((sum, d) => {
    const value = parseValue(d.value);
    const probability = d.probability || 0;
    return sum + (value * probability / 100);
  }, 0);

  const wonDeals = allDeals.filter(d => d.status === "won");
  const lostDeals = allDeals.filter(d => d.status === "lost");
  const openDeals = allDeals.filter(d => d.status === "open");

  const wonValue = wonDeals.reduce((sum, d) => sum + parseValue(d.value), 0);
  
  const conversionRates: { from: string; to: string; rate: number }[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const currentStage = stages[i];
    const nextStage = stages[i + 1];
    const currentCount = currentStage.deals.length;
    const nextCount = nextStage.deals.length;
    
    if (currentCount > 0) {
      conversionRates.push({
        from: currentStage.name,
        to: nextStage.name,
        rate: (nextCount / currentCount) * 100,
      });
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Celkom obchodov</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeals}</div>
            <p className="text-xs text-muted-foreground">
              {openDeals.length} otvorených, {wonDeals.length} vyhraných, {lostDeals.length} stratených
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Celková hodnota</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Vyhrané: {formatCurrency(wonValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predpoveď tržieb</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(weightedValue)}</div>
            <p className="text-xs text-muted-foreground">
              Vážená hodnota podľa pravdepodobnosti
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Úspešnosť</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(wonDeals.length + lostDeals.length) > 0 
                ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) 
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {wonDeals.length} z {wonDeals.length + lostDeals.length} uzavretých
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Obchody podľa fáz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stages.map((stage) => {
              const stageValue = stage.deals.reduce((sum, d) => sum + parseValue(d.value), 0);
              const percentage = totalDeals > 0 ? (stage.deals.length / totalDeals) * 100 : 0;
              
              return (
                <div key={stage.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{stage.name}</span>
                    <span className="text-muted-foreground">
                      {stage.deals.length} obchodov · {formatCurrency(stageValue)}
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Konverzné pomery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {conversionRates.length > 0 ? (
              conversionRates.map((cr, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">{cr.from}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary" className="text-xs">{cr.to}</Badge>
                  <span className="ml-auto font-medium">
                    {Math.round(cr.rate)}%
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nedostatok dát pre výpočet konverzií</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Predpoveď podľa fáz</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Fáza</th>
                  <th className="text-right py-2 font-medium">Počet</th>
                  <th className="text-right py-2 font-medium">Hodnota</th>
                  <th className="text-right py-2 font-medium">Priem. pravdep.</th>
                  <th className="text-right py-2 font-medium">Vážená hodnota</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => {
                  const stageValue = stage.deals.reduce((sum, d) => sum + parseValue(d.value), 0);
                  const avgProbability = stage.deals.length > 0
                    ? stage.deals.reduce((sum, d) => sum + (d.probability || 0), 0) / stage.deals.length
                    : 0;
                  const stageWeighted = stage.deals.reduce((sum, d) => {
                    const value = parseValue(d.value);
                    const probability = d.probability || 0;
                    return sum + (value * probability / 100);
                  }, 0);

                  return (
                    <tr key={stage.id} className="border-b last:border-0">
                      <td className="py-2">{stage.name}</td>
                      <td className="text-right py-2">{stage.deals.length}</td>
                      <td className="text-right py-2">{formatCurrency(stageValue)}</td>
                      <td className="text-right py-2">{Math.round(avgProbability)}%</td>
                      <td className="text-right py-2 font-medium">{formatCurrency(stageWeighted)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/50 font-medium">
                  <td className="py-2">Celkom</td>
                  <td className="text-right py-2">{totalDeals}</td>
                  <td className="text-right py-2">{formatCurrency(totalValue)}</td>
                  <td className="text-right py-2">-</td>
                  <td className="text-right py-2">{formatCurrency(weightedValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Automations View Component
interface AutomationsViewProps {
  pipelineId: string;
  stages: StageWithDeals[];
  users: User[];
}

function AutomationsView({ pipelineId, stages, users }: AutomationsViewProps) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; rule: AutomationRule | null }>({ open: false, rule: null });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    triggerType: "deal_created",
    triggerConfig: {} as Record<string, any>,
    actionType: "create_activity",
    actionConfig: {} as Record<string, any>,
  });

  const { data: automations = [], isLoading, refetch } = useQuery<AutomationRule[]>({
    queryKey: ["/api/pipelines", pipelineId, "automations"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", `/api/pipelines/${pipelineId}/automations`, data);
    },
    onSuccess: () => {
      refetch();
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Automatizácia vytvorená" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť automatizáciu", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/automations/${id}`, data);
    },
    onSuccess: () => {
      refetch();
      setEditingRule(null);
      resetForm();
      toast({ title: "Automatizácia aktualizovaná" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa aktualizovať automatizáciu", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/automations/${id}/toggle`, { isActive });
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Stav automatizácie zmenený" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa zmeniť stav", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/automations/${id}`);
    },
    onSuccess: () => {
      refetch();
      setDeleteConfirm({ open: false, rule: null });
      toast({ title: "Automatizácia zmazaná" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa zmazať automatizáciu", variant: "destructive" });
    },
  });

  const [executeResult, setExecuteResult] = useState<{ success: boolean; action: string; details: string } | null>(null);

  const executeMutation = useMutation({
    mutationFn: async ({ ruleId, dealId }: { ruleId: string; dealId: string }) => {
      return apiRequest("POST", `/api/automations/${ruleId}/execute`, { dealId });
    },
    onSuccess: (data: any) => {
      refetch();
      setExecuteResult({
        success: true,
        action: data.result?.action || "unknown",
        details: data.result?.details || "Akcia bola vykonaná"
      });
    },
    onError: () => {
      setExecuteResult({
        success: false,
        action: "error",
        details: "Nepodarilo sa spustiť automatizáciu"
      });
    },
  });

  const [executeDialog, setExecuteDialog] = useState<{ open: boolean; rule: AutomationRule | null }>({ open: false, rule: null });
  const [selectedDealId, setSelectedDealId] = useState("");

  const closeExecuteDialog = () => {
    setExecuteDialog({ open: false, rule: null });
    setSelectedDealId("");
    setExecuteResult(null);
  };

  // Get all deals from stages for the execute dialog
  const allDeals = stages.flatMap(stage => stage.deals || []);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      triggerType: "deal_created",
      triggerConfig: {},
      actionType: "create_activity",
      actionConfig: {},
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (rule: AutomationRule) => {
    setFormData({
      name: rule.name,
      description: rule.description || "",
      triggerType: rule.triggerType,
      triggerConfig: rule.triggerConfig || {},
      actionType: rule.actionType,
      actionConfig: rule.actionConfig || {},
    });
    setEditingRule(rule);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getTriggerLabel = (type: string) => {
    return AUTOMATION_TRIGGER_TYPES.find(t => t.value === type)?.label || type;
  };

  const getActionLabel = (type: string) => {
    return AUTOMATION_ACTION_TYPES.find(a => a.value === type)?.label || type;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Automatizácie pipeline</h2>
          <p className="text-sm text-muted-foreground">Nastavte pravidlá pre automatické akcie pri zmenách v deals</p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-create-automation">
          <Plus className="h-4 w-4 mr-2" />
          Nová automatizácia
        </Button>
      </div>

      {automations.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Žiadne automatizácie</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Vytvorte prvú automatizáciu pre tento pipeline
            </p>
            <Button onClick={handleOpenCreate} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Vytvoriť automatizáciu
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {automations.map((rule) => (
            <Card key={rule.id} className={`transition-opacity ${!rule.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{rule.name}</h3>
                      <Badge variant={rule.isActive ? "default" : "secondary"} className="shrink-0">
                        {rule.isActive ? "Aktívne" : "Neaktívne"}
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{getTriggerLabel(rule.triggerType)}</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{getActionLabel(rule.actionType)}</span>
                      </div>
                    </div>
                    {rule.executionCount !== null && rule.executionCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Spustené {rule.executionCount}x
                        {rule.lastExecutedAt && ` • Naposledy: ${format(new Date(rule.lastExecutedAt), "d.M.yyyy HH:mm", { locale: sk })}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.isActive ?? true}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, isActive: checked })}
                      data-testid={`toggle-automation-${rule.id}`}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`automation-menu-${rule.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setExecuteDialog({ open: true, rule })}>
                          <Play className="h-4 w-4 mr-2" />
                          Spustiť test
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenEdit(rule)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Upraviť
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteConfirm({ open: true, rule })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Zmazať
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingRule} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingRule(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Upraviť automatizáciu" : "Nová automatizácia"}</DialogTitle>
            <DialogDescription>
              Nastavte pravidlo pre automatické akcie
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Názov *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Napr. Notifikácia pri novom deale"
                required
                data-testid="input-automation-name"
              />
            </div>

            <div>
              <Label htmlFor="description">Popis</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Voliteľný popis pravidla"
                rows={2}
                data-testid="input-automation-description"
              />
            </div>

            <div>
              <Label>Spúšťač (Trigger)</Label>
              <Select
                value={formData.triggerType}
                onValueChange={(val) => setFormData({ ...formData, triggerType: val, triggerConfig: {} })}
              >
                <SelectTrigger data-testid="select-trigger-type">
                  <SelectValue placeholder="Vyberte spúšťač" />
                </SelectTrigger>
                <SelectContent>
                  {AUTOMATION_TRIGGER_TYPES.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      {trigger.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.triggerType === "stage_changed" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Z fázy</Label>
                  <Select
                    value={formData.triggerConfig.fromStageId || "any"}
                    onValueChange={(val) => setFormData({ 
                      ...formData, 
                      triggerConfig: { ...formData.triggerConfig, fromStageId: val === "any" ? undefined : val }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Akákoľvek" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Akákoľvek</SelectItem>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Do fázy</Label>
                  <Select
                    value={formData.triggerConfig.toStageId || "any"}
                    onValueChange={(val) => setFormData({ 
                      ...formData, 
                      triggerConfig: { ...formData.triggerConfig, toStageId: val === "any" ? undefined : val }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Akákoľvek" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Akákoľvek</SelectItem>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {formData.triggerType === "deal_rotting" && (
              <div>
                <Label>Počet dní neaktivity</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.triggerConfig.rottingDays || 7}
                  onChange={(e) => setFormData({
                    ...formData,
                    triggerConfig: { ...formData.triggerConfig, rottingDays: parseInt(e.target.value) }
                  })}
                  data-testid="input-rotting-days"
                />
              </div>
            )}

            {formData.triggerType === "customer_updated" && (
              <div className="space-y-3">
                <div>
                  <Label>Sledované polia zákazníka</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Vyberte ktoré polia pri zmene spustia automatizáciu
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {CUSTOMER_TRACKED_FIELDS.map((field) => {
                      const trackedFields = formData.triggerConfig.trackedFields || [];
                      const isChecked = trackedFields.includes(field.value);
                      return (
                        <label key={field.value} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const newFields = e.target.checked
                                ? [...trackedFields, field.value]
                                : trackedFields.filter((f: string) => f !== field.value);
                              setFormData({
                                ...formData,
                                triggerConfig: { ...formData.triggerConfig, trackedFields: newFields }
                              });
                            }}
                            className="h-4 w-4"
                            data-testid={`checkbox-field-${field.value}`}
                          />
                          <span className="text-sm">{field.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({
                        ...formData,
                        triggerConfig: { ...formData.triggerConfig, trackedFields: CUSTOMER_TRACKED_FIELDS.map(f => f.value) }
                      })}
                    >
                      Vybrať všetko
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({
                        ...formData,
                        triggerConfig: { ...formData.triggerConfig, trackedFields: [] }
                      })}
                    >
                      Zrušiť výber
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Akcia</Label>
              <Select
                value={formData.actionType}
                onValueChange={(val) => setFormData({ ...formData, actionType: val, actionConfig: {} })}
              >
                <SelectTrigger data-testid="select-action-type">
                  <SelectValue placeholder="Vyberte akciu" />
                </SelectTrigger>
                <SelectContent>
                  {AUTOMATION_ACTION_TYPES.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.actionType === "create_activity" && (
              <div className="space-y-3">
                <div>
                  <Label>Typ aktivity</Label>
                  <Select
                    value={formData.actionConfig.activityType || "call"}
                    onValueChange={(val) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, activityType: val }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_ACTIVITY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Predmet aktivity</Label>
                  <Input
                    value={formData.actionConfig.activitySubject || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, activitySubject: e.target.value }
                    })}
                    placeholder="Napr. Kontaktovať zákazníka"
                  />
                </div>
                <div>
                  <Label>Splatnosť (dní od spustenia)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.actionConfig.activityDueDays || 1}
                    onChange={(e) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, activityDueDays: parseInt(e.target.value) }
                    })}
                  />
                </div>
              </div>
            )}

            {formData.actionType === "assign_owner" && (
              <div>
                <Label>Priradiť používateľovi</Label>
                <Select
                  value={formData.actionConfig.assignUserId || ""}
                  onValueChange={(val) => setFormData({
                    ...formData,
                    actionConfig: { ...formData.actionConfig, assignUserId: val }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte používateľa" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.fullName || user.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.actionType === "move_stage" && (
              <div>
                <Label>Presunúť do fázy</Label>
                <Select
                  value={formData.actionConfig.targetStageId || ""}
                  onValueChange={(val) => setFormData({
                    ...formData,
                    actionConfig: { ...formData.actionConfig, targetStageId: val }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte fázu" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.actionType === "add_note" && (
              <div>
                <Label>Text poznámky</Label>
                <Textarea
                  value={formData.actionConfig.noteText || ""}
                  onChange={(e) => setFormData({
                    ...formData,
                    actionConfig: { ...formData.actionConfig, noteText: e.target.value }
                  })}
                  placeholder="Text poznámky, ktorá sa pridá k dealu"
                  rows={3}
                />
              </div>
            )}

            {formData.actionType === "send_email" && (
              <div className="space-y-3">
                <div>
                  <Label>Predmet emailu</Label>
                  <Input
                    value={formData.actionConfig.emailSubject || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, emailSubject: e.target.value }
                    })}
                    placeholder="Predmet emailovej správy"
                  />
                </div>
                <div>
                  <Label>Obsah emailu</Label>
                  <Textarea
                    value={formData.actionConfig.emailBody || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, emailBody: e.target.value }
                    })}
                    placeholder="Text emailovej správy. Môžete použiť {deal_name}, {customer_name} pre personalizáciu."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {formData.actionType === "update_deal" && (
              <div className="space-y-3">
                <div>
                  <Label>Pole na aktualizáciu</Label>
                  <Select
                    value={formData.actionConfig.updateField || ""}
                    onValueChange={(val) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, updateField: val }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte pole" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">Priorita</SelectItem>
                      <SelectItem value="status">Stav</SelectItem>
                      <SelectItem value="probability">Pravdepodobnosť (%)</SelectItem>
                      <SelectItem value="tags">Značky</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nová hodnota</Label>
                  <Input
                    value={formData.actionConfig.updateValue || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, updateValue: e.target.value }
                    })}
                    placeholder="Zadajte novú hodnotu"
                  />
                </div>
              </div>
            )}

            {formData.actionType === "create_deal" && (
              <div className="space-y-3">
                <div>
                  <Label>Cieľová fáza pre nový deal</Label>
                  <Select
                    value={formData.actionConfig.dealStageId || ""}
                    onValueChange={(val) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, dealStageId: val }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte fázu (napr. Lead)" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fáza do ktorej sa vytvorí nový deal pri konverzii zákazníka
                  </p>
                </div>
                <div>
                  <Label>Názov dealu (šablóna)</Label>
                  <Input
                    value={formData.actionConfig.dealTitle || "{customer_name} - Konverzia"}
                    onChange={(e) => setFormData({
                      ...formData,
                      actionConfig: { ...formData.actionConfig, dealTitle: e.target.value }
                    })}
                    placeholder="{customer_name} - Konverzia"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Použite {"{customer_name}"} pre meno zákazníka
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingRule(null);
                  resetForm();
                }}
              >
                Zrušiť
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-automation"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingRule ? "Uložiť zmeny" : "Vytvoriť"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, rule: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať automatizáciu?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete zmazať automatizáciu "{deleteConfirm.rule?.name}"? Táto akcia je nevratná.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm.rule && deleteMutation.mutate(deleteConfirm.rule.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Execute Test Dialog */}
      <Dialog open={executeDialog.open} onOpenChange={(open) => {
        if (!open) closeExecuteDialog();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Spustiť test automatizácie</DialogTitle>
            <DialogDescription>
              {executeResult 
                ? "Výsledok spustenia pravidla" 
                : `Vyberte deal, na ktorom chcete otestovať pravidlo "${executeDialog.rule?.name}"`
              }
            </DialogDescription>
          </DialogHeader>
          
          {executeResult ? (
            <div className="space-y-4 py-4">
              <div className={`p-4 rounded-lg border ${executeResult.success ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {executeResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                  <span className={`font-medium ${executeResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {executeResult.success ? "Úspešne vykonané" : "Chyba"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{executeResult.details}</p>
                {executeResult.success && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Akcia: {getActionLabel(executeResult.action)}
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={closeExecuteDialog}>
                  Zavrieť
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Vyberte deal</Label>
                  <Select value={selectedDealId} onValueChange={setSelectedDealId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte deal na testovanie" />
                    </SelectTrigger>
                    <SelectContent>
                      {allDeals.map((deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.title} - {deal.customerName || "Bez zákazníka"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {allDeals.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nie sú k dispozícii žiadne dealy. Najprv vytvorte deal.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeExecuteDialog}>
                  Zrušiť
                </Button>
                <Button
                  onClick={() => {
                    if (executeDialog.rule && selectedDealId) {
                      executeMutation.mutate({ ruleId: executeDialog.rule.id, dealId: selectedDealId });
                    }
                  }}
                  disabled={!selectedDealId || executeMutation.isPending}
                >
                  {executeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Play className="h-4 w-4 mr-2" />
                  Spustiť
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PipelinePage() {
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "forecast" | "archive" | "reports" | "automations">("kanban");
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [newDealStageId, setNewDealStageId] = useState<string | null>(null);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isNewActivityOpen, setIsNewActivityOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isEditDealOpen, setIsEditDealOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [editPipelineCountries, setEditPipelineCountries] = useState<string[]>([]);
  const [newPipelineCountries, setNewPipelineCountries] = useState<string[]>(["SK"]);
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [stageFormData, setStageFormData] = useState({
    name: "",
    probability: 0,
    rottingDays: null as number | null,
    rottingEnabled: false,
    color: "#3b82f6",
  });
  const [deleteStageConfirm, setDeleteStageConfirm] = useState<{ open: boolean; stage: PipelineStage | null; hasDeals: boolean }>({ open: false, stage: null, hasDeals: false });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const { data: allPipelines, isLoading: pipelinesLoading, refetch: refetchPipelines } = useQuery<Pipeline[]>({
    queryKey: ["/api/pipelines"],
  });

  // Filter pipelines based on selected countries
  const pipelines = useMemo(() => {
    if (!allPipelines) return [];
    if (selectedCountries.length === 0) return allPipelines;
    
    return allPipelines.filter(pipeline => {
      // If pipeline has no country codes, show it to everyone
      if (!pipeline.countryCodes || pipeline.countryCodes.length === 0) return true;
      // Check if any of the pipeline's countries match selected countries
      return pipeline.countryCodes.some(code => selectedCountries.includes(code as any));
    });
  }, [allPipelines, selectedCountries]);

  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !activePipelineId) {
      setActivePipelineId(pipelines[0].id);
    }
  }, [pipelines, activePipelineId]);

  // Reset active pipeline if it's no longer in filtered list
  useEffect(() => {
    if (activePipelineId && pipelines.length > 0 && !pipelines.find(p => p.id === activePipelineId)) {
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

  const { data: billingDetails = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details"],
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

  const updatePipelineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description?: string; countryCodes: string[] } }) => {
      return apiRequest("PATCH", `/api/pipelines/${id}`, data);
    },
    onSuccess: () => {
      refetchPipelines();
      setEditingPipeline(null);
      setEditPipelineCountries([]);
      toast({ title: "Pipeline aktualizovaný" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa aktualizovať pipeline", variant: "destructive" });
    },
  });

  const processWonMutation = useMutation({
    mutationFn: async (dealId: string) => {
      return apiRequest("POST", `/api/deals/${dealId}/process-won`);
    },
    onSuccess: (data, dealId) => {
      refetchKanban();
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ 
        title: "Obchod spracovaný", 
        description: `${data.contractId ? "Zmluva vytvorená. " : ""}${data.invoiceId ? "Faktúra vytvorená." : ""}` 
      });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa spracovať obchod", variant: "destructive" });
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

  const createStageMutation = useMutation({
    mutationFn: async (data: { name: string; probability?: number; rottingDays?: number | null; color?: string }) => {
      if (!activePipelineId) throw new Error("No pipeline selected");
      return apiRequest("POST", `/api/pipelines/${activePipelineId}/stages`, data);
    },
    onSuccess: () => {
      refetchKanban();
      setIsStageDialogOpen(false);
      resetStageForm();
      toast({ title: "Fáza vytvorená" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť fázu", variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; probability?: number; rottingDays?: number | null; color?: string } }) => {
      return apiRequest("PATCH", `/api/stages/${id}`, data);
    },
    onSuccess: () => {
      refetchKanban();
      setIsStageDialogOpen(false);
      setEditingStage(null);
      resetStageForm();
      toast({ title: "Fáza aktualizovaná" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa aktualizovať fázu", variant: "destructive" });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/stages/${id}`);
    },
    onSuccess: () => {
      refetchKanban();
      toast({ title: "Fáza odstránená" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa odstrániť fázu. Fáza môže obsahovať príležitosti.", variant: "destructive" });
    },
  });

  const resetStageForm = () => {
    setStageFormData({
      name: "",
      probability: 0,
      rottingDays: null,
      rottingEnabled: false,
      color: "#3b82f6",
    });
  };

  const openEditStage = (stage: PipelineStage) => {
    setEditingStage(stage);
    setStageFormData({
      name: stage.name,
      probability: stage.probability || 0,
      rottingDays: stage.rottingDays || null,
      rottingEnabled: !!stage.rottingDays,
      color: stage.color || "#3b82f6",
    });
    setIsStageDialogOpen(true);
  };

  const openNewStage = () => {
    setEditingStage(null);
    resetStageForm();
    setIsStageDialogOpen(true);
  };

  const handleStageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: stageFormData.name,
      probability: stageFormData.probability,
      rottingDays: stageFormData.rottingEnabled ? stageFormData.rottingDays : null,
      color: stageFormData.color,
    };
    if (editingStage) {
      updateStageMutation.mutate({ id: editingStage.id, data });
    } else {
      createStageMutation.mutate(data);
    }
  };

  const createDealMutation = useMutation({
    mutationFn: async (data: { 
      title: string; 
      stageId: string; 
      pipelineId: string; 
      value?: string;
      currency?: string;
      source?: string; 
      notes?: string;
      customerId?: string;
      campaignId?: string;
      assignedUserId?: string;
      probability?: number;
      expectedCloseDate?: string;
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

    const stage = kanbanData?.stages.find(s => s.id === newDealStageId);
    const probability = stage?.probability || 0;

    createDealMutation.mutate({
      title: formData.get("title") as string,
      stageId: newDealStageId,
      pipelineId: activePipelineId,
      value: formData.get("value") as string || undefined,
      currency: formData.get("currency") as string || "EUR",
      source: formData.get("source") as string || undefined,
      notes: formData.get("notes") as string || undefined,
      customerId: formData.get("customerId") as string || undefined,
      campaignId: formData.get("campaignId") as string || undefined,
      assignedUserId: formData.get("assignedUserId") as string || undefined,
      expectedCloseDate: formData.get("expectedCloseDate") as string || undefined,
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
        <ToggleGroup 
          type="single" 
          value={viewMode} 
          onValueChange={(val) => val && setViewMode(val as typeof viewMode)}
          className="border rounded-md"
        >
          <ToggleGroupItem value="kanban" aria-label="Kanban" data-testid="view-kanban" className="px-3">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Zoznam" data-testid="view-list" className="px-3">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="forecast" aria-label="Forecast" data-testid="view-forecast" className="px-3">
            <Coins className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="archive" aria-label="Archív" data-testid="view-archive" className="px-3">
            <Archive className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="reports" aria-label="Reporty" data-testid="view-reports" className="px-3">
            <BarChart3 className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="automations" aria-label="Automatizácie" data-testid="view-automations" className="px-3">
            <Zap className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <Button 
          onClick={() => {
            if (kanbanData?.stages[0]) {
              setNewDealStageId(kanbanData.stages[0].id);
              setIsNewDealOpen(true);
            }
          }}
          disabled={!kanbanData?.stages[0]}
          data-testid="button-add-first-deal"
        >
          <Plus className="h-4 w-4 mr-2" />
          Pridať príležitosť
        </Button>

        <div className="flex-1" />

        <Select value={activePipelineId || ""} onValueChange={setActivePipelineId}>
          <SelectTrigger className="w-[200px]" data-testid="select-pipeline">
            <SelectValue placeholder="Vyberte pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsManualOpen(true)}
          data-testid="button-pipeline-manual"
        >
          <FileText className="h-4 w-4 mr-1" />
          Manuál
        </Button>
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

      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === "kanban" && (
          <div className="flex-1 overflow-hidden">
            {kanbanLoading ? (
              <div className="flex items-center justify-center flex-1 h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : kanbanData ? (
              <div className="flex-1 overflow-x-auto p-4 h-full">
                <DndContext
                  sensors={sensors}
                  collisionDetection={pointerWithin}
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
                        onEditStage={openEditStage}
                        onDeleteStage={(stage) => setDeleteStageConfirm({ open: true, stage, hasDeals: stage.deals.length > 0 })}
                      />
                    ))}
                    {activePipelineId && (
                      <div className="flex flex-col min-w-[200px] items-center justify-start pt-4">
                        <Button 
                          variant="outline" 
                          onClick={openNewStage}
                          className="gap-2"
                          data-testid="button-add-stage"
                        >
                          <Plus className="h-4 w-4" />
                          Pridať fázu
                        </Button>
                      </div>
                    )}
                  </div>

                  <DragOverlay>
                    {activeDeal ? <DealCard deal={activeDeal} isDragging customers={customers} users={users} onSelect={handleSelectDeal} /> : null}
                  </DragOverlay>
                </DndContext>
              </div>
            ) : null}
          </div>
        )}

        {viewMode === "list" && (
          <div className="flex-1 overflow-auto p-4">
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left text-sm font-medium">Názov</th>
                    <th className="h-10 px-4 text-right text-sm font-medium">Hodnota</th>
                    <th className="h-10 px-4 text-left text-sm font-medium">Organizácia</th>
                    <th className="h-10 px-4 text-left text-sm font-medium">Kontakt</th>
                    <th className="h-10 px-4 text-left text-sm font-medium">Fáza</th>
                    <th className="h-10 px-4 text-left text-sm font-medium">Vlastník</th>
                  </tr>
                </thead>
                <tbody>
                  {kanbanData?.stages.flatMap(stage => 
                    stage.deals.map(deal => {
                      const customer = deal.customerId ? customers.find(c => c.id === deal.customerId) : null;
                      const user = deal.assignedUserId ? users.find(u => u.id === deal.assignedUserId) : null;
                      return (
                        <tr 
                          key={deal.id} 
                          className="border-b hover:bg-muted/30 cursor-pointer"
                          onClick={() => handleSelectDeal(deal)}
                          data-testid={`list-row-${deal.id}`}
                        >
                          <td className="h-12 px-4 text-sm font-medium">{deal.title}</td>
                          <td className="h-12 px-4 text-sm text-right">
                            {deal.value ? new Intl.NumberFormat("sk-SK", { style: "currency", currency: deal.currency || "EUR" }).format(parseFloat(deal.value)) : "-"}
                          </td>
                          <td className="h-12 px-4 text-sm text-muted-foreground">-</td>
                          <td className="h-12 px-4 text-sm">{customer ? `${customer.firstName} ${customer.lastName}` : "-"}</td>
                          <td className="h-12 px-4">
                            <Badge variant="outline" style={{ borderColor: stage.color || undefined }}>{stage.name}</Badge>
                          </td>
                          <td className="h-12 px-4 text-sm">{user?.fullName || user?.username || "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {(!kanbanData || kanbanData.stages.flatMap(s => s.deals).length === 0) && (
                <div className="p-8 text-center text-muted-foreground">
                  Žiadne príležitosti
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === "forecast" && (
          <div className="flex-1 overflow-auto p-4">
            <div className="flex gap-4 overflow-x-auto">
              {(() => {
                const now = new Date();
                const months = [];
                for (let i = 0; i < 6; i++) {
                  const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
                  months.push(date);
                }
                return months.map((month) => {
                  const monthDeals = kanbanData?.stages.flatMap(s => s.deals).filter(d => {
                    if (!d.expectedCloseDate) return month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear();
                    const closeDate = new Date(d.expectedCloseDate);
                    return closeDate.getMonth() === month.getMonth() && closeDate.getFullYear() === month.getFullYear();
                  }) || [];
                  const totalValue = monthDeals.reduce((sum, d) => sum + (d.value ? parseFloat(d.value) : 0), 0);
                  const weightedValue = monthDeals.reduce((sum, d) => {
                    const prob = d.probability || 0;
                    return sum + (d.value ? parseFloat(d.value) * (prob / 100) : 0);
                  }, 0);
                  
                  return (
                    <div key={month.toISOString()} className="min-w-[300px]">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">{format(month, "MMMM yyyy", { locale: sk })}</h3>
                        <div className="text-right text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            {new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", notation: "compact" }).format(totalValue)}
                          </div>
                          <div className="text-green-600">
                            +{new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(weightedValue)}
                          </div>
                          <div className="font-medium">
                            {new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", notation: "compact" }).format(weightedValue)}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {monthDeals.map(deal => {
                          const customer = deal.customerId ? customers.find(c => c.id === deal.customerId) : null;
                          return (
                            <Card 
                              key={deal.id} 
                              className="cursor-pointer hover-elevate"
                              onClick={() => handleSelectDeal(deal)}
                            >
                              <CardContent className="p-3">
                                <h4 className="font-medium text-sm">{deal.title}</h4>
                                <p className="text-xs text-muted-foreground">{customer ? `${customer.firstName} ${customer.lastName}` : "-"}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <UserIcon className="h-3 w-3" />
                                  <span className="text-sm font-medium">
                                    {deal.value ? new Intl.NumberFormat("sk-SK", { style: "currency", currency: deal.currency || "EUR" }).format(parseFloat(deal.value)) : "-"}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                        {monthDeals.length === 0 && (
                          <div className="text-center text-muted-foreground text-sm py-4">
                            Žiadne príležitosti
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {viewMode === "archive" && (
          <div className="flex-1 overflow-auto p-4">
            <div className="text-center py-12 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Archív príležitostí</h3>
              <p className="text-sm">Tu sa zobrazia uzavreté a zrušené príležitosti</p>
            </div>
          </div>
        )}

        {viewMode === "reports" && (
          <div className="flex-1 overflow-auto p-4">
            {kanbanData && (
              <PipelineReports stages={kanbanData.stages} pipeline={kanbanData.pipeline} />
            )}
          </div>
        )}

        {viewMode === "automations" && activePipelineId && (
          <AutomationsView 
            pipelineId={activePipelineId} 
            stages={kanbanData?.stages || []}
            users={users}
          />
        )}
      </div>

      <Dialog open={isNewDealOpen} onOpenChange={setIsNewDealOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nová príležitosť</DialogTitle>
            <DialogDescription>
              Vyplňte údaje o novej obchodnej príležitosti
            </DialogDescription>
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
              <Label htmlFor="customerId">Kontaktná osoba</Label>
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
                <Label htmlFor="value">Hodnota</Label>
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
                <Label htmlFor="currency">Mena</Label>
                <Select name="currency" defaultValue="EUR">
                  <SelectTrigger data-testid="select-deal-currency">
                    <SelectValue placeholder="EUR" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">Euro (EUR)</SelectItem>
                    <SelectItem value="CZK">Koruna (CZK)</SelectItem>
                    <SelectItem value="HUF">Forint (HUF)</SelectItem>
                    <SelectItem value="RON">Leu (RON)</SelectItem>
                    <SelectItem value="USD">Dolár (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Fáza pipeline</Label>
              {kanbanData && (
                <div className="flex mt-1 gap-0.5">
                  {kanbanData.stages.map((stage, index) => (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setNewDealStageId(stage.id)}
                      className={`flex-1 h-6 rounded transition-colors ${newDealStageId === stage.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      style={{
                        backgroundColor: stage.color || '#3b82f6',
                        opacity: newDealStageId === stage.id ? 1 : 0.4,
                      }}
                      title={stage.name}
                      data-testid={`stage-selector-${stage.id}`}
                    />
                  ))}
                </div>
              )}
              {kanbanData && newDealStageId && (
                <p className="text-xs text-muted-foreground mt-1">
                  {kanbanData.stages.find(s => s.id === newDealStageId)?.name}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="expectedCloseDate">Očakávaný dátum uzavretia</Label>
              <Input 
                id="expectedCloseDate" 
                name="expectedCloseDate" 
                type="date"
                data-testid="input-deal-expected-close"
              />
            </div>

            <div>
              <Label htmlFor="assignedUserId">Vlastník</Label>
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
                Vytvoriť príležitosť
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

              <DealProductsSection 
                dealId={selectedDeal.id} 
                dealStatus={selectedDeal.status}
                onProcessWon={() => processWonMutation.mutate(selectedDeal.id)}
                isProcessing={processWonMutation.isPending}
              />

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

      {/* Manual Dialog */}
      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manuál Pipeline</DialogTitle>
            <DialogDescription>Návod na používanie predajného procesu</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-2">Základné pojmy</h4>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p><strong className="text-foreground">Pipeline</strong> - Predajný proces s definovanými fázami</p>
                <p><strong className="text-foreground">Fáza</strong> - Krok v predajnom procese (napr. Nový kontakt, Stretnutie, Ponuka)</p>
                <p><strong className="text-foreground">Príležitosť</strong> - Konkrétny obchod so zákazníkom</p>
                <p><strong className="text-foreground">Aktivita</strong> - Úloha spojená s príležitosťou (hovor, email, stretnutie)</p>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="font-medium mb-2">Ako začať</h4>
              <div className="text-sm space-y-2 text-muted-foreground">
                <p><strong className="text-foreground">1. Vytvorenie Pipeline</strong> - Kliknite na Nastavenia, zadajte názov a krajiny</p>
                <p><strong className="text-foreground">2. Pridanie príležitosti</strong> - Kliknite na Nová príležitosť, vyplňte údaje</p>
                <p><strong className="text-foreground">3. Kanban tabuľa</strong> - Ťahajte karty medzi fázami, kliknite pre detail</p>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="font-medium mb-2">Produkty a automatizácie</h4>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>V detaile príležitosti môžete pridávať produkty s cenou a množstvom.</p>
                <p>Pre <strong className="text-foreground">vyhraté obchody</strong> s produktmi sa zobrazí tlačidlo na automatické vytvorenie zmluvy a faktúry.</p>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="font-medium mb-2">Tipy pre efektívne používanie</h4>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>1. Pravidelne aktualizujte fázy príležitostí</p>
                <p>2. Zadávajte realistickú pravdepodobnosť pre lepšie prognózy</p>
                <p>3. Používajte aktivity na plánovanie follow-upov</p>
                <p>4. Pridávajte poznámky s dôležitými informáciami</p>
                <p>5. Filtrujte podľa krajiny pre lepší prehľad</p>
              </div>
            </div>
          </div>
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
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingPipeline(pipeline);
                          setEditPipelineCountries(pipeline.countryCodes || []);
                        }}
                        data-testid={`button-edit-pipeline-${pipeline.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
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
                    countryCodes: newPipelineCountries,
                  });
                  (e.target as HTMLFormElement).reset();
                  setNewPipelineCountries(["SK"]);
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
                <div>
                  <Label>Krajiny</Label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {COUNTRIES.map((country) => (
                      <Button
                        key={country.code}
                        type="button"
                        size="sm"
                        variant={newPipelineCountries.includes(country.code) ? "default" : "outline"}
                        onClick={() => {
                          if (newPipelineCountries.includes(country.code)) {
                            setNewPipelineCountries(newPipelineCountries.filter(c => c !== country.code));
                          } else {
                            setNewPipelineCountries([...newPipelineCountries, country.code]);
                          }
                        }}
                        data-testid={`button-country-${country.code}`}
                      >
                        {country.code}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button type="submit" disabled={createPipelineMutation.isPending || newPipelineCountries.length === 0}>
                  {createPipelineMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Vytvoriť pipeline
                </Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Stage Confirmation Dialog */}
      <AlertDialog open={deleteStageConfirm.open} onOpenChange={(open) => !open && setDeleteStageConfirm({ open: false, stage: null, hasDeals: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteStageConfirm.hasDeals ? "Nie je možné odstrániť fázu" : "Odstrániť fázu?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteStageConfirm.hasDeals 
                ? `Fáza "${deleteStageConfirm.stage?.name}" obsahuje príležitosti a nemôže byť odstránená. Najprv presuňte alebo odstráňte príležitosti.`
                : `Naozaj chcete odstrániť fázu "${deleteStageConfirm.stage?.name}"? Táto akcia je nevratná.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            {!deleteStageConfirm.hasDeals && (
              <AlertDialogAction 
                onClick={() => {
                  if (deleteStageConfirm.stage) {
                    deleteStageMutation.mutate(deleteStageConfirm.stage.id);
                  }
                  setDeleteStageConfirm({ open: false, stage: null, hasDeals: false });
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Odstrániť
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stage Create/Edit Dialog */}
      <Dialog open={isStageDialogOpen} onOpenChange={(open) => { if (!open) { setIsStageDialogOpen(false); setEditingStage(null); resetStageForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStage ? "Upraviť fázu" : "Nová fáza"}</DialogTitle>
            <DialogDescription>
              {editingStage ? "Upravte nastavenia fázy" : "Pridajte novú fázu do predajného procesu"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStageSubmit} className="space-y-4">
            <div>
              <Label htmlFor="stageName">Názov *</Label>
              <Input 
                id="stageName"
                value={stageFormData.name}
                onChange={(e) => setStageFormData({ ...stageFormData, name: e.target.value })}
                placeholder="Napr. Kvalifikácia"
                required
                data-testid="input-stage-name"
              />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="stageProbability">Pravdepodobnosť výhry (%)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]">
                    <p>Predvolená pravdepodobnosť výhry pre príležitosti v tejto fáze. Používa sa na projekciu budúcich príjmov.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input 
                id="stageProbability"
                type="number"
                min="0"
                max="100"
                value={stageFormData.probability}
                onChange={(e) => setStageFormData({ ...stageFormData, probability: parseInt(e.target.value) || 0 })}
                data-testid="input-stage-probability"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="rottingEnabled"
                  checked={stageFormData.rottingEnabled}
                  onCheckedChange={(checked) => setStageFormData({ ...stageFormData, rottingEnabled: checked, rottingDays: checked ? (stageFormData.rottingDays || 14) : null })}
                  data-testid="switch-rotting-enabled"
                />
                <Label htmlFor="rottingEnabled" className="flex items-center gap-2">
                  Rotting upozornenia
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px]">
                      <p>Funkcia rotting vás upozorní na neaktívne príležitosti ich sfarbením na červeno. Nastavte počet dní po ktorých sa príležitosť považuje za "hnilobnú".</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
              </div>
              {stageFormData.rottingEnabled && (
                <div>
                  <Label htmlFor="rottingDays">Počet dní do rotting</Label>
                  <Input 
                    id="rottingDays"
                    type="number"
                    min="1"
                    value={stageFormData.rottingDays || ""}
                    onChange={(e) => setStageFormData({ ...stageFormData, rottingDays: parseInt(e.target.value) || null })}
                    placeholder="14"
                    data-testid="input-rotting-days"
                  />
                </div>
              )}
            </div>
            
            <div>
              <Label htmlFor="stageColor">Farba</Label>
              <div className="flex gap-2 mt-1">
                {["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${stageFormData.color === color ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setStageFormData({ ...stageFormData, color })}
                    data-testid={`button-color-${color}`}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => { setIsStageDialogOpen(false); setEditingStage(null); resetStageForm(); }}>
                Zrušiť
              </Button>
              <Button 
                type="submit" 
                disabled={createStageMutation.isPending || updateStageMutation.isPending || !stageFormData.name}
              >
                {(createStageMutation.isPending || updateStageMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingStage ? "Uložiť" : "Vytvoriť"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Pipeline Dialog */}
      <Dialog open={!!editingPipeline} onOpenChange={(open) => { if (!open) { setEditingPipeline(null); setEditPipelineCountries([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upraviť predajný proces</DialogTitle>
          </DialogHeader>
          {editingPipeline && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updatePipelineMutation.mutate({
                  id: editingPipeline.id,
                  data: {
                    name: formData.get("editPipelineName") as string,
                    description: formData.get("editPipelineDescription") as string || undefined,
                    countryCodes: editPipelineCountries.length > 0 ? editPipelineCountries : ["SK"],
                  },
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="editPipelineName">Názov *</Label>
                <Input 
                  id="editPipelineName" 
                  name="editPipelineName" 
                  defaultValue={editingPipeline.name}
                  required
                  data-testid="input-edit-pipeline-name"
                />
              </div>
              <div>
                <Label htmlFor="editPipelineDescription">Popis</Label>
                <Input 
                  id="editPipelineDescription" 
                  name="editPipelineDescription" 
                  defaultValue={editingPipeline.description || ""}
                  data-testid="input-edit-pipeline-description"
                />
              </div>
              <div>
                <Label>Krajiny</Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {COUNTRIES.map((country) => (
                    <Button
                      key={country.code}
                      type="button"
                      size="sm"
                      variant={editPipelineCountries.includes(country.code) ? "default" : "outline"}
                      onClick={() => {
                        if (editPipelineCountries.includes(country.code)) {
                          setEditPipelineCountries(editPipelineCountries.filter(c => c !== country.code));
                        } else {
                          setEditPipelineCountries([...editPipelineCountries, country.code]);
                        }
                      }}
                      data-testid={`button-edit-country-${country.code}`}
                    >
                      {country.code}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditingPipeline(null)}>
                  Zrušiť
                </Button>
                <Button type="submit" disabled={updatePipelineMutation.isPending || editPipelineCountries.length === 0}>
                  {updatePipelineMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Uložiť
                </Button>
              </div>
            </form>
          )}
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
