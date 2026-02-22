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
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SipSettings, CallLog, User } from "@shared/schema";

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
  const { isRegistered, isRegistering, registrationError, register, unregister, ensureRegistered, userAgentRef, registererRef, pendingCall, clearPendingCall, incomingCall, answeredIncomingSession, clearAnsweredSession, answerIncomingCall, rejectIncomingCall } = useSip();
  const callContext = useCall();
  const [localCustomerId, setLocalCustomerId] = useState(customerId);
  const [localCampaignId, setLocalCampaignId] = useState(campaignId);
  const [localCampaignName, setLocalCampaignName] = useState<string | undefined>(undefined);
  const [localCustomerName, setLocalCustomerName] = useState(customerName);
  const [localLeadScore, setLocalLeadScore] = useState<number | undefined>(undefined);
  const [localClientStatus, setLocalClientStatus] = useState<string | undefined>(undefined);
  const [callState, setCallStateLocal] = useState<CallState>("idle");
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);
  const [isMutedLocal, setIsMutedLocal] = useState(false);
  const [isOnHoldLocal, setIsOnHoldLocal] = useState(false);
  
  const setCallState = useCallback((state: CallState) => {
    setCallStateLocal(state);
    callContext.setCallState(state as GlobalCallState);
  }, [callContext]);
  
  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedLocal(muted);
    callContext.setIsMuted(muted);
  }, [callContext]);
  
  const setIsOnHold = useCallback((hold: boolean) => {
    setIsOnHoldLocal(hold);
    callContext.setIsOnHold(hold);
  }, [callContext]);
  
  const isMuted = isMutedLocal;
  const isOnHold = isOnHoldLocal;
  const [volume, setVolume] = useState(80);
  const [micVolume, setMicVolume] = useState(100);
  const [callDuration, setCallDuration] = useState(0);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [currentCallLogId, setCurrentCallLogId] = useState<number | null>(null);
  const [sipConfig, setSipConfig] = useState<SipConfig>(config || {
    server: "",
    username: "",
    password: "",
    displayName: "Operator"
  });
  const sessionRef = useRef<Session | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const userHungUpRef = useRef<boolean>(false);
  const pendingCallProcessedRef = useRef<boolean>(false);
  const forceIdleRef = useRef<boolean>(false);
  const activeInboundMetaRef = useRef<{ queueId?: string; queueName?: string; direction?: string } | null>(null);
  const inboundTerminatedListenerRef = useRef<{ session: any; listener: (state: any) => void } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recordingSourceNodesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const pauseToneNodesRef = useRef<{ oscillators: OscillatorNode[]; gains: GainNode[] } | null>(null);
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
      customerName?: string;
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
    mutationFn: async ({ id, data, customerId }: { id: number; data: { status?: string; endedAt?: string; answeredAt?: string; duration?: number; durationSeconds?: number; notes?: string; hungUpBy?: string }; customerId?: string }) => {
      const res = await apiRequest("PATCH", `/api/call-logs/${id}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      if (variables.customerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "call-logs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers", Number(variables.customerId), "call-logs"] });
      }
    }
  });

  const startRecording = useCallback((session: Session) => {
    try {
      const sdh = session.sessionDescriptionHandler;
      if (!sdh) return;
      const pc = (sdh as any).peerConnection as RTCPeerConnection;
      if (!pc) return;

      const recCtx = new AudioContext();
      recordingContextRef.current = recCtx;
      const destination = recCtx.createMediaStreamDestination();
      recordingDestinationRef.current = destination;
      recordingSourceNodesRef.current = [];

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
            remoteSource.connect(destination);
            recordingSourceNodesRef.current.push(remoteSource);
            console.log("[Recording] Remote audio track connected to recorder");
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
      callContext.setIsRecording(true);
      callContext.setIsRecordingPaused(false);
      console.log("[Recording] Started recording call");
    } catch (err) {
      console.error("[Recording] Failed to start recording:", err);
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
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
      callContext.setIsRecordingPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
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
      callContext.setIsRecordingPaused(false);
    }
  }, []);

  const manualStartRecording = useCallback(() => {
    if (isRecordingRef.current) return;
    const session = sessionRef.current;
    if (session) {
      startRecording(session);
    }
  }, [startRecording]);

  const manualStopRecording = useCallback(() => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) return;
    isRecordingRef.current = false;
    callContext.setIsRecording(false);
    callContext.setIsRecordingPaused(false);
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
  }, []);

  useEffect(() => {
    callContext.pauseRecordingFn.current = pauseRecording;
    callContext.resumeRecordingFn.current = resumeRecording;
    callContext.startRecordingFn.current = manualStartRecording;
    callContext.stopRecordingFn.current = manualStopRecording;
    return () => {
      callContext.pauseRecordingFn.current = null;
      callContext.resumeRecordingFn.current = null;
      callContext.startRecordingFn.current = null;
      callContext.stopRecordingFn.current = null;
    };
  }, [pauseRecording, resumeRecording, manualStartRecording, manualStopRecording]);

  const stopRecordingAndUpload = useCallback((callLogId: string | number, duration: number) => {
    if (!mediaRecorderRef.current || !isRecordingRef.current) return;
    isRecordingRef.current = false;
    callContext.setIsRecording(false);
    callContext.setIsRecordingPaused(false);
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
  }, [localCustomerId, localCampaignId, localCampaignName, localCustomerName, currentUser, phoneNumber]);

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
    if (callContext.callState === "idle" && callState !== "idle") {
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

  const cleanup = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
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
  }, []);

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

  useEffect(() => {
    if (callState === "connecting" || callState === "ringing") {
      startRingtone();
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [callState, startRingtone, stopRingtone]);

  const handleInboundAnswered = useCallback((session: any, options: { autoRecord: boolean }) => {
    console.log("[SIP] handleInboundAnswered called directly, autoRecord:", options.autoRecord);
    const ctx = callContextRef.current;

    if (inboundTerminatedListenerRef.current) {
      try { inboundTerminatedListenerRef.current.session.stateChange.removeListener(inboundTerminatedListenerRef.current.listener); } catch {}
      inboundTerminatedListenerRef.current = null;
    }

    sessionRef.current = session;
    const callerNumber = session._inboundCallerNumber || "Unknown";
    setPhoneNumber(callerNumber);
    setCallState("active");
    setIsOnHold(false);
    ctx.resetCallTiming();
    callStartTimeRef.current = Date.now();
    ctx.setCallTiming({ callStartTime: Date.now() });

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

    if (options.autoRecord) {
      console.log("[SIP] Auto-recording enabled for inbound call, starting in 500ms...");
      setTimeout(() => startRecording(session), 500);
    }

    const inboundCallLogIdRef = { current: null as number | null };

    const onTerminated = (state: any) => {
      if (state !== SessionState.Terminated) return;
      if (forceIdleRef.current) { forceIdleRef.current = false; return; }
      console.log("[SIP] Inbound call terminated by remote party");
      inboundTerminatedListenerRef.current = null;
      const ctxNow = callContextRef.current;
      const duration = callStartTimeRef.current ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
      setCallState("ended");
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      const hungUpBy = userHungUpRef.current ? "user" : "customer";
      userHungUpRef.current = false;
      ctxNow.setCallTiming({ callEndTime: Date.now(), talkDurationSeconds: duration > 0 ? duration : null, hungUpBy });
      if (duration > 0) {
        stopRecordingAndUpload(inboundCallLogIdRef.current || 0, duration);
      } else {
        if (mediaRecorderRef.current) { try { mediaRecorderRef.current.stop(); } catch {} mediaRecorderRef.current = null; isRecordingRef.current = false; ctxNow.setIsRecording(false); ctxNow.setIsRecordingPaused(false); recordingChunksRef.current = []; }
      }
      ctxNow.setAutoRecord(true);
      onCallEnd?.(duration, duration > 0 ? "completed" : "failed", inboundCallLogIdRef.current || 0);
      setCurrentCallLogId(null);
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

    session.stateChange.addListener(onTerminated);
    inboundTerminatedListenerRef.current = { session, listener: onTerminated };

    createCallLogMutation.mutateAsync({
      phoneNumber: callerNumber,
      direction: "inbound",
      status: "answered",
      userId: userId || currentUser?.id,
      customerId: localCustomerId,
      customerName: session._inboundCallerName || callerNumber,
      inboundQueueId: session._inboundQueueId || undefined,
      inboundQueueName: session._inboundQueueName || undefined,
      inboundCallLogId: session._inboundCallLogId || undefined,
    }).then((callLogData) => {
      setCurrentCallLogId(callLogData.id);
      inboundCallLogIdRef.current = callLogData.id;

      updateCallLogMutation.mutate({
        id: callLogData.id,
        data: { status: "answered", answeredAt: new Date().toISOString() },
        customerId: localCustomerId
      });

      onCallStart?.(callerNumber, callLogData.id);
    }).catch((err) => {
      console.error("[SIP] Failed to create call log for externally answered call:", err);
    });
  }, [startRecording, stopRecordingAndUpload, onCallStart, onCallEnd]);

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
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!answeredIncomingSession) return;
    console.log("[SIP] answeredIncomingSession changed (fallback), calling handleInboundAnswered");
    const session = answeredIncomingSession;
    clearAnsweredSession();
    const shouldRecord = callContextRef.current.autoRecord || session._inboundRecordCalls;
    handleInboundAnsweredRef.current(session, { autoRecord: shouldRecord });
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
    
    if (!phoneNumber) {
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
      callContext.setCallState("idle");
      makeCallGuardRef.current = false;
      return;
    }

    try {
      callContext.resetCallTiming();
      
      const callLogData = await createCallLogMutation.mutateAsync({
        phoneNumber,
        direction: "outbound",
        status: "initiated",
        userId: userId || currentUser?.id,
        customerId: localCustomerId,
        campaignId: localCampaignId,
        customerName: localCustomerName,
      });
      setCurrentCallLogId(callLogData.id);
      
      const realm = sipConfig.realm || sipConfig.server;
      const targetUri = UserAgent.makeURI(`sip:${phoneNumber}@${realm}`);
      if (!targetUri) {
        throw new Error("Invalid target URI");
      }

      const inviter = new Inviter(userAgentRef.current, targetUri, {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        }
      });

      sessionRef.current = inviter;
      const callLogId = callLogData.id;

      inviter.stateChange.addListener((state) => {
        console.log("Call state:", state);
        switch (state) {
          case SessionState.Establishing:
            setCallState("ringing");
            callContext.setCallTiming({ ringStartTime: Date.now() });
            updateCallLogMutation.mutate({
              id: callLogId,
              data: { status: "ringing" },
              customerId: localCustomerId
            });
            break;
          case SessionState.Established:
            makeCallGuardRef.current = false;
            setCallState("active");
            setIsOnHold(false);
            callStartTimeRef.current = Date.now();
            const ringEnd = Date.now();
            const ringStart = callContext.callTiming.ringStartTime;
            callContext.setCallTiming({
              callStartTime: ringEnd,
              ringDurationSeconds: ringStart ? Math.round((ringEnd - ringStart) / 1000) : null,
            });
            callTimerRef.current = setInterval(() => {
              setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
            }, 1000);
            updateCallLogMutation.mutate({
              id: callLogId,
              data: { status: "answered", answeredAt: new Date().toISOString() },
              customerId: localCustomerId
            });
            onCallStart?.(phoneNumber, callLogId);
            setupAudio(inviter);
            if (callContext.autoRecord) {
              setTimeout(() => startRecording(inviter), 500);
            }
            break;
          case SessionState.Terminated:
            makeCallGuardRef.current = false;
            if (forceIdleRef.current) {
              forceIdleRef.current = false;
              break;
            }
            const duration = callStartTimeRef.current 
              ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) 
              : 0;
            setCallState("ended");
            if (callTimerRef.current) {
              clearInterval(callTimerRef.current);
            }
            const hungUpBy = userHungUpRef.current ? "user" : "customer";
            userHungUpRef.current = false;
            callContext.setCallTiming({
              callEndTime: Date.now(),
              talkDurationSeconds: duration > 0 ? duration : null,
              hungUpBy,
            });
            updateCallLogMutation.mutate({
              id: callLogId,
              data: { 
                status: duration > 0 ? "completed" : "failed",
                endedAt: new Date().toISOString(),
                durationSeconds: duration,
                hungUpBy
              },
              customerId: localCustomerId
            });
            if (duration > 0) {
              stopRecordingAndUpload(callLogId, duration);
            } else {
              if (mediaRecorderRef.current) {
                if (pauseToneNodesRef.current) { for (const o of pauseToneNodesRef.current.oscillators) { try { o.stop(); o.disconnect(); } catch (e) {} } for (const g of pauseToneNodesRef.current.gains) { try { g.disconnect(); } catch (e) {} } pauseToneNodesRef.current = null; }
                try { mediaRecorderRef.current.stop(); } catch (e) {}
                mediaRecorderRef.current = null;
                isRecordingRef.current = false;
                callContext.setIsRecording(false);
                callContext.setIsRecordingPaused(false);
                recordingChunksRef.current = [];
                recordingDestinationRef.current = null;
                recordingSourceNodesRef.current = [];
              }
            }
            callContext.setAutoRecord(true);
            onCallEnd?.(duration, duration > 0 ? "completed" : "failed", callLogId);
            setCurrentCallLogId(null);
            if (!callContext.preventAutoReset) {
              setTimeout(() => {
                setCallStateLocal((prev) => {
                  if (prev === "ended") {
                    callContext.setCallState("idle");
                    callContext.setCallInfo(null);
                    callContext.resetCallTiming();
                    return "idle";
                  }
                  return prev;
                });
                setCallDuration(0);
                sessionRef.current = null;
              }, 3000);
            }
            break;
        }
      });

      await inviter.invite();
    } catch (error) {
      console.error("Call error:", error);
      if (currentCallLogId) {
        updateCallLogMutation.mutate({
          id: currentCallLogId,
          data: { 
            status: "failed",
            endedAt: new Date().toISOString()
          },
          customerId: localCustomerId
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
  }, [phoneNumber, sipConfig.server, sipConfig.realm, ensureRegistered, onCallStart, onCallEnd, toast, createCallLogMutation, updateCallLogMutation, userId, currentUser, localCustomerId, localCampaignId, localCustomerName, currentCallLogId, isSipConfigured]);

  useEffect(() => {
    if (pendingCall && (callState === "idle" || callState === "ended")) {
      if (callState === "ended") {
        setCallState("idle");
        setCallDuration(0);
        sessionRef.current = null;
      }
      const callData = pendingCall;
      setPhoneNumber(callData.phoneNumber);
      setLocalCustomerId(callData.customerId?.toString());
      setLocalCampaignId(callData.campaignId?.toString());
      setLocalCampaignName(callData.campaignName);
      setLocalCustomerName(callData.customerName);
      setLocalLeadScore(callData.leadScore);
      setLocalClientStatus(callData.clientStatus);
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

  const handleAnswerIncoming = useCallback(async () => {
    if (!incomingCall) return;
    if (answerGuardRef.current) {
      console.log("[SIP] handleAnswerIncoming already in progress, ignoring duplicate");
      return;
    }
    answerGuardRef.current = true;
    
    try {
      setCallState("active");
      callContext.resetCallTiming();
      setPhoneNumber(incomingCall.callerNumber);
      
      const callLogData = await createCallLogMutation.mutateAsync({
        phoneNumber: incomingCall.callerNumber,
        direction: "inbound",
        status: "initiated",
        userId: userId || currentUser?.id,
        customerId: localCustomerId,
        customerName: incomingCall.callerName !== incomingCall.callerNumber ? incomingCall.callerName : localCustomerName,
      });
      setCurrentCallLogId(callLogData.id);
      
      const session = await answerIncomingCall();
      if (!session) {
        toast({
          title: "Chyba",
          description: "Nepodarilo sa prijať hovor",
          variant: "destructive"
        });
        setCallState("idle");
        answerGuardRef.current = false;
        return;
      }
      
      sessionRef.current = session;
      const callLogId = callLogData.id;
      
      setCallState("active");
      setIsOnHold(false);
      callStartTimeRef.current = Date.now();
      callContext.setCallTiming({ callStartTime: Date.now() });
      
      callTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }, 1000);
      
      updateCallLogMutation.mutate({
        id: callLogId,
        data: { status: "answered", answeredAt: new Date().toISOString() },
        customerId: localCustomerId
      });
      
      answerGuardRef.current = false;
      onCallStart?.(incomingCall.callerNumber, callLogId);
      setupAudio(session);
      
      if (callContext.autoRecord) {
        setTimeout(() => startRecording(session), 500);
      }
      
      session.stateChange.addListener((state: any) => {
        if (state === SessionState.Terminated) {
          if (forceIdleRef.current) {
            forceIdleRef.current = false;
            return;
          }
          const duration = callStartTimeRef.current 
            ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) 
            : 0;
          setCallState("ended");
          if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
          }
          const hungUpBy = userHungUpRef.current ? "user" : "customer";
          userHungUpRef.current = false;
          callContext.setCallTiming({
            callEndTime: Date.now(),
            talkDurationSeconds: duration > 0 ? duration : null,
            hungUpBy,
          });
          updateCallLogMutation.mutate({
            id: callLogId,
            data: { 
              status: duration > 0 ? "completed" : "failed",
              endedAt: new Date().toISOString(),
              durationSeconds: duration,
              hungUpBy
            },
            customerId: localCustomerId
          });
          if (duration > 0) {
            stopRecordingAndUpload(callLogId, duration);
          } else {
            if (mediaRecorderRef.current) {
              if (pauseToneNodesRef.current) { for (const o of pauseToneNodesRef.current.oscillators) { try { o.stop(); o.disconnect(); } catch (e) {} } for (const g of pauseToneNodesRef.current.gains) { try { g.disconnect(); } catch (e) {} } pauseToneNodesRef.current = null; }
              try { mediaRecorderRef.current.stop(); } catch (e) {}
              mediaRecorderRef.current = null;
              isRecordingRef.current = false;
              callContext.setIsRecording(false);
              callContext.setIsRecordingPaused(false);
              recordingChunksRef.current = [];
              recordingDestinationRef.current = null;
              recordingSourceNodesRef.current = [];
            }
          }
          callContext.setAutoRecord(true);
          onCallEnd?.(duration, duration > 0 ? "completed" : "failed", callLogId);
          setCurrentCallLogId(null);
          if (!callContext.preventAutoReset) {
            setTimeout(() => {
              setCallStateLocal((prev) => {
                if (prev === "ended") {
                  callContext.setCallState("idle");
                  callContext.setCallInfo(null);
                  callContext.resetCallTiming();
                  return "idle";
                }
                return prev;
              });
              setCallDuration(0);
              sessionRef.current = null;
            }, 3000);
          }
        }
      });
      
    } catch (error: any) {
      console.error("[SIP] Error handling incoming call:", error);
      toast({
        title: "Chyba hovoru",
        description: "Nepodarilo sa spracovať prichádzajúci hovor",
        variant: "destructive"
      });
      setCallState("idle");
      answerGuardRef.current = false;
    }
  }, [incomingCall, answerIncomingCall, toast, createCallLogMutation, updateCallLogMutation, userId, currentUser, localCustomerId, localCustomerName, onCallStart, onCallEnd, stopRecordingAndUpload, startRecording]);

  const handleRejectIncoming = useCallback(() => {
    rejectIncomingCall();
    toast({
      title: "Hovor odmietnutý",
      description: "Prichádzajúci hovor bol odmietnutý",
    });
  }, [rejectIncomingCall, toast]);

  const setupAudio = async (session: Session) => {
    const sessionDescriptionHandler = session.sessionDescriptionHandler;
    if (!sessionDescriptionHandler) return;

    const peerConnection = (sessionDescriptionHandler as any).peerConnection as RTCPeerConnection;
    if (!peerConnection) return;

    // Set up remote audio (speaker) with ontrack listener for new tracks
    peerConnection.ontrack = (event) => {
      if (event.track.kind === "audio" && audioRef.current) {
        console.log("[SIP] Remote audio track received via ontrack");
        const remoteStream = new MediaStream([event.track]);
        audioRef.current.srcObject = remoteStream;
        audioRef.current.play().catch((e) => {
          console.warn("[SIP] Autoplay blocked, waiting for user gesture:", e);
        });
      }
    };

    // Also check existing receivers (in case tracks already arrived)
    peerConnection.getReceivers().forEach((receiver) => {
      if (receiver.track && receiver.track.kind === "audio") {
        console.log("[SIP] Remote audio track found in existing receivers");
        const remoteStream = new MediaStream([receiver.track]);
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current.play().catch(console.error);
        }
      }
    });

    // Set up microphone gain control
    try {
      const senders = peerConnection.getSenders();
      const audioSender = senders.find(s => s.track?.kind === "audio");
      
      if (audioSender?.track) {
        // Create AudioContext for microphone processing
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        
        const audioContext = audioContextRef.current;
        
        // Resume AudioContext if suspended (required after user gesture)
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
        
        // Get the local audio stream
        const localStream = new MediaStream([audioSender.track]);
        const source = audioContext.createMediaStreamSource(localStream);
        
        // Create gain node for microphone volume control
        const gainNode = audioContext.createGain();
        gainNode.gain.value = micVolume / 100;
        micGainNodeRef.current = gainNode;
        
        // Create destination for processed audio
        const destination = audioContext.createMediaStreamDestination();
        
        // Connect: source -> gain -> destination
        source.connect(gainNode);
        gainNode.connect(destination);
        
        // Replace the track in the sender with the processed track
        const processedTrack = destination.stream.getAudioTracks()[0];
        await audioSender.replaceTrack(processedTrack);
      }
    } catch (error) {
      console.error("Error setting up microphone gain control:", error);
    }
  };

  const endCall = useCallback(() => {
    userHungUpRef.current = true;
    if (sessionRef.current) {
      try {
        if (sessionRef.current.state === SessionState.Established) {
          sessionRef.current.bye();
        } else {
          (sessionRef.current as Inviter).cancel?.();
          if (currentCallLogId) {
            updateCallLogMutation.mutate({
              id: currentCallLogId,
              data: { 
                status: "cancelled",
                endedAt: new Date().toISOString(),
                hungUpBy: "user"
              },
              customerId: localCustomerId
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
  }, [currentCallLogId, updateCallLogMutation]);

  const forceResetCall = useCallback(() => {
    forceIdleRef.current = true;

    if (currentCallLogId) {
      const duration = callStartTimeRef.current 
        ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) 
        : 0;
      if (duration > 0) {
        stopRecordingAndUpload(currentCallLogId, duration);
      } else {
        if (mediaRecorderRef.current) {
          if (pauseToneNodesRef.current) { for (const o of pauseToneNodesRef.current.oscillators) { try { o.stop(); o.disconnect(); } catch (e) {} } for (const g of pauseToneNodesRef.current.gains) { try { g.disconnect(); } catch (e) {} } pauseToneNodesRef.current = null; }
          try { mediaRecorderRef.current.stop(); } catch (e) {}
          mediaRecorderRef.current = null;
          isRecordingRef.current = false;
          callContext.setIsRecording(false);
          callContext.setIsRecordingPaused(false);
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
        customerId: localCustomerId
      });
    }

    if (sessionRef.current) {
      try {
        if (sessionRef.current.state === SessionState.Established) {
          sessionRef.current.bye();
        } else {
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
    callContext.setCallState("idle");
    callContext.setCallDuration(0);
    callContext.setCallInfo(null);
    callContext.resetCallTiming();
    callContext.setIsMuted(false);
    callContext.setIsOnHold(false);
  }, [callContext, currentCallLogId, updateCallLogMutation, localCustomerId]);

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
    callContext.endCallFn.current = endCall;
    callContext.forceResetCallFn.current = forceResetCall;
    callContext.toggleMuteFn.current = toggleMute;
    callContext.toggleHoldFn.current = toggleHold;
  }, [endCall, forceResetCall, toggleMute, toggleHold, callContext]);

  useEffect(() => {
    callContext.onVolumeChangeFn.current = (vol: number) => {
      setVolume(vol);
      if (audioRef.current) {
        audioRef.current.volume = vol / 100;
      }
    };
    callContext.onMicVolumeChangeFn.current = (vol: number) => {
      setMicVolume(vol);
      if (micGainNodeRef.current) {
        micGainNodeRef.current.gain.value = vol / 100;
      }
    };
    callContext.sendDtmfFn.current = (digit: string) => {
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
  }, [callContext, callState]);

  useEffect(() => {
    callContext.setVolume(volume);
  }, [volume, callContext]);

  useEffect(() => {
    callContext.setMicVolume(micVolume);
  }, [micVolume, callContext]);

  useEffect(() => {
    if (callState !== "idle" && callState !== "ended") {
      const direction = activeInboundMetaRef.current?.direction || "outbound";
      callContext.setCallInfo({
        phoneNumber,
        callerName: localCustomerName,
        customerId: localCustomerId,
        campaignId: localCampaignId,
        direction,
        callLogId: currentCallLogId ?? undefined,
        leadScore: localLeadScore,
        clientStatus: localClientStatus,
      });
      callContext.setCallDuration(callDuration);
    } else {
      callContext.setCallInfo(null);
    }
  }, [callState, phoneNumber, localCustomerName, localCustomerId, localCampaignId, currentCallLogId, callDuration, callContext, localLeadScore, localClientStatus]);

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
        return <Badge className="bg-green-500">Aktívny hovor</Badge>;
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
                className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700"
                onClick={makeCall}
                disabled={!phoneNumber || !isRegistered || !isSipConfigured}
                data-testid="button-make-call"
              >
                <Phone className="h-6 w-6" />
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

  const handleCall = () => {
    // Always set pendingCall - system will wait for registration if needed
    makeCall({
      phoneNumber,
      customerId,
      campaignId,
      customerName,
      leadScore,
      clientStatus,
    });
    
    // If not registered yet, trigger registration
    if (!isRegistered && !isRegistering) {
      register();
    }
  };

  if (!phoneNumber) {
    return null;
  }

  return (
    <Button
      className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50"
      onClick={handleCall}
      disabled={!isRegistered}
      data-testid="button-call-floating"
    >
      <Phone className={`h-6 w-6 ${!isRegistered ? "opacity-50" : ""}`} />
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
  const { data: authData } = useQuery<{ user: User | null }>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  
  const currentUser = authData?.user;
  const hasSipEnabled = currentUser && (currentUser as any).sipEnabled;

  const handleCall = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Always set pendingCall - the system will wait for registration if needed
    makeCall({
      phoneNumber,
      customerId: typeof customerId === 'number' ? String(customerId) : customerId,
      campaignId: typeof campaignId === 'number' ? String(campaignId) : campaignId,
      customerName,
      leadScore,
      clientStatus,
    });
    
    // If not registered yet, trigger registration (call will proceed after registration)
    if (!isRegistered && !isRegistering) {
      register();
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
        disabled={!isRegistered}
        data-testid="button-call-customer-icon"
        title={!isRegistered ? "SIP nie je pripojený" : `Zavolat na ${phoneNumber}`}
      >
        <PhoneCall className={`h-4 w-4 ${isRegistered ? "text-primary" : "text-muted-foreground"}`} />
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
        disabled={!isRegistered}
        data-testid="button-call-customer-small"
        className="gap-1"
      >
        <PhoneCall className={`h-3 w-3 ${!isRegistered ? "text-muted-foreground" : ""}`} />
        {isRegistered ? "Zavolat" : "Nepripojený"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={handleCall}
      disabled={!isRegistered}
      data-testid="button-call-customer"
      className="gap-2"
    >
      <PhoneCall className={`h-4 w-4 ${!isRegistered ? "text-muted-foreground" : ""}`} />
      {isRegistered ? `Zavolat ${phoneNumber}` : "SIP nepripojený"}
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
    callContext.openDialpadFn.current = () => setIsOpen(true);
  }, [callContext]);

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
