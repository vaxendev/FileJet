-- CreateEnum
CREATE TYPE "TeamReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- AlterTable
ALTER TABLE "team_messages" ADD COLUMN     "file_id" UUID,
ADD COLUMN     "pinned_at" TIMESTAMPTZ(6),
ADD COLUMN     "reply_to_id" BIGINT;

-- CreateTable
CREATE TABLE "team_chat_reads" (
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_id" BIGINT NOT NULL,

    CONSTRAINT "team_chat_reads_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateTable
CREATE TABLE "team_chat_mentions" (
    "message_id" BIGINT NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "team_chat_mentions_pkey" PRIMARY KEY ("message_id","user_id")
);

-- CreateTable
CREATE TABLE "team_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "message_id" BIGINT NOT NULL,
    "created_by_id" UUID,
    "assignee_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "due_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "team_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_file_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "requested_by_id" UUID,
    "reviewer_id" UUID,
    "status" "TeamReviewStatus" NOT NULL DEFAULT 'PENDING',
    "request_note" VARCHAR(1000) NOT NULL DEFAULT '',
    "response_note" VARCHAR(1000) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(6),

    CONSTRAINT "team_file_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_chat_reads_user_id_team_id_idx" ON "team_chat_reads"("user_id", "team_id");

-- CreateIndex
CREATE INDEX "team_chat_mentions_user_id_message_id_idx" ON "team_chat_mentions"("user_id", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_tasks_message_id_key" ON "team_tasks"("message_id");

-- CreateIndex
CREATE INDEX "team_tasks_team_id_created_at_id_idx" ON "team_tasks"("team_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "team_tasks_created_by_id_idx" ON "team_tasks"("created_by_id");

-- CreateIndex
CREATE INDEX "team_tasks_assignee_id_idx" ON "team_tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "team_file_reviews_team_id_created_at_id_idx" ON "team_file_reviews"("team_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "team_file_reviews_file_id_revision_reviewer_id_status_idx" ON "team_file_reviews"("file_id", "revision", "reviewer_id", "status");

-- CreateIndex
CREATE INDEX "team_file_reviews_requested_by_id_idx" ON "team_file_reviews"("requested_by_id");

-- CreateIndex
CREATE INDEX "team_file_reviews_reviewer_id_idx" ON "team_file_reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "team_messages_file_id_idx" ON "team_messages"("file_id");

-- CreateIndex
CREATE INDEX "team_messages_reply_to_id_idx" ON "team_messages"("reply_to_id");

-- CreateIndex
CREATE INDEX "team_messages_team_id_pinned_at_idx" ON "team_messages"("team_id", "pinned_at");

-- AddForeignKey
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "team_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_chat_reads" ADD CONSTRAINT "team_chat_reads_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_chat_reads" ADD CONSTRAINT "team_chat_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_chat_mentions" ADD CONSTRAINT "team_chat_mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "team_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_chat_mentions" ADD CONSTRAINT "team_chat_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_tasks" ADD CONSTRAINT "team_tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_tasks" ADD CONSTRAINT "team_tasks_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "team_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_tasks" ADD CONSTRAINT "team_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_tasks" ADD CONSTRAINT "team_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_file_reviews" ADD CONSTRAINT "team_file_reviews_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_file_reviews" ADD CONSTRAINT "team_file_reviews_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_file_reviews" ADD CONSTRAINT "team_file_reviews_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_file_reviews" ADD CONSTRAINT "team_file_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
