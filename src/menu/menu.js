import { mergeSettings } from '../settings/settings-store.js';
import { resetWindowPosition, saveWindowPosition } from '../storage/position.js';

export function createMenuController({
  root,
  toggleButton,
  panel,
  launcher,
  bubble,
  pet,
  settingsRef,
  audioStatusRef
}) {
  const toggleInputs = Array.from(panel.querySelectorAll('input[data-setting-key]'));
  const segmentButtons = Array.from(panel.querySelectorAll('.segment-button'));
  const actionButtons = Array.from(panel.querySelectorAll('[data-settings-action]'));
  const microphoneStatus = panel.querySelector('#microphone-status');
  const microphoneStatusText = panel.querySelector('.microphone-status-text');

  function syncVisibility() {
    root.hidden = !settingsRef.current.petVisible;
    launcher.hidden = settingsRef.current.petVisible;
    toggleButton.hidden = !settingsRef.current.petVisible;
    panel.hidden = !settingsRef.current.petVisible || panel.hidden;
  }

  function syncInputs() {
    toggleInputs.forEach((input) => {
      input.checked = Boolean(settingsRef.current[input.dataset.settingKey]);
    });

    segmentButtons.forEach((button) => {
      const active = settingsRef.current[button.dataset.settingKey] === button.dataset.settingValue;
      button.dataset.active = active ? 'true' : 'false';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (microphoneStatus) {
      const statusMap = {
        idle: settingsRef.current.microphoneEnabled ? '待启动' : '未启用',
        requesting: '请求权限中',
        listening: '监听中',
        denied: '未授权',
        unsupported: '当前环境不支持',
        error: '启动失败'
      };

      const levelText =
        audioStatusRef.current?.status === 'listening'
          ? ` · 音量 ${Math.round((audioStatusRef.current.level ?? 0) * 100)}%`
          : '';
      const resolvedStatus = audioStatusRef.current?.status ?? 'idle';
      microphoneStatus.dataset.status = resolvedStatus;

      if (microphoneStatusText) {
        microphoneStatusText.textContent = `${statusMap[resolvedStatus] ?? '未启用'}${levelText}`;
      }
    }

    const visibilityButton = panel.querySelector('[data-settings-action="toggle-visibility"]');
    if (visibilityButton) {
      visibilityButton.textContent = settingsRef.current.petVisible ? '隐藏桌宠' : '显示桌宠';
    }
  }

  function applySettings(nextSettings, feedback) {
    settingsRef.current = mergeSettings(settingsRef.current, nextSettings);
    pet.updateSettings(settingsRef.current);
    syncInputs();
    syncVisibility();

    if (feedback) {
      bubble.show(feedback, 2200);
    }
  }

  function openPanel() {
    if (!settingsRef.current.petVisible) return;
    syncInputs();
    panel.hidden = false;
  }

  function closePanel() {
    panel.hidden = true;
  }

  toggleButton.addEventListener('click', () => {
    if (panel.hidden) {
      openPanel();
      return;
    }

    closePanel();
  });

  root.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    toggleButton.click();
  });

  launcher.addEventListener('click', () => {
    applySettings({ petVisible: true }, '我回来啦。');
    openPanel();
  });

  window.addEventListener('click', (event) => {
    if (panel.hidden) return;
    if (panel.contains(event.target) || root.contains(event.target)) return;
    closePanel();
  });

  toggleInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.settingKey;
      const value = input.checked;
      const feedbackByKey = {
        autoTalk: value ? '那我继续陪你碎碎念。' : '好，我安静一点陪着你。',
        nightMode: value ? '深夜我会更轻一点。' : '好，夜里我也照常活动。',
        remindersEnabled: value ? '提醒重新打开啦。' : '提醒先帮你关掉了。',
        microphoneEnabled: value ? '那我开始留意周围的声音。' : '好，我先把耳朵收起来。'
      };

      applySettings({ [key]: value }, feedbackByKey[key] ?? '设置已更新。');
    });
  });

  segmentButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.settingValue;
      const textMap = {
        low: '那我今天收敛一点点。',
        medium: '保持刚刚好的陪伴节奏。',
        high: '好，我今天会活跃一点。'
      };

      const microphoneTextMap = {
        low: '那我就迟钝一点，别被小动静吓到。',
        medium: '这样听觉就刚刚好。',
        high: '好，我会对声音更敏感一点。'
      };

      applySettings(
        { [button.dataset.settingKey]: value },
        button.dataset.settingKey === 'microphoneSensitivity' ? microphoneTextMap[value] : textMap[value]
      );
    });
  });

  actionButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.settingsAction;

      if (action === 'test-reminder') {
        pet.triggerTestReminder();
        closePanel();
        return;
      }

      if (action === 'reset-position') {
        await resetWindowPosition();
        await saveWindowPosition();
        bubble.show('位置已经重置啦。', 2200);
        closePanel();
        return;
      }

      if (action === 'request-microphone') {
        const granted = await pet.requestMicrophonePermission();
        if (granted) {
          settingsRef.current = mergeSettings(settingsRef.current, { microphoneEnabled: true });
        }
        bubble.show(granted ? '我听见啦，现在会留意周围声音。' : '我还没拿到麦克风权限。', 2400);
        syncInputs();
        return;
      }

      if (action === 'toggle-visibility') {
        const nextVisible = !settingsRef.current.petVisible;
        applySettings(
          { petVisible: nextVisible },
          nextVisible ? '我又探头出来了。' : '那我先躲一下，有事再叫我。'
        );
        closePanel();
        return;
      }

      if (action === 'close') {
        closePanel();
        return;
      }
    });
  });

  syncInputs();
  syncVisibility();

  return { openPanel, closePanel, refresh: syncInputs };
}
