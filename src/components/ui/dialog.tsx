"use client";

import { FormEvent, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

// Lightweight modal that replaces native prompt/confirm in Studio flows.
// 轻量弹层，替代 Studio 流程里的原生 prompt/confirm。
type AppDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  inputLabel?: string;
  inputDefault?: string;
  inputRequired?: boolean;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
};

export function AppDialog({
  open,
  title,
  description,
  inputLabel,
  inputDefault = "",
  inputRequired = true,
  confirmLabel,
  cancelLabel,
  pending = false,
  onClose,
  onConfirm,
}: AppDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const frame = window.requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
        return;
      }
      confirmRef.current?.focus();
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(frame);
    };
  }, [open, onClose, pending]);

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const value = inputRef.current?.value ?? "";
    if (inputLabel && inputRequired && !value.trim()) return;
    onConfirm(value.trim());
  }

  return (
    <div className="app-dialog-backdrop" onMouseDown={onClose}>
      <form
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id={titleId}>{title}</h2>
        {description ? <p>{description}</p> : null}
        {inputLabel ? (
          <label className="app-dialog-field">
            {inputLabel}
            <input ref={inputRef} name="value" defaultValue={inputDefault} disabled={pending} />
          </label>
        ) : null}
        <div className="app-dialog-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} type="submit" disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
