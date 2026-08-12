import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Downtown Bistro",
      slug: "demo",
      type: "RESTAURANT",
      tier: "PRO",
    },
  });

  const location = await prisma.location.upsert({
    where: { id: "loc-main" },
    update: {},
    create: {
      id: "loc-main",
      name: "Main Store",
      address: "123 Main Street",
      tenantId: tenant.id,
    },
  });

  const register = await prisma.register.upsert({
    where: { id: "reg-1" },
    update: {},
    create: {
      id: "reg-1",
      name: "Register 1",
      locationId: location.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@lipapoint.com" },
    update: {},
    create: {
      email: "admin@lipapoint.com",
      name: "Admin User",
      password: "$2b$10$placeholder",
      role: "ADMIN",
      tenantId: tenant.id,
    },
  });

  const beverages = await prisma.category.upsert({
    where: { id: "cat-bev" },
    update: {},
    create: { id: "cat-bev", name: "Beverages", color: "#3b82f6", tenantId: tenant.id },
  });

  const food = await prisma.category.upsert({
    where: { id: "cat-food" },
    update: {},
    create: { id: "cat-food", name: "Food", color: "#10b981", tenantId: tenant.id },
  });

  const desserts = await prisma.category.upsert({
    where: { id: "cat-desserts" },
    update: {},
    create: { id: "cat-desserts", name: "Desserts", color: "#f59e0b", tenantId: tenant.id },
  });

  const spirits = await prisma.category.upsert({
    where: { id: "cat-spirits" },
    update: {},
    create: { id: "cat-spirits", name: "Spirits", color: "#8b5cf6", tenantId: tenant.id },
  });

  const products = [
    { sku: "BEV-001", name: "Espresso", price: 4.5, cost: 1.2, categoryId: beverages.id },
    { sku: "BEV-002", name: "Cappuccino", price: 5.5, cost: 1.8, categoryId: beverages.id },
    { sku: "BEV-003", name: "Latte", price: 6.0, cost: 2.0, categoryId: beverages.id },
    { sku: "BEV-004", name: "Cold Brew", price: 5.0, cost: 1.5, categoryId: beverages.id },
    { sku: "FOD-001", name: "Grilled Chicken", price: 18.5, cost: 7.5, categoryId: food.id },
    { sku: "FOD-002", name: "Caesar Salad", price: 14.0, cost: 4.5, categoryId: food.id },
    { sku: "FOD-003", name: "Beef Burger", price: 16.0, cost: 6.0, categoryId: food.id },
    { sku: "FOD-004", name: "Fish & Chips", price: 15.5, cost: 5.5, categoryId: food.id },
    { sku: "FOD-005", name: "Pasta Carbonara", price: 17.0, cost: 5.0, categoryId: food.id },
    { sku: "DST-001", name: "Cheesecake", price: 9.0, cost: 3.0, categoryId: desserts.id },
    { sku: "DST-002", name: "Tiramisu", price: 10.0, cost: 3.5, categoryId: desserts.id },
    { sku: "SPR-001", name: "Whiskey Sour", price: 12.0, cost: 4.0, categoryId: spirits.id },
    { sku: "SPR-002", name: "Gin & Tonic", price: 11.0, cost: 3.5, categoryId: spirits.id },
    { sku: "SPR-003", name: "Mojito", price: 13.0, cost: 4.5, categoryId: spirits.id },
    { sku: "SPR-004", name: "Margarita", price: 12.5, cost: 4.0, categoryId: spirits.id },
    { sku: "SPC-001", name: "Chef Special", price: 24.0, cost: 10.0, categoryId: food.id },
  ];

  for (const product of products) {
    const created = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: {
        ...product,
        tenantId: tenant.id,
      },
    });

    await prisma.stock.upsert({
      where: {
        productId_locationId: {
          productId: created.id,
          locationId: location.id,
        },
      },
      update: {},
      create: {
        productId: created.id,
        locationId: location.id,
        quantity: product.sku.startsWith("BEV") || product.sku.startsWith("SPR") ? 999 : 50,
      },
    });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
