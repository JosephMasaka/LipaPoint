import { PrismaClient } from "@prisma/client";
import { approvePayrollRun, createPayrollRun, ensureStatutoryRates } from "../src/lib/payroll";

/**
 * ERP sample data for the demo tenants: staff records, leave, a staff loan, two
 * payroll runs and a depreciating asset register. Club Chairman has its own
 * hand-written demo (see prisma/seed.ts) because it is the showcase tenant;
 * everything else is driven from the plans below so a reviewer opening Payroll
 * or Assets on any demo login finds history instead of an empty table.
 */

type Staff = {
  name: string; // split into firstName / lastName
  title: string;
  salary: number;
  months: number; // months ago the person started
  type?: "permanent" | "contract" | "casual";
};

type Asset = {
  name: string;
  category: "equipment" | "it" | "kitchen" | "furniture" | "vehicle" | "other";
  cost: number;
  life: number; // useful life in months
  age: number; // months ago it was bought
  s?: number; // staff index it is assigned to
  status?: "in_service" | "under_maintenance" | "disposed";
  disposed?: number; // months ago it was disposed (defaults to 4)
  proceeds?: number; // disposal proceeds when disposed
  note?: string;
};

type Plan = {
  staff: Staff[];
  assets: Asset[];
  leave?: Array<{ s: number; type: string; days: number; from: number; reason: string; status: string }>;
  loan?: { s: number; principal: number; balance: number; monthly: number; reason: string };
  maintain?: Array<{ a: number; months: number; description: string; cost: number; vendor: string; dueIn?: number }>;
};

