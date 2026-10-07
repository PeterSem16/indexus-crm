import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { taskChecklistItems, taskChecklistText } from "@/lib/automation-task-checklist";

export function AutomationTaskChecklistEditor({
  checklist, onChange, label, testId,
}: {
  checklist: unknown;
  onChange: (items: string[]) => void;
  label: string;
  testId: string;
}) {
  const [draft, setDraft] = useState(() => taskChecklistText(checklist));
  const ownValue = useRef(checklist);
  useEffect(() => {
    // Parent echoes of this input must not remove a freshly typed newline.
    // A different external value (e.g. a JSON edit) must still reset the input.
    if (checklist !== ownValue.current) {
      ownValue.current = checklist;
      setDraft(taskChecklistText(checklist));
    }
  }, [checklist]);
  return <Textarea rows={3} aria-label={label} data-testid={testId} value={draft}
    onChange={event => {
      const text = event.target.value;
      const items = taskChecklistItems(text);
      ownValue.current = items;
      setDraft(text);
      onChange(items);
    }} />;
}
