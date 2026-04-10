import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  Variable,
  MousePointerClick,
  Phone,
  Mail,
  CalendarPlus,
  Maximize2,
  Minimize2,
  HelpCircle,
  Settings2,
  Bold,
  Italic,
  Underline,
  FlaskConical,
  FolderOpen,
  Download,
  Upload,
  Tag,
  Palette,
  MoreHorizontal,
  Pencil,
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ScriptTemplate } from "@shared/schema";

function getScriptVariables(sb: any) {
  return [
    { key: "{{customer.firstName}}", label: sb.varFirstName, category: "customer" },
    { key: "{{customer.lastName}}", label: sb.varLastName, category: "customer" },
    { key: "{{customer.fullName}}", label: sb.varFullName, category: "customer" },
    { key: "{{customer.greeting}}", label: sb.varGreeting, category: "customer" },
    { key: "{{customer.titleBefore}}", label: sb.varTitleBefore, category: "customer" },
    { key: "{{customer.titleAfter}}", label: sb.varTitleAfter, category: "customer" },
    { key: "{{customer.email}}", label: sb.varEmail, category: "customer" },
    { key: "{{customer.phone}}", label: sb.varPhone, category: "customer" },
    { key: "{{customer.address}}", label: sb.varAddress, category: "customer" },
    { key: "{{customer.city}}", label: sb.varCity, category: "customer" },
    { key: "{{customer.postalCode}}", label: sb.varPostalCode, category: "customer" },
    { key: "{{customer.country}}", label: sb.varCountry, category: "customer" },
    { key: "{{date.today}}", label: sb.varToday, category: "system" },
    { key: "{{agent.name}}", label: sb.varAgentName, category: "system" },
    { key: "{{campaign.name}}", label: sb.varCampaignName, category: "system" },
  ];
}

const TEST_DATA: Record<string, string> = {
  "{{customer.firstName}}": "Jana",
  "{{customer.lastName}}": "Nováková",
  "{{customer.fullName}}": "Jana Nováková",
  "{{customer.greeting}}": "Vážená pani",
  "{{customer.titleBefore}}": "Mgr.",
  "{{customer.titleAfter}}": "",
  "{{customer.email}}": "jana.novakova@email.sk",
  "{{customer.phone}}": "+421 905 123 456",
  "{{customer.address}}": "Hlavná 15",
  "{{customer.city}}": "Bratislava",
  "{{customer.postalCode}}": "811 01",
  "{{customer.country}}": "SK",
  "{{date.today}}": new Date().toLocaleDateString("sk-SK"),
  "{{agent.name}}": "Peter Kováč",
  "{{campaign.name}}": "Cord Blood Premium 2026",
};

function replaceTestData(text: string | undefined): string {
  if (!text) return "";
  return Object.entries(TEST_DATA).reduce((t, [key, val]) => t.replaceAll(key, val), text);
}

interface SortableStepProps {
  step: ScriptStep;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  labels: { delete: string; duplicate: string };
}

