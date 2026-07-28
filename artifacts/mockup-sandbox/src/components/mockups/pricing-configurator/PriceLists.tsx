import { useState } from "react";
import {
  AlertCircle,
  Archive,
  ChevronRight,
  Copy,
  Edit,
  History,
  Plus,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type PriceListStatus = "draft" | "active" | "archived";

interface PriceList {
  id: number;
  country: string;
  countryCode: string;
  flag: string;
  currency: string;
  name: string;
  status: PriceListStatus;
  validFrom: string;
  products: {
    name: string;
    collection: number;
    storage1y: number;
    storage10y: number;
    storage20y: number;
  }[];
  components: {
    name: string;
    collection: number;
    storage1y: number;
    storage10y: number;
    storage20y: number;
  }[];
  discounts: {
    prepayment15: number;
    prepayment25: number;
  };
  failedCollectionFee: number;
  inflation: number;
  fxRate?: number;
}

const mockPriceLists: PriceList[] = [
  {
    id: 1,
    country: "Slovensko",
    countryCode: "SK",
    flag: "🇸🇰",
    currency: "EUR",
    name: "Cenník 2026",
    status: "active",
    validFrom: "2026-01-01",
    failedCollectionFee: 500,
    inflation: 2.8,
    products: [
      {
        name: "Classic (CB)",
        collection: 650,
        storage1y: 168.5,
        storage10y: 1542.8,
        storage20y: 2876.4,
      },
      {
        name: "Premium (CB+PB)",
        collection: 790,
        storage1y: 178.2,
        storage10y: 1628.27,
        storage20y: 3042.15,
      },
      {
        name: "Classic + Tkanivo",
        collection: 720,
        storage1y: 185.0,
        storage10y: 1695.5,
        storage20y: 3164.8,
      },
      {
        name: "Premium + Tkanivo",
        collection: 860,
        storage1y: 195.4,
        storage10y: 1786.92,
        storage20y: 3338.76,
      },
      {
        name: "Placenta (CB+PB+T(PB)+PL)",
        collection: 920,
        storage1y: 212.8,
        storage10y: 1945.28,
        storage20y: 3634.56,
      },
    ],
    components: [
      {
        name: "CB (pupočníková krv)",
        collection: 650,
        storage1y: 168.5,
        storage10y: 1542.8,
        storage20y: 2876.4,
      },
      {
        name: "PB (placentárna krv)",
        collection: 140,
        storage1y: 9.7,
        storage10y: 85.47,
        storage20y: 165.75,
      },
      {
        name: "T(CB) (tkanivo pupočníka CB)",
        collection: 70,
        storage1y: 16.5,
        storage10y: 152.7,
        storage20y: 288.4,
      },
      {
        name: "T(PB) (tkanivo pupočníka PB)",
        collection: 70,
        storage1y: 16.5,
        storage10y: 152.7,
        storage20y: 288.4,
      },
      {
        name: "PL (placenta)",
        collection: 60,
        storage1y: 17.3,
        storage10y: 159.36,
        storage20y: 296.4,
      },
    ],
    discounts: {
      prepayment15: 15,
      prepayment25: 25,
    },
  },
  {
    id: 2,
    country: "Slovensko",
    countryCode: "SK",
    flag: "🇸🇰",
    currency: "EUR",
    name: "Cenník 2027 – Návrh",
    status: "draft",
    validFrom: "2027-01-01",
    failedCollectionFee: 520,
    inflation: 3.2,
    products: [
      {
        name: "Classic (CB)",
        collection: 670,
        storage1y: 174.0,
        storage10y: 1592.16,
        storage20y: 2968.13,
      },
      {
        name: "Premium (CB+PB)",
        collection: 815,
        storage1y: 183.9,
        storage10y: 1680.78,
        storage20y: 3139.5,
      },
      {
        name: "Classic + Tkanivo",
        collection: 745,
        storage1y: 190.92,
        storage10y: 1749.96,
        storage20y: 3266.07,
      },
      {
        name: "Premium + Tkanivo",
        collection: 890,
        storage1y: 201.65,
        storage10y: 1844.18,
        storage20y: 3445.6,
      },
      {
        name: "Placenta (CB+PB+T(PB)+PL)",
        collection: 950,
        storage1y: 219.61,
        storage10y: 2007.93,
        storage20y: 3750.86,
      },
    ],
    components: [
      {
        name: "CB (pupočníková krv)",
        collection: 670,
        storage1y: 174.0,
        storage10y: 1592.16,
        storage20y: 2968.13,
      },
      {
        name: "PB (placentárna krv)",
        collection: 145,
        storage1y: 9.9,
        storage10y: 88.62,
        storage20y: 171.37,
      },
      {
        name: "T(CB) (tkanivo pupočníka CB)",
        collection: 75,
        storage1y: 16.92,
        storage10y: 157.8,
        storage20y: 297.67,
      },
      {
        name: "T(PB) (tkanivo pupočníka PB)",
        collection: 75,
        storage1y: 16.92,
        storage10y: 157.8,
        storage20y: 297.67,
      },
      {
        name: "PL (placenta)",
        collection: 60,
        storage1y: 17.85,
        storage10y: 164.55,
        storage20y: 305.86,
      },
    ],
    discounts: {
      prepayment15: 15,
      prepayment25: 25,
    },
  },
  {
    id: 3,
    country: "Česká republika",
    countryCode: "CZ",
    flag: "🇨🇿",
    currency: "CZK",
    name: "Ceník 2026",
    status: "active",
    validFrom: "2026-01-01",
    failedCollectionFee: 12500,
    inflation: 2.5,
    fxRate: 24.75,
    products: [
      {
        name: "Classic (CB)",
        collection: 16087.5,
        storage1y: 4170.37,
        storage10y: 38184.3,
        storage20y: 71191.8,
      },
      {
        name: "Premium (CB+PB)",
        collection: 19552.5,
        storage1y: 4410.45,
        storage10y: 40300.67,
        storage20y: 75293.21,
      },
      {
        name: "Classic + Tkanivo",
        collection: 17820,
        storage1y: 4578.75,
        storage10y: 41963.62,
        storage20y: 78329.4,
      },
      {
        name: "Premium + Tkanivo",
        collection: 21285,
        storage1y: 4836.15,
        storage10y: 44226.27,
        storage20y: 82634.31,
      },
      {
        name: "Placenta (CB+PB+T(PB)+PL)",
        collection: 22770,
        storage1y: 5266.8,
        storage10y: 48145.68,
        storage20y: 89955.36,
      },
    ],
    components: [
      {
        name: "CB (pupočníková krv)",
        collection: 16087.5,
        storage1y: 4170.37,
        storage10y: 38184.3,
        storage20y: 71191.8,
      },
      {
        name: "PB (placentárna krv)",
        collection: 3465,
        storage1y: 240.07,
        storage10y: 2116.37,
        storage20y: 4101.43,
      },
      {
        name: "T(CB) (tkanivo pupočníka CB)",
        collection: 1732.5,
        storage1y: 408.37,
        storage10y: 3779.25,
        storage20y: 7137.9,
      },
      {
        name: "T(PB) (tkanivo pupočníka PB)",
        collection: 1732.5,
        storage1y: 408.37,
        storage10y: 3779.25,
        storage20y: 7137.9,
      },
      {
        name: "PL (placenta)",
        collection: 1485,
        storage1y: 428.17,
        storage10y: 3945.36,
        storage20y: 7335.9,
      },
    ],
    discounts: {
      prepayment15: 15,
      prepayment25: 25,
    },
  },
  {
    id: 4,
    country: "Rumunsko",
    countryCode: "RO",
    flag: "🇷🇴",
    currency: "RON",
    name: "Listă de prețuri 2026",
    status: "active",
    validFrom: "2026-01-01",
    failedCollectionFee: 2500,
    inflation: 4.1,
    fxRate: 4.97,
    products: [
      {
        name: "Classic (CB)",
        collection: 3230.5,
        storage1y: 837.54,
        storage10y: 7667.71,
        storage20y: 14291.61,
      },
      {
        name: "Premium (CB+PB)",
        collection: 3926.3,
        storage1y: 885.67,
        storage10y: 8092.58,
        storage20y: 15119.48,
      },
      {
        name: "Classic + Tkanivo",
        collection: 3578.4,
        storage1y: 919.45,
        storage10y: 8427.23,
        storage20y: 15729.35,
      },
      {
        name: "Premium + Tkanivo",
        collection: 4274.2,
        storage1y: 971.12,
        storage10y: 8880.19,
        storage20y: 16589.64,
      },
      {
        name: "Placenta (CB+PB+T(PB)+PL)",
        collection: 4572.4,
        storage1y: 1057.61,
        storage10y: 9666.03,
        storage20y: 18063.76,
      },
    ],
    components: [
      {
        name: "CB (pupočníková krv)",
        collection: 3230.5,
        storage1y: 837.54,
        storage10y: 7667.71,
        storage20y: 14291.61,
      },
      {
        name: "PB (placentárna krv)",
        collection: 695.8,
        storage1y: 48.13,
        storage10y: 424.87,
        storage20y: 823.89,
      },
      {
        name: "T(CB) (tkanivo pupočníka CB)",
        collection: 347.9,
        storage1y: 81.91,
        storage10y: 758.52,
        storage20y: 1433.74,
      },
      {
        name: "T(PB) (tkanivo pupočníka PB)",
        collection: 347.9,
        storage1y: 81.91,
        storage10y: 758.52,
        storage20y: 1433.74,
      },
      {
        name: "PL (placenta)",
        collection: 298.2,
        storage1y: 85.94,
        storage10y: 792.32,
        storage20y: 1473.15,
      },
    ],
    discounts: {
      prepayment15: 15,
      prepayment25: 25,
    },
  },
];

const statusConfig: Record<
  PriceListStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  draft: { label: "Návrh", variant: "secondary" },
  active: { label: "Aktívny", variant: "default" },
  archived: { label: "Archivovaný", variant: "outline" },
};

