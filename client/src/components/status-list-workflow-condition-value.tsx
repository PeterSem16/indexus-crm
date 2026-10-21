import { useEffect, useRef, useState } from "react";
import { COMMUNICATION_CHOICE_VALUES } from "@shared/automation-condition-catalog";
import { getStatusListWorkflowCopy } from "./status-list-workflow-copy";
import { getStatusListWorkflowConditionCopy } from "./status-list-workflow-condition-copy";
import { getUpdateRecordCopy } from "@/i18n/automation-update-record-copy";
import "./status-list-workflow-dialog.css";

type ConditionField = "status" | "contact_type" | "clinic_id" | "hospital_id" | "representative_assignment_type";
type ReferenceOption = { value: string; label: string };
type ReferenceResponse = { options: ReferenceOption[]; truncated: boolean };

const statusValues = ["pending", "contacted", "completed", "failed", "no_answer", "callback_scheduled", "not_interested"] as const;
const assignmentValues = ["manual", "bulk_region", "bulk_district", "swap", "import"] as const;

export function StatusListWorkflowConditionValue({ field, campaignId, locale, value, onChange, testId }: {
  field: ConditionField;
  campaignId: string;
  locale: string;
  value: unknown;
  onChange: (value: string | undefined) => void;
  testId: string;
}) {
  const copy = getStatusListWorkflowConditionCopy(locale);
  const workflowCopy = getStatusListWorkflowCopy(locale);
  const current = typeof value === "string" ? value : "";
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [savedLabels, setSavedLabels] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState(0);
  const sequence = useRef(0);
  const isReference = field === "clinic_id" || field === "hospital_id";
  const enumValues: readonly string[] = field === "contact_type" ? COMMUNICATION_CHOICE_VALUES.contactType
    : field === "representative_assignment_type" ? assignmentValues : statusValues;

  useEffect(() => {
    if (!isReference) return;
    const requestId = ++sequence.current;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setOptions([]);
    setTruncated(false);
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ field, q: search });
      if (current) params.set("value", current);
      try {
        const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/status-list-workflows/condition-options?${params}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const result = await response.json() as ReferenceResponse;
        if (controller.signal.aborted || sequence.current !== requestId) return;
        if (!Array.isArray(result.options) || result.options.some(option =>
          typeof option?.value !== "string" || typeof option?.label !== "string")) throw new Error("options");
        setOptions(result.options);
        setTruncated(Boolean(result.truncated));
        setSavedLabels(previous => ({ ...previous, ...Object.fromEntries(result.options.map(option => [
          `${campaignId}:${field}:${option.value}`, option.label,
        ])) }));
        setError(false);
      } catch {
        if (controller.signal.aborted || sequence.current !== requestId) return;
        setOptions([]);
        setError(true);
      } finally {
        if (!controller.signal.aborted && sequence.current === requestId) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [campaignId, field, search, current, retry, isReference]);

  if (!isReference) {
    const known = enumValues.includes(current);
    return <label className="wf-field">
      <span>{workflowCopy.value}</span>
      <select data-testid={testId} value={current} onChange={event => onChange(event.target.value || undefined)}>
        {!current && <option value="">{copy.choose}</option>}
        {!known && current && <option value={current}>{copy.savedValue.replace("{value}", current)}</option>}
        {enumValues.map(option => <option key={option} value={option}>{copy[option as keyof typeof copy] || option}</option>)}
      </select>
    </label>;
  }

  return <div className="wf-field condition-reference-value">
    <span>{workflowCopy.value}</span>
    <input
      data-testid={`${testId}-search`}
      type="search"
      value={search}
      placeholder={copy.search}
      aria-label={copy.search}
      onChange={event => setSearch(event.target.value)}
    />
    <select aria-label={workflowCopy.value} data-testid={testId} value={current} onChange={event => onChange(event.target.value || undefined)} disabled={loading || error}>
      {!current && <option value="">{copy.choose}</option>}
      {current && !options.some(option => option.value === current) && <option value={current}>{
        savedLabels[`${campaignId}:${field}:${current}`] || copy.savedValue.replace("{value}", current)
      }</option>}
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {loading && <small role="status">{copy.loading}</small>}
    {error && <div className="condition-reference-error subtle-note" role="alert"><span>{copy.loadError}</span><button type="button" className="text-button" data-testid={`${testId}-retry`} onClick={() => setRetry(attempt => attempt + 1)}>{copy.retry}</button></div>}
    {!loading && !error && (search.trim()
      ? !options.some(option => [option.label, option.value].some(text => text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
      : !options.length) && <small role="status">{search.trim() ? copy.noResults : copy.searchHint}</small>}
    {!loading && !error && truncated && <small role="status">{getUpdateRecordCopy(locale).truncated}</small>}
  </div>;
}
