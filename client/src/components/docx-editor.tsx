import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  FileText, Eye, Plus, Trash2, Loader2, Check, RefreshCw, 
  Search, Sparkles, Download, ToggleLeft, ToggleRight, BookOpen,
  History, RotateCcw, Save, Clock, User
} from "lucide-react";
import { VariableBrowser } from "./variable-browser";
import type { ContractTemplateVersion } from "@shared/schema";

interface DocxEditorProps {
  categoryId: number;
  countryCode: string;
  onClose: () => void;
  onSave?: () => void;
}


export function DocxEditor({ categoryId, countryCode, onClose, onSave }: DocxEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState("");
  const [showSampleData, setShowSampleData] = useState(false);
  const [extractedFields, setExtractedFields] = useState<string[]>([]);
  const [placeholderMappings, setPlaceholderMappings] = useState<Record<string, string>>({});
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [newPlaceholder, setNewPlaceholder] = useState("");
  const [inserting, setInserting] = useState(false);
  
  const [saveVersionDialogOpen, setSaveVersionDialogOpen] = useState(false);
  const [versionDescription, setVersionDescription] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  
  const { data: versions = [], isLoading: versionsLoading, refetch: refetchVersions } = useQuery<ContractTemplateVersion[]>({
    queryKey: ['/api/contract-categories', categoryId, 'countries', countryCode, 'versions'],
    queryFn: async () => {
      const res = await fetch(`/api/contract-categories/${categoryId}/countries/${countryCode}/versions`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load versions');
      return res.json();
    }
  });
  
  const saveVersionMutation = useMutation({
    mutationFn: async (data: { htmlContent?: string; changeDescription?: string }) => {
      return apiRequest('POST', `/api/contract-categories/${categoryId}/countries/${countryCode}/versions`, data);
    },
    onSuccess: () => {
      toast({ title: "Verzia uložená", description: "Nová verzia šablóny bola vytvorená" });
      refetchVersions();
      setSaveVersionDialogOpen(false);
      setVersionDescription("");
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa uložiť verziu", variant: "destructive" });
    }
  });
  
  const revertVersionMutation = useMutation({
    mutationFn: async (versionId: number) => {
      return apiRequest('POST', `/api/contract-categories/${categoryId}/countries/${countryCode}/versions/${versionId}/revert`);
    },
    onSuccess: () => {
      toast({ title: "Verzia obnovená", description: "Šablóna bola vrátená na vybranú verziu" });
      loadHtmlContent();
      refetchVersions();
      if (onSave) onSave();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa obnoviť verziu", variant: "destructive" });
    }
  });
  
  const handleSaveVersion = async () => {
    setSavingVersion(true);
    try {
      await saveVersionMutation.mutateAsync({
        htmlContent: htmlContent,
        changeDescription: versionDescription || undefined
      });
    } catch (error) {
      console.error('Save version error:', error);
      toast({ title: "Chyba", description: "Nepodarilo sa uložiť verziu", variant: "destructive" });
    } finally {
      setSavingVersion(false);
    }
  };
  
  const formatDate = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sk-SK', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const loadHtmlContent = async () => {
    console.log("[DocxEditor] Loading HTML content...");
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/docx-html?withSampleData=${showSampleData}`,
        { credentials: "include" }
      );
      
      if (!response.ok) {
        throw new Error("Failed to load DOCX content");
      }
      
      const data = await response.json();
      console.log("[DocxEditor] Received data, HTML length:", data.html?.length || 0);
      
      // Limit HTML size to prevent browser crash from huge base64 images
      let safeHtml = data.html || "";
      if (safeHtml.length > 500000) {
        console.warn("[DocxEditor] HTML too large, stripping base64 images");
        safeHtml = safeHtml.replace(/data:image\/[^;]+;base64,[^"']+/g, "data:image/png;base64,placeholder");
      }
      
      setHtmlContent(safeHtml);
      setExtractedFields(data.extractedFields || []);
      
      // Parse placeholderMappings if it's a string
      let mappings = data.placeholderMappings || {};
      if (typeof mappings === 'string') {
        try {
          mappings = JSON.parse(mappings);
        } catch (e) {
          console.error('[DocxEditor] Failed to parse placeholderMappings:', e);
          mappings = {};
        }
      }
      setPlaceholderMappings(mappings);
      setSampleData(data.sampleData || {});
      console.log("[DocxEditor] State updated successfully");
    } catch (error) {
      console.error("Error loading DOCX:", error);
      setLoadError((error as Error).message);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa načítať obsah dokumentu",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadHtmlContent();
  }, [categoryId, countryCode, showSampleData]);
  
  // Show simple error state if load failed
  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <p className="text-destructive font-medium mb-2">Chyba pri načítaní</p>
          <p className="text-muted-foreground text-sm">{loadError}</p>
        </div>
      </div>
    );
  }
  
  const handleInsertPlaceholder = async () => {
    if (!searchText.trim() || !newPlaceholder.trim()) {
      toast({
        title: "Chyba",
        description: "Vyplňte text na nahradenie a názov premennej",
        variant: "destructive"
      });
      return;
    }
    
    setInserting(true);
    try {
      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/insert-placeholder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            searchText: searchText.trim(),
            placeholder: newPlaceholder.trim()
          })
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to insert placeholder");
      }
      
      const result = await response.json();
      
      toast({
        title: "Premenná vložená",
        description: result.message
      });
      
      setExtractedFields(result.extractedFields || []);
      setPlaceholderMappings(result.placeholderMappings || {});
      
      setInsertDialogOpen(false);
      setSearchText("");
      setNewPlaceholder("");
      
      await loadHtmlContent();
      
      if (onSave) onSave();
    } catch (error) {
      console.error("Insert error:", error);
      toast({
        title: "Chyba",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setInserting(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h3 className="font-semibold">DOCX Editor - {countryCode}</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSampleData(!showSampleData)}
            data-testid="button-toggle-sample-data"
          >
            {showSampleData ? (
              <>
                <ToggleRight className="h-4 w-4 mr-2" />
                Vzorové dáta: Zapnuté
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4 mr-2" />
                Vzorové dáta: Vypnuté
              </>
            )}
          </Button>
          
          <Button
            size="sm"
            onClick={() => setInsertDialogOpen(true)}
            data-testid="button-add-placeholder"
          >
            <Plus className="h-4 w-4 mr-2" />
            Pridať premennú
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadHtmlContent}
            disabled={loading}
            data-testid="button-refresh-preview"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 bg-white dark:bg-gray-900">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !htmlContent ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Žiadny obsah na zobrazenie</p>
            </div>
          ) : (
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
        
        <div className="w-96 border-l flex flex-col overflow-hidden">
          <Tabs defaultValue="registry" className="flex flex-col h-full">
            <TabsList className="mx-2 mt-2 flex-shrink-0 grid grid-cols-3">
              <TabsTrigger value="registry" data-testid="tab-registry">
                <BookOpen className="h-4 w-4 mr-1" />
                Register
              </TabsTrigger>
              <TabsTrigger value="found" data-testid="tab-found">
                <Search className="h-4 w-4 mr-1" />
                Nájdené ({extractedFields.length})
              </TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">
                <History className="h-4 w-4 mr-1" />
                História ({versions.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="registry" className="flex-1 m-0 overflow-hidden">
              <VariableBrowser
                onInsertVariable={(key) => {
                  setNewPlaceholder(key);
                  setInsertDialogOpen(true);
                }}
                onCopyVariable={(key) => {
                  toast({
                    title: "Skopírované",
                    description: `{{${key}}} bolo skopírované do schránky`
                  });
                }}
              />
            </TabsContent>
            
            <TabsContent value="found" className="flex-1 m-0 overflow-auto">
              <div className="p-4">
                <h4 className="font-medium mb-3">Nájdené premenné</h4>
                
                {extractedFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Žiadne premenné neboli nájdené. Vyberte premennú z registra pre manuálne vloženie.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {extractedFields.map((field, idx) => (
                      <div key={idx} className="p-2 bg-muted rounded-md">
                        <Badge variant="outline" className="font-mono text-xs mb-1">
                          {`{{${field}}}`}
                        </Badge>
                        {placeholderMappings[`{{${field}}}`] && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Mapované na: {placeholderMappings[`{{${field}}}`]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Legenda</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-1 rounded text-xs" style={{ background: '#fff3cd', color: '#856404' }}>
                        {"{{premenná}}"}
                      </span>
                      <span className="text-muted-foreground">Premenná v šablóne</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-1 rounded text-xs" style={{ background: '#d4edda' }}>
                        Ján Novák
                      </span>
                      <span className="text-muted-foreground">Vzorová hodnota</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="history" className="flex-1 m-0 overflow-auto">
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h4 className="font-medium">História verzií</h4>
                  <Button
                    size="sm"
                    onClick={() => setSaveVersionDialogOpen(true)}
                    data-testid="button-save-version"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Uložiť verziu
                  </Button>
                </div>
                
                {versionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Zatiaľ žiadne verzie. Uložte prvú verziu pre sledovanie zmien.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {versions.map((version, idx) => (
                      <div key={version.id} className="p-3 border rounded-md bg-muted/30">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <Badge variant={idx === 0 ? "default" : "outline"}>
                            v{version.versionNumber}
                          </Badge>
                          {idx !== 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => revertVersionMutation.mutate(version.id)}
                              disabled={revertVersionMutation.isPending}
                              data-testid={`button-revert-version-${version.id}`}
                            >
                              {revertVersionMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              <span className="ml-1 text-xs">Obnoviť</span>
                            </Button>
                          )}
                          {idx === 0 && (
                            <Badge variant="secondary" className="text-xs">Aktuálna</Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(version.createdAt)}
                        </div>
                        
                        {version.createdByName && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <User className="h-3 w-3" />
                            {version.createdByName}
                          </div>
                        )}
                        
                        {version.changeDescription && (
                          <p className="text-xs mt-2 p-2 bg-background rounded">
                            {version.changeDescription}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <Dialog open={saveVersionDialogOpen} onOpenChange={setSaveVersionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uložiť verziu šablóny</DialogTitle>
            <DialogDescription>
              Vytvorte zálohu aktuálneho stavu šablóny s popisom zmien
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="versionDescription">Popis zmien (voliteľné)</Label>
              <Textarea
                id="versionDescription"
                placeholder="napr. Pridané nové pole pre adresu..."
                value={versionDescription}
                onChange={(e) => setVersionDescription(e.target.value)}
                data-testid="input-version-description"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveVersionDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={handleSaveVersion} disabled={savingVersion}>
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
      
      <Dialog open={insertDialogOpen} onOpenChange={setInsertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vložiť novú premennú</DialogTitle>
            <DialogDescription>
              Zadajte text z dokumentu, ktorý chcete nahradiť premennou
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="searchText">Text na nahradenie</Label>
              <Input
                id="searchText"
                placeholder="napr. Jana Nováková"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                data-testid="input-search-text"
              />
              <p className="text-xs text-muted-foreground">
                Presne skopírujte text z dokumentu, ktorý chcete nahradiť
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="placeholder">Názov premennej</Label>
              <Input
                id="placeholder"
                placeholder="napr. customer.fullName"
                value={newPlaceholder}
                onChange={(e) => setNewPlaceholder(e.target.value)}
                data-testid="input-placeholder-name"
              />
              {newPlaceholder && (
                <Badge variant="outline" className="font-mono">
                  {`{{${newPlaceholder}}}`}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground">
                Premennú môžete vybrať z registra v pravom paneli
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsertDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={handleInsertPlaceholder} disabled={inserting}>
              {inserting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Vkladám...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Vložiť premennú
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
