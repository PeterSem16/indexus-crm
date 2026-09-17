import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Maximize2, MonitorUp, RefreshCw, X, ArrowLeft } from "lucide-react";
import type { WallboardSnapshot } from "@shared/wallboard";
import { useI18n } from "@/i18n/I18nProvider";
import { Link } from "wouter";
import {
  formatWallboardDuration,
  getEffectiveWallboardServerTime,
  getWallboardElapsedSeconds,
  paginateWallboard,
  wallboardPageCount,
  type WallboardState,
  WALLBOARD_PAGE_SIZE,
} from "@/components/wallboard/wallboard";
import "@/components/wallboard/Wallboard.css";

type WallboardPageProps = {
  campaignId?: string | null;
};

const POLL_MS = 2_000;
const STALE_AFTER_MS = 8_000;
const REQUEST_TIMEOUT_MS = 10_000;

const stateColors: Record<WallboardState, string> = {
  calling: "#6fd3db",
  ringing: "#dc3348",
  working: "#a793ec",
  available: "#b9df74",
  break: "#f2be61",
  offline: "#9ca9b7",
};

function interpolate(template: string, value: string | number): string {
  return template.replace("{value}", String(value));
}

type WallboardRequestError = Error & { status?: number; timedOut?: boolean };

function errorMessage(error: unknown, t: ReturnType<typeof useI18n>["t"]): string {
  const status = error instanceof Error ? (error as WallboardRequestError).status : undefined;
  if (status === 401 || status === 403) {
    return t.wallboard.unauthorized;
  }
  return t.wallboard.reconnect;
}

