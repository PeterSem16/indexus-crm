/** Old rules without an explicit channel filter continue to cover email and SMS only. */
export const LEGACY_SENTIMENT_CHANNELS = ["email", "sms"] as const;
export const SENTIMENT_CHANNELS = ["email", "sms", "inbound_call", "outbound_call", "task"] as const;
export type SentimentChannel = typeof SENTIMENT_CHANNELS[number];

export type AutomationCondition =
  | { field: string; op: string; value?: unknown }
  | { all: AutomationCondition[] }
  | { any: AutomationCondition[] }
  | { not: AutomationCondition };

const CHANNEL_FIELD = "newValues.type";

const isLeaf = (node: AutomationCondition): node is Extract<AutomationCondition, { field: string }> =>
  "field" in node;

function mentionsChannel(node: AutomationCondition): boolean {
  if (isLeaf(node)) return node.field === CHANNEL_FIELD;
  if ("not" in node) return mentionsChannel(node.not);
  if ("all" in node) return node.all.some(mentionsChannel);
  return node.any.some(mentionsChannel);
}

function parseChannel(node: AutomationCondition): SentimentChannel[] | null {
  if (!isLeaf(node) || node.field !== CHANNEL_FIELD) return null;
  const values = node.op === "eq" ? [node.value] : node.op === "in" ? node.value : null;
  if (!Array.isArray(values) || !values.length ||
      values.some(value => !SENTIMENT_CHANNELS.includes(value as SentimentChannel))) return null;
  return SENTIMENT_CHANNELS.filter(channel => values.includes(channel));
}

/** Treat unsupported/nested channel expressions as advanced, never silently rewrite them. */
export function readSentimentSources(conditions: AutomationCondition | null): {
  channels: SentimentChannel[];
  extra: AutomationCondition | null;
  editable: boolean;
} {
  if (!conditions) return { channels: [...LEGACY_SENTIMENT_CHANNELS], extra: null, editable: true };
  if (isLeaf(conditions)) {
    if (conditions.field !== CHANNEL_FIELD) return { channels: [...LEGACY_SENTIMENT_CHANNELS], extra: conditions, editable: true };
    const channels = parseChannel(conditions);
    return channels
      ? { channels, extra: null, editable: true }
      : { channels: [], extra: conditions, editable: false };
  }
  if ("all" in conditions) {
    const channelNodes = conditions.all.filter(mentionsChannel);
    if (!channelNodes.length) return { channels: [...LEGACY_SENTIMENT_CHANNELS], extra: conditions, editable: true };
    const channels = channelNodes.length === 1 ? parseChannel(channelNodes[0]) : null;
    if (channels) {
      const others = conditions.all.filter(node => node !== channelNodes[0]);
      return { channels, extra: others.length ? (others.length === 1 ? others[0] : { all: others }) : null, editable: true };
    }
  }
  return mentionsChannel(conditions)
    ? { channels: [], extra: conditions, editable: false }
    : { channels: [...LEGACY_SENTIMENT_CHANNELS], extra: conditions, editable: true };
}

export function withSentimentSources(
  channels: readonly SentimentChannel[],
  extra: AutomationCondition | null,
): AutomationCondition {
  if (!channels.length) throw new Error("Choose at least one sentiment source");
  const channelNode: AutomationCondition = {
    field: CHANNEL_FIELD,
    op: "in",
    value: SENTIMENT_CHANNELS.filter(channel => channels.includes(channel)),
  };
  return extra ? { all: [channelNode, extra] } : { all: [channelNode] };
}