import { describe, expect, it } from "vitest";
import { messageForAccountProblem } from "@/lib/account-action-messages";

describe("messageForAccountProblem", () => {
  it("maps an expired verification token to a resend prompt", () => {
    expect(messageForAccountProblem("verify-email", "identity.action_expired", "invalid identity input")).toEqual({
      kind: "expired",
      text: "This verification link has expired. Enter your email to request a new one.",
    });
  });

  it("maps an already-used verification token to a sign-in prompt", () => {
    expect(messageForAccountProblem("verify-email", "identity.action_already_used", "invalid identity input")).toEqual({
      kind: "used",
      text: "This email is already verified. You can sign in.",
    });
  });

  it("maps an invalid verification token without echoing it", () => {
    expect(messageForAccountProblem("verify-email", "identity.invalid_input", "invalid identity input")).toEqual({
      kind: "invalid",
      text: "This verification link is invalid. Enter your email to request a new one.",
    });
  });

  it("maps an expired reset token to a new reset prompt", () => {
    expect(messageForAccountProblem("reset-password", "identity.action_expired", "invalid identity input")).toEqual({
      kind: "expired",
      text: "This reset link has expired. Request a new password reset email.",
    });
  });

  it("keeps unknown keys on the gateway fallback copy", () => {
    expect(messageForAccountProblem("verify-email", "identity.internal", "internal identity service error")).toEqual({
      kind: "generic",
      text: "internal identity service error",
    });
  });
});
