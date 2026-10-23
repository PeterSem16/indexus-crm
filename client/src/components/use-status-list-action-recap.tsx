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

export function useStatusListActionRecap({campaignId,contactId,locale,items,mode}:{
  campaignId?:string|null;contactId?:string|null;locale:string;items:any[];mode:"immediate"|"batch";
}) {
  const c=getStatusListRecapCopy(locale);
  const scope=`${campaignId||""}:${contactId||""}`;
  const scopeRef=useRef(scope);
  scopeRef.current=scope;
  const pending=useRef<{resolve:(value:boolean)=>void;scope:string;changes:ConfirmationChange[];manualActionIds:string[]}|null>(null);
  const identity=useRef(0);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(false);
  const [preview,setPreview]=useState<ConfirmationPreview|null>(null);
  const finish=(accepted:boolean)=>{
    identity.current++;
    const request=pending.current;pending.current=null;setOpen(false);
    request?.resolve(accepted && request.scope===scopeRef.current);
  };
  useEffect(()=>()=>{
    identity.current++;
    pending.current?.resolve(false);pending.current=null;
  },[]);
  useEffect(()=>{
    if(pending.current && pending.current.scope!==scope)finish(false);
  },[scope]);
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
  const confirm=async(changes:ConfirmationChange[],force=false,manualActionIds:string[]=[])=>{
    const needsPreview=force || changes.some(change=>{
      if(change.value===null || change.kind==="item" && change.value===false)return false;
      if(change.kind==="item")return items.find(item=>String(item.id)===change.id)?.previewActions===true;
      return items.some(item=>(item.questions||[]).some((q:any)=>q.id===change.id && q.previewActions===true));
    });
    if(!needsPreview)return true;
    if(!campaignId || !contactId || pending.current)return false;
    const result=new Promise<boolean>(resolve=>{pending.current={resolve,scope,changes,manualActionIds};});
    setOpen(true);void load();
    return result;
  };
  const dialog=<Dialog open={open} onOpenChange={value=>{if(!value)finish(false);}}>
    <DialogContent className={`${STATUS_LIST_DIALOG_FRAME_CLASS} sl-recap-dialog z-[10070]`} overlayClassName="z-[10060]">
      <DialogHeader>
        <div className="sl-recap-heading">
          <div className="sl-recap-mark" aria-hidden="true"><ClipboardCheck className="h-5 w-5"/></div>
          <div className="min-w-0 pt-0.5">
            <DialogTitle>{c.title}</DialogTitle>
            <DialogDescription className="mt-1">{c.help}</DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <div data-testid="status-list-action-recap" aria-busy={loading} className="sl-recap-content">
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
            return <article key={`${action.sourceLabel}:${action.id}`} className="sl-recap-action" data-condition={action.condition} data-recap-enter>
              <div className={`sl-recap-action-icon sl-recap-icon-${visual.tone}`} aria-hidden="true">
                <ActionIcon className="h-[17px] w-[17px]"/>
              </div>
              <div className="min-w-0 flex-1">
                <p className="sl-recap-source">{action.sourceLabel}{action.branch?` · ${c[action.branch]}`:""}</p>
                <h4 className="sl-recap-action-title">{statusListRecapActionLabel(action.actionType,locale)}</h4>
                {action.targetLabel && <p className="sl-recap-target"><ArrowRight className="mr-1 inline h-3 w-3 align-[-2px]"/>{action.targetLabel}{action.value!=null?` → ${String(action.value)}`:""}</p>}
                <p className={`sl-recap-condition sl-recap-condition-${conditionTone}`}>
                  <ConditionIcon className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true"/>
                  {c[action.condition]}
                </p>
              </div>
            </article>;
          })}
        </div>
        <p className="sl-recap-caution">{c.caution}</p>
      </div>
      <div className="sl-recap-footer">
        <Button variant="outline" onClick={()=>finish(false)}>{c.cancel}</Button>
        <Button data-testid="status-list-recap-confirm" className="sl-recap-primary" disabled={loading || error || !preview} onClick={()=>finish(true)}>{c.confirm}<ArrowRight className="ml-2 h-4 w-4"/></Button>
      </div>
    </DialogContent>
  </Dialog>;
  return {confirm,dialog};
}
