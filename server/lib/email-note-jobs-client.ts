/** Supplemental draft notes only. Never uses or reconfigures the AI service router. */
export class EmailNoteError extends Error {
  constructor(public code: string, public status = 502) { super(code); }
}
export type GatewayNoteJob = {
  job_id: string; status: "pending" | "processing" | "completed" | "review_required" | "failed";
  note?: string; review_required: boolean; error?: unknown;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseNoteJob(value: unknown, expectedId?: string): GatewayNoteJob {
  const v = value as GatewayNoteJob | null;
  if (!v || typeof v.job_id !== "string" || !uuid.test(v.job_id) ||
    (expectedId !== undefined && v.job_id !== expectedId) ||
    !["pending", "processing", "completed", "review_required", "failed"].includes(v.status) ||
    typeof v.review_required !== "boolean")
    throw new EmailNoteError("invalid_gateway_response");
  if (["completed", "review_required"].includes(v.status) &&
    (typeof v.note !== "string" || v.note.trim().length < 12 || v.note.length > 20_000 ||
      !v.note.trim() || /Automatické zhrnutie správy nie je dostupné/i.test(v.note)))
    throw new EmailNoteError("invalid_gateway_note");
  return v;
}
export function createEmailNoteJobsClient(options: {
  token: () => string | undefined; fetch?: typeof fetch; timeoutMs?: number;
}) {
  const transport = options.fetch ?? fetch;
  async function request(id?: string, customerText?: string) {
    const token = options.token();
    if (!token || token !== token.trim() || /\s/.test(token))
      throw new EmailNoteError("gateway_not_configured", 503);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
      const response = await transport(
        `https://ai.cordbloodcenter.com/gateway/v1/email-notes/jobs${id ? "/" + encodeURIComponent(id) : ""}`, {
          method: id ? "GET" : "POST", redirect: "error", signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          ...(id ? {} : { body: JSON.stringify({ customer_text: customerText }) }),
        });
      if (response.status !== (id ? 200 : 202))
        throw new EmailNoteError(response.status === 401 || response.status === 403 ?
          "gateway_authentication_failed" : "gateway_unavailable");
      if (!response.body) throw new EmailNoteError("invalid_gateway_response");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 128_000) throw new EmailNoteError("invalid_gateway_response");
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      let data: unknown;
      try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { throw new EmailNoteError("invalid_gateway_response"); }
      const job = parseNoteJob(data, id);
      if (!id && job.status !== "pending") throw new EmailNoteError("invalid_gateway_response");
      return job;
    } catch (error) {
      if (error instanceof EmailNoteError) throw error;
      throw new EmailNoteError(controller.signal.aborted ? "gateway_timeout" : "gateway_unavailable");
    } finally { clearTimeout(timer); }
  }
  return {
    submit: (text: string) => request(undefined, text),
    poll: (id: string) => request(id),
  };
}
