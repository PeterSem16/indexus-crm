import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, Search, Megaphone, PlayCircle, CheckCircle, Clock, XCircle, ExternalLink, FileText, Calendar, LayoutList, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, BarChart3, TrendingUp, Phone, RefreshCw, Users, Mail, MessageSquare, User, Check, Loader2, Shield, Headphones, X, Download, HelpCircle, BookOpen, Type, AlignLeft, ListOrdered, CircleDot, Target, Square, TextCursorInput, Variable, GripVertical, Copy, ArrowUp, ArrowDown, Mic, Coffee, GitBranch } from "lucide-react";
import { useI18n } from "@/i18n";
import { TranscriptSearchContent } from "@/pages/transcript-search";
import { BreakTypesTab } from "@/components/campaigns/BreakTypesTab";
import { InboundQueuesTab } from "@/components/campaigns/InboundQueuesTab";
import { IvrMessagesTab } from "@/components/campaigns/IvrMessagesTab";
import { IvrMenusTab } from "@/components/campaigns/IvrMenusTab";
import { DidRoutesTab } from "@/components/campaigns/DidRoutesTab";
import { useAuth } from "@/contexts/auth-context";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  defaultActiveTab: z.enum(["phone", "script", "email", "sms"]).optional().default("phone"),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

const CAMPAIGN_TYPES = ["marketing", "sales", "follow_up", "retention", "upsell", "other"] as const;
const CAMPAIGN_CHANNELS = ["phone", "email", "sms", "mixed"] as const;
const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed", "cancelled"] as const;

const SCRIPT_AVAILABLE_VARIABLES = [
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

interface ScriptElementData {
  id: string;
  type: "heading" | "text" | "paragraph" | "select" | "radio" | "outcome" | "textarea" | "checkbox" | "input";
  label?: string;
  content?: string;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string; nextStepId?: string }[];
}

interface ScriptStepData {
  id: string;
  title: string;
  description?: string;
  elements: ScriptElementData[];
  isEndStep?: boolean;
  nextStepId?: string;
}

interface ScriptData {
  version: number;
  name?: string;
  description?: string;
  startStepId?: string;
  steps: ScriptStepData[];
}

