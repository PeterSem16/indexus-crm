import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { UserAgent, Registerer, RegistererState, Inviter, Session, SessionState } from "sip.js";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import {
  endSessionBounded,
  holdToggle as sipHoldToggle,
  isHeld as sipIsHeld,
  isHeldCallRecoveryCandidate,
  isHoldTransitioning,
  recoverHeldSessionMedia,
  restartSessionMedia,
  shouldAttemptHeldCallRecovery,
  unhold as sipUnhold,
} from "@/lib/sip-hold";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useSip } from "@/contexts/sip-context";
import { useCall, type CallState as GlobalCallState } from "@/contexts/call-context";
import { 
  Phone, 
  PhoneOff, 
  PhoneCall, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Pause,
  Play,
  X,
  Settings,
  Loader2,
  AlertCircle,
  Activity,
  AudioLines,
  TriangleAlert,
  WifiOff
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePulseToast } from "@/hooks/use-pulse-toast";
import { useI18n } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SipSettings, CallLog, User } from "@shared/schema";
import { resolveOutboundCallProvider } from "@shared/telephony-routing";
import type { MissionCallRecordingSnapshot } from "@shared/mission-recording";
import { audioRtpDelta, classifyAudioRtpStats, nextMediaFailureAction, shouldAttemptAutomaticMediaRecovery, shouldRetainRecheckAfterTermination, type AudioRtpHealth, type AudioRtpStats } from "@/lib/sip-audio-health";
import { reportVoiceIncident, setVoiceIncidentCallContext } from "@/lib/voice-incident-logger";
import { isCorrelatedInboundHangup, shouldApplyEstablishedSessionEffects, shouldCancelAfterRingGrace } from "@/lib/sip-session-guards";
import { classifyOutboundTermination, classifyOutboundTerminationWithDeferredResponse } from "@/lib/sip-outbound-outcome";

function filterSdpCandidates(description: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
  if (!description.sdp) return Promise.resolve(description);
  const lines = description.sdp.split(/\r?\n/);
  const filtered = lines.filter(line => {
    if (!line.startsWith("a=candidate:")) return true;
    if (line.includes("typ relay")) return true;
    const ipMatch = line.match(/a=candidate:\S+ \d+ \S+ \d+ (\S+)/);
    if (!ipMatch) return true;
    const ip = ipMatch[1];
    return ip.startsWith("10.") || ip.startsWith("172.") || ip === "0.0.0.0";
  });
  return Promise.resolve({ ...description, sdp: filtered.join("\r\n") });
}

function forceDtlsActive(description: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
  if (!description.sdp) return Promise.resolve(description);
  const sdp = description.sdp
    .replace(/a=setup:actpass/g, "a=setup:active")
    .replace(/a=setup:passive/g, "a=setup:active");
  return Promise.resolve({ ...description, sdp });
}

