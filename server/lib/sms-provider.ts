import { db } from "../db";
import { smsGatewaySettings, type SmsGatewayProvider } from "@shared/schema";
import { sendTransactionalSms, sendPromotionalSms, isBulkGateConfigured } from "./bulkgate";
import { isSmsToolsConfigured, sendSmsTools } from "./smstools";
import { selectSmsProvider } from "./sms-provider-selection";

export type { SmsGatewayProvider };

export interface SmsProviderSendOptions {
  number: string;
  text: string;
  country?: string;
  provider?: SmsGatewayProvider | string | null;
  unicode?: boolean;
  senderId?: any;
  senderIdValue?: string | null;
  forceSender?: boolean;
  schedule?: string;
  tag?: string;
  promotional?: boolean;
}

export interface SmsProviderSendResult {
  success: boolean;
  provider: SmsGatewayProvider;
  smsId?: string;
  batchId?: string;
  partIds?: string[];
  number?: string;
  error?: string;
  errorCode?: number;
}

type GatewaySetting = typeof smsGatewaySettings.$inferSelect;

export async function getSmsGatewaySettings(): Promise<GatewaySetting[]> {
  try {
    return await db.select().from(smsGatewaySettings);
  } catch {
    // The startup migration creates this table. Returning no overrides keeps
    // the legacy BulkGate default usable during first boot.
    return [];
  }
}

function normalizedCountry(country?: string | null): string | undefined {
  const value = country?.trim().toUpperCase();
  return value || undefined;
}

function isConfigured(provider: SmsGatewayProvider): boolean {
  return provider === "bulkgate" ? isBulkGateConfigured() : isSmsToolsConfigured();
}

export function isSmsProvider(value: unknown): value is SmsGatewayProvider {
  return value === "bulkgate" || value === "smstools";
}

export async function resolveSmsProvider(
  requestedProvider: string | null | undefined,
  country: string | null | undefined,
): Promise<{ provider?: SmsGatewayProvider; error?: string }> {
  const settings = await getSmsGatewaySettings();
  return selectSmsProvider({
    requested: requestedProvider,
    country,
    settings,
    configured: {
      bulkgate: isBulkGateConfigured(),
      smstools: isSmsToolsConfigured(),
    },
  });
}

export async function getGatewaySetting(provider: SmsGatewayProvider, country?: string | null): Promise<GatewaySetting | undefined> {
  const settings = await getSmsGatewaySettings();
  const countryCode = normalizedCountry(country);
  return settings.find(s => s.provider === provider && s.countryCode === countryCode) ||
    settings.find(s => s.provider === provider && !s.countryCode);
}

export async function sendSmsViaProvider(options: SmsProviderSendOptions): Promise<SmsProviderSendResult> {
  const selection = await resolveSmsProvider(options.provider, options.country);
  if (!selection.provider) {
    const requested = options.provider;
    const fallbackProvider: SmsGatewayProvider = isSmsProvider(requested) ? requested : "bulkgate";
    return { success: false, provider: fallbackProvider, error: selection.error, errorCode: 400 };
  }
  const provider: SmsGatewayProvider = selection.provider;

  if (provider === "smstools") {
    const setting = await getGatewaySetting("smstools", options.country);
    const result = await sendSmsTools({
      number: options.number,
      text: options.text,
      senderText: setting?.senderText || options.senderIdValue,
      virtualNumber: setting?.virtualNumber,
      schedule: options.schedule,
    });
    return { ...result, provider, batchId: result.batchId };
  }

  const send = options.promotional ? sendPromotionalSms : sendTransactionalSms;
  const result = await send(options as any);
  return {
    ...result,
    provider,
    smsId: result.smsId,
    partIds: result.partIds,
  };
}

export async function getSmsGatewayStatus() {
  const settings = await getSmsGatewaySettings();
  const smstoolsSetting = settings.find(s => s.provider === "smstools" && (s.countryCode === "SK" || !s.countryCode));
  const bulkgateConfigured = isBulkGateConfigured();
  const smstoolsConfigured = isSmsToolsConfigured();
  return {
    providers: [
      { provider: "bulkgate" as const, configured: bulkgateConfigured, active: settings.find(s => s.provider === "bulkgate")?.isActive ?? true },
      { provider: "smstools" as const, configured: smstoolsConfigured, active: smstoolsSetting?.isActive ?? smstoolsConfigured, country: "SK" },
    ],
    settings,
    smstools: {
      configured: smstoolsConfigured,
      virtualNumberConfigured: Boolean(smstoolsSetting?.virtualNumber || process.env.SMSTOOLS_VIRTUAL_NUMBER),
      callbackAuthConfigured: Boolean(process.env.SMSTOOLS_CALLBACK_TOKEN || (process.env.SMSTOOLS_CALLBACK_USER && process.env.SMSTOOLS_CALLBACK_PASSWORD)),
    },
  };
}