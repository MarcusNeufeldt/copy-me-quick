Okay, here is a combined and structured implementation plan for the "Load from GitHub" feature, suitable for briefing a senior developer. It merges the key aspects of both provided ideas into a coherent roadmap.

---

**Feature Implementation Plan: Load Codebase from GitHub**

**1. Feature Goal:**

Allow users to connect their GitHub account, select a repository and branch, browse the file tree, select files/folders, and load their content directly into the application for analysis and copying, complementing the existing local folder upload functionality. This aims to streamline the workflow for users whose code resides on GitHub, eliminating the need for manual downloads/uploads and ensuring they work with the latest code version from a chosen branch.

**2. Core Implementation Steps:**

**Step 1: Authentication Strategy & Implementation**

*   **Requirement:** Securely authenticate users with GitHub to access repository data (especially private repos).
*   **Recommendation:** Implement **GitHub OAuth** (as suggested in V2) for the best user experience and security.
    *   Register a GitHub OAuth App to get Client ID and Client Secret. Store these securely as environment variables (e.g., `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`).
    *   Create Next.js API Routes:
        *   `/api/auth/github/login`: Redirects the user to the GitHub authorization URL.
        *   `/api/auth/github/callback`: Handles the callback from GitHub, exchanges the `code` for an `access_token`, and stores the token securely (e.g., in an **HTTP-only cookie** named `github_token`).
*   **Alternative (Optional/Development):** Consider allowing **Personal Access Token (PAT)** input (as mentioned in V1) for simpler setup during development or for power users.
    *   If implemented, add an input field for the PAT.
    *   Store the PAT securely for the session (e.g., session storage or context, *avoiding localStorage due to XSS risks* unless absolutely necessary with warnings).
    *   Clearly warn users about the security implications of using PATs.
*   **UI:** Add a "Connect to GitHub" button that initiates the OAuth flow or reveals the PAT input field. Display connection status (e.g., "Connected as [GitHub Username]" or "Connect to GitHub").

**Step 2: Repository & Branch Selection UI**

