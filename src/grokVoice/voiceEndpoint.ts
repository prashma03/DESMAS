/** Shown when a public build has no API address. It must not call localhost. */
export function voiceUnavailableMessage(): string {
  return "Voice is unavailable on this public site. GitHub Pages does not run the voice server. Set EXPO_PUBLIC_API_URL to the HTTPS API and rebuild the site.";
}

/** Browser message when the voice token request never receives an HTTP response. */
export function voiceNetworkError(url: string, pageOrigin: string, cause: string): string {
  const localApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
  if (pageOrigin.startsWith("https://") && localApi) {
    return `Voice cannot reach ${url} from ${pageOrigin}. GitHub Pages serves the website only. Deploy the Express server on HTTPS, allow ${pageOrigin} in server CORS, and rebuild the site with EXPO_PUBLIC_API_URL set to that server. (${cause})`;
  }
  return `Voice cannot reach ${url}. ${cause}. Start the Express server for this API address.`;
}
