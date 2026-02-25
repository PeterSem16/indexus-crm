import { db } from "../db";
import { virtualAgentConfigs } from "@shared/schema";
import { eq } from "drizzle-orm";

const MAX_CONTENT_LENGTH = 12000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function stripHtmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/?(p|div|h[1-6]|li|tr|section|article)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&[a-zA-Z0-9#]+;/g, " ");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n/g, "\n\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /<a[^>]+href=["']([^"'#]+)["']/gi;
  const links: Set<string> = new Set();
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = match[1];
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
      
      const url = new URL(href, baseUrl);
      if (url.origin !== new URL(baseUrl).origin) continue;
      
      const path = url.pathname.toLowerCase();
      if (path.match(/\.(pdf|jpg|jpeg|png|gif|svg|css|js|zip|doc|docx|xlsx|mp3|mp4|ico)$/)) continue;
      
      const relevantPaths = [
        /cen/i, /pric/i, /sluz/i, /serv/i, /kontakt/i, /contact/i,
        /about/i, /o-nas/i, /o-spolocnosti/i, /produkt/i, /product/i,
        /faq/i, /otazk/i, /info/i, /ponuk/i, /offer/i,
        /balicek/i, /package/i, /objedna/i, /order/i
      ];
      
      if (path === "/" || path === "") continue;
      
      const isRelevant = relevantPaths.some(p => p.test(path));
      if (isRelevant) {
        links.add(url.href);
      }
    } catch {}
  }
  
  return [...links].slice(0, 8);
}

async function fetchPage(url: string, timeoutMs: number = 10000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IndexusCRM/1.0; +https://indexus.sk)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "sk,cs,en;q=0.5",
      },
    });
    
    clearTimeout(timer);
    
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;
    
    return await response.text();
  } catch (err) {
    console.warn(`[WebScraper] Failed to fetch ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function extractPageTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : "";
}

export async function scrapeWebsite(websiteUrl: string): Promise<string> {
  console.log(`[WebScraper] Scraping website: ${websiteUrl}`);
  
  const mainHtml = await fetchPage(websiteUrl);
  if (!mainHtml) {
    console.warn(`[WebScraper] Could not fetch main page: ${websiteUrl}`);
    return "";
  }
  
  const mainTitle = extractPageTitle(mainHtml);
  const mainText = stripHtmlToText(mainHtml);
  
  const sections: Array<{ title: string; url: string; content: string }> = [];
  sections.push({
    title: mainTitle || "Hlavná stránka",
    url: websiteUrl,
    content: mainText.substring(0, 3000),
  });
  
  const subLinks = extractInternalLinks(mainHtml, websiteUrl);
  console.log(`[WebScraper] Found ${subLinks.length} relevant subpages: ${subLinks.join(", ")}`);
  
  const subPages = await Promise.allSettled(
    subLinks.map(async (link) => {
      const html = await fetchPage(link);
      if (!html) return null;
      const title = extractPageTitle(html);
      const text = stripHtmlToText(html);
      if (text.length < 50) return null;
      return { title: title || link, url: link, content: text.substring(0, 2000) };
    })
  );
  
  for (const result of subPages) {
    if (result.status === "fulfilled" && result.value) {
      sections.push(result.value);
    }
  }
  
  let output = `=== WEBSTRÁNKA SPOLOČNOSTI ===\nURL: ${websiteUrl}\n\n`;
  
  for (const section of sections) {
    const pathLabel = new URL(section.url).pathname || "/";
    output += `--- ${section.title} (${pathLabel}) ---\n`;
    output += section.content + "\n\n";
  }
  
  if (output.length > MAX_CONTENT_LENGTH) {
    output = output.substring(0, MAX_CONTENT_LENGTH) + "\n...(skrátené)";
  }
  
  console.log(`[WebScraper] Scraped ${sections.length} pages, total ${output.length} chars`);
  return output;
}

export async function refreshWebsiteContent(configId: string): Promise<{ success: boolean; pages: number; chars: number; error?: string }> {
  try {
    const [config] = await db.select().from(virtualAgentConfigs)
      .where(eq(virtualAgentConfigs.id, configId)).limit(1);
    
    if (!config?.websiteUrl) {
      return { success: false, pages: 0, chars: 0, error: "No website URL configured" };
    }
    
    const content = await scrapeWebsite(config.websiteUrl);
    if (!content) {
      return { success: false, pages: 0, chars: 0, error: "Could not fetch website content" };
    }
    
    const pageCount = (content.match(/^---/gm) || []).length;
    
    await db.update(virtualAgentConfigs)
      .set({
        websiteContentCache: content,
        websiteLastFetched: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(virtualAgentConfigs.id, configId));
    
    return { success: true, pages: pageCount, chars: content.length };
  } catch (err) {
    console.error(`[WebScraper] Refresh error:`, err);
    return { success: false, pages: 0, chars: 0, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export function isCacheStale(lastFetched: Date | null): boolean {
  if (!lastFetched) return true;
  return Date.now() - new Date(lastFetched).getTime() > CACHE_TTL_MS;
}

export async function getWebsiteContentForConfig(configId: string): Promise<string | null> {
  const [config] = await db.select({
    websiteUrl: virtualAgentConfigs.websiteUrl,
    websiteContentCache: virtualAgentConfigs.websiteContentCache,
    websiteLastFetched: virtualAgentConfigs.websiteLastFetched,
  }).from(virtualAgentConfigs)
    .where(eq(virtualAgentConfigs.id, configId)).limit(1);
  
  if (!config?.websiteUrl) return null;
  
  if (config.websiteContentCache && !isCacheStale(config.websiteLastFetched)) {
    return config.websiteContentCache;
  }
  
  const content = await scrapeWebsite(config.websiteUrl);
  if (content) {
    try {
      await db.update(virtualAgentConfigs)
        .set({
          websiteContentCache: content,
          websiteLastFetched: new Date(),
        })
        .where(eq(virtualAgentConfigs.id, configId));
    } catch {}
    return content;
  }
  
  return config.websiteContentCache || null;
}
