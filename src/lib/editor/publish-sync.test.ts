import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  isPublishPreconditionFailed,
  mapPublishError,
  publishAfterSync,
  waitForPublishReady,
} from "@/lib/editor/publish-sync";

const copy = {
  publishNotReady: "文档尚未同步完成，请稍后再发布。",
  publishConflict: "文档内容尚未同步完成，请稍后重试发布。",
  publishFailed: "发布失败，请稍后重试。",
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
  it("never returns the Gateway sequence mismatch string", () => {
    expect(mapPublishError(precondition(), copy)).toBe(copy.publishConflict);
    expect(mapPublishError(new Error("document sequence does not match"), copy)).toBe(copy.publishConflict);
    expect(mapPublishError(new Error("Collaboration is not ready"), copy)).toBe(copy.publishNotReady);
    expect(mapPublishError(precondition(), copy)).not.toContain("document sequence");
  });
});

describe("publishAfterSync", () => {
  it("encodes the state vector only after wait() and retries 412 once after resync", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const encodeStateVector = vi.fn().mockReturnValueOnce("sv-1").mockReturnValueOnce("sv-2");
    const publish = vi.fn().mockRejectedValueOnce(precondition()).mockResolvedValueOnce({ ok: true });
    const resync = vi.fn().mockResolvedValue(undefined);

    const result = await publishAfterSync({ wait, encodeStateVector, publish, resync });

    expect(wait.mock.invocationCallOrder[0]).toBeLessThan(encodeStateVector.mock.invocationCallOrder[0]);
    expect(resync).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenNthCalledWith(1, "sv-1");
    expect(publish).toHaveBeenNthCalledWith(2, "sv-2");
    expect(result).toEqual({ ok: true });
  });

  it("does not retry non-412 failures", async () => {
    const error = new ApiError(400, { title: "Bad request", status: 400 });
    const publish = vi.fn().mockRejectedValue(error);
    const resync = vi.fn();
    await expect(
      publishAfterSync({
        wait: async () => undefined,
        encodeStateVector: () => "sv",
        publish,
        resync,
      }),
    ).rejects.toBe(error);
    expect(resync).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
  });
});

describe("isPublishPreconditionFailed", () => {
  it("detects Gateway 412 precondition problems", () => {
    expect(isPublishPreconditionFailed(precondition())).toBe(true);
    expect(isPublishPreconditionFailed(new Error("document sequence does not match"))).toBe(false);
  });
});
