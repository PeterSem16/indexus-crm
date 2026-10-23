import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Loader2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { apiRequest } from "@/lib/queryClient";
import type { ConfirmationChange, ConfirmationPreview } from "@shared/status-list-confirmation-preview";
import { getStatusListRecapCopy, statusListRecapActionLabel } from "./status-list-recap-copy";
import { STATUS_LIST_DIALOG_FRAME_CLASS } from "./status-list-dialog-frame";

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
    <DialogContent className={`${STATUS_LIST_DIALOG_FRAME_CLASS} z-[10070] max-h-[88dvh] overflow-y-auto sm:max-w-xl`} overlayClassName="z-[10060]">
      <DialogHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-6 w-6"/></div>
        <DialogTitle>{c.title}</DialogTitle><DialogDescription>{c.help}</DialogDescription></DialogHeader>
      <div data-testid="status-list-action-recap" aria-busy={loading} className="space-y-3">
        {loading && <div role="status" className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>{c.loading}</div>}
        {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{c.error}</p><Button size="sm" variant="outline" className="mt-3" onClick={()=>void load()}>{c.retry}</Button></div>}
        {preview && !preview.actions.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{c.empty}</p>}
        {preview?.actions.map(action=>{
          const Icon=action.condition==="matched"?CheckCircle2:action.condition==="not_matched"?XCircle:AlertTriangle;
          return <article key={`${action.sourceLabel}:${action.id}`} className={`rounded-xl border p-3 ${action.condition==="not_matched"?"bg-muted/30 text-muted-foreground":"bg-card"}`}>
            <div className="flex items-start gap-3"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${action.condition==="matched"?"text-emerald-600":action.condition==="blocked"?"text-destructive":"text-muted-foreground"}`}/>
              <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{action.sourceLabel}{action.branch?` · ${c[action.branch]}`:""}</p>
                <h4 className="mt-1 text-sm font-semibold">{statusListRecapActionLabel(action.actionType,locale)}</h4>
                {action.targetLabel && <p className="mt-1 flex items-center gap-1 text-xs"><ArrowRight className="h-3 w-3"/>{action.targetLabel}{action.value!=null?` → ${String(action.value)}`:""}</p>}
                <p className="mt-1 text-xs">{c[action.condition]}</p></div></div>
          </article>;
        })}
        <p className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">{c.caution}</p>
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={()=>finish(false)}>{c.cancel}</Button>
        <Button data-testid="status-list-recap-confirm" disabled={loading || error || !preview} onClick={()=>finish(true)}>{c.confirm}<ArrowRight className="ml-2 h-4 w-4"/></Button></div>
    </DialogContent>
  </Dialog>;
  return {confirm,dialog};
}
