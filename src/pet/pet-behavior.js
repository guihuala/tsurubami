import { PET_BEHAVIOR_CONFIG, PET_STATES } from './pet-config.js';
import { pickWeighted } from '../utils/random.js';

function cloneTransitions(transitions) {
  return transitions.map((item) => ({ ...item }));
}

export function resolveNextPetState({
  currentState,
  timeContext,
  idleTimeMs,
  lastReminderAt,
  nextReminder,
  now = new Date()
}) {
  const period = timeContext.period;
  const transitionMap = PET_BEHAVIOR_CONFIG.transitions[period] ?? PET_BEHAVIOR_CONFIG.transitions.afternoon;
  const transitions = cloneTransitions(transitionMap[currentState] ?? transitionMap.idle);

  if (idleTimeMs >= PET_BEHAVIOR_CONFIG.sleep.idleThresholdMs) {
    adjustWeight(transitions, PET_STATES.SLEEP, idleTimeMs >= PET_BEHAVIOR_CONFIG.sleep.deepIdleThresholdMs ? 0.5 : 0.26);
  }

  if (period === 'lateNight') {
    adjustWeight(transitions, PET_STATES.TALK, -0.03);
    adjustWeight(transitions, PET_STATES.MOVE, -0.02);
  }

  const reminderDelta = nextReminder ? new Date(nextReminder.triggerTime).getTime() - now.getTime() : null;
  if (reminderDelta !== null && reminderDelta <= PET_BEHAVIOR_CONFIG.reminder.soonWindowMs) {
    adjustWeight(transitions, PET_STATES.TALK, -0.12);
    adjustWeight(transitions, PET_STATES.MOVE, -0.06);
    adjustWeight(transitions, PET_STATES.IDLE, 0.12);
  }

  if (lastReminderAt && now.getTime() - lastReminderAt < PET_BEHAVIOR_CONFIG.chatter.reminderCooldownMs) {
    adjustWeight(transitions, PET_STATES.TALK, -0.18);
    adjustWeight(transitions, PET_STATES.IDLE, 0.16);
  }

  if (
    currentState === PET_STATES.SLEEP &&
    idleTimeMs < PET_BEHAVIOR_CONFIG.sleep.idleThresholdMs * 0.45
  ) {
    return PET_STATES.IDLE;
  }

  return pickWeighted(
    transitions.map((item) => ({ value: item.state, weight: Math.max(item.weight, 0.01) })),
    PET_STATES.IDLE
  );
}

function adjustWeight(transitions, state, delta) {
  const target = transitions.find((item) => item.state === state);
  if (!target) return;
  target.weight = Math.max(0.01, target.weight + delta);
}
