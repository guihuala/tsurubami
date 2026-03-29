import { createMicrophoneMonitor } from '../audio/microphone-monitor.js';
import { MICROPHONE_STATUS, SOUND_EVENT } from '../audio/audio-types.js';
import { createLineSelector } from '../dialogue/line-selector.js';
import { createReminderScheduler } from '../reminder/reminder-scheduler.js';
import { createReminderStore } from '../reminder/reminder-store.js';
import { nudgeWindowPosition } from '../storage/position.js';
import { createTimeContext, watchTimeContext } from '../time/time-context.js';
import { createPetAudioReactionHandler } from './pet-audio-reaction.js';
import { PET_BEHAVIOR_CONFIG, PET_STATES } from './pet-config.js';
import { createPetInteractionManager } from './pet-interaction.js';
import { PetStateManager } from './pet-state.js';

export function createPetController({
  root,
  bubble,
  effects,
  settings: initialSettings,
  onAudioStatusChange
}) {
  const lineSelector = createLineSelector();
  const interactionManager = createPetInteractionManager();
  const audioReactionHandler = createPetAudioReactionHandler();
  const reminderStore = createReminderStore();
  let settings = { ...initialSettings };
  let currentTimeContext = createTimeContext();
  let lastSpokeAt = 0;
  let lastReminderAt = null;
  let pendingReaction = null;
  let lastSoundReactionAt = 0;
  let audioPulseTimer = null;
  let microphoneState = {
    status: MICROPHONE_STATUS.IDLE,
    level: 0
  };

  const reminderScheduler = createReminderScheduler({
    store: reminderStore,
    onReminderDue: handleReminderDue
  });

  const microphoneMonitor = createMicrophoneMonitor({
    sensitivity: settings.microphoneSensitivity,
    onLevel: handleAudioLevel,
    onStatusChange: (status) => {
      microphoneState = status;
      onAudioStatusChange?.(status);
    }
  });

  if (!settings.microphoneEnabled) {
    onAudioStatusChange?.(microphoneState);
  }

  const stateManager = new PetStateManager({
    getTimeContext: () => currentTimeContext,
    getReminderContext: () => ({
      nextReminder: settings.remindersEnabled ? reminderScheduler.getNextReminder() : null,
      lastReminderAt
    })
  });

  function updateTimeAppearance() {
    root.dataset.period = currentTimeContext.period;
  }

  function isQuietTime() {
    return settings.nightMode && currentTimeContext.isLateNight;
  }

  function getActivityMultiplier() {
    const map = {
      low: 0.62,
      medium: 1,
      high: 1.35
    };

    return map[settings.activityLevel] ?? 1;
  }

  function canActVisibly() {
    return settings.petVisible !== false;
  }

  function reminderCoolingDown() {
    return lastReminderAt ? Date.now() - lastReminderAt < PET_BEHAVIOR_CONFIG.chatter.reminderCooldownMs : false;
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

  function pulseSoundReaction(kind) {
    root.dataset.soundReaction = kind;
    window.clearTimeout(audioPulseTimer);
    audioPulseTimer = window.setTimeout(() => {
      root.dataset.soundReaction = '';
    }, kind === SOUND_EVENT.LOUD ? 900 : 680);
  }

  function emitSparkles(kind = 'normal') {
    for (let i = 0; i < 8; i += 1) {
      const spark = document.createElement('span');
      spark.className = `spark${kind === 'reminder' ? ' spark-reminder' : ''}`;
      const angle = Math.random() * Math.PI;
      const distance = 24 + Math.random() * 72;
      const dx = Math.cos(angle) * distance;
      const dy = -Math.abs(Math.sin(angle) * distance);

      spark.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 }
        ],
        { duration: kind === 'reminder' ? 760 : 640, easing: 'ease-out' }
      );

      effects.appendChild(spark);
      window.setTimeout(() => spark.remove(), kind === 'reminder' ? 820 : 700);
    }
  }

  function speakText(text, { duration = 2400, kind = 'normal' } = {}) {
    if (!canActVisibly()) return;
    bubble.show(text, duration, { kind });
    emitSparkles(kind);
    lastSpokeAt = Date.now();
  }

  function speakCategory(category, options = {}) {
    const text = lineSelector.getLine(category, {
      timePeriod: currentTimeContext.period,
      ...options.context
    });
    speakText(text, options);
  }

  async function nudgeWindow() {
    if (!canActVisibly()) return;

    const { maxStepX, maxStepY } = PET_BEHAVIOR_CONFIG.movement;
    const quietFactor = isQuietTime() ? 0.38 : 1;
    const activity = getActivityMultiplier();
    const dx = Math.round((-maxStepX + Math.random() * maxStepX * 2) * quietFactor * activity);
    const dy = Math.round((-maxStepY + Math.random() * maxStepY * 2) * quietFactor * activity);

    if (dx === 0 && dy === 0) return;

    try {
      await nudgeWindowPosition(dx, dy);
    } catch (error) {
      console.warn('Failed to move pet window slightly.', error);
    }
  }

  function queueReaction(reaction) {
    pendingReaction = reaction;
  }

  function playPendingReaction(state) {
    if (!pendingReaction || pendingReaction.state !== state) return false;

    const reaction = pendingReaction;
    pendingReaction = null;

    if (reaction.text) {
      speakText(reaction.text, {
        duration: reaction.duration,
        kind: reaction.kind
      });
      return true;
    }

    if (reaction.category) {
      speakCategory(reaction.category, {
        duration: reaction.duration,
        kind: reaction.kind,
        context: reaction.context
      });
      return true;
    }

    return false;
  }

  function handleAutoTalk(snapshot) {
    if (!settings.autoTalk || !canActVisibly()) return;
    if (settings.activityLevel === 'low' && Math.random() > 0.42) return;
    if (settings.activityLevel === 'medium' && Math.random() > 0.76) return;
    if (settings.activityLevel === 'high' && Math.random() > 0.94) return;

    const sinceReminder = lastReminderAt ? Date.now() - lastReminderAt : Number.POSITIVE_INFINITY;
    const activity = getActivityMultiplier();

    if (sinceReminder < PET_BEHAVIOR_CONFIG.chatter.reminderCooldownMs) {
      speakCategory('postReminder', { duration: 2200 });
      return;
    }

    if (snapshot.timeContext.isMorning && Math.random() < 0.34 * activity) {
      speakCategory('morningPrompt', { duration: 2200 });
      return;
    }

    if (snapshot.timeContext.isEvening && Math.random() < 0.3 * activity) {
      speakCategory('eveningSoft', { duration: 2400 });
      return;
    }

    if (isQuietTime()) {
      speakCategory('lateNightConcern', { duration: 2500 });
      return;
    }

    speakCategory('idleMurmur', { duration: 2200 });
  }

  function handleStateChange(snapshot) {
    setPose(snapshot.state);
    updateTimeAppearance();

    if (!canActVisibly()) {
      return;
    }

    if (playPendingReaction(snapshot.state)) {
      return;
    }

    if (snapshot.state === PET_STATES.MOVE) {
      void nudgeWindow();
      return;
    }

    if (snapshot.state === PET_STATES.SOUND_REACT) {
      return;
    }

    if (snapshot.state === PET_STATES.STARTLED) {
      return;
    }

    if (snapshot.state === PET_STATES.TALK) {
      handleAutoTalk(snapshot);
      return;
    }

    if (snapshot.state === PET_STATES.SLEEP && snapshot.previousState !== PET_STATES.SLEEP) {
      speakCategory('sleepMurmur', { duration: 3200 });
    }
  }

  function buildReminderText(reminder) {
    const category = isQuietTime() ? 'reminderGentle' : 'reminder';
    const prefix = lineSelector.getLine(category, {
      timePeriod: currentTimeContext.period
    });
    return `${prefix} ${reminder.text}`;
  }

  function handleReminderDue(reminder, options = {}) {
    if (!settings.remindersEnabled && !options.force) return false;

    lastReminderAt = Date.now();
    queueReaction({
      state: PET_STATES.TALK,
      text: buildReminderText(reminder),
      duration: 4200,
      kind: 'reminder'
    });
    stateManager.changeState(PET_STATES.TALK, { duration: 3200 });
    return true;
  }

  function handleSoundEvent(event, level) {
    const reaction = audioReactionHandler.handleSoundEvent({
      event,
      currentState: stateManager.currentState,
      isQuietTime: isQuietTime(),
      now: Date.now(),
      reminderCoolingDown: reminderCoolingDown(),
      level
    });

    if (!reaction) return;
    if (!canActVisibly()) return;

    lastSoundReactionAt = Date.now();
    pulseSoundReaction(event);

    if (reaction.say && reaction.category) {
      queueReaction({
        state: reaction.nextState,
        category: reaction.category,
        duration: reaction.duration,
        kind: reaction.bubbleKind,
        context: { timePeriod: currentTimeContext.period }
      });
    }

    if (reaction.wakeUp) {
      stateManager.markInteraction();
    }

    stateManager.changeState(reaction.nextState, { duration: reaction.duration });
  }

  function handleAudioLevel(payload) {
    microphoneState = {
      status: payload.status,
      level: payload.level
    };
    onAudioStatusChange?.(microphoneState);

    if (!settings.microphoneEnabled || payload.status !== MICROPHONE_STATUS.LISTENING) return;
    if (Date.now() - lastSoundReactionAt < (isQuietTime() ? 2400 : 1400)) return;

    if (payload.category === SOUND_EVENT.SOFT) {
      handleSoundEvent(SOUND_EVENT.SOFT, payload.level);
      return;
    }

    if (payload.category === SOUND_EVENT.VOICE) {
      handleSoundEvent(
        payload.level > 0.18 && Math.random() < 0.35 ? SOUND_EVENT.VOICE : SOUND_EVENT.SOFT,
        payload.level
      );
      return;
    }

    if (payload.category === SOUND_EVENT.LOUD) {
      handleSoundEvent(SOUND_EVENT.LOUD, payload.level);
    }
  }

  function handleClick(event) {
    if (event.button !== 0) return;

    const now = Date.now();
    const snapshot = stateManager.getSnapshot();
    const reaction = interactionManager.resolveClickReaction({
      state: snapshot.state,
      idleTimeMs: snapshot.idleTimeMs,
      timeContext: currentTimeContext,
      justTalked: now - lastSpokeAt < 5000,
      now
    });

    stateManager.markInteraction(now);
    queueReaction({
      state: reaction.nextState,
      category: reaction.category,
      duration: reaction.category === 'wakeUp' ? 2800 : 2400,
      kind: reaction.bubbleKind,
      context: { timePeriod: currentTimeContext.period }
    });
    stateManager.changeState(reaction.nextState);
  }

  const unsubscribe = stateManager.subscribe(handleStateChange);
  const unwatchTimeContext = watchTimeContext((nextContext) => {
    currentTimeContext = nextContext;
    updateTimeAppearance();
    if (
      settings.autoTalk &&
      canActVisibly() &&
      Date.now() - lastSpokeAt > 12000 &&
      stateManager.currentState !== PET_STATES.SLEEP
    ) {
      queueReaction({
        state: PET_STATES.TALK,
        category: 'greeting',
        duration: 2400,
        kind: 'normal',
        context: { timePeriod: nextContext.period }
      });
      stateManager.changeState(PET_STATES.TALK);
    }
  });

  root.addEventListener('click', handleClick);

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
    updateTimeAppearance();
    reminderScheduler.start();
    if (settings.microphoneEnabled) {
      void microphoneMonitor.start();
    }
    stateManager.start();
    if (settings.autoTalk && canActVisibly()) {
      queueReaction({
        state: PET_STATES.TALK,
        category: 'greeting',
        duration: isQuietTime() ? 2600 : 2200,
        kind: 'normal',
        context: { timePeriod: currentTimeContext.period }
      });
      stateManager.changeState(PET_STATES.TALK);
    }
  }

  function stopBehaviorLoop() {
    unsubscribe();
    unwatchTimeContext();
    reminderScheduler.stop();
    microphoneMonitor.stop();
    window.clearTimeout(audioPulseTimer);
    stateManager.stop();
  }

  return {
    startBehaviorLoop,
    stopBehaviorLoop,
    updateSettings(nextSettings) {
      settings = { ...settings, ...nextSettings };

      if (!settings.petVisible) {
        pendingReaction = null;
      }

      if (typeof nextSettings.microphoneSensitivity === 'string') {
        microphoneMonitor.setSensitivity(nextSettings.microphoneSensitivity);
      }

      if (nextSettings.microphoneEnabled === true) {
        void microphoneMonitor.start();
      }

      if (nextSettings.microphoneEnabled === false) {
        microphoneMonitor.stop();
        microphoneState = {
          status: MICROPHONE_STATUS.IDLE,
          level: 0
        };
        onAudioStatusChange?.(microphoneState);
      }
    },
    speakManualGreeting() {
      stateManager.markInteraction();
      queueReaction({
        state: PET_STATES.TALK,
        category: 'greeting',
        duration: 2200,
        kind: 'normal',
        context: { timePeriod: currentTimeContext.period }
      });
      stateManager.changeState(PET_STATES.TALK);
    },
    triggerTestReminder() {
      handleReminderDue(
        {
          id: `manual-${Date.now()}`,
          text: '这是你刚刚点出来的测试提醒。'
        },
        { force: true }
      );
    },
    async requestMicrophonePermission() {
      settings = { ...settings, microphoneEnabled: true };
      return microphoneMonitor.requestPermission();
    },
    getCurrentState: () => stateManager.currentState,
    getReminderList: () => reminderStore.list(),
    getSettings: () => ({ ...settings }),
    getMicrophoneState: () => ({ ...microphoneState })
  };
}