export default function WallboardPage({ campaignId = null }: WallboardPageProps) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<WallboardSnapshot | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [page, setPage] = useState(0);
  const [presentation, setPresentation] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  const fetchSnapshot = useCallback(async (initial = false) => {
    if (requestRef.current) return;
    if (initial) setLoading(true);
    const generation = generationRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const params = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
      const response = await fetch(`/api/wallboard${params}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        const responseError = new Error("Wallboard request failed") as WallboardRequestError;
        responseError.status = response.status;
        throw responseError;
      }
      const next = (await response.json()) as WallboardSnapshot;
      if (generation !== generationRef.current) return;
      setSnapshot(next);
      setError(null);
      setLastFetchedAt(Date.now());
      if (initial) setPage(0);
    } catch (nextError) {
      if (generation !== generationRef.current) return;
      const requestError = nextError as WallboardRequestError;
      if (controller.signal.aborted && !requestError.status) {
        const timeoutError = new Error("Wallboard request timed out") as WallboardRequestError;
        timeoutError.timedOut = true;
        setError(timeoutError);
      } else {
        const status = requestError.status;
        if (status === 401 || status === 403) {
          // A revoked session must never continue displaying staff data.
          setSnapshot(null);
          setLastFetchedAt(null);
        }
        setError(nextError);
      }
    } finally {
      window.clearTimeout(timeout);
      if (generation === generationRef.current) {
        if (initial) setLoading(false);
        if (requestRef.current === controller) requestRef.current = null;
      }
    }
  }, [campaignId]);

  useEffect(() => {
    generationRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    setSnapshot(null);
    setError(null);
    setLastFetchedAt(null);
    setPage(0);
    void fetchSnapshot(true);
    const poll = window.setInterval(() => void fetchSnapshot(false), POLL_MS);
    // Deliberately do not gate this interval on document.visibilityState: a TV
    // tab should continue receiving updates while it is in the background.
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
      generationRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [fetchSnapshot]);

  useEffect(() => {
    const leavePresentation = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresentation(false);
    };
    window.addEventListener("keydown", leavePresentation);
    return () => window.removeEventListener("keydown", leavePresentation);
  }, []);

  const stale = Boolean(
    lastFetchedAt !== null &&
      now - lastFetchedAt > STALE_AFTER_MS,
  ) || Boolean(snapshot?.source.live === false) || Boolean(error && snapshot);

  const agents = snapshot?.agents ?? [];
  const pageCount = wallboardPageCount(agents.length);
  const currentPage = Math.min(page, pageCount - 1);
  const visibleAgents = paginateWallboard(agents, currentPage);

  useEffect(() => {
    if (pageCount <= 1) return;
    const rotation = window.setInterval(() => {
      setPage((current) => (current + 1) % pageCount);
    }, 12_000);
    return () => window.clearInterval(rotation);
  }, [pageCount]);

  const totals = useMemo(() => {
    const count = (state: WallboardState) => agents.filter((agent) => agent.state === state).length;
    return {
      calling: count("calling"),
      ringing: count("ringing"),
      working: count("working"),
      available: count("available"),
      break: count("break"),
      offline: count("offline"),
    };
  }, [agents]);

  const activeInbound = snapshot?.inbound.find((call) => call.status === "ringing")
    ?? snapshot?.inbound.find((call) => call.status === "waiting")
    ?? snapshot?.inbound.find((call) => call.status === "talking");
  const sourceLive = Boolean(snapshot?.source.live) && !stale;
  const title = snapshot?.scope.campaignName ?? t.wallboard.allMissions;
  const effectiveServerNow = snapshot
    ? getEffectiveWallboardServerTime(snapshot.generatedAt, lastFetchedAt, now, stale)
    : null;

  const enterPresentation = () => {
    setPresentation(true);
    // CSS presentation is sufficient when fullscreen permission is unavailable.
    if (document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  };

  const exitPresentation = () => {
    setPresentation(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  };

  const stateLabel = (state: WallboardState) => t.wallboard.states[state];
  const stateDetail = (state: WallboardState) => t.wallboard.details[state];

  return (
    <main className={`wb-shell${presentation ? " wb-present" : ""}`}>
      <div className="wb-board">
        <header className="wb-top">
          <div>
            <div className="wb-brandline">
              <i className="wb-mark" aria-hidden="true" />
              {t.wallboard.brand}
              {snapshot && (
                <span className="wb-status-note" data-live={sourceLive}>
                  <i aria-hidden="true" />
                  {sourceLive ? t.wallboard.live : t.wallboard.stale}
                </span>
              )}
            </div>
            <h1 className="wb-title">{title}</h1>
            <p className="wb-sub">
              {snapshot
                ? snapshot.scope.campaignId
                  ? interpolate(t.wallboard.agentsSignedIn, agents.length)
                  : interpolate(t.wallboard.agentsAcrossMissions, snapshot.campaigns.length)
                : t.wallboard.loading}
            </p>
          </div>
          <div className="wb-tools">
            <Link className="wb-tool" href={campaignId ? "/wallboard" : "/campaigns"}>
              <ArrowLeft size={14} aria-hidden="true" />
              {campaignId ? t.wallboard.backToAllMissions : t.wallboard.backToMissions}
            </Link>
            <button className="wb-tool" type="button" onClick={() => void fetchSnapshot(false)}>
              <RefreshCw size={14} aria-hidden="true" />
              {t.wallboard.refresh}
            </button>
            {presentation ? (
              <button className="wb-tool" type="button" onClick={exitPresentation}>
                <X size={14} aria-hidden="true" />
                {t.wallboard.exitPresentation}
              </button>
            ) : (
              <button className="wb-tool" type="button" onClick={enterPresentation}>
                <Maximize2 size={14} aria-hidden="true" />
                {t.wallboard.presentation}
              </button>
            )}
          </div>
        </header>

        {(stale || snapshot?.source.warning) && snapshot && (
          <div className="wb-stale" role="status">
            <RefreshCw size={13} aria-hidden="true" />
            {error ? t.wallboard.reconnect : snapshot.source.warning ? t.wallboard.sourceWarning : t.wallboard.staleWarning}
          </div>
        )}

        <div className="wb-main">
          <section className="wb-stage" aria-label={t.wallboard.agentStatus}>
            {snapshot && (
              <div className="wb-summary">
                {(["calling", "ringing", "working", "available", "break", "offline"] as WallboardState[]).map((state) => (
                  <div className="wb-metric" key={state}>
                    <span>{stateLabel(state)}</span>
                    <b>{String(totals[state]).padStart(2, "0")} <em>/ {String(agents.length).padStart(2, "0")}</em></b>
                  </div>
                ))}
              </div>
            )}

            {loading && !snapshot ? (
              <div className="wb-loading" aria-label={t.wallboard.loading} />
            ) : error && !snapshot ? (
              <div className="wb-error" role="alert">
                <div>
                  <b>{errorMessage(error, t)}</b>
                  <br />
                  <button type="button" onClick={() => void fetchSnapshot(true)}>{t.wallboard.tryAgain}</button>
                </div>
              </div>
            ) : !snapshot?.scope.campaignId && !snapshot?.scope.campaignName && snapshot?.campaigns.length === 0 ? (
              <div className="wb-empty">
                <div><b>{t.wallboard.noActiveMission}</b>{t.wallboard.noActiveMissionHint}</div>
              </div>
            ) : agents.length === 0 ? (
              <div className="wb-empty">
                <div><b>{t.wallboard.noAgents}</b>{t.wallboard.noAgentsHint}</div>
              </div>
            ) : (
              <div className="wb-agents">
                {visibleAgents.map((agent) => {
                  const elapsed = getWallboardElapsedSeconds(
                    agent.stateSince,
                    effectiveServerNow ?? Number.NaN,
                  );
                  return (
                    <article
                      className="wb-agent"
                      key={agent.id}
                      style={{ "--wb-state": stateColors[agent.state] } as CSSProperties}
                    >
                      <div className="wb-agent-head">
                        <div>
                          <div className="wb-agent-id">{agent.id}</div>
                          <div className="wb-agent-name">{agent.name}</div>
                          <div className="wb-campaign">
                            {agent.campaignNames.length > 0 ? agent.campaignNames.join(" · ") : t.wallboard.noMission}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="wb-status">{stateLabel(agent.state)}</div>
                        <div className="wb-timer">
                          {elapsed === null ? t.wallboard.unknownTime : formatWallboardDuration(elapsed)}
                        </div>
                        <div className="wb-detail">
                          {agent.connected ? stateDetail(agent.state) : t.wallboard.disconnected}
                          {agent.direction ? ` · ${agent.direction === "inbound" ? t.wallboard.inbound : t.wallboard.outbound}` : ""}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {snapshot && agents.length > WALLBOARD_PAGE_SIZE && (
              <div className="wb-pagination">
                <span>{interpolate(t.wallboard.pageOf, `${currentPage + 1} / ${pageCount}`)}</span>
                <div className="wb-pagination-controls">
                  <button
                    className="wb-page-button"
                    type="button"
                    aria-label={t.wallboard.previousPage}
                    disabled={pageCount < 2}
                    onClick={() => setPage((currentPage - 1 + pageCount) % pageCount)}
                  >
                    <ChevronLeft size={15} aria-hidden="true" />
                  </button>
                  <button
                    className="wb-page-button"
                    type="button"
                    aria-label={t.wallboard.nextPage}
                    disabled={pageCount < 2}
                    onClick={() => setPage((currentPage + 1) % pageCount)}
                  >
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="wb-rail">
            <section className="wb-inbound" aria-live="polite">
              <div className="wb-overline"><MonitorUp size={11} aria-hidden="true" /> {t.wallboard.incoming}</div>
              {activeInbound ? (
                <>
                  <h2>{activeInbound.queueName}</h2>
                  <p>{t.wallboard.assigned}: {activeInbound.agentName ?? t.wallboard.unassigned}</p>
                  <strong>{activeInbound.callerLabel ?? t.wallboard.unknownCaller}</strong>
                  <p>{t.wallboard.callStatus}: {t.wallboard.callStatuses[activeInbound.status]}</p>
                </>
              ) : (
                <>
                  <h2>{t.wallboard.noIncoming}</h2>
                  <p>{t.wallboard.noIncomingHint}</p>
                </>
              )}
            </section>
            <section className="wb-queue">
              <h3>{t.wallboard.queue}</h3>
              <div className="wb-qrow"><span>{t.wallboard.waiting}</span><b>{snapshot?.queue.waiting ?? "—"}</b></div>
              <div className="wb-qrow"><span>{t.wallboard.longestWait}</span><b>{snapshot?.queue.longestWaitSeconds === null || snapshot?.queue.longestWaitSeconds === undefined ? "—" : formatWallboardDuration(snapshot.queue.longestWaitSeconds)}</b></div>
              <div className="wb-qrow"><span>{t.wallboard.answeredToday}</span><b>{snapshot?.queue.answeredToday ?? "—"}</b></div>
              <div className="wb-qrow"><span>{t.wallboard.averageWait}</span><b>{snapshot?.queue.averageWaitSeconds === null || snapshot?.queue.averageWaitSeconds === undefined ? "—" : formatWallboardDuration(snapshot.queue.averageWaitSeconds)}</b></div>
            </section>
            <footer className="wb-footer">
              <span>{snapshot ? `${t.wallboard.generated} ${new Date(snapshot.generatedAt).toLocaleTimeString()}` : "—"}</span>
              {snapshot && <span>{sourceLive ? t.wallboard.live : t.wallboard.stale}</span>}
            </footer>
          </aside>
        </div>
      </div>
    </main>
  );
}