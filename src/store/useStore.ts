import { transactionFigures, todaysTransactions } from '../utils/figures'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Category, Product, Customer, Sale, Settings, Toast, CartItem, SavedCart, PaymentSplit, KnowledgeDoc, AiSkill, BankingContext, Till, GiftVoucher } from '../types'
import { uid, tillExpectedCash, formatMoney } from '../utils/format'
import { seedCategories, seedProducts, seedCustomers, buildSeedSales, seedKnowledge, seedSkills, seedTills } from './seed'
import { DEFAULT_BROWSER_MODEL, normalizeModelId } from '../utils/browserLlm'

export const STORE_VERSION = 16

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'ReCell Electronics',
  tagline: 'Buy · Sell · Exchange refurbished tech',
  currency: '$',
  taxRate: 8,
  receiptFooter: 'Thank you for shopping refurbished with us!',
  aiEnabled: true,
  browserModel: DEFAULT_BROWSER_MODEL,
  kbEnabled: true,
  skillsEnabled: true
}

interface POSState {
  ready: boolean
  categories: Category[]
  products: Product[]
  customers: Customer[]
  sales: Sale[]
  vouchers: GiftVoucher[]
  knowledge: KnowledgeDoc[]
  skills: AiSkill[]
  bankingContext: BankingContext | null
  tills: Till[]
  activeTillId: string | undefined
  cart: CartItem[]
  savedCarts: SavedCart[]
  discount: number
  customerId?: string
  toasts: Toast[]
  settings: Settings
  hydrated: () => void
  openTill: (id: string, openedBy: string, openingFloat: number) => void
  closeTill: (id: string, input: { countedCash: number; closedBy: string; managerTag?: string; shortageReason?: string }) => { ok: boolean; error?: string; variance?: number }
  addTill: (name: string) => void
  deleteTill: (id: string) => void
  setActiveTill: (id?: string) => void
  addProduct: (p: Omit<Product, 'id' | 'createdAt'>) => void
  updateProduct: (id: string, patch: Partial<Product>) => void
  deleteProduct: (id: string) => void
  addCategory: (name: string, color: string) => void
  updateCategory: (id: string, patch: Partial<Category>) => void
  deleteCategory: (id: string) => void
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => void
  updateCustomer: (id: string, patch: Partial<Customer>) => void
  deleteCustomer: (id: string) => void
  addKnowledgeDoc: (title: string, content: string) => void
  updateKnowledgeDoc: (id: string, patch: Partial<KnowledgeDoc>) => void
  deleteKnowledgeDoc: (id: string) => void
  addSkill: (title: string, content: string) => void
  updateSkill: (id: string, patch: Partial<AiSkill>) => void
  deleteSkill: (id: string) => void
  toggleSkill: (id: string) => void
  setBankingContext: (ctx: BankingContext | null) => void
  addCartItem: (item: Omit<CartItem, 'id'> & { id?: string }) => void
  updateCartItem: (id: string, patch: Partial<CartItem>) => void
  updateCartQty: (id: string, qty: number) => void
  removeFromCart: (id: string) => void
  setSerialNumber: (id: string, serial: string) => void
  clearCart: () => void
  saveCart: (items: CartItem[]) => SavedCart | null
  restoreSavedCart: (id: string) => boolean
  removeSavedCart: (id: string) => void
  setDiscount: (amount: number) => void
  setCustomerId: (id?: string) => void
  checkout: (payments: PaymentSplit[], opts?: { voucherCode?: string }) => { ok: boolean; receiptNo?: string; total?: number; changeDue?: number; error?: string }
  refundSale: (saleId: string, items: CartItem[], payments: PaymentSplit[], managerTag: string) => { ok: boolean; receiptNo?: string; total?: number; error?: string }
  issueGiftVoucher: (amount: number, customerId?: string) => GiftVoucher | undefined
  redeemVoucher: (code: string, amount: number) => { ok: boolean; error?: string }
  pushToast: (type: Toast['type'], message: string) => void
  dismissToast: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetDemoData: () => void
}

