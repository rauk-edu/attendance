import { useState } from 'react';
import { STAFF_LIST, SCHOOL_NAME } from '../data/staff';
import { UserSession } from '../types';
import { ShieldCheck, Phone, KeyRound, User, ArrowRight, Sparkles } from 'lucide-react';

interface LoginModalProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function LoginModal({ onLoginSuccess }: LoginModalProps) {
  const [phoneNumber, setPhoneNumber] = useState<string>('+855');
  const [otpCode, setOtpCode] = useState<string>('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('2730200248'); // Default to director

  const handleSendOtp = () => {
    setErrorMessage('');
    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone || cleanPhone.length < 9) {
      setErrorMessage('សូមបញ្ចូលលេខទូរសព្ទឱ្យបានត្រឹមត្រូវ (ឧទាហរណ៍៖ +85589663966)!');
      return;
    }

    const staffFound = STAFF_LIST.find(
      (s) => s.phone.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, '')
    );

    if (!staffFound) {
      setErrorMessage(
        'លេខទូរសព្ទនេះមិនទាន់មានក្នុងបញ្ជីបុគ្គលិកសាលាទេ! សូមជ្រើសរើសពីបញ្ជីគំរូខាងក្រោម។'
      );
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
      // For demo ease, prefill or inform OTP
      setOtpCode('123456');
    }, 600);
  };

  const handleVerifyOtp = () => {
    setErrorMessage('');
    if (otpCode.length < 4) {
      setErrorMessage('សូមបញ្ចូលលេខកូដ OTP ឱ្យគ្រប់ខ្ទង់!');
      return;
    }

    const cleanPhone = phoneNumber.trim();
    const staff = STAFF_LIST.find(
      (s) => s.phone.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, '')
    );

    if (!staff) {
      setErrorMessage('មិនស្គាល់គណនីបុគ្គលិកនេះទេ');
      return;
    }

    onLoginSuccess({
      name: staff.name,
      phone: staff.phone,
      role: staff.role,
      staffId: staff.id,
    });
  };

  // Quick Instant Login for Demo & Testing
  const handleQuickLogin = (staffId: string) => {
    const staff = STAFF_LIST.find((s) => s.id === staffId);
    if (!staff) return;

    onLoginSuccess({
      name: staff.name,
      phone: staff.phone,
      role: staff.role,
      staffId: staff.id,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md space-y-5">
        {/* School Crest & System Title */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl mx-auto bg-gradient-to-br from-blue-600 to-blue-950 border-2 border-blue-400/40 flex items-center justify-center shadow-lg shadow-blue-900/30 text-3xl">
            ⏰
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            ប្រព័ន្ធគ្រប់គ្រងវត្តមានបុគ្គលិកអប់រំ
          </h1>
          <p className="text-xs text-slate-400 font-medium">{SCHOOL_NAME}</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">
              ចូលប្រព័ន្ធតាមរយៈលេខទូរសព្ទ (SMS OTP)
            </h2>
          </div>

          {errorMessage && (
            <div className="bg-rose-950/60 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          {step === 'phone' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  📱 លេខទូរសព្ទ (ឧទាហរណ៍៖ +85589663966)
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+85589663966"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-900/30 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'កំពុងផ្ញើ...' : 'ផ្ញើ OTP'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  🔑 លេខកូដ OTP ៦ខ្ទង់ (លេខកូដសាកល្បង៖ 123456)
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="បញ្ចូលលេខកូដពី SMS"
                  maxLength={6}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-emerald-500 font-mono tracking-widest text-center"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  ប្តូរលេខ
                </button>
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-900/30 cursor-pointer"
                >
                  ផ្ទៀងផ្ទាត់ & ចូលប្រព័ន្ធ
                </button>
              </div>
            </div>
          )}

          {/* Quick Demo Access */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> ចូលរហ័ស (Quick Demo Login)
              </span>
              <span className="text-[10px] text-slate-500">ជ្រើសរើសតួនាទី</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Director */}
              <button
                type="button"
                onClick={() => handleQuickLogin('2730200248')}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-emerald-500/40 text-left transition cursor-pointer group"
              >
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                    សុខ សារើន
                  </div>
                  <div className="text-[10px] text-emerald-400">នាយិកា (Director)</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
              </button>

              {/* Secretary / Admin */}
              <button
                type="button"
                onClick={() => handleQuickLogin('1920100007')}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-blue-500/40 text-left transition cursor-pointer group"
              >
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-blue-300">
                    អ៊ុន ប៊ុនទុង
                  </div>
                  <div className="text-[10px] text-blue-400">លេខាធិការ (Admin)</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
              </button>
            </div>

            {/* Teacher dropdown quick login */}
            <div className="flex gap-2 pt-1">
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-hidden"
              >
                {STAFF_LIST.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.position}
                    {s.cls !== '-' ? ` ${s.cls}` : ''})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleQuickLogin(selectedStaffId)}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
              >
                ចូលជាគ្រូ
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500">
          ប្រព័ន្ធចុះវត្តមានឌីជីថល គាំទ្រការផ្ទៀងផ្ទាត់ GPS ក្នុងបរិវេណសាលា
        </div>
      </div>
    </div>
  );
}
