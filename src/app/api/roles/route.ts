import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const SYSTEM_ROLES = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "STOCK_KEEPER", "KITCHEN"];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  OWNER: ["pos", "orders", "tabs", "inventory", "stock_management", "analytics", "staff", "settings", "expenses"],
  ADMIN: ["pos", "orders", "tabs", "inventory", "stock_management", "analytics", "staff", "settings", "expenses"],
  MANAGER: ["pos", "orders", "tabs", "inventory", "stock_management", "analytics", "expenses"],
  CASHIER: ["pos", "orders", "tabs"],
  STOCK_KEEPER: ["inventory", "stock_management", "expenses"],
  KITCHEN: ["orders"],
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const saved = await db.rolePermission.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "asc" },
    });

    const roles = SYSTEM_ROLES.map(role => {
      const existing = saved.find(s => s.role === role);
      return {
        role,
        permissions: existing?.permissions || DEFAULT_PERMISSIONS[role] || [],
        description: existing?.description || null,
        isSystem: true,
        id: existing?.id || null,
      };
    });

    const customRoles = saved.filter(s => !SYSTEM_ROLES.includes(s.role)).map(s => ({
      role: s.role,
      permissions: s.permissions,
      description: s.description,
      isSystem: false,
      id: s.id,
    }));

    return NextResponse.json([...roles, ...customRoles]);
  } catch (error) {
    console.error("GET /api/roles error:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Only owners and admins can manage roles" }, { status: 403 });
    }

    const body = await request.json();
    const { role, permissions, description } = body;

    if (!role || !Array.isArray(permissions)) {
      return NextResponse.json({ error: "Role and permissions array required" }, { status: 400 });
    }

    if (role === "OWNER") {
      return NextResponse.json({ error: "Owner permissions cannot be modified" }, { status: 403 });
    }

    const saved = await db.rolePermission.upsert({
      where: { tenantId_role: { tenantId: user.tenantId, role } },
      update: { permissions, description: description || null },
      create: {
        role,
        permissions,
        description: description || null,
        isSystem: SYSTEM_ROLES.includes(role),
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json(saved);
  } catch (error) {
    console.error("PUT /api/roles error:", error);
    return NextResponse.json({ error: "Failed to save role permissions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Only owners and admins can create roles" }, { status: 403 });
    }

    const body = await request.json();
    const { name, permissions, description } = body;

    if (!name || !Array.isArray(permissions)) {
      return NextResponse.json({ error: "Name and permissions array required" }, { status: 400 });
    }

    const roleKey = name.toUpperCase().replace(/\s+/g, "_");

    if (SYSTEM_ROLES.includes(roleKey)) {
      return NextResponse.json({ error: "Cannot create a role with a system role name" }, { status: 400 });
    }

    const existing = await db.rolePermission.findUnique({
      where: { tenantId_role: { tenantId: user.tenantId, role: roleKey } },
    });
    if (existing) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
    }

    const created = await db.rolePermission.create({
      data: {
        role: roleKey,
        permissions,
        description: description || null,
        isSystem: false,
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/roles error:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Only owners and admins can delete roles" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const role = searchParams.get("role");

    if (!role) {
      return NextResponse.json({ error: "Role parameter required" }, { status: 400 });
    }

    if (SYSTEM_ROLES.includes(role)) {
      return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 403 });
    }

    const existing = await db.rolePermission.findUnique({
      where: { tenantId_role: { tenantId: user.tenantId, role } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    await db.rolePermission.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/roles error:", error);
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}
