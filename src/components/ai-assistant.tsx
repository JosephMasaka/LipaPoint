"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Send, X, MessageCircle, Bot, User, FileCheck2, Inbox } from "lucide-react";
import type { AiCitation } from "@/lib/ai/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  citations?: AiCitation[];
  /** Actions the assistant queued instead of running; the user decides them. */
  approvals?: Array<{ id: string; summary: string }>;
}

const QUICK_ACTIONS = [
  { label: "Sales tips", prompt: "Give me tips to increase my sales this week" },
  { label: "Low stock advice", prompt: "What should I do about low stock items?" },
  { label: "Pricing help", prompt: "Help me with pricing strategy for my products" },
  { label: "Customer insights", prompt: "What can I do to improve customer retention?" },
];

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentId, setAgentId] = useState("assistant");
  const [agents, setAgents] = useState<Array<{ id: string; label: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const tenantSlug = pathname.split("/").filter(Boolean)[0] ?? "";

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // The registry is fetched rather than bundled so the client never imports
  // server-only agent modules.
  useEffect(() => {
    if (!isOpen || agents.length > 0) return;
    let cancelled = false;
    fetch("/api/ai/agents", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        if (!cancelled && Array.isArray(json.agents)) {
          setAgents(
            (json.agents as Array<{ id: string; label: string; enabled: boolean }>)
              .filter((a) => a.enabled)
              .map((a) => ({ id: a.id, label: a.label }))
          );
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, agents.length]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content.trim(), agent: agentId }),
      });

      if (res.status === 403) {
        setError("AI Assistant is available on Professional and Enterprise plans.");
        setIsLoading(false);
        return;
      }

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.code === "QUOTA_EXCEEDED" || data.code === "AGENT_QUOTA_EXCEEDED"
            ? data.error
            : "Rate limit reached. Please wait a moment before trying again."
        );
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        setIsLoading(false);
        return;
      }

      const data = await res.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
        citations: Array.isArray(data.citations) ? data.citations : undefined,
        approvals: Array.isArray(data.approvals) && data.approvals.length > 0 ? data.approvals : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setError("Failed to connect. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-black shadow-lg transition-transform hover:scale-110 active:scale-95"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 flex h-full w-full flex-col border-l border-border bg-surface shadow-2xl sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[400px] sm:rounded-2xl sm:border animate-in fade-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-gold" />
              <h3 className="font-semibold text-text-primary">AI Assistant</h3>
              <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
                Pro
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
              aria-label="Close AI Assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Agent picker: each agent has its own tool grant and monthly limit */}
          {agents.length > 1 && (
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <span className="text-[11px] uppercase tracking-wide text-text-muted">Agent</span>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                disabled={isLoading}
                className="flex-1 rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-text-primary focus:border-gold focus:outline-none disabled:opacity-50"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
                  <MessageCircle className="h-6 w-6 text-gold" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">How can I help your business?</p>
                  <p className="mt-1 text-sm text-text-muted">
                    Ask me about sales, inventory, pricing, or customers.
                  </p>
                </div>
                {/* Quick Actions */}
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.prompt)}
                      className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-gold hover:text-gold"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-3 flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gold/10">
                    <Bot className="h-4 w-4 text-gold" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-gold text-black"
                      : "bg-surface-elevated text-text-primary"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.approvals && msg.approvals.length > 0 && tenantSlug && (
                    <Link
                      href={`/${tenantSlug}/approvals`}
                      className="mt-2 flex items-center gap-1.5 rounded-md bg-background px-2 py-1 text-[11px] font-medium text-gold hover:underline"
                    >
                      <Inbox className="h-3 w-3" />
                      Nothing has run yet — review {msg.approvals.length === 1 ? "the request" : `${msg.approvals.length} requests`} in AI approvals
                    </Link>
                  )}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2">
                      {msg.citations.map((c) => (
                        <span
                          key={`${c.tool}-${c.from}`}
                          className="inline-flex items-center gap-1 rounded-md bg-background px-1.5 py-0.5 text-[10px] text-text-muted"
                          title={`${c.rows} row(s) · ${c.from.slice(0, 10)} to ${c.to.slice(0, 10)}`}
                        >
                          <FileCheck2 className="h-3 w-3" />
                          {c.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-elevated">
                    <User className="h-4 w-4 text-text-secondary" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gold/10">
                  <Bot className="h-4 w-4 text-gold" />
                </div>
                <div className="rounded-xl bg-surface-elevated px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border p-3">
            {messages.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.prompt)}
                    disabled={isLoading}
                    className="rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your business..."
                disabled={isLoading}
                className="flex-1 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
