"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailWarning } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SessionDataSchema } from "@/lib/api/types";
import { problemFallbackFromBody, problemKeyFromBody } from "@/lib/account-action-messages";

const VerificationStatusSchema = z.object({
  state: z.enum(["verified", "pending", "idle"]),
  expires_at: z.string().optional(),
  retry_after_seconds: z.number().int().optional(),
});

function copy(locale: string) {
  const zh = locale === "zh-CN";
  return {
    title: zh ? "请验证邮箱" : "Please verify your email",
    send: zh ? "发送验证邮件" : "Send verification email",
    sending: zh ? "发送中…" : "Sending…",
    sent: zh ? "请查收邮件。" : "Check your inbox.",
    cooldown: (expiresAt: string, minutes: number) =>
      zh
        ? `链接将于 ${expiresAt} 过期，未收到请在 ${minutes} 分钟后重试。`
        : `Link expires at ${expiresAt}. If you did not receive it, retry in ${minutes} minutes.`,
  };
}

function formatExpiry(value: string | undefined, locale: string) {
  if (!value) {
    return "";
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString(locale === "zh-CN" ? "zh-CN" : "en");
}

function retryMinutes(seconds: number | undefined) {
  if (!seconds || seconds < 1) {
    return 1;
  }
  return Math.max(1, Math.ceil(seconds / 60));
}

export function EmailVerificationBanner({ locale }: { locale: string }) {
  const client = useQueryClient();
  const labels = copy(locale);
  const [message, setMessage] = useState("");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const response = await fetch("/api/bff/auth/session");
      if (!response.ok) {
        throw new Error("session unavailable");
      }
      return SessionDataSchema.parse(await response.json());
    },
    retry: false,
  });
  const unverified = Boolean(session.data?.user) && !session.data?.user?.email_verified_at;
  const status = useQuery({
    queryKey: ["email-verification"],
    queryFn: async () => {
      const response = await fetch("/api/bff/auth/request-verification");
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(problemFallbackFromBody(body));
      }
      return VerificationStatusSchema.parse(body);
    },
    enabled: unverified,
    retry: false,
  });
  const send = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/bff/auth/request-verification", { method: "POST" });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (problemKeyFromBody(body) === "identity.verification_cooldown") {
          throw new Error("cooldown");
        }
        throw new Error(problemFallbackFromBody(body));
      }
      return VerificationStatusSchema.parse(body);
    },
    onSuccess: async (value) => {
      setMessage(labels.sent);
      client.setQueryData(["email-verification"], value);
      await client.invalidateQueries({ queryKey: ["email-verification"] });
    },
    onError: async (error) => {
      setMessage("");
      if (error instanceof Error && error.message === "cooldown") {
        await client.invalidateQueries({ queryKey: ["email-verification"] });
      }
    },
  });

  if (!unverified) {
    return null;
  }

  const cooling = status.isLoading || status.data?.state === "pending";
  const cooldownNote =
    cooling && status.data
      ? labels.cooldown(formatExpiry(status.data.expires_at, locale), retryMinutes(status.data.retry_after_seconds))
      : "";

  return (
    <aside className="verify-banner" role="status">
      <MailWarning size={16} aria-hidden="true" />
      <strong>{labels.title}</strong>
      <span className="verify-banner-actions">
        <Button type="button" size="sm" disabled={cooling || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? labels.sending : labels.send}
        </Button>
        {cooldownNote ? <small>{cooldownNote}</small> : null}
      </span>
      {message ? <p className="form-success">{message}</p> : null}
    </aside>
  );
}
