import { AlertCircle } from "lucide-react";

/** Inline, accessible validation message shown beneath a form control. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs text-destructive mt-1">
      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
      <span>{message}</span>
    </p>
  );
}

/** Border/ring classes applied to an invalid control. */
export const invalidCls =
  "border-destructive focus-visible:ring-destructive aria-invalid:border-destructive";

/** Focus the first control matching an aria-label, scrolling it into view. */
export function focusByAriaLabel(label: string) {
  if (typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>(`[aria-label="${CSS.escape(label)}"]`);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  requestAnimationFrame(() => el.focus());
}
