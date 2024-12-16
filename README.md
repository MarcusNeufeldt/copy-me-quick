# 🚀 Copy Me Quick: Your Bridge to LLM Code Understanding

> Efficiently prepare and copy codebases to LLMs. Copy Me Quick intelligently optimizes your code, minimizing token usage while preserving context for superior AI interactions.

[![Live Demo](https://img.shields.io/badge/demo-online-green.svg)](https://copymequick.vercel.app/)
[![GitHub](https://img.shields.io/badge/github-repo-black.svg)](https://github.com/MarcusNeufeldt/copy-me-quick)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/MarcusNeufeldt/copy-me-quick/actions/workflows/main.yml/badge.svg)](https://github.com/MarcusNeufeldt/copy-me-quick/actions/workflows/main.yml)  <!-- Add if you have CI/CD -->

**Try it now:** [copymequick.vercel.app](https://copymequick.vercel.app/)

## 🧐 What is Copy Me Quick?

Copy Me Quick is a web application designed to streamline the process of sharing code with Large Language Models (LLMs). It tackles the challenge of LLM context window limitations by intelligently processing and optimizing your codebase. This ensures that you can effectively leverage the power of AI for code analysis, understanding, and generation, even with large projects.

### The Problem: LLM Token Limits

LLMs have a limited "context window," typically measured in tokens. Feeding them a raw codebase often leads to:

*   **Input Truncation:** The LLM only sees a fraction of your code, resulting in incomplete analysis.
*   **Exorbitant Costs:** Processing more tokens can be significantly more expensive.
*   **Inefficient Use of Tokens:**  Non-essential parts of the code waste valuable tokens.

### The Solution: Intelligent Code Optimization

Copy Me Quick solves this by:

*   **Minifying code:** Reducing code size without altering functionality.
*   **Filtering irrelevant files:** Excluding non-essential directories like `node_modules` or build artifacts.
*   **Providing selective copying:** Allowing you to choose specific files or folders to focus on.
*   **Estimating token usage:** Giving you a clear picture of your context window consumption.

## ✨ Key Features

*   **📁 Smart Project Management:**
    *   **Interactive File Tree:**  Easily navigate and select files/folders with a visual, hierarchical representation.
    *   **Framework-Aware Presets:** Automatically exclude irrelevant files and folders for popular frameworks like Next.js, React, Vue, Angular, and more.
    *   **Customizable Filters:** Fine-tune your selection by adding your own include/exclude patterns.

*   **🔢 Token Optimization:**
    *   **Real-time Token Estimation:**  Accurately predict token usage using `tiktoken`.
    *   **Token Usage Visualization:**  A progress bar dynamically shows your token consumption relative to the LLM's limit.
    *   **Minification:** Reduce code size (and token count) by removing whitespace, comments, and shortening identifiers where possible.

*   **🎨 Modern & User-Friendly Interface:**
    *   **Clean Design:** Built with reusable Radix UI components for a consistent and accessible experience.
    *   **Intuitive Interactions:** Effortlessly select, include, or exclude files and folders.
    *   **Helpful Feedback:** Clear progress indicators, informative tooltips, and error messages guide you.
    *   **Responsive Layout:** Adapts seamlessly to different screen sizes thanks to Tailwind CSS.

*   **🔄 Advanced Features:**
    *   **Backup & Restore:** Save and load multiple project states to quickly switch between different analysis scenarios.
    *   **Export/Import:** Share your project configurations as JSON files for collaboration or reproducibility.

## 🛠️ Technical Stack

*   **[Next.js 14](https://nextjs.org/):** React framework for server-side rendering and static site generation.
*   **[React 18](https://react.dev/):** JavaScript library for building user interfaces.
*   **[TypeScript](https://www.typescriptlang.org/):**  Adds static typing to JavaScript for better code maintainability.
*   **[Tailwind CSS 3.4](https://tailwindcss.com/):** Utility-first CSS framework for rapid UI development.
*   **[Radix UI](https://www.radix-ui.com/):**  Accessible and unstyled component library.
*   **[react-dropzone](https://react-dropzone.js.org/):**  Simple React hook for file drops.
*   **[JSZip](https://stuk.github.io/jszip/):** Create, read, and edit zip archives.
*   **[tiktoken](https://www.npmjs.com/package/tiktoken):**  Byte pair encoding tokenization library used by OpenAI.
*   **[Vercel Analytics](https://vercel.com/analytics):**  Track website traffic and performance.
*   **Deployment:** [Vercel](https://vercel.com/)

## 🚀 Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version recommended)
*   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/) or [pnpm](https://pnpm.io/)

### Installation

1. **Clone the repository:**

    ```bash
    git clone https://github.com/MarcusNeufeldt/copy-me-quick.git
    cd copy-me-quick
    ```

2. **Install dependencies:**

    ```bash
    npm install  # Or yarn install or pnpm install
    ```

### Development

1. **Start the development server:**

    ```bash
    npm run dev  # Or yarn dev or pnpm dev
    ```

2. **Open your browser:**

    Visit `http://localhost:3000`

### Build

1. **Create a production build:**

    ```bash
    npm run build  # Or yarn build or pnpm build
    ```

2. **Start the production server:**

    ```bash
    npm start # or yarn start or pnpm start
    ```
## 💡 Usage Guide

1. **Select a Project Type:**
    *   Choose a preset based on your project's framework (Next.js, React, Vue, etc.).
    *   Select "None" to manually configure filters.

2. **Choose Your Project Folder:**
    *   Click the "Choose Project Folder" button and select the root directory of your codebase.

3. **Fine-Tune Your Selection:**
    *   Use the interactive file tree to include or exclude specific files or folders.
    *   Expand and collapse folders to navigate the project structure.

4. **Enable Minification (Optional):**
    *   Toggle the "Minify" option to reduce the token count of your code.

5. **Copy to Clipboard:**
    *   Click the "Copy" button to copy the processed codebase to your clipboard.
    *   The copied content will include:
        *   A structured representation of your project's file tree.
        *   The minified (if enabled) or original source code of the selected files.

6. **Paste into Your LLM:**
    *   Paste the copied content into your favorite LLM interface (e.g., ChatGPT, Claude).

7. **Craft Your Prompt:**
    *   Provide clear instructions to the LLM, referencing the copied project structure and code.
    *   Example:

```
Here's my project structure:

[Paste Project Structure]

Here's the code for selected files:

[Paste Selected Files]

My goal is to: [Describe your task, e.g., "Refactor this component to use hooks," "Find potential security vulnerabilities," "Generate documentation for this API."]
```

## 🔧 Configuration

*   **`next.config.js`:**  Configuration for Next.js (server-side rendering, etc.).
*   **`tailwind.config.ts`:**  Configuration for Tailwind CSS (styling, theming).
*   **`tsconfig.json`:** Configuration for TypeScript (type checking, compiler options).
*   **`components.json`:** Configuration for UI components (Shadcn/Radix).

## 📄 License

This project is licensed under the [MIT License](LICENSE).


