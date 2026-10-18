import assert from "node:assert/strict";
import test from "node:test";
import { advanceIntro, introSoundPrompt } from "./introSession";

test("intro plays video 1, then video 2, then finishes", () => {
  assert.equal(advanceIntro("video1", "end"), "video2");
  assert.equal(advanceIntro("video2", "end"), "complete");
});

test("a failed video advances instead of staying on the intro", () => {
  assert.equal(advanceIntro("video1", "error"), "video2");
  assert.equal(advanceIntro("video2", "error"), "complete");
});

test("skip leaves the intro from either video", () => {
  assert.equal(advanceIntro("video1", "skip"), "complete");
  assert.equal(advanceIntro("video2", "skip"), "complete");
  assert.equal(advanceIntro("complete", "end"), "complete");
});

test("intro stays silent until the viewer asks, then the prompt goes away", () => {
  assert.equal(introSoundPrompt(false, false, false), null);
  assert.equal(introSoundPrompt(false, false, true), "play");
  assert.equal(introSoundPrompt(false, true, false), "enable");
  assert.equal(introSoundPrompt(false, true, true), "enable");
  assert.equal(introSoundPrompt(true, true, true), null);
});
