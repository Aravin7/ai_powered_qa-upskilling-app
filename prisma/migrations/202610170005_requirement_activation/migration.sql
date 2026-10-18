CREATE TABLE "RequirementActivation" (
  "id" TEXT PRIMARY KEY,
  "version" TEXT NOT NULL REFERENCES "RequirementSnapshot"("version") ON DELETE RESTRICT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequirementActivation_id_check" CHECK ("id" = 'active')
);
