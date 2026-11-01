import { test } from 'node:test'
import assert from 'node:assert/strict'

// ── Browser shims (the store persists to localStorage/sessionStorage) ────────
function installStorage() {
  const memory = new Map<string, string>()
  const storage = {
    get length() {
      return memory.size
    },
    clear: () => memory.clear(),
    getItem: (key: string) => (memory.has(key) ? (memory.get(key) as string) : null),
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
    removeItem: (key: string) => void memory.delete(key),
    setItem: (key: string, value: string) => void memory.set(key, String(value)),
  }
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      Object.defineProperty(globalThis, name, { value: storage, configurable: true })
    } catch {
      ;(globalThis as unknown as Record<string, unknown>)[name] = storage
    }
  }
}
installStorage()

const { useStore, nextReceiptNo, DEFAULT_SETTINGS } = await import('../src/store/useStore')
const { snapshotOf, isValidSnapshot, storePatchFromSnapshot, ServerSync, fingerprint, isPristineStore, needsPushOnStart } = await import('../src/utils/serverSync')
const { parseKnowledgeFile } = await import('../src/utils/knowledgeFile')
const { retrieveKnowledge } = await import('../src/utils/rag')
const { normalizeState, toTableRows } = await import('../server/src/state')
const { seedCategories, seedProducts, seedCustomers, seedKnowledge, seedSkills, seedTills } = await import('../src/store/seed')
import type { Snapshot } from '../src/utils/serverSync'
import type { Sale, KnowledgeDoc } from '../src/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────
function emptySnapshot(): Snapshot {
  return {
    categories: [],
    products: [],
    customers: [],
    sales: [],
    vouchers: [],
    knowledge: [],
    skills: [],
    tills: [],
    activeTillId: undefined,
    savedCarts: [],
    settings: { storeName: 'Test', currency: '$' },
  } as unknown as Snapshot
}

