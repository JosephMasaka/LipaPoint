import { PrismaClient, Product } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function generateOrderNo() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "ORD-";
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function main() {
  console.log("🌱 Seeding LipaPoint database (SAP structure)...\n");

  await prisma.staffSchedule.deleteMany();
  await prisma.queueEntry.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.table.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockRecord.deleteMany();
  await prisma.dailySummary.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.productUoM.deleteMany();
  await prisma.product.deleteMany();
  await prisma.unitConversion.deleteMany();
  await prisma.unitOfMeasure.deleteMany();
  await prisma.category.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.register.deleteMany();
  await prisma.location.deleteMany();
  await prisma.session.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.demoRequest.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const hash = await bcrypt.hash("password123", 10);

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT 1: DUKA KUU WHOLESALE & RETAIL (Supermarket)
  // ═══════════════════════════════════════════════════════════════════════════
  const duka = await prisma.tenant.create({
    data: {
      name: "Duka Kuu Wholesale & Retail",
      slug: "duka-kuu",
      type: "SUPERMARKET",
      tier: "PROFESSIONAL",
      email: "info@dukakuu.co.ke",
      phone: "+254 722 100 200",
      address: "Moi Avenue, Nairobi",
      city: "Nairobi",
      currency: "KES",
      taxRate: 16.0,
      receiptHeader: "DUKA KUU WHOLESALE & RETAIL",
      receiptFooter: "Thank you! Karibu tena.",
    },
  });

  const dukaOwner = await prisma.user.create({
    data: { email: "admin@dukakuu.co.ke", name: "James Mwangi", phone: "+254 722 100 200", password: hash, role: "OWNER", tenantId: duka.id },
  });
  const dukaCashier = await prisma.user.create({
    data: { email: "cashier@dukakuu.co.ke", name: "Grace Njeri", phone: "+254 733 200 300", password: hash, role: "CASHIER", tenantId: duka.id },
  });
  await prisma.user.create({
    data: { email: "stock@dukakuu.co.ke", name: "Peter Ochieng", phone: "+254 711 300 400", password: hash, role: "STOCK_KEEPER", tenantId: duka.id },
  });

  const dukaLocation = await prisma.location.create({
    data: { name: "Main Store", address: "Moi Avenue, Nairobi", tenantId: duka.id },
  });
  await prisma.register.create({ data: { name: "Register 1", locationId: dukaLocation.id } });
  await prisma.register.create({ data: { name: "Register 2", locationId: dukaLocation.id } });

  // Units of Measure
  const dukaUnits = await Promise.all([
    prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Dozen", abbreviation: "dz", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Crate", abbreviation: "crt", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Carton", abbreviation: "ctn", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Kilogram", abbreviation: "kg", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Gram", abbreviation: "g", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Litre", abbreviation: "L", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Millilitre", abbreviation: "ml", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Packet", abbreviation: "pkt", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Bale", abbreviation: "bale", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Bag", abbreviation: "bag", tenantId: duka.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Box", abbreviation: "box", tenantId: duka.id } }),
  ]);
  const [pc, dz, crt, ctn, kg, g, L, ml, pkt, bale, bag, box] = dukaUnits;

  // Conversions
  await prisma.unitConversion.createMany({
    data: [
      { fromUnitId: dz.id, toUnitId: pc.id, factor: 12 },
      { fromUnitId: crt.id, toUnitId: pc.id, factor: 24 },
      { fromUnitId: ctn.id, toUnitId: pc.id, factor: 48 },
      { fromUnitId: box.id, toUnitId: pc.id, factor: 24 },
      { fromUnitId: kg.id, toUnitId: g.id, factor: 1000 },
      { fromUnitId: L.id, toUnitId: ml.id, factor: 1000 },
      { fromUnitId: bale.id, toUnitId: pkt.id, factor: 12 },
    ],
  });

  // Categories
  const dukaCats = await Promise.all([
    prisma.category.create({ data: { name: "Beverages", color: "#f59e0b", tenantId: duka.id } }),
    prisma.category.create({ data: { name: "Cooking & Baking", color: "#ef4444", tenantId: duka.id } }),
    prisma.category.create({ data: { name: "Dairy & Fresh", color: "#10b981", tenantId: duka.id } }),
    prisma.category.create({ data: { name: "Grains & Cereals", color: "#8b5cf6", tenantId: duka.id } }),
    prisma.category.create({ data: { name: "Personal Care", color: "#ec4899", tenantId: duka.id } }),
    prisma.category.create({ data: { name: "Snacks", color: "#f97316", tenantId: duka.id } }),
    prisma.category.create({ data: { name: "Household", color: "#06b6d4", tenantId: duka.id } }),
  ]);
  const [beverages, cooking, dairy, grains, personalCare, snacks, household] = dukaCats;

  // Products with images and UoM pricing (dimensions of pay)
  const dukaProducts = [
    { name: "Coca-Cola 500ml", sku: "DK-BEV-001", price: 80, cost: 55, cat: beverages.id, image: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=200", uoms: [{ unit: dz, factor: 12, price: 900, cost: 630 }, { unit: crt, factor: 24, price: 1750, cost: 1260 }] },
    { name: "Fanta Orange 500ml", sku: "DK-BEV-002", price: 80, cost: 55, cat: beverages.id, image: "https://images.unsplash.com/photo-1624517452488-04869289c4ca?w=200", uoms: [{ unit: dz, factor: 12, price: 900, cost: 630 }, { unit: crt, factor: 24, price: 1750, cost: 1260 }] },
    { name: "Sprite 500ml", sku: "DK-BEV-003", price: 80, cost: 55, cat: beverages.id, image: "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=200", uoms: [{ unit: dz, factor: 12, price: 900, cost: 630 }] },
    { name: "Dasani Water 1L", sku: "DK-BEV-004", price: 60, cost: 35, cat: beverages.id, image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200", uoms: [{ unit: crt, factor: 24, price: 1300, cost: 800 }] },
    { name: "Tusker Lager 500ml", sku: "DK-BEV-005", price: 250, cost: 180, cat: beverages.id, image: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200", uoms: [{ unit: crt, factor: 24, price: 5600, cost: 4100 }] },
    { name: "Brookside Milk 500ml", sku: "DK-DAI-001", price: 70, cost: 50, cat: dairy.id, image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=200", uoms: [{ unit: crt, factor: 24, price: 1580, cost: 1140 }] },
    { name: "KCC Butter 250g", sku: "DK-DAI-002", price: 320, cost: 250, cat: dairy.id, image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=200", uoms: [] },
    { name: "Ndovu Flour 2kg", sku: "DK-GRN-001", price: 180, cost: 130, cat: grains.id, image: "https://images.unsplash.com/photo-1556910096-6f5e72db6803?w=200", uoms: [{ unit: bale, factor: 12, price: 2000, cost: 1480 }] },
    { name: "Unga Ugali 2kg", sku: "DK-GRN-002", price: 160, cost: 115, cat: grains.id, image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=200", uoms: [{ unit: bale, factor: 12, price: 1800, cost: 1300 }] },
    { name: "Maharaja Rice 5kg", sku: "DK-GRN-003", price: 650, cost: 500, cat: grains.id, image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200", uoms: [{ unit: bag, factor: 10, price: 6000, cost: 4800 }] },
    { name: "Golden Fry Cooking Oil 2L", sku: "DK-COK-001", price: 580, cost: 420, cat: cooking.id, image: "https://images.unsplash.com/photo-1474979266404-7f28f2a0c767?w=200", uoms: [{ unit: box, factor: 12, price: 6500, cost: 4800 }] },
    { name: "Rina Cooking Fat 1kg", sku: "DK-COK-002", price: 280, cost: 200, cat: cooking.id, image: "https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?w=200", uoms: [{ unit: ctn, factor: 24, price: 6300, cost: 4600 }] },
    { name: "Royco Mchuzi Mix 100g", sku: "DK-COK-003", price: 50, cost: 32, cat: cooking.id, image: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200", uoms: [{ unit: box, factor: 48, price: 2200, cost: 1450 }] },
    { name: "Omo Washing Powder 500g", sku: "DK-HH-001", price: 180, cost: 130, cat: household.id, image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=200", uoms: [{ unit: bale, factor: 12, price: 2000, cost: 1480 }, { unit: ctn, factor: 48, price: 7800, cost: 5900 }] },
    { name: "Harpic Toilet Cleaner 500ml", sku: "DK-HH-002", price: 250, cost: 180, cat: household.id, image: "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=200", uoms: [{ unit: box, factor: 12, price: 2800, cost: 2050 }] },
    { name: "Colgate Toothpaste 100ml", sku: "DK-PC-001", price: 150, cost: 100, cat: personalCare.id, image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=200", uoms: [{ unit: box, factor: 24, price: 3300, cost: 2280 }] },
    { name: "Dettol Soap 175g", sku: "DK-PC-002", price: 120, cost: 80, cat: personalCare.id, image: "https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=200", uoms: [{ unit: box, factor: 48, price: 5200, cost: 3650 }] },
    { name: "Cadbury Dairy Milk 100g", sku: "DK-SNK-001", price: 200, cost: 140, cat: snacks.id, image: "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=200", uoms: [{ unit: box, factor: 24, price: 4500, cost: 3200 }] },
    { name: "Tropical Heat Crisps 100g", sku: "DK-SNK-002", price: 80, cost: 55, cat: snacks.id, image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=200", uoms: [{ unit: ctn, factor: 48, price: 3500, cost: 2500 }] },
    { name: "Sugar 1kg", sku: "DK-COK-004", price: 180, cost: 140, cat: cooking.id, image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=200", uoms: [{ unit: bag, factor: 50, price: 8500, cost: 6700 }] },
  ];

  const createdDukaProducts: Product[] = [];
  for (const p of dukaProducts) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, price: p.price, cost: p.cost,
        image: p.image, baseUnitId: pc.id, tenantId: duka.id, categoryId: p.cat,
      },
    });
    createdDukaProducts.push(product);

    if (p.uoms.length > 0) {
      await prisma.productUoM.createMany({
        data: p.uoms.map((u, idx) => ({
          productId: product.id, unitId: u.unit.id,
          conversionFactor: u.factor, price: u.price, cost: u.cost,
          isDefault: idx === 0,
        })),
      });
    }

    await prisma.stock.create({
      data: { quantity: 100 + Math.floor(Math.random() * 200), productId: product.id, locationId: dukaLocation.id },
    });
  }

  // Stock records (3-day carry-forward pattern)
  for (const product of createdDukaProducts.slice(0, 10)) {
    const initialStock = 150;
    const day1Sold = 10 + Math.floor(Math.random() * 20);
    const day1Closing = initialStock - day1Sold;
    const day2Added = 30 + Math.floor(Math.random() * 20);
    const day2Sold = 15 + Math.floor(Math.random() * 15);
    const day2Closing = day1Closing + day2Added - day2Sold;
    const day3Sold = 8 + Math.floor(Math.random() * 12);
    const day3Closing = day2Closing - day3Sold;

    await prisma.stockRecord.createMany({
      data: [
        { date: dateOnly(daysAgo(3)), openingStock: initialStock, addedStock: 0, soldStock: day1Sold, closingStock: day1Closing, productId: product.id, locationId: dukaLocation.id, tenantId: duka.id },
        { date: dateOnly(daysAgo(2)), openingStock: day1Closing, addedStock: day2Added, soldStock: day2Sold, closingStock: day2Closing, productId: product.id, locationId: dukaLocation.id, tenantId: duka.id },
        { date: dateOnly(daysAgo(1)), openingStock: day2Closing, addedStock: 0, soldStock: day3Sold, closingStock: day3Closing, productId: product.id, locationId: dukaLocation.id, tenantId: duka.id },
      ],
    });
  }

  // Sample orders with transactions
  const dukaOrders = [
    { items: [{ idx: 0, qty: 2 }, { idx: 7, qty: 1 }], method: "CASH" as const },
    { items: [{ idx: 1, qty: 3 }, { idx: 5, qty: 2 }, { idx: 12, qty: 4 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 3, qty: 1 }, { idx: 9, qty: 1 }], method: "CASH" as const },
    { items: [{ idx: 10, qty: 1 }, { idx: 11, qty: 2 }], method: "CARD" as const },
    { items: [{ idx: 4, qty: 6 }, { idx: 13, qty: 2 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 14, qty: 1 }, { idx: 15, qty: 2 }, { idx: 16, qty: 3 }], method: "CASH" as const },
    { items: [{ idx: 17, qty: 2 }, { idx: 18, qty: 5 }], method: "PDQ" as const },
  ];

  for (const orderData of dukaOrders) {
    const orderItems = orderData.items.map(i => {
      const p = createdDukaProducts[i.idx];
      return { productId: p.id, quantity: i.qty, unitPrice: p.price, total: p.price * i.qty, baseQuantity: i.qty };
    });
    const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
    const taxAmount = subtotal * 0.16;
    const total = subtotal + taxAmount;
    const orderNo = generateOrderNo();

    const order = await prisma.order.create({
      data: {
        orderNo, status: "COMPLETED", subtotal, taxAmount, total, discount: 0,
        paymentMethod: orderData.method, paymentStatus: "COMPLETED",
        tenantId: duka.id, locationId: dukaLocation.id, userId: dukaCashier.id,
        items: { create: orderItems },
      },
    });

    await prisma.transaction.create({
      data: {
        type: "SALE", amount: total, method: orderData.method, status: "COMPLETED",
        reference: `TXN-${orderNo.replace("ORD-", "")}`,
        description: `Sale ${orderNo}`, tenantId: duka.id, orderId: order.id, userId: dukaCashier.id,
      },
    });
  }

  // Daily expenses
  await prisma.expense.createMany({
    data: [
      { date: dateOnly(daysAgo(3)), category: "Rent", description: "Monthly shop rent", amount: 45000, tenantId: duka.id, locationId: dukaLocation.id, userId: dukaOwner.id, isRecurring: true },
      { date: dateOnly(daysAgo(2)), category: "Utilities", description: "Electricity bill - KPLC", amount: 8500, tenantId: duka.id, locationId: dukaLocation.id, userId: dukaOwner.id, receiptNo: "KPLC-2024-08" },
      { date: dateOnly(daysAgo(2)), category: "Transport", description: "Delivery from warehouse", amount: 3500, supplier: "City Movers", tenantId: duka.id, locationId: dukaLocation.id, userId: dukaOwner.id },
      { date: dateOnly(daysAgo(1)), category: "Supplies", description: "Receipt paper rolls", amount: 1200, supplier: "Office Mart", tenantId: duka.id, locationId: dukaLocation.id, userId: dukaOwner.id, receiptNo: "OM-4521" },
      { date: dateOnly(daysAgo(1)), category: "Salaries", description: "Casual staff wages", amount: 2000, tenantId: duka.id, locationId: dukaLocation.id, userId: dukaOwner.id },
      { date: dateOnly(daysAgo(0)), category: "Maintenance", description: "Fridge repair", amount: 4500, supplier: "CoolTech Services", tenantId: duka.id, locationId: dukaLocation.id, userId: dukaOwner.id, receiptNo: "CT-089" },
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT 2: MZINGA SPORTS BAR
  // ═══════════════════════════════════════════════════════════════════════════
  const mzinga = await prisma.tenant.create({
    data: {
      name: "Mzinga Sports Bar",
      slug: "mzinga-bar",
      type: "BAR",
      tier: "STARTER",
      email: "info@mzingabar.co.ke",
      phone: "+254 720 500 600",
      address: "Kenyatta Road, Thika",
      city: "Thika",
      currency: "KES",
      taxRate: 16.0,
      receiptHeader: "MZINGA SPORTS BAR",
      receiptFooter: "Cheers! See you next time.",
    },
  });

  const mzingaOwner = await prisma.user.create({
    data: { email: "admin@mzingabar.co.ke", name: "Kevin Otieno", phone: "+254 720 500 600", password: hash, role: "OWNER", tenantId: mzinga.id },
  });
  const mzingaCashier = await prisma.user.create({
    data: { email: "cashier@mzingabar.co.ke", name: "Ann Wanjiku", phone: "+254 712 600 700", password: hash, role: "CASHIER", tenantId: mzinga.id },
  });

  const mzingaLocation = await prisma.location.create({
    data: { name: "Main Bar", address: "Kenyatta Road, Thika", tenantId: mzinga.id },
  });
  await prisma.register.create({ data: { name: "Bar Counter", locationId: mzingaLocation.id } });

  // Bar-specific units
  const mzingaUnits = await Promise.all([
    prisma.unitOfMeasure.create({ data: { name: "Bottle", abbreviation: "btl", tenantId: mzinga.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Tot", abbreviation: "tot", tenantId: mzinga.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Double", abbreviation: "dbl", tenantId: mzinga.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Glass", abbreviation: "gls", tenantId: mzinga.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Jug", abbreviation: "jug", tenantId: mzinga.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Crate", abbreviation: "crt", tenantId: mzinga.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: mzinga.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Pitcher", abbreviation: "pch", tenantId: mzinga.id } }),
  ]);
  const [mBtl, mTot, mDbl, mGls, mJug, mCrt, mPc, mPch] = mzingaUnits;

  await prisma.unitConversion.createMany({
    data: [
      { fromUnitId: mCrt.id, toUnitId: mBtl.id, factor: 24 },
      { fromUnitId: mJug.id, toUnitId: mGls.id, factor: 5 },
      { fromUnitId: mPch.id, toUnitId: mGls.id, factor: 10 },
    ],
  });

  const mzingaCats = await Promise.all([
    prisma.category.create({ data: { name: "Beers", color: "#f59e0b", tenantId: mzinga.id } }),
    prisma.category.create({ data: { name: "Spirits", color: "#8b5cf6", tenantId: mzinga.id } }),
    prisma.category.create({ data: { name: "Soft Drinks", color: "#10b981", tenantId: mzinga.id } }),
    prisma.category.create({ data: { name: "Wines", color: "#ec4899", tenantId: mzinga.id } }),
    prisma.category.create({ data: { name: "Snacks", color: "#f97316", tenantId: mzinga.id } }),
  ]);
  const [mBeers, mSpirits, mSoft, mWines, mSnacks] = mzingaCats;

  const mzingaProducts = [
    { name: "Tusker Lager", sku: "MZ-BER-001", price: 280, cost: 180, unit: mBtl, cat: mBeers.id, image: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200", uoms: [{ unit: mCrt, factor: 24, price: 6200, cost: 4100 }] },
    { name: "White Cap", sku: "MZ-BER-002", price: 270, cost: 175, unit: mBtl, cat: mBeers.id, image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=200", uoms: [{ unit: mCrt, factor: 24, price: 6000, cost: 4000 }] },
    { name: "Guinness", sku: "MZ-BER-003", price: 320, cost: 220, unit: mBtl, cat: mBeers.id, image: "https://images.unsplash.com/photo-1594818379496-da1e345b0ded?w=200", uoms: [{ unit: mCrt, factor: 24, price: 7200, cost: 5000 }] },
    { name: "Heineken", sku: "MZ-BER-004", price: 350, cost: 240, unit: mBtl, cat: mBeers.id, image: "https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=200", uoms: [{ unit: mCrt, factor: 24, price: 7800, cost: 5500 }] },
    { name: "Pilsner", sku: "MZ-BER-005", price: 260, cost: 170, unit: mBtl, cat: mBeers.id, image: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=200", uoms: [] },
    { name: "Johnnie Walker Red", sku: "MZ-SPR-001", price: 200, cost: 80, unit: mTot, cat: mSpirits.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200", uoms: [{ unit: mDbl, factor: 2, price: 380, cost: 160 }, { unit: mBtl, factor: 28, price: 3500, cost: 2200 }] },
    { name: "Jack Daniel's", sku: "MZ-SPR-002", price: 250, cost: 100, unit: mTot, cat: mSpirits.id, image: "https://images.unsplash.com/photo-1609767307262-6cf24f22d2e7?w=200", uoms: [{ unit: mDbl, factor: 2, price: 480, cost: 200 }, { unit: mBtl, factor: 28, price: 5000, cost: 2800 }] },
    { name: "Smirnoff Vodka", sku: "MZ-SPR-003", price: 180, cost: 70, unit: mTot, cat: mSpirits.id, image: "https://images.unsplash.com/photo-1607622750671-6cd9a99eabd1?w=200", uoms: [{ unit: mDbl, factor: 2, price: 340, cost: 140 }, { unit: mBtl, factor: 28, price: 3200, cost: 1900 }] },
    { name: "Captain Morgan", sku: "MZ-SPR-004", price: 200, cost: 80, unit: mTot, cat: mSpirits.id, image: "https://images.unsplash.com/photo-1598018553943-29ace5ae8fa1?w=200", uoms: [{ unit: mDbl, factor: 2, price: 380, cost: 160 }] },
    { name: "Coca-Cola 300ml", sku: "MZ-SFT-001", price: 100, cost: 50, unit: mPc, cat: mSoft.id, image: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=200", uoms: [{ unit: mCrt, factor: 24, price: 2200, cost: 1150 }] },
    { name: "Sprite 300ml", sku: "MZ-SFT-002", price: 100, cost: 50, unit: mPc, cat: mSoft.id, image: "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=200", uoms: [] },
    { name: "Red Bull 250ml", sku: "MZ-SFT-003", price: 350, cost: 220, unit: mPc, cat: mSoft.id, image: "https://images.unsplash.com/photo-1613313440685-b70af080fd7c?w=200", uoms: [] },
    { name: "Four Cousins Sweet Red", sku: "MZ-WIN-001", price: 250, cost: 100, unit: mGls, cat: mWines.id, image: "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=200", uoms: [{ unit: mBtl, factor: 6, price: 1400, cost: 580 }] },
    { name: "Pringles Original 165g", sku: "MZ-SNK-001", price: 350, cost: 250, unit: mPc, cat: mSnacks.id, image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=200", uoms: [] },
    { name: "Roasted Peanuts 200g", sku: "MZ-SNK-002", price: 150, cost: 80, unit: mPc, cat: mSnacks.id, image: "https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=200", uoms: [] },
  ];

  const createdMzingaProducts: Product[] = [];
  for (const p of mzingaProducts) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, price: p.price, cost: p.cost,
        image: p.image, baseUnitId: p.unit.id, tenantId: mzinga.id, categoryId: p.cat,
      },
    });
    createdMzingaProducts.push(product);

    if (p.uoms.length > 0) {
      await prisma.productUoM.createMany({
        data: p.uoms.map((u, idx) => ({
          productId: product.id, unitId: u.unit.id,
          conversionFactor: u.factor, price: u.price, cost: u.cost,
          isDefault: idx === 0,
        })),
      });
    }

    await prisma.stock.create({
      data: { quantity: 48 + Math.floor(Math.random() * 100), productId: product.id, locationId: mzingaLocation.id },
    });
  }

  // Mzinga orders
  const mzingaOrders = [
    { items: [{ idx: 0, qty: 3 }, { idx: 5, qty: 2 }, { idx: 9, qty: 2 }], method: "CASH" as const },
    { items: [{ idx: 6, qty: 1 }, { idx: 3, qty: 2 }, { idx: 11, qty: 1 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 1, qty: 4 }, { idx: 7, qty: 3 }, { idx: 13, qty: 1 }], method: "CASH" as const },
    { items: [{ idx: 2, qty: 2 }, { idx: 8, qty: 2 }, { idx: 14, qty: 2 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 4, qty: 5 }, { idx: 12, qty: 2 }], method: "CARD" as const },
  ];

  for (const orderData of mzingaOrders) {
    const orderItems = orderData.items.map(i => {
      const p = createdMzingaProducts[i.idx];
      return { productId: p.id, quantity: i.qty, unitPrice: p.price, total: p.price * i.qty, baseQuantity: i.qty };
    });
    const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
    const taxAmount = subtotal * 0.16;
    const total = subtotal + taxAmount;
    const orderNo = generateOrderNo();

    const order = await prisma.order.create({
      data: {
        orderNo, status: "COMPLETED", subtotal, taxAmount, total, discount: 0,
        paymentMethod: orderData.method, paymentStatus: "COMPLETED",
        tenantId: mzinga.id, locationId: mzingaLocation.id, userId: mzingaCashier.id,
        items: { create: orderItems },
      },
    });

    await prisma.transaction.create({
      data: {
        type: "SALE", amount: total, method: orderData.method, status: "COMPLETED",
        reference: `TXN-${orderNo.replace("ORD-", "")}`,
        description: `Sale ${orderNo}`, tenantId: mzinga.id, orderId: order.id, userId: mzingaCashier.id,
      },
    });
  }

  await prisma.expense.createMany({
    data: [
      { date: dateOnly(daysAgo(2)), category: "Rent", description: "Monthly bar rent", amount: 35000, tenantId: mzinga.id, locationId: mzingaLocation.id, userId: mzingaOwner.id, isRecurring: true },
      { date: dateOnly(daysAgo(1)), category: "Entertainment", description: "DSTV subscription", amount: 4500, tenantId: mzinga.id, locationId: mzingaLocation.id, userId: mzingaOwner.id, isRecurring: true },
      { date: dateOnly(daysAgo(1)), category: "Utilities", description: "Water bill", amount: 2500, tenantId: mzinga.id, locationId: mzingaLocation.id, userId: mzingaOwner.id },
      { date: dateOnly(daysAgo(0)), category: "Supplies", description: "Straws and serviettes", amount: 800, supplier: "Party Supplies KE", tenantId: mzinga.id, locationId: mzingaLocation.id, userId: mzingaOwner.id },
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT 3: SAVANNA LOUNGE (Enterprise - upscale)
  // ═══════════════════════════════════════════════════════════════════════════
  const savanna = await prisma.tenant.create({
    data: {
      name: "Savanna Lounge",
      slug: "savanna-lounge",
      type: "BAR",
      tier: "ENTERPRISE",
      email: "info@savannalounge.co.ke",
      phone: "+254 700 800 900",
      address: "Westlands, Nairobi",
      city: "Nairobi",
      currency: "KES",
      taxRate: 16.0,
      receiptHeader: "SAVANNA LOUNGE",
      receiptFooter: "Asante! Experience elegance.",
    },
  });

  const savannaOwner = await prisma.user.create({
    data: { email: "admin@savannalounge.co.ke", name: "Diana Kamau", phone: "+254 700 800 900", password: hash, role: "OWNER", tenantId: savanna.id },
  });
  const savannaCashier = await prisma.user.create({
    data: { email: "cashier@savannalounge.co.ke", name: "Mike Njoroge", phone: "+254 745 100 200", password: hash, role: "CASHIER", tenantId: savanna.id },
  });
  await prisma.user.create({
    data: { email: "manager@savannalounge.co.ke", name: "Lucy Adhiambo", phone: "+254 756 200 300", password: hash, role: "MANAGER", tenantId: savanna.id },
  });

  const savannaLocation = await prisma.location.create({
    data: { name: "Savanna Main", address: "Westlands, Nairobi", tenantId: savanna.id },
  });
  const savannaVIP = await prisma.location.create({
    data: { name: "VIP Lounge", address: "Westlands, Nairobi", tenantId: savanna.id },
  });
  await prisma.register.create({ data: { name: "Main Bar", locationId: savannaLocation.id } });
  await prisma.register.create({ data: { name: "VIP Bar", locationId: savannaVIP.id } });

  // Savanna units
  const savannaUnits = await Promise.all([
    prisma.unitOfMeasure.create({ data: { name: "Bottle", abbreviation: "btl", tenantId: savanna.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Tot", abbreviation: "tot", tenantId: savanna.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Double", abbreviation: "dbl", tenantId: savanna.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Glass", abbreviation: "gls", tenantId: savanna.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: savanna.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Portion", abbreviation: "ptn", tenantId: savanna.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Plate", abbreviation: "plt", tenantId: savanna.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Crate", abbreviation: "crt", tenantId: savanna.id } }),
  ]);
  const [sBtl, sTot, sDbl, sGls, sPc, sPtn, sPlt, sCrt] = savannaUnits;

  const savannaCats = await Promise.all([
    prisma.category.create({ data: { name: "Premium Spirits", color: "#8b5cf6", tenantId: savanna.id } }),
    prisma.category.create({ data: { name: "Beers & Ciders", color: "#f59e0b", tenantId: savanna.id } }),
    prisma.category.create({ data: { name: "Cocktails", color: "#ec4899", tenantId: savanna.id } }),
    prisma.category.create({ data: { name: "Wines", color: "#dc2626", tenantId: savanna.id } }),
    prisma.category.create({ data: { name: "Food", color: "#10b981", tenantId: savanna.id } }),
    prisma.category.create({ data: { name: "Soft Drinks", color: "#06b6d4", tenantId: savanna.id } }),
  ]);
  const [sPremium, sBeers, sCocktails, sWines, sFood, sSoft] = savannaCats;

  const savannaProducts = [
    { name: "Johnnie Walker Black", sku: "SV-PRM-001", price: 350, cost: 120, unit: sTot, cat: sPremium.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200", uoms: [{ unit: sDbl, factor: 2, price: 650, cost: 240 }, { unit: sBtl, factor: 28, price: 7500, cost: 3200 }] },
    { name: "Hennessy VS", sku: "SV-PRM-002", price: 450, cost: 180, unit: sTot, cat: sPremium.id, image: "https://images.unsplash.com/photo-1602083390928-58dbb22d1ea0?w=200", uoms: [{ unit: sDbl, factor: 2, price: 850, cost: 360 }, { unit: sBtl, factor: 28, price: 10000, cost: 4800 }] },
    { name: "Glenfiddich 12yr", sku: "SV-PRM-003", price: 500, cost: 200, unit: sTot, cat: sPremium.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", uoms: [{ unit: sDbl, factor: 2, price: 950, cost: 400 }, { unit: sBtl, factor: 28, price: 12000, cost: 5400 }] },
    { name: "Grey Goose Vodka", sku: "SV-PRM-004", price: 400, cost: 150, unit: sTot, cat: sPremium.id, image: "https://images.unsplash.com/photo-1607622750671-6cd9a99eabd1?w=200", uoms: [{ unit: sDbl, factor: 2, price: 750, cost: 300 }, { unit: sBtl, factor: 28, price: 8500, cost: 4000 }] },
    { name: "Tusker Malt", sku: "SV-BER-001", price: 380, cost: 220, unit: sBtl, cat: sBeers.id, image: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200", uoms: [{ unit: sCrt, factor: 24, price: 8500, cost: 5000 }] },
    { name: "Heineken", sku: "SV-BER-002", price: 400, cost: 250, unit: sBtl, cat: sBeers.id, image: "https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=200", uoms: [{ unit: sCrt, factor: 24, price: 9000, cost: 5700 }] },
    { name: "Savanna Dry Cider", sku: "SV-BER-003", price: 420, cost: 260, unit: sBtl, cat: sBeers.id, image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=200", uoms: [] },
    { name: "Mojito", sku: "SV-CTL-001", price: 650, cost: 180, unit: sGls, cat: sCocktails.id, image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200", uoms: [] },
    { name: "Espresso Martini", sku: "SV-CTL-002", price: 750, cost: 220, unit: sGls, cat: sCocktails.id, image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=200", uoms: [] },
    { name: "Long Island Iced Tea", sku: "SV-CTL-003", price: 700, cost: 200, unit: sGls, cat: sCocktails.id, image: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=200", uoms: [] },
    { name: "House Red Wine", sku: "SV-WIN-001", price: 450, cost: 120, unit: sGls, cat: sWines.id, image: "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=200", uoms: [{ unit: sBtl, factor: 6, price: 2500, cost: 700 }] },
    { name: "Sauvignon Blanc", sku: "SV-WIN-002", price: 500, cost: 150, unit: sGls, cat: sWines.id, image: "https://images.unsplash.com/photo-1566995541428-f2246c17cda1?w=200", uoms: [{ unit: sBtl, factor: 6, price: 2800, cost: 850 }] },
    { name: "Grilled Steak 300g", sku: "SV-FOD-001", price: 1800, cost: 700, unit: sPlt, cat: sFood.id, image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200", uoms: [] },
    { name: "Nyama Choma 500g", sku: "SV-FOD-002", price: 1200, cost: 500, unit: sPtn, cat: sFood.id, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=200", uoms: [] },
    { name: "Fish & Chips", sku: "SV-FOD-003", price: 1400, cost: 550, unit: sPlt, cat: sFood.id, image: "https://images.unsplash.com/photo-1579208030886-b1f5b8a32711?w=200", uoms: [] },
    { name: "Chicken Wings (8pc)", sku: "SV-FOD-004", price: 950, cost: 350, unit: sPtn, cat: sFood.id, image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=200", uoms: [] },
    { name: "Perrier Sparkling Water", sku: "SV-SFT-001", price: 350, cost: 180, unit: sPc, cat: sSoft.id, image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200", uoms: [] },
    { name: "Red Bull", sku: "SV-SFT-002", price: 400, cost: 250, unit: sPc, cat: sSoft.id, image: "https://images.unsplash.com/photo-1613313440685-b70af080fd7c?w=200", uoms: [] },
  ];

  const createdSavannaProducts: Product[] = [];
  for (const p of savannaProducts) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, price: p.price, cost: p.cost,
        image: p.image, baseUnitId: p.unit.id, tenantId: savanna.id, categoryId: p.cat,
      },
    });
    createdSavannaProducts.push(product);

    if (p.uoms.length > 0) {
      await prisma.productUoM.createMany({
        data: p.uoms.map((u, idx) => ({
          productId: product.id, unitId: u.unit.id,
          conversionFactor: u.factor, price: u.price, cost: u.cost,
          isDefault: idx === 0,
        })),
      });
    }

    await prisma.stock.create({
      data: { quantity: 30 + Math.floor(Math.random() * 80), productId: product.id, locationId: savannaLocation.id },
    });
  }

  // Savanna orders (higher value)
  const savannaOrders = [
    { items: [{ idx: 0, qty: 2 }, { idx: 4, qty: 2 }, { idx: 7, qty: 1 }, { idx: 12, qty: 1 }], method: "CARD" as const },
    { items: [{ idx: 1, qty: 1 }, { idx: 8, qty: 2 }, { idx: 15, qty: 1 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 2, qty: 2 }, { idx: 5, qty: 3 }, { idx: 10, qty: 2 }], method: "CARD" as const },
    { items: [{ idx: 3, qty: 1 }, { idx: 9, qty: 1 }, { idx: 13, qty: 1 }, { idx: 16, qty: 2 }], method: "CASH" as const },
    { items: [{ idx: 6, qty: 2 }, { idx: 11, qty: 2 }, { idx: 14, qty: 1 }, { idx: 17, qty: 1 }], method: "PDQ" as const },
    { items: [{ idx: 0, qty: 4 }, { idx: 1, qty: 2 }, { idx: 7, qty: 2 }, { idx: 8, qty: 2 }], method: "CARD" as const },
    { items: [{ idx: 4, qty: 6 }, { idx: 12, qty: 2 }, { idx: 15, qty: 2 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 2, qty: 1 }, { idx: 3, qty: 1 }, { idx: 10, qty: 3 }, { idx: 13, qty: 1 }], method: "CARD" as const },
  ];

  for (const orderData of savannaOrders) {
    const orderItems = orderData.items.map(i => {
      const p = createdSavannaProducts[i.idx];
      return { productId: p.id, quantity: i.qty, unitPrice: p.price, total: p.price * i.qty, baseQuantity: i.qty };
    });
    const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
    const taxAmount = subtotal * 0.16;
    const total = subtotal + taxAmount;
    const orderNo = generateOrderNo();

    const order = await prisma.order.create({
      data: {
        orderNo, status: "COMPLETED", subtotal, taxAmount, total, discount: 0,
        paymentMethod: orderData.method, paymentStatus: "COMPLETED",
        tenantId: savanna.id, locationId: savannaLocation.id, userId: savannaCashier.id,
        items: { create: orderItems },
      },
    });

    await prisma.transaction.create({
      data: {
        type: "SALE", amount: total, method: orderData.method, status: "COMPLETED",
        reference: `TXN-${orderNo.replace("ORD-", "")}`,
        description: `Sale ${orderNo}`, tenantId: savanna.id, orderId: order.id, userId: savannaCashier.id,
      },
    });
  }

  // Savanna expenses
  await prisma.expense.createMany({
    data: [
      { date: dateOnly(daysAgo(3)), category: "Rent", description: "Monthly rent - Westlands", amount: 120000, tenantId: savanna.id, locationId: savannaLocation.id, userId: savannaOwner.id, isRecurring: true },
      { date: dateOnly(daysAgo(2)), category: "Staff", description: "Security guard wages", amount: 25000, tenantId: savanna.id, locationId: savannaLocation.id, userId: savannaOwner.id, isRecurring: true },
      { date: dateOnly(daysAgo(2)), category: "Entertainment", description: "DJ equipment hire", amount: 15000, supplier: "SoundWave Entertainment", tenantId: savanna.id, locationId: savannaLocation.id, userId: savannaOwner.id },
      { date: dateOnly(daysAgo(1)), category: "Utilities", description: "Electricity + water", amount: 18000, tenantId: savanna.id, locationId: savannaLocation.id, userId: savannaOwner.id, receiptNo: "UTL-AUG-01" },
      { date: dateOnly(daysAgo(1)), category: "Marketing", description: "Social media ads", amount: 8000, supplier: "DigitalKE Agency", tenantId: savanna.id, locationId: savannaLocation.id, userId: savannaOwner.id },
      { date: dateOnly(daysAgo(0)), category: "Supplies", description: "Cocktail ingredients", amount: 12000, supplier: "Fresh Produce Ltd", tenantId: savanna.id, locationId: savannaLocation.id, userId: savannaOwner.id, receiptNo: "FPL-8834" },
      { date: dateOnly(daysAgo(0)), category: "Maintenance", description: "Air conditioning service", amount: 7500, supplier: "CoolAir Systems", tenantId: savanna.id, locationId: savannaLocation.id, userId: savannaOwner.id },
    ],
  });

  // Stock movements (opening balance)
  for (const product of createdSavannaProducts.slice(0, 8)) {
    await prisma.stockMovement.create({
      data: {
        type: "OPENING_BALANCE",
        quantity: 50,
        productId: product.id,
        locationId: savannaLocation.id,
        reference: "INIT",
        notes: "Initial stock setup",
        tenantId: savanna.id,
        userId: savannaOwner.id,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT 4: CLUB CHAIRMAN (Bar - Real Stock Sheet Data)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("  Creating Club Chairman...");

  const chairman = await prisma.tenant.create({
    data: {
      name: "Club Chairman",
      slug: "club-chairman",
      type: "BAR",
      tier: "PROFESSIONAL",
      email: "jkmasaka@gmail.com",
      phone: "+254 722 555 888",
      address: "Kenyatta Avenue",
      city: "Nairobi",
      currency: "KES",
      taxRate: 0,
      receiptHeader: "CLUB CHAIRMAN",
      receiptFooter: "Thank you! Karibu tena.",
    },
  });

  const chairHash = await bcrypt.hash("Chairman@2024", 10);
  const jackieHash = await bcrypt.hash("Jackie@2024", 10);

  const johnMasaka = await prisma.user.create({
    data: { email: "jkmasaka@gmail.com", name: "John Masaka", phone: "+254 722 555 888", password: chairHash, role: "OWNER", tenantId: chairman.id },
  });
  const jackie = await prisma.user.create({
    data: { email: "jackie@clubchairman.co.ke", name: "Jackie", phone: "+254 733 666 999", password: jackieHash, role: "CASHIER", tenantId: chairman.id },
  });

  const chairLocation = await prisma.location.create({
    data: { name: "Main Bar", address: "Kenyatta Avenue, Nairobi", tenantId: chairman.id },
  });
  await prisma.register.create({ data: { name: "Bar Counter", locationId: chairLocation.id } });

  // Units of Measure for a bar
  const chairUnits = await Promise.all([
    prisma.unitOfMeasure.create({ data: { name: "Bottle", abbreviation: "btl", tenantId: chairman.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Tot", abbreviation: "tot", tenantId: chairman.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Double", abbreviation: "dbl", tenantId: chairman.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Can", abbreviation: "can", tenantId: chairman.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Glass", abbreviation: "gls", tenantId: chairman.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Crate", abbreviation: "crt", tenantId: chairman.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Jug", abbreviation: "jug", tenantId: chairman.id } }),
  ]);
  const [cBtl, cTot, cDbl, cCan, cGls, cCrt, cJug] = chairUnits;

  await prisma.unitConversion.createMany({
    data: [
      { fromUnitId: cBtl.id, toUnitId: cTot.id, factor: 15 },
      { fromUnitId: cCrt.id, toUnitId: cBtl.id, factor: 24 },
      { fromUnitId: cDbl.id, toUnitId: cTot.id, factor: 2 },
    ],
  });

  // Categories
  const chairCats = await Promise.all([
    prisma.category.create({ data: { name: "Beers", color: "#f59e0b", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Ciders & RTD", color: "#84cc16", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Spirits - Vodka", color: "#6366f1", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Spirits - Whiskey", color: "#a855f7", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Spirits - Gin", color: "#06b6d4", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Spirits - Brandy", color: "#dc2626", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Spirits - Rum", color: "#ea580c", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Spirits - Cream & Liqueur", color: "#d946ef", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Wines", color: "#be123c", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Mixers & Energy", color: "#0ea5e9", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Soft Drinks & Water", color: "#14b8a6", tenantId: chairman.id } }),
    prisma.category.create({ data: { name: "Keg", color: "#78716c", tenantId: chairman.id } }),
  ]);
  const [catBeers, catCiders, catVodka, catWhiskey, catGin, catBrandy, catRum, catCream, catWines, catMixers, catSoft, catKeg] = chairCats;

  // ─── ALL 117 PRODUCTS FROM CLUB CHAIRMAN STOCK SHEET ──────────────────────
  const chairProducts: Array<{
    name: string; sku: string; price: number; cost: number; cat: string; image: string;
    totPrice?: number; dblPrice?: number;
  }> = [
    // ═══ BEERS (items 1-18) ═══
    { name: "Tusker Lager", sku: "CC-001", price: 250, cost: 180, cat: catBeers.id, image: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200" },
    { name: "Tusker Can", sku: "CC-002", price: 270, cost: 200, cat: catBeers.id, image: "https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=200" },
    { name: "Tusker Cider", sku: "CC-003", price: 280, cost: 200, cat: catCiders.id, image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=200" },
    { name: "Tusker Cider Can", sku: "CC-004", price: 300, cost: 220, cat: catCiders.id, image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=200" },
    { name: "Tusker Malt", sku: "CC-005", price: 300, cost: 220, cat: catBeers.id, image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=200" },
    { name: "Tusker Malt Can", sku: "CC-006", price: 320, cost: 240, cat: catBeers.id, image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=200" },
    { name: "Tusker Lite", sku: "CC-007", price: 280, cost: 200, cat: catBeers.id, image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=200" },
    { name: "Tusker Lite Can", sku: "CC-008", price: 300, cost: 220, cat: catBeers.id, image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=200" },
    { name: "Pilsner Lager", sku: "CC-009", price: 250, cost: 175, cat: catBeers.id, image: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=200" },
    { name: "Pilsner Can", sku: "CC-010", price: 270, cost: 195, cat: catBeers.id, image: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=200" },
    { name: "White Cap Lager", sku: "CC-011", price: 250, cost: 175, cat: catBeers.id, image: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=200" },
    { name: "White Cap Can", sku: "CC-012", price: 270, cost: 195, cat: catBeers.id, image: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=200" },
    { name: "White Cap Crisp", sku: "CC-013", price: 270, cost: 195, cat: catBeers.id, image: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=200" },
    { name: "Guinness Kubwa", sku: "CC-014", price: 350, cost: 260, cat: catBeers.id, image: "https://images.unsplash.com/photo-1584225064785-c62a8b43d148?w=200" },
    { name: "Guinness Can", sku: "CC-015", price: 350, cost: 260, cat: catBeers.id, image: "https://images.unsplash.com/photo-1584225064785-c62a8b43d148?w=200" },
    { name: "Guinness Smooth", sku: "CC-016", price: 300, cost: 220, cat: catBeers.id, image: "https://images.unsplash.com/photo-1584225064785-c62a8b43d148?w=200" },
    { name: "Balozi Lager", sku: "CC-017", price: 230, cost: 165, cat: catBeers.id, image: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200" },
    { name: "Balozi Can", sku: "CC-018", price: 250, cost: 185, cat: catBeers.id, image: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200" },
    // ═══ CIDERS & RTD (items 19-26) ═══
    { name: "Smirnoff Ice Black", sku: "CC-019", price: 300, cost: 220, cat: catCiders.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200" },
    { name: "Snapp", sku: "CC-020", price: 250, cost: 175, cat: catCiders.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200" },
    { name: "Manyatta", sku: "CC-021", price: 200, cost: 140, cat: catCiders.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200" },
    { name: "Snapp Can", sku: "CC-022", price: 270, cost: 195, cat: catCiders.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200" },
    { name: "Pineapple Punch", sku: "CC-023", price: 250, cost: 175, cat: catCiders.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200" },
    { name: "Smirnoff Guarana", sku: "CC-024", price: 300, cost: 220, cat: catCiders.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200" },
    { name: "Heineken", sku: "CC-025", price: 350, cost: 270, cat: catBeers.id, image: "https://images.unsplash.com/photo-1572443490709-e57652b64499?w=200" },
    { name: "Faxe", sku: "CC-026", price: 400, cost: 300, cat: catBeers.id, image: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200" },
    // ═══ ENERGY & MIXERS (items 27-33) ═══
    { name: "O.J (Orange Juice)", sku: "CC-027", price: 150, cost: 80, cat: catMixers.id, image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=200" },
    { name: "Power Play", sku: "CC-028", price: 200, cost: 130, cat: catMixers.id, image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=200" },
    { name: "Predator", sku: "CC-029", price: 200, cost: 130, cat: catMixers.id, image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=200" },
    { name: "Savannah", sku: "CC-030", price: 350, cost: 260, cat: catCiders.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200" },
    { name: "Monster", sku: "CC-031", price: 250, cost: 170, cat: catMixers.id, image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=200" },
    { name: "Lemonade", sku: "CC-032", price: 150, cost: 70, cat: catMixers.id, image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=200" },
    { name: "Red Bull", sku: "CC-033", price: 400, cost: 300, cat: catMixers.id, image: "https://images.unsplash.com/photo-1613225747130-5cb3e14b2e9c?w=200" },
    // ═══ SPIRITS (items 34-104) ═══
    { name: "White Pearl 250ml", sku: "CC-034", price: 400, cost: 280, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 100 },
    { name: "White Pearl 750ml", sku: "CC-035", price: 1000, cost: 720, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 100 },
    { name: "J. Walker Red 375ml", sku: "CC-036", price: 1800, cost: 1400, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1602081115068-5b2dae2e1dba?w=200", totPrice: 250 },
    { name: "J. Walker Red 750ml", sku: "CC-037", price: 3500, cost: 2800, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1602081115068-5b2dae2e1dba?w=200", totPrice: 250 },
    { name: "J. Walker Black 375ml", sku: "CC-038", price: 2800, cost: 2200, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1602081115068-5b2dae2e1dba?w=200", totPrice: 400 },
    { name: "J. Walker Black 750ml", sku: "CC-039", price: 5500, cost: 4400, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1602081115068-5b2dae2e1dba?w=200", totPrice: 400 },
    { name: "Chrome Vodka 250ml", sku: "CC-040", price: 500, cost: 350, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 120 },
    { name: "Chrome Vodka 750ml", sku: "CC-041", price: 1300, cost: 950, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 120 },
    { name: "Chrome Gin 250ml", sku: "CC-042", price: 500, cost: 350, cat: catGin.id, image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200", totPrice: 120 },
    { name: "Chrome Gin 750ml", sku: "CC-043", price: 1300, cost: 950, cat: catGin.id, image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200", totPrice: 120 },
    { name: "Viceroy 250ml", sku: "CC-044", price: 450, cost: 320, cat: catBrandy.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200", totPrice: 100 },
    { name: "Viceroy 350ml", sku: "CC-045", price: 600, cost: 440, cat: catBrandy.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200", totPrice: 100 },
    { name: "Viceroy 750ml", sku: "CC-046", price: 1200, cost: 900, cat: catBrandy.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200", totPrice: 100 },
    { name: "Smirnoff Vodka 250ml", sku: "CC-047", price: 600, cost: 430, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 150 },
    { name: "Smirnoff Vodka 350ml", sku: "CC-048", price: 800, cost: 600, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 150 },
    { name: "Smirnoff Vodka 750ml", sku: "CC-049", price: 1600, cost: 1200, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 150 },
    { name: "Gilbeys Gin 250ml", sku: "CC-050", price: 500, cost: 360, cat: catGin.id, image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200", totPrice: 120 },
    { name: "Gilbeys Gin 350ml", sku: "CC-051", price: 700, cost: 500, cat: catGin.id, image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200", totPrice: 120 },
    { name: "Gilbeys Gin 750ml", sku: "CC-052", price: 1400, cost: 1000, cat: catGin.id, image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200", totPrice: 120 },
    { name: "Richot 250ml", sku: "CC-053", price: 500, cost: 350, cat: catBrandy.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200", totPrice: 120 },
    { name: "Richot 350ml", sku: "CC-054", price: 700, cost: 490, cat: catBrandy.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200", totPrice: 120 },
    { name: "Richot 750ml", sku: "CC-055", price: 1400, cost: 1000, cat: catBrandy.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200", totPrice: 120 },
    { name: "Kenya Cane 250ml", sku: "CC-056", price: 450, cost: 320, cat: catRum.id, image: "https://images.unsplash.com/photo-1598018553943-4e8f4e28bb09?w=200", totPrice: 100 },
    { name: "Kenya Cane 350ml", sku: "CC-057", price: 600, cost: 440, cat: catRum.id, image: "https://images.unsplash.com/photo-1598018553943-4e8f4e28bb09?w=200", totPrice: 100 },
    { name: "Kenya Cane 750ml", sku: "CC-058", price: 1200, cost: 900, cat: catRum.id, image: "https://images.unsplash.com/photo-1598018553943-4e8f4e28bb09?w=200", totPrice: 100 },
    { name: "Konyagi 250ml", sku: "CC-059", price: 350, cost: 240, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 80 },
    { name: "Konyagi 500ml", sku: "CC-060", price: 650, cost: 460, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 80 },
    { name: "Konyagi 750ml", sku: "CC-061", price: 900, cost: 650, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 80 },
    { name: "Kibao Vodka 250ml", sku: "CC-062", price: 350, cost: 240, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 80 },
    { name: "Kibao Vodka 350ml", sku: "CC-063", price: 480, cost: 340, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 80 },
    { name: "Kibao Vodka 750ml", sku: "CC-064", price: 900, cost: 650, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 80 },
    { name: "V & A 250ml", sku: "CC-065", price: 400, cost: 280, cat: catBrandy.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200", totPrice: 100 },
    { name: "V & A 750ml", sku: "CC-066", price: 1100, cost: 800, cat: catBrandy.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200", totPrice: 100 },
    { name: "VAT 69 350ml", sku: "CC-067", price: 1200, cost: 900, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 200 },
    { name: "VAT 69 750ml", sku: "CC-068", price: 2400, cost: 1800, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 200 },
    { name: "Hunters 250ml", sku: "CC-069", price: 400, cost: 280, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 100 },
    { name: "Hunters 350ml", sku: "CC-070", price: 550, cost: 400, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 100 },
    { name: "Hunters 750ml", sku: "CC-071", price: 1100, cost: 800, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 100 },
    { name: "K.K", sku: "CC-072", price: 200, cost: 130, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200" },
    { name: "Trace", sku: "CC-073", price: 200, cost: 130, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200" },
    { name: "General Meakins", sku: "CC-074", price: 350, cost: 240, cat: catBrandy.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200" },
    { name: "Napoleon", sku: "CC-075", price: 400, cost: 280, cat: catBrandy.id, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200" },
    { name: "Origin", sku: "CC-076", price: 250, cost: 170, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200" },
    { name: "Caribian", sku: "CC-077", price: 300, cost: 200, cat: catRum.id, image: "https://images.unsplash.com/photo-1598018553943-4e8f4e28bb09?w=200" },
    { name: "Crazy Cock", sku: "CC-078", price: 250, cost: 170, cat: catCiders.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200" },
    { name: "Mr. Dowel", sku: "CC-079", price: 350, cost: 240, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200" },
    { name: "Black & White 350ml", sku: "CC-080", price: 1200, cost: 900, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 200 },
    { name: "Black & White 750ml", sku: "CC-081", price: 2400, cost: 1800, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 200 },
    { name: "Capt. Morgan Gold 250ml", sku: "CC-082", price: 600, cost: 430, cat: catRum.id, image: "https://images.unsplash.com/photo-1598018553943-4e8f4e28bb09?w=200", totPrice: 150 },
    { name: "Capt. Morgan Gold 750ml", sku: "CC-083", price: 1600, cost: 1200, cat: catRum.id, image: "https://images.unsplash.com/photo-1598018553943-4e8f4e28bb09?w=200", totPrice: 150 },
    { name: "Triple Ace 250ml", sku: "CC-084", price: 350, cost: 240, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 80 },
    { name: "Best Whiskey 250ml", sku: "CC-085", price: 350, cost: 240, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 80 },
    { name: "Best Whiskey 750ml", sku: "CC-086", price: 900, cost: 650, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 80 },
    { name: "Best Gin 250ml", sku: "CC-087", price: 350, cost: 240, cat: catGin.id, image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200", totPrice: 80 },
    { name: "Best Gin 750ml", sku: "CC-088", price: 900, cost: 650, cat: catGin.id, image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200", totPrice: 80 },
    { name: "Best Cream 250ml", sku: "CC-089", price: 400, cost: 280, cat: catCream.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200", totPrice: 100 },
    { name: "Best Cream 750ml", sku: "CC-090", price: 1000, cost: 720, cat: catCream.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200", totPrice: 100 },
    { name: "Kane Extra 250ml", sku: "CC-091", price: 350, cost: 240, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200", totPrice: 80 },
    { name: "Grants 750ml", sku: "CC-092", price: 2800, cost: 2100, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 250 },
    { name: "William Lawson 375ml", sku: "CC-093", price: 1500, cost: 1100, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 200 },
    { name: "William Lawson 750ml", sku: "CC-094", price: 2800, cost: 2100, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 200 },
    { name: "Bond 7 250ml", sku: "CC-095", price: 450, cost: 320, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 100 },
    { name: "Bond 7 350ml", sku: "CC-096", price: 600, cost: 440, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 100 },
    { name: "Bond 7 750ml", sku: "CC-097", price: 1200, cost: 900, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 100 },
    { name: "Blue Ice 250ml", sku: "CC-098", price: 300, cost: 200, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200" },
    { name: "Sweet Berry 250ml", sku: "CC-099", price: 300, cost: 200, cat: catCream.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200" },
    { name: "County 250ml", sku: "CC-100", price: 350, cost: 240, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 80 },
    { name: "County 750ml", sku: "CC-101", price: 900, cost: 650, cat: catWhiskey.id, image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200", totPrice: 80 },
    { name: "All Season 250ml", sku: "CC-102", price: 300, cost: 200, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200" },
    { name: "All Season 750ml", sku: "CC-103", price: 800, cost: 560, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200" },
    { name: "People Vodka 250ml", sku: "CC-104", price: 300, cost: 200, cat: catVodka.id, image: "https://images.unsplash.com/photo-1550985543-49bee3167284?w=200" },
    // ═══ WINES (items 105-110) ═══
    { name: "King Fisher", sku: "CC-105", price: 500, cost: 350, cat: catWines.id, image: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=200" },
    { name: "Caprice", sku: "CC-106", price: 600, cost: 420, cat: catWines.id, image: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=200" },
    { name: "Penasol", sku: "CC-107", price: 700, cost: 500, cat: catWines.id, image: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=200" },
    { name: "Fourth Street", sku: "CC-108", price: 800, cost: 580, cat: catWines.id, image: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=200" },
    { name: "Four Cousins", sku: "CC-109", price: 900, cost: 650, cat: catWines.id, image: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=200" },
    { name: "Cellar Cask (Glass)", sku: "CC-110", price: 250, cost: 150, cat: catWines.id, image: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=200" },
    // ═══ SOFT DRINKS & WATER (items 111-116) ═══
    { name: "Soda Big (500ml)", sku: "CC-111", price: 80, cost: 45, cat: catSoft.id, image: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=200" },
    { name: "Soda Small (300ml)", sku: "CC-112", price: 60, cost: 35, cat: catSoft.id, image: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=200" },
    { name: "Pet Soda (1.5L)", sku: "CC-113", price: 150, cost: 100, cat: catSoft.id, image: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=200" },
    { name: "Delmonte Juice", sku: "CC-114", price: 150, cost: 90, cat: catSoft.id, image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=200" },
    { name: "Mineral Water 500ml", sku: "CC-115", price: 60, cost: 30, cat: catSoft.id, image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200" },
    { name: "Mineral Water 1L", sku: "CC-116", price: 100, cost: 50, cat: catSoft.id, image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200" },
    // ═══ KEG (item 117) ═══
    { name: "Keg Regular", sku: "CC-117", price: 150, cost: 80, cat: catKeg.id, image: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200" },
  ];

  const createdChairProducts: Product[] = [];
  for (const p of chairProducts) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, price: p.price, cost: p.cost,
        image: p.image, baseUnitId: cBtl.id, tenantId: chairman.id, categoryId: p.cat,
      },
    });
    createdChairProducts.push(product);
    if (p.totPrice) {
      await prisma.productUoM.create({
        data: { productId: product.id, unitId: cTot.id, conversionFactor: 0.067, price: p.totPrice, cost: p.totPrice * 0.5, isDefault: false, isActive: true },
      });
      await prisma.productUoM.create({
        data: { productId: product.id, unitId: cDbl.id, conversionFactor: 0.133, price: (p.dblPrice || p.totPrice * 1.8), cost: p.totPrice * 0.9, isDefault: false, isActive: true },
      });
    }
  }

  // ─── Stock quantities (realistic bar levels) ──────────────────────────────
  const chairStockQty = [
    // Beers (18)
    3, 2, 2, 1, 2, 1, 3, 1, 4, 1, 2, 1, 1, 2, 1, 2, 3, 1,
    // Ciders & RTD (8)
    2, 3, 4, 1, 2, 1, 1, 1,
    // Mixers & Energy (7)
    6, 4, 4, 1, 3, 6, 2,
    // Spirits 33-65 (33)
    2, 1, 1, 1, 1, 1, 3, 1, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 2, 1,
    // Spirits 66-103 (38)
    4, 5, 2, 1, 3, 2, 3, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 2, 2, 2, 3, 2, 2, 3, 2, 3, 2, 2, 3,
    // Wines (6)
    2, 2, 1, 2, 1, 6,
    // Soft drinks (6)
    24, 24, 6, 12, 24, 12,
    // Keg (1)
    1,
  ];
  for (let i = 0; i < createdChairProducts.length && i < chairStockQty.length; i++) {
    await prisma.stock.create({
      data: { productId: createdChairProducts[i].id, locationId: chairLocation.id, quantity: chairStockQty[i] },
    });
  }

  // ─── Stock Records (3 days matching real stock sheet data from 8/12) ───────
  const cDay0 = daysAgo(2);
  const cDay1 = daysAgo(1);
  const cDay2 = daysAgo(0);
  const stockSheetData: number[][] = [
    [0, 3, 0, 1, 2, 24, 3, 23, 0, 2],
    [1, 2, 0, 1, 1, 0, 0, 1, 0, 0],
    [8, 4, 0, 2, 2, 24, 6, 20, 0, 4],
    [13, 2, 0, 1, 1, 12, 2, 11, 0, 1],
    [16, 3, 0, 2, 1, 24, 5, 20, 0, 3],
    [18, 2, 0, 1, 1, 12, 2, 11, 0, 1],
    [24, 1, 0, 0, 1, 6, 1, 6, 0, 0],
    [30, 3, 0, 1, 2, 0, 1, 1, 6, 1],
    [32, 2, 0, 1, 1, 6, 2, 5, 0, 1],
    [35, 1, 0, 0, 1, 0, 0, 1, 1, 0],
    [36, 1, 0, 0, 1, 0, 0, 1, 0, 0],
    [46, 3, 0, 1, 2, 6, 2, 6, 0, 1],
    [49, 3, 0, 1, 2, 6, 2, 6, 0, 1],
    [55, 3, 0, 2, 1, 6, 3, 4, 0, 2],
    [58, 3, 0, 2, 1, 6, 3, 4, 0, 2],
    [61, 3, 0, 2, 1, 6, 3, 4, 0, 2],
    [94, 2, 0, 1, 1, 3, 2, 2, 0, 1],
    [110, 24, 0, 8, 16, 24, 10, 30, 0, 6],
    [111, 24, 0, 6, 18, 24, 8, 34, 0, 5],
    [114, 24, 0, 4, 20, 24, 6, 38, 0, 3],
    [116, 1, 0, 0, 1, 0, 0, 1, 1, 0],
  ];
  for (const [idx, d0Open, d0Add, d0Sold, d1Open, d1Add, d1Sold, d2Open, d2Add, d2Sold] of stockSheetData) {
    const productId = createdChairProducts[idx].id;
    await prisma.stockRecord.create({
      data: { date: dateOnly(cDay0), openingStock: d0Open, addedStock: d0Add, soldStock: d0Sold, closingStock: d0Open + d0Add - d0Sold, productId, locationId: chairLocation.id, tenantId: chairman.id },
    });
    await prisma.stockRecord.create({
      data: { date: dateOnly(cDay1), openingStock: d1Open, addedStock: d1Add, soldStock: d1Sold, closingStock: d1Open + d1Add - d1Sold, productId, locationId: chairLocation.id, tenantId: chairman.id },
    });
    await prisma.stockRecord.create({
      data: { date: dateOnly(cDay2), openingStock: d2Open, addedStock: d2Add, soldStock: d2Sold, closingStock: d2Open + d2Add - d2Sold, productId, locationId: chairLocation.id, tenantId: chairman.id },
    });
  }

  // ─── Orders & Transactions ────────────────────────────────────────────────
  const chairOrders = [
    { items: [[0, 1, 250], [8, 2, 250], [110, 2, 80]], method: "CASH" as const },
    { items: [[13, 1, 350], [30, 1, 250], [114, 1, 60]], method: "MPESA_MANUAL" as const, customer: "Kevin" },
    { items: [[16, 2, 230], [46, 1, 600], [55, 2, 450]], method: "CASH" as const },
    { items: [[18, 1, 300], [24, 1, 350], [32, 1, 400]], method: "CASH" as const },
    { items: [[36, 1, 3500], [110, 3, 80]], method: "MPESA_MANUAL" as const, customer: "Wanjiku" },
    { items: [[49, 2, 500], [58, 1, 350], [111, 2, 60]], method: "CASH" as const },
    { items: [[8, 3, 250], [16, 1, 230], [61, 1, 350]], method: "CASH" as const },
    { items: [[46, 1, 600], [110, 2, 80], [114, 1, 60]], method: "MPESA_MANUAL" as const, customer: "Otieno" },
  ];
  for (let i = 0; i < chairOrders.length; i++) {
    const o = chairOrders[i];
    const orderItems = o.items.map(([idx, qty, price]) => ({
      productId: createdChairProducts[idx].id, quantity: qty, unitPrice: price, total: qty * price, baseQuantity: qty,
    }));
    const subtotal = orderItems.reduce((s, it) => s + it.total, 0);
    const order = await prisma.order.create({
      data: {
        orderNo: `CC-${String(i + 1).padStart(4, "0")}`, status: "COMPLETED",
        subtotal, taxAmount: 0, total: subtotal,
        paymentMethod: o.method, paymentStatus: "COMPLETED",
        customerName: ("customer" in o) ? (o as { customer: string }).customer : null,
        tenantId: chairman.id, locationId: chairLocation.id, userId: jackie.id,
        items: { create: orderItems },
        createdAt: new Date(cDay2.getTime() + (i + 1) * 3600000),
      },
    });
    await prisma.transaction.create({
      data: {
        type: "SALE", amount: subtotal, method: o.method, status: "COMPLETED",
        reference: `TXN-CC-${String(i + 1).padStart(4, "0")}`,
        description: ("customer" in o) ? `Sale to ${(o as { customer: string }).customer}` : "Walk-in sale",
        tenantId: chairman.id, orderId: order.id, userId: jackie.id,
        createdAt: new Date(cDay2.getTime() + (i + 1) * 3600000),
      },
    });
  }

  // ─── Unpaid tabs (from "UN-PAID BILLS" section) ───────────────────────────
  const chairTabs = [
    { name: "Masaka", items: [[0, 1, 250], [46, 1, 600]] },
    { name: "Soi", items: [[8, 2, 250], [110, 1, 80]] },
  ];
  for (let i = 0; i < chairTabs.length; i++) {
    const t = chairTabs[i];
    const orderItems = t.items.map(([idx, qty, price]) => ({
      productId: createdChairProducts[idx].id, quantity: qty, unitPrice: price, total: qty * price, baseQuantity: qty,
    }));
    const total = orderItems.reduce((s, it) => s + it.total, 0);
    await prisma.order.create({
      data: {
        orderNo: `TAB-CC-${String(i + 1).padStart(3, "0")}`, status: "TAB", tabName: t.name,
        subtotal: total, taxAmount: 0, total,
        paymentMethod: "CASH", paymentStatus: "PENDING", customerName: t.name,
        tenantId: chairman.id, locationId: chairLocation.id, userId: jackie.id,
        items: { create: orderItems },
        createdAt: new Date(cDay2.getTime() + 5 * 3600000),
      },
    });
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      { date: dateOnly(cDay2), category: "Purchases", description: "Beer restock - Tusker, Pilsner, Balozi crates", amount: 2160, supplier: "EABL Distributor", tenantId: chairman.id, locationId: chairLocation.id, userId: johnMasaka.id },
      { date: dateOnly(cDay2), category: "Utilities", description: "Electricity bill", amount: 500, isRecurring: true, tenantId: chairman.id, locationId: chairLocation.id, userId: johnMasaka.id },
      { date: dateOnly(cDay2), category: "Supplies", description: "Ice, serviettes, straws", amount: 320, tenantId: chairman.id, locationId: chairLocation.id, userId: johnMasaka.id },
      { date: dateOnly(cDay2), category: "Staff", description: "Cleaner wages", amount: 400, isRecurring: true, tenantId: chairman.id, locationId: chairLocation.id, userId: johnMasaka.id },
      { date: dateOnly(cDay1), category: "Purchases", description: "Spirit restock - Smirnoff, Gilbeys, Kenya Cane", amount: 3500, supplier: "KWAL Distributor", tenantId: chairman.id, locationId: chairLocation.id, userId: johnMasaka.id },
      { date: dateOnly(cDay1), category: "Maintenance", description: "Sound system repair", amount: 1500, tenantId: chairman.id, locationId: chairLocation.id, userId: johnMasaka.id },
    ],
  });

  // ─── Daily Summary (matching stock sheet cash reconciliation) ──────────────
  await prisma.dailySummary.create({
    data: {
      date: dateOnly(cDay2), cashBroughtForward: 6060, totalSales: 8720, debtsPaid: 0, otherIncome: 0,
      subtotal: 14780, mpesaReceived: 4670, purchases: 2160, expenses: 1220, unpaidBills: 1430,
      totalCash: 5300, cashSurrendered: 5300, shortExcess: 0, cashCarriedForward: 5300,
      tenantId: chairman.id, locationId: chairLocation.id, userId: jackie.id,
    },
  });
  await prisma.dailySummary.create({
    data: {
      date: dateOnly(cDay1), cashBroughtForward: 4500, totalSales: 7200, debtsPaid: 500, otherIncome: 0,
      subtotal: 12200, mpesaReceived: 2800, purchases: 3500, expenses: 1500, unpaidBills: 840,
      totalCash: 3560, cashSurrendered: 3500, shortExcess: -60, cashCarriedForward: 6060,
      notes: "Short 60 bob - Jackie says counting error",
      tenantId: chairman.id, locationId: chairLocation.id, userId: jackie.id,
    },
  });

  // ─── Stock Movements (goods receipts) ─────────────────────────────────────
  const chairPurchases: [number, number, string][] = [
    [0, 24, "GR-EABL-001"], [8, 24, "GR-EABL-001"], [16, 24, "GR-EABL-001"],
    [13, 12, "GR-EABL-001"], [18, 12, "GR-EABL-001"],
    [46, 6, "GR-KWAL-001"], [49, 6, "GR-KWAL-001"], [55, 6, "GR-KWAL-001"],
  ];
  for (const [idx, qty, ref] of chairPurchases) {
    await prisma.stockMovement.create({
      data: {
        type: "GOODS_RECEIPT", quantity: qty,
        productId: createdChairProducts[idx].id, locationId: chairLocation.id,
        reference: ref, notes: "Restock delivery",
        tenantId: chairman.id, userId: johnMasaka.id, createdAt: cDay1,
      },
    });
  }

  console.log("  ✓ Club Chairman: 117 products, 2 users, stock records, orders, daily summary\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT 5: MAMA NJERI'S SHOP (Retail - Neighbourhood Duka)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("  Creating Mama Njeri's Shop...");

  const mamaNjeri = await prisma.tenant.create({
    data: {
      name: "Mama Njeri's Shop",
      slug: "mama-njeri",
      type: "RETAIL",
      tier: "STARTER",
      email: "mamanjeri@gmail.com",
      phone: "+254 712 345 678",
      address: "Jogoo Road, Eastlands",
      city: "Nairobi",
      currency: "KES",
      taxRate: 0,
      receiptHeader: "MAMA NJERI'S SHOP",
      receiptFooter: "Asante sana! Karibu tena.",
    },
  });

  const mnOwner = await prisma.user.create({
    data: { email: "mamanjeri@gmail.com", name: "Mary Njeri", phone: "+254 712 345 678", password: hash, role: "OWNER", tenantId: mamaNjeri.id },
  });
  const mnCashier = await prisma.user.create({
    data: { email: "cashier@mamanjeri.co.ke", name: "Faith Wambui", phone: "+254 723 456 789", password: hash, role: "CASHIER", tenantId: mamaNjeri.id },
  });

  const mnLocation = await prisma.location.create({
    data: { name: "Main Shop", address: "Jogoo Road, Eastlands", tenantId: mamaNjeri.id },
  });
  await prisma.register.create({ data: { name: "Counter 1", locationId: mnLocation.id } });

  const mnUnits = await Promise.all([
    prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: mamaNjeri.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Packet", abbreviation: "pkt", tenantId: mamaNjeri.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Kilogram", abbreviation: "kg", tenantId: mamaNjeri.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Dozen", abbreviation: "dz", tenantId: mamaNjeri.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Litre", abbreviation: "L", tenantId: mamaNjeri.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Box", abbreviation: "box", tenantId: mamaNjeri.id } }),
  ]);
  const [mnPc, mnPkt, mnKg, mnDz, mnL, mnBox] = mnUnits;

  const mnCats = await Promise.all([
    prisma.category.create({ data: { name: "Groceries", color: "#10b981", tenantId: mamaNjeri.id } }),
    prisma.category.create({ data: { name: "Beverages", color: "#f59e0b", tenantId: mamaNjeri.id } }),
    prisma.category.create({ data: { name: "Household", color: "#6366f1", tenantId: mamaNjeri.id } }),
    prisma.category.create({ data: { name: "Snacks & Sweets", color: "#f97316", tenantId: mamaNjeri.id } }),
    prisma.category.create({ data: { name: "Stationery", color: "#8b5cf6", tenantId: mamaNjeri.id } }),
    prisma.category.create({ data: { name: "Mobile & Airtime", color: "#ec4899", tenantId: mamaNjeri.id } }),
  ]);
  const [mnGrocery, mnBev, mnHouse, mnSnack, mnStation, mnMobile] = mnCats;

  const mnProducts = [
    { name: "Bread (White Loaf)", sku: "MN-GR-001", price: 65, cost: 50, cat: mnGrocery.id, image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200", uoms: [] },
    { name: "Eggs (Tray of 30)", sku: "MN-GR-002", price: 480, cost: 380, cat: mnGrocery.id, image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=200", uoms: [] },
    { name: "Tomatoes 1kg", sku: "MN-GR-003", price: 120, cost: 80, cat: mnGrocery.id, image: "https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=200", uoms: [] },
    { name: "Onions 1kg", sku: "MN-GR-004", price: 100, cost: 65, cat: mnGrocery.id, image: "https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=200", uoms: [] },
    { name: "Cooking Oil 500ml", sku: "MN-GR-005", price: 180, cost: 130, cat: mnGrocery.id, image: "https://images.unsplash.com/photo-1474979266404-7f28f2a0c767?w=200", uoms: [{ unit: mnBox, factor: 24, price: 4000, cost: 3000 }] },
    { name: "Maize Flour 2kg", sku: "MN-GR-006", price: 160, cost: 120, cat: mnGrocery.id, image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=200", uoms: [] },
    { name: "Tea Leaves 250g", sku: "MN-GR-007", price: 120, cost: 85, cat: mnGrocery.id, image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=200", uoms: [] },
    { name: "Milk 500ml", sku: "MN-BV-001", price: 65, cost: 48, cat: mnBev.id, image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=200", uoms: [] },
    { name: "Coca-Cola 300ml", sku: "MN-BV-002", price: 50, cost: 35, cat: mnBev.id, image: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=200", uoms: [{ unit: mnDz, factor: 12, price: 550, cost: 400 }] },
    { name: "Mineral Water 500ml", sku: "MN-BV-003", price: 30, cost: 18, cat: mnBev.id, image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200", uoms: [] },
    { name: "Bar Soap (Jamaa)", sku: "MN-HH-001", price: 50, cost: 35, cat: mnHouse.id, image: "https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=200", uoms: [{ unit: mnBox, factor: 48, price: 2200, cost: 1600 }] },
    { name: "Tissue Paper (Pack)", sku: "MN-HH-002", price: 80, cost: 55, cat: mnHouse.id, image: "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=200", uoms: [] },
    { name: "Matchbox", sku: "MN-HH-003", price: 10, cost: 5, cat: mnHouse.id, image: "https://images.unsplash.com/photo-1558618666-fcd25c85f7e7?w=200", uoms: [{ unit: mnDz, factor: 12, price: 100, cost: 55 }] },
    { name: "Biscuits (Glucose)", sku: "MN-SN-001", price: 20, cost: 12, cat: mnSnack.id, image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=200", uoms: [] },
    { name: "Sweets (Bag 50pc)", sku: "MN-SN-002", price: 100, cost: 60, cat: mnSnack.id, image: "https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=200", uoms: [] },
    { name: "Exercise Book (48pg)", sku: "MN-ST-001", price: 40, cost: 25, cat: mnStation.id, image: "https://images.unsplash.com/photo-1456735190827-d1262f71b8a7?w=200", uoms: [{ unit: mnDz, factor: 12, price: 440, cost: 280 }] },
    { name: "Pen (Bic)", sku: "MN-ST-002", price: 20, cost: 10, cat: mnStation.id, image: "https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=200", uoms: [] },
    { name: "Safaricom Airtime (100)", sku: "MN-MB-001", price: 100, cost: 95, cat: mnMobile.id, image: "https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=200", uoms: [] },
  ];

  const createdMnProducts: Product[] = [];
  for (const p of mnProducts) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, price: p.price, cost: p.cost,
        image: p.image, baseUnitId: mnPc.id, tenantId: mamaNjeri.id, categoryId: p.cat,
      },
    });
    createdMnProducts.push(product);
    if (p.uoms.length > 0) {
      await prisma.productUoM.createMany({
        data: p.uoms.map((u, idx) => ({
          productId: product.id, unitId: u.unit.id,
          conversionFactor: u.factor, price: u.price, cost: u.cost,
          isDefault: idx === 0,
        })),
      });
    }
    await prisma.stock.create({
      data: { quantity: 20 + Math.floor(Math.random() * 60), productId: product.id, locationId: mnLocation.id },
    });
  }

  const mnOrders = [
    { items: [{ idx: 0, qty: 2 }, { idx: 7, qty: 1 }, { idx: 3, qty: 1 }], method: "CASH" as const },
    { items: [{ idx: 8, qty: 3 }, { idx: 13, qty: 5 }, { idx: 17, qty: 1 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 1, qty: 1 }, { idx: 5, qty: 2 }, { idx: 10, qty: 2 }], method: "CASH" as const },
    { items: [{ idx: 4, qty: 1 }, { idx: 6, qty: 1 }, { idx: 9, qty: 2 }], method: "CASH" as const },
    { items: [{ idx: 15, qty: 6 }, { idx: 16, qty: 4 }, { idx: 11, qty: 2 }], method: "MPESA_MANUAL" as const },
  ];
  for (const orderData of mnOrders) {
    const orderItems = orderData.items.map(i => {
      const p = createdMnProducts[i.idx];
      return { productId: p.id, quantity: i.qty, unitPrice: p.price, total: p.price * i.qty, baseQuantity: i.qty };
    });
    const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
    const order = await prisma.order.create({
      data: {
        orderNo: generateOrderNo(), status: "COMPLETED", subtotal, taxAmount: 0, total: subtotal, discount: 0,
        paymentMethod: orderData.method, paymentStatus: "COMPLETED",
        tenantId: mamaNjeri.id, locationId: mnLocation.id, userId: mnCashier.id,
        items: { create: orderItems },
      },
    });
    await prisma.transaction.create({
      data: {
        type: "SALE", amount: subtotal, method: orderData.method, status: "COMPLETED",
        reference: `TXN-MN-${order.orderNo.replace("ORD-", "")}`,
        description: `Sale ${order.orderNo}`, tenantId: mamaNjeri.id, orderId: order.id, userId: mnCashier.id,
      },
    });
  }

  await prisma.expense.createMany({
    data: [
      { date: dateOnly(daysAgo(2)), category: "Rent", description: "Monthly shop rent", amount: 12000, tenantId: mamaNjeri.id, locationId: mnLocation.id, userId: mnOwner.id, isRecurring: true },
      { date: dateOnly(daysAgo(1)), category: "Transport", description: "Market trip for fresh produce", amount: 500, tenantId: mamaNjeri.id, locationId: mnLocation.id, userId: mnOwner.id },
      { date: dateOnly(daysAgo(0)), category: "Utilities", description: "Electricity token", amount: 1000, tenantId: mamaNjeri.id, locationId: mnLocation.id, userId: mnOwner.id },
    ],
  });

  console.log("  ✓ Mama Njeri's Shop: 18 products, 2 users, 5 orders\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT 6: SAFARI BITES RESTAURANT
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("  Creating Safari Bites Restaurant...");

  const safari = await prisma.tenant.create({
    data: {
      name: "Safari Bites Restaurant",
      slug: "safari-bites",
      type: "RESTAURANT",
      tier: "PROFESSIONAL",
      email: "info@safaribites.co.ke",
      phone: "+254 700 111 222",
      address: "Kimathi Street, CBD",
      city: "Nairobi",
      currency: "KES",
      taxRate: 16.0,
      receiptHeader: "SAFARI BITES RESTAURANT",
      receiptFooter: "Asante! Enjoy your meal.",
    },
  });

  const sfOwner = await prisma.user.create({
    data: { email: "admin@safaribites.co.ke", name: "Chef Samuel Odera", phone: "+254 700 111 222", password: hash, role: "OWNER", tenantId: safari.id },
  });
  const sfCashier = await prisma.user.create({
    data: { email: "cashier@safaribites.co.ke", name: "Priscilla Akinyi", phone: "+254 711 222 333", password: hash, role: "CASHIER", tenantId: safari.id },
  });
  const sfKitchen = await prisma.user.create({
    data: { email: "kitchen@safaribites.co.ke", name: "Joseph Kimani", phone: "+254 722 333 444", password: hash, role: "KITCHEN", tenantId: safari.id },
  });

  const sfLocation = await prisma.location.create({
    data: { name: "Main Dining", address: "Kimathi Street, CBD", tenantId: safari.id },
  });
  await prisma.register.create({ data: { name: "POS 1", locationId: sfLocation.id } });

  // Restaurant units
  const sfUnits = await Promise.all([
    prisma.unitOfMeasure.create({ data: { name: "Plate", abbreviation: "plt", tenantId: safari.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Portion", abbreviation: "ptn", tenantId: safari.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Glass", abbreviation: "gls", tenantId: safari.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Bottle", abbreviation: "btl", tenantId: safari.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Cup", abbreviation: "cup", tenantId: safari.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: safari.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Jug", abbreviation: "jug", tenantId: safari.id } }),
  ]);
  const [sfPlt, sfPtn, sfGls, sfBtl, sfCup, sfPc, sfJug] = sfUnits;

  const sfCats = await Promise.all([
    prisma.category.create({ data: { name: "Main Dishes", color: "#ef4444", tenantId: safari.id } }),
    prisma.category.create({ data: { name: "Breakfast", color: "#f59e0b", tenantId: safari.id } }),
    prisma.category.create({ data: { name: "Sides & Starters", color: "#10b981", tenantId: safari.id } }),
    prisma.category.create({ data: { name: "Beverages", color: "#6366f1", tenantId: safari.id } }),
    prisma.category.create({ data: { name: "Desserts", color: "#ec4899", tenantId: safari.id } }),
  ]);
  const [sfMain, sfBreakfast, sfSides, sfDrinks, sfDessert] = sfCats;

  const sfProducts = [
    { name: "Pilau (Chicken)", sku: "SF-MN-001", price: 450, cost: 180, unit: sfPlt, cat: sfMain.id, image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200", uoms: [] },
    { name: "Ugali + Nyama Choma", sku: "SF-MN-002", price: 550, cost: 220, unit: sfPlt, cat: sfMain.id, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=200", uoms: [] },
    { name: "Chapati + Beans", sku: "SF-MN-003", price: 200, cost: 70, unit: sfPlt, cat: sfMain.id, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=200", uoms: [] },
    { name: "Chicken Biryani", sku: "SF-MN-004", price: 600, cost: 250, unit: sfPlt, cat: sfMain.id, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200", uoms: [] },
    { name: "Tilapia Fry + Ugali", sku: "SF-MN-005", price: 650, cost: 300, unit: sfPlt, cat: sfMain.id, image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a5?w=200", uoms: [] },
    { name: "Githeri Special", sku: "SF-MN-006", price: 250, cost: 80, unit: sfPlt, cat: sfMain.id, image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=200", uoms: [] },
    { name: "English Breakfast", sku: "SF-BF-001", price: 400, cost: 150, unit: sfPlt, cat: sfBreakfast.id, image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=200", uoms: [] },
    { name: "Mandazi (3pc)", sku: "SF-BF-002", price: 50, cost: 15, unit: sfPtn, cat: sfBreakfast.id, image: "https://images.unsplash.com/photo-1604467707321-70d009801bf4?w=200", uoms: [] },
    { name: "Samosa (Beef)", sku: "SF-SD-001", price: 80, cost: 30, unit: sfPc, cat: sfSides.id, image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=200", uoms: [] },
    { name: "Chips (French Fries)", sku: "SF-SD-002", price: 200, cost: 60, unit: sfPtn, cat: sfSides.id, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200", uoms: [] },
    { name: "Kachumbari", sku: "SF-SD-003", price: 50, cost: 15, unit: sfPtn, cat: sfSides.id, image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200", uoms: [] },
    { name: "Fresh Mango Juice", sku: "SF-BV-001", price: 200, cost: 60, unit: sfGls, cat: sfDrinks.id, image: "https://images.unsplash.com/photo-1546173159-315724a31696?w=200", uoms: [{ unit: sfJug, factor: 5, price: 900, cost: 280 }] },
    { name: "Passion Fruit Juice", sku: "SF-BV-002", price: 200, cost: 60, unit: sfGls, cat: sfDrinks.id, image: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=200", uoms: [{ unit: sfJug, factor: 5, price: 900, cost: 280 }] },
    { name: "Masala Chai", sku: "SF-BV-003", price: 80, cost: 20, unit: sfCup, cat: sfDrinks.id, image: "https://images.unsplash.com/photo-1571934811356-5cc061b6211f?w=200", uoms: [] },
    { name: "Coca-Cola 300ml", sku: "SF-BV-004", price: 80, cost: 45, unit: sfBtl, cat: sfDrinks.id, image: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=200", uoms: [] },
    { name: "Bottled Water 500ml", sku: "SF-BV-005", price: 50, cost: 25, unit: sfBtl, cat: sfDrinks.id, image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200", uoms: [] },
    { name: "Fruit Salad", sku: "SF-DS-001", price: 250, cost: 80, unit: sfPtn, cat: sfDessert.id, image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=200", uoms: [] },
    { name: "Ice Cream (Scoop)", sku: "SF-DS-002", price: 150, cost: 50, unit: sfPc, cat: sfDessert.id, image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=200", uoms: [] },
  ];

  const createdSfProducts: Product[] = [];
  for (const p of sfProducts) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, price: p.price, cost: p.cost,
        image: p.image, baseUnitId: p.unit.id, tenantId: safari.id, categoryId: p.cat,
      },
    });
    createdSfProducts.push(product);
    if (p.uoms.length > 0) {
      await prisma.productUoM.createMany({
        data: p.uoms.map((u, idx) => ({
          productId: product.id, unitId: u.unit.id,
          conversionFactor: u.factor, price: u.price, cost: u.cost,
          isDefault: idx === 0,
        })),
      });
    }
    await prisma.stock.create({
      data: { quantity: 50 + Math.floor(Math.random() * 100), productId: product.id, locationId: sfLocation.id },
    });
  }

  // Restaurant Tables
  const sfTables = await Promise.all([
    prisma.table.create({ data: { name: "Table 1", capacity: 4, status: "AVAILABLE", locationId: sfLocation.id, tenantId: safari.id } }),
    prisma.table.create({ data: { name: "Table 2", capacity: 4, status: "OCCUPIED", locationId: sfLocation.id, tenantId: safari.id } }),
    prisma.table.create({ data: { name: "Table 3", capacity: 6, status: "AVAILABLE", locationId: sfLocation.id, tenantId: safari.id } }),
    prisma.table.create({ data: { name: "Table 4", capacity: 2, status: "RESERVED", locationId: sfLocation.id, tenantId: safari.id } }),
    prisma.table.create({ data: { name: "Table 5", capacity: 8, status: "AVAILABLE", locationId: sfLocation.id, tenantId: safari.id } }),
    prisma.table.create({ data: { name: "Outdoor 1", capacity: 4, status: "AVAILABLE", locationId: sfLocation.id, tenantId: safari.id } }),
    prisma.table.create({ data: { name: "Outdoor 2", capacity: 6, status: "AVAILABLE", locationId: sfLocation.id, tenantId: safari.id } }),
    prisma.table.create({ data: { name: "VIP Room", capacity: 10, status: "AVAILABLE", locationId: sfLocation.id, tenantId: safari.id } }),
  ]);

  // Delivery Zones
  await prisma.deliveryZone.createMany({
    data: [
      { name: "CBD (Walking)", minOrder: 300, deliveryFee: 0, estimatedTime: 10, tenantId: safari.id },
      { name: "Upperhill", minOrder: 500, deliveryFee: 150, estimatedTime: 25, tenantId: safari.id },
      { name: "Westlands", minOrder: 800, deliveryFee: 250, estimatedTime: 35, tenantId: safari.id },
      { name: "Kilimani / Hurlingham", minOrder: 600, deliveryFee: 200, estimatedTime: 30, tenantId: safari.id },
    ],
  });

  // Customers
  const sfCustomer1 = await prisma.customer.create({
    data: { name: "John Kamau", phone: "+254 722 111 000", email: "john.kamau@email.com", totalSpent: 3200, visitCount: 8, loyaltyPoints: 32, tenantId: safari.id },
  });
  const sfCustomer2 = await prisma.customer.create({
    data: { name: "Angela Omondi", phone: "+254 733 222 000", totalSpent: 5600, visitCount: 15, loyaltyPoints: 56, tenantId: safari.id },
  });
  await prisma.customer.create({
    data: { name: "Peter Mutua", phone: "+254 712 333 000", totalSpent: 1800, visitCount: 5, loyaltyPoints: 18, tenantId: safari.id },
  });

  // Discounts
  await prisma.discount.createMany({
    data: [
      { name: "Lunch Special 10%", code: "LUNCH10", type: "PERCENTAGE", value: 10, minOrder: 500, isActive: true, tenantId: safari.id },
      { name: "New Customer KES 100 Off", code: "WELCOME", type: "FIXED", value: 100, minOrder: 300, maxUses: 50, usedCount: 12, isActive: true, tenantId: safari.id },
    ],
  });

  // Restaurant orders (some with tables, some delivery, some dine-in)
  const sfOrders = [
    { items: [{ idx: 0, qty: 2 }, { idx: 9, qty: 2 }, { idx: 14, qty: 2 }], method: "CASH" as const, tableIdx: 0 },
    { items: [{ idx: 1, qty: 1 }, { idx: 4, qty: 1 }, { idx: 11, qty: 2 }], method: "MPESA_MANUAL" as const, tableIdx: 1, customerId: sfCustomer1.id },
    { items: [{ idx: 3, qty: 3 }, { idx: 8, qty: 4 }, { idx: 12, qty: 3 }, { idx: 16, qty: 2 }], method: "CARD" as const, tableIdx: 4, customerId: sfCustomer2.id },
    { items: [{ idx: 2, qty: 4 }, { idx: 10, qty: 4 }, { idx: 13, qty: 4 }], method: "CASH" as const },
    { items: [{ idx: 6, qty: 2 }, { idx: 7, qty: 6 }, { idx: 13, qty: 2 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 5, qty: 3 }, { idx: 14, qty: 3 }, { idx: 15, qty: 3 }], method: "CASH" as const, delivery: true },
    { items: [{ idx: 0, qty: 1 }, { idx: 8, qty: 2 }, { idx: 17, qty: 1 }, { idx: 13, qty: 1 }], method: "CARD" as const, tableIdx: 2 },
  ];
  for (let i = 0; i < sfOrders.length; i++) {
    const o = sfOrders[i];
    const orderItems = o.items.map(it => {
      const p = createdSfProducts[it.idx];
      return { productId: p.id, quantity: it.qty, unitPrice: p.price, total: p.price * it.qty, baseQuantity: it.qty, kitchenStatus: "SERVED" as const };
    });
    const subtotal = orderItems.reduce((s, it) => s + it.total, 0);
    const taxAmount = subtotal * 0.16;
    const total = subtotal + taxAmount + (o.delivery ? 200 : 0);
    const order = await prisma.order.create({
      data: {
        orderNo: `SF-${String(i + 1).padStart(4, "0")}`, status: "COMPLETED", subtotal, taxAmount, total, discount: 0,
        paymentMethod: o.method, paymentStatus: "COMPLETED",
        tenantId: safari.id, locationId: sfLocation.id, userId: sfCashier.id,
        ...("tableIdx" in o && o.tableIdx !== undefined ? { tableId: sfTables[o.tableIdx].id } : {}),
        ...("customerId" in o ? { customerId: o.customerId } : {}),
        ...("delivery" in o ? { deliveryAddress: "Upperhill, Ralph Bunche Road", deliveryPhone: "+254 722 999 888", deliveryFee: 200 } : {}),
        items: { create: orderItems },
        createdAt: new Date(daysAgo(0).getTime() + (i + 1) * 3600000),
      },
    });
    await prisma.transaction.create({
      data: {
        type: "SALE", amount: total, method: o.method, status: "COMPLETED",
        reference: `TXN-SF-${String(i + 1).padStart(4, "0")}`,
        description: `Sale ${order.orderNo}`, tenantId: safari.id, orderId: order.id, userId: sfCashier.id,
        createdAt: new Date(daysAgo(0).getTime() + (i + 1) * 3600000),
      },
    });
  }

  // A pending kitchen order
  const pendingItems = [
    { productId: createdSfProducts[3].id, quantity: 1, unitPrice: 600, total: 600, baseQuantity: 1, kitchenStatus: "PREPARING" as const },
    { productId: createdSfProducts[9].id, quantity: 1, unitPrice: 200, total: 200, baseQuantity: 1, kitchenStatus: "PENDING" as const },
    { productId: createdSfProducts[14].id, quantity: 2, unitPrice: 80, total: 160, baseQuantity: 2, kitchenStatus: "READY" as const },
  ];
  await prisma.order.create({
    data: {
      orderNo: `SF-${String(sfOrders.length + 1).padStart(4, "0")}`, status: "PREPARING",
      subtotal: 960, taxAmount: 153.6, total: 1113.6, discount: 0,
      paymentMethod: "CASH", paymentStatus: "PENDING",
      tenantId: safari.id, locationId: sfLocation.id, userId: sfCashier.id,
      tableId: sfTables[3].id,
      items: { create: pendingItems },
    },
  });

  await prisma.expense.createMany({
    data: [
      { date: dateOnly(daysAgo(3)), category: "Rent", description: "Monthly restaurant rent", amount: 85000, tenantId: safari.id, locationId: sfLocation.id, userId: sfOwner.id, isRecurring: true },
      { date: dateOnly(daysAgo(2)), category: "Food Supplies", description: "Meat and vegetables from market", amount: 15000, supplier: "City Market Vendors", tenantId: safari.id, locationId: sfLocation.id, userId: sfOwner.id },
      { date: dateOnly(daysAgo(1)), category: "Gas", description: "Cooking gas refill (6kg x 4)", amount: 9600, supplier: "K-Gas Distributor", tenantId: safari.id, locationId: sfLocation.id, userId: sfOwner.id },
      { date: dateOnly(daysAgo(1)), category: "Staff", description: "Kitchen staff daily wages", amount: 4500, tenantId: safari.id, locationId: sfLocation.id, userId: sfOwner.id },
      { date: dateOnly(daysAgo(0)), category: "Delivery", description: "Rider fuel allowance", amount: 1500, tenantId: safari.id, locationId: sfLocation.id, userId: sfOwner.id },
    ],
  });

  console.log("  ✓ Safari Bites: 18 products, 3 users, tables, delivery zones, orders\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT 7: AFYA PHARMACY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("  Creating Afya Pharmacy...");

  const afya = await prisma.tenant.create({
    data: {
      name: "Afya Pharmacy",
      slug: "afya-pharmacy",
      type: "PHARMACY",
      tier: "PROFESSIONAL",
      email: "info@afyapharmacy.co.ke",
      phone: "+254 700 444 555",
      address: "Moi Avenue, Eldoret",
      city: "Eldoret",
      currency: "KES",
      taxRate: 0,
      receiptHeader: "AFYA PHARMACY",
      receiptFooter: "Get well soon! Your health is our priority.",
    },
  });

  const afOwner = await prisma.user.create({
    data: { email: "admin@afyapharmacy.co.ke", name: "Dr. Alice Chebet", phone: "+254 700 444 555", password: hash, role: "OWNER", tenantId: afya.id },
  });
  const afCashier = await prisma.user.create({
    data: { email: "cashier@afyapharmacy.co.ke", name: "Sarah Kiplagat", phone: "+254 711 555 666", password: hash, role: "CASHIER", tenantId: afya.id },
  });
  await prisma.user.create({
    data: { email: "stock@afyapharmacy.co.ke", name: "David Rono", phone: "+254 722 666 777", password: hash, role: "STOCK_KEEPER", tenantId: afya.id },
  });

  const afLocation = await prisma.location.create({
    data: { name: "Main Pharmacy", address: "Moi Avenue, Eldoret", tenantId: afya.id },
  });
  await prisma.register.create({ data: { name: "Dispensary Counter", locationId: afLocation.id } });

  const afUnits = await Promise.all([
    prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: afya.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Strip", abbreviation: "str", tenantId: afya.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Box", abbreviation: "box", tenantId: afya.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Bottle", abbreviation: "btl", tenantId: afya.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Packet", abbreviation: "pkt", tenantId: afya.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Tube", abbreviation: "tube", tenantId: afya.id } }),
  ]);
  const [afPc, afStr, afBox, afBtl, afPkt, afTube] = afUnits;

  const afCats = await Promise.all([
    prisma.category.create({ data: { name: "Pain & Fever", color: "#ef4444", tenantId: afya.id } }),
    prisma.category.create({ data: { name: "Cough & Cold", color: "#f59e0b", tenantId: afya.id } }),
    prisma.category.create({ data: { name: "Antibiotics", color: "#8b5cf6", tenantId: afya.id } }),
    prisma.category.create({ data: { name: "Vitamins & Supplements", color: "#10b981", tenantId: afya.id } }),
    prisma.category.create({ data: { name: "First Aid", color: "#ec4899", tenantId: afya.id } }),
    prisma.category.create({ data: { name: "Personal Care", color: "#06b6d4", tenantId: afya.id } }),
    prisma.category.create({ data: { name: "Baby Care", color: "#d946ef", tenantId: afya.id } }),
  ]);
  const [afPain, afCough, afAnti, afVitamin, afFirstAid, afCare, afBaby] = afCats;

  const afProducts = [
    { name: "Panadol Extra (Strip 10)", sku: "AF-PF-001", price: 120, cost: 75, unit: afStr, cat: afPain.id, image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200", uoms: [{ unit: afBox, factor: 10, price: 1100, cost: 700 }] },
    { name: "Ibuprofen 400mg (Strip 10)", sku: "AF-PF-002", price: 80, cost: 45, unit: afStr, cat: afPain.id, image: "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200", uoms: [{ unit: afBox, factor: 10, price: 750, cost: 420 }] },
    { name: "Aspirin 300mg (Strip 10)", sku: "AF-PF-003", price: 50, cost: 25, unit: afStr, cat: afPain.id, image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=200", uoms: [] },
    { name: "Cough Syrup (100ml)", sku: "AF-CC-001", price: 250, cost: 150, unit: afBtl, cat: afCough.id, image: "https://images.unsplash.com/photo-1631549916768-4ab70f244c3c?w=200", uoms: [] },
    { name: "Strepsils Lozenges (Pack 8)", sku: "AF-CC-002", price: 180, cost: 110, unit: afPkt, cat: afCough.id, image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=200", uoms: [] },
    { name: "Vicks VapoRub 50g", sku: "AF-CC-003", price: 350, cost: 220, unit: afPc, cat: afCough.id, image: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=200", uoms: [] },
    { name: "Amoxicillin 500mg (Strip 10)", sku: "AF-AB-001", price: 200, cost: 120, unit: afStr, cat: afAnti.id, image: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=200", uoms: [{ unit: afBox, factor: 10, price: 1800, cost: 1100 }] },
    { name: "Metronidazole 400mg (Strip 10)", sku: "AF-AB-002", price: 100, cost: 55, unit: afStr, cat: afAnti.id, image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=200", uoms: [] },
    { name: "Vitamin C 1000mg (Strip 10)", sku: "AF-VT-001", price: 150, cost: 80, unit: afStr, cat: afVitamin.id, image: "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200", uoms: [{ unit: afBox, factor: 10, price: 1400, cost: 750 }] },
    { name: "Multivitamins (Bottle 60)", sku: "AF-VT-002", price: 800, cost: 480, unit: afBtl, cat: afVitamin.id, image: "https://images.unsplash.com/photo-1577401239170-897942555fb3?w=200", uoms: [] },
    { name: "Zinc Tablets (Strip 10)", sku: "AF-VT-003", price: 120, cost: 65, unit: afStr, cat: afVitamin.id, image: "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200", uoms: [] },
    { name: "Bandages (Roll)", sku: "AF-FA-001", price: 150, cost: 80, unit: afPc, cat: afFirstAid.id, image: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=200", uoms: [] },
    { name: "Cotton Wool 50g", sku: "AF-FA-002", price: 100, cost: 50, unit: afPkt, cat: afFirstAid.id, image: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=200", uoms: [] },
    { name: "Plasters (Pack 20)", sku: "AF-FA-003", price: 200, cost: 100, unit: afPkt, cat: afFirstAid.id, image: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=200", uoms: [] },
    { name: "Hand Sanitizer 250ml", sku: "AF-PC-001", price: 350, cost: 200, unit: afBtl, cat: afCare.id, image: "https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=200", uoms: [] },
    { name: "Vaseline Petroleum Jelly 250ml", sku: "AF-PC-002", price: 280, cost: 180, unit: afPc, cat: afCare.id, image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=200", uoms: [] },
    { name: "Dettol Antiseptic 500ml", sku: "AF-PC-003", price: 450, cost: 280, unit: afBtl, cat: afCare.id, image: "https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=200", uoms: [] },
    { name: "Baby Panadol Drops 15ml", sku: "AF-BB-001", price: 300, cost: 180, unit: afBtl, cat: afBaby.id, image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200", uoms: [] },
    { name: "Gripe Water 150ml", sku: "AF-BB-002", price: 350, cost: 200, unit: afBtl, cat: afBaby.id, image: "https://images.unsplash.com/photo-1631549916768-4ab70f244c3c?w=200", uoms: [] },
    { name: "Diaper Rash Cream 50g", sku: "AF-BB-003", price: 400, cost: 250, unit: afTube, cat: afBaby.id, image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=200", uoms: [] },
  ];

  const createdAfProducts: Product[] = [];
  for (const p of afProducts) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, price: p.price, cost: p.cost,
        image: p.image, baseUnitId: p.unit.id, tenantId: afya.id, categoryId: p.cat,
      },
    });
    createdAfProducts.push(product);
    if (p.uoms.length > 0) {
      await prisma.productUoM.createMany({
        data: p.uoms.map((u, idx) => ({
          productId: product.id, unitId: u.unit.id,
          conversionFactor: u.factor, price: u.price, cost: u.cost,
          isDefault: idx === 0,
        })),
      });
    }
    await prisma.stock.create({
      data: { quantity: 30 + Math.floor(Math.random() * 120), productId: product.id, locationId: afLocation.id },
    });
  }

  const afOrders = [
    { items: [{ idx: 0, qty: 2 }, { idx: 3, qty: 1 }], method: "CASH" as const },
    { items: [{ idx: 6, qty: 1 }, { idx: 8, qty: 2 }, { idx: 11, qty: 1 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 1, qty: 3 }, { idx: 4, qty: 2 }, { idx: 14, qty: 1 }], method: "CASH" as const },
    { items: [{ idx: 9, qty: 1 }, { idx: 15, qty: 1 }, { idx: 16, qty: 1 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 17, qty: 1 }, { idx: 18, qty: 1 }, { idx: 19, qty: 1 }], method: "CASH" as const },
    { items: [{ idx: 2, qty: 4 }, { idx: 7, qty: 2 }, { idx: 12, qty: 2 }, { idx: 13, qty: 1 }], method: "CARD" as const },
  ];
  for (const orderData of afOrders) {
    const orderItems = orderData.items.map(i => {
      const p = createdAfProducts[i.idx];
      return { productId: p.id, quantity: i.qty, unitPrice: p.price, total: p.price * i.qty, baseQuantity: i.qty };
    });
    const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
    const order = await prisma.order.create({
      data: {
        orderNo: generateOrderNo(), status: "COMPLETED", subtotal, taxAmount: 0, total: subtotal, discount: 0,
        paymentMethod: orderData.method, paymentStatus: "COMPLETED",
        tenantId: afya.id, locationId: afLocation.id, userId: afCashier.id,
        items: { create: orderItems },
      },
    });
    await prisma.transaction.create({
      data: {
        type: "SALE", amount: subtotal, method: orderData.method, status: "COMPLETED",
        reference: `TXN-AF-${order.orderNo.replace("ORD-", "")}`,
        description: `Sale ${order.orderNo}`, tenantId: afya.id, orderId: order.id, userId: afCashier.id,
      },
    });
  }

  await prisma.expense.createMany({
    data: [
      { date: dateOnly(daysAgo(3)), category: "Rent", description: "Monthly pharmacy rent", amount: 40000, tenantId: afya.id, locationId: afLocation.id, userId: afOwner.id, isRecurring: true },
      { date: dateOnly(daysAgo(2)), category: "Supplies", description: "Drug restock from supplier", amount: 65000, supplier: "PharmAccess Kenya", tenantId: afya.id, locationId: afLocation.id, userId: afOwner.id, receiptNo: "PAK-5521" },
      { date: dateOnly(daysAgo(1)), category: "Utilities", description: "Electricity bill", amount: 3500, tenantId: afya.id, locationId: afLocation.id, userId: afOwner.id },
      { date: dateOnly(daysAgo(0)), category: "Licensing", description: "Pharmacy board license renewal", amount: 15000, tenantId: afya.id, locationId: afLocation.id, userId: afOwner.id, receiptNo: "PPB-2024-ELD" },
    ],
  });

  console.log("  ✓ Afya Pharmacy: 20 products, 3 users, 6 orders\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT 8: JENGO HARDWARE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("  Creating Jengo Hardware...");

  const jengo = await prisma.tenant.create({
    data: {
      name: "Jengo Hardware",
      slug: "jengo-hardware",
      type: "HARDWARE",
      tier: "PROFESSIONAL",
      email: "info@jengohardware.co.ke",
      phone: "+254 700 777 888",
      address: "Industrial Area, Mombasa Road",
      city: "Nairobi",
      currency: "KES",
      taxRate: 16.0,
      receiptHeader: "JENGO HARDWARE & BUILDING SUPPLIES",
      receiptFooter: "Building Kenya, one nail at a time!",
    },
  });

  const jgOwner = await prisma.user.create({
    data: { email: "admin@jengohardware.co.ke", name: "Patrick Muthomi", phone: "+254 700 777 888", password: hash, role: "OWNER", tenantId: jengo.id },
  });
  const jgCashier = await prisma.user.create({
    data: { email: "cashier@jengohardware.co.ke", name: "Rose Muthoni", phone: "+254 711 888 999", password: hash, role: "CASHIER", tenantId: jengo.id },
  });
  await prisma.user.create({
    data: { email: "stock@jengohardware.co.ke", name: "Stephen Kariuki", phone: "+254 722 999 000", password: hash, role: "STOCK_KEEPER", tenantId: jengo.id },
  });

  const jgLocation = await prisma.location.create({
    data: { name: "Main Yard", address: "Industrial Area, Mombasa Road", tenantId: jengo.id },
  });
  await prisma.register.create({ data: { name: "Counter 1", locationId: jgLocation.id } });

  const jgUnits = await Promise.all([
    prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: jengo.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Bag", abbreviation: "bag", tenantId: jengo.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Sheet", abbreviation: "sht", tenantId: jengo.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Metre", abbreviation: "m", tenantId: jengo.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Kilogram", abbreviation: "kg", tenantId: jengo.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Litre", abbreviation: "L", tenantId: jengo.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Roll", abbreviation: "roll", tenantId: jengo.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Box", abbreviation: "box", tenantId: jengo.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Pair", abbreviation: "pair", tenantId: jengo.id } }),
  ]);
  const [jgPc, jgBag, jgSht, jgM, jgKg, jgL, jgRoll, jgBox, jgPair] = jgUnits;

  const jgCats = await Promise.all([
    prisma.category.create({ data: { name: "Cement & Concrete", color: "#78716c", tenantId: jengo.id } }),
    prisma.category.create({ data: { name: "Iron & Steel", color: "#6366f1", tenantId: jengo.id } }),
    prisma.category.create({ data: { name: "Paint & Finishes", color: "#f59e0b", tenantId: jengo.id } }),
    prisma.category.create({ data: { name: "Plumbing", color: "#06b6d4", tenantId: jengo.id } }),
    prisma.category.create({ data: { name: "Electrical", color: "#ef4444", tenantId: jengo.id } }),
    prisma.category.create({ data: { name: "Tools", color: "#10b981", tenantId: jengo.id } }),
    prisma.category.create({ data: { name: "Timber & Wood", color: "#92400e", tenantId: jengo.id } }),
    prisma.category.create({ data: { name: "Nails & Fasteners", color: "#8b5cf6", tenantId: jengo.id } }),
  ]);
  const [jgCement, jgIron, jgPaint, jgPlumb, jgElec, jgTools, jgTimber, jgNails] = jgCats;

  const jgProducts = [
    { name: "Bamburi Cement (50kg)", sku: "JG-CM-001", price: 850, cost: 680, unit: jgBag, cat: jgCement.id, image: "https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=200", uoms: [] },
    { name: "Blue Triangle Cement (50kg)", sku: "JG-CM-002", price: 820, cost: 660, unit: jgBag, cat: jgCement.id, image: "https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=200", uoms: [] },
    { name: "Building Sand (Ton)", sku: "JG-CM-003", price: 2500, cost: 1800, unit: jgPc, cat: jgCement.id, image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=200", uoms: [] },
    { name: "Iron Sheet (Gauge 30, 3m)", sku: "JG-IR-001", price: 650, cost: 480, unit: jgSht, cat: jgIron.id, image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200", uoms: [] },
    { name: "Iron Sheet (Gauge 28, 3m)", sku: "JG-IR-002", price: 850, cost: 650, unit: jgSht, cat: jgIron.id, image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200", uoms: [] },
    { name: "Y12 Iron Bar (12m)", sku: "JG-IR-003", price: 900, cost: 700, unit: jgPc, cat: jgIron.id, image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200", uoms: [] },
    { name: "BW Wire (25kg)", sku: "JG-IR-004", price: 3800, cost: 3000, unit: jgRoll, cat: jgIron.id, image: "https://images.unsplash.com/photo-1558618666-fcd25c85f7e7?w=200", uoms: [] },
    { name: "Crown Paint (4L, White)", sku: "JG-PT-001", price: 2200, cost: 1600, unit: jgPc, cat: jgPaint.id, image: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=200", uoms: [] },
    { name: "Crown Paint (4L, Coloured)", sku: "JG-PT-002", price: 2800, cost: 2100, unit: jgPc, cat: jgPaint.id, image: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=200", uoms: [] },
    { name: "Paint Brush (4 inch)", sku: "JG-PT-003", price: 250, cost: 150, unit: jgPc, cat: jgPaint.id, image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=200", uoms: [] },
    { name: "PVC Pipe 3/4 inch (3m)", sku: "JG-PL-001", price: 250, cost: 160, unit: jgPc, cat: jgPlumb.id, image: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=200", uoms: [] },
    { name: "PVC Pipe 1 inch (3m)", sku: "JG-PL-002", price: 380, cost: 250, unit: jgPc, cat: jgPlumb.id, image: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=200", uoms: [] },
    { name: "Ball Valve 1/2 inch", sku: "JG-PL-003", price: 450, cost: 280, unit: jgPc, cat: jgPlumb.id, image: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=200", uoms: [] },
    { name: "Electrical Wire (2.5mm, 100m)", sku: "JG-EL-001", price: 4500, cost: 3500, unit: jgRoll, cat: jgElec.id, image: "https://images.unsplash.com/photo-1558618666-fcd25c85f7e7?w=200", uoms: [] },
    { name: "Light Switch (Single)", sku: "JG-EL-002", price: 150, cost: 80, unit: jgPc, cat: jgElec.id, image: "https://images.unsplash.com/photo-1558618666-fcd25c85f7e7?w=200", uoms: [{ unit: jgBox, factor: 20, price: 2800, cost: 1500 }] },
    { name: "Socket (Double)", sku: "JG-EL-003", price: 350, cost: 200, unit: jgPc, cat: jgElec.id, image: "https://images.unsplash.com/photo-1558618666-fcd25c85f7e7?w=200", uoms: [] },
    { name: "Claw Hammer", sku: "JG-TL-001", price: 650, cost: 400, unit: jgPc, cat: jgTools.id, image: "https://images.unsplash.com/photo-1586864387789-628af9feed72?w=200", uoms: [] },
    { name: "Tape Measure (5m)", sku: "JG-TL-002", price: 350, cost: 200, unit: jgPc, cat: jgTools.id, image: "https://images.unsplash.com/photo-1586864387789-628af9feed72?w=200", uoms: [] },
    { name: "Spirit Level (24 inch)", sku: "JG-TL-003", price: 800, cost: 500, unit: jgPc, cat: jgTools.id, image: "https://images.unsplash.com/photo-1586864387789-628af9feed72?w=200", uoms: [] },
    { name: "Cypress Timber 2x4 (4m)", sku: "JG-TB-001", price: 450, cost: 320, unit: jgPc, cat: jgTimber.id, image: "https://images.unsplash.com/photo-1541123603104-512919d6a96c?w=200", uoms: [] },
    { name: "Plywood Sheet (8x4)", sku: "JG-TB-002", price: 2800, cost: 2100, unit: jgSht, cat: jgTimber.id, image: "https://images.unsplash.com/photo-1541123603104-512919d6a96c?w=200", uoms: [] },
    { name: "Nails 4 inch (1kg)", sku: "JG-NL-001", price: 200, cost: 120, unit: jgKg, cat: jgNails.id, image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=200", uoms: [{ unit: jgBox, factor: 25, price: 4500, cost: 2800 }] },
    { name: "Nails 2 inch (1kg)", sku: "JG-NL-002", price: 220, cost: 130, unit: jgKg, cat: jgNails.id, image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=200", uoms: [] },
    { name: "Wood Screws (Pack 100)", sku: "JG-NL-003", price: 350, cost: 200, unit: jgPc, cat: jgNails.id, image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=200", uoms: [] },
  ];

  const createdJgProducts: Product[] = [];
  for (const p of jgProducts) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, price: p.price, cost: p.cost,
        image: p.image, baseUnitId: p.unit.id, tenantId: jengo.id, categoryId: p.cat,
      },
    });
    createdJgProducts.push(product);
    if (p.uoms.length > 0) {
      await prisma.productUoM.createMany({
        data: p.uoms.map((u, idx) => ({
          productId: product.id, unitId: u.unit.id,
          conversionFactor: u.factor, price: u.price, cost: u.cost,
          isDefault: idx === 0,
        })),
      });
    }
    await prisma.stock.create({
      data: { quantity: 10 + Math.floor(Math.random() * 80), productId: product.id, locationId: jgLocation.id },
    });
  }

  // Hardware customers (contractors buy in bulk)
  const jgCustomer1 = await prisma.customer.create({
    data: { name: "Mwangi Contractors Ltd", phone: "+254 722 000 111", totalSpent: 185000, visitCount: 24, loyaltyPoints: 185, tenantId: jengo.id },
  });
  await prisma.customer.create({
    data: { name: "Wafula Builders", phone: "+254 733 000 222", totalSpent: 95000, visitCount: 12, loyaltyPoints: 95, tenantId: jengo.id },
  });

  const jgOrders = [
    { items: [{ idx: 0, qty: 20 }, { idx: 3, qty: 30 }, { idx: 5, qty: 10 }], method: "MPESA_MANUAL" as const, customerId: jgCustomer1.id },
    { items: [{ idx: 7, qty: 5 }, { idx: 9, qty: 10 }, { idx: 21, qty: 5 }], method: "CASH" as const },
    { items: [{ idx: 10, qty: 20 }, { idx: 12, qty: 5 }, { idx: 13, qty: 2 }], method: "CARD" as const },
    { items: [{ idx: 19, qty: 10 }, { idx: 20, qty: 4 }, { idx: 16, qty: 2 }, { idx: 17, qty: 2 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 0, qty: 50 }, { idx: 1, qty: 30 }, { idx: 2, qty: 2 }, { idx: 6, qty: 2 }], method: "CARD" as const, customerId: jgCustomer1.id },
  ];
  for (const orderData of jgOrders) {
    const orderItems = orderData.items.map(i => {
      const p = createdJgProducts[i.idx];
      return { productId: p.id, quantity: i.qty, unitPrice: p.price, total: p.price * i.qty, baseQuantity: i.qty };
    });
    const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
    const taxAmount = subtotal * 0.16;
    const total = subtotal + taxAmount;
    const order = await prisma.order.create({
      data: {
        orderNo: generateOrderNo(), status: "COMPLETED", subtotal, taxAmount, total, discount: 0,
        paymentMethod: orderData.method, paymentStatus: "COMPLETED",
        tenantId: jengo.id, locationId: jgLocation.id, userId: jgCashier.id,
        ...("customerId" in orderData ? { customerId: orderData.customerId } : {}),
        items: { create: orderItems },
      },
    });
    await prisma.transaction.create({
      data: {
        type: "SALE", amount: total, method: orderData.method, status: "COMPLETED",
        reference: `TXN-JG-${order.orderNo.replace("ORD-", "")}`,
        description: `Sale ${order.orderNo}`, tenantId: jengo.id, orderId: order.id, userId: jgCashier.id,
      },
    });
  }

  await prisma.expense.createMany({
    data: [
      { date: dateOnly(daysAgo(3)), category: "Rent", description: "Yard and showroom rent", amount: 65000, tenantId: jengo.id, locationId: jgLocation.id, userId: jgOwner.id, isRecurring: true },
      { date: dateOnly(daysAgo(2)), category: "Transport", description: "Lorry hire for cement delivery", amount: 8000, supplier: "Mwamba Transport", tenantId: jengo.id, locationId: jgLocation.id, userId: jgOwner.id },
      { date: dateOnly(daysAgo(1)), category: "Staff", description: "Loader wages (3 workers)", amount: 4500, tenantId: jengo.id, locationId: jgLocation.id, userId: jgOwner.id },
      { date: dateOnly(daysAgo(0)), category: "Maintenance", description: "Forklift service", amount: 12000, supplier: "AutoParts Kenya", tenantId: jengo.id, locationId: jgLocation.id, userId: jgOwner.id, receiptNo: "APK-7832" },
    ],
  });

  console.log("  ✓ Jengo Hardware: 24 products, 3 users, 5 orders\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT 9: SHARP CUTS BARBERSHOP
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("  Creating Sharp Cuts Barbershop...");

  const sharp = await prisma.tenant.create({
    data: {
      name: "Sharp Cuts Barbershop",
      slug: "sharp-cuts",
      type: "BARBERSHOP",
      tier: "PROFESSIONAL",
      email: "info@sharpcuts.co.ke",
      phone: "+254 700 222 333",
      address: "Tom Mboya Street, CBD",
      city: "Nairobi",
      currency: "KES",
      taxRate: 0,
      receiptHeader: "SHARP CUTS BARBERSHOP",
      receiptFooter: "Looking sharp! See you next time.",
    },
  });

  const scOwner = await prisma.user.create({
    data: { email: "admin@sharpcuts.co.ke", name: "Brian Omondi", phone: "+254 700 222 333", password: hash, role: "OWNER", tenantId: sharp.id },
  });
  const scBarber1 = await prisma.user.create({
    data: { email: "eric@sharpcuts.co.ke", name: "Eric Musyoka", phone: "+254 711 333 444", password: hash, role: "CASHIER", tenantId: sharp.id },
  });
  const scBarber2 = await prisma.user.create({
    data: { email: "dennis@sharpcuts.co.ke", name: "Dennis Wekesa", phone: "+254 722 444 555", password: hash, role: "CASHIER", tenantId: sharp.id },
  });
  const scBarber3 = await prisma.user.create({
    data: { email: "tony@sharpcuts.co.ke", name: "Tony Maina", phone: "+254 733 555 666", password: hash, role: "CASHIER", tenantId: sharp.id },
  });

  const scLocation = await prisma.location.create({
    data: { name: "Main Shop", address: "Tom Mboya Street, CBD", tenantId: sharp.id },
  });
  await prisma.register.create({ data: { name: "Reception", locationId: scLocation.id } });

  const scUnits = await Promise.all([
    prisma.unitOfMeasure.create({ data: { name: "Service", abbreviation: "svc", tenantId: sharp.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: sharp.id } }),
    prisma.unitOfMeasure.create({ data: { name: "Bottle", abbreviation: "btl", tenantId: sharp.id } }),
  ]);
  const [scSvc, scPc, scBtl] = scUnits;

  const scCats = await Promise.all([
    prisma.category.create({ data: { name: "Haircuts", color: "#6366f1", tenantId: sharp.id } }),
    prisma.category.create({ data: { name: "Shaving", color: "#ef4444", tenantId: sharp.id } }),
    prisma.category.create({ data: { name: "Grooming Products", color: "#10b981", tenantId: sharp.id } }),
    prisma.category.create({ data: { name: "Treatments", color: "#f59e0b", tenantId: sharp.id } }),
  ]);
  const [scHaircut, scShave, scProducts, scTreatment] = scCats;

  // Barbershop Services
  const scServices = await Promise.all([
    prisma.service.create({ data: { name: "Regular Haircut", description: "Standard men's haircut with clippers", price: 200, duration: 20, tenantId: sharp.id, categoryId: scHaircut.id } }),
    prisma.service.create({ data: { name: "Skin Fade", description: "Clean skin fade with blend", price: 350, duration: 30, tenantId: sharp.id, categoryId: scHaircut.id } }),
    prisma.service.create({ data: { name: "Dreadlock Maintenance", description: "Retwist and styling", price: 500, duration: 45, tenantId: sharp.id, categoryId: scHaircut.id } }),
    prisma.service.create({ data: { name: "Kids Haircut", description: "Children under 12", price: 150, duration: 15, tenantId: sharp.id, categoryId: scHaircut.id } }),
    prisma.service.create({ data: { name: "Clean Shave", description: "Hot towel clean shave", price: 200, duration: 20, tenantId: sharp.id, categoryId: scShave.id } }),
    prisma.service.create({ data: { name: "Beard Trim & Shape", description: "Beard lineup and shaping", price: 150, duration: 15, tenantId: sharp.id, categoryId: scShave.id } }),
    prisma.service.create({ data: { name: "Haircut + Beard Combo", description: "Full haircut with beard trim", price: 400, duration: 35, tenantId: sharp.id, categoryId: scShave.id } }),
    prisma.service.create({ data: { name: "Hot Towel Treatment", description: "Relaxing hot towel facial", price: 300, duration: 20, tenantId: sharp.id, categoryId: scTreatment.id } }),
    prisma.service.create({ data: { name: "Scalp Massage", description: "Deep scalp massage with oils", price: 250, duration: 15, tenantId: sharp.id, categoryId: scTreatment.id } }),
  ]);

  // Grooming products for retail sale
  const scProductList = [
    { name: "Hair Gel (Strong Hold)", sku: "SC-GP-001", price: 250, cost: 150, unit: scBtl, cat: scProducts.id, image: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=200", uoms: [] },
    { name: "Beard Oil (50ml)", sku: "SC-GP-002", price: 450, cost: 250, unit: scBtl, cat: scProducts.id, image: "https://images.unsplash.com/photo-1621607512214-68297480165e?w=200", uoms: [] },
    { name: "Aftershave Lotion", sku: "SC-GP-003", price: 350, cost: 200, unit: scBtl, cat: scProducts.id, image: "https://images.unsplash.com/photo-1621607512214-68297480165e?w=200", uoms: [] },
    { name: "Shaving Cream", sku: "SC-GP-004", price: 300, cost: 180, unit: scPc, cat: scProducts.id, image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=200", uoms: [] },
    { name: "Pomade (100g)", sku: "SC-GP-005", price: 400, cost: 220, unit: scPc, cat: scProducts.id, image: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=200", uoms: [] },
    { name: "Disposable Razor (Pack 5)", sku: "SC-GP-006", price: 150, cost: 80, unit: scPc, cat: scProducts.id, image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=200", uoms: [] },
  ];

  const createdScProducts: Product[] = [];
  for (const p of scProductList) {
    const product = await prisma.product.create({
      data: {
        name: p.name, sku: p.sku, price: p.price, cost: p.cost,
        image: p.image, baseUnitId: p.unit.id, tenantId: sharp.id, categoryId: p.cat,
      },
    });
    createdScProducts.push(product);
    await prisma.stock.create({
      data: { quantity: 10 + Math.floor(Math.random() * 30), productId: product.id, locationId: scLocation.id },
    });
  }

  // Staff Schedules (this week)
  const today = new Date();
  for (let d = 0; d < 7; d++) {
    const schedDate = new Date(today);
    schedDate.setDate(today.getDate() + d);
    const dayOfWeek = schedDate.getDay();

    // Eric: Mon-Sat, off Sunday
    if (dayOfWeek !== 0) {
      await prisma.staffSchedule.create({
        data: { date: dateOnly(schedDate), startTime: "08:00", endTime: "18:00", isOff: false, staffId: scBarber1.id, tenantId: sharp.id },
      });
    } else {
      await prisma.staffSchedule.create({
        data: { date: dateOnly(schedDate), startTime: "08:00", endTime: "18:00", isOff: true, notes: "Day off", staffId: scBarber1.id, tenantId: sharp.id },
      });
    }

    // Dennis: Tue-Sun, off Monday
    if (dayOfWeek !== 1) {
      await prisma.staffSchedule.create({
        data: { date: dateOnly(schedDate), startTime: "09:00", endTime: "19:00", isOff: false, staffId: scBarber2.id, tenantId: sharp.id },
      });
    } else {
      await prisma.staffSchedule.create({
        data: { date: dateOnly(schedDate), startTime: "09:00", endTime: "19:00", isOff: true, notes: "Day off", staffId: scBarber2.id, tenantId: sharp.id },
      });
    }

    // Tony: Wed-Mon, off Tuesday
    if (dayOfWeek !== 2) {
      await prisma.staffSchedule.create({
        data: { date: dateOnly(schedDate), startTime: "08:00", endTime: "17:00", isOff: false, staffId: scBarber3.id, tenantId: sharp.id },
      });
    } else {
      await prisma.staffSchedule.create({
        data: { date: dateOnly(schedDate), startTime: "08:00", endTime: "17:00", isOff: true, notes: "Day off", staffId: scBarber3.id, tenantId: sharp.id },
      });
    }
  }

  // Appointments
  const apptDate = dateOnly(daysAgo(0));
  await prisma.appointment.createMany({
    data: [
      { date: apptDate, startTime: "09:00", endTime: "09:30", status: "COMPLETED", clientName: "Alex Mwangi", clientPhone: "+254 722 100 001", serviceId: scServices[1].id, staffId: scBarber1.id, tenantId: sharp.id },
      { date: apptDate, startTime: "09:30", endTime: "10:15", status: "COMPLETED", clientName: "James Otieno", clientPhone: "+254 722 100 002", serviceId: scServices[6].id, staffId: scBarber2.id, tenantId: sharp.id },
      { date: apptDate, startTime: "10:00", endTime: "10:45", status: "IN_PROGRESS", clientName: "Michael Kamau", clientPhone: "+254 722 100 003", serviceId: scServices[2].id, staffId: scBarber1.id, tenantId: sharp.id },
      { date: apptDate, startTime: "10:30", endTime: "11:00", status: "CONFIRMED", clientName: "David Kiprop", clientPhone: "+254 722 100 004", serviceId: scServices[1].id, staffId: scBarber3.id, tenantId: sharp.id },
      { date: apptDate, startTime: "11:00", endTime: "11:30", status: "SCHEDULED", clientName: "Peter Njuguna", clientPhone: "+254 722 100 005", serviceId: scServices[0].id, staffId: scBarber2.id, tenantId: sharp.id },
      { date: apptDate, startTime: "14:00", endTime: "14:30", status: "SCHEDULED", clientName: "Victor Odhiambo", serviceId: scServices[4].id, staffId: scBarber1.id, tenantId: sharp.id },
      { date: apptDate, startTime: "15:00", endTime: "15:20", status: "SCHEDULED", clientName: "Simon Junior", notes: "Child, age 8", serviceId: scServices[3].id, staffId: scBarber3.id, tenantId: sharp.id },
    ],
  });

  // Queue entries (walk-ins today)
  await prisma.queueEntry.createMany({
    data: [
      { ticketNo: 1, clientName: "John Doe", serviceName: "Regular Haircut", status: "COMPLETED", staffId: scBarber1.id, tenantId: sharp.id, createdAt: new Date(apptDate.getTime() + 8 * 3600000), servedAt: new Date(apptDate.getTime() + 8.1 * 3600000), completedAt: new Date(apptDate.getTime() + 8.4 * 3600000) },
      { ticketNo: 2, clientName: "Samuel Wafula", serviceName: "Skin Fade", status: "COMPLETED", staffId: scBarber2.id, tenantId: sharp.id, createdAt: new Date(apptDate.getTime() + 8.5 * 3600000), servedAt: new Date(apptDate.getTime() + 8.6 * 3600000), completedAt: new Date(apptDate.getTime() + 9.1 * 3600000) },
      { ticketNo: 3, clientName: "Frank Ochieng", serviceName: "Haircut + Beard", status: "SERVING", staffId: scBarber3.id, tenantId: sharp.id, createdAt: new Date(apptDate.getTime() + 9 * 3600000), servedAt: new Date(apptDate.getTime() + 9.5 * 3600000) },
      { ticketNo: 4, clientName: "Moses Ndegwa", clientPhone: "+254 722 100 010", serviceName: "Regular Haircut", status: "WAITING", tenantId: sharp.id, createdAt: new Date(apptDate.getTime() + 9.5 * 3600000) },
      { ticketNo: 5, clientName: "Brian Junior", serviceName: "Kids Haircut", status: "WAITING", tenantId: sharp.id, createdAt: new Date(apptDate.getTime() + 10 * 3600000) },
    ],
  });

  // Barbershop orders (product sales + service charges recorded as orders)
  const scOrders = [
    { items: [{ idx: 0, qty: 1 }, { idx: 5, qty: 2 }], method: "CASH" as const },
    { items: [{ idx: 1, qty: 1 }, { idx: 2, qty: 1 }], method: "MPESA_MANUAL" as const },
    { items: [{ idx: 3, qty: 2 }, { idx: 4, qty: 1 }], method: "CASH" as const },
  ];
  for (const orderData of scOrders) {
    const orderItems = orderData.items.map(i => {
      const p = createdScProducts[i.idx];
      return { productId: p.id, quantity: i.qty, unitPrice: p.price, total: p.price * i.qty, baseQuantity: i.qty };
    });
    const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
    const order = await prisma.order.create({
      data: {
        orderNo: generateOrderNo(), status: "COMPLETED", subtotal, taxAmount: 0, total: subtotal, discount: 0,
        paymentMethod: orderData.method, paymentStatus: "COMPLETED",
        tenantId: sharp.id, locationId: scLocation.id, userId: scBarber1.id,
        items: { create: orderItems },
      },
    });
    await prisma.transaction.create({
      data: {
        type: "SALE", amount: subtotal, method: orderData.method, status: "COMPLETED",
        reference: `TXN-SC-${order.orderNo.replace("ORD-", "")}`,
        description: `Sale ${order.orderNo}`, tenantId: sharp.id, orderId: order.id, userId: scBarber1.id,
      },
    });
  }

  await prisma.expense.createMany({
    data: [
      { date: dateOnly(daysAgo(3)), category: "Rent", description: "Monthly shop rent", amount: 25000, tenantId: sharp.id, locationId: scLocation.id, userId: scOwner.id, isRecurring: true },
      { date: dateOnly(daysAgo(2)), category: "Supplies", description: "Clipper oil, blades, towels", amount: 3500, supplier: "Salon Supplies KE", tenantId: sharp.id, locationId: scLocation.id, userId: scOwner.id },
      { date: dateOnly(daysAgo(1)), category: "Equipment", description: "New Wahl clipper", amount: 8500, supplier: "Pro Beauty Kenya", tenantId: sharp.id, locationId: scLocation.id, userId: scOwner.id, receiptNo: "PBK-2211" },
      { date: dateOnly(daysAgo(0)), category: "Utilities", description: "Electricity + WiFi", amount: 2500, tenantId: sharp.id, locationId: scLocation.id, userId: scOwner.id },
    ],
  });

  console.log("  ✓ Sharp Cuts Barbershop: 6 products, 9 services, 4 users, appointments, queue, schedules\n");

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n✅ Seed complete!\n");
  console.log("═══════════════════════════════════════════════════");
  console.log("  LOGIN CREDENTIALS (all use password123 unless noted)");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("  SUPERMARKET - Duka Kuu (/duka-kuu)");
  console.log("    Owner:       admin@dukakuu.co.ke");
  console.log("    Cashier:     cashier@dukakuu.co.ke");
  console.log("    Stock Keeper: stock@dukakuu.co.ke");
  console.log("");
  console.log("  BAR - Mzinga Sports Bar (/mzinga-bar)");
  console.log("    Owner:   admin@mzingabar.co.ke");
  console.log("    Cashier: cashier@mzingabar.co.ke");
  console.log("");
  console.log("  BAR - Savanna Lounge (/savanna-lounge)");
  console.log("    Owner:   admin@savannalounge.co.ke");
  console.log("    Cashier: cashier@savannalounge.co.ke");
  console.log("    Manager: manager@savannalounge.co.ke");
  console.log("");
  console.log("  BAR - Club Chairman (/club-chairman)");
  console.log("    Owner:   jkmasaka@gmail.com / Chairman@2024");
  console.log("    Cashier: jackie@clubchairman.co.ke / Jackie@2024");
  console.log("");
  console.log("  RETAIL - Mama Njeri's Shop (/mama-njeri)");
  console.log("    Owner:   mamanjeri@gmail.com");
  console.log("    Cashier: cashier@mamanjeri.co.ke");
  console.log("");
  console.log("  RESTAURANT - Safari Bites (/safari-bites)");
  console.log("    Owner:   admin@safaribites.co.ke");
  console.log("    Cashier: cashier@safaribites.co.ke");
  console.log("    Kitchen: kitchen@safaribites.co.ke");
  console.log("");
  console.log("  PHARMACY - Afya Pharmacy (/afya-pharmacy)");
  console.log("    Owner:       admin@afyapharmacy.co.ke");
  console.log("    Cashier:     cashier@afyapharmacy.co.ke");
  console.log("    Stock Keeper: stock@afyapharmacy.co.ke");
  console.log("");
  console.log("  HARDWARE - Jengo Hardware (/jengo-hardware)");
  console.log("    Owner:       admin@jengohardware.co.ke");
  console.log("    Cashier:     cashier@jengohardware.co.ke");
  console.log("    Stock Keeper: stock@jengohardware.co.ke");
  console.log("");
  console.log("  BARBERSHOP - Sharp Cuts (/sharp-cuts)");
  console.log("    Owner:   admin@sharpcuts.co.ke");
  console.log("    Barber1: eric@sharpcuts.co.ke");
  console.log("    Barber2: dennis@sharpcuts.co.ke");
  console.log("    Barber3: tony@sharpcuts.co.ke");
  console.log("");
  console.log("═══════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
