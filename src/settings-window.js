import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { loadSettings, mergeSettings } from './settings/settings-store.js';

const appWindow = getCurrentWindow();
let settings = loadSettings();
let interactionState = {
  clickThrough: Boolean(settings.clickThrough)
};

const togglePills = {
  autoTalk: document.getElementById('setting-auto-talk'),
  nightMode: document.getElementById('setting-night-mode'),
  remindersEnabled: document.getElementById('setting-reminders-enabled'),
  clickThrough: document.getElementById('setting-click-through'),
  weirdInteractions: document.getElementById('setting-weird-interactions')
};
const toggleRows = Array.from(document.querySelectorAll('.toggle-row'));

const segmentButtons = Array.from(document.querySelectorAll('.segment-button'));
const closeButton = document.getElementById('close-settings');
const interactionStatus = document.getElementById('interaction-status');
const restoreInteractionButton = document.getElementById('restore-interaction');

function refreshView() {
  Object.entries(togglePills).forEach(([key, pill]) => {
    if (!pill) return;
    const enabled = Boolean(settings[key]);
    pill.dataset.checked = enabled ? 'true' : 'false';
    const row = document.querySelector(`[data-toggle-key="${key}"]`);
    if (row) {
      row.dataset.checked = enabled ? 'true' : 'false';
      row.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }
  });

  segmentButtons.forEach((button) => {
    const active = settings[button.dataset.settingKey] === button.dataset.settingValue;
    button.dataset.active = active ? 'true' : 'false';
  });

  const visibilityButton = document.querySelector('[data-action="toggle-visibility"]');
  if (visibilityButton) {
    visibilityButton.textContent = settings.petVisible ? '隐藏桌宠' : '显示桌宠';
  }

  if (interactionStatus) {
    const mode = interactionState.clickThrough ? 'click-through' : 'interactive';
    interactionStatus.dataset.mode = mode;
    interactionStatus.textContent = interactionState.clickThrough ? '点击穿透' : '可交互';
  }

  if (restoreInteractionButton) {
    restoreInteractionButton.hidden = !interactionState.clickThrough;
  }
}

async function publish(nextSettings) {
  settings = mergeSettings(settings, nextSettings);
  refreshView();
  await emit('tsurubami://settings-updated', settings);
}

toggleRows.forEach((row) => {
  row.addEventListener('pointerdown', async (event) => {
    event.preventDefault();
    const key = row.dataset.toggleKey;
    if (!key) return;

    await publish({ [key]: !settings[key] });
  });
});

segmentButtons.forEach((button) => {
  button.addEventListener('pointerdown', async (event) => {
    event.preventDefault();
    await publish({ [button.dataset.settingKey]: button.dataset.settingValue });
  });
});

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('pointerdown', async (event) => {
    event.preventDefault();
    const action = button.dataset.action;

    if (action === 'test-reminder') {
      await emit('tsurubami://settings-command', { type: 'test-reminder' });
      return;
    }

    if (action === 'reset-position') {
      await invoke('reset_window_position');
      return;
    }

    if (action === 'toggle-visibility') {
      await publish({ petVisible: !settings.petVisible });
    }
  });
});

closeButton?.addEventListener('pointerdown', async (event) => {
  event.preventDefault();
  await appWindow.close();
});

restoreInteractionButton?.addEventListener('pointerdown', async (event) => {
  event.preventDefault();
  await publish({ clickThrough: false });
});

window.addEventListener('keydown', async (event) => {
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    await publish({ clickThrough: false });
  }
});

await listen('tsurubami://settings-updated', (event) => {
  if (!event.payload || typeof event.payload !== 'object') return;
  settings = {
    ...settings,
    ...event.payload
  };
  refreshView();
});

await listen('tsurubami://interaction-state-updated', (event) => {
  if (!event.payload || typeof event.payload !== 'object') return;
  interactionState = {
    ...interactionState,
    ...event.payload
  };
  if (interactionState.clickThrough === false && settings.clickThrough === true) {
    settings = mergeSettings(settings, { clickThrough: false });
  }
  refreshView();
});

interactionState = await invoke('get_interaction_state');

refreshView();
