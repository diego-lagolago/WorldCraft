-- Owner 2026-09-24: Bool „Legendär“ → „Boss“ (Anzeige: Totenschädel statt Pill).

ALTER TABLE "monsters" RENAME COLUMN "is_legendary" TO "is_boss";
