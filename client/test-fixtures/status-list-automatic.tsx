import React from "react";
import {createRoot} from "react-dom/client";
import "../src/index.css";
import {StatusListAutomaticTriggerInspector} from "../src/components/status-list-automatic-trigger-inspector";
const params=new URLSearchParams(location.search);
const locale=params.get("locale") || "sk";
if(params.get("dark")==="1")document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(
  <main style={{maxWidth:950,margin:"24px auto",padding:16}}>
    <StatusListAutomaticTriggerInspector
      campaignId="11111111-1111-4111-8111-111111111111"
      itemId="22222222-2222-4222-8222-222222222222" locale={locale}/>
  </main>,
);
