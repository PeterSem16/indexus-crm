import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const copy = {
  sk: { title: "Potvrdiť zmenu", cancel: "Zrušiť", confirm: "Potvrdiť", remove: "Odstrániť", hint: "Skontrolujte zmenu pred pokračovaním." },
  en: { title: "Confirm change", cancel: "Cancel", confirm: "Confirm", remove: "Delete", hint: "Review this change before continuing." },
  cs: { title: "Potvrdit změnu", cancel: "Zrušit", confirm: "Potvrdit", remove: "Odstranit", hint: "Před pokračováním zkontrolujte změnu." },
  hu: { title: "Módosítás megerősítése", cancel: "Mégse", confirm: "Megerősítés", remove: "Törlés", hint: "Folytatás előtt ellenőrizze a módosítást." },
  ro: { title: "Confirmă modificarea", cancel: "Anulează", confirm: "Confirmă", remove: "Șterge", hint: "Verifică modificarea înainte de a continua." },
  it: { title: "Conferma modifica", cancel: "Annulla", confirm: "Conferma", remove: "Elimina", hint: "Controlla la modifica prima di continuare." },
  de: { title: "Änderung bestätigen", cancel: "Abbrechen", confirm: "Bestätigen", remove: "Löschen", hint: "Prüfen Sie die Änderung, bevor Sie fortfahren." },
};
type Options = { title?: string; confirmLabel?: string; destructive?: boolean };
type Request = { message: string; locale: string; options?: Options };
type Confirm = (message: string, locale: string, options?: Options) => Promise<boolean>;
const Context = createContext<Confirm | null>(null);

/** One modal per editor; overlapping requests fail closed instead of replacing
 * the intent the user is currently reviewing. No browser-dialog interception. */
export function StatusListConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const finish = useCallback((accepted: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(accepted);
  }, []);
  const confirm = useCallback<Confirm>((message, locale, options) => {
    if (pending.current) return Promise.resolve(false);
    return new Promise(resolve => {
      pending.current = resolve;
      setRequest({ message, locale, options });
    });
  }, []);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  const text = copy[request?.locale as keyof typeof copy] || copy.en;
  const destructive = request?.options?.destructive;
  return <Context.Provider value={confirm}>
    {children}
    <AlertDialog open={!!request} onOpenChange={open => { if (!open) finish(false); }}>
      <AlertDialogContent className="z-[12051] w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 overflow-hidden" overlayClassName="z-[12050] bg-black/45 backdrop-blur-sm" data-testid="status-list-confirm-modal">
        <AlertDialogHeader className="p-6 pb-3 text-left">
          <span className={`mb-2 flex h-11 w-11 items-center justify-center rounded-xl ${destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {destructive ? <Trash2 size={21}/> : <ShieldCheck size={21}/>}
          </span>
          <AlertDialogTitle>{request?.options?.title || text.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap leading-relaxed">{request?.message}</AlertDialogDescription>
          <p className="pt-2 text-xs text-muted-foreground">{text.hint}</p>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t bg-muted/30 p-4">
          <AlertDialogCancel onClick={() => finish(false)} data-testid="status-list-confirm-cancel">{text.cancel}</AlertDialogCancel>
          <AlertDialogAction className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={() => finish(true)} data-testid="status-list-confirm-accept">
            {request?.options?.confirmLabel || (destructive ? text.remove : text.confirm)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Context.Provider>;
}

export function useStatusListConfirm(locale: string) {
  const confirm = useContext(Context);
  if (!confirm) throw new Error("Status List confirmation provider is missing");
  return useCallback((message: string, options?: Options) => confirm(message, locale, options), [confirm, locale]);
}
