import { CalendarDays, ChevronDown, Flag, ArrowDown, ArrowUp, Zap, Check, X } from "lucide-react";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

const PRIORITY_STYLES: Record<TaskPriority, { Icon: typeof Flag }> = {
  low: { Icon: ArrowDown },
  medium: { Icon: Flag },
  high: { Icon: ArrowUp },
  urgent: { Icon: Zap },
};

export function TaskPriorityPicker({
  value,
  labels,
  ariaLabel,
  onChange,
}: {
  value: string;
  labels: Record<TaskPriority, string>;
  ariaLabel: string;
  onChange: (value: TaskPriority) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label={ariaLabel}>
      {(Object.keys(PRIORITY_STYLES) as TaskPriority[]).map((priority) => {
        const { Icon } = PRIORITY_STYLES[priority];
        const selected = value === priority;
        return (
          <button
            key={priority}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(priority)}
            data-testid={`btn-task-priority-${priority}`}
            className={`task-priority-choice ${selected ? "is-selected" : ""} ${priority === "urgent" ? "is-urgent" : ""}`}
          >
            <span className="task-priority-icon"><Icon aria-hidden="true" /></span>
            <span>{labels[priority]}</span>
            {selected && <Check className="task-priority-check" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function TaskCreateDatePicker({
  value,
  onChange,
  locale,
  label,
  clearLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  label: string;
  clearLabel: string;
}) {
  const now = new Date();
  const hasDate = Boolean(value);
  const [valueYear, valueMonth, valueDay] = value ? value.split("-").map(Number) : [0, 0, 0];
  const year = valueYear || now.getFullYear();
  const month = valueMonth || now.getMonth() + 1;
  const day = valueDay || now.getDate();
  const years = Array.from(new Set([...Array.from({ length: 6 }, (_, offset) => now.getFullYear() + offset), year])).sort((a, b) => a - b);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthName = (monthNumber: number) => new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "long",
  }).format(new Date(Date.UTC(2024, monthNumber - 1, 1)));
  const prettyDate = value
    ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`))
    : "";
  const update = (nextYear: number, nextMonth: number, nextDay: number) => {
    const maxDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    onChange(`${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(Math.min(nextDay, maxDay)).padStart(2, "0")}`);
  };

  return (
    <div
      className={`task-create-date-control ${hasDate ? "" : "is-empty"}`}
      data-testid="input-create-task-duedate"
      data-value={value}
    >
      <CalendarDays className="task-create-date-icon" aria-hidden="true" />
      <select
        value={hasDate ? day : ""}
        aria-label={`${label}: ${hasDate ? day : "DD"}`}
        data-testid="input-create-task-duedate-day"
        onChange={(event) => update(year, month, Number(event.target.value))}
      >
        {!hasDate && <option value="" disabled>DD</option>}
        {Array.from({ length: days }, (_, index) => index + 1).map((item) => (
          <option key={item} value={item}>{String(item).padStart(2, "0")}</option>
        ))}
      </select>
      <span className="task-date-divider" />
      <select
        value={hasDate ? month : ""}
        aria-label={`${label}: ${hasDate ? monthName(month) : "MM"}`}
        data-testid="input-create-task-duedate-month"
        onChange={(event) => update(year, Number(event.target.value), day)}
      >
        {!hasDate && <option value="" disabled>MM</option>}
        {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
          <option key={item} value={item}>{monthName(item)}</option>
        ))}
      </select>
      <span className="task-date-divider" />
      <select
        value={hasDate ? year : ""}
        aria-label={`${label}: ${hasDate ? year : "YYYY"}`}
        data-testid="input-create-task-duedate-year"
        onChange={(event) => update(Number(event.target.value), month, day)}
      >
        {!hasDate && <option value="" disabled>YYYY</option>}
        {years.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <ChevronDown className="task-create-date-chevron" aria-hidden="true" />
      {value && (
        <button type="button" className="task-date-clear" onClick={() => onChange("")} aria-label={`${label} — ${clearLabel}`}>
          <X aria-hidden="true" />
        </button>
      )}
      <span className="sr-only" aria-live="polite">{prettyDate}</span>
    </div>
  );
}
