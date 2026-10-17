import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Cursor comet for the All Worlds page only.
 * One transparent canvas, no React updates while the pointer moves.
 * Unmounting the page removes the canvas, listeners, and frame loop.
 */

const FADE_MS = 540;
const MIN_LEN = 20;
const MAX_LEN = 65;
const MAX_DPR = 2;

type Mark = { x: number; y: number; t: number };
type Pt = { x: number; y: number; life: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function trailFor(pxPerSec: number) {
  const t = clamp((pxPerSec - 70) / 1550, 0, 1);
  const eased = t * t * (3 - 2 * t);
  return { length: MIN_LEN + eased * (MAX_LEN - MIN_LEN), bright: 0.72 + eased * 0.28 };
}

function buildChain(marks: Mark[], head: Mark, now: number, maxLen: number, presence: number): Pt[] {
  const rev: Pt[] = [{ x: head.x, y: head.y, life: presence }];
  let remain = maxLen;
  let cursor = head;
  for (let i = marks.length - 1; i >= 0 && remain > 0.4; i -= 1) {
    const mark = marks[i];
    const age = now - mark.t;
    if (age > FADE_MS) break;
    const dist = Math.hypot(mark.x - cursor.x, mark.y - cursor.y);
    if (dist < 0.25) continue;
    const life = clamp(1 - age / FADE_MS, 0, 1) * presence;
    if (dist <= remain) {
      rev.push({ x: mark.x, y: mark.y, life });
      remain -= dist;
      cursor = mark;
    } else {
      const span = remain / dist;
      rev.push({
        x: cursor.x + (mark.x - cursor.x) * span,
        y: cursor.y + (mark.y - cursor.y) * span,
        life: life * span,
      });
      remain = 0;
    }
  }
  rev.reverse();
  return rev;
}

function soften(pts: Pt[]): Pt[] {
  if (pts.length < 4) return pts;
  const out = pts.map((pt) => ({ ...pt }));
  const last = pts.length - 1;
  for (let i = 1; i < last; i += 1) {
    const towardTail = 1 - i / last;
    const weight = 0.18 * towardTail;
    const prev = pts[i - 1];
    const next = pts[i + 1];
    out[i].x = pts[i].x * (1 - weight) + ((prev.x + next.x) * 0.5) * weight;
    out[i].y = pts[i].y * (1 - weight) + ((prev.y + next.y) * 0.5) * weight;
  }
  out[0] = { ...pts[0] };
  out[last] = { ...pts[last] };
  return out;
}

function resample(pts: Pt[], spacing: number): Pt[] {
  if (pts.length < 2) return pts;
  const out: Pt[] = [{ ...pts[0] }];
  let pending = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const from = pts[i - 1];
    const to = pts[i];
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    if (dist < 0.001) continue;
    let traveled = spacing - pending;
    while (traveled <= dist + 0.001) {
      const span = traveled / dist;
      out.push({
        x: from.x + (to.x - from.x) * span,
        y: from.y + (to.y - from.y) * span,
        life: from.life + (to.life - from.life) * span,
      });
      traveled += spacing;
    }
    pending = dist - (traveled - spacing);
  }
  const tail = out[out.length - 1];
  const end = pts[pts.length - 1];
  if (Math.hypot(end.x - tail.x, end.y - tail.y) > 0.45) out.push({ ...end });
  else {
    tail.x = end.x;
    tail.y = end.y;
    tail.life = end.life;
  }
  return out;
}

