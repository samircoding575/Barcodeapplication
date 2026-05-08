# 📊 Project Mission: QR-Based Exam Correction System (QRECS)
A desktop tool for anonymous university grading. Admins manage student identities and generate QR codes; Teachers perform high-speed, identity-blind grading via physical scans or dynamic file imports.

# 👥 Roles & Permissions
- **Admin:** Import students, generate QR codes, manage exams, export reports, and view identity-mapped results.
- **Teacher:** Identity-blind access. Can scan physical QR codes or dynamically import grade files containing QR identifiers.

# 🛠️ Tech Stack
- **Framework:** Electron + React.
- **Database:** SQLite (via `better-sqlite3` and `Prisma`).
- **Utilities:** `qrcode` (for generation), `jsQR` or native input (for scanning).
- **Architecture:** Main process handles DB/File I/O; Renderer handles UI/State.

# 🔄 Critical Workflows
1. **Admin Import:** CSV/Excel (ID, Name) -> DB -> Batch QR Generation.
2. **Teacher Grading:** 
   - Mode A (Manual): Scan QR -> Focus Grade Input -> Submit -> Auto-reset.
   - Mode B (Dynamic): Import external grade files mapped to QR identifiers.
3. **Export Panel:** Admin-only dashboard for CSV/PDF reports (Unmasked data).

# 🚫 Strict Constraints
- **Anonymity Lock:** No student names in Teacher-role components or IPC channels.
- **Zero-Mouse Grading:** The teacher workflow must prioritize keyboard/scanner speed.
- **Modular DB:** Schema must be Prisma-compliant to allow future PostgreSQL migration.