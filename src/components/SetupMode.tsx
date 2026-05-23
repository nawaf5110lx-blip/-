import React, { useState } from "react";
import { Monitor, Smartphone, Key, Wifi, Sparkles, HelpCircle, AlertCircle, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

interface SetupModeProps {
  onJoin: (roomCode: string, deviceRole: 'register' | 'scanner', deviceName: string) => void;
}

export default function SetupMode({ onJoin }: SetupModeProps) {
  const [deviceRole, setDeviceRole] = useState<'register' | 'scanner' | null>(null);
  const [roomCode, setRoomCode] = useState(() => {
    // Generate a beautiful short default code
    return `NAWAF-${Math.floor(Math.random() * 900) + 100}`;
  });
  const [deviceName, setDeviceName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setErrorMsg("الرجاء إدخال كود الغرفة لبدء الربط.");
      return;
    }
    
    const finalRole = deviceRole || 'register';
    const finalName = deviceName.trim() || (finalRole === 'register' ? "جهاز الكاشير الاساسي (الآيباد)" : "جوال الماسح الضوئي");
    
    setErrorMsg("");
    onJoin(roomCode.toUpperCase().trim(), finalRole, finalName);
  };

  const handleQuickScannerSetup = () => {
    // Quick scanner setup
    setDeviceRole('scanner');
    setDeviceName("ماسح آيفون المحمول");
  };

  const handleQuickRegisterSetup = () => {
    // Quick register setup
    setDeviceRole('register');
    setDeviceName("آيباد الكاشير الماسي");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-start items-center p-4 sm:p-6" dir="rtl">
      {/* Absolute top branding */}
      <div className="w-full max-w-4xl flex justify-between items-center py-4 border-b border-orange-950/20 mb-8 sm:mb-12">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center font-black text-slate-950 shadow-[0_0_15px_rgba(234,88,12,0.3)]">
            N
          </div>
          <div>
            <h1 className="text-md sm:text-lg font-black tracking-wider text-white">NAWAF <span className="text-orange-500">SYSTEM</span></h1>
            <p className="text-[10px] text-slate-500 -mt-0.5">Premium Smart Cashier POS</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-850">
          <Wifi className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>مزامنة الأجهزة مشتغلة</span>
        </div>
      </div>

      <div className="w-full max-w-xl bg-slate-950 border border-orange-955/40 rounded-3xl p-6 sm:p-8 shadow-[0_4px_40px_rgba(249,115,22,0.06)] space-y-6">
        
        {/* Header Hero */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold bg-orange-600/10 text-orange-400 rounded-full border border-orange-950/40">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>نواف سيستم | كاشير ذكي بلمسة عصرية</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-50">تجهيز نقطة المبيعات والربط المتعدد</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            قم بالربط بين جوالك الذكي والآيباد في نفس اللحظة! صور الباركود من جوالك وستظهر السلعة فورياً في شاشة كاشير الآيباد.
          </p>
        </div>

        {/* Device select mode buttons */}
        {!deviceRole ? (
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-orange-450 uppercase tracking-widest text-center">ماهو دور هذا الجهاز الذي تستخدمه الآن؟</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Option 1: iPad Register */}
              <button
                type="button"
                onClick={handleQuickRegisterSetup}
                className="group flex flex-col items-center justify-between p-6 bg-slate-900 hover:bg-slate-900/40 border border-slate-800 hover:border-orange-500/80 rounded-2xl cursor-pointer text-center transition-all duration-300"
              >
                <div className="p-4 bg-orange-600/10 text-orange-400 rounded-2xl group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300 mb-4">
                  <Monitor className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1.5">شاشة الكاشير الرئيسية (iPad)</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    منفذ المبيعات الأساسي، يحتوي على السلة، المحاسبة،Receipts، وإدارة المنتجات المخزنة والخدمات.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-[10px] text-orange-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>تحديد هذا الخيار</span>
                  <ArrowRight className="w-3 h-3 transform rotate-180" />
                </div>
              </button>

              {/* Option 2: Mobile Barcode Scanner */}
              <button
                type="button"
                onClick={handleQuickScannerSetup}
                className="group flex flex-col items-center justify-between p-6 bg-slate-900 hover:bg-slate-900/40 border border-slate-800 hover:border-orange-500/80 rounded-2xl cursor-pointer text-center transition-all duration-300"
              >
                <div className="p-4 bg-orange-600/10 text-orange-400 rounded-2xl group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300 mb-4">
                  <Smartphone className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1.5">جهاز قارئ الباركود (الجوال)</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    يحول كاميرا جوالك إلى ماسح باركود لاسلكي متصل بالكاشير. صور الباركود فورياً وسيزامنها مباشرة.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-[10px] text-orange-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>تحديد هذا الخيار</span>
                  <ArrowRight className="w-3 h-3 transform rotate-180" />
                </div>
              </button>
              
            </div>
            
            <div className="bg-slate-900/50 border border-slate-850 p-4 rounded-xl flex items-start gap-2.5 text-xs text-slate-400">
              <HelpCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-right">
                <strong>كيف تبدأ أول تجربة؟</strong> افتح هذا الموقع بجهازين مختلفين (مثلاً جوالك وآيباد أو قسّم شاشة متصفحك لنصفين)، اختر في أحدهما <strong>شاشة الكاشير</strong> والآخر <strong>جهاز الباركود</strong> مستخدماً نفس كود الغرفة لتشهد سحر المزامنة الفورية!
              </p>
            </div>
          </div>
        ) : (
          /* Form for Entering room code and device details */
          <form onSubmit={handleStart} className="space-y-5">
            
            {/* Display Selected Role Badge */}
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-orange-600/10 text-orange-450">
                  {deviceRole === 'register' ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                </span>
                <div>
                  <span className="text-slate-400">النمط المختار: </span>
                  <strong className="text-white">
                    {deviceRole === 'register' ? "شاشة الكاشير والمبيعات (POS)" : "جهاز مسح الباركود بالكاميرا"}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeviceRole(null)}
                className="text-[10px] font-bold text-orange-450 hover:underline"
              >
                تغيير
              </button>
            </div>

            {/* Room session ID code */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-350 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-orange-500" />
                <span>كود غرفة المزامنة والربط الآمن:</span>
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="مثال: NAWAF-100"
                maxLength={40}
                required
                className="w-full bg-slate-905 border border-slate-800 focus:border-orange-600 rounded-xl px-4 py-3 text-center font-mono font-extrabold tracking-widest text-lg text-orange-400 outline-none transition-all uppercase"
              />
              <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                يجب كتابة نفس كود الغرفة على جميع الأجهزة لربط السلّة والمعلومات معاً.
              </p>
            </div>

            {/* Device friendly name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-350">
                اسم هذا الطرف / الجهاز (اختياري):
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder={deviceRole === 'register' ? "مثال: الكاشير الرئيسي - آيباد" : "مثال: جوال جوال ريل الكاميرا"}
                className="w-full bg-slate-900 border border-slate-800 focus:border-orange-600 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-200 outline-none transition-all text-right"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Continue Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-500 text-slate-950 font-black text-sm py-3 px-6 rounded-xl shadow-[0_4px_20px_rgba(234,88,12,0.25)] hover:shadow-[0_4px_25px_rgba(234,88,12,0.35)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>ابدأ تشغيل النظام الآن</span>
                <ShieldCheck className="w-4.5 h-4.5 text-slate-950" />
              </button>
            </div>

          </form>
        )}

      </div>

      {/* Helpful footer */}
      <div className="mt-8 text-center text-[10px] text-slate-600 max-w-sm space-y-1">
        <p>نظام نواف الكاشير الموحد الذكي (Nawaf System PRO)</p>
        <p>جميع العمليات ومزامن الباركود مشفرة وتتم مباشرة عبر خدمة الـ Server-Sent Events الملحقة.</p>
      </div>
    </div>
  );
}