function generateId() {
  return `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

function ScriptBuilder({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: any }) {
  const [script, setScript] = useState<ScriptData>(() => {
    try {
      if (value) {
        const parsed = JSON.parse(value);
        if (parsed.steps) return parsed;
      }
    } catch {}
    return { version: 1, steps: [] };
  });
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const lastExternalValue = useRef(value);

  useEffect(() => {
    if (value !== lastExternalValue.current) {
      lastExternalValue.current = value;
      try {
        if (value) {
          const parsed = JSON.parse(value);
          if (parsed.steps) {
            setScript(parsed);
            setActiveStepIndex(0);
            setEditingElementId(null);
            return;
          }
        }
      } catch {}
      setScript({ version: 1, steps: [] });
      setActiveStepIndex(0);
      setEditingElementId(null);
    }
  }, [value]);

  const syncToForm = useCallback((updated: ScriptData) => {
    setScript(updated);
    const newVal = updated.steps.length === 0 ? "" : JSON.stringify(updated);
    lastExternalValue.current = newVal;
    onChange(newVal);
  }, [onChange]);

  const addStep = () => {
    const newStep: ScriptStepData = {
      id: `step_${Date.now()}`,
      title: `Krok ${script.steps.length + 1}`,
      elements: [],
    };
    const updated = { ...script, steps: [...script.steps, newStep] };
    syncToForm(updated);
    setActiveStepIndex(updated.steps.length - 1);
  };

  const removeStep = (idx: number) => {
    const updated = { ...script, steps: script.steps.filter((_, i) => i !== idx) };
    syncToForm(updated);
    if (activeStepIndex >= updated.steps.length) {
      setActiveStepIndex(Math.max(0, updated.steps.length - 1));
    }
  };

  const updateStep = (idx: number, patch: Partial<ScriptStepData>) => {
    const steps = [...script.steps];
    steps[idx] = { ...steps[idx], ...patch };
    syncToForm({ ...script, steps });
  };

  const addElement = (type: ScriptElementData["type"]) => {
    if (script.steps.length === 0) return;
    const step = script.steps[activeStepIndex];
    const newEl: ScriptElementData = {
      id: generateId(),
      type,
      label: type === "heading" ? "Nadpis" : type === "text" ? "" : type === "paragraph" ? "" : type === "select" ? "Výber" : type === "radio" ? "Voľba" : type === "outcome" ? "Výsledok" : type === "textarea" ? "Poznámka" : type === "checkbox" ? "Potvrdenie" : "Vstup",
      content: type === "heading" || type === "text" || type === "paragraph" ? "" : undefined,
      options: ["select", "radio", "outcome"].includes(type)
        ? [{ value: "option1", label: "Možnosť 1" }, { value: "option2", label: "Možnosť 2" }]
        : undefined,
    };
    const elements = [...step.elements, newEl];
    updateStep(activeStepIndex, { elements });
    setEditingElementId(newEl.id);
  };

  const removeElement = (elId: string) => {
    const step = script.steps[activeStepIndex];
    updateStep(activeStepIndex, { elements: step.elements.filter(e => e.id !== elId) });
    if (editingElementId === elId) setEditingElementId(null);
  };

  const updateElement = (elId: string, patch: Partial<ScriptElementData>) => {
    const step = script.steps[activeStepIndex];
    const elements = step.elements.map(e => e.id === elId ? { ...e, ...patch } : e);
    updateStep(activeStepIndex, { elements });
  };

  const moveElement = (elId: string, dir: -1 | 1) => {
    const step = script.steps[activeStepIndex];
    const idx = step.elements.findIndex(e => e.id === elId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= step.elements.length) return;
    const elements = [...step.elements];
    [elements[idx], elements[newIdx]] = [elements[newIdx], elements[idx]];
    updateStep(activeStepIndex, { elements });
  };

  const insertVariable = (elId: string, field: "content" | "label", varKey: string) => {
    const step = script.steps[activeStepIndex];
    const el = step.elements.find(e => e.id === elId);
    if (!el) return;
    updateElement(elId, { [field]: (el[field] || "") + varKey });
  };

  const currentStep = script.steps[activeStepIndex];

  const getElementIcon = (type: string) => {
    switch (type) {
      case "heading": return <Type className="h-3.5 w-3.5" />;
      case "text": return <AlignLeft className="h-3.5 w-3.5" />;
      case "paragraph": return <FileText className="h-3.5 w-3.5" />;
      case "select": return <ListOrdered className="h-3.5 w-3.5" />;
      case "radio": return <CircleDot className="h-3.5 w-3.5" />;
      case "outcome": return <Target className="h-3.5 w-3.5" />;
      case "textarea": return <AlignLeft className="h-3.5 w-3.5" />;
      case "checkbox": return <Square className="h-3.5 w-3.5" />;
      case "input": return <TextCursorInput className="h-3.5 w-3.5" />;
      default: return <FileText className="h-3.5 w-3.5" />;
    }
  };

  const elementTypeLabels: Record<string, string> = {
    heading: "Nadpis",
    text: "Text",
    paragraph: "Odstavec",
    select: "Výber (dropdown)",
    radio: "Voľba (radio)",
    outcome: "Výsledok",
    textarea: "Textové pole",
    checkbox: "Zaškrtávacie pole",
    input: "Vstupné pole",
  };

  return (
    <div className="space-y-3" data-testid="script-builder">
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Variable className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dostupné premenné pre scenár</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {SCRIPT_AVAILABLE_VARIABLES.map((v) => (
            <Badge key={v.key} variant="secondary" className="text-[10px] font-mono cursor-default" title={v.key}>
              {v.key}
              <span className="ml-1 font-sans text-muted-foreground">({v.label})</span>
            </Badge>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Tieto premenné sa v agentskom workspace automaticky nahradia skutočnými údajmi kontaktu.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">Kroky scenára:</span>
        {script.steps.map((step, idx) => (
          <Button
            key={step.id}
            type="button"
            size="sm"
            variant={activeStepIndex === idx ? "default" : "outline"}
            onClick={() => setActiveStepIndex(idx)}
            data-testid={`btn-script-step-${idx}`}
          >
            {step.title || `Krok ${idx + 1}`}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={addStep} data-testid="btn-add-script-step">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Pridať krok
        </Button>
      </div>

      {currentStep && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={currentStep.title}
                onChange={(e) => updateStep(activeStepIndex, { title: e.target.value })}
                placeholder="Názov kroku"
                className="flex-1"
                data-testid="input-step-title"
              />
              <div className="flex items-center gap-1">
                <Label htmlFor={`endstep-${currentStep.id}`} className="text-xs text-muted-foreground whitespace-nowrap">Konečný krok</Label>
                <Checkbox
                  id={`endstep-${currentStep.id}`}
                  checked={currentStep.isEndStep || false}
                  onCheckedChange={(v) => updateStep(activeStepIndex, { isEndStep: !!v })}
                  data-testid="checkbox-end-step"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeStep(activeStepIndex)}
                data-testid="btn-remove-step"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <Input
              value={currentStep.description || ""}
              onChange={(e) => updateStep(activeStepIndex, { description: e.target.value })}
              placeholder="Popis kroku (voliteľný)"
              data-testid="input-step-description"
            />

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Elementy</span>
              {currentStep.elements.map((el, idx) => (
                <Card key={el.id} className={`${editingElementId === el.id ? "ring-2 ring-primary/30" : ""}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {getElementIcon(el.type)}
                        <span className="text-xs">{elementTypeLabels[el.type] || el.type}</span>
                      </div>
                      <span className="flex-1 text-sm truncate">{el.label || el.content?.substring(0, 40) || "—"}</span>
                      <Button type="button" size="icon" variant="ghost" onClick={() => moveElement(el.id, -1)} disabled={idx === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => moveElement(el.id, 1)} disabled={idx === currentStep.elements.length - 1}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingElementId(editingElementId === el.id ? null : el.id)}
                        data-testid={`btn-edit-element-${el.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeElement(el.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    {editingElementId === el.id && (
                      <div className="space-y-3 pt-2 border-t">
                        {el.type !== "checkbox" && (
                          <div>
                            <Label className="text-xs">Označenie (label)</Label>
                            <div className="flex gap-1">
                              <Input
                                value={el.label || ""}
                                onChange={(e) => updateElement(el.id, { label: e.target.value })}
                                placeholder="Označenie elementu"
                                data-testid={`input-element-label-${el.id}`}
                              />
                            </div>
                          </div>
                        )}

                        {["heading", "text", "paragraph"].includes(el.type) && (
                          <div>
                            <Label className="text-xs">Obsah textu</Label>
                            <Textarea
                              value={el.content || ""}
                              onChange={(e) => updateElement(el.id, { content: e.target.value })}
                              placeholder="Text scenára... Použite premenné ako {{customer.firstName}}"
                              rows={3}
                              data-testid={`input-element-content-${el.id}`}
                            />
                            <div className="mt-2">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1">
                                <Variable className="h-3 w-3" />
                                Dostupné premenné
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {SCRIPT_AVAILABLE_VARIABLES.map((v) => (
                                  <Button
                                    key={v.key}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-[10px] h-6 px-1.5"
                                    onClick={() => insertVariable(el.id, "content", v.key)}
                                    title={v.key}
                                    data-testid={`btn-var-${v.key}`}
                                  >
                                    {v.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {el.type === "checkbox" && (
                          <div>
                            <Label className="text-xs">Text zaškrtávacieho poľa</Label>
                            <Input
                              value={el.label || ""}
                              onChange={(e) => updateElement(el.id, { label: e.target.value })}
                              placeholder="Text potvrdenia"
                              data-testid={`input-checkbox-label-${el.id}`}
                            />
                          </div>
                        )}

                        {["select", "input", "textarea"].includes(el.type) && (
                          <div>
                            <Label className="text-xs">Placeholder</Label>
                            <Input
                              value={el.placeholder || ""}
                              onChange={(e) => updateElement(el.id, { placeholder: e.target.value })}
                              placeholder="Zástupný text"
                              data-testid={`input-element-placeholder-${el.id}`}
                            />
                          </div>
                        )}

                        {["select", "radio", "outcome"].includes(el.type) && (
                          <div>
                            <Label className="text-xs">Možnosti</Label>
                            <div className="space-y-1">
                              {(el.options || []).map((opt, oi) => (
                                <div key={oi} className="flex gap-1 items-center">
                                  <Input
                                    value={opt.label}
                                    onChange={(e) => {
                                      const options = [...(el.options || [])];
                                      options[oi] = { ...options[oi], label: e.target.value };
                                      updateElement(el.id, { options });
                                    }}
                                    placeholder="Popis"
                                    className="flex-1"
                                    data-testid={`input-option-label-${el.id}-${oi}`}
                                  />
                                  <Input
                                    value={opt.value}
                                    onChange={(e) => {
                                      const options = [...(el.options || [])];
                                      options[oi] = { ...options[oi], value: e.target.value };
                                      updateElement(el.id, { options });
                                    }}
                                    placeholder="Hodnota"
                                    className="w-24"
                                    data-testid={`input-option-value-${el.id}-${oi}`}
                                  />
                                  <Select
                                    value={opt.nextStepId || "_none"}
                                    onValueChange={(v) => {
                                      const options = [...(el.options || [])];
                                      options[oi] = { ...options[oi], nextStepId: v === "_none" ? undefined : v };
                                      updateElement(el.id, { options });
                                    }}
                                  >
                                    <SelectTrigger className="w-28">
                                      <SelectValue placeholder="Skok na" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="_none">Žiadny skok</SelectItem>
                                      {script.steps.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      const options = (el.options || []).filter((_, i) => i !== oi);
                                      updateElement(el.id, { options });
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const options = [...(el.options || []), { value: `option${(el.options?.length || 0) + 1}`, label: `Možnosť ${(el.options?.length || 0) + 1}` }];
                                  updateElement(el.id, { options });
                                }}
                                data-testid={`btn-add-option-${el.id}`}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Pridať možnosť
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`required-${el.id}`}
                            checked={el.required || false}
                            onCheckedChange={(v) => updateElement(el.id, { required: !!v })}
                          />
                          <Label htmlFor={`required-${el.id}`} className="text-xs">Povinný element</Label>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="border-t pt-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Pridať element</span>
              <div className="flex flex-wrap gap-1">
                {(["heading", "text", "paragraph", "select", "radio", "outcome", "textarea", "checkbox", "input"] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addElement(type)}
                    className="gap-1"
                    data-testid={`btn-add-element-${type}`}
                  >
                    {getElementIcon(type)}
                    <span className="text-xs">{elementTypeLabels[type]}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {script.steps.length === 0 && (
        <div className="text-center py-6 border rounded-md border-dashed">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mb-2">Scenár zatiaľ neobsahuje žiadne kroky</p>
          <Button type="button" size="sm" variant="outline" onClick={addStep} data-testid="btn-add-first-step">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Pridať prvý krok
          </Button>
        </div>
      )}
    </div>
  );
}

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
        defaultActiveTab: (initialData.defaultActiveTab || "phone") as any,
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
        defaultActiveTab: "phone" as const,
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
      defaultActiveTab: "phone" as const,
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
              <FormLabel>{t.campaigns.campaignName}</FormLabel>
              <FormControl>
                <Input placeholder={t.campaigns.campaignName} {...field} data-testid="input-campaign-name" />
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
              <FormLabel>{t.campaigns.description}</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder={t.campaigns.description} 
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
                <FormLabel>{t.campaigns.type}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-campaign-type">
                      <SelectValue placeholder={t.campaigns.selectType} />
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
                <FormLabel>{t.campaigns.channel}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-campaign-channel">
                      <SelectValue placeholder={t.campaigns.selectChannel} />
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
            name="defaultActiveTab"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Predvolený tab</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || "phone"}>
                  <FormControl>
                    <SelectTrigger data-testid="select-campaign-default-tab">
                      <SelectValue placeholder="Vybrať predvolený tab" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="phone">Hovor</SelectItem>
                    <SelectItem value="script">Script</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
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
                <FormLabel>{t.campaigns.status}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-campaign-status">
                      <SelectValue placeholder={t.campaigns.selectStatus} />
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
                <FormLabel>{t.campaigns.startDate}</FormLabel>
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
                <FormLabel>{t.campaigns.endDate}</FormLabel>
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
              <FormLabel>{t.campaigns.targetCountries}</FormLabel>
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

        <FormField
          control={form.control}
          name="script"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Scenár (Script)
              </FormLabel>
              <FormControl>
                <ScriptBuilder value={field.value || ""} onChange={field.onChange} t={t} />
              </FormControl>
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

// Campaign FAQ Management Tab
function CampaignFaqTab({ campaigns }: { campaigns: Campaign[] }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
  const [faqSearch, setFaqSearch] = useState("");
  const [editingFaq, setEditingFaq] = useState<{ id: string; question: string; answer: string; category: string; campaignId: string } | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sampleFaqs = useMemo(() => [
    { id: "faq-1", question: "Čo je pupočníková krv?", answer: "Pupočníková krv je krv, ktorá zostáva v pupočníku a placente po pôrode. Obsahuje kmeňové bunky, ktoré môžu byť použité na liečbu rôznych ochorení vrátane leukémie, lymfómov a metabolických porúch.", category: "Všeobecné", campaignId: "all" },
    { id: "faq-2", question: "Je odber bolestivý pre matku alebo dieťa?", answer: "Nie, odber pupočníkovej krvi je úplne bezbolestný pre matku aj dieťa. Vykonáva sa až po pôrode a prestrihnutí pupočníka. Neovplyvňuje priebeh pôrodu ani zdravie novorodenca.", category: "Odber", campaignId: "all" },
    { id: "faq-3", question: "Ako dlho sa dajú kmeňové bunky uchovávať?", answer: "Kmeňové bunky z pupočníkovej krvi je možné uchovávať v kryokonzervácii prakticky neobmedzene dlho. Vedecké štúdie potvrdzujú ich životaschopnosť aj po viac ako 25 rokoch uchovávania pri -196°C v tekutom dusíku.", category: "Uchovávanie", campaignId: "all" },
    { id: "faq-4", question: "Aké ochorenia sa dajú liečiť kmeňovými bunkami?", answer: "Kmeňové bunky z pupočníkovej krvi sa v súčasnosti používajú na liečbu viac ako 80 ochorení. Patria medzi ne rôzne formy leukémie, lymfómy, ťažké anémie (vrátane kosáčikovitej anémie), metabolické poruchy, imunodeficiencie a niektoré solídne nádory. Prebiehajú klinické štúdie pre ďalšie indikácie.", category: "Liečba", campaignId: "all" },
    { id: "faq-5", question: "Aké sú cenové možnosti?", answer: "Cena závisí od zvoleného balíka služieb. Základný balík začína od 990€. Máme k dispozícii aj rozšírené balíky s dlhšou dobou uchovávania a doplnkovými službami. Ponúkame tiež možnosť splátok. Aktuálny cenník vám radi pošleme emailom.", category: "Cena", campaignId: "all" },
    { id: "faq-6", question: "Kedy sa musím rozhodnúť o odbere?", answer: "Odporúčame rozhodnúť sa do 34. týždňa tehotenstva, aby sme stihli pripraviť všetky potrebné dokumenty a odberový set. V urgentných prípadoch vieme zabezpečiť expresné spracovanie, ale odporúčame nepodceniť čas na prípravu.", category: "Proces", campaignId: "all" },
    { id: "faq-7", question: "Čo ak mám cisársky rez?", answer: "Odber pupočníkovej krvi je plne kompatibilný aj s cisárskym rezom. Postup je rovnako bezpečný a bezbolestný. Dôležité je vopred informovať pôrodníčku a nášho koordinátora pre hladký priebeh.", category: "Odber", campaignId: "all" },
    { id: "faq-8", question: "Je pupočníková krv kompatibilná medzi súrodencami?", answer: "Áno, medzi súrodencami je 25% pravdepodobnosť plnej HLA zhody a 50% pravdepodobnosť čiastočnej zhody. Pre samotné dieťa je zhoda 100%. Uchovanie pupočníkovej krvi jedného dieťaťa tak môže pomôcť celej rodine.", category: "Liečba", campaignId: "all" },
    { id: "faq-9", question: "Aký je postup po podpísaní zmluvy?", answer: "Po podpísaní zmluvy vám pošleme odberový set s podrobnými inštrukciami. Set prinesiete do pôrodnice. Po pôrode vykoná odber vyškolený personál. Krv sa prepraví do nášho laboratória, kde sa spracuje a uloží do kryobánky do 48 hodín.", category: "Proces", campaignId: "all" },
    { id: "faq-10", question: "Čo ak pupočníková krv nie je vhodná na spracovanie?", answer: "V zriedkavých prípadoch (cca 5%) môže byť objem pupočníkovej krvi nedostatočný alebo kvalita nevyhovujúca. V takom prípade vás budeme informovať a ponúkneme alternatívne riešenia vrátane čiastočného vrátenia poplatku.", category: "Všeobecné", campaignId: "all" },
  ], []);

  const [faqs, setFaqs] = useState(sampleFaqs);

  const categories = useMemo(() => [...new Set(faqs.map(f => f.category))], [faqs]);

  const filteredFaqs = useMemo(() => {
    return faqs.filter(f => {
      if (selectedCampaignId !== "all" && f.campaignId !== "all" && f.campaignId !== selectedCampaignId) return false;
      if (faqSearch.trim()) {
        const q = faqSearch.toLowerCase();
        return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [faqs, selectedCampaignId, faqSearch]);

  const groupedFaqs = useMemo(() => {
    return categories.map(cat => ({
      category: cat,
      items: filteredFaqs.filter(f => f.category === cat),
    })).filter(g => g.items.length > 0);
  }, [filteredFaqs, categories]);

  const handleDeleteFaq = (id: string) => {
    setFaqs(prev => prev.filter(f => f.id !== id));
    toast({ title: t.campaigns.faq.faqDeleted, description: t.campaigns.faq.faqDeletedDesc });
  };

  const handleSaveFaq = (faq: { id?: string; question: string; answer: string; category: string; campaignId: string }) => {
    if (faq.id) {
      setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, ...faq, id: f.id } : f));
      toast({ title: t.campaigns.faq.faqUpdated, description: t.campaigns.faq.faqUpdatedDesc });
    } else {
      const newFaq = { ...faq, id: `faq-${Date.now()}` };
      setFaqs(prev => [...prev, newFaq]);
      toast({ title: t.campaigns.faq.faqAdded, description: t.campaigns.faq.faqAddedDesc });
    }
    setEditingFaq(null);
    setIsAddDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {t.campaigns.faq.title}
            </CardTitle>
            <CardDescription>{t.campaigns.faq.description}</CardDescription>
          </div>
          <Button onClick={() => { setEditingFaq(null); setIsAddDialogOpen(true); }} data-testid="btn-add-faq">
            <Plus className="h-4 w-4 mr-2" />
            {t.campaigns.faq.addFaq}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t.campaigns.faq.searchPlaceholder}
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                className="pl-10"
                data-testid="input-faq-campaign-search"
              />
            </div>
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger className="w-[200px]" data-testid="select-faq-campaign">
                <SelectValue placeholder={t.campaigns.faq.allCampaigns} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.campaigns.faq.allCampaigns}</SelectItem>
                {campaigns.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-xs">{filteredFaqs.length} {t.campaigns.faq.questionsCount}</Badge>
          </div>

          {groupedFaqs.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                {faqSearch ? `${t.campaigns.faq.noFaqsForSearch} "${faqSearch}"` : t.campaigns.faq.noFaqs}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedFaqs.map((group) => (
                <div key={group.category}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 rounded-full bg-primary/60" />
                    <h3 className="text-sm font-semibold text-foreground">{group.category}</h3>
                    <Badge variant="outline" className="text-[10px]">{group.items.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((faq) => {
                      const isExpanded = expandedId === faq.id;
                      return (
                        <Card key={faq.id} data-testid={`faq-manage-item-${faq.id}`}>
                          <div className="flex items-start gap-3 p-4">
                            <HelpCircle className="h-4 w-4 text-primary/70 shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                                className="w-full text-left"
                                data-testid={`btn-faq-expand-${faq.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-foreground flex-1">{faq.question}</p>
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                  )}
                                </div>
                              </button>
                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    <Badge variant="outline" className="text-[10px]">{faq.category}</Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {faq.campaignId === "all" ? t.campaigns.faq.allCampaigns : campaigns.find(c => String(c.id) === faq.campaignId)?.name || "—"}
                                    </Badge>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => { setEditingFaq(faq); setIsAddDialogOpen(true); }}
                                data-testid={`btn-faq-edit-${faq.id}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteFaq(faq.id)}
                                data-testid={`btn-faq-delete-${faq.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) setEditingFaq(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFaq ? t.campaigns.faq.editFaq : t.campaigns.faq.addFaq}</DialogTitle>
            <DialogDescription>
              {editingFaq ? t.campaigns.faq.editFaqDesc : t.campaigns.faq.addFaqDesc}
            </DialogDescription>
          </DialogHeader>
          <FaqForm
            initialData={editingFaq}
            campaigns={campaigns}
            categories={categories}
            onSave={handleSaveFaq}
            onCancel={() => { setIsAddDialogOpen(false); setEditingFaq(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FaqForm({
  initialData,
  campaigns,
  categories,
  onSave,
  onCancel,
}: {
  initialData: { id?: string; question: string; answer: string; category: string; campaignId: string } | null;
  campaigns: Campaign[];
  categories: string[];
  onSave: (faq: { id?: string; question: string; answer: string; category: string; campaignId: string }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [question, setQuestion] = useState(initialData?.question || "");
  const [answer, setAnswer] = useState(initialData?.answer || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [newCategory, setNewCategory] = useState("");
  const [campaignId, setCampaignId] = useState(initialData?.campaignId || "all");
  const [useNewCategory, setUseNewCategory] = useState(false);

  const handleSubmit = () => {
    if (!question.trim() || !answer.trim()) return;
    const finalCategory = useNewCategory ? newCategory.trim() : category;
    if (!finalCategory) return;
    onSave({
      id: initialData?.id,
      question: question.trim(),
      answer: answer.trim(),
      category: finalCategory,
      campaignId,
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>{t.campaigns.faq.question}</Label>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t.campaigns.faq.questionPlaceholder}
          data-testid="input-faq-question"
        />
      </div>
      <div className="space-y-2">
        <Label>{t.campaigns.faq.answer}</Label>
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={t.campaigns.faq.answerPlaceholder}
          rows={4}
          data-testid="input-faq-answer"
        />
      </div>
      <div className="space-y-2">
        <Label>{t.campaigns.faq.category}</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {!useNewCategory ? (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="flex-1" data-testid="select-faq-category">
                <SelectValue placeholder={t.campaigns.faq.selectCategory} />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder={t.campaigns.faq.newCategoryPlaceholder}
              className="flex-1"
              data-testid="input-faq-new-category"
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUseNewCategory(!useNewCategory)}
            data-testid="btn-toggle-new-category"
          >
            {useNewCategory ? t.campaigns.faq.existingCategory : t.campaigns.faq.newCategory}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t.campaigns.faq.campaign}</Label>
        <Select value={campaignId} onValueChange={setCampaignId}>
          <SelectTrigger data-testid="select-faq-campaign-assign">
            <SelectValue placeholder={t.campaigns.faq.campaign} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.campaigns.faq.allCampaigns}</SelectItem>
            {campaigns.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} data-testid="btn-faq-cancel">
          {t.campaigns.faq.cancel}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!question.trim() || !answer.trim() || (!category && !newCategory.trim())}
          data-testid="btn-faq-save"
        >
          {initialData ? t.campaigns.faq.save : t.campaigns.faq.addFaq}
        </Button>
      </div>
    </div>
  );
}

// Agent Workspace Access Tab - Country-based access control
function AgentWorkspaceAccessTab() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: allRoles = [] } = useQuery<Array<{ id: string; name: string; legacyRole: string | null }>>({
    queryKey: ["/api/roles"],
  });

  const { data: allCampaigns = [], isLoading: loadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const callCenterRoleId = useMemo(() => allRoles.find(r => r.name === "Call Center")?.id, [allRoles]);

  const callCenterAgents = useMemo(() => {
    return allUsers.filter(u => callCenterRoleId && u.roleId === callCenterRoleId);
  }, [allUsers, callCenterRoleId]);

  // Get campaign agents for all campaigns
  const { data: allCampaignAgents = [], isLoading: loadingAgents } = useQuery<any[]>({
    queryKey: ["/api/campaign-agents"],
  });

  // Build a map of userId -> campaignIds
  const agentCampaignsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    allCampaignAgents.forEach((ca: any) => {
      if (!map[ca.userId]) {
        map[ca.userId] = [];
      }
      map[ca.userId].push(ca.campaignId);
    });
    return map;
  }, [allCampaignAgents]);

  const assignCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, userId }: { campaignId: string; userId: string }) => {
      const currentAgents = allCampaignAgents.filter(ca => ca.campaignId === campaignId).map(ca => ca.userId);
      const newAgents = Array.from(new Set([...currentAgents, userId]));
      return apiRequest("POST", `/api/campaigns/${campaignId}/agents`, { userIds: newAgents });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.agentAssigned });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-agents"] });
    },
    onError: () => {
      toast({ title: t.common.error, description: t.campaigns.assignError, variant: "destructive" });
    },
  });

  const removeCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, userId }: { campaignId: string; userId: string }) => {
      return apiRequest("DELETE", `/api/campaigns/${campaignId}/agents/${userId}`);
    },
    onSuccess: () => {
      toast({ title: t.campaigns.agentRemoved });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-agents"] });
    },
    onError: () => {
      toast({ title: t.common.error, description: t.campaigns.removeError, variant: "destructive" });
    },
  });

  const toggleCampaignAssignment = (userId: string, campaignId: string) => {
    const currentCampaigns = agentCampaignsMap[userId] || [];
    if (currentCampaigns.includes(campaignId)) {
      removeCampaignMutation.mutate({ campaignId, userId });
    } else {
      assignCampaignMutation.mutate({ campaignId, userId });
    }
  };

  const assignAllCampaigns = async (userId: string) => {
    const currentCampaigns = agentCampaignsMap[userId] || [];
    for (const campaign of allCampaigns) {
      if (!currentCampaigns.includes(campaign.id)) {
        const currentAgents = allCampaignAgents.filter(ca => ca.campaignId === campaign.id).map(ca => ca.userId);
        const newAgents = Array.from(new Set([...currentAgents, userId]));
        await apiRequest("POST", `/api/campaigns/${campaign.id}/agents`, { userIds: newAgents });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/campaign-agents"] });
    toast({ title: t.campaigns.agentAssignedAll });
  };

  const removeAllCampaigns = async (userId: string) => {
    const currentCampaigns = agentCampaignsMap[userId] || [];
    for (const campaignId of currentCampaigns) {
      await apiRequest("DELETE", `/api/campaigns/${campaignId}/agents/${userId}`);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/campaign-agents"] });
    toast({ title: t.campaigns.agentRemovedAll });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "phone": return <Phone className="w-3 h-3" />;
      case "email": return <Mail className="w-3 h-3" />;
      case "sms": return <MessageSquare className="w-3 h-3" />;
      default: return <Megaphone className="w-3 h-3" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case "phone": return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
      case "email": return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
      case "sms": return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
      default: return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300";
    }
  };

  if (loadingUsers || loadingCampaigns || loadingAgents) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5" />
            {t.campaigns.agentAccess.title}
          </CardTitle>
          <CardDescription>
            {t.campaigns.detail.operatorAssignmentDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {callCenterAgents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t.campaigns.agentAccess.noAgents}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.campaigns.agentAccess.noAgentsHint}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {callCenterAgents.map((agent) => {
                const agentCampaigns = agentCampaignsMap[agent.id] || [];
                const isExpanded = selectedAgent === agent.id;
                
                return (
                  <Card key={agent.id} className="overflow-hidden">
                    <div 
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedAgent(isExpanded ? null : agent.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/20">
                            <Headphones className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{agent.fullName}</p>
                            <p className="text-sm text-muted-foreground">{agent.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={agentCampaigns.length > 0 ? "default" : "secondary"}>
                            {agentCampaigns.length} {t.campaigns.title.toLowerCase()}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-medium">{t.campaigns.agentsAssigned}</span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); assignAllCampaigns(agent.id); }}
                              disabled={assignCampaignMutation.isPending || removeCampaignMutation.isPending}
                              data-testid={`button-assign-all-${agent.id}`}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              {t.campaigns.agentAccess.assignAll}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); removeAllCampaigns(agent.id); }}
                              disabled={assignCampaignMutation.isPending || removeCampaignMutation.isPending}
                              data-testid={`button-remove-all-${agent.id}`}
                            >
                              <X className="w-3 h-3 mr-1" />
                              {t.campaigns.agentAccess.removeAll}
                            </Button>
                          </div>
                        </div>
                        
                        {allCampaigns.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {t.campaigns.noCampaigns}
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {allCampaigns.map((campaign) => {
                              const isAssigned = agentCampaigns.includes(campaign.id);
                              return (
                                <Button
                                  key={campaign.id}
                                  variant={isAssigned ? "default" : "outline"}
                                  size="sm"
                                  className="justify-start h-auto py-2 px-3"
                                  onClick={(e) => { e.stopPropagation(); toggleCampaignAssignment(agent.id, campaign.id); }}
                                  disabled={assignCampaignMutation.isPending || removeCampaignMutation.isPending}
                                  data-testid={`button-toggle-campaign-${agent.id}-${campaign.id}`}
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    {isAssigned && <Check className="w-3 h-3 flex-shrink-0" />}
                                    <div className={`p-1 rounded ${getChannelColor(campaign.channel || "mixed")}`}>
                                      {getChannelIcon(campaign.channel || "mixed")}
                                    </div>
                                    <span className="truncate">{campaign.name}</span>
                                  </div>
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CampaignsPage() {
  const { t, locale } = useI18n();
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
  const [activeTab, setActiveTab] = useState("campaigns");

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: batchStats = {} } = useQuery<Record<string, {
    totalContacts: number;
    completedContacts: number;
    failedContacts: number;
    noAnswerContacts: number;
    notInterestedContacts: number;
    pendingContacts: number;
    contactedContacts: number;
    callbackContacts: number;
  }>>({
    queryKey: ["/api/campaigns/batch-stats"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns/batch-stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch batch stats");
      return res.json();
    },
    retry: 3,
    staleTime: 30000,
    refetchOnMount: "always",
    refetchInterval: 60000,
  });

  const { data: users = [] } = useQuery<{ id: string; fullName: string; role: string; roleId: string | null }[]>({
    queryKey: ["/api/users"],
  });

  const { data: dialogRoles = [] } = useQuery<Array<{ id: string; name: string; legacyRole: string | null }>>({
    queryKey: ["/api/roles"],
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
      toast({ title: t.campaigns.created });
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CampaignFormData & { id: string }) => 
      apiRequest("PATCH", `/api/campaigns/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setIsDialogOpen(false);
      setEditingCampaign(null);
      toast({ title: t.campaigns.updated });
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setDeletingCampaign(null);
      toast({ title: t.campaigns.deleted });
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  const updateAgentsMutation = useMutation({
    mutationFn: (data: { campaignId: string; userIds: string[] }) => 
      apiRequest("POST", `/api/campaigns/${data.campaignId}/agents`, { userIds: data.userIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", agentsDialogCampaign?.id, "agents"] });
      setAgentsDialogCampaign(null);
      setSelectedAgentIds([]);
      toast({ title: t.campaigns.agentsAssigned });
    },
    onError: () => {
      toast({ title: t.campaigns.assignAgentError, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (agentsDialogCampaign) {
      const newIds = currentCampaignAgents.map(a => a.userId).sort();
      setSelectedAgentIds(prev => {
        const sorted = [...prev].sort();
        if (sorted.length === newIds.length && sorted.every((v, i) => v === newIds[i])) return prev;
        return newIds;
      });
    }
  }, [currentCampaignAgents, agentsDialogCampaign]);

  const dialogCallCenterRoleId = dialogRoles.find(r => r.name === "Call Center")?.id;
  const callCenterUsers = useMemo(() => {
    return users.filter(u => u.role === "admin" || (dialogCallCenterRoleId && u.roleId === dialogCallCenterRoleId));
  }, [users, dialogCallCenterRoleId]);

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
    const statusLabels = t.campaigns.statuses as Record<string, string>;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {statusLabels?.[status] || status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeLabels = t.campaigns.types as Record<string, string>;
    return (
      <Badge variant="outline">
        {typeLabels?.[type] || type}
      </Badge>
    );
  };

  const getKpiBadges = (campaign: Campaign) => {
    const stats = batchStats[campaign.id];
    if (!stats) return null;

    let kpiTargets: Record<string, number> = {};
    try {
      if (campaign.settings) {
        const s = JSON.parse(campaign.settings);
        if (s.kpiTargets) kpiTargets = s.kpiTargets;
      }
    } catch {}

    const badges: { label: string; pct: number }[] = [];

    if (kpiTargets.campaignTotalContactsTarget && kpiTargets.campaignTotalContactsTarget > 0) {
      const pct = Math.round((stats.totalContacts / kpiTargets.campaignTotalContactsTarget) * 100);
      badges.push({ label: `${t.campaigns.detail.kpiTotalContacts} ${pct}%`, pct });
    }

    if (kpiTargets.campaignCompletionTarget && kpiTargets.campaignCompletionTarget > 0) {
      const processed = stats.completedContacts + stats.failedContacts + stats.noAnswerContacts + stats.notInterestedContacts;
      const completionRate = stats.totalContacts > 0 ? (processed / stats.totalContacts) * 100 : 0;
      const pct = Math.round((completionRate / kpiTargets.campaignCompletionTarget) * 100);
      badges.push({ label: `${t.campaigns.detail.completionRate} ${pct}%`, pct });
    }

    if (kpiTargets.campaignConversionTarget && kpiTargets.campaignConversionTarget > 0) {
      const processed = stats.completedContacts + stats.failedContacts + stats.noAnswerContacts + stats.notInterestedContacts;
      const conversionRate = processed > 0 ? (stats.completedContacts / processed) * 100 : 0;
      const pct = Math.round((conversionRate / kpiTargets.campaignConversionTarget) * 100);
      badges.push({ label: `${t.campaigns.detail.kpiMinConversionRate} ${pct}%`, pct });
    }

    if (badges.length === 0) return null;

    return (
      <div className="flex gap-1 mt-1 flex-wrap">
        {badges.map((b, i) => {
          const color = b.pct >= 100 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : b.pct >= 70 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            : b.pct >= 30 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
          return (
            <span key={i} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`} data-testid={`badge-kpi-${campaign.id}-${i}`}>
              {b.label}
            </span>
          );
        })}
      </div>
    );
  };

  const columns = [
    {
      key: "name",
      header: t.campaigns.campaignName,
      cell: (campaign: Campaign) => (
        <div>
          <div className="font-medium">{campaign.name}</div>
          {getKpiBadges(campaign)}
        </div>
      ),
    },
    {
      key: "type",
      header: t.campaigns.type,
      cell: (campaign: Campaign) => getTypeBadge(campaign.type),
    },
    {
      key: "channel",
      header: t.campaigns.channel,
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
            {(t.campaigns.channels as Record<string, string>)[campaign.channel || "phone"] || config.label}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: t.campaigns.status,
      cell: (campaign: Campaign) => getStatusBadge(campaign.status),
    },
    {
      key: "countryCodes",
      header: t.campaigns.targetCountries,
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
      header: t.campaigns.dates,
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
            onClick={(e) => { e.stopPropagation(); setAgentsDialogCampaign(campaign); }}
            title="Priradiť agentov"
            data-testid={`button-assign-agents-${campaign.id}`}
          >
            <Users className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
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
            onClick={(e) => { e.stopPropagation(); setDeletingCampaign(campaign); }}
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
        title={t.campaigns.title}
        description={t.campaigns.description}
      >
        {activeTab === "campaigns" && (
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
              {t.campaigns.addCampaign}
            </Button>
          </div>
        )}
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-4">
          <TabsList>
            <TabsTrigger value="campaigns" className="gap-2" data-testid="tab-campaigns">
              <Megaphone className="h-4 w-4" />
              {t.campaigns.title}
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2" data-testid="tab-access">
              <Shield className="h-4 w-4" />
              {t.campaigns.agentAccess.agentAccessTab}
            </TabsTrigger>
            <TabsTrigger value="transcripts" className="gap-2" data-testid="tab-transcripts">
              <Mic className="h-4 w-4" />
              {t.callAnalysis?.pageTitle || "Transcripts"}
            </TabsTrigger>
            <TabsTrigger value="faq" className="gap-2" data-testid="tab-faq">
              <HelpCircle className="h-4 w-4" />
              {t.campaigns.faq.faqTab}
            </TabsTrigger>
            <TabsTrigger value="breaks" className="gap-2" data-testid="tab-breaks">
              <Coffee className="h-4 w-4" />
              {locale === "sk" ? "Prestávky" : "Breaks"}
            </TabsTrigger>
            <TabsTrigger value="inbound-queues" className="gap-2" data-testid="tab-inbound-queues">
              <Phone className="h-4 w-4" />
              Inbound Queues
            </TabsTrigger>
            <TabsTrigger value="ivr-messages" className="gap-2" data-testid="tab-ivr-messages">
              <Mic className="h-4 w-4" />
              IVR Audio
            </TabsTrigger>
            <TabsTrigger value="ivr-menus" className="gap-2" data-testid="tab-ivr-menus">
              <Phone className="h-4 w-4" />
              IVR Menu
            </TabsTrigger>
            <TabsTrigger value="did-routes" className="gap-2" data-testid="tab-did-routes">
              <GitBranch className="h-4 w-4" />
              DID Smerovanie
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="campaigns" className="flex-1 overflow-auto p-6 mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t.campaigns.searchPlaceholder}
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
                  emptyMessage={t.campaigns.noCampaigns}
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
        </TabsContent>

        <TabsContent value="access" className="flex-1 overflow-auto mt-0">
          <AgentWorkspaceAccessTab />
        </TabsContent>

        <TabsContent value="transcripts" className="flex-1 overflow-hidden mt-0">
          <TranscriptSearchContent />
        </TabsContent>

        <TabsContent value="faq" className="flex-1 overflow-auto p-6 mt-0">
          <CampaignFaqTab campaigns={campaigns || []} />
        </TabsContent>

        <TabsContent value="breaks" className="flex-1 overflow-auto mt-0">
          <BreakTypesTab />
        </TabsContent>

        <TabsContent value="inbound-queues" className="flex-1 overflow-auto p-6 mt-0">
          <InboundQueuesTab />
        </TabsContent>

        <TabsContent value="ivr-messages" className="flex-1 overflow-auto p-6 mt-0">
          <IvrMessagesTab />
        </TabsContent>

        <TabsContent value="ivr-menus" className="flex-1 overflow-auto p-6 mt-0">
          <IvrMenusTab />
        </TabsContent>

        <TabsContent value="did-routes" className="flex-1 overflow-auto mt-0">
          <DidRoutesTab />
        </TabsContent>
      </Tabs>

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
                ? t.campaigns.editCampaign
                : t.campaigns.addCampaign}
            </DialogTitle>
            <DialogDescription>
              {editingCampaign 
                ? t.campaigns.editCampaignDesc
                : t.campaigns.addCampaignDesc}
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
            <AlertDialogTitle>{t.campaigns.deleteCampaign}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.campaigns.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel data-testid="button-cancel-delete">
              {t.common.cancel}
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={async () => {
                if (!deletingCampaign) return;
                try {
                  const res = await fetch(`/api/campaigns/${deletingCampaign.id}/export`, { credentials: "include" });
                  if (!res.ok) throw new Error();
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `campaign-${deletingCampaign.name.replace(/\s+/g, "_")}-export.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast({ title: t.campaigns.exportSuccess || "Export saved" });
                } catch {
                  toast({ title: t.common.error, variant: "destructive" });
                }
              }}
              data-testid="button-export-before-delete"
            >
              <Download className="w-4 h-4 mr-2" />
              {t.campaigns.exportData || "Export data"}
            </Button>
            <AlertDialogAction
              onClick={() => deletingCampaign && deleteMutation.mutate(deletingCampaign.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              <Trash2 className="w-4 h-4 mr-2" />
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
              {t.common.close}
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
                        {user.fullName}
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {dialogRoles.find(r => r.id === user.roleId)?.name || user.role}
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
              {t.common.cancel}
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
              {updateAgentsMutation.isPending ? t.common.saving : t.common.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
