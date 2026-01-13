/**
 * BulkGate SMS Gateway Integration
 * Simple API implementation for sending and receiving SMS messages
 */

import { db } from "../db";
import { gsmSenderConfigs } from "@shared/schema";
import { eq } from "drizzle-orm";

const BULKGATE_API_URL = "https://portal.bulkgate.com/api/1.0/simple/transactional";
const BULKGATE_PROMOTIONAL_URL = "https://portal.bulkgate.com/api/1.0/simple/promotional";

// Sender types that don't need a value - BulkGate generates the number automatically
const SENDER_TYPES_WITHOUT_VALUE = ["gSystem", "gShort", "gPush"];

interface BulkGateSendResult {
  success: boolean;
  smsId?: string;
  partIds?: string[];
  number?: string;
  error?: string;
  errorCode?: number;
}

interface BulkGateSendOptions {
  number: string;
  text: string;
  country?: string;
  unicode?: boolean;
  senderId?: "gSystem" | "gShort" | "gText" | "gOwn" | "gProfile" | "gMobile" | "gPush";
  senderIdValue?: string | null;
  schedule?: string;
  tag?: string;
}

/**
 * Get sender configuration for a specific country from database
 */
export async function getSenderConfigForCountry(countryCode: string): Promise<{
  senderId: string;
  senderIdValue: string | null;
} | null> {
  try {
    const [config] = await db
      .select()
      .from(gsmSenderConfigs)
      .where(eq(gsmSenderConfigs.countryCode, countryCode))
      .limit(1);
    
    if (config && config.isActive) {
      return {
        senderId: config.senderIdType,
        senderIdValue: SENDER_TYPES_WITHOUT_VALUE.includes(config.senderIdType) 
          ? null 
          : config.senderIdValue,
      };
    }
    return null;
  } catch (error) {
    console.error(`[BulkGate] Error fetching sender config for ${countryCode}:`, error);
    return null;
  }
}

/**
 * Get BulkGate configuration from environment
 */
function getConfig() {
  return {
    applicationId: process.env.BULKGATE_APPLICATION_ID,
    applicationToken: process.env.BULKGATE_APPLICATION_TOKEN,
    webhookUrl: process.env.BULKGATE_WEBHOOK_URL,
    senderId: process.env.BULKGATE_SENDER_ID || "CBC",
  };
}

/**
 * Check if BulkGate is configured
 */
export function isBulkGateConfigured(): boolean {
  const config = getConfig();
  return !!(config.applicationId && config.applicationToken);
}

/**
 * Send transactional SMS (notifications only)
 * Uses per-country sender configuration from database if available
 */
