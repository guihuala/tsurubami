import { PET_BEHAVIOR_CONFIG, PET_STATES } from './pet-config.js';

export function createPetInteractionManager() {
  let lastClickAt = 0;
  let rapidClickCount = 0;

  function registerClick(now = Date.now()) {
    if (now - lastClickAt <= PET_BEHAVIOR_CONFIG.chatter.rapidClickWindowMs) {
      rapidClickCount += 1;
    } else {
      rapidClickCount = 1;
    }

    lastClickAt = now;

    return {
      rapidClickCount,
      isRapid: rapidClickCount >= PET_BEHAVIOR_CONFIG.chatter.rapidClickThreshold
    };
  }

  function resolveClickReaction({
    state,
    idleTimeMs,
    timeContext,
    justTalked,
    now = Date.now()
  }) {
    const clickMeta = registerClick(now);

    if (clickMeta.isRapid) {
      return { category: 'rapidClick', nextState: PET_STATES.TALK, bubbleKind: 'normal' };
    }

    if (idleTimeMs >= PET_BEHAVIOR_CONFIG.chatter.longAbsenceMs) {
      return { category: 'longTimeNoSee', nextState: PET_STATES.TALK, bubbleKind: 'normal' };
    }

    if (state === PET_STATES.SLEEP) {
      return { category: 'wakeUp', nextState: PET_STATES.TALK, bubbleKind: 'normal' };
    }

    if (timeContext.isLateNight) {
      return { category: 'clickedSleepy', nextState: PET_STATES.TALK, bubbleKind: 'normal' };
    }

    if (justTalked) {
      return { category: 'clickedIdle', nextState: PET_STATES.TALK, bubbleKind: 'normal' };
    }

    return { category: 'clickedIdle', nextState: PET_STATES.TALK, bubbleKind: 'normal' };
  }

  return { resolveClickReaction };
}
