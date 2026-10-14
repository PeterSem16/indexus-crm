import { activityTemplateLabel, ACTIVITY_TEMPLATE_LANGUAGES, type ActivityTemplateLanguage } from "./automation-activity-template-copy";
import type { CommunicationAnalysisConfig } from "./automation-analysis";

/** Result-specific WHENs listen to authorized source events, analyze, then gate BEFORE IF/ELSE. */
export const ANALYSIS_RESULT_TRIGGERS = [
  { eventType: "communication.sentiment.positive", field: "sentiment", value: "positive", label: "positive" },
  { eventType: "communication.sentiment.neutral", field: "sentiment", value: "neutral", label: "sentiment-neutral" },
  { eventType: "communication.sentiment.negative", field: "sentiment", value: "negative", label: "negative" },
  { eventType: "communication.sentiment.angry", field: "sentiment", value: "angry", label: "sentiment-angry" },
  { eventType: "communication.tone.calm", field: "tone", value: "calm", label: "tone-calm" },
  { eventType: "communication.tone.concerned", field: "tone", value: "concerned", label: "tone-concerned" },
  { eventType: "communication.tone.angry", field: "tone", value: "angry", label: "tone-angry" },
  { eventType: "communication.tone.rude", field: "tone", value: "rude", label: "tone-rude" },
] as const;
export const ANALYSIS_SOURCE_EVENTS = ["email.received", "sms.received", "chat.received", "task.message_received", "task.body_received", "voice.transcribed"] as const;
export const analysisResultTrigger = (eventType: string) => ANALYSIS_RESULT_TRIGGERS.find(item => item.eventType === eventType);
export const isAnalysisServiceEvent = (eventType: string) => eventType === "communication.received" || Boolean(analysisResultTrigger(eventType));
export function analysisResultMatches(eventType: string, analysis: { sentiment?: unknown; tone?: unknown } | null | undefined): boolean | null {
  const trigger = analysisResultTrigger(eventType);
  if (!trigger) return true;
  const value = analysis?.[trigger.field];
  const allowed = trigger.field === "sentiment" ? ["positive", "neutral", "negative", "angry"] : ["calm", "concerned", "angry", "rude"];
  return typeof value === "string" && allowed.includes(value) ? value === trigger.value : null;
}
export function analysisResultLabel(locale: string, eventType: string): string | null {
  const item = analysisResultTrigger(eventType);
  const language = ACTIVITY_TEMPLATE_LANGUAGES.includes(locale as ActivityTemplateLanguage) ? locale as ActivityTemplateLanguage : "en";
  return item ? activityTemplateLabel(language, item.label) : null;
}
const descriptions = [
  "Analyze the selected channels and run only for {result}. No IF is needed. Other or unknown results do not run this rule.",
  "Analyzovať vybrané kanály a spustiť iba pri výsledku: {result}. Podmienka IF nie je potrebná. Iný alebo neznámy výsledok toto pravidlo nespustí.",
  "Analyzovat vybrané kanály a spustit pouze při výsledku: {result}. Podmínka IF není nutná. Jiný nebo neznámý výsledek toto pravidlo nespustí.",
  "A kiválasztott csatornák elemzése után csak erre az eredményre fusson: {result}. IF feltétel nem szükséges. Más vagy ismeretlen eredmény nem indítja el a szabályt.",
  "Analizează canalele selectate și execută numai pentru rezultatul: {result}. Nu este necesară o condiție IF. Alte rezultate sau cele necunoscute nu execută regula.",
  "Analizza i canali selezionati ed esegui solo per il risultato: {result}. Non serve una condizione IF. Risultati diversi o sconosciuti non attivano la regola.",
  "Ausgewählte Kanäle analysieren und nur bei diesem Ergebnis ausführen: {result}. Eine IF-Bedingung ist nicht nötig. Andere oder unbekannte Ergebnisse lösen die Regel nicht aus.",
];
export function legacyNegativeTriggerLabel(locale: string) {
  const labels = ["Negative sentiment (incoming email/SMS)", "Negatívny sentiment (prichádzajúci e-mail/SMS)",
    "Negativní sentiment (příchozí e-mail/SMS)", "Negatív érzelmi értékelés (bejövő e-mail/SMS)",
    "Sentiment negativ (e-mail/SMS primit)", "Sentiment negativo (email/SMS in entrata)",
    "Negative Stimmung (eingehende E-Mail/SMS)"];
  const index = ACTIVITY_TEMPLATE_LANGUAGES.indexOf(locale as ActivityTemplateLanguage);
  return labels[index < 0 ? 0 : index];
}
export function analysisResultDescription(locale: string, eventType: string) {
  const language = ACTIVITY_TEMPLATE_LANGUAGES.indexOf(locale as ActivityTemplateLanguage);
  return descriptions[language < 0 ? 0 : language].replace("{result}", analysisResultLabel(locale, eventType) || "");
}
export function communicationEventTrigger(eventType: string, analysis?: CommunicationAnalysisConfig) {
  return { type: "event", entityType: "communication", eventType,
    ...(isAnalysisServiceEvent(eventType) ? { analysis: {
      ...(analysis || { channels: ["email", "sms"], analyzeAttachments: false, mailboxMode: "all" }),
      analyzeContent: analysisResultTrigger(eventType) ? true : analysis?.analyzeContent ?? true,
    } as CommunicationAnalysisConfig } : {}),
  };
}
