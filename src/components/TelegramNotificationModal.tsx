import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings,
  HelpCircle,
  ExternalLink,
  Trash2,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  Bot,
  Search,
  Check,
  Users,
} from 'lucide-react';
import { TelegramSettings, TelegramNotificationLog } from '../types';
import {
  getTelegramSettings,
  saveTelegramSettings,
  getTelegramLogs,
  checkTelegramStatus,
  sendTestTelegramMessage,
  saveTelegramChatId,
  detectTelegramChats,
} from '../services/telegramService';

interface TelegramNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TelegramNotificationModal({
  isOpen,
  onClose,
}: TelegramNotificationModalProps) {
  const [settings, setSettings] = useState<TelegramSettings>(getTelegramSettings);
  const [logs, setLogs] = useState<TelegramNotificationLog[]>([]);
  const [status, setStatus] = useState<{
    isConfigured: boolean;
    chatId: string;
    hasToken: boolean;
    botUsername?: string;
    botName?: string;
    botTokenMasked?: string;
    chatTitle?: string;
  }>({
    isConfigured: false,
    chatId: 'កំពុងពិនិត្យ...',
    hasToken: false,
  });

  const [chatInput, setChatInput] = useState('');
  const [isSavingChat, setIsSavingChat] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedChats, setDetectedChats] = useState<Array<{
    id: string;
    title: string;
    type: string;
  }>>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'logs' | 'guide'>('settings');

  useEffect(() => {
    if (isOpen) {
      setSettings(getTelegramSettings());
      setLogs(getTelegramLogs());
      fetchStatus();
      setTestResult(null);
      setHasSearched(false);
    }
  }, [isOpen]);

  const fetchStatus = async () => {
    const s = await checkTelegramStatus();
    setStatus(s);
    if (s.chatId && s.chatId !== 'មិនទាន់កំណត់' && s.chatId !== 'កំពុងពិនិត្យ...') {
      setChatInput(s.chatId);
    }
  };

  const handleSaveChatId = async (customId?: string) => {
    const targetId = (customId || chatInput).trim();
    if (!targetId) {
      setTestResult({
        success: false,
        message: 'សូមបញ្ចូលលេខសម្គាល់ Telegram Chat ID ជាមុនសិន។',
      });
      return;
    }

    setIsSavingChat(true);
    setTestResult(null);
    const res = await saveTelegramChatId({ chatId: targetId });
    setIsSavingChat(false);

    if (res.success) {
      setTestResult({
        success: true,
        message: `បានរក្សាទុក Chat ID (${targetId}) ដោយជោគជ័យ!`,
      });
      await fetchStatus();
    } else {
      setTestResult({
        success: false,
        message: res.error || 'បរាជ័យក្នុងការរក្សាទុក Chat ID',
      });
    }
  };

  const handleDetectChats = async () => {
    setIsDetecting(true);
    setHasSearched(true);
    setTestResult(null);
    const res = await detectTelegramChats();
    setIsDetecting(false);

    if (res.success) {
      setDetectedChats(res.chats || []);
      if (res.chats && res.chats.length > 0) {
        setTestResult({
          success: true,
          message: `បានរកឃើញ Group ចំនួន ${res.chats.length}។ សូមជ្រើសរើស Group ខាងក្រោម។`,
        });
      }
    } else {
      setDetectedChats([]);
      setTestResult({
        success: false,
        message: res.error || 'បរាជ័យក្នុងការស្វែងរក Groups',
      });
    }
  };

  const handleSelectChat = async (chat: { id: string; title: string }) => {
    setChatInput(chat.id);
    await handleSaveChatId(chat.id);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await sendTestTelegramMessage(chatInput.trim() || undefined);
    setIsTesting(false);
    setTestResult(res);
    setLogs(getTelegramLogs());
    await fetchStatus();
  };

  if (!isOpen) return null;

  const handleToggleSetting = (key: keyof TelegramSettings) => {
    const updated = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(updated);
    saveTelegramSettings(updated);
  };

  const handleClearLogs = () => {
    localStorage.removeItem('school_telegram_logs');
    setLogs([]);
  };

  return (
    <div
      id="telegram-notification-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-gradient-to-r from-sky-950 via-slate-900 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-xs">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>ការជូនដំណឹងស្វ័យប្រវត្តិតាម Telegram</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    status.isConfigured
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {status.isConfigured ? 'Connected Live' : status.hasToken ? 'Token Ready (Need Chat ID)' : 'Simulation Mode'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                ជូនដំណឹងភ្លាមៗទៅក្រុមរដ្ឋបាលនៅពេលបុគ្គលិកចុះហត្ថលេខាចូល/ចេញ
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

        {/* SUB NAVIGATION TABS */}
        <div className="flex items-center gap-1 px-4 sm:px-5 pt-3 border-b border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition border-b-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-sky-500 text-sky-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>ការកំណត់ (Settings)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition border-b-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-sky-500 text-sky-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>ប្រវត្តិជូនដំណឹង ({logs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition border-b-2 cursor-pointer ${
              activeTab === 'guide'
                ? 'border-sky-500 text-sky-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>ការណែនាំតភ្ជាប់ (Guide)</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* STATUS BANNER */}
          <div
            className={`p-3 rounded-xl border flex items-start justify-between gap-3 flex-wrap ${
              status.isConfigured
                ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {status.isConfigured ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              )}
              <div className="text-xs space-y-0.5">
                <div className="font-bold flex items-center gap-1.5">
                  <span>
                    {status.isConfigured
                      ? 'Telegram Bot ត្រូវបានតភ្ជាប់ និងត្រៀមរួចរាល់'
                      : status.hasToken
                      ? 'Bot Token រួចរាល់! សូមកំណត់ ឬស្វែងរក Chat ID'
                      : 'ប្រព័ន្ធដំណើរការ Simulation Mode'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {status.isConfigured
                    ? `ក្រុម Telegram គោលដៅ៖ ${status.chatId}`
                    : `Bot @${status.botUsername || 'raukSchoolAttendanceBot'} បានត្រៀមរួចរាល់។ សូម Add Bot ចូល Group រួចជ្រើសរើស Chat ID។`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchStatus}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || (!chatInput.trim() && !status.chatId)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{isTesting ? 'កំពុងតេស្ត...' : 'តេស្តផ្ញើសារ'}</span>
              </button>
            </div>
          </div>

          {/* TEST RESULT TOAST */}
          {testResult && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 animate-in fade-in ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* TAB 1: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* BOT & CHAT SETUP CARD */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-400 flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{status.botName || 'attendanceBot'}</span>
                        <a
                          href={`https://t.me/${status.botUsername || 'raukSchoolAttendanceBot'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-sky-400 hover:text-sky-300 font-mono flex items-center gap-0.5"
                        >
                          <span>@{status.botUsername || 'raukSchoolAttendanceBot'}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Token បានតភ្ជាប់ ({status.botTokenMasked || '893825...-xk'})
                        </span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://t.me/${status.botUsername || 'raukSchoolAttendanceBot'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-sky-600/20 text-sky-300 hover:bg-sky-600/30 border border-sky-500/30 transition cursor-pointer"
                  >
                    <span>បើកក្នុង Telegram</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Chat ID Input & Action Buttons */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-sky-400" />
                      <span>Telegram Group / Chat ID គោលដៅ៖</span>
                    </label>
                    {status.isConfigured && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> រួចរាល់
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="ឧ. -100234567890 ឬ @group_username"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                    />

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveChatId()}
                        disabled={isSavingChat}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSavingChat ? 'រក្សាទុក...' : 'រក្សាទុក'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDetectChats}
                        disabled={isDetecting}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
                        title="ស្វែងរក Group ដែលបាន Add Bot ស្វ័យប្រវត្តិ"
                      >
                        <Search className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                        <span>{isDetecting ? 'ស្វែងរក...' : 'ស្វែងរក Group'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Auto-detected chats list */}
                {hasSearched && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 animate-in fade-in">
                    <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>លទ្ធផលស្វែងរកពី Telegram Bot API៖</span>
                      <span className="text-[10px] text-slate-400">({detectedChats.length} បានរកឃើញ)</span>
                    </div>

                    {detectedChats.length > 0 ? (
                      <div className="space-y-1.5">
                        {detectedChats.map((chat) => (
                          <div
                            key={chat.id}
                            className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>{chat.title}</span>
                                <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-400 uppercase">
                                  {chat.type}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-sky-400">
                                ID: {chat.id}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectChat(chat)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition cursor-pointer"
                            >
                              ជ្រើសរើស
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-[11px] text-slate-400 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                        <p className="font-semibold text-amber-300">
                          មិនទាន់ឃើញមាន Group ផ្ញើសារចូល Bot នៅឡើយទេ។
                        </p>
                        <p className="leading-relaxed">
                          ដើម្បីឱ្យប្រព័ន្ធស្វែងរកឃើញ សូមអនុវត្តតាមជំហានងាយៗ៖
                          <br />
                          ១. បើក Telegram រួចចុចលើ Bot: <a href="https://t.me/raukSchoolAttendanceBot" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">@raukSchoolAttendanceBot</a>
                          <br />
                          ២. បន្ថែម Bot ចូលទៅក្នុង Group Telegram របស់សាលា ឬចុច <code>/start</code>
                          <br />
                          ៣. បន្ទាប់មកចុចប៊ូតុង «<strong>ស្វែងរក Group</strong>» ម្តងទៀត។
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MASTER TOGGLE */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-sky-400" />
                    <span>ដំណើរការការជូនដំណឹងស្វ័យប្រវត្តិ (Auto-Notify)</span>
                  </span>
                  <p className="text-[11px] text-slate-400">
                    ផ្ញើសារស្វ័យប្រវត្តិទៅកាន់ក្រុម Telegram ភ្លាមៗពេលគ្រូ ឬបុគ្គលិកចុះហត្ថលេខា
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoNotify}
                    onChange={() => handleToggleSetting('autoNotify')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              {/* SHIFT SELECTION */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="text-xs font-semibold text-slate-300">
                  ជ្រើសរើសវេនដែលត្រូវផ្ញើដំណឹង៖
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Morning In */}
                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={settings.notifyMorningIn}
                      onChange={() => handleToggleSetting('notifyMorningIn')}
                      disabled={!settings.autoNotify}
                      className="rounded border-slate-700 text-sky-500 focus:ring-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-200">ពេលចូលធ្វើការព្រឹក (Morning In)</div>
                      <div className="text-[10px] text-slate-400">ចន្លោះម៉ោង ០៦:៣០ - ០៧:៣០ ព្រឹក</div>
                    </div>
                  </label>

                  {/* Morning Out */}
                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={settings.notifyMorningOut}
                      onChange={() => handleToggleSetting('notifyMorningOut')}
                      disabled={!settings.autoNotify}
                      className="rounded border-slate-700 text-sky-500 focus:ring-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-200">ពេលចេញពីធ្វើការព្រឹក (Morning Out)</div>
                      <div className="text-[10px] text-slate-400">ចន្លោះម៉ោង ១០:៣០ - ១១:៣០ ព្រឹក</div>
                    </div>
                  </label>

                  {/* Afternoon In */}
                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={settings.notifyAfternoonIn}
                      onChange={() => handleToggleSetting('notifyAfternoonIn')}
                      disabled={!settings.autoNotify}
                      className="rounded border-slate-700 text-sky-500 focus:ring-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-200">ពេលចូលធ្វើការរសៀល (Afternoon In)</div>
                      <div className="text-[10px] text-slate-400">ចន្លោះម៉ោង ០១:០០ - ០២:០០ រសៀល</div>
                    </div>
                  </label>

                  {/* Afternoon Out */}
                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={settings.notifyAfternoonOut}
                      onChange={() => handleToggleSetting('notifyAfternoonOut')}
                      disabled={!settings.autoNotify}
                      className="rounded border-slate-700 text-sky-500 focus:ring-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-200">ពេលចេញពីធ្វើការរសៀល (Afternoon Out)</div>
                      <div className="text-[10px] text-slate-400">ចន្លោះម៉ោង ០៤:៣០ - ០៥:៣០ ល្ងាច</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* EXTRA OPTIONS */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-slate-300">
                  ព័ត៌មានលម្អិតក្នុងសារ Telegram៖
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeGpsStatus}
                    onChange={() => handleToggleSetting('includeGpsStatus')}
                    disabled={!settings.autoNotify}
                    className="rounded border-slate-700 text-sky-500 focus:ring-0"
                  />
                  <span>បង្ហាញទីតាំង GPS (នៅក្នុង ឬក្រៅបរិវេណសាលា) ក្នុងសារ</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showSignatureConfirm}
                    onChange={() => handleToggleSetting('showSignatureConfirm')}
                    disabled={!settings.autoNotify}
                    className="rounded border-slate-700 text-sky-500 focus:ring-0"
                  />
                  <span>បញ្ជាក់ការចុះហត្ថលេខាឌីជីថលរួចរាល់ (Digital Signature Verified)</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: RECENT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">
                  កំណត់ត្រាការជូនដំណឹងចុងក្រោយ ({logs.length} សារ)៖
                </span>
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>លុបកំណត់ត្រា</span>
                  </button>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  មិនទាន់មានប្រវត្តិការជូនដំណឹងនៅឡើយទេ។
                  <br />
                  <span className="text-[11px] text-slate-500">
                    នៅពេលដែលបុគ្គលិកចុះហត្ថលេខាវត្តមាន ប្រព័ន្ធនឹងកត់ត្រាការជូនដំណឹងនៅទីនេះ។
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{log.staffName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-300">
                            {log.periodLabel}
                          </span>
                          <span
                            className={`text-[9.5px] px-1.5 py-0.2 rounded-full border ${
                              log.status === 'sent'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : log.status === 'simulated'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {log.status === 'sent'
                              ? 'បានផ្ញើជោគជ័យ'
                              : log.status === 'simulated'
                              ? 'Simulated'
                              : 'បរាជ័យ'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>ម៉ោង {log.timeStr}</span>
                          <span>•</span>
                          <span>{log.dateStr}</span>
                          {log.error && <span className="text-rose-400">({log.error})</span>}
                        </div>
                      </div>

                      <div className="text-right text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STEP-BY-STEP GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="bg-sky-950/20 border border-sky-800/30 rounded-xl p-3.5 space-y-2">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  <span>របៀបកំណត់ Telegram Bot និង Chat ID (រយៈពេល ១ នាទី)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Bot Token ត្រូវបានកំណត់ដោយស្វ័យប្រវត្តរួចរាល់ហើយ (<strong className="text-white">@{status.botUsername || 'raukSchoolAttendanceBot'}</strong>)។ អនុវត្តជំហានចុងក្រោយខាងក្រោម៖
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px]">
                      ១
                    </span>
                    <span>បើក Telegram ហើយ Add Bot ចូល Group សាលា</span>
                  </div>
                  <p className="text-slate-400 text-[11px] pl-6.5">
                    ចុចលើតំណភ្ជាប់ <a href={`https://t.me/${status.botUsername || 'raukSchoolAttendanceBot'}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-bold">@{status.botUsername || 'raukSchoolAttendanceBot'}</a> រួច Add Bot ចូលទៅក្នុង Group Telegram រដ្ឋបាលសាលារបស់លោកអ្នក។ កំណត់សិទ្ធិ Bot ជា <strong>Admin</strong>។
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px]">
                      ២
                    </span>
                    <span>ចុចប៊ូតុង «ស្វែងរក Group» ឬយក Chat ID</span>
                  </div>
                  <p className="text-slate-400 text-[11px] pl-6.5">
                    ត្រឡប់មកផ្ទាំងការកំណត់ (Settings) រួចចុចប៊ូតុង <strong>«ស្វែងរក Group»</strong> ប្រព័ន្ធនឹងចាប់យក Group នោះដោយស្វ័យប្រវត្តិ។ ឬលោកអ្នកអាចយក Chat ID ពី <code className="text-sky-300">@RawDataBot</code> ឬ <code className="text-sky-300">@userinfobot</code> មកបិទភ្ជាប់ (Paste) ដោយផ្ទាល់ក៏បាន។
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px]">
                      ៣
                    </span>
                    <span>តេស្តផ្ញើសារសាកល្បង</span>
                  </div>
                  <p className="text-slate-400 text-[11px] pl-6.5">
                    ចុចប៊ូតុង «<strong>តេស្តផ្ញើសារ</strong>» ដើម្បីផ្ញើសារស្វាគមន៍បញ្ជាក់ការតភ្ជាប់ទៅកាន់ Group Telegram ជាការស្រេច!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-4 sm:px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
            <span>គាំទ្រទាំងទូរស័ព្ទដៃ និងកុំព្យូទ័រ</span>
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
