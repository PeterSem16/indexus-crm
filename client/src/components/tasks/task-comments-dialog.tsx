import { taskAttachmentPreviewUrl } from "./task-attachment-preview-url";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskAttachmentList, TaskAttachmentPicker, isSafeTaskAttachmentUrl } from "@/components/tasks/task-attachments";
import type { TaskAttachment } from "@shared/task-attachments";
import { normalizeAttachmentName } from "@shared/task-attachments";
import { cn } from "@/lib/utils";
import { AlertCircle, Eye, Loader2, MessageSquareText, Paperclip, RefreshCw, Send, Trash2, X } from "lucide-react";
import { TaskModalArtwork } from "./task-modal-artwork";
import "@/components/tasks/task-comments-dialog.css";

type CommentRecord = {
  id: string;
  userId?: string;
  user?: { fullName?: string; username?: string; avatarUrl?: string | null } | null;
  content?: string | null;
  createdAt: string | Date;
  metadata?: any;
};

type Props = {
  taskId: string;
  taskTitle: string;
  comments: CommentRecord[];
  currentUserId?: string;
  resolveUser?: (userId: string) => { fullName?: string; username?: string; avatarUrl?: string | null } | undefined;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onSubmit: (content: string, attachments: TaskAttachment[]) => Promise<boolean>;
  onDelete: (commentId: string) => void;
  submitting?: boolean;
  uploadKey?: string | number;
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function attachmentItems(comment: CommentRecord): TaskAttachment[] {
  const items = comment.metadata?.attachments;
  return Array.isArray(items) ? items : [];
}

export function TaskCommentsDialog({
  taskId, taskTitle, comments, currentUserId, resolveUser, loading = false, error = false,
  onRetry, onSubmit, onDelete, submitting = false, uploadKey,
}: Props) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [preview, setPreview] = useState<TaskAttachment | null>(null);

  useEffect(() => {
    setDraft("");
    setAttachments([]);
    setUploadFailed(false);
    setPreview(null);
    setOpen(false);
  }, [taskId]);

  const orderedComments = useMemo(() => [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  ), [comments]);
  const latest = orderedComments.slice(-2).reverse();
  const previewable = (attachment: TaskAttachment) => {
    const name = normalizeAttachmentName(attachment.name).toLowerCase();
    const safeUrl = isSafeTaskAttachmentUrl(attachment.url);
    return safeUrl && (
      (attachment.type.startsWith("image/") && !/\.svg$/i.test(name) && !attachment.type.includes("svg")) ||
      attachment.type === "application/pdf" || /\.pdf$/i.test(name)
    );
  };
  const timestamp = (value: string | Date, withYear = false) => new Intl.DateTimeFormat(locale, {
    day: "numeric", month: "short", ...(withYear ? { year: "numeric" as const } : {}),
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
  const submit = async () => {
    if (uploading || uploadFailed || submitting || (!draft.trim() && attachments.length === 0)) return;
    const success = await onSubmit(draft.trim(), attachments);
    if (success) {
      setDraft("");
      setAttachments([]);
      setPreview(null);
    }
  };

  return (
    <section className="task-comments-preview" aria-label={t.tasks.comments}>
      <header className="task-comments-preview__head">
        <div className="task-comments-heading">
          <span className="task-comments-heading__icon"><MessageSquareText className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3>{t.tasks.comments}</h3>
            {orderedComments.length > 0 && <p>{t.tasks.commentsActivity}</p>}
          </div>
          <Badge variant="secondary" className="task-comments-count ml-auto rounded-full px-2" aria-label={`${orderedComments.length} ${t.tasks.comments.toLowerCase()}`}>{orderedComments.length}</Badge>
        </div>
        <Button size="sm" variant="outline" className="task-comments-open" onClick={() => setOpen(true)} aria-label={t.tasks.addComment} data-testid="button-open-task-comments">
          <MessageSquareText className="mr-1.5 h-3.5 w-3.5" />
          {t.tasks.addComment}
        </Button>
      </header>
      <div className="task-comments-preview__body" aria-live="polite">
        {loading ? (
          <div className="task-comments-skeletons" aria-label={t.tasks.loadingComments}>
            <span /><span />
          </div>
        ) : error ? (
          <div className="task-comments-inline-state">
            <AlertCircle className="h-4 w-4" />
            <span>{t.tasks.commentsLoadFailed}</span>
            {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}><RefreshCw className="mr-1 h-3.5 w-3.5" />{t.tasks.commentsRetry}</Button>}
          </div>
        ) : latest.length === 0 ? (
          <div className="task-comments-preview__empty">
              <span className="task-comments-empty-mark" aria-hidden="true" />
              <div>
                <strong>{t.tasks.noComments}</strong>
                <p>{t.tasks.commentsEmptyHint}</p>
              </div>
          </div>
        ) : (
          <div className="task-comments-preview__list">
            {latest.map((comment) => {
              const user = (comment.userId && resolveUser?.(comment.userId)) || comment.user;
              const author = user?.fullName || user?.username || comment.userId || t.tasks.unknownAuthor;
              return (
                <article className="task-comment-preview-item" key={comment.id} data-testid={`task-preview-comment-${comment.id}`}>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={user?.avatarUrl || undefined} />
                    <AvatarFallback>{initials(author)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="task-comment-preview-item__byline"><strong>{author}</strong><time>{timestamp(comment.createdAt)}</time></div>
                    {comment.content ? <p>{comment.content}</p> : <p className="task-comment-attachment-only"><Paperclip className="h-3.5 w-3.5" />{t.tasks.attachmentsOnly}</p>}
                    <TaskAttachmentList attachments={attachmentItems(comment)} className="mt-2" />
                  </div>
                </article>
              );
            })}
            {orderedComments.length > 2 && <button type="button" className="task-comments-more" onClick={() => setOpen(true)} aria-label={t.tasks.viewAllComments.replace("{count}", String(orderedComments.length))}>{t.tasks.viewAllComments.replace("{count}", String(orderedComments.length))}</button>}
          </div>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            // Closing unmounts the picker, which aborts outstanding transfers.
            // Clear transient state, but keep draft text and completed uploads.
            setUploading(false);
            setUploadFailed(false);
            setPreview(null);
          }
          setOpen(nextOpen);
        }}
      >
        <DialogContent className="task-modern-modal task-comments-dialog-content" overlayClassName="task-modern-modal-overlay" hideCloseButton data-testid="dialog-task-comments">
          <TaskModalArtwork variant="comments" compact />
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" className="task-comments-dialog-close" aria-label={t.common.close} data-testid="button-close-task-comments">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
          <DialogHeader className="task-comments-dialog-header">
            <div className="task-comments-dialog-kicker"><MessageSquareText className="h-4 w-4" />{t.tasks.comments}</div>
            <DialogTitle>{t.tasks.taskDiscussion}</DialogTitle>
            <DialogDescription className="task-comments-task-title">{taskTitle}</DialogDescription>
          </DialogHeader>
            <div className="task-comments-dialog-main task-modern-modal-body">
            <ScrollArea className="task-comments-history">
              {loading ? (
                <div className="task-comments-history-skeletons"><span /><span /><span /></div>
              ) : error ? (
                <div className="task-comments-dialog-state">
                  <AlertCircle className="h-5 w-5" /><p>{t.tasks.commentsLoadFailed}</p>
                  {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />{t.tasks.commentsRetry}</Button>}
                </div>
              ) : orderedComments.length === 0 ? (
                <div className="task-comments-dialog-state task-comments-dialog-empty">
                  <span className="task-comments-empty-mark"><MessageSquareText className="h-5 w-5" /></span>
                  <strong>{t.tasks.noComments}</strong><p>{t.tasks.commentsEmptyHint}</p>
                </div>
              ) : (
                <ol className="task-comments-timeline">
                  {orderedComments.map((comment, index) => {
                    const user = (comment.userId && resolveUser?.(comment.userId)) || comment.user;
                    const author = user?.fullName || user?.username || comment.userId || t.tasks.unknownAuthor;
                    const commentAttachments = attachmentItems(comment);
                    return (
                      <li className="task-comments-timeline__item" key={comment.id} data-testid={`task-comment-${comment.id}`}>
                        <span className={cn("task-comments-timeline__rail", index === orderedComments.length - 1 && "is-last")} />
                        <Avatar className="task-comments-avatar">
                          <AvatarImage src={user?.avatarUrl || undefined} />
                          <AvatarFallback>{initials(author)}</AvatarFallback>
                        </Avatar>
                        <article className="task-comment-card">
                          <header className="task-comment-card__header">
                            <div className="min-w-0"><strong>{author}</strong><time>{timestamp(comment.createdAt, true)}</time></div>
                            {comment.userId && comment.userId === currentUserId && (
                              <Button variant="ghost" size="icon" className="task-comment-delete" onClick={() => onDelete(comment.id)} aria-label={t.tasks.deleteComment} data-testid={`delete-comment-${comment.id}`}><Trash2 className="h-4 w-4" /></Button>
                            )}
                          </header>
                          {comment.content ? <p className="task-comment-card__content">{comment.content}</p> : <p className="task-comment-attachment-only"><Paperclip className="h-3.5 w-3.5" />{t.tasks.attachmentsOnly}</p>}
                          {commentAttachments.length > 0 && (
                            <div className="task-comment-files">
                              {commentAttachments.map((attachment, fileIndex) => (
                                <div className="task-comment-file-row" key={attachment.id || `${attachment.url}-${fileIndex}`}>
                                  <TaskAttachmentList attachments={[attachment]} className="task-comment-file-download" />
                                  {previewable(attachment) && <button type="button" className="task-comment-file-open" onClick={() => setPreview(attachment)} aria-label={`${t.tasks.previewAttachment}: ${attachment.name}`} title={t.tasks.previewAttachment}><Eye className="h-4 w-4" /></button>}
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      </li>
                    );
                  })}
                </ol>
              )}
            </ScrollArea>
            {preview && (
              <div className="task-attachment-preview" role="dialog" aria-label={t.tasks.previewAttachment}>
                <div className="task-attachment-preview__bar"><span title={preview.name}>{normalizeAttachmentName(preview.name)}</span><div><TaskAttachmentList attachments={[preview]} /><Button size="icon" variant="ghost" onClick={() => setPreview(null)} aria-label={t.common.close} data-testid="button-close-task-attachment-preview"><X className="h-4 w-4" /></Button></div></div>
                {preview.type === "application/pdf" || /\.pdf$/i.test(preview.name)
                  ? <object className="task-attachment-preview__pdf" data={taskAttachmentPreviewUrl(preview.url)} type="application/pdf" aria-label={preview.name}><a href={preview.url} target="_blank" rel="noreferrer">{t.tasks.openAttachment}</a></object>
                  : <img className="task-attachment-preview__image" src={taskAttachmentPreviewUrl(preview.url)} alt={normalizeAttachmentName(preview.name)} />}
              </div>
            )}
            <form className="task-comments-composer task-modern-modal-footer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
              <TaskAttachmentPicker
                key={`${taskId}-${uploadKey ?? taskId}`}
                attachments={attachments}
                onChange={setAttachments}
                onBusyChange={setUploading}
                onErrorChange={setUploadFailed}
                disabled={submitting}
              />
              <label className="sr-only" htmlFor={`task-comment-input-${taskId}`}>{t.tasks.commentPlaceholder}</label>
              <textarea
                id={`task-comment-input-${taskId}`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }}
                placeholder={t.tasks.commentPlaceholder}
                rows={2}
                disabled={submitting}
                data-testid="input-task-comment"
              />
              <div className="task-comments-composer__footer">
                <span>{t.tasks.commentKeyboardHint}</span>
                <Button size="sm" type="submit" disabled={submitting || uploading || uploadFailed || (!draft.trim() && !attachments.length)} data-testid="button-add-comment">
                  {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                  {t.tasks.addComment}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}