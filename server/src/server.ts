import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const app = express()
const PORT = Number(process.env.PORT || 3000)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const JWT_SECRET = process.env.JWT_SECRET || 'mepos-dev-secret-change-me'
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'

app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN }))
app.use(express.json({ limit: '10mb' }))

// --- Persistence: try Prisma Postgres, fallback to JSON file + memory (for local dev without DB) ---
let prisma: any = null
let usePrisma = false
const fallbackPath = path.join(process.cwd(), 'data-fallback.json')
let memoryState: any = null

async function initPrisma() {
  if (!process.env.DATABASE_URL) {
    console.log('[server] No DATABASE_URL — using JSON file + memory fallback (ephemeral on Render free without DB)')
    // try load fallback file
    try {
      if (fs.existsSync(fallbackPath)) memoryState = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'))
    } catch {}
    return
  }
  try {
    const mod = await import('@prisma/client')
    prisma = new mod.PrismaClient()
    await prisma.$connect()
    usePrisma = true
    console.log('[server] Connected to Postgres via Prisma')
    // Ensure legacy table exists for migration
    try {
      await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS "StoreState" ("id" TEXT PRIMARY KEY, "data" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    } catch {}
    await ensureDefaultUser()
    await migrateFromStoreStateIfNeeded()
  } catch (e) {
    console.warn('[server] Prisma connect failed, falling back to JSON file:', (e as Error).message)
    try {
      if (fs.existsSync(fallbackPath)) memoryState = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'))
    } catch {}
  }
}

function saveFallback(data: any) {
  memoryState = data
  try {
    fs.mkdirSync(path.dirname(fallbackPath), { recursive: true })
    fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2))
  } catch {}
}

// --- Auth helpers ---
function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as never)
}
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>
    ;(req as unknown as Record<string, unknown>).user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

