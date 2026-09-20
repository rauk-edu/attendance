import { useState } from 'react';
import {
  toKhmer,
  KH_MONTHS_SOLAR,
} from '../data/staff';
import { fetchAttendanceData } from '../services/firebase';
import { DayAttendanceMap } from '../types';
import { X, Printer, Calendar, Download, FileCode } from 'lucide-react';
import {
  buildMonthAttendanceHtml,
  exportToHtmlFile,
  exportToPdf,
} from '../utils/exportUtils';

interface MonthPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MonthPrintModal({ isOpen, onClose }: MonthPrintModalProps) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');

  if (!isOpen) return null;

  const loadAllMonthData = async () => {
    setIsLoading(true);
    setProgressText('⏳ កំពុងទាញទិន្នន័យគ្រប់ថ្ងៃក្នុងខែ...');

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const allData: Record<string, DayAttendanceMap> = {};

    const promises: Promise<void>[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(selectedMonth).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${selectedYear}-${mm}-${dd}`;

      promises.push(
        fetchAttendanceData(dateStr).then((res) => {
          allData[dateStr] = res || {};
        })
      );
    }

    await Promise.all(promises);
    return allData;
  };

  const handleExportPdf = async () => {
    try {
      const allData = await loadAllMonthData();
      setProgressText('✅ កំពុងបើកផ្ទាំង Export PDF...');

      const monthName = KH_MONTHS_SOLAR[selectedMonth - 1];
      const title = `បញ្ជីវត្តមានប្រចាំខែ ${monthName} ឆ្នាំ${toKhmer(selectedYear)} (${daysInMonthCount()} ថ្ងៃ)`;
      const contentHtml = buildMonthAttendanceHtml(selectedYear, selectedMonth, allData);

      exportToPdf({
        title,
        contentHtml,
        landscape: true,
      });

      onClose();
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      alert('មានបញ្ហាក្នុងការ Export PDF: ' + err);
    } finally {
      setIsLoading(false);
      setProgressText('');
    }
  };

  const handleExportHtml = async () => {
    try {
      const allData = await loadAllMonthData();
      setProgressText('✅ កំពុងទាញយកឯកសារ HTML...');

      const monthName = KH_MONTHS_SOLAR[selectedMonth - 1];
      const mm = String(selectedMonth).padStart(2, '0');
      const title = `បញ្ជីវត្តមានប្រចាំខែ ${monthName} ឆ្នាំ${toKhmer(selectedYear)}`;
      const filename = `Vattaman_Rohk_Month_${mm}_${selectedYear}.html`;
      const contentHtml = buildMonthAttendanceHtml(selectedYear, selectedMonth, allData);

      exportToHtmlFile({
        filename,
        title,
        contentHtml,
        landscape: true,
      });

      onClose();
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      alert('មានបញ្ហាក្នុងការ Export HTML: ' + err);
    } finally {
      setIsLoading(false);
      setProgressText('');
    }
  };

  const handleDirectPrint = handleExportPdf;

  const daysInMonthCount = () => new Date(selectedYear, selectedMonth, 0).getDate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-white">ឯកសារបញ្ជីវត្តមាន ១ ខែពេញ (A4)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">ជ្រើសខែ</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-hidden"
              >
                {KH_MONTHS_SOLAR.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">ជ្រើសឆ្នាំ</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-hidden"
              >
                {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(
                  (y) => (
                    <option key={y} value={y}>
                      {toKhmer(y)}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            💡 ប្រព័ន្ធនឹងរៀបចំទិន្នន័យគ្រប់ថ្ងៃក្នុងខែ {KH_MONTHS_SOLAR[selectedMonth - 1]} ({daysInMonthCount()} ថ្ងៃ) ជាមួយហត្ថលេខាពិតរបស់បុគ្គលិកទាំងអស់ក្នុងទម្រង់ A4 Landscape ផ្លូវការ។
          </p>

          {progressText && (
            <div className="text-xs text-amber-300 font-semibold text-center py-1">
              {progressText}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
          >
            បិទ
          </button>
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={handleExportHtml}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/60 rounded transition cursor-pointer disabled:opacity-50"
              title="ទាញយកជាឯកសារ HTML ពេញលេញ"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>HTML</span>
            </button>
            <span className="w-px h-3.5 bg-slate-800" />
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-400 hover:bg-sky-950/60 rounded transition cursor-pointer disabled:opacity-50"
              title="រក្សាទុកជា PDF (Save as PDF)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <span className="w-px h-3.5 bg-slate-800" />
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-300 hover:bg-purple-950/60 rounded transition cursor-pointer disabled:opacity-50"
              title="បោះពុម្ពតាមម៉ាស៊ីនព្រីន (Print)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isLoading ? '...' : 'ព្រីន'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
