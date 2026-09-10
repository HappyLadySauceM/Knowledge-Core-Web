"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { z } from "zod";

const SessionSchema = z.object({ id: z.string(), device_label: z.string(), created_at: z.string(), last_seen_at: z.string(), expires_at: z.string(), current: z.boolean() });
const SessionListSchema = z.object({ items: z.array(SessionSchema) });

async function authFetch(path: string, init?: RequestInit) { const response = await fetch(`/api/bff/auth/${path}`, init); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.detail ?? body.title ?? "Request failed"); return body; }

export function SecuritySettings({ locale = "zh-CN" }: { locale?: string }) {
  const client = useQueryClient(); const [message, setMessage] = useState("");
  const router = useRouter();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: async () => SessionListSchema.parse(await authFetch("sessions")) });
  const revoke = useMutation({ mutationFn: (id: string) => authFetch(`sessions/${id}`, { method: "DELETE" }), onSuccess: () => client.invalidateQueries({ queryKey: ["sessions"] }) });
  const revokeAll = useMutation({ mutationFn: () => authFetch("logout-all", { method: "POST" }), onSuccess: () => client.invalidateQueries({ queryKey: ["sessions"] }) });
  async function deactivate(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!confirm("Deactivate your account? This signs out every device.")) return; const password = new FormData(event.currentTarget).get("password"); try { await authFetch("deactivate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }); router.push(`/${locale}`); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to deactivate account"); } }
  const error = sessions.error || revoke.error || revokeAll.error;
  return <div className="settings-shell container-shell"><div className="settings-heading"><div><p className="eyebrow">Account security</p><h1>Sessions and access</h1></div><ShieldCheck size={22} /></div>{(error || message) && <p className="form-error" role="alert">{message || error?.message}</p>}<div className="session-list">{sessions.data?.items.map((session) => <article className="session-row" key={session.id}><div><strong>{session.device_label}</strong><span>{session.current ? "This device" : "Other device"} · Last active {new Date(session.last_seen_at).toLocaleString()}</span></div>{!session.current && <Button variant="outline" size="sm" onClick={() => revoke.mutate(session.id)}><LogOut size={14} />Revoke</Button>}</article>)}</div><Button variant="secondary" onClick={() => revokeAll.mutate()}>Sign out all other devices</Button><section className="danger-zone"><h2>Deactivate account</h2><p>Your account and all active sessions will be disabled.</p><form onSubmit={deactivate}><input type="password" name="password" required placeholder="Current password" autoComplete="current-password" /><Button type="submit" variant="outline"><Trash2 size={14} />Deactivate</Button></form></section></div>;
}
