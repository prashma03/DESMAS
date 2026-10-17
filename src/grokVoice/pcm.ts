const TARGET_RATE = 24_000;

function bytesToBase64(bytes: Uint8Array): string {
  const btoaFn = (globalThis as { btoa?: (s: string) => string }).btoa;
  if (!btoaFn) throw new Error("no_btoa");
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoaFn(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (!atobFn) throw new Error("no_atob");
  const bin = atobFn(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function floatToPcm16Base64(input: Float32Array, inputRate: number): string {
  const ratio = inputRate / TARGET_RATE;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const s = Math.max(-1, Math.min(1, input[Math.min(input.length - 1, Math.floor(i * ratio))] ?? 0));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return bytesToBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
}

export function pcm16Base64ToF32(b64: string): Float32Array {
  const bytes = base64ToBytes(b64);
  const even = bytes.byteLength - (bytes.byteLength % 2);
  const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, even / 2);
  const f32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) f32[i] = pcm[i] / 32768;
  return f32;
}

export function resampleF32(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    out[i] = input[Math.min(input.length - 1, Math.floor(i * ratio))] ?? 0;
  }
  return out;
}

export { TARGET_RATE };
