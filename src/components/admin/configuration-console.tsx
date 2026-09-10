"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminApi, type ConfigurationNamespace } from "@/lib/api/admin";
import { mediaApi } from "@/lib/api/media";
import { SessionDataSchema } from "@/lib/api/types";

const fields: Record<ConfigurationNamespace, { key: string; label: string; type?: string }[]> = {
  site: [{ key: "title", label: "Site title" }, { key: "tagline_zh", label: "Chinese tagline" }, { key: "tagline_en", label: "English tagline" }, { key: "hero_image_url", label: "Hero image URL" }, { key: "hero_attachment_id", label: "Hero media" }, { key: "hero_focal_x", label: "Horizontal focus", type: "number" }, { key: "hero_focal_y", label: "Vertical focus", type: "number" }],
  email: [{ key: "enabled", label: "Enabled", type: "checkbox" }, { key: "host", label: "SMTP host" }, { key: "port", label: "Port", type: "number" }, { key: "username", label: "Username" }, { key: "from", label: "From address" }, { key: "frontend_base_url", label: "Frontend origin" }, { key: "password", label: "SMTP password", type: "password" }],
  ai: [{ key: "enabled", label: "Enabled", type: "checkbox" }, { key: "provider", label: "Provider" }, { key: "base_url", label: "Base URL" }, { key: "model", label: "Model" }, { key: "request_timeout_ms", label: "Timeout (ms)", type: "number" }, { key: "max_tokens", label: "Max tokens", type: "number" }, { key: "api_key", label: "API key", type: "password" }],
};

export function ConfigurationConsole({ locale }: { locale: string }) {
  const router = useRouter(); const client = useQueryClient();
  const [namespace, setNamespace] = useState<ConfigurationNamespace>("site"); const [draft, setDraft] = useState<Record<string, string>>({}); const [secretTouched, setSecretTouched] = useState<Record<string, boolean>>({}); const [savedRevision, setSavedRevision] = useState<number>();
  const session = useQuery({ queryKey: ["session"], queryFn: async () => { const r = await fetch("/api/bff/auth/session"); return SessionDataSchema.parse(await r.json()); }, retry: false });
  useEffect(() => { if (session.data && session.data.user?.role !== "admin") router.replace(`/${locale}/studio`); }, [session.data, locale, router]);
  const config = useQuery({ queryKey: ["configuration", namespace], queryFn: () => adminApi.get(namespace).then((value) => value.data), enabled: session.data?.user?.role === "admin" });
  const media = useQuery({ queryKey: ["media", "admin-images"], queryFn: () => mediaApi.list({ category: "image", status: "ready", limit: 100 }).then((value) => value.data.items), enabled: namespace === "site" && session.data?.user?.role === "admin" });
  // A newly fetched revision is the authoritative reset boundary for this local form draft.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!config.data) return; const next: Record<string, string> = {}; config.data.values.forEach((item) => { if (!item.secret) next[item.key] = item.value; }); setDraft(next); setSecretTouched({}); setSavedRevision(undefined); }, [config.data]);
  const delivery = useQuery({ queryKey: ["configuration-delivery", namespace, savedRevision], queryFn: () => adminApi.delivery(namespace, savedRevision!).then((value) => value.data), enabled: Boolean(savedRevision), refetchInterval: (query) => ["published", "parked"].includes(query.state.data?.status ?? "") ? false : 1500 });
  const save = useMutation({ mutationFn: (values: Record<string, string>) => adminApi.put(namespace, config.data!.revision, values), onSuccess: ({ data }) => { setSavedRevision(data.revision); client.setQueryData(["configuration", namespace], data); } });
  const secretKeys = useMemo(() => new Set(config.data?.values.filter((item) => item.secret).map((item) => item.key) ?? []), [config.data]);
  function submit(event: FormEvent) { event.preventDefault(); const values = { ...draft }; secretKeys.forEach((key) => { if (!secretTouched[key]) delete values[key]; }); save.mutate(values); }
  if (session.isLoading) return <div className="studio-loading">Checking access…</div>;
  if (session.data?.user?.role !== "admin") return <section className="management-page"><ShieldAlert /><h1>Administrator access required</h1></section>;
  return <section className="management-page admin-console"><header><p className="eyebrow">Platform</p><h1>{locale === "zh-CN" ? "管理配置" : "Configuration"}</h1></header><div className="admin-tabs">{(["site","email","ai"] as const).map((value) => <button type="button" className={namespace === value ? "selected" : ""} onClick={() => setNamespace(value)} key={value}>{value}</button>)}</div>{config.error && <p className="form-error">{config.error.message}</p>}{config.data && <form className="configuration-form" onSubmit={submit}>{fields[namespace].map((field) => field.key === "hero_attachment_id" ? <label key={field.key}>{field.label}<select value={draft[field.key] ?? ""} onChange={(event) => setDraft((value) => ({ ...value, [field.key]: event.target.value }))}><option value="">Use image URL</option>{media.data?.map((item) => <option value={item.id} key={item.id}>{item.filename}</option>)}</select></label> : field.type === "checkbox" ? <label className="check-row" key={field.key}><input type="checkbox" checked={draft[field.key] === "true"} onChange={(event) => setDraft((value) => ({ ...value, [field.key]: String(event.target.checked) }))} />{field.label}</label> : <label key={field.key}>{field.label}<input type={field.type ?? "text"} value={draft[field.key] ?? ""} placeholder={secretKeys.has(field.key) ? "Leave blank to keep current value" : undefined} onChange={(event) => { setDraft((value) => ({ ...value, [field.key]: event.target.value })); if (secretKeys.has(field.key)) setSecretTouched((value) => ({ ...value, [field.key]: true })); }} />{secretKeys.has(field.key) && <button type="button" className="text-button" onClick={() => { setDraft((value) => ({ ...value, [field.key]: "" })); setSecretTouched((value) => ({ ...value, [field.key]: true })); }}>Clear stored secret</button>}</label>)}<div className="configuration-actions"><span>Revision {config.data.revision} · {config.data.environment}</span><Button type="submit" disabled={save.isPending}><Save size={15} />{save.isPending ? "Saving…" : "Save configuration"}</Button></div></form>}{save.error && <p className="form-error">{save.error.message}</p>}{delivery.data && <div className={`delivery-status ${delivery.data.status}`}><strong>Delivery: {delivery.data.status}</strong><span>Revision {delivery.data.revision} · {delivery.data.attempts} attempts{delivery.data.last_error_key ? ` · ${delivery.data.last_error_key}` : ""}</span></div>}</section>;
}
