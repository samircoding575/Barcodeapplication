# ScanGrade — Project Architecture Reference

**Purpose:** Barcode-based exam correction system for the Lebanese Bar Association. Candidates are assigned anonymous barcode tokens per exam; teachers scan and grade by token (never by name). Administrators manage sessions, exams, candidates, and view results.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 31 |
| Build tool | electron-vite 2 (wraps Vite 5 + esbuild) |
| Frontend | React 18 + React Router 6 (HashRouter) |
| State management | Zustand |
| Styling | Tailwind CSS 3 |
| IPC contract | contextBridge + typed channel constants |
| ORM | Prisma 5 (SQLite) |
| DB file (dev) | `prisma/qrecs.db` |
| DB file (prod) | `%APPDATA%\qrecs\qrecs.db` (copied from bundled template on first run) |
| Password hashing | bcryptjs |
| ID generation | @paralleldrive/cuid2 (length 10) |
| Word export | docx 9 + bwip-js 4 (server-side PNG barcodes) |
| CSV/XLSX export | papaparse + xlsx |
| Charts | recharts |
| Input validation | zod (IPC boundary only) |
| Packaging | electron-builder → `dist/win-unpacked/` |

---

## Directory Layout

```
src/
  main/           ← Electron main process (Node)
    index.ts      ← app entry, IPC handler for EXPORT_BARCODES_DOCX, startup migration
    config.ts     ← ADMIN_EMAIL / ADMIN_PASSWORD (env vars, default admin@lba.lb / Admin2026!)
    db.ts         ← Prisma singleton, DB path logic, migrateLegacyUserRoles()
    auth-state.ts ← in-memory userId/role for the current session
    ipc/
      auth.ts     ← ADMIN_LOGIN, USER1_LOGIN, USER1_SIGNUP, LOGOUT handlers
      admin.ts    ← all admin-only IPC handlers (guarded by requireAdmin)
      session.ts  ← session CRUD handlers (no auth guard — teacher reads too)
      exam.ts     ← exam CRUD handlers
      teacher.ts  ← grade entry, import, progress list (anonymity boundary)
      config.ts   ← legacy config alias
      guard.ts    ← requireAdmin() wrapper
    services/
      auth.ts     ← findUserByEmail, createUser, verifyPassword
      session.ts  ← listSessions, getActiveSession, createSession, etc.
      import.ts   ← grade-sheet import preview + commit
      barcodeDocx.ts ← Word export: buildBarcodesDocx(), BarcodeExportRecord

  preload/
    index.ts      ← contextBridge exposes window.api (typed against WindowAPI)

  shared/
    types.ts      ← all shared interfaces + WindowAPI contract + formatGrade/parseGradeInput
    ipc.ts        ← AdminChannels, TeacherChannels, SessionChannels, ... + Zod schemas

  renderer/src/   ← React app
    App.tsx       ← routing root, AdminShell / User1Shell split by role
    store/
      appStore.ts ← Zustand store: user, sessions, activeSession
    routes/
      auth/
        LoginPage.tsx      ← tab switch between User1 / Admin login forms
        AdminLoginForm.tsx
        User1LoginForm.tsx
      admin/
        Dashboard.tsx      ← per-exam analytics, grade distribution chart
        Students.tsx       ← candidate import + per-exam barcode generation
        BarcodePrint.tsx   ← barcode table view + Word export trigger
        Reports.tsx        ← results, master candidate view, XLSX export
        Sessions.tsx       ← session + exam CRUD
        GradeLog.tsx       ← admin grade-modification audit log
        Settings.tsx       ← org name, user accounts, data management
      teacher/
        Grade.tsx          ← barcode scan → grade entry (anonymity enforced)
        Import.tsx         ← bulk grade import from CSV/XLSX
        History.tsx        ← graded token list
    components/
      TopBar.tsx
      ui/                  ← Button, Badge, Card, StatCard, PageHeader, EmptyState, ...
    i18n/
      translations.ts      ← 'en' + 'ar' translation strings
      useLocale.ts
    types/
      electron.d.ts        ← global Window.api declaration
      assets.d.ts          ← *.png / *.svg module declarations
```

---

## Data Model (Prisma / SQLite)

```
User          id, email (UNIQUE, always lowercase), role (ADMIN|USER1), pwdHash, createdAt
ExamSession   id, title, year, semester?, isActive, createdAt → has many Exam, Barcode
Exam          id, sessionId, name, order, maxGrade (hundredths), step ('1'|'0.5'|'0.25'),
              passingGrade (hundredths), maxPassCount?, createdAt
              @@unique([sessionId, order])
Student       id, externalId (UNIQUE), name, createdAt → has many Barcode
Barcode       id, token (UNIQUE cuid2), studentId, sessionId, examId, createdAt
              @@unique([studentId, examId])   ← one barcode per student per exam
Grade         id, barcodeId (UNIQUE), value (hundredths int), gradedAt, gradedById?,
              isModified, originalValue?, modifiedById?, modifiedReason?, modifiedAt?
ChangeRequest id, requesterId, barcodeId, proposedValue, reason, status (PENDING|APPROVED|REJECTED)
AuditLog      id, actorId?, action, payload (JSON string), createdAt
AppConfig     id='singleton', orgName, orgNameAr,
              printTopMm, printLeftMm, printStickerW, printStickerH
              (print* fields drive Word table cell sizing — not exposed in UI)
```

Grade values are **always stored in hundredths of a unit** (e.g. 20.00 → 2000). `formatGrade(hundredths)` divides by 100 and `toFixed(2)`.

---

## Authentication & Roles

Two roles, two separate login flows on the same page:

