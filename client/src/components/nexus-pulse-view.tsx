import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FolderOpen, Phone, Mail, MessageSquare, Settings2, LayoutGrid, AlignJustify } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PulseDisplayMode = "tiles" | "compact";
export type PulseDefaultExpand = "all" | "first" | "none";

export interface PulsePrefs {
  displayMode: PulseDisplayMode;
  defaultExpand: PulseDefaultExpand;
  showActionBadges: boolean;
  showChannelIcons: boolean;
}

const DEFAULT_PREFS: PulsePrefs = {
  displayMode: "tiles",
  defaultExpand: "all",
  showActionBadges: true,
  showChannelIcons: true,
};

const PREFS_KEY = "nexus-pulse-prefs-v1";

export function loadPulsePrefs(): PulsePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePulsePrefs(prefs: PulsePrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent("nexus-pulse-prefs-changed"));
  } catch {
    /* ignore */
  }
}

export function usePulsePrefs(): [PulsePrefs, (next: PulsePrefs) => void] {
  const [prefs, setPrefs] = useState<PulsePrefs>(() => loadPulsePrefs());
  useEffect(() => {
    const reload = () => setPrefs(loadPulsePrefs());
    window.addEventListener("nexus-pulse-prefs-changed", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("nexus-pulse-prefs-changed", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);
  const update = (next: PulsePrefs) => {
    setPrefs(next);
    savePulsePrefs(next);
  };
  return [prefs, update];
}

const STATUS_ACTION_LABELS: Record<string, string> = {
  none: "Žiadna", callback: "Spätné volanie", reschedule: "Preplánovať",
  do_not_call: "Nevolať", complete: "Dokončiť", conversion: "Konverzia",
  send_email: "Odoslať email", send_sms: "Odoslať SMS",
  schedule_email: "Plán email", schedule_sms: "Plán SMS",
  assign_owner: "Priradiť vlastníkovi", move_queue: "Presunúť",
  start_onboarding: "Onboarding", create_task: "Vytvoriť task",
  verify_contact: "Verifikácia",
};

const STATUS_ACTION_COLORS: Record<string, string> = {
  none: "bg-gray-100 text-gray-700", callback: "bg-blue-100 text-blue-700",
  reschedule: "bg-sky-100 text-sky-700", do_not_call: "bg-red-100 text-red-700",
  complete: "bg-emerald-100 text-emerald-700", conversion: "bg-green-100 text-green-700",
  send_email: "bg-cyan-100 text-cyan-700", send_sms: "bg-purple-100 text-purple-700",
  schedule_email: "bg-cyan-100 text-cyan-700", schedule_sms: "bg-purple-100 text-purple-700",
};

const PULSE_STATUS_COLORS: Record<string, string> = {
  gray: "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700",
  blue: "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700",
  green: "bg-green-50 hover:bg-green-100 border-green-200 text-green-700",
  purple: "bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700",
  cyan: "bg-cyan-50 hover:bg-cyan-100 border-cyan-200 text-cyan-700",
  teal: "bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-700",
  orange: "bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700",
  emerald: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700",
  red: "bg-red-50 hover:bg-red-100 border-red-200 text-red-700",
  yellow: "bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700",
  indigo: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700",
  sky: "bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700",
  amber: "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700",
  lime: "bg-lime-50 hover:bg-lime-100 border-lime-200 text-lime-700",
  violet: "bg-violet-50 hover:bg-violet-100 border-violet-200 text-violet-700",
  rose: "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700",
  pink: "bg-pink-50 hover:bg-pink-100 border-pink-200 text-pink-700",
  fuchsia: "bg-fuchsia-50 hover:bg-fuchsia-100 border-fuchsia-200 text-fuchsia-700",
  slate: "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700",
};

const PULSE_CATEGORY_COLORS: Record<string, { bg: string; border: string; icon: string; hoverBg: string }> = {
  gray: { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500", hoverBg: "hover:bg-slate-100" },
  blue: { bg: "bg-sky-50", border: "border-sky-200", icon: "text-sky-500", hoverBg: "hover:bg-sky-100" },
  green: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-500", hoverBg: "hover:bg-emerald-100" },
  purple: { bg: "bg-violet-50", border: "border-violet-200", icon: "text-violet-500", hoverBg: "hover:bg-violet-100" },
  cyan: { bg: "bg-cyan-50", border: "border-cyan-200", icon: "text-cyan-500", hoverBg: "hover:bg-cyan-100" },
  teal: { bg: "bg-teal-50", border: "border-teal-200", icon: "text-teal-500", hoverBg: "hover:bg-teal-100" },
  orange: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-500", hoverBg: "hover:bg-amber-100" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-500", hoverBg: "hover:bg-emerald-100" },
  red: { bg: "bg-rose-50", border: "border-rose-200", icon: "text-rose-500", hoverBg: "hover:bg-rose-100" },
  yellow: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-500", hoverBg: "hover:bg-amber-100" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-200", icon: "text-indigo-500", hoverBg: "hover:bg-indigo-100" },
  sky: { bg: "bg-sky-50", border: "border-sky-200", icon: "text-sky-500", hoverBg: "hover:bg-sky-100" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-500", hoverBg: "hover:bg-amber-100" },
  lime: { bg: "bg-lime-50", border: "border-lime-200", icon: "text-lime-600", hoverBg: "hover:bg-lime-100" },
  violet: { bg: "bg-violet-50", border: "border-violet-200", icon: "text-violet-500", hoverBg: "hover:bg-violet-100" },
  rose: { bg: "bg-rose-50", border: "border-rose-200", icon: "text-rose-500", hoverBg: "hover:bg-rose-100" },
  pink: { bg: "bg-pink-50", border: "border-pink-200", icon: "text-pink-500", hoverBg: "hover:bg-pink-100" },
  fuchsia: { bg: "bg-fuchsia-50", border: "border-fuchsia-200", icon: "text-fuchsia-500", hoverBg: "hover:bg-fuchsia-100" },
  slate: { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500", hoverBg: "hover:bg-slate-100" },
};

function resolveIcon(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  const map = LucideIcons as unknown as Record<string, LucideIcon>;
  return map[name] || null;
}

export interface PulseStatus {
  id: string;
  code?: string;
  name: string;
  categoryId?: string | null;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
  defaultAction?: string;
  isFinal?: boolean;
  isConversion?: boolean;
  allowPhone?: boolean;
  allowEmail?: boolean;
  allowSms?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  [k: string]: any;
}

export interface PulseCategory {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
  [k: string]: any;
}

interface PulseViewProps {
  categories: PulseCategory[];
  statuses: PulseStatus[]; // assigned, may include parents+children
  onSelectStatus: (status: PulseStatus) => void;
  getStatusName?: (s: PulseStatus) => string;
  selectedIds?: Set<string>;
  multiSelectMode?: boolean;
  emptyMessage?: string;
  compactClassName?: string;
}

export function NexusPulseView({
  categories,
  statuses,
  onSelectStatus,
  getStatusName,
  selectedIds,
  multiSelectMode,
  emptyMessage,
}: PulseViewProps) {
  const [prefs, setPrefs] = usePulsePrefs();

  const sortedCats = useMemo(
    () => [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories]
  );

  const statusesByCat = useMemo(() => {
    const map: Record<string, PulseStatus[]> = {};
    for (const s of statuses) {
      if (s.parentId) continue;
      if (s.isActive === false) continue;
      const k = s.categoryId || "__uncat__";
      (map[k] ||= []).push(s);
    }
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    );
    return map;
  }, [statuses]);

  const childCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of statuses) {
      if (s.parentId && s.isActive !== false) m[s.parentId] = (m[s.parentId] || 0) + 1;
    }
    return m;
  }, [statuses]);

  const visibleCats = useMemo(
    () => sortedCats.filter((c) => (statusesByCat[c.id] || []).length > 0),
    [sortedCats, statusesByCat]
  );

  const initialExpanded = useMemo(() => {
    const s = new Set<string>();
    if (prefs.defaultExpand === "all") visibleCats.forEach((c) => s.add(c.id));
    else if (prefs.defaultExpand === "first" && visibleCats[0]) s.add(visibleCats[0].id);
    if ((statusesByCat["__uncat__"] || []).length > 0 && prefs.defaultExpand !== "none") s.add("__uncat__");
    return s;
  }, [visibleCats, statusesByCat, prefs.defaultExpand]);

  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);
  const [expandedKey, setExpandedKey] = useState<string>("");

  // Reapply defaults when prefs.defaultExpand or category set changes
  useEffect(() => {
    const key = `${prefs.defaultExpand}|${visibleCats.map((c) => c.id).join(",")}`;
    if (key !== expandedKey) {
      setExpanded(initialExpanded);
      setExpandedKey(key);
    }
  }, [prefs.defaultExpand, visibleCats, initialExpanded, expandedKey]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = () => setExpanded(new Set([...visibleCats.map((c) => c.id), "__uncat__"]));
  const collapseAll = () => setExpanded(new Set());

  const renderName = (s: PulseStatus) => (getStatusName ? getStatusName(s) : s.name);

  const renderStatus = (status: PulseStatus, fallbackColor?: string) => {
    const colorKey = status.color || fallbackColor || "gray";
    const colorClass = PULSE_STATUS_COLORS[colorKey] || PULSE_STATUS_COLORS.gray;
    const StatusIcon = resolveIcon(status.icon);
    const subCount = childCount[status.id] || 0;
    const isSelected = selectedIds?.has(status.id);
    const action = status.defaultAction || "none";

    if (prefs.displayMode === "compact") {
      return (
        <button
          key={status.id}
          type="button"
          onClick={() => onSelectStatus(status)}
          className={`group flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-all ${colorClass} ${
            isSelected ? "ring-2 ring-primary" : ""
          }`}
          data-testid={`pulse-status-${status.id}`}
        >
          {StatusIcon && <StatusIcon className="h-3.5 w-3.5 opacity-60 shrink-0" />}
          <span className="font-medium text-sm flex-1 truncate">{renderName(status)}</span>
          {prefs.showActionBadges && action !== "none" && (
            <Badge className={`${STATUS_ACTION_COLORS[action] || ""} text-[9px] px-1 py-0`}>
              {STATUS_ACTION_LABELS[action] || action}
            </Badge>
          )}
          {subCount > 0 && (
            <span className="text-[10px] text-indigo-600 font-medium shrink-0">{subCount}↳</span>
          )}
        </button>
      );
    }

    return (
      <button
        key={status.id}
        type="button"
        onClick={() => onSelectStatus(status)}
        className={`p-3 rounded-lg border text-left transition-all ${colorClass} hover:shadow-md active:scale-[0.98] ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        data-testid={`pulse-status-${status.id}`}
      >
        <div className="flex items-center gap-1.5">
          {StatusIcon && <StatusIcon className="h-3.5 w-3.5 opacity-60" />}
          <div className="font-semibold text-sm truncate flex-1">{renderName(status)}</div>
        </div>
        {(prefs.showActionBadges || status.isFinal || status.isConversion || subCount > 0) && (
          <div className="text-xs opacity-70 mt-0.5 flex items-center gap-1">
            {prefs.showActionBadges && (
              <Badge className={`${STATUS_ACTION_COLORS[action] || ""} text-[9px] px-1 py-0`}>
                {STATUS_ACTION_LABELS[action] || action}
              </Badge>
            )}
            {status.isFinal && <span className="text-red-500 font-bold text-[10px]">F</span>}
            {status.isConversion && <span className="text-green-500 font-bold text-[10px]">K</span>}
            {subCount > 0 && (
              <span className="text-indigo-500 font-medium text-[10px]">{subCount} pod</span>
            )}
          </div>
        )}
        {prefs.showChannelIcons && (
          <div className="flex gap-1 mt-1">
            {status.allowPhone && <Phone className="h-3 w-3 text-sky-400" />}
            {status.allowEmail && <Mail className="h-3 w-3 text-violet-400" />}
            {status.allowSms && <MessageSquare className="h-3 w-3 text-teal-400" />}
          </div>
        )}
      </button>
    );
  };

  const renderCategoryGroup = (catId: string, statusList: PulseStatus[], cat?: PulseCategory) => {
    const isExpanded = expanded.has(catId);
    const colorKey = cat?.color || "gray";
    const catColors = PULSE_CATEGORY_COLORS[colorKey] || PULSE_CATEGORY_COLORS.gray;
    const CatIcon = cat ? resolveIcon(cat.icon) : null;
    const gridCols = prefs.displayMode === "compact" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 md:grid-cols-3";

    return (
      <div
        key={catId}
        className={`rounded-xl border ${catColors.border} overflow-hidden transition-all`}
        data-testid={`pulse-cat-${catId}`}
      >
        <button
          type="button"
          className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${catColors.bg} ${catColors.hoverBg}`}
          onClick={() => toggle(catId)}
          data-testid={`pulse-cat-toggle-${catId}`}
        >
          {CatIcon ? <CatIcon className={`h-5 w-5 ${catColors.icon}`} /> : <FolderOpen className={`h-5 w-5 ${catColors.icon}`} />}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground">{cat?.name || "Bez kategórie"}</div>
            <div className="text-xs text-muted-foreground">
              {statusList.length} {statusList.length === 1 ? "status" : "statusov"}
            </div>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {isExpanded && (
          <div className={`p-3 bg-background/60 border-t ${prefs.displayMode === "compact" ? "" : ""}`}>
            <div className={`grid ${gridCols} gap-2`}>
              {statusList.map((s) => renderStatus(s, cat?.color || undefined))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const totalVisible = visibleCats.reduce((acc, c) => acc + (statusesByCat[c.id] || []).length, 0)
    + (statusesByCat["__uncat__"] || []).length;

  if (totalVisible === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground" data-testid="pulse-empty">
        {emptyMessage || "Žiadne priradené statusy."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={expandAll} data-testid="pulse-expand-all">
            Rozbaliť všetky
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={collapseAll} data-testid="pulse-collapse-all">
            Zbaliť všetky
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {multiSelectMode && (
            <Badge variant="secondary" className="text-[10px]">
              Multi: {selectedIds?.size || 0}
            </Badge>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" data-testid="pulse-prefs-trigger">
                <Settings2 className="h-3.5 w-3.5" />
                Zobrazenie
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prispôsobenie</div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Formát statusov</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={prefs.displayMode === "tiles" ? "default" : "outline"}
                      className="h-8 gap-1 text-xs"
                      onClick={() => setPrefs({ ...prefs, displayMode: "tiles" })}
                      data-testid="pref-display-tiles"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" /> Dlaždice
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={prefs.displayMode === "compact" ? "default" : "outline"}
                      className="h-8 gap-1 text-xs"
                      onClick={() => setPrefs({ ...prefs, displayMode: "compact" })}
                      data-testid="pref-display-compact"
                    >
                      <AlignJustify className="h-3.5 w-3.5" /> Text-buttony
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Predvolené rozbalenie kategórií</Label>
                  <Select
                    value={prefs.defaultExpand}
                    onValueChange={(v) => setPrefs({ ...prefs, defaultExpand: v as PulseDefaultExpand })}
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid="pref-default-expand">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky rozbalené</SelectItem>
                      <SelectItem value="first">Iba prvá rozbalená</SelectItem>
                      <SelectItem value="none">Všetky zbalené</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
                  <Label htmlFor="pref-action" className="text-xs cursor-pointer">Zobraziť badge akcie</Label>
                  <input
                    id="pref-action"
                    type="checkbox"
                    checked={prefs.showActionBadges}
                    onChange={(e) => setPrefs({ ...prefs, showActionBadges: e.target.checked })}
                    className="h-4 w-4 cursor-pointer"
                    data-testid="pref-show-actions"
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
                  <Label htmlFor="pref-channels" className="text-xs cursor-pointer">Zobraziť ikony kanálov</Label>
                  <input
                    id="pref-channels"
                    type="checkbox"
                    checked={prefs.showChannelIcons}
                    onChange={(e) => setPrefs({ ...prefs, showChannelIcons: e.target.checked })}
                    className="h-4 w-4 cursor-pointer"
                    data-testid="pref-show-channels"
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">Nastavenia sú spoločné pre náhľad v kampani aj agentov drawer.</p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        {visibleCats.map((cat) => renderCategoryGroup(cat.id, statusesByCat[cat.id] || [], cat))}
        {(statusesByCat["__uncat__"] || []).length > 0 &&
          renderCategoryGroup("__uncat__", statusesByCat["__uncat__"] || [], undefined)}
      </div>
    </div>
  );
}
