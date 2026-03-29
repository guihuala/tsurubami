export const PET_BEHAVIOR_CONFIG = {
  tickDurations: {
    idle: [2200, 4800],
    move: [1400, 2600],
    talk: [2000, 3400],
    sleep: [5200, 9000]
  },
  sleep: {
    idleThresholdMs: 18000,
    deepIdleThresholdMs: 42000
  },
  movement: {
    maxStepX: 22,
    maxStepY: 10
  },
  transitions: {
    idle: [
      { state: 'move', weight: 0.36 },
      { state: 'talk', weight: 0.26 },
      { state: 'sleep', weight: 0.18 },
      { state: 'idle', weight: 0.2 }
    ],
    move: [
      { state: 'idle', weight: 0.52 },
      { state: 'talk', weight: 0.24 },
      { state: 'move', weight: 0.14 },
      { state: 'sleep', weight: 0.1 }
    ],
    talk: [
      { state: 'idle', weight: 0.56 },
      { state: 'move', weight: 0.24 },
      { state: 'sleep', weight: 0.12 },
      { state: 'talk', weight: 0.08 }
    ],
    sleep: [
      { state: 'idle', weight: 0.64 },
      { state: 'move', weight: 0.16 },
      { state: 'talk', weight: 0.08 },
      { state: 'sleep', weight: 0.12 }
    ]
  }
};
