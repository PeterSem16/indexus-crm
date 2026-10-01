import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { File, FileArchive, FileImage, FileSpreadsheet, FileText, Loader2, Presentation, Upload, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { normalizeAttachmentName, type TaskAttachment } from "@shared/task-attachments";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

export function getTaskAttachmentContextKey(context: {
  isOpen: boolean;
  campaignId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}): string {
  return JSON.stringify([
    context.isOpen,
    context.campaignId || "",
    context.entityType || "",
    context.entityId || "",
  ]);
}

function attachmentKind(name: string, type: string): { label: string; Icon: typeof File; color: string } {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const mime = (type || "").toLowerCase();
  if (ext === "pdf" || mime === "application/pdf") {
    return { label: "PDF", Icon: FileText, color: "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/50" };
  }
  if (
    ["doc", "docx", "odt", "rtf"].includes(ext) ||
    mime.includes("msword") ||
    mime.includes("wordprocessingml") ||
    mime === "application/vnd.oasis.opendocument.text" ||
    mime === "application/rtf"
  ) {
    return { label: ext === "docx" ? "DOCX" : "DOC", Icon: FileText, color: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50" };
  }
  if (["xls", "xlsx", "csv", "ods"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel")) {
    return { label: ext === "csv" ? "CSV" : ext === "xlsx" ? "XLSX" : "XLS", Icon: FileSpreadsheet, color: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50" };
  }
  if (["ppt", "pptx", "odp"].includes(ext) || mime.includes("presentation") || mime.includes("powerpoint")) {
    return { label: ext === "pptx" ? "PPTX" : "PPT", Icon: Presentation, color: "text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-950/50" };
  }
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"].includes(ext)) {
    return { label: "IMG", Icon: FileImage, color: "text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/50" };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || mime.includes("zip") || mime.includes("compressed")) {
    return { label: "ZIP", Icon: FileArchive, color: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50" };
  }
  return { label: ext ? ext.slice(0, 5).toUpperCase() : "FILE", Icon: File, color: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800" };
}

export function getTaskFileTypeLabel(name: string, type: string): string {
  return attachmentKind(normalizeAttachmentName(name), type).label;
}

export function TaskFileIcon({ name, type, className }: { name: string; type: string; className?: string }) {
  const displayName = normalizeAttachmentName(name);
  const { label, Icon, color } = attachmentKind(displayName, type);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[9px] font-bold leading-none", color, className)}
      aria-label={label}
      title={label}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function isSafeTaskAttachmentUrl(url: string): boolean {
  return /^\/api\/tasks\/attachments\/[^/?#]+(?:[?#].*)?$/.test(url || "") ||
    /^\/(?:data|uploads)\/[^?#]*(?:[?#].*)?$/.test(url || "");
}

export function TaskAttachmentList({ attachments, className }: { attachments: TaskAttachment[]; className?: string }) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-x-3 gap-y-1", className)}>
      {attachments.map((attachment, index) => {
        const name = normalizeAttachmentName(attachment.name);
        const safe = isSafeTaskAttachmentUrl(attachment.url);
        const content = (
          <>
            <TaskFileIcon name={name} type={attachment.type} />
            <span className="min-w-0 whitespace-normal break-all leading-snug" title={name}>{name}</span>
          </>
        );
        return safe ? (
          <a
            key={attachment.id || `${attachment.url}-${index}`}
            href={attachment.url}
            download={name}
            className="inline-flex min-w-0 max-w-full items-start gap-1.5 rounded text-xs text-foreground hover:underline"
            title={name}
            data-testid={`task-attachment-${index}`}
          >
            {content}
          </a>
        ) : (
          <span
            key={attachment.id || `${name}-${index}`}
            className="inline-flex min-w-0 max-w-full items-start gap-1.5 text-xs text-foreground"
            title={name}
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}

export function TaskAttachmentPicker({
  attachments,
  onChange,
  disabled = false,
  onBusyChange,
  onErrorChange,
}: {
  attachments: TaskAttachment[];
  onChange: (attachments: TaskAttachment[]) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onErrorChange?: (hasError: boolean) => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const attachmentsRef = useRef(attachments);
  const onChangeRef = useRef(onChange);
  const onBusyChangeRef = useRef(onBusyChange);
  const onErrorChangeRef = useRef(onErrorChange);
  const pendingCountRef = useRef(0);
  const abortControllersRef = useRef(new Set<AbortController>());

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onBusyChangeRef.current = onBusyChange;
  }, [onBusyChange]);
  useEffect(() => {
    onErrorChangeRef.current = onErrorChange;
  }, [onErrorChange]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  const uploadFile = async (file: globalThis.File) => {
    pendingCountRef.current += 1;
    onBusyChangeRef.current?.(true);
    if (mountedRef.current) setUploadingCount(pendingCountRef.current);
    const controller = new AbortController();
    abortControllersRef.current.add(controller);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/tasks/attachments", {
        method: "POST",
        body: form,
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Attachment upload failed (${response.status})`);
      const attachment = await response.json() as TaskAttachment;
      if (!attachment?.url || !attachment.name || !attachment.type) throw new Error("Invalid attachment response");
      if (!mountedRef.current) return;
      const next = [...attachmentsRef.current, attachment];
      attachmentsRef.current = next;
      onChangeRef.current(next);
    } catch {
      if (mountedRef.current) {
        setError(t.backOffice.attachmentError);
        onErrorChangeRef.current?.(true);
      }
    } finally {
      abortControllersRef.current.delete(controller);
      pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
      if (mountedRef.current) {
        setUploadingCount(pendingCountRef.current);
        if (pendingCountRef.current === 0) onBusyChangeRef.current?.(false);
      }
    }
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setError(null);
    onErrorChangeRef.current?.(false);
    let available = Math.max(0, MAX_ATTACHMENTS - attachmentsRef.current.length - pendingCountRef.current);
    const accepted: globalThis.File[] = [];
    let rejectedForSize = false;
    let rejectedForLimit = false;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        rejectedForSize = true;
      } else if (available <= 0) {
        rejectedForLimit = true;
      } else {
        accepted.push(file);
        available -= 1;
      }
    }
    if (rejectedForSize) {
      setError(t.backOffice.attachmentTooLarge);
      onErrorChangeRef.current?.(true);
    } else if (rejectedForLimit) {
      setError(t.backOffice.attachmentLimitReached);
      onErrorChangeRef.current?.(true);
    }
    accepted.forEach((file) => void uploadFile(file));
  };

  const removeAttachment = (index: number) => {
    const next = attachmentsRef.current.filter((_, currentIndex) => currentIndex !== index);
    attachmentsRef.current = next;
    onChangeRef.current(next);
  };

  return (
    <div className="space-y-2" data-testid="task-attachment-picker">
      <input ref={inputRef} type="file" multiple disabled={disabled} className="hidden" onChange={handleFiles} data-testid="input-task-attachment-files" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploadingCount > 0 || attachments.length >= MAX_ATTACHMENTS}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="button-add-task-attachment"
      >
        {uploadingCount > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploadingCount > 0 ? t.backOffice.attachmentUploading : t.backOffice.attachLabel}
      </button>
      {error && (
        <div className="task-attachment-picker-error flex items-center justify-between gap-2" role="alert" data-testid="task-attachment-error">
          <p className="text-xs text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              onErrorChangeRef.current?.(false);
            }}
            className="task-attachment-picker-error__dismiss inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted"
            aria-label={t.tasks.dismissUploadError}
            title={t.tasks.dismissUploadError}
            data-testid="button-dismiss-task-attachment-error"
          >
            <X className="h-3.5 w-3.5" />
            <span>{t.tasks.dismissUploadError}</span>
          </button>
        </div>
      )}
      {!!attachments.length && (
          <div className="task-attachment-chips flex flex-wrap gap-1.5">
          {attachments.map((attachment, index) => {
            const name = normalizeAttachmentName(attachment.name);
            return (
              <span
                key={attachment.id || `${attachment.url}-${index}`}
                className="inline-flex min-w-0 max-w-full items-start gap-1 rounded-md border bg-muted/40 px-1.5 py-1 text-[11px]"
                data-testid={`chip-task-attachment-${index}`}
              >
                <TaskFileIcon name={name} type={attachment.type} />
                <span className="min-w-0 whitespace-normal break-all" title={name}>{name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  disabled={disabled}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  aria-label={`${t.common.delete}: ${name}`}
                  data-testid={`button-remove-task-attachment-${index}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}