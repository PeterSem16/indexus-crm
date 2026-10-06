import { useEffect, useState } from "react";

// Test-only providers served by the isolated Vite regression fixture.
export function useSip() {
  const [isRegistered, setRegistered] = useState(true);
  useEffect(() => {
    const changed = (event: Event) => setRegistered((event as CustomEvent<boolean>).detail);
    window.addEventListener("test-sip", changed);
    return () => window.removeEventListener("test-sip", changed);
  }, []);
  return { isRegistered };
}

export function useCall() {
  const [callState, setCallState] = useState("idle");
  useEffect(() => {
    const changed = (event: Event) => setCallState((event as CustomEvent<string>).detail);
    window.addEventListener("test-call", changed);
    return () => window.removeEventListener("test-call", changed);
  }, []);
  return { callState };
}
