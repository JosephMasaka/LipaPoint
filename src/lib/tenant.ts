import { prisma } from "./db";
import { cache } from "react";

export const getTenant = cache(async (slug: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      locations: {
        include: { registers: true },
      },
    },
  });
  return tenant;
});

export const getTenantProducts = cache(
  async (tenantId: string, categoryId?: string) => {
    return prisma.product.findMany({
      where: {
        tenantId,
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        category: true,
        stocks: true,
      },
      orderBy: { name: "asc" },
    });
  }
);

export const getTenantCategories = cache(async (tenantId: string) => {
  return prisma.category.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });
});

export const getTenantOrders = cache(
  async (tenantId: string, limit = 50) => {
    return prisma.order.findMany({
      where: { tenantId },
      include: {
        items: { include: { product: true } },
        register: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
);