async function ensureDefaultUser() {
  if (!usePrisma || !prisma) return
  try {
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS "User" ("id" TEXT PRIMARY KEY, "username" TEXT UNIQUE NOT NULL, "passwordHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  } catch {}
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  try {
    const existing = await prisma.user.findUnique({ where: { username } })
    if (!existing) {
      const hash = await bcrypt.hash(password, 10)
      await prisma.user.create({ data: { username, passwordHash: hash } })
      console.log(`[auth] Created default user: ${username}`)
    }
  } catch (e) {
    console.warn('[auth] ensureDefaultUser failed:', (e as Error).message)
  }
}

// Helpers to convert BigInt fields for JSON (Prisma returns BigInt, frontend expects number)
function toNum(v: unknown): number {
  return typeof v === 'bigint' ? Number(v) : (v as number)
}
function mapSale(s: Record<string, unknown>): Record<string, unknown> {
  return {
    ...s,
    createdAt: toNum(s.createdAt),
    refundedAt: s.refundedAt != null ? toNum(s.refundedAt) : undefined,
  }
}

async function readStateFromTables(): Promise<Record<string, unknown> | null> {
  if (!usePrisma || !prisma) return null
  try {
    const [categories, products, customers, salesRaw, vouchers, knowledge, skills, tills, savedCarts, settingsRow] = await Promise.all([
      prisma.category.findMany(),
      prisma.product.findMany(),
      prisma.customer.findMany(),
      prisma.sale.findMany({ include: { items: true } }),
      prisma.giftVoucher.findMany(),
      prisma.knowledgeDoc.findMany(),
      prisma.aiSkill.findMany(),
      prisma.till.findMany(),
      prisma.savedCart.findMany(),
      prisma.appSettings.findUnique({ where: { id: 'singleton' } }),
    ])
  const hasData = categories.length || products.length || customers.length || salesRaw.length || vouchers.length || knowledge.length || skills.length || tills.length || savedCarts.length || settingsRow
  if (!hasData) return null
  const sales = salesRaw.map((s: Record<string, unknown>) => ({
    ...mapSale(s as Record<string, unknown>),
    items: ((s as Record<string, unknown>).items as Record<string, unknown>[]).map((it) => ({
      productId: it.productId,
      name: it.name,
      price: it.price,
      qty: it.qty,
    })),
  }))
  return {
    categories,
    products: (products as Record<string, unknown>[]).map((p) => ({ ...p, createdAt: toNum(p.createdAt) })),
    customers: (customers as Record<string, unknown>[]).map((c) => ({ ...c, createdAt: toNum(c.createdAt) })),
    sales,
    vouchers: (vouchers as Record<string, unknown>[]).map((v) => ({ ...v, createdAt: toNum(v.createdAt) })),
    knowledge: (knowledge as Record<string, unknown>[]).map((k) => ({ ...k, updatedAt: toNum(k.updatedAt) })),
    skills: (skills as Record<string, unknown>[]).map((sk) => ({ ...sk, updatedAt: toNum(sk.updatedAt) })),
    tills: (tills as Record<string, unknown>[]).map((t) => ({
      ...t,
      openedAt: t.openedAt != null ? toNum(t.openedAt) : undefined,
      closedAt: t.closedAt != null ? toNum(t.closedAt) : undefined,
    })),
    savedCarts: (savedCarts as Record<string, unknown>[]).map((sc) => ({ ...sc, createdAt: toNum(sc.createdAt) })),
    settings: settingsRow
      ? {
          storeName: (settingsRow as Record<string, unknown>).storeName,
          tagline: (settingsRow as Record<string, unknown>).tagline,
          currency: (settingsRow as Record<string, unknown>).currency,
          taxRate: (settingsRow as Record<string, unknown>).taxRate,
          receiptFooter: (settingsRow as Record<string, unknown>).receiptFooter,
          aiEnabled: (settingsRow as Record<string, unknown>).aiEnabled,
          browserModel: (settingsRow as Record<string, unknown>).browserModel,
          kbEnabled: (settingsRow as Record<string, unknown>).kbEnabled,
          skillsEnabled: (settingsRow as Record<string, unknown>).skillsEnabled,
        }
      : undefined,
  }
  } catch {
    return null
  }
}

async function writeStateToTables(data: Record<string, unknown>): Promise<void> {
  if (!usePrisma || !prisma) return
  const categories = (data.categories as Record<string, unknown>[]) || []
  const products = (data.products as Record<string, unknown>[]) || []
  const customers = (data.customers as Record<string, unknown>[]) || []
  const sales = (data.sales as Record<string, unknown>[]) || []
  const vouchers = (data.vouchers as Record<string, unknown>[]) || []
  const knowledge = (data.knowledge as Record<string, unknown>[]) || []
  const skills = (data.skills as Record<string, unknown>[]) || []
  const tills = (data.tills as Record<string, unknown>[]) || []
  const savedCarts = (data.savedCarts as Record<string, unknown>[]) || []
  const settings = data.settings as Record<string, unknown> | undefined

  // Use transaction to replace all data
  await prisma.$transaction(async (tx: Record<string, { deleteMany: (arg: unknown) => Promise<unknown>; createMany: (arg: unknown) => Promise<unknown>; upsert: (arg: unknown) => Promise<unknown>; create: (arg: unknown) => Promise<unknown> }>) => {
    await tx.saleItem.deleteMany({})
    await tx.sale.deleteMany({})
    await tx.savedCart.deleteMany({})
    await tx.giftVoucher.deleteMany({})
    // Customers after sales/vouchers to avoid FK issues, products after categories
    await tx.customer.deleteMany({})
    await tx.product.deleteMany({})
    await tx.category.deleteMany({})
    await tx.knowledgeDoc.deleteMany({})
    await tx.aiSkill.deleteMany({})
    await tx.till.deleteMany({})

    if (categories.length) await tx.category.createMany({ data: categories as never })
    if (products.length) {
      const mapped = products.map((p) => ({
        ...p,
        categoryId: (p.categoryId as string) || null,
        createdAt: BigInt(p.createdAt as number),
      }))
      await tx.product.createMany({ data: mapped as never })
    }
    if (customers.length) {
      const mapped = customers.map((c) => ({ ...c, createdAt: BigInt(c.createdAt as number) }))
      await tx.customer.createMany({ data: mapped as never })
    }
    for (const s of sales) {
      const { items, ...saleData } = s as { items: Record<string, unknown>[] } & Record<string, unknown>
      await tx.sale.create({
        data: {
          ...(saleData as unknown as Record<string, unknown>),
          createdAt: BigInt(saleData.createdAt as number),
          refundedAt: saleData.refundedAt != null ? BigInt(saleData.refundedAt as number) : null,
          payments: saleData.payments ?? undefined,
          serials: saleData.serials ?? undefined,
          items: { create: (items || []).map((it) => ({ productId: it.productId, name: it.name, price: it.price, qty: it.qty })) },
        },
      })
    }
    if (vouchers.length) {
      const mapped = vouchers.map((v) => ({ ...v, createdAt: BigInt(v.createdAt as number) }))
      await tx.giftVoucher.createMany({ data: mapped as never })
    }
    if (knowledge.length) {
      const mapped = knowledge.map((k) => ({ ...k, updatedAt: BigInt(k.updatedAt as number) }))
      await tx.knowledgeDoc.createMany({ data: mapped as never })
    }
    if (skills.length) {
      const mapped = skills.map((sk) => ({ ...sk, updatedAt: BigInt(sk.updatedAt as number) }))
      await tx.aiSkill.createMany({ data: mapped as never })
    }
    if (tills.length) {
      const mapped = tills.map((t) => ({
        ...t,
        openedAt: t.openedAt != null ? BigInt(t.openedAt as number) : null,
        closedAt: t.closedAt != null ? BigInt(t.closedAt as number) : null,
      }))
      await tx.till.createMany({ data: mapped as never })
    }
    if (savedCarts.length) {
      const mapped = savedCarts.map((sc) => ({ ...sc, createdAt: BigInt(sc.createdAt as number) }))
      await tx.savedCart.createMany({ data: mapped as never })
    }
    if (settings) {
      await tx.appSettings.upsert({
        where: { id: 'singleton' },
        update: settings as never,
        create: { id: 'singleton', ...(settings as unknown as Record<string, unknown>) },
      })
    }
  })
  // Keep legacy StoreState in sync for rollback
  try {
    await prisma.storeState.upsert({ where: { id: 'singleton' }, update: { data }, create: { id: 'singleton', data } })
  } catch {}
}

async function migrateFromStoreStateIfNeeded(): Promise<void> {
  if (!usePrisma || !prisma) return
  try {
    const existing = await readStateFromTables()
    if (existing) return // already have normalized data
    const row = await prisma.storeState.findUnique({ where: { id: 'singleton' } })
    if (!row || !row.data) return
    console.log('[migrate] Migrating legacy StoreState JSONB to normalized tables...')
    await writeStateToTables(row.data as Record<string, unknown>)
    console.log('[migrate] Migration complete')
  } catch (e) {
    console.warn('[migrate] failed:', (e as Error).message)
  }
}

// --- API ---

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: usePrisma ? 'postgres' : 'fallback', time: new Date().toISOString() })
})

