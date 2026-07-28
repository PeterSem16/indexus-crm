import React, { useState } from "react";
import { 
  Check, 
  X, 
  Edit2, 
  Save, 
  XCircle, 
  Info, 
  Settings, 
  AlertTriangle, 
  FileText, 
  FlaskConical,
  Activity,
  History,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Calculator,
  MessageSquare,
  AlertCircle
} from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";

// Typy
type ComponentType = 'CB' | 'PB' | 'T(CB)' | 'T(PB)' | 'PL';
type Country = 'SK' | 'CZ' | 'RO' | 'HU' | 'AT' | 'IT';

interface MatrixRow {
  id: string;
  collected: ComponentType[];
  resultingProduct: string;
  priceCollection: number;
  price1y: number;
  price10y: number;
  price20y: number;
  overrideNote?: string;
  isPausal?: boolean;
}

const mockMatrixData: MatrixRow[] = [
  {
    id: "r1",
    collected: ['CB', 'PB', 'T(CB)'],
    resultingProduct: "Premium+Tkanivo",
    priceCollection: 990,
    price1y: 160,
    price10y: 1628.27,
    price20y: 3256.54,
  },
  {
    id: "r2",
    collected: ['CB', 'PB'],
    resultingProduct: "Premium",
    priceCollection: 790,
    price1y: 100,
    price10y: 1000,
    price20y: 2000,
    overrideNote: "Štandardný downgrade produktu (chýba tkanivo)",
  },
  {
    id: "r3",
    collected: ['CB', 'T(CB)'],
    resultingProduct: "Classic+Tkanivo",
    priceCollection: 890,
    price1y: 120,
    price10y: 1200,
    price20y: 2400,
  },
  {
    id: "r4",
    collected: ['CB'],
    resultingProduct: "Classic",
    priceCollection: 690,
    price1y: 80,
    price10y: 800,
    price20y: 1600,
    overrideNote: "Zľava 100 € oproti bežnému cenníku za neúspešný odber PB a T(CB)",
  },
  {
    id: "r5",
    collected: [],
    resultingProduct: "Žiadny produkt",
    priceCollection: 500,
    price1y: 0,
    price10y: 0,
    price20y: 0,
    isPausal: true,
  }
];

const allComponentsForPremiumT: ComponentType[] = ['CB', 'PB', 'T(CB)'];

