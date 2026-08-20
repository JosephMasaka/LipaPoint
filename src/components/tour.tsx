"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  target?: string;
  position?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to LipaPoint!",
    description: "Let's take a quick tour to help you get started with your business. This will only take a moment.",
  },
  {
    title: "Point of Sale",
    description: "This is where you'll process sales. Search for products, scan barcodes, select payment methods, and complete transactions.",
    target: '[href$="/pos"]',
  },
  {
    title: "Manage Inventory",
    description: "Add your products, set prices, track stock levels, and get alerts when items run low.",
    target: '[href$="/inventory"]',
  },
  {
    title: "Track Orders",
    description: "View all completed sales, print or email receipts, and manage refunds from here.",
    target: '[href$="/orders"]',
  },
  {
    title: "Business Settings",
    description: "Configure your M-Pesa details, customize receipts, manage your subscription, and set up notifications.",
    target: '[href$="/settings"]',
  },
  {
    title: "You're all set!",
    description: "Start by adding your products in Inventory, then head to POS to make your first sale. You can revisit this tour anytime from Settings.",
  },
];

const TOUR_KEY = "lipapoint-tour-completed";

export function Tour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const complete = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setActive(false);
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) setStep(step + 1);
    else complete();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  useEffect(() => {
    if (!active) return;
    const currentStep = TOUR_STEPS[step];
    if (currentStep.target) {
      const el = document.querySelector(currentStep.target);
      if (el) {
        el.classList.add("tour-highlight");
        return () => el.classList.remove("tour-highlight");
      }
    }
  }, [active, step]);

  if (!active) return null;

  const currentStep = TOUR_STEPS[step];

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={complete} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4">
        <div className="bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
          <div className="bg-gold/10 border-b border-gold/20 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <span className="text-xs font-medium text-gold">
                Step {step + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <button onClick={complete} className="text-text-muted hover:text-text-primary transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            <h3 className="text-lg font-bold text-text-primary">{currentStep.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{currentStep.description}</p>
          </div>

          <div className="border-t border-border px-5 py-3 flex items-center justify-between">
            <div className="flex gap-1">
              {TOUR_STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-4 bg-gold" : "w-1.5 bg-border"}`} />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <Button size="sm" variant="outline" onClick={prev}>
                  <ArrowLeft className="h-3 w-3 mr-1" /> Back
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {step === TOUR_STEPS.length - 1 ? "Get Started" : <>Next <ArrowRight className="h-3 w-3 ml-1" /></>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
