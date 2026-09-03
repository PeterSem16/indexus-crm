import { useState, useEffect, useRef, useCallback } from "react";
import { UserAgent, Registerer, RegistererState, Inviter, Session, SessionState } from "sip.js";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { holdToggle as sipHoldToggle, isHeld as sipIsHeld } from "@/lib/sip-hold";
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
  AlertCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SipSettings, CallLog, User } from "@shared/schema";
import { resolveOutboundCallProvider } from "@shared/telephony-routing";
import type { MissionCallRecordingSnapshot } from "@shared/mission-recording";
import { classifyAudioRtpStats, type AudioRtpHealth } from "@/lib/sip-audio-health";

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
type AudioHealthState = "idle" | "checking" | "connected" | "warning" | "failed";

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
  const { toast } = useToast();
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
  useEffect(() => { currentCallLogIdRef.current = currentCallLogId; }, [currentCallLogId]);
  const [sipConfig, setSipConfig] = useState<SipConfig>(config || {
    server: "",
    username: "",
    password: "",
    displayName: "Operator"
  });
  const sessionRef = useRef<Session | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioHealth, setAudioHealth] = useState<AudioHealthState>("idle");
  const mediaHealthCleanupRef = useRef<(() => void) | null>(null);
  const mediaHealthSessionRef = useRef<Session | null>(null);
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
  const pendingCallProcessedRef = useRef<boolean>(false);
  const forceIdleRef = useRef<boolean>(false);
  // Per-mission max ring duration for outbound calls (0 = no limit).
  const maxRingSecondsRef = useRef<number>(0);
  const maxRingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringTimedOutRef = useRef<boolean>(false);
  const activeInboundMetaRef = useRef<{ queueId?: string; queueName?: string; direction?: string } | null>(null);
  const inboundTerminatedListenerRef = useRef<{ session: any; listener: (state: any) => void } | null>(null);
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
          if (String(session.state) !== "Terminated") {
            startRecording(session, snapshot);
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
      await apiRequest("POST", `/api/call-logs/${key}/finalize-agent-recording`, {
        customerActivitySegments,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/call-recordings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs/browse"] });
      return true;
    } catch (error) {
      console.error("[Recording] Trusted agent-only recording failed to finalize:", error);
      return false;
    }
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
          sessionRef.current.bye();
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
      queueId: session._inboundQueueId,
      queueName: session._inboundQueueName,
      direction: "inbound",
    };

    if (callTimerRef.current) clearInterval(callTimerRef.current);
    const timer = setInterval(() => {
      const dur = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      setCallDuration(dur);
      callContextRef.current.setCallDuration(dur);
    }, 1000);
    callTimerRef.current = timer;

    setupAudio(session);

    const doStartRecording = (attempt: number = 1) => {
      if (String(session.state) === "Terminated") {
        console.warn("[SIP-INBOUND] Session already terminated, skipping recording attempt", attempt);
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
      if (terminatedHandled) { console.log("[SIP-INBOUND] onTerminated already handled, skipping duplicate"); return; }
      terminatedHandled = true;
      clearMediaHealthMonitoring();
      if (hangupPollRef.current) { clearInterval(hangupPollRef.current); hangupPollRef.current = null; }
      if (forceIdleRef.current) { forceIdleRef.current = false; return; }
      console.log("[SIP-INBOUND] === CALL TERMINATED ===");
      inboundTerminatedListenerRef.current = null;
      const ctxNow = callContextRef.current;
      const duration = callStartTimeRef.current ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
      console.log("[SIP-INBOUND] Call duration:", duration, "seconds");
      setCallState("ended");
      // Do NOT clear callDirection here — React batches this with setCallState("ended"),
      // causing agent-workspace effect to see callDirection===null when detecting inbound.
      // callDirection is cleared in agent-workspace's "idle" handler after disposition flow.
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      const hungUpBy = userHungUpRef.current ? "user" : "customer";
      userHungUpRef.current = false;
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
      setCurrentCallLogId(null);
      setLocalCallerIdNumber("");
      activeInboundMetaRef.current = null;
      if (!ctxNow.preventAutoReset) {
        setTimeout(() => {
          setCallStateLocal((prev) => { if (prev === "ended") { callContextRef.current.setCallState("idle"); callContextRef.current.setCallInfo(null); callContextRef.current.resetCallTiming(); return "idle"; } return prev; });
          setCallDuration(0);
          callContextRef.current.setCallDuration(0);
          sessionRef.current = null;
        }, 3000);
      }
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
        if (terminatedHandled) return;
        console.warn(`[SIP-INBOUND] Hang-up detected via: ${source}`);
        terminatedHandled = true;
        if (hangupPollRef.current) { clearInterval(hangupPollRef.current); hangupPollRef.current = null; }
        onTerminated(SessionState.Terminated);
      };

      // Poll: check SIP session state + PeerConnection state every second
      if (hangupPollRef.current) clearInterval(hangupPollRef.current);
      hangupPollRef.current = setInterval(() => {
        if (terminatedHandled) { clearInterval(hangupPollRef.current!); hangupPollRef.current = null; return; }
        const pollState = String(session.state);
        if (pollState === "Terminated") { triggerHangupDetection("SIP stateChange poll"); return; }
        // Also poll the WebRTC PeerConnection state directly
        const sdhNow = session.sessionDescriptionHandler;
        const pcNow: RTCPeerConnection | null = sdhNow ? (sdhNow as any).peerConnection : null;
        if (pcNow) {
          const connState = pcNow.connectionState;
          const iceState = pcNow.iceConnectionState;
          console.log(`[SIP-INBOUND] Poll: sipState=${pollState} pcConn=${connState} ice=${iceState}`);
          if (connState === "closed" || connState === "failed" || iceState === "closed" || iceState === "failed") {
            triggerHangupDetection(`PC/ICE poll (conn=${connState} ice=${iceState})`);
          }
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
          if (s === "closed" || s === "failed") triggerHangupDetection(`PC connectionstatechange=${s}`);
        });
        pc2.addEventListener("iceconnectionstatechange", () => {
          const s = pc2.iceConnectionState;
          console.log("[SIP-INBOUND] PC iceconnectionstatechange:", s);
          if (s === "closed" || s === "failed") triggerHangupDetection(`ICE iceconnectionstatechange=${s}`);
        });

        // Monitor remote audio track "ended" event
        const attachTrackEndedListener = (track: MediaStreamTrack) => {
          if (track.kind !== "audio") return;
          track.addEventListener("ended", () => {
            console.log("[SIP-INBOUND] Remote audio track ended");
            triggerHangupDetection("remote audio track ended");
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
  }, [startRecording, startTrustedAgentRecording, stopRecordingAndUpload, cleanupRecordingAnalysis, onCallStart, onCallEnd]);

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
    userHungUpRef.current = false;
    
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

      sessionRef.current = inviter;
      const callLogId = callLogData.id;

      inviter.stateChange.addListener((state) => {
        console.log("Call state:", state);
        switch (state) {
          case SessionState.Establishing:
            setCallState("ringing");
            callContextRef.current.setCallTiming({ ringStartTime: Date.now() });
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
                maxRingTimerRef.current = null;
                const s = sessionRef.current;
                // Only auto-end if this call is still ringing (not answered/ended).
                if (s === inviter && s.state !== SessionState.Established && s.state !== SessionState.Terminated) {
                  console.log(`[SIP] Max ring duration (${maxRing}s) exceeded — auto-ending unanswered call`);
                  ringTimedOutRef.current = true;
                  userHungUpRef.current = false;
                  try { (inviter as Inviter).cancel?.(); } catch (e) { console.error("[SIP] Error cancelling on max-ring timeout:", e); }
                  playNotConnectedTone();
                  toast({
                    title: "Hovor nebol spojený",
                    description: `Hovor sa automaticky ukončil po ${maxRing} s bez prijatia.`,
                    variant: "destructive",
                  });
                }
              }, maxRing * 1000);
            }
            break;
          case SessionState.Established:
            makeCallGuardRef.current = false;
            if (maxRingTimerRef.current) {
              clearTimeout(maxRingTimerRef.current);
              maxRingTimerRef.current = null;
            }
            ringTimedOutRef.current = false;
            setCallState("active");
            setIsOnHold(false);
            callStartTimeRef.current = Date.now();
            const ringEnd = Date.now();
            const ringStart = callContextRef.current.callTiming.ringStartTime;
            callContextRef.current.setCallTiming({
              callStartTime: ringEnd,
              ringDurationSeconds: ringStart ? Math.round((ringEnd - ringStart) / 1000) : null,
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
            setupAudio(inviter);
            const recordingSnapshot = recordingSnapshotRef.current;
            if (recordingSnapshot?.active && recordingSnapshot.mode === "agent_only") {
              void startTrustedAgentRecording(callLogId, inviter, recordingSnapshot);
            } else if (recordingSnapshot ? recordingSnapshot.active : callContextRef.current.autoRecord) {
              setTimeout(() => startRecording(inviter, recordingSnapshot), 500);
            }
            break;
          case SessionState.Terminated:
            makeCallGuardRef.current = false;
            clearMediaHealthMonitoring();
            if (maxRingTimerRef.current) {
              clearTimeout(maxRingTimerRef.current);
              maxRingTimerRef.current = null;
            }
            if (forceIdleRef.current) {
              forceIdleRef.current = false;
              ringTimedOutRef.current = false;
              break;
            }
            const duration = callStartTimeRef.current 
              ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) 
              : 0;
            const ringTimedOut = ringTimedOutRef.current;
            ringTimedOutRef.current = false;
            setCallState("ended");
            if (callTimerRef.current) {
              clearInterval(callTimerRef.current);
            }
            const hungUpBy = ringTimedOut ? "system" : (userHungUpRef.current ? "user" : "customer");
            userHungUpRef.current = false;
            const terminatedStatus = ringTimedOut ? "no_answer" : (duration > 0 ? "completed" : "failed");
            callContextRef.current.setCallTiming({
              callEndTime: Date.now(),
              talkDurationSeconds: duration > 0 ? duration : null,
              hungUpBy,
            });
            updateCallLogMutation.mutate({
              id: callLogId,
              data: { 
                status: terminatedStatus,
                endedAt: new Date().toISOString(),
                durationSeconds: duration,
                hungUpBy
              },
              customerId: localCustomerIdRef.current
            });
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
            onCallEnd?.(duration, terminatedStatus, callLogId);
            setCurrentCallLogId(null);
            if (!callContextRef.current.preventAutoReset) {
              setTimeout(() => {
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
      });

      await inviter.invite();
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
  }, [phoneNumber, sipConfig.server, sipConfig.realm, ensureRegistered, onCallStart, onCallEnd, toast, createCallLogMutation, updateCallLogMutation, userId, currentUser, localCustomerId, localCampaignId, localCustomerName, currentCallLogId, isSipConfigured, collaboratorCallerId]);

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
    if (pendingCall && (callState === "idle" || callState === "ended")) {
      if (callState === "ended") {
        setCallState("idle");
        setCallDuration(0);
        sessionRef.current = null;
      }
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
  }, [pendingCall, callState, clearPendingCall, makeCall]);

  useEffect(() => {
    if (pendingCallProcessedRef.current && isRegistered && (callState === "idle" || callState === "ended")) {
      if (callState === "ended") {
        setCallState("idle");
        setCallDuration(0);
        sessionRef.current = null;
      }
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
      setCallState("active");
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

  const startMediaHealthMonitoring = useCallback((session: Session, peerConnection: RTCPeerConnection) => {
    clearMediaHealthMonitoring();
    mediaHealthSessionRef.current = session;
    setAudioHealth("checking");

    const startedAt = Date.now();
    let stopped = false;
    let warningShown = false;
    let failureShown = false;
    let disconnectedAt: number | null = null;

    const showFailure = (terminate: boolean) => {
      if (failureShown || stopped || mediaHealthSessionRef.current !== session) return;
      failureShown = true;
      setAudioHealth("failed");
      console.error("[SIP-MEDIA] Audio connection failed", {
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
        terminate,
      });
      toast({
        title: t.agentWorkspace.audioConnectionFailedTitle,
        description: t.agentWorkspace.audioConnectionFailedDesc,
        variant: "destructive",
      });
      if (terminate && session.state === SessionState.Established) {
        try {
          session.bye();
        } catch (error) {
          console.error("[SIP-MEDIA] Failed to terminate broken media session:", error);
        }
      }
    };

    const showNoFlowWarning = (health: Exclude<AudioRtpHealth, "healthy">) => {
      if (warningShown || failureShown || stopped || mediaHealthSessionRef.current !== session) return;
      warningShown = true;
      setAudioHealth("warning");
      const oneWay = health === "inbound-only" || health === "outbound-only";
      console.warn("[SIP-MEDIA] Call established with incomplete audio flow", { health });
      toast({
        title: oneWay ? t.agentWorkspace.audioOneWayTitle : t.agentWorkspace.audioNoFlowTitle,
        description: oneWay ? t.agentWorkspace.audioOneWayDesc : t.agentWorkspace.audioNoFlowDesc,
        variant: "destructive",
      });
    };

    const checkConnectionState = () => {
      const connectionState = peerConnection.connectionState;
      const iceState = peerConnection.iceConnectionState;
      console.log(`[SIP-MEDIA] State: pc=${connectionState} ice=${iceState}`);

      if (
        connectionState === "failed" ||
        iceState === "failed" ||
        connectionState === "closed" ||
        iceState === "closed"
      ) {
        showFailure(true);
        return;
      }

      if (connectionState === "disconnected" || iceState === "disconnected") {
        disconnectedAt ??= Date.now();
        if (Date.now() - disconnectedAt >= 8_000) showFailure(false);
      } else {
        disconnectedAt = null;
      }
    };

    const checkStats = async () => {
      if (stopped || mediaHealthSessionRef.current !== session || session.state !== SessionState.Established) return;
      checkConnectionState();
      try {
        const stats = await peerConnection.getStats();
        let inboundPackets = 0;
        let outboundPackets = 0;
        let inboundBytes = 0;
        let outboundBytes = 0;

        stats.forEach((report: any) => {
          const isAudio = report.kind === "audio" || report.mediaType === "audio";
          if (!isAudio || report.isRemote) return;
          if (report.type === "inbound-rtp") {
            inboundPackets += Number(report.packetsReceived || 0);
            inboundBytes += Number(report.bytesReceived || 0);
          } else if (report.type === "outbound-rtp") {
            outboundPackets += Number(report.packetsSent || 0);
            outboundBytes += Number(report.bytesSent || 0);
          }
        });

        console.log("[SIP-MEDIA] Audio RTP stats", {
          inboundPackets,
          outboundPackets,
          inboundBytes,
          outboundBytes,
          pc: peerConnection.connectionState,
          ice: peerConnection.iceConnectionState,
        });

        const health = classifyAudioRtpStats({
          inboundPackets,
          outboundPackets,
          inboundBytes,
          outboundBytes,
        });
        console.log("[SIP-MEDIA] Audio RTP health:", health);

        if (health === "healthy") {
          if (!failureShown) setAudioHealth("connected");
        } else if (Date.now() - startedAt >= 12_000) {
          showNoFlowWarning(health);
        }
      } catch (error) {
        console.warn("[SIP-MEDIA] Unable to read WebRTC audio statistics:", error);
      }
    };

    const onConnectionStateChange = () => checkConnectionState();
    const onIceConnectionStateChange = () => checkConnectionState();
    peerConnection.addEventListener("connectionstatechange", onConnectionStateChange);
    peerConnection.addEventListener("iceconnectionstatechange", onIceConnectionStateChange);
    const timer = window.setInterval(() => { void checkStats(); }, 2_000);
    void checkStats();

    mediaHealthCleanupRef.current = () => {
      stopped = true;
      window.clearInterval(timer);
      peerConnection.removeEventListener("connectionstatechange", onConnectionStateChange);
      peerConnection.removeEventListener("iceconnectionstatechange", onIceConnectionStateChange);
    };
  }, [clearMediaHealthMonitoring, t.agentWorkspace, toast]);

  const setupAudio = async (session: Session) => {
    console.log("[SIP-INBOUND] setupAudio called, session state:", (session as any)?.state);
    const sessionDescriptionHandler = session.sessionDescriptionHandler;
    if (!sessionDescriptionHandler) { console.warn("[SIP-INBOUND] setupAudio: No SDH, aborting"); return; }

    const peerConnection = (sessionDescriptionHandler as any).peerConnection as RTCPeerConnection;
    if (!peerConnection) { console.warn("[SIP-INBOUND] setupAudio: No peerConnection, aborting"); return; }
    console.log("[SIP-INBOUND] setupAudio: PC state:", peerConnection.connectionState, "senders:", peerConnection.getSenders().length, "receivers:", peerConnection.getReceivers().length);
    startMediaHealthMonitoring(session, peerConnection);

    const playRemoteAudio = (stream: MediaStream) => {
      if (!audioRef.current) return;
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch((error) => {
        console.error("[SIP-MEDIA] Remote audio playback failed:", error);
        setAudioHealth("warning");
        toast({
          title: t.agentWorkspace.audioConnectionFailedTitle,
          description: t.agentWorkspace.audioPlaybackBlockedDesc,
          variant: "destructive",
        });
      });
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
          setAudioHealth("warning");
          toast({
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

  const remoteHangup = useCallback(() => {
    clearMediaHealthMonitoring();
    releaseMicrophonePipeline();
    console.log("[SIP-INBOUND] remoteHangup called (caller/server initiated), session state:", sessionRef.current?.state);
    if (currentCallLogIdRef.current && recordingSnapshotRef.current?.active && recordingSnapshotRef.current.mode === "agent_only") {
      void finalizeTrustedAgentRecording(currentCallLogIdRef.current);
    }
    if (sessionRef.current) {
      try {
        if (sessionRef.current.state === SessionState.Established) {
          console.log("[SIP-INBOUND] remoteHangup: sending BYE");
          sessionRef.current.bye();
        }
      } catch (error) {
        console.error("Error in remoteHangup:", error);
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
  }, [finalizeTrustedAgentRecording, clearMediaHealthMonitoring, releaseMicrophonePipeline]);

  const endCall = useCallback(() => {
    clearMediaHealthMonitoring();
    releaseMicrophonePipeline();
    console.log("[SIP-INBOUND] endCall called, session state:", sessionRef.current?.state);
    userHungUpRef.current = true;
    if (currentCallLogId && recordingSnapshotRef.current?.active && recordingSnapshotRef.current.mode === "agent_only") {
      void finalizeTrustedAgentRecording(currentCallLogId);
    }
    ringTimedOutRef.current = false;
    if (maxRingTimerRef.current) {
      clearTimeout(maxRingTimerRef.current);
      maxRingTimerRef.current = null;
    }
    if (sessionRef.current) {
      try {
        if (sessionRef.current.state === SessionState.Established) {
          console.log("[SIP-INBOUND] Sending BYE to end call");
          sessionRef.current.bye();
        } else {
          console.log("[SIP-INBOUND] Cancelling call (not established)");
          (sessionRef.current as Inviter).cancel?.();
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
  }, [currentCallLogId, updateCallLogMutation, finalizeTrustedAgentRecording, clearMediaHealthMonitoring, releaseMicrophonePipeline]);

  const forceResetCall = useCallback(() => {
    clearMediaHealthMonitoring();
    releaseMicrophonePipeline();
    ringTimedOutRef.current = false;
    if (maxRingTimerRef.current) {
      clearTimeout(maxRingTimerRef.current);
      maxRingTimerRef.current = null;
    }
    // Only arm the forceIdle flag when there is an active SIP session.
    // If called without a session (e.g. at session end with no live call),
    // leaving the flag true would cause the NEXT call's onTerminated to
    // early-return and never fire setCallState("ended").
    if (sessionRef.current) {
      forceIdleRef.current = true;
    }

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

    if (sessionRef.current) {
      try {
        if (sessionRef.current.state === SessionState.Established) {
          sessionRef.current.bye();
        } else if (sessionRef.current.state !== SessionState.Terminated) {
          (sessionRef.current as Inviter).cancel?.();
        }
      } catch (e) {
        console.error("Error force-ending call:", e);
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
    sessionRef.current = null;
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
  }, [currentCallLogId, updateCallLogMutation, localCustomerId, clearMediaHealthMonitoring, releaseMicrophonePipeline]);

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
    if (!sessionRef.current || sessionRef.current.state !== SessionState.Established) {
      console.warn("[SIP] Cannot toggle hold - no active established session");
      return;
    }

    const previousHoldState = sipIsHeld(sessionRef.current);
    
    try {
      const nowHeld = await sipHoldToggle(sessionRef.current);
      setIsOnHold(nowHeld);
      setCallState(nowHeld ? "on_hold" : "active");
    } catch (error) {
      console.error("[SIP] Hold toggle error:", error);
      setIsOnHold(previousHoldState);
      setCallState(previousHoldState ? "on_hold" : "active");
      toast({
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

  if (compact) {
    return (
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
    );
  }

  return (
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
