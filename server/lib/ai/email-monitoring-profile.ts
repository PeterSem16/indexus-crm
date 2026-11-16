import { EMAIL_MONITORING_MODEL } from "../../../shared/ai-settings";

/** Prepared service-only profile; importing it does not change any route/settings. */
export const EMAIL_MONITORING_PROFILE = Object.freeze({
  service: "email.monitoring" as const,
  model: EMAIL_MONITORING_MODEL,
  baseURL: "http://10.9.2.140/gateway/",
  temperature: 0.1,
  max_tokens: 200,
  response_format: Object.freeze({ type: "json_object" as const }),
  stream: false as const,
});
