import { PET_LINES } from './lines.js';
import { PET_BEHAVIOR_CONFIG } from './pet-config.js';
import { PetStateManager, PET_STATES } from './pet-state.js';
import { nudgeWindowPosition } from '../storage/position.js';

export function createPetController({ root, bubble, effects }) {
  let lastLine = '';
  const stateManager = new PetStateManager();
  const sleepLines = ['呼噜……我先眯一会儿。', '晚安模式启动……', '我在打盹，别担心还陪着你。'];
  const talkLines = [
    '我在这儿陪你。',
    '嘿咻，今天也继续努力。',
    '别太累啦，我看着你呢。',
    '摸摸头的话，我会更开心。'
  ];

  function pickLine() {
    if (PET_LINES.length <= 1) return PET_LINES[0] ?? '你好呀';

    let next = lastLine;
    while (next === lastLine) {
      next = PET_LINES[Math.floor(Math.random() * PET_LINES.length)];
    }
    lastLine = next;
    return next;
  }

  function pickFrom(lines) {
    const candidates = lines.filter((line) => line !== lastLine);
    const next = candidates[Math.floor(Math.random() * candidates.length)] ?? lines[0] ?? '你好呀';
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

  function setPose(state) {
    root.dataset.state = state;

    if (state === PET_STATES.MOVE) {
      const driftX = `${Math.round(-14 + Math.random() * 28)}px`;
      const driftY = `${Math.round(-3 + Math.random() * 6)}px`;
      const tilt = `${(-4 + Math.random() * 8).toFixed(2)}deg`;
      root.style.setProperty('--pet-drift-x', driftX);
      root.style.setProperty('--pet-drift-y', driftY);
      root.style.setProperty('--pet-tilt', tilt);
      return;
    }

    root.style.setProperty('--pet-drift-x', '0px');
    root.style.setProperty('--pet-drift-y', '0px');
    root.style.setProperty('--pet-tilt', '0deg');
  }

  async function nudgeWindow() {
    const { maxStepX, maxStepY } = PET_BEHAVIOR_CONFIG.movement;
    const dx = Math.round(-maxStepX + Math.random() * maxStepX * 2);
    const dy = Math.round(-maxStepY + Math.random() * maxStepY * 2);

    if (dx === 0 && dy === 0) return;

    try {
      await nudgeWindowPosition(dx, dy);
    } catch (error) {
      console.warn('Failed to move pet window slightly.', error);
    }
  }

  function speak(line = pickLine(), duration = 2400) {
    bubble.show(line, duration);
    emitSparkles();
  }

  function speakRandomLine() {
    stateManager.markInteraction();
    stateManager.changeState(PET_STATES.TALK);
    speak(pickLine());
  }

  function handleStateChange({ state, previousState, idleTimeMs }) {
    setPose(state);

    if (state === PET_STATES.TALK) {
      const line = previousState === PET_STATES.SLEEP ? '唔，醒啦，我还在。' : pickFrom(talkLines);
      speak(line, 2200);
    }

    if (state === PET_STATES.MOVE) {
      void nudgeWindow();
    }

    if (state === PET_STATES.SLEEP) {
      const line =
        idleTimeMs >= PET_BEHAVIOR_CONFIG.sleep.deepIdleThresholdMs
          ? '呼……你好久没理我啦，我先睡熟一点。'
          : pickFrom(sleepLines);
      bubble.show(line, 3200);
    }
  }

  const unsubscribe = stateManager.subscribe(handleStateChange);

  root.addEventListener('click', (event) => {
    if (event.button !== 0) return;
    speakRandomLine();
  });

  root.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    stateManager.markInteraction();
    stateManager.pause();
  });

  root.addEventListener('mouseenter', () => {
    stateManager.markInteraction();
  });

  window.addEventListener('keydown', () => {
    stateManager.markInteraction();
  });

  window.addEventListener('mouseup', () => {
    stateManager.resume();
  });

  function startBehaviorLoop() {
    stateManager.start();
  }

  function stopBehaviorLoop() {
    unsubscribe();
    stateManager.stop();
  }

  return {
    speakRandomLine,
    startBehaviorLoop,
    stopBehaviorLoop,
    changeState: (state) => stateManager.changeState(state),
    getCurrentState: () => stateManager.currentState
  };
}
