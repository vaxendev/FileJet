CREATE TABLE "team_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "TeamRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "team_invitations_team_id_user_id_key" ON "team_invitations"("team_id", "user_id");
CREATE INDEX "team_invitations_user_id_created_at_idx" ON "team_invitations"("user_id", "created_at");
