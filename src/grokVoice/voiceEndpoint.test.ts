import assert from "node:assert/strict";
import test from "node:test";
import { voiceNetworkError } from "./voiceEndpoint";

test("a public HTTPS page cannot use a localhost voice API", () => {
  const message = voiceNetworkError(
    "http://localhost:8787/api/realtime/token",
    "https://prashma03.github.io",
    "Failed to fetch",
  );
  assert.match(message, /http:\/\/localhost:8787\/api\/realtime\/token/);
  assert.match(message, /GitHub Pages serves the website only/);
  assert.match(message, /EXPO_PUBLIC_API_URL/);
  assert.match(message, /Failed to fetch/);
});

test("a local page reports the API address it could not reach", () => {
  const message = voiceNetworkError(
    "http://localhost:8799/api/realtime/token",
    "http://localhost:8081",
    "Failed to fetch",
  );
  assert.match(message, /http:\/\/localhost:8799\/api\/realtime\/token/);
  assert.match(message, /Start the Express server/);
  assert.doesNotMatch(message, /GitHub Pages/);
});
