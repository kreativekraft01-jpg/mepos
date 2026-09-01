export interface Category {
  id: string
  name: string
  color: string
}

export interface Product {
  id: string
  sku: string
  name: string
  description: string
  categoryId: string
  grade: string
  price: number
  cost: number
  /** Cash the store pays when buying this device in (defaults to ~cost). */
  buyPrice?: number
  /** Net price used for exchange trade-ins (defaults to ~85% of sell price). */
  exchangePrice?: number
  /** Whether a serial number must be captured before checkout. */
  requiresSerial?: boolean
  stock: number
  lowStockThreshold: number
  image: string
  createdAt: number
}

/** Refurbished condition grades (A = like new … F = for parts). */
export const REFURB_GRADES = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export const GRADE_LABELS: Record<string, string> = {
  A: 'Excellent · like new',
  B: 'Very good · light wear',
  C: 'Good · visible wear, fully tested',
  D: 'Fair · noticeable marks, fully working',
  E: 'Poor · heavy wear, fully working',
  F: 'For parts · not fully tested'
}

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  balance: number
  notes: string
  createdAt: number
}

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'voucher' | 'cheque' | 'gift_card'

/** One payment leg of a (possibly split) sale. */
export interface PaymentSplit {
  method: PaymentMethod
  amount: number
}

/** Sell (customer pays us), buy (we pay the customer), or exchange (net trade). */
export type TxType = 'sell' | 'buy' | 'exchange'

export interface CartItem {
  /** Unique row id — the same product can appear once per type. */
  id: string
  productId: string
  name: string
  boxId: string
  category: string
  stockLevel: number
  type: TxType
  price: number
  qty: number
  requiresSerial: boolean
  serialNumber?: string
}

/** A cart snapshot saved from the cart page — shown as an unprocessed transaction. */
export interface SavedCart {
  id: string
  items: CartItem[]
  customerId?: string
  discount: number
  createdAt: number
}

export interface SaleItem {
  productId: string
  name: string
  price: number
  qty: number
}

export interface Sale {
  id: string
  receiptNo: string
  items: SaleItem[]
  subtotal: number
  discount: number
  taxRate: number
  taxAmount: number
  total: number
  /** Net type of the transaction — positive totals are 'sale', negative are 'buy'. */
  kind: 'sale' | 'buy' | 'exchange' | 'refund'
  paymentMethod: PaymentMethod
  /** Split-payment breakdown when the sale was paid with more than one method. */
  payments?: PaymentSplit[]
  /** Serial numbers captured per product at checkout. */
  serials?: { productId: string; serial: string }[]
  customerId?: string
  tillId?: string
  cashReceived?: number
  changeDue?: number
  /** Set when this sale was refunded (via refund flow). */
  refundedAt?: number
  /** For refund entries — the original sale that was refunded. */
  originalSaleId?: string
  createdAt: number
}

/** A gift voucher issued to a customer, redeemable in part or full at checkout. */
export interface GiftVoucher {
  id: string
  code: string
  amount: number
  balance: number
  customerId?: string
  createdAt: number
}

/** A cash till / register with an open-or-closed banking session for the day. */
export interface Till {
  id: string
  name: string
  status: 'open' | 'closed'
  openedAt?: number
  openedBy?: string
  openingFloat: number
  closedAt?: number
  closedBy?: string
  /** Counter cash expected in the drawer (float + cash sales on this till). */
  expectedCash?: number
  /** Cash counted by staff at close. */
  countedCash?: number
  /** countedCash − expectedCash (negative = short, positive = over). */
  variance?: number
  /** Required reason when variance ≠ 0. */
  shortageReason?: string
  /** Manager override tag required when variance ≠ 0. */
  managerTag?: string
}

export type PaymentOption = { id: PaymentMethod; label: string; icon: string }

export const PAYMENT_METHODS: PaymentOption[] = [
  { id: 'cash', label: 'Cash', icon: '💵' },
  { id: 'card', label: 'Card', icon: '💳' },
  { id: 'upi', label: 'UPI', icon: '📱' },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { id: 'voucher', label: 'Voucher', icon: '🎟️' }
]

export interface Settings {
  storeName: string
  tagline: string
  currency: string
  taxRate: number
  receiptFooter: string
  aiEnabled: boolean
  browserModel: string
  kbEnabled: boolean
  skillsEnabled: boolean
}

export interface KnowledgeDoc {
  id: string
  title: string
  content: string
  updatedAt: number
}

/** Deterministic AI skill — pattern-matched rules that answer specific questions without the LLM. */
export interface AiSkill {
  id: string
  title: string
  enabled: boolean
  /** JSON string — SkillDefinition (patterns, categories, templates, systemPrompt). */
  content: string
  updatedAt: number
}

/** Context passed to the AI assistant when the Close Banking dialog is open. */
export interface BankingContext {
  tillId: string
  tillName: string
  expectedCash: number
  countedCash: number
  variance: number
  openedAt: number
  openingFloat: number
  currency: string
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}
