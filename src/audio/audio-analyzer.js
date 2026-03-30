import { SOUND_EVENT } from './audio-types.js';

const SENSITIVITY_PRESETS = {
  low: {
    soft: 0.09,
    voice: 0.16,
    loud: 0.28
  },
  medium: {
    soft: 0.06,
    voice: 0.11,
    loud: 0.2
  },
  high: {
    soft: 0.04,
    voice: 0.08,
    loud: 0.14
  }
};

export function createAudioAnalyzer(sensitivity = 'medium') {
  let currentSensitivity = sensitivity;

  function setSensitivity(nextSensitivity) {
    currentSensitivity = nextSensitivity in SENSITIVITY_PRESETS ? nextSensitivity : 'medium';
  }

  function getThresholds() {
    return SENSITIVITY_PRESETS[currentSensitivity] ?? SENSITIVITY_PRESETS.medium;
  }

  function getLevelFromTimeDomain(dataArray) {
    let sumSquares = 0;

    for (let i = 0; i < dataArray.length; i += 1) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }

    return Math.min(1, Math.sqrt(sumSquares / dataArray.length) * 2.4);
  }

  function classify(level) {
    const thresholds = getThresholds();

    if (level >= thresholds.loud) return SOUND_EVENT.LOUD;
    if (level >= thresholds.voice) return SOUND_EVENT.VOICE;
    if (level >= thresholds.soft) return SOUND_EVENT.SOFT;
    return null;
  }

  function analyze(dataArray) {
    const level = getLevelFromTimeDomain(dataArray);
    return classifyLevel(level);
  }

  function classifyLevel(level) {
    const thresholds = getThresholds();

    return {
      level,
      speaking: level >= thresholds.voice,
      loud: level >= thresholds.loud,
      category: classify(level)
    };
  }

  return {
    analyze,
    classifyLevel,
    setSensitivity
  };
}
