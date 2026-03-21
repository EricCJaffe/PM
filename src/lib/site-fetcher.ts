/**
 * Multi-page site fetcher for site audits.
 * Fetches the homepage + key subpages to give the AI scorer more context.
 * Complements the existing single-page extractSignals() in the audit route.
 */

const PAGE_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 15_000;
const MAX_CONTENT_CHARS = 12_000;
const MAX_CONCURRENT = 6;
const USER_AGENT = "Mozilla/5.0 (compatible; BusinessOS-SiteAudit/1.0)";

export interface FetchedPage {
  url: string;
  pathname: string;
  title: string | null;
  bodyText: string;
  wordCount: number;
  statusCode: number;
}

export interface FetchedSiteContent {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  pages: FetchedPage[];
  totalWordCount: number;
  fetchError: string | null;
}

/** Standard subpages to probe for every vertical */
const COMMON_PATHS = [
  "/about",
  "/contact",
  "/services",
  "/ministries",
  "/beliefs",
  "/visit",
  "/give",
  "/events",
  "/staff",
  "/team",
  "/blog",
  "/sermons",
  "/donate",
];

/**
 * Fetch the homepage and attempt to discover/fetch key subpages.
 * Subpages are fetched in parallel with a global timeout.
 * Returns structured content capped at MAX_CONTENT_CHARS.
 */
export async function fetchSiteContent(url: string): Promise<FetchedSiteContent> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  let baseUrl: string;
  try {
    baseUrl = new URL(normalizedUrl).origin;
  } catch {
    return {
      url: normalizedUrl,
      title: null,
      metaDescription: null,
      h1: null,
      pages: [],
      totalWordCount: 0,
      fetchError: `Invalid URL: ${url}`,
    };
  }

  // 1. Fetch the homepage first (need it to discover internal links)
  const homeResult = await fetchPage(normalizedUrl, "/");
  if (!homeResult) {
    return {
      url: normalizedUrl,
      title: null,
      metaDescription: null,
      h1: null,
      pages: [],
      totalWordCount: 0,
      fetchError: `Could not fetch ${normalizedUrl}`,
    };
  }

  const pages: FetchedPage[] = [homeResult];

  // Extract discovered internal links from homepage raw HTML (before stripping)
  const discoveredPaths = extractInternalPaths(homeResult.rawHtml || "", normalizedUrl);

  // Merge discovered paths with common paths, dedup
  const pathsToTry = [...new Set([...discoveredPaths, ...COMMON_PATHS])]
    .filter((p) => p !== "/" && p !== "")
    .slice(0, 15); // cap to prevent excessive fetching

  // 2. Fetch subpages in parallel with a global timeout
  const subpageResults = await fetchPagesParallel(
    pathsToTry.map((p) => ({
      url: `${baseUrl}${p.startsWith("/") ? p : "/" + p}`,
      pathname: p,
    }))
  );

  let totalChars = homeResult.bodyText.length;
  for (const result of subpageResults) {
    if (totalChars >= MAX_CONTENT_CHARS) break;
    if (result && result.wordCount > 20) {
      pages.push(result);
      totalChars += result.bodyText.length;
    }
  }

  // Extract meta info from the homepage
  const homeMeta = extractMeta(homeResult.rawHtml || "");

  return {
    url: normalizedUrl,
    title: homeResult.title,
    metaDescription: homeMeta.metaDescription,
    h1: homeMeta.h1,
    pages,
    totalWordCount: pages.reduce((sum, p) => sum + p.wordCount, 0),
    fetchError: null,
  };
}

/** Fetch multiple pages in parallel with concurrency limit and global timeout */
async function fetchPagesParallel(
  targets: { url: string; pathname: string }[]
): Promise<(FetchedPage | null)[]> {
  // Global abort controller — kills everything after TOTAL_TIMEOUT_MS
  const globalController = new AbortController();
  const globalTimeout = setTimeout(() => globalController.abort(), TOTAL_TIMEOUT_MS);

  const results: (FetchedPage | null)[] = new Array(targets.length).fill(null);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < targets.length && !globalController.signal.aborted) {
      const idx = nextIndex++;
      const target = targets[idx];
      results[idx] = await fetchPage(target.url, target.pathname, globalController.signal);
    }
  }

  // Spawn workers up to MAX_CONCURRENT
  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT, targets.length) },
    () => worker()
  );

  await Promise.allSettled(workers);
  clearTimeout(globalTimeout);

  return results;
}

/** Fetch a single page and extract text content */
async function fetchPage(
  url: string,
  pathname: string,
  parentSignal?: AbortSignal
): Promise<(FetchedPage & { rawHtml?: string }) | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

    // Also abort if parent (global) signal fires
    if (parentSignal) {
      if (parentSignal.aborted) return null;
      parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? stripTags(titleMatch[1]).slice(0, 120) : null;

    const bodyText = extractBodyText(html);
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      url,
      pathname,
      title,
      bodyText: bodyText.slice(0, 4000),
      wordCount,
      statusCode: response.status,
      rawHtml: html,
    };
  } catch {
    return null;
  }
}

/** Extract clean body text from HTML, stripping nav/footer/scripts */
function extractBodyText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract internal link paths from raw HTML */
function extractInternalPaths(html: string, baseUrl: string): string[] {
  const domain = new URL(baseUrl).hostname;
  const paths: string[] = [];
  const seen = new Set<string>();

  const hrefMatches = [...html.matchAll(/href=["']([^"'#][^"']*)["']/gi)];
  for (const m of hrefMatches) {
    try {
      const linkUrl = new URL(m[1], baseUrl);
      if (linkUrl.hostname === domain || linkUrl.hostname.endsWith("." + domain)) {
        const p = linkUrl.pathname.replace(/\/+$/, "") || "/";
        if (!seen.has(p) && p !== "/") {
          seen.add(p);
          paths.push(p);
        }
      }
    } catch {
      /* skip malformed */
    }
  }

  return paths.slice(0, 20);
}

/** Extract meta description and h1 from HTML (used for homepage) */
function extractMeta(html: string): { metaDescription: string | null; h1: string | null } {
  const metaMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  return {
    metaDescription: metaMatch ? metaMatch[1].trim() : null,
    h1: h1Match ? stripTags(h1Match[1]).slice(0, 200) : null,
  };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
