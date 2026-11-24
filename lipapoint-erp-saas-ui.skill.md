---
name: lipapoint-erp-saas-ui
description: >
  Design and build LipaPoint ERP's UI/UX — the rebrand of LipaPoint POS into a
  modular Kenya-focused ERP (POS, Finance, HR/Payroll, Assets, eTIMS) with
  Odoo-style app-by-app billing, no free trial, and coupon-based acquisition.
  Use this skill whenever working on LipaPoint's marketing site, app switcher,
  onboarding/registration, pricing, admin UI, or demo/seed data.
stack: Next.js / Prisma (per existing LipaPoint codebase)
---

# LipaPoint ERP — SaaS UI Skill

## 1. What this skill is for

LipaPoint is repositioning from "a POS system" to **LipaPoint ERP**: a set of
business apps (POS, Asset Management, Finance & HR, eTIMS, and more) that a
Kenyan business can buy **individually or as one unified system** — the same
mental model Odoo uses. Every UI decision below exists to make that modular
story legible at a glance, without losing LipaPoint's existing identity
(black rounded-square icon, gold-gradient "L", KES pricing, M-Pesa-native
workflows).

Read this before touching the marketing site, the app switcher, onboarding,
pricing, or any seed/demo data task.

## 2. Design direction (synthesized, not copied)

Three references were given for inspiration — treat them as a *direction*,
not a template to clone:

- **Ethereal Design** — calm, premium, "invisible" design: generous
  whitespace, restrained motion (one deliberate moment, not hover effects
  everywhere), product screenshots over illustrations, a tone that reads as
  engineered rather than decorated.
- **Hyperactive Design** — energetic structure: confident use of a single
  accent color against a mostly neutral palette, bold short headlines, strong
  grid discipline.
- **Orbix Studio** — enterprise-SaaS credibility: dense, data-rich dashboard
  layouts built for retention and conversion, polished component systems
  that look "investor-ready," B2B trust signals over consumer flash.

The synthesis for LipaPoint: **calm and premium at the marketing layer,
dense and confident inside the product.** A prospective business owner
should land on a quiet, trustworthy page; once logged in, the dashboard can
be information-dense because that's what an ERP user expects and needs.

Apply the house rules from your frontend-design skill on top of this:
one deliberate hero treatment (not the generic big-number-plus-gradient
default), one or two typefaces used deliberately, structural devices
(dividers, numbering, labels) only where the content is actually sequential
or categorical, motion spent in one place, and copy written from the
business owner's vocabulary — "stock," "payroll run," "eTIMS invoice" — not
internal system names.

Avoid the generic SaaS-AI tells explicitly: no warm-cream-and-terracotta or
near-black-and-acid-green palette by default, no identical rounded cards
with one shadow recipe, no tracked-out ALL-CAPS eyebrows, no middle-dot
meta strings, no "→" tacked onto every CTA. LipaPoint already has a visual
anchor (black + gold-gradient L on `icon.svg`) — build outward from that
instead of a stock palette.

## 3. Design tokens

Derive, don't invent from scratch — anchor every token decision to the
existing `icon.svg` (black rounded square, gold-gradient "L") and the
Instagram brand direction (professional, elegant, straightforward, in the
style of @intellimis).

- **Color**: black/near-black as the dominant neutral (matches the icon),
  the existing gold gradient as the single accent — reserved for primary
  actions, the active app in the switcher, and plan/tier highlights, not
  decoration. One warm neutral (off-white or warm grey) for marketing-page
  backgrounds so it doesn't read as a dark-mode app. Each of the five
  modules (POS, Finance, HR, Assets, eTIMS) gets a small tonal variant of
  the same gold family, or a distinct accent, so the app switcher and
  module badges are scannable — not five unrelated colors.
- **Type**: one typeface for display/headline, one (or the same family) for
  body and UI — not the default pairing you'd reach for on any SaaS brief.
  Clear type scale, sentence case throughout (never all-caps labels).
- **Layout**: marketing pages are generous and left-aligned with real
  whitespace; the in-app dashboard is denser — a persistent left-hand app
  switcher (icon-first, Odoo-style) rather than a single flat nav, since
  the switcher *is* the modular-apps story made visible.
- **Components**: build a shared component system (buttons, tables, empty
  states, module badges) once, and reuse it across all five modules so a
  customer running "unified" never feels like they're in five different
  products stitched together.

## 4. Information architecture: Odoo-style modularity

### 4.1 Apps, not features

Model everything as **Apps**: `POS`, `Finance & HR` (can also be split into
`Finance` and `HR/Payroll` if billing needs it), `Asset Management`,
`eTIMS`. Each app:

- Has its own icon, short tagline, and marketing page (`/apps/pos`,
  `/apps/finance-hr`, `/apps/assets`, `/apps/etims`), independently
  linkable and indexable.
- Can be bought alone or combined. The app switcher inside the product only
  shows apps the tenant has purchased; locked apps appear dimmed with an
  "Add this app" affordance rather than being hidden — this is the upsell
  surface and should look like a feature preview, not a paywall interruption.
- Has its own pricing row that's visible on the main pricing page, next to
  a "Unified" bundle column — same pattern as Odoo's per-app vs. all-apps
  pricing table.

### 4.2 Pricing/marketing structure

