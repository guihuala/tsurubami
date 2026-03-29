function createIsoOffset(minutesFromNow) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

export function createReminderStore(seedReminders = createDemoReminders()) {
  const reminders = seedReminders.map((reminder) => ({
    ...reminder,
    fired: false,
    lastTriggeredAt: null
  }));

  function list() {
    return reminders.map((reminder) => ({ ...reminder }));
  }

  function add(reminder) {
    reminders.push({
      ...reminder,
      fired: false,
      lastTriggeredAt: null
    });
  }

  function markTriggered(id, firedAt = new Date()) {
    const reminder = reminders.find((item) => item.id === id);
    if (!reminder) return;
    reminder.fired = true;
    reminder.lastTriggeredAt = firedAt.toISOString();
  }

  function getNextPending(now = new Date()) {
    return reminders
      .filter((item) => item.enabled && !item.fired && new Date(item.triggerTime).getTime() > now.getTime())
      .sort((a, b) => new Date(a.triggerTime).getTime() - new Date(b.triggerTime).getTime())[0] ?? null;
  }

  function getDue(now = new Date()) {
    return reminders.filter((item) => {
      if (!item.enabled || item.fired) return false;
      return new Date(item.triggerTime).getTime() <= now.getTime();
    });
  }

  return {
    list,
    add,
    markTriggered,
    getNextPending,
    getDue
  };
}

export function createDemoReminders() {
  return [
    {
      id: 'demo-water',
      text: '喝口水，顺便活动一下肩膀。',
      triggerTime: createIsoOffset(1),
      enabled: true
    },
    {
      id: 'demo-rest-eyes',
      text: '看看远一点的地方，让眼睛休息一下。',
      triggerTime: createIsoOffset(3),
      enabled: true
    },
    {
      id: 'demo-wrap-up',
      text: '把手头那件事收个尾吧。',
      triggerTime: createIsoOffset(5),
      enabled: true
    }
  ];
}
