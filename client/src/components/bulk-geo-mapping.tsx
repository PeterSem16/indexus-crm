import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, MapPinPlus, Building2, Stethoscope, Users, UserCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES } from "@/lib/countries";
import { getGeoLabels } from "@/lib/regions";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n";

const MODULE_KEYS = ["hospitals", "clinics", "collaborators", "customers"] as const;
type ModuleKey = typeof MODULE_KEYS[number];

const MODULE_ICONS: Record<ModuleKey, typeof Building2> = {
  hospitals: Building2,
  clinics: Stethoscope,
  collaborators: Users,
  customers: UserCheck,
};

interface ModuleResult {
  updated: number;
  total: number;
  errors?: string[];
}

export function BulkGeoMappingPanel() {
  const { t } = useI18n();
  const [countryCode, setCountryCode] = useState("");
  const [selectedModules, setSelectedModules] = useState<Set<ModuleKey>>(new Set());
  const [loading, setLoading] = useState(false);
  const [currentModule, setCurrentModule] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ModuleResult>>({});
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const geoLabels = getGeoLabels(countryCode || "SK");

  const moduleLabels: Record<ModuleKey, string> = {
    hospitals: t.konfigurator.bulkGeoHospitals,
    clinics: t.konfigurator.bulkGeoClinics,
    collaborators: t.konfigurator.bulkGeoCollaborators,
    customers: t.konfigurator.bulkGeoCustomers,
  };

  const toggleModule = (key: ModuleKey) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedModules.size === MODULE_KEYS.length) {
      setSelectedModules(new Set());
    } else {
      setSelectedModules(new Set([...MODULE_KEYS]));
    }
  };

  const handleRun = async () => {
    if (!countryCode) {
      toast({ title: t.konfigurator.bulkGeoSelectCountry, variant: "destructive" });
      return;
    }
    if (selectedModules.size === 0) {
      toast({ title: t.konfigurator.bulkGeoSelectModule, variant: "destructive" });
      return;
    }

    setLoading(true);
    setResults({});
    setProgress(0);

    const modules = Array.from(selectedModules);
    let totalUpdated = 0;
    let totalRecords = 0;

    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      setCurrentModule(mod);
      setProgress(Math.round((i / modules.length) * 100));

      try {
        const resp = await fetch("/api/bulk-suggest-region-district", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ entityType: mod, countryCode }),
        });

        if (!resp.ok) throw new Error("Failed");

        const data = await resp.json();
        setResults(prev => ({ ...prev, [mod]: data }));
        totalUpdated += data.updated || 0;
        totalRecords += data.total || 0;
      } catch {
        setResults(prev => ({ ...prev, [mod]: { updated: 0, total: 0, errors: [t.konfigurator.bulkGeoError] } }));
      }
    }

    setProgress(100);
    setCurrentModule(null);
    setLoading(false);

    toast({
      title: t.konfigurator.bulkGeoDoneTitle,
      description: t.konfigurator.bulkGeoDoneDescription
        .replace("{updated}", String(totalUpdated))
        .replace("{total}", String(totalRecords)),
    });
  };

  const hasResults = Object.keys(results).length > 0;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPinPlus className="h-5 w-5 text-primary" />
          {t.konfigurator.bulkGeoTitle}
        </CardTitle>
        <CardDescription>
          {t.konfigurator.bulkGeoDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t.konfigurator.bulkGeoCountry}</Label>
            <Select value={countryCode} onValueChange={(v) => { setCountryCode(v); setResults({}); }}>
              <SelectTrigger data-testid="select-bulk-geo-country">
                <SelectValue placeholder={t.konfigurator.bulkGeoCountryPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {countryCode && (
              <div className="flex gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">{geoLabels.region}</Badge>
                <Badge variant="secondary" className="text-xs">{geoLabels.district}</Badge>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t.konfigurator.bulkGeoModules}</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={selectAll}
                data-testid="button-select-all-modules"
              >
                {selectedModules.size === MODULE_KEYS.length ? t.konfigurator.bulkGeoDeselectAll : t.konfigurator.bulkGeoSelectAll}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MODULE_KEYS.map((key) => {
                const Icon = MODULE_ICONS[key];
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedModules.has(key)
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    data-testid={`checkbox-module-${key}`}
                  >
                    <Checkbox
                      checked={selectedModules.has(key)}
                      onCheckedChange={() => toggleModule(key)}
                    />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{moduleLabels[key]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {loading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.konfigurator.bulkGeoProcessing}: {currentModule ? moduleLabels[currentModule as ModuleKey] : ""}...
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {hasResults && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t.konfigurator.bulkGeoResults}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MODULE_KEYS.filter(key => results[key]).map((key) => {
                  const Icon = MODULE_ICONS[key];
                  const r = results[key];
                  const hasErrors = r.errors && r.errors.length > 0;
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                        r.updated > 0
                          ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
                          : r.total === 0
                          ? "border-muted bg-muted/30"
                          : "border-border"
                      }`}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{moduleLabels[key]}</span>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {r.total === 0 ? (
                            t.konfigurator.bulkGeoAllComplete
                          ) : (
                            <>{t.konfigurator.bulkGeoFilled}: <strong>{r.updated}</strong> / {r.total}</>
                          )}
                        </div>
                      </div>
                      {r.updated > 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      ) : hasErrors ? (
                        <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button
            onClick={handleRun}
            disabled={loading || !countryCode || selectedModules.size === 0}
            data-testid="button-run-geo-mapping"
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.konfigurator.bulkGeoRunningButton}
              </>
            ) : (
              <>
                <MapPinPlus className="h-4 w-4" />
                {t.konfigurator.bulkGeoRunButton}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
