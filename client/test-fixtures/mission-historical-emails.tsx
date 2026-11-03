import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "../src/i18n";
import MissionHistoricalEmails from "../src/components/campaigns/MissionHistoricalEmails";
import "../src/index.css";

// Development-only component harness; production authorization is unchanged.
const params = new URLSearchParams(location.search);
const countries: Record<string, string[]> = {
  en: [], sk: ["SK"], cs: ["CZ"], hu: ["HU"], ro: ["RO"], it: ["IT"], de: ["DE"],
};
if (params.has("dark")) document.documentElement.classList.add("dark");
const client = new QueryClient();
function Fixture() {
  const [mission, setMission] = useState("mission");
  return <main className="mx-auto max-w-6xl p-4 text-foreground">
    <button data-testid="switch-mission" onClick={() => setMission(mission === "mission" ? "other" : "mission")}>Switch Mission</button>
    <MissionHistoricalEmails key={mission} campaignId={mission} missionName={`Test ${mission}`} />
  </main>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}><I18nProvider userCountries={countries[params.get("locale") || "en"]}>
    <Fixture />
  </I18nProvider></QueryClientProvider>,
);
