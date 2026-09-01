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

export type OrderType = 'sell' | 'buy' | 'exchange' | 'mixed';

export interface Transaction {
  orderNumber: string;
  dateTime: string;
  staff: string;
  float: string;
  orderType: OrderType;
  qty: number;
  total: number;
  customer?: string;
  items?: Array<{ name: string; qty: number; price: number }>;
}
