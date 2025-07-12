# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Copy Me Quick is a Next.js web application that helps developers prepare and optimize codebases for LLMs by reducing token count while preserving context. It supports both local file uploads and GitHub repository integration.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **UI Components**: Radix UI with shadcn/ui
- **State Management**: React hooks and context
- **File Processing**: JSZip, tiktoken for tokenization
- **Database**: IndexedDB for client-side storage
- **Authentication**: GitHub OAuth

### Core Architecture Patterns

**App Router Structure**: Uses Next.js App Router with API routes in `app/api/` and pages in `app/`.

**Component Organization**:
- `components/ui/` - Reusable UI components (buttons, dialogs, etc.)
- `components/` - Business logic components (FileSelector, AnalysisResult, etc.)
- `hooks/` - Custom React hooks for shared logic
- `lib/` - Utility functions and configurations

**Data Flow**:
1. **File Sources**: Local uploads or GitHub API
2. **Processing**: File filtering, tokenization, minification
3. **Storage**: IndexedDB for project persistence
4. **Output**: Formatted text for LLM consumption

### Key Components

**FileSelector** (`components/FileSelector.tsx`): Main file selection interface with tree view, supports both local and GitHub files. Uses `FileTreeNode` for recursive tree rendering.

**GitHub Integration** (`app/api/github/`): OAuth authentication and repository browsing with rate limiting and error handling.

**Token Calculation** (`hooks/useTokenCalculator.ts`): Real-time token counting using tiktoken library.

**Project Management** (`lib/indexeddb.ts`): Persistent storage for project configurations and recent projects.

### Data Types

Core interfaces in `components/types.ts`:
- `FileData`: Represents file content and metadata
- `AnalysisResultData`: Processed codebase analysis
- `Project`: Saved project configuration
- `DataSource`: Abstraction for local vs GitHub sources

### Configuration

**WebAssembly Support**: Next.js config enables async WebAssembly for tiktoken library.

**GitHub Integration**: Uses OAuth for authentication, requires environment variables for GitHub App credentials.

**File System Access**: Uses modern File System Access API where available, falls back to file input.

## Development Notes

**Token Limits**: Default maximum is 128k tokens, configurable per project type.

**File Filtering**: Framework-aware presets automatically exclude common build artifacts and dependencies.

**Recent Projects**: Stored in IndexedDB with automatic cleanup of old entries.

**Error Handling**: Comprehensive error boundaries and user feedback for GitHub API failures and file processing errors.