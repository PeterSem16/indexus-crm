import { useState } from "react";
import {
  Search,
  Plus,
  X,
  ChevronDown,
  Filter as FilterIcon,
  ArrowUpDown,
  Bookmark,
  MapPin,
  User,
  Stethoscope,
  Activity,
  FileSignature,
  Check,
  MoreHorizontal,
  Star,
  Mail,
  Phone,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

type Chip = { field: string; label: string; values: string[]; icon: any };

const FIELDS = [
  { key: "country", label: "Krajina", icon: MapPin, options: ["Slovensko", "Česko", "Maďarsko", "Poľsko", "Rakúsko"] },
  { key: "type", label: "Typ kontaktu", icon: User, options: ["Lekár", "Sestra", "Manažér", "Asistent", "Ostatní"] },
  { key: "specialty", label: "Špecializácia", icon: Stethoscope, options: ["Kardiológia", "Onkológia", "Pediatria", "Chirurgia", "Interné"] },
  { key: "status", label: "Status", icon: Activity, options: ["Aktívny", "Neaktívny", "Pozastavený"] },
  { key: "agreement", label: "Zmluva", icon: FileSignature, options: ["Platná", "Vypršaná", "Bez zmluvy", "Pred podpisom"] },
];

const SAMPLE_ROWS = [
  { id: 1, name: "MUDr. Jana Horváthová", role: "Lekár · Kardiológia", clinic: "Univerzitná nemocnica BA", country: "SK", status: "active", agreement: "valid", email: "j.horvathova@unb.sk" },
  { id: 2, name: "Bc. Peter Novák", role: "Sestra · Onkológia", clinic: "FN Nitra", country: "SK", status: "active", agreement: "valid", email: "p.novak@fnitra.sk" },
  { id: 3, name: "MUDr. Tomáš Varga", role: "Lekár · Pediatria", clinic: "Detská FN Košice", country: "SK", status: "active", agreement: "expired", email: "t.varga@dfnke.sk" },
  { id: 4, name: "Mgr. Eva Krátka", role: "Manažér", clinic: "INEKO Trnava", country: "SK", status: "inactive", agreement: "none", email: "e.kratka@ineko.sk" },
  { id: 5, name: "MUDr. Ján Polák", role: "Lekár · Chirurgia", clinic: "Nem. Levice", country: "SK", status: "active", agreement: "valid", email: "j.polak@nlv.sk" },
  { id: 6, name: "MUDr. Anna Dvořáková", role: "Lekár · Onkológia", clinic: "Masarykův Onko Brno", country: "CZ", status: "active", agreement: "pending", email: "a.dvorakova@mou.cz" },
];

function FieldPopover({
  field,
  selected,
  onChange,
}: {
  field: (typeof FIELDS)[number];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const Icon = field.icon;
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-dashed text-xs font-normal text-slate-600"
        >
          <Icon className="h-3.5 w-3.5" />
          {field.label}
          {selected.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge variant="secondary" className="h-5 rounded-sm px-1 font-normal">
                {selected.length}
              </Badge>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="border-b p-2">
          <Input placeholder={`Hľadaj ${field.label.toLowerCase()}…`} className="h-8 text-xs" />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {field.options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-100"
              >
                <div className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
                  {checked && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-slate-700">{opt}</span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <>
            <Separator />
            <button
              onClick={() => onChange([])}
              className="w-full p-2 text-center text-xs text-slate-500 hover:bg-slate-50"
            >
              Vyčistiť výber
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ChipFilter() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({
    country: ["Slovensko"],
    type: ["Lekár", "Sestra"],
    status: ["Aktívny"],
  });

  const activeChips: Chip[] = FIELDS
    .filter((f) => filters[f.key]?.length)
    .map((f) => ({
      field: f.key,
      label: f.label,
      values: filters[f.key],
      icon: f.icon,
    }));

  const totalCount = 1221;
  const visibleCount = 234;

  const removeChip = (field: string) => setFilters((f) => ({ ...f, [field]: [] }));
  const clearAll = () => setFilters({});

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans antialiased">
      <div className="mx-auto max-w-[1040px]">
        {/* Page header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Osoby</h1>
            <p className="mt-0.5 text-sm text-slate-500">Lekári, sestry, manažéri a kontakty</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Export
            </Button>
            <Button size="sm" className="h-8 bg-slate-900 text-xs hover:bg-slate-800">
              <Plus className="mr-1 h-3.5 w-3.5" /> Nová osoba
            </Button>
          </div>
        </div>

        {/* Saved views (tabs) */}
        <div className="mb-3 flex items-center gap-1 border-b border-slate-200">
          {[
            { name: "Všetci", count: 1221, active: false },
            { name: "Moji aktívni lekári", count: 234, active: true, pinned: true },
            { name: "Vypršané zmluvy", count: 47, active: false, pinned: true },
            { name: "Nové z webu", count: 18, active: false, pinned: true },
          ].map((v) => (
            <button
              key={v.name}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                v.active
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {v.pinned && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
              {v.name}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                {v.count.toLocaleString("sk-SK")}
              </span>
            </button>
          ))}
          <button className="ml-1 flex items-center gap-1 px-2 py-2 text-xs text-slate-400 hover:text-slate-600">
            <Plus className="h-3 w-3" /> Pohľad
          </button>
        </div>

        {/* Filter row */}
        <div className="rounded-t-lg border border-b-0 border-slate-200 bg-white px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Vyhľadaj meno, email, telefón, kliniku…"
                className="h-8 border-slate-200 pl-8 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal text-slate-600">
              <ArrowUpDown className="h-3.5 w-3.5" /> Zoradiť
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal text-slate-600">
              <Bookmark className="h-3.5 w-3.5" /> Uložiť pohľad
            </Button>
          </div>

          {/* Active filter chips + add */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <div
                  key={chip.field}
                  className="group flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-slate-50 pl-2 pr-1 text-xs"
                >
                  <Icon className="h-3 w-3 text-slate-500" />
                  <span className="text-slate-500">{chip.label}</span>
                  <span className="text-slate-300">je</span>
                  <span className="font-medium text-slate-700">
                    {chip.values.length === 1 ? chip.values[0] : `${chip.values.length} hodnoty`}
                  </span>
                  <button
                    onClick={() => removeChip(chip.field)}
                    className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {FIELDS.filter((f) => !filters[f.key]?.length).map((f) => (
              <FieldPopover
                key={f.key}
                field={f}
                selected={filters[f.key] || []}
                onChange={(vals) => setFilters((s) => ({ ...s, [f.key]: vals }))}
              />
            ))}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-slate-500">
                  <Plus className="h-3.5 w-3.5" /> Pridať filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="start">
                {[
                  "Mesto", "Región", "Zdroj kontaktu", "Kategória partnera",
                  "Tagy", "Posledná aktivita", "Vytvorené", "Má telefón",
                ].map((extra) => (
                  <button
                    key={extra}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                  >
                    <FilterIcon className="h-3 w-3 text-slate-400" />
                    {extra}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {activeChips.length > 0 && (
              <button
                onClick={clearAll}
                className="ml-auto flex h-7 items-center gap-1 rounded px-2 text-xs text-slate-500 hover:bg-slate-100"
              >
                Vyčistiť všetko
              </button>
            )}
          </div>
        </div>

        {/* Result count bar */}
        <div className="flex items-center justify-between border border-b-0 border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
          <div>
            Zobrazujem{" "}
            <span className="font-semibold text-slate-900">
              {visibleCount.toLocaleString("sk-SK")}
            </span>{" "}
            z{" "}
            <span className="font-medium text-slate-700">
              {totalCount.toLocaleString("sk-SK")}
            </span>{" "}
            osôb · zoradené podľa <span className="font-medium">Naposledy upravené</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" /> 198 aktívnych
            </span>
            <span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" /> 28 bez zmluvy
            </span>
            <span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500 align-middle" /> 8 vypršané
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-b-lg border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Meno</th>
                <th className="px-3 py-2 text-left font-medium">Klinika</th>
                <th className="px-3 py-2 text-left font-medium">Kontakt</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Zmluva</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-slate-200 text-[10px] text-slate-600">
                          {row.name.split(" ").map((n) => n[0]).slice(-2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-slate-900">{row.name}</div>
                        <div className="text-[11px] text-slate-500">{row.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{row.clinic}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Mail className="h-3 w-3" /> {row.email}
                    </div>
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
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                        Platná
                      </Badge>
                    )}
                    {row.agreement === "expired" && (
                      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">
                        Vypršaná
                      </Badge>
                    )}
                    {row.agreement === "pending" && (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                        Pred podpisom
                      </Badge>
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

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span>Stránka 1 z 10</span>
          <span>50 záznamov na stránku</span>
        </div>
      </div>
    </div>
  );
}
