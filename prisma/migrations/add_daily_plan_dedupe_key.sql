ALTER TABLE "DailyPlan"
ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "DailyPlan_dedupeKey_key"
ON "DailyPlan" ("dedupeKey");
