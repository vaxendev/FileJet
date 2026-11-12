ALTER TABLE "team_spaces"
    ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "join_password_hash" TEXT,
    ADD COLUMN "invite_token" VARCHAR(43),
    ADD CONSTRAINT "team_spaces_invite_check" CHECK ("invite_token" IS NULL OR "is_public" OR "join_password_hash" IS NOT NULL),
    ADD CONSTRAINT "team_spaces_public_password_check" CHECK (NOT "is_public" OR "join_password_hash" IS NULL);

CREATE UNIQUE INDEX "team_spaces_invite_token_key" ON "team_spaces"("invite_token");
CREATE INDEX "team_spaces_is_public_created_at_id_idx" ON "team_spaces"("is_public", "created_at", "id");
