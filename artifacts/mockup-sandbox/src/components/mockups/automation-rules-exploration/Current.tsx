import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./_card";
import { Button } from "./_button";
import { Badge } from "./_badge";
import { Switch } from "./_switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRightLeft, History, Loader2, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";
import { usePrototypeRules, PrototypeDialog, PrototypeLegacyReview } from "./_prototype";
import { countries, type PrototypeRule } from "./_fixtures";
import "./_group.css";

/** Cards and header extracted verbatim from the production Rules tab. APIs/providers and linked pages are prototype boundaries. */
export function Current() {
 const model=usePrototypeRules(); const locale="sk"; const rulesQ={data:model.rules,isLoading:false}; const catalogQ={data:{countries}};
 const t={automationServices:{choose:"Vybrať automatizáciu",servicesTab:"Služby"},automationDraft:{button:"AI návrh"}};
 const getAutomationRecordTagCopy=(_locale:string)=>({overview:"Prehľad štítkov záznamov"});
 const getUnifiedAutomationCopy=(_locale:string)=>({legacy:"Pôvodné pravidlo",activateReviewed:"Skontrolovať a aktivovať",confirmReviewedActivation:"Aktivovať ukážkovú náhradu iba v tomto návrhu?"});
 const getFlowchartCopy=(_locale:string)=>({preview:"Priebeh pravidla"});
 const toggleEnabled=(rule:PrototypeRule)=>model.dispatch("toggle",rule);
 const setEditing=(rule:PrototypeRule)=>model.dispatch("edit",rule); const setFlowFor=(rule:PrototypeRule)=>model.dispatch("flow",rule); const setHistoryFor=(rule:PrototypeRule)=>model.dispatch("history",rule);
 const setShowTagOverview=(_value:boolean)=>model.dispatch("tags"); const setNewService=(_value:unknown)=>{}; const setShowCreate=(_value:boolean)=>model.dispatch("create");
 const activateReviewedMut={isPending:false,mutate:(rule:PrototypeRule)=>model.dispatch("review",rule)};
 const deleteMut={mutate:(id:string)=>model.dispatch("delete",model.rules.find(rule=>rule.id===id))};
 const apiRequest=async (_method:string,path:string,_body:unknown)=>{const rule=model.rules.find(rule=>path.includes(rule.id)); if(rule)model.dispatch("reset",rule);}; const queryClient={invalidateQueries:(_value:unknown)=>{}};
 return <div className="rules-current space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Settings2 className="h-6 w-6" />
            Automations
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setShowTagOverview(true)} data-testid="button-record-tag-overview">
          {getAutomationRecordTagCopy(locale).overview}
        </Button>
        <Button onClick={() => { setNewService(null); setShowCreate(true); }} data-testid="button-create-rule">
          <Plus className="h-4 w-4 mr-2" />
          {t.automationServices.choose}
        </Button>
        </div>
      </div>

<Tabs value="rules" onValueChange={value=>value!=="rules"&&model.dispatch(value==="runs"?"history":"create")}><TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="services">Služby</TabsTrigger><TabsTrigger value="assistant"><Sparkles className="h-3.5 w-3.5 mr-1"/>AI návrh</TabsTrigger><TabsTrigger value="rules">Rules</TabsTrigger><TabsTrigger value="runs"><History className="h-3.5 w-3.5 mr-1"/>Run history</TabsTrigger></TabsList></Tabs>
      {rulesQ.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(rulesQ.data || []).map((rule) => (
            <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {rule.name}
                      {rule.isSystem && <Badge variant="secondary">system</Badge>}
                      {!rule.enabled && <Badge variant="outline">disabled</Badge>}
                      {rule.trigger?.legacySource && <Badge variant="secondary">{getUnifiedAutomationCopy(locale).legacy}</Badge>}
                      {rule.disabledReason && (
                        <Badge variant="destructive" data-testid={`badge-auto-disabled-${rule.id}`}>
                          auto-disabled
                        </Badge>
                      )}
                      {!rule.disabledReason && (rule.consecutiveErrorCount ?? 0) > 0 && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400" data-testid={`badge-error-count-${rule.id}`}>
                          {rule.consecutiveErrorCount} err
                        </Badge>
                      )}
                    </CardTitle>
                    {rule.description && (
                      <CardDescription className="mt-1">{rule.description}</CardDescription>
                    )}
                    {rule.disabledReason && (
                      <CardDescription className="mt-1 text-destructive text-xs" data-testid={`text-disabled-reason-${rule.id}`}>
                        {rule.disabledReason}
                      </CardDescription>
                    )}
                    {!rule.disabledReason && rule.lastErrorMessage && (
                      <CardDescription className="mt-1 text-amber-600 dark:text-amber-400 text-xs" data-testid={`text-last-error-${rule.id}`}>
                        Posledná chyba: {rule.lastErrorMessage}
                      </CardDescription>
                    )}
                  </div>
                  <Switch
                    checked={rule.enabled}
                    disabled={!!(rule.trigger?.legacySource && !rule.trigger.legacySource.reviewActivatedAt)}
                    onCheckedChange={() => toggleEnabled(rule)}
                    data-testid={`switch-enabled-${rule.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">module: {rule.module}</Badge>
                  {(rule.countryCodes?.length ? rule.countryCodes : rule.countryCode ? [rule.countryCode] : []).map(code =>
                    <Badge key={code} variant="outline">{catalogQ.data?.countries.find(country => country.value === code)?.label || code}</Badge>)}
                  {rule.trigger?.eventType && (
                    <Badge variant="outline">on: {rule.trigger.eventType}</Badge>
                  )}
                  <Badge variant="outline">{(rule.actions || []).length} action(s)</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {rule.trigger?.legacySource && !rule.trigger.legacySource.reviewActivatedAt && (
                    <Button size="sm" onClick={() => {
                      if (window.confirm(getUnifiedAutomationCopy(locale).confirmReviewedActivation)) activateReviewedMut.mutate(rule);
                    }}
                      disabled={activateReviewedMut.isPending} data-testid={`button-activate-reviewed-${rule.id}`}>
                      {getUnifiedAutomationCopy(locale).activateReviewed}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditing(rule)} data-testid={`button-edit-${rule.id}`}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setFlowFor(rule)} data-testid={`button-flowchart-${rule.id}`}>
                    <ArrowRightLeft className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    {getFlowchartCopy(locale).preview}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setHistoryFor(rule)} data-testid={`button-history-${rule.id}`}>
                    <History className="h-3.5 w-3.5 mr-1" />
                    Runs
                  </Button>
                  {(rule.disabledReason || (rule.consecutiveErrorCount ?? 0) > 0) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await apiRequest(
                          "POST",
                          `/api/automation/rules/${rule.id}/reset-errors`,
                          { reEnable: !!rule.disabledReason },
                        );
                        queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
                      }}
                      data-testid={`button-reset-errors-${rule.id}`}
                    >
                      Reset errors
                    </Button>
                  )}
                  {!rule.isSystem && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Delete "${rule.name}"?`)) deleteMut.mutate(rule.id);
                      }}
                      data-testid={`button-delete-${rule.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(rulesQ.data || []).length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-12">
              No rules yet. Click <strong>New rule</strong> to create your first automation.
            </div>
          )}
        </div>
      )}
            
<PrototypeLegacyReview/><p className="text-xs text-muted-foreground">Súčasný zdrojový prehľad · ukážkové údaje</p><PrototypeDialog model={model}/></div>;
}
