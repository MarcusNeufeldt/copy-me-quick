"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModeToggle } from "@/components/ui/mode-toggle";
import ProjectSelector from '@/components/ProjectSelector';
import FileUploadSection from '@/components/FileUploadSection';
import BackupManagement from '@/components/BackupManagement';
import AnalysisResult from '@/components/AnalysisResult';
import { AppState, Project, FileData, AnalysisResultData, Backup, DataSource, GitHubRepoInfo } from '@/components/types';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { GithubIcon, RotateCcw, Code2, GitBranchPlus, LayoutGrid, Github, CheckCircle, XCircle, GitBranch, BookMarked, Computer, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileSelector from '@/components/FileSelector';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  backups: [],
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

export default function ClientPageRoot() {
  // Initialize state with server-safe defaults
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [state, setState] = useState<AppState>(initialAppState);
  const [projectTypes, setProjectTypes] = useState(() => defaultProjectTypes); // Keep default types initially
  const [isMounted, setIsMounted] = useState(false); // Track client-side mount
  const [activeSourceTab, setActiveSourceTab] = useState('local'); // 'local' or 'github'

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
    const loadedProjects = savedProjectsStr ? JSON.parse(savedProjectsStr) : [];
    setProjects(loadedProjects);

    const savedProjectId = localStorage.getItem('currentProjectId'); // Corrected typo
    setCurrentProjectId(savedProjectId);

    const savedTemplatesStr = localStorage.getItem('projectTemplates'); // Corrected typo
    if (savedTemplatesStr) {
      setProjectTypes(JSON.parse(savedTemplatesStr));
    }

    // Load the state for the current project
    if (savedProjectId) {
      const currentProject = loadedProjects.find((p: Project) => p.id === savedProjectId);
      if (currentProject) {
        // Ensure backups is always an array when loading state
        const loadedState = currentProject.state;
        if (!Array.isArray(loadedState.backups)) {
          console.warn("Loaded state backups is not an array, resetting to empty array.");
          loadedState.backups = [];
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

  // Handle Branch Selection - Modified to fetch tree
  const handleBranchChange = useCallback((branchName: string) => {
    setSelectedBranchName(branchName);
    setGithubSelectionError(null);
    setGithubTree(null);
    setState(prevState => ({ ...prevState, analysisResult: null, selectedFiles: [] }));
    setIsGithubTreeTruncated(false);

    if (!branchName || !selectedRepoFullName) {
      return;
    }

    const selectedRepo = repos.find(r => r.full_name === selectedRepoFullName);
    if (!selectedRepo) return;

    const fetchTree = async () => {
      // Use unified loading state for tree fetching
      setLoadingStatus({ isLoading: true, message: 'Loading file tree...' });
      setGithubSelectionError(null);
      try {
        const apiUrl = `/api/github/tree?owner=${selectedRepo.owner.login}&repo=${selectedRepo.name}&branch=${branchName}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!response.ok) {
             throw new Error(data.error || 'Failed to fetch file tree');
        }

        const totalFileCount = data.tree.filter((item: any) => item.type === 'blob').length;
        setGithubTree(data.tree);
        setIsGithubTreeTruncated(data.truncated ?? false);

        const repoInfo: GitHubRepoInfo = {
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          branch: branchName
        };

        const pseudoAnalysis: AnalysisResultData = {
            totalFiles: totalFileCount,
            totalLines: 0,
            totalTokens: 0,
            summary: `GitHub repo: ${selectedRepoFullName}, Branch: ${branchName}`,
            project_tree: `GitHub Tree Structure for ${selectedRepoFullName}/${branchName}`,
            files: [],
        };

        setState(prevState => ({
             ...prevState,
             analysisResult: pseudoAnalysis,
             selectedFiles: [],
        }));

        // Batch fetch content
        const filesToFetch = data.tree.filter((item: any) => item.type === 'blob');

        if (filesToFetch.length > 0) {
          // Update loading state for file content fetching
          setLoadingStatus({ isLoading: true, message: `Loading ${filesToFetch.length} file contents...` });

          const largeFiles = filesToFetch.filter((item: any) => item.size && item.size > 500000);
          if (largeFiles.length > 0) {
            setFileLoadingMessage(`Note: Loading ${largeFiles.length} large files (>500KB).`);
            setTimeout(() => setFileLoadingMessage(null), 5000);
          }

          setFileLoadingProgress({ current: 0, total: filesToFetch.length });
          let totalLineCount = 0;
          const filesWithContent: FileData[] = [];
          const treeUpdates: {path: string, lines: number, content: string}[] = [];

          const updateLoadingProgress = (current: number) => {
            setFileLoadingProgress({ current, total: filesToFetch.length });
             // Optionally update the loading message with progress
            setLoadingStatus(prev => ({ ...prev, message: `Loading file contents... (${current}/${filesToFetch.length})` }));
          };
          updateLoadingProgress(0);

          const batchSize = 10;
          let processedCount = 0;

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
                  treeUpdates.push({
                    path: file.path,
                    lines: lineCount,
                    content: content
                  });
                }
              } catch (error) {
                console.error(`Error fetching content for ${file.path}:`, error);
              }
              processedCount++;
              updateLoadingProgress(processedCount);
            }));

            if (treeUpdates.length > 0) {
              setGithubTree(prevTree => {
                if (!prevTree) return prevTree;
                return prevTree.map((item) => {
                  const update = treeUpdates.find(u => u.path === item.path);
                  if (update && item.type === 'blob') {
                    return { ...item, lines: update.lines, content: update.content } as GitHubTreeItem & { lines: number, content: string };
                  }
                  return item;
                });
              });
            }
          }

          setState(prevState => {
            if (!prevState.analysisResult) return prevState;
            return {
              ...prevState,
              analysisResult: {
                ...prevState.analysisResult,
                totalLines: totalLineCount,
                files: filesWithContent
              }
            };
          });

          setFileLoadingProgress({ current: 0, total: 0 });
        }
      } catch (error) {
        console.error("Error fetching GitHub tree:", error);
        setGithubSelectionError(error instanceof Error ? error.message : String(error));
        setGithubTree(null);
        if (error instanceof Error && error.message === 'Invalid GitHub token') setGithubUser(null);
      } finally {
        // Clear loading state
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    fetchTree();

  }, [repos, selectedRepoFullName]);

  // Persist state changes to localStorage
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem('codebaseReaderProjects', JSON.stringify(projects));
    localStorage.setItem('currentProjectId', currentProjectId || '');
    localStorage.setItem('projectTemplates', JSON.stringify(projectTypes));
    if (currentProjectId) {
        const updatedProjects = projects.map((p: Project) =>
            p.id === currentProjectId ? { ...p, state: state } : p
        );
        if (JSON.stringify(updatedProjects) !== JSON.stringify(projects)) {
            setProjects(updatedProjects);
        }
    }
  }, [state, projects, currentProjectId, projectTypes, isMounted]);

  const updateCurrentProject = (newState: AppState) => {
    setState(newState);
  };

  const handleUploadComplete = (newState: AppState) => {
    console.log('Upload complete.');
    setState(newState);
  };

  const handleProjectTemplateUpdate = (updatedTemplates: typeof projectTypes) => {
    setProjectTypes(updatedTemplates);
  };

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
    if (confirm('Are you sure you want to clear the current workspace? This will reset the current view but not delete backups or saved project types.')) {
      setState(initialAppState);
      setCurrentProjectId(null);
      setProjectTypeSelected(false);
      setTokenCount(0);
      setError(null);
      setSelectedRepoFullName(null); // Reset GitHub state too
      setSelectedBranchName(null);
      setBranches([]);
      setGithubTree(null);
      setGithubSelectionError(null);
      setActiveSourceTab('local'); // Reset to local tab
      console.log('Workspace cleared.');
    }
  };

  // Determine current dataSource based on active tab and state
  // Memoize the dataSource to prevent unnecessary re-renders downstream
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
  }, [activeSourceTab, githubTree, state.analysisResult?.files]); // Dependencies for memoization

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
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
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
            <Card className="glass-card animate-slide-up">
              <CardContent className="p-4 sm:pt-6 space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2 mb-2 sm:mb-4">
                  <GitBranchPlus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <h2 className="font-heading font-semibold text-sm sm:text-base">Project Configuration</h2>
                </div>

                {/* --- Source Selection Tabs --- */}
                <Tabs value={activeSourceTab} onValueChange={setActiveSourceTab} className="w-full">
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
                       state={state}
                       setState={setState}
                       onProjectTypeSelected={setProjectTypeSelected}
                       projectTypes={projectTypes}
                       onProjectTemplatesUpdate={handleProjectTemplateUpdate}
                     />
                     <FileUploadSection
                       state={state}
                       setState={setState}
                       // Pass unified loading setter
                       setLoadingStatus={setLoadingStatus}
                       updateCurrentProject={updateCurrentProject}
                       setError={setError}
                       onUploadComplete={handleUploadComplete}
                       projectTypeSelected={projectTypeSelected}
                       buttonTooltip="Reads current files from your disk, including uncommitted changes."
                     />
                     <p className="text-xs text-muted-foreground pt-1">
                       Reads the <i>current state</i> of your files (including uncommitted changes). Processed locally.
                     </p>
                  </TabsContent>

                  {/* GITHUB TAB */}
                  <TabsContent value="github" className="mt-0 space-y-3">
                    {/* GitHub Connection Logic - To be potentially moved to a component */}
                    {/* Use unified loading state instead of isLoadingGithubUser */}
                    {loadingStatus.isLoading && loadingStatus.message?.includes('GitHub connection') ? (
                      <div className="text-center text-muted-foreground text-xs sm:text-sm pt-2">Checking GitHub connection...</div>
                    ) : githubUser ? (
                      <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm pt-1">
                         <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center gap-2">
                             {githubUser.avatarUrl && (
                                <Image
                                   src={githubUser.avatarUrl}
                                   alt={`${githubUser.login} avatar`}
                                   width={24}
                                   height={24}
                                   className="rounded-full"
                                />
                             )}
                             <span className="font-medium">{githubUser.login}</span>
                             <CheckCircle className="h-4 w-4 text-green-500" />
                           </div>
                           <Button variant="ghost" size="sm" onClick={handleGitHubLogout} title="Disconnect GitHub">
                             <XCircle className="h-4 w-4" />
                           </Button>
                         </div>

                         {/* Repo Selector */}
                         <div className="space-y-1">
                           <label htmlFor="github-repo-select" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <BookMarked className="h-3 w-3" /> Repository
                           </label>
                           <Select
                             value={selectedRepoFullName || ''}
                             onValueChange={handleRepoChange}
                             // Use unified loading state
                             disabled={loadingStatus.isLoading || repos.length === 0}
                           >
                              <SelectTrigger id="github-repo-select" className="text-xs sm:text-sm">
                                  <SelectValue placeholder={loadingStatus.isLoading && loadingStatus.message?.includes('repositories') ? "Loading..." : "Select repository..."} />
                              </SelectTrigger>
                              <SelectContent>
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
                           <div className="space-y-1">
                             <label htmlFor="github-branch-select" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                               <GitBranch className="h-3 w-3" /> Branch
                             </label>

                             {/* Use unified loading state */}
                             {loadingStatus.isLoading && loadingStatus.message?.includes('branches') ? (
                               <div className="text-center text-muted-foreground text-xs py-2">Loading branches...</div>
                             ) : branches.length > 0 ? (
                               <div className="border rounded-md p-2 max-h-36 sm:max-h-48 overflow-y-auto">
                                 {branches.map((branch: GitHubBranch) => (
                                   <Button
                                     key={branch.name}
                                     size="sm"
                                     variant={selectedBranchName === branch.name ? "default" : "ghost"}
                                     className="w-full justify-start text-xs mb-1"
                                     onClick={() => handleBranchChange(branch.name)}
                                     // Disable while fetching tree/content
                                     disabled={loadingStatus.isLoading && (loadingStatus.message?.includes('tree') || loadingStatus.message?.includes('contents'))}
                                   >
                                     <GitBranch className="h-3 w-3 mr-1" />
                                     {branch.name}
                                   </Button>
                                 ))}
                               </div>
                             ) : (
                               <div className="text-center text-muted-foreground text-xs py-2">No branches found</div>
                             )}
                           </div>
                         )}

                         {/* Error Display for Selection */}
                         {githubSelectionError && (
                           <p className="text-xs text-destructive">Error: {githubSelectionError}</p>
                         )}

                         {/* Use unified loading for tree/content instead of separate indicators */} 
                         {/* {isLoadingTree && ... } -> Handled by unified indicator */} 
                         {/* {isLoadingFileContents && ... } -> Handled by unified indicator */} 

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
                                size="sm"
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
                          <p className="text-xs text-destructive mt-2">{githubError}</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground pt-1">
                       <b>GitHub:</b> Reads the <i>committed files</i> directly from the selected repository and branch.
                    </p>
                  </TabsContent>
                </Tabs>
                {/* --- End of Source Selection Tabs --- */}

                <BackupManagement
                  state={state}
                  setState={setState}
                  updateCurrentProject={updateCurrentProject}
                />

                <Button
                  variant="outline"
                  onClick={handleResetWorkspace}
                  className="w-full transition-all hover:border-destructive hover:text-destructive"
                  disabled={!currentDataSource}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear Workspace
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

            {/* Conditionally render AnalysisResult based on having a valid dataSource */}
            {currentDataSource ? (
              <>
                <AnalysisResult
                  analysisResult={state.analysisResult} // Keep passing analysisResult for data
                  selectedFiles={state.selectedFiles}
                  onSelectedFilesChange={(filesOrUpdater) => {
                    setState(prevState => ({
                      ...prevState,
                      selectedFiles: typeof filesOrUpdater === 'function'
                        ? filesOrUpdater(prevState.selectedFiles)
                        : filesOrUpdater
                    }));
                  }}
                  tokenCount={tokenCount}
                  setTokenCount={setTokenCount}
                  maxTokens={MAX_TOKENS}
                  dataSource={currentDataSource} // Pass the determined dataSource
                  // Pass unified loading setter
                  setLoadingStatus={setLoadingStatus}
                  // Pass the loading state object itself
                  loadingStatus={loadingStatus} 
                />
              </>
            ) : (
              <Card className="glass-card flex flex-col items-center justify-center p-12 text-center h-[400px]">
                <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-heading font-semibold mb-2">No Project Loaded</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  {activeSourceTab === 'local' ?
                    'Select a project type and upload a folder using the "Local" tab.' :
                    'Connect to GitHub, select a repository and branch using the "GitHub" tab.'
                  }
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
      <AnalyticsComponent />
    </div>
  );
}