import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  MessageSquare,
  FileText,
  Calendar,
  Send,
  Printer,
  Copy,
  Check,
  RefreshCw,
  User,
  Bot,
  HelpCircle,
  BookOpen,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  FileCheck,
} from 'lucide-react';
import { UserSession } from '../types';
import { STAFF_LIST, SCHOOL_NAME, SCHOOL_DISTRICT, SCHOOL_OFFICE, LEAVE_REGULATIONS, DISCIPLINE_SANCTIONS } from '../data/staff';
import HolidayNoticeGenerator from './HolidayNoticeGenerator';

interface SchoolAIAssistantProps {
  currentUser: UserSession;
  initialTab?: 'chat' | 'letter' | 'holiday';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  {
    category: 'ច្បាប់ & វិន័យ',
    icon: '⚖️',
    prompt: 'តើគ្រូបង្រៀនមានសិទ្ធិឈប់សម្រាកប្រចាំឆ្នាំ ច្បាប់ឈឺ និងច្បាប់ផ្ទាល់ខ្លួនប៉ុន្មានថ្ងៃ តាមអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក?',
  },
  {
    category: 'ដោះស្រាយអវត្តមាន',
    icon: '🚨',
    prompt: 'តើគណៈគ្រប់គ្រងសាលាត្រូវដោះស្រាយ និងចាត់ចែងបែបណាពេលមានគ្រូបង្រៀនអវត្តមានភ្លាមៗ ដោយមិនបានប្រាប់មុន?',
  },
  {
    category: 'ព្រាងលិខិតសុំច្បាប់',
    icon: '📄',
    prompt: 'សូមជួយរៀបចំគំរូពាក្យសុំច្បាប់ឈប់សម្រាកព្យាបាលជំងឺរយៈពេល ៣ ថ្ងៃ ជូននាយិកាសាលា។',
  },
  {
    category: 'លិខិតអញ្ជើញប្រជុំ',
    icon: '✉️',
    prompt: 'សូមជួយព្រាងលិខិតអញ្ជើញមាតាបិតា ឬអាណាព្យាបាលសិស្សចូលរួមប្រជុំពិគ្រោះយោបល់ការសិក្សារបស់សិស្ស។',
  },
  {
    category: 'របាយការណ៍បច្ចេកទេស',
    icon: '📊',
    prompt: 'របៀបរៀបចំរបាយការណ៍កិច្ចប្រជុំបច្ចេកទេសប្រចាំខែ និងការវាយតម្លៃលទ្ធផលការបង្រៀននៅសាលាបឋមសិក្សា។',
  },
];

