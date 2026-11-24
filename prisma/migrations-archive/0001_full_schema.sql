
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='SubscriptionTier') THEN CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER','PROFESSIONAL','ENTERPRISE'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='TenantType') THEN CREATE TYPE "TenantType" AS ENUM  ('PLATFORM', 'RETAIL', 'RESTAURANT', 'BAR', 'SUPERMARKET', 'PHARMACY', 'HARDWARE', 'BARBERSHOP'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='OrderStatus') THEN CREATE TYPE "OrderStatus" AS ENUM  ('PENDING', 'PREPARING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'TAB'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='PaymentMethod') THEN CREATE TYPE "PaymentMethod" AS ENUM  ('CASH', 'MPESA_MANUAL', 'MPESA_STK', 'CARD', 'PDQ', 'PAYSTACK'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='PaymentProvider') THEN CREATE TYPE "PaymentProvider" AS ENUM  ('DARAJA', 'INTASEND', 'PESAPAL', 'KOPOKOPO', 'FLUTTERWAVE', 'PALPLUSS'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='PaymentStatus') THEN CREATE TYPE "PaymentStatus" AS ENUM  ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='UserRole') THEN CREATE TYPE "UserRole" AS ENUM  ('SUPER_ADMIN', 'RESELLER', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'STOCK_KEEPER', 'KITCHEN'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='CouponType') THEN CREATE TYPE "CouponType" AS ENUM  ('PERCENT', 'FIXED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='DemoRequestStatus') THEN CREATE TYPE "DemoRequestStatus" AS ENUM  ('PENDING', 'CONTACTED', 'CONVERTED', 'DECLINED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='StockMovementType') THEN CREATE TYPE "StockMovementType" AS ENUM  ('GOODS_RECEIPT', 'GOODS_ISSUE', 'TRANSFER', 'ADJUSTMENT', 'SALE_RETURN', 'OPENING_BALANCE'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='TableStatus') THEN CREATE TYPE "TableStatus" AS ENUM  ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='AppointmentStatus') THEN CREATE TYPE "AppointmentStatus" AS ENUM  ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='QueueStatus') THEN CREATE TYPE "QueueStatus" AS ENUM  ('WAITING', 'SERVING', 'COMPLETED', 'CANCELLED'); END IF; END $$;

