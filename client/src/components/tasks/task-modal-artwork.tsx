import { Check, ClipboardList, FileText, MessageSquareText, Pencil, Plus, Sparkles, Trash2, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./task-modal-modern.css";

export type TaskModalArtworkVariant =
  | "create"
  | "edit"
  | "assign"
  | "resolve"
  | "groups"
  | "comments"
  | "delete"
  | "detail";

const marks: Record<TaskModalArtworkVariant, LucideIcon> = {
  create: Plus,
  edit: Pencil,
  assign: UserRound,
  resolve: Check,
  groups: Users,
  comments: MessageSquareText,
  delete: Trash2,
  detail: ClipboardList,
};

export function TaskModalArtwork({
  variant,
  compact = false,
}: {
  variant: TaskModalArtworkVariant;
  compact?: boolean;
}) {
  const Mark = marks[variant];
  return (
    <div
      className={`task-modal-artwork task-modal-artwork--${variant}${compact ? " task-modal-artwork--compact" : ""}`}
      aria-hidden="true"
    >
      <span className="task-modal-artwork__orbit task-modal-artwork__orbit--one" />
      <span className="task-modal-artwork__orbit task-modal-artwork__orbit--two" />
      <span className="task-modal-artwork__chip task-modal-artwork__chip--left"><Sparkles /></span>
      <span className="task-modal-artwork__chip task-modal-artwork__chip--right"><Check /></span>
      <div className="task-modal-artwork__sheet">
        <FileText className="task-modal-artwork__sheet-mark" />
        <span className="task-modal-artwork__line" />
        <span className="task-modal-artwork__line task-modal-artwork__line--short" />
        <span className="task-modal-artwork__line" />
        <span className="task-modal-artwork__seal"><Mark /></span>
      </div>
      <span className="task-modal-artwork__confetti task-modal-artwork__confetti--one" />
      <span className="task-modal-artwork__confetti task-modal-artwork__confetti--two" />
    </div>
  );
}

export default TaskModalArtwork;