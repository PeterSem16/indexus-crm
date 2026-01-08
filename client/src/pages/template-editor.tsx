import { useLocation } from "wouter";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, Upload, ArrowLeft, FileText, Sparkles, RefreshCw, Variable } from "lucide-react";
import { VariableBrowser } from "@/components/variable-browser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface TemplateEditorProps {
  categoryId: string;
  countryCode: string;
}

export default function TemplateEditor({ categoryId: categoryIdStr, countryCode }: TemplateEditorProps) {
  const [, setLocation] = useLocation();
  const categoryId = parseInt(categoryIdStr || "0", 10);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isVariableBrowserOpen, setIsVariableBrowserOpen] = useState(false);
  const [isAiInserting, setIsAiInserting] = useState(false);
  const [extractedVariables, setExtractedVariables] = useState<string[]>([]);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [categoryName, setCategoryName] = useState<string>("");
  const [activeTab, setActiveTab] = useState("workflow");
  const { toast } = useToast();

  const extractVariablesFromDocument = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/extract-variables`,
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        const variables = data.variables || [];
        setExtractedVariables(variables);
      }
    } catch (error) {
      console.error("Error extracting variables:", error);
    }
  }, [categoryId, countryCode]);

  const loadHtmlFallback = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/docx-html`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setHtmlContent(data.html || "");
      } else {
        setHtmlContent("<p>Nepodarilo sa načítať dokument.</p>");
      }
    } catch (error) {
      console.error("Error loading HTML:", error);
      setHtmlContent("<p>Chyba pri načítaní dokumentu.</p>");
    }
  }, [categoryId, countryCode]);

  const loadCategoryInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/contracts/categories`, { credentials: "include" });
      if (response.ok) {
        const categories = await response.json();
        const category = categories.find((c: any) => c.id === categoryId);
        if (category) {
          setCategoryName(category.name || category.label);
        }
      }
    } catch (error) {
      console.error("Error loading category:", error);
    }
  }, [categoryId]);

  const loadDocument = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadHtmlFallback(),
        extractVariablesFromDocument(),
        loadCategoryInfo()
      ]);
    } catch (error: any) {
      console.error("Error loading document:", error);
      setHtmlContent("<p>Chyba pri načítaní dokumentu.</p>");
    } finally {
      setIsLoading(false);
    }
  }, [loadHtmlFallback, extractVariablesFromDocument, loadCategoryInfo]);

  useEffect(() => {
    if (categoryId > 0) {
      loadDocument();
    }
  }, [categoryId, countryCode, loadDocument]);

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/docx`,
        { credentials: "include" }
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `template_${countryCode}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Sťahovanie spustené",
          description: "DOCX súbor sa sťahuje. Upravte ho v MS Word a nahrajte späť.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Chyba pri sťahovaní",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      toast({
        title: "Neplatný súbor",
        description: "Prosím nahrajte DOCX súbor.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("docxFile", file);

      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Nahrávanie zlyhalo");
      }

      toast({
        title: "Šablóna aktualizovaná",
        description: "Nový DOCX súbor bol úspešne nahraný.",
      });

      await loadDocument();
    } catch (error: any) {
      toast({
        title: "Chyba pri nahrávaní",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleInsertVariable = (variablePath: string) => {
    const placeholder = `{{${variablePath}}}`;
    toast({ title: `Premenná ${variablePath} skopírovaná`, description: placeholder });
    navigator.clipboard.writeText(placeholder);
    setIsVariableBrowserOpen(false);
  };

  const handleAiInsertVariables = async () => {
    setIsAiInserting(true);
    try {
      const response = await fetch("/api/contracts/ai-insert-placeholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          categoryId,
          countryCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "AI vkladanie zlyhalo");
      }

      const result = await response.json();

      toast({
        title: "Premenné vložené",
        description: result.message || `AI vložila premenné do dokumentu`,
      });

      await loadDocument();
    } catch (error: any) {
      console.error("AI insert error:", error);
      toast({
        title: "Chyba pri AI vkladaní",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAiInserting(false);
    }
  };

  const countryNames: Record<string, string> = {
    SK: "Slovensko",
    CZ: "Česko",
    HU: "Maďarsko",
    RO: "Rumunsko",
    IT: "Taliansko",
    DE: "Nemecko",
    US: "USA"
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!categoryId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">Neplatná kategória</p>
          <Button onClick={() => setLocation("/contracts")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Späť na zmluvy
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Načítavam dokument...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLocation("/contracts")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Späť
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{categoryName || `Kategória ${categoryId}`}</h1>
            <p className="text-sm text-muted-foreground">{countryNames[countryCode] || countryCode}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsVariableBrowserOpen(true)}
            data-testid="button-insert-variable"
          >
            <Variable className="h-4 w-4 mr-1" />
            Premenné
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAiInsertVariables}
            disabled={isAiInserting}
            data-testid="button-ai-insert"
          >
            {isAiInserting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            AI Premenné
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadDocument}
            data-testid="button-reload-doc"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="workflow" data-testid="tab-workflow">
            <FileText className="h-4 w-4 mr-2" />
            Úprava šablóny
          </TabsTrigger>
          <TabsTrigger value="preview" data-testid="tab-preview">
            <FileText className="h-4 w-4 mr-2" />
            Náhľad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</div>
                  <CardTitle className="text-base">Stiahnuť</CardTitle>
                </div>
                <CardDescription>
                  Stiahnite aktuálnu verziu šablóny
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={handleDownload}
                  data-testid="button-download-step"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Stiahnuť DOCX
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</div>
                  <CardTitle className="text-base">Upraviť</CardTitle>
                </div>
                <CardDescription>
                  Upravte súbor v MS Word. Použite premenné ako {"{{customer.fullName}}"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsVariableBrowserOpen(true)}
                  data-testid="button-browse-variables"
                >
                  <Variable className="h-4 w-4 mr-2" />
                  Prehľad premenných
                </Button>
                {extractedVariables.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    {extractedVariables.length} premenných v dokumente
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</div>
                  <CardTitle className="text-base">Nahrať</CardTitle>
                </div>
                <CardDescription>
                  Nahrajte upravený DOCX súbor späť
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <Button
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-step"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {isUploading ? "Nahrávam..." : "Nahrať DOCX"}
                </Button>
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Toto je náhľad dokumentu konvertovaný do HTML. Pre presnú podobu stiahnite DOCX súbor.
                </p>
              </div>
              
              {htmlContent ? (
                <div 
                  className="bg-white dark:bg-gray-800 p-8 rounded-md border prose dark:prose-invert max-w-none"
                  style={{ minHeight: "600px" }}
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <p>Žiadny obsah</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={isVariableBrowserOpen} onOpenChange={setIsVariableBrowserOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Dostupné premenné</DialogTitle>
            <DialogDescription>
              Kliknite na premennú pre skopírovanie do schránky. Potom ju vložte do Word dokumentu.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <VariableBrowser onInsertVariable={handleInsertVariable} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
