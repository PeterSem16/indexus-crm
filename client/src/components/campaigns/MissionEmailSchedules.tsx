import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { missionEmailScheduleTranslations, missionEmailRuntimeTranslations, type MissionEmailScheduleLocale } from "./mission-email-schedule-translations";
import { missionEmailExtrasTranslations, type MissionEmailExtrasLocale } from "./mission-email-extras-translations";

type Frequency = "daily" | "weekly" | "monthly";
type User = { id: string; name: string; email: string };
type Schedule = {
  id: string; enabled: boolean; recipientUserIds: string[]; sendTime: string;
  deliveryOptions: { frequency: Frequency; weekday: number; monthDay: number; country: string; locale: string; includeExcel?: boolean };
  nextRunAt: string | null; lastRunAt: string | null; lastStatus?: string | null;
};
type Sender = { country: string; email: string | null; connected: boolean };
type Data = { canManage: boolean; users: User[]; countries: string[]; schedules: Schedule[]; senders?: Sender[]; testRecipientEmail?: string | null };
type Form = { recipientUserIds: string[]; sendTime: string; enabled: boolean; frequency: Frequency; weekday: number; monthDay: number; country: string; locale: string; includeExcel: boolean };
type Preview = { subject: string; html: string; from: string; to: string };
type TestResult = { status: "sent"; to: string; from: string; attachmentIncluded: boolean };
const emptyForm = (): Form => ({ recipientUserIds: [], sendTime: "08:00", enabled: false, frequency: "daily", weekday: 1, monthDay: 1, country: "", locale: "en", includeExcel: false });
const fieldClass = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buttonClass = "rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
const scheduleForm = (schedule: Schedule): Form => ({
  recipientUserIds: [...schedule.recipientUserIds], sendTime: schedule.sendTime, enabled: schedule.enabled,
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
  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (query.data?.users ?? []).filter(user => !needle || `${user.name} ${user.email}`.toLocaleLowerCase().includes(needle));
  }, [query.data?.users, search]);
  const beginNew = () => { setEditing(null); setForm(emptyForm()); setError(""); setSearch(""); setOpen(true); };
  const beginEdit = (schedule: Schedule) => {
    setEditing(schedule.id); setError(""); setSearch("");
    setForm({ ...scheduleForm(schedule), recipientUserIds: schedule.recipientUserIds.filter(id => query.data?.users.some(user => user.id === id)) });
    setOpen(true);
  };
  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!form.recipientUserIds.length) { setError(copy.requiredRecipients); return; }
    if (!form.sendTime) { setError(copy.requiredTime); return; }
    if (!form.country) { setError(copy.requiredCountry); return; }
    setBusy(true);
    const body = { ...form, includeExcel: form.includeExcel ?? false, weekday: Number(form.weekday), monthDay: Number(form.monthDay) };
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
    <section data-testid="mission-email-schedules" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <span className="text-sm font-semibold">{copy.title}</span>
          <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-border px-4 py-4 sm:px-5">
          {query.isPending ? <div aria-label={copy.loading} className="space-y-2"><div className="h-4 w-1/3 animate-pulse rounded bg-muted" /><div className="h-12 animate-pulse rounded bg-muted" /></div>
            : query.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm text-destructive"><span>{copy.loadError}</span><button type="button" className={buttonClass} onClick={() => void query.refetch()}>{copy.retry}</button></div>
              : <>
                {!query.data?.canManage && <p className="mb-3 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">{copy.accessDenied}</p>}
                {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
                {previewError && <p role="alert" className="mb-3 text-sm text-destructive">{copy.previewError}</p>}
                {query.data?.canManage && !open && <button type="button" data-testid="mission-email-schedule-new" onClick={beginNew} className={`${buttonClass} mb-3 border-teal-700/30 text-teal-900 dark:text-teal-200`}>{copy.add}</button>}
                {open && query.data?.canManage && <form onSubmit={event => void submit(event)} className="mb-4 space-y-4 rounded-lg border border-border bg-muted/15 p-3 sm:p-4">
                  <fieldset className="space-y-2">
                    <legend className="mb-1 text-xs font-semibold text-foreground">{copy.recipients} <span className="text-destructive">*</span></legend>
                    <input value={search} onChange={event => setSearch(event.target.value)} aria-label={copy.searchRecipients} placeholder={copy.searchRecipients} className={`${fieldClass} max-w-sm`} />
                    <div className="grid max-h-36 gap-1 overflow-auto rounded-md border border-border bg-background p-2 sm:grid-cols-2">
                      {filteredUsers.map(user => <label key={user.id} className="flex min-w-0 items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted">
                        <input type="checkbox" data-testid={`mission-email-schedule-recipient-${user.id}`} checked={form.recipientUserIds.includes(user.id)}
                          onChange={event => update("recipientUserIds", event.target.checked ? [...new Set([...form.recipientUserIds, user.id])] : form.recipientUserIds.filter(id => id !== user.id))}
                          className="accent-teal-700" />
                        <span className="min-w-0 truncate text-foreground">{user.name || user.email}</span><span className="min-w-0 truncate text-muted-foreground">{user.name ? user.email : ""}</span>
                      </label>)}
                      {!filteredUsers.length && <p className="p-2 text-xs text-muted-foreground">{copy.noRecipients}</p>}
                    </div>
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
                    <button type="submit" data-testid="mission-email-schedule-save" disabled={busy} className={`${buttonClass} border-teal-700/30 bg-teal-700/10 text-teal-900 dark:text-teal-200`}>{copy.save}</button>
                    <button type="button" className={buttonClass} onClick={() => { setOpen(false); setError(""); }}>{copy.cancel}</button>
                  </div>
                </form>}
                {!query.data?.schedules.length && !open ? <p className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{copy.noSchedules}</p>
                  : <div className="space-y-2">{query.data?.schedules.map(schedule => {
                    const when = schedule.deliveryOptions.frequency === "weekly" ? ` · ${copy.weekdays[schedule.deliveryOptions.weekday - 1] ?? ""}` :
                      schedule.deliveryOptions.frequency === "monthly" ? ` · ${schedule.deliveryOptions.monthDay}` : "";
                    return <article key={schedule.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-xs">
                        <p className="font-semibold text-foreground">{copy[schedule.deliveryOptions.frequency]}{when} · {schedule.sendTime} <span className="font-normal text-muted-foreground">Europe/Bratislava</span></p>
                        <p className="mt-1 truncate text-muted-foreground">{schedule.recipientUserIds.map(id => query.data?.users.find(user => user.id === id)?.name || id).join(", ")}</p>
                        <p className="mt-1 text-muted-foreground">{extras.systemSender}: {senderText(schedule.deliveryOptions.country)}</p>
                        {schedule.deliveryOptions.includeExcel && <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">{extras.includeExcel}</span>}
                        <p className="mt-1 text-muted-foreground">{copy.nextRun}: {formatDate(schedule.nextRunAt, locale, copy.none)} · {copy.lastRun}: {formatDate(schedule.lastRunAt, locale, copy.none)}{schedule.lastStatus ? ` · ${copy.lastStatus}: ${runtimeCopy[schedule.lastStatus as "sent" | "blocked" | "unknown" | "sending"] || copy.none}` : ""}</p>
                      </div>
                      {query.data?.canManage && <div className="flex flex-wrap gap-1.5">
                        <span className={`self-center px-1 text-[11px] font-semibold ${schedule.enabled ? "text-teal-800 dark:text-teal-300" : "text-muted-foreground"}`}>{schedule.enabled ? copy.statusEnabled : copy.statusPaused}</span>
                        <button type="button" data-testid={`mission-email-test-${schedule.id}`} className={buttonClass} onClick={() => openTest(schedule)}>{extras.testEmail}</button>
                        <button type="button" className={buttonClass} onClick={() => void showPreview(schedule)}>{copy.preview}</button>
                        <button type="button" className={buttonClass} onClick={() => beginEdit(schedule)}>{copy.edit}</button>
                        <button type="button" disabled={busy} className={buttonClass} onClick={() => void toggle(schedule)}>{schedule.enabled ? copy.pause : copy.resume}</button>
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
