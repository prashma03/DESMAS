// Web Serial link to the DESMAS board. Opens the port at 9600 baud and reports lines to the kit store.

type SerialPortLike = EventTarget & {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>;
  close(): Promise<void>;
};

type SerialLike = EventTarget & {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
};

export type BoardHandlers = {
  onOpen: () => void;
  onLine: (line: string) => void;
  onClose: (notice: string) => void;
  onNotice: (notice: string) => void;
};

const NOTICES = {
  noSerial: "This browser has no Web Serial. Open DESMAS in Chrome or Edge on a laptop.",
  insecure: "USB access only works on a secure page. Open DESMAS at http://localhost in Chrome or Edge.",
  blocked: "USB access is blocked here, so DESMAS keeps showing the simulated kit. Open it in a Chrome or Edge tab at http://localhost.",
  notPicked: "No board was picked. Plug in the Arduino and try again.",
  busy: "Could not open the board. Close the Arduino Serial Monitor, then try again.",
  lost: "The board disconnected. Showing the simulated kit again.",
};

const BAUD_RATE = 9600;
const BUFFER_BYTES = 4096;
const MAX_LINE = 4096;

function webSerial(): SerialLike | undefined {
  return (globalThis as { navigator?: { serial?: SerialLike } }).navigator?.serial;
}

export function serialSupported(): boolean {
  return webSerial() !== undefined;
}

export function createBoardLink(handlers: BoardHandlers) {
  let port: SerialPortLike | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let reading: Promise<void> = Promise.resolve();
  let opening = false;
  let closing = false;

  async function open(candidate: SerialPortLike) {
    if (port || opening) return;
    opening = true;
    try {
      await candidate.open({ baudRate: BAUD_RATE, bufferSize: BUFFER_BYTES });
    } catch {
      handlers.onNotice(NOTICES.busy);
      return;
    } finally {
      opening = false;
    }
    port = candidate;
    handlers.onOpen();
    reading = readLines(candidate);
  }

  async function readLines(p: SerialPortLike) {
    const decoder = new TextDecoder();
    let buffer = "";
    while (p.readable && !closing) {
      const r = p.readable.getReader();
      reader = r;
      try {
        for (;;) {
          const { value, done } = await r.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";
          for (const line of lines) handlers.onLine(line);
          if (buffer.length > MAX_LINE) buffer = "";
        }
      } catch {
        // A framing error ends one reader. Take another while the port stays open.
      } finally {
        r.releaseLock();
        reader = null;
      }
    }
    await p.close().catch(() => {});
    port = null;
    const asked = closing;
    closing = false;
    handlers.onClose(asked ? "" : NOTICES.lost);
  }

  async function connect() {
    const serial = webSerial();
    if (!serial) {
      handlers.onNotice(globalThis.isSecureContext === false ? NOTICES.insecure : NOTICES.noSerial);
      return;
    }
    if (port) return;
    let picked: SerialPortLike;
    try {
      picked = await serial.requestPort();
    } catch (err) {
      const name = (err as { name?: unknown } | null)?.name;
      handlers.onNotice(name === "SecurityError" ? NOTICES.blocked : NOTICES.notPicked);
      return;
    }
    await open(picked);
  }

  function watch() {
    const serial = webSerial();
    if (!serial) return () => {};
    let active = true;
    const plugged = (e: Event) => {
      if (active) void open(e.target as SerialPortLike);
    };
    serial.addEventListener("connect", plugged);
    serial
      .getPorts()
      .then((ports) => {
        if (active && ports[0]) void open(ports[0]);
      })
      .catch(() => {});
    return () => {
      active = false;
      serial.removeEventListener("connect", plugged);
      void disconnect();
    };
  }

  async function send(command: "c" | "m") {
    const writable = port?.writable;
    if (!writable || writable.locked) return false;
    const writer = writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(command));
      return true;
    } catch {
      return false;
    } finally {
      writer.releaseLock();
    }
  }

  async function disconnect() {
    if (!port) return;
    closing = true;
    await reader?.cancel().catch(() => {});
    await reading;
  }

  return { connect, watch, send, disconnect };
}
