import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, Eye, Plus, Trash2, Loader2, Check, RefreshCw, 
  Search, Sparkles, Download, ToggleLeft, ToggleRight 
} from "lucide-react";

interface DocxEditorProps {
  categoryId: number;
  countryCode: string;
  onClose: () => void;
  onSave?: () => void;
}

const CUSTOMER_FIELDS = [
  { group: "Základné údaje", fields: [
    { key: "customer.fullName", label: "Celé meno klienta" },
    { key: "customer.firstName", label: "Meno" },
    { key: "customer.lastName", label: "Priezvisko" },
    { key: "customer.birthDate", label: "Dátum narodenia" },
    { key: "customer.personalId", label: "Rodné číslo" },
    { key: "customer.email", label: "Email" },
    { key: "customer.phone", label: "Telefón" },
  ]},
  { group: "Adresa", fields: [
    { key: "customer.street", label: "Ulica a číslo" },
    { key: "customer.city", label: "Mesto" },
    { key: "customer.postalCode", label: "PSČ" },
    { key: "customer.country", label: "Krajina" },
    { key: "customer.fullAddress", label: "Celá adresa" },
  ]},
  { group: "Partner", fields: [
    { key: "partner.fullName", label: "Meno partnera" },
    { key: "partner.birthDate", label: "Dátum narodenia partnera" },
    { key: "partner.personalId", label: "Rodné číslo partnera" },
    { key: "partner.phone", label: "Telefón partnera" },
  ]},
  { group: "Zmluva", fields: [
    { key: "contract.number", label: "Číslo zmluvy" },
    { key: "contract.date", label: "Dátum zmluvy" },
    { key: "contract.validFrom", label: "Platnosť od" },
    { key: "contract.validTo", label: "Platnosť do" },
  ]},
  { group: "Spoločnosť", fields: [
    { key: "company.name", label: "Názov spoločnosti" },
    { key: "company.ico", label: "IČO" },
    { key: "company.dic", label: "DIČ" },
    { key: "company.icDph", label: "IČ DPH" },
    { key: "company.address", label: "Adresa spoločnosti" },
    { key: "company.bankAccount", label: "Bankový účet" },
  ]},
];

export function DocxEditor({ categoryId, countryCode, onClose, onSave }: DocxEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState("");
  const [showSampleData, setShowSampleData] = useState(false);
  const [extractedFields, setExtractedFields] = useState<string[]>([]);
  const [placeholderMappings, setPlaceholderMappings] = useState<Record<string, string>>({});
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [newPlaceholder, setNewPlaceholder] = useState("");
  const [selectedCrmField, setSelectedCrmField] = useState("");
  const [inserting, setInserting] = useState(false);
  
  const loadHtmlContent = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/contracts/categories/${categoryId}/default-templates/${countryCode}/docx-html?withSampleData=${showSampleData}`,
        { credentials: "include" }
      );
      
      if (!response.ok) {
        throw new Error("Failed to load DOCX content");
      }
      
      const data = await response.json();
      setHtmlContent(data.html);
      setExtractedFields(data.extractedFields || []);
      setPlaceholderMappings(data.placeholderMappings || {});
      setSampleData(data.sampleData || {});
    } catch (error) {
      console.error("Error loading DOCX:", error);
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
            placeholder: newPlaceholder.trim(),
            crmField: selectedCrmField || undefined
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
      setSelectedCrmField("");
      
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
          ) : (
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
        
        <div className="w-80 border-l overflow-auto">
          <div className="p-4">
            <h4 className="font-medium mb-3">Nájdené premenné ({extractedFields.length})</h4>
            
            {extractedFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Žiadne premenné neboli nájdené. Kliknite na "Pridať premennú" pre manuálne vloženie.
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
        </div>
      </div>
      
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
            </div>
            
            <div className="space-y-2">
              <Label>Alebo vyberte z CRM polí</Label>
              <Select value={selectedCrmField} onValueChange={(value) => {
                setSelectedCrmField(value);
                if (value && value !== "__none__") {
                  setNewPlaceholder(value);
                }
              }}>
                <SelectTrigger data-testid="select-crm-field">
                  <SelectValue placeholder="Vyberte CRM pole..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Vlastný názov --</SelectItem>
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
