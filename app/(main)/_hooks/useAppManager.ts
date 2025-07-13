import { useState, useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { 
  AppState, 
  LoadingStatus, 
  GitHubRepoInfo, 
  UserContext, 
  AnalysisResultData,
  AppContextType 
} from '../_types';
import { useGitHubSource } from './useGitHubSource';
import { useLocalSource } from './useLocalSource';
import { useProjectManager } from './useProjectManager';
import { TokenCountDetails } from '@/hooks/useTokenCalculator';

// SWR fetcher
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
});

// Default initial state
const initialAppState: AppState = {
  analysisResult: null,
  selectedFiles: [],
  excludeFolders: 'node_modules,.git,dist,.next,package-lock.json,yarn.lock,pnpm-lock.yaml',
  fileTypes: '.js,.jsx,.ts,.tsx,.py',
};

export function useAppManager(): AppContextType {
  // Core state
  const [state, setState] = useState<AppState>(initialAppState);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [activeSourceTab, setActiveSourceTab] = useState<'local' | 'github'>('local');
  const [isMounted, setIsMounted] = useState(false);
  const [isInitialSetupComplete, setIsInitialSetupComplete] = useState(false);

  // UI state
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({ isLoading: false, message: null });
  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenDetails, setTokenDetails] = useState<TokenCountDetails | null>(null);

  // Filter sheet state
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isLocalFilterSheetOpen, setIsLocalFilterSheetOpen] = useState(false);

  // Dialog state
  const [showSwitchConfirmDialog, setShowSwitchConfirmDialog] = useState(false);
  const [nextTabValue, setNextTabValue] = useState<'local' | 'github' | null>(null);
  const [showLoadRecentConfirmDialog, setShowLoadRecentConfirmDialog] = useState(false);
  const [projectToLoadId, setProjectToLoadId] = useState<string | null>(null);
  const [loadConfirmationMessage, setLoadConfirmationMessage] = useState<string>('');

  // User context with SWR
  const { data: userContext, error: userContextError, mutate } = useSWR<UserContext>('/api/user/context', fetcher);

  // Domain hooks - now truly self-contained
  const gitHubSource = useGitHubSource({ userContext, onLoadingChange: setLoadingStatus });
  const localSource = useLocalSource({ onLoadingChange: setLoadingStatus });
  const projectManager = useProjectManager({ userContext, mutate, onLoadingChange: setLoadingStatus });

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Create stable GitHub repo info
  const githubRepoInfo = useMemo(() => {
    if (gitHubSource.selectedRepoFullName && gitHubSource.selectedBranchName) {
      return {
        owner: gitHubSource.selectedRepoFullName.split('/')[0],
        repo: gitHubSource.selectedRepoFullName.split('/')[1],
        branch: gitHubSource.selectedBranchName
      };
    }
    return undefined;
  }, [gitHubSource.selectedRepoFullName, gitHubSource.selectedBranchName]);

  // Populate state when user context arrives (only once)
  useEffect(() => {
    if (userContext && !isInitialSetupComplete) {
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
      
      // If we have a saved current project, load it (only on initial load)
      const savedProjectId = localStorage.getItem('currentProjectId');
      if (savedProjectId) {
        const project = userContext.projects.find(p => p.id === savedProjectId);
        if (project) {
          setCurrentProjectId(savedProjectId);
          setActiveSourceTab(project.source_type);
          
          if (project.source_type === 'github') {
            gitHubSource.setSelectedRepoFullName(project.github_repo_full_name || null);
            gitHubSource.setSelectedBranchName(project.github_branch || null);
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
      
      setIsInitialSetupComplete(true);
    }
  }, [userContext, isInitialSetupComplete, activeSourceTab, gitHubSource]);

  // Handle activeSourceTab changes separately (only after initial setup is complete)
  useEffect(() => {
    if (userContext && activeSourceTab && isInitialSetupComplete) {
      // Load appropriate filters for the current tab
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
    }
  }, [activeSourceTab, userContext?.user.global_github_exclude_folders, userContext?.user.local_exclude_folders, userContext?.user.local_file_types, isInitialSetupComplete]);

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
        if (gitHubSource.selectedBranchName) {
          setTimeout(() => {
            gitHubSource.handleBranchChange(gitHubSource.selectedBranchName!, newExclusions, state.fileTypes);
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
  }, [activeSourceTab, gitHubSource, state.fileTypes, mutate]);

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

  // Handle file upload completion (orchestrator responsibility)
  const handleUploadComplete = useCallback(async (
    files: File[],
    rootHandle?: FileSystemDirectoryHandle
  ) => {
    const result = await localSource.handleDirectorySelection(files, rootHandle, state.excludeFolders, state.fileTypes);
    
    if (!result) return;

    const { analysisResult, projectId, projectName } = result;

    setState(prevState => ({
      ...prevState,
      analysisResult,
      selectedFiles: [],
    }));
    
    setCurrentProjectId(projectId);
    localStorage.setItem('currentProjectId', projectId);
    
    try {
      await projectManager.createProject({
        id: projectId,
        name: projectName,
        sourceType: 'local',
        localExcludeFolders: state.excludeFolders,
        localFileTypes: state.fileTypes,
      });
    } catch (error) {
      // Error already handled in createProject
    }
  }, [state.excludeFolders, state.fileTypes, localSource, projectManager]);

  // Handle GitHub login/logout
  const handleGitHubLogin = () => {
    window.location.href = '/api/auth/github/login';
  };

  const handleGitHubLogout = async () => {
    setLoadingStatus({ isLoading: true, message: 'Logging out from GitHub...' });
    try {
      const response = await fetch('/api/auth/github/logout', { method: 'POST' });
      if (response.ok) {
        gitHubSource.resetGitHubState();
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
    gitHubSource.resetGitHubState();
  }, [gitHubSource]);

  // Handle branch selection with project creation (orchestrator responsibility)
  const handleBranchChange = useCallback(async (branchName: string) => {
    const result = await gitHubSource.handleBranchChange(branchName, state.excludeFolders, state.fileTypes);
    
    if (!result || !gitHubSource.selectedRepoFullName) return;

    const { filesMetadata, commitDate } = result;

    // Create analysis result
    const analysisResultData: AnalysisResultData = {
      totalFiles: filesMetadata.length,
      totalLines: 0,
      totalTokens: 0,
      summary: `GitHub repo: ${gitHubSource.selectedRepoFullName}, Branch: ${branchName}`,
      project_tree: `GitHub Tree Structure for ${gitHubSource.selectedRepoFullName}/${branchName}`,
      files: filesMetadata,
      commitDate
    };

    // Find or create project
    const targetProjectId = await projectManager.findOrCreateGitHubProject(
      gitHubSource.selectedRepoFullName,
      branchName
    );

    // Update state
    setState(prevState => ({
      ...prevState,
      analysisResult: analysisResultData,
      selectedFiles: [],
    }));
    
    setCurrentProjectId(targetProjectId);
    localStorage.setItem('currentProjectId', targetProjectId);
  }, [gitHubSource, state.excludeFolders, state.fileTypes, projectManager]);

  // Load project by ID
  const loadProjectById = useCallback(async (projectId: string) => {
    const project = projectManager.getProjectById(projectId);
    if (!project) return;

    try {
      setLoadingStatus({ isLoading: true, message: `Loading ${project.name}...` });
      
      await projectManager.updateProjectAccess(projectId);

      // Set current project
      setCurrentProjectId(projectId);
      localStorage.setItem('currentProjectId', projectId);
      setActiveSourceTab(project.sourceType);

      if (project.sourceType === 'github') {
        // Load GitHub project
        gitHubSource.setSelectedRepoFullName(project.githubRepoFullName || null);
        gitHubSource.setSelectedBranchName(project.githubBranch || null);
        setState(prevState => ({
          ...prevState,
          excludeFolders: userContext?.user.global_github_exclude_folders || '',
          selectedFiles: [],
          analysisResult: null,
        }));
        
        // Trigger branch loading if we have branch info
        if (project.githubBranch) {
          setTimeout(() => handleBranchChange(project.githubBranch!), 100);
        }
      } else {
        // Load local project
        setState(prevState => ({
          ...prevState,
          excludeFolders: project.localExcludeFolders || userContext?.user.local_exclude_folders || '',
          fileTypes: project.localFileTypes || userContext?.user.local_file_types || '',
          selectedFiles: [],
          analysisResult: null,
        }));
        
        // Try to reload the local project from stored handle
        const analysisResult = await localSource.handleReloadLocalProject(project);
        if (analysisResult) {
          setState(prevState => ({
            ...prevState,
            analysisResult,
          }));
        }
      }

      toast.success(`Project "${project.name}" loaded.`);

    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [projectManager, userContext, gitHubSource, localSource, handleBranchChange]);

  // Handle load project with confirmation
  const handleLoadProject = useCallback(async (projectId: string) => {
    const project = projectManager.getProjectById(projectId);
    if (!project) {
      toast.error("Project not found.");
      return;
    }

    // Check if there's current work that would be lost
    const hasCurrentWork = !!state.analysisResult && state.analysisResult.files.length > 0;
    
    if (hasCurrentWork) {
      // Show confirmation dialog
      setProjectToLoadId(projectId);
      setLoadConfirmationMessage(`Loading "${project.name}" will replace your current session. Continue?`);
      setShowLoadRecentConfirmDialog(true);
      return;
    }

    // Proceed with loading
    await loadProjectById(projectId);
  }, [projectManager, state.analysisResult, loadProjectById]);

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
    gitHubSource.resetGitHubState();
    
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

  // Handle confirmation dialogs
  const confirmLoadRecent = useCallback(async () => {
    if (projectToLoadId) {
      await loadProjectById(projectToLoadId);
    }
    setShowLoadRecentConfirmDialog(false);
    setProjectToLoadId(null);
  }, [projectToLoadId, loadProjectById]);

  const cancelLoadRecent = useCallback(() => {
    setShowLoadRecentConfirmDialog(false);
    setProjectToLoadId(null);
  }, []);

  // Handle token count changes
  const handleTokenCountChange = useCallback((count: number, details?: TokenCountDetails) => {
    setTokenCount(count);
    setTokenDetails(details || null);
  }, []);

  // Handle selected files changes
  const handleSelectedFilesChange = useCallback((filesOrUpdater: string[] | ((prev: string[]) => string[])) => {
    setState(prev => ({
      ...prev,
      selectedFiles: typeof filesOrUpdater === 'function' ? filesOrUpdater(prev.selectedFiles) : filesOrUpdater
    }));
  }, []);


  return {
    // Core app state
    isMounted,
    userContext,
    userContextError,
    
    // UI state namespace
    ui: {
      activeSourceTab,
      loadingStatus,
      error,
      isFilterSheetOpen,
      isLocalFilterSheetOpen,
      showSwitchConfirmDialog,
      showLoadRecentConfirmDialog,
      nextTabValue,
      projectToLoadId,
      loadConfirmationMessage,
    },

    // Workspace/session namespace
    workspace: {
      analysisResult: state.analysisResult,
      selectedFiles: state.selectedFiles,
      excludeFolders: state.excludeFolders,
      fileTypes: state.fileTypes,
      currentProjectId,
      tokenCount,
      tokenDetails,
      githubRepoInfo,
    },

    // Domain-specific modules with their complete state and actions
    github: {
      repos: gitHubSource.repos,
      selectedRepoFullName: gitHubSource.selectedRepoFullName,
      branches: gitHubSource.branches,
      selectedBranchName: gitHubSource.selectedBranchName,
      githubTree: gitHubSource.githubTree,
      isGithubTreeTruncated: gitHubSource.isGithubTreeTruncated,
      githubSelectionError: gitHubSource.githubSelectionError,
      handleRepoChange: gitHubSource.handleRepoChange,
      handleBranchChange: gitHubSource.handleBranchChange,
      resetGitHubState: gitHubSource.resetGitHubState,
      setSelectedRepoFullName: gitHubSource.setSelectedRepoFullName,
      setSelectedBranchName: gitHubSource.setSelectedBranchName,
    },

    local: {
      handleDirectorySelection: localSource.handleDirectorySelection,
      handleReloadLocalProject: localSource.handleReloadLocalProject,
      processFiles: localSource.processFiles,
    },

    projects: {
      items: projectManager.projects,
      createProject: projectManager.createProject,
      updateProjectAccess: projectManager.updateProjectAccess,
      handlePinProject: projectManager.handlePinProject,
      handleRemoveProject: projectManager.handleRemoveProject,
      handleRenameProject: projectManager.handleRenameProject,
      findOrCreateGitHubProject: projectManager.findOrCreateGitHubProject,
      getProjectById: projectManager.getProjectById,
    },

    // Top-level actions (orchestrator responsibilities)
    actions: {
      // Auth actions
      handleGitHubLogin,
      handleGitHubLogout,
      
      // Workspace actions
      handleResetWorkspace,
      handleTabChangeAttempt,
      handleUploadComplete,
      handleLoadProject,
      handleBranchChange, // Orchestrator-level branch change
      
      // Filter actions
      handleSaveFilters,
      handleSaveLocalFilters,
      
      // File selection and token actions
      handleSelectedFilesChange,
      handleTokenCountChange,
      
      // Dialog actions
      confirmTabSwitch,
      cancelTabSwitch,
      confirmLoadRecent,
      cancelLoadRecent,
      
      // UI actions
      setIsFilterSheetOpen,
      setIsLocalFilterSheetOpen,
    },
  };
}