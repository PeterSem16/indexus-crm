import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ContactRound,
  ListTodo,
  Mail,
  MessageSquare,
  StickyNote,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { apiRequest } from "@/lib/queryClient";
import type { ConfirmationChange, ConfirmationPreview } from "@shared/status-list-confirmation-preview";
import { getStatusListRecapCopy, statusListRecapActionLabel } from "./status-list-recap-copy";
import { STATUS_LIST_DIALOG_FRAME_CLASS } from "./status-list-dialog-frame";
import "./status-list-action-recap.css";
import { StatusListCallbackRescheduleFields } from "./status-list-callback-reschedule-fields";
import { StatusListRecapNavigation } from "./status-list-recap-navigation";
import { resolveStatusListDestination, statusListConfirmationDestinations } from "@/lib/status-list-navigation";

type CallbackDetail = {callbackDate?:string;callbackNote?:string};
type CallbackEditor = {actionId:string;onChange:(detail:CallbackDetail)=>void};

function getActionVisual(actionType: string) {
  if (/email/.test(actionType)) return { Icon: Mail, tone: "email" };
  if (/sms/.test(actionType)) return { Icon: MessageSquare, tone: "sms" };
  if (/task/.test(actionType)) return { Icon: ListTodo, tone: "task" };
  if (/callback/.test(actionType)) return { Icon: CalendarClock, tone: "callback" };
  if (/note/.test(actionType)) return { Icon: StickyNote, tone: "note" };
  if (/answer|selection|confirm_step/.test(actionType)) return { Icon: ClipboardCheck, tone: "answer" };
  if (/notif/.test(actionType)) return { Icon: Bell, tone: "notify" };
  if (/record|status|owner|tag|assign/.test(actionType)) return { Icon: ContactRound, tone: "record" };
  return { Icon: ClipboardList, tone: "default" };
}

function formatCallbackPreviewDateTime(value: string, locale: string) {
  const wallTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const date = wallTime
    ? new Date(Date.UTC(Number(wallTime[1]), Number(wallTime[2]) - 1, Number(wallTime[3]), Number(wallTime[4]), Number(wallTime[5])))
    : new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    ...(wallTime ? { timeZone: "UTC" } : { timeZone: "Europe/Bratislava" }),
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
}

