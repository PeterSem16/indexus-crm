import { useCall } from "@/contexts/call-context";
import { useI18n, type Translations } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Pause, 
  Play,
  Loader2,
  Grid3X3,
  Volume2,
  VolumeX
} from "lucide-react";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function CallBar() {
  const { t } = useI18n();
  const { 
    callState, 
    callInfo, 
    callDuration, 
    isMuted, 
    isOnHold,
    volume,
    micVolume,
    endCallFn,
    toggleMuteFn,
    toggleHoldFn,
    openDialpadFn,
    onVolumeChangeFn,
    onMicVolumeChangeFn
  } = useCall();

  if (callState === "idle" || callState === "ended") {
    return null;
  }

  const isConnecting = callState === "connecting" || callState === "ringing";
  const isActive = callState === "active" || callState === "on_hold";

  const handleEndCall = () => {
    if (endCallFn.current) {
      endCallFn.current();
    }
  };

  const handleToggleMute = () => {
    if (toggleMuteFn.current) {
      toggleMuteFn.current();
    }
  };

  const handleToggleHold = () => {
    if (toggleHoldFn.current) {
      toggleHoldFn.current();
    }
  };

  const handleOpenDialpad = () => {
    if (openDialpadFn.current) {
      openDialpadFn.current();
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (onVolumeChangeFn.current) {
      onVolumeChangeFn.current(value[0]);
    }
  };

  const handleMicVolumeChange = (value: number[]) => {
    if (onMicVolumeChangeFn.current) {
      onMicVolumeChangeFn.current(value[0]);
    }
  };

  const getStatusLabel = () => {
    switch (callState) {
      case "connecting":
        return t.callBar?.connecting || "Connecting...";
      case "ringing":
        return t.callBar?.ringing || "Ringing...";
      case "active":
        return t.callBar?.active || "Active call";
      case "on_hold":
        return t.callBar?.onHold || "On hold";
      default:
        return "";
    }
  };

  const getStatusColor = () => {
    switch (callState) {
      case "connecting":
      case "ringing":
        return "bg-yellow-500";
      case "active":
        return "bg-green-500";
      case "on_hold":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-card border-b shadow-lg" data-testid="call-bar">
      <div className="flex items-center justify-between px-4 py-2 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full animate-pulse ${getStatusColor()}`} />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {callInfo?.callerName && (
                <span className="font-medium text-sm">
                  {callInfo.callerName}
                </span>
              )}
              <span className={`text-sm ${callInfo?.callerName ? 'text-muted-foreground' : 'font-medium'}`}>
                {callInfo?.phoneNumber || t.callBar?.unknownCaller || "Unknown"}
              </span>
              <Badge variant="secondary" className="text-xs">
                {callInfo?.direction === "inbound" 
                  ? (t.callBar?.inbound || "Inbound") 
                  : (t.callBar?.outbound || "Outbound")}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{getStatusLabel()}</span>
              {isActive && (
                <span className="font-mono">{formatDuration(callDuration)}</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isActive && (
            <>
              <div className="hidden md:flex items-center gap-2 min-w-[120px]">
                <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Slider
                  value={[volume]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="w-20"
                  data-testid="slider-volume"
                />
              </div>
              
              <div className="hidden md:flex items-center gap-2 min-w-[120px]">
                <Mic className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Slider
                  value={[micVolume]}
                  onValueChange={handleMicVolumeChange}
                  max={100}
                  step={1}
                  className="w-20"
                  data-testid="slider-mic-volume"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isConnecting && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          
          {isActive && (
            <>
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="icon"
                onClick={handleToggleMute}
                data-testid="button-callbar-mute"
                title={isMuted ? (t.callBar?.unmute || "Unmute") : (t.callBar?.mute || "Mute")}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              
              <Button
                variant={isOnHold ? "secondary" : "outline"}
                size="icon"
                onClick={handleToggleHold}
                data-testid="button-callbar-hold"
                title={isOnHold ? (t.callBar?.resume || "Resume") : (t.callBar?.hold || "Hold")}
              >
                {isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={handleOpenDialpad}
                data-testid="button-callbar-dialpad"
                title={t.callBar?.dialpad || "Dialpad"}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </>
          )}
          
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndCall}
            data-testid="button-callbar-end"
            className="gap-1"
          >
            <PhoneOff className="h-4 w-4" />
            <span className="hidden sm:inline">{t.callBar?.endCall || "End call"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
