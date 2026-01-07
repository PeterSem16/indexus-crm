import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, Plus, Loader2, RefreshCw, Search, Replace, Check, X, 
  Eye, EyeOff, Download, History, ArrowRight, Sparkles, AlertCircle
} from "lucide-react";
import { VariableBrowser } from "./variable-browser";

interface DocxVariableEditorProps {
  categoryId: number;
  countryCode: string;
  onSave?: () => void;
  onExtractedFieldsChange?: (fields: string[]) => void;
}

export function DocxVariableEditor({ 
  categoryId, 
  countryCode, 
  onSave,
  onExtractedFieldsChange 
}: DocxVariableEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState("");
  const [extractedFields, setExtractedFields] = useState<string[]>([]);
  const [showSampleData, setShowSampleData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedVariable, setSelectedVariable] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  
  const [aiInserting, setAiInserting] = useState(false);
  
  const previewRef = useRef<HTMLDivElement>(null);
  
  const loadContent = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/docx-html?withSampleData=${showSampleData}&t=${Date.now()}`,
        { credentials: "include" }
      );
      
      if (!response.ok) {
        throw new Error("Failed to load DOCX content");
      }
      
      const data = await response.json();
      setHtmlContent(data.html || "");
      setExtractedFields(data.extractedFields || []);
      onExtractedFieldsChange?.(data.extractedFields || []);
    } catch (error) {
      console.error("Error loading DOCX:", error);
      setLoadError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadContent();
  }, [categoryId, countryCode, showSampleData]);
  
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim();
      setSearchText(text);
      setHighlightedText(text);
      setReplaceDialogOpen(true);
    }
  };
  
  const handleReplace = async () => {
    if (!searchText.trim() || !selectedVariable.trim()) {
      toast({
        title: "Chyba",
        description: "Vyberte text a premennú",
        variant: "destructive"
      });
      return;
    }
    
    setReplacing(true);
    try {
      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/insert-placeholder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            searchText: searchText.trim(),
            placeholder: selectedVariable.trim()
          })
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to replace text");
      }
      
      const result = await response.json();
      
      toast({
        title: "Premenná vložená",
        description: `"${searchText}" nahradené za {{${selectedVariable}}}`
      });
      
      setExtractedFields(result.extractedFields || []);
      onExtractedFieldsChange?.(result.extractedFields || []);
      
      setReplaceDialogOpen(false);
      setSearchText("");
      setSelectedVariable("");
      setHighlightedText(null);
      
      await loadContent();
      onSave?.();
    } catch (error) {
      console.error("Replace error:", error);
      toast({
        title: "Chyba",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setReplacing(false);
    }
  };
  
  const handleAiInsert = async () => {
    setAiInserting(true);
    try {
      const response = await fetch("/api/contracts/ai-insert-placeholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ categoryId, countryCode })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "AI insertion failed");
      }
      
      const result = await response.json();
      
      toast({
        title: "AI vložilo premenné",
        description: result.message || `Vložených ${result.replacements?.length || 0} premenných`
      });
      
      await loadContent();
      onSave?.();
    } catch (error) {
      console.error("AI insert error:", error);
      toast({
        title: "Chyba pri AI vkladaní",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setAiInserting(false);
    }
  };
  
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-medium mb-2">Chyba pri načítaní</p>
        <p className="text-muted-foreground text-sm mb-4">{loadError}</p>
        <Button variant="outline" onClick={loadContent}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Skúsiť znova
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex h-full gap-4 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden border rounded-md">
        <div className="p-3 border-b bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Náhľad dokumentu</span>
            <Badge variant="secondary">{extractedFields.length} premenných</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showSampleData ? "default" : "outline"}
              onClick={() => setShowSampleData(!showSampleData)}
              data-testid="button-toggle-sample-data"
            >
              {showSampleData ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showSampleData ? "Skryť vzorové dáta" : "Ukázať vzorové dáta"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={loadContent}
              disabled={loading}
              data-testid="button-refresh-preview"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/contracts/categories/${categoryId}/templates/${countryCode}/download`, '_blank')}
              data-testid="button-download"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="p-3 border-b bg-blue-50 dark:bg-blue-900/20">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Ako vložiť premennú:</strong> Označte text v dokumente myšou (napr. "Jana Nováková") a potom vyberte premennú z pravého panela.
          </p>
        </div>
        
        <ScrollArea className="flex-1">
          <div 
            ref={previewRef}
            className="p-6 bg-white dark:bg-gray-900 min-h-full cursor-text"
            onMouseUp={handleTextSelection}
            data-testid="docx-preview-content"
          >
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !htmlContent ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p>Žiadny obsah na zobrazenie</p>
              </div>
            ) : (
              <div 
                className="prose prose-sm max-w-none dark:prose-invert"
                style={{ fontFamily: "'Times New Roman', serif" }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            )}
          </div>
        </ScrollArea>
        
        {extractedFields.length === 0 && !loading && (
          <div className="p-3 border-t bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Dokument zatiaľ neobsahuje žiadne premenné. Označte text a nahraďte ho premennou.
              </p>
              <Button
                size="sm"
                onClick={handleAiInsert}
                disabled={aiInserting}
                data-testid="button-ai-insert-variables"
              >
                {aiInserting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    AI analyzuje...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Automaticky vložiť premenné (AI)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="w-80 flex flex-col overflow-hidden border rounded-md">
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Replace className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Vložiť premennú</span>
          </div>
        </div>
        
        {highlightedText ? (
          <div className="p-3 border-b bg-primary/10">
            <p className="text-sm font-medium mb-1">Vybraný text:</p>
            <Badge variant="outline" className="font-mono text-xs break-all">
              "{highlightedText}"
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Kliknite na premennú nižšie pre nahradenie
            </p>
          </div>
        ) : (
          <div className="p-3 border-b bg-muted/50">
            <p className="text-xs text-muted-foreground">
              Označte text v dokumente vľavo pre jeho nahradenie premennou
            </p>
          </div>
        )}
        
        <div className="flex-1 overflow-hidden">
          <VariableBrowser
            onInsertVariable={(key) => {
              if (highlightedText) {
                setSelectedVariable(key);
                setReplaceDialogOpen(true);
              } else {
                toast({
                  title: "Označte text",
                  description: "Najprv označte text v dokumente, ktorý chcete nahradiť",
                  variant: "default"
                });
              }
            }}
            onCopyVariable={(key) => {
              navigator.clipboard.writeText(`{{${key}}}`);
              toast({
                title: "Skopírované",
                description: `{{${key}}} skopírované do schránky`
              });
            }}
          />
        </div>
        
        {extractedFields.length > 0 && (
          <div className="p-3 border-t bg-muted/30">
            <p className="text-xs font-medium mb-2">Aktuálne premenné v dokumente:</p>
            <div className="flex flex-wrap gap-1">
              {extractedFields.slice(0, 5).map((field, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs font-mono">
                  {field}
                </Badge>
              ))}
              {extractedFields.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{extractedFields.length - 5} ďalších
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
      
      <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Replace className="h-5 w-5" />
              Nahradiť text premennou
            </DialogTitle>
            <DialogDescription>
              Vybraný text bude nahradený premennou vo všetkých výskytoch v dokumente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-md">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1">Pôvodný text</p>
                <Badge variant="outline" className="font-mono break-all">
                  "{searchText}"
                </Badge>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1">Premenná</p>
                <Badge variant="default" className="font-mono">
                  {selectedVariable ? `{{${selectedVariable}}}` : "..."}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Text na nahradenie</Label>
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Text z dokumentu"
                data-testid="input-search-text"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Premenná</Label>
              <Input
                value={selectedVariable}
                onChange={(e) => setSelectedVariable(e.target.value)}
                placeholder="napr. customer.fullName"
                data-testid="input-variable-name"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setReplaceDialogOpen(false);
                setHighlightedText(null);
              }}
            >
              Zrušiť
            </Button>
            <Button 
              onClick={handleReplace} 
              disabled={replacing || !searchText || !selectedVariable}
            >
              {replacing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Nahrádzam...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Nahradiť
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
