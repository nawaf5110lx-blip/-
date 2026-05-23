import express from "express";
import path from "path";
import fs from "fs/promises";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Directories for persistence
const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const CONFIG_FILE = path.join(DATA_DIR, "sales.json");

// Ensure data directory exists
async function ensureDbFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Check if products file exists, if not write initial products list
    try {
      await fs.access(PRODUCTS_FILE);
    } catch {
      const initialProducts = [
        {
          id: "prod-1",
          name: "قهوة إسبريسو كولومبي",
          barcode: "1001",
          price: 18.00,
          costPrice: 6.00,
          category: "مشروبات ساخنة",
          imageUrl: "https://images.unsplash.com/photo-1510970127400-116bca208a9d?w=300",
          stock: 120,
          description: "حبوب كولومبية فاخرة محمصة بعناية",
          createdAt: new Date().toISOString()
        },
        {
          id: "prod-2",
          name: "مياه غازية منعشة",
          barcode: "2002",
          price: 7.50,
          costPrice: 2.50,
          category: "مشروبات باردة",
          imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300",
          stock: 250,
          description: "مياه غازية باردة بنكهة الليمون الطبيعي",
          createdAt: new Date().toISOString()
        },
        {
          id: "prod-3",
          name: "كرواسون شوكولاتة فرنسية",
          barcode: "3003",
          price: 14.00,
          costPrice: 4.50,
          category: "مخبوزات",
          imageUrl: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=300",
          stock: 45,
          description: "مخبوز بمكونات فرنسية من السمن العضوي والشوكولاتة الفاخرة",
          createdAt: new Date().toISOString()
        },
        {
          id: "prod-4",
          name: "قلم حبر أزرق بريميوم",
          barcode: "4004",
          price: 5.00,
          costPrice: 1.25,
          category: "قرطاسية",
          imageUrl: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=300",
          stock: 400,
          description: "قلم حبر جاف بمسكة مريحة وسلسة في الكتابة",
          createdAt: new Date().toISOString()
        },
        {
          id: "prod-5",
          name: "شاحن سريع آيفون 20 واط",
          barcode: "5005",
          price: 69.00,
          costPrice: 22.00,
          category: "إلكترونيات",
          imageUrl: "https://images.unsplash.com/photo-1619134778706-7015533a6150?w=300",
          stock: 35,
          description: "رأس شاحن يدعم الشحن السريع وحاصل على اعتماد آبل",
          createdAt: new Date().toISOString()
        },
        {
          id: "prod-6",
          name: "شيبس بطاطس بالملح والخل",
          barcode: "6006",
          price: 4.50,
          costPrice: 1.50,
          category: "سناكس ومسليات",
          imageUrl: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300",
          stock: 180,
          description: "شيبس بطاطس طبيعي ومقرمش بنكهة الملح والخل المستورد",
          createdAt: new Date().toISOString()
        }
      ];
      await fs.writeFile(PRODUCTS_FILE, JSON.stringify(initialProducts, null, 2), "utf-8");
    }

    // Check if sales file exists
    try {
      await fs.access(CONFIG_FILE);
    } catch {
      await fs.writeFile(CONFIG_FILE, JSON.stringify([], null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Error setting up server base folders/files:", err);
  }
}

// Global active server state
let activeRooms: Record<string, {
  scannedQueue: { barcode: string; timestamp: string; id: string }[];
  devices: { id: string; name: string; role: 'register' | 'scanner'; connectedAt: string }[];
  sseClients: { id: string; res: any }[];
}> = {};

// Load helper functions
async function readProducts() {
  try {
    const data = await fs.readFile(PRODUCTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeProducts(products: any) {
  await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
}

async function readSales() {
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeSales(sales: any) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(sales, null, 2), "utf-8");
}

// Synchronization SSE Stream Handler
// Clients connect to this streaming endpoint to receive barcodes scanned from other devices instantly
app.get("/api/sync/connect", (req, res) => {
  const { room, deviceId, deviceName, deviceRole } = req.query;
  
  if (!room || typeof room !== "string") {
    return res.status(400).send("يجب تحديد كود الغرفة (?room=...)");
  }

  const cleanRoom = room.toUpperCase().trim();
  const cleanId = (deviceId || `dev-${Date.now()}`) as string;
  const cleanName = (deviceName || "جهاز غير معروف") as string;
  const cleanRole = (deviceRole || "register") as 'register' | 'scanner';

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Create room if it doesn't exist
  if (!activeRooms[cleanRoom]) {
    activeRooms[cleanRoom] = {
      scannedQueue: [],
      devices: [],
      sseClients: []
    };
  }

  const roomObj = activeRooms[cleanRoom];
  
  // Register client
  const clientObj = { id: cleanId, res };
  roomObj.sseClients.push(clientObj);

  // Register device if not already there
  const existingDeviceIdx = roomObj.devices.findIndex(d => d.id === cleanId);
  const deviceMeta = {
    id: cleanId,
    name: cleanName,
    role: cleanRole,
    connectedAt: new Date().toISOString()
  };

  if (existingDeviceIdx !== -1) {
    roomObj.devices[existingDeviceIdx] = deviceMeta;
  } else {
    roomObj.devices.push(deviceMeta);
  }

  console.log(`Device connected to room ${cleanRoom}: ${cleanName} (Role: ${cleanRole})`);

  // Send initial connected meta
  res.write(`data: ${JSON.stringify({ type: "init", payload: { room: cleanRoom, devices: roomObj.devices, currentId: cleanId } })}\n\n`);

  // Broadcast device joined to everyone in the room
  roomObj.sseClients.forEach(client => {
    if (client.id !== cleanId) {
      client.res.write(`data: ${JSON.stringify({ type: "device_joined", payload: deviceMeta })}\n\n`);
    }
  });

  // Keep-alive heartbeat interval to prevent timeouts
  const heartbeatTimer = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
  }, 30000);

  // Remove on disconnect
  req.on("close", () => {
    clearInterval(heartbeatTimer);
    roomObj.sseClients = roomObj.sseClients.filter(c => c.id !== cleanId);
    roomObj.devices = roomObj.devices.filter(d => d.id !== cleanId);

    console.log(`Device disconnected from ${cleanRoom}: ${cleanName}`);

    // Notify others
    roomObj.sseClients.forEach(client => {
      client.res.write(`data: ${JSON.stringify({ type: "device_left", payload: { id: cleanId, name: cleanName } })}\n\n`);
    });

    // Cleanup room if empty
    if (roomObj.sseClients.length === 0) {
      delete activeRooms[cleanRoom];
    }
  });
});

// Post a Barcode scan via mobile phone
app.post("/api/sync/scan", async (req, res) => {
  const { room, barcode, deviceName } = req.body;

  if (!room || !barcode) {
    return res.status(400).json({ error: "الرجاء توفير كود الغرفة والباركود." });
  }

  const cleanRoom = room.toUpperCase().trim();
  const cleanBarcode = barcode.trim();
  const scannerName = deviceName || "جوال ماسح";

  const roomObj = activeRooms[cleanRoom];
  if (!roomObj) {
    return res.status(404).json({ error: "الغرفة غير نشطة حالياً. يرجى فتح واجهة الآيباد أولاً." });
  }

  // Find if product exists to fetch details
  const products = await readProducts();
  const product = products.find((p: any) => p.barcode === cleanBarcode);

  const scanEventPayload = {
    id: `scan-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    barcode: cleanBarcode,
    scannerName,
    product: product || null,
    timestamp: new Date().toISOString()
  };

  roomObj.scannedQueue.push({
    id: scanEventPayload.id,
    barcode: cleanBarcode,
    timestamp: scanEventPayload.timestamp
  });

  // Keep queue size readable
  if (roomObj.scannedQueue.length > 50) {
    roomObj.scannedQueue.shift();
  }

  // Real-time broadcast: Send barcode scanned event immediately over SSE stream to everyone in room!
  let sentCount = 0;
  roomObj.sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify({ type: "scan", payload: scanEventPayload })}\n\n`);
    sentCount++;
  });

  console.log(`Barcode [${cleanBarcode}] broad-casted in room [${cleanRoom}] to ${sentCount} clients.`);

  res.json({ success: true, payload: scanEventPayload, broadcastedTo: sentCount });
});

