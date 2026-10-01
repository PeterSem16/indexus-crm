import { CalendarDays, FilterX, ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DateRange, TaskDateBasis, TaskDatePreset, TaskSortField } from "@/lib/task-query-controls";

type Person = { id: string; fullName?: string; username?: string };
type Props = {
  t: any;
  search: string; onSearch: (value: string) => void;
  datePreset: TaskDatePreset; onDatePreset: (value: TaskDatePreset) => void;
  dateBasis: TaskDateBasis; onDateBasis: (value: TaskDateBasis) => void;
  range: DateRange; onRange: (value: DateRange) => void;
  sortField: TaskSortField; onSortField: (value: TaskSortField) => void;
  sortDirection: "asc" | "desc"; onSortDirection: (value: "asc" | "desc") => void;
  creator: string; onCreator: (value: string) => void;
  resolver: string; onResolver: (value: string) => void;
  people: Person[];
  onClear: () => void;
};

export function TaskQueueControls(props: Props) {
  const { t } = props;
  const copy = t.tasks.workspace;
  const dateBasisLabel = (value: TaskDateBasis) => value === "created" ? copy.basisCreated : value === "due" ? copy.basisDue : copy.basisResolved;
  const sortLabel = (value: TaskSortField) => value === "created" ? copy.sortCreated : value === "due" ? copy.sortDue : value === "resolved" ? copy.sortResolved : value === "priority" ? copy.sortPriority : copy.sortTitle;
  const personLabel = (person: Person) => person.fullName || person.username || person.id;
  const hasFilters = props.search || props.datePreset !== "all" || props.creator || props.resolver || props.sortField !== "created" || props.sortDirection !== "desc";
  return (
    <section className="task-queue-controls" aria-label={copy.filtersTitle}>
      <label className="nexus-signal-queue-search">
        <span className="sr-only">{copy.searchPeoplePlaceholder}</span>
        <Input value={props.search} onChange={event => props.onSearch(event.target.value)} placeholder={copy.searchPeoplePlaceholder} aria-label={copy.searchPeoplePlaceholder} data-testid="task-queue-search" />
      </label>
      <div className="task-filter-grid">
        <Select value={props.datePreset} onValueChange={(value: TaskDatePreset) => props.onDatePreset(value)}>
          <SelectTrigger data-testid="task-date-filter"><CalendarDays /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{copy.dateAll}</SelectItem><SelectItem value="today">{copy.dateToday}</SelectItem><SelectItem value="week">{copy.dateWeek}</SelectItem><SelectItem value="month">{copy.dateMonth}</SelectItem><SelectItem value="custom">{copy.dateCustom}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={props.dateBasis} onValueChange={(value: TaskDateBasis) => props.onDateBasis(value)}>
          <SelectTrigger data-testid="task-date-basis"><SelectValue /></SelectTrigger>
          <SelectContent>{(["created", "due", "resolved"] as TaskDateBasis[]).map(value => <SelectItem key={value} value={value}>{dateBasisLabel(value)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={props.sortField} onValueChange={(value: TaskSortField) => props.onSortField(value)}>
          <SelectTrigger data-testid="task-sort-field"><SelectValue /></SelectTrigger>
          <SelectContent>{(["created", "due", "resolved", "priority", "title"] as TaskSortField[]).map(value => <SelectItem key={value} value={value}>{sortLabel(value)}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" variant="outline" className="task-sort-direction" onClick={() => props.onSortDirection(props.sortDirection === "asc" ? "desc" : "asc")} aria-label={props.sortDirection === "asc" ? copy.ascending : copy.descending} title={props.sortDirection === "asc" ? copy.descending : copy.ascending} data-testid="task-sort-direction">
          {props.sortDirection === "asc" ? <ArrowUpAZ /> : <ArrowDownAZ />} {props.sortDirection === "asc" ? copy.ascending : copy.descending}
        </Button>
        <Select value={props.creator || "any"} onValueChange={value => props.onCreator(value === "any" ? "" : value)}>
          <SelectTrigger aria-label={t.tasks.createdBy} data-testid="task-creator-filter"><SelectValue placeholder={copy.anyCreator} /></SelectTrigger>
          <SelectContent><SelectItem value="any">{copy.anyCreator}</SelectItem>{props.people.map(person => <SelectItem key={person.id} value={person.id}>{personLabel(person)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={props.resolver || "any"} onValueChange={value => props.onResolver(value === "any" ? "" : value)}>
          <SelectTrigger aria-label={t.tasks.resolvedBy} data-testid="task-resolver-filter"><SelectValue placeholder={copy.anyResolver} /></SelectTrigger>
          <SelectContent><SelectItem value="any">{copy.anyResolver}</SelectItem>{props.people.map(person => <SelectItem key={person.id} value={person.id}>{personLabel(person)}</SelectItem>)}</SelectContent>
        </Select>
        {props.datePreset === "custom" && <div className="task-custom-range"><Input type="date" aria-label={copy.dateFrom} value={props.range.from} onChange={event => props.onRange({ ...props.range, from: event.target.value })} data-testid="task-date-from" /><span>{copy.rangeSeparator}</span><Input type="date" aria-label={copy.dateTo} value={props.range.to} onChange={event => props.onRange({ ...props.range, to: event.target.value })} data-testid="task-date-to" /></div>}
        {hasFilters && <Button type="button" variant="ghost" className="task-clear-filters" onClick={props.onClear} data-testid="task-clear-filters"><FilterX /> {copy.clearFilters}</Button>}
      </div>
    </section>
  );
}