import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, Upload, History, FileText, Check, RotateCcw, Sparkles, Variable, RefreshCw, Clock, User } from "lucide-react";
import { VariableBrowser } from "./variable-browser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

interface TemplateVersion {
  id: number;
  categoryId: number;
  countryCode: string;
  versionNumber: number;
  docxFilePath: string;
  htmlContent: string | null;
  changeDescription: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isVariableBrowserOpen, setIsVariableBrowserOpen] = useState(false);
  const [isAiInserting, setIsAiInserting] = useState(false);
  const [extractedVariables, setExtractedVariables] = useState<string[]>([]);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [activeTab, setActiveTab] = useState("workflow");
  const [versionDescription, setVersionDescription] = useState("");
  const [isCreateVersionOpen, setIsCreateVersionOpen] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [revertVersion, setRevertVersion] = useState<TemplateVersion | null>(null);
  const [isReverting, setIsReverting] = useState(false);
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

  const loadVersions = useCallback(async () => {
    setIsLoadingVersions(true);
    try {
      const response = await fetch(
        `/api/contract-categories/${categoryId}/countries/${countryCode}/versions`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
      }
    } catch (error) {
      console.error("Error loading versions:", error);
    } finally {
      setIsLoadingVersions(false);
    }
  }, [categoryId, countryCode]);

  const loadDocument = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadHtmlFallback(),
        extractVariablesFromDocument(),
        loadVersions()
      ]);
    } catch (error: any) {
      console.error("Error loading document:", error);
      setHtmlContent("<p>Chyba pri načítaní dokumentu.</p>");
    } finally {
      setIsLoading(false);
    }
  }, [loadHtmlFallback, extractVariablesFromDocument, loadVersions]);

  useEffect(() => {
    loadDocument();
  }, [categoryId, countryCode]);

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

      onSave?.();
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

  const handleCreateVersion = async () => {
    if (!versionDescription.trim()) {
      toast({
        title: "Chýba popis",
        description: "Prosím zadajte popis zmien pre túto verziu.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingVersion(true);
    try {
      const response = await fetch(
        `/api/contract-categories/${categoryId}/countries/${countryCode}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            changeDescription: versionDescription,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Vytvorenie verzie zlyhalo");
      }

      const newVersion = await response.json();
      toast({
        title: "Verzia vytvorená",
        description: `Verzia ${newVersion.versionNumber} bola úspešne uložená.`,
      });

      setVersionDescription("");
      setIsCreateVersionOpen(false);
      await loadVersions();
    } catch (error: any) {
      toast({
        title: "Chyba pri vytváraní verzie",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handleRevertVersion = async () => {
    if (!revertVersion) return;

    setIsReverting(true);
    try {
      const response = await fetch(
        `/api/contract-categories/${categoryId}/countries/${countryCode}/versions/${revertVersion.id}/revert`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Obnovenie verzie zlyhalo");
      }

      toast({
        title: "Verzia obnovená",
        description: `Šablóna bola obnovená na verziu ${revertVersion.versionNumber}.`,
      });

      setRevertVersion(null);
      await loadDocument();
    } catch (error: any) {
      toast({
        title: "Chyba pri obnovení verzie",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsReverting(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Načítavam šablónu...</p>
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
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="workflow" data-testid="tab-workflow">
              <FileText className="h-4 w-4 mr-2" />
              Úprava
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-preview">
              <FileText className="h-4 w-4 mr-2" />
              Náhľad
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="h-4 w-4 mr-2" />
              História
              {versions.length > 0 && (
                <Badge variant="secondary" className="ml-2">{versions.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="mt-4 flex-1 overflow-auto">
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
                    Upravte v MS Word. Použite {"{{customer.fullName}}"}
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

            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Uložiť verziu
                </CardTitle>
                <CardDescription>
                  Pred väčšími zmenami uložte aktuálnu verziu
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateVersionOpen(true)}
                  data-testid="button-save-version"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Uložiť aktuálnu verziu
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="mt-4 flex-1 overflow-auto">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Toto je náhľad konvertovaný do HTML. Pre presnú podobu stiahnite DOCX.
              </p>
            </div>
            
            {htmlContent ? (
              <div 
                className="bg-white dark:bg-gray-800 p-6 rounded-md border prose dark:prose-invert max-w-none"
                style={{ minHeight: "400px" }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>Žiadny obsah</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 flex-1 overflow-auto">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-medium">História verzií</h3>
                <p className="text-sm text-muted-foreground">
                  Predchádzajúce verzie s možnosťou obnovenia
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateVersionOpen(true)}
                data-testid="button-create-version"
              >
                <Check className="h-4 w-4 mr-2" />
                Uložiť verziu
              </Button>
            </div>
            
            {isLoadingVersions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Zatiaľ neboli vytvorené žiadne verzie</p>
                <p className="text-sm mt-1">Uložte prvú verziu pre možnosť neskoršieho obnovenia</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card"
                      data-testid={`version-item-${version.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">v{version.versionNumber}</Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(version.createdAt)}
                          </span>
                        </div>
                        {version.changeDescription && (
                          <p className="text-sm mb-2">{version.changeDescription}</p>
                        )}
                        {version.createdByName && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.createdByName}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRevertVersion(version)}
                        data-testid={`button-revert-${version.id}`}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Obnoviť
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
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
            <VariableBrowser onInsertVariable={handleInsertVariable} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateVersionOpen} onOpenChange={setIsCreateVersionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uložiť novú verziu</DialogTitle>
            <DialogDescription>
              Uložte aktuálny stav šablóny s popisom zmien.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Popis zmien</label>
              <Textarea
                placeholder="Napr. Aktualizované kontaktné údaje..."
                value={versionDescription}
                onChange={(e) => setVersionDescription(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-version-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateVersionOpen(false)}>
              Zrušiť
            </Button>
            <Button
              onClick={handleCreateVersion}
              disabled={isCreatingVersion || !versionDescription.trim()}
              data-testid="button-confirm-save-version"
            >
              {isCreatingVersion && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Uložiť verziu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revertVersion} onOpenChange={(open) => !open && setRevertVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obnoviť verziu {revertVersion?.versionNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              Aktuálna šablóna bude nahradená vybranou verziou.
              {revertVersion?.changeDescription && (
                <span className="block mt-2 font-medium">
                  Popis: {revertVersion.changeDescription}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevertVersion}
              disabled={isReverting}
              data-testid="button-confirm-revert"
            >
              {isReverting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Obnoviť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
