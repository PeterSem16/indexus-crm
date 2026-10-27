import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, useI18n } from "@/i18n";
import { translations, type Locale } from "@/i18n/translations";
import {
  PhoneIssueTaskFields,
  composePhoneIssueDetails,
  phoneIssueTaskCanSubmit,
  usePhoneIssueContext,
  type PhoneIssueField,
  type PhoneIssueReason,
} from "@/components/tasks/phone-issue-workflow";
import { PhoneIssueContactArea } from "@/components/tasks/phone-issue-contact-area";
import { buildAgentWorkspaceTaskCreatePayload } from "@/lib/agent-workspace-task-create";
import { composeTaskRequestDescription } from "@/components/tasks/task-request-description";

const localeCodes: Locale[] = ["sk", "en", "cs", "hu", "ro", "it", "de"];

function PhoneIssueFixture() {
  const { locale, setLocale } = useI18n();
  const [entityId, setEntityId] = useState("clinic-hidden-source");
  const [reason, setReason] = useState<PhoneIssueReason | "">("");
  const [phoneField, setPhoneField] = useState<PhoneIssueField | "">("");
  const [submitted, setSubmitted] = useState("");
  const context = usePhoneIssueContext({
    missionId: "mission-fixture",
    sessionId: "session-fixture",
    entityType: "clinic",
    entityId,
    enabled: true,
  });
  const selectedPhone = context.data?.phones.find(phone => phone.field === phoneField);
  const canSubmit = phoneIssueTaskCanSubmit({
    eligible: context.eligible,
    loading: context.isLoading,
    fetching: context.isFetching,
    error: context.isError,
    data: context.data,
    reason,
    phoneField,
  });
  const submit = () => {
    if (!canSubmit || !reason || !phoneField || !selectedPhone) return;
    const details = composePhoneIssueDetails("Please review this number.", reason, selectedPhone.number, locale);
    const description = composeTaskRequestDescription("St. Anselm Clinic", translations[locale].quickCreate.reqWrongPhone, details);
    const payload = buildAgentWorkspaceTaskCreatePayload({
      title: "Wrong phone — St. Anselm Clinic",
      description,
      priority: "medium",
      recipients: { groupIds: ["triage-group"], userIds: [] },
      requestTypeId: "wrong_phone",
      relatedEntityType: "clinic",
      relatedEntityId: entityId,
      attachments: [],
      phoneIssue: { reason, phoneField, expectedNumber: selectedPhone.number },
    }, undefined, { missionId: "mission-fixture", sessionId: "session-fixture" });
    setSubmitted(JSON.stringify(payload));
  };
  return <main className="min-h-[100dvh] bg-[#edf3f7] p-5 text-foreground sm:p-8" data-testid="phone-issue-fixture">
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="rounded-xl border border-[#c7d8e7] bg-white p-4">
        <h1 className="text-lg font-semibold">Phone issue workflow fixture</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="grid gap-1 text-xs">Locale
            <select data-testid="fixture-locale" value={locale} onChange={event => setLocale(event.target.value as Locale)} className="h-9 rounded-md border bg-background px-2">
              {localeCodes.map(code => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs">Entity context
            <select data-testid="fixture-entity" value={entityId} onChange={event => { setEntityId(event.target.value); setPhoneField(""); setReason(""); setSubmitted(""); }}
              className="h-9 rounded-md border bg-background px-2">
              <option value="clinic-hidden-source">Clinic · hidden source / available numbers</option>
              <option value="clinic-no-source">Clinic · no source</option>
              <option value="clinic-no-call">Clinic · pending without call</option>
              <option value="clinic-swap">Clinic · alternate contact</option>
            </select>
          </label>
          <button type="button" data-testid="fixture-refresh-context" onClick={() => void context.refetch()} className="mt-auto rounded-md border px-3 py-2 text-xs">Refresh context</button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground" data-testid="fixture-query-status">
          {context.isFetching ? "loading" : context.isError ? "error" : "ready"} · {entityId}
        </p>
      </header>

      <PhoneIssueTaskFields
        locale={locale}
        loading={context.isLoading || context.isFetching}
        error={context.isError}
        retryable={context.eligible}
        data={context.data}
        reason={reason}
        phoneField={phoneField}
        onReasonChange={setReason}
        onPhoneFieldChange={setPhoneField}
        onRetry={() => void context.refetch()}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" data-testid="fixture-submit-task" disabled={!canSubmit} onClick={submit}
          className="rounded-lg bg-[#2d6fba] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Create wrong-phone task
        </button>
        <button type="button" data-testid="fixture-swap-contact" onClick={() => { setEntityId("clinic-swap"); setPhoneField(""); setReason(""); setSubmitted(""); }}
          className="rounded-lg border border-[#c7d8e7] bg-white px-4 py-2 text-sm">Switch contact</button>
      </div>
      <output data-testid="fixture-task-payload" className="block overflow-auto whitespace-pre-wrap rounded-xl border border-[#c7d8e7] bg-white p-3 text-xs">{submitted}</output>

      <section className="rounded-xl border border-[#c7d8e7] bg-white p-3" data-testid="fixture-phone-card">
        <div className="mb-2 text-sm font-semibold">Clinic phone · Status List active · disposition closed</div>
        <PhoneIssueContactArea
          key={`mission-fixture:session-fixture:clinic:${entityId}`}
          missionId="mission-fixture"
          sessionId="session-fixture"
          entityType="clinic"
          entityId={entityId}
          locale={locale}
        />
      </section>
    </div>
  </main>;
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <I18nProvider userCountries={[]}>
      <PhoneIssueFixture />
    </I18nProvider>
  </QueryClientProvider>,
);
