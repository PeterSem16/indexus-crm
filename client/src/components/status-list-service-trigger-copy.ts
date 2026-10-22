const copy = {
  en: {
    blocked: "This answer is selected by the system. These service actions run on agent confirmation, not on a background change. They will not run here. Use a Background transition rule below for supported answer/note changes. Automatic email, SMS and task services are not connected to this source.",
    loading: "Checking what triggers this action…",
    error: "The action trigger could not be verified. Reload before adding or editing actions.",
    manual: "Trigger: agent confirmation. IF is checked only when that confirmation invokes the action; opening the card does not run it.",
    inactive: "Not connected to background changes",
  },
  sk: {
    blocked: "Túto odpoveď vyberá systém. Tieto servisné akcie sa spúšťajú potvrdením agentom, nie zmenou na pozadí. Na tomto mieste sa nevykonajú. Na podporované zmeny odpovedí a poznámok použite nižšie pravidlo Zmena na pozadí. Automatické e-maily, SMS a úlohy nie sú na tento zdroj napojené.",
    loading: "Overujem, čo spúšťa túto akciu…",
    error: "Spúšťač akcie sa nepodarilo overiť. Pred pridaním alebo úpravou akcií obnovte údaje.",
    manual: "Spúšťač: potvrdenie agentom. IF sa overí až pri vyvolaní akcie týmto potvrdením; otvorenie karty ju nespustí.",
    inactive: "Nenapojené na zmeny na pozadí",
  },
  cs: {
    blocked: "Tuto odpověď vybírá systém. Tyto servisní akce spouští potvrzení agentem, nikoli změna na pozadí. Zde se neprovedou. Pro podporované změny odpovědí a poznámek použijte níže pravidlo Změna na pozadí. Automatické e-maily, SMS a úkoly nejsou na tento zdroj napojeny.",
    loading: "Ověřuji spouštěč této akce…",
    error: "Spouštěč akce se nepodařilo ověřit. Před přidáním nebo úpravou akcí obnovte údaje.",
    manual: "Spouštěč: potvrzení agentem. IF se ověří až při vyvolání akce tímto potvrzením; otevření karty ji nespustí.",
    inactive: "Nenapojeno na změny na pozadí",
  },
  hu: {
    blocked: "Ezt a választ a rendszer választja ki. Ezeket a szolgáltatási műveleteket az ügynöki megerősítés indítja, nem a háttérváltozás. Itt nem futnak le. A támogatott válasz- és jegyzetmódosításhoz használja lent a Háttérváltozás szabályt. Az automatikus e-mail, SMS és feladat nincs ehhez a forráshoz kapcsolva.",
    loading: "A művelet indítójának ellenőrzése…",
    error: "A művelet indítója nem ellenőrizhető. Hozzáadás vagy szerkesztés előtt frissítse az adatokat.",
    manual: "Indító: ügynöki megerősítés. Az IF csak a megerősítéskor vizsgálódik; a kártya megnyitása nem indít műveletet.",
    inactive: "Nincs háttérváltozáshoz kapcsolva",
  },
  ro: {
    blocked: "Acest răspuns este selectat de sistem. Aceste acțiuni de serviciu pornesc la confirmarea agentului, nu la o schimbare în fundal. Nu se vor executa aici. Pentru modificările acceptate de răspunsuri și note folosiți mai jos regula Tranziție în fundal. E-mailurile, SMS-urile și sarcinile automate nu sunt conectate la această sursă.",
    loading: "Se verifică declanșatorul acțiunii…",
    error: "Declanșatorul nu a putut fi verificat. Reîncărcați înainte de adăugarea sau editarea acțiunilor.",
    manual: "Declanșator: confirmarea agentului. IF se verifică doar când confirmarea invocă acțiunea; deschiderea fișei nu o execută.",
    inactive: "Neconectat la schimbările în fundal",
  },
  it: {
    blocked: "Questa risposta è selezionata dal sistema. Queste azioni di servizio partono dalla conferma dell'agente, non da una modifica in background. Qui non verranno eseguite. Per le modifiche supportate a risposte e note usare sotto la regola Transizione in background. Email, SMS e attività automatiche non sono collegati a questa sorgente.",
    loading: "Verifica del trigger dell'azione…",
    error: "Impossibile verificare il trigger. Ricaricare prima di aggiungere o modificare azioni.",
    manual: "Trigger: conferma dell'agente. IF viene verificato quando la conferma richiama l'azione; aprire la scheda non la esegue.",
    inactive: "Non collegato alle modifiche in background",
  },
  de: {
    blocked: "Diese Antwort wird vom System gewählt. Diese Serviceaktionen starten bei einer Agentenbestätigung, nicht bei einer Hintergrundänderung. Hier werden sie nicht ausgeführt. Für unterstützte Antwort- und Notizänderungen unten eine Hintergrundänderungsregel verwenden. Automatische E-Mails, SMS und Aufgaben sind nicht mit dieser Quelle verbunden.",
    loading: "Auslöser der Aktion wird geprüft…",
    error: "Der Auslöser konnte nicht geprüft werden. Vor dem Hinzufügen oder Bearbeiten neu laden.",
    manual: "Auslöser: Agentenbestätigung. IF wird erst beim Aufruf durch diese Bestätigung geprüft; das Öffnen der Karte führt nichts aus.",
    inactive: "Nicht mit Hintergrundänderungen verbunden",
  },
};
export function getServiceTriggerCopy(locale: string) {
  return copy[locale as keyof typeof copy] || copy.en;
}
