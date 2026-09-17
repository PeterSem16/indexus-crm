import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Maximize2, MonitorUp, RefreshCw, X, ArrowLeft, UserRound, Bell, History, AlertTriangle } from "lucide-react";
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
import { defaultWallboardAlarmSettings } from "@shared/wallboard-alarms";
import { WallboardAlarmSettings } from "@/components/wallboard/WallboardAlarmSettings";
import { WallboardAlarmPanel } from "@/components/wallboard/WallboardAlarmPanel";
import { WallboardAlarmHistory } from "@/components/wallboard/WallboardAlarmHistory";
import { useWallboardAlarms } from "@/components/wallboard/use-wallboard-alarms";

type WallboardPageProps = {
  campaignId?: string | null;
};

type WallboardAgent = WallboardSnapshot["agents"][number] & {
  avatarUrl?: string | null;
  sessionStartedAt?: string | null;
  lastMissionAt?: string | null;
  todayMissionSeconds?: number;
  todayAccruing?: boolean;
};

const POLL_MS = 2_000;
const STALE_AFTER_MS = 8_000;
const REQUEST_TIMEOUT_MS = 10_000;
const SHOW_OFFLINE_STORAGE_KEY = "wallboard-show-offline-agents";

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

function readShowOfflineAgents(): boolean {
  try {
    const stored = window.localStorage.getItem(SHOW_OFFLINE_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

function formatWallboardDateTime(
  value: string | null | undefined,
  locale: string,
  timeOnlyIfToday = false,
  referenceNow = Date.now(),
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  const sameBratislavaDay = bratislavaDay(date.getTime()) === bratislavaDay(referenceNow);
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Bratislava",
    ...(timeOnlyIfToday && sameBratislavaDay
      ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" as const }
      : { dateStyle: "short" as const, timeStyle: "short" as const }),
  }).format(date);
}

function bratislavaDay(value: number | string): string {
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function WallboardPage({ campaignId = null }: WallboardPageProps) {
  const { t, locale } = useI18n();
  const [snapshot, setSnapshot] = useState<WallboardSnapshot | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [page, setPage] = useState(0);
  const [presentation, setPresentation] = useState(false);
  const [alarmSettingsOpen, setAlarmSettingsOpen] = useState(false);
  const [alarmHistoryOpen, setAlarmHistoryOpen] = useState(false);
  const [showOfflineAgents, setShowOfflineAgents] = useState(readShowOfflineAgents);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
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

  const agents = (snapshot?.agents ?? []) as WallboardAgent[];
  const filteredAgents = showOfflineAgents ? agents : agents.filter((agent) => agent.state !== "offline");
  const pageCount = wallboardPageCount(filteredAgents.length);
  const currentPage = Math.min(page, pageCount - 1);
  const visibleAgents = paginateWallboard(filteredAgents, currentPage);

  const toggleOfflineAgents = () => {
    setShowOfflineAgents((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SHOW_OFFLINE_STORAGE_KEY, String(next));
      } catch {
        // Private browsing and blocked storage should not prevent using the filter.
      }
      return next;
    });
    setPage(0);
  };

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
  const signedInCount = agents.filter((agent) => agent.state !== "offline").length;
  const effectiveServerNow = snapshot
    ? getEffectiveWallboardServerTime(snapshot.generatedAt, lastFetchedAt, now, stale)
    : null;
  const alarms = useWallboardAlarms(campaignId, snapshot, effectiveServerNow, stale);
  const enabledAlarmCount = alarms.settings?.rules.filter((rule) => rule.enabled).length ?? 0;
  const showAlarmPanel = Boolean(snapshot && (enabledAlarmCount || alarms.settingsError));
  const highlightedAgents = new Set(alarms.incidents.flatMap((incident) => incident.agentIds));
  useEffect(() => { setAlarmSettingsOpen(false); setAlarmHistoryOpen(false); }, [campaignId]);

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
  const snapshotDay = snapshot ? bratislavaDay(snapshot.generatedAt) : "";
  // Compare with the receipt clock as well as the server timestamp so a stale
  // yesterday snapshot cannot carry its totals through Bratislava midnight.
  const todayIsCurrent = Boolean(snapshotDay && snapshotDay === bratislavaDay(now));

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
                  ? interpolate(t.wallboard.agentsSignedIn, signedInCount)
                  : interpolate(t.wallboard.agentsAcrossMissions, snapshot.campaigns.length)
                : t.wallboard.loading}
            </p>
          </div>
          <div className="wb-tools">
            <Link className="wb-tool" href="/campaigns">
              <ArrowLeft size={14} aria-hidden="true" />
              {t.wallboard.backToMissions}
            </Link>
            <button className="wb-tool" type="button" onClick={() => void fetchSnapshot(false)}>
              <RefreshCw size={14} aria-hidden="true" />
              {t.wallboard.refresh}
            </button>
            <button className="wb-tool" type="button" disabled={!snapshot}
              onClick={() => {
                setAlarmSettingsOpen(true);
                if (alarms.settingsError) void alarms.reloadSettings();
              }}>
              <Bell size={14} aria-hidden="true" />
              {t.wallboard.alarm.settings}
              {alarms.incidents.length > 0 && <span className="wb-alarm-count">{alarms.incidents.length}</span>}
            </button>
            <button className="wb-tool" type="button" disabled={!snapshot} onClick={() => setAlarmHistoryOpen(true)} data-testid="wallboard-alarm-history-open">
              <History size={14} aria-hidden="true" />
              {t.wallboard.alarm.history.title}
            </button>
            <button
              className="wb-tool wb-offline-toggle"
              type="button"
              role="switch"
              aria-label={t.wallboard.showOfflineAgents}
              aria-checked={showOfflineAgents}
              onClick={toggleOfflineAgents}
            >
              <span className="wb-switch-track" aria-hidden="true"><span /></span>
              {t.wallboard.showOfflineAgents}
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
              <div className="wb-summary" data-alarm={alarms.incidents.some((incident) => incident.type === "min_online") || undefined}>
                {(["calling", "ringing", "working", "available", "break", "offline"] as WallboardState[]).map((state) => (
                  <div className="wb-metric" key={state} data-alarm={
                    alarms.incidents.some((incident) =>
                      (incident.type === "min_available" && state === "available") ||
                      (["max_break", "long_break"].includes(incident.type) && state === "break")) || undefined
                  }>
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
            ) : filteredAgents.length === 0 ? (
              <div className="wb-empty">
                <div><b>{t.wallboard.noOnlineAgents}</b>{t.wallboard.noOnlineAgentsHint}</div>
              </div>
            ) : (
              <div className="wb-agents">
                {visibleAgents.map((agent) => {
                  const isOnline = agent.connected && agent.state !== "offline";
                  const stateElapsed = isOnline
                    ? getWallboardElapsedSeconds(agent.stateSince, effectiveServerNow ?? Number.NaN)
                    : null;
                  const sessionElapsed = isOnline
                    ? getWallboardElapsedSeconds(agent.sessionStartedAt ?? null, effectiveServerNow ?? Number.NaN)
                    : null;
                  const todaySeconds = todayIsCurrent
                    ? (agent.todayMissionSeconds ?? 0) + (
                      !stale && agent.todayAccruing && effectiveServerNow !== null && snapshot
                        ? Math.max(0, Math.floor((effectiveServerNow - Date.parse(snapshot.generatedAt)) / 1000))
                        : 0
                    )
                    : 0;
                  return (
                    <article
                      className="wb-agent"
                      data-alarm={highlightedAgents.has(agent.id) || undefined}
                      key={agent.id}
                      style={{ "--wb-state": stateColors[agent.state] } as CSSProperties}
                    >
                      <div className="wb-agent-head">
                        <div className="wb-agent-person">
                          <div className="wb-avatar">
                            {agent.avatarUrl && !failedAvatars[agent.id] ? (
                              <img
                                src={agent.avatarUrl}
                                alt=""
                                onError={() => setFailedAvatars((current) => ({ ...current, [agent.id]: true }))}
                              />
                            ) : <UserRound size={20} aria-hidden="true" />}
                          </div>
                          <div>
                            <div className="wb-agent-name">{agent.name}</div>
                            <div className="wb-campaign">
                              {agent.campaignNames.length > 0 ? agent.campaignNames.join(" · ") : t.wallboard.noMission}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="wb-status">{stateLabel(agent.state)}</div>
                        {isOnline && (
                          <div className="wb-state-timer">
                            {stateElapsed === null ? t.wallboard.unknownTime : formatWallboardDuration(stateElapsed)}
                          </div>
                        )}
                        <div className="wb-details">
                          {isOnline ? (
                            <>
                              <div><span>{t.wallboard.signedInAt}</span><b>{formatWallboardDateTime(agent.sessionStartedAt, locale, true, now)}</b></div>
                              <div><span>{t.wallboard.currentSession}</span><b>{sessionElapsed === null ? t.wallboard.unknownTime : formatWallboardDuration(sessionElapsed)}</b></div>
                            </>
                          ) : (
                            <div><span>{t.wallboard.lastInMission}</span><b>{formatWallboardDateTime(agent.lastMissionAt, locale)}</b></div>
                          )}
                          <div><span>{t.wallboard.todayInMission}</span><b>{formatWallboardDuration(todaySeconds)}</b></div>
                        </div>
                        <div className="wb-detail">
                          {isOnline ? stateDetail(agent.state) : t.wallboard.disconnected}
                          {agent.direction ? ` · ${agent.direction === "inbound" ? t.wallboard.inbound : t.wallboard.outbound}` : ""}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {snapshot && filteredAgents.length > WALLBOARD_PAGE_SIZE && (
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

          <aside className={`wb-rail${showAlarmPanel ? " wb-rail-alarmed" : ""}`}>
            {showAlarmPanel && <WallboardAlarmPanel
              incidents={alarms.incidents}
              onAcknowledge={alarms.acknowledge}
              onMute={alarms.mute}
              soundEnabled={alarms.soundEnabled}
              onEnableSound={() => { void alarms.enableSound(); }}
              onDisableSound={alarms.disableSound}
              onTestSound={() => { void alarms.testSound(); }}
              soundError={alarms.soundError}
              suspended={alarms.suspended}
              settingsError={alarms.settingsError}
              graceRemainingSeconds={alarms.graceRemainingSeconds}
              enabledRuleCount={enabledAlarmCount}
              now={effectiveServerNow ?? now}
            />}
            {alarms.historyError && <p className="wb-history-warning" role="alert" data-testid="wallboard-alarm-history-persistence-warning"><AlertTriangle size={14} aria-hidden="true" />{t.wallboard.alarm.history.persistenceWarning}</p>}
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
            <section className="wb-queue" data-alarm={alarms.incidents.some((incident) => incident.type === "queue_wait") || undefined}>
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
      {snapshot && <WallboardAlarmSettings
        open={alarmSettingsOpen}
        onOpenChange={setAlarmSettingsOpen}
        settings={alarms.settings ?? defaultWallboardAlarmSettings()}
        onSave={alarms.saveSettings}
        loading={alarms.settingsLoading || !alarms.settings}
      />}
      <WallboardAlarmHistory
        key={campaignId ?? "all"}
        open={alarmHistoryOpen}
        onOpenChange={setAlarmHistoryOpen}
        campaignId={campaignId}
        persistenceError={alarms.historyError}
      />
    </main>
  );
}