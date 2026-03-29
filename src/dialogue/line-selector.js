import { DIALOGUE_LINES } from './lines.js';

function resolveTimeGreeting(period) {
  if (period === 'morning') return 'greetingMorning';
  if (period === 'afternoon') return 'greetingAfternoon';
  if (period === 'evening') return 'greetingEvening';
  return 'greetingLateNight';
}

export function createLineSelector() {
  const lastByCategory = new Map();

  function getCategory(category, context = {}) {
    if (category !== 'greeting') return category;
    return resolveTimeGreeting(context.timePeriod);
  }

  function getLine(category, context = {}) {
    const resolvedCategory = getCategory(category, context);
    const pool = DIALOGUE_LINES[resolvedCategory] ?? [];

    if (resolvedCategory === 'idleMurmur' && context.timePeriod === 'lateNight') {
      const lateNightPool = [
        ...(DIALOGUE_LINES.lateNightConcern ?? []),
        ...(DIALOGUE_LINES.idleMurmur ?? [])
      ];
      return pickUniqueLine(resolvedCategory, lateNightPool);
    }

    if (resolvedCategory === 'clickedIdle' && context.timePeriod === 'lateNight') {
      const latePool = [
        ...(DIALOGUE_LINES.clickedSleepy ?? []),
        ...(DIALOGUE_LINES.clickedIdle ?? [])
      ];
      return pickUniqueLine(resolvedCategory, latePool);
    }

    return pickUniqueLine(resolvedCategory, pool);
  }

  function pickUniqueLine(category, pool) {
    if (!pool.length) return '我在呢。';
    const previous = lastByCategory.get(category);
    const candidates = pool.filter((line) => line !== previous);
    const next = candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
    lastByCategory.set(category, next);
    return next;
  }

  return { getLine };
}
