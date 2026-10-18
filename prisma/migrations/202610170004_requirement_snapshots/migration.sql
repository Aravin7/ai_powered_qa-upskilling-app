CREATE TABLE "RequirementSnapshot" (
  "version" TEXT PRIMARY KEY,
  "contentDigest" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "reviewEvidenceReference" TEXT NOT NULL,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequirementSnapshot_digest_check" CHECK ("contentDigest" ~ '^[a-f0-9]{64}$')
);
CREATE TABLE "CapabilityConfirmation" (
  "skillId" TEXT PRIMARY KEY REFERENCES "ConfirmedSkill"("id") ON DELETE CASCADE,
  "snapshotVersion" TEXT NOT NULL REFERENCES "RequirementSnapshot"("version") ON DELETE RESTRICT,
  "capabilityId" TEXT NOT NULL,
  "meaningVersion" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION reject_requirement_snapshot_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Requirement snapshots are immutable; register a new version';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER requirement_snapshot_immutable
  BEFORE UPDATE OR DELETE ON "RequirementSnapshot"
  FOR EACH ROW EXECUTE FUNCTION reject_requirement_snapshot_mutation();
CREATE TRIGGER requirement_snapshot_no_truncate
  BEFORE TRUNCATE ON "RequirementSnapshot"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_requirement_snapshot_mutation();
