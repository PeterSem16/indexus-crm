import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FolderOpen, Phone, Mail, MessageSquare, Settings2, LayoutGrid, AlignJustify, ChevronRight, CircleDot } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n";

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

const STATUS_ACTION_COLORS: Record<string, string> = {
  none: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  callback: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  reschedule: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  do_not_call: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  complete: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  conversion: "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300",
  send_email: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300",
  send_sms: "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
  schedule_email: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300",
  schedule_sms: "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
};

interface ColorScheme {
  catBg: string;
  catHover: string;
  catBorder: string;
  catLeftBorder: string;
  catIconBg: string;
  catIconColor: string;
  catText: string;
  catCountBadge: string;
  tileBg: string;
  tileHover: string;
  tileBorder: string;
  tileIconBg: string;
  tileIconColor: string;
  tileText: string;
}

const COLOR_SCHEMES: Record<string, ColorScheme> = {
  gray: {
    catBg: "bg-slate-50 dark:bg-slate-900/40", catHover: "hover:bg-slate-100 dark:hover:bg-slate-800/50",
    catBorder: "border-slate-200 dark:border-slate-700", catLeftBorder: "border-l-slate-500",
    catIconBg: "bg-slate-500 dark:bg-slate-600", catIconColor: "text-white",
    catText: "text-slate-700 dark:text-slate-200", catCountBadge: "bg-slate-500 text-white dark:bg-slate-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-slate-50 dark:hover:bg-slate-800/40",
    tileBorder: "border-slate-200 dark:border-slate-700", tileIconBg: "bg-slate-100 dark:bg-slate-800",
    tileIconColor: "text-slate-600 dark:text-slate-300", tileText: "text-slate-700 dark:text-slate-200",
  },
  blue: {
    catBg: "bg-sky-50 dark:bg-sky-950/30", catHover: "hover:bg-sky-100 dark:hover:bg-sky-900/40",
    catBorder: "border-sky-200 dark:border-sky-800", catLeftBorder: "border-l-sky-500",
    catIconBg: "bg-sky-500 dark:bg-sky-600", catIconColor: "text-white",
    catText: "text-sky-800 dark:text-sky-200", catCountBadge: "bg-sky-500 text-white dark:bg-sky-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-sky-50 dark:hover:bg-sky-950/20",
    tileBorder: "border-sky-200 dark:border-sky-800", tileIconBg: "bg-sky-100 dark:bg-sky-900/50",
    tileIconColor: "text-sky-600 dark:text-sky-400", tileText: "text-sky-900 dark:text-sky-100",
  },
  green: {
    catBg: "bg-emerald-50 dark:bg-emerald-950/30", catHover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
    catBorder: "border-emerald-200 dark:border-emerald-800", catLeftBorder: "border-l-emerald-500",
    catIconBg: "bg-emerald-500 dark:bg-emerald-600", catIconColor: "text-white",
    catText: "text-emerald-800 dark:text-emerald-200", catCountBadge: "bg-emerald-500 text-white dark:bg-emerald-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
    tileBorder: "border-emerald-200 dark:border-emerald-800", tileIconBg: "bg-emerald-100 dark:bg-emerald-900/50",
    tileIconColor: "text-emerald-600 dark:text-emerald-400", tileText: "text-emerald-900 dark:text-emerald-100",
  },
  purple: {
    catBg: "bg-violet-50 dark:bg-violet-950/30", catHover: "hover:bg-violet-100 dark:hover:bg-violet-900/40",
    catBorder: "border-violet-200 dark:border-violet-800", catLeftBorder: "border-l-violet-500",
    catIconBg: "bg-violet-500 dark:bg-violet-600", catIconColor: "text-white",
    catText: "text-violet-800 dark:text-violet-200", catCountBadge: "bg-violet-500 text-white dark:bg-violet-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-violet-50 dark:hover:bg-violet-950/20",
    tileBorder: "border-violet-200 dark:border-violet-800", tileIconBg: "bg-violet-100 dark:bg-violet-900/50",
    tileIconColor: "text-violet-600 dark:text-violet-400", tileText: "text-violet-900 dark:text-violet-100",
  },
  cyan: {
    catBg: "bg-cyan-50 dark:bg-cyan-950/30", catHover: "hover:bg-cyan-100 dark:hover:bg-cyan-900/40",
    catBorder: "border-cyan-200 dark:border-cyan-800", catLeftBorder: "border-l-cyan-500",
    catIconBg: "bg-cyan-500 dark:bg-cyan-600", catIconColor: "text-white",
    catText: "text-cyan-800 dark:text-cyan-200", catCountBadge: "bg-cyan-500 text-white dark:bg-cyan-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-cyan-50 dark:hover:bg-cyan-950/20",
    tileBorder: "border-cyan-200 dark:border-cyan-800", tileIconBg: "bg-cyan-100 dark:bg-cyan-900/50",
    tileIconColor: "text-cyan-600 dark:text-cyan-400", tileText: "text-cyan-900 dark:text-cyan-100",
  },
  teal: {
    catBg: "bg-teal-50 dark:bg-teal-950/30", catHover: "hover:bg-teal-100 dark:hover:bg-teal-900/40",
    catBorder: "border-teal-200 dark:border-teal-800", catLeftBorder: "border-l-teal-500",
    catIconBg: "bg-teal-500 dark:bg-teal-600", catIconColor: "text-white",
    catText: "text-teal-800 dark:text-teal-200", catCountBadge: "bg-teal-500 text-white dark:bg-teal-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-teal-50 dark:hover:bg-teal-950/20",
    tileBorder: "border-teal-200 dark:border-teal-800", tileIconBg: "bg-teal-100 dark:bg-teal-900/50",
    tileIconColor: "text-teal-600 dark:text-teal-400", tileText: "text-teal-900 dark:text-teal-100",
  },
  orange: {
    catBg: "bg-amber-50 dark:bg-amber-950/30", catHover: "hover:bg-amber-100 dark:hover:bg-amber-900/40",
    catBorder: "border-amber-200 dark:border-amber-800", catLeftBorder: "border-l-amber-500",
    catIconBg: "bg-amber-500 dark:bg-amber-600", catIconColor: "text-white",
    catText: "text-amber-800 dark:text-amber-200", catCountBadge: "bg-amber-500 text-white dark:bg-amber-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-amber-50 dark:hover:bg-amber-950/20",
    tileBorder: "border-amber-200 dark:border-amber-800", tileIconBg: "bg-amber-100 dark:bg-amber-900/50",
    tileIconColor: "text-amber-600 dark:text-amber-400", tileText: "text-amber-900 dark:text-amber-100",
  },
  emerald: {
    catBg: "bg-emerald-50 dark:bg-emerald-950/30", catHover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
    catBorder: "border-emerald-200 dark:border-emerald-800", catLeftBorder: "border-l-emerald-500",
    catIconBg: "bg-emerald-500 dark:bg-emerald-600", catIconColor: "text-white",
    catText: "text-emerald-800 dark:text-emerald-200", catCountBadge: "bg-emerald-500 text-white dark:bg-emerald-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
    tileBorder: "border-emerald-200 dark:border-emerald-800", tileIconBg: "bg-emerald-100 dark:bg-emerald-900/50",
    tileIconColor: "text-emerald-600 dark:text-emerald-400", tileText: "text-emerald-900 dark:text-emerald-100",
  },
  red: {
    catBg: "bg-rose-50 dark:bg-rose-950/30", catHover: "hover:bg-rose-100 dark:hover:bg-rose-900/40",
    catBorder: "border-rose-200 dark:border-rose-800", catLeftBorder: "border-l-rose-500",
    catIconBg: "bg-rose-500 dark:bg-rose-600", catIconColor: "text-white",
    catText: "text-rose-800 dark:text-rose-200", catCountBadge: "bg-rose-500 text-white dark:bg-rose-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-rose-50 dark:hover:bg-rose-950/20",
    tileBorder: "border-rose-200 dark:border-rose-800", tileIconBg: "bg-rose-100 dark:bg-rose-900/50",
    tileIconColor: "text-rose-600 dark:text-rose-400", tileText: "text-rose-900 dark:text-rose-100",
  },
  yellow: {
    catBg: "bg-yellow-50 dark:bg-yellow-950/30", catHover: "hover:bg-yellow-100 dark:hover:bg-yellow-900/40",
    catBorder: "border-yellow-200 dark:border-yellow-800", catLeftBorder: "border-l-yellow-500",
    catIconBg: "bg-yellow-500 dark:bg-yellow-600", catIconColor: "text-white",
    catText: "text-yellow-800 dark:text-yellow-200", catCountBadge: "bg-yellow-500 text-white dark:bg-yellow-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-yellow-50 dark:hover:bg-yellow-950/20",
    tileBorder: "border-yellow-200 dark:border-yellow-800", tileIconBg: "bg-yellow-100 dark:bg-yellow-900/50",
    tileIconColor: "text-yellow-600 dark:text-yellow-400", tileText: "text-yellow-900 dark:text-yellow-100",
  },
  indigo: {
    catBg: "bg-indigo-50 dark:bg-indigo-950/30", catHover: "hover:bg-indigo-100 dark:hover:bg-indigo-900/40",
    catBorder: "border-indigo-200 dark:border-indigo-800", catLeftBorder: "border-l-indigo-500",
    catIconBg: "bg-indigo-500 dark:bg-indigo-600", catIconColor: "text-white",
    catText: "text-indigo-800 dark:text-indigo-200", catCountBadge: "bg-indigo-500 text-white dark:bg-indigo-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-indigo-50 dark:hover:bg-indigo-950/20",
    tileBorder: "border-indigo-200 dark:border-indigo-800", tileIconBg: "bg-indigo-100 dark:bg-indigo-900/50",
    tileIconColor: "text-indigo-600 dark:text-indigo-400", tileText: "text-indigo-900 dark:text-indigo-100",
  },
  sky: {
    catBg: "bg-sky-50 dark:bg-sky-950/30", catHover: "hover:bg-sky-100 dark:hover:bg-sky-900/40",
    catBorder: "border-sky-200 dark:border-sky-800", catLeftBorder: "border-l-sky-500",
    catIconBg: "bg-sky-500 dark:bg-sky-600", catIconColor: "text-white",
    catText: "text-sky-800 dark:text-sky-200", catCountBadge: "bg-sky-500 text-white dark:bg-sky-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-sky-50 dark:hover:bg-sky-950/20",
    tileBorder: "border-sky-200 dark:border-sky-800", tileIconBg: "bg-sky-100 dark:bg-sky-900/50",
    tileIconColor: "text-sky-600 dark:text-sky-400", tileText: "text-sky-900 dark:text-sky-100",
  },
  amber: {
    catBg: "bg-amber-50 dark:bg-amber-950/30", catHover: "hover:bg-amber-100 dark:hover:bg-amber-900/40",
    catBorder: "border-amber-200 dark:border-amber-800", catLeftBorder: "border-l-amber-500",
    catIconBg: "bg-amber-500 dark:bg-amber-600", catIconColor: "text-white",
    catText: "text-amber-800 dark:text-amber-200", catCountBadge: "bg-amber-500 text-white dark:bg-amber-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-amber-50 dark:hover:bg-amber-950/20",
    tileBorder: "border-amber-200 dark:border-amber-800", tileIconBg: "bg-amber-100 dark:bg-amber-900/50",
    tileIconColor: "text-amber-600 dark:text-amber-400", tileText: "text-amber-900 dark:text-amber-100",
  },
  lime: {
    catBg: "bg-lime-50 dark:bg-lime-950/30", catHover: "hover:bg-lime-100 dark:hover:bg-lime-900/40",
    catBorder: "border-lime-200 dark:border-lime-800", catLeftBorder: "border-l-lime-500",
    catIconBg: "bg-lime-500 dark:bg-lime-600", catIconColor: "text-white",
    catText: "text-lime-800 dark:text-lime-200", catCountBadge: "bg-lime-500 text-white dark:bg-lime-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-lime-50 dark:hover:bg-lime-950/20",
    tileBorder: "border-lime-200 dark:border-lime-800", tileIconBg: "bg-lime-100 dark:bg-lime-900/50",
    tileIconColor: "text-lime-600 dark:text-lime-400", tileText: "text-lime-900 dark:text-lime-100",
  },
  violet: {
    catBg: "bg-violet-50 dark:bg-violet-950/30", catHover: "hover:bg-violet-100 dark:hover:bg-violet-900/40",
    catBorder: "border-violet-200 dark:border-violet-800", catLeftBorder: "border-l-violet-500",
    catIconBg: "bg-violet-500 dark:bg-violet-600", catIconColor: "text-white",
    catText: "text-violet-800 dark:text-violet-200", catCountBadge: "bg-violet-500 text-white dark:bg-violet-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-violet-50 dark:hover:bg-violet-950/20",
    tileBorder: "border-violet-200 dark:border-violet-800", tileIconBg: "bg-violet-100 dark:bg-violet-900/50",
    tileIconColor: "text-violet-600 dark:text-violet-400", tileText: "text-violet-900 dark:text-violet-100",
  },
  rose: {
    catBg: "bg-rose-50 dark:bg-rose-950/30", catHover: "hover:bg-rose-100 dark:hover:bg-rose-900/40",
    catBorder: "border-rose-200 dark:border-rose-800", catLeftBorder: "border-l-rose-500",
    catIconBg: "bg-rose-500 dark:bg-rose-600", catIconColor: "text-white",
    catText: "text-rose-800 dark:text-rose-200", catCountBadge: "bg-rose-500 text-white dark:bg-rose-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-rose-50 dark:hover:bg-rose-950/20",
    tileBorder: "border-rose-200 dark:border-rose-800", tileIconBg: "bg-rose-100 dark:bg-rose-900/50",
    tileIconColor: "text-rose-600 dark:text-rose-400", tileText: "text-rose-900 dark:text-rose-100",
  },
  pink: {
    catBg: "bg-pink-50 dark:bg-pink-950/30", catHover: "hover:bg-pink-100 dark:hover:bg-pink-900/40",
    catBorder: "border-pink-200 dark:border-pink-800", catLeftBorder: "border-l-pink-500",
    catIconBg: "bg-pink-500 dark:bg-pink-600", catIconColor: "text-white",
    catText: "text-pink-800 dark:text-pink-200", catCountBadge: "bg-pink-500 text-white dark:bg-pink-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-pink-50 dark:hover:bg-pink-950/20",
    tileBorder: "border-pink-200 dark:border-pink-800", tileIconBg: "bg-pink-100 dark:bg-pink-900/50",
    tileIconColor: "text-pink-600 dark:text-pink-400", tileText: "text-pink-900 dark:text-pink-100",
  },
  fuchsia: {
    catBg: "bg-fuchsia-50 dark:bg-fuchsia-950/30", catHover: "hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40",
    catBorder: "border-fuchsia-200 dark:border-fuchsia-800", catLeftBorder: "border-l-fuchsia-500",
    catIconBg: "bg-fuchsia-500 dark:bg-fuchsia-600", catIconColor: "text-white",
    catText: "text-fuchsia-800 dark:text-fuchsia-200", catCountBadge: "bg-fuchsia-500 text-white dark:bg-fuchsia-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/20",
    tileBorder: "border-fuchsia-200 dark:border-fuchsia-800", tileIconBg: "bg-fuchsia-100 dark:bg-fuchsia-900/50",
    tileIconColor: "text-fuchsia-600 dark:text-fuchsia-400", tileText: "text-fuchsia-900 dark:text-fuchsia-100",
  },
  slate: {
    catBg: "bg-slate-50 dark:bg-slate-900/40", catHover: "hover:bg-slate-100 dark:hover:bg-slate-800/50",
    catBorder: "border-slate-200 dark:border-slate-700", catLeftBorder: "border-l-slate-500",
    catIconBg: "bg-slate-500 dark:bg-slate-600", catIconColor: "text-white",
    catText: "text-slate-700 dark:text-slate-200", catCountBadge: "bg-slate-500 text-white dark:bg-slate-600",
    tileBg: "bg-white dark:bg-slate-900/80", tileHover: "hover:bg-slate-50 dark:hover:bg-slate-800/40",
    tileBorder: "border-slate-200 dark:border-slate-700", tileIconBg: "bg-slate-100 dark:bg-slate-800",
    tileIconColor: "text-slate-600 dark:text-slate-300", tileText: "text-slate-700 dark:text-slate-200",
  },
};

