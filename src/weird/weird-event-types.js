export const WEIRD_EVENT_TYPE = {
  PREDICTION: 'prediction',
  DELAYED_RESPONSE: 'delayedResponse',
  FAKE_IGNORE: 'fakeIgnore',
  LOOP_HINT: 'loopHint',
  SOFT_INTERRUPT: 'softInterrupt'
};

export const WEIRD_EVENT_CONFIG = {
  probabilities: {
    prediction: 0.04,
    delayedResponse: 0.05,
    fakeIgnore: 0.03,
    loopHint: 0.02,
    softInterrupt: 0.03
  },
  cooldowns: {
    prediction: 75_000,
    delayedResponse: 90_000,
    fakeIgnore: 130_000,
    loopHint: 165_000,
    softInterrupt: 150_000
  },
  fakeIgnoreDuration: [5_000, 10_000],
  delayedResponseDelay: [500, 1_500],
  predictionFollowDelay: [300, 800],
  interruptFollowDelay: 500,
  activeOperationWindowMs: 26_000,
  activeOperationThreshold: 5
};