export function useStatusListActionRecap({campaignId,contactId,locale,items,mode,onNavigate}:{
  campaignId?:string|null;contactId?:string|null;locale:string;items:any[];mode:"immediate"|"batch";
  onNavigate?:(stepId:string)=>void;
}) {
  const c=getStatusListRecapCopy(locale);
  const scope=`${campaignId||""}:${contactId||""}`;
  const scopeRef=useRef(scope);
  scopeRef.current=scope;
  const pending=useRef<{
    resolve:(value:boolean)=>void;scope:string;changes:ConfirmationChange[];manualActionIds:string[];
    manualActionDetails:Record<string,CallbackDetail>;callbackEditor?:CallbackEditor;
    destinations:ReturnType<typeof statusListConfirmationDestinations>;
  }|null>(null);
  const acceptedNavigation=useRef<{scope:string;destinations:ReturnType<typeof statusListConfirmationDestinations>}|null>(null);
  const identity=useRef(0);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(false);
  const [preview,setPreview]=useState<ConfirmationPreview|null>(null);
  const finish=(accepted:boolean)=>{
    identity.current++;
    const request=pending.current;pending.current=null;setOpen(false);
    acceptedNavigation.current=accepted && request?.scope===scopeRef.current
      ? {scope:request.scope,destinations:request.destinations} : null;
    request?.resolve(accepted && request.scope===scopeRef.current);
  };
  useEffect(()=>()=>{
    identity.current++;
    pending.current?.resolve(false);pending.current=null;
  },[]);
  useEffect(()=>{
    if(pending.current && pending.current.scope!==scope)finish(false);
    acceptedNavigation.current=null;
  },[scope]);
  const complete=()=>{
    const accepted=acceptedNavigation.current;
    acceptedNavigation.current=null;
    if(!accepted || accepted.scope!==scopeRef.current || !onNavigate)return false;
    const destination=accepted.destinations.find(row=>row.available);
    if(!destination || !resolveStatusListDestination(items,destination.stepId))return false;
    onNavigate(destination.stepId);
    return true;
  };
  const load=async()=>{
    const request=pending.current;
    if(!request || !campaignId || !contactId)return;
    const token=++identity.current;
    setLoading(true);setError(false);setPreview(null);
    try {
      const response=await apiRequest("POST",`/api/campaigns/${campaignId}/contacts/${contactId}/status-list-workflows/confirmation-preview`,
        {changes:request.changes,manualActionIds:request.manualActionIds});
      const plan=await response.json() as ConfirmationPreview;
      if(token!==identity.current || request.scope!==scopeRef.current)return;
      if(plan.readOnly!==true || !Array.isArray(plan.actions))throw Error("invalid_preview");
      setPreview(plan);
    }catch{if(token===identity.current)setError(true);}
    finally{if(token===identity.current)setLoading(false);}
  };
  const confirm=async(changes:ConfirmationChange[],force=false,manualActionIds:string[]=[],
    manualActionDetails:Record<string,CallbackDetail>={},callbackEditor?:CallbackEditor)=>{
    const destinations=statusListConfirmationDestinations(items,changes);
    const needsPreview=force || destinations.length>0 || changes.some(change=>{
      if(change.value===null || change.kind==="item" && change.value===false)return false;
      if(change.kind==="item") {
        const item=items.find(item=>String(item.id)===change.id);
        return item?.previewActions===true || (item?.automations || []).length>0;
      }
      return items.some(item=>(item.questions||[]).some((q:any)=>q.id===change.id && (q.previewActions===true || (q.automations || []).length>0)));
    });
    if(!needsPreview){acceptedNavigation.current=null;return true;}
    if(!campaignId || !contactId || pending.current)return false;
    acceptedNavigation.current=null;
    const result=new Promise<boolean>(resolve=>{pending.current={resolve,scope,changes,manualActionIds,manualActionDetails,callbackEditor,destinations};});
    setOpen(true);void load();
    return result;
  };
  /** A server-built coordinator proposal uses the exact same action recap.
   * Its confirmation endpoint independently revalidates the reviewed fingerprint.
   */
  const confirmPrepared = (plan: ConfirmationPreview) => {
    if (!campaignId || !contactId || pending.current || plan.readOnly !== true) return Promise.resolve(false);
    acceptedNavigation.current = null;
    const result = new Promise<boolean>(resolve => {
      pending.current = { resolve,scope,changes:[],manualActionIds:[],manualActionDetails:{},destinations:[] };
    });
    setPreview(plan);setLoading(false);setError(false);setOpen(true);
    return result;
  };
  const dialog=<Dialog open={open} onOpenChange={value=>{if(!value)finish(false);}}>
    <DialogContent className={`${STATUS_LIST_DIALOG_FRAME_CLASS} sl-recap-dialog z-[10070]`} overlayClassName="z-[10060]">
      <DialogHeader className="sl-recap-header">
        <div className="sl-recap-heading">
          <div className="sl-recap-mark" aria-hidden="true"><ClipboardCheck className="h-5 w-5"/></div>
          <div className="min-w-0 pt-0.5">
            <DialogTitle className="sl-recap-title">{c.title}</DialogTitle>
            <DialogDescription className="sl-recap-description mt-1">{c.help}</DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <div data-testid="status-list-action-recap" aria-busy={loading} className="sl-recap-content">
        {preview && (() => {
          const keyActions=preview.actions.filter(action=>/callback|task/.test(action.actionType) || pending.current?.manualActionDetails[action.id]?.callbackDate);
          if(!keyActions.length)return null;
          return <section data-testid="status-list-recap-action-summary" className="mb-3 rounded-xl border border-[#c7dbe9] bg-gradient-to-r from-[#eaf3fb] to-[#f3f8fc] px-3 py-2.5 text-sm text-[#1d3d5a] dark:border-sky-900 dark:from-slate-900 dark:to-slate-900">
            <p className="mb-1 text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7891a5]">{c.summaryOverview}</p>
            {keyActions.map(action=>{
              const isCallback=/callback/.test(action.actionType) || !!pending.current?.manualActionDetails[action.id]?.callbackDate;
              const proposedDate=action.keptExistingCallback ? action.callbackDate :
                pending.current?.manualActionDetails[action.id]?.callbackDate ?? action.callbackDate;
              return <p key={action.id} className="truncate text-xs leading-5">
                <strong>{isCallback ? action.keptExistingCallback?c.callbackKept:c.callbackWhen :
                  `${statusListRecapActionLabel(action.actionType,locale)} · ${c.taskFor}`}:</strong>{" "}
                {isCallback
                  ? proposedDate?formatCallbackPreviewDateTime(proposedDate,locale):c.callbackWhen
                  : action.targetLabel || c.taskTargetUnknown}
              </p>;
            })}
          </section>;
        })()}
        <div className="sl-recap-list">
          {loading && (
            <div role="status" className="space-y-3" aria-label={c.loading}>
              <p className="sr-only">{c.loading}</p>
              {[0, 1].map((row) => (
                <div key={row} className="flex items-center gap-3 rounded-[15px] border border-border/60 bg-card p-3">
                  <div className="h-[34px] w-[34px] shrink-0 animate-pulse rounded-[11px] bg-muted/80 motion-reduce:animate-none"/>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-muted motion-reduce:animate-none"/>
                    <div className="h-3.5 w-3/5 animate-pulse rounded-full bg-muted/80 motion-reduce:animate-none"/>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && (
            <div role="alert" className="sl-recap-notice">
              <p>{c.error}</p>
              <Button size="sm" variant="outline" className="mt-3 rounded-lg" onClick={()=>void load()}>{c.retry}</Button>
            </div>
          )}
          {preview && !preview.actions.length && <p className="sl-recap-notice">{c.empty}</p>}
          {preview?.actions.map(action=>{
            const ConditionIcon=action.condition==="matched"?CheckCircle2:action.condition==="not_matched"?XCircle:AlertTriangle;
            const visual=getActionVisual(action.actionType);
            const ActionIcon=visual.Icon;
            const conditionTone=action.condition==="matched"?"matched":action.condition==="blocked"?"blocked":action.condition==="not_matched"?"skipped":"unknown";
            const override=pending.current?.manualActionDetails[action.id];
            const manualDetail=action.keptExistingCallback ? action :
              {callbackDate:override?.callbackDate ?? action.callbackDate,callbackNote:override?.callbackNote ?? action.callbackNote};
            const editable=!action.keptExistingCallback && pending.current?.callbackEditor?.actionId===action.id;
            const changeCallback=(detail:CallbackDetail)=>{
              const request=pending.current;
              if(!request || request.scope!==scopeRef.current)return;
              const updated={...request.manualActionDetails[action.id],...detail};
              request.manualActionDetails[action.id]=updated;
              request.callbackEditor?.onChange(updated);
              setPreview(current=>current?{...current}:current);
            };
            return <article key={`${action.sourceLabel}:${action.id}`} className="sl-recap-action" data-condition={action.condition} data-recap-enter>
              <div className={`sl-recap-action-icon sl-recap-icon-${visual.tone}`} aria-hidden="true">
                <ActionIcon className="h-[17px] w-[17px]"/>
              </div>
              <div className="min-w-0 flex-1">
                <p className="sl-recap-source">{action.sourceLabel}{action.branch?` · ${c[action.branch]}`:""}</p>
                <h4 className="sl-recap-action-title">{statusListRecapActionLabel(action.actionType,locale)}</h4>
                {/task/.test(action.actionType)
                  ? <p className="sl-recap-target" data-testid="status-list-recap-task-target"><strong>{c.taskFor}: </strong>{action.targetLabel || c.taskTargetUnknown}</p>
                  : action.targetLabel && <p className="sl-recap-target"><ArrowRight className="mr-1 inline h-3 w-3 align-[-2px]"/>{action.targetLabel}{action.value!=null?` → ${String(action.value)}`:""}</p>}
                {(manualDetail?.callbackDate || editable) && (
                  <div className="sl-recap-callback-detail" data-testid="status-list-recap-callback-date">
                    <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true"/>
                    <div className="min-w-0">
                      <span>{action.keptExistingCallback?c.callbackKept:c.callbackWhen}</span>
                      <strong>{manualDetail.callbackDate && formatCallbackPreviewDateTime(manualDetail.callbackDate,locale)}</strong>
                      {manualDetail.callbackNote?.trim() && <small><b>{c.callbackNote}:</b> {manualDetail.callbackNote.trim()}</small>}
                    </div>
                  </div>
                )}
                {editable && <div className="mt-3 space-y-2" data-testid="status-list-recap-callback-editor">
                  <StatusListCallbackRescheduleFields
                    value={manualDetail.callbackDate || ""}
                    onChange={callbackDate=>changeCallback({callbackDate})}
                    locale={locale}
                    copy={{
                      newDate:c.rescheduleNewDate,time:c.rescheduleTime,time24Hour:c.reschedule24Hour,
                      previousWeekday:c.reschedulePreviousWeekday,nextWeekday:c.rescheduleNextWeekday,
                    }}
                    testId={`status-list-recap-callback-${action.id}`}
                  />
                  <textarea aria-label={c.callbackNote} placeholder={c.callbackNote} value={manualDetail.callbackNote || ""}
                    onChange={event=>changeCallback({callbackNote:event.target.value})}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" rows={2}/>
                </div>}
                <p className={`sl-recap-condition sl-recap-condition-${conditionTone}`}>
                  <ConditionIcon className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true"/>
                  {c[action.condition]}
                </p>
              </div>
            </article>;
          })}
        </div>
        <p className="sl-recap-caution">{c.caution}</p>
        {!loading && !error && preview && <StatusListRecapNavigation destinations={pending.current?.destinations || []} locale={locale}/>}
      </div>
      <div className="sl-recap-footer">
        <Button variant="outline" onClick={()=>finish(false)}>{c.cancel}</Button>
        <Button data-testid="status-list-recap-confirm" className="sl-recap-primary" disabled={loading || error || !preview || !!pending.current?.callbackEditor && !pending.current.manualActionDetails[pending.current.callbackEditor.actionId]?.callbackDate} onClick={()=>finish(true)}>{c.confirm}<ArrowRight className="ml-2 h-4 w-4"/></Button>
      </div>
    </DialogContent>
  </Dialog>;
  return {confirm,dialog,complete,confirmPrepared};
}
