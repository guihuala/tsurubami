const REMINDERS_KEY = 'tsurubami-reminders';

function pad(value) {
  return String(value).padStart(2, '0');
}

function createIsoOffset(minutesFromNow) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

function createLocalDateTimeOffset(minutesFromNow) {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createId() {
  return `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidDateTime(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function normalizeTimeOfDay(value) {
  if (typeof value !== 'string') return '09:00';
  const matched = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!matched) return '09:00';

  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '09:00';

  return `${pad(hours)}:${pad(minutes)}`;
}

function toLocalDateTimeValue(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return createLocalDateTimeOffset(60);
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createDefaultDateTime() {
  return createLocalDateTimeOffset(60);
}

function sanitizeReminder(reminder) {
  const scheduleType = reminder?.scheduleType === 'daily' ? 'daily' : 'once';
  const fallbackDateTime = createDefaultDateTime();
  const triggerAt = isValidDateTime(reminder?.triggerAt) ? reminder.triggerAt : fallbackDateTime;
  const timeOfDay =
    reminder?.timeOfDay ??
    (isValidDateTime(triggerAt) ? toLocalDateTimeValue(triggerAt).slice(11, 16) : '09:00');

  return {
    id: typeof reminder?.id === 'string' && reminder.id ? reminder.id : createId(),
    text:
      typeof reminder?.text === 'string' && reminder.text.trim()
        ? reminder.text.trim()
        : '提醒一下自己继续。',
    scheduleType,
    triggerAt,
    timeOfDay: normalizeTimeOfDay(timeOfDay),
    enabled: reminder?.enabled !== false,
    fired: scheduleType === 'once' ? reminder?.fired === true : false,
    lastTriggeredAt:
      typeof reminder?.lastTriggeredAt === 'string' && !Number.isNaN(new Date(reminder.lastTriggeredAt).getTime())
        ? reminder.lastTriggeredAt
        : null
  };
}

function sortReminders(reminders) {
  return [...reminders].sort((left, right) => {
    const leftNext = getReminderNextTrigger(left)?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightNext = getReminderNextTrigger(right)?.getTime() ?? Number.POSITIVE_INFINITY;
    if (leftNext !== rightNext) return leftNext - rightNext;
    return left.text.localeCompare(right.text, 'zh-CN');
  });
}

function getDailyOccurrence(reminder, baseDate = new Date()) {
  const [hours, minutes] = normalizeTimeOfDay(reminder.timeOfDay).split(':').map(Number);
  const occurrence = new Date(baseDate);
  occurrence.setSeconds(0, 0);
  occurrence.setHours(hours, minutes, 0, 0);
  return occurrence;
}

export function getReminderNextTrigger(reminder, now = new Date()) {
  if (!reminder?.enabled) return null;

  if (reminder.scheduleType === 'daily') {
    let occurrence = getDailyOccurrence(reminder, now);
    if (occurrence.getTime() <= now.getTime()) {
      occurrence.setDate(occurrence.getDate() + 1);
    }

    return occurrence;
  }

  if (reminder.fired) return null;
  const triggerAt = new Date(reminder.triggerAt);
  if (Number.isNaN(triggerAt.getTime()) || triggerAt.getTime() <= now.getTime()) {
    return null;
  }

  return triggerAt;
}

function isDailyReminderDue(reminder, now = new Date()) {
  const occurrence = getDailyOccurrence(reminder, now);
  if (occurrence.getTime() > now.getTime()) return false;
  if (!reminder.lastTriggeredAt) return true;

  return new Date(reminder.lastTriggeredAt).getTime() < occurrence.getTime();
}

export function createDemoReminders() {
  return [
    {
      id: 'demo-water',
      text: '喝口水，顺便活动一下肩膀。',
      scheduleType: 'once',
      triggerAt: createIsoOffset(1),
      timeOfDay: createLocalDateTimeOffset(1).slice(11, 16),
      enabled: true
    },
    {
      id: 'demo-rest-eyes',
      text: '看看远一点的地方，让眼睛休息一下。',
      scheduleType: 'once',
      triggerAt: createIsoOffset(3),
      timeOfDay: createLocalDateTimeOffset(3).slice(11, 16),
      enabled: true
    },
    {
      id: 'demo-wrap-up',
      text: '把手头那件事收个尾吧。',
      scheduleType: 'once',
      triggerAt: createIsoOffset(5),
      timeOfDay: createLocalDateTimeOffset(5).slice(11, 16),
      enabled: true
    }
  ].map(sanitizeReminder);
}

export function loadStoredReminderEntries() {
  try {
    const raw = window.localStorage.getItem(REMINDERS_KEY);
    if (!raw) {
      const seeded = createDemoReminders();
      saveReminderEntries(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      const seeded = createDemoReminders();
      saveReminderEntries(seeded);
      return seeded;
    }

    const reminders = parsed.map(sanitizeReminder);
    const sorted = sortReminders(reminders);
    saveReminderEntries(sorted);
    return sorted;
  } catch {
    const seeded = createDemoReminders();
    saveReminderEntries(seeded);
    return seeded;
  }
}

export function saveReminderEntries(reminders) {
  const normalized = sortReminders(reminders.map(sanitizeReminder));
  window.localStorage.setItem(REMINDERS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function createReminderDraft() {
  return {
    text: '',
    scheduleType: 'once',
    triggerAt: createDefaultDateTime(),
    timeOfDay: '09:00',
    enabled: true
  };
}

export function reviveReminder(reminder) {
  const normalized = sanitizeReminder(reminder);

  if (normalized.scheduleType === 'daily') {
    return {
      ...normalized,
      fired: false
    };
  }

  const nextTrigger = new Date(normalized.triggerAt);
  if (!Number.isNaN(nextTrigger.getTime()) && nextTrigger.getTime() > Date.now()) {
    return {
      ...normalized,
      fired: false,
      lastTriggeredAt: null
    };
  }

  return normalized;
}

export function createReminderStore(seedReminders = loadStoredReminderEntries()) {
  let reminders = saveReminderEntries(seedReminders);

  function persist() {
    reminders = saveReminderEntries(reminders);
  }

  function list() {
    return reminders.map((reminder) => ({ ...reminder }));
  }

  function replaceAll(nextReminders) {
    reminders = nextReminders.map(sanitizeReminder);
    persist();
  }

  function add(reminder) {
    reminders.push(sanitizeReminder(reminder));
    persist();
    return reminders[reminders.length - 1];
  }

  function update(id, patch) {
    const index = reminders.findIndex((item) => item.id === id);
    if (index < 0) return null;

    reminders[index] = sanitizeReminder({
      ...reminders[index],
      ...patch,
      id
    });
    persist();
    return { ...reminders[index] };
  }

  function remove(id) {
    const before = reminders.length;
    reminders = reminders.filter((item) => item.id !== id);
    if (reminders.length !== before) {
      persist();
    }
  }

  function markTriggered(id, firedAt = new Date()) {
    const reminder = reminders.find((item) => item.id === id);
    if (!reminder) return;

    reminder.lastTriggeredAt = firedAt.toISOString();
    if (reminder.scheduleType === 'once') {
      reminder.fired = true;
    }
    persist();
  }

  function getNextPending(now = new Date()) {
    return reminders
      .map((reminder) => {
        const nextTrigger = getReminderNextTrigger(reminder, now);
        if (!nextTrigger) return null;
        return {
          ...reminder,
          triggerTime: nextTrigger.toISOString()
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.triggerTime).getTime() - new Date(b.triggerTime).getTime())[0] ?? null;
  }

  function getDue(now = new Date()) {
    return reminders.filter((item) => {
      if (!item.enabled) return false;

      if (item.scheduleType === 'daily') {
        return isDailyReminderDue(item, now);
      }

      if (item.fired) return false;
      return new Date(item.triggerAt).getTime() <= now.getTime();
    });
  }

  return {
    list,
    replaceAll,
    add,
    update,
    remove,
    markTriggered,
    getNextPending,
    getDue
  };
}
