"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import AnalysisResult from '@/components/AnalysisResult';
import {
  AppState,
  Project,
  FileData,
  AnalysisResultData,
  GitHubRepoInfo,
  GitHubUser,
  GitHubRepo,
  GitHubBranch,
  GitHubCommit,
  GitHubCommitFile,
  GitHubOwner,
  GitHubPullFile,
  GitHubPullRequest,
  GitHubSourceMode,
  GitHubTreeItem,
} from '@/components/types';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import GitHubFilterManager from '@/components/GitHubFilterManager';
import LocalFilterManager from '@/components/LocalFilterManager';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { saveDirectoryHandle, getDirectoryHandle } from '@/lib/indexeddb';
import { TokenCountDetails } from '@/hooks/useTokenCalculator';
import { AppHeader } from '@/components/page/AppHeader';
import { EmptyAnalysisState } from '@/components/page/EmptyAnalysisState';
import { LoadingIndicator } from '@/components/page/LoadingIndicator';
import { PageDialogs } from '@/components/page/PageDialogs';
import { SourceSidebar } from '@/components/page/SourceSidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { defaultProjectTypes, initialAppState, MAX_RECENT_PROJECTS, MAX_TOKENS } from '@/lib/appDefaults';
import { getFilesFromHandle } from '@/lib/localDirectory';
import { formatFileSize } from '@/components/fileSelectorUtils';

// Dynamically import Analytics with error handling
const AnalyticsComponent = dynamic(
  () => import('@vercel/analytics/react').then((mod) => mod.Analytics).catch(() => () => null),
  { ssr: false, loading: () => null }
);

// Unified Loading State Type
interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

