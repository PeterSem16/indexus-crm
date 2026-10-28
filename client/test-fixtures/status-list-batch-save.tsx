import { useState } from "react";
import { createRoot } from "react-dom/client";
import { StatusListBatchSaveDialog } from "@/components/status-list-batch-save-dialog";
import { getStatusListExecutionCopy } from "@/i18n/status-list-execution-copy";
import "@/index.css";
import { StatusListUnsavedDialog } from "@/components/status-list-unsaved-dialog";

if (!import.meta.env.DEV) throw new Error("Development-only test fixture");
const params = new URLSearchParams(location.search);
const locale = params.get("locale") || "sk";
document.documentElement.classList.toggle("dark", params.has("dark"));
const execution = getStatusListExecutionCopy(locale);

function Fixture() {
  const [open, setOpen] = useState(true);
  const [action, setAction] = useState<"rules" | "reschedule" | "do_not_call">("reschedule");
  const [value, setValue] = useState(params.has("empty") ? "" : (params.get("date") || "2027-06-18T12:30:00.000Z"));
  const [note, setNote] = useState("Overiť dostupnosť termínu.");
  const [result, setResult] = useState({ commits: 0, cancelled: false, action: "", date: "", note: "" });
  if (params.has("guard")) return <main>
    <output data-testid="batch-result">{JSON.stringify(result)}</output>
    <StatusListUnsavedDialog open={open} onOpenChange={next => { setOpen(next); if (!next) setResult(current => ({ ...current, cancelled: true })); }}
      title="Neuložené kroky" description="Máte 1 neuložený krok. Ak odídete, bude stratený."
      cancelLabel="Zostať" confirmLabel="Zahodiť a pokračovať"
      onConfirm={() => { setResult(current => ({ ...current, commits: current.commits + 1 })); setOpen(false); }} />
  </main>;
  return <main className="min-h-screen bg-slate-100 p-8 dark:bg-slate-950">
    <h1 className="text-xl font-semibold">Nexus Pulse · Status list</h1>
    <button data-testid="reopen-batch" onClick={() => setOpen(true)}>Otvoriť</button>
    <output data-testid="batch-result">{JSON.stringify(result)}</output>
    <StatusListBatchSaveDialog
      open={open} onOpenChange={next => {
        setOpen(next);
        if (!next) setResult(current => ({ ...current, cancelled: true }));
      }}
      locale={locale} title="Uložiť status list" description="1 Rozpracované odpovede a akcie"
      noItems="Nie sú zaškrtnuté žiadne kroky." selectedCount={1}
      items={[{ id: "option", label: "Preplánovať hovor", itemType: "option", color: "#3985b7" }]}
      action={action} onActionChange={setAction} actionHeading={execution.batch} rulesLabel={execution.rulesOnly}
      rulesPreview={params.has("preview") ? {
        campaignId: "fixture-mission", contactId: params.get("contact") || "contact-a",
        changes: [{ kind: "item", id: "option", value: true }],
      } : undefined}
      rescheduleLabel="Preplánovať hovor" doNotCallLabel="Nevolať"
      rescheduleDescription="Naplánuj nový hovor na konkrétny termín."
      doNotCallDescription="Kontakt sa v tejto kampani nebude ďalej volať."
      statusPrefix="Nastavený status:" dispositionNames={["Callback"]}
      value={value} onValueChange={setValue} note={note} onNoteChange={setNote}
      notePlaceholder="Dôvod, čo povedal zákazník..."
      presetLabels={{ d1: "+1 pracovný deň", d3: "+3 pracovné dni", d5: "+5 pracovných dní", m1: "+1 mesiac" }}
      saving={params.has("saving")} savingLabel="Ukladám..." confirmLabel="Potvrdiť a uložiť" cancelLabel="Zrušiť"
      onConfirm={() => {
        setResult(current => ({ commits: current.commits + 1, cancelled: false, action, date: value, note }));
        setOpen(false);
      }}
      confirmTestId="btn-sl-batch-save-confirm" cancelTestId="btn-sl-batch-save-cancel"
      rescheduleStatusTestId="sl-batch-reschedule-status"
    />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
