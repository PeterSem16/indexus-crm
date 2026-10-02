import type { RequestHandler } from "express";

type PersistedActor = {
  id: string;
  role: string;
  roleId?: string | null;
  isActive: boolean;
};

type AdminAuthorizationStorage = {
  getUser(id: string): Promise<PersistedActor | undefined>;
  getRole(id: string): Promise<{ legacyRole: string | null } | undefined>;
};

// Resolve authorization from persisted records, never from role display names
// or the session's potentially stale role/roleId.
export async function isPersistedAdministrator(storage: AdminAuthorizationStorage, actorId: string): Promise<boolean> {
  const actor = await storage.getUser(actorId);
  if (!actor || !actor.isActive) return false;
  if (actor.role === "admin") return true;
  const role = actor.roleId ? await storage.getRole(actor.roleId) : undefined;
  return role?.legacyRole === "admin";
}

export function createRequirePersistedAdmin(storage: AdminAuthorizationStorage): RequestHandler {
  return async (req, res, next) => {
    const actorId = req.session?.user?.id;
    if (!actorId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      if (await isPersistedAdministrator(storage, actorId)) {
        next();
        return;
      }
      res.status(403).json({ error: "Admin access required" });
    } catch (error) {
      console.error("Error checking persisted administrator:", error);
      res.status(500).json({ error: "Failed to verify administrator access" });
    }
  };
}