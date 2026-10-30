import {
  emptyFunnelConfig, funnelSteps, funnelExceptions,
  type FunnelConfig, type FunnelFilters, type FunnelItem, type FunnelMember,
  type FunnelSource, type FunnelStep, type MissionFunnelReport,
} from "../../shared/mission-funnel";

export interface FunnelClinic {
  id: string; name: string; representativeId: string | null; referred: boolean;
}
export interface FunnelEnrollment { id: string; clinicId: string }
export interface FunnelEvent { id: string; contactId: string; itemId: string; confirmed: boolean; at: string }
export interface FunnelState { contactId: string; itemId: string; at: string }
export interface FunnelCall {
  id: string; clinicId: string | null; contactId: string | null;
  direction: string; status: string; at: string; answeredAt: string | null; duration: number;
  attemptAt?: string | null;
  sipCallId?: string | null;
}
export interface FunnelInput {
  clinics: FunnelClinic[]; enrollments: FunnelEnrollment[]; events: FunnelEvent[];
  states: FunnelState[]; calls: FunnelCall[]; config?: FunnelConfig; items: FunnelItem[];
  absenceReturns?: Record<string, string>;
}
interface Milestone { at: string | null; evidenceDate: string | null; basis: FunnelMember["basis"]; inferred: boolean }
const percentage = (n: number | null, d: number | null) => n !== null && d !== null && d > 0 ? Math.round(n / d * 10000) / 100 : null;
export const funnelDay = (value: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));
const validDate = (value: string | null | undefined): value is string => Boolean(value && Number.isFinite(Date.parse(value)));
const earliest = (values: string[]) => values.filter(validDate).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
function plusMonths(date: string | null, months: number) {
  if (!date) return null;
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}