Shift the primary marketing narrative: homepage hero is **"Run your
business on one platform — or just the pieces you need,"** not a POS-first
pitch. POS remains the most mature, most-demoed app, but it's presented as
the flagship app within the suite, not the whole product.

Pricing page layout:

- Row of app cards (POS / Finance & HR / Assets / eTIMS), each with its own
  price, feature list, and "Choose this app" CTA.
- A visually distinct "All Apps / Unified" column priced as a bundle
  discount off the sum of individual apps — the classic Odoo anchor that
  makes "unified" look like the rational default.
- Retain the existing vertical × tier matrix (Retail/Restaurant/Barbershop
  × Starter/Professional/Enterprise) *inside* the POS app's own pricing,
  since that's already implemented — don't collapse that detail, nest it.
- No "Start free trial" anywhere. Replace that CTA slot with **"Have a
  coupon code?"** / "Get started" that leads into the coupon-gated signup
  flow (below). Do not show trial-length countdowns, "no credit card
  required," or similar free-trial-pattern copy — those are now false
  signals on this product.

## 5. Onboarding & registration (Odoo pattern, no trial)

Mirror Odoo's onboarding shape, not its trial economics:

1. **App selection** — before account creation, the prospect picks which
   app(s) they want (or "All apps"). This becomes the tenant's initial
   module configuration, same as Odoo's "which apps do you want to
   install" step.
2. **Business profile** — name, industry/vertical (reuses the existing
   Retail/Restaurant/Barbershop categories where POS is selected), company
   size, KES as default currency.
3. **Coupon gate** — instead of "start your free trial," the signup step
   requires a coupon code to activate a paid plan at a discount, or
   proceeds to full-price checkout without one. Treat the coupon field as
   a first-class, trusted part of the flow (not a tiny "have a promo
   code?" link buried at checkout) since coupons are replacing trials as
   the primary acquisition lever — design it with the same visual weight
   Odoo gives its trial-activation step.
4. **Payment/till setup** — reuse the existing M-Pesa paybill/till capture
   in settings; surface it during onboarding for the POS app specifically,
   not for tenants who only bought Finance/HR or Assets.
5. **Guided first run** — Odoo-style "apps dashboard" on first login,
   showing only the purchased apps as large launch tiles, each with a
   one-line "get started" task (e.g., "Add your first product," "Run your
   first payroll"), not a wall of empty tables.

Explicitly do **not** build: trial countdown banners, "upgrade before your
trial ends" nags, or any flow that implies time-limited access without a
coupon or payment.

## 6. Demo / seed data

Seed data must prove the "individually or unified" claim, so it needs to
exist as **separate demo tenants**, not one mega-tenant:

| Demo tenant | Apps enabled | Purpose |
|---|---|---|
| `demo-pos-retail` | POS only | Retail vertical, Starter/Pro/Enterprise tiers visible |
| `demo-pos-restaurant` | POS only | Restaurant vertical (existing Duka Kuu–style demo) |
| `demo-pos-barbershop` | POS only | Barbershop vertical |
| `demo-finance-hr` | Finance & HR/Payroll only | No POS, no Assets — proves standalone back-office use (e.g. a services business with staff and no stock) |
| `demo-assets-only` | Asset Management only | No POS, no Finance — proves standalone fixed-asset tracking (e.g. an NGO or office equipment register) |
| `demo-unified` | All apps | One business running POS + Finance/GL + HR/Payroll + Assets + eTIMS together, with data that cross-references (e.g. a POS sale posts to GL, payroll run shows in Finance, an asset purchase shows in both Assets and Finance) |

For every demo tenant, seed:

- At least one full month of realistic transaction history (not just
  empty tables with one sample row) so dashboards, reports, and charts
  render meaningfully on first view.
- KES amounts and Kenyan-context names/products throughout (no Lorem
  Ipsum, no USD).
- `demo-unified` specifically needs data where the cross-module links are
  visible on screen without extra clicks — that tenant is the main proof
  of "unified system" in sales demos and screenshots.
- Each industry-specific POS demo should look visually distinct in its
  catalog/menu data (retail SKUs vs. restaurant menu items vs. barbershop
  services) even though it's the same underlying app.

Keep demo tenants isolated from the production coupon/billing system —
they should be reachable via a public "View a demo" path per app and per
the unified bundle, without going through signup or payment at all.

## 7. Copy & messaging shift (POS → ERP)

- Replace POS-first headlines/CTAs across the marketing site, app store
  listings, and social captions with apps-and-modularity framing. Keep POS
  terminology accurate within its own app page — it's still "a point of
  sale," just no longer the whole pitch.
- Every mention of "LipaPoint" at the top of the funnel (homepage, social
  bio, ad copy) should resolve to "LipaPoint ERP" or "LipaPoint — POS,
  Finance, HR, Assets & eTIMS in one platform," not bare "LipaPoint POS."
- Remove any remaining "free trial" language site-wide (buttons, FAQ,
  footer, social posts) and replace with coupon/get-started language,
  consistent with the existing no-free-trial, no-inflated-stats rule
  already set for LipaPoint's Instagram presence.
- FAQ/pricing copy should proactively answer "Can I buy just one app?" and
  "What do I save by going unified?" since that's the core behavior change
  this rebrand introduces.
