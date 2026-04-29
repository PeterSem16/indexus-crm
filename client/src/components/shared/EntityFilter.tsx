import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter as FilterIcon,
  Plus,
  X,
  ChevronDown,
  Trash2,
  Star,
  Sparkles,
  Save,
  Bookmark,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export type FilterFieldOption = {
  label: string;
  value: string;
  count?: number;
};

export type FilterFieldType = "select" | "multiselect" | "text" | "boolean";

export type FilterField = {
  key: string;
  label: string;
  icon?: LucideIcon;
  type: FilterFieldType;
  options?: FilterFieldOption[];
};

export type FilterOp =
  | "is"
  | "isAny"
  | "isNot"
  | "contains"
  | "isEmpty"
  | "isNotEmpty";

export type FilterRule = {
  id: string;
  conjunction: "and" | "or";
  field: string;
  op: FilterOp;
  value: string | string[];
};

export type SavedView = {
  id: string;
  name: string;
  rules: FilterRule[];
  search?: string;
  isPinned?: boolean;
};

export type FilterPreset = {
  id: string;
  label: string;
  icon?: LucideIcon;
  rules: FilterRule[];
  count?: number;
};

export type EntityFilterLabels = {
  search?: string;
  filter?: string;
  sort?: string;
  fields?: string;
  views?: string;
  saveView?: string;
  savedViews?: string;
  quickFilters?: string;
  addRule?: string;
  clearAll?: string;
  reset?: string;
  where?: string;
  and?: string;
  or?: string;
  applyToAll?: string;
  noActiveFilters?: string;
  rulesTitle?: string;
  rulesDescription?: string;
  showing?: string;
  of?: string;
  records?: string;
  selectField?: string;
  selectValue?: string;
  selectValues?: string;
  noOptions?: string;
  clearSelection?: string;
  noValue?: string;
  viewName?: string;
  save?: string;
  removeFilter?: string;
  removeRule?: string;
  deleteView?: string;
  allFieldsUsed?: string;
  saveViewCtaTitle?: string;
  saveViewCtaDesc?: string;
  ops?: Partial<Record<FilterOp, string>>;
};

const LABELS_EN: Required<EntityFilterLabels> = {
  search: "Search…",
  filter: "Filter",
  sort: "Sort",
  fields: "Fields",
  views: "Views",
  saveView: "Save view",
  savedViews: "Saved views",
  quickFilters: "Quick filters",
  addRule: "Add condition",
  clearAll: "Clear all",
  reset: "Reset",
  where: "Where",
  and: "AND",
  or: "OR",
  applyToAll: "Showing records where",
  noActiveFilters: "No active filters. Add your first condition below.",
  rulesTitle: "Filter rules",
  rulesDescription: "Combine conditions using AND / OR operators.",
  showing: "Showing",
  of: "of",
  records: "records",
  selectField: "Select field…",
  selectValue: "Value…",
  selectValues: "Select values…",
  noOptions: "No options",
  clearSelection: "Clear selection",
  noValue: "(no value)",
  viewName: "View name",
  save: "Save",
  removeFilter: "Remove filter",
  removeRule: "Remove",
  deleteView: "Delete view",
  allFieldsUsed: "All fields are in use",
  saveViewCtaTitle: "Use these filters often?",
  saveViewCtaDesc: "Save the current combination and access it with one click.",
  ops: {
    is: "is",
    isAny: "is any of",
    isNot: "is not",
    contains: "contains",
    isEmpty: "is empty",
    isNotEmpty: "is not empty",
  },
};

