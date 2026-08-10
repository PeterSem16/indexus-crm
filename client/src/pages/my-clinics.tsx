// ─────────────────────────────────────────────────────────────────────────────
// My Healthcare Network — field-agent dashboard pre reprezentanta
// Moderný card-grid s farebným status systémom, stats, skupinovaním
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, Building2, Hospital, MapPin, Phone, CalendarDays,
  Stethoscope, Search, LayoutGrid, LayoutList, ChevronRight,
  TrendingUp, CheckCircle2, Clock, XCircle, HelpCircle,
  Star, Activity, HeartPulse,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/i18n/I18nProvider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

// ── Interfaces ──────────────────────────────────────────────────────────────
interface RepClinic {
  id: string;
  name: string;
  doctorName: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  countryCode: string | null;
  phone: string | null;
  contractStatus: string | null;
  interestCooperation: string | null;
  isActive: boolean | null;
  assignedSince: string | null;
}

interface RepHospital {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  region: string | null;
  countryCode: string | null;
  phone: string | null;
  isActive: boolean | null;
  assignedSince: string | null;
}

// ── Status config ────────────────────────────────────────────────────────────
const CONTRACT_STATUS_CONFIG: Record<string, {
  label: string; bg: string; text: string; border: string; dot: string; icon: React.ElementType;
}> = {
  "active": {
    label: "Aktívny",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-l-emerald-400",
    dot: "bg-emerald-400",
    icon: CheckCircle2,
  },
  "active contract": {
    label: "Aktívna zmluva",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-l-emerald-400",
    dot: "bg-emerald-400",
    icon: CheckCircle2,
  },
  "interested": {
    label: "Záujem",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-l-amber-400",
    dot: "bg-amber-400",
    icon: Star,
  },
  "not contacted": {
    label: "Nekontaktovaný",
    bg: "bg-slate-50 dark:bg-slate-800/30",
    text: "text-slate-500 dark:text-slate-400",
    border: "border-l-slate-300 dark:border-l-slate-600",
    dot: "bg-slate-400",
    icon: Clock,
  },
  "not interested": {
    label: "Nemá záujem",
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-600 dark:text-red-400",
    border: "border-l-red-300",
    dot: "bg-red-400",
    icon: XCircle,
  },
};

function getStatusCfg(status: string | null) {
  if (!status) return CONTRACT_STATUS_CONFIG["not contacted"];
  const key = status.toLowerCase();
  for (const [k, v] of Object.entries(CONTRACT_STATUS_CONFIG)) {
    if (key.includes(k)) return v;
  }
  return {
    label: status,
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-l-blue-400",
    dot: "bg-blue-400",
    icon: HelpCircle,
  };
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  try { return format(new Date(d), "d. M. yyyy"); } catch { return null; }
}

