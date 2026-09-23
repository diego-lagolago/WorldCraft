-- Plan 005 T-004: content_kind += monster (own transaction; ADD VALUE cannot be used
-- in the same transaction as the new enum value).

ALTER TYPE "public"."content_kind" ADD VALUE IF NOT EXISTS 'monster';