function SortableStep({ step, isSelected, onSelect, onDelete, onDuplicate, labels }: SortableStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 p-2 rounded-md border cursor-pointer text-sm transition-colors ${
        isSelected ? "border-primary bg-accent" : "border-border hover-elevate"
      }`}
      onClick={onSelect}
      data-testid={`step-${step.id}`}
    >
      <button className="cursor-grab active:cursor-grabbing p-0.5" {...attributes} {...listeners}>
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <span className="flex-1 truncate font-medium">{step.title}</span>
      {step.isEndStep && <Badge variant="secondary" className="text-[9px] h-4 px-1">END</Badge>}
      <div className="flex items-center gap-0.5">
        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title={labels.duplicate}>
          <Copy className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }} title={labels.delete}>
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
  labels: { delete: string; moveUp: string; moveDown: string };
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
  const Icon = config?.icon || Type;
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer text-sm transition-colors ${
        isSelected ? "border-primary bg-accent" : "border-border hover-elevate"
      }`}
      onClick={onSelect}
      data-testid={`element-${element.id}`}
    >
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 truncate">{element.label || config?.label}</span>
      {element.required && <span className="text-destructive text-xs">*</span>}
      <div className="flex items-center gap-0.5">
        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={!canMoveUp} title={labels.moveUp}>
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={!canMoveDown} title={labels.moveDown}>
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }} title={labels.delete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

type ScriptData = OperatorScript;
type ScriptStepData = ScriptStep;

interface ScriptBuilderProps {
  script: OperatorScript | null;
  onChange: (script: OperatorScript) => void;
  onSave?: (script: OperatorScript) => void;
  onPreview?: (script: OperatorScript) => void;
  isSaving?: boolean;
  campaignId?: string;
}

const TEMPLATE_COLOR_CLASSES: Record<string, string> = {
  gray: "bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300",
  red: "bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300",
  blue: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300",
  green: "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300",
  yellow: "bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300",
  purple: "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300",
  orange: "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300",
};

function getTemplateColors(sb: any) {
  return [
    { value: "gray", label: sb.colorGray, className: TEMPLATE_COLOR_CLASSES.gray },
    { value: "red", label: sb.colorRed, className: TEMPLATE_COLOR_CLASSES.red },
    { value: "blue", label: sb.colorBlue, className: TEMPLATE_COLOR_CLASSES.blue },
    { value: "green", label: sb.colorGreen, className: TEMPLATE_COLOR_CLASSES.green },
    { value: "yellow", label: sb.colorYellow, className: TEMPLATE_COLOR_CLASSES.yellow },
    { value: "purple", label: sb.colorPurple, className: TEMPLATE_COLOR_CLASSES.purple },
    { value: "orange", label: sb.colorOrange, className: TEMPLATE_COLOR_CLASSES.orange },
  ];
}

function getColorClass(color: string) {
  return TEMPLATE_COLOR_CLASSES[color] || TEMPLATE_COLOR_CLASSES.gray;
}

export function ScriptBuilder({ script, onChange, onSave, onPreview, isSaving, campaignId }: ScriptBuilderProps) {
  const { t } = useI18n();
  const sb = t.campaigns.detail.scriptBuilderUI;
  const { toast } = useToast();
  const SCRIPT_VARIABLES = useMemo(() => getScriptVariables(sb), [sb]);
  const TEMPLATE_COLORS = useMemo(() => getTemplateColors(sb), [sb]);

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [showTestData, setShowTestData] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isLoadTemplateOpen, setIsLoadTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateTags, setTemplateTags] = useState("");
  const [templateColor, setTemplateColor] = useState("gray");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const { data: scriptTemplatesList = [] } = useQuery<ScriptTemplate[]>({
    queryKey: ["/api/script-templates"],
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; scriptData: string; tags: string[]; color: string; id?: string }) => {
      if (data.id) {
        const res = await apiRequest("PATCH", `/api/script-templates/${data.id}`, data);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/script-templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/script-templates"] });
      setIsSaveTemplateOpen(false);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateTags("");
      setTemplateColor("gray");
      setEditingTemplateId(null);
      toast({ title: sb.templateSaved, description: sb.templateSavedDesc });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/script-templates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/script-templates"] });
      toast({ title: sb.templateDeleted });
    },
  });

  const elementTypeConfig: Record<ScriptElementType, { icon: typeof Type; label: string; description: string }> = {
    heading: { icon: Type, label: sb.heading, description: sb.headingDesc },
    paragraph: { icon: AlignLeft, label: sb.paragraph, description: sb.paragraphDesc },
    select: { icon: ListOrdered, label: sb.selectEl, description: sb.selectDesc },
    multiselect: { icon: ListOrdered, label: sb.multiselect, description: sb.multiselectDesc },
    checkbox: { icon: CheckSquare, label: sb.checkbox, description: sb.checkboxDesc },
    checkboxGroup: { icon: CheckSquare, label: sb.checkboxGroup, description: sb.checkboxGroupDesc },
    radio: { icon: CircleDot, label: sb.radio, description: sb.radioDesc },
    textInput: { icon: TextCursor, label: sb.textInput, description: sb.textInputDesc },
    textarea: { icon: AlignLeft, label: sb.textareaEl, description: sb.textareaDesc },
    note: { icon: AlertCircle, label: sb.note, description: sb.noteDesc },
    outcome: { icon: Target, label: sb.outcome, description: sb.outcomeDesc },
    divider: { icon: Minus, label: sb.divider, description: sb.dividerDesc },
    action_button: { icon: MousePointerClick, label: sb.actionButton, description: sb.actionButtonDesc },
  };

  const stepLabels = { delete: sb.delete, duplicate: sb.duplicate };
  const elementLabels = { delete: sb.delete, moveUp: sb.moveUp, moveDown: sb.moveDown };

  const currentScript: ScriptData = useMemo(() => {
    return script || { version: 1, steps: [] };
  }, [script]);

  const selectedStep = useMemo(() => {
    return currentScript.steps.find(s => s.id === selectedStepId) || null;
  }, [currentScript, selectedStepId]);

  const selectedElement = selectedStep?.elements.find(e => e.id === selectedElementId);

  useEffect(() => {
    if (selectedElement) {
      setPropertiesOpen(true);
    }
  }, [selectedElementId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateScript = useCallback((updater: (s: ScriptData) => ScriptData) => {
    const updated = updater(currentScript);
    onChange(updated);
  }, [currentScript, onChange]);

  const addStep = useCallback(() => {
    const newStep: ScriptStepData = {
      id: `step_${Date.now()}`,
      title: `Krok ${currentScript.steps.length + 1}`,
      elements: [],
    };
    updateScript(s => ({ ...s, steps: [...s.steps, newStep] }));
    setSelectedStepId(newStep.id);
    setSelectedElementId(null);
  }, [currentScript, updateScript]);

  const deleteStep = useCallback((stepId: string) => {
    updateScript(s => ({ ...s, steps: s.steps.filter(st => st.id !== stepId) }));
    if (selectedStepId === stepId) {
      setSelectedStepId(null);
      setSelectedElementId(null);
    }
  }, [selectedStepId, updateScript]);

  const duplicateStep = useCallback((stepId: string) => {
    const step = currentScript.steps.find(s => s.id === stepId);
    if (!step) return;
    const newStep: ScriptStepData = {
      ...JSON.parse(JSON.stringify(step)),
      id: `step_${Date.now()}`,
      title: `${step.title} (kópia)`,
    };
    newStep.elements = newStep.elements.map((e: ScriptElement) => ({ ...e, id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }));
    updateScript(s => ({ ...s, steps: [...s.steps, newStep] }));
  }, [currentScript, updateScript]);

  const updateStep = useCallback((stepId: string, updates: Partial<ScriptStep>) => {
    updateScript(s => ({
      ...s,
      steps: s.steps.map(st => st.id === stepId ? { ...st, ...updates } : st),
    }));
  }, [updateScript]);

  const addElement = useCallback((type: ScriptElementType) => {
    if (!selectedStepId || !selectedStep) return;
    const newElement: ScriptElement = {
      id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      label: elementTypeConfig[type].label,
      content: type === "paragraph" || type === "heading" || type === "note" || type === "action_button" ? "" : undefined,
      required: false,
      options: ["select", "multiselect", "radio", "checkboxGroup", "outcome"].includes(type) ?
        [{ value: "option1", label: `${sb.options} 1` }, { value: "option2", label: `${sb.options} 2` }] : undefined,
      ...(type === "action_button" ? { action: "openPhone", actionLabel: sb.makeCall, actionIcon: "phone", variant: "primary" } : {}),
    };
    updateStep(selectedStep.id, { elements: [...selectedStep.elements, newElement] });
    setSelectedElementId(newElement.id);
    setIsAddElementOpen(false);
  }, [selectedStepId, selectedStep, updateStep, elementTypeConfig, sb.options]);

  const deleteElement = useCallback((elementId: string) => {
    if (!selectedStepId || !selectedStep) return;
    updateStep(selectedStep.id, { elements: selectedStep.elements.filter(e => e.id !== elementId) });
    if (selectedElementId === elementId) {
      setSelectedElementId(null);
    }
  }, [selectedStepId, selectedStep, selectedElementId, updateStep]);

  const moveElement = useCallback((elementId: string, direction: "up" | "down") => {
    if (!selectedStep) return;
    const idx = selectedStep.elements.findIndex(e => e.id === elementId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= selectedStep.elements.length) return;
    const newElements = [...selectedStep.elements];
    [newElements[idx], newElements[newIdx]] = [newElements[newIdx], newElements[idx]];
    updateStep(selectedStep.id, { elements: newElements });
  }, [selectedStep, updateStep]);

  const updateElement = useCallback((elementId: string, updates: Partial<ScriptElement>) => {
    if (!selectedStep) return;
    updateStep(selectedStep.id, {
      elements: selectedStep.elements.map(e => e.id === elementId ? { ...e, ...updates } : e),
    });
  }, [selectedStep, updateStep]);

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateScript(s => {
      const oldIndex = s.steps.findIndex(st => st.id === active.id);
      const newIndex = s.steps.findIndex(st => st.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return s;
      return { ...s, steps: arrayMove(s.steps, oldIndex, newIndex) };
    });
  }, [updateScript]);

  const td = useCallback((text: string | undefined) => showTestData ? replaceTestData(text) : (text || ""), [showTestData]);

  const renderPreviewElement = useCallback((element: ScriptElement) => {
    switch (element.type) {
      case "heading":
        return (
          <div className={`font-bold ${element.size === "lg" ? "text-xl" : element.size === "sm" ? "text-base" : "text-lg"}`}>
            {td(element.content || element.label)}
          </div>
        );
      case "paragraph":
        return <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap [&_b]:font-bold [&_i]:italic [&_u]:underline" dangerouslySetInnerHTML={{ __html: td(element.content || element.label) }} />;
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
            <p className="text-sm leading-relaxed">{td(element.content || element.label)}</p>
          </div>
        );
      }
      case "select":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{td(element.label)} {element.required && <span className="text-destructive">*</span>}</Label>
            <Select disabled><SelectTrigger><SelectValue placeholder={element.placeholder || sb.selectPlaceholder} /></SelectTrigger></Select>
          </div>
        );
      case "multiselect":
      case "checkboxGroup":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{td(element.label)} {element.required && <span className="text-destructive">*</span>}</Label>
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
            <Label className="text-sm font-medium">{td(element.label)} {element.required && <span className="text-destructive">*</span>}</Label>
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
            <Label className="text-sm">{td(element.label)} {element.required && <span className="text-destructive">*</span>}</Label>
          </div>
        );
      case "textInput":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{td(element.label)} {element.required && <span className="text-destructive">*</span>}</Label>
            <Input disabled placeholder={element.placeholder || element.label} />
          </div>
        );
      case "textarea":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{td(element.label)} {element.required && <span className="text-destructive">*</span>}</Label>
            <Textarea disabled placeholder={element.placeholder || element.label} rows={3} />
          </div>
        );
      case "outcome":
        return (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{td(element.label)} {element.required && <span className="text-destructive">*</span>}</Label>
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
            <CardContent className="p-4 space-y-3">
              {element.content && <p className="text-sm text-foreground leading-relaxed text-center">{td(element.content)}</p>}
              <Button className="w-full gap-2 justify-center" variant={btnVariant} disabled data-testid={`preview-btn-${element.id}`}>
                {ActionIcon && <ActionIcon className="h-4 w-4" />}
                {td(element.actionLabel || element.label || sb.performAction)}
              </Button>
              {linkedTemplate && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span>{sb.templates}: <span className="font-medium text-foreground">{linkedTemplate.name}</span></span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      }
      default:
        return <div className="text-sm text-muted-foreground">{element.label}</div>;
    }
  }, [allEmailTemplates, td]);

  const renderPropertiesContent = () => {
    if (!selectedElement) return null;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="element-label">{sb.label}</Label>
          <Input
            id="element-label"
            value={selectedElement.label || ""}
            onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
            data-testid="input-element-label"
          />
        </div>

        {["heading", "note"].includes(selectedElement.type) && (
          <div className="space-y-2">
            <Label htmlFor="element-content">{sb.content}</Label>
            <Textarea
              id="element-content"
              value={selectedElement.content || ""}
              onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
              rows={4}
              placeholder={`${sb.content}... {{customer.firstName}}`}
              data-testid="textarea-element-content"
            />
            <div className="rounded-md border bg-muted/30 p-2">
              <div className="flex items-center gap-1 mb-1.5">
                <Variable className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{sb.insertVariable}</span>
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

        {selectedElement.type === "paragraph" && (
          <div className="space-y-2">
            <Label>{sb.content}</Label>
            <div className="border rounded-md overflow-hidden">
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button" variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => {
                        const el = document.getElementById("paragraph-editor") as HTMLDivElement;
                        if (el) { el.focus(); document.execCommand("bold"); }
                      }}
                      data-testid="btn-format-bold"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{sb.formatBold}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button" variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => {
                        const el = document.getElementById("paragraph-editor") as HTMLDivElement;
                        if (el) { el.focus(); document.execCommand("italic"); }
                      }}
                      data-testid="btn-format-italic"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{sb.formatItalic}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button" variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => {
                        const el = document.getElementById("paragraph-editor") as HTMLDivElement;
                        if (el) { el.focus(); document.execCommand("underline"); }
                      }}
                      data-testid="btn-format-underline"
                    >
                      <Underline className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{sb.formatUnderline}</TooltipContent>
                </Tooltip>
                <Separator orientation="vertical" className="h-5 mx-1" />
                <div className="flex items-center gap-1 ml-auto">
                  {SCRIPT_VARIABLES.slice(0, 4).map((v) => (
                    <Tooltip key={v.key}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button" variant="outline" size="sm" className="text-[10px] h-5 px-1.5 font-mono"
                          onClick={() => {
                            const el = document.getElementById("paragraph-editor") as HTMLDivElement;
                            if (el) {
                              el.focus();
                              document.execCommand("insertText", false, v.key);
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
              <div
                id="paragraph-editor"
                contentEditable
                className="min-h-[100px] p-3 text-sm outline-none focus:ring-1 focus:ring-primary/30"
                dangerouslySetInnerHTML={{ __html: selectedElement.content || "" }}
                onBlur={(e) => {
                  updateElement(selectedElement.id, { content: e.currentTarget.innerHTML });
                }}
                data-testid="editor-paragraph-content"
              />
            </div>
            <div className="rounded-md border bg-muted/30 p-2">
              <div className="flex items-center gap-1 mb-1.5">
                <Variable className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{sb.allVariables}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {SCRIPT_VARIABLES.map((v) => (
                  <Tooltip key={v.key}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button" variant="outline" size="sm" className="text-[10px] h-5 px-1.5 font-mono"
                        onClick={() => {
                          const el = document.getElementById("paragraph-editor") as HTMLDivElement;
                          if (el) {
                            el.focus();
                            document.execCommand("insertText", false, v.key);
                          }
                        }}
                        data-testid={`btn-insert-var-para-${v.key}`}
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
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{sb.dispositionLabel}</span>
                      <Select
                        value={option.dispositionCode || "_none_"}
                        onValueChange={(v) => updateOption(index, { dispositionCode: v === "_none_" ? "" : v })}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1" data-testid={`select-disposition-option-${index}`}>
                          <SelectValue placeholder={sb.noDisposition} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none_">{sb.noDisposition}</SelectItem>
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
              <Label htmlFor="element-content">{sb.content}</Label>
              <Textarea
                id="element-content"
                value={selectedElement.content || ""}
                onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                rows={2}
                placeholder={sb.actionDescPlaceholder}
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
                  <SelectItem value="openPhone"><div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {sb.openPhone}</div></SelectItem>
                  <SelectItem value="makeCall"><div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {sb.makeCall}</div></SelectItem>
                  <SelectItem value="openEmail"><div className="flex items-center gap-2"><Mail className="h-3 w-3" /> {sb.openEmail}</div></SelectItem>
                  <SelectItem value="openDisposition"><div className="flex items-center gap-2"><Target className="h-3 w-3" /> {sb.dispositionAction}</div></SelectItem>
                  <SelectItem value="openPhoneDisposition"><div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {sb.dispositionCall}</div></SelectItem>
                  <SelectItem value="openEmailDisposition"><div className="flex items-center gap-2"><Mail className="h-3 w-3" /> {sb.dispositionEmail}</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            {campaignId && (
              <div className="space-y-2 border rounded-md p-3 bg-accent/30">
                <Label className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  {sb.dispositionAfterAction}
                </Label>
                {campaignDispositions.length > 0 ? (
                  <>
                    <Select
                      value={selectedElement.dispositionCode || "_none_"}
                      onValueChange={(v) => updateElement(selectedElement.id, { dispositionCode: v === "_none_" ? undefined : v })}
                    >
                      <SelectTrigger data-testid="select-action-disposition" className="h-8 text-xs">
                        <SelectValue placeholder={sb.noDisposition} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">{sb.noDisposition}</SelectItem>
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
                      {sb.dispositionAutoHint}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {sb.dispositionFirstHint}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>{sb.actionLabel}</Label>
              <Input
                value={selectedElement.actionLabel || ""}
                onChange={(e) => updateElement(selectedElement.id, { actionLabel: e.target.value })}
                placeholder={sb.callPlaceholder}
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
                  <SelectItem value="phone"><div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {sb.phoneIcon}</div></SelectItem>
                  <SelectItem value="mail"><div className="flex items-center gap-2"><Mail className="h-3 w-3" /> {sb.emailIcon}</div></SelectItem>
                  <SelectItem value="calendar"><div className="flex items-center gap-2"><Target className="h-3 w-3" /> {sb.calendarIcon}</div></SelectItem>
                  <SelectItem value="file"><div className="flex items-center gap-2"><FileText className="h-3 w-3" /> {sb.fileIcon}</div></SelectItem>
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
                    {sb.primaryStyle} / {sb.secondaryStyle} / {sb.outlineStyle} / {sb.destructiveStyle}
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
                  <SelectItem value="primary">{sb.primaryStyle}</SelectItem>
                  <SelectItem value="secondary">{sb.secondaryStyle}</SelectItem>
                  <SelectItem value="outline">{sb.outlineStyle}</SelectItem>
                  <SelectItem value="destructive">{sb.destructiveStyle}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedElement.action === "openEmail" && (
              <div className="space-y-3 border-t pt-3 mt-2">
                <Label className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  {sb.emailTemplateLabel}
                </Label>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{sb.categoryLabel}</Label>
                  <Select
                    value={templateCategoryFilter}
                    onValueChange={(v) => setTemplateCategoryFilter(v)}
                  >
                    <SelectTrigger data-testid="select-template-category" className="h-8 text-xs">
                      <SelectValue placeholder={sb.allCategories} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{sb.allCategories}</SelectItem>
                      {templateCategories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{sb.templates}</Label>
                  <Select
                    value={selectedElement.emailTemplateId || "__none__"}
                    onValueChange={(v) => updateElement(selectedElement.id, { emailTemplateId: v === "__none__" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-email-template-action" className="h-8 text-xs">
                      <SelectValue placeholder={sb.noTemplateManual} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{sb.noTemplateManual}</SelectItem>
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
                  {sb.templateAutoLoadHint}
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
    );
  };

  const builderContent = (
    <div className={`flex gap-3 ${isFullscreen ? "h-[calc(100vh-60px)]" : "h-[700px]"}`} data-testid="script-builder">
      <div className="w-48 flex-shrink-0 flex flex-col border rounded-lg bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-semibold">{sb.steps}</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addStep} data-testid="button-add-step">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-1.5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={currentScript.steps.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
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
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-xs">{sb.selectStepOrCreate}</p>
              <Button variant="ghost" size="sm" onClick={addStep} className="mt-2 text-xs">
                {sb.addStep}
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col border rounded-lg bg-card min-w-0">
        <div className="flex items-center justify-between px-3 py-2 border-b gap-2">
          <span className="text-xs font-semibold truncate">
            {selectedStep ? selectedStep.title : sb.selectStep}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1 px-2 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary" data-testid="button-template-menu">
                  <FolderOpen className="h-3 w-3" /> {sb.templates}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 z-[9999]">
                <DropdownMenuItem onClick={() => {
                  setTemplateName(currentScript.name || "");
                  setTemplateDescription(currentScript.description || "");
                  setTemplateTags("");
                  setTemplateColor("gray");
                  setEditingTemplateId(null);
                  setIsSaveTemplateOpen(true);
                }}>
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  {sb.saveAsTemplate}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsLoadTemplateOpen(true)}>
                  <Download className="h-3.5 w-3.5 mr-2" />
                  {sb.loadTemplate}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedStep && (
              <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1 px-2" onClick={() => setIsAddElementOpen(true)} data-testid="button-add-element">
                <Plus className="h-3 w-3" /> {sb.addElement}
              </Button>
            )}
            {onSave && (
              <Button size="sm" className="h-6 text-[11px] gap-1 px-2" onClick={() => onSave(currentScript)} disabled={isSaving} data-testid="button-save-script">
                <Save className="h-3 w-3" /> {sb.save}
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {selectedStep ? (
            <>
              <div className="flex-1 border-r overflow-hidden flex flex-col min-w-0">
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-3">
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="step-title" className="text-[10px] text-muted-foreground">{sb.stepTitle}</Label>
                          <Input
                            id="step-title"
                            value={selectedStep.title}
                            onChange={(e) => updateStep(selectedStep.id, { title: e.target.value })}
                            className="h-7 text-xs"
                            data-testid="input-step-title"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="step-next" className="text-[10px] text-muted-foreground">{sb.nextStep}</Label>
                          <Select
                            value={selectedStep.nextStepId || "_auto_"}
                            onValueChange={(v) => updateStep(selectedStep.id, { nextStepId: v === "_auto_" ? undefined : v })}
                          >
                            <SelectTrigger id="step-next" className="h-7 text-xs" data-testid="select-next-step">
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
                      <div className="space-y-1">
                        <Label htmlFor="step-description" className="text-[10px] text-muted-foreground">{sb.stepDescription}</Label>
                        <Textarea
                          id="step-description"
                          value={selectedStep.description || ""}
                          onChange={(e) => updateStep(selectedStep.id, { description: e.target.value })}
                          placeholder={sb.descriptionPlaceholder}
                          className="text-xs min-h-[40px] resize-none"
                          rows={2}
                          data-testid="textarea-step-description"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          id="step-end"
                          checked={selectedStep.isEndStep || false}
                          onCheckedChange={(c) => updateStep(selectedStep.id, { isEndStep: c })}
                          className="scale-75"
                          data-testid="switch-end-step"
                        />
                        <Label htmlFor="step-end" className="text-[10px] whitespace-nowrap">{sb.finalStep}</Label>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">{sb.stepElements}</Label>
                        <span className="text-[10px] text-muted-foreground">{selectedStep.elements.length} {sb.elementsCount}</span>
                      </div>
                      <div className="space-y-1">
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
                          <div className="text-center py-6 text-muted-foreground text-xs border-2 border-dashed rounded-lg">
                            <Plus className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
                            {sb.addElementsToStep}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </ScrollArea>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <div className="px-3 py-2 border-b flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">{sb.preview}</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant={showTestData ? "default" : "ghost"}
                        className="h-6 text-[10px] gap-1 px-2"
                        onClick={() => setShowTestData(!showTestData)}
                        data-testid="button-toggle-test-data"
                      >
                        <FlaskConical className="h-3 w-3" />
                        {showTestData ? sb.testDataOn : sb.testData}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {showTestData ? sb.testDataOffTooltip : sb.testDataOnTooltip}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-dashed border-muted-foreground/30">
                        <span className="text-xs font-semibold text-muted-foreground">{td(selectedStep.title)}</span>
                        <span className="text-[10px] text-muted-foreground/60 italic">{sb.previewNotShownInAgent}</span>
                      </div>
                      {selectedStep.elements.map((element) => (
                        <div key={element.id} className={`transition-all rounded-md ${selectedElementId === element.id ? "ring-2 ring-primary/50 ring-offset-2" : ""}`}>
                          {renderPreviewElement(element)}
                        </div>
                      ))}
                      {selectedStep.elements.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                          {sb.addElementsToStep}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center w-full text-muted-foreground">
              <p className="text-sm">{sb.selectStepOrCreate}</p>
            </div>
          )}
        </div>
      </div>

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

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              {sb.helpTitle}
            </DialogTitle>
            <DialogDescription>
              {sb.helpDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Variable className="h-4 w-4 text-primary" />
                {sb.availableVars}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                {sb.varsHint}
              </p>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{sb.contactSection}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {SCRIPT_VARIABLES.filter(v => v.category === "customer").map((v) => (
                      <Badge key={v.key} variant="secondary" className="text-[10px] font-mono">
                        {v.key} <span className="ml-1 font-sans text-muted-foreground">({v.label})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{sb.systemSection}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {SCRIPT_VARIABLES.filter(v => v.category === "system").map((v) => (
                      <Badge key={v.key} variant="secondary" className="text-[10px] font-mono">
                        {v.key} <span className="ml-1 font-sans text-muted-foreground">({v.label})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-sm mb-2">{sb.guideTitle}</h3>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                <li>{sb.guideSteps}</li>
                <li>{sb.guideHeadings}</li>
                <li>{sb.guideSelect}</li>
                <li>{sb.guideCheckboxes}</li>
                <li>{sb.guideTextFields}</li>
                <li>{sb.guideNotes}</li>
                <li>{sb.guideOutcome}</li>
                <li>{sb.guideActionButtons}</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              {editingTemplateId ? sb.editTemplate : sb.saveAsTemplate}
            </DialogTitle>
            <DialogDescription>
              {sb.saveTemplateDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">{sb.templateNameLabel} *</Label>
              <Input
                id="tpl-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={sb.templateNamePlaceholder}
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">{sb.templateDescLabel}</Label>
              <Textarea
                id="tpl-desc"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder={sb.templateDescPlaceholder}
                rows={2}
                data-testid="textarea-template-desc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-tags" className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                {sb.templateTagsLabel}
              </Label>
              <Input
                id="tpl-tags"
                value={templateTags}
                onChange={(e) => setTemplateTags(e.target.value)}
                placeholder={sb.templateTagsPlaceholder}
                data-testid="input-template-tags"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                {sb.templateColorLabel}
              </Label>
              <div className="flex gap-2 flex-wrap">
                {TEMPLATE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setTemplateColor(c.value)}
                    className={`w-8 h-8 rounded-md border-2 transition-all ${getColorClass(c.value)} ${templateColor === c.value ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"}`}
                    title={c.label}
                    data-testid={`btn-color-${c.value}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveTemplateOpen(false)}>{sb.cancel}</Button>
            <Button
              disabled={!templateName.trim() || saveTemplateMutation.isPending}
              onClick={() => {
                saveTemplateMutation.mutate({
                  name: templateName.trim(),
                  description: templateDescription.trim(),
                  scriptData: JSON.stringify(currentScript),
                  tags: templateTags.split(",").map(t => t.trim()).filter(Boolean),
                  color: templateColor,
                  id: editingTemplateId || undefined,
                });
              }}
              data-testid="button-save-template"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveTemplateMutation.isPending ? sb.savingTemplate : sb.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLoadTemplateOpen} onOpenChange={setIsLoadTemplateOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              {sb.loadTemplate}
            </DialogTitle>
            <DialogDescription>
              {sb.loadTemplateDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {scriptTemplatesList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{sb.noTemplatesYet}</p>
                <p className="text-xs mt-1">{sb.noTemplatesHint}</p>
              </div>
            ) : (
              scriptTemplatesList.map((tpl) => {
                const parsedScript = (() => { try { return JSON.parse(tpl.scriptData); } catch { return null; } })();
                const stepCount = parsedScript?.steps?.length || 0;
                return (
                  <div
                    key={tpl.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer ${getColorClass(tpl.color)}`}
                    onClick={() => {
                      if (parsedScript) {
                        updateScript(() => parsedScript);
                        setSelectedStepId(parsedScript.steps?.[0]?.id || null);
                        setSelectedElementId(null);
                        setIsLoadTemplateOpen(false);
                        toast({ title: sb.templateLoaded, description: `"${tpl.name}" ${sb.templateLoadedDesc}` });
                      }
                    }}
                    data-testid={`template-card-${tpl.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm truncate">{tpl.name}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 flex-shrink-0">
                          {stepCount} {stepCount === 1 ? sb.stepCount1 : sb.stepsCount}
                        </Badge>
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-muted-foreground mb-1.5 line-clamp-2">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {(tpl.tags || []).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                            <Tag className="h-2.5 w-2.5" />
                            {tag}
                          </Badge>
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(tpl.updatedAt).toLocaleDateString("sk-SK")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTemplateName(tpl.name);
                              setTemplateDescription(tpl.description || "");
                              setTemplateTags((tpl.tags || []).join(", "));
                              setTemplateColor(tpl.color);
                              setEditingTemplateId(tpl.id);
                              setIsSaveTemplateOpen(true);
                            }}
                            data-testid={`btn-edit-template-${tpl.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{sb.editElement}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(sb.deleteTemplateConfirm)) {
                                deleteTemplateMutation.mutate(tpl.id);
                              }
                            }}
                            data-testid={`btn-delete-template-${tpl.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{sb.cancel}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[9980] bg-background">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card h-[52px]">
          <span className="text-sm font-semibold">Script Builder</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary" onClick={() => setIsLoadTemplateOpen(true)} data-testid="button-fullscreen-load-template">
              <Download className="h-3.5 w-3.5" />
              {sb.loadTemplate}
            </Button>
            {onSave && (
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onSave(currentScript)} disabled={isSaving} data-testid="button-fullscreen-save">
                <Save className="h-3.5 w-3.5" />
                {sb.save}
              </Button>
            )}
            <Separator orientation="vertical" className="h-5" />
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setIsHelpOpen(true)} data-testid="button-help">
              <HelpCircle className="h-3.5 w-3.5" />
              {sb.helpBtn}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setIsFullscreen(false)} data-testid="button-minimize">
              <Minimize2 className="h-3.5 w-3.5" />
              {sb.minimize}
            </Button>
          </div>
        </div>
        <div className="p-3 h-[calc(100vh-52px)]">
          {builderContent}
        </div>

        <Sheet open={propertiesOpen} onOpenChange={setPropertiesOpen} modal={false}>
          <SheetContent side="right" className="w-[400px] sm:w-[450px] overflow-y-auto z-[9995] shadow-2xl border-l" hideOverlay>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                {sb.editElement}: {selectedElement ? elementTypeConfig[selectedElement.type]?.label : ""}
              </SheetTitle>
              <SheetDescription>
                {selectedElement ? elementTypeConfig[selectedElement.type]?.description : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              {renderPropertiesContent()}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setIsHelpOpen(true)} data-testid="button-help">
          <HelpCircle className="h-3.5 w-3.5" />
          {sb.helpBtn}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setIsFullscreen(true)} data-testid="button-fullscreen">
          <Maximize2 className="h-3.5 w-3.5" />
          {sb.fullscreen}
        </Button>
      </div>
      {builderContent}

      <Sheet open={propertiesOpen} onOpenChange={setPropertiesOpen} modal={false}>
        <SheetContent side="right" className="w-[400px] sm:w-[450px] overflow-y-auto shadow-2xl border-l" hideOverlay>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              {sb.editElement}: {selectedElement ? elementTypeConfig[selectedElement.type]?.label : ""}
            </SheetTitle>
            <SheetDescription>
              {selectedElement ? elementTypeConfig[selectedElement.type]?.description : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {renderPropertiesContent()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
