import { createAudioAnalyzer } from './audio-analyzer.js';
import { MICROPHONE_STATUS } from './audio-types.js';

const STABILITY_PRESETS = {
  low: {
    smoothing: 0.22,
    confirmFrames: {
      soft: 10,
      voice: 7,
      loud: 2
    }
  },
  medium: {
    smoothing: 0.28,
    confirmFrames: {
      soft: 7,
      voice: 5,
      loud: 2
    }
  },
  high: {
    smoothing: 0.36,
    confirmFrames: {
      soft: 5,
      voice: 4,
      loud: 2
    }
  }
};

const PERMISSION_TIMEOUT_MS = 8000;

export function createMicrophoneMonitor({ sensitivity = 'medium', onLevel, onStatusChange } = {}) {
  const analyzer = createAudioAnalyzer(sensitivity);
  let currentSensitivity = sensitivity in STABILITY_PRESETS ? sensitivity : 'medium';
  let audioContext = null;
  let analyserNode = null;
  let mediaStream = null;
  let sourceNode = null;
  let animationFrame = null;
  let currentStatus = MICROPHONE_STATUS.IDLE;
  let currentLevel = 0;
  let smoothedLevel = 0;
  let pendingCategory = null;
  let pendingFrames = 0;
  let emittedCategory = null;

  function getStabilityPreset() {
    return STABILITY_PRESETS[currentSensitivity] ?? STABILITY_PRESETS.medium;
  }

  function getConfirmedCategory(rawCategory) {
    if (!rawCategory) {
      pendingCategory = null;
      pendingFrames = 0;
      emittedCategory = null;
      return null;
    }

    if (pendingCategory !== rawCategory) {
      pendingCategory = rawCategory;
      pendingFrames = 1;
    } else {
      pendingFrames += 1;
    }

    const framesNeeded = getStabilityPreset().confirmFrames[rawCategory] ?? 1;
    if (pendingFrames < framesNeeded) {
      return null;
    }

    if (emittedCategory === rawCategory) {
      return null;
    }

    emittedCategory = rawCategory;
    return rawCategory;
  }

  function emitStatus(status) {
    currentStatus = status;
    onStatusChange?.({
      status,
      level: currentLevel
    });
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      emitStatus(MICROPHONE_STATUS.UNSUPPORTED);
      return false;
    }

    if (currentStatus === MICROPHONE_STATUS.LISTENING) {
      return true;
    }

    emitStatus(MICROPHONE_STATUS.REQUESTING);

    try {
      mediaStream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        }),
        new Promise((_, reject) => {
          window.setTimeout(() => {
            const error = new Error('Microphone permission request timed out.');
            error.name = 'TimeoutError';
            reject(error);
          }, PERMISSION_TIMEOUT_MS);
        })
      ]);

      // We only analyze live amplitude in memory. No audio is recorded, saved, or uploaded.
      audioContext = new window.AudioContext();
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 1024;
      sourceNode = audioContext.createMediaStreamSource(mediaStream);
      sourceNode.connect(analyserNode);

      emitStatus(MICROPHONE_STATUS.LISTENING);
      listen();
      return true;
    } catch (error) {
      emitStatus(
        error?.name === 'NotAllowedError'
          ? MICROPHONE_STATUS.DENIED
          : error?.name === 'TimeoutError'
            ? MICROPHONE_STATUS.TIMEOUT
            : MICROPHONE_STATUS.ERROR
      );
      return false;
    }
  }

  function listen() {
    if (!analyserNode) return;

    const dataArray = new Uint8Array(analyserNode.fftSize);

    const tick = () => {
      if (!analyserNode) return;

      analyserNode.getByteTimeDomainData(dataArray);
      const analysis = analyzer.analyze(dataArray);
      const stability = getStabilityPreset();
      smoothedLevel += (analysis.level - smoothedLevel) * stability.smoothing;
      const smoothedAnalysis = analyzer.classifyLevel(smoothedLevel);
      currentLevel = smoothedLevel;
      const confirmedCategory = getConfirmedCategory(smoothedAnalysis.category);

      onLevel?.({
        ...smoothedAnalysis,
        rawCategory: analysis.category,
        rawLevel: analysis.level,
        category: confirmedCategory,
        status: currentStatus
      });

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
  }

  function stop() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    sourceNode?.disconnect();
    sourceNode = null;
    analyserNode?.disconnect?.();
    analyserNode = null;

    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;

    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close();
    }
    audioContext = null;

    currentLevel = 0;
    smoothedLevel = 0;
    pendingCategory = null;
    pendingFrames = 0;
    emittedCategory = null;
    emitStatus(MICROPHONE_STATUS.IDLE);
  }

  function setSensitivity(nextSensitivity) {
    currentSensitivity = nextSensitivity in STABILITY_PRESETS ? nextSensitivity : 'medium';
    analyzer.setSensitivity(nextSensitivity);
  }

  return {
    start,
    stop,
    setSensitivity,
    requestPermission: start,
    getStatus: () => currentStatus
  };
}