function colorAt(along: number, alpha: number) {
  const r = Math.round(198 + along * 57);
  const g = Math.round(222 + along * 33);
  const b = 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function paintRibbon(ctx: CanvasRenderingContext2D, pts: Pt[], soft: boolean, bright: number) {
  const count = pts.length;
  if (count < 2) return;
  const normals: { x: number; y: number }[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(count - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    normals[i] = { x: -dy / len, y: dx / len };
  }

  for (let i = 0; i < count - 1; i += 1) {
    const along = (i + 1) / (count - 1);
    const falloff = along ** 1.65;
    const a = pts[i];
    const b = pts[i + 1];
    const life = b.life;
    const alpha = (soft ? 0.035 + falloff * 0.11 : (0.04 + falloff * 0.7) * bright) * life;
    if (alpha < 0.006) continue;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let n0 = normals[i];
    let n1 = normals[i + 1];
    if (n0.x * n1.x + n0.y * n1.y < 0.35) {
      n0 = { x: -dy / len, y: dx / len };
      n1 = n0;
    }
    const taper0 = (i / (count - 1)) ** 1.35;
    const taper1 = along ** 1.35;
    const w0 = soft ? 0.55 + taper0 * 1.55 : 0.16 + taper0 * 0.82;
    const w1 = soft ? 0.55 + taper1 * 1.55 : 0.16 + taper1 * 0.82;

    ctx.beginPath();
    ctx.moveTo(a.x + n0.x * w0, a.y + n0.y * w0);
    ctx.lineTo(b.x + n1.x * w1, b.y + n1.y * w1);
    ctx.lineTo(b.x - n1.x * w1, b.y - n1.y * w1);
    ctx.lineTo(a.x - n0.x * w0, a.y - n0.y * w0);
    ctx.closePath();
    ctx.fillStyle = soft ? `rgba(176, 208, 255, ${alpha})` : colorAt(along, alpha);
    ctx.fill();
  }
}

function paintHead(ctx: CanvasRenderingContext2D, x: number, y: number, presence: number, bright: number) {
  const glow = presence * (0.82 + bright * 0.18);
  if (glow < 0.02) return;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 6);
  halo.addColorStop(0, `rgba(255, 255, 255, ${0.92 * glow})`);
  halo.addColorStop(0.2, `rgba(236, 244, 255, ${0.42 * glow})`);
  halo.addColorStop(0.5, `rgba(186, 214, 255, ${0.1 * glow})`);
  halo.addColorStop(1, "rgba(186, 214, 255, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${glow})`;
  ctx.beginPath();
  ctx.arc(x, y, 1.25, 0, Math.PI * 2);
  ctx.fill();
}

export function CometCursorTrail() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || typeof window === "undefined") return;

    const fine = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let alive = true;
    let stopTrail: (() => void) | null = null;

    const stop = () => {
      stopTrail?.();
      stopTrail = null;
    };

    const start = () => {
      if (!alive || stopTrail || reduced.matches || !fine.matches) return;

      const canvas = document.createElement("canvas");
      canvas.dataset.desmasCometCursor = "1";
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:20;";
      canvas.style.setProperty("pointer-events", "none", "important");
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) {
        canvas.remove();
        return;
      }

      let cssW = 1;
      let cssH = 1;
      let dpr = 1;
      let raf = 0;
      let speed = 0;
      let lastMove = 0;
      let head: Mark | null = null;
      const marks: Mark[] = [];

      const fit = () => {
        const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const nextW = Math.max(1, window.innerWidth);
        const nextH = Math.max(1, window.innerHeight);
        const bitmapW = Math.round(nextW * nextDpr);
        const bitmapH = Math.round(nextH * nextDpr);
        if (bitmapW === canvas.width && bitmapH === canvas.height && nextDpr === dpr) return false;
        dpr = nextDpr;
        cssW = nextW;
        cssH = nextH;
        canvas.width = bitmapW;
        canvas.height = bitmapH;
        canvas.style.width = `${nextW}px`;
        canvas.style.height = `${nextH}px`;
        return true;
      };

      const prune = (now: number) => {
        const cutoff = now - FADE_MS;
        let drop = 0;
        while (drop < marks.length && marks[drop].t < cutoff) drop += 1;
        if (drop > 0) marks.splice(0, drop);
        if (marks.length > 120) marks.splice(0, marks.length - 120);
      };

      const render = (now: number) => {
        if (!head) return false;
        const idle = now - lastMove;
        if (idle >= FADE_MS) return false;
        const presence = clamp(1 - idle / FADE_MS, 0, 1);
        const shaped = trailFor(speed);
        const chain = soften(buildChain(marks, head, now, shaped.length, presence));
        const pts = resample(chain, 2.2);
        if (pts.length >= 2) {
          paintRibbon(ctx, pts, true, shaped.bright);
          paintRibbon(ctx, pts, false, shaped.bright);
        }
        paintHead(ctx, head.x, head.y, presence, shaped.bright);
        return presence > 0.012;
      };

      const frame = (now: number) => {
        raf = 0;
        if (!alive || document.hidden) return;
        const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        if (nextDpr !== dpr || canvas.width !== Math.round(window.innerWidth * nextDpr) || canvas.height !== Math.round(window.innerHeight * nextDpr)) {
          fit();
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        prune(now);
        if (render(now) && alive && !document.hidden) raf = requestAnimationFrame(frame);
      };

      const arm = () => {
        if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
      };

      const pushSegment = (from: Mark, x: number, y: number, t: number) => {
        const dist = Math.hypot(x - from.x, y - from.y);
        if (dist < 0.2) return dist;
        const steps = Math.min(28, Math.ceil(dist / 5.5));
        for (let step = 1; step <= steps; step += 1) {
          const span = step / steps;
          marks.push({
            x: from.x + (x - from.x) * span,
            y: from.y + (y - from.y) * span,
            t: from.t + (t - from.t) * span,
          });
        }
        return dist;
      };

      const onMove = (event: PointerEvent) => {
        if (!alive || event.pointerType === "touch") return;
        const now = performance.now();
        const batch = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
        const samples = batch.length > 0 ? batch : [event];
        let prev: Mark = head ?? { x: samples[0].clientX, y: samples[0].clientY, t: now };
        let path = 0;
        for (const sample of samples) {
          path += pushSegment(prev, sample.clientX, sample.clientY, now);
          prev = { x: sample.clientX, y: sample.clientY, t: now };
        }
        path += pushSegment(prev, event.clientX, event.clientY, now);
        if (head && path < 0.2 && Math.hypot(event.clientX - head.x, event.clientY - head.y) < 0.2) return;
        if (head && path > 0) {
          const dt = Math.max(now - head.t, 8);
          const instant = (path / dt) * 1000;
          speed += (instant - speed) * 0.42;
        }
        head = { x: event.clientX, y: event.clientY, t: now };
        lastMove = now;
        prune(now);
        arm();
      };

      const onResize = () => {
        if (fit()) arm();
      };
      const onVisibility = () => {
        if (document.hidden) {
          cancelAnimationFrame(raf);
          raf = 0;
          return;
        }
        arm();
      };

      fit();
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibility);

      stopTrail = () => {
        cancelAnimationFrame(raf);
        raf = 0;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibility);
        canvas.remove();
      };
    };

    const sync = () => {
      if (!alive) return;
      if (reduced.matches || !fine.matches) stop();
      else start();
    };

    sync();
    fine.addEventListener("change", sync);
    reduced.addEventListener("change", sync);

    return () => {
      alive = false;
      stop();
      fine.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);

  return null;
}
