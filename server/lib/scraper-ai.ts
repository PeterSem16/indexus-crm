import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ContactSchema = z.object({
  name: z.string().max(300).optional(),
  ico: z.string().max(20).optional(),
  pzsId: z.string().max(50).optional(),
  facilityType: z.enum(["clinic", "hospital", "ambulance", "doctor"]).optional(),
  specialty: z.string().max(200).optional(),
  doctorName: z.string().max(200).optional(),
  doctorTitle: z.string().max(50).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  phones: z.array(z.string().max(40)).max(20).optional(),
  emails: z.array(z.string().max(200)).max(20).optional(),
  website: z.string().max(500).optional(),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
}).passthrough();
const ResponseSchema = z.object({ contacts: z.array(ContactSchema).max(50) });

export type ExtractedContact = {
  name?: string;
  ico?: string;
  pzsId?: string;
  facilityType?: "clinic" | "hospital" | "ambulance" | "doctor";
  specialty?: string;
  doctorName?: string;
  doctorTitle?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phones?: string[];
  emails?: string[];
  website?: string;
  score: number; // 0-100 confidence
  notes?: string;
};

const SYSTEM_PROMPT = `Si extraktor zdravotníckych kontaktov pre slovenský CRM systém. Z poskytnutého textu (HTML zbavený značiek, alebo plain text) extrahuj VŠETKY kontakty zdravotníckych zariadení / lekárov, ktoré tam reálne sú.

Vráť JSON s poľom "contacts", kde každý prvok má štruktúru:
{
  "name": "názov zariadenia (klinika / nemocnica / ambulancia)",
  "ico": "8-miestne IČO ak je viditeľné",
  "pzsId": "kód PZS / ZZ / kód poskytovateľa zdravotnej starostlivosti",
  "facilityType": "clinic | hospital | ambulance | doctor",
  "specialty": "lekársky odbor (napr. gynekológia, kardiológia, všeobecné lekárstvo)",
  "doctorName": "meno a priezvisko lekára bez titulu",
  "doctorTitle": "titul (MUDr., MUDr. PhD. atď.)",
  "address": "ulica a číslo",
  "city": "mesto",
  "postalCode": "PSČ vo formáte 12345 alebo 123 45",
  "phones": ["telefónne čísla v originálnom formáte"],
  "emails": ["emailové adresy"],
  "website": "URL webu zariadenia ak je iná než zdrojová",
  "score": 0-100 (relevancia: 100 = úplný kontakt s kompletnými údajmi, 50 = čiastočný, 0 = nepoužiteľný),
  "notes": "krátka poznámka k extraktu"
}

DÔLEŽITÉ:
- Ak sa údaj v texte nenachádza, pole VYNECHAJ (nepridávaj null/prázdny string).
- Nikdy si nevymýšľaj údaje. Iba čo je explicitne v texte.
- Telefóny rozlíš čísla od PSČ a IČO podľa kontextu.
- Pre slovenský kontext: 9-miestne čísla začínajúce 9 sú typicky mobil, čísla začínajúce 02/03/04/05 sú pevné linky.
- Ak text neobsahuje žiadny relevantný kontakt, vráť { "contacts": [] }.`;

export async function extractContactsFromText(
  text: string,
  context: { sourceUrl?: string; specialty?: string; city?: string }
): Promise<ExtractedContact[]> {
  if (!text || text.trim().length < 50) return [];
  const truncated = text.slice(0, 14000);
  const userMsg = [
    context.sourceUrl ? `Zdroj: ${context.sourceUrl}` : "",
    context.specialty ? `Hľadaný odbor: ${context.specialty}` : "",
    context.city ? `Hľadané mesto: ${context.city}` : "",
    "",
    "TEXT NA SPRACOVANIE:",
    truncated,
  ].filter(Boolean).join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    const raw = response.choices[0]?.message?.content || "{}";
    const parsedRaw = JSON.parse(raw);
    const validation = ResponseSchema.safeParse(parsedRaw);
    if (!validation.success) {
      console.warn("[scraper-ai] response did not match schema:", validation.error.message.slice(0, 200));
      return [];
    }
    const contacts = validation.data.contacts;
    return contacts
      .filter((c: any) => c && typeof c === "object")
      .map((c: any) => ({
        name: c.name || undefined,
        ico: c.ico || undefined,
        pzsId: c.pzsId || undefined,
        facilityType: c.facilityType || undefined,
        specialty: c.specialty || undefined,
        doctorName: c.doctorName || undefined,
        doctorTitle: c.doctorTitle || undefined,
        address: c.address || undefined,
        city: c.city || undefined,
        postalCode: c.postalCode || undefined,
        phones: Array.isArray(c.phones) ? c.phones.filter((p: any) => typeof p === "string") : [],
        emails: Array.isArray(c.emails) ? c.emails.filter((e: any) => typeof e === "string") : [],
        website: c.website || undefined,
        score: typeof c.score === "number" ? Math.max(0, Math.min(100, Math.round(c.score))) : 50,
        notes: c.notes || undefined,
      }));
  } catch (err) {
    console.error("[scraper-ai] extraction failed:", err);
    return [];
  }
}
