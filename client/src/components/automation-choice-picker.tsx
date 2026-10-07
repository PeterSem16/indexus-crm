import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type AutomationChoice = { value: string; label: string };

/** A bounded multi-select for rule filters; values are stable IDs. */
export function AutomationChoicePicker({
  options, values, onChange, label, placeholder, testId,
}: {
  options: AutomationChoice[];
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
  placeholder: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = values.map(value => options.find(option => option.value === value)?.label || value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={label}
          data-testid={testId} className="h-9 min-w-44 max-w-full justify-between gap-2 text-xs">
          <span className="truncate">{selected.length ? selected.join(", ") : placeholder}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="automation-rule-select-content z-[10050] w-[min(24rem,calc(100vw-2rem))] p-1.5"
        onOpenAutoFocus={event => { event.preventDefault(); }}>
        <div className="max-h-64 overflow-y-auto" role="group" aria-label={label}>
          {options.map(option => {
            const checked = values.includes(option.value);
            return (
              <label key={option.value} className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent">
                <Checkbox checked={checked} aria-label={option.label} onCheckedChange={() => onChange(
                  checked ? values.filter(value => value !== option.value) : [...values, option.value],
                )} />
                <span className="min-w-0 flex-1 break-words">{option.label}</span>
                {checked && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
