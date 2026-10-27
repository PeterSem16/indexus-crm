import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CircleCheck, CircleHelp, Info, UserRoundX, X } from "lucide-react";
import type { StatusListRepresentativeInformation } from "@shared/status-list-representative-information";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { getRepresentativeCheckCopy } from "@/i18n/status-list-representative-check-copy";
import "./status-list-representative-information.css";
import { getRepresentativeNoticeCopy } from "./status-list-representative-notice-copy";

export function StatusListRepresentativeInformationPanel({
  information,
  locale,
  onReview,
  busy = false,
  scopeKey,
}: {
  information: StatusListRepresentativeInformation[];
  locale: string;
  onReview?: (questionId: string) => void;
  busy?: boolean;
  scopeKey?: string;
}) {
  const { t } = useI18n();
  const copy = t.statusListRepresentativeInformation;
  const checkCopy = getRepresentativeCheckCopy(locale);
  const noticeCopy = getRepresentativeNoticeCopy(locale);
  const signature = useMemo(
    () =>
      JSON.stringify([
        scopeKey ?? "unspecified-scope",
        information.map((entry) => [
          entry.questionId,
          entry.state,
          entry.representativeName?.trim() ?? "",
          entry.actionState ?? "",
          entry.batchDeferred ?? false,
        ]),
      ]),
    [information, scopeKey],
  );
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);

  useEffect(() => {
    setDismissedSignature((current) => (current === signature ? current : null));
  }, [signature]);

  if (!information.length) return null;
  const isDismissed = dismissedSignature === signature;

  return (
    <section
      className={`representative-notice mx-3 mt-2 ${isDismissed ? "representative-notice--collapsed" : ""}`}
      data-testid="status-list-representative-information"
      aria-label={noticeCopy.notice}
      lang={locale}
    >
      {isDismissed ? (
        <button
          type="button"
          className="representative-notice__restore"
          aria-label={noticeCopy.restore}
          onClick={() => setDismissedSignature(null)}
        >
          <Info aria-hidden="true" className="h-3.5 w-3.5" />
          <span>{noticeCopy.notice}</span>
          <ChevronDown aria-hidden="true" className="ml-auto h-3.5 w-3.5" />
        </button>
      ) : (
        <>
          <div className="representative-notice__heading">
            <Info aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>{noticeCopy.notice}</span>
            <button
              type="button"
              className="representative-notice__close"
              aria-label={noticeCopy.dismiss}
              title={noticeCopy.dismiss}
              onClick={() => setDismissedSignature(signature)}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="representative-notice__entries">
            {information.map((entry) => {
              const representativeName = entry.representativeName?.trim();
              const assigned = entry.state === "assigned";
              const unassigned = entry.state === "unassigned";

              return (
                <div
                  key={entry.questionId}
                  className={`representative-notice__entry ${
                    unassigned
                      ? "representative-notice__entry--unassigned"
                      : assigned
                        ? "representative-notice__entry--assigned"
                        : "representative-notice__entry--unknown"
                  }`}
                  role="status"
                  data-state={entry.state}
                  data-question-id={entry.questionId}
                >
                  <span className="representative-notice__icon" aria-hidden="true">
                    {assigned ? (
                      <CircleCheck className="h-3.5 w-3.5" />
                    ) : unassigned ? (
                      <UserRoundX className="h-3.5 w-3.5" />
                    ) : (
                      <CircleHelp className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="representative-notice__message">
                      {assigned ? (
                        <>
                          {copy.assigned}{" "}
                          <strong>{representativeName || copy.unnamed}</strong>
                        </>
                      ) : unassigned ? (
                        <span className="font-medium">{copy.unassigned}</span>
                      ) : (
                        <span>{copy.unknown}</span>
                      )}
                    </p>
                    {entry.label && (
                      <p className="representative-notice__label" title={entry.label}>
                        {entry.label}
                      </p>
                    )}
                    {entry.actionState && entry.actionState !== "available" && entry.actionState !== "none" && (
                      <p className="representative-notice__status" data-testid={`representative-action-status-${entry.actionState}`}>
                        {entry.batchDeferred ? checkCopy.batchPending : checkCopy.actionStatus[entry.actionState]}
                      </p>
                    )}
                    {entry.actionState === "available" && onReview && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="representative-notice__review"
                        disabled={busy}
                        onClick={() => onReview(entry.questionId)}
                      >
                        {checkCopy.reviewActions}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
