"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModeToggle } from "@/components/ui/mode-toggle";
import ProjectSelector from '@/components/ProjectSelector';
import FileUploadSection from '@/components/FileUploadSection';
import BackupManagement from '@/components/BackupManagement';
import AnalysisResult from '@/components/AnalysisResult';
import { AppState, Project, FileData, AnalysisResultData } from '@/components/types';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { GithubIcon, RotateCcw, Code2, GitBranchPlus, LayoutGrid, Github, CheckCircle, XCircle, GitBranch, BookMarked } from 'lucide-react';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileSelector from '@/components/FileSelector';

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

export default function ClientPageRoot() {
  // Initialize state with server-safe defaults
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [state, setState] = useState<AppState>(initialAppState);
  const [projectTypes, setProjectTypes] = useState(() => defaultProjectTypes); // Keep default types initially
  const [isMounted, setIsMounted] = useState(false); // Track client-side mount

  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [projectTypeSelected, setProjectTypeSelected] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [isLoadingGithubUser, setIsLoadingGithubUser] = useState(true); // Start loading initially

  // State for GitHub repo/branch selection
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [githubSelectionError, setGithubSelectionError] = useState<string | null>(null); // Separate error state for selection

  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [githubTree, setGithubTree] = useState<GitHubTreeItem[] | null>(null);
  const [isGithubTreeTruncated, setIsGithubTreeTruncated] = useState(false);

  // Load state from localStorage only on the client after mount
  useEffect(() => {
    setIsMounted(true); // Mark as mounted

    // Fetch GitHub user data if token might exist (client-side)
    const checkGitHubAuth = async () => {
      setIsLoadingGithubUser(true);
      setGithubError(null);
      try {
        const response = await fetch('/api/auth/github/user');
        if (response.ok) {
          const user: GitHubUser = await response.json();
          setGithubUser(user);
        } else if (response.status === 401) {
          // Not authenticated or token invalid
          setGithubUser(null);
        } else {
          // Other API error
          const errorData = await response.json();
          setGithubError(errorData.error || 'Failed to check GitHub status');
          setGithubUser(null);
        }
      } catch (err) {
        console.error("Error checking GitHub auth:", err);
        setGithubError('Network error checking GitHub status');
        setGithubUser(null);
      } finally {
        setIsLoadingGithubUser(false);
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
      setRepos([]); // Clear repos if user logs out
      setSelectedRepoFullName(null); // Clear selection
      return;
    }

    const fetchRepos = async () => {
      setIsLoadingRepos(true);
      setGithubSelectionError(null);
      setRepos([]); // Clear previous repos
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
        if (error.message === 'Invalid GitHub token') setGithubUser(null); // Log out if token is invalid
      } finally {
        setIsLoadingRepos(false);
      }
    };

    fetchRepos();
  }, [githubUser]); // Fetch repos when githubUser changes

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
      setIsLoadingBranches(true);
      setGithubSelectionError(null);
      try {
        const response = await fetch(`/api/github/branches?owner=${selectedRepo.owner.login}&repo=${selectedRepo.name}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch branches');
        }
        const branchData: GitHubBranch[] = await response.json();
        setBranches(branchData);
        // Automatically select the default branch if it exists
        const defaultBranch = branchData.find(b => b.name === selectedRepo.default_branch);
        if (defaultBranch) {
            setSelectedBranchName(defaultBranch.name);
        }

      } catch (error: any) {
        console.error("Error fetching branches:", error);
        setGithubSelectionError(error.message);
        if (error.message === 'Invalid GitHub token') setGithubUser(null); // Log out
      } finally {
        setIsLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [repos]); // This depends on the list of repos to find the selected one

  // Handle Branch Selection - Modified to fetch tree
  const handleBranchChange = useCallback((branchName: string) => {
    // Remove alert and debugging status
    setSelectedBranchName(branchName);
    setGithubSelectionError(null);
    setGithubTree(null);
    setState(prevState => ({ ...prevState, analysisResult: null, selectedFiles: [] }));
    setIsLoadingTree(false);
    setIsGithubTreeTruncated(false);

    if (!branchName || !selectedRepoFullName) {
      return;
    }

    const selectedRepo = repos.find(r => r.full_name === selectedRepoFullName);
    if (!selectedRepo) return;

    const fetchTree = async () => {
      setIsLoadingTree(true);
      setGithubSelectionError(null);
      try {
        const apiUrl = `/api/github/tree?owner=${selectedRepo.owner.login}&repo=${selectedRepo.name}&branch=${branchName}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!response.ok) {
             throw new Error(data.error || 'Failed to fetch file tree');
        }
        
        setGithubTree(data.tree);
        setIsGithubTreeTruncated(data.truncated ?? false);
        
        // Create a proper dataSource for the GitHub tree
        const repoInfo = {
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          branch: branchName
        };
        
        // Create pseudoAnalysis object structure
        const pseudoAnalysis = {
            totalFiles: data.tree.filter((item: any) => item.type === 'blob').length,
            totalLines: 0, // Placeholder
            totalTokens: 0, // Placeholder
            summary: `GitHub repo: ${selectedRepoFullName}, Branch: ${branchName}`,
            project_tree: `GitHub Tree Structure for ${selectedRepoFullName}/${branchName}`,
            files: [], // Initially empty, FileSelector will populate based on tree
        };
        
        setState(prevState => ({
             ...prevState, 
             analysisResult: pseudoAnalysis, 
             selectedFiles: [],
        }));

      } catch (error) {
        console.error("Error fetching GitHub tree:", error);
        setGithubSelectionError(error instanceof Error ? error.message : String(error));
        setGithubTree(null);
        if (error instanceof Error && error.message === 'Invalid GitHub token') setGithubUser(null);
      } finally {
        setIsLoadingTree(false);
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
    // This function now primarily updates the 'state' object.
    // The persistence useEffect will handle updating the 'projects' array in localStorage.
    setState(newState);
  };

  const handleUploadComplete = (newState: AppState) => {
    console.log('Upload complete.');
    setState(newState);
    // updateCurrentProject(newState); // No longer needed here, persistence useEffect handles it
  };

  const handleProjectTemplateUpdate = (updatedTemplates: typeof projectTypes) => {
    setProjectTypes(updatedTemplates);
  };

  const handleGitHubLogin = () => {
    // Redirect the user to the Next.js API route that starts the OAuth flow
    window.location.href = '/api/auth/github/login';
  };

  const handleGitHubLogout = async () => {
    // TODO: Add an API route to clear the cookie server-side
    // For now, just clear client-side state and redirect to trigger cookie removal via API if needed
    setGithubUser(null);
    setGithubError(null);
    // Optionally clear GitHub related state like selected repo/branch if stored
    // Redirect or call a specific logout endpoint that clears the cookie
    window.location.href = '/'; // Simple refresh/redirect might trigger cookie check
    console.log("GitHub logout initiated (client-side)");
    // We might need a proper /api/auth/github/logout endpoint later
  };

  // Handler function for the new Reset button
  const handleResetWorkspace = () => {
    if (confirm('Are you sure you want to clear the current workspace? This will reset the current view but not delete backups or saved project types.')) {
      setState(initialAppState);
      setCurrentProjectId(null); // Clear the current project ID
      setProjectTypeSelected(false); // Reset project type selection
      setTokenCount(0); // Reset token count
      setError(null); // Clear errors
      // The persistence useEffect will automatically handle saving the cleared currentProjectId
      // and the reset state for the (now non-current) project in the projects array.
      console.log('Workspace cleared.');
    }
  };

  // Prevent rendering potentially mismatched UI before mount
  if (!isMounted) {
    return null;
  }

  return (
    <div className="relative">
      {/* Header with background blur */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-heading font-bold text-gradient">Copy Me Quick</h1>
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
      
      <div className="container px-4 py-6 md:py-10 max-w-7xl mx-auto animate-fade-in">
        <div className="grid gap-6 md:grid-cols-[250px_1fr] lg:grid-cols-[280px_1fr]">
          {/* Sidebar Navigation */}
          <aside className="flex flex-col gap-4">
            <Card className="glass-card animate-slide-up">
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranchPlus className="h-5 w-5 text-primary" />
                  <h2 className="font-heading font-semibold">Project Configuration</h2>
                </div>
                
                <ProjectSelector
                  setState={setState}
                  onProjectTypeSelected={setProjectTypeSelected}
                  projectTypes={projectTypes}
                  onProjectTemplatesUpdate={handleProjectTemplateUpdate}
                />
                
                {/* --- GitHub Integration Start --- */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Load From</h3>
                  <FileUploadSection
                    state={state}
                    setState={setState}
                    updateCurrentProject={updateCurrentProject}
                    setError={setError}
                    onUploadComplete={handleUploadComplete}
                    projectTypeSelected={projectTypeSelected}
                  />
                  {/* Separator */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or
                      </span>
                    </div>
                  </div>
                  {/* GitHub Section */}
                  {isLoadingGithubUser ? (
                    <div className="text-center text-muted-foreground text-sm">Checking GitHub connection...</div>
                  ) : githubUser ? (
                    <div className="space-y-4 text-sm border-t pt-4 mt-4">
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
                           disabled={isLoadingRepos || repos.length === 0}
                         >
                            <SelectTrigger id="github-repo-select">
                                <SelectValue placeholder={isLoadingRepos ? "Loading repos..." : "Select repository..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {repos.map((repo: GitHubRepo) => (
                                <SelectItem key={repo.id} value={repo.full_name}>
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
                           
                           {/* Direct branch selection buttons */}
                           {isLoadingBranches ? (
                             <div className="text-center text-muted-foreground text-xs py-2">Loading branches...</div>
                           ) : branches.length > 0 ? (
                             <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
                               {branches.map((branch: GitHubBranch) => (
                                 <Button
                                   key={branch.name}
                                   size="sm"
                                   variant={selectedBranchName === branch.name ? "default" : "ghost"}
                                   className="w-full justify-start text-xs mb-1"
                                   onClick={() => handleBranchChange(branch.name)}
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

                       {/* Loading indicator for tree */}
                       {isLoadingTree && (
                           <div className="text-center text-muted-foreground text-xs py-2">Loading file tree...</div>
                       )}
                       {isGithubTreeTruncated && (
                          <Alert variant="default" className="text-xs mt-2">
                             <AlertDescription>Warning: Repository tree is large and was truncated. Some files/folders might be missing.</AlertDescription>
                          </Alert>
                       )}
                       {/* FileSelector will now be rendered conditionally based on githubTree */} 
                    </div>
                  ) : (
                    <>
                      <Button
                         variant="outline"
                         className="w-full"
                         onClick={handleGitHubLogin}
                      >
                        <Github className="mr-2 h-4 w-4" /> Connect to GitHub
                      </Button>
                      {githubError && (
                         <p className="text-xs text-destructive">Error: {githubError}</p>
                      )}
                    </>
                  )}
                </div>
                {/* --- GitHub Integration End --- */}
                
                <BackupManagement
                  state={state}
                  setState={setState}
                  updateCurrentProject={updateCurrentProject}
                />
                
                <Button
                  variant="outline"
                  onClick={handleResetWorkspace}
                  className="w-full transition-all hover:border-destructive hover:text-destructive"
                  disabled={!state.analysisResult && !currentProjectId}
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

            {/* Conditionally render AnalysisResult */} 
            {state.analysisResult || githubTree ? (
              <>
                <AnalysisResult
                  state={state}
                  setState={setState}
                  updateCurrentProject={updateCurrentProject}
                  tokenCount={tokenCount}
                  setTokenCount={setTokenCount}
                  maxTokens={MAX_TOKENS}
                  dataSource={githubTree ? {
                    type: 'github' as const,
                    tree: githubTree,
                    repoInfo: selectedRepoFullName && selectedBranchName ? {
                      owner: selectedRepoFullName.split('/')[0],
                      repo: selectedRepoFullName.split('/')[1],
                      branch: selectedBranchName
                    } : undefined
                  } : undefined}
                />
              </>
            ) : (
              <Card className="glass-card flex flex-col items-center justify-center p-12 text-center h-[400px]">
                <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-heading font-semibold mb-2">No Project Loaded</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Select a project type and upload a folder to get started. Your file tree will appear here.
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