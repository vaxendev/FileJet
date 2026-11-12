CREATE TABLE "team_messages" (
    "id" BIGSERIAL NOT NULL,
    "team_id" UUID NOT NULL,
    "author_id" UUID,
    "request_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_messages_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "team_messages_team_id_request_id_key" ON "team_messages"("team_id", "request_id");
CREATE INDEX "team_messages_team_id_id_idx" ON "team_messages"("team_id", "id");
CREATE INDEX "team_messages_author_id_idx" ON "team_messages"("author_id");
