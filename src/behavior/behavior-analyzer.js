const DEFAULT_BEHAVIOR_CONFIG = {
  rapidClickThreshold: 3,
  idleReturnMs: 18_000,
  longIdleMs: 48_000,
  reminderIgnoredMs: 20_000,
  cooldowns: {
    rapidClick: 9_000,
    longIdle: 22_000,
    idleReturn: 14_000,
    reminderIgnored: 18_000
  }
};

export function createBehaviorAnalyzer(config = DEFAULT_BEHAVIOR_CONFIG) {
  const lastTriggeredAt = new Map();

  function coolingDown(key, now) {
    const cooldownMs = config.cooldowns[key] ?? 0;
    const lastAt = lastTriggeredAt.get(key) ?? 0;
    return now - lastAt < cooldownMs;
  }

  function trigger(key, payload, now) {
    lastTriggeredAt.set(key, now);
    return payload;
  }

  function analyzeClick(snapshot, { now = Date.now() } = {}) {
    if (snapshot.rapidClickCount >= config.rapidClickThreshold && !coolingDown('rapidClick', now)) {
      return trigger(
        'rapidClick',
        { key: 'rapidClick', category: 'behaviorRapidClick', emotion: 'annoyed' },
        now
      );
    }

    const reminderIgnored = hasIgnoredReminder(snapshot, now);
    if (reminderIgnored && !coolingDown('reminderIgnored', now)) {
      return trigger(
        'reminderIgnored',
        { key: 'reminderIgnored', category: 'behaviorReminderIgnored', emotion: 'annoyed' },
        now
      );
    }

    if (snapshot.idleTime >= config.longIdleMs && !coolingDown('longIdle', now)) {
      return trigger(
        'longIdle',
        { key: 'longIdle', category: 'behaviorLongIdle', emotion: 'bored' },
        now
      );
    }

    if (snapshot.idleTime >= config.idleReturnMs && !coolingDown('idleReturn', now)) {
      return trigger(
        'idleReturn',
        { key: 'idleReturn', category: 'behaviorIdleReturn', emotion: 'watching' },
        now
      );
    }

    return null;
  }

  function analyzePassive(snapshot, { now = Date.now() } = {}) {
    if (hasIgnoredReminder(snapshot, now) && !coolingDown('reminderIgnored', now)) {
      return trigger(
        'reminderIgnored',
        { key: 'reminderIgnored', category: 'behaviorReminderIgnored', emotion: 'annoyed' },
        now
      );
    }

    return null;
  }

  function hasIgnoredReminder(snapshot, now) {
    if (!snapshot.lastReminderAt) return false;
    if (snapshot.reminderAcknowledgedAt && snapshot.reminderAcknowledgedAt >= snapshot.lastReminderAt) {
      return false;
    }
    return now - snapshot.lastReminderAt >= config.reminderIgnoredMs;
  }

  return {
    analyzeClick,
    analyzePassive
  };
}
