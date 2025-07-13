export interface FileData {
  path: string;
  lines: number;
  content: string;
  size?: number;
  sha?: string;
  dataSourceType?: 'local' | 'github';
}

export interface AnalysisResultData {
  totalFiles: number;
  totalLines: number;
  totalTokens: number;
  summary: string;
  project_tree: string;
  files: FileData[];
  commitDate?: string | null;
  uploadTimestamp?: number | null;
}

export interface AppState {
  analysisResult: AnalysisResultData | null;
  selectedFiles: string[];
  excludeFolders: string;
  fileTypes: string;
}

export interface Project {
  id: string;
  name: string;
  sourceType: 'local' | 'github';
  githubRepoFullName?: string | null;
  githubBranch?: string | null;
  localExcludeFolders?: string | null;
  localFileTypes?: string | null;
  lastAccessed: number;
  isPinned: boolean;
  hasDirectoryHandle?: boolean; // Client-side flag for local projects with stored handles
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url: string;
  formattedSize?: string; // Added for display purposes
  lines?: number; // For when content is fetched
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

export type DataSourceType = 'local' | 'github';

export interface DataSource {
  type: DataSourceType;
  files?: FileData[];
  tree?: GitHubTreeItem[];
  repoInfo?: GitHubRepoInfo;
}

export interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

export interface FileSelectorProps {
  activeSourceTab: 'local' | 'github';
  githubTree: GitHubTreeItem[] | null;
  githubRepoInfo?: GitHubRepoInfo;
  selectedFiles: string[];
  setSelectedFiles: (filesOrUpdater: string[] | ((prev: string[]) => string[])) => void;
  maxTokens: number;
  onTokenCountChange: (count: number, details?: import('../../../hooks/useTokenCalculator').TokenCountDetails) => void;
  allFiles?: FileData[];
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus;
  tokenCount: number;
  currentProjectId?: string | null;
}

export interface AnalysisResultProps {
  analysisResult: AnalysisResultData | null;
  selectedFiles: string[];
  onSelectedFilesChange: (filesOrUpdater: string[] | ((prev: string[]) => string[])) => void;
  tokenCount: number;
  setTokenCount: (count: number, details?: import('../../../hooks/useTokenCalculator').TokenCountDetails) => void;
  tokenDetails?: import('../../../hooks/useTokenCalculator').TokenCountDetails | null;
  maxTokens: number;
  activeSourceTab: 'local' | 'github';
  githubTree: GitHubTreeItem[] | null;
  githubRepoInfo?: GitHubRepoInfo;
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus;
  currentProjectId?: string | null;
}

// Additional types from page.tsx
export interface GitHubUser {
  id: string;
  login: string;
  avatar_url?: string;
  name?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
  };
  default_branch: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

export interface ProjectTemplate {
  value: string;
  label: string;
  excludeFolders: string[];
  fileTypes: string[];
}

export interface UserContext {
  user: {
    id: string;
    login: string;
    avatar_url?: string;
    name?: string;
    global_github_exclude_folders: string;
    local_exclude_folders: string;
    local_file_types: string;
    local_templates: string;
  };
  projects: Array<{
    id: string;
    name: string;
    source_type: 'local' | 'github';
    github_repo_full_name?: string;
    github_branch?: string;
    local_exclude_folders?: string;
    local_file_types?: string;
    is_pinned: number;
    last_accessed: number;
  }>;
}

// Action types for the context
export interface AppActions {
  // GitHub actions
  handleRepoChange: (repoFullName: string) => void;
  handleBranchChange: (branchName: string) => void;
  handleGitHubLogin: () => void;
  handleGitHubLogout: () => Promise<void>;
  
  // Local actions
  handleUploadComplete: (files: File[], rootHandle?: FileSystemDirectoryHandle) => Promise<void>;
  handleReloadLocalProject: (project: Project) => Promise<AnalysisResultData | null>;
  
  // Project management actions
  handleLoadProject: (projectId: string) => Promise<void>;
  handlePinProject: (projectId: string, isPinned: boolean) => Promise<void>;
  handleRemoveProject: (projectId: string) => Promise<boolean>;
  handleRenameProject: (projectId: string, newName: string) => Promise<void>;
  
  // Workspace actions
  handleResetWorkspace: () => void;
  handleTabChangeAttempt: (newTabValue: 'local' | 'github') => void;
  
  // Filter actions
  handleSaveFilters: (newExclusions: string) => Promise<void>;
  handleSaveLocalFilters: (newExclusions: string, newFileTypes: string) => Promise<void>;
  
