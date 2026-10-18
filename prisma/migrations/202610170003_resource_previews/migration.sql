ALTER TABLE "PathwayExploration" ADD COLUMN "resourcePreviews" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "AIOperation" DROP CONSTRAINT "AIOperation_kind_check";
ALTER TABLE "AIOperation" ADD CONSTRAINT "AIOperation_kind_check"
  CHECK (kind IN ('cv_extraction', 'roadmap_generation', 'pathway_suggestions', 'resource_research'));
