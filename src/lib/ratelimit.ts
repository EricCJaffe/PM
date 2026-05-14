import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// No-op limiter used when Redis is not configured — always allows through
const noopLimiter = {
  limit: async (_key: string) => ({ success: true, limit: 0, remaining: 0, reset: 0 }),
};

function makeRatelimit(prefix: string, limit: number, window: string): { limit: (key: string) => Promise<{ success: boolean }> } {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return noopLimiter;
  }
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
      prefix,
    });
  } catch {
    return noopLimiter;
  }
}

// Chat: 30 requests per user per hour
export const chatLimiter = makeRatelimit("rl:chat", 30, "1 h");

// Reports (rollup, blockers, hub, decisions, standup): 10 per org per hour
export const reportLimiter = makeRatelimit("rl:report", 10, "1 h");

// Notes summarize: 20 per org per hour
export const summarizeLimiter = makeRatelimit("rl:summarize", 20, "1 h");

// Web pass generate/score: 10 per org per hour
export const webPassLimiter = makeRatelimit("rl:webpass", 10, "1 h");

export function rateLimitExceeded(): Response {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
    { status: 429, headers: { "Content-Type": "application/json" } }
  );
}