*   **Requirement:** Allow authenticated users to select a repository and branch.
*   **Implementation:**
    *   Create a new component (e.g., `GitHubSourceSelector.tsx`) or integrate controls into the existing sidebar (`app/page.tsx`'s `<aside>`).
    *   After successful authentication:
        *   Fetch the user's repositories (e.g., `GET /user/repos` using the stored token) and display them in a searchable dropdown (`Select` component).
        *   Once a repository is selected (e.g., `owner/repo`), fetch its branches (e.g., `GET /repos/{owner}/{repo}/branches`) and display them in another dropdown (defaulting to the repo's default branch).
    *   **State Management:** Store the selected `owner`, `repo`, `branch`, and the GitHub `accessToken` (if using PAT) or indicate OAuth status within the application's state (potentially extending `AppState` or using a dedicated context/state slice).

**Step 3: Fetching & Displaying the Repository File Tree**

*   **Requirement:** Display the file structure of the selected repository branch within the `FileSelector` component.
*   **API Choice:** Use the **GitHub Get Tree API** (`GET /repos/{owner}/{repo}/git/trees/{branch_sha}?recursive=1`) as recommended in V1 for efficiency with potentially large repositories.
    *   First, get the latest commit SHA for the selected branch (e.g., from the branch list API or `GET /repos/{owner}/{repo}/branches/{branch}`).
    *   Fetch the tree using the commit SHA. The `recursive=1` parameter returns a flat list of all files and directories, which is ideal for building the tree structure.
*   **Integration with `FileSelector.tsx`:**
    *   Modify `FileSelector` to accept a data source type (e.g., `'local' | 'github'`).
    *   When the source is `'github'`:
        *   Adapt the `buildFileTree` logic (or create a new function `buildGitHubFileTree`) to parse the response from the GitHub Tree API. The API response contains `path`, `type` ('blob' for file, 'tree' for directory), and `sha`.
        *   Map this structure to the `TreeNode` interface used by `FileSelector`. Store the `sha` for each file node; it will be needed for fetching content.
        *   The `lines` and `content` fields will initially be empty/undefined for GitHub files until explicitly fetched.
*   **UI:** The `FileSelector` should render the tree visually identically to the local file view. Consider adding a small GitHub icon next to files/folders loaded from a repo.
*   **Caching:** Implement caching for the fetched tree structure (e.g., in component state or context) associated with the selected repo/branch/commit SHA to avoid redundant API calls when switching back and forth, but ensure it can be refreshed.

**Step 4: File Selection & State Management**

*   **Requirement:** Allow users to select files/folders from the GitHub-sourced tree using the existing checkbox logic.
*   **Implementation:**
    *   The existing selection logic within `FileSelector` (handling checkboxes, parent/child selection state) should work with the GitHub tree data structure.
    *   Store the `selectedFiles` (using their `path` strings) in the main `AppState`, just like with local files.

**Step 5: Fetching Selected File Content On-Demand**

*   **Requirement:** When the user performs an action requiring file content (e.g., calculates tokens, clicks "Copy Selected"), fetch the content for the selected files from GitHub.
*   **API Choice:** Use the **GitHub Get Blob API** (`GET /repos/{owner}/{repo}/git/blobs/{file_sha}`) as recommended in V1, using the `sha` stored in the `TreeNode`. *Alternatively*, use the **Get Contents API** (`GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`) as suggested in V2, which might be simpler if SHAs aren't readily available or need re-validation. *Decision: Let the developer choose based on ease of implementation with the chosen tree fetching method. Get Contents might be slightly easier.*
*   **Implementation:**
    *   Create a new API route (e.g., `/api/github/get-content`) in the Next.js app. This route takes `owner`, `repo`, `path`, and `ref` (branch/sha) as query parameters, retrieves the user's token (from cookie/session), calls the GitHub API, and returns the file content.
    *   **Crucially:** The content returned by the GitHub API is often **Base64 encoded**. Decode it (`atob()` in the browser or Buffer in Node.js) before using it.
    *   Modify the relevant parts of the application (e.g., the `copySelectedFilesToClipboard` function in `FileSelector`, token calculation logic) to fetch content via this API route for selected GitHub files *when needed*, instead of reading from local state directly. Update the `FileData` or internal state with the fetched content.

**Step 6: Refresh Functionality**

*   **Requirement:** Allow users to refresh the file tree and/or content from GitHub.
*   **Implementation:**
    *   Add a "Refresh from GitHub" button.
    *   **Option 1 (Full Refresh):** Re-fetch the latest commit SHA for the branch, then re-fetch the entire tree structure (Step 3). Clear existing file content cache.
    *   **Option 2 (Content Refresh - like V2):** Add a "Refresh Selected Content" button. Iterate through `selectedFiles`, re-fetch their content using the API route from Step 5, and update the application state.
    *   Provide visual feedback during refresh (loading indicators).

**Step 7: Integration with Existing Features**

*   **Requirement:** Ensure GitHub-loaded data works with existing features like token counting, minification, copying, and AI suggestions.
*   **Implementation:**
    *   **Token Counting:** Ensure the token calculation logic (currently basic length check, potentially using `tiktoken` later) waits for file content to be fetched from GitHub before running.
    *   **Copying:** The `copySelectedFilesToClipboard` function needs modification to handle fetching content for GitHub files before assembling the final text.
    *   **AI Suggest (`/api/ai-smart-select`):** This API currently receives the *tree structure*. It should continue to work fine, as the tree structure itself is built in Step 3 before content fetching. No immediate changes needed here, but ensure the tree string format remains consistent.
    *   **State Updates:** Ensure fetched data correctly updates the `AppState`, specifically `analysisResult.files` (populating `content` and `lines` after fetch) and triggers re-renders where necessary.

**Step 8: User Experience and Error Handling**

*   **Requirement:** Provide clear feedback and handle potential errors gracefully.
*   **Implementation:**
    *   Use loading spinners/states during API calls (authentication, fetching repos/branches/tree/content).
    *   Display informative error messages for common issues:
        *   Invalid token / Authentication failed
        *   Repository or branch not found
        *   GitHub API rate limit exceeded (advise waiting or using authenticated requests)
        *   Network errors
    *   Ensure a smooth transition between the "Local Folder" mode and the new "GitHub Repo" mode (e.g., using Tabs or a clear toggle).

**3. Key Decisions & Considerations:**

*   **OAuth vs. PAT:** Prioritize OAuth, but PAT can be a fallback/dev option.
*   **Token Storage:** HTTP-only cookies are preferred for OAuth tokens. Session storage or context for PATs if used.
*   **API for Tree:** `Get Tree API (recursive)` is generally better for performance than recursive `Get Contents`.
*   **API for Content:** `Get Blob` (needs SHA) vs. `Get Contents` (needs path). Choose based on available data from the tree fetch. Remember Base64 decoding.
*   **State Management:** Decide where to store GitHub-specific state (selected repo/branch, token status) – extend `AppState` or use separate context/store.
*   **Fetching Strategy:** Fetch tree initially, fetch content *on demand* to avoid hitting rate limits and unnecessary data transfer for unselected files.

**4. Success Criteria:**

*   User can authenticate with GitHub via OAuth.
*   User can select a repository and branch.
*   The file tree for the selected repo/branch is displayed in `FileSelector`.
*   User can select files/folders from the GitHub tree.
*   Token count reflects selected files (fetching content as needed).
*   "Copy Selected" button fetches content for selected GitHub files, decodes it, applies minification (if enabled), and copies the structure + content to the clipboard.
*   Refresh mechanism updates the view with latest data from GitHub.
*   Error scenarios (auth failure, rate limits, repo not found) are handled gracefully.
*   The existing local folder upload functionality remains intact and usable.

---

This plan provides a comprehensive overview and step-by-step guide, referencing the best parts of both initial ideas while adding structure and specific recommendations for the developer.