import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createMicrophoneMonitor } from '../audio/microphone-monitor.js';
import { MICROPHONE_STATUS } from '../audio/audio-types.js';
import { createBehaviorAnalyzer } from '../behavior/behavior-analyzer.js';
import { createBehaviorTracker } from '../behavior/behavior-tracker.js';
import { createLineSelector } from '../dialogue/line-selector.js';
import { createEmotionState } from '../emotion/emotion-state.js';
import { createReminderScheduler } from '../reminder/reminder-scheduler.js';
import { createReminderStore } from '../reminder/reminder-store.js';
import { nudgeWindowPosition } from '../storage/position.js';
import { saveWindowPosition } from '../storage/position.js';
import { createTimeContext, watchTimeContext } from '../time/time-context.js';
import { createWeirdEventManager } from '../weird/weird-event-manager.js';
import { createWeirdScheduler } from '../weird/weird-scheduler.js';
import { createPetAudioReactionHandler } from './pet-audio-reaction.js';
import { PET_BEHAVIOR_CONFIG, PET_STATES } from './pet-config.js';
import { createPetInteractionManager } from './pet-interaction.js';
import { PetStateManager } from './pet-state.js';

export function createPetController({
  root,
  bubble,
  effects,
  settings: initialSettings
}) {
  const isMac = /Mac|iPhone|iPad|iPod/.test(window.navigator.userAgent);
  const downEventName = isMac ? 'mousedown' : 'pointerdown';
  const moveEventName = isMac ? 'mousemove' : 'pointermove';
  const upEventName = isMac ? 'mouseup' : 'pointerup';
  const cancelEventName = isMac ? 'mouseleave' : 'pointercancel';
  const hoverEventName = isMac ? 'mouseenter' : 'pointerenter';
  const appWindow = getCurrentWindow();
  const hitArea = root.querySelector('#pet-hit-area');
  const behaviorTracker = createBehaviorTracker({
    rapidWindowMs: PET_BEHAVIOR_CONFIG.chatter.rapidClickWindowMs
  });
  const behaviorAnalyzer = createBehaviorAnalyzer({
    rapidClickThreshold: PET_BEHAVIOR_CONFIG.chatter.rapidClickThreshold,
    idleReturnMs: 16_000,
    longIdleMs: PET_BEHAVIOR_CONFIG.chatter.longAbsenceMs,
    reminderIgnoredMs: 18_000,
    cooldowns: {
      rapidClick: 9_000,
      longIdle: 22_000,
      idleReturn: 14_000,
      reminderIgnored: 18_000
    }
  });
  const lineSelector = createLineSelector();
  const emotionState = createEmotionState();
  const interactionManager = createPetInteractionManager();
  const audioReactionHandler = createPetAudioReactionHandler();
  const weirdScheduler = createWeirdScheduler();
  const reminderStore = createReminderStore();
  let settings = { ...initialSettings };
  let currentTimeContext = createTimeContext();
  let lastSpokeAt = 0;
  let lastReminderAt = null;
  let pendingReaction = null;
  let pressTimer = null;
  let dragArmTimer = null;
  let activePress = null;
  let lastActivationAt = 0;
  let hoverPredictionCooldownUntil = 0;
  let lastSoundCategory = null;
  let microphoneStatus = MICROPHONE_STATUS.IDLE;

  const microphoneMonitor = createMicrophoneMonitor({
    sensitivity: settings.microphoneSensitivity,
    onStatusChange: handleMicrophoneStatusChange,
    onLevel: handleMicrophoneLevel
  });

  const reminderScheduler = createReminderScheduler({
    store: reminderStore,
    onReminderDue: handleReminderDue
  });

  const stateManager = new PetStateManager({
    getTimeContext: () => currentTimeContext,
    getReminderContext: () => ({
      nextReminder: settings.remindersEnabled ? reminderScheduler.getNextReminder() : null,
      lastReminderAt
    })
  });

  const weirdEventManager = createWeirdEventManager({
    scheduler: weirdScheduler,
    getContext: () => ({
      enabled: settings.weirdInteractions !== false,
      emotion: emotionState.emotion,
      state: stateManager.currentState,
      inReminderFlow: reminderCoolingDown(),
      isWakingFromSleep: stateManager.currentState === PET_STATES.SLEEP,
      clickThrough: settings.clickThrough === true
    }),
    canSpeak: () => canActVisibly() && !reminderCoolingDown(),
    speakText: (text, options) => speakText(text, options),
    speakCategory: (category, options) => speakCategory(category, options),
    getBehaviorSnapshot: (now) => behaviorTracker.getSnapshot(now)
  });

  function updateTimeAppearance() {
    root.dataset.period = currentTimeContext.period;
    root.dataset.emotion = emotionState.emotion;
  }

  function publishMicrophoneStatus() {
    void emit('tsurubami://microphone-status-updated', {
      status: microphoneStatus
    });
  }

  function handleMicrophoneStatusChange(payload) {
    microphoneStatus = payload?.status ?? MICROPHONE_STATUS.IDLE;
    publishMicrophoneStatus();
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

  function clearSoundReaction() {
    delete root.dataset.soundReaction;
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
      emotion: emotionState.emotion,
      ...options.context
    });
    speakText(text, options);
  }

  async function nudgeWindow(mode = 'move') {
    if (!canActVisibly()) return;

    const { maxStepX, maxStepY, idleStepX, idleStepY } = PET_BEHAVIOR_CONFIG.movement;
    const quietFactor = isQuietTime() ? 0.38 : 1;
    const activity = getActivityMultiplier();
    const stepX = mode === 'idle' ? idleStepX : maxStepX;
    const stepY = mode === 'idle' ? idleStepY : maxStepY;
    const modeFactor = mode === 'idle' ? 0.72 : 1;
    const dx = Math.round((-stepX + Math.random() * stepX * 2) * quietFactor * activity * modeFactor);
    const dy = Math.round((-stepY + Math.random() * stepY * 2) * quietFactor * activity * modeFactor);

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
    const emotionModifier = emotionState.getChatterModifier();

    if (sinceReminder < PET_BEHAVIOR_CONFIG.chatter.reminderCooldownMs) {
      speakCategory('postReminder', { duration: 2200 });
      return;
    }

    const passiveBehavior = behaviorAnalyzer.analyzePassive(behaviorTracker.getSnapshot(), {
      now: Date.now()
    });
    if (passiveBehavior) {
      emotionState.applyBehavior(passiveBehavior.key);
      root.dataset.emotion = emotionState.emotion;
      speakCategory(passiveBehavior.category, { duration: 2400 });
      return;
    }

    if (snapshot.timeContext.isMorning && Math.random() < 0.34 * activity * emotionModifier) {
      speakCategory('morningPrompt', { duration: 2200 });
      return;
    }

    if (snapshot.timeContext.isEvening && Math.random() < 0.3 * activity * emotionModifier) {
      speakCategory('eveningSoft', { duration: 2400 });
      return;
    }

    if (isQuietTime()) {
      speakCategory('lateNightConcern', { duration: 2500 });
      return;
    }

    speakCategory('idleMurmur', { duration: 2200 });
  }

  async function syncMicrophoneState({ requestPermission = false } = {}) {
    microphoneMonitor.setSensitivity(settings.microphoneSensitivity);

    if ((settings.microphoneEnabled !== true && !requestPermission) || settings.petVisible === false) {
      microphoneMonitor.stop();
      microphoneStatus = MICROPHONE_STATUS.IDLE;
      clearSoundReaction();
      publishMicrophoneStatus();
      return false;
    }

    const status = microphoneMonitor.getStatus();
    if (status === MICROPHONE_STATUS.LISTENING) {
      publishMicrophoneStatus();
      return true;
    }

    if (!requestPermission && status === MICROPHONE_STATUS.DENIED) {
      publishMicrophoneStatus();
      return false;
    }

    const started = await microphoneMonitor.start();
    microphoneStatus = microphoneMonitor.getStatus();
    publishMicrophoneStatus();
    return started;
  }

  function handleMicrophoneLevel(analysis) {
    if (settings.microphoneEnabled !== true || settings.petVisible === false) return;
    if (!analysis?.category) {
      lastSoundCategory = null;
      return;
    }

    if (analysis.category === lastSoundCategory && analysis.category !== 'loud') return;
    lastSoundCategory = analysis.category;

    const reaction = audioReactionHandler.handleSoundEvent({
      event: analysis.category,
      currentState: stateManager.currentState,
      isQuietTime: isQuietTime(),
      reminderCoolingDown: reminderCoolingDown(),
      level: analysis.level
    });

    if (!reaction || !canActVisibly()) return;

    root.dataset.soundReaction =
      reaction.bubbleKind === 'sound'
        ? 'voice'
        : reaction.bubbleKind === 'startled'
          ? 'loud'
          : 'soft';

    queueReaction({
      state: reaction.nextState,
      category: reaction.category,
      duration: reaction.duration,
      kind: reaction.bubbleKind
    });
    stateManager.markInteraction();
    stateManager.changeState(reaction.nextState, { duration: reaction.duration });
    window.setTimeout(() => {
      clearSoundReaction();
    }, reaction.duration + 240);
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
      void nudgeWindow('move');
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

    if (snapshot.state === PET_STATES.IDLE && snapshot.previousState !== PET_STATES.IDLE) {
      if (settings.weirdInteractions !== false) {
        if (weirdEventManager.maybeSoftInterrupt()) {
          return;
        }

        if (weirdEventManager.maybeLoopHint()) {
          return;
        }
      }

      const idleRoamChance = isQuietTime() ? 0.22 : 0.58;
      if (Math.random() < idleRoamChance) {
        void nudgeWindow('idle');
      }
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
    behaviorTracker.recordReminder(lastReminderAt);
    queueReaction({
      state: PET_STATES.TALK,
      text: buildReminderText(reminder),
      duration: 4200,
      kind: 'reminder'
    });
    stateManager.changeState(PET_STATES.TALK, { duration: 3200 });
    return true;
  }

  function handleActivate(event) {
    if ('button' in event && event.button !== 0) return;
    event.stopPropagation?.();
    event.preventDefault?.();

    const now = Date.now();
    if (now - lastActivationAt < 260) return;
    lastActivationAt = now;

    if (settings.weirdInteractions !== false && weirdEventManager.shouldIgnoreClick()) {
      behaviorTracker.recordInteraction('click', now);
      stateManager.markInteraction(now);
      return;
    }

    const behaviorSnapshot = behaviorTracker.getSnapshot(now);
    const behaviorReaction = behaviorAnalyzer.analyzeClick(behaviorSnapshot, { now });

    if (behaviorReaction) {
      emotionState.applyBehavior(behaviorReaction.key);
      root.dataset.emotion = emotionState.emotion;
      behaviorTracker.recordInteraction('click', now);
      stateManager.markInteraction(now);
      queueReaction({
        state: PET_STATES.TALK,
        category: behaviorReaction.category,
        duration: 2400,
        kind: 'normal',
        context: { timePeriod: currentTimeContext.period, emotion: emotionState.emotion }
      });
      stateManager.changeState(PET_STATES.TALK);
      return;
    }

    const weirdVariant =
      settings.weirdInteractions !== false ? weirdEventManager.handleClickVariant() : null;

    if (weirdVariant?.kind === 'fake-ignore') {
      behaviorTracker.recordInteraction('click', now);
      emotionState.soften();
      root.dataset.emotion = emotionState.emotion;
      stateManager.markInteraction(now);
      speakText(weirdVariant.immediateText, { duration: 2200 });
      return;
    }

    if (weirdVariant?.kind === 'delayed-response') {
      behaviorTracker.recordInteraction('click', now);
      emotionState.soften();
      root.dataset.emotion = emotionState.emotion;
      stateManager.markInteraction(now);
      weirdScheduler.schedule(weirdVariant.delay, () => {
        if (!canActVisibly() || reminderCoolingDown()) return;
        speakText(weirdVariant.delayedText, { duration: 1800 });
      });
      return;
    }

    const snapshot = stateManager.getSnapshot();
    const reaction = interactionManager.resolveClickReaction({
      state: snapshot.state,
      idleTimeMs: snapshot.idleTimeMs,
      timeContext: currentTimeContext,
      justTalked: now - lastSpokeAt < 5000,
      now
    });

    behaviorTracker.recordInteraction('click', now);
    emotionState.soften();
    root.dataset.emotion = emotionState.emotion;
    stateManager.markInteraction(now);
    queueReaction({
      state: reaction.nextState,
      category: reaction.category,
      duration: reaction.category === 'wakeUp' ? 2800 : 2400,
      kind: reaction.bubbleKind,
      context: { timePeriod: currentTimeContext.period }
    });
    stateManager.changeState(reaction.nextState);

    if (weirdVariant?.afterDefault) {
      weirdScheduler.schedule(weirdVariant.afterDefault.delay, () => {
        if (!canActVisibly() || reminderCoolingDown()) return;
        speakText(weirdVariant.afterDefault.text, { duration: 1600 });
      });
    }
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

  function containsPoint(element, x, y) {
    if (!element || root.hidden) return false;
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function clearPressState() {
    window.clearTimeout(pressTimer);
    window.clearTimeout(dragArmTimer);
    pressTimer = null;
    dragArmTimer = null;
    root.dataset.debugPressed = 'false';
    root.classList.remove('drag-arming');
    activePress = null;
  }

  function handleHoverPrediction() {
    const now = Date.now();
    if (now < hoverPredictionCooldownUntil) return;

    const prediction = weirdEventManager.handleHoverIntent();
    if (!prediction) return;

    hoverPredictionCooldownUntil = now + 6_000;
    speakText(prediction.immediateText, { duration: 1600 });
  }

  async function beginLongPressDrag() {
    if (!activePress || activePress.dragging) return;
    activePress.dragging = true;
    root.classList.remove('drag-arming');
    root.classList.add('dragging');

    try {
      await appWindow.startDragging();
      await saveWindowPosition();
    } catch (error) {
      console.warn('Failed to start dragging pet window.', error);
    } finally {
      root.classList.remove('dragging');
      clearPressState();
      stateManager.resume();
    }
  }

  document.addEventListener(
    downEventName,
    (event) => {
      if (event.button !== 0) return;

      const { clientX, clientY } = event;
      const settingsToggle = document.getElementById('settings-toggle');
      const settingsPanel = document.getElementById('settings-panel');
      const launcher = document.getElementById('pet-launcher');

      if (containsPoint(settingsToggle, clientX, clientY)) return;
      if (containsPoint(settingsPanel, clientX, clientY)) return;
      if (containsPoint(launcher, clientX, clientY)) return;
      if (!containsPoint(hitArea, clientX, clientY)) return;

      root.dataset.debugPressed = 'true';
      stateManager.markInteraction();
      stateManager.pause();
      activePress = {
        pointerId: 'pointerId' in event ? event.pointerId : 'mouse',
        startX: clientX,
        startY: clientY,
        dragging: false
      };
      dragArmTimer = window.setTimeout(() => {
        if (activePress && !activePress.dragging) {
          root.classList.add('drag-arming');
        }
      }, 150);
      pressTimer = window.setTimeout(() => {
        void beginLongPressDrag();
      }, 260);
    },
    true
  );

  hitArea?.addEventListener(hoverEventName, () => {
    handleHoverPrediction();
  });

  document.addEventListener(
    moveEventName,
    (event) => {
      if (containsPoint(hitArea, event.clientX, event.clientY)) {
        stateManager.markInteraction();
      }

      const eventPointerId = 'pointerId' in event ? event.pointerId : 'mouse';
      if (!activePress || activePress.pointerId !== eventPointerId || activePress.dragging) return;

      const deltaX = Math.abs(event.clientX - activePress.startX);
      const deltaY = Math.abs(event.clientY - activePress.startY);
      if (deltaX + deltaY > 10) {
        clearPressState();
        stateManager.resume();
      }
    },
    true
  );

  document.addEventListener(
    upEventName,
    (event) => {
      const eventPointerId = 'pointerId' in event ? event.pointerId : 'mouse';
      if (!activePress || activePress.pointerId !== eventPointerId) return;
      const wasDragging = activePress.dragging;
      clearPressState();
      stateManager.resume();
      if (!wasDragging) {
        handleActivate(event);
      }
    },
    true
  );

  document.addEventListener(
    cancelEventName,
    (event) => {
      const eventPointerId = event && 'pointerId' in event ? event.pointerId : 'mouse';
      if (!activePress || activePress.pointerId !== eventPointerId) return;
      clearPressState();
      stateManager.resume();
    },
    true
  );

    if (isMac) {
    document.addEventListener(
      'click',
      (event) => {
        if (event.button !== 0) return;

        const { clientX, clientY } = event;
        const settingsToggle = document.getElementById('settings-toggle');
        const launcher = document.getElementById('pet-launcher');

        if (containsPoint(settingsToggle, clientX, clientY)) return;
        if (containsPoint(launcher, clientX, clientY)) return;
        if (!containsPoint(hitArea, clientX, clientY)) return;

        handleActivate(event);
      },
      true
    );
  }

  window.addEventListener('keydown', () => {
    behaviorTracker.recordInteraction('keyboard');
    stateManager.markInteraction();
  });

  function startBehaviorLoop() {
    updateTimeAppearance();
    publishMicrophoneStatus();
    reminderScheduler.start();
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
    void syncMicrophoneState();
  }

  function stopBehaviorLoop() {
    unsubscribe();
    unwatchTimeContext();
    microphoneMonitor.stop();
    reminderScheduler.stop();
    stateManager.stop();
    weirdEventManager.clear();
  }

  return {
    startBehaviorLoop,
    stopBehaviorLoop,
    updateSettings(nextSettings) {
      settings = { ...settings, ...nextSettings };

      if (!settings.petVisible) {
        pendingReaction = null;
      }

      void syncMicrophoneState();
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
    replaceReminders(nextReminders) {
      reminderStore.replaceAll(nextReminders);
    },
    requestMicrophonePermission() {
      return syncMicrophoneState({ requestPermission: true });
    },
    getCurrentState: () => stateManager.currentState,
    getReminderList: () => reminderStore.list(),
    getSettings: () => ({ ...settings })
  };
}