const LABELS_SK: Required<EntityFilterLabels> = {
  search: "Vyhľadávanie…",
  filter: "Filter",
  sort: "Zoradenie",
  fields: "Polia",
  views: "Pohľady",
  saveView: "Uložiť pohľad",
  savedViews: "Uložené pohľady",
  quickFilters: "Rýchle filtre",
  addRule: "Pridať podmienku",
  clearAll: "Vyčistiť všetko",
  reset: "Reset",
  where: "Kde",
  and: "A",
  or: "ALEBO",
  applyToAll: "Zobrazujem záznamy kde",
  noActiveFilters: "Žiadne aktívne filtre. Pridaj prvú podmienku nižšie.",
  rulesTitle: "Filter pravidlá",
  rulesDescription: "Skombinuj podmienky pomocou operátorov A / ALEBO.",
  showing: "Zobrazujem",
  of: "z",
  records: "záznamov",
  selectField: "Vyber pole…",
  selectValue: "Hodnota…",
  selectValues: "Vyber hodnoty…",
  noOptions: "Žiadne možnosti",
  clearSelection: "Vyčistiť výber",
  noValue: "(bez hodnoty)",
  viewName: "Názov pohľadu",
  save: "Uložiť",
  removeFilter: "Odstrániť filter",
  removeRule: "Odstrániť",
  deleteView: "Vymazať pohľad",
  allFieldsUsed: "Všetky polia použité",
  saveViewCtaTitle: "Použiť tieto filtre často?",
  saveViewCtaDesc: "Ulož aktuálnu kombináciu a pristupuj k nej jedným klikom.",
  ops: {
    is: "je",
    isAny: "je niektorá z",
    isNot: "nie je",
    contains: "obsahuje",
    isEmpty: "je prázdne",
    isNotEmpty: "nie je prázdne",
  },
};

const LABELS_BY_LOCALE: Record<string, Required<EntityFilterLabels>> = {
  en: LABELS_EN,
  sk: LABELS_SK,
};

function getLocaleLabels(locale?: string): Required<EntityFilterLabels> {
  if (!locale) return LABELS_EN;
  return LABELS_BY_LOCALE[locale] || LABELS_EN;
}

function mergeLabels(
  locale?: string,
  custom?: EntityFilterLabels,
): Required<EntityFilterLabels> {
  const base = getLocaleLabels(locale);
  if (!custom) return base;
  return {
    ...base,
    ...custom,
    ops: { ...base.ops, ...(custom.ops || {}) },
  };
}

function newRuleId() {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const VALUE_OPS: FilterOp[] = ["is", "isAny", "isNot", "contains"];

function getOpsForField(field?: FilterField, restrictOps?: FilterOp[]): FilterOp[] {
  let ops: FilterOp[];
  if (!field) ops = ["is", "isAny", "isNot", "isEmpty", "isNotEmpty"];
  else
    switch (field.type) {
      case "multiselect":
        ops = ["isAny", "isNot", "isEmpty", "isNotEmpty"];
        break;
      case "select":
        ops = ["is", "isAny", "isNot", "isEmpty", "isNotEmpty"];
        break;
      case "text":
        ops = ["contains", "is", "isNot", "isEmpty", "isNotEmpty"];
        break;
      case "boolean":
        ops = ["is", "isNot"];
        break;
    }
  if (restrictOps && restrictOps.length > 0) {
    ops = ops.filter((o) => restrictOps.includes(o));
    if (ops.length === 0) ops = restrictOps;
  }
  return ops;
}

function formatValueLabel(field: FilterField | undefined, value: string | string[]) {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  if (arr.length === 0) return "—";
  const labels = arr.map((v) => {
    const opt = field?.options?.find((o) => o.value === v);
    return opt?.label || v;
  });
  if (labels.length === 1) return labels[0];
  if (labels.length <= 2) return labels.join(", ");
  return `${labels[0]} +${labels.length - 1}`;
}

function loadSavedViews(storageKey?: string): SavedView[] {
  if (!storageKey || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedViews(storageKey: string | undefined, views: SavedView[]) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(views));
  } catch {
    /* ignore quota errors */
  }
}

type EntityFilterProps = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;

  rules: FilterRule[];
  onRulesChange: (rules: FilterRule[]) => void;

  fields: FilterField[];
  presets?: FilterPreset[];

  totalCount?: number;
  visibleCount?: number;

  storageKey?: string;
  /** Slot rendered to the right of the filter controls (typically host actions like Export / Add). */
  actionsSlot?: React.ReactNode;
  /** @deprecated use actionsSlot instead. Still rendered for backward compatibility. */
  rightSlot?: React.ReactNode;
  className?: string;

  /** Active app locale (e.g. "en", "sk"). Selects the built-in label set. */
  locale?: string;
  labels?: EntityFilterLabels;
  testId?: string;

  /** Hide the saved-views selector in the toolbar (e.g. when host page already handles it) */
  hideSavedViews?: boolean;

  /** Restrict the available operators (useful when backend supports equality only) */
  restrictOps?: FilterOp[];
};

