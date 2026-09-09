export interface MissionFaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

const MAX_FAQ_ITEMS = 100;
const MAX_FAQ_CATEGORIES = 100;
const MAX_QUESTION_LENGTH = 300;
const MAX_ANSWER_LENGTH = 10_000;
const MAX_CATEGORY_LENGTH = 100;

function sanitizeMissionFaqCategory(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/<[^>]*>/g, "").trim().slice(0, MAX_CATEGORY_LENGTH)
    : "";
}

export function sanitizeMissionFaqAnswer(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .slice(0, MAX_ANSWER_LENGTH)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<b(?:\s[^>]*)?>/gi, "<strong>")
    .replace(/<\/b>/gi, "</strong>")
    .replace(/<i(?:\s[^>]*)?>/gi, "<em>")
    .replace(/<\/i>/gi, "</em>")
    .replace(/<strong(?:\s[^>]*)?>/gi, "<strong>")
    .replace(/<\/strong(?:\s[^>]*)?>/gi, "</strong>")
    .replace(/<em(?:\s[^>]*)?>/gi, "<em>")
    .replace(/<\/em(?:\s[^>]*)?>/gi, "</em>")
    .replace(/<u(?:\s[^>]*)?>/gi, "<u>")
    .replace(/<\/u(?:\s[^>]*)?>/gi, "</u>")
    .replace(/<br(?:\s[^>]*)?>/gi, "<br>")
    .replace(/<\/?(?:div|p)(?:\s[^>]*)?>/gi, (tag) => tag.startsWith("</") ? "<br>" : "")
    .replace(/<(?!\/?(?:strong|em|u)>|br>)[^>]*>/gi, "")
    .replace(/(?:<br>){3,}/gi, "<br><br>")
    .replace(/^(?:<br>)+|(?:<br>)+$/gi, "")
    .trim();
}

export function normalizeMissionFaqItems(value: unknown): MissionFaqItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: MissionFaqItem[] = [];
  for (let index = 0; index < value.length && items.length < MAX_FAQ_ITEMS; index++) {
    const candidate = value[index];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const raw = candidate as Record<string, unknown>;
    const question = typeof raw.question === "string"
      ? raw.question.replace(/<[^>]*>/g, "").trim().slice(0, MAX_QUESTION_LENGTH)
      : "";
    const answer = sanitizeMissionFaqAnswer(raw.answer);
    const category = sanitizeMissionFaqCategory(raw.category);
    const answerText = answer
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .trim();
    if (!question || !answerText) continue;
    let id = typeof raw.id === "string"
      ? raw.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)
      : "";
    if (!id || seen.has(id)) id = `faq-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    items.push({ id, question, answer, ...(category ? { category } : {}) });
  }
  return items;
}

export function normalizeMissionFaqCategoryOrder(
  value: unknown,
  items: MissionFaqItem[] = [],
  fallbackCategory = "",
): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  const add = (candidate: unknown) => {
    const category = sanitizeMissionFaqCategory(candidate);
    if (!category || seen.has(category) || categories.length >= MAX_FAQ_CATEGORIES) return;
    seen.add(category);
    categories.push(category);
  };

  if (Array.isArray(value)) value.forEach(add);
  let hasUncategorizedItem = false;
  items.forEach((item) => {
    if (item.category) add(item.category);
    else hasUncategorizedItem = true;
  });
  if (hasUncategorizedItem || categories.length === 0) add(fallbackCategory);
  return categories;
}