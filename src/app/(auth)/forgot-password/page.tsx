"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const emailValue = form.get("email") as string;
    setEmail(emailValue);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-1">Check your email</h2>
            <p className="text-sm text-text-secondary">
              If an account exists for <span className="text-text-primary font-medium">{email}</span>, we&apos;ve sent password reset instructions.
            </p>
          </div>
          <p className="text-xs text-text-muted">
            Didn&apos;t receive it? Check your spam folder or try again.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" size="lg" className="w-full" onClick={() => setSent(false)}>
              Try another email
            </Button>
            <Link href="/login" className="text-sm text-gold hover:underline">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Reset Password</CardTitle>
        <CardDescription>Enter your email and we&apos;ll send you a reset link</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <Input
            name="email"
            label="Email Address"
            type="email"
            placeholder="you@business.co.ke"
            required
          />

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            <Mail className="h-4 w-4" />
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>

        <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-text-muted hover:text-text-secondary mt-6 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
