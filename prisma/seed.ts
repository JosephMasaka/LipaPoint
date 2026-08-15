import { PrismaClient } from "@prisma/client";
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

  await prisma.orderItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.order.deleteMany();
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
  await prisma.register.deleteMany();
  await prisma.location.deleteMany();
  await prisma.session.deleteMany();
  await prisma.activityLog.deleteMany();
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

  const createdDukaProducts = [];
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
    { items: [{ idx: 1, qty: 3 }, { idx: 5, qty: 2 }, { idx: 12, qty: 4 }], method: "MPESA" as const },
    { items: [{ idx: 3, qty: 1 }, { idx: 9, qty: 1 }], method: "CASH" as const },
    { items: [{ idx: 10, qty: 1 }, { idx: 11, qty: 2 }], method: "CARD" as const },
    { items: [{ idx: 4, qty: 6 }, { idx: 13, qty: 2 }], method: "MPESA" as const },
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

  const createdMzingaProducts = [];
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
    { items: [{ idx: 6, qty: 1 }, { idx: 3, qty: 2 }, { idx: 11, qty: 1 }], method: "MPESA" as const },
    { items: [{ idx: 1, qty: 4 }, { idx: 7, qty: 3 }, { idx: 13, qty: 1 }], method: "CASH" as const },
    { items: [{ idx: 2, qty: 2 }, { idx: 8, qty: 2 }, { idx: 14, qty: 2 }], method: "MPESA" as const },
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

  const createdSavannaProducts = [];
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
    { items: [{ idx: 1, qty: 1 }, { idx: 8, qty: 2 }, { idx: 15, qty: 1 }], method: "MPESA" as const },
    { items: [{ idx: 2, qty: 2 }, { idx: 5, qty: 3 }, { idx: 10, qty: 2 }], method: "CARD" as const },
    { items: [{ idx: 3, qty: 1 }, { idx: 9, qty: 1 }, { idx: 13, qty: 1 }, { idx: 16, qty: 2 }], method: "CASH" as const },
    { items: [{ idx: 6, qty: 2 }, { idx: 11, qty: 2 }, { idx: 14, qty: 1 }, { idx: 17, qty: 1 }], method: "PDQ" as const },
    { items: [{ idx: 0, qty: 4 }, { idx: 1, qty: 2 }, { idx: 7, qty: 2 }, { idx: 8, qty: 2 }], method: "CARD" as const },
    { items: [{ idx: 4, qty: 6 }, { idx: 12, qty: 2 }, { idx: 15, qty: 2 }], method: "MPESA" as const },
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

  const createdChairProducts = [];
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
    { items: [[13, 1, 350], [30, 1, 250], [114, 1, 60]], method: "MPESA" as const, customer: "Kevin" },
    { items: [[16, 2, 230], [46, 1, 600], [55, 2, 450]], method: "CASH" as const },
    { items: [[18, 1, 300], [24, 1, 350], [32, 1, 400]], method: "CASH" as const },
    { items: [[36, 1, 3500], [110, 3, 80]], method: "MPESA" as const, customer: "Wanjiku" },
    { items: [[49, 2, 500], [58, 1, 350], [111, 2, 60]], method: "CASH" as const },
    { items: [[8, 3, 250], [16, 1, 230], [61, 1, 350]], method: "CASH" as const },
    { items: [[46, 1, 600], [110, 2, 80], [114, 1, 60]], method: "MPESA" as const, customer: "Otieno" },
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
  console.log("\n✅ Seed complete!\n");
  console.log("═══════════════════════════════════════════════════");
  console.log("  LOGIN CREDENTIALS");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("  Duka Kuu Wholesale & Retail (/duka-kuu)");
  console.log("    Owner:       admin@dukakuu.co.ke / password123");
  console.log("    Cashier:     cashier@dukakuu.co.ke / password123");
  console.log("    Stock Keeper: stock@dukakuu.co.ke / password123");
  console.log("");
  console.log("  Mzinga Sports Bar (/mzinga-bar)");
  console.log("    Owner:   admin@mzingabar.co.ke / password123");
  console.log("    Cashier: cashier@mzingabar.co.ke / password123");
  console.log("");
  console.log("  Savanna Lounge (/savanna-lounge)");
  console.log("    Owner:   admin@savannalounge.co.ke / password123");
  console.log("    Cashier: cashier@savannalounge.co.ke / password123");
  console.log("    Manager: manager@savannalounge.co.ke / password123");
  console.log("");
  console.log("  Club Chairman (/club-chairman)");
  console.log("    Owner:   jkmasaka@gmail.com / Chairman@2024");
  console.log("    Cashier: jackie@clubchairman.co.ke / Jackie@2024");
  console.log("");
  console.log("═══════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
