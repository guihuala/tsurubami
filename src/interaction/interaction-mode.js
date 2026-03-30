import { invoke } from '@tauri-apps/api/core';

export const INTERACTION_MODE = {
  INTERACTIVE: 'interactive',
  PASSTHROUGH: 'passthrough'
};

export function modeToClickThrough(mode) {
  return mode === INTERACTION_MODE.PASSTHROUGH;
}

export async function setInteractionMode(mode) {
  await invoke('set_click_through_mode', {
    enabled: modeToClickThrough(mode)
  });
}

export async function forceInteractiveMode() {
  await invoke('force_interactive_mode');
}

export async function getInteractionState() {
  return invoke('get_interaction_state');
}
