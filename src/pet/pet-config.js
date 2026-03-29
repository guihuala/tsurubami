export const PET_STATES = {
  IDLE: 'idle',
  MOVE: 'move',
  TALK: 'talk',
  SLEEP: 'sleep',
  SOUND_REACT: 'sound-react',
  STARTLED: 'startled'
};

export const PET_BEHAVIOR_CONFIG = {
  tickDurations: {
    idle: [2600, 5200],
    move: [1400, 2600],
    talk: [2000, 3400],
    sleep: [6200, 9800],
    'sound-react': [1100, 1800],
    startled: [1400, 2200]
  },
  sleep: {
    idleThresholdMs: 18000,
    deepIdleThresholdMs: 42000
  },
  movement: {
    maxStepX: 22,
    maxStepY: 10,
    idleStepX: 8,
    idleStepY: 4
  },
  chatter: {
    longAbsenceMs: 28000,
    rapidClickWindowMs: 1400,
    rapidClickThreshold: 3,
    reminderCooldownMs: 12000
  },
  reminder: {
    soonWindowMs: 90 * 1000
  },
  transitions: {
    morning: {
      idle: [
        { state: PET_STATES.MOVE, weight: 0.32 },
        { state: PET_STATES.TALK, weight: 0.34 },
        { state: PET_STATES.SLEEP, weight: 0.08 },
        { state: PET_STATES.IDLE, weight: 0.26 }
      ],
      move: [
        { state: PET_STATES.IDLE, weight: 0.42 },
        { state: PET_STATES.TALK, weight: 0.3 },
        { state: PET_STATES.MOVE, weight: 0.2 },
        { state: PET_STATES.SLEEP, weight: 0.08 }
      ],
      talk: [
        { state: PET_STATES.IDLE, weight: 0.48 },
        { state: PET_STATES.MOVE, weight: 0.28 },
        { state: PET_STATES.TALK, weight: 0.14 },
        { state: PET_STATES.SLEEP, weight: 0.1 }
      ],
      sleep: [
        { state: PET_STATES.IDLE, weight: 0.66 },
        { state: PET_STATES.TALK, weight: 0.18 },
        { state: PET_STATES.MOVE, weight: 0.12 },
        { state: PET_STATES.SLEEP, weight: 0.04 }
      ],
      'sound-react': [
        { state: PET_STATES.IDLE, weight: 0.58 },
        { state: PET_STATES.TALK, weight: 0.28 },
        { state: PET_STATES.MOVE, weight: 0.1 },
        { state: PET_STATES.SLEEP, weight: 0.04 }
      ],
      startled: [
        { state: PET_STATES.IDLE, weight: 0.52 },
        { state: PET_STATES.TALK, weight: 0.28 },
        { state: PET_STATES.MOVE, weight: 0.16 },
        { state: PET_STATES.SLEEP, weight: 0.04 }
      ]
    },
    afternoon: {
      idle: [
        { state: PET_STATES.MOVE, weight: 0.34 },
        { state: PET_STATES.TALK, weight: 0.26 },
        { state: PET_STATES.SLEEP, weight: 0.12 },
        { state: PET_STATES.IDLE, weight: 0.28 }
      ],
      move: [
        { state: PET_STATES.IDLE, weight: 0.5 },
        { state: PET_STATES.TALK, weight: 0.24 },
        { state: PET_STATES.MOVE, weight: 0.16 },
        { state: PET_STATES.SLEEP, weight: 0.1 }
      ],
      talk: [
        { state: PET_STATES.IDLE, weight: 0.52 },
        { state: PET_STATES.MOVE, weight: 0.22 },
        { state: PET_STATES.TALK, weight: 0.12 },
        { state: PET_STATES.SLEEP, weight: 0.14 }
      ],
      sleep: [
        { state: PET_STATES.IDLE, weight: 0.62 },
        { state: PET_STATES.MOVE, weight: 0.14 },
        { state: PET_STATES.TALK, weight: 0.12 },
        { state: PET_STATES.SLEEP, weight: 0.12 }
      ],
      'sound-react': [
        { state: PET_STATES.IDLE, weight: 0.62 },
        { state: PET_STATES.TALK, weight: 0.2 },
        { state: PET_STATES.MOVE, weight: 0.14 },
        { state: PET_STATES.SLEEP, weight: 0.04 }
      ],
      startled: [
        { state: PET_STATES.IDLE, weight: 0.56 },
        { state: PET_STATES.TALK, weight: 0.22 },
        { state: PET_STATES.MOVE, weight: 0.16 },
        { state: PET_STATES.SLEEP, weight: 0.06 }
      ]
    },
    evening: {
      idle: [
        { state: PET_STATES.MOVE, weight: 0.26 },
        { state: PET_STATES.TALK, weight: 0.24 },
        { state: PET_STATES.SLEEP, weight: 0.2 },
        { state: PET_STATES.IDLE, weight: 0.3 }
      ],
      move: [
        { state: PET_STATES.IDLE, weight: 0.52 },
        { state: PET_STATES.TALK, weight: 0.18 },
        { state: PET_STATES.MOVE, weight: 0.14 },
        { state: PET_STATES.SLEEP, weight: 0.16 }
      ],
      talk: [
        { state: PET_STATES.IDLE, weight: 0.58 },
        { state: PET_STATES.MOVE, weight: 0.18 },
        { state: PET_STATES.TALK, weight: 0.1 },
        { state: PET_STATES.SLEEP, weight: 0.14 }
      ],
      sleep: [
        { state: PET_STATES.IDLE, weight: 0.6 },
        { state: PET_STATES.MOVE, weight: 0.1 },
        { state: PET_STATES.TALK, weight: 0.1 },
        { state: PET_STATES.SLEEP, weight: 0.2 }
      ],
      'sound-react': [
        { state: PET_STATES.IDLE, weight: 0.66 },
        { state: PET_STATES.TALK, weight: 0.18 },
        { state: PET_STATES.MOVE, weight: 0.1 },
        { state: PET_STATES.SLEEP, weight: 0.06 }
      ],
      startled: [
        { state: PET_STATES.IDLE, weight: 0.62 },
        { state: PET_STATES.TALK, weight: 0.18 },
        { state: PET_STATES.MOVE, weight: 0.1 },
        { state: PET_STATES.SLEEP, weight: 0.1 }
      ]
    },
    lateNight: {
      idle: [
        { state: PET_STATES.MOVE, weight: 0.12 },
        { state: PET_STATES.TALK, weight: 0.12 },
        { state: PET_STATES.SLEEP, weight: 0.4 },
        { state: PET_STATES.IDLE, weight: 0.36 }
      ],
      move: [
        { state: PET_STATES.IDLE, weight: 0.56 },
        { state: PET_STATES.TALK, weight: 0.1 },
        { state: PET_STATES.MOVE, weight: 0.08 },
        { state: PET_STATES.SLEEP, weight: 0.26 }
      ],
      talk: [
        { state: PET_STATES.IDLE, weight: 0.48 },
        { state: PET_STATES.MOVE, weight: 0.08 },
        { state: PET_STATES.TALK, weight: 0.06 },
        { state: PET_STATES.SLEEP, weight: 0.38 }
      ],
      sleep: [
        { state: PET_STATES.IDLE, weight: 0.46 },
        { state: PET_STATES.MOVE, weight: 0.04 },
        { state: PET_STATES.TALK, weight: 0.06 },
        { state: PET_STATES.SLEEP, weight: 0.44 }
      ],
      'sound-react': [
        { state: PET_STATES.IDLE, weight: 0.62 },
        { state: PET_STATES.TALK, weight: 0.1 },
        { state: PET_STATES.MOVE, weight: 0.04 },
        { state: PET_STATES.SLEEP, weight: 0.24 }
      ],
      startled: [
        { state: PET_STATES.IDLE, weight: 0.56 },
        { state: PET_STATES.TALK, weight: 0.16 },
        { state: PET_STATES.MOVE, weight: 0.06 },
        { state: PET_STATES.SLEEP, weight: 0.22 }
      ]
    }
  }
};
