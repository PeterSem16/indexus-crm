import type { Express, Request, Response, RequestHandler } from "express";
import type { MissionFunnelReport } from "../../shared/mission-funnel";

type Source = "funnel" | "performance";
const sources = new Map<Source, RequestHandler>();
const attainmentProjection = Symbol("Mission email first attainments");
export const missionReportUsesAttainments = (request: unknown) => Boolean((request as any)[attainmentProjection]);
/** The browser and scheduler use the exact same report handlers, without a
 * loopback HTTP request, trusted header, session cookie or second SQL implementation. */
export function registerMissionReportGet(app: Express, path: string, auth: RequestHandler, kind: Source, handler: RequestHandler) {
  sources.set(kind, handler);
  app.get(path, auth, handler);
}
export interface MissionPerformanceRow {
  agentId: string; agentName: string; newCalls: number; repeatCalls: number;
  emails: number; sms: number; nonstandardTasks: number;
  talkSeconds: number; ringSeconds: number; totalSeconds: number;
}
export async function readMissionReport<T = MissionFunnelReport>(kind: Source, userId: string, campaignId: string, query: Record<string, string> = {}): Promise<T> {
  const handler = sources.get(kind);
  if (!handler) throw new Error("Report source not registered");
  let status = 200, value: T | undefined, responseSent = false;
  const response = {
    status(code: number) { status = code; return response; },
    json(body: T) { value = body; responseSent = true; return response; },
  };
  await handler({
    params: { id: campaignId }, query,
    session: { user: { id: userId }, userId }, user: { id: userId },
    [attainmentProjection]: kind === "funnel",
  } as unknown as Request, response as unknown as Response, error => { if (error) throw error; });
  if (!responseSent || status !== 200) throw new Error("Mission report unavailable or unauthorized");
  return value as T;
}
