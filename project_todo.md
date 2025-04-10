## Project TODO List

**Priority Order:** Address critical security issues first, then focus on core functionality improvements and high-value UX features.

**Legend:**
- `[x]` Done
- `[-]` In Progress
- `[ ]` To Do

### Security & Critical Issues:

0.  **`[x]` CRITICAL RUNTIME ERROR:** Application fails to render with `Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.` pointing to `ClientPageRoot`.
    *   **Status:** Fixed. Error was due to issues with the tiktoken library import in FileSelector.tsx.
    *   **Resolution:** 
        *   Renamed main component from CodebaseReader to ClientPageRoot to match what Next.js was expecting.
        *   Removed direct tiktoken library dependency and implemented a simpler character-based token estimation method.
        *   Made the Analytics component import safely with error handling using dynamic imports.

1.  **`[x]` Hardcoded API Key:** The `OPENROUTER_API_KEY` in `/app/api/ai-smart-select/route.ts` was exposed directly.
    *   **Fix:** Moved the API key to environment variables (`process.env.OPENROUTER_API_KEY`). Added a check in the API route to ensure the variable is set.
    *   **Note:** Requires setting `OPENROUTER_API_KEY` in `.env.local` for development and Vercel environment variables for deployment.

2.  **`[x]` /api/analyze Endpoint:** This endpoint appeared unused and potentially insecure.
    *   **Fix:** Confirmed the endpoint was not used by the frontend (`grep`). Deleted the handler file `app/api/analyze/route.ts`. (Attempted to delete the empty directory but encountered issues; harmless.)

### Core Functionality & Accuracy:

3.  **`[x]` Token Estimation Accuracy:** The `FileSelector.tsx` previously used a basic word-count estimation.
    *   **Fix:** Integrated `js-tiktoken` library. Uses `getEncoding("cl100k_base")` asynchronously. Token calculation now uses `tokenizer.encode(content).length` for accurate counts based on OpenAI's standard encoding. Added loading states for tokenizer initialization and calculation.

4.  **`[x]` Minification Robustness:** The custom `minifyCode` function in `FileSelector.tsx` uses complex regex. This is prone to errors, might break code (especially edge cases or different languages), and is likely less effective than established tools.
    *   **Resolution:** Simplified the `minifyCode` function to only remove comments (multi-line, single-line) and basic whitespace (leading/trailing on lines, blank lines). Removed the more complex and potentially unsafe regex transformations.

### User Experience (UX) & Features:

5.  **`[x]` AI Smart Select Integration:** The API endpoint `/api/ai-smart-select` existed, but lacked UI integration.
    *   **Fix:** Added an "AI Suggest Files" button (`Brain` icon) to the `FileSelector` header. This button calls the API with the project tree, displays loading/error states, filters the AI's response to ensure file paths are valid within the current context, and updates the file selection via `setSelectedFiles`.

6.  **`[x]` Client-Side Processing Feedback:** Processing many files in `FileUploadSection.tsx` can take time and might freeze the browser tab temporarily. The progress bar helps, but more could be done.
    *   **Resolution:** Added a new state variable `processingStatus` to `FileUploadSection.tsx`. This state is updated during the `processFiles` loop to show messages like "Initializing...", "Skipping excluded: ...", "Reading: ...", "Generating project tree...", and "Finalizing...". This status is displayed next to the loading spinner, providing more granular feedback.

7.  **`[ ]` File Preview:** Users select files based only on name and path. Seeing the content is essential for making informed decisions.
    *   **Improvement:** Add a file preview panel. When a file node in `FileSelector` is clicked (not the checkbox), display its content (or the first N lines for large files) in a read-only section.

8.  **`[ ]` Project Template Creation:** The `ProjectTemplateEditor` allows editing existing presets but not easily creating new ones from scratch via the UI.
    *   **Improvement:** Add a "Create New Template" button or option.

### Code Quality & Maintainability:

9.  **`[ ]` State Management:** Prop drilling state, `setState`, and `updateCurrentProject` through multiple levels (`page.tsx` -> `FileUploadSection`, `AnalysisResult`, `BackupManagement` -> `FileSelector`) can become complex.
    *   **Improvement:** Consider a lightweight state management library like Zustand or Jotai, or React Context if preferred, to simplify state access and updates, especially given the `localStorage` persistence.

10. **`[ ]` Redundant/Unused Code:**
    *   `next.config.mjs` seems redundant given `next.config.js`. Consolidate.
    *   The Python code in `server/` and `utils/` seems disconnected from the Next.js application. If it's legacy or unused, remove it to simplify the repository.

11. **`[ ]` Type Consistency:** Ensure consistent use of defined types from `components/types.ts` throughout the application.


---
*Original Note: Addressing the security issue (#1) is paramount. After that, improving token accuracy (#3) and integrating the AI feature (#5) would significantly enhance the core value proposition.*