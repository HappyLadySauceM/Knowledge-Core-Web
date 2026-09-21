import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
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

function syncTypes(payload: Uint8Array): number[] {
  const decoder = decoding.createDecoder(payload);
  const types: number[] = [];
  while (decoding.hasContent(decoder)) {
    const type = decoding.readVarUint(decoder);
    if (type === 0) {
      types.push(decoding.readVarUint(decoder));
      decoding.readVarUint8Array(decoder);
      continue;
    }
    if (type === 1) {
      decoding.readVarUint8Array(decoder);
      continue;
    }
    break;
  }
  return types;
}

function applyClientPayload(serverDoc: Y.Doc, payload: Uint8Array) {
  const decoder = decoding.createDecoder(payload);
  while (decoding.hasContent(decoder)) {
    const type = decoding.readVarUint(decoder);
    if (type === 0) {
      const encoder = encoding.createEncoder();
      syncProtocol.readSyncMessage(decoder, encoder, serverDoc, "client");
      continue;
    }
    if (type === 1) {
      decoding.readVarUint8Array(decoder);
      continue;
    }
    break;
  }
}

function stateVectorHex(doc: Y.Doc) {
  return Buffer.from(Y.encodeStateVector(doc)).toString("hex");
}

async function connectProvider(doc = new Y.Doc(), idleMs = 0) {
  const provider = new KnowledgeWebSocketProvider(
    async () => ({
      websocket_url: "ws://collaboration.test/v1/documents/doc",
      ticket: "ticket",
      subprotocol: "y-sync",
    }),
    doc,
    { idleMs },
  );
  await vi.waitFor(() => expect(sockets.length).toBeGreaterThan(0));
  const socket = sockets[sockets.length - 1]!;
  socket.open();
  return { provider, socket, doc };
}

