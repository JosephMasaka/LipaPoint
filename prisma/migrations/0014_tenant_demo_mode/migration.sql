-- Demo tenants: staff role no longer narrows the sidebar or the
-- owner/admin-only API guards, so any seeded login can demo every module.
-- Real customers keep demoMode = false and their role rules unchanged.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "demoMode" BOOLEAN NOT NULL DEFAULT false;
