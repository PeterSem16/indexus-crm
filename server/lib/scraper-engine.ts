import { db } from "../db";
import { scrapeJobs, scrapedContacts, type ScrapeJob } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { discoverPagesForSource, fetchPage, type ScrapeCriteria } from "./scraper-adapters";
import { extractContactsFromText } from "./scraper-ai";
import { normalizePhones, normalizeEmails, normalizeIco, inferRegion, dedupeKey } from "./scraper-normalizer";

const MAX_PAGES_PER_JOB = 25;
const PAGE_DELAY_MS = 800;
const MAX_CONCURRENT_JOBS = 2;

const activeJobs = new Set<string>();

export async function runScrapeJob(jobId: string): Promise<void> {
  const [job] = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, jobId));
  if (!job) return;

  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    await db.update(scrapeJobs).set({
      status: "failed",
      errorMessage: `Príliš veľa bežiacich jobov (max ${MAX_CONCURRENT_JOBS}). Skús neskôr.`,
      finishedAt: new Date(),
    }).where(eq(scrapeJobs.id, jobId));
    return;
  }
  activeJobs.add(jobId);

  await db.update(scrapeJobs).set({ status: "running", startedAt: new Date() }).where(eq(scrapeJobs.id, jobId));

  try {
    const criteria: ScrapeCriteria = {
      countryCode: job.countryCode,
      specialty: job.specialty,
      city: job.city,
      region: job.region,
      facilityType: job.facilityType,
    };

    const inputItems = Array.isArray(job.inputItems) ? (job.inputItems as Array<{ name: string; city?: string; note?: string }>) : [];
    const isBulk = (job.mode === "bulk" || job.mode === "enrich") && inputItems.length > 0;
    const targetNames = isBulk ? inputItems.map(i => (i.city ? `${i.name} (${i.city})` : i.name)) : undefined;

    const urls = (await discoverPagesForSource(job.sourceKey, criteria)).slice(0, MAX_PAGES_PER_JOB);
    console.log(`[scraper] job ${jobId} (${isBulk ? "bulk" : "discover"}) discovered ${urls.length} pages from ${job.sourceKey}${isBulk ? `, hľadám ${inputItems.length} názvov` : ""}`);

    const seenKeys = new Set<string>();
    let totalSaved = 0;

    const findInputIndex = (matched?: string): { idx: number; original?: string } => {
      if (!matched || !isBulk) return { idx: -1 };
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
      const m = norm(matched);
      let best = -1;
      let bestLen = 0;
      for (let i = 0; i < inputItems.length; i++) {
        const candidate = norm(inputItems[i].name);
        if (!candidate) continue;
        if (m === candidate || m.includes(candidate) || candidate.includes(m)) {
          if (candidate.length > bestLen) { best = i; bestLen = candidate.length; }
        }
      }
      return { idx: best, original: best >= 0 ? inputItems[best].name : undefined };
    };

    for (const url of urls) {
      const page = await fetchPage(url);
      if (!page || page.text.length < 100) {
        await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
        continue;
      }

      const extracted = await extractContactsFromText(page.text, {
        sourceUrl: url,
        specialty: criteria.specialty || undefined,
        city: criteria.city || undefined,
        targetNames,
      });

      for (const c of extracted) {
        if (!c.name && !c.doctorName) continue;
        if (c.score < 20) continue;

        const matchInfo = findInputIndex(c.matchedInputName || c.name);
        if (isBulk && matchInfo.idx < 0) continue; // bulk mode: only keep matches

        const ico = c.ico ? normalizeIco(c.ico) : null;
        const phones = normalizePhones(c.phones || [], (criteria.countryCode || "SK") as any);
        const emails = normalizeEmails(c.emails || []);
        const region = inferRegion(c.city, c.address);
        const key = dedupeKey({ ico, name: c.name, city: c.city });
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        await db.insert(scrapedContacts).values({
          jobId,
          sourceKey: job.sourceKey,
          sourceUrl: url,
          inputName: matchInfo.original || null,
          inputIndex: matchInfo.idx >= 0 ? matchInfo.idx : null,
          countryCode: job.countryCode,
          name: c.name || null,
          ico,
          pzsId: c.pzsId || null,
          facilityType: c.facilityType || criteria.facilityType || null,
          specialty: c.specialty || criteria.specialty || null,
          doctorName: c.doctorName || null,
          doctorTitle: c.doctorTitle || null,
          address: c.address || null,
          city: c.city || null,
          postalCode: c.postalCode || null,
          region,
          phones: phones as any,
          emails,
          website: c.website || null,
          score: c.score,
          status: "pending",
          rawData: { extractorScore: c.score, extractorNotes: c.notes, matchedInputName: c.matchedInputName } as any,
        });
        totalSaved++;
      }

      await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    }

    await db.update(scrapeJobs).set({
      status: "completed",
      totalFound: totalSaved,
      finishedAt: new Date(),
    }).where(eq(scrapeJobs.id, jobId));
    console.log(`[scraper] job ${jobId} completed with ${totalSaved} contacts`);
  } catch (err) {
    console.error(`[scraper] job ${jobId} failed:`, err);
    await db.update(scrapeJobs).set({
      status: "failed",
      errorMessage: (err as Error).message,
      finishedAt: new Date(),
    }).where(eq(scrapeJobs.id, jobId));
  } finally {
    activeJobs.delete(jobId);
  }
}
