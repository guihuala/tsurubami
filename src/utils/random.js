export function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

export function pickWeighted(items, fallback) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;

  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.value;
    }
  }

  return fallback;
}
