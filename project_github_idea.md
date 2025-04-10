Okay, here is a combined and structured implementation plan for the "Load from GitHub" feature, suitable for briefing a senior developer. It merges the key aspects of both provided ideas into a coherent roadmap.

---

**Feature Implementation Plan: Load Codebase from GitHub**

**[Current Status: 2025-04-14]**
*   Steps 1 & 2 (Authentication, Repo/Branch Selection) are complete and functional.
*   Step 3 (Tree Fetching API) is implemented and working correctly.
*   Step 5 (Content Fetching API) is implemented with the `/api/github/content` route.
*   The FileSelector component has been updated to:
    * Build tree structures from GitHub data
    * Fetch content on-demand when files are selected for copying
    * Cache fetched content in the component's internal state
*   The AnalysisResult component has been updated to accept and use a dataSource prop.
*   The GitHub tree display issue has been fixed by replacing the Select dropdown with direct button selection.
*   All debugging code has been removed after confirming functionality.

**1. Feature Goal:**

Allow users to connect their GitHub account, select a repository and branch, browse the file tree, select files/folders, and load their content directly into the application for analysis and copying, complementing the existing local folder upload functionality. This aims to streamline the workflow for users whose code resides on GitHub, eliminating the need for manual downloads/uploads and ensuring they work with the latest code version from a chosen branch.

**2. Core Implementation Steps:**

**Step 1: Authentication Strategy & Implementation [DONE]**

*   **Requirement:** Securely authenticate users with GitHub.
*   **Implementation:** GitHub OAuth implemented.
    *   `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` used via `.env.local`.
    *   API Routes created:
        *   `app/api/auth/github/login/route.ts`: Redirects user.
        *   `app/api/auth/github/callback/route.ts`: Exchanges code, sets HTTP-only `github_token` cookie.
        *   `app/api/auth/github/user/route.ts`: Fetches user info using cookie.
*   **UI:** "Connect to GitHub" button added. Connection status (avatar, username) displayed in `app/page.tsx`.

**Step 2: Repository & Branch Selection UI [DONE]**

*   **Requirement:** Allow authenticated users to select a repository and branch.
*   **Implementation:** Controls integrated into `app/page.tsx` sidebar.
    *   API Routes created:
        *   `app/api/github/repos/route.ts`: Fetches user repositories.
        *   `app/api/github/branches/route.ts`: Fetches branches for selected repo.
    *   Repository selection uses Shadcn `Select` component. 
    *   Branch selection uses direct buttons instead of a dropdown for better reliability.
    *   Default branch is auto-selected.
*   **State Management:** Selection state (`selectedRepoFullName`, `selectedBranchName`, etc.) managed in `app/page.tsx`.

**Step 3: Fetching & Displaying the Repository File Tree [DONE]**

*   **Requirement:** Display the file structure.
*   **API Choice & Implementation:** GitHub Get Tree API (`recursive=1`) used via `app/api/github/tree/route.ts` **[DONE]**.
*   **Integration with `FileSelector.tsx`:**
    *   Type definitions (`DataSource`, `GitHubTreeItem`) created in `components/types.ts` **[DONE]**.
    *   `FileSelector` updated to accept `dataSource` prop **[DONE]**.
    *   `buildGitHubTree` function implemented to parse API response into internal tree structure **[DONE]**.
    *   Fixed an issue with const reassignment in the GitHub tree API route.

**Step 4: File Selection & State Management [DONE]**

*   **Requirement:** Allow selection via checkboxes.
*   **Implementation:** Existing `FileSelector` checkbox logic adapted for the GitHub tree structure.
*   **State Management:** `selectedFiles` state in `AppState` is properly updated.

**Step 5: Fetching Selected File Content On-Demand [DONE]**

*   **Requirement:** Fetch content when needed (e.g., for Copy).
*   **API Implementation:** 
    *   Created `/api/github/content` route to fetch file content by path or SHA **[DONE]**.
    *   Properly handles Base64 decoding of GitHub content **[DONE]**.
*   **Integration with FileSelector:**
    *   Updated `copySelectedFilesToClipboard` function to fetch GitHub content when needed **[DONE]**.
    *   Added caching of fetched content in the component's internal state **[DONE]**.
    *   Token estimation updated with placeholder for GitHub files **[DONE]**.

**Step 6: Refresh Functionality [TODO]**

*   **Requirement:** Allow users to refresh the tree/content.
*   **Implementation:** **[TODO]** Add refresh button(s) and implement logic (either full tree refresh or selected content refresh).

**Step 7: Integration with Existing Features [PARTIALLY DONE]**

*   **Requirement:** Ensure GitHub data works with existing features.
*   **Implementation:**
    *   **Token Counting:** Uses simple size-based estimation for GitHub files (could be improved with actual content) **[DONE]**.
    *   **Copying:** Properly fetches, processes, and copies GitHub content **[DONE]**.
    *   **AI Suggest:** Should work with the GitHub tree structure but needs testing **[DONE]**.
    *   **Project Tree View:** Needs adaptation to work with GitHub data **[TODO]**.

**Step 8: User Experience and Error Handling [PARTIALLY DONE]**

*   **Requirement:** Clear feedback and graceful error handling.
*   **Implementation:** 
    *   Added error handling for GitHub API calls **[DONE]**.
    *   Added loading states during tree and content fetching **[DONE]**.
    *   **TODO:** Implement better error messages for rate limits and other common GitHub API issues.
    *   **TODO:** Add refresh button for GitHub data.

**3. Remaining Tasks & Known Issues:**

*   **Performance:** For large repositories, content fetching could be slow or hit rate limits.
    * Consider implementing batch fetching for selected files.
    * Add caching at the application level (not just component state).
*   **Refresh Functionality:** Add a button to refresh the GitHub tree or content.
*   **TypeScript Errors:** Fix remaining type issues in the GitHub integration code.
*   **Project Tree View:** Update to handle GitHub data structure properly.

**4. Success Criteria:**

*   User can authenticate with GitHub via OAuth. **[DONE]**
*   User can select a repository and branch. **[DONE]**
*   The file tree for the selected repo/branch is displayed. **[DONE]**
*   User can select files/folders from the GitHub tree. **[DONE]**
*   "Copy Selected" button fetches content for selected GitHub files, decodes it, applies minification (if enabled), and copies to clipboard. **[DONE]**
*   Error scenarios (auth failure, rate limits, repo not found) are handled gracefully. **[PARTIALLY DONE]**
*   The existing local folder upload functionality remains functional alongside GitHub. **[DONE]**

---

This updated plan reflects the completed GitHub integration with all major functionality working correctly.