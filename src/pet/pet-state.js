import { PET_BEHAVIOR_CONFIG, PET_STATES } from './pet-config.js';
import { resolveNextPetState } from './pet-behavior.js';
import { randomBetween } from '../utils/random.js';

export class PetStateManager {
  #config;
  #currentState = PET_STATES.IDLE;
  #timer = null;
  #listeners = new Set();
  #paused = false;
  #lastInteractionAt = Date.now();
  #timeContextProvider;
  #reminderContextProvider;

  constructor({
    config = PET_BEHAVIOR_CONFIG,
    getTimeContext,
    getReminderContext
  } = {}) {
    this.#config = config;
    this.#timeContextProvider = getTimeContext ?? (() => ({ period: 'afternoon', isLateNight: false }));
    this.#reminderContextProvider =
      getReminderContext ?? (() => ({ nextReminder: null, lastReminderAt: null }));
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

  markInteraction(at = Date.now()) {
    this.#lastInteractionAt = at;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    listener(this.getSnapshot(null));

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

    const timeContext = this.#timeContextProvider();
    const reminderContext = this.#reminderContextProvider();
    const nextState = resolveNextPetState({
      currentState: this.#currentState,
      timeContext,
      idleTimeMs: this.idleTimeMs,
      nextReminder: reminderContext.nextReminder,
      lastReminderAt: reminderContext.lastReminderAt,
      now: new Date()
    });

    this.changeState(nextState);
  }

  getSnapshot(previousState = this.#currentState) {
    const timeContext = this.#timeContextProvider();
    const reminderContext = this.#reminderContextProvider();

    return {
      state: this.#currentState,
      previousState,
      idleTimeMs: this.idleTimeMs,
      timeContext,
      nextReminder: reminderContext.nextReminder,
      lastReminderAt: reminderContext.lastReminderAt
    };
  }

  #emit(previousState) {
    const snapshot = this.getSnapshot(previousState);
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }

  #resolveDuration(state) {
    const [min, max] =
      this.#config.tickDurations[state] ?? this.#config.tickDurations[PET_STATES.IDLE];
    return randomBetween(min, max);
  }

  #scheduleNext(duration) {
    window.clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => {
      this.update();
    }, duration);
  }
}

export { PET_STATES };
