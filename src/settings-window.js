import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  createDemoReminders,
  createReminderDraft,
  getReminderNextTrigger,
  loadStoredReminderEntries,
  reviveReminder,
  saveReminderEntries
} from './reminder/reminder-store.js';
import { loadSettings, mergeSettings } from './settings/settings-store.js';

const appWindow = getCurrentWindow();
let settings = loadSettings();
let reminders = loadStoredReminderEntries();
let interactionState = {
  clickThrough: Boolean(settings.clickThrough)
};
let microphoneState = {
  status: settings.microphoneEnabled ? 'idle' : 'idle',
  level: 0
};

const togglePills = {
  autoTalk: document.getElementById('setting-auto-talk'),
  nightMode: document.getElementById('setting-night-mode'),
  remindersEnabled: document.getElementById('setting-reminders-enabled'),
  microphoneEnabled: document.getElementById('setting-microphone-enabled'),
  clickThrough: document.getElementById('setting-click-through'),
  weirdInteractions: document.getElementById('setting-weird-interactions')
};
const toggleRows = Array.from(document.querySelectorAll('.toggle-row'));

const segmentButtons = Array.from(document.querySelectorAll('.segment-button'));
const closeButton = document.getElementById('close-settings');
const interactionStatus = document.getElementById('interaction-status');
const restoreInteractionButton = document.getElementById('restore-interaction');
const microphoneStatus = document.getElementById('microphone-status');
const microphoneStatusNote = document.getElementById('microphone-status-note');
const requestMicrophoneButton = document.getElementById('request-microphone');
const reminderForm = document.getElementById('reminder-form');
const reminderEditId = document.getElementById('reminder-edit-id');
const reminderTextInput = document.getElementById('reminder-text');
const reminderScheduleTypeInput = document.getElementById('reminder-schedule-type');
const reminderTriggerAtInput = document.getElementById('reminder-trigger-at');
const reminderTimeOfDayInput = document.getElementById('reminder-time-of-day');
const reminderOnceField = document.getElementById('reminder-once-field');
const reminderDailyField = document.getElementById('reminder-daily-field');
const reminderSubmitButton = document.getElementById('reminder-submit');
const reminderCancelButton = document.getElementById('reminder-cancel');
const reminderFormNote = document.getElementById('reminder-form-note');
const reminderSummary = document.getElementById('reminder-summary');
const reminderFilterInput = document.getElementById('reminder-filter');
const restoreDemoRemindersButton = document.getElementById('restore-demo-reminders');
const reminderList = document.getElementById('reminder-list');
const reminderEmpty = document.getElementById('reminder-empty');

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未设置';

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatReminderMeta(reminder) {
  if (reminder.scheduleType === 'daily') {
    const nextTrigger = getReminderNextTrigger(reminder);
    const nextLabel = nextTrigger ? formatDateTime(nextTrigger) : '等待下一次触发';
    return `每天 ${reminder.timeOfDay} · 下次 ${nextLabel}`;
  }

  if (reminder.fired) {
    return reminder.lastTriggeredAt
      ? `一次性 · 已触发于 ${formatDateTime(reminder.lastTriggeredAt)}`
      : '一次性 · 已触发';
  }

  return `一次性 · ${formatDateTime(reminder.triggerAt)}`;
}

function getReminderState(reminder) {
  if (!reminder.enabled) {
    return { label: '已暂停', tone: 'muted', state: 'paused' };
  }

  if (reminder.scheduleType === 'daily') {
    return { label: '每日重复', tone: 'live', state: 'scheduled' };
  }

  if (reminder.fired) {
    return { label: '已完成', tone: 'muted', state: 'fired' };
  }

  const triggerAt = new Date(reminder.triggerAt);
  if (!Number.isNaN(triggerAt.getTime()) && triggerAt.getTime() <= Date.now()) {
    return { label: '等待调整', tone: 'warn', state: 'overdue' };
  }

  return { label: '待触发', tone: 'live', state: 'scheduled' };
}

