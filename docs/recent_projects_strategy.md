# Recent Projects Storage Strategy

This document outlines the strategy for storing and managing a list of recent projects in the "Copy Me Quick" application.

## Storage Mechanism

-   **`localStorage` Key:** Recent projects will be stored in the browser's `localStorage` under the key `codebaseReaderProjects`. This allows for persistence of recent projects across browser sessions.

## `lastAccessed` Timestamp

-   Each project object will have an optional `lastAccessed` field, which will store a Unix timestamp (number of milliseconds since the Unix epoch).
-   This timestamp will be updated whenever a project is loaded or saved.
-   The `lastAccessed` timestamp is the primary mechanism for determining the recency of a project. Projects with higher (more recent) timestamps will be considered more recent.

## Managing the List of Recent Projects

The list of recent projects will be maintained as an array of `Project` objects within `localStorage`.

### Adding/Updating Projects:

1.  **New Project Creation/Import:** When a new project is created or an existing project configuration is imported, it will be added to the list of recent projects. Its `lastAccessed` timestamp will be set to the current time.
2.  **Loading an Existing Project:** When a user loads a project from the recent projects list, its `lastAccessed` timestamp will be updated to the current time. The project will then be moved or re-inserted to maintain the list's order (e.g., moved to the beginning or end, depending on sort order).
3.  **Saving Project State:** When a project's state is saved (e.g., after modifying selections or filters), its `lastAccessed` timestamp in the recent projects list will be updated to the current time.

### Size Limit and Eviction Strategy:

-   To prevent `localStorage` from growing indefinitely, a maximum limit will be enforced on the number of projects stored in the recent projects list (e.g., 10-20 projects).
-   **Eviction:** If adding a new project or updating an existing one causes the list to exceed this limit, the project with the oldest `lastAccessed` timestamp (i.e., the least recently accessed) will be removed from the list.

### Displaying Recent Projects:

-   When displaying the list of recent projects to the user, they will be sorted in descending order based on their `lastAccessed` timestamp, showing the most recently accessed projects first.

This strategy ensures that users have quick access to the projects they've worked on most recently, while also managing storage space effectively.
