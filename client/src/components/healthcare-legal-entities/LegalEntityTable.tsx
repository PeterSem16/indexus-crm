import { useEffect, useMemo, useState } from "react";
import { Building2, Clock3 } from "lucide-react";
import type { LegalEntitySummary } from "@shared/healthcare-legal-entity";
import { EntityFilter, type FilterField, type FilterPreset, type FilterRule } from "@/components/shared/EntityFilter";
import { DataTable, type Column, type SortConfig } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { HealthcareLegalEntityCopy } from "@/i18n/healthcare-legal-entity-translations";
import { formatLegalForm } from "@/lib/healthcare-legal-entity-format";

type Entity = LegalEntitySummary & { legalForm?: string | null; registeredAddress?: string | null };
type Props = {
  items: Entity[];
  c: HealthcareLegalEntityCopy;
  locale: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onOpen: (entity: Entity) => void;
};
const when = (value?: string | null) => value ? new Date(value).getTime() : 0;

export function LegalEntityTable({ items, c, locale, loading, failed, onRetry, onOpen }: Props) {
  const [search, setSearch] = useState("");
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [sort, setSort] = useState<SortConfig | null>({ key: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const fields: FilterField[] = useMemo(() => [
    { key: "name", label: c.companyName, type: "text" },
    { key: "ico", label: c.ico, type: "text" },
    { key: "city", label: c.city, type: "text" },
    { key: "legalForm", label: c.legalForm, type: "text" },
    { key: "status", label: c.status, type: "select", options: [{ value: "active", label: c.active }, { value: "terminated", label: c.terminated }] },
    { key: "facilityCount", label: c.facilities, type: "select", options: [{ value: "linked", label: c.hasLinkedSites }, { value: "none", label: c.noLinkedSites }] },
    { key: "checkedRecently", label: c.checkedPastWeek, type: "select", options: [{ value: "past7days", label: c.checkedPastWeek }] },
  ], [c]);
  const presets: FilterPreset[] = useMemo(() => [
    { id: "active", label: c.activeOnly, rules: [{ id: "preset-active", conjunction: "and", field: "status", op: "is", value: "active" }] },
    { id: "terminated", label: c.terminatedOnly, rules: [{ id: "preset-ended", conjunction: "and", field: "status", op: "is", value: "terminated" }] },
    { id: "linked", label: c.withFacilities, rules: [{ id: "preset-linked", conjunction: "and", field: "facilityCount", op: "is", value: "linked" }] },
    { id: "checked-past-week", label: c.checkedPastWeek, rules: [{ id: "preset-checked-week", conjunction: "and", field: "checkedRecently", op: "is", value: "past7days" }] },
  ], [c]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const ruleMatches = (entity: Entity, rule: FilterRule) => {
      const value = rule.field === "facilityCount" ? ((entity.facilityCount || 0) > 0 ? "linked" : "none")
        : rule.field === "checkedRecently" ? (entity.checkedAt && Date.now() - when(entity.checkedAt) <= 7 * 24 * 60 * 60 * 1000 ? "past7days" : "")
        : rule.field === "legalForm" ? formatLegalForm(entity.legalForm)
        : String((entity as any)[rule.field] ?? "");
      const compare = String(value).toLocaleLowerCase();
      const wanted = Array.isArray(rule.value) ? rule.value : [rule.value];
      switch (rule.op) {
        case "isEmpty": return !compare;
        case "isNotEmpty": return !!compare;
        case "contains": return compare.includes(String(rule.value).toLocaleLowerCase());
        case "isNot": return !wanted.some((v) => compare === String(v).toLocaleLowerCase());
        case "isAny": return wanted.some((v) => compare === String(v).toLocaleLowerCase());
        case "is": return compare === String(wanted[0] ?? "").toLocaleLowerCase();
        default: return false;
      }
    };
    return items.filter((entity) => {
      if (q && !`${entity.name} ${entity.ico} ${entity.city || ""} ${entity.legalForm || ""}`.toLocaleLowerCase().includes(q)) return false;
      if (!rules.length) return true;
      return rules.slice(1).reduce((result, rule, index) => rule.conjunction === "or"
        ? result || ruleMatches(entity, rule)
        : result && ruleMatches(entity, rule), ruleMatches(entity, rules[0]));
    });
  }, [items, search, rules]);
  const columns: Column<Entity>[] = [
    { key: "name", header: c.companyName, sortable: true, sortValue: (e) => e.name, cell: (e) => <div className="flex min-w-48 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></span><div className="min-w-0"><div className="truncate font-medium text-foreground">{e.name}</div><div className="font-mono text-xs text-muted-foreground">{e.ico}</div></div></div> },
    { key: "city", header: c.city, sortable: true, sortValue: (e) => e.city || "", cell: (e) => <span className="text-sm">{e.city || "—"}</span> },
    { key: "legalForm", header: c.legalForm, sortable: true, sortValue: (e) => formatLegalForm(e.legalForm), cell: (e) => <span className="text-sm text-muted-foreground">{formatLegalForm(e.legalForm) || "—"}</span> },
    { key: "status", header: c.status, sortable: true, sortValue: (e) => e.status, cell: (e) => <Badge variant={e.status === "active" ? "secondary" : "outline"}>{e.status === "active" ? c.active : c.terminated}</Badge> },
    { key: "facilities", header: c.facilities, sortable: true, sortValue: (e) => e.facilityCount || 0, cell: (e) => <span className="tabular-nums text-sm">{e.facilityCount || 0}</span> },
    { key: "checkedAt", header: c.checkedAt, sortable: true, sortValue: (e) => when(e.checkedAt), cell: (e) => <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{e.checkedAt ? new Date(e.checkedAt).toLocaleDateString(locale === "sk" ? "sk-SK" : locale) : "—"}</span> },
  ];
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);
  const ordered = [...filtered];
  if (sort?.direction) {
    const valueFor = (entity: Entity) => {
      switch (sort.key) {
        case "city": return entity.city || "";
        case "legalForm": return formatLegalForm(entity.legalForm);
        case "status": return entity.status;
        case "facilities": return entity.facilityCount || 0;
        case "checkedAt": return when(entity.checkedAt);
        default: return entity.name;
      }
    };
    ordered.sort((a, b) => {
      const left = valueFor(a); const right = valueFor(b);
      const result = typeof left === "number" && typeof right === "number"
        ? left - right : String(left).localeCompare(String(right), locale);
      return sort.direction === "desc" ? -result : result;
    });
  }
  const visible = ordered.slice((page - 1) * pageSize, page * pageSize);
  return <Card className="overflow-hidden border-border/80 shadow-sm">
    <CardContent className="p-0">
      <div className="border-b bg-card px-4 py-4 sm:px-5">
        <EntityFilter searchQuery={search} onSearchChange={(value) => { setSearch(value); setPage(1); }} searchPlaceholder={c.search}
          rules={rules} onRulesChange={(value) => { setRules(value); setPage(1); }} fields={fields} presets={presets}
          totalCount={items.length} visibleCount={filtered.length} storageKey="entity-filter:healthcare-legal-entities"
          testId="filter-healthcare-legal-entities" locale={locale} showCountAlways />
      </div>
      {loading ? <div className="space-y-3 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        : failed ? <div className="p-10 text-center"><p className="text-sm text-muted-foreground">{c.loadError}</p><Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>{c.retry}</Button></div>
        : filtered.length === 0 ? <div className="p-12 text-center"><span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span><h3 className="font-medium">{items.length ? c.noResults : c.empty}</h3><p className="mt-1 text-sm text-muted-foreground">{items.length ? "" : c.emptyHint}</p></div>
        : <div className="p-3 sm:p-5"><DataTable columns={columns} data={visible} getRowKey={(e) => e.id} onRowClick={onOpen} sortConfig={sort} onSortChange={setSort} emptyMessage={c.noResults} tableClassName="overflow-x-auto" />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-muted-foreground"><span>{c.showing} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filtered.length)} {c.of} {filtered.length}</span>
            <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{c.previous}</Button><span className="px-2 py-1 tabular-nums">{page} / {pageCount}</span><Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>{c.next}</Button></div>
          </div>
        </div>}
    </CardContent>
  </Card>;
}