function getMicrophoneUiState() {
  const status = microphoneState.status;

  if (!settings.microphoneEnabled) {
    return {
      mode: 'idle',
      label: '未开启',
      note: '开启后只做实时音量分析，不录音、不保存、不上传。',
      actionLabel: '请求麦克风权限',
      actionHidden: false
    };
  }

  if (status === 'requesting') {
    return {
      mode: 'requesting',
      label: '请求权限中',
      note: '系统可能会弹出麦克风权限窗口，请允许后再继续。',
      actionLabel: '正在请求…',
      actionHidden: false
    };
  }

  if (status === 'listening') {
    return {
      mode: 'listening',
      label: '监听中',
      note: '现在会根据环境声音做轻微反应。灵敏度越高，越容易触发。',
      actionLabel: '重新请求麦克风权限',
      actionHidden: false
    };
  }

  if (status === 'denied') {
    return {
      mode: 'denied',
      label: '权限被拒绝',
      note: '需要系统允许麦克风权限，开启后才能让桌宠听见周围的声音。',
      actionLabel: '重新请求麦克风权限',
      actionHidden: false
    };
  }

  if (status === 'timeout') {
    return {
      mode: 'error',
      label: '请求超时',
      note: '系统权限窗口似乎没有正常完成。开发环境下这类权限有时不稳定；如果一直不弹窗，建议先检查 macOS 的“系统设置 -> 隐私与安全性 -> 麦克风”，并优先用打包后的 app 再测一次。',
      actionLabel: '重新请求麦克风权限',
      actionHidden: false
    };
  }

  if (status === 'unsupported') {
    return {
      mode: 'unsupported',
      label: '当前环境不支持',
      note: '这个运行环境暂时无法访问麦克风。',
      actionLabel: '请求麦克风权限',
      actionHidden: true
    };
  }

  if (status === 'error') {
    return {
      mode: 'error',
      label: '初始化失败',
      note: '麦克风已开启，但初始化没有成功，可以再试一次。',
      actionLabel: '重新请求麦克风权限',
      actionHidden: false
    };
  }

  return {
    mode: 'idle',
    label: '等待开启',
    note: '开启后只做实时音量分析，不录音、不保存、不上传。',
    actionLabel: '请求麦克风权限',
    actionHidden: false
  };
}

function setReminderFormNote(message = '') {
  if (!reminderFormNote) return;
  reminderFormNote.hidden = !message;
  reminderFormNote.textContent = message;
}

function matchesReminderFilter(reminder, filterValue) {
  if (filterValue === 'enabled') return reminder.enabled;
  if (filterValue === 'daily') return reminder.scheduleType === 'daily';
  if (filterValue === 'once') return reminder.scheduleType === 'once';
  if (filterValue === 'completed') return reminder.scheduleType === 'once' && reminder.fired;
  return true;
}

function createActionButton(label, action, id, variant = 'ghost-button') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = variant;
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  return button;
}

function syncReminderFields() {
  const isDaily = reminderScheduleTypeInput?.value === 'daily';
  if (reminderOnceField) reminderOnceField.hidden = isDaily;
  if (reminderDailyField) reminderDailyField.hidden = !isDaily;
  if (reminderTriggerAtInput) reminderTriggerAtInput.required = !isDaily;
  if (reminderTimeOfDayInput) reminderTimeOfDayInput.required = isDaily;
}

function getReminderFormValue() {
  return {
    text: reminderTextInput.value.trim(),
    scheduleType: reminderScheduleTypeInput.value === 'daily' ? 'daily' : 'once',
    triggerAt: reminderTriggerAtInput.value,
    timeOfDay: reminderTimeOfDayInput.value || '09:00',
    enabled: true
  };
}

