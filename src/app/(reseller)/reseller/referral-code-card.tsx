"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";

export function ReferralCodeCard({
  code,
  commissionPercent,
}: {
  code: string;
  commissionPercent: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — user can still read the code off the card.
    }
  };

  return (
    <Card className="bg-surface-elevated border-gold/30">
      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest">Your Referral Code</p>
          <p className="text-3xl font-bold text-gold font-mono tracking-widest mt-1">{code}</p>
          <p className="text-xs text-text-muted mt-1">
            Businesses should enter this code when registering — you earn {commissionPercent}% of
            every subscription payment they make.
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-lg bg-gold/10 border border-gold/30 text-gold px-4 py-2.5 text-sm font-medium hover:bg-gold/20 transition-colors self-start sm:self-center"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy Code"}
        </button>
      </CardContent>
    </Card>
  );
}
