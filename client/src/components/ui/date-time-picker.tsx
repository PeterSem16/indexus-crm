import { useState, useEffect, useCallback } from "react";
import { format, parse, isValid, setHours, setMinutes } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS, type Locale } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const LOCALE_MAP: Record<string, Locale> = {
  SK: sk, CZ: cs, HU: hu, RO: ro, IT: it, DE: de, US: enUS
};

const DATE_FORMAT_MAP: Record<string, string> = {
  SK: "dd.MM.yyyy", CZ: "dd.MM.yyyy", HU: "yyyy.MM.dd",
  RO: "dd.MM.yyyy", IT: "dd/MM/yyyy", DE: "dd.MM.yyyy", US: "MM/dd/yyyy"
};

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  countryCode?: string;
  includeTime?: boolean;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function DateTimePicker({
  value,
  onChange,
  countryCode = "SK",
  includeTime = true,
  placeholder,
  className,
  "data-testid": testId,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const locale = LOCALE_MAP[countryCode] || sk;
  const dateFormat = DATE_FORMAT_MAP[countryCode] || "dd.MM.yyyy";

  const currentDate = value ? new Date(value) : undefined;
  const isValidDate = currentDate && isValid(currentDate);

  const [hours, setHoursState] = useState(isValidDate ? currentDate.getHours().toString().padStart(2, "0") : "00");
  const [minutes, setMinutesState] = useState(isValidDate ? currentDate.getMinutes().toString().padStart(2, "0") : "00");

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (isValid(d)) {
        setHoursState(d.getHours().toString().padStart(2, "0"));
        setMinutesState(d.getMinutes().toString().padStart(2, "0"));
      }
    }
  }, [value]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (!date) return;
    if (includeTime) {
      const h = parseInt(hours) || 0;
      const m = parseInt(minutes) || 0;
      const withTime = setMinutes(setHours(date, h), m);
      onChange(withTime.toISOString().slice(0, 16));
    } else {
      onChange(date.toISOString().slice(0, 10));
    }
  }, [hours, minutes, includeTime, onChange]);

  const handleTimeChange = useCallback((newHours: string, newMinutes: string) => {
    const h = Math.min(23, Math.max(0, parseInt(newHours) || 0));
    const m = Math.min(59, Math.max(0, parseInt(newMinutes) || 0));
    setHoursState(h.toString().padStart(2, "0"));
    setMinutesState(m.toString().padStart(2, "0"));

    if (isValidDate) {
      const updated = setMinutes(setHours(new Date(currentDate), h), m);
      onChange(updated.toISOString().slice(0, 16));
    }
  }, [isValidDate, currentDate, onChange]);

  const displayValue = isValidDate
    ? includeTime
      ? `${format(currentDate, dateFormat, { locale })} ${hours}:${minutes}`
      : format(currentDate, dateFormat, { locale })
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          data-testid={testId}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {displayValue || (placeholder || "Pick date...")}
          {value && (
            <span
              className="ml-auto"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setHoursState("00");
                setMinutesState("00");
              }}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isValidDate ? currentDate : undefined}
          onSelect={handleDateSelect}
          locale={locale}
          initialFocus
        />
        {includeTime && (
          <div className="flex items-center gap-2 border-t p-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              min={0}
              max={23}
              value={hours}
              onChange={(e) => handleTimeChange(e.target.value, minutes)}
              className="w-16 text-center text-sm"
              data-testid={testId ? `${testId}-hours` : undefined}
            />
            <span className="text-muted-foreground font-medium">:</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => handleTimeChange(hours, e.target.value)}
              className="w-16 text-center text-sm"
              data-testid={testId ? `${testId}-minutes` : undefined}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const now = new Date();
                onChange(now.toISOString().slice(0, 16));
                setOpen(false);
              }}
              data-testid={testId ? `${testId}-now` : undefined}
            >
              Now
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
