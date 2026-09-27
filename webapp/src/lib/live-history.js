const HIDDEN_HISTORY_TYPES = new Set(["submit", "time-travel", "pause", "resume"]);

export function sortActionsChronologically(actions) {
  return [...(actions ?? [])].sort((left, right) => {
    const secondsDifference = (left.seconds_since_start ?? 0) - (right.seconds_since_start ?? 0);
    return secondsDifference || (left.id ?? 0) - (right.id ?? 0);
  });
}

export function visibleHistoryActions(actions) {
  const rows = [];
  for (const action of sortActionsChronologically(actions)) {
    if (HIDDEN_HISTORY_TYPES.has(action.action_type)) continue;
    const previous = rows.at(-1);
    // Only combine adjacent boundaries at the same displayed match minute.
    // Keep lone boundaries (including a currently ongoing break) visible.
    if (action.action_type === "start-period" && previous?.action_type === "end-period"
      && Number.isFinite(action.seconds_since_start) && Number.isFinite(previous.seconds_since_start)
      && Math.ceil(action.seconds_since_start / 60) === Math.ceil(previous.seconds_since_start / 60)) {
      rows[rows.length - 1] = { ...action, action_type: "period-change" };
    } else {
      rows.push(action);
    }
  }
  return rows.reverse();
}
