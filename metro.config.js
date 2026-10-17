const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const config = getDefaultConfig(__dirname);

const threeModule = path.resolve(__dirname, "node_modules/three/build/three.module.js");
const resolve = config.resolver.resolveRequest;

// Metro cannot bundle the extensionless files in assets/Videoes.
// These copies keep the original filenames as the source of truth.
const introSources = {
  "desmas-intro-video-1": path.resolve(__dirname, "assets/Videoes/Vid 1"),
  "desmas-intro-video-2": path.resolve(__dirname, "assets/Videoes/Vid 2"),
};

function videoExtension(filePath) {
  let bytes = Buffer.alloc(0);
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    const read = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    bytes = buf.subarray(0, read);
  } catch {
    return "mp4";
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp") {
    return bytes.toString("ascii", 8, 12) === "qt  " ? "mov" : "mp4";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  return "mp4";
}

function bundledIntro(id, source) {
  const ext = videoExtension(source);
  const dir = path.resolve(__dirname, "assets", "intro-cache");
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${id}.${ext}`);
  const sourceStat = fs.statSync(source);
  let stale = true;
  if (fs.existsSync(dest)) {
    const destStat = fs.statSync(dest);
    stale = destStat.size !== sourceStat.size || destStat.mtimeMs < sourceStat.mtimeMs;
  }
  if (stale) fs.copyFileSync(source, dest);
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith(`${id}.`) && file !== path.basename(dest)) fs.unlinkSync(path.join(dir, file));
  }
  return dest;
}

for (const [id, source] of Object.entries(introSources)) {
  if (fs.existsSync(source)) bundledIntro(id, source);
}

if (!global.__desmasIntroWatch) {
  global.__desmasIntroWatch = true;
  try {
    const watcher = fs.watch(path.dirname(introSources["desmas-intro-video-1"]), () => {
      for (const [id, source] of Object.entries(introSources)) {
        try {
          if (fs.existsSync(source)) bundledIntro(id, source);
        } catch {
          // The next bundle resolution copies the file again.
        }
      }
    });
    watcher.unref?.();
  } catch {
    // Resolution still copies the files when the bundle is built.
  }
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const source = introSources[moduleName];
  if (source) return { type: "assetFiles", filePaths: [bundledIntro(moduleName, source)] };
  if (moduleName === "three") return { type: "sourceFile", filePath: threeModule };
  if (resolve) return resolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
