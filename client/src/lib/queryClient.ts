import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    if (res.status === 401) {
      throw new Error(`Session expired. Please refresh the page and log in again.`);
    }
    try {
      const json = JSON.parse(text);
      if (json.error) {
        throw new Error(json.error);
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
    const body = data ? JSON.stringify(data) : undefined;
    console.log(`[apiRequest] Body length: ${body?.length || 0}`);
    
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body,
      credentials: "include",
    });

    console.log(`[apiRequest] Response status: ${res.status}`);
    await throwIfResNotOk(res);
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
