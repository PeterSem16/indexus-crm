import { JobError } from "./policy";
export interface EmailSummaryInput { emailSubject: string; emailBody: string; emailFrom: string; language: string }

/** Byte-compatible with the original ms365-ai-summary prompt and budget. */
export function emailSummaryRequest(input: EmailSummaryInput, bodyIsPlain = false) {
  const { emailSubject, emailBody, emailFrom, language } = input;
  const lang = language || "sk";
  const langNames: Record<string, string> = {
    sk: "slovenčina", cs: "čeština", en: "English", de: "Deutsch",
    hu: "magyar", ro: "română", it: "italiano", pl: "polski", fr: "français", es: "español",
  };
  const langInstruction = lang === "auto"
    ? "Zhrnutie napíšte v rovnakom jazyku, v akom je napísaná emailová konverzácia."
    : `Vytvorte stručné zhrnutie celej emailovej konverzácie v jazyku ${langNames[lang] || lang}.`;
  const plainBody = bodyIsPlain ? emailBody :
    (emailBody || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 5000);
  return {
    model: "gpt-4o",
    messages: [
      { role: "system" as const, content: `Ste profesionálny asistent. ${langInstruction} Zhrnutie by malo obsahovať: hlavné body diskusie, kto čo požadoval/navrhol, aké boli závery alebo otvorené otázky. Formátujte ako HTML s <p> tagmi a prípadne <ul>/<li> pre kľúčové body. Buďte struční ale informatívni.` },
      { role: "user" as const, content: `Od: ${emailFrom || "neznámy"}\nPredmet: ${emailSubject || "(bez predmetu)"}\n\nObsah emailovej konverzácie:\n${plainBody}` },
    ],
    temperature: 0.5, max_tokens: 1500,
  };
}
export function emailSummaryResult(content: string): { summary: string } {
  const summary = content.replace(/^```html\s*/i, "").replace(/```\s*$/, "").trim();
  if (!summary || summary.length > 24000 || /<(?!\/?(?:p|ul|li)>)/i.test(summary))
    throw new JobError("invalid_output", 422);
  const stack: string[] = [];
  for (const tag of summary.match(/<[^>]*>/g) ?? []) {
    const name = tag.replace(/[<>/]/g, "");
    if (tag[1] === "/") { if (stack.pop() !== name) throw new JobError("invalid_output", 422); }
    else stack.push(name);
  }
  if (stack.length) throw new JobError("invalid_output", 422);
  return { summary };
}