export default function SchoolAIAssistant({ currentUser, initialTab = 'chat' }: SchoolAIAssistantProps) {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'letter' | 'holiday'>(initialTab);

  // --- CHAT STATE ---
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `ជម្រាបសួរ ${currentUser.name || 'លោកគ្រូ/អ្នកគ្រូ'}! ខ្ញុំគឺជា **AI ជំនួយការសាលារៀន** នៃ${SCHOOL_NAME}។\n\nខ្ញុំអាចជួយលោកគ្រូ-អ្នកគ្រូបានដូចជា៖\n- **ឆ្លើយសំណួរច្បាប់រដ្ឋបាលអប់រំ** និងបទបញ្ជាផ្ទៃក្នុងសាលា\n- **ផ្តល់ដំណោះស្រាយ** ពេលមានគ្រូអវត្តមាន ឬចាត់ចែងគ្រូបង្រៀនជំនួស\n- **ព្រាងលិខិតរដ្ឋបាលផ្លូវការ** (ពាក្យសុំច្បាប់, លិខិតបេសកកម្ម, លិខិតអញ្ជើញ)\n- **តាក់តែងសេចក្តីជូនដំណឹង** ថ្ងៃឈប់សម្រាកបុណ្យជាតិ\n\nតើខ្ញុំអាចជួយសម្រួលការងារអ្វីជូនលោកអ្នកនៅថ្ងៃនេះដែរ?`,
      timestamp: new Date().toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeSubTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeSubTab]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsChatLoading(true);

    try {
      // Build conversation payload
      const historyPayload = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyPayload,
          currentContext: {
            userName: currentUser.name,
            role: currentUser.role,
            schoolName: SCHOOL_NAME,
          },
        }),
      });

      const result = await response.json();
      if (result.success && result.reply) {
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: result.reply,
          timestamp: new Date().toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(result.error || 'មិនអាចទទួលបានចម្លើយពី AI');
      }
    } catch (err: any) {
      console.error('Error sending message to AI:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `សូមអភ័យទោស៖ ${err.message || 'មានបញ្ហាបច្ចេកទេសក្នុងការទាក់ទងជាមួយ AI'}\nសូមសាកល្បងសួរសារជាថ្មី។`,
        timestamp: new Date().toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const copyTextToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2500);
  };

  // --- LETTER DRAFTER STATE ---
  const [letterType, setLetterType] = useState<string>('leave_request');
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    currentUser.staffId || STAFF_LIST[0]?.id || ''
  );
  const [customRequesterName, setCustomRequesterName] = useState<string>('');
  const [letterRole, setLetterRole] = useState<string>('គ្រូបង្រៀន');
  const [letterReason, setLetterReason] = useState<string>('មានបញ្ហាសុខភាព (ផ្តាសាយធ្ងន់ធ្ងរ) ត្រូវការសម្រាកព្យាបាលតាមវេជ្ជបញ្ជា');
  const [letterDuration, setLetterDuration] = useState<string>('០៣ ថ្ងៃ');
  const [letterStartDate, setLetterStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [letterEndDate, setLetterEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [additionalNotes, setAdditionalNotes] = useState<string>('បានរៀបចំកិច្ចការផ្ទះ និងចាត់ចែងលោកគ្រូបង្រៀនថ្នាក់ក្បែរជួយមើលការខុសត្រូវ');
  const [isDrafting, setIsDrafting] = useState<boolean>(false);
  const [draftedLetter, setDraftedLetter] = useState<{ title: string; fullLetter: string } | null>(null);
  const [isLetterCopied, setIsLetterCopied] = useState<boolean>(false);

  // Sync staff selection
  useEffect(() => {
    const staff = STAFF_LIST.find((s) => s.id === selectedStaffId);
    if (staff) {
      setCustomRequesterName(staff.name);
      setLetterRole(staff.position || 'គ្រូបង្រៀន');
    }
  }, [selectedStaffId]);

  const handleGenerateLetter = async () => {
    setIsDrafting(true);
    try {
      const response = await fetch('/api/ai-draft-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          letterType,
          requesterName: customRequesterName || currentUser.name || 'លោកគ្រូ/អ្នកគ្រូ',
          role: letterRole,
          reason: letterReason,
          duration: letterDuration,
          startDate: letterStartDate,
          endDate: letterEndDate,
          additionalInfo: additionalNotes,
          schoolName: SCHOOL_NAME,
        }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        setDraftedLetter(result.data);
      } else {
        alert(result.error || 'បរាជ័យក្នុងការព្រាងលិខិត');
      }
    } catch (err: any) {
      console.error('Error drafting letter:', err);
      alert('មានបញ្ហាបច្ចេកទេសក្នុងការទាក់ទងជាមួយ AI');
    } finally {
      setIsDrafting(false);
    }
  };

  const handlePrintDraftedLetter = () => {
    if (!draftedLetter) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${draftedLetter.title}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@300;400;500;600;700&family=Moul&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 20mm; }
            body {
              font-family: 'Kantumruy Pro', sans-serif;
              color: #0f172a;
              line-height: 1.8;
              font-size: 14pt;
              margin: 0;
              padding: 10px;
            }
            .content {
              white-space: pre-wrap;
              text-align: justify;
            }
          </style>
        </head>
        <body>
          <div class="content">${draftedLetter.fullLetter}</div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/60 rounded-2xl p-5 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">AI ជំនួយការសាលារៀន (School AI Assistant)</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  Gemini 3.8
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                ជំនួយការវៃឆ្លាតសម្រាប់គណៈគ្រប់គ្រង និងលោកគ្រូ-អ្នកគ្រូ {SCHOOL_NAME}
              </p>
            </div>
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-indigo-900/50 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('chat')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeSubTab === 'chat'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-indigo-200 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>ជជែកសួរនាំ AI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('letter')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeSubTab === 'letter'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-indigo-200 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>ព្រាងលិខិតរដ្ឋបាល</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('holiday')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeSubTab === 'holiday'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-indigo-200 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>ជូនដំណឹងថ្ងៃបុណ្យ</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- MODE 1: AI CHAT --- */}
      {activeSubTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Quick Prompts Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-slate-800">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">សំណួរពេញនិយម</h3>
              </div>
              <div className="space-y-2">
                {QUICK_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    disabled={isChatLoading}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-100 hover:border-amber-400 hover:bg-amber-50/60 transition group text-xs text-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 group-hover:text-amber-700 mb-1">
                      <span>{item.icon}</span>
                      <span>{item.category}</span>
                    </div>
                    <p className="line-clamp-2 text-[11px] text-slate-500 group-hover:text-slate-700">
                      {item.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Regulatory Quick Fact Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50/80 rounded-2xl p-4 border border-indigo-100 text-xs text-slate-700 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>បទប្បញ្ញត្តិសំខាន់ៗ</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-indigo-950/80">
                <li>ច្បាប់ឈប់ប្រចាំឆ្នាំ៖ ១៥ ថ្ងៃ/ឆ្នាំ</li>
                <li>ច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ៖ ១២ ខែ</li>
                <li>ច្បាប់ឈប់សម្រាកមាតុភាព៖ ៣ ខែ</li>
                <li>ច្បាប់កិច្ចការផ្ទាល់ខ្លួន៖ ៣ ខែ</li>
              </ul>
            </div>
          </div>

          {/* Main Chat Interface */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
            {/* Chat Messages Area */}
            <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[85%] ${
                    msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-bold'
                    }`}
                  >
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-sm relative group ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                    <div
                      className={`flex items-center justify-between gap-3 mt-2 pt-1 border-t text-[10px] ${
                        msg.role === 'user'
                          ? 'border-indigo-500/60 text-indigo-200'
                          : 'border-slate-100 text-slate-400'
                      }`}
                    >
                      <span>{msg.timestamp}</span>

                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => copyTextToClipboard(msg.text, msg.id)}
                          className="flex items-center gap-1 hover:text-indigo-600 transition cursor-pointer"
                          title="ចម្លងអត្ថបទ"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-bold">បានចម្លង!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>ចម្លង</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isChatLoading && (
                <div className="flex gap-3 max-w-[80%] mr-auto items-center">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3 text-xs text-slate-600 flex items-center gap-2 shadow-sm">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    <span>AI កំពុងរៀបចំ និងផ្ទៀងផ្ទាត់ចម្លើយជាភាសាខ្មែរ...</span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="សួរសំណួរ AI ពីច្បាប់ វិន័យ ឬដំណោះស្រាយអវត្តមាន... (Enter ដើម្បីផ្ញើ)"
                  disabled={isChatLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm bg-slate-50/50 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !inputText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isChatLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">ផ្ញើសំណួរ</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- MODE 2: FAST LETTER DRAFTER --- */}
      {activeSubTab === 'letter' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Form: Parameters */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">ទម្រង់បង្កើតលិខិតរដ្ឋបាលស្វ័យប្រវត្តិ</h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium">
                កម្រិតរដ្ឋបាលផ្លូវការ
              </span>
            </div>

            {/* Letter Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ប្រភេទលិខិតរដ្ឋបាល <span className="text-rose-500">*</span>
              </label>
              <select
                value={letterType}
                onChange={(e) => setLetterType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none bg-slate-50"
              >
                <option value="ពាក្យសុំច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ">ពាក្យសុំច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ (Sick Leave)</option>
                <option value="ពាក្យសុំច្បាប់ឈប់សម្រាកកិច្ចការផ្ទាល់ខ្លួន">ពាក្យសុំច្បាប់ឈប់សម្រាកកិច្ចការផ្ទាល់ខ្លួន (Personal Leave)</option>
                <option value="ពាក្យសុំច្បាប់ឈប់សម្រាកលំហែមាតុភាព">ពាក្យសុំច្បាប់ឈប់សម្រាកលំហែមាតុភាព (Maternity Leave)</option>
                <option value="លិខិតចាត់តាំងគ្រូបង្រៀនជំនួស">លិខិតចាត់តាំងគ្រូបង្រៀនជំនួស (Substitute Teacher Assignment)</option>
                <option value="លិខិតបង្គាប់ការ / លិខិតបញ្ជាបេសកកម្ម">លិខិតបង្គាប់ការ / លិខិតបញ្ជាបេសកកម្ម (Mission Order)</option>
                <option value="លិខិតអញ្ជើញមាតាបិតា ឬអាណាព្យាបាលសិស្ស">លិខិតអញ្ជើញមាតាបិតា ឬអាណាព្យាបាលសិស្ស (Parent Invitation)</option>
                <option value="លិខិតផ្ទេរ និងប្រគល់ភារកិច្ច">លិខិតផ្ទេរ និងប្រគល់ភារកិច្ច (Handover Document)</option>
              </select>
            </div>

            {/* Staff Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ជ្រើសរើសបុគ្គលិក / សាមីខ្លួន
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none bg-slate-50"
              >
                {STAFF_LIST.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} ({staff.position || 'គ្រូបង្រៀន'}) - អត្តលេខ: {staff.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ឈ្មោះសាមីខ្លួន
                </label>
                <input
                  type="text"
                  value={customRequesterName}
                  onChange={(e) => setCustomRequesterName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  តួនាទី / ភារកិច្ច
                </label>
                <input
                  type="text"
                  value={letterRole}
                  onChange={(e) => setLetterRole(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Duration and Dates */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  រយៈពេល
                </label>
                <input
                  type="text"
                  value={letterDuration}
                  onChange={(e) => setLetterDuration(e.target.value)}
                  placeholder="ឧ. ០៣ ថ្ងៃ"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ចាប់ពីថ្ងៃទី
                </label>
                <input
                  type="date"
                  value={letterStartDate}
                  onChange={(e) => setLetterStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  រហូតដល់ថ្ងៃទី
                </label>
                <input
                  type="date"
                  value={letterEndDate}
                  onChange={(e) => setLetterEndDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                មូលហេតុ / កម្មវត្ថុជាក់ស្តែង <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={letterReason}
                onChange={(e) => setLetterReason(e.target.value)}
                placeholder="បញ្ជាក់មូលហេតុច្បាស់លាស់..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Additional info */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ព័ត៌មានបន្ថែម (ការរៀបចំគ្រូបង្រៀនជំនួស ឬកិច្ចការ)
              </label>
              <textarea
                rows={2}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="ឧ. បានប្រគល់កិច្ចការបង្រៀនជូនលោកគ្រូ..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={handleGenerateLetter}
              disabled={isDrafting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isDrafting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI កំពុងព្រាងលិខិតផ្លូវការ...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>បញ្ជា AI ព្រាងលិខិតភ្លាមៗ</span>
                </>
              )}
            </button>
          </div>

          {/* Right Preview: Resulting Letter in Official A4 Khmer Format */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    {draftedLetter ? draftedLetter.title : 'ទម្រង់មើលជាមុននៃលិខិតផ្លូវការ'}
                  </h3>
                </div>
                {draftedLetter && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(draftedLetter.fullLetter);
                        setIsLetterCopied(true);
                        setTimeout(() => setIsLetterCopied(false), 2500);
                      }}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 cursor-pointer text-slate-700"
                    >
                      {isLetterCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-bold">បានចម្លង</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>ចម្លង</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintDraftedLetter}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>បោះពុម្ព (Print)</span>
                    </button>
                  </div>
                )}
              </div>

              {draftedLetter ? (
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-6 font-sans text-xs sm:text-sm leading-relaxed text-slate-800 whitespace-pre-wrap max-h-[500px] overflow-y-auto shadow-inner">
                  {draftedLetter.fullLetter}
                </div>
              ) : (
                <div className="h-[450px] border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <FileText className="w-12 h-12 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-500">មិនទាន់មានសេចក្តីព្រាងលិខិតនៅឡើយទេ</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                    សូមជ្រើសរើសប្រភេទលិខិត បញ្ចូលឈ្មោះបុគ្គលិក និងចុចប៊ូតុង «បញ្ជា AI ព្រាងលិខិតភ្លាមៗ» នៅខាងឆ្វេង។
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>រចនាប័ទ្មស្របតាមក្រសួងអប់រំ យុវជន និងកីឡា</span>
              <span className="font-semibold text-indigo-700">{SCHOOL_NAME}</span>
            </div>
          </div>
        </div>
      )}

      {/* --- MODE 3: HOLIDAY & CLOSURE NOTICE GENERATOR --- */}
      {activeSubTab === 'holiday' && (
        <HolidayNoticeGenerator currentUser={currentUser} />
      )}
    </div>
  );
}
