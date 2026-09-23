-- Plan 007 T-008: opener body is NULL; title only on chat_threads (CHK-OPENER-BODY).
UPDATE "chat_messages"
SET "body" = NULL
WHERE "opens_thread_id" IS NOT NULL;

ALTER TABLE "chat_messages" ALTER COLUMN "body" DROP NOT NULL;

ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_body_length";

ALTER TABLE "chat_messages" ADD CONSTRAINT "chk_opener_body" CHECK (
  (
    "opens_thread_id" IS NOT NULL
    AND "body" IS NULL
  )
  OR (
    "opens_thread_id" IS NULL
    AND "body" IS NOT NULL
    AND char_length("body") BETWEEN 1 AND 2000
  )
);
