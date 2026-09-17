import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "@/i18n";
import { PRIORITY_UNKNOWN_CITY_KEY } from "./priority-builder";
import { priorityBuilderCopy } from "./priority-builder-copy";

interface PriorityCityPickerProps {
  options: Array<{ key: string; city: string; countryCode: string }>;
  selectedKeys: ReadonlySet<string>;
  disabled: boolean;
  onChange: (keys: string[]) => void;
}

const normalizeSearch = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();

/** In-flow, bounded selection panel: never expands the toolbar or escapes the modal. */
export function PriorityCityPicker({ options, selectedKeys, disabled, onChange }: PriorityCityPickerProps) {
  const { locale } = useI18n();
  const copy = priorityBuilderCopy[locale];
  const [query, setQuery] = useState("");
  const hintId = useId();
  const labels = useMemo(() => options.map(option => ({
    ...option,
    label: option.key === PRIORITY_UNKNOWN_CITY_KEY ? copy.unknownCity
      : `${option.city}${option.countryCode ? copy.cityCountrySeparator + option.countryCode : ""}`,
  })), [options, copy]);
  const filtered = labels.filter(option => normalizeSearch(option.label).includes(normalizeSearch(query)));
  const selectedCount = options.filter(option => selectedKeys.has(option.key)).length;

  return (
    <section className="priority-builder-city-picker" aria-label={copy.onlySelectedCities}>
      <div className="priority-builder-city-picker-tools">
        <label className="priority-builder-search">
          <Search size={14} aria-hidden="true" />
          <input
            data-testid="priority-city-search"
            aria-label={copy.citySearch}
            placeholder={copy.citySearch}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <span className="priority-builder-city-selected-count" role="status">
          {copy.citiesSelected}: <strong>{selectedCount} / {options.length}</strong>
        </span>
        <div className="priority-builder-city-bulk-actions">
          <button type="button" className="priority-builder-button" data-testid="priority-city-select-all"
            disabled={disabled || options.length === 0 || selectedCount === options.length}
            onClick={() => onChange(options.map(option => option.key))}>{copy.selectAllCities}</button>
          <button type="button" className="priority-builder-button" data-testid="priority-city-clear"
            disabled={disabled || selectedKeys.size === 0}
            onClick={() => onChange([])}>{copy.clearCitySelection}</button>
        </div>
      </div>
      <div className="priority-builder-city-options" data-testid="priority-city-options"
        role="group" aria-label={copy.onlySelectedCities} aria-describedby={hintId}>
        {filtered.map(option => (
          <label key={option.key} className="priority-builder-city-option">
            <input type="checkbox" data-testid={`priority-city-option-${option.key}`}
              checked={selectedKeys.has(option.key)} disabled={disabled}
              onChange={() => {
                const next = new Set(selectedKeys);
                if (next.has(option.key)) next.delete(option.key); else next.add(option.key);
                onChange(Array.from(next));
              }} />
            <span>{option.label}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="priority-builder-city-empty">{copy.noCityMatches}</p>}
      </div>
      <p id={hintId} className="priority-builder-city-hint">
        {selectedCount === 0 && <strong>{copy.noSelectedCities} </strong>}{copy.citySelectionHint}
      </p>
    </section>
  );
}