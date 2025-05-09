"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModeToggle } from "@/components/ui/mode-toggle";
import ProjectSelector from '@/components/ProjectSelector';
import FileUploadSection from '@/components/FileUploadSection';
import AnalysisResult from '@/components/AnalysisResult';
import { AppState, Project, FileData, AnalysisResultData, DataSource, GitHubRepoInfo } from '@/components/types';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { GithubIcon, RotateCcw, Code2, GitBranchPlus, LayoutGrid, Github, CheckCircle, XCircle, GitBranch, BookMarked, Computer, Loader2, ShieldCheck, Info } from 'lucide-react';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileSelector from '@/components/FileSelector';
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

// Dynamically import Analytics with error handling
const AnalyticsComponent = dynamic(
  () => import('@vercel/analytics/react').then((mod) => mod.Analytics).catch(() => () => null),
  { ssr: false, loading: () => null }
);

const MAX_TOKENS = 1048576;

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
  excludeFolders: 'node_modules,.git,dist,.next',
  fileTypes: '.js,.jsx,.ts,.tsx,.py',
  namedSelections: {},
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

export default function ClientPageRoot() {
  // Initialize state with server-safe defaults
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [state, setState] = useState<AppState>(initialAppState);
  const [projectTypes, setProjectTypes] = useState(() => defaultProjectTypes); // Keep default types initially
  const [isMounted, setIsMounted] = useState(false); // Track client-side mount
  const [activeSourceTab, setActiveSourceTab] = useState('local'); // 'local' or 'github'

  // State for confirmation dialog
  const [showSwitchConfirmDialog, setShowSwitchConfirmDialog] = useState(false);
  const [nextTabValue, setNextTabValue] = useState<string | null>(null);

  // Unified Loading State
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({ isLoading: false, message: null });

  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
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

  // Load state from localStorage only on the client after mount
  useEffect(() => {
    setIsMounted(true); // Mark as mounted
    console.log("[Presets] Initial mount effect running."); // Added logging

    // Fetch GitHub user data if token might exist (client-side)
    const checkGitHubAuth = async () => {
      // Use unified loading state
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
        // Clear loading state
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    checkGitHubAuth();

    const savedProjectsStr = localStorage.getItem('codebaseReaderProjects');
    const loadedProjects: Project[] = savedProjectsStr ? JSON.parse(savedProjectsStr) : [];
    setProjects(loadedProjects);

    const savedProjectId = localStorage.getItem('currentProjectId');
    let loadedStateFromStorage = false; // Flag to track if state was loaded

    if (savedProjectId) {
      const currentProject = loadedProjects.find((p: Project) => p.id === savedProjectId);
      if (currentProject) {
        console.log(`Found saved project: ${currentProject.id}, Type: ${currentProject.sourceType}`);

        // Set the active tab based on the loaded project's source type
        if (currentProject.sourceType) {
           console.log(`Setting active source tab to: ${currentProject.sourceType}`);
           setActiveSourceTab(currentProject.sourceType); // <--- Set the tab here!
        } else {
           console.warn(`Project ${currentProject.id} loaded but has no sourceType. Defaulting to 'local' tab.`);
           setActiveSourceTab('local'); // Fallback if sourceType is somehow missing
        }

        const loadedState = currentProject.state;
        if (typeof loadedState.namedSelections !== 'object' || loadedState.namedSelections === null || Array.isArray(loadedState.namedSelections)) {
          console.warn("Loaded state namedSelections is not an object, resetting to empty object.");
          loadedState.namedSelections = {};
        }
        setState(loadedState);
        setCurrentProjectId(savedProjectId); // Set project ID after state/tab
        loadedStateFromStorage = true;

        // If it's a GitHub project, restore relevant GitHub state too
        if (currentProject.sourceType === 'github' && currentProject.githubRepoFullName && currentProject.githubBranch) {
            console.log(`Restoring GitHub context: Repo=${currentProject.githubRepoFullName}, Branch=${currentProject.githubBranch}`); // Added log
            setSelectedRepoFullName(currentProject.githubRepoFullName);
            setSelectedBranchName(currentProject.githubBranch);
            // Note: We might still need to re-fetch branches/tree if not persisted or stale,
            // but setting the selected repo/branch is crucial for UI consistency.
            // Consider if handleBranchChange needs to be smarter about re-fetching vs using restored state.
            // For now, just setting the state prevents the immediate clear on tab switch.
            // If handleBranchChange *always* fetches, this might trigger a reload, but won't clear workspace first.
            // You might need to enhance handleBranchChange to check if analysisResult is already present for that branch.
        }

      } else {
        // Saved project ID exists but project data not found (e.g., cleared localStorage partially)
        console.warn(`Saved project ID ${savedProjectId} found, but no matching project data. Resetting.`);
        setState(initialAppState);
        setCurrentProjectId(null);
        setActiveSourceTab('local'); // Default to local if load fails
      }
    }

    if (!loadedStateFromStorage) {
        // No saved project ID, or project not found, use initial state
        console.log("No valid saved project state found. Using initial state.");
        setState(initialAppState);
        setCurrentProjectId(null);
        setActiveSourceTab('local'); // Ensure default tab
    }

    console.groupCollapsed("[Presets] Attempting to load projectTemplates from localStorage");
    const savedTemplatesStr = localStorage.getItem('projectTemplates');
    console.log("[Presets] Raw string from localStorage:", savedTemplatesStr); // Added logging

    if (savedTemplatesStr) {
      try {
        const parsedTemplates = JSON.parse(savedTemplatesStr);
        console.log("[Presets] Successfully parsed templates:", parsedTemplates); // Added logging
        setProjectTypes(parsedTemplates);
        console.log("[Presets] Set projectTypes state from localStorage."); // Added logging
      } catch (e) {
        console.error("[Presets] Failed to parse project templates from localStorage:", e); // Added logging
        console.warn("[Presets] Using default project types due to parsing error."); // Added logging
      }
    } else {
      console.log("[Presets] No saved templates found in localStorage. Using defaults."); // Added logging
    }
    console.groupEnd(); // Added logging group end

    // Load the state for the current project
    if (savedProjectId) {
      const currentProject = loadedProjects.find((p: Project) => p.id === savedProjectId);
      if (currentProject) {
        // Ensure namedSelections is an object when loading state
        const loadedState = currentProject.state;
        // Ensure namedSelections is an object
        if (typeof loadedState.namedSelections !== 'object' || loadedState.namedSelections === null || Array.isArray(loadedState.namedSelections)) {
          console.warn("Loaded state namedSelections is not an object, resetting to empty object.");
          loadedState.namedSelections = {};
        }
        setState(loadedState);
      } else {
         setState(initialAppState); // Reset if project not found
      }
    } else {
      setState(initialAppState); // Reset if no project ID
    }

  }, []); // Initial load effect - dependency array is empty

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

        loadedTree = treeData.tree;
        loadedCommitDate = treeData.commitDate; // Capture the commit date

        setGithubTree(loadedTree); // Update tree state for FileSelector
        setIsGithubTreeTruncated(treeData.truncated ?? false);

        const totalFileCount = loadedTree?.filter(item => item.type === 'blob').length || 0;
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
          summary: `GitHub repo: ${selectedRepoFullName}, Branch: ${branchName}`,
          project_tree: `GitHub Tree Structure for ${selectedRepoFullName}/${branchName}`,
          files: [], // Start with empty files
          commitDate: loadedCommitDate // Store date in analysisResult too
        };

        // 2. Fetch File Content (Batched)
        const filesToFetch = loadedTree?.filter(item => item.type === 'blob') || [];
        if (filesToFetch.length > 0) {
          setLoadingStatus({ isLoading: true, message: `Loading ${filesToFetch.length} file contents...` });
          let totalLineCount = 0;
          const filesWithContent: FileData[] = [];
          const treeUpdates: { path: string, lines: number }[] = [];

          // ... (progress update setup) ...
          setFileLoadingProgress({ current: 0, total: filesToFetch.length });
          const updateLoadingProgress = (current: number) => {
            setFileLoadingProgress({ current, total: filesToFetch.length });
            setLoadingStatus(prev => ({ ...prev, message: `Loading file contents... (${current}/${filesToFetch.length})` }));
          };
          updateLoadingProgress(0);
          let processedCount = 0;
          const batchSize = 10;
          // ... (large file warning) ...
          const largeFiles = filesToFetch.filter((item: any) => item.size && item.size > 500000);
          if (largeFiles.length > 0) {
            setFileLoadingMessage(`Note: Loading ${largeFiles.length} large files (>500KB).`);
            setTimeout(() => setFileLoadingMessage(null), 5000);
          }

          for (let i = 0; i < filesToFetch.length; i += batchSize) {
            const batch = filesToFetch.slice(i, i + batchSize);
            await Promise.all(batch.map(async (file: any) => {
              try {
                const contentUrl = `/api/github/content?owner=${repoInfo.owner}&repo=${repoInfo.repo}&path=${encodeURIComponent(file.path)}`;
                const contentResponse = await fetch(contentUrl);
                if (contentResponse.ok) {
                  const contentData = await contentResponse.json();
                  const content = contentData.content || '';
                  const lineCount = content.split('\n').length;
                  totalLineCount += lineCount;
                  filesWithContent.push({
                    path: file.path,
                    lines: lineCount,
                    content: content,
                    size: file.size,
                    sha: file.sha,
                    dataSourceType: 'github'
                  });
                  // Store update info separately
                  treeUpdates.push({ path: file.path, lines: lineCount }); // Populate treeUpdates
                } else {
                    console.warn(`Failed to fetch content for ${file.path}: ${contentResponse.status}`);
                }
              } catch (error) {
                console.error(`Error fetching content for ${file.path}:`, error);
              }
              processedCount++;
              updateLoadingProgress(processedCount);
            }));
          }

          // Update the analysisResultData with fetched content
          if (analysisResultData) {
            analysisResultData.totalLines = totalLineCount;
            analysisResultData.files = filesWithContent;
            // Note: Token count still needs calculation elsewhere
          }
          setFileLoadingProgress({ current: 0, total: 0 }); // Reset progress

          // --- START: New Code to Merge Line Counts into Tree (Correct Scope) ---
          if (loadedTree) {
              console.log(`Merging ${treeUpdates.length} content updates into the GitHub tree structure...`);
              const treePathMap = new Map<string, GitHubTreeItem>();
              // Create a new array for the updated tree to ensure state immutability
              const updatedTreeItems = loadedTree.map(item => ({ ...item })); // Shallow copy items
              updatedTreeItems.forEach(item => treePathMap.set(item.path, item));

              treeUpdates.forEach(update => {
                  const treeItem = treePathMap.get(update.path);
                  if (treeItem && treeItem.type === 'blob') {
                      // Add lines and formattedSize directly to the copied tree item object
                      (treeItem as any).lines = update.lines;
                       if (treeItem.size !== undefined && !(treeItem as any).formattedSize) {
                            (treeItem as any).formattedSize = formatFileSize(treeItem.size);
                       }
                  } else {
                       console.warn(`Could not find matching blob item in tree for update: ${update.path}`);
                  }
              });
              // Update the state variable with the new array reference
               setGithubTree(updatedTreeItems); // Use the new array with updated items
               console.log("GitHub tree structure updated with line counts.");
          }
          // --- END: New Code ---

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
        } else {
          console.log(`Creating new project for GitHub: ${selectedRepoFullName}/${branchName}`);
          targetProjectId = Date.now().toString();
          finalState = {
            ...initialAppState,
            analysisResult: analysisResultData, // Includes commitDate
            selectedFiles: [],
            namedSelections: {}, // Start fresh
          };
          const newProject: Project = {
            id: targetProjectId,
            name: `${selectedRepoFullName} (${branchName})`, // Default name
            sourceType: 'github',
            githubRepoFullName: selectedRepoFullName,
            githubBranch: branchName,
            state: finalState, // Ensure the finalState (with commitDate) is saved here
          };
          setProjects(prevProjects => [...prevProjects, newProject]);
        }

        // 4. Update Main State and Project Array
        setState(finalState);
        setCurrentProjectId(targetProjectId);

        if (projectExists && targetProjectId) {
          setProjects(prevProjects =>
            prevProjects.map(p =>
              p.id === targetProjectId ? { ...p, state: finalState } : p // Ensure updated state is saved
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

  }, [repos, selectedRepoFullName, projects, setProjects, setState, setCurrentProjectId, setLoadingStatus]); // Added projects dependencies

  // Persist state changes to localStorage
  useEffect(() => {
    console.log("[State Save] Effect triggered. isMounted:", isMounted);
    if (!isMounted) {
        console.log("[State Save] Skipping save because component is not mounted yet.");
        return;
    }

    // --- START MODIFICATION V2 ---
    const projectsToSave = projects.map(p => {
        // Destructure the state, excluding analysisResult
        const { analysisResult, ...stateToSave } = p.state;

        // Return the project structure with the lightweight state
        return {
            ...p,
            state: stateToSave // stateToSave now implicitly excludes analysisResult
        };
    });

    console.log("[State Save] Saving projects to localStorage (lightweight version)...");
    localStorage.setItem('codebaseReaderProjects', JSON.stringify(projectsToSave));
    // --- END MODIFICATION V2 ---

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
    // Find the shortest path
    let shortestPath = files[0].path;
    for (let i = 1; i < files.length; i++) {
      if (files[i].path.length < shortestPath.length) {
        shortestPath = files[i].path;
      }
    }
    // The folder name is the first part of the shortest path
    const parts = shortestPath.split('/');
    return parts[0] || 'Untitled Project';
  };

  // Updated handleUploadComplete for useCallback and cleaner state management
  const handleUploadComplete = useCallback((newAnalysisResult: AnalysisResultData) => {
    console.log('Upload complete, processing project context. Timestamp:', newAnalysisResult.uploadTimestamp); // Log timestamp
    const folderName = getRootFolderName(newAnalysisResult.files);
    console.log(`Identified folder name: ${folderName}`);
    let newCurrentProjectId: string | null = null;

    setProjects(prevProjects => {
      const existingProjectIndex = prevProjects.findIndex((p) => p.sourceType === 'local' && p.sourceFolderName === folderName);
      let updatedProjects = [...prevProjects];

      if (existingProjectIndex !== -1) {
        const existingProject = updatedProjects[existingProjectIndex];
        console.log(`Found existing local project ID: ${existingProject.id}`);
        newCurrentProjectId = existingProject.id;
        const updatedState: AppState = {
          // Keep existing named selections and filters from the previous state of *this* project
          ...existingProject.state,
          analysisResult: newAnalysisResult, // Update with fresh data (including timestamp)
          selectedFiles: [], // Reset selected files on new upload
        };
        updatedProjects[existingProjectIndex] = { ...existingProject, state: updatedState };
        // Don't call setState directly here, let the useEffect handle it based on currentProjectId change
        // setState(updatedState); // Also update main state directly if this becomes current project
      } else {
        console.log(`Creating new local project for folder: ${folderName}`);
        newCurrentProjectId = Date.now().toString();
        const newProjectState: AppState = {
          ...initialAppState, // Start with initial filters/selections
          analysisResult: newAnalysisResult, // Add the uploaded data
          selectedFiles: [], // Start with no files selected
          namedSelections: {}, // Start with no named selections
        };
        const newProject: Project = {
          id: newCurrentProjectId,
          name: folderName,
          sourceType: 'local',
          sourceFolderName: folderName,
          state: newProjectState,
        };
        updatedProjects = [...prevProjects, newProject];
        // Don't call setState directly here, let the useEffect handle it based on currentProjectId change
         // setState(newProjectState); // Update main state directly as this is the new current project
      }
      return updatedProjects;
    });

    // Set the current project ID. The useEffect watching this ID will update the main `state`.
    setCurrentProjectId(newCurrentProjectId); // Set the current project ID
    console.log(`Project context set. Current Project ID: ${newCurrentProjectId}`);
  }, [setProjects, setCurrentProjectId /* Remove setState from dependencies */]);

  const handleProjectTemplateUpdate = useCallback((updatedTemplates: typeof projectTypes) => {
    console.groupCollapsed("[Presets] handleProjectTemplateUpdate triggered");
    console.log("[Presets] Received updated templates:", updatedTemplates);
    setProjectTypes(updatedTemplates);
    console.groupEnd();
  }, []); // Dependency: setProjectTypes is stable

  // This callback is passed to AnalysisResult for its internal state changes
  const handleSelectedFilesChange = useCallback((filesOrUpdater: string[] | ((prev: string[]) => string[])) => {
    setState(prevState => {
      // Calculate the new selectedFiles state
      const newSelectedFiles = typeof filesOrUpdater === 'function'
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
    // The main useEffect watching `projects` will handle persistence if needed,
    // triggered by save/rename/delete actions, not just selection changes.
  }, []); // Dependency: setState is stable

  // --- Named Selection Callbacks ---
  // Note: These now *only* update the `projects` state.
  // The main `state` (used by UI components) will be updated by the useEffect
  // that synchronizes `state` with the current project's state from the `projects` array.
  // This ensures a single source of truth and avoids potential race conditions.

  const saveNamedSelection = useCallback((name: string, files: string[]) => {
    if (!currentProjectId) {
      console.warn("Attempted to save selection without current project ID.");
      return;
    }

    console.log(`Attempting to save selection '${name}' for project ${currentProjectId}`);
    setProjects(prevProjects => {
      const projectIndex = prevProjects.findIndex(p => p.id === currentProjectId);
      if (projectIndex === -1) {
        console.warn("Current project ID not found in projects array during preset save.");
        return prevProjects; // Return unchanged state
      }

      const newProjects = [...prevProjects]; // Copy projects array
      const projectToUpdate = { ...newProjects[projectIndex] }; // Copy project to update
      const updatedState = { ...projectToUpdate.state }; // Copy state of that project
      const updatedNamedSelections = { ...(updatedState.namedSelections || {}), [name]: files }; // Update selections

      updatedState.namedSelections = updatedNamedSelections; // Assign updated selections to copied state
      projectToUpdate.state = updatedState; // Assign updated state to copied project
      newProjects[projectIndex] = projectToUpdate; // Put updated project back into copied array

      console.log(`Saved selection: ${name} with ${files.length} files for project ${currentProjectId}. Updated projects state.`);
      return newProjects; // Return the new projects array
    });
    // The useEffect watching `projects` and `currentProjectId` will update the main `state` variable.
  }, [currentProjectId]); // Dependencies: currentProjectId, setProjects (stable)

  const renameNamedSelection = useCallback((oldName: string, newName: string) => {
    if (!currentProjectId) {
      console.warn("Attempted to rename selection without current project ID.");
      return;
    }
    if (!newName || oldName === newName) {
      console.warn("Invalid rename operation.");
      return;
    }

    console.log(`Attempting to rename selection '${oldName}' to '${newName}' for project ${currentProjectId}`);
    setProjects(prevProjects => {
      const projectIndex = prevProjects.findIndex(p => p.id === currentProjectId);
      if (projectIndex === -1) {
        console.warn("Current project ID not found in projects array during preset rename.");
        return prevProjects;
      }

      const newProjects = [...prevProjects];
      const projectToUpdate = { ...newProjects[projectIndex] };
      const updatedState = { ...projectToUpdate.state };
      const updatedNamedSelections = { ...(updatedState.namedSelections || {}) };

      if (!updatedNamedSelections[oldName] || updatedNamedSelections[newName]) {
        console.warn(`Rename failed: Old name '${oldName}' not found or new name '${newName}' already exists.`);
        return prevProjects; // Prevent overwriting or renaming non-existent entry
      }

      updatedNamedSelections[newName] = updatedNamedSelections[oldName];
      delete updatedNamedSelections[oldName];

      updatedState.namedSelections = updatedNamedSelections;
      projectToUpdate.state = updatedState;
      newProjects[projectIndex] = projectToUpdate;

      console.log(`Renamed selection: ${oldName} -> ${newName} for project ${currentProjectId}. Updated projects state.`);
      return newProjects;
    });
  }, [currentProjectId]); // Dependencies: currentProjectId, setProjects (stable)

  const deleteNamedSelection = useCallback((name: string) => {
    if (!currentProjectId) {
      console.warn("Attempted to delete selection without current project ID.");
      return;
    }

    console.log(`Attempting to delete selection '${name}' for project ${currentProjectId}`);
    setProjects(prevProjects => {
      const projectIndex = prevProjects.findIndex(p => p.id === currentProjectId);
      if (projectIndex === -1) {
        console.warn("Current project ID not found in projects array during preset delete.");
        return prevProjects;
      }

      const newProjects = [...prevProjects];
      const projectToUpdate = { ...newProjects[projectIndex] };
      const updatedState = { ...projectToUpdate.state };
      const updatedNamedSelections = { ...(updatedState.namedSelections || {}) };

      if (!updatedNamedSelections[name]) {
        console.warn(`Delete failed: Selection '${name}' not found.`);
        return prevProjects; // Prevent deleting non-existent entry
      }

      delete updatedNamedSelections[name];

      updatedState.namedSelections = updatedNamedSelections;
      projectToUpdate.state = updatedState;
      newProjects[projectIndex] = projectToUpdate;

      console.log(`Deleted selection: ${name} for project ${currentProjectId}. Updated projects state.`);
      return newProjects;
    });
  }, [currentProjectId]); // Dependencies: currentProjectId, setProjects (stable)

  // Effect to synchronize the main 'state' with the current project's state from 'projects'
  useEffect(() => {
    console.log("[Sync Effect] Running. currentProjectId:", currentProjectId);
    if (currentProjectId) {
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (currentProject) {
        console.log("[Sync Effect] Found current project. Comparing states.");
        // Deep comparison might be needed if state structure is complex
        // For now, a simple reference check might suffice if state updates are immutable
        if (state !== currentProject.state) {
          console.log("[Sync Effect] Project state differs from main state. Updating main state.");
          // Ensure analysisResult is not accidentally nullified if it exists in project state
          const newState = { ...currentProject.state };
          if (!newState.analysisResult && state.analysisResult) {
            console.warn("[Sync Effect] Project state missing analysisResult, preserving from main state (this might indicate an issue).");
            newState.analysisResult = state.analysisResult;
          }
          setState(newState);
        } else {
          console.log("[Sync Effect] Project state matches main state. No update needed.");
        }
      } else {
        console.warn("[Sync Effect] currentProjectId is set, but project not found in projects array. Resetting state.");
        // If the current project ID doesn't exist (e.g., deleted), reset the main state
        setState(initialAppState);
        setCurrentProjectId(null); // Also clear the invalid ID
      }
    } else {
      console.log("[Sync Effect] No currentProjectId. Ensuring main state is initial.");
      // If there's no current project ID, ensure the main state is reset
      if (state !== initialAppState) { // Avoid unnecessary reset
        setState(initialAppState);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, projects]); // Trigger when project ID changes or the projects array itself changes

  // Persist state changes to localStorage (Simplified to depend on projects and currentProjectId)
  useEffect(() => {
    console.log("[State Save Effect] Running. isMounted:", isMounted);
    if (!isMounted) {
      console.log("[State Save Effect] Skipping save because component is not mounted yet.");
      return;
    }

    // Save projects (excluding analysisResult)
    const projectsToSave = projects.map(p => {
      const { analysisResult, ...stateToSave } = p.state || {}; // Handle potential undefined state
      return { ...p, state: stateToSave };
    });
    console.log("[State Save Effect] Saving projects to localStorage...");
    localStorage.setItem('codebaseReaderProjects', JSON.stringify(projectsToSave));

    // Save current project ID
    console.log(`[State Save Effect] Saving currentProjectId: ${currentProjectId}`);
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

  // Determine current dataSource based on active tab and state
  const currentDataSource: DataSource | undefined = useMemo(() => {
    console.log("Recalculating currentDataSource..."); // Debug log
    if (activeSourceTab === 'github' && githubTree) {
      return { // GitHub source
        type: 'github',
        tree: githubTree,
        repoInfo: selectedRepoFullName && selectedBranchName ? {
          owner: selectedRepoFullName.split('/')[0],
          repo: selectedRepoFullName.split('/')[1],
          branch: selectedBranchName
        } : undefined
      };
    } else if (activeSourceTab === 'local' && state.analysisResult?.files?.length) {
      return { // Local source
        type: 'local',
        files: state.analysisResult.files
      };
    } else {
      return undefined;
    }
  }, [activeSourceTab, githubTree, state.analysisResult?.files, selectedBranchName, selectedRepoFullName]); // Dependencies for memoization

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

  const handleResetWorkspace = () => {
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
  };

  // ----- Tab Switching Logic with Confirmation -----
  const handleTabChangeAttempt = (newTabValue: string) => {
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

  const confirmTabSwitch = () => {
    console.log("User confirmed tab switch. Clearing workspace and switching.");
    handleResetWorkspace(); // Clear the current session state
    if (nextTabValue) {
      setActiveSourceTab(nextTabValue); // Set the new active tab
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
                <Tabs value={activeSourceTab} onValueChange={handleTabChangeAttempt} className="w-full">
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
                             <label htmlFor="github-branch-select" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                               <GitBranch className="h-3 w-3" /> Branch
                             </label>

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
                  disabled={!currentDataSource}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear Current Session
                </Button>

                {/* Improved Presets Info Section */}
                <Alert variant="default" className="mt-4 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800 flex flex-col">
                  <div className="flex items-center mb-1"> {/* Container for icon and title */}
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                    <AlertTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      New Feature: Presets!
                    </AlertTitle>
                  </div>
                  <AlertDescription className="text-xs text-blue-700 dark:text-blue-400 pl-6"> {/* Indent description */}
                    Quickly save and load common file selections using the <BookMarked className="inline-block h-3 w-3 mx-0.5" /> <strong>Presets</strong> button in the File Selector.
                    <br /> {/* Line break */}
                    <span className="opacity-80"> (Saved per-project in browser storage).</span>
                  </AlertDescription>
                </Alert>
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

            {/* Conditionally render AnalysisResult based on having a valid dataSource */}
            {currentDataSource && state.analysisResult ? (
              <>
                <AnalysisResult
                  analysisResult={state.analysisResult}
                  selectedFiles={state.selectedFiles}
                  onSelectedFilesChange={handleSelectedFilesChange}
                  tokenCount={tokenCount}
                  setTokenCount={setTokenCount}
                  maxTokens={MAX_TOKENS}
                  dataSource={currentDataSource}
                  setLoadingStatus={setLoadingStatus}
                  loadingStatus={loadingStatus}
                  namedSelections={state.namedSelections || {}}
                  onSaveNamedSelection={saveNamedSelection}
                  onRenameNamedSelection={renameNamedSelection}
                  onDeleteNamedSelection={deleteNamedSelection}
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
              Switching the source type will clear the current analysis session (file selections, token counts). Your saved project data and presets will remain. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelTabSwitch}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTabSwitch}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AnalyticsComponent />
      <SpeedInsights />
    </div>
  );
}