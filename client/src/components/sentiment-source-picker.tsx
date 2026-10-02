import * as React from "react";
import { Check, ListTodo, Mail, MessageSquareText, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import type { SentimentChannel } from "@/lib/sentiment-source-conditions";

export type SentimentSourceChannel = SentimentChannel;

export interface SentimentSourcePickerCopy {
  heading: string;
  info: string;
  available: string;
  comingLater: string;
  selectionHint: string;
  email: { title: string; detail: string };
  sms: { title: string; detail: string };
  inboundCall: { title: string; detail: string };
  outboundCall: { title: string; detail: string };
  task: { title: string; detail: string };
}

export interface SentimentSourcePickerProps {
  selected: readonly SentimentSourceChannel[];
  onToggle: (channel: SentimentSourceChannel) => void;
  copy: SentimentSourcePickerCopy;
}

const selectableSources = [
  { channel: "email", icon: Mail },
  { channel: "sms", icon: MessageSquareText },
  { channel: "inbound_call", key: "inboundCall", icon: PhoneIncoming },
  { channel: "outbound_call", key: "outboundCall", icon: PhoneOutgoing },
  { channel: "task", icon: ListTodo },
] as const;

export function SentimentSourcePicker({
  selected,
  onToggle,
  copy,
}: SentimentSourcePickerProps) {
  return (
    <section
      className="space-y-3 rounded-lg border border-border bg-card p-3 sm:p-4"
      data-testid="sentiment-source-picker"
    >
      <header className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h3 id="sentiment-source-heading" className="text-sm font-semibold leading-5 text-foreground">
            {copy.heading}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{copy.info}</p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium leading-none text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          {copy.available}
        </span>
      </header>

      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
        role="group"
        aria-labelledby="sentiment-source-heading"
      >
        {selectableSources.map((entry) => {
          const { channel, icon: Icon } = entry;
          const source = channel === "inbound_call" ? copy.inboundCall :
            channel === "outbound_call" ? copy.outboundCall : copy[channel];
          const isSelected = selected.includes(channel);

          return (
            <button
              key={channel}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${source.title}: ${source.detail}`}
              disabled={isSelected && selected.length === 1}
              title={isSelected && selected.length === 1 ? copy.selectionHint : undefined}
              onClick={() => onToggle(channel)}
              data-testid={`sentiment-source-${"key" in entry ? entry.key : channel}`}
              className={[
                "group flex min-h-[68px] w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left",
                "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed",
                isSelected
                  ? "border-primary/60 bg-primary/[0.07] text-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/50",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:text-foreground",
                ].join(" ")}
                aria-hidden="true"
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-5">{source.title}</span>
                <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                  {source.detail}
                </span>
              </span>
              <span
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-transparent",
                ].join(" ")}
                aria-hidden="true"
              >
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs leading-4 text-muted-foreground">{copy.selectionHint}</p>

    </section>
  );
}