"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModeToggle } from "@/components/ui/mode-toggle";
import ProjectSelector from '@/components/ProjectSelector';
import FileUploadSection from '@/components/FileUploadSection';
import AnalysisResult from '@/components/AnalysisResult';
import { AppState, Project, FileData, AnalysisResultData, DataSource, GitHubRepoInfo } from '@/components/types';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { GithubIcon, RotateCcw, Code2, GitBranchPlus, LayoutGrid, Github, CheckCircle, XCircle, GitBranch, BookMarked, Computer, Loader2, ShieldCheck, Info, RefreshCw, Filter } from 'lucide-react';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileSelector from '@/components/FileSelector';
import RecentProjectsDisplay from '@/components/RecentProjectsDisplay'; // Added Import
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { formatDistanceToNow } from 'date-fns';
import { saveDirectoryHandle, getDirectoryHandle } from '@/lib/indexeddb';
import { TokenCountDetails } from '@/hooks/useTokenCalculator';
import GitHubFilterManager from '@/components/GitHubFilterManager';
import { toast, Toaster } from 'sonner';

// Dynamically import Analytics with error handling
const AnalyticsComponent = dynamic(
  () => import('@vercel/analytics/react').then((mod) => mod.Analytics).catch(() => () => null),
  { ssr: false, loading: () => null }
);

const MAX_TOKENS = 1048576;
const MAX_RECENT_PROJECTS = 10; // Max number of recent projects to store

const baseExclusions = [
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'obj',
  '.vscode',
  '.idea',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '*.tmp',
  '*.temp',
  'coverage',
  // Note: .github is intentionally NOT excluded by default to support GitHub Actions workflows
];

const defaultProjectTypes = [
  { value: "none", label: "None", excludeFolders: baseExclusions, fileTypes: ['*'] },
  { value: "nextjs", label: "Next.js", excludeFolders: [...baseExclusions, '.next', 'out'], fileTypes: ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md'] },
  { value: "react", label: "React", excludeFolders: baseExclusions, fileTypes: ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md'] },
  { value: "vue", label: "Vue.js", excludeFolders: [...baseExclusions, '.nuxt'], fileTypes: ['.vue', '.js', '.ts', '.css', '.scss', '.json', '.md'] },
  { value: "angular", label: "Angular", excludeFolders: baseExclusions, fileTypes: ['.ts', '.html', '.css', '.scss', '.json', '.md'] },
  { value: "svelte", label: "Svelte", excludeFolders: baseExclusions, fileTypes: ['.svelte', '.js', '.ts', '.css', '.scss', '.json', '.md'] },
  { value: "flask", label: "Flask", excludeFolders: [...baseExclusions, 'venv', '__pycache__', '*.pyc', 'migrations'], fileTypes: ['.py', '.html', '.css', '.js', '.json', '.md'] },
  { value: "django", label: "Django", excludeFolders: [...baseExclusions, 'venv', '__pycache__', '*.pyc', 'migrations'], fileTypes: ['.py', '.html', '.css', '.js', '.json', '.md'] },
  { value: "express", label: "Express.js", excludeFolders: baseExclusions, fileTypes: ['.js', '.ts', '.json', '.md'] },
  { value: "springboot", label: "Spring Boot", excludeFolders: [...baseExclusions, '.gradle', 'gradle'], fileTypes: ['.java', '.xml', '.properties', '.yml', '.md'] },
  { value: "dotnet", label: ".NET", excludeFolders: [...baseExclusions, 'packages', 'TestResults'], fileTypes: ['.cs', '.cshtml', '.csproj', '.sln', '.json', '.md'] },
];

// Default initial state, safe for server rendering
const initialAppState: AppState = {
  analysisResult: null,
  selectedFiles: [],
  excludeFolders: 'node_modules,.git,dist,.next,package-lock.json,yarn.lock,pnpm-lock.yaml',
  fileTypes: '.js,.jsx,.ts,.tsx,.py',
};

interface GitHubUser {
  login: string;
  avatarUrl?: string;
  name?: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
  };
  default_branch: string;
}

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

interface GitHubTreeItem {
  path: string;
  mode: string; // e.g., "100644"
  type: 'blob' | 'tree' | 'commit'; // file | folder | submodule
  sha: string;
  size?: number; // Only present for blobs
  url: string;
}

// Unified Loading State Type
interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

// Add formatFileSize function definition
function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// --- Helper to recursively get files from a directory handle (move from FileUploadSection) ---
async function getFilesFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  path: string = '',
  includeRootName: boolean = true
): Promise<File[]> {
  const files: File[] = [];
  
  // If this is the root call (path is empty) and we should include root name,
  // use the directory handle's name as the root folder name
  const rootPrefix = path === '' && includeRootName ? dirHandle.name : '';
  
  // @ts-ignore: .values() is not yet in TypeScript's lib.dom.d.ts
  for await (const entry of (dirHandle as any).values()) {
    let newPath: string;
    
    if (path === '' && includeRootName) {
      // Root level: include the directory name
      newPath = `${rootPrefix}/${entry.name}`;
    } else if (path === '') {
      // Root level without including root name
      newPath = entry.name;
    } else {
      // Nested path
      newPath = `${path}/${entry.name}`;
    }
    
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      Object.defineProperty(file, 'webkitRelativePath', {
        value: newPath,
        writable: true,
        enumerable: true,
      });
      files.push(file);
    } else if (entry.kind === 'directory') {
      files.push(...(await getFilesFromHandle(entry, newPath, false))); // Don't include root name for recursive calls
    }
  }
  return files;
}

