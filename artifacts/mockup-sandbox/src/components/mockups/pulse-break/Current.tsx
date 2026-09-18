import {useState} from "react";
import {Coffee,AlertTriangle,Play} from "lucide-react";
import "./_source.css";
// Extracted directly from the production toolbar; session state is local only.
export function Current(){
const [isOnBreak,setOnBreak]=useState(true);
const activeBreakName="Obed",breakTime="00:12:34",breakExceeded=false,exceededBy=0;
const t={agentSession:{continueWork:"Pokračovať"}};
const onEndBreak=()=>setOnBreak(false);
return <div style={{padding:24,background:"#f4f8fc",minHeight:"100vh",fontFamily:"Open Sans, sans-serif"}}><p style={{fontSize:12,color:"#526c82",marginBottom:18}}>Súčasné ovládanie prestávky priamo v hornej lište</p><div className="agent-toolbar-unified"><div className="pta-surface">
          {isOnBreak && activeBreakName && (
            <div className={`pta-active-break ${breakExceeded ? "pta-break-exceeded" : ""}`} data-testid="badge-break-active">
              {breakExceeded ? <AlertTriangle size={14} /> : <Coffee size={14} />}
              <span>{activeBreakName}</span>
              <b>{breakTime}</b>
              {breakExceeded && (
                <span className="pta-exceeded-by" data-testid="badge-break-exceeded">
                  <AlertTriangle size={12} /> +{exceededBy}m
                </span>
              )}
              <button type="button" onClick={onEndBreak} data-testid="button-end-break">
                <Play size={13} /> {t.agentSession.continueWork}
              </button>
            </div>
          )}


{!isOnBreak && <span style={{fontSize:12,color:"#42845d"}}>Prestávka ukončená · Dostupný</span>}</div></div></div>;
}