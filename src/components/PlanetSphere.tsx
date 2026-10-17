import { useEffect, useRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import * as THREE from "three";

type WorldKey = "earth" | "moon" | "mars";

const MAPS = {
  earth: require("../../assets/planets/earth.jpg"),
  moon: require("../../assets/planets/moon.jpg"),
  mars: require("../../assets/planets/mars.jpg"),
} as const;

const CLOUDS = require("../../assets/planets/clouds.webp");

const MOTION: Record<WorldKey, { spin: number; tilt: number; glow: string }> = {
  earth: { spin: 0.48, tilt: 0.41, glow: "#6eb6ff" },
  moon: { spin: 0.2, tilt: 0.09, glow: "#d5d8de" },
  mars: { spin: 0.34, tilt: 0.44, glow: "#ff8a55" },
};

type Life = { alive: boolean };

function assetUri(mod: unknown) {
  if (typeof mod === "string") return mod;
  if (mod && typeof mod === "object") {
    const record = mod as { uri?: string; default?: unknown };
    if (typeof record.uri === "string") return record.uri;
    if (typeof record.default === "string") return record.default;
  }
  const resolver = (Image as { resolveAssetSource?: (id: number) => { uri?: string } | null }).resolveAssetSource;
  if (typeof resolver === "function") return resolver(mod as number)?.uri ?? "";
  return "";
}

function loadMap(moduleId: number) {
  const uri = assetUri(moduleId);
  return new Promise<THREE.Texture>((resolve, reject) => {
    if (!uri) {
      reject(new Error("missing planet texture"));
      return;
    }
    new THREE.TextureLoader().load(
      uri,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        resolve(tex);
      },
      undefined,
      () => reject(new Error("planet texture")),
    );
  });
}

function createRenderer(gl: ExpoWebGLRenderingContext) {
  const canvas = (gl.canvas ?? {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    clientWidth: gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  }) as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl as unknown as WebGLRenderingContext,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(gl.drawingBufferWidth || canvas.width || 1, gl.drawingBufferHeight || canvas.height || 1, false);
  return renderer;
}

async function mountPlanet(gl: ExpoWebGLRenderingContext, kind: WorldKey, life: Life) {
  const motion = MOTION[kind];
  const renderer = createRenderer(gl);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0.05, 3.35);

  const sun = new THREE.DirectionalLight(0xfff2dd, 2.1);
  sun.position.set(4.2, 1.4, 2.6);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x9eb0c8, 0.42));
  const fill = new THREE.DirectionalLight(0x7ea2ff, 0.28);
  fill.position.set(-3.5, -0.8, -2);
  scene.add(fill);

  const tilt = new THREE.Group();
  tilt.rotation.z = motion.tilt;
  const spin = new THREE.Group();
  const cloudSpin = new THREE.Group();
  tilt.add(spin, cloudSpin);
  scene.add(tilt);

  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const surface = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.86, metalness: 0 });
  const surfaceMesh = new THREE.Mesh(geometry, surface);
  surfaceMesh.visible = false;
  spin.add(surfaceMesh);

  const glow = new THREE.Color(motion.glow);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 48, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      uniforms: { glow: { value: glow } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 glow;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = pow(1.0 - max(dot(vView, normalize(vNormal)), 0.0), 2.4);
          gl_FragColor = vec4(glow, rim * 0.9);
        }
      `,
    }),
  );
  tilt.add(atmosphere);

  const clock = new THREE.Clock();
  let lastW = 0;
  let lastH = 0;
  const loop = () => {
    if (!life.alive) return;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (width > 0 && height > 0 && (width !== lastW || height !== lastH)) {
      lastW = width;
      lastH = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    const t = clock.getElapsedTime();
    spin.rotation.y = t * motion.spin;
    cloudSpin.rotation.y = t * motion.spin * 1.45;
    renderer.render(scene, camera);
    gl.endFrameEXP();
    requestAnimationFrame(loop);
  };
  loop();

  try {
    const map = await loadMap(MAPS[kind]);
    if (!life.alive) {
      map.dispose();
      return;
    }
    surface.map = map;
    surface.color.set(0xffffff);
    surface.needsUpdate = true;
    surfaceMesh.visible = true;
    if (kind === "earth") {
      const cloudMap = await loadMap(CLOUDS);
      if (life.alive) {
        cloudSpin.add(
          new THREE.Mesh(
            new THREE.SphereGeometry(1.02, 64, 64),
            new THREE.MeshPhongMaterial({ map: cloudMap, transparent: true, opacity: 0.42, depthWrite: false }),
          ),
        );
      }
    }
  } catch {
    surface.color.set(kind === "mars" ? 0xc4512a : kind === "moon" ? 0xb7b7b7 : 0x2f6fbe);
    surfaceMesh.visible = true;
  }
}

export function PlanetSphere({ kind }: { kind: WorldKey }) {
  const life = useRef<Life>({ alive: true });

  useEffect(() => {
    const token = life.current;
    token.alive = true;
    return () => {
      token.alive = false;
    };
  }, []);

  return (
    <View pointerEvents="none" style={styles.fill}>
      <GLView
        style={styles.fill}
        onContextCreate={(gl) => {
          mountPlanet(gl, kind, life.current).catch(() => {
            /* the colored sphere stays up if a texture cannot load */
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
});