// ── Clinic card ──────────────────────────────────────────────────────────────
function ClinicCard({ c }: { c: RepClinic }) {
  const cfg = getStatusCfg(c.contractStatus);
  const StatusIcon = cfg.icon;
  const dateStr = fmtDate(c.assignedSince);

  return (
    <div className={`
      relative flex flex-col rounded-xl border border-l-4 ${cfg.border}
      bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 overflow-hidden
    `}>
      {/* Status dot + type */}
      <div className="flex items-start justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 shrink-0">
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
              Klinika
            </div>
            <div className="text-sm font-semibold leading-snug line-clamp-1">{c.name}</div>
          </div>
        </div>
        <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text} shrink-0 ml-2`}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </div>
      </div>

      {/* Doctor */}
      {c.doctorName && (
        <div className="flex items-center gap-1.5 px-4 pb-1">
          <Stethoscope className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{c.doctorName}</span>
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 border-t my-2" />

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-4 pb-3 text-xs text-muted-foreground">
        {c.city && (
          <div className="flex items-center gap-1 col-span-2">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{c.city}{c.district ? `, ${c.district}` : ""}</span>
          </div>
        )}
        {c.phone && (
          <a
            href={`tel:${c.phone}`}
            className="flex items-center gap-1 hover:text-primary transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{c.phone}</span>
          </a>
        )}
        {dateStr && (
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>{dateStr}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hospital card ────────────────────────────────────────────────────────────
function HospitalCard({ h }: { h: RepHospital }) {
  const dateStr = fmtDate(h.assignedSince);
  return (
    <div className="
      relative flex flex-col rounded-xl border border-l-4 border-l-violet-400
      bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-150
    ">
      <div className="flex items-start justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40 shrink-0">
            <Hospital className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
              Nemocnica
            </div>
            <div className="text-sm font-semibold leading-snug line-clamp-1">{h.name}</div>
          </div>
        </div>
        <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ml-2 ${
          h.isActive
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        }`}>
          <Activity className="h-3 w-3" />
          {h.isActive ? "Aktívna" : "Neaktívna"}
        </div>
      </div>

      <div className="mx-4 border-t my-2" />

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-4 pb-3 text-xs text-muted-foreground">
        {h.city && (
          <div className="flex items-center gap-1 col-span-2">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{h.city}{h.district ? `, ${h.district}` : ""}</span>
          </div>
        )}
        {h.phone && (
          <a
            href={`tel:${h.phone}`}
            className="flex items-center gap-1 hover:text-primary transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{h.phone}</span>
          </a>
        )}
        {dateStr && (
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>{dateStr}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Row view (compact list alternative) ─────────────────────────────────────
function ClinicRow({ c }: { c: RepClinic }) {
  const cfg = getStatusCfg(c.contractStatus);
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-l-4 ${cfg.border} bg-card hover:bg-muted/40 transition-colors`}>
      <div className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{c.name}</span>
        {c.doctorName && <span className="text-xs text-muted-foreground ml-2">{c.doctorName}</span>}
      </div>
      {c.city && (
        <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-0.5">
          <MapPin className="h-3 w-3" />{c.city}
        </span>
      )}
      {c.phone && (
        <a href={`tel:${c.phone}`} className="text-xs text-muted-foreground hover:text-primary hidden md:block">
          {c.phone}
        </a>
      )}
      <div className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.text} shrink-0`}>
        {cfg.label}
      </div>
    </div>
  );
}

