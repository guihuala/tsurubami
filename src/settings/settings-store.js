const SETTINGS_KEY = 'tsurubami-settings';

const DEFAULT_SETTINGS = {
  autoTalk: true,
  activityLevel: 'medium',
  nightMode: true,
  remindersEnabled: true,
  petVisible: true,
  microphoneEnabled: false,
  microphoneSensitivity: 'medium'
};

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(raw)
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function mergeSettings(currentSettings, nextSettings) {
  const merged = {
    ...currentSettings,
    ...nextSettings
  };

  saveSettings(merged);
  return merged;
}

export function getDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
}