-- CreateEnum
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='KitchenItemStatus') THEN CREATE TYPE "KitchenItemStatus" AS ENUM  ('PENDING', 'PREPARING', 'READY', 'SERVED'); END IF; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PendingSignup" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" "TenantType" NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "couponCode" TEXT,
    "resellerCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "transactionId" TEXT,
    "completionToken" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "TenantType" NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'STARTER',
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "logo" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'KE',
    "county" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 16.0,
    "receiptHeader" TEXT,
    "receiptFooter" TEXT DEFAULT 'Thank you for shopping with us!',
    "showServedBy" BOOLEAN NOT NULL DEFAULT true,
    "paystackSubCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mpesaAccountName" TEXT,
    "mpesaPaybill" TEXT,
    "mpesaTill" TEXT,
    "priceOverrideEnabled" BOOLEAN NOT NULL DEFAULT false,
    "priceFloorMode" TEXT NOT NULL DEFAULT 'PERCENT',
    "priceFloorValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "resellerId" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CASHIER',
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "resellerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Reseller" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reseller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "type" "CouponType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Register" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "Register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "parentId" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UnitConversion" (
    "id" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "description" TEXT,
    "image" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "lowStockAlert" INTEGER NOT NULL DEFAULT 10,
    "baseUnitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductUoM" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "conversionFactor" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "barcode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductUoM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Stock" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "tabName" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentRef" TEXT,
    "notes" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "registerId" TEXT,
    "userId" TEXT NOT NULL,
    "tableId" TEXT,
    "customerId" TEXT,
    "deliveryAddress" TEXT,
    "deliveryPhone" TEXT,
    "deliveryFee" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "baseQuantity" INTEGER NOT NULL,
    "note" TEXT,
    "kitchenStatus" "KitchenItemStatus" NOT NULL DEFAULT 'PENDING',
    "productId" TEXT NOT NULL,
    "productUomId" TEXT,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantPaymentGateway" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyEnc" TEXT,
    "apiSecretEnc" TEXT,
    "merchantRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "credentialsEnc" TEXT,

    CONSTRAINT "TenantPaymentGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Transaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "gatewayRef" TEXT,
    "gatewayStatus" TEXT,
    "mpesaPhone" TEXT,
    "cardLast4" TEXT,
    "description" TEXT,
    "couponCode" TEXT,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enteredManually" BOOLEAN NOT NULL DEFAULT false,
    "provider" "PaymentProvider",

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "before" JSONB,
    "after" JSONB,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReportDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "parameters" TEXT NOT NULL,
    "columns" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReportRun" (
    "id" TEXT NOT NULL,
    "definitionKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedBy" TEXT,
    "parameters" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "rowCount" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantModule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "planTier" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tier',
    "enabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChartOfAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceId" TEXT,
    "description" TEXT,
    "postedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BankAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "accountNumber" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coaAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BankTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "direction" TEXT NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "matchedJournalLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kraPin" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "paymentTerms" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "locationId" TEXT,
    "expectedDate" TIMESTAMP(3),
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GoodsReceivedNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT,
    "receivedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceivedNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GoodsReceivedNoteItem" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "poItemId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GoodsReceivedNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "etimsValidated" BOOLEAN NOT NULL DEFAULT false,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplierPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "bankAccountId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "journalEntryId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreditNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "journalEntryId" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DebitNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "debitNoteNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "journalEntryId" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EtimsInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kraInvoiceNumber" TEXT,
    "qrCodeUrl" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "submittedAt" TIMESTAMP(3),
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtimsInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Employee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "staffNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "kraPin" TEXT,
    "nssfNumber" TEXT,
    "shaNumber" TEXT,
    "bankAccount" TEXT,
    "mpesaNumber" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'permanent',
    "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "annualLeaveDays" INTEGER NOT NULL DEFAULT 21,
    "startDate" DATE NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeaveRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'annual',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmployeeLoan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "principal" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "monthlyDeduction" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" DATE NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PayrollRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "bankAccountId" TEXT,
    "journalEntryId" TEXT,
    "notes" TEXT,
    "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEmployerCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payslip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossPay" DOUBLE PRECISION NOT NULL,
    "nssfEmployee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nssfEmployer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shif" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "housingLevyEmployee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "housingLevyEmployer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxablePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "personalRelief" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payePayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPay" DOUBLE PRECISION NOT NULL,
    "nitaLevy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rateTableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StatutoryRateTable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "label" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "payeBands" JSONB NOT NULL,
    "personalRelief" DOUBLE PRECISION NOT NULL DEFAULT 2400,
    "nssfRateEmployee" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "nssfRateEmployer" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "nssfTier1Cap" DOUBLE PRECISION NOT NULL DEFAULT 8000,
    "nssfTier2Cap" DOUBLE PRECISION NOT NULL DEFAULT 108000,
    "shifRate" DOUBLE PRECISION NOT NULL DEFAULT 2.75,
    "shifMinimum" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "housingLevyRate" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "nitaLevyPerEmployee" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatutoryRateTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Asset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "supplierId" TEXT,
    "assignedTo" TEXT,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'equipment',
    "description" TEXT,
    "purchaseCost" DOUBLE PRECISION NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'straight_line',
    "usefulLifeMonths" INTEGER NOT NULL DEFAULT 60,
    "residualValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accumulatedDepreciation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'in_service',
    "disposedAt" TIMESTAMP(3),
    "disposalProceeds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssetDepreciationEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "bookValueAfter" DOUBLE PRECISION NOT NULL,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDepreciationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StockRecord" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "openingStock" INTEGER NOT NULL,
    "addedStock" INTEGER NOT NULL DEFAULT 0,
    "soldStock" INTEGER NOT NULL DEFAULT 0,
    "closingStock" INTEGER NOT NULL,
    "adjustment" INTEGER NOT NULL DEFAULT 0,
    "variance" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "receiptNo" TEXT,
    "supplier" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PasswordReset" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RolePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT[],
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DailySummary" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cashBroughtForward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "debtsPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mpesaReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchases" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unpaidBills" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashSurrendered" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shortExcess" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashCarriedForward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DemoRequest" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "businessType" "TenantType" NOT NULL,
    "message" TEXT,
    "status" "DemoRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "paystackPlanCode" TEXT,
    "paystackSubCode" TEXT,
    "paystackCustCode" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "lastVisit" TIMESTAMP(3),
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Discount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "minOrder" DOUBLE PRECISION,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Table" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "locationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedTime" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Appointment" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QueueEntry" (
    "id" TEXT NOT NULL,
    "ticketNo" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "serviceName" TEXT,
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "staffId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "servedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StaffSchedule" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isOff" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "staffId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PendingSignup_completionToken_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "PendingSignup_completionToken_key" ON "PendingSignup_completionToken_key"(completionToken); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PendingSignup_email_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "PendingSignup_email_idx" ON "PendingSignup_email"("email"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PendingSignup_transactionId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "PendingSignup_transactionId_idx" ON "PendingSignup_transactionId"("transactionId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Tenant_slug_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant_slug_key"(slug); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Tenant_slug_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Tenant_slug_idx" ON "Tenant_slug"("slug"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Tenant_isActive_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Tenant_isActive_idx" ON "Tenant_isActive"("isActive"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='User_email_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "User_email_key" ON "User_email_key"(email); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='User_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "User_tenantId_idx" ON "User_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='User_email_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "User_email_idx" ON "User_email"("email"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Session_token_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Session_token_key" ON "Session_token_key"(token); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Session_token_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Session_token_idx" ON "Session_token"("token"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Session_userId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Session_userId_idx" ON "Session_userId"("userId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Session_resellerId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Session_resellerId_idx" ON "Session_resellerId"("resellerId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Reseller_email_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Reseller_email_key" ON "Reseller_email_key"(email); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Reseller_code_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Reseller_code_key" ON "Reseller_code_key"(code); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Reseller_code_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Reseller_code_idx" ON "Reseller_code"("code"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Coupon_code_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon_code_key"(code); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Coupon_isActive_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Coupon_isActive_idx" ON "Coupon_isActive"("isActive"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='CouponRedemption_couponId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption_couponId"("couponId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='CouponRedemption_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "CouponRedemption_tenantId_idx" ON "CouponRedemption_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Location_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Location_tenantId_idx" ON "Location_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Register_locationId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Register_locationId_idx" ON "Register_locationId"("locationId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Category_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Category_tenantId_idx" ON "Category_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Category_parentId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Category_parentId_idx" ON "Category_parentId"("parentId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Category_tenantId_name_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "Category_tenantId_name"("tenantId", "name"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='UnitOfMeasure_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "UnitOfMeasure_tenantId_idx" ON "UnitOfMeasure_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='UnitOfMeasure_tenantId_name_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "UnitOfMeasure_tenantId_name_key" ON "UnitOfMeasure_tenantId_name"("tenantId", "name"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='UnitConversion_fromUnitId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "UnitConversion_fromUnitId_idx" ON "UnitConversion_fromUnitId"("fromUnitId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='UnitConversion_toUnitId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "UnitConversion_toUnitId_idx" ON "UnitConversion_toUnitId"("toUnitId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='UnitConversion_fromUnitId_toUnitId_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "UnitConversion_fromUnitId_toUnitId_key" ON "UnitConversion_fromUnitId_toUnitId"("fromUnitId", "toUnitId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Product_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Product_tenantId_idx" ON "Product_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Product_categoryId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Product_categoryId_idx" ON "Product_categoryId"("categoryId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Product_barcode_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Product_barcode_idx" ON "Product_barcode"("barcode"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Product_baseUnitId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Product_baseUnitId_idx" ON "Product_baseUnitId"("baseUnitId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Product_tenantId_sku_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product_tenantId_sku"("tenantId", "sku"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ProductUoM_productId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ProductUoM_productId_idx" ON "ProductUoM_productId"("productId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ProductUoM_unitId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ProductUoM_unitId_idx" ON "ProductUoM_unitId"("unitId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ProductUoM_barcode_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ProductUoM_barcode_idx" ON "ProductUoM_barcode"("barcode"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ProductUoM_productId_unitId_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "ProductUoM_productId_unitId_key" ON "ProductUoM_productId_unitId"("productId", "unitId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Stock_productId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Stock_productId_idx" ON "Stock_productId"("productId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Stock_locationId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Stock_locationId_idx" ON "Stock_locationId"("locationId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Stock_productId_locationId_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Stock_productId_locationId_key" ON "Stock_productId_locationId"("productId", "locationId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StockMovement_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StockMovement_tenantId_idx" ON "StockMovement_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StockMovement_productId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StockMovement_productId_idx" ON "StockMovement_productId"("productId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StockMovement_locationId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StockMovement_locationId_idx" ON "StockMovement_locationId"("locationId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StockMovement_createdAt_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement_createdAt"("createdAt"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StockMovement_type_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StockMovement_type_idx" ON "StockMovement_type"("type"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Order_orderNo_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order_orderNo_key"(orderNo); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Order_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Order_tenantId_idx" ON "Order_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Order_locationId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Order_locationId_idx" ON "Order_locationId"("locationId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Order_userId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Order_userId_idx" ON "Order_userId"("userId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Order_createdAt_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Order_createdAt_idx" ON "Order_createdAt"("createdAt"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Order_orderNo_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Order_orderNo_idx" ON "Order_orderNo"("orderNo"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Order_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Order_status_idx" ON "Order_status"("status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Order_tableId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Order_tableId_idx" ON "Order_tableId"("tableId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='OrderItem_orderId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem_orderId"("orderId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='OrderItem_productId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "OrderItem_productId_idx" ON "OrderItem_productId"("productId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='OrderItem_productUomId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "OrderItem_productUomId_idx" ON "OrderItem_productUomId"("productUomId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='TenantPaymentGateway_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "TenantPaymentGateway_tenantId_idx" ON "TenantPaymentGateway_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='TenantPaymentGateway_tenantId_provider_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "TenantPaymentGateway_tenantId_provider_key" ON "TenantPaymentGateway_tenantId_provider"("tenantId", "provider"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Transaction_reference_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction_reference_key"(reference); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Transaction_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Transaction_tenantId_idx" ON "Transaction_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Transaction_reference_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Transaction_reference_idx" ON "Transaction_reference"("reference"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Transaction_orderId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Transaction_orderId_idx" ON "Transaction_orderId"("orderId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Transaction_createdAt_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Transaction_createdAt_idx" ON "Transaction_createdAt"("createdAt"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Transaction_method_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Transaction_method_idx" ON "Transaction_method"("method"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ActivityLog_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ActivityLog_tenantId_idx" ON "ActivityLog_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ActivityLog_createdAt_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog_createdAt"("createdAt"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ReportDefinition_module_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ReportDefinition_module_idx" ON "ReportDefinition_module"("module"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ReportDefinition_category_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ReportDefinition_category_idx" ON "ReportDefinition_category"("category"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ReportDefinition_key_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "ReportDefinition_key_key" ON "ReportDefinition_key_key"(key); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ReportRun_tenantId_definitionKey_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ReportRun_tenantId_definitionKey_idx" ON "ReportRun_tenantId_definitionKey"("tenantId", "definitionKey"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ReportRun_tenantId_startedAt_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ReportRun_tenantId_startedAt_idx" ON "ReportRun_tenantId_startedAt"("tenantId", "startedAt"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='TenantModule_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "TenantModule_tenantId_idx" ON "TenantModule_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='TenantModule_tenantId_moduleKey_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "TenantModule_tenantId_moduleKey_key" ON "TenantModule_tenantId_moduleKey"("tenantId", "moduleKey"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ChartOfAccount_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ChartOfAccount_tenantId_idx" ON "ChartOfAccount_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ChartOfAccount_type_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "ChartOfAccount_type_idx" ON "ChartOfAccount_type"("type"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='ChartOfAccount_tenantId_code_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "ChartOfAccount_tenantId_code_key" ON "ChartOfAccount_tenantId_code"("tenantId", "code"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='JournalEntry_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "JournalEntry_tenantId_idx" ON "JournalEntry_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='JournalEntry_tenantId_date_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "JournalEntry_tenantId_date_idx" ON "JournalEntry_tenantId_date"("tenantId", "date"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='JournalEntry_sourceModule_sourceId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "JournalEntry_sourceModule_sourceId_idx" ON "JournalEntry_sourceModule_sourceId"("sourceModule", "sourceId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='JournalLine_journalEntryId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine_journalEntryId"("journalEntryId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='JournalLine_accountId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine_accountId"("accountId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='BankAccount_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "BankAccount_tenantId_idx" ON "BankAccount_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='BankTransaction_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "BankTransaction_tenantId_idx" ON "BankTransaction_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='BankTransaction_bankAccountId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "BankTransaction_bankAccountId_idx" ON "BankTransaction_bankAccountId"("bankAccountId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='BankTransaction_reconciled_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "BankTransaction_reconciled_idx" ON "BankTransaction_reconciled"("reconciled"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Supplier_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Supplier_tenantId_idx" ON "Supplier_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Supplier_name_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Supplier_name_idx" ON "Supplier_name"("name"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PurchaseOrder_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PurchaseOrder_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder_status"("status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PurchaseOrder_tenantId_poNumber_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "PurchaseOrder_tenantId_poNumber_key" ON "PurchaseOrder_tenantId_poNumber"("tenantId", "poNumber"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PurchaseOrderItem_purchaseOrderId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem_purchaseOrderId"("purchaseOrderId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='GoodsReceivedNote_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "GoodsReceivedNote_tenantId_idx" ON "GoodsReceivedNote_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='GoodsReceivedNote_tenantId_grnNumber_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "GoodsReceivedNote_tenantId_grnNumber_key" ON "GoodsReceivedNote_tenantId_grnNumber"("tenantId", "grnNumber"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='GoodsReceivedNoteItem_grnId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "GoodsReceivedNoteItem_grnId_idx" ON "GoodsReceivedNoteItem_grnId"("grnId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='SupplierInvoice_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "SupplierInvoice_tenantId_idx" ON "SupplierInvoice_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='SupplierInvoice_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "SupplierInvoice_status_idx" ON "SupplierInvoice_status"("status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='SupplierInvoice_tenantId_invoiceNumber_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "SupplierInvoice_tenantId_invoiceNumber_key" ON "SupplierInvoice_tenantId_invoiceNumber"("tenantId", "invoiceNumber"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='SupplierPayment_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "SupplierPayment_tenantId_idx" ON "SupplierPayment_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='SupplierPayment_supplierId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment_supplierId"("supplierId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='SupplierPayment_invoiceId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "SupplierPayment_invoiceId_idx" ON "SupplierPayment_invoiceId"("invoiceId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='CreditNote_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "CreditNote_tenantId_idx" ON "CreditNote_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='CreditNote_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "CreditNote_status_idx" ON "CreditNote_status"("status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='CreditNote_tenantId_creditNoteNumber_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "CreditNote_tenantId_creditNoteNumber_key" ON "CreditNote_tenantId_creditNoteNumber"("tenantId", "creditNoteNumber"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='DebitNote_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "DebitNote_tenantId_idx" ON "DebitNote_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='DebitNote_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "DebitNote_status_idx" ON "DebitNote_status"("status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='DebitNote_tenantId_debitNoteNumber_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "DebitNote_tenantId_debitNoteNumber_key" ON "DebitNote_tenantId_debitNoteNumber"("tenantId", "debitNoteNumber"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='EtimsInvoice_tenantId_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "EtimsInvoice_tenantId_status_idx" ON "EtimsInvoice_tenantId_status"("tenantId", "status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='EtimsInvoice_tenantId_createdAt_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "EtimsInvoice_tenantId_createdAt_idx" ON "EtimsInvoice_tenantId_createdAt"("tenantId", "createdAt"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='EtimsInvoice_tenantId_sourceType_sourceId_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "EtimsInvoice_tenantId_sourceType_sourceId_key" ON "missing_table"(id); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Employee_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Employee_tenantId_idx" ON "Employee_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Employee_tenantId_active_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Employee_tenantId_active_idx" ON "Employee_tenantId_active"("tenantId", "active"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Employee_tenantId_staffNumber_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Employee_tenantId_staffNumber_key" ON "Employee_tenantId_staffNumber"("tenantId", "staffNumber"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='LeaveRequest_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "LeaveRequest_tenantId_idx" ON "LeaveRequest_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='LeaveRequest_tenantId_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "LeaveRequest_tenantId_status_idx" ON "LeaveRequest_tenantId_status"("tenantId", "status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='LeaveRequest_employeeId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest_employeeId"("employeeId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='EmployeeLoan_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "EmployeeLoan_tenantId_idx" ON "EmployeeLoan_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='EmployeeLoan_tenantId_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "EmployeeLoan_tenantId_status_idx" ON "EmployeeLoan_tenantId_status"("tenantId", "status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='EmployeeLoan_employeeId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "EmployeeLoan_employeeId_idx" ON "EmployeeLoan_employeeId"("employeeId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PayrollRun_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "PayrollRun_tenantId_idx" ON "PayrollRun_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PayrollRun_tenantId_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "PayrollRun_tenantId_status_idx" ON "PayrollRun_tenantId_status"("tenantId", "status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PayrollRun_tenantId_period_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "PayrollRun_tenantId_period_key" ON "PayrollRun_tenantId_period"("tenantId", "period"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Payslip_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Payslip_tenantId_idx" ON "Payslip_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Payslip_payrollRunId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Payslip_payrollRunId_idx" ON "Payslip_payrollRunId"("payrollRunId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Payslip_payrollRunId_employeeId_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Payslip_payrollRunId_employeeId_key" ON "Payslip_payrollRunId_employeeId"("payrollRunId", "employeeId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StatutoryRateTable_tenantId_effectiveFrom_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StatutoryRateTable_tenantId_effectiveFrom_idx" ON "StatutoryRateTable_tenantId_effectiveFrom"("tenantId", "effectiveFrom"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StatutoryRateTable_effectiveFrom_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StatutoryRateTable_effectiveFrom_idx" ON "StatutoryRateTable_effectiveFrom"("effectiveFrom"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Asset_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Asset_tenantId_idx" ON "Asset_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Asset_tenantId_lifecycleStatus_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Asset_tenantId_lifecycleStatus_idx" ON "Asset_tenantId_lifecycleStatus"("tenantId", "lifecycleStatus"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Asset_tenantId_assetCode_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Asset_tenantId_assetCode_key" ON "Asset_tenantId_assetCode"("tenantId", "assetCode"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='AssetDepreciationEntry_tenantId_period_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "AssetDepreciationEntry_tenantId_period_idx" ON "AssetDepreciationEntry_tenantId_period"("tenantId", "period"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='AssetDepreciationEntry_assetId_period_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "AssetDepreciationEntry_assetId_period_key" ON "AssetDepreciationEntry_assetId_period"("assetId", "period"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StockRecord_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StockRecord_tenantId_idx" ON "StockRecord_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StockRecord_date_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StockRecord_date_idx" ON "StockRecord_date"("date"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StockRecord_productId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StockRecord_productId_idx" ON "StockRecord_productId"("productId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StockRecord_locationId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StockRecord_locationId_idx" ON "StockRecord_locationId"("locationId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StockRecord_productId_locationId_date_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StockRecord_productId_locationId_date_key" ON "missing_table"(id); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Expense_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Expense_tenantId_idx" ON "Expense_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Expense_date_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Expense_date_idx" ON "Expense_date"("date"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Expense_category_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Expense_category_idx" ON "Expense_category"("category"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Expense_locationId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Expense_locationId_idx" ON "Expense_locationId"("locationId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PasswordReset_token_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset_token_key"(token); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PasswordReset_token_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "PasswordReset_token_idx" ON "PasswordReset_token"("token"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='PasswordReset_userId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset_userId"("userId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='RolePermission_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "RolePermission_tenantId_idx" ON "RolePermission_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='RolePermission_tenantId_role_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "RolePermission_tenantId_role_key" ON "RolePermission_tenantId_role"("tenantId", "role"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='DailySummary_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "DailySummary_tenantId_idx" ON "DailySummary_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='DailySummary_date_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "DailySummary_date_idx" ON "DailySummary_date"("date"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='DailySummary_locationId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "DailySummary_locationId_idx" ON "DailySummary_locationId"("locationId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='DailySummary_tenantId_locationId_date_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "DailySummary_tenantId_locationId_date_key" ON "missing_table"(id); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='DemoRequest_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "DemoRequest_status_idx" ON "DemoRequest_status"("status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Subscription_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Subscription_tenantId_idx" ON "Subscription_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Customer_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Customer_tenantId_idx" ON "Customer_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Customer_tenantId_phone_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Customer_tenantId_phone_key" ON "Customer_tenantId_phone"("tenantId", "phone"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Discount_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Discount_tenantId_idx" ON "Discount_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Discount_tenantId_code_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Discount_tenantId_code_key" ON "Discount_tenantId_code"("tenantId", "code"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Table_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Table_tenantId_idx" ON "Table_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Table_locationId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Table_locationId_idx" ON "Table_locationId"("locationId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Table_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Table_status_idx" ON "Table_status"("status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Table_tenantId_name_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "Table_tenantId_name_key" ON "Table_tenantId_name"("tenantId", "name"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='DeliveryZone_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "DeliveryZone_tenantId_idx" ON "DeliveryZone_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='DeliveryZone_tenantId_name_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "DeliveryZone_tenantId_name_key" ON "DeliveryZone_tenantId_name"("tenantId", "name"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Service_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Service_tenantId_idx" ON "Service_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Service_categoryId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Service_categoryId_idx" ON "Service_categoryId"("categoryId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Appointment_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Appointment_tenantId_idx" ON "Appointment_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Appointment_date_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Appointment_date_idx" ON "Appointment_date"("date"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Appointment_staffId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Appointment_staffId_idx" ON "Appointment_staffId"("staffId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='Appointment_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "Appointment_status_idx" ON "Appointment_status"("status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='QueueEntry_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "QueueEntry_tenantId_idx" ON "QueueEntry_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='QueueEntry_status_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "QueueEntry_status_idx" ON "QueueEntry_status"("status"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='QueueEntry_createdAt_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "QueueEntry_createdAt_idx" ON "QueueEntry_createdAt"("createdAt"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StaffSchedule_tenantId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StaffSchedule_tenantId_idx" ON "StaffSchedule_tenantId"("tenantId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StaffSchedule_date_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StaffSchedule_date_idx" ON "StaffSchedule_date"("date"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StaffSchedule_staffId_idx' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE INDEX "StaffSchedule_staffId_idx" ON "StaffSchedule_staffId"("staffId"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='StaffSchedule_staffId_date_key' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) THEN CREATE UNIQUE INDEX "StaffSchedule_staffId_date_key" ON "StaffSchedule_staffId_date"("staffId", "date"); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Register" ADD CONSTRAINT "Register_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUoM" ADD CONSTRAINT "ProductUoM_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUoM" ADD CONSTRAINT "ProductUoM_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productUomId_fkey" FOREIGN KEY ("productUomId") REFERENCES "ProductUoM"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPaymentGateway" ADD CONSTRAINT "TenantPaymentGateway_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantModule" ADD CONSTRAINT "TenantModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_postedBy_fkey" FOREIGN KEY ("postedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_coaAccountId_fkey" FOREIGN KEY ("coaAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedJournalLineId_fkey" FOREIGN KEY ("matchedJournalLineId") REFERENCES "JournalLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNoteItem" ADD CONSTRAINT "GoodsReceivedNoteItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceivedNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNoteItem" ADD CONSTRAINT "GoodsReceivedNoteItem_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNoteItem" ADD CONSTRAINT "GoodsReceivedNoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtimsInvoice" ADD CONSTRAINT "EtimsInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_rateTableId_fkey" FOREIGN KEY ("rateTableId") REFERENCES "StatutoryRateTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutoryRateTable" ADD CONSTRAINT "StatutoryRateTable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationEntry" ADD CONSTRAINT "AssetDepreciationEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationEntry" ADD CONSTRAINT "AssetDepreciationEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationEntry" ADD CONSTRAINT "AssetDepreciationEntry_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecord" ADD CONSTRAINT "StockRecord_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecord" ADD CONSTRAINT "StockRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecord" ADD CONSTRAINT "StockRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