function ensureFutureOnceReminder(reminder) {
  if (reminder.scheduleType !== 'once') return reminder;

  const triggerAt = new Date(reminder.triggerAt);
  if (!Number.isNaN(triggerAt.getTime()) && triggerAt.getTime() > Date.now()) {
    return reminder;
  }

  const fallbackDraft = createReminderDraft();
  return {
    ...reminder,
    triggerAt: fallbackDraft.triggerAt
  };
}

function resetReminderForm() {
  const draft = createReminderDraft();
  reminderEditId.value = '';
  reminderTextInput.value = draft.text;
  reminderScheduleTypeInput.value = draft.scheduleType;
  reminderTriggerAtInput.value = draft.triggerAt;
  reminderTimeOfDayInput.value = draft.timeOfDay;
  reminderSubmitButton.textContent = '新增提醒';
  reminderCancelButton.hidden = true;
  setReminderFormNote('');
  syncReminderFields();
}

function fillReminderForm(reminder) {
  reminderEditId.value = reminder.id;
  reminderTextInput.value = reminder.text;
  reminderScheduleTypeInput.value = reminder.scheduleType;
  reminderTriggerAtInput.value = reminder.triggerAt?.slice(0, 16) ?? createReminderDraft().triggerAt;
  reminderTimeOfDayInput.value = reminder.timeOfDay ?? '09:00';
  reminderSubmitButton.textContent = '保存修改';
  reminderCancelButton.hidden = false;
  if (reminder.scheduleType === 'once') {
    const triggerAt = new Date(reminder.triggerAt);
    if (!Number.isNaN(triggerAt.getTime()) && triggerAt.getTime() <= Date.now()) {
      setReminderFormNote('这个一次性提醒的时间已经过去了，保存时会自动顺延到接下来的一小时后。');
    } else {
      setReminderFormNote('');
    }
  } else {
    setReminderFormNote('每日提醒会按你设置的时间每天重复触发。');
  }
  syncReminderFields();
  reminderTextInput.focus();
}

async function publishReminders() {
  reminders = saveReminderEntries(reminders);
  renderReminders();
  await emit('tsurubami://settings-command', {
    type: 'replace-reminders',
    reminders
  });
}

