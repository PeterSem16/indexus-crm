import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../src/i18n";
import { StatusListQuestionAppearance } from "../src/components/status-list-question-appearance";
import { StatusListQuestionHistory } from "../src/components/status-list-agent-preview";
import { STATUS_LIST_DIALOG_FRAME_CLASS } from "../src/components/status-list-dialog-frame";
import "../src/components/status-list-question-studio.css";
import "../src/components/status-list-dialog-frame.css";
import "../src/index.css";

const params = new URLSearchParams(location.search);
const locale = params.get("locale") || "sk";
if (params.get("dark") === "1") document.documentElement.classList.add("dark");
const countries: Record<string, string[]> = { en: [], sk: ["SK"], cs: ["CZ"], hu: ["HU"], ro: ["RO"], it: ["IT"], de: ["DE"] };
function Fixture() {
  const [icon, setIcon] = useState<string | null>("legacy-icon");
  const [color, setColor] = useState("green");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>("Saved note");
  const [saves, setSaves] = useState(0);
  const [failing, setFailing] = useState(false);
  return <main className="mx-auto max-w-3xl space-y-5 p-4">
    <section className="slqs-fields">
      <StatusListQuestionAppearance locale={locale} icon={icon || ""} color={color} onIconChange={setIcon} onColorChange={setColor} />
      <output data-testid="appearance-value">{JSON.stringify({ icon, color })}</output>
    </section>
    <section className={STATUS_LIST_DIALOG_FRAME_CLASS}>
      <h2>Preplánovať hovor · Cooperation offered — considering</h2>
      <StatusListQuestionHistory questionId="q" locale={locale} pending={pending}
        metadata={{ answeredAt: "2026-10-21T12:30:00Z", answeredByName: "Test Agent", actorKind: "user" }}
        note={{ note, updatedAt: "2026-10-21T12:31:00Z", updatedByName: "Note Author" }}
        onSaveNote={async (_, value) => {
          if (failing) throw Error("test failure");
          setNote(value); setSaves(count => count + 1);
        }} />
      <button data-testid="toggle-pending" onClick={() => setPending(value => !value)}>Toggle pending</button>
      <button data-testid="toggle-failure" onClick={() => setFailing(value => !value)}>Toggle failure</button>
      <output data-testid="saved-note">{JSON.stringify({ note, saves })}</output>
    </section>
  </main>;
}
createRoot(document.getElementById("root")!).render(<I18nProvider selectedCountries={countries[locale] || []}><Fixture /></I18nProvider>);
