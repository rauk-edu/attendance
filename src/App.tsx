import { useState, useEffect, useCallback } from 'react';
import { UserSession, DayAttendanceMap, GPSState } from './types';
import {
  SCHOOL_NAME,
  SCHOOL_LAT,
  SCHOOL_LNG,
  SCHOOL_RADIUS,
  haversineDistance,
  STAFF_LIST,
} from './data/staff';
import {
  fetchAttendanceData,
  saveAttendanceData,
  subscribeToAttendanceDate,
  migrateCachedDataToFirestore,
} from './services/firebase';
import AttendanceSheet from './components/AttendanceSheet';
import MonthlyReport from './components/MonthlyReport';
import MonthPrintModal from './components/MonthPrintModal';
import LoginModal from './components/LoginModal';
import DocumentManager from './components/DocumentManager';
import SchoolAIAssistant from './components/SchoolAIAssistant';
import PushNotificationModal from './components/PushNotificationModal';
import NotificationToastBanner from './components/NotificationToastBanner';
import {
  detectAndNotifyAttendanceChanges,
  getNotificationHistory,
} from './services/notificationService';
import {
  LogOut,
  CalendarCheck,
  BarChart3,
  User,
  Shield,
  MapPin,
  RefreshCw,
  Sparkles,
  FileText,
  BellRing,
} from 'lucide-react';

