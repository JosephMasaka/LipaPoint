"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  showClose?: boolean;
}

interface ModalSubComponentProps {
  children: ReactNode;
  className?: string;
}

export function ModalHeader({ children, className }: ModalSubComponentProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b px-6 py-4",
        "border-[var(--color-border)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ModalBody({ children, className }: ModalSubComponentProps) {
  return (
    <div className={cn("px-6 py-4", className)}>
      {children}
    </div>
  );
}

export function ModalFooter({ children, className }: ModalSubComponentProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t px-6 py-4",
        "border-[var(--color-border)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  showClose = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Size mapping
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
  };

  // Handle Escape key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      // Store current active element to restore focus later
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Prevent body scroll
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      // Focus trap - focus first focusable element
      setTimeout(() => {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements && focusableElements.length > 0) {
          (focusableElements[0] as HTMLElement).focus();
        }
      }, 100);
    } else {
      // Restore body scroll
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";

      // Restore focus to previous element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [open]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!open) return null;

  // Only render portal on client side
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "sm:p-6 md:p-8",
        "modal-backdrop"
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={description ? "modal-description" : undefined}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm",
          "animate-fade-in"
        )}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className={cn(
          "relative z-10 w-full",
          "bg-[var(--color-surface-elevated)]",
          "border border-[var(--color-border)]",
          "rounded-xl shadow-2xl",
          "animate-scale-in",
          "max-h-[90vh] overflow-hidden flex flex-col",
          // Mobile: full screen
          "sm:rounded-xl",
          "sm:max-h-[85vh]",
          // Desktop: size variants
          sizeClasses[size]
        )}
      >
        {/* Header (if title or description provided) */}
        {(title || description) && (
          <ModalHeader>
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className={cn(
                    "text-lg font-semibold",
                    "text-[var(--color-text-primary)]"
                  )}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className={cn(
                    "mt-1 text-sm",
                    "text-[var(--color-text-secondary)]"
                  )}
                >
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "flex-shrink-0 rounded-lg p-1.5",
                  "text-[var(--color-text-muted)]",
                  "hover:text-[var(--color-text-primary)]",
                  "hover:bg-[var(--color-surface-hover)]",
                  "transition-colors duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:ring-offset-2",
                  "focus:ring-offset-[var(--color-surface-elevated)]"
                )}
                aria-label="Close modal"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </ModalHeader>
        )}

        {/* Body - scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>,
    document.body
  );
}