/** The untouched demo store a brand-new browser starts with. */
function pristineSnapshot(): Snapshot {
  return {
    categories: seedCategories,
    products: seedProducts,
    customers: seedCustomers,
    sales: [],
    vouchers: [],
    knowledge: seedKnowledge,
    skills: seedSkills,
    tills: seedTills,
    activeTillId: null,
    savedCarts: [],
    settings: { ...DEFAULT_SETTINGS },
  } as unknown as Snapshot
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

const tick = async (times = 8) => {
  for (let i = 0; i < times; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

interface RequestLog {
  method: string
  headers: Record<string, string>
  body: unknown
}

function harness(options: {
  token?: string | null
  dirty?: boolean
  get?: () => Response | Promise<Response>
  put?: (body: unknown, request: RequestLog) => Response | Promise<Response>
} = {}) {
  const calls: RequestLog[] = []
  const authListeners: ((token: string | null) => void)[] = []
  const storeListeners: (() => void)[] = []
  const errors: (string | null)[] = []
  let token = options.token ?? null
  let dirty = options.dirty ?? false
  let snapshot = emptySnapshot()
  let scheduled: (() => void) | null = null

  const sync = new ServerSync({
    stateUrl: '/api/state',
    fetchImpl: (async (_url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      const request: RequestLog = {
        method,
        headers: (init.headers ?? {}) as Record<string, string>,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      }
      calls.push(request)
      if (method === 'GET') return options.get ? await options.get() : jsonResponse({ data: null })
      return options.put ? await options.put(request.body, request) : jsonResponse({ ok: true })
    }) as typeof fetch,
    getToken: () => token,
    subscribeAuth: (fn) => {
      authListeners.push(fn)
      return () => {}
    },
    getSnapshot: () => snapshot,
    applySnapshot: (next) => {
      snapshot = next
    },
    subscribeStore: (fn) => {
      storeListeners.push(fn)
      return () => {}
    },
    isDirty: () => dirty,
    setDirty: (value) => {
      dirty = value
    },
    debounceMs: 1,
    retryMs: 1,
    schedule: (fn) => {
      scheduled = fn
      return fn
    },
    cancel: () => {
      scheduled = null
    },
    onError: (message) => errors.push(message),
  })

  return {
    sync,
    calls,
    errors,
    mutate(patch: Partial<Snapshot>) {
      snapshot = { ...snapshot, ...patch } as Snapshot
    },
    change() {
      for (const fn of storeListeners) fn()
    },
    login(next: string | null) {
      token = next
      for (const fn of authListeners) fn(next)
    },
    runTimer() {
      const fn = scheduled
      scheduled = null
      fn?.()
    },
    hasTimer: () => !!scheduled,
    putCount: () => calls.filter((c) => c.method === 'PUT').length,
    get snapshot() {
      return snapshot
    },
    get dirty() {
      return dirty
    },
  }
}

// ── 1. Server payload normalisation ──────────────────────────────────────────
test('server normalisation strips unknown fields and dangling references', () => {
  const state = normalizeState({
    categories: [{ id: 'cat-1', name: 'Phones', color: '#000' }],
    products: [
      {
        id: 'p1',
        sku: 'P-1',
        name: 'Phone',
        categoryId: 'deleted-category',
        description: '',
        grade: 'A',
        price: '10.5',
        cost: 6,
        stock: '3',
        lowStockThreshold: '1',
        image: '',
        requiresSerial: false,
        createdAt: '1700000000000',
        hacked: 'yes',
      },
    ],
    customers: [{ id: 'c1', name: 'Asha', phone: '', email: '', balance: 0, notes: '', createdAt: 1 }],
    sales: [
      {
        id: 's1',
        receiptNo: '1001',
        subtotal: 21,
        discount: 0,
        taxRate: 0,
        taxAmount: 0,
        total: 21,
        kind: 'sale',
        paymentMethod: 'cash',
        customerId: 'deleted-customer',
        createdAt: 2,
        items: [{ id: 'item-row', saleId: 's1', productId: 'p1', name: 'Phone', price: 10.5, qty: '2' }],
      },
    ],
    settings: { storeName: 'My store' },
  })

  const product = state.products[0] as Record<string, unknown>
  assert.equal(product.categoryId, null, 'dangling category is cleared')
  assert.equal('hacked' in product, false, 'unknown client field is dropped')
  assert.equal(product.price, 10.5)
  assert.equal(product.stock, 3)
  assert.equal(product.createdAt, 1_700_000_000_000)

  const sale = state.sales[0] as Record<string, unknown>
  assert.equal(sale.customerId, null, 'sale cannot point at a deleted customer')
  assert.deepEqual(sale.items, [{ productId: 'p1', name: 'Phone', price: 10.5, qty: 2 }])

  // Settings are filled with safe defaults so the Prisma row is always valid.
  assert.equal((state.settings as Record<string, unknown>).currency, '$')
  assert.equal((state.settings as Record<string, unknown>).taxRate, 0)
})

test('duplicate receipt numbers are made unique instead of failing the save', () => {
  const state = normalizeState({
    sales: [
      { id: 's1', receiptNo: '1001', createdAt: 1, items: [] },
      { id: 's2', receiptNo: '1001', createdAt: 2, items: [] },
      { id: 's3', createdAt: 3, items: [] },
    ],
  })
  const receipts = state.sales.map((s) => s.receiptNo)
  assert.equal(new Set(receipts).size, receipts.length)
  assert.equal(receipts[0], '1001')
})

test('timestamps map to BigInt rows and missing refunds stay null', () => {
  const rows = toTableRows(normalizeState({ products: [{ id: 'p', createdAt: 5 }], sales: [{ id: 's', createdAt: 7, items: [] }] }))
  assert.equal(typeof (rows.products[0] as Record<string, unknown>).createdAt, 'bigint')
  assert.equal((rows.sales[0] as Record<string, unknown>).refundedAt, null)
})

test('receipt numbers use the highest existing number, not the array length', () => {
  const sales = [
    { receiptNo: '1001' },
    { receiptNo: '1007' },
    { receiptNo: 'not-a-number' },
  ] as unknown as Sale[]
  assert.equal(nextReceiptNo(sales), '1008')
  assert.equal(nextReceiptNo([]), '1001')
})

// ── 2. Store edits end up in the synced payload ─────────────────────────────
test('customer and product add/update are present in the server payload', () => {
  const store = useStore.getState()
  const startingCustomers = store.customers.length

  const customer = store.addCustomer({
    name: 'Sync Test Customer',
    phone: '+1 555 0100',
    email: 'sync@example.com',
    balance: 12,
    notes: 'VIP',
  })
  assert.ok(customer.id)
  assert.equal(useStore.getState().customers.length, startingCustomers + 1)
  store.updateCustomer(customer.id, { balance: 25, notes: 'Updated' })

  const product = store.addProduct({
    sku: 'TEST-SYNC-1',
    name: 'Sync Test Phone',
    description: 'Added by test',
    categoryId: useStore.getState().categories[0].id,
    grade: 'A',
    price: 100,
    cost: 60,
    stock: 2,
    lowStockThreshold: 1,
    image: '',
  })
  store.updateProduct(product.id, { stock: 5, price: 120 })

  const snapshot = snapshotOf(useStore.getState() as unknown as Record<string, unknown>)
  const savedCustomer = (snapshot.customers as Record<string, unknown>[]).find((c) => c.id === customer.id)
  const savedProduct = (snapshot.products as Record<string, unknown>[]).find((p) => p.id === product.id)
  assert.equal(savedCustomer?.balance, 25)
  assert.equal(savedCustomer?.notes, 'Updated')
  assert.equal(savedProduct?.stock, 5)
  assert.equal(savedProduct?.price, 120)

  // What the server will accept after a JSON round-trip.
  const normalized = normalizeState(JSON.parse(JSON.stringify(snapshot)))
  assert.equal(normalized.customers.find((c) => c.id === customer.id)?.balance, 25)
  assert.equal(normalized.products.find((p) => p.id === product.id)?.stock, 5)
})

test('snapshot validation rejects non-store payloads', () => {
  assert.equal(isValidSnapshot({ data: [] }), false)
  assert.equal(isValidSnapshot(null), false)
  assert.equal(isValidSnapshot({ products: [] }), true)
  const patch = storePatchFromSnapshot(emptySnapshot())
  assert.deepEqual(patch.products, [])
  assert.deepEqual(patch.savedCarts, [])
})

// ── 3. Sync lifecycle (the reported "changes disappear" bugs) ───────────────
test('a pristine demo store adopts the server copy, a store with edits is pushed', () => {
  const pristine = pristineSnapshot()
  assert.equal(isPristineStore(pristine), true, 'untouched seed data is recognised')
  assert.equal(needsPushOnStart({ snapshot: pristine, baseline: null, dirty: false }), false)

  const edited = {
    ...pristine,
    customers: [...(pristine.customers as unknown[]), { id: 'local-1', name: 'Lakshmi', balance: 5 }],
  } as unknown as Snapshot
  assert.equal(isPristineStore(edited), false)
  assert.equal(
    needsPushOnStart({ snapshot: edited, baseline: null, dirty: false }),
    true,
    'edits made before the upgrade must be pushed, not replaced by the server copy'
  )
})

test('a baseline detects edits made since the last successful sync', () => {
  const pristine = pristineSnapshot()
  const baseline = fingerprint(pristine)
  assert.equal(needsPushOnStart({ snapshot: pristine, baseline, dirty: false }), false)
  const edited = { ...pristine, settings: { ...DEFAULT_SETTINGS, storeName: 'Renamed' } } as unknown as Snapshot
  assert.equal(needsPushOnStart({ snapshot: edited, baseline, dirty: false }), true)
  assert.equal(needsPushOnStart({ snapshot: pristine, baseline, dirty: true }), true)
})

test('fingerprints ignore ids and timestamps', () => {
  const a = fingerprint({ products: [{ id: 'a', name: 'Phone', createdAt: 1 }], customers: [] } as unknown as Snapshot)
  const b = fingerprint({ products: [{ id: 'b', name: 'Phone', createdAt: 999 }], customers: [] } as unknown as Snapshot)
  assert.equal(a, b)
})

test('logging in after load starts sync and pushes earlier offline edits', async () => {
  const remote = emptySnapshot()
  ;(remote.customers as unknown[]) = [{ id: 'old', name: 'Old server customer' }]

  const h = harness({ token: null, dirty: true, get: () => jsonResponse({ data: remote }) })
  h.mutate({ customers: [{ id: 'new', name: 'Lakshmi', phone: '', email: '', balance: 0, notes: '', createdAt: 1 }] })
  h.sync.start()
  await tick()

  // Mounted on the login page: no token, so no request yet.
  assert.equal(h.calls.length, 0)

  h.login('jwt-token')
  await tick()

  assert.equal(h.calls[0].method, 'GET')
  assert.equal(h.calls[1]?.method, 'PUT', 'unsaved local edits must be pushed after login')
  assert.equal((h.calls[1].headers as Record<string, string>).Authorization, 'Bearer jwt-token')
  const pushed = h.calls[1].body as { customers: { id: string }[] }
  assert.ok(pushed.customers.some((c) => c.id === 'new'), 'new customer is not overwritten by server state')
  assert.equal(h.dirty, false)
})

test('a clean device pulls server state, then saves every later edit', async () => {
  const remote = emptySnapshot()
  ;(remote.customers as unknown[]) = [{ id: 'server-1', name: 'From server' }]
  const h = harness({ token: 'jwt', dirty: false, get: () => jsonResponse({ data: remote }) })

  h.sync.start()
  await tick()
  assert.equal(h.putCount(), 0)
  assert.deepEqual(h.snapshot.customers, remote.customers)

  h.mutate({ customers: [...(remote.customers as never[]), { id: 'local-1', name: 'Added later' }] })
  h.change()
  assert.equal(h.hasTimer(), true)
  h.runTimer()
  await tick()

  assert.equal(h.putCount(), 1)
  const body = h.calls.at(-1)?.body as { customers: { id: string }[] }
  assert.ok(body.customers.some((c) => c.id === 'local-1'))
  assert.equal(h.dirty, false)
})

test('an edit made while a save is in flight is queued, not dropped', async () => {
  let releaseFirst: (response: Response) => void = () => {}
  let putCount = 0
  const h = harness({
    token: 'jwt',
    dirty: false,
    get: () => jsonResponse({ data: emptySnapshot() }),
    put: () => {
      putCount += 1
      if (putCount === 1) return new Promise<Response>((resolve) => (releaseFirst = resolve))
      return jsonResponse({ ok: true })
    },
  })

  h.sync.start()
  await tick()

  h.mutate({ products: [{ id: 'p1', name: 'first version' }] })
  h.change()
  h.runTimer()
  await tick()
  assert.equal(putCount, 1)

  // Second edit lands while PUT #1 is still awaiting the server.
  h.mutate({ products: [{ id: 'p1', name: 'second version' }] })
  h.change()
  await tick()

  releaseFirst(jsonResponse({ ok: true }))
  await tick()

  h.runTimer()
  await tick()

  assert.equal(putCount, 2, 'a follow-up save is scheduled after the in-flight one')
  const body = h.calls.filter((c) => c.method === 'PUT').at(-1)?.body as { products: { name: string }[] }
  assert.equal(body.products[0].name, 'second version')
})

test('a failed save is retried automatically and keeps the dirty flag', async () => {
  let putCount = 0
  const h = harness({
    token: 'jwt',
    dirty: false,
    get: () => jsonResponse({ data: emptySnapshot() }),
    put: () => {
      putCount += 1
      return putCount === 1 ? jsonResponse({ error: 'db down' }, 500) : jsonResponse({ ok: true })
    },
  })

  h.sync.start()
  await tick()

  h.mutate({ customers: [{ id: 'c1', name: 'Retry me' }] })
  h.change()
  h.runTimer()
  await tick()

  assert.equal(putCount, 1)
  assert.equal(h.dirty, true, 'failed save stays dirty')
  assert.equal(h.hasTimer(), true, 'a retry is scheduled')
  assert.ok(h.errors.some((e) => e && /Save failed/.test(e)))

  h.runTimer()
  await tick()
  assert.equal(putCount, 2)
  assert.equal(h.dirty, false)
})

test('a 401 response does not enable saving with an invalid session', async () => {
  const h = harness({ token: 'expired', dirty: false, get: () => jsonResponse({ error: 'nope' }, 401) })
  h.sync.start()
  await tick()

  assert.equal(h.sync.isActive(), false, 'sync must not activate with an expired token')
  h.mutate({ customers: [{ id: 'c1', name: 'Local only' }] })
  h.change()
  await tick()
  assert.equal(h.hasTimer(), false)
  assert.equal(h.putCount(), 0)
})

test('logging out flushes pending edits with the previous token', async () => {
  const h = harness({ token: 'jwt', dirty: false, get: () => jsonResponse({ data: null }) })
  h.sync.start()
  await tick()
  assert.equal(h.putCount(), 1, 'empty server is seeded with local state')

  h.mutate({ customers: [{ id: 'c9', name: 'Before logout' }] })
  h.change()
  h.login(null)
  await tick()

  assert.equal(h.putCount(), 2)
  assert.equal((h.calls.at(-1)?.headers as Record<string, string>).Authorization, 'Bearer jwt')
})

// ── 4. Uploading a file for the AI to read ──────────────────────────────────
test('markdown files become separate knowledge docs and are retrievable by the AI', () => {
  const docs = parseKnowledgeFile(
    'store-policies.md',
    '# Refund policy\r\n\r\nReturns need the original receipt within 30 days.\r\n\r\n## Warranty\r\n\r\nEvery refurbished device carries a 12-month warranty.'
  )
  assert.equal(docs.length, 2)
  assert.equal(docs[0].title, 'Refund policy')
  assert.match(docs[0].content, /original receipt/)
  assert.equal(docs[1].title, 'Warranty')
  assert.match(docs[1].content, /12-month warranty/)

  // Push into the store, then let the real retrieval pipeline read it.
  const store = useStore.getState()
  for (const doc of docs) store.addKnowledgeDoc(doc.title, doc.content)
  const snapshot = snapshotOf(useStore.getState() as unknown as Record<string, unknown>)
  assert.ok(
    (snapshot.knowledge as { title: string }[]).some((d) => d.title === 'Warranty'),
    'imported docs are saved in the synced payload'
  )

  const hits = retrieveKnowledge(useStore.getState().knowledge as KnowledgeDoc[], 'How long is the warranty?')
  assert.ok(hits.length > 0)
  assert.match(hits[0].text, /12-month warranty/)
})

test('plain text, CSV and HTML uploads are readable', () => {
  const txt = parseKnowledgeFile('opening-hours.txt', 'Mon–Sat 9am to 6pm.\nClosed Sundays.')
  assert.equal(txt.length, 1)
  assert.equal(txt[0].title, 'opening hours')
  assert.match(txt[0].content, /Closed Sundays/)

  const csv = parseKnowledgeFile('price-list.csv', 'sku,name,price\nPH-1,iPhone,400')
  assert.match(csv[0].content, /PH-1/)

  const html = parseKnowledgeFile('faq.html', '<h1>FAQ</h1><p>We accept cash &amp; card.</p>')
  assert.match(html[0].content, /cash & card/)
  assert.doesNotMatch(html[0].content, /<p>/)
})

test('JSON uploads understand doc lists and POS backups', () => {
  const list = parseKnowledgeFile('faq.json', JSON.stringify([{ title: 'Returns', content: 'Bring the receipt.' }]))
  assert.deepEqual(list, [{ title: 'Returns', content: 'Bring the receipt.' }])

  const backup = parseKnowledgeFile(
    'nova-pos-backup.json',
    JSON.stringify({ app: 'nova-pos', data: { knowledge: [{ title: 'Warranty', content: 'One year.' }] } })
  )
  assert.deepEqual(backup, [{ title: 'Warranty', content: 'One year.' }])

  // A backup with no docs must not dump its whole JSON into the knowledge base.
  const noDocs = parseKnowledgeFile('nova-pos-backup.json', JSON.stringify({ app: 'nova-pos', data: { products: [] } }))
  assert.deepEqual(noDocs, [])
})

test('empty or whitespace-only files add nothing', () => {
  assert.deepEqual(parseKnowledgeFile('empty.txt', '   \n\n '), [])
  assert.deepEqual(parseKnowledgeFile('empty.md', ''), [])
})
