# LipaPoint demo accounts and access model

Last verified against the seeded demo database on 24 November 2026.
The machine-readable version of the same table is `LipaPoint-Demo-Accounts.xlsx`
(sheet `Accounts`), regenerated from the live database.

## What a demo login can see

Every seeded business is on the **Enterprise** tier with **8/8 ERP modules** and
**46/46 sub-features** enabled, and carries `Tenant.demoMode = true`:

| | Enabled |
|---|---|
| Modules | Point of Sale, Inventory, CRM, Finance, Procurement, KRA eTIMS, HR & Payroll, Asset Management |
| Add-ons | Attendance, Leave, Staff Loans, Recruitment (ATS), Customer Loyalty, Bank Reconciliation, Asset Depreciation, Maintenance, Disposal |
| AI | Intelligence panel, governed actions, AI Approvals inbox |

`demoMode` is what makes a **cashier or stock-keeper login show the whole
product**: it lifts the staff-role allow-lists in the sidebar
(`src/components/sidebar.tsx`) and in `src/middleware.ts`, and it satisfies the
owner/admin guards on settings, locations, payment gateways, plan changes and
approved AI actions (`isAdminUser()` in `src/lib/permissions.ts`).

It is a per-tenant column, not a global switch, so a real customer signing up
today keeps ordinary role gating. Demo tenants are marked in
`prisma/seed.ts`, and a re-seed keeps the flag on.

Because the flag is carried in the session JWT (middleware runs on the edge
without database access), **log out and back in** after toggling it for a tenant.

## Accounts

All passwords are `password123` except where noted. `@` the tenant slug in the
path, e.g. `http://localhost:3000/jengo-hardware`.

| Tenant (slug) | Business | Owner | Other staff |
|---|---|---|---|
| `duka-kuu` | Duka Kuu Wholesale & Retail (supermarket) | admin@dukakuu.co.ke — James Mwangi | cashier@dukakuu.co.ke (CASHIER), stock@dukakuu.co.ke (STOCK_KEEPER) |
| `mzinga-bar` | Mzinga Sports Bar | admin@mzingabar.co.ke — Kevin Otieno | cashier@mzingabar.co.ke (CASHIER) |
| `savanna-lounge` | Savanna Lounge | admin@savannalounge.co.ke — Diana Kamau | manager@savannalounge.co.ke (MANAGER), cashier@savannalounge.co.ke (CASHIER) |
| `club-chairman` | Club Chairman (bar) | jkmasaka@gmail.com — John Masaka, **`Chairman@2024`** | jackie@clubchairman.co.ke (CASHIER), **`Jackie@2024`** |
| `mama-njeri` | Mama Njeri's Shop (retail) | mamanjeri@gmail.com — Mary Njeri | cashier@mamanjeri.co.ke (CASHIER) |
| `safari-bites` | Safari Bites Restaurant | admin@safaribites.co.ke — Chef Samuel Odera | cashier@safaribites.co.ke (CASHIER), kitchen@safaribites.co.ke (KITCHEN) |
| `afya-pharmacy` | Afya Pharmacy | admin@afyapharmacy.co.ke — Dr. Alice Chebet | cashier@afyapharmacy.co.ke (CASHIER), stock@afyapharmacy.co.ke (STOCK_KEEPER) |
| `jengo-hardware` | Jengo Hardware | admin@jengohardware.co.ke — Patrick Muthomi | cashier@jengohardware.co.ke (CASHIER), stock@jengohardware.co.ke (STOCK_KEEPER) |
| `sharp-cuts` | Sharp Cuts Barbershop | admin@sharpcuts.co.ke — Brian Omondi | tony@, dennis@, eric@sharpcuts.co.ke (CASHIER) |

The platform super-admin tenant (`platform`) is intentionally not in this
list; see the runbook for that account.

## Where the seeded back-office data is

Only `club-chairman` carries a populated HR/payroll/asset history — it is the
tenant to open when demoing the ERP:

- **HR**: 6 employees (one on probation, one terminated), 3 leave requests
  (pending / approved / rejected), 1 staff loan repaid through payroll
  deductions.
- **Payroll**: 2 runs (one approved, one paid), 12 payslips, PAYE/NSSF/SHIF/
  housing-levy figures that reconcile to the payslip totals.
- **Assets**: 7 assets (AST-0001 … AST-0007), one disposed (AST-0007), one
  `under_maintenance` (AST-0004), monthly depreciation entries per asset, and 3
  maintenance records.

The other eight tenants are seeded for POS/inventory/CRM demos.

## Resetting the demo

```bash
npm run db:seed
```

This truncates and re-creates every demo tenant, its users, the sample
transactions and the back-office data above, and re-applies the Enterprise
tier, module/feature rows and `demoMode`. It takes roughly 30 minutes on the
hosted demo database.
