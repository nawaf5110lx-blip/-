import React, { useState, useEffect } from "react";
import SetupMode from "./components/SetupMode";
import RegisterMode from "./components/RegisterMode";
import ScannerMode from "./components/ScannerMode";
import { HelpCircle, Sparkles, Wifi } from "lucide-react";

export default function App() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [deviceRole, setDeviceRole] = useState<'register' | 'scanner' | null>(null);
  const [deviceName, setDeviceName] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");

  // Retrieve or generate a unique persistent hardware ID for this terminal session
  useEffect(() => {
    let storedId = localStorage.getItem("nawaf_pos_device_id");
    if (!storedId) {
      storedId = `terminal-${Math.floor(Math.random() * 90000) + 10000}`;
      localStorage.setItem("nawaf_pos_device_id", storedId);
    }
    setDeviceId(storedId);
  }, []);

  const handleJoinRoom = (code: string, role: 'register' | 'scanner', name: string) => {
    setRoomCode(code);
    setDeviceRole(role);
    setDeviceName(name);
  };

  const handleExitTerminal = () => {
    setRoomCode(null);
    setDeviceRole(null);
  };

  // 1. Setup Mode Screen
  if (!roomCode || !deviceRole) {
    return <SetupMode onJoin={handleJoinRoom} />;
  }

  // 2. Mobile/Camera Scanner Mode
  if (deviceRole === 'scanner') {
    return (
      <ScannerMode
        roomCode={roomCode}
        deviceName={deviceName}
        deviceId={deviceId}
        onExit={handleExitTerminal}
      />
    );
  }

  // 3. Main iPad POS / Register Mode
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between selection:bg-orange-600 selection:text-white" dir="rtl">
      
      {/* Top Professional POS Branding Rail */}
      <header className="bg-slate-900/80 border-b border-orange-950/20 px-4 sm:px-6 py-4 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center font-black text-slate-950 shadow-[0_0_20px_rgba(234,88,12,0.4)]">
              N
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-wider text-white">
                NAWAF <span className="text-orange-500">SYSTEM</span>
              </h1>
              <p className="text-[10px] text-slate-450 -mt-0.5">نظام المبيعات الذكي والمزامنة اللاسلكية</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-orange-450 font-bold bg-orange-950/20 px-3 py-1 rounded-full border border-orange-900/30 font-mono tracking-wider">
              الجلسة: {roomCode}
            </span>
            <button
              onClick={handleExitTerminal}
              className="text-xs bg-slate-950 hover:bg-slate-800 border border-slate-850 px-3.5 py-1.5 rounded-xl font-bold text-red-400 transition"
            >
              الخروج والتغيير
            </button>
          </div>
        </div>
      </header>

      {/* Main Terminal Grid and content wrapper */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col justify-start">
        <RegisterMode
          roomCode={roomCode}
          deviceName={deviceName}
          deviceId={deviceId}
          onExit={handleExitTerminal}
        />
      </main>

      {/* Subdued Footer Information */}
      <footer className="border-t border-slate-900 bg-slate-955 py-4 text-center text-[10px] text-slate-600 space-y-1">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>نواف سيستم (Nawaf System Pro v4.0) © جميع الحقوق محفوظة لعام 2026</p>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            <span>نظام مزامنة الباركود اللاسلكي الفوري عبر الـ SSE برعاية Google Cloud</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
