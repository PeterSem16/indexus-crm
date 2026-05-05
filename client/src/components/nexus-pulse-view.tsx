import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FolderOpen, Phone, Mail, MessageSquare, Settings2, LayoutGrid, AlignJustify, ChevronRight, CircleDot } from "lucide-react";
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
    catBorder: "border-slate-200 dark:border-slate-700", catLeftBorder: "border-l-slate-400",
    catIconBg: "bg-slate-200 dark:bg-slate-700", catIconColor: "text-slate-600 dark:text-slate-300",
    catText: "text-slate-700 dark:text-slate-200", catCountBadge: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    tileBg: "bg-slate-50 dark:bg-slate-900/30", tileHover: "hover:bg-slate-100 dark:hover:bg-slate-800/50",
    tileBorder: "border-slate-200 dark:border-slate-700", tileIconBg: "bg-slate-200 dark:bg-slate-700",
    tileIconColor: "text-slate-600 dark:text-slate-300", tileText: "text-slate-700 dark:text-slate-200",
  },
  blue: {
    catBg: "bg-sky-50 dark:bg-sky-950/30", catHover: "hover:bg-sky-100 dark:hover:bg-sky-900/40",
    catBorder: "border-sky-200 dark:border-sky-800", catLeftBorder: "border-l-sky-500",
    catIconBg: "bg-sky-200 dark:bg-sky-800", catIconColor: "text-sky-700 dark:text-sky-300",
    catText: "text-sky-800 dark:text-sky-200", catCountBadge: "bg-sky-200 text-sky-700 dark:bg-sky-800 dark:text-sky-200",
    tileBg: "bg-sky-50 dark:bg-sky-950/20", tileHover: "hover:bg-sky-100 dark:hover:bg-sky-900/30",
    tileBorder: "border-sky-200 dark:border-sky-800", tileIconBg: "bg-sky-200 dark:bg-sky-800",
    tileIconColor: "text-sky-700 dark:text-sky-300", tileText: "text-sky-800 dark:text-sky-200",
  },
  green: {
    catBg: "bg-emerald-50 dark:bg-emerald-950/30", catHover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
    catBorder: "border-emerald-200 dark:border-emerald-800", catLeftBorder: "border-l-emerald-500",
    catIconBg: "bg-emerald-200 dark:bg-emerald-800", catIconColor: "text-emerald-700 dark:text-emerald-300",
    catText: "text-emerald-800 dark:text-emerald-200", catCountBadge: "bg-emerald-200 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200",
    tileBg: "bg-emerald-50 dark:bg-emerald-950/20", tileHover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
    tileBorder: "border-emerald-200 dark:border-emerald-800", tileIconBg: "bg-emerald-200 dark:bg-emerald-800",
    tileIconColor: "text-emerald-700 dark:text-emerald-300", tileText: "text-emerald-800 dark:text-emerald-200",
  },
  purple: {
    catBg: "bg-violet-50 dark:bg-violet-950/30", catHover: "hover:bg-violet-100 dark:hover:bg-violet-900/40",
    catBorder: "border-violet-200 dark:border-violet-800", catLeftBorder: "border-l-violet-500",
    catIconBg: "bg-violet-200 dark:bg-violet-800", catIconColor: "text-violet-700 dark:text-violet-300",
    catText: "text-violet-800 dark:text-violet-200", catCountBadge: "bg-violet-200 text-violet-700 dark:bg-violet-800 dark:text-violet-200",
    tileBg: "bg-violet-50 dark:bg-violet-950/20", tileHover: "hover:bg-violet-100 dark:hover:bg-violet-900/30",
    tileBorder: "border-violet-200 dark:border-violet-800", tileIconBg: "bg-violet-200 dark:bg-violet-800",
    tileIconColor: "text-violet-700 dark:text-violet-300", tileText: "text-violet-800 dark:text-violet-200",
  },
  cyan: {
    catBg: "bg-cyan-50 dark:bg-cyan-950/30", catHover: "hover:bg-cyan-100 dark:hover:bg-cyan-900/40",
    catBorder: "border-cyan-200 dark:border-cyan-800", catLeftBorder: "border-l-cyan-500",
    catIconBg: "bg-cyan-200 dark:bg-cyan-800", catIconColor: "text-cyan-700 dark:text-cyan-300",
    catText: "text-cyan-800 dark:text-cyan-200", catCountBadge: "bg-cyan-200 text-cyan-700 dark:bg-cyan-800 dark:text-cyan-200",
    tileBg: "bg-cyan-50 dark:bg-cyan-950/20", tileHover: "hover:bg-cyan-100 dark:hover:bg-cyan-900/30",
    tileBorder: "border-cyan-200 dark:border-cyan-800", tileIconBg: "bg-cyan-200 dark:bg-cyan-800",
    tileIconColor: "text-cyan-700 dark:text-cyan-300", tileText: "text-cyan-800 dark:text-cyan-200",
  },
  teal: {
    catBg: "bg-teal-50 dark:bg-teal-950/30", catHover: "hover:bg-teal-100 dark:hover:bg-teal-900/40",
    catBorder: "border-teal-200 dark:border-teal-800", catLeftBorder: "border-l-teal-500",
    catIconBg: "bg-teal-200 dark:bg-teal-800", catIconColor: "text-teal-700 dark:text-teal-300",
    catText: "text-teal-800 dark:text-teal-200", catCountBadge: "bg-teal-200 text-teal-700 dark:bg-teal-800 dark:text-teal-200",
    tileBg: "bg-teal-50 dark:bg-teal-950/20", tileHover: "hover:bg-teal-100 dark:hover:bg-teal-900/30",
    tileBorder: "border-teal-200 dark:border-teal-800", tileIconBg: "bg-teal-200 dark:bg-teal-800",
    tileIconColor: "text-teal-700 dark:text-teal-300", tileText: "text-teal-800 dark:text-teal-200",
  },
  orange: {
    catBg: "bg-amber-50 dark:bg-amber-950/30", catHover: "hover:bg-amber-100 dark:hover:bg-amber-900/40",
    catBorder: "border-amber-200 dark:border-amber-800", catLeftBorder: "border-l-amber-500",
    catIconBg: "bg-amber-200 dark:bg-amber-800", catIconColor: "text-amber-700 dark:text-amber-300",
    catText: "text-amber-800 dark:text-amber-200", catCountBadge: "bg-amber-200 text-amber-700 dark:bg-amber-800 dark:text-amber-200",
    tileBg: "bg-amber-50 dark:bg-amber-950/20", tileHover: "hover:bg-amber-100 dark:hover:bg-amber-900/30",
    tileBorder: "border-amber-200 dark:border-amber-800", tileIconBg: "bg-amber-200 dark:bg-amber-800",
    tileIconColor: "text-amber-700 dark:text-amber-300", tileText: "text-amber-800 dark:text-amber-200",
  },
  emerald: {
    catBg: "bg-emerald-50 dark:bg-emerald-950/30", catHover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
    catBorder: "border-emerald-200 dark:border-emerald-800", catLeftBorder: "border-l-emerald-500",
    catIconBg: "bg-emerald-200 dark:bg-emerald-800", catIconColor: "text-emerald-700 dark:text-emerald-300",
    catText: "text-emerald-800 dark:text-emerald-200", catCountBadge: "bg-emerald-200 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200",
    tileBg: "bg-emerald-50 dark:bg-emerald-950/20", tileHover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
    tileBorder: "border-emerald-200 dark:border-emerald-800", tileIconBg: "bg-emerald-200 dark:bg-emerald-800",
    tileIconColor: "text-emerald-700 dark:text-emerald-300", tileText: "text-emerald-800 dark:text-emerald-200",
  },
  red: {
    catBg: "bg-rose-50 dark:bg-rose-950/30", catHover: "hover:bg-rose-100 dark:hover:bg-rose-900/40",
    catBorder: "border-rose-200 dark:border-rose-800", catLeftBorder: "border-l-rose-500",
    catIconBg: "bg-rose-200 dark:bg-rose-800", catIconColor: "text-rose-700 dark:text-rose-300",
    catText: "text-rose-800 dark:text-rose-200", catCountBadge: "bg-rose-200 text-rose-700 dark:bg-rose-800 dark:text-rose-200",
    tileBg: "bg-rose-50 dark:bg-rose-950/20", tileHover: "hover:bg-rose-100 dark:hover:bg-rose-900/30",
    tileBorder: "border-rose-200 dark:border-rose-800", tileIconBg: "bg-rose-200 dark:bg-rose-800",
    tileIconColor: "text-rose-700 dark:text-rose-300", tileText: "text-rose-800 dark:text-rose-200",
  },
  yellow: {
    catBg: "bg-yellow-50 dark:bg-yellow-950/30", catHover: "hover:bg-yellow-100 dark:hover:bg-yellow-900/40",
    catBorder: "border-yellow-200 dark:border-yellow-800", catLeftBorder: "border-l-yellow-400",
    catIconBg: "bg-yellow-200 dark:bg-yellow-800", catIconColor: "text-yellow-700 dark:text-yellow-300",
    catText: "text-yellow-800 dark:text-yellow-200", catCountBadge: "bg-yellow-200 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200",
    tileBg: "bg-yellow-50 dark:bg-yellow-950/20", tileHover: "hover:bg-yellow-100 dark:hover:bg-yellow-900/30",
    tileBorder: "border-yellow-200 dark:border-yellow-800", tileIconBg: "bg-yellow-200 dark:bg-yellow-800",
    tileIconColor: "text-yellow-700 dark:text-yellow-300", tileText: "text-yellow-800 dark:text-yellow-200",
  },
  indigo: {
    catBg: "bg-indigo-50 dark:bg-indigo-950/30", catHover: "hover:bg-indigo-100 dark:hover:bg-indigo-900/40",
    catBorder: "border-indigo-200 dark:border-indigo-800", catLeftBorder: "border-l-indigo-500",
    catIconBg: "bg-indigo-200 dark:bg-indigo-800", catIconColor: "text-indigo-700 dark:text-indigo-300",
    catText: "text-indigo-800 dark:text-indigo-200", catCountBadge: "bg-indigo-200 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200",
    tileBg: "bg-indigo-50 dark:bg-indigo-950/20", tileHover: "hover:bg-indigo-100 dark:hover:bg-indigo-900/30",
    tileBorder: "border-indigo-200 dark:border-indigo-800", tileIconBg: "bg-indigo-200 dark:bg-indigo-800",
    tileIconColor: "text-indigo-700 dark:text-indigo-300", tileText: "text-indigo-800 dark:text-indigo-200",
  },
  sky: {
    catBg: "bg-sky-50 dark:bg-sky-950/30", catHover: "hover:bg-sky-100 dark:hover:bg-sky-900/40",
    catBorder: "border-sky-200 dark:border-sky-800", catLeftBorder: "border-l-sky-500",
    catIconBg: "bg-sky-200 dark:bg-sky-800", catIconColor: "text-sky-700 dark:text-sky-300",
    catText: "text-sky-800 dark:text-sky-200", catCountBadge: "bg-sky-200 text-sky-700 dark:bg-sky-800 dark:text-sky-200",
    tileBg: "bg-sky-50 dark:bg-sky-950/20", tileHover: "hover:bg-sky-100 dark:hover:bg-sky-900/30",
    tileBorder: "border-sky-200 dark:border-sky-800", tileIconBg: "bg-sky-200 dark:bg-sky-800",
    tileIconColor: "text-sky-700 dark:text-sky-300", tileText: "text-sky-800 dark:text-sky-200",
  },
  amber: {
    catBg: "bg-amber-50 dark:bg-amber-950/30", catHover: "hover:bg-amber-100 dark:hover:bg-amber-900/40",
    catBorder: "border-amber-200 dark:border-amber-800", catLeftBorder: "border-l-amber-500",
    catIconBg: "bg-amber-200 dark:bg-amber-800", catIconColor: "text-amber-700 dark:text-amber-300",
    catText: "text-amber-800 dark:text-amber-200", catCountBadge: "bg-amber-200 text-amber-700 dark:bg-amber-800 dark:text-amber-200",
    tileBg: "bg-amber-50 dark:bg-amber-950/20", tileHover: "hover:bg-amber-100 dark:hover:bg-amber-900/30",
    tileBorder: "border-amber-200 dark:border-amber-800", tileIconBg: "bg-amber-200 dark:bg-amber-800",
    tileIconColor: "text-amber-700 dark:text-amber-300", tileText: "text-amber-800 dark:text-amber-200",
  },
  lime: {
    catBg: "bg-lime-50 dark:bg-lime-950/30", catHover: "hover:bg-lime-100 dark:hover:bg-lime-900/40",
    catBorder: "border-lime-200 dark:border-lime-800", catLeftBorder: "border-l-lime-500",
    catIconBg: "bg-lime-200 dark:bg-lime-800", catIconColor: "text-lime-700 dark:text-lime-300",
    catText: "text-lime-800 dark:text-lime-200", catCountBadge: "bg-lime-200 text-lime-700 dark:bg-lime-800 dark:text-lime-200",
    tileBg: "bg-lime-50 dark:bg-lime-950/20", tileHover: "hover:bg-lime-100 dark:hover:bg-lime-900/30",
    tileBorder: "border-lime-200 dark:border-lime-800", tileIconBg: "bg-lime-200 dark:bg-lime-800",
    tileIconColor: "text-lime-700 dark:text-lime-300", tileText: "text-lime-800 dark:text-lime-200",
  },
  violet: {
    catBg: "bg-violet-50 dark:bg-violet-950/30", catHover: "hover:bg-violet-100 dark:hover:bg-violet-900/40",
    catBorder: "border-violet-200 dark:border-violet-800", catLeftBorder: "border-l-violet-500",
    catIconBg: "bg-violet-200 dark:bg-violet-800", catIconColor: "text-violet-700 dark:text-violet-300",
    catText: "text-violet-800 dark:text-violet-200", catCountBadge: "bg-violet-200 text-violet-700 dark:bg-violet-800 dark:text-violet-200",
    tileBg: "bg-violet-50 dark:bg-violet-950/20", tileHover: "hover:bg-violet-100 dark:hover:bg-violet-900/30",
    tileBorder: "border-violet-200 dark:border-violet-800", tileIconBg: "bg-violet-200 dark:bg-violet-800",
    tileIconColor: "text-violet-700 dark:text-violet-300", tileText: "text-violet-800 dark:text-violet-200",
  },
  rose: {
    catBg: "bg-rose-50 dark:bg-rose-950/30", catHover: "hover:bg-rose-100 dark:hover:bg-rose-900/40",
    catBorder: "border-rose-200 dark:border-rose-800", catLeftBorder: "border-l-rose-500",
    catIconBg: "bg-rose-200 dark:bg-rose-800", catIconColor: "text-rose-700 dark:text-rose-300",
    catText: "text-rose-800 dark:text-rose-200", catCountBadge: "bg-rose-200 text-rose-700 dark:bg-rose-800 dark:text-rose-200",
    tileBg: "bg-rose-50 dark:bg-rose-950/20", tileHover: "hover:bg-rose-100 dark:hover:bg-rose-900/30",
    tileBorder: "border-rose-200 dark:border-rose-800", tileIconBg: "bg-rose-200 dark:bg-rose-800",
    tileIconColor: "text-rose-700 dark:text-rose-300", tileText: "text-rose-800 dark:text-rose-200",
  },
  pink: {
    catBg: "bg-pink-50 dark:bg-pink-950/30", catHover: "hover:bg-pink-100 dark:hover:bg-pink-900/40",
    catBorder: "border-pink-200 dark:border-pink-800", catLeftBorder: "border-l-pink-500",
    catIconBg: "bg-pink-200 dark:bg-pink-800", catIconColor: "text-pink-700 dark:text-pink-300",
    catText: "text-pink-800 dark:text-pink-200", catCountBadge: "bg-pink-200 text-pink-700 dark:bg-pink-800 dark:text-pink-200",
    tileBg: "bg-pink-50 dark:bg-pink-950/20", tileHover: "hover:bg-pink-100 dark:hover:bg-pink-900/30",
    tileBorder: "border-pink-200 dark:border-pink-800", tileIconBg: "bg-pink-200 dark:bg-pink-800",
    tileIconColor: "text-pink-700 dark:text-pink-300", tileText: "text-pink-800 dark:text-pink-200",
  },
  fuchsia: {
    catBg: "bg-fuchsia-50 dark:bg-fuchsia-950/30", catHover: "hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40",
    catBorder: "border-fuchsia-200 dark:border-fuchsia-800", catLeftBorder: "border-l-fuchsia-500",
    catIconBg: "bg-fuchsia-200 dark:bg-fuchsia-800", catIconColor: "text-fuchsia-700 dark:text-fuchsia-300",
    catText: "text-fuchsia-800 dark:text-fuchsia-200", catCountBadge: "bg-fuchsia-200 text-fuchsia-700 dark:bg-fuchsia-800 dark:text-fuchsia-200",
    tileBg: "bg-fuchsia-50 dark:bg-fuchsia-950/20", tileHover: "hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/30",
    tileBorder: "border-fuchsia-200 dark:border-fuchsia-800", tileIconBg: "bg-fuchsia-200 dark:bg-fuchsia-800",
    tileIconColor: "text-fuchsia-700 dark:text-fuchsia-300", tileText: "text-fuchsia-800 dark:text-fuchsia-200",
  },
  slate: {
    catBg: "bg-slate-50 dark:bg-slate-900/40", catHover: "hover:bg-slate-100 dark:hover:bg-slate-800/50",
    catBorder: "border-slate-200 dark:border-slate-700", catLeftBorder: "border-l-slate-400",
    catIconBg: "bg-slate-200 dark:bg-slate-700", catIconColor: "text-slate-600 dark:text-slate-300",
    catText: "text-slate-700 dark:text-slate-200", catCountBadge: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    tileBg: "bg-slate-50 dark:bg-slate-900/30", tileHover: "hover:bg-slate-100 dark:hover:bg-slate-800/50",
    tileBorder: "border-slate-200 dark:border-slate-700", tileIconBg: "bg-slate-200 dark:bg-slate-700",
    tileIconColor: "text-slate-600 dark:text-slate-300", tileText: "text-slate-700 dark:text-slate-200",
  },
};

