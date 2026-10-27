import type { StatusListExecutionMode } from "@shared/status-list-execution-policy";
type Attempt = { requestId: string; result?: any; pending?: Promise<any> };

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  // randomUUID is restricted to secure contexts, but getRandomValues also
  // works on intranet HTTP. Preserve UUID v4 entropy and retry identity there.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Contact-local attempts survive transport errors and partial Batch retries. */
export function createStatusListExecutionClient() {
  const attempts = new Map<string, Attempt>();
  return {
    clear: () => attempts.clear(),
    async send(url: string, body: Record<string, any>, mode: StatusListExecutionMode, retain = false, method = "POST") {
      const command = { ...body, executionMode: mode, commit: true };
      const key = `${method}:${url}:${JSON.stringify(command)}`;
      let attempt = attempts.get(key);
      if (!attempt) { attempt = { requestId: createRequestId() }; attempts.set(key, attempt); }
      if (attempt.result) return attempt.result;
      if (attempt.pending) return attempt.pending;
      const current = attempt;
      current.pending = (async () => {
        const response = await fetch(url, { method, credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...command, requestId: current.requestId }) });
        const data = await response.json();
        if (!response.ok && data?.ok !== false) throw new Error(data?.error || "status_list_save_failed");
        if (retain || data?.ok === false) current.result = data;
        else attempts.delete(key);
        return data;
      })();
      try { return await current.pending; }
      finally { current.pending = undefined; }
    },
  };
}
