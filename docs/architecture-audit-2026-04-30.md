# Architecture Audit - 2026-04-30

## Current State

- Default branch is `main`; local `main` is synced with `origin/main`.
- App is a Next.js 15 app-router project with one large client page at `app/page.tsx`.
- Main product flow is local folder/GitHub repo/PR ingestion, file filtering/selection, token counting, and copying code context for LLM use.
- GitHub auth and repo APIs are server routes; most app state still lives in React state/localStorage/IndexedDB.

## Updates Applied

- Synced dependencies and lockfile within existing semver ranges.
- Upgraded locked Next runtime from `15.5.9` to `15.5.15`.
- Replaced legacy `.eslintrc.json` with flat `eslint.config.mjs`.
- Removed duplicate empty `next.config.mjs`.
- Set `outputFileTracingRoot` in `next.config.js` so Next stops selecting the parent `C:\Users\marcu` workspace root.
- Ported missing GitHub filter behavior: saved GitHub exclusions now filter the displayed GitHub file tree.
- Ported missing local upload behavior: project type `None` is treated as a valid "accept all files" template.
- Refactored `app/page.tsx` from 1706 to 1273 lines by extracting app defaults, directory traversal, header, loading indicator, empty state, dialogs, and source sidebar UI.
- Added shared GitHub/project template types to `components/types.ts` so page-level UI can move out without duplicating contracts.
- Added GitHub owner/org selection plus pull request loading, PR file-tree display, and PR copy modes for diff-only or diff plus full file content.

## Branch Review

- `local_project_handling`: most folder/File System Access work is already on `main`; only the `None` project type upload fix was still needed.
- `origin/claude/review-open-prs-*`: empty-filter sync was already present; GitHub tree filtering was missing and was ported.
- `github_filter`: contains a broad modular rewrite, project/server persistence routes, analytics experiments, and docs churn. Not merged wholesale because it mixes product work with risky app restructuring and old dependency experiments.
- PR #9 targets old `github_filter`, not `main`, and includes a Next 14 downgrade path. Skipped.

## Remaining Architecture Risks

- `app/page.tsx` is smaller, but still owns persistence, upload, GitHub fetching, recent project mutation, and token state. Next refactor should extract state/hooks, not more JSX.
- `tiktoken` still bundles WASM into the client path and emits a build warning.
- Lint now runs, but there are 68 unused-code warnings. No lint errors remain.
- `npm audit` still reports 4 moderate advisories through Vercel analytics/speed-insights and Next's bundled `postcss`; npm's forced fix suggests downgrading Next to 9, so it was not applied.
- There is no automated test suite covering local folder upload, GitHub tree/PR filtering, auth routes, or copy output.
- Vercel deployment verification was intentionally skipped after the CLI defaulted to the Boldstream team on a read-only list command. Do not use Boldstream Vercel for this app.

## Suggested Next Work

- Split `app/page.tsx` into source panels, project state hooks, and result/selection containers.
- Add small unit tests for GitHub exclusion matching, PR copy formatting, and local project type handling.
- Decide whether Vercel analytics/speed-insights are needed; removing them may clear the remaining audit path.
- Replace or isolate browser `tiktoken` usage if the WASM warning becomes a runtime issue.
