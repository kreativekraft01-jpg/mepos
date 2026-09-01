import type { Product, Customer, Sale, Category, CartItem, Till } from '@/types'
import type { CustomerResult, BoxResult, OrderResult } from '../components/SearchResults'
import type { Transaction, TransactionItem, OrderType } from '../types'

/** Convert a MEPoS UI transaction item into a store cart row. */
export function transactionItemToCartItem(t: TransactionItem): Omit<CartItem, 'id'> {
  return {
    productId: t.id,
    name: t.boxName,
    boxId: t.boxId,
    category: t.category,
    stockLevel: t.stockLevel,
    type: t.type,
    price: t.price,
    qty: t.qty,
    requiresSerial: t.requiresSerial,
    serialNumber: t.serialNumber
  }
}

/** Convert a store cart row into a MEPoS UI transaction item. */
export function cartItemToTransactionItem(c: CartItem): TransactionItem {
  return {
    id: c.id,
    boxName: c.name,
    stockLevel: c.stockLevel,
    category: c.category,
    boxId: c.boxId,
    type: c.type,
    price: c.price,
    qty: c.qty,
    requiresSerial: c.requiresSerial,
    serialNumber: c.serialNumber
  }
}

/** Map a store customer to the MEPoS UI customer shape. */
export function toCustomerResult(c: Customer): CustomerResult {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    loyaltyPoints: Math.round(Math.max(0, c.balance))
  }
}

/** Build a displayable MEPoS box from a store product. */
export function productToBox(p: Product, categories: Category[]): BoxResult {
  const cat = categories.find((c) => c.id === p.categoryId)
  const requiresSerial = p.requiresSerial ?? false
  return {
    id: p.id,
    name: p.name,
    category: cat?.name ?? 'General',
    boxId: p.sku,
    stockLevel: p.stock,
    sellPrice: p.price,
    buyPrice: p.buyPrice ?? Math.round(p.cost * 0.9 * 100) / 100,
    exchangePrice: p.exchangePrice ?? Math.round(p.price * 0.85 * 100) / 100,
    requiresSerial,
    status: p.stock > 0 ? 'active' : 'discontinued'
  }
}

/** Build a cart-ready transaction item from a store product. */
export function productToTransactionItem(p: Product, categories: Category[], type: TransactionItem['type']): TransactionItem {
  const cat = categories.find((c) => c.id === p.categoryId)
  const box = productToBox(p, categories)
  const price =
    type === 'buy' ? box.buyPrice : type === 'exchange' ? box.exchangePrice : box.sellPrice
  return {
    id: p.id,
    boxName: p.name,
    stockLevel: p.stock,
    category: cat?.name ?? 'General',
    boxId: p.sku,
    type,
    price,
    qty: 1,
    requiresSerial: box.requiresSerial
  }
}

/** Map a store sale to the MEPoS search "order" shape. */
export function saleToOrderResult(s: Sale, customers: Customer[]): OrderResult {
  const customer = customers.find((c) => c.id === s.customerId)
  return {
    id: s.id,
    orderNumber: s.receiptNo,
    customer: customer?.name ?? 'Walk-in Customer',
    date: new Date(s.createdAt).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    total: Math.abs(s.total),
    type: s.kind === 'refund' ? 'sell' : (s.kind as 'sell' | 'buy' | 'exchange')
  }
}

const formatDateTime = (ts: number) =>
  new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const tillLabel = (till?: Till) => till?.name ?? 'Float'
const staffLabel = (till?: Till) => till?.openedBy ?? 'Staff'

/** Map a completed store sale to the Recent Transactions row shape. */
export function saleToTransaction(s: Sale, customerName: string, till?: Till): Transaction {
  return {
    orderNumber: s.receiptNo,
    dateTime: formatDateTime(s.createdAt),
    staff: staffLabel(till),
    float: tillLabel(till),
    orderType: (s.kind === 'refund' ? 'sell' : s.kind) as OrderType,
    qty: s.items.reduce((n, i) => n + i.qty, 0),
    total: Math.abs(s.total),
    customer: customerName,
    items: s.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price }))
  }
}

/** Map the current in-progress cart to an unprocessed Recent Transactions row. */
export function cartToTransaction(
  items: CartItem[],
  opts: { customerName?: string; till?: Till; orderNumber?: string; createdAt?: number } = {}
): Transaction {
  const types = new Set(items.map((i) => i.type))
  const orderType: OrderType = types.size > 1 ? 'mixed' : (items[0]?.type ?? 'sell')
  const net = items.reduce((sum, i) => sum + (i.type === 'buy' ? -1 : 1) * i.price * i.qty, 0)
  return {
    orderNumber: opts.orderNumber ?? 'DRAFT',
    dateTime: formatDateTime(opts.createdAt ?? Date.now()),
    staff: staffLabel(opts.till),
    float: tillLabel(opts.till),
    orderType,
    qty: items.reduce((n, i) => n + i.qty, 0),
    total: Math.abs(net),
    customer: opts.customerName ?? 'Walk-in Customer',
    items: items.map((i) => ({ name: i.name, qty: i.qty, price: i.price }))
  }
}
