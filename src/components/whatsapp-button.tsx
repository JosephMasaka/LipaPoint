import { cn } from "@/lib/utils";

/**
 * WhatsApp's own glyph. lucide-react only has generic chat icons, and a
 * speech bubble here reads as "support chat", which this is not.
 */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.45s1.06 2.84 1.2 3.04c.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.7.22 1.34.19 1.85.12.56-.09 1.72-.7 1.96-1.39.25-.68.25-1.26.17-1.39-.07-.12-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38a9.87 9.87 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23a8.23 8.23 0 0 1 0 16.45z" />
    </svg>
  );
}

export interface WhatsAppButtonProps {
  /** Digits only, international format — `254793973146`, no `+` and no spaces. */
  phone?: string;
  /** Pre-filled text in the WhatsApp composer. */
  message?: string;
  /** Accessible label; also the tooltip on hover. */
  label?: string;
  /** `bottom-right` (default) or `bottom-left`. */
  position?: "bottom-right" | "bottom-left";
  className?: string;
}

export const WHATSAPP_NUMBER = "254793973146";

/**
 * Floating WhatsApp call-to-action.
 *
 * Fixed to the viewport so it follows the visitor down every marketing page;
 * `z-40` keeps it under modals and the cookie/app banners but above page
 * content, and the safe-area inset stops iOS from hiding it behind the home
 * indicator. The label is text, not an icon-only button, so screen readers and
 * keyboard users get the target without guessing.
 */
export function WhatsAppButton({
  phone = WHATSAPP_NUMBER,
  message = "Hi LipaPoint, I would like to know more about your ERP.",
  label = "Chat with us on WhatsApp",
  position = "bottom-right",
  className,
}: WhatsAppButtonProps) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  const href = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        "group fixed z-40 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20",
        "transition hover:bg-[#1ebe5b] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#25D366]",
        position === "bottom-right" ? "right-4 sm:right-6" : "left-4 sm:left-6",
        className
      )}
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <WhatsAppIcon className="h-5 w-5" />
      <span className="hidden sm:inline">WhatsApp us</span>
    </a>
  );
}
