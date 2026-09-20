import { TelegramSettings, TelegramNotificationLog } from '../types';

const SETTINGS_KEY = 'school_telegram_settings';
const LOGS_KEY = 'school_telegram_logs';

export const DEFAULT_TELEGRAM_SETTINGS: TelegramSettings = {
  autoNotify: true,
  notifyMorningIn: true,
  notifyMorningOut: true,
  notifyAfternoonIn: true,
  notifyAfternoonOut: true,
  includeGpsStatus: true,
  showSignatureConfirm: true,
};

export function getTelegramSettings(): TelegramSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_TELEGRAM_SETTINGS;
    return { ...DEFAULT_TELEGRAM_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TELEGRAM_SETTINGS;
  }
}

export function saveTelegramSettings(settings: TelegramSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function getTelegramLogs(): TelegramNotificationLog[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addTelegramLog(log: Omit<TelegramNotificationLog, 'id' | 'timestamp'>): TelegramNotificationLog {
  const newLog: TelegramNotificationLog = {
    ...log,
    id: `tg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  try {
    const current = getTelegramLogs();
    const updated = [newLog, ...current].slice(0, 50); // Keep last 50
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }

  return newLog;
}

export async function checkTelegramStatus(): Promise<{
  isConfigured: boolean;
  chatId: string;
  hasToken: boolean;
  botUsername?: string;
  botName?: string;
  botTokenMasked?: string;
  chatTitle?: string;
}> {
  try {
    const res = await fetch('/api/telegram/status');
    if (!res.ok) throw new Error('Status check failed');
    return await res.json();
  } catch {
    return { isConfigured: false, chatId: 'មិនទាន់កំណត់', hasToken: false };
  }
}

export async function saveTelegramChatId(params: {
  chatId: string;
  chatTitle?: string;
  botToken?: string;
}): Promise<{ success: boolean; error?: string; config?: any }> {
  try {
    const res = await fetch('/api/telegram/save-chat-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'បរាជ័យក្នុងការរក្សាទុក Chat ID' };
  }
}

export async function detectTelegramChats(): Promise<{
  success: boolean;
  chats: Array<{ id: string; title: string; type: string; date?: number }>;
  botUsername?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/telegram/detect-chats');
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      chats: [],
      error: err.message || 'បរាជ័យក្នុងការស្វែងរក Groups',
    };
  }
}

export interface SendAttendanceAlertParams {
  staffName: string;
  staffGender?: string;
  staffPosition?: string;
  staffClass?: string;
  periodLabel: string;
  colIndex: number;
  timeStr: string;
  dateStr: string;
  khmerDateStr: string;
  gpsDistance?: number | null;
  gpsStatus?: string;
  schoolName?: string;
}

export async function sendAttendanceTelegramAlert(
  params: SendAttendanceAlertParams,
  settings: TelegramSettings = getTelegramSettings()
): Promise<{
  success: boolean;
  mode: 'telegram_live' | 'simulated' | 'disabled' | 'skipped' | 'telegram_error';
  message: string;
  preview?: string;
}> {
  // Check if autoNotify is disabled
  if (!settings.autoNotify) {
    return {
      success: true,
      mode: 'disabled',
      message: 'ការជូនដំណឹងស្វ័យប្រវត្តិតាម Telegram ត្រូវបានបិទ (Disabled in Settings)',
    };
  }

  // Check specific column filters
  if (params.colIndex === 0 && !settings.notifyMorningIn) {
    return { success: true, mode: 'skipped', message: 'រំលងការជូនដំណឹងវេនព្រឹកចូល' };
  }
  if (params.colIndex === 1 && !settings.notifyMorningOut) {
    return { success: true, mode: 'skipped', message: 'រំលងការជូនដំណឹងវេនព្រឹកចេញ' };
  }
  if (params.colIndex === 2 && !settings.notifyAfternoonIn) {
    return { success: true, mode: 'skipped', message: 'រំលងការជូនដំណឹងវេនរសៀលចូល' };
  }
  if (params.colIndex === 3 && !settings.notifyAfternoonOut) {
    return { success: true, mode: 'skipped', message: 'រំលងការជូនដំណឹងវេនរសៀលចេញ' };
  }

  try {
    const res = await fetch('/api/telegram/notify-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = (await res.json()) as any;

    if (!res.ok || !data.success) {
      const errMsg = data.error || 'បរាជ័យក្នុងការផ្ញើដំណឹងទៅ Telegram';
      addTelegramLog({
        staffName: params.staffName,
        staffPosition: params.staffPosition,
        periodLabel: params.periodLabel,
        timeStr: params.timeStr,
        dateStr: params.dateStr,
        status: 'failed',
        error: errMsg,
      });

      return {
        success: false,
        mode: 'telegram_error',
        message: errMsg,
      };
    }

    const mode = data.mode || (data.simulated ? 'simulated' : 'telegram_live');

    addTelegramLog({
      staffName: params.staffName,
      staffPosition: params.staffPosition,
      periodLabel: params.periodLabel,
      timeStr: params.timeStr,
      dateStr: params.dateStr,
      status: mode === 'telegram_live' ? 'sent' : 'simulated',
      messagePreview: data.preview,
    });

    return {
      success: true,
      mode,
      message:
        mode === 'telegram_live'
          ? `📢 បានផ្ញើដំណឹងទៅក្រុម Telegram រួចរាល់!`
          : `📢 បានកត់ត្រាការជូនដំណឹង (${params.staffName} ${params.periodLabel})`,
      preview: data.preview,
    };
  } catch (err: any) {
    const errMsg = err?.message || 'មានបញ្ហាក្នុងការតភ្ជាប់';
    addTelegramLog({
      staffName: params.staffName,
      staffPosition: params.staffPosition,
      periodLabel: params.periodLabel,
      timeStr: params.timeStr,
      dateStr: params.dateStr,
      status: 'failed',
      error: errMsg,
    });

    return {
      success: false,
      mode: 'telegram_error',
      message: errMsg,
    };
  }
}

export async function sendTestTelegramMessage(chatId?: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/telegram/test-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatId ? { chatId } : {}),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.error || 'បរាជ័យក្នុងការតេស្ត Telegram Bot',
        error: data.error,
      };
    }

    return {
      success: true,
      message: data.message || 'បានផ្ញើសារតេស្តទៅកាន់ Telegram រួចរាល់!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'មានបញ្ហាក្នុងការទាក់ទងម៉ាស៊ីនបម្រើ',
      error: err.message,
    };
  }
}
