export type ToastKind = "error" | "success" | "info" | "warning";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const MAX_VISIBLE = 3;
const DUPLICATE_WINDOW_MS = 4000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const lastShown = new Map<string, number>();

function emit() {
  listeners.forEach((listener) => listener());
}

function push(kind: ToastKind, message: string) {
  const now = Date.now();
  const key = `${kind}:${message}`;
  // Repeated failures (a refetch loop, a double click) must not stack identical toasts.
  if (now - (lastShown.get(key) ?? 0) < DUPLICATE_WINDOW_MS) return;
  lastShown.set(key, now);
  toasts = [...toasts, { id: nextId++, kind, message }].slice(-MAX_VISIBLE);
  emit();
}

/** A framework-free toast queue so ViewModels can raise toasts without a React context. */
export const notify = {
  error: (message: string) => push("error", message),
  success: (message: string) => push("success", message),
  info: (message: string) => push("info", message),
  warning: (message: string) => push("warning", message),
  dismiss(id: number) {
    toasts = toasts.filter((toast) => toast.id !== id);
    emit();
  },
  clear() {
    toasts = [];
    lastShown.clear();
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: () => toasts,
};
