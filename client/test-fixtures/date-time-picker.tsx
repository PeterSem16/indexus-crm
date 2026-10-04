import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../src/i18n/I18nProvider";
import { DateTimePicker } from "../src/components/ui/date-time-picker";
import { parseISO } from "date-fns";
import "../src/index.css";

function Fixture() {
  const [date, setDate] = useState("2026-10-04");
  const [deadline, setDeadline] = useState("2026-10-04T09:00");
  const [submitted, setSubmitted] = useState("");
  const [required, setRequired] = useState("");
  return <div className="p-6 space-y-4 max-w-xl">
    <label htmlFor="date">Calendar date</label>
    <DateTimePicker id="date" countryCode="SK" includeTime={false} value={date} onChange={setDate} data-testid="calendar-date" minDate={parseISO("2026-10-01")} maxDate={parseISO("2026-10-31")} />
    <output data-testid="date-value">{date}</output>
    <DateTimePicker aria-label="Deadline" countryCode="SK" value={deadline} onChange={setDeadline} data-testid="deadline" />
    <output data-testid="deadline-value">{deadline}</output>
    <DateTimePicker aria-label="Disabled date" countryCode="SK" includeTime={false} disabled value={date} onChange={setDate} />
    <form onSubmit={event => { event.preventDefault(); setSubmitted(String(new FormData(event.currentTarget).get("requiredDate"))); }}>
      <DateTimePicker name="requiredDate" aria-label="Required date" required includeTime={false} value={required} onChange={setRequired} data-testid="required-date" />
      <button type="submit">Submit date</button>
    </form>
    <output data-testid="submitted">{submitted}</output>
  </div>;
}
createRoot(document.getElementById("root")!).render(<I18nProvider userCountries={["SK"]}><Fixture /></I18nProvider>);