-- Plan 007 T-003: rewrite animated Discord CDN avatars to static PNG.
UPDATE "users"
SET "image" = regexp_replace("image", '\.gif(\?|$)', '.png\1', 'i')
WHERE "image" IS NOT NULL
  AND "image" LIKE '%cdn.discordapp.com%'
  AND "image" ~* '\.gif(\?|$)';
