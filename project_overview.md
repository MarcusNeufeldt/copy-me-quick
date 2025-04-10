# Project Overview: Copy Me Quick

**Goal:** Intelligently prepare and optimize codebases for interaction with Large Language Models (LLMs) by minimizing token count while preserving essential context. Solves LLM context window limitations and high token costs.

**Core Problem & Solution:** LLMs have token limits, making large codebases expensive or impossible to analyze fully. Copy Me Quick optimizes codebases via:
*   **Minification:** Reducing code size (whitespace, comments, simple transforms).
*   **Filtering:** Excluding irrelevant files/directories (e.g., `node_modules`, build artifacts) using presets and custom rules.
*   **Selective Copying:** User selection of specific files/folders via an interactive tree.
*   **Token Estimation:** Real-time feedback on token usage (`tiktoken`-based, though current `FileSelector` uses simpler estimation).

**Key Features:**
*   **Project Management:** Interactive file tree, framework-aware presets (Next.js, React, Vue, etc.), custom include/exclude filters.
*   **Token Optimization:** Real-time token count estimation & progress bar, optional code minification on copy.
*   **UI/UX:** Clean interface (Radix UI/Shadcn), drag/drop (`react-dropzone`), folder upload (`webkitdirectory`), responsive (Tailwind).
*   **Advanced:** Backup/Restore project state (`localStorage`, `JSZip`), Import/Export configurations (JSON).
*   **AI Smart Select:** (Experimental) API endpoint uses AI (OpenRouter) to suggest relevant files based on the project tree.

**Technical Architecture:**
*   **Framework:** Next.js 14 (App Router), React 18
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS 3.4, Shadcn UI (Radix UI components)
*   **Core Libraries:** `react-dropzone`, `JSZip`, `file-saver`, `tiktoken` (JS), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
*   **State Management:** Primarily React `useState`/`useEffect`, `localStorage` for persistence across sessions and backups.
*   **Deployment:** Vercel (includes Vercel Analytics)

---

**Project Structure:**

```
├── .eslintrc.json         # ESLint config (extends Next.js core-web-vitals)
├── .gitignore             # Standard Node/Next.js git ignore + logs, envs
├── README.md              # Original detailed README
├── app                    # Next.js App Router directory
│   ├── api                # API route handlers
│   │   ├── ai-smart-select # API for AI-based file selection
│   │   │   └── route.ts    # Handler logic (calls OpenRouter, logs)
│   │   └── analyze        # API for analyzing codebase (potentially unused/legacy)
│   │       └── route.ts    # Handler logic (reads local path - likely server context only)
│   ├── favicon.ico        # Site favicon
│   ├── globals.css        # Global CSS, Tailwind directives, CSS variables
│   ├── layout.tsx         # Root layout component
│   └── page.tsx           # Main application page component (client-side)
├── codebase-reader.code-workspace # VS Code workspace config
├── components.json        # Shadcn UI configuration
├── components             # React components
│   ├── AnalysisResult.tsx # Displays summary, token usage, selected file tree
│   ├── BackupManagement.tsx # Handles state backup, restore (zip download), import/export
│   ├── FileSelector.tsx     # Interactive file tree, selection logic, copy-to-clipboard, minification toggle, token estimation (basic)
│   ├── FileUploadSection.tsx # Handles folder upload, filtering, file reading, progress, initial processing
│   ├── ProjectSelector.tsx  # Dropdown for project type presets, integrates template editor
│   ├── ProjectTemplateEditor.tsx # Sheet UI for editing project presets (localStorage)
│   ├── tiktoken.md        # Notes on using the tiktoken library
│   ├── types.ts           # Core TypeScript type definitions (AppState, FileData, etc.)
│   └── ui                 # Shadcn UI primitive components (Button, Card, Dialog, etc.)
├── global.d.ts            # Global type declarations (e.g., for WASM)
├── lib                    # Utility functions
│   └── utils.ts           # `cn` utility for Tailwind class merging
├── next.config.js         # Next.js configuration (includes WebAssembly setup)
├── next.config.mjs        # Minimal Next.js config (potentially redundant?)
├── package-lock.json      # Dependency lockfile
├── package.json           # Project dependencies and scripts
├── postcss.config.mjs     # PostCSS configuration (for Tailwind)
├── public                 # Static assets served publicly
│   ├── next.svg
│   └── vercel.svg
├── server                 # Python server code (likely unused by core Next.js app)
│   └── main.py
├── tailwind.config.ts     # Tailwind CSS theme and plugin configuration
├── tsconfig.json          # TypeScript compiler configuration
└── utils                  # Python utility code (likely unused by core Next.js app)
    └── tokenizer.py
```

