# Spike T-010 — Chat mit Würfeln, Kanälen und Threads

Lokal: `/spike/chat` (Sitzung nötig). APIs unter `/api/spike/chat`.

## Erweiterung gegenüber dem Fachmodell

`.ai/architecture/datenmodell-fachlich.md` hält Chat **welt-scoped** (eine Nachrichtliste pro Welt). Dieses Spike **erweitert** das, ohne das Fachmodell umzuschreiben:

| Spike-Tabelle | Entsprechung später | Bemerkung |
|---|---|---|
| `spike_chat_channels` | `chat_channels` | `world_key` (`spike`) statt `world_id`, solange es keine `worlds`-Tabelle gibt |
| `spike_chat_threads` | `chat_threads` | Unterhaltung in einem Kanal; `created_from_message_id` optional |
| `spike_chat_messages` | `chat_messages` | zusätzlich `channel_id`, `thread_id` (null = Hauptstrom), `opens_thread_id` (Eltern-Post, der den Thread öffnet) |

Nachrichten sind **kein** flaches Welt-Log mehr: immer ein Kanal, optional ein Thread.

## Gebaut vs. Backlog

**Gebaut:** Default-Kanal „Allgemein“, Thread anlegen über `+` → „Thread starten“ legt einen tappable Eltern-Post im Kanal an (`opens_thread_id`). Nachrichten/Würfel im aktuellen Strom, SSE, letzte 50 je Strom. Icon-Wurf mit Schalter **Im Chat posten** (Profilfeld `users.dice_post_to_chat`, Default `true`). `/roll` im Composer postet immer, unabhängig vom Schalter. Chat-Wurf ist eine Zeile, z. B. `2d6+3 → 4, 2 + 3 = 9`.

**Backlog** (`.ai/backlog.md`): Channel-Verwaltung (anlegen, umbenennen, Reihenfolge) analog Discord; Thread-UX über den `+`-Button hinaus.
