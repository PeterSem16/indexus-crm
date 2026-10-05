import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, useI18n } from "@/i18n";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AgentTaskRequestContext, AgentTaskRequestEditor } from "@/components/tasks/agent-task-request-editor";
import { TaskCategoryPicker, TaskCreateDatePicker, TaskPriorityPicker, type TaskPriority } from "@/components/tasks/task-create-controls";
import { TaskModalArtwork } from "@/components/tasks/task-modal-artwork";
import "@/components/tasks/task-modern-task-surfaces.css";
import "@/components/tasks/task-modal-modern.css";
import { applyTaskRequestCategory, composeTaskRequestDescription } from "@/components/tasks/task-request-description";
import { getTaskRequestBrief } from "@/lib/task-request-brief";
import { AlertTriangle, FileText, Mail, MapPin, Phone, Tag, User } from "lucide-react";

function ProductionEditorFixture() {
  const { locale, t } = useI18n();
  const entityName = "Mila Novak";
  const [form, setForm] = useState({ title: "", description: "", category: "", priority: "medium", dueDate: "" });
  const [submittedRequest, setSubmittedRequest] = useState("");
  const categories = [
    { id: "change_data", label: t.quickCreate.catChangeData, phrase: t.quickCreate.reqChangeData, Icon: User },
    { id: "wrong_phone", label: t.quickCreate.catWrongPhone, phrase: t.quickCreate.reqWrongPhone, Icon: Phone },
    { id: "wrong_email", label: t.quickCreate.catWrongEmail, phrase: t.quickCreate.reqWrongEmail, Icon: Mail },
    { id: "wrong_address", label: t.quickCreate.catWrongAddress, phrase: t.quickCreate.reqWrongAddress, Icon: MapPin },
    { id: "document_request", label: t.quickCreate.catDocument, phrase: t.quickCreate.reqDocument, Icon: FileText },
    { id: "complaint", label: t.quickCreate.catComplaint, phrase: t.quickCreate.reqComplaint, Icon: AlertTriangle },
    { id: "other", label: t.quickCreate.catOther, phrase: t.quickCreate.reqOther, Icon: Tag },
  ];
  const selectedCategory = categories.find((category) => category.id === form.category);
  const selectCategory = (id: string) => {
    const category = categories.find((option) => option.id === id);
    if (!category) return;
    setForm((previous) => applyTaskRequestCategory(previous, id, `${category.label} — ${entityName}`));
  };
  const submit = () => {
    const description = composeTaskRequestDescription(entityName, selectedCategory?.phrase, form.description);
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
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_230px] items-end gap-3" data-testid="fixture-title-row">
                <div className="space-y-1.5 min-w-0">
                  <label htmlFor="input-create-task-title" className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{t.quickCreate.taskTitle}</label>
                  <input
                    id="input-create-task-title"
                    className="task-create-title-input w-full rounded-xl border border-[#c7d8e7] bg-white px-3 py-2 text-sm"
                    value={form.title}
                    onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                    placeholder={t.quickCreate.taskTitle}
                    data-testid="input-create-task-title"
                  />
                </div>
                <TaskCategoryPicker
                  value={form.category}
                  options={categories}
                  label={t.quickCreate.taskCategory}
                  onChange={selectCategory}
                />
              </div>
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
                  categoryPhrase={selectedCategory?.phrase} compact />
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