function getScheme(color: string | null | undefined): ColorScheme {
  return COLOR_SCHEMES[color || "gray"] || COLOR_SCHEMES.gray;
}

const COLOR_HEX: Record<string, string> = {
  gray: "#7A6858", blue: "#2E75B6", green: "#4A7A52", purple: "#6B4FCF",
  cyan: "#2A8A9A", teal: "#2A7A70", orange: "#B5622E", emerald: "#3A7A5A",
  red: "#A0493A", yellow: "#A08030", indigo: "#4A4ACF", sky: "#2E75B6",
  amber: "#B5622E", lime: "#5A7A30", violet: "#5B4FCF", rose: "#A04060",
  pink: "#A03060", fuchsia: "#8A30A0", slate: "#5A6A7A", none: "#7A6858",
};

function getHex(color: string | null | undefined): string {
  return COLOR_HEX[color || "gray"] || COLOR_HEX.gray;
}

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
  statuses: PulseStatus[];
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
  const { t } = useI18n();
  const [prefs, setPrefs] = usePulsePrefs();

  const STATUS_ACTION_LABELS: Record<string, string> = {
    none: t.agentWorkspace.pulseActionNone,
    callback: t.agentWorkspace.pulseActionCallback,
    reschedule: t.agentWorkspace.pulseActionReschedule,
    do_not_call: t.agentWorkspace.pulseActionDoNotCall,
    complete: t.agentWorkspace.pulseActionComplete,
    conversion: t.agentWorkspace.pulseActionConversion,
    send_email: t.agentWorkspace.pulseActionSendEmail,
    send_sms: t.agentWorkspace.pulseActionSendSms,
    schedule_email: t.agentWorkspace.pulseActionScheduleEmail,
    schedule_sms: t.agentWorkspace.pulseActionScheduleSms,
    assign_owner: t.agentWorkspace.pulseActionAssignOwner,
    move_queue: t.agentWorkspace.pulseActionMoveQueue,
    start_onboarding: t.agentWorkspace.pulseActionStartOnboarding,
    create_task: t.agentWorkspace.pulseActionCreateTask,
    verify_contact: t.agentWorkspace.pulseActionVerifyContact,
  };

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
    const hex = getHex(colorKey);
    const StatusIcon = resolveIcon(status.icon);
    const subCount = childCount[status.id] || 0;
    const isSelected = selectedIds?.has(status.id);
    const action = status.defaultAction || "none";
    const hasChannels = prefs.showChannelIcons && (status.allowPhone || status.allowEmail || status.allowSms);

    if (prefs.displayMode === "compact") {
      return (
        <button
          key={status.id}
          type="button"
          onClick={() => onSelectStatus(status)}
          className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.98] ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
          style={{
            background: "#FFFFFF",
            border: `1px solid ${hex}22`,
            borderLeft: `3px solid ${hex}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = `${hex}50`;
            (e.currentTarget as HTMLElement).style.borderLeftColor = hex;
            (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${hex}18`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = `${hex}22`;
            (e.currentTarget as HTMLElement).style.borderLeftColor = hex;
            (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
          }}
          data-testid={`pulse-status-${status.id}`}
        >
          {StatusIcon
            ? <StatusIcon className="h-4 w-4 shrink-0" style={{ color: hex }} />
            : <CircleDot className="h-4 w-4 shrink-0" style={{ color: hex }} />
          }
          <span className="font-medium text-sm flex-1 truncate" style={{ color: "#2E2118" }}>{renderName(status)}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {prefs.showActionBadges && action !== "none" && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${hex}15`, color: hex }}>
                {STATUS_ACTION_LABELS[action] || action}
              </span>
            )}
            {subCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: hex, color: "#fff" }}>{subCount}↳</span>
            )}
            {subCount > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" style={{ color: hex }} />}
          </div>
        </button>
      );
    }

    return (
      <button
        key={status.id}
        type="button"
        onClick={() => onSelectStatus(status)}
        className={`group relative p-3 rounded-xl text-left transition-all duration-150 active:scale-[0.97] ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
        style={{
          background: "#FFFFFF",
          border: `1px solid ${hex}22`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = `${hex}55`;
          (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${hex}18`;
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = `${hex}22`;
          (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        }}
        data-testid={`pulse-status-${status.id}`}
      >
        <div className="flex items-start gap-2.5">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${hex}12`, border: `1.5px solid ${hex}28` }}>
            {StatusIcon
              ? <StatusIcon style={{ width: 16, height: 16, color: hex }} />
              : <CircleDot style={{ width: 16, height: 16, color: hex }} />
            }
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="font-semibold text-sm leading-snug" style={{ color: "#2E2118" }}>{renderName(status)}</div>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {prefs.showActionBadges && action !== "none" && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${hex}15`, color: hex }}>
                  {STATUS_ACTION_LABELS[action] || action}
                </span>
              )}
              {subCount > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: hex, color: "#fff" }}>
                  {subCount}<ChevronRight className="h-2.5 w-2.5" />
                </span>
              )}
              {status.isFinal && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">{t.agentWorkspace.pulseFinalBadge}</span>}
              {status.isConversion && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">{t.agentWorkspace.pulseConversionBadge}</span>}
            </div>
          </div>
          {subCount > 0 && (
            <ChevronRight className="h-4 w-4 shrink-0 mt-1 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: hex }} />
          )}
        </div>
        {hasChannels && (
          <div className="flex gap-1 mt-2 pl-[44px]">
            {status.allowPhone && <Phone className="h-3 w-3 text-sky-500" />}
            {status.allowEmail && <Mail className="h-3 w-3 text-violet-500" />}
            {status.allowSms && <MessageSquare className="h-3 w-3 text-teal-500" />}
          </div>
        )}
      </button>
    );
  };

  const renderCategoryGroup = (catId: string, statusList: PulseStatus[], cat?: PulseCategory) => {
    const isExpanded = expanded.has(catId);
    const hex = getHex(cat?.color);
    const CatIcon = cat ? resolveIcon(cat.icon) : null;
    const gridCols = prefs.displayMode === "compact" ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3";

    return (
      <div
        key={catId}
        className="rounded-2xl overflow-hidden transition-all duration-200"
        style={{
          background: "#F8F4EE",
          border: `1.5px solid ${hex}35`,
          boxShadow: `0 2px 10px ${hex}12`,
        }}
        data-testid={`pulse-cat-${catId}`}
      >
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150"
          style={{
            background: isExpanded ? `${hex}12` : `${hex}07`,
            borderBottom: isExpanded ? `1px solid ${hex}28` : "none",
          }}
          onClick={() => toggle(catId)}
          data-testid={`pulse-cat-toggle-${catId}`}
        >
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: hex, boxShadow: `0 2px 8px ${hex}45` }}>
            {CatIcon
              ? <CatIcon className="h-5 w-5 text-white" />
              : <FolderOpen className="h-5 w-5 text-white" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: "#2E2118" }}>{cat?.name || t.agentWorkspace.pulseUncategorized}</div>
            <div className="text-xs" style={{ color: "#9A8878" }}>
              {statusList.length} {statusList.length === 1 ? t.agentWorkspace.pulseStatusSingular : t.agentWorkspace.pulseStatusPlural}
            </div>
          </div>
          <span className="text-xs font-bold min-w-[28px] h-7 flex items-center justify-center rounded-full px-2 shrink-0" style={{ background: hex, color: "#fff" }}>
            {statusList.length}
          </span>
          {isExpanded
            ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: hex }} />
            : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: hex }} />
          }
        </button>
        {isExpanded && (
          <div className="p-3" style={{ background: "#F8F4EE" }}>
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
        {emptyMessage || t.agentWorkspace.pulseEmpty}
      </div>
    );
  }

  // If there are no real categories (all statuses are uncategorized), render flat expanded list
  const hasRealCategories = visibleCats.length > 0;
  const uncatStatuses = statusesByCat["__uncat__"] || [];
  if (!hasRealCategories) {
    const gridCols = prefs.displayMode === "compact" ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3";
    return (
      <div className="space-y-2">
        <div className={`grid ${gridCols} gap-2`}>
          {uncatStatuses.map((s) => renderStatus(s))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={expandAll} data-testid="pulse-expand-all">
            {t.agentWorkspace.pulseExpandAll}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={collapseAll} data-testid="pulse-collapse-all">
            {t.agentWorkspace.pulseCollapseAll}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {multiSelectMode && (
            <Badge variant="secondary" className="text-[10px]">
              {t.agentWorkspace.pulseMulti}: {selectedIds?.size || 0}
            </Badge>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" data-testid="pulse-prefs-trigger">
                <Settings2 className="h-3.5 w-3.5" />
                {t.agentWorkspace.pulseDisplay}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.agentWorkspace.pulseCustomization}</div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t.agentWorkspace.pulseStatusFormat}</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={prefs.displayMode === "tiles" ? "default" : "outline"}
                      className="h-8 gap-1 text-xs"
                      onClick={() => setPrefs({ ...prefs, displayMode: "tiles" })}
                      data-testid="pref-display-tiles"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" /> {t.agentWorkspace.pulseTiles}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={prefs.displayMode === "compact" ? "default" : "outline"}
                      className="h-8 gap-1 text-xs"
                      onClick={() => setPrefs({ ...prefs, displayMode: "compact" })}
                      data-testid="pref-display-compact"
                    >
                      <AlignJustify className="h-3.5 w-3.5" /> {t.agentWorkspace.pulseCompact}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t.agentWorkspace.pulseDefaultExpand}</Label>
                  <Select
                    value={prefs.defaultExpand}
                    onValueChange={(v) => setPrefs({ ...prefs, defaultExpand: v as PulseDefaultExpand })}
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid="pref-default-expand">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t.agentWorkspace.pulseExpandAllOpt}</SelectItem>
                      <SelectItem value="first">{t.agentWorkspace.pulseExpandFirst}</SelectItem>
                      <SelectItem value="none">{t.agentWorkspace.pulseExpandNone}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
                  <Label htmlFor="pref-action" className="text-xs cursor-pointer">{t.agentWorkspace.pulseShowActionBadges}</Label>
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
                  <Label htmlFor="pref-channels" className="text-xs cursor-pointer">{t.agentWorkspace.pulseShowChannelIcons}</Label>
                  <input
                    id="pref-channels"
                    type="checkbox"
                    checked={prefs.showChannelIcons}
                    onChange={(e) => setPrefs({ ...prefs, showChannelIcons: e.target.checked })}
                    className="h-4 w-4 cursor-pointer"
                    data-testid="pref-show-channels"
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">{t.agentWorkspace.pulseSettingsShared}</p>
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
