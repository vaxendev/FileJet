BEGIN;

ALTER TABLE "team_messages" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "team_tasks"
    ALTER COLUMN "message_id" DROP NOT NULL,
    ADD COLUMN "request_id" UUID;

CREATE UNIQUE INDEX "team_tasks_team_id_request_id_key" ON "team_tasks"("team_id", "request_id");

-- Account deletion can clear task user references before the team cascade removes the same tasks.
ALTER TABLE "team_tasks" ALTER CONSTRAINT "team_tasks_team_id_fkey" DEFERRABLE INITIALLY DEFERRED;

COMMIT;
