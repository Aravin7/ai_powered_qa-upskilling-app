-- Keep historical budgets and reservations; do not rewrite applied migrations.
ALTER TABLE "FundingBudget" DROP CONSTRAINT "FundingBudget_mode_check";
ALTER TABLE "FundingBudget" ADD CONSTRAINT "FundingBudget_mode_check" CHECK (mode IN ('mock','paid','gemini','groq'));
ALTER TABLE "FundingBudget" ADD CONSTRAINT "FundingBudget_groq_configuration_check" CHECK (mode <> 'groq' OR (currency = 'REQUESTS' AND configuration IS NOT NULL));
