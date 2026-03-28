import { PET_LINES } from './lines.js';

export function createPetController({ root, bubble, effects }) {
  let lastLine = '';

  function pickLine() {
    if (PET_LINES.length <= 1) return PET_LINES[0] ?? '你好呀';

    let next = lastLine;
    while (next === lastLine) {
      next = PET_LINES[Math.floor(Math.random() * PET_LINES.length)];
    }
    lastLine = next;
    return next;
  }

  function emitSparkles() {
    for (let i = 0; i < 8; i += 1) {
      const spark = document.createElement('span');
      spark.className = 'spark';
      const angle = Math.random() * Math.PI;
      const distance = 24 + Math.random() * 72;
      const dx = Math.cos(angle) * distance;
      const dy = -Math.abs(Math.sin(angle) * distance);

      spark.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 }
        ],
        { duration: 640, easing: 'ease-out' }
      );

      effects.appendChild(spark);
      window.setTimeout(() => spark.remove(), 700);
    }
  }

  function speakRandomLine() {
    bubble.show(pickLine());
    emitSparkles();
  }

  root.addEventListener('click', (event) => {
    if (event.button !== 0) return;
    speakRandomLine();
  });

  return { speakRandomLine };
}
