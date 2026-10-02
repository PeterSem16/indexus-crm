import { emitEventOnceForIdentity } from "./event-bus";
import { taskTextContentIdentity } from "./task-text-identity";

type TaskText = {
  id: string;
  title?: string | null;
  description?: string | null;
  customerId?: string | null;
  country?: string | null;
  sourceRunId?: string | null;
  tags?: string[] | null;
};

export function taskSentimentText(task: TaskText): string {
  return [task.title, task.description].filter((value) => typeof value === "string" && value.trim())
    .join("\n").trim();
}

export function taskTextIdentity(task: TaskText): string {
  return taskTextContentIdentity(task.title, task.description);
}

export function isRoutineGeneratedTask(task: TaskText): boolean {
  if (task.sourceRunId || (task.tags || []).some((tag) => /^(automation|system|generated):/i.test(tag))) return true;
  const title = (task.title || "").trim().toLowerCase();
  return !task.description?.trim() && /^(automation task|follow[- ]?up|review|task|reminder|check[- ]?in)$/i.test(title);
}

function redactTaskText(text: string, sensitiveValues: string[] = []): string {
  let safeText = text;
  for (const value of sensitiveValues.filter((item) => item.trim().length > 2)) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(escaped, "gi");
    safeText = safeText.replace(expression, "[contact redacted]");
  }
  return safeText
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[contact redacted]")
    .replace(/\+?\d[\d\s().-]{4,}\d/g, "[contact redacted]")
    .replace(/\bhttps?:\/\/\S+/gi, "[link redacted]")
    // Clinical details are not needed to assess whether a customer expressed dissatisfaction.
    .replace(/\b(?:health|medical|diagnosis|disease|pregnan\w*|birth|blood|treatment|patient|clinical)\b[^.!?\n]{0,100}/gi, "[health detail redacted]");
}

export async function analyzeAndEmitTaskNegativeSentiment(
  task: TaskText,
  context: { actorUserId?: string | null; countryCode?: string | null; sensitiveValues?: string[] },
): Promise<void> {
  const text = taskSentimentText(task);
  if (!text || isRoutineGeneratedTask(task)) return;
  if (!process.env.OPENAI_API_KEY) {
    console.warn(`[TaskSentiment] AI analysis unavailable for task ${task.id}: OPENAI_API_KEY is not configured`);
    return;
  }

  try {
    const openai = await import("openai");
    const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Determine whether this task text explicitly records a customer's negative sentiment (complaint, frustration, dissatisfaction, or anger). Routine reminders, follow-ups, administrative instructions, and task wording that is not explicitly customer dissatisfaction are not negative. Ignore clinical/health details. Return only JSON: {\"negative\": boolean}.",
        },
        { role: "user", content: redactTaskText(text, context.sensitiveValues).slice(0, 2500) },
      ],
      max_tokens: 30,
      temperature: 0,
    });
    const result = JSON.parse((response.choices[0]?.message?.content || "{}").replace(/```json\n?|\n?```/g, "").trim());
    if (result.negative !== true) return;

    const identity = taskTextIdentity(task);
    const eventId = await emitEventOnceForIdentity({
      source: "task-analysis",
      module: "communication",
      entityType: "communication",
      entityId: task.id,
      eventType: "sentiment.negative",
      newValues: {
        type: "task",
        sentiment: "negative",
        customerId: task.customerId || null,
        textIdentity: identity,
      },
      actorUserId: context.actorUserId,
      countryCode: context.countryCode || null,
    }, "textIdentity", identity, `task-sentiment:${task.id}:${identity}`, {
      taskId: task.id,
      textIdentity: identity,
    });
    if (!eventId) console.error(`[TaskSentiment] Negative sentiment event was not recorded for task ${task.id}`);
  } catch (error) {
    // Diagnostics deliberately contain no task text or AI response.
    console.error(`[TaskSentiment] Analysis/event emission failed for task ${task.id} (${error instanceof Error ? error.name : "unknown error"})`);
  }
}