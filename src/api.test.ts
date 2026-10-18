import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_API, resolveApiBase } from "./api";

test("a configured API address is used on every host", () => {
  assert.equal(resolveApiBase("https://api.example.com/", "prashma03.github.io"), "https://api.example.com");
  assert.equal(resolveApiBase("http://localhost:8799", "localhost"), "http://localhost:8799");
});

test("localhost keeps the local server when no address is configured", () => {
  assert.equal(resolveApiBase(undefined, "localhost"), LOCAL_API);
  assert.equal(resolveApiBase("  ", "127.0.0.1"), LOCAL_API);
});

test("the public site does not fall back to localhost", () => {
  assert.equal(resolveApiBase(undefined, "prashma03.github.io"), null);
  assert.equal(resolveApiBase("", "prashma03.github.io"), null);
});