export async function sendTransactionalSms(options: BulkGateSendOptions): Promise<BulkGateSendResult> {
  const config = getConfig();
  
  if (!config.applicationId || !config.applicationToken) {
    return {
      success: false,
      error: "BulkGate nie je nakonfigurovaný",
      errorCode: 500,
    };
  }

  try {
    // Get sender configuration from database if country is provided
    let senderId = options.senderId || "gSystem";
    let senderIdValue: string | null = options.senderIdValue ?? null;
    
    if (options.country) {
      const countryConfig = await getSenderConfigForCountry(options.country);
      if (countryConfig) {
        senderId = countryConfig.senderId as any;
        senderIdValue = countryConfig.senderIdValue;
        console.log(`[BulkGate] Using country config for ${options.country}: sender_id=${senderId}, value=${senderIdValue || '(none)'}`);
      }
    }
    
    // Build payload - only include sender_id_value if needed for this sender type
    const payload: Record<string, any> = {
      application_id: config.applicationId,
      application_token: config.applicationToken,
      number: options.number.replace(/\s+/g, ""),
      text: options.text,
      country: options.country || null,
      unicode: options.unicode ? "yes" : "no",
      sender_id: senderId,
      schedule: options.schedule || null,
      tag: options.tag || null,
    };
    
    // Only add sender_id_value if this sender type requires it
    if (!SENDER_TYPES_WITHOUT_VALUE.includes(senderId) && senderIdValue) {
      payload.sender_id_value = senderIdValue;
    }

    console.log(`[BulkGate] Sending SMS to ${options.number} with sender_id=${senderId}${senderIdValue ? `, value=${senderIdValue}` : ''}`);

    const response = await fetch(BULKGATE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.data && result.data.status === "accepted") {
      console.log(`[BulkGate] SMS sent successfully: ${result.data.sms_id}`);
      return {
        success: true,
        smsId: result.data.sms_id,
        partIds: result.data.part_id,
        number: result.data.number,
      };
    } else {
      console.error(`[BulkGate] SMS send failed:`, result);
      return {
        success: false,
        error: result.error || "Neznáma chyba",
        errorCode: result.code || 500,
      };
    }
  } catch (error) {
    console.error(`[BulkGate] Network error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Chyba siete",
      errorCode: 500,
    };
  }
}

/**
 * Send promotional SMS (marketing)
 * Uses per-country sender configuration from database if available
 */
export async function sendPromotionalSms(options: BulkGateSendOptions): Promise<BulkGateSendResult> {
  const config = getConfig();
  
  if (!config.applicationId || !config.applicationToken) {
    return {
      success: false,
      error: "BulkGate nie je nakonfigurovaný",
      errorCode: 500,
    };
  }

  try {
    // Get sender configuration from database if country is provided
    let senderId = options.senderId || "gSystem";
    let senderIdValue: string | null = options.senderIdValue ?? null;
    
    if (options.country) {
      const countryConfig = await getSenderConfigForCountry(options.country);
      if (countryConfig) {
        senderId = countryConfig.senderId as any;
        senderIdValue = countryConfig.senderIdValue;
        console.log(`[BulkGate] Using country config for ${options.country}: sender_id=${senderId}, value=${senderIdValue || '(none)'}`);
      }
    }
    
    // Build payload - only include sender_id_value if needed for this sender type
    const payload: Record<string, any> = {
      application_id: config.applicationId,
      application_token: config.applicationToken,
      number: options.number.replace(/\s+/g, ""),
      text: options.text,
      country: options.country || null,
      unicode: options.unicode ? "yes" : "no",
      sender_id: senderId,
      schedule: options.schedule || null,
      tag: options.tag || null,
    };
    
    // Only add sender_id_value if this sender type requires it
    if (!SENDER_TYPES_WITHOUT_VALUE.includes(senderId) && senderIdValue) {
      payload.sender_id_value = senderIdValue;
    }

    console.log(`[BulkGate] Sending promotional SMS to ${options.number} with sender_id=${senderId}${senderIdValue ? `, value=${senderIdValue}` : ''}`);

    const response = await fetch(BULKGATE_PROMOTIONAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.data && result.data.status === "accepted") {
      console.log(`[BulkGate] Promotional SMS sent successfully: ${result.data.sms_id}`);
      return {
        success: true,
        smsId: result.data.sms_id,
        partIds: result.data.part_id,
        number: result.data.number,
      };
    } else {
      console.error(`[BulkGate] Promotional SMS send failed:`, result);
      return {
        success: false,
        error: result.error || "Neznáma chyba",
        errorCode: result.code || 500,
      };
    }
  } catch (error) {
    console.error(`[BulkGate] Network error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Chyba siete",
      errorCode: 500,
    };
  }
}

/**
 * Get credit balance
 */
export async function getCredit(): Promise<{ success: boolean; credit?: number; currency?: string; error?: string }> {
  const config = getConfig();
  
  if (!config.applicationId || !config.applicationToken) {
    return {
      success: false,
      error: "BulkGate nie je nakonfigurovaný",
    };
  }

  try {
    const response = await fetch(
      `https://portal.bulkgate.com/api/1.0/simple/info?application_id=${config.applicationId}&application_token=${config.applicationToken}`,
      {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );

    const result = await response.json();

    if (result.data) {
      return {
        success: true,
        credit: result.data.credit,
        currency: result.data.currency,
      };
    } else {
      return {
        success: false,
        error: result.error || "Neznáma chyba",
      };
    }
  } catch (error) {
    console.error(`[BulkGate] Credit check error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Chyba siete",
    };
  }
}

/**
 * Process incoming webhook (delivery report or incoming SMS)
 */
export interface BulkGateWebhookData {
  type: "delivery_report" | "inbox";
  smsId?: string;
  status?: string;
  number?: string;
  text?: string;
  timestamp?: string;
  rawData: any;
}

export function parseWebhook(body: any): BulkGateWebhookData {
  if (body.status) {
    return {
      type: "delivery_report",
      smsId: body.smsid || body.sms_id,
      status: body.status,
      number: body.number,
      timestamp: body.timestamp,
      rawData: body,
    };
  }
  
  return {
    type: "inbox",
    number: body.sender || body.number,
    text: body.message || body.text,
    timestamp: body.timestamp || new Date().toISOString(),
    rawData: body,
  };
}

/**
 * Get configuration status
 */
export function getBulkGateStatus() {
  const config = getConfig();
  return {
    configured: isBulkGateConfigured(),
    applicationId: config.applicationId ? `${config.applicationId.substring(0, 4)}...` : null,
    webhookUrl: config.webhookUrl,
  };
}
