BEGIN;

CREATE INDEX "team_tasks_assignee_id_completed_at_due_on_id_idx"
    ON "team_tasks"("assignee_id", "completed_at", "due_on", "id");

ALTER TABLE "admin_events"
    DROP CONSTRAINT "admin_events_action_check",
    ALTER COLUMN "target_user_id" DROP NOT NULL,
    ALTER COLUMN "target_username" DROP NOT NULL,
    ADD COLUMN "team_id" UUID,
    ADD COLUMN "team_name" VARCHAR(120),
    ADD COLUMN "message_id" BIGINT;

ALTER TABLE "admin_events" ADD CONSTRAINT "admin_events_action_check" CHECK (
    ("action" IN ('account_created', 'account_updated', 'account_deleted')
        AND "target_user_id" IS NOT NULL AND "target_username" IS NOT NULL
        AND "team_id" IS NULL AND "team_name" IS NULL AND "message_id" IS NULL)
    OR
    ("action" = 'team_message_deleted' AND "team_id" IS NOT NULL
        AND "team_name" IS NOT NULL AND "message_id" IS NOT NULL)
);

COMMIT;
