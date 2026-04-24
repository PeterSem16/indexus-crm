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

    const urls = (await discoverPagesForSource(job.sourceKey, criteria)).slice(0, MAX_PAGES_PER_JOB);
    console.log(`[scraper] job ${jobId} discovered ${urls.length} pages from ${job.sourceKey}`);

    const seenKeys = new Set<string>();
    let totalSaved = 0;

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
      });

      for (const c of extracted) {
        if (!c.name && !c.doctorName) continue;
        if (c.score < 20) continue;

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
          rawData: { extractorScore: c.score, extractorNotes: c.notes } as any,
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
