import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Download, Sparkles, Variable, RefreshCw, ExternalLink } from "lucide-react";
import { VariableBrowser } from "./variable-browser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";


interface SuperDocEditorProps {
  categoryId: number;
  countryCode: string;
  onSave?: () => void;
  onExtractedFieldsChange?: (fields: string[]) => void;
}

export function SuperDocEditor({
  categoryId,
  countryCode,
  onSave,
  onExtractedFieldsChange,
}: SuperDocEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const superDocInstance = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVariableBrowserOpen, setIsVariableBrowserOpen] = useState(false);
  const [isAiInserting, setIsAiInserting] = useState(false);
  const [extractedVariables, setExtractedVariables] = useState<string[]>([]);
  const [docxBlobUrl, setDocxBlobUrl] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>("");
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
        onExtractedFieldsChange?.(variables);
      }
    } catch (error) {
      console.error("Error extracting variables:", error);
    }
  }, [categoryId, countryCode, onExtractedFieldsChange]);

  const loadHtmlFallback = useCallback(async () => {
    try {
      console.log("Loading HTML fallback for", categoryId, countryCode);
      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/docx-html`,
        { credentials: "include" }
      );
      console.log("HTML fallback response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("HTML fallback data received, html length:", data.html?.length);
        setHtmlContent(data.html || "");
      } else {
        console.error("HTML fallback failed:", response.status);
        setHtmlContent("<p>Nepodarilo sa načítať dokument.</p>");
      }
    } catch (error) {
      console.error("Error loading HTML fallback:", error);
      setHtmlContent("<p>Chyba pri načítaní dokumentu.</p>");
    }
  }, [categoryId, countryCode]);

  const loadDocument = useCallback(async () => {
    console.log("loadDocument called for category:", categoryId, "country:", countryCode);
    setIsLoading(true);
    
    try {
      console.log("Using HTML fallback mode");
      setUseFallback(true);
      await loadHtmlFallback();
      await extractVariablesFromDocument();
    } catch (error: any) {
      console.error("Error loading document:", error);
      setHtmlContent("<p>Chyba pri načítaní dokumentu.</p>");
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, countryCode, loadHtmlFallback, extractVariablesFromDocument]);

  useEffect(() => {
    loadDocument();

    return () => {
      if (superDocInstance.current) {
        superDocInstance.current.destroy?.();
      }
      if (docxBlobUrl) {
        URL.revokeObjectURL(docxBlobUrl);
      }
    };
  }, [categoryId, countryCode]);

  const handleSave = async () => {
    if (!superDocInstance.current) return;

    setIsSaving(true);
    try {
      const docxBlob = await superDocInstance.current.getDocx?.();
      
      if (!docxBlob) {
        throw new Error("Nepodarilo sa získať DOCX obsah");
      }

      const formData = new FormData();
      formData.append("file", docxBlob, "template.docx");

      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/save-docx`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Ukladanie zlyhalo");
      }

      toast({ title: "Dokument uložený" });
      onSave?.();
      extractVariablesFromDocument();
    } catch (error: any) {
      console.error("Error saving:", error);
      toast({
        title: "Chyba pri ukladaní",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!superDocInstance.current) return;

    try {
      const docxBlob = await superDocInstance.current.getDocx?.();
      
      if (docxBlob) {
        const url = URL.createObjectURL(docxBlob);
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
    if (!superDocInstance.current) return;

    try {
      const placeholder = `{{${variablePath}}}`;
      superDocInstance.current.commands?.insertContent?.(placeholder);
      
      toast({ title: `Premenná ${variablePath} vložená` });
      setIsVariableBrowserOpen(false);
    } catch (error: any) {
      console.error("Error inserting variable:", error);
      toast({
        title: "Chyba pri vkladaní premennej",
        description: error.message,
        variant: "destructive",
      });
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Načítavam DOCX editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/30 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-docx"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Uložiť
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            data-testid="button-download-docx"
          >
            <Download className="h-4 w-4 mr-1" />
            Stiahnuť
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsVariableBrowserOpen(true)}
            data-testid="button-insert-variable"
          >
            <Variable className="h-4 w-4 mr-1" />
            Vložiť premennú
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
        </div>
        <div className="flex items-center gap-2">
          {extractedVariables.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {extractedVariables.length} premenných
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

      {!useFallback && (
        <div id="superdoc-toolbar" ref={toolbarRef} className="superdoc-toolbar shrink-0" />
      )}

      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900">
        {useFallback ? (
          <div className="p-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                SuperDoc editor vyžaduje otvorenie aplikácie v samostatnom okne (nie v iframe náhľade).
              </p>
              <Button
                onClick={() => window.open(window.location.href, '_blank')}
                className="gap-2"
                data-testid="button-open-new-tab"
              >
                <ExternalLink className="h-4 w-4" />
                Otvoriť v novom tabe pre plnú editáciu
              </Button>
            </div>
            {htmlContent ? (
              <div 
                className="bg-white dark:bg-gray-800 p-6 rounded-md shadow-sm prose dark:prose-invert max-w-none"
                style={{ minHeight: "600px" }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Načítavam náhľad...
              </div>
            )}
          </div>
        ) : (
          <div
            id="superdoc-container"
            ref={containerRef}
            className="superdoc-container"
            style={{ minHeight: "700px", height: "100%" }}
          />
        )}
      </div>

      <Dialog open={isVariableBrowserOpen} onOpenChange={setIsVariableBrowserOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Vložiť premennú</DialogTitle>
            <DialogDescription>
              Vyberte premennú z registra CRM polí
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
