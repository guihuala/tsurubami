import { PET_BEHAVIOR_CONFIG } from './pet-config.js';

const PET_STATES = {
  IDLE: 'idle',
  MOVE: 'move',
  TALK: 'talk',
  SLEEP: 'sleep'
};

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function pickWeightedState(transitions) {
  const total = transitions.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;

  for (const item of transitions) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.state;
    }
  }

  return transitions[transitions.length - 1]?.state ?? PET_STATES.IDLE;
}

function cloneTransitions(transitions) {
  return transitions.map((item) => ({ ...item }));
}

export class PetStateManager {
  #config;
  #currentState = PET_STATES.IDLE;
  #timer = null;
  #listeners = new Set();
  #paused = false;
  #lastInteractionAt = Date.now();

  constructor(config = PET_BEHAVIOR_CONFIG) {
    this.#config = config;
  }

  get currentState() {
    return this.#currentState;
  }

  get idleTimeMs() {
    return Date.now() - this.#lastInteractionAt;
  }

  start() {
    this.#emit(null);
    this.#scheduleNext(this.#resolveDuration(this.#currentState));
  }

  stop() {
    window.clearTimeout(this.#timer);
    this.#timer = null;
  }

  pause() {
    this.#paused = true;
    window.clearTimeout(this.#timer);
    this.#timer = null;
  }

  resume() {
    if (!this.#paused) return;
    this.#paused = false;
    this.#scheduleNext(this.#resolveDuration(this.#currentState));
  }

  markInteraction() {
    this.#lastInteractionAt = Date.now();

    if (this.#currentState === PET_STATES.SLEEP) {
      this.changeState(PET_STATES.TALK, { duration: this.#resolveDuration(PET_STATES.TALK) });
    }
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    listener({
      state: this.#currentState,
      previousState: null,
      idleTimeMs: this.idleTimeMs
    });

    return () => {
      this.#listeners.delete(listener);
    };
  }

  changeState(newState, options = {}) {
    if (!Object.values(PET_STATES).includes(newState)) return;

    const previousState = this.#currentState;
    this.#currentState = newState;
    this.#emit(previousState);

    if (this.#paused) return;

    window.clearTimeout(this.#timer);
    const duration = options.duration ?? this.#resolveDuration(newState);
    this.#scheduleNext(duration);
  }

  update() {
    if (this.#paused) return;
    const nextState = this.#pickNextState();
    this.changeState(nextState);
  }

  #pickNextState() {
    const baseTransitions =
      this.#config.transitions[this.#currentState] ?? this.#config.transitions.idle;
    const transitions = cloneTransitions(baseTransitions);
    const idleTimeMs = this.idleTimeMs;

    if (idleTimeMs >= this.#config.sleep.idleThresholdMs) {
      const sleepTransition = transitions.find((item) => item.state === PET_STATES.SLEEP);
      if (sleepTransition) {
        sleepTransition.weight += idleTimeMs >= this.#config.sleep.deepIdleThresholdMs ? 0.55 : 0.3;
      }
    }

    if (
      this.#currentState === PET_STATES.SLEEP &&
      idleTimeMs < this.#config.sleep.idleThresholdMs * 0.5
    ) {
      return PET_STATES.IDLE;
    }

    return pickWeightedState(transitions);
  }

  #resolveDuration(state) {
    const [min, max] =
      this.#config.tickDurations[state] ?? this.#config.tickDurations[PET_STATES.IDLE];
    return randomBetween(min, max);
  }

  #emit(previousState) {
    const payload = {
      state: this.#currentState,
      previousState,
      idleTimeMs: this.idleTimeMs
    };

    for (const listener of this.#listeners) {
      listener(payload);
    }
  }

  #scheduleNext(duration) {
    window.clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => {
      this.update();
    }, duration);
  }
}

export { PET_STATES };
