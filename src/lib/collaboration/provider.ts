import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";

const syncMessage = 0;
const awarenessMessage = 1;
const connectTimeoutMs = 10_000;
const reconnectBudgetMs = 60_000;
const minReconnectDelayMs = 500;
const maxReconnectDelayMs = 5_000;
const defaultIdleMs = 0;

export type CollaborationConnection = {
  websocket_url: string;
  ticket: string;
  subprotocol: string;
};

export type CollaborationStatus = "connecting" | "syncing" | "connected" | "reconnecting" | "offline";

type ProviderOptions = {
  onStatus?: (status: CollaborationStatus) => void;
  onError?: (error: Error) => void;
  onTerminal?: (closeCode: number) => void;
  idleMs?: number;
};

export function reconnectDelay(attempt: number, random = Math.random()): number {
  const base = Math.min(maxReconnectDelayMs, minReconnectDelayMs * 2 ** Math.max(0, attempt));
  const jitter = base * 0.2 * (random * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

type SyncedWaiter = { resolve: () => void; reject: (error: Error) => void };

export class KnowledgeWebSocketProvider {
  readonly awareness: awarenessProtocol.Awareness;
  readonly doc: Y.Doc;
  private readonly createConnection: () => Promise<CollaborationConnection>;
  private readonly onUpdate: (update: Uint8Array, origin: unknown) => void;
  private readonly onAwareness: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin?: unknown,
  ) => void;
  private readonly notifyStatus: (status: CollaborationStatus) => void;
  private readonly notifyError: (error: Error) => void;
  private readonly notifyTerminal: (closeCode: number) => void;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private connectGeneration = 0;
  private reconnectAttempt = 0;
  private reconnectStartedAt: number | null = null;
  private connecting = false;
  private terminal = false;
  private destroyed = false;
  private handshakeRemote = false;
  private handshakeLocal = false;
  private synced = false;
  private syncedWaiters: SyncedWaiter[] = [];
  private readonly idleMs: number;

  constructor(createConnection: () => Promise<CollaborationConnection>, doc: Y.Doc, options: ProviderOptions = {}) {
    this.createConnection = createConnection;
    this.doc = doc;
    this.idleMs = options.idleMs ?? defaultIdleMs;
    this.awareness = new awarenessProtocol.Awareness(doc);
    this.awareness.setLocalStateField("user", { name: "You", color: "#6678ff" });
    this.notifyStatus = options.onStatus ?? (() => undefined);
    this.notifyError = options.onError ?? (() => undefined);
    this.notifyTerminal = options.onTerminal ?? (() => undefined);
    this.onUpdate = (update, origin) => {
      if (origin !== this) this.sendUpdate(update);
    };
    this.onAwareness = ({ added, updated, removed }, origin) => {
      // Server-originated awareness is already broadcast by the actor. Echoing it
      // back would claim other collaborators' client IDs and trigger protocol 4400.
      if (origin === this) return;
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const changed = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, awarenessMessage);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
      socket.send(encoding.toUint8Array(encoder));
    };
    this.attach();
    this.connect();
  }

  get isSynced() {
    return this.synced;
  }

  get whenSynced(): Promise<void> {
    if (this.synced) return Promise.resolve();
    if (this.destroyed || this.terminal) return Promise.reject(new Error("Collaboration is not ready"));
    return new Promise((resolve, reject) => {
      this.syncedWaiters.push({ resolve, reject });
    });
  }

  // Send a SyncStep1 on the already ordered socket. The actor processes frames in order,
  // so the SyncStep2 response is a commit barrier for all updates sent before this frame.
  // 在已有顺序连接上发送 SyncStep1。服务端 actor 按帧顺序处理，因此 SyncStep2
  // 就是此前所有 update 已提交的屏障。
  resync(): Promise<void> {
    if (this.destroyed || this.terminal) return Promise.reject(new Error("Collaboration is not ready"));
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Collaboration is not ready"));
    }
    this.resetHandshake();
    // The server only replies to a later SyncStep1 with SyncStep2, not another Step1.
    // Keep the local half complete so whenSynced can resolve on that Step2.
    // 服务端对后续 SyncStep1 只回 SyncStep2，不再发 Step1。
    // 本端半程保持完成，whenSynced 才能在收到这次 Step2 后结束。
    this.handshakeLocal = true;
    this.setStatus("syncing");
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, syncMessage);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    socket.send(encoding.toUint8Array(encoder));
    return this.withTimeout(this.whenSynced, connectTimeoutMs, "Collaboration sync barrier timed out");
  }

  // Let the current Yjs transaction/update event finish before the barrier frame is sent.
  // 等当前 Yjs transaction/update 事件完成后再发送屏障帧。
  flushOutbound(): Promise<void> {
    if (this.destroyed || this.terminal) return Promise.reject(new Error("Collaboration is not ready"));
    return this.waitUntilIdle();
  }

  // Drain the local update event, then use the same socket for a bidirectional barrier.
  // 先排空本端 update 事件，再在同一条连接上完成双向屏障。
  async flushAndSync(): Promise<void> {
    if (this.destroyed || this.terminal) return Promise.reject(new Error("Collaboration is not ready"));
    await this.waitUntilIdle();
    if (this.destroyed || this.terminal) return Promise.reject(new Error("Collaboration is not ready"));
    await this.resync();
    if (this.destroyed || this.terminal) return Promise.reject(new Error("Collaboration is not ready"));
    await this.waitUntilIdle();
  }

  private waitUntilIdle(): Promise<void> {
    return new Promise((resolve) => {
      const idleMs = this.idleMs;
      const onUpdate = () => {
        clearTimeout(timer);
        timer = setTimeout(finish, idleMs);
      };
      const finish = () => {
        this.doc.off("update", onUpdate);
        resolve();
      };
      let timer = setTimeout(finish, idleMs);
      this.doc.on("update", onUpdate);
    });
  }

  private resetHandshake() {
    this.handshakeRemote = false;
    this.handshakeLocal = false;
    this.synced = false;
  }

  private completeHandshake() {
    if (!this.handshakeRemote || !this.handshakeLocal || this.synced) return;
    this.synced = true;
    this.setStatus("connected");
    const waiters = this.syncedWaiters.splice(0);
    waiters.forEach((waiter) => waiter.resolve());
  }

  private rejectSyncedWaiters(error: Error) {
    const waiters = this.syncedWaiters.splice(0);
    waiters.forEach((waiter) => waiter.reject(error));
  }

  private attach() {
    this.doc.on("update", this.onUpdate);
    this.awareness.on("update", this.onAwareness);
  }

  private setStatus(status: CollaborationStatus) {
    if (!this.destroyed) this.notifyStatus(status);
  }

  private async connect() {
    if (this.destroyed || this.terminal || this.connecting) return;
    this.connecting = true;
    const generation = ++this.connectGeneration;
    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");
    try {
      const connection = await this.withTimeout(this.createConnection(), connectTimeoutMs, "Collaboration session request timed out");
      if (this.destroyed || this.terminal || generation !== this.connectGeneration) return;
      this.open(connection, generation);
    } catch (reason) {
      if (this.destroyed || this.terminal || generation !== this.connectGeneration) return;
      this.handleFailure(reason instanceof Error ? reason : new Error("Unable to create collaboration session"));
    } finally {
      if (generation === this.connectGeneration) this.connecting = false;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeout);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private open(connection: CollaborationConnection, generation: number) {
    const socket = new WebSocket(connection.websocket_url, [connection.subprotocol, `ticket.${connection.ticket}`]);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    this.connectTimeout = setTimeout(() => {
      if (this.socket === socket && socket.readyState === WebSocket.CONNECTING) socket.close(4503, "connection timeout");
    }, connectTimeoutMs);
    socket.addEventListener("open", () => {
      if (this.destroyed || this.terminal || generation !== this.connectGeneration || this.socket !== socket) return;
      this.clearConnectTimeout();
      this.reconnectAttempt = 0;
      this.reconnectStartedAt = null;
      this.resetHandshake();
      this.setStatus("syncing");
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, syncMessage);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      socket.send(encoding.toUint8Array(encoder));
      this.onAwareness({ added: [this.awareness.clientID], updated: [], removed: [] });
    });
    socket.addEventListener("message", (event) => this.receive(event.data, socket));
    socket.addEventListener("close", (event) => {
      if (this.socket !== socket || generation !== this.connectGeneration) return;
      this.clearConnectTimeout();
      this.socket = null;
      this.handleClose(event.code, event.reason);
    });
    socket.addEventListener("error", () => {
      // Browsers normally follow this with close. Waiting for close avoids duplicate reconnects.
    });
  }

  private clearConnectTimeout() {
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
  }

  private handleClose(code: number, reason: string) {
    if (this.destroyed || code === 1000) return;
    if (code === 4400 || code === 4403 || code === 4409) {
      this.failTerminal(new Error(reason || this.messageForCloseCode(code)), code);
      return;
    }
    this.resetHandshake();
    this.handleFailure(new Error(reason || this.messageForCloseCode(code)));
  }

  private handleFailure(reason: Error) {
    if (this.destroyed) return;
    this.resetHandshake();
    if (this.reconnectStartedAt === null) this.reconnectStartedAt = Date.now();
    if (Date.now() - this.reconnectStartedAt >= reconnectBudgetMs) {
      this.failTerminal(reason);
      return;
    }
    const delay = reconnectDelay(this.reconnectAttempt++);
    this.setStatus("reconnecting");
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private failTerminal(error: Error, closeCode?: number) {
    if (this.destroyed) return;
    this.terminal = true;
    this.resetHandshake();
    this.clearConnectTimeout();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.detach();
    if (closeCode !== undefined) this.notifyTerminal(closeCode);
    if (closeCode !== undefined) error.message = `${error.message} (${closeCode})`;
    this.notifyError(error);
    this.notifyStatus("offline");
    this.rejectSyncedWaiters(error);
  }

  private messageForCloseCode(code: number) {
    switch (code) {
      case 4401: return "Collaboration ticket expired";
      case 4403: return "Collaboration permission denied";
      case 4409: return "Collaboration session is no longer valid";
      case 4429: return "Collaboration service is busy";
      case 4503: return "Collaboration service is temporarily unavailable";
      default: return `Collaboration socket closed (${code})`;
    }
  }

  private receive(data: ArrayBuffer | Blob, socket: WebSocket) {
    if (data instanceof Blob) {
      void data.arrayBuffer()
        .then((value) => this.receive(value, socket))
        .catch(() => this.rejectProtocol(socket));
      return;
    }
    if (this.socket !== socket) return;
    try {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      while (decoding.hasContent(decoder)) {
        const type = decoding.readVarUint(decoder);
        if (type === syncMessage) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, syncMessage);
          const syncType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
          if (syncType === syncProtocol.messageYjsSyncStep2) this.handshakeRemote = true;
          if (syncType === syncProtocol.messageYjsSyncStep1) this.handshakeLocal = true;
          if (encoding.length(encoder) > 1 && this.socket === socket && socket.readyState === WebSocket.OPEN) {
            socket.send(encoding.toUint8Array(encoder));
          }
          continue;
        }
        if (type === awarenessMessage) {
          awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
          continue;
        }
        this.rejectProtocol(socket);
        return;
      }
      this.completeHandshake();
    } catch {
      this.rejectProtocol(socket);
    }
  }

  private rejectProtocol(socket: WebSocket) {
    if (this.socket !== socket || socket.readyState >= WebSocket.CLOSING) return;
    socket.close(4400, "invalid-protocol");
  }

  private sendUpdate(update: Uint8Array) {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, syncMessage);
    syncProtocol.writeUpdate(encoder, update);
    socket.send(encoding.toUint8Array(encoder));
  }

  private detach() {
    this.doc.off("update", this.onUpdate);
    this.awareness.off("update", this.onAwareness);
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.awareness.clientID], this);
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "editor closed");
  }

  retry() {
    if (this.destroyed || !this.terminal) return;
    this.terminal = false;
    this.reconnectAttempt = 0;
    this.reconnectStartedAt = null;
    this.awareness.setLocalStateField("user", { name: "You", color: "#6678ff" });
    this.attach();
    this.connect();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.terminal = true;
    this.connectGeneration += 1;
    this.connecting = false;
    this.clearConnectTimeout();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.detach();
    this.rejectSyncedWaiters(new Error("Collaboration is not ready"));
  }
}
