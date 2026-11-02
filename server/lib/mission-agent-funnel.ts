import type {
  AgentFunnelComparison, AgentFunnelResult, FunnelMember, FunnelRow, FunnelStep,
} from "../../shared/mission-funnel";

export interface FunnelAgent { id: string; name: string }
const ratio = (n: number | null, d: number | null) =>
  n !== null && d !== null && d > 0 ? Math.round(n / d * 10000) / 100 : null;
const previous: Partial<Record<FunnelStep, FunnelStep>> = {
  connected: "dialed", qualified: "connected", agreed: "qualified",
  wantsContract: "agreed", withoutContract: "agreed", email: "wantsContract",
  wantsToSign: "email", sent: "wantsToSign", received: "sent", returned: "received",
  validated: "returned", cooperating: "agreed", materials: "cooperating",
};

/**
 * Partition already-computed clinic outcomes, NEVER replay an agent-filtered
 * event stream: that would lose cross-agent AND evidence or invent outcomes.
 */
export function computeMissionAgentFunnel(rows: FunnelRow[], agents: FunnelAgent[]): AgentFunnelComparison {
  const directory = new Map(agents.map(agent => [agent.id, agent.name]));
  const knownActor = (member: FunnelMember) => member.actorId && directory.has(member.actorId) ? member.actorId : null;
  const owner = new Map(rows.find(row => row.key === "dialed")?.members.map(member => [member.id, knownActor(member)]) ?? []);
  const build = (mode: "cohort" | "contribution"): AgentFunnelResult[] => {
    const groups = new Map<string | null, Map<FunnelStep, FunnelMember[]>>();
    // Include current scoped Mission agents even if they have no cohort activity.
    for (const agent of agents) groups.set(agent.id, new Map());
    for (const row of rows) {
      if (row.key === "assigned") continue; // representative != agent
      for (const member of row.members) {
        const actorId = mode === "cohort" ? owner.get(member.id) ?? null
          : member.inferred || !member.firstDate || !["call", "history"].includes(member.basis) ? null : knownActor(member);
        const group = groups.get(actorId) ?? new Map<FunnelStep, FunnelMember[]>();
        const members = group.get(row.key) ?? [];
        members.push(member);
        group.set(row.key, members);
        groups.set(actorId, group);
      }
    }
    return [...groups].map(([agentId, group]) => {
      const count = (key: FunnelStep) => {
        const source = rows.find(row => row.key === key);
        return !source || source.total === null || key === "assigned" ? null : group.get(key)?.length ?? 0;
      };
      return {
        agentId, agentName: agentId === null ? null : directory.get(agentId)!,
        clinicCount: new Set([...group.values()].flat().map(member => member.id)).size,
        rows: rows.map(row => {
          const members = group.get(row.key) ?? [];
          const total = count(row.key);
          return {
            key: row.key, total, members,
            direct: total === null ? null : members.filter(member => !member.inferred).length,
            inferred: total === null ? null : members.filter(member => member.inferred).length,
            missionPercent: row.key === "assigned" ? null : ratio(total, row.total),
            previousPercent: mode === "cohort" ? ratio(total, previous[row.key] ? count(previous[row.key]!) : null) : null,
            qualifiedPercent: mode === "cohort" && row.key !== "assigned" ? ratio(total, count("qualified")) : null,
          };
        }),
      };
    }).sort((a, b) => Number(a.agentId === null) - Number(b.agentId === null) ||
      (a.agentName ?? "").localeCompare(b.agentName ?? "") || (a.agentId ?? "").localeCompare(b.agentId ?? ""));
  };
  return { version: "agent-funnel-v1", cohort: build("cohort"), contribution: build("contribution") };
}
