-- Plan 007 T-004: edited_at on chat messages (APP-CHAT-EDIT).
ALTER TABLE "chat_messages" ADD COLUMN "edited_at" timestamptz;
