import { ApiError } from "@/lib/api/client";

const sequenceMismatch = "document sequence does not match";

export type PublishSyncCopy = {
  publishNotReady: string;
  publishConflict: string;
  publishFailed: string;
};

export type PublishSyncProvider = {
  whenSynced: Promise<unknown>;
  isSynced: boolean;
};

// Fail closed until IndexedDB persistence and the Yjs/WebSocket handshake have both finished.
// IndexedDB 持久化与 Yjs/WebSocket 握手都完成前不得发布。
export async function waitForPublishReady(input: {
  persistenceSynced: Promise<unknown>;
  provider: PublishSyncProvider | null;
  timeoutMs?: number;
}): Promise<void> {
  if (!input.provider) {
    throw new Error("Collaboration is not ready");
  }
  const timeoutMs = input.timeoutMs ?? 10_000;
  const provider = input.provider;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([input.persistenceSynced, provider.whenSynced]),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Collaboration is not ready")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!provider.isSynced) {
    throw new Error("Collaboration is not ready");
  }
}

export function isPublishPreconditionFailed(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 412 || error.problem.key === "collaboration.precondition_failed";
  }
  return false;
}

// Map publish failures to locale copy; never surface Gateway's sequence mismatch string.
// 发布失败改走文案；不得把 Gateway 的 sequence mismatch 原文展示给用户。
export function mapPublishError(error: unknown, copy: PublishSyncCopy): string {
  if (isPublishPreconditionFailed(error)) return copy.publishConflict;
  const raw = error instanceof Error ? error.message : "";
  if (!raw) return copy.publishFailed;
  if (raw.includes("not ready") || raw.includes("not synced")) return copy.publishNotReady;
  if (raw === sequenceMismatch || raw.toLowerCase().includes("sequence does not match") || raw.includes("document sequence")) {
    return copy.publishConflict;
  }
  if (error instanceof ApiError) return copy.publishFailed;
  return raw;
}

export async function publishAfterSync<T>(input: {
  wait: () => Promise<void>;
  flush: () => Promise<void>;
  encodeStateVector: () => string;
  publish: (stateVector: string) => Promise<T>;
  flushAndSync: () => Promise<void>;
  retryDelayMs?: number;
}): Promise<T> {
  await input.wait();
  await input.flush();
  try {
    return await input.publish(input.encodeStateVector());
  } catch (error) {
    if (!isPublishPreconditionFailed(error)) throw error;
    // Reconnect for a full bidirectional handshake; do not retry with pull-only resync.
    // 412 后走完整双向握手重连，不再用只拉不推的 resync。
    await input.flushAndSync();
    const retryDelayMs = input.retryDelayMs ?? 50;
    if (retryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
    return input.publish(input.encodeStateVector());
  }
}
