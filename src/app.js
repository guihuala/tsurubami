import { createBubbleController } from './bubble/bubble.js';
import { INTERACTION_MODE, forceInteractiveMode, setInteractionMode } from './interaction/interaction-mode.js';
import { createMenuController } from './menu/menu.js';
import { createPetController } from './pet/pet.js';
import { loadSettings, mergeSettings } from './settings/settings-store.js';
import { restoreWindowPosition } from './storage/position.js';
import { emit, listen } from '@tauri-apps/api/event';

export async function bootApp() {
  const app = document.getElementById('app');
  const root = document.getElementById('pet-root');
  const bubbleElement = document.getElementById('bubble');
  const settingsToggle = document.getElementById('settings-toggle');
  const launcher = document.getElementById('pet-launcher');
  const effects = document.getElementById('effects');
  const settingsRef = { current: loadSettings() };

  app.style.setProperty('background', 'transparent', 'important');
  app.style.setProperty('background-color', 'transparent', 'important');

  const bubble = createBubbleController(bubbleElement);
  let menuController;
  const pet = createPetController({
    root,
    bubble,
    effects,
    settings: settingsRef.current
  });
  window.__tsurubamiPet = pet;

  menuController = createMenuController({
    root,
    toggleButton: settingsToggle,
    launcher,
    bubble,
    pet,
    settingsRef,
    onSettingsChange: async (patch) => {
      settingsRef.current = mergeSettings(settingsRef.current, patch);
      menuController.applyExternalSettings(settingsRef.current);
      await emit('tsurubami://settings-updated', settingsRef.current);
    }
  });

  await listen('tsurubami://settings-updated', (event) => {
    if (!event.payload || typeof event.payload !== 'object') return;
    const previousClickThrough = settingsRef.current.clickThrough === true;
    settingsRef.current = {
      ...settingsRef.current,
      ...event.payload
    };
    menuController.applyExternalSettings(settingsRef.current);
    const nextClickThrough = settingsRef.current.clickThrough === true;

    if (previousClickThrough !== nextClickThrough) {
      bubble.show(nextClickThrough ? '现在你点不到我了。' : '可以继续碰我了。', 1800);
    }

    void setInteractionMode(nextClickThrough ? INTERACTION_MODE.PASSTHROUGH : INTERACTION_MODE.INTERACTIVE);
  });

  await listen('tsurubami://settings-command', async (event) => {
    if (!event.payload || typeof event.payload !== 'object') return;

    if (event.payload.type === 'test-reminder') {
      pet.triggerTestReminder();
    }
  });

  await listen('tsurubami://interaction-state-updated', async (event) => {
    if (!event.payload || typeof event.payload !== 'object') return;

    if (event.payload.clickThrough === false && settingsRef.current.clickThrough === true) {
      settingsRef.current = mergeSettings(settingsRef.current, { clickThrough: false });
      menuController.applyExternalSettings(settingsRef.current);
      await emit('tsurubami://settings-updated', settingsRef.current);
    }
  });

  await restoreWindowPosition();
  await setInteractionMode(settingsRef.current.clickThrough ? INTERACTION_MODE.PASSTHROUGH : INTERACTION_MODE.INTERACTIVE);

  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      void forceInteractiveMode();
    }
  });
  pet.startBehaviorLoop();
}
