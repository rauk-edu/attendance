import { useState, useEffect, useCallback } from 'react';
import {
  STAFF_LIST,
  SCHOOL_NAME,
  SCHOOL_DISTRICT,
  SCHOOL_OFFICE,
  SCHOOL_LOCATION_NAME,
  toKhmer,
  KH_MONTHS_SOLAR,
  KH_WEEKDAYS_SHORT,
  formatKhmerSolarDate,
  formatKhmerLunarDate,
  SUB_DECREE_ANNEX2,
  SUB_DECREE_ANNEX3,
  SUB_DECREE_ANNEX4,
  LEAVE_REGULATIONS,
  DISCIPLINE_SANCTIONS,
} from '../data/staff';
import {
  getKhmerLunarInfo,
  getKhmerHoliday,
  isKhmerWorkingDay,
  isSchoolWorkingDay,
  KhmerLunarInfo,
  KhmerHoliday,
} from '../utils/khmerCalendar';
import { fetchAttendanceData } from '../services/firebase';
import { DayAttendanceMap, StaffMember } from '../types';
import {
  Printer,
  Calendar,
  Layers,
  FileText,
  Clock,
  BookOpen,
  Award,
  ChevronDown,
  Download,
  FileCode,
} from 'lucide-react';
import { exportToHtmlFile, exportToPdf } from '../utils/exportUtils';

type ReportTab = 'annex3' | 'annex2' | 'annex4' | 'detail' | 'summary' | 'legal';

