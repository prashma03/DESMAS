import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";

/**
 * Decorative sky for the All Worlds page only. One canvas, no React updates
 * while it animates. Unmounting the page clears the frame loop and comet timer.
 */

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

function makeStars(mobile: boolean): Star[] {
  const next = rng(20261017);
  const count = mobile ? 230 : 520;
  const stars: Star[] = [];
  let guard = 0;
  while (stars.length < count && guard < count * 14) {
    guard += 1;
    const nx = next();
    const ny = next();
    const dx = Math.abs(nx - 0.5) / 0.5;
    const dy = Math.abs(ny - 0.5) / 0.5;
    const fromCenter = Math.hypot(dx * 0.9, dy * 1.15);
    const heading = ny > 0.05 && ny < 0.3 && nx > 0.22 && nx < 0.78;
    const planets = ny > 0.3 && ny < 0.82 && nx > 0.16 && nx < 0.84;
    if (heading && next() > 0.12) continue;
    if (planets && next() > 0.28) continue;
    if (fromCenter < 0.62 && next() > 0.4) continue;

    const roll = next();
    const r = roll > 0.985 ? 2.6 + next() * 0.7 : roll > 0.94 ? 1.6 + next() * 0.6 : roll > 0.72 ? 0.9 + next() * 0.45 : 0.35 + next() * 0.4;
    const tint = next();
    const rgb = tint > 0.92 ? "232, 196, 150" : tint > 0.78 ? "176, 206, 255" : "236, 242, 255";
    const halo = r >= 1.6 ? r * (mobile ? 3.2 : 4.4) : 0;
    const spikes = !mobile && r >= 2.4 && next() > 0.35;
    const twinkle = !spikes && next() < 0.1;
    const breathe = halo > 0 && !twinkle && next() < 0.45;
    stars.push({
      nx,
      ny,
      r,
      rgb,
      alpha: (r >= 1.6 ? 0.72 : 0.28) + next() * (r >= 1.6 ? 0.26 : 0.42),
      halo,
      spikes,
      twinkle,
      breathe,
      period: 2800 + next() * 5200,
      phase: next() * Math.PI * 2,
    });
  }
  return stars;
}

function drawDust(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const next = rng(4181);
  const blobs = [
    { x: 0.04, y: 0.18, rx: 0.22, ry: 0.34, color: "88, 104, 168" },
    { x: -0.02, y: 0.62, rx: 0.16, ry: 0.28, color: "64, 78, 140" },
    { x: 0.08, y: 0.42, rx: 0.1, ry: 0.16, color: "110, 96, 160" },
    { x: 0.98, y: 0.22, rx: 0.2, ry: 0.3, color: "78, 96, 156" },
    { x: 1.02, y: 0.7, rx: 0.18, ry: 0.26, color: "96, 84, 150" },
    { x: 0.9, y: 0.48, rx: 0.09, ry: 0.14, color: "70, 90, 150" },
  ];
  for (const blob of blobs) {
    const jx = (next() - 0.5) * 0.04;
    const jy = (next() - 0.5) * 0.06;
    const cx = (blob.x + jx) * w;
    const cy = (blob.y + jy) * h;
    const rad = Math.max(blob.rx * w, blob.ry * h) * (0.85 + next() * 0.3);
    const g = ctx.createRadialGradient(cx, cy, rad * 0.1, cx, cy, rad);
    g.addColorStop(0, `rgba(${blob.color}, 0.055)`);
    g.addColorStop(0.45, `rgba(${blob.color}, 0.028)`);
    g.addColorStop(1, `rgba(${blob.color}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, blob.rx * w, blob.ry * h, (next() - 0.5) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStar(ctx: CanvasRenderingContext2D, star: Star, x: number, y: number, fade: number, glow: number) {
  if (star.halo > 0) {
    const rad = star.halo * glow;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${star.rgb}, ${0.2 * fade})`);
    g.addColorStop(1, `rgba(${star.rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  if (star.spikes) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(226, 236, 255, ${0.16 * fade})`;
    ctx.lineWidth = 0.6;
    const len = star.r * 5.5;
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.lineTo(len, 0);
    ctx.moveTo(0, -len * 0.72);
    ctx.lineTo(0, len * 0.72);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = `rgba(${star.rgb}, ${star.alpha * fade})`;
  ctx.beginPath();
  ctx.arc(x, y, star.r, 0, Math.PI * 2);
  ctx.fill();
}

function hitsStage(nx: number, ny: number) {
  const heading = nx > 0.2 && nx < 0.8 && ny > 0.04 && ny < 0.32;
  const planets = nx > 0.14 && nx < 0.86 && ny > 0.28 && ny < 0.86;
  return heading || planets;
}

function spawnComet(w: number, h: number, next: () => number): Comet | null {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const fromLeft = next() > 0.5;
    const y0 = (0.02 + next() * 0.22) * h;
    const x0 = fromLeft ? -20 : w + 20;
    const speed = (w * (0.28 + next() * 0.18)) / 1800;
    const angle = (fromLeft ? 1 : -1) * (0.18 + next() * 0.28);
    const vx = Math.cos(angle) * speed * (fromLeft ? 1 : -1);
    const vy = Math.sin(Math.abs(angle)) * speed * (0.55 + next() * 0.7);
    const life = 1500 + next() * 900;
    const x1 = x0 + vx * life;
    const y1 = y0 + vy * life;
    let blocked = false;
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      if (hitsStage((x0 + (x1 - x0) * t) / w, (y0 + (y1 - y0) * t) / h)) blocked = true;
    }
    if (blocked) continue;
    return { x: x0, y: y0, vx, vy, born: 0, life, length: 90 + next() * 110 };
  }
  return null;
}

