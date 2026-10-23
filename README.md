# Leads Store Management System (EquipmentHub)

Register store equipment, track calibrations and certificates, issue equipment (singly or as a
set) to technicians against a job, and reconcile returns. Expired calibration automatically
quarantines equipment.

## Stack

| Layer     | Technology                                                                    |
| --------- | ----------------------------------------------------------------------------- |
| Framework | TanStack Start — React 19 with server-side rendering and **server functions** |
| UI        | TypeScript, Tailwind CSS v4, shadcn/ui (Radix), lucide icons, sonner (toasts) |
| Data (UI) | TanStack Query (caching), TanStack Router (file-based routes)                 |
| Database  | Microsoft SQL Server via the `mssql` driver                                   |
| Auth      | Own login: scrypt-hashed passwords + HTTP-only session cookie                 |
| Build     | Vite 8; Nitro packages the production build as a standalone Node.js server    |

## How it works

Frontend and backend live in **one project and run as one Node.js process**:

```
Browser (React pages)                         Node.js server
─────────────────────                         ──────────────────────────────────────────
src/routes/*.tsx  ── calls ──►  src/lib/*.functions.ts  ──►  src/server/*.server.ts ──► SQL Server
src/components/*                (server functions: run on      (DB pool, password hashing,
                                 the server; the browser gets   sessions — never sent
                                 only a tiny fetch stub)        to the browser)
```

- **Login:** `signIn` checks the password hash, stores a random token's SHA-256 in
  `dbo.sessions`, and sets it in an HTTP-only cookie (`store_session`, 30 days, renewed on use).
- **Access rules:** every signed-in staff member can view and edit everything; only Master
  Admins can delete equipment and manage staff accounts. Enforced on the server by
  `requireAuth` / `requireAdmin` (`src/lib/auth-middleware.ts`). At least one admin always remains.
- **Data:** every screen reads the whole (small) inventory through one `getStore` server
  function, cached by React Query under the `["store"]` key; saving anything invalidates it.
- **Files** (photos, calibration certificates, manuals/software/files) are stored in SQL Server
  (`dbo.files`, up to 50 MB each) and served by `GET /api/files/:id` to signed-in users only.
  Files no longer referenced by any record are removed automatically after a day.
- **Database setup is automatic:** on the first request the server connects to `DATABASE_URL`,
  creates the database if it does not exist, and applies `database/schema.sql` (idempotent).
  The sign-in page then asks you to create the first administrator.

## Files

| File                                  | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `database/schema.sql`                 | SQL Server tables; applied automatically at startup              |
| `src/server/db.server.ts`             | Parses `DATABASE_URL`, connection pool, creates DB + schema      |
| `src/server/crypto.server.ts`         | Password hashing (scrypt), session tokens                        |
| `src/server/auth.server.ts`           | Create / read / destroy login sessions                           |
| `src/lib/auth-middleware.ts`          | `requireAuth` / `requireAdmin` guards for server functions       |
| `src/lib/auth.functions.ts`           | Sign in/out, current session, first-administrator setup          |
| `src/lib/users.functions.ts`          | Staff accounts: list, create, change role/password, delete       |
| `src/lib/store.functions.ts`          | Equipment, calibrations, issuance/return, masters, sets, uploads |
| `src/lib/store.ts`                    | `useStore()` hook, status/quarantine rules, file helpers         |
| `src/routes/api/files.$id.ts`         | Download/view an uploaded file                                   |
| `src/routes/`                         | Pages (dashboard, equipment, calibration, issuance, masters, …)  |

## Configuration (`.env`)

| Variable                | Purpose                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `sqlserver://HOST[\INSTANCE][:PORT];database=NAME;user=...;password=...;encrypt=true;trustServerCertificate=true` |
| `SESSION_COOKIE_SECURE` | `true` when the site is served over HTTPS                                                                         |
| `PORT` (optional)       | Port to listen on (default 3000)                                                                                  |

Copy `.env.example` to `.env` and fill it in. The SQL login needs `CREATE DATABASE`
permission the first time if the database does not exist yet (`sa` has it).

## Run locally

Requires Node.js 20.12 or newer.

```sh
npm install        # once, or after package.json changes
npm run dev        # http://localhost:3000, reloads on code changes
```

## Build and host

```sh
npm run build      # creates .output/ (the complete server)
npm start          # runs .output/server/index.mjs with .env, on PORT (default 3000)
```

To deploy, copy **`.output/`, `.env` and `package.json`** to the server (it needs Node.js but
not `node_modules` or the source) and run `npm start` there. Keep it running with pm2 or as a
Windows service (e.g. NSSM), and put IIS (URL Rewrite + ARR) or nginx in front for HTTPS;
then set `SESSION_COOKIE_SECURE=true`.

## Other scripts

| Command          | What it does                       |
| ---------------- | ---------------------------------- |
| `npm test`       | Run the unit tests (Vitest)        |
| `npm run lint`   | Check code with ESLint             |
| `npm run format` | Auto-format all code with Prettier |
