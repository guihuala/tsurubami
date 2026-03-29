export function createWeirdScheduler() {
  const timers = new Set();

  function schedule(delay, callback) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);

    timers.add(timer);
    return timer;
  }

  function cancel(timer) {
    if (!timer) return;
    window.clearTimeout(timer);
    timers.delete(timer);
  }

  function clearAll() {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
  }

  return {
    schedule,
    cancel,
    clearAll
  };
}
