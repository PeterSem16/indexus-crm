export function callAnalysisViewState(hasRecording: boolean, status?: string | null) {
  if (!hasRecording) return "missing";
  if (status === "completed") return "completed";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  return "pending";
}
