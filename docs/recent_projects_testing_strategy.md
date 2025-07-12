# Recent Projects Feature: Testing Strategy

This document outlines the testing strategy for the "Recent Projects" feature in the "Copy Me Quick" application. It covers unit tests for business logic, component tests for the UI display, and conceptual integration tests for end-to-end scenarios.

## 1. Unit Tests for `app/page.tsx` Logic

These tests will focus on the core logic within `app/page.tsx` related to managing and loading recent projects. Mocking `localStorage` and potentially parts of the `Project` structure or child components might be necessary.

### 1.1. Project Saving Logic (`useEffect` hook for `localStorage`)

-   **Timestamp Updates:**
    -   Verify `lastAccessed` is set to `Date.now()` when a new local project is created via `handleUploadComplete`.
    -   Verify `lastAccessed` is set to `Date.now()` when a new GitHub project is created/loaded via `handleBranchChange`.
    -   Verify `lastAccessed` is updated when an existing local project is re-uploaded.
    -   Verify `lastAccessed` is updated when an existing GitHub project/branch is re-loaded.
-   **Sorting by Recency:**
    -   When multiple projects exist, verify they are sorted by `lastAccessed` (descending) before being saved to `localStorage`.
    -   Verify projects without `lastAccessed` (or with `0`) are sorted to the end (treated as oldest).
-   **List Truncation:**
    -   If the number of projects exceeds `MAX_RECENT_PROJECTS`, verify that the list saved to `localStorage` is truncated to `MAX_RECENT_PROJECTS` items.
    -   Verify that the truncation preserves the *most recently accessed* projects.
-   **Lightweight State Saving:**
    -   Verify that the `analysisResult` field (especially `analysisResult.files` with content) is *not* saved as part of the project state in `localStorage` by the recent projects saving logic. Only essential state like filters, selected files (paths), and project identifiers should be persisted.

### 1.2. Project Loading Logic (`handleLoadRecentProject`, `proceedToLoadProject`)

-   **`handleLoadRecentProject` Scenarios:**
    -   **No Active Project:** If no project is currently loaded (or `analysisResult` is null/empty), verify `proceedToLoadProject` is called directly with the target project ID.
    -   **Active Project with Data:** If a project is active and has `analysisResult.files`, verify `projectToLoadId` is set and `showLoadRecentConfirmDialog` is set to `true`.
-   **`proceedToLoadProject` Scenarios:**
    -   **Project Not Found:** If the provided `projectId` does not exist in the `projects` array, verify an error is logged and no state changes occur.
    -   **Timestamp Update on Load:** Verify `lastAccessed` for the loaded project is updated to `Date.now()` in the `projects` state array.
    -   **`currentProjectId` Update:** Verify `currentProjectId` is correctly set to the ID of the loaded project.
    -   **GitHub Project Load:**
        -   Verify `activeSourceTab` is set to `'github'`.
        -   Verify `setSelectedRepoFullName` and `setSelectedBranchName` are called with the correct values from the loaded project.
        -   (Conceptual) Verify that this subsequently triggers necessary data fetching (mocking the fetch calls).
    -   **Local Project Load:**
        -   Verify `activeSourceTab` is set to `'local'`.
        -   Verify the application state (filters, etc.) reflects the loaded project's state (excluding full `analysisResult`).
        -   (Conceptual) Note that for local projects, `analysisResult` (file contents) is expected to be minimal/cleared, requiring user to re-select folder.
    -   **Dialog State Reset:** Verify `showLoadRecentConfirmDialog` and `projectToLoadId` are reset after loading.
-   **Confirmation Dialog Interaction (Conceptual Mocks):**
    -   **Confirm Load:** If `showLoadRecentConfirmDialog` was true, and user confirms, verify `proceedToLoadProject` is called with `projectToLoadId`.
    -   **Cancel Load:** If `showLoadRecentConfirmDialog` was true, and user cancels, verify `proceedToLoadProject` is NOT called and dialog states are reset.

## 2. Component Tests for `RecentProjectsDisplay.tsx`

These tests will use a testing library like React Testing Library to verify the rendering and interaction of the `RecentProjectsDisplay` component. Props like `projects` and `onLoadProject` will be mocked.

-   **Rendering Logic:**
    -   **Empty List:**
        -   Verify "No recent projects yet." message is displayed when `projects` prop is empty or null.
        -   Verify the heading "Recent Projects" is still displayed.
    -   **Populated List:**
        -   Verify the correct number of projects are initially displayed (respecting `maxInitialDisplay`).
        -   Verify project `name` is displayed correctly for each item.
        -   Verify source type icon (`Computer` for local, `Github` for GitHub) is displayed for each item.
        -   Verify `lastAccessed` time is formatted correctly (e.g., "2 hours ago") using `formatDistanceToNow`.
        -   Verify projects with undefined or `0` `lastAccessed` display a fallback or are handled gracefully (e.g., no time displayed or "Unknown").
    -   **Sorting:**
        -   Provide an unsorted list of projects and verify they are rendered in descending order of `lastAccessed`.
        -   Verify projects without `lastAccessed` are at the bottom.
