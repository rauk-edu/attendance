import { useState, useEffect } from 'react';
import { BellRing, X } from 'lucide-react';
import { BrowserPushNotificationItem } from '../types';

interface NotificationToastBannerProps {
  onOpenModal: () => void;
}

export default function NotificationToastBanner({ onOpenModal }: NotificationToastBannerProps) {
  const [activeNotification, setActiveNotification] = useState<BrowserPushNotificationItem | null>(null);

  useEffect(() => {
    const handleNotification = (e: Event) => {
      const customEvent = e as CustomEvent<BrowserPushNotificationItem>;
      if (customEvent.detail) {
        setActiveNotification(customEvent.detail);
      }
    };

    window.addEventListener('school-push-notification-received', handleNotification);
    return () => {
      window.removeEventListener('school-push-notification-received', handleNotification);
    };
  }, []);

  useEffect(() => {
    if (!activeNotification) return;

    const timer = setTimeout(() => {
      setActiveNotification(null);
    }, 5500);

    return () => clearTimeout(timer);
  }, [activeNotification]);

  if (!activeNotification) return null;

  return (
    <div
      id="push-notification-toast"
      className="fixed top-4 right-4 z-50 max-w-sm w-full bg-slate-900/95 border border-amber-500/40 text-white rounded-xl shadow-2xl p-3 backdrop-blur-md animate-in slide-in-from-top-3 duration-300 flex items-start justify-between gap-3"
    >
      <div
        className="flex items-start gap-2.5 cursor-pointer flex-1"
        onClick={() => {
          setActiveNotification(null);
          onOpenModal();
        }}
      >
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 animate-bounce">
          <BellRing className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-amber-300">
              {activeNotification.title}
            </span>
            {activeNotification.staffName && (
              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                {activeNotification.staffName}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-200 leading-snug">
            {activeNotification.body}
          </p>
          <span className="text-[9.5px] text-slate-400 block pt-0.5">
            ចុចដើម្បីបើកប្រវត្តិការជូនដំណឹង
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setActiveNotification(null);
        }}
        className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
