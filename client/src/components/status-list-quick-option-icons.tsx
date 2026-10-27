import React from "react";
import {
  Award,
  Baby,
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CheckCircle2,
  CircleX,
  ClipboardCheck,
  Clock,
  Clock3,
  DollarSign,
  Dna,
  FileText,
  Flag,
  Heart,
  HeartPulse,
  Home,
  Info,
  Lightbulb,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  PauseCircle,
  Phone,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  Shield,
  Smile,
  SquareCheck,
  Star,
  Stethoscope,
  User,
  UserRoundCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";

const iconRegistry = {
  Activity,
  AlertCircle,
  ArrowRight,
  Award,
  Baby,
  Building2,
  Calendar,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CheckCircle2,
  CircleX,
  ClipboardCheck,
  Clock,
  Clock3,
  DollarSign,
  Dna,
  FileText,
  Flag,
  Heart,
  HeartPulse,
  Home,
  Info,
  Lightbulb,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  PauseCircle,
  Phone,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  Shield,
  Smile,
  SquareCheck,
  Star,
  Stethoscope,
  User,
  UserRoundCheck,
  Zap,
} satisfies Record<string, LucideIcon>;

export const QUICK_OPTION_ICON_NAMES = [
  "Activity",
  "AlertCircle",
  "ArrowRight",
  "CalendarClock",
  "CheckCircle2",
  "CircleX",
  "ClipboardCheck",
  "Clock3",
  "HeartPulse",
  "Mail",
  "MessageSquareText",
  "PauseCircle",
  "PhoneCall",
  "PhoneOff",
  "RefreshCw",
  "Stethoscope",
  "UserRoundCheck",
] as const;

const questionColorAliases: Record<string, string> = {
  gray: "#6b7280", blue: "#3b82f6", green: "#16a34a", amber: "#f59e0b",
  red: "#ef4444", purple: "#a855f7", pink: "#ec4899", cyan: "#06b6d4",
  orange: "#f97316", emerald: "#10b981", indigo: "#6366f1", rose: "#f43f5e",
};

export function getStatusListQuestionColorValue(color?: string | null) {
  const value = color?.trim();
  if (!value) return undefined;
  return questionColorAliases[value.toLowerCase()] || value;
}

export function StatusListQuickOptionIcon({ name, className, color, style }: {
  name?: string | null; className?: string; color?: string | null; style?: React.CSSProperties;
}) {
  if (!name || !Object.prototype.hasOwnProperty.call(iconRegistry, name)) return null;
  const Icon = iconRegistry[name as keyof typeof iconRegistry];
  const resolvedColor = getStatusListQuestionColorValue(color);
  return <Icon aria-hidden="true" focusable="false" className={className}
    style={{ ...style, ...(resolvedColor ? { color: resolvedColor } : {}) }} strokeWidth={1.9} />;
}

const pickerCopy = {
  title: ["Button icon", "Ikona tlačidla", "Ikona tlačítka", "Gomb ikonja", "Pictograma butonului", "Icona del pulsante", "Schaltflächensymbol"],
  none: ["No icon", "Bez ikony", "Bez ikony", "Nincs ikon", "Fără pictogramă", "Nessuna icona", "Kein Symbol"],
  removeUnknown: ["Remove unrecognized icon", "Odstrániť neznámu ikonu", "Odebrat neznámou ikonu", "Ismeretlen ikon eltávolítása", "Elimină pictograma nerecunoscută", "Rimuovi icona non riconosciuta", "Unbekanntes Symbol entfernen"],
  unknown: ["This saved icon isn't offered here. Choose a replacement or remove it.", "Táto uložená ikona nie je v ponuke tohto editora. Vyber ikonu, ktorou ju nahradíš, alebo ju odstráň.", "Tato uložená ikona není v nabídce tohoto editoru. Vyberte ikonu, kterou ji nahradíte, nebo ji odeberte.", "Ez a mentett ikon nem szerepel ebben a szerkesztőben. Válasszon helyette ikont, vagy távolítsa el.", "Această pictogramă salvată nu este în lista acestui editor. Alege una pentru a o înlocui sau elimin-o.", "Questa icona salvata non è disponibile in questo editor. Scegline una per sostituirla oppure rimuovila.", "Dieses gespeicherte Symbol wird in diesem Editor nicht angeboten. Wählen Sie einen Ersatz oder entfernen Sie es."],
  names: {
    Activity: ["Activity", "Aktivita", "Aktivita", "Aktivitás", "Activitate", "Attività", "Aktivität"],
    AlertCircle: ["Attention", "Upozornenie", "Upozornění", "Figyelem", "Atenție", "Attenzione", "Achtung"],
    ArrowRight: ["Continue", "Pokračovať", "Pokračovat", "Folytatás", "Continuă", "Continua", "Weiter"],
    CalendarClock: ["Schedule callback", "Naplánovať callback", "Naplánovat callback", "Visszahívás ütemezése", "Programează reapelarea", "Programma richiamata", "Rückruf planen"],
    CheckCircle2: ["Completed", "Dokončené", "Dokončeno", "Befejezve", "Finalizat", "Completato", "Abgeschlossen"],
    CircleX: ["Not completed", "Nedokončené", "Nedokončeno", "Nincs befejezve", "Neîncheiat", "Non completato", "Nicht abgeschlossen"],
    ClipboardCheck: ["Verified", "Overené", "Ověřeno", "Ellenőrizve", "Verificat", "Verificato", "Geprüft"],
    Clock3: ["Follow up later", "Ozvať sa neskôr", "Ozvat se později", "Későbbi utánkövetés", "Revino mai târziu", "Ricontatta più tardi", "Später nachfassen"],
    HeartPulse: ["Patient care", "Starostlivosť o pacienta", "Péče o pacienta", "Betegellátás", "Îngrijirea pacientului", "Assistenza al paziente", "Patientenversorgung"],
    Mail: ["Send email", "Odoslať e-mail", "Odeslat e-mail", "E-mail küldése", "Trimite e-mail", "Invia email", "E-Mail senden"],
    MessageSquareText: ["Message", "Správa", "Zpráva", "Üzenet", "Mesaj", "Messaggio", "Nachricht"],
    PauseCircle: ["On hold", "Pozastavené", "Pozastaveno", "Felfüggesztve", "În așteptare", "In pausa", "Pausiert"],
    PhoneCall: ["Call", "Zavolať", "Zavolat", "Hívás", "Sună", "Chiama", "Anrufen"],
    PhoneOff: ["No answer", "Bez odpovede", "Bez odpovědi", "Nem válaszol", "Nu răspunde", "Nessuna risposta", "Keine Antwort"],
    RefreshCw: ["Retry", "Skúsiť znova", "Zkusit znovu", "Újrapróbálás", "Reîncearcă", "Riprova", "Erneut versuchen"],
    Stethoscope: ["Clinical review", "Klinické posúdenie", "Klinické posouzení", "Klinikai felülvizsgálat", "Evaluare clinică", "Valutazione clinica", "Klinische Prüfung"],
    UserRoundCheck: ["Confirmed contact", "Kontakt potvrdený", "Kontakt potvrzen", "Kapcsolat megerősítve", "Contact confirmat", "Contatto confermato", "Kontakt bestätigt"],
  },
} as const;

function localeIndex(locale: string) {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const index = ["en", "sk", "cs", "hu", "ro", "it", "de"].indexOf(language);
  return index < 0 ? 0 : index;
}

export function StatusListQuickOptionIconPicker({ value, onChange, locale, disabled = false, title }: {
  value: string | null;
  onChange: (value: string | null) => void;
  locale: string;
  disabled?: boolean;
  title?: string;
}) {
  const lang = localeIndex(locale);
  const known = value !== null && (QUICK_OPTION_ICON_NAMES as readonly string[]).includes(value);
  const copy = (values: readonly string[]) => values[lang] ?? values[0];

  return <fieldset disabled={disabled} className="min-w-0 space-y-2.5 border-0 p-0 dark:[&_[aria-pressed=true]]:text-foreground" data-testid="quick-option-icon-picker">
    <legend className="mb-2 text-xs font-medium">{title || copy(pickerCopy.title)}</legend>
    {value !== null && !known && <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs text-muted-foreground">
      <span className="flex min-w-0 items-center gap-2">
        <StatusListQuickOptionIcon name={value} className="h-4 w-4 shrink-0" />
        {copy(pickerCopy.unknown)}
      </span>
      <button type="button" className="shrink-0 rounded px-2 py-1 font-medium text-foreground underline decoration-border underline-offset-2 hover:text-primary disabled:opacity-50" disabled={disabled} onClick={() => onChange(null)}>
        {copy(pickerCopy.removeUnknown)}
      </button>
    </div>}
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
      <button type="button" aria-pressed={value === null} aria-label={copy(pickerCopy.none)} title={copy(pickerCopy.none)} disabled={disabled} onClick={() => onChange(null)}
        className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-border bg-muted/20 px-1.5 py-2 text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary">
        <span className="text-[10px] font-semibold leading-tight">{copy(pickerCopy.none)}</span>
      </button>
      {QUICK_OPTION_ICON_NAMES.map(name => {
        const label = copy(pickerCopy.names[name]);
        return <button key={name} type="button" data-testid={`quick-option-icon-${name}`} aria-pressed={value === name} aria-label={label} title={label} disabled={disabled} onClick={() => onChange(name)}
          className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-border bg-muted/20 px-1.5 py-2 text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary">
          <StatusListQuickOptionIcon name={name} className="h-4 w-4 shrink-0" />
          <span className="max-w-full truncate text-[9px] font-medium leading-tight">{label}</span>
        </button>;
      })}
    </div>
  </fieldset>;
}
