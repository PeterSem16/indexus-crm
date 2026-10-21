import type { StatusListExecutionMode } from "@shared/status-list-execution-policy";
type Attempt = { requestId: string; result?: any; pending?: Promise<any> };
/** Contact-local attempts survive transport errors and partial Batch retries. */
export function createStatusListExecutionClient() {
  const attempts = new Map<string, Attempt>();
  return {
    clear: () => attempts.clear(),
    async send(url: string, body: Record<string, any>, mode: StatusListExecutionMode, retain = false, method = "POST") {
      const command = { ...body, executionMode: mode, commit: true };
      const key = `${method}:${url}:${JSON.stringify(command)}`;
      let attempt = attempts.get(key);
      if (!attempt) { attempt = { requestId: crypto.randomUUID() }; attempts.set(key, attempt); }
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
