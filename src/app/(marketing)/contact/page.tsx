"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          subject: form.get("subject"),
          message: form.get("message"),
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send message");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">Get in Touch</h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            Have questions? Our team is here to help. Reach out and we will get back to you within 24 hours.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Info */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 shrink-0">
                  <Phone className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary mb-1">Call Us</h3>
                  <p className="text-sm text-text-secondary">+254 793973146</p>
                  <p className="text-sm text-text-secondary">Mon-Fri 8am - 6pm EAT</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 shrink-0">
                  <Mail className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary mb-1">Email</h3>
                  <p className="text-sm text-text-secondary">lipapoint@tunzaassets.co.ke</p>
                  {/*<p className="text-sm text-text-secondary">support@lipapoint.co.ke</p>*/}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 shrink-0">
                  <MessageCircle className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary mb-1">WhatsApp</h3>
                  <p className="text-sm text-text-secondary">+254 791298382</p>
                  <p className="text-sm text-text-secondary">Instant response during business hours</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 shrink-0">
                  <MapPin className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary mb-1">Office</h3>
                  <p className="text-sm text-text-secondary">Westlands, Nairobi</p>
                  <p className="text-sm text-text-secondary">Kenya</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Send us a Message</CardTitle>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mx-auto mb-4">
                    <Mail className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary mb-2">Message Sent!</h3>
                  <p className="text-text-secondary">We will get back to you within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input name="name" label="Full Name" placeholder="John Kamau" required />
                    <Input name="email" label="Email" type="email" placeholder="john@company.com" required />
                  </div>
                  <Input name="phone" label="Phone" type="tel" placeholder="+254 7XX XXX XXX" />
                  <Input name="subject" label="Subject" placeholder="I'd like to learn more about..." required />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-secondary">Message</label>
                    <textarea
                      name="message"
                      rows={5}
                      required
                      placeholder="Tell us about your business and how we can help..."
                      className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-all resize-none"
                    />
                  </div>
                  <Button type="submit" size="lg" disabled={loading}>{loading ? "Sending..." : "Send Message"}</Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