// Retrieve room details/devices
app.get("/api/sync/room/:roomCode", (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase().trim();
  const room = activeRooms[roomCode];
  if (!room) {
    return res.json({ active: false, devices: [], scannedQueue: [] });
  }
  res.json({
    active: true,
    devices: room.devices,
    scannedQueue: room.scannedQueue
  });
});

// Trigger a manual test scan from the server to test connection immediately
app.post("/api/sync/test-scan", async (req, res) => {
  const { room, barcode } = req.body;
  if (!room) {
    return res.status(400).json({ error: "كود الغرفة مطلوب." });
  }

  const cleanRoom = room.toUpperCase().trim();
  // If barcode not provided, randomly pick from standard barcodes in db
  let finalBarcode = barcode;
  const products = await readProducts();

  if (!finalBarcode && products.length > 0) {
    const rIdx = Math.floor(Math.random() * products.length);
    finalBarcode = products[rIdx].barcode;
  } else if (!finalBarcode) {
    finalBarcode = "1001";
  }

  const product = products.find((p: any) => p.barcode === finalBarcode);
  const roomObj = activeRooms[cleanRoom];
  if (!roomObj) {
    return res.status(404).json({ error: "الغرفة غير موجودة أو غير مسجلة حالياً." });
  }

  const payload = {
    id: `scan-test-${Date.now()}`,
    barcode: finalBarcode,
    scannerName: "مساعد النظام التجريبي 🤖",
    product: product || { barcode: finalBarcode, name: "منتج مجهول", price: 0, imageUrl: "" },
    timestamp: new Date().toISOString()
  };

  roomObj.sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify({ type: "scan", payload })}\n\n`);
  });

  res.json({ success: true, message: `Scanned ${finalBarcode}`, payload });
});

// Products REST API endpoints
app.get("/api/products", async (req, res) => {
  const products = await readProducts();
  res.json(products);
});

// Register unique upload image route or save base64 directly
app.post("/api/products", async (req, res) => {
  const { name, barcode, price, costPrice, category, imageUrl, stock, description } = req.body;

  if (!name || !barcode || price === undefined) {
    return res.status(400).json({ error: "الرجاء توفير الاسم والباركود والسعر للمنتج." });
  }

  const products = await readProducts();
  
  // Check for duplicate barcode
  const exists = products.find((p: any) => p.barcode === barcode.trim());
  if (exists) {
    return res.status(400).json({ error: "عذراً، هذا الباركود مسجل مسبقاً لمنتج آخر." });
  }

  const newProduct = {
    id: `prod-${Date.now()}`,
    name: name.trim(),
    barcode: barcode.trim(),
    price: Number(price),
    costPrice: costPrice !== undefined ? Number(costPrice) : Math.round(Number(price) * 0.4),
    category: category || "عام",
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150",
    stock: stock !== undefined ? Number(stock) : 100,
    description: description || "",
    createdAt: new Date().toISOString()
  };

  products.push(newProduct);
  await writeProducts(products);

  res.status(201).json(newProduct);
});

// Delete Product
app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  let products = await readProducts();
  
  const originalLength = products.length;
  products = products.filter((p: any) => p.id !== id);
  
  if (products.length === originalLength) {
    return res.status(404).json({ error: "المنتج غير موجود." });
  }

  await writeProducts(products);
  res.json({ success: true, message: "تم حذف المنتج بنجاح." });
});

// Update Product
app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { name, barcode, price, costPrice, category, imageUrl, stock, description } = req.body;
  
  const products = await readProducts();
  const idx = products.findIndex((p: any) => p.id === id);
  
  if (idx === -1) {
    return res.status(404).json({ error: "المنتج غير موجود" });
  }

  const product = products[idx];
  product.name = name !== undefined ? name.trim() : product.name;
  product.barcode = barcode !== undefined ? barcode.trim() : product.barcode;
  product.price = price !== undefined ? Number(price) : product.price;
  product.costPrice = costPrice !== undefined ? Number(costPrice) : product.costPrice;
  product.category = category !== undefined ? category : product.category;
  product.imageUrl = imageUrl !== undefined ? imageUrl : product.imageUrl;
  product.stock = stock !== undefined ? Number(stock) : product.stock;
  product.description = description !== undefined ? description : product.description;

  await writeProducts(products);
  res.json(product);
});

// Record Sales Transaction
app.post("/api/sales", async (req, res) => {
  const transaction = req.body;
  
  if (!transaction.items || !Array.isArray(transaction.items)) {
    return res.status(400).json({ error: "بيانات سلة المشتريات خاطئة." });
  }

  const sales = await readSales();
  const products = await readProducts();

  const newSale = {
    id: `sale-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    items: transaction.items,
    subtotal: Number(transaction.subtotal) || 0,
    tax: Number(transaction.tax) || 0,
    discount: Number(transaction.discount) || 0,
    total: Number(transaction.total) || 0,
    cashPaid: Number(transaction.cashPaid) || 0,
    changeDue: Number(transaction.changeDue) || 0,
    paymentMethod: transaction.paymentMethod || "cash",
    timestamp: new Date().toISOString(),
    roomCode: (transaction.roomCode || "MAIN").toUpperCase()
  };

  sales.push(newSale);
  await writeSales(sales);

  // Deduct stock for products
  try {
    let stockChanged = false;
    for (const item of transaction.items) {
      const dbProd = products.find((p: any) => p.id === item.productId);
      if (dbProd) {
        dbProd.stock = Math.max(0, dbProd.stock - item.quantity);
        stockChanged = true;
      }
    }
    if (stockChanged) {
      await writeProducts(products);
    }
  } catch (err) {
    console.error("Failed to deduct product stock levels:", err);
  }

  res.json({ success: true, sale: newSale });
});

// Retrieve Sales History list
app.get("/api/sales", async (req, res) => {
  const sales = await readSales();
  res.json(sales);
});


// Initialization function
async function main() {
  await ensureDbFiles();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nawaf System running on http://localhost:${PORT}`);
  });
}

main();
