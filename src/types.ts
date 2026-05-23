export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  costPrice?: number;
  category: string;
  imageUrl: string;
  stock: number;
  description?: string;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SaleTransaction {
  id: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  cashPaid: number;
  changeDue: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  timestamp: string;
  roomCode: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'iPad' | 'Mobile' | 'Generic';
  role: 'register' | 'scanner';
  connectedAt: string;
}

export interface SyncMessage {
  type: 'scan' | 'device_joined' | 'device_left' | 'clear_cart';
  payload: any;
  timestamp: string;
}
