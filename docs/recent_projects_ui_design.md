# Recent Project Access: UI Design

This document describes the UI design for accessing recent projects within the "Copy Me Quick" application.

## 1. Location

-   **Primary Location:** The list of recent projects will be displayed in a dedicated section within the existing left sidebar, likely below the "Project Type" selector and "Choose Project Folder/GitHub" sections.
-   **Alternative Access (Optional):** A "File > Open Recent" menu item could be considered if a top menu bar is part of the application's design. However, the sidebar is the primary focus for discoverability.

## 2. Appearance

### List Container:

-   **Title:** The section will have a clear title, such as "Recent Projects".
-   **Number of Projects:** Initially, up to 5-7 most recent projects will be displayed directly in the sidebar. If there are more projects than this initial display count (up to the storage limit of e.g., 10-20), a "Show More" or "View All Recent" button/link could be provided to expand or navigate to a fuller list (perhaps in a modal or a dedicated view).
-   **Empty State:** If there are no recent projects, a simple message like "No recent projects yet." will be displayed.

### Individual Project Item:

Each project in the list will be represented by an item displaying the following information:

-   **Project Name:** The primary identifier for the project (e.g., `my-website-frontend`, `api-service-refactor`).
-   **Source Type Icon:** A small icon indicating the project source:
    -   Local Folder icon (e.g., `lucide-react` Folder icon) for `local` projects.
    -   GitHub icon (e.g., `lucide-react` Github icon) for `github` projects.
-   **Last Accessed Time:** A human-readable representation of the `lastAccessed` timestamp (e.g., "Opened 2 hours ago", "Yesterday", "2024-07-28"). This provides context on recency.
-   **Visual Cues:**
    -   Hover state: Background color change to indicate interactivity.
    -   Selected state (if applicable, though selection immediately loads the project): Potentially a subtle highlight if the currently loaded project is from this list.

**Example Layout for an Item:**

```
--------------------------------------------------
| [FolderIcon] My Local Project                  |
|              <Opened 5 minutes ago>            |
--------------------------------------------------
| [GitHubIcon] Cool Company / Main Repo          |
|              <Opened yesterday>                |
--------------------------------------------------
```

## 3. Interaction

### Selecting a Recent Project:

-   Users will click directly on a project item in the recent projects list.

### Behavior on Selection:

1.  **Confirmation (If Active Unsaved Project):**
    -   If there is a currently active project with unsaved changes (e.g., modified file selections, filters), a confirmation dialog will appear before loading the selected recent project.
    -   Dialog Message: "You have unsaved changes in the current project. Do you want to save them before switching? [Save and Switch] [Switch without Saving] [Cancel]"
    -   Alternatively, a simpler dialog: "Switching projects will discard unsaved changes in your current session. Are you sure you want to continue? [Switch] [Cancel]"
    -   *Rationale:* Prevents accidental data loss.

2.  **Loading the Project:**
    -   Once confirmed (or if no unsaved changes), the application will load the selected recent project.
    -   This involves:
        -   Retrieving the project's `AppState` from `localStorage` (based on the project's ID stored in the `codebaseReaderProjects` list).
        -   Restoring the application state using this `AppState` (selected files, filters, analysis results if stored, etc.).
        -   Updating the `lastAccessed` timestamp for the selected project and re-saving the recent projects list to reflect this.
        -   The UI will update to reflect the loaded project's state (file tree, selections, analysis).

3.  **Feedback:**
    -   A loading indicator (e.g., a spinner or a subtle progress bar) might be shown briefly while the project state is being restored, especially if it involves re-fetching data for GitHub projects or re-processing files.

## 4. Rationale

### Sidebar Location:

-   **Discoverability:** The sidebar is a persistent and commonly accessed area for navigation and core actions, making recent projects easily discoverable.
-   **Contextual Relevance:** Placing it near project source selection tools (local folder, GitHub) keeps related functionalities grouped.
-   **Efficiency:** Allows quick access without navigating through multiple menus.

### Information Displayed:

-   **Name & Icon:** Essential for quick identification and recalling the project's nature.
-   **Last Accessed Time:** Reinforces the "recent" aspect and helps users differentiate between projects with similar names or content.

### Interaction Model:

-   **Direct Click:** Simple and intuitive for selection.
-   **Confirmation Dialog:** Standard practice to prevent data loss, promoting a safer user experience.
-   **Automatic State Restoration:** Provides a seamless transition back to a previous working context.

This UI approach aims to be intuitive, efficient, and integrated naturally into the existing application flow, enhancing user productivity by providing quick access to previously worked-on projects.
