## Implementation Plan: "Refresh Project" Feature

**1. Goal:**

To allow users to update the content of their loaded project files directly from their local disk after making edits, without losing their current file/folder selections within the application UI. This eliminates the need to manually re-select files after each code change cycle.

**2. User Workflow:**

1.  User uploads a project folder initially using "Choose Project Folder".
2.  User selects specific files/folders for analysis/copying in the `FileSelector`.
3.  User copies code, gets LLM suggestions, and makes edits to the files *locally* in their code editor.
4.  User returns to the "Copy Me Quick" application.
5.  User clicks the new "Refresh Project" button.
6.  The browser prompts the user to select a folder (using the standard `webkitdirectory` prompt).
7.  User selects the *exact same* project folder they originally uploaded.
8.  The application processes the folder's contents, updating the internal representation of the files.
9.  The application preserves the user's existing file/folder selections from step 2.
10. The `FileSelector` UI updates to show the latest file content (implicitly, as the underlying data changes) while maintaining the checkbox states. The token count and project summary also update.
11. User can now copy the *updated* selected code.

**3. Technical Approach:**

Leverage the existing file input mechanism but trigger it via a new button. Modify the file processing logic to perform an update operation (add new files, update existing content, remove deleted files) while explicitly preserving the `selectedFiles` state.

**4. Implementation Steps:**

**4.1. UI Changes (`FileUploadSection.tsx`)**

*   **Add Refresh Button:**
    *   Introduce a new `Button` component next to or near the "Choose Project Folder" button.
    *   Label: "Refresh Project"
    *   Icon: Use `RefreshCw` from `lucide-react`.
    *   **State:** The button should be `disabled` if `state.analysisResult` is `null` (i.e., no project has been loaded yet). Enable it once `state.analysisResult` exists.
*   **Button Action:**
    *   The `onClick` handler for the "Refresh Project" button should programmatically trigger a click on the *existing* hidden file input:
        ```javascript
        const handleRefreshClick = () => {
            // Optional: Set a flag to indicate refresh mode if needed internally
            document.getElementById('fileInput')?.click();
        };
        ```

**4.2. Modify File Processing Logic (`FileUploadSection.tsx`)**

*   **Refactor `processFiles` (or create `updateFiles`):** The core logic needs to handle updates intelligently.
    *   **Input:** The function receives the `FileList` from the input event.
    *   **Access Current State:** Ensure the function has access to the *current* application state (`state.analysisResult.files` and `state.selectedFiles`).
    *   **Build New File List:** Instead of starting `fileContents: FileData[] = []`, create a map or temporary structure to store the *newly processed* files.
        ```typescript
        const newFileContentsMap = new Map<string, FileData>();
        const currentFilesMap = new Map(state.analysisResult?.files.map(f => [f.path, f]) ?? []);
        let totalFiles = 0;
        let totalLines = 0;
        ```
    *   **Process Input Files:** Loop through the `files` from the input event:
        *   Apply existing filters (`excludedFolders`, `allowedFileTypes`).
        *   For each valid `file` with `relativePath`:
            *   Read its `content` and calculate `lines`.
            *   Create a `newFileData` object.
            *   Add it to `newFileContentsMap.set(relativePath, newFileData)`.
            *   Update `totalFiles` and `totalLines` counters based on *all* processed valid files (not just selected ones).
    *   **Generate Final `files` Array:** Convert `newFileContentsMap` back into an array: `const finalFiles: FileData[] = Array.from(newFileContentsMap.values());`
    *   **Update Summary & Tree:** Recalculate `summary` and `project_tree` based on `finalFiles`.
        ```typescript
        const newSummary = { total_files: totalFiles, total_lines: totalLines };
        const newProjectTree = generateProjectTree(finalFiles); // Ensure generateProjectTree uses the new list
        ```

**4.3. State Preservation (`FileUploadSection.tsx`)**

*   **Handle Deleted Files in Selection:** Before updating the main state, reconcile the existing `state.selectedFiles` with the `newFileContentsMap`.
    ```typescript
    const preservedSelectedFiles = state.selectedFiles.filter(selectedPath =>
        newFileContentsMap.has(selectedPath)
    );
    ```
*   **Construct `newState`:** When creating the `newState` object to pass to `setState` and `updateCurrentProject`:
    *   Use `finalFiles` for `analysisResult.files`.
    *   Use `newSummary` for `analysisResult.summary`.
    *   Use `newProjectTree` for `analysisResult.project_tree`.
    *   **Crucially:** Use `preservedSelectedFiles` for `selectedFiles`. **Do not reset it to `[]`.**
    ```typescript
     const newState: AppState = {
         ...state, // Preserve other parts of the state like backups, filters etc.
         analysisResult: {
             summary: newSummary,
             files: finalFiles,
             project_tree: newProjectTree,
         },
         selectedFiles: preservedSelectedFiles, // Use the preserved list
     };
    ```
*   **Update State:** Call `setState(newState)`, `updateCurrentProject(newState)`, and `onUploadComplete(newState)`.

**4.4. Update Parent Component (`app/page.tsx`)**

*   No major changes should be strictly necessary *if* `FileUploadSection` correctly preserves the relevant parts of the state (`selectedFiles`, `backups`, etc.) when constructing `newState`. Ensure the state update propagation works as expected.
*   Consider adding a state variable like `isProjectLoaded` derived from `state.analysisResult !== null` to control the enabled state of the refresh button if passing the whole state down is not preferred.

**5. Dependencies:**

*   `lucide-react` (for the refresh icon).

**6. Potential Challenges & Considerations:**

*   **Performance:** Re-processing a very large project folder might still take time, although it should be faster than the initial upload if content reading is optimized. Ensure progress indicators remain accurate.
*   **Error Handling:** Robustly handle cases where the user selects a *different* folder during the refresh prompt. The current logic might merge unrelated files; consider adding a check or warning if the root structure seems drastically different (though this is complex).
*   **State Management Complexity:** This adds another interaction path modifying the core `analysisResult`. Ensure state updates are clean and don't have unintended side effects.

**7. Testing:**

*   Verify the "Refresh Project" button is disabled initially and enabled only after a project is loaded.
*   Test the core workflow: Load -> Select -> Modify Locally -> Refresh -> Verify selection is preserved & content is updated (check token count change).
*   Test adding a new file locally -> Refresh -> Verify the new file appears in the `FileSelector` and is *not* selected by default.
*   Test deleting a file locally -> Refresh -> Verify the file is removed from the `FileSelector` and also removed from `selectedFiles` if it was previously selected.
*   Test renaming a file/folder locally -> Refresh -> Verify the old entry disappears and the new entry appears (selection on the old entry will be lost, which is expected).
*   Test with different project types and filter settings.
*   Test edge cases (empty folders, very large files, non-text files if filters allow).

