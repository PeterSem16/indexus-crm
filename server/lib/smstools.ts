/**
 * SMSTOOLS SMS gateway integration.
 *
 * The API key is deliberately read at call time from the environment so it
 * never enters the database, client bundle, or application logs.
 */

const SMSTOOLS_SEND_URL = "https://api.smstools.sk/3/send_batch";
const SMSTOOLS_CREDIT_URL = "https://api.smstools.sk/3/credit_remaining";

export interface SmsToolsSendOptions {
  number: string;
  text: string;
  senderText?: string | null;
  virtualNumber?: string | null;
  schedule?: string;
}

export interface SmsToolsSendResult {
  success: boolean;
  smsId?: string;
  batchId?: string;
  number?: string;
  error?: string;
  errorCode?: number;
}

export interface SmsToolsState {
  msgId: string;
  stateType?: string;
  stateId?: string;
  permanent?: boolean;
  raw: unknown;
}

function getApiKey(): string | undefined {
  const key = process.env.SMSTOOLS_API_KEY?.trim();
  return key || undefined;
}

export function isSmsToolsConfigured(): boolean {
  return Boolean(getApiKey());
}

export function normalizeSlovakPhone(input: string): string {
  const compact = String(input || "").trim().replace(/[^\d+]/g, "");
  if (!compact) throw new Error("Telefónne číslo je prázdne");

  let normalized: string;
  if (compact.startsWith("00")) normalized = `+${compact.slice(2)}`;
  else if (compact.startsWith("+")) normalized = compact;
  else if (compact.startsWith("421")) normalized = `+${compact}`;
  else if (compact.startsWith("0")) normalized = `+421${compact.slice(1)}`;
  else throw new Error("SMSTOOLS podporuje iba slovenské telefónne čísla (+421)");

  if (!/^\+421\d{9}$/.test(normalized)) {
    throw new Error("Neplatné slovenské telefónne číslo pre SMSTOOLS");
  }
  return normalized;
}

function normalizeSenderText(value: string | null | undefined): string {
  const sender = (value || process.env.SMSTOOLS_SENDER_TEXT || "CBC").trim();
  if (!sender || sender.length > 11 || !/^[\x20-\x7E]+$/.test(sender) || /\s/.test(sender)) {
    throw new Error("SMSTOOLS odosielateľ musí mať 1–11 znakov bez diakritiky a medzier");
  }
  return sender;
}

function errorMessage(body: any, status: number): string {
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  return note || id || `SMSTOOLS API chyba (${status})`;
}

export async function sendSmsTools(options: SmsToolsSendOptions): Promise<SmsToolsSendResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: "SMSTOOLS nie je nakonfigurovaný", errorCode: 500 };
  }

  let number: string;
  let senderText: string;
  try {
    number = normalizeSlovakPhone(options.number);
    senderText = normalizeSenderText(options.senderText);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Neplatné údaje SMS", errorCode: 400 };
  }

  const sender: Record<string, string> = { text: senderText };
  const virtualNumber = options.virtualNumber?.trim() || process.env.SMSTOOLS_VIRTUAL_NUMBER?.trim();
  if (virtualNumber) sender.phonenr = virtualNumber;

  const body: Record<string, unknown> = {
    auth: { apikey: apiKey },
    data: {
      message: options.text,
      sender,
      recipients: [{ phonenr: number }],
    },
  };
  if (options.schedule) (body.data as Record<string, unknown>).schedule = options.schedule;

  try {
    const response = await fetch(SMSTOOLS_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8", "Cache-Control": "no-cache" },
      body: JSON.stringify(body),
    });
    const result: any = await response.json().catch(() => null);
    const accepted = result?.data?.recipients?.accepted;
    if (response.ok && result?.id === "OK" && Array.isArray(accepted) && accepted.length > 0) {
      const acceptedRecipient = accepted[0];
      return {
        success: true,
        smsId: acceptedRecipient?.msg_id != null ? String(acceptedRecipient.msg_id) : undefined,
        batchId: result.data?.batch_id != null ? String(result.data.batch_id) : undefined,
        number: acceptedRecipient?.phonenr || number,
      };
    }
    return { success: false, error: errorMessage(result, response.status), errorCode: response.status || 502 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Chyba siete pri volaní SMSTOOLS",
      errorCode: 502,
    };
  }
}

export async function getSmsToolsCredit(): Promise<{
  success: boolean;
  credit?: number;
  currency?: string;
  error?: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) return { success: false, error: "SMSTOOLS nie je nakonfigurovaný" };

  try {
    const response = await fetch(SMSTOOLS_CREDIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8", "Cache-Control": "no-cache" },
      body: JSON.stringify({ auth: { apikey: apiKey } }),
    });
    const result: any = await response.json().catch(() => null);
    const value = result?.data?.credit ?? result?.data?.credit_value ?? result?.credit;
    if (response.ok && result?.id === "OK" && value != null) {
      return {
        success: true,
        credit: Number(value),
        currency: result?.data?.currency || result?.currency,
      };
    }
    return { success: false, error: errorMessage(result, response.status) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Chyba siete pri kontrole kreditu" };
  }
}

export function verifySmsToolsCallback(req: {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}): boolean {
  const configuredToken = process.env.SMSTOOLS_CALLBACK_TOKEN?.trim();
  const headerToken = req.headers["x-smstools-callback-token"];
  const queryToken = req.query?.token;
  if (configuredToken) {
    return String(headerToken || queryToken || "") === configuredToken;
  }

  const configuredUser = process.env.SMSTOOLS_CALLBACK_USER?.trim();
  const configuredPassword = process.env.SMSTOOLS_CALLBACK_PASSWORD;
  if (!configuredUser || !configuredPassword) return false;
  const authorizationValue = req.headers.authorization;
  const authorization = Array.isArray(authorizationValue) ? authorizationValue[0] : authorizationValue;
  if (!authorization?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    return separator >= 0 &&
      decoded.slice(0, separator) === configuredUser &&
      decoded.slice(separator + 1) === configuredPassword;
  } catch {
    return false;
  }
}

export function parseSmsToolsStates(body: any): SmsToolsState[] {
  const states = Array.isArray(body?.sms_state) ? body.sms_state : [];
  return states
    .filter((item: any) => item?.msg_id != null)
    .map((item: any) => ({
      msgId: String(item.msg_id),
      stateType: typeof item.state_type === "string" ? item.state_type : undefined,
      stateId: typeof item.state_id === "string" ? item.state_id : undefined,
      permanent: item.permanent === true || item.permanent === "TRUE",
      raw: item,
    }));
}

export function mapSmsToolsState(state: SmsToolsState): "pending" | "sent" | "delivered" | "failed" {
  const value = `${state.stateType || ""} ${state.stateId || ""}`.toUpperCase();
  if (/(CHYB|NEDORUC|REJECT|EXPIRE|ZAMIET|FAILED)/.test(value)) return "failed";
  if (/(DORUC|DELIVER)/.test(value)) return "delivered";
  if (/(ODOSIEL|SEND|PREBIEHA|PROCESS)/.test(value)) return "sent";
  return "pending";
}