import Link from "next/link";
import { Store } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 sm:p-6">
      <Link href="/" className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
          <Store className="h-5 w-5 text-gold" />
        </div>
        <span className="text-xl font-bold text-text-primary">LipaPoint</span>
      </Link>
      {children}
    </div>
  );
}
