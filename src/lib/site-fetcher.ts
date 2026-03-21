/**
 * Multi-page site fetcher for site audits.
 * Fetches the homepage + key subpages to give the AI scorer more context.
 * Complements the existing single-page extractSignals() in the audit route.
 */

const TIMEOUT_MS = 10_000;
const MAX_CONTENT_CHARS = 12_000;
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

  // 1. Fetch the homepage first
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
  let totalChars = homeResult.bodyText.length;

  // Extract discovered internal links from homepage
  const discoveredPaths = extractInternalPaths(homeResult.bodyText, normalizedUrl);

  // Merge discovered paths with common paths (discovered first — they're more likely to exist)
  const pathsToTry = [...new Set([...discoveredPaths, ...COMMON_PATHS])];

  // 2. Fetch subpages until we hit the content cap
  for (const path of pathsToTry) {
    if (totalChars >= MAX_CONTENT_CHARS) break;
    if (path === "/" || path === "") continue;

    const pageUrl = `${baseUrl}${path.startsWith("/") ? path : "/" + path}`;
    const result = await fetchPage(pageUrl, path);
    if (result && result.wordCount > 20) {
      pages.push(result);
      totalChars += result.bodyText.length;
    }
  }

  // Extract meta info from the homepage HTML
  const homeMeta = extractMeta(homeResult.bodyText);

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

/** Fetch a single page and extract text content */
async function fetchPage(url: string, pathname: string): Promise<FetchedPage | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

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

/** Extract internal link paths from raw HTML text */
function extractInternalPaths(htmlOrText: string, baseUrl: string): string[] {
  // We operate on the raw fetch so we need to re-match href attributes
  // This is intentionally a simple regex — we just want link discovery
  const domain = new URL(baseUrl).hostname;
  const paths: string[] = [];
  const seen = new Set<string>();

  const hrefMatches = [...htmlOrText.matchAll(/href=["']([^"'#][^"']*)["']/gi)];
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

  return paths.slice(0, 20); // cap discovery
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
