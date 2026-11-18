export interface AIJobCopy { pending: string; processing: string; completed: string; failed: string; continueWorking: string }
export const aiJobTranslations: Record<"en" | "sk" | "cs" | "hu" | "ro" | "it" | "de", AIJobCopy> = {
  en: { pending: "Waiting for processing", processing: "Processing", completed: "Completed", failed: "Processing failed", continueWorking: "You can continue working. The result will appear here when ready." },
  sk: { pending: "Čaká na spracovanie", processing: "Spracúva sa", completed: "Dokončené", failed: "Nepodarilo sa spracovať", continueWorking: "Môžete pokračovať v práci. Výsledok sa tu zobrazí po dokončení." },
  cs: { pending: "Čeká na zpracování", processing: "Zpracovává se", completed: "Dokončeno", failed: "Zpracování se nezdařilo", continueWorking: "Můžete pokračovat v práci. Výsledek se zde zobrazí po dokončení." },
  hu: { pending: "Feldolgozásra vár", processing: "Feldolgozás alatt", completed: "Befejezve", failed: "A feldolgozás sikertelen", continueWorking: "Folytathatja a munkát. Az eredmény itt jelenik meg, amikor elkészül." },
  ro: { pending: "În așteptarea procesării", processing: "Se procesează", completed: "Finalizat", failed: "Procesarea a eșuat", continueWorking: "Puteți continua lucrul. Rezultatul va apărea aici când este gata." },
  it: { pending: "In attesa di elaborazione", processing: "Elaborazione in corso", completed: "Completato", failed: "Elaborazione non riuscita", continueWorking: "Puoi continuare a lavorare. Il risultato apparirà qui quando sarà pronto." },
  de: { pending: "Wartet auf Verarbeitung", processing: "Wird verarbeitet", completed: "Abgeschlossen", failed: "Verarbeitung fehlgeschlagen", continueWorking: "Sie können weiterarbeiten. Das Ergebnis erscheint hier, sobald es bereit ist." },
};