/** Pure projection. Never writes operational state or synthesizes historical dates. */
export function computeMissionFunnel(input: FunnelInput, filters: FunnelFilters = {}, now = new Date()): Omit<MissionFunnelReport, "missionName" | "canConfigure"> {
  const config = input.config ?? emptyFunnelConfig();
  const sources = config.sources;
  const has = (source: FunnelSource) => sources[source].length > 0;
  const rows = new Map<FunnelStep, Map<string, Milestone>>(funnelSteps.map(key => [key, new Map()]));
  const exceptions = new Map(funnelExceptions.map(key => [key, new Map<string, Milestone>()]));
  const eligible = input.clinics.filter(c => filters.referral === "yes" ? c.referred : filters.referral === "no" ? !c.referred : true);
  const clinics = new Map(eligible.map(c => [c.id, c]));
  const enrollment = new Map(input.enrollments.filter(c => clinics.has(c.clinicId)).map(c => [c.id, c.clinicId]));
  const quality = { clinics: clinics.size, cohort: 0, withoutAttempt: 0, provisional: 0, orphanCalls: 0,
    duplicateEnrollments: [...enrollment.values()].length - new Set(enrollment.values()).size, stateOnly: 0, unknownProposal: 0 };
  const local = new Map<string, Map<FunnelStep, Milestone>>();
  const current = new Map<string, Set<string>>();
  const historical = new Map<string, FunnelEvent[]>();
  const stateOnly = new Set<string>();
  const absenceReturns = new Map<string, string>();
  for (const event of input.events) {
    if (!enrollment.has(event.contactId) || !validDate(event.at)) continue;
    const events = historical.get(event.contactId) ?? [];
    events.push(event); historical.set(event.contactId, events);
  }
  const put = (target: Map<FunnelStep, Milestone>, step: FunnelStep, at: string | null, basis: Milestone["basis"], inferred = false) => {
    const old = target.get(step);
    if (old && (!old.inferred && inferred || old.inferred === inferred && (!at || old.at && Date.parse(old.at) <= Date.parse(at)))) return;
    target.set(step, { at, evidenceDate: at, basis, inferred });
  };
  const evaluate = (active: Set<string>, target: Map<FunnelStep, Milestone>, at: string | null, basis: Milestone["basis"]) => {
    const yes = (key: FunnelSource) => sources[key].some(id => active.has(id));
    for (const key of ["qualified", "agreed", "email", "sent", "received", "returned", "validated"] as const) {
      if (yes(key)) put(target, key, at, basis);
    }
    if (yes("proposalAccepted") && yes("agreed")) put(target, "wantsToSign", at, basis);
    if (yes("agreed")) {
      // SQL-like null semantics: an absent answer never proves != unaccepted.
      if (yes("proposalUnaccepted")) put(target, "withoutContract", at, basis);
      else if (yes("proposalAccepted") || yes("proposalOther")) put(target, "wantsContract", at, basis);
    }
    if (yes("activeWith") && yes("agreed") && (yes("proposalAccepted") || yes("proposalOther")) ||
        yes("activeWithout") && yes("agreed") && yes("proposalUnaccepted")) put(target, "cooperating", at, basis);
    if (target.has("cooperating") && yes("materials17") && yes("materials18") && yes("materials19")) put(target, "materials", at, basis);
  };
  for (const [contactId] of enrollment) {
    const milestones = new Map<FunnelStep, Milestone>();
    const events = (historical.get(contactId) ?? []).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
    const active = new Set<string>();
    // Evaluate simultaneous events as one batch. A radio replacement must not
    // create an artificial transient overlap based on arbitrary UUID ordering.
    for (let i = 0; i < events.length;) {
      const at = events[i].at, time = Date.parse(at);
      while (i < events.length && Date.parse(events[i].at) === time) {
        const e = events[i++]; e.confirmed ? active.add(e.itemId) : active.delete(e.itemId);
      }
      evaluate(active, milestones, at, "history");
    }
    // Current state is authoritative for current exceptions, but state rows
    // without a matching history are not backdated into a historical AND.
    const states = input.states.filter(s => s.contactId === contactId);
    const saved = new Set(states.map(s => s.itemId));
    if (states.some(s => !events.some(e => e.itemId === s.itemId))) {
      stateOnly.add(enrollment.get(contactId)!);
      evaluate(saved, milestones, null, "state");
    }
    current.set(contactId, saved);
    local.set(contactId, milestones);
  }
  quality.stateOnly = stateOnly.size;
  const clinicMilestones = new Map<string, Map<FunnelStep, Milestone>>();
  const cohort = new Set<string>();
  for (const clinic of eligible) {
    const own = input.calls.filter(call => call.clinicId === clinic.id && call.direction === "outbound").sort((a,b) => Date.parse(a.at)-Date.parse(b.at));
    const seenAttempts = new Set<string>();
    const attempts = own.filter(call => {
      if (!validDate(call.attemptAt) && !["ringing","answered","completed","busy","no_answer"].includes(call.status)) return false;
      const key = call.sipCallId || call.id;
      if (seenAttempts.has(key)) return false;
      seenAttempts.add(key);
      return true;
    });
    const first = earliest(attempts.map(c => c.attemptAt || c.at));
    const firstObserved = earliest(own.map(c => c.at));
    if (!first) quality.withoutAttempt++;
    else {
      const provisional = !attempts.every(c => validDate(c.attemptAt)) || Boolean(firstObserved && Date.parse(firstObserved) < Date.parse(first));
      if (provisional) quality.provisional++;
      const day = funnelDay(first);
      if ((!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)) cohort.add(clinic.id);
    }
    const result = new Map<FunnelStep, Milestone>();
    if (first) put(result, "dialed", first, "call");
    const connected = earliest(input.calls.filter(c => c.clinicId === clinic.id && validDate(c.answeredAt) && c.duration > 0).map(c => c.answeredAt!));
    if (connected) put(result, "connected", connected, "call");
    for (const [contactId, clinicId] of enrollment) {
      if (clinicId !== clinic.id) continue;
      const ownMilestones = local.get(contactId)!;
      const saved = current.get(contactId)!;
      const base: FunnelStep[] = ["connected","qualified","agreed"];
      for (let i = base.length - 1; i > 0; i--) {
        const source = ownMilestones.get(base[i]);
        if (!source) continue;
        for (let j = 0; j < i; j++) {
          if (ownMilestones.has(base[j])) continue;
          if (base[j] === "qualified" && sources.unqualified.some(id => saved.has(id))) continue;
          ownMilestones.set(base[j], { at: null, evidenceDate: source.at || source.evidenceDate, inferred: true, basis: "derived" });
        }
      }
      // Only a proven branch enables skipped contract predecessors.
      if (ownMilestones.has("wantsContract")) {
        const chain: FunnelStep[] = ["agreed","wantsContract","email","wantsToSign","sent","received","returned","validated"];
        for (let i = chain.length - 1; i > 0; i--) {
          const evidence = ownMilestones.get(chain[i]);
          if (!evidence) continue;
          for (let j = 0; j < i; j++) if (!ownMilestones.has(chain[j]) || ownMilestones.get(chain[j])!.inferred) {
            // An explicit considering answer is not a missing acceptance.
            if (chain[j] === "wantsToSign" && !ownMilestones.has("wantsToSign") &&
              sources.proposalOther.some(id => current.get(contactId)?.has(id))) continue;
            const evidenceDate = evidence.at || evidence.evidenceDate;
            const previous = ownMilestones.get(chain[j]);
            if (previous?.evidenceDate && (!evidenceDate || Date.parse(previous.evidenceDate) <= Date.parse(evidenceDate))) continue;
            ownMilestones.set(chain[j], { at: null, evidenceDate, inferred: true, basis: "derived" });
          }
        }
      }
      for (const [key, value] of ownMilestones) {
        const old = result.get(key);
        if (!old || old.inferred && !value.inferred || old.inferred === value.inferred && value.at && (!old.at || Date.parse(value.at) < Date.parse(old.at))) result.set(key, value);
      }
      for (const key of ["unqualified","refused","absent","wrongNumber","notWorking"] as const) {
        if (!sources[key].some(id => saved.has(id))) continue;
        if (key === "absent") {
          const returnDay = input.absenceReturns?.[contactId];
          if (returnDay && returnDay <= funnelDay(now.toISOString())) continue;
          if (returnDay) absenceReturns.set(clinic.id, returnDay);
        }
        const at = earliest((historical.get(contactId) ?? []).filter(e => e.confirmed && sources[key].includes(e.itemId)).map(e => e.at));
        exceptions.get(key)!.set(clinic.id, { at, evidenceDate: at, basis: at ? "history" : "state", inferred: false });
        if (key === "absent") exceptions.get("unreachable")!.set(clinic.id, { at, evidenceDate: at, basis: at ? "history" : "state", inferred: false });
      }
    }
    if (result.has("agreed") && !result.has("wantsContract") && !result.has("withoutContract")) quality.unknownProposal++;
    let streak = 0;
    for (const call of attempts) {
      if (["no_answer","busy"].includes(call.status) && !call.answeredAt) streak++;
      else streak = 0;
    }
    if (streak >= 5) exceptions.get("unreachable")!.set(clinic.id, { at: attempts.at(-1)!.at, evidenceDate: attempts.at(-1)!.at, basis: "call", inferred: false });
    clinicMilestones.set(clinic.id, result);
  }
  quality.cohort = cohort.size;
  quality.orphanCalls = input.calls.filter(c => !c.clinicId).length;
  for (const clinic of eligible) {
    if (clinic.representativeId) rows.get("assigned")!.set(clinic.id, { at: null, evidenceDate: null, basis: "current", inferred: false });
    if (!cohort.has(clinic.id)) continue;
    for (const [key, value] of clinicMilestones.get(clinic.id)!) rows.get(key)!.set(clinic.id, value);
  }
  const measurable: Record<FunnelStep, boolean> = {
    assigned: true, dialed: true, connected: true, qualified: has("qualified"), agreed: has("agreed"),
    wantsContract: has("agreed") && (has("proposalAccepted") || has("proposalOther")),
    withoutContract: has("agreed") && has("proposalUnaccepted"), email: has("email"),
    wantsToSign: has("agreed") && has("proposalAccepted"), sent: has("sent"), received: has("received"),
    returned: has("returned"), validated: has("validated"), cooperating: has("activeWith") || has("activeWithout"),
    materials: (has("activeWith") || has("activeWithout")) && has("materials17") && has("materials18") && has("materials19"),
  };
  const previous: Record<FunnelStep, FunnelStep | null> = {
    assigned: null, dialed: "assigned", connected: "dialed", qualified: "connected", agreed: "qualified",
    wantsContract: "agreed", withoutContract: "agreed", email: "wantsContract", wantsToSign: "email",
    sent: "wantsToSign", received: "sent", returned: "received", validated: "returned",
    cooperating: "agreed", materials: "cooperating",
  };
  const members = (map: Map<string, Milestone>): FunnelMember[] => [...map].map(([id, value]) => ({
    id, name: clinics.get(id)!.name, firstDate: value.at, evidenceDate: value.evidenceDate,
    inferred: value.inferred, basis: value.basis,
  })).sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const count = (key: FunnelStep) => measurable[key] || rows.get(key)!.size > 0 ? rows.get(key)!.size : null;
  return {
    version: "funnel-v04.1", generatedAt: now.toISOString(), timezone: "Europe/Bratislava", config, items: input.items,
    quality,
    rows: funnelSteps.map(key => {
      const values = members(rows.get(key)!);
      const total = count(key);
      return { key, total, direct: total === null ? null : values.filter(v => !v.inferred).length,
        inferred: total === null ? null : values.filter(v => v.inferred).length,
        previousPercent: percentage(total, previous[key] ? count(previous[key]!) : null),
        qualifiedPercent: key === "assigned" ? null : percentage(total, count("qualified")), members: values };
    }),
    exceptions: funnelExceptions.map(key => ({
      key, measurable: key === "unreachable" || has(key),
      members: members(new Map([...exceptions.get(key)!].filter(([id]) => cohort.has(id)))).map(m => ({
        ...m, returnDate: key === "refused" ? plusMonths(m.firstDate, 6) : key === "absent" ? absenceReturns.get(m.id) ?? null : null,
      })),
    })),
  };
}
