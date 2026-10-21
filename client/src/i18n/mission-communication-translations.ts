const missionCommunicationTranslations = {
  en: {
    agentSender: "Triggering agent's personal M365 account", missionSender: "Use Mission settings",
    agentHelp: "Uses the agent who triggered this action, not the rule author. The agent must have an active shift in this Mission and a connected M365 account. Without that agent, sending fails; no other account is substituted.",
    missionHelp: "At execution time, uses this Mission's Nexus Pulse email setting: system account, triggering agent's account, or the Mission shared mailbox. Shared mailboxes require that agent's access.",
    smsMission: "Use Mission SMS settings",
    smsHelp: "Uses the gateway configured in the actual Mission; if none is selected, uses its country default. SMS is attributed to the triggering agent, not sent from a personal M365 mailbox.",
  },
  sk: {
    agentSender: "Osobný M365 účet agenta, ktorý akciu vyvolal", missionSender: "Podľa nastavenia Mission",
    agentHelp: "Použije agenta, ktorý akciu vyvolal, nie autora pravidla. Agent musí mať aktívnu zmenu v tejto Mission a pripojený M365 účet. Bez neho sa odoslanie zastaví; iný účet sa nepoužije.",
    missionHelp: "Pri vykonaní použije e-mailové nastavenie Nexus Pulse tejto Mission: systémový účet, účet vyvolávajúceho agenta alebo zdieľanú schránku Mission. Zdieľaná schránka vyžaduje prístup tohto agenta.",
    smsMission: "Podľa SMS nastavenia Mission",
    smsHelp: "Použije bránu skutočnej Mission; ak nie je vybraná, použije predvolenú bránu jej krajiny. SMS sa priradí vyvolávajúcemu agentovi, neposiela sa z osobnej M365 schránky.",
  },
  cs: {
    agentSender: "Osobní M365 účet agenta, který akci vyvolal", missionSender: "Podle nastavení Mission",
    agentHelp: "Použije agenta, který akci vyvolal, ne autora pravidla. Agent musí mít aktivní směnu v této Mission a připojený M365 účet. Bez něj se odeslání zastaví; jiný účet se nepoužije.",
    missionHelp: "Při provedení použije e-mailové nastavení Nexus Pulse této Mission: systémový účet, účet vyvolávajícího agenta nebo sdílenou schránku Mission. Sdílená schránka vyžaduje přístup tohoto agenta.",
    smsMission: "Podle SMS nastavení Mission",
    smsHelp: "Použije bránu skutečné Mission; není-li vybrána, použije výchozí bránu její země. SMS se přiřadí vyvolávajícímu agentovi, neposílá se z osobní M365 schránky.",
  },
  hu: {
    agentSender: "A műveletet kiváltó ügynök személyes M365-fiókja", missionSender: "Mission-beállítások használata",
    agentHelp: "A kiváltó ügynököt használja, nem a szabály szerzőjét. Aktív műszak szükséges ebben a Missionben és csatlakoztatott M365-fiók. Enélkül a küldés leáll; más fiókra nem vált.",
    missionHelp: "Végrehajtáskor a Mission Nexus Pulse e-mail-beállítását használja: rendszerfiók, kiváltó ügynök vagy megosztott postafiók. A megosztott fiókhoz az ügynök hozzáférése szükséges.",
    smsMission: "A Mission SMS-beállításai",
    smsHelp: "A tényleges Mission átjáróját használja, ennek hiányában az ország alapértelmezett átjáróját. Az SMS a kiváltó ügynökhöz tartozik, nem személyes M365-postafiókból érkezik.",
  },
  ro: {
    agentSender: "Contul M365 personal al agentului care a declanșat acțiunea", missionSender: "Folosește setările Mission",
    agentHelp: "Folosește agentul care a declanșat acțiunea, nu autorul regulii. Necesită o tură activă în această Mission și un cont M365 conectat. Altfel, trimiterea se oprește, fără înlocuirea contului.",
    missionHelp: "La executare folosește setarea de e-mail Nexus Pulse a Mission: cont de sistem, agentul declanșator sau căsuța partajată. Căsuța partajată necesită accesul agentului.",
    smsMission: "Folosește setările SMS ale Mission",
    smsHelp: "Folosește gateway-ul Mission reale sau, dacă lipsește, cel implicit al țării. SMS-ul este atribuit agentului declanșator, nu trimis din căsuța M365 personală.",
  },
  it: {
    agentSender: "Account M365 personale dell'agente che attiva l'azione", missionSender: "Usa le impostazioni Mission",
    agentHelp: "Usa l'agente che attiva l'azione, non l'autore della regola. Richiede un turno attivo in questa Mission e un account M365 connesso. Altrimenti l'invio si arresta, senza sostituire l'account.",
    missionHelp: "All'esecuzione usa l'impostazione email Nexus Pulse della Mission: account di sistema, agente attivante o casella condivisa. La casella condivisa richiede l'accesso dell'agente.",
    smsMission: "Usa le impostazioni SMS della Mission",
    smsHelp: "Usa il gateway della Mission effettiva o quello predefinito del paese se assente. L'SMS è attribuito all'agente attivante, non inviato dalla casella M365 personale.",
  },
  de: {
    agentSender: "Persönliches M365-Konto des auslösenden Agenten", missionSender: "Mission-Einstellungen verwenden",
    agentHelp: "Verwendet den auslösenden Agenten, nicht den Regelautor. Erfordert eine aktive Schicht in dieser Mission und ein verbundenes M365-Konto. Andernfalls wird der Versand gestoppt; kein anderes Konto wird eingesetzt.",
    missionHelp: "Verwendet zur Ausführung die Nexus-Pulse-E-Mail-Einstellung der Mission: Systemkonto, auslösender Agent oder freigegebenes Postfach. Das freigegebene Postfach erfordert den Zugriff des Agenten.",
    smsMission: "SMS-Einstellungen der Mission verwenden",
    smsHelp: "Verwendet das Gateway der tatsächlichen Mission, andernfalls den Länderstandard. Die SMS wird dem auslösenden Agenten zugeordnet, nicht aus einem persönlichen M365-Postfach versendet.",
  },
};
export default missionCommunicationTranslations;
