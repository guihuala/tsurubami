export function createBehaviorTracker({
  memoryWindowMs = 5 * 60 * 1000,
  rapidWindowMs = 1400
} = {}) {
  let clickTimestamps = [];
  let lastClickAt = 0;
  let lastInteractionAt = Date.now();
  let lastInteractionType = 'init';
  let lastReminderAt = null;
  let reminderAcknowledgedAt = null;

  function prune(now = Date.now()) {
    clickTimestamps = clickTimestamps.filter((timestamp) => now - timestamp <= memoryWindowMs);
  }

  function recordInteraction(type, now = Date.now()) {
    prune(now);
    lastInteractionAt = now;
    lastInteractionType = type;

    if (type === 'click') {
      clickTimestamps.push(now);
      lastClickAt = now;
    }

    if (lastReminderAt && now >= lastReminderAt) {
      reminderAcknowledgedAt = now;
    }

    return getSnapshot(now);
  }

  function recordReminder(now = Date.now()) {
    lastReminderAt = now;
    reminderAcknowledgedAt = null;
    return getSnapshot(now);
  }

  function getSnapshot(now = Date.now()) {
    prune(now);
    const rapidClickCount = clickTimestamps.filter((timestamp) => now - timestamp <= rapidWindowMs).length;

    return {
      recentClicks: clickTimestamps.length,
      lastClickAt: lastClickAt || null,
      idleTime: Math.max(0, now - lastInteractionAt),
      rapidClickCount,
      lastInteractionType,
      lastReminderAt,
      reminderAcknowledgedAt
    };
  }

  return {
    recordInteraction,
    recordReminder,
    getSnapshot
  };
}
