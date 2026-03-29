import { SOUND_EVENT } from '../audio/audio-types.js';
import { PET_STATES } from './pet-config.js';

const COOLDOWNS = {
  soft: 9000,
  voice: 11000,
  loud: 5000
};

export function createPetAudioReactionHandler() {
  const lastTriggeredAt = new Map();
  let lastVoiceWindowAt = 0;

  function handleSoundEvent({
    event,
    currentState,
    isQuietTime,
    now = Date.now(),
    reminderCoolingDown,
    level
  }) {
    if (!event || reminderCoolingDown) return null;
    if (isQuietTime && event === SOUND_EVENT.SOFT) return null;

    const previous = lastTriggeredAt.get(event) ?? 0;
    const cooldown = isQuietTime ? COOLDOWNS[event] * 1.8 : COOLDOWNS[event];
    if (now - previous < cooldown) return null;

    if (event === SOUND_EVENT.SOFT) {
      lastTriggeredAt.set(event, now);
      return {
        nextState: PET_STATES.SOUND_REACT,
        bubbleKind: 'soft',
        category: currentState === PET_STATES.SLEEP ? 'sleepyHeardNoise' : null,
        pose: 'listen',
        duration: 1500
      };
    }

    if (event === SOUND_EVENT.VOICE) {
      if (now - lastVoiceWindowAt < 4200) return null;
      lastVoiceWindowAt = now;
      lastTriggeredAt.set(event, now);
      const currentlyBusy = currentState === PET_STATES.TALK || currentState === PET_STATES.MOVE;
      return {
        nextState: PET_STATES.SOUND_REACT,
        bubbleKind: 'sound',
        category:
          currentState === PET_STATES.SLEEP
            ? 'sleepyHeardNoise'
            : currentlyBusy
              ? 'busyAmbientReaction'
              : 'heardSomething',
        pose: 'listen',
        duration: 2200,
        say: Math.random() < (isQuietTime ? 0.2 : 0.45)
      };
    }

    if (event === SOUND_EVENT.LOUD) {
      lastTriggeredAt.set(event, now);
      return {
        nextState: PET_STATES.STARTLED,
        bubbleKind: 'startled',
        category: currentState === PET_STATES.SLEEP ? 'sleepyHeardNoise' : 'startled',
        pose: 'startled',
        duration: 2100,
        say: true,
        wakeUp: currentState === PET_STATES.SLEEP,
        level
      };
    }

    return null;
  }

  return { handleSoundEvent };
}
