import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Chat: 30 requests per user per hour
export const chatLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  prefix: "rl:chat",
});

// Reports (rollup, blockers, hub, decisions, standup): 10 per org per hour
export const reportLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "rl:report",
});

// Notes summarize: 20 per org per hour
export const summarizeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 h"),
  prefix: "rl:summarize",
});

// Web pass generate/score: 10 per org per hour
export const webPassLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "rl:webpass",
});

export function rateLimitExceeded(): Response {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
    { status: 429, headers: { "Content-Type": "application/json" } }
  );
}
