/// <reference types="vite/client" />
import { createRoot } from "react-dom/client";
import { StatusListHelp } from "../src/components/status-list-help";
import "../src/index.css";

if (!import.meta.env.DEV) throw new Error("Development-only help fixture");
const params = new URLSearchParams(location.search);
if (params.has("dark")) document.documentElement.classList.add("dark");
const locale = params.get("locale") || "sk";
createRoot(document.getElementById("root")!).render(<main className="space-y-4 p-4">
  <StatusListHelp locale={locale}/>
  <StatusListHelp locale={locale} section="healthcareExamples" contextual/>
</main>);
