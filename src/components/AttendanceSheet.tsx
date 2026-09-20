import { useState, useEffect } from 'react';
import {
  StaffMember,
  DayAttendanceMap,
  GPSState,
  UserSession,
} from '../types';
import {
  STAFF_LIST,
  SCHOOL_NAME,
  SCHOOL_DISTRICT,
  SCHOOL_OFFICE,
  SCHOOL_LOCATION_NAME,
  toKhmer,
  formatKhmerSolarDate,
  formatKhmerLunarDate,
} from '../data/staff';
import SignatureModal from './SignatureModal';
import KhmerCalendarModal from './KhmerCalendarModal';
import TelegramNotificationModal from './TelegramNotificationModal';
import {
  sendAttendanceTelegramAlert,
  checkTelegramStatus,
} from '../services/telegramService';
import { sendBrowserPushNotification } from '../services/notificationService';
import {
  getKhmerLunarInfo,
  getKhmerHoliday,
  isKhmerWorkingDay,
  isSchoolWorkingDay,
} from '../utils/khmerCalendar';
import {
  Printer,
  Save,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Palmtree,
  Moon,
  Download,
  FileCode,
  Send,
} from 'lucide-react';
import { exportToHtmlFile, exportToPdf } from '../utils/exportUtils';

interface AttendanceSheetProps {
  selectedDate: string;
  onDateChange: (dateStr: string) => void;
  attendanceData: DayAttendanceMap;
  onSaveData: (data: DayAttendanceMap) => Promise<void>;
  gpsState: GPSState;
  onRetryGps: () => void;
  onToggleSimulatedGps: () => void;
  currentUser: UserSession | null;
  onOpenMonthPrint: () => void;
}

