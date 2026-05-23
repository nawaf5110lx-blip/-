import React, { useState, useEffect, useRef } from "react";
import { DeviceInfo, Product } from "../types";
import { Smartphone, Camera, Key, Wifi, RefreshCw, Send, Sparkles, Check, Play, AlertCircle, Trash2 } from "lucide-react";

interface ScannerModeProps {
  roomCode: string;
  deviceName: string;
  deviceId: string;
  onExit: () => void;
}

export default function ScannerMode({ roomCode, deviceName, deviceId, onExit }: ScannerModeProps) {
  const [scannedLogs, setScannedLogs] = useState<{ id: string; barcode: string; name: string; price: number; time: string }[]>([]);
  const [manualBarcode, setManualBarcode] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [deviceList, setDeviceList] = useState<DeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Simulated quick action buttons representing products
  const quickTestBarcodes = [
    { name: "قهوة إسبريسو ☕", barcode: "1001", price: 18.00 },
    { name: "مياه غازية 🥤", barcode: "2002", price: 7.50 },
    { name: "كرواسون 🥐", barcode: "3003", price: 14.00 },
    { name: "قلم بريميوم 🖊️", barcode: "4004", price: 5.00 },
    { name: "شاحن آيفون 🔌", barcode: "5005", price: 69.00 },
    { name: "شيبس مملح 🥔", barcode: "6006", price: 4.50 },
    { name: "منتج مجهول 🏷️", barcode: "9999", price: 0.00 }
  ];

  // SSE listening to get active devices in the same room
  useEffect(() => {
    const sseUrl = `/api/sync/connect?room=${roomCode}&deviceId=${deviceId}&deviceName=${encodeURIComponent(deviceName)}&deviceRole=scanner`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "init") {
          setDeviceList(data.payload.devices);
        } else if (data.type === "device_joined") {
          setDeviceList(prev => {
            const exists = prev.some(d => d.id === data.payload.id);
            if (!exists) return [...prev, data.payload];
            return prev;
          });
        } else if (data.type === "device_left") {
          setDeviceList(prev => prev.filter(d => d.id !== data.payload.id));
        }
      } catch (err) {
        console.error("Failed to parse SSE inside scanner", err);
      }
    };

    return () => {
      eventSource.close();
      stopCamera();
    };
  }, [roomCode]);

  // Request actual camera stream from browser media devices
  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" } // Rear camera preferred
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera access failed", err);
      setCameraError("يتعذر الوصول للكاميرا. تأكد من إعطاء الصلاحية أو استخدم البار العشوائي بالأسفل للتجربة.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Sound generator (native web Audio API beep, so zero external dependencies!)
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = "sine";
      oscillator.frequency.value = 1100; // Crisp cashier beep
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12); // Short beep
    } catch (e) {
      console.warn("Audio Context beep was blocked by browser", e);
    }
  };

  // Emit Scanned Barcode to Server
  const emitBarcode = async (barcode: string, customName?: string) => {
    if (!barcode.trim()) return;
    setIsLoading(true);
    setFeedbackMsg("");

    try {
      const response = await fetch("/api/sync/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomCode,
          barcode: barcode.trim(),
          deviceName: deviceName
        })
      });

      if (response.ok) {
        const data = await response.json();
        playBeep();

        const resolvedName = data.payload.product ? data.payload.product.name : (customName || "منتج غير مضاف");
        const resolvedPrice = data.payload.product ? data.payload.product.price : 0;

        setScannedLogs(prev => [
          {
            id: String(Date.now()),
            barcode: barcode,
            name: resolvedName,
            price: resolvedPrice,
            time: new Date().toLocaleTimeString("ar-SA")
          },
          ...prev
        ]);

        // Trigger short screen success feedback
        setFeedbackMsg(`تم إرسال باركود [${barcode}] بنجاح!`);
        setTimeout(() => setFeedbackMsg(""), 2000);
      } else {
        throw new Error("Failed scan push");
      }
    } catch (e) {
      console.error(e);
      alert("تعذر الاتصال بالخادم الرئيسي لإرسال المسح.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    emitBarcode(manualBarcode.slice(0, 30));
    setManualBarcode("");
  };

  // Simulated auto camera scan (simulation trigger)
  const handleSimulateCameraDetection = () => {
    const randomProduct = quickTestBarcodes[Math.floor(Math.random() * (quickTestBarcodes.length - 1))];
    emitBarcode(randomProduct.barcode, randomProduct.name);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans pb-10" dir="rtl">
      {/* Top Mobile Bar */}
      <div className="bg-slate-900 border-b border-orange-950/20 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-1.5">
          <Smartphone className="w-5 h-5 text-orange-500" />
          <div>
            <h2 className="text-xs font-black text-white">جهاز الماسح الذكي</h2>
            <p className="text-[10px] text-slate-400">نواف سيستم | {roomCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-350">
            {deviceName.slice(0, 15)}
          </span>
          <button
            onClick={onExit}
            className="text-[10px] text-red-400 hover:underline bg-slate-950 p-1 rounded px-2"
          >
            خروج ×
          </button>
        </div>
      </div>

      {/* Main Scanner Container */}
      <div className="p-4 space-y-6 max-w-lg mx-auto w-full">
        
        {/* Status card indicating synced iPad receiver */}
        <div className="bg-slate-900/60 rounded-2xl border border-orange-950/25 p-3 flex justify-between items-center text-xs">
          <span className="text-slate-400 font-bold">الأجهزة النشطة في الغرفة:</span>
          <div className="flex gap-1.5 flex-wrap">
            {deviceList.length <= 1 ? (
              <span className="bg-rose-950/50 text-rose-450 border border-rose-900/40 text-[9px] px-2 py-1 rounded">
                بانتظار فتح شاشة الكاشير (الآيباد)...
              </span>
            ) : (
              deviceList.filter(d => d.id !== deviceId).map(d => (
                <span key={d.id} className="bg-orange-950/30 text-orange-400 border border-orange-900/40 text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {d.name.split("-")[0]} ({d.role === 'register' ? 'آيباد' : 'ماسح'})
                </span>
              ))
            )}
          </div>
        </div>

        {/* Camera Feed / High tech Screen */}
        <div className="relative aspect-square w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center p-4">
          {isCameraActive ? (
            <>
              {/* Actual Video Streaming output of mobile front camera */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-2xl"
              />
              {/* Scanner Screen laser HUD */}
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.8)] pointer-events-none"></div>
              <div className="absolute inset-8 border border-orange-500/25 rounded-xl pointer-events-none flex items-center justify-center">
                <div className="w-48 h-12 border-2 border-emerald-500/60 rounded flex items-center justify-center text-[10px] text-emerald-400 bg-slate-950/60 font-bold">
                  ضع الباركود بداخل هذا المستطيل
                </div>
              </div>

              {/* Action over camera */}
              <div className="absolute bottom-4 left-4 right-4 flex gap-1.5 items-center justify-between">
                <button
                  type="button"
                  onClick={handleSimulateCameraDetection}
                  disabled={isLoading}
                  className="px-3.5 py-1.5 bg-emerald-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.2 shadow"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>محاكاة التقاط باركود</span>
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3.5 py-1.5 bg-slate-950 text-xs text-red-400 border border-slate-800 rounded-xl font-bold"
                >
                  تعطيل الكاميرا
                </button>
              </div>
            </>
          ) : (
            <div className="text-center p-6 space-y-4">
              <Camera className="w-12 h-12 text-orange-500/40 mx-auto mb-2" />
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">تشغيل كاميرا الجوال لمسح الملصقات</h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                  يمكنك استخدام الكاميرا لقراءة الباركود، أو التكبيق اليدوي المباشر السريع من أزرار الاختباء السهلة بالأسفل.
                </p>
              </div>
              {cameraError && (
                <div className="p-2 border border-yellow-900/60 bg-yellow-950/20 rounded-xl text-[10px] text-yellow-450 max-w-xs mx-auto flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-right">{cameraError}</span>
                </div>
              )}
              <button
                type="button"
                onClick={startCamera}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-slate-950 font-black text-xs rounded-xl shadow transition cursor-pointer"
              >
                تنشيد الكاميرا الآن
              </button>
            </div>
          )}

          {feedbackMsg && (
            <div className="absolute top-4 left-4 right-4 bg-emerald-950 border border-emerald-900 text-emerald-400 px-3 py-2 rounded-xl text-xs text-center shadow-lg font-bold animate-bounce">
              {feedbackMsg}
            </div>
          )}
        </div>

        {/* Manual Input form */}
        <form onSubmit={handleManualSubmit} className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-400">إدخال الباركود يدوياً وكتابته:</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value.replace(/[^0-9a-zA-Z-]/g, ""))}
              placeholder="مثال: 1001 للمنتج التجريبي"
              className="flex-1 bg-slate-900 border border-slate-800 text-white rounded-xl py-2 px-3.5 text-xs text-center outline-none focus:border-orange-600 font-mono tracking-widest font-extrabold"
            />
            <button
              type="submit"
              disabled={isLoading || !manualBarcode.trim()}
              className="px-5 py-2 rounded-xl bg-orange-600 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5 transform -rotate-45 text-slate-950 shrink-0" />
              <span>إرسال</span>
            </button>
          </div>
        </form>

        {/* Quick Simulated Product Barcodes test area */}
        <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-900 space-y-3">
          <div className="flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
            <h3 className="text-xs font-black text-slate-205">أزرار المحاكاة السريعة (قائمة للتجربة الفورية):</h3>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal mb-1">
            انقر على أي منتج من القائمة بالأسفل، وستراه فوراً قد أضيف لسلة المشتريات على الآيباد المقابل في نفس اللحظة!
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickTestBarcodes.map((item) => (
              <button
                key={item.barcode}
                type="button"
                onClick={() => emitBarcode(item.barcode, item.name)}
                disabled={isLoading}
                className="p-2.5 bg-slate-955 border border-slate-850 hover:border-orange-900 text-right rounded-xl text-[11px] font-sans hover:bg-slate-900 hover:text-white transition group flex flex-col justify-between"
              >
                <div className="font-bold text-slate-300 group-hover:text-orange-450">{item.name}</div>
                <div className="flex justify-between items-center w-full mt-1.5">
                  <span className="text-[9px] font-mono text-slate-500">باركود: {item.barcode}</span>
                  <span className="text-[10px] font-extrabold text-orange-400 font-mono">{item.price} ر.س</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Scanned Log list */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400">سجل ممسوحات هذا الجهاز الفوري:</h3>
          {scannedLogs.length === 0 ? (
            <p className="text-[10px] text-slate-500 text-center py-4 bg-slate-900/30 border border-dashed border-slate-900 rounded-xl">
              لم تقم بمسح أي سلع في هذه الجلسة حتى الآن.
            </p>
          ) : (
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {scannedLogs.map((log) => (
                <div key={log.id} className="p-2.5 bg-slate-900 rounded-xl border border-slate-850 flex items-center justify-between text-xs">
                  <div className="text-right">
                    <div className="font-bold text-white">{log.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">الباركود المسحوب: {log.barcode}</div>
                  </div>
                  <div className="text-left font-mono">
                    <div className="text-orange-400 font-bold">{log.price > 0 ? `${log.price} ر.س` : "غير مسعر"}</div>
                    <div className="text-[9px] text-slate-500">{log.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
