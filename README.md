# 🛒 𝗡𝗮𝘄𝗮𝗳 𝗦𝘆𝘀𝘁𝗲𝗺 | نظام نواف الذكي للمبيعات والكاشير

**Nawaf System** is a professional, full-stack, real-time Smart Cashier POS (Point of Sale) system designed to deliver high-performance retail operations. It features seamless synchronization across multiple devices, allowing you to turn any smartphone into a remote barcode scanner that instantly populates the primary iPad checkout terminal.

**نواَف سيستم (Nawaf System Pro)** هو نظام كاشير ونقاط بيع من الطراز الرفيع، مُمكّن بالكامل للعمل كمنصة موحدة ومترابطة بين الأجهزة المختلفة في وقت واحد. يتيح لك النظام استخدام شاشة الآيباد كجهاز الكاشير الرئيسي للمبيعات وربطه فورياً بجوالك لمسح الباركود باستخدام كاميرا الهاتف المحمول لتظهر معلومات المنتج وصورته وسعره في السلة بثوانٍ معدودة.

---

## 🎨 Visual Preview & Theme / الهوية البصرية والسمة العامة
The system is built with a premium, high-contrast dark visual identity (**Cosmic Obsidian & Vivid Orange Alert**) styled using Tailwind CSS and structured with responsive bento-grids for seamless desktop, iPad, and mobile configurations.

تم تصميم النظام بهوية بصرية داكنة فاخرة باللون البرتقالي المتوهج لتمنح مظهراً عصرياً وجاذباً لبيئة العمل (مثل المقاهي الفارهة، والقرطاسيات، ومحلات التجزئة الحديثة)، مع خطوط عربية فاخرة ومحاذاة كاملة اليمين (RTL).

---

## ✨ Features / المميزات والوظائف الأساسية

### 1. 📲 Multi-Device Synchronization (Server-Sent Events) / ربط وتزامن الأجهزة المتعددة
- Real-time, instant broadcast pipeline constructed using native **Server-Sent Events (SSE)**.
- No bulky third-party state managers; simple, lightweight dynamic message queues.
- Synchronize multiple mobile devices as dedicated barcode scanners feeding a single host iPad terminal automatically.
- **تزامن لاسلكي لحظي:** بفضل استخدام تقنية *SSE* الخفيفة على الخادم، يتم إرسال الباركود الممسوح من هاتفك فورا لغرفة الربط الإلكترونية ليدرج في سلة المشتريات بالآيباد بلحظتها.

### 2. 🏷️ Smart Barcode Scanner (Camera & Manual) / قارئ باركود ذكي (كاميرا ومطابقة يدوية)
- Standard HTML5 hardware camera access with front/rear lens detection optimized for smartphones.
- Instant fallback interface to quickly test and prototype barcode triggers without physical products.
- Beautiful cashier "Beep" sound effects integrated using the browser's native **Web Audio API** (no bulky media files required).
- **قارئ الكاميرا والمحاكاة:** يدعم النظام تنشيط الكاميرا وقراءة الملصقات، مع تزويد المستخدم بأزرار محاكاة سريعة فائقة الفائدة تتيح اختبار السستم بلمسة واحدة دون حمل بضاعة حقيقية.

### 3. 📦 Full Catalog & Stock Inventory / إدارة شاملة للمخزون والمنتجات
- Comprehensive control panel to add, edit, and safely delete products.
- Upload images or paste URLs, specify barcodes, standard pricing, category tags, cost points, and live stock quantities.
- Real-time inventory deduction safeguards on successful point-of-sale transactions.
- **مستودع متكامل:** تتبع كميات البضائع المتبقية مع إمكانية تعديل الأسعار، وإضافة صور عالية الوضوح لكل منتج، وإنشاء باركود مخصص وجديد يدوياً.

### 4. 💳 Advanced POS Checkout Workspace / واجهة السلة وتصفية الفواتير
- Flexible cart items control counter (`+` and `-` adjustments).
- Automated calculations for **15% standard Saudi Arabia/GCC VAT** tax rates.
- Absolute discount thresholds (SAR) directly processed on the grand total.
- Cash change due estimation calculators for visual verification on-screen.
- **محاسبة ذكية وفواتير:** احتساب آلي للضريبة، خصم نقدي فوري، وتحديد طرق الدفع المفضلة (كاش، شبكة مدى Mada، أو تحويل بنكي).

---

## 🛠️ Architecture & Tech Stack / الهيكل البرمجي والتقنيات المستخدمة

The system is developed with a production-grade full-stack architecture keeping API keys and background transactions closed and secure:

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, and Web Audio APIs.
- **Backend:** ExpressJS server serving as both the static server and the SSE Event Stream Orchestrator.
- **Module System:** CommonJS build outputs (`dist/server.cjs`) powered by **esbuild** to prevent file-system cold starts on Cloud Run.

---

## 🚀 How to Run Locally / طريقة التشغيل والتركيب المحلي

First, ensure you have **Node.js** installed, then follow these straightforward steps:

### 1. Install Dependencies / تثبيت المكتبات البرمجية
```bash
npm install
```

### 2. Launch Development Mode / بدء التشغيل للتطوير
This runs TypeScript compilation on-the-fly and initializes Vite preview:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on your local browser.

### 3. Build & Compile for Production / البناء والإنتاج
To bundle client-side React code and compile backend `server.ts` to `dist/server.cjs`:
```bash
npm run build
```

### 4. Start Production Server / بدء تشغيل الخادم والإنتاج
```bash
npm start
```

---

## 📂 Codebase Directory Overview / نظرة على ملفات المشروع الرئيسية

- `/src/App.tsx` - Root coordinator for layout, routing and state.
- `/src/types.ts` - Central interface declarations for Products, Carts, Devices and Transactions.
- `/src/components/SetupMode.tsx` - Gateway interface for setting up Room Sync IDs and picking standard roles (iPad vs Scanner).
- `/src/components/RegisterMode.tsx` - Detailed view of main dashboard with inventory tables, sales histories and checkout drawers.
- `/src/components/ScannerMode.tsx` - Elegant clean viewport rendering camera streams, barcodes feedback and simulated mock panels.
- `/server.ts` - Fast Express pipeline managing persistence databases in `/data` and managing active SSE queues.

---

## 🌐 Exporting to GitHub / التصدير إلى قيت هب

To push this pristine, complete cashier to your own GitHub workspace:
1. Open the **AI Studio Settings** menu on the top right.
2. Select **Export to GitHub** (or download as ZIP).
3. Connect your repository and push directly!

---
*Nawaf System Pro is crafted to be highly efficient, offline-resilient, and beautifully designed for active tablet-cashier operations.*
