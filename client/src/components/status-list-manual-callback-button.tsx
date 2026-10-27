import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Loader2, Phone, Tag } from "lucide-react";
import { statusListCallbackPrefill } from "@shared/status-list-callback-calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUS_LIST_DIALOG_FRAME_CLASS } from "@/components/status-list-dialog-frame";
import { getStatusListRecapCopy } from "@/components/status-list-recap-copy";
import { StatusListCallbackRescheduleFields } from "@/components/status-list-callback-reschedule-fields";
import { getStatusListQuestionColorValue, StatusListQuickOptionIcon } from "@/components/status-list-quick-option-icons";
import "./status-list-action-recap.css";

type Props = {
  automation: any;
  isRunning: boolean;
  onRun: (automation: any, opts?: { callbackDate?: string; callbackNote?: string }) => void;
  locale: string;
  kind: "callback" | "status";
  label: string;
  title?: string;
  icon?: string | null;
  color?: string | null;
  copy: {
    noteLabel: string;
    notePlaceholder: string;
    confirm: string;
    forEveryone: string;
  };
};

function formatDateTime(value: string, locale: string) {
  const wallTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const date = wallTime
    ? new Date(Date.UTC(Number(wallTime[1]), Number(wallTime[2]) - 1, Number(wallTime[3]), Number(wallTime[4]), Number(wallTime[5])))
    : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: wallTime ? "UTC" : "Europe/Bratislava",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function dateTimeInstant(value: string) {
  const wallTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!wallTime) return new Date(value);
  const target = Date.UTC(Number(wallTime[1]), Number(wallTime[2]) - 1, Number(wallTime[3]), Number(wallTime[4]), Number(wallTime[5]));
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    guess += target - Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  }
  return new Date(guess);
}

export function StatusListManualCallbackButton({
  automation, isRunning, onRun, locale, kind, label, title, icon, color, copy,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dateTime, setDateTime] = useState("");
  const [originalDateTime, setOriginalDateTime] = useState("");
  const [note, setNote] = useState("");
  const submitted=useRef(false);
  const recap = getStatusListRecapCopy(locale);
  const iconColor = getStatusListQuestionColorValue(color);
  const testPrefix = kind === "callback" ? "sl-callback" : "sl-status";
  const fallbackIconColor = kind === "callback" ? "text-cyan-600" : "text-purple-600";
  const Icon = kind === "callback" ? Phone : Tag;
  const prefill = useMemo(
    () => statusListCallbackPrefill(automation),
    [automation.callbackOffsetDays, automation.callbackTime, automation.callbackBusinessDaysOnly],
  );
  const isValidDate = useMemo(() => {
    const parsed = dateTimeInstant(dateTime);
    return !!dateTime && Number.isFinite(parsed.getTime()) && parsed.getTime() > Date.now();
  }, [dateTime]);

  useEffect(() => {
    if (!open) return;
    submitted.current=false;
    setDateTime(prefill);
    setOriginalDateTime(prefill);
    setNote("");
  }, [open, prefill]);

  const submit = () => {
    if (submitted.current || isRunning || !isValidDate || dateTimeInstant(dateTime).getTime()<=Date.now()) return;
    submitted.current=true;
    onRun(automation, { callbackDate: dateTime, callbackNote: note || undefined });
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px]"
        style={iconColor ? { borderColor: iconColor, color: iconColor } : undefined}
        disabled={isRunning}
        onClick={() => setOpen(true)}
        data-testid={`btn-sl-${kind}-${automation.id}`}
      >
        {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : icon
          ? <StatusListQuickOptionIcon name={icon} color={color} className={`h-3 w-3 ${fallbackIconColor}`} />
          : <Icon className={`h-3 w-3 ${fallbackIconColor}`} />}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={`${STATUS_LIST_DIALOG_FRAME_CLASS} sl-recap-dialog z-[10070]`}
          overlayClassName="z-[10060]"
          aria-describedby={`sl-manual-callback-description-${automation.id}`}
        >
          <DialogHeader className="sl-recap-header">
            <div className="sl-recap-heading">
              <div className="sl-recap-mark" aria-hidden="true"><CalendarClock className="h-5 w-5" /></div>
              <div className="min-w-0 pt-0.5">
                <DialogTitle className="sl-recap-title">{title || label}</DialogTitle>
                <DialogDescription id={`sl-manual-callback-description-${automation.id}`} className="sl-recap-description mt-1">
                  {copy.forEveryone}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="sl-recap-content space-y-3">
            <section className="rounded-xl border border-[#c7dbe9] bg-gradient-to-r from-[#eaf3fb] to-[#f3f8fc] px-3 py-2.5 text-sm text-[#1d3d5a] dark:border-sky-900 dark:from-slate-900 dark:to-slate-900 dark:text-slate-100" aria-live="polite">
              {originalDateTime && (
                <p className="text-xs leading-5">
                  <strong className="mr-1">{recap.callbackRuleDate}:</strong>
                  {formatDateTime(originalDateTime, locale)}
                </p>
              )}
              {dateTime && (
                <p className="text-xs leading-5">
                  <strong className="mr-1">{recap.callbackWhen}:</strong>
                  {formatDateTime(dateTime, locale) || dateTime}
                </p>
              )}
              {note.trim() && <p className="text-xs leading-5">
                <strong className="mr-1">{recap.callbackNote}:</strong>{note.trim()}
              </p>}
            </section>
            <StatusListCallbackRescheduleFields
              value={dateTime}
              onChange={setDateTime}
              locale={locale}
              businessDaysOnly={automation.callbackBusinessDaysOnly !== false}
              copy={{
                newDate: recap.rescheduleNewDate,
                time: recap.rescheduleTime,
                time24Hour: recap.reschedule24Hour,
                previousWeekday: recap.reschedulePreviousWeekday,
                nextWeekday: recap.rescheduleNextWeekday,
              }}
              testId={kind === "callback" ? `sl-callback-${automation.id}` : `sl-status-callback-${automation.id}`}
            />
            <div>
              <label htmlFor={`input-sl-${kind}-note-${automation.id}`} className="mb-1 block text-xs font-semibold text-[#49657c] dark:text-slate-300">
                {copy.noteLabel}
              </label>
              <textarea
                id={`input-sl-${kind}-note-${automation.id}`}
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder={copy.notePlaceholder}
                rows={2}
                className="w-full resize-none rounded-xl border border-[#d4e1ea] bg-white px-3 py-2 text-sm text-[#263b50] outline-none transition-colors focus:border-[#79acd0] focus:ring-2 focus:ring-[#79acd0]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                data-testid={`input-sl-${kind}-note-${automation.id}`}
              />
            </div>
          </div>
          <div className="sl-recap-footer">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {recap.cancel}
            </Button>
            <Button
              type="button"
              className="sl-recap-primary"
              disabled={isRunning || !isValidDate}
              onClick={submit}
              data-testid={`btn-sl-${kind}-confirm-${automation.id}`}
            >
              {copy.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default StatusListManualCallbackButton;
