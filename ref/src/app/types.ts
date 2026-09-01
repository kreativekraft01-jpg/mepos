export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  timestamp: number;
  paymentMethod: string;
}

export interface TransactionItem {
  id: string;
  boxName: string;
  stockLevel: number;
  category: string;
  boxId: string;
  type: 'sell' | 'buy' | 'exchange';
  price: number;
  qty: number;
  requiresSerial: boolean;
  serialNumber?: string;
}
