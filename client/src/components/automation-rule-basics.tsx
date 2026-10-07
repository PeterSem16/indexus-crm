import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/i18n";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import "./automation-rule-basics.css";

export interface AutomationRuleBasicsProps {
  name: string;
  description: string;
  countryCodes: string[] | null;
  countries: Array<{ value: string; label: string }>;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onCountriesChange: (v: string[] | null) => void;
}

export function AutomationRuleBasics({
  name,
  description,
  countryCodes,
  countries,
  onNameChange,
  onDescriptionChange,
  onCountriesChange,
}: AutomationRuleBasicsProps) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const countryNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "region" }),
    [locale],
  );

  const allCountriesSelected = !countryCodes?.length;
  const selectedNames = useMemo(
    () =>
      (countryCodes ?? [])
        .map((code) => {
          const region = code.trim().toUpperCase();
          const localized = countryNames.of(region);
          return localized && localized.toUpperCase() !== region
            ? localized
            : countries.find((country) => country.value === code)?.label ?? code;
        })
        .filter(Boolean),
    [countryCodes, countries, countryNames],
  );

  const summary = allCountriesSelected
    ? t.automationServices.editor.allCountries
    : selectedNames.join(", ");

  const toggleCountry = (code: string, checked: boolean | "indeterminate") => {
    const selected = countryCodes ?? [];
    const next = checked
      ? selected.includes(code) ? selected : [...selected, code]
      : selected.filter((item) => item !== code);
    onCountriesChange(next.length > 0 ? next : null);
  };

  return (
    <section className="automation-rule-basics" aria-label={t.automationServices.workspace.ruleName}>
      <div className="automation-rule-basics__field">
        <label className="automation-rule-basics__label" htmlFor={`${id}-name`}>
          {t.automationServices.workspace.ruleName}
        </label>
        <input
          id={`${id}-name`}
          className="automation-rule-basics__input"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          data-testid="input-rule-name"
        />
      </div>

      <div className="automation-rule-basics__field">
        <span className="automation-rule-basics__label" id={`${id}-country-label`}>
          {t.automationServices.editor.countryScope}
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="automation-rule-basics__trigger"
              aria-labelledby={`${id}-country-label ${id}-country-summary`}
              aria-haspopup="listbox"
              aria-expanded={open}
              data-testid="select-country-scope"
            >
              <span className="automation-rule-basics__summary" id={`${id}-country-summary`}>
                {summary}
              </span>
              <ChevronDown className="automation-rule-basics__chevron" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={5}
            className="automation-rule-basics__popover"
          >
            <div className="automation-rule-basics__country-list" role="group" aria-label={t.automationServices.editor.countryScope}>
              <div className="automation-rule-basics__option automation-rule-basics__option--all">
                <Checkbox
                  id={`${id}-all-countries`}
                  className="automation-rule-basics__checkbox"
                  checked={allCountriesSelected}
                  onCheckedChange={() => onCountriesChange(null)}
                  aria-label={t.automationServices.editor.allCountries}
                  data-testid="select-country-all"
                />
                <span>{t.automationServices.editor.allCountries}</span>
              </div>
              {countries.map((country) => {
                const region = country.value.trim().toUpperCase();
                const localized = countryNames.of(region);
                const label = localized && localized.toUpperCase() !== region
                  ? localized
                  : country.label;
                const checked = countryCodes?.includes(country.value) ?? false;
                return (
                  <label
                    className="automation-rule-basics__option"
                    key={country.value}
                    htmlFor={`${id}-country-${country.value}`}
                  >
                    <Checkbox
                      id={`${id}-country-${country.value}`}
                      className="automation-rule-basics__checkbox"
                      checked={checked}
                      onCheckedChange={(value) => toggleCountry(country.value, value)}
                      aria-label={label}
                      data-testid={`select-country-${country.value}`}
                    />
                    <span className="automation-rule-basics__country-name">{label}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="automation-rule-basics__field">
        <label className="automation-rule-basics__label" htmlFor={`${id}-description`}>
          {t.automationServices.workspace.description}
        </label>
        <textarea
          id={`${id}-description`}
          className="automation-rule-basics__description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          rows={2}
          data-testid="textarea-rule-description"
        />
      </div>
    </section>
  );
}

export default AutomationRuleBasics;
