// ─────────────────────────────────────────────────────────────────────────────
// ClinicRepresentativePanel
// Widget na karte kliniky — zobrazí aktuálneho reprezentanta,
// umožní zmenu, odobratie a zobrazenie histórie priradení.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserCheck, UserX, History, ChevronDown, ChevronUp, UserPlus, CalendarDays, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────
interface RepUser {
  id: string;
  name: string;
  email: string | null;
  clinicCount: number;
}

interface Assignment {
  id: string;
  clinicId: string;
  userId: string;
  validFrom: string;
  validTo: string | null;
  assignedBy: string | null;
  assignmentType: string;
  note: string | null;
  user?: { id: string; fullName: string | null; email: string | null } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "d. M. yyyy"); } catch { return d; }
}

function AssignmentTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    manual:        { label: "manuálne",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    bulk_region:   { label: "kraj",      cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    bulk_district: { label: "okres",     cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
    swap:          { label: "výmena",    cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
    import:        { label: "import",    cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  };
  const info = map[type] ?? { label: type, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${info.cls}`}>
      {info.label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ClinicRepresentativePanel({ clinicId }: { clinicId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [showHistory, setShowHistory] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [assignNote, setAssignNote] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: currentData, isLoading: currentLoading } = useQuery<{ assignment: Assignment | null }>({
    queryKey: ["/api/clinics", clinicId, "representative"],
    queryFn: async () => {
      const res = await fetch(`/api/clinics/${clinicId}/representative`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/clinics", clinicId, "representative", "history"],
    queryFn: async () => {
      const res = await fetch(`/api/clinics/${clinicId}/representative/history`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: showHistory,
    staleTime: 30_000,
  });

  const { data: representatives = [], isLoading: repsLoading } = useQuery<RepUser[]>({
    queryKey: ["/api/representatives"],
    queryFn: async () => {
      const res = await fetch("/api/representatives", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 60_000,
    enabled: assignOpen,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/clinics", clinicId, "representative"] });
    queryClient.invalidateQueries({ queryKey: ["/api/clinics", clinicId, "representative", "history"] });
  };

  // ── Mutations ────────────────────────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clinics/${clinicId}/representative`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, note: assignNote || null }),
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? "Chyba pri priradení");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reprezentant priradený" });
      invalidate();
      setAssignOpen(false);
      setSelectedUserId("");
      setAssignNote("");
    },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clinics/${clinicId}/representative`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? "Chyba pri odobratí");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Priradenie odobrané" });
      invalidate();
      setRemoveOpen(false);
    },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const current = currentData?.assignment ?? null;
  const currentUserName = current?.user?.fullName ?? current?.user?.email ?? current?.userId ?? null;

  // ── Render ───────────────────────────────────────────────────────────────
  if (currentLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Načítavam…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Current assignment card ── */}
      <div className={`rounded-2xl border-2 p-4 space-y-3 transition-colors ${current ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20" : "border-dashed border-muted-foreground/30 bg-muted/30"}`}>
        {current ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                  <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{currentUserName}</div>
                  {current.user?.email && (
                    <div className="text-xs text-muted-foreground">{current.user.email}</div>
                  )}
                </div>
              </div>
              <AssignmentTypeBadge type={current.assignmentType} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>od {fmtDate(current.validFrom)}</span>
            </div>
            {current.note && (
              <p className="text-xs text-muted-foreground italic border-l-2 border-emerald-300 pl-2">{current.note}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"
                onClick={() => { setSelectedUserId(""); setAssignNote(""); setAssignOpen(true); }}>
                <Pencil className="h-3.5 w-3.5" />
                Zmeniť reprezentanta
              </Button>
              <Button size="sm" variant="outline"
                className="gap-1.5 h-7 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() => setRemoveOpen(true)}>
                <UserX className="h-3.5 w-3.5" />
                Odobrať
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium text-sm">Bez reprezentanta</div>
              <div className="text-xs text-muted-foreground mt-0.5">Táto klinika nemá priradeného reprezentanta</div>
            </div>
            <Button size="sm" className="gap-1.5"
              onClick={() => { setSelectedUserId(""); setAssignNote(""); setAssignOpen(true); }}>
              <UserPlus className="h-4 w-4" />
              Priradiť reprezentanta
            </Button>
          </div>
        )}
      </div>

      {/* ── History toggle ── */}
      <button
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        onClick={() => setShowHistory((v) => !v)}>
        <History className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">História priradení</span>
        {showHistory ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
      </button>

      {showHistory && (
        <div className="rounded-xl border bg-muted/20 divide-y text-sm">
          {historyLoading && (
            <div className="flex items-center gap-2 p-4 text-muted-foreground text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Načítavam históriu…
            </div>
          )}
          {!historyLoading && history.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">Žiadna história priradení</div>
          )}
          {history.map((h) => {
            const name = h.user?.fullName ?? h.user?.email ?? h.userId;
            const isCurrent = !h.validTo;
            return (
              <div key={h.id} className="flex items-start gap-3 px-4 py-3">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${isCurrent ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{name}</span>
                    <AssignmentTypeBadge type={h.assignmentType} />
                    {isCurrent && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">aktuálne</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(h.validFrom)}
                    {h.validTo ? ` → ${fmtDate(h.validTo)}` : " → teraz"}
                  </div>
                  {h.note && <div className="text-xs text-muted-foreground italic mt-0.5">{h.note}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Assign / Change dialog ── */}
      <Dialog open={assignOpen} onOpenChange={(o) => { if (!o) setAssignOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              {current ? "Zmeniť reprezentanta" : "Priradiť reprezentanta"}
            </DialogTitle>
            {current && (
              <DialogDescription>
                Aktuálne: <strong>{currentUserName}</strong> (od {fmtDate(current.validFrom)})
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reprezentant</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={repsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={repsLoading ? "Načítavam…" : "Vyber reprezentanta"} />
                </SelectTrigger>
                <SelectContent>
                  {representatives.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.clinicCount > 0 ? `${r.clinicCount} kliník` : "bez kliník"}
                      </span>
                    </SelectItem>
                  ))}
                  {!repsLoading && representatives.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      Žiadni používatelia s rolou Reprezentant
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Poznámka (voliteľné)</Label>
              <Textarea
                rows={2}
                placeholder="Dôvod zmeny, reión, atď."
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Zrušiť</Button>
            <Button
              disabled={!selectedUserId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}>
              {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {current ? "Zmeniť" : "Priradiť"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove confirm dialog ── */}
      <Dialog open={removeOpen} onOpenChange={(o) => { if (!o) setRemoveOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Odobrať reprezentanta</DialogTitle>
            <DialogDescription>
              Odoberiete <strong>{currentUserName}</strong> z tejto kliniky.
              História priradenia zostane zachovaná.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>Zrušiť</Button>
            <Button variant="destructive" disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}>
              {removeMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Odobrať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
