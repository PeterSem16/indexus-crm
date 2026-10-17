import { LegalEntityError, loadOrsrCompany, normalizeIco, type RegistryVerification } from "./orsr-client";
import { REGISTRY_COUNTRIES, type RegistryCountry } from "../../shared/healthcare-legal-entity";

type Json = Record<string, any>;
export function registryCountry(input: unknown): RegistryCountry {
  if (!REGISTRY_COUNTRIES.includes(input as RegistryCountry)) throw new LegalEntityError("country_unsupported");
  return input as RegistryCountry;
}
export function normalizeCompanyId(input: unknown, country: RegistryCountry): string {
  if (country !== "RO") return normalizeIco(input);
  if (typeof input !== "string") throw new LegalEntityError("ico_invalid");
  const value = input.replace(/\s/g, "").replace(/^RO/i, "");
  if (!/^[1-9]\d{1,9}$/.test(value)) throw new LegalEntityError("ico_invalid");
  return value;
}
const text = (v: unknown): string | null => typeof v === "string" && v.trim() ? v.trim() : null;
function date(v: unknown): string | null {
  const value = text(v);
  if (!value) return null;
  const normalized = /^\d{2}\.\d{2}\.\d{4}$/.test(value)
    ? `${value.slice(6)}-${value.slice(3, 5)}-${value.slice(0, 2)}` : value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
}
/** Bounded response from a fixed official host. Never follow a redirect or log vendor payloads. */
async function officialJson(url: string, init: RequestInit = {}): Promise<Json> {
  try {
    const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(25_000),
      headers: { Accept: "application/json", ...init.headers } });
    if (response.status === 404) throw new LegalEntityError("not_found", 404);
    if (response.status === 429) throw new LegalEntityError("rate_limited", 429);
    if (!response.ok || !response.body) throw new Error("registry");
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024 * 1024) { await reader.cancel(); throw new Error("registry"); }
      chunks.push(value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("registry");
    return result;
  } catch (error) {
    if (error instanceof LegalEntityError) throw error;
    throw new LegalEntityError("registry_unavailable", 502);
  }
}
export const fetchAresJson = (ico: string) => officialJson(
  `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${encodeURIComponent(ico)}`);

/** Dedicated PostgreSQL session gate: the ANAF 1 request/sec budget is shared by all app workers.
 * No schema changes, paid retries, queue growth or upstream calls on lock contention.
 */
export async function withAnafAdmission<T>(run: () => Promise<T>): Promise<T> {
  const { pool } = await import("../db");
  const client = await pool.connect();
  let acquired = false;
  let discard = false;
  let started = Date.now();
  try {
    const result = await client.query("SELECT pg_try_advisory_lock(741286, 1907) AS acquired");
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) throw new LegalEntityError("rate_limited", 429);
    started = Date.now();
    return await run();
  } finally {
    if (acquired) {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 1050 - (Date.now() - started))));
      try { await client.query("SELECT pg_advisory_unlock(741286, 1907)"); }
      catch { discard = true; }
    }
    client.release(discard);
  }
}
export const fetchAnafJson = (cui: string, queryDate: string) => withAnafAdmission(() => officialJson(
  "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva",
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ cui: Number(cui), data: queryDate }]) }));

export async function loadAresCompany(input: string, read = fetchAresJson): Promise<RegistryVerification> {
  const ico = normalizeCompanyId(input, "CZ");
  const raw = await read(ico);
  if (String(raw.ico ?? "").padStart(8, "0") !== ico) throw new LegalEntityError("registry_identity_conflict", 502);
  const name = text(raw.obchodniJmeno);
  if (!name) throw new LegalEntityError("registry_unavailable", 502);
  const address = raw.sidlo || {};
  // Registration country is CZ; a foreign registered seat (e.g. a branch) does not change it.
  const terminatedAt = date(raw.datumZaniku);
  if (raw.datumZaniku && !terminatedAt) throw new LegalEntityError("registry_unavailable", 502);
  return {
    company: { countryCode: "CZ", ico, name, registrySource: "ARES",
      legalForm: text(raw.pravniForma), registeredAddress: text(address.textovaAdresa),
      city: text(address.nazevObce), postalCode: address.psc != null ? String(address.psc) : text(address.pscTxt),
      status: terminatedAt ? "terminated" : "active", establishedAt: date(raw.datumVzniku), terminatedAt,
      registryReference: { section: "ARES", court: "CZ", insertNumber: Number(ico) } },
    registryPeople: [], documents: [], rawData: { source: "https://ares.gov.cz", version: 1, response: raw },
    checkedAt: new Date().toISOString(), sourceUpdatedAt: date(raw.datumAktualizace),
  };
}
export async function loadAnafCompany(input: string, read = fetchAnafJson, now = new Date()): Promise<RegistryVerification> {
  const ico = normalizeCompanyId(input, "RO");
  const queryDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric",
    month: "2-digit", day: "2-digit" }).format(now);
  const raw = await read(ico, queryDate);
  // The live v9 service omits cod/message on success, despite its published example.
  if ((raw.cod !== undefined && raw.cod !== 200) || !Array.isArray(raw.found) || !Array.isArray(raw.notFound))
    throw new LegalEntityError("registry_unavailable", 502);
  if (!raw.found.length && raw.notFound.some((id: unknown) => String(id) === ico))
    throw new LegalEntityError("not_found", 404);
  if (raw.found.length !== 1 || String(raw.found[0]?.date_generale?.cui) !== ico ||
      raw.notFound.length) throw new LegalEntityError("registry_identity_conflict", 502);
  const entry = raw.found[0], data = entry.date_generale;
  const name = text(data.denumire);
  if (!name) throw new LegalEntityError("registry_unavailable", 502);
  const seat = entry.adresa_sediu_social || {};
  // ANAF fiscal inactivity is NOT a finding that the legal entity was dissolved.
  return {
    company: { countryCode: "RO", ico, name, registrySource: "ANAF",
      legalForm: text(data.forma_juridica), registeredAddress: text([
        seat.sdenumire_Strada, seat.snumar_Strada, seat.sdetalii_Adresa].filter(Boolean).join(" ")) || text(data.adresa),
      city: text(seat.sdenumire_Localitate), postalCode: text(seat.scod_Postal) || text(data.codPostal),
      status: "unknown", establishedAt: date(data.data_inregistrare), terminatedAt: null,
      registryReference: { section: "ANAF", court: "RO", insertNumber: Number(ico) },
      taxStatus: {
        ...(typeof entry.inregistrare_scop_Tva?.scpTVA === "boolean" ? { vatRegistered: entry.inregistrare_scop_Tva.scpTVA } : {}),
        ...(typeof entry.stare_inactiv?.statusInactivi === "boolean" ? { inactive: entry.stare_inactiv.statusInactivi } : {}),
      } },
    registryPeople: [], documents: [], rawData: { source: "https://www.anaf.ro", version: 9, queryDate, response: raw },
    checkedAt: now.toISOString(), sourceUpdatedAt: null,
  };
}
export type CountryRegistryLoader = (ico: string, country: RegistryCountry) => Promise<RegistryVerification>;
export const loadCompanyRegistry: CountryRegistryLoader = (ico, country) => {
  registryCountry(country);
  return country === "CZ" ? loadAresCompany(ico) : country === "RO" ? loadAnafCompany(ico) : loadOrsrCompany(ico);
};
