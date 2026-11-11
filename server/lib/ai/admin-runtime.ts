import type { AIPersistedSettings } from "../../../shared/ai-settings";
let current: { version: number; value: AIPersistedSettings } | null = null;
let reload: (() => Promise<void>) | null = null;
export function aiAdminSnapshot() { return current; }
export function applyAIAdminSnapshot(version: number, value: AIPersistedSettings) {
  current = { version, value: Object.freeze({
    gateway: Object.freeze({ ...value.gateway }),
    routes: Object.freeze(Object.fromEntries(Object.entries(value.routes).map(([key, route]) => [key, Object.freeze({ ...route })]))),
  }) };
}
export function installAIAdminReload(callback: () => Promise<void>) { reload = callback; }
export async function refreshAIAdminSnapshot() { if (reload) await reload(); }

/** Delay admission until the authoritative DB snapshot has been read.
 * Keep both raw-response helpers and await/then/stream semantics of the SDK.
 * Never catch a provider failure and choose a second provider.
 */
export function deferredAIRequest(select: () => Promise<{ request: any }>): any {
  const selected = select();
  void selected.catch(() => {});
  let data: Promise<any> | undefined;
  const parsed = () => data ??= selected.then(({ request }) => request);
  return {
    then: (...args: any[]) => parsed().then(...args),
    catch: (...args: any[]) => parsed().catch(...args),
    finally: (...args: any[]) => parsed().finally(...args),
    asResponse: () => selected.then(({ request }) => request.asResponse()),
    withResponse: () => selected.then(({ request }) => request.withResponse()),
    [Symbol.toStringTag]: "Promise",
  };
}