const ERP_PLANS: Record<string, Plan> = {
  "duka-kuu": {
    staff: [
      { name: "Alice Wambui", title: "Till Supervisor", salary: 42000, months: 30 },
      { name: "Collins Odhiambo", title: "Shelf Packer", salary: 22000, months: 14 },
      { name: "Faith Chepkoech", title: "Cashier", salary: 26000, months: 9 },
      { name: "Moses Kariuki", title: "Delivery Driver", salary: 28000, months: 20, type: "contract" },
      { name: "Esther Nyambura", title: "Cleaner", salary: 17000, months: 6, type: "casual" },
    ],
    assets: [
      { name: "Chest Freezer 500L", category: "kitchen", cost: 95000, life: 84, age: 30 },
      { name: "Barcode Scanner (Counter 1)", category: "it", cost: 12000, life: 36, age: 18, s: 2 },
      { name: "Shelf Racking (Aisles 1-4)", category: "furniture", cost: 210000, life: 120, age: 42 },
      { name: "Delivery Tuk-tuk", category: "vehicle", cost: 320000, life: 60, age: 14, s: 3 },
      { name: "Standby Generator 10kVA", category: "equipment", cost: 190000, life: 96, age: 26, status: "under_maintenance" },
    ],
    leave: [
      { s: 0, type: "annual", days: 5, from: -6, reason: "Family wedding upcountry", status: "approved" },
      { s: 1, type: "sick", days: 2, from: 3, reason: "Flu - clinic note attached", status: "pending" },
    ],
    loan: { s: 2, principal: 24000, balance: 15000, monthly: 2500, reason: "Rent deposit advance" },
    maintain: [{ a: 4, months: 1, description: "Routine service: oil, filters and coolant", cost: 5200, vendor: "Nairobi Power Systems", dueIn: 60 }],
  },
  "mzinga-bar": {
    staff: [
      { name: "Dennis Mutua", title: "Head Bartender", salary: 34000, months: 33 },
      { name: "Sharon Atieno", title: "Waitress", salary: 24000, months: 11 },
      { name: "Joseph Kimani", title: "Cook", salary: 30000, months: 24 },
      { name: "Nancy Wairimu", title: "Cleaner", salary: 17000, months: 5, type: "casual" },
      { name: "Peter Njoroge", title: "Security", salary: 22000, months: 8, type: "contract" },
    ],
    assets: [
      { name: "Beer Cooler Display", category: "kitchen", cost: 120000, life: 84, age: 22 },
      { name: "PA Sound System", category: "equipment", cost: 85000, life: 60, age: 30, status: "under_maintenance" },
      { name: "Pool Table", category: "furniture", cost: 140000, life: 120, age: 36 },
      { name: "POS Terminal (Bar Counter)", category: "it", cost: 60000, life: 48, age: 12, s: 0 },
      { name: "Old Deep Freezer", category: "kitchen", cost: 78000, life: 84, age: 40, status: "disposed", disposed: 4, proceeds: 9000, note: "Compressor failed, sold for parts" },
    ],
    leave: [
      { s: 1, type: "annual", days: 5, from: -6, reason: "Annual leave", status: "approved" },
      { s: 3, type: "sick", days: 2, from: 3, reason: "Stomach bug", status: "pending" },
    ],
    loan: { s: 0, principal: 30000, balance: 21000, monthly: 3000, reason: "School fees" },
    maintain: [{ a: 1, months: 2, description: "Re-coned a speaker and replaced two XLR cables", cost: 6500, vendor: "Sonic Repairs" }],
  },
  "savanna-lounge": {
    staff: [
      { name: "Cynthia Adhiambo", title: "Bar Manager", salary: 52000, months: 28 },
      { name: "Brian Wekesa", title: "Head Bartender", salary: 36000, months: 20 },
      { name: "Mercy Nyambura", title: "Waitress", salary: 24000, months: 13 },
      { name: "Anthony Kariuki", title: "Head Chef", salary: 45000, months: 31 },
      { name: "Grace Mueni", title: "Cleaner", salary: 17000, months: 4, type: "casual" },
    ],
    assets: [
      { name: "Wine Chiller (300 bottles)", category: "kitchen", cost: 165000, life: 84, age: 20 },
      { name: "Lounge Sofa Set", category: "furniture", cost: 240000, life: 120, age: 34 },
      { name: '65" Display Screens (x3)', category: "it", cost: 210000, life: 60, age: 18 },
      { name: "Standby Generator 15kVA", category: "equipment", cost: 280000, life: 96, age: 30, status: "under_maintenance" },
      { name: "Cocktail Station", category: "equipment", cost: 95000, life: 84, age: 26 },
    ],
    leave: [{ s: 2, type: "annual", days: 7, from: -10, reason: "Wedding in Kisumu", status: "approved" }],
    loan: { s: 3, principal: 40000, balance: 24000, monthly: 4000, reason: "Medical bill" },
    maintain: [{ a: 3, months: 1, description: "Alternator rebuilt and fuel filter replaced", cost: 18500, vendor: "PowerGen Services", dueIn: 90 }],
  },
  "mama-njeri": {
    staff: [
      { name: "Lucy Wanjiru", title: "Shop Supervisor", salary: 32000, months: 26 },
      { name: "Peter Mwangi", title: "Shop Attendant", salary: 21000, months: 12 },
      { name: "Ruth Auma", title: "Shop Attendant", salary: 20000, months: 7, type: "casual" },
      { name: "Samuel Kilonzo", title: "Delivery Rider", salary: 23000, months: 15, type: "contract" },
    ],
    assets: [
      { name: "Display Fridge 300L", category: "kitchen", cost: 68000, life: 84, age: 22 },
      { name: "Counter Shelving", category: "furniture", cost: 55000, life: 120, age: 34 },
      { name: "Smartphone POS", category: "it", cost: 24000, life: 36, age: 14, s: 0 },
      { name: "Delivery Motorbike 125cc", category: "vehicle", cost: 145000, life: 60, age: 19, s: 3 },
      { name: "Hand Truck", category: "equipment", cost: 9000, life: 60, age: 40 },
    ],
    leave: [{ s: 1, type: "annual", days: 4, from: -5, reason: "Travel to Meru", status: "approved" }],
    loan: { s: 3, principal: 18000, balance: 9000, monthly: 1500, reason: "Motorbike insurance" },
    maintain: [{ a: 0, months: 3, description: "Gas top-up and door seal replacement", cost: 3200, vendor: "Cool Care Fridges" }],
  },
  "safari-bites": {
    staff: [
      { name: "Joseph Ochieng", title: "Head Chef", salary: 48000, months: 30 },
      { name: "Janet Wambui", title: "Waitress", salary: 23000, months: 12 },
      { name: "Kelvin Mwangi", title: "Cook", salary: 30000, months: 20 },
      { name: "Beatrice Achieng", title: "Cashier", salary: 26000, months: 9 },
      { name: "David Kimani", title: "Cleaner", salary: 17000, months: 5, type: "casual" },
    ],
    assets: [
      { name: "Commercial Cooker (4-burner)", category: "kitchen", cost: 135000, life: 96, age: 24 },
      { name: "Chiller Fridge 600L", category: "kitchen", cost: 155000, life: 84, age: 30 },
      { name: "Dining Furniture Set", category: "furniture", cost: 180000, life: 120, age: 36 },
      { name: "POS Terminal (POS 1)", category: "it", cost: 62000, life: 48, age: 15, s: 3 },
      { name: "Generator 12kVA", category: "equipment", cost: 210000, life: 96, age: 18, status: "under_maintenance" },
    ],
    leave: [
      { s: 1, type: "sick", days: 3, from: 2, reason: "Food poisoning", status: "pending" },
      { s: 2, type: "annual", days: 6, from: -8, reason: "Annual leave", status: "approved" },
    ],
    loan: { s: 0, principal: 35000, balance: 20000, monthly: 3500, reason: "House deposit" },
    maintain: [{ a: 4, months: 1, description: "Injector clean and battery replacement", cost: 14500, vendor: "Kiptoo Power Services", dueIn: 75 }],
  },
  "afya-pharmacy": {
    staff: [
      { name: "Dr. Ruth Kiptoo", title: "Pharmacist", salary: 65000, months: 32 },
      { name: "Joan Cherono", title: "Pharmaceutical Technologist", salary: 42000, months: 18 },
      { name: "Peter Barasa", title: "Store Keeper", salary: 30000, months: 22 },
      { name: "Winnie Jepkosgei", title: "Cashier", salary: 26000, months: 11 },
      { name: "Elijah Mwangi", title: "Cleaner", salary: 17000, months: 6, type: "casual" },
    ],
    assets: [
      { name: "Vaccine Fridge (medical grade)", category: "equipment", cost: 145000, life: 96, age: 28 },
      { name: "Medicine Display Shelving", category: "furniture", cost: 120000, life: 120, age: 34 },
      { name: "POS Terminal (Dispensary)", category: "it", cost: 65000, life: 48, age: 16, s: 3 },
      { name: "Back-up Generator 8kVA", category: "equipment", cost: 165000, life: 96, age: 24, status: "under_maintenance" },
      { name: "Delivery Motorbike 150cc", category: "vehicle", cost: 160000, life: 60, age: 12 },
    ],
    leave: [{ s: 1, type: "annual", days: 5, from: -6, reason: "Continuing education course", status: "approved" }],
    loan: { s: 2, principal: 45000, balance: 27000, monthly: 4500, reason: "School fees" },
    maintain: [{ a: 3, months: 2, description: "Full service and AVR replacement", cost: 11000, vendor: "PowerGen Services", dueIn: 60 }],
  },
  "jengo-hardware": {
    staff: [
      { name: "Stephen Mutiso", title: "Yard Supervisor", salary: 38000, months: 30 },
      { name: "Jane Mueni", title: "Counter Sales", salary: 27000, months: 16 },
      { name: "Daniel Otieno", title: "Loader", salary: 20000, months: 9, type: "casual" },
      { name: "Patrick Ndegwa", title: "Delivery Driver", salary: 29000, months: 21, type: "contract" },
      { name: "Mary Wanjiku", title: "Store Clerk", salary: 25000, months: 13 },
    ],
    assets: [
      { name: "Pickup Truck (1.5t)", category: "vehicle", cost: 1250000, life: 120, age: 36, s: 3 },
      { name: "Cement Mixer", category: "equipment", cost: 185000, life: 96, age: 26 },
      { name: "Yard Racking & Shelving", category: "furniture", cost: 260000, life: 120, age: 40 },
      { name: "Pallet Jack (manual)", category: "equipment", cost: 320000, life: 120, age: 30, status: "under_maintenance" },
      { name: "POS Terminal (Counter 1)", category: "it", cost: 68000, life: 48, age: 14, s: 1 },
    ],
    leave: [{ s: 0, type: "annual", days: 6, from: -7, reason: "Family event", status: "approved" }],
    loan: { s: 4, principal: 25000, balance: 14000, monthly: 2500, reason: "M-Pesa float" },
    maintain: [{ a: 0, months: 1, description: "Brake pads, oil change and tyre rotation", cost: 22000, vendor: "Mombasa Road Auto" }],
  },
  "sharp-cuts": {
    staff: [
      { name: "Wilson Kariuki", title: "Master Barber", salary: 30000, months: 24 },
      { name: "Alex Mwangi", title: "Barber", salary: 24000, months: 12 },
      { name: "Cynthia Njeri", title: "Receptionist", salary: 22000, months: 9 },
      { name: "Felix Otieno", title: "Barber", salary: 24000, months: 7 },
    ],
    assets: [
      { name: "Barber Chairs (x3)", category: "furniture", cost: 135000, life: 96, age: 30 },
      { name: "Professional Clipper Set", category: "equipment", cost: 42000, life: 36, age: 14, s: 0 },
      { name: "Mirror & Station Units", category: "furniture", cost: 78000, life: 120, age: 34 },
      { name: "POS Terminal (Reception)", category: "it", cost: 55000, life: 48, age: 16, s: 2 },
      { name: "Water Heater 50L", category: "equipment", cost: 38000, life: 84, age: 28, status: "under_maintenance" },
    ],
    leave: [{ s: 1, type: "annual", days: 3, from: -4, reason: "Short break", status: "approved" }],
    loan: { s: 0, principal: 15000, balance: 6000, monthly: 1500, reason: "Tool purchase" },
    maintain: [{ a: 4, months: 2, description: "Element and thermostat replacement", cost: 4800, vendor: "City Plumbers" }],
  },
};

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return dateOnly(d);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateOnly(d);
}

