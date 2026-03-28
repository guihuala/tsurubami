import { getCurrentWindow } from '@tauri-apps/api/window';
import { saveWindowPosition } from '../storage/position.js';

const appWindow = getCurrentWindow();

export function bindDrag(root) {
  root.addEventListener('mousedown', async (event) => {
    if (event.button !== 0) return;
    root.classList.add('dragging');
    try {
      await appWindow.startDragging();
      await saveWindowPosition();
    } finally {
      root.classList.remove('dragging');
    }
  });
}
