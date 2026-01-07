import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PageHeader } from "@/components/page-header";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { 
  FileText, Plus, Edit2, Trash2, Send, Eye, Check, X, Clock, 
  FileSignature, Download, Copy, RefreshCw, AlertCircle, Filter,
  ChevronRight, Settings, PenTool, Mail, Phone, Shield, 
  CheckCircle, Loader2, Edit, Pencil, GripVertical, Globe, ExternalLink,
  Sparkles, ArrowRight, Maximize2, Minimize2, History, Save, User, RotateCcw
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
import type { 
  ContractTemplate, ContractInstance, Customer, BillingDetails, ContractCategory
} from "@shared/schema";
import { ContractTemplateEditor, DEFAULT_CONTRACT_TEMPLATE } from "@/components/contract-template-editor";
import { DocxEditor } from "@/components/docx-editor";
import { VariableBrowser } from "@/components/variable-browser";
import { DocxVariableEditor } from "@/components/docx-variable-editor";
import { SuperDocEditor } from "@/components/superdoc-editor";
import { DefaultEditor, BtnBold, BtnItalic, BtnUnderline, BtnNumberedList, BtnBulletList, Separator as EditorSeparator, Toolbar, Editor, BtnStyles } from "react-simple-wysiwyg";

type TabType = "templates" | "contracts";
type TemplateSubTab = "list" | "categories";

const CONTRACT_STATUSES: Record<string, { label: string; variant: "secondary" | "default" | "destructive"; icon: typeof FileText }> = {
  draft: { label: "Koncept", variant: "secondary" as const, icon: FileText },
  sent: { label: "Odoslaná", variant: "default" as const, icon: Send },
  pending_signature: { label: "Čaká na podpis", variant: "default" as const, icon: Clock },
  signed: { label: "Podpísaná", variant: "default" as const, icon: Check },
  completed: { label: "Dokončená", variant: "default" as const, icon: Check },
  cancelled: { label: "Zrušená", variant: "destructive" as const, icon: X },
  expired: { label: "Expirovaná", variant: "secondary" as const, icon: AlertCircle }
};

const TEMPLATE_CATEGORIES = [
  { value: "general", label: "Všeobecná zmluva" },
  { value: "cord_blood", label: "Zmluva o uchovávaní krvotvorných buniek" },
  { value: "service", label: "Zmluva o službách" },
  { value: "storage", label: "Zmluva o uchovávaní" },
  { value: "gdpr", label: "GDPR súhlas" }
];

const PRODUCT_OPTIONS = [
  { id: "standard", name: "Štandard", total: 590, payments: 2, deposit: 150, remaining: 440 },
  { id: "standard_tissue", name: "Štandard + tkanivo pupočníka", total: 790, payments: 2, deposit: 150, remaining: 640 },
  { id: "premium", name: "Prémium", total: 790, payments: 2, deposit: 150, remaining: 640 },
  { id: "premium_tissue", name: "Prémium + tkanivo pupočníka", total: 990, payments: 2, deposit: 150, remaining: 840 },
  { id: "tissue_only", name: "Tkanivo pupočníka", total: 300, payments: 1, deposit: 0, remaining: 300 },
  { id: "premium_all", name: "Prémium + tkanivo pupočníka + tkanivo placenty", total: 1490, payments: 2, deposit: 150, remaining: 1340 }
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

function VersionHistoryPanel({ 
  categoryId, 
  countryCode 
}: { 
  categoryId: number; 
  countryCode: string;
}) {
  const { toast } = useToast();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [versionDescription, setVersionDescription] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  
  const { data: versions = [], isLoading, refetch } = useQuery<{
    id: number;
    versionNumber: number;
    changeDescription: string | null;
    createdBy: string | null;
    createdAt: string;
  }[]>({
    queryKey: ['/api/contract-categories', categoryId, 'countries', countryCode, 'versions'],
    queryFn: async () => {
      const res = await fetch(`/api/contract-categories/${categoryId}/countries/${countryCode}/versions`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load versions');
      return res.json();
    }
  });
  
  const handleSaveVersion = async () => {
    setSavingVersion(true);
    try {
      const res = await fetch(`/api/contract-categories/${categoryId}/countries/${countryCode}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ changeDescription: versionDescription || undefined })
      });
      if (!res.ok) throw new Error('Failed to save version');
      toast({ title: "Verzia uložená", description: "Nová verzia šablóny bola vytvorená" });
      refetch();
      setSaveDialogOpen(false);
      setVersionDescription("");
    } catch (error) {
      toast({ title: "Chyba", description: "Nepodarilo sa uložiť verziu", variant: "destructive" });
    } finally {
      setSavingVersion(false);
    }
  };
  
  const handleRevert = async (versionId: number) => {
    if (!confirm("Naozaj chcete obnoviť túto verziu? Aktuálna šablóna bude prepísaná.")) return;
    try {
      const res = await fetch(`/api/contract-categories/${categoryId}/countries/${countryCode}/versions/${versionId}/revert`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to revert');
      toast({ title: "Verzia obnovená", description: "Šablóna bola vrátená na vybranú verziu" });
      refetch();
    } catch (error) {
      toast({ title: "Chyba", description: "Nepodarilo sa obnoviť verziu", variant: "destructive" });
    }
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sk-SK', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-md flex-wrap">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">História verzií</span>
          <Badge variant="secondary">{versions.length} verzií</Badge>
        </div>
        <Button onClick={() => setSaveDialogOpen(true)} data-testid="button-save-new-version">
          <Save className="h-4 w-4 mr-2" />
          Uložiť novú verziu
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : versions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <p className="font-medium">Žiadne uložené verzie</p>
          <p className="text-sm text-muted-foreground mt-1">
            Kliknite na "Uložiť novú verziu" pre vytvorenie zálohy aktuálnej šablóny
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 pr-4">
            {versions.map((version, idx) => (
              <Card key={version.id} className={idx === 0 ? "border-primary" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={idx === 0 ? "default" : "outline"}>
                          v{version.versionNumber}
                        </Badge>
                        {idx === 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Aktuálna
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {formatDate(version.createdAt)}
                        </span>
                      </div>
                      {version.changeDescription && (
                        <p className="mt-2 text-sm">{version.changeDescription}</p>
                      )}
                      {version.createdBy && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {version.createdBy}
                        </p>
                      )}
                    </div>
                    {idx > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRevert(version.id)}
                        data-testid={`button-revert-version-${version.id}`}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Obnoviť
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
      
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Tip:</strong> Uložte verziu pred veľkými zmenami. Obnovením verzie prepíšete aktuálnu šablónu uloženou verziou.
        </p>
      </div>
      
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uložiť novú verziu</DialogTitle>
            <DialogDescription>
              Vytvorte zálohu aktuálnej šablóny. Popis je voliteľný.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="version-description">Popis zmien (voliteľný)</Label>
              <Textarea
                id="version-description"
                placeholder="Napr. Pridané nové polia pre rodičov..."
                value={versionDescription}
                onChange={(e) => setVersionDescription(e.target.value)}
                data-testid="input-version-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={handleSaveVersion} disabled={savingVersion} data-testid="button-confirm-save-version">
              {savingVersion ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ukladám...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Uložiť verziu
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
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
        setSampleData(data.sampleData || {});
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
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
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
      
      let processedLine = line;
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

export default function ContractsPage() {
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const selectedCountry = selectedCountries.length === 1 ? selectedCountries[0] : null;
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlCustomerId = urlParams.get("customerId");
  
  const [activeTab, setActiveTab] = useState<TabType>("contracts");
  const [templateSubTab, setTemplateSubTab] = useState<TemplateSubTab>("list");
  
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ContractCategory | null>(null);
  const [isContractWizardOpen, setIsContractWizardOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [selectedContract, setSelectedContract] = useState<ContractInstance | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  
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
  
  const [templatePageImages, setTemplatePageImages] = useState<{ pageNumber: number; imageUrl: string; fileName: string }[]>([]);
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
  const [isTemplatePreviewOpen, setIsTemplatePreviewOpen] = useState(false);
  const [templatePreviewContent, setTemplatePreviewContent] = useState("");
  const [templatePreviewCountry, setTemplatePreviewCountry] = useState("");
  const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false);
  const [categoryDefaultTemplates, setCategoryDefaultTemplates] = useState<Record<string, boolean>>({});
  
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [isTemplateEditorLoading, setIsTemplateEditorLoading] = useState(false);
  const [isAiInsertingPlaceholders, setIsAiInsertingPlaceholders] = useState(false);
  const [isEditorMaximized, setIsEditorMaximized] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [variableStyle, setVariableStyle] = useState<"bold" | "highlight" | "brackets">("brackets");
  const [isResettingTemplate, setIsResettingTemplate] = useState(false);
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
  const [previewShowSampleData, setPreviewShowSampleData] = useState(false);
  
  const [contractForm, setContractForm] = useState({
    templateId: "",
    customerId: "",
    billingDetailsId: "",
    currency: "EUR",
    notes: "",
    selectedProductId: ""
  });
  
  const [urlCustomerProcessed, setUrlCustomerProcessed] = useState(false);
  
  const [signatureForm, setSignatureForm] = useState({
    otpCode: "",
    signatureRequestId: ""
  });
  const [otpVerified, setOtpVerified] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  
  const [participantForm, setParticipantForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "signer",
    participantType: "customer", // customer, billing_company, internal_witness, guarantor
    signatureRequired: true
  });
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [selectedProductSetId, setSelectedProductSetId] = useState("");
  const [expandedProductSetId, setExpandedProductSetId] = useState<string | null>(null);
  
  type SignatureRequest = {
    id: string;
    contractId: string;
    signerName: string;
    signerEmail: string | null;
    status: string;
    otpVerifiedAt: string | null;
  };
  
  const { data: signatureRequests } = useQuery<SignatureRequest[]>({
    queryKey: ["/api/contracts", selectedContract?.id, "signature-requests"],
    queryFn: async () => {
      if (!selectedContract?.id) return [];
      const response = await fetch(`/api/contracts/${selectedContract.id}/signature-requests`, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isSignatureModalOpen && !!selectedContract?.id
  });

  useEffect(() => {
    if (signatureRequests && signatureRequests.length > 0) {
      const activeRequest = signatureRequests.find(r => r.status === "otp_verified") 
        || signatureRequests.find(r => r.status === "sent");
      if (activeRequest) {
        setSignatureForm(prev => ({ ...prev, signatureRequestId: activeRequest.id }));
        if (activeRequest.status === "otp_verified") {
          setOtpVerified(true);
        }
      }
    }
  }, [signatureRequests]);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contracts/templates", selectedCountry],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ContractCategory[]>({
    queryKey: ["/api/contracts/categories"],
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<ContractInstance[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  useEffect(() => {
    if (urlCustomerId && customers.length > 0 && !urlCustomerProcessed) {
      const customerExists = customers.some(c => c.id === urlCustomerId);
      if (customerExists) {
        setContractForm(prev => ({ ...prev, customerId: urlCustomerId }));
        setIsContractWizardOpen(true);
        toast({ 
          title: "Zákazník vybraný", 
          description: customers.find(c => c.id === urlCustomerId)?.firstName + " " + customers.find(c => c.id === urlCustomerId)?.lastName 
        });
      }
      setUrlCustomerProcessed(true);
    }
  }, [urlCustomerId, customers, urlCustomerProcessed, toast]);

  const { data: billingDetails = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm) => {
      return apiRequest("POST", "/api/contracts/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      setIsTemplateDialogOpen(false);
      resetTemplateForm();
      toast({ title: "Šablóna vytvorená", description: "Šablóna zmluvy bola úspešne vytvorená." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť šablónu.", variant: "destructive" });
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
      toast({ title: "Šablóna aktualizovaná", description: "Šablóna bola úspešne uložená." });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/contracts/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      toast({ title: "Šablóna vymazaná" });
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
      toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť kategóriu.", variant: "destructive" });
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
      toast({ title: "Chyba", description: "Nepodarilo sa aktualizovať kategóriu.", variant: "destructive" });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/contracts/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/categories"] });
      toast({ title: "Kategória vymazaná" });
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

  const createContractMutation = useMutation({
    mutationFn: async (data: typeof contractForm) => {
      return apiRequest("POST", "/api/contracts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsContractWizardOpen(false);
      setWizardStep(1);
      resetContractForm();
      toast({ title: "Zmluva vytvorená", description: "Zmluva bola úspešne vytvorená." });
    }
  });

  const sendContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/contracts/${id}/send`);
      const data = await response.json() as { success: boolean; signersCount: number; signatureRequests: Array<{ id: string; signerName: string; signerEmail: string | null; status: string }> };
      return { ...data, contractId: id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      if (data.signatureRequests && data.signatureRequests.length > 0) {
        setSignatureForm(prev => ({ ...prev, signatureRequestId: data.signatureRequests[0].id }));
      }
      toast({ title: "Zmluva odoslaná", description: "Zmluva bola odoslaná na podpis." });
    }
  });

  const cancelContractMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", `/api/contracts/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Zmluva zrušená" });
    }
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ contractId, otpCode, signatureRequestId }: { contractId: string; otpCode: string; signatureRequestId: string }) => {
      const response = await apiRequest("POST", `/api/contracts/${contractId}/verify-otp`, { otpCode, signatureRequestId });
      return await response.json() as { success: boolean; verified: boolean; signatureRequestId: string };
    },
    onSuccess: (data) => {
      setOtpVerified(true);
      if (data.signatureRequestId) {
        setSignatureForm(prev => ({ ...prev, signatureRequestId: data.signatureRequestId }));
      }
      toast({ title: "OTP overené", description: "Kód bol úspešne overený. Teraz môžete podpísať zmluvu." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Neplatný alebo expirovaný kód.", variant: "destructive" });
    }
  });

  const signContractMutation = useMutation({
    mutationFn: async ({ contractId, signatureRequestId, signatureData }: { contractId: string; signatureRequestId: string; signatureData: string }) => {
      return apiRequest("POST", `/api/contracts/${contractId}/sign`, { 
        signatureRequestId, 
        signatureData,
        signatureType: "typed"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsSignatureModalOpen(false);
      setOtpVerified(false);
      setSignatureForm({ otpCode: "", signatureRequestId: "" });
      setSignatureData("");
      toast({ title: "Zmluva podpísaná", description: "Zmluva bola úspešne elektronicky podpísaná." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa podpísať zmluvu.", variant: "destructive" });
    }
  });

  const renderContractMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/contracts/${id}/render`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      toast({ title: "Zmluva vygenerovaná" });
    }
  });

  const regenerateContractMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/contracts/${id}/regenerate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      toast({ title: "Zmluva regenerovaná", description: "Zmluva bola znovu vygenerovaná s aktuálnymi údajmi." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa regenerovať zmluvu.", variant: "destructive" });
    }
  });

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const downloadContractPdf = async (contractId: string, contractNumber: string) => {
    setIsDownloadingPdf(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/pdf`, { credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Nepodarilo sa stiahnuť PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zmluva-${contractNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({ title: "PDF stiahnuté", description: "PDF zmluvy bolo úspešne stiahnuté." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepodarilo sa stiahnuť PDF";
      toast({ title: "Chyba", description: message, variant: "destructive" });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const addParticipantMutation = useMutation({
    mutationFn: async ({ contractId, data }: { contractId: string; data: typeof participantForm }) => {
      return apiRequest("POST", `/api/contracts/${contractId}/participants`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      setIsAddingParticipant(false);
      setEditingParticipantId(null);
      setParticipantForm({ fullName: "", email: "", phone: "", role: "signer", participantType: "customer", signatureRequired: true });
      toast({ title: "Účastník pridaný" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa pridať účastníka.", variant: "destructive" });
    }
  });

  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);

  const updateParticipantMutation = useMutation({
    mutationFn: async ({ contractId, participantId, data }: { contractId: string; participantId: string; data: typeof participantForm }) => {
      return apiRequest("PATCH", `/api/contracts/${contractId}/participants/${participantId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      setIsAddingParticipant(false);
      setEditingParticipantId(null);
      setParticipantForm({ fullName: "", email: "", phone: "", role: "signer", participantType: "customer", signatureRequired: true });
      toast({ title: "Účastník upravený" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa upraviť účastníka.", variant: "destructive" });
    }
  });

  const deleteParticipantMutation = useMutation({
    mutationFn: async ({ contractId, participantId }: { contractId: string; participantId: string }) => {
      return apiRequest("DELETE", `/api/contracts/${contractId}/participants/${participantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      toast({ title: "Účastník odstránený" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa odstrániť účastníka.", variant: "destructive" });
    }
  });

  type ContractDetail = ContractInstance & {
    participants?: Array<{
      id: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      role: string;
      participantType: string;
      signatureRequired: boolean;
    }>;
    products?: Array<{
      id: string;
      productId: string;
      productSetId: string;
      quantity: number;
      priceOverride: string | null;
    }>;
  };

  const { data: contractDetail } = useQuery<ContractDetail>({
    queryKey: ["/api/contracts", selectedContract?.id],
    enabled: isPreviewOpen && !!selectedContract?.id
  });

  type ProductWithSets = {
    id: string;
    name: string;
    setsCount: number;
  };

  type ProductSet = {
    id: string;
    name: string;
    productId: string;
    productName: string;
    countryCode: string | null;
    currency: string;
    totalGrossAmount: string | null;
  };

  type ProductSetDetail = {
    id: string;
    name: string;
    productId: string;
    productName: string;
    currency: string;
    collections: Array<{
      id: string;
      instanceName: string | null;
      priceName: string | null;
      priceAmount: string | null;
      discountName: string | null;
      discountPercent: string | null;
      vatName: string | null;
      vatPercent: string | null;
      quantity: number;
      lineNetAmount: string | null;
      lineDiscountAmount: string | null;
      lineVatAmount: string | null;
      lineGrossAmount: string | null;
    }>;
    storage: Array<{
      id: string;
      serviceName: string | null;
      priceName: string | null;
      priceAmount: string | null;
      lineGrossAmount: string | null;
    }>;
    calculatedTotals: {
      totalNetAmount: string;
      totalDiscountAmount: string;
      totalVatAmount: string;
      totalGrossAmount: string;
    };
  };

  // Get customer's country to filter products and sets
  const contractCustomer = customers.find(c => c.id === selectedContract?.customerId);
  const customerCountry = contractCustomer?.country?.toUpperCase();

  // State for selected product in two-step selection
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // Get products that have billsets for customer's country
  const { data: productsWithSets = [] } = useQuery<ProductWithSets[]>({
    queryKey: ["/api/products-with-sets", customerCountry],
    queryFn: async () => {
      const url = customerCountry 
        ? `/api/products-with-sets?country=${encodeURIComponent(customerCountry)}`
        : "/api/products-with-sets";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    enabled: isPreviewOpen && !!selectedContract?.id && !!customerCountry
  });

  // Get ALL billsets for customer's country (for displaying added products)
  const { data: allProductSets = [] } = useQuery<ProductSet[]>({
    queryKey: ["/api/product-sets-all", customerCountry],
    queryFn: async () => {
      const url = customerCountry 
        ? `/api/product-sets?country=${encodeURIComponent(customerCountry)}`
        : "/api/product-sets";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch product sets");
      return res.json();
    },
    enabled: isPreviewOpen && !!selectedContract?.id && !!customerCountry
  });

  // Get detailed info for expanded product set (with price breakdown)
  const { data: expandedProductSetDetail, isLoading: loadingProductSetDetail } = useQuery<ProductSetDetail>({
    queryKey: ["/api/product-sets", expandedProductSetId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/product-sets/${expandedProductSetId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch product set details");
      return res.json();
    },
    enabled: !!expandedProductSetId
  });

  // Get billsets for selected product (for dropdown selection)
  const { data: productSets = [] } = useQuery<ProductSet[]>({
    queryKey: ["/api/product-sets", selectedProductId, customerCountry],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProductId) params.append("productId", selectedProductId);
      if (customerCountry) params.append("country", customerCountry);
      const url = `/api/product-sets?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch product sets");
      return res.json();
    },
    enabled: isPreviewOpen && !!selectedContract?.id && !!selectedProductId && !!customerCountry
  });

  const addContractProductMutation = useMutation({
    mutationFn: async ({ contractId, productSetId }: { contractId: string; productSetId: string }) => {
      return apiRequest("POST", `/api/contracts/${contractId}/products`, { 
        productSetId,
        quantity: 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-sets-all", customerCountry] });
      setIsAddingProduct(false);
      setSelectedProductSetId("");
      setSelectedProductId("");
      toast({ title: "Produkt pridaný" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa pridať produkt.", variant: "destructive" });
    }
  });

  const removeContractProductMutation = useMutation({
    mutationFn: async ({ contractId, productId }: { contractId: string; productId: string }) => {
      return apiRequest("DELETE", `/api/contracts/${contractId}/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      toast({ title: "Produkt odstránený" });
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
  
  const handleLoadCategoryTemplate = async () => {
    if (!templateForm.category || !templateForm.countryCode) {
      toast({ title: "Vyberte kategóriu a krajinu", variant: "destructive" });
      return;
    }
    
    const category = categories?.find((c: ContractCategory) => c.value === templateForm.category);
    if (!category) {
      toast({ title: "Kategória nenájdená", variant: "destructive" });
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
      
      // Parse placeholderMappings if it's a string
      let mappings = template.placeholderMappings || {};
      if (typeof mappings === 'string') {
        try {
          mappings = JSON.parse(mappings);
        } catch (e) {
          console.error('Failed to parse placeholderMappings:', e);
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
      
      // Load HTML content for WYSIWYG editing
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
      
      toast({ title: "Šablóna načítaná", description: `Načítaná DOCX šablóna z kategórie "${category.label}"` });
    } catch (error) {
      console.error("Error loading category template:", error);
      toast({ title: "Chyba pri načítaní šablóny", variant: "destructive" });
    } finally {
      setLoadingCategoryTemplate(false);
    }
  };
  
  const handleAiMapping = async () => {
    if (templateForm.extractedFields.length === 0) {
      toast({ title: "Žiadne premenné na mapovanie", description: "Najprv načítajte šablónu s premennými", variant: "destructive" });
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
      toast({ title: "Chyba pri AI mapovaní", variant: "destructive" });
    } finally {
      setAiMappingInProgress(false);
    }
  };

  const resetContractForm = () => {
    setContractForm({
      templateId: "",
      customerId: "",
      billingDetailsId: "",
      currency: "EUR",
      notes: "",
      selectedProductId: ""
    });
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
        
        // Normalize to string array - extract name from objects if needed
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
        
        // Check if AI has processed this template
        let aiProcessed = false;
        if (template.conversionMetadata) {
          try {
            const meta = typeof template.conversionMetadata === 'string' 
              ? JSON.parse(template.conversionMetadata) 
              : template.conversionMetadata;
            aiProcessed = !!meta.aiProcessedAt;
          } catch (e) {}
        }
        
        console.log('[Template Editor] Loaded template:', { templateType: template.templateType, extractedFields, mappings, aiProcessed });
        
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
        toast({ title: "Mapovanie uložené", description: `Uložených ${Object.keys(filteredMappings).length} mapovaní.` });
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
            templateType: result.templateType
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

  const handleCreateContract = () => {
    createContractMutation.mutate(contractForm);
  };

  const filteredTemplates = templates.filter(t => 
    !selectedCountry || t.countryCode === selectedCountry
  );

  const filteredContracts = contracts.filter(c => {
    const customer = customers.find(cust => cust.id === c.customerId);
    return !selectedCountry || customer?.country === selectedCountry;
  });

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : "Neznámy";
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

  const getStatusBadge = (status: string) => {
    const config = CONTRACT_STATUSES[status as keyof typeof CONTRACT_STATUSES] || CONTRACT_STATUSES.draft;
    return (
      <Badge variant={config.variant} className="gap-1">
        <config.icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

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

  return (
    <div className="flex flex-col h-full">
      <PageHeader 
        title="Zmluvy"
        description="Správa zmlúv a šablón"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <TabsList>
              <TabsTrigger value="contracts" className="gap-2" data-testid="tab-contracts">
                <FileSignature className="h-4 w-4" />
                Zmluvy
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2" data-testid="tab-templates">
                <FileText className="h-4 w-4" />
                Šablóny
              </TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2 flex-wrap">
              {activeTab === "templates" && templateSubTab === "list" && (
                <Button 
                  onClick={() => {
                    resetTemplateForm();
                    setSelectedTemplate(null);
                    setIsTemplateDialogOpen(true);
                  }}
                  data-testid="button-add-template"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nová šablóna
                </Button>
              )}
              {activeTab === "templates" && templateSubTab === "categories" && (
                <Button 
                  onClick={() => {
                    resetCategoryForm();
                    setSelectedCategory(null);
                    setIsCategoryDialogOpen(true);
                  }}
                  data-testid="button-add-category"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nová kategória
                </Button>
              )}
              {activeTab === "contracts" && (
                <Button onClick={() => setIsContractWizardOpen(true)} data-testid="button-add-contract">
                  <Plus className="h-4 w-4 mr-2" />
                  Nová zmluva
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="templates" className="mt-0">
            <Tabs value={templateSubTab} onValueChange={(v) => setTemplateSubTab(v as TemplateSubTab)}>
              <TabsList className="mb-4">
                <TabsTrigger value="list" className="gap-2" data-testid="subtab-template-list">
                  <FileText className="h-4 w-4" />
                  Šablóny
                </TabsTrigger>
                <TabsTrigger value="categories" className="gap-2" data-testid="subtab-categories">
                  <Settings className="h-4 w-4" />
                  Kategórie
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="mt-0">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Názov</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Krajina</TableHead>
                          <TableHead>Stav</TableHead>
                          <TableHead>Vytvorená</TableHead>
                          <TableHead className="text-right">Akcie</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templatesLoading ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Načítavam...
                            </TableCell>
                          </TableRow>
                        ) : filteredTemplates.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Žiadne šablóny
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredTemplates.map(template => (
                            <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                              <TableCell className="font-medium">{template.name}</TableCell>
                              <TableCell>
                                {getCategoryLabelByValue(template.category, template.countryCode)}
                              </TableCell>
                              <TableCell>{template.countryCode}</TableCell>
                              <TableCell>
                                <Badge variant={template.status === "published" ? "default" : "secondary"}>
                                  {template.status === "published" ? "Publikovaná" : "Koncept"}
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
                                      if (confirm("Naozaj chcete vymazať túto šablónu?")) {
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
                          ))
                        )}
                      </TableBody>
                    </Table>
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
                            <TableHead>Kód</TableHead>
                            <TableHead>Názov</TableHead>
                            <TableHead>Popis</TableHead>
                            <TableHead>Poradie</TableHead>
                            <TableHead className="text-right">Akcie</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoriesLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Načítavam...
                              </TableCell>
                            </TableRow>
                          ) : categories.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Žiadne kategórie
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
          </TabsContent>

          <TabsContent value="contracts" className="mt-0">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Číslo zmluvy</TableHead>
                      <TableHead>Klient</TableHead>
                      <TableHead>Stav</TableHead>
                      <TableHead>Suma</TableHead>
                      <TableHead>Vytvorená</TableHead>
                      <TableHead className="text-right">Akcie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Načítavam...
                        </TableCell>
                      </TableRow>
                    ) : filteredContracts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Žiadne zmluvy
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContracts.map(contract => (
                        <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                          <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                          <TableCell>{getCustomerName(contract.customerId)}</TableCell>
                          <TableCell>{getStatusBadge(contract.status)}</TableCell>
                          <TableCell>
                            {contract.totalGrossAmount} {contract.currency}
                          </TableCell>
                          <TableCell>
                            {contract.createdAt && format(new Date(contract.createdAt), "d.M.yyyy", { locale: sk })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedContract(contract);
                                  setIsPreviewOpen(true);
                                }}
                                data-testid={`button-preview-contract-${contract.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {contract.status === "draft" && (
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => sendContractMutation.mutate(contract.id)}
                                  data-testid={`button-send-contract-${contract.id}`}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              {(contract.status === "draft" || contract.status === "sent") && (
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => {
                                    const reason = prompt("Dôvod zrušenia:");
                                    if (reason) {
                                      cancelContractMutation.mutate({ id: contract.id, reason });
                                    }
                                  }}
                                  data-testid={`button-cancel-contract-${contract.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{selectedTemplate ? "Upraviť šablónu" : "Nová šablóna zmluvy"}</DialogTitle>
            <DialogDescription>
              Vytvorte šablónu zmluvy načítaním vzoru z kategórie a namapovaním premenných.
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
                      <SelectValue placeholder="Vyberte kategóriu" />
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
                      <SelectValue placeholder="Vyberte krajinu" />
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
                    <p className="text-lg font-medium mb-2">Vyberte kategóriu a krajinu</p>
                    <p className="text-sm">Potom kliknite na "Načítať vzor" pre načítanie DOCX šablóny</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-hidden min-h-0">
                  <SuperDocEditor
                    categoryId={templateForm.loadedCategoryId!}
                    countryCode={templateForm.countryCode}
                    onSave={() => {
                      toast({ title: "Zmeny uložené" });
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
              {createTemplateMutation.isPending || updateTemplateMutation.isPending ? "Ukladám..." : "Uložiť šablónu"}
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
                ? "Upraviť kategóriu" 
                : selectedCategory 
                  ? `Upraviť kategóriu - Krok ${categoryWizardStep}/2`
                  : `Nová kategória zmluvy - Krok ${categoryWizardStep}/2`
              }
            </DialogTitle>
            <DialogDescription>
              {categoryWizardStep === 0 && "Upravte informácie a prezrite si konvertované šablóny"}
              {categoryWizardStep === 1 && "Zadajte základné informácie a jazykové mutácie"}
              {categoryWizardStep === 2 && "Nahrajte PDF šablóny pre jednotlivé krajiny (voliteľné)"}
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
                    <div className="space-y-1">
                      <Label htmlFor="category-label-sk" className="text-xs text-muted-foreground">Slovensko (SK)</Label>
                      <Input
                        id="category-label-sk"
                        value={categoryForm.labelSk}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelSk: e.target.value })}
                        placeholder="Zmluva o uchovávaní..."
                        data-testid="input-category-label-sk"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="category-label-cz" className="text-xs text-muted-foreground">Česká republika (CZ)</Label>
                      <Input
                        id="category-label-cz"
                        value={categoryForm.labelCz}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelCz: e.target.value })}
                        placeholder="Smlouva o uchovávání..."
                        data-testid="input-category-label-cz"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="category-label-hu" className="text-xs text-muted-foreground">Maďarsko (HU)</Label>
                      <Input
                        id="category-label-hu"
                        value={categoryForm.labelHu}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelHu: e.target.value })}
                        placeholder="Tárolási szerződés..."
                        data-testid="input-category-label-hu"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="category-label-ro" className="text-xs text-muted-foreground">Rumunsko (RO)</Label>
                      <Input
                        id="category-label-ro"
                        value={categoryForm.labelRo}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelRo: e.target.value })}
                        placeholder="Contract de depozitare..."
                        data-testid="input-category-label-ro"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="category-label-it" className="text-xs text-muted-foreground">Taliansko (IT)</Label>
                      <Input
                        id="category-label-it"
                        value={categoryForm.labelIt}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelIt: e.target.value })}
                        placeholder="Contratto di conservazione..."
                        data-testid="input-category-label-it"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="category-label-de" className="text-xs text-muted-foreground">Nemecko (DE)</Label>
                      <Input
                        id="category-label-de"
                        value={categoryForm.labelDe}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelDe: e.target.value })}
                        placeholder="Aufbewahrungsvertrag..."
                        data-testid="input-category-label-de"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="category-label-us" className="text-xs text-muted-foreground">USA (US)</Label>
                      <Input
                        id="category-label-us"
                        value={categoryForm.labelUs}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelUs: e.target.value })}
                        placeholder="Storage Agreement..."
                        data-testid="input-category-label-us"
                      />
                    </div>
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
                    { code: "SK", name: "Slovensko", flag: "SK" },
                    { code: "CZ", name: "Česká republika", flag: "CZ" },
                    { code: "HU", name: "Maďarsko", flag: "HU" },
                    { code: "RO", name: "Rumunsko", flag: "RO" },
                    { code: "IT", name: "Taliansko", flag: "IT" },
                    { code: "DE", name: "Nemecko", flag: "DE" },
                    { code: "US", name: "USA", flag: "US" },
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
                    <div className="space-y-2">
                      <Label htmlFor="edit-category-label-sk" className="flex items-center gap-2">
                        <span className="text-lg">SK</span>
                        <span className="text-muted-foreground">Slovensko</span>
                      </Label>
                      <Input
                        id="edit-category-label-sk"
                        value={categoryForm.labelSk}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelSk: e.target.value })}
                        placeholder="Zmluva o uchovávaní..."
                        data-testid="input-edit-category-label-sk"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category-label-cz" className="flex items-center gap-2">
                        <span className="text-lg">CZ</span>
                        <span className="text-muted-foreground">Česká republika</span>
                      </Label>
                      <Input
                        id="edit-category-label-cz"
                        value={categoryForm.labelCz}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelCz: e.target.value })}
                        placeholder="Smlouva o uchovávání..."
                        data-testid="input-edit-category-label-cz"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category-label-hu" className="flex items-center gap-2">
                        <span className="text-lg">HU</span>
                        <span className="text-muted-foreground">Maďarsko</span>
                      </Label>
                      <Input
                        id="edit-category-label-hu"
                        value={categoryForm.labelHu}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelHu: e.target.value })}
                        placeholder="Tárolási szerződés..."
                        data-testid="input-edit-category-label-hu"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category-label-ro" className="flex items-center gap-2">
                        <span className="text-lg">RO</span>
                        <span className="text-muted-foreground">Rumunsko</span>
                      </Label>
                      <Input
                        id="edit-category-label-ro"
                        value={categoryForm.labelRo}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelRo: e.target.value })}
                        placeholder="Contract de depozitare..."
                        data-testid="input-edit-category-label-ro"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category-label-it" className="flex items-center gap-2">
                        <span className="text-lg">IT</span>
                        <span className="text-muted-foreground">Taliansko</span>
                      </Label>
                      <Input
                        id="edit-category-label-it"
                        value={categoryForm.labelIt}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelIt: e.target.value })}
                        placeholder="Contratto di conservazione..."
                        data-testid="input-edit-category-label-it"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category-label-de" className="flex items-center gap-2">
                        <span className="text-lg">DE</span>
                        <span className="text-muted-foreground">Nemecko</span>
                      </Label>
                      <Input
                        id="edit-category-label-de"
                        value={categoryForm.labelDe}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelDe: e.target.value })}
                        placeholder="Aufbewahrungsvertrag..."
                        data-testid="input-edit-category-label-de"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category-label-us" className="flex items-center gap-2">
                        <span className="text-lg">US</span>
                        <span className="text-muted-foreground">USA</span>
                      </Label>
                      <Input
                        id="edit-category-label-us"
                        value={categoryForm.labelUs}
                        onChange={(e) => setCategoryForm({ ...categoryForm, labelUs: e.target.value })}
                        placeholder="Storage Agreement..."
                        data-testid="input-edit-category-label-us"
                      />
                    </div>
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
                                              templateType: result.templateType
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
                                          toast({ title: "Chyba pri sťahovaní", variant: "destructive" });
                                        }
                                      }}
                                      data-testid={`button-download-template-${country.code}`}
                                      title="Stiahnuť šablónu"
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
                                          toast({ title: "Šablóna vymazaná" });
                                          queryClient.invalidateQueries({ queryKey: ["/api/contracts/categories"] });
                                        } catch (error) {
                                          toast({ title: "Chyba pri mazaní", variant: "destructive" });
                                        }
                                      }}
                                      data-testid={`button-delete-template-${country.code}`}
                                      title="Vymazať šablónu"
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
                Ďalej
              </Button>
            )}
            
            {categoryWizardStep === 0 && selectedCategory && (
              <Button 
                onClick={async () => {
                  try {
                    await updateCategoryMutation.mutateAsync({ id: selectedCategory.id, data: categoryForm });
                    toast({ title: "Kategória aktualizovaná" });
                    setIsCategoryDialogOpen(false);
                    resetCategoryForm();
                    setSelectedCategory(null);
                  } catch (error: any) {
                    toast({
                      title: "Chyba pri ukladaní",
                      description: error.message || "Nepodarilo sa uložiť zmeny",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={updateCategoryMutation.isPending || !categoryForm.value || !categoryForm.label}
                data-testid="button-save-category-edit"
              >
                {updateCategoryMutation.isPending ? "Ukladám..." : "Uložiť zmeny"}
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
                      toast({ title: "Kategória aktualizovaná" });
                    } else {
                      const newCategory = await createCategoryMutation.mutateAsync(categoryForm);
                      categoryId = newCategory.id;
                      toast({ title: "Kategória vytvorená" });
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
                      title: "Chyba pri ukladaní kategórie",
                      description: error.message || "Nepodarilo sa uložiť kategóriu",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending || Object.values(categoryPdfUploads).some(u => u.uploading)}
                data-testid="button-save-category"
              >
                {createCategoryMutation.isPending || updateCategoryMutation.isPending ? "Ukladám..." : "Uložiť a konvertovať"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTemplatePreviewOpen} onOpenChange={setIsTemplatePreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Náhľad šablóny - {templatePreviewCountry}</DialogTitle>
            <DialogDescription>
              DOCX šablóna s premennými
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
              Zavrieť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isContractWizardOpen} onOpenChange={setIsContractWizardOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nová zmluva - Krok {wizardStep}/3</DialogTitle>
            <DialogDescription>
              {wizardStep === 1 && "Vyberte šablónu zmluvy a klienta"}
              {wizardStep === 2 && "Vyberte fakturačné údaje a produkty"}
              {wizardStep === 3 && "Skontrolujte a potvrďte zmluvu"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex gap-2 mb-6">
              {[1, 2, 3].map(step => (
                <div 
                  key={step}
                  className={`flex-1 h-2 rounded-full ${
                    step <= wizardStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            
            {wizardStep === 1 && (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Šablóna zmluvy</Label>
                  <Select
                    value={contractForm.templateId}
                    onValueChange={(value) => setContractForm({ ...contractForm, templateId: value })}
                  >
                    <SelectTrigger data-testid="select-contract-template">
                      <SelectValue placeholder="Vyberte šablónu" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTemplates.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          Žiadne šablóny. Najprv vytvorte šablónu zmluvy.
                        </div>
                      ) : (
                        filteredTemplates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} {template.status === "draft" && "(koncept)"}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Klient</Label>
                  <Select
                    value={contractForm.customerId}
                    onValueChange={(value) => setContractForm({ ...contractForm, customerId: value })}
                  >
                    <SelectTrigger data-testid="select-contract-customer">
                      <SelectValue placeholder="Vyberte klienta" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName} - {customer.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {wizardStep === 2 && (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Fakturačná spoločnosť</Label>
                  <Select
                    value={contractForm.billingDetailsId}
                    onValueChange={(value) => setContractForm({ ...contractForm, billingDetailsId: value })}
                  >
                    <SelectTrigger data-testid="select-contract-billing">
                      <SelectValue placeholder="Vyberte fakturačné údaje" />
                    </SelectTrigger>
                    <SelectContent>
                      {billingDetails.map(bd => (
                        <SelectItem key={bd.id} value={bd.id}>
                          {bd.companyName} ({bd.countryCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mena</Label>
                    <Select
                      value={contractForm.currency}
                      onValueChange={(value) => setContractForm({ ...contractForm, currency: value })}
                    >
                      <SelectTrigger data-testid="select-contract-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="CZK">CZK</SelectItem>
                        <SelectItem value="HUF">HUF</SelectItem>
                        <SelectItem value="RON">RON</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Poznámky</Label>
                  <Textarea
                    value={contractForm.notes}
                    onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                    placeholder="Interné poznámky k zmluve..."
                    data-testid="textarea-contract-notes"
                  />
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Výber produktu</Label>
                  <p className="text-sm text-muted-foreground">Vyberte produkt, ktorý bude označený v zmluve</p>
                  
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#2c3e50] text-white">
                          <th className="p-2 text-center w-10">X</th>
                          <th className="p-2 text-left">Typ produktu</th>
                          <th className="p-2 text-right">Celkom</th>
                          <th className="p-2 text-center">Platieb</th>
                          <th className="p-2 text-right">Záloha</th>
                          <th className="p-2 text-right bg-[#f39c12]">Zostáva</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PRODUCT_OPTIONS.map((product, index) => (
                          <tr 
                            key={product.id}
                            className={`cursor-pointer transition-colors ${
                              contractForm.selectedProductId === product.id 
                                ? "bg-primary/10" 
                                : index % 2 === 0 ? "bg-muted/30" : "bg-background"
                            }`}
                            onClick={() => setContractForm({ ...contractForm, selectedProductId: product.id })}
                            data-testid={`product-row-${product.id}`}
                          >
                            <td className="p-2 text-center">
                              <div 
                                className={`w-4 h-4 rounded-full border-2 mx-auto flex items-center justify-center ${
                                  contractForm.selectedProductId === product.id 
                                    ? "border-primary bg-primary" 
                                    : "border-muted-foreground"
                                }`}
                              >
                                {contractForm.selectedProductId === product.id && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                            </td>
                            <td className="p-2">{product.name}</td>
                            <td className="p-2 text-right font-medium">{product.total} EUR</td>
                            <td className="p-2 text-center">{product.payments}</td>
                            <td className="p-2 text-right">{product.deposit} EUR</td>
                            <td className="p-2 text-right font-bold bg-yellow-100 dark:bg-yellow-900/30">{product.remaining} EUR</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {contractForm.selectedProductId && (
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-md border border-yellow-300 dark:border-yellow-700">
                      <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Vybraný produkt:</p>
                      {(() => {
                        const p = PRODUCT_OPTIONS.find(p => p.id === contractForm.selectedProductId);
                        if (!p) return null;
                        return (
                          <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-0.5">
                            <p>{p.name}</p>
                            <p>Celková suma: <strong>{p.total} EUR</strong></p>
                            <p>Záloha: {p.deposit} EUR | Zostávajúca platba: <strong>{p.remaining} EUR</strong></p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {wizardStep === 3 && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Zhrnutie zmluvy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Šablóna:</span>
                      <span>{templates.find(t => t.id === contractForm.templateId)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Klient:</span>
                      <span>{getCustomerName(contractForm.customerId)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fakturácia:</span>
                      <span>{billingDetails.find(b => b.id === contractForm.billingDetailsId)?.companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mena:</span>
                      <span>{contractForm.currency}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Produkt:</span>
                      <span className="font-medium">{PRODUCT_OPTIONS.find(p => p.id === contractForm.selectedProductId)?.name || "-"}</span>
                    </div>
                    {contractForm.selectedProductId && (() => {
                      const p = PRODUCT_OPTIONS.find(p => p.id === contractForm.selectedProductId);
                      if (!p) return null;
                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Celková suma:</span>
                            <span className="font-bold">{p.total} EUR</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Záloha:</span>
                            <span>{p.deposit} EUR</span>
                          </div>
                          <div className="flex justify-between text-yellow-700 dark:text-yellow-300">
                            <span>Zostávajúca platba:</span>
                            <span className="font-bold">{p.remaining} EUR</span>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
                
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <Shield className="h-5 w-5 text-primary" />
                  <p className="text-sm">
                    Zmluva bude vygenerovaná s označeným produktom. 
                    Následne ju môžete odoslať klientovi na podpis.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (wizardStep > 1) setWizardStep(wizardStep - 1);
              else setIsContractWizardOpen(false);
            }}>
              {wizardStep > 1 ? "Späť" : "Zrušiť"}
            </Button>
            {wizardStep < 3 ? (
              <Button 
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={
                  (wizardStep === 1 && (!contractForm.templateId || !contractForm.customerId)) ||
                  (wizardStep === 2 && (!contractForm.billingDetailsId || !contractForm.selectedProductId))
                }
                data-testid="button-wizard-next"
              >
                Ďalej
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleCreateContract}
                disabled={createContractMutation.isPending}
                data-testid="button-create-contract"
              >
                {createContractMutation.isPending ? "Vytváram..." : "Vytvoriť zmluvu"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Zmluva {selectedContract?.contractNumber}
            </DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div>
                  <span className="text-sm text-muted-foreground">Stav:</span>
                  <div className="mt-1">{getStatusBadge(selectedContract.status)}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Klient:</span>
                  <div className="mt-1 font-medium">{getCustomerName(selectedContract.customerId)}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Fakturačná spoločnosť:</span>
                  <div className="mt-1 font-medium">
                    {billingDetails.find(b => b.id === selectedContract.billingDetailsId)?.companyName || "Nevybraná"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Suma:</span>
                  <div className="mt-1 font-medium">
                    {selectedContract.totalGrossAmount || "0"} {selectedContract.currency}
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {selectedContract.status === "draft" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <PenTool className="h-4 w-4" />
                      Podpisovatelia
                    </h4>
                    {!isAddingParticipant && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const customer = customers.find(c => c.id === selectedContract.customerId);
                          if (customer) {
                            setParticipantForm({
                              fullName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
                              email: customer.email || "",
                              phone: customer.phone || customer.mobile || "",
                              role: "signer",
                              participantType: "customer",
                              signatureRequired: true
                            });
                          }
                          setIsAddingParticipant(true);
                        }}
                        data-testid="button-add-participant"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Pridať
                      </Button>
                    )}
                  </div>
                  
                  {contractDetail?.participants && contractDetail.participants.length > 0 ? (
                    <div className="space-y-2">
                      {contractDetail.participants.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 p-2 border rounded-md bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium text-sm">{p.fullName}</div>
                              <div className="text-xs text-muted-foreground">
                                {p.email && <span>{p.email}</span>}
                                {p.email && p.phone && <span> | </span>}
                                {p.phone && <span>{p.phone}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{p.role}</Badge>
                            {p.signatureRequired && <Badge>Podpis</Badge>}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingParticipantId(p.id);
                                setParticipantForm({
                                  fullName: p.fullName,
                                  email: p.email || "",
                                  phone: p.phone || "",
                                  role: p.role,
                                  participantType: p.participantType || "customer",
                                  signatureRequired: p.signatureRequired
                                });
                                setIsAddingParticipant(true);
                              }}
                              data-testid={`button-edit-participant-${p.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteParticipantMutation.mutate({
                                contractId: selectedContract.id,
                                participantId: p.id
                              })}
                              data-testid={`button-delete-participant-${p.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      Žiadni podpisovatelia. Pridajte aspoň jedného podpisovateľa pre odoslanie zmluvy.
                    </p>
                  )}
                  
                  {isAddingParticipant && (
                    <div className="p-3 border rounded-md space-y-3 bg-muted/30">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="participantName">Meno a priezvisko</Label>
                          <Input
                            id="participantName"
                            value={participantForm.fullName}
                            onChange={(e) => setParticipantForm({ ...participantForm, fullName: e.target.value })}
                            data-testid="input-participant-name"
                          />
                        </div>
                        <div>
                          <Label>Typ účastníka</Label>
                          <Select 
                            value={participantForm.participantType} 
                            onValueChange={(v) => setParticipantForm({ ...participantForm, participantType: v })}
                          >
                            <SelectTrigger data-testid="select-participant-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="customer">Klient / Zákazník</SelectItem>
                              <SelectItem value="billing_company">Poskytovateľ / Firma</SelectItem>
                              <SelectItem value="internal_witness">Interný svedok</SelectItem>
                              <SelectItem value="guarantor">Ručiteľ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Rola pri podpise</Label>
                          <Select 
                            value={participantForm.role} 
                            onValueChange={(v) => setParticipantForm({ ...participantForm, role: v })}
                          >
                            <SelectTrigger data-testid="select-participant-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="signer">Podpisovateľ</SelectItem>
                              <SelectItem value="witness">Svedok</SelectItem>
                              <SelectItem value="authorized_representative">Splnomocnený zástupca</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="participantEmail">Email</Label>
                          <Input
                            id="participantEmail"
                            type="email"
                            value={participantForm.email}
                            onChange={(e) => setParticipantForm({ ...participantForm, email: e.target.value })}
                            data-testid="input-participant-email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="participantPhone">Telefón</Label>
                          <Input
                            id="participantPhone"
                            value={participantForm.phone}
                            onChange={(e) => setParticipantForm({ ...participantForm, phone: e.target.value })}
                            data-testid="input-participant-phone"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="signatureRequired"
                            checked={participantForm.signatureRequired}
                            onChange={(e) => setParticipantForm({ ...participantForm, signatureRequired: e.target.checked })}
                            className="rounded"
                          />
                          <Label htmlFor="signatureRequired" className="text-sm cursor-pointer">Vyžaduje podpis</Label>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            setIsAddingParticipant(false);
                            setEditingParticipantId(null);
                            setParticipantForm({ fullName: "", email: "", phone: "", role: "signer", participantType: "customer", signatureRequired: true });
                          }}>
                            Zrušiť
                          </Button>
                          <Button 
                            size="sm"
                            disabled={!participantForm.fullName || addParticipantMutation.isPending || updateParticipantMutation.isPending}
                            onClick={() => {
                              if (editingParticipantId) {
                                updateParticipantMutation.mutate({
                                  contractId: selectedContract.id,
                                  participantId: editingParticipantId,
                                  data: participantForm
                                });
                              } else {
                                addParticipantMutation.mutate({
                                  contractId: selectedContract.id,
                                  data: participantForm
                                });
                              }
                            }}
                            data-testid="button-save-participant"
                          >
                            {(addParticipantMutation.isPending || updateParticipantMutation.isPending) 
                              ? <Loader2 className="h-4 w-4 animate-spin" /> 
                              : editingParticipantId ? "Upraviť" : "Uložiť"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <Separator className="my-4" />
                  
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Produkty / Cenové sady
                    </h4>
                    {!isAddingProduct && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsAddingProduct(true)}
                        data-testid="button-add-product"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Pridať produkt
                      </Button>
                    )}
                  </div>
                  
                  {contractDetail?.products && contractDetail.products.length > 0 ? (
                    <div className="space-y-2">
                      {contractDetail.products.map((p) => {
                        const productSet = allProductSets.find(ps => ps.id === p.productSetId);
                        const isExpanded = expandedProductSetId === p.productSetId;
                        const detail = isExpanded ? expandedProductSetDetail : null;
                        const totalPrice = detail?.calculatedTotals?.totalGrossAmount || productSet?.totalGrossAmount || p.priceOverride;
                        const currency = productSet?.currency || selectedContract.currency;
                        
                        return (
                          <div key={p.id} className="border rounded-md bg-muted/50 overflow-hidden">
                            <div 
                              className="flex items-center justify-between gap-2 p-2 cursor-pointer hover-elevate"
                              onClick={() => setExpandedProductSetId(isExpanded ? null : p.productSetId)}
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                <div>
                                  <div className="font-medium text-sm">
                                    {productSet ? `${productSet.productName}: ${productSet.name}` : "Neznámy produkt"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Množstvo: {p.quantity} | Celkom: {totalPrice ? `${totalPrice} ${currency}` : "načítavam..."}
                                  </div>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeContractProductMutation.mutate({ 
                                    contractId: selectedContract.id, 
                                    productId: p.id 
                                  });
                                }}
                                data-testid={`button-remove-product-${p.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            
                            {isExpanded && (
                              <div className="border-t p-3 bg-background/50">
                                {loadingProductSetDetail ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    <span className="text-sm text-muted-foreground">Načítavam...</span>
                                  </div>
                                ) : detail ? (
                                  <div className="space-y-3">
                                    <h5 className="text-sm font-medium">Rekapitulácia ceny</h5>
                                    
                                    {detail.collections && detail.collections.length > 0 && (
                                      <div className="space-y-1">
                                        <div className="text-xs font-medium text-muted-foreground uppercase">Odbery</div>
                                        {detail.collections.map((col, idx) => (
                                          <div key={col.id || idx} className="flex justify-between text-sm py-1 border-b border-dashed">
                                            <span>{col.instanceName || "Položka"}: {col.priceName || ""}</span>
                                            <span className="font-mono">{col.lineGrossAmount || col.priceAmount || "0.00"} {currency}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {detail.storage && detail.storage.length > 0 && (
                                      <div className="space-y-1">
                                        <div className="text-xs font-medium text-muted-foreground uppercase">Úložné služby</div>
                                        {detail.storage.map((stor, idx) => (
                                          <div key={stor.id || idx} className="flex justify-between text-sm py-1 border-b border-dashed">
                                            <span>{stor.serviceName || "Služba"}: {stor.priceName || ""}</span>
                                            <span className="font-mono">{stor.lineGrossAmount || stor.priceAmount || "0.00"} {currency}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    <div className="pt-2 space-y-1 border-t">
                                      <div className="flex justify-between text-sm">
                                        <span>Základ:</span>
                                        <span className="font-mono">{detail.calculatedTotals.totalNetAmount} {currency}</span>
                                      </div>
                                      {parseFloat(detail.calculatedTotals.totalDiscountAmount) > 0 && (
                                        <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                                          <span>Zľava:</span>
                                          <span className="font-mono">-{detail.calculatedTotals.totalDiscountAmount} {currency}</span>
                                        </div>
                                      )}
                                      {parseFloat(detail.calculatedTotals.totalVatAmount) > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span>DPH:</span>
                                          <span className="font-mono">{detail.calculatedTotals.totalVatAmount} {currency}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between text-sm font-bold pt-1 border-t">
                                        <span>Celkom:</span>
                                        <span className="font-mono">{detail.calculatedTotals.totalGrossAmount} {currency}</span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Nepodarilo sa načítať detail.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      Žiadne produkty. Pridajte produkty pre výpočet ceny zmluvy.
                    </p>
                  )}
                  
                  {isAddingProduct && (
                    <div className="p-3 border rounded-md space-y-3 bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-2">
                        Krajina zákazníka: <span className="font-medium">{customerCountry || "Neurčená"}</span>
                      </div>
                      <div>
                        <Label>1. Vyberte produkt</Label>
                        <Select 
                          value={selectedProductId} 
                          onValueChange={(v) => {
                            setSelectedProductId(v);
                            setSelectedProductSetId("");
                          }}
                        >
                          <SelectTrigger data-testid="select-product">
                            <SelectValue placeholder="Vyberte produkt" />
                          </SelectTrigger>
                          <SelectContent>
                            {!customerCountry ? (
                              <div className="p-2 text-sm text-muted-foreground">Zákazník nemá nastavenú krajinu</div>
                            ) : productsWithSets.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground">Žiadne produkty pre krajinu {customerCountry}</div>
                            ) : (
                              productsWithSets.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({p.setsCount} cenových sád)
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedProductId && (
                        <div>
                          <Label>2. Vyberte cenovú sadu</Label>
                          <Select 
                            value={selectedProductSetId} 
                            onValueChange={setSelectedProductSetId}
                          >
                            <SelectTrigger data-testid="select-product-set">
                              <SelectValue placeholder="Vyberte cenovú sadu" />
                            </SelectTrigger>
                            <SelectContent>
                              {productSets.length === 0 ? (
                                <div className="p-2 text-sm text-muted-foreground">Žiadne cenové sady</div>
                              ) : (
                                productSets.map((ps) => (
                                  <SelectItem key={ps.id} value={ps.id}>
                                    {ps.name} - {ps.totalGrossAmount || "0"} {ps.currency}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setIsAddingProduct(false);
                          setSelectedProductId("");
                          setSelectedProductSetId("");
                        }}>
                          Zrušiť
                        </Button>
                        <Button 
                          size="sm"
                          disabled={!selectedProductSetId || addContractProductMutation.isPending}
                          onClick={() => {
                            addContractProductMutation.mutate({
                              contractId: selectedContract.id,
                              productSetId: selectedProductSetId
                            });
                            setSelectedProductId("");
                          }}
                          data-testid="button-save-product"
                        >
                          {addContractProductMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pridať"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <Separator />
              
              {selectedContract.renderedHtml || contractDetail?.renderedHtml ? (
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert p-4 border rounded-md bg-white dark:bg-gray-900"
                  dangerouslySetInnerHTML={{ __html: selectedContract.renderedHtml || contractDetail?.renderedHtml || "" }}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Zmluva ešte nebola vygenerovaná</p>
                  <Button 
                    variant="outline" 
                    className="mt-2"
                    disabled={renderContractMutation.isPending}
                    onClick={() => renderContractMutation.mutate(selectedContract.id)}
                    data-testid="button-render-preview"
                  >
                    {renderContractMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Vygenerovať náhľad
                  </Button>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Zavrieť
            </Button>
            {selectedContract && (selectedContract.renderedHtml || contractDetail?.renderedHtml) && (
              <Button 
                variant="outline"
                disabled={regenerateContractMutation.isPending}
                onClick={() => regenerateContractMutation.mutate(selectedContract.id)}
                data-testid="button-regenerate-contract"
              >
                {regenerateContractMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Regenerovať
              </Button>
            )}
            {selectedContract && (
              <Button 
                variant="outline"
                disabled={isDownloadingPdf}
                onClick={() => downloadContractPdf(selectedContract.id, selectedContract.contractNumber)}
                data-testid="button-download-pdf"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Stiahnuť PDF
              </Button>
            )}
            {selectedContract?.status === "draft" && (
              <Button onClick={() => {
                if (selectedContract) {
                  sendContractMutation.mutate(selectedContract.id);
                  setIsPreviewOpen(false);
                }
              }}>
                <Send className="h-4 w-4 mr-2" />
                Odoslať na podpis
              </Button>
            )}
            {(selectedContract?.status === "sent" || selectedContract?.status === "pending_signature") && (
              <Button onClick={() => {
                setIsPreviewOpen(false);
                setOtpVerified(false);
                setSignatureForm({ otpCode: "", signatureRequestId: "" });
                setSignatureData("");
                setIsSignatureModalOpen(true);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Podpísať zmluvu
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Modal */}
      <Dialog open={isSignatureModalOpen} onOpenChange={(open) => {
        setIsSignatureModalOpen(open);
        if (!open) {
          setOtpVerified(false);
          setSignatureForm({ otpCode: "", signatureRequestId: "" });
          setSignatureData("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Elektronický podpis zmluvy</DialogTitle>
            <DialogDescription>
              {selectedContract?.contractNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-4">
              {!otpVerified ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <span className="font-medium">Overenie identity</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Na email/telefón klienta bol odoslaný 6-miestny overovací kód. 
                      Zadajte ho pre pokračovanie v podpise.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otpCode">Overovací kód (OTP)</Label>
                    <Input
                      id="otpCode"
                      placeholder="123456"
                      maxLength={6}
                      value={signatureForm.otpCode}
                      onChange={(e) => setSignatureForm({
                        ...signatureForm,
                        otpCode: e.target.value.replace(/\D/g, "").slice(0, 6)
                      })}
                      className="text-center text-2xl tracking-widest"
                      data-testid="input-otp-code"
                    />
                  </div>

                  <Button
                    className="w-full"
                    disabled={signatureForm.otpCode.length !== 6 || verifyOtpMutation.isPending || !signatureForm.signatureRequestId}
                    onClick={() => {
                      if (!signatureForm.signatureRequestId) {
                        toast({ title: "Chyba", description: "Nebola nájdená žiadosť o podpis.", variant: "destructive" });
                        return;
                      }
                      verifyOtpMutation.mutate({
                        contractId: selectedContract.id,
                        otpCode: signatureForm.otpCode,
                        signatureRequestId: signatureForm.signatureRequestId
                      });
                    }}
                    data-testid="button-verify-otp"
                  >
                    {verifyOtpMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Overiť kód
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-700 dark:text-green-400">
                        Identita overená
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signatureData">Podpis (napíšte svoje meno)</Label>
                    <Input
                      id="signatureData"
                      placeholder="Meno a priezvisko"
                      value={signatureData}
                      onChange={(e) => setSignatureData(e.target.value)}
                      className="italic"
                      data-testid="input-signature"
                    />
                    <p className="text-xs text-muted-foreground">
                      Napísaním svojho mena potvrdzujete, že ste si prečítali a súhlasíte s obsahom zmluvy.
                    </p>
                  </div>

                  <div className="p-3 border rounded-md bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Náhľad podpisu:</div>
                    <div className="text-xl italic font-serif text-center py-2 border-b-2 border-foreground/30">
                      {signatureData || "Váš podpis"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsSignatureModalOpen(false)}
            >
              Zrušiť
            </Button>
            {otpVerified && (
              <Button
                disabled={!signatureData.trim() || signContractMutation.isPending || !signatureForm.signatureRequestId}
                onClick={() => {
                  if (selectedContract && signatureForm.signatureRequestId) {
                    signContractMutation.mutate({
                      contractId: selectedContract.id,
                      signatureRequestId: signatureForm.signatureRequestId,
                      signatureData: signatureData
                    });
                  } else {
                    toast({ title: "Chyba", description: "Neplatná žiadosť o podpis.", variant: "destructive" });
                  }
                }}
                data-testid="button-sign-contract"
              >
                {signContractMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Edit className="h-4 w-4 mr-2" />
                )}
                Podpísať zmluvu
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTemplateEditorOpen} onOpenChange={setIsTemplateEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Upraviť šablónu - {editingTemplateCountry}
            </DialogTitle>
            <DialogDescription>
              Priraďte polia šablóny k údajom zákazníka. Pri generovaní zmluvy sa tieto hodnoty automaticky vyplnia.
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
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="editor" data-testid="tab-template-editor">
                    <FileText className="h-4 w-4 mr-2" />
                    DOCX Editor
                  </TabsTrigger>
                  <TabsTrigger value="mapping" data-testid="tab-template-mapping">
                    <Settings className="h-4 w-4 mr-2" />
                    Mapovanie polí
                  </TabsTrigger>
                  <TabsTrigger value="preview" data-testid="tab-template-preview">
                    <Eye className="h-4 w-4 mr-2" />
                    Náhľad
                  </TabsTrigger>
                  <TabsTrigger value="history" data-testid="tab-template-history">
                    <History className="h-4 w-4 mr-2" />
                    História
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
                      <p>DOCX editor je dostupný len pre DOCX šablóny</p>
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
                      <div className="flex items-center justify-between gap-4 p-2 bg-muted rounded-md">
                        <div className="grid grid-cols-2 gap-4 flex-1 font-medium text-sm">
                          <div>Pole v šablóne</div>
                          <div>Údaj zákazníka</div>
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
                                Stiahnuť DOCX a upraviť v Worde
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
                        DOCX náhľad
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
                          Premenné
                        </Button>
                        <Button
                          variant={previewShowSampleData ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setPreviewShowSampleData(true)}
                          data-testid="button-preview-sample"
                        >
                          Vzorové dáta
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
                          Stiahnuť DOCX
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="border rounded-md">
                    <div className="p-3 border-b bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-medium text-sm">
                        {previewShowSampleData ? "Náhľad so vzorovými dátami" : "Text dokumentu s premennými"}
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
                
                <TabsContent value="history" className="space-y-4">
                  {editingTemplateData.categoryId && editingTemplateData.countryCode ? (
                    <VersionHistoryPanel 
                      categoryId={editingTemplateData.categoryId}
                      countryCode={editingTemplateData.countryCode}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <History className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                      <p className="text-muted-foreground">História nie je dostupná</p>
                    </div>
                  )}
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
                  Ukladám...
                </>
              ) : (
                "Uložiť mapovanie"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
