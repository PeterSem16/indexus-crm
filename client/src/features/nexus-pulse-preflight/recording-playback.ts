const activePlaybacks = new Set<symbol>();

function notifyPlaybackState() {
  window.dispatchEvent(new CustomEvent("nexus-pulse-recording-playback", {
    detail: { active: activePlaybacks.size > 0 },
  }));
}

export function isPulseRecordingPlaybackActive() {
  return activePlaybacks.size > 0;
}

export function beginPulseRecordingPlayback() {
  const lease = Symbol("pulse-recording-playback");
  activePlaybacks.add(lease);
  notifyPlaybackState();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activePlaybacks.delete(lease);
    notifyPlaybackState();
  };
}