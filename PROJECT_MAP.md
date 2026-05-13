# ScanGrade: Project Map & File Overview

This document provides a detailed directory of the ScanGrade codebase, explaining the responsibility of each file and how they contribute to the overall architecture.

---

## 1. Database Layer (`/prisma`)

The database is a local SQLite file managed by Prisma ORM. The architecture supports multiple sessions, each containing multiple exams.

#### **Table Overview & Relationships**

1.  **`ExamSession` (The Temporal Hub)**
    *   **Purpose:** Defines a specific exam period (e.g., "Bar Exam Fall 2026").
    *   **Relates to:** Has many `Exams`.

2.  **`Exam` (The Rule Hub)**
    *   **Purpose:** Defines a specific subject (e.g., "Civil Law") and its grading rules (`maxGrade`, `step`, `passingGrade`).
    *   **Relates to:** Belongs to an `ExamSession`. Has many `Barcodes`.

3.  **`Student` (Master Records)**
    *   **Purpose:** A global list of all candidates.
    *   **Relates to:** Linked to many `Barcodes` (one for each exam they are enrolled in).

4.  **`Barcode` (The Anonymous Link)**
    *   **Purpose:** Connects a student to a specific exam and stores their anonymous token.
    *   **Fields:** `id`, `token`, `studentId`, `sessionId`, `examId`.
    *   **Constraint:** A student has exactly one barcode per unique exam.

5.  **`Grade` (The Results)**
    *   **Purpose:** Stores numerical results and modification audit trails.
    *   **Audit Fields:** `isModified`, `originalValue`, `modifiedById`, `modifiedReason`, `modifiedAt`.
    *   **Relates to:** One-to-one link with a `Barcode`.

6.  **`ChangeRequest` (Review Workflow)**
    *   **Purpose:** Tracks proposed grade changes from Read-Only Admins for Primary Admin approval.
    *   **Fields:** `requesterId`, `barcodeId`, `proposedValue`, `status` (PENDING/APPROVED/REJECTED).

7.  **`AppConfig` (Global Settings)**
    *   **Purpose:** Singleton record for system-wide configuration (e.g., Organization name).

8.  **`AuditLog` (Traceability)**
    *   **Purpose:** Records critical system events and administrative actions.

9.  **`User` (Identity & Roles)**
    *   **Purpose:** Manages access for Primary Admin, Read-Only Admin, and Teacher roles.

---

## 2. Backend / Main Process (`/src/main`)

The backend is a Node.js environment responsible for security, file I/O, and database operations.

#### **Core Files**
*   **`index.ts`**: Registers all IPC handlers and creates the main window.
*   **`db.ts`**: Shared Prisma client singleton.
*   **`auth-state.ts`**: Manages session state and current user identity/role.

#### **IPC Handlers (`/src/main/ipc`)**
*   **`guard.ts`**: Role-based middleware to protect administrative actions.
*   **`admin.ts`**: Admissions engine, dashboard computation, grade modification, and Excel export.
*   **`auth.ts`**: Authentication logic and session initialization.
*   **`config.ts`**: System configuration management.
*   **`exam.ts`**: CRUD operations for exams within a session.
*   **`change-requests.ts`**: Workflow for submitting and resolving grade changes.
*   **`session.ts`**: Exam session management.
*   **`teacher.ts`**: Anonymous grading interface logic.

---

## 3. Frontend / Renderer Process (`/src/renderer/src`)

#### **Routes / Pages (`/src/renderer/src/routes`)**
*   **`admin/`**:
    *   `Dashboard.tsx`: KPI visualization with per-exam filtering and "Changed" grade indicators.
    *   `Sessions.tsx`: Management of sessions and their constituent exams.
    *   `Students.tsx`: Multi-exam enrollment and candidate management.
    *   `BarcodePrint.tsx`: Optimized label printing with tight barcode↔token alignment.
    *   `ChangeRequests.tsx`: Inbox for reviewing and approving grade corrections.
    *   `Reports.tsx`: Export hub for CSV and Excel (with signature blocks).
    *   `Settings.tsx`: Global organization and system preferences.
*   **`auth/`**:
    *   `LoginPage.tsx`: Primary entry point for all roles.
    *   `AdminLoginForm.tsx`: Secure login for administrative personnel.
*   **`teacher/`**:
    *   `Grade.tsx`: Rule-adaptive grading interface.
    *   `History.tsx`: Audit trail of recently submitted grades (anonymous).
    *   `Import.tsx`: Batch grade upload via CSV.

#### **State Management (`/src/renderer/src/store`)**
*   **`appStore.ts`**: Tracks `activeSession`, `activeExam`, and current user role.

---

## 4. Shared Layer (`/src/shared`)

*   **`types.ts`**: Interfaces for all entities, including updated `DashboardData` and `GradeResult`.
*   **`ipc.ts`**: Centralized channel definitions and Zod schemas for request validation.

---

## 5. Assets & Styles
*   **`styles/print.css`**: Strict sizing for label printing, ensuring text sits immediately under the barcode.
