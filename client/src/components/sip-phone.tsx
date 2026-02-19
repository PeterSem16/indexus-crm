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
  const { isRegistered, isRegistering, registrationError, register, unregister, userAgentRef, registererRef, pendingCall, clearPendingCall } = useSip();
  const callContext = useCall();
  const [localCustomerId, setLocalCustomerId] = useState(customerId);
  const [localCampaignId, setLocalCampaignId] = useState(campaignId);
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef<boolean>(false);

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
    mutationFn: async ({ id, data, customerId }: { id: number; data: { status?: string; endedAt?: string; duration?: number; durationSeconds?: number; notes?: string; hungUpBy?: string }; customerId?: string }) => {
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

      const localSenders = pc.getSenders();
      const localAudioSender = localSenders.find(s => s.track?.kind === "audio");
      if (localAudioSender?.track) {
        const localStream = new MediaStream([localAudioSender.track]);
        const localSource = recCtx.createMediaStreamSource(localStream);
        localSource.connect(destination);
      }

      const connectRemoteTrack = (track: MediaStreamTrack) => {
        if (track.kind === "audio" && recCtx.state !== "closed") {
          try {
            const remoteStream = new MediaStream([track]);
            const remoteSource = recCtx.createMediaStreamSource(remoteStream);
            remoteSource.connect(destination);
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
      mediaRecorderRef.current.pause();
      callContext.setIsRecordingPaused(true);
      console.log("[Recording] Paused");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      callContext.setIsRecordingPaused(false);
      console.log("[Recording] Resumed");
    }
  }, []);

  useEffect(() => {
    callContext.pauseRecordingFn.current = pauseRecording;
    callContext.resumeRecordingFn.current = resumeRecording;
    return () => {
      callContext.pauseRecordingFn.current = null;
      callContext.resumeRecordingFn.current = null;
    };
  }, [pauseRecording, resumeRecording]);

  const stopRecordingAndUpload = useCallback((callLogId: string | number, duration: number) => {
    if (!mediaRecorderRef.current || !isRecordingRef.current) return;
    isRecordingRef.current = false;
    callContext.setIsRecording(false);
    callContext.setIsRecordingPaused(false);

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
      formData.append("campaignName", "");
      formData.append("phoneNumber", phoneNumber);
      formData.append("durationSeconds", String(duration));

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
  }, [localCustomerId, localCampaignId, localCustomerName, currentUser, phoneNumber]);

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

  const makeCall = useCallback(async () => {
    userHungUpRef.current = false;
    
    if (!isSipConfigured) {
      toast({
        title: "SIP nie je nakonfigurovaný",
        description: "Kontaktujte administrátora pre nastavenie SIP telefónu",
        variant: "destructive"
      });
      return;
    }
    
    if (!phoneNumber || !userAgentRef.current || !isRegistered) {
      if (!isRegistered) {
        toast({
          title: "Nepripojené",
          description: "Najprv sa pripojte k SIP serveru",
          variant: "destructive"
        });
      }
      return;
    }

    try {
      setCallState("connecting");
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
              data: { status: "answered" },
              customerId: localCustomerId
            });
            onCallStart?.(phoneNumber, callLogId);
            setupAudio(inviter);
            setTimeout(() => startRecording(inviter), 500);
            break;
          case SessionState.Terminated:
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
                try { mediaRecorderRef.current.stop(); } catch (e) {}
                mediaRecorderRef.current = null;
                isRecordingRef.current = false;
                callContext.setIsRecording(false);
                callContext.setIsRecordingPaused(false);
                recordingChunksRef.current = [];
              }
            }
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
    }
  }, [phoneNumber, sipConfig.server, sipConfig.realm, isRegistered, onCallStart, onCallEnd, toast, createCallLogMutation, updateCallLogMutation, userId, currentUser, localCustomerId, localCampaignId, localCustomerName, currentCallLogId, isSipConfigured]);

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
      setLocalCustomerName(callData.customerName);
      setLocalLeadScore(callData.leadScore);
      setLocalClientStatus(callData.clientStatus);
      clearPendingCall();
      
      if (isRegistered) {
        setTimeout(() => {
          makeCall();
        }, 100);
      } else {
        pendingCallProcessedRef.current = true;
      }
    }
  }, [pendingCall, callState, clearPendingCall, isRegistered, makeCall]);

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
          try { mediaRecorderRef.current.stop(); } catch (e) {}
          mediaRecorderRef.current = null;
          isRecordingRef.current = false;
          callContext.setIsRecording(false);
          callContext.setIsRecordingPaused(false);
          recordingChunksRef.current = [];
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
      callContext.setCallInfo({
        phoneNumber,
        callerName: localCustomerName,
        customerId: localCustomerId,
        campaignId: localCampaignId,
        direction: "outbound",
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
