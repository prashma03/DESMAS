import { kitStore } from "../kit/store";
import {
  CREW_VOICE_INSTRUCTIONS,
  GET_INCIDENT_HISTORY_NAME,
  GET_INCIDENT_HISTORY_VOICE_TOOL,
  GET_SENSOR_STATE_NAME,
  GET_SENSOR_STATE_VOICE_TOOL,
  getSensorState,
} from "../kit/sensorState";
import { communicationAutonomy, publishedMarsDelay } from "../kit/autonomy";
import { setGrokPlaybackBusy } from "./playbackGate";
import { voiceNetworkError } from "./voiceEndpoint";
import type { WorldId } from "../kit/types";
import { floatToPcm16Base64, resampleF32, TARGET_RATE } from "./pcm";

const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";
const REALTIME_URL = "wss://api.x.ai/v1/realtime?model=grok-voice-latest";

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "thinking"
  | "speaking"
  | "fallback"
  | "offline"
  | "error";

type World = Exclude<WorldId, "all">;

type Handlers = {
  onStatus: (s: VoiceStatus, detail?: string) => void;
  onUserTranscript: (text: string) => void;
  onAssistantTranscript: (text: string) => void;
  onFallback: (reason: string) => void;
};

type MediaDev = {
  getUserMedia: (c: { audio: boolean | { echoCancellation: boolean; channelCount: number } }) => Promise<{
    getTracks: () => { stop: () => void }[];
  }>;
};

type AudioWindow = {
  AudioContext?: new (opts?: { sampleRate?: number }) => AudioCtx;
  webkitAudioContext?: new (opts?: { sampleRate?: number }) => AudioCtx;
  navigator?: { mediaDevices?: MediaDev };
  WebSocket?: { new (url: string, protocols?: string | string[]): WebSocket };
};

type AudioCtx = {
  sampleRate: number;
  currentTime: number;
  state: string;
  resume: () => Promise<void>;
  close: () => Promise<void>;
  createMediaStreamSource: (stream: unknown) => { connect: (n: unknown) => void };
  createScriptProcessor: (
    bs: number,
    i: number,
    o: number,
  ) => {
    connect: (n: unknown) => void;
    disconnect: () => void;
    onaudioprocess: ((ev: { inputBuffer: { getChannelData: (n: number) => Float32Array } }) => void) | null;
  };
  destination: unknown;
  createGain: () => { gain: { value: number }; connect: (n: unknown) => void };
  createBuffer: (ch: number, len: number, rate: number) => {
    getChannelData: (n: number) => Float32Array;
  };
  createBufferSource: () => {
    buffer: unknown;
    connect: (n: unknown) => void;
    start: (when?: number) => void;
  };
};

function w(): AudioWindow {
  return globalThis as AudioWindow;
}

function isWeb() {
  return typeof document !== "undefined";
}

async function mintToken(): Promise<string> {
  const url = `${API}/api/realtime/token`;
  const pageOrigin = typeof location !== "undefined" ? location.origin : "";
  let res: Response;
  try {
    res = await fetch(url, { method: "POST" });
  } catch (err) {
    const cause = err instanceof Error ? err.message : "network error";
    throw new Error(voiceNetworkError(url, pageOrigin, cause));
  }
  const data = (await res.json().catch(() => null)) as {
    value?: string;
    message?: string;
    error?: string;
    upstreamStatus?: number;
  } | null;
  if (!res.ok) {
    throw new Error(
      data?.message ||
        `Realtime token failed (HTTP ${res.status}${data?.upstreamStatus ? `, xAI ${data.upstreamStatus}` : ""}).`,
    );
  }
  if (!data?.value) throw new Error("Realtime token was empty. The server did not return a client secret.");
  return data.value;
}

export class PushToTalk {
  private world: World;
  private handlers: Handlers;
  private ws: WebSocket | null = null;
  private stream: { getTracks: () => { stop: () => void }[] } | null = null;
  private captureCtx: AudioCtx | null = null;
  private playCtx: AudioCtx | null = null;
  private processor: { disconnect: () => void; onaudioprocess: unknown } | null = null;
  private nextPlay = 0;
  private assistantBuf = "";
  private closed = false;

  constructor(world: World, handlers: Handlers) {
    this.world = world;
    this.handlers = handlers;
  }

  setWorld(world: World) {
    this.world = world;
  }

