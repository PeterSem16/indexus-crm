import OpenAI, { type ClientOptions } from "openai";

export type AIClientOptions = Pick<ClientOptions, "timeout" | "maxRetries">;
export interface AIProviderAdapter {
  readonly id: "openai" | "internal";
  isAvailable(): boolean;
  createClient(options: AIClientOptions): OpenAI;
  chatProbe(body: Record<string, unknown>): Promise<Response>;
}

/** The only place that reads credentials or constructs a provider SDK client. */
export const openAIAdapter: AIProviderAdapter = {
  id: "openai",
  isAvailable: () => !!process.env.OPENAI_API_KEY,
  createClient: options => new OpenAI({ apiKey: process.env.OPENAI_API_KEY, ...options }),
  // Preserve the existing Beratung health probe's raw HTTP/error and zero-retry semantics.
  chatProbe: body => fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }),
};
