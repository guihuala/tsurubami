const PERIODS = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  lateNight: 'lateNight'
};

export function getTimePeriod(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 6 && hour < 11) return PERIODS.morning;
  if (hour >= 11 && hour < 18) return PERIODS.afternoon;
  if (hour >= 18 && hour < 23) return PERIODS.evening;
  return PERIODS.lateNight;
}

export function createTimeContext(date = new Date()) {
  const period = getTimePeriod(date);

  return {
    now: date,
    hour: date.getHours(),
    period,
    isMorning: period === PERIODS.morning,
    isAfternoon: period === PERIODS.afternoon,
    isEvening: period === PERIODS.evening,
    isLateNight: period === PERIODS.lateNight
  };
}

export function watchTimeContext(onChange, pollMs = 60000) {
  let previousPeriod = getTimePeriod();

  const timer = window.setInterval(() => {
    const nextContext = createTimeContext();
    if (nextContext.period === previousPeriod) return;
    previousPeriod = nextContext.period;
    onChange(nextContext);
  }, pollMs);

  return () => {
    window.clearInterval(timer);
  };
}

export { PERIODS };
