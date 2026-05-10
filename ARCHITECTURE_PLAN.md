# Project Briefing & Architecture: ScanGrade

**Version: 3.0 (Multi-Session Grading & Analytics Refactor)**

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

The application has two distinct user experiences tailored to each role's needs.

#### **Admin Experience: Data-Driven Command Center**
*   **Goal:** Empower administrators with full control and deep insight.
*   **Feel:** A professional, data-rich dashboard. The admin should feel like they are at the command center of the examination process.
*   **Workflow:** Admins define the "Rules of Engagement" (Max Grade, Passing Grade, Entry Step) at the **Session** level. They then analyze the impact of these rules on the **Dashboard**.

#### **Examiner Experience: "Zero-Mouse" Efficiency**
*   **Goal:** Maximize speed and minimize cognitive load during the repetitive task of grading.
*   **Feel:** A focused, streamlined "heads-down" workspace.
*   **Automatic Enforcement:** The grading interface **automatically adapts** to the active session's rules. If a session is set to "Half-points", the input only allows 0.5 increments. This removes the need for manual toggles (like the old F2 decimal mode).

---

## 3. Technical Architecture

ScanGrade is an Electron application, which means it consists of two distinct parts running concurrently.

#### **3.1. High-Level View**

*   **Main Process (The "Backend"):** A Node.js environment. It has access to the computer's file system and runs all database operations. It is the "engine" of the application.
*   **Renderer Process (The "Frontend"):** A Chromium browser environment where the React application runs. It is the "face" of the application. It has no direct access to the backend; all communication happens via IPC.

#### **3.2. The Backend Engine (Main Process)**

*   **Database:** A local SQLite file managed by **Prisma ORM**.
    *   **Per-Session Configuration:** The `ExamSession` table stores all grading rules: `maxGrade`, `passingGrade`, `maxPassCount`, and `step` (the precision of grade entry).
*   **Analytics & Admissions Engine:** Resides in the `getDashboardData` IPC handler. It performs all statistical calculations (mean, median, std dev) and admission classifications on the backend to keep the UI responsive.

#### **3.3. The Frontend Interface (Renderer Process)**

*   **Framework:** **React 18** built with **Vite**.
*   **Styling:** **Tailwind CSS**.
*   **State Management:** **Zustand** manages the user session and the active exam session.
*   **Print System:** Uses a specialized `print.css` with strict `mm` sizing and flexbox layout to ensure barcodes print perfectly on label sheets without being cut off by page breaks.

#### **3.4. The Bridge: IPC & Security**

*   **Anonymity Contract:** IPC channels for Examiners are strictly validated via Zod to never leak student identities.
*   **Error Handling:** Every single IPC handler in `src/main/ipc/` is wrapped in a `try...catch` block. This is **critical**: it ensures that a database error never causes the frontend to hang or crash.

---

## 4. Troubleshooting & Maintenance

*   **Logout Errors:** The logout process is managed by `AuthChannels.LOGOUT`. If the app crashes on sign-out, verify the `setCurrentUserId(null)` logic in `src/main/auth-state.ts`.
*   **Database Migrations:** If the schema changes, run `npx prisma db push` to synchronize the local SQLite database.
