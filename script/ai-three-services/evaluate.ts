import type { ThreeService } from "../../server/lib/ai/three-services-profile";

/** Additional acceptance checks; never repairs model output or replaces CRM parsers. */
export function acceptanceContract(service: ThreeService, result: any): string[] {
  if (result?.status !== "generated") return [result?.errorCode || "application_not_generated"];
  if (service === "task.checklist") {
    const steps = result.steps;
    return Array.isArray(steps) && steps.length >= 3 && steps.length <= 5 &&
      steps.every(s => typeof s === "string" && s.trim().length >= 6 && s.trim().length <= 180) &&
      new Set(steps.map(s => s.trim().toLocaleLowerCase())).size === steps.length ? [] : ["invalid_steps"];
  }
  if (service === "task.resolution") {
    if (typeof result.draft !== "string" || !result.draft.trim() || result.draft.length > 500)
      return ["invalid_draft"];
    // Sentence quality (abbreviations included) still requires language review.
    return result.draft.trim().split(/\s+/u).length > 60 ? ["more_than_60_words"] : [];
  }
  const html = result.summary;
  if (typeof html !== "string" || !html.trim() || !/<p>/i.test(html)) return ["invalid_html"];
  const stack: string[] = [];
  let end = 0;
  for (const match of html.matchAll(/<[^>]*>/g)) {
    if (html.slice(end, match.index).includes("<")) return ["invalid_html"];
    const tag = /^<(\/?)(p|ul|li)>$/i.exec(match[0]);
    if (!tag) return ["unsafe_or_unsupported_html"];
    const name = tag[2].toLowerCase();
    if (tag[1]) {
      if (stack.pop() !== name) return ["unbalanced_html"];
    } else {
      const parent = stack.at(-1);
      if ((name === "li" && parent !== "ul") || (parent === "p") ||
        (parent === "ul" && name !== "li")) return ["invalid_html_nesting"];
      stack.push(name);
    }
    end = match.index! + match[0].length;
  }
  return stack.length || html.slice(end).includes("<") ? ["unbalanced_html"] : [];
}
export function latencyStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return { count: 0, meanMs: null, medianMs: null, p95Ms: null, maxMs: null };
  const middle = Math.floor(sorted.length / 2);
  return {
    count: sorted.length, meanMs: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    medianMs: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], maxMs: sorted.at(-1),
  };
}
