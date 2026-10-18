import assert from "node:assert/strict";
import test from "node:test";
import { listenHost, originAllowed, tokenTtlSeconds } from "./httpConfig.js";

test("the public site and local development may call the API", () => {
  const allow = ["https://prashma03.github.io"];
  assert.equal(originAllowed(undefined, allow), true);
  assert.equal(originAllowed("http://localhost:8081", allow), true);
  assert.equal(originAllowed("http://127.0.0.1:8799", allow), true);
  assert.equal(originAllowed("https://prashma03.github.io", allow), true);
  assert.equal(originAllowed("https://example.com", allow), false);
});

test("the server listens on every interface unless HOST is set", () => {
  assert.equal(listenHost(undefined), "0.0.0.0");
  assert.equal(listenHost("127.0.0.1"), "127.0.0.1");
});

test("realtime tokens stay short-lived", () => {
  assert.equal(tokenTtlSeconds(undefined), 120);
  assert.equal(tokenTtlSeconds("30"), 30);
  assert.equal(tokenTtlSeconds("900"), 300);
});
