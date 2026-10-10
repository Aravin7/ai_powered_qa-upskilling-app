ALTER TABLE "Roadmap" ADD COLUMN "deferredSkillIds" TEXT[] NOT NULL DEFAULT '{}',
 ADD COLUMN "planningSnapshot" JSONB, ADD COLUMN "modelVersion" TEXT NOT NULL DEFAULT 'legacy-synthetic',
 ADD COLUMN "promptVersion" TEXT NOT NULL DEFAULT 'legacy-synthetic';
CREATE TABLE "CatalogueRevision" (id TEXT PRIMARY KEY, version TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0));
CREATE TABLE "AIOperation" (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 kind TEXT NOT NULL CHECK (kind IN ('cv_extraction','roadmap_generation')), key TEXT NOT NULL,
 fingerprint TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'running' CHECK (state IN ('running','succeeded','failed','expired','cancelled','infeasible')),
 code TEXT NOT NULL DEFAULT 'RUNNING', fence TEXT NOT NULL, "sessionVersion" INTEGER NOT NULL,
 "consentSequence" INTEGER NOT NULL, "inputRevision" INTEGER NOT NULL, "catalogueRevision" INTEGER NOT NULL,
 "catalogueVersion" TEXT NOT NULL, deadline TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 2), "roadmapId" TEXT,
 UNIQUE ("userId",kind,key)
);
CREATE UNIQUE INDEX "one_running_operation_per_user" ON "AIOperation"("userId") WHERE state='running';
CREATE TABLE "FundingBudget" (
 id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK (mode IN ('mock','paid')), currency TEXT NOT NULL,
 "pricingVersion" TEXT NOT NULL, ceiling INTEGER NOT NULL CHECK (ceiling >= 0),
 reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= ceiling), "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AIAttempt" (
 id TEXT PRIMARY KEY, "operationId" TEXT NOT NULL REFERENCES "AIOperation"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "budgetId" TEXT NOT NULL REFERENCES "FundingBudget"(id) ON UPDATE CASCADE,
 "reservedUnits" INTEGER NOT NULL CHECK ("reservedUnits" > 0)
);
CREATE INDEX "AIAttempt_reservedAt_idx" ON "AIAttempt"("reservedAt");
