import { useRoute, useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Download, Sparkles, Variable, RefreshCw, ArrowLeft } from "lucide-react";
import { VariableBrowser } from "@/components/variable-browser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function TemplateEditor() {
  const [, params] = useRoute("/contracts/editor/:categoryId/:countryCode");
  const [, setLocation] = useLocation();
  const categoryId = parseInt(params?.categoryId || "0", 10);
  const countryCode = params?.countryCode || "SK";
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVariableBrowserOpen, setIsVariableBrowserOpen] = useState(false);
  const [isAiInserting, setIsAiInserting] = useState(false);
  const [extractedVariables, setExtractedVariables] = useState<string[]>([]);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [categoryName, setCategoryName] = useState<string>("");
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
      console.log("Loading HTML for", categoryId, countryCode);
      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/docx-html`,
        { credentials: "include" }
      );
      console.log("HTML response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("HTML data received, length:", data.html?.length);
        setHtmlContent(data.html || "");
      } else {
        console.error("HTML load failed:", response.status);
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
          setCategoryName(category.name);
        }
      }
    } catch (error) {
      console.error("Error loading category:", error);
    }
  }, [categoryId]);

  const loadDocument = useCallback(async () => {
    console.log("Loading document for category:", categoryId, "country:", countryCode);
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
  }, [categoryId, countryCode, loadHtmlFallback, extractVariablesFromDocument, loadCategoryInfo]);

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
      }
    } catch (error: any) {
      toast({
        title: "Chyba pri sťahovaní",
        description: error.message,
        variant: "destructive",
      });
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

  if (!categoryId) {
    return (
      <div className="flex items-center justify-center h-screen">
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Načítavam dokument...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between gap-2 p-3 border-b bg-background shrink-0 flex-wrap">
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
          <div className="text-sm">
            <span className="font-medium">{categoryName || `Kategória ${categoryId}`}</span>
            <span className="text-muted-foreground ml-2">({countryNames[countryCode] || countryCode})</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            data-testid="button-download-docx"
          >
            <Download className="h-4 w-4 mr-1" />
            Stiahnuť DOCX
          </Button>
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
          {extractedVariables.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {extractedVariables.length} premenných v dokumente
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={loadDocument}
            data-testid="button-reload-doc"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Obnoviť
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/30 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Náhľad dokumentu. Pre úpravu stiahnite DOCX súbor, upravte ho v MS Word a nahrajte späť cez správu kategórií.
            </p>
          </div>
          
          {htmlContent ? (
            <div 
              className="bg-white dark:bg-gray-800 p-8 rounded-md shadow-sm prose dark:prose-invert max-w-none"
              style={{ minHeight: "800px" }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Žiadny obsah</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isVariableBrowserOpen} onOpenChange={setIsVariableBrowserOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Dostupné premenné</DialogTitle>
            <DialogDescription>
              Kliknite na premennú pre skopírovanie do schránky
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <VariableBrowser
              onInsertVariable={handleInsertVariable}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
