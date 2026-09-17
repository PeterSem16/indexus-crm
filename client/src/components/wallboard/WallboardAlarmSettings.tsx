import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";
import {
  wallboardAlarmSettingsSchema, type WallboardAlarmRule, type WallboardAlarmSettings, type WallboardAlarmType,
} from "@shared/wallboard-alarms";
import "./WallboardAlarms.css";

export interface WallboardAlarmSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: WallboardAlarmSettings;
  onSave: (settings: WallboardAlarmSettings) => Promise<void>;
  loading?: boolean;
}

type RuleDraft = WallboardAlarmRule & { thresholdUnit: "seconds" | "minutes"; delayUnit: "seconds" | "minutes" };
type SettingsDraft = Omit<WallboardAlarmSettings, "rules"> & { rules: RuleDraft[] };

const alarmTypes: WallboardAlarmType[] = ["no_calls", "min_online", "min_available", "max_break", "long_break", "queue_wait"];
const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function isDuration(type: WallboardAlarmType) {
  return type === "no_calls" || type === "long_break" || type === "queue_wait";
}

function withUnits(rule: WallboardAlarmRule): RuleDraft {
  const thresholdUnit = isDuration(rule.type) && rule.threshold >= 60 && rule.threshold % 60 === 0 ? "minutes" : "seconds";
  const delayUnit = rule.delaySeconds >= 60 && rule.delaySeconds % 60 === 0 ? "minutes" : "seconds";
  return { ...rule, schedule: { ...rule.schedule, days: [...rule.schedule.days] }, thresholdUnit, delayUnit };
}

function cloneSettings(settings: WallboardAlarmSettings): SettingsDraft {
  return { startupGraceSeconds: settings.startupGraceSeconds, volume: settings.volume, rules: settings.rules.map(withUnits) };
}

function newRule(index: number): RuleDraft {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `alarm-${index + 1}`,
    name: "", enabled: true, type: "no_calls", threshold: 1, direction: "both", callEvent: "started",
    delaySeconds: 0, mode: "visual", repeatSeconds: 0,
    schedule: { enabled: false, days: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "17:00" },
    thresholdUnit: "seconds", delayUnit: "seconds",
  };
}

