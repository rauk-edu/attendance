import { useState, useEffect } from 'react';
import {
  X,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
  Settings,
  HelpCircle,
  ShieldCheck,
  Check,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import {
  PushNotificationSettings,
  BrowserPushNotificationItem,
} from '../types';
import {
  getPushSettings,
  savePushSettings,
  getNotificationHistory,
  clearNotificationHistory,
  markAllNotificationsAsRead,
  getNotificationPermission,
  requestNotificationPermission,
  sendBrowserPushNotification,
  playNotificationChime,
  isNotificationSupported,
} from '../services/notificationService';

interface PushNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PushNotificationModal({
  isOpen,
  onClose,
}: PushNotificationModalProps) {
  const [settings, setSettings] = useState<PushNotificationSettings>(getPushSettings);
  const [history, setHistory] = useState<BrowserPushNotificationItem[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [activeTab, setActiveTab] = useState<'settings' | 'history' | 'guide'>('settings');
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getPushSettings());
      setHistory(getNotificationHistory());
      setPermission(getNotificationPermission());
      markAllNotificationsAsRead();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof PushNotificationSettings) => {
    const updated = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(updated);
    savePushSettings(updated);
  };

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      sendBrowserPushNotification({
        title: '🔔 ប្រព័ន្ធជូនដំណឹងត្រូវបានបើក!',
        body: 'សាលាបឋមសិក្សា រោគ នឹងជូនដំណឹងភ្លាមៗនៅពេលមានការចុះហត្ថលេខា ឬកែប្រែទិន្នន័យ។',
        type: 'system',
      });
      setHistory(getNotificationHistory());
    }
  };

  const handleSendTest = () => {
    sendBrowserPushNotification({
      title: '🔔 តេស្ត Browser Push Notification',
      body: 'លោកគ្រូ-អ្នកគ្រូ បានចុះហត្ថលេខាវត្តមាន ឬកែប្រែទិន្នន័យជោគជ័យ!',
      type: 'test',
    });
    setHistory(getNotificationHistory());
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleClear = () => {
    clearNotificationHistory();
    setHistory([]);
  };

  return (
    <div
      id="push-notification-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xs">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Browser Push Notification (ការជូនដំណឹងក្នុងកម្មវិធីរុករក)</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                ជូនដំណឹងដល់អ្នកគ្រប់គ្រងភ្លាមៗនៅពេលមានបុគ្គលិកចុះវត្តមាន ឬកែប្រែទិន្នន័យ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-1 px-4 sm:px-5 pt-2.5 border-b border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition border-b-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-amber-500 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>ការកំណត់ (Settings)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition border-b-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>ប្រវត្តិដំណឹង ({history.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition border-b-2 cursor-pointer ${
              activeTab === 'guide'
                ? 'border-amber-500 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>ការណែនាំ (Guide)</span>
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* BROWSER PERMISSION BANNER */}
          <div
            className={`p-3 rounded-xl border flex items-start justify-between gap-3 flex-wrap ${
              permission === 'granted'
                ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                : permission === 'denied'
                ? 'bg-rose-950/30 border-rose-800/50 text-rose-200'
                : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {permission === 'granted' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              )}
              <div className="text-xs space-y-0.5">
                <div className="font-bold flex items-center gap-1.5">
                  <span>
                    {permission === 'granted'
                      ? 'សិទ្ធិ Browser Push Notification ត្រូវបានអនុញ្ញាត (Allowed) ✅'
                      : permission === 'denied'
                      ? 'សិទ្ធិត្រូវបានបិទក្នុង Browser Setting (Blocked)'
                      : 'មិនទាន់បានអនុញ្ញាតសិទ្ធិ Push Notification នៅឡើយទេ'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {permission === 'granted'
                    ? 'អ្នកនឹងទទួលបានការជូនដំណឹងពីលើ Desktop ឬទូរស័ព្ទដៃ ទោះបីកំពុងមើល Tab ផ្សេងក៏ដោយ។'
                    : permission === 'denied'
                    ? 'សូមចូលទៅកាន់សោរ URL ក្នុង Browser (Site Settings) ហើយប្តូរ Notifications ទៅជា "Allow"។'
                    : 'សូមចុចប៊ូតុង «បើកអនុញ្ញាត Notification» ដើម្បីឱ្យ Browser អាចបង្ហាញដំណឹងបាន។'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {permission !== 'granted' && isNotificationSupported() && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition cursor-pointer"
                >
                  <Bell className="w-3 h-3" />
                  <span>បើកអនុញ្ញាត Notification</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSendTest}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-xs transition cursor-pointer"
                title="សាកល្បងផ្ញើសារ Test និងចាក់សម្លេង"
              >
                <Send className="w-3 h-3 text-amber-400" />
                <span>{testSent ? 'បានតេស្ត!' : 'តេស្ត Notification'}</span>
              </button>
            </div>
          </div>

          {/* TAB 1: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-3.5">
              {/* MASTER SWITCH */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5 text-amber-400" />
                    <span>ដំណើរការប្រព័ន្ធជូនដំណឹង Push Notification</span>
                  </span>
                  <p className="text-[11px] text-slate-400">
                    បើក/បិទ ការចាប់សញ្ញា និងការជូនដំណឹងទាំងអស់នៅក្នុងកម្មវិធី
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={() => handleToggle('enabled')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* SOUND TOGGLE */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {settings.soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>សម្លេងរោទ៍ជូនដំណឹង (Audio Sound Chime)</span>
                  </span>
                  <p className="text-[11px] text-slate-400">
                    បន្លឺសម្លេងកណ្តឹងស្រាល ពេលមានដំណឹងថ្មី ដើម្បីដឹងភ្លាមៗទោះបីមិនបានសម្លឹងមើលអេក្រង់
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playNotificationChime()}
                    className="px-2 py-0.5 text-[10.5px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    ស្តាប់សម្លេង
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.soundEnabled}
                      onChange={() => handleToggle('soundEnabled')}
                      disabled={!settings.enabled}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>

              {/* EVENT FILTERS */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-slate-300">
                  ព្រឹត្តិការណ៍ដែលត្រូវជូនដំណឹងដល់អ្នកគ្រប់គ្រង៖
                </div>

                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={settings.notifyOnSignature}
                    onChange={() => handleToggle('notifyOnSignature')}
                    disabled={!settings.enabled}
                    className="rounded border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <div>
                    <div className="font-semibold text-slate-200">
                      ពេលបុគ្គលិកចុះហត្ថលេខាវត្តមាន (Sign Attendance)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ជូនដំណឹងភ្លាមៗនៅពេលមានគ្រូចុះហត្ថលេខា ចូល/ចេញ វេនព្រឹក ឬវេនរសៀល
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={settings.notifyOnDataEdit}
                    onChange={() => handleToggle('notifyOnDataEdit')}
                    disabled={!settings.enabled}
                    className="rounded border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <div>
                    <div className="font-semibold text-slate-200">
                      ពេលមានការកែប្រែកំណត់ត្រា ឬទិន្នន័យ (Data Edited)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ជូនដំណឹងនៅពេលមានការកែប្រែចំណាំ (Note) ឬប្តូរព័ត៌មានវត្តមាន
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={settings.notifyOnLeaveRequest}
                    onChange={() => handleToggle('notifyOnLeaveRequest')}
                    disabled={!settings.enabled}
                    className="rounded border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <div>
                    <div className="font-semibold text-slate-200">
                      ពេលមានពាក្យសុំច្បាប់ / អវត្តមាន (Leave Request)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ជូនដំណឹងនៅពេលមានគ្រូដាក់ច្បាប់ឈឺ ឬច្បាប់មានធុរៈផ្ទាល់ខ្លួន
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">
                  កំណត់ត្រាការជូនដំណឹងថ្ងៃនេះ ({history.length})៖
                </span>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>សម្អាតទាំងអស់</span>
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  មិនទាន់មានប្រវត្តិការជូនដំណឹងនៅឡើយទេ។
                  <br />
                  <span className="text-[11px] text-slate-500">
                    នៅពេលមានគ្រូចុះហត្ថលេខា ឬកែប្រែទិន្នន័យ ដំណឹងនឹងបង្ហាញនៅទីនេះ។
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <span>{item.title}</span>
                          {item.staffName && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {item.staffName}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300">{item.body}</p>
                      </div>

                      <div className="text-right text-[10px] text-slate-500 shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString('km-KH', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3 space-y-1.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>របៀបបើក Browser Notification លើទូរស័ព្ទ និងកុំព្យូទ័រ</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Browser Push Notification ដំណើរការបានលើ Google Chrome, Microsoft Edge, Safari (iOS 16.4+ / macOS) និង Android Browsers។
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <div className="font-semibold text-white flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                      ១
                    </span>
                    <span>នៅលើកុំព្យូទ័រ (Desktop Chrome / Edge / Firefox)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-5">
                    ពេលប្រព័ន្ធសួរ "Show notifications" សូមចុច <strong className="text-white">Allow</strong>។ ប្រសិនបើខកខាន សូមចុចលើរូបសោរនៅខាងឆ្វេង URL របារអាសយដ្ឋាន ហើយជ្រើសរើស <strong className="text-white">Notifications: Allow</strong>។
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <div className="font-semibold text-white flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                      ២
                    </span>
                    <span>នៅលើទូរស័ព្ទ Android (Chrome)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-5">
                    ចុចប៊ូតុង «បើកអនុញ្ញាត Notification» ខាងលើ ហើយចុច <strong className="text-white">Allow</strong>។ ដំណឹងនឹងរោទ៍ និងលោតពីលើអេក្រង់ដូចសារទូទៅ។
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <div className="font-semibold text-white flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                      ៣
                    </span>
                    <span>នៅលើ iPhone / iPad (iOS 16.4+)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-5">
                    ក្នុង Safari ចុចប៊ូតុង Share (រូបព្រួញចង្អុលឡើង) &gt; <strong className="text-white">Add to Home Screen (បន្ថែមទៅអេក្រង់ដើម)</strong>។ បន្ទាប់មកបើកកម្មវិធីពី Home Screen ដើម្បីទទួលបាន Push Notification ពេញលេញ។
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 sm:px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span>ស្វ័យប្រវត្តិតាមដានវត្តមានពេលវេលាជាក់ស្តែង (Realtime Push)</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
          >
            រួចរាល់
          </button>
        </div>
      </div>
    </div>
  );
}
