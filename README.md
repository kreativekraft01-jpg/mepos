# MEPoS — Refurbished Electronics POS

Modern POS for refurbished tech (buy · sell · exchange) with offline-first store, in-browser AI (WebLLM), and optional server persistence for public deployments on Render.

**Live:** `https://mepos-mjrm.onrender.com` → POS `/#/` · Admin `/#/admin` · Login `/#/login`
**Repo:** `https://github.com/kreativekraft01-jpg/mepos`

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Vite + React 18)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  MEPoS App   │  │ Admin (/admin)│  │  AiAssistant (Agent X)│   │
│  │  Home/Cart/  │  │ Dashboard/   │  │  WebLLM (in-browser) │    │
│  │  Customer/*  │  │ Products/    │  │  RAG + skills        │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘    │
│         │                 │                     │                 │
│         └─────────────────┼─────────────────────┘                 │
│                           │ zustand + persist                     │
│                    ┌──────▼──────┐                               │
│                    │  useStore   │  ←→ localStorage 'nova-pos'   │
│                    │  authStore  │  ←  mepos-auth (JWT)          │
│                    └──────┬──────┘                               │
│                           │  serverSync (when /api reachable)    │
└───────────────────────────┼──────────────────────────────────────┘
                            │  GET/PUT /api/state (Bearer JWT)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Node 20 · Express 4 (server/)                 │
│  /api/health (public)  /api/auth/login|me  /api/state (auth)    │
│  static: serves pos-app/dist (Vite build) → HashRouter fallback  │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │  Postgres (Neon free) │
                │  StoreState {id, data}│ ← whole POS JSON (JSONB)
                │  User {username, hash}│
                └───────────────────────┘
   Fallback (no DATABASE_URL): JSON file `server/data-fallback.json` + memory (ephemeral on Render Free)
```

**Routing:** `HashRouter` (`/#/` and `/#/admin`) — no server rewrite needed for static hosting.

**Theme:** `src/styles/theme.css` — CSS variables (`--card`, `--background`) with `html.light`/`html.dark` toggled by `App.tsx`, safelisted via `@source inline("light dark")`.

---

## 2. Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, React Router v6 (Hash), Vite 5, Tailwind 4 + `tw-animate`, Radix UI, Framer Motion, Zustand 4 (persist), Sonner |
| AI | `@mlc-ai/web-llm` 0.2.84 — `src/store/browserAi.ts` (WebGPU, cached models), `src/utils/rag.ts` (BM25 + chunking), `src/utils/pipeline.ts` (fuseEvidence → decideAnswer), `src/utils/knowledgeAi.ts` (cited generation, `conciseKnowledgeAnswer` fallback), `src/utils/browserLlm.ts` |
| Backend | Express 4, Prisma 6, `better-sqlite3` types, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv` |
| DB | Postgres (Neon free 0.5GB) — single `StoreState` JSONB row; `User` for auth. Local fallback JSON file |
| Build | `tsc -b && vite build` → `dist/`, `server: tsc && prisma generate` → `server/dist` |

---

## 3. Data & API

### 3.1 Store Shape (`src/types.ts`, `src/store/useStore.ts`)

Persisted under `localStorage 'nova-pos'` (key `nova-pos`, version `16`):

```ts
Settings { storeName, tagline, currency, taxRate, receiptFooter, aiEnabled, browserModel, kbEnabled, skillsEnabled }
Category[], Product[] { grade A-F, buyPrice/exchangePrice, stock, lowStockThreshold }
Customer[], Sale[] { kind: sale|buy|exchange|refund, total (negative = payout), payments, tillId }
Voucher[], KnowledgeDoc[], AiSkill[], Till[], SavedCart[], BankingContext
```

Computed:
* `netTotal = sum(sell) - sum(buy)` — sell adds to bank, buy deducts. `total = net` (VAT shown separately). `saleCashAmount()` returns `-cash` for `buy`/`refund` so `tillExpectedCash()` deducts payouts.
* `saleToTransaction` / `cartToTransaction` (`src/app/data/bridge.ts`) map to `Transaction { orderNumber, dateTime, createdAt, orderType, qty, total: abs(net) }`.

### 3.2 Auth

* `server/src/server.ts` — `POST /api/auth/login {username,password}` → bcrypt compare → JWT (`JWT_SECRET`, `7d`). Fallback mode without DB checks `ADMIN_USERNAME`/`ADMIN_PASSWORD` env directly. `GET /api/auth/me` verifies. `ensureDefaultUser()` creates `admin/admin123` from env if missing.
* Frontend `src/store/authStore.ts` persists `token` in `mepos-auth`, `src/utils/serverSync.ts` sends `Authorization: Bearer <token>` for `/api/state`. `src/App.tsx:RequireAuth` probes `GET /api/state` → `401` → redirect `/#/login`, else allow (local dev without server bypasses).

### 3.3 Knowledge Base & AI

* Docs: `seedKnowledge` (`Store policies`, `Daily operations`) + user docs via `knowledge` array (Admin → Settings → Knowledge base). Skills: `seedSkills` (Banking Variance).
* Retrieval: `rag.ts:retrieveKnowledge()` — chunk (`size 450, overlap 80`), BM25 (`K1 1.4, B 0.8`) over `title+chunk` tokens, heading bonus. `kbStronglyMatches()` ≥60% token overlap.
* Pipeline: `pipeline.ts:retrieveEvidence()` — parallel customer/catalog/KB/skills retrieval; `isProcedural || hasFaqMatch` → `kbRaw`. `fuseEvidence()` scores `customer/kb/catalog/compare/skills` (threshold 4, priority customer > kb > catalog). `decideAnswer()` → `deterministicAnswer` or `llm`. `validateAnswer()` rejects unverified facts.
* Assistant: `AiAssistant.tsx` — `retrieveEvidence → decideAnswer` → if `kb` winner → `answerFromKnowledge()` (LLM cited generation via WebLLM, fallback `conciseKnowledgeAnswer()` — best sentence, colon-trim, capitalized). Else deterministic or offline `offlineReply`.

### 3.4 Transactions & Sales Visibility

* `CartPage.tsx` — `sellTotal - buyTotal = net`, `PAY: £net` vs `PAYOUT: £abs(net)`. `PaymentDue.tsx` handles `isPayout` (`absTotal`, `remaining`, `Pay Out` button).
* `useStore.checkout()` — validates `owed` vs `payoutDue`, creates `Sale{ kind, total: net, paymentMethod }`, updates stock (`buy → +qty`), appends to `sales`.
* Visibility: `Recent Transactions` (`OrderHistory.tsx`) sorts `createdAt desc` (latest on top) with clickable **Date & Time** toggle; `Sales` (`pages/Sales.tsx`) sorts `b.createdAt - a.createdAt` and shows `Type` badge (`sale/buy/exchange/refund`) — both show all kinds.

### 3.5 Backup

* UI: **Admin → Settings → Backup & Restore** — `src/utils/backup.ts` (`createBackupPayload`, `downloadBackup`, `restoreFromFile`) — JSON `{app, storeVersion, exportedAt, data{...}}`.
* Repo snapshots: `pos-app/backups/nova-pos-backup-YYYY-MM-DD.json` + `master-local.bundle` (full git). Tag `Master-local` (`885cd28`) is the working local restore point.

---

## 4. Project Structure

```
pos-app/
├── src/
│   ├── App.tsx                 # HashRouter + RequireAuth + initServerSync
│   ├── app/App.tsx             # MEPoS shell (theme, idle → ScreenSaver, cart)
│   ├── app/components/         # CartPage, PaymentDue, OrderHistory, HomePage, Sidebar, TopNavigation…
│   ├── app/data/bridge.ts      # saleToTransaction, productToBox, etc.
│   ├── app/types.ts            # Transaction, TransactionItem, OrderType
│   ├── components/             # Layout (admin), AiAssistant, AgentX, Modal…
│   ├── pages/                  # Dashboard, Sales, Products, Inventory, Customers, Tills, Settings, Login
│   ├── store/useStore.ts       # Zustand persist (nova-pos, v16, migrate), seedAll
│   ├── store/browserAi.ts      # WebLLM persist (mepos-browser-ai, cached models)
│   ├── store/authStore.ts      # JWT persist (mepos-auth)
│   ├── styles/{theme,global,index,tailwind}.css
│   ├── types.ts                # Category, Product, Sale, Settings, KnowledgeDoc…
│   └── utils/{ai,rag,pipeline,knowledgeAi,backup,format,serverSync,browserLlm}
├── server/
│   ├── src/server.ts           # Express + Prisma + static serve
│   ├── prisma/schema.prisma    # StoreState + User
│   └── package.json
├── backups/                    # JSON + .bundle snapshots
├── scripts/test.mjs            # node --test + esbuild suites
├── tests/assistant.test.ts     # 28 node tests (incl. KB active + concise fallback)
├── render.yaml                 # Render Blueprint (Web Service, Free)
├── vite.config.ts              # base './', manualChunks: vendor/web-llm/motion
└── package.json                # build: tsc -b && vite build
```

---

## 5. Local Setup

**Prereqs:** Node 20.19.0 (`.node-version`), npm 10+

```bash
# 1. Clone
git clone https://github.com/kreativekraft01-jpg/mepos.git
cd mepos/pos-app   # repo root is pos-app

# 2. Frontend (localStorage mode — no DB needed)
npm ci
npm run dev        # http://localhost:5173  → POS #/  Admin #/admin  Login #/login (see below)

# 3. Dynamic mode (server + Postgres) — optional for testing server persistence
# Create Neon free project → copy pooled connection string
echo 'DATABASE_URL="postgresql://neondb_owner:...@ep-...-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"' > server/.env
echo 'JWT_SECRET="local-dev-secret-change-me"' >> server/.env
echo 'ADMIN_USERNAME="admin"' >> server/.env
echo 'ADMIN_PASSWORD="admin123"' >> server/.env
npm --prefix server install
npx --prefix server prisma generate
npm --prefix server run build   # or: npm --prefix server run dev (tsx watch)
# In two terminals:
npm --prefix server run dev    # :3000
npm run dev                    # :5173 (auto-syncs to /api/state when reachable)

# 4. Tests & build
npm test          # 47 node tests + 44 search, 86 edge, 27 filters, 89 kb
npm run build     # tsc -b && vite build → dist/ + server/dist/
```

**Env files:**
* `pos-app/.env.example` → `VITE_API_URL=""` (empty = same-origin /api, or `http://localhost:3000` for separate dev)
* `pos-app/server/.env.example` → `DATABASE_URL`, `PORT=3000`, `CORS_ORIGIN="*"`, `JWT_SECRET`, `ADMIN_*`

**Login locally:**
* If server running: `admin / admin123` (or your `ADMIN_*` env). Without server, `RequireAuth` bypasses (fast dev).

**Restore working snapshot:**
```bash
git checkout Master-local
# or
git clone backups/master-local.bundle restored
# or data only: Admin → Settings → Backup & Restore → Upload backup → master-local-backup-2026-09-09.json
```

---

## 6. Deploy to Render (Free)

**Repo is already connected:** `https://github.com/kreativekraft01-jpg/mepos` (branch `main`)

`render.yaml` at repo root:
```yaml
services:
  - type: web
    name: mepos-pos-app
    env: node
    plan: free
    branch: main
    buildCommand: npm ci && npm run build && cd server && npm install && npx prisma generate && npm run build
    startCommand: node server/dist/server.js
    autoDeploy: true
    previews: { generation: automatic }
    healthCheckPath: /api/health
    envVars:
      - { key: NODE_VERSION, value: 20.19.0 }
      - { key: DATABASE_URL, sync: false } # set in dashboard
      - { key: JWT_SECRET, sync: false }
      - { key: ADMIN_USERNAME, sync: false }
      - { key: ADMIN_PASSWORD, sync: false }
```

**Steps:**
1. Render → **New + → Blueprint** → paste `https://github.com/kreativekraft01-jpg/mepos` → **Apply** (or **New + → Web Service → Public Git repo** → same URL, Branch `main`, Build/Start as above).
2. **Environment → Add:** `DATABASE_URL` (Neon pooled `postgresql://...`), `JWT_SECRET` (`openssl rand -base64 32`), `ADMIN_USERNAME`/`ADMIN_PASSWORD` (optional, defaults `admin/admin123`).
3. **Manual Deploy → Deploy latest commit** (first time) → `https://mepos-mjrm.onrender.com` → health `https://.../api/health` → `{"ok":true,"mode":"postgres"}`.
4. Local flow: test on `http://localhost:5173` → `git add -A && git commit -m "..." && git push origin main` → Render auto-deploys (PRs get preview deploys).

**Notes:**
* HashRouter needs no rewrite rules.
* Free plan sleeps after 15min idle (30-60s cold start); WebLLM still works (models from CDN, cached in browser).
* Without `DATABASE_URL`, server uses `server/data-fallback.json` (ephemeral on Free — ok for demo, set Neon for persistence).

---

## 7. Key Fixes Included (Master-local → main)

* Recent Transactions: `createdAt` + `Date & Time` sortable (desc default)
* Buy/sell bank: `sell - buy = net`, `PAYOUT` flow, `tillExpectedCash` deducts buys
* Sales Type column, KB active on every FAQ (`kbStronglyMatches` ≥60%), natural concise fallback (`The first step is to listen…`)
* Theme: `@theme` (not inline) + `@source inline("light dark")` + `html.light` so `bg-card` correctly shows `rgb(255,255,255)` in light mode
* PaymentDue checkboxes clickable + `text-foreground` for readability, backup/restore UI, login protection
