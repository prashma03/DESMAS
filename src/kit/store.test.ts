import assert from "node:assert/strict";
import test from "node:test";
import { kitStore } from "./store";

const line = (dark: number, alarm: 0 | 1, hum: number, leds: string) =>
  `{"ms":10,"light":300,"lbase":230,"dark":${dark},"hum":${hum},"hbase":52,"cut":62,"temp":27.4,"alarm":${alarm},"muted":0,"dht":1,"leds":${leds}}`;

test("serial readings stay authoritative over the simulation", () => {
  kitStore.goSim();
  assert.equal(kitStore.getSnapshot().source, "simulated");
  assert.equal(kitStore.ingestLine("not-json"), false);
  assert.equal(kitStore.ingestLine('{"dark":10}'), false);
  assert.equal(kitStore.getSnapshot().link, "simulated");

  assert.equal(kitStore.ingestLine(line(40, 0, 52, "[1,1,1,0]")), true);
  const live = kitStore.getSnapshot();
  assert.equal(live.source, "serial");
  assert.equal(live.link, "live");
  assert.deepEqual([...live.reading.leds], [1, 1, 1, 0]);
  assert.equal(live.reading.dark, 40);

  kitStore.markDisconnected("The board disconnected.");
  const stale = kitStore.getSnapshot();
  assert.equal(stale.link, "disconnected");
  assert.equal(stale.source, "serial");
  assert.equal(stale.reading.dark, 40);
  assert.equal(stale.reading.leds[3], 0);

  assert.equal(kitStore.ingestLine(line(90, 1, 71, "[1,2,0,0]")), true);
  const again = kitStore.getSnapshot();
  assert.equal(again.link, "live");
  assert.equal(again.reading.alarm, 1);
  assert.deepEqual([...again.reading.leds], [1, 2, 0, 0]);

  assert.equal(kitStore.ingestLine(line(12, 0, 52, "[1,1,1,1]")), true);
  assert.equal(kitStore.getSnapshot().reading.alarm, 0);
  assert.equal(kitStore.getSnapshot().reading.leds[1], 1);
});