const ComponentChip = ({ label, present }: { label: string, present: boolean }) => {
  return (
    <div 
      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border tracking-wide shadow-sm transition-colors ${
        present 
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
          : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
      }`}
    >
      {present ? <Check className="w-3 h-3" strokeWidth={3} /> : <X className="w-3 h-3" strokeWidth={3} />}
      {label}
    </div>
  );
};

export function Matrix() {
  const [activeCountry, setActiveCountry] = useState<Country>('SK');
  const [orderedProduct, setOrderedProduct] = useState("Premium+Tkanivo");
  const [editingRowId, setEditingRowId] = useState<string | null>("r3"); // r3 v edit móde podľa zadania

  // Edit states
  const [editColPrice, setEditColPrice] = useState("890");
  const [edit1y, setEdit1y] = useState("120");
  const [edit10y, setEdit10y] = useState("1200");
  const [edit20y, setEdit20y] = useState("2400");
  const [editNote, setEditNote] = useState("Výnimka za stratu zložky");
  const [editProduct, setEditProduct] = useState("Classic+Tkanivo");

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cenník produktov V2</h1>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-medium">Návrh</Badge>
              </div>
              <p className="text-sm text-slate-500 font-medium mt-0.5">Konfigurácia cenníkov a matice nekompletných odberov</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 font-medium">
              <History className="w-4 h-4" />
              História zmien
            </Button>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700 font-medium shadow-sm">
              <Save className="w-4 h-4" />
              Uložiť ako návrh
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="default" className="gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm">
              <Activity className="w-4 h-4" />
              Aktivovať cenník
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-6 items-start">
          
          {/* Left Column - Matrix Table */}
          <div className="flex-1 w-full space-y-6">
            
            {/* Context & Filters */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1.5 flex items-center justify-between">
              <Tabs value={activeCountry} onValueChange={(v) => setActiveCountry(v as Country)} className="w-auto">
                <TabsList className="bg-transparent h-11 p-1">
                  {(['SK', 'CZ', 'RO', 'HU', 'AT', 'IT'] as Country[]).map(country => (
                    <TabsTrigger 
                      key={country} 
                      value={country}
                      className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-5 h-9 rounded-md font-semibold text-slate-600"
                    >
                      {country} {country === 'SK' ? '(EUR)' : country === 'CZ' ? '(CZK)' : ''}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="pr-3 pl-4 border-l border-slate-100 h-8 flex items-center gap-3">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Objednaný produkt</Label>
                <Select value={orderedProduct} onValueChange={setOrderedProduct}>
                  <SelectTrigger className="w-[200px] h-9 font-medium bg-slate-50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Classic">Classic</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="Classic+Tkanivo">Classic+Tkanivo</SelectItem>
                    <SelectItem value="Premium+Tkanivo">Premium+Tkanivo</SelectItem>
                    <SelectItem value="Placenta">Placenta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert className="bg-blue-50/50 border-blue-100 text-blue-800 shadow-sm">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="font-semibold text-blue-900">Matica nekompletných odberov</AlertTitle>
              <AlertDescription className="text-blue-700/90 mt-1">
                Táto tabuľka definuje finálne ceny a výsledný produkt v situácii, keď si klient objednal <strong>{orderedProduct}</strong>, ale reálne sa nepodarilo odobrať všetky požadované zložky.
              </AlertDescription>
            </Alert>

            {/* The Table */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[220px] font-semibold text-slate-700 h-12">Reálne odobrané zložky</TableHead>
                    <TableHead className="font-semibold text-slate-700">Výsledný produkt</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Cena odberu</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Skladné 1r</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Skladné 10r</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Skladné 20r</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TooltipProvider delayDuration={200}>
                    {mockMatrixData.map((row) => {
                      const isEditing = editingRowId === row.id;
                      
                      if (isEditing) {
                        return (
                          <TableRow key={row.id} className="bg-blue-50/30 hover:bg-blue-50/30">
                            <TableCell colSpan={7} className="p-0">
                              <div className="p-4 border-l-2 border-blue-500 shadow-inner">
                                <div className="flex items-center gap-4 mb-4">
                                  <div className="w-[204px] flex flex-wrap gap-1.5">
                                    {allComponentsForPremiumT.map(comp => (
                                      <ComponentChip key={comp} label={comp} present={row.collected.includes(comp)} />
                                    ))}
                                  </div>
                                  <div className="flex-1 grid grid-cols-5 gap-4">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-slate-500 font-medium">Výsledný produkt</Label>
                                      <Select value={editProduct} onValueChange={setEditProduct}>
                                        <SelectTrigger className="h-9 bg-white">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Classic">Classic</SelectItem>
                                          <SelectItem value="Premium">Premium</SelectItem>
                                          <SelectItem value="Classic+Tkanivo">Classic+Tkanivo</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-slate-500 font-medium">Odber (€)</Label>
                                      <Input value={editColPrice} onChange={e => setEditColPrice(e.target.value)} className="h-9 font-medium text-right bg-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-slate-500 font-medium">Skladné 1r (€)</Label>
                                      <Input value={edit1y} onChange={e => setEdit1y(e.target.value)} className="h-9 font-medium text-right bg-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-slate-500 font-medium">10r (€)</Label>
                                      <Input value={edit10y} onChange={e => setEdit10y(e.target.value)} className="h-9 font-medium text-right bg-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-slate-500 font-medium">20r (€)</Label>
                                      <Input value={edit20y} onChange={e => setEdit20y(e.target.value)} className="h-9 font-medium text-right bg-white" />
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-start gap-4">
                                  <div className="flex-1 space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                      Poznámka k výnimke <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                      <MessageSquare className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                      <Input 
                                        value={editNote} 
                                        onChange={e => setEditNote(e.target.value)} 
                                        placeholder="Zdôvodnenie cenovej odchýlky..." 
                                        className="h-9 pl-9 bg-white"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-end gap-2 pt-5">
                                    <Button variant="outline" size="sm" onClick={() => setEditingRowId(null)} className="h-9">
                                      Zrušiť
                                    </Button>
                                    <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={() => setEditingRowId(null)}>
                                      <Save className="w-4 h-4 mr-1.5" />
                                      Uložiť riadok
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return (
                        <TableRow key={row.id} className={`group transition-colors ${row.isPausal ? 'bg-slate-50/50' : ''}`}>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {allComponentsForPremiumT.map(comp => (
                                <ComponentChip key={comp} label={comp} present={row.collected.includes(comp)} />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">{row.resultingProduct}</span>
                              {row.overrideNote && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200 cursor-help px-1.5 py-0">
                                      Override
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-sm">
                                    <p className="font-semibold mb-1">Zmluvná výnimka</p>
                                    <p className="text-slate-200">{row.overrideNote}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {row.isPausal && (
                                <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300 border-slate-300 px-1.5 py-0">
                                  Paušál
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-slate-900">
                              {new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(row.priceCollection)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-slate-600">
                            {row.price1y > 0 ? new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(row.price1y) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">
                            {row.price10y > 0 ? new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(row.price10y) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">
                            {row.price20y > 0 ? new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(row.price20y) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setEditingRowId(row.id);
                                setEditProduct(row.resultingProduct);
                                setEditColPrice(row.priceCollection.toString());
                                setEdit1y(row.price1y.toString());
                                setEdit10y(row.price10y.toString());
                                setEdit20y(row.price20y.toString());
                                setEditNote(row.overrideNote || "");
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TooltipProvider>
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Right Column - Global Rules */}
          <div className="w-full xl:w-80 space-y-4 shrink-0">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Globálne pravidlá - {activeCountry}</h3>
            
            {/* Rule 1: LOW_VOLUME */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1 bg-amber-400 w-full" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                    <FlaskConical className="w-4 h-4 text-amber-500" />
                    Low Volume
                  </CardTitle>
                  <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500">Aktívne</Badge>
                </div>
                <CardDescription className="text-xs mt-1.5 text-slate-500">
                  Aplikuje sa na CB a PB ak je objem krvi &lt; 20 ml.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="bg-slate-50 rounded-md p-3 border border-slate-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-medium">Zľava z odberu:</span>
                    <span className="font-bold text-slate-900">400,00 €</span>
                  </div>
                </div>
                <Button variant="link" className="text-xs text-blue-600 h-auto p-0 mt-3 flex items-center gap-1 font-medium">
                  Upraviť podmienky <ChevronRight className="w-3 h-3" />
                </Button>
              </CardContent>
            </Card>

            {/* Rule 2: KONTAMINÁCIA */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1 bg-red-400 w-full" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    Kontaminácia
                  </CardTitle>
                  <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500">Aktívne</Badge>
                </div>
                <CardDescription className="text-xs mt-1.5 text-slate-500">
                  Pri pozitívnej mikrobiológii a nemožnosti uloženia.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="bg-slate-50 rounded-md p-3 border border-slate-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-medium">Zľava položky:</span>
                    <span className="font-bold text-slate-900">100 %</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rule 3: PAUŠÁL */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1 bg-slate-400 w-full" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                    <FileText className="w-4 h-4 text-slate-500" />
                    Paušál (Zlyhanie)
                  </CardTitle>
                  <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500">Aktívne</Badge>
                </div>
                <CardDescription className="text-xs mt-1.5 text-slate-500">
                  Poplatok pri úplnom zlyhaní odberu všetkých zložiek.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="bg-slate-50 rounded-md p-3 border border-slate-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-medium">Cena paušálu:</span>
                    <span className="font-bold text-slate-900">500,00 €</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}

export default Matrix;