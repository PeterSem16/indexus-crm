/** Prepared routes only. Importing this file never activates production routing. */
export const THREE_SERVICE_PROFILES = Object.freeze({
  "email.summary": Object.freeze({
    model: "indexus-email-summary:v1", temperature: 0.5, max_tokens: 1500,
    format: "text" as const, timeoutMs: null,
  }),
  "task.checklist": Object.freeze({
    model: "indexus-task-checklist:v1", temperature: 0.2, max_tokens: 1000,
    format: "json_object" as const, timeoutMs: 15_000,
  }),
  "task.resolution": Object.freeze({
    model: "indexus-task-resolution:v1", temperature: 0.2, max_tokens: 400,
    format: "json_object" as const, timeoutMs: 15_000,
  }),
});
export type ThreeService = keyof typeof THREE_SERVICE_PROFILES;
export function threeServiceProfile(service?: string) {
  return service && Object.hasOwn(THREE_SERVICE_PROFILES, service)
    ? THREE_SERVICE_PROFILES[service as ThreeService] : undefined;
}
export const THREE_SERVICE_CANDIDATE_ROUTES = Object.freeze(Object.fromEntries(
  Object.entries(THREE_SERVICE_PROFILES).map(([service, profile]) =>
    [service, Object.freeze({ provider: "internal" as const, model: profile.model, enabled: true })]),
));
