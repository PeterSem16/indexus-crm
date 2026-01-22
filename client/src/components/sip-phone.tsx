import { useState, useEffect, useRef, useCallback } from "react";
import { UserAgent, Registerer, RegistererState, Inviter, Session, SessionState } from "sip.js";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
  customerName
}: SipPhoneProps) {
  const { toast } = useToast();
  const [callState, setCallState] = useState<CallState>("idle");
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [volume, setVolume] = useState(80);
  const [micVolume, setMicVolume] = useState(100);
  const [callDuration, setCallDuration] = useState(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [currentCallLogId, setCurrentCallLogId] = useState<number | null>(null);
  const [sipConfig, setSipConfig] = useState<SipConfig>(config || {
    server: "",
    username: "",
    password: "",
    displayName: "Operator"
  });
  
  const userAgentRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);

  const { data: globalSipSettings, isLoading: sipSettingsLoading } = useQuery<SipSettings | null>({
    queryKey: ["/api/sip-settings"],
    retry: false,
  });

  const { data: authData, isLoading: userLoading } = useQuery<{ user: User | null }>({
    queryKey: ["/api/auth/me"],
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
    }
  });

  const updateCallLogMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { status?: string; endedAt?: string; duration?: number; notes?: string } }) => {
      const res = await apiRequest("PATCH", `/api/call-logs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
    }
  });

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
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
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
    if (registererRef.current) {
      try {
        registererRef.current.unregister();
      } catch (e) {
        console.error("Error unregistering:", e);
      }
    }
    if (userAgentRef.current) {
      try {
        userAgentRef.current.stop();
      } catch (e) {
        console.error("Error stopping user agent:", e);
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

    try {
      const serverHost = sipConfig.server;
      const serverPort = sipConfig.port || 443;
      const wsPath = sipConfig.wsPath || "/ws";
      const realm = sipConfig.realm || sipConfig.server;
      
      const uri = UserAgent.makeURI(`sip:${sipConfig.username}@${realm}`);
      if (!uri) {
        throw new Error("Invalid SIP URI");
      }

      const wsProtocol = sipConfig.transport === "ws" ? "ws" : "wss";
      const transportOptions = {
        server: `${wsProtocol}://${serverHost}:${serverPort}${wsPath}`
      };

      const userAgentOptions = {
        authorizationPassword: sipConfig.password,
        authorizationUsername: sipConfig.username,
        displayName: sipConfig.displayName || sipConfig.username,
        transportOptions,
        uri
      };

      const userAgent = new UserAgent(userAgentOptions);
      userAgentRef.current = userAgent;

      await userAgent.start();

      const registerer = new Registerer(userAgent);
      registererRef.current = registerer;

      registerer.stateChange.addListener((newState) => {
        console.log("Registerer state:", newState);
        if (newState === RegistererState.Registered) {
          setIsRegistered(true);
          toast({
            title: "Pripojené",
            description: "SIP telefón je pripojený k serveru"
          });
        } else if (newState === RegistererState.Unregistered || newState === RegistererState.Terminated) {
          setIsRegistered(false);
        }
      });

      await registerer.register();
    } catch (error) {
      console.error("SIP connection error:", error);
      toast({
        title: "Chyba pripojenia",
        description: "Nepodarilo sa pripojiť k SIP serveru",
        variant: "destructive"
      });
      setIsRegistered(false);
    }
  }, [sipConfig, toast]);

  const disconnect = useCallback(async () => {
    cleanup();
    setIsRegistered(false);
    setCallState("idle");
    toast({
      title: "Odpojené",
      description: "SIP telefón bol odpojený"
    });
  }, [cleanup, toast]);

  const makeCall = useCallback(async () => {
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
      
      const callLogData = await createCallLogMutation.mutateAsync({
        phoneNumber,
        direction: "outbound",
        status: "initiated",
        userId: userId || currentUser?.id,
        customerId,
        campaignId,
        customerName,
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
            updateCallLogMutation.mutate({
              id: callLogId,
              data: { status: "ringing" }
            });
            break;
          case SessionState.Established:
            setCallState("active");
            callStartTimeRef.current = Date.now();
            callTimerRef.current = setInterval(() => {
              setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
            }, 1000);
            updateCallLogMutation.mutate({
              id: callLogId,
              data: { status: "answered" }
            });
            onCallStart?.(phoneNumber, callLogId);
            setupAudio(inviter);
            break;
          case SessionState.Terminated:
            const duration = callStartTimeRef.current 
              ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) 
              : 0;
            setCallState("ended");
            if (callTimerRef.current) {
              clearInterval(callTimerRef.current);
            }
            updateCallLogMutation.mutate({
              id: callLogId,
              data: { 
                status: duration > 0 ? "completed" : "failed",
                endedAt: new Date().toISOString(),
                duration
              }
            });
            onCallEnd?.(duration, duration > 0 ? "completed" : "failed", callLogId);
            setCurrentCallLogId(null);
            setTimeout(() => {
              setCallState("idle");
              setCallDuration(0);
            }, 2000);
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
          }
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
  }, [phoneNumber, sipConfig.server, sipConfig.realm, isRegistered, onCallStart, onCallEnd, toast, createCallLogMutation, updateCallLogMutation, userId, currentUser, customerId, campaignId, customerName, currentCallLogId, isSipConfigured]);

  const setupAudio = async (session: Session) => {
    const sessionDescriptionHandler = session.sessionDescriptionHandler;
    if (!sessionDescriptionHandler) return;

    const peerConnection = (sessionDescriptionHandler as any).peerConnection as RTCPeerConnection;
    if (!peerConnection) return;

    // Set up remote audio (speaker)
    peerConnection.getReceivers().forEach((receiver) => {
      if (receiver.track && receiver.track.kind === "audio") {
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
                endedAt: new Date().toISOString()
              }
            });
            setCurrentCallLogId(null);
          }
        }
      } catch (error) {
        console.error("Error ending call:", error);
      }
    }
    
    // Clean up audio processing resources
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
        micGainNodeRef.current = null;
      } catch (e) {
        console.error("Error closing audio context:", e);
      }
    }
    
    setCallState("idle");
    setCallDuration(0);
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
  }, [currentCallLogId, updateCallLogMutation]);

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
    if (!sessionRef.current || sessionRef.current.state !== SessionState.Established) return;

    try {
      const sessionDescriptionHandler = sessionRef.current.sessionDescriptionHandler;
      if (!sessionDescriptionHandler) return;

      const peerConnection = (sessionDescriptionHandler as any).peerConnection as RTCPeerConnection;
      if (!peerConnection) return;

      if (isOnHold) {
        peerConnection.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.enabled = true;
          }
        });
        setIsOnHold(false);
        setCallState("active");
      } else {
        peerConnection.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.enabled = false;
          }
        });
        setIsOnHold(true);
        setCallState("on_hold");
      }
    } catch (error) {
      console.error("Hold error:", error);
    }
  }, [isOnHold]);

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
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setIsConfigOpen(true)}
              data-testid="button-sip-settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
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

        {!isRegistered && (
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

interface SipPhoneFloatingProps extends Pick<SipPhoneProps, "onCallStart" | "onCallEnd" | "customerId" | "campaignId" | "customerName"> {
  initialNumber?: string;
}

export function SipPhoneFloating({ 
  onCallStart, 
  onCallEnd, 
  customerId, 
  campaignId, 
  customerName,
  initialNumber 
}: SipPhoneFloatingProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-toggle-phone"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
      </Button>
      
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 shadow-xl">
          <SipPhone 
            onCallStart={onCallStart} 
            onCallEnd={onCallEnd}
            customerId={customerId}
            campaignId={campaignId}
            customerName={customerName}
            initialNumber={initialNumber}
          />
        </div>
      )}
    </>
  );
}

