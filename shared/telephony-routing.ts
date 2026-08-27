export type OutboundCallProvider = "O2-IMS";
export type OutboundTrunkSelection = "global" | "sk-existing" | "o2-ims";

export interface OutboundCallerIdOption {
  id: string;
  number: string;
  countryCode: "SK";
  trunk: "o2-ims";
  active: boolean;
}

export const OUTBOUND_CALLER_ID_OPTIONS: readonly OutboundCallerIdOption[] = [
  {
    id: "o2-sk-virtual-1",
    number: "+421940682394",
    countryCode: "SK",
    trunk: "o2-ims",
    active: true,
  },
] as const;

export interface MissionCountryOutboundRouting {
  trunk: OutboundTrunkSelection;
  callerIdId?: string | null;
}

export interface MissionOutboundSettings {
  outboundRoutingByCountry?: Record<string, MissionCountryOutboundRouting | undefined>;
}

export interface ResolvedOutboundRouting {
  trunk: OutboundTrunkSelection;
  callerIdNumber?: string;
  callerIdId?: string;
  provider?: OutboundCallProvider;
  source: "mission" | "global";
}

export function normalizePhoneForRouting(value: string | null | undefined): string {
  const cleaned = (value || "").trim().replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2).replace(/\D/g, "")}`;
  return cleaned.replace(/\D/g, "");
}

export function isO2ImsOutboundCallerId(value: string | null | undefined): boolean {
  const normalized = normalizePhoneForRouting(value);
  return /^\+42122213323\d$/.test(normalized) || /^42122213323\d$/.test(normalized);
}

export function resolveOutboundCallProvider(
  callerIdNumber: string | null | undefined,
): OutboundCallProvider | undefined {
  return isO2ImsOutboundCallerId(callerIdNumber) ? "O2-IMS" : undefined;
}

export function parseMissionSettings(value: unknown): MissionOutboundSettings {
  if (!value) return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as MissionOutboundSettings
      : {};
  } catch {
    return {};
  }
}

export function getMissionCountryOutboundRouting(
  settings: unknown,
  countryCode: string,
): MissionCountryOutboundRouting {
  const parsed = parseMissionSettings(settings);
  const route = parsed.outboundRoutingByCountry?.[countryCode.toUpperCase()];
  if (!route || !["global", "sk-existing", "o2-ims"].includes(route.trunk)) {
    return { trunk: "global", callerIdId: null };
  }
  return route;
}

export function resolveMissionOutboundRouting(params: {
  settings: unknown;
  countryCode: string | null | undefined;
  legacyCallerIdNumber?: string | null;
}): ResolvedOutboundRouting {
  const countryCode = (params.countryCode || "").toUpperCase();
  const route = getMissionCountryOutboundRouting(params.settings, countryCode);

  if (countryCode === "SK" && route.trunk === "o2-ims") {
    const option = OUTBOUND_CALLER_ID_OPTIONS.find(
      item => item.id === route.callerIdId && item.active && item.trunk === "o2-ims",
    );
    if (!option) {
      throw new Error("O2 IMS requires an active outbound Caller ID assigned to the Mission");
    }
    return {
      trunk: "o2-ims",
      callerIdId: option.id,
      callerIdNumber: option.number,
      provider: "O2-IMS",
      source: "mission",
    };
  }

  if (countryCode === "SK" && route.trunk === "sk-existing") {
    return {
      trunk: "sk-existing",
      callerIdNumber: params.legacyCallerIdNumber || undefined,
      source: "mission",
    };
  }

  return {
    trunk: "global",
    callerIdNumber: params.legacyCallerIdNumber || undefined,
    provider: resolveOutboundCallProvider(params.legacyCallerIdNumber),
    source: "global",
  };
}

export function inferOutboundCountryCode(
  phoneNumber: string | null | undefined,
  campaignCountryCodes: readonly string[] | null | undefined,
): string | undefined {
  const normalized = normalizePhoneForRouting(phoneNumber);
  if (/^\+?421/.test(normalized)) return "SK";
  if (/^\+?420/.test(normalized)) return "CZ";
  if (/^\+?40/.test(normalized)) return "RO";
  if (/^\+?36/.test(normalized)) return "HU";
  if (/^\+?49/.test(normalized)) return "DE";
  if (/^\+?39/.test(normalized)) return "IT";
  if (/^0\d+/.test(normalized) && campaignCountryCodes?.length === 1) {
    return campaignCountryCodes[0]?.toUpperCase();
  }
  return campaignCountryCodes?.[0]?.toUpperCase();
}

export function validateMissionOutboundSettings(settings: unknown): string | null {
  const parsed = parseMissionSettings(settings);
  const routes = parsed.outboundRoutingByCountry;
  if (routes === undefined) return null;
  if (!routes || typeof routes !== "object" || Array.isArray(routes)) {
    return "Invalid Mission outbound routing";
  }
  for (const [countryCode, route] of Object.entries(routes)) {
    if (!route || !["global", "sk-existing", "o2-ims"].includes(route.trunk)) {
      return `Invalid outbound trunk for ${countryCode}`;
    }
    if (route.trunk === "o2-ims") {
      if (countryCode.toUpperCase() !== "SK") return "O2 IMS is currently available only for Slovakia";
      const option = OUTBOUND_CALLER_ID_OPTIONS.find(
        item => item.id === route.callerIdId && item.active && item.trunk === "o2-ims",
      );
      if (!option) return "O2 IMS requires an active outbound Caller ID assigned to the Mission";
    }
  }
  return null;
}