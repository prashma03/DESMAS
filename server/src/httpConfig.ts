export const PUBLIC_WEB_ORIGIN = "https://prashma03.github.io";

export function allowedOriginList(raw = process.env.CORS_ORIGINS): string[] {
  return (raw ?? PUBLIC_WEB_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function originAllowed(origin: string | undefined, allowlist = allowedOriginList()): boolean {
  if (!origin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return allowlist.includes(origin);
}

/** Render and other hosts provide PORT and expect the process to accept traffic on every interface. */
export function listenHost(raw = process.env.HOST): string {
  const host = raw?.trim();
  return host || "0.0.0.0";
}

export function tokenTtlSeconds(raw = process.env.TOKEN_TTL_SEC): number {
  const parsed = Number(raw ?? 120);
  if (!Number.isFinite(parsed)) return 120;
  return Math.min(300, Math.max(30, Math.floor(parsed)));
}
