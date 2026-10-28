# Leads Store Management System (Equipment Hub)

Equipment register for the Leads store: equipment with photos and documents, calibration
records and certificates, issuing equipment to technicians on numbered issuance reports, returns,
equipment sets, master lists and Excel reports.

## Stack

| Layer     | Technology                                                                    |
| --------- | ----------------------------------------------------------------------------- |
| Framework | TanStack Start — React 19 with server-side rendering and **server functions** |
| UI        | TypeScript, Tailwind CSS v4, shadcn/ui (Radix), lucide icons                  |
| Data (UI) | TanStack Query (caching), TanStack Router (file-based routes)                 |
| Database  | Microsoft SQL Server via the `mssql` driver                                   |
| Auth      | Own login: scrypt-hashed passwords + HTTP-only session cookie                 |
| Build     | Vite 8; Nitro packages the production build as a standalone Node.js server    |

## How it works

Frontend and backend live in **one project and run as one Node.js process** — there is no
separate API server:

```
Browser (React pages)                         Node.js server
─────────────────────                         ──────────────────────────────────────────
src/routes/*.tsx  ── calls ──►  src/lib/*.functions.ts  ──►  src/server/*.server.ts ──► SQL Server
src/components/*                (server functions: run on      (DB pool, passwords,
                                 the server; the browser gets   sessions, files — never
                                 only a tiny fetch stub)        sent to the browser)
```

- **Accounts:** staff create their own account on the sign-in page. The first account (and
  `ipsudhan@gmail.com`, as in the original system) becomes a **Master Admin**.
- **Access rules:** as in the original system, every signed-in staff member can add and edit
  equipment, calibrations, issuances and master data. Only Master Admins can delete equipment and
  change who is a Master Admin (**Master Admin** page).
- **Numbering:** equipment codes (`EQ-00001`) and issuance report numbers (`IR-00001`) come
  from SQL Server sequences; all items issued together share one report number.
- **Expired calibration:** loading the store marks equipment whose latest calibration has expired
  as Quarantined ("Calibration expired").
- **Files** (photos, certificates, manuals, software) are stored in `dbo.files` and served to
  signed-in staff by `/api/files/...`.
- **Database setup is automatic:** on the first request the server connects to `DATABASE_URL`,
  creates the database if it does not exist and applies `database/schema.sql` (idempotent, safe
  on every start).

## Files

| File                          | Purpose                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `database/schema.sql`         | SQL Server tables (users, sessions, files, categories, subcategories, departments, technicians, equipment_sets, equipment, calibrations, issuances, equipment_files); applied automatically at startup |
| `src/server/db.server.ts`     | Parses `DATABASE_URL`, connection pool, creates the database and applies the schema                                                                                                                    |
| `src/server/auth.server.ts`   | Create / read / destroy login sessions (cookie + `dbo.sessions`)                                                                                                                                       |
| `src/server/crypto.server.ts` | Password hashing (scrypt) and session tokens                                                                                                                                                           |
| `src/server/rows.server.ts`   | Query helpers (JSON results, insert/update/delete rows)                                                                                                                                                |
| `src/lib/auth-middleware.ts`  | `requireAuth` / `requireAdmin` guards for server functions                                                                                                                                             |
| `src/lib/store.functions.ts`  | Store data, saves, issuing/returning, uploads, Master Admins                                                                                                                                           |
| `src/lib/store.ts`            | React Query hooks and calibration/status rules used by the pages                                                                                                                                       |
| `src/lib/auth.functions.ts`   | Sign in / sign up / sign out / current session                                                                                                                                                         |
| `src/server/files.server.ts`  | Store / read uploaded files (dbo.files)                                                                                                                                                                |
| `src/routes/api/files/$.ts`   | `/api/files/...` — streams an uploaded file to signed-in staff                                                                                                                                         |
| `src/assets/leads-logo.png`  | Logo |
| `src/routes/*`                | Pages (file-based routes); `src/routeTree.gen.ts` is generated — do not edit                                                                                                                           |
| `src/start.ts, src/server.ts` | Request middleware (errors, CSRF protection) and server entry                                                                                                                                          |

## Configuration (`.env`)

Copy `.env.example` to `.env` and fill it in.

| Variable                | Purpose                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `sqlserver://HOST[\INSTANCE][:PORT];database=new_leads_equipmenthub;user=...;password=...;encrypt=true;trustServerCertificate=true` |
| `SESSION_COOKIE_SECURE` | `true` when the site is served over HTTPS                                                                                           |
| `PORT` (optional)       | Port to listen on (default 3000)                                                                                                    |

The SQL login needs `CREATE DATABASE` permission the first time (`sa` has it) unless you create
the database yourself.

## Run locally

Requires Node.js 22 or newer and a reachable SQL Server.

```sh
npm install        # once, or after package.json changes
npm run dev        # http://localhost:3000, reloads on code changes
```

## Build and host

```sh
npm run build      # creates .output/ (the complete server)
npm start          # runs .output/server/index.mjs with .env, on PORT (default 3000)
```

To deploy, copy **`.output/`, `.env` and `package.json`** to the server (it needs Node.js but not
`node_modules` or the source) and run `npm start`. Keep it running with pm2
(`pm2 start npm --name leads-equipmenthub -- start`) or as a Windows service (e.g. NSSM), and put IIS
(URL Rewrite + ARR) or nginx in front for HTTPS; then set `SESSION_COOKIE_SECURE=true`.

## Other scripts

| Command          | What it does                       |
| ---------------- | ---------------------------------- |
| `npm test`       | Unit tests (Vitest)                |
| `npm run lint`   | Check code with ESLint             |
| `npm run format` | Auto-format all code with Prettier |
