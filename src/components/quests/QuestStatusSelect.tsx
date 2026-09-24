"use client";

import { QUEST_STATUSES, QUEST_STATUS_LABEL, type QuestStatus } from "@/lib/quests/status";

export function QuestStatusSelect({
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  value: QuestStatus;
  onChange: (value: QuestStatus) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as QuestStatus)}
      style={{ width: "auto", padding: "6px 8px", fontSize: 12 }}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {QUEST_STATUSES.map((status) => (
        <option key={status} value={status}>
          {QUEST_STATUS_LABEL[status]}
        </option>
      ))}
    </select>
  );
}
