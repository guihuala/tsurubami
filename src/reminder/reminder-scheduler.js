export function createReminderScheduler({ store, onReminderDue, pollMs = 1000 }) {
  let timer = null;
  let lastTriggeredReminderId = null;

  function start() {
    if (timer) return;
    timer = window.setInterval(check, pollMs);
    check();
  }

  function stop() {
    if (!timer) return;
    window.clearInterval(timer);
    timer = null;
  }

  function check() {
    const dueReminders = store.getDue(new Date());
    dueReminders.forEach((reminder) => {
      if (reminder.id === lastTriggeredReminderId) return;
      const handled = onReminderDue(reminder);
      if (handled === false) return;
      lastTriggeredReminderId = reminder.id;
      store.markTriggered(reminder.id, new Date());
    });
  }

  function getNextReminder() {
    return store.getNextPending(new Date());
  }

  return {
    start,
    stop,
    check,
    getNextReminder
  };
}
