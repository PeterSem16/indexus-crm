// Explicit synthetic inputs. No real record, mailbox, audio or application storage is read.
const text = "SYNTETICKÝ TEST C1. Prosím potvrďte prijatie správy. Ďakujem.";
function bindingsFor(id) {
  const b = {
    subject: "SYNTETICKÝ TEST C1", content: text, text, query: "správy z 14. novembra 2026",
    transcript: "TEST Agent: Dobrý deň. TEST Klient: Prosím pošlite informácie. TEST Agent: Pošlem ich.",
    meetingSubject: "SYNTETICKÝ TEST C1", today: "2026-11-15", locale: "sk",
    language: "sk", targetLanguage: "en", targetCountryCode: "US", sourceLang: "Slovak",
    emailFrom: "synthetic@example.invalid", emailSubject: "SYNTETICKÝ TEST C1",
    plainBody: text, bodyWithoutSig: "<p>" + text + "</p>",
    templateType: "custom", customPrompt: "Napíšte potvrdenie prijatia syntetickej správy.",
    recipientInfo: "Príjemca: TEST C1, synthetic@example.invalid\n",
    collab: { firstName: "TEST", lastName: "C1", collaboratorType: "doctor", isActive: true, countryCode: "SK" },
    hasHospitalLinks: false, agreements: [], assignments: [], catMap: {},
    categories: [{ code: "doctor", name: "Lekár", nameEn: "Doctor", entityScope: "collaborator" }],
    items: [{ id: "SYN-C1-1", name: "Kontaktovaný", itemType: "step" }],
    listForAI: [{ id: "SYN-C1-1", name: "Kontaktovaný", itemType: "step" }],
    transcriptionText: text, isAgentOnlyRecording: true, scriptSection: "", alertSection: "",
    fieldNames: ["Vorname", "Nachname"], crmFieldsDescription: "firstName: meno; lastName: priezvisko",
    country: "Slovensko", countryName: "Slovakia", countryCode: "SK", city: "Bratislava",
    street: "", categoryName: "Syntetická zmluva", customerName: "TEST C1",
    customerCountry: "SK", billingCompany: "TEST C1", currency: "EUR", first: "Jana", last: "Testová",
    targetModule: "clinics", moduleDescriptions: { clinics: "Clinics" },
    existingData: { count: 0, coveredCities: [], specializations: [], types: [] },
    sourceInfo: "", learningContext: "", avoidContext: "", scenarioCount: 2,
    moduleInfo: { description: "synthetic clinics", searchFocus: "directories" },
    localLang: "Slovak", segmentParts: ["gynekológia"], locationParts: ["Bratislava"],
    keywords: "synthetic clinic", SP: { queryCount: 20 },
    dataForAnalysis: { synthetic: true, totalNucleatedCells: null },
    source: { language: "sk", content: "<p>" + text + "</p>", countryCode: "SK" },
    isHtml: false, fullName: "TEST C1", email: "synthetic@example.invalid",
    submission: { isNewCustomer: true }, customerData: null, data: {},
    safeLabel: "Meno", safeType: "text", fieldKey: "firstName", valStr: "Jankoo", contextFields: [],
    name: "Odberové súpravy", scopeLabel: "clinic", lang: "sk", roomId: "SYN-C1",
    participantList: "TEST Agent, TEST Klient", transcriptText: text,
    batch: [{ city: "Bratislava", street_number: "", postal_code: "81101" }],
    stats: { periodStartStr: "2026-11-01", periodEndStr: "2026-11-14", total: 0, prevTotal: 0,
      byCountry: {}, byState: {}, byMonth: {}, byGender: {}, withHospital: 0, withLabResults: 0 },
    localeMap: { sk: "Slovak" }, userLocale: "sk", periodType: "month",
    ttsVoice: "alloy", textContent: "Toto je syntetická testovacia nahrávka C1.",
    pdfText: "SYNTETICKÝ TEST C1\nVorname: TEST\nNachname: C1",
    extractText: false, targetLang: "en", participant: { language: "sk" },
    vocabulary: { "Bratislavský kraj": ["Bratislava I"] },
    address: { city: "Bratislava", postalCode: "81101", countryCode: "SK" },
    userMsg: "SYNTETICKÝ TEST C1. Žiadne kontaktné údaje.",
    context: { sensitiveValues: [] }, customerInfo: "", websiteInfo: "",
    config: { language: "sk", systemPrompt: "Ste syntetický testovací hlasový asistent INDEXUS." },
    session: { callerNumber: "SYN-C1", messages: [] }, gptMaxTokens: 150, gptTemp: 0.3,
    locations: [{ city: "Bratislava", country: "SK" }, { city: "Košice", country: "SK" }],
    requestLocations: [{ id: "0", city: "Bratislava", country: "SK" }, { id: "1", city: "Košice", country: "SK" }],
    repair: null,
    script: { steps: [{ id: "SYN-C1", title: "Pozdrav", description: "Dobrý deň, {{firstName}}." }] },
    segment: "gynekológia", location: "Bratislava", goal: "Nájsť gynekologické ambulancie na Slovensku.",
    moduleNames: { clinics: "ambulancie" }, countryNames: { SK: "Slovensko" }, existingUrls: [],
    scrapedPages: [{ url: "https://synthetic.example.invalid", title: "Syntetický adresár",
      emails: [], phones: [], isDirectory: true, text: "SYNTETICKÝ TEST C1. Bez kontaktov." }],
    allDomainsFinal: ["synthetic.example.invalid"], allEmailsFinal: [], allPhonesFinal: [], allSnippets: [],
    passPages: [], contacts: [], alreadyExtracted: [],
    now: new Date("2026-11-15T12:00:00Z"), user: { role: "agent" }, userCountries: ["SK"],
    userContext: "", activityContext: "", accessibleCustomers: [], accessibleCampaigns: [], notifications: [],
    originalText: text, speed: 1, base64Image: "SYNTHETIC_MEDIA_NOT_YET_RENDERED",
    task: { title: "Overiť prijatie syntetickej správy", description: text, country: "SK",
      relatedEntityType: "communication", tags: [] },
  };
  b.SP.aiFirstPassPages = 1;
  b.session.turns = [{ role: "assistant", content: "Dobrý deň." }, { role: "user", content: text }];
  b.userSpeech = text;
  if (id === "geography.representative") b.input = {
    regions: [{ name: "Bratislavský kraj", count: 2 }, { name: "Košický kraj", count: 2 }],
    territoryCount: 2, initialSolution: [["Bratislavský kraj"], ["Košický kraj"]],
  };
  if (id === "automation.draft") b.input = { module: "communication", eventType: "email.received",
    countryCode: "SK", instruction: "Upozorni ma na prijatý e-mail.", desiredIntent: "notify_user" };
  if (id === "task.resolution") {
    delete b.task;
    b.input = { title: "Overiť prijatie syntetickej správy", country: "SK", request: text,
      readyForClosure: false, completedItems: [{ label: "Prijatie overené", note: "SYNTETICKÝ TEST C1",
        doneAt: "2026-11-14T12:00:00Z" }] };
  }
  return b;
}
module.exports = { bindingsFor };
