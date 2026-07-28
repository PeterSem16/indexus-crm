import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calculator as CalculatorIcon,
  Copy,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Beaker,
  Droplets,
  Flower,
  Dna,
  Database,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function Calculator() {
  const [country, setCountry] = useState("SK");
  const [product, setProduct] = useState("Premium+Tkanivo");
  
  // Real components gathered state
  const [cbGathered, setCbGathered] = useState(true);
  const [pbGathered, setPbGathered] = useState(false);
  const [tcbGathered, setTcbGathered] = useState(false);
  
  // Extra properties
  const [cbLowVolume, setCbLowVolume] = useState(false);
  const [cbContaminated, setCbContaminated] = useState(false);
  
  const [storageYears, setStorageYears] = useState("10");
  const [prepaidStorage, setPrepaidStorage] = useState(false);
  const [installments, setInstallments] = useState("1");
  
  const [calculated, setCalculated] = useState(true);

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kalkulačka ceny</h1>
          <p className="text-slate-500">
            Výpočet cien odberu a skladného podľa reálne odobratých komponentov a aktuálnych cenníkov.
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1 font-medium flex gap-1.5 items-center bg-white shadow-sm border-slate-200">
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-600">Aktívny cenník:</span>
          <span className="text-slate-900 font-semibold">SK · v2026</span>
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column - Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalculatorIcon className="w-5 h-5 text-slate-500" />
                Parametre zmluvy
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Krajina</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger id="country">
                      <SelectValue placeholder="Vyberte krajinu" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SK">Slovensko (EUR)</SelectItem>
                      <SelectItem value="CZ">Česko (CZK)</SelectItem>
                      <SelectItem value="RO">Rumunsko (RON)</SelectItem>
                      <SelectItem value="HU">Maďarsko (HUF)</SelectItem>
                      <SelectItem value="AT">Rakúsko (EUR)</SelectItem>
                      <SelectItem value="IT">Taliansko (EUR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="product">Objednaný produkt</Label>
                  <Select value={product} onValueChange={setProduct}>
                    <SelectTrigger id="product">
                      <SelectValue placeholder="Vyberte produkt" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Classic">Classic (CB)</SelectItem>
                      <SelectItem value="Premium">Premium (CB+PB)</SelectItem>
                      <SelectItem value="Classic+Tkanivo">Classic+Tkanivo</SelectItem>
                      <SelectItem value="Premium+Tkanivo">Premium+Tkanivo</SelectItem>
                      <SelectItem value="Placenta">Placenta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">Skutočne odobrané komponenty</Label>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                  
                  {/* CB */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id="cb-gathered" 
                        checked={cbGathered} 
                        onCheckedChange={(c) => setCbGathered(c as boolean)} 
                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <Label htmlFor="cb-gathered" className="flex items-center gap-2 cursor-pointer font-medium">
                        <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-blue-700">
                          <Droplets className="w-3.5 h-3.5" />
                        </div>
                        Pupočníková krv (CB)
                      </Label>
                    </div>
                    {cbGathered && (
                      <div className="pl-9 flex gap-4">
                        <div className="flex items-center gap-2">
                          <Switch 
                            id="cb-low" 
                            checked={cbLowVolume} 
                            onCheckedChange={setCbLowVolume} 
                          />
                          <Label htmlFor="cb-low" className="text-xs text-slate-600 font-normal cursor-pointer">Objem &lt;20ml</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            id="cb-contam" 
                            checked={cbContaminated} 
                            onCheckedChange={setCbContaminated} 
                          />
                          <Label htmlFor="cb-contam" className="text-xs text-slate-600 font-normal cursor-pointer">Kontaminácia</Label>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Separator className="bg-slate-200" />
                  
                  {/* PB */}
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      id="pb-gathered" 
                      checked={pbGathered} 
                      onCheckedChange={(c) => setPbGathered(c as boolean)} 
                    />
                    <Label htmlFor="pb-gathered" className="flex items-center gap-2 cursor-pointer font-medium">
                      <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-purple-700">
                        <Beaker className="w-3.5 h-3.5" />
                      </div>
                      Placentárna krv (PB)
                    </Label>
                  </div>
                  
                  <Separator className="bg-slate-200" />
                  
                  {/* Tkanivo */}
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      id="tcb-gathered" 
                      checked={tcbGathered} 
                      onCheckedChange={(c) => setTcbGathered(c as boolean)} 
                    />
                    <Label htmlFor="tcb-gathered" className="flex items-center gap-2 cursor-pointer font-medium">
                      <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center text-emerald-700">
                        <Dna className="w-3.5 h-3.5" />
                      </div>
                      Tkanivo pupočníka T(CB)
                    </Label>
                  </div>

                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storage-years">Skladné obobie (roky)</Label>
                  <Select value={storageYears} onValueChange={setStorageYears}>
                    <SelectTrigger id="storage-years">
                      <SelectValue placeholder="Roky" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 rok</SelectItem>
                      <SelectItem value="5">5 rokov</SelectItem>
                      <SelectItem value="10">10 rokov</SelectItem>
                      <SelectItem value="20">20 rokov</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="installments">Splátky za odber</Label>
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger id="installments">
                      <SelectValue placeholder="Splátky" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Jednorazovo</SelectItem>
                      <SelectItem value="12">12 mesačných splátok</SelectItem>
                      <SelectItem value="24">24 mesačných splátok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <Label htmlFor="prepaid" className="cursor-pointer font-medium">Predplatenie skladného naraz</Label>
                <Switch id="prepaid" checked={prepaidStorage} onCheckedChange={setPrepaidStorage} />
              </div>

            </CardContent>
            <CardFooter className="pt-4 border-t border-slate-100 bg-slate-50/50">
              <Button className="w-full" size="lg" onClick={() => setCalculated(true)}>
                Vypočítať cenu
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-7 space-y-6">
          {calculated ? (
            <Card className="shadow-md border-slate-300 overflow-hidden relative">
              
              {/* Highlight ribbon */}
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
              
              <CardHeader className="pb-4 bg-slate-50/80 border-b border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">Rozpis ceny</CardTitle>
                    <CardDescription className="mt-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-700 font-medium">Zmena produktu (nekompletný odber)</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="bg-slate-50/50 sticky top-0 shadow-[0_1px_0_0_#e2e8f0]">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[60%]">Položka</TableHead>
                        <TableHead className="text-right">Jedn. cena</TableHead>
                        <TableHead className="text-right">Suma</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      
                      {/* ODBER SECTION */}
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableCell colSpan={3} className="font-semibold text-slate-800 py-2">
                          1. Odberové a spracovateľské poplatky
                        </TableCell>
                      </TableRow>
                      
                      <TableRow>
                        <TableCell>
                          <div className="font-medium text-slate-900">Odber Classic (CB)</div>
                          <div className="text-xs text-slate-500 mt-1">Preklasifikované z Premium+Tkanivo z dôvodu absencie PB a T(CB) vzoriek.</div>
                        </TableCell>
                        <TableCell className="text-right text-slate-600">690,00 €</TableCell>
                        <TableCell className="text-right font-medium text-slate-900">690,00 €</TableCell>
                      </TableRow>
                      
                      <TableRow>
                        <TableCell>
                          <div className="font-medium text-slate-900">Správny poplatok za splátky</div>
                          <div className="text-xs text-slate-500 mt-1">0% (Jednorazová platba)</div>
                        </TableCell>
                        <TableCell className="text-right text-slate-600">0,00 €</TableCell>
                        <TableCell className="text-right font-medium text-slate-900">0,00 €</TableCell>
                      </TableRow>

                      <TableRow className="border-t-2 border-slate-100">
                        <TableCell colSpan={2} className="text-right text-sm text-slate-500 py-3">Medzisúčet (Odber):</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900 py-3">690,00 €</TableCell>
                      </TableRow>

                      {/* SKLADNE SECTION */}
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-t-2 border-slate-200">
                        <TableCell colSpan={3} className="font-semibold text-slate-800 py-2">
                          2. Skladné (10 rokov)
                        </TableCell>
                      </TableRow>
                      
                      <TableRow>
                        <TableCell>
                          <div className="font-medium text-slate-900">Skladné - Classic</div>
                          <div className="text-xs text-slate-500 mt-1">Základná ročná sadzba (69,00 €/rok)</div>
                        </TableCell>
                        <TableCell className="text-right text-slate-600">69,00 €</TableCell>
                        <TableCell className="text-right font-medium text-slate-900">690,00 €</TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell>
                          <div className="font-medium text-red-600 flex items-center gap-1.5">
                            Inflačná garancia
                          </div>
                          <div className="text-xs text-slate-500 mt-1">Fixácia ceny počas prvých 10 rokov</div>
                        </TableCell>
                        <TableCell className="text-right text-red-600">-</TableCell>
                        <TableCell className="text-right font-medium text-slate-900">0,00 €</TableCell>
                      </TableRow>
                      
                      <TableRow className="border-t-2 border-slate-100">
                        <TableCell colSpan={2} className="text-right text-sm text-slate-500 py-3">Medzisúčet (Skladné 10r):</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900 py-3">690,00 €</TableCell>
                      </TableRow>

                    </TableBody>
                  </Table>
                </ScrollArea>
                
                {/* Total Footer */}
                <div className="bg-blue-50/50 border-t border-blue-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-950">Celková suma na úhradu</h3>
                      <p className="text-sm text-blue-700/80 mt-0.5">Odber + 10 rokov skladného (bez inflácie)</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-700 tracking-tight">1 380,00 €</div>
                      <div className="text-sm text-blue-600/80 font-medium mt-1">DPH zahrnutá (ak sa aplikuje)</div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" className="gap-2 cursor-not-allowed text-slate-500" disabled>
                        <Download className="w-4 h-4" />
                        Export PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Pripravujeme v ďalšej verzii</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <Button variant="secondary" className="gap-2 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-slate-900">
                  <Copy className="w-4 h-4" />
                  Kopírovať rozpis
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="h-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
              <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <CalculatorIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Výsledok kalkulácie</h3>
              <p className="text-slate-500 max-w-sm">
                Upravte parametre zmluvy vľavo a kliknite na Vypočítať cenu pre zobrazenie rozpisu položiek.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
