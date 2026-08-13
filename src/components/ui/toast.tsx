"use client";

import { create } from "zustand";
import { X, CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

// Toast types
export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Toast store
interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    // Auto-dismiss after duration (default 4 seconds)
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, toast.duration ?? 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Toast API
export const toast = {
  success: (message: string, duration?: number) => {
    useToastStore.getState().addToast({ type: "success", message, duration });
  },
  error: (message: string, duration?: number) => {
    useToastStore.getState().addToast({ type: "error", message, duration });
  },
  info: (message: string, duration?: number) => {
    useToastStore.getState().addToast({ type: "info", message, duration });
  },
  warning: (message: string, duration?: number) => {
    useToastStore.getState().addToast({ type: "warning", message, duration });
  },
};

// Toast configuration by type
const toastConfig = {
  success: {
    icon: CheckCircle2,
    borderColor: "border-l-green-500",
    iconColor: "text-green-500",
  },
  error: {
    icon: XCircle,
    borderColor: "border-l-red-500",
    iconColor: "text-red-500",
  },
  info: {
    icon: Info,
    borderColor: "border-l-blue-500",
    iconColor: "text-blue-500",
  },
  warning: {
    icon: AlertTriangle,
    borderColor: "border-l-amber-500",
    iconColor: "text-amber-500",
  },
};

// Individual toast component
function ToastItem({ toast: toastData }: { toast: Toast }) {
  const removeToast = useToastStore((state) => state.removeToast);
  const config = toastConfig[toastData.type];
  const Icon = config.icon;

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl
        bg-[var(--color-surface-elevated)]
        border border-[var(--color-border)] border-l-4 ${config.borderColor}
        shadow-lg backdrop-blur-sm
        animate-slide-in
        w-full sm:min-w-[320px] sm:max-w-md
      `}
      style={{
        animation: "slideIn 0.3s ease-out",
      }}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconColor}`} />

      <p className="flex-1 text-sm text-[var(--color-text-primary)] leading-relaxed">
        {toastData.message}
      </p>

      <button
        onClick={() => removeToast(toastData.id)}
        className="flex-shrink-0 p-0.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4 text-[var(--color-text-muted)]" />
      </button>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

// Main Toaster component
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div
      className="
        fixed z-50
        inset-x-0 bottom-0 p-4
        sm:top-0 sm:right-0 sm:bottom-auto sm:left-auto
        sm:w-auto sm:p-6
        pointer-events-none
      "
    >
      <div className="flex flex-col gap-3 pointer-events-auto">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </div>
  );
}
