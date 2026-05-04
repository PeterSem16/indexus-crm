import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Phone, Calendar, ThumbsUp, ThumbsDown, Clock, PhoneOff, MessageSquare, AlertCircle, XCircle, CircleDot, ArrowRight, Target, User, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const ICON_MAP: Record<string, any> = {
  ThumbsUp, ThumbsDown, Calendar, Clock, PhoneOff, MessageSquare, AlertCircle, XCircle, Phone, CircleDot,
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; ring: string; dot: string }> = {
  green:  { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-300",  ring: "ring-green-300",  dot: "bg-green-500"  },
  blue:   { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-300",   ring: "ring-blue-300",   dot: "bg-blue-500"   },
  orange: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-300", ring: "ring-orange-300", dot: "bg-orange-500" },
  gray:   { bg: "bg-gray-50",   text: "text-gray-600",   border: "border-gray-300",   ring: "ring-gray-300",   dot: "bg-gray-400"   },
  yellow: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-300", ring: "ring-yellow-300", dot: "bg-yellow-500" },
  red:    { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-300",    ring: "ring-red-300",    dot: "bg-red-500"    },
};

interface ChecklistItem { id: string; label: string }
interface Disposition {
  code: string; name: string; icon: string; color: string;
  checklistItems?: ChecklistItem[];
}

const DISPOSITIONS: Disposition[] = [
  {
    code: "callback", name: "Preplánovanie hovoru", icon: "Calendar", color: "blue",
    checklistItems: [
      { id: "willing", label: "Ochota ku spolupráci" },
      { id: "leaflets", label: "Chce letáky do ambulancie" },
      { id: "poster", label: "Chce plagáty / POP materiály" },
      { id: "meeting", label: "Záujem o osobné stretnutie" },
      { id: "pregnancy", label: "Záujem o tehotenské knižky" },
      { id: "contract", label: "Záujem o zmluvu" },
    ],
  },
  {
    code: "interested", name: "Záujem", icon: "ThumbsUp", color: "green",
    checklistItems: [
      { id: "info", label: "Chce informačné materiály" },
      { id: "quote", label: "Chce cenovú ponuku" },
      { id: "demo", label: "Záujem o demo / ukážku" },
      { id: "contract", label: "Chce zmluvu" },
    ],
  },
  { code: "not_interested", name: "Nezáujem", icon: "ThumbsDown", color: "orange" },
  { code: "no_answer", name: "Nedvíha", icon: "PhoneOff", color: "gray" },
  { code: "busy", name: "Obsadené", icon: "Phone", color: "yellow" },
  { code: "voicemail", name: "Hlasová schránka", icon: "MessageSquare", color: "gray" },
  { code: "wrong_number", name: "Zlé číslo", icon: "AlertCircle", color: "red" },
  { code: "dnd", name: "Nevolať (DND)", icon: "XCircle", color: "red" },
];

export function InlineChecklist() {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  const selectedDisp = DISPOSITIONS.find(d => d.code === selected);
  const hasChecklist = (d: Disposition) => !!d.checklistItems?.length;

  const toggle = (code: string) => {
    if (selected === code) {
      setSelected(null);
      setExpanded(null);
    } else {
      setSelected(code);
      const d = DISPOSITIONS.find(x => x.code === code);
      setExpanded(d && hasChecklist(d) ? code : null);
    }
  };

  const toggleCheck = (code: string, itemId: string) => {
    setChecked(prev => {
      const cur = prev[code] || [];
      return { ...prev, [code]: cur.includes(itemId) ? cur.filter(x => x !== itemId) : [...cur, itemId] };
    });
  };

  const checkedCount = selected ? (checked[selected] || []).length : 0;
  const checkedLabels = selected && selectedDisp?.checklistItems
    ? (checked[selected] || []).map(id => selectedDisp.checklistItems!.find(i => i.id === id)?.label).filter(Boolean)
    : [];

  if (saved) {
    const d = selectedDisp!;
    const c = COLOR_MAP[d.color] || COLOR_MAP.gray;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${c.bg} ${c.border} border-2`}>
            <Check className={`h-8 w-8 ${c.text}`} />
          </div>
          <div>
            <p className="font-semibold text-base">{d.name}</p>
            {checkedLabels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 justify-center">
                {checkedLabels.map(l => (
                  <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-2">Výsledok hovoru uložený</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setSaved(false); setSelected(null); setExpanded(null); setChecked({}); }}>
            Reset demo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
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
        <div className="p-5 space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Vyberte výsledok</p>
          {DISPOSITIONS.map(d => {
            const c = COLOR_MAP[d.color] || COLOR_MAP.gray;
            const Ico = ICON_MAP[d.icon] || CircleDot;
            const isSelected = selected === d.code;
            const isExpanded = expanded === d.code;
            const hasItems = hasChecklist(d);
            const itemsChecked = (checked[d.code] || []).length;

            return (
              <div
                key={d.code}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isSelected
                    ? `${c.border} ${c.bg} ring-2 ${c.ring}`
                    : "border-border bg-card hover:border-primary/30 hover:bg-muted/30"
                }`}
              >
                {/* Status row */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  onClick={() => toggle(d.code)}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? `${c.bg} ${c.border} border` : "bg-muted"}`}>
                    <Ico className={`h-4 w-4 ${isSelected ? c.text : "text-muted-foreground"}`} />
                  </div>
                  <span className={`flex-1 font-medium text-sm ${isSelected ? c.text : "text-foreground"}`}>
                    {d.name}
                  </span>
                  {isSelected && itemsChecked > 0 && (
                    <Badge className={`text-[10px] h-5 ${c.bg} ${c.text} border ${c.border}`}>
                      {itemsChecked} zaškrtnuté
                    </Badge>
                  )}
                  {isSelected && <div className={`h-4 w-4 rounded-full ${c.dot} flex items-center justify-center`}>
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>}
                  {hasItems && isSelected && (
                    isExpanded
                      ? <ChevronUp className={`h-4 w-4 ${c.text} shrink-0`} />
                      : <ChevronDown className={`h-4 w-4 ${c.text} shrink-0`} />
                  )}
                </button>

                {/* Inline checklist */}
                {isSelected && hasItems && isExpanded && (
                  <div className={`px-4 pb-3 border-t ${c.border}`}>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide pt-2.5 pb-2">
                      Doplňte podrobnosti (voliteľné)
                    </p>
                    <div className="space-y-2">
                      {d.checklistItems!.map(item => {
                        const isChecked = (checked[d.code] || []).includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                              isChecked ? `${c.bg} border ${c.border}` : "hover:bg-muted/50"
                            }`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleCheck(d.code, item.id)}
                              className={isChecked ? `border-current ${c.text}` : ""}
                            />
                            <span className={`text-sm ${isChecked ? `${c.text} font-medium` : "text-foreground"}`}>
                              {item.label}
                            </span>
                            {isChecked && <Check className={`h-3.5 w-3.5 ${c.text} ml-auto`} />}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-5 py-4 border-t bg-background">
        {selected ? (
          <div className="space-y-2">
            {checkedLabels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {checkedLabels.map(l => (
                  <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-1.5"
                onClick={() => setSaved(true)}
              >
                <Check className="h-4 w-4" />
                Uložiť výsledok
                {checkedCount > 0 && <span className="opacity-70">· {checkedCount}</span>}
              </Button>
              <Button variant="outline" size="icon" onClick={() => { setSelected(null); setExpanded(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center">Vyberte výsledok hovoru</p>
        )}
      </div>
    </div>
  );
}
