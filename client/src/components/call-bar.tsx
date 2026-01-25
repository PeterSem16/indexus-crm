import { useState } from "react";
import { useCall } from "@/contexts/call-context";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Pause, 
  Play,
  Loader2,
  Grid3X3,
  Volume2
} from "lucide-react";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const DTMF_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"]
];

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
    onVolumeChangeFn,
    onMicVolumeChangeFn,
    sendDtmfFn
  } = useCall();
  
  const [dialpadOpen, setDialpadOpen] = useState(false);

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

  const handleDtmf = (digit: string) => {
    if (sendDtmfFn.current) {
      sendDtmfFn.current(digit);
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

  const getLeadScoreColor = (score?: number) => {
    if (!score) return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    if (score >= 40) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  const getClientStatusColor = (status?: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "lead":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "prospect":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "inactive":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-card border-b shadow-lg pointer-events-auto" style={{ isolation: 'isolate' }} data-testid="call-bar">
      <div className="flex items-center justify-between px-4 py-2 max-w-screen-2xl mx-auto gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-shrink">
          <div className={`w-3 h-3 rounded-full animate-pulse flex-shrink-0 ${getStatusColor()}`} />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {callInfo?.callerName && (
                <span className="font-medium text-sm truncate">
                  {callInfo.callerName}
                </span>
              )}
              <span className={`text-sm ${callInfo?.callerName ? 'text-muted-foreground' : 'font-medium'}`}>
                {callInfo?.phoneNumber || t.callBar?.unknownCaller || "Unknown"}
              </span>
              {callInfo?.leadScore !== undefined && (
                <Badge variant="outline" className={`text-xs ${getLeadScoreColor(callInfo.leadScore)}`}>
                  {t.callBar?.leadScore || "Score"}: {callInfo.leadScore}
                </Badge>
              )}
              {callInfo?.clientStatus && (
                <Badge variant="outline" className={`text-xs ${getClientStatusColor(callInfo.clientStatus)}`}>
                  {callInfo.clientStatus}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{getStatusLabel()}</span>
              {isActive && (
                <span className="font-mono">{formatDuration(callDuration)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
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

              <Popover open={dialpadOpen} onOpenChange={setDialpadOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    data-testid="button-callbar-dialpad"
                    title={t.callBar?.dialpad || "Dialpad"}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="end">
                  <div className="grid grid-cols-3 gap-1">
                    {DTMF_KEYS.map((row, rowIndex) => (
                      row.map((digit) => (
                        <Button
                          key={digit}
                          variant="outline"
                          size="sm"
                          className="w-12 h-10 text-lg font-medium"
                          onClick={() => handleDtmf(digit)}
                          data-testid={`button-dtmf-${digit === "*" ? "star" : digit === "#" ? "hash" : digit}`}
                        >
                          {digit}
                        </Button>
                      ))
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              <div className="hidden lg:flex items-center gap-2 ml-2 border-l pl-2">
                <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Slider
                  value={[volume]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="w-16"
                  data-testid="slider-volume"
                />
              </div>
              
              <div className="hidden lg:flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Slider
                  value={[micVolume]}
                  onValueChange={handleMicVolumeChange}
                  max={100}
                  step={1}
                  className="w-16"
                  data-testid="slider-mic-volume"
                />
              </div>
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
