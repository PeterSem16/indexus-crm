import { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/i18n";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import {
  FileText, Plus, Edit2, Trash2, Eye, Check, X,
  CheckCircle, Loader2, Edit, GripVertical, Globe,
  Sparkles, Settings, RefreshCw, Download,
  ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ContractTemplate, ContractCategory } from "@shared/schema";
import { DocxEditor } from "@/components/docx-editor";
import { DocxTemplateEditor } from "@/components/docx-template-editor";

type TemplateSubTab = "list" | "categories";

const TEMPLATE_CATEGORIES = [
  { value: "general", label: "Všeobecná zmluva" },
  { value: "cord_blood", label: "Zmluva o uchovávaní krvotvorných buniek" },
  { value: "service", label: "Zmluva o službách" },
  { value: "storage", label: "Zmluva o uchovávaní" },
  { value: "gdpr", label: "GDPR súhlas" }
];

const CUSTOMER_FIELDS = [
  { group: "Osobné údaje", fields: [
    { key: "firstName", label: "Meno" },
    { key: "lastName", label: "Priezvisko" },
    { key: "fullName", label: "Celé meno (meno + priezvisko)" },
    { key: "titleBefore", label: "Titul pred" },
    { key: "titleAfter", label: "Titul za" },
    { key: "maidenName", label: "Rodné priezvisko" },
    { key: "dateOfBirth", label: "Dátum narodenia" },
    { key: "nationalId", label: "Rodné číslo" },
    { key: "idCardNumber", label: "Číslo OP" },
  ]},
  { group: "Kontakt", fields: [
    { key: "email", label: "Email" },
    { key: "email2", label: "Email 2" },
    { key: "phone", label: "Telefón" },
    { key: "mobile", label: "Mobil" },
    { key: "mobile2", label: "Mobil 2" },
  ]},
  { group: "Adresa", fields: [
    { key: "address", label: "Ulica a číslo" },
    { key: "city", label: "Mesto" },
    { key: "postalCode", label: "PSČ" },
    { key: "region", label: "Oblasť" },
    { key: "country", label: "Krajina" },
  ]},
  { group: "Korešpondenčná adresa", fields: [
    { key: "corrName", label: "Meno (kor.)" },
    { key: "corrAddress", label: "Ulica (kor.)" },
    { key: "corrCity", label: "Mesto (kor.)" },
    { key: "corrPostalCode", label: "PSČ (kor.)" },
    { key: "corrCountry", label: "Krajina (kor.)" },
  ]},
  { group: "Bankové údaje", fields: [
    { key: "bankAccount", label: "IBAN" },
    { key: "bankCode", label: "Kód banky" },
    { key: "bankName", label: "Názov banky" },
    { key: "bankSwift", label: "SWIFT" },
  ]},
  { group: "Dátum a systém", fields: [
    { key: "currentDate", label: "Aktuálny dátum" },
    { key: "contractNumber", label: "Číslo zmluvy" },
    { key: "internalId", label: "Interné číslo" },
  ]},
];