-   **Interaction Logic:**
    -   **Clicking a Project:**
        -   Verify `onLoadProject` callback is called with the correct `project.id` when a project item (button) is clicked.
    -   **"Show More/Less" Functionality:**
        -   If `projects.length > maxInitialDisplay`:
            -   Verify "Show More" button is visible.
            -   Click "Show More", verify all projects are displayed and button text changes to "Show Fewer".
            -   Click "Show Fewer", verify list reverts to initial display count and button text changes back.
        -   If `projects.length <= maxInitialDisplay`:
            -   Verify "Show More" button is NOT visible.
-   **Accessibility (Conceptual):**
    -   Ensure buttons have proper ARIA labels or discernible text for screen readers (e.g., `title` attribute provides context).

## 3. Integration Tests (Conceptual)

These tests describe end-to-end user scenarios. They would typically be implemented using tools like Cypress or Playwright, but here we outline the concepts.

### 3.1. Scenario: Load a Recent GitHub Project

1.  **Setup:**
    -   Ensure `localStorage` contains at least one GitHub-sourced project with a valid `githubRepoFullName` and `githubBranch`, and a `lastAccessed` timestamp.
    -   The application starts, and `app/page.tsx` loads this project into its `projects` state.
2.  **User Action:**
    -   The user sees the GitHub project listed in the "Recent Projects" display.
    -   The user clicks on this GitHub project.
3.  **Expected Behavior & Verification:**
    -   If a different project is active, a confirmation dialog appears. User confirms.
    -   The application switches to the "GitHub" tab (`activeSourceTab` is 'github').
    -   The `selectedRepoFullName` and `selectedBranchName` state variables in `app/page.tsx` are updated to match the loaded project.
    -   Loading indicators appear as the application fetches repository/branch data (mock API calls to simulate this).
    -   The file tree (`FileSelector`) eventually populates with files from the mocked GitHub source.
    -   The `currentProjectId` is updated to the ID of the loaded GitHub project.
    -   The `lastAccessed` timestamp for this project in the `projects` array (and subsequently `localStorage` on next save) is updated.

### 3.2. Scenario: Load a Recent Local Project

1.  **Setup:**
    -   Ensure `localStorage` contains at least one `local`-sourced project with a `sourceFolderName` and a `lastAccessed` timestamp.
    -   The application starts, and `app/page.tsx` loads this project into its `projects` state.
2.  **User Action:**
    -   The user sees the local project listed in the "Recent Projects" display.
    -   The user clicks on this local project.
3.  **Expected Behavior & Verification:**
    -   If a different project is active, a confirmation dialog appears. User confirms.
    -   The application switches to the "Local" tab (`activeSourceTab` is 'local').
    -   The application's state (filters, selected file types from `ProjectSelector`) updates to match the settings stored for that local project.
    -   The `analysisResult` (file list, content) will likely be minimal or empty (as it's not fully saved).
    -   The `FileUploadSection` is visible, prompting the user to select the project folder again.
        -   *(Ideal but optional test extension):* After user re-selects the corresponding local folder, verify the analysis proceeds and uses the restored filter settings.
    -   The `currentProjectId` is updated to the ID of the loaded local project.
    -   The `lastAccessed` timestamp for this project in the `projects` array (and subsequently `localStorage`) is updated.

### 3.3. Scenario: Recent List Management

1.  **Setup:**
    -   Have several projects in `localStorage`.
2.  **User Action:**
    -   Load a project that is not the most recent.
3.  **Expected Behavior & Verification:**
    -   The loaded project's `lastAccessed` timestamp is updated.
    -   On the next implicit save (e.g., triggered by some other state change that causes the save `useEffect` to run), verify this project now appears at the top of the list persisted to `localStorage` (or higher than before).
4.  **User Action (List Truncation):**
    -   Add projects until `MAX_RECENT_PROJECTS` is reached.
    -   Load/create one more new project.
5.  **Expected Behavior & Verification:**
    -   The new project is added to the list.
    -   The list in `localStorage` is truncated, and the oldest project (least recently accessed) is removed.

This testing strategy aims to ensure the reliability, correctness, and usability of the Recent Projects feature from multiple perspectives.The `docs/recent_projects_testing_strategy.md` file has been successfully created with the detailed testing strategy.

This completes the subtask. I can now submit the report.
