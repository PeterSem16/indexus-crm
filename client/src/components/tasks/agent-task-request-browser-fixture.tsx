import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, useI18n } from "@/i18n";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AgentTaskRequestContext, AgentTaskRequestEditor } from "@/components/tasks/agent-task-request-editor";
import { TaskCreateDatePicker, TaskPriorityPicker, type TaskPriority } from "@/components/tasks/task-create-controls";
import { TaskModalArtwork } from "@/components/tasks/task-modal-artwork";
import "@/components/tasks/task-modern-task-surfaces.css";
import "@/components/tasks/task-modal-modern.css";
import { applyTaskRequestCategory, composeTaskRequestDescription } from "@/components/tasks/task-request-description";
import { getTaskRequestBrief } from "@/lib/task-request-brief";

function ProductionEditorFixture() {
  const { locale, t } = useI18n();
  const [form, setForm] = useState({ title: "", description: "", category: "", priority: "medium", dueDate: "" });
  const [submittedRequest, setSubmittedRequest] = useState("");
  const entityName = "Mila Novak";
  const categoryId = "wrong_address";
  const categoryLabel = t.quickCreate.catWrongAddress;
  const categoryPhrase = t.quickCreate.reqWrongAddress;
  const selectAddressCategory = () => setForm((previous) => applyTaskRequestCategory(previous, categoryId, `${categoryLabel} — ${entityName}`));
  const submit = () => {
    const description = composeTaskRequestDescription(entityName, form.category === categoryId ? categoryPhrase : undefined, form.description);
    setSubmittedRequest(getTaskRequestBrief(description, locale).request);
  };
  return (
    <div data-agent-fullscreen="true" className="min-h-[100dvh] bg-[#edf3f7]">
      <Sheet open>
        <SheetContent side="right" className="task-create-sheet w-full sm:max-w-[860px] p-0 flex flex-col gap-0">
          <TaskModalArtwork variant="create" compact />
          <SheetHeader className="task-create-sheet-header shrink-0 px-6 pb-4 space-y-1">
            <SheetTitle className="text-foreground text-xl font-bold leading-tight">{t.quickCreate.newTask}</SheetTitle>
            <SheetDescription className="max-w-2xl text-muted-foreground text-sm leading-relaxed">{t.quickCreate.newTaskDesc}</SheetDescription>
          </SheetHeader>
          <div className="task-modern-modal-body task-create-sheet-body flex-1 min-h-0 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5" data-testid="fixture-form-grid">
              <div className="md:col-span-2">
                <AgentTaskRequestEditor
                  value={form.description}
                  onChange={(description) => setForm((previous) => ({ ...previous, description }))}
                  agentTitle={t.tasks.taskAgentRequestTitle}
                  agentHint={t.tasks.taskAgentRequestHint}
                />
              </div>
              <div className="md:col-span-2">
                <AgentTaskRequestContext title={t.tasks.taskRequestContextTitle} hint={t.tasks.taskRequestContextHint}
                  entityTypeLabel={t.customers.title} entityName={entityName}
                  categoryPhrase={form.category === categoryId ? categoryPhrase : undefined} compact />
              </div>
              <div className="space-y-4 min-w-0">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{t.quickCreate.taskCategory}</label>
                  <button type="button" onClick={selectAddressCategory} className="inline-flex items-center rounded-xl border border-[#c7d8e7] bg-white px-3 py-2 text-xs text-slate-700" data-testid="fixture-change-category">{categoryLabel}</button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{t.quickCreate.taskTitle}</label>
                  <input className="w-full rounded-xl border border-[#c7d8e7] bg-white px-3 py-2 text-sm" readOnly value={form.title || entityName} />
                </div>
              </div>
              <div className="space-y-4 min-w-0">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{t.quickCreate.priority}</label>
                  <TaskPriorityPicker value={form.priority} ariaLabel={t.quickCreate.priority} labels={{ low: t.quickCreate.priorityLow, medium: t.quickCreate.priorityMedium, high: t.quickCreate.priorityHigh, urgent: t.quickCreate.priorityUrgent }}
                    onChange={(priority: TaskPriority) => setForm((previous) => ({ ...previous, priority }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{t.tasks?.deadline || "Termín"}</label>
                  <TaskCreateDatePicker clearLabel={t.common.clear} value={form.dueDate} onChange={(dueDate) => setForm((previous) => ({ ...previous, dueDate }))} locale={locale} label={t.tasks.deadline} />
                  <div className="flex flex-wrap gap-1.5">
                    {[["chip-due-today", t.quickCreate.dueToday, 0], ["chip-due-tomorrow", t.quickCreate.dueTomorrow, 1], ["chip-due-nextweek", t.quickCreate.dueNextWeek, 7]].map(([testid, label, offset]) => {
                      const date = new Date(); date.setDate(date.getDate() + Number(offset));
                      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      return <button key={String(testid)} type="button" data-testid={String(testid)} onClick={() => setForm((previous) => ({ ...previous, dueDate: previous.dueDate === key ? "" : key }))} className={`rounded-full border px-2.5 py-1 text-[11px] ${form.dueDate === key ? "border-[#2d6fba] bg-[#2d6fba] text-white" : "border-[#c7d8e7] bg-white text-slate-600"}`}>{label}</button>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="task-modern-modal-footer task-create-sheet-footer shrink-0 px-6 py-4 flex justify-end">
            <button type="button" onClick={submit} className="task-create-submit rounded-xl px-5 py-2 font-semibold text-white" data-testid="fixture-submit">{t.quickCreate.sendTask}</button>
          </div>
          {submittedRequest && <output data-testid="fixture-submitted-request" data-request={submittedRequest} className="sr-only">{submittedRequest}</output>}
        </SheetContent>
      </Sheet>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<I18nProvider userCountries={[]}><ProductionEditorFixture /></I18nProvider>);