async function completeHandshake(socket: FakeWebSocket, serverDoc: Y.Doc) {
  const before = socket.sent.length;
  socket.incoming(serverStep1(serverDoc));
  socket.incoming(serverStep2(serverDoc));
  await vi.waitFor(() => expect(socket.sent.length).toBeGreaterThan(before + 1));
  for (const payload of socket.sent.slice(before)) {
    applyClientPayload(serverDoc, payload);
  }
  socket.incoming(serverStep2(serverDoc));
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("coalesces local updates during the idle window and confirms the batch with a barrier", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const serverDoc = new Y.Doc();
    const { provider, socket, doc } = await connectProvider();
    await completeHandshake(socket, serverDoc);
    vi.useFakeTimers();
    const before = socket.sent.length;

    doc.getMap("root").set("first", "local");
    doc.getMap("root").set("second", "local");
    await vi.advanceTimersByTimeAsync(299);
    expect(socket.sent).toHaveLength(before);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    const batch = socket.sent.slice(before);
    expect(batch).toHaveLength(2);
    expect(batch.flatMap(syncTypes)).toEqual(expect.arrayContaining([
      syncProtocol.messageYjsUpdate,
      syncProtocol.messageYjsSyncStep1,
    ]));
    applyClientPayload(serverDoc, batch[0]!);
    socket.incoming(serverStep2(serverDoc));
    await expect(provider.whenSynced).resolves.toBeUndefined();
    expect(provider.isSynced).toBe(true);
    provider.destroy();
  });

  it("flushes continuous input at the maximum wait even when the idle window keeps moving", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const serverDoc = new Y.Doc();
    const { provider, socket, doc } = await connectProvider();
    await completeHandshake(socket, serverDoc);
    vi.useFakeTimers();
    const before = socket.sent.length;

    for (let index = 0; index < 12; index += 1) {
      doc.getMap("root").set(`key-${index}`, index);
      await vi.advanceTimersByTimeAsync(100);
    }
    await Promise.resolve();
    expect(socket.sent.length).toBeGreaterThan(before);
    provider.destroy();
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
    expect(provider.isSynced).toBe(false);
    await vi.waitFor(() => expect(socket.sent.length).toBeGreaterThan(2));
    for (const payload of socket.sent.slice(1)) applyClientPayload(serverDoc, payload);
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

  it("uses the ordered socket barrier and does not reconnect for publish sync", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const serverDoc = new Y.Doc();
    const { provider, socket, doc } = await connectProvider();
    await completeHandshake(socket, serverDoc);
    expect(provider.isSynced).toBe(true);
    expect(stateVectorHex(doc)).toBe(stateVectorHex(serverDoc));

    doc.getMap("root").set("ahead", "local");
    expect(stateVectorHex(doc)).not.toBe(stateVectorHex(serverDoc));

    const afterLocal = socket.sent.length;
    const pullOnly = provider.resync();
    socket.incoming(serverStep2(serverDoc));
    await pullOnly;
    const resyncTypes = socket.sent.slice(afterLocal).flatMap(syncTypes);
    expect(resyncTypes).toContain(syncProtocol.messageYjsSyncStep1);
    expect(resyncTypes).not.toContain(syncProtocol.messageYjsSyncStep2);
    expect(stateVectorHex(doc)).not.toBe(stateVectorHex(serverDoc));

    const beforeBarrier = socket.sent.length;
    const flushed = provider.flushAndSync();
    await vi.waitFor(() => expect(socket.sent.length).toBeGreaterThan(beforeBarrier));
    const barrierPayloads = socket.sent.slice(beforeBarrier);
    const barrierTypes = barrierPayloads.flatMap(syncTypes);
    expect(barrierTypes).toContain(syncProtocol.messageYjsSyncStep1);
    expect(barrierTypes).not.toContain(syncProtocol.messageYjsSyncStep2);
    for (const payload of socket.sent.slice(0, beforeBarrier)) applyClientPayload(serverDoc, payload);
    for (const payload of barrierPayloads) {
      if (!syncTypes(payload).includes(syncProtocol.messageYjsSyncStep1)) applyClientPayload(serverDoc, payload);
    }
    socket.incoming(serverStep2(serverDoc));
    await flushed;
    expect(provider.isSynced).toBe(true);
    expect(stateVectorHex(doc)).toBe(stateVectorHex(serverDoc));
    expect(sockets).toHaveLength(1);

    provider.destroy();
  });

  it("closes the socket when the server sends an unsupported protocol frame", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const onTerminal = vi.fn();
    const provider = new KnowledgeWebSocketProvider(
      async () => ({
        websocket_url: "ws://collaboration.test/v1/documents/doc",
        ticket: "ticket",
        subprotocol: "y-sync",
      }),
      new Y.Doc(),
      { onTerminal },
    );
    await vi.waitFor(() => expect(sockets.length).toBeGreaterThan(0));
    const socket = sockets[sockets.length - 1]!;
    socket.open();
    socket.incoming(new Uint8Array([99]));
    await vi.waitFor(() => expect(onTerminal).toHaveBeenCalledWith(4400));
    provider.destroy();
  });

  it("does not echo server-originated awareness updates", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const provider = new KnowledgeWebSocketProvider(
      async () => ({
        websocket_url: "ws://collaboration.test/v1/documents/doc",
        ticket: "ticket",
        subprotocol: "y-sync",
      }),
      new Y.Doc(),
    );
    await vi.waitFor(() => expect(sockets.length).toBeGreaterThan(0));
    const socket = sockets[sockets.length - 1]!;
    socket.open();
    const before = socket.sent.length;
    const remote = new Y.Doc();
    const remoteAwareness = new awarenessProtocol.Awareness(remote);
    remoteAwareness.setLocalStateField("user", { name: "Other", color: "#f00" });
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(remoteAwareness, [remoteAwareness.clientID]));
    socket.incoming(encoding.toUint8Array(encoder));
    expect(socket.sent).toHaveLength(before);
    remoteAwareness.destroy();
    provider.destroy();
  });
});
