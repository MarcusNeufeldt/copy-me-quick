"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModeToggle } from "@/components/ui/mode-toggle";
import ProjectSelector from '@/components/ProjectSelector';
import FileUploadSection from '@/components/FileUploadSection';
import AnalysisResult from '@/components/AnalysisResult';
import { AppState, Project, FileData, AnalysisResultData, GitHubRepoInfo } from '@/components/types';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { GithubIcon, RotateCcw, Code2, GitBranchPlus, LayoutGrid, Github, CheckCircle, XCircle, GitBranch, BookMarked, Computer, Loader2, ShieldCheck, RefreshCw, Filter } from 'lucide-react';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RecentProjectsDisplay from '@/components/RecentProjectsDisplay';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { saveDirectoryHandle, getDirectoryHandle } from '@/lib/indexeddb';
import { TokenCountDetails } from '@/hooks/useTokenCalculator';
import GitHubFilterManager from '@/components/GitHubFilterManager';
import LocalFilterManager from '@/components/LocalFilterManager';
import { toast, Toaster } from 'sonner';

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

// Default initial state
const initialAppState: AppState = {
  analysisResult: null,
  selectedFiles: [],
  excludeFolders: 'node_modules,.git,dist,.next,package-lock.json,yarn.lock,pnpm-lock.yaml',
  fileTypes: '.js,.jsx,.ts,.tsx,.py',
};

interface GitHubUser {
  id: string;
  login: string;
  avatar_url?: string;
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
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url: string;
  formattedSize?: string;
}

interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

interface UserContext {
  user: {
    id: string;
    login: string;
    avatar_url?: string;
    name?: string;
    global_github_exclude_folders: string;
    local_exclude_folders: string;
    local_file_types: string;
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

// SWR fetcher
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
});

// Helper function to format file sizes
function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper to recursively get files from a directory handle
async function getFilesFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  path: string = '',
  includeRootName: boolean = true
): Promise<File[]> {
  const files: File[] = [];
  const rootPrefix = path === '' && includeRootName ? dirHandle.name : '';
  
  // @ts-ignore: .values() is not yet in TypeScript's lib.dom.d.ts
  for await (const entry of (dirHandle as any).values()) {
    let newPath: string;
    
    if (path === '' && includeRootName) {
      newPath = `${rootPrefix}/${entry.name}`;
    } else if (path === '') {
      newPath = entry.name;
    } else {
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
      files.push(...(await getFilesFromHandle(entry, newPath, false)));
    }
  }
  return files;
}