  // Token actions
  handleTokenCountChange: (count: number, details?: import('../../../hooks/useTokenCalculator').TokenCountDetails) => void;
  
  // File selection actions
  handleSelectedFilesChange: (filesOrUpdater: string[] | ((prev: string[]) => string[])) => void;
  
  // Dialog actions
  confirmTabSwitch: () => void;
  cancelTabSwitch: () => void;
  confirmLoadRecent: () => Promise<void>;
  cancelLoadRecent: () => void;
  
  // UI actions
  setIsFilterSheetOpen: (open: boolean) => void;
  setIsLocalFilterSheetOpen: (open: boolean) => void;
}

// New structured context type with proper namespacing
export interface AppContextType {
  // Core app state
  isMounted: boolean;
  userContext?: UserContext;
  userContextError?: Error;
  
  // UI state
  ui: {
    activeSourceTab: 'local' | 'github';
    loadingStatus: LoadingStatus;
    error: string | null;
    isFilterSheetOpen: boolean;
    isLocalFilterSheetOpen: boolean;
    showSwitchConfirmDialog: boolean;
    showLoadRecentConfirmDialog: boolean;
    nextTabValue: 'local' | 'github' | null;
    projectToLoadId: string | null;
    loadConfirmationMessage: string;
  };

  // Current workspace/session
  workspace: {
    analysisResult: AnalysisResultData | null;
    selectedFiles: string[];
    excludeFolders: string;
    fileTypes: string;
    currentProjectId: string | null;
    tokenCount: number;
    tokenDetails: import('../../../hooks/useTokenCalculator').TokenCountDetails | null;
    githubRepoInfo?: GitHubRepoInfo;
  };

  // Domain-specific modules
  github: {
    repos: GitHubRepo[];
    selectedRepoFullName: string | null;
    branches: GitHubBranch[];
    selectedBranchName: string | null;
    githubTree: GitHubTreeItem[] | null;
    isGithubTreeTruncated: boolean;
    githubSelectionError: string | null;
    handleRepoChange: (repoFullName: string) => void;
    handleBranchChange: (branchName: string, excludeFolders: string, fileTypes: string) => Promise<any> | null;
    resetGitHubState: () => void;
    setSelectedRepoFullName: (name: string | null) => void;
    setSelectedBranchName: (name: string | null) => void;
  };

  local: {
    handleDirectorySelection: (files: File[], rootHandle?: FileSystemDirectoryHandle, excludeFolders?: string, fileTypes?: string) => Promise<any>;
    handleReloadLocalProject: (project: Project) => Promise<AnalysisResultData | null>;
    processFiles: (files: File[], excludeFoldersList: string[], allowedFileTypesList: string[]) => Promise<AnalysisResultData>;
  };

  projects: {
    items: Project[];
    createProject: (projectData: any) => Promise<string>;
    updateProjectAccess: (projectId: string) => Promise<void>;
    handlePinProject: (projectId: string, isPinned: boolean) => Promise<void>;
    handleRemoveProject: (projectId: string) => Promise<boolean>;
    handleRenameProject: (projectId: string, newName: string) => Promise<void>;
    findOrCreateGitHubProject: (repoFullName: string, branchName: string) => Promise<string>;
    getProjectById: (projectId: string) => Project | undefined;
  };

  // Top-level actions
  actions: {
    // Auth actions
    handleGitHubLogin: () => void;
    handleGitHubLogout: () => Promise<void>;
    
    // Workspace actions
    handleResetWorkspace: () => void;
    handleTabChangeAttempt: (newTabValue: 'local' | 'github') => void;
    handleUploadComplete: (files: File[], rootHandle?: FileSystemDirectoryHandle) => Promise<void>;
    handleLoadProject: (projectId: string) => Promise<void>;
    handleBranchChange: (branchName: string) => Promise<void>;
    
    // Filter actions
    handleSaveFilters: (newExclusions: string) => Promise<void>;
    handleSaveLocalFilters: (newExclusions: string, newFileTypes: string) => Promise<void>;
    
    // File selection and token actions
    handleSelectedFilesChange: (filesOrUpdater: string[] | ((prev: string[]) => string[])) => void;
    handleTokenCountChange: (count: number, details?: import('../../../hooks/useTokenCalculator').TokenCountDetails) => void;
    
    // Dialog actions
    confirmTabSwitch: () => void;
    cancelTabSwitch: () => void;
    confirmLoadRecent: () => Promise<void>;
    cancelLoadRecent: () => void;
    
    // UI actions
    setIsFilterSheetOpen: (open: boolean) => void;
    setIsLocalFilterSheetOpen: (open: boolean) => void;
  };
}