export function EntityFilter({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  rules,
  onRulesChange,
  fields,
  presets,
  totalCount,
  visibleCount,
  storageKey,
  actionsSlot,
  rightSlot,
  className,
  locale,
  labels: labelsProp,
  testId = "entity-filter",
  hideSavedViews = false,
  restrictOps,
}: EntityFilterProps) {
  const labels = useMemo(() => mergeLabels(locale, labelsProp), [locale, labelsProp]);
  const numberLocale = locale === "sk" ? "sk-SK" : "en-US";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() =>
    loadSavedViews(storageKey),
  );
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [savePopoverOpen, setSavePopoverOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  useEffect(() => {
    setSavedViews(loadSavedViews(storageKey));
  }, [storageKey]);

  const fieldByKey = useMemo(() => {
    const map = new Map<string, FilterField>();
    fields.forEach((f) => map.set(f.key, f));
    return map;
  }, [fields]);

  const updateRule = (id: string, patch: Partial<FilterRule>) => {
    onRulesChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id: string) => {
    onRulesChange(rules.filter((r) => r.id !== id));
  };

  const addRule = (fieldKey?: string) => {
    const field = fieldKey
      ? fieldByKey.get(fieldKey)
      : fields.find((f) => !rules.some((r) => r.field === f.key)) || fields[0];
    if (!field) return;
    const ops = getOpsForField(field, restrictOps);
    const defaultOp: FilterOp = field.type === "multiselect" ? "isAny" : "is";
    const op = ops.includes(defaultOp) ? defaultOp : ops[0];
    onRulesChange([
      ...rules,
      {
        id: newRuleId(),
        conjunction: rules.length === 0 ? "and" : "and",
        field: field.key,
        op,
        value: field.type === "multiselect" ? [] : "",
      },
    ]);
  };

  const clearAllRules = () => {
    onRulesChange([]);
    setActiveViewId(null);
  };

  const applyPreset = (preset: FilterPreset) => {
    onRulesChange(preset.rules.map((r) => ({ ...r, id: newRuleId() })));
    setActiveViewId(null);
  };

  const applyView = (view: SavedView) => {
    onRulesChange(view.rules.map((r) => ({ ...r, id: newRuleId() })));
    if (view.search !== undefined) onSearchChange(view.search);
    setActiveViewId(view.id);
  };

  const saveCurrentView = () => {
    const name = newViewName.trim();
    if (!name) return;
    const view: SavedView = {
      id: `v_${Date.now().toString(36)}`,
      name,
      rules: rules.map((r) => ({ ...r })),
      search: searchQuery || undefined,
      isPinned: true,
    };
    const next = [...savedViews, view];
    setSavedViews(next);
    persistSavedViews(storageKey, next);
    setActiveViewId(view.id);
    setNewViewName("");
    setSavePopoverOpen(false);
  };

  const deleteView = (viewId: string) => {
    const next = savedViews.filter((v) => v.id !== viewId);
    setSavedViews(next);
    persistSavedViews(storageKey, next);
    if (activeViewId === viewId) setActiveViewId(null);
  };

  const activeView = savedViews.find((v) => v.id === activeViewId) || null;
  const hasActive = rules.length > 0 || !!searchQuery;

  return (
    <div className={className} data-testid={testId}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder || labels.search}
            className="pl-10 h-9"
            data-testid={`${testId}-search`}
          />
        </div>

        {/* Filter button */}
        <Button
          variant={rules.length > 0 ? "default" : "outline"}
          size="sm"
          onClick={() => setDrawerOpen(true)}
          className="h-9 gap-1.5"
          data-testid={`${testId}-open-filter`}
        >
          <FilterIcon className="h-4 w-4" />
          {labels.filter}
          {rules.length > 0 && (
            <Badge
              variant="secondary"
              className={`ml-0.5 h-5 rounded px-1.5 text-[10px] ${rules.length > 0 ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" : ""}`}
            >
              {rules.length}
            </Badge>
          )}
        </Button>

        {/* Prominent Clear-all button (visible only when filters are active) */}
        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearAllRules();
              if (searchQuery) onSearchChange("");
            }}
            className="h-9 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            data-testid={`${testId}-clear-all`}
            title={labels.clearAll}
          >
            <X className="h-4 w-4" />
            {labels.clearAll}
          </Button>
        )}

        {/* Saved views */}
        {!hideSavedViews && (
          <div className="flex items-center gap-1">
            <Select
              value={activeViewId || "__none__"}
              onValueChange={(val) => {
                if (val === "__none__") {
                  setActiveViewId(null);
                  return;
                }
                if (val === "__clear__") {
                  clearAllRules();
                  return;
                }
                const view = savedViews.find((v) => v.id === val);
                if (view) applyView(view);
              }}
            >
              <SelectTrigger
                className="h-9 w-[200px] gap-1.5"
                data-testid={`${testId}-saved-views`}
              >
                <Star
                  className={`h-3.5 w-3.5 ${activeView ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                />
                <SelectValue
                  placeholder={labels.savedViews}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">— {labels.savedViews} —</span>
                </SelectItem>
                {savedViews.length > 0 && <Separator className="my-1" />}
                {savedViews.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="flex items-center gap-2">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {v.name}
                    </span>
                  </SelectItem>
                ))}
                {hasActive && <Separator className="my-1" />}
                {hasActive && (
                  <SelectItem value="__clear__">
                    <span className="text-muted-foreground">{labels.clearAll}</span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            <Popover open={savePopoverOpen} onOpenChange={setSavePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  disabled={!hasActive}
                  title={labels.saveView}
                  data-testid={`${testId}-save-view`}
                >
                  <Bookmark className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="end">
                <div className="space-y-2">
                  <div className="text-sm font-medium">{labels.saveView}</div>
                  <Input
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    placeholder={labels.viewName}
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCurrentView();
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="w-full h-8"
                    onClick={saveCurrentView}
                    disabled={!newViewName.trim()}
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" /> {labels.save}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Actions slot for host-specific buttons (Export / Refresh / Add) */}
        {(actionsSlot || rightSlot) && (
          <div className="flex items-center gap-1.5 ml-auto">
            {actionsSlot}
            {rightSlot}
          </div>
        )}
      </div>

      {/* Active rules chips */}
      {rules.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {labels.applyToAll}:
          </span>
          {rules.map((rule, idx) => {
            const field = fieldByKey.get(rule.field);
            const Icon = field?.icon;
            const opLabel = labels.ops[rule.op] || rule.op;
            const valueLabel = VALUE_OPS.includes(rule.op)
              ? formatValueLabel(field, rule.value)
              : "";
            return (
              <Badge
                key={rule.id}
                variant="secondary"
                className="h-7 gap-1.5 pl-2 pr-1 font-normal"
                data-testid={`${testId}-chip-${rule.field}`}
              >
                {idx > 0 && (
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {rule.conjunction === "or" ? labels.or : labels.and}
                  </span>
                )}
                {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
                <span className="text-muted-foreground">{field?.label || rule.field}</span>
                <span className="text-muted-foreground/70">{opLabel}</span>
                {valueLabel && (
                  <span className="font-medium text-foreground">{valueLabel}</span>
                )}
                <button
                  onClick={() => removeRule(rule.id)}
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
                  data-testid={`${testId}-chip-remove-${rule.field}`}
                  aria-label={labels.removeFilter}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                data-testid={`${testId}-add-chip`}
              >
                <Plus className="h-3.5 w-3.5" /> {labels.addRule}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start">
              {fields
                .filter((f) => !rules.some((r) => r.field === f.key))
                .map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.key}
                      onClick={() => addRule(f.key)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                    >
                      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                      {f.label}
                    </button>
                  );
                })}
              {fields.every((f) => rules.some((r) => r.field === f.key)) && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {labels.allFieldsUsed}
                </div>
              )}
            </PopoverContent>
          </Popover>
          <button
            onClick={clearAllRules}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            data-testid={`${testId}-clear-chips`}
          >
            {labels.clearAll}
          </button>
        </div>
      )}

      {/* Count summary */}
      {(visibleCount !== undefined || totalCount !== undefined) && hasActive && (
        <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-md border border-primary/20 text-xs">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-primary">
            {labels.showing}{" "}
            <span className="font-semibold">
              {(visibleCount ?? 0).toLocaleString(numberLocale)}
            </span>
            {totalCount !== undefined && (
              <>
                {" "}
                {labels.of}{" "}
                <span className="font-medium">
                  {totalCount.toLocaleString(numberLocale)}
                </span>
              </>
            )}{" "}
            {labels.records}
          </span>
        </div>
      )}

      {/* Drawer with rule builder */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-[420px] sm:w-[460px] sm:max-w-[460px] flex flex-col p-0"
          data-testid={`${testId}-drawer`}
        >
          <SheetHeader className="px-5 py-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <FilterIcon className="h-4 w-4 text-primary" />
              {labels.rulesTitle}
              {rules.length > 0 && (
                <Badge variant="secondary" className="h-5 rounded text-[10px]">
                  {rules.length}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {labels.rulesDescription}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {rules.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                {labels.noActiveFilters}
              </div>
            ) : (
              <div className="space-y-1.5">
                {rules.map((rule, idx) => {
                  const field = fieldByKey.get(rule.field);
                  const Icon = field?.icon;
                  const opOptions = getOpsForField(field, restrictOps);
                  const showValueInput = VALUE_OPS.includes(rule.op);
                  const isMulti =
                    field?.type === "multiselect" || rule.op === "isAny";

                  return (
                    <div
                      key={rule.id}
                      className="group rounded-md border bg-card p-2"
                      data-testid={`${testId}-rule-${rule.field}`}
                    >
                      <div className="flex items-center gap-1">
                        {idx === 0 ? (
                          <span className="w-14 text-[10px] font-medium uppercase text-muted-foreground">
                            {labels.where}
                          </span>
                        ) : (
                          <Select
                            value={rule.conjunction}
                            onValueChange={(v) =>
                              updateRule(rule.id, {
                                conjunction: v as "and" | "or",
                              })
                            }
                          >
                            <SelectTrigger className="h-6 w-14 border-input text-[10px] uppercase">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="and">{labels.and}</SelectItem>
                              <SelectItem value="or">{labels.or}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <button
                          onClick={() => removeRule(rule.id)}
                          className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          aria-label={labels.removeRule}
                          data-testid={`${testId}-rule-remove-${rule.field}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Field */}
                      <div className="mt-1.5 flex items-center gap-1">
                        <Select
                          value={rule.field}
                          onValueChange={(v) => {
                            const newField = fieldByKey.get(v);
                            const newOps = getOpsForField(newField, restrictOps);
                            const defaultOp: FilterOp =
                              newField?.type === "multiselect" ? "isAny" : "is";
                            updateRule(rule.id, {
                              field: v,
                              op: newOps.includes(defaultOp)
                                ? defaultOp
                                : newOps[0],
                              value: newField?.type === "multiselect" ? [] : "",
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 flex-1 text-xs">
                            {Icon && (
                              <Icon className="mr-1.5 h-3 w-3 text-muted-foreground" />
                            )}
                            <SelectValue placeholder={labels.selectField} />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map((f) => {
                              const F = f.icon;
                              return (
                                <SelectItem key={f.key} value={f.key}>
                                  <span className="flex items-center gap-1.5">
                                    {F && <F className="h-3 w-3 text-muted-foreground" />}
                                    {f.label}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Op + Value */}
                      <div className="mt-1 flex items-center gap-1">
                        <Select
                          value={rule.op}
                          onValueChange={(v) =>
                            updateRule(rule.id, { op: v as FilterOp })
                          }
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {opOptions.map((op) => (
                              <SelectItem key={op} value={op}>
                                {labels.ops[op] || op}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {showValueInput && field?.options ? (
                          isMulti ? (
                            <MultiSelectValue
                              field={field}
                              labels={labels}
                              selected={
                                Array.isArray(rule.value)
                                  ? rule.value
                                  : rule.value
                                    ? [rule.value]
                                    : []
                              }
                              onChange={(vals) =>
                                updateRule(rule.id, { value: vals })
                              }
                            />
                          ) : (
                            <Select
                              value={
                                Array.isArray(rule.value)
                                  ? rule.value[0] || ""
                                  : rule.value || ""
                              }
                              onValueChange={(v) =>
                                updateRule(rule.id, { value: v })
                              }
                            >
                              <SelectTrigger className="h-8 flex-1 text-xs">
                                <SelectValue placeholder={labels.selectValue} />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        ) : showValueInput ? (
                          <Input
                            value={
                              Array.isArray(rule.value)
                                ? rule.value.join(", ")
                                : rule.value
                            }
                            onChange={(e) =>
                              updateRule(rule.id, { value: e.target.value })
                            }
                            placeholder={labels.selectValue}
                            className="h-8 flex-1 text-xs"
                          />
                        ) : (
                          <span className="flex-1 px-2 text-xs text-muted-foreground italic">
                            {labels.noValue}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-1 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addRule()}
                className="h-7 gap-1 px-2 text-xs text-primary hover:bg-primary/5"
                data-testid={`${testId}-add-rule`}
              >
                <Plus className="h-3.5 w-3.5" /> {labels.addRule}
              </Button>
              {rules.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllRules}
                  className="ml-auto h-7 px-2 text-xs text-muted-foreground"
                >
                  {labels.clearAll}
                </Button>
              )}
            </div>

            {/* Quick presets */}
            {presets && presets.length > 0 && (
              <div className="mt-5">
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {labels.quickFilters}
                </div>
                <div className="flex flex-wrap gap-1">
                  {presets.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p)}
                        className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                        data-testid={`${testId}-preset-${p.id}`}
                      >
                        {Icon && <Icon className="h-3 w-3" />}
                        {p.label}
                        {p.count !== undefined && (
                          <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                            {p.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Saved views (in drawer) */}
            {!hideSavedViews && savedViews.length > 0 && (
              <div className="mt-5">
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {labels.savedViews}
                </div>
                <div className="space-y-1">
                  {savedViews.map((v) => (
                    <div
                      key={v.id}
                      className={`group flex items-center justify-between rounded px-2 py-1.5 text-xs ${activeViewId === v.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                    >
                      <button
                        onClick={() => applyView(v)}
                        className="flex flex-1 items-center gap-1.5 text-left"
                      >
                        <Star
                          className={`h-3 w-3 ${activeViewId === v.id ? "fill-primary text-primary" : "fill-amber-400 text-amber-400"}`}
                        />
                        {v.name}
                      </button>
                      <button
                        onClick={() => deleteView(v.id)}
                        className="ml-2 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label={labels.deleteView}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save current as view CTA */}
            {hasActive && !hideSavedViews && (
              <div className="mt-5 rounded-md border border-dashed border-primary/30 bg-primary/5 p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div className="flex-1">
                    <div className="text-xs font-medium">
                      {labels.saveViewCtaTitle}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {labels.saveViewCtaDesc}
                    </p>
                    <div className="mt-2 flex items-center gap-1">
                      <Input
                        value={newViewName}
                        onChange={(e) => setNewViewName(e.target.value)}
                        placeholder={labels.viewName}
                        className="h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveCurrentView();
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        onClick={saveCurrentView}
                        disabled={!newViewName.trim()}
                      >
                        <Save className="h-3 w-3" /> {labels.save}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MultiSelectValue({
  field,
  selected,
  onChange,
  labels,
}: {
  field: FilterField;
  selected: string[];
  onChange: (vals: string[]) => void;
  labels: Required<EntityFilterLabels>;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1 justify-between text-xs font-normal"
        >
          <span className="truncate">
            {selected.length === 0 ? labels.selectValues : formatValueLabel(field, selected)}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="max-h-64 overflow-y-auto p-1">
          {(field.options || []).map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
              >
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    checked ? "border-primary bg-primary" : "border-input"
                  }`}
                >
                  {checked && (
                    <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="flex-1 text-left">{opt.label}</span>
                {opt.count !== undefined && (
                  <span className="text-[10px] text-muted-foreground">{opt.count}</span>
                )}
              </button>
            );
          })}
          {(!field.options || field.options.length === 0) && (
            <div className="px-2 py-2 text-xs text-muted-foreground">{labels.noOptions}</div>
          )}
        </div>
        {selected.length > 0 && (
          <>
            <Separator />
            <button
              onClick={() => onChange([])}
              className="w-full p-2 text-center text-xs text-muted-foreground hover:bg-muted"
            >
              {labels.clearSelection}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