export default function ClientPageRoot() {
  // Core state
  const [state, setState] = useState<AppState>(initialAppState);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [activeSourceTab, setActiveSourceTab] = useState<'local' | 'github'>('local');
  const [projectTypes, setProjectTypes] = useState(defaultProjectTypes);
  const [isMounted, setIsMounted] = useState(false);

  // UI state
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({ isLoading: false, message: null });
  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenDetails, setTokenDetails] = useState<TokenCountDetails | null>(null);
  const [projectTypeSelected, setProjectTypeSelected] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isLocalFilterSheetOpen, setIsLocalFilterSheetOpen] = useState(false);

  // GitHub state
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string | null>(null);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [githubTree, setGithubTree] = useState<GitHubTreeItem[] | null>(null);
  const [isGithubTreeTruncated, setIsGithubTreeTruncated] = useState(false);
  const [githubSelectionError, setGithubSelectionError] = useState<string | null>(null);

  // Dialog state
  const [showSwitchConfirmDialog, setShowSwitchConfirmDialog] = useState(false);
  const [nextTabValue, setNextTabValue] = useState<'local' | 'github' | null>(null);
  const [showLoadRecentConfirmDialog, setShowLoadRecentConfirmDialog] = useState(false);
  const [projectToLoadId, setProjectToLoadId] = useState<string | null>(null);
  const [loadConfirmationMessage, setLoadConfirmationMessage] = useState<string>('');

  // **THE MAGIC LINE** - This replaces ALL the complex localStorage loading logic
  const { data: userContext, error: userContextError, mutate } = useSWR<UserContext>('/api/user/context', fetcher);

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
    
    // Load project types from localStorage (this is UI-only, not user data)
    const savedTemplatesStr = localStorage.getItem('projectTemplates');
    if (savedTemplatesStr) {
      try {
        const parsedTemplates = JSON.parse(savedTemplatesStr);
        setProjectTypes(parsedTemplates);
      } catch (e) {
        console.error('Failed to parse project templates:', e);
      }
    }
  }, []);

  // Populate state when user context arrives
  useEffect(() => {
    if (userContext) {
      console.log('User context loaded:', userContext);
      
      // Set filters based on active source tab
      if (activeSourceTab === 'github') {
        setState(prevState => ({
          ...prevState,
          excludeFolders: userContext.user.global_github_exclude_folders
        }));
      } else {
        setState(prevState => ({
          ...prevState,
          excludeFolders: userContext.user.local_exclude_folders,
          fileTypes: userContext.user.local_file_types,
        }));
      }
      
      // If we have a saved current project, load it
      const savedProjectId = localStorage.getItem('currentProjectId');
      if (savedProjectId) {
        const project = userContext.projects.find(p => p.id === savedProjectId);
        if (project) {
          setCurrentProjectId(savedProjectId);
          setActiveSourceTab(project.source_type);
          
          if (project.source_type === 'github') {
            setSelectedRepoFullName(project.github_repo_full_name || null);
            setSelectedBranchName(project.github_branch || null);
            setState(prevState => ({
              ...prevState,
              excludeFolders: userContext.user.global_github_exclude_folders
            }));
          } else {
            // For local projects, restore their filters
            setState(prevState => ({
              ...prevState,
              excludeFolders: project.local_exclude_folders || userContext.user.local_exclude_folders,
              fileTypes: project.local_file_types || userContext.user.local_file_types,
            }));
          }
        }
      }
    }
  }, [userContext, activeSourceTab]);

  // Convert database projects to frontend Project format
  const projects = useMemo(() => {
    if (!userContext) return [];
    
    return userContext.projects.map(dbProject => ({
      id: dbProject.id,
      name: dbProject.name,
      sourceType: dbProject.source_type,
      githubRepoFullName: dbProject.github_repo_full_name,
      githubBranch: dbProject.github_branch,
      state: {
        analysisResult: null, // We don't store this in DB
        selectedFiles: [],
        excludeFolders: dbProject.source_type === 'github' 
          ? userContext.user.global_github_exclude_folders
          : (dbProject.local_exclude_folders || userContext.user.local_exclude_folders),
        fileTypes: dbProject.source_type === 'github'
          ? '.js,.jsx,.ts,.tsx,.py'
          : (dbProject.local_file_types || userContext.user.local_file_types),
      },
      lastAccessed: dbProject.last_accessed * 1000, // Convert to milliseconds
      isPinned: dbProject.is_pinned === 1,
      hasDirectoryHandle: false, // We'll check this separately if needed
    })) as Project[];
  }, [userContext]);

  // Create stable GitHub repo info
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

  // Fetch repos when user is authenticated
  useEffect(() => {
    if (!userContext?.user) {
      setRepos([]);
      return;
    }

    const fetchRepos = async () => {
      setLoadingStatus({ isLoading: true, message: 'Fetching repositories...' });
      setGithubSelectionError(null);
      try {
        const response = await fetch('/api/github/repos');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch repositories');
        }
        const repoData: GitHubRepo[] = await response.json();
        setRepos(repoData);
      } catch (error: any) {
        console.error('Error fetching repos:', error);
        setGithubSelectionError(error.message);
      } finally {
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    fetchRepos();
  }, [userContext?.user]);

  // Handle filter updates - now saves to database
  const handleSaveFilters = useCallback(async (newExclusions: string) => {
    setLoadingStatus({ isLoading: true, message: 'Saving filters...' });
    try {
      if (activeSourceTab === 'github') {
        // Save GitHub filters
        const response = await fetch('/api/user/filters', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ excludeFolders: newExclusions }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to save GitHub filters');
        }
        
        // Refresh GitHub tree if needed
        if (selectedBranchName) {
          setTimeout(() => {
            handleBranchChange(selectedBranchName);
          }, 100);
        }
      } else {
        // Save local filters
        const response = await fetch('/api/user/local-filters', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            excludeFolders: newExclusions,
            fileTypes: state.fileTypes 
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to save local filters');
        }
      }
      
      // Update local state
      setState(prevState => ({ ...prevState, excludeFolders: newExclusions }));
      
      // Refresh user context
      await mutate();
      
      toast.success(`${activeSourceTab === 'github' ? 'GitHub' : 'Local'} filters saved!`);
      
    } catch (error) {
      console.error('Error saving filters:', error);
      toast.error('Failed to save filters');
    } finally {
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [activeSourceTab, selectedBranchName, state.fileTypes, mutate]);

  // Handle local file type updates
  const handleSaveLocalFileTypes = useCallback(async (newFileTypes: string) => {
    setLoadingStatus({ isLoading: true, message: 'Saving file types...' });
    try {
      const response = await fetch('/api/user/local-filters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          excludeFolders: state.excludeFolders,
          fileTypes: newFileTypes 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save local file types');
      }
      
      // Update local state
      setState(prevState => ({ ...prevState, fileTypes: newFileTypes }));
      
      // Refresh user context
      await mutate();
      
      toast.success('Local file types saved!');
      
    } catch (error) {
      console.error('Error saving file types:', error);
      toast.error('Failed to save file types');
    } finally {
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [state.excludeFolders, mutate]);

  // Handle local filter updates (both exclusions and file types)
  const handleSaveLocalFilters = useCallback(async (newExclusions: string, newFileTypes: string) => {
    setLoadingStatus({ isLoading: true, message: 'Saving local filters...' });
    try {
      const response = await fetch('/api/user/local-filters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          excludeFolders: newExclusions,
          fileTypes: newFileTypes 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save local filters');
      }
      
      // Update local state
      setState(prevState => ({ 
        ...prevState, 
        excludeFolders: newExclusions,
        fileTypes: newFileTypes
      }));
      
      // Refresh user context
      await mutate();
      
      toast.success('Local filters saved!');
      
    } catch (error) {
      console.error('Error saving local filters:', error);
      toast.error('Failed to save local filters');
    } finally {
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [mutate]);

  // Handle repo selection
  const handleRepoChange = useCallback((repoFullName: string) => {
    setSelectedRepoFullName(repoFullName);
    setSelectedBranchName(null);
    setBranches([]);
    setGithubSelectionError(null);

    if (!repoFullName) return;

    const selectedRepo = repos.find(r => r.full_name === repoFullName);
    if (!selectedRepo) return;

    const fetchBranches = async () => {
      setLoadingStatus({ isLoading: true, message: 'Fetching branches...' });
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
        console.error('Error fetching branches:', error);
        setGithubSelectionError(error.message);
      } finally {
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    fetchBranches();
  }, [repos]);

  // Handle branch selection
  const handleBranchChange = useCallback((branchName: string) => {
    setGithubSelectionError(null);
    setGithubTree(null);
    setIsGithubTreeTruncated(false);

    if (!branchName || !selectedRepoFullName) {
      setSelectedBranchName(branchName);
      return;
    }

    setSelectedBranchName(branchName);

    const selectedRepo = repos.find(r => r.full_name === selectedRepoFullName);
    if (!selectedRepo) return;

    const fetchTreeAndSetProject = async () => {
      setLoadingStatus({ isLoading: true, message: 'Loading file tree...' });
      try {
        // Fetch tree structure
        const apiUrl = `/api/github/tree?owner=${selectedRepo.owner.login}&repo=${selectedRepo.name}&branch=${branchName}`;
        const treeResponse = await fetch(apiUrl);
        const treeData = await treeResponse.json();
        
        if (!treeResponse.ok) {
          throw new Error(treeData.error || 'Failed to fetch file tree');
        }

        const fullTreeFromAPI: GitHubTreeItem[] = treeData.tree || [];
        
        // Filter files based on current filters
        const excludedFolders = state.excludeFolders.split(',').map(f => f.trim()).filter(Boolean);
        const allowedFileTypes = state.fileTypes.split(',').map(t => t.trim()).filter(Boolean);
        
        const filesMetadata: FileData[] = fullTreeFromAPI
          .filter(item => {
            if (item.type !== 'blob') return false;

            const pathComponents = item.path.split('/');
            const isExcluded = pathComponents.slice(0, -1).some(folder => excludedFolders.includes(folder));
            if (isExcluded) return false;
            
            if (excludedFolders.includes(item.path)) return false;

            const fileExtension = item.path.includes('.') ? '.' + item.path.split('.').pop() : '';
            const fileMatchesType = allowedFileTypes.length === 0 || allowedFileTypes.includes('*') ||
              allowedFileTypes.some(type => {
                return item.path === type || (type.startsWith('.') && fileExtension === type);
              });
            
            return fileMatchesType;
          })
          .map(item => ({
            path: item.path,
            lines: 0,
            content: '',
            size: item.size,
            sha: item.sha,
            dataSourceType: 'github' as const
          }));

        // Enhance tree with formatted sizes
        const enhancedTree = fullTreeFromAPI.map(item => {
          if (item.type === 'blob' && item.size !== undefined) {
            return { ...item, formattedSize: formatFileSize(item.size) };
          }
          return item;
        });

        setGithubTree(enhancedTree);
        setIsGithubTreeTruncated(treeData.truncated ?? false);

        // Create analysis result
        const analysisResultData: AnalysisResultData = {
          totalFiles: filesMetadata.length,
          totalLines: 0,
          totalTokens: 0,
          summary: `GitHub repo: ${selectedRepoFullName}, Branch: ${branchName}`,
          project_tree: `GitHub Tree Structure for ${selectedRepoFullName}/${branchName}`,
          files: filesMetadata,
          commitDate: treeData.commitDate
        };

        // Find or create project
        let targetProjectId: string;
        const existingProject = projects.find(
          p => p.sourceType === 'github' && 
               p.githubRepoFullName === selectedRepoFullName && 
               p.githubBranch === branchName
        );

        if (existingProject) {
          targetProjectId = existingProject.id;
          // Update last accessed
          await fetch(`/api/projects/${targetProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ last_accessed: Math.floor(Date.now() / 1000) }),
          });
        } else {
          // Create new project
          targetProjectId = Date.now().toString();
          await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: targetProjectId,
              name: `${selectedRepoFullName} / ${branchName}`,
              sourceType: 'github',
              githubRepoFullName: selectedRepoFullName,
              githubBranch: branchName,
            }),
          });
        }

        // Update state
        setState(prevState => ({
          ...prevState,
          analysisResult: analysisResultData,
          selectedFiles: [],
        }));
        
        setCurrentProjectId(targetProjectId);
        localStorage.setItem('currentProjectId', targetProjectId);
        
        // Refresh user context
        await mutate();

      } catch (error: any) {
        console.error('Error during GitHub branch change:', error);
        setGithubSelectionError(error.message);
        setGithubTree(null);
      } finally {
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    fetchTreeAndSetProject();
  }, [repos, selectedRepoFullName, projects, state.excludeFolders, state.fileTypes, mutate]);

  // Handle project template updates
  const handleProjectTemplateUpdate = useCallback((updatedTemplates: typeof projectTypes) => {
    setProjectTypes(updatedTemplates);
    localStorage.setItem('projectTemplates', JSON.stringify(updatedTemplates));
  }, []);

  // Handle token count changes
  const handleTokenCountChange = useCallback((count: number, details?: TokenCountDetails) => {
    setTokenCount(count);
    setTokenDetails(details || null);
  }, []);

  // Handle GitHub login/logout
  const handleGitHubLogin = () => {
    window.location.href = '/api/auth/github/login';
  };

  const handleGitHubLogout = async () => {
    setLoadingStatus({ isLoading: true, message: 'Logging out from GitHub...' });
    try {
      const response = await fetch('/api/auth/github/logout', { method: 'POST' });
      if (response.ok) {
        setSelectedRepoFullName(null);
        setSelectedBranchName(null);
        setBranches([]);
        setRepos([]);
        setGithubTree(null);
        setActiveSourceTab('local');
        setState(initialAppState);
        setCurrentProjectId(null);
        localStorage.removeItem('currentProjectId');
        await mutate(); // This will return 401 and clear the context
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setLoadingStatus({ isLoading: false, message: null });
    }
  };

  // Handle workspace reset
  const handleResetWorkspace = useCallback(() => {
    setState(initialAppState);
    setCurrentProjectId(null);
    localStorage.removeItem('currentProjectId');
    setTokenCount(0);
    setError(null);
    setProjectTypeSelected(false);
    setSelectedRepoFullName(null);
    setSelectedBranchName(null);
    setGithubTree(null);
    setIsGithubTreeTruncated(false);
    setGithubSelectionError(null);
  }, []);

  // Handle tab switching
  const handleTabChangeAttempt = (newTabValue: 'local' | 'github') => {
    if (newTabValue !== activeSourceTab) {
      const hasSignificantAnalysisData = !!state.analysisResult && state.analysisResult.files.length > 0;
      
      if (hasSignificantAnalysisData) {
        setNextTabValue(newTabValue);
        setShowSwitchConfirmDialog(true);
      } else {
        setActiveSourceTab(newTabValue);
        
        // Load appropriate filters for the new tab
        if (newTabValue === 'github' && userContext) {
          setState(prevState => ({
            ...prevState,
            excludeFolders: userContext.user.global_github_exclude_folders
          }));
        } else if (newTabValue === 'local' && userContext) {
          setState(prevState => ({
            ...prevState,
            excludeFolders: userContext.user.local_exclude_folders,
            fileTypes: userContext.user.local_file_types,
          }));
        }
      }
    }
  };

  const confirmTabSwitch = () => {
    setState(prevState => ({ ...prevState, analysisResult: null, selectedFiles: [] }));
    setCurrentProjectId(null);
    localStorage.removeItem('currentProjectId');
    setTokenCount(0);
    setGithubTree(null);
    setIsGithubTreeTruncated(false);
    setGithubSelectionError(null);
    
    if (nextTabValue && userContext) {
      setActiveSourceTab(nextTabValue);
      
      // Load appropriate filters for the new tab
      if (nextTabValue === 'github') {
        setState(prevState => ({
          ...prevState,
          excludeFolders: userContext.user.global_github_exclude_folders
        }));
      } else {
        setState(prevState => ({
          ...prevState,
          excludeFolders: userContext.user.local_exclude_folders,
          fileTypes: userContext.user.local_file_types,
        }));
      }
    }
    
    setShowSwitchConfirmDialog(false);
    setNextTabValue(null);
  };

  const cancelTabSwitch = () => {
    setShowSwitchConfirmDialog(false);
    setNextTabValue(null);
  };

  // Loading states
  if (!isMounted) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/50 z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userContextError) {
    return (
      <div className="container px-4 py-8 max-w-2xl mx-auto">
        <div className="text-center space-y-6">
          {/* Header */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Code2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-heading font-bold">Copy Me Quick</h1>
          </div>
          
          {/* Login Card */}
          <Card className="p-8">
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Github className="h-12 w-12 mx-auto text-muted-foreground" />
                <h2 className="text-2xl font-semibold">Welcome!</h2>
                <p className="text-muted-foreground">
                  Sign in with GitHub to access your projects and settings
                </p>
              </div>
              
              <Button 
                onClick={handleGitHubLogin} 
                className="w-full" 
                size="lg"
              >
                <Github className="mr-2 h-5 w-5" />
                Continue with GitHub
              </Button>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Your projects and settings will be saved securely</p>
                <p>• Access your repositories and manage file filters</p>
                <p>• Sync across all your devices</p>
              </div>
            </CardContent>
          </Card>
          
          {userContextError.message !== 'Failed to fetch' && (
            <Alert variant="destructive">
              <AlertDescription>
                Failed to load your data. Please try again.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  if (!userContext) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/50 z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative">
      <Toaster position="top-center" />
      
      {/* Loading indicator */}
      {loadingStatus.isLoading && (
        <div className="fixed top-0 left-0 w-full h-1 bg-primary/10 z-50">
          <div className="h-full bg-gradient-to-r from-primary to-purple-500 animate-pulse-fast" style={{ width: '100%' }} />
          {loadingStatus.message && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-background border rounded-full shadow-lg text-xs font-medium flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {loadingStatus.message}
            </div>
          )}
        </div>
      )}

      {/* Header */}
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
          {/* Sidebar */}
          <aside className="flex flex-col gap-4">
            <Card className="glass-card animate-slide-up sticky top-[calc(theme(spacing.16)+1rem)]">
              <CardContent className="p-4 sm:p-5 space-y-4 sm:space-y-5">
                <div className="flex items-center gap-2 mb-2 sm:mb-4">
                  <GitBranchPlus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <h2 className="font-heading font-semibold text-sm sm:text-base">Project Configuration</h2>
                </div>

                {/* Source Selection Tabs */}
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
                    {/* Filter Button */}
                    <Button variant="outline" className="w-full" onClick={() => setIsLocalFilterSheetOpen(true)}>
                      <Filter className="mr-2 h-4 w-4" />
                      Filter Files & Folders
                    </Button>

                    <ProjectSelector
                      setState={setState}
                      onProjectTypeSelected={setProjectTypeSelected}
                      projectTypes={projectTypes}
                      onProjectTemplatesUpdate={handleProjectTemplateUpdate}
                    />
                    {/* FileUploadSection would go here - simplified for now */}
                    <Alert variant="default" className="mt-2 bg-primary/5 border-primary/20">
                      <ShieldCheck className="h-4 w-4 text-primary/80" />
                      <AlertDescription className="text-primary/90 text-xs">
                        <strong>Privacy Assured:</strong> Your local files are processed only in your browser.
                      </AlertDescription>
                    </Alert>
                    
                    <RecentProjectsDisplay 
                      projects={projects} 
                      onLoadProject={(id) => console.log('Load project:', id)}
                      onPinProject={(id, pinned) => console.log('Pin project:', id, pinned)}
                      onRemoveProject={(id) => console.log('Remove project:', id)}
                      onRenameProject={(id, name) => console.log('Rename project:', id, name)}
                    />
                  </TabsContent>

                  {/* GITHUB TAB */}
                  <TabsContent value="github" className="mt-0 space-y-3">
                    <div className="space-y-4 text-xs sm:text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {userContext.user.avatar_url && (
                            <Image
                              src={userContext.user.avatar_url}
                              alt={`${userContext.user.login} avatar`}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                          )}
                          <span className="font-medium truncate" title={userContext.user.login}>
                            {userContext.user.login}
                          </span>
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7" 
                          onClick={handleGitHubLogout} 
                          title="Disconnect GitHub"
                        >
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>

                      {/* Filter Button */}
                      <Button variant="outline" className="w-full" onClick={() => setIsFilterSheetOpen(true)}>
                        <Filter className="mr-2 h-4 w-4" />
                        Filter Files & Folders
                      </Button>

                      {/* Repo Selector */}
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <BookMarked className="h-3 w-3" /> Repository
                        </label>
                        <Select
                          value={selectedRepoFullName || ''}
                          onValueChange={handleRepoChange}
                          disabled={loadingStatus.isLoading}
                        >
                          <SelectTrigger className="text-xs sm:text-sm">
                            <SelectValue placeholder="Select repository..." />
                          </SelectTrigger>
                          <SelectContent>
                            {repos.map((repo) => (
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
                            <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <GitBranch className="h-3 w-3" /> Branch
                            </label>
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => selectedBranchName && handleBranchChange(selectedBranchName)}
                                    disabled={!selectedBranchName || loadingStatus.isLoading}
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Refresh file tree</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          {branches.length > 0 ? (
                            <ScrollArea className="h-40 w-full rounded-md border p-2">
                              {branches.map((branch) => (
                                <Button
                                  key={branch.name}
                                  size="sm"
                                  variant={selectedBranchName === branch.name ? "default" : "ghost"}
                                  className="w-full justify-start text-xs mb-1 h-8"
                                  onClick={() => handleBranchChange(branch.name)}
                                  disabled={loadingStatus.isLoading}
                                >
                                  <GitBranch className="h-3 w-3 mr-1" />
                                  {branch.name}
                                </Button>
                              ))}
                            </ScrollArea>
                          ) : (
                            <div className="text-center text-muted-foreground text-xs py-2">
                              No branches found
                            </div>
                          )}
                        </div>
                      )}

                      {githubSelectionError && (
                        <Alert variant="destructive" className="text-xs mt-2">
                          <AlertDescription>{githubSelectionError}</AlertDescription>
                        </Alert>
                      )}

                      {isGithubTreeTruncated && (
                        <Alert variant="default" className="text-xs mt-2">
                          <AlertDescription>
                            Warning: Repository tree is large and was truncated.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

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

            {state.analysisResult ? (
              <AnalysisResult
                analysisResult={state.analysisResult}
                selectedFiles={state.selectedFiles}
                onSelectedFilesChange={(files) => setState(prev => ({ ...prev, selectedFiles: typeof files === 'function' ? files(prev.selectedFiles) : files }))}
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
            ) : (
              <Card className="glass-card flex flex-col items-center justify-center p-8 sm:p-12 text-center min-h-[400px]">
                <LayoutGrid className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl sm:text-2xl font-heading font-semibold mb-2">Start Analyzing</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md mx-auto">
                  {activeSourceTab === 'local'
                    ? 'Select a project configuration or upload local files to begin.'
                    : 'Choose a repository and branch to analyze.'}
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
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

      {/* GitHub Filter Manager */}
      <GitHubFilterManager
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        currentExclusions={state.excludeFolders}
        onSave={handleSaveFilters}
      />

      {/* Local Filter Manager */}
      <LocalFilterManager
        isOpen={isLocalFilterSheetOpen}
        onClose={() => setIsLocalFilterSheetOpen(false)}
        currentExclusions={state.excludeFolders}
        currentFileTypes={state.fileTypes}
        onSave={handleSaveLocalFilters}
      />

      <AnalyticsComponent />
      <SpeedInsights />
    </div>
  );
} 