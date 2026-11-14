BEGIN;

-- Preserve existing data outside the application's active schema. Team folders
-- and their contents already belong to their owners in the personal library.
CREATE SCHEMA "retired_collaboration";

ALTER TABLE "team_spaces" SET SCHEMA "retired_collaboration";
ALTER TABLE "team_members" SET SCHEMA "retired_collaboration";
ALTER TABLE "team_invitations" SET SCHEMA "retired_collaboration";
ALTER TABLE "team_messages" SET SCHEMA "retired_collaboration";
ALTER TABLE "team_chat_reads" SET SCHEMA "retired_collaboration";
ALTER TABLE "team_chat_mentions" SET SCHEMA "retired_collaboration";
ALTER TABLE "team_tasks" SET SCHEMA "retired_collaboration";
ALTER TABLE "team_file_reviews" SET SCHEMA "retired_collaboration";
ALTER TABLE "todo_items" SET SCHEMA "retired_collaboration";

ALTER TYPE "TeamRole" SET SCHEMA "retired_collaboration";
ALTER TYPE "TeamReviewStatus" SET SCHEMA "retired_collaboration";

COMMIT;
