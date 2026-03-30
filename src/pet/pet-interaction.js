import { PET_STATES } from './pet-config.js';

export function createPetInteractionManager() {
  function resolveClickReaction({
    state,
    timeContext,
    justTalked
  }) {
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
