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

Every demo tenant carries a headcount, two payroll runs and a depreciating
asset register, so Payroll, HR and Assets are never an empty table:

| Tenant | Staff | Assets | Payroll runs | Payslips |
|---|---|---|---|---|
| `club-chairman` | 6 | 7 | 2 | 12 |
| `duka-kuu` | 5 | 5 | 2 | 10 |
| `mzinga-bar` | 5 | 5 | 2 | 10 |
| `savanna-lounge` | 5 | 5 | 2 | 10 |
| `safari-bites` | 5 | 5 | 2 | 10 |
| `afya-pharmacy` | 5 | 5 | 2 | 10 |
| `jengo-hardware` | 5 | 5 | 2 | 10 |
| `mama-njeri` | 4 | 5 | 2 | 8 |
| `sharp-cuts` | 4 | 5 | 2 | 8 |

`club-chairman` is the hand-written showcase and the richest one: 3 leave
requests (pending / approved / rejected), a staff loan repaid through payroll
deductions, one disposed asset (AST-0007) and one `under_maintenance`
(AST-0004). The other tenants come from the per-slug plans in
`prisma/seed-erp-samples.ts`: 2 leave requests, one active loan, last month's
run approved and this month left as a draft so the approve → pay → file
lifecycle can still be demonstrated, and one asset mid-maintenance plus (where
it suits the business) one disposal.

To fill in tenants that have no HR data without truncating the demo database:

```bash
npm run db:seed:erp          # add -- --force to rebuild a tenant's ERP rows
```

## One-click demo sign-in

`/demo` lists every `demoMode` workspace and opens it in one click, with no
password. The form posts to `/api/demo/login`, which refuses any tenant whose
`demoMode` is false — the password-less path can never reach a real customer.
It lands on the owner/admin account; for a specific staff role use the
credentials in the table above.

## Resetting the demo

```bash
npm run db:seed
```

This truncates and re-creates every demo tenant, its users, the sample
transactions, the ERP samples (Club Chairman's showcase plus
`prisma/seed-erp-samples.ts` for the rest) and re-applies the Enterprise tier,
module/feature rows and `demoMode`. It takes roughly 30 minutes on the hosted
demo database.
