import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NexusIcon } from "./nexus-icon";
import { NexusChat } from "./nexus-chat";
import { useHeartbeatSound } from "@/hooks/use-heartbeat-sound";

interface NexusButtonProps {
  nexusEnabled: boolean;
}

const NEXUS_HEARTBEAT_KEY = "nexus_heartbeat_played";
const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function getRandomInterval() {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

export function NexusButton({ nexusEnabled }: NexusButtonProps) {
  const [open, setOpen] = useState(false);
  const { playHeartbeat } = useHeartbeatSound();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initial heartbeat on first login
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

  // Random periodic heartbeat during work
  useEffect(() => {
    if (!nexusEnabled) return;

    const scheduleNextHeartbeat = () => {
      const nextInterval = getRandomInterval();
      intervalRef.current = setTimeout(() => {
        playHeartbeat(3000); // Shorter 3-second heartbeat for periodic sounds
        scheduleNextHeartbeat(); // Schedule next one
      }, nextInterval);
    };

    // Start scheduling after initial delay
    const startDelay = setTimeout(() => {
      scheduleNextHeartbeat();
    }, getRandomInterval());

    return () => {
      clearTimeout(startDelay);
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
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
