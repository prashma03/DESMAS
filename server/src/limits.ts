type StampBook = Map<string, number[]>;

const books: StampBook = new Map();

export function resetLimits() {
  books.clear();
}

export function allowCall(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const fresh = (books.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (fresh.length >= limit) {
    books.set(key, fresh);
    return false;
  }
  fresh.push(now);
  books.set(key, fresh);
  return true;
}

export const PAID_WINDOW_MS = 10 * 60 * 1000;
export const PAID_GLOBAL_WINDOW_MS = 60 * 60 * 1000;

const ROUTE_LIMITS: Record<string, { perIp: number; global: number }> = {
  token: { perIp: 5, global: 30 },
  chat: { perIp: 10, global: 40 },
  tts: { perIp: 8, global: 30 },
  diagnose: { perIp: 8, global: 30 },
  grok: { perIp: 8, global: 30 },
};

export function allowPaidRoute(route: string, ip: string, now = Date.now()): boolean {
  const limits = ROUTE_LIMITS[route] ?? { perIp: 5, global: 20 };
  const caller = ip.trim() || "unknown";
  return (
    allowCall(`${route}:${caller}`, limits.perIp, PAID_WINDOW_MS, now) &&
    allowCall(`${route}:global`, limits.global, PAID_GLOBAL_WINDOW_MS, now)
  );
}