export default function App() {
  // Authentication session
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('att_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Active tab: 'attendance', 'report', 'documents', or 'holiday_ai'
  const [activeTab, setActiveTab] = useState<
    'attendance' | 'report' | 'documents' | 'holiday_ai'
  >('attendance');

  // Selected date formatted as YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Current day attendance map
  const [attendanceData, setAttendanceData] = useState<DayAttendanceMap>({});
  const [isFirebaseLive, setIsFirebaseLive] = useState<boolean>(true);
  const [isMonthPrintOpen, setIsMonthPrintOpen] = useState<boolean>(false);
  const [isPushModalOpen, setIsPushModalOpen] = useState<boolean>(false);
  const [unreadPushCount, setUnreadPushCount] = useState<number>(() => {
    return getNotificationHistory().filter((n) => !n.read).length;
  });

  // Track unread push notifications count
  useEffect(() => {
    const updateCount = () => {
      const unread = getNotificationHistory().filter((n) => !n.read).length;
      setUnreadPushCount(unread);
    };
    window.addEventListener('school-push-history-changed', updateCount);
    window.addEventListener('school-push-notification-received', updateCount);
    return () => {
      window.removeEventListener('school-push-history-changed', updateCount);
      window.removeEventListener('school-push-notification-received', updateCount);
    };
  }, []);

  // Auto migrate cached local storage attendance data to Cloud Firestore
  useEffect(() => {
    migrateCachedDataToFirestore().then((count) => {
      if (count > 0) {
        console.info(`Successfully migrated ${count} cached attendance records to Cloud Firestore.`);
      }
    });
  }, []);

  // GPS state management
  const [gpsState, setGpsState] = useState<GPSState>({
    status: 'simulated', // Default to simulated for flawless preview demonstration
    lat: SCHOOL_LAT,
    lng: SCHOOL_LNG,
    distance: 0,
    accuracy: 10,
    isSimulated: true,
  });

  // Load attendance data for selected date
  const loadDateData = useCallback(async (dateStr: string) => {
    const data = await fetchAttendanceData(dateStr);
    setAttendanceData(data);
  }, []);

  useEffect(() => {
    loadDateData(selectedDate);

    // Subscribe to realtime changes from Firebase
    const unsub = subscribeToAttendanceDate(
      selectedDate,
      (liveData) => {
        setAttendanceData((prev) => {
          // Detect changes and trigger browser push notification immediately!
          if (prev && Object.keys(prev).length > 0) {
            detectAndNotifyAttendanceChanges(prev, liveData);
          }
          return { ...prev, ...liveData };
        });
      },
      (isLive) => {
        setIsFirebaseLive(isLive);
      }
    );

    return () => {
      unsub();
    };
  }, [selectedDate, loadDateData]);

  // Handle GPS location watching
  const startGpsWatch = useCallback(() => {
    if (gpsState.isSimulated) return;

    if (!navigator.geolocation) {
      setGpsState({
        status: 'denied',
        lat: null,
        lng: null,
        distance: null,
        accuracy: null,
        isSimulated: false,
      });
      return;
    }

    setGpsState((prev) => ({ ...prev, status: 'loading' }));

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const dist = Math.round(
          haversineDistance(
            pos.coords.latitude,
            pos.coords.longitude,
            SCHOOL_LAT,
            SCHOOL_LNG
          )
        );

        setGpsState({
          status: dist <= SCHOOL_RADIUS ? 'ok' : 'bad',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          distance: dist,
          accuracy: Math.round(pos.coords.accuracy),
          isSimulated: false,
        });
      },
      (err) => {
        console.warn('Geolocation watch error:', err);
        setGpsState({
          status: err.code === 1 ? 'denied' : 'error',
          lat: null,
          lng: null,
          distance: null,
          accuracy: null,
          isSimulated: false,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [gpsState.isSimulated]);

  useEffect(() => {
    if (!gpsState.isSimulated) {
      const cleanup = startGpsWatch();
      return cleanup;
    }
  }, [gpsState.isSimulated, startGpsWatch]);

  const toggleSimulatedGps = () => {
    setGpsState((prev) => {
      if (prev.isSimulated) {
        return {
          status: 'loading',
          lat: null,
          lng: null,
          distance: null,
          accuracy: null,
          isSimulated: false,
        };
      } else {
        return {
          status: 'simulated',
          lat: SCHOOL_LAT,
          lng: SCHOOL_LNG,
          distance: 0,
          accuracy: 5,
          isSimulated: true,
        };
      }
    });
  };

  // Login handler
  const handleLogin = (session: UserSession) => {
    setCurrentUser(session);
    try {
      localStorage.setItem('att_current_user', JSON.stringify(session));
    } catch {
      // ignore
    }
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('att_current_user');
    } catch {
      // ignore
    }
  };

  // Quick switch user (for fast testing between teachers and director)
  const handleQuickSwitchUser = (staffId: string) => {
    const staff = STAFF_LIST.find((s) => s.id === staffId);
    if (!staff) return;
    const session: UserSession = {
      name: staff.name,
      phone: staff.phone,
      role: staff.role,
      staffId: staff.id,
    };
    handleLogin(session);
  };

  // Save attendance
  const handleSaveAttendance = async (data: DayAttendanceMap) => {
    setAttendanceData(data);
    await saveAttendanceData(selectedDate, data);
  };

  // If not logged in, render the login page
  if (!currentUser) {
    return <LoginModal onLoginSuccess={handleLogin} />;
  }

  const roleTagConfig = {
    director: { label: 'នាយិកា', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    vice_director: { label: 'នាយករង', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    admin: { label: 'លេខាធិការ', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
    teacher: { label: 'គ្រូបង្រៀន', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  };

  const userRole = roleTagConfig[currentUser.role] || roleTagConfig.teacher;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* TOP HEADER (no-print) */}
      <header className="no-print sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-1.5 sm:py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 flex-wrap">
          {/* Logo & School Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-900 border border-blue-400/30 flex items-center justify-center text-base shadow-sm shadow-blue-950">
              ⏰
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <span>{SCHOOL_NAME}</span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  វត្តមានឌីជីថល
                </span>
              </h1>
              <p className="text-[10.5px] text-slate-400">
                ប្រព័ន្ធគ្រប់គ្រងវត្តមានបុគ្គលិកអប់រំ
              </p>
            </div>
          </div>

          {/* Center Tabs: Attendance, Monthly Report, Documents & Absence, AI Notice */}
          <nav className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'attendance'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>បញ្ជីវត្តមាន</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'report'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>របាយការណ៍</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'documents'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>ឯកសារ & អវត្តមាន</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('holiday_ai')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'holiday_ai'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-indigo-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI ជំនួយការ</span>
            </button>
          </nav>

          {/* User Info, Live Status & Logout */}
          <div className="flex items-center gap-2">
            {/* Live Indicator */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10.5px] font-medium text-slate-300">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isFirebaseLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>{isFirebaseLive ? 'Live' : 'Local'}</span>
            </div>

            {/* Quick Switch Role Picker */}
            <div className="hidden lg:flex items-center gap-1 text-xs text-slate-400">
              <span className="text-[11px]">តួនាទី:</span>
              <select
                value={currentUser.staffId}
                onChange={(e) => handleQuickSwitchUser(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-md px-1.5 py-0.5 text-[11px] text-slate-200 focus:outline-hidden"
              >
                {STAFF_LIST.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.position})
                  </option>
                ))}
              </select>
            </div>

            {/* Push Notification Center Button */}
            <button
              type="button"
              onClick={() => setIsPushModalOpen(true)}
              className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-semibold transition cursor-pointer shadow-xs"
              title="ការកំណត់ និងប្រវត្តិ Browser Push Notification"
            >
              <BellRing className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">ដំណឹង</span>
              {unreadPushCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9.5px] font-bold animate-pulse">
                  {unreadPushCount > 9 ? '9+' : unreadPushCount}
                </span>
              )}
            </button>

            {/* Current user badge */}
            <div className="text-right">
              <div className="text-xs font-bold text-amber-300">{currentUser.name}</div>
              <div
                className={`inline-block text-[9.5px] px-1.5 py-0.2 rounded-full border ${userRole.color}`}
              >
                {userRole.label}
              </div>
            </div>

            {/* Logout button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer text-xs font-medium"
              title="ចាកចេញ"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">ចេញ</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        {activeTab === 'attendance' && (
          <AttendanceSheet
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            attendanceData={attendanceData}
            onSaveData={handleSaveAttendance}
            gpsState={gpsState}
            onRetryGps={startGpsWatch}
            onToggleSimulatedGps={toggleSimulatedGps}
            currentUser={currentUser}
            onOpenMonthPrint={() => setIsMonthPrintOpen(true)}
          />
        )}

        {activeTab === 'report' && <MonthlyReport />}

        {activeTab === 'documents' && <DocumentManager currentUser={currentUser} />}

        {activeTab === 'holiday_ai' && <SchoolAIAssistant currentUser={currentUser} />}
      </main>

      {/* Quick Floating AI Button when on other tabs */}
      {activeTab !== 'holiday_ai' && (
        <button
          type="button"
          onClick={() => setActiveTab('holiday_ai')}
          className="no-print fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs shadow-xl hover:shadow-amber-500/25 transition cursor-pointer border border-amber-300/70 group"
          title="ចុចដើម្បីបើក AI ជំនួយការ"
        >
          <div className="w-5 h-5 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span>AI ជំនួយ</span>
        </button>
      )}

      {/* Month Print Modal */}
      <MonthPrintModal
        isOpen={isMonthPrintOpen}
        onClose={() => setIsMonthPrintOpen(false)}
      />

      {/* Realtime Toast Notification Banner */}
      <NotificationToastBanner onOpenModal={() => setIsPushModalOpen(true)} />

      {/* Browser Push Notification Modal */}
      <PushNotificationModal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
      />

      {/* FOOTER (no-print) */}
      <footer className="no-print mt-auto py-4 border-t border-slate-900 bg-slate-950/80 text-center text-xs text-slate-500">
        <p>
          © {new Date().getFullYear()} {SCHOOL_NAME} • រដ្ឋបាលស្រុកភ្នំស្រុក
          ការិយាល័យអប់រំ យុវជន និងកីឡាស្រុក
        </p>
      </footer>
    </div>
  );
}
