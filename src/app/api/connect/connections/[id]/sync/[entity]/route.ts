import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseBody, routeError } from "@/lib/api-guards";
import { getConnection } from "@/lib/connect/connections";
import { requireConnectAccess } from "@/lib/connect/guard";
import { validateMapping } from "@/lib/connect/mapping";
import { getProvider } from "@/lib/connect/registry";
import { CONNECT_ENTITIES, MAX_UPLOAD_BYTES, isConnectEntity } from "@/lib/connect/types";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { badRequest } from "@/lib/connect/errors";

export const dynamic = "force-dynamic";

/**
 * Configure one entity's sync: field mapping, schedule, conflict policy, or a
 * spreadsheet upload for the file connector. Mapping is validated before it
 * is stored, so the engine never runs with a document the UI allowed but the
 * mapper cannot honour.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; entity: string }> }
) {
  const auth = await requireConnectAccess({ write: true });
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id, entity } = await params;
    if (!isConnectEntity(entity) || !(CONNECT_ENTITIES as readonly string[]).includes(entity)) {
      return NextResponse.json({ error: "Unsupported entity" }, { status: 400 });
    }

    const connection = await db.integrationConnection.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

    const provider = getProvider(connection.providerId);
    if (!provider || !provider.entities.includes(entity)) {
      return NextResponse.json(
        { error: `${provider?.label ?? "This integration"} cannot sync ${entity}` },
        { status: 400 }
      );
    }

    const body = await parseBody<{
      mapping?: unknown;
      frequency?: unknown;
      conflictPolicy?: unknown;
      enabled?: unknown;
      file?: unknown;
    }>(request);

    const existing = await db.integrationSyncConfig.findUnique({
      where: { connectionId_entity: { connectionId: connection.id, entity } },
    });

    let mapping = existing?.mapping ?? null;
    if (body.mapping !== undefined) {
      const validated = validateMapping(entity, body.mapping);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.errors.join("; "), errors: validated.errors }, { status: 400 });
      }
      mapping = JSON.parse(JSON.stringify(validated.mapping)) as Prisma.JsonValue;
    }

    let frequency = existing?.frequency ?? "MANUAL";
    if (body.frequency !== undefined) {
      if (body.frequency !== "MANUAL" && body.frequency !== "HOURLY") {
        return NextResponse.json({ error: "frequency must be MANUAL or HOURLY" }, { status: 400 });
      }
      frequency = body.frequency;
    }

    let conflictPolicy = existing?.conflictPolicy ?? "KEEP_EXTERNAL";
    if (body.conflictPolicy !== undefined) {
      if (body.conflictPolicy !== "KEEP_EXTERNAL" && body.conflictPolicy !== "KEEP_LOCAL") {
        return NextResponse.json({ error: "conflictPolicy must be KEEP_EXTERNAL or KEEP_LOCAL" }, { status: 400 });
      }
      conflictPolicy = body.conflictPolicy;
    }

    let enabled = existing?.enabled ?? true;
    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") {
        return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
      }
      enabled = body.enabled;
    }

    let sourceFileName = existing?.sourceFileName ?? null;
    let sourceFormat = existing?.sourceFormat ?? null;
    let sourceContent = existing?.sourceContent ?? null;

    if (body.file !== undefined) {
      if (connection.providerId !== "file" && connection.providerId !== "mock") {
        throw badRequest("This integration does not take file uploads", "CONNECT_FILE_UNSUPPORTED");
      }
      if (!body.file || typeof body.file !== "object") {
        throw badRequest("file must be an object", "CONNECT_FILE_INVALID");
      }
      const file = body.file as { fileName?: unknown; format?: unknown; content?: unknown };
      if (file.format !== "csv" && file.format !== "xlsx") {
        throw badRequest("File format must be csv or xlsx", "CONNECT_FILE_FORMAT");
      }
      if (typeof file.content !== "string" || file.content.length === 0) {
        throw badRequest("The uploaded file is empty", "CONNECT_FILE_EMPTY");
      }
      if (Math.ceil((file.content.length * 3) / 4) > MAX_UPLOAD_BYTES) {
        throw badRequest("The uploaded file is larger than 5 MB", "CONNECT_FILE_TOO_LARGE");
      }
      sourceFormat = file.format;
      sourceContent = file.content;
      sourceFileName =
        typeof file.fileName === "string" && file.fileName.trim()
          ? file.fileName.trim().slice(0, 200)
          : `upload.${file.format}`;
    }

    const config = await db.integrationSyncConfig.upsert({
      where: { connectionId_entity: { connectionId: connection.id, entity } },
      create: {
        tenantId: user.tenantId,
        connectionId: connection.id,
        entity,
        direction: "INBOUND",
        enabled,
        frequency,
        conflictPolicy,
        mapping: mapping ?? undefined,
        sourceFileName,
        sourceFormat,
        sourceContent,
        nextRunAt: frequency === "HOURLY" ? new Date() : null,
      },
      update: {
        enabled,
        frequency,
        conflictPolicy,
        mapping: mapping ?? undefined,
        sourceFileName,
        sourceFormat,
        sourceContent,
        nextRunAt: frequency === "HOURLY" ? existing?.nextRunAt ?? new Date() : null,
      },
    });

    await writeAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: AUDIT_ACTIONS.CONNECT.MAPPING_UPDATED,
      module: "connect",
      entity: "integrationSyncConfig",
      entityId: config.id,
      details: entity,
    });

    await getConnection(user.tenantId, connection.id);
    return NextResponse.json({ syncConfig: { ...config, sourceContent: undefined } });
  } catch (error) {
    return routeError("PUT /api/connect/connections/[id]/sync/[entity]", error);
  }
}
