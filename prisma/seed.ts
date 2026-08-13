import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...\n");

  const hashedPassword = await bcrypt.hash("password123", 12);
  const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // ═══════════════════════════════════════════════════════════════
  // 1. DUKA KUU WHOLESALE & RETAIL (Supermarket/Retail)
  // ═══════════════════════════════════════════════════════════════
  const retail = await prisma.tenant.create({
    data: {
      name: "Duka Kuu Wholesale & Retail",
      slug: "duka-kuu",
      type: "SUPERMARKET",
      tier: "PROFESSIONAL",
      email: "admin@dukakuu.co.ke",
      phone: "+254720100200",
      currency: "KES",
      taxRate: 16,
      receiptHeader: "Duka Kuu Wholesale & Retail\nTom Mboya Street, Nairobi\nTel: 0720 100 200",
      receiptFooter: "Karibu tena! Thank you for shopping with us.",
      isActive: true,
      trialEndsAt: trialEnd,
    },
  });

  const retailOwner = await prisma.user.create({
    data: {
      name: "James Kamau",
      email: "admin@dukakuu.co.ke",
      phone: "+254720100200",
      password: hashedPassword,
      role: "OWNER",
      tenantId: retail.id,
    },
  });
  await prisma.user.create({
    data: { name: "Grace Muthoni", email: "cashier@dukakuu.co.ke", phone: "+254711200300", password: hashedPassword, role: "CASHIER", tenantId: retail.id },
  });
  await prisma.user.create({
    data: { name: "David Njoroge", email: "stock@dukakuu.co.ke", phone: "+254722300400", password: hashedPassword, role: "STOCK_KEEPER", tenantId: retail.id },
  });
  await prisma.user.create({
    data: { name: "Sarah Wambui", email: "manager@dukakuu.co.ke", phone: "+254733400500", password: hashedPassword, role: "MANAGER", tenantId: retail.id },
  });

  const retailLoc = await prisma.location.create({
    data: { name: "Main Store - Tom Mboya", address: "Tom Mboya Street, Nairobi CBD", phone: "+254720100200", tenantId: retail.id },
  });
  await prisma.register.create({ data: { name: "Counter 1", locationId: retailLoc.id } });
  await prisma.register.create({ data: { name: "Counter 2", locationId: retailLoc.id } });

  // Units of Measure for Retail
  const retailUnits = {
    piece: await prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: retail.id } }),
    dozen: await prisma.unitOfMeasure.create({ data: { name: "Dozen", abbreviation: "dz", tenantId: retail.id } }),
    crate: await prisma.unitOfMeasure.create({ data: { name: "Crate", abbreviation: "crt", tenantId: retail.id } }),
    kg: await prisma.unitOfMeasure.create({ data: { name: "Kilogram", abbreviation: "kg", tenantId: retail.id } }),
    gram: await prisma.unitOfMeasure.create({ data: { name: "Gram", abbreviation: "g", tenantId: retail.id } }),
    litre: await prisma.unitOfMeasure.create({ data: { name: "Litre", abbreviation: "L", tenantId: retail.id } }),
    ml: await prisma.unitOfMeasure.create({ data: { name: "Millilitre", abbreviation: "ml", tenantId: retail.id } }),
    packet: await prisma.unitOfMeasure.create({ data: { name: "Packet", abbreviation: "pkt", tenantId: retail.id } }),
    box: await prisma.unitOfMeasure.create({ data: { name: "Box", abbreviation: "box", tenantId: retail.id } }),
    bale: await prisma.unitOfMeasure.create({ data: { name: "Bale", abbreviation: "bale", tenantId: retail.id } }),
    carton: await prisma.unitOfMeasure.create({ data: { name: "Carton", abbreviation: "ctn", tenantId: retail.id } }),
  };

  // Unit conversions
  await prisma.unitConversion.createMany({
    data: [
      { fromUnitId: retailUnits.dozen.id, toUnitId: retailUnits.piece.id, factor: 12 },
      { fromUnitId: retailUnits.crate.id, toUnitId: retailUnits.piece.id, factor: 24 },
      { fromUnitId: retailUnits.kg.id, toUnitId: retailUnits.gram.id, factor: 1000 },
      { fromUnitId: retailUnits.litre.id, toUnitId: retailUnits.ml.id, factor: 1000 },
      { fromUnitId: retailUnits.bale.id, toUnitId: retailUnits.packet.id, factor: 12 },
      { fromUnitId: retailUnits.carton.id, toUnitId: retailUnits.piece.id, factor: 48 },
      { fromUnitId: retailUnits.box.id, toUnitId: retailUnits.piece.id, factor: 24 },
    ],
  });

  // Categories with hierarchy (Parent -> Children)
  const detergents = await prisma.category.create({ data: { name: "Detergents & Soap", color: "#3b82f6", tenantId: retail.id } });
  const cookingOil = await prisma.category.create({ data: { name: "Cooking Oil & Fat", color: "#f59e0b", tenantId: retail.id } });
  const flour = await prisma.category.create({ data: { name: "Flour & Baking", color: "#8b5cf6", tenantId: retail.id } });
  const beverages = await prisma.category.create({ data: { name: "Beverages", color: "#ef4444", tenantId: retail.id } });
  const dairy = await prisma.category.create({ data: { name: "Dairy & Eggs", color: "#10b981", tenantId: retail.id } });
  const snacks = await prisma.category.create({ data: { name: "Snacks & Biscuits", color: "#ec4899", tenantId: retail.id } });
  const rice = await prisma.category.create({ data: { name: "Rice & Grains", color: "#14b8a6", tenantId: retail.id } });
  const sugar = await prisma.category.create({ data: { name: "Sugar & Salt", color: "#f97316", tenantId: retail.id } });
  const personal = await prisma.category.create({ data: { name: "Personal Care", color: "#6366f1", tenantId: retail.id } });
  const household = await prisma.category.create({ data: { name: "Household", color: "#84cc16", tenantId: retail.id } });

  // Sub-categories
  const subOmo = await prisma.category.create({ data: { name: "Omo", color: "#3b82f6", parentId: detergents.id, tenantId: retail.id } });
  const subAriel = await prisma.category.create({ data: { name: "Ariel", color: "#2563eb", parentId: detergents.id, tenantId: retail.id } });
  const subSunlight = await prisma.category.create({ data: { name: "Sunlight", color: "#f59e0b", parentId: detergents.id, tenantId: retail.id } });
  const subMenengai = await prisma.category.create({ data: { name: "Menengai", color: "#16a34a", parentId: detergents.id, tenantId: retail.id } });

  const subFreshFri = await prisma.category.create({ data: { name: "Fresh Fri", color: "#f59e0b", parentId: cookingOil.id, tenantId: retail.id } });
  const subElianto = await prisma.category.create({ data: { name: "Elianto", color: "#eab308", parentId: cookingOil.id, tenantId: retail.id } });
  const subKimbo = await prisma.category.create({ data: { name: "Kimbo", color: "#22c55e", parentId: cookingOil.id, tenantId: retail.id } });

  const subExcella = await prisma.category.create({ data: { name: "Excella", color: "#8b5cf6", parentId: flour.id, tenantId: retail.id } });
  const subAjab = await prisma.category.create({ data: { name: "Ajab", color: "#a855f7", parentId: flour.id, tenantId: retail.id } });

  // Products for Retail - comprehensive with hierarchy
  const retailProducts = [
    // Detergents -> Omo
    { name: "Omo 500g", sku: "DET-OMO-500", price: 180, cost: 145, categoryId: subOmo.id, unitId: retailUnits.packet.id },
    { name: "Omo 1kg", sku: "DET-OMO-1K", price: 330, cost: 270, categoryId: subOmo.id, unitId: retailUnits.packet.id },
    { name: "Omo 2kg", sku: "DET-OMO-2K", price: 620, cost: 510, categoryId: subOmo.id, unitId: retailUnits.packet.id },
    // Detergents -> Ariel
    { name: "Ariel 500g", sku: "DET-ARI-500", price: 200, cost: 160, categoryId: subAriel.id, unitId: retailUnits.packet.id },
    { name: "Ariel 1kg", sku: "DET-ARI-1K", price: 370, cost: 300, categoryId: subAriel.id, unitId: retailUnits.packet.id },
    { name: "Ariel 2kg", sku: "DET-ARI-2K", price: 700, cost: 570, categoryId: subAriel.id, unitId: retailUnits.packet.id },
    // Detergents -> Sunlight
    { name: "Sunlight Powder 500g", sku: "DET-SUN-500", price: 150, cost: 120, categoryId: subSunlight.id, unitId: retailUnits.packet.id },
    { name: "Sunlight Bar 700g", sku: "DET-SUN-BAR", price: 130, cost: 100, categoryId: subSunlight.id, unitId: retailUnits.piece.id },
    // Detergents -> Menengai
    { name: "Menengai Bar Soap", sku: "DET-MEN-BAR", price: 90, cost: 65, categoryId: subMenengai.id, unitId: retailUnits.piece.id },
    { name: "Menengai Cream 100g", sku: "DET-MEN-100", price: 45, cost: 32, categoryId: subMenengai.id, unitId: retailUnits.piece.id },
    // Cooking Oil -> Fresh Fri
    { name: "Fresh Fri 1L", sku: "OIL-FF-1L", price: 350, cost: 280, categoryId: subFreshFri.id, unitId: retailUnits.litre.id },
    { name: "Fresh Fri 2L", sku: "OIL-FF-2L", price: 650, cost: 530, categoryId: subFreshFri.id, unitId: retailUnits.litre.id },
    { name: "Fresh Fri 5L", sku: "OIL-FF-5L", price: 1500, cost: 1200, categoryId: subFreshFri.id, unitId: retailUnits.litre.id },
    // Cooking Oil -> Elianto
    { name: "Elianto 1L", sku: "OIL-EL-1L", price: 380, cost: 310, categoryId: subElianto.id, unitId: retailUnits.litre.id },
    { name: "Elianto 2L", sku: "OIL-EL-2L", price: 700, cost: 580, categoryId: subElianto.id, unitId: retailUnits.litre.id },
    // Cooking Oil -> Kimbo
    { name: "Kimbo 500g", sku: "OIL-KMB-500", price: 180, cost: 140, categoryId: subKimbo.id, unitId: retailUnits.gram.id },
    { name: "Kimbo 1kg", sku: "OIL-KMB-1K", price: 330, cost: 260, categoryId: subKimbo.id, unitId: retailUnits.kg.id },
    { name: "Kimbo 2kg", sku: "OIL-KMB-2K", price: 600, cost: 480, categoryId: subKimbo.id, unitId: retailUnits.kg.id },
    // Flour -> Excella
    { name: "Excella Flour 1kg", sku: "FLR-EXC-1K", price: 130, cost: 100, categoryId: subExcella.id, unitId: retailUnits.kg.id },
    { name: "Excella Flour 2kg", sku: "FLR-EXC-2K", price: 240, cost: 190, categoryId: subExcella.id, unitId: retailUnits.kg.id },
    // Flour -> Ajab
    { name: "Ajab Flour 1kg", sku: "FLR-AJB-1K", price: 120, cost: 95, categoryId: subAjab.id, unitId: retailUnits.kg.id },
    { name: "Ajab Flour 2kg", sku: "FLR-AJB-2K", price: 230, cost: 180, categoryId: subAjab.id, unitId: retailUnits.kg.id },
    // Beverages
    { name: "Coca-Cola 500ml", sku: "BEV-CC-500", price: 80, cost: 55, categoryId: beverages.id, unitId: retailUnits.piece.id },
    { name: "Coca-Cola 1L", sku: "BEV-CC-1L", price: 130, cost: 95, categoryId: beverages.id, unitId: retailUnits.piece.id },
    { name: "Fanta Orange 500ml", sku: "BEV-FAN-500", price: 80, cost: 55, categoryId: beverages.id, unitId: retailUnits.piece.id },
    { name: "Sprite 500ml", sku: "BEV-SPR-500", price: 80, cost: 55, categoryId: beverages.id, unitId: retailUnits.piece.id },
    { name: "Dasani Water 500ml", sku: "BEV-DAS-500", price: 50, cost: 30, categoryId: beverages.id, unitId: retailUnits.piece.id },
    { name: "Ketepa Tea 100 bags", sku: "BEV-KTP-100", price: 350, cost: 270, categoryId: beverages.id, unitId: retailUnits.box.id },
    { name: "Nescafe Coffee 50g", sku: "BEV-NSC-50", price: 250, cost: 190, categoryId: beverages.id, unitId: retailUnits.piece.id },
    // Dairy
    { name: "Brookside Fresh Milk 500ml", sku: "DRY-BRK-500", price: 65, cost: 50, categoryId: dairy.id, unitId: retailUnits.piece.id },
    { name: "Brookside Fresh Milk 1L", sku: "DRY-BRK-1L", price: 120, cost: 95, categoryId: dairy.id, unitId: retailUnits.piece.id },
    { name: "KCC Butter 250g", sku: "DRY-KCC-BTR", price: 280, cost: 220, categoryId: dairy.id, unitId: retailUnits.piece.id },
    { name: "Eggs (Tray 30)", sku: "DRY-EGG-30", price: 480, cost: 380, categoryId: dairy.id, unitId: retailUnits.piece.id },
    // Snacks
    { name: "Digestive Biscuits 400g", sku: "SNK-DIG-400", price: 150, cost: 110, categoryId: snacks.id, unitId: retailUnits.packet.id },
    { name: "Nice Biscuits 200g", sku: "SNK-NIC-200", price: 80, cost: 55, categoryId: snacks.id, unitId: retailUnits.packet.id },
    { name: "Tropical Heat Chips 100g", sku: "SNK-TH-100", price: 100, cost: 70, categoryId: snacks.id, unitId: retailUnits.packet.id },
    // Rice & Grains
    { name: "Pishori Rice 2kg", sku: "RCE-PSH-2K", price: 450, cost: 350, categoryId: rice.id, unitId: retailUnits.kg.id },
    { name: "Pishori Rice 5kg", sku: "RCE-PSH-5K", price: 1050, cost: 820, categoryId: rice.id, unitId: retailUnits.kg.id },
    { name: "Sindano Rice 1kg", sku: "RCE-SIN-1K", price: 160, cost: 120, categoryId: rice.id, unitId: retailUnits.kg.id },
    { name: "Green Grams 1kg", sku: "RCE-GG-1K", price: 200, cost: 150, categoryId: rice.id, unitId: retailUnits.kg.id },
    // Sugar & Salt
    { name: "Mumias Sugar 1kg", sku: "SGR-MUM-1K", price: 180, cost: 150, categoryId: sugar.id, unitId: retailUnits.kg.id },
    { name: "Mumias Sugar 2kg", sku: "SGR-MUM-2K", price: 340, cost: 280, categoryId: sugar.id, unitId: retailUnits.kg.id },
    { name: "Kensalt 1kg", sku: "SGR-KST-1K", price: 50, cost: 35, categoryId: sugar.id, unitId: retailUnits.kg.id },
    // Personal Care
    { name: "Colgate Toothpaste 100ml", sku: "PC-CLG-100", price: 180, cost: 135, categoryId: personal.id, unitId: retailUnits.piece.id },
    { name: "Dettol Soap 175g", sku: "PC-DTL-175", price: 120, cost: 85, categoryId: personal.id, unitId: retailUnits.piece.id },
    { name: "Vaseline 200ml", sku: "PC-VAS-200", price: 250, cost: 180, categoryId: personal.id, unitId: retailUnits.piece.id },
    // Household
    { name: "Harpic Toilet Cleaner 500ml", sku: "HH-HRP-500", price: 250, cost: 185, categoryId: household.id, unitId: retailUnits.piece.id },
    { name: "Jik Bleach 750ml", sku: "HH-JIK-750", price: 150, cost: 110, categoryId: household.id, unitId: retailUnits.piece.id },
    { name: "Morning Fresh 500ml", sku: "HH-MF-500", price: 200, cost: 150, categoryId: household.id, unitId: retailUnits.piece.id },
  ];

  for (const p of retailProducts) {
    const product = await prisma.product.create({
      data: { ...p, tenantId: retail.id },
    });
    await prisma.stock.create({
      data: { productId: product.id, locationId: retailLoc.id, quantity: Math.floor(Math.random() * 150) + 30 },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. MZINGA SPORTS BAR (Local Bar)
  // ═══════════════════════════════════════════════════════════════
  const localBar = await prisma.tenant.create({
    data: {
      name: "Mzinga Sports Bar",
      slug: "mzinga-bar",
      type: "BAR",
      tier: "STARTER",
      email: "admin@mzinga.co.ke",
      phone: "+254725111222",
      currency: "KES",
      taxRate: 16,
      receiptHeader: "Mzinga Sports Bar\nPangani, Nairobi\nTel: 0725 111 222",
      receiptFooter: "Karibuni tena! Enjoy responsibly.",
      isActive: true,
      trialEndsAt: trialEnd,
    },
  });

  const barOwner = await prisma.user.create({
    data: { name: "Mike Otieno", email: "admin@mzinga.co.ke", phone: "+254725111222", password: hashedPassword, role: "OWNER", tenantId: localBar.id },
  });
  await prisma.user.create({
    data: { name: "Alice Achieng", email: "waiter@mzinga.co.ke", phone: "+254726222333", password: hashedPassword, role: "CASHIER", tenantId: localBar.id },
  });

  const barLoc = await prisma.location.create({
    data: { name: "Mzinga Main", address: "Pangani Estate, Off Thika Road", phone: "+254725111222", tenantId: localBar.id },
  });
  await prisma.register.create({ data: { name: "Bar Counter", locationId: barLoc.id } });

  // Bar units
  const barUnits = {
    bottle: await prisma.unitOfMeasure.create({ data: { name: "Bottle", abbreviation: "btl", tenantId: localBar.id } }),
    crate: await prisma.unitOfMeasure.create({ data: { name: "Crate", abbreviation: "crt", tenantId: localBar.id } }),
    tot: await prisma.unitOfMeasure.create({ data: { name: "Tot", abbreviation: "tot", tenantId: localBar.id } }),
    glass: await prisma.unitOfMeasure.create({ data: { name: "Glass", abbreviation: "gls", tenantId: localBar.id } }),
    piece: await prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: localBar.id } }),
    jug: await prisma.unitOfMeasure.create({ data: { name: "Jug", abbreviation: "jug", tenantId: localBar.id } }),
  };

  await prisma.unitConversion.createMany({
    data: [
      { fromUnitId: barUnits.crate.id, toUnitId: barUnits.bottle.id, factor: 24 },
      { fromUnitId: barUnits.jug.id, toUnitId: barUnits.glass.id, factor: 5 },
    ],
  });

  // Bar categories
  const barBeers = await prisma.category.create({ data: { name: "Beers", color: "#f59e0b", tenantId: localBar.id } });
  const barSpirits = await prisma.category.create({ data: { name: "Spirits", color: "#8b5cf6", tenantId: localBar.id } });
  const barSoft = await prisma.category.create({ data: { name: "Soft Drinks", color: "#3b82f6", tenantId: localBar.id } });
  const barFood = await prisma.category.create({ data: { name: "Food & Snacks", color: "#ef4444", tenantId: localBar.id } });
  const barCigarettes = await prisma.category.create({ data: { name: "Cigarettes", color: "#6b7280", tenantId: localBar.id } });

  // Beer subcategories
  const subTusker = await prisma.category.create({ data: { name: "Tusker", color: "#f59e0b", parentId: barBeers.id, tenantId: localBar.id } });
  const subWhiteCap = await prisma.category.create({ data: { name: "White Cap", color: "#fbbf24", parentId: barBeers.id, tenantId: localBar.id } });
  const subGuinness = await prisma.category.create({ data: { name: "Guinness", color: "#1f2937", parentId: barBeers.id, tenantId: localBar.id } });
  const subImports = await prisma.category.create({ data: { name: "Imports", color: "#10b981", parentId: barBeers.id, tenantId: localBar.id } });

  const barProducts = [
    // Tusker
    { name: "Tusker Lager 500ml", sku: "BEER-TL-500", price: 280, cost: 180, categoryId: subTusker.id, unitId: barUnits.bottle.id },
    { name: "Tusker Malt 500ml", sku: "BEER-TM-500", price: 320, cost: 210, categoryId: subTusker.id, unitId: barUnits.bottle.id },
    { name: "Tusker Lite 330ml", sku: "BEER-TLT-330", price: 280, cost: 180, categoryId: subTusker.id, unitId: barUnits.bottle.id },
    { name: "Tusker Cider 330ml", sku: "BEER-TC-330", price: 300, cost: 200, categoryId: subTusker.id, unitId: barUnits.bottle.id },
    // White Cap
    { name: "White Cap Lager 500ml", sku: "BEER-WC-500", price: 280, cost: 180, categoryId: subWhiteCap.id, unitId: barUnits.bottle.id },
    // Guinness
    { name: "Guinness 500ml", sku: "BEER-GN-500", price: 320, cost: 210, categoryId: subGuinness.id, unitId: barUnits.bottle.id },
    { name: "Guinness Smooth 330ml", sku: "BEER-GS-330", price: 280, cost: 185, categoryId: subGuinness.id, unitId: barUnits.bottle.id },
    // Imports
    { name: "Heineken 330ml", sku: "BEER-HN-330", price: 350, cost: 240, categoryId: subImports.id, unitId: barUnits.bottle.id },
    { name: "Corona Extra 330ml", sku: "BEER-COR-330", price: 400, cost: 280, categoryId: subImports.id, unitId: barUnits.bottle.id },
    { name: "Smirnoff Ice 275ml", sku: "BEER-SMI-275", price: 300, cost: 200, categoryId: subImports.id, unitId: barUnits.bottle.id },
    // Spirits
    { name: "Kenya Cane 250ml", sku: "SPR-KC-250", price: 350, cost: 250, categoryId: barSpirits.id, unitId: barUnits.bottle.id },
    { name: "Kenya Cane 750ml", sku: "SPR-KC-750", price: 900, cost: 650, categoryId: barSpirits.id, unitId: barUnits.bottle.id },
    { name: "Gilbeys Gin 250ml", sku: "SPR-GG-250", price: 400, cost: 280, categoryId: barSpirits.id, unitId: barUnits.bottle.id },
    { name: "Chrome Vodka 250ml", sku: "SPR-CHR-250", price: 350, cost: 240, categoryId: barSpirits.id, unitId: barUnits.bottle.id },
    { name: "Jameson Whiskey (Tot)", sku: "SPR-JAM-TOT", price: 250, cost: 150, categoryId: barSpirits.id, unitId: barUnits.tot.id },
    { name: "Jack Daniels (Tot)", sku: "SPR-JD-TOT", price: 350, cost: 220, categoryId: barSpirits.id, unitId: barUnits.tot.id },
    // Soft Drinks
    { name: "Coca-Cola 300ml", sku: "SD-CC-300", price: 100, cost: 60, categoryId: barSoft.id, unitId: barUnits.bottle.id },
    { name: "Sprite 300ml", sku: "SD-SPR-300", price: 100, cost: 60, categoryId: barSoft.id, unitId: barUnits.bottle.id },
    { name: "Red Bull 250ml", sku: "SD-RB-250", price: 300, cost: 200, categoryId: barSoft.id, unitId: barUnits.piece.id },
    { name: "Krest Bitter Lemon", sku: "SD-KBL-300", price: 120, cost: 70, categoryId: barSoft.id, unitId: barUnits.bottle.id },
    { name: "Water 500ml", sku: "SD-WAT-500", price: 80, cost: 30, categoryId: barSoft.id, unitId: barUnits.bottle.id },
    // Food
    { name: "Nyama Choma 1/4kg", sku: "FD-NC-250", price: 400, cost: 200, categoryId: barFood.id, unitId: barUnits.piece.id },
    { name: "Nyama Choma 1/2kg", sku: "FD-NC-500", price: 700, cost: 380, categoryId: barFood.id, unitId: barUnits.piece.id },
    { name: "Chips Masala", sku: "FD-CHP-M", price: 250, cost: 100, categoryId: barFood.id, unitId: barUnits.piece.id },
    { name: "Mutura (3 pieces)", sku: "FD-MTR-3", price: 150, cost: 60, categoryId: barFood.id, unitId: barUnits.piece.id },
    { name: "Smokies (2 pieces)", sku: "FD-SMK-2", price: 100, cost: 40, categoryId: barFood.id, unitId: barUnits.piece.id },
    // Cigarettes
    { name: "Sportsman", sku: "CIG-SPT", price: 250, cost: 200, categoryId: barCigarettes.id, unitId: barUnits.piece.id },
    { name: "Dunhill", sku: "CIG-DHL", price: 300, cost: 240, categoryId: barCigarettes.id, unitId: barUnits.piece.id },
    { name: "Embassy", sku: "CIG-EMB", price: 280, cost: 220, categoryId: barCigarettes.id, unitId: barUnits.piece.id },
  ];

  for (const p of barProducts) {
    const product = await prisma.product.create({
      data: { ...p, tenantId: localBar.id },
    });
    await prisma.stock.create({
      data: { productId: product.id, locationId: barLoc.id, quantity: Math.floor(Math.random() * 100) + 20 },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. SAVANNA LOUNGE (Established Bar & Restaurant)
  // ═══════════════════════════════════════════════════════════════
  const lounge = await prisma.tenant.create({
    data: {
      name: "Savanna Lounge",
      slug: "savanna-lounge",
      type: "BAR",
      tier: "ENTERPRISE",
      email: "admin@savannalounge.co.ke",
      phone: "+254740500600",
      currency: "KES",
      taxRate: 16,
      receiptHeader: "Savanna Lounge\nWestlands, Woodvale Grove\nTel: 0740 500 600",
      receiptFooter: "Thank you for choosing Savanna Lounge. See you again!",
      isActive: true,
      trialEndsAt: trialEnd,
    },
  });

  const loungeOwner = await prisma.user.create({
    data: { name: "Brian Kipchoge", email: "admin@savannalounge.co.ke", phone: "+254740500600", password: hashedPassword, role: "OWNER", tenantId: lounge.id },
  });
  await prisma.user.create({
    data: { name: "Faith Chebet", email: "manager@savannalounge.co.ke", phone: "+254741600700", password: hashedPassword, role: "MANAGER", tenantId: lounge.id },
  });
  await prisma.user.create({
    data: { name: "Kevin Omondi", email: "bartender@savannalounge.co.ke", phone: "+254742700800", password: hashedPassword, role: "CASHIER", tenantId: lounge.id },
  });
  await prisma.user.create({
    data: { name: "Lucy Nyambura", email: "waitress@savannalounge.co.ke", phone: "+254743800900", password: hashedPassword, role: "CASHIER", tenantId: lounge.id },
  });
  await prisma.user.create({
    data: { name: "Chef Mutua", email: "kitchen@savannalounge.co.ke", phone: "+254744900100", password: hashedPassword, role: "KITCHEN", tenantId: lounge.id },
  });

  const loungeLoc = await prisma.location.create({
    data: { name: "Westlands Main", address: "Woodvale Grove, Westlands, Nairobi", phone: "+254740500600", tenantId: lounge.id },
  });
  await prisma.register.create({ data: { name: "Bar 1", locationId: loungeLoc.id } });
  await prisma.register.create({ data: { name: "Bar 2", locationId: loungeLoc.id } });
  await prisma.register.create({ data: { name: "VIP Lounge", locationId: loungeLoc.id } });

  // Lounge units
  const loungeUnits = {
    bottle: await prisma.unitOfMeasure.create({ data: { name: "Bottle", abbreviation: "btl", tenantId: lounge.id } }),
    crate: await prisma.unitOfMeasure.create({ data: { name: "Crate", abbreviation: "crt", tenantId: lounge.id } }),
    tot: await prisma.unitOfMeasure.create({ data: { name: "Tot (25ml)", abbreviation: "tot", tenantId: lounge.id } }),
    double: await prisma.unitOfMeasure.create({ data: { name: "Double (50ml)", abbreviation: "dbl", tenantId: lounge.id } }),
    glass: await prisma.unitOfMeasure.create({ data: { name: "Glass", abbreviation: "gls", tenantId: lounge.id } }),
    piece: await prisma.unitOfMeasure.create({ data: { name: "Piece", abbreviation: "pc", tenantId: lounge.id } }),
    portion: await prisma.unitOfMeasure.create({ data: { name: "Portion", abbreviation: "ptn", tenantId: lounge.id } }),
    jug: await prisma.unitOfMeasure.create({ data: { name: "Jug (1L)", abbreviation: "jug", tenantId: lounge.id } }),
    pitcher: await prisma.unitOfMeasure.create({ data: { name: "Pitcher (2L)", abbreviation: "ptr", tenantId: lounge.id } }),
  };

  await prisma.unitConversion.createMany({
    data: [
      { fromUnitId: loungeUnits.crate.id, toUnitId: loungeUnits.bottle.id, factor: 24 },
      { fromUnitId: loungeUnits.double.id, toUnitId: loungeUnits.tot.id, factor: 2 },
      { fromUnitId: loungeUnits.jug.id, toUnitId: loungeUnits.glass.id, factor: 5 },
      { fromUnitId: loungeUnits.pitcher.id, toUnitId: loungeUnits.glass.id, factor: 10 },
    ],
  });

  // Lounge categories
  const lngPremiumSpirits = await prisma.category.create({ data: { name: "Premium Spirits", color: "#d4af37", tenantId: lounge.id } });
  const lngBeers = await prisma.category.create({ data: { name: "Beers & Ciders", color: "#f59e0b", tenantId: lounge.id } });
  const lngWines = await prisma.category.create({ data: { name: "Wines", color: "#7c3aed", tenantId: lounge.id } });
  const lngCocktails = await prisma.category.create({ data: { name: "Cocktails", color: "#ec4899", tenantId: lounge.id } });
  const lngStarters = await prisma.category.create({ data: { name: "Starters", color: "#10b981", tenantId: lounge.id } });
  const lngMains = await prisma.category.create({ data: { name: "Main Course", color: "#ef4444", tenantId: lounge.id } });
  const lngDesserts = await prisma.category.create({ data: { name: "Desserts", color: "#f97316", tenantId: lounge.id } });
  const lngSoft = await prisma.category.create({ data: { name: "Soft Drinks", color: "#3b82f6", tenantId: lounge.id } });
  const lngShisha = await prisma.category.create({ data: { name: "Shisha", color: "#6366f1", tenantId: lounge.id } });

  // Spirits subcategories
  const subWhiskey = await prisma.category.create({ data: { name: "Whiskey", color: "#d4af37", parentId: lngPremiumSpirits.id, tenantId: lounge.id } });
  const subVodka = await prisma.category.create({ data: { name: "Vodka", color: "#a1a1aa", parentId: lngPremiumSpirits.id, tenantId: lounge.id } });
  const subGin = await prisma.category.create({ data: { name: "Gin", color: "#06b6d4", parentId: lngPremiumSpirits.id, tenantId: lounge.id } });
  const subRum = await prisma.category.create({ data: { name: "Rum", color: "#78350f", parentId: lngPremiumSpirits.id, tenantId: lounge.id } });
  const subTequila = await prisma.category.create({ data: { name: "Tequila", color: "#65a30d", parentId: lngPremiumSpirits.id, tenantId: lounge.id } });
  const subCognac = await prisma.category.create({ data: { name: "Cognac", color: "#92400e", parentId: lngPremiumSpirits.id, tenantId: lounge.id } });

  const loungeProducts = [
    // Premium Whiskey
    { name: "Johnnie Walker Black (Tot)", sku: "WH-JWB-TOT", price: 450, cost: 250, categoryId: subWhiskey.id, unitId: loungeUnits.tot.id },
    { name: "Johnnie Walker Black (Double)", sku: "WH-JWB-DBL", price: 800, cost: 500, categoryId: subWhiskey.id, unitId: loungeUnits.double.id },
    { name: "Johnnie Walker Gold (Tot)", sku: "WH-JWG-TOT", price: 700, cost: 400, categoryId: subWhiskey.id, unitId: loungeUnits.tot.id },
    { name: "Glenfiddich 12yr (Tot)", sku: "WH-GF12-TOT", price: 800, cost: 480, categoryId: subWhiskey.id, unitId: loungeUnits.tot.id },
    { name: "Jack Daniels (Tot)", sku: "WH-JD-TOT", price: 400, cost: 220, categoryId: subWhiskey.id, unitId: loungeUnits.tot.id },
    { name: "Jameson Irish (Tot)", sku: "WH-JAM-TOT", price: 380, cost: 200, categoryId: subWhiskey.id, unitId: loungeUnits.tot.id },
    { name: "Hennessy VS (Tot)", sku: "COG-HV-TOT", price: 600, cost: 350, categoryId: subCognac.id, unitId: loungeUnits.tot.id },
    // Vodka
    { name: "Absolut Vodka (Tot)", sku: "VDK-ABS-TOT", price: 350, cost: 180, categoryId: subVodka.id, unitId: loungeUnits.tot.id },
    { name: "Grey Goose (Tot)", sku: "VDK-GG-TOT", price: 650, cost: 380, categoryId: subVodka.id, unitId: loungeUnits.tot.id },
    { name: "Smirnoff (Tot)", sku: "VDK-SMR-TOT", price: 250, cost: 130, categoryId: subVodka.id, unitId: loungeUnits.tot.id },
    // Gin
    { name: "Tanqueray (Tot)", sku: "GIN-TAN-TOT", price: 400, cost: 220, categoryId: subGin.id, unitId: loungeUnits.tot.id },
    { name: "Hendricks (Tot)", sku: "GIN-HEN-TOT", price: 550, cost: 320, categoryId: subGin.id, unitId: loungeUnits.tot.id },
    { name: "Bombay Sapphire (Tot)", sku: "GIN-BOM-TOT", price: 380, cost: 200, categoryId: subGin.id, unitId: loungeUnits.tot.id },
    // Rum & Tequila
    { name: "Captain Morgan (Tot)", sku: "RUM-CM-TOT", price: 350, cost: 180, categoryId: subRum.id, unitId: loungeUnits.tot.id },
    { name: "Bacardi White (Tot)", sku: "RUM-BAC-TOT", price: 300, cost: 160, categoryId: subRum.id, unitId: loungeUnits.tot.id },
    { name: "Jose Cuervo Gold (Tot)", sku: "TEQ-JC-TOT", price: 400, cost: 220, categoryId: subTequila.id, unitId: loungeUnits.tot.id },
    { name: "Patron Silver (Tot)", sku: "TEQ-PAT-TOT", price: 800, cost: 500, categoryId: subTequila.id, unitId: loungeUnits.tot.id },
    // Beers
    { name: "Tusker Lager 500ml", sku: "BEER-TL-500", price: 350, cost: 180, categoryId: lngBeers.id, unitId: loungeUnits.bottle.id },
    { name: "Tusker Malt 500ml", sku: "BEER-TM-500", price: 400, cost: 210, categoryId: lngBeers.id, unitId: loungeUnits.bottle.id },
    { name: "Heineken 330ml", sku: "BEER-HN-330", price: 450, cost: 240, categoryId: lngBeers.id, unitId: loungeUnits.bottle.id },
    { name: "Corona Extra 355ml", sku: "BEER-COR-355", price: 500, cost: 280, categoryId: lngBeers.id, unitId: loungeUnits.bottle.id },
    { name: "Savanna Dry Cider", sku: "BEER-SAV-330", price: 450, cost: 260, categoryId: lngBeers.id, unitId: loungeUnits.bottle.id },
    { name: "Guinness 500ml", sku: "BEER-GN-500", price: 400, cost: 210, categoryId: lngBeers.id, unitId: loungeUnits.bottle.id },
    // Wines
    { name: "House Red (Glass)", sku: "WINE-RED-GLS", price: 500, cost: 200, categoryId: lngWines.id, unitId: loungeUnits.glass.id },
    { name: "House White (Glass)", sku: "WINE-WHT-GLS", price: 500, cost: 200, categoryId: lngWines.id, unitId: loungeUnits.glass.id },
    { name: "Nederburg Cabernet (Bottle)", sku: "WINE-NED-BTL", price: 3500, cost: 1800, categoryId: lngWines.id, unitId: loungeUnits.bottle.id },
    { name: "Four Cousins Sweet Rose (Bottle)", sku: "WINE-4C-BTL", price: 2500, cost: 1200, categoryId: lngWines.id, unitId: loungeUnits.bottle.id },
    // Cocktails
    { name: "Mojito", sku: "CTL-MOJ", price: 700, cost: 250, categoryId: lngCocktails.id, unitId: loungeUnits.glass.id },
    { name: "Long Island Iced Tea", sku: "CTL-LIIT", price: 800, cost: 300, categoryId: lngCocktails.id, unitId: loungeUnits.glass.id },
    { name: "Pina Colada", sku: "CTL-PIN", price: 750, cost: 280, categoryId: lngCocktails.id, unitId: loungeUnits.glass.id },
    { name: "Dawa", sku: "CTL-DAWA", price: 600, cost: 200, categoryId: lngCocktails.id, unitId: loungeUnits.glass.id },
    { name: "Espresso Martini", sku: "CTL-ESPM", price: 850, cost: 320, categoryId: lngCocktails.id, unitId: loungeUnits.glass.id },
    // Starters
    { name: "Chicken Wings (6pc)", sku: "STR-CW-6", price: 850, cost: 350, categoryId: lngStarters.id, unitId: loungeUnits.portion.id },
    { name: "Calamari Rings", sku: "STR-CAL", price: 750, cost: 300, categoryId: lngStarters.id, unitId: loungeUnits.portion.id },
    { name: "Loaded Nachos", sku: "STR-NAC", price: 700, cost: 250, categoryId: lngStarters.id, unitId: loungeUnits.portion.id },
    { name: "Spring Rolls (4pc)", sku: "STR-SR-4", price: 600, cost: 200, categoryId: lngStarters.id, unitId: loungeUnits.portion.id },
    // Mains
    { name: "Grilled Tilapia", sku: "MN-TLP", price: 1500, cost: 600, categoryId: lngMains.id, unitId: loungeUnits.portion.id },
    { name: "Nyama Choma 500g", sku: "MN-NC-500", price: 1200, cost: 500, categoryId: lngMains.id, unitId: loungeUnits.portion.id },
    { name: "Ribs & Fries", sku: "MN-RBF", price: 1400, cost: 550, categoryId: lngMains.id, unitId: loungeUnits.portion.id },
    { name: "Beef Burger & Chips", sku: "MN-BRG", price: 950, cost: 380, categoryId: lngMains.id, unitId: loungeUnits.portion.id },
    { name: "Chicken Tikka Masala", sku: "MN-CTM", price: 1100, cost: 420, categoryId: lngMains.id, unitId: loungeUnits.portion.id },
    // Desserts
    { name: "Chocolate Lava Cake", sku: "DST-CLC", price: 650, cost: 200, categoryId: lngDesserts.id, unitId: loungeUnits.piece.id },
    { name: "Ice Cream (3 scoops)", sku: "DST-ICE", price: 450, cost: 150, categoryId: lngDesserts.id, unitId: loungeUnits.piece.id },
    // Soft Drinks
    { name: "Coca-Cola 330ml", sku: "SD-CC-330", price: 150, cost: 60, categoryId: lngSoft.id, unitId: loungeUnits.bottle.id },
    { name: "Red Bull 250ml", sku: "SD-RB-250", price: 400, cost: 200, categoryId: lngSoft.id, unitId: loungeUnits.piece.id },
    { name: "Fresh Orange Juice", sku: "SD-FOJ", price: 400, cost: 150, categoryId: lngSoft.id, unitId: loungeUnits.glass.id },
    { name: "Still Water 500ml", sku: "SD-WAT-500", price: 150, cost: 30, categoryId: lngSoft.id, unitId: loungeUnits.bottle.id },
    { name: "Sparkling Water 750ml", sku: "SD-SPK-750", price: 350, cost: 150, categoryId: lngSoft.id, unitId: loungeUnits.bottle.id },
    // Shisha
    { name: "Shisha - Single Flavor", sku: "SH-SINGLE", price: 1000, cost: 300, categoryId: lngShisha.id, unitId: loungeUnits.piece.id },
    { name: "Shisha - Double Flavor", sku: "SH-DOUBLE", price: 1500, cost: 450, categoryId: lngShisha.id, unitId: loungeUnits.piece.id },
    { name: "Shisha Refill", sku: "SH-REFILL", price: 500, cost: 150, categoryId: lngShisha.id, unitId: loungeUnits.piece.id },
  ];

  for (const p of loungeProducts) {
    const product = await prisma.product.create({
      data: { ...p, tenantId: lounge.id },
    });
    await prisma.stock.create({
      data: { productId: product.id, locationId: loungeLoc.id, quantity: Math.floor(Math.random() * 60) + 10 },
    });
  }

  // Print credentials
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SEED COMPLETED SUCCESSFULLY");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│  1. DUKA KUU WHOLESALE & RETAIL (Supermarket)           │");
  console.log("├─────────────────────────────────────────────────────────┤");
  console.log("│  URL:      http://localhost:3000/duka-kuu/dashboard     │");
  console.log("│  Email:    admin@dukakuu.co.ke                          │");
  console.log("│  Password: password123                                  │");
  console.log("│  Staff:    cashier@dukakuu.co.ke / password123          │");
  console.log("│            stock@dukakuu.co.ke / password123            │");
  console.log("│            manager@dukakuu.co.ke / password123          │");
  console.log(`│  Products: ${retailProducts.length} items across ${10} categories              │`);
  console.log("└─────────────────────────────────────────────────────────┘\n");

  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│  2. MZINGA SPORTS BAR (Local Bar - Pangani)             │");
  console.log("├─────────────────────────────────────────────────────────┤");
  console.log("│  URL:      http://localhost:3000/mzinga-bar/dashboard   │");
  console.log("│  Email:    admin@mzinga.co.ke                           │");
  console.log("│  Password: password123                                  │");
  console.log("│  Staff:    waiter@mzinga.co.ke / password123            │");
  console.log(`│  Products: ${barProducts.length} items (beers, spirits, food)           │`);
  console.log("│  Type:     Local neighborhood sports bar                │");
  console.log("└─────────────────────────────────────────────────────────┘\n");

  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│  3. SAVANNA LOUNGE (Established Bar - Westlands)        │");
  console.log("├─────────────────────────────────────────────────────────┤");
  console.log("│  URL:      http://localhost:3000/savanna-lounge/dashboard│");
  console.log("│  Email:    admin@savannalounge.co.ke                    │");
  console.log("│  Password: password123                                  │");
  console.log("│  Staff:    manager@savannalounge.co.ke / password123    │");
  console.log("│            bartender@savannalounge.co.ke / password123  │");
  console.log("│            waitress@savannalounge.co.ke / password123   │");
  console.log("│            kitchen@savannalounge.co.ke / password123    │");
  console.log(`│  Products: ${loungeProducts.length} items (premium spirits, cocktails, food) │`);
  console.log("│  Type:     Upscale Westlands lounge & restaurant        │");
  console.log("└─────────────────────────────────────────────────────────┘\n");

  console.log("Features enabled:");
  console.log("  ✓ Product hierarchy (Category -> Subcategory -> Products)");
  console.log("  ✓ Units of measure with conversions");
  console.log("  ✓ Open tabs (TAB order status) for bars");
  console.log("  ✓ Multiple registers per location");
  console.log("");
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