const mergeGitHubOwners = (
  githubUser: GitHubUser,
  owners: GitHubOwner[],
  repos: GitHubRepo[]
): GitHubOwner[] => {
  const ownerMap = new Map<string, GitHubOwner>();

  ownerMap.set(githubUser.login, {
    login: githubUser.login,
    type: 'User',
    avatarUrl: githubUser.avatarUrl,
  });

  owners.forEach((owner) => {
    ownerMap.set(owner.login, owner);
  });

  repos.forEach((repo) => {
    const login = repo.owner?.login;
    if (!login || ownerMap.has(login)) return;

    ownerMap.set(login, {
      login,
      type: login === githubUser.login ? 'User' : 'Organization',
    });
  });

  return Array.from(ownerMap.values()).sort((a, b) => {
    if (a.login === githubUser.login) return -1;
    if (b.login === githubUser.login) return 1;
    if (a.type !== b.type) return a.type === 'Organization' ? -1 : 1;
    return a.login.localeCompare(b.login);
  });
};

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
  const [projectTypeSelected, setProjectTypeSelected] = useState(true);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);

  // State for GitHub repo/branch selection
  const [githubOwners, setGithubOwners] = useState<GitHubOwner[]>([]);
  const [selectedOwnerLogin, setSelectedOwnerLogin] = useState<string | null>(null);
  const [allRepos, setAllRepos] = useState<GitHubRepo[]>([]);
  const [githubReposLoaded, setGithubReposLoaded] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string | null>(null);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [selectedPullNumber, setSelectedPullNumber] = useState<number | null>(null);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommit | null>(null);
  const [githubSourceMode, setGithubSourceMode] = useState<GitHubSourceMode>('pull');
  const [selectedPullRequest, setSelectedPullRequest] = useState<GitHubPullRequest | null>(null);
  const [githubSelectionError, setGithubSelectionError] = useState<string | null>(null); // Separate error state for selection

  const [fileLoadingProgress, setFileLoadingProgress] = useState({ current: 0, total: 0 });
  const [githubTree, setGithubTree] = useState<GitHubTreeItem[] | null>(null);
  const [isGithubTreeTruncated, setIsGithubTreeTruncated] = useState(false);
  const [fileLoadingMessage, setFileLoadingMessage] = useState<string | null>(null); // Keep this for specific warnings

  // Filter Manager States
  const [isLocalFilterManagerOpen, setIsLocalFilterManagerOpen] = useState(false);
  const [isGitHubFilterManagerOpen, setIsGitHubFilterManagerOpen] = useState(false);
  const [githubExclusions, setGithubExclusions] = useState<string>('package-lock.json,yarn.lock,*.svg,*.png,*.jpg,*.ico');

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
        setState(loadedState);
        setCurrentProjectId(savedProjectId); // Set project ID after state/tab
        loadedStateFromStorage = true;

        // If it's a GitHub project, restore relevant GitHub state too
        if (currentProject.sourceType === 'github' && currentProject.githubRepoFullName && currentProject.githubBranch) {
            console.log(`Restoring GitHub context: Repo=${currentProject.githubRepoFullName}, Branch=${currentProject.githubBranch}`); // Added log
            setSelectedOwnerLogin(currentProject.githubRepoFullName.split('/')[0]);
            setSelectedRepoFullName(currentProject.githubRepoFullName);
            setSelectedBranchName(currentProject.githubBranch);
            setGithubSourceMode(currentProject.githubSourceMode || (currentProject.githubPullNumber ? 'pull' : currentProject.githubCommitSha ? 'commit' : 'branch'));
            setSelectedPullNumber(currentProject.githubPullNumber || null);
            setSelectedCommitSha(currentProject.githubCommitSha || null);
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

    // Load GitHub exclusions from localStorage
    const savedGithubExclusions = localStorage.getItem('githubExclusions');
    if (savedGithubExclusions) {
      setGithubExclusions(savedGithubExclusions);
    }

    // Load the state for the current project
    if (savedProjectId) {
      const currentProject = loadedProjects.find((p: Project) => p.id === savedProjectId);
      if (currentProject) {
        const loadedState = currentProject.state;
        setState(loadedState);
      } else {
         setState(initialAppState); // Reset if project not found
      }
    } else {
      setState(initialAppState); // Reset if no project ID
    }

  }, []); // Initial load effect - dependency array is empty

  // Sync filters with server when user is logged in
  useEffect(() => {
    if (!githubUser) return;

    const syncFiltersFromServer = async () => {
      try {
        const response = await fetch('/api/user/filters');
        if (response.ok) {
          const data = await response.json();
          if (data.synced) {
            // Only override if server has saved filters
            if (data.githubExclusions) {
              setGithubExclusions(data.githubExclusions);
              localStorage.setItem('githubExclusions', data.githubExclusions);
            }
            if (data.localExclusions || data.localFileTypes) {
              setState(prev => ({
                ...prev,
                excludeFolders: data.localExclusions || prev.excludeFolders,
                fileTypes: data.localFileTypes || prev.fileTypes,
              }));
            }
            console.log('[Filters] Synced filters from server');
          }
        }
      } catch (error) {
        console.log('[Filters] Failed to sync from server (Turso may not be configured):', error);
      }
    };

    syncFiltersFromServer();
  }, [githubUser]);

  // Fetch GitHub account/org owners when GitHub user is loaded
  useEffect(() => {
    if (!githubUser) {
      setGithubOwners([]);
      setSelectedOwnerLogin(null);
      setAllRepos([]);
      setGithubReposLoaded(false);
      setRepos([]);
      setSelectedRepoFullName(null);
      return;
    }

    const fetchOwners = async () => {
      setLoadingStatus({ isLoading: true, message: 'Fetching GitHub accounts and repositories...' });
      setGithubSelectionError(null);
      setGithubReposLoaded(false);
      try {
        const [ownersResponse, reposResponse] = await Promise.all([
          fetch('/api/github/owners'),
          fetch('/api/github/repos'),
        ]);

        let ownersData: GitHubOwner[] = [];

        if (ownersResponse.ok) {
          ownersData = await ownersResponse.json();
        } else {
          const errorData = await ownersResponse.json();
          console.warn('Failed to fetch GitHub org memberships:', errorData.error || ownersResponse.statusText);
        }

        if (!reposResponse.ok) {
          const errorData = await reposResponse.json();
          throw new Error(errorData.error || 'Failed to fetch repositories');
        }

        const repoData: GitHubRepo[] = await reposResponse.json();
        const mergedOwners = mergeGitHubOwners(githubUser, ownersData, repoData);

        setAllRepos(repoData);
        setGithubReposLoaded(true);
        setGithubOwners(mergedOwners);
        setSelectedOwnerLogin(prev => {
          if (prev && mergedOwners.some(owner => owner.login === prev)) return prev;
          return mergedOwners[0]?.login || githubUser.login;
        });
      } catch (error: any) {
        console.error("Error fetching GitHub owners:", error);
        setGithubReposLoaded(false);
        setGithubSelectionError(error.message);
        if (error.message === 'Invalid GitHub token') setGithubUser(null);
      } finally {
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    fetchOwners();
  }, [githubUser]);

  // Filter repositories when a GitHub owner is selected.
  useEffect(() => {
    if (!githubUser || !selectedOwnerLogin) {
      setRepos([]);
      setSelectedRepoFullName(null);
      return;
    }

    if (!githubReposLoaded) {
      setRepos([]);
      return;
    }

    const ownerRepos = allRepos.filter((repo) => repo.owner?.login === selectedOwnerLogin);

    setRepos(ownerRepos);
    setSelectedRepoFullName(prev => {
      if (
        prev &&
        prev.startsWith(`${selectedOwnerLogin}/`) &&
        ownerRepos.some((repo) => repo.full_name === prev)
      ) {
        return prev;
      }

      return null;
    });
  }, [allRepos, githubReposLoaded, githubUser, selectedOwnerLogin]);

  // Fetch Branches when a repo is selected
  const handleOwnerChange = useCallback((ownerLogin: string) => {
    setSelectedOwnerLogin(ownerLogin);
    setSelectedRepoFullName(null);
    setSelectedBranchName(null);
    setSelectedPullNumber(null);
    setSelectedPullRequest(null);
    setSelectedCommitSha(null);
    setSelectedCommit(null);
    setCommits([]);
    setBranches([]);
    setPullRequests([]);
    setCommits([]);
    setGithubTree(null);
    setGithubSelectionError(null);
  }, []);

  const handleRepoChange = useCallback((repoFullName: string) => {
    setSelectedRepoFullName(repoFullName);
    setSelectedBranchName(null); // Reset branch selection
    setSelectedPullNumber(null);
    setSelectedPullRequest(null);
    setSelectedCommitSha(null);
    setSelectedCommit(null);
    setBranches([]); // Clear old branches
    setPullRequests([]);
    setCommits([]);
    setGithubTree(null);
    setIsGithubTreeTruncated(false);
    setGithubSelectionError(null);

    if (!repoFullName) {
      return;
    }

    const selectedRepo = repos.find(r => r.full_name === repoFullName);
    if (!selectedRepo) return;

    const fetchRepoData = async () => {
      // Use unified loading state
      setLoadingStatus({ isLoading: true, message: 'Fetching repository refs...' });
      setGithubSelectionError(null);
      try {
        const [branchesResponse, pullsResponse] = await Promise.all([
          fetch(`/api/github/branches?owner=${selectedRepo.owner.login}&repo=${selectedRepo.name}`),
          fetch(`/api/github/pulls?owner=${selectedRepo.owner.login}&repo=${selectedRepo.name}&state=open&limit=30`),
        ]);

        if (!branchesResponse.ok) {
          const errorData = await branchesResponse.json();
          throw new Error(errorData.error || 'Failed to fetch branches');
        }
        const branchData: GitHubBranch[] = await branchesResponse.json();
        setBranches(branchData);

        if (pullsResponse.ok) {
          const pullData: GitHubPullRequest[] = await pullsResponse.json();
          setPullRequests(pullData);
        } else {
          console.warn('Failed to fetch pull requests for repository', await pullsResponse.text());
          setPullRequests([]);
        }

      } catch (error: any) {
        console.error("Error fetching repository refs:", error);
        setGithubSelectionError(error.message);
        if (error.message === 'Invalid GitHub token') setGithubUser(null);
      } finally {
        // Clear loading state
        setLoadingStatus({ isLoading: false, message: null });
      }
    };

    fetchRepoData();
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
    setGithubSourceMode('branch');
    setSelectedPullNumber(null);
    setSelectedPullRequest(null);
    setSelectedCommitSha(null);
    setSelectedCommit(null);

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

  }, [repos, selectedRepoFullName, projects, setProjects, setState, setCurrentProjectId, setLoadingStatus]); // Added projects dependencies

  const loadPullRequest = useCallback(async (owner: string, repo: string, pullNumber: number) => {
    const repoFullName = `${owner}/${repo}`;

    setLoadingStatus({ isLoading: true, message: `Loading PR #${pullNumber} file tree...` });
    setGithubSelectionError(null);
    setGithubSourceMode('pull');
    setSelectedOwnerLogin(owner);
    setSelectedRepoFullName(repoFullName);
    setSelectedPullNumber(pullNumber);
    setSelectedBranchName(null);
    setSelectedCommitSha(null);
    setSelectedCommit(null);
    setGithubTree(null);
    setIsGithubTreeTruncated(false);
    setFileLoadingProgress({ current: 0, total: 0 });
    setFileLoadingMessage(null);

    try {
      const response = await fetch(`/api/github/pull-files?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&pullNumber=${pullNumber}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch pull request files');
      }

      const pull: GitHubPullRequest = data.pull;
      const pullFiles: GitHubPullFile[] = data.files || [];
      const pullCommits: GitHubCommit[] = data.commits || [];
      setSelectedPullRequest(pull);
      setCommits(pullCommits);

      const enhancedTree: GitHubTreeItem[] = pullFiles.map((file) => ({
        path: file.filename,
        mode: '100644',
        type: 'blob',
        sha: file.sha,
        url: '',
        formattedSize: `+${file.additions} / -${file.deletions}`,
        ref: pull.head.sha,
        baseRef: pull.base.sha,
        patch: file.patch,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        previousPath: file.previous_filename,
        pullNumber,
      }));

      setGithubTree(enhancedTree);

      const filesMetadata: FileData[] = pullFiles.map((file) => ({
        path: file.filename,
        lines: 0,
        content: '',
        sha: file.sha,
        ref: pull.head.sha,
        baseRef: pull.base.sha,
        patch: file.patch,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        previousPath: file.previous_filename,
        pullNumber,
        dataSourceType: 'github',
      }));

      const analysisResultData: AnalysisResultData = {
        totalFiles: filesMetadata.length,
        totalLines: 0,
        totalTokens: 0,
        summary: `GitHub PR: ${repoFullName} #${pullNumber} - ${pull.title}`,
        project_tree: `GitHub PR file tree for ${repoFullName} #${pullNumber}`,
        files: filesMetadata,
        commitDate: pull.updated_at,
      };

      const existingProject = projects.find(
        (p) =>
          p.sourceType === 'github' &&
          p.githubRepoFullName === repoFullName &&
          p.githubPullNumber === pullNumber &&
          p.githubSourceMode !== 'commit'
      );

      const targetProjectId = existingProject?.id || Date.now().toString();
      const finalState: AppState = {
        ...(existingProject?.state || initialAppState),
        analysisResult: analysisResultData,
        selectedFiles: [],
      };

      if (existingProject) {
        setProjects(prevProjects =>
          prevProjects.map(p =>
            p.id === targetProjectId
              ? {
                  ...p,
                  name: `${repoFullName} PR #${pullNumber}`,
                  githubSourceMode: 'pull',
                  githubPullNumber: pullNumber,
                  githubCommitSha: undefined,
                  githubBranch: pull.head.ref,
                  state: finalState,
                  lastAccessed: Date.now(),
                }
              : p
          )
        );
      } else {
        const newProject: Project = {
          id: targetProjectId,
          name: `${repoFullName} PR #${pullNumber}`,
          sourceType: 'github',
          githubRepoFullName: repoFullName,
          githubBranch: pull.head.ref,
          githubPullNumber: pullNumber,
          githubSourceMode: 'pull',
          state: finalState,
          lastAccessed: Date.now(),
        };
        setProjects(prevProjects => [...prevProjects, newProject]);
      }

      setState(finalState);
      setCurrentProjectId(targetProjectId);
    } catch (error) {
      console.error("Error loading pull request:", error);
      setGithubSelectionError(error instanceof Error ? error.message : String(error));
      setGithubTree(null);
      if (error instanceof Error && error.message === 'Invalid GitHub token') setGithubUser(null);
    } finally {
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [projects, setCurrentProjectId, setLoadingStatus, setProjects, setState]);

  const loadCommit = useCallback(async (owner: string, repo: string, commitSha: string, pullNumber?: number) => {
    const repoFullName = `${owner}/${repo}`;

    setLoadingStatus({ isLoading: true, message: `Loading commit ${commitSha.slice(0, 7)} file tree...` });
    setGithubSelectionError(null);
    setGithubSourceMode('commit');
    setSelectedOwnerLogin(owner);
    setSelectedRepoFullName(repoFullName);
    setSelectedCommitSha(commitSha);
    setSelectedBranchName(null);
    if (pullNumber) {
      setSelectedPullNumber(pullNumber);
    }
    setGithubTree(null);
    setIsGithubTreeTruncated(false);
    setFileLoadingProgress({ current: 0, total: 0 });
    setFileLoadingMessage(null);

    try {
      const response = await fetch(`/api/github/commit-files?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&sha=${encodeURIComponent(commitSha)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch commit files');
      }

      const commit: GitHubCommit = data.commit;
      const commitFiles: GitHubCommitFile[] = data.files || [];
      const baseRef = commit.parents?.[0]?.sha;
      setSelectedCommit(commit);

      const enhancedTree: GitHubTreeItem[] = commitFiles.map((file) => ({
        path: file.filename,
        mode: '100644',
        type: 'blob',
        sha: file.sha,
        url: '',
        formattedSize: `+${file.additions} / -${file.deletions}`,
        ref: commit.sha,
        baseRef,
        patch: file.patch,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        previousPath: file.previous_filename,
        commitSha: commit.sha,
      }));

      setGithubTree(enhancedTree);

      const filesMetadata: FileData[] = commitFiles.map((file) => ({
        path: file.filename,
        lines: 0,
        content: '',
        sha: file.sha,
        ref: commit.sha,
        baseRef,
        patch: file.patch,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        previousPath: file.previous_filename,
        commitSha: commit.sha,
        dataSourceType: 'github',
      }));

      const analysisResultData: AnalysisResultData = {
        totalFiles: filesMetadata.length,
        totalLines: 0,
        totalTokens: 0,
        summary: `GitHub commit: ${repoFullName} ${commit.shortSha} - ${commit.message}`,
        project_tree: `GitHub commit file tree for ${repoFullName} ${commit.shortSha}`,
        files: filesMetadata,
        commitDate: commit.date,
      };

      const existingProject = projects.find(
        (p) =>
          p.sourceType === 'github' &&
          p.githubRepoFullName === repoFullName &&
          p.githubPullNumber === pullNumber &&
          p.githubCommitSha === commit.sha
      );

      const targetProjectId = existingProject?.id || Date.now().toString();
      const finalState: AppState = {
        ...(existingProject?.state || initialAppState),
        analysisResult: analysisResultData,
        selectedFiles: [],
      };

      if (existingProject) {
        setProjects(prevProjects =>
          prevProjects.map(p =>
            p.id === targetProjectId
              ? {
                  ...p,
                  name: pullNumber
                    ? `${repoFullName} PR #${pullNumber} commit ${commit.shortSha}`
                    : `${repoFullName} commit ${commit.shortSha}`,
                  githubSourceMode: 'commit',
                  githubPullNumber: pullNumber,
                  githubCommitSha: commit.sha,
                  githubBranch: commit.sha,
                  state: finalState,
                  lastAccessed: Date.now(),
                }
              : p
          )
        );
      } else {
        const newProject: Project = {
          id: targetProjectId,
          name: pullNumber
            ? `${repoFullName} PR #${pullNumber} commit ${commit.shortSha}`
            : `${repoFullName} commit ${commit.shortSha}`,
          sourceType: 'github',
          githubRepoFullName: repoFullName,
          githubBranch: commit.sha,
          githubPullNumber: pullNumber,
          githubCommitSha: commit.sha,
          githubSourceMode: 'commit',
          state: finalState,
          lastAccessed: Date.now(),
        };
        setProjects(prevProjects => [...prevProjects, newProject]);
      }

      setState(finalState);
      setCurrentProjectId(targetProjectId);
    } catch (error) {
      console.error("Error loading commit:", error);
      setGithubSelectionError(error instanceof Error ? error.message : String(error));
      setGithubTree(null);
      if (error instanceof Error && error.message === 'Invalid GitHub token') setGithubUser(null);
    } finally {
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [projects, setCurrentProjectId, setLoadingStatus, setProjects, setState]);

  const handlePullRequestSelect = useCallback((pullNumber: number) => {
    const repoFullName = selectedRepoFullName;
    if (!repoFullName || !pullNumber) return;
    const [owner, repo] = repoFullName.split('/');
    loadPullRequest(owner, repo, pullNumber);
  }, [loadPullRequest, selectedRepoFullName]);

  const handleCommitSelect = useCallback((commitSha: string | null) => {
    const repoFullName = selectedRepoFullName;
    if (!repoFullName) return;
    const [owner, repo] = repoFullName.split('/');
    if (!commitSha) {
      if (selectedPullNumber) {
        loadPullRequest(owner, repo, selectedPullNumber);
      }
      return;
    }
    loadCommit(owner, repo, commitSha, selectedPullNumber || undefined);
  }, [loadCommit, loadPullRequest, selectedPullNumber, selectedRepoFullName]);

  // Persist state changes to localStorage
  useEffect(() => {
    console.log("[State Save] Effect triggered. isMounted:", isMounted);
    if (!isMounted) {
        console.log("[State Save] Skipping save because component is not mounted yet.");
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
      const newFileContentsMap = new Map<string, FileData>();
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

  // Handler for saving local filter settings
  const handleLocalFilterSave = useCallback((newExclusions: string, newFileTypes: string) => {
    setState(prevState => ({
      ...prevState,
      excludeFolders: newExclusions,
      fileTypes: newFileTypes,
    }));
    console.log("[Filters] Local filters saved:", { newExclusions, newFileTypes });

    // Sync to server if user is logged in
    if (githubUser) {
      fetch('/api/user/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localExclusions: newExclusions,
          localFileTypes: newFileTypes,
        }),
      }).catch(err => console.log('[Filters] Failed to sync local filters to server:', err));
    }
  }, [githubUser]);

  // Handler for saving GitHub filter settings
  const handleGitHubFilterSave = useCallback((newExclusions: string) => {
    setGithubExclusions(newExclusions);
    localStorage.setItem('githubExclusions', newExclusions);
    console.log("[Filters] GitHub filters saved:", newExclusions);

    // Sync to server if user is logged in
    if (githubUser) {
      fetch('/api/user/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubExclusions: newExclusions,
        }),
      }).catch(err => console.log('[Filters] Failed to sync GitHub filters to server:', err));
    }
  }, [githubUser]);

  // Wrapper function to handle the new token calculator signature
  const handleTokenCountChange = useCallback((count: number, details?: TokenCountDetails) => {
    setTokenCount(count);
    setTokenDetails(details || null);
  }, []);

  // Create stable GitHub repo info to avoid object recreation
  const githubRepoInfo = useMemo(() => {
    if (selectedRepoFullName && githubSourceMode === 'pull' && selectedPullRequest) {
      return {
        owner: selectedRepoFullName.split('/')[0],
        repo: selectedRepoFullName.split('/')[1],
        branch: selectedPullRequest.head.ref,
        ref: selectedPullRequest.head.sha,
        baseRef: selectedPullRequest.base.sha,
        pullNumber: selectedPullRequest.number,
        sourceMode: 'pull' as const,
      };
    }

    if (selectedRepoFullName && githubSourceMode === 'commit' && selectedCommit) {
      return {
        owner: selectedRepoFullName.split('/')[0],
        repo: selectedRepoFullName.split('/')[1],
        branch: selectedCommit.sha,
        ref: selectedCommit.sha,
        baseRef: selectedCommit.parents?.[0]?.sha,
        pullNumber: selectedPullNumber || undefined,
        commitSha: selectedCommit.sha,
        sourceMode: 'commit' as const,
      };
    }

    if (selectedRepoFullName && selectedBranchName) {
      return {
        owner: selectedRepoFullName.split('/')[0],
        repo: selectedRepoFullName.split('/')[1],
        branch: selectedBranchName,
        ref: selectedBranchName,
        sourceMode: 'branch' as const,
      };
    }
    return undefined;
  }, [githubSourceMode, selectedCommit, selectedPullNumber, selectedPullRequest, selectedRepoFullName, selectedBranchName]);

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
                const fileRef = file.status === 'removed'
                  ? file.baseRef || githubRepoInfo.baseRef || githubRepoInfo.ref || githubRepoInfo.branch
                  : file.ref || githubRepoInfo.ref || githubRepoInfo.branch;
                const contentUrl = `/api/github/content?owner=${githubRepoInfo.owner}&repo=${githubRepoInfo.repo}&path=${encodeURIComponent(file.path)}&sha=${encodeURIComponent(fileRef)}`;
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
      setSelectedOwnerLogin(projectToLoad.githubRepoFullName?.split('/')[0] || null);
      setSelectedRepoFullName(projectToLoad.githubRepoFullName || null);
      setSelectedBranchName(projectToLoad.githubBranch || null);
      setGithubSourceMode(projectToLoad.githubSourceMode || (projectToLoad.githubPullNumber ? 'pull' : projectToLoad.githubCommitSha ? 'commit' : 'branch'));
      setSelectedPullNumber(projectToLoad.githubPullNumber || null);
      setSelectedCommitSha(projectToLoad.githubCommitSha || null);
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
    setSelectedPullNumber(null);
    setSelectedPullRequest(null);
    setSelectedCommitSha(null);
    setSelectedCommit(null);
    setGithubSourceMode('branch');
    setPullRequests([]);
    setCommits([]);
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
    console.log("[State Save Effect] Running. isMounted:", isMounted);
    if (!isMounted) {
      console.log("[State Save Effect] Skipping save because component is not mounted yet.");
      return;
    }

    // Save projects (excluding analysisResult, sorted and truncated for recency)
    let projectsToSaveForStorage = projects.map(p => {
      const { analysisResult, ...stateToSave } = p.state || {}; // Handle potential undefined state
      return { ...p, state: stateToSave, lastAccessed: p.lastAccessed || 0 };
    });

    // Sort projects by lastAccessed in descending order
    projectsToSaveForStorage.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

    // Limit the number of recent projects
    if (projectsToSaveForStorage.length > MAX_RECENT_PROJECTS) {
      projectsToSaveForStorage = projectsToSaveForStorage.slice(0, MAX_RECENT_PROJECTS);
    }

    console.log(`[State Save Effect] Saving ${projectsToSaveForStorage.length} projects to localStorage (lightweight, sorted, truncated)...`);
    localStorage.setItem('codebaseReaderProjects', JSON.stringify(projectsToSaveForStorage));

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
        setSelectedPullNumber(null);
        setSelectedPullRequest(null);
        setSelectedCommitSha(null);
        setSelectedCommit(null);
        setBranches([]);
        setPullRequests([]);
        setCommits([]);
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

  const renderSourcePanel = () => (
    <SourceSidebar
      activeSourceTab={activeSourceTab}
      onSourceTabChange={handleTabChangeAttempt}
      setState={setState}
      onProjectTypeSelected={setProjectTypeSelected}
      projectTypes={projectTypes}
      onProjectTemplatesUpdate={handleProjectTemplateUpdate}
      state={state}
      setLoadingStatus={setLoadingStatus}
      loadingStatus={loadingStatus}
      updateCurrentProject={updateCurrentProject}
      onUploadComplete={handleUploadComplete}
      setError={setError}
      projectTypeSelected={projectTypeSelected}
      onOpenLocalFilters={() => setIsLocalFilterManagerOpen(true)}
      projects={projects}
      onLoadProject={handleLoadRecentProject}
      onPinProject={handlePinProject}
      onRemoveProject={handleRemoveProject}
      onRenameProject={handleRenameProject}
      githubUser={githubUser}
      githubError={githubError}
      githubOwners={githubOwners}
      selectedOwnerLogin={selectedOwnerLogin}
      onOwnerChange={handleOwnerChange}
      repos={repos}
      selectedRepoFullName={selectedRepoFullName}
      branches={branches}
      selectedBranchName={selectedBranchName}
      pullRequests={pullRequests}
      selectedPullNumber={selectedPullNumber}
      commits={commits}
      selectedCommitSha={selectedCommitSha}
      onPullRequestSelect={handlePullRequestSelect}
      onCommitSelect={handleCommitSelect}
      githubSelectionError={githubSelectionError}
      fileLoadingMessage={fileLoadingMessage}
      isGithubTreeTruncated={isGithubTreeTruncated}
      githubExclusions={githubExclusions}
      onGitHubLogin={handleGitHubLogin}
      onGitHubLogout={handleGitHubLogout}
      onRepoChange={handleRepoChange}
      onBranchChange={handleBranchChange}
      onOpenGitHubFilters={() => setIsGitHubFilterManagerOpen(true)}
      onResetWorkspace={handleResetWorkspace}
      hasAnalysisResult={Boolean(state.analysisResult)}
    />
  );

  const renderMainPanel = () => (
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
          githubExclusions={githubExclusions}
        />
      ) : (
        <EmptyAnalysisState
          activeSourceTab={activeSourceTab}
          isGithubTreeTruncated={isGithubTreeTruncated}
        />
      )}
    </div>
  );

  return (
    <div className="relative">
      <LoadingIndicator isLoading={loadingStatus.isLoading} message={loadingStatus.message} />
      <AppHeader />
      
      <div className="mx-auto w-full max-w-[1800px] px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 animate-fade-in">
        <div className="space-y-6 lg:hidden">
          {renderSourcePanel()}
          {renderMainPanel()}
        </div>

        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="codebase-reader-layout"
          className="hidden min-h-[calc(100vh-8rem)] rounded-lg lg:flex"
        >
          <ResizablePanel
            defaultSize="34%"
            minSize="340px"
            maxSize="560px"
            className="relative z-10 pr-3"
          >
            <div className="h-full min-w-0 overflow-hidden">
              {renderSourcePanel()}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-2 bg-transparent" />
          <ResizablePanel defaultSize="66%" minSize="480px" className="min-w-0 pl-3">
            <main className="min-h-full min-w-0 overflow-hidden">
              {renderMainPanel()}
            </main>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <PageDialogs
        showSwitchConfirmDialog={showSwitchConfirmDialog}
        setShowSwitchConfirmDialog={setShowSwitchConfirmDialog}
        confirmTabSwitch={confirmTabSwitch}
        cancelTabSwitch={cancelTabSwitch}
        showLoadRecentConfirmDialog={showLoadRecentConfirmDialog}
        setShowLoadRecentConfirmDialog={setShowLoadRecentConfirmDialog}
        loadConfirmationMessage={loadConfirmationMessage}
        confirmLoadRecent={confirmLoadRecent}
        cancelLoadRecent={cancelLoadRecent}
      />

      {/* Filter Manager Components */}
      <LocalFilterManager
        isOpen={isLocalFilterManagerOpen}
        onClose={() => setIsLocalFilterManagerOpen(false)}
        currentExclusions={state.excludeFolders}
        currentFileTypes={state.fileTypes}
        onSave={handleLocalFilterSave}
      />

      <GitHubFilterManager
        isOpen={isGitHubFilterManagerOpen}
        onClose={() => setIsGitHubFilterManagerOpen(false)}
        currentExclusions={githubExclusions}
        onSave={handleGitHubFilterSave}
      />

      <AnalyticsComponent />
      <SpeedInsights />
    </div>
  );
}
