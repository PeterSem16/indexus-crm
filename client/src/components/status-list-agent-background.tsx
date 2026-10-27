import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PhoneCall, ClipboardCheck } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { healthcarePolicySchema, healthcareSubstatuses, type HealthcareState } from "@shared/status-list-healthcare";
import type { HealthcarePolicy } from "@shared/status-list-healthcare";
import { getHealthcareCopy, getHealthcareCounterSubstatus } from "./status-list-healthcare-copy";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { STATUS_LIST_DIALOG_FRAME_CLASS } from "./status-list-dialog-frame";
import "./status-list-action-recap.css";

type HealthcareFact={groupId:string;label:string;state:HealthcareState;active?:boolean;held?:boolean;failedAttempts:number;fingerprint:string;
  config?:{hidden?:boolean;policy?:HealthcarePolicy};
  hasAlternativePhone:boolean;manualState:string;substatus:string|null;proposedContact:string;
  lastAttempt:{id:string;answered:boolean}|null};
type Review={id:string;label:string;title:string;targetLabel:string|null;fingerprint:string;actionType:string;
  content?:string;recipients?:string;callback:{days:number;time:string;businessDaysOnly:boolean;date?:string}|null;occurredAt:string};
type Draft={state:string;substatus:string|null;proposedContact:string;expectedFingerprint:string;voicemailCallId?:string|null};
export function StatusListAgentBackground({campaignId,contactId,locale}:{campaignId?:string;contactId?:string|null;locale:string}) {
  const c=getHealthcareCopy(locale),{toast}=useToast();
  const endpoint=`/api/campaigns/${campaignId}/contacts/${contactId}/status-list-workflows`;
  const enabled=!!campaignId && !!contactId;
  const read=async(path:string)=>{const res=await fetch(path,{credentials:"include"});if(!res.ok)throw Error(String(res.status));return res.json();};
  const healthcare=useQuery<HealthcareFact[]>({queryKey:[`${endpoint}/healthcare`],enabled,queryFn:()=>read(`${endpoint}/healthcare`),refetchInterval:15000});
  const reviews=useQuery<Review[]>({queryKey:[`${endpoint}/action-reviews`],enabled,queryFn:()=>read(`${endpoint}/action-reviews`),refetchInterval:10000});
  const [edit,setEdit]=useState<{scope:string;fact:HealthcareFact;draft:Draft}|null>(null);
  const [review,setReview]=useState<{scope:string;value:Review}|null>(null);
  const [reset,setReset]=useState<{scope:string;fact:HealthcareFact}|null>(null);
  const [resetReason,setResetReason]=useState("");
  const visibleHealthcare=(healthcare.data||[]).filter(fact=>fact.config?.hidden===false);
  const visibleGroups=new Set(visibleHealthcare.map(fact=>fact.groupId));
  const activeEdit=edit?.scope===endpoint && visibleGroups.has(edit.fact.groupId) ? edit : null,activeReview=review?.scope===endpoint ? review.value : null;
  const activeReset=reset?.scope===endpoint && visibleGroups.has(reset.fact.groupId) ? reset.fact : null;
  const activePolicy=healthcarePolicySchema.parse(activeEdit?.fact.config?.policy||{});
  const activeEnabledManualStates=(["wrong_number","not_working","long_term_absent","unreachable"] as const)
    .filter(state=>activePolicy.enabled[state]);
  const refresh=async()=>Promise.all([
    queryClient.invalidateQueries({queryKey:[`${endpoint}/healthcare`]}),queryClient.invalidateQueries({queryKey:[`${endpoint}/action-reviews`]}),
    queryClient.invalidateQueries({queryKey:["/api/campaigns",campaignId,"status-list"]}),
    queryClient.invalidateQueries({queryKey:["/api/agent/scheduled-queue"]}),
    queryClient.invalidateQueries({queryKey:[`/api/campaigns/${campaignId}/contacts`]}),
  ]);
  const mutation=useMutation({mutationFn:async (input:{path:string;body:unknown;successTitle?:string})=>{
    const res=await fetch(input.path,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(input.body)});
    if(!res.ok)throw Error(String(res.status));
    return input.successTitle;
  },onSuccess:async(successTitle)=>{setEdit(null);setReview(null);setReset(null);setResetReason("");if(successTitle)toast({title:successTitle});await refresh();},
    onError:async()=>{toast({title:c.error,variant:"destructive"});await refresh();}});
  const change=(patch:Partial<Draft>)=>setEdit(value=>value ? {...value,draft:{...value.draft,...patch}} : value);
  if(!enabled)return null;
  // Hidden sources still evaluate on the server. Only explicitly configured
  // human action reviews may surface; passive diagnostics are not agent tasks.
  if(!visibleHealthcare.length && !reviews.data?.length && !reviews.isError)return null;
  return <div className="mx-3 mt-2 space-y-2" data-testid="agent-background-controls">
    {(visibleHealthcare.length>0 && healthcare.isError||reviews.isError) && <p role="alert" className="text-xs text-destructive">{c.error}</p>}
    {visibleHealthcare.map(fact=>{
      const policy=healthcarePolicySchema.parse(fact.config?.policy||{});
      return <div key={fact.groupId} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/25 px-3 py-2 text-xs" data-testid="healthcare-agent-status">
      <PhoneCall className="h-3.5 w-3.5 text-primary"/><span className="font-medium">{c.states[fact.state]}</span>
      <span className="text-muted-foreground">{c.attempts}: {fact.failedAttempts}</span>
      {fact.substatus && <span className="text-muted-foreground">{fact.substatus==="five_failed_attempts"
        ? getHealthcareCounterSubstatus(locale,policy.failedAttempts) : c.substatuses[fact.substatus]}</span>}
      {fact.hasAlternativePhone && <span className="text-muted-foreground">{c.alternative}</span>}
      {fact.held && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{c.held}</span>}
      {fact.active===false && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{c.paused}</span>}
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={mutation.isPending}
        onClick={()=>{setResetReason("");setReset({scope:endpoint,fact});}}>{c.resetCounter}</Button>
      <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={()=>setEdit({scope:endpoint,fact,draft:{
        state:fact.manualState,substatus:fact.substatus,proposedContact:fact.proposedContact,expectedFingerprint:fact.fingerprint,
      }})}>{c.edit}</Button>
    </div>;
    })}
    {!!reviews.data?.length && <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/25 px-3 py-2 text-xs" data-testid="background-action-reviews">
      <ClipboardCheck className="h-3.5 w-3.5 text-primary"/><span>{c.reviewTitle} ({reviews.data.length})</span>
      {reviews.data.map(row=><Button type="button" size="sm" variant="outline" key={row.id} className="h-7 text-xs" onClick={()=>setReview({scope:endpoint,value:row})}>{row.title||row.label}</Button>)}
    </div>}
    <Dialog open={!!activeEdit} onOpenChange={open=>{if(!open && !mutation.isPending)setEdit(null);}}>
      <DialogContent className={`${STATUS_LIST_DIALOG_FRAME_CLASS} sl-recap-dialog z-[10070] max-h-[85dvh] overflow-y-auto sm:max-w-xl`} overlayClassName="z-[10060]">
        <DialogHeader className="sl-recap-header"><DialogTitle className="sl-recap-title flex items-center gap-2"><PhoneCall className="h-5 w-5"/>{c.edit}</DialogTitle></DialogHeader>
        {activeEdit && <form className="space-y-4 px-5 pb-5" onSubmit={e=>{e.preventDefault();mutation.mutate({
          path:`${endpoint}/healthcare/${activeEdit.fact.groupId}`,body:activeEdit.draft,
        });}}>
          <p className="text-xs text-muted-foreground">{activeEdit.fact.label}</p>
          <label className="grid gap-1 text-sm">{c.title}<select className="h-9 rounded-md border bg-background px-2" data-testid="healthcare-manual-state"
            value={activeEdit.draft.state} onChange={e=>change({state:e.target.value,substatus:e.target.value==="unreachable" ? activeEdit.draft.substatus||"five_failed_attempts" : null})}>
          <option value="automatic">{c.manual}</option>
          {activeEdit.draft.state!=="automatic" && !activeEnabledManualStates.includes(activeEdit.draft.state as typeof activeEnabledManualStates[number]) &&
            <option value={activeEdit.draft.state} disabled>{c.states[activeEdit.draft.state as HealthcareState]}</option>}
          {activeEnabledManualStates.map(s=><option key={s} value={s}>{c.states[s]}</option>)}
          </select></label>
          {(activeEdit.draft.state==="unreachable" || activeEdit.fact.state==="unreachable") && <label className="grid gap-1 text-sm">{c.substatus}
            <select className="h-9 rounded-md border bg-background px-2" value={activeEdit.draft.substatus||"five_failed_attempts"}
              onChange={e=>change({state:"unreachable",substatus:e.target.value})}>
              {healthcareSubstatuses.map(s=><option key={s} value={s}>{c.substatuses[s]}</option>)}
            </select></label>}
          <label className="grid gap-1 text-sm">{c.proposed}<textarea className="min-h-20 rounded-md border bg-background p-2" maxLength={2000}
            value={activeEdit.draft.proposedContact} onChange={e=>change({proposedContact:e.target.value})}/></label>
          {activeEdit.fact.lastAttempt?.answered && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!activeEdit.draft.voicemailCallId} onChange={e=>change({
              state:"automatic",voicemailCallId:e.target.checked ? activeEdit.fact.lastAttempt!.id : null,
            })}/>{c.voicemail}</label>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={()=>setEdit(null)}>{c.cancel}</Button>
            <Button type="submit" disabled={mutation.isPending}>{c.save}</Button></div>
        </form>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!activeReset} onOpenChange={open=>{if(!open && !mutation.isPending){setReset(null);setResetReason("");}}}>
      <DialogContent className={`${STATUS_LIST_DIALOG_FRAME_CLASS} sl-recap-dialog z-[10070] sm:max-w-lg`} overlayClassName="z-[10060]">
        <DialogHeader className="sl-recap-header"><DialogTitle className="sl-recap-title flex items-center gap-2">
          <PhoneCall className="h-5 w-5"/>{c.resetTitle}
        </DialogTitle></DialogHeader>
        {activeReset && <form className="space-y-3 px-5 pb-5" onSubmit={(event:FormEvent)=>{
          event.preventDefault();
          const reason=resetReason.trim();
          if(reason.length<3 || reason.length>500)return;
          mutation.mutate({path:`${endpoint}/healthcare/${encodeURIComponent(activeReset.groupId)}/reset-counter`,
            body:{expectedFingerprint:activeReset.fingerprint,reason},successTitle:c.resetSuccess});
        }}>
          <p className="text-sm">{activeReset.label}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{c.resetHelp} {c.resetExplanation}</p>
          <label className="grid gap-1 text-sm">{c.resetReason}
            <textarea className="min-h-20 rounded-md border border-input bg-background p-2 text-sm" minLength={3} maxLength={500}
              required value={resetReason} onChange={event=>setResetReason(event.target.value)} aria-describedby="healthcare-reset-reason-count"/>
          </label>
          <p id="healthcare-reset-reason-count" className="text-xs text-muted-foreground">
            {resetReason.trim().length<3 ? c.resetMin : ""} {resetReason.length}/500
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={()=>{setReset(null);setResetReason("");}}>{c.cancel}</Button>
            <Button type="submit" disabled={mutation.isPending || resetReason.trim().length<3 || resetReason.length>500}>{c.resetConfirm}</Button>
          </div>
        </form>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!activeReview} onOpenChange={open=>{if(!open && !mutation.isPending)setReview(null);}}>
      <DialogContent className={`${STATUS_LIST_DIALOG_FRAME_CLASS} sl-recap-dialog z-[10070] sm:max-w-lg`} overlayClassName="z-[10060]">
        <DialogHeader className="sl-recap-header"><DialogTitle className="sl-recap-title flex items-center gap-2"><ClipboardCheck className="h-5 w-5"/>{c.reviewTitle}</DialogTitle></DialogHeader>
        {activeReview && <div className="space-y-3 px-5 pb-5 text-sm">
          <p className="font-medium">{activeReview.title||activeReview.label}</p><p>{activeReview.label}</p>
          {activeReview.targetLabel && <p>{activeReview.targetLabel}</p>}
          {activeReview.recipients && <p>{activeReview.recipients}</p>}
          {activeReview.content && <p className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3">{activeReview.content}</p>}
          {activeReview.callback && <p>{activeReview.callback.date ? new Date(activeReview.callback.date).toLocaleString(locale,{timeZone:"Europe/Bratislava"}) :
            `+${activeReview.callback.days} · ${activeReview.callback.time}`}</p>}
          <p className="text-xs text-muted-foreground">{c.batchHelp}</p>
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={()=>setReview(null)}>{c.cancel}</Button>
            <Button data-testid="confirm-background-action" disabled={mutation.isPending} onClick={()=>mutation.mutate({
              path:`${endpoint}/action-reviews/${activeReview.id}`,body:{fingerprint:activeReview.fingerprint},
            })}>{c.confirm}</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
  </div>;
}
