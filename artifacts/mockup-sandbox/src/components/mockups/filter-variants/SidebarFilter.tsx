import { useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  RotateCcw,
  MapPin,
  User,
  Stethoscope,
  Activity,
  FileSignature,
  Tag,
  Calendar,
  Building2,
  Mail,
  Phone,
  Sparkles,
  Star,
  MoreHorizontal,
  PanelLeftClose,
  Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";

const SAMPLE_ROWS = [
  { id: 1, name: "MUDr. Jana Horváthová", role: "Lekár", spec: "Kardiológia", clinic: "Univerzitná nemocnica BA", status: "active", agreement: "valid" },
  { id: 2, name: "Bc. Peter Novák", role: "Sestra", spec: "Onkológia", clinic: "FN Nitra", status: "active", agreement: "valid" },
  { id: 3, name: "MUDr. Tomáš Varga", role: "Lekár", spec: "Pediatria", clinic: "Detská FN Košice", status: "active", agreement: "expired" },
  { id: 4, name: "MUDr. Ján Polák", role: "Lekár", spec: "Chirurgia", clinic: "Nem. Levice", status: "active", agreement: "valid" },
  { id: 5, name: "MUDr. Anna Dvořáková", role: "Lekár", spec: "Onkológia", clinic: "Masarykův Onko Brno", status: "active", agreement: "pending" },
  { id: 6, name: "Mgr. Mária Tóthová", role: "Manažér", spec: "—", clinic: "INEKO Trnava", status: "inactive", agreement: "none" },
];

function FilterSection({
  icon: Icon,
  label,
  count,
  defaultOpen = true,
  children,
}: {
  icon: any;
  label: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-700">{label}</span>
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              {count}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function CheckOption({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded px-1.5 py-1 text-xs hover:bg-slate-100"
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
            checked ? "border-blue-600 bg-blue-600" : "border-slate-300"
          }`}
        >
          {checked && (
            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 16 16" fill="none">
              <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="text-slate-700">{label}</span>
      </div>
      <span className="text-[10px] text-slate-400">{count.toLocaleString("sk-SK")}</span>
    </button>
  );
}

export function SidebarFilter() {
  const [country, setCountry] = useState<string[]>(["Slovensko"]);
  const [type, setType] = useState<string[]>(["Lekár", "Sestra"]);
  const [specialty, setSpecialty] = useState<string[]>(["Kardiológia"]);
  const [status, setStatus] = useState<string[]>(["Aktívny"]);
  const [agreement, setAgreement] = useState<string[]>([]);

  const toggle = (arr: string[], setter: (v: string[]) => void, val: string) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const totalActive =
    country.length + type.length + specialty.length + status.length + agreement.length;

  const totalCount = 1221;
  const visibleCount = 234;

  const reset = () => {
    setCountry([]); setType([]); setSpecialty([]); setStatus([]); setAgreement([]);
  };

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-[260px] shrink-0 border-r border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Filtre
              </h2>
              {totalActive > 0 && (
                <Badge className="h-4 rounded-sm bg-blue-600 px-1 text-[10px] hover:bg-blue-600">
                  {totalActive}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={reset}
                disabled={totalActive === 0}
                className="flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-slate-500 hover:bg-slate-200 disabled:opacity-30"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
              <button className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200">
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Saved views */}
          <div className="border-b border-slate-200 px-3 py-2.5">
            <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Uložené pohľady
            </div>
            {[
              { name: "Moji aktívni lekári", count: 234, active: true },
              { name: "Vypršané zmluvy", count: 47 },
              { name: "Nové z webu (7 dní)", count: 18 },
            ].map((v) => (
              <button
                key={v.name}
                className={`mb-0.5 flex w-full items-center justify-between rounded px-2 py-1.5 text-xs ${
                  v.active
                    ? "bg-blue-50 font-medium text-blue-700"
                    : "text-slate-700 hover:bg-slate-200/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Star className={`h-3 w-3 ${v.active ? "fill-blue-600 text-blue-600" : "fill-amber-400 text-amber-400"}`} />
                  {v.name}
                </div>
                <span className="text-[10px] text-slate-400">{v.count}</span>
              </button>
            ))}
            <button className="mt-1 flex w-full items-center gap-1.5 rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-200/60">
              <Plus className="h-3 w-3" /> Uložiť aktuálny pohľad
            </button>
          </div>

          {/* Filter sections */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
            <FilterSection icon={MapPin} label="Krajina" count={country.length}>
              <div className="space-y-0.5">
                {[
                  { l: "Slovensko", c: 854 },
                  { l: "Česko", c: 213 },
                  { l: "Maďarsko", c: 98 },
                  { l: "Poľsko", c: 41 },
                  { l: "Rakúsko", c: 15 },
                ].map((opt) => (
                  <CheckOption
                    key={opt.l}
                    label={opt.l}
                    count={opt.c}
                    checked={country.includes(opt.l)}
                    onToggle={() => toggle(country, setCountry, opt.l)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection icon={User} label="Typ kontaktu" count={type.length}>
              <div className="space-y-0.5">
                {[
                  { l: "Lekár", c: 612 },
                  { l: "Sestra", c: 287 },
                  { l: "Manažér", c: 134 },
                  { l: "Asistent", c: 92 },
                  { l: "Ostatní", c: 96 },
                ].map((opt) => (
                  <CheckOption
                    key={opt.l}
                    label={opt.l}
                    count={opt.c}
                    checked={type.includes(opt.l)}
                    onToggle={() => toggle(type, setType, opt.l)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection icon={Stethoscope} label="Špecializácia" count={specialty.length}>
              <Input placeholder="Hľadaj špecializáciu…" className="mb-2 h-7 text-xs" />
              <div className="space-y-0.5">
                {[
                  { l: "Kardiológia", c: 142 },
                  { l: "Onkológia", c: 98 },
                  { l: "Pediatria", c: 76 },
                  { l: "Chirurgia", c: 121 },
                  { l: "Interné", c: 89 },
                ].map((opt) => (
                  <CheckOption
                    key={opt.l}
                    label={opt.l}
                    count={opt.c}
                    checked={specialty.includes(opt.l)}
                    onToggle={() => toggle(specialty, setSpecialty, opt.l)}
                  />
                ))}
                <button className="mt-1 flex items-center gap-1 px-1.5 py-1 text-[11px] text-blue-600 hover:underline">
                  Zobraziť všetkých 24
                </button>
              </div>
            </FilterSection>

            <FilterSection icon={Activity} label="Status" count={status.length}>
              <div className="space-y-0.5">
                {[
                  { l: "Aktívny", c: 1054 },
                  { l: "Neaktívny", c: 142 },
                  { l: "Pozastavený", c: 25 },
                ].map((opt) => (
                  <CheckOption
                    key={opt.l}
                    label={opt.l}
                    count={opt.c}
                    checked={status.includes(opt.l)}
                    onToggle={() => toggle(status, setStatus, opt.l)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection icon={FileSignature} label="Zmluva" count={agreement.length} defaultOpen={false}>
              <div className="space-y-0.5">
                {[
                  { l: "Platná", c: 798 },
                  { l: "Vypršaná", c: 47 },
                  { l: "Bez zmluvy", c: 312 },
                  { l: "Pred podpisom", c: 64 },
                ].map((opt) => (
                  <CheckOption
                    key={opt.l}
                    label={opt.l}
                    count={opt.c}
                    checked={agreement.includes(opt.l)}
                    onToggle={() => toggle(agreement, setAgreement, opt.l)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection icon={Calendar} label="Posledná aktivita" defaultOpen={false}>
              <div className="px-1">
                <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                  <span>0 dní</span>
                  <span className="font-medium text-slate-700">do 30 dní</span>
                  <span>365+</span>
                </div>
                <Slider defaultValue={[30]} max={365} step={1} className="my-1" />
              </div>
            </FilterSection>

            <FilterSection icon={Tag} label="Tagy" defaultOpen={false}>
              <div className="flex flex-wrap gap-1">
                {["VIP", "Konferencia 2025", "Newsletter", "Platinum"].map((t) => (
                  <button
                    key={t}
                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </FilterSection>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-semibold text-slate-900">Osoby</h1>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 font-normal text-slate-500">
                <Sparkles className="mr-1 h-3 w-3 text-amber-500" /> Moji aktívni lekári
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button size="sm" className="h-7 bg-slate-900 text-xs hover:bg-slate-800">
                <Plus className="mr-1 h-3 w-3" /> Pridať osobu
              </Button>
            </div>
          </header>

          {/* Search & count */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-2.5">
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Vyhľadaj v aktuálnom pohľade…"
                className="h-7 border-slate-200 pl-8 text-xs"
              />
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-900">{visibleCount.toLocaleString("sk-SK")}</span>
              <span className="text-slate-400"> z {totalCount.toLocaleString("sk-SK")} osôb</span>
            </div>
          </div>

          {/* Active filters bar */}
          {totalActive > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50/40 px-5 py-2 text-[11px]">
              <span className="text-slate-500">Aktívne:</span>
              {[
                ...country.map((v) => ({ k: "country", v, lbl: "Krajina" })),
                ...type.map((v) => ({ k: "type", v, lbl: "Typ" })),
                ...specialty.map((v) => ({ k: "spec", v, lbl: "Špec." })),
                ...status.map((v) => ({ k: "status", v, lbl: "Status" })),
                ...agreement.map((v) => ({ k: "agr", v, lbl: "Zmluva" })),
              ].slice(0, 8).map((chip) => (
                <span
                  key={`${chip.k}-${chip.v}`}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700"
                >
                  <span className="text-slate-400">{chip.lbl}:</span> {chip.v}
                  <X className="h-2.5 w-2.5 cursor-pointer text-slate-400 hover:text-slate-700" />
                </span>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2 text-left font-medium">Meno</th>
                  <th className="px-3 py-2 text-left font-medium">Špec.</th>
                  <th className="px-3 py-2 text-left font-medium">Klinika</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Zmluva</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ROWS.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-blue-100 text-[10px] text-blue-700">
                            {row.name.split(" ").map((n) => n[0]).slice(-2).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-slate-900">{row.name}</div>
                          <div className="text-[11px] text-slate-500">{row.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{row.spec}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.clinic}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={
                          row.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-50"
                        }
                      >
                        <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${row.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {row.status === "active" ? "Aktívny" : "Neaktívny"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {row.agreement === "valid" && (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">Platná</Badge>
                      )}
                      {row.agreement === "expired" && (
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">Vypršaná</Badge>
                      )}
                      {row.agreement === "pending" && (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Pred podpisom</Badge>
                      )}
                      {row.agreement === "none" && (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
