import { useCallback, useEffect } from "react";
import {
  useToast,
  type ToastInput,
} from "@/hooks/use-toast";
import {
  installPulseNotificationAudioUnlock,
  playPulseNotificationChime,
} from "@/lib/pulse-notification-chime";

export function usePulseToast() {
  const toastStore = useToast();

  useEffect(() => {
    installPulseNotificationAudioUnlock();
  }, []);

  const toast = useCallback((props: ToastInput) => {
    const pulseState = props.pulseState
      ?? (props.variant === "destructive" ? "warning" : "success");
    playPulseNotificationChime();
    return toastStore.rawToast({
      ...props,
      variant: "pulse",
      pulseState,
    });
  }, [toastStore.toast]);

  return {
    ...toastStore,
    toast,
    qualityToast: toastStore.rawToast,
  };
}