import type { Express, Request, RequestHandler, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { normalizePhonePreferenceKey } from "@shared/phone-preference-key";

export type PhoneLookupMatch = {
  entityType: "customer" | "hospital" | "clinic" | "collaborator";
  id: string;
  name: string;
  phone: string;
  subtype?: string;
};

type PhoneLookup = (phone: string) => Promise<PhoneLookupMatch[]>;

/**
 * The selected card is private to the authenticated agent. Consumers must
 * still validate it against a current phone lookup before using it.
 */
export function registerPhoneCardPreferenceRoutes(
  app: Express,
  requireAuth: RequestHandler,
  getPhoneLookupMatches: PhoneLookup,
): void {
  app.get("/api/phone/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const phone = String(req.query.phone || "");
      const normalizedPhone = normalizePhonePreferenceKey(phone);
      if (!normalizedPhone) return res.status(400).json({ error: "Phone parameter required" });

      const result: any = await db.execute(sql`
        SELECT entity_type, entity_id, last_selected_at
        FROM agent_phone_entity_preferences
        WHERE user_id = ${req.session.user!.id}
          AND normalized_phone = ${normalizedPhone}
        LIMIT 1
      `);
      const preference = result.rows?.[0];
      if (!preference) return res.json(null);

      res.json({
        entityType: preference.entity_type,
        entityId: preference.entity_id,
        lastSelectedAt: preference.last_selected_at,
      });
    } catch (error) {
      console.error("Error fetching agent phone-card preference:", error);
      res.status(500).json({ error: "Failed to fetch phone preference" });
    }
  });

  app.put("/api/phone/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const phone = typeof req.body?.phone === "string" ? req.body.phone : "";
      const entityType = typeof req.body?.entityType === "string" ? req.body.entityType : "";
      const entityId = typeof req.body?.entityId === "string" ? req.body.entityId : "";
      const normalizedPhone = normalizePhonePreferenceKey(phone);
      const validTypes = new Set(["customer", "hospital", "clinic", "collaborator"]);
      if (!normalizedPhone || !validTypes.has(entityType) || !entityId.trim()) {
        return res.status(400).json({ error: "Invalid phone-card preference" });
      }

      // Do not allow the client to associate arbitrary cards: the selected
      // entity must still own/match the provided phone number.
      const matches = await getPhoneLookupMatches(phone);
      const selectedMatchExists = matches.some(
        (match) => match.entityType === entityType && match.id === entityId,
      );
      if (!selectedMatchExists) {
        return res.status(400).json({ error: "Selected entity does not match this phone number" });
      }

      await db.execute(sql`
        INSERT INTO agent_phone_entity_preferences
          (id, user_id, normalized_phone, entity_type, entity_id, last_selected_at)
        VALUES (
          gen_random_uuid(),
          ${req.session.user!.id},
          ${normalizedPhone},
          ${entityType},
          ${entityId},
          now()
        )
        ON CONFLICT (user_id, normalized_phone)
        DO UPDATE SET
          entity_type = EXCLUDED.entity_type,
          entity_id = EXCLUDED.entity_id,
          last_selected_at = now()
      `);
      res.status(204).end();
    } catch (error) {
      console.error("Error saving agent phone-card preference:", error);
      res.status(500).json({ error: "Failed to save phone preference" });
    }
  });
}