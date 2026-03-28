import { invoke } from '@tauri-apps/api/core';

export async function saveWindowPosition() {
  await invoke('save_current_window_position');
}

export async function restoreWindowPosition() {
  await invoke('restore_window_position');
}

export async function resetWindowPosition() {
  await invoke('reset_window_position');
}
