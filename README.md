# LipaPoint - Enterprise POS System

Premium, multi-tenant Point of Sale system built for retail stores, restaurants, and bars.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19
- **Styling:** Tailwind CSS v4, Shadcn-style components
- **Database:** Neon Serverless PostgreSQL
- **ORM:** Prisma
- **State:** Zustand
- **Charts:** Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (Neon recommended)

### Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Neon database URL

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed demo data
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Access

Navigate to `/demo/dashboard` for the dashboard or `/demo/pos` for the POS register.

Login credentials (demo):
- Email: `admin@lipapoint.com`
- Password: `demo123`

## Project Structure

```
src/
├── app/
│   ├── [tenant]/          # Multi-tenant routes
│   │   ├── dashboard/     # Analytics & overview
│   │   ├── pos/           # Point of Sale register
│   │   ├── orders/        # Order management
│   │   ├── inventory/     # Product & stock management
│   │   ├── kitchen/       # Kitchen Display System (KDS)
│   │   └── settings/      # Subscription & config
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication
│   │   ├── orders/        # Order CRUD + SSE stream
│   │   └── products/      # Product CRUD
│   └── login/             # Authentication page
├── components/
│   ├── ui/                # Reusable UI primitives
│   ├── pos/               # POS-specific components
│   └── dashboard/         # Dashboard charts & widgets
├── lib/                   # Utilities & database
├── store/                 # Zustand state stores
└── middleware.ts          # Auth & routing middleware
```

## Subscription Tiers

| Feature | Lite ($29/mo) | Pro ($79/mo) | Enterprise ($199/mo) |
|---------|:---:|:---:|:---:|
| Locations | 1 | 5 | Unlimited |
| Users | 3 | Unlimited | Unlimited |
| Analytics | Basic | Advanced | Custom |
| API Access | - | - | Full |
| Support | Email | Priority | Dedicated |

## Key Features

- **Multi-tenant architecture** with row-level data isolation
- **Offline-first POS** with IndexedDB persistence and background sync
- **Real-time updates** via Server-Sent Events
- **Kitchen Display System** for restaurant order management
- **Advanced analytics** with revenue, category, and hourly breakdowns
- **M-Pesa integration** hooks for mobile payments
- **Atomic transactions** to prevent double inventory deductions
