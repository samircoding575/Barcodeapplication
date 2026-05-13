# Project Briefing & Architecture: ScanGrade

**Version: 4.0 (Multi-Exam, Role Hierarchy & Audited Grading)**

This document is the single source of truth for the ScanGrade application. It covers the project's mission, design philosophy, and technical architecture.

---

## 1. The Story & Mission

**The "Why":** ScanGrade is a specialized desktop tool built for the **Lebanese Bar Association (نقابة المحامين في بيروت)**. Its core mission is to provide a secure, reliable, and anonymous system for grading the centralized bar examination, a high-stakes annual event.

**The Problem It Solves:** Traditional grading is slow, prone to human error, and can be subject to bias. This tool solves these problems by:
1.  **Ensuring Anonymity:** Examiners grade exam sheets identified only by a barcode, with no knowledge of the candidate's identity.
2.  **Increasing Efficiency:** A keyboard-and-scanner-driven workflow for examiners allows for rapid data entry.
3.  **Providing Powerful Analytics:** A comprehensive dashboard gives administrators deep insights into exam performance, helping them make fair and data-driven admission decisions.

---

## 2. UI/UX Philosophy

The application has three distinct user roles tailored to each role's needs.

#### **Admin Experience: Data-Driven Command Center**
*   **Goal:** Empower administrators with full control and deep insight.
*   **Two-Tier Hierarchy:**
    *   **Primary Admin:** Full read/write access. Can modify grades (with a mandatory reason), approve change requests, and manage system configuration.
    *   **Read-Only Admin:** Access to all analytics and reports, but cannot modify data directly. They can submit "Change Requests" for grades that require Primary Admin approval.
*   **Workflow:** Admins define **Exams** (up to 4 per Session) and their specific "Rules of Engagement" (Max Grade, Passing Grade, Entry Step).

#### **Examiner Experience: "Zero-Mouse" Efficiency**
*   **Goal:** Maximize speed and minimize cognitive load during the repetitive task of grading.
*   **Feel:** A focused, streamlined "heads-down" workspace.
*   **Automatic Enforcement:** The grading interface **automatically adapts** to the specific **Exam's** rules. If an exam is set to "Half-points", the input only allows 0.5 increments.

---

## 3. Technical Architecture

ScanGrade is an Electron application consisting of a Main process (Backend) and a Renderer process (Frontend).

#### **3.1. The Backend Engine (Main Process)**

*   **Database:** A local SQLite file managed by **Prisma ORM**.
    *   **Multi-Exam Model:** An `ExamSession` contains up to 4 `Exam` records. Each `Exam` defines its own grading rules.
    *   **Audited Grades:** The `Grade` table tracks `isModified`, `originalValue`, `modifiedReason`, and the `actorId` responsible for the change.
    *   **Change Requests:** A specialized workflow for read-only admins to propose grade corrections.
    *   **App Configuration:** Global system settings (Org name, etc.) stored in a singleton `AppConfig` table.
    *   **Audit Logging:** All critical system actions are recorded in an `AuditLog` table for accountability.
*   **Analytics Engine:** Performs all statistical calculations (mean, median, std dev) and admission classifications on the backend. It supports per-exam filtering and session-wide rollups.
*   **Export System:** Generates both CSV and high-fidelity Excel reports, including a signature block for formal sign-off.

#### **3.2. The Frontend Interface (Renderer Process)**

*   **Framework:** **React 18** built with **Vite**.
*   **Styling:** **Tailwind CSS**.
*   **State Management:** **Zustand** manages the user session, active exam session, and filtered exam context.
*   **Print System:** Optimized `print.css` ensures barcodes and token text are perfectly aligned (token immediately under barcode) for label printing.

#### **3.3. The Bridge: IPC & Role-Based Security**

*   **Role Guards:** All IPC handlers are protected by role-based middleware (`guard.ts`). Write operations are restricted to the Primary Admin.
*   **Anonymity Contract:** IPC channels for Examiners are strictly validated via Zod to never leak student identities.
*   **Error Handling:** Every single IPC handler in `src/main/ipc/` is wrapped in a `try...catch` block to prevent UI hangs.

---

## 4. Troubleshooting & Maintenance

*   **Database Migrations:** If the schema changes, run `npx prisma db push` to synchronize the local SQLite database.
*   **Grade Corrections:** All manual grade changes by admins require a reason and are flagged with a "Changed" badge in the UI for accountability.
*   **Print Alignment:** If barcode tokens are misaligned, check `.barcode-stack` in `print.css`.
