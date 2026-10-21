export type GraphEmailPayload = { message: Record<string, unknown>; saveToSentItems: boolean };

/** One message with combined To/CC/BCC; provider errors contain no payload. */
export async function sendAutomationGraphEmail(token: string, payload: GraphEmailPayload, fetcher = fetch, sharedMailboxEmail?: string) {
  const endpoint = sharedMailboxEmail ? `users/${encodeURIComponent(sharedMailboxEmail)}` : "me";
  const response = await fetcher(`https://graph.microsoft.com/v1.0/${endpoint}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Configured mailbox rejected email (HTTP ${response.status})`);
}
