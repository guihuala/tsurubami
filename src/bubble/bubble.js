export function createBubbleController(element) {
  let hideTimer;

  function show(text, duration = 2400) {
    clearTimeout(hideTimer);
    element.textContent = text;
    element.classList.add('visible');

    hideTimer = window.setTimeout(() => {
      element.classList.remove('visible');
    }, duration);
  }

  return { show };
}
