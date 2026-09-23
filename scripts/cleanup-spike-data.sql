-- Plan 003 T-016 / CR-001 Teil 3: Spike-Daten aus Produktivtabellen bereinigen.
--
-- Ablauf:
-- 1. Dry-Run (nur SELECT) ausführen und dem Projektinhaber die Treffer zeigen.
-- 2. Nach ausdrücklicher Freigabe den APPLY-Block ausführen.
-- 3. Die Tabellen-Drops laufen über Migration 0011_drop_spike_tables.sql (npm run db:migrate).

-- ========== DRY-RUN (sicher, nur lesen) ==========
SELECT id, name, created_at
FROM worlds
WHERE name LIKE 'Rechte-Spike%'
ORDER BY created_at;

SELECT id, storage_key, created_at
FROM files
WHERE storage_key LIKE 'spike/%'
ORDER BY created_at;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'spike_%'
ORDER BY table_name;

-- ========== APPLY (nur nach Freigabe) ==========
-- Löscht Welten aus dem Rechte-Spike (CASCADE auf Mitgliedschaften, Inhalte, Chat, …).
-- Charaktere haben keine Welt-FK und bleiben; zugehörige Teilnahmen/Tagebücher der Welt fallen mit der Welt weg.
-- DELETE FROM worlds WHERE name LIKE 'Rechte-Spike%';

-- Platzhalter-Dateien des Rechte-Spikes (keine Produkt-Uploads mit diesem Präfix).
-- DELETE FROM files WHERE storage_key LIKE 'spike/%';