  async hold() {
    if (!isWeb()) {
      this.handlers.onFallback("not_web");
      return;
    }
    try {
      this.handlers.onStatus("connecting");
      await this.unlockPlayback();
      await this.ensureSocket();
      await this.startMic();
      this.handlers.onStatus("listening");
    } catch (err) {
      this.handlers.onStatus("error", err instanceof Error ? err.message : "hold_failed");
      this.handlers.onFallback("realtime_failed");
    }
  }

  release() {
    this.stopMic();
    if (!this.ws || this.ws.readyState !== 1) {
      this.handlers.onFallback("realtime_failed");
      return;
    }
    this.handlers.onStatus("thinking");
    this.send({ type: "input_audio_buffer.commit" });
    this.send({
      type: "response.create",
      response: { modalities: ["audio", "text"] },
    });
  }

  private async unlockPlayback() {
    const Ctor = w().AudioContext ?? w().webkitAudioContext;
    if (!Ctor) return;
    if (!this.playCtx) this.playCtx = new Ctor({ sampleRate: TARGET_RATE });
    if (this.playCtx.state === "suspended") await this.playCtx.resume();
    const silent = this.playCtx.createBuffer(1, 1, this.playCtx.sampleRate);
    const src = this.playCtx.createBufferSource();
    src.buffer = silent;
    src.connect(this.playCtx.destination);
    src.start();
  }

  close() {
    this.closed = true;
    this.stopMic();
    this.ws?.close();
    this.ws = null;
    void this.playCtx?.close();
    this.playCtx = null;
  }