function periodMonthsAgo(n: number): string {
  const d = monthsAgo(n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface ErpSampleTarget {
  slug: string;
  tenantId: string;
  locationId: string;
  ownerUserId?: string | null;
}

export interface ErpSampleResult {
  slug: string;
  skipped?: "no-plan" | "has-data";
  employees?: number;
  assets?: number;
  payrollRuns?: number;
}

/** Removes only the records this seeder creates, so `force` stays safe. */
async function clearErpSamples(prisma: PrismaClient, tenantId: string) {
  await prisma.assetMaintenance.deleteMany({ where: { tenantId } });
  await prisma.assetDepreciationEntry.deleteMany({ where: { tenantId } });
  await prisma.asset.deleteMany({ where: { tenantId } });
  await prisma.employeeLoan.deleteMany({ where: { tenantId } });
  await prisma.leaveRequest.deleteMany({ where: { tenantId } });
  await prisma.payslip.deleteMany({ where: { tenantId } });
  await prisma.payrollRun.deleteMany({ where: { tenantId } });
  await prisma.employee.deleteMany({ where: { tenantId } });
}

export async function seedErpSamplesForTenant(
  prisma: PrismaClient,
  target: ErpSampleTarget,
  opts: { force?: boolean } = {}
): Promise<ErpSampleResult> {
  const plan = ERP_PLANS[target.slug];
  if (!plan) return { slug: target.slug, skipped: "no-plan" };

  const existing = await prisma.employee.count({ where: { tenantId: target.tenantId } });
  if (existing > 0) {
    if (!opts.force) return { slug: target.slug, skipped: "has-data" };
    await clearErpSamples(prisma, target.tenantId);
  }

  // Employees are HR records, not logins: a casual labourer is paid without a
  // user account, and the statutory numbers drive the payroll deductions.
  const employeeIds: string[] = [];
  for (const [i, staff] of plan.staff.entries()) {
    const staffNumber = `EMP-${String(i + 1).padStart(4, "0")}`;
    const demo = staffNumber.slice(-4);
    const [firstName, ...rest] = staff.name.split(" ");
    const employee = await prisma.employee.create({
      data: {
        tenantId: target.tenantId,
        locationId: target.locationId,
        staffNumber,
        firstName,
        lastName: rest.join(" "),
        jobTitle: staff.title,
        phone: `+254 7${String(30 + i)} 90 00${demo.slice(-2)}`,
        kraPin: `A00${demo}89${i}X`,
        nssfNumber: `NSSF-9${demo}`,
        shaNumber: `SHA-9${demo}`,
        mpesaNumber: `+254 7${String(30 + i)} 90 00${demo.slice(-2)}`,
        employmentType: staff.type ?? "permanent",
        basicSalary: staff.salary,
        startDate: monthsAgo(staff.months),
      },
    });
    employeeIds.push(employee.id);
  }

  if (plan.leave?.length) {
    await prisma.leaveRequest.createMany({
      data: plan.leave.map((l) => ({
        tenantId: target.tenantId,
        employeeId: employeeIds[l.s],
        type: l.type,
        startDate: daysAgo(l.from),
        endDate: daysAgo(l.from - l.days + 1),
        days: l.days,
        reason: l.reason,
        status: l.status,
        approvedBy: l.status === "approved" ? target.ownerUserId ?? null : null,
      })),
    });
  }

  if (plan.loan) {
    await prisma.employeeLoan.create({
      data: {
        tenantId: target.tenantId,
        employeeId: employeeIds[plan.loan.s],
        principal: plan.loan.principal,
        balance: plan.loan.balance,
        monthlyDeduction: plan.loan.monthly,
        reason: plan.loan.reason,
        status: "active",
        startDate: monthsAgo(4),
        createdBy: target.ownerUserId ?? null,
      },
    });
  }

  // Last month's run is approved (payslips frozen) and this month stays a draft
  // so the approve -> pay -> file lifecycle is still demonstrable.
  const pastRun = await createPayrollRun({
    tenantId: target.tenantId,
    period: periodMonthsAgo(1),
    createdBy: target.ownerUserId ?? undefined,
  });
  await approvePayrollRun(target.tenantId, pastRun.id, target.ownerUserId ?? null);
  await createPayrollRun({
    tenantId: target.tenantId,
    period: periodMonthsAgo(0),
    createdBy: target.ownerUserId ?? undefined,
  });

  const assetIds: string[] = [];
  for (const [i, spec] of plan.assets.entries()) {
    const assetCode = `AST-${String(i + 1).padStart(4, "0")}`;
    const residualValue = Math.round(spec.cost * 0.1);
    const depreciable = spec.cost - residualValue;
    const monthly = Math.round((depreciable / spec.life) * 100) / 100;
    const disposed = spec.status === "disposed";
    let accumulated = disposed ? depreciable : 0;
    const schedule: Array<{ period: string; amount: number; bookValueAfter: number }> = [];

    // One entry per completed month since purchase. Disposed assets stop
    // depreciating and are written down to residual.
    if (!disposed) {
      for (let back = spec.age - 1; back >= 1; back--) {
        if (schedule.length >= spec.life) break;
        if (accumulated + monthly > depreciable + 0.005) break;
        accumulated = Math.round((accumulated + monthly) * 100) / 100;
        schedule.push({
          period: periodMonthsAgo(back),
          amount: monthly,
          bookValueAfter: Math.round((spec.cost - accumulated) * 100) / 100,
        });
      }
    }

    const asset = await prisma.asset.create({
      data: {
        tenantId: target.tenantId,
        locationId: target.locationId,
        assetCode,
        name: spec.name,
        category: spec.category,
        description: spec.note ?? null,
        purchaseCost: spec.cost,
        purchaseDate: monthsAgo(spec.age),
        depreciationMethod: disposed ? "none" : "straight_line",
        usefulLifeMonths: spec.life,
        residualValue,
        accumulatedDepreciation: accumulated,
        lifecycleStatus: spec.status ?? "in_service",
        disposedAt: disposed ? monthsAgo(spec.disposed ?? 4) : null,
        disposalProceeds: disposed ? spec.proceeds ?? 0 : null,
        assignedTo: spec.s !== undefined ? employeeIds[spec.s] : null,
      },
    });
    assetIds.push(asset.id);

    if (schedule.length > 0) {
      await prisma.assetDepreciationEntry.createMany({
        data: schedule.map((entry) => ({ tenantId: target.tenantId, assetId: asset.id, ...entry })),
      });
    }
  }

  if (plan.maintain?.length) {
    await prisma.assetMaintenance.createMany({
      data: plan.maintain.map((m) => ({
        tenantId: target.tenantId,
        assetId: assetIds[m.a],
        date: monthsAgo(m.months),
        description: m.description,
        cost: m.cost,
        performedBy: m.vendor,
        nextDueDate: m.dueIn ? new Date(Date.now() + m.dueIn * 24 * 60 * 60 * 1000) : null,
      })),
    });
  }

  return {
    slug: target.slug,
    employees: plan.staff.length,
    assets: plan.assets.length,
    payrollRuns: 2,
  };
}

// `npx tsx prisma/seed-erp-samples.ts` fills in tenants that have no HR data
// yet without truncating the rest of the demo database.
async function main() {
  const prisma = new PrismaClient();
  const force = process.argv.includes("--force");
  try {
    await ensureStatutoryRates();
    const tenants = await prisma.tenant.findMany({
      where: { type: { not: "PLATFORM" } },
      select: { id: true, slug: true, name: true },
      orderBy: { name: "asc" },
    });

    for (const tenant of tenants) {
      const location = await prisma.location.findFirst({
        where: { tenantId: tenant.id },
        select: { id: true },
        orderBy: { name: "asc" },
      });
      if (!location) {
        console.log(`  - ${tenant.name}: no location, skipped`);
        continue;
      }
      const owner = await prisma.user.findFirst({
        where: { tenantId: tenant.id, role: "OWNER" },
        select: { id: true },
      });

      const result = await seedErpSamplesForTenant(
        prisma,
        { slug: tenant.slug, tenantId: tenant.id, locationId: location.id, ownerUserId: owner?.id },
        { force }
      );
      if (result.skipped === "has-data") console.log(`  - ${tenant.name}: already has HR data`);
      else if (result.skipped) console.log(`  - ${tenant.name}: no ERP plan`);
      else console.log(`  ✓ ${tenant.name}: ${result.employees} staff, ${result.assets} assets, ${result.payrollRuns} payroll runs`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].includes("seed-erp-samples")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
