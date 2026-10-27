import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkflowContactData } from "./use-status-list-workflow-contact";
import type { RepresentativeCheckResult, RepresentativeCheckReview } from "@shared/status-list-representative-check";
import type { ConfirmationPreview } from "@shared/status-list-confirmation-preview";
import { useToast } from "./use-toast";
import { getStatusListExecutionCopy } from "@/i18n/status-list-execution-copy";
import { workflowContactKey } from "./use-status-list-workflow-contact";

export function useStatusListRepresentativeChecks({campaignId,contactId,data,pulseActive,enabled=true,locale,review}:{
  campaignId?:string|null;contactId?:string|null;data?:WorkflowContactData;
  pulseActive:boolean;enabled?:boolean;locale:string;
  review:(preview:ConfirmationPreview)=>Promise<boolean>;
}) {
  const {toast}=useToast();
  const scope=`${campaignId||""}:${contactId||""}`;
  const scopeRef=useRef(scope);scopeRef.current=scope;
  const [state,setState]=useState<{scope:string;results:Map<string,RepresentativeCheckResult>}>({scope,results:new Map()});
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const checks=data?.representativeChecks || [];
  const signature=JSON.stringify(checks);
  const epoch=useRef(0);
  const opened=useRef({scope:"",signature:"",card:false});
  const post=useCallback(async(trigger:string,extra:Record<string,unknown>={})=>{
    const response=await apiRequest("POST",`/api/campaigns/${campaignId}/contacts/${contactId}/status-list-workflows/representative-check`,
      {trigger,...extra});
    return await response.json() as RepresentativeCheckResult;
  },[campaignId,contactId]);
  useEffect(()=>{
    if(!enabled || !campaignId || !contactId || !checks.some(row=>row.config.enabled))return;
    const token=++epoch.current;
    if(opened.current.scope!==scope || opened.current.signature!==signature)
      opened.current={scope,signature,card:false};
    const alreadyOpened=opened.current.card;
    opened.current.card=true;
    let cancelled=false;
    const triggers=[...new Set(checks.filter(row=>row.config.enabled &&
      (row.config.trigger==="card_open" || pulseActive)).map(row=>row.config.trigger))];
    const update=async(statusOnly=false)=>{
      try {
        const rows=await Promise.all(triggers.map(async trigger=>[trigger,await post(trigger,
          {statusOnly:statusOnly || trigger==="card_open" && alreadyOpened})] as const));
        if(cancelled || token!==epoch.current || scopeRef.current!==scope)return;
        setState({scope,results:new Map(rows)});
      }catch{
        if(!cancelled && token===epoch.current && scopeRef.current===scope)
          toast({title:getStatusListExecutionCopy(locale).failed,variant:"destructive"});
      }
    };
    void update();
    const timer=setInterval(()=>{if(!busyRef.current)void update(true);},15000);
    return()=>{cancelled=true;clearInterval(timer);};
  // Configuration and actual open transitions, never cache timestamps, define the event.
  },[scope,signature,pulseActive,enabled,post,locale,toast]);
  const results=state.scope===scope?state.results:new Map<string,RepresentativeCheckResult>();
  const managedIds=new Set(checks.map(row=>row.questionId));
  const information=[
    ...(data?.representativeInformation||[]).filter(row=>!managedIds.has(row.questionId)),
    ...[...results.values()].flatMap(row=>row.information),
  ];
  const onReview=async(questionId:string)=>{
    if(busyRef.current)return;
    const entry=checks.find(row=>row.questionId===questionId);
    if(!entry || !entry.config.enabled)return;
    const originScope=scope,token=epoch.current;
    busyRef.current=true;setBusy(true);
    try {
      const current=await post(entry.config.trigger,{statusOnly:true});
      if(scopeRef.current!==originScope || token!==epoch.current)return;
      const proposal:RepresentativeCheckReview|undefined=current.reviews.find(row=>row.questionId===questionId);
      if(!proposal)throw Error("preview_changed");
      if(!await review(proposal.preview))return;
      if(scopeRef.current!==originScope || token!==epoch.current)return;
      const result=await post(entry.config.trigger,{confirm:{questionId,fingerprint:proposal.fingerprint}});
      if(scopeRef.current!==originScope || token!==epoch.current)return;
      setState(previous=>({scope,results:new Map(previous.scope===scope?previous.results:[]).set(entry.config.trigger,result)}));
      void queryClient.invalidateQueries({queryKey:workflowContactKey(campaignId||undefined,contactId)});
    }catch{
      if(scopeRef.current===originScope) {
        toast({title:getStatusListExecutionCopy(locale).failed,variant:"destructive"});
        try {
          const refreshed=await post(entry.config.trigger,{statusOnly:true});
          if(scopeRef.current===originScope && token===epoch.current)
            setState(previous=>({scope,results:new Map(previous.scope===scope?previous.results:[]).set(entry.config.trigger,refreshed)}));
        }catch{/* The original error remains visible; do not report success. */}
      }
    }finally{busyRef.current=false;setBusy(false);}
  };
  const batchPending=information.filter(row=>row.batchDeferred===true).length;
  const markBatchCommitted=useCallback(()=>setState(previous=>({scope:previous.scope,results:new Map(
    [...previous.results].map(([key,value])=>[key,{...value,information:value.information.map(row=>({...row,batchDeferred:false}))}])
  )})),[]);
  return {information,onReview,busy,batchPending,markBatchCommitted};
}
