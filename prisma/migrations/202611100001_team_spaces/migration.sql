CREATE TYPE "TeamRole" AS ENUM ('VIEWER', 'UPLOADER', 'EDITOR');
CREATE TABLE "team_spaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "owner_id" UUID NOT NULL,
    "root_folder_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_spaces_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_spaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_spaces_root_folder_id_fkey" FOREIGN KEY ("root_folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_spaces_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 120)
);
CREATE UNIQUE INDEX "team_spaces_root_folder_id_key" ON "team_spaces"("root_folder_id");
CREATE INDEX "team_spaces_owner_id_created_at_idx" ON "team_spaces"("owner_id", "created_at");
CREATE TABLE "team_members" (
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id", "user_id"),
    CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "team_members_user_id_team_id_idx" ON "team_members"("user_id", "team_id");
