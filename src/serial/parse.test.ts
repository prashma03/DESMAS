import assert from "node:assert/strict";
import test from "node:test";
import type { KitReading } from "../kit/types";
import { parseMessage, pullMessages } from "./parse";

const SAMPLE =
  '{"ms":61500,"light":233,"lbase":230,"dark":1,"hum":52.0,"hbase":52.0,"cut":62.0,"temp":27.4,"alarm":0,"muted":0,"dht":1,"leds":[1,1,1,1]}';

function reading(partial: Partial<KitReading> = {}): KitReading {
  return {
    ms: 1,
    light: 230,
    lbase: 230,
    dark: 0,
    hum: 52,
    hbase: 52,
    cut: 62,
    temp: 27,
    alarm: 0,
    muted: 0,
    dht: 1,
    leds: [1, 1, 1, 1],
    ...partial,
  };
}

test("accepts a firmware reading and keeps the LED tuple", () => {
  const parsed = parseMessage(SAMPLE, null);
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.type !== "reading") return;
  assert.deepEqual(parsed.reading.leds, [1, 1, 1, 1]);
  assert.equal(parsed.reading.dark, 1);
  assert.equal(parsed.reading.alarm, 0);
});

test("rejects malformed JSON, missing fields, and non-finite numbers", () => {
  assert.equal(parseMessage("{", null).ok, false);
  assert.equal(parseMessage("not json", null).ok, false);
  assert.equal(parseMessage('{"event":"calibrated"}', null).ok, false);
  assert.equal(parseMessage(SAMPLE.replace('"dark":1', '"dark":null'), null).ok, false);
  assert.equal(parseMessage(SAMPLE.replace('"leds":[1,1,1,1]', '"leds":[1,1,1]'), null).ok, false);
  assert.equal(parseMessage(SAMPLE.replace('"hum":52.0', '"hum":"wet"'), null).ok, false);
  assert.equal(parseMessage('{"ok":true}', null).ok, false);
});

test("a disconnected DHT cannot raise a humidity alarm", () => {
  const dead = SAMPLE.replace('"hum":52.0', '"hum":null').replace('"alarm":0', '"alarm":1').replace('"dht":1', '"dht":0');
  const parsed = parseMessage(dead, reading({ alarm: 0, hum: 53 }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.type !== "reading") return;
  assert.equal(parsed.reading.alarm, 0);
  assert.equal(parsed.reading.hum, 53);
});

test("a real alarm is kept when the DHT reading is present", () => {
  const hot = SAMPLE.replace('"hum":52.0', '"hum":71.2').replace('"alarm":0', '"alarm":1');
  const parsed = parseMessage(hot, reading());
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.type !== "reading") return;
  assert.equal(parsed.reading.alarm, 1);
  assert.equal(parsed.reading.hum, 71.2);
  assert.deepEqual(parsed.reading.leds, [1, 1, 1, 1]);
});

test("low-power comms stay at LED value 2", () => {
  const night = SAMPLE.replace('"dark":1', '"dark":90').replace('"leds":[1,1,1,1]', '"leds":[1,2,0,0]');
  const parsed = parseMessage(night, null);
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.type !== "reading") return;
  assert.deepEqual(parsed.reading.leds, [1, 2, 0, 0]);
});

test("splits partial lines and messages that arrive together", () => {
  const first = pullMessages(SAMPLE.slice(0, 20));
  assert.deepEqual(first.messages, []);
  const done = pullMessages(first.rest + SAMPLE.slice(20) + SAMPLE);
  assert.equal(done.messages.length, 2);
  assert.equal(done.rest, "");
  assert.equal(parseMessage(done.messages[0], null).ok, true);
  assert.equal(parseMessage(done.messages[1], null).ok, true);
});

test("keeps an incomplete tail and drops a runaway buffer", () => {
  const partial = pullMessages('{"ms":1');
  assert.equal(partial.messages.length, 0);
  assert.equal(partial.rest, '{"ms":1');
  const huge = pullMessages(`{${"x".repeat(9000)}`);
  assert.equal(huge.rest, "");
});
