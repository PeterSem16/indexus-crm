import { createHash } from "node:crypto";

export function taskTextContentIdentity(title?: string | null, description?: string | null): string {
  const text = [title, description]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n")
    .trim()
    .replace(/\s+/g, " ");
  return createHash("sha256").update(text).digest("hex");
}