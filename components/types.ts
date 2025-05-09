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
  namedSelections?: { [name: string]: string[] };
}

export interface Project {
  id: string;
  name: string;
  sourceType: 'local' | 'github';
  sourceFolderName?: string;
  githubRepoFullName?: string;
  githubBranch?: string;
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
  onTokenCountChange: (count: number) => void;
  allFiles?: FileData[];
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus;
  tokenCount: number;
  namedSelections?: { [name: string]: string[] };
  onSaveNamedSelection?: (name: string, files: string[]) => void;
  onRenameNamedSelection?: (oldName: string, newName: string) => void;
  onDeleteNamedSelection?: (name: string) => void;
}

export interface AnalysisResultProps {
  analysisResult: AnalysisResultData | null;
  selectedFiles: string[];
  onSelectedFilesChange: (filesOrUpdater: string[] | ((prev: string[]) => string[])) => void;
  tokenCount: number;
  setTokenCount: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number;
  dataSource: DataSource;
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus;
  namedSelections: { [name: string]: string[] };
  onSaveNamedSelection: (name: string, files: string[]) => void;
  onRenameNamedSelection: (oldName: string, newName: string) => void;
  onDeleteNamedSelection: (name: string) => void;
}