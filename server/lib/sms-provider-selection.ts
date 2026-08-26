export type SelectableSmsProvider = "bulkgate" | "smstools";

export interface SmsGatewaySettingLike {
  provider: string;
  countryCode?: string | null;
  isActive: boolean;
  isDefault: boolean;
}

export function selectSmsProvider(input: {
  requested?: string | null;
  country?: string | null;
  settings: SmsGatewaySettingLike[];
  configured: Record<SelectableSmsProvider, boolean>;
}): { provider?: SelectableSmsProvider; error?: string } {
  const requested = input.requested?.trim().toLowerCase();
  const country = input.country?.trim().toUpperCase() || undefined;
  const isProvider = (value: string): value is SelectableSmsProvider =>
    value === "bulkgate" || value === "smstools";
  const settingFor = (provider: SelectableSmsProvider) => {
    const exact = input.settings.find(setting =>
      setting.provider === provider &&
      Boolean(country) &&
      setting.countryCode?.toUpperCase() === country,
    );
    return exact || input.settings.find(setting =>
      setting.provider === provider && !setting.countryCode,
    );
  };
  const isEligible = (provider: SelectableSmsProvider) => {
    const setting = settingFor(provider);
    return input.configured[provider] &&
      setting?.isActive !== false &&
      (provider !== "smstools" || country === "SK");
  };

  if (requested) {
    if (!isProvider(requested)) return { error: "Neznámy SMS provider" };
    if (requested === "smstools" && country !== "SK") {
      return { error: "SMSTOOLS je momentálne povolený iba pre Slovensko" };
    }
    const setting = settingFor(requested);
    if (setting && !setting.isActive) return { error: `${requested} je pre túto krajinu vypnutý` };
    if (!input.configured[requested]) return { error: `${requested} nie je nakonfigurovaný` };
    return { provider: requested };
  }

  const defaultProvider = (["bulkgate", "smstools"] as const).find(provider => {
    const setting = settingFor(provider);
    return setting?.isActive && setting.isDefault && isEligible(provider);
  });
  if (defaultProvider) {
    return { provider: defaultProvider };
  }

  if (isEligible("bulkgate")) return { provider: "bulkgate" };
  if (isEligible("smstools")) return { provider: "smstools" };
  return { error: "Nie je nakonfigurovaná žiadna SMS gateway" };
}