export const LOCAL_API = "http://localhost:8787";

export const API_UNAVAILABLE =
  "This public site has no API address yet. Rebuild GitHub Pages with EXPO_PUBLIC_API_URL set to the HTTPS server. The site will not call localhost.";

/** Local pages keep the existing server fallback. A public page without a configured URL does not. */
export function resolveApiBase(configured: string | undefined, hostname: string): string | null {
  const value = configured?.trim();
  if (value) return value.replace(/\/$/, "");
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "") return LOCAL_API;
  return null;
}

export const API = resolveApiBase(
  process.env.EXPO_PUBLIC_API_URL,
  typeof location !== "undefined" ? location.hostname : "",
);
