import { activityTemplateContext } from "../../shared/automation-activity-context";
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

function salutations(firstName: unknown, lastName: unknown, lang: string) {
  const first = String(firstName || "").trim(), last = String(lastName || "").trim();
  const hasName = !!(first || last);
  let gender: Gender = "male";
  if (/ová$/i.test(last) || (/á$/i.test(last) && last.length > 2)) gender = "female";
  else if (/ák$|ač$|áč$|ec$|ík$|ič$|ek$|ský$|cký$/i.test(last)) gender = "male";
  else if (/a$/i.test(first) && !["Luca", "Andrea", "Nikita", "Joshua", "Elisha"].includes(first)) gender = "female";
  const pick = (table: typeof SHORT) => hasName ? table[gender][lang] ?? table[gender].sk : "";
  return { salutation: pick(SHORT), salutationFull: pick(FULL), salutationDoc: pick(DOCTOR) };
}

export function taskTemplateContext(ctx: any, templateLanguage?: string) {
  ctx = activityTemplateContext(ctx);
  const module = ctx.event?.module;
  const requested = (templateLanguage || ctx.event?.countryCode || "sk").toLowerCase();
  const lang = requested === "cz" ? "cs" : requested;
  if (ctx.statusListService === true) {
    const at = new Date(ctx.event.createdAt);
    const dateLocale = ["sk", "cs", "hu", "ro", "it", "de", "en"].includes(lang) ? lang : "sk";
    ctx = { ...ctx,
      currentDate: new Intl.DateTimeFormat(dateLocale, { timeZone: "Europe/Bratislava" }).format(at),
      currentYear: new Intl.DateTimeFormat("en", { timeZone: "Europe/Bratislava", year: "numeric" }).format(at),
    };
    if (ctx.clinic) {
      const cl = ctx.clinic;
      const sal = salutations(cl.doctorFirstName, cl.doctorLastName, lang);
      const full = [cl.doctorTitle, cl.doctorFirstName, cl.doctorLastName, cl.doctorTitleAfter].filter(Boolean).join(" ");
      ctx.clinic = { ...cl, doctorName: full, doctorFullName: full,
        doctorSalutation: sal.salutation, doctorSalutationFull: sal.salutationFull, doctorSalutationDoc: sal.salutationDoc };
    }
    if (ctx.hospital) {
      const person = String(ctx.hospital.contactPerson || "").replace(/\b(?:MUDr|Mgr|Ing|Bc|PhDr|JUDr|RNDr|Doc|Prof|Dr)\.\s*/gi, "").trim().split(/\s+/);
      const sal = salutations(person.length > 1 ? person[0] : "", person.at(-1), lang);
      ctx.hospital = { ...ctx.hospital, fullName: ctx.hospital.fullName || ctx.hospital.name,
        contactPersonSalutation: sal.salutation, contactPersonSalutationFull: sal.salutationFull, contactPersonSalutationDoc: sal.salutationDoc };
    }
    if (ctx.customer) ctx.customer = { ...ctx.customer,
      fullName: [ctx.customer.firstName, ctx.customer.lastName].filter(Boolean).join(" "),
      ...salutations(ctx.customer.firstName, ctx.customer.lastName, lang) };
  }
  if (ctx.event?.source === "schedule" || !["customer", "clinic", "collaborator"].includes(module)) return ctx;
  const data = ctx.newValues || {};
  return { ...ctx, newValues: { ...data, ...salutations(
    module === "clinic" ? data.doctorFirstName : data.firstName,
    module === "clinic" ? data.doctorLastName : data.lastName, lang,
  ) } };
}
