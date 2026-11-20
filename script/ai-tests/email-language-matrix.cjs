"use strict";
// Synthetic inputs only. No mailbox reads, sends, routing changes or live calls on import.
const LANGUAGES = [
  { code: "sk", name: "slovenčina", receipt: "Prosím, potvrďte prijatie tejto testovacej správy.",
    materials: "Prosíme o zaslanie informačných materiálov o službách banky pupočníkovej krvi." },
  { code: "cs", name: "čeština", receipt: "Prosím, potvrďte přijetí této testovací zprávy.",
    materials: "Prosíme o zaslání informačních materiálů o službách banky pupečníkové krve." },
  { code: "en", name: "English", receipt: "Please confirm receipt of this test message.",
    materials: "Please send us information materials about the cord blood bank's services." },
  { code: "hu", name: "magyar", receipt: "Kérjük, erősítsék meg ennek a tesztüzenetnek a kézhezvételét.",
    materials: "Kérjük, küldjenek tájékoztató anyagokat a köldökzsinórvérbank szolgáltatásairól." },
  { code: "ro", name: "română", receipt: "Vă rugăm să confirmați primirea acestui mesaj de test.",
    materials: "Vă rugăm să ne trimiteți materiale informative despre serviciile băncii de sânge ombilical." },
  { code: "it", name: "italiano", receipt: "Confermate la ricezione di questo messaggio di prova.",
    materials: "Vi chiediamo di inviarci materiale informativo sui servizi della banca del sangue cordonale." },
  { code: "de", name: "Deutsch", receipt: "Bitte bestätigen Sie den Empfang dieser Testnachricht.",
    materials: "Bitte senden Sie uns Informationsmaterial zu den Leistungen der Nabelschnurblutbank." },
];
const SERVICES = ["email.translation", "email.reply", "email.compose"];
function casesFor(services = SERVICES) {
  if (!Array.isArray(services) || !services.length || new Set(services).size !== services.length ||
      services.some(s => !SERVICES.includes(s))) throw Error("unsupported_test_service");
  return services.flatMap(service => LANGUAGES.map(language => {
    let endpoint, responseField, body;
    if (service === "email.translation") {
      endpoint = "ms365-ai-translate"; responseField = "translated";
      body = { targetLanguage: language.code, content: language.code === "en" ?
        "<p>Stretnutie sa uskutoční 24. novembra 2026 o 10:30. Prosím, potvrďte prijatie tejto správy.</p>" :
        "<p>The meeting is on 24 November 2026 at 10:30. Please confirm receipt of this message.</p>" };
    } else if (service === "email.reply") {
      endpoint = "ms365-ai-suggest-reply"; responseField = "suggestion";
      body = { language: language.code, emailSubject: "Synthetic language test",
        emailFrom: "synthetic@example.invalid", emailBody: "<p>" + language.receipt + "</p>" };
    } else {
      endpoint = "ms365-ai-compose"; responseField = "draft";
      body = { templateType: "custom", language: language.code, recipientName: "",
        customPrompt: language.materials + " Write three short HTML paragraphs with a greeting, without a signature, " +
          "invented restrictions, prior agreements, dates, prices or attachments. Synthetic test only." };
    }
    return { service, language: language.code, languageName: language.name, endpoint, responseField, body };
  }));
}
async function runInBrowser(cases) {
  if (window.__indexusLanguageTestStarted) throw Error("TEST_ALREADY_STARTED_DO_NOT_REPEAT");
  window.__indexusLanguageTestStarted = true;
  const results = window.indexusAILanguageResults = [];
  const json = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    if (response.status !== 200) throw Error("HTTP_" + response.status);
    try { return await response.json(); } catch { throw Error("RESPONSE_NOT_JSON"); }
  };
  const { user } = await json("/api/auth/me");
  if (!user?.id) throw Error("PRODUCTION_LOGIN_REQUIRED");
  const config = await json("/api/configurator/ai");
  const services = [...new Set(cases.map(c => c.service))];
  const validate = current => {
    if (current.version !== config.version) throw Error("SETTINGS_CHANGED_STOP");
    if (current.runtime?.mode !== "routed" || !current.gateway?.enabled) throw Error("INTERNAL_ROUTING_REQUIRED");
    for (const service of services) {
      const route = current.services?.find(s => s.id === service)?.route;
      if (!route?.enabled || route.provider !== "internal" || !route.model)
        throw Error("INTERNAL_SERVICE_REQUIRED_" + service);
    }
  };
  validate(config);
  for (const item of cases) {
    const current = await json("/api/configurator/ai"); validate(current);
    const route = current.services.find(s => s.id === item.service).route;
    const started = performance.now();
    // Exactly one POST; uncertain transport/HTTP errors stop without any retry.
    const value = await json(`/api/users/${encodeURIComponent(user.id)}/${item.endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.body),
    });
    const output = value[item.responseField];
    if (typeof output !== "string") throw Error("UNEXPECTED_RESULT_SHAPE_STOP");
    const paragraphs = (output.match(/<p(?:\s[^>]*)?>/gi) || []).length;
    const formatOK = !!output.trim() && paragraphs > 0 && !output.includes("```") &&
      (item.service !== "email.compose" || paragraphs === 3);
    const numericFactsOK = item.service !== "email.translation" ||
      (/\b2026\b/.test(output) && /\b24\b/.test(output) && /\b10[:.]30\b/.test(output));
    const result = { service: item.service, language: item.language, provider: route.provider, model: route.model,
      seconds: Math.round((performance.now() - started) / 1000), formatOK, numericFactsOK,
      languageAndMeaningVerified: false, output };
    results.push(result); console.log(result);
  }
  console.table(results.map(({ output, ...row }) => row));
  console.log("Outputs collected. Language, meaning and professional style still require review. No email was sent.");
  return results;
}
function browserScript(services = SERVICES) {
  return "(" + runInBrowser.toString() + ")(" + JSON.stringify(casesFor(services)) +
    ').catch(e => console.error("STOP; DO NOT REPEAT:", e.message));\n';
}
module.exports = { LANGUAGES, SERVICES, casesFor, runInBrowser, browserScript };
