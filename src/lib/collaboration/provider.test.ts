import { describe, expect, it } from "vitest";
import { reconnectDelay } from "./provider";

describe("reconnectDelay", () => {
  it("uses bounded exponential backoff with deterministic jitter", () => {
    expect(reconnectDelay(0, 0)).toBe(400);
    expect(reconnectDelay(0, 1)).toBe(600);
    expect(reconnectDelay(4, 0.5)).toBe(5000);
    expect(reconnectDelay(20, 0.5)).toBe(5000);
  });
});