---

**Core Components & Logic Flow:**

1.  **`app/page.tsx`:**
    *   Main entry point, renders UI structure.
    *   Manages top-level state (`AppState`) using `useState`, persisted in `localStorage`.
    *   Initializes `defaultProjectTypes` and loads custom ones from `localStorage`.
    *   Orchestrates child components (`ProjectSelector`, `FileUploadSection`, `AnalysisResult`, `BackupManagement`).
2.  **`ProjectSelector.tsx`:**
    *   User selects a project type (e.g., "Next.js").
    *   Updates `AppState` with corresponding `excludeFolders` and `fileTypes`.
    *   Allows editing presets via `ProjectTemplateEditor.tsx`.
3.  **`FileUploadSection.tsx`:**
    *   User clicks "Choose Project Folder" (triggers `input[type=file][webkitdirectory]`).
    *   Browser prompts for folder selection.
    *   Reads selected files client-side.
    *   Filters files based on `excludeFolders` and `fileTypes` from `AppState`.
    *   Reads content of valid files (`file.text()`).
    *   Calculates lines, generates basic `project_tree` string.
    *   Updates `AppState` with `analysisResult` containing `files` array (`FileData[]`) and summary.
    *   Calls `onUploadComplete`.
4.  **`AnalysisResult.tsx`:**
    *   Displays summary data (file/line counts for *selected* files).
    *   Shows token usage bar based on `tokenCount` state (updated by `FileSelector`).
    *   Renders a visual tree (`ProjectTree` internal component) of *selected* files.
    *   Renders the `FileSelector` component.
5.  **`FileSelector.tsx`:**
    *   Receives the full list of processed files (`analysisResult.files`).
    *   Builds and displays an interactive tree structure (`FileTreeNode`).
    *   Handles checkbox selection/deselection for files and folders (propagating changes).
    *   Updates `selectedFiles` array in `AppState` via callback.
    *   Estimates token count for selected files (currently basic word count * 1.2) and calls `onTokenCountChange`.
    *   Provides "Copy" button which:
        *   Generates a text representation of the selected file tree.
        *   Concatenates content of selected files (optionally minified via `minifyCode` function).
        *   Copies the combined text to the clipboard.
6.  **`BackupManagement.tsx`:**
    *   Provides UI (Sheet) to create, restore (download as zip), delete backups stored in `AppState.backups` (persisted via `localStorage`).
    *   Handles full state export/import as JSON.

**API Endpoints:**

*   `POST /api/analyze`: (Potentially unused/legacy) Accepts `{ path: localPath }`, attempts to read directory contents. Unlikely to work as intended from the client without direct filesystem access.
*   `POST /api/ai-smart-select`: Accepts `{ projectTree: string }`, sends the tree structure to OpenRouter AI (`openai/o1-mini-2024-09-12`) asking for important file paths. Returns `{ selectedFiles: string[] }`.
    *   **Security Warning:** Uses a hardcoded `OPENROUTER_API_KEY` directly in the source file - **MAJOR VULNERABILITY**.
    *   Includes basic file logging under `/logs/ai-smart-select.log`.

**Setup & Run (Development):**

1.  `git clone https://github.com/MarcusNeufeldt/copy-me-quick.git`
2.  `cd copy-me-quick`
3.  `npm install` (or yarn/pnpm)
4.  `npm run dev`
5.  Open `http://localhost:3000`

**Key Configuration Files:**

*   `next.config.js`: Next.js settings, WebAssembly config.
*   `tailwind.config.ts`: Tailwind CSS customization.
*   `tsconfig.json`: TypeScript settings.
*   `components.json`: Shadcn UI component configuration.

