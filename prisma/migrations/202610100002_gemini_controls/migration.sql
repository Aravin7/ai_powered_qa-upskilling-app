ALTER TABLE "FundingBudget" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FundingBudget" ADD COLUMN "configuration" JSONB;
ALTER TABLE "FundingBudget" DROP CONSTRAINT "FundingBudget_mode_check";
ALTER TABLE "FundingBudget" ADD CONSTRAINT "FundingBudget_mode_check" CHECK (mode IN ('mock','paid','gemini'));
ALTER TABLE "FundingBudget" ADD CONSTRAINT "FundingBudget_gemini_configuration_check" CHECK (mode <> 'gemini' OR (currency = 'USD_MICRO' AND configuration IS NOT NULL));
ALTER TABLE "AIOperation" ADD COLUMN "configurationVersion" TEXT NOT NULL DEFAULT 'mock-v1';
ALTER TABLE "AIOperation" ADD COLUMN "budgetId" TEXT;
