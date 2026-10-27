import { useMemo } from "react";
import { Ban, CalendarClock, Check, CheckCircle2, ClipboardCheck, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUS_LIST_DIALOG_FRAME_CLASS } from "@/components/status-list-dialog-frame";
import { StatusListCallbackRescheduleFields } from "@/components/status-list-callback-reschedule-fields";
import { getStatusListRecapCopy } from "@/components/status-list-recap-copy";
import { statusListCallbackPrefill } from "@shared/status-list-callback-calendar";
import "@/components/status-list-batch-save-dialog.css";

type BatchAction = "rules" | "reschedule" | "do_not_call";
type StagedItem = { id: string; label: string; itemType?: string; color?: string };

function bratislavaDateKey(date: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function bratislavaTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "09:00";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "Europe/Bratislava", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
}

function wallTimeToUtc(key: string, time: string) {
  const [year, month, day] = key.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let index = 0; index < 3; index += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    guess += target - Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  }
  return new Date(guess);
}

function presetDate(kind: "d1" | "d3" | "d5" | "m1", now: Date, currentValue: string) {
  const time = currentValue ? bratislavaTime(currentValue) : "09:00";
  if (kind !== "m1") {
    const offset = kind === "d1" ? 1 : kind === "d3" ? 3 : 5;
    const wall = statusListCallbackPrefill({
      callbackOffsetDays: offset, callbackTime: time, callbackBusinessDaysOnly: true,
    }, now);
    return wallTimeToUtc(wall.slice(0, 10), wall.slice(11, 16)).toISOString();
  }
  const today = bratislavaDateKey(now);
  const [year, month, day] = today.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day, 12));
  const targetMonth = cursor.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
  cursor.setUTCMonth(targetMonth, Math.min(day, lastDay));
  if (cursor.getUTCDay() === 6) cursor.setUTCDate(cursor.getUTCDate() + 2);
  if (cursor.getUTCDay() === 0) cursor.setUTCDate(cursor.getUTCDate() + 1);
  const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;
  return wallTimeToUtc(key, time).toISOString();
}

