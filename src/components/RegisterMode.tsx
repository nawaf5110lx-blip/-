import React, { useState, useEffect, useRef } from "react";
import { Product, CartItem, SaleTransaction, DeviceInfo } from "../types";
import { 
  ShoppingBag, Plus, Minus, Trash2, Search, SlidersHorizontal, CreditCard, 
  DollarSign, RefreshCw, Barcode, ListFilter, Play, Sparkles, LogOut, CheckCircle, 
  FileText, History, Settings, Users, AlertCircle, ShoppingCart, TrendingUp, Info
} from "lucide-react";

interface RegisterModeProps {
  roomCode: string;
  deviceName: string;
  deviceId: string;
  onExit: () => void;
}

export default function RegisterMode({ roomCode, deviceName, deviceId, onExit }: RegisterModeProps) {
  // Products & Sales lists
  const [products, setProducts] = useState<Product[]>([]);
  const [salesHistory, setSalesHistory] = useState<SaleTransaction[]>([]);
  
  // Terminal status
  const [connectedDevices, setConnectedDevices] = useState<DeviceInfo[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  // POS Workspace
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("الكل");
  const [productSearch, setProductSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'checkout' | 'inventory' | 'history'>('checkout');

  // Interactive Live Scan Notification
  const [lastScanned, setLastScanned] = useState<{ product: Product | null; barcode: string; timestamp: string } | null>(null);

  // Cash Calculation overlay values
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [currentInvoice, setCurrentInvoice] = useState<SaleTransaction | null>(null);

  // Inventory Management dialog fields
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState("");
  const [formBarcode, setFormBarcode] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCategory, setFormCategory] = useState("مشروبات");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formStock, setFormStock] = useState("100");
  const [formDescription, setFormDescription] = useState("");

  const eventSourceRef = useRef<EventSource | null>(null);

  // Load store inventory and transactions of the terminal
  const fetchInventory = async () => {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error("Failed to fetch products db", e);
    }
  };

  const fetchSalesHistory = async () => {
    try {
      const res = await fetch("/api/sales");
      if (res.ok) {
        const data = await res.json();
        setSalesHistory(data);
      }
    } catch (e) {
      console.error("Failed to load sales database", e);
    }
  };

  // Sound generator (native web Audio API beep, so zero external dependencies!)
  const playCashierBeep = (type: 'success' | 'warn' | 'register') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = "sine";
      
      if (type === 'success') {
        oscillator.frequency.value = 1150; // High crisp scan beep
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'warn') {
        oscillator.frequency.value = 450; // Low dual tone for error/duplicate
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
      } else if (type === 'register') {
        // Multi frequency arcade register effect
        oscillator.frequency.value = 880;
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.08);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = "sine";
        osc2.frequency.value = 1400;
        gain2.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.08);
        osc2.start(audioCtx.currentTime + 0.08);
        osc2.stop(audioCtx.currentTime + 0.18);
      }
    } catch (e) {
      console.log("Audio beep playback was gated by browser permissions", e);
    }
  };

  // Setup SSE stream to listen for barcode scans
  useEffect(() => {
    fetchInventory();
    fetchSalesHistory();

    const connectToRoom = () => {
      setConnectionStatus('connecting');
      const sseUrl = `/api/sync/connect?room=${roomCode}&deviceId=${deviceId}&deviceName=${encodeURIComponent(deviceName)}&deviceRole=register`;
      
      const source = new EventSource(sseUrl);
      eventSourceRef.current = source;

      source.onopen = () => {
        setConnectionStatus('connected');
        console.log(`Successfully connected to room ${roomCode} as receiver.`);
      };

      source.onerror = (err) => {
        setConnectionStatus('disconnected');
        console.error("SSE Connection dropped. Retrying in 5 seconds...", err);
        source.close();
      };

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "ping") {
            return; // keepalive
          }

          if (data.type === "init") {
            setConnectedDevices(data.payload.devices);
            return;
          }

          if (data.type === "device_joined") {
            setConnectedDevices(prev => {
              const filter = prev.filter(d => d.id !== data.payload.id);
              return [...filter, data.payload];
            });
            return;
          }

          if (data.type === "device_left") {
            setConnectedDevices(prev => prev.filter(d => d.id !== data.payload.id));
            return;
          }

          // Barcode Scan Received Event!
          if (data.type === "scan") {
            const scannedBarcode = data.payload.barcode;
            const scannerDevice = data.payload.scannerName;
            
            console.log(`Captured remote scan event for: [${scannedBarcode}] from [${scannerDevice}]`);
            
            // Search local loaded products first to display
            handleBarcodeReceived(scannedBarcode);
          }

        } catch (e) {
          console.error("Parsing failed inside register listener:", e);
        }
      };
    };

    connectToRoom();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [roomCode]);

  // Handle a processed barcode scan (Remote or Simulated)
  const handleBarcodeReceived = (barcode: string) => {
    // Find matching product in memory
    // Let's refetch products just in case a new product was added on another page
    fetch("/api/products").then(async (res) => {
      if (res.ok) {
        const prodList = await res.json();
        setProducts(prodList);
        
        const matched = prodList.find((p: Product) => p.barcode === barcode);
        
        if (matched) {
          playCashierBeep('success');
          
          // Flash notification banner card on bottom
          setLastScanned({
            product: matched,
            barcode: barcode,
            timestamp: new Date().toLocaleTimeString("ar-SA")
          });

          // Add automatically to the shopping cart
          addToCart(matched);
        } else {
          playCashierBeep('warn');
          
          setLastScanned({
            product: null,
            barcode: barcode,
            timestamp: new Date().toLocaleTimeString("ar-SA")
          });

          // Prompt administrator to add this new unrecognized barcode!
          setFormBarcode(barcode);
          setFormName("");
          setFormPrice("");
          setFormStock("100");
          setFormCategory("عام");
          setFormImageUrl("");
          setFormDescription("");
          setEditingProduct(null);
          setIsAddProductModalOpen(true);
        }
      }
    });

    // Timeout notification banner after 5.5 seconds
    const timer = setTimeout(() => {
      setLastScanned(null);
    }, 5500);
  };

  // Add Product item to reactive UI Cart State
  const addToCart = (product: Product) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantity: updated[idx].quantity + 1
        };
        return updated;
      } else {
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  const decrementCartItem = (product: Product) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id);
      if (idx === -1) return prev;
      
      const item = prev[idx];
      if (item.quantity > 1) {
        const updated = [...prev];
        updated[idx] = {
          ...item,
          quantity: item.quantity - 1
        };
        return updated;
      } else {
        return prev.filter(i => i.product.id !== product.id);
      }
    });
  };

  const removeFromCart = (product: Product) => {
    setCart(prev => prev.filter(i => i.product.id !== product.id));
  };

  // Math totals
  const subtotal = cart.reduce((accum, current) => accum + (current.product.price * current.quantity), 0);
  const vatAmount = subtotal * 0.15; // standard 15% Saudi/Middle-East POS VAT tax
  const totalDue = Math.max(0, subtotal + vatAmount - discount);

  // Trigger manual simulation scan
  const handleSimulateScanInput = async (customBarcode: string) => {
    try {
      await fetch("/api/sync/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomCode,
          barcode: customBarcode,
          deviceName: "آيباد محاكي داخلي 🖥️"
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Submit product creation / update form
  const handleProductFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBarcode.trim() || !formPrice) {
      alert("البيانات الأساسية ناقصة.");
      return;
    }

    const payload = {
      name: formName.trim(),
      barcode: formBarcode.trim(),
      price: Number(formPrice),
      category: formCategory,
      imageUrl: formImageUrl.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150",
      stock: Number(formStock) || 100,
      description: formDescription.trim()
    };

    try {
      let response;
      if (editingProduct) {
        // Edit existing product
        response = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        // Create new
        response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (response.ok) {
        await fetchInventory();
        setIsAddProductModalOpen(false);
        setEditingProduct(null);
        
        // Add to cart if it was triggered by a missing scan barcode
        const createdProduct = await response.json();
        if (formBarcode === lastScanned?.barcode) {
          addToCart(createdProduct);
        }
      } else {
        const err = await response.json();
        alert(err.error || "فشل حفظ السلعة.");
      }
    } catch (err) {
      console.error("Save product failed", err);
    }
  };

  // Trigger editing a product modal
  const startEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormBarcode(prod.barcode);
    setFormPrice(String(prod.price));
    setFormCategory(prod.category);
    setFormImageUrl(prod.imageUrl);
    setFormStock(String(prod.stock));
    setFormDescription(prod.description || "");
    setIsAddProductModalOpen(true);
  };

  // Delete product
  const deleteProduct = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا المنتج نهائياً من الـ Nawaf System؟")) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchInventory();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Process Sales payment checkout
  const handleProcessCheckout = async () => {
    if (cart.length === 0) return;
    
    const cash = Number(cashReceived) || totalDue;
    const change = Math.max(0, cash - totalDue);

    const transactionData = {
      items: cart.map(i => ({
        productId: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity
      })),
      subtotal: subtotal,
      tax: vatAmount,
      discount: discount,
      total: totalDue,
      cashPaid: cash,
      changeDue: change,
      paymentMethod: paymentMethod,
      roomCode: roomCode
    };

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionData)
      });

      if (res.ok) {
        const data = await res.json();
        playCashierBeep('register');
        
        // Load fresh datasets
        await fetchSalesHistory();
        await fetchInventory();

        // Show Invoice Receipt layout
        setCurrentInvoice(data.sale);
        setIsCheckoutModalOpen(false);
        setCart([]); // Reset Cart
        setDiscount(0);
        setCashReceived("");
      }
    } catch (err) {
      console.error("Checkout process failed", err);
    }
  };

  // Filter products by search terms and sidebar categories
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.includes(productSearch) || p.barcode.includes(productSearch) || p.category.includes(productSearch);
    const matchesCat = selectedCategory === "الكل" || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const categories = ["الكل", "مشروبات ساخنة", "مشروبات باردة", "مخبوزات", "سناكس ومسليات", "قرطاسية", "إلكترونيات", "عام"];

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-140px)] bg-slate-950 text-white rounded-3xl overflow-hidden border border-orange-955/40" dir="rtl">
      
      {/* Right Column: Dynamic functional tabs (Checkout grid vs. Stock Inventory vs. Sales histories) */}
      <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-4 min-w-0">
        
        {/* Sub Header for POS */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-orange-950/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="py-1 px-3 bg-orange-600 rounded-lg text-slate-950 font-black text-sm">
              iPad POS
            </div>
            <div>
              <h2 className="text-md sm:text-lg font-black text-white">Nawaf POS System الموحد</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400">غرفة الربط الإلكتروني: <strong className="text-orange-450 font-mono tracking-wider">{roomCode}</strong></span>
                <span className="text-slate-700 text-xs">|</span>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500 animate-ping'}`} />
                  <span className="text-[10px] text-slate-400">
                    {connectionStatus === 'connected' ? `الحالة: متصل (${connectedDevices.length} جهاز)` : 'الحالة: غير متصل'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick tab switch bar */}
          <div className="flex gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-850 self-stretch sm:self-auto justify-between">
            <button
              onClick={() => setActiveTab('checkout')}
              className={`px-4 py-1.5 text-xs font-black rounded-lg transition ${
                activeTab === 'checkout' ? 'bg-orange-600 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              المبيعات (كاشير) 🛒
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-1.5 text-xs font-black rounded-lg transition ${
                activeTab === 'inventory' ? 'bg-orange-600 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              المنتجات والأسعار 📦
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                fetchSalesHistory();
              }}
              className={`px-4 py-1.5 text-xs font-black rounded-lg transition ${
                activeTab === 'history' ? 'bg-orange-600 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              سجل الفواتير 📄
            </button>
          </div>
        </div>

        {/* Tab 1: Terminal Checkout Grid */}
        {activeTab === 'checkout' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
            
            {/* Products Selector Grid Layout (Md: 8 cols) */}
            <div className="md:col-span-8 flex flex-col space-y-4">
              
              {/* Filter Row */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch">
                {/* Search Bar Input */}
                <div className="relative flex-1">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ابحث بالاسم، فئة السعر، أو باركود السلعة..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-orange-600 rounded-xl py-2 px-10 text-xs pr-10 text-white outline-none placeholder-slate-500 transition-all text-right"
                  />
                </div>

                {/* Simulated Quick Barcode Gun scan input (Very useful feature) */}
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 px-2 text-xs">
                  <Barcode className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-slate-400 whitespace-nowrap scale-90 hidden lg:inline">السكانر المحلي:</span>
                  <input
                    type="text"
                    placeholder="باركود مثل: 1001"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.target as HTMLInputElement;
                        handleSimulateScanInput(target.value);
                        target.value = "";
                      }
                    }}
                    className="w-28 bg-slate-950 border border-slate-850 rounded text-center text-orange-400 font-mono focus:border-orange-700 text-xs outline-none uppercase font-bold"
                  />
                </div>
              </div>

              {/* Categories horizontal pills bar */}
              <div className="flex gap-2.5 overflow-x-auto pb-1 max-w-full">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 text-[11px] rounded-xl border transition shrink-0 ${
                      selectedCategory === cat
                        ? "bg-orange-600 border-orange-600 text-slate-950 font-black"
                        : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Products list viewer */}
              {filteredProducts.length === 0 ? (
                <div className="bg-slate-900/10 border border-dashed border-slate-900 rounded-2xl p-12 text-center text-slate-500 flex-1 flex flex-col justify-center">
                  <ShoppingBag className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-400 mb-1">لا توجد سلع متطابقة للفئة</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    يمكنك إضافة منتجات جديدة مخزنة في الـ Nawaf System عبر التوجه لتبويب المنتجات بالأعلى والبدء بالتسعير الفوري.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto max-h-[460px] pr-1">
                  {filteredProducts.map((p) => {
                    const cartItem = cart.find(item => item.product.id === p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className={`bg-slate-900 border rounded-2xl p-2.5 flex flex-col gap-2 relative cursor-pointer hover:scale-[1.02] active:scale-95 transition-all group ${
                          cartItem ? "border-orange-500" : "border-slate-850 hover:border-slate-700"
                        }`}
                      >
                        {/* Image preview space */}
                        <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-950 relative border border-slate-850">
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-all"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute bottom-2 right-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-orange-400 border border-orange-950">
                            {p.barcode}
                          </div>
                          
                          {cartItem && (
                            <div className="absolute top-2 right-2 bg-orange-600 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow-md">
                              {cartItem.quantity}
                            </div>
                          )}
                        </div>

                        {/* Title & metrics */}
                        <div className="flex flex-col justify-between flex-1 min-w-0 px-1 text-right">
                          <h4 className="text-xs font-bold text-white line-clamp-1">{p.name}</h4>
                          <div className="flex justify-between items-center mt-1 w-full">
                            <span className="text-[10px] text-slate-500">{p.category}</span>
                            <strong className="text-xs text-orange-450 font-mono font-black">{p.price.toFixed(2)} ر.س</strong>
                          </div>

                          <div className="mt-2 text-[10px] border-t border-slate-805/40 pt-1.5 flex justify-between">
                            <span className="text-slate-550">المستودع:</span>
                            <span className={p.stock < 10 ? "text-rose-500 font-bold" : "text-emerald-400"}>
                              {p.stock} قطعة
                            </span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Shopping Cart Drawer POS section (Md: 4 cols) */}
            <div className="md:col-span-4 bg-slate-900 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between h-full min-h-[460px]">
              
              {/* Header section with Connected scanners checklist status */}
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-1.5">
                    <ShoppingCart className="w-4.5 h-4.5 text-orange-500" />
                    <span className="text-xs font-bold text-slate-200">سلة المبيعات الحالية</span>
                  </div>
                  <span className="bg-slate-950 text-orange-400 font-mono text-xs px-2 py-0.5 rounded-full font-bold">
                    {cart.reduce((totals, c) => totals + c.quantity, 0)} سلع
                  </span>
                </div>

                {/* Main Cart listing scrolling container */}
                {cart.length === 0 ? (
                  <div className="h-64 flex flex-col justify-center items-center text-slate-500 text-center px-4 space-y-2">
                    <Barcode className="w-12 h-12 text-slate-700 animate-pulse" />
                    <p className="text-xs font-bold text-slate-400">بانتظار مسح الباركود من الجوال...</p>
                    <p className="text-[10px] text-slate-500 leading-normal max-w-[180px]">
                      عند توجيه كاميرا الجوال لأي ملصق أو باركود، ستضاف السلعة وتفاصيلها هنا تلقائياً في الوقت الفعلي!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.product.id} className="p-2 bg-slate-955 rounded-xl border border-slate-850 flex items-center gap-2">
                        {/* Short thumbnail */}
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-10 h-10 object-cover rounded-lg bg-slate-900 shrink-0 border border-slate-800"
                        />
                        {/* Details */}
                        <div className="flex-1 min-w-0 text-right">
                          <h4 className="text-[11px] font-bold text-white line-clamp-1">{item.product.name}</h4>
                          <span className="text-[10px] text-orange-400 font-mono font-bold">
                            {(item.product.price).toFixed(2)} ر.س
                          </span>
                        </div>
                        {/* Counter tools */}
                        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 scale-90">
                          <button
                            onClick={() => decrementCartItem(item.product)}
                            className="p-1 hover:text-white text-slate-500 rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-1.5 text-xs text-white font-mono font-black">{item.quantity}</span>
                          <button
                            onClick={() => addToCart(item.product)}
                            className="p-1 hover:text-white text-slate-500 rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        {/* Remove */}
                        <button
                          onClick={() => removeFromCart(item.product)}
                          className="p-1 text-slate-550 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtotal calculator segment */}
              <div className="border-t border-slate-800 pt-3 mt-4 space-y-2.5 text-xs text-right">
                <div className="flex justify-between">
                  <span className="text-slate-450">المجموع الأساسي:</span>
                  <span className="font-mono text-slate-300">{subtotal.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450">ضريبة القيمة المضافة (١٥٪):</span>
                  <span className="font-mono text-slate-300">{vatAmount.toFixed(2)} ر.س</span>
                </div>

                {/* Discount controller */}
                <div className="flex gap-2 justify-between items-center pt-1 border-t border-dashed border-slate-800/40">
                  <span className="text-slate-455">خصم إضافي:</span>
                  <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                    <input
                      type="number"
                      value={discount || ""}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                      placeholder="0.00"
                      className="w-14 bg-transparent outline-none font-mono text-right text-orange-400 font-extrabold focus:ring-0 placeholder-slate-700"
                    />
                    <span className="text-[10px] text-slate-500">ر.س</span>
                  </div>
                </div>

                {/* Grand Total Row */}
                <div className="flex justify-between items-center pt-2.5 border-t border-slate-800 text-sm">
                  <strong className="text-white text-md">الحساب الصافي الإجمالي:</strong>
                  <strong className="text-orange-500 text-lg font-mono font-black tracking-tight">{totalDue.toFixed(2)} ر.س</strong>
                </div>

                {/* Action Buttons to Pay */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setCart([])}
                    disabled={cart.length === 0}
                    className="flex-1 py-3 text-slate-400 bg-slate-950 border border-slate-850 hover:bg-slate-900 transition font-black text-xs rounded-xl cursor-pointer"
                  >
                    إفراغ السلّة
                  </button>
                  <button
                    onClick={() => {
                      if (cart.length === 0) return;
                      setIsCheckoutModalOpen(true);
                      setCashReceived(String(Math.ceil(totalDue)));
                    }}
                    disabled={cart.length === 0}
                    className="flex-[2] py-3 text-slate-950 bg-orange-600 hover:bg-orange-500 transition font-black text-xs rounded-xl shadow-[0_4px_15px_rgba(234,88,12,0.2)] cursor-pointer flex justify-center items-center gap-1"
                  >
                    <CreditCard className="w-4 h-4 text-slate-950" />
                    <span>تسجيل الدفع والبيع</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Tab 2: Stock Inventory Catalog Management */}
        {activeTab === 'inventory' && (
          <div className="space-y-4 flex-1">
            
            {/* Header statistics of inventory */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900/60 p-4 border border-slate-850 rounded-2xl text-right">
                <span className="text-[10px] text-slate-400">عدد المنتجات المسجلة في السستم</span>
                <div className="text-xl font-black font-mono text-orange-450 mt-1">{products.length} فئة</div>
              </div>
              <div className="bg-slate-900/60 p-4 border border-slate-850 rounded-2xl text-right">
                <span className="text-[10px] text-slate-400">إجمالي قطع المخزون الكلي</span>
                <div className="text-xl font-black font-mono text-emerald-400 mt-1">
                  {products.reduce((acc, current) => acc + current.stock, 0)} قطعة
                </div>
              </div>
              <div className="bg-slate-900/60 p-4 border border-slate-850 rounded-2xl text-right flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400">تحديثات المستودع</span>
                  <div className="text-xs font-bold text-white mt-1">متصامنة وتحديث فوري</div>
                </div>
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setFormName("");
                    setFormBarcode("");
                    setFormPrice("");
                    setFormStock("100");
                    setFormCategory("عام");
                    setFormImageUrl("");
                    setFormDescription("");
                    setIsAddProductModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-orange-600 text-slate-950 font-black text-xs rounded-xl shadow flex items-center gap-1 hover:bg-orange-500 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-950" />
                  <span>إضافة منتج جديد</span>
                </button>
              </div>
            </div>

            {/* Inventory table structure */}
            <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-955 border-b border-slate-850 flex flex-col sm:flex-row justify-between items-center gap-2">
                <span className="text-xs font-black text-slate-200">جدول السلع والأسعار والمخزون</span>
                
                <input
                  type="text"
                  placeholder="فلترة في المخزون بالاسم أو الكود..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="bg-slate-950 text-xs border border-slate-800 rounded-lg px-2.5 py-1 outline-none text-right font-sans focus:border-orange-900"
                />
              </div>

              <div className="overflow-x-auto w-full">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950/40 text-slate-450 border-b border-slate-850/60 font-medium">
                      <th className="p-3">صورة السلعة</th>
                      <th className="p-3">اسم المنتج والمواصفات</th>
                      <th className="p-3 text-center">الباركود المسجل</th>
                      <th className="p-3">السعر لـ ر.س</th>
                      <th className="p-3 text-center">المخزون الحالي</th>
                      <th className="p-3 text-center">الفئة</th>
                      <th className="p-3 text-left">خيارات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-855/35">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-950/30 transition-colors">
                        <td className="p-3 shrink-0">
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-10 h-10 object-cover rounded-lg bg-slate-950 border border-slate-800"
                            referrerPolicy="no-referrer"
                          />
                        </td>
                        <td className="p-3 font-bold text-white">
                          <div>{p.name}</div>
                          {p.description && <div className="text-[9px] text-slate-500 font-normal mt-0.5 font-sans truncate max-w-sm">{p.description}</div>}
                        </td>
                        <td className="p-3 text-center font-mono text-orange-400 font-extrabold">{p.barcode}</td>
                        <td className="p-3 font-mono font-bold text-slate-300">{p.price.toFixed(2)} ر.س</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 text-[10px] rounded-full font-bold font-mono ${p.stock < 10 ? 'bg-red-950/50 text-red-400 border border-red-900/40' : 'bg-slate-950 text-emerald-400'}`}>
                            {p.stock} حبة
                          </span>
                        </td>
                        <td className="p-3 text-center text-slate-400">{p.category}</td>
                        <td className="p-3 text-left">
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => startEditProduct(p)}
                              className="px-2.5 py-1 text-[10px] font-bold text-orange-450 bg-orange-950/15 hover:bg-orange-950/40 border border-orange-900/40 rounded-lg"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => deleteProduct(p.id)}
                              className="px-2 py-1 text-[10px] text-slate-400 hover:text-red-400 hover:bg-slate-950 rounded-lg"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Detailed Sales History logs & stats */}
        {activeTab === 'history' && (
          <div className="space-y-4 flex-1">
            {/* Sales performance row card */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/60 p-4 border border-slate-850 rounded-2xl text-right">
                <span className="text-[10px] text-slate-450">إجمالي المبيعات (Revenue)</span>
                <div className="text-xl font-black font-mono text-orange-500 mt-1">
                  {salesHistory.reduce((acc, current) => acc + current.total, 0).toFixed(2)} ر.س
                </div>
              </div>
              <div className="bg-slate-900/60 p-4 border border-slate-850 rounded-2xl text-right">
                <span className="text-[10px] text-slate-450">عدد الصفقات والفواتير</span>
                <div className="text-xl font-black font-mono text-white mt-1">
                  {salesHistory.length} فاتورة
                </div>
              </div>
              <div className="bg-slate-900/60 p-4 border border-slate-850 rounded-2xl text-right">
                <span className="text-[10px] text-slate-450">إجمالي ضريبة القيمة المضافة</span>
                <div className="text-xl font-black font-mono text-slate-350 mt-1">
                  {salesHistory.reduce((acc, current) => acc + current.tax, 0).toFixed(2)} ر.س
                </div>
              </div>
              <div className="bg-slate-900/60 p-4 border border-slate-850 rounded-2xl text-right">
                <span className="text-[10px] text-slate-450">إجمالي الخصومات الممنوحة</span>
                <div className="text-xl font-black font-mono text-rose-450 mt-1">
                  {salesHistory.reduce((acc, s) => acc + s.discount, 0).toFixed(2)} ر.س
                </div>
              </div>
            </div>

            {/* Sales ledger list */}
            <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-955 border-b border-slate-850 flex items-center justify-between">
                <span className="text-xs font-black text-slate-205">دفتر السجل التاريخي للمبيعات</span>
                <span className="text-[10px] text-slate-500 font-mono">آخر تحديث: {new Date().toLocaleTimeString("ar-SA")}</span>
              </div>

              {salesHistory.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  لا توجد فواتير مبيعات مسجلة في هذا الباب حتى الآن.
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-950/45 text-slate-450 border-b border-slate-850 font-medium">
                        <th className="p-3">رقم الفاتورة Reference</th>
                        <th className="p-3">تاريخ وميعاد الصفقة</th>
                        <th className="p-3 text-center">مجموع السلع</th>
                        <th className="p-3">الضريبة VAT</th>
                        <th className="p-3">الحساب النهائي</th>
                        <th className="p-3">طريقة الدفع</th>
                        <th className="p-3 text-left">التحكم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40">
                      {[...salesHistory].reverse().map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-950/20">
                          <td className="p-3 font-mono font-bold text-white uppercase">{sale.id.slice(0, 15)}...</td>
                          <td className="p-3 text-slate-400 font-mono">{new Date(sale.timestamp).toLocaleString("ar-SA")}</td>
                          <td className="p-3 text-center font-bold">
                            {sale.items.reduce((acc, current) => acc + current.quantity, 0)} حبات
                          </td>
                          <td className="p-3 font-mono text-slate-400">{sale.tax.toFixed(2)} ر.س</td>
                          <td className="p-3 font-mono font-black text-orange-450">{sale.total.toFixed(2)} ر.س</td>
                          <td className="p-3">
                            <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded font-bold">
                              {sale.paymentMethod === 'cash' ? '💵 كاش' : sale.paymentMethod === 'card' ? '💳 شبكة مدى' : '🏦 تحويل'}
                            </span>
                          </td>
                          <td className="p-3 text-left">
                            <button
                              onClick={() => setCurrentInvoice(sale)}
                              className="px-3 py-1 text-[10px] font-bold text-slate-300 bg-slate-950 hover:bg-slate-800 rounded-lg border border-slate-800"
                            >
                              إصدار الفاتورة 📄
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Left Column Drawer: Live Link Devicespresence (Lg: 3 cols) */}
      <div className="w-full lg:w-76 bg-slate-950 lg:border-r border-t lg:border-t-0 border-slate-850 p-4 space-y-6 flex flex-col justify-between select-none">
        
        {/* Device Presence segment */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-900 pb-3">
            <Users className="w-4.5 h-4.5 text-orange-500" />
            <h3 className="text-xs font-black text-white">الأجهزة المتصلة بالمزامنة</h3>
          </div>

          <div className="space-y-2.5">
            {/* Display local terminal device indicator */}
            <div className="p-2.5 rounded-xl bg-orange-600/10 border border-orange-950/60 text-xs flex justify-between items-center">
              <div className="text-right">
                <div className="font-bold text-orange-100 flex items-center gap-1">
                  <span>هذا الجهاز (الآيباد)</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                </div>
                <div className="text-[9px] text-orange-450 font-mono">الكاشير الرئيسي (Register)</div>
              </div>
              <span className="text-[10px] font-mono text-slate-400">HOST</span>
            </div>

            {/* Display remote terminals connected inside same session room */}
            {connectedDevices.filter(d => d.id !== deviceId).length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/30 border border-dashed border-slate-900 text-center py-6">
                <p className="text-[10px] text-slate-500 leading-normal max-w-[180px] mx-auto">
                  لا توجد هواتف قارئة متصلة في الغرفة الآن للباركود.
                </p>
                <div className="mt-3 text-[10px] bg-slate-950 text-orange-400/80 p-2 rounded leading-relaxed border border-orange-950/20">
                  يرجى فتح رابط الموقع من هاتف آخر واستخدام كود الغرفة <strong className="font-mono text-white">{roomCode}</strong> كمود "جوال قارئ" لبدء الربط في نفس اللحظة!
                </div>
              </div>
            ) : (
              connectedDevices.filter(d => d.id !== deviceId).map(dev => (
                <div key={dev.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-850 text-xs flex justify-between items-center">
                  <div className="text-right">
                    <div className="font-bold text-white flex items-center gap-1">
                      <span>{dev.name.slice(0, 18)}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {dev.role === 'scanner' ? '📱 ماسح الباركود المحمول' : '💻 كاشير إضافي'}
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono">CONNECTED</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Notification Banner displaying scan action */}
        {lastScanned && (
          <div className="p-3 bg-slate-900 border border-orange-500 rounded-xl relative overflow-hidden shadow-xl animate-bounce">
            <div className="absolute top-0 right-0 h-1 bg-orange-500 w-full"></div>
            <div className="flex items-start gap-2.5 text-xs text-right mt-1.5">
              {lastScanned.product ? (
                <>
                  <img
                    src={lastScanned.product.imageUrl}
                    alt={lastScanned.product.name}
                    className="w-10 h-10 object-cover rounded bg-slate-950 shrink-0 border border-slate-800"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-900/30 px-1 py-0.5 rounded">
                      تم المسح وإضافته للسلّة ✓
                    </span>
                    <h4 className="font-bold text-white text-xs truncate mt-1">{lastScanned.product.name}</h4>
                    <p className="text-[10px] font-mono text-orange-400 font-bold mt-0.5">{lastScanned.product.price.toFixed(2)} ر.س</p>
                  </div>
                </>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-[9px] text-yellow-450 font-bold bg-yellow-950/60 border border-yellow-905 p-1 rounded">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                    <span>السلعة غير مسجلة!</span>
                  </div>
                  <h4 className="font-bold text-slate-200 text-xs mt-1.5">باركود غريب ممسوح: {lastScanned.barcode}</h4>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal text-right">
                    لقد قمنا بسحب الباركود، وتم فتح نافذة التسجيل لإضافته لـ Nawaf System لتتمكن من تسعيره وبيعه فورياً!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Virtural Manual Scanned Generator on bottom */}
        <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-900 text-xs text-right">
          <p className="font-bold text-slate-300">سكانر افتراضي للغرفة (للاختبار):</p>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <button
              onClick={() => handleSimulateScanInput("1001")}
              className="p-1 px-1.5 bg-slate-950 hover:bg-orange-600 hover:text-slate-950 text-[10px] rounded text-slate-400 border border-slate-800 font-mono transition"
            >
              1001 قهوة
            </button>
            <button
              onClick={() => handleSimulateScanInput("2002")}
              className="p-1 px-1.5 bg-slate-950 hover:bg-orange-600 hover:text-slate-950 text-[10px] rounded text-slate-400 border border-slate-800 font-mono transition"
            >
              2002 ماء
            </button>
            <button
              onClick={() => handleSimulateScanInput("3003")}
              className="p-1 px-1.5 bg-slate-950 hover:bg-orange-600 hover:text-slate-950 text-[10px] rounded text-slate-400 border border-slate-800 font-mono transition"
            >
              3003 كرواسون
            </button>
            <button
              onClick={() => handleSimulateScanInput("5005")}
              className="p-1 px-1.5 bg-slate-950 hover:bg-orange-600 hover:text-slate-950 text-[10px] rounded text-slate-400 border border-slate-800 font-mono transition"
            >
              5005 آيفون
            </button>
            <button
              onClick={() => handleSimulateScanInput("6006")}
              className="p-1 px-1.5 bg-slate-950 hover:bg-orange-600 hover:text-slate-950 text-[10px] rounded text-slate-400 border border-slate-800 font-mono transition"
            >
              6006 شيبس
            </button>
            <button
              onClick={() => handleSimulateScanInput(String(Math.floor(Math.random() * 8000) + 9000))}
              className="p-1 px-1.5 bg-orange-950/30 hover:bg-orange-600 hover:text-slate-950 text-[10px] rounded text-orange-400 border border-orange-900/40 font-mono transition font-bold"
            >
              جديد عشوائي
            </button>
          </div>
          <p className="text-[9px] text-slate-500 mt-2 text-center">
            (انقر للمحاكاة والتجربة من داخل المتصفح مباشرة)
          </p>
        </div>

      </div>

      {/* MODAL 1: POS PAYMENT CALCULATOR DIALOG */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex justify-center items-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-orange-955/40 rounded-3xl max-w-md w-full p-6 space-y-5 text-right relative">
            <h3 className="text-md sm:text-lg font-black text-white pb-3 border-b border-slate-800 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-orange-500 shrink-0" />
              <span>تفاصيل الدفع والمحاسبة الفورية</span>
            </h3>

            {/* Price review summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400">إجمالي الحساب المطلوب للسلع:</span>
                <div className="text-xl font-black font-mono text-orange-400 mt-1">{totalDue.toFixed(2)} ر.س</div>
              </div>
              <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl text-slate-300">
                {cart.length} سلع مختلفة
              </span>
            </div>

            {/* Payment method selector */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400">طريقة الدفع للمحاسبة:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                    paymentMethod === 'cash' ? 'bg-orange-600/10 border-orange-600 text-orange-400' : 'bg-slate-950 border-slate-850 text-slate-400'
                  }`}
                >
                  💵 نقدًا كاش
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                    paymentMethod === 'card' ? 'bg-orange-600/10 border-orange-600 text-orange-400' : 'bg-slate-950 border-slate-850 text-slate-400'
                  }`}
                >
                  💳 مدى/شبكة
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                    paymentMethod === 'transfer' ? 'bg-orange-600/10 border-orange-600 text-orange-400' : 'bg-slate-950 border-slate-850 text-slate-400'
                  }`}
                >
                  🏦 تحويل رسمي
                </button>
              </div>
            </div>

            {/* Cash Tendered received input field (with dynamic Change due calculation) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-400">المبلغ المسلّم من العميل (ر.س):</label>
                <span className="text-[10px] text-slate-500 font-mono">تحديث فوري للمتبقي</span>
              </div>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="أدخل المبلغ المقابل..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-orange-600 py-3 rounded-xl px-4 text-center font-mono font-extrabold text-white text-lg outline-none transition"
              />
            </div>

            {/* Change due mathematical result */}
            <div className="p-3.5 bg-slate-955 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
              <span className="text-slate-400">مبلغ المتبقي للعميل (الخردة):</span>
              <strong className="font-mono text-emerald-400 text-sm font-bold">
                {Math.max(0, (Number(cashReceived) || totalDue) - totalDue).toFixed(2)} ر.س
              </strong>
            </div>

            {/* Modal actions close/confirm */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-400 bg-slate-950 hover:bg-slate-950/60 rounded-xl border border-slate-850 cursor-pointer"
              >
                رجوع وإلغاء
              </button>
              <button
                type="button"
                onClick={handleProcessCheckout}
                className="flex-[2] py-2.5 text-xs font-semibold text-slate-950 bg-orange-600 hover:bg-orange-500 rounded-xl cursor-pointer font-black border border-orange-505"
              >
                تأكيد الدفع وطباعة الفاتورة ✓
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: ADD & EDIT PRODUCT FORM VIEW */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto" dir="rtl">
          <form onSubmit={handleProductFormSubmit} className="bg-slate-900 border border-orange-955/40 rounded-3xl max-w-md w-full p-6 space-y-4 text-right my-8 relative">
            <h3 className="text-sm sm:text-base font-black text-white pb-2.5 border-b border-slate-800">
              {editingProduct ? `تعديل السلعة: ${editingProduct.name}` : "تسجيل وإضافة سلعة جديدة لـ Nawaf System"}
            </h3>

            {/* Input fields */}
            <div className="space-y-3 text-xs">
              
              {/* Product name */}
              <div className="space-y-1">
                <label className="block text-slate-405 font-bold">اسم المنتج:</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: لوز طازج محمص"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-orange-600"
                />
              </div>

              {/* Barcode and Price side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-405 font-bold">الباركود (رقم):</label>
                  <input
                    type="text"
                    required
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value.replace(/[^0-9a-zA-Z-]/g, ""))}
                    placeholder="مثال: 728391740"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-center font-mono focus:border-orange-600 font-extrabold uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-405 font-bold">سعر البيع للعميل (ر.س):</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-center font-mono focus:border-orange-600 font-extrabold"
                  />
                </div>
              </div>

              {/* Category selector */}
              <div className="space-y-1">
                <label className="block text-slate-405 font-bold">الفصيلة / تصنيف السلعة:</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-orange-600"
                >
                  <option value="مشروبات ساخنة">مشروبات ساخنة ☕</option>
                  <option value="مشروبات باردة">مشروبات باردة 🥤</option>
                  <option value="مخبوزات">مخبوزات 🥐</option>
                  <option value="سناكس ومسليات">سناكس ومسليات 🥔</option>
                  <option value="قرطاسية">قرطاسية 🖊️</option>
                  <option value="إلكترونيات">إلكترونيات 🔌</option>
                  <option value="عام">تصنيف عام 🏷️</option>
                </select>
              </div>

              {/* Stock quantity level */}
              <div className="space-y-1">
                <label className="block text-slate-405 font-bold">عدد المخزون الإبتدائي الكلي بالمستودع:</label>
                <input
                  type="number"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  placeholder="100"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-orange-600 font-mono"
                />
              </div>

              {/* Simulated Image URL or quick pick presets */}
              <div className="space-y-1">
                <label className="block text-slate-405 font-bold">رابط صورة المنتج (Unsplash أو رابط مماثل):</label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="مثال: https://images.unsplash.com/..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white outline-none text-left font-mono focus:border-orange-600"
                />
                <div className="flex gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-500 self-center">روابط سريعة:</span>
                  <button
                    type="button"
                    onClick={() => setFormImageUrl("https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300")}
                    className="text-[9px] bg-slate-950 hover:bg-slate-800 px-2 py-0.5 rounded text-orange-400"
                  >
                    قهوة
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormImageUrl("https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=300")}
                    className="text-[9px] bg-slate-950 hover:bg-slate-800 px-2 py-0.5 rounded text-orange-400"
                  >
                    حلوى 🥐
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormImageUrl("https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300")}
                    className="text-[9px] bg-slate-950 hover:bg-slate-800 px-2 py-0.5 rounded text-orange-400"
                  >
                    شربز 🥤
                  </button>
                </div>
              </div>

              {/* Descriptions */}
              <div className="space-y-1">
                <label className="block text-slate-450">وصف موجز للمنتج:</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="الوظيفة أو العلامة التجارية..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white outline-none text-right focus:border-orange-600"
                />
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsAddProductModalOpen(false);
                  setEditingProduct(null);
                }}
                className="flex-1 py-2 text-xs font-bold text-slate-400 bg-slate-950 hover:bg-slate-950/60 rounded-xl border border-slate-850"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-[2] py-2 text-xs font-black text-slate-950 bg-orange-600 hover:bg-orange-500 rounded-xl"
              >
                حفظ السلعة وتأشير الرف ✓
              </button>
            </div>

          </form>
        </div>
      )}

      {/* INVOICE thermal Mock Receipt Drawer preview */}
      {currentInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4">
            
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-800 text-xs">
              <span className="text-slate-450">معاينة الفاتورة الحرارية</span>
              <button
                onClick={() => setCurrentInvoice(null)}
                className="text-red-400 font-bold hover:underline"
              >
                إغلاق معاينة الفاتورة ×
              </button>
            </div>

            {/* Simulated Printed Thermal Receipt */}
            <div className="bg-white text-slate-950 p-5 rounded-md font-mono text-xs space-y-4 shadow-xl border border-slate-100 text-right">
              
              {/* Receipt Header logo */}
              <div className="text-center space-y-1">
                <h3 className="font-extrabold text-sm tracking-wider">NAWAF SYSTEM</h3>
                <p className="text-[9px] font-sans text-slate-600">جدد حياتك مع الحلول التقنية الذكية</p>
                <div className="border-b border-dashed border-slate-300 w-full py-1"></div>
              </div>

              {/* Receipt Stats info */}
              <div className="space-y-0.5 text-[9px] text-slate-705 font-mono">
                <div className="flex justify-between">
                  <span>كود الفاتورة:</span>
                  <span className="uppercase font-bold">{currentInvoice.id.slice(0, 14)}</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ والوقت:</span>
                  <span>{new Date(currentInvoice.timestamp).toLocaleString("ar-SA")}</span>
                </div>
                <div className="flex justify-between">
                  <span>منفذ المبيعات:</span>
                  <span>{currentInvoice.roomCode} / Terminal</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-300 w-full"></div>

              {/* Items tables */}
              <div className="space-y-2 text-[10px]">
                <div className="flex justify-between font-extrabold">
                  <span className="text-right">اسم السلعة وعددها</span>
                  <span>الحساب</span>
                </div>
                {currentInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between font-sans">
                    <span className="text-slate-800">{item.name} ×{item.quantity}</span>
                    <span className="font-mono">{(item.price * item.quantity).toFixed(2)} ر.س</span>
                  </div>
                ))}
              </div>

              <div className="border-b border-dashed border-slate-300 w-full"></div>

              {/* Totals table receipt */}
              <div className="space-y-1 text-[10px] font-sans">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono">{(currentInvoice.total - currentInvoice.tax + currentInvoice.discount).toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between">
                  <span>ضريبة القيمة المضافة (١٥٪):</span>
                  <span className="font-mono">{currentInvoice.tax.toFixed(2)} ر.س</span>
                </div>
                {currentInvoice.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>خصم خاص مطبق:</span>
                    <span className="font-mono">-{currentInvoice.discount.toFixed(2)} ر.س</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1 border-t border-dashed border-slate-300 font-mono">
                  <span>الإجمالي الكلي:</span>
                  <span>{currentInvoice.total.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1 text-[9px]">
                  <span>المبلغ المدفوع:</span>
                  <span className="font-mono">{currentInvoice.cashPaid.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-slate-600 text-[9px]">
                  <span>المتبقي للعميل (خردة):</span>
                  <span className="font-mono">{currentInvoice.changeDue.toFixed(2)} ر.س</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-300 w-full"></div>

              {/* Paid method */}
              <div className="text-center space-y-2 text-[10px]">
                <p className="font-sans font-bold bg-slate-100 p-1.5 rounded">
                  طريقة الدفع: {currentInvoice.paymentMethod === 'cash' ? '💵 كاش نقدًا' : currentInvoice.paymentMethod === 'card' ? '💳 شبكة مدى' : '🏦 تحويل بنكي'}
                </p>
                <div className="flex flex-col items-center justify-center p-1 font-mono text-[9px] text-slate-500">
                  <span>|| | ||| | || ||| || |||</span>
                  <span>{currentInvoice.id.slice(0, 16).toUpperCase()}</span>
                </div>
                <p className="font-sans font-medium text-[9px] text-slate-500">نشكركم لتسوقكم واستخدامكم Nawaf System</p>
              </div>

            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2 text-xs font-black text-slate-905 bg-white hover:bg-slate-100 rounded-xl text-center"
              >
                طباعة الفاتورة 🖨️
              </button>
              <button
                onClick={() => setCurrentInvoice(null)}
                className="flex-1 py-2 text-xs font-black text-slate-950 bg-orange-600 hover:bg-orange-500 rounded-xl text-center"
              >
                تم ومتابعة جديد ✓
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
