import { PET_EMOTION } from '../emotion/emotion-state.js';
import { WEIRD_EVENT_CONFIG, WEIRD_EVENT_TYPE } from './weird-event-types.js';

function randomBetween([min, max]) {
  return Math.round(min + Math.random() * (max - min));
}

export function createWeirdEventManager({
  scheduler,
  getContext,
  canSpeak,
  speakText,
  speakCategory,
  getBehaviorSnapshot
}) {
  const lastTriggeredAt = new Map();
  let pendingPrediction = null;
  let fakeIgnoreUntil = 0;
  let fakeIgnoreReleaseTimer = null;

  function getModifier(emotion) {
    if (emotion === PET_EMOTION.ANNOYED) return 0.42;
    if (emotion === PET_EMOTION.WATCHING) return 1.12;
    if (emotion === PET_EMOTION.CALM) return 1;
    return 0.82;
  }

  function coolingDown(type, now) {
    const cooldown = WEIRD_EVENT_CONFIG.cooldowns[type] ?? 0;
    const lastAt = lastTriggeredAt.get(type) ?? 0;
    return now - lastAt < cooldown;
  }

  function mayTrigger(type, { now = Date.now(), probabilityOverride } = {}) {
    const context = getContext();
    if (!context.enabled || !canSpeak()) return false;
    if (context.inReminderFlow || context.isWakingFromSleep) return false;
    if (context.clickThrough) return false;
    if (coolingDown(type, now)) return false;

    const probability = probabilityOverride ?? WEIRD_EVENT_CONFIG.probabilities[type] ?? 0;
    return Math.random() < probability * getModifier(context.emotion);
  }

  function markTriggered(type, now = Date.now()) {
    lastTriggeredAt.set(type, now);
  }

  function handleHoverIntent() {
    const now = Date.now();
    const context = getContext();
    if (pendingPrediction || context.state === 'sleep') return null;
    if (!mayTrigger(WEIRD_EVENT_TYPE.PREDICTION, { now })) return null;

    pendingPrediction = {
      expiresAt: now + 4_500
    };
    markTriggered(WEIRD_EVENT_TYPE.PREDICTION, now);
    return {
      immediateText: '你会这么做吧。',
      followText: '果然。',
      followDelay: randomBetween(WEIRD_EVENT_CONFIG.predictionFollowDelay)
    };
  }

  function consumePredictionFollowup() {
    if (!pendingPrediction) return null;
    if (Date.now() > pendingPrediction.expiresAt) {
      pendingPrediction = null;
      return null;
    }

    pendingPrediction = null;
    return {
      text: '果然。',
      delay: randomBetween(WEIRD_EVENT_CONFIG.predictionFollowDelay)
    };
  }

  function handleClickVariant() {
    const now = Date.now();
    const context = getContext();
    if (context.state === 'sleep' || context.inReminderFlow || context.isWakingFromSleep) return null;

    const predictionFollow = consumePredictionFollowup();
    if (predictionFollow) {
      return {
        kind: 'prediction-follow',
        suppressDefault: false,
        afterDefault: predictionFollow
      };
    }

    if (mayTrigger(WEIRD_EVENT_TYPE.FAKE_IGNORE, { now })) {
      markTriggered(WEIRD_EVENT_TYPE.FAKE_IGNORE, now);
      const duration = randomBetween(WEIRD_EVENT_CONFIG.fakeIgnoreDuration);
      fakeIgnoreUntil = now + duration;
      scheduler.cancel(fakeIgnoreReleaseTimer);
      fakeIgnoreReleaseTimer = scheduler.schedule(duration, () => {
        fakeIgnoreUntil = 0;
        if (canSpeak()) {
          speakText('不过你还是这么做了。', { duration: 2600 });
        }
      });
      return {
        kind: 'fake-ignore',
        suppressDefault: true,
        immediateText: '随你吧，我不管了。'
      };
    }

    if (mayTrigger(WEIRD_EVENT_TYPE.DELAYED_RESPONSE, { now })) {
      markTriggered(WEIRD_EVENT_TYPE.DELAYED_RESPONSE, now);
      return {
        kind: 'delayed-response',
        suppressDefault: true,
        delayedText: Math.random() < 0.5 ? '嗯？' : '所以呢？',
        delay: randomBetween(WEIRD_EVENT_CONFIG.delayedResponseDelay)
      };
    }

    return null;
  }

  function shouldIgnoreClick() {
    return Date.now() < fakeIgnoreUntil;
  }

  function maybeLoopHint() {
    const now = Date.now();
    if (!mayTrigger(WEIRD_EVENT_TYPE.LOOP_HINT, { now })) return false;

    markTriggered(WEIRD_EVENT_TYPE.LOOP_HINT, now);
    if (Math.random() < 0.5) {
      speakText('这个发展……我好像见过。', { duration: 2600 });
      return true;
    }

    speakCategory('idleMurmur', { duration: 2300 });
    return true;
  }

  function maybeSoftInterrupt() {
    const now = Date.now();
    const snapshot = getBehaviorSnapshot(now);
    if (snapshot.recentClicks < WEIRD_EVENT_CONFIG.activeOperationThreshold && snapshot.rapidClickCount < 2) {
      return false;
    }

    if (snapshot.idleTime > WEIRD_EVENT_CONFIG.activeOperationWindowMs) {
      return false;
    }

    if (!mayTrigger(WEIRD_EVENT_TYPE.SOFT_INTERRUPT, { now })) return false;

    markTriggered(WEIRD_EVENT_TYPE.SOFT_INTERRUPT, now);
    speakText('等等。', { duration: 1200 });
    scheduler.schedule(WEIRD_EVENT_CONFIG.interruptFollowDelay, () => {
      if (canSpeak()) {
        speakText('没事，你继续。', { duration: 1800 });
      }
    });
    return true;
  }

  function clear() {
    pendingPrediction = null;
    fakeIgnoreUntil = 0;
    scheduler.cancel(fakeIgnoreReleaseTimer);
    fakeIgnoreReleaseTimer = null;
    scheduler.clearAll();
  }

  return {
    handleHoverIntent,
    handleClickVariant,
    shouldIgnoreClick,
    maybeLoopHint,
    maybeSoftInterrupt,
    clear
  };
}
