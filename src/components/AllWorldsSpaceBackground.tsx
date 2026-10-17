import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";

/**
 * Decorative sky behind All Worlds and the Mars dashboard. One canvas, no React updates
 * while it animates. Unmounting the page clears the frame loop and comet timer.
 */

type Layer = "far" | "mid" | "near";

type Star = {
  nx: number;
  ny: number;
  r: number;
  rgb: string;
  alpha: number;
  halo: number;
  spikes: boolean;
  twinkle: boolean;
  breathe: boolean;
  period: number;
  phase: number;
  layer: Layer;
};

type Comet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  length: number;
};

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function tint(next: () => number) {
  const roll = next();
  if (roll > 0.88) return "255, 214, 176";
  if (roll > 0.62) return "186, 214, 255";
  return "244, 247, 255";
}

function clearOfHeadline(nx: number, ny: number) {
  return !(nx > 0.24 && nx < 0.76 && ny > 0.04 && ny < 0.3);
}

function makeStars(mobile: boolean): Star[] {
  const next = rng(20261017);
  const stars: Star[] = [];

  const push = (star: Star) => {
    stars.push(star);
  };

  const farCount = mobile ? 220 : 460;
  let guard = 0;
  while (stars.length < farCount && guard < farCount * 8) {
    guard += 1;
    const nx = next();
    const ny = next();
    if (!clearOfHeadline(nx, ny) && next() > 0.35) continue;
    const r = 0.45 + next() * 0.6;
    push({
      nx,
      ny,
      r,
      rgb: tint(next),
      alpha: 0.28 + next() * 0.38,
      halo: 0,
      spikes: false,
      twinkle: next() < 0.16,
      breathe: false,
      period: 3400 + next() * 6200,
      phase: next() * Math.PI * 2,
      layer: "far",
    });
  }

  const midCount = mobile ? 26 : 52;
  guard = 0;
  const midStart = stars.length;
  while (stars.length < midStart + midCount && guard < midCount * 10) {
    guard += 1;
    const nx = next();
    const ny = next();
    if (!clearOfHeadline(nx, ny) && next() > 0.2) continue;
    const r = 1.5 + next() * 1.5;
    push({
      nx,
      ny,
      r,
      rgb: tint(next),
      alpha: 0.72 + next() * 0.28,
      halo: 4.5 + next() * 4,
      spikes: false,
      twinkle: false,
      breathe: next() < 0.55,
      period: 4200 + next() * 5000,
      phase: next() * Math.PI * 2,
      layer: "mid",
    });
  }

  const nearCount = mobile ? 10 : 15;
  guard = 0;
  let spikesLeft = mobile ? 3 : 6;
  const nearStart = stars.length;
  while (stars.length < nearStart + nearCount && guard < nearCount * 20) {
    guard += 1;
    const nx = 0.03 + next() * 0.94;
    const ny = 0.04 + next() * 0.92;
    if (!clearOfHeadline(nx, ny)) continue;
    const crowded = stars.slice(nearStart).some((star) => Math.hypot(star.nx - nx, star.ny - ny) < 0.11);
    if (crowded) continue;
    const spikes = spikesLeft > 0 && next() > 0.35;
    if (spikes) spikesLeft -= 1;
    const r = 2.1 + next() * 1.8;
    push({
      nx,
      ny,
      r,
      rgb: next() > 0.72 ? "214, 230, 255" : "250, 252, 255",
      alpha: 0.92 + next() * 0.08,
      halo: 8 + next() * 10,
      spikes,
      twinkle: false,
      breathe: true,
      period: 5200 + next() * 4600,
      phase: next() * Math.PI * 2,
      layer: "near",
    });
  }
  return stars;
}

