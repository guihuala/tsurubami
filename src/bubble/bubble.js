export function createBubbleController(element) {
  let hideTimer;

  function show(text, duration = 2400, options = {}) {
    clearTimeout(hideTimer);
    element.textContent = text;
    element.dataset.kind = options.kind ?? 'normal';
    element.classList.add('visible');

    hideTimer = window.setTimeout(() => {
      element.classList.remove('visible');
      element.dataset.kind = 'normal';
    }, duration);
  }

  return { show };
}