export function PriceLists() {
  const [selectedId, setSelectedId] = useState<number>(1);
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const selectedPriceList = mockPriceLists.find((pl) => pl.id === selectedId);

  const filteredPriceLists = mockPriceLists.filter((pl) => {
    if (countryFilter !== "all" && pl.countryCode !== countryFilter) return false;
    if (statusFilter !== "all" && pl.status !== statusFilter) return false;
    return true;
  });

  const countries = Array.from(
    new Set(mockPriceLists.map((pl) => pl.countryCode))
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Left sidebar - Price lists */}
      <div className="w-96 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-slate-900">Cenníky</h1>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Nový cenník
            </Button>
          </div>

          <div className="space-y-2">
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Všetky krajiny" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky krajiny</SelectItem>
                {countries.map((code) => (
                  <SelectItem key={code} value={code}>
                    {mockPriceLists.find((pl) => pl.countryCode === code)?.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Všetky stavy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky stavy</SelectItem>
                <SelectItem value="draft">Návrh</SelectItem>
                <SelectItem value="active">Aktívny</SelectItem>
                <SelectItem value="archived">Archivovaný</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-1">
            {filteredPriceLists.map((priceList) => (
              <button
                key={priceList.id}
                onClick={() => setSelectedId(priceList.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selectedId === priceList.id
                    ? "bg-slate-100 border-slate-300 shadow-sm"
                    : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl leading-none">{priceList.flag}</span>
                    <div>
                      <div className="font-medium text-sm text-slate-900">
                        {priceList.countryCode}
                      </div>
                      <div className="text-xs text-slate-500">
                        {priceList.currency}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "w-4 h-4 text-slate-400 transition-opacity",
                      selectedId === priceList.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </div>

                <div className="mb-2">
                  <div className="text-sm font-medium text-slate-900 mb-1">
                    {priceList.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    Platnosť od {new Date(priceList.validFrom).toLocaleDateString("sk-SK")}
                  </div>
                </div>

                <Badge
                  variant={statusConfig[priceList.status].variant}
                  className={cn(
                    "text-xs",
                    priceList.status === "active" && "bg-emerald-500 hover:bg-emerald-600",
                    priceList.status === "draft" && "bg-amber-500 hover:bg-amber-600 text-white"
                  )}
                >
                  {statusConfig[priceList.status].label}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Price list detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedPriceList ? (
          <div className="p-8 max-w-6xl">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-4xl">{selectedPriceList.flag}</span>
                    <div>
                      <h2 className="text-2xl font-semibold text-slate-900">
                        {selectedPriceList.name}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {selectedPriceList.country} · {selectedPriceList.currency}
                      </p>
                    </div>
                    <Badge
                      variant={statusConfig[selectedPriceList.status].variant}
                      className={cn(
                        selectedPriceList.status === "active" && "bg-emerald-500 hover:bg-emerald-600",
                        selectedPriceList.status === "draft" && "bg-amber-500 hover:bg-amber-600 text-white"
                      )}
                    >
                      {statusConfig[selectedPriceList.status].label}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    Platnosť od {new Date(selectedPriceList.validFrom).toLocaleDateString("sk-SK", { 
                      day: "numeric", 
                      month: "long", 
                      year: "numeric" 
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedPriceList.status === "draft" && (
                    <Button variant="default" className="gap-2">
                      <Edit className="w-4 h-4" />
                      Upraviť
                    </Button>
                  )}
                  {selectedPriceList.status === "draft" && (
                    <Button variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <Sparkles className="w-4 h-4" />
                      Aktivovať
                    </Button>
                  )}
                  <Button variant="outline" className="gap-2">
                    <Copy className="w-4 h-4" />
                    Duplikovať ako návrh
                  </Button>
                  <Button variant="outline" size="icon">
                    <History className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {selectedPriceList.status === "draft" && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm text-amber-900">
                    Aktiváciou tohto cenníka sa aktuálny aktívny cenník krajiny{" "}
                    <strong>{selectedPriceList.country}</strong> automaticky archivuje.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Products table */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Produktové balíky</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px]">Produkt</TableHead>
                      <TableHead className="text-right">Odber</TableHead>
                      <TableHead className="text-right">Skladné 1 rok</TableHead>
                      <TableHead className="text-right">Skladné 10 rokov</TableHead>
                      <TableHead className="text-right">Skladné 20 rokov</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPriceList.products.map((product, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {product.collection.toLocaleString("sk-SK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {selectedPriceList.currency}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {product.storage1y.toLocaleString("sk-SK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {selectedPriceList.currency}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {product.storage10y.toLocaleString("sk-SK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {selectedPriceList.currency}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {product.storage20y.toLocaleString("sk-SK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {selectedPriceList.currency}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Components table */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Samostatné komponenty</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px]">Komponent</TableHead>
                      <TableHead className="text-right">Odber</TableHead>
                      <TableHead className="text-right">Skladné 1 rok</TableHead>
                      <TableHead className="text-right">Skladné 10 rokov</TableHead>
                      <TableHead className="text-right">Skladné 20 rokov</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPriceList.components.map((component, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm">
                          {component.name}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {component.collection.toLocaleString("sk-SK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {selectedPriceList.currency}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {component.storage1y.toLocaleString("sk-SK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {selectedPriceList.currency}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {component.storage10y.toLocaleString("sk-SK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {selectedPriceList.currency}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {component.storage20y.toLocaleString("sk-SK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {selectedPriceList.currency}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Additional pricing info */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Zľavy za predplatenie skladného</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">15% zľava</span>
                    <span className="font-semibold text-emerald-600">
                      {selectedPriceList.discounts.prepayment15}%
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">25% zľava</span>
                    <span className="font-semibold text-emerald-600">
                      {selectedPriceList.discounts.prepayment25}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Parametre oceňovania</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Predpokladaná inflácia</span>
                    <span className="font-semibold">{selectedPriceList.inflation}%</span>
                  </div>
                  {selectedPriceList.fxRate && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">FX kurz (EUR)</span>
                        <span className="font-semibold font-mono">
                          {selectedPriceList.fxRate.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ostatné poplatky</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Paušál pri zlyhaní odberu</span>
                    <span className="font-semibold font-mono">
                      {selectedPriceList.failedCollectionFee.toLocaleString("sk-SK")}{" "}
                      {selectedPriceList.currency}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-500">
              <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Vyberte cenník zo zoznamu</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
