import {useState} from "react";
import {createRoot} from "react-dom/client";
import {StatusListManualCallbackButton} from "@/components/status-list-manual-callback-button";
import {getStatusListRecapCopy} from "@/components/status-list-recap-copy";
import "../src/index.css";
const params=new URLSearchParams(location.search);
const locale=params.get("locale")||"sk";
if(params.has("dark"))document.documentElement.classList.add("dark");
const labels:Record<string,[string,string]>={sk:["Preplánovať hovor","Nastaviť stav hovoru"],
  en:["Reschedule call","Set call status"],cs:["Přeplánovat hovor","Nastavit stav hovoru"],
  hu:["Hívás átütemezése","Hívásállapot beállítása"],ro:["Reprogramează apelul","Setează starea apelului"],
  it:["Riprogramma chiamata","Imposta stato chiamata"],de:["Anruf verschieben","Anrufstatus setzen"]};
const everyone:Record<string,string>={sk:"pre všetkých agentov",en:"for all agents",cs:"pro všechny agenty",
  hu:"minden ügynöknek",ro:"pentru toți agenții",it:"per tutti gli agenti",de:"für alle Agenten"};
function Fixture(){
  const [scope,setScope]=useState("contact-a");
  const [version,setVersion]=useState(0);
  const [events,setEvents]=useState<any[]>([]);
  const c=getStatusListRecapCopy(locale);
  return <main className="min-h-screen bg-background p-4 text-foreground" data-testid="manual-callback-fixture">
    <button type="button" data-testid="change-scope" onClick={()=>setScope("contact-b")}>Change contact</button>
    <button type="button" data-testid="rerender" onClick={()=>setVersion(value=>value+1)}>Refresh data</button>
    <form onSubmit={event=>{event.preventDefault();document.documentElement.dataset.outerSubmits="1";}}
      className="mx-auto mt-12 flex max-w-2xl gap-4 rounded-xl border p-4" data-version={version}>
      {(["callback","status"] as const).map((kind,index)=><StatusListManualCallbackButton key={`${scope}:${kind}`}
        kind={kind} automation={{id:kind,actionType:kind==="callback"?"set_callback":"set_contact_status",callbackOffsetDays:1,
          callbackTime:"09:00",callbackBusinessDaysOnly:!params.has("weekends")}}
        isRunning={params.has("running")} locale={locale} label={(labels[locale]||labels.en)[index]}
        title={kind==="status"?(labels[locale]||labels.en)[index]:undefined}
        copy={{noteLabel:c.callbackNote,notePlaceholder:c.callbackNote,confirm:c.confirm,forEveryone:everyone[locale]||everyone.en}}
        onRun={(automation,opts)=>setEvents(previous=>[...previous,{scope,id:automation.id,...opts}])}/>)}
    </form>
    <output data-testid="events">{JSON.stringify(events)}</output>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
