/**
 * Simple context-based toaster (FOUNDATION OWNED).
 *
 * `const toast = useToast()` then `toast.show("Saved")` (or
 * `toast.error(...)` for failures). Toasters stack bottom-center above the
 * mobile tab bar, auto-dismiss after ~3.5s, and are RTL-safe (positioning
 * uses logical insets only). Rate-limit (429) and network failures are the
 * canonical uses per the API contract — "a friendly toast, never a crash".
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/utils/cn";

type ToastKind = "info" | "error";

interface ToastRow {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  show: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** How long a toast stays on screen. */
const TOAST_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<ToastRow[]>([]);
  const nextId = useRef(0);

  const push = useCallback((message: string, kind: ToastKind) => {
    const id = ++nextId.current;
    setRows((prev) => [...prev.slice(-2), { id, message, kind }]);
    window.setTimeout(() => {
      setRows((prev) => prev.filter((row) => row.id !== id));
    }, TOAST_MS);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show: (message) => push(message, "info"),
      error: (message) => push(message, "error"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* bottom-center, above the mobile tab bar (~64px) and any body scroll */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              "max-w-md rounded-pill px-5 py-2.5 text-center font-body text-[14px] font-semibold shadow-[var(--shadow-card)]",
              row.kind === "error"
                ? "bg-dark-2 text-white"
                : "bg-white text-ink border border-hair",
            )}
          >
            {row.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
