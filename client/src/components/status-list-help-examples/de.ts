import type { ExampleChapters } from "./types";

export const de: ExampleChapters = {
  healthcareExamples: {
    title: "Beispiele: Wechsel der Erreichbarkeit",
    paragraphs: [
      "Diese Zustände dienen als Bedingungen und Aktionsauslöser. Unterscheiden Sie den Zustandswechsel, etwa durch einen erfolgreichen Anruf, von der Automationsreaktion: Benachrichtigung, Aufgabe oder Bestätigung einer anderen Frage.",
      "DANN kann den Systemzustand derzeit nicht beliebig auf Reachable setzen. Dafür ist ein entsprechendes Anrufergebnis erforderlich. Dies sind Anleitungen, keine aktivierten Regeln; das Lesen erstellt und versendet nichts.",
      "Mission → Einstellungen → Status List → Regeln und Aktionen → Erreichbarkeit des Anbieters. Gemeinsame Konfiguration aufklappen und bei der Antwort Aktionen konfigurieren wählen. Für eine andere Zielfrage die Antwort unter WENN und Bedingungen unter FALLS wählen. Benötigte Zustände müssen aktiviert sein.",
    ],
    examples: [
      { title: "1. Unreachable → Reachable nach erfolgreichem Anruf", paragraphs: [
        "Situation: Fünf Versuche scheiterten. Beim nächsten antworten Arzt oder Personal. Die Verbindung erfüllt die Mindestgesprächsdauer, standardmäßig 3 Sekunden. Das System setzt Reachable und löscht den Fehlversuchszähler.",
        "WENN: Reachable aktiv wird\nDANN: intern benachrichtigen\n„Der Kontakt ist wieder erreichbar.“",
        "Unter Reachable → Aktionen konfigurieren einrichten oder die Antwort als Regelquelle für den normalen Schritt „Telefonkontakt geprüft“ nutzen.",
        "Achtung: Dies gilt allgemein beim Wechsel zu Reachable, nicht ausschließlich aus Unreachable.",
      ] },
      { title: "2. Wrong number → Aufgabe → bestätigter Anruf", paragraphs: [
        "Situation: Unter der Nummer antwortet die falsche Person.",
        "ABLAUF:\nNeue Aufgabe öffnen und Falsche Telefonnummer wählen\n↓ Grund und ein für Klinik oder Krankenhaus angebotenes vorhandenes Telefonfeld auswählen\n↓ die Aufgabe speichert Grund und gemeldete Nummer; eine neue Nummer muss nicht eingegeben werden\n↓ eine Korrektur im Gesundheitsdatensatz speichern und die korrigierte Nummer anrufen\n↓ beim Gesprächsabschluss nur bestätigen, wenn der richtige Anbieter oder das richtige Personal erreicht wurde",
        "Überprüfung anfordern ist nur eine Anfrage und ändert den Erreichbarkeitsstatus nicht. Die Bestätigung erscheint erst, wenn der Server einen passenden Anruf und eine Nummer mit der Meldung oder Korrektur verknüpft hat. Der Anruf muss die konfigurierte Mindestgesprächsdauer erfüllen. Eine technische Annahme allein ist keine Bestätigung.",
        "Die Anfrage ist an die aktuelle Mission, Sitzung, Gesundheitseinrichtung, den Vorgang und die Nummer gebunden. Nach einem Kontaktwechsel keine alte Aufgabe bestätigen.",
        "Eine Nummernkorrektur allein beweist keine erfolgreiche Verbindung. Vor der Verifizierung sind ein passender Anruf mit ausreichender Dauer und die ausdrückliche Bestätigung des Agenten erforderlich.",
      ] },
      { title: "3. Fünf Fehlversuche → E-Mail", paragraphs: [
        "Grenzwert 5 beibehalten und unter Unreachable → Aktionen konfigurieren eine E-Mail-Aktion hinzufügen.",
        "WENN: Unreachable aktiv wird\nFALLS: Erreichbarkeit = Unreachable\nUND: Fehlversuche ≥ 5\nDANN: E-Mail an festgelegten Empfänger senden",
        "Empfänger, Betreff, Inhalt und automatische Ausführung oder Prüfung festlegen. Der Zustandswechsel löst die E-Mail aus, nicht jedes Kartenöffnen oder jeder weitere Fehlversuch.",
      ] },
      { title: "4. Not working → ausgewählte Nummer melden", paragraphs: [
        "Neue Aufgabe öffnen, Falsche Telefonnummer und den Grund „Nummer funktioniert nicht“ wählen, dann das vorhandene zu prüfende Telefonfeld auswählen.",
        "Die Aufgabe speichert Nummer und Grund. Sie ändert weder stillschweigend die Erreichbarkeit noch ergänzt sie eine Ersatznummer; Korrekturen werden wie üblich im Gesundheitsdatensatz vorgenommen.",
        "Nach einer Korrektur kann beim Gesprächsabschluss ein passender Anruf mit Mindestgesprächsdauer überprüft werden. Der Agent muss den richtigen Anbieter oder das richtige Personal ausdrücklich bestätigen; eine technische Annahme reicht nicht.",
      ] },
      { title: "5. Erreichbarkeit als Bedingung einer normalen Frage", paragraphs: [
        "Nicht nur die sieben Zustände können Auslöser sein.",
        "WENN: Agent „Telefonansprache fortsetzen“ bestätigt\nFALLS: Erreichbarkeit = Reachable\nDANN: „Telefonkontakt geprüft“ bestätigen",
        "Oder eine einzelne Aktion begrenzen:\nNur ausführen, falls Zustand = Unreachable\nUND Fehlversuche ≥ 5.",
        "Eine Zielbestätigung führt nicht zwingend deren Aktionen aus. Zielautomationen bei Bedarf ausdrücklich aktivieren und Schleifen sowie Dopplungen prüfen.",
      ] },
      { title: "Aktuelle Grenzen", paragraphs: [
        "„Wechselt zu Reachable“ und „aktueller Zustand ist Reachable“ sind möglich. Der genaue Filter „vorher Wrong number, jetzt Reachable“ fehlt derzeit.",
        "Reachable bleibt nach späteren Fehlversuchen erhalten; diese werden separat erfasst. Ein normaler Fehlversuch setzt den Zustand daher nicht automatisch auf Unreachable zurück.",
        "Zustand und Zähler stammen aus einer Konfiguration für Mission und Kontakt. Fehlende oder mehrdeutige Quellen, Pausen und unzulässige Ergebnisse gelten nicht als erfüllte Bedingungen.",
      ] },
    ],
  },
  previousAutomationExamples: {
    title: "Beispiele: weitere Automationen",
    paragraphs: [
      "Diese Beispiele erläutern früher vorbereitete Möglichkeiten. Name, Beschreibung oder SYS allein führen nichts aus; tatsächliche Aktion und Parameter prüfen.",
      "Je Aktion automatische Ausführung oder Prüfung und Bestätigung wählen. Verstecken deaktiviert die Auswertung nicht. Die erste Beobachtung eines bestehenden Zustands ist eine Ausgangsbasis, kein rückwirkender Ausführungsauftrag. Im Batch-Modus das Speichern der Status List beachten.",
    ],
    examples: [
      { title: "1. Unreached → Rückruf in sechs Arbeitstagen", paragraphs: [
        "Situation: Fehlversuch unterhalb des Unreachable-Grenzwerts, ohne beibehaltenes Reachable.",
        "WENN: neuer Fehlversuch Unreached aktiviert\nDANN: Rückruf in 6 Arbeitstagen um 09:00 planen",
        "Unter Unreached → Aktionen konfigurieren 6 Tage, Arbeitstage, 09:00 und die Regel für bestehende Rückrufe prüfen. Die erstellte Standardaktion behält einen vorhandenen Rückruf bei, statt vereinbarte Termine automatisch zu verschieben.",
        "Der Koordinator kann den Termin in Queue ändern. Erneutes Kartenöffnen erzeugt keinen zusätzlichen Rückruf.",
      ] },
      { title: "2. Verbundene Mailbox → Korrektur auf Unreached", paragraphs: [
        "Situation: Technische Verbindung, aber Mailbox statt Arzt oder Personal.",
        "ABLAUF: Zustand prüfen öffnen\nMARKIEREN: letzten verbundenen Anruf als Mailbox\nSPEICHERN: Prüfung",
        "Dieser Anruf belegt Reachable nicht mehr. Ohne anderen erfolgreichen Anruf folgt unterhalb des Grenzwerts Unreached, am Grenzwert möglicherweise Unreachable. Aktionen richten sich nach dem tatsächlichen Ergebnis.",
        "Die Markierung gehört zum konkreten letzten Anruf. Nicht jeder kurze Anruf ist automatisch eine Mailbox.",
      ] },
      { title: "3. Long-term absent → interne Benachrichtigung", paragraphs: [
        "Koordinator prüft längere Abwesenheit und speichert Long-term absent über Zustand prüfen.",
        "WENN: Long-term absent aktiv wird\nDANN: festgelegten Benutzer oder Gruppe benachrichtigen\n„Weiteres Vorgehen während der längeren Abwesenheit prüfen.“",
        "Empfänger und Nachricht festlegen. Der Zustand ändert den Zähler nicht und hat keine automatische Zeitgrenze. „In einem Monat anrufen“ plant keinen Rückruf; dafür eine eigene unterstützte Aktion konfigurieren.",
      ] },
      { title: "4. Kommunikationsverlauf → Aktionsbedingung", paragraphs: [
        "Beim Bestätigen einer normalen Frage berücksichtigen, ob in dieser Mission bereits eine gesendete E-Mail erfasst ist.",
        "WENN: Agent die Frage bestätigt\nFALLS: Kommunikationsverlauf — E-Mail gesendet = ja\nDANN: „E-Mail bereits gesendet“ bestätigen",
        "Verlaufsfeld statt Notiz oder Telefonnummer wählen. Weitere Aktion am Zielschritt konfigurieren und ihre Ausführung durch die Regel ausdrücklich erlauben.",
        "Gesendet beweist weder Zustellung noch Antwort. Die Bedingung ist kein „X Tage ohne Antwort“-Timer und unterscheidet allein keine bestimmte Vorlage oder Nachricht.",
      ] },
    ],
  },
};