function seedAll() {
  const products = seedProducts
  const customers = seedCustomers
  const sales = buildSeedSales(products, customers)
  return { products, customers, sales }
}

function refreshSeed(state: POSState) {
  const s = seedAll()
  state.products = s.products
  state.customers = s.customers
  state.sales = s.sales
}

/** Today's sales-floor figures for the MEPoS home page. */
export function selectTodaysFigures(sales: Sale[]) {
  return transactionFigures(todaysTransactions(sales))
}

export const useStore = create<POSState>()(
  persist(
    (set, get) => ({
      ready: false,
      categories: seedCategories,
      products: seedProducts,
      customers: seedCustomers,
      sales: buildSeedSales(seedProducts, seedCustomers),
      vouchers: [],
      knowledge: seedKnowledge,
      skills: seedSkills,
      bankingContext: null,
      tills: seedTills,
      activeTillId: undefined,
      cart: [],
      savedCarts: [],
      discount: 0,
      customerId: undefined,
      toasts: [],
      settings: { ...DEFAULT_SETTINGS },

      hydrated: () => set({ ready: true }),

      openTill: (id, openedBy, openingFloat) =>
        set((st) => ({
          tills: st.tills.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'open',
                  openedAt: Date.now(),
                  openedBy,
                  openingFloat,
                  closedAt: undefined,
                  closedBy: undefined,
                  expectedCash: undefined,
                  countedCash: undefined,
                  variance: undefined,
                  shortageReason: undefined,
                  managerTag: undefined
                }
              : t
          ),
          activeTillId: id
        })),

      closeTill: (id, input) => {
        const st = get()
        const till = st.tills.find((t) => t.id === id)
        if (!till || till.status !== 'open') {
          return { ok: false, error: 'Banking is not open on this till' }
        }
        const expectedCash = tillExpectedCash(till, st.sales)
        const variance = Math.round((input.countedCash - expectedCash) * 100) / 100

        if (variance !== 0) {
          const hasOverride = !!input.managerTag?.trim() && !!input.shortageReason?.trim()
          if (!hasOverride) {
            return {
              ok: false,
              error: `Cash doesn't tally (${variance > 0 ? 'over' : 'short'} ${Math.abs(variance).toFixed(2)}). Manager tag + reason required.`,
              variance
            }
          }
        }

        set((state) => ({
          tills: state.tills.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'closed',
                  closedAt: Date.now(),
                  closedBy: input.closedBy,
                  expectedCash,
                  countedCash: input.countedCash,
                  variance,
                  shortageReason: variance !== 0 ? input.shortageReason?.trim() : undefined,
                  managerTag: variance !== 0 ? input.managerTag?.trim() : undefined
                }
              : t
          ),
          activeTillId: state.activeTillId === id ? undefined : state.activeTillId
        }))

        return { ok: true, variance }
      },

      addTill: (name) =>
        set((st) => ({
          tills: [...st.tills, { id: uid(), name, status: 'closed', openingFloat: 0 }]
        })),

      deleteTill: (id) =>
        set((st) => ({
          tills: st.tills.filter((t) => t.id !== id),
          activeTillId: st.activeTillId === id ? undefined : st.activeTillId
        })),

      setActiveTill: (id) => set({ activeTillId: id }),

      addProduct: (p) =>
        set((st) => ({
          products: [
            {
              ...p,
              id: uid(),
              createdAt: Date.now(),
              buyPrice: p.buyPrice ?? Math.round((p.cost ?? 0) * 0.9 * 100) / 100,
              exchangePrice: p.exchangePrice ?? Math.round(p.price * 0.85 * 100) / 100,
              requiresSerial: p.requiresSerial ?? false
            },
            ...st.products
          ]
        })),

      updateProduct: (id, patch) =>
        set((st) => ({
          products: st.products.map((p) => (p.id === id ? { ...p, ...patch } : p))
        })),

      deleteProduct: (id) =>
        set((st) => ({ products: st.products.filter((p) => p.id !== id) })),

      addCategory: (name, color) =>
        set((st) => ({
          categories: [...st.categories, { id: uid(), name, color }]
        })),

      updateCategory: (id, patch) =>
        set((st) => ({
          categories: st.categories.map((c) => (c.id === id ? { ...c, ...patch } : c))
        })),

      deleteCategory: (id) =>
        set((st) => ({
          categories: st.categories.filter((c) => c.id !== id),
          products: st.products.map((p) =>
            p.categoryId === id ? { ...p, categoryId: '' } : p
          )
        })),

      addCustomer: (c) =>
        set((st) => ({ customers: [...st.customers, { ...c, id: uid(), createdAt: Date.now() }] })),

      updateCustomer: (id, patch) =>
        set((st) => ({ customers: st.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      deleteCustomer: (id) =>
        set((st) => ({ customers: st.customers.filter((c) => c.id !== id) })),

      addKnowledgeDoc: (title, content) =>
        set((st) => ({
          knowledge: [{ id: uid(), title, content, updatedAt: Date.now() }, ...st.knowledge]
        })),

      updateKnowledgeDoc: (id, patch) =>
        set((st) => ({
          knowledge: st.knowledge.map((d) =>
            d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d
          )
        })),

      deleteKnowledgeDoc: (id) =>
        set((st) => ({ knowledge: st.knowledge.filter((d) => d.id !== id) })),

      addSkill: (title, content) =>
        set((st) => ({
          skills: [{ id: uid(), title, enabled: true, content, updatedAt: Date.now() }, ...st.skills]
        })),

      updateSkill: (id, patch) =>
        set((st) => ({
          skills: st.skills.map((s) =>
            s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s
          )
        })),

      deleteSkill: (id) =>
        set((st) => ({ skills: st.skills.filter((s) => s.id !== id) })),

      toggleSkill: (id) =>
        set((st) => ({
          skills: st.skills.map((s) =>
            s.id === id ? { ...s, enabled: !s.enabled, updatedAt: Date.now() } : s
          )
        })),

      setBankingContext: (ctx) => set({ bankingContext: ctx }),

      addCartItem: (item) =>
        set((st) => {
          const existing = st.cart.find(
            (c) => c.productId === item.productId && c.type === item.type && c.price === item.price
          )
          if (existing) {
            return {
              cart: st.cart.map((c) =>
                c.id === existing.id ? { ...c, qty: Math.min(c.qty + 1, c.stockLevel) } : c
              )
            }
          }
          return { cart: [...st.cart, { ...item, id: item.id ?? uid() }] }
        }),

      updateCartItem: (id, patch) =>
        set((st) => ({
          cart: st.cart.map((c) => (c.id === id ? { ...c, ...patch } : c))
        })),

      updateCartQty: (id, qty) =>
        set((st) => {
          const row = st.cart.find((c) => c.id === id)
          if (!row) return {}
          if (qty <= 0) return { cart: st.cart.filter((c) => c.id !== id) }
          return {
            cart: st.cart.map((c) =>
              c.id === id ? { ...c, qty: Math.min(qty, Math.max(1, c.stockLevel)) } : c
            )
          }
        }),

      removeFromCart: (id) =>
        set((st) => ({ cart: st.cart.filter((c) => c.id !== id) })),

      setSerialNumber: (id, serial) =>
        set((st) => ({
          cart: st.cart.map((c) => (c.id === id ? { ...c, serialNumber: serial } : c))
        })),

      clearCart: () => set({ cart: [], discount: 0, customerId: undefined }),

      saveCart: (items) => {
        const st = get()
        const snapshot = items.length > 0 ? items : st.cart
        if (snapshot.length === 0) return null
        const entry: SavedCart = {
          id: uid(),
          items: snapshot.map((i) => ({ ...i })),
          customerId: st.customerId,
          discount: st.discount,
          createdAt: Date.now()
        }
        set({
          savedCarts: [...st.savedCarts, entry],
          cart: [],
          discount: 0,
          customerId: undefined
        })
        return entry
      },

      restoreSavedCart: (id) => {
        const st = get()
        const saved = st.savedCarts.find((sc) => sc.id === id)
        if (!saved) return false
        set({
          cart: saved.items.map((i) => ({ ...i })),
          discount: saved.discount,
          customerId: saved.customerId,
          savedCarts: st.savedCarts.filter((sc) => sc.id !== id)
        })
        return true
      },

      removeSavedCart: (id) =>
        set((st) => ({ savedCarts: st.savedCarts.filter((sc) => sc.id !== id) })),

      setDiscount: (amount) => set({ discount: Math.max(0, amount) }),
      setCustomerId: (id) => set({ customerId: id }),

      checkout: (payments, opts) => {
        const st = get()
        if (st.cart.length === 0) {
          get().pushToast('error', 'Cart is empty')
          return { ok: false }
        }

        const activeTill = st.tills.find((t) => t.id === st.activeTillId && t.status === 'open')
        if (!activeTill) {
          get().pushToast('error', 'Open banking on a till before checkout')
          return { ok: false }
        }

        for (const row of st.cart) {
          if (row.requiresSerial && !row.serialNumber) {
            get().pushToast('error', `Serial number required for ${row.name}`)
            return { ok: false, error: `Serial number required for ${row.name}` }
          }
        }

        const subtotal = st.cart.reduce((s, c) => s + c.price * c.qty, 0)
        const netTotal =
          Math.round(
            st.cart.reduce((s, c) => s + (c.type === 'buy' ? -1 : 1) * c.price * c.qty, 0) * 100
          ) / 100

        const allBuy = st.cart.every((c) => c.type === 'buy')
        const anyBuy = st.cart.some((c) => c.type === 'buy')
        const kind = allBuy ? 'buy' : anyBuy ? 'exchange' : 'sale'

        const owed = Math.max(0, netTotal)
        const payoutDue = Math.max(0, -netTotal)
        const legs = payments.filter((p) => p.amount > 0)

        let voucherId: string | undefined
        if (owed > 0.005) {
          if (legs.length === 0) {
            get().pushToast('error', 'Choose a payment method')
            return { ok: false, error: 'Choose a payment method' }
          }
          const paid = Math.round(legs.reduce((s, p) => s + p.amount, 0) * 100) / 100
          if (paid < owed - 0.001) {
            get().pushToast('error', `Payment split ${formatMoney(paid, st.settings.currency)} doesn't cover total ${formatMoney(owed, st.settings.currency)}`)
            return { ok: false, error: 'Payment split does not match total' }
          }

          const voucherLeg = legs.find((p) => p.method === 'voucher')
          if (voucherLeg) {
            const v = st.vouchers.find((x) => x.code === opts?.voucherCode)
            if (!v || v.balance < voucherLeg.amount - 0.001) {
              get().pushToast('error', 'Voucher not found or insufficient balance')
              return { ok: false, error: 'Voucher not found or insufficient balance' }
            }
            voucherId = v.id
          }
        } else if (payoutDue > 0.005) {
          // We owe the customer — payout
          if (legs.length === 0) {
            get().pushToast('error', 'Choose a payout method')
            return { ok: false, error: 'Choose a payout method' }
          }
          const paid = Math.round(legs.reduce((s, p) => s + p.amount, 0) * 100) / 100
          if (paid < payoutDue - 0.001) {
            get().pushToast('error', `Payout ${formatMoney(paid, st.settings.currency)} doesn't cover amount owed ${formatMoney(payoutDue, st.settings.currency)}`)
            return { ok: false, error: 'Payout does not match amount owed' }
          }
          const voucherLeg = legs.find((p) => p.method === 'voucher')
          if (voucherLeg) {
            const v = st.vouchers.find((x) => x.code === opts?.voucherCode)
            if (!v || v.balance < voucherLeg.amount - 0.001) {
              get().pushToast('error', 'Voucher not found or insufficient balance')
              return { ok: false, error: 'Voucher not found or insufficient balance' }
            }
            voucherId = v.id
          }
        }

        const method = legs.length > 0 ? legs[0].method : netTotal < -0.005 ? 'cash' : 'card'
        const cashTotal = legs.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
        const cashReceived = !payoutDue && cashTotal > 0 ? Math.ceil(cashTotal) : undefined
        const paid = Math.round(legs.reduce((s, p) => s + p.amount, 0) * 100) / 100
        const changeDue =
          !payoutDue && cashReceived != null && paid > owed
            ? Math.round((cashReceived - owed) * 100) / 100
            : undefined

        const receiptCount = st.sales.length + 1
        const sale: Sale = {
          id: uid(),
          receiptNo: String(1000 + receiptCount),
          items: st.cart.map((c) => ({
            productId: c.productId,
            name: c.name,
            price: c.price,
            qty: c.qty
          })),
          subtotal,
          discount: 0,
          taxRate: st.settings.taxRate,
          taxAmount: 0,
          total: netTotal,
          kind,
          paymentMethod: method,
          payments: legs.length > 1 ? legs : undefined,
          serials: st.cart
            .filter((c) => c.serialNumber)
            .map((c) => ({ productId: c.productId, serial: c.serialNumber! })),
          customerId: st.customerId,
          tillId: activeTill.id,
          cashReceived,
          changeDue,
          createdAt: Date.now()
        }

        const stockDelta = new Map<string, number>()
        for (const row of st.cart) {
          stockDelta.set(row.productId, (stockDelta.get(row.productId) ?? 0) + (row.type === 'buy' ? row.qty : -row.qty))
        }
        const products = st.products.map((p) =>
          stockDelta.has(p.id) ? { ...p, stock: Math.max(0, p.stock + stockDelta.get(p.id)!) } : p
        )

        const vouchers = voucherId
          ? st.vouchers.map((v) =>
              v.id === voucherId
                ? { ...v, balance: Math.round((v.balance - (legs.find((p) => p.method === 'voucher')?.amount ?? 0)) * 100) / 100 }
                : v
            )
          : st.vouchers

        set({
          products,
          sales: [...st.sales, sale],
          vouchers,
          cart: [],
          discount: 0,
          customerId: undefined
        })

        return { ok: true, receiptNo: sale.receiptNo, total: netTotal, changeDue }
      },

      refundSale: (saleId, items, payments, managerTag) => {
        const st = get()
        if (!managerTag.trim()) {
          return { ok: false, error: 'Manager tag required to refund' }
        }
        const original = st.sales.find((s) => s.id === saleId)
        if (!original) {
          return { ok: false, error: 'Order not found' }
        }
        if (original.refundedAt) {
          return { ok: false, error: 'This order has already been refunded' }
        }
        if (items.length === 0) {
          return { ok: false, error: 'Select at least one item to refund' }
        }

        const refundTotal =
          Math.round(items.reduce((s, c) => s + c.price * c.qty, 0) * 100) / 100
        const legs = payments.filter((p) => p.amount > 0)
        const method = legs.length > 0 ? legs[0].method : original.paymentMethod

        const sale: Sale = {
          id: uid(),
          receiptNo: String(1000 + st.sales.length + 1),
          items: items.map((c) => ({ productId: c.productId, name: c.name, price: c.price, qty: c.qty })),
          subtotal: refundTotal,
          discount: 0,
          taxRate: st.settings.taxRate,
          taxAmount: 0,
          total: -refundTotal,
          kind: 'refund',
          paymentMethod: method,
          payments: legs.length > 1 ? legs : undefined,
          customerId: original.customerId,
          tillId: original.tillId,
          originalSaleId: saleId,
          createdAt: Date.now()
        }

        const stockDelta = new Map<string, number>()
        for (const row of items) {
          stockDelta.set(row.productId, (stockDelta.get(row.productId) ?? 0) + (row.type === 'buy' ? -row.qty : row.qty))
        }
        const products = st.products.map((p) =>
          stockDelta.has(p.id) ? { ...p, stock: Math.max(0, p.stock + stockDelta.get(p.id)!) } : p
        )

        set({
          products,
          sales: st.sales.map((s) => (s.id === saleId ? { ...s, refundedAt: Date.now() } : s)).concat(sale)
        })

        return { ok: true, receiptNo: sale.receiptNo, total: refundTotal }
      },

      issueGiftVoucher: (amount, customerId) => {
        const code = `GV-${Math.floor(100000 + Math.random() * 900000)}`
        const voucher: GiftVoucher = {
          id: uid(),
          code,
          amount: Math.round(amount * 100) / 100,
          balance: Math.round(amount * 100) / 100,
          customerId,
          createdAt: Date.now()
        }
        set((st) => ({ vouchers: [...st.vouchers, voucher] }))
        return voucher
      },

      redeemVoucher: (code, amount) => {
        const st = get()
        const v = st.vouchers.find((x) => x.code === code)
        if (!v) return { ok: false, error: 'Voucher not found' }
        if (v.balance < amount - 0.001) return { ok: false, error: 'Insufficient voucher balance' }
        set((state) => ({
          vouchers: state.vouchers.map((x) =>
            x.id === v.id ? { ...x, balance: Math.round((x.balance - amount) * 100) / 100 } : x
          )
        }))
        return { ok: true }
      },

      pushToast: (type, message) =>
        set((st) => ({
          toasts: [...st.toasts.slice(-3), { id: uid(), type, message }]
        })),

      dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

      updateSettings: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),

      resetDemoData: () =>
        set(() => {
          const s = seedAll()
          return {
            categories: seedCategories,
            products: s.products,
            customers: s.customers,
            sales: s.sales,
            vouchers: [],
            knowledge: seedKnowledge,
            skills: seedSkills,
            tills: seedTills,
            activeTillId: undefined,
            cart: [],
            discount: 0,
            customerId: undefined
          }
        })
    }),
    {
      name: 'nova-pos',
      version: STORE_VERSION,
      partialize: (st) => ({
        categories: st.categories,
        products: st.products,
        customers: st.customers,
        sales: st.sales,
        vouchers: st.vouchers,
        knowledge: st.knowledge,
        skills: st.skills,
        tills: st.tills,
        activeTillId: st.activeTillId,
        savedCarts: st.savedCarts,
        settings: st.settings
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hydrated()
        }
      },
      migrate: (persisted: unknown, version) => {
        if ((version as number) < 14) {
          const p = (persisted || {}) as Partial<POSState>
          const old = p.settings as (Settings & { ollamaBaseUrl?: string; ollamaModel?: string }) | undefined
          const { ollamaBaseUrl: _url, ollamaModel: _model, ...rest } = old ?? {}
          const normalized: Settings = { ...DEFAULT_SETTINGS, ...rest }
          normalized.browserModel = normalizeModelId(normalized.browserModel)
          const fresh = seedAll()
          return {
            categories: seedCategories,
            products: fresh.products,
            customers: fresh.customers,
            sales: fresh.sales,
            vouchers: [],
            knowledge: seedKnowledge,
            skills: seedSkills,
            tills: seedTills,
            activeTillId: undefined,
            savedCarts: [],
            settings: normalized
          }
        }
        if ((version as number) < 16) {
          const p = (persisted || {}) as Partial<POSState>
          // Strip removed soundEnabled field — feature deleted
          const s = p.settings as unknown as Record<string, unknown> | undefined
          if (s && 'soundEnabled' in s) delete s.soundEnabled
          return { ...(p as POSState), settings: { ...DEFAULT_SETTINGS, ...(s as unknown as Settings) } } as POSState
        }
        return persisted as POSState
      }
    }
  )
)

export { refreshSeed }
