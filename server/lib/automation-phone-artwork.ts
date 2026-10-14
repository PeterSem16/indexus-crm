import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PHONE_ARTWORK_NAMES = ["phone", "phone-info", "phone-positive", "phone-negative", "phone-urgent", "phone-deadline"] as const;
const illustrations = new Map(PHONE_ARTWORK_NAMES.map(name => [name,
  readFileSync(resolve(process.cwd(), "server/assets/automation-email",
    `automation-${name === "phone" ? "phone-info" : name}.gif`))]));
/** Static, application-owned GIFs only. Never resolve a user-supplied file path. */
export function automationPhoneArtworkFor(name: string): Buffer | undefined {
  return illustrations.get(name as typeof PHONE_ARTWORK_NAMES[number]);
}
export const automationPhoneArtwork = illustrations.get("phone")!;
