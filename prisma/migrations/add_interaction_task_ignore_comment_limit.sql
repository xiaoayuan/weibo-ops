ALTER TABLE "InteractionTask"
ADD COLUMN IF NOT EXISTS "ignoreCommentCountLimit" BOOLEAN NOT NULL DEFAULT false;
