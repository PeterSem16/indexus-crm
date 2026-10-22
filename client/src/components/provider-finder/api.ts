export async function finderApi<T>(url: string, method = "GET", data?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" },
    signal,
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || "request_failed"), { code: body.error, status: response.status });
  return body;
}
