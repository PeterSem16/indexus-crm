import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Search, UserRound, Users, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskModalArtwork } from "./task-modal-artwork";
import { useTaskReassignTargets } from "./use-task-reassign-targets";
import { matchesReassignSearch, reassignPayload, type TaskReassignPayload } from "./task-reassign-dialog.helpers";
import "./task-reassign-dialog.css";

export type TaskReassignDialogProps = {
  open: boolean;
  taskId: string | null;
  taskTitle: string;
  assignedUserId?: string | null;
  taskGroupId?: string | null;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (taskId: string, payload: TaskReassignPayload) => Promise<boolean>;
};

export function TaskReassignDialog({
  open, taskId, taskTitle, assignedUserId, taskGroupId, submitting = false, onOpenChange, onConfirm,
}: TaskReassignDialogProps) {
  const { t } = useI18n();
  const copy = t.tasks.reassignDialog;
  const [kind, setKind] = useState<"user" | "group">("user");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirmingRef = useRef(false);
  const scopeRef = useRef({ open, taskId });
  scopeRef.current = { open, taskId };
  const inputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const radioName = useId();
  const targets = useTaskReassignTargets(taskId, open);
  const busy = submitting || confirming;

  useEffect(() => {
    setKind("user");
    setSearch("");
    setSelectedId("");
    setFailed(false);
  }, [open, taskId]);

  const users = useMemo(() => (targets.data?.users || []).filter(user => !!user.id && user.id !== assignedUserId), [targets.data, assignedUserId]);
  const groups = useMemo(() => (targets.data?.groups || []).filter(group => !!group.id), [targets.data]);
  const filteredUsers = useMemo(() => users.filter(user => matchesReassignSearch(search, user.fullName, user.username, user.email)), [users, search]);
  const filteredGroups = useMemo(() => groups.filter(group => matchesReassignSearch(search, group.name, group.description)), [groups, search]);
  const selected = kind === "user" ? users.find(user => user.id === selectedId) : groups.find(group => group.id === selectedId);
  const selectedName = selected ? ("name" in selected ? selected.name : selected.fullName || selected.username || selected.email || copy.unnamedUser) : "";
  const loading = targets.isPending || targets.isFetching;
  const canConfirm = !!taskId && !!selected && !(kind === "group" && selectedId === taskGroupId) && !busy && !loading && !targets.isError;
  const visibleCount = kind === "user" ? filteredUsers.length : filteredGroups.length;
  const availableCount = kind === "user" ? users.length : groups.length;

  const chooseKind = (next: "user" | "group") => {
    if (busy || next === kind) return;
    setKind(next);
    setSelectedId("");
    setSearch("");
    setFailed(false);
    inputRef.current?.focus();
  };
  const confirm = async () => {
    const payload = reassignPayload(kind, selectedId);
    if (!canConfirm || !taskId || !payload || confirmingRef.current) return;
    const currentId = taskId;
    confirmingRef.current = true;
    setConfirming(true);
    setFailed(false);
    try {
      const success = await onConfirm(currentId, payload);
      if (scopeRef.current.open && scopeRef.current.taskId === currentId) {
        if (success) onOpenChange(false);
        else {
          setFailed(true);
          void targets.refetch();
        }
      }
    } catch {
      if (scopeRef.current.open && scopeRef.current.taskId === currentId) setFailed(true);
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
      <DialogContent
        className="task-modern-modal task-modern-modal--nested task-reassign-dialog"
        overlayClassName="task-modern-modal-overlay task-modern-modal-overlay--nested"
        hideCloseButton
        data-testid="dialog-reassign-task"
        onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus(); }}
        onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
        onPointerDownOutside={event => { if (busy) event.preventDefault(); }}
      >
        <button type="button" className="task-reassign-close" disabled={busy} aria-label={t.common.close} onClick={() => onOpenChange(false)} data-testid="reassign-close"><X className="h-4 w-4" /></button>
        <div className="task-reassign-heading">
          <TaskModalArtwork variant="assign" compact />
          <DialogHeader className="min-w-0 text-left">
            <DialogTitle>{t.tasks.reassignTask}</DialogTitle>
            <DialogDescription className="text-xs">{copy.description}</DialogDescription>
            <p className="task-reassign-context" data-testid="reassign-task-title">{taskTitle}</p>
          </DialogHeader>
        </div>
        <div className="task-modern-modal-body task-reassign-body">
          <div className="task-reassign-modes" role="group" aria-label={t.tasks.reassignTo}>
            <button type="button" aria-pressed={kind === "user"} disabled={busy} onClick={() => chooseKind("user")} data-testid="reassign-mode-user"><UserRound className="h-4 w-4" />{copy.user}</button>
            <button type="button" aria-pressed={kind === "group"} disabled={busy} onClick={() => chooseKind("group")} data-testid="reassign-mode-group"><Users className="h-4 w-4" />{copy.group}</button>
          </div>
          <div className="task-reassign-search">
            <label htmlFor={searchId} className="sr-only">{kind === "user" ? copy.searchUsers : copy.searchGroups}</label>
            <Search className="h-4 w-4" aria-hidden="true" />
            <Input id={searchId} ref={inputRef} value={search} disabled={busy || !taskId} onChange={event => setSearch(event.target.value)} placeholder={kind === "user" ? copy.searchUsers : copy.searchGroups} autoComplete="off" data-testid="reassign-search" />
            {search && <button type="button" className="task-reassign-search-clear" aria-label={copy.clearSearch} disabled={busy} onClick={() => { setSearch(""); inputRef.current?.focus(); }} data-testid="reassign-clear-search"><X className="h-4 w-4" /></button>}
          </div>
          <p className="task-reassign-hint">{kind === "user" ? copy.userHint : copy.groupHint}</p>
          <div className="task-reassign-targets" role="radiogroup" aria-label={kind === "user" ? copy.user : copy.group} aria-busy={!!taskId && loading} data-testid="reassign-targets">
            {!taskId ? <div className="task-reassign-state" role="alert">{t.tasks.loadError}</div>
              : loading ? <div className="space-y-2" role="status" aria-label={copy.loading} data-testid="reassign-loading">{[0, 1, 2].map(index => <div key={index} className="task-reassign-skeleton" />)}<span className="sr-only">{copy.loading}</span></div>
              : targets.isError ? <div className="task-reassign-state" role="alert" data-testid="reassign-load-error"><Users className="h-7 w-7" /><p>{copy.loadError}</p><Button type="button" variant="outline" onClick={() => void targets.refetch()} data-testid="reassign-retry">{copy.retry}</Button></div>
              : !visibleCount ? <div className="task-reassign-state" role="status" data-testid={availableCount ? "reassign-no-results" : "reassign-empty"}><Search className="h-7 w-7" /><p>{availableCount ? copy.noResults : kind === "user" ? copy.noUsers : copy.noGroups}</p>{availableCount > 0 && <Button type="button" variant="ghost" onClick={() => { setSearch(""); inputRef.current?.focus(); }}>{copy.clearSearch}</Button>}</div>
              : kind === "user" ? filteredUsers.map(user => {
                const name = user.fullName || user.username || user.email || copy.unnamedUser;
                return <label key={user.id} className="task-reassign-target" data-testid={`reassign-user-${user.id}`}>
                  <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={user.avatarUrl || undefined} alt="" /><AvatarFallback className="bg-primary/10 text-primary text-xs">{name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase()}</AvatarFallback></Avatar>
                  <span className="task-reassign-target-copy"><span className="task-reassign-target-name">{name}</span><span className="task-reassign-target-description">{user.email}</span></span>
                  <input type="radio" name={radioName} value={user.id} checked={selectedId === user.id} disabled={busy} onChange={() => { setSelectedId(user.id); setFailed(false); }} aria-label={[name, user.email].filter(Boolean).join(", ")} />
                </label>;
              }) : filteredGroups.map(group => <label key={group.id} className="task-reassign-target" data-testid={`reassign-group-${group.id}`}>
                <span className="task-reassign-group-icon"><Users className="h-4 w-4" /></span>
                <span className="task-reassign-target-copy"><span className="task-reassign-target-name">{group.name}</span>{group.id === taskGroupId && <span className="task-reassign-target-description">{copy.currentGroup}</span>}{group.description && <span className="task-reassign-target-description">{group.description}</span>}{typeof group.memberCount === "number" && <span className="task-reassign-target-description">{copy.memberCount.replace("{count}", String(group.memberCount))}</span>}</span>
                <input type="radio" name={radioName} value={group.id} checked={selectedId === group.id} disabled={busy || group.id === taskGroupId} onChange={() => { setSelectedId(group.id); setFailed(false); }} aria-label={[group.name, group.id === taskGroupId ? copy.currentGroup : ""].filter(Boolean).join(", ")} />
              </label>)}
          </div>
          {failed && <p className="task-reassign-error" role="alert" data-testid="reassign-save-error">{t.tasks.reassignFailed}</p>}
        </div>
        <div className="task-reassign-summary" aria-live="polite" data-testid="reassign-summary">
          {selected ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          <div className="min-w-0"><div className="task-reassign-summary-label">{selected ? (kind === "user" ? copy.selectedUser : copy.selectedGroup) : copy.chooseTarget}</div>{selected && <div className="task-reassign-summary-value">{selectedName}</div>}</div>
        </div>
        <div className="task-reassign-actions">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)} data-testid="reassign-cancel">{t.common.cancel}</Button>
          <Button type="button" disabled={!canConfirm} onClick={() => void confirm()} data-testid="reassign-confirm"><ArrowRight className="h-4 w-4 mr-2" />{busy ? copy.saving : t.tasks.reassign}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}