// Auth — public
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {}
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  // Fallback mode without DB — check env credentials directly
  if (!usePrisma || !prisma) {
    const envUser = process.env.ADMIN_USERNAME || 'admin'
    const envPass = process.env.ADMIN_PASSWORD || 'admin123'
    if (username === envUser && password === envPass) {
      const token = signToken({ username, role: 'admin' })
      return res.json({ token, username })
    }
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  try {
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    const token = signToken({ id: user.id, username: user.username, role: 'admin' })
    return res.json({ token, username: user.username })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Login failed' })
  }
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = (req as unknown as Record<string, unknown>).user
  res.json({ user })
})

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/state', authMiddleware, async (_req, res) => {
  try {
    if (usePrisma && prisma) {
      const data = await readStateFromTables()
      if (data) return res.json({ data })
      const row = await prisma.storeState.findUnique({ where: { id: 'singleton' } })
      if (row) return res.json({ data: row.data })
      return res.json({ data: null })
    }
    return res.json({ data: memoryState })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to load state' })
  }
})

app.put('/api/state', authMiddleware, async (req, res) => {
  const data = req.body
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Invalid body' })
  try {
    if (usePrisma && prisma) {
      await writeStateToTables(data as Record<string, unknown>)
      return res.json({ ok: true })
    }
    saveFallback(data)
    return res.json({ ok: true, mode: 'fallback' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to save state' })
  }
})

// Optional: single-entity endpoints for future granular sync (currently whole-state is enough)
app.get('/api/backup', authMiddleware, async (_req, res) => {
  try {
    if (usePrisma && prisma) {
      const data = await readStateFromTables()
      if (data) return res.json(data)
      const row = await prisma.storeState.findUnique({ where: { id: 'singleton' } })
      return res.json(row?.data ?? null)
    }
    return res.json(memoryState)
  } catch (e) {
    res.status(500).json({ error: 'Failed' })
  }
})

// --- Serve frontend static (dist) when present (Render build puts dist at ../dist) ---
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// server/dist/server.js -> project dist is at ../../dist
const candidates = [
  path.join(__dirname, '../../dist'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), '../dist'),
]
let staticDir: string | null = null
for (const c of candidates) {
  if (fs.existsSync(path.join(c, 'index.html'))) { staticDir = c; break }
}
if (staticDir) {
  console.log('[server] Serving static from', staticDir)
  app.use(express.static(staticDir))
  // HashRouter needs no rewrite, but handle direct /admin/* etc. fallback to index.html for BrowserRouter safety
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir!, 'index.html'))
  })
} else {
  console.log('[server] No static dist found — API only mode. Run `npm run build` in pos-app first.')
  app.get('/', (_req, res) => res.send('MEPoS API running — build frontend with `npm run build` to serve UI'))
}

app.listen(PORT, () => console.log(`[server] MEPoS dynamic server listening on :${PORT}`))
void initPrisma()
