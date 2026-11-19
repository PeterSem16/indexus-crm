import { JobError } from "./policy";

/** Matches the existing system-source administrative boundary; country selection is not a grant. */
export function mayReadSystemSource(user: { isActive: boolean; role: string }, country: string) {
  return user.isActive && ["admin", "superadmin", "owner"].includes(user.role) && /^[A-Z]{2}$/.test(country);
}
export async function resolveJobMailbox(userId: string, requested: unknown) {
  const { storage } = await import("../../storage");
  const { availableOmniEmails } = await import("../omni-mailbox-group-routes");
  const user = await storage.getUser(userId);
  if (!user?.isActive) throw new JobError("forbidden", 403);
  const system = typeof requested === "string" ? /^system:([A-Z]{2})$/.exec(requested) : null;
  if (system) {
    if (!mayReadSystemSource(user, system[1])) throw new JobError("forbidden", 403);
    const connection = await storage.getSystemMs365Connection(system[1]);
    if (!connection?.isConnected || !connection.email) throw new JobError("mailbox_not_connected", 403);
    const mailbox = connection.email.trim().toLowerCase();
    return { connection, mailbox, mailboxRef: requested as string, systemCountry: system[1],
      base: `/users/${encodeURIComponent(mailbox)}` };
  }
  const connection = await storage.getUserMs365Connection(userId);
  if (!connection?.isConnected) throw new JobError("mailbox_not_connected", 403);
  const mailbox = String(!requested || requested === "personal" ? connection.email : requested).trim().toLowerCase();
  if (!(await availableOmniEmails(storage, userId)).has(mailbox)) throw new JobError("forbidden", 403);
  return { connection, mailbox, mailboxRef: mailbox, systemCountry: undefined,
    base: mailbox === connection.email.trim().toLowerCase() ? "/me" : `/users/${encodeURIComponent(mailbox)}` };
}
