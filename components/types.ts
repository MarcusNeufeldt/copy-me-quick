export interface FileData {
  path: string;
  lines: number;
  content: string;
  size?: number;
}

export interface AnalysisResult {
  summary: {
    total_files: number;
    total_lines: number;
  };
  files: FileData[];
  project_tree: string;
}

export interface Backup {
  id: string;
  timestamp: number;
  description: string;
  selectedFiles: string[];
  fileContents: { [key: string]: string };
}

export interface AppState {
  analysisResult: AnalysisResult | null;
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