| Role | How | Where used |
|---|---|---|
| `ADMIN` | Hardcoded email+password in `config.ts` (no DB row) | Full admin UI shell |
| `USER1` | DB row in User table, bcrypt password | Teacher UI shell |

- Admin credentials default to `admin@lba.lb` / `Admin2026!` — override via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars.
- Auth state is in-memory module `auth-state.ts` (survives until app restart).
- `requireAdmin()` in `guard.ts` wraps IPC handlers; returns `{ success: false, error: 'Permission denied' }` if role ≠ ADMIN.
- Session/teacher handlers are deliberately unauthenticated at the IPC level (both roles need read access to session info).

**Startup migration** (`db.ts:migrateLegacyUserRoles`): runs every launch via `app.whenReady()`. Normalises legacy `role` values (TEACHER, ADMIN_READONLY) → USER1, and lowercases all emails. Idempotent — safe to run repeatedly.

---

## IPC Architecture

```
Renderer (React) ──window.api.*──► Preload (contextBridge) ──ipcRenderer.invoke──► Main (handlers)
```

- Channels defined as string constants in `src/shared/ipc.ts` (`AdminChannels`, `TeacherChannels`, etc.)
- `window.api` type is `WindowAPI` from `src/shared/types.ts`
- Handlers in `src/main/ipc/` use `requireAdmin()` for admin-only operations
- Zod schemas in `ipc.ts` validate teacher-channel responses to enforce the anonymity contract

---

## Word Export (Barcode Stickers)

Triggered from `BarcodePrint.tsx → handleExportWord()` → `window.api.admin.exportBarcodesDocx()`.

Main-process handler in `src/main/index.ts`:
1. Reads `AppConfig` from DB for cell dimensions (default 48.5 × 16.9 mm = APLI ref. 1282)
2. Calls `buildBarcodesDocx(records, layout)` from `src/main/services/barcodeDocx.ts`
3. Opens save dialog → writes `.docx` → opens in Word via `shell.openPath`

`barcodeDocx.ts` logic:
- 4 columns × 17 rows per A4 page (2 stickers per row: barcode cell + text cell)
- Generates CODE128 PNG per token via `bwip-js.toBuffer()` (server-side, no DOM)
- Auto-centers table on A4 using `convertMillimetersToTwip()`
- Output: sticker grid ready to print at Actual Size / 100%

---

## Key Business Rules

- **One barcode per student per exam** (`@@unique([studentId, examId])`) — enforced at DB level.
- **Sessions hold multiple exams**; each exam has its own `maxGrade`, `step`, `passingGrade`, `maxPassCount`.
- **Grade validation** is authoritative on the server (`teacher.ts:SAVE_GRADE` checks value vs `exam.maxGrade`). The UI input range is a soft hint only.
- **maxPassCount**: if set, only the top-N passing candidates are admitted; the rest are `eligible_not_admitted`.
- **Grade modification** is admin-only (`MODIFY_GRADE`), records `originalValue`, `modifiedById`, `modifiedReason`, `modifiedAt`, and creates an `AuditLog` entry.
- **Anonymity boundary**: teacher-facing IPC handlers never return `studentName` or `externalId` — only tokens. Enforced by zod schemas on response objects.
- **Factory reset** (`RESET_SYSTEM`) clears all data except ADMIN/USER1 accounts; runs in a Prisma transaction.

---

## Build & Development Commands

```bash
npm run dev          # electron-vite dev (hot reload, runs prisma db push first)
npm run build        # electron-vite build → out/
npm run dist         # build + electron-builder → dist/win-unpacked/
npx tsc --noEmit -p tsconfig.web.json   # typecheck renderer
npx tsc --noEmit -p tsconfig.node.json  # typecheck main + preload
```

### Path Aliases

| Alias | Resolves to |
|---|---|
| `@shared/*` | `src/shared/*` (available in all three processes) |
| `@main/*` | `src/main/*` (main process only) |
| `@renderer/*` | `src/renderer/src/*` (renderer only) |

---

## Packaging Notes

- Builder config in `package.json` under `"build"` key.
- Target: `win` → `dir` (produces `dist/win-unpacked/`).
- `asar: false` — required so Prisma can access the bundled DB template.
- `extraResources` includes `prisma/qrecs.db` (template), `prisma/schema.prisma`, and Prisma client binaries.
- On first launch in packaged mode, `db.ts:ensureDatabaseExists()` copies the template DB to `userData`.
- Code signing is disabled (`cscLink: null`) — sign separately if needed.
- NSIS installer icon path: `src/renderer/src/assets/softretail-logo.png`.

---

## Known Constraints / Non-Obvious Decisions

- **SQLite in Electron**: `DATABASE_URL` is set at runtime (not build time) by `db.ts` because the path differs between dev and packaged modes.
- **`$executeRaw` for migration**: Prisma's typed client can't query non-existent models; raw SQL is used for the startup migration to avoid schema-generation issues.
- **AppConfig print fields still in schema/types**: `printTopMm/Left/StickerW/H` are retained in the DB and WindowAPI to drive Word export cell sizing. The Settings UI no longer exposes them; they stay at their DB defaults (48.5 × 16.9 mm).
- **Grade stored as integer hundredths**: avoids float rounding across the stack. All display uses `formatGrade()`.
- **Anonymity via zod parse**: `LookupTokenResponseSchema.parse(...)` on the server strips any accidental extra fields before sending to teacher clients.
- **`requireAdmin` generics**: Guard uses `Handler<TArg, TResult>` so call sites can type-narrow the IPC payload without fighting TypeScript's `unknown` spread.
