import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { format } from "date-fns";

interface TimelineEvent {
  action: string;
  actorType: string;
  actorName: string | null;
  createdAt: string;
  details: string | null;
}

interface TimelineData {
  contract: {
    contractNumber: string;
    status: string;
    createdAt: string;
    signedAt: string | null;
    contactDate: string | null;
  };
  participants: Array<{
    fullName: string;
    participantType: string;
    role: string;
    signedAt: string | null;
    signatureRequired: boolean;
  }>;
  events: TimelineEvent[];
}

const ACTION_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  created: { color: "#3B82F6", bgColor: "#EFF6FF", label: "Contract Created" },
  updated: { color: "#8B5CF6", bgColor: "#F5F3FF", label: "Contract Updated" },
  sent: { color: "#F59E0B", bgColor: "#FFFBEB", label: "Sent for Signature" },
  viewed: { color: "#6366F1", bgColor: "#EEF2FF", label: "Contract Viewed" },
  signing_page_viewed: { color: "#6366F1", bgColor: "#EEF2FF", label: "Signing Page Viewed" },
  otp_sent: { color: "#F97316", bgColor: "#FFF7ED", label: "Verification Code Sent" },
  otp_verified: { color: "#10B981", bgColor: "#ECFDF5", label: "Identity Verified" },
  signed: { color: "#059669", bgColor: "#ECFDF5", label: "Contract Signed" },
  completed: { color: "#059669", bgColor: "#ECFDF5", label: "Contract Completed" },
  executed: { color: "#059669", bgColor: "#ECFDF5", label: "Contract Executed" },
  cancelled: { color: "#EF4444", bgColor: "#FEF2F2", label: "Contract Cancelled" },
  terminated: { color: "#EF4444", bgColor: "#FEF2F2", label: "Contract Terminated" },
  audit_exported: { color: "#6B7280", bgColor: "#F9FAFB", label: "Audit Timeline Exported" },
  status_changed: { color: "#8B5CF6", bgColor: "#F5F3FF", label: "Status Changed" },
  received: { color: "#7C3AED", bgColor: "#F5F3FF", label: "Contract Received" },
  returned: { color: "#F97316", bgColor: "#FFF7ED", label: "Contract Returned" },
  verified: { color: "#10B981", bgColor: "#ECFDF5", label: "Contract Verified" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  created: { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  sent: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  received: { bg: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD" },
  returned: { bg: "#FFF7ED", text: "#C2410C", border: "#FDBA74" },
  pending_signature: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  signed: { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  verified: { bg: "#CCFBF1", text: "#115E59", border: "#5EEAD4" },
  executed: { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  completed: { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  cancelled: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  terminated: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  expired: { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" },
};

function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  try { return format(new Date(date), "dd.MM.yyyy"); } catch { return "-"; }
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return "-";
  try { return format(new Date(date), "dd.MM.yyyy HH:mm:ss"); } catch { return "-"; }
}

function formatTime(date: string | null | undefined) {
  if (!date) return "";
  try { return format(new Date(date), "HH:mm"); } catch { return ""; }
}

export default function AuditTimelinePublic() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<TimelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/audit-timeline/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to load" }));
          throw new Error(err.error || "Failed to load");
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: "4px solid #E5E7EB", borderTop: "4px solid #6B1C3B", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6B7280", fontSize: 14 }}>Loading timeline...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }} data-testid="status-error-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 style={{ color: "#991B1B", fontSize: 20, margin: "0 0 8px" }} data-testid="text-error-title">{error === "This timeline link has expired" ? "Link Expired" : "Not Found"}</h2>
          <p style={{ color: "#6B7280", fontSize: 14 }} data-testid="text-error-message">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const statusConfig = STATUS_COLORS[data.contract.status] || STATUS_COLORS.draft;

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
      <header style={{ background: "#6B1C3B", color: "white", padding: "24px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Contract Audit Timeline</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>INDEXUS CRM</p>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "#111827" }} data-testid="text-contract-number">{data.contract.contractNumber}</h2>
              <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>Contract Date: {formatDate(data.contract.contactDate || data.contract.createdAt)}</p>
            </div>
            <div style={{
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              background: statusConfig.bg,
              color: statusConfig.text,
              border: `1px solid ${statusConfig.border}`,
            }} data-testid="badge-contract-status">
              {data.contract.status.replace(/_/g, " ").toUpperCase()}
            </div>
          </div>

          {data.participants.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Participants</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.participants.map((p, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", borderRadius: 8,
                    background: p.signedAt ? "#ECFDF5" : "#F9FAFB",
                    border: `1px solid ${p.signedAt ? "#A7F3D0" : "#E5E7EB"}`,
                    fontSize: 13,
                  }} data-testid={`card-participant-${i}`}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: p.signedAt ? "#059669" : "#D1D5DB",
                      color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 600,
                    }}>
                      {p.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: "#111827" }}>{p.fullName}</div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>
                        {p.participantType} {p.signedAt ? `• Signed ${formatDate(p.signedAt)}` : p.signatureRequired ? "• Awaiting signature" : ""}
                      </div>
                    </div>
                    {p.signedAt && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#111827", fontWeight: 600 }}>Timeline</h3>

        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", left: 19, top: 0, bottom: 0, width: 2,
            background: "linear-gradient(to bottom, #6B1C3B, #D1D5DB, transparent)",
          }} />

          {data.events.map((event, index) => {
            const config = ACTION_CONFIG[event.action] || { color: "#6B7280", bgColor: "#F9FAFB", label: event.action };
            let details: Record<string, any> = {};
            try { details = event.details ? JSON.parse(event.details) : {}; } catch {}
            const isFirst = index === 0;
            const isLast = index === data.events.length - 1;
            const isSignature = event.action === "signed" || event.action === "completed";

            return (
              <div key={index} style={{
                display: "flex", gap: 16, marginBottom: isLast ? 0 : 8,
                position: "relative",
              }} data-testid={`row-timeline-event-${index}`}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: isSignature ? config.color : "white",
                  border: `3px solid ${config.color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, zIndex: 1,
                  boxShadow: isFirst ? `0 0 0 4px ${config.bgColor}` : "none",
                  fontSize: 16,
                }}>
                  {isSignature ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: config.color }} />
                  )}
                </div>

                <div style={{
                  flex: 1, background: "white", borderRadius: 10,
                  border: `1px solid ${isSignature ? config.color + "40" : "#E5E7EB"}`,
                  padding: "14px 18px",
                  boxShadow: isSignature ? `0 1px 4px ${config.color}15` : "0 1px 2px rgba(0,0,0,0.04)",
                  marginBottom: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: config.color }} data-testid={`text-event-label-${index}`}>
                        {config.label}
                      </span>
                      {event.actorName && (
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 12,
                          background: event.actorType === "customer" ? "#FEF3C7" : event.actorType === "system" ? "#F3F4F6" : "#EFF6FF",
                          color: event.actorType === "customer" ? "#92400E" : event.actorType === "system" ? "#374151" : "#1E40AF",
                          fontWeight: 500,
                        }}>
                          {event.actorName}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9CA3AF", fontSize: 12 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      {formatDateTime(event.createdAt)}
                    </div>
                  </div>

                  {Object.keys(details).length > 0 && (
                    <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#F9FAFB", fontSize: 12, color: "#6B7280" }}>
                      {Object.entries(details).map(([key, value]) => (
                        <div key={key} style={{ display: "flex", gap: 4, marginBottom: 2 }}>
                          <span style={{ fontWeight: 500, color: "#374151" }}>{key}:</span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: 32, padding: "16px 0", borderTop: "1px solid #E5E7EB" }}>
          <p style={{ color: "#9CA3AF", fontSize: 12, margin: 0 }}>INDEXUS CRM • Contract Audit Timeline</p>
          <p style={{ color: "#D1D5DB", fontSize: 11, margin: "4px 0 0" }}>This is a secure, read-only view of the contract audit trail.</p>
        </div>
      </main>
    </div>
  );
}