// Extracted directly from RuleEditor and AutomationRuleBasics; API/auth are intentionally absent. Collapsed reference only.
import {useState} from 'react';
import {Bell,CalendarDays,ListFilter,Sparkles,X,Plus,CircleHelp} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {AutomationRuleBasics} from './_RuleBasics';
import './_group.css';
const t={automationServices:{workspace:{when:'When',if:'If',then:'Then',scheduleModeLabel:'Schedule',eventMode:'Event',triggerType:'Trigger type',conditionsAdded:'Conditions configured',noConditions:'No conditions',remove:'Remove',noIfOnce:'No conditions in this mode',actionCount:'actions',addAction:'Add action'},conditionEditor:{addCondition:'Add condition'}},automationEditorHelp:{}};
function AutomationStepHelp(_:any){return <button aria-label='Help' type='button'><CircleHelp size={14}/></button>;}
const eventLabel=(_:any)=>'Email attachment analysis';const hasConditionLeaf=(_:any)=>true;const eventsForModule=[{value:'analysis.completed',label:'Email attachment analysis'}];const selectedEvent='analysis.completed';const scheduleMode:string='';const visibleConditions=true;const sentimentRule=false;const fieldsForConditions=[{value:'analysis.isInvoice'}];
export function Current(){const [draft,setDraft]=useState<any>({name:'Communication analysis INVOICE',description:'Analyze incoming messages before rule conditions run. Choose channels and mailbox owners.',countryCodes:['SK'],module:'communication',conditions:{all:[]},trigger:{type:'event'},actions:[{type:'forward'}]});const expandedStep=null;const setExpandedStep=(_:any)=>{};const setSourceResetNotice=(_:any)=>{};const updateConditions=(conditions:any)=>setDraft({...draft,conditions});return <div className='automation-extracted-host'><div className='task-modern-modal automation-editor-dialog automation-rule-dialog max-w-6xl max-h-[88vh]'><div className='flex flex-col space-y-1.5'><div className='automation-workspace-header'><div><p className='automation-workspace-eyebrow'>AUTOMATION RULE · CURRENT</p><h1 style={{fontSize:18,fontWeight:600}}>Edit: {draft.name}</h1></div></div></div><div className='automation-editor-tabs'><div role='tablist' style={{display:'flex',gap:12,fontSize:12}}><button>Builder</button><button>Rule flow</button></div><div role='tabpanel' data-state='active'><div className='automation-workspace'><div className='automation-workspace-main'><AutomationRuleBasics name={draft.name} description={draft.description} countryCodes={draft.countryCodes} countries={[{value:'SK',label:'Slovakia'}]} onNameChange={name=>setDraft({...draft,name})} onDescriptionChange={description=>setDraft({...draft,description})} onCountriesChange={countryCodes=>setDraft({...draft,countryCodes})}/><section className="automation-step automation-step-when automation-flow-node" data-testid="rule-source-event">
                  <div className="automation-step-heading">
                    <span className="automation-step-number">01</span>
                    <span className="automation-step-icon" aria-hidden="true"><Bell size={15} /></span>
                      <button type="button" className="automation-step-toggle" aria-expanded={expandedStep === 0}
                        aria-controls="automation-step-when-body" onClick={() => setExpandedStep(expandedStep === 0 ? null : 0)}>
                        <h2>{t.automationServices.workspace.when}</h2><p>{draft.trigger.type === "event"
                          ? eventLabel(eventsForModule.find(event => event.value === selectedEvent) || eventsForModule[0] || { value: selectedEvent, label: selectedEvent, availableIn: [], changeSnapshot: false })
                          : t.automationServices.workspace.scheduleModeLabel}</p>
                      </button>
                    <AutomationStepHelp step="when" copy={t.automationEditorHelp} />
                    {draft.module === "call" && <AutomationStepHelp step="call" copy={t.automationEditorHelp} />}
                    <div className="automation-trigger-switch" role="group" aria-label={t.automationServices.workspace.triggerType}>
                      <button type="button" className={draft.trigger.type === "event" ? "active" : ""} aria-pressed={draft.trigger.type === "event"}
                        onClick={() => {
                          if (draft.conditions) setSourceResetNotice(true);
                          setDraft({ ...draft, conditions: null, trigger: { type: "event", entityType: draft.module, eventType: eventsForModule[0]?.value || "updated" } });
                          setExpandedStep(0);
                        }}><Bell className="h-3.5 w-3.5" aria-hidden="true" />{t.automationServices.workspace.eventMode}</button>
                      <button type="button" className={draft.trigger.type === "schedule" ? "active" : ""} aria-pressed={draft.trigger.type === "schedule"}
                        onClick={() => {
                          if (draft.conditions) setSourceResetNotice(true);
                          setDraft({ ...draft, conditions: null, trigger: { type: "schedule", interval: "hourly", mode: "once" } });
                          setExpandedStep(0);
                        }}><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{t.automationServices.workspace.scheduleModeLabel}</button>
                    </div>
                  </div>
                  </section>
<section className="automation-step automation-step-if automation-flow-node" data-testid="automation-if-step">
                    <div className="automation-step-heading">
                      <span className="automation-step-number">02</span>
                      <span className="automation-step-icon" aria-hidden="true"><ListFilter size={15} /></span>
                      <button type="button" className="automation-step-toggle" aria-expanded={expandedStep === 1}
                        aria-controls="automation-step-if-body" onClick={() => setExpandedStep(expandedStep === 1 ? null : 1)}>
                        <h2>{t.automationServices.workspace.if}</h2><p>{hasConditionLeaf(draft.conditions)
                          ? t.automationServices.workspace.conditionsAdded
                          : t.automationServices.workspace.noConditions}</p>
                      </button>
                      <AutomationStepHelp step="if" copy={t.automationEditorHelp} />
                      {scheduleMode === "once" && draft.trigger.type === "schedule"
                        ? <>{draft.conditions && <Button size="sm" variant="ghost" onClick={() => updateConditions(null)}>
                            <X className="h-3.5 w-3.5 mr-1" />{t.automationServices.workspace.remove}
                          </Button>}<span className="automation-muted-note">{t.automationServices.workspace.noIfOnce}</span></>
                        : visibleConditions
                          ? <Button size="sm" variant="ghost" onClick={() => updateConditions(null)}><X className="h-3.5 w-3.5 mr-1" />{t.automationServices.workspace.remove}</Button>
                          : <Button size="sm" variant="outline" onClick={() => {
                              updateConditions({ all: [{ field: (sentimentRule ? fieldsForConditions.find(field => field.value === "newValues.sentiment") : null)?.value || fieldsForConditions[0]?.value || "", op: "eq", value: "" }] });
                              setExpandedStep(1);
                            }}
                            disabled={!fieldsForConditions.length} data-testid="button-add-conditions"><Plus className="h-3.5 w-3.5 mr-1" />{t.automationServices.conditionEditor.addCondition}</Button>}
                    </div>
                    </section>
<section className="automation-step automation-step-then automation-flow-node" data-testid="automation-then-step">
                    <div className="automation-step-heading">
                      <span className="automation-step-number">03</span>
                      <span className="automation-step-icon" aria-hidden="true"><Sparkles size={15} /></span>
                      <button type="button" className="automation-step-toggle" aria-expanded={expandedStep === 2}
                        aria-controls="automation-step-then-body" onClick={() => setExpandedStep(expandedStep === 2 ? null : 2)}>
                        <h2>{t.automationServices.workspace.then}</h2><p>{draft.actions.length} · {t.automationServices.workspace.actionCount}</p>
                      </button>
                      <AutomationStepHelp step="then" copy={t.automationEditorHelp} />
                      <Button size="sm" variant="outline" onClick={() => {
                        setDraft({ ...draft, actions: [...draft.actions, { type: "notify_user", config: { notificationActionVersion: 2 } }] });
                        setExpandedStep(2);
                      }}
                        data-testid="button-add-action"><Plus className="h-3.5 w-3.5 mr-1" />{t.automationServices.workspace.addAction}</Button>
                    </div>
                    </section><p style={{fontSize:11,color:'#64748b'}}>Collapsed source reference · editor interactions are shown in the proposal.</p></div></div></div></div><div className='task-modern-modal-footer automation-dialog-footer' style={{display:'flex',gap:10,alignItems:'center'}}><Button variant='outline'>Test (dry-run)</Button><div style={{flex:1}}/><Button variant='outline'>Cancel</Button><Button>Save rule</Button></div></div></div>;}
