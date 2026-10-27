import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, X } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { getBackgroundActionCopy } from "./status-list-background-action-copy";
import type { StatusListItem } from "./campaign-status-list-builder";
import { useStatusListConfirm } from "./status-list-confirm";
import { getStatusListQuestionStudioCopy } from "./status-list-question-studio-copy";
const Actions = lazy(() => import("./campaign-status-list-builder").then(module => ({default:module.StatusListStudioActions})));

type Target={kind:"question"|"item";id:string;label?:string};
export function StatusListBackgroundActions({campaignId,locale,targets}:{campaignId:string;locale:string;targets:Target[]}) {
  const c=getBackgroundActionCopy(locale);
  const confirm=useStatusListConfirm(locale);
  const [open,setOpen]=useState(false);
  const [targetId,setTargetId]=useState(targets[0]?.id || "");
  const [dirty,setDirty]=useState(false);
  const [pending,setPending]=useState(false);
  const query=useQuery<StatusListItem[]>({
    queryKey:["/api/campaigns",campaignId,"status-list"],enabled:open,
    queryFn:async()=>{const res=await fetch(`/api/campaigns/${campaignId}/status-list`,{credentials:"include"});if(!res.ok)throw Error(String(res.status));const data=await res.json();if(!Array.isArray(data))throw Error("invalid_status_list");return data;},
    staleTime:0,refetchOnMount:"always",
  });
  const target=targets.find(t=>t.id===targetId);
  const item=query.data?.find(i=>target?.kind==="question" ? i.questions.some(q=>q.id===target.id) : i.id===target?.id);
  const close=async()=>{if(pending)return;if(dirty && !await confirm(getStatusListQuestionStudioCopy(locale).discard))return;setDirty(false);setOpen(false);};
  return <>
    <Button type="button" size="sm" variant="outline" data-testid="background-source-actions" onClick={()=>setOpen(true)} disabled={!targets.length}><Zap className="mr-1.5 h-3.5 w-3.5"/>{c.manage}</Button>
    <Dialog open={open} onOpenChange={next=>{if(!next)close();}}>
      <DialogContent hideCloseButton className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-4xl flex-col overflow-hidden p-0"
        onEscapeKeyDown={e=>{e.preventDefault();close();}} onInteractOutside={e=>{e.preventDefault();close();}}>
        <header className="flex items-center justify-between gap-3 border-b p-4"><DialogTitle>{c.title}</DialogTitle><Button type="button" size="icon" variant="ghost" aria-label={c.close} disabled={pending} onClick={close}><X className="h-4 w-4"/></Button></header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {targets.length>1 && <label className="mb-4 grid gap-1 text-xs">{c.target}<select data-testid="background-actions-target" className="h-9 rounded-md border bg-background px-2" value={targetId} disabled={dirty||pending} onChange={e=>setTargetId(e.target.value)}>{targets.map(t=><option key={t.id} value={t.id}>{t.label||t.id}</option>)}</select></label>}
          {query.isLoading ? <p role="status">{c.loading}</p> : query.isError || !item ? <p role="alert">{c.error}</p> :
            <Suspense fallback={<p role="status">{c.loading}</p>}><Actions key={targetId} item={item} campaignId={campaignId} questionId={target?.kind==="question"?target.id:null} workflows={null} onDirtyChange={setDirty} onPendingChange={setPending}/></Suspense>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
