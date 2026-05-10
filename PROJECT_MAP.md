# ScanGrade: Project Map & File Overview

This document provides a detailed directory of the ScanGrade codebase, explaining the responsibility of each file and how they contribute to the overall architecture.

---

## 1. Database Layer (`/prisma`)

The database is a local SQLite file managed by Prisma ORM.

*   **`schema.prisma`**: The master blueprint for all data.
    *   `User`: Manages credentials and roles (ADMIN vs. TEACHER).
    *   `ExamSession`: The central hub. Stores grading rules (Max Grade, Step, Passing Grade) for a specific period.
    *   `Student`: Global records of candidates.
    *   `Barcode`: The "Join Table." Links a Student to a specific Session and stores their unique token.
    *   `Grade`: Stores the final numerical value for a Barcode.
    *   `AppConfig`: Global singleton for organizational details (e.g., Association Name).

---

## 2. Backend / Main Process (`/src/main`)

The backend is a Node.js environment responsible for security, file I/O, and database operations.

#### **Core Files**
*   **`index.ts`**: The application entry point. Handles window creation and registers all IPC handlers.
*   **`db.ts`**: A singleton utility that provides a single, shared instance of the Prisma client.
*   **`auth-state.ts`**: Manages the current logged-in user's state on the backend.
*   **`config.ts`**: Stores static system configurations and admin credentials.

#### **IPC Handlers (`/src/main/ipc`)**
*   **`admin.ts`**: The "Admissions Engine." Handles dashboard analytics calculations and manual student management.
*   **`auth.ts`**: Manages the secure login, signup, and logout flows.
*   **`session.ts`**: Provides APIs for creating, listing, and activating exam sessions.
*   **`teacher.ts`**: Handles the grading workflow, ensuring candidate anonymity.

#### **Services (`/src/main/services`)**
*   **`auth.ts`**: Contains the logic for password hashing and verification.
*   **`import.ts`**: Handles the complex logic for reading Excel/CSV files and upserting data.
*   **`barcode.ts`**: Logic for batch-generating unique identifiers for candidates.

---

## 3. Frontend / Renderer Process (`/src/renderer/src`)

The frontend is a React 18 application styled with Tailwind CSS.

#### **Core UI Structure**
*   **`App.tsx`**: The Master Router. It detects the user's role and renders either the `AdminShell` or `ExaminerShell`.
*   **`main.tsx`**: The React DOM entry point.
*   **`store/appStore.ts`**: The global state (Zustand). Remembers who is logged in and which exam session is currently active.

#### **UI Components (`/src/renderer/src/components`)**
*   **`TopBar.tsx`**: The primary navigation header that changes based on the user's role.
*   **`ui/`**: Atomic, reusable design elements:
    *   `Button.tsx`, `Card.tsx`, `Badge.tsx`: Core visual primitives.
    *   `PageHeader.tsx`: Standardized headers for all pages.
    *   `StatCard.tsx`: The data-rich cards used on the dashboard.
    *   `EmptyState.tsx`: Friendly fallback UI for when no data exists.

#### **Routes / Pages (`/src/renderer/src/routes`)**
*   **`auth/`**: Login pages for Admins and Employees.
*   **`admin/`**:
    *   `Dashboard.tsx`: Data visualization hub (KPIs, Charts, Rankings).
    *   `Sessions.tsx`: Configuration hub for defining exam rules.
    *   `Students.tsx`: Candidate management (Import/Add/Delete).
    *   `BarcodePrint.tsx`: Optimized view for generating and printing labels.
*   **`teacher/`**:
    *   `Grade.tsx`: The "Zero-Mouse" grading interface.
    *   `Import.tsx`: Tool for batch-importing grades from external files.
    *   `History.tsx`: Anonymous progress tracker.

---

## 4. Shared Layer (`/src/shared`)

This layer ensures that both the frontend and backend speak the same language.

*   **`types.ts`**: The definitive list of TypeScript interfaces. Every object passed between the UI and the Database is defined here.
*   **`ipc.ts`**: Defines the names of the "communication pipes" (channels) used to send data between processes.

---

## 5. Assets & Styles
*   **`styles/print.css`**: Specialized CSS that controls exactly how barcodes appear on physical paper.
*   **`assets/`**: Contains the official branding and logos.
