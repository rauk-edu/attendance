import {
  BrowserPushNotificationItem,
  PushNotificationSettings,
  DayAttendanceMap,
} from '../types';

const SETTINGS_KEY = 'school_push_notification_settings';
const HISTORY_KEY = 'school_push_notification_history';

export const DEFAULT_PUSH_SETTINGS: PushNotificationSettings = {
  enabled: true,
  soundEnabled: true,
  notifyOnSignature: true,
  notifyOnDataEdit: true,
  notifyOnLeaveRequest: true,
};

// ==========================================
// 1. SETTINGS & PERSISTENCE
// ==========================================

export function getPushSettings(): PushNotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_PUSH_SETTINGS;
    return { ...DEFAULT_PUSH_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PUSH_SETTINGS;
  }
}

export function savePushSettings(settings: PushNotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('school-push-settings-changed', { detail: settings }));
  } catch {
    // ignore
  }
}

export function getNotificationHistory(): BrowserPushNotificationItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveNotificationHistory(items: BrowserPushNotificationItem[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 60))); // store up to 60
    window.dispatchEvent(new CustomEvent('school-push-history-changed'));
  } catch {
    // ignore
  }
}

export function clearNotificationHistory(): void {
  saveNotificationHistory([]);
}

export function markAllNotificationsAsRead(): void {
  const list = getNotificationHistory().map((item) => ({ ...item, read: true }));
  saveNotificationHistory(list);
}

// ==========================================
// 2. WEB NOTIFICATION API & SOUND
// ==========================================

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return Notification.permission;
  }
}

/**
 * Web Audio API synthesizer for clean notification chime (No external mp3 required)
 */
export function playNotificationChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      // @ts-ignore
      window.webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First tone (G5 - 784Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second tone (C6 - 1046Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, now + 0.12);
    gain2.gain.setValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.debug('Audio chime skipped:', err);
  }
}

// ==========================================
// 3. SEND NOTIFICATION DISPATCHER
// ==========================================

export function sendBrowserPushNotification(
  payload: Omit<BrowserPushNotificationItem, 'id' | 'timestamp' | 'read'>
): BrowserPushNotificationItem | null {
  const settings = getPushSettings();

  // Check feature master switch
  if (!settings.enabled) return null;

  // Filter based on event type
  if (payload.type === 'signature' && !settings.notifyOnSignature) return null;
  if (payload.type === 'edit' && !settings.notifyOnDataEdit) return null;
  if (payload.type === 'leave' && !settings.notifyOnLeaveRequest) return null;

  const newItem: BrowserPushNotificationItem = {
    ...payload,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };

  // 1. Save to local history
  const history = getNotificationHistory();
  saveNotificationHistory([newItem, ...history]);

  // 2. Play sound chime if enabled
  if (settings.soundEnabled) {
    playNotificationChime();
  }

  // 3. Trigger Browser Web Notification if permission granted
  if (isNotificationSupported() && Notification.permission === 'granted') {
    try {
      const n = new Notification(payload.title, {
        body: payload.body,
        icon: 'https://api.iconify.design/lucide:school.svg?color=%230284c7',
        tag: `att-${Date.now()}`,
        // @ts-ignore
        renotify: true,
        silent: !settings.soundEnabled,
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.debug('Native browser notification display note:', e);
    }
  }

  // 4. Dispatch in-app DOM event for live toast banner in active view
  window.dispatchEvent(
    new CustomEvent('school-push-notification-received', {
      detail: newItem,
    })
  );

  return newItem;
}

// ==========================================
// 4. REALTIME CHANGE DETECTOR & NOTIFIER
// ==========================================

/**
 * Compares old attendance data vs new attendance data and automatically fires
 * notifications for new signatures or modified entries.
 */
export function detectAndNotifyAttendanceChanges(
  prevData: DayAttendanceMap | null | undefined,
  newData: DayAttendanceMap | null | undefined,
  contextNote?: string
): void {
  if (!prevData || !newData || Object.keys(prevData).length === 0) return;

  const staffNames = Array.from(new Set([...Object.keys(prevData), ...Object.keys(newData)]));

  for (const name of staffNames) {
    const oldRec = prevData[name] || {};
    const newRec = newData[name] || {};

    // Check Morning In signature
    if (!oldRec.m_in && newRec.m_in) {
      sendBrowserPushNotification({
        title: '✍️ បុគ្គលិកចុះហត្ថលេខាចូលធ្វើការ',
        body: `${name} បានចុះហត្ថលេខាចូលធ្វើការ (វេនព្រឹក) ម៉ោង ${newRec.m_in.time || 'ថ្មី'}`,
        type: 'signature',
        staffName: name,
        periodLabel: 'វេនព្រឹក - ចូល',
      });
    }

    // Check Morning Out signature
    if (!oldRec.m_out && newRec.m_out) {
      sendBrowserPushNotification({
        title: '✍️ បុគ្គលិកចុះហត្ថលេខាចេញ',
        body: `${name} បានចុះហត្ថលេខាចេញពីធ្វើការ (វេនព្រឹក) ម៉ោង ${newRec.m_out.time || 'ថ្មី'}`,
        type: 'signature',
        staffName: name,
        periodLabel: 'វេនព្រឹក - ចេញ',
      });
    }

    // Check Afternoon In signature
    if (!oldRec.a_in && newRec.a_in) {
      sendBrowserPushNotification({
        title: '✍️ បុគ្គលិកចុះហត្ថលេខាចូលធ្វើការ',
        body: `${name} បានចុះហត្ថលេខាចូលធ្វើការ (វេនរសៀល) ម៉ោង ${newRec.a_in.time || 'ថ្មី'}`,
        type: 'signature',
        staffName: name,
        periodLabel: 'វេនរសៀល - ចូល',
      });
    }

    // Check Afternoon Out signature
    if (!oldRec.a_out && newRec.a_out) {
      sendBrowserPushNotification({
        title: '✍️ បុគ្គលិកចុះហត្ថលេខាចេញ',
        body: `${name} បានចុះហត្ថលេខាចេញពីធ្វើការ (វេនរសៀល) ម៉ោង ${newRec.a_out.time || 'ថ្មី'}`,
        type: 'signature',
        staffName: name,
        periodLabel: 'វេនរសៀល - ចេញ',
      });
    }

    // Check Leave request / Leave Type change
    if (oldRec.leaveType !== newRec.leaveType && newRec.leaveType) {
      sendBrowserPushNotification({
        title: '📋 ពាក្យសុំច្បាប់ / អវត្តមានថ្មី',
        body: `${name}៖ បានស្នើសុំច្បាប់ ឬកត់ត្រាប្រភេទ "${newRec.leaveType}"`,
        type: 'leave',
        staffName: name,
      });
    }

    // Check Note / Annotation editing
    if (oldRec.note !== newRec.note && newRec.note && newRec.note !== oldRec.note) {
      sendBrowserPushNotification({
        title: '📝 មានការកែសម្រួលកំណត់ត្រាវត្តមាន',
        body: `${name}៖ "${newRec.note}"${contextNote ? ` (${contextNote})` : ''}`,
        type: 'edit',
        staffName: name,
      });
    }
  }
}
