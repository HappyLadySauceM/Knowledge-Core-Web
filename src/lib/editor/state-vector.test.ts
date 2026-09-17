import { describe, expect, it } from "vitest";
import { encodeRawUrlBase64 } from "@/lib/editor/state-vector";

describe("encodeRawUrlBase64", () => {
  it("matches Go base64.RawURLEncoding including minus and underscore", () => {
    // 0xff 0x00 0x01 0x7e 0x3f → Std `/wABfj8=` → Raw URL `_wABfj8`
    // 0xff 0x00 0x01 0x7e 0x3f → Std `/wABfj8=` → Raw URL `_wABfj8`
    expect(encodeRawUrlBase64(Uint8Array.from([0xff, 0x00, 0x01, 0x7e, 0x3f]))).toBe("_wABfj8");
  });

  it("strips padding and leaves the URL alphabet unchanged", () => {
    expect(encodeRawUrlBase64(Uint8Array.from([0x14]))).toBe("FA");
    expect(encodeRawUrlBase64(new Uint8Array())).toBe("");
    expect(encodeRawUrlBase64(Uint8Array.from([0xfb]))).toBe("-w");
  });
});
