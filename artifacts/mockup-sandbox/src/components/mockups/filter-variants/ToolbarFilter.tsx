import { useState } from "react";
import {
  Search,
  Filter as FilterIcon,
  ArrowUpDown,
  Group,
  EyeOff,
  Plus,
  X,
  ChevronDown,
  Trash2,
  GripVertical,
  MapPin,
  User,
  Stethoscope,
  Activity,
  FileSignature,
  Calendar,
  Building2,
  Tag,
  Star,
  Sparkles,
  MoreHorizontal,
  Mail,
  Settings2,
  Save,
  LayoutGrid,
  Rows3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SAMPLE_ROWS = [
  { id: 1, name: "MUDr. Jana Horváthová", role: "Lekár", spec: "Kardiológia", clinic: "UN Bratislava", country: "SK", status: "active", agreement: "valid" },
  { id: 2, name: "Bc. Peter Novák", role: "Sestra", spec: "Onkológia", clinic: "FN Nitra", country: "SK", status: "active", agreement: "valid" },
  { id: 3, name: "MUDr. Tomáš Varga", role: "Lekár", spec: "Pediatria", clinic: "DFN Košice", country: "SK", status: "active", agreement: "expired" },
  { id: 4, name: "MUDr. Anna Dvořáková", role: "Lekár", spec: "Onkológia", clinic: "MOÚ Brno", country: "CZ", status: "active", agreement: "pending" },
  { id: 5, name: "MUDr. Ján Polák", role: "Lekár", spec: "Chirurgia", clinic: "Nem. Levice", country: "SK", status: "active", agreement: "valid" },
];

type FilterRule = {
  id: number;
  conjunction: "and" | "or";
  field: string;
  op: string;
  value: string;
  fieldIcon: any;
};

const FIELD_ICONS: Record<string, any> = {
  "Krajina": MapPin,
  "Typ kontaktu": User,
  "Špecializácia": Stethoscope,
  "Status": Activity,
  "Zmluva": FileSignature,
  "Posledná aktivita": Calendar,
  "Klinika": Building2,
  "Tagy": Tag,
};

export function ToolbarFilter() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [rules, setRules] = useState<FilterRule[]>([
    { id: 1, conjunction: "and", field: "Krajina", op: "je niektorá z", value: "Slovensko, Česko", fieldIcon: MapPin },
    { id: 2, conjunction: "and", field: "Typ kontaktu", op: "je niektorá z", value: "Lekár, Sestra", fieldIcon: User },
    { id: 3, conjunction: "and", field: "Špecializácia", op: "je", value: "Kardiológia", fieldIcon: Stethoscope },
    { id: 4, conjunction: "and", field: "Status", op: "je", value: "Aktívny", fieldIcon: Activity },
  ]);
  const [view, setView] = useState<"table" | "grid">("table");

  const addRule = () => {
    setRules((r) => [
      ...r,
      { id: Date.now(), conjunction: "and", field: "Tagy", op: "obsahuje", value: "", fieldIcon: Tag },
    ]);
  };
  const removeRule = (id: number) => setRules((r) => r.filter((x) => x.id !== id));
  const clearAll = () => setRules([]);

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* Header */}
      <header className="border-b border-slate-200 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-blue-600 text-white">
              <User className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-slate-900">Osoby</h1>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="text-[11px] text-slate-500">
                <span className="font-medium text-slate-700">234</span> z 1 221 osôb · pohľad: Moji aktívni lekári
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500">
              Export
            </Button>
            <Button size="sm" className="h-7 bg-slate-900 text-xs hover:bg-slate-800">
              <Plus className="mr-1 h-3 w-3" /> Pridať osobu
            </Button>
          </div>
        </div>
      </header>

      {/* Toolbar — Airtable style */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/40 px-3 py-1.5">
        {/* View switcher */}
        <div className="flex items-center gap-1 pr-2">
          {[
            { v: "table", icon: Rows3, label: "Tabuľka" },
            { v: "grid", icon: LayoutGrid, label: "Karty" },
          ].map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.v}
                onClick={() => setView(opt.v as any)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                  view === opt.v
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:bg-slate-200/60"
                }`}
              >
                <Icon className="h-3 w-3" /> {opt.label}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-slate-200" />

        {/* Search */}
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Vyhľadaj…"
            className="h-7 border-slate-200 bg-white pl-7 text-xs"
          />
        </div>

        <div className="h-4 w-px bg-slate-200" />

        {/* Toolbar buttons */}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
            drawerOpen || rules.length > 0
              ? "bg-blue-50 text-blue-700"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          <FilterIcon className="h-3 w-3" /> Filter
          {rules.length > 0 && (
            <span className="ml-0.5 rounded-sm bg-blue-600 px-1 py-0 text-[9px] font-medium text-white">
              {rules.length}
            </span>
          )}
        </button>
        <button className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200/60">
          <Group className="h-3 w-3" /> Skupiny
        </button>
        <button className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200/60">
          <ArrowUpDown className="h-3 w-3" /> Zoradenie
          <span className="ml-0.5 rounded-sm bg-slate-200 px-1 py-0 text-[9px] font-medium text-slate-700">2</span>
        </button>
        <button className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200/60">
          <EyeOff className="h-3 w-3" /> Polia
        </button>

        <div className="ml-auto flex items-center gap-1">
          <Select defaultValue="active-doctors">
            <SelectTrigger className="h-7 w-48 border-slate-200 bg-white text-[11px]">
              <Star className="mr-1 h-3 w-3 fill-amber-400 text-amber-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetci</SelectItem>
              <SelectItem value="active-doctors">Moji aktívni lekári</SelectItem>
              <SelectItem value="expired">Vypršané zmluvy</SelectItem>
              <SelectItem value="new-web">Nové z webu</SelectItem>
            </SelectContent>
          </Select>
          <button className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-200/60">
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Main content */}
        <main className="flex-1 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left font-medium">Meno</th>
                <th className="px-3 py-2 text-left font-medium">Špec.</th>
                <th className="px-3 py-2 text-left font-medium">Klinika</th>
                <th className="px-3 py-2 text-left font-medium">Krajina</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Zmluva</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
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
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 font-mono text-[10px] text-slate-600">
                      {row.country}
                    </Badge>
                  </td>
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
        </main>

        {/* Drawer (right side) */}
        {drawerOpen && (
          <aside className="w-[340px] shrink-0 border-l border-slate-200 bg-slate-50/40">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
              <div className="flex items-center gap-2">
                <FilterIcon className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-slate-900">Filter pravidlá</span>
                <Badge className="h-4 rounded-sm bg-blue-600 px-1 text-[10px] hover:bg-blue-600">
                  {rules.length}
                </Badge>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="px-4 py-3">
              <p className="mb-2 text-[11px] text-slate-500">
                Zobrazujem osoby kde <span className="font-medium text-slate-700">VŠETKY</span> z nasledujúcich podmienok platia:
              </p>

              <div className="space-y-1.5">
                {rules.map((rule, idx) => {
                  const Icon = rule.fieldIcon;
                  return (
                    <div
                      key={rule.id}
                      className="group rounded border border-slate-200 bg-white p-2"
                    >
                      <div className="flex items-center gap-1">
                        <button className="flex h-5 w-5 cursor-grab items-center justify-center text-slate-300 opacity-0 group-hover:opacity-100">
                          <GripVertical className="h-3 w-3" />
                        </button>
                        {idx === 0 ? (
                          <span className="w-12 text-[10px] font-medium uppercase text-slate-400">Kde</span>
                        ) : (
                          <Select defaultValue={rule.conjunction}>
                            <SelectTrigger className="h-6 w-12 border-slate-200 text-[10px] uppercase">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="and">A</SelectItem>
                              <SelectItem value="or">ALEBO</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <button
                          onClick={() => removeRule(rule.id)}
                          className="ml-auto flex h-5 w-5 items-center justify-center rounded text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1">
                        <Select defaultValue={rule.field}>
                          <SelectTrigger className="h-7 flex-1 border-slate-200 text-[11px]">
                            <Icon className="mr-1 h-3 w-3 text-slate-500" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(FIELD_ICONS).map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <Select defaultValue={rule.op}>
                          <SelectTrigger className="h-7 w-32 border-slate-200 text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="je">je</SelectItem>
                            <SelectItem value="je niektorá z">je niektorá z</SelectItem>
                            <SelectItem value="nie je">nie je</SelectItem>
                            <SelectItem value="obsahuje">obsahuje</SelectItem>
                            <SelectItem value="je prázdne">je prázdne</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          defaultValue={rule.value}
                          placeholder="hodnota…"
                          className="h-7 flex-1 border-slate-200 text-[11px]"
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center gap-1 pt-1">
                  <button
                    onClick={addRule}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="h-3 w-3" /> Pridať podmienku
                  </button>
                  <button
                    onClick={addRule}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                  >
                    <Plus className="h-3 w-3" /> Pridať skupinu
                  </button>
                  {rules.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="ml-auto rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                    >
                      Vyčistiť
                    </button>
                  )}
                </div>
              </div>

              {/* Quick presets */}
              <div className="mt-5">
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Rýchle filtre
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { l: "Aktívni lekári SK", c: 854 },
                    { l: "Vypršané zmluvy", c: 47 },
                    { l: "Bez zmluvy", c: 312 },
                    { l: "VIP partneri", c: 28 },
                    { l: "Nové z webu", c: 18 },
                  ].map((p) => (
                    <button
                      key={p.l}
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {p.l}
                      <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">
                        {p.c}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Save view CTA */}
              <div className="mt-5 rounded-md border border-dashed border-blue-200 bg-blue-50/50 p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-[11px] font-medium text-slate-900">
                      Použiť tieto filtre často?
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-600">
                      Ulož aktuálnu kombináciu ako pohľad a pristupuj k nej jedným klikom.
                    </p>
                    <Button size="sm" variant="outline" className="mt-2 h-6 gap-1 border-blue-200 bg-white text-[10px] text-blue-700 hover:bg-blue-50">
                      <Save className="h-3 w-3" /> Uložiť ako pohľad
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
