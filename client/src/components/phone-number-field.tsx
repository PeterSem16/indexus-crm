import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PhoneCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "SK", name: "Slovensko", dialCode: "+421", flag: "🇸🇰" },
  { code: "CZ", name: "Česká republika", dialCode: "+420", flag: "🇨🇿" },
  { code: "HU", name: "Maďarsko", dialCode: "+36", flag: "🇭🇺" },
  { code: "RO", name: "Rumunsko", dialCode: "+40", flag: "🇷🇴" },
  { code: "IT", name: "Taliansko", dialCode: "+39", flag: "🇮🇹" },
  { code: "DE", name: "Nemecko", dialCode: "+49", flag: "🇩🇪" },
  { code: "US", name: "USA", dialCode: "+1", flag: "🇺🇸" },
  { code: "CH", name: "Švajčiarsko", dialCode: "+41", flag: "🇨🇭" },
];

interface PhoneNumberFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  defaultCountryCode?: string;
  "data-testid"?: string;
  className?: string;
}

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 3) {
    parts.push(digits.slice(i, i + 3));
  }
  return parts.join(" ");
}

function parsePhoneValue(value: string): { countryCode: string; number: string } {
  if (!value) return { countryCode: "SK", number: "" };
  
  for (const country of PHONE_COUNTRIES) {
    if (value.startsWith(country.dialCode)) {
      const number = value.slice(country.dialCode.length).trim();
      return { countryCode: country.code, number: formatPhoneNumber(number) };
    }
  }
  
  const digits = value.replace(/\D/g, "");
  return { countryCode: "SK", number: formatPhoneNumber(digits) };
}

export function PhoneNumberField({
  value = "",
  onChange,
  disabled = false,
  placeholder = "123 456 789",
  defaultCountryCode = "SK",
  "data-testid": testId,
  className,
}: PhoneNumberFieldProps) {
  const [open, setOpen] = useState(false);
  const parsed = parsePhoneValue(value);
  const [selectedCountry, setSelectedCountry] = useState<string>(
    parsed.countryCode || defaultCountryCode
  );
  const [phoneNumber, setPhoneNumber] = useState<string>(parsed.number);

  const country = PHONE_COUNTRIES.find((c) => c.code === selectedCountry) || PHONE_COUNTRIES[0];

  useEffect(() => {
    const parsed = parsePhoneValue(value);
    if (value) {
      setSelectedCountry(parsed.countryCode);
      setPhoneNumber(parsed.number);
    } else {
      setSelectedCountry(defaultCountryCode);
      setPhoneNumber("");
    }
  }, [value, defaultCountryCode]);

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setOpen(false);
    const newCountry = PHONE_COUNTRIES.find((c) => c.code === countryCode);
    if (newCountry && onChange) {
      const digits = phoneNumber.replace(/\s/g, "");
      onChange(digits ? `${newCountry.dialCode} ${formatPhoneNumber(digits)}` : "");
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, "");
    const formatted = formatPhoneNumber(digits);
    setPhoneNumber(formatted);
    
    if (onChange) {
      onChange(digits ? `${country.dialCode} ${formatted}` : "");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"
    ];
    if (allowedKeys.includes(e.key)) return;
    
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-[140px] justify-between shrink-0"
            data-testid={testId ? `${testId}-country` : undefined}
          >
            <span className="flex items-center gap-1.5 truncate">
              <span>{country.flag}</span>
              <span className="text-muted-foreground">{country.dialCode}</span>
            </span>
            <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Hľadať krajinu..." />
            <CommandList>
              <CommandEmpty>Krajina nenájdená</CommandEmpty>
              <CommandGroup>
                {PHONE_COUNTRIES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.dialCode}`}
                    onSelect={() => handleCountryChange(c.code)}
                    data-testid={testId ? `${testId}-country-${c.code}` : undefined}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCountry === c.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="mr-2">{c.flag}</span>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-muted-foreground text-sm">{c.dialCode}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        type="tel"
        value={phoneNumber}
        onChange={handlePhoneChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
        data-testid={testId ? `${testId}-number` : undefined}
      />
    </div>
  );
}
