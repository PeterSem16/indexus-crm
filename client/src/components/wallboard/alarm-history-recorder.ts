import type { WallboardAlarmIncident } from "@shared/wallboard-alarms";
import type { WallboardAlarmHistoryEntry } from "@shared/wallboard-alarm-history";

export const HISTORY_HEARTBEAT_MS = 15_000;
type EndReason = NonNullable<WallboardAlarmHistoryEntry["endReason"]>;
type Observation = { since: number; lastSeen: number; entry: WallboardAlarmHistoryEntry };
const iso = (time: number) => new Date(time).toISOString();
function newIncidentId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Each open observer owns its incidents. No names, rule IDs, agents or call data
 * leave this recorder. A lost observer is never reported as a recovered alarm.
 */
export class AlarmHistoryRecorder {
  private active = new Map<string, Observation>();

  constructor(
    private emit: (entry: WallboardAlarmHistoryEntry) => void,
    private newId: () => string = newIncidentId,
  ) {}

  observe(
    incidents: WallboardAlarmIncident[],
    now: number,
    removedReason: (ruleId: string) => EndReason,
  ) {
    const incoming = new Map(incidents.map(incident => [incident.ruleId, incident]));
    for (const [ruleId, observation] of this.active) {
      const next = incoming.get(ruleId);
      if (now - observation.lastSeen > HISTORY_HEARTBEAT_MS * 3) {
        // Suspended browser timers are not evidence of continuous observation.
        this.finish(ruleId, "observation_stopped");
      } else if (!next || next.since !== observation.since) {
        this.finish(ruleId, removedReason(ruleId), now);
      }
    }
    for (const incident of incidents) {
      let observation = this.active.get(incident.ruleId);
      if (!observation) {
        const entry: WallboardAlarmHistoryEntry = {
          incidentId: this.newId(), revision: 1, type: incident.type,
          threshold: incident.threshold, startedAt: iso(Math.max(incident.since, now)),
          lastObservedAt: iso(Math.max(incident.since, now)),
          endedAt: null, endReason: null, acknowledgedAt: null,
          mutedAt: null, mutedUntil: null,
        };
        observation = { since: incident.since, lastSeen: Math.max(incident.since, now), entry };
        this.active.set(incident.ruleId, observation);
        this.emit({ ...entry });
      } else {
        observation.lastSeen = Math.max(observation.lastSeen, now);
        if (now - Date.parse(observation.entry.lastObservedAt) >= HISTORY_HEARTBEAT_MS) {
          this.update(observation, { lastObservedAt: iso(now) });
        }
      }
    }
  }

  silence(ruleId: string, now: number, mute: boolean) {
    const observation = this.active.get(ruleId);
    if (!observation) return;
    const at = Math.max(now, observation.lastSeen);
    observation.lastSeen = at;
    if (!mute && observation.entry.acknowledgedAt) return;
    this.update(observation, mute
      ? { lastObservedAt: iso(at), mutedAt: iso(at), mutedUntil: iso(at + 300_000) }
      : { lastObservedAt: iso(at), acknowledgedAt: iso(at) });
  }

  close() {
    for (const ruleId of this.active.keys()) this.finish(ruleId, "observation_stopped");
  }

  private finish(ruleId: string, reason: EndReason, now?: number) {
    const observation = this.active.get(ruleId);
    if (!observation) return;
    // Only a fresh, healthy evaluation can establish the instant of recovery.
    const end = reason === "recovered" && now !== undefined
      ? iso(Math.max(now, observation.lastSeen))
      : iso(observation.lastSeen);
    this.update(observation, { lastObservedAt: end, endedAt: end, endReason: reason });
    this.active.delete(ruleId);
  }

  private update(observation: Observation, changes: Partial<WallboardAlarmHistoryEntry>) {
    observation.entry = { ...observation.entry, ...changes, revision: observation.entry.revision + 1 };
    this.emit({ ...observation.entry });
  }
}

/** Bounded, scope-bound, revision-coalescing retry queue; never persisted on disk. */
export class AlarmHistoryWriter {
  private pending = new Map<string, WallboardAlarmHistoryEntry>();
  private sending = false;
  private forbidden = false;
  private overflowed = false;
  private disposed = false;
  private retryAt = 0;

  constructor(
    private endpoint: string,
    private onError: (failed: boolean) => void,
    private request: typeof fetch = fetch,
  ) {}

  enqueue(entry: WallboardAlarmHistoryEntry) {
    if (this.forbidden || this.disposed) return;
    if (!this.pending.has(entry.incidentId) && this.pending.size >= 100) {
      this.overflowed = true;
      this.onError(true);
      return;
    }
    const previous = this.pending.get(entry.incidentId);
    if (!previous || entry.revision > previous.revision) this.pending.set(entry.incidentId, entry);
  }

  async flush(keepalive = false): Promise<void> {
    if (this.forbidden || !this.pending.size || (!keepalive && (this.sending || Date.now() < this.retryAt))) return;
    const entries = [...this.pending.values()];
    if (!keepalive) this.sending = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      // Native browser fetch must not receive the writer as its `this` value.
      const request = this.request;
      const response = await request(this.endpoint, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }), signal: controller.signal, keepalive,
      });
      if (response.status === 401 || response.status === 403) {
        this.forbidden = true;
        this.pending.clear();
      }
      if (!response.ok) throw new Error("History persistence failed");
      for (const entry of entries) {
        if (this.pending.get(entry.incidentId)?.revision === entry.revision) this.pending.delete(entry.incidentId);
      }
      if (!this.disposed) this.onError(this.overflowed);
    } catch {
      this.retryAt = Date.now() + HISTORY_HEARTBEAT_MS;
      if (!this.disposed) this.onError(true);
    } finally {
      clearTimeout(timeout);
      if (!keepalive) this.sending = false;
    }
  }

  dispose() {
    this.disposed = true;
    void this.flush(true);
  }
}