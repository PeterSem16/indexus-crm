import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NexusIcon } from "./nexus-icon";
import { NexusChat } from "./nexus-chat";
import { useHeartbeatSound } from "@/hooks/use-heartbeat-sound";

interface NexusButtonProps {
  nexusEnabled: boolean;
}

const NEXUS_HEARTBEAT_KEY = "nexus_heartbeat_played";

export function NexusButton({ nexusEnabled }: NexusButtonProps) {
  const [open, setOpen] = useState(false);
  const { playHeartbeat } = useHeartbeatSound();

  useEffect(() => {
    if (nexusEnabled) {
      const hasPlayed = sessionStorage.getItem(NEXUS_HEARTBEAT_KEY);
      if (!hasPlayed) {
        const timer = setTimeout(() => {
          playHeartbeat(5000);
          sessionStorage.setItem(NEXUS_HEARTBEAT_KEY, "true");
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [nexusEnabled, playHeartbeat]);

  if (!nexusEnabled) {
    return null;
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className="relative"
            data-testid="button-nexus-open"
          >
            <NexusIcon className="h-6 w-6" animate />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background animate-pulse" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>NEXUS AI Assistant</p>
        </TooltipContent>
      </Tooltip>
      <NexusChat open={open} onOpenChange={setOpen} />
    </>
  );
}
