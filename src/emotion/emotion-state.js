export const PET_EMOTION = {
  CALM: 'calm',
  WATCHING: 'watching',
  BORED: 'bored',
  ANNOYED: 'annoyed'
};

const CHATTER_MODIFIER = {
  calm: 1,
  watching: 1.08,
  bored: 0.88,
  annoyed: 0.62
};

export function createEmotionState() {
  let currentEmotion = PET_EMOTION.CALM;

  function applyBehavior(behaviorKey) {
    if (behaviorKey === 'rapidClick' || behaviorKey === 'reminderIgnored') {
      currentEmotion = PET_EMOTION.ANNOYED;
      return currentEmotion;
    }

    if (behaviorKey === 'longIdle') {
      currentEmotion = PET_EMOTION.BORED;
      return currentEmotion;
    }

    if (behaviorKey === 'idleReturn') {
      currentEmotion = PET_EMOTION.WATCHING;
      return currentEmotion;
    }

    currentEmotion = PET_EMOTION.CALM;
    return currentEmotion;
  }

  function soften() {
    if (currentEmotion === PET_EMOTION.ANNOYED) {
      currentEmotion = PET_EMOTION.WATCHING;
      return currentEmotion;
    }

    if (currentEmotion === PET_EMOTION.BORED) {
      currentEmotion = PET_EMOTION.CALM;
      return currentEmotion;
    }

    return currentEmotion;
  }

  function getChatterModifier() {
    return CHATTER_MODIFIER[currentEmotion] ?? 1;
  }

  return {
    get emotion() {
      return currentEmotion;
    },
    applyBehavior,
    soften,
    getChatterModifier
  };
}
