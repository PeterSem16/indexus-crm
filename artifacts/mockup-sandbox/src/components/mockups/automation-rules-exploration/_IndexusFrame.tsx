import { useEffect, useState } from "react";
import { History, Moon, Plus, Settings2, Sparkles, Sun } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "./_button";
import { AutomationRulesOverview } from "./_IndexusRules";
import { AutomationRunHistory } from "./_IndexusHistory";
import { previewCatalog, useI18n } from "./_indexus-boundaries";
import { PrototypeDialog, usePrototypeRules } from "./_prototype";
import "./_indexus-theme.css";

const palettes = [
  ["burgundy", "Burgundy"], ["ocean", "Ocean Blue"], ["forest", "Forest Green"],
  ["purple", "Royal Purple"], ["sunset", "Sunset Orange"], ["slate", "Slate Gray"],
] as const;

/** Production header, navigation and views; only providers and writes are preview boundaries. */
export function IndexusFrame({ initialTab }: { initialTab: "rules" | "runs" }) {
  const { t } = useI18n();
  const copy = t.automationOverview;
  const model = usePrototypeRules();
  const dispatch = (action: Parameters<typeof model.dispatch>[0], rule?: { id: string }) =>
    model.dispatch(action, model.rules.find(item => item.id === rule?.id));
  const [topTab, setTopTab] = useState(initialTab);
  const [palette, setPalette] = useState(() => {
    const saved = localStorage.getItem("nexus-color-palette");
    return palettes.some(([id]) => id === saved) ? saved! : "burgundy";
  });
  const [dark, setDark] = useState(() => localStorage.getItem("nexus-theme") === "dark");
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark", ...palettes.map(([id]) => `palette-${id}`));
    root.classList.add(dark ? "dark" : "light");
    if (palette !== "burgundy") root.classList.add(`palette-${palette}`);
  }, [dark, palette]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === "nexus-theme") setDark(event.newValue === "dark");
      if (event.key === "nexus-color-palette" && palettes.some(([id]) => id === event.newValue))
        setPalette(event.newValue!);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return <div className="indexus-extracted-preview">
    <div className="native-preview-controls">
      <small>Ukážkové údaje · náhľad bez zápisu do aplikácie</small>
      <select aria-label="Paleta náhľadu" value={palette} onChange={event => setPalette(event.target.value)}>
        {palettes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      <button aria-label="Svetlý alebo tmavý náhľad" onClick={() => setDark(value => !value)}>
        {dark ? <Sun size={14}/> : <Moon size={14}/>}
      </button>
    </div>
    <div className="space-y-6 automation-workspace">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
          <Settings2 className="h-6 w-6"/>{copy.automationTitle}
        </h1></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => model.dispatch("tags")}>{copy.tags}</Button>
          <Button onClick={() => model.dispatch("create")} data-testid="button-create-rule">
            <Plus className="h-4 w-4 mr-2"/>{t.automationServices.choose}
          </Button>
        </div>
      </div>
      <Tabs value={topTab} onValueChange={value => setTopTab(value as "rules" | "runs")}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="services" disabled>{t.automationServices.servicesTab}</TabsTrigger>
          <TabsTrigger value="assistant" disabled><Sparkles className="h-3.5 w-3.5 mr-1"/>{t.automationDraft.button}</TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">{copy.rules}</TabsTrigger>
          <TabsTrigger value="runs" data-testid="tab-runs"><History className="h-3.5 w-3.5 mr-1"/>{copy.history}</TabsTrigger>
        </TabsList>
        <TabsContent value="rules" className="pt-4">
          <AutomationRulesOverview rules={model.rules} catalog={previewCatalog} loading={false} error={false} busy={false}
            onRetry={() => {}} onCreate={() => model.dispatch("create")}
            onToggle={rule => dispatch("toggle", rule)} onEdit={rule => dispatch("edit", rule)}
            onFlow={rule => dispatch("flow", rule)} onHistory={() => setTopTab("runs")}
            onReset={rule => dispatch("reset", rule)} onReview={rule => dispatch("review", rule)}
            onDelete={rule => dispatch("delete", rule)}/>
        </TabsContent>
        <TabsContent value="runs" className="pt-4">
          <AutomationRunHistory rules={model.rules} catalog={previewCatalog} onBack={() => setTopTab("rules")}
            onOpenRule={rule => dispatch("edit", rule)}/>
        </TabsContent>
      </Tabs>
      <PrototypeDialog model={model}/>
    </div>
  </div>;
}