function drawDust(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#07080A";
  ctx.fillRect(0, 0, w, h);
  const washes = [
    { x: -0.02, y: 0.12, rx: 0.3, ry: 0.38, a: 0.1, color: "96, 112, 184" },
    { x: 0.02, y: 0.82, rx: 0.24, ry: 0.3, a: 0.07, color: "78, 90, 168" },
    { x: 1.02, y: 0.1, rx: 0.28, ry: 0.36, a: 0.09, color: "88, 108, 180" },
    { x: 0.98, y: 0.8, rx: 0.26, ry: 0.32, a: 0.08, color: "112, 96, 176" },
    { x: 0.06, y: 0.48, rx: 0.14, ry: 0.42, a: 0.045, color: "90, 114, 186" },
    { x: 0.94, y: 0.46, rx: 0.13, ry: 0.36, a: 0.04, color: "104, 96, 176" },
  ];
  for (const wash of washes) {
    const cx = wash.x * w;
    const cy = wash.y * h;
    const rx = wash.rx * w;
    const ry = wash.ry * h;
    const g = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.08, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, `rgba(${wash.color}, ${wash.a})`);
    g.addColorStop(0.55, `rgba(${wash.color}, ${wash.a * 0.35})`);
    g.addColorStop(1, `rgba(${wash.color}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStar(ctx: CanvasRenderingContext2D, star: Star, x: number, y: number, fade: number, glow: number) {
  if (star.halo > 0) {
    const rad = star.halo * glow;
    const strength = star.layer === "near" ? 0.5 : 0.26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${star.rgb}, ${strength * fade})`);
    g.addColorStop(0.28, `rgba(${star.rgb}, ${strength * 0.38 * fade})`);
    g.addColorStop(1, `rgba(${star.rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  if (star.spikes) {
    ctx.save();
    ctx.translate(x, y);
    const len = 11 + star.r * 3.2;
    ctx.strokeStyle = `rgba(232, 240, 255, ${0.22 * fade})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.lineTo(len, 0);
    ctx.moveTo(0, -len * 0.72);
    ctx.lineTo(0, len * 0.72);
    ctx.stroke();
    ctx.strokeStyle = `rgba(248, 250, 255, ${0.7 * fade})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = `rgba(${star.rgb}, ${Math.min(1, star.alpha * fade)})`;
  ctx.beginPath();
  ctx.arc(x, y, star.r, 0, Math.PI * 2);
  ctx.fill();
}

function crossesUi(x: number, y: number, w: number, h: number) {
  const nx = x / w;
  const ny = y / h;
  const headline = nx > 0.22 && nx < 0.78 && ny > 0.03 && ny < 0.32;
  const nav = nx > 0.32 && nx < 0.68 && ny > 0 && ny < 0.09;
  const planets = nx > 0.12 && nx < 0.88 && ny > 0.3 && ny < 0.9;
  return headline || nav || planets;
}

function spawnComet(w: number, h: number, next: () => number): Comet {
  const scale = Math.min(1.05, Math.max(0.8, w / 1200));
  const lanes = [
    { x: -16, y: h * 0.12, dx: w * 0.2, dy: h * 0.08 },
    { x: w + 16, y: h * 0.1, dx: -w * 0.18, dy: h * 0.09 },
    { x: w * 0.05, y: -20, dx: w * 0.1, dy: h * 0.22 },
    { x: w * 0.95, y: -18, dx: -w * 0.08, dy: h * 0.2 },
    { x: w + 12, y: h * 0.48, dx: -w * 0.1, dy: -h * 0.08 },
    { x: -12, y: h * 0.58, dx: w * 0.1, dy: -h * 0.07 },
  ];
  const offset = Math.floor(next() * lanes.length);
  let lane = lanes[0];
  for (let i = 0; i < lanes.length; i += 1) {
    const candidate = lanes[(offset + i) % lanes.length];
    let blocked = false;
    for (let step = 0; step <= 6; step += 1) {
      const t = step / 6;
      if (crossesUi(candidate.x + candidate.dx * t, candidate.y + candidate.dy * t, w, h)) blocked = true;
    }
    if (!blocked) {
      lane = candidate;
      break;
    }
  }
  const life = 1600 + next() * 900;
  return {
    x: lane.x,
    y: lane.y,
    vx: lane.dx / life,
    vy: lane.dy / life,
    born: 0,
    life,
    length: (130 + next() * 50) * scale,
  };
}

function drawComet(ctx: CanvasRenderingContext2D, comet: Comet, now: number) {
  const age = now - comet.born;
  const t = age / comet.life;
  if (t <= 0 || t >= 1) return;
  const fade = Math.sin(t * Math.PI);
  const x = comet.x + comet.vx * age;
  const y = comet.y + comet.vy * age;
  const ang = Math.atan2(comet.vy, comet.vx);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const steps = 28;
  for (let i = steps; i >= 1; i -= 1) {
    const u = i / steps;
    const along = Math.pow(1 - u, 0.85);
    const px = x - cos * comet.length * u;
    const py = y - sin * comet.length * u;
    const radius = 0.8 + along * 6.4;
    const alpha = fade * along * 0.78;
    ctx.fillStyle = `rgba(${u > 0.4 ? "186, 214, 255" : "236, 244, 255"}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  const streak = ctx.createLinearGradient(x - cos * comet.length, y - sin * comet.length, x, y);
  streak.addColorStop(0, "rgba(186, 214, 255, 0)");
  streak.addColorStop(0.62, `rgba(206, 224, 255, ${0.28 * fade})`);
  streak.addColorStop(1, `rgba(255, 255, 255, ${0.8 * fade})`);
  ctx.strokeStyle = streak;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - cos * comet.length, y - sin * comet.length);
  ctx.lineTo(x, y);
  ctx.stroke();
  const head = ctx.createRadialGradient(x, y, 0, x, y, 9);
  head.addColorStop(0, `rgba(255, 255, 255, ${fade})`);
  head.addColorStop(0.28, `rgba(226, 238, 255, ${0.85 * fade})`);
  head.addColorStop(1, "rgba(170, 204, 255, 0)");
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * fade})`;
  ctx.beginPath();
  ctx.arc(x, y, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function AllWorldsSpaceBackground() {
  const hostRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;

    const canvas = document.createElement("canvas");
    canvas.dataset.allWorldsSky = "1";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block;";
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    const plate = document.createElement("canvas");
    const plateCtx = plate.getContext("2d");
    if (!plateCtx) {
      canvas.remove();
      return;
    }

    let stars = makeStars(window.innerWidth < 760);
    let raf = 0;
    let cometTimer = 0;
    let comet: Comet | null = null;
    let alive = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const paintPlate = (w: number, h: number, dpr: number) => {
      plate.width = Math.round(w * dpr);
      plate.height = Math.round(h * dpr);
      plateCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDust(plateCtx, w, h);
      const still = reduced.matches;
      for (const star of stars) {
        if (!still && (star.twinkle || star.breathe)) continue;
        drawStar(plateCtx, star, star.nx * w, star.ny * h, 1, 1);
      }
    };

    const drawMoving = (now: number, w: number, h: number) => {
      for (const star of stars) {
        if (!star.twinkle && !star.breathe) continue;
        const wave = 0.5 + 0.5 * Math.sin((now / star.period) * Math.PI * 2 + star.phase);
        const fade = star.twinkle ? 0.55 + wave * 0.45 : 0.92 + wave * 0.08;
        const glow = star.breathe ? 0.78 + wave * 0.22 : 1;
        drawStar(ctx, star, star.nx * w, star.ny * h, fade, glow);
      }
      if (comet) {
        drawComet(ctx, comet, now);
        if (now - comet.born > comet.life) comet = null;
      }
    };

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars(w < 760);
      paintPlate(w, h, dpr);
    };

    const frame = (now: number) => {
      if (!alive) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(plate, 0, 0);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!reduced.matches) drawMoving(now, w, h);
      raf = requestAnimationFrame(frame);
    };

    const armComet = (delay: number) => {
      if (!alive || reduced.matches) return;
      cometTimer = window.setTimeout(() => {
        if (!alive || reduced.matches) return;
        if (!comet) {
          const next = rng((Math.floor(performance.now()) % 2147483646) + 1);
          const spawned = spawnComet(window.innerWidth, window.innerHeight, next);
          spawned.born = performance.now();
          comet = spawned;
        }
        armComet(10000 + Math.random() * 6000);
      }, delay);
    };

    fit();
    if (reduced.matches) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(plate, 0, 0);
    } else {
      raf = requestAnimationFrame(frame);
      armComet(4000 + Math.random() * 5000);
    }

    const onResize = () => fit();
    const onMotion = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(cometTimer);
      comet = null;
      fit();
      if (reduced.matches) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(plate, 0, 0);
        return;
      }
      raf = requestAnimationFrame(frame);
      armComet(4000 + Math.random() * 4000);
    };
    window.addEventListener("resize", onResize);
    reduced.addEventListener("change", onMotion);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(cometTimer);
      window.removeEventListener("resize", onResize);
      reduced.removeEventListener("change", onMotion);
      canvas.remove();
    };
  }, []);

  if (Platform.OS !== "web") return null;

  return (
    <View
      ref={hostRef}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.host, webFixed]}
    />
  );
}

const webFixed = { position: "fixed" } as unknown as ViewStyle;

const styles = StyleSheet.create({
  host: {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
  },
});