function HospitalRow({ h }: { h: RepHospital }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-l-4 border-l-violet-400 bg-card hover:bg-muted/40 transition-colors">
      <div className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />
      <Hospital className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{h.name}</span>
      </div>
      {h.city && (
        <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-0.5">
          <MapPin className="h-3 w-3" />{h.city}
        </span>
      )}
      {h.phone && (
        <a href={`tel:${h.phone}`} className="text-xs text-muted-foreground hover:text-primary hidden md:block">
          {h.phone}
        </a>
      )}
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  value, label, icon: Icon, color,
}: {
  value: number; label: string; icon: React.ElementType;
  color: "blue" | "emerald" | "amber" | "violet" | "slate";
}) {
  const colorMap = {
    blue:    { bg: "bg-blue-100 dark:bg-blue-900/40",    text: "text-blue-600 dark:text-blue-300",    val: "text-blue-700 dark:text-blue-200" },
    emerald: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-600 dark:text-emerald-300", val: "text-emerald-700 dark:text-emerald-200" },
    amber:   { bg: "bg-amber-100 dark:bg-amber-900/40",  text: "text-amber-600 dark:text-amber-300",  val: "text-amber-700 dark:text-amber-200" },
    violet:  { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-600 dark:text-violet-300", val: "text-violet-700 dark:text-violet-200" },
    slate:   { bg: "bg-slate-100 dark:bg-slate-800",     text: "text-slate-500 dark:text-slate-400",  val: "text-slate-700 dark:text-slate-300" },
  };
  const c = colorMap[color];
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${c.bg}`}>
        <Icon className={`h-4.5 w-4.5 h-[18px] w-[18px] ${c.text}`} />
      </div>
      <div>
        <div className={`text-xl font-bold leading-none ${c.val}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function MyClinicsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const p = t.representantPanel;

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"clinics" | "hospitals">("clinics");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [groupByDistrict, setGroupByDistrict] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: clinicsData, isLoading: clinicsLoading } = useQuery<{ clinics: RepClinic[]; total: number }>({
    queryKey: ["/api/representatives", user?.id, "clinics"],
    queryFn: async () => {
      const res = await fetch(`/api/representatives/${user!.id}/clinics?limit=500`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: hospitalsData, isLoading: hospitalsLoading } = useQuery<{ hospitals: RepHospital[]; total: number }>({
    queryKey: ["/api/representatives", user?.id, "hospitals"],
    queryFn: async () => {
      const res = await fetch(`/api/representatives/${user!.id}/hospitals?limit=500`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const allClinics = clinicsData?.clinics ?? [];
  const allHospitals = hospitalsData?.hospitals ?? [];

  // ── Filtering ──────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filteredClinics = useMemo(() =>
    allClinics.filter(c =>
      !q || c.name.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.district?.toLowerCase().includes(q) ||
      c.doctorName?.toLowerCase().includes(q)
    ),
  [allClinics, q]);

  const filteredHospitals = useMemo(() =>
    allHospitals.filter(h =>
      !q || h.name.toLowerCase().includes(q) ||
      h.city?.toLowerCase().includes(q) ||
      h.district?.toLowerCase().includes(q)
    ),
  [allHospitals, q]);

  // ── Stats ──────────────────────────────────────────────────────────────
  const clinicStats = useMemo(() => {
    const active = allClinics.filter(c => {
      const s = (c.contractStatus ?? "").toLowerCase();
      return s.includes("active");
    }).length;
    const interested = allClinics.filter(c => {
      const s = (c.contractStatus ?? "").toLowerCase();
      return s.includes("interest");
    }).length;
    const notContacted = allClinics.filter(c => !c.contractStatus || c.contractStatus.toLowerCase().includes("not contact")).length;
    return { active, interested, notContacted };
  }, [allClinics]);

  // ── Grouping ───────────────────────────────────────────────────────────
  const clinicsByDistrict = useMemo(() => {
    const map = new Map<string, RepClinic[]>();
    for (const c of filteredClinics) {
      const key = c.district || c.region || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredClinics]);

  const hospitalsByDistrict = useMemo(() => {
    const map = new Map<string, RepHospital[]>();
    for (const h of filteredHospitals) {
      const key = h.district || h.region || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredHospitals]);

  const isLoading = clinicsLoading || hospitalsLoading;
  const isEmpty = allClinics.length === 0 && allHospitals.length === 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-0">

      {/* ── Gradient header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-blue-50/60 to-violet-50/40 dark:from-primary/20 dark:via-blue-950/20 dark:to-violet-950/10 border mb-4 p-5">
        {/* bg decoration */}
        <div className="pointer-events-none absolute right-4 top-2 opacity-5">
          <HeartPulse className="h-32 w-32 text-primary" />
        </div>
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
                <HeartPulse className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">{p.myClinicsTitle}</h1>
            </div>
            <p className="text-sm text-muted-foreground pl-11">{p.myClinicsDesc}</p>
          </div>

          {/* Quick stats */}
          {!isLoading && !isEmpty && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 rounded-lg bg-white/70 dark:bg-black/30 border px-3 py-1.5 text-sm">
                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                <strong>{allClinics.length}</strong>
                <span className="text-muted-foreground">kliník</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-white/70 dark:bg-black/30 border px-3 py-1.5 text-sm">
                <Hospital className="h-3.5 w-3.5 text-violet-500" />
                <strong>{allHospitals.length}</strong>
                <span className="text-muted-foreground">nemocníc</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-white/70 dark:bg-black/30 border px-3 py-1.5 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <strong>{clinicStats.active}</strong>
                <span className="text-muted-foreground">aktívnych</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t.common.loading}</span>
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────────────────────── */}
      {!isLoading && isEmpty && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <HeartPulse className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
          <div>
            <p className="font-medium text-foreground">{p.myClinicsEmpty}</p>
            <p className="text-sm text-muted-foreground mt-1">Žiadne kliniky ani nemocnice nie sú priradené k vášmu účtu.</p>
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {!isLoading && !isEmpty && (
        <div className="flex-1 overflow-auto">

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard value={allClinics.length} label="Kliník celkom" icon={Building2} color="blue" />
            <StatCard value={clinicStats.active} label="Aktívnych zmlúv" icon={CheckCircle2} color="emerald" />
            <StatCard value={clinicStats.interested} label="Záujem" icon={Star} color="amber" />
            <StatCard value={allHospitals.length} label="Nemocníc" icon={Hospital} color="violet" />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-0 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Hľadať kliniku, mesto, doktora…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Tab */}
            <div className="flex rounded-lg border bg-muted/40 p-0.5 gap-0.5">
              <button
                onClick={() => setTab("clinics")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  tab === "clinics"
                    ? "bg-white dark:bg-card shadow-sm text-blue-700 dark:text-blue-300"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                <Building2 className="h-3.5 w-3.5" />
                Kliniky
                <span className={`text-[10px] rounded-full px-1.5 py-0 font-semibold ${
                  tab === "clinics" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "bg-muted text-muted-foreground"
                }`}>{filteredClinics.length}</span>
              </button>
              <button
                onClick={() => setTab("hospitals")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  tab === "hospitals"
                    ? "bg-white dark:bg-card shadow-sm text-violet-700 dark:text-violet-300"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                <Hospital className="h-3.5 w-3.5" />
                Nemocnice
                <span className={`text-[10px] rounded-full px-1.5 py-0 font-semibold ${
                  tab === "hospitals" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300" : "bg-muted text-muted-foreground"
                }`}>{filteredHospitals.length}</span>
              </button>
            </div>

            {/* View + Group */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setGroupByDistrict(g => !g)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  groupByDistrict
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-input"
                }`}>
                <MapPin className="h-3 w-3" />
                Po okr.
              </button>
              <div className="flex rounded-md border bg-background overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  <LayoutList className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ── CLINICS ──────────────────────────────────────────────────── */}
          {tab === "clinics" && (
            <>
              {filteredClinics.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                  <Building2 className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Žiadne kliniky nevyhovujú filtru</p>
                </div>
              ) : groupByDistrict ? (
                <div className="space-y-5">
                  {clinicsByDistrict.map(([district, clinics]) => (
                    <div key={district}>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold">{district}</span>
                        <span className="text-xs text-muted-foreground">({clinics.length})</span>
                        <div className="flex-1 border-t ml-1" />
                      </div>
                      {viewMode === "grid" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {clinics.map(c => <ClinicCard key={c.id} c={c} />)}
                        </div>
                      ) : (
                        <div className="rounded-xl border overflow-hidden divide-y">
                          {clinics.map(c => <ClinicRow key={c.id} c={c} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredClinics.map(c => <ClinicCard key={c.id} c={c} />)}
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden divide-y">
                  {filteredClinics.map(c => <ClinicRow key={c.id} c={c} />)}
                </div>
              )}
            </>
          )}

          {/* ── HOSPITALS ────────────────────────────────────────────────── */}
          {tab === "hospitals" && (
            <>
              {filteredHospitals.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                  <Hospital className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Žiadne nemocnice nevyhovujú filtru</p>
                </div>
              ) : groupByDistrict ? (
                <div className="space-y-5">
                  {hospitalsByDistrict.map(([district, hospitals]) => (
                    <div key={district}>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold">{district}</span>
                        <span className="text-xs text-muted-foreground">({hospitals.length})</span>
                        <div className="flex-1 border-t ml-1" />
                      </div>
                      {viewMode === "grid" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {hospitals.map(h => <HospitalCard key={h.id} h={h} />)}
                        </div>
                      ) : (
                        <div className="rounded-xl border overflow-hidden divide-y">
                          {hospitals.map(h => <HospitalRow key={h.id} h={h} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredHospitals.map(h => <HospitalCard key={h.id} h={h} />)}
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden divide-y">
                  {filteredHospitals.map(h => <HospitalRow key={h.id} h={h} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
