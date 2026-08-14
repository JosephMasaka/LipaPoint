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

  console.log("\n✅ Seed complete!\n");
  console.log("═══════════════════════════════════════════════════");
  console.log("  LOGIN CREDENTIALS (all passwords: password123)");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("  Duka Kuu Wholesale & Retail (/duka-kuu)");
  console.log("    Owner:       admin@dukakuu.co.ke");
  console.log("    Cashier:     cashier@dukakuu.co.ke");
  console.log("    Stock Keeper: stock@dukakuu.co.ke");
  console.log("");
  console.log("  Mzinga Sports Bar (/mzinga-bar)");
  console.log("    Owner:   admin@mzingabar.co.ke");
  console.log("    Cashier: cashier@mzingabar.co.ke");
  console.log("");
  console.log("  Savanna Lounge (/savanna-lounge)");
  console.log("    Owner:   admin@savannalounge.co.ke");
  console.log("    Cashier: cashier@savannalounge.co.ke");
  console.log("    Manager: manager@savannalounge.co.ke");
  console.log("");
  console.log("═══════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
