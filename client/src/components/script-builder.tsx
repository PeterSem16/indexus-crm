import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  GripVertical,
  Copy,
  ChevronUp,
  ChevronDown,
  Type,
  AlignLeft,
  ListOrdered,
  CheckSquare,
  CircleDot,
  TextCursor,
  FileText,
  Minus,
  AlertCircle,
  CheckCircle,
  XCircle,
  Target,
  Save,
  Eye,
  EyeOff,
  Variable,
  MousePointerClick,
  Phone,
  Mail,
  CalendarPlus,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { OperatorScript, ScriptStep, ScriptElement, ScriptElementType } from "@shared/schema";
import { useI18n } from "@/i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SCRIPT_VARIABLES = [
  { key: "{{customer.firstName}}", label: "Meno", category: "customer" },
  { key: "{{customer.lastName}}", label: "Priezvisko", category: "customer" },
  { key: "{{customer.fullName}}", label: "Celé meno", category: "customer" },
  { key: "{{customer.greeting}}", label: "Oslovenie", category: "customer" },
  { key: "{{customer.titleBefore}}", label: "Titul pred", category: "customer" },
  { key: "{{customer.titleAfter}}", label: "Titul za", category: "customer" },
  { key: "{{customer.email}}", label: "Email", category: "customer" },
  { key: "{{customer.phone}}", label: "Telefón", category: "customer" },
  { key: "{{customer.address}}", label: "Adresa", category: "customer" },
  { key: "{{customer.city}}", label: "Mesto", category: "customer" },
  { key: "{{customer.postalCode}}", label: "PSČ", category: "customer" },
  { key: "{{customer.country}}", label: "Krajina", category: "customer" },
  { key: "{{date.today}}", label: "Dnešný dátum", category: "system" },
  { key: "{{agent.name}}", label: "Meno agenta", category: "system" },
  { key: "{{campaign.name}}", label: "Názov kampane", category: "system" },
];

interface SortableStepProps {
  step: ScriptStep;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  labels: { untitled: string; element: string; elements: string; endStep: string };
}

