import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  isPublishPreconditionFailed,
  mapPublishError,
  publishAfterSync,
  waitForPublishReady,
} from "@/lib/editor/publish-sync";
import en from "@/messages/en.json";
import zh from "@/messages/zh-CN.json";

const copy = {
  publishNotReady: zh.editor.publishNotReady,
  publishConflict: zh.editor.publishConflict,
  publishFailed: zh.editor.publishFailed,
};

function precondition() {
  return new ApiError(412, {
    title: "Conflict",
    status: 412,
    key: "collaboration.precondition_failed",
    detail: "document sequence does not match",
  });
}

describe("waitForPublishReady", () => {
  it("resolves after persistence and the provider handshake are synced", async () => {
    const provider = { whenSynced: Promise.resolve(), isSynced: true };
    await expect(
      waitForPublishReady({ persistenceSynced: Promise.resolve(), provider, timeoutMs: 200 }),
    ).resolves.toBeUndefined();
  });

  it("rejects when the provider is missing or still unsynced", async () => {
    await expect(
      waitForPublishReady({ persistenceSynced: Promise.resolve(), provider: null, timeoutMs: 20 }),
    ).rejects.toThrow(/not ready/);
    await expect(
      waitForPublishReady({
        persistenceSynced: Promise.resolve(),
        provider: { whenSynced: Promise.resolve(), isSynced: false },
        timeoutMs: 20,
      }),
    ).rejects.toThrow(/not ready/);
  });

  it("times out when persistence never syncs", async () => {
    await expect(
      waitForPublishReady({
        persistenceSynced: new Promise(() => undefined),
        provider: { whenSynced: Promise.resolve(), isSynced: true },
        timeoutMs: 20,
      }),
    ).rejects.toThrow(/not ready/);
  });
});

describe("mapPublishError", () => {
  it("keeps 412 copy distinct from not-ready syncing copy", () => {
    expect(zh.editor.publishNotReady).toContain("尚未同步完成");
    expect(zh.editor.publishConflict).not.toContain("尚未同步完成");
    expect(en.editor.publishConflict).not.toMatch(/still syncing/i);
    expect(mapPublishError(precondition(), copy)).toBe(zh.editor.publishConflict);
    expect(mapPublishError(new Error("Collaboration is not ready"), copy)).toBe(zh.editor.publishNotReady);
  });

  it("never returns the Gateway sequence mismatch string", () => {
    expect(mapPublishError(precondition(), copy)).toBe(copy.publishConflict);
    expect(mapPublishError(new Error("document sequence does not match"), copy)).toBe(copy.publishConflict);
    expect(mapPublishError(new Error("Collaboration is not ready"), copy)).toBe(copy.publishNotReady);
    expect(mapPublishError(precondition(), copy)).not.toContain("document sequence");
  });

  it("maps other Gateway publish failures to Chinese copy instead of English details", () => {
    const error = new ApiError(400, { title: "Bad request", status: 400, detail: "invalid state_vector" });
    expect(mapPublishError(error, copy)).toBe(copy.publishFailed);
    expect(mapPublishError(error, copy)).not.toContain("state_vector");
  });
});

describe("publishAfterSync", () => {
  it("flushes before encode and retries 412 once after flushAndSync, not pull-only resync", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const flush = vi.fn().mockResolvedValue(undefined);
    const encodeStateVector = vi.fn().mockReturnValueOnce("sv-1").mockReturnValueOnce("sv-2");
    const publish = vi.fn().mockRejectedValueOnce(precondition()).mockResolvedValueOnce({ ok: true });
    const flushAndSync = vi.fn().mockResolvedValue(undefined);
    const resync = vi.fn();

    const result = await publishAfterSync({
      wait,
      flush,
      encodeStateVector,
      publish,
      flushAndSync,
      retryDelayMs: 0,
    });

    expect(wait.mock.invocationCallOrder[0]).toBeLessThan(flush.mock.invocationCallOrder[0]);
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(encodeStateVector.mock.invocationCallOrder[0]);
    expect(flushAndSync.mock.invocationCallOrder[0]).toBeGreaterThan(publish.mock.invocationCallOrder[0]);
    expect(flushAndSync).toHaveBeenCalledTimes(1);
    expect(resync).not.toHaveBeenCalled();
    expect(publish).toHaveBeenNthCalledWith(1, "sv-1");
    expect(publish).toHaveBeenNthCalledWith(2, "sv-2");
    expect(result).toEqual({ ok: true });
  });

  it("does not retry non-412 failures", async () => {
    const error = new ApiError(400, { title: "Bad request", status: 400 });
    const publish = vi.fn().mockRejectedValue(error);
    const flushAndSync = vi.fn();
    await expect(
      publishAfterSync({
        wait: async () => undefined,
        flush: async () => undefined,
        encodeStateVector: () => "sv",
        publish,
        flushAndSync,
        retryDelayMs: 0,
      }),
    ).rejects.toBe(error);
    expect(flushAndSync).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
  });
});

describe("isPublishPreconditionFailed", () => {
  it("detects Gateway 412 precondition problems", () => {
    expect(isPublishPreconditionFailed(precondition())).toBe(true);
    expect(isPublishPreconditionFailed(new Error("document sequence does not match"))).toBe(false);
  });
});
