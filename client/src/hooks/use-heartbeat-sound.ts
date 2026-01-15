import { useCallback, useRef } from "react";

export function useHeartbeatSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);

  const playHeartbeat = useCallback((durationMs: number = 5000) => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("Web Audio API not supported");
        return;
      }

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const createHeartbeatPulse = (startTime: number) => {
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        filter.type = "lowpass";
        filter.frequency.value = 150;
        filter.Q.value = 1;

        oscillator1.type = "sine";
        oscillator1.frequency.value = 45;
        
        oscillator2.type = "sine";
        oscillator2.frequency.value = 30;

        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(filter);
        filter.connect(audioContext.destination);

        const lubTime = startTime;
        const dubTime = startTime + 0.15;

        gainNode.gain.setValueAtTime(0, lubTime);
        gainNode.gain.linearRampToValueAtTime(0.4, lubTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0.05, lubTime + 0.12);
        
        gainNode.gain.linearRampToValueAtTime(0.3, dubTime + 0.03);
        gainNode.gain.linearRampToValueAtTime(0, dubTime + 0.15);

        oscillator1.start(lubTime);
        oscillator1.stop(dubTime + 0.2);
        oscillator2.start(lubTime);
        oscillator2.stop(dubTime + 0.2);
      };

      const beatInterval = 0.85;
      const numBeats = Math.floor(durationMs / 1000 / beatInterval);

      for (let i = 0; i < numBeats; i++) {
        createHeartbeatPulse(audioContext.currentTime + i * beatInterval);
      }

      setTimeout(() => {
        audioContext.close();
        isPlayingRef.current = false;
      }, durationMs + 500);

    } catch (error) {
      console.error("Error playing heartbeat sound:", error);
      isPlayingRef.current = false;
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      isPlayingRef.current = false;
    }
  }, []);

  return { playHeartbeat, stopHeartbeat };
}
