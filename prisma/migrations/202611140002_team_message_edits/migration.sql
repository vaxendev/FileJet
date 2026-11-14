CREATE SEQUENCE "team_message_edit_version_seq";
ALTER TABLE "team_messages" ADD COLUMN "edit_version" BIGINT;
ALTER SEQUENCE "team_message_edit_version_seq" OWNED BY "team_messages"."edit_version";
CREATE INDEX "team_messages_team_id_edit_version_idx" ON "team_messages"("team_id", "edit_version");
