import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";

const syncMessage = 0;
const awarenessMessage = 1;

export class KnowledgeWebSocketProvider {
  readonly awareness: awarenessProtocol.Awareness;
  readonly doc: Y.Doc;
  private readonly socket: WebSocket;
  private readonly onUpdate: (update: Uint8Array, origin: unknown) => void;
  private readonly onAwareness: ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => void;

  constructor(url: string, ticket: string, subprotocol: string, doc: Y.Doc) {
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(doc);
    this.awareness.setLocalStateField("user", { name: "You", color: "#6678ff" });
    this.socket = new WebSocket(url, [subprotocol, `ticket.${ticket}`]);
    this.socket.binaryType = "arraybuffer";
    this.onUpdate = (update, origin) => { if (origin !== this && this.socket.readyState === WebSocket.OPEN) this.sendUpdate(update); };
    this.onAwareness = ({ added, updated, removed }) => {
      if (this.socket.readyState !== WebSocket.OPEN) return;
      const changed = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, awarenessMessage);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
      this.socket.send(encoding.toUint8Array(encoder));
    };
    doc.on("update", this.onUpdate);
    this.awareness.on("update", this.onAwareness);
    this.socket.addEventListener("open", () => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, syncMessage);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      this.socket.send(encoding.toUint8Array(encoder));
      this.onAwareness({ added: [this.awareness.clientID], updated: [], removed: [] });
    });
    this.socket.addEventListener("message", (event) => this.receive(event.data));
  }

  private receive(data: ArrayBuffer | Blob) {
    if (data instanceof Blob) { void data.arrayBuffer().then((value) => this.receive(value)); return; }
    const decoder = decoding.createDecoder(new Uint8Array(data));
    while (decoding.hasContent(decoder)) {
      const type = decoding.readVarUint(decoder);
      if (type === syncMessage) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, syncMessage);
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
        if (encoding.length(encoder) > 1 && this.socket.readyState === WebSocket.OPEN) this.socket.send(encoding.toUint8Array(encoder));
        continue;
      }
      if (type === awarenessMessage) {
        awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
        continue;
      }
      break;
    }
  }

  private sendUpdate(update: Uint8Array) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, syncMessage);
    syncProtocol.writeUpdate(encoder, update);
    this.socket.send(encoding.toUint8Array(encoder));
  }

  destroy() {
    this.doc.off("update", this.onUpdate);
    this.awareness.off("update", this.onAwareness);
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.awareness.clientID], this);
    this.socket.close(1000, "editor closed");
  }
}
