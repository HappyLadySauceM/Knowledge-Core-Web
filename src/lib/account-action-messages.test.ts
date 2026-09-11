import { describe, expect, it } from "vitest";
import { messageForAccountProblem, messageForAuthProblem } from "@/lib/account-action-messages";

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

describe("messageForAuthProblem", () => {
  it("maps a register email conflict to sign-in and verification copy", () => {
    expect(messageForAuthProblem("register", "identity.email_conflict", "email already exists")).toEqual({
      kind: "email_conflict",
      text: "This email is already registered. Sign in, or request a new verification link if you have not verified yet.",
    });
  });

  it("maps a register username conflict without sending the user to verify-email", () => {
    expect(messageForAuthProblem("register", "identity.username_conflict", "username already exists")).toEqual({
      kind: "username_conflict",
      text: "This username is already taken. Choose another username.",
    });
  });

  it("maps an unverified login to a verification prompt", () => {
    expect(messageForAuthProblem("login", "identity.email_not_verified", "email verification is required")).toEqual({
      kind: "email_not_verified",
      text: "Verify your email before signing in. Open the link from your inbox, or request a new one.",
    });
  });

  it("keeps invalid credentials on the gateway fallback copy", () => {
    expect(messageForAuthProblem("login", "identity.invalid_credentials", "invalid credentials")).toEqual({
      kind: "generic",
      text: "invalid credentials",
    });
  });
});
