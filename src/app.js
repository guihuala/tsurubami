import { createBubbleController } from './bubble/bubble.js';
import { bindDrag } from './interaction/drag.js';
import { createMenuController } from './menu/menu.js';
import { createPetController } from './pet/pet.js';
import { loadSettings } from './settings/settings-store.js';
import { restoreWindowPosition } from './storage/position.js';

export async function bootApp() {
  const app = document.getElementById('app');
  const root = document.getElementById('pet-root');
  const bubbleElement = document.getElementById('bubble');
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const launcher = document.getElementById('pet-launcher');
  const effects = document.getElementById('effects');
  const settingsRef = { current: loadSettings() };
  const audioStatusRef = {
    current: {
      status: settingsRef.current.microphoneEnabled ? 'idle' : 'idle',
      level: 0
    }
  };

  app.style.setProperty('background', 'transparent', 'important');
  app.style.setProperty('background-color', 'transparent', 'important');

  const bubble = createBubbleController(bubbleElement);
  const pet = createPetController({
    root,
    bubble,
    effects,
    settings: settingsRef.current,
    onAudioStatusChange: (status) => {
      audioStatusRef.current = status;
      menuController?.refresh();
    }
  });
  window.__tsurubamiPet = pet;

  bindDrag(root);
  const menuController = createMenuController({
    root,
    toggleButton: settingsToggle,
    panel: settingsPanel,
    launcher,
    bubble,
    pet,
    settingsRef,
    audioStatusRef
  });

  await restoreWindowPosition();
  pet.startBehaviorLoop();
}
