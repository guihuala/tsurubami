import { createAudioAnalyzer } from './audio-analyzer.js';
import { MICROPHONE_STATUS } from './audio-types.js';

export function createMicrophoneMonitor({ sensitivity = 'medium', onLevel, onStatusChange } = {}) {
  const analyzer = createAudioAnalyzer(sensitivity);
  let audioContext = null;
  let analyserNode = null;
  let mediaStream = null;
  let sourceNode = null;
  let animationFrame = null;
  let currentStatus = MICROPHONE_STATUS.IDLE;
  let currentLevel = 0;

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
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

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
      currentLevel = analysis.level;

      onLevel?.({
        ...analysis,
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
    emitStatus(MICROPHONE_STATUS.IDLE);
  }

  function setSensitivity(nextSensitivity) {
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
