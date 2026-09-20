import { useState, useMemo, useEffect } from 'react';
import {
  toKhmer,
  KH_MONTHS_SOLAR,
  KH_WEEKDAYS_SHORT,
  getKhmerLunarInfo,
  getKhmerHoliday,
  isKhmerWorkingDay,
  KhmerHoliday,
} from '../utils/khmerCalendar';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  Sparkles,
  CheckCircle2,
  Clock,
  Moon,
  Sun,
  ShieldAlert,
  Palmtree,
} from 'lucide-react';

interface KhmerCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
}

export default function KhmerCalendarModal({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
}: KhmerCalendarModalProps) {
  // Parsing currently selected date
  const [viewYear, setViewYear] = useState<number>(() => {
    const parts = selectedDate.split('-');
    return parseInt(parts[0], 10) || 2026;
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    const parts = selectedDate.split('-');
    return parseInt(parts[1], 10) || 9; // 1-12
  });

  const [hoveredDate, setHoveredDate] = useState<string>(selectedDate);

  // Synchronize internal view state when modal opens or selectedDate changes
  useEffect(() => {
    if (isOpen && selectedDate) {
      const parts = selectedDate.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (y) setViewYear(y);
      if (m) setViewMonth(m);
      setHoveredDate(selectedDate);
    }
  }, [isOpen, selectedDate]);

  // Jump to today
  const handleJumpToToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    setViewYear(y);
    setViewMonth(m);
    onSelectDate(dateStr);
    onClose();
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Days matrix for current viewMonth
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0 = Sunday

  // Previous month padding
  const daysInPrevMonth = new Date(viewYear, viewMonth - 1, 0).getDate();

  // Grid days
  const calendarCells = useMemo(() => {
    const cells = [];

    // Prev month padding cells
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevD = daysInPrevMonth - i;
      const prevM = viewMonth === 1 ? 12 : viewMonth - 1;
      const prevY = viewMonth === 1 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(prevD).padStart(2, '0')}`;
      cells.push({
        dateStr,
        day: prevD,
        isCurrentMonth: false,
        lunar: getKhmerLunarInfo(dateStr),
        holiday: getKhmerHoliday(dateStr),
        isWorkDay: isKhmerWorkingDay(dateStr),
        isSunday: new Date(dateStr + 'T00:00:00').getDay() === 0,
      });
    }

    // Current month cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dateStr,
        day: d,
        isCurrentMonth: true,
        lunar: getKhmerLunarInfo(dateStr),
        holiday: getKhmerHoliday(dateStr),
        isWorkDay: isKhmerWorkingDay(dateStr),
        isSunday: new Date(dateStr + 'T00:00:00').getDay() === 0,
      });
    }

    // Next month padding cells to complete 35 or 42 grid
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = viewMonth === 12 ? 1 : viewMonth + 1;
      const nextY = viewMonth === 12 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({
        dateStr,
        day: i,
        isCurrentMonth: false,
        lunar: getKhmerLunarInfo(dateStr),
        holiday: getKhmerHoliday(dateStr),
        isWorkDay: isKhmerWorkingDay(dateStr),
        isSunday: new Date(dateStr + 'T00:00:00').getDay() === 0,
      });
    }

    return cells;
  }, [viewYear, viewMonth, daysInMonth, firstDayOfWeek, daysInPrevMonth]);

  // Info for active/hovered date
  const activeDateInfo = useMemo(() => {
    const target = hoveredDate || selectedDate;
    const lunar = getKhmerLunarInfo(target);
    const holiday = getKhmerHoliday(target);
    const isWorkDay = isKhmerWorkingDay(target);
    const dateObj = new Date(target + 'T00:00:00');
    const isSunday = dateObj.getDay() === 0;

    return {
      target,
      lunar,
      holiday,
      isWorkDay,
      isSunday,
      solarStr: `ថ្ងៃទី${toKhmer(dateObj.getDate())} ខែ${KH_MONTHS_SOLAR[dateObj.getMonth()]} ឆ្នាំ${toKhmer(dateObj.getFullYear())}`,
    };
  }, [hoveredDate, selectedDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-4 sm:p-5 border-b border-slate-700/80 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-inner">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Moul'] text-sm sm:text-base font-normal tracking-wide text-amber-300">
                ប្រតិទិនខ្មែរផ្លូវការ
              </h3>
              <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                <span>សុរិយគតិ & ចន្ទគតិ</span>
                <span className="text-slate-500">•</span>
                <span>ថ្ងៃបុណ្យជាតិ & ថ្ងៃសម្រាក</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleJumpToToday}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ថ្ងៃនេះ</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MONTH & YEAR CONTROLS */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="ខែមុន"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl px-3 py-1.5 border border-slate-700 focus:outline-hidden cursor-pointer"
              >
                {KH_MONTHS_SOLAR.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    ខែ{m}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl px-3 py-1.5 border border-slate-700 focus:outline-hidden cursor-pointer"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                  <option key={y} value={y}>
                    ឆ្នាំ {toKhmer(y)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="ខែបន្ទាប់"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Legend Tags */}
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span>បុណ្យជាតិ</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              <span>ថ្ងៃសីល</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />
              <span>អាទិត្យ</span>
            </span>
          </div>
        </div>

        {/* CALENDAR GRID */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1.5 mb-2 text-center text-xs font-bold">
            {KH_WEEKDAYS_SHORT.map((wd, i) => (
              <div
                key={wd}
                className={`py-1.5 rounded-lg ${
                  i === 0
                    ? 'text-rose-400 bg-rose-950/30 border border-rose-900/40'
                    : 'text-slate-300 bg-slate-800/40'
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((c) => {
              const isSelected = c.dateStr === selectedDate;
              const isToday =
                c.dateStr ===
                new Date().toISOString().split('T')[0];

              return (
                <button
                  key={c.dateStr}
                  type="button"
                  onClick={() => {
                    onSelectDate(c.dateStr);
                    onClose();
                  }}
                  onMouseEnter={() => setHoveredDate(c.dateStr)}
                  className={`relative p-1.5 sm:p-2 rounded-2xl border text-left flex flex-col justify-between transition min-h-[58px] sm:min-h-[68px] cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 border-amber-400 text-white shadow-lg ring-2 ring-amber-400/80 z-10'
                      : !c.isCurrentMonth
                      ? 'opacity-35 bg-slate-900/40 border-slate-800 text-slate-500'
                      : c.holiday
                      ? 'bg-rose-950/40 border-rose-600/50 hover:border-rose-400 text-slate-100'
                      : c.isSunday
                      ? 'bg-slate-950/60 border-slate-800 hover:border-slate-600 text-slate-300'
                      : 'bg-slate-800/60 border-slate-700/70 hover:border-blue-500/80 text-slate-200'
                  }`}
                >
                  {/* Top line: Solar Day & badges */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs sm:text-sm font-bold ${
                        isSelected
                          ? 'text-white'
                          : c.holiday
                          ? 'text-rose-400 font-extrabold'
                          : c.isSunday
                          ? 'text-rose-300/80'
                          : 'text-slate-100'
                      }`}
                    >
                      {toKhmer(c.day)}
                    </span>

                    {/* Holy Day or Today Badge */}
                    <div className="flex items-center gap-1">
                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="ថ្ងៃនេះ" />
                      )}
                      {c.lunar.isBuddhistHolyDay && (
                        <span
                          className="text-[10px] text-amber-300 font-bold"
                          title={c.lunar.holyDayLabel}
                        >
                          🌕
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Holiday Mini Label */}
                  {c.holiday && (
                    <div className="text-[9px] font-bold text-rose-300 truncate w-full leading-tight my-0.5">
                      {c.holiday.shortName}
                    </div>
                  )}

                  {/* Bottom: Khmer Lunar day info */}
                  <div
                    className={`text-[9.5px] sm:text-[10px] leading-tight truncate ${
                      isSelected
                        ? 'text-blue-100 font-semibold'
                        : c.lunar.isBuddhistHolyDay
                        ? 'text-amber-300 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {toKhmer(c.lunar.dayNumber)}
                    {c.lunar.phase}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* BOTTOM ACTIVE DAY INFO BAR */}
        <div className="bg-slate-950 border-t border-slate-800 p-3 sm:p-4">
          <div className="flex items-start justify-between flex-wrap gap-2 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  {activeDateInfo.solarStr}
                </span>
                {activeDateInfo.holiday ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                    <Palmtree className="w-3 h-3" />
                    <span>{activeDateInfo.holiday.name}</span>
                  </span>
                ) : activeDateInfo.isSunday ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700/40 text-slate-300 border border-slate-600">
                    ថ្ងៃសម្រាកចុងសប្តាហ៍ (អាទិត្យ)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>ថ្ងៃធ្វើការផ្លូវការ</span>
                  </span>
                )}
              </div>

              {/* Full Lunar info line */}
              <p className="text-amber-400 font-semibold text-[11px] flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5" />
                <span>{activeDateInfo.lunar.formattedLunar}</span>
                {activeDateInfo.lunar.holyDayLabel && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 text-[10px] border border-amber-400/30">
                    {activeDateInfo.lunar.holyDayLabel}
                  </span>
                )}
              </p>
            </div>

            <button
              onClick={() => {
                onSelectDate(activeDateInfo.target);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              ជ្រើសរើសថ្ងៃនេះ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
