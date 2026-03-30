import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

export function createMenuController({
  root,
  toggleButton,
  launcher,
  bubble,
  pet,
  settingsRef,
  onSettingsChange
}) {
  const isMac = /Mac|iPhone|iPad|iPod/.test(window.navigator.userAgent);
  const pressEventName = isMac ? 'mousedown' : 'pointerdown';
  const contextMenu = document.getElementById('pet-context-menu');
  const contextToggleMode = document.getElementById('pet-context-toggle-mode');
  const contextOpenSettings = document.getElementById('pet-context-open-settings');
  const openState = {
    lastOpenAt: 0
  };

  function containsPoint(element, x, y) {
    if (!element || element.hidden) return false;
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  async function openSettingsWindow() {
    try {
      await invoke('open_settings_window');
    } catch (error) {
      console.warn('Failed to open settings window.', error);
      bubble.show('设置窗口没能打开。', 1800);
    }
  }

  function updateToggleVisibility() {
    toggleButton.hidden = !settingsRef.current.petVisible;
  }

  function updateContextMenu() {
    if (!contextToggleMode) return;
    contextToggleMode.textContent = settingsRef.current.clickThrough ? '恢复为可交互' : '切换为点击穿透';
  }

  function openGuard() {
    const now = Date.now();
    if (now - openState.lastOpenAt < 260) return false;
    openState.lastOpenAt = now;
    return true;
  }

  function syncVisibility() {
    root.hidden = !settingsRef.current.petVisible;
    launcher.hidden = settingsRef.current.petVisible;
    updateToggleVisibility();
    updateContextMenu();
  }

  function applyExternalSettings(nextSettings) {
    settingsRef.current = { ...settingsRef.current, ...nextSettings };
    pet.updateSettings(settingsRef.current);
    syncVisibility();
  }

  async function commitSettings(nextPatch) {
    if (onSettingsChange) {
      await onSettingsChange(nextPatch);
      return;
    }

    settingsRef.current = { ...settingsRef.current, ...nextPatch };
    applyExternalSettings(settingsRef.current);
    await emit('tsurubami://settings-updated', settingsRef.current);
  }

  function hideContextMenu() {
    if (!contextMenu) return;
    contextMenu.hidden = true;
  }

  function showContextMenu(clientX, clientY) {
    if (!contextMenu) return;
    updateContextMenu();
    const menuWidth = 166;
    const menuHeight = 88;
    const maxX = Math.max(8, window.innerWidth - menuWidth - 8);
    const maxY = Math.max(8, window.innerHeight - menuHeight - 8);
    contextMenu.style.left = `${Math.min(clientX, maxX)}px`;
    contextMenu.style.top = `${Math.min(clientY, maxY)}px`;
    contextMenu.hidden = false;
  }

  async function handleDocumentOpen(event) {
    const { clientX, clientY } = event;

    if (containsPoint(toggleButton, clientX, clientY)) {
      if (!openGuard()) return;
      event.preventDefault();
      event.stopPropagation();
      hideContextMenu();
      await openSettingsWindow();
      return;
    }

    if (containsPoint(launcher, clientX, clientY)) {
      if (!openGuard()) return;
      event.preventDefault();
      event.stopPropagation();
      applyExternalSettings({ petVisible: true });
      bubble.show('我回来啦。', 1800);
      hideContextMenu();
      await openSettingsWindow();
      return;
    }

    if (!containsPoint(contextMenu, clientX, clientY)) {
      hideContextMenu();
    }
  }

  document.addEventListener(
    pressEventName,
    (event) => {
      void handleDocumentOpen(event);
    },
    true
  );

  if (isMac) {
    document.addEventListener(
      'click',
      (event) => {
        void handleDocumentOpen(event);
      },
      true
    );
  }

  root.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY);
  });

  contextToggleMode?.addEventListener('pointerdown', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideContextMenu();
    await commitSettings({ clickThrough: !settingsRef.current.clickThrough });
  });

  contextOpenSettings?.addEventListener('pointerdown', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideContextMenu();
    await openSettingsWindow();
  });

  syncVisibility();

  return {
    refresh() {
      syncVisibility();
    },
    applyExternalSettings
  };
}