function SortableStep({ step, isSelected, onSelect, onDelete, onDuplicate, labels }: SortableStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
        isSelected ? "border-primary bg-accent" : "border-border hover-elevate"
      }`}
      onClick={onSelect}
      data-testid={`step-item-${step.id}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{step.title || labels.untitled}</p>
        <p className="text-xs text-muted-foreground truncate">
          {step.elements.length} {step.elements.length === 1 ? labels.element : labels.elements}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {step.isEndStep && (
          <Badge variant="outline" className="text-xs">{labels.endStep}</Badge>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          data-testid={`button-duplicate-step-${step.id}`}
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          data-testid={`button-delete-step-${step.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

interface SortableElementProps {
  element: ScriptElement;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  labels: { required: string };
  elementTypeConfig: Record<ScriptElementType, { icon: typeof Type; label: string; description: string }>;
}

function SortableElement({ 
  element, 
  isSelected, 
  onSelect, 
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  labels,
  elementTypeConfig,
}: SortableElementProps) {
  const config = elementTypeConfig[element.type];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
        isSelected ? "border-primary bg-accent" : "border-border hover-elevate"
      }`}
      onClick={onSelect}
      data-testid={`element-item-${element.id}`}
    >
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{element.label || config.label}</p>
        <p className="text-xs text-muted-foreground truncate">
          {element.content?.slice(0, 50) || config.description}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {element.required && (
          <Badge variant="secondary" className="text-xs">{labels.required}</Badge>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={!canMoveUp}
          data-testid={`button-move-up-${element.id}`}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={!canMoveDown}
          data-testid={`button-move-down-${element.id}`}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          data-testid={`button-delete-element-${element.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

interface ScriptBuilderProps {
  script: OperatorScript | null;
  onChange: (script: OperatorScript) => void;
  onSave?: (script: OperatorScript) => void;
  onPreview?: (script: OperatorScript) => void;
  isSaving?: boolean;
  campaignId?: string;
}

export function ScriptBuilder({ script, onChange, onSave, onPreview, isSaving, campaignId }: ScriptBuilderProps) {
  const { t } = useI18n();
  const sb = t.campaigns.detail.scriptBuilderUI;

  const { data: allEmailTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/message-templates", "email-active"],
    queryFn: async () => {
      const res = await fetch("/api/message-templates?type=email&isActive=true", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: templateCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/template-categories"],
  });

  const { data: campaignDispositions = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    queryFn: async () => {
      if (!campaignId) return [];
      const res = await fetch(`/api/campaigns/${campaignId}/dispositions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!campaignId,
  });

  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>("__all__");

  const filteredEmailTemplates = useMemo(() => {
    if (templateCategoryFilter === "__all__") return allEmailTemplates;
    return allEmailTemplates.filter((t: any) => t.categoryId === templateCategoryFilter);
  }, [allEmailTemplates, templateCategoryFilter]);

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isAddElementOpen, setIsAddElementOpen] = useState(false);

  const elementTypeConfig: Record<ScriptElementType, { icon: typeof Type; label: string; description: string }> = {
    heading: { icon: Type, label: sb.heading, description: sb.headingDesc },
    paragraph: { icon: AlignLeft, label: sb.paragraph, description: sb.paragraphDesc },
    select: { icon: ListOrdered, label: sb.selectEl, description: sb.selectDesc },
    multiselect: { icon: ListOrdered, label: sb.multiselect, description: sb.multiselectDesc },
    checkbox: { icon: CheckSquare, label: sb.checkbox, description: sb.checkboxDesc },
    checkboxGroup: { icon: CheckSquare, label: sb.checkboxGroup, description: sb.checkboxGroupDesc },
    radio: { icon: CircleDot, label: sb.radio, description: sb.radioDesc },
    textInput: { icon: TextCursor, label: sb.textInput, description: sb.textInputDesc },
    textarea: { icon: FileText, label: sb.textarea, description: sb.textareaDesc },
    divider: { icon: Minus, label: sb.divider, description: sb.dividerDesc },
    note: { icon: AlertCircle, label: sb.note, description: sb.noteDesc },
    outcome: { icon: Target, label: sb.outcome, description: sb.outcomeDesc },
    action_button: { icon: MousePointerClick, label: sb.actionButton, description: sb.actionButtonDesc },
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const currentScript: OperatorScript = script || {
    version: 1,
    steps: [],
  };

  const selectedStep = currentScript.steps.find(s => s.id === selectedStepId);
  const selectedElement = selectedStep?.elements.find(e => e.id === selectedElementId);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const updateScript = useCallback((updates: Partial<OperatorScript>) => {
    onChange({ ...currentScript, ...updates });
  }, [currentScript, onChange]);

  const addStep = useCallback(() => {
    const newStep: ScriptStep = {
      id: generateId(),
      title: `${sb.addStep} ${currentScript.steps.length + 1}`,
      elements: [],
      isEndStep: false,
    };
    updateScript({ steps: [...currentScript.steps, newStep] });
    setSelectedStepId(newStep.id);
    setSelectedElementId(null);
  }, [currentScript.steps, updateScript, sb.addStep]);

  const updateStep = useCallback((stepId: string, updates: Partial<ScriptStep>) => {
    updateScript({
      steps: currentScript.steps.map(s => 
        s.id === stepId ? { ...s, ...updates } : s
      ),
    });
  }, [currentScript.steps, updateScript]);

  const deleteStep = useCallback((stepId: string) => {
    updateScript({ 
      steps: currentScript.steps.filter(s => s.id !== stepId),
      startStepId: currentScript.startStepId === stepId ? undefined : currentScript.startStepId,
    });
    if (selectedStepId === stepId) {
      setSelectedStepId(null);
      setSelectedElementId(null);
    }
  }, [currentScript.steps, currentScript.startStepId, selectedStepId, updateScript]);

  const duplicateStep = useCallback((stepId: string) => {
    const step = currentScript.steps.find(s => s.id === stepId);
    if (!step) return;
    const newStep: ScriptStep = {
      ...step,
      id: generateId(),
      title: `${step.title} (${sb.copy})`,
      elements: step.elements.map(e => ({ ...e, id: generateId() })),
    };
    const index = currentScript.steps.findIndex(s => s.id === stepId);
    const newSteps = [...currentScript.steps];
    newSteps.splice(index + 1, 0, newStep);
    updateScript({ steps: newSteps });
  }, [currentScript.steps, updateScript]);

  const addElement = useCallback((type: ScriptElementType) => {
    if (!selectedStepId) return;
    const config = elementTypeConfig[type];
    const newElement: ScriptElement = {
      id: generateId(),
      type,
      label: config.label,
      required: false,
      content: type === "paragraph" || type === "heading" || type === "note" || type === "action_button" ? "" : undefined,
      options: ["select", "multiselect", "radio", "checkboxGroup", "outcome"].includes(type)
        ? [{ value: "option1", label: `${sb.options} 1` }]
        : undefined,
      ...(type === "action_button" ? { action: "openPhone", actionLabel: "Zavolať", actionIcon: "phone", variant: "primary" } : {}),
    };
    updateStep(selectedStepId, {
      elements: [...(selectedStep?.elements || []), newElement],
    });
    setSelectedElementId(newElement.id);
    setIsAddElementOpen(false);
  }, [selectedStepId, selectedStep, updateStep, sb.options]);

  const updateElement = useCallback((elementId: string, updates: Partial<ScriptElement>) => {
    if (!selectedStepId || !selectedStep) return;
    updateStep(selectedStepId, {
      elements: selectedStep.elements.map(e =>
        e.id === elementId ? { ...e, ...updates } : e
      ),
    });
  }, [selectedStepId, selectedStep, updateStep]);

  const deleteElement = useCallback((elementId: string) => {
    if (!selectedStepId || !selectedStep) return;
    updateStep(selectedStepId, {
      elements: selectedStep.elements.filter(e => e.id !== elementId),
    });
    if (selectedElementId === elementId) {
      setSelectedElementId(null);
    }
  }, [selectedStepId, selectedStep, selectedElementId, updateStep]);

  const moveElement = useCallback((elementId: string, direction: "up" | "down") => {
    if (!selectedStepId || !selectedStep) return;
    const index = selectedStep.elements.findIndex(e => e.id === elementId);
    if (index === -1) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedStep.elements.length) return;
    const newElements = [...selectedStep.elements];
    [newElements[index], newElements[newIndex]] = [newElements[newIndex], newElements[index]];
    updateStep(selectedStepId, { elements: newElements });
  }, [selectedStepId, selectedStep, updateStep]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = currentScript.steps.findIndex(s => s.id === active.id);
    const newIndex = currentScript.steps.findIndex(s => s.id === over.id);
    
    updateScript({
      steps: arrayMove(currentScript.steps, oldIndex, newIndex),
    });
  };

  const addOption = useCallback(() => {
    if (!selectedElement || !selectedElement.options) return;
    const newOptions = [
      ...selectedElement.options,
      { value: `option${selectedElement.options.length + 1}`, label: `${sb.options} ${selectedElement.options.length + 1}` }
    ];
    updateElement(selectedElement.id, { options: newOptions });
  }, [selectedElement, updateElement, sb.options]);

  const updateOption = useCallback((index: number, updates: { value?: string; label?: string; nextStepId?: string; dispositionCode?: string }) => {
    if (!selectedElement || !selectedElement.options) return;
    const newOptions = selectedElement.options.map((opt, i) => 
      i === index ? { ...opt, ...updates } : opt
    );
    updateElement(selectedElement.id, { options: newOptions });
  }, [selectedElement, updateElement]);

  const deleteOption = useCallback((index: number) => {
    if (!selectedElement || !selectedElement.options) return;
    const newOptions = selectedElement.options.filter((_, i) => i !== index);
    updateElement(selectedElement.id, { options: newOptions });
  }, [selectedElement, updateElement]);

  const stepLabels = { untitled: sb.untitled, element: sb.element, elements: sb.elements, endStep: sb.endStep };
  const elementLabels = { required: sb.required };
  const [showPreview, setShowPreview] = useState(false);

  const renderPreviewElement = useCallback((element: ScriptElement) => {
    switch (element.type) {
      case "heading":
        return (
          <div className={`font-bold ${element.size === "lg" ? "text-xl" : element.size === "sm" ? "text-base" : "text-lg"}`}>
            {element.content || element.label}
          </div>
        );
      case "paragraph":
        return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{element.content || element.label}</p>;
      case "divider":
        return <Separator />;
      case "note": {
        const noteStyles: Record<string, string> = {
          info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-300",
          warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-300",
          success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-300",
          error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-300",
        };
        const noteIcons: Record<string, any> = { info: AlertCircle, warning: AlertCircle, success: CheckCircle, error: XCircle };
        const NoteIcon = noteIcons[element.variant || "info"] || AlertCircle;
        return (
          <div className={`flex gap-3 p-3 rounded-md border ${noteStyles[element.style || element.variant || "info"] || noteStyles.info}`}>
            <NoteIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm leading-relaxed">{element.content || element.label}</p>
          </div>
        );
      }
      case "select":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{element.label} {element.required && <span className="text-destructive">*</span>}</Label>
            <Select disabled><SelectTrigger><SelectValue placeholder={element.placeholder || "Vyberte..."} /></SelectTrigger></Select>
          </div>
        );
      case "multiselect":
      case "checkboxGroup":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{element.label} {element.required && <span className="text-destructive">*</span>}</Label>
            <div className="space-y-1">
              {(element.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case "radio":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{element.label} {element.required && <span className="text-destructive">*</span>}</Label>
            <div className="space-y-1">
              {(element.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CircleDot className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">{element.label} {element.required && <span className="text-destructive">*</span>}</Label>
          </div>
        );
      case "textInput":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{element.label} {element.required && <span className="text-destructive">*</span>}</Label>
            <Input disabled placeholder={element.placeholder || element.label} />
          </div>
        );
      case "textarea":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{element.label} {element.required && <span className="text-destructive">*</span>}</Label>
            <Textarea disabled placeholder={element.placeholder || element.label} rows={3} />
          </div>
        );
      case "outcome":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{element.label} {element.required && <span className="text-destructive">*</span>}</Label>
            <div className="flex flex-wrap gap-2">
              {(element.options || []).map((opt, i) => (
                <Button key={i} variant="outline" size="sm" disabled>{opt.label}</Button>
              ))}
            </div>
          </div>
        );
      case "action_button": {
        const iconMap: Record<string, any> = { mail: Mail, phone: Phone, calendar: CalendarPlus, file: FileText };
        const ActionIcon = iconMap[element.actionIcon || ""] || null;
        const variantMap: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
          primary: "default", secondary: "secondary", outline: "outline", destructive: "destructive",
        };
        const btnVariant = variantMap[element.variant || ""] || "default";
        const linkedTemplate = element.emailTemplateId ? allEmailTemplates.find((t: any) => t.id === element.emailTemplateId) : null;
        return (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-2">
              {element.content && <p className="text-sm text-foreground leading-relaxed">{element.content}</p>}
              <Button className="w-full gap-2" variant={btnVariant} disabled data-testid={`preview-btn-${element.id}`}>
                {ActionIcon && <ActionIcon className="h-4 w-4" />}
                {element.actionLabel || element.label || "Vykonať akciu"}
              </Button>
              {linkedTemplate && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span>Šablóna: <span className="font-medium text-foreground">{linkedTemplate.name}</span></span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      }
      default:
        return <div className="text-sm text-muted-foreground">{element.label}</div>;
    }
  }, [allEmailTemplates]);

  return (
    <div className="flex h-full gap-4" data-testid="script-builder">
      <Card className="w-64 flex-shrink-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">{sb.steps}</CardTitle>
            <Button size="icon" variant="ghost" onClick={addStep} data-testid="button-add-step">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[400px]">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={currentScript.steps.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {currentScript.steps.map(step => (
                    <SortableStep
                      key={step.id}
                      step={step}
                      isSelected={selectedStepId === step.id}
                      onSelect={() => { setSelectedStepId(step.id); setSelectedElementId(null); }}
                      onDelete={() => deleteStep(step.id)}
                      onDuplicate={() => duplicateStep(step.id)}
                      labels={stepLabels}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {currentScript.steps.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{sb.selectStepOrCreate}</p>
                <Button variant="ghost" onClick={addStep} className="mt-2">
                  {sb.addStep}
                </Button>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">
              {selectedStep ? selectedStep.title : sb.selectStep}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedStep && (
                <Button size="sm" variant="outline" onClick={() => setIsAddElementOpen(true)} data-testid="button-add-element">
                  <Plus className="h-4 w-4 mr-1" /> {sb.addElement}
                </Button>
              )}
              {selectedStep && (
                <Button size="sm" variant={showPreview ? "default" : "outline"} onClick={() => setShowPreview(!showPreview)} data-testid="button-toggle-preview">
                  {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {sb.preview}
                </Button>
              )}
              {onSave && (
                <Button size="sm" onClick={() => onSave(currentScript)} disabled={isSaving} data-testid="button-save-script">
                  <Save className="h-4 w-4 mr-1" /> {sb.save}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedStep ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="step-title">{sb.stepTitle}</Label>
                  <Input
                    id="step-title"
                    value={selectedStep.title}
                    onChange={(e) => updateStep(selectedStep.id, { title: e.target.value })}
                    data-testid="input-step-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step-next">{sb.nextStep}</Label>
                  <Select
                    value={selectedStep.nextStepId || "_auto_"}
                    onValueChange={(v) => updateStep(selectedStep.id, { nextStepId: v === "_auto_" ? undefined : v })}
                  >
                    <SelectTrigger id="step-next" data-testid="select-next-step">
                      <SelectValue placeholder={sb.autoNext} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_auto_">{sb.autoNext}</SelectItem>
                      {currentScript.steps
                        .filter(s => s.id !== selectedStep.id)
                        .map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="step-description">{sb.stepDescription}</Label>
                <Textarea
                  id="step-description"
                  value={selectedStep.description || ""}
                  onChange={(e) => updateStep(selectedStep.id, { description: e.target.value })}
                  placeholder={sb.descriptionPlaceholder}
                  rows={2}
                  data-testid="textarea-step-description"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="step-end"
                  checked={selectedStep.isEndStep || false}
                  onCheckedChange={(c) => updateStep(selectedStep.id, { isEndStep: c })}
                  data-testid="switch-end-step"
                />
                <Label htmlFor="step-end">{sb.finalStep}</Label>
              </div>
              
              <Separator />
              
              {showPreview ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <Label className="text-primary font-semibold">{sb.preview}</Label>
                  </div>
                  <Card className="border-primary/20 bg-muted/30">
                    <CardContent className="p-4">
                      <ScrollArea className="h-[250px]">
                        <div className="space-y-4">
                          {selectedStep.description && (
                            <p className="text-sm text-muted-foreground italic">{selectedStep.description}</p>
                          )}
                          {selectedStep.elements.map((element) => (
                            <div key={element.id}>{renderPreviewElement(element)}</div>
                          ))}
                          {selectedStep.elements.length === 0 && (
                            <div className="text-center py-4 text-muted-foreground text-sm">{sb.addElementsToStep}</div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{sb.stepElements}</Label>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {selectedStep.elements.map((element, index) => (
                        <SortableElement
                          key={element.id}
                          element={element}
                          isSelected={selectedElementId === element.id}
                          onSelect={() => setSelectedElementId(element.id)}
                          onDelete={() => deleteElement(element.id)}
                          onMoveUp={() => moveElement(element.id, "up")}
                          onMoveDown={() => moveElement(element.id, "down")}
                          canMoveUp={index > 0}
                          canMoveDown={index < selectedStep.elements.length - 1}
                          labels={elementLabels}
                          elementTypeConfig={elementTypeConfig}
                        />
                      ))}
                      {selectedStep.elements.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          {sb.addElementsToStep}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>{sb.selectStepOrCreate}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-80 flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {selectedElement ? `${sb.editElement}: ${elementTypeConfig[selectedElement.type].label}` : sb.elementProperties}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedElement ? (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="element-label">{sb.label}</Label>
                  <Input
                    id="element-label"
                    value={selectedElement.label || ""}
                    onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
                    data-testid="input-element-label"
                  />
                </div>

                {["paragraph", "heading", "note"].includes(selectedElement.type) && (
                  <div className="space-y-2">
                    <Label htmlFor="element-content">{sb.content}</Label>
                    <Textarea
                      id="element-content"
                      value={selectedElement.content || ""}
                      onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                      rows={4}
                      placeholder="Text... Použite premenné ako {{customer.firstName}}"
                      data-testid="textarea-element-content"
                    />
                    <div className="rounded-md border bg-muted/30 p-2">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Variable className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Vložiť premennú</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {SCRIPT_VARIABLES.map((v) => (
                          <Tooltip key={v.key}>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-[10px] h-5 px-1.5 font-mono"
                                onClick={() => {
                                  const el = document.getElementById("element-content") as HTMLTextAreaElement;
                                  if (el) {
                                    const start = el.selectionStart;
                                    const end = el.selectionEnd;
                                    const current = selectedElement.content || "";
                                    const newContent = current.slice(0, start) + v.key + current.slice(end);
                                    updateElement(selectedElement.id, { content: newContent });
                                    setTimeout(() => {
                                      el.focus();
                                      el.setSelectionRange(start + v.key.length, start + v.key.length);
                                    }, 50);
                                  } else {
                                    updateElement(selectedElement.id, { content: (selectedElement.content || "") + v.key });
                                  }
                                }}
                                data-testid={`btn-insert-var-${v.key}`}
                              >
                                {v.label}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">{v.key}</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {["textInput", "textarea"].includes(selectedElement.type) && (
                  <div className="space-y-2">
                    <Label htmlFor="element-placeholder">{sb.placeholder}</Label>
                    <Input
                      id="element-placeholder"
                      value={selectedElement.placeholder || ""}
                      onChange={(e) => updateElement(selectedElement.id, { placeholder: e.target.value })}
                      data-testid="input-element-placeholder"
                    />
                  </div>
                )}

                {["select", "multiselect", "radio", "checkboxGroup", "outcome"].includes(selectedElement.type) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{sb.options}</Label>
                      <Button size="sm" variant="ghost" onClick={addOption} data-testid="button-add-option">
                        <Plus className="h-3 w-3 mr-1" /> {sb.add}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {selectedElement.options?.map((option, index) => (
                        <div key={index} className="space-y-1.5 p-2 rounded-md border bg-muted/20">
                          <div className="flex items-center gap-2">
                            <Input
                              value={option.label}
                              onChange={(e) => updateOption(index, { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                              placeholder={sb.optionName}
                              className="flex-1"
                              data-testid={`input-option-${index}`}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteOption(index)}
                              disabled={(selectedElement.options?.length || 0) <= 1}
                              data-testid={`button-delete-option-${index}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          {campaignId && campaignDispositions.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Dispozícia:</span>
                              <Select
                                value={option.dispositionCode || "_none_"}
                                onValueChange={(v) => updateOption(index, { dispositionCode: v === "_none_" ? "" : v })}
                              >
                                <SelectTrigger className="h-7 text-xs flex-1" data-testid={`select-disposition-option-${index}`}>
                                  <SelectValue placeholder="Žiadna" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_none_">— Žiadna —</SelectItem>
                                  {campaignDispositions
                                    .filter((d: any) => d.isActive)
                                    .map((d: any) => (
                                      <SelectItem key={d.id} value={d.code}>
                                        {d.parentId ? "  ↳ " : ""}{d.name} ({d.code})
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedElement.type === "note" && (
                  <div className="space-y-2">
                    <Label htmlFor="element-style">{sb.noteStyle}</Label>
                    <Select
                      value={selectedElement.style || "default"}
                      onValueChange={(v) => updateElement(selectedElement.id, { style: v as any })}
                    >
                      <SelectTrigger id="element-style" data-testid="select-element-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">{sb.styleDefault}</SelectItem>
                        <SelectItem value="info">{sb.styleInfo}</SelectItem>
                        <SelectItem value="warning">{sb.styleWarning}</SelectItem>
                        <SelectItem value="success">{sb.styleSuccess}</SelectItem>
                        <SelectItem value="error">{sb.styleError}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedElement.type === "heading" && (
                  <div className="space-y-2">
                    <Label htmlFor="element-size">{sb.headingSize}</Label>
                    <Select
                      value={selectedElement.size || "md"}
                      onValueChange={(v) => updateElement(selectedElement.id, { size: v as any })}
                    >
                      <SelectTrigger id="element-size" data-testid="select-element-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sm">{sb.sizeSmall}</SelectItem>
                        <SelectItem value="md">{sb.sizeMedium}</SelectItem>
                        <SelectItem value="lg">{sb.sizeLarge}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedElement.type === "action_button" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="element-content">{sb.content || "Text"}</Label>
                      <Textarea
                        id="element-content"
                        value={selectedElement.content || ""}
                        onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                        rows={2}
                        placeholder="Popis akcie..."
                        data-testid="textarea-action-content"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{sb.actionType}</Label>
                      <Select
                        value={selectedElement.action || "openPhone"}
                        onValueChange={(v) => updateElement(selectedElement.id, { action: v })}
                      >
                        <SelectTrigger data-testid="select-action-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openPhone"><div className="flex items-center gap-2"><Phone className="h-3 w-3" /> Otvoriť telefón</div></SelectItem>
                          <SelectItem value="makeCall"><div className="flex items-center gap-2"><Phone className="h-3 w-3" /> Zavolať</div></SelectItem>
                          <SelectItem value="openEmail"><div className="flex items-center gap-2"><Mail className="h-3 w-3" /> Otvoriť email</div></SelectItem>
                          <SelectItem value="openDisposition"><div className="flex items-center gap-2"><Target className="h-3 w-3" /> Dispozícia</div></SelectItem>
                          <SelectItem value="openPhoneDisposition"><div className="flex items-center gap-2"><Phone className="h-3 w-3" /> Dispozícia (hovor)</div></SelectItem>
                          <SelectItem value="openEmailDisposition"><div className="flex items-center gap-2"><Mail className="h-3 w-3" /> Dispozícia (email)</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {campaignId && (
                      <div className="space-y-2 border rounded-md p-3 bg-accent/30">
                        <Label className="flex items-center gap-1.5">
                          <Target className="h-3.5 w-3.5 text-primary" />
                          Dispozícia po akcii
                        </Label>
                        {campaignDispositions.length > 0 ? (
                          <>
                            <Select
                              value={selectedElement.dispositionCode || "_none_"}
                              onValueChange={(v) => updateElement(selectedElement.id, { dispositionCode: v === "_none_" ? undefined : v })}
                            >
                              <SelectTrigger data-testid="select-action-disposition" className="h-8 text-xs">
                                <SelectValue placeholder="Žiadna" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none_">— Žiadna —</SelectItem>
                                {campaignDispositions
                                  .filter((d: any) => d.isActive)
                                  .map((d: any) => (
                                    <SelectItem key={d.id} value={d.code}>
                                      {d.parentId ? "  ↳ " : ""}{d.name} ({d.code})
                                      {d.actionType === "callback" && d.callbackOffsetDays ? ` [${d.callbackOffsetDays}d]` : ""}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Automaticky nastaví dispozíciu po kliknutí na tlačidlo.
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Najskôr pridajte dispozície v záložke "Dispozície".
                          </p>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>{sb.actionLabel}</Label>
                      <Input
                        value={selectedElement.actionLabel || ""}
                        onChange={(e) => updateElement(selectedElement.id, { actionLabel: e.target.value })}
                        placeholder="Zavolať / Poslať email..."
                        data-testid="input-action-label"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{sb.actionIcon}</Label>
                      <Select
                        value={selectedElement.actionIcon || "phone"}
                        onValueChange={(v) => updateElement(selectedElement.id, { actionIcon: v })}
                      >
                        <SelectTrigger data-testid="select-action-icon">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phone"><div className="flex items-center gap-2"><Phone className="h-3 w-3" /> Telefón</div></SelectItem>
                          <SelectItem value="mail"><div className="flex items-center gap-2"><Mail className="h-3 w-3" /> Email</div></SelectItem>
                          <SelectItem value="calendar"><div className="flex items-center gap-2"><Target className="h-3 w-3" /> Kalendár</div></SelectItem>
                          <SelectItem value="file"><div className="flex items-center gap-2"><FileText className="h-3 w-3" /> Súbor</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        {sb.buttonStyle}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[250px] text-xs">
                            Vizuálny štýl tlačidla: Primary = plné červené, Secondary = sivé, Outline = s okrajom, Destructive = varovné červené
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Select
                        value={selectedElement.variant || "primary"}
                        onValueChange={(v) => updateElement(selectedElement.id, { variant: v })}
                      >
                        <SelectTrigger data-testid="select-action-variant">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primary — hlavné tlačidlo</SelectItem>
                          <SelectItem value="secondary">Secondary — vedľajšie</SelectItem>
                          <SelectItem value="outline">Outline — len okraj</SelectItem>
                          <SelectItem value="destructive">Destructive — varovné</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedElement.action === "openEmail" && (
                      <div className="space-y-3 border-t pt-3 mt-2">
                        <Label className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                          Email šablóna
                        </Label>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Kategória</Label>
                          <Select
                            value={templateCategoryFilter}
                            onValueChange={(v) => setTemplateCategoryFilter(v)}
                          >
                            <SelectTrigger data-testid="select-template-category" className="h-8 text-xs">
                              <SelectValue placeholder="Všetky kategórie" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">Všetky kategórie</SelectItem>
                              {templateCategories.map((cat: any) => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Šablóna</Label>
                          <Select
                            value={selectedElement.emailTemplateId || "__none__"}
                            onValueChange={(v) => updateElement(selectedElement.id, { emailTemplateId: v === "__none__" ? undefined : v })}
                          >
                            <SelectTrigger data-testid="select-email-template-action" className="h-8 text-xs">
                              <SelectValue placeholder="Bez šablóny" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Bez šablóny (manuálny výber)</SelectItem>
                              {filteredEmailTemplates.map((tmpl: any) => (
                                <SelectItem key={tmpl.id} value={tmpl.id}>
                                  <span className="flex items-center gap-2">
                                    {tmpl.name}
                                    {tmpl.language && <span className="text-xs text-muted-foreground uppercase">({tmpl.language})</span>}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Šablóna sa automaticky načíta keď agent klikne na tlačidlo
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {!["divider", "heading", "paragraph", "action_button"].includes(selectedElement.type) && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="element-required"
                      checked={selectedElement.required || false}
                      onCheckedChange={(c) => updateElement(selectedElement.id, { required: c })}
                      data-testid="switch-element-required"
                    />
                    <Label htmlFor="element-required">{sb.requiredField}</Label>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">{sb.selectElementToEdit}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddElementOpen} onOpenChange={setIsAddElementOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{sb.addElementTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {(Object.keys(elementTypeConfig) as ScriptElementType[]).map((type) => {
              const config = elementTypeConfig[type];
              const Icon = config.icon;
              return (
                <Button
                  key={type}
                  variant="outline"
                  className="h-auto flex-col items-start p-4 gap-2"
                  onClick={() => addElement(type)}
                  data-testid={`button-add-element-${type}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{config.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-left">{config.description}</span>
                </Button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddElementOpen(false)}>
              {sb.cancel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
