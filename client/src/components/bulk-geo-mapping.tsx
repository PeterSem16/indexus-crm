import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, MapPin, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES } from "@/lib/countries";
import { getGeoLabels } from "@/lib/regions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface BulkGeoMappingProps {
  entityType: "hospitals" | "clinics" | "collaborators" | "customers";
  entityLabel: string;
}

export function BulkGeoMappingButton({ entityType, entityLabel }: BulkGeoMappingProps) {
  const [open, setOpen] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated: number; total: number; errors?: string[] } | null>(null);
  const { toast } = useToast();

  const geoLabels = getGeoLabels(countryCode || "SK");

  const handleBulkMap = async () => {
    if (!countryCode) {
      toast({ title: "Vyberte krajinu", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const resp = await fetch("/api/bulk-suggest-region-district", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entityType, countryCode }),
      });

      if (!resp.ok) throw new Error("Failed");

      const data = await resp.json();
      setResult(data);

      if (data.updated > 0) {
        toast({
          title: "Hromadné mapovanie dokončené",
          description: `Aktualizovaných ${data.updated} z ${data.total} záznamov`,
        });
      } else if (data.total === 0) {
        toast({
          title: "Žiadne záznamy na aktualizáciu",
          description: `Všetky záznamy pre ${countryCode} už majú vyplnený ${geoLabels.region} a ${geoLabels.district}`,
        });
      }
    } catch (err) {
      toast({ title: "Chyba pri hromadnom mapovaní", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setOpen(true); setResult(null); setCountryCode(""); }}
        className="gap-1.5"
        data-testid={`button-bulk-geo-${entityType}`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        AI mapovanie
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Hromadné AI mapovanie
            </DialogTitle>
            <DialogDescription>
              AI prejde všetky záznamy <strong>{entityLabel}</strong> pre vybranú krajinu a doplní chýbajúci {geoLabels.region} a {geoLabels.district} podľa mesta/adresy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Krajina</label>
              <Select value={countryCode} onValueChange={(v) => { setCountryCode(v); setResult(null); }}>
                <SelectTrigger data-testid="select-bulk-geo-country">
                  <SelectValue placeholder="Vyberte krajinu" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.filter(c => c.code !== "US").map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {countryCode && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Database className="h-3.5 w-3.5" />
                  Mapovanie polí pre {countryCode}:
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Badge variant="outline">{geoLabels.region}</Badge>
                  <Badge variant="outline">{geoLabels.district}</Badge>
                </div>
              </div>
            )}

            {result && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3 text-sm">
                <div className="font-medium text-green-800 dark:text-green-200">
                  Výsledok:
                </div>
                <div className="text-green-700 dark:text-green-300 mt-1">
                  Aktualizovaných: <strong>{result.updated}</strong> / {result.total} záznamov
                </div>
                {result.errors && result.errors.length > 0 && (
                  <div className="text-orange-600 dark:text-orange-400 mt-1 text-xs">
                    {result.errors.length} chýb pri spracovaní
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-bulk-geo-cancel">
              Zavrieť
            </Button>
            <Button onClick={handleBulkMap} disabled={loading || !countryCode} data-testid="button-bulk-geo-start">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mapujem...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Spustiť mapovanie
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