export default function AttendanceSheet({
  selectedDate,
  onDateChange,
  attendanceData,
  onSaveData,
  gpsState,
  onRetryGps,
  onToggleSimulatedGps,
  currentUser,
  onOpenMonthPrint,
}: AttendanceSheetProps) {
  // Local editable copy for immediate interaction
  const [localData, setLocalData] = useState<DayAttendanceMap>(attendanceData);
  const [currentTime, setCurrentTime] = useState<string>('00:00:00');
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isKhmerCalendarOpen, setIsKhmerCalendarOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isTelegramConfigured, setIsTelegramConfigured] = useState(false);

  // Active signature modal state
  const [activeModal, setActiveModal] = useState<{
    staffName: string;
    colIndex: number;
    periodLabel: string;
  } | null>(null);

  // Check Telegram Bot connection status
  useEffect(() => {
    checkTelegramStatus().then((s) => setIsTelegramConfigured(s.isConfigured));
  }, []);

  // Sync external attendanceData into localData
  useEffect(() => {
    setLocalData(attendanceData);
  }, [attendanceData]);

  // Live ticking clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${h}:${m}:${s}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentDateObj = new Date(selectedDate + 'T00:00:00');
  const lunarInfo = getKhmerLunarInfo(selectedDate);
  const holidayInfo = getKhmerHoliday(selectedDate);
  const schoolDayInfo = isSchoolWorkingDay(selectedDate);
  const isWorking = schoolDayInfo.isWorking;
  const isSunday = currentDateObj.getDay() === 0;

  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);
  const checkDateObj = new Date(selectedDate + 'T00:00:00');
  checkDateObj.setHours(0, 0, 0, 0);
  const isFutureOrToday = checkDateObj >= todayObj;

  const handleDayStep = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    onDateChange(`${yyyy}-${mm}-${dd}`);
  };

  // Open signature modal
  const handleOpenSign = (staff: StaffMember, colIndex: number, label: string) => {
    // Check GPS
    const isGpsOk = gpsState.status === 'ok' || gpsState.status === 'simulated';
    if (!isGpsOk) {
      alert(
        `❌ មិនអនុញ្ញាតចុះវត្តមាន!\nអ្នកនៅក្រៅបរិវេណសាលា (${gpsState.distance ?? 'N/A'}m) ឬមិនទាន់បើក GPS។\n(អ្នកអាចចុចបើក 'GPS សាកល្បង Demo' ខាងលើដើម្បីតេស្ត)`
      );
      return;
    }

    // Role check: Teachers can sign their own name; Director & Admin can sign for anyone
    if (currentUser && currentUser.role === 'teacher') {
      if (currentUser.name !== staff.name) {
        alert(`⚠️ អ្នកបាន Login ជាលោកគ្រូ/អ្នកគ្រូ "${currentUser.name}" ដូច្នេះអាចចុះហត្ថលេខាបានតែលើឈ្មោះរបស់អ្នកប៉ុណ្ណោះ!`);
        return;
      }
    }

    setActiveModal({
      staffName: staff.name,
      colIndex,
      periodLabel: label,
    });
  };

  const handleSaveSignature = async (sigBase64: string) => {
    if (!activeModal) return;

    const { staffName, colIndex, periodLabel } = activeModal;
    const staffRecord = { ...(localData[staffName] || {}) };
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const sigObj = {
      time: timeStr,
      sig: sigBase64,
      lat: gpsState.lat,
      lng: gpsState.lng,
      dist: gpsState.distance,
    };

    if (colIndex === 0) staffRecord.m_in = sigObj;
    else if (colIndex === 1) staffRecord.m_out = sigObj;
    else if (colIndex === 2) staffRecord.a_in = sigObj;
    else if (colIndex === 3) staffRecord.a_out = sigObj;

    const updated = {
      ...localData,
      [staffName]: staffRecord,
    };

    setLocalData(updated);
    setActiveModal(null);

    // Auto save immediately for a seamless experience
    try {
      await onSaveData(updated);
      setSaveToast('💾 បានរក្សាទុកវត្តមានជោគជ័យ!');
      setTimeout(() => setSaveToast(null), 3000);
    } catch {
      // ignore
    }

    // Trigger Browser Push Notification immediately
    try {
      sendBrowserPushNotification({
        title: '✍️ បុគ្គលិកចុះហត្ថលេខាវត្តមាន',
        body: `${staffName} បានចុះហត្ថលេខា (${periodLabel}) ម៉ោង ${timeStr}`,
        type: 'signature',
        staffName,
        periodLabel,
      });
    } catch {
      // non-blocking
    }

    // Automatically notify Telegram Group when staff completes signature
    try {
      const staffObj = STAFF_LIST.find((s) => s.name === staffName);
      sendAttendanceTelegramAlert({
        staffName,
        staffGender: staffObj?.gender,
        staffPosition: staffObj?.position,
        staffClass: staffObj?.cls,
        periodLabel,
        colIndex,
        timeStr,
        dateStr: selectedDate,
        khmerDateStr: formatKhmerSolarDate(currentDateObj),
        gpsDistance: gpsState.distance,
        gpsStatus:
          gpsState.status === 'simulated'
            ? 'ទីតាំង Demo សាកល្បង'
            : gpsState.status === 'ok'
            ? 'នៅក្នុងបរិវេណសាលា'
            : 'មិនបានកំណត់',
        schoolName: SCHOOL_NAME,
      }).then((alertRes) => {
        if (alertRes.success && alertRes.mode === 'telegram_live') {
          setSaveToast(`📢 បានជូនដំណឹងទៅ Telegram ក្រុមរដ្ឋបាលជោគជ័យ! (${staffName})`);
          setTimeout(() => setSaveToast(null), 3500);
        }
      }).catch((err) => {
        console.warn('Telegram alert background error:', err);
      });
    } catch {
      // non-blocking
    }
  };

  const handleNoteChange = (staffName: string, note: string) => {
    const staffRecord = { ...(localData[staffName] || {}), note };
    setLocalData((prev) => ({
      ...prev,
      [staffName]: staffRecord,
    }));
  };

  const handleQuickNote = (staffName: string, tag: string) => {
    const currentNote = localData[staffName]?.note || '';
    const newNote = currentNote ? `${currentNote}, ${tag}` : tag;
    handleNoteChange(staffName, newNote);
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      await onSaveData(localData);
      setSaveToast('💾 បានរក្សាទុកទិន្នន័យទាំងអស់រួចរាល់!');
      setTimeout(() => setSaveToast(null), 3500);

      // Trigger Push Notification for data modification/update
      sendBrowserPushNotification({
        title: '💾 បានកែសម្រួល & រក្សាទុកទិន្នន័យវត្តមាន',
        body: `ទិន្នន័យវត្តមានកាលបរិច្ឆេទ ${selectedDate} ត្រូវបានកែសម្រួល និងរក្សាទុកដោយជោគជ័យ`,
        type: 'edit',
      });
    } catch (e) {
      alert('បរាជ័យក្នុងការរក្សាទុក: ' + String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportHtml = () => {
    const el = document.getElementById('att-print-wrapper');
    if (!el) return;
    const title = `បញ្ជីវត្តមានប្រចាំថ្ងៃ ${formatKhmerSolarDate(currentDateObj)}`;
    const filename = `Vattaman_Rohk_${selectedDate}`;
    exportToHtmlFile({
      title,
      filename,
      contentHtml: el.innerHTML,
      landscape: true,
    });
  };

  const handleExportPdf = () => {
    const el = document.getElementById('att-print-wrapper');
    if (!el) return;
    const title = `បញ្ជីវត្តមានប្រចាំថ្ងៃ ${formatKhmerSolarDate(currentDateObj)}`;
    exportToPdf({
      title,
      contentHtml: el.innerHTML,
      landscape: true,
    });
  };

  // Compute statistics
  let leaveCount = 0;
  let leaveFemale = 0;
  let noleaveCount = 0;
  let noleaveFemale = 0;
  let missionCount = 0;
  let missionFemale = 0;
  let otherCount = 0;
  let otherFemale = 0;

  const isNonWork = !schoolDayInfo.isWorking;
  const hasAnyRecord = Object.values(localData).some((rec: any) =>
    Boolean(
      rec?.m_in?.sig ||
      rec?.m_out?.sig ||
      rec?.a_in?.sig ||
      rec?.a_out?.sig ||
      (rec?.note && rec.note.trim().length > 0)
    )
  );

  STAFF_LIST.forEach((s) => {
    if (isNonWork) return;

    const rec = localData[s.name];
    const hasSigned = Boolean(rec?.m_in?.sig || rec?.a_in?.sig);
    const isF = s.gender === 'ស្រី';

    if (hasSigned) return; // Attended

    const note = (rec?.note || '').trim();
    if (note.includes('អត់ច្បាប់')) {
      noleaveCount++;
      if (isF) noleaveFemale++;
    } else if (note.includes('ច្បាប់')) {
      leaveCount++;
      if (isF) leaveFemale++;
    } else if (note.includes('បេសកកម្ម') || note.toLowerCase().includes('mission')) {
      missionCount++;
      if (isF) missionFemale++;
    } else if (note.length > 0) {
      otherCount++;
      if (isF) otherFemale++;
    } else if (hasAnyRecord) {
      // Empty note and not signed, but attendance taking has occurred today
      noleaveCount++;
      if (isF) noleaveFemale++;
    }
  });

  const totalAbsent = leaveCount + noleaveCount + missionCount + otherCount;
  const directorRecord = localData['សុខ សារើន'];
  const directorSig =
    directorRecord?.m_in?.sig ||
    directorRecord?.a_in?.sig ||
    directorRecord?.m_out?.sig ||
    directorRecord?.a_out?.sig;

  const isGpsOk = gpsState.status === 'ok' || gpsState.status === 'simulated';

  // Count without pay leave
  let withoutPayCount = 0;
  STAFF_LIST.forEach((s) => {
    const rec = localData[s.name];
    if (rec?.leaveType?.includes('គ្មានបៀវត្ស') || rec?.note?.includes('គ្មានបៀវត្ស')) {
      withoutPayCount++;
    }
  });

  return (
    <div id="att-print-wrapper" className="space-y-4">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* TOP CONTROL BAR (Screen Only - Compact & Clean) */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-lg space-y-2">
        {/* GPS Banner (Compact) */}
        <div
          className={`flex items-center justify-between flex-wrap gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border ${
            isGpsOk
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : gpsState.status === 'loading'
              ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isGpsOk
                  ? 'bg-emerald-400 animate-pulse'
                  : gpsState.status === 'loading'
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-rose-500'
              }`}
            />
            <span className="truncate">
              {gpsState.status === 'simulated' ? (
                <span>
                  🟢 <strong>GPS សាលា (Demo OK)</strong> — ០ ម៉ែត្រ
                </span>
              ) : gpsState.status === 'ok' ? (
                <span>
                  ✅ <strong>ក្នុងសាលា</strong> — {gpsState.distance}m (±{gpsState.accuracy}m)
                </span>
              ) : gpsState.status === 'loading' ? (
                '⏳ កំពុងស្វែងរក GPS...'
              ) : gpsState.status === 'bad' ? (
                <span>
                  ❌ <strong>ក្រៅសាលា</strong> ({gpsState.distance}m)
                </span>
              ) : (
                <span>🚫 GPS ត្រូវបានបិទ</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleSimulatedGps}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold transition cursor-pointer border ${
                gpsState.status === 'simulated'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="ចុចដើម្បីបើក/បិទ GPS សាកល្បង"
            >
              {gpsState.status === 'simulated' ? (
                <ToggleRight className="w-3 h-3 text-amber-400" />
              ) : (
                <ToggleLeft className="w-3 h-3" />
              )}
              <span>GPS Demo</span>
            </button>

            <button
              onClick={onRetryGps}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/40 transition cursor-pointer"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>

        {/* Date Selector and Action Buttons (Compact Toolbar) */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Date Picker controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleDayStep(-1)}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="ថ្ងៃមុន"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Khmer Calendar trigger button */}
            <button
              type="button"
              onClick={() => setIsKhmerCalendarOpen(true)}
              className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800/90 px-2.5 py-1 rounded-lg border border-amber-500/40 text-amber-300 transition cursor-pointer shadow-xs group"
              title="ចុចដើម្បីបើកប្រតិទិនខ្មែរ (ចន្ទគតិ-សុរិយគតិ & ថ្ងៃបុណ្យជាតិ)"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">
                  {formatKhmerSolarDate(currentDateObj)}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold text-amber-400 bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-500/30">
                  {toKhmer(lunarInfo.dayNumber)}{lunarInfo.phase} ខែ{lunarInfo.lunarMonth}
                  {lunarInfo.isBuddhistHolyDay && ' 🌕សីល'}
                </span>
              </div>
            </button>

            <button
              onClick={() => handleDayStep(1)}
              disabled={isFutureOrToday}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 border border-slate-700 transition cursor-pointer"
              title="ថ្ងៃបន្ទាប់"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Live Clock */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-400 text-[11px] font-mono font-bold">
              <Clock className="w-3 h-3 text-rose-400" />
              <span>{currentTime}</span>
            </div>
          </div>

          {/* Action Buttons: Compact & Organized */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition cursor-pointer"
            >
              <Save className="w-3 h-3" />
              <span>{isSaving ? 'រក្សាទុក...' : 'រក្សាទុក'}</span>
            </button>

            <button
              onClick={onOpenMonthPrint}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition cursor-pointer"
              title="ព្រីនតារាងវត្តមានប្រចាំខែ"
            >
              <Calendar className="w-3 h-3" />
              <span>ព្រីន ១ ខែ</span>
            </button>

            {/* Telegram Auto-Notification Button */}
            <button
              type="button"
              onClick={() => setIsTelegramModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-500/40 shadow-xs transition cursor-pointer"
              title="ការកំណត់ និងប្រព័ន្ធជូនដំណឹង Telegram ស្វ័យប្រវត្តិ"
            >
              <Send className="w-3 h-3 text-sky-400" />
              <span>Telegram</span>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isTelegramConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
                title={isTelegramConfigured ? 'Telegram Live Connected' : 'Telegram Simulation Mode'}
              />
            </button>

            {/* Export & Print Group */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={handleExportHtml}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-emerald-400 hover:bg-emerald-950/60 transition cursor-pointer"
                title="ទាញយកជាឯកសារ HTML"
              >
                <FileCode className="w-3 h-3" />
                <span>HTML</span>
              </button>
              <span className="w-px h-3 bg-slate-800" />
              <button
                type="button"
                onClick={handleExportPdf}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-sky-400 hover:bg-sky-950/60 transition cursor-pointer"
                title="រក្សាទុកជា PDF (Save as PDF)"
              >
                <Download className="w-3 h-3" />
                <span>PDF</span>
              </button>
              <span className="w-px h-3 bg-slate-800" />
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-teal-300 hover:bg-teal-950/60 transition cursor-pointer"
                title="បោះពុម្ពតាមម៉ាស៊ីនព្រីន (Print A4)"
              >
                <Printer className="w-3 h-3" />
                <span>ព្រីន</span>
              </button>
            </div>
          </div>
        </div>

        {/* Holiday / Rest Day / Meeting Day Banner (Compact) */}
        {(holidayInfo || isSunday || schoolDayInfo.isThursdayMeeting) && (
          <div
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-between gap-2 border ${
              holidayInfo
                ? 'bg-rose-950/50 border-rose-500/50 text-rose-300'
                : schoolDayInfo.isThursdayMeeting
                ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                {holidayInfo ? (
                  <span>
                    🏖️ <strong>ថ្ងៃឈប់សម្រាកបុណ្យជាតិ:</strong> {holidayInfo.name} — (មិនគិតជាអវត្តមាន)
                  </span>
                ) : schoolDayInfo.isThursdayMeeting ? (
                  <span>
                    🏛️ <strong>ថ្ងៃព្រហស្បតិ៍សប្ដាហ៍ទី៤:</strong> កិច្ចប្រជុំបច្ចេកទេសប្រចាំខែ — (មិនគិតជាអវត្តមានបង្រៀន)
                  </span>
                ) : (
                  <span>
                    ☕ <strong>ថ្ងៃអាទិត្យ:</strong> ថ្ងៃឈប់សម្រាកចុងសប្តាហ៍ — (មិនគិតជាអវត្តមាន)
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {schoolDayInfo.isThursdayMeeting && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px]">
                  ប្រជុំបច្ចេកទេស
                </span>
              )}
              {lunarInfo.isBuddhistHolyDay && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] flex items-center gap-1">
                  <Moon className="w-3 h-3" />
                  <span>{lunarInfo.holyDayLabel}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* OFFICIAL PRINT / DISPLAY SHEET: ឧបសម្ព័ន្ធទី១ នៃអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក */}
      <div
        id="att-print-wrapper"
        className="bg-white text-slate-900 p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl border border-slate-200 print:p-0 print:border-none print:shadow-none"
      >
        {/* Top Header - Matching Exact Administrative Style (IMG_3788) */}
        <div className="text-center text-xs sm:text-sm font-bold leading-tight text-black mb-1 print:mb-0.5">
          <p className="font-['Moul'] text-xs sm:text-sm font-normal text-slate-950">
            ព្រះរាជាណាចក្រកម្ពុជា
          </p>
          <p className="font-['Moul'] text-[11px] sm:text-xs font-normal text-slate-950 mt-0.5">
            ជាតិ សាសនា ព្រះមហាក្សត្រ
          </p>
          <p className="tracking-widest text-[9.5px] text-slate-600">--------*--------</p>
        </div>

        <div className="text-left text-xs sm:text-sm font-semibold leading-snug text-black mb-2 print:mb-1">
          <p className="text-slate-900">{SCHOOL_DISTRICT}</p>
          <p className="text-slate-900">{SCHOOL_OFFICE}</p>
          <p className="font-bold text-blue-900">{SCHOOL_NAME}</p>
        </div>

        {/* Official Document Title */}
        <div className="text-center mb-2 print:mb-1">
          <h2 className="font-['Moul'] text-blue-900 text-sm sm:text-base font-normal leading-snug print:text-[11pt]">
            បញ្ជីវត្តមានប្រចាំថ្ងៃរបស់មន្ត្រីរាជការស៊ីវិលនិងមន្ត្រីជាប់កិច្ចសន្យាក្នុង {SCHOOL_NAME}
          </h2>
          <p className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">
            {formatKhmerSolarDate(currentDateObj)}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-600 font-semibold mt-0.5">
            ({lunarInfo.formattedLunar})
            {holidayInfo && (
              <span className="ml-2 font-bold text-rose-700">
                [ ថ្ងៃឈប់សម្រាកបុណ្យជាតិ: {holidayInfo.name} ]
              </span>
            )}
            {isSunday && !holidayInfo && (
              <span className="ml-2 font-bold text-slate-600">
                [ ថ្ងៃឈប់សម្រាកចុងសប្តាហ៍ ]
              </span>
            )}
          </p>
        </div>

        {/* ATTENDANCE TABLE (Exact Annex 1 Structure) */}
        <div className="overflow-x-auto rounded-lg border border-slate-400">
          <table className="w-full border-collapse text-xs table-fixed">
            <thead>
              <tr className="bg-blue-700 text-white border-b border-blue-900">
                <th rowSpan={2} className="border border-slate-400 p-1 text-center w-[3.5%]">
                  ល.រ
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1 text-left w-[11%]">
                  គោត្តនាមនិងនាម
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1 text-center w-[3.5%]">
                  ភេទ
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1 text-center w-[8.5%]">
                  តួនាទី
                </th>
                <th colSpan={4} className="border border-slate-400 p-1 text-center font-bold w-[42%]">
                  ហត្ថលេខា
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1 text-center w-[4.5%]">
                  មកយឺត
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1 text-center w-[4.5%]">
                  ចេញមុន
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1 text-center w-[11%]">
                  លិខិតបញ្ជាក់
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1 text-center w-[11.5%]">
                  ផ្សេងៗ
                </th>
              </tr>
              <tr className="bg-blue-800 text-white text-[10.5px]">
                {/* ព្រឹក */}
                <th className="border border-slate-400 p-0.5 text-center w-[13%]">
                  ព្រឹក-ចូល
                </th>
                <th className="border border-slate-400 p-0.5 text-center w-[13%]">
                  ព្រឹក-ចេញ
                </th>
                {/* ល្ងាច / រសៀល */}
                <th className="border border-slate-400 p-0.5 text-center w-[8%]">
                  ល្ងាច-ចូល
                </th>
                <th className="border border-slate-400 p-0.5 text-center w-[8%]">
                  ល្ងាច-ចេញ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {STAFF_LIST.map((staff, idx) => {
                const rec = localData[staff.name] || {};
                const sigCols = [
                  { rec: rec.m_in, label: 'ព្រឹក-ចូល' },
                  { rec: rec.m_out, label: 'ព្រឹក-ចេញ' },
                  { rec: rec.a_in, label: 'ល្ងាច-ចូល' },
                  { rec: rec.a_out, label: 'ល្ងាច-ចេញ' },
                ];

                const isCurrentUser = currentUser?.name === staff.name;

                return (
                  <tr
                    key={staff.id}
                    className={`hover:bg-blue-50/40 transition ${
                      idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                    } ${isCurrentUser ? 'ring-1 ring-amber-400 ring-inset' : ''}`}
                  >
                    {/* 1. ល.រ */}
                    <td className="border border-slate-300 p-1 text-center font-bold text-slate-700">
                      {toKhmer(idx + 1)}
                    </td>

                    {/* 2. គោត្តនាមនិងនាម */}
                    <td className="border border-slate-300 p-1.5 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{staff.name}</span>
                        {isCurrentUser && (
                          <span className="no-print text-[9px] px-1 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            អ្នក
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. ភេទ */}
                    <td className="border border-slate-300 p-1 text-center text-slate-700">
                      {staff.gender}
                    </td>

                    {/* 4. តួនាទី */}
                    <td className="border border-slate-300 p-1 text-center whitespace-nowrap text-slate-800 font-medium">
                      {staff.position}
                      {staff.cls !== '-' ? ` ${staff.cls}` : ''}
                    </td>

                    {/* 5. ហត្ថលេខា: ព្រឹក (ចូល, ចេញ) និង ល្ងាច (ចូល, ចេញ) - ស្មើជួរដេកជាមួយម៉ោង */}
                    {sigCols.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        className="border border-slate-300 p-0.5 text-center bg-white align-middle"
                      >
                        {col.rec && col.rec.sig ? (
                          <div className="att-sig-container flex flex-row items-center justify-center gap-1.5 p-0.5 bg-emerald-50/60 rounded border border-emerald-300 min-h-[22px]">
                            <img
                              src={col.rec.sig}
                              alt="Signature"
                              className={`att-sig-img max-h-5 ${
                                colIdx < 2 ? 'max-w-[54px]' : 'max-w-[42px]'
                              } object-contain block`}
                            />
                            <span className="att-sig-time text-[8px] sm:text-[8.5px] text-emerald-800 font-bold whitespace-nowrap leading-none">
                              {col.rec.time}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenSign(staff, colIdx, col.label)}
                            className="no-print w-full min-h-[22px] flex items-center justify-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 hover:border-amber-400 transition cursor-pointer group shadow-2xs"
                            title={`ចុះហត្ថលេខា ${col.label}`}
                          >
                            <span className="text-[8.5px] font-bold group-hover:scale-105 transition whitespace-nowrap">
                              ✍️ {col.label}
                            </span>
                          </button>
                        )}
                      </td>
                    ))}

                    {/* 6. មកយឺត (Late) */}
                    <td className="border border-slate-300 p-0.5 text-center bg-white">
                      <input
                        type="text"
                        value={rec.late || ''}
                        onChange={(e) => {
                          const staffRecord = { ...(localData[staff.name] || {}), late: e.target.value };
                          setLocalData((prev) => ({ ...prev, [staff.name]: staffRecord }));
                        }}
                        placeholder="-"
                        className="w-full text-center text-[10.5px] p-0.5 rounded-sm border border-transparent hover:border-slate-300 focus:border-blue-500 bg-transparent text-rose-700 font-semibold"
                      />
                    </td>

                    {/* 7. ចេញមុន (Early) */}
                    <td className="border border-slate-300 p-0.5 text-center bg-white">
                      <input
                        type="text"
                        value={rec.early || ''}
                        onChange={(e) => {
                          const staffRecord = { ...(localData[staff.name] || {}), early: e.target.value };
                          setLocalData((prev) => ({ ...prev, [staff.name]: staffRecord }));
                        }}
                        placeholder="-"
                        className="w-full text-center text-[10.5px] p-0.5 rounded-sm border border-transparent hover:border-slate-300 focus:border-blue-500 bg-transparent text-amber-700 font-semibold"
                      />
                    </td>

                    {/* 8. លិខិតបញ្ជាក់ (Permission Document) */}
                    <td className="border border-slate-300 p-0.5 bg-white">
                      <input
                        type="text"
                        value={rec.permissionDoc || ''}
                        onChange={(e) => {
                          const staffRecord = { ...(localData[staff.name] || {}), permissionDoc: e.target.value };
                          setLocalData((prev) => ({ ...prev, [staff.name]: staffRecord }));
                        }}
                        placeholder="លិខិតច្បាប់..."
                        className="w-full text-[10.5px] p-1 rounded-sm border border-slate-200 focus:border-blue-500 bg-transparent text-slate-800"
                      />
                    </td>

                    {/* 9. ផ្សេងៗ (Other Remarks) */}
                    <td className="border border-slate-300 p-0.5 bg-white">
                      <div className="flex flex-col gap-0.5">
                        <input
                          type="text"
                          value={rec.note || ''}
                          onChange={(e) => handleNoteChange(staff.name, e.target.value)}
                          placeholder="..."
                          className="w-full text-[10.5px] p-1 rounded-sm border border-slate-200 focus:border-blue-500 bg-transparent text-slate-800"
                        />
                        {/* Quick preset badges (no-print) */}
                        <div className="no-print flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleQuickNote(staff.name, 'ច្បាប់')}
                            className="text-[9px] px-1 py-0.2 rounded-sm bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer"
                          >
                            ច្បាប់
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickNote(staff.name, 'អត់ច្បាប់')}
                            className="text-[9px] px-1 py-0.2 rounded-sm bg-rose-100 text-rose-800 hover:bg-rose-200 cursor-pointer"
                          >
                            អត់ច្បាប់
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickNote(staff.name, 'បេសកកម្ម')}
                            className="text-[9px] px-1 py-0.2 rounded-sm bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer"
                          >
                            បេសកកម្ម
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER: Exact Annex 1 of Sub-Decree 56 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 pt-1.5 border-t border-slate-300 text-xs text-slate-900 items-start">
          {/* Left Column: Stats & Disciplinary Sanctions */}
          <div className="space-y-1.5">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 leading-snug text-[10.5px] bg-slate-50 p-1.5 rounded border border-slate-200">
              <p>- សរុបអវត្តមាន: <strong className="text-red-700">{toKhmer(totalAbsent)}</strong></p>
              <p>- មានច្បាប់: <strong className="text-amber-700">{toKhmer(leaveCount)}</strong></p>
              <p>- គ្មានបៀវត្ស: <strong className="text-slate-800">{toKhmer(withoutPayCount)}</strong></p>
              <p>- ផ្សេងៗ: <strong className="text-sky-700">{toKhmer(missionCount + otherCount)}</strong></p>
            </div>

            {/* Disciplinary Sanctions Notice */}
            <div className="text-[9px] leading-tight text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 space-y-0.5">
              <p className="font-bold text-slate-900">
                សម្គាល់ ៖ ទណ្ឌកម្មវិន័យអនុវត្តចំពោះអវត្តមានគ្មានច្បាប់អនុញ្ញាត៖
              </p>
              <div>
                <p className="font-semibold text-slate-800">១- មន្ត្រីរាជការស៊ីវិល</p>
                <p className="pl-2">- ការស្តីបន្ទោស, ការស្តីបន្ទោសដោយមានចំណារ, ការផ្លាស់ដោយបង្ខំ, ការលុបឈ្មោះចេញពីក្របខណ្ឌ</p>
              </div>
              <div className="pt-0.5">
                <p className="font-semibold text-slate-800">២- មន្ត្រីជាប់កិច្ចសន្យា</p>
                <p className="pl-2">- ណែនាំលើកទី១, ណែនាំចុងក្រោយ, លុបឈ្មោះពីអង្គភាពសាមី</p>
              </div>
            </div>
          </div>

          {/* Right Column: Leave Regulations & Signature */}
          <div className="space-y-1.5 flex flex-col justify-between h-full">
            {/* Types of Leave */}
            <div className="text-[9px] leading-tight text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 space-y-0.5">
              <p className="font-bold text-slate-900 mb-0.5">
                ប្រភេទច្បាប់ឈប់សម្រាករបស់មន្ត្រីរាជការស៊ីវិលរួមមាន៖
              </p>
              <p>១- ច្បាប់ឈប់ប្រចាំឆ្នាំ <span className="float-right font-medium">១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ</span></p>
              <p>២- ច្បាប់ឈប់រយៈពេលខ្លី <span className="float-right font-medium">១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ</span></p>
              <p>៣- ច្បាប់ឈប់សម្រាកលំហែមាតុភាព <span className="float-right font-medium">៣ខែ</span></p>
              <p>៤- ច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ <span className="float-right font-medium">១២ខែ</span></p>
              <p>៥- ច្បាប់ឈប់សម្រាកកិច្ចការផ្ទាល់ខ្លួន <span className="float-right font-medium">៣ខែ</span></p>
            </div>

            {/* Official Date & Signature of Director */}
            <div className="text-center pt-0.5">
              <p className="text-[9.5px] text-slate-700 leading-tight">
                {formatKhmerLunarDate(currentDateObj)}
              </p>
              <p className="text-[10px] text-slate-900 font-semibold leading-tight mt-0.5">
                ធ្វើនៅ {SCHOOL_LOCATION_NAME} {formatKhmerSolarDate(currentDateObj)}
              </p>
              <p className="font-bold text-xs text-blue-950 mt-0.5">ប្រធាន / នាយិកា</p>

              {/* Principal Signature preview or placeholder */}
              <div className="h-9 flex items-center justify-center my-0.5 w-full">
                {directorSig ? (
                  <img
                    src={directorSig}
                    alt="ហត្ថលេខានាយិកា"
                    className="max-h-8 object-contain"
                  />
                ) : (
                  <div className="text-[10px] text-slate-400 italic">
                    (ហត្ថលេខានិងត្រា)
                  </div>
                )}
              </div>

              <p className="font-bold text-xs text-slate-900">សុខ សារើន</p>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      {activeModal && (
        <SignatureModal
          isOpen={Boolean(activeModal)}
          staffName={activeModal.staffName}
          periodLabel={activeModal.periodLabel}
          colIndex={activeModal.colIndex}
          gpsState={gpsState}
          onSave={handleSaveSignature}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Khmer Calendar Modal */}
      {isKhmerCalendarOpen && (
        <KhmerCalendarModal
          isOpen={isKhmerCalendarOpen}
          onClose={() => setIsKhmerCalendarOpen(false)}
          selectedDate={selectedDate}
          onSelectDate={onDateChange}
        />
      )}

      {/* Telegram Notification Settings & Test Modal */}
      {isTelegramModalOpen && (
        <TelegramNotificationModal
          isOpen={isTelegramModalOpen}
          onClose={() => {
            setIsTelegramModalOpen(false);
            checkTelegramStatus().then((s) => setIsTelegramConfigured(s.isConfigured));
          }}
        />
      )}
    </div>
  );
}