interface CallCustomerButtonProps {
  phoneNumber: string;
  customerId?: string;
  customerName?: string;
  campaignId?: string;
  variant?: "icon" | "default" | "small";
}

export function CallCustomerButton({ 
  phoneNumber, 
  customerId, 
  customerName, 
  campaignId,
  variant = "default" 
}: CallCustomerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: authData } = useQuery<{ user: User | null }>({
    queryKey: ["/api/auth/me"],
  });
  
  const currentUser = authData?.user;
  const hasSipEnabled = currentUser && (currentUser as any).sipEnabled;

  if (!hasSipEnabled || !phoneNumber) {
    return null;
  }

  if (variant === "icon") {
    return (
      <>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
          }}
          data-testid="button-call-customer-icon"
          title={`Zavolať na ${phoneNumber}`}
        >
          <PhoneCall className="h-4 w-4 text-green-600" />
        </Button>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-sm p-0 overflow-hidden">
            <SipPhone 
              initialNumber={phoneNumber}
              customerId={customerId}
              customerName={customerName}
              campaignId={campaignId}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (variant === "small") {
    return (
      <>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
          }}
          data-testid="button-call-customer-small"
          className="gap-1"
        >
          <PhoneCall className="h-3 w-3" />
          Zavolať
        </Button>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-sm p-0 overflow-hidden">
            <SipPhone 
              initialNumber={phoneNumber}
              customerId={customerId}
              customerName={customerName}
              campaignId={campaignId}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        data-testid="button-call-customer"
        className="gap-2"
      >
        <PhoneCall className="h-4 w-4" />
        Zavolať {phoneNumber}
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <SipPhone 
            initialNumber={phoneNumber}
            customerId={customerId}
            customerName={customerName}
            campaignId={campaignId}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SipPhoneHeaderButtonProps {
  user: { sipEnabled?: boolean; sipExtension?: string | null; sipPassword?: string | null } | null;
  sipContext?: { isRegistered: boolean; isRegistering: boolean };
}

export function SipPhoneHeaderButton({ user, sipContext }: SipPhoneHeaderButtonProps) {
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

  if (!user?.sipEnabled || !sipSettings?.isEnabled) {
    return null;
  }

  const isRegistered = sipContext?.isRegistered || false;
  const isRegistering = sipContext?.isRegistering || false;

  return (
    <div className="flex items-center gap-1" data-testid="sip-phone-header-status">
      <Phone className="h-4 w-4 text-muted-foreground" />
      {isRegistering && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0">
          <Loader2 className="h-3 w-3 animate-spin" />
        </Badge>
      )}
      {!isRegistering && isRegistered && (
        <Badge variant="default" className="bg-green-600 text-xs px-1.5 py-0" data-testid="badge-sip-registered">
          OK
        </Badge>
      )}
      {!isRegistering && !isRegistered && (
        <Badge variant="destructive" className="text-xs px-1.5 py-0" data-testid="badge-sip-not-registered">
          !
        </Badge>
      )}
    </div>
  );
}
