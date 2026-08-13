"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-zinc-100 mb-4">Get in Touch</h1>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto">
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
                  <h3 className="font-semibold text-zinc-100 mb-1">Call Us</h3>
                  <p className="text-sm text-zinc-400">+254 700 123 456</p>
                  <p className="text-sm text-zinc-400">Mon-Fri 8am - 6pm EAT</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 shrink-0">
                  <Mail className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 mb-1">Email</h3>
                  <p className="text-sm text-zinc-400">sales@lipapoint.co.ke</p>
                  <p className="text-sm text-zinc-400">support@lipapoint.co.ke</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 shrink-0">
                  <MessageCircle className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 mb-1">WhatsApp</h3>
                  <p className="text-sm text-zinc-400">+254 700 123 456</p>
                  <p className="text-sm text-zinc-400">Instant response during business hours</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 shrink-0">
                  <MapPin className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 mb-1">Office</h3>
                  <p className="text-sm text-zinc-400">Westlands, Nairobi</p>
                  <p className="text-sm text-zinc-400">Kenya</p>
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
                  <h3 className="text-xl font-semibold text-zinc-100 mb-2">Message Sent!</h3>
                  <p className="text-zinc-400">We will get back to you within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Full Name" placeholder="John Kamau" required />
                    <Input label="Email" type="email" placeholder="john@company.com" required />
                  </div>
                  <Input label="Phone" type="tel" placeholder="+254 7XX XXX XXX" />
                  <Input label="Subject" placeholder="I'd like to learn more about..." required />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-300">Message</label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Tell us about your business and how we can help..."
                      className="flex w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-all resize-none"
                    />
                  </div>
                  <Button type="submit" size="lg">Send Message</Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
