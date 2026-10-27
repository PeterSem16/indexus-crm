import type { ExampleChapters } from "./types";

export const it: ExampleChapters = {
  healthcareExamples: {
    title: "Esempi: transizioni di reperibilità",
    paragraphs: [
      "Gli stati possono essere condizioni e attivatori di azioni. Distinguere il cambio di reperibilità, per esempio da Unreachable a Reachable dopo una chiamata riuscita, dalla risposta dell'automazione: notifica, attività o conferma di un'altra domanda.",
      "ALLORA non può attualmente impostare arbitrariamente lo stato di sistema su Reachable: serve un risultato di chiamata valido. Queste sono istruzioni, non regole attivate; leggere la guida non crea e non invia nulla.",
      "Mission → Impostazioni → Status List → Regole e azioni → Reperibilità del fornitore. Espandere la configurazione condivisa e configurare le azioni della risposta. Per un'altra domanda, scegliere la risposta in QUANDO e aggiungere le condizioni in SE. Gli stati necessari devono essere abilitati.",
    ],
    examples: [
      { title: "1. Unreachable → Reachable dopo una chiamata riuscita", paragraphs: [
        "Situazione: Cinque tentativi falliti. Al successivo risponde il medico o il personale. La conversazione raggiunge il minimo configurato, 3 secondi per impostazione predefinita. Il sistema imposta Reachable e azzera i tentativi falliti.",
        "QUANDO: si attiva Reachable\nALLORA: inviare una notifica interna\n«Il contatto è nuovamente reperibile.»",
        "Configurare la notifica nelle azioni di Reachable, oppure usare la risposta come origine di una regola che conferma il passaggio ordinario «Contatto telefonico verificato».",
        "Attenzione: si reagisce all'ingresso in Reachable in generale, non soltanto provenendo da Unreachable.",
      ] },
      { title: "2. Wrong number → attività → chiamata confermata", paragraphs: [
        "Situazione: Al numero risponde la persona sbagliata.",
        "PROCEDURA:\nApri Nuova attività e scegli Numero di telefono errato\n↓ seleziona il motivo e un campo telefonico esistente proposto per la clinica o l'ospedale\n↓ l'attività registra il motivo e il numero segnalato; non è richiesto inserire un nuovo numero\n↓ salva eventuali correzioni nella scheda sanitaria e chiama il numero corretto\n↓ alla chiusura della chiamata conferma solo dopo aver raggiunto il fornitore o il personale corretto",
        "Richiedere la verifica è solo una richiesta e non modifica da sola lo stato di reperibilità sanitaria. Il controllo di conferma appare solo quando il server collega una chiamata e un numero corrispondenti alla segnalazione o alla correzione. La chiamata deve raggiungere la durata minima configurata. La risposta tecnica da sola non è una conferma.",
        "La richiesta è collegata alla Mission, alla sessione, all'entità sanitaria, alla segnalazione e al numero correnti. Dopo aver cambiato contatto non confermare una vecchia attività.",
        "La correzione del numero da sola non dimostra una connessione riuscita. Servono una chiamata corrispondente di durata sufficiente e la conferma esplicita dell'agente.",
      ] },
      { title: "3. Cinque tentativi falliti → e-mail", paragraphs: [
        "Mantenere la soglia 5 e aggiungere un'azione e-mail alle azioni di Unreachable.",
        "QUANDO: si attiva Unreachable\nSE: reperibilità = Unreachable\nE: tentativi falliti ≥ 5\nALLORA: inviare un'e-mail al destinatario designato",
        "Impostare destinatario, oggetto, contenuto ed esecuzione automatica o previa verifica. L'e-mail parte al cambio di stato, non a ogni apertura della scheda o a ogni ulteriore tentativo fallito.",
      ] },
      { title: "4. Not working → segnalazione del numero selezionato", paragraphs: [
        "Apri Nuova attività, scegli Numero di telefono errato, seleziona il motivo «Il numero non funziona» e il campo telefonico esistente da verificare.",
        "L'attività registra il numero e il motivo. Non modifica silenziosamente la reperibilità e non aggiunge un numero sostitutivo; aggiorna la scheda sanitaria attraverso il normale processo di correzione.",
        "Dopo la correzione, alla chiusura della chiamata si può verificare una chiamata corrispondente che raggiunge la durata minima. L'agente deve confermare esplicitamente il fornitore o il personale corretto; la risposta tecnica non basta.",
      ] },
      { title: "5. Reperibilità come condizione di una domanda ordinaria", paragraphs: [
        "L'attivatore non deve necessariamente essere uno dei sette stati.",
        "QUANDO: l'agente conferma «Continuare il contatto telefonico»\nSE: reperibilità = Reachable\nALLORA: confermare «Contatto telefonico verificato»",
        "Oppure limitare una singola azione:\nEseguire solo se stato = Unreachable\nE tentativi falliti ≥ 5.",
        "Confermare un'altra domanda non ne esegue necessariamente le azioni. Abilitare esplicitamente le automazioni della destinazione se necessario, verificando cicli e duplicati.",
      ] },
      { title: "Limiti attuali", paragraphs: [
        "Sono disponibili «entra in Reachable» e «stato attuale Reachable». Non è ancora disponibile il filtro esatto «prima Wrong number, ora Reachable».",
        "Reachable rimane dopo un successivo tentativo fallito, registrato separatamente. Un normale fallimento non provoca quindi il ritorno automatico a Unreachable.",
        "Stato e contatore provengono dalla configurazione della Mission e del contatto pertinenti. Origini mancanti o ambigue, sospensioni e risultati non consentiti non valgono come condizioni soddisfatte.",
      ] },
    ],
  },
  previousAutomationExamples: {
    title: "Esempi: altre automazioni",
    paragraphs: [
      "Esempi dettagliati delle possibilità già preparate. Nome, descrizione o SYS non eseguono nulla da soli: verificare l'azione effettiva e i parametri.",
      "Scegliere per ogni azione esecuzione automatica o verifica e conferma. Nascondere l'origine non disabilita la valutazione. La prima osservazione di uno stato esistente è una base iniziale, non un ordine di eseguire azioni retroattive. In Batch rispettare il salvataggio della Status List.",
    ],
    examples: [
      { title: "1. Unreached → richiamata tra sei giorni lavorativi", paragraphs: [
        "Situazione: Tentativo fallito sotto la soglia Unreachable, senza Reachable conservato.",
        "QUANDO: un nuovo tentativo fallito attiva Unreached\nALLORA: pianificare una richiamata tra 6 giorni lavorativi alle 09:00",
        "Nelle azioni di Unreached verificare 6 giorni, giorni lavorativi, 09:00 e gestione della richiamata esistente. L'azione creata per impostazione predefinita conserva l'appuntamento esistente, senza spostarlo automaticamente.",
        "Il coordinatore può modificarlo in Queue. Riaprire la scheda non crea un'altra richiamata.",
      ] },
      { title: "2. Segreteria collegata → correzione a Unreached", paragraphs: [
        "Situazione: Connessione tecnica, ma risponde la segreteria anziché medico o personale.",
        "PROCEDURA: aprire la verifica dello stato\nSEGNARE: l'ultima chiamata connessa come segreteria\nSALVARE: la verifica",
        "Questa chiamata non dimostra più Reachable. Senza altre chiamate riuscite, sotto soglia risulta Unreached; alla soglia può risultare Unreachable. Le azioni seguono il risultato effettivo.",
        "La marcatura riguarda l'ultima chiamata specifica. Non significa che ogni chiamata breve sia segreteria.",
      ] },
      { title: "3. Long-term absent → notifica interna", paragraphs: [
        "Il coordinatore verifica l'assenza prolungata e salva Long-term absent nella verifica dello stato.",
        "QUANDO: si attiva Long-term absent\nALLORA: notificare l'utente o gruppo designato\n«Verificare i prossimi passi durante l'assenza prolungata.»",
        "Impostare destinatario e messaggio. Lo stato non cambia il contatore e non ha una scadenza automatica. «Richiamare tra un mese» non crea una richiamata: occorre un'azione supportata separata.",
      ] },
      { title: "4. Cronologia comunicazioni → condizione per un'azione", paragraphs: [
        "Alla conferma di una domanda ordinaria, considerare se nella Mission è già registrata un'e-mail inviata.",
        "QUANDO: l'agente conferma la domanda\nSE: cronologia comunicazioni — e-mail inviata = sì\nALLORA: confermare «E-mail già inviata»",
        "Scegliere il campo della cronologia, non una nota o un numero. Per collegare un'altra azione, configurarla sul passaggio di destinazione e consentirne esplicitamente l'esecuzione dalla regola.",
        "Invio non significa consegna o risposta. Non è un timer «X giorni senza risposta» e da solo non identifica un modello o contenuto specifico.",
      ] },
    ],
  },
};