export default function ClientPageRoot() {
  // Initialize state with server-safe defaults
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [state, setState] = useState<AppState>(initialAppState);
  const [projectTypes, setProjectTypes] = useState(() => defaultProjectTypes); // Keep default types initially
  const [isMounted, setIsMounted] = useState(false); // Track client-side mount
  const [activeSourceTab, setActiveSourceTab] = useState<'local' | 'github'>('local'); // 'local' or 'github'

  // State for confirmation dialog
  const [showSwitchConfirmDialog, setShowSwitchConfirmDialog] = useState(false);
  const [nextTabValue, setNextTabValue] = useState<'local' | 'github' | null>(null);
  // State for Load Recent Project confirmation
  const [showLoadRecentConfirmDialog, setShowLoadRecentConfirmDialog] = useState(false);
  const [projectToLoadId, setProjectToLoadId] = useState<string | null>(null);
  const [loadConfirmationMessage, setLoadConfirmationMessage] = useState<string>('');

  // Unified Loading State
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({ isLoading: false, message: null });

  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenDetails, setTokenDetails] = useState<TokenCountDetails | null>(null);
  const [projectTypeSelected, setProjectTypeSelected] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);

  // State for GitHub repo/branch selection
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string | null>(null);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [githubSelectionError, setGithubSelectionError] = useState<string | null>(null); // Separate error state for selection

  const [fileLoadingProgress, setFileLoadingProgress] = useState({ current: 0, total: 0 });
  const [githubTree, setGithubTree] = useState<GitHubTreeItem[] | null>(null);
  const [isGithubTreeTruncated, setIsGithubTreeTruncated] = useState(false);
  const [fileLoadingMessage, setFileLoadingMessage] = useState<string | null>(null); // Keep this for specific warnings
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  
  // Refs for stable filter handling
  const excludeFoldersRef = useRef(state.excludeFolders);
  const isInitialMount = useRef(true);

  // Load state from localStorage only on the client after mount
  useEffect(() => {
    setIsMounted(true);
    console.log("[Presets] Initial mount effect running.");

    // Fetch GitHub user data if token might exist (client-side)
    const checkGitHubAuth = async () => {
      setLoadingStatus({ isLoading: true, message: 'Checking GitHub connection...' });
      setGithubError(null);
      try {
        const response = await fetch('/api/auth/github/user');
        if (response.ok) {
          const user: GitHubUser = await response.json();
          setGithubUser(user);
        } else if (response.status === 401) {
          setGithubUser(null);
        } else {
          const errorData = await response.json();
          setGithubError(errorData.error || 'Failed to check GitHub status');
          setGithubUser(null);
        }
      } catch (err) {
        console.error("Error checking GitHub auth:", err);
        setGithubError('Network error checking GitHub status');
        setGithubUser(null);
      } finally {
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    checkGitHubAuth();
    
    const savedProjectsStr = localStorage.getItem('codebaseReaderProjects');
    const loadedProjects: Project[] = savedProjectsStr ? JSON.parse(savedProjectsStr) : [];
    setProjects(loadedProjects);

    let stateFromStorage: Partial<AppState> = {};
    let tabToLoad: 'local' | 'github' = 'local';
    
    const savedProjectId = localStorage.getItem('currentProjectId');
    const projectToLoad = savedProjectId ? loadedProjects.find(p => p.id === savedProjectId) : undefined;

    if (projectToLoad) {
      console.log(`[State] Loading project state for ${projectToLoad.name}`);
      stateFromStorage = projectToLoad.state;
      tabToLoad = projectToLoad.sourceType || 'local';
      setCurrentProjectId(projectToLoad.id);
      if (projectToLoad.sourceType === 'github') {
        setSelectedRepoFullName(projectToLoad.githubRepoFullName || null);
        setSelectedBranchName(projectToLoad.githubBranch || null);
      }
    }

    const finalState = { ...initialAppState, ...stateFromStorage };
    const savedGlobalFilters = localStorage.getItem('githubGlobalExclusions');
    if (tabToLoad === 'github' || typeof finalState.excludeFolders !== 'string') {
      finalState.excludeFolders = savedGlobalFilters || initialAppState.excludeFolders;
    }

    setState(finalState);
    setActiveSourceTab(tabToLoad);

    console.groupCollapsed("[Presets] Attempting to load projectTemplates from localStorage");
    const savedTemplatesStr = localStorage.getItem('projectTemplates');
    console.log("[Presets] Raw string from localStorage:", savedTemplatesStr);
    if (savedTemplatesStr) {
      try {
        const parsedTemplates = JSON.parse(savedTemplatesStr);
        console.log("[Presets] Successfully parsed templates:", parsedTemplates);
        setProjectTypes(parsedTemplates);
      } catch (e) {
        console.error("[Presets] Failed to parse project templates from localStorage:", e);
        console.warn("[Presets] Using default project types due to parsing error.");
      }
    } else {
      console.log("[Presets] No saved templates found in localStorage. Using defaults.");
    }
    console.groupEnd();
  }, []);

  // Fetch Repos when GitHub user is loaded
  useEffect(() => {
    if (!githubUser) {
      setRepos([]);
      setSelectedRepoFullName(null);
      return;
    }

    const fetchRepos = async () => {
      // Use unified loading state
      setLoadingStatus({ isLoading: true, message: 'Fetching repositories...' });
      setGithubSelectionError(null);
      setRepos([]);
      try {
        const response = await fetch('/api/github/repos');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch repositories');
        }
        const repoData: GitHubRepo[] = await response.json();
        setRepos(repoData);
      } catch (error: any) {
        console.error("Error fetching repos:", error);
        setGithubSelectionError(error.message);
        if (error.message === 'Invalid GitHub token') setGithubUser(null);
      } finally {
        // Clear loading state
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    fetchRepos();
  }, [githubUser]);

  // Keep ref updated with current filter state
  useEffect(() => {
    excludeFoldersRef.current = state.excludeFolders;
  }, [state.excludeFolders]);

  // Fetch Branches when a repo is selected
  const handleRepoChange = useCallback((repoFullName: string) => {
    setSelectedRepoFullName(repoFullName);
    setSelectedBranchName(null); // Reset branch selection
    setBranches([]); // Clear old branches
    setGithubSelectionError(null);

    if (!repoFullName) {
      return;
    }

    const selectedRepo = repos.find(r => r.full_name === repoFullName);
    if (!selectedRepo) return;

    const fetchBranches = async () => {
      // Use unified loading state
      setLoadingStatus({ isLoading: true, message: 'Fetching branches...' });
      setGithubSelectionError(null);
      try {
        const response = await fetch(`/api/github/branches?owner=${selectedRepo.owner.login}&repo=${selectedRepo.name}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch branches');
        }
        const branchData: GitHubBranch[] = await response.json();
        setBranches(branchData);
        const defaultBranch = branchData.find(b => b.name === selectedRepo.default_branch);
        if (defaultBranch) {
            setSelectedBranchName(defaultBranch.name);
        }

      } catch (error: any) {
        console.error("Error fetching branches:", error);
        setGithubSelectionError(error.message);
        if (error.message === 'Invalid GitHub token') setGithubUser(null);
      } finally {
        // Clear loading state
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    fetchBranches();
  }, [repos]);

  // Handle Branch Selection - Modified to fetch tree and manage projects
  const handleBranchChange = useCallback((branchName: string) => {
    // Clear previous GitHub specific state before potentially loading a new project
    setGithubSelectionError(null);
    setGithubTree(null);
    // Don't clear the whole state here, wait until project context is determined
    // setState(prevState => ({ ...prevState, analysisResult: null, selectedFiles: [] }));
    setIsGithubTreeTruncated(false);
    setFileLoadingProgress({ current: 0, total: 0 });
    setFileLoadingMessage(null);

    if (!branchName || !selectedRepoFullName) {
      setSelectedBranchName(branchName); // Update selection display even if invalid
      return;
    }

    // Set the selected branch name immediately for UI responsiveness
    setSelectedBranchName(branchName);

    const selectedRepo = repos.find(r => r.full_name === selectedRepoFullName);
    if (!selectedRepo) return;

    const fetchTreeAndSetProject = async () => {
      setLoadingStatus({ isLoading: true, message: 'Loading file tree...' });
      setGithubSelectionError(null);
      let analysisResultData: AnalysisResultData | null = null;
      let loadedTree: GitHubTreeItem[] | null = null;
      let loadedCommitDate: string | null = null; // Variable to store the date

      try {
        // 1. Fetch Tree Structure
        const apiUrl = `/api/github/tree?owner=${selectedRepo.owner.login}&repo=${selectedRepo.name}&branch=${branchName}`;
        const treeResponse = await fetch(apiUrl);
        const treeData = await treeResponse.json();
        if (!treeResponse.ok) throw new Error(treeData.error || 'Failed to fetch file tree');

        // Apply current filters to the tree
        const excludedPatterns = (excludeFoldersRef.current || '').split(',').map(f => f.trim()).filter(Boolean);
        const fullTreeFromAPI: GitHubTreeItem[] = treeData.tree || [];
        
        const filteredApiTree = fullTreeFromAPI.filter(item => {
          if (item.type !== 'blob') {
            return true; // Keep directories
          }
          const pathComponents = item.path.split('/');
          const fileName = pathComponents[pathComponents.length - 1];
          const parentFolders = pathComponents.slice(0, -1);
          
          for (const pattern of excludedPatterns) {
            if (parentFolders.includes(pattern)) {
              return false;
            }
            if (pattern.startsWith('*.')) {
              if (fileName.endsWith(pattern.substring(1))) return false;
            } else if (fileName === pattern) {
              return false;
            }
          }
          
          return true;
        });

        loadedTree = filteredApiTree;
        loadedCommitDate = treeData.commitDate; // Capture the commit date

        // Add formatted file sizes to tree items for display
        const enhancedTree = loadedTree?.map(item => {
          if (item.type === 'blob' && item.size !== undefined) {
            return {
              ...item,
              formattedSize: formatFileSize(item.size)
            };
          }
          return item;
        }) || null;

        setGithubTree(enhancedTree); // Update tree state for FileSelector with enhanced data
        setIsGithubTreeTruncated(treeData.truncated ?? false);

        const totalFileCount = loadedTree?.filter(item => item.type === 'blob').length || 0;
        const totalScannedCount = (fullTreeFromAPI).filter(item => item.type === 'blob').length || 0;
        const filteredCount = totalScannedCount - totalFileCount;
        
        const repoInfo: GitHubRepoInfo = {
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          branch: branchName
        };

        // Initial analysis data (lines/content/tokens will be added)
        analysisResultData = {
          totalFiles: totalFileCount,
          totalLines: 0,
          totalTokens: 0,
          summary: `GitHub repo: ${selectedRepoFullName}, Branch: ${branchName}. ${filteredCount > 0 ? `${filteredCount} files filtered.` : ''}`,
          project_tree: `GitHub Tree Structure for ${selectedRepoFullName}/${branchName}`,
          files: [], // Start with empty files
          commitDate: loadedCommitDate // Store date in analysisResult too
        };

        // 2. Create metadata-only files (no content fetching)
        const filesMetadata: FileData[] = (loadedTree || [])
          .filter(item => item.type === 'blob')
          .map(item => ({
            path: item.path,
            lines: 0, // Set lines to 0 since we don't have content to count
            content: '', // Set content to empty string
            size: item.size,
            sha: item.sha,
            dataSourceType: 'github'
          }));

        // Update the analysisResultData with metadata-only files
        if (analysisResultData) {
          analysisResultData.totalLines = 0; // No line count without content
          analysisResultData.files = filesMetadata;
        }

        // 3. Find or Create Project Context
        setLoadingStatus({ isLoading: true, message: 'Setting project context...' });
        let targetProjectId: string | null = null;
        let finalState: AppState;
        let projectExists = false;

        const existingProject = projects.find(
          (p) =>
            p.sourceType === 'github' &&
            p.githubRepoFullName === selectedRepoFullName &&
            p.githubBranch === branchName
        );

        if (existingProject) {
          console.log(`Found existing GitHub project ID: ${existingProject.id}`);
          projectExists = true;
          targetProjectId = existingProject.id;
          // Merge new analysis result with existing state
          finalState = {
            ...existingProject.state,
            analysisResult: analysisResultData, // Overwrite with new analysis data (includes commitDate)
            selectedFiles: [], // Reset selection for GitHub load?
          };
          // Update lastAccessed for existing project
          setProjects(prevProjects =>
            prevProjects.map(p =>
              p.id === targetProjectId ? { ...p, state: finalState, lastAccessed: Date.now() } : p
            )
          );
        } else {
          console.log(`Creating new project for GitHub: ${selectedRepoFullName}/${branchName}`);
          targetProjectId = Date.now().toString();
          finalState = {
            ...initialAppState,
            analysisResult: analysisResultData, // Includes commitDate
            selectedFiles: [],
          };
          const newProject: Project = {
            id: targetProjectId,
            name: `${selectedRepoFullName} / ${branchName}`, // More readable format
            sourceType: 'github',
            githubRepoFullName: selectedRepoFullName,
            githubBranch: branchName,
            state: finalState, // Ensure the finalState (with commitDate) is saved here
            lastAccessed: Date.now(),
          };
          setProjects(prevProjects => [...prevProjects, newProject]);
        }

        // 4. Update Main State and Project Array
        setState(finalState);
        setCurrentProjectId(targetProjectId);

        // This explicit update might be redundant if the setProjects above correctly updates the project
        // However, ensuring the state within the *specific* project object in the array is updated is key.
        if (projectExists && targetProjectId) {
          setProjects(prevProjects =>
            prevProjects.map(p =>
              p.id === targetProjectId ? { ...p, state: finalState, lastAccessed: Date.now() } : p
            )
          );
        }
        console.log(`GitHub project context set. Current Project ID: ${targetProjectId}`);

      } catch (error) {
        console.error("Error during GitHub branch change/load:", error);
        setGithubSelectionError(error instanceof Error ? error.message : String(error));
        setGithubTree(null);
        setState(initialAppState); // Reset state on error?
        setCurrentProjectId(null);
        if (error instanceof Error && error.message === 'Invalid GitHub token') setGithubUser(null);
      } finally {
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    fetchTreeAndSetProject();

  }, [repos, selectedRepoFullName, projects, setProjects, setState, setCurrentProjectId, setLoadingStatus]); // Removed state.excludeFolders dependency

  // Handler for saving filters - now saves globally for GitHub tab
  const handleSaveFilters = useCallback((newExclusions: string) => {
    localStorage.setItem('githubGlobalExclusions', newExclusions);
    setState(prevState => ({ ...prevState, excludeFolders: newExclusions }));
  }, []);

  // React to filter changes and refresh GitHub tree
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (activeSourceTab === 'github' && selectedBranchName) {
      toast("Filters updated. Refreshing file tree...");
      handleBranchChange(selectedBranchName);
    }
  }, [state.excludeFolders, handleBranchChange, activeSourceTab, selectedBranchName]);

  // Persist state changes to localStorage
  useEffect(() => {
    console.log("[State] Saving state. isMounted:", isMounted, "Current Project ID:", currentProjectId);
    if (!isMounted) {
      console.log("[State] Skipping save because component is not mounted yet.");
      return;
    }

    // --- START MODIFICATION FOR RECENT PROJECTS ---
    let projectsToSave = projects.map(p => {
        // Destructure the state, excluding analysisResult for lightweight storage
        const { analysisResult, ...stateToSave } = p.state;
        return {
            ...p,
            state: stateToSave,
            // Ensure lastAccessed is present, default to 0 if not (for sorting)
            lastAccessed: p.lastAccessed || 0,
        };
    });

    // Sort projects by lastAccessed in descending order
    projectsToSave.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

    // Limit the number of recent projects
    if (projectsToSave.length > MAX_RECENT_PROJECTS) {
      projectsToSave = projectsToSave.slice(0, MAX_RECENT_PROJECTS);
    }

    console.log(`[State Save] Saving ${projectsToSave.length} projects to localStorage (lightweight, sorted, truncated)...`);
    localStorage.setItem('codebaseReaderProjects', JSON.stringify(projectsToSave));
    // --- END MODIFICATION FOR RECENT PROJECTS ---

    localStorage.setItem('currentProjectId', currentProjectId || '');

    console.groupCollapsed("[Presets] Attempting to save projectTemplates to localStorage");
    try {
        const templatesToSaveString = JSON.stringify(projectTypes);
        localStorage.setItem('projectTemplates', templatesToSaveString);
    } catch (e) {
        console.error("[Presets] Failed to stringify or save project templates:", e);
    }
    console.groupEnd();

}, [projects, currentProjectId, projectTypes, isMounted]);

  const updateCurrentProject = useCallback((newState: AppState) => {
    // Directly update the active state. Persisted state update is handled by save handlers.
    setState(newState);
  }, []); // No dependencies, setState is stable

  // Helper function to get root folder name from file list
  const getRootFolderName = (files: FileData[]): string => {
    if (!files || files.length === 0) return 'Untitled Project';
    
    // Find the common root folder name by looking at all file paths
    const allPaths = files.map(f => f.path);
    
    // If there's only one file in the root, use its parent folder or default
    if (allPaths.length === 1) {
      const parts = allPaths[0].split('/');
      return parts.length > 1 ? parts[0] : 'Untitled Project';
    }
    
    // Find the common prefix among all paths
    let commonPrefix = allPaths[0];
    for (let i = 1; i < allPaths.length; i++) {
      let j = 0;
      while (j < Math.min(commonPrefix.length, allPaths[i].length) && 
             commonPrefix[j] === allPaths[i][j]) {
        j++;
      }
      commonPrefix = commonPrefix.substring(0, j);
    }
    
    // Extract the root folder name
    const parts = commonPrefix.split('/');
    const rootFolder = parts[0];
    
    // If we have a meaningful root folder name, use it
    if (rootFolder && rootFolder.length > 0 && !rootFolder.includes('.')) {
      return rootFolder;
    }
    
    // Fallback: use the first folder from any path that has folders
    for (const path of allPaths) {
      const pathParts = path.split('/');
      if (pathParts.length > 1 && pathParts[0] && !pathParts[0].includes('.')) {
        return pathParts[0];
      }
    }
    
    return 'Untitled Project';
  };

  // MODIFIED handleUploadComplete
  const handleUploadComplete = useCallback(async (
    newAnalysisResult: AnalysisResultData,
    rootHandle?: FileSystemDirectoryHandle
  ) => {
    console.log('Upload complete, processing project context. Timestamp:', newAnalysisResult.uploadTimestamp);
    const folderName = getRootFolderName(newAnalysisResult.files);
    let newCurrentProjectId: string | null = null;
    let finalState: AppState | null = null;

    setProjects(prevProjects => {
      const existingProjectIndex = prevProjects.findIndex((p) => p.sourceType === 'local' && p.sourceFolderName === folderName);
      let updatedProjects = [...prevProjects];
      if (existingProjectIndex !== -1) {
        const existingProject = updatedProjects[existingProjectIndex];
        newCurrentProjectId = existingProject.id;
        const updatedState: AppState = { ...existingProject.state, analysisResult: newAnalysisResult, selectedFiles: [] };
        updatedProjects[existingProjectIndex] = { ...existingProject, state: updatedState, lastAccessed: Date.now(), hasDirectoryHandle: !!rootHandle };
        finalState = updatedState;
      } else {
        newCurrentProjectId = Date.now().toString();
        const newProjectState: AppState = { ...state, analysisResult: newAnalysisResult, selectedFiles: [] };
        const newProject: Project = {
          id: newCurrentProjectId,
          name: folderName,
          sourceType: 'local',
          sourceFolderName: folderName,
          state: newProjectState,
          lastAccessed: Date.now(),
          hasDirectoryHandle: !!rootHandle,
        };
        updatedProjects = [...prevProjects, newProject];
        finalState = newProjectState;
      }
      return updatedProjects;
    });

    // Save the handle to IndexedDB after the project ID is known
    if (rootHandle && newCurrentProjectId) {
      await saveDirectoryHandle(newCurrentProjectId, rootHandle);
    }
    
    if (finalState) {
      setState(finalState);
    }
    setCurrentProjectId(newCurrentProjectId);
  }, [setProjects, setCurrentProjectId, setState, state]);

  // NEW: Function to reload a local project from its handle
  const handleReloadLocalProject = useCallback(async (projectToLoad: Project) => {
    setLoadingStatus({ isLoading: true, message: `Re-opening ${projectToLoad.name}...` });
    setError(null);
    try {
      const handle = await getDirectoryHandle(projectToLoad.id);
      if (!handle) {
        throw new Error("Folder permission handle not found. Please re-select the folder manually.");
      }
      // @ts-ignore: .requestPermission() is not yet in TypeScript's lib.dom.d.ts
      await (handle as any).requestPermission({ mode: 'read' });
      const fileList = await getFilesFromHandle(handle);
      // Filtering and processing logic (same as in FileUploadSection)
      const excludedFolders = projectToLoad.state.excludeFolders.split(',').map(f => f.trim()).filter(f => f);
      const allowedFileTypes = projectToLoad.state.fileTypes.split(',').map(t => t.trim()).filter(t => t);
      console.log('Project loading - Excluded folders:', excludedFolders);
      let newFileContentsMap = new Map<string, FileData>();
      let newTotalLines = 0;
      for (const file of fileList) {
        // @ts-ignore
        const relativePath = file.webkitRelativePath || file.name;
        if (!relativePath) { continue; }
        const pathComponents = relativePath.split('/');
        const excludedComponent = pathComponents.slice(0, -1).find(component => excludedFolders.includes(component));
        if (excludedComponent) { 
          console.log(`Project loading - Excluding file ${relativePath} due to folder: ${excludedComponent}`);
          continue; 
        }
        const fileExtension = relativePath.includes('.') ? '.' + relativePath.split('.').pop() : '';
        const fileMatchesType = allowedFileTypes.length === 0 || allowedFileTypes.includes('*') || allowedFileTypes.some(type => {
            return relativePath === type || (type.startsWith('.') && fileExtension === type);
        });
        if (!fileMatchesType) { continue; }
        const content = await file.text();
        const lines = content.split('\n').length;
        newFileContentsMap.set(relativePath, { path: relativePath, lines, content, size: file.size, dataSourceType: 'local' });
        newTotalLines += lines;
      }
      const finalFiles: FileData[] = Array.from(newFileContentsMap.values());
      const newAnalysisResult: AnalysisResultData = {
        totalFiles: finalFiles.length,
        totalLines: newTotalLines,
        totalTokens: 0,
        summary: `Project ${projectToLoad.name} reloaded.`,
        project_tree: '', // generateProjectTree(finalFiles) if you move the util
        files: finalFiles,
        uploadTimestamp: Date.now(),
      };
      // Now set the state
      const newState = { ...projectToLoad.state, analysisResult: newAnalysisResult, selectedFiles: [] };
      setState(newState);
      setCurrentProjectId(projectToLoad.id);
      setProjects(prev => prev.map(p => p.id === projectToLoad.id ? { ...p, lastAccessed: Date.now(), state: newState } : p));
    } catch (err: any) {
      console.error("Failed to auto-reload local project:", err);
      setError(`Could not automatically open '${projectToLoad.name}'. The folder may have been moved or permissions were denied. Please select it manually.`);
      // Reset to a state where the user can manually select the folder
      setState(projectToLoad.state); 
      setCurrentProjectId(projectToLoad.id);
    } finally {
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [setLoadingStatus, setError, setState, setCurrentProjectId, setProjects]);

  const handleProjectTemplateUpdate = useCallback((updatedTemplates: typeof projectTypes) => {
    console.groupCollapsed("[Presets] handleProjectTemplateUpdate triggered");
    console.log("[Presets] Received updated templates:", updatedTemplates);
    setProjectTypes(updatedTemplates);
    console.groupEnd();
  }, []); // Dependency: setProjectTypes is stable

  // Wrapper function to handle the new token calculator signature
  const handleTokenCountChange = useCallback((count: number, details?: TokenCountDetails) => {
    setTokenCount(count);
    setTokenDetails(details || null);
  }, []);

  // Create stable GitHub repo info to avoid object recreation
  const githubRepoInfo = useMemo(() => {
    if (selectedRepoFullName && selectedBranchName) {
      return {
        owner: selectedRepoFullName.split('/')[0],
        repo: selectedRepoFullName.split('/')[1],
        branch: selectedBranchName
      };
    }
    return undefined;
  }, [selectedRepoFullName, selectedBranchName]);

  // This callback is passed to AnalysisResult for its internal state changes
  const handleSelectedFilesChange = useCallback(async (filesOrUpdater: string[] | ((prev: string[]) => string[])) => {
    // First, update the selected files state
    let newSelectedFiles: string[] = [];
    setState(prevState => {
      // Calculate the new selectedFiles state
      newSelectedFiles = typeof filesOrUpdater === 'function'
        ? filesOrUpdater(prevState.selectedFiles)
        : filesOrUpdater;

      // Only update if the value actually changed to prevent unnecessary state updates
      if (prevState.selectedFiles !== newSelectedFiles) {
        return {
          ...prevState,
          selectedFiles: newSelectedFiles
        };
      }
      // If no change, return the previous state to avoid triggering effects
      return prevState;
    });

    // Check if we need to fetch content for any newly selected GitHub files
    if (activeSourceTab === 'github' && githubRepoInfo && state.analysisResult) {
      const previousSelectedFiles = state.selectedFiles;
      const newlySelectedFiles = newSelectedFiles.filter(path => !previousSelectedFiles.includes(path));
      
      if (newlySelectedFiles.length > 0) {
        // Find files that need content fetching
        const filesToFetch = state.analysisResult.files.filter(file => 
          newlySelectedFiles.includes(file.path) && 
          file.dataSourceType === 'github' && 
          !file.content
        );

        if (filesToFetch.length > 0) {
          setLoadingStatus({ isLoading: true, message: `Fetching content for ${filesToFetch.length} files for token calculation...` });
          
          try {
            const fetchPromises = filesToFetch.map(async (file) => {
              try {
                const contentUrl = `/api/github/content?owner=${githubRepoInfo.owner}&repo=${githubRepoInfo.repo}&path=${encodeURIComponent(file.path)}`;
                const response = await fetch(contentUrl);
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || `Failed to fetch content (${response.status})`);
                }
                const data = await response.json();
                return { path: file.path, content: data.content, lines: data.content.split('\n').length };
              } catch (err) {
                console.error(`Failed to fetch content for ${file.path}:`, err);
                return { path: file.path, content: '', lines: 0 };
              }
            });

            const fetchedContents = await Promise.all(fetchPromises);

            // Update the state with fetched content
            setState(prevState => {
              if (!prevState.analysisResult) return prevState;
              
              const updatedFiles = prevState.analysisResult.files.map(file => {
                const fetchedContent = fetchedContents.find(fc => fc.path === file.path);
                if (fetchedContent) {
                  return {
                    ...file,
                    content: fetchedContent.content,
                    lines: fetchedContent.lines
                  };
                }
                return file;
              });

              return {
                ...prevState,
                analysisResult: {
                  ...prevState.analysisResult,
                  files: updatedFiles
                }
              };
            });

          } catch (error) {
            console.error('Error fetching file contents for token calculation:', error);
          } finally {
            setLoadingStatus({ isLoading: false, message: null });
          }
        }
      }
    }
  }, [activeSourceTab, githubRepoInfo, state.analysisResult, state.selectedFiles, setLoadingStatus]); // Updated dependencies

  // --- Named Selection Callbacks ---
  // Note: These now *only* update the `projects` state.
  // The main `state` (used by UI components) will be updated by the useEffect
  // that synchronizes `state` with the current project's state from the `projects` array.
  // This ensures a single source of truth and avoids potential race conditions.






 

  // --- START: Logic for Loading Recent Project ---
  const proceedToLoadProject = useCallback((projectIdToLoad: string) => {
    const projectToLoad = projects.find(p => p.id === projectIdToLoad);

    if (!projectToLoad) {
      console.error(`Error: Project with ID ${projectIdToLoad} not found.`);
      setShowLoadRecentConfirmDialog(false);
      setProjectToLoadId(null);
      return;
    }

    console.log(`Proceeding to load project: ${projectToLoad.name} (ID: ${projectIdToLoad})`);

    // Update lastAccessed timestamp
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === projectIdToLoad ? { ...p, lastAccessed: Date.now() } : p
      )
    );

    // FIX: Explicitly set the state and project ID (no useEffect dependency)
    setState(projectToLoad.state);
    setCurrentProjectId(projectIdToLoad);

    if (projectToLoad.sourceType === 'github') {
      setActiveSourceTab('github');
      // These will trigger useEffects to fetch repo details and then branch details/tree
      setSelectedRepoFullName(projectToLoad.githubRepoFullName || null);
      setSelectedBranchName(projectToLoad.githubBranch || null);
      // Note: The actual data fetching (tree, content) for GitHub projects is handled
      // by the useEffects triggered by selectedRepoFullName and handleBranchChange.
      // If the state (analysisResult) was fully persisted, we might load it here.
      // For now, we rely on re-fetching, which is safer for potentially stale data.
      console.log(`Switched to GitHub tab for project ${projectToLoad.name}. Repo: ${projectToLoad.githubRepoFullName}, Branch: ${projectToLoad.githubBranch}`);

    } else if (projectToLoad.sourceType === 'local' && projectToLoad.hasDirectoryHandle) {
      // This is the "happy path" - we have a handle, let's use it.
      console.log(`Attempting to auto-reload local project: ${projectToLoad.name}`);
      setActiveSourceTab('local');
      handleReloadLocalProject(projectToLoad);
    } else if (projectToLoad.sourceType === 'local') {
      // This is the "sad path" - no handle exists, or it failed.
      // This becomes the fallback, not the default.
      console.warn(`Local project ${projectToLoad.name} has no directory handle. Prompting user to re-select.`);
      setActiveSourceTab('local');
      setState(projectToLoad.state);
      setCurrentProjectId(projectToLoad.id);
      setError("Please re-select your project folder to continue. Folder access was not saved.");
      setTimeout(() => setError(null), 5000);
    }

    setShowLoadRecentConfirmDialog(false);
    setProjectToLoadId(null);
  }, [projects, setActiveSourceTab, setSelectedRepoFullName, setSelectedBranchName, setCurrentProjectId, setProjects, setState, handleReloadLocalProject, setError]);

  const handleLoadRecentProject = useCallback((projectIdToLoad: string) => {
    console.log(`Attempting to load recent project ID: ${projectIdToLoad}`);
    const activeProject = projects.find(p => p.id === currentProjectId);
    const projectToLoad = projects.find(p => p.id === projectIdToLoad);

    // Check if there's a loaded project with actual analysis data (not just initial state)
    if (activeProject && activeProject.state.analysisResult && activeProject.state.analysisResult.files.length > 0) {
      console.log(`Active project ${activeProject.name} has data. Showing confirmation dialog.`);
      const message = projectToLoad 
        ? `Loading '${projectToLoad.name}' will replace your current session. Continue?`
        : 'Loading this project will replace your current session. Continue?';
      setLoadConfirmationMessage(message);
      setProjectToLoadId(projectIdToLoad);
      setShowLoadRecentConfirmDialog(true);
    } else {
      console.log("No active project with data, or user confirmed. Proceeding to load.");
      proceedToLoadProject(projectIdToLoad);
    }
  }, [currentProjectId, projects, proceedToLoadProject]);

  const confirmLoadRecent = () => {
    if (projectToLoadId) {
      proceedToLoadProject(projectToLoadId);
    } else {
      console.error("Project ID to load is null, cannot proceed.");
      setShowLoadRecentConfirmDialog(false); // Close dialog
    }
  };

  const cancelLoadRecent = () => {
    setShowLoadRecentConfirmDialog(false);
    setProjectToLoadId(null);
  };

  // Workspace reset function
  const handleResetWorkspace = useCallback(() => {
    console.log("Resetting workspace (preserving projects in localStorage)...");

    // 1. Reset the main application state to initial defaults
    setState(initialAppState);

    // 2. Clear the current project context
    setCurrentProjectId(null);
    // The sync effect will handle saving the cleared currentProjectId to localStorage

    // 3. Reset UI/temporary state elements
    setTokenCount(0);
    setError(null);
    setFileLoadingProgress({ current: 0, total: 0 });
    setFileLoadingMessage(null);
    setProjectTypeSelected(false);
    // Reset GitHub specific UI state
    setSelectedRepoFullName(null);
    setSelectedBranchName(null);
    setGithubTree(null);
    setIsGithubTreeTruncated(false);
    setGithubSelectionError(null);
    setLoadingStatus({ isLoading: false, message: null });
    // Active tab will be reset if needed by tab switching logic, or default to 'local' via initialAppState

    console.log("Workspace reset complete. Active session cleared.");
  }, [setState, setCurrentProjectId, setTokenCount, setError, setFileLoadingProgress, setFileLoadingMessage, setProjectTypeSelected, setSelectedRepoFullName, setSelectedBranchName, setGithubTree, setIsGithubTreeTruncated, setGithubSelectionError, setLoadingStatus]);

  // --- Project Management Handlers ---
  const handlePinProject = useCallback((projectId: string, isPinned: boolean) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, isPinned } : p));
    setError(isPinned ? `Project pinned to top.` : `Project unpinned.`);
    setTimeout(() => setError(null), 3000);
  }, [setProjects, setError]);

  const handleRemoveProject = useCallback((projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    // If we remove the currently active project, clear the workspace
    if (currentProjectId === projectId) {
      handleResetWorkspace();
    }
    setError(`Project removed from list.`);
    setTimeout(() => setError(null), 3000);
  }, [setProjects, currentProjectId, handleResetWorkspace, setError]);

  const handleRenameProject = useCallback((projectId: string, newName: string) => {
    if (!newName.trim()) {
      setError("Project name cannot be empty.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: newName.trim() } : p));
    setError(`Project renamed successfully.`);
    setTimeout(() => setError(null), 3000);
  }, [setProjects, setError]);
  // --- END: Logic for Loading Recent Project ---


  // Persist state changes to localStorage (Simplified to depend on projects and currentProjectId)
  useEffect(() => {
    console.log("[State/Filter] Saving state. isMounted:", isMounted, "Current Project ID:", currentProjectId);
    if (!isMounted) {
      console.log("[State/Filter] Skipping save because component is not mounted yet.");
      return;
    }

    // Save projects (excluding analysisResult and excludeFolders for GitHub projects)
    let projectsToSaveForStorage = projects.map(p => {
      let stateToSave: Partial<AppState> = { ...p.state };
      delete stateToSave.analysisResult;
      // Don't save excludeFolders for GitHub projects since they use global filters
      if (p.sourceType === 'github') {
        delete stateToSave.excludeFolders;
      }
      return { ...p, state: stateToSave as AppState, lastAccessed: p.lastAccessed || 0 };
    });

    // Sort projects by lastAccessed in descending order
    projectsToSaveForStorage.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

    // Limit the number of recent projects
    if (projectsToSaveForStorage.length > MAX_RECENT_PROJECTS) {
      projectsToSaveForStorage = projectsToSaveForStorage.slice(0, MAX_RECENT_PROJECTS);
    }

    console.log(`[State] Saving ${projectsToSaveForStorage.length} projects to localStorage (lightweight)...`);
    localStorage.setItem('codebaseReaderProjects', JSON.stringify(projectsToSaveForStorage));

    // Save current project ID
    console.log(`[State] Saving currentProjectId: ${currentProjectId}`);
    localStorage.setItem('currentProjectId', currentProjectId || '');

    // Save project types (templates)
    console.groupCollapsed("[Presets] Attempting to save projectTemplates to localStorage");
    try {
      const templatesToSaveString = JSON.stringify(projectTypes);
      localStorage.setItem('projectTemplates', templatesToSaveString);
      console.log("[Presets] Saved templates:", projectTypes);
    } catch (e) {
      console.error("[Presets] Failed to stringify or save project templates:", e);
    }
    console.groupEnd();

  }, [projects, currentProjectId, projectTypes, isMounted]); // Dependencies: projects, currentProjectId, projectTypes, isMounted

  // --- START: Add back missing handlers ---
  const handleGitHubLogin = () => {
    window.location.href = '/api/auth/github/login';
  };

  const handleGitHubLogout = async () => {
    setLoadingStatus({ isLoading: true, message: 'Logging out from GitHub...' });
    try {
      const response = await fetch('/api/auth/github/logout', { method: 'POST', credentials: 'include' });
      if (response.ok) {
        setGithubUser(null);
        setGithubError(null);
        setSelectedRepoFullName(null);
        setSelectedBranchName(null);
        setBranches([]);
        setRepos([]);
        setGithubTree(null);
        setActiveSourceTab('local'); // Switch back to local tab on logout
        setState(prevState => ({ ...prevState, analysisResult: null, selectedFiles: [] })); // Clear analysis
        setCurrentProjectId(null); // Clear current project ID
        console.log("GitHub logout successful");
      } else {
        console.error("GitHub logout failed:", await response.text());
        setGithubError("Logout failed. Please try again.");
      }
    } catch (error) {
      console.error("Error during GitHub logout:", error);
      setGithubError("Network error during logout.");
    } finally {
      setLoadingStatus({ isLoading: false, message: null });
    }
  };

  // ----- Tab Switching Logic with Confirmation -----
  const handleTabChangeAttempt = (newTabValue: 'local' | 'github') => {
    if (newTabValue !== activeSourceTab) { // Only act if tab is actually changing
      // Check if a project is currently loaded (use a reliable indicator)
      const isProjectLoaded = !!currentProjectId && !!state.analysisResult; // Check both ID and analysis data

      if (isProjectLoaded) {
        console.log("Project loaded, showing confirmation dialog for tab switch.");
        setNextTabValue(newTabValue); // Store the tab we want to switch to
        setShowSwitchConfirmDialog(true); // Open the dialog
      } else {
        // No project loaded, switch directly without clearing
        console.log("No project loaded, switching tab directly.");
        // handleResetWorkspace(); // No need to reset if nothing significant is loaded
        setActiveSourceTab(newTabValue);
      }
    }
  };

  const clearActiveAnalysis = () => {
    console.log("Clearing active analysis session.");
    // Reset the core analysis state, but keep filters like excludeFolders and fileTypes
    setState(prevState => ({
      ...prevState,
      analysisResult: null,
      selectedFiles: [],
    }));
    // Clear the active project ID and related data
    setCurrentProjectId(null);
    setTokenCount(0);
    setTokenDetails(null);
    setError(null);

    // Clear GitHub-specific UI state to ensure a clean slate on the GitHub tab
    // Note: We leave selectedRepoFullName and selectedBranchName as is, so if the user
    // switches back, they can reload the same repo/branch easily. The tree itself is cleared.
    setGithubTree(null);
    setIsGithubTreeTruncated(false);
    setGithubSelectionError(null);
    setFileLoadingMessage(null);
  };

  const confirmTabSwitch = () => {
    console.log("User confirmed tab switch. Switching context.");
    // This is a much lighter reset, only clearing the active view.
    clearActiveAnalysis(); 
    
    if (nextTabValue) {
      setActiveSourceTab(nextTabValue);
    }
    
    setShowSwitchConfirmDialog(false);
    setNextTabValue(null);
  };

  const cancelTabSwitch = () => {
    console.log("User cancelled tab switch.");
    setShowSwitchConfirmDialog(false);
    setNextTabValue(null);
  };
  // --- END: Add back missing handlers ---

  // Prevent rendering potentially mismatched UI before mount
  if (!isMounted) {
    // Optionally, render a simple loading skeleton or spinner here
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-background/50 z-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="relative">
      {/* Toast notifications */}
      <Toaster position="top-center" />
      
      {/* Unified Loading Indicator */}
      {loadingStatus.isLoading && (
        <div className="fixed top-0 left-0 w-full h-1 bg-primary/10 z-50">
          <div
            className="h-full bg-gradient-to-r from-primary to-purple-500 animate-pulse-fast"
            style={{ width: '100%' }} // Simple full-width pulse for now
          ></div>
           {loadingStatus.message && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-background border rounded-full shadow-lg text-xs font-medium flex items-center gap-2">
               <Loader2 className="h-3 w-3 animate-spin" />
               {loadingStatus.message}
            </div>
           )}
        </div>
      )}

      {/* Header with background blur */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm shadow-sm">
        <div className="container flex h-16 items-center justify-between py-4 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-heading font-bold text-gradient">Copy Me Quick</h1>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="https://github.com/MarcusNeufeldt/copy-me-quick" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <GithubIcon className="h-5 w-5" />
            </a>
            <ModeToggle />
          </div>
        </div>
      </header>
      
      <div className="container px-4 py-4 sm:py-6 md:py-10 max-w-7xl mx-auto animate-fade-in">
        <div className="grid gap-6 grid-cols-1 md:grid-cols-[250px_1fr] lg:grid-cols-[280px_1fr]">
          {/* Sidebar Navigation */}
          <aside className="flex flex-col gap-4">
            <Card className="glass-card animate-slide-up sticky top-[calc(theme(spacing.16)+1rem)]">
              <CardContent className="p-4 sm:p-5 space-y-4 sm:space-y-5">
                <div className="flex items-center gap-2 mb-2 sm:mb-4">
                  <GitBranchPlus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <h2 className="font-heading font-semibold text-sm sm:text-base">Project Configuration</h2>
                </div>

                {/* --- Source Selection Tabs --- */}
                <Tabs value={activeSourceTab} onValueChange={(value) => handleTabChangeAttempt(value as 'local' | 'github')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="local" className="text-xs px-2 py-1.5">
                      <Computer className="h-4 w-4 mr-1.5" /> Local
                    </TabsTrigger>
                    <TabsTrigger value="github" className="text-xs px-2 py-1.5">
                      <Github className="h-4 w-4 mr-1.5" /> GitHub
                    </TabsTrigger>
                  </TabsList>

                  {/* LOCAL TAB */}
                  <TabsContent value="local" className="mt-0 space-y-4">
                     <ProjectSelector
                       setState={setState}
                       onProjectTypeSelected={setProjectTypeSelected}
                       projectTypes={projectTypes}
                       onProjectTemplatesUpdate={handleProjectTemplateUpdate}
                     />
                     <FileUploadSection
                       state={state}
                       setState={setState}
                       setLoadingStatus={setLoadingStatus}
                       loadingStatus={loadingStatus}
                       updateCurrentProject={updateCurrentProject}
                       onUploadComplete={handleUploadComplete}
                       setError={setError}
                       projectTypeSelected={projectTypeSelected}
                       buttonTooltip="Reads current files from your disk, including uncommitted changes."
                     />
                     {/* Enhanced Privacy Alert */}
                     <Alert variant="default" className="mt-2 bg-primary/5 border-primary/20">
                       <ShieldCheck className="h-4 w-4 text-primary/80" />
                       <AlertDescription className="text-primary/90 text-xs">
                         <strong>Privacy Assured:</strong> Your local files are processed <i>only</i> in your browser and are <strong>never</strong> uploaded to any server.
                       </AlertDescription>
                     </Alert>
                     
                     {/* Recent Projects Section - moved here */}
                     <RecentProjectsDisplay 
                       projects={projects} 
                       onLoadProject={handleLoadRecentProject}
                       onPinProject={handlePinProject}
                       onRemoveProject={handleRemoveProject}
                       onRenameProject={handleRenameProject}
                     />
                  </TabsContent>

                  {/* GITHUB TAB */}
                  <TabsContent value="github" className="mt-0 space-y-3">
                    {/* GitHub Connection Logic */}
                    {loadingStatus.isLoading && loadingStatus.message?.includes('GitHub connection') ? (
                       <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs sm:text-sm py-4">
                         <Loader2 className="h-4 w-4 animate-spin" />
                         Checking GitHub connection...
                       </div>
                    ) : githubUser ? (
                       <div className="space-y-4 text-xs sm:text-sm">
                         <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center gap-2 overflow-hidden">
                             {githubUser.avatarUrl && (
                               <Image
                                  src={githubUser.avatarUrl}
                                  alt={`${githubUser.login} avatar`}
                                  width={24}
                                  height={24}
                                  className="rounded-full"
                               />
                             )}
                             <span className="font-medium truncate" title={githubUser.login}>{githubUser.login}</span>
                             <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                           </div>
                           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleGitHubLogout} title="Disconnect GitHub">
                             <XCircle className="h-4 w-4 text-muted-foreground" />
                           </Button>
                         </div>

                         {/* Filter Button */}
                         <div className="space-y-1.5">
                           <Button variant="outline" className="w-full" onClick={() => setIsFilterSheetOpen(true)}>
                             <Filter className="mr-2 h-4 w-4" />
                             Filter Files & Folders
                           </Button>
                         </div>

                         {/* Repo Selector */}
                         <div className="space-y-1.5">
                           <label htmlFor="github-repo-select" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                             <BookMarked className="h-3 w-3" /> Repository
                           </label>
                           <Select
                             value={selectedRepoFullName || ''}
                             onValueChange={handleRepoChange}
                             disabled={loadingStatus.isLoading || repos.length === 0}
                           >
                             <SelectTrigger id="github-repo-select" className="text-xs sm:text-sm">
                               <SelectValue placeholder={loadingStatus.isLoading && loadingStatus.message?.includes('repositories') ? "Loading..." : "Select repository..."} />
                             </SelectTrigger>
                             <SelectContent>
                                {loadingStatus.isLoading && loadingStatus.message?.includes('repositories') && (
                                   <div className="flex items-center justify-center p-4 text-muted-foreground text-xs">
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...
                                   </div>
                                )}
                                {repos.map((repo: GitHubRepo) => (
                                 <SelectItem key={repo.id} value={repo.full_name} className="text-xs sm:text-sm">
                                     {repo.full_name}
                                 </SelectItem>
                                ))}
                             </SelectContent>
                           </Select>
                         </div>

                         {/* Branch Selector */}
                         {selectedRepoFullName && (
                            <div className="space-y-1.5">
                             <div className="flex items-center justify-between">
                               <label htmlFor="github-branch-select" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                 <GitBranch className="h-3 w-3" /> Branch
                               </label>
                               <TooltipProvider delayDuration={300}>
                                 <Tooltip>
                                   <TooltipTrigger asChild>
                                     <Button
                                       variant="ghost"
                                       size="icon"
                                       className="h-7 w-7"
                                       onClick={() => handleBranchChange(selectedBranchName!)}
                                       disabled={!selectedBranchName || loadingStatus.isLoading}
                                       aria-label="Refresh branch file list"
                                     >
                                       <RefreshCw className="h-4 w-4" />
                                     </Button>
                                   </TooltipTrigger>
                                   <TooltipContent side="top">
                                     <p>Refresh file tree for current branch</p>
                                   </TooltipContent>
                                 </Tooltip>
                               </TooltipProvider>
                             </div>

                             {loadingStatus.isLoading && loadingStatus.message?.includes('branches') ? (
                               <div className="text-center text-muted-foreground text-xs py-2">Loading branches...</div>
                             ) : branches.length > 0 ? (
                                <ScrollArea className="h-40 w-full rounded-md border p-2">
                                 {branches.map((branch: GitHubBranch) => (
                                   <Button
                                     key={branch.name}
                                     size="sm"
                                     variant={selectedBranchName === branch.name ? "default" : "ghost"}
                                     className="w-full justify-start text-xs mb-1 h-8"
                                     onClick={() => handleBranchChange(branch.name)}
                                     disabled={loadingStatus.isLoading && (loadingStatus.message?.includes('tree') || loadingStatus.message?.includes('contents'))}
                                   >
                                     <GitBranch className="h-3 w-3 mr-1" />
                                     {branch.name}
                                   </Button>
                                 ))}
                               </ScrollArea>
                             ) : (
                               <div className="text-center text-muted-foreground text-xs py-2">No branches found</div>
                             )}
                           </div>
                         )}

                         {/* Error Display for Selection - Used Alert */}
                         {githubSelectionError && (
                           <Alert variant="destructive" className="text-xs mt-2"><AlertDescription>{githubSelectionError}</AlertDescription></Alert>
                         )}

                         {/* Display specific file loading progress message */} 
                         {fileLoadingMessage && (
                           <div className="text-center text-amber-500 text-xs mt-2 font-medium">
                             {fileLoadingMessage}
                           </div>
                         )}

                         {isGithubTreeTruncated && (
                            <Alert variant="default" className="text-xs mt-2">
                               <AlertDescription>Warning: Repository tree is large and was truncated. Some files/folders might be missing.</AlertDescription>
                            </Alert>
                         )}
                      </div>
                    ) : (
                      <div className="pt-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="default"
                                variant="outline"
                                className="w-full flex items-center justify-center gap-2"
                                onClick={handleGitHubLogin}
                              >
                                <Github className="h-4 w-4" />
                                <span>Connect to GitHub</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Reads committed files from your GitHub repository.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {githubError && (
                          <Alert variant="destructive" className="text-xs mt-2"><AlertDescription>{githubError}</AlertDescription></Alert>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground pt-1">
                       <b>GitHub:</b> Reads the <i>committed files</i> directly from the selected repository and branch.
                    </p>
                  </TabsContent>
                </Tabs>
                {/* --- End of Source Selection Tabs --- */}

                <Button
                  variant="outline"
                  onClick={handleResetWorkspace}
                  className="w-full transition-all hover:bg-destructive hover:text-destructive-foreground border-destructive/50 text-destructive/90"
                  disabled={!state.analysisResult}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear Current Session
                </Button>


              </CardContent>
            </Card>
          </aside>
          
          {/* Main Content */}
          <div className="space-y-6 animate-slide-up animation-delay-200">
            {error && (
              <Alert variant="destructive" className="animate-scale">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Conditionally render AnalysisResult based on having valid data */}
            {state.analysisResult ? (
              <>
                <AnalysisResult
                  analysisResult={state.analysisResult}
                  selectedFiles={state.selectedFiles}
                  onSelectedFilesChange={handleSelectedFilesChange}
                  tokenCount={tokenCount}
                  setTokenCount={handleTokenCountChange}
                  tokenDetails={tokenDetails}
                  maxTokens={MAX_TOKENS}
                  activeSourceTab={activeSourceTab}
                  githubTree={githubTree}
                  githubRepoInfo={githubRepoInfo}
                  setLoadingStatus={setLoadingStatus}
                  loadingStatus={loadingStatus}
                  currentProjectId={currentProjectId}
                />
              </>
            ) : (
              <Card className="glass-card flex flex-col items-center justify-center p-8 sm:p-12 text-center min-h-[400px]">
                <LayoutGrid className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl sm:text-2xl font-heading font-semibold mb-2">Start Analyzing</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md mx-auto">
                  {activeSourceTab === 'local'
                    ? 'Select a project configuration or upload local files to begin below.'
                    : 'Connect your GitHub account, then choose a repository and branch.'
                  }
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  {activeSourceTab === 'local'
                    ? 'Your files are processed directly in your browser for privacy.'
                    : 'Only committed files from the selected branch will be read.'
                  }
                  {isGithubTreeTruncated && " (Large repos might be truncated)"}
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Add the AlertDialog component */}
      <AlertDialog open={showSwitchConfirmDialog} onOpenChange={setShowSwitchConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Source Switch</AlertDialogTitle>
            <AlertDialogDescription>
              Switching sources will change your current view. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelTabSwitch}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTabSwitch}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog for Loading Recent Project */}
      <AlertDialog open={showLoadRecentConfirmDialog} onOpenChange={setShowLoadRecentConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load Project?</AlertDialogTitle>
            <AlertDialogDescription>
              {loadConfirmationMessage || 'Loading this project will replace your current session. Continue?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLoadRecent}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoadRecent}>Load Project</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* GitHub Filter Manager */}
      <GitHubFilterManager
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        currentExclusions={state.excludeFolders}
        onSave={handleSaveFilters}
      />

      <AnalyticsComponent />
      <SpeedInsights />
    </div>
  );
}
