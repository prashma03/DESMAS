import assert from "node:assert/strict";
import test from "node:test";
import captured from "./fixtures/power-20250621.json";
import { EARTH_POWER_DAY, buildPowerReplay, parsePowerHourlyPoint, powerHourlyPointUrl } from "./powerDay";

const SOURCE = powerHourlyPointUrl(EARTH_POWER_DAY);

test("the Earth request is one UTC POWER day of ALLSKY_SFC_SW_DWN", () => {
  assert.equal(
    SOURCE,
    "https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=-77&latitude=38&start=20250621&end=20250621&format=JSON&time-standard=UTC",
  );
});

test("the captured 21 June 2025 response keeps units, fill, and measured zeros", () => {
  const day = parsePowerHourlyPoint(captured, { sourceUrl: SOURCE, latitude: 38, longitude: -77 });
  assert.equal(day.units, "Wh/m^2");
  assert.equal(day.fillValue, -999);
  assert.equal(day.timeStandard, "UTC");
  assert.equal(day.latitude, 38);
  assert.equal(day.longitude, -77);
  assert.equal(day.elevationM, 24.8);
  assert.equal(day.hours.length, 24);
  assert.equal(day.hours[0].timestampUtc, "2025-06-21T00:00:00Z");
  assert.equal(day.hours[0].irradiance, 5.9);
  assert.equal(day.hours[1].irradiance, 0);
  assert.equal(day.hours.filter((hour) => hour.irradiance === null).length, 0);
  const scenario = buildPowerReplay(day);
  assert.equal(scenario.i0, 903.47);
  assert.equal(scenario.formula, "clamp(100 * (1 - I / I0), 0, 100)");
  assert.equal(scenario.hours[0].modeledDark, 100 * (1 - 5.9 / 903.47));
  assert.deepEqual(scenario.hours[0].leds, [1, 2, 0, 0]);
  assert.deepEqual(scenario.hours[11].leds, [1, 1, 0, 0]);
  assert.deepEqual(scenario.hours[13].leds, [1, 1, 1, 0]);
  assert.deepEqual(scenario.hours[14].leds, [1, 1, 1, 1]);
  assert.deepEqual(scenario.hours[16].leds, [1, 1, 1, 1]);
  assert.equal(scenario.hours[16].modeledDark, 0);
  assert.deepEqual(scenario.hours[20].leds, [1, 1, 1, 0]);
  assert.deepEqual(scenario.hours[23].leds, [1, 2, 0, 0]);
});

test("the API fill value stays missing and is not turned into zero irradiance", () => {
  const day = parsePowerHourlyPoint(
    {
      geometry: { coordinates: [-77, 38, 24.8] },
      properties: { parameter: { ALLSKY_SFC_SW_DWN: { "2025062100": -999, "2025062101": 10 } } },
      header: {
        fill_value: -999,
        time_standard: "UTC",
        start: "20250621",
        end: "20250621",
        sources: ["SYN1DEG"],
        title: "test",
        api: { version: "v2.10.3", name: "POWER Hourly API" },
      },
      parameters: { ALLSKY_SFC_SW_DWN: { units: "Wh/m^2", longname: "All Sky Surface Shortwave Downward Irradiance" } },
      messages: [],
    },
    { sourceUrl: SOURCE, latitude: 38, longitude: -77 },
  );
  assert.equal(day.hours[0].irradiance, null);
  assert.equal(day.hours[1].irradiance, 10);
  const scenario = buildPowerReplay(day);
  assert.equal(scenario.hours[0].missing, true);
  assert.equal(scenario.hours[0].leds, null);
  assert.equal(scenario.i0, 10);
  assert.equal(scenario.hours[1].modeledDark, 0);
});

test("a response without units or UTC is rejected", () => {
  const base = captured as { parameters: { ALLSKY_SFC_SW_DWN: { units: string } }; header: { time_standard: string } };
  const noUnits = structuredClone(base);
  noUnits.parameters.ALLSKY_SFC_SW_DWN.units = "";
  assert.throws(() => parsePowerHourlyPoint(noUnits, { sourceUrl: SOURCE, latitude: 38, longitude: -77 }), /units/);
  const lst = structuredClone(captured) as { header: { time_standard: string } };
  lst.header.time_standard = "LST";
  assert.throws(() => parsePowerHourlyPoint(lst, { sourceUrl: SOURCE, latitude: 38, longitude: -77 }), /UTC/);
});
