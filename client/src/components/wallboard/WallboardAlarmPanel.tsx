import type { WallboardAlarmIncident, WallboardAlarmType } from "@shared/wallboard-alarms";
import { useI18n } from "@/i18n/I18nProvider";
import "./WallboardAlarms.css";

export interface WallboardAlarmPanelProps {
  incidents: WallboardAlarmIncident[];
  onAcknowledge: (ruleId: string) => void;
  onMute: (ruleId: string) => void;
  soundEnabled: boolean;
  onEnableSound: () => void;
  onDisableSound: () => void;
  onTestSound: () => void;
  soundError?: boolean;
  suspended: boolean;
  settingsError?: boolean;
  graceRemainingSeconds: number;
  enabledRuleCount: number;
  now?: number;
}

const durationTypes = new Set<WallboardAlarmType>(["no_calls", "long_break", "queue_wait"]);

function formatMetric(value: number, type: WallboardAlarmType, countUnit: string, seconds: string, minutes: string) {
  if (!durationTypes.has(type)) return `${value} ${countUnit}`;
  if (value >= 60 && value % 60 === 0) return `${value / 60} ${minutes}`;
  return `${value} ${seconds}`;
}

function typeLabel(type: WallboardAlarmType, a: ReturnType<typeof useI18n>["t"]["wallboard"]["alarm"]) {
  const labels: Record<WallboardAlarmType, string> = {
    no_calls: a.typeNoCalls, min_online: a.typeMinOnline, min_available: a.typeMinAvailable,
    max_break: a.typeMaxBreak, long_break: a.typeLongBreak, queue_wait: a.typeQueueWait,
  };
  return labels[type];
}

export function WallboardAlarmPanel({
  incidents, onAcknowledge, onMute, soundEnabled, onEnableSound, onDisableSound, onTestSound,
  soundError = false, suspended, settingsError = false, graceRemainingSeconds, enabledRuleCount,
  now = Date.now(),
}: WallboardAlarmPanelProps) {
  const { t } = useI18n();
  const a = t.wallboard.alarm;
  const showSound = enabledRuleCount > 0;
  const grace = Math.max(0, Math.floor(graceRemainingSeconds));

  return (
    <aside className="wb-alarm-panel" aria-label={a.incidentsTitle}>
      <div className="wb-alarm-panel-header"><div><p className="wb-alarm-kicker">{a.incidentsTitle}</p><h2>{incidents.length} <span>{a.activeIncidents}</span></h2></div>
        {showSound && <div className="wb-alarm-sound-flags" aria-label={a.soundControls}><span className="wb-alarm-flag wb-alarm-flag-visual">{a.visual}</span><span className={`wb-alarm-flag ${soundEnabled ? "wb-alarm-flag-sound-on" : "wb-alarm-flag-sound-off"}`}>{soundEnabled ? a.soundEnabled : a.visualSound}</span></div>}
      </div>
      {suspended && <section className="wb-alarm-suspension" role="status"><strong>{a.suspended}</strong><span>{a.suspendedDescription}</span></section>}
      <p className="wb-alarm-monitoring">{a.monitoringHint}</p>
      {suspended && <p className="wb-alarm-partial">{a.partialSourceWarning}</p>}
      {settingsError && <p className="wb-alarm-error" role="alert">{a.settingsLoadError}</p>}
      {grace > 0 && <p className="wb-alarm-grace">{a.grace}: {grace} {a.seconds} {a.remaining}</p>}
      {incidents.length === 0 ? <p className="wb-alarm-empty">{a.noIncidents}</p> : <div className="wb-alarm-incidents">
        {incidents.map(incident => {
          const muted = incident.mutedUntil !== null && incident.mutedUntil > now;
          return <article className={`wb-alarm-incident ${incident.acknowledged ? "is-acknowledged" : ""}`} key={`${incident.ruleId}-${incident.since}`}>
            <div className="wb-alarm-incident-title"><span className="wb-alarm-severity" aria-hidden="true" /><div><strong>{incident.name}</strong><span>{typeLabel(incident.type, a)}</span></div></div>
            <div className="wb-alarm-values"><span>{a.current}: <b>{formatMetric(incident.value, incident.type, a.countUnit, a.seconds, a.minutes)}</b></span><span>{a.thresholdLabel}: <b>{formatMetric(incident.threshold, incident.type, a.countUnit, a.seconds, a.minutes)}</b></span></div>
            <div className="wb-alarm-badges">{incident.acknowledged && <span>{a.acknowledged}</span>}{muted && <span>{a.muted}</span>}</div>
            <div className="wb-alarm-incident-actions"><button type="button" disabled={incident.acknowledged} onClick={() => onAcknowledge(incident.ruleId)}>{a.acknowledge}</button><button type="button" onClick={() => onMute(incident.ruleId)}>{a.muteFiveMinutes}</button></div>
          </article>;
        })}
      </div>}
      {showSound && <section className="wb-alarm-sound-controls"><h3>{a.soundControls}</h3><div className="wb-alarm-sound-actions">
        {soundEnabled ? <button type="button" onClick={onDisableSound}>{a.disableSound}</button> : <button type="button" className="wb-alarm-button-primary" onClick={onEnableSound}>{a.enableSound}</button>}
        <button type="button" onClick={onTestSound}>{a.testSound}</button>
      </div>{!soundEnabled && <small>{a.soundRequired}</small>}{soundError && <p className="wb-alarm-error" role="alert">{a.soundError}</p>}</section>}
    </aside>
  );
}
