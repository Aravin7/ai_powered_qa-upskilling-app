CREATE TABLE "ReviewedDirection" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "snapshotVersion" TEXT NOT NULL REFERENCES "RequirementSnapshot"("version") ON DELETE RESTRICT,
  "directionId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "deferredCapabilityIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requirementSetId" TEXT NOT NULL
);
