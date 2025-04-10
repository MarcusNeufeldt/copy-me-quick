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

export interface FileSelectorProps {
  dataSource: DataSource;
  selectedFiles: string[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  maxTokens: number;
  onTokenCountChange: (count: number) => void;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export interface AnalysisResultProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateCurrentProject: (newState: AppState) => void;
  tokenCount: number;
  setTokenCount: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number;
  dataSource: DataSource;
}