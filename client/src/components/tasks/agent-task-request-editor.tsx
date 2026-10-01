import { FileText, ListChecks } from "lucide-react";

export interface AgentTaskRequestEditorProps {
  value: string;
  onChange: (value: string) => void;
  agentTitle: string;
  agentHint: string;
}

export function AgentTaskRequestEditor({
  value,
  onChange,
  agentTitle,
  agentHint,
}: AgentTaskRequestEditorProps) {
  return (
    <section
      id="agent-task-request-editor"
      data-testid="agent-task-request-editor"
      className="overflow-hidden rounded-2xl border border-[#b8d2e7] bg-[#fffefa] shadow-[0_8px_24px_-18px_rgba(30,77,117,0.45)] transition-shadow focus-within:border-[#4d8fc8] focus-within:shadow-[0_10px_28px_-18px_rgba(35,105,165,0.62)] dark:border-slate-600 dark:bg-slate-900 dark:focus-within:border-blue-400"
    >
      <div className="flex items-center gap-2.5 border-b border-[#e2ebf1] bg-[#f4f8fb] px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#d2e3ef] bg-[#eaf3fa] text-[#2d6fba] dark:border-slate-600 dark:bg-slate-700 dark:text-blue-200">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <label htmlFor="input-create-task-description" className="block text-sm font-semibold tracking-[-0.01em] text-[#173452] dark:text-slate-100">
            {agentTitle}
          </label>
          <p id="agent-task-request-hint" className="mt-0.5 text-xs leading-relaxed text-[#71859a] dark:text-slate-400">
            {agentHint}
          </p>
        </div>
      </div>

      <textarea
        id="input-create-task-description"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={agentHint}
        aria-describedby="agent-task-request-hint"
        className="block min-h-[176px] w-full resize-y border-0 bg-transparent px-4 py-4 text-[14px] leading-7 text-[#233c54] outline-none placeholder:text-[#9aaaba] focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500 sm:min-h-[208px]"
        data-testid="input-create-task-description"
      />
    </section>
  );
}

export interface AgentTaskRequestContextProps {
  title: string;
  hint: string;
  entityTypeLabel?: string;
  entityName?: string;
  categoryPhrase?: string;
}

export function AgentTaskRequestContext({
  title,
  hint,
  entityTypeLabel,
  entityName,
  categoryPhrase,
}: AgentTaskRequestContextProps) {
  return (
    <section
      id="agent-task-request-context"
      data-testid="agent-task-request-context"
      aria-label={title}
      className="rounded-xl border border-[#d7e3eb] bg-[#eef4f8] px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/60"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e1ebf2] text-[#69839a] dark:bg-slate-700 dark:text-slate-300">
          <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[#647b8f] dark:text-slate-300">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[#8193a3] dark:text-slate-400">{hint}</p>
          {(entityName || categoryPhrase) && (
            <div className="mt-3 space-y-2 border-t border-[#dce6ed] pt-2.5 dark:border-slate-700">
              {entityName && (
                <p className="break-words text-xs leading-relaxed text-[#62788b] dark:text-slate-300">
                  {entityTypeLabel && <span className="font-medium">{entityTypeLabel}: </span>}
                  <span className="font-semibold text-[#3f5b72] dark:text-slate-200">{entityName}</span>
                </p>
              )}
              {categoryPhrase && (
                <p className="text-xs leading-relaxed text-[#71879a] dark:text-slate-400">{categoryPhrase}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}