function SortableCategoryRow({
  category,
  onEdit,
  onDelete
}: {
  category: ContractCategory;
  onEdit: (category: ContractCategory) => void;
  onDelete: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-testid={`row-category-${category.id}`}
      className={isDragging ? "bg-muted" : ""}
    >
      <TableCell className="w-10">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          data-testid={`drag-handle-category-${category.id}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="font-mono text-sm">{category.value}</TableCell>
      <TableCell className="font-medium">{category.label}</TableCell>
      <TableCell className="text-muted-foreground">{category.description || "-"}</TableCell>
      <TableCell>{category.sortOrder}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(category)}
            data-testid={`button-edit-category-${category.id}`}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              if (confirm("Naozaj chcete vymazať túto kategóriu?")) {
                onDelete(category.id);
              }
            }}
            data-testid={`button-delete-category-${category.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function DocxPreviewContent({
  categoryId,
  countryCode,
  extractedFields,
  showSampleData = false
}: {
  categoryId: number;
  countryCode: string;
  extractedFields: string[];
  showSampleData?: boolean;
}) {
  const [docxText, setDocxText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocxPreview = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const url = `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/docx-preview${showSampleData ? '?withSampleData=true' : ''}`;
        const response = await fetch(url, { credentials: "include" });

        if (!response.ok) {
          throw new Error("Failed to fetch DOCX preview");
        }

        const data = await response.json();
        setDocxText(data.text || "");
      } catch (err) {
        console.error("Error fetching DOCX preview:", err);
        setError("Nepodarilo sa načítať náhľad dokumentu");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocxPreview();
  }, [categoryId, countryCode, showSampleData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Načítavam dokument...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <span className="h-8 w-8 mx-auto mb-2 block">!</span>
        <p>{error}</p>
      </div>
    );
  }

  if (!docxText) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Dokument je prázdny</p>
      </div>
    );
  }

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      const parts: Array<{ type: 'text' | 'placeholder' | 'sample'; content: string; field?: string }> = [];
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const sampleRegex = /«([^»]+)»/g;

      let lastIndex = 0;
      let match;

      while ((match = placeholderRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', content: line.slice(lastIndex, match.index) });
        }
        parts.push({ type: 'placeholder', content: match[1], field: match[1] });
        lastIndex = placeholderRegex.lastIndex;
      }

      if (parts.length === 0) {
        while ((match = sampleRegex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            parts.push({ type: 'text', content: line.slice(lastIndex, match.index) });
          }
          parts.push({ type: 'sample', content: match[1] });
          lastIndex = sampleRegex.lastIndex;
        }
      }

      if (lastIndex < line.length) {
        parts.push({ type: 'text', content: line.slice(lastIndex) });
      }

      if (parts.length === 0) {
        parts.push({ type: 'text', content: line || '\u00A0' });
      }

      return (
        <div key={lineIdx} className="min-h-[1.5em]">
          {parts.map((part, idx) => {
            if (part.type === 'placeholder') {
              return (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 font-mono text-xs border border-amber-300 dark:border-amber-700"
                  title={`Premenná: ${part.field}`}
                >
                  {`{{${part.content}}}`}
                </span>
              );
            } else if (part.type === 'sample') {
              return (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 font-semibold border border-green-300 dark:border-green-700"
                >
                  {part.content}
                </span>
              );
            }
            return <span key={idx}>{part.content}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <div className="text-sm leading-relaxed font-serif p-4 bg-white dark:bg-gray-900 rounded-lg border space-y-1">
      {renderFormattedText(docxText)}
    </div>
  );
}

export function ContractTemplatesManager() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const selectedCountry = selectedCountries.length === 1 ? selectedCountries[0] : null;

  const [templateSubTab, setTemplateSubTab] = useState<TemplateSubTab>("list");

  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const COUNTRIES_LIST = [
    { code: "SK", name: "Slovensko" },
    { code: "CZ", name: "Česko" },
    { code: "HU", name: "Maďarsko" },
    { code: "RO", name: "Rumunsko" },
    { code: "IT", name: "Taliansko" },
    { code: "DE", name: "Nemecko" },
    { code: "US", name: "USA" },
  ];

  useEffect(() => { setCurrentPage(1); }, [selectedCountry]);

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ContractCategory | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);

  const [templateForm, setTemplateForm] = useState<{
    name: string;
    category: string;
    languageCode: string;
    description: string;
    countryCode: string;
    contentHtml: string;
    loadedFromCategory: boolean;
    loadedCategoryId: number | null;
    sourceDocxPath: string;
    extractedFields: string[];
    placeholderMappings: Record<string, string>;
  }>({
    name: "",
    category: "general",
    languageCode: "sk",
    description: "",
    countryCode: selectedCountry || "SK",
    contentHtml: "",
    loadedFromCategory: false,
    loadedCategoryId: null,
    sourceDocxPath: "",
    extractedFields: [],
    placeholderMappings: {}
  });

  const [loadingCategoryTemplate, setLoadingCategoryTemplate] = useState(false);
  const [aiMappingInProgress, setAiMappingInProgress] = useState(false);
  const [templatePreviewPdfUrl, setTemplatePreviewPdfUrl] = useState<string | null>(null);

  const [categoryForm, setCategoryForm] = useState({
    value: "",
    label: "",
    labelSk: "",
    labelCz: "",
    labelHu: "",
    labelRo: "",
    labelIt: "",
    labelDe: "",
    labelUs: "",
    description: "",
    sortOrder: 0
  });

  const [categoryWizardStep, setCategoryWizardStep] = useState(1);
  const [categoryPdfUploads, setCategoryPdfUploads] = useState<Record<string, {
    file: File | null;
    uploading: boolean;
    uploaded: boolean;
    error?: string;
    extractedText?: string;
    embeddedImages?: { fileName: string; imageUrl: string; sizeKB: number }[];
    pageImages?: { pageNumber: number; imageUrl: string; fileName: string }[];
    conversionMethod?: "ai" | "text-only";
  }>>({
    SK: { file: null, uploading: false, uploaded: false },
    CZ: { file: null, uploading: false, uploaded: false },
    HU: { file: null, uploading: false, uploaded: false },
    RO: { file: null, uploading: false, uploaded: false },
    IT: { file: null, uploading: false, uploaded: false },
    DE: { file: null, uploading: false, uploaded: false },
    US: { file: null, uploading: false, uploaded: false },
  });
  const [categoryDefaultTemplates, setCategoryDefaultTemplates] = useState<Record<string, boolean>>({});

  const [isTemplatePreviewOpen, setIsTemplatePreviewOpen] = useState(false);
  const [templatePreviewContent, setTemplatePreviewContent] = useState("");
  const [templatePreviewCountry, setTemplatePreviewCountry] = useState("");
  const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false);

  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [isTemplateEditorLoading, setIsTemplateEditorLoading] = useState(false);
  const [isAiInsertingPlaceholders, setIsAiInsertingPlaceholders] = useState(false);
  const [isResettingTemplate, setIsResettingTemplate] = useState(false);
  const [previewShowSampleData, setPreviewShowSampleData] = useState(false);
  const [editingTemplateCountry, setEditingTemplateCountry] = useState("");
  const [editingTemplateData, setEditingTemplateData] = useState<{
    templateType: string;
    extractedFields: string[];
    placeholderMappings: Record<string, string>;
    sourcePath: string;
    categoryId: number;
    countryCode: string;
    aiProcessed?: boolean;
    originalDocxPath?: string;
  } | null>(null);
  const [templateMappings, setTemplateMappings] = useState<Record<string, string>>({});
  const [savingMappings, setSavingMappings] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contracts/templates", selectedCountry],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ContractCategory[]>({
    queryKey: ["/api/contracts/categories"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm) => {
      return apiRequest("POST", "/api/contracts/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      setIsTemplateDialogOpen(false);
      resetTemplateForm();
      toast({ title: t.contractsModule.templateCreated });
    },
    onError: () => {
      toast({ title: t.contractsModule.saveError, variant: "destructive" });
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof templateForm> }) => {
      return apiRequest("PATCH", `/api/contracts/templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      setIsTemplateDialogOpen(false);
      setSelectedTemplate(null);
      resetTemplateForm();
      toast({ title: t.contractsModule.templateUpdated });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/contracts/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      toast({ title: t.contractsModule.templateDeleted });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryForm) => {
      const response = await apiRequest("POST", "/api/contracts/categories", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/categories"] });
    },
    onError: () => {
      toast({ title: t.contractsModule.saveError, variant: "destructive" });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof categoryForm }) => {
      return apiRequest("PATCH", `/api/contracts/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/categories"] });
    },
    onError: () => {
      toast({ title: t.contractsModule.saveError, variant: "destructive" });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/contracts/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/categories"] });
      toast({ title: t.contractsModule.categoryDeleted });
    }
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      return apiRequest("POST", "/api/contracts/categories/reorder", { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/categories"] });
    }
  });

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      category: "general",
      languageCode: "sk",
      description: "",
      countryCode: selectedCountry || "SK",
      contentHtml: "",
      loadedFromCategory: false,
      loadedCategoryId: null,
      sourceDocxPath: "",
      extractedFields: [],
      placeholderMappings: {}
    });
    setTemplatePreviewPdfUrl(null);
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      value: "",
      label: "",
      labelSk: "",
      labelCz: "",
      labelHu: "",
      labelRo: "",
      labelIt: "",
      labelDe: "",
      labelUs: "",
      description: "",
      sortOrder: 0
    });
    setCategoryWizardStep(1);
    setCategoryPdfUploads({
      SK: { file: null, uploading: false, uploaded: false },
      CZ: { file: null, uploading: false, uploaded: false },
      HU: { file: null, uploading: false, uploaded: false },
      RO: { file: null, uploading: false, uploaded: false },
      IT: { file: null, uploading: false, uploaded: false },
      DE: { file: null, uploading: false, uploaded: false },
      US: { file: null, uploading: false, uploaded: false },
    });
    setCategoryDefaultTemplates({});
  };

  const handleEditCategory = async (category: ContractCategory) => {
    setSelectedCategory(category);
    setCategoryForm({
      value: category.value,
      label: category.label,
      labelSk: category.labelSk || "",
      labelCz: category.labelCz || "",
      labelHu: category.labelHu || "",
      labelRo: category.labelRo || "",
      labelIt: category.labelIt || "",
      labelDe: category.labelDe || "",
      labelUs: category.labelUs || "",
      description: category.description || "",
      sortOrder: category.sortOrder
    });
    setCategoryWizardStep(0);

    try {
      const response = await fetch(`/api/contracts/categories/${category.id}/default-templates`, {
        credentials: "include"
      });
      if (response.ok) {
        const templates = await response.json() as Array<{ countryCode: string }>;
        const templateMap: Record<string, boolean> = {};
        templates.forEach(t => { templateMap[t.countryCode] = true; });
        setCategoryDefaultTemplates(templateMap);
      }
    } catch (e) {
      setCategoryDefaultTemplates({});
    }

    setIsCategoryDialogOpen(true);
  };

  const handleEditTemplate = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setTemplateForm({
      name: template.name,
      category: template.category,
      languageCode: template.languageCode,
      description: template.description || "",
      countryCode: template.countryCode,
      contentHtml: template.contentHtml || "",
      loadedFromCategory: false,
      loadedCategoryId: null,
      sourceDocxPath: "",
      extractedFields: [],
      placeholderMappings: {}
    });
    setIsTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (selectedTemplate) {
      updateTemplateMutation.mutate({ id: selectedTemplate.id, data: templateForm });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const handleLoadCategoryTemplate = async () => {
    if (!templateForm.category || !templateForm.countryCode) {
      toast({ title: t.contractsModule.saveError, variant: "destructive" });
      return;
    }

    const category = categories?.find((c: ContractCategory) => c.value === templateForm.category);
    if (!category) {
      toast({ title: t.contractsModule.saveError, variant: "destructive" });
      return;
    }

    setLoadingCategoryTemplate(true);
    try {
      const response = await fetch(`/api/contracts/categories/${category.id}/default-templates/${templateForm.countryCode}`, {
        credentials: "include"
      });

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Šablóna neexistuje",
            description: `Pre kategóriu "${category.label}" a krajinu ${templateForm.countryCode} neexistuje DOCX šablóna. Najprv ju nahrajte v sekcii Kategórie.`,
            variant: "destructive"
          });
        } else {
          throw new Error("Failed to load template");
        }
        return;
      }

      const template = await response.json();

      let mappings = template.placeholderMappings || {};
      if (typeof mappings === 'string') {
        try {
          mappings = JSON.parse(mappings);
        } catch (e) {
          mappings = {};
        }
      }

      setTemplateForm(prev => ({
        ...prev,
        loadedFromCategory: true,
        loadedCategoryId: category.id,
        sourceDocxPath: template.sourceDocxPath || "",
        extractedFields: template.extractedFields || [],
        placeholderMappings: mappings
      }));

      setTemplatePreviewPdfUrl(`/api/contracts/categories/${category.id}/default-templates/${templateForm.countryCode}/preview?t=${Date.now()}`);

      try {
        const htmlResponse = await fetch(`/api/contracts/categories/${category.id}/default-templates/${templateForm.countryCode}/docx-html`, {
          credentials: "include"
        });
        if (htmlResponse.ok) {
          const htmlData = await htmlResponse.json();
          setTemplateForm(prev => ({ ...prev, contentHtml: htmlData.rawHtml || htmlData.html || "" }));
        }
      } catch (htmlError) {
        console.error("Error loading HTML:", htmlError);
      }

      toast({ title: t.contractsModule.loadTemplate });
    } catch (error) {
      console.error("Error loading category template:", error);
      toast({ title: t.contractsModule.saveError, variant: "destructive" });
    } finally {
      setLoadingCategoryTemplate(false);
    }
  };

  const handleAiMapping = async () => {
    if (templateForm.extractedFields.length === 0) {
      toast({ title: t.contractsModule.saveError, variant: "destructive" });
      return;
    }

    setAiMappingInProgress(true);
    try {
      const response = await fetch("/api/contracts/ai-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          extractedFields: templateForm.extractedFields
        })
      });

      if (!response.ok) {
        throw new Error("AI mapping failed");
      }

      const result = await response.json();

      setTemplateForm(prev => ({
        ...prev,
        placeholderMappings: { ...prev.placeholderMappings, ...result.mappings }
      }));

      toast({
        title: "AI mapovanie dokončené",
        description: `Namapovaných ${Object.keys(result.mappings).length} z ${templateForm.extractedFields.length} premenných`
      });
    } catch (error) {
      console.error("AI mapping error:", error);
      toast({ title: t.contractsModule.saveError, variant: "destructive" });
    } finally {
      setAiMappingInProgress(false);
    }
  };

  const handlePreviewTemplate = async (categoryId: number, countryCode: string) => {
    setTemplatePreviewLoading(true);
    setTemplatePreviewCountry(countryCode);
    setIsTemplatePreviewOpen(true);

    try {
      const response = await fetch(`/api/contracts/categories/${categoryId}/default-templates/${countryCode}`, {
        credentials: "include"
      });
      if (response.ok) {
        const template = await response.json();
        const htmlContent = template.htmlContent || template.contentHtml || "";
        if (htmlContent && htmlContent.trim().length > 0) {
          setTemplatePreviewContent(htmlContent);
        } else {
          setTemplatePreviewContent(`
            <div style="text-align: center; padding: 40px; color: #666;">
              <p style="font-size: 16px; margin-bottom: 10px;">Šablóna existuje, ale nemá HTML obsah.</p>
              <p style="font-size: 14px;">Pravdepodobne PDF konverzia zlyhala alebo nebola dokončená.</p>
            </div>
          `);
        }
      } else if (response.status === 404) {
        setTemplatePreviewContent(`
          <div style="text-align: center; padding: 40px; color: #666;">
            <p style="font-size: 16px;">Šablóna pre túto krajinu neexistuje.</p>
            <p style="font-size: 14px;">Nahrajte PDF v sekcii "Nová kategória" s krokom 2.</p>
          </div>
        `);
      } else {
        setTemplatePreviewContent("<p>Nepodarilo sa načítať šablónu</p>");
      }
    } catch (e) {
      setTemplatePreviewContent("<p>Chyba pri načítaní šablóny</p>");
    } finally {
      setTemplatePreviewLoading(false);
    }
  };

  const handleEditCategoryTemplate = async (categoryId: number, countryCode: string) => {
    setEditingTemplateCountry(countryCode);
    setEditingTemplateData(null);
    setTemplateMappings({});
    setIsTemplateEditorLoading(true);
    setIsTemplateEditorOpen(true);

    try {
      const response = await fetch(`/api/contracts/categories/${categoryId}/default-templates/${countryCode}`, {
        credentials: "include"
      });
      if (response.ok) {
        const template = await response.json();
        let rawFields = template.extractedFields;
        if (typeof rawFields === 'string') {
          try {
            rawFields = JSON.parse(rawFields);
          } catch (e) {
            rawFields = [];
          }
        }
        if (!Array.isArray(rawFields)) {
          rawFields = [];
        }

        const extractedFields: string[] = rawFields
          .map((f: any) => typeof f === 'string' ? f : f?.name || '')
          .filter((name: string) => name && name.trim() !== '');

        let mappings = template.placeholderMappings;
        if (typeof mappings === 'string') {
          try {
            mappings = JSON.parse(mappings);
          } catch (e) {
            mappings = {};
          }
        }
        if (!mappings || typeof mappings !== 'object') {
          mappings = {};
        }

        let aiProcessed = false;
        if (template.conversionMetadata) {
          try {
            const meta = typeof template.conversionMetadata === 'string'
              ? JSON.parse(template.conversionMetadata)
              : template.conversionMetadata;
            aiProcessed = !!meta.aiProcessedAt;
          } catch (e) {}
        }

        setEditingTemplateData({
          templateType: template.templateType || "pdf_form",
          extractedFields: extractedFields,
          placeholderMappings: mappings,
          sourcePath: template.sourceDocxPath || template.sourcePdfPath || "",
          categoryId: selectedCategory!.id,
          countryCode: countryCode,
          aiProcessed: aiProcessed,
          originalDocxPath: template.originalDocxPath || undefined
        });
        setTemplateMappings(mappings);
        setIsTemplateEditorLoading(false);
      } else {
        toast({
          title: "Chyba",
          description: "Nepodarilo sa načítať šablónu",
          variant: "destructive"
        });
        setIsTemplateEditorOpen(false);
        setIsTemplateEditorLoading(false);
      }
    } catch (e) {
      toast({
        title: "Chyba",
        description: "Chyba pri načítaní šablóny",
        variant: "destructive"
      });
      setIsTemplateEditorOpen(false);
      setIsTemplateEditorLoading(false);
    }
  };

  const handleSaveMappings = async () => {
    if (!selectedCategory || !editingTemplateCountry) return;

    setSavingMappings(true);
    try {
      const filteredMappings: Record<string, string> = {};
      for (const [key, value] of Object.entries(templateMappings)) {
        if (value && value.trim() !== "") {
          filteredMappings[key] = value;
        }
      }

      const response = await fetch(`/api/contracts/categories/${selectedCategory.id}/default-templates/${editingTemplateCountry}/mappings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: filteredMappings }),
        credentials: "include"
      });

      if (response.ok) {
        toast({ title: t.contractsModule.mappingsSaved });
        setIsTemplateEditorOpen(false);
        queryClient.invalidateQueries({ queryKey: ['/api/contracts/categories'] });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Uloženie zlyhalo");
      }
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSavingMappings(false);
    }
  };

  const handlePdfUpload = async (countryCode: string, file: File) => {
    setCategoryPdfUploads(prev => ({
      ...prev,
      [countryCode]: { ...prev[countryCode], file, uploading: false, uploaded: false, error: undefined }
    }));
  };

  const uploadCategoryPdfs = async (categoryId: number): Promise<{ successCount: number; errorCount: number; errors: string[] }> => {
    const countries = Object.entries(categoryPdfUploads).filter(([_, data]) => data.file);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const [countryCode, data] of countries) {
      if (!data.file) continue;

      setCategoryPdfUploads(prev => ({
        ...prev,
        [countryCode]: { ...prev[countryCode], uploading: true }
      }));

      try {
        const formData = new FormData();
        formData.append("file", data.file);
        formData.append("countryCode", countryCode);

        const response = await fetch(`/api/contracts/categories/${categoryId}/default-templates/upload`, {
          method: "POST",
          body: formData,
          credentials: "include"
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const result = await response.json();

        setCategoryPdfUploads(prev => ({
          ...prev,
          [countryCode]: {
            ...prev[countryCode],
            uploading: false,
            uploaded: true,
            extractedFields: result.extractedFields || [],
          }
        }));
        successCount++;
      } catch (error: any) {
        setCategoryPdfUploads(prev => ({
          ...prev,
          [countryCode]: { ...prev[countryCode], uploading: false, error: error.message }
        }));
        errorCount++;
        errors.push(`${countryCode}: ${error.message}`);
      }
    }

    return { successCount, errorCount, errors };
  };

  const handleSaveCategory = () => {
    if (selectedCategory) {
      updateCategoryMutation.mutate({ id: selectedCategory.id, data: categoryForm });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  const filteredTemplates = useMemo(() => {
    let result = [...templates];
    if (filterCountry !== "all") {
      result = result.filter(t => t.countryCode === filterCountry);
    } else if (selectedCountry) {
      result = result.filter(t => t.countryCode === selectedCountry);
    }
    if (filterCategory !== "all") {
      result = result.filter(t => t.category === filterCategory);
    }
    if (filterStatus !== "all") {
      result = result.filter(t => filterStatus === "published" ? t.status === "published" : t.status !== "published");
    }
    result.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";
      switch (sortField) {
        case "name": valA = (a.name || "").toLowerCase(); valB = (b.name || "").toLowerCase(); break;
        case "country": valA = a.countryCode || ""; valB = b.countryCode || ""; break;
        case "category": valA = a.category || ""; valB = b.category || ""; break;
        case "status": valA = a.status === "published" ? 1 : 0; valB = b.status === "published" ? 1 : 0; break;
        case "date": valA = new Date(a.createdAt || 0).getTime(); valB = new Date(b.createdAt || 0).getTime(); break;
        default: valA = (a.name || "").toLowerCase(); valB = (b.name || "").toLowerCase();
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [templates, filterCountry, filterCategory, filterStatus, sortField, sortDir, selectedCountry]);

  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTemplates = filteredTemplates.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  const uniqueCategories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category).filter(Boolean));
    return Array.from(cats);
  }, [templates]);

  const getCategoryLabel = (category: ContractCategory, countryCode?: string): string => {
    if (!countryCode) return category.label;
    switch (countryCode.toUpperCase()) {
      case "SK": return category.labelSk || category.label;
      case "CZ": return category.labelCz || category.label;
      case "HU": return category.labelHu || category.label;
      case "RO": return category.labelRo || category.label;
      case "IT": return category.labelIt || category.label;
      case "DE": return category.labelDe || category.label;
      case "US": return category.labelUs || category.label;
      default: return category.label;
    }
  };

  const getCategoryLabelByValue = (categoryValue: string, countryCode?: string): string => {
    const category = categories.find(c => c.value === categoryValue);
    if (category) {
      return getCategoryLabel(category, countryCode);
    }
    const fallback = TEMPLATE_CATEGORIES.find(c => c.value === categoryValue);
    return fallback?.label || categoryValue;
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!categories?.length || !over || active.id === over.id) {
      return;
    }

    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedCategories = arrayMove(categories, oldIndex, newIndex);
    const orderedIds = reorderedCategories.map(c => c.id);

    queryClient.setQueryData(["/api/contracts/categories"], reorderedCategories);

    reorderCategoriesMutation.mutate(orderedIds);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">{t.konfigurator?.contractTemplates || "Šablóny zmlúv"}</h3>
          <p className="text-sm text-muted-foreground">{t.konfigurator?.contractTemplatesDesc || "Správa šablón zmlúv, kategórií a premenných"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {templateSubTab === "list" && (
            <Button
              onClick={() => {
                resetTemplateForm();
                setSelectedTemplate(null);
                setIsTemplateDialogOpen(true);
              }}
              data-testid="button-add-template"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.contractsModule.newTemplate}
            </Button>
          )}
          {templateSubTab === "categories" && (
            <Button
              onClick={() => {
                resetCategoryForm();
                setSelectedCategory(null);
                setIsCategoryDialogOpen(true);
              }}
              data-testid="button-add-category"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.contractsModule.newCategory}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={templateSubTab} onValueChange={(v) => setTemplateSubTab(v as TemplateSubTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="list" className="gap-2" data-testid="subtab-template-list">
            <FileText className="h-4 w-4" />
            {t.contractsModule.subTabList}
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2" data-testid="subtab-categories">
            <Settings className="h-4 w-4" />
            {t.contractsModule.subTabCategories}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-0">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Select value={filterCountry} onValueChange={(v) => { setFilterCountry(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-country">
                <SelectValue placeholder={t.contractsModule.templateCountry} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common?.allCountries || "Všetky krajiny"}</SelectItem>
                {COUNTRIES_LIST.map(c => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[200px]" data-testid="select-filter-category">
                <SelectValue placeholder={t.contractsModule.templateType} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common?.all || "Všetky kategórie"}</SelectItem>
                {uniqueCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{getCategoryLabelByValue(cat)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                <SelectValue placeholder={t.contractsModule.templateStatus} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common?.all || "Všetky"}</SelectItem>
                <SelectItem value="published">{t.contractsModule.templateActive}</SelectItem>
                <SelectItem value="draft">{t.contractsModule.statusDraft}</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredTemplates.length} {filteredTemplates.length === 1 ? "šablóna" : "šablón"}
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              {templatesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  {t.contractsModule.loading}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {templates.length === 0
                    ? t.contractsModule.noTemplates
                    : "Žiadne šablóny nezodpovedajú zvoleným filtrom."}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")} data-testid="sort-name">
                          <span className="flex items-center">{t.contractsModule.templateName}<SortIcon field="name" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("category")} data-testid="sort-category">
                          <span className="flex items-center">{t.contractsModule.templateType}<SortIcon field="category" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("country")} data-testid="sort-country">
                          <span className="flex items-center">{t.contractsModule.templateCountry}<SortIcon field="country" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")} data-testid="sort-status">
                          <span className="flex items-center">{t.contractsModule.templateStatus}<SortIcon field="status" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("date")} data-testid="sort-date">
                          <span className="flex items-center">{t.contractsModule.created}<SortIcon field="date" /></span>
                        </TableHead>
                        <TableHead className="text-right">{t.contractsModule.actions}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTemplates.map(template => (
                          <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                            <TableCell className="font-medium">{template.name}</TableCell>
                            <TableCell>
                              {getCategoryLabelByValue(template.category, template.countryCode)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{template.countryCode}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={template.status === "published" ? "default" : "secondary"}>
                                {template.status === "published" ? t.contractsModule.templateActive : t.contractsModule.statusDraft}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {template.createdAt && format(new Date(template.createdAt), "d.M.yyyy", { locale: sk })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEditTemplate(template)}
                                  data-testid={`button-edit-template-${template.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm(t.contractsModule.deleteTemplate + "?")) {
                                      deleteTemplateMutation.mutate(template.id);
                                    }
                                  }}
                                  data-testid={`button-delete-template-${template.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t">
                      <span className="text-sm text-muted-foreground">
                        {t.common?.page || "Strana"} {safePage} / {totalPages} ({filteredTemplates.length} {t.common?.results || "výsledkov"})
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage <= 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          data-testid="btn-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let page: number;
                          if (totalPages <= 5) {
                            page = i + 1;
                          } else if (safePage <= 3) {
                            page = i + 1;
                          } else if (safePage >= totalPages - 2) {
                            page = totalPages - 4 + i;
                          } else {
                            page = safePage - 2 + i;
                          }
                          return (
                            <Button
                              key={page}
                              variant={page === safePage ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              data-testid={`btn-page-${page}`}
                            >
                              {page}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage >= totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          data-testid="btn-next-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-0">
          <Card>
            <CardContent className="p-0">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>{t.contractsModule.categoryCode}</TableHead>
                      <TableHead>{t.contractsModule.categoryName}</TableHead>
                      <TableHead>{t.contractsModule.categoryDescription}</TableHead>
                      <TableHead>{t.contractsModule.categoryOrder}</TableHead>
                      <TableHead className="text-right">{t.contractsModule.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoriesLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t.contractsModule.loading}
                        </TableCell>
                      </TableRow>
                    ) : categories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t.contractsModule.noData}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <SortableContext
                        items={categories.map(c => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {categories.map(category => (
                          <SortableCategoryRow
                            key={category.id}
                            category={category}
                            onEdit={handleEditCategory}
                            onDelete={(id) => deleteCategoryMutation.mutate(id)}
                          />
                        ))}
                      </SortableContext>
                    )}
                  </TableBody>
                </Table>
              </DndContext>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{selectedTemplate ? t.contractsModule.editTemplate : t.contractsModule.newTemplate}</DialogTitle>
            <DialogDescription>
              {t.contractsModule.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex flex-col gap-4 py-4 h-full">
              <div className="grid grid-cols-5 gap-4 shrink-0">
                <div className="space-y-2">
                  <Label htmlFor="template-name">1. Názov šablóny</Label>
                  <Input
                    id="template-name"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="Zmluva o uchovávaní SK"
                    data-testid="input-template-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-category">2. Kategória</Label>
                  <Select
                    value={templateForm.category}
                    onValueChange={(value) => setTemplateForm({ ...templateForm, category: value, loadedFromCategory: false })}
                  >
                    <SelectTrigger id="template-category" data-testid="select-template-category">
                      <SelectValue placeholder={t.contractsModule.templateCategory} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length > 0 ? (
                        categories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))
                      ) : (
                        TEMPLATE_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-country">3. Krajina</Label>
                  <Select
                    value={templateForm.countryCode}
                    onValueChange={(value) => setTemplateForm({ ...templateForm, countryCode: value, loadedFromCategory: false })}
                  >
                    <SelectTrigger id="template-country" data-testid="select-template-country">
                      <SelectValue placeholder={t.contractsModule.templateCountry} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SK">Slovensko</SelectItem>
                      <SelectItem value="CZ">Česká republika</SelectItem>
                      <SelectItem value="HU">Maďarsko</SelectItem>
                      <SelectItem value="RO">Rumunsko</SelectItem>
                      <SelectItem value="IT">Taliansko</SelectItem>
                      <SelectItem value="DE">Nemecko</SelectItem>
                      <SelectItem value="US">USA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-description">Popis (voliteľný)</Label>
                  <Input
                    id="template-description"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    placeholder="Štandardná zmluva"
                    data-testid="input-template-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>4. Načítať vzor</Label>
                  <Button
                    onClick={handleLoadCategoryTemplate}
                    disabled={!templateForm.category || !templateForm.countryCode || loadingCategoryTemplate}
                    className="w-full"
                    data-testid="button-load-template"
                  >
                    {loadingCategoryTemplate ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Načítavam...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Načítať vzor
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator className="shrink-0" />

              {!templateForm.loadedFromCategory ? (
                <div className="flex-1 flex items-center justify-center min-h-0">
                  <div className="text-center text-muted-foreground p-8">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">{t.contractsModule.templateCategory}</p>
                    <p className="text-sm">Potom kliknite na "Načítať vzor" pre načítanie DOCX šablóny</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-hidden min-h-0">
                  <DocxTemplateEditor
                    categoryId={templateForm.loadedCategoryId!}
                    countryCode={templateForm.countryCode}
                    onSave={() => {
                      toast({ title: t.contractsModule.saved });
                    }}
                    onExtractedFieldsChange={(fields) => {
                      setTemplateForm(prev => ({ ...prev, extractedFields: fields }));
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t gap-2 shrink-0">
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!templateForm.name || !templateForm.loadedFromCategory || createTemplateMutation.isPending || updateTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              {createTemplateMutation.isPending || updateTemplateMutation.isPending ? t.contractsModule.saving : t.contractsModule.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => {
        setIsCategoryDialogOpen(open);
        if (!open) {
          resetCategoryForm();
          setSelectedCategory(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {categoryWizardStep === 0
                ? t.contractsModule.editCategory
                : selectedCategory
                  ? `${t.contractsModule.editCategory} - ${categoryWizardStep}/2`
                  : `${t.contractsModule.newCategory} - ${categoryWizardStep}/2`
              }
            </DialogTitle>
            <DialogDescription>
              {categoryWizardStep === 0 && t.contractsModule.editCategory}
              {categoryWizardStep === 1 && t.contractsModule.categoryDescription}
              {categoryWizardStep === 2 && t.contractsModule.categoryDescription}
            </DialogDescription>
          </DialogHeader>

          {categoryWizardStep > 0 && (
            <div className="flex gap-2 mb-4 px-1">
              {[1, 2].map(step => (
                <div
                  key={step}
                  className={`flex-1 h-2 rounded-full ${
                    step <= categoryWizardStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {categoryWizardStep === 1 && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category-value">Kód kategórie</Label>
                    <Input
                      id="category-value"
                      value={categoryForm.value}
                      onChange={(e) => setCategoryForm({ ...categoryForm, value: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      placeholder="cord_blood"
                      data-testid="input-category-value"
                    />
                    <p className="text-xs text-muted-foreground">Interný kód bez diakritiky a medzier</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category-sort-order">Poradie zobrazovania</Label>
                    <Input
                      id="category-sort-order"
                      type="number"
                      value={categoryForm.sortOrder}
                      onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value) || 0 })}
                      data-testid="input-category-sort-order"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category-label">Predvolený názov</Label>
                  <Input
                    id="category-label"
                    value={categoryForm.label}
                    onChange={(e) => setCategoryForm({ ...categoryForm, label: e.target.value })}
                    placeholder="Zmluva o uchovávaní krvotvorných buniek"
                    data-testid="input-category-label"
                  />
                  <p className="text-xs text-muted-foreground">Použije sa ak nie je dostupná jazyková mutácia</p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Jazykové mutácie názvu</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "sk", label: "Slovensko (SK)", field: "labelSk" as const, placeholder: "Zmluva o uchovávaní..." },
                      { id: "cz", label: "Česká republika (CZ)", field: "labelCz" as const, placeholder: "Smlouva o uchovávání..." },
                      { id: "hu", label: "Maďarsko (HU)", field: "labelHu" as const, placeholder: "Tárolási szerződés..." },
                      { id: "ro", label: "Rumunsko (RO)", field: "labelRo" as const, placeholder: "Contract de depozitare..." },
                      { id: "it", label: "Taliansko (IT)", field: "labelIt" as const, placeholder: "Contratto di conservazione..." },
                      { id: "de", label: "Nemecko (DE)", field: "labelDe" as const, placeholder: "Aufbewahrungsvertrag..." },
                      { id: "us", label: "USA (US)", field: "labelUs" as const, placeholder: "Storage Agreement..." },
                    ].map(lang => (
                      <div key={lang.id} className="space-y-1">
                        <Label htmlFor={`category-label-${lang.id}`} className="text-xs text-muted-foreground">{lang.label}</Label>
                        <Input
                          id={`category-label-${lang.id}`}
                          value={categoryForm[lang.field]}
                          onChange={(e) => setCategoryForm({ ...categoryForm, [lang.field]: e.target.value })}
                          placeholder={lang.placeholder}
                          data-testid={`input-category-label-${lang.id}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="category-description">Popis (voliteľný)</Label>
                  <Textarea
                    id="category-description"
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    placeholder="Popis kategórie..."
                    data-testid="input-category-description"
                  />
                </div>
              </div>
            )}

            {categoryWizardStep === 2 && (
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Šablóny zmlúv pre krajiny</Label>
                  <p className="text-xs text-muted-foreground">
                    Nahrajte <strong>Word dokumenty (DOCX)</strong> s premennými ako {"{{meno}}"}, {"{{adresa}}"}.
                    Tieto šablóny sa použijú na generovanie zmlúv pre zákazníkov.
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Tip: Ak máte PDF, otvorte ho v MS Word a uložte ako DOCX pred nahraním.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { code: "SK", name: "Slovensko" },
                    { code: "CZ", name: "Česká republika" },
                    { code: "HU", name: "Maďarsko" },
                    { code: "RO", name: "Rumunsko" },
                    { code: "IT", name: "Taliansko" },
                    { code: "DE", name: "Nemecko" },
                    { code: "US", name: "USA" },
                  ].map(country => {
                    const uploadState = categoryPdfUploads[country.code];
                    const hasFile = uploadState.uploaded || uploadState.file;
                    return (
                      <div
                        key={country.code}
                        className={`border rounded-lg overflow-hidden transition-colors ${
                          uploadState.uploaded
                            ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                            : 'border-dashed border-muted-foreground/30 hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                              uploadState.uploaded
                                ? 'bg-green-100 dark:bg-green-900/50'
                                : 'bg-muted'
                            }`}>
                              {uploadState.uploading ? (
                                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                              ) : uploadState.uploaded ? (
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <FileText className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{country.name}</span>
                                <Badge variant="outline" className="text-xs">{country.code}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {uploadState.uploading
                                  ? "Nahrávam..."
                                  : uploadState.uploaded
                                    ? "Šablóna nahraná"
                                    : uploadState.file
                                      ? uploadState.file.name
                                      : "Kliknite pre výber súboru"
                                }
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {uploadState.uploaded && (
                              <Badge variant="default" className="bg-blue-600 text-xs">
                                DOCX
                              </Badge>
                            )}
                            {uploadState.error && (
                              <Badge variant="destructive" className="text-xs">{uploadState.error}</Badge>
                            )}

                            <label
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-all ${
                                uploadState.uploaded
                                  ? 'bg-muted hover:bg-muted/80 text-foreground'
                                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                              } ${uploadState.uploading ? 'pointer-events-none opacity-50' : ''}`}
                            >
                              <input
                                type="file"
                                accept=".docx"
                                className="sr-only"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handlePdfUpload(country.code, file);
                                }}
                                disabled={uploadState.uploading}
                                data-testid={`input-template-${country.code}`}
                              />
                              {uploadState.uploaded ? (
                                <>
                                  <RefreshCw className="w-4 h-4" />
                                  Nahradiť
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  Vybrať
                                </>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-muted/50 rounded-md space-y-2">
                  <p className="text-sm font-medium">Formát: DOCX (Word dokument)</p>
                  <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                    <li>Použite premenné ako {"{{meno}}"}, {"{{priezvisko}}"}, {"{{adresa}}"} v texte dokumentu</li>
                    <li>Po nahraní si môžete šablónu stiahnuť, upraviť v MS Word a znova nahrať</li>
                    <li className="text-amber-600 dark:text-amber-400">Tip: Ak máte PDF, otvorte ho v MS Word a uložte ako DOCX pred nahraním</li>
                  </ul>
                </div>
              </div>
            )}

            {categoryWizardStep === 0 && selectedCategory && (
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="basic" data-testid="tab-category-basic">
                    <Settings className="h-4 w-4 mr-2" />
                    Základné
                  </TabsTrigger>
                  <TabsTrigger value="languages" data-testid="tab-category-languages">
                    <Globe className="h-4 w-4 mr-2" />
                    Jazyky
                  </TabsTrigger>
                  <TabsTrigger value="templates" data-testid="tab-category-templates">
                    <FileText className="h-4 w-4 mr-2" />
                    Šablóny
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-category-value">Kód kategórie</Label>
                      <Input
                        id="edit-category-value"
                        value={categoryForm.value}
                        onChange={(e) => setCategoryForm({ ...categoryForm, value: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                        placeholder="cord_blood"
                        data-testid="input-edit-category-value"
                      />
                      <p className="text-xs text-muted-foreground">Interný kód bez diakritiky</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category-sort-order">Poradie zobrazovania</Label>
                      <Input
                        id="edit-category-sort-order"
                        type="number"
                        value={categoryForm.sortOrder}
                        onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value) || 0 })}
                        data-testid="input-edit-category-sort-order"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-category-label">Predvolený názov</Label>
                    <Input
                      id="edit-category-label"
                      value={categoryForm.label}
                      onChange={(e) => setCategoryForm({ ...categoryForm, label: e.target.value })}
                      placeholder="Zmluva o uchovávaní krvotvorných buniek"
                      data-testid="input-edit-category-label"
                    />
                    <p className="text-xs text-muted-foreground">Použije sa ak nie je dostupná jazyková mutácia</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-category-description">Popis kategórie</Label>
                    <Textarea
                      id="edit-category-description"
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      placeholder="Popis kategórie..."
                      rows={3}
                      data-testid="input-edit-category-description"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="languages" className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-md mb-4">
                    <p className="text-sm text-muted-foreground">
                      Zadajte preklady názvu kategórie pre jednotlivé krajiny
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: "sk", label: "SK", name: "Slovensko", field: "labelSk" as const, placeholder: "Zmluva o uchovávaní..." },
                      { id: "cz", label: "CZ", name: "Česká republika", field: "labelCz" as const, placeholder: "Smlouva o uchovávání..." },
                      { id: "hu", label: "HU", name: "Maďarsko", field: "labelHu" as const, placeholder: "Tárolási szerződés..." },
                      { id: "ro", label: "RO", name: "Rumunsko", field: "labelRo" as const, placeholder: "Contract de depozitare..." },
                      { id: "it", label: "IT", name: "Taliansko", field: "labelIt" as const, placeholder: "Contratto di conservazione..." },
                      { id: "de", label: "DE", name: "Nemecko", field: "labelDe" as const, placeholder: "Aufbewahrungsvertrag..." },
                      { id: "us", label: "US", name: "USA", field: "labelUs" as const, placeholder: "Storage Agreement..." },
                    ].map(lang => (
                      <div key={lang.id} className="space-y-2">
                        <Label htmlFor={`edit-category-label-${lang.id}`} className="flex items-center gap-2">
                          <span className="text-lg">{lang.label}</span>
                          <span className="text-muted-foreground">{lang.name}</span>
                        </Label>
                        <Input
                          id={`edit-category-label-${lang.id}`}
                          value={categoryForm[lang.field]}
                          onChange={(e) => setCategoryForm({ ...categoryForm, [lang.field]: e.target.value })}
                          placeholder={lang.placeholder}
                          data-testid={`input-edit-category-label-${lang.id}`}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="templates" className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Nahrajte DOCX šablóny pre jednotlivé krajiny. Šablóny môžete stiahnuť, upraviť v MS Word a nahrať späť.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { code: "SK", name: "Slovensko" },
                      { code: "CZ", name: "Česká republika" },
                      { code: "HU", name: "Maďarsko" },
                      { code: "RO", name: "Rumunsko" },
                      { code: "IT", name: "Taliansko" },
                      { code: "DE", name: "Nemecko" },
                      { code: "US", name: "USA" },
                    ].map(country => {
                      const hasTemplate = categoryDefaultTemplates[country.code];
                      const uploadState = categoryPdfUploads[country.code];
                      const isConverting = uploadState?.uploading;

                      return (
                        <div key={country.code} className="relative">
                          {isConverting && (
                            <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-10 rounded-md flex flex-col items-center justify-center gap-4 p-4">
                              <div className="relative">
                                <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
                                <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <FileText className="w-6 h-6 text-primary" />
                                </div>
                              </div>
                              <div className="text-center space-y-1">
                                <p className="text-sm font-semibold text-foreground">Spracovávam DOCX šablónu</p>
                                <p className="text-xs text-muted-foreground">Extrahujem premenné a generujem náhľad...</p>
                              </div>
                              <div className="w-48 space-y-2">
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-full"
                                    style={{
                                      width: '100%',
                                      animation: 'shimmer 2s infinite linear',
                                      backgroundSize: '200% 100%'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div className={`border rounded-lg overflow-hidden ${isConverting ? 'opacity-50' : ''} ${hasTemplate ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' : 'border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors'}`}>
                            <div className="flex items-center gap-3 p-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${hasTemplate ? 'bg-green-100 dark:bg-green-900/50' : 'bg-muted'}`}>
                                  {hasTemplate ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                  ) : (
                                    <FileText className="w-5 h-5 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{country.name}</span>
                                    <Badge variant="outline" className="text-xs">{country.code}</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {hasTemplate
                                      ? "Šablóna nahraná"
                                      : "Nahrať DOCX šablónu"
                                    }
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {uploadState?.uploaded && (
                                  <Badge variant="default" className="bg-blue-600 text-xs">
                                    DOCX
                                  </Badge>
                                )}
                                {uploadState?.error && (
                                  <Badge variant="destructive" className="text-xs">Chyba</Badge>
                                )}

                                <label
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-all ${
                                    hasTemplate
                                      ? 'bg-muted hover:bg-muted/80 text-foreground'
                                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                  } ${isConverting ? 'pointer-events-none opacity-50' : ''}`}
                                >
                                  <input
                                    type="file"
                                    accept=".docx"
                                    className="sr-only"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file && selectedCategory) {
                                        setCategoryPdfUploads(prev => ({
                                          ...prev,
                                          [country.code]: { file, uploading: true, uploaded: false, error: undefined }
                                        }));

                                        try {
                                          const formData = new FormData();
                                          formData.append("file", file);
                                          formData.append("countryCode", country.code);

                                          const response = await fetch(`/api/contracts/categories/${selectedCategory.id}/default-templates/upload`, {
                                            method: "POST",
                                            body: formData,
                                            credentials: "include"
                                          });

                                          if (!response.ok) {
                                            const error = await response.json();
                                            throw new Error(error.error || "Upload failed");
                                          }

                                          const result = await response.json();

                                          setCategoryPdfUploads(prev => ({
                                            ...prev,
                                            [country.code]: {
                                              ...prev[country.code],
                                              uploading: false,
                                              uploaded: true,
                                              extractedFields: result.extractedFields || [],
                                            }
                                          }));
                                          setCategoryDefaultTemplates(prev => ({
                                            ...prev,
                                            [country.code]: true
                                          }));
                                          const fieldCount = result.extractedFields?.length || 0;
                                          toast({
                                            title: `Šablóna nahraná`,
                                            description: `${result.templateType === "docx" ? "DOCX" : "PDF formulár"} - ${fieldCount} polí nájdených`
                                          });
                                        } catch (error: any) {
                                          setCategoryPdfUploads(prev => ({
                                            ...prev,
                                            [country.code]: { ...prev[country.code], uploading: false, error: error.message }
                                          }));
                                          toast({
                                            title: "Chyba pri nahrávaní",
                                            description: error.message,
                                            variant: "destructive"
                                          });
                                        }
                                      }
                                    }}
                                    disabled={isConverting}
                                    data-testid={`input-reupload-template-${country.code}`}
                                  />
                                  {hasTemplate ? (
                                    <>
                                      <RefreshCw className="w-4 h-4" />
                                      Nahradiť
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-4 h-4" />
                                      Nahrať
                                    </>
                                  )}
                                </label>

                                {hasTemplate && !isConverting && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          const response = await fetch(`/api/contracts/categories/${selectedCategory.id}/default-templates/${country.code}/download`, {
                                            credentials: "include"
                                          });
                                          if (!response.ok) throw new Error("Download failed");
                                          const blob = await response.blob();
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url;
                                          a.download = `template_${selectedCategory.value}_${country.code}.docx`;
                                          a.click();
                                          URL.revokeObjectURL(url);
                                        } catch (error) {
                                          toast({ title: t.contractsModule.saveError, variant: "destructive" });
                                        }
                                      }}
                                      data-testid={`button-download-template-${country.code}`}
                                      title={t.contractsModule.downloadDocx}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        if (!confirm(`Naozaj chcete vymazať šablónu pre ${country.name}?`)) return;
                                        try {
                                          const response = await fetch(`/api/contracts/categories/${selectedCategory.id}/default-templates/${country.code}`, {
                                            method: "DELETE",
                                            credentials: "include"
                                          });
                                          if (!response.ok) throw new Error("Delete failed");
                                          setCategoryDefaultTemplates(prev => {
                                            const newState = { ...prev };
                                            delete newState[country.code];
                                            return newState;
                                          });
                                          setCategoryPdfUploads(prev => ({
                                            ...prev,
                                            [country.code]: { file: null, uploading: false, uploaded: false }
                                          }));
                                          toast({ title: t.contractsModule.templateDeleted });
                                          queryClient.invalidateQueries({ queryKey: ["/api/contracts/categories"] });
                                        } catch (error) {
                                          toast({ title: t.contractsModule.saveError, variant: "destructive" });
                                        }
                                      }}
                                      data-testid={`button-delete-template-${country.code}`}
                                      title={t.contractsModule.deleteTemplate}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t gap-2">
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Zrušiť
            </Button>

            {categoryWizardStep > 1 && (
              <Button variant="outline" onClick={() => setCategoryWizardStep(prev => prev - 1)}>
                Späť
              </Button>
            )}

            {categoryWizardStep === 1 && (
              <Button
                onClick={() => setCategoryWizardStep(2)}
                disabled={!categoryForm.value || !categoryForm.label}
              >
                {t.contractsModule.next}
              </Button>
            )}

            {categoryWizardStep === 0 && selectedCategory && (
              <Button
                onClick={async () => {
                  try {
                    await updateCategoryMutation.mutateAsync({ id: selectedCategory.id, data: categoryForm });
                    toast({ title: t.contractsModule.categoryUpdated });
                    setIsCategoryDialogOpen(false);
                    resetCategoryForm();
                    setSelectedCategory(null);
                  } catch (error: any) {
                    toast({
                      title: t.contractsModule.saveError,
                      description: error.message,
                      variant: "destructive"
                    });
                  }
                }}
                disabled={updateCategoryMutation.isPending || !categoryForm.value || !categoryForm.label}
                data-testid="button-save-category-edit"
              >
                {updateCategoryMutation.isPending ? t.contractsModule.saving : t.contractsModule.save}
              </Button>
            )}

            {categoryWizardStep === 2 && (
              <Button
                onClick={async () => {
                  try {
                    let categoryId: number;

                    if (selectedCategory) {
                      await updateCategoryMutation.mutateAsync({ id: selectedCategory.id, data: categoryForm });
                      categoryId = selectedCategory.id;
                      toast({ title: t.contractsModule.categoryUpdated });
                    } else {
                      const newCategory = await createCategoryMutation.mutateAsync(categoryForm);
                      categoryId = newCategory.id;
                      toast({ title: t.contractsModule.categoryCreated });
                    }

                    const hasFilesToUpload = Object.values(categoryPdfUploads).some(u => u.file);
                    if (hasFilesToUpload) {
                      const uploadResult = await uploadCategoryPdfs(categoryId);

                      if (uploadResult.errorCount > 0) {
                        toast({
                          title: "Niektoré PDF sa nepodarilo konvertovať",
                          description: uploadResult.errors.join(", "),
                          variant: "destructive"
                        });
                        return;
                      }

                      if (uploadResult.successCount > 0) {
                        toast({ title: `${uploadResult.successCount} PDF úspešne konvertovaných` });
                      }
                    }

                    setIsCategoryDialogOpen(false);
                    resetCategoryForm();
                    setSelectedCategory(null);
                  } catch (error: any) {
                    toast({
                      title: t.contractsModule.saveError,
                      description: error.message,
                      variant: "destructive"
                    });
                  }
                }}
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending || Object.values(categoryPdfUploads).some(u => u.uploading)}
                data-testid="button-save-category"
              >
                {createCategoryMutation.isPending || updateCategoryMutation.isPending ? t.contractsModule.saving : t.contractsModule.saveCategory}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTemplatePreviewOpen} onOpenChange={setIsTemplatePreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t.contractsModule.previewTab} - {templatePreviewCountry}</DialogTitle>
            <DialogDescription>
              {t.contractsModule.docxEditor}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto border rounded-md p-4 bg-white">
            {templatePreviewLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templatePreviewContent ? (
              <div
                className="prose max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: templatePreviewContent }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4" />
                <p>Pre náhľad DOCX šablóny otvorte editor mapovania</p>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsTemplatePreviewOpen(false)}>
              {t.contractsModule.cancel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTemplateEditorOpen} onOpenChange={setIsTemplateEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {t.contractsModule.editTemplate} - {editingTemplateCountry}
            </DialogTitle>
            <DialogDescription>
              {t.contractsModule.fieldMapping}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {isTemplateEditorLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Načítavam šablónu...</p>
              </div>
            ) : editingTemplateData ? (
              <Tabs defaultValue="editor" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="editor" data-testid="tab-template-editor">
                    <FileText className="h-4 w-4 mr-2" />
                    {t.contractsModule.docxEditor}
                  </TabsTrigger>
                  <TabsTrigger value="mapping" data-testid="tab-template-mapping">
                    <Settings className="h-4 w-4 mr-2" />
                    {t.contractsModule.fieldMapping}
                  </TabsTrigger>
                  <TabsTrigger value="preview" data-testid="tab-template-preview">
                    <Eye className="h-4 w-4 mr-2" />
                    {t.contractsModule.previewTab}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="h-[60vh]">
                  {editingTemplateData.templateType === "docx" && editingTemplateData.categoryId && editingTemplateData.countryCode ? (
                    <DocxEditor
                      categoryId={editingTemplateData.categoryId}
                      countryCode={editingTemplateData.countryCode}
                      onClose={() => setIsTemplateEditorOpen(false)}
                      onSave={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/contracts/categories"] });
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileText className="h-12 w-12 mb-4 opacity-50" />
                      <p>{t.contractsModule.docxEditor}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="mapping" className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                    <Badge variant={editingTemplateData.templateType === "docx" ? "default" : "secondary"}>
                      {editingTemplateData.templateType === "docx" ? "DOCX šablóna" : "PDF formulár"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {editingTemplateData.extractedFields.length} polí nájdených
                    </span>
                  </div>

                  {editingTemplateData.extractedFields.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4 p-2 bg-muted rounded-md flex-wrap">
                        <div className="grid grid-cols-2 gap-4 flex-1 font-medium text-sm">
                          <div>{t.contractsModule.templateField}</div>
                          <div>{t.contractsModule.customerData}</div>
                        </div>
                        <Button
                          size="sm"
                          onClick={async () => {
                            setAiMappingInProgress(true);
                            try {
                              const response = await fetch("/api/contracts/ai-mapping", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({
                                  extractedFields: editingTemplateData.extractedFields
                                })
                              });

                              if (!response.ok) {
                                throw new Error("AI mapping failed");
                              }

                              const result = await response.json();

                              if (result.mappings) {
                                setTemplateMappings(prev => ({ ...prev, ...result.mappings }));
                                toast({
                                  title: "AI mapovanie dokončené",
                                  description: `Namapovaných ${Object.keys(result.mappings).length} polí`
                                });
                              }
                            } catch (error) {
                              console.error("AI mapping error:", error);
                              toast({
                                title: "Chyba pri AI mapovaní",
                                variant: "destructive"
                              });
                            } finally {
                              setAiMappingInProgress(false);
                            }
                          }}
                          disabled={aiMappingInProgress}
                          data-testid="button-ai-mapping-category"
                        >
                          {aiMappingInProgress ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              AI mapuje...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-1" />
                              AI Mapovanie
                            </>
                          )}
                        </Button>
                      </div>

                      {editingTemplateData.extractedFields.map((field, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-4 items-center p-2 border rounded-md">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {editingTemplateData.templateType === "docx" ? `{{${field}}}` : field}
                            </Badge>
                          </div>
                          <Select
                            value={templateMappings[field] || "__none__"}
                            onValueChange={(value) => setTemplateMappings(prev => {
                              const newMappings = { ...prev };
                              if (value && value !== "__none__") {
                                newMappings[field] = value;
                              } else {
                                delete newMappings[field];
                              }
                              return newMappings;
                            })}
                          >
                            <SelectTrigger data-testid={`select-mapping-${idx}`}>
                              <SelectValue placeholder="Vyberte údaj..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">-- Nevyplnené --</SelectItem>
                              {CUSTOMER_FIELDS.map(group => (
                                <div key={group.group}>
                                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                                    {group.group}
                                  </div>
                                  {group.fields.map(f => (
                                    <SelectItem key={f.key} value={f.key}>
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground mb-4">Žiadne premenné neboli nájdené v šablóne.</p>

                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 max-w-md mx-auto text-left">
                        <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-3">Automatické vloženie premenných pomocou AI:</h4>
                        <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                          AI analyzuje text zmluvy a automaticky vloží premenné na správne miesta (mená, adresy, dátumy atď.)
                        </p>

                        <div className="flex flex-col gap-2">
                          {editingTemplateData.categoryId && editingTemplateData.countryCode && (
                            <>
                              <Button
                                onClick={async () => {
                                  setIsAiInsertingPlaceholders(true);
                                  try {
                                    const response = await fetch("/api/contracts/ai-insert-placeholders", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      credentials: "include",
                                      body: JSON.stringify({
                                        categoryId: editingTemplateData.categoryId,
                                        countryCode: editingTemplateData.countryCode
                                      })
                                    });

                                    if (!response.ok) {
                                      const error = await response.json();
                                      throw new Error(error.error || "AI insertion failed");
                                    }

                                    const result = await response.json();

                                    if (result.replacements && result.replacements.length > 0) {
                                      const extractedFields = result.replacements.map((r: any) => `{{${r.placeholder}}}`);
                                      const autoMappings: Record<string, string> = result.suggestedMappings || {};

                                      if (Object.keys(autoMappings).length === 0) {
                                        for (const r of result.replacements) {
                                          const templateField = `{{${r.placeholder}}}`;
                                          autoMappings[templateField] = r.crmField || r.placeholder;
                                        }
                                      }

                                      toast({
                                        title: "AI vložilo premenné",
                                        description: result.message || `Vložených ${result.replacements.length} premenných - mapovania boli automaticky nastavené`
                                      });

                                      setEditingTemplateData(prev => prev ? {
                                        ...prev,
                                        extractedFields: extractedFields,
                                        placeholderMappings: autoMappings,
                                        sourcePath: result.modifiedDocxPath || prev.sourcePath,
                                        aiProcessed: true
                                      } : null);
                                      setTemplateMappings(autoMappings);

                                      queryClient.invalidateQueries({ queryKey: ["/api/contracts/categories"] });
                                    } else {
                                      toast({
                                        title: "Žiadne zmeny",
                                        description: "Nenašli sa žiadne polia na nahradenie v dokumente",
                                        variant: "default"
                                      });
                                    }
                                  } catch (error) {
                                    console.error("Insertion error:", error);
                                    toast({
                                      title: "Chyba",
                                      description: (error as Error).message,
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsAiInsertingPlaceholders(false);
                                  }
                                }}
                                disabled={isAiInsertingPlaceholders}
                                data-testid="button-ai-insert-placeholders"
                              >
                                {isAiInsertingPlaceholders ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Analyzujem dokument...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Vložiť premenné automaticky
                                  </>
                                )}
                              </Button>

                              {editingTemplateData.aiProcessed && editingTemplateData.originalDocxPath && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    setIsResettingTemplate(true);
                                    try {
                                      const response = await fetch(`/api/contracts/categories/${editingTemplateData.categoryId}/default-templates/${editingTemplateData.countryCode}/reset`, {
                                        method: "POST",
                                        credentials: "include"
                                      });

                                      if (!response.ok) {
                                        const error = await response.json();
                                        throw new Error(error.error || "Reset failed");
                                      }

                                      const result = await response.json();

                                      toast({
                                        title: "Šablóna resetovaná",
                                        description: result.message
                                      });

                                      setEditingTemplateData(prev => prev ? {
                                        ...prev,
                                        extractedFields: result.extractedFields || [],
                                        placeholderMappings: {},
                                        sourcePath: result.sourceDocxPath || prev.sourcePath,
                                        aiProcessed: false
                                      } : null);
                                      setTemplateMappings({});

                                      queryClient.invalidateQueries({ queryKey: ["/api/contracts/categories"] });
                                    } catch (error) {
                                      console.error("Reset error:", error);
                                      toast({
                                        title: "Chyba pri resete",
                                        description: (error as Error).message,
                                        variant: "destructive"
                                      });
                                    } finally {
                                      setIsResettingTemplate(false);
                                    }
                                  }}
                                  disabled={isResettingTemplate}
                                  data-testid="button-reset-template"
                                >
                                  {isResettingTemplate ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Resetujem...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Resetovať na pôvodný stav
                                    </>
                                  )}
                                </Button>
                              )}

                              <div className="relative my-2">
                                <div className="absolute inset-0 flex items-center">
                                  <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                  <span className="bg-blue-50 dark:bg-blue-900/20 px-2 text-muted-foreground">alebo manuálne</span>
                                </div>
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  window.open(`/api/contracts/categories/${editingTemplateData.categoryId}/templates/${editingTemplateData.countryCode}/download`, '_blank');
                                }}
                                data-testid="button-download-docx"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {t.contractsModule.downloadDocx}
                              </Button>
                            </>
                          )}
                        </div>

                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-3">
                          Príklady premenných: {"{{customer.fullName}}"}, {"{{customer.address.city}}"}, {"{{contract.date}}"}
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="preview" className="space-y-4">
                  <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-md flex-wrap">
                    <div className="flex items-center gap-4 flex-wrap">
                      <Badge variant={editingTemplateData.templateType === "docx" ? "default" : "secondary"}>
                        {t.contractsModule.previewTab}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {editingTemplateData.extractedFields.length} premenných
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 border rounded-md p-1">
                        <Button
                          variant={!previewShowSampleData ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setPreviewShowSampleData(false)}
                          data-testid="button-preview-placeholders"
                        >
                          {t.contractsModule.templateField}
                        </Button>
                        <Button
                          variant={previewShowSampleData ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setPreviewShowSampleData(true)}
                          data-testid="button-preview-sample"
                        >
                          {t.contractsModule.customerData}
                        </Button>
                      </div>
                      {editingTemplateData.categoryId && editingTemplateData.countryCode && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.open(`/api/contracts/categories/${editingTemplateData.categoryId}/templates/${editingTemplateData.countryCode}/download`, '_blank');
                          }}
                          data-testid="button-download-docx-preview"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          {t.contractsModule.downloadDocx}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="border rounded-md">
                    <div className="p-3 border-b bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-medium text-sm">
                        {previewShowSampleData ? t.contractsModule.previewTab : t.contractsModule.templateField}
                      </h4>
                      <div className="flex items-center gap-2">
                        {previewShowSampleData ? (
                          <Badge variant="default" className="text-xs bg-green-600">
                            Vzorové dáta sú vyplnené
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            Premenné sú zvýraznené
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ScrollArea className="h-[400px]">
                      <div className="p-4">
                        {editingTemplateData.categoryId && editingTemplateData.countryCode ? (
                          <DocxPreviewContent
                            key={`preview-${previewShowSampleData}`}
                            categoryId={editingTemplateData.categoryId}
                            countryCode={editingTemplateData.countryCode}
                            extractedFields={editingTemplateData.extractedFields}
                            showSampleData={previewShowSampleData}
                          />
                        ) : (
                          <p className="text-muted-foreground text-center py-8">
                            Načítavam náhľad dokumentu...
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Tip:</strong> {previewShowSampleData
                        ? "Toto je ukážka ako bude vyzerať vyplnená zmluva. Vzorové dáta slúžia len na náhľad."
                        : "Premenné v tvare {{...}} sa pri generovaní zmluvy nahradia skutočnými údajmi zákazníka."}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">Šablóna nebola načítaná.</p>
                <p className="text-sm text-muted-foreground">Zatvorte dialóg a skúste znova.</p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsTemplateEditorOpen(false)}>
              Zrušiť
            </Button>
            <Button
              onClick={handleSaveMappings}
              disabled={savingMappings || !editingTemplateData}
              data-testid="button-save-mappings"
            >
              {savingMappings ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.contractsModule.saving}
                </>
              ) : (
                t.contractsModule.saveMappings
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}