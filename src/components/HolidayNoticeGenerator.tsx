import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Printer,
  Copy,
  Check,
  Calendar,
  Save,
  Trash2,
  Share2,
  FileText,
  AlertCircle,
  Clock,
  Send,
  RefreshCw,
  Eye,
  Download,
  FileCode,
} from 'lucide-react';
import { exportToHtmlFile, exportToPdf } from '../utils/exportUtils';
import { SCHOOL_NAME, SCHOOL_DISTRICT, SCHOOL_OFFICE } from '../data/staff';
import {
  HolidayNoticeRecord,
  UserSession,
} from '../types';
import {
  saveHolidayNotice,
  subscribeToHolidayNotices,
  deleteHolidayNotice,
} from '../services/firebase';
import { toKhmer } from '../utils/khmerCalendar';

interface HolidayNoticeGeneratorProps {
  currentUser: UserSession;
}

// Preset list of official Cambodian public holidays
const PRESET_HOLIDAYS = [
  { name: 'ពិធីបុណ្យចូលឆ្នាំថ្មី ប្រពៃណីជាតិខ្មែរ', days: 4, month: 'មេសា', desc: 'ឈប់សម្រាកចូលឆ្នាំខ្មែរ' },
  { name: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ', days: 3, month: 'កញ្ញា/តុលា', desc: 'ឈប់សម្រាកកាន់បិណ្ឌ និងភ្ជុំបិណ្ឌ' },
  { name: 'ព្រះរាជពិធីបុណ្យអុំទូក បណ្តែតប្រទីប និងសំពះព្រះខែ អកអំបុក', days: 3, month: 'វិច្ឆិកា', desc: 'ឈប់សម្រាកបុណ្យអុំទូក' },
  { name: 'ទិវាបុណ្យឯករាជ្យជាតិ (៩ វិច្ឆិកា)', days: 1, month: 'វិច្ឆិកា', desc: 'ខួបបុណ្យឯករាជ្យជាតិ' },
  { name: 'ទិវាជ័យជម្នះលើរបបប្រល័យពូជសាសន៍ (៧ មករា)', days: 1, month: 'មករា', desc: 'ទិវា ៧ មករា' },
  { name: 'ពិធីបុណ្យមាឃបូជា', days: 1, month: 'កុម្ភៈ', desc: 'បុណ្យសាសនា' },
  { name: 'ទិវាអន្តរជាតិនារី (៨ មីនា)', days: 1, month: 'មីនា', desc: 'ទិវាសិទ្ធិនារី' },
  { name: 'ទិវាពលកម្មអន្តរជាតិ (១ ឧសភា)', days: 1, month: 'ឧសភា', desc: 'ទិវាពលកម្ម' },
  { name: 'ពិធីបុណ្យវិសាខបូជា', days: 1, month: 'ឧសភា', desc: 'បុណ្យសាសនា' },
  { name: 'ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល', days: 1, month: 'ឧសភា', desc: 'ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល' },
  { name: 'ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម ព្រះមហាក្សត្រ (១៤ ឧសភា)', days: 1, month: 'ឧសភា', desc: 'បុណ្យចម្រើនព្រះជន្ម' },
  { name: 'ទិវារំលឹកគុណគ្រូបង្រៀន (៥ តុលា)', days: 1, month: 'តុលា', desc: 'ទិវាគ្រូបង្រៀន' },
  { name: 'ការបិទទ្វារសាលាដោយសារកិច្ចប្រជុំបច្ចេកទេសប្រចាំខែ', days: 1, month: 'រៀងរាល់ខែ', desc: 'ប្រជុំបច្ចេកទេសគ្រូ' },
  { name: 'ការបិទទ្វារសាលាបណ្តោះអាសន្នផ្សេងៗ (អាកាសធាតុ/ជួសជុល)', days: 1, month: 'ពិសេស', desc: 'មូលហេតុពិសេស' },
];

export default function HolidayNoticeGenerator({ currentUser }: HolidayNoticeGeneratorProps) {
  // Form State
  const [holidayName, setHolidayName] = useState('ពិធីបុណ្យភ្ជុំបិណ្ឌ');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [reopenDate, setReopenDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [targetAudience, setTargetAudience] = useState(
    'សិស្សានុសិស្ស លោកគ្រូ-អ្នកគ្រូ និងមាតាបិតា/អាណាព្យាបាលសិស្សទាំងអស់'
  );
  const [extraNotes, setExtraNotes] = useState(
    'សូមមាតាបិតាជួយណែនាំកូនៗឱ្យរំលឹកមេរៀន និងប្រុងប្រយ័ត្នពេលធ្វើដំណើរក្នុងរដូវបុណ្យទាន។'
  );

  // Generation & Status State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedNotice, setGeneratedNotice] = useState<string>('');
  const [generatedTitle, setGeneratedTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'letter' | 'telegram'>('letter');

  // Saved notices list from Firestore
  const [savedNotices, setSavedNotices] = useState<HolidayNoticeRecord[]>([]);
  const [selectedNoticeForView, setSelectedNoticeForView] = useState<HolidayNoticeRecord | null>(null);

  // Subscribe to notices in Firestore
  useEffect(() => {
    const unsub = subscribeToHolidayNotices((notices) => {
      setSavedNotices(notices);
    });
    return () => unsub();
  }, []);

  // Handle Preset selection
  const handleSelectPreset = (name: string) => {
    setHolidayName(name);
  };

  // Generate Notice via Gemini API
  const handleGenerate = async () => {
    if (!holidayName.trim() || !startDate) {
      alert('សូមបញ្ចូលឈ្មោះពិធីបុណ្យ និងកាលបរិច្ឆេទឱ្យបានត្រឹមត្រូវ!');
      return;
    }

    setIsGenerating(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/generate-holiday-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holidayName,
          startDate,
          endDate,
          reopenDate,
          targetAudience,
          extraNotes,
          schoolName: SCHOOL_NAME,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setGeneratedTitle(json.data.title || `សេចក្តីជូនដំណឹងស្តីពីការឈប់សម្រាក ${holidayName}`);
        setGeneratedNotice(json.data.fullContent || '');
        setSummary(json.data.summary || '');
      } else {
        throw new Error(json.error || 'បរាជ័យក្នុងការបង្កើត');
      }
    } catch (err: any) {
      console.warn('AI generator fallback triggered:', err);
      // Client-side fallback if server fails
      const fallbackTitle = `សេចក្តីជូនដំណឹងស្តីពីការឈប់សម្រាកក្នុងឱកាស «${holidayName}»`;
      const fallbackContent = `ព្រះរាជាណាចក្រកម្ពុជា
ជាតិ សាសនា ព្រះមហាក្សត្រ
---
មន្ទីរអប់រំ យុវជន និងកីឡាខេត្តបន្ទាយមានជ័យ
${SCHOOL_DISTRICT}
${SCHOOL_OFFICE}
${SCHOOL_NAME}

សេចក្តីជូនដំណឹង
ស្តីពីការឈប់សម្រាកក្នុងឱកាស «${holidayName}» របស់${SCHOOL_NAME}

សូមគោរពជម្រាបជូនដល់៖ ${targetAudience}

គណៈគ្រប់គ្រង ${SCHOOL_NAME} សូមជម្រាបជូនដំណឹងដល់លោកគ្រូ អ្នកគ្រូ សិស្សានុសិស្ស និងមាតាបិតា ឬអាណាព្យាបាលសិស្សទាំងអស់មេត្តាជ្រាបថា៖ ក្នុងឱកាស «${holidayName}» ខាងមុខនេះ សាលានឹងត្រូវបិទទ្វារឈប់សម្រាកចាប់ពីថ្ងៃទី ${startDate} ដល់ថ្ងៃទី ${endDate}។

សាលានឹងចាប់ផ្តើមបើកដំណើរការបង្រៀន និងរៀនជាធម្មតាវិញនៅថ្ងៃទី ${reopenDate}។

អាស្រ័យហេតុនេះ សូមលោកគ្រូ អ្នកគ្រូ សិស្សានុសិស្ស និងមាតាបិតាទាំងអស់មេត្តាជ្រាបជាព័ត៌មាន។ ក្នុងអំឡុងពេលឈប់សម្រាកនេះ សូមសិស្សានុសិស្សទាំងអស់បន្តការស្វ័យសិក្សានៅផ្ទះ ថែរក្សាសុខភាព និងប្រុងប្រយ័ត្នខ្ពស់ក្នុងពេលធ្វើដំណើរ។ ${extraNotes}

ថ្ងៃទី ${startDate}
នាយិកាសាលា
(ហត្ថលេខានិងត្រា)
សុខ សារើន`;

      setGeneratedTitle(fallbackTitle);
      setGeneratedNotice(fallbackContent);
      setSummary(`📢 សេចក្តីជូនដំណឹង៖ ${SCHOOL_NAME} នឹងឈប់សម្រាកក្នុងឱកាស «${holidayName}» ចាប់ពីថ្ងៃ ${startDate} ដល់ ${endDate} និងចូលរៀនវិញនៅថ្ងៃ ${reopenDate}។ សូមអរគុណ!`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save generated notice to Firestore
  const handleSaveToFirestore = async () => {
    if (!generatedNotice) return;
    const record: HolidayNoticeRecord = {
      holidayName,
      startDate,
      endDate,
      reopenDate,
      targetAudience,
      generatedTitle: generatedTitle || `សេចក្តីជូនដំណឹង ${holidayName}`,
      generatedNotice,
      summary,
      status: 'published',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
    };

    const res = await saveHolidayNotice(record);
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      alert('មានបញ្ហាក្នុងការរក្សាទុក៖ ' + res.error);
    }
  };

  // Copy text to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Trigger Print
  const handlePrint = () => {
    window.print();
  };

  const handleExportHtml = () => {
    const el = document.getElementById('holiday-notice-clean-template');
    if (!el || !currentDisplayNotice) return;
    const title = currentDisplayTitle || `សេចក្តីជូនដំណឹង_${holidayName}`;
    const filename = `Notice_${(holidayName || 'Holiday').replace(/\s+/g, '_')}`;
    exportToHtmlFile({
      title,
      filename,
      contentHtml: el.innerHTML,
      landscape: false,
    });
  };

  const handleExportPdf = () => {
    const el = document.getElementById('holiday-notice-clean-template');
    if (!el || !currentDisplayNotice) return;
    const title = currentDisplayTitle || `សេចក្តីជូនដំណឹង_${holidayName}`;
    exportToPdf({
      title,
      contentHtml: el.innerHTML,
      landscape: false,
    });
  };

  const currentDisplayNotice = selectedNoticeForView
    ? selectedNoticeForView.generatedNotice
    : generatedNotice;
  const currentDisplayTitle = selectedNoticeForView
    ? selectedNoticeForView.generatedTitle
    : generatedTitle;

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="no-print bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 p-5 rounded-2xl border border-indigo-800/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>AI Assistant & Firestore Hub</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>ជំនួយការ AI សរសេរសេចក្តីជូនដំណឹងថ្ងៃសាលាបិទទ្វារ (បុណ្យជាតិ)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
            បង្កើតលិខិតជូនដំណឹងជាផ្លូវការតាមទម្រង់ក្រសួងអប់រំ យុវជន និងកីឡា ដើម្បីផ្សព្វផ្សាយជូនសិស្សានុសិស្ស មាតាបិតា និងអ្នកពាក់ព័ន្ធជាមុន ព្រមទាំងរក្សាទុកក្នុង <strong>Cloud Firestore</strong> ដោយសុវត្ថិភាព។
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Cloud Firestore Sync</span>
          </span>
        </div>
      </div>

      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: SETTINGS & INPUTS (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>ព័ត៌មានថ្ងៃឈប់សម្រាក / បិទទ្វារសាលា</span>
            </h3>

            {/* Presets chips */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                ជ្រើសរើសបុណ្យជាតិផ្លូវការរហ័ស៖
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {PRESET_HOLIDAYS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p.name)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                      holidayName === p.name
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                ឈ្មោះពិធីបុណ្យ ឬមូលហេតុឈប់សម្រាក៖
              </label>
              <input
                type="text"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="ឧ. ពិធីបុណ្យភ្ជុំបិណ្ឌ, កិច្ចប្រជុំបច្ចេកទេស..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ចាប់ពីថ្ងៃទី៖
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ដល់ថ្ងៃទី (ចុងក្រោយ)៖
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
                />
              </div>
            </div>

            {/* Reopening Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                ថ្ងៃត្រូវចូលរៀន/ធ្វើការវិញ៖
              </label>
              <input
                type="date"
                value={reopenDate}
                onChange={(e) => setReopenDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
              />
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                មុខសញ្ញាជូនដំណឹង (Target Audience)៖
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
              >
                <option value="សិស្សានុសិស្ស លោកគ្រូ-អ្នកគ្រូ និងមាតាបិតា/អាណាព្យាបាលសិស្សទាំងអស់">
                  សិស្សានុសិស្ស លោកគ្រូ-អ្នកគ្រូ និងមាតាបិតា (ទូទៅ)
                </option>
                <option value="លោកគ្រូ-អ្នកគ្រូ និងបុគ្គលិកអប់រំទាំងអស់នៃសាលាបឋមសិក្សា រោគ">
                  លោកគ្រូ-អ្នកគ្រូ និងបុគ្គលិកអប់រំ (ផ្ទៃក្នុង)
                </option>
                <option value="មាតាបិតា និងអាណាព្យាបាលសិស្សានុសិស្សគ្រប់កម្រិតថ្នាក់">
                  មាតាបិតា និងអាណាព្យាបាលសិស្ស
                </option>
              </select>
            </div>

            {/* Additional notes / requests */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                សេចក្តីណែនាំ ឬការផ្តាំផ្ញើបន្ថែម (Optional)៖
              </label>
              <textarea
                rows={2}
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                placeholder="ឧ. ការរំលឹកមេរៀន វិធានការសុខាភិបាល..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
              />
            </div>

            {/* Generate Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini AI កំពុងតាក់តែងលិខិត...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>✨ ប្រើ AI តាក់តែងសេចក្តីជូនដំណឹង</span>
                </>
              )}
            </button>
          </div>

          {/* SAVED NOTICES IN FIRESTORE LIST */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>សេចក្តីជូនដំណឹងក្នុង Firestore ({savedNotices.length})</span>
              <span className="text-[10px] text-emerald-400">Synced</span>
            </h4>

            {savedNotices.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                មិនទាន់មានសេចក្តីជូនដំណឹងត្រូវបានរក្សាទុកនៅឡើយទេ។
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedNotices.map((n) => (
                  <div
                    key={n.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-indigo-500/50 transition flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {n.holidayName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {n.startDate} ដល់ {n.endDate}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNoticeForView(n);
                          setGeneratedNotice(n.generatedNotice);
                          setGeneratedTitle(n.generatedTitle);
                          setSummary(n.summary || '');
                        }}
                        className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-xs"
                        title="មើលលម្អិត"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (n.id && confirm(`តើពិតជាចង់លុបសេចក្តីជូនដំណឹង "${n.holidayName}" មែនទេ?`)) {
                            await deleteHolidayNotice(n.id);
                            if (selectedNoticeForView?.id === n.id) {
                              setSelectedNoticeForView(null);
                            }
                          }
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs"
                        title="លុបចេញ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: PREVIEW & ACTIONS (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
            {/* View Switcher Tabs & Actions (Compact & Sleek) */}
            <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveViewTab('letter')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                    activeViewTab === 'letter'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>លិខិតផ្លូវការ (A4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveViewTab('telegram')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                    activeViewTab === 'telegram'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Telegram / សង្គម</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleCopy(activeViewTab === 'letter' ? currentDisplayNotice : summary || currentDisplayNotice)}
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700 cursor-pointer"
                  title="ចម្លងខ្លឹមសារ"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'បានចម្លង' : 'ចម្លង'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveToFirestore}
                  disabled={!currentDisplayNotice}
                  className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  title="រក្សាទុកក្នុង Firestore"
                >
                  {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{saveSuccess ? 'បានរក្សា!' : 'រក្សាទុក'}</span>
                </button>

                {/* Export & Print segmented group */}
                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={handleExportHtml}
                    disabled={!currentDisplayNotice}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/60 rounded transition cursor-pointer disabled:opacity-40"
                    title="ទាញយកជាឯកសារ HTML"
                  >
                    <FileCode className="w-3 h-3" />
                    <span>HTML</span>
                  </button>
                  <span className="w-px h-3 bg-slate-800" />
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={!currentDisplayNotice}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-sky-400 hover:bg-sky-950/60 rounded transition cursor-pointer disabled:opacity-40"
                    title="រក្សាទុកជា PDF (Save as PDF)"
                  >
                    <Download className="w-3 h-3" />
                    <span>PDF</span>
                  </button>
                  <span className="w-px h-3 bg-slate-800" />
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={!currentDisplayNotice}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-amber-300 hover:bg-amber-950/60 rounded transition cursor-pointer disabled:opacity-40"
                    title="បោះពុម្ពជាលិខិតផ្លូវការ (Print)"
                  >
                    <Printer className="w-3 h-3" />
                    <span>ព្រីន</span>
                  </button>
                </div>
              </div>
            </div>

            {/* PREVIEW CONTENT */}
            {!currentDisplayNotice ? (
              <div className="py-16 text-center text-slate-500 space-y-3">
                <Sparkles className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
                <p className="text-sm">
                  សូមជ្រើសរើសថ្ងៃបុណ្យ ឬបញ្ចូលព័ត៌មាន រួចចុច <strong>«✨ ប្រើ AI តាក់តែងសេចក្តីជូនដំណឹង»</strong>។
                </p>
              </div>
            ) : activeViewTab === 'letter' ? (
              /* OFFICIAL A4 LETTER PREVIEW */
              <div className="bg-white text-slate-900 rounded-xl p-6 sm:p-8 shadow-inner font-serif border border-slate-300 space-y-4 text-xs sm:text-sm leading-relaxed">
                {/* Royal Motto Header */}
                <div className="text-center font-bold">
                  <div className="text-base sm:text-lg tracking-wider text-slate-950">ព្រះរាជាណាចក្រកម្ពុជា</div>
                  <div className="text-xs sm:text-sm text-slate-800">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
                  <div className="text-xs text-slate-500 mt-0.5">--- 🪷 ---</div>
                </div>

                {/* School / Administration Branch */}
                <div className="text-left font-bold text-[11px] sm:text-xs text-slate-800 space-y-0.5 border-b border-slate-200 pb-2">
                  <div>មន្ទីរអប់រំ យុវជន និងកីឡាខេត្តបន្ទាយមានជ័យ</div>
                  <div>{SCHOOL_DISTRICT}</div>
                  <div>{SCHOOL_OFFICE}</div>
                  <div className="text-indigo-900 font-extrabold">{SCHOOL_NAME}</div>
                </div>

                {/* Notice Title */}
                <div className="text-center my-4">
                  <h3 className="text-sm sm:text-base font-black text-slate-950 underline underline-offset-4 decoration-amber-600">
                    {currentDisplayTitle || `សេចក្តីជូនដំណឹង`}
                  </h3>
                  <div className="text-xs font-bold text-slate-700 mt-1">
                    ស្តីពីការឈប់សម្រាកក្នុងឱកាស «{holidayName}»
                  </div>
                </div>

                {/* Content body rendered cleanly */}
                <div className="whitespace-pre-line text-justify text-slate-900 font-normal leading-relaxed">
                  {currentDisplayNotice}
                </div>

                {/* Director Signature Area */}
                <div className="pt-6 flex justify-between items-end text-xs sm:text-sm font-bold">
                  <div className="text-slate-600 text-[11px]">
                    <div>កន្លែងទទួល៖</div>
                    <div>- ការិយាល័យអប់រំ ស្រុក (ដើម្បីរាយការណ៍)</div>
                    <div>- គណៈកម្មការទ្រទ្រង់សាលា</div>
                    <div>- ផ្សព្វផ្សាយទូទៅ</div>
                    <div>- ឯកសារ-កាលប្បវត្តិ</div>
                  </div>

                  <div className="text-center space-y-1">
                    <div className="font-normal text-slate-700">
                      ធ្វើនៅ {SCHOOL_NAME}, ថ្ងៃទី {toKhmer(new Date().getDate())} ខែ {toKhmer(new Date().getMonth() + 1)} ឆ្នាំ {toKhmer(new Date().getFullYear())}
                    </div>
                    <div className="text-slate-950 font-black">នាយិកាសាលា</div>
                    <div className="h-16 flex items-center justify-center text-slate-400 italic font-normal text-xs">
                      [ហត្ថលេខា និងត្រា]
                    </div>
                    <div className="text-slate-950 font-bold">សុខ សារើន</div>
                  </div>
                </div>
              </div>
            ) : (
              /* TELEGRAM & SOCIAL MESSAGE PREVIEW */
              <div className="space-y-4">
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-400">
                    <span className="flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" />
                      <span>សេចក្តីជូនដំណឹងសង្ខេប (សម្រាប់ផ្ញើ Telegram / Facebook)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(summary || currentDisplayNotice)}
                      className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>ចម្លងសារខ្លី</span>
                    </button>
                  </div>

                  <div className="p-3 bg-slate-900/90 rounded-lg text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed border border-slate-800">
                    {summary || `📢 <strong>សេចក្តីជូនដំណឹងស្តីពីការឈប់សម្រាក</strong>
🏫 ${SCHOOL_NAME}
🎉 ក្នុងឱកាស «${holidayName}»
📅 ឈប់សម្រាកចាប់ពី៖ ថ្ងៃ ${startDate} ដល់ ${endDate}
🎒 ចូលរៀនវិញជាធម្មតានៅ៖ ថ្ងៃ ${reopenDate}
សូមលោកគ្រូ អ្នកគ្រូ សិស្សានុសិស្ស និងមាតាបិតាជ្រាបជាដំណឹង!`}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    អ្នកអាចចម្លងអត្ថបទខាងលើនេះ ដើម្បីផ្ញើចូលទៅក្នុងគ្រុបតេឡេក្រាមរបស់ថ្នាក់រៀន ឬផ្សព្វផ្សាយលើទំព័រហ្វេសប៊ុករបស់សាលាបានយ៉ាងឆាប់រហ័ស។
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRINT-ONLY CLEAN TEMPLATE */}
      <div id="holiday-notice-clean-template" className="only-print bg-white text-black p-8 font-serif">
        <div className="text-center font-bold mb-6">
          <div className="text-lg">ព្រះរាជាណាចក្រកម្ពុជា</div>
          <div className="text-sm">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
          <div className="text-xs">--- 🪷 ---</div>
        </div>

        <div className="text-left font-bold text-xs space-y-0.5 mb-6">
          <div>មន្ទីរអប់រំ យុវជន និងកីឡាខេត្តបន្ទាយមានជ័យ</div>
          <div>{SCHOOL_DISTRICT}</div>
          <div>{SCHOOL_OFFICE}</div>
          <div>{SCHOOL_NAME}</div>
        </div>

        <div className="text-center my-6">
          <h2 className="text-base font-black underline">
            {currentDisplayTitle || `សេចក្តីជូនដំណឹង`}
          </h2>
          <div className="text-xs font-bold mt-1">
            ស្តីពីការឈប់សម្រាកក្នុងឱកាស «{holidayName}»
          </div>
        </div>

        <div className="whitespace-pre-line text-justify text-xs leading-relaxed">
          {currentDisplayNotice}
        </div>

        <div className="pt-10 flex justify-between items-end text-xs font-bold">
          <div className="text-slate-700 text-[10px]">
            <div>កន្លែងទទួល៖</div>
            <div>- ការិយាល័យអប់រំ ស្រុក (ដើម្បីរាយការណ៍)</div>
            <div>- គណៈកម្មការទ្រទ្រង់សាលា</div>
            <div>- ផ្សព្វផ្សាយទូទៅ</div>
            <div>- ឯកសារ-កាលប្បវត្តិ</div>
          </div>

          <div className="text-center space-y-1">
            <div className="font-normal text-slate-700">
              ធ្វើនៅ {SCHOOL_NAME}, ថ្ងៃទី {toKhmer(new Date().getDate())} ខែ {toKhmer(new Date().getMonth() + 1)} ឆ្នាំ {toKhmer(new Date().getFullYear())}
            </div>
            <div className="font-black">នាយិកាសាលា</div>
            <div className="h-16"></div>
            <div>សុខ សារើន</div>
          </div>
        </div>
      </div>
    </div>
  );
}
