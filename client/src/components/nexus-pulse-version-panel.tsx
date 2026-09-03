import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, GitCompareArrows, History, Loader2, RotateCcw, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type VersionChange = {
  path: string;
  type: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
};

type VersionMetadata = {
  id: string;
  campaignId: string;
  versionNumber: number;
  status: string;
  restoredFromRevisionId: string | null;
  changes: VersionChange[];
  contentHash: string;
  changeNote: string | null;
  createdBy: string | null;
  createdAt: string;
  verifiedAt: string | null;
  activatedAt: string | null;
};

type VersionsResponse = { versions: VersionMetadata[] };
type VersionDetail = VersionMetadata & { snapshot: unknown };

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

function displayValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function NexusPulseVersionPanel({
  campaignId,
  campaignStatus,
}: {
  campaignId: string;
  campaignStatus: string;
}) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const copy = t.campaigns.detail;
  const [changeNote, setChangeNote] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const canManage = user?.role === "admin" || user?.role === "manager";

  const versionsQueryKey = ["/api/campaigns", campaignId, "nexus-pulse", "versions"] as const;
  const { data, isLoading } = useQuery<VersionsResponse>({
    queryKey: versionsQueryKey,
    queryFn: () => readJson(`/api/campaigns/${campaignId}/nexus-pulse/versions`),
    enabled: canManage && !!campaignId,
  });
  const versions = data?.versions ?? [];
  const activeVersion = versions.find((version) => version.status === "active") ?? versions[0];
  const effectiveSelectedVersion = selectedVersion ?? activeVersion?.versionNumber ?? null;

  const { data: selectedDetail, isLoading: isDetailLoading } = useQuery<VersionDetail>({
    queryKey: [...versionsQueryKey, effectiveSelectedVersion],
    queryFn: () => readJson(
      `/api/campaigns/${campaignId}/nexus-pulse/versions/${effectiveSelectedVersion}`,
    ),
    enabled: canManage && effectiveSelectedVersion !== null,
  });

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/campaigns/${campaignId}/nexus-pulse/versions`,
        { changeNote },
      );
      return response.json() as Promise<{ created: boolean; version: VersionMetadata }>;
    },
    onSuccess: async (result) => {
      setChangeNote("");
      setSelectedVersion(result.version.versionNumber);
      await queryClient.invalidateQueries({ queryKey: versionsQueryKey });
      toast({ title: result.created ? copy.nexusVersionCreated : copy.nexusNoChanges });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionNumber: number) => {
      const response = await apiRequest(
        "POST",
        `/api/campaigns/${campaignId}/nexus-pulse/versions/${versionNumber}/restore`,
        { confirm: true },
      );
      return response.json() as Promise<{ version: VersionMetadata }>;
    },
    onSuccess: async (result) => {
      setSelectedVersion(result.version.versionNumber);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: versionsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
      ]);
      toast({ title: copy.nexusVersionRestored });
    },
    onError: (error: Error) => {
      const message = error.message.includes("Pause the active campaign")
        ? copy.nexusRestoreBlocked
        : error.message;
      toast({ title: message, variant: "destructive" });
    },
  });

  if (!canManage) return null;

  const restoreVersion = (versionNumber: number) => {
    if (campaignStatus === "active") {
      toast({ title: copy.nexusRestoreBlocked, variant: "destructive" });
      return;
    }
    if (window.confirm(`${copy.nexusRestoreTitle}\n\n${copy.nexusRestoreDescription}`)) {
      restoreMutation.mutate(versionNumber);
    }
  };

  return (
    <Card className="overflow-hidden border-indigo-200/80 shadow-sm dark:border-indigo-900/60">
      <CardHeader className="border-b bg-gradient-to-r from-indigo-50/80 to-violet-50/50 dark:from-indigo-950/30 dark:to-violet-950/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              {copy.nexusVersioningTitle}
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              {copy.nexusVersioningDescription}
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-indigo-300 bg-background/80 px-3 py-1">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            {copy.nexusActiveVersion}: {activeVersion ? `v${activeVersion.versionNumber}` : "—"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="nexus-version-note">{copy.nexusChangeNote}</Label>
            <Input
              id="nexus-version-note"
              value={changeNote}
              onChange={(event) => setChangeNote(event.target.value)}
              placeholder={copy.nexusChangeNotePlaceholder}
              maxLength={1000}
              data-testid="input-nexus-version-note"
            />
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            data-testid="button-save-nexus-version"
          >
            {createMutation.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Save className="mr-2 h-4 w-4" />}
            {copy.nexusSaveVerifiedVersion}
          </Button>
        </div>

        <Separator />

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {copy.nexusNoVersion}
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => setSelectedVersion(version.versionNumber)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    effectiveSelectedVersion === version.versionNumber
                      ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-950/30"
                      : "hover:bg-muted/50"
                  }`}
                  data-testid={`button-nexus-version-${version.versionNumber}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">v{version.versionNumber}</span>
                    {version.status === "active" && (
                      <Badge className="bg-emerald-600">{copy.nexusActiveVersion}</Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {version.changeNote || copy.nexusInitialVersion}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {dateFormatter.format(new Date(version.createdAt))}
                  </p>
                </button>
              ))}
            </div>

            <div className="min-w-0 rounded-lg border bg-muted/10 p-4">
              {isDetailLoading || !selectedDetail ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="flex items-center gap-2 font-semibold">
                        <GitCompareArrows className="h-4 w-4 text-indigo-600" />
                        v{selectedDetail.versionNumber} · {copy.nexusChanges}
                      </h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedDetail.changeNote || copy.nexusInitialVersion}
                      </p>
                    </div>
                    {selectedDetail.status !== "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreVersion(selectedDetail.versionNumber)}
                        disabled={restoreMutation.isPending}
                        data-testid={`button-restore-nexus-version-${selectedDetail.versionNumber}`}
                      >
                        {restoreMutation.isPending
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <RotateCcw className="mr-2 h-4 w-4" />}
                        {copy.nexusRestore}
                      </Button>
                    )}
                  </div>

                  {selectedDetail.changes.length === 0 ? (
                    <p className="rounded-md bg-background p-4 text-sm text-muted-foreground">
                      {copy.nexusInitialVersion}
                    </p>
                  ) : (
                    <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                      {selectedDetail.changes.map((change, index) => (
                        <div key={`${change.path}-${index}`} className="rounded-md border bg-background p-3 text-xs">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                change.type === "added"
                                  ? "border-emerald-300 text-emerald-700"
                                  : change.type === "removed"
                                    ? "border-red-300 text-red-700"
                                    : "border-amber-300 text-amber-700"
                              }
                            >
                              {change.type}
                            </Badge>
                            <code className="break-all font-medium">{change.path}</code>
                          </div>
                          {change.type !== "added" && (
                            <div className="mt-2 break-all text-red-700/80 line-through dark:text-red-300/80">
                              {displayValue(change.before)}
                            </div>
                          )}
                          {change.type !== "removed" && (
                            <div className="mt-1 break-all text-emerald-700 dark:text-emerald-300">
                              {displayValue(change.after)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}