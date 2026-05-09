# Architecture Plan: ScanGrade

This document outlines the current architecture for the **ScanGrade** application, a specialized desktop tool for the **Lebanese Bar Association** to manage anonymous grading for their examinations.

## 1. Core Architecture

*   **Framework:** Electron + React (with TypeScript).
*   **Build System:** `electron-vite` for a modern, fast development experience.
*   **Styling:** Tailwind CSS.
*   **Database:** SQLite via Prisma ORM.
*   **State Management:** Zustand for lightweight global state (user session, active exam session).

## 2. Data Model (`prisma/schema.prisma`)

The architecture is built around a **multi-session model** to support different exam periods over time.

*   `User`: Stores credentials for Admins and Examiners (Employees). Passwords are hashed with `bcryptjs`.
*   `ExamSession`: The central organizing model. Each session (e.g., "Bar Exam 2024 - Fall") is a distinct container for barcodes and grades.
*   `Student`: A global record of a candidate, independent of any session.
*   `Barcode`: Represents a unique exam sheet. It links a `Student` to a specific `ExamSession`. This many-to-many relationship (`@@unique([studentId, sessionId])`) is the core of the multi-session design.
*   `Grade`: The grade for a specific `Barcode`.

## 3. Application Flow & UI

The application is split into two primary roles, each with a dedicated UI shell. Access is controlled by a new login system.

1.  **Authentication (`/src/renderer/src/routes/auth/`):**
    *   The app starts at a `LoginPage`.
    *   A segmented control allows switching between **Examiner** and **Admin** roles.
    *   **Examiner:** Can either Sign In or Create a New Account.
    *   **Admin:** Has a separate, single sign-in form.

2.  **Admin Shell (`AdminShell`):**
    *   `/sessions`: Create and manage different `ExamSession` records.
    *   `/candidates`: View all students. Manually add, delete, or import students from a file into the *active session*.
    *   `/barcodes`: A dashboard view to see all barcodes for the selected session, with filtering and stats. Includes a print function.
    *   `/results`: View the final, un-anonymized results for a session.

3.  **Examiner Shell (`ExaminerShell`):**
    *   `/grade`: A keyboard-optimized screen for scanning barcodes and entering grades for the *active session*.
    *   `/import`: A tool for batch-importing grades from a spreadsheet.
    *   `/history`: (Currently Unreachable) Intended to show past grading activity.

## 4. IPC Communication (`src/shared/ipc.ts`)

IPC channels are strictly namespaced by feature (`auth/`, `session/`, `admin/`, `teacher/`).

*   **Session-Awareness:** Most `admin` and `teacher` IPC calls now require a `sessionId` to ensure operations are performed in the correct context.
*   **Anonymity:** `teacher` channels are designed never to return student-identifying information, a contract enforced by Zod schemas.
*   **Error Handling:** All handlers in the main process are wrapped in `try...catch` blocks to prevent the UI from freezing on backend errors.

This architecture is robust, scalable, and provides a clear separation of concerns between different roles and exam sessions.