function drawComet(ctx: CanvasRenderingContext2D, comet: Comet, now: number) {
  const age = now - comet.born;
  const p = Math.min(1, age / comet.life);
  const fade = Math.sin(p * Math.PI);
  if (fade <= 0.01) return;
  const x = comet.x + comet.vx * age;
  const y = comet.y + comet.vy * age;
  const ang = Math.atan2(comet.vy, comet.vx);
  const tx = x - Math.cos(ang) * comet.length;
  const ty = y - Math.sin(ang) * comet.length;
  const g = ctx.createLinearGradient(x, y, tx, ty);
  g.addColorStop(0, `rgba(255, 255, 255, ${0.95 * fade})`);
  g.addColorStop(0.12, `rgba(214, 230, 255, ${0.4 * fade})`);
  g.addColorStop(1, "rgba(180, 206, 255, 0)");
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(x, y);
  ctx.stroke();
  const head = ctx.createRadialGradient(x, y, 0, x, y, 7);
  head.addColorStop(0, `rgba(255, 255, 255, ${0.9 * fade})`);
  head.addColorStop(1, "rgba(190, 214, 255, 0)");
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
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
    if (!ctx) return;

    const plate = document.createElement("canvas");
    const plateCtx = plate.getContext("2d");
    if (!plateCtx) return;

    let stars = makeStars(window.innerWidth < 700);
    let raf = 0;
    let cometTimer = 0;
    let comet: Comet | null = null;
    let alive = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const paintPlate = (w: number, h: number) => {
      plate.width = w;
      plate.height = h;
      plateCtx.fillStyle = "#07080A";
      plateCtx.fillRect(0, 0, w, h);
      drawDust(plateCtx, w, h);
      for (const star of stars) {
        if (star.twinkle || star.breathe) continue;
        drawStar(plateCtx, star, star.nx * w, star.ny * h, 1, 1);
      }
    };

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars(w < 700);
      paintPlate(w, h);
    };

    const frame = (now: number) => {
      if (!alive) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(plate, 0, 0, w, h);
      if (!reduced.matches) {
        for (const star of stars) {
          if (!star.twinkle && !star.breathe) continue;
          const wave = 0.5 + 0.5 * Math.sin((now / star.period) * Math.PI * 2 + star.phase);
          const fade = star.twinkle ? 0.62 + wave * 0.38 : 1;
          const glow = star.breathe ? 0.82 + wave * 0.18 : 1;
          drawStar(ctx, star, star.nx * w, star.ny * h, fade, glow);
        }
        if (comet) {
          drawComet(ctx, comet, now);
          if (now - comet.born > comet.life) comet = null;
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const queueComet = () => {
      if (!alive || reduced.matches) return;
      const wait = 12000 + Math.random() * 8000;
      cometTimer = window.setTimeout(() => {
        if (!alive || reduced.matches || comet) {
          queueComet();
          return;
        }
        const next = rng(Math.floor(performance.now()) || 1);
        const spawned = spawnComet(window.innerWidth, window.innerHeight, next);
        if (spawned) {
          spawned.born = performance.now();
          comet = spawned;
        }
        queueComet();
      }, wait);
    };

    fit();
    if (reduced.matches) {
      ctx.drawImage(plate, 0, 0, window.innerWidth, window.innerHeight);
    } else {
      raf = requestAnimationFrame(frame);
      queueComet();
    }

    const onResize = () => fit();
    const onMotion = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(cometTimer);
      comet = null;
      if (reduced.matches) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        ctx.drawImage(plate, 0, 0, window.innerWidth, window.innerHeight);
        return;
      }
      raf = requestAnimationFrame(frame);
      queueComet();
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
      style={styles.host}
    />
  );
}

const styles = StyleSheet.create({
  host: {
    position: "fixed",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
  },
});