function renderReminders() {
  if (!reminderList || !reminderEmpty || !reminderSummary) return;

  reminderList.replaceChildren();
  const enabledCount = reminders.filter((reminder) => reminder.enabled).length;
  const dailyCount = reminders.filter((reminder) => reminder.scheduleType === 'daily').length;
  const filterValue = reminderFilterInput?.value ?? 'all';
  const visibleReminders = reminders.filter((reminder) => matchesReminderFilter(reminder, filterValue));
  reminderEmpty.hidden = visibleReminders.length > 0;
  reminderSummary.textContent =
    reminders.length > 0
      ? `共 ${reminders.length} 条提醒，已启用 ${enabledCount} 条，其中每日提醒 ${dailyCount} 条。`
      : '还没有提醒，可以先加一个。';
  if (reminders.length > 0 && visibleReminders.length === 0) {
    reminderEmpty.hidden = false;
    reminderEmpty.textContent = '当前筛选条件下没有提醒。';
  } else {
    reminderEmpty.textContent = '还没有提醒，可以先加一个。';
  }

  visibleReminders.forEach((reminder) => {
    const reminderState = getReminderState(reminder);
    const item = document.createElement('article');
    item.className = 'reminder-item';
    item.dataset.enabled = reminder.enabled ? 'true' : 'false';
    item.dataset.state = reminderState.state;

    const top = document.createElement('div');
    top.className = 'reminder-item-top';

    const content = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'reminder-title';
    title.textContent = reminder.text;
    const meta = document.createElement('div');
    meta.className = 'reminder-meta';
    meta.textContent = formatReminderMeta(reminder);
    content.append(title, meta);

    const tag = document.createElement('div');
    tag.className = 'reminder-tag';
    tag.dataset.tone = reminderState.tone;
    tag.textContent = reminderState.label;

    top.append(content, tag);

    const actions = document.createElement('div');
    actions.className = 'reminder-item-actions';
    actions.append(
      createActionButton(reminder.enabled ? '暂停' : '启用', 'toggle', reminder.id),
      createActionButton('编辑', 'edit', reminder.id),
      createActionButton('删除', 'delete', reminder.id)
    );

    item.append(top, actions);
    reminderList.append(item);
  });
}

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

  const microphoneUi = getMicrophoneUiState();
  if (microphoneStatus) {
    microphoneStatus.dataset.mode = microphoneUi.mode;
    microphoneStatus.textContent = microphoneUi.label;
  }
  if (microphoneStatusNote) {
    microphoneStatusNote.textContent = microphoneUi.note;
  }
  if (requestMicrophoneButton) {
    requestMicrophoneButton.hidden = microphoneUi.actionHidden;
    requestMicrophoneButton.textContent = microphoneUi.actionLabel;
    requestMicrophoneButton.disabled = microphoneUi.mode === 'requesting';
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
    const nextValue = !settings[key];
    await publish({ [key]: nextValue });

    if (key === 'microphoneEnabled' && nextValue === true) {
      microphoneState = {
        ...microphoneState,
        status: 'requesting'
      };
      refreshView();
      await emit('tsurubami://settings-command', { type: 'request-microphone' });
    }
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

requestMicrophoneButton?.addEventListener('pointerdown', async (event) => {
  event.preventDefault();
  if (!settings.microphoneEnabled) {
    await publish({ microphoneEnabled: true });
  }
  microphoneState = {
    ...microphoneState,
    status: 'requesting'
  };
  refreshView();
  await emit('tsurubami://settings-command', { type: 'request-microphone' });
});

reminderScheduleTypeInput?.addEventListener('change', () => {
  if (reminderScheduleTypeInput.value === 'daily') {
    setReminderFormNote('每日提醒会按你设置的时间每天重复触发。');
  } else {
    setReminderFormNote('');
  }
  syncReminderFields();
});

reminderFilterInput?.addEventListener('change', () => {
  renderReminders();
});

reminderForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const nextReminder = getReminderFormValue();
  if (!nextReminder.text) return;

  const editingId = reminderEditId.value;
  if (editingId) {
    reminders = reminders.map((item) =>
      item.id === editingId
        ? reviveReminder(
            ensureFutureOnceReminder({
              ...item,
              ...nextReminder,
              enabled: item.enabled
            })
          )
        : item
    );
  } else {
    reminders = reminders.concat(
      reviveReminder(
        ensureFutureOnceReminder({
          id: `reminder-${Date.now()}`,
          ...nextReminder
        })
      )
    );
  }

  await publishReminders();
  resetReminderForm();
});

reminderCancelButton?.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  resetReminderForm();
});

restoreDemoRemindersButton?.addEventListener('pointerdown', async (event) => {
  event.preventDefault();
  reminders = createDemoReminders();
  await publishReminders();
  resetReminderForm();
});

reminderList?.addEventListener('pointerdown', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  event.preventDefault();

  const { action, id } = button.dataset;
  const reminder = reminders.find((item) => item.id === id);
  if (!reminder) return;

  if (action === 'edit') {
    fillReminderForm(reminder);
    return;
  }

  if (action === 'toggle') {
    reminders = reminders.map((item) =>
      item.id === id
        ? reviveReminder({
            ...item,
            enabled: !item.enabled
          })
        : item
    );
    await publishReminders();
    return;
  }

  if (action === 'delete') {
    reminders = reminders.filter((item) => item.id !== id);
    await publishReminders();
    if (reminderEditId.value === id) {
      resetReminderForm();
    }
  }
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

async function init() {
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

  await listen('tsurubami://microphone-status-updated', (event) => {
    if (!event.payload || typeof event.payload !== 'object') return;
    microphoneState = {
      ...microphoneState,
      ...event.payload
    };
    refreshView();
  });

  interactionState = await invoke('get_interaction_state');

  resetReminderForm();
  renderReminders();
  refreshView();
}

void init();
