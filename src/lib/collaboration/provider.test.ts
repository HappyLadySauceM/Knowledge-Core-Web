import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { KnowledgeWebSocketProvider, reconnectDelay } from "./provider";

const sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = sockets;
  readyState = FakeWebSocket.CONNECTING;
  binaryType = "arraybuffer";
  sent: Uint8Array[] = [];
  private readonly listeners = new Map<string, Set<(event: { data?: ArrayBuffer; code?: number; reason?: string }) => void>>();

  constructor(public url: string, public protocols?: string | string[]) {
    sockets.push(this);
  }

  addEventListener(type: string, listener: (event: { data?: ArrayBuffer; code?: number; reason?: string }) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  send(data: ArrayBufferLike | Uint8Array) {
    this.sent.push(data instanceof Uint8Array ? data : new Uint8Array(data));
  }

  close(code = 1000, reason = "") {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close", { code, reason });
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open", {});
  }

  incoming(payload: Uint8Array) {
    const copy = new Uint8Array(payload.byteLength);
    copy.set(payload);
    this.emit("message", { data: copy.buffer });
  }

  private emit(type: string, event: { data?: ArrayBuffer; code?: number; reason?: string }) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

function encodeSync(write: (encoder: encoding.Encoder) => void) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0);
  write(encoder);
  return encoding.toUint8Array(encoder);
}

function serverStep1(doc: Y.Doc) {
  return encodeSync((encoder) => syncProtocol.writeSyncStep1(encoder, doc));
}

function serverStep2(doc: Y.Doc) {
  return encodeSync((encoder) => syncProtocol.writeSyncStep2(encoder, doc));
}

async function connectProvider(doc = new Y.Doc()) {
  const provider = new KnowledgeWebSocketProvider(
    async () => ({
      websocket_url: "ws://collaboration.test/v1/documents/doc",
      ticket: "ticket",
      subprotocol: "y-sync",
    }),
    doc,
  );
  await vi.waitFor(() => expect(sockets.length).toBe(1));
  const socket = sockets[0]!;
  socket.open();
  return { provider, socket, doc };
}

describe("reconnectDelay", () => {
  it("uses bounded exponential backoff with deterministic jitter", () => {
    expect(reconnectDelay(0, 0)).toBe(400);
    expect(reconnectDelay(0, 1)).toBe(600);
    expect(reconnectDelay(4, 0.5)).toBe(5000);
    expect(reconnectDelay(20, 0.5)).toBe(5000);
  });
});

describe("KnowledgeWebSocketProvider handshake", () => {
  afterEach(() => {
    sockets.splice(0);
    vi.unstubAllGlobals();
  });

  it("becomes synced only after the server Step1 reply and Step2, then resyncs on Step2 alone", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const serverDoc = new Y.Doc();
    const { provider, socket } = await connectProvider();
    expect(provider.isSynced).toBe(false);

    socket.incoming(serverStep2(serverDoc));
    expect(provider.isSynced).toBe(false);

    socket.incoming(serverStep1(serverDoc));
    socket.incoming(serverStep2(serverDoc));
    expect(provider.isSynced).toBe(true);

    const afterHandshake = await provider.whenSynced;
    expect(afterHandshake).toBeUndefined();

    const resync = provider.resync();
    expect(provider.isSynced).toBe(false);
    socket.incoming(serverStep2(serverDoc));
    await expect(resync).resolves.toBeUndefined();
    expect(provider.isSynced).toBe(true);

    provider.destroy();
  });
});
