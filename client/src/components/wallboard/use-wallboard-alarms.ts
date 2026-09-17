import { useCallback, useEffect, useRef, useState } from "react";
import type { WallboardSnapshot } from "@shared/wallboard";
import {
  wallboardAlarmSettingsSchema,
  type WallboardAlarmSettings,
  type WallboardAlarmIncident,
} from "@shared/wallboard-alarms";
import { advanceAlarms, alarmSoundDue, createAlarmRuntime, silenceAlarm } from "./alarm-engine";

export function useWallboardAlarms(
  campaignId: string | null,
  snapshot: WallboardSnapshot | null,
  now: number | null,
  stale: boolean,
) {
  const [settings, setSettings] = useState<WallboardAlarmSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(false);
  const [incidents, setIncidents] = useState<WallboardAlarmIncident[]>([]);
  const [suspended, setSuspended] = useState(false);
  const [graceRemainingSeconds, setGraceRemainingSeconds] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const runtime = useRef(createAlarmRuntime());
  const generation = useRef(0);
  const settingsGeneration = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const played = useRef(new Map<string, number>());
  const lastChime = useRef<number | null>(null);
  const pendingLoad = useRef<AbortController | null>(null);
  const endpoint = `/api/wallboard/alarms${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ""}`;

  const reloadSettings = useCallback(async () => {
    pendingLoad.current?.abort();
    const controller = new AbortController();
    pendingLoad.current = controller;
    const currentGeneration = generation.current;
    setSettingsLoading(true);
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", signal: controller.signal });
      if (!response.ok) throw new Error("Alarm settings unavailable");
      const data = wallboardAlarmSettingsSchema.parse(await response.json());
      if (generation.current !== currentGeneration || pendingLoad.current !== controller) return;
      settingsGeneration.current = currentGeneration;
      setSettings(data);
      setSettingsError(false);
    } catch {
      if (generation.current !== currentGeneration || pendingLoad.current !== controller) return;
      setSettings(null);
      settingsGeneration.current = null;
      setSettingsError(true);
    } finally {
      clearTimeout(timeout);
      if (generation.current === currentGeneration && pendingLoad.current === controller) setSettingsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    generation.current++;
    settingsGeneration.current = null;
    setSettings(null);
    setSettingsError(false);
    setIncidents([]);
    setSuspended(false);
    setGraceRemainingSeconds(0);
    runtime.current = createAlarmRuntime();
    played.current.clear();
    lastChime.current = null;
    void reloadSettings();
    return () => {
      generation.current++;
      pendingLoad.current?.abort();
    };
  }, [reloadSettings]);

  const saveSettings = useCallback(async (next: WallboardAlarmSettings) => {
    const valid = wallboardAlarmSettingsSchema.parse(next);
    const currentGeneration = generation.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    // A late GET must not overwrite the acknowledged PUT.
    pendingLoad.current?.abort();
    pendingLoad.current = null;
    try {
      const response = await fetch(endpoint, {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valid), signal: controller.signal,
      });
      if (!response.ok) throw new Error("Alarm settings could not be saved");
      const saved = wallboardAlarmSettingsSchema.parse(await response.json());
      if (currentGeneration !== generation.current) throw new Error("Wallboard changed");
      settingsGeneration.current = currentGeneration;
      setSettings(saved);
      setSettingsError(false);
      setSettingsLoading(false);
    } finally {
      clearTimeout(timeout);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!settings || !snapshot || now === null || settingsGeneration.current !== generation.current ||
      snapshot.scope.campaignId !== campaignId) {
      setIncidents([]);
      // Data cannot silently accumulate pending-condition time while unavailable.
      runtime.current = { ...runtime.current, tracks: {} };
      return;
    }
    const result = advanceAlarms(runtime.current, settings, snapshot, now, stale);
    runtime.current = result.runtime;
    setIncidents(result.incidents);
    setSuspended(result.suspended);
    setGraceRemainingSeconds(result.graceRemainingSeconds);
  }, [settings, snapshot, now, stale, campaignId]);

  const chime = useCallback(() => {
    const context = audio.current;
    if (!context || context.state !== "running") {
      setSoundEnabled(false);
      setSoundError(true);
      return false;
    }
    try {
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      const time = context.currentTime;
      oscillator.frequency.setValueAtTime(660, time);
      oscillator.frequency.setValueAtTime(880, time + 0.18);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime((settings?.volume ?? 0.5) * 0.2, time + 0.02);
      gain.gain.setValueAtTime((settings?.volume ?? 0.5) * 0.2, time + 0.3);
      gain.gain.linearRampToValueAtTime(0, time + 0.45);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(time);
      oscillator.stop(time + 0.5);
      return true;
    } catch {
      setSoundError(true);
      setSoundEnabled(false);
      return false;
    }
  }, [settings?.volume]);

  const enableSound = useCallback(async () => {
    try {
      const AudioConstructor = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioConstructor) throw new Error("Audio unavailable");
      audio.current ??= new AudioConstructor();
      await audio.current.resume();
      if (audio.current.state !== "running") throw new Error("Audio blocked");
      setSoundError(false);
      setSoundEnabled(true);
      return true;
    } catch {
      setSoundEnabled(false);
      setSoundError(true);
      return false;
    }
  }, []);
  const testSound = useCallback(async () => { if (await enableSound()) chime(); }, [enableSound, chime]);
  const disableSound = useCallback(() => {
    setSoundEnabled(false);
    void audio.current?.suspend().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!soundEnabled || !settings || !snapshot || stale || now === null ||
      settingsGeneration.current !== generation.current || snapshot.scope.campaignId !== campaignId) return;
    const activeKeys = new Set(incidents.map((incident) => `${incident.ruleId}:${incident.since}`));
    for (const key of played.current.keys()) if (!activeKeys.has(key)) played.current.delete(key);
    const due = incidents.filter((incident) => {
      const current = runtime.current.tracks[incident.ruleId]?.incident;
      if (!current || current.since !== incident.since) return false;
      const rule = settings.rules.find((rule) => rule.id === incident.ruleId);
      return rule && alarmSoundDue(rule, current, now, played.current.get(`${incident.ruleId}:${incident.since}`));
    });
    // Coalesce simultaneous incidents into one short chime, not a sound per rule.
    if (due.length && (lastChime.current === null || now - lastChime.current >= 2000) && chime()) {
      lastChime.current = now;
      for (const incident of due) played.current.set(`${incident.ruleId}:${incident.since}`, now);
    }
  }, [incidents, settings, soundEnabled, now, snapshot, stale, chime, campaignId]);

  useEffect(() => () => { void audio.current?.close().catch(() => undefined); }, []);

  const silence = useCallback((ruleId: string, mute: boolean) => {
    if (now === null) return;
    runtime.current = silenceAlarm(runtime.current, ruleId, now, mute);
    setIncidents(Object.values(runtime.current.tracks).flatMap((track) => track.incident ? [track.incident] : []));
  }, [now]);
  return {
    settings, settingsLoading, settingsError, reloadSettings, saveSettings,
    incidents, suspended, graceRemainingSeconds,
    soundEnabled, soundError, enableSound, disableSound, testSound,
    acknowledge: (ruleId: string) => silence(ruleId, false),
    mute: (ruleId: string) => silence(ruleId, true),
  };
}