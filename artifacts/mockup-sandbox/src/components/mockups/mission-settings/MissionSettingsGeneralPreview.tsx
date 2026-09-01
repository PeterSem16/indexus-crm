import { useState } from "react";
import {
  CheckCheck, Clock, FileEdit, FileSignature, ListChecks, Mail, MessageSquare,
  Phone, Save, ScrollText, Settings, Settings2, Shield, UserCheck, Volume2, Zap,
} from "lucide-react";
import "./_group.css";

type ToggleProps = { on: boolean; setOn: (value: boolean) => void; label?: string };
function Toggle({ on, setOn, label }: ToggleProps) {
  return <button aria-label={label || "Toggle setting"} type="button" className="ms-switch" data-on={on} onClick={() => setOn(!on)} />;
}

function Section({ color, title, description, children }: { color: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="space-y-3">
    <div>
      <h2 className="flex items-center gap-2 text-base font-semibold"><span className={`h-2 w-2 rounded-full ${color}`} />{title}</h2>
      <p className="text-sm text-[#595959]">{description}</p>
    </div>
    {children}
  </section>;
}

export function MissionSettingsGeneralPreview() {
  const [activeTab, setActiveTab] = useState("general");
  const [recording, setRecording] = useState(true);
  const [autoMode, setAutoMode] = useState(true);
  const [onlyAssigned, setOnlyAssigned] = useState(false);
  const [showScript, setShowScript] = useState(true);
  const [workflow, setWorkflow] = useState("disposition");
  const [queueMode, setQueueMode] = useState("step");
  const [templateTab, setTemplateTab] = useState("templates");
  const [changed, setChanged] = useState(false);
  const tabs = [
    ["general", Settings, "General", "Mission setup"],
    ["scheduling", Clock, "Scheduling", "Working hours"],
    ["operators", Shield, "Operators", "Access & quotas"],
    ["dispositions", CheckCheck, "Dispositions", "Call outcomes"],
    ["status", ListChecks, "Status List", "Workflow fields"],
    ["script", ScrollText, "Script", "Call guidance"],
  ] as const;
  const markChanged = (fn: () => void) => { fn(); setChanged(true); };

  return (
    <div className="mission-settings-preview min-h-screen p-4 sm:p-7">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#8a8a8a]">Mission</p><h1 className="m-0 text-2xl font-bold">Spring customer follow-up</h1></div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Active</span>
        </div>
        <div className="flex min-h-[850px] overflow-hidden rounded-lg border border-[#e8e8e8] bg-white">
          <aside className="w-56 shrink-0 border-r border-[#e8e8e8] bg-[#faf8f8] px-3 py-3">
            <div className="flex flex-col gap-1">
              {tabs.map(([id, Icon, label, desc]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`ms-subtab flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${activeTab === id ? "active" : ""}`}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-md ${activeTab === id ? "bg-[#c60f26] text-white" : "bg-[#f0ebeb] text-[#666]"}`}><Icon size={16} /></span>
                <span className="min-w-0"><span className={`block truncate text-sm font-medium ${activeTab === id ? "text-black" : "text-[#666]"}`}>{label}</span><span className="block truncate text-[11px] text-[#777]">{desc}</span></span>
              </button>)}
            </div>
          </aside>
          <main className="min-w-0 flex-1 px-5 py-5 sm:px-7">
            {activeTab !== "general" ? <div className="rounded-lg border border-dashed border-[#ddd] p-10 text-center text-sm text-[#666]">This preview contains the General settings tab.</div> : (
              <div className="space-y-8">
                <Section color="bg-amber-500" title="Basic settings" description="Core details, phone routing, and recording policy for this mission.">
                  <div className="ms-card border-amber-200/80 bg-amber-50/30">
                    <div className="ms-card-head flex items-center justify-between gap-4 text-amber-900">
                      <h3 className="ms-title flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700"><Settings2 size={20} /></span>Mission settings</h3>
                      {changed && <button className="ms-save flex items-center gap-2" onClick={() => setChanged(false)}><Save size={15} />Save</button>}
                    </div>
                    <div className="ms-card-body space-y-4 text-black">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Mission name"><input className="ms-input" defaultValue="Spring customer follow-up" onChange={() => setChanged(true)} /></Field>
                        <Field label="Type"><select className="ms-select" onChange={() => setChanged(true)} defaultValue="followup"><option value="followup">Follow-up</option><option>Sales</option><option>Marketing</option></select></Field>
                        <Field label="Channel"><select className="ms-select" defaultValue="phone"><option value="phone">Phone</option><option>Email</option><option>SMS</option><option>Mixed</option></select></Field>
                        <Field label="Status"><select className="ms-select" defaultValue="active"><option value="active">Active</option><option>Draft</option><option>Paused</option></select></Field>
                      </div>
                      <Field label="Description"><textarea className="ms-textarea" defaultValue="Reconnect with customers after their initial consultation and arrange the next step." /></Field>
                      <div className="grid gap-4 md:grid-cols-2"><Field label="Start date"><input className="ms-input" type="date" defaultValue="2025-03-03" /></Field><Field label="End date"><input className="ms-input" type="date" defaultValue="2025-04-30" /></Field></div>
                      <Field label="Target countries"><div className="flex gap-2"><span className="rounded-md bg-[#c60f26] px-2.5 py-1 text-xs font-semibold text-white">Slovakia</span><span className="rounded-md border border-[#ddd] px-2.5 py-1 text-xs">Czech Republic</span></div></Field>
                      <div className="grid gap-4 md:grid-cols-2"><Field label="Default tab"><select className="ms-select" defaultValue="phone"><option value="phone">Phone</option><option>Phone / Script</option><option>Email</option></select></Field><Field label="Caller ID number"><input className="ms-input" defaultValue="+421 2 555 018 20" /><p className="mt-1 text-xs text-[#666]">Shown to customers when calling from this mission.</p></Field></div>
                      <div className={`rounded-xl border-2 p-4 ${recording ? "border-emerald-500/60 bg-emerald-500/5" : "border-[#e8e8e8] bg-[#fafafa]"}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-full ${recording ? "bg-emerald-500 text-white" : "bg-[#eee] text-[#777]"}`}><Volume2 size={20} /></span><div><div className="flex items-center gap-2"><b className="text-sm">Call recording</b><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${recording ? "bg-emerald-600 text-white" : "bg-[#eee] text-[#555]"}`}>{recording ? "Active" : "Inactive"}</span></div><p className="ms-desc">Record calls made within this mission.</p></div></div>
                          <Toggle on={recording} setOn={(v) => markChanged(() => setRecording(v))} label="Enable call recording" />
                        </div>
                        {recording && <div className="mt-4 grid gap-4 border-t border-emerald-500/20 pt-4 md:grid-cols-2"><Field label="Recording validity"><select className="ms-select" defaultValue="month"><option>Unlimited</option><option>One week</option><option value="month">One month</option><option>Custom date</option></select></Field><Field label="Recording mode"><select className="ms-select" defaultValue="both"><option value="both">Agent and customer</option><option>Agent only</option></select></Field><p className="col-span-full m-0 text-xs text-[#666]">Recording policy uses the Europe/Bratislava timezone.</p></div>}
                      </div>
                    </div>
                  </div>
                </Section>
                <Section color="bg-violet-500" title="Agent settings" description="Set the behavior agents see when working through contacts.">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <SettingCard tone="violet" icon={<Phone size={16} />} title="Maximum ring time" desc="How long an outbound call can ring before it is marked unanswered."><div className="flex items-center gap-2"><input className="ms-input w-28" type="number" defaultValue="30" /><span className="text-sm text-[#666]">seconds</span></div></SettingCard>
                    <SettingCard tone="cyan" icon={<UserCheck size={16} />} title="Show assigned contacts only" desc="Open the agent view with only contacts assigned to the signed-in agent."><Toggle on={onlyAssigned} setOn={(v) => markChanged(() => setOnlyAssigned(v))} /></SettingCard>
                    <SettingCard tone="rose" icon={<ScrollText size={16} />} title="Show call script" desc="Display the mission script in the agent workspace."><Toggle on={showScript} setOn={(v) => markChanged(() => setShowScript(v))} /></SettingCard>
                  </div>
                  <Templates tab={templateTab} setTab={setTemplateTab} />
                </Section>
                <Section color="bg-orange-500" title="Dialer" description="Configure automatic calling behavior."><SettingCard tone="orange" icon={<Zap size={16} />} title="Auto mode" desc="Automatically advance to the next contact after a completed call." action={changed ? <button className="ms-save" onClick={() => setChanged(false)}>Save</button> : undefined}><div className="flex items-center gap-3"><Toggle on={autoMode} setOn={(v) => markChanged(() => setAutoMode(v))} /><b className="text-sm">Auto mode</b></div>{autoMode && <Field label="Delay (seconds)"><input className="ms-input mt-2 w-32" type="number" defaultValue="5" /></Field>}</SettingCard></Section>
                <Section color="bg-rose-500" title="Workflow" description="Choose how agents capture outcomes and move through the mission."><div className="grid gap-4 lg:grid-cols-2"><SettingCard tone="rose" title="Workflow mode" desc="The primary workflow presented after a contact call."><div className="flex gap-3">{["disposition", "status"].map((item) => <button key={item} className={`ms-choice flex-1 p-3 text-left ${workflow === item ? "active" : ""}`} onClick={() => markChanged(() => setWorkflow(item))}><b className="text-sm">{item === "disposition" ? "Dispositions" : "Status List"}</b><span className="mt-1 block text-xs text-[#666]">{item === "disposition" ? "Choose a call outcome." : "Complete the status checklist."}</span></button>)}</div></SettingCard><SettingCard tone="teal" title="After disposition" desc="Select what agents see when a call is completed."><select className="ms-select"><option>End call view</option><option>Open script</option></select></SettingCard></div></Section>
                <Section color="bg-cyan-500" title="Communication" description="Mission-specific defaults for email and SMS."><div className="grid gap-4 lg:grid-cols-2"><SettingCard tone="cyan" title="Follow-up email sender" desc="Choose the mailbox used for Nexus Pulse messages."><select className="ms-select"><option>Assigned agent mailbox</option><option>System mailbox</option><option>Custom mailbox</option></select></SettingCard><SettingCard tone="emerald" title="SMS provider" desc="Choose the outbound gateway for this mission."><select className="ms-select"><option>Mission default</option><option>BulkGate</option><option>SMSTOOLS (SK)</option></select></SettingCard></div></Section>
                <Section color="bg-violet-500" title="Automation" description="Control how queue information appears to agents."><SettingCard tone="violet" title="Queue display mode" desc="Show the current queue step or the last contact status."><select className="ms-select max-w-xs" value={queueMode} onChange={(e) => markChanged(() => setQueueMode(e.target.value))}><option value="step">Current queue step</option><option value="last">Last status</option></select></SettingCard></Section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="ms-label">{label}</span>{children}</label>; }
function SettingCard({ tone, icon, title, desc, action, children }: { tone: string; icon?: React.ReactNode; title: string; desc: string; action?: React.ReactNode; children: React.ReactNode }) {
  const toneClass: Record<string, string> = { violet: "border-violet-200 bg-violet-50/25 text-violet-900", cyan: "border-cyan-200 bg-cyan-50/25 text-cyan-900", rose: "border-rose-200 bg-rose-50/25 text-rose-900", orange: "border-orange-200 bg-orange-50/25 text-orange-900", teal: "border-teal-200 bg-teal-50/25 text-teal-900", emerald: "border-emerald-200 bg-emerald-50/25 text-emerald-900" };
  return <div className={`ms-card ${toneClass[tone] || ""}`}><div className="ms-card-head flex items-start justify-between gap-3"><div><h3 className="ms-title flex items-center gap-2">{icon && <span className="flex h-7 w-7 items-center justify-center rounded-md bg-current/10">{icon}</span>}{title}</h3><p className="ms-desc">{desc}</p></div>{action}</div><div className="ms-card-body text-black">{children}</div></div>;
}
function Templates({ tab, setTab }: { tab: string; setTab: (tab: string) => void }) {
  return <div className="ms-card border-fuchsia-200 bg-fuchsia-50/20 text-fuchsia-900"><div className="ms-card-head"><h3 className="ms-title flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-fuchsia-500/15"><FileEdit size={16} /></span>Default templates</h3><p className="ms-desc">Preselect email and SMS templates for agents.</p></div><div className="ms-card-body text-black"><div className="mb-5 flex gap-1 rounded-md bg-[#f1eded] p-1 w-fit"><button className={`rounded px-3 py-1.5 text-sm ${tab === "templates" ? "bg-white shadow-sm" : ""}`} onClick={() => setTab("templates")}><FileEdit className="mr-1 inline" size={14} />Templates</button><button className={`rounded px-3 py-1.5 text-sm ${tab === "signature" ? "bg-white shadow-sm" : ""}`} onClick={() => setTab("signature")}><FileSignature className="mr-1 inline" size={14} />Reply signature</button></div>{tab === "templates" ? <div className="grid gap-6 lg:grid-cols-2"><Field label="Email"><div className="flex items-center gap-2"><Mail className="text-blue-500" size={17} /><select className="ms-select"><option>Consultation follow-up</option><option>Welcome email</option></select></div></Field><Field label="SMS"><div className="flex items-center gap-2"><MessageSquare className="text-green-500" size={17} /><select className="ms-select"><option>Appointment reminder</option><option>Thank you</option></select></div></Field></div> : <Field label="Reply email signature"><textarea className="ms-textarea" defaultValue={"Kind regards,\nCustomer Care Team"} /></Field>}</div></div>;
}