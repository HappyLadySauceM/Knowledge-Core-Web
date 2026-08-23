"use client";

import { useRef, useState } from "react";
import { CheckCircle2, CloudUpload, LoaderCircle, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { MediaAttachment, MediaAttachmentPart, MediaAttachmentUpload } from "@/lib/api/types";

type UploadRecord = {
  fingerprint: string;
  attachment: MediaAttachment;
  upload_id: string;
  parts: MediaAttachmentPart[];
  etags: Record<string, string>;
  expires_at: string;
};

const databaseName = "knowledge-core-attachments";
const storeName = "uploads";

function fingerprint(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "fingerprint" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readUpload(key: string): Promise<UploadRecord | null> {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as UploadRecord | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function saveUpload(record: UploadRecord) {
  const database = await openDatabase();
  if (!database) return;
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, "readwrite").objectStore(storeName).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function removeUpload(key: string) {
  const database = await openDatabase();
  if (!database) return;
  database.transaction(storeName, "readwrite").objectStore(storeName).delete(key);
}

async function createUpload(file: File): Promise<UploadRecord> {
  const upload = await apiFetch<MediaAttachmentUpload>("/api/v1/attachments", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ filename: file.name, media_type: file.type || "application/octet-stream", size_bytes: file.size }),
  });
  return { fingerprint: fingerprint(file), attachment: upload.attachment, upload_id: upload.upload_id, parts: upload.parts, etags: {}, expires_at: upload.expires_at };
}

async function putPart(file: File, part: MediaAttachmentPart, attachment: MediaAttachment) {
  const start = (part.part_number - 1) * attachment.part_size;
  const response = await fetch(part.url, { method: "PUT", body: file.slice(start, Math.min(start + attachment.part_size, file.size)) });
  if (!response.ok) throw new Error(`Part ${part.part_number} failed (${response.status})`);
  const etag = response.headers.get("ETag") ?? response.headers.get("etag");
  if (!etag) throw new Error(`Part ${part.part_number} did not return an ETag`);
  return etag;
}

async function uploadParts(file: File, record: UploadRecord, onProgress: (completed: number, total: number) => void) {
  const pending = record.parts.filter((part) => !record.etags[String(part.part_number)]);
  let completed = record.parts.length - pending.length;
  onProgress(completed, record.parts.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const part = pending[cursor++];
      const etag = await putPart(file, part, record.attachment);
      record.etags[String(part.part_number)] = etag;
      completed += 1;
      onProgress(completed, record.parts.length);
      await saveUpload(record);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

export function AttachmentUploader({ labels }: { labels?: Partial<Record<"title" | "hint" | "choose" | "uploading" | "success" | "resume" | "failed", string>> }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  async function start(file: File) {
    const key = fingerprint(file);
    setState("uploading");
    setMessage("");
    try {
      let record = await readUpload(key);
      const resumable = record && new Date(record.expires_at).getTime() > Date.now();
      if (!record || !resumable) record = await createUpload(file);
      else setMessage(labels?.resume ?? "Resuming the previous upload…");
      await saveUpload(record);
      await uploadParts(file, record, (completed, total) => setProgress(Math.round((completed / total) * 100)));
      const parts = record.parts.map((part) => ({ part_number: part.part_number, etag: record?.etags[String(part.part_number)] }));
      const attachment = await apiFetch<MediaAttachment>(`/api/v1/attachments/${record.attachment.id}/complete`, {
        method: "POST", body: JSON.stringify({ upload_id: record.upload_id, parts }),
      });
      await removeUpload(key);
      setProgress(100);
      setMessage(`${labels?.success ?? "Upload complete"} · ${attachment.status}`);
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels?.failed ?? "Upload failed");
      setState("error");
    }
  }

  return <section className="attachment-uploader" aria-live="polite">
    <div className="attachment-uploader-heading"><div><p className="eyebrow">{labels?.title ?? "Media library"}</p><p className="attachment-uploader-hint">{labels?.hint ?? "Images, video and files up to 1 GiB"}</p></div><button type="button" className="attachment-upload-button" onClick={() => input.current?.click()} disabled={state === "uploading"}>{state === "uploading" ? <LoaderCircle className="spin" size={17} /> : state === "success" ? <CheckCircle2 size={17} /> : state === "error" ? <RotateCcw size={17} /> : <CloudUpload size={17} />}{state === "uploading" ? labels?.uploading ?? "Uploading…" : labels?.choose ?? "Choose file"}</button></div>
    <input ref={input} type="file" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void start(file); event.currentTarget.value = ""; }} />
    {(state === "uploading" || progress > 0) && <div className="attachment-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
    {message && <p className={state === "error" ? "attachment-error" : "attachment-message"}>{message}</p>}
  </section>;
}
