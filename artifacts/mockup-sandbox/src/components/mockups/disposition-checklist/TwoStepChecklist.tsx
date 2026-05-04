import { useState } from "react";
import { Check, ChevronLeft, Phone, Calendar, ThumbsUp, ThumbsDown, Clock, PhoneOff, MessageSquare, AlertCircle, XCircle, CircleDot, Target, User, ArrowRight, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const ICON_MAP: Record<string, any> = {
  ThumbsUp, ThumbsDown, Calendar, Clock, PhoneOff, MessageSquare, AlertCircle, XCircle, Phone, CircleDot,
};

const COLOR_MAP: Record<string, { bg: string; light: string; text: string; border: string; btn: string }> = {
  green:  { bg: "bg-green-600",  light: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  btn: "bg-green-600 hover:bg-green-700" },
  blue:   { bg: "bg-blue-600",   light: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   btn: "bg-blue-600 hover:bg-blue-700"   },
  orange: { bg: "bg-orange-500", light: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", btn: "bg-orange-500 hover:bg-orange-600" },
  gray:   { bg: "bg-gray-500",   light: "bg-gray-50",   text: "text-gray-600",   border: "border-gray-200",   btn: "bg-gray-500 hover:bg-gray-600"    },
  yellow: { bg: "bg-yellow-500", light: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", btn: "bg-yellow-500 hover:bg-yellow-600" },
  red:    { bg: "bg-red-600",    light: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    btn: "bg-red-600 hover:bg-red-700"       },
};

interface ChecklistItem { id: string; label: string; hint?: string }
interface Disposition {
  code: string; name: string; icon: string; color: string;
  checklistItems?: ChecklistItem[];
}

const DISPOSITIONS: Disposition[] = [
  {
    code: "callback", name: "Preplánovanie hovoru", icon: "Calendar", color: "blue",
    checklistItems: [
      { id: "willing",    label: "Ochota ku spolupráci",           hint: "Všeobecný záujem o spoluprácu" },
      { id: "leaflets",   label: "Chce letáky do ambulancie",      hint: "Reklamné / informačné letáky" },
      { id: "poster",     label: "Chce plagáty / POP materiály",   hint: "Plagáty A3/A4, stojan, roll-up" },
      { id: "meeting",    label: "Záujem o osobné stretnutie",     hint: "Dohodnúť termín návštevy" },
      { id: "pregnancy",  label: "Záujem o tehotenské knižky",     hint: "Knižky pre tehotné pacientky" },
      { id: "contract",   label: "Záujem o zmluvu",                hint: "Príprava zmluvy o spolupráci" },
    ],
  },
  {
    code: "interested", name: "Záujem", icon: "ThumbsUp", color: "green",
    checklistItems: [
      { id: "info",       label: "Chce informačné materiály" },
      { id: "quote",      label: "Chce cenovú ponuku" },
      { id: "demo",       label: "Záujem o demo / ukážku" },
      { id: "contract",   label: "Chce zmluvu" },
      { id: "referral",   label: "Ochota odporúčať ďalej" },
    ],
  },
  { code: "not_interested", name: "Nezáujem", icon: "ThumbsDown", color: "orange" },
  { code: "no_answer",      name: "Nedvíha",          icon: "PhoneOff",       color: "gray"   },
  { code: "busy",           name: "Obsadené",          icon: "Phone",          color: "yellow" },
  { code: "voicemail",      name: "Hlasová schránka",  icon: "MessageSquare",  color: "gray"   },
  { code: "wrong_number",   name: "Zlé číslo",         icon: "AlertCircle",    color: "red"    },
  { code: "dnd",            name: "Nevolať (DND)",      icon: "XCircle",        color: "red"    },
];

type Step = "select" | "checklist" | "done";

export function TwoStepChecklist() {
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<Disposition | null>(null);
  const [checked, setChecked] = useState<string[]>([]);

  const c = selected ? COLOR_MAP[selected.color] || COLOR_MAP.gray : COLOR_MAP.gray;
  const Ico = selected ? ICON_MAP[selected.icon] || CircleDot : CircleDot;

  const pick = (d: Disposition) => {
    setSelected(d);
    setChecked([]);
    if (d.checklistItems?.length) {
      setStep("checklist");
    } else {
      setStep("done");
    }
  };

  const toggleCheck = (id: string) => {
    setChecked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const checkedItems = selected?.checklistItems?.filter(i => checked.includes(i.id)) || [];

  if (step === "done") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Výsledok hovoru</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-sm w-full">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${c.light} border-2 ${c.border}`}>
              <Check className={`h-8 w-8 ${c.text}`} />
            </div>
            <div>
              <p className="font-semibold text-base">{selected?.name}</p>
              {checkedItems.length > 0 && (
                <div className="mt-3 space-y-1.5 text-left">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Zaznamenané požiadavky</p>
                  {checkedItems.map(i => (
                    <div key={i.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${c.light} border ${c.border}`}>
                      <Check className={`h-3.5 w-3.5 ${c.text} shrink-0`} />
                      <span className={`text-sm ${c.text} font-medium`}>{i.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-3">Výsledok hovoru úspešne uložený.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setStep("select"); setSelected(null); setChecked([]); }}>
              Reset demo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "checklist" && selected?.checklistItems) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-2">
          <button
            onClick={() => setStep("select")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mr-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Späť
          </button>
          <div className="h-4 w-px bg-border" />
          <Target className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Výsledok hovoru</span>
          <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <span className="text-muted-foreground">Krok 2 z 2</span>
          </div>
        </div>

        {/* Selected status banner */}
        <div className={`px-5 py-3 ${c.light} border-b ${c.border}`}>
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
              <Ico className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${c.text}`}>{selected.name}</p>
              <p className="text-xs text-muted-foreground">Zvolený status hovoru</p>
            </div>
            <Badge variant="outline" className={`text-[11px] shrink-0 ${c.text} ${c.border}`}>
              ✓ Vybraný
            </Badge>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Aké požiadavky zákazník má?</p>
              <span className="text-xs text-muted-foreground ml-auto">(voliteľné)</span>
            </div>

            <div className="space-y-2">
              {selected.checklistItems.map(item => {
                const isChecked = checked.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? `${c.light} ${c.border} shadow-sm`
                        : "border-border hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleCheck(item.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isChecked ? c.text : "text-foreground"}`}>
                        {item.label}
                      </p>
                      {item.hint && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>
                      )}
                    </div>
                    {isChecked && (
                      <Check className={`h-4 w-4 ${c.text} shrink-0 mt-0.5`} />
                    )}
                  </label>
                );
              })}
            </div>

            {checked.length === 0 && (
              <p className="text-xs text-center text-muted-foreground mt-4">
                Môžete pokračovať bez zaškrtnutia — checklist je voliteľný.
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 py-4 border-t bg-background space-y-2">
          {checked.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {checkedItems.map(i => (
                <Badge key={i.id} variant="secondary" className="text-xs">{i.label}</Badge>
              ))}
            </div>
          )}
          <Button
            className={`w-full gap-2 text-white ${c.btn}`}
            onClick={() => setStep("done")}
          >
            <Check className="h-4 w-4" />
            Uložiť výsledok
            {checked.length > 0 && <span className="opacity-80 font-normal">· {checked.length} zaznačené</span>}
          </Button>
        </div>
      </div>
    );
  }

  // Step 1: Status selection
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Výsledok hovoru</span>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="font-medium text-foreground">MUDr. Jana Kováčová</span>
          <span>· +421 900 123 456</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Vyberte výsledok</p>
            <span className="text-xs text-muted-foreground">Krok 1 z 2</span>
          </div>
          <div className="space-y-2">
            {DISPOSITIONS.map(d => {
              const dc = COLOR_MAP[d.color] || COLOR_MAP.gray;
              const DI = ICON_MAP[d.icon] || CircleDot;
              const hasItems = !!d.checklistItems?.length;
              return (
                <button
                  key={d.code}
                  onClick={() => pick(d)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 text-left transition-all group"
                >
                  <div className={`h-9 w-9 rounded-lg ${dc.bg} flex items-center justify-center shrink-0`}>
                    <DI className="h-4 w-4 text-white" />
                  </div>
                  <span className="flex-1 font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                    {d.name}
                  </span>
                  {hasItems && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <ListChecks className="h-3.5 w-3.5" />
                      <span>{d.checklistItems!.length} volíeb</span>
                    </div>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      <div className="px-5 py-3 border-t bg-background">
        <p className="text-xs text-muted-foreground text-center">
          Statusy s ikonkou <ListChecks className="h-3 w-3 inline-block align-middle" /> umožňujú zaznačiť detaily
        </p>
      </div>
    </div>
  );
}