export default function MonthlyReport() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(STAFF_LIST[0].id);
  const [activeTab, setActiveTab] = useState<ReportTab>('annex3');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [allMonthData, setAllMonthData] = useState<Record<string, DayAttendanceMap>>({});

  // Days in selected month
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  // Determine working days using official Khmer Calendar & School Schedule:
  // - 4 teaching weeks per month:
  //   - Weeks 1, 2, 3: 6 working days (Mon-Sat, Sunday rest day)
  //   - Week 4: 5 working days (Thursday of Week 4, days 22-28, is monthly technical meeting day - non-work)
  // - Public holidays are rest days.
  const dayOfWeek: number[] = [];
  const isNonWorkDay: boolean[] = [];
  const nonWorkReasonMap: Record<number, string> = {};
  const holidaysMap: Record<number, KhmerHoliday | null> = {};
  const lunarMap: Record<number, KhmerLunarInfo> = {};
  const isMeetingMap: Record<number, boolean> = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(selectedYear, selectedMonth - 1, d).getDay();
    dayOfWeek[d] = dow;

    const mm = String(selectedMonth).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${selectedYear}-${mm}-${dd}`;

    const holiday = getKhmerHoliday(dateStr);
    holidaysMap[d] = holiday;
    lunarMap[d] = getKhmerLunarInfo(dateStr);

    const schoolDay = isSchoolWorkingDay(dateStr);
    isNonWorkDay[d] = !schoolDay.isWorking;
    nonWorkReasonMap[d] = schoolDay.reason || '';
    isMeetingMap[d] = Boolean(schoolDay.isThursdayMeeting);
  }

  // Load monthly data
  const loadMonthData = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('⏳ កំពុងទាញទិន្នន័យពី Database...');

    const monthDataMap: Record<string, DayAttendanceMap> = {};
    const promises: Promise<void>[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(selectedMonth).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${selectedYear}-${mm}-${dd}`;

      promises.push(
        fetchAttendanceData(dateStr).then((res) => {
          monthDataMap[dateStr] = res || {};
        })
      );
    }

    try {
      await Promise.all(promises);
      setAllMonthData(monthDataMap);
      setStatusMessage('');
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      setStatusMessage('⚠️ មានបញ្ហាក្នុងការទាញទិន្នន័យ: ' + err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, daysInMonth]);

  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  /**
   * Helper to check if attendance data was recorded for a given date.
   * If nobody signed or entered notes/measures, the day is unrecorded
   * and must NOT be counted as absence!
   */
  function isDayAttendanceRecorded(dayMap: DayAttendanceMap | undefined): boolean {
    if (!dayMap || typeof dayMap !== 'object') return false;
    return Object.values(dayMap).some((rec) => {
      if (!rec) return false;
      const hasSig = Boolean(
        (rec.m_in && rec.m_in.sig) ||
        (rec.m_out && rec.m_out.sig) ||
        (rec.a_in && rec.a_in.sig) ||
        (rec.a_out && rec.a_out.sig)
      );
      const hasNote = Boolean(rec.note && rec.note.trim().length > 0);
      const hasLeaveType = Boolean(rec.leaveType && rec.leaveType.trim().length > 0);
      const hasMeasure = Boolean(rec.measure && rec.measure.trim().length > 0);
      return hasSig || hasNote || hasLeaveType || hasMeasure;
    });
  }

  // Classification function
  function classifyDay(rec: any) {
    if (!rec) return 'unrecorded';
    const hasSigned = (rec.m_in && rec.m_in.sig) || (rec.a_in && rec.a_in.sig);
    if (hasSigned) return 'present';
    const note = (rec.note || '').trim();
    if (note.includes('អត់ច្បាប់')) return 'noleave';
    if (note.includes('ច្បាប់')) return 'leave';
    if (note.includes('បេសកកម្ម') || note.length > 0) return 'other';
    return 'noleave';
  }

  // Aggregate monthly attendance metrics per staff
  interface StaffMetric {
    workDays: number;
    present: number;
    leave: number;
    noleave: number;
    other: number;
    lateOrEarly: number;
    lateDetails: string[];
    permissionDocs: string[];
    leaveTypes: string[];
    measures: string[];
    notes: string[];
  }

  const staffMetrics: Record<string, StaffMetric> = {};
  STAFF_LIST.forEach((s) => {
    staffMetrics[s.name] = {
      workDays: 0,
      present: 0,
      leave: 0,
      noleave: 0,
      other: 0,
      lateOrEarly: 0,
      lateDetails: [],
      permissionDocs: [],
      leaveTypes: [],
      measures: [],
      notes: [],
    };
  });

  // Calculate day status matrix
  const dayStatus: Record<number, Record<number, string>> = {};
  STAFF_LIST.forEach((_, idx) => {
    dayStatus[idx] = {};
  });

  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(selectedMonth).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${selectedYear}-${mm}-${dd}`;
    const dayMap = allMonthData[dateStr] || {};
    const isNonWork = isNonWorkDay[d];
    const isThuMeeting = isMeetingMap[d];
    const isHoliday = Boolean(holidaysMap[d]);

    // Check if attendance was recorded for this day
    const hasDayRecords = isDayAttendanceRecorded(dayMap);

    STAFF_LIST.forEach((staff, sIdx) => {
      const rec = dayMap[staff.name];
      const m = staffMetrics[staff.name];

      if (!isNonWork) {
        m.workDays++;
      }

      // If it's an official non-working day (Sunday, 4th Thursday meeting, Holiday)
      if (isNonWork) {
        dayStatus[sIdx][d] = isHoliday ? 'holiday' : isThuMeeting ? 'meeting' : 'off';
        return;
      }

      // If working day, but NO attendance was recorded yet:
      if (!hasDayRecords) {
        dayStatus[sIdx][d] = 'unrecorded';
        // DO NOT COUNT AS ABSENCE!
        return;
      }

      // Attendance was recorded for this day:
      if (!rec) {
        // Attendance was taken by the school, but this specific staff member has no record
        dayStatus[sIdx][d] = 'noleave';
        m.noleave++;
        return;
      }

      const st = classifyDay(rec);
      dayStatus[sIdx][d] = st;

      if (st === 'present') {
        m.present++;
      } else if (st === 'leave') {
        m.leave++;
      } else if (st === 'noleave') {
        m.noleave++;
      } else if (st === 'other') {
        m.other++;
      }

      // Check late or early
      if (rec.late || rec.early) {
        m.lateOrEarly++;
        const info = [];
        if (rec.late) info.push(`យឺត: ${rec.late}`);
        if (rec.early) info.push(`ចេញមុន: ${rec.early}`);
        m.lateDetails.push(`ថ្ងៃទី${toKhmer(d)} (${info.join(', ')})`);
      }

      if (rec.permissionDoc && !m.permissionDocs.includes(rec.permissionDoc)) {
        m.permissionDocs.push(rec.permissionDoc);
      }
      if (rec.leaveType && !m.leaveTypes.includes(rec.leaveType)) {
        m.leaveTypes.push(rec.leaveType);
      }
      if (rec.measure && !m.measures.includes(rec.measure)) {
        m.measures.push(rec.measure);
      }
      if (rec.note && !m.notes.includes(rec.note)) {
        m.notes.push(rec.note);
      }
    });
  }

  // Weekly calculations for Annex 2 (5 weeks max per month)
  // Schedule: 6 working days * 3 weeks + 5 working days in week 4 (Thursday meeting)
  // Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-28, Week 5: 29-daysInMonth
  const weekStartDay = (selectedWeek - 1) * 7 + 1;
  const weekEndDay = Math.min(selectedWeek * 7, daysInMonth);

  const weeklyStaffMetrics: Record<string, {
    leave: number;
    noleave: number;
    lateOrEarly: number;
    leaveTypes: string[];
    measures: string[];
    notes: string[];
  }> = {};

  STAFF_LIST.forEach((s) => {
    weeklyStaffMetrics[s.name] = {
      leave: 0,
      noleave: 0,
      lateOrEarly: 0,
      leaveTypes: [],
      measures: [],
      notes: [],
    };
  });

  // Calculate working days in the selected week
  let workingDaysInSelectedWeek = 0;
  for (let d = weekStartDay; d <= weekEndDay; d++) {
    if (!isNonWorkDay[d]) {
      workingDaysInSelectedWeek++;
    }
  }

  for (let d = weekStartDay; d <= weekEndDay; d++) {
    const mm = String(selectedMonth).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${selectedYear}-${mm}-${dd}`;
    const dayMap = allMonthData[dateStr] || {};
    const isNonWork = isNonWorkDay[d];

    // If day is non-working, skip
    if (isNonWork) continue;

    // Check if attendance was recorded for this day
    const hasDayRecords = isDayAttendanceRecorded(dayMap);

    // If attendance was NOT recorded for this day, DO NOT mark as absence!
    if (!hasDayRecords) continue;

    STAFF_LIST.forEach((staff) => {
      const rec = dayMap[staff.name];
      const wm = weeklyStaffMetrics[staff.name];

      if (!rec) {
        wm.noleave++;
      } else {
        const st = classifyDay(rec);
        if (st === 'leave') wm.leave++;
        else if (st === 'noleave') wm.noleave++;
        if (rec.late || rec.early) wm.lateOrEarly++;
        if (rec.leaveType && !wm.leaveTypes.includes(rec.leaveType)) wm.leaveTypes.push(rec.leaveType);
        if (rec.measure && !wm.measures.includes(rec.measure)) wm.measures.push(rec.measure);
        if (rec.note && !wm.notes.includes(rec.note)) wm.notes.push(rec.note);
      }
    });
  }

  // Grand totals across all staff
  const grand = {
    workDays: 0,
    present: 0,
    leave: 0,
    noleave: 0,
    other: 0,
    lateOrEarly: 0,
  };
  STAFF_LIST.forEach((s) => {
    const m = staffMetrics[s.name];
    grand.workDays += m.workDays;
    grand.present += m.present;
    grand.leave += m.leave;
    grand.noleave += m.noleave;
    grand.other += m.other;
    grand.lateOrEarly += m.lateOrEarly;
  });
  const grandAbsence = grand.leave + grand.noleave + grand.other;
  const recordedTotal = grand.present + grandAbsence;
  const grandPct = recordedTotal > 0 ? (grand.present / recordedTotal) * 100 : 100;

  const currentMonthName = KH_MONTHS_SOLAR[selectedMonth - 1] || '';

  // Get selected staff for Annex 4 (Annual Bulletin)
  const selectedStaff = STAFF_LIST.find((s) => s.id === selectedStaffId) || STAFF_LIST[0];
  const selectedStaffMetric = staffMetrics[selectedStaff.name];

  const handlePrint = () => {
    window.print();
  };

  const getActiveTabMetadata = () => {
    switch (activeTab) {
      case 'annex3':
        return {
          title: `ឧបសម្ព័ន្ធទី៣ - របាយការណ៍វត្តមានមន្ត្រីរាជការប្រចាំខែ ${currentMonthName} ឆ្នាំ${toKhmer(selectedYear)}`,
          filename: `Upasampan3_Month_${selectedMonth}_${selectedYear}`,
        };
      case 'annex2':
        return {
          title: `ឧបសម្ព័ន្ធទី២ - របាយការណ៍អវត្តមានប្រចាំសប្តាហ៍ទី${toKhmer(selectedWeek)} ខែ ${currentMonthName} ឆ្នាំ${toKhmer(selectedYear)}`,
          filename: `Upasampan2_Week_${selectedWeek}_Month_${selectedMonth}_${selectedYear}`,
        };
      case 'annex4':
        return {
          title: `ឧបសម្ព័ន្ធទី៤ - ព្រឹត្តិបត្រការងារ ${selectedStaff.name} ឆ្នាំ${toKhmer(selectedYear)}`,
          filename: `Upasampan4_Bulletin_${selectedStaff.name.replace(/\s+/g, '_')}_${selectedYear}`,
        };
      case 'detail':
        return {
          title: `តារាងវត្តមានលម្អិតប្រចាំខែ ${currentMonthName} ឆ្នាំ${toKhmer(selectedYear)} (ថ្ងៃទី១-៣១)`,
          filename: `Tarang_Lemit_Month_${selectedMonth}_${selectedYear}`,
        };
      case 'summary':
        return {
          title: `តារាងស្ថិតិវត្តមានសរុប (%) ប្រចាំខែ ${currentMonthName} ឆ្នាំ${toKhmer(selectedYear)}`,
          filename: `Sthiti_Sarob_Month_${selectedMonth}_${selectedYear}`,
        };
      case 'legal':
        return {
          title: `មាត្រាវិន័យ និងទណ្ឌកម្ម នៃអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក`,
          filename: `Matra_Viney_Anukret56`,
        };
      default:
        return {
          title: `របាយការណ៍វត្តមានប្រចាំខែ ${currentMonthName} ឆ្នាំ${toKhmer(selectedYear)}`,
          filename: `Rohk_Report_${selectedMonth}_${selectedYear}`,
        };
    }
  };

  const handleExportHtml = () => {
    const el = document.getElementById('monthly-active-report-view');
    if (!el) return;
    const meta = getActiveTabMetadata();
    exportToHtmlFile({
      title: meta.title,
      filename: meta.filename,
      contentHtml: el.innerHTML,
      landscape: true,
    });
  };

  const handleExportPdf = () => {
    const el = document.getElementById('monthly-active-report-view');
    if (!el) return;
    const meta = getActiveTabMetadata();
    exportToPdf({
      title: meta.title,
      contentHtml: el.innerHTML,
      landscape: true,
    });
  };

  return (
    <div id="monthly-report-wrapper" className="space-y-4">
      {/* TOP CONTROL BAR (Screen Only - Compact & Clean) */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-lg space-y-2">
        {/* Month & Year pickers */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Month select */}
            <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 text-xs">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400 font-medium">ខែ៖</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-white font-bold focus:outline-hidden cursor-pointer"
              >
                {KH_MONTHS_SOLAR.map((m, idx) => (
                  <option key={idx} value={idx + 1} className="bg-slate-900 text-white">
                    {m} (ខែទី{toKhmer(idx + 1)})
                  </option>
                ))}
              </select>
            </div>

            {/* Year select */}
            <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-400 font-medium">ឆ្នាំ៖</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-white font-bold focus:outline-hidden cursor-pointer"
              >
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    {toKhmer(y)}
                  </option>
                ))}
              </select>
            </div>

            {/* Week select for Annex 2 */}
            {activeTab === 'annex2' && (
              <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-700 text-xs animate-in fade-in">
                <span className="text-slate-400 font-medium">សប្តាហ៍៖</span>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="bg-transparent text-amber-300 font-bold focus:outline-hidden cursor-pointer"
                >
                  <option value={1} className="bg-slate-900">សប្តាហ៍ទី១ (ថ្ងៃទី១-៧)</option>
                  <option value={2} className="bg-slate-900">សប្តាហ៍ទី២ (ថ្ងៃទី៨-១៤)</option>
                  <option value={3} className="bg-slate-900">សប្តាហ៍ទី៣ (ថ្ងៃទី១៥-២១)</option>
                  <option value={4} className="bg-slate-900">សប្តាហ៍ទី៤ (ថ្ងៃទី២២-២៨)</option>
                  {daysInMonth > 28 && (
                    <option value={5} className="bg-slate-900">សប្តាហ៍ទី៥ (ថ្ងៃទី២៩-{daysInMonth})</option>
                  )}
                </select>
              </div>
            )}

            {/* Staff select for Annex 4 */}
            {activeTab === 'annex4' && (
              <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-700 text-xs animate-in fade-in">
                <span className="text-slate-400 font-medium">មន្ត្រី៖</span>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="bg-transparent text-emerald-300 font-bold focus:outline-hidden cursor-pointer max-w-[170px] truncate"
                >
                  {STAFF_LIST.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900">
                      {s.name} ({s.position})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isLoading && (
              <span className="text-xs text-amber-400 font-medium animate-pulse">
                {statusMessage}
              </span>
            )}
          </div>

          {/* Export & Print Group (Compact) */}
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
              onClick={handlePrint}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-purple-300 hover:bg-purple-950/60 transition cursor-pointer"
              title="បោះពុម្ពតាមម៉ាស៊ីនព្រីន (Print)"
            >
              <Printer className="w-3 h-3" />
              <span>ព្រីន</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation: All Official Annexes of Sub-Decree 56 (Compact & Readable) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 border-t border-slate-800 pt-2">
          <button
            onClick={() => setActiveTab('annex3')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'annex3'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
            title="ឧបសម្ព័ន្ធទី៣ (វត្តមានប្រចាំខែផ្លូវការ)"
          >
            <FileText className="w-3 h-3" />
            <span>ឧបសម្ព័ន្ធទី៣</span>
          </button>

          <button
            onClick={() => setActiveTab('annex2')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'annex2'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
            title="ឧបសម្ព័ន្ធទី២ (អវត្តមានប្រចាំសប្តាហ៍)"
          >
            <Clock className="w-3 h-3" />
            <span>ឧបសម្ព័ន្ធទី២</span>
          </button>

          <button
            onClick={() => setActiveTab('annex4')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'annex4'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
            title="ឧបសម្ព័ន្ធទី៤ (ព្រឹត្តិបត្រការងារប្រចាំឆ្នាំ)"
          >
            <Award className="w-3 h-3" />
            <span>ឧបសម្ព័ន្ធទី៤</span>
          </button>

          <button
            onClick={() => setActiveTab('detail')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'detail'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
            title="តារាងលម្អិត (ថ្ងៃទី១-៣១)"
          >
            <Layers className="w-3 h-3" />
            <span>តារាងលម្អិត</span>
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'summary'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
            title="តារាងស្ថិតិសរុប (%)"
          >
            <Calendar className="w-3 h-3" />
            <span>ស្ថិតិ (%)</span>
          </button>

          <button
            onClick={() => setActiveTab('legal')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'legal'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-amber-300 hover:bg-slate-700'
            }`}
            title="មាត្រាវិន័យ និងទណ្ឌកម្ម (អនុក្រឹត្យ ៥៦)"
          >
            <BookOpen className="w-3 h-3" />
            <span>មាត្រាវិន័យ</span>
          </button>
        </div>
      </div>

      <div id="monthly-active-report-view">
        {/* ======================================================== */}
        {/* 1. ឧបសម្ព័ន្ធទី៣ នៃអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក (Page 4) */}
        {/* ======================================================== */}
        {activeTab === 'annex3' && (
        <div className="bg-white text-slate-900 p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl border border-slate-200">
          {/* Header - Matching IMG_3788 */}
          <div className="text-center text-xs sm:text-sm font-bold leading-tight text-black mb-1">
            <p className="font-['Moul'] text-xs sm:text-sm font-normal text-slate-950">
              ព្រះរាជាណាចក្រកម្ពុជា
            </p>
            <p className="font-['Moul'] text-[11px] sm:text-xs font-normal text-slate-950 mt-0.5">
              ជាតិ សាសនា ព្រះមហាក្សត្រ
            </p>
            <p className="tracking-widest text-[10px] text-slate-600">--------*--------</p>
          </div>

          <div className="text-left text-xs sm:text-sm font-semibold leading-snug text-black mb-3">
            <p className="text-slate-900">{SCHOOL_DISTRICT}</p>
            <p className="text-slate-900">{SCHOOL_OFFICE}</p>
            <p className="font-bold text-blue-900">{SCHOOL_NAME}</p>
          </div>

          {/* Title */}
          <div className="text-center mb-3">
            <h1 className="font-['Moul'] text-sm sm:text-base font-normal text-slate-950 mb-0.5">
              របាយការណ៍
            </h1>
            <h2 className="font-['Moul'] text-xs sm:text-sm font-normal text-slate-900 mb-1">
              ស្តីពី
            </h2>
            <h3 className="font-['Moul'] text-blue-900 text-sm sm:text-base font-normal leading-relaxed">
              វត្តមានប្រចាំខែរបស់មន្ត្រីរាជការស៊ីវិលនិងមន្ត្រីជាប់កិច្ចសន្យាក្នុង {SCHOOL_NAME}
            </h3>
            <p className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">
              ខែ{currentMonthName} ឆ្នាំ{toKhmer(selectedYear)}
            </p>
          </div>

          {/* Table: Exact Annex 3 Layout */}
          <div className="overflow-x-auto rounded-lg border border-slate-400">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-blue-700 text-white border-b border-blue-900">
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center w-[4%]">
                    ល.រ
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-2 text-left w-[20%]">
                    គោត្តនាមនិងនាម
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1 text-center w-[5%]">
                    ភេទ
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center w-[12%]">
                    តួនាទី
                  </th>
                  <th colSpan={3} className="border border-slate-400 p-1 text-center font-bold">
                    អវត្តមាន
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center w-[14%]">
                    វិធានការ
                  </th>
                  <th colSpan={2} className="border border-slate-400 p-1 text-center font-bold w-[22%]">
                    ផ្សេងៗ
                  </th>
                </tr>
                <tr className="bg-blue-800 text-white text-[11px]">
                  <th className="border border-slate-400 p-1 text-center min-w-[55px]">មានច្បាប់</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[55px]">អត់ច្បាប់</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[85px]">
                    មកយឺតនិងចេញមុន
                  </th>
                  <th className="border border-slate-400 p-1 text-center min-w-[100px]">
                    ប្រភេទឈប់សម្រាក
                  </th>
                  <th className="border border-slate-400 p-1 text-center min-w-[60px]">ផ្សេងៗ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {STAFF_LIST.map((staff, idx) => {
                  const m = staffMetrics[staff.name];
                  const hasAbsence = m.leave > 0 || m.noleave > 0 || m.lateOrEarly > 0;

                  return (
                    <tr
                      key={staff.id}
                      className={`hover:bg-blue-50/50 transition ${
                        idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                      }`}
                    >
                      {/* 1. ល.រ */}
                      <td className="border border-slate-300 p-1 text-center font-bold text-slate-700">
                        {toKhmer(idx + 1)}
                      </td>

                      {/* 2. គោត្តនាមនិងនាម */}
                      <td className="border border-slate-300 p-1.5 font-bold text-slate-900 whitespace-nowrap">
                        {staff.name}
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

                      {/* 5. អវត្តមាន - មានច្បាប់ */}
                      <td className="border border-slate-300 p-1 text-center font-bold text-amber-700">
                        {m.leave > 0 ? toKhmer(m.leave) : '-'}
                      </td>

                      {/* 5. អវត្តមាន - អត់ច្បាប់ */}
                      <td className="border border-slate-300 p-1 text-center font-bold text-rose-700">
                        {m.noleave > 0 ? toKhmer(m.noleave) : '-'}
                      </td>

                      {/* 5. អវត្តមាន - មកយឺតនិងចេញមុន */}
                      <td className="border border-slate-300 p-1 text-center text-[10.5px] text-slate-800">
                        {m.lateOrEarly > 0 ? `${toKhmer(m.lateOrEarly)} ដង` : '-'}
                      </td>

                      {/* 6. វិធានការ */}
                      <td className="border border-slate-300 p-1 text-center text-[10.5px] text-slate-800">
                        {m.measures.length > 0 ? m.measures.join(', ') : '-'}
                      </td>

                      {/* 7. ផ្សេងៗ - ប្រភេទឈប់សម្រាក */}
                      <td className="border border-slate-300 p-1 text-[10.5px] text-slate-800">
                        {m.leaveTypes.length > 0
                          ? m.leaveTypes.join(', ')
                          : m.leave > 0
                          ? 'ច្បាប់ឈប់សម្រាក'
                          : '-'}
                      </td>

                      {/* 7. ផ្សេងៗ - ផ្សេងៗ */}
                      <td className="border border-slate-300 p-1 text-[10.5px] text-slate-800">
                        {m.notes.length > 0 ? m.notes.join(', ') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer: Official Disciplinary Sanctions & Signature (Exact Page 4) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-300 text-xs text-slate-900 items-start">
            {/* Left Column: Disciplinary Sanctions from Sub-Decree 56 */}
            <div className="text-[10.5px] leading-snug text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
              <p className="font-bold text-slate-900">
                សម្គាល់ ៖ ទណ្ឌកម្មវិន័យអនុវត្តចំពោះអវត្តមានគ្មានច្បាប់អនុញ្ញាត៖
              </p>
              <div>
                <p className="font-semibold text-slate-800">១- មន្ត្រីរាជការស៊ីវិល</p>
                <p className="pl-3">- ការស្តីបន្ទោស</p>
                <p className="pl-3">- ការស្តីបន្ទោសដោយមានចំណារក្នុងសំណុំលិខិតផ្ទាល់ខ្លួន</p>
                <p className="pl-3">- ការផ្លាស់ដោយបង្ខំតាមវិធានការខាងវិន័យឬការលុបឈ្មោះចេញពីតារាងដំឡើងឋានន្តរស័ក្តិឬថ្នាក់</p>
                <p className="pl-3">- ការលុបឈ្មោះចេញពីក្របខណ្ឌ។</p>
              </div>
              <div className="pt-0.5">
                <p className="font-semibold text-slate-800">២- មន្ត្រីជាប់កិច្ចសន្យា</p>
                <p className="pl-3">- ណែនាំលើកទី១</p>
                <p className="pl-3">- ណែនាំចុងក្រោយ</p>
                <p className="pl-3">- លុបឈ្មោះពីអង្គភាពសាមី។</p>
              </div>
            </div>

            {/* Right Column: Leave Regulations & Signature */}
            <div className="space-y-3 flex flex-col justify-between h-full">
              {/* Leave Types */}
              <div className="text-[10.5px] leading-snug text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                <p className="font-bold text-slate-900 mb-1">
                  ប្រភេទច្បាប់ឈប់សម្រាករបស់មន្ត្រីរាជការស៊ីវិលរួមមាន៖
                </p>
                <p>១- ច្បាប់ឈប់ប្រចាំឆ្នាំ <span className="float-right font-medium">មានរយៈពេល១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ</span></p>
                <p>២- ច្បាប់ឈប់រយៈពេលខ្លី <span className="float-right font-medium">មានរយៈពេល១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ</span></p>
                <p>៣- ច្បាប់ឈប់សម្រាកលំហែមាតុភាព <span className="float-right font-medium">មានរយៈពេល៣ខែ</span></p>
                <p>៤- ច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ <span className="float-right font-medium">មានរយៈពេល១២ខែក្នុងអំឡុងពេលបម្រើការងារជាមន្ត្រី</span></p>
                <p>៥- ច្បាប់ឈប់សម្រាកដោយមានកិច្ចការផ្ទាល់ខ្លួន <span className="float-right font-medium">មានរយៈពេល៣ខែក្នុងអំឡុងពេលបម្រើការងារជាមន្ត្រី</span></p>
              </div>

              {/* Endorsement Signature */}
              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-700">
                  {formatKhmerLunarDate(today)}
                </p>
                <p className="text-xs text-slate-900 font-semibold mt-0.5">
                  ធ្វើនៅ {SCHOOL_LOCATION_NAME} {formatKhmerSolarDate(today)}
                </p>
                <p className="font-bold text-sm text-blue-950 mt-1 mb-8">ប្រធាន / នាយិកា</p>
                <p className="font-bold text-xs text-slate-900">សុខ សារើន</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. ឧបសម្ព័ន្ធទី២ នៃអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក (Page 3) */}
      {/* ======================================================== */}
      {activeTab === 'annex2' && (
        <div className="bg-white text-slate-900 p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl border border-slate-200">
          {/* Header - Matching IMG_3788 */}
          <div className="text-center text-xs sm:text-sm font-bold leading-tight text-black mb-1">
            <p className="font-['Moul'] text-xs sm:text-sm font-normal text-slate-950">
              ព្រះរាជាណាចក្រកម្ពុជា
            </p>
            <p className="font-['Moul'] text-[11px] sm:text-xs font-normal text-slate-950 mt-0.5">
              ជាតិ សាសនា ព្រះមហាក្សត្រ
            </p>
            <p className="tracking-widest text-[10px] text-slate-600">--------*--------</p>
          </div>

          <div className="text-left text-xs sm:text-sm font-semibold leading-snug text-black mb-3">
            <p className="text-slate-900">{SCHOOL_DISTRICT}</p>
            <p className="text-slate-900">{SCHOOL_OFFICE}</p>
            <p className="font-bold text-blue-900">{SCHOOL_NAME}</p>
          </div>

          {/* Title */}
          <div className="text-center mb-3">
            <h1 className="font-['Moul'] text-sm sm:text-base font-normal text-slate-950 mb-0.5">
              របាយការណ៍
            </h1>
            <h2 className="font-['Moul'] text-xs sm:text-sm font-normal text-slate-900 mb-1">
              ស្តីពី
            </h2>
            <h3 className="font-['Moul'] text-blue-900 text-sm sm:text-base font-normal leading-relaxed">
              អវត្តមានប្រចាំសប្តាហ៍របស់មន្ត្រីរាជការស៊ីវិលនិងមន្ត្រីជាប់កិច្ចសន្យាក្នុង {SCHOOL_NAME}
            </h3>
            <p className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">
              សប្តាហ៍ទី{toKhmer(selectedWeek)} (ថ្ងៃទី{toKhmer(weekStartDay)} ដល់ ថ្ងៃទី{toKhmer(weekEndDay)}) ខែ{currentMonthName} ឆ្នាំ{toKhmer(selectedYear)} • ថ្ងៃធ្វើការ៖ {toKhmer(workingDaysInSelectedWeek)} ថ្ងៃ
              {selectedWeek === 4 && ' (ថ្ងៃព្រហស្បតិ៍ ប្រជុំបច្ចេកទេស)'}
            </p>
          </div>

          {/* Table: Exact Annex 2 Structure */}
          <div className="overflow-x-auto rounded-lg border border-slate-400">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-blue-700 text-white border-b border-blue-900">
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center w-[4%]">
                    ល.រ
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-2 text-left w-[20%]">
                    គោត្តនាមនិងនាម
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1 text-center w-[5%]">
                    ភេទ
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center w-[12%]">
                    តួនាទី
                  </th>
                  <th colSpan={3} className="border border-slate-400 p-1 text-center font-bold">
                    អវត្តមាន
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center w-[14%]">
                    វិធានការ
                  </th>
                  <th colSpan={2} className="border border-slate-400 p-1 text-center font-bold w-[22%]">
                    ផ្សេងៗ
                  </th>
                </tr>
                <tr className="bg-blue-800 text-white text-[11px]">
                  <th className="border border-slate-400 p-1 text-center min-w-[55px]">មានច្បាប់</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[55px]">អត់ច្បាប់</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[85px]">
                    មកយឺតនិងចេញមុន
                  </th>
                  <th className="border border-slate-400 p-1 text-center min-w-[100px]">
                    ប្រភេទឈប់សម្រាក
                  </th>
                  <th className="border border-slate-400 p-1 text-center min-w-[60px]">ផ្សេងៗ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {STAFF_LIST.map((staff, idx) => {
                  const wm = weeklyStaffMetrics[staff.name];

                  return (
                    <tr
                      key={staff.id}
                      className={`hover:bg-blue-50/50 transition ${
                        idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                      }`}
                    >
                      <td className="border border-slate-300 p-1 text-center font-bold text-slate-700">
                        {toKhmer(idx + 1)}
                      </td>
                      <td className="border border-slate-300 p-1.5 font-bold text-slate-900 whitespace-nowrap">
                        {staff.name}
                      </td>
                      <td className="border border-slate-300 p-1 text-center text-slate-700">
                        {staff.gender}
                      </td>
                      <td className="border border-slate-300 p-1 text-center whitespace-nowrap text-slate-800 font-medium">
                        {staff.position}
                        {staff.cls !== '-' ? ` ${staff.cls}` : ''}
                      </td>
                      <td className="border border-slate-300 p-1 text-center font-bold text-amber-700">
                        {wm.leave > 0 ? toKhmer(wm.leave) : '-'}
                      </td>
                      <td className="border border-slate-300 p-1 text-center font-bold text-rose-700">
                        {wm.noleave > 0 ? toKhmer(wm.noleave) : '-'}
                      </td>
                      <td className="border border-slate-300 p-1 text-center text-[10.5px] text-slate-800">
                        {wm.lateOrEarly > 0 ? `${toKhmer(wm.lateOrEarly)} ដង` : '-'}
                      </td>
                      <td className="border border-slate-300 p-1 text-center text-[10.5px] text-slate-800">
                        {wm.measures.length > 0 ? wm.measures.join(', ') : '-'}
                      </td>
                      <td className="border border-slate-300 p-1 text-[10.5px] text-slate-800">
                        {wm.leaveTypes.length > 0 ? wm.leaveTypes.join(', ') : '-'}
                      </td>
                      <td className="border border-slate-300 p-1 text-[10.5px] text-slate-800">
                        {wm.notes.length > 0 ? wm.notes.join(', ') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer (Same authentic layout) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-300 text-xs text-slate-900 items-start">
            <div className="text-[10.5px] leading-snug text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
              <p className="font-bold text-slate-900">
                សម្គាល់ ៖ ទណ្ឌកម្មវិន័យអនុវត្តចំពោះអវត្តមានគ្មានច្បាប់អនុញ្ញាត៖
              </p>
              <div>
                <p className="font-semibold text-slate-800">១- មន្ត្រីរាជការស៊ីវិល</p>
                <p className="pl-3">- ការស្តីបន្ទោស</p>
                <p className="pl-3">- ការស្តីបន្ទោសដោយមានចំណារក្នុងសំណុំលិខិតផ្ទាល់ខ្លួន</p>
                <p className="pl-3">- ការផ្លាស់ដោយបង្ខំតាមវិធានការខាងវិន័យឬការលុបឈ្មោះចេញពីតារាងដំឡើងឋានន្តរស័ក្តិឬថ្នាក់</p>
                <p className="pl-3">- ការលុបឈ្មោះចេញពីក្របខណ្ឌ។</p>
              </div>
              <div className="pt-0.5">
                <p className="font-semibold text-slate-800">២- មន្ត្រីជាប់កិច្ចសន្យា</p>
                <p className="pl-3">- ណែនាំលើកទី១</p>
                <p className="pl-3">- ណែនាំចុងក្រោយ</p>
                <p className="pl-3">- លុបឈ្មោះពីអង្គភាពសាមី។</p>
              </div>
            </div>

            <div className="space-y-3 flex flex-col justify-between h-full">
              <div className="text-[10.5px] leading-snug text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                <p className="font-bold text-slate-900 mb-1">
                  ប្រភេទច្បាប់ឈប់សម្រាករបស់មន្ត្រីរាជការស៊ីវិលរួមមាន៖
                </p>
                <p>១- ច្បាប់ឈប់ប្រចាំឆ្នាំ <span className="float-right font-medium">១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ</span></p>
                <p>២- ច្បាប់ឈប់រយៈពេលខ្លី <span className="float-right font-medium">១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ</span></p>
                <p>៣- ច្បាប់ឈប់សម្រាកលំហែមាតុភាព <span className="float-right font-medium">៣ខែ</span></p>
                <p>៤- ច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ <span className="float-right font-medium">១២ខែ</span></p>
                <p>៥- ច្បាប់ឈប់សម្រាកដោយមានកិច្ចការផ្ទាល់ខ្លួន <span className="float-right font-medium">៣ខែ</span></p>
              </div>

              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-700">
                  {formatKhmerLunarDate(today)}
                </p>
                <p className="text-xs text-slate-900 font-semibold mt-0.5">
                  ធ្វើនៅ {SCHOOL_LOCATION_NAME} {formatKhmerSolarDate(today)}
                </p>
                <p className="font-bold text-sm text-blue-950 mt-1 mb-8">ប្រធាន / នាយិកា</p>
                <p className="font-bold text-xs text-slate-900">សុខ សារើន</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ឧបសម្ព័ន្ធទី៤ នៃអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក (Page 5) */}
      {/* ======================================================== */}
      {activeTab === 'annex4' && (
        <div className="bg-white text-slate-900 p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl border border-slate-200">
          {/* Header - Matching IMG_3788 */}
          <div className="text-center text-xs sm:text-sm font-bold leading-tight text-black mb-1">
            <p className="font-['Moul'] text-xs sm:text-sm font-normal text-slate-950">
              ព្រះរាជាណាចក្រកម្ពុជា
            </p>
            <p className="font-['Moul'] text-[11px] sm:text-xs font-normal text-slate-950 mt-0.5">
              ជាតិ សាសនា ព្រះមហាក្សត្រ
            </p>
            <p className="tracking-widest text-[10px] text-slate-600">--------*--------</p>
          </div>

          <div className="text-left text-xs sm:text-sm font-semibold leading-snug text-black mb-3">
            <p className="text-slate-900">{SCHOOL_DISTRICT}</p>
            <p className="text-slate-900">{SCHOOL_OFFICE}</p>
            <p className="font-bold text-blue-900">{SCHOOL_NAME}</p>
          </div>

          {/* Title */}
          <div className="text-center mb-4">
            <h2 className="font-['Moul'] text-blue-900 text-sm sm:text-base font-normal leading-relaxed">
              ព្រឹត្តិបត្រការងារប្រចាំឆ្នាំរបស់មន្ត្រីរាជការស៊ីវិល
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-800 mt-1">
              សម្រាប់ឆ្នាំ{toKhmer(selectedYear)}
            </p>
          </div>

          {/* Civil Servant Profile Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-300 text-xs mb-4">
            <div>
              <span className="text-slate-500 block">ឈ្មោះមន្ត្រី៖</span>
              <span className="font-bold text-slate-950 text-sm">{selectedStaff.name}</span>
            </div>
            <div>
              <span className="text-slate-500 block">ភេទ៖</span>
              <span className="font-bold text-slate-900">{selectedStaff.gender}</span>
            </div>
            <div>
              <span className="text-slate-500 block">តួនាទី/ថ្នាក់៖</span>
              <span className="font-bold text-slate-900">
                {selectedStaff.position} {selectedStaff.cls !== '-' ? selectedStaff.cls : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">អត្តលេខមន្ត្រី៖</span>
              <span className="font-bold font-mono text-blue-900">{selectedStaff.id}</span>
            </div>
          </div>

          {/* Annual Ledger Grid: Exactly matching Page 5 */}
          <div className="overflow-x-auto rounded-lg border border-slate-400">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-blue-700 text-white border-b border-blue-900">
                  <th colSpan={13} className="p-2 text-center font-bold">
                    ប្រភេទនៃច្បាប់ឈប់គ្រប់ប្រភេទរបស់មន្ត្រីរាជការស៊ីវិល
                  </th>
                </tr>
                <tr className="bg-blue-800 text-white text-[11px]">
                  {/* Category 1 */}
                  <th colSpan={3} className="border border-slate-400 p-1.5 text-center">
                    ១. ច្បាប់ឈប់ប្រចាំឆ្នាំ
                    <br />
                    <span className="text-[10px] font-normal">មានចំនួន ១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ</span>
                  </th>
                  {/* Category 2 */}
                  <th colSpan={2} className="border border-slate-400 p-1.5 text-center">
                    ២. ច្បាប់រយៈពេលខ្លី
                    <br />
                    <span className="text-[10px] font-normal">ខ្លីមានចំនួន ១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ</span>
                  </th>
                  {/* Category 3 */}
                  <th colSpan={1} className="border border-slate-400 p-1.5 text-center">
                    ៣. ច្បាប់ឈប់សម្រាកលំហែមាតុភាព
                    <br />
                    <span className="text-[10px] font-normal">មានចំនួន ៣ខែ</span>
                  </th>
                  {/* Category 4 */}
                  <th colSpan={2} className="border border-slate-400 p-1.5 text-center">
                    ៤. ច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ
                    <br />
                    <span className="text-[10px] font-normal">មានចំនួន ១២ខែ (សម្រាប់មួយជីវិតជាមន្ត្រី)</span>
                  </th>
                  {/* Category 5 */}
                  <th colSpan={2} className="border border-slate-400 p-1.5 text-center">
                    ៥. ច្បាប់ឈប់សម្រាកដោយមានកិច្ចការផ្ទាល់ខ្លួន
                    <br />
                    <span className="text-[10px] font-normal">មានចំនួន ៣ខែ (សម្រាប់មួយជីវិតជាមន្ត្រី)</span>
                  </th>
                  {/* Category 6 */}
                  <th colSpan={2} className="border border-slate-400 p-1.5 text-center">
                    ទណ្ឌកម្មវិន័យ និងវិធានការ
                  </th>
                </tr>
                <tr className="bg-slate-100 text-slate-900 text-[10.5px]">
                  <th className="border border-slate-300 p-1 text-center">ចំនួនថ្ងៃដែលបានអនុវត្តក្នុងឆ្នាំចាស់</th>
                  <th className="border border-slate-300 p-1 text-center">ចំនួនថ្ងៃដែលត្រូវទូទាត់សងឈប់សម្រាកផ្សេងៗ</th>
                  <th className="border border-slate-300 p-1 text-center">ចំនួនថ្ងៃឈប់សម្រាកប្រចាំឆ្នាំបន្ថែម</th>
                  <th className="border border-slate-300 p-1 text-center">ចំនួនថ្ងៃដែលបានអនុវត្ត</th>
                  <th className="border border-slate-300 p-1 text-center">ចំនួនថ្ងៃដែលមិនទាន់បានអនុវត្ត</th>
                  <th className="border border-slate-300 p-1 text-center">ចំនួនខែដែលបានអនុវត្ត</th>
                  <th className="border border-slate-300 p-1 text-center">ចំនួនខែដែលបានអនុវត្ត</th>
                  <th className="border border-slate-300 p-1 text-center">ចំនួនខែដែលមិនទាន់បានអនុវត្ត</th>
                  <th className="border border-slate-300 p-1 text-center">ចំនួនខែដែលបានអនុវត្ត</th>
                  <th className="border border-slate-300 p-1 text-center">ចំនួនខែដែលមិនទាន់បានអនុវត្ត</th>
                  <th className="border border-slate-300 p-1 text-center">ទណ្ឌកម្មវិន័យ</th>
                  <th className="border border-slate-300 p-1 text-center">វិធានការ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white text-center font-bold">
                  {/* Category 1 */}
                  <td className="border border-slate-300 p-2 text-slate-700">០ ថ្ងៃ</td>
                  <td className="border border-slate-300 p-2 text-slate-700">០ ថ្ងៃ</td>
                  <td className="border border-slate-300 p-2 text-blue-900">១៥ ថ្ងៃ</td>
                  {/* Category 2 */}
                  <td className="border border-slate-300 p-2 text-amber-700">
                    {toKhmer(selectedStaffMetric.leave)} ថ្ងៃ
                  </td>
                  <td className="border border-slate-300 p-2 text-emerald-700">
                    {toKhmer(Math.max(0, 15 - selectedStaffMetric.leave))} ថ្ងៃ
                  </td>
                  {/* Category 3 */}
                  <td className="border border-slate-300 p-2 text-slate-700">
                    {selectedStaff.gender === 'ស្រី' && selectedStaffMetric.leaveTypes.some(t => t.includes('មាតុភាព'))
                      ? '៣ ខែ'
                      : '០ ខែ'}
                  </td>
                  {/* Category 4 */}
                  <td className="border border-slate-300 p-2 text-slate-700">
                    {selectedStaffMetric.leaveTypes.some(t => t.includes('ជំងឺ')) ? '១ ខែ' : '០ ខែ'}
                  </td>
                  <td className="border border-slate-300 p-2 text-slate-700">
                    {selectedStaffMetric.leaveTypes.some(t => t.includes('ជំងឺ')) ? '១១ ខែ' : '១២ ខែ'}
                  </td>
                  {/* Category 5 */}
                  <td className="border border-slate-300 p-2 text-slate-700">
                    {selectedStaffMetric.leaveTypes.some(t => t.includes('ផ្ទាល់ខ្លួន')) ? '១ ខែ' : '០ ខែ'}
                  </td>
                  <td className="border border-slate-300 p-2 text-slate-700">
                    {selectedStaffMetric.leaveTypes.some(t => t.includes('ផ្ទាល់ខ្លួន')) ? '២ ខែ' : '៣ ខែ'}
                  </td>
                  {/* Category 6 */}
                  <td className="border border-slate-300 p-2 text-rose-700">
                    {selectedStaffMetric.noleave > 0 ? `អវត្តមានអត់ច្បាប់ ${toKhmer(selectedStaffMetric.noleave)} ថ្ងៃ` : '-'}
                  </td>
                  <td className="border border-slate-300 p-2 text-slate-800">
                    {selectedStaffMetric.measures.length > 0 ? selectedStaffMetric.measures.join(', ') : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer (Matching Page 5) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-300 text-xs text-slate-900 items-start">
            <div className="text-[10.5px] leading-snug text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
              <p className="font-bold text-slate-900">
                សម្គាល់ ៖ ទណ្ឌកម្មវិន័យអនុវត្តចំពោះអវត្តមានគ្មានច្បាប់អនុញ្ញាត៖
              </p>
              <div>
                <p className="font-semibold text-slate-800">១- មន្ត្រីរាជការស៊ីវិល</p>
                <p className="pl-3">- ការស្តីបន្ទោស</p>
                <p className="pl-3">- ការស្តីបន្ទោសដោយមានចំណារក្នុងសំណុំលិខិតផ្ទាល់ខ្លួន</p>
                <p className="pl-3">- ការផ្លាស់ដោយបង្ខំតាមវិធានការខាងវិន័យឬការលុបឈ្មោះចេញពីតារាងដំឡើងឋានន្តរស័ក្តិឬថ្នាក់</p>
                <p className="pl-3">- ការលុបឈ្មោះចេញពីក្របខណ្ឌ។</p>
              </div>
              <div className="pt-0.5">
                <p className="font-semibold text-slate-800">២- មន្ត្រីជាប់កិច្ចសន្យា</p>
                <p className="pl-3">- ណែនាំលើកទី១</p>
                <p className="pl-3">- ណែនាំចុងក្រោយ</p>
                <p className="pl-3">- លុបឈ្មោះពីអង្គភាពសាមី។</p>
              </div>
            </div>

            <div className="space-y-3 flex flex-col justify-between h-full">
              <div className="text-[10.5px] leading-snug text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                <p className="font-bold text-slate-900 mb-1">
                  ប្រភេទច្បាប់ឈប់សម្រាករបស់មន្ត្រីរាជការស៊ីវិលរួមមាន៖
                </p>
                <p>១- ច្បាប់ឈប់ប្រចាំឆ្នាំ <span className="float-right font-medium">១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ</span></p>
                <p>២- ច្បាប់ឈប់រយៈពេលខ្លី <span className="float-right font-medium">១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ</span></p>
                <p>៣- ច្បាប់ឈប់សម្រាកលំហែមាតុភាព <span className="float-right font-medium">៣ខែ</span></p>
                <p>៤- ច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ <span className="float-right font-medium">១២ខែ</span></p>
                <p>៥- ច្បាប់ឈប់សម្រាកដោយមានកិច្ចការផ្ទាល់ខ្លួន <span className="float-right font-medium">៣ខែ</span></p>
              </div>

              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-700">
                  {formatKhmerLunarDate(today)}
                </p>
                <p className="text-xs text-slate-900 font-semibold mt-0.5">
                  ធ្វើនៅ {SCHOOL_LOCATION_NAME} {formatKhmerSolarDate(today)}
                </p>
                <p className="font-bold text-sm text-blue-950 mt-1 mb-8">ប្រធាន / នាយិកា</p>
                <p className="font-bold text-xs text-slate-900">សុខ សារើន</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. DETAIL VIEW (31 DAYS CALENDAR GRID) */}
      {/* ======================================================== */}
      {activeTab === 'detail' && (
        <div className="bg-white text-slate-900 p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl border border-slate-200">
          {/* Header */}
          <div className="text-center text-xs sm:text-sm font-bold leading-relaxed text-black mb-2">
            <p className="font-['Moul'] text-sm sm:text-base font-normal">
              ព្រះរាជាណាចក្រកម្ពុជា
            </p>
            <p className="font-['Moul'] text-xs sm:text-sm font-normal">
              ជាតិ សាសនា ព្រះមហាក្សត្រ
            </p>
            <p className="tracking-widest text-[11px] text-slate-600">--------*--------</p>
          </div>

          <div className="text-left text-xs sm:text-sm font-semibold leading-relaxed text-black mb-3">
            <p>{SCHOOL_DISTRICT}</p>
            <p>{SCHOOL_OFFICE}</p>
            <p className="font-bold text-blue-900">{SCHOOL_NAME}</p>
          </div>

          <div className="text-center mb-4">
            <h2 className="font-['Moul'] text-blue-800 text-base sm:text-lg font-normal">
              របាយការណ៍វត្តមានប្រចាំខែ {currentMonthName} ឆ្នាំ{toKhmer(selectedYear)}
            </h2>
          </div>

          {/* Legend */}
          <div className="no-print flex items-center flex-wrap gap-3 sm:gap-4 text-xs text-slate-700 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl mb-3">
            <div><span className="font-bold text-emerald-700">✓</span> = មកធ្វើការ</div>
            <div><span className="font-bold text-amber-600">ច</span> = មានច្បាប់</div>
            <div><span className="font-bold text-rose-600">អ</span> = អត់ច្បាប់</div>
            <div><span className="font-bold text-sky-600">ផ</span> = ផ្សេងៗ</div>
            <div><span className="font-bold text-slate-400">–</span> = ថ្ងៃឈប់សម្រាក</div>
            <div className="flex items-center gap-1"><span className="text-rose-600 font-bold">🏖️</span> = បុណ្យជាតិ</div>
            <div className="flex items-center gap-1"><span className="text-amber-500 font-bold">🌕</span> = ថ្ងៃសីល</div>
            <div className="ml-auto text-[11px] text-slate-600 font-medium">* ពណ៌ក្រហម = បុណ្យជាតិ | ពណ៌ប្រផេះ = ថ្ងៃអាទិត្យ</div>
          </div>

          {/* Big Detailed Days Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-300">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-blue-700 text-white">
                  <th rowSpan={4} className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                    ល.រ
                  </th>
                  <th rowSpan={4} className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                    អត្តលេខ
                  </th>
                  <th rowSpan={4} className="border border-slate-400 p-1.5 text-left whitespace-nowrap">
                    គោត្តនាមនិងនាម
                  </th>
                  <th rowSpan={4} className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                    ភេទ
                  </th>
                  <th colSpan={daysInMonth} className="border border-slate-400 p-1 text-center font-bold">
                    ប្រតិទិនកាលបរិច្ឆេទប្រចាំខែ {currentMonthName} (សុរិយគតិ & ចន្ទគតិ)
                  </th>
                  <th rowSpan={4} className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                    សរុបអវត្តមាន
                  </th>
                  <th rowSpan={4} className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                    មានច្បាប់
                  </th>
                  <th rowSpan={4} className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                    អត់ច្បាប់
                  </th>
                  <th rowSpan={4} className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                    ផ្សេងៗ
                  </th>
                </tr>
                {/* Days of Week short names */}
                <tr className="bg-blue-800 text-white text-[10px]">
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                    <th
                      key={d}
                      className={`border border-slate-400 p-0.5 text-center min-w-[22px] ${
                        holidaysMap[d]
                          ? 'bg-rose-800 text-rose-100 font-bold'
                          : isNonWorkDay[d]
                          ? 'bg-slate-700 text-slate-300'
                          : ''
                      }`}
                      title={holidaysMap[d]?.name}
                    >
                      {KH_WEEKDAYS_SHORT[dayOfWeek[d]]}
                    </th>
                  ))}
                </tr>
                {/* Solar Day numbers */}
                <tr className="bg-blue-800 text-white text-[11px]">
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                    <th
                      key={d}
                      className={`border border-slate-400 p-0.5 text-center min-w-[22px] ${
                        holidaysMap[d]
                          ? 'bg-rose-800 text-rose-100 font-bold'
                          : isNonWorkDay[d]
                          ? 'bg-slate-700 text-slate-300'
                          : ''
                      }`}
                      title={holidaysMap[d]?.name}
                    >
                      {toKhmer(d)}
                    </th>
                  ))}
                </tr>
                {/* Lunar Days (ចន្ទគតិ) & Buddhist Holy Days */}
                <tr className="bg-blue-900 text-amber-200 text-[8.5px]">
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                    const l = lunarMap[d];
                    return (
                      <th
                        key={d}
                        className={`border border-slate-400 p-0.5 text-center min-w-[22px] leading-tight ${
                          holidaysMap[d]
                            ? 'bg-rose-900 text-amber-300'
                            : isNonWorkDay[d]
                            ? 'bg-slate-800 text-slate-400'
                            : ''
                        }`}
                        title={l?.isBuddhistHolyDay ? l.holyDayLabel : `${toKhmer(l?.dayNumber)}${l?.phase}`}
                      >
                        {l?.isBuddhistHolyDay ? (
                          <span className="text-amber-300 font-bold">🌕</span>
                        ) : (
                          `${toKhmer(l?.dayNumber || 0)}${l?.phase === 'កើត' ? 'ក' : 'រ'}`
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {STAFF_LIST.map((staff, idx) => {
                  const m = staffMetrics[staff.name];
                  const totalAbsence = m.leave + m.noleave + m.other;

                  return (
                    <tr
                      key={staff.id}
                      className={`hover:bg-blue-50/50 transition ${
                        idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                      }`}
                    >
                      <td className="border border-slate-300 p-1 text-center font-bold text-slate-700">
                        {toKhmer(idx + 1)}
                      </td>
                      <td className="border border-slate-300 p-1 text-center font-mono text-[11px] text-slate-700">
                        {staff.id}
                      </td>
                      <td className="border border-slate-300 p-1 font-bold text-slate-900 whitespace-nowrap">
                        {staff.name}
                      </td>
                      <td className="border border-slate-300 p-1 text-center text-slate-700">
                        {staff.gender}
                      </td>

                      {/* Day cells */}
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                        const st = dayStatus[idx]?.[d];
                        const isOff = isNonWorkDay[d];
                        const isHoliday = Boolean(holidaysMap[d]);
                        const isThuMeeting = isMeetingMap[d];

                        return (
                          <td
                            key={d}
                            className={`border border-slate-300 p-0.5 text-center font-bold text-[11px] ${
                              isHoliday
                                ? 'bg-rose-100/80 text-rose-800'
                                : isThuMeeting
                                ? 'bg-indigo-100/90 text-indigo-900'
                                : isOff
                                ? 'bg-slate-200/80 text-slate-500'
                                : st === 'present'
                                ? 'text-emerald-700 font-extrabold'
                                : st === 'leave'
                                ? 'text-amber-600'
                                : st === 'noleave'
                                ? 'text-rose-600 font-extrabold bg-rose-50'
                                : st === 'other'
                                ? 'text-sky-600'
                                : 'text-slate-400'
                            }`}
                            title={
                              isHoliday
                                ? `បុណ្យជាតិ: ${holidaysMap[d]?.name}`
                                : isThuMeeting
                                ? 'ថ្ងៃព្រហស្បតិ៍សប្ដាហ៍ទី៤ (ប្រជុំបច្ចេកទេសប្រចាំខែ)'
                                : isOff
                                ? nonWorkReasonMap[d]
                                : st === 'unrecorded'
                                ? 'មិនទាន់កត់ត្រាវត្តមាន'
                                : undefined
                            }
                          >
                            {isHoliday
                              ? '🏖️'
                              : isThuMeeting
                              ? '🏛️'
                              : isOff
                              ? '-'
                              : st === 'present'
                              ? '✓'
                              : st === 'leave'
                              ? 'ច'
                              : st === 'noleave'
                              ? 'អ'
                              : st === 'other'
                              ? 'ផ'
                              : '–'}
                          </td>
                        );
                      })}

                      {/* Summary columns */}
                      <td className="border border-slate-300 p-1 text-center font-bold text-slate-900">
                        {toKhmer(totalAbsence)}
                      </td>
                      <td className="border border-slate-300 p-1 text-center font-bold text-amber-700">
                        {toKhmer(m.leave)}
                      </td>
                      <td className="border border-slate-300 p-1 text-center font-bold text-rose-700">
                        {toKhmer(m.noleave)}
                      </td>
                      <td className="border border-slate-300 p-1 text-center font-bold text-sky-700">
                        {toKhmer(m.other)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="text-[11px] text-slate-600 space-x-3 mt-2 flex flex-wrap gap-y-1">
            <span><strong className="text-emerald-700">✓</strong> វត្តមាន</span>
            <span><strong className="text-amber-600">ច</strong> ច្បាប់</span>
            <span><strong className="text-rose-600">អ</strong> អត់ច្បាប់</span>
            <span><strong className="text-sky-600">ផ</strong> ផ្សេងៗ</span>
            <span><strong className="text-indigo-800">🏛️</strong> ប្រជុំបច្ចេកទេស (ព្រហស្បតិ៍ទី៤)</span>
            <span><strong className="text-rose-700">🏖️</strong> ថ្ងៃបុណ្យជាតិ</span>
            <span><strong className="text-slate-500">-</strong> ថ្ងៃអាទិត្យ/ឈប់</span>
            <span><strong className="text-slate-400">–</strong> មិនទាន់កត់ត្រា</span>
          </div>

          {/* Grand totals text */}
          <div className="text-center font-bold text-xs sm:text-sm text-slate-800 mt-4 p-2 bg-slate-100 rounded-xl border border-slate-200">
            សរុបរួម — មន្ត្រី-បុគ្គលិក {toKhmer(STAFF_LIST.length)} នាក់ | ថ្ងៃធ្វើការសរុប {toKhmer(grand.workDays)} | មកធ្វើការសរុប {toKhmer(grand.present)} | អវត្តមានសរុប {toKhmer(grandAbsence)} | ភាគរយវត្តមានសរុប {toKhmer(grandPct.toFixed(1))}%
          </div>

          {/* Footer signature */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-300 text-xs items-start">
            <div />
            <div />
            <div className="text-center">
              <p className="text-[11px] text-slate-700 font-semibold">
                {formatKhmerLunarDate(today)}
              </p>
              <p className="text-xs text-slate-800 font-bold">
                រោគ {formatKhmerSolarDate(today)}
              </p>
              <p className="font-bold text-sm text-blue-950 mt-1 mb-8">នាយិកា</p>
              <p className="font-bold text-sm text-slate-900">សុខ សារើន</p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. SUMMARY REPORT TABLE VIEW */}
      {/* ======================================================== */}
      {activeTab === 'summary' && (
        <div className="bg-white text-slate-900 p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl border border-slate-200">
          {/* Header */}
          <div className="text-center text-xs sm:text-sm font-bold leading-relaxed text-black mb-2">
            <p className="font-['Moul'] text-sm sm:text-base font-normal">
              ព្រះរាជាណាចក្រកម្ពុជា
            </p>
            <p className="font-['Moul'] text-xs sm:text-sm font-normal">
              ជាតិ សាសនា ព្រះមហាក្សត្រ
            </p>
            <p className="tracking-widest text-[11px] text-slate-600">--------*--------</p>
          </div>

          <div className="text-left text-xs sm:text-sm font-semibold leading-relaxed text-black mb-3">
            <p>{SCHOOL_DISTRICT}</p>
            <p>{SCHOOL_OFFICE}</p>
            <p className="font-bold text-blue-900">{SCHOOL_NAME}</p>
          </div>

          <div className="text-center mb-4">
            <h2 className="font-['Moul'] text-blue-800 text-base sm:text-lg font-normal">
              តារាងសរុបវត្តមានប្រចាំខែ {currentMonthName} ឆ្នាំ{toKhmer(selectedYear)}
            </h2>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-300">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-blue-700 text-white">
                  <th className="border border-slate-400 p-2 text-center">ល.រ</th>
                  <th className="border border-slate-400 p-2 text-center">អត្តលេខ</th>
                  <th className="border border-slate-400 p-2 text-left">គោត្តនាមនិងនាម</th>
                  <th className="border border-slate-400 p-2 text-center">ភេទ</th>
                  <th className="border border-slate-400 p-2 text-center">ចំនួនថ្ងៃធ្វើការ</th>
                  <th className="border border-slate-400 p-2 text-center">ថ្ងៃមកធ្វើការ</th>
                  <th className="border border-slate-400 p-2 text-center">ចំនួនអវត្តមាន</th>
                  <th className="border border-slate-400 p-2 text-center">មានច្បាប់</th>
                  <th className="border border-slate-400 p-2 text-center">អត់ច្បាប់</th>
                  <th className="border border-slate-400 p-2 text-center">ផ្សេងៗ</th>
                  <th className="border border-slate-400 p-2 text-center">
                    ភាគរយ<br />វត្តមាន
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {STAFF_LIST.map((staff, idx) => {
                  const m = staffMetrics[staff.name];
                  const totalAbsence = m.leave + m.noleave + m.other;
                  const recordedDays = m.present + totalAbsence;
                  const pct = recordedDays > 0 ? (m.present / recordedDays) * 100 : 100;

                  return (
                    <tr
                      key={staff.id}
                      className={`hover:bg-blue-50/50 transition ${
                        idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                      }`}
                    >
                      <td className="border border-slate-300 p-2 text-center font-bold text-slate-700">
                        {toKhmer(idx + 1)}
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-mono text-[11px] text-slate-700">
                        {staff.id}
                      </td>
                      <td className="border border-slate-300 p-2 font-bold text-slate-900 whitespace-nowrap">
                        {staff.name}
                      </td>
                      <td className="border border-slate-300 p-2 text-center text-slate-700">
                        {staff.gender}
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-bold text-slate-800">
                        {toKhmer(m.workDays)}
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-bold text-emerald-700">
                        {toKhmer(m.present)}
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-bold text-rose-700">
                        {toKhmer(totalAbsence)}
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-semibold text-amber-700">
                        {toKhmer(m.leave)}
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-semibold text-rose-700">
                        {toKhmer(m.noleave)}
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-semibold text-sky-700">
                        {toKhmer(m.other)}
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-bold text-blue-900">
                        {toKhmer(pct.toFixed(1))}%
                      </td>
                    </tr>
                  );
                })}

                {/* Grand totals row */}
                <tr className="bg-blue-900 text-white font-bold text-xs">
                  <td colSpan={4} className="border border-blue-950 p-2 text-center">
                    សរុបរួម
                  </td>
                  <td className="border border-blue-950 p-2 text-center">
                    {toKhmer(grand.workDays)}
                  </td>
                  <td className="border border-blue-950 p-2 text-center text-emerald-300">
                    {toKhmer(grand.present)}
                  </td>
                  <td className="border border-blue-950 p-2 text-center text-rose-300">
                    {toKhmer(grandAbsence)}
                  </td>
                  <td className="border border-blue-950 p-2 text-center text-amber-300">
                    {toKhmer(grand.leave)}
                  </td>
                  <td className="border border-blue-950 p-2 text-center text-rose-300">
                    {toKhmer(grand.noleave)}
                  </td>
                  <td className="border border-blue-950 p-2 text-center text-sky-300">
                    {toKhmer(grand.other)}
                  </td>
                  <td className="border border-blue-950 p-2 text-center text-yellow-300">
                    {toKhmer(grandPct.toFixed(1))}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer signature */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-300 text-xs items-start">
            <div />
            <div />
            <div className="text-center">
              <p className="text-[11px] text-slate-700 font-semibold">
                {formatKhmerLunarDate(today)}
              </p>
              <p className="text-xs text-slate-800 font-bold">
                រោគ {formatKhmerSolarDate(today)}
              </p>
              <p className="font-bold text-sm text-blue-950 mt-1 mb-8">នាយិកា</p>
              <p className="font-bold text-sm text-slate-900">សុខ សារើន</p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. LEGAL ARTICLES VIEW (អនុក្រឹត្យលេខ ៥៦ អនក្រ.បក - Page 2) */}
      {/* ======================================================== */}
      {activeTab === 'legal' && (
        <div className="bg-white text-slate-900 p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl border border-slate-200 space-y-4">
          <div className="text-center border-b border-slate-200 pb-3">
            <h2 className="font-['Moul'] text-blue-900 text-sm sm:text-base font-normal">
              មាត្រាស្តីពីវិន័យ និងការអនុវត្តទណ្ឌកម្ម នៃអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              (ដកស្រង់ពីទំព័រទី២ នៃទម្រង់ច្បាប់ផ្លូវការ សម្រាប់មន្ត្រីរាជការស៊ីវិល និងមន្ត្រីជាប់កិច្ចសន្យា)
            </p>
          </div>

          <div className="space-y-4 text-xs leading-relaxed text-slate-800">
            {/* គ. មន្ត្រីរាជការស៊ីវិល */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h3 className="font-bold text-sm text-blue-900 border-b border-slate-300 pb-1">
                គ. មន្ត្រីរាជការស៊ីវិល
              </h3>

              <div className="space-y-1">
                <p className="font-bold text-slate-900">មាត្រា១៧ ៖</p>
                <p className="pl-4">
                  ប្រធានអង្គភាពគ្រប់គ្រងផ្ទាល់ ត្រូវធ្វើការស្តីបន្ទោសចំពោះមន្ត្រីរាជការអវត្តមានគ្មានច្បាប់អនុញ្ញាត មិនបានបំពេញកាតព្វកិច្ចរបស់ខ្លួនផ្នែកលើលទ្ធផលការងារ ក្នុងករណីដូចខាងក្រោម៖
                </p>
                <p className="pl-8">- មកបំពេញការងារយឺតឬចេញមុនម៉ោងដោយគ្មានមូលហេតុ លើសពី ៣០ (សាមសិប) នាទីឡើងទៅ ដោយគ្មានការអនុញ្ញាត គិតដល់យ៉ាងតិចចំនួន ២ (ពីរ) ដងក្នុងរយៈពេលមួយសប្តាហ៍</p>
                <p className="pl-8">- អវត្តមានគ្មានច្បាប់អនុញ្ញាតចំនួន ២ ថ្ងៃជាប់គ្នាដោយគ្មានការអនុញ្ញាត (ឬ) ៤ ថ្ងៃក្នុងអំឡុងពេល ៣ (បី) ខែ</p>
                <p className="pl-8">- អវត្តមានគ្មានច្បាប់អនុញ្ញាតក្នុងពេលបំពេញបេសកកម្មចំនួន ២ (ពីរ) ថ្ងៃនៃថ្ងៃធ្វើការ</p>
                <p className="pl-8">- មិនបានបំពេញទាំងស្រុងនូវកាតព្វកិច្ចរបស់ខ្លួនផ្នែកលើលទ្ធផលការងារដែលបានកំណត់ ដោយប្រធានអង្គភាព។</p>
              </div>

              <div className="space-y-1 pt-2">
                <p className="font-bold text-slate-900">មាត្រា១៨ ៖</p>
                <p className="pl-4">
                  ប្រធានអង្គភាពគ្រប់គ្រងផ្ទាល់ ត្រូវធ្វើការស្តីបន្ទោសដោយមានចំណារក្នុងសំណុំលិខិតផ្ទាល់ខ្លួន ចំពោះមន្ត្រីរាជការស៊ីវិលដែលអវត្តមានគ្មានច្បាប់អនុញ្ញាត ឬមិនបានបំពេញកាតព្វកិច្ចរបស់ខ្លួនផ្នែកលើលទ្ធផលការងារដូចខាងក្រោម៖
                </p>
                <p className="pl-8">- អវត្តមានគ្មានច្បាប់អនុញ្ញាតចំនួន ៣ ថ្ងៃជាប់គ្នា ឬ ៥ (ប្រាំ) ថ្ងៃនៃថ្ងៃធ្វើការ ក្នុងរយៈពេល ៣ (បី) ខែ</p>
                <p className="pl-8">- ករណីមិនរាងចាលដោយបានប្រព្រឹត្តកំហុសដូចមានចែងក្នុងមាត្រា១៧ ក្នុងកំឡុងពេល ៣ (បី) ខែ។</p>
              </div>

              <div className="space-y-1 pt-2">
                <p className="font-bold text-slate-900">មាត្រា១៩ ៖</p>
                <p className="pl-4">
                  ប្រធានអង្គភាពគ្រប់គ្រងផ្ទាល់ ត្រូវធ្វើការសម្រេចប្តូរលើកតម្កើង ដើម្បីធ្វើការផ្លាស់ដោយបង្ខំតាមវិធានការខាងវិន័យឬការលុបឈ្មោះចេញពីតារាងដំឡើងឋានន្តរស័ក្តិឬថ្នាក់ របស់មន្ត្រីរាជការស៊ីវិលចំពោះមន្ត្រីរាជការអវត្តមានគ្មានច្បាប់អនុញ្ញាត ឬមិនបានបំពេញកាតព្វកិច្ចរបស់ខ្លួនផ្នែកលើលទ្ធផលការងារ ដូចខាងក្រោម៖
                </p>
                <p className="pl-8">- អវត្តមានគ្មានច្បាប់អនុញ្ញាតជាប់គ្នាចាប់ពី ៥ ថ្ងៃ (ប្រាំថ្ងៃ) ឡើងដល់ក្រោម ១៥ (ដប់ប្រាំ) ថ្ងៃនៃថ្ងៃធ្វើការ</p>
                <p className="pl-8">- ករណីមិនរាងចាលដោយបានប្រព្រឹត្តកំហុសដូចមានចែងក្នុងមាត្រា១៨ ក្នុងកំឡុងពេល មួយឆ្នាំ។</p>
              </div>

              <div className="space-y-1 pt-2">
                <p className="font-bold text-slate-900">មាត្រា២០ ៖</p>
                <p className="pl-4">
                  មន្ត្រីរាជការស៊ីវិលត្រូវប្រឈមនឹងទណ្ឌកម្មខាងវិន័យលុបឈ្មោះពីក្របខណ្ឌ ផ្នែកលើនីតិវិធីដែលបានចែងក្នុងអនុក្រឹត្យចំពោះករណីដូចខាងក្រោម៖
                </p>
                <p className="pl-8">- ស្ថិតក្នុងករណីមិនរាងចាលដោយបានប្រព្រឹត្តកំហុសដែលបានចែងក្នុងមាត្រា១៩នៃអនុក្រឹត្យនេះ</p>
                <p className="pl-8">- អវត្តមានគ្មានច្បាប់អនុញ្ញាតជាប់គ្នាចាប់ពី ១៥ (ដប់ប្រាំ) ថ្ងៃនៃថ្ងៃធ្វើការឡើងទៅ ហើយដែលមិនអាចអនុវត្តវិធានការបន្តបន្ទាប់បាន ដោយអនុលោមតាមបទប្បញ្ញត្តិនៃអនុក្រឹត្យនេះ។</p>
              </div>
            </div>

            {/* ខ. មន្ត្រីជាប់កិច្ចសន្យា */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h3 className="font-bold text-sm text-blue-900 border-b border-slate-300 pb-1">
                ខ. មន្ត្រីជាប់កិច្ចសន្យា
              </h3>

              <div className="space-y-1">
                <p className="font-bold text-slate-900">មាត្រា២៣ ៖</p>
                <p className="pl-4">
                  ប្រធានអង្គភាពគ្រប់គ្រងផ្ទាល់ ត្រូវធ្វើការណែនាំលើកទី១ ចំពោះមន្ត្រីជាប់កិច្ចសន្យាដែលអវត្តមានគ្មានច្បាប់អនុញ្ញាត ឬមិនបានបំពេញកាតព្វកិច្ចរបស់ខ្លួនផ្នែកលើលទ្ធផលការងារ ដូចខាងក្រោម៖
                </p>
                <p className="pl-8">- មកបំពេញការងារយឺតឬចេញមុនម៉ោងលើសពី ៣០ នាទីឡើងទៅ ដោយគ្មានការអនុញ្ញាត គិតយ៉ាងតិចចំនួន ៣ (បី) ដងក្នុងរយៈពេលមួយសប្តាហ៍</p>
                <p className="pl-8">- អវត្តមានគ្មានច្បាប់អនុញ្ញាតជាប់គ្នារយៈពេលចំនួន ២ (ពីរ) ថ្ងៃនៃថ្ងៃធ្វើការ</p>
                <p className="pl-8">- អវត្តមានគ្មានច្បាប់អនុញ្ញាតដោយមិនជាប់គ្នារយៈពេលចំនួន មួយ ឬ ពីរ (១ ទៅ ២) ថ្ងៃនៃថ្ងៃធ្វើការ</p>
                <p className="pl-8">- មិនបានបំពេញទាំងស្រុងនូវកាតព្វកិច្ចរបស់ខ្លួនផ្នែកលើលទ្ធផលការងារដែលបានកំណត់ ដោយប្រធានអង្គភាព។</p>
              </div>

              <div className="space-y-1 pt-2">
                <p className="font-bold text-slate-900">មាត្រា២៤ ៖</p>
                <p className="pl-4">
                  ប្រធានអង្គភាពគ្រប់គ្រងផ្ទាល់ ត្រូវធ្វើការណែនាំចុងក្រោយ ចំពោះមន្ត្រីជាប់កិច្ចសន្យាអវត្តមានគ្មានច្បាប់អនុញ្ញាត ឬមិនបានបំពេញកាតព្វកិច្ចរបស់ខ្លួនផ្នែកលើលទ្ធផលការងារ ដូចខាងក្រោម៖
                </p>
                <p className="pl-8">- អវត្តមានគ្មានច្បាប់អនុញ្ញាតជាប់គ្នារយៈពេលចំនួន ៣ (បី) ថ្ងៃ ទៅ ៥ (ប្រាំ) ថ្ងៃនៃថ្ងៃធ្វើការ</p>
                <p className="pl-8">- ករណីមិនរាងចាលដោយបានប្រព្រឹត្តកំហុសដូចមានចែងក្នុងមាត្រា២៣ ក្នុងកំឡុងពេល ៣ (បី) ខែ។</p>
              </div>

              <div className="space-y-1 pt-2">
                <p className="font-bold text-slate-900">មាត្រា២៥ ៖</p>
                <p className="pl-4">
                  ប្រធានអង្គភាពគ្រប់គ្រងផ្ទាល់ ត្រូវចាត់វិធានការបញ្ចប់កិច្ចសន្យាការងារចំពោះមន្ត្រីជាប់កិច្ចសន្យាអវត្តមានគ្មានច្បាប់អនុញ្ញាត ឬមិនបានបំពេញកាតព្វកិច្ចរបស់ខ្លួនផ្នែកលើលទ្ធផលការងារ ដូចខាងក្រោម៖
                </p>
                <p className="pl-8">- ករណីមិនរាងចាលដោយបានប្រព្រឹត្តកំហុសដូចមានចែងក្នុងមាត្រា២៤ ក្នុងកំឡុងពេល ៣ (បី) ខែ</p>
                <p className="pl-8">- អវត្តមានគ្មានច្បាប់អនុញ្ញាតជាប់គ្នាចាប់ពី ៥ (ប្រាំ) ថ្ងៃនៃថ្ងៃធ្វើការឡើងទៅ ហើយដែលមិនអាចអនុវត្តវិធានការបន្តបន្ទាប់បាន ដោយអនុលោមតាមបទប្បញ្ញត្តិនៃអនុក្រឹត្យនេះ។</p>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
