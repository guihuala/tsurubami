import { invoke } from '@tauri-apps/api/core';
import { resetWindowPosition, saveWindowPosition } from '../storage/position.js';

export function createMenuController({ root, menu, bubble }) {
  root.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    menu.hidden = !menu.hidden;
  });

  window.addEventListener('click', (event) => {
    if (!root.contains(event.target)) {
      menu.hidden = true;
    }
  });

  menu.addEventListener('click', async (event) => {
    const action = event.target?.dataset?.menuAction;
    if (!action) return;

    if (action === 'hello') {
      bubble.show('你好呀，今天也要加油噢。');
    }

    if (action === 'reset') {
      await resetWindowPosition();
      await saveWindowPosition();
      bubble.show('位置已经重置啦。');
    }

    if (action === 'quit') {
      await invoke('quit_app');
    }

    menu.hidden = true;
  });
}