export function StatusListBatchSaveDialog({
  open, onOpenChange, locale, title, description, noItems, selectedCount,
  items, action, onActionChange, actionHeading, rulesLabel, rescheduleLabel, doNotCallLabel,
  rescheduleDescription, doNotCallDescription, statusPrefix, dispositionNames, value, onValueChange,
  note, onNoteChange, notePlaceholder, presetLabels, saving, savingLabel, confirmLabel,
  cancelLabel, onConfirm, confirmTestId, cancelTestId, rescheduleStatusTestId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  title: string;
  description: string;
  noItems: string;
  selectedCount: number;
  items: StagedItem[];
  action: BatchAction;
  onActionChange: (action: BatchAction) => void;
  actionHeading: string;
  rulesLabel: string;
  rescheduleLabel: string;
  doNotCallLabel: string;
  rescheduleDescription: string;
  doNotCallDescription: string;
  statusPrefix: string;
  dispositionNames: string[];
  value: string;
  onValueChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  notePlaceholder: string;
  presetLabels: { d1: string; d3: string; d5: string; m1: string };
  saving: boolean;
  savingLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  confirmTestId: string;
  cancelTestId: string;
  rescheduleStatusTestId: string;
}) {
  const recap = useMemo(() => getStatusListRecapCopy(locale), [locale]);
  const editorValue = useMemo(() => value || presetDate("d1", new Date(), ""), [value]);
  const parsedCallbackDate = value ? new Date(value) : null;
  const callbackSummary = parsedCallbackDate && Number.isFinite(parsedCallbackDate.getTime()) ? new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Bratislava", weekday: "short", day: "numeric", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(parsedCallbackDate) : "";
  const setPreset = (kind: "d1" | "d3" | "d5" | "m1") => onValueChange(presetDate(kind, new Date(), value));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${STATUS_LIST_DIALOG_FRAME_CLASS} sl-batch-dialog sl-agent-dialog-frame z-[10070]`} overlayClassName="z-[10060]">
        <DialogHeader className="sl-batch-header">
          <div className="sl-batch-heading">
            <div className="sl-batch-mark" aria-hidden="true"><ClipboardCheck className="h-5 w-5" /></div>
            <div className="min-w-0">
              <DialogTitle className="sl-batch-title">{title}</DialogTitle>
              <DialogDescription className="sl-batch-description">{description || noItems}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="sl-batch-content" data-testid="status-list-batch-save-dialog" aria-busy={saving}>
          <section className="sl-batch-staged" aria-label={description}>
            <div className="sl-batch-section-label">
              <span>{actionHeading}</span>
              <span className="sl-batch-count">{selectedCount}</span>
            </div>
            {items.length ? (
              <div className="sl-batch-items">
                {items.map(item => (
                  <div key={item.id} className="sl-batch-item">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.itemType === "option" && <span className="sl-batch-opt" style={{ backgroundColor: item.color || "#627d91" }}>OPT</span>}
                  </div>
                ))}
              </div>
            ) : <p className="sl-batch-empty">{noItems}</p>}
          </section>

          <section className="sl-batch-actions" aria-label={actionHeading}>
            {([
              { id: "rules" as const, label: rulesLabel, Icon: Check },
              { id: "reschedule" as const, label: rescheduleLabel, Icon: CalendarClock },
              { id: "do_not_call" as const, label: doNotCallLabel, Icon: Ban },
            ]).map(option => (
              <button key={option.id} type="button" aria-pressed={action === option.id}
                onClick={() => onActionChange(option.id)}
                className={`sl-batch-action ${action === option.id ? "is-selected" : ""}`}>
                <option.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))}
          </section>

          {action === "reschedule" && (
            <section className="sl-batch-edit">
              <p className="sl-batch-help">{rescheduleDescription}</p>
              {dispositionNames.length > 0 && <p className="sl-batch-status" data-testid={rescheduleStatusTestId}>
                <strong>{statusPrefix}</strong> {dispositionNames.join(", ")}
              </p>}
              <div className="sl-batch-presets" aria-label={recap.rescheduleNewDate}>
                {([
                  ["d1", presetLabels.d1], ["d3", presetLabels.d3], ["d5", presetLabels.d5], ["m1", presetLabels.m1],
                ] as const).map(([kind, label]) => (
                  <button key={kind} type="button" onClick={() => setPreset(kind)}>{label}</button>
                ))}
              </div>
              <StatusListCallbackRescheduleFields value={editorValue} onChange={onValueChange} locale={locale}
                copy={{ newDate: recap.rescheduleNewDate, time: recap.rescheduleTime, time24Hour: recap.reschedule24Hour,
                  previousWeekday: recap.reschedulePreviousWeekday, nextWeekday: recap.rescheduleNextWeekday }}
                testId="status-list-batch-callback" />
              {callbackSummary && <div className="sl-batch-callback-summary" aria-live="polite">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div><span>{recap.callbackWhen}</span><strong>{callbackSummary}</strong>
                  {note.trim() && <small><b>{recap.callbackNote}:</b> {note.trim()}</small>}
                </div>
              </div>}
              <label className="sl-batch-note">
                <span>{recap.callbackNote}</span>
                <textarea placeholder={notePlaceholder} value={note} rows={2} onChange={event => onNoteChange(event.target.value)} />
              </label>
            </section>
          )}
          {action === "do_not_call" && (
            <section className="sl-batch-edit">
              <p className="sl-batch-help">{doNotCallDescription}</p>
              <label className="sl-batch-note">
                <span>{recap.callbackNote}</span>
                <textarea placeholder={notePlaceholder} value={note} rows={2} onChange={event => onNoteChange(event.target.value)} />
              </label>
            </section>
          )}
        </div>
        <DialogFooter className="sl-batch-footer">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid={cancelTestId}>{cancelLabel}</Button>
          <Button className="sl-batch-confirm" disabled={saving || (action === "reschedule" && !value)} onClick={onConfirm} data-testid={confirmTestId}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{savingLabel}</> : <>{confirmLabel}<Check className="ml-2 h-4 w-4" /></>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
