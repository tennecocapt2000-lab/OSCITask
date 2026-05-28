# OS&CI Task Scheduler - Manufacturing Workspace

A production-ready, lightweight, cloud-based **OS&CI Task Scheduler** web application designed for manufacturing operations. 

This application offers dual-layer connectivity: it integrates directly with a real-time **Supabase Cloud Database** for corporate team syncing and storage, and provides a **zero-configuration Offline Demo Sandbox** to explore all features instantly without cloud setup!

---

## 🚀 Key Features

*   **Employee Code Authentication**: Simple and secure login using standard Employee Codes (`EMP001`, `EMP002`, etc.) with a secure emergency bypass using an Administrator PIN (Default: `778899`).
*   **Excel-Like Workbook Scheduler**: Inline interactive grid featuring auto-calculating WBS trees (`1`, `1.1`, `1.2`), collapsible nodes, column customizations, and drag-and-drop sort reordering.
*   **Dynamic Custom Gantt Chart**: Blazing-fast HTML & CSS Grid Gantt chart synchronized with workbook rows. Supports dragging bars to reschedule and dragging boundaries to adjust durations.
*   **PostgreSQL Bubble-Up Rollups**: Automated SQL triggers dynamically roll up dates (MIN/MAX), average progress, and status indicators from leaf nodes to parent tasks and to the global projects register.
*   **Compression Evidence Uploader**: HTML5 drag-and-drop file uploader featuring **pre-flight Canvas image compression** that shrinks images on the client side before cloud upload to preserve performance.
*   **Apple-Inspired Dark & Light Interface**: Stunning premium glassmorphic theme incorporating professional multi-lingual typography (`IBM Plex Sans Thai`, `Inter`, `Noto Sans Thai`).

---

## 📂 File Architecture

*   `index.html` - Base structural layout, modal declarations, CDNs, and stylesheet references.
*   `style.css` - Custom design system, Apple typography tokens, grid calculations, scrollbars, and micro-animations.
*   `app.js` - logical core mapping the SPA router, inline cell handlers, custom Gantt bindings, Canvas compression algorithms, and cloud connection interfaces.
*   `database.sql` - Complete Postgres setup script containing definitions for all 8 tables, indices, RLS policies, and recursive rollup triggers.

---

## 🛠️ Step-by-Step Installation

### Option A: Zero-Configuration Sandbox (Instant Preview)
1. Double-click the `index.html` file to open it directly in any modern desktop browser (Chrome, Edge, Safari, Firefox).
2. The system detects no active credentials and shows the **Connect Your Supabase Project** screen.
3. Click the **"Use Offline Demo Sandbox"** button to load a standard offline dataset directly in your browser's `localStorage`!
4. Log in using any demo code:
    *   `EMP001` (OSCI_ADMIN - Full rights)
    *   `EMP002` (MANAGER - Production lead)
    *   `EMP003` (OWNER - Quality planner)
    *   `EMP004` (OWNER - Logistics lead)
    *   `EMP005` (VIEWER - Read-only reviewer)
    *   *Or click the footer link and enter PIN `778899` to enter as Emergency Admin!*

### Option B: Cloud Database Configuration (Supabase)
To establish a shared cloud environment for your manufacturing plants:

1.  **Set Up a Supabase Project**:
    *   Create a free account on [Supabase](https://supabase.com/).
    *   Create a new project (e.g., `OSCI-Scheduler`).
2.  **Deploy the Schema**:
    *   Navigate to your Supabase project dashboard.
    *   Open the **SQL Editor** from the left-side menu.
    *   Click **"New Query"**, paste the entire contents of `database.sql` into the editor, and click **"Run"**. This automatically creates all 8 tables, indexes, RLS policies, recursive triggers, and seeds your employee profiles.
3.  **Create the Storage Bucket**:
    *   Go to **Storage** in the Supabase sidebar.
    *   Click **"New Bucket"**, name it exactly `task-evidence`, and toggle **Public** to `ON` (or set a storage policy permitting read-write).
4.  **Connect the App**:
    *   Double-click `index.html` locally.
    *   On the configuration modal, paste your **Supabase API URL** and **Public Anon Key** (found in your Supabase Project Settings -> API).
    *   Click **"Connect & Synchronize"**.
    *   Log in using the seed credentials (e.g. `EMP001` with Admin PIN backup). Your local browser is now connected directly to the live PostgreSQL cloud!
