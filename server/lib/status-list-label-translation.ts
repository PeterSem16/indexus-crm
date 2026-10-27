import { statusListLabelTranslationsSchema } from "../../shared/status-list-label-translations";
import { z } from "zod";

const inputSchema = z.object({ text: z.string().trim().min(1).max(240) }).strict();
const completeTranslations = statusListLabelTranslationsSchema.required();

/** Translation is a draft-only operation: it never saves a Status List or runs actions. */
export function createStatusListLabelTranslationHandler(deps: {
  authorize: (req: any) => Promise<unknown>;
  configured: () => boolean;
  translate: (text: string) => Promise<unknown>;
}) {
  return async (req: any, res: any) => {
    try {
      await deps.authorize(req);
      const input = inputSchema.safeParse(req.body);
      if (!input.success) return res.status(400).json({ error: "invalid_button_name" });
      if (!deps.configured()) return res.status(503).json({ error: "translation_unavailable" });
      const result = completeTranslations.safeParse(await deps.translate(input.data.text));
      if (!result.success) return res.status(502).json({ error: "incomplete_translation" });
      return res.json({ translations: result.data });
    } catch (error: any) {
      // Never return provider errors, prompts, credentials, or button content.
      const status = [401, 403, 404].includes(error?.status) ? error.status : 502;
      return res.status(status).json({ error: status === 502 ? "translation_failed" : "forbidden" });
    }
  };
}