  private send(obj: object) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  private async ensureSocket() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) {
      if (this.ws.readyState === 0) await this.waitOpen();
      return;
    }
    const token = await mintToken();
    const WS = w().WebSocket;
    if (!WS) throw new Error("no_ws");
    this.ws = new WS(REALTIME_URL, [`xai-client-secret.${token}`]);
    this.ws.binaryType = "arraybuffer";
    this.ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        setGrokPlaybackBusy(true);
        void this.playPcmBytes(new Uint8Array(ev.data));
        return;
      }
      if (typeof ev.data !== "string") return;
      this.onEvent(JSON.parse(ev.data) as Record<string, unknown>);
    };
    this.ws.onerror = () => {
      this.handlers.onFallback("socket_error");
      this.handlers.onStatus("fallback");
    };
    this.ws.onclose = () => {
      if (!this.closed) this.handlers.onStatus("idle");
    };
    await this.waitOpen();
    this.configureSession();
    this.handlers.onStatus("ready");
  }

  private waitOpen() {
    return new Promise<void>((resolve, reject) => {
      const ws = this.ws;
      if (!ws) {
        reject(new Error("no_ws"));
        return;
      }
      if (ws.readyState === 1) {
        resolve();
        return;
      }
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("ws_open"));
    });
  }

  private configureSession() {
    this.send({
      type: "session.update",
      session: {
        voice: "eve",
        instructions: CREW_VOICE_INSTRUCTIONS,
        reasoning: { effort: "none" },
        modalities: ["audio", "text"],
        tools: [GET_SENSOR_STATE_VOICE_TOOL, GET_INCIDENT_HISTORY_VOICE_TOOL],
        audio: {
          input: {
            format: { type: "audio/pcm", rate: TARGET_RATE },
            transport: "json",
            transcription: { model: "grok-transcribe", language_hint: "en" },
          },
          output: { format: { type: "audio/pcm", rate: TARGET_RATE }, transport: "json" },
        },
      },
    });
  }

  private async startMic() {
    const nav = w().navigator?.mediaDevices;
    if (!nav) throw new Error("no_mic");
    const Ctor = w().AudioContext ?? w().webkitAudioContext;
    if (!Ctor) throw new Error("no_audioctx");
    this.stream = await nav.getUserMedia({
      audio: { echoCancellation: true, channelCount: 1 },
    });
    this.captureCtx = new Ctor();
    if (this.captureCtx.state === "suspended") await this.captureCtx.resume();
    const src = this.captureCtx.createMediaStreamSource(this.stream);
    const proc = this.captureCtx.createScriptProcessor(4096, 1, 1);
    const rate = this.captureCtx.sampleRate;
    proc.onaudioprocess = (ev) => {
      if (!this.ws || this.ws.readyState !== 1) return;
      const f32 = ev.inputBuffer.getChannelData(0);
      this.send({
        type: "input_audio_buffer.append",
        audio: floatToPcm16Base64(f32, rate),
      });
    };
    const mute = this.captureCtx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(this.captureCtx.destination);
    this.processor = proc;
  }

  private stopMic() {
    this.processor?.disconnect();
    this.processor = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.captureCtx?.close();
    this.captureCtx = null;
  }

  private onEvent(event: Record<string, unknown>) {
    const type = String(event.type ?? "");
    if (type === "conversation.item.input_audio_transcription.updated") {
      const t = String(event.transcript ?? event.text ?? "");
      if (t) this.handlers.onUserTranscript(t);
    }
    if (type === "conversation.item.input_audio_transcription.completed") {
      const t = String(event.transcript ?? event.text ?? "");
      if (t) this.handlers.onUserTranscript(t);
    }
    if (type === "response.output_audio_transcript.delta") {
      this.assistantBuf += String(event.delta ?? "");
      this.handlers.onAssistantTranscript(this.assistantBuf);
    }
    if (type === "response.output_audio_transcript.done") {
      const t = String(event.transcript ?? this.assistantBuf);
      this.assistantBuf = "";
      if (t) this.handlers.onAssistantTranscript(t);
    }
    if (
      (type === "response.output_audio.delta" || type === "response.audio.delta") &&
      !type.includes("transcript")
    ) {
      this.handlers.onStatus("speaking");
      setGrokPlaybackBusy(true);
      const delta = String(event.delta ?? event.audio ?? "");
      if (delta && delta !== "[object Object]") void this.playDelta(delta);
    }
    if (type === "response.function_call_arguments.done") {
      this.replyTool(event);
    }
    if (type === "response.done") {
      setGrokPlaybackBusy(false);
      this.handlers.onStatus("ready");
    }
    if (type === "error") {
      this.handlers.onStatus("error", String(event.message ?? "realtime_error"));
    }
  }

  private replyTool(event: Record<string, unknown>) {
    const name = String(event.name ?? "");
    const callId = String(event.call_id ?? "");
    let args: { window_seconds?: number } = {};
    try {
      if (typeof event.arguments === "string" && event.arguments) {
        args = JSON.parse(event.arguments) as { window_seconds?: number };
      }
    } catch {
      args = {};
    }
    const { reading, source } = kitStore.getSnapshot();
    const labeled = {
      ...getSensorState(this.world, reading),
      source: source === "serial" ? "LIVE ARDUINO" : "SIMULATED",
      decision: communicationAutonomy({
        world: this.world,
        reading,
        mars: this.world === "mars" ? publishedMarsDelay() : null,
      }),
    };
    const output =
      name === GET_SENSOR_STATE_NAME
        ? labeled
        : name === GET_INCIDENT_HISTORY_NAME
          ? kitStore.getIncidentHistory(args.window_seconds)
          : { error: "unknown_function" };
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output),
      },
    });
    this.send({
      type: "response.create",
      response: { modalities: ["audio", "text"] },
    });
  }

  private async playDelta(b64: string) {
    const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
    if (!atobFn) return;
    const bin = atobFn(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    await this.playPcmBytes(bytes);
  }

  private async playPcmBytes(bytes: Uint8Array) {
    const Ctor = w().AudioContext ?? w().webkitAudioContext;
    if (!Ctor) return;
    if (!this.playCtx) this.playCtx = new Ctor({ sampleRate: TARGET_RATE });
    if (this.playCtx.state === "suspended") await this.playCtx.resume();
    const even = bytes.byteLength - (bytes.byteLength % 2);
    const view = new DataView(bytes.buffer, bytes.byteOffset, even);
    const f32src = new Float32Array(even / 2);
    for (let i = 0; i < f32src.length; i += 1) f32src[i] = view.getInt16(i * 2, true) / 32768;
    const f32 = resampleF32(f32src, TARGET_RATE, this.playCtx.sampleRate);
    if (!f32.length) return;
    const buf = this.playCtx.createBuffer(1, f32.length, this.playCtx.sampleRate);
    buf.getChannelData(0).set(f32);
    const src = this.playCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this.playCtx.destination);
    const start = Math.max(this.playCtx.currentTime + 0.02, this.nextPlay);
    src.start(start);
    this.nextPlay = start + f32.length / this.playCtx.sampleRate;
  }
}
