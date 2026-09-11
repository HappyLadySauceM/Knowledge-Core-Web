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
  confirmLabel: string;
  cancelLabel: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
};

export function AppDialog({
  open,
  title,
  description,
  inputLabel,
  inputDefault = "",
  confirmLabel,
  cancelLabel,
  onClose,
  onConfirm,
}: AppDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(frame);
    };
  }, [open, onClose]);

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = inputRef.current?.value ?? "";
    if (inputLabel && !value.trim()) return;
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
            <input ref={inputRef} name="value" defaultValue={inputDefault} />
          </label>
        ) : null}
        <div className="app-dialog-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="submit">{confirmLabel}</Button>
        </div>
      </form>
    </div>
  );
}