function useRegistrationTimer(isRegistered: boolean, isRegistering: boolean) {
  const [waitingForReg, setWaitingForReg] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_WAIT = 10;

  const startWaiting = useCallback(() => {
    setWaitingForReg(true);
    setElapsedSec(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const t0 = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    timeoutRef.current = setTimeout(() => {
      setWaitingForReg(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, MAX_WAIT * 1000);
  }, []);

  useEffect(() => {
    if (waitingForReg && isRegistered) {
      setWaitingForReg(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    }
  }, [isRegistered, waitingForReg]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { waitingForReg, elapsedSec, startWaiting, MAX_WAIT };
}

export interface SipConfig {
  server: string;
  port?: number;
  wsPath?: string;
  realm?: string;
  transport?: string;
  username: string;
  password: string;
  displayName?: string;
}

interface SipPhoneProps {
  config?: SipConfig;
  initialNumber?: string;
  onCallStart?: (number: string, callLogId?: number) => void;
  onCallEnd?: (duration: number, status: string, callLogId?: number) => void;
  compact?: boolean;
  userId?: string;
  customerId?: string;
  campaignId?: string;
  customerName?: string;
  hideSettingsAndRegistration?: boolean;
}

type CallState = "idle" | "connecting" | "ringing" | "active" | "on_hold" | "ended";
type AudioHealthState = "idle" | "checking" | "connected" | "recovering" | "warning" | "failed";

export function SipPhone({ 
  config, 
  initialNumber = "", 
  onCallStart, 
  onCallEnd,
  compact = false,
  userId,
  customerId,
  campaignId,
  customerName,
  hideSettingsAndRegistration = false
}: SipPhoneProps) {
  const { toast, qualityToast } = usePulseToast();
  const { t } = useI18n();
  const { isRegistered, isRegistering, registrationError, register, unregister, ensureRegistered, userAgentRef, registererRef, pendingCall, clearPendingCall, incomingCall, answeredIncomingSession, clearAnsweredSession, answerIncomingCall, rejectIncomingCall } = useSip();
  const { waitingForReg: dialWaiting, elapsedSec: dialElapsed, startWaiting: startDialWaiting } = useRegistrationTimer(isRegistered, isRegistering);
  const callContext = useCall();
  const [localCustomerId, setLocalCustomerId] = useState(customerId);
  const localCustomerIdRef = useRef<string | undefined>(customerId);
  const [localCampaignId, setLocalCampaignId] = useState(campaignId);
  const localCampaignIdRef = useRef<string | undefined>(campaignId);
  const localCampaignContactIdRef = useRef<string | undefined>(undefined);
  const localContactTypeRef = useRef<"customer" | "hospital" | "clinic" | "collaborator" | undefined>(undefined);
  const localProviderRef = useRef<"O2-IMS" | undefined>(undefined);
  const localOutboundTrunkRef = useRef<import("@shared/telephony-routing").OutboundTrunkSelection>("global");
  const localOutboundCountryRef = useRef<string | undefined>(undefined);
  const [localCampaignName, setLocalCampaignName] = useState<string | undefined>(undefined);
  const [localCustomerName, setLocalCustomerName] = useState(customerName);
  const [localLeadScore, setLocalLeadScore] = useState<number | undefined>(undefined);
  const [localClientStatus, setLocalClientStatus] = useState<string | undefined>(undefined);
  const [localCallerIdNumber, setLocalCallerIdNumber] = useState<string>("");
  const localCallerIdNumberRef = useRef<string>("");
  const [collaboratorCallerId, setCollaboratorCallerId] = useState<string>("");
  const collaboratorCallerIdRef = useRef<string>("");
  const [callState, setCallStateLocal] = useState<CallState>("idle");
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);
  const phoneNumberRef = useRef(initialNumber);
  useEffect(() => { phoneNumberRef.current = phoneNumber; }, [phoneNumber]);
  const [isMutedLocal, setIsMutedLocal] = useState(false);
  const [isOnHoldLocal, setIsOnHoldLocal] = useState(false);
  
  const setCallState = useCallback((state: CallState) => {
    setCallStateLocal(state);
    callContextRef.current.setCallState(state as GlobalCallState);
  }, []);
  
  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedLocal(muted);
    callContextRef.current.setIsMuted(muted);
  }, []);
  
  const setIsOnHold = useCallback((hold: boolean) => {
    setIsOnHoldLocal(hold);
    callContextRef.current.setIsOnHold(hold);
  }, []);
  
  useEffect(() => { localCallerIdNumberRef.current = localCallerIdNumber; }, [localCallerIdNumber]);
  useEffect(() => { collaboratorCallerIdRef.current = collaboratorCallerId; }, [collaboratorCallerId]);

  const isMuted = isMutedLocal;
  const isOnHold = isOnHoldLocal;
  const [volume, setVolume] = useState(80);
  const [micVolume, setMicVolume] = useState(100);
  const [callDuration, setCallDuration] = useState(0);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [currentCallLogId, setCurrentCallLogId] = useState<number | null>(null);
  const currentCallLogIdRef = useRef<number | null>(null);
  useEffect(() => {
    currentCallLogIdRef.current = currentCallLogId;
    setVoiceIncidentCallContext(currentCallLogId);
    return () => setVoiceIncidentCallContext(null);
  }, [currentCallLogId]);
  const [sipConfig, setSipConfig] = useState<SipConfig>(config || {
    server: "",
    username: "",
    password: "",
    displayName: "Operator"
  });
  const sessionRef = useRef<Session | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioHealth, setAudioHealth] = useState<AudioHealthState>("idle");
  const audioHealthRef = useRef<AudioHealthState>("idle");
  audioHealthRef.current = audioHealth;
  const [mediaAlertDismissed, setMediaAlertDismissed] = useState(false);
  const heldRecoverySessionRef = useRef<Session | null>(null);
  const requestHeldCallRecoveryRef = useRef<(session: Session, source: string) => void>(() => {});
  const beginMediaInterruptionRef = useRef<(session: Session, source?: string) => string | null>(() => null);
  const refreshRemoteAudioRef = useRef<(session: Session) => Promise<boolean>>(async () => false);
  const recoverSessionMediaOnceRef = useRef<(session: Session) => Promise<boolean>>(async () => false);
  const mediaHealthCleanupRef = useRef<(() => void) | null>(null);
  const mediaHealthSessionRef = useRef<Session | null>(null);
  useEffect(() => {
    if (audioHealth === "idle" || audioHealth === "connected") {
      setMediaAlertDismissed(false);
    }
  }, [audioHealth]);
  const startMediaHealthMonitoringRef = useRef<(
    session: Session,
    peerConnection: RTCPeerConnection,
    direction: "inbound" | "outbound",
  ) => void>(() => {});
  const outboundTerminatedSessionsRef = useRef<WeakSet<object>>(new WeakSet());
  const flagUnstableMediaTermination = useCallback((session: Session) => {
    const sessionAny = session as any;
    const explicitlyEnded = userHungUpRef.current || serverConfirmedRemoteHangupSessionRef.current === session;
    if (explicitlyEnded) return;
    const now = Date.now();
    const recoveredAt = Number(sessionAny.__mediaRecoveredAt || 0) || null;
    const interruptionUnresolved = !!sessionAny.__mediaInterruptionObserved
      || ["recovering", "warning", "failed"].includes(audioHealthRef.current);
    if (!shouldRetainRecheckAfterTermination({
      explicitlyEnded,
      interruptionUnresolved,
      recoveredAt,
      now,
    })) return;
    const recentlyRecovered = recoveredAt !== null && now - recoveredAt < 20_000;
    const episodeId = sessionAny.__mediaInterruptionEpisodeId
      || sessionAny.__lastMediaRecoveredEpisodeId
      || `${currentCallLogIdRef.current || sessionAny.id || "sip"}:unstable-termination:${now}`;
    window.dispatchEvent(new CustomEvent("nexus-pulse-media-critical", {
      detail: { episodeId },
    }));
    console.warn("[SIP-MEDIA] Unconfirmed termination during/recently after media recovery; readiness recheck retained", {
      recentlyRecovered,
      interruptionUnresolved,
    });
  }, []);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micDestinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micRawTrackRef = useRef<MediaStreamTrack | null>(null);
  const micProcessedTrackRef = useRef<MediaStreamTrack | null>(null);
  const userHungUpRef = useRef<boolean>(false);
  const outboundAnsweredRef = useRef<boolean>(false);
  const outboundFinalStatusCodeRef = useRef<number | null>(null);
  const outboundGenerationRef = useRef(0);
  const outboundOutcomeCorrectedRef = useRef<WeakSet<object>>(new WeakSet());
  const serverConfirmedRemoteHangupSessionRef = useRef<Session | null>(null);
  const pendingCallProcessedRef = useRef<boolean>(false);
  // Per-mission max ring duration for outbound calls (0 = no limit).
  const maxRingSecondsRef = useRef<number>(0);
  const maxRingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringTimedOutRef = useRef<boolean>(false);
  const activeInboundMetaRef = useRef<{ callId?: string; queueId?: string; queueName?: string; direction?: string; session?: Session } | null>(null);
  const inboundTerminatedListenerRef = useRef<{ session: any; listener: (state: any) => void } | null>(null);
  const inboundFinalizeRef = useRef<(() => void) | null>(null);
  const activeSessionFinalizeRef = useRef<{
    session: Session;
    finalize: (source: string) => void;
  } | null>(null);
  const hangupPollRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recordingSourceNodesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const pauseToneNodesRef = useRef<{ oscillators: OscillatorNode[]; gains: GainNode[] } | null>(null);
  const recordingSnapshotRef = useRef<MissionCallRecordingSnapshot | undefined>(undefined);
  const customerActivitySegmentsRef = useRef<Array<{ startMs: number; endMs: number }>>([]);
  const customerSpeechStartedAtRef = useRef<number | null>(null);
  const recordingVadStartedAtRef = useRef(0);
  const customerSpeechActiveRef = useRef(false);
  const remoteAnalyserTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteAnalyserNodesRef = useRef<AudioNode[]>([]);
  const recordingPausedRef = useRef(false);
  const trustedAgentRecordingStartAttemptsRef = useRef<Set<string>>(new Set());
  const trustedAgentRecordingStartedRef = useRef<Set<string>>(new Set());
  const trustedAgentRecordingFinalizedRef = useRef<Set<string>>(new Set());
  const callContextRef = useRef(callContext);
  callContextRef.current = callContext;

  useEffect(() => {
    callContextRef.current.setMediaHealth(audioHealth);
  }, [audioHealth]);

  const schedulePostCallRegistrationRecovery = useCallback((endedSession: Session | null) => {
    window.setTimeout(() => {
      const currentSession = sessionRef.current;
      if (currentSession && currentSession !== endedSession) {
        console.log("[SIP] Skipping post-call registration recovery during a newer call");
        return;
      }
      void ensureRegistered().then((registered) => {
        if (!registered) {
          console.warn("[SIP] Post-call registration recovery is still pending");
        }
      });
    }, 250);
  }, [ensureRegistered]);

  const { data: globalSipSettings, isLoading: sipSettingsLoading } = useQuery<SipSettings | null>({
    queryKey: ["/api/sip-settings"],
    retry: false,
  });

  const { data: authData, isLoading: userLoading } = useQuery<{ user: User | null }>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  
  const currentUser = authData?.user;

  const createCallLogMutation = useMutation({
    mutationFn: async (data: {
      phoneNumber: string;
      direction: string;
      status: string;
      userId?: string;
      customerId?: string;
      campaignId?: string;
      campaignContactId?: string;
      customerName?: string;
      inboundQueueId?: string;
      inboundQueueName?: string;
      inboundCallLogId?: string;
      metadata?: string;
    }) => {
      const res = await apiRequest("POST", "/api/call-logs", data);
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      if (variables.customerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "call-logs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers", Number(variables.customerId), "call-logs"] });
      }
    }
  });

  const updateCallLogMutation = useMutation({
    mutationFn: async ({ id, data, customerId }: { id: number; data: { status?: string; endedAt?: string; answeredAt?: string; duration?: number; durationSeconds?: number; notes?: string; hungUpBy?: string; customerId?: string }; customerId?: string }) => {
      const res = await apiRequest("PATCH", `/api/call-logs/${id}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      const cid = variables.customerId || (variables.data as any)?.customerId;
      if (cid) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", cid, "call-logs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers", Number(cid), "call-logs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/entity-history", cid] });
      }
    }
  });

  const cleanupRecordingAnalysis = useCallback(() => {
    if (remoteAnalyserTimerRef.current) {
      clearInterval(remoteAnalyserTimerRef.current);
      remoteAnalyserTimerRef.current = null;
    }
    if (customerSpeechActiveRef.current && customerSpeechStartedAtRef.current !== null) {
      customerActivitySegmentsRef.current.push({
        startMs: Math.max(0, customerSpeechStartedAtRef.current - recordingVadStartedAtRef.current),
        endMs: Math.max(0, Date.now() - recordingVadStartedAtRef.current),
      });
    }
    customerSpeechActiveRef.current = false;
    customerSpeechStartedAtRef.current = null;
    for (const node of remoteAnalyserNodesRef.current) {
      try { node.disconnect(); } catch {}
    }
    remoteAnalyserNodesRef.current = [];
  }, []);

  const discardLocalRecording = useCallback(() => {
    cleanupRecordingAnalysis();
    recordingPausedRef.current = false;
    if (pauseToneNodesRef.current) {
      for (const oscillator of pauseToneNodesRef.current.oscillators) {
        try { oscillator.stop(); oscillator.disconnect(); } catch {}
      }
      for (const gain of pauseToneNodesRef.current.gains) {
        try { gain.disconnect(); } catch {}
      }
      pauseToneNodesRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try { recorder.stop(); } catch {}
    }
    recordingChunksRef.current = [];
    recordingDestinationRef.current = null;
    recordingSourceNodesRef.current = [];
    isRecordingRef.current = false;
    callContextRef.current.setIsRecording(false);
    callContextRef.current.setIsRecordingPaused(false);
    if (recordingContextRef.current && recordingContextRef.current.state !== "closed") {
      try { recordingContextRef.current.close(); } catch {}
    }
    recordingContextRef.current = null;
  }, [cleanupRecordingAnalysis]);

  const startRecording = useCallback((session: Session, recordingSnapshot?: MissionCallRecordingSnapshot) => {
    try {
      if (recordingSnapshot && !recordingSnapshot.active) {
        console.log("[Recording] Mission policy is inactive; recording not started");
        return;
      }
      console.log("[Recording] startRecording called, session state:", (session as any)?.state);
      const sdh = session.sessionDescriptionHandler;
      if (!sdh) { console.warn("[Recording] No sessionDescriptionHandler - cannot record"); return; }
      const pc = (sdh as any).peerConnection as RTCPeerConnection;
      if (!pc) { console.warn("[Recording] No peerConnection - cannot record"); return; }
      console.log("[Recording] PC state:", pc.connectionState, "senders:", pc.getSenders().length, "receivers:", pc.getReceivers().length);

      const recCtx = new AudioContext();
      recordingContextRef.current = recCtx;
      const destination = recCtx.createMediaStreamDestination();
      recordingDestinationRef.current = destination;
      recordingSourceNodesRef.current = [];
      recordingSnapshotRef.current = recordingSnapshot;
      recordingVadStartedAtRef.current = Date.now();
      customerActivitySegmentsRef.current = [];
      customerSpeechActiveRef.current = false;
      customerSpeechStartedAtRef.current = null;

      const localSenders = pc.getSenders();
      const localAudioSender = localSenders.find(s => s.track?.kind === "audio");
      if (localAudioSender?.track) {
        const localStream = new MediaStream([localAudioSender.track]);
        const localSource = recCtx.createMediaStreamSource(localStream);
        localSource.connect(destination);
        recordingSourceNodesRef.current.push(localSource);
      }

      const connectRemoteTrack = (track: MediaStreamTrack) => {
        if (track.kind === "audio" && recCtx.state !== "closed") {
          try {
            const remoteStream = new MediaStream([track]);
            const remoteSource = recCtx.createMediaStreamSource(remoteStream);
            if (recordingSnapshot?.mode === "agent_only") {
              // Never connect customer audio to the recorded destination. It is
              // analysed only to preserve an activity audit without retaining speech.
              const analyser = recCtx.createAnalyser();
              analyser.fftSize = 1024;
              analyser.smoothingTimeConstant = 0.6;
              remoteSource.connect(analyser);
              remoteAnalyserNodesRef.current.push(remoteSource, analyser);
              const samples = new Uint8Array(analyser.fftSize);
              let lastSpeechAt = 0;
              const injectSoftTone = () => {
                if (recordingPausedRef.current || recCtx.state === "closed") return;
                const osc = recCtx.createOscillator();
                const gain = recCtx.createGain();
                const now = recCtx.currentTime;
                osc.frequency.setValueAtTime(880, now);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.018, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.connect(gain);
                gain.connect(destination);
                osc.start(now);
                osc.stop(now + 0.13);
                osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
              };
              if (!remoteAnalyserTimerRef.current) {
                remoteAnalyserTimerRef.current = setInterval(() => {
                  if (recCtx.state === "closed") return;
                  analyser.getByteTimeDomainData(samples);
                  let sum = 0;
                  for (let index = 0; index < samples.length; index++) {
                    const sample = samples[index];
                    const normalized = (sample - 128) / 128;
                    sum += normalized * normalized;
                  }
                  const speaking = Math.sqrt(sum / samples.length) > 0.018;
                  const now = Date.now();
                  if (speaking) {
                    lastSpeechAt = now;
                    if (!customerSpeechActiveRef.current) {
                      customerSpeechActiveRef.current = true;
                      customerSpeechStartedAtRef.current = now;
                      injectSoftTone();
                    }
                  } else if (customerSpeechActiveRef.current && now - lastSpeechAt > 500) {
                    customerActivitySegmentsRef.current.push({
                      startMs: Math.max(0, (customerSpeechStartedAtRef.current || now) - recordingVadStartedAtRef.current),
                      endMs: Math.max(0, lastSpeechAt - recordingVadStartedAtRef.current),
                    });
                    customerSpeechActiveRef.current = false;
                    customerSpeechStartedAtRef.current = null;
                  }
                }, 100);
              }
            } else {
              remoteSource.connect(destination);
              recordingSourceNodesRef.current.push(remoteSource);
              console.log("[Recording] Remote audio track connected to recorder");
            }
          } catch (e) {
            console.warn("[Recording] Could not connect remote track:", e);
          }
        }
      };

      const remoteReceivers = pc.getReceivers();
      const remoteAudioReceiver = remoteReceivers.find(r => r.track?.kind === "audio");
      if (remoteAudioReceiver?.track) {
        connectRemoteTrack(remoteAudioReceiver.track);
      }

      const origOnTrack = pc.ontrack;
      pc.ontrack = (event) => {
        connectRemoteTrack(event.track);
        if (typeof origOnTrack === "function") {
          origOnTrack.call(pc, event);
        }
      };

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";

      recordingChunksRef.current = [];
      const recorder = new MediaRecorder(destination.stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordingChunksRef.current.push(e.data);
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      isRecordingRef.current = true;
      callContextRef.current.setIsRecording(true);
      callContextRef.current.setIsRecordingPaused(false);
      console.log("[Recording] Started recording call");
    } catch (err) {
      console.error("[Recording] Failed to start recording:", err);
    }
  }, []);

  const startTrustedAgentRecording = useCallback(async (
    callLogId: string | number,
    session: Session,
    snapshot: MissionCallRecordingSnapshot,
  ) => {
    if (!snapshot.active || snapshot.mode !== "agent_only") return false;
    const key = String(callLogId);
    if (trustedAgentRecordingStartedRef.current.has(key)) return true;
    if (trustedAgentRecordingStartAttemptsRef.current.has(key)) return false;
    trustedAgentRecordingStartAttemptsRef.current.add(key);
    try {
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await apiRequest("PATCH", `/api/call-logs/${key}`, {
            status: "answered",
            answeredAt: new Date().toISOString(),
          });
          await apiRequest("POST", `/api/call-logs/${key}/start-agent-recording`, {});
          trustedAgentRecordingStartedRef.current.add(key);
          const activeFinalizer = activeSessionFinalizeRef.current;
          if (
            sessionRef.current === session &&
            activeFinalizer?.session === session &&
            String(session.state) !== "Terminated"
          ) {
            startRecording(session, snapshot);
          } else {
            console.log("[Recording] Skipping local recording start for a finalized call");
          }
          return true;
        } catch (error: any) {
          const status = Number(error?.status || 0);
          const retryableBindingFailure = status === 409 &&
            String(error?.message || "").includes("bind this call log");
          console.warn(`[Recording] Trusted start attempt ${attempt}/5 failed`, {
            status,
            message: error?.message || String(error),
          });
          if (!retryableBindingFailure || attempt === 5) throw error;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error("[Recording] Trusted agent-only recording failed to start:", error);
      discardLocalRecording();
      return false;
    }
  }, [discardLocalRecording, startRecording]);

  const finalizeTrustedAgentRecording = useCallback(async (callLogId: string | number) => {
    const snapshot = recordingSnapshotRef.current;
    if (!snapshot?.active || snapshot.mode !== "agent_only") return false;
    const key = String(callLogId);
    if (trustedAgentRecordingFinalizedRef.current.has(key)) return true;
    trustedAgentRecordingFinalizedRef.current.add(key);
    cleanupRecordingAnalysis();
    const customerActivitySegments = [...customerActivitySegmentsRef.current];
    // Browser audio is only a transient VAD source in this mode. Discard it
    // before any asynchronous work so no path can upload the local blob.
    discardLocalRecording();
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await apiRequest("POST", `/api/call-logs/${key}/finalize-agent-recording`, {
            customerActivitySegments,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/call-recordings"] });
          queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
          queryClient.invalidateQueries({ queryKey: ["/api/call-logs/browse"] });
          return true;
        } catch (error) {
          console.error(`[Recording] Trusted agent-only recording finalize attempt ${attempt}/3 failed:`, error);
          if (attempt === 3) throw error;
          await new Promise(resolve => setTimeout(resolve, attempt * 500));
        }
      }
    } catch (error) {
      console.error("[Recording] Trusted agent-only recording failed to finalize:", error);
      trustedAgentRecordingFinalizedRef.current.delete(key);
      return false;
    }
    return false;
  }, [cleanupRecordingAnalysis, discardLocalRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      recordingPausedRef.current = true;
      const recCtx = recordingContextRef.current;
      const destination = recordingDestinationRef.current;
      if (recCtx && destination && recCtx.state !== "closed") {
        for (const src of recordingSourceNodesRef.current) {
          try { src.disconnect(destination); } catch (e) {}
        }

        const osc = recCtx.createOscillator();
        const gainNode = recCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, recCtx.currentTime);
        osc.frequency.setValueAtTime(523.25, recCtx.currentTime + 0.15);
        osc.frequency.setValueAtTime(659.25, recCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0, recCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.08, recCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.08, recCtx.currentTime + 0.4);
        gainNode.gain.linearRampToValueAtTime(0, recCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0, recCtx.currentTime + 0.5);

        const lfo = recCtx.createOscillator();
        const lfoGain = recCtx.createGain();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(1.0, recCtx.currentTime);
        lfoGain.gain.setValueAtTime(0.015, recCtx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        lfo.start(recCtx.currentTime + 0.5);

        const sustainOsc = recCtx.createOscillator();
        const sustainGain = recCtx.createGain();
        sustainOsc.type = "sine";
        sustainOsc.frequency.setValueAtTime(523.25, recCtx.currentTime + 0.5);
        sustainGain.gain.setValueAtTime(0, recCtx.currentTime);
        sustainGain.gain.setValueAtTime(0, recCtx.currentTime + 0.5);
        sustainGain.gain.linearRampToValueAtTime(0.03, recCtx.currentTime + 0.6);

        osc.connect(gainNode);
        gainNode.connect(destination);
        sustainOsc.connect(sustainGain);
        sustainGain.connect(destination);
        osc.start(recCtx.currentTime);
        sustainOsc.start(recCtx.currentTime + 0.5);
        osc.stop(recCtx.currentTime + 0.5);

        pauseToneNodesRef.current = {
          oscillators: [sustainOsc, lfo],
          gains: [sustainGain, lfoGain],
        };

        console.log("[Recording] Paused - tone injected into recording");
      }
      callContextRef.current.setIsRecordingPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      recordingPausedRef.current = false;
      const recCtx = recordingContextRef.current;
      const destination = recordingDestinationRef.current;
      if (recCtx && destination && recCtx.state !== "closed") {
        if (pauseToneNodesRef.current) {
          for (const g of pauseToneNodesRef.current.gains) {
            try { g.gain.cancelScheduledValues(recCtx.currentTime); g.gain.linearRampToValueAtTime(0, recCtx.currentTime + 0.3); } catch (e) {}
          }
          for (const o of pauseToneNodesRef.current.oscillators) {
            try { o.stop(recCtx.currentTime + 0.35); o.disconnect(); } catch (e) {}
          }
          for (const g of pauseToneNodesRef.current.gains) {
            try { g.disconnect(); } catch (e) {}
          }
          pauseToneNodesRef.current = null;
        }

        const resumeOsc = recCtx.createOscillator();
        const resumeGain = recCtx.createGain();
        resumeOsc.type = "sine";
        resumeOsc.frequency.setValueAtTime(659.25, recCtx.currentTime);
        resumeOsc.frequency.setValueAtTime(523.25, recCtx.currentTime + 0.1);
        resumeOsc.frequency.setValueAtTime(440, recCtx.currentTime + 0.2);
        resumeGain.gain.setValueAtTime(0, recCtx.currentTime);
        resumeGain.gain.linearRampToValueAtTime(0.08, recCtx.currentTime + 0.03);
        resumeGain.gain.setValueAtTime(0.08, recCtx.currentTime + 0.25);
        resumeGain.gain.linearRampToValueAtTime(0, recCtx.currentTime + 0.35);
        resumeOsc.connect(resumeGain);
        resumeGain.connect(destination);
        resumeOsc.start(recCtx.currentTime);
        resumeOsc.stop(recCtx.currentTime + 0.4);

        setTimeout(() => {
          if (recCtx.state !== "closed" && destination) {
            for (const src of recordingSourceNodesRef.current) {
              try { src.connect(destination); } catch (e) {}
            }
          }
        }, 400);

        console.log("[Recording] Resumed - tone fading, real audio reconnecting");
      }
      callContextRef.current.setIsRecordingPaused(false);
    }
  }, []);

  const manualStartRecording = useCallback(() => {
    if (isRecordingRef.current) return;
    const snapshot = recordingSnapshotRef.current;
    if (snapshot && !snapshot.active) {
      console.warn("[Recording] Manual recording blocked by inactive Mission policy");
      return;
    }
    const session = sessionRef.current;
    if (session) {
      if (snapshot?.mode === "agent_only") {
        if (currentCallLogIdRef.current) {
          void startTrustedAgentRecording(currentCallLogIdRef.current, session, snapshot);
        }
        return;
      }
      startRecording(session, snapshot);
    }
  }, [startRecording, startTrustedAgentRecording]);

  const manualStopRecording = useCallback(() => {
    if (recordingSnapshotRef.current?.active && recordingSnapshotRef.current.mode === "agent_only") {
      if (currentCallLogIdRef.current) {
        void finalizeTrustedAgentRecording(currentCallLogIdRef.current);
      } else {
        discardLocalRecording();
      }
      return;
    }
    if (!isRecordingRef.current || !mediaRecorderRef.current) return;
    isRecordingRef.current = false;
    callContextRef.current.setIsRecording(false);
    callContextRef.current.setIsRecordingPaused(false);
    recordingPausedRef.current = false;
    cleanupRecordingAnalysis();
    if (pauseToneNodesRef.current) {
      for (const o of pauseToneNodesRef.current.oscillators) { try { o.stop(); o.disconnect(); } catch (e) {} }
      for (const g of pauseToneNodesRef.current.gains) { try { g.disconnect(); } catch (e) {} }
      pauseToneNodesRef.current = null;
    }
    try { mediaRecorderRef.current.stop(); } catch (e) {}
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    recordingDestinationRef.current = null;
    recordingSourceNodesRef.current = [];
    if (recordingContextRef.current && recordingContextRef.current.state !== "closed") {
      try { recordingContextRef.current.close(); } catch (e) {}
      recordingContextRef.current = null;
    }
  }, [cleanupRecordingAnalysis, discardLocalRecording, finalizeTrustedAgentRecording]);

  useEffect(() => {
    const ctx = callContextRef.current;
    ctx.pauseRecordingFn.current = pauseRecording;
    ctx.resumeRecordingFn.current = resumeRecording;
    ctx.startRecordingFn.current = manualStartRecording;
    ctx.stopRecordingFn.current = manualStopRecording;
    return () => {
      ctx.pauseRecordingFn.current = null;
      ctx.resumeRecordingFn.current = null;
      ctx.startRecordingFn.current = null;
      ctx.stopRecordingFn.current = null;
    };
  }, [pauseRecording, resumeRecording, manualStartRecording, manualStopRecording]);

  const stopRecordingAndUpload = useCallback((callLogId: string | number, duration: number) => {
    if (recordingSnapshotRef.current?.active && recordingSnapshotRef.current.mode === "agent_only") {
      void finalizeTrustedAgentRecording(callLogId);
      return;
    }
    if (!mediaRecorderRef.current || !isRecordingRef.current) return;
    isRecordingRef.current = false;
    callContextRef.current.setIsRecording(false);
    callContextRef.current.setIsRecordingPaused(false);
    recordingPausedRef.current = false;
    cleanupRecordingAnalysis();
    if (pauseToneNodesRef.current) {
      for (const o of pauseToneNodesRef.current.oscillators) { try { o.stop(); o.disconnect(); } catch (e) {} }
      for (const g of pauseToneNodesRef.current.gains) { try { g.disconnect(); } catch (e) {} }
      pauseToneNodesRef.current = null;
    }
    recordingDestinationRef.current = null;
    recordingSourceNodesRef.current = [];

    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;

    recorder.onstop = () => {
      const chunks = recordingChunksRef.current;
      recordingChunksRef.current = [];

      if (chunks.length === 0) {
        console.warn("[Recording] No data recorded");
        return;
      }

      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunks, { type: mimeType });
      console.log(`[Recording] Blob ready: ${(blob.size / 1024).toFixed(1)} KB`);

      const formData = new FormData();
      const ext = mimeType.includes("ogg") ? "ogg" : "webm";
      formData.append("recording", blob, `recording.${ext}`);
      formData.append("callLogId", String(callLogId));
      formData.append("customerId", localCustomerId || "");
      formData.append("campaignId", localCampaignId || "");
      formData.append("customerName", localCustomerName || "");
      formData.append("agentName", currentUser?.fullName || currentUser?.username || "");
      formData.append("campaignName", localCampaignName || "");
      formData.append("phoneNumber", phoneNumber);
      formData.append("durationSeconds", String(duration));
      if (recordingSnapshotRef.current) {
        formData.append("recordingSnapshot", JSON.stringify(recordingSnapshotRef.current));
        formData.append("recordingMode", recordingSnapshotRef.current.mode);
        formData.append("customerActivitySegments", JSON.stringify(customerActivitySegmentsRef.current));
      }
      if (activeInboundMetaRef.current?.direction) {
        formData.append("direction", activeInboundMetaRef.current.direction);
      }
      if (activeInboundMetaRef.current?.queueId) {
        formData.append("inboundQueueId", activeInboundMetaRef.current.queueId);
      }
      if (activeInboundMetaRef.current?.queueName) {
        formData.append("inboundQueueName", activeInboundMetaRef.current.queueName);
      }

      fetch("/api/call-recordings", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
        .then(res => res.json())
        .then(data => {
          console.log("[Recording] Uploaded successfully:", data.id);
          queryClient.invalidateQueries({ queryKey: ["/api/call-recordings"] });
        })
        .catch(err => {
          console.error("[Recording] Upload failed:", err);
        });
    };

    try {
      recorder.stop();
    } catch (e) {
      console.error("[Recording] Error stopping recorder:", e);
    }

    if (recordingContextRef.current) {
      try {
        recordingContextRef.current.close();
      } catch (e) {}
      recordingContextRef.current = null;
    }
  }, [localCustomerId, localCampaignId, localCampaignName, localCustomerName, currentUser, phoneNumber, cleanupRecordingAnalysis, finalizeTrustedAgentRecording]);

  const isSipConfigured = Boolean(
    globalSipSettings?.server && 
    currentUser && 
    (currentUser as any).sipEnabled && 
    (currentUser as any).sipExtension
  );
  
  const isLoading = sipSettingsLoading || userLoading;

  useEffect(() => {
    if (globalSipSettings?.server && currentUser && (currentUser as any).sipEnabled && (currentUser as any).sipExtension) {
      const userSipConfig: SipConfig = {
        server: globalSipSettings.server,
        port: globalSipSettings.port || undefined,
        wsPath: globalSipSettings.wsPath || undefined,
        realm: globalSipSettings.realm || undefined,
        transport: globalSipSettings.transport || undefined,
        username: (currentUser as any).sipExtension || "",
        password: (currentUser as any).sipPassword || "",
        displayName: (currentUser as any).sipDisplayName || currentUser.fullName,
      };
      setSipConfig(userSipConfig);
    }
  }, [globalSipSettings, currentUser]);

  useEffect(() => {
    setPhoneNumber(initialNumber);
  }, [initialNumber]);

  useEffect(() => {
    if (callContextRef.current.callState === "idle" && callState !== "idle") {
      setCallStateLocal("idle");
      setCallDuration(0);
      sessionRef.current = null;
    }
  }, [callContext.callState]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const clearMediaHealthMonitoring = useCallback(() => {
    mediaHealthCleanupRef.current?.();
    mediaHealthCleanupRef.current = null;
    mediaHealthSessionRef.current = null;
    setAudioHealth("idle");
  }, []);

  const releaseMicrophonePipeline = useCallback(() => {
    try { micSourceNodeRef.current?.disconnect(); } catch (_) {}
    try { micGainNodeRef.current?.disconnect(); } catch (_) {}
    try { micRawTrackRef.current?.stop(); } catch (_) {}
    try { micProcessedTrackRef.current?.stop(); } catch (_) {}
    micSourceNodeRef.current = null;
    micDestinationNodeRef.current = null;
    micRawTrackRef.current = null;
    micProcessedTrackRef.current = null;
    micGainNodeRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    clearMediaHealthMonitoring();
    releaseMicrophonePipeline();
    cleanupRecordingAnalysis();
    activeSessionFinalizeRef.current = null;
    inboundFinalizeRef.current = null;
    if (hangupPollRef.current) {
      clearInterval(hangupPollRef.current);
      hangupPollRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    if (maxRingTimerRef.current) {
      clearTimeout(maxRingTimerRef.current);
      maxRingTimerRef.current = null;
    }
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (sessionRef.current) {
      try {
        if (sessionRef.current.state === SessionState.Established) {
          void endSessionBounded(sessionRef.current);
        }
      } catch (e) {
        console.error("Error ending session:", e);
      }
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
        micGainNodeRef.current = null;
      } catch (e) {
        console.error("Error closing audio context:", e);
      }
    }
  }, [cleanupRecordingAnalysis, clearMediaHealthMonitoring, releaseMicrophonePipeline]);

  const playRingtone = useCallback(() => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(425, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 1.0);
    
    setTimeout(() => audioCtx.close(), 1100);
  }, []);

  const startRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current) return;
    playRingtone();
    ringtoneIntervalRef.current = setInterval(() => {
      playRingtone();
    }, 5000);
  }, [playRingtone]);

  const stopRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  }, []);

  // "Call not connected" tone — played when an outbound call rings past the
  // mission's max ring duration without being answered. Two descending beeps
  // (congestion-style) so the agent hears the call was auto-ended.
  const playNotConnectedTone = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      const beeps = [
        { freq: 480, start: 0.0 },
        { freq: 300, start: 0.34 },
        { freq: 480, start: 0.68 },
        { freq: 300, start: 1.02 },
      ];
      const dur = 0.28;
      for (const b of beeps) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(b.freq, now + b.start);
        gain.gain.setValueAtTime(0.0001, now + b.start);
        gain.gain.exponentialRampToValueAtTime(0.14, now + b.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + b.start + dur);
        osc.start(now + b.start);
        osc.stop(now + b.start + dur + 0.02);
      }
      setTimeout(() => { try { audioCtx.close(); } catch {} }, 1500);
    } catch (e) {
      console.warn("[SIP] Failed to play not-connected tone:", e);
    }
  }, []);

  useEffect(() => {
    if (callState === "connecting" || callState === "ringing") {
      startRingtone();
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [callState, startRingtone, stopRingtone]);

  const handleInboundAnswered = useCallback((session: any, options: { autoRecord: boolean; recordingSnapshot?: MissionCallRecordingSnapshot }) => {
    console.log("[SIP-INBOUND] === handleInboundAnswered START ===");
    console.log("[SIP-INBOUND] Session state:", session?.state);
    console.log("[SIP-INBOUND] autoRecord option:", options.autoRecord);
    console.log("[SIP-INBOUND] Session has SDH:", !!session?.sessionDescriptionHandler);
    console.log("[SIP-INBOUND] Session has stateChange:", !!session?.stateChange);
    const ctx = callContextRef.current;

    if (inboundTerminatedListenerRef.current) {
      try { inboundTerminatedListenerRef.current.session.stateChange.removeListener(inboundTerminatedListenerRef.current.listener); } catch {}
      inboundTerminatedListenerRef.current = null;
    }

    sessionRef.current = session;
    serverConfirmedRemoteHangupSessionRef.current = null;
    recordingSnapshotRef.current = options.recordingSnapshot;
    customerActivitySegmentsRef.current = [];
    const callerNumber = session._inboundCallerNumber || "Unknown";
    setPhoneNumber(callerNumber);
    setCallState("active");
    ctx.setCallDirection("inbound");
    ctx.setCallInfo({
      phoneNumber: callerNumber,
      callerName: session._inboundCallerName,
      customerId: session._inboundCustomerId || undefined,
      contactType: session._inboundContactType || undefined,
      didNumber: session._inboundDidNumber || undefined,
      queueId: session._inboundQueueId || undefined,
      recordingSnapshot: options.recordingSnapshot,
      direction: "inbound",
    });
    ctx.onInboundAnsweredFn.current?.();
    setIsOnHold(false);
    ctx.resetCallTiming();
    callStartTimeRef.current = Date.now();
    ctx.setCallTiming({ callStartTime: Date.now() });
    // Expose updater so agent-workspace can sync localCustomerIdRef and DB call log when opening a different identity
    callContextRef.current.updateCallCustomerFn.current = (cid: string, context) => {
      localCustomerIdRef.current = cid;
      setLocalCustomerId(cid);
      localContactTypeRef.current = context?.contactType;
      if (context?.campaignContactId) {
        localCampaignContactIdRef.current = context.campaignContactId;
      }
      const metadata = JSON.stringify({
        didNumber: session._inboundDidNumber || null,
        sourceTrunk: session._inboundSourceTrunk || null,
        contactType: context?.contactType || null,
        entityId: cid,
          recordingPolicySnapshot: options.recordingSnapshot || null,
      });
      // Immediately PATCH the call log if it already exists (handles race with async creation)
      if (inboundCallLogIdRef.current) {
        updateCallLogMutation.mutate({
          id: inboundCallLogIdRef.current,
          data: {
            customerId: cid,
            campaignContactId: context?.campaignContactId,
            metadata,
          },
        });
      }
    };

    activeInboundMetaRef.current = {
      callId: session._inboundCallLogId ? String(session._inboundCallLogId) : undefined,
      queueId: session._inboundQueueId,
      queueName: session._inboundQueueName,
      direction: "inbound",
      session,
    };

    if (callTimerRef.current) clearInterval(callTimerRef.current);
    const timer = setInterval(() => {
      const dur = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      setCallDuration(dur);
      callContextRef.current.setCallDuration(dur);
    }, 1000);
    callTimerRef.current = timer;

    setupAudio(session, "inbound");

    const doStartRecording = (attempt: number = 1) => {
      const activeFinalizer = activeSessionFinalizeRef.current;
      if (
        sessionRef.current !== session ||
        activeFinalizer?.session !== session ||
        String(session.state) === "Terminated"
      ) {
        console.warn("[SIP-INBOUND] Session no longer active, skipping recording attempt", attempt);
        return;
      }
      console.log("[SIP-INBOUND] Starting recording attempt", attempt);
      const sdh = session.sessionDescriptionHandler;
      const pc = sdh ? (sdh as any).peerConnection as RTCPeerConnection : null;
      if (!sdh || !pc) {
        console.warn("[SIP-INBOUND] No SDH/PC yet on attempt", attempt, "sdh:", !!sdh, "pc:", !!pc);
        if (attempt < 5) {
          setTimeout(() => doStartRecording(attempt + 1), 500);
          return;
        }
        console.error("[SIP-INBOUND] Failed to start recording after 5 attempts - no peer connection");
        return;
      }
      console.log("[SIP-INBOUND] PC state:", pc.connectionState, "senders:", pc.getSenders().length, "receivers:", pc.getReceivers().length);
      startRecording(session, options.recordingSnapshot);
    };

    if (options.autoRecord && options.recordingSnapshot?.mode !== "agent_only") {
      console.log("[SIP-INBOUND] Auto-recording enabled, starting in 500ms...");
      setTimeout(() => doStartRecording(1), 500);
    } else if (options.autoRecord) {
      console.log("[SIP-INBOUND] Waiting for trusted agent-only server recording start");
    } else {
      console.log("[SIP-INBOUND] Auto-recording NOT enabled for this call");
    }

    const inboundCallLogIdRef = { current: null as number | null };
    // Stores end metadata if call terminates before createCallLogMutation resolves (race condition)
    const pendingEndMetaRef = { current: null as { duration: number; hungUpBy: string; endedAt: string; customerId?: string } | null };

    let terminatedHandled = false;
    const onTerminated = (state: any) => {
      const stateStr = String(state);
      console.log("[SIP-INBOUND] Session state changed:", stateStr);
      if (stateStr !== "Terminated" && state !== SessionState.Terminated) return;
      if (sessionRef.current !== session) {
        console.log("[SIP-INBOUND] Ignoring termination signal from a stale session");
        return;
      }
      if (terminatedHandled) { console.log("[SIP-INBOUND] onTerminated already handled, skipping duplicate"); return; }
      terminatedHandled = true;
      inboundFinalizeRef.current = null;
      if (activeSessionFinalizeRef.current?.session === session) {
        activeSessionFinalizeRef.current = null;
      }
      clearMediaHealthMonitoring();
      if (hangupPollRef.current) { clearInterval(hangupPollRef.current); hangupPollRef.current = null; }
      console.log("[SIP-INBOUND] === CALL TERMINATED ===");
      inboundTerminatedListenerRef.current = null;
      const ctxNow = callContextRef.current;
      const duration = callStartTimeRef.current ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
      console.log("[SIP-INBOUND] Call duration:", duration, "seconds");
      setCallState("ended");
      flagUnstableMediaTermination(session);
      // Do NOT clear callDirection here — React batches this with setCallState("ended"),
      // causing agent-workspace effect to see callDirection===null when detecting inbound.
      // callDirection is cleared in agent-workspace's "idle" handler after disposition flow.
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      const mediaInterrupted = ["recovering", "warning", "failed"].includes(audioHealthRef.current);
      const hungUpBy = userHungUpRef.current
        ? "user"
        : serverConfirmedRemoteHangupSessionRef.current === session
          ? "customer"
          : mediaInterrupted
            ? "system"
            : "customer";
      userHungUpRef.current = false;
      if (serverConfirmedRemoteHangupSessionRef.current === session) {
        serverConfirmedRemoteHangupSessionRef.current = null;
      }
      ctxNow.setCallTiming({ callEndTime: Date.now(), talkDurationSeconds: duration > 0 ? duration : null, hungUpBy });
      const endedAt = new Date().toISOString();
      if (inboundCallLogIdRef.current) {
        // Call log already created — update duration/status/hungUpBy immediately
        // Use localCustomerIdRef (not closure) to get the identity the agent currently has open
        updateCallLogMutation.mutate({
          id: inboundCallLogIdRef.current,
          data: {
            status: duration > 0 ? "completed" : "failed",
            endedAt,
            durationSeconds: duration,
            hungUpBy,
            ...(localCustomerIdRef.current ? { customerId: localCustomerIdRef.current } : {}),
          },
        });
        if (duration > 0) {
          console.log("[SIP-INBOUND] Stopping recording and uploading, callLogId:", inboundCallLogIdRef.current);
          stopRecordingAndUpload(inboundCallLogIdRef.current, duration);
        } else {
          if (options.recordingSnapshot?.active && options.recordingSnapshot.mode === "agent_only") {
            stopRecordingAndUpload(inboundCallLogIdRef.current, 0);
          } else if (mediaRecorderRef.current) { cleanupRecordingAnalysis(); try { mediaRecorderRef.current.stop(); } catch {} mediaRecorderRef.current = null; isRecordingRef.current = false; ctxNow.setIsRecording(false); ctxNow.setIsRecordingPaused(false); recordingChunksRef.current = []; }
        }
      } else {
        // Race condition: call log not yet created — store metadata for deferred update
        console.warn("[SIP-INBOUND] Call log not yet created at termination, storing pending end meta");
        pendingEndMetaRef.current = { duration, hungUpBy, endedAt, customerId: localCustomerIdRef.current };
        if (duration > 0) {
          console.log("[SIP-INBOUND] Will stop recording, but cannot upload until call log ID is known");
        } else {
          if (mediaRecorderRef.current) { cleanupRecordingAnalysis(); try { mediaRecorderRef.current.stop(); } catch {} mediaRecorderRef.current = null; isRecordingRef.current = false; ctxNow.setIsRecording(false); ctxNow.setIsRecordingPaused(false); recordingChunksRef.current = []; }
        }
      }
      ctxNow.setAutoRecord(true);
      onCallEnd?.(duration, duration > 0 ? "completed" : "failed", inboundCallLogIdRef.current || 0);
      schedulePostCallRegistrationRecovery(session);
      setCurrentCallLogId(null);
      setLocalCallerIdNumber("");
      activeInboundMetaRef.current = null;
      if (!ctxNow.preventAutoReset) {
        setTimeout(() => {
          if (sessionRef.current !== session) {
            console.log("[SIP-INBOUND] Skipping stale auto-reset after a newer call started");
            return;
          }
          setCallStateLocal((prev) => { if (prev === "ended") { callContextRef.current.setCallState("idle"); callContextRef.current.setCallInfo(null); callContextRef.current.resetCallTiming(); return "idle"; } return prev; });
          setCallDuration(0);
          callContextRef.current.setCallDuration(0);
          sessionRef.current = null;
        }, 3000);
      }
    };
    inboundFinalizeRef.current = () => onTerminated(SessionState.Terminated);
    activeSessionFinalizeRef.current = {
      session,
      finalize: () => onTerminated(SessionState.Terminated),
    };

    if (session.stateChange) {
      session.stateChange.addListener(onTerminated);
      inboundTerminatedListenerRef.current = { session, listener: onTerminated };
      console.log("[SIP-INBOUND] Terminated listener added successfully");
    } else {
      console.error("[SIP-INBOUND] CRITICAL: session.stateChange is undefined! Cannot detect hang-up!");
    }

    const currentSessionState = String(session.state);
    if (currentSessionState === "Terminated") {
      console.warn("[SIP-INBOUND] Session already terminated at listener setup time!");
      onTerminated(SessionState.Terminated);
    } else {
      console.log("[SIP-INBOUND] Session state at setup:", currentSessionState);

      // Helper to trigger hangup via a named mechanism (avoids duplicate firing)
      const triggerHangupDetection = (source: string) => {
        if (terminatedHandled || sessionRef.current !== session) return;
        const sessionAny = session as any;
        if (
          source !== "SIP stateChange poll" &&
          (
            sipIsHeld(session) ||
            isHoldTransitioning(session) ||
            sessionAny.__holdRecoveryInProgress ||
            (sessionAny.__postHoldRecoveryActive && Date.now() < Number(sessionAny.__postHoldRecoveryUntil || 0))
          )
        ) {
          requestHeldCallRecoveryRef.current(session, source);
          return;
        }
        console.warn(`[SIP-INBOUND] Hang-up detected via: ${source}`);
        if (hangupPollRef.current) { clearInterval(hangupPollRef.current); hangupPollRef.current = null; }
        onTerminated(SessionState.Terminated);
      };

      // Poll: check SIP session state + PeerConnection state every second
      if (hangupPollRef.current) clearInterval(hangupPollRef.current);
      hangupPollRef.current = setInterval(() => {
        if (terminatedHandled) { clearInterval(hangupPollRef.current!); hangupPollRef.current = null; return; }
        const pollState = String(session.state);
        if (pollState === "Terminated") { triggerHangupDetection("SIP stateChange poll"); return; }
        // PeerConnection failure is a recoverable media incident, not proof
        // that the caller ended the SIP dialog. Media-health monitoring owns
        // ICE recovery; only SIP/server termination may finalize the call.
        const sdhNow = session.sessionDescriptionHandler;
        const pcNow: RTCPeerConnection | null = sdhNow ? (sdhNow as any).peerConnection : null;
        if (pcNow) {
          const connState = pcNow.connectionState;
          const iceState = pcNow.iceConnectionState;
          console.log(`[SIP-INBOUND] Poll: sipState=${pollState} pcConn=${connState} ice=${iceState}`);
        }
      }, 1000);

      // Attach PeerConnection event listeners as soon as it's available
      const attachPcMonitoring = (attempt: number = 1) => {
        if (terminatedHandled) return;
        const sdh2 = session.sessionDescriptionHandler;
        const pc2: RTCPeerConnection | null = sdh2 ? (sdh2 as any).peerConnection : null;
        if (!pc2) {
          if (attempt < 15) setTimeout(() => attachPcMonitoring(attempt + 1), 400);
          return;
        }
        console.log("[SIP-INBOUND] PeerConnection monitoring attached (attempt", attempt, ")");

        pc2.addEventListener("connectionstatechange", () => {
          const s = pc2.connectionState;
          console.log("[SIP-INBOUND] PC connectionstatechange:", s);
        });
        pc2.addEventListener("iceconnectionstatechange", () => {
          const s = pc2.iceConnectionState;
          console.log("[SIP-INBOUND] PC iceconnectionstatechange:", s);
        });

        // Monitor remote audio track "ended" event
        const attachTrackEndedListener = (track: MediaStreamTrack) => {
          if (track.kind !== "audio") return;
          track.addEventListener("ended", () => {
            console.log("[SIP-INBOUND] Remote audio track ended");
          });
        };
        pc2.getReceivers().forEach(r => { if (r.track) attachTrackEndedListener(r.track); });
        pc2.addEventListener("track", (ev: RTCTrackEvent) => attachTrackEndedListener(ev.track));
      };
      attachPcMonitoring();
    }

    // For inbound calls, always look up the caller by phone number to get the correct
    // customerId — never use localCustomerId which reflects whatever the agent had open.
    const resolveInboundCustomerId = async (phone: string): Promise<string | undefined> => {
      if (!phone || phone === "Unknown") return undefined;
      try {
        const res = await fetch(`/api/customers/lookup-phone?phone=${encodeURIComponent(phone)}`, { credentials: "include" });
        if (res.ok) {
          const matched = await res.json();
          if (matched?.id) {
            console.log("[SIP-INBOUND] Caller matched to customer:", matched.id);
            return String(matched.id);
          }
        }
      } catch (err) {
        console.warn("[SIP-INBOUND] Phone lookup failed:", err);
      }
      return undefined;
    };

    createCallLogMutation.mutateAsync({
      phoneNumber: callerNumber,
      direction: "inbound",
      status: "answered",
      userId: userId || currentUser?.id,
      customerId: undefined,
      customerName: session._inboundCallerName || callerNumber,
      inboundQueueId: session._inboundQueueId || undefined,
      inboundQueueName: session._inboundQueueName || undefined,
      inboundCallLogId: session._inboundCallLogId || undefined,
      campaignId: session._inboundCampaignId || undefined,
      metadata: JSON.stringify({
        didNumber: session._inboundDidNumber || null,
        sourceTrunk: session._inboundSourceTrunk || null,
        contactType: session._inboundContactType || null,
        recordingPolicySnapshot: options.recordingSnapshot || null,
      }),
    }).then(async (callLogData) => {
      setCurrentCallLogId(callLogData.id);
      currentCallLogIdRef.current = callLogData.id;
      inboundCallLogIdRef.current = callLogData.id;
      console.log("[SIP-INBOUND] Call log created, id:", callLogData.id);
      if (options.recordingSnapshot?.active && options.recordingSnapshot.mode === "agent_only") {
        await startTrustedAgentRecording(callLogData.id, session, options.recordingSnapshot);
      }

      // Resolve the actual caller's customerId and update both the callLog and local state
      const resolvedCustomerId = await resolveInboundCustomerId(callerNumber);
      if (resolvedCustomerId) {
        setLocalCustomerId(resolvedCustomerId);
        localCustomerIdRef.current = resolvedCustomerId;
      }

      updateCallLogMutation.mutate({
        id: callLogData.id,
        data: { status: "answered", answeredAt: new Date().toISOString(), ...(resolvedCustomerId ? { customerId: resolvedCustomerId } : {}) },
        customerId: resolvedCustomerId
      });

      // Race condition: call already ended before log was created — apply deferred end metadata
      if (pendingEndMetaRef.current) {
        const m = pendingEndMetaRef.current;
        pendingEndMetaRef.current = null;
        console.log("[SIP-INBOUND] Applying deferred end meta to call log:", callLogData.id, "duration:", m.duration);
        updateCallLogMutation.mutate({
          id: callLogData.id,
          data: {
            status: m.duration > 0 ? "completed" : "failed",
            endedAt: m.endedAt,
            durationSeconds: m.duration,
            hungUpBy: m.hungUpBy,
            ...(m.customerId ? { customerId: m.customerId } : {}),
          },
          customerId: m.customerId || resolvedCustomerId,
        });
        if (m.duration > 0 || (options.recordingSnapshot?.active && options.recordingSnapshot.mode === "agent_only")) {
          stopRecordingAndUpload(callLogData.id, m.duration);
        }
      }

      onCallStart?.(callerNumber, callLogData.id);
    }).catch((err) => {
      console.error("[SIP-INBOUND] Failed to create call log:", err);
    });
  }, [startRecording, startTrustedAgentRecording, stopRecordingAndUpload, cleanupRecordingAnalysis, onCallStart, onCallEnd, schedulePostCallRegistrationRecovery]);

  const handleInboundAnsweredRef = useRef(handleInboundAnswered);
  handleInboundAnsweredRef.current = handleInboundAnswered;

  useEffect(() => {
    const ctx = callContextRef.current;
    ctx.handleInboundAnsweredFn.current = (...args: Parameters<typeof handleInboundAnswered>) => handleInboundAnsweredRef.current(...args);
    if (ctx.queuedInboundSession.current) {
      console.log("[SIP] Processing queued inbound session on registration");
      const queued = ctx.queuedInboundSession.current;
      ctx.queuedInboundSession.current = null;
      handleInboundAnsweredRef.current(queued.session, queued.options);
    }
    return () => {
      ctx.handleInboundAnsweredFn.current = null;
      if (inboundTerminatedListenerRef.current) {
        try { inboundTerminatedListenerRef.current.session.stateChange.removeListener(inboundTerminatedListenerRef.current.listener); } catch {}
        inboundTerminatedListenerRef.current = null;
      }
      if (hangupPollRef.current) { clearInterval(hangupPollRef.current); hangupPollRef.current = null; }
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!answeredIncomingSession) return;
    if (sipPhoneAnsweredRef.current) {
      console.log("[SIP-INBOUND] Skipping answeredIncomingSession fallback - already handled by SipPhone answer button");
      sipPhoneAnsweredRef.current = false;
      clearAnsweredSession();
      return;
    }
    console.log("[SIP-INBOUND] answeredIncomingSession changed (fallback path), calling handleInboundAnswered");
    const session = answeredIncomingSession;
    clearAnsweredSession();
    const recordingSnapshot = session._inboundRecordingSnapshot as MissionCallRecordingSnapshot | undefined;
    const shouldRecord = recordingSnapshot ? recordingSnapshot.active : (callContextRef.current.autoRecord || session._inboundRecordCalls);
    handleInboundAnsweredRef.current(session, { autoRecord: shouldRecord, recordingSnapshot });
  }, [answeredIncomingSession]);

  const connect = useCallback(async () => {
    if (!sipConfig.server || !sipConfig.username || !sipConfig.password) {
      toast({
        title: "Chyba konfigurácie",
        description: "Prosím vyplňte všetky SIP údaje",
        variant: "destructive"
      });
      setIsConfigOpen(true);
      return;
    }
    await register();
    try {
      const resp = await fetch(`/api/sip/outbound-callerid/${encodeURIComponent(sipConfig.username)}`, { credentials: "include" });
      if (resp.ok) {
        const data = await resp.json();
        if (data.outboundCallerId) {
          setCollaboratorCallerId(data.outboundCallerId);
          console.log(`[SIP] Loaded collaborator outbound caller ID: ${data.outboundCallerId} for ext ${sipConfig.username}`);
        }
      }
    } catch (err) {
      console.warn("[SIP] Failed to load collaborator outbound caller ID:", err);
    }
  }, [sipConfig, toast, register]);

  const disconnect = useCallback(async () => {
    cleanup();
    setCallState("idle");
    await unregister();
    toast({
      title: "Odpojené",
      description: "SIP telefón bol odpojený"
    });
  }, [cleanup, toast, unregister]);

  const makeCallGuardRef = useRef(false);

  const makeCall = useCallback(async () => {
    if (makeCallGuardRef.current) {
      console.log("[SIP] makeCall already in progress, ignoring duplicate");
      return;
    }
    makeCallGuardRef.current = true;
    const outboundGeneration = ++outboundGenerationRef.current;
    userHungUpRef.current = false;
    outboundAnsweredRef.current = false;
    outboundFinalStatusCodeRef.current = null;
    
    if (!isSipConfigured) {
      toast({
        title: "SIP nie je nakonfigurovaný",
        description: "Kontaktujte administrátora pre nastavenie SIP telefónu",
        variant: "destructive"
      });
      makeCallGuardRef.current = false;
      return;
    }
    
    const currentPhone = phoneNumberRef.current;
    if (!currentPhone) {
      makeCallGuardRef.current = false;
      return;
    }

    setCallState("connecting");

    const ready = await ensureRegistered();
    if (!ready || !userAgentRef.current) {
      toast({
        title: "Nepripojené",
        description: "Nepodarilo sa pripojiť k SIP serveru. Skúste znova.",
        variant: "destructive"
      });
      setCallState("idle");
      callContextRef.current.setCallState("idle");
      makeCallGuardRef.current = false;
      return;
    }

    try {
      callContextRef.current.resetCallTiming();
      
      const callLogData = await createCallLogMutation.mutateAsync({
        phoneNumber: currentPhone,
        direction: "outbound",
        status: "initiated",
        userId: userId || currentUser?.id,
        customerId: localCustomerIdRef.current,
        // pendingCall updates state and refs immediately before dialing. The state
        // value in this callback can still belong to the previous render, while
        // the ref already contains the Mission selected for this exact call.
        campaignId: localCampaignIdRef.current,
        campaignContactId: localCampaignContactIdRef.current,
        customerName: localCustomerName,
        metadata: JSON.stringify({
          contactType: localContactTypeRef.current || null,
          provider: localProviderRef.current || null,
          outboundTrunk: localOutboundTrunkRef.current,
          callerIdNumber: localCallerIdNumberRef.current || collaboratorCallerIdRef.current || null,
          recordingPolicySnapshot: recordingSnapshotRef.current || null,
        }),
      });
      if (localCampaignIdRef.current) {
        // The server resolves the immutable Mission policy from persisted
        // settings when it creates the call log. Use that authoritative
        // snapshot for the actual call instead of a possibly stale campaign
        // object still held by the browser.
        let serverRecordingSnapshot: MissionCallRecordingSnapshot | undefined;
        try {
          const serverMetadata = typeof callLogData.metadata === "string"
            ? JSON.parse(callLogData.metadata)
            : callLogData.metadata;
          const candidate = serverMetadata?.recordingPolicySnapshot;
          if (candidate && typeof candidate === "object") {
            serverRecordingSnapshot = candidate as MissionCallRecordingSnapshot;
          }
          const trustedMaxRingSeconds = Number(serverMetadata?.maxRingSeconds);
          maxRingSecondsRef.current = Number.isFinite(trustedMaxRingSeconds) && trustedMaxRingSeconds > 0
            ? Math.min(300, Math.floor(trustedMaxRingSeconds))
            : 0;
        } catch (error) {
          console.error("[Recording] Invalid server recording policy snapshot:", error);
        }
        recordingSnapshotRef.current = serverRecordingSnapshot;
      }
      setCurrentCallLogId(callLogData.id);
      currentCallLogIdRef.current = callLogData.id;
      
      const realm = sipConfig.realm || sipConfig.server;
      const cleanedPhone = currentPhone.replace(/[\s\-\(\)]/g, "");
      console.log(`[SIP] makeCall → raw="${currentPhone}" cleaned="${cleanedPhone}" realm="${realm}"`);
      const targetUri = UserAgent.makeURI(`sip:${cleanedPhone}@${realm}`);
      if (!targetUri) {
        console.error(`[SIP] Invalid target URI: sip:${cleanedPhone}@${realm}`);
        throw new Error(`Invalid target URI: sip:${cleanedPhone}@${realm}`);
      }

      const hasTurnServer = Boolean(
        globalSipSettings?.turnServer || globalSipSettings?.turnServerAlt,
      );
      const inviterOptions: any = {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          },
          iceGatheringTimeout: 1500,
          modifiers: [filterSdpCandidates, forceDtlsActive],
        },
        sessionDescriptionHandlerFactoryOptions: {
          iceGatheringTimeout: 1500,
          peerConnectionConfiguration: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              ...(globalSipSettings?.turnServer ? [{
                urls: globalSipSettings.turnServer,
                username: (globalSipSettings as any).turnUsername || undefined,
                credential: (globalSipSettings as any).turnPassword || undefined,
              }] : []),
              ...(globalSipSettings?.turnServerAlt ? [{
                urls: (globalSipSettings as any).turnServerAlt,
                username: (globalSipSettings as any).turnUsername || undefined,
                credential: (globalSipSettings as any).turnPassword || undefined,
              }] : []),
            ],
            // Keep the TURN allocation selected for the entire call. Allowing
            // host/srflx candidates here can make Chrome release the relay while
            // Asterisk continues sending RTP to it.
            iceTransportPolicy: hasTurnServer ? "relay" : "all",
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require",
          },
        },
      };
      const currentCallerIdNumber = localCallerIdNumberRef.current;
      const currentCollaboratorCallerId = collaboratorCallerIdRef.current;
      const effectiveCallerId = currentCallerIdNumber || currentCollaboratorCallerId;
      console.log(`[SIP] Caller ID check: campaign="${currentCallerIdNumber}", collaborator="${currentCollaboratorCallerId}", effective="${effectiveCallerId}"`);
      const extraHeaders: string[] = [];
      if (effectiveCallerId) {
        extraHeaders.push(`X-Campaign-CallerID: ${effectiveCallerId}`);
        try {
          const callerIdResponse = await fetch("/api/sip/set-outbound-callerid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              sipExtension: sipConfig.username,
              callerIdNumber: effectiveCallerId,
              campaignId: localCampaignIdRef.current,
              outboundTrunk: localOutboundTrunkRef.current,
              outboundCountry: localOutboundCountryRef.current,
            }),
          });
          if (!callerIdResponse.ok) {
            const payload = await callerIdResponse.json().catch(() => ({}));
            throw new Error(payload.error || "Failed to validate outbound Caller ID");
          }
          console.log(`[SIP] Set outbound caller ID ${effectiveCallerId} for ext ${sipConfig.username} (source: ${currentCallerIdNumber ? "campaign" : "collaborator"})`);
        } catch (err) {
          console.warn("[SIP] Failed to set outbound caller ID:", err);
          if (localOutboundTrunkRef.current !== "global") throw err;
        }
      }
      if (localProviderRef.current === "O2-IMS") {
        extraHeaders.push("X-Provider: O2-IMS");
      }
      extraHeaders.push(`X-Indexus-Outbound-Trunk: ${localOutboundTrunkRef.current}`);
      if (localCampaignIdRef.current) {
        extraHeaders.push(`X-Campaign-ID: ${localCampaignIdRef.current}`);
      }
      if (localCampaignContactIdRef.current) {
        extraHeaders.push(`X-Campaign-Contact-ID: ${localCampaignContactIdRef.current}`);
      }
      if (localContactTypeRef.current) {
        extraHeaders.push(`X-Contact-Type: ${localContactTypeRef.current}`);
      }
      if (callLogData.recordingCorrelationToken) {
        extraHeaders.push(`X-Indexus-Recording-Correlation: ${callLogData.recordingCorrelationToken}`);
      }
      if (extraHeaders.length > 0) {
        inviterOptions.extraHeaders = extraHeaders;
      }
      const inviter = new Inviter(userAgentRef.current, targetUri, inviterOptions);

      activeInboundMetaRef.current = null;
      sessionRef.current = inviter;
      serverConfirmedRemoteHangupSessionRef.current = null;
      const callLogId = callLogData.id;
      let outboundRingStartedAt = 0;

      const onOutboundStateChange = (state: SessionState) => {
        console.log("Call state:", state);
        switch (state) {
          case SessionState.Establishing:
            outboundRingStartedAt = Date.now();
            setCallState("ringing");
            callContextRef.current.setCallTiming({ ringStartTime: outboundRingStartedAt });
            updateCallLogMutation.mutate({
              id: callLogId,
              data: { status: "ringing" },
              customerId: localCustomerIdRef.current
            });
            ringTimedOutRef.current = false;
            if (maxRingTimerRef.current) {
              clearTimeout(maxRingTimerRef.current);
              maxRingTimerRef.current = null;
            }
            if (maxRingSecondsRef.current > 0) {
              const maxRing = maxRingSecondsRef.current;
              maxRingTimerRef.current = setTimeout(() => {
                const s = sessionRef.current;
                if (!shouldCancelAfterRingGrace({
                  sameSession: s === inviter,
                  sessionState: String(s?.state || ""),
                })) {
                  maxRingTimerRef.current = null;
                  return;
                }
                // A final 200 OK may already be queued at the exact ring
                // deadline while SIP.js still exposes Establishing. Give the
                // final response a short grace, then verify the same session
                // is still unanswered before sending CANCEL.
                maxRingTimerRef.current = setTimeout(() => {
                  maxRingTimerRef.current = null;
                  const current = sessionRef.current;
                  if (!shouldCancelAfterRingGrace({
                    sameSession: current === inviter,
                    sessionState: String(current?.state || ""),
                    finalResponseReceived: Boolean((inviter as any)._dialog),
                  })) return;
                  console.log(`[SIP] Max ring duration (${maxRing}s) exceeded — auto-ending unanswered call`);
                  ringTimedOutRef.current = true;
                  userHungUpRef.current = false;
                  try { (inviter as Inviter).cancel?.(); } catch (e) { console.error("[SIP] Error cancelling on max-ring timeout:", e); }
                  playNotConnectedTone();
                  toast({
                    title: t.agentWorkspace.maxRingTimeoutTitle,
                    description: t.agentWorkspace.maxRingTimeoutDesc.replace("{seconds}", String(maxRing)),
                    variant: "pulse",
                    pulseState: "ended",
                  });
                }, 1_200);
              }, maxRing * 1000);
            }
            break;
          case SessionState.Established:
            if (!shouldApplyEstablishedSessionEffects({
              sameSession: sessionRef.current === inviter,
              ownsFinalizer: activeSessionFinalizeRef.current?.session === inviter,
            })) {
              console.warn("[SIP-OUTBOUND] Stale/finalized session established; isolating it from the active call");
              if ((inviter as any).__terminationRequested) {
                void endSessionBounded(inviter).catch((error) => {
                  console.warn("[SIP-OUTBOUND] Failed to terminate stale accepted session:", error);
                });
              }
              break;
            }
            makeCallGuardRef.current = false;
            outboundAnsweredRef.current = true;
            if (maxRingTimerRef.current) {
              clearTimeout(maxRingTimerRef.current);
              maxRingTimerRef.current = null;
            }
            ringTimedOutRef.current = false;
            if ((inviter as any).__terminationRequested) {
              console.log("[SIP-OUTBOUND] Accepted late-offer call finished negotiation after hangup request; sending BYE");
              void endSessionBounded(inviter).catch((error) => {
                console.warn("[SIP-OUTBOUND] Failed to end accepted late-offer call:", error);
              });
              break;
            }
            setCallState("active");
            setIsOnHold(false);
            callStartTimeRef.current = Date.now();
            const ringEnd = Date.now();
            const ringStart = outboundRingStartedAt || callContextRef.current.callTiming.ringStartTime;
            const ringDurationMs = ringStart ? Math.max(0, ringEnd - ringStart) : 0;
            callContextRef.current.setCallTiming({
              callStartTime: ringEnd,
              ringDurationSeconds: ringStart ? Math.round(ringDurationMs / 1000) : null,
            });
            callTimerRef.current = setInterval(() => {
              setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
            }, 1000);
            updateCallLogMutation.mutate({
              id: callLogId,
              data: { status: "answered", answeredAt: new Date().toISOString() },
              customerId: localCustomerIdRef.current
            });
            onCallStart?.(phoneNumber, callLogId);
            setupAudio(inviter, "outbound");
            if (hangupPollRef.current) clearInterval(hangupPollRef.current);
            hangupPollRef.current = setInterval(() => {
              if (sessionRef.current !== inviter) {
                if (hangupPollRef.current) clearInterval(hangupPollRef.current);
                hangupPollRef.current = null;
                return;
              }
              const sipState = String(inviter.state);
              const sdh = inviter.sessionDescriptionHandler;
              const pc: RTCPeerConnection | null = sdh ? (sdh as any).peerConnection : null;
              if (sipState === "Terminated") {
                const source = "outbound SIP state poll";
                const activeFinalizer = activeSessionFinalizeRef.current;
                if (activeFinalizer?.session === inviter) {
                  activeFinalizer.finalize(source);
                }
              }
            }, 1000);
            const recordingSnapshot = recordingSnapshotRef.current;
            if (recordingSnapshot?.active && recordingSnapshot.mode === "agent_only") {
              void startTrustedAgentRecording(callLogId, inviter, recordingSnapshot);
            } else if (recordingSnapshot ? recordingSnapshot.active : callContextRef.current.autoRecord) {
              setTimeout(() => {
                const activeFinalizer = activeSessionFinalizeRef.current;
                if (
                  sessionRef.current === inviter &&
                  activeFinalizer?.session === inviter &&
                  String(inviter.state) !== "Terminated"
                ) {
                  startRecording(inviter, recordingSnapshot);
                } else {
                  console.log("[Recording] Skipping delayed recording start for a finalized outbound call");
                }
              }, 500);
            }
            break;
          case SessionState.Terminated:
            if (sessionRef.current !== inviter) {
              console.log("[SIP-OUTBOUND] Ignoring termination signal from a stale session");
              break;
            }
            makeCallGuardRef.current = false;
            clearMediaHealthMonitoring();
            if (maxRingTimerRef.current) {
              clearTimeout(maxRingTimerRef.current);
              maxRingTimerRef.current = null;
            }
            if (outboundTerminatedSessionsRef.current.has(inviter)) break;
            outboundTerminatedSessionsRef.current.add(inviter);
            if (activeSessionFinalizeRef.current?.session === inviter) {
              activeSessionFinalizeRef.current = null;
            }
            if (hangupPollRef.current) {
              clearInterval(hangupPollRef.current);
              hangupPollRef.current = null;
            }
            const ringTimedOut = ringTimedOutRef.current;
            ringTimedOutRef.current = false;
            setCallState("ended");
            flagUnstableMediaTermination(inviter);
            if (callTimerRef.current) {
              clearInterval(callTimerRef.current);
            }
            const mediaInterrupted = ["recovering", "warning", "failed"].includes(audioHealthRef.current);
            const outcome = classifyOutboundTermination({
              answered: outboundAnsweredRef.current,
              elapsedSeconds: callStartTimeRef.current ? (Date.now() - callStartTimeRef.current) / 1000 : 0,
              ringTimedOut,
              userHungUp: userHungUpRef.current,
              remoteHangup: serverConfirmedRemoteHangupSessionRef.current === inviter,
              mediaInterrupted,
              finalStatusCode: outboundFinalStatusCodeRef.current,
            });
            const { duration, hungUpBy } = outcome;
            const initialFinalStatusCode = outboundFinalStatusCodeRef.current;
            const wasUserHungUp = userHungUpRef.current;
            userHungUpRef.current = false;
            if (serverConfirmedRemoteHangupSessionRef.current === inviter) {
              serverConfirmedRemoteHangupSessionRef.current = null;
            }
            const deferUnansweredPersistence = !outboundAnsweredRef.current
              && initialFinalStatusCode == null
              && !ringTimedOut
              && !wasUserHungUp;
            callContextRef.current.setCallTiming({
              callEndTime: Date.now(),
              talkDurationSeconds: duration > 0 ? duration : null,
              hungUpBy,
            });
            const persistOutcome = (finalOutcome: typeof outcome) => {
              updateCallLogMutation.mutate({
                id: callLogId,
                data: {
                  status: finalOutcome.status,
                  endedAt: new Date().toISOString(),
                  durationSeconds: finalOutcome.duration,
                  hungUpBy: finalOutcome.hungUpBy,
                },
                customerId: localCustomerIdRef.current,
              });
              onCallEnd?.(finalOutcome.duration, finalOutcome.status, callLogId);
            };
            if (deferUnansweredPersistence) {
              // SIP.js transitions to Terminated before requestDelegate.onReject.
              // Persist exactly once after that callback has had one turn to run.
              setTimeout(() => {
                if (
                  sessionRef.current !== inviter ||
                  outboundGenerationRef.current !== outboundGeneration ||
                  outboundOutcomeCorrectedRef.current.has(inviter)
                ) return;
                const deferredCode = outboundFinalStatusCodeRef.current;
                const deferredOutcome = classifyOutboundTerminationWithDeferredResponse({
                  answered: false,
                  elapsedSeconds: 0,
                  userHungUp: false,
                  ringTimedOut: false,
                  finalStatusCode: initialFinalStatusCode,
                }, deferredCode);
                outboundOutcomeCorrectedRef.current.add(inviter);
                callContextRef.current.setCallTiming({
                  callEndTime: Date.now(),
                  talkDurationSeconds: 0,
                  hungUpBy: deferredOutcome.hungUpBy,
                });
                persistOutcome(deferredOutcome);
              }, 10);
            } else {
              persistOutcome(outcome);
            }
            if (duration > 0) {
              stopRecordingAndUpload(callLogId, duration);
            } else {
              if (recordingSnapshotRef.current?.active && recordingSnapshotRef.current.mode === "agent_only") {
                stopRecordingAndUpload(callLogId, 0);
              } else if (mediaRecorderRef.current) {
                cleanupRecordingAnalysis();
                if (pauseToneNodesRef.current) { for (const o of pauseToneNodesRef.current.oscillators) { try { o.stop(); o.disconnect(); } catch (e) {} } for (const g of pauseToneNodesRef.current.gains) { try { g.disconnect(); } catch (e) {} } pauseToneNodesRef.current = null; }
                try { mediaRecorderRef.current.stop(); } catch (e) {}
                mediaRecorderRef.current = null;
                isRecordingRef.current = false;
                callContextRef.current.setIsRecording(false);
                callContextRef.current.setIsRecordingPaused(false);
                recordingChunksRef.current = [];
                recordingDestinationRef.current = null;
                recordingSourceNodesRef.current = [];
              }
            }
            callContextRef.current.setAutoRecord(true);
            schedulePostCallRegistrationRecovery(inviter);
            setCurrentCallLogId(null);
            if (!callContextRef.current.preventAutoReset) {
              setTimeout(() => {
                if (sessionRef.current !== inviter) {
                  console.log("[SIP-OUTBOUND] Skipping stale auto-reset after a newer call started");
                  return;
                }
                setCallStateLocal((prev) => {
                  if (prev === "ended") {
                    callContextRef.current.setCallState("idle");
                    callContextRef.current.setCallInfo(null);
                    callContextRef.current.resetCallTiming();
                    return "idle";
                  }
                  return prev;
                });
                setCallDuration(0);
                callContextRef.current.setCallDuration(0);
                sessionRef.current = null;
              }, 3000);
            }
            break;
        }
      };
      activeSessionFinalizeRef.current = {
        session: inviter,
        finalize: (source) => {
          console.warn(`[SIP-OUTBOUND] Finalizing current call via: ${source}`);
          onOutboundStateChange(SessionState.Terminated);
        },
      };
      inviter.stateChange.addListener(onOutboundStateChange);

      // Late offer: do not create WebRTC/ICE media at dial time. The browser
      // creates its peer connection and SDP answer only after the destination
      // answers, so audio cannot age or fail merely because ringing exceeded
      // ten seconds. Mission max-ring remains the independent CANCEL deadline.
      await inviter.invite({
        withoutSdp: true,
        requestDelegate: {
          onReject: (response: any) => {
            outboundFinalStatusCodeRef.current = Number(response?.message?.statusCode) || null;
          },
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[SIP] Call error:", errMsg, error);
      if (currentCallLogId) {
        updateCallLogMutation.mutate({
          id: currentCallLogId,
          data: { 
            status: "failed",
            endedAt: new Date().toISOString()
          },
          customerId: localCustomerIdRef.current
        });
        setCurrentCallLogId(null);
      }
      toast({
        title: "Chyba hovoru",
        description: "Nepodarilo sa uskutočniť hovor",
        variant: "destructive"
      });
      setCallState("idle");
      makeCallGuardRef.current = false;
    }
  }, [phoneNumber, sipConfig.server, sipConfig.realm, ensureRegistered, onCallStart, onCallEnd, t.agentWorkspace, toast, createCallLogMutation, updateCallLogMutation, userId, currentUser, localCustomerId, localCampaignId, localCustomerName, currentCallLogId, isSipConfigured, collaboratorCallerId]);

  const isRegisteredRef = useRef(isRegistered);
  useEffect(() => { isRegisteredRef.current = isRegistered; }, [isRegistered]);

  const handleDialClick = useCallback(() => {
    if (!isRegistered) {
      if (!isRegistering) {
        register();
      }
      startDialWaiting();
      const checkInterval = setInterval(() => {
        if (isRegisteredRef.current) {
          clearInterval(checkInterval);
          makeCall();
        }
      }, 200);
      setTimeout(() => clearInterval(checkInterval), 10000);
      return;
    }
    makeCall();
  }, [isRegistered, isRegistering, register, startDialWaiting, makeCall]);

  useEffect(() => {
    if (pendingCall && callState !== "idle") {
      clearPendingCall();
      toast({
        title: t.callBar?.active || t.agentWorkspace.errorLabel,
        description: t.callBar?.callInProgress || t.callBar?.active,
      });
      return;
    }
    if (pendingCall && callState === "idle") {
      const callData = pendingCall;
      phoneNumberRef.current = callData.phoneNumber;
      setPhoneNumber(callData.phoneNumber);
      setLocalCustomerId(callData.customerId?.toString());
      localCustomerIdRef.current = callData.customerId?.toString();
      setLocalCampaignId(callData.campaignId?.toString());
      localCampaignIdRef.current = callData.campaignId?.toString();
      localCampaignContactIdRef.current = callData.campaignContactId?.toString();
      localContactTypeRef.current = callData.contactType;
      localProviderRef.current = callData.provider ?? resolveOutboundCallProvider(callData.callerIdNumber);
      localOutboundTrunkRef.current = callData.outboundTrunk || "global";
      localOutboundCountryRef.current = callData.outboundCountry;
      recordingSnapshotRef.current = callData.recordingSnapshot;
      setLocalCampaignName(callData.campaignName);
      setLocalCustomerName(callData.customerName);
      setLocalLeadScore(callData.leadScore);
      setLocalClientStatus(callData.clientStatus);
      const cid = callData.callerIdNumber || "";
      setLocalCallerIdNumber(cid);
      localCallerIdNumberRef.current = cid;
      callContextRef.current.setCallInfo({
        phoneNumber: callData.phoneNumber,
        callerName: callData.customerName,
        customerId: callData.customerId?.toString(),
        campaignId: callData.campaignId?.toString(),
        campaignContactId: callData.campaignContactId?.toString(),
        contactType: callData.contactType,
        provider: callData.provider,
        outboundTrunk: callData.outboundTrunk,
        outboundCallerId: callData.callerIdNumber,
        recordingSnapshot: callData.recordingSnapshot,
        direction: "outbound",
      });
      maxRingSecondsRef.current = callData.maxRingSeconds && callData.maxRingSeconds > 0 ? callData.maxRingSeconds : 0;
      clearPendingCall();
      
      setTimeout(() => {
        makeCall();
      }, 100);
    }
  }, [pendingCall, callState, clearPendingCall, makeCall, toast, t.agentWorkspace]);

  useEffect(() => {
    if (pendingCallProcessedRef.current && isRegistered && callState === "idle") {
      pendingCallProcessedRef.current = false;
      setTimeout(() => {
        makeCall();
      }, 100);
    }
  }, [isRegistered, callState, makeCall]);

  const answerGuardRef = useRef(false);
  const sipPhoneAnsweredRef = useRef(false);

  const handleAnswerIncoming = useCallback(async () => {
    if (!incomingCall) return;
    if (answerGuardRef.current) {
      console.log("[SIP] handleAnswerIncoming already in progress, ignoring duplicate");
      return;
    }
    answerGuardRef.current = true;
    
    try {
      console.log("[SIP-INBOUND] SipPhone answer button clicked, caller:", incomingCall.callerNumber);
      callContextRef.current.resetCallTiming();
      setPhoneNumber(incomingCall.callerNumber);
      
      sipPhoneAnsweredRef.current = true;
      const session = await answerIncomingCall();
      if (!session) {
        toast({
          title: "Chyba",
          description: "Nepodarilo sa prijať hovor",
          variant: "destructive"
        });
        setCallState("idle");
        answerGuardRef.current = false;
        sipPhoneAnsweredRef.current = false;
        return;
      }
      
      console.log("[SIP-INBOUND] SipPhone answered successfully, delegating to handleInboundAnswered");
      session._inboundCallerNumber = session._inboundCallerNumber || incomingCall.callerNumber;
      session._inboundCallerName = session._inboundCallerName || incomingCall.callerName;
      const recordingSnapshot = session._inboundRecordingSnapshot as MissionCallRecordingSnapshot | undefined;
      const shouldRecord = recordingSnapshot ? recordingSnapshot.active : (callContextRef.current.autoRecord || session._inboundRecordCalls);
      handleInboundAnsweredRef.current(session, { autoRecord: shouldRecord, recordingSnapshot });
      
      answerGuardRef.current = false;
    } catch (error: any) {
      console.error("[SIP] Error handling incoming call:", error);
      toast({
        title: "Chyba hovoru",
        description: "Nepodarilo sa spracovať prichádzajúci hovor",
        variant: "destructive"
      });
      setCallState("idle");
      answerGuardRef.current = false;
      sipPhoneAnsweredRef.current = false;
    }
  }, [incomingCall, answerIncomingCall, toast]);

  const handleRejectIncoming = useCallback(() => {
    rejectIncomingCall();
    toast({
      title: "Hovor odmietnutý",
      description: "Prichádzajúci hovor bol odmietnutý",
    });
  }, [rejectIncomingCall, toast]);

  const installMicrophoneTrack = useCallback(async (
    audioSender: RTCRtpSender,
    rawTrack: MediaStreamTrack,
  ) => {
    const previousSenderTrack = audioSender.track;
    const wasEnabled = previousSenderTrack?.enabled !== false;
    const audioContext = audioContextRef.current && audioContextRef.current.state !== "closed"
      ? audioContextRef.current
      : new AudioContext();
    audioContextRef.current = audioContext;
    if (audioContext.state === "suspended") await audioContext.resume();

    const source = audioContext.createMediaStreamSource(new MediaStream([rawTrack]));
    const gainNode = audioContext.createGain();
    gainNode.gain.value = micVolume / 100;
    const destination = audioContext.createMediaStreamDestination();
    source.connect(gainNode);
    gainNode.connect(destination);
    const processedTrack = destination.stream.getAudioTracks()[0];
    processedTrack.enabled = wasEnabled;

    await audioSender.replaceTrack(processedTrack);

    try { micSourceNodeRef.current?.disconnect(); } catch (_) {}
    try { micGainNodeRef.current?.disconnect(); } catch (_) {}
    if (micRawTrackRef.current && micRawTrackRef.current !== rawTrack) {
      try { micRawTrackRef.current.stop(); } catch (_) {}
    }
    if (micProcessedTrackRef.current && micProcessedTrackRef.current !== previousSenderTrack) {
      try { micProcessedTrackRef.current.stop(); } catch (_) {}
    }
    if (previousSenderTrack && previousSenderTrack !== rawTrack && previousSenderTrack !== processedTrack) {
      try { previousSenderTrack.stop(); } catch (_) {}
    }

    micSourceNodeRef.current = source;
    micGainNodeRef.current = gainNode;
    micDestinationNodeRef.current = destination;
    micRawTrackRef.current = rawTrack;
    micProcessedTrackRef.current = processedTrack;
  }, [micVolume]);

  const recoverSessionMediaOnce = useCallback(async (session: Session): Promise<boolean> => {
    const sessionAny = session as any;
    if (sessionAny.__mediaRecoveryPromise) {
      return sessionAny.__mediaRecoveryPromise;
    }
    if (sessionAny.__mediaRecoveryAttempted) return false;

    sessionAny.__mediaRecoveryAttempted = true;
    const recoveryPromise = (async () => {
      await restartSessionMedia(session);
      return true;
    })().finally(() => {
      if (sessionAny.__mediaRecoveryPromise === recoveryPromise) {
        sessionAny.__mediaRecoveryPromise = null;
      }
    });
    sessionAny.__mediaRecoveryPromise = recoveryPromise;
    return recoveryPromise;
  }, []);
  recoverSessionMediaOnceRef.current = recoverSessionMediaOnce;

  const markMediaCritical = useCallback((session: Session) => {
    if (
      sessionRef.current !== session ||
      activeSessionFinalizeRef.current?.session !== session ||
      session.state !== SessionState.Established ||
      (session as any).__terminationRequested
    ) return;
    audioHealthRef.current = "failed";
    setAudioHealth("failed");
    window.dispatchEvent(new CustomEvent("nexus-pulse-media-critical", {
      detail: { episodeId: (session as any).__mediaInterruptionEpisodeId || null },
    }));
  }, []);

  const requestHeldCallRecovery = useCallback(async (session: Session, source: string) => {
    const sessionAny = session as any;
    const activeFinalizer = activeSessionFinalizeRef.current;
    if (
      sessionRef.current !== session ||
      session.state !== SessionState.Established ||
      !isHeldCallRecoveryCandidate(session) ||
      activeFinalizer?.session !== session ||
      sessionAny.__terminationRequested
    ) return;

    const holdEpisode = Number(sessionAny.__holdEpisode || 0);
    const preserveIntentionalHold = sessionAny.__desiredHeld === true;
    if (
      sessionAny.__holdRecoveryAttemptsEpisode === holdEpisode &&
      Number(sessionAny.__holdRecoveryAttempts || 0) >= 2 &&
      !preserveIntentionalHold
    ) {
      markMediaCritical(session);
      return;
    }
    sessionAny.__holdRecoveryEpisode = holdEpisode;
    sessionAny.__holdRecoveryNeeded = true;
    setAudioHealth("recovering");
    console.warn(`[SIP-HOLD-RECOVERY] Network collision detected via ${source}`);

    if (!navigator.onLine || sessionAny.__holdRecoveryInProgress) return;
    sessionAny.__holdRecoveryInProgress = true;
    heldRecoverySessionRef.current = session;
    let resumedFromHold = false;
    const stillOwnsRecovery = () => (
      sessionRef.current === session &&
      session.state === SessionState.Established &&
      activeSessionFinalizeRef.current?.session === session &&
      sessionAny.__holdRecoveryEpisode === holdEpisode &&
      Number(sessionAny.__holdEpisode || 0) === holdEpisode &&
      isHeldCallRecoveryCandidate(session) &&
      sessionAny.__holdRecoveryNeeded &&
      !sessionAny.__terminationRequested
    );

    try {
      const registrationRestored = await Promise.race([
        ensureRegistered(),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 15_000)),
      ]);
      if (
        !registrationRestored ||
        sessionRef.current !== session ||
        session.state !== SessionState.Established ||
        !isHeldCallRecoveryCandidate(session) ||
        !sessionAny.__holdRecoveryNeeded ||
        sessionAny.__holdRecoveryEpisode !== holdEpisode ||
        activeSessionFinalizeRef.current?.session !== session ||
        sessionAny.__terminationRequested
      ) {
        if (!registrationRestored && sessionRef.current === session) {
          markMediaCritical(session);
        }
        return;
      }

      if (preserveIntentionalHold) {
        if (sessionAny.__holdRecoveryAttemptsEpisode !== holdEpisode) {
          sessionAny.__holdRecoveryAttemptsEpisode = holdEpisode;
          sessionAny.__holdRecoveryAttempts = 0;
          sessionAny.__holdRecoveryGraceEpisode = null;
          sessionAny.__holdRecoveryGraceUntil = 0;
        }
        const attempts = Number(sessionAny.__holdRecoveryAttempts || 0);
        const graceUntil = sessionAny.__holdRecoveryGraceEpisode === holdEpisode
          ? Number(sessionAny.__holdRecoveryGraceUntil || 0)
          : 0;
        if (!shouldAttemptHeldCallRecovery(attempts, graceUntil, Date.now())) {
          if (attempts >= 2 && Date.now() >= graceUntil) markMediaCritical(session);
          return;
        }
        if (
          sessionAny.__desiredHeld !== true ||
          sessionAny.__isHeld !== true ||
          sessionAny.__holdRecoveryEpisode !== holdEpisode
        ) return;
        sessionAny.__holdRecoveryAttempts = attempts + 1;
        await recoverHeldSessionMedia(session);
        if (
          sessionRef.current !== session ||
          session.state !== SessionState.Established ||
          activeSessionFinalizeRef.current?.session !== session ||
          sessionAny.__holdRecoveryEpisode !== holdEpisode ||
          sessionAny.__desiredHeld !== true ||
          sessionAny.__terminationRequested
        ) return;
        sessionAny.__holdRecoveryNeeded = false;
        sessionAny.__holdRecoveryGraceEpisode = holdEpisode;
        sessionAny.__holdRecoveryGraceUntil = Date.now() + 8_000;
        setIsOnHold(true);
        setCallState("on_hold");
        setAudioHealth("warning");
        await refreshRemoteAudioRef.current(session);
        console.log("[SIP-HOLD-RECOVERY] Held dialog and ICE recovered; preserving intentional HOLD");
        return;
      }

      let unholdError: unknown = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (!stillOwnsRecovery()) return;
        if (sessionAny.__holdRecoveryAttemptsEpisode !== holdEpisode) {
          sessionAny.__holdRecoveryAttemptsEpisode = holdEpisode;
          sessionAny.__holdRecoveryAttempts = 0;
        }
        if (Number(sessionAny.__holdRecoveryAttempts || 0) >= 2) break;
        sessionAny.__holdRecoveryAttempts = Number(sessionAny.__holdRecoveryAttempts || 0) + 1;
        try {
          await sipUnhold(session, "recovery");
          unholdError = null;
          break;
        } catch (error) {
          unholdError = error;
          console.warn(`[SIP-HOLD-RECOVERY] Resume attempt ${attempt}/2 failed:`, error);
          if (attempt === 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 1200));
            if (!stillOwnsRecovery()) return;
            const retryRegistrationReady = await ensureRegistered();
            if (!retryRegistrationReady || !stillOwnsRecovery()) return;
          }
        }
      }
      if (unholdError) throw unholdError;
      if (
        sessionRef.current !== session ||
        session.state !== SessionState.Established ||
        sessionAny.__holdRecoveryEpisode !== holdEpisode ||
        activeSessionFinalizeRef.current?.session !== session ||
        sessionAny.__terminationRequested
      ) return;

      sessionAny.__holdRecoveryNeeded = false;
      sessionAny.__postHoldRecoveryActive = true;
      sessionAny.__postHoldRecoveryUntil = Date.now() + 16_000;
      resumedFromHold = true;
      setIsOnHold(false);
      setCallState("active");
      setAudioHealth("recovering");
      await refreshRemoteAudioRef.current(session);
      if (
        sessionRef.current !== session ||
        activeSessionFinalizeRef.current?.session !== session ||
        Number(sessionAny.__holdEpisode || 0) !== holdEpisode ||
        sessionAny.__terminationRequested
      ) return;

      // A network collision while Asterisk was generating MOH leaves the
      // browser-to-Asterisk media path suspect even after a successful unhold.
      // Repair ICE immediately instead of waiting for delayed one-way detection.
      if (!sessionAny.__mediaRecoveryAttempted) {
        await recoverSessionMediaOnceRef.current(session);
        if (
          sessionRef.current !== session ||
          session.state !== SessionState.Established ||
          sessionAny.__terminationRequested
        ) return;
        await refreshRemoteAudioRef.current(session);
        if (
          sessionRef.current !== session ||
          activeSessionFinalizeRef.current?.session !== session ||
          Number(sessionAny.__holdEpisode || 0) !== holdEpisode ||
          sessionAny.__terminationRequested
        ) return;
      }

      const recoveredPeerConnection = sessionAny.sessionDescriptionHandler?.peerConnection as RTCPeerConnection | undefined;
      if (!recoveredPeerConnection) throw new Error("Recovered session has no peer connection");
      startMediaHealthMonitoringRef.current(
        session,
        recoveredPeerConnection,
        activeInboundMetaRef.current?.direction === "inbound" ? "inbound" : "outbound",
      );
    } catch (error) {
      console.error("[SIP-HOLD-RECOVERY] Failed to return from MOH:", error);
      if (
        sessionRef.current === session &&
        activeSessionFinalizeRef.current?.session === session &&
        sessionAny.__holdRecoveryEpisode === holdEpisode &&
        (sessionAny.__holdRecoveryNeeded || resumedFromHold) &&
        !sessionAny.__terminationRequested
      ) {
        markMediaCritical(session);
      }
    } finally {
      sessionAny.__holdRecoveryInProgress = false;
      if (heldRecoverySessionRef.current === session) {
        heldRecoverySessionRef.current = null;
      }
    }
  }, [ensureRegistered, markMediaCritical, setCallState, setIsOnHold, t.agentWorkspace, toast]);
  requestHeldCallRecoveryRef.current = (session, source) => {
    void requestHeldCallRecovery(session, source);
  };

  useEffect(() => {
    const session = sessionRef.current;
    if (!session || session.state !== SessionState.Established || !isHeldCallRecoveryCandidate(session)) return;
    if (!isRegistered) {
      beginMediaInterruptionRef.current(session, "sip-registration");
      (session as any).__holdRecoveryNeeded = true;
      setAudioHealth("recovering");
      return;
    }
    if ((session as any).__holdRecoveryNeeded) {
      void requestHeldCallRecovery(session, "SIP registration restored");
    }
  }, [isRegistered, requestHeldCallRecovery]);

  const startMediaHealthMonitoring = useCallback((
    session: Session,
    peerConnection: RTCPeerConnection,
    direction: "inbound" | "outbound",
  ) => {
    clearMediaHealthMonitoring();
    mediaHealthSessionRef.current = session;
    setAudioHealth("checking");

    const startedAt = Date.now();
    let stopped = false;
    let connectionWarningShown = false;
    let failureShown = false;
    let disconnectedAt: number | null = null;
    let degradedQualitySamples = 0;
    let previousRtpStats: AudioRtpStats | null = null;
    let unhealthyDeltaSamples = 0;
    let healthyDeltaSamples = 0;
    let recoveryInProgress = false;
    let recoveryGraceUntil = 0;
    let playbackRecoveryAttempted = false;
    let initialNoFlowWarningShown = false;
    let mediaValidatedHealthy = false;
    let mediaInterruptionObserved = Boolean((session as any).__mediaInterruptionObserved);
    let mediaRecoveryNotified = false;
    let latestMetrics: { rttMs?: number; jitterMs?: number; packetLossPermille?: number } = {};
    const incidentMetrics = () => ({
      callLogId: currentCallLogIdRef.current,
      connectionState: peerConnection.connectionState,
      iceState: peerConnection.iceConnectionState,
      ...latestMetrics,
    });
    const beginMediaInterruption = (connectionKey?: string) => {
      const sessionAny = session as any;
      if (
        connectionKey &&
        !sessionAny.__mediaInterruptionEpisodeId &&
        sessionAny.__mediaAcknowledgedBadConnectionKey === connectionKey
      ) {
        return null;
      }
      mediaInterruptionObserved = true;
      mediaRecoveryNotified = false;
      sessionAny.__mediaInterruptionObserved = true;
      if (!sessionAny.__mediaInterruptionEpisodeId) {
        previousRtpStats = null;
        healthyDeltaSamples = 0;
        unhealthyDeltaSamples = 0;
        mediaValidatedHealthy = false;
        sessionAny.__mediaInterruptionCounter = Number(sessionAny.__mediaInterruptionCounter || 0) + 1;
        sessionAny.__mediaInterruptionEpisodeId = `${currentCallLogIdRef.current || sessionAny.id || "sip"}:${Date.now()}:${sessionAny.__mediaInterruptionCounter}`;
        window.dispatchEvent(new CustomEvent("nexus-pulse-media-interrupted", {
          detail: { episodeId: sessionAny.__mediaInterruptionEpisodeId },
        }));
      }
      return sessionAny.__mediaInterruptionEpisodeId as string;
    };
    beginMediaInterruptionRef.current = (targetSession, source) => {
      if (targetSession !== session || stopped || mediaHealthSessionRef.current !== session) return null;
      return beginMediaInterruption(source);
    };

    const showFailure = () => {
      if (failureShown || stopped || mediaHealthSessionRef.current !== session) return;
      failureShown = true;
      markMediaCritical(session);
      console.error("[SIP-MEDIA] Audio connection failed", {
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
      });
    };

    const reportNoFlowFailure = (health: Exclude<AudioRtpHealth, "healthy">) => {
      if (failureShown || stopped || mediaHealthSessionRef.current !== session) return;
      const oneWay = health === "inbound-only" || health === "outbound-only";
      reportVoiceIncident(oneWay ? "audio_one_way" : "audio_no_flow", "error", incidentMetrics());
      console.warn("[SIP-MEDIA] Call established with incomplete audio flow", { health });
    };

    const attemptMediaRecovery = async (health: Exclude<AudioRtpHealth, "healthy">) => {
      if (
        !shouldAttemptAutomaticMediaRecovery({ mediaValidatedHealthy, interruptionObserved: mediaInterruptionObserved }) ||
        (session as any).__mediaRecoveryAttempted ||
        (session as any).__mediaRecoveryPromise ||
        recoveryInProgress ||
        failureShown ||
        stopped ||
        mediaHealthSessionRef.current !== session ||
        sessionRef.current !== session ||
        session.state !== SessionState.Established ||
        sipIsHeld(session) ||
        isHoldTransitioning(session)
      ) return;

      recoveryInProgress = true;
      beginMediaInterruption();
      setAudioHealth("recovering");
      console.warn("[SIP-MEDIA] Restarting ICE after sustained incomplete RTP flow", { health });

      try {
        await recoverSessionMediaOnceRef.current(session);
        if (
          stopped ||
          mediaHealthSessionRef.current !== session ||
          sessionRef.current !== session ||
          session.state !== SessionState.Established
        ) return;
        const recoveredPeerConnection = (session.sessionDescriptionHandler as any)?.peerConnection as RTCPeerConnection | undefined;
        if (!recoveredPeerConnection) {
          showFailure();
          return;
        }
        if (recoveredPeerConnection !== peerConnection) {
          console.log("[SIP-MEDIA] SIP.js replaced the peer connection during recovery; restarting monitoring");
          startMediaHealthMonitoringRef.current(session, recoveredPeerConnection, direction);
          return;
        }
        previousRtpStats = null;
        unhealthyDeltaSamples = 0;
        healthyDeltaSamples = 0;
        recoveryGraceUntil = Date.now() + 8_000;
        console.log("[SIP-MEDIA] ICE restart re-INVITE completed; verifying RTP flow");
      } catch (error) {
        console.error("[SIP-MEDIA] Media recovery failed:", error);
        if (mediaValidatedHealthy) {
          console.log("[SIP-MEDIA] Ignoring stale recovery failure after bidirectional RTP was restored");
          return;
        }
        if (sipIsHeld(session) || isHoldTransitioning(session)) {
          unhealthyDeltaSamples = 0;
          return;
        }
        showFailure();
      } finally {
        recoveryInProgress = false;
      }
    };

    const checkConnectionState = () => {
      if (stopped || mediaHealthSessionRef.current !== session || session.state !== SessionState.Established) return;
      const connectionState = peerConnection.connectionState;
      const iceState = peerConnection.iceConnectionState;
      const sessionAny = session as any;
      const postHoldRecoveryActive = sessionAny.__postHoldRecoveryActive
        && Date.now() < Number(sessionAny.__postHoldRecoveryUntil || 0);
      if (sessionAny.__holdRecoveryInProgress) {
        setAudioHealth("recovering");
        return;
      }
      console.log(`[SIP-MEDIA] State: pc=${connectionState} ice=${iceState}`);

      if (connectionState === "closed" || iceState === "closed") {
        const connectionKey = `${connectionState}/${iceState}`;
        if (!beginMediaInterruption(connectionKey) && mediaValidatedHealthy) return;
        reportVoiceIncident("ice_failed", "error", incidentMetrics());
        showFailure();
        return;
      }

      if (
        connectionState === "failed" ||
        iceState === "failed"
      ) {
        const connectionKey = `${connectionState}/${iceState}`;
        if (!beginMediaInterruption(connectionKey) && mediaValidatedHealthy) return;
        reportVoiceIncident("ice_failed", "error", incidentMetrics());
        if (sessionAny.__isHeld) {
          if (isHeldCallRecoveryCandidate(session)) {
            void requestHeldCallRecovery(session, `held-call PC/ICE ${connectionState}/${iceState}`);
          }
          return;
        }
        if (postHoldRecoveryActive) {
          if (!sessionAny.__mediaRecoveryAttempted && !sessionAny.__mediaRecoveryPromise && !recoveryInProgress) {
            void attemptMediaRecovery("no-flow");
          }
          return;
        }
        if (!sessionAny.__mediaRecoveryAttempted && !sessionAny.__mediaRecoveryPromise && !recoveryInProgress) {
          void attemptMediaRecovery("no-flow");
          return;
        }
        if (!sessionAny.__mediaRecoveryPromise && !recoveryInProgress) {
          showFailure();
        }
        return;
      }

      if (connectionState === "disconnected" || iceState === "disconnected") {
        beginMediaInterruption(`${connectionState}/${iceState}`);
        disconnectedAt ??= Date.now();
        if (isHeldCallRecoveryCandidate(session)) {
          void requestHeldCallRecovery(session, "held-call PC/ICE disconnected");
        }
        if (Date.now() - disconnectedAt >= 8_000) {
          if (!connectionWarningShown) {
            connectionWarningShown = true;
            reportVoiceIncident("ice_disconnected_sustained", "error", incidentMetrics());
          }
          if (postHoldRecoveryActive) {
            if (!sessionAny.__mediaRecoveryAttempted && !sessionAny.__mediaRecoveryPromise && !recoveryInProgress) {
              void attemptMediaRecovery("no-flow");
            }
            return;
          }
          if (recoveryInProgress || Date.now() < recoveryGraceUntil) return;
          // Disconnected ICE alone is a reversible warning. RTP verification
          // below owns terminal escalation and can also clear this state.
          setAudioHealth("warning");
        }
      } else {
        disconnectedAt = null;
        connectionWarningShown = false;
        sessionAny.__mediaAcknowledgedBadConnectionKey = null;
      }
    };

    const checkStats = async () => {
      if (stopped || mediaHealthSessionRef.current !== session || session.state !== SessionState.Established) return;
      checkConnectionState();
      if ((session as any).__holdRecoveryInProgress) return;
      try {
        const statsEpisodeId = (session as any).__mediaInterruptionEpisodeId || null;
        const stats = await peerConnection.getStats();
        if (stopped || mediaHealthSessionRef.current !== session || session.state !== SessionState.Established) return;
        if (((session as any).__mediaInterruptionEpisodeId || null) !== statsEpisodeId) {
          console.log("[SIP-MEDIA] Ignoring RTP stats captured across a media episode boundary");
          return;
        }
        let inboundPackets = 0;
        let outboundPackets = 0;
        let inboundBytes = 0;
        let outboundBytes = 0;
        let packetsLost = 0;
        let jitterMs = 0;
        let rttMs = 0;

        stats.forEach((report: any) => {
          const isAudio = report.kind === "audio" || report.mediaType === "audio";
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            rttMs = Math.max(rttMs, Number(report.currentRoundTripTime || 0) * 1000);
            return;
          }
          if (!isAudio) return;
          if (report.type === "inbound-rtp" && !report.isRemote) {
            inboundPackets += Number(report.packetsReceived || 0);
            inboundBytes += Number(report.bytesReceived || 0);
            packetsLost += Math.max(0, Number(report.packetsLost || 0));
            jitterMs = Math.max(jitterMs, Number(report.jitter || 0) * 1000);
          } else if (report.type === "outbound-rtp" && !report.isRemote) {
            outboundPackets += Number(report.packetsSent || 0);
            outboundBytes += Number(report.bytesSent || 0);
          } else if (report.type === "remote-inbound-rtp") {
            rttMs = Math.max(rttMs, Number(report.roundTripTime || 0) * 1000);
            jitterMs = Math.max(jitterMs, Number(report.jitter || 0) * 1000);
          }
        });
        const receivedTotal = inboundPackets + packetsLost;
        latestMetrics = {
          ...(rttMs > 0 ? { rttMs: Math.round(rttMs) } : {}),
          ...(jitterMs > 0 ? { jitterMs: Math.round(jitterMs) } : {}),
          ...(receivedTotal > 0 ? { packetLossPermille: Math.min(1000, Math.round((packetsLost / receivedTotal) * 1000)) } : {}),
        };
        const degraded = (latestMetrics.rttMs ?? 0) >= 300
          || (latestMetrics.jitterMs ?? 0) >= 50
          || (latestMetrics.packetLossPermille ?? 0) >= 50;
        degradedQualitySamples = degraded ? degradedQualitySamples + 1 : 0;
        if (degradedQualitySamples === 3) {
          reportVoiceIncident("network_quality_degraded", "warning", incidentMetrics());
        }

        console.log("[SIP-MEDIA] Audio RTP stats", {
          inboundPackets,
          outboundPackets,
          inboundBytes,
          outboundBytes,
          pc: peerConnection.connectionState,
          ice: peerConnection.iceConnectionState,
        });

        const currentRtpStats: AudioRtpStats = {
          inboundPackets,
          outboundPackets,
          inboundBytes,
          outboundBytes,
        };
        const health = classifyAudioRtpStats(currentRtpStats);
        console.log("[SIP-MEDIA] Audio RTP health:", health);

        if (previousRtpStats) {
          const delta = audioRtpDelta(previousRtpStats, currentRtpStats);
          const deltaHealth = classifyAudioRtpStats(delta);

          if (
            !playbackRecoveryAttempted &&
            delta.inboundPackets > 0 &&
            delta.inboundBytes > 0 &&
            audioRef.current?.srcObject &&
            audioRef.current.paused
          ) {
            playbackRecoveryAttempted = true;
            void audioRef.current.play().catch((error) => {
              console.error("[SIP-MEDIA] Automatic remote audio playback recovery failed:", error);
              setAudioHealth("warning");
            });
          }

          if (sipIsHeld(session) || isHoldTransitioning(session)) {
            unhealthyDeltaSamples = 0;
            healthyDeltaSamples = 0;
            previousRtpStats = currentRtpStats;
            return;
          }

          const graceElapsed = Date.now() - startedAt >= 8_000 && Date.now() >= recoveryGraceUntil;
          healthyDeltaSamples = deltaHealth === "healthy" ? healthyDeltaSamples + 1 : 0;
          unhealthyDeltaSamples = graceElapsed && deltaHealth !== "healthy"
            ? unhealthyDeltaSamples + 1
            : 0;

          if (healthyDeltaSamples >= 2) {
            const sessionAny = session as any;
            mediaValidatedHealthy = true;
            if (
              recoveryInProgress ||
              sessionAny.__mediaRecoveryPromise ||
              sessionAny.__activeSipOperation === "media-recovery"
            ) {
              setAudioHealth("recovering");
              previousRtpStats = currentRtpStats;
              return;
            }
            if (mediaInterruptionObserved && !mediaRecoveryNotified) {
              mediaRecoveryNotified = true;
              const recoveredEpisodeId = sessionAny.__mediaInterruptionEpisodeId;
              const connectionStateKey = (
                peerConnection.connectionState === "disconnected" ||
                peerConnection.connectionState === "failed" ||
                peerConnection.iceConnectionState === "disconnected" ||
                peerConnection.iceConnectionState === "failed"
              ) ? `${peerConnection.connectionState}/${peerConnection.iceConnectionState}` : null;
              sessionAny.__mediaInterruptionObserved = false;
              sessionAny.__mediaInterruptionEpisodeId = null;
              sessionAny.__mediaRecoveredAt = Date.now();
              sessionAny.__lastMediaRecoveredEpisodeId = recoveredEpisodeId;
              sessionAny.__mediaAcknowledgedBadConnectionKey = connectionStateKey;
              sessionAny.__mediaRecoveryAttempted = false;
              mediaInterruptionObserved = false;
              window.dispatchEvent(new CustomEvent("nexus-pulse-media-recovered", {
                detail: { episodeId: recoveredEpisodeId },
              }));
              console.log("[SIP-MEDIA] Bidirectional RTP restored; deferred network recheck cleared");
            }
            sessionAny.__postHoldRecoveryActive = false;
            sessionAny.__holdRecoveryNeeded = false;
            connectionWarningShown = false;
            unhealthyDeltaSamples = 0;
            failureShown = false;
            if (
              sessionRef.current === session &&
              session.state === SessionState.Established &&
              !sessionAny.__isHeld &&
              !sessionAny.__desiredHeld &&
              sessionAny.__activeSipOperation !== "hold" &&
              sessionAny.__activeSipOperation !== "unhold"
            ) {
              setIsOnHold(false);
              setCallState("active");
            }
            setAudioHealth("connected");
          }

          if (unhealthyDeltaSamples >= 3) {
            const failureAction = nextMediaFailureAction({
              recoveryEligible: shouldAttemptAutomaticMediaRecovery({
                mediaValidatedHealthy,
                interruptionObserved: mediaInterruptionObserved,
              }),
              recoveryAttempted: Boolean((session as any).__mediaRecoveryAttempted),
              recoveryPending: Boolean((session as any).__mediaRecoveryPromise || recoveryInProgress),
            });
            if (failureAction === "recover") {
              void attemptMediaRecovery(deltaHealth as Exclude<AudioRtpHealth, "healthy">);
            } else if (failureAction === "advise") {
              if (!initialNoFlowWarningShown) {
                initialNoFlowWarningShown = true;
                reportNoFlowFailure(deltaHealth as Exclude<AudioRtpHealth, "healthy">);
                markMediaCritical(session);
                console.warn("[SIP-MEDIA] Initial incomplete RTP reported without renegotiating the call");
              }
              unhealthyDeltaSamples = 0;
            } else if (failureAction === "fail") {
              reportNoFlowFailure(deltaHealth as Exclude<AudioRtpHealth, "healthy">);
              showFailure();
            }
          }
        }
        previousRtpStats = currentRtpStats;
      } catch (error) {
        console.warn("[SIP-MEDIA] Unable to read WebRTC audio statistics:", error);
      }
    };

    const onConnectionStateChange = () => checkConnectionState();
    const onIceConnectionStateChange = () => checkConnectionState();
    peerConnection.addEventListener("connectionstatechange", onConnectionStateChange);
    peerConnection.addEventListener("iceconnectionstatechange", onIceConnectionStateChange);
    const onOffline = () => {
      beginMediaInterruption();
      reportVoiceIncident("browser_offline", "error", incidentMetrics());
      if (isHeldCallRecoveryCandidate(session)) {
        (session as any).__holdRecoveryNeeded = true;
        setAudioHealth("recovering");
      }
    };
    const onOnline = () => {
      if (isHeldCallRecoveryCandidate(session) && (session as any).__holdRecoveryNeeded) {
        void requestHeldCallRecovery(session, "browser online");
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => { void checkStats(); }, 2_000);
    void checkStats();

    mediaHealthCleanupRef.current = () => {
      stopped = true;
      if (mediaHealthSessionRef.current === session) {
        beginMediaInterruptionRef.current = () => null;
      }
      window.clearInterval(timer);
      peerConnection.removeEventListener("connectionstatechange", onConnectionStateChange);
      peerConnection.removeEventListener("iceconnectionstatechange", onIceConnectionStateChange);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [clearMediaHealthMonitoring, markMediaCritical, requestHeldCallRecovery, t.agentWorkspace, toast]);
  startMediaHealthMonitoringRef.current = startMediaHealthMonitoring;

  const setupAudio = async (session: Session, direction: "inbound" | "outbound") => {
    console.log("[SIP-INBOUND] setupAudio called, session state:", (session as any)?.state);
    const sessionDescriptionHandler = session.sessionDescriptionHandler;
    if (!sessionDescriptionHandler) { console.warn("[SIP-INBOUND] setupAudio: No SDH, aborting"); return; }

    const peerConnection = (sessionDescriptionHandler as any).peerConnection as RTCPeerConnection;
    if (!peerConnection) { console.warn("[SIP-INBOUND] setupAudio: No peerConnection, aborting"); return; }
    console.log("[SIP-INBOUND] setupAudio: PC state:", peerConnection.connectionState, "senders:", peerConnection.getSenders().length, "receivers:", peerConnection.getReceivers().length);
    startMediaHealthMonitoring(session, peerConnection, direction);

    const playRemoteAudio = (stream: MediaStream) => {
      if (!audioRef.current) return;
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch((error) => {
        console.error("[SIP-MEDIA] Remote audio playback failed:", error);
        setAudioHealth("warning");
        qualityToast({
          title: t.agentWorkspace.audioConnectionFailedTitle,
          description: t.agentWorkspace.audioPlaybackBlockedDesc,
          variant: "destructive",
        });
      });
    };
    refreshRemoteAudioRef.current = async (targetSession: Session) => {
      if (sessionRef.current !== targetSession || targetSession.state !== SessionState.Established) return false;
      const currentPeerConnection = (targetSession.sessionDescriptionHandler as any)?.peerConnection as RTCPeerConnection | undefined;
      if (!currentPeerConnection || !audioRef.current) return false;
      const remoteTracks = currentPeerConnection
        .getReceivers()
        .map((receiver) => receiver.track)
        .filter((track): track is MediaStreamTrack => !!track && track.kind === "audio" && track.readyState === "live");
      if (remoteTracks.length === 0) return false;
      audioRef.current.srcObject = new MediaStream(remoteTracks);
      void audioRef.current.play().catch((error) => {
        console.error("[SIP-MEDIA] Rebound remote audio playback failed:", error);
        setAudioHealth("warning");
        qualityToast({
          title: t.agentWorkspace.audioConnectionFailedTitle,
          description: t.agentWorkspace.audioPlaybackBlockedDesc,
          variant: "destructive",
        });
      });
      console.log("[SIP-MEDIA] Remote audio rebound to live receiver track");
      return true;
    };

    // Set up remote audio (speaker) with ontrack listener for new tracks
    peerConnection.ontrack = (event) => {
      if (event.track.kind === "audio" && audioRef.current) {
        console.log("[SIP] Remote audio track received via ontrack");
        const remoteStream = new MediaStream([event.track]);
        playRemoteAudio(remoteStream);
      }
    };

    // Also check existing receivers (in case tracks already arrived)
    peerConnection.getReceivers().forEach((receiver) => {
      if (receiver.track && receiver.track.kind === "audio") {
        console.log("[SIP] Remote audio track found in existing receivers");
        const remoteStream = new MediaStream([receiver.track]);
        playRemoteAudio(remoteStream);
      }
    });

    // Set up microphone gain control
    try {
      const senders = peerConnection.getSenders();
      const audioSender = senders.find(s => s.track?.kind === "audio");
      
      if (audioSender?.track) {
        await installMicrophoneTrack(audioSender, audioSender.track);
      }
    } catch (error) {
      console.error("Error setting up microphone gain control:", error);
    }
  };

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    let debounceTimer: number | null = null;

    const handleDeviceChange = () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(async () => {
        debounceTimer = null;
        const session = sessionRef.current;
        if (!session || session.state !== SessionState.Established) return;
        const peerConnection = (session.sessionDescriptionHandler as any)?.peerConnection as RTCPeerConnection | undefined;
        const audioSender = peerConnection?.getSenders().find((sender) => sender.track?.kind === "audio");
        if (!audioSender) return;

        try {
          console.log("[SIP-MEDIA] Audio devices changed — switching to current default microphone");
          const stream = await mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          const newTrack = stream.getAudioTracks()[0];
          if (!newTrack) throw new Error("No microphone track available");
          await installMicrophoneTrack(audioSender, newTrack);
          setAudioHealth("checking");
          console.log("[SIP-MEDIA] Microphone track replaced after device change");
        } catch (error) {
          console.error("[SIP-MEDIA] Failed to switch microphone after device change:", error);
          reportVoiceIncident("audio_device_change_failed", "error");
          setAudioHealth("warning");
          qualityToast({
            title: t.agentWorkspace.audioConnectionFailedTitle,
            description: t.agentWorkspace.audioDeviceChangeFailedDesc,
            variant: "destructive",
          });
        }
      }, 700);
    };

    mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    };
  }, [installMicrophoneTrack, t.agentWorkspace, toast]);

  const finalizeSessionIfCurrent = useCallback((capturedSession: Session, source: string) => {
    if (sessionRef.current !== capturedSession) return;
    const activeFinalizer = activeSessionFinalizeRef.current;
    if (!activeFinalizer || activeFinalizer.session !== capturedSession) return;
    console.warn(`[SIP] Finalizing current call via: ${source}`);
    activeFinalizer.finalize(source);
  }, []);

  const sendByeWithInboundFallback = useCallback((capturedSession: Session, source: string) => {
    setTimeout(() => {
      if (
        sessionRef.current !== capturedSession ||
        activeSessionFinalizeRef.current?.session !== capturedSession
      ) return;
      console.warn(`[SIP] Emergency call teardown after blocked termination queue (${source})`);
      finalizeSessionIfCurrent(capturedSession, `${source} emergency termination timeout`);
    }, 1700);
    void endSessionBounded(capturedSession)
      .then(() => {
        // SIP.js normally emits Terminated after BYE. Keep a session-bound
        // fallback so a delayed result can never finalize a later call.
        setTimeout(() => {
          finalizeSessionIfCurrent(capturedSession, `${source} termination timeout`);
        }, 1200);
      })
      .catch((error) => {
        console.error(`[SIP-INBOUND] BYE failed (${source}), finalizing locally:`, error);
        finalizeSessionIfCurrent(capturedSession, `${source} BYE rejection`);
      });
  }, [finalizeSessionIfCurrent]);

  const remoteHangup = useCallback((callId: string) => {
    const activeInbound = activeInboundMetaRef.current;
    const session = sessionRef.current;
    if (
      !activeInbound ||
      !isCorrelatedInboundHangup({
        eventCallId: String(callId),
        activeCallId: activeInbound.callId,
        activeDirection: activeInbound.direction,
        activeSession: activeInbound.session,
        currentSession: session,
        finalizerSession: activeSessionFinalizeRef.current?.session,
      })
    ) {
      console.warn("[SIP-INBOUND] Ignoring uncorrelated server hangup event");
      return;
    }
    clearMediaHealthMonitoring();
    releaseMicrophonePipeline();
    console.log("[SIP-INBOUND] remoteHangup called (caller/server initiated), session state:", sessionRef.current?.state);
    if (session) {
      if (activeSessionFinalizeRef.current?.session !== session) {
        console.warn("[SIP-INBOUND] Ignoring late server hangup for a finalized session");
        return;
      }
      serverConfirmedRemoteHangupSessionRef.current = session;
      try {
        // The server/caller has already ended the call. Finalize the active
        // local call immediately; a post-reconnect SIP state event or BYE
        // response may never arrive.
        finalizeSessionIfCurrent(session, "server remote hangup");
        if (session.state === SessionState.Established || String(session.state) === "Established") {
          void endSessionBounded(session).catch((error) => {
            console.warn("[SIP-INBOUND] Best-effort cleanup after remote hangup failed:", error);
          });
        }
      } catch (error) {
        console.error("Error in remoteHangup:", error);
        finalizeSessionIfCurrent(session, "server remote hangup exception");
      }
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
        micGainNodeRef.current = null;
      } catch (e) {}
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
  }, [clearMediaHealthMonitoring, releaseMicrophonePipeline, finalizeSessionIfCurrent]);

  const endCall = useCallback(() => {
    clearMediaHealthMonitoring();
    releaseMicrophonePipeline();
    console.log("[SIP-INBOUND] endCall called, session state:", sessionRef.current?.state);
    userHungUpRef.current = true;
    ringTimedOutRef.current = false;
    if (maxRingTimerRef.current) {
      clearTimeout(maxRingTimerRef.current);
      maxRingTimerRef.current = null;
    }
    const session = sessionRef.current;
    if (session) {
      try {
        if (session.state === SessionState.Established || String(session.state) === "Established") {
          console.log("[SIP-INBOUND] Sending BYE to end call");
          sendByeWithInboundFallback(session, "agent end call");
        } else if (session.state === SessionState.Terminated || String(session.state) === "Terminated") {
          finalizeSessionIfCurrent(session, "agent end already-terminated call");
        } else if ((session as any)._dialog) {
          console.log("[SIP-OUTBOUND] Final response accepted; waiting for late-offer ACK before BYE");
          sendByeWithInboundFallback(session, "agent end accepted late-offer call");
          setCallState("ended");
          callContextRef.current.setCallState("ended");
          callContextRef.current.setCallTiming({
            callEndTime: Date.now(),
            hungUpBy: "user",
          });
        } else {
          console.log("[SIP-INBOUND] Cancelling call (not established)");
          (session as Inviter).cancel?.();
          setCallState("ended");
          callContextRef.current.setCallState("ended");
          callContextRef.current.setCallTiming({
            callEndTime: Date.now(),
            hungUpBy: "user",
          });
          if (currentCallLogId) {
            updateCallLogMutation.mutate({
              id: currentCallLogId,
              data: { 
                status: "cancelled",
                endedAt: new Date().toISOString(),
                hungUpBy: "user"
              },
              customerId: localCustomerIdRef.current
            });
            setCurrentCallLogId(null);
          }
        }
      } catch (error) {
        console.error("Error ending call:", error);
      }
    }
    
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
        micGainNodeRef.current = null;
      } catch (e) {
        console.error("Error closing audio context:", e);
      }
    }
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
  }, [currentCallLogId, updateCallLogMutation, clearMediaHealthMonitoring, releaseMicrophonePipeline, sendByeWithInboundFallback, finalizeSessionIfCurrent]);

  const forceResetCall = useCallback(() => {
    clearMediaHealthMonitoring();
    releaseMicrophonePipeline();
    activeSessionFinalizeRef.current = null;
    inboundFinalizeRef.current = null;
    if (hangupPollRef.current) {
      clearInterval(hangupPollRef.current);
      hangupPollRef.current = null;
    }
    ringTimedOutRef.current = false;
    if (maxRingTimerRef.current) {
      clearTimeout(maxRingTimerRef.current);
      maxRingTimerRef.current = null;
    }
    const resetSession = sessionRef.current;

    if (currentCallLogId) {
      const duration = callStartTimeRef.current 
        ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) 
        : 0;
      if (duration > 0) {
        stopRecordingAndUpload(currentCallLogId, duration);
      } else {
        if (recordingSnapshotRef.current?.active && recordingSnapshotRef.current.mode === "agent_only") {
          stopRecordingAndUpload(currentCallLogId, 0);
        } else if (mediaRecorderRef.current) {
          if (pauseToneNodesRef.current) { for (const o of pauseToneNodesRef.current.oscillators) { try { o.stop(); o.disconnect(); } catch (e) {} } for (const g of pauseToneNodesRef.current.gains) { try { g.disconnect(); } catch (e) {} } pauseToneNodesRef.current = null; }
          try { mediaRecorderRef.current.stop(); } catch (e) {}
          mediaRecorderRef.current = null;
          isRecordingRef.current = false;
          callContextRef.current.setIsRecording(false);
          callContextRef.current.setIsRecordingPaused(false);
          recordingChunksRef.current = [];
          recordingDestinationRef.current = null;
          recordingSourceNodesRef.current = [];
        }
      }
      updateCallLogMutation.mutate({
        id: currentCallLogId,
        data: { 
          status: duration > 0 ? "completed" : "cancelled",
          endedAt: new Date().toISOString(),
          durationSeconds: duration,
          hungUpBy: "user"
        },
        customerId: localCustomerIdRef.current
      });
    }

    // Invalidate ownership before signaling. SIP.js may emit Terminated
    // synchronously from bye(), and that old event must not finalize twice.
    activeInboundMetaRef.current = null;
    sessionRef.current = null;
    if (resetSession) {
      void endSessionBounded(resetSession).catch((e) => {
        console.error("Error force-ending call:", e);
      });
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
        micGainNodeRef.current = null;
      } catch (e) {}
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    callStartTimeRef.current = 0;
    userHungUpRef.current = false;
    setCallStateLocal("idle");
    setCallDuration(0);
    setIsMuted(false);
    setIsOnHold(false);
    setCurrentCallLogId(null);
    callContextRef.current.setCallState("idle");
    callContextRef.current.setCallDuration(0);
    callContextRef.current.setCallInfo(null);
    callContextRef.current.resetCallTiming();
    callContextRef.current.setIsMuted(false);
    callContextRef.current.setIsOnHold(false);
    schedulePostCallRegistrationRecovery(resetSession);
  }, [currentCallLogId, updateCallLogMutation, localCustomerId, clearMediaHealthMonitoring, releaseMicrophonePipeline, schedulePostCallRegistrationRecovery]);

  const toggleMute = useCallback(() => {
    if (!sessionRef.current) return;
    
    const sessionDescriptionHandler = sessionRef.current.sessionDescriptionHandler;
    if (!sessionDescriptionHandler) return;

    const peerConnection = (sessionDescriptionHandler as any).peerConnection as RTCPeerConnection;
    if (!peerConnection) return;

    peerConnection.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === "audio") {
        sender.track.enabled = isMuted;
      }
    });
    
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleHold = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || session.state !== SessionState.Established) {
      console.warn("[SIP] Cannot toggle hold - no active established session");
      return;
    }

    try {
      const nowHeld = await sipHoldToggle(session);
      if (
        sessionRef.current !== session ||
        session.state !== SessionState.Established ||
        activeSessionFinalizeRef.current?.session !== session ||
        (session as any).__terminationRequested
      ) return;
      setIsOnHold(nowHeld);
      setCallState(nowHeld ? "on_hold" : "active");
    } catch (error) {
      console.error("[SIP] Hold toggle error:", error);
      if (
        sessionRef.current !== session ||
        activeSessionFinalizeRef.current?.session !== session ||
        (session as any).__terminationRequested
      ) return;
      const actualHoldState = sipIsHeld(session);
      setIsOnHold(actualHoldState);
      setCallState(actualHoldState ? "on_hold" : "active");
      qualityToast({
        title: "Hold error",
        description: "Failed to toggle hold state via re-INVITE",
        variant: "destructive"
      });
    }
  }, [toast]);

  useEffect(() => {
    const ctx = callContextRef.current;
    ctx.endCallFn.current = endCall;
    ctx.remoteHangupFn.current = remoteHangup;
    ctx.forceResetCallFn.current = forceResetCall;
    ctx.toggleMuteFn.current = toggleMute;
    ctx.toggleHoldFn.current = toggleHold;
  }, [endCall, remoteHangup, forceResetCall, toggleMute, toggleHold]);

  useEffect(() => {
    const ctx = callContextRef.current;
    ctx.onVolumeChangeFn.current = (vol: number) => {
      setVolume(vol);
      if (audioRef.current) {
        audioRef.current.volume = vol / 100;
      }
    };
    ctx.onMicVolumeChangeFn.current = (vol: number) => {
      setMicVolume(vol);
      if (micGainNodeRef.current) {
        micGainNodeRef.current.gain.value = vol / 100;
      }
    };
    ctx.sendDtmfFn.current = (digit: string) => {
      if (sessionRef.current && callState === "active") {
        try {
          const options = {
            requestOptions: {
              body: {
                contentDisposition: "render",
                contentType: "application/dtmf-relay",
                content: `Signal=${digit}\r\nDuration=100`
              }
            }
          };
          sessionRef.current.info(options);
        } catch (error) {
          console.error("Failed to send DTMF:", error);
        }
      }
    };
  }, [callState]);

  useEffect(() => {
    callContextRef.current.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    callContextRef.current.setMicVolume(micVolume);
  }, [micVolume]);

  useEffect(() => {
    if (callState !== "idle" && callState !== "ended") {
      const direction = activeInboundMetaRef.current?.direction || "outbound";
      callContextRef.current.setCallInfo({
        phoneNumber,
        callerName: localCustomerName,
        customerId: localCustomerId,
        campaignId: localCampaignId,
        campaignContactId: localCampaignContactIdRef.current,
        contactType: localContactTypeRef.current,
        didNumber: direction === "inbound" ? (callContextRef.current.callInfo?.didNumber || undefined) : undefined,
        queueId: activeInboundMetaRef.current?.queueId,
        provider: localProviderRef.current,
        outboundTrunk: localOutboundTrunkRef.current,
        outboundCallerId: localCallerIdNumberRef.current || undefined,
        direction,
        callLogId: currentCallLogId ?? undefined,
        leadScore: localLeadScore,
        clientStatus: localClientStatus,
      });
      callContextRef.current.setCallDuration(callDuration);
    } else {
      callContextRef.current.setCallInfo(null);
    }
  }, [callState, phoneNumber, localCustomerName, localCustomerId, localCampaignId, currentCallLogId, callDuration, localLeadScore, localClientStatus]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const vol = value[0];
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol / 100;
    }
  }, []);

  const handleMicVolumeChange = useCallback((value: number[]) => {
    const vol = value[0];
    setMicVolume(vol);
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = vol / 100;
    }
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusBadge = () => {
    switch (callState) {
      case "connecting":
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Pripájam...</Badge>;
      case "ringing":
        return <Badge className="bg-yellow-500">Zvoní...</Badge>;
      case "active":
        if (audioHealth === "checking") return <Badge className="bg-amber-500">{t.agentWorkspace.audioChecking}</Badge>;
        if (audioHealth === "warning" || audioHealth === "failed") return <Badge variant="destructive">{t.agentWorkspace.audioIssue}</Badge>;
        return <Badge className="bg-green-500">{audioHealth === "connected" ? t.agentWorkspace.audioConnected : "Aktívny hovor"}</Badge>;
      case "on_hold":
        return <Badge className="bg-orange-500">Podržané</Badge>;
      case "ended":
        return <Badge variant="secondary">Hovor ukončený</Badge>;
      default:
        return isRegistered 
          ? <Badge className="bg-green-500">Pripojené</Badge>
          : <Badge variant="outline">Nepripojené</Badge>;
    }
  };

  const dialPadButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  const showMediaHealth = !mediaAlertDismissed && (callState === "active" || callState === "on_hold")
    && ["checking", "recovering", "warning", "failed"].includes(audioHealth);
  const mediaHealthOverlay = showMediaHealth ? createPortal(
    <div
      className="fixed left-1/2 top-5 z-[10040] w-[min(92vw,460px)] -translate-x-1/2"
      role={audioHealth === "failed" ? "alert" : "status"}
      aria-live={audioHealth === "failed" ? "assertive" : "polite"}
      data-testid="call-media-health-alert"
    >
      <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
        audioHealth === "failed"
          ? "border-red-400/70 bg-gradient-to-br from-red-600/95 to-rose-800/95 text-white"
          : audioHealth === "warning"
            ? "border-orange-300/80 bg-gradient-to-br from-amber-50/95 to-orange-100/95 text-amber-950 dark:from-amber-950/95 dark:to-orange-950/95 dark:text-amber-50"
            : "border-sky-300/80 bg-gradient-to-br from-sky-50/95 to-cyan-100/95 text-sky-950 dark:from-sky-950/95 dark:to-cyan-950/95 dark:text-sky-50"
      }`}>
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
        <div className="relative flex items-center gap-3.5 pr-8">
          <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            audioHealth === "failed"
              ? "bg-white/18"
              : audioHealth === "warning"
                ? "bg-amber-500/15"
                : "bg-sky-500/15"
          }`}>
            {audioHealth === "failed"
              ? <TriangleAlert className="h-6 w-6" aria-hidden="true" />
              : audioHealth === "warning"
                ? <AudioLines className="h-6 w-6" aria-hidden="true" />
                : audioHealth === "recovering"
                  ? <WifiOff className="h-6 w-6" aria-hidden="true" />
                  : <Activity className="h-6 w-6" aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-70">NEXUS Pulse</span>
            </div>
            <div className="text-sm font-bold">
              {audioHealth === "failed"
                ? t.agentWorkspace.mediaCriticalTitle
                : audioHealth === "warning"
                  ? t.agentWorkspace.mediaWarningTitle
                  : audioHealth === "recovering"
                    ? t.agentWorkspace.mediaRecoveryTitle
                    : t.agentWorkspace.audioChecking}
            </div>
            <div className="mt-1 text-xs leading-relaxed opacity-85">
              {audioHealth === "failed"
                ? t.agentWorkspace.mediaCriticalDesc
                : audioHealth === "warning"
                  ? t.agentWorkspace.mediaWarningDesc
                  : audioHealth === "recovering"
                    ? t.agentWorkspace.mediaRecoveryProgress
                    : t.agentWorkspace.audioCheckingDesc}
            </div>
            {(audioHealth === "checking" || audioHealth === "recovering") && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sky-950/15 dark:bg-white/15" aria-hidden="true">
                <div className="nexus-pulse-progress h-full w-2/5 rounded-full bg-gradient-to-r from-sky-500 via-cyan-300 to-sky-500" />
              </div>
            )}
          </div>
          <button
            type="button"
            className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-current/75 transition-colors hover:bg-white/15 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/60"
            onClick={() => setMediaAlertDismissed(true)}
            aria-label={t.common.close}
            data-testid="button-dismiss-call-media-health"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  if (compact) {
    return (
      <>
      {mediaHealthOverlay}
      <div className="flex items-center gap-2">
        <audio ref={audioRef} autoPlay />
        {callState === "idle" ? (
          <Button 
            size="icon" 
            variant="ghost"
            onClick={() => {
              if (isRegistered) {
                makeCall();
              } else {
                setIsConfigOpen(true);
              }
            }}
            disabled={!phoneNumber}
            data-testid="button-call-compact"
          >
            <Phone className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono">{formatDuration(callDuration)}</span>
            {callState === "active" && (
              <Button size="icon" variant="ghost" onClick={toggleMute}>
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <Button size="icon" variant="destructive" onClick={endCall}>
              <PhoneOff className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nastavenia SIP telefónu</DialogTitle>
              <DialogDescription>
                Zadajte údaje pre pripojenie k vášmu Asterisk serveru
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>SIP Server (napr. pbx.example.com)</Label>
                <Input
                  value={sipConfig.server}
                  onChange={(e) => setSipConfig({ ...sipConfig, server: e.target.value })}
                  placeholder="pbx.example.com"
                  data-testid="input-sip-server"
                />
              </div>
              <div className="space-y-2">
                <Label>Používateľské meno</Label>
                <Input
                  value={sipConfig.username}
                  onChange={(e) => setSipConfig({ ...sipConfig, username: e.target.value })}
                  placeholder="1001"
                  data-testid="input-sip-username"
                />
              </div>
              <div className="space-y-2">
                <Label>Heslo</Label>
                <Input
                  type="password"
                  value={sipConfig.password}
                  onChange={(e) => setSipConfig({ ...sipConfig, password: e.target.value })}
                  placeholder="••••••••"
                  data-testid="input-sip-password"
                />
              </div>
              <div className="space-y-2">
                <Label>Zobrazované meno</Label>
                <Input
                  value={sipConfig.displayName}
                  onChange={(e) => setSipConfig({ ...sipConfig, displayName: e.target.value })}
                  placeholder="Operátor"
                  data-testid="input-sip-displayname"
                />
              </div>
              <div className="flex gap-2">
                {isRegistered ? (
                  <Button variant="destructive" onClick={disconnect} className="flex-1">
                    Odpojiť
                  </Button>
                ) : (
                  <Button onClick={connect} className="flex-1">
                    Pripojiť
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </>
    );
  }

  return (
    <>
    {mediaHealthOverlay}
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            SIP Telefón
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {!hideSettingsAndRegistration && (
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setIsConfigOpen(true)}
                data-testid="button-sip-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <audio ref={audioRef} autoPlay />
        
        {incomingCall && callState === "idle" && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-2 animate-pulse" data-testid="incoming-call-panel">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-600 animate-bounce" />
              <div>
                <p className="font-semibold text-sm">Prichádzajúci hovor</p>
                <p className="text-xs text-muted-foreground">{incomingCall.callerName || incomingCall.callerNumber}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleAnswerIncoming}
                data-testid="button-answer-incoming"
              >
                <Phone className="h-4 w-4 mr-1" />
                Prijať
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={handleRejectIncoming}
                data-testid="button-reject-incoming"
              >
                <PhoneOff className="h-4 w-4 mr-1" />
                Odmietnuť
              </Button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {!isLoading && !isSipConfigured && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              SIP telefón nie je nakonfigurovaný. Kontaktujte administrátora pre nastavenie SIP servera a vašej linky.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Telefónne číslo"
            className="text-center text-lg font-mono"
            disabled={callState !== "idle" || !isSipConfigured}
            data-testid="input-phone-number"
          />
        </div>

        {callState !== "idle" && (
          <div className="text-center">
            <p className="text-2xl font-mono">{formatDuration(callDuration)}</p>
          </div>
        )}

        {callState === "idle" && isSipConfigured && (
          <div className="grid grid-cols-3 gap-2">
            {dialPadButtons.map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className="h-12 text-lg font-semibold"
                onClick={() => setPhoneNumber(phoneNumber + digit)}
                data-testid={`button-dial-${digit}`}
              >
                {digit}
              </Button>
            ))}
          </div>
        )}

        <div className="flex justify-center gap-2">
          {callState === "idle" ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPhoneNumber(phoneNumber.slice(0, -1))}
                disabled={!phoneNumber || !isSipConfigured}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                className={`h-14 w-14 rounded-full ${dialWaiting ? "bg-amber-500 hover:bg-amber-600 animate-pulse" : "bg-green-600 hover:bg-green-700"}`}
                onClick={handleDialClick}
                disabled={!phoneNumber || !isSipConfigured || dialWaiting}
                data-testid="button-make-call"
              >
                {dialWaiting ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-[10px] font-mono">{dialElapsed}s</span>
                  </div>
                ) : (
                  <Phone className="h-6 w-6" />
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon"
                variant={isMuted ? "destructive" : "outline"}
                onClick={toggleMute}
                disabled={callState !== "active" && callState !== "on_hold"}
                data-testid="button-toggle-mute"
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700"
                onClick={endCall}
                data-testid="button-end-call"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <Button
                size="icon"
                variant={isOnHold ? "secondary" : "outline"}
                onClick={toggleHold}
                disabled={callState !== "active" && callState !== "on_hold"}
                data-testid="button-toggle-hold"
              >
                {isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <VolumeX className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
              data-testid="slider-speaker-volume"
            />
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <MicOff className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[micVolume]}
              onValueChange={handleMicVolumeChange}
              max={100}
              step={1}
              className="flex-1"
              data-testid="slider-mic-volume"
            />
            <Mic className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {!isRegistered && !hideSettingsAndRegistration && (
          <Button 
            onClick={connect} 
            className="w-full"
            data-testid="button-connect-sip"
          >
            Pripojiť k SIP serveru
          </Button>
        )}
      </CardContent>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nastavenia SIP telefónu</DialogTitle>
            <DialogDescription>
              Zadajte údaje pre pripojenie k vášmu Asterisk serveru
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>SIP Server (napr. pbx.example.com)</Label>
              <Input
                value={sipConfig.server}
                onChange={(e) => setSipConfig({ ...sipConfig, server: e.target.value })}
                placeholder="pbx.example.com"
                data-testid="input-sip-server-modal"
              />
            </div>
            <div className="space-y-2">
              <Label>Používateľské meno</Label>
              <Input
                value={sipConfig.username}
                onChange={(e) => setSipConfig({ ...sipConfig, username: e.target.value })}
                placeholder="1001"
                data-testid="input-sip-username-modal"
              />
            </div>
            <div className="space-y-2">
              <Label>Heslo</Label>
              <Input
                type="password"
                value={sipConfig.password}
                onChange={(e) => setSipConfig({ ...sipConfig, password: e.target.value })}
                placeholder="••••••••"
                data-testid="input-sip-password-modal"
              />
            </div>
            <div className="space-y-2">
              <Label>Zobrazované meno</Label>
              <Input
                value={sipConfig.displayName}
                onChange={(e) => setSipConfig({ ...sipConfig, displayName: e.target.value })}
                placeholder="Operátor"
                data-testid="input-sip-displayname-modal"
              />
            </div>
            <div className="flex gap-2">
              {isRegistered ? (
                <Button variant="destructive" onClick={disconnect} className="flex-1">
                  Odpojiť
                </Button>
              ) : (
                <Button onClick={connect} className="flex-1">
                  Pripojiť
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
    </>
  );
}

interface SipPhoneFloatingProps {
  phoneNumber: string;
  customerId?: string;
  campaignId?: string;
  customerName?: string;
  leadScore?: number;
  clientStatus?: string;
}

export function SipPhoneFloating({ 
  phoneNumber,
  customerId, 
  campaignId, 
  customerName,
  leadScore,
  clientStatus
}: SipPhoneFloatingProps) {
  const { makeCall, isRegistered, isRegistering, register } = useSip();
  const { waitingForReg, elapsedSec, startWaiting, MAX_WAIT } = useRegistrationTimer(isRegistered, isRegistering);

  const handleCall = () => {
    makeCall({
      phoneNumber,
      customerId,
      campaignId,
      customerName,
      leadScore,
      clientStatus,
    });
    
    if (!isRegistered && !isRegistering) {
      register();
    }
    if (!isRegistered) {
      startWaiting();
    }
  };

  if (!phoneNumber) {
    return null;
  }

  return (
    <Button
      className={`fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50 ${waitingForReg ? "animate-pulse" : ""}`}
      onClick={handleCall}
      disabled={waitingForReg}
      data-testid="button-call-floating"
    >
      {waitingForReg ? (
        <div className="flex flex-col items-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[10px] font-mono">{elapsedSec}s</span>
        </div>
      ) : (
        <Phone className={`h-6 w-6 ${!isRegistered ? "opacity-50" : ""}`} />
      )}
    </Button>
  );
}

interface CallCustomerButtonProps {
  phoneNumber: string;
  customerId?: string | number;
  customerName?: string;
  campaignId?: string | number;
  variant?: "icon" | "default" | "small";
  leadScore?: number;
  clientStatus?: string;
}

export function CallCustomerButton({ 
  phoneNumber, 
  customerId, 
  customerName, 
  campaignId,
  variant = "default",
  leadScore,
  clientStatus
}: CallCustomerButtonProps) {
  const { makeCall, isRegistered, isRegistering, register } = useSip();
  const { waitingForReg, elapsedSec, startWaiting } = useRegistrationTimer(isRegistered, isRegistering);
  const { data: authData } = useQuery<{ user: User | null }>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  
  const currentUser = authData?.user;
  const hasSipEnabled = currentUser && (currentUser as any).sipEnabled;

  const handleCall = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    makeCall({
      phoneNumber,
      customerId: typeof customerId === 'number' ? String(customerId) : customerId,
      campaignId: typeof campaignId === 'number' ? String(campaignId) : campaignId,
      customerName,
      leadScore,
      clientStatus,
    });
    
    if (!isRegistered && !isRegistering) {
      register();
    }
    if (!isRegistered) {
      startWaiting();
    }
  };

  if (!hasSipEnabled || !phoneNumber) {
    return null;
  }

  if (variant === "icon") {
    return (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={handleCall}
        disabled={waitingForReg}
        data-testid="button-call-customer-icon"
        title={waitingForReg ? `Registrácia SIP... ${elapsedSec}s` : !isRegistered ? "SIP nie je pripojený — kliknutím spustíte registráciu" : `Zavolat na ${phoneNumber}`}
      >
        {waitingForReg ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <PhoneCall className={`h-4 w-4 ${isRegistered ? "text-primary" : "text-muted-foreground"}`} />
        )}
      </Button>
    );
  }

  if (variant === "small") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleCall}
        disabled={waitingForReg}
        data-testid="button-call-customer-small"
        className="gap-1"
      >
        {waitingForReg ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="font-mono text-xs">{elapsedSec}s</span>
          </>
        ) : (
          <>
            <PhoneCall className={`h-3 w-3 ${!isRegistered ? "text-muted-foreground" : ""}`} />
            {isRegistered ? "Zavolať" : "Volať"}
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={handleCall}
      disabled={waitingForReg}
      data-testid="button-call-customer"
      className="gap-2"
    >
      {waitingForReg ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-mono">{elapsedSec}s — Registrácia SIP...</span>
        </>
      ) : (
        <>
          <PhoneCall className={`h-4 w-4 ${!isRegistered ? "text-muted-foreground" : ""}`} />
          {isRegistered ? `Zavolať ${phoneNumber}` : `Volať ${phoneNumber}`}
        </>
      )}
    </Button>
  );
}

interface SipPhoneHeaderButtonProps {
  user: { sipEnabled?: boolean; sipExtension?: string | null; sipPassword?: string | null } | null;
  sipContext?: { isRegistered: boolean; isRegistering: boolean };
}

export function SipPhoneHeaderButton({ user, sipContext }: SipPhoneHeaderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { pendingCall } = useSip();
  const callContext = useCall();
  const callContextRef = useRef(callContext);
  callContextRef.current = callContext;
  const { data: sipSettings } = useQuery<{
    server?: string;
    port?: number;
    wsPath?: string;
    realm?: string;
    transport?: string;
    isEnabled?: boolean;
  } | null>({
    queryKey: ["/api/sip-settings"],
    retry: false,
  });

  useEffect(() => {
    callContextRef.current.openDialpadFn.current = () => setIsOpen(true);
  }, []);

  if (!user?.sipEnabled || !sipSettings?.isEnabled) {
    return null;
  }

  const isRegistered = sipContext?.isRegistered || false;
  const isRegistering = sipContext?.isRegistering || false;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="relative"
        data-testid="button-sip-phone-open"
      >
        <Phone className="h-5 w-5" />
        {isRegistering && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-yellow-500 ring-2 ring-background animate-pulse" />
        )}
        {!isRegistering && isRegistered && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
        )}
        {!isRegistering && !isRegistered && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
        )}
      </Button>
      <div className={`fixed bottom-4 right-4 z-50 shadow-xl ${isOpen ? 'block' : 'hidden'}`}>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-background shadow"
            data-testid="button-sip-phone-close"
          >
            <X className="h-4 w-4" />
          </Button>
          <SipPhone hideSettingsAndRegistration />
        </div>
      </div>
    </>
  );
}
