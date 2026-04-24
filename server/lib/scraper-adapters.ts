import * as cheerio from "cheerio";

export type ScrapeCriteria = {
  countryCode: string;
  specialty?: string | null;
  city?: string | null;
  region?: string | null;
  facilityType?: string | null;
};

export type FetchedPage = { url: string; text: string; title?: string };

const UA = "Mozilla/5.0 (compatible; INDEXUS-CRM-Scraper/1.0; +https://indexus.local)";
const FETCH_TIMEOUT_MS = 15000;

export async function fetchPage(url: string): Promise<FetchedPage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script,style,nav,footer,header,iframe,noscript").remove();
    const title = $("title").first().text().trim() || undefined;
    const text = $("body").text().replace(/\s+/g, " ").trim();
    return { url, text, title };
  } catch (err) {
    clearTimeout(timer);
    console.error(`[scraper] fetch failed ${url}:`, (err as Error).message);
    return null;
  }
}

export async function discoverLinks(baseUrl: string, html?: string, sameOriginOnly = true, maxLinks = 30): Promise<string[]> {
  let pageHtml = html;
  if (!pageHtml) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(baseUrl, { headers: { "User-Agent": UA }, redirect: "follow", signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        return [];
      }
      if (!res.ok) return [];
      pageHtml = await res.text();
    } catch {
      clearTimeout(timer);
      return [];
    }
  }
  const $ = cheerio.load(pageHtml);
  const base = new URL(baseUrl);
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl);
      if (sameOriginOnly && abs.origin !== base.origin) return;
      if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
      if (abs.pathname.match(/\.(pdf|jpg|jpeg|png|gif|zip|doc|docx|xls|xlsx)$/i)) return;
      links.add(abs.toString().split("#")[0]);
    } catch {}
  });
  return Array.from(links).slice(0, maxLinks);
}

// === Adapter: e-VÚC (regional healthcare provider registers) ===
// e-VÚC = elektronická služba VÚC, každý kraj má vlastný register PZS.
// Zoznam vstupných URL podľa kraja — postupne sa rozširuje.
const EVUC_REGION_URLS: Record<string, string[]> = {
  "Bratislavský kraj": ["https://www.region-bsk.sk/clanok/zoznam-poskytovatelov-zdravotnej-starostlivosti.aspx"],
  "Trnavský kraj": ["https://www.trnava-vuc.sk/zdravotnictvo/poskytovatelia-zdravotnej-starostlivosti/"],
  "Trenčiansky kraj": ["https://www.tsk.sk/zdravotnictvo/poskytovatelia-zdravotnej-starostlivosti.html"],
  "Nitriansky kraj": ["https://www.unsk.sk/Zobraz/Sekciu/zdravotnictvo"],
  "Žilinský kraj": ["https://www.zilinskazupa.sk/sk/samosprava/urad-zsk/odbor-zdravotnictva/"],
  "Banskobystrický kraj": ["https://www.bbsk.sk/Default.aspx?CatID=1188"],
  "Prešovský kraj": ["https://www.po-kraj.sk/sk/samosprava/urad/odbor-zdravotnictva/"],
  "Košický kraj": ["https://web.vucke.sk/sk/kompetencie/zdravotnictvo/"],
};

export async function evucDiscover(criteria: ScrapeCriteria): Promise<string[]> {
  const targets: string[] = [];
  if (criteria.region && EVUC_REGION_URLS[criteria.region]) {
    targets.push(...EVUC_REGION_URLS[criteria.region]);
  } else {
    // všetky kraje
    for (const urls of Object.values(EVUC_REGION_URLS)) targets.push(...urls);
  }
  const allLinks: string[] = [];
  for (const t of targets) {
    allLinks.push(t);
    const sub = await discoverLinks(t, undefined, true, 20);
    allLinks.push(...sub);
  }
  return Array.from(new Set(allLinks)).slice(0, 40);
}

// === Adapter: ÚDZS (Úrad pre dohľad nad zdravotnou starostlivosťou) ===
const UDZS_BASE = "https://www.udzs-sk.sk";
const UDZS_ENTRY_URLS = [
  `${UDZS_BASE}/poskytovatelia/`,
  `${UDZS_BASE}/zoznam-poskytovatelov-zdravotnej-starostlivosti/`,
  `${UDZS_BASE}/registre/`,
];

export async function udzsDiscover(_criteria: ScrapeCriteria): Promise<string[]> {
  const allLinks: string[] = [];
  for (const t of UDZS_ENTRY_URLS) {
    allLinks.push(t);
    const sub = await discoverLinks(t, undefined, true, 30);
    allLinks.push(...sub);
  }
  return Array.from(new Set(allLinks)).slice(0, 40);
}

export async function discoverPagesForSource(sourceKey: string, criteria: ScrapeCriteria): Promise<string[]> {
  switch (sourceKey) {
    case "evuc": return evucDiscover(criteria);
    case "udzs": return udzsDiscover(criteria);
    default: return [];
  }
}
