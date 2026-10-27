import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { acknowledgeCallbackRequest, callbackRequestIdentity } from "./callback-request-identity";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    if (res.status === 401) {
      throw new Error(`Session expired. Please refresh the page and log in again.`);
    }
    try {
      const json = JSON.parse(text);
      if (json.error) {
        const err = new Error(json.error);
        (err as any).status = res.status;
        if (json.code) (err as any).code = json.code;
        if (json.detail) (err as any).detail = json.detail;
        throw err;
      }
    } catch (e) {
      if (e instanceof Error && !e.message.startsWith("{")) {
        throw e;
      }
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`[apiRequest] ${method} ${url}`, data ? "with data" : "no data");
  try {
    const callbackRun = method.toUpperCase() === "POST" &&
      /^\/api\/campaigns\/[^/]+\/contacts\/[^/]+\/status-list-actions\/[^/]+\/run$/.test(url);
    const payload = callbackRun ? { ...(data as Record<string, unknown>),
      callbackEventId: callbackRequestIdentity(url, sessionStorage) } : data;
    const body = payload ? JSON.stringify(payload) : undefined;
    console.log(`[apiRequest] Body length: ${body?.length || 0}`);
    
    const res = await fetch(url, {
      method,
      headers: payload ? { "Content-Type": "application/json" } : {},
      body,
      credentials: "include",
    });

    console.log(`[apiRequest] Response status: ${res.status}`);
    await throwIfResNotOk(res);
    if (callbackRun) acknowledgeCallbackRequest(url, sessionStorage);
    return res;
  } catch (error) {
    console.error(`[apiRequest] Error in ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from queryKey, handling objects as query params
    let url = "";
    const queryParams: Record<string, string> = {};
    
    for (const part of queryKey) {
      if (typeof part === "string") {
        url = url ? `${url}/${part}` : part;
      } else if (typeof part === "object" && part !== null) {
        // Convert object to query params
        for (const [key, value] of Object.entries(part)) {
          if (Array.isArray(value)) {
            queryParams[key] = value.join(",");
          } else if (value !== undefined && value !== null) {
            queryParams[key] = String(value);
          }
        }
      }
    }
    
    // Append query params if any
    const queryString = Object.keys(queryParams).length > 0 
      ? `?${new URLSearchParams(queryParams).toString()}`
      : "";
    
    const res = await fetch(`${url}${queryString}`, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Catalogs may change while a compose/editor page remains open. Apply to every
// typed/country/language variant, including native email/SMS/contact composers.
// Keep the rest of the CRM's existing cache policy unchanged.
queryClient.setQueryDefaults(["/api/message-templates"], {
  staleTime: 0,
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
});
