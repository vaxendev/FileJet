BEGIN;

CREATE TABLE "todo_items" (
    "user_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "todo_items_pkey" PRIMARY KEY ("user_id", "id"),
    CONSTRAINT "todo_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "todo_items_user_id_created_at_id_idx" ON "todo_items"("user_id", "created_at", "id");

COMMIT;
