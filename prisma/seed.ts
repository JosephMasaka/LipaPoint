import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const hashedPassword = await bcrypt.hash("password123", 12);

  const tenant = await prisma.tenant.create({
    data: {
      name: "Demo Restaurant",
      slug: "demo-restaurant",
      type: "RESTAURANT",
      tier: "PROFESSIONAL",
      email: "admin@demo.co.ke",
      phone: "+254712345678",
      currency: "KES",
      taxRate: 16,
      receiptHeader: "Demo Restaurant\nNairobi, Kenya\nTel: +254712345678",
      receiptFooter: "Thank you for dining with us!",
      isActive: true,
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: "John Mwangi",
      email: "admin@demo.co.ke",
      phone: "+254712345678",
      password: hashedPassword,
      role: "OWNER",
      tenantId: tenant.id,
    },
  });

  await prisma.user.create({
    data: {
      name: "Jane Wanjiku",
      email: "cashier@demo.co.ke",
      phone: "+254711223344",
      password: hashedPassword,
      role: "CASHIER",
      tenantId: tenant.id,
    },
  });

  await prisma.user.create({
    data: {
      name: "Peter Ochieng",
      email: "stock@demo.co.ke",
      phone: "+254700112233",
      password: hashedPassword,
      role: "STOCK_KEEPER",
      tenantId: tenant.id,
    },
  });

  const location = await prisma.location.create({
    data: {
      name: "Main Branch",
      address: "Kenyatta Avenue, Nairobi",
      phone: "+254712345678",
      tenantId: tenant.id,
    },
  });

  await prisma.register.create({
    data: {
      name: "Register 1",
      locationId: location.id,
    },
  });

  const categories = await Promise.all([
    prisma.category.create({ data: { name: "Beverages", color: "#f59e0b", tenantId: tenant.id } }),
    prisma.category.create({ data: { name: "Main Course", color: "#ef4444", tenantId: tenant.id } }),
    prisma.category.create({ data: { name: "Appetizers", color: "#10b981", tenantId: tenant.id } }),
    prisma.category.create({ data: { name: "Desserts", color: "#8b5cf6", tenantId: tenant.id } }),
    prisma.category.create({ data: { name: "Drinks", color: "#3b82f6", tenantId: tenant.id } }),
  ]);

  const products = [
    { name: "Nyama Choma", sku: "NC-001", price: 1200, cost: 600, categoryId: categories[1].id },
    { name: "Ugali & Sukuma", sku: "US-001", price: 350, cost: 120, categoryId: categories[1].id },
    { name: "Pilau", sku: "PL-001", price: 500, cost: 200, categoryId: categories[1].id },
    { name: "Chapati", sku: "CH-001", price: 50, cost: 20, categoryId: categories[2].id },
    { name: "Samosa", sku: "SM-001", price: 80, cost: 30, categoryId: categories[2].id },
    { name: "Mandazi", sku: "MZ-001", price: 30, cost: 10, categoryId: categories[3].id },
    { name: "Tusker Lager", sku: "TL-001", price: 300, cost: 180, categoryId: categories[0].id },
    { name: "Coca-Cola 500ml", sku: "CC-001", price: 100, cost: 60, categoryId: categories[4].id },
    { name: "Fresh Juice", sku: "FJ-001", price: 250, cost: 100, categoryId: categories[4].id },
    { name: "Kenyan Tea", sku: "KT-001", price: 80, cost: 20, categoryId: categories[0].id },
    { name: "Tilapia Fry", sku: "TF-001", price: 800, cost: 400, categoryId: categories[1].id },
    { name: "Chicken Wings", sku: "CW-001", price: 650, cost: 300, categoryId: categories[2].id },
  ];

  for (const p of products) {
    const product = await prisma.product.create({
      data: { ...p, tenantId: tenant.id },
    });

    await prisma.stock.create({
      data: {
        productId: product.id,
        locationId: location.id,
        quantity: Math.floor(Math.random() * 80) + 20,
      },
    });
  }

  console.log(`\nSeed completed!`);
  console.log(`Created tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Created owner: ${owner.email}`);
  console.log(`Created ${products.length} products with stock`);
  console.log(`\nLogin credentials:`);
  console.log(`  URL: http://localhost:3000/login`);
  console.log(`  Email: admin@demo.co.ke`);
  console.log(`  Password: password123`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
