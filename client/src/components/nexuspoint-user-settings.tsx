import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Globe, HardDrive, FolderOpen, Settings, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NexusPointUserSettingsProps {
  userId: string;
}

export function NexusPointUserSettings({ userId }: NexusPointUserSettingsProps) {
  const { toast } = useToast();

  const [pendingPinnedIds, setPendingPinnedIds] = useState<string[]>([]);
  const [pendingDefaultSiteId, setPendingDefaultSiteId] = useState<string | null>(null);
  const [pendingDefaultDriveId, setPendingDefaultDriveId] = useState<string | null>(null);
  const [settingsDrives, setSettingsDrives] = useState<any[]>([]);
  const [settingsDrivesLoading, setSettingsDrivesLoading] = useState(false);

  const { data: ms365Status } = useQuery<any>({
    queryKey: ["/api/users", userId, "ms365", "status"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/ms365/status`, { credentials: "include" });
      if (!res.ok) return { connected: false };
      return res.json();
    },
  });

  const { data: allSites = [], isLoading: sitesLoading } = useQuery<any[]>({
    queryKey: ["/api/users", userId, "sharepoint", "sites"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/sharepoint/sites`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!ms365Status?.connected,
  });

  const { data: npSettings, isLoading: settingsLoading, refetch: refetchSettings } = useQuery<any>({
    queryKey: ["/api/users", userId, "nexuspoint-settings"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/nexuspoint-settings`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (npSettings) {
      setPendingPinnedIds(npSettings.pinnedSiteIds || []);
      setPendingDefaultSiteId(npSettings.defaultSiteId || null);
      setPendingDefaultDriveId(npSettings.defaultDriveId || null);
    }
  }, [npSettings]);

  useEffect(() => {
    if (!pendingDefaultSiteId) {
      setSettingsDrives([]);
      return;
    }
    setSettingsDrivesLoading(true);
    fetch(`/api/users/${userId}/sharepoint/sites/${pendingDefaultSiteId}/drives`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setSettingsDrives(Array.isArray(data) ? data : []))
      .catch(() => setSettingsDrives([]))
      .finally(() => setSettingsDrivesLoading(false));
  }, [pendingDefaultSiteId, userId]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/users/${userId}/nexuspoint-settings`, {
        pinnedSiteIds: pendingPinnedIds,
        defaultSiteId: pendingDefaultSiteId || null,
        defaultDriveId: pendingDefaultDriveId || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Nastavenia NexusPoint uložené" });
      refetchSettings();
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "nexuspoint-settings"] });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní nastavení", variant: "destructive" });
    },
  });

  const togglePinnedSite = (siteId: string) => {
    setPendingPinnedIds(prev =>
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    );
  };

  if (!ms365Status?.connected) {
    return (
      <div className="rounded-lg border bg-muted/20 p-6 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <HardDrive className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <p className="font-medium">MS365 nie je pripojené</p>
          <p className="text-sm text-muted-foreground mt-1">
            Najprv pripojte MS365 účet v záložke MS365, potom tu môžete nastaviť NexusPoint.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-2 border-b">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-sm">
          <Settings className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm">NexusPoint — nastavenia používateľa</p>
          <p className="text-xs text-muted-foreground">Pinnované weby a predvolené umiestnenie pre tohto používateľa</p>
        </div>
      </div>

      {/* Pinned sites */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold">Pinnované weby</span>
          {pendingPinnedIds.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{pendingPinnedIds.length}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Zaškrtnuté weby sa zobrazia v NexusPointe. Ak nič nevyberiete, zobrazia sa všetky.
        </p>

        {sitesLoading || settingsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            Načítavanie SharePoint webov...
          </div>
        ) : allSites.length === 0 ? (
          <div className="rounded-lg border bg-muted/10 p-4 text-center text-sm text-muted-foreground">
            Žiadne SharePoint weby nenájdené. Skontrolujte pripojenie MS365.
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/5 overflow-hidden">
            {allSites.map((site: any, i: number) => (
              <label
                key={site.id}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors text-sm ${i < allSites.length - 1 ? "border-b border-border/50" : ""}`}
              >
                <Checkbox
                  checked={pendingPinnedIds.includes(site.id)}
                  onCheckedChange={() => togglePinnedSite(site.id)}
                  data-testid={`checkbox-site-${site.id}`}
                />
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                    <Globe className="h-3 w-3 text-emerald-600" />
                  </div>
                  <span className="truncate font-medium">{site.displayName}</span>
                  {site.webUrl && (
                    <span className="text-xs text-muted-foreground truncate hidden sm:block">{new URL(site.webUrl).hostname}</span>
                  )}
                </div>
                {pendingPinnedIds.includes(site.id) && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Default site */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold">Predvolený web</span>
        </div>
        <p className="text-xs text-muted-foreground">Automaticky otvorí tento web pri spustení NexusPoint.</p>
        <Select
          value={pendingDefaultSiteId || "none"}
          onValueChange={(v) => {
            setPendingDefaultSiteId(v === "none" ? null : v);
            setPendingDefaultDriveId(null);
          }}
        >
          <SelectTrigger className="h-9 text-sm" data-testid="select-default-site">
            <SelectValue placeholder="Žiadny predvolený web" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Žiadny predvolený web</SelectItem>
            {(pendingPinnedIds.length > 0
              ? allSites.filter((s: any) => pendingPinnedIds.includes(s.id))
              : allSites
            ).map((site: any) => (
              <SelectItem key={site.id} value={site.id}>{site.displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Default drive */}
      {pendingDefaultSiteId && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold">Predvolená knižnica dokumentov</span>
          </div>
          <p className="text-xs text-muted-foreground">Automaticky otvorí túto knižnicu po výbere webu.</p>
          <Select
            value={pendingDefaultDriveId || "none"}
            onValueChange={(v) => setPendingDefaultDriveId(v === "none" ? null : v)}
            disabled={settingsDrivesLoading}
          >
            <SelectTrigger className="h-9 text-sm" data-testid="select-default-drive">
              <SelectValue placeholder={settingsDrivesLoading ? "Načítavanie knižníc..." : "Žiadna predvolená knižnica"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Žiadna predvolená knižnica</SelectItem>
              {settingsDrives.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Current settings summary */}
      {npSettings && (npSettings.pinnedSiteIds?.length > 0 || npSettings.defaultSiteId) && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Aktuálne uložené nastavenia</p>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p>Pinnované weby: <span className="font-medium">{npSettings.pinnedSiteIds?.length || 0}</span></p>
            {npSettings.defaultSiteId && (
              <p>Predvolený web: <span className="font-medium">{allSites.find((s: any) => s.id === npSettings.defaultSiteId)?.displayName || npSettings.defaultSiteId}</span></p>
            )}
          </div>
        </div>
      )}

      <div className="pt-2">
        <Button
          type="button"
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
          onClick={() => saveSettingsMutation.mutate()}
          disabled={saveSettingsMutation.isPending}
          data-testid="button-save-nexuspoint-settings"
        >
          {saveSettingsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Uložiť nastavenia NexusPoint
        </Button>
      </div>
    </div>
  );
}
