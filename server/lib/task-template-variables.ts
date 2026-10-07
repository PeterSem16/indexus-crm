type Gender = "male" | "female";
// Mirror the existing Nexus Pulse synchronous salutation rules and language tables.
const SHORT: Record<Gender, Record<string, string>> = {
  male: { sk: "Vážený pán", cs: "Vážený pán", hu: "Tisztelt", ro: "Stimate", it: "Egregio", de: "Sehr geehrter", en: "Dear" },
  female: { sk: "Vážená pani", cs: "Vážená pani", hu: "Tisztelt", ro: "Stimată", it: "Gentile", de: "Sehr geehrte", en: "Dear" },
};
const FULL: Record<Gender, Record<string, string>> = {
  male: { sk: "Vážený pán", cs: "Vážený pane", hu: "Tisztelt Úr", ro: "Stimate domn", it: "Egregio Signor", de: "Sehr geehrter Herr", en: "Dear Mr." },
  female: { sk: "Vážená pani", cs: "Vážená paní", hu: "Tisztelt Asszony", ro: "Stimată doamnă", it: "Gentile Signora", de: "Sehr geehrte Frau", en: "Dear Ms." },
};
const DOCTOR: Record<Gender, Record<string, string>> = {
  male: { sk: "Vážený pán doktor", cs: "Vážený pane doktore", hu: "Tisztelt Doktor Úr", ro: "Stimate Domn Doctor", it: "Egregio Dottor", de: "Sehr geehrter Herr Doktor", en: "Dear Dr." },
  female: { sk: "Vážená pani doktorka", cs: "Vážená paní doktorko", hu: "Tisztelt Doktor Asszony", ro: "Stimată Doamnă Doctor", it: "Egregia Dottoressa", de: "Sehr geehrte Frau Doktor", en: "Dear Dr." },
};

export function taskTemplateContext(ctx: any, templateLanguage?: string) {
  const module = ctx.event?.module;
  if (ctx.event?.source === "schedule" || !["customer", "clinic", "collaborator"].includes(module)) return ctx;
  const data = ctx.newValues || {};
  const first = String((module === "clinic" ? data.doctorFirstName : data.firstName) || "").trim();
  const last = String((module === "clinic" ? data.doctorLastName : data.lastName) || "").trim();
  const hasName = !!(first || last);
  let gender: Gender = "male";
  if (/ová$/i.test(last) || (/á$/i.test(last) && last.length > 2)) gender = "female";
  else if (/ák$|ač$|áč$|ec$|ík$|ič$|ek$|ský$|cký$/i.test(last)) gender = "male";
  else if (/a$/i.test(first) && !["Luca", "Andrea", "Nikita", "Joshua", "Elisha"].includes(first)) gender = "female";
  const requested = (templateLanguage || ctx.event?.countryCode || "sk").toLowerCase();
  const lang = requested === "cz" ? "cs" : requested;
  const pick = (table: typeof SHORT) => hasName ? table[gender][lang] ?? table[gender].sk : "";
  return { ...ctx, newValues: { ...data,
    salutation: pick(SHORT), salutationFull: pick(FULL), salutationDoc: pick(DOCTOR),
  } };
}
