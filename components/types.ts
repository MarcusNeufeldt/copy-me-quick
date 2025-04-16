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
}

export interface Backup {
  id: string;
  timestamp: number;
  description: string;
  selectedFiles: string[];
  fileContents: { [key: string]: string };
}

export interface AppState {
  analysisResult: AnalysisResultData | null;
  selectedFiles: string[];
  excludeFolders: string;
  fileTypes: string;
  backups: Backup[];
}

export interface Project {
  id: string;
  name: string;
  state: AppState;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url: string;
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

// Define LoadingStatus interface here if not already defined/imported elsewhere
interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

export interface FileSelectorProps {
  dataSource: DataSource;
  selectedFiles: string[];
  setSelectedFiles: (filesOrUpdater: string[] | ((prev: string[]) => string[])) => void;
  maxTokens: number;
  // Update onTokenCountChange to match usage in FileSelector
  onTokenCountChange: (count: number) => void;
  // Remove state and setState, they are not directly used by FileSelector
  // state?: AppState;
  // setState?: React.Dispatch<React.SetStateAction<AppState>>;
  allFiles?: FileData[];
  // Add the missing loading status props
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus;
}

export interface AnalysisResultProps {
  // state: AppState; // Removed as AnalysisResult doesn't seem to use the full state directly
  // setState: React.Dispatch<React.SetStateAction<AppState>>; // Removed
  // updateCurrentProject: (newState: AppState) => void; // Removed
  analysisResult: AnalysisResultData | null; // Pass only necessary data
  selectedFiles: string[];
  onSelectedFilesChange: (filesOrUpdater: string[] | ((prev: string[]) => string[])) => void;
  tokenCount: number;
  setTokenCount: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number;
  dataSource: DataSource;
  // Add the missing loading status props
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus;
}