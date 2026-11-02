import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PauseCircle, PlayCircle, CalendarClock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { missionEmailScheduleTranslations, missionEmailRuntimeTranslations, type MissionEmailScheduleLocale } from "./mission-email-schedule-translations";
import { missionEmailExtrasTranslations, type MissionEmailExtrasLocale } from "./mission-email-extras-translations";
import { missionEmailPanelTranslations, type MissionEmailPanelLocale } from "./mission-email-panel-translations";
import MissionEmailRecipientPicker from "./MissionEmailRecipientPicker";

type Frequency = "daily" | "weekly" | "monthly";
type User = { id: string; name: string; email: string };
type Schedule = {
  id: string; enabled: boolean; recipientUserIds: string[]; externalEmails: string[]; sendTime: string;
  deliveryOptions: { frequency: Frequency; weekday: number; monthDay: number; country: string; locale: string; includeExcel?: boolean };
  nextRunAt: string | null; lastRunAt: string | null; lastStatus?: string | null;
};
type Sender = { country: string; email: string | null; connected: boolean };
type Data = { canManage: boolean; users: User[]; countries: string[]; schedules: Schedule[]; senders?: Sender[]; testRecipientEmail?: string | null };
type Form = { recipientUserIds: string[]; externalEmails: string[]; sendTime: string; enabled: boolean; frequency: Frequency; weekday: number; monthDay: number; country: string; locale: string; includeExcel: boolean };
type Preview = { subject: string; html: string; from: string; to: string };
type TestResult = { status: "sent"; to: string; from: string; attachmentIncluded: boolean };
const emptyForm = (): Form => ({ recipientUserIds: [], externalEmails: [], sendTime: "08:00", enabled: false, frequency: "daily", weekday: 1, monthDay: 1, country: "", locale: "en", includeExcel: false });
const fieldClass = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buttonClass = "rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
const scheduleForm = (schedule: Schedule): Form => ({
  recipientUserIds: [...schedule.recipientUserIds], externalEmails: [...(schedule.externalEmails ?? [])], sendTime: schedule.sendTime, enabled: schedule.enabled,
  frequency: schedule.deliveryOptions.frequency, weekday: schedule.deliveryOptions.weekday,
  monthDay: schedule.deliveryOptions.monthDay, country: schedule.deliveryOptions.country, locale: schedule.deliveryOptions.locale,
  includeExcel: schedule.deliveryOptions.includeExcel ?? false,
});

async function requestJson<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = method === "GET"
    ? await fetch(url, { credentials: "include" })
    : await apiRequest(method, url, body);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bratislava" }).format(date);
}

export default function MissionEmailSchedules({ campaignId, locale }: { campaignId: string; locale: string }) {
  const copy = missionEmailScheduleTranslations[(locale in missionEmailScheduleTranslations ? locale : "en") as keyof typeof missionEmailScheduleTranslations];
  const panelCopy = missionEmailPanelTranslations[(locale in missionEmailPanelTranslations ? locale : "en") as MissionEmailPanelLocale];
  const endpoint = `/api/campaigns/${encodeURIComponent(campaignId)}/mission-report-schedules`;
  const runtimeCopy = missionEmailRuntimeTranslations[(locale in missionEmailRuntimeTranslations ? locale : "en") as MissionEmailScheduleLocale];
  const extras = missionEmailExtrasTranslations[(locale in missionEmailExtrasTranslations ? locale : "en") as MissionEmailExtrasLocale];
  const saveFailure = (value: unknown) => {
    const message = value instanceof Error ? value.message : "";
    const code = (["system_mailbox_unavailable", "recipient_not_authorized", "schedule_busy", "not_authorized"] as const)
      .find(key => message.includes(key));
    return code ? runtimeCopy[code] : copy.saveError;
  };
  const queryClient = useQueryClient();
  const queryKey = [endpoint];
  const query = useQuery<Data>({ queryKey, queryFn: async () => {
    const data = await requestJson<Data>(endpoint);
    if (typeof data?.canManage !== "boolean" || !Array.isArray(data.users) || !Array.isArray(data.countries) || !Array.isArray(data.schedules))
      throw new Error("Invalid schedule response");
    return data;
  }, enabled: Boolean(campaignId) });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [search, setSearch] = useState("");
  const [recipientDraftValid, setRecipientDraftValid] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [testDialog, setTestDialog] = useState<{ schedule: Schedule; requestId: string } | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testError, setTestError] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const testInFlight = useRef(false);
  const getSender = (country: string) => query.data?.senders?.find(sender => sender.country === country);
  const senderText = (country: string) => {
    const sender = getSender(country);
    return sender?.connected && sender.email ? sender.email : extras.mailboxUnavailable;
  };
  const beginNew = () => { setEditing(null); setForm(emptyForm()); setError(""); setSearch(""); setOpen(true); };
  const beginEdit = (schedule: Schedule) => {
    setEditing(schedule.id); setError(""); setSearch("");
    setForm({ ...scheduleForm(schedule), recipientUserIds: schedule.recipientUserIds.filter(id => query.data?.users.some(user => user.id === id)) });
    setOpen(true);
  };
  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!recipientDraftValid) { setError(panelCopy.invalidAddresses); return; }
    if (!form.recipientUserIds.length && !form.externalEmails.length) { setError(copy.requiredRecipients); return; }
    if (form.recipientUserIds.length + form.externalEmails.length > 100) { setError(panelCopy.recipientLimit); return; }
    if (!form.sendTime) { setError(copy.requiredTime); return; }
    if (!form.country) { setError(copy.requiredCountry); return; }
    setBusy(true);
    const body = { ...form, externalEmails: [...new Set(form.externalEmails.map(email => email.trim().toLocaleLowerCase()))], includeExcel: form.includeExcel ?? false, weekday: Number(form.weekday), monthDay: Number(form.monthDay) };
    try {
      await requestJson(editing ? `${endpoint}/${encodeURIComponent(editing)}` : endpoint, editing ? "PATCH" : "POST", body);
      await queryClient.invalidateQueries({ queryKey });
      setOpen(false); setEditing(null);
    } catch (value) { setError(saveFailure(value)); }
    finally { setBusy(false); }
  };
  const toggle = async (schedule: Schedule) => {
    setBusy(true); setError("");
    try {
      await requestJson(`${endpoint}/${encodeURIComponent(schedule.id)}`, "PATCH", {
        ...scheduleForm(schedule), includeExcel: schedule.deliveryOptions.includeExcel ?? false, enabled: !schedule.enabled,
      });
      await queryClient.invalidateQueries({ queryKey });
    } catch (value) { setError(saveFailure(value)); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setBusy(true); setError("");
    try {
      await requestJson(`${endpoint}/${encodeURIComponent(id)}`, "DELETE");
      await queryClient.invalidateQueries({ queryKey }); setConfirmDelete(null);
    } catch { setError(copy.deleteError); }
    finally { setBusy(false); }
  };
  const showPreview = async (schedule: Schedule) => {
    setPreviewError(false); setPreview(null);
    try { setPreview(await requestJson<Preview>(`${endpoint}/${encodeURIComponent(schedule.id)}/preview`, "POST", {})); }
    catch { setPreviewError(true); }
  };
  const openTest = (schedule: Schedule) => {
    setTestError(""); setTestResult(null); testInFlight.current = false;
    setTestDialog({ schedule, requestId: crypto.randomUUID() });
  };
  const closeTest = () => {
    if (testBusy) return;
    setTestDialog(null); setTestError(""); setTestResult(null);
  };
  const testFailure = (value: unknown) => {
    const message = value instanceof Error ? value.message : "";
    if (message.includes("test_recipient_unavailable")) return extras.testRecipientUnavailable;
    if (message.includes("system_mailbox_unavailable")) return extras.testMailboxUnavailable;
    if (message.includes("test_delivery_unconfirmed")) return extras.testUncertain;
    if (message.includes("test_rate_limited")) return extras.testRateLimited;
    if (message.includes("schedule_busy")) return extras.testScheduleBusy;
    if (message.includes("not_authorized")) return extras.testNotAuthorized;
    return extras.testGenericError;
  };
  const sendTest = async () => {
    if (!testDialog || testBusy || testInFlight.current || testResult) return;
    testInFlight.current = true; setTestBusy(true); setTestError("");
    try {
      const result = await requestJson<TestResult>(
        `${endpoint}/${encodeURIComponent(testDialog.schedule.id)}/test-email`,
        "POST",
        { requestId: testDialog.requestId },
      );
      setTestResult(result);
    } catch (value) {
      setTestError(testFailure(value));
    } finally {
      testInFlight.current = false; setTestBusy(false);
    }
  };
  const label = (text: string, child: ReactNode, hint?: string) => <label title={hint} className="block space-y-1 text-xs font-medium text-muted-foreground">{text}{child}</label>;

  return (
    <section data-testid="mission-email-schedules" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-gradient-to-r from-primary/5 via-transparent to-transparent px-4 py-4 sm:px-5">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarClock aria-hidden="true" className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block text-sm font-bold text-foreground">{copy.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{copy.reportHelp}</span></span>
          </span>
          <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-border px-4 py-4 sm:px-5">
          {query.isPending ? <div aria-label={copy.loading} className="space-y-2"><div className="h-4 w-1/3 animate-pulse rounded bg-muted" /><div className="h-12 animate-pulse rounded bg-muted" /></div>
            : query.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm text-destructive"><span>{copy.loadError}</span><button type="button" className={buttonClass} onClick={() => void query.refetch()}>{copy.retry}</button></div>
              : <>
                {!query.data?.canManage && <p className="mb-3 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">{copy.accessDenied}</p>}
                {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
                {previewError && <p role="alert" className="mb-3 text-sm text-destructive">{copy.previewError}</p>}
                {query.data?.canManage && !open && <button type="button" data-testid="mission-email-schedule-new" onClick={beginNew} className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">{copy.add}</button>}
                {open && query.data?.canManage && <form onSubmit={event => void submit(event)} className="mb-5 space-y-5 rounded-2xl border border-primary/20 bg-muted/20 p-4 sm:p-5">
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-xs font-semibold text-foreground">{copy.recipients} <span className="text-destructive">*</span></legend>
                    <MissionEmailRecipientPicker users={query.data?.users ?? []} userIds={form.recipientUserIds} externalEmails={form.externalEmails}
                      onUserIdsChange={value => update("recipientUserIds", value)} onExternalEmailsChange={value => update("externalEmails", value)} onValidityChange={setRecipientDraftValid}
                      search={search} onSearchChange={setSearch} searchLabel={copy.searchRecipients} noUsers={copy.noRecipients} copy={panelCopy} />
                  </fieldset>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {label(copy.frequency, <select data-testid="mission-email-schedule-frequency" value={form.frequency} onChange={event => update("frequency", event.target.value as Frequency)} className={fieldClass}>
                      {(["daily", "weekly", "monthly"] as const).map(value => <option key={value} value={value}>{copy[value]}</option>)}
                    </select>)}
                    {form.frequency === "weekly" && label(copy.weekday, <select data-testid="mission-email-schedule-weekday" value={form.weekday} onChange={event => update("weekday", Number(event.target.value))} className={fieldClass}>
                      {copy.weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
                    </select>)}
                    {form.frequency === "monthly" && label(copy.monthDay, <input data-testid="mission-email-schedule-monthday" type="number" min={1} max={31} required value={form.monthDay}
                      onChange={event => update("monthDay", Number(event.target.value))} className={fieldClass} />)}
                    {label(copy.sendTime, <input data-testid="mission-email-schedule-time" type="time" required value={form.sendTime} onChange={event => update("sendTime", event.target.value)} className={fieldClass} />)}
                    {label(copy.country, <select required value={form.country} onChange={event => update("country", event.target.value)} className={fieldClass}>
                      <option value="">{copy.selectCountry}</option>{(query.data?.countries ?? []).map(country => <option key={country} value={country}>{country}</option>)}
                    </select>)}
                    {label(extras.systemSender, <input data-testid="mission-email-system-sender" readOnly aria-readonly="true" value={form.country ? senderText(form.country) : ""} className={fieldClass} />)}
                    {label(copy.language, <select required value={form.locale} onChange={event => update("locale", event.target.value)} className={fieldClass}>
                      <option value="">{copy.selectLanguage}</option>{Object.entries(copy.locales).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                    </select>)}
                  </div>
                  <label data-testid="mission-email-schedule-enabled" className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={form.enabled} onChange={event => update("enabled", event.target.checked)} className="accent-teal-700" />{copy.enabled}
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input data-testid="mission-email-include-excel" type="checkbox" checked={form.includeExcel} onChange={event => update("includeExcel", event.target.checked)} className="accent-teal-700" />{extras.includeExcel}
                  </label>
                  <div className="space-y-1 text-xs leading-relaxed text-muted-foreground"><p>{copy.timezoneHelp}</p><p>{copy.reportHelp}</p></div>
                  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" data-testid="mission-email-schedule-save" disabled={busy || !recipientDraftValid} className={`${buttonClass} border-teal-700/30 bg-teal-700/10 text-teal-900 dark:text-teal-200`}>{copy.save}</button>
                    <button type="button" className={buttonClass} onClick={() => { setOpen(false); setError(""); }}>{copy.cancel}</button>
                  </div>
                </form>}
                {!query.data?.schedules.length && !open ? <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-9 text-center"><CalendarClock aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-muted-foreground/70" /><p className="text-sm font-semibold text-foreground">{copy.noSchedules}</p></div>
                  : <div className="space-y-3">{query.data?.schedules.map(schedule => {
                    const when = schedule.deliveryOptions.frequency === "weekly" ? ` · ${copy.weekdays[schedule.deliveryOptions.weekday - 1] ?? ""}` :
                      schedule.deliveryOptions.frequency === "monthly" ? ` · ${schedule.deliveryOptions.monthDay}` : "";
                    const scheduleRecipients = [...schedule.recipientUserIds.map(id => query.data?.users.find(user => user.id === id)?.name || id), ...(schedule.externalEmails ?? [])];
                    return <article key={schedule.id} className={`flex flex-col gap-4 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-start sm:justify-between ${schedule.enabled ? "border-emerald-700/25 bg-emerald-700/[.035]" : "border-border bg-muted/15"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span data-testid={`mission-email-status-${schedule.id}`} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${schedule.enabled ? "bg-emerald-700/10 text-emerald-800 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                            {schedule.enabled ? <PlayCircle aria-hidden="true" className="h-3.5 w-3.5" /> : <PauseCircle aria-hidden="true" className="h-3.5 w-3.5" />}{schedule.enabled ? panelCopy.active : panelCopy.paused}
                          </span>
                          <p className="text-sm font-bold text-foreground">{copy[schedule.deliveryOptions.frequency]}{when} · {schedule.sendTime} <span className="text-xs font-normal text-muted-foreground">Europe/Bratislava</span></p>
                        </div>
                        <p className="mt-2 flex flex-wrap gap-1.5">{scheduleRecipients.map((recipient, index) => <span key={`${recipient}-${index}`} className="max-w-full truncate rounded-md border border-border/70 bg-background/80 px-2 py-1 text-xs text-foreground">{recipient}</span>)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{extras.systemSender}: {senderText(schedule.deliveryOptions.country)}</p>
                        {schedule.deliveryOptions.includeExcel && <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">{extras.includeExcel}</span>}
                        <p className="mt-1 text-muted-foreground">{copy.nextRun}: {formatDate(schedule.nextRunAt, locale, copy.none)} · {copy.lastRun}: {formatDate(schedule.lastRunAt, locale, copy.none)}{schedule.lastStatus ? ` · ${copy.lastStatus}: ${runtimeCopy[schedule.lastStatus as "sent" | "blocked" | "unknown" | "sending"] || copy.none}` : ""}</p>
                      </div>
                      {query.data?.canManage && <div className="flex flex-wrap items-center gap-1.5 sm:max-w-[330px] sm:justify-end">
                        <button type="button" data-testid={`mission-email-test-${schedule.id}`} className={buttonClass} onClick={() => openTest(schedule)}>{extras.testEmail}</button>
                        <button type="button" className={buttonClass} onClick={() => void showPreview(schedule)}>{copy.preview}</button>
                        <button type="button" className={buttonClass} onClick={() => beginEdit(schedule)}>{copy.edit}</button>
                        <button type="button" data-testid={`mission-email-toggle-${schedule.id}`} disabled={busy} aria-label={schedule.enabled ? copy.pause : copy.resume} className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${schedule.enabled ? "border-amber-600/35 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300" : "border-emerald-700/35 bg-emerald-700/10 text-emerald-800 hover:bg-emerald-700/20 dark:text-emerald-300"}`} onClick={() => void toggle(schedule)}>
                          {schedule.enabled ? <PauseCircle aria-hidden="true" className="h-4 w-4" /> : <PlayCircle aria-hidden="true" className="h-4 w-4" />}{schedule.enabled ? copy.pause : copy.resume}
                        </button>
                        {confirmDelete === schedule.id ? <><span className="self-center text-xs text-destructive">{copy.deleteConfirm}</span><button type="button" disabled={busy} className={`${buttonClass} text-destructive`} onClick={() => void remove(schedule.id)}>{copy.confirm}</button><button type="button" className={buttonClass} onClick={() => setConfirmDelete(null)}>{copy.keep}</button></>
                          : <button type="button" disabled={busy} className={`${buttonClass} text-destructive`} onClick={() => setConfirmDelete(schedule.id)}>{copy.delete}</button>}
                      </div>}
                    </article>;
                  })}</div>}
                <Dialog open={Boolean(preview)} onOpenChange={value => { if (!value) setPreview(null); }}>
                  <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-24px)] max-w-3xl flex-col overflow-hidden p-0 [&>button]:hidden">
                    {preview && <>
                      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                        <DialogHeader>
                          <DialogTitle>{copy.previewTitle}: {preview.subject}</DialogTitle>
                          <DialogDescription>{runtimeCopy.periodFrom}: {preview.from} · {runtimeCopy.periodTo}: {preview.to}</DialogDescription>
                        </DialogHeader>
                        <DialogClose asChild><button type="button" className={buttonClass}>{copy.closePreview}</button></DialogClose>
                      </div>
                      <iframe title={copy.previewTitle} sandbox="" srcDoc={preview.html} className="min-h-[50vh] w-full flex-1 bg-white" />
                    </>}
                  </DialogContent>
                </Dialog>
                <Dialog open={Boolean(testDialog)} onOpenChange={value => { if (!value && !testBusy) closeTest(); }}>
                  <DialogContent className="w-[calc(100vw-24px)] max-w-lg [&>button]:hidden">
                    {testDialog && <>
                      <DialogHeader>
                        <DialogTitle>{extras.testTitle}</DialogTitle>
                        <DialogDescription>{extras.testDescription}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 text-sm">
                        <label className="block space-y-1 text-xs font-medium text-muted-foreground">{extras.testTo}
                          <input readOnly aria-readonly="true" value={query.data?.testRecipientEmail ?? ""} className={fieldClass} />
                        </label>
                        <label className="block space-y-1 text-xs font-medium text-muted-foreground">{extras.testFrom}
                          <input readOnly aria-readonly="true" value={senderText(testDialog.schedule.deliveryOptions.country)} className={fieldClass} />
                        </label>
                        <p className="text-xs text-muted-foreground">{extras.testAttachment}: {testDialog.schedule.deliveryOptions.includeExcel ? extras.includeExcel : extras.noAttachment}</p>
                        {!query.data?.testRecipientEmail && <p role="alert" className="text-xs text-destructive">{extras.testRecipientUnavailable}</p>}
                        {!getSender(testDialog.schedule.deliveryOptions.country)?.connected && <p role="alert" className="text-xs text-destructive">{extras.testMailboxUnavailable}</p>}
                        {testError && <p role="alert" className="text-sm text-destructive">{testError}</p>}
                        {testResult && <p role="status" className="text-sm text-teal-800 dark:text-teal-300">{extras.testAccepted}<span className="mt-1 block text-xs text-muted-foreground">{testResult.to} · {testResult.from} · {testResult.attachmentIncluded ? extras.includeExcel : extras.noAttachment}</span></p>}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" data-testid="mission-email-test-cancel" disabled={testBusy} className={buttonClass} onClick={closeTest}>{extras.testCancel}</button>
                        {!testResult && <button type="button" data-testid="mission-email-test-confirm" disabled={testBusy || !query.data?.testRecipientEmail || !getSender(testDialog.schedule.deliveryOptions.country)?.connected} className={`${buttonClass} border-teal-700/30 bg-teal-700/10 text-teal-900 dark:text-teal-200`} onClick={() => void sendTest()}>{extras.testConfirm}</button>}
                      </div>
                    </>}
                  </DialogContent>
                </Dialog>
              </>}
        </div>
      </details>
    </section>
  );
}
