import { NextResponse } from "next/server";

/**
 * Connectivity probe for Offline Mode (src/components/offline-indicator.tsx).
 *
 * `navigator.onLine` only reports a link-local guess: a till behind a dead
 * uplink or a captive portal still says "online" while every API call fails.
 * The indicator probes this route (no auth, no cache) so "offline" means the
 * server is actually unreachable and the queue is shown honestly.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    { ok: true, time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