function getScheme(color: string | null | undefined): ColorScheme {
  return COLOR_SCHEMES[color || "gray"] || COLOR_SCHEMES.gray;
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
    const scheme = getScheme(colorKey);
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
          className={`group flex items-center gap-2.5 rounded-lg border-l-[3px] ${scheme.catLeftBorder} border border-l-[3px] px-3 py-2 text-left transition-all duration-150 ${scheme.tileBg} ${scheme.tileHover} ${
            isSelected ? "ring-2 ring-primary ring-offset-1" : ""
          } hover:shadow-sm active:scale-[0.98]`}
          data-testid={`pulse-status-${status.id}`}
        >
          {StatusIcon
            ? <StatusIcon className={`h-4 w-4 shrink-0 ${scheme.tileIconColor}`} />
            : <CircleDot className={`h-4 w-4 shrink-0 ${scheme.tileIconColor}`} />
          }
          <span className={`font-medium text-sm flex-1 truncate ${scheme.tileText}`}>{renderName(status)}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {prefs.showActionBadges && action !== "none" && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_ACTION_COLORS[action] || STATUS_ACTION_COLORS.none}`}>
                {STATUS_ACTION_LABELS[action] || action}
              </span>
            )}
            {subCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${scheme.catCountBadge}`}>{subCount}↳</span>
            )}
            {subCount > 0
              ? <ChevronRight className={`h-3.5 w-3.5 ${scheme.tileIconColor} opacity-60`} />
              : null
            }
          </div>
        </button>
      );
    }

    return (
      <button
        key={status.id}
        type="button"
        onClick={() => onSelectStatus(status)}
        className={`group relative p-3.5 rounded-xl border-2 text-left transition-all duration-150 ${scheme.tileBg} ${scheme.tileBorder} ${scheme.tileHover} hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] ${
          isSelected ? "ring-2 ring-primary ring-offset-1 shadow-md" : ""
        }`}
        data-testid={`pulse-status-${status.id}`}
      >
        <div className="flex items-start gap-2.5">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${scheme.tileIconBg}`}>
            {StatusIcon
              ? <StatusIcon className={`h-4.5 w-4.5 ${scheme.tileIconColor}`} style={{ width: 18, height: 18 }} />
              : <CircleDot className={`h-4.5 w-4.5 ${scheme.tileIconColor}`} style={{ width: 18, height: 18 }} />
            }
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className={`font-semibold text-sm leading-snug ${scheme.tileText}`}>{renderName(status)}</div>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {prefs.showActionBadges && action !== "none" && (
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_ACTION_COLORS[action] || STATUS_ACTION_COLORS.none}`}>
                  {STATUS_ACTION_LABELS[action] || action}
                </span>
              )}
              {subCount > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${scheme.catCountBadge}`}>
                  {subCount}<ChevronRight className="h-2.5 w-2.5" />
                </span>
              )}
              {status.isFinal && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300">FINAL</span>}
              {status.isConversion && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/60 dark:text-green-300">KONV</span>}
            </div>
          </div>
          {subCount > 0 && (
            <ChevronRight className={`h-4 w-4 shrink-0 mt-1 ${scheme.tileIconColor} opacity-50 group-hover:opacity-100 transition-opacity`} />
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
    const scheme = getScheme(cat?.color);
    const CatIcon = cat ? resolveIcon(cat.icon) : null;
    const gridCols = prefs.displayMode === "compact" ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3";

    return (
      <div
        key={catId}
        className={`rounded-xl border-2 ${scheme.catBorder} overflow-hidden transition-all duration-200 shadow-sm`}
        data-testid={`pulse-cat-${catId}`}
      >
        <button
          type="button"
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 border-l-4 ${scheme.catLeftBorder} ${scheme.catBg} ${scheme.catHover}`}
          onClick={() => toggle(catId)}
          data-testid={`pulse-cat-toggle-${catId}`}
        >
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${scheme.catIconBg}`}>
            {CatIcon
              ? <CatIcon className={`h-5 w-5 ${scheme.catIconColor}`} />
              : <FolderOpen className={`h-5 w-5 ${scheme.catIconColor}`} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-sm ${scheme.catText}`}>{cat?.name || "Bez kategórie"}</div>
            <div className="text-xs text-muted-foreground">
              {statusList.length} {statusList.length === 1 ? "status" : "statusov"}
            </div>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${scheme.catCountBadge} shrink-0`}>
            {statusList.length}
          </span>
          {isExpanded
            ? <ChevronUp className={`h-4 w-4 shrink-0 ${scheme.catIconColor}`} />
            : <ChevronDown className={`h-4 w-4 shrink-0 ${scheme.catIconColor}`} />
          }
        </button>
        {isExpanded && (
          <div className="p-3 bg-background/80 dark:bg-background/40 border-t border-border/60">
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
                      <AlignJustify className="h-3.5 w-3.5" /> Kompaktné
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
