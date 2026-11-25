"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { AlertCircle, ArrowLeft, Plug, X } from "lucide-react";
import Link from "next/link";

interface ProviderField {
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  secret?: boolean;
}

interface Provider {
  id: string;
  label: string;
  category: string;
  description: string;
  status: "available" | "planned";
  authTypes: string[];
  entities: string[];
  supportsFile: boolean;
  supportsWebhooks: boolean;
  setupHint?: string;
  configFields?: ProviderField[];
  credentialFields?: ProviderField[];
}

const AUTH_LABELS: Record<string, string> = {
  NONE: "No authentication",
  API_KEY: "API key header",
  BEARER: "Bearer token",
  BASIC: "Username & password",
};

const emptyForm = {
  name: "",
  authType: "NONE",
  baseUrl: "",
  apiKey: "",
  token: "",
  username: "",
  password: "",
  productsPath: "",
  customersPath: "",
  itemsPath: "",
  idField: "",
  recordCount: "",
  entities: [] as string[],
};

export default function ConnectCataloguePage() {
  const tenantSlug = usePathname().split("/")[1] || "";
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/connect/catalogue");
      const data = await response.json();
      if (response.ok) setProviders(data.providers);
      else setError(data.error || "Could not load the catalogue");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openProvider = (provider: Provider) => {
    setError("");
    setSelected(provider);
    setForm({
      ...emptyForm,
      authType: provider.authTypes[0] ?? "NONE",
      entities: [...provider.entities],
    });
  };

  const toggleEntity = (entity: string) => {
    setForm((current) => ({
      ...current,
      entities: current.entities.includes(entity)
        ? current.entities.filter((value) => value !== entity)
        : [...current.entities, entity],
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");

    const credentials: Record<string, string> = {};
    if (form.apiKey) credentials.apiKey = form.apiKey;
    if (form.token) credentials.token = form.token;
    if (form.username) credentials.username = form.username;
    if (form.password) credentials.password = form.password;

    const config: Record<string, unknown> = {};
    if (form.productsPath) config.productsPath = form.productsPath;
    if (form.customersPath) config.customersPath = form.customersPath;
    if (form.itemsPath) config.itemsPath = form.itemsPath;
    if (form.idField) config.idField = form.idField;
    if (form.recordCount) config.recordCount = Number(form.recordCount);

    try {
      const response = await fetch("/api/connect/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selected.id,
          name: form.name,
          authType: form.authType,
          baseUrl: selected.id === "custom-api" ? form.baseUrl : undefined,
          config,
          credentials,
          entities: form.entities,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not create the connection");
        return;
      }
      router.push(`/${tenantSlug}/connect/${data.connection.id}`);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const groups = providers.reduce<Record<string, Provider[]>>((acc, provider) => {
    (acc[provider.category] ??= []).push(provider);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-surface">
      <Header title="Integration catalogue" subtitle="Connect the systems you already use" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <Link href={`/${tenantSlug}/connect`} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Connect
        </Link>

        {error && !selected && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {loading ? (
          <Loader label="Loading catalogue..." />
        ) : (
          Object.entries(groups).map(([category, list]) => (
            <section key={category} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{category}</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((provider) => {
                  const available = provider.status === "available";
                  return (
                    <Card key={provider.id} className={available ? "" : "opacity-70"}>
                      <CardContent className="flex h-full flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-text-primary">{provider.label}</p>
                            <p className="text-xs text-text-muted">{category}</p>
                          </div>
                          <Badge variant={available ? "success" : "secondary"}>
                            {available ? "Available" : "Coming soon"}
                          </Badge>
                        </div>
                        <p className="text-sm text-text-secondary">{provider.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {provider.entities.map((entity) => (
                            <span key={entity} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-text-secondary">
                              {entity}
                            </span>
                          ))}
                          {provider.supportsFile && (
                            <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-text-secondary">CSV / Excel</span>
                          )}
                          {provider.supportsWebhooks && (
                            <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-text-secondary">Webhooks</span>
                          )}
                        </div>
                        <div className="mt-auto">
                          <Button
                            className="w-full gap-2"
                            variant={available ? "default" : "outline"}
                            disabled={!available}
                            onClick={() => openProvider(provider)}
                          >
                            <Plug className="h-4 w-4" /> {available ? "Connect" : "Not available yet"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Connect {selected.label}</h3>
                {selected.setupHint && <p className="text-xs text-text-muted">{selected.setupHint}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="max-h-[75vh] space-y-4 overflow-y-auto p-4">
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
              )}

              <Input
                label="Connection name"
                placeholder="e.g. Main shop API"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />

              {selected.authTypes.length > 1 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Authentication</label>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                    value={form.authType}
                    onChange={(event) => setForm({ ...form, authType: event.target.value })}
                  >
                    {selected.authTypes.map((type) => (
                      <option key={type} value={type}>{AUTH_LABELS[type] ?? type}</option>
                    ))}
                  </select>
                </div>
              )}

              {selected.id === "custom-api" && (
                <>
                  <Input
                    label="Base URL"
                    placeholder="https://api.example.com"
                    value={form.baseUrl}
                    onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                    required
                  />
                  <Input
                    label="Products path"
                    placeholder="/products"
                    value={form.productsPath}
                    onChange={(event) => setForm({ ...form, productsPath: event.target.value })}
                  />
                  <Input
                    label="Customers path"
                    placeholder="/customers"
                    value={form.customersPath}
                    onChange={(event) => setForm({ ...form, customersPath: event.target.value })}
                  />
                  <Input
                    label="Records path in response"
                    placeholder="data"
                    value={form.itemsPath}
                    onChange={(event) => setForm({ ...form, itemsPath: event.target.value })}
                  />
                  <Input
                    label="External id field"
                    placeholder="id"
                    value={form.idField}
                    onChange={(event) => setForm({ ...form, idField: event.target.value })}
                  />
                </>
              )}

              {selected.id === "mock" && (
                <Input
                  label="Records per sync"
                  type="number"
                  min="1"
                  max="200"
                  value={form.recordCount}
                  onChange={(event) => setForm({ ...form, recordCount: event.target.value })}
                />
              )}

              {form.authType === "API_KEY" && (
                <Input
                  label="API key"
                  type="password"
                  value={form.apiKey}
                  onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                  required
                />
              )}
              {form.authType === "BEARER" && (
                <Input
                  label="Bearer token"
                  type="password"
                  value={form.token}
                  onChange={(event) => setForm({ ...form, token: event.target.value })}
                  required
                />
              )}
              {form.authType === "BASIC" && (
                <>
                  <Input label="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
                  <Input label="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                </>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">What to sync</label>
                <div className="flex gap-4">
                  {selected.entities.map((entity) => (
                    <label key={entity} className="flex items-center gap-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={form.entities.includes(entity)}
                        onChange={() => toggleEntity(entity)}
                        className="rounded border-border"
                      />
                      {entity}
                    </label>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-text-muted">
                Credentials are encrypted with AES-256-GCM and never shown again. Connect only reads from
                the external system in this release.
              </p>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={busy || form.entities.length === 0}>
                  {busy ? "Connecting…" : "Connect"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
