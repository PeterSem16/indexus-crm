/** Gateway v1 text contract. Never include provider payloads in error messages. */
export class InternalAIError extends Error {
  constructor(readonly code: string, readonly status = 502) { super(code); }
}
export const INTERNAL_TEXT_MODELS = Object.freeze(["indexus-document-audio:latest"]);
export const INTERNAL_REQUEST_LIMIT = 512 * 1024;
export const INTERNAL_RESPONSE_LIMIT = 2 * 1024 * 1024;
const record = (value: any): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const technicalId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(value);
const reject = (code: string, status = 422): never => { throw new InternalAIError(code, status); };

export interface InternalModel {
  id: string;
  revision: string;
  outputFormats: string[];
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
}

export function validateInternalRequest(body: any, allowedModels: readonly string[]) {
  if (!record(body) || Object.keys(body).some(key =>
    !["model", "messages", "temperature", "max_tokens", "response_format", "stream"].includes(key)))
    reject("ai_internal_unsupported_request");
  if (!technicalId(body.model) || !allowedModels.includes(body.model)) reject("ai_internal_model_not_allowed");
  if (body.stream !== undefined && body.stream !== false) reject("ai_internal_streaming_not_supported");
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.some((message: any) =>
    !record(message) || Object.keys(message).some(key => !["role", "content"].includes(key)) ||
    !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string"))
    reject("ai_internal_text_only");
  if (body.temperature !== undefined && (typeof body.temperature !== "number" ||
    !Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2))
    reject("ai_internal_invalid_temperature");
  if (body.max_tokens !== undefined && (!Number.isSafeInteger(body.max_tokens) || body.max_tokens < 1))
    reject("ai_internal_invalid_token_limit");
  let format = "text";
  if (body.response_format !== undefined) {
    if (!record(body.response_format) || Object.keys(body.response_format).some(key => key !== "type") ||
      !["text", "json_object"].includes(body.response_format.type))
      reject("ai_internal_output_format_not_verified");
    format = body.response_format.type;
  }
  if (Buffer.byteLength(JSON.stringify(body)) > INTERNAL_REQUEST_LIMIT) reject("ai_internal_request_too_large", 413);
  return { model: body.model as string, format, maxTokens: body.max_tokens as number | undefined };
}

export function validateInternalDiscovery(models: any, capabilities: any, allowed: readonly string[]): InternalModel[] {
  if (!record(models) || models.object !== "list" || !Array.isArray(models.data) ||
    models.data.some((item: any) => !record(item) || !technicalId(item.id)) ||
    !record(capabilities) || capabilities.apiVersion !== "1" || !Array.isArray(capabilities.models))
    reject("ai_internal_invalid_discovery", 502);
  const listed = new Set(models.data.map((item: any) => item.id));
  if (listed.size !== models.data.length) reject("ai_internal_invalid_discovery", 502);
  const seen = new Set<string>();
  const result: InternalModel[] = [];
  for (const item of capabilities.models) {
    if (!record(item) || !technicalId(item.id) || seen.has(item.id) || !technicalId(item.revision) ||
      !Array.isArray(item.operations) || !item.operations.every((value: unknown) => typeof value === "string") ||
      !Array.isArray(item.inputModalities) || !item.inputModalities.every((value: unknown) => typeof value === "string") ||
      !Array.isArray(item.outputFormats) || !item.outputFormats.every((value: unknown) => typeof value === "string") ||
      typeof item.streaming !== "boolean")
      reject("ai_internal_invalid_capabilities", 502);
    seen.add(item.id);
    for (const limit of [item.maxInputTokens, item.maxOutputTokens])
      if (limit !== null && limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))
        reject("ai_internal_invalid_capabilities", 502);
    if (allowed.includes(item.id) && listed.has(item.id) &&
      item.operations.includes("chat.completions") && item.inputModalities.includes("text"))
      result.push({ id: item.id, revision: item.revision,
        outputFormats: item.outputFormats.filter((format: string) => ["text", "json_object"].includes(format)),
        maxInputTokens: item.maxInputTokens ?? null, maxOutputTokens: item.maxOutputTokens ?? null });
  }
  return result;
}

export function validateInternalCompletion(value: any, request: ReturnType<typeof validateInternalRequest>) {
  if (!record(value) || value.object !== "chat.completion" || !technicalId(value.id) ||
    value.model !== request.model || !Array.isArray(value.choices) || value.choices.length !== 1)
    reject("ai_internal_invalid_completion", 502);
  const choice = value.choices[0];
  if (!record(choice) || choice.index !== 0 || !record(choice.message) ||
    choice.message.role !== "assistant" || typeof choice.message.content !== "string" ||
    !choice.message.content.trim() || choice.message.tool_calls !== undefined || choice.message.refusal)
    reject("ai_internal_invalid_completion", 502);
  if (choice.finish_reason !== "stop") reject("ai_internal_incomplete_completion", 502);
  if (request.format === "json_object") {
    let parsed: unknown;
    try { parsed = JSON.parse(choice.message.content); } catch { reject("ai_internal_invalid_json", 502); }
    if (!record(parsed)) reject("ai_internal_invalid_json", 502);
  }
  // Drop uncontracted debug fields/headers. Preserve model text for existing application validators.
  const output: Record<string, unknown> = {
    id: value.id, object: "chat.completion", model: value.model,
    choices: [{ index: 0, message: { role: "assistant", content: choice.message.content }, finish_reason: "stop" }],
  };
  if (Number.isSafeInteger(value.created) && value.created >= 0) output.created = value.created;
  if (value.usage !== undefined) {
    if (!record(value.usage) || ["prompt_tokens", "completion_tokens", "total_tokens"].some(key =>
      !Number.isSafeInteger(value.usage[key]) || value.usage[key] < 0))
      reject("ai_internal_invalid_usage", 502);
    output.usage = { prompt_tokens: value.usage.prompt_tokens, completion_tokens: value.usage.completion_tokens,
      total_tokens: value.usage.total_tokens };
  }
  return output;
}