export function WallboardAlarmSettings({ open, onOpenChange, settings, onSave, loading = false }: WallboardAlarmSettingsProps) {
  const { t } = useI18n();
  const a = t.wallboard.alarm;
  const [draft, setDraft] = useState<SettingsDraft>(() => cloneSettings(settings));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(cloneSettings(settings));
      setError("");
      setSaving(false);
    }
  }, [open, settings]);

  const typeLabels = useMemo<Record<WallboardAlarmType, string>>(() => ({
    no_calls: a.typeNoCalls, min_online: a.typeMinOnline, min_available: a.typeMinAvailable,
    max_break: a.typeMaxBreak, long_break: a.typeLongBreak, queue_wait: a.typeQueueWait,
  }), [a]);

  const updateRule = (index: number, patch: Partial<RuleDraft>) => {
    setDraft(current => ({ ...current, rules: current.rules.map((rule, i) => i === index ? { ...rule, ...patch } : rule) }));
  };

  const updateRuleField = <K extends keyof RuleDraft>(index: number, key: K, value: RuleDraft[K]) => {
    updateRule(index, { [key]: value } as Partial<RuleDraft>);
  };

  const updateSchedule = (index: number, patch: Partial<RuleDraft["schedule"]>) => {
    const rule = draft.rules[index];
    updateRule(index, { schedule: { ...rule.schedule, ...patch } });
  };

  const displayValue = (value: number, unit: "seconds" | "minutes") => unit === "minutes" ? value / 60 : value;
  const canonicalValue = (value: string, unit: "seconds" | "minutes") => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * (unit === "minutes" ? 60 : 1)) : 0;
  };

  const submit = async () => {
    if (saving || loading) return;
    const candidate: WallboardAlarmSettings = {
      startupGraceSeconds: draft.startupGraceSeconds, volume: draft.volume,
      rules: draft.rules.map(({ thresholdUnit: _thresholdUnit, delayUnit: _delayUnit, ...rule }) => rule),
    };
    const parsed = wallboardAlarmSettingsSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(a.validationError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(parsed.data);
      onOpenChange(false);
    } catch {
      setError(a.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="wb-alarm-dialog" aria-describedby="wb-alarm-settings-description">
        <DialogHeader>
          <DialogTitle>{a.settingsTitle}</DialogTitle>
          <DialogDescription id="wb-alarm-settings-description">{a.settingsDescription}</DialogDescription>
        </DialogHeader>
        {loading ? <div className="wb-alarm-loading" role="status">{a.loading}</div> : (
          <div className="wb-alarm-settings-scroll">
            <section className="wb-alarm-global">
              <label>{a.startupGrace}
                <span className="wb-alarm-inline-input"><input type="number" min={0} max={3600} step={1} value={draft.startupGraceSeconds}
                  onChange={event => setDraft({ ...draft, startupGraceSeconds: Number(event.target.value) })} /> {a.seconds}</span>
                <small>{a.startupGraceHelp}</small>
              </label>
              <label>{a.volume}
                <span className="wb-alarm-volume"><input type="range" min={0.05} max={1} step={0.05} value={draft.volume}
                  aria-label={a.volume} onChange={event => setDraft({ ...draft, volume: Number(event.target.value) })} /><output>{Math.round(draft.volume * 100)}%</output></span>
              </label>
            </section>
            <div className="wb-alarm-section-heading"><h3>{a.rules}</h3><span>{draft.rules.length}/30</span>
              <button type="button" className="wb-alarm-button wb-alarm-button-primary" disabled={draft.rules.length >= 30} onClick={() => setDraft({ ...draft, rules: [...draft.rules, newRule(draft.rules.length)] })}>{a.addRule}</button>
            </div>
            {draft.rules.length === 0 && <p className="wb-alarm-empty">{a.maxRules}</p>}
            {draft.rules.map((rule, index) => (
              <article className="wb-alarm-rule" key={rule.id}>
                <div className="wb-alarm-rule-heading"><strong>{a.rule} {index + 1}</strong>
                  <label className="wb-alarm-check"><input type="checkbox" checked={rule.enabled} onChange={event => updateRuleField(index, "enabled", event.target.checked)} /> {a.enabled}</label>
                  <button type="button" className="wb-alarm-delete" onClick={() => { if (window.confirm(a.deleteConfirm)) setDraft({ ...draft, rules: draft.rules.filter((_, i) => i !== index) }); }}>{a.delete}</button>
                </div>
                <div className="wb-alarm-grid">
                  <label>{a.name}<input required maxLength={80} value={rule.name} onChange={event => updateRuleField(index, "name", event.target.value)} /></label>
                  <label>{a.type}<select value={rule.type} onChange={event => {
                    const type = event.target.value as WallboardAlarmType;
                    updateRule(index, { type, threshold: isDuration(type) ? 60 : Math.max(1, rule.threshold), thresholdUnit: isDuration(type) ? "seconds" : "seconds" });
                  }}>{alarmTypes.map(type => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
                  <label>{a.threshold}<span className="wb-alarm-combo"><input type="number" min={rule.type === "max_break" ? 0 : 1} max={isDuration(rule.type) ? (rule.thresholdUnit === "minutes" ? 1440 : 86400) : 1000} step={1} value={displayValue(rule.threshold, isDuration(rule.type) ? rule.thresholdUnit : "seconds")}
                    onChange={event => updateRuleField(index, "threshold", canonicalValue(event.target.value, rule.thresholdUnit))} />{isDuration(rule.type) ? <select aria-label={a.countUnit} value={rule.thresholdUnit} onChange={event => updateRuleField(index, "thresholdUnit", event.target.value as RuleDraft["thresholdUnit"])}><option value="seconds">{a.seconds}</option><option value="minutes">{a.minutes}</option></select> : <span>{a.countUnit}</span>}</span></label>
                  {rule.type === "no_calls" && <><label>{a.direction}<select value={rule.direction} onChange={event => updateRuleField(index, "direction", event.target.value as WallboardAlarmRule["direction"])}><option value="inbound">{a.inbound}</option><option value="outbound">{a.outbound}</option><option value="both">{a.both}</option></select></label>
                  <label>{a.event}<select value={rule.callEvent} onChange={event => updateRuleField(index, "callEvent", event.target.value as WallboardAlarmRule["callEvent"])}><option value="started">{a.started}</option><option value="connected">{a.connected}</option></select></label></>}
                  <label>{a.delay}<span className="wb-alarm-combo"><input type="number" min={0} max={rule.delayUnit === "minutes" ? 60 : 3600} step={1} value={displayValue(rule.delaySeconds, rule.delayUnit)} onChange={event => updateRuleField(index, "delaySeconds", canonicalValue(event.target.value, rule.delayUnit))} /><select aria-label={a.delay} value={rule.delayUnit} onChange={event => updateRuleField(index, "delayUnit", event.target.value as RuleDraft["delayUnit"])}><option value="seconds">{a.seconds}</option><option value="minutes">{a.minutes}</option></select></span><small>{a.delayHelp}</small></label>
                  <fieldset><legend>{a.mode}</legend><label className="wb-alarm-radio"><input type="radio" name={`mode-${rule.id}`} checked={rule.mode === "visual"} onChange={() => updateRuleField(index, "mode", "visual")} /> {a.visual}</label><label className="wb-alarm-radio"><input type="radio" name={`mode-${rule.id}`} checked={rule.mode === "sound"} onChange={() => updateRuleField(index, "mode", "sound")} /> {a.visualSound}</label></fieldset>
                  {rule.mode === "sound" && <label>{a.repeat}<span className="wb-alarm-combo"><input type="number" min={0} max={3600} step={1} value={rule.repeatSeconds} onChange={event => {
                    const value = Number(event.target.value);
                    updateRuleField(index, "repeatSeconds", value === 0 ? 0 : Math.max(10, value));
                  }} /><span>{rule.repeatSeconds === 0 ? a.once : `${a.repeatEvery} ${a.seconds}`}</span></span><small>{a.once} (0) {a.repeatEvery} 10+ {a.seconds}</small></label>}
                </div>
                <fieldset className="wb-alarm-schedule"><legend><label className="wb-alarm-check"><input type="checkbox" checked={rule.schedule.enabled} onChange={event => updateSchedule(index, { enabled: event.target.checked })} /> {a.schedule}</label></legend>
                  <small>{a.scheduleHelp}</small>
                  <div className="wb-alarm-days">{days.map((day, dayIndex) => <label key={day}><input type="checkbox" checked={rule.schedule.days.includes(dayIndex)} onChange={event => {
                    const next = event.target.checked ? [...rule.schedule.days, dayIndex] : rule.schedule.days.filter(value => value !== dayIndex);
                    if (next.length > 0) updateSchedule(index, { days: next.sort((left, right) => left - right) });
                  }} /> {a[day]}</label>)}</div>
                  <div className="wb-alarm-times"><label>{a.startTime}<input type="time" value={rule.schedule.startTime} onChange={event => updateSchedule(index, { startTime: event.target.value })} /></label><label>{a.endTime}<input type="time" value={rule.schedule.endTime} onChange={event => updateSchedule(index, { endTime: event.target.value })} /></label></div>
                </fieldset>
              </article>
            ))}
          </div>
        )}
        {error && <p className="wb-alarm-error" role="alert">{error}</p>}
        <DialogFooter><button type="button" className="wb-alarm-button" disabled={saving} onClick={() => onOpenChange(false)}>{a.cancel}</button><button type="button" className="wb-alarm-button wb-alarm-button-primary" disabled={saving || loading} onClick={submit}>{saving ? a.loading : a.save}</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
