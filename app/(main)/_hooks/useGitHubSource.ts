import { useState, useEffect, useCallback } from 'react';
import { GitHubRepo, GitHubBranch, GitHubTreeItem, LoadingStatus, UserContext } from '../_types';

interface UseGitHubSourceProps {
  userContext?: UserContext;
  onLoadingChange: (status: LoadingStatus) => void;
}

export function useGitHubSource({ userContext, onLoadingChange }: UseGitHubSourceProps) {
  // GitHub state - NOW OWNED BY THIS HOOK
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string | null>(null);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [githubTree, setGithubTree] = useState<GitHubTreeItem[] | null>(null);
  const [isGithubTreeTruncated, setIsGithubTreeTruncated] = useState(false);
  const [githubSelectionError, setGithubSelectionError] = useState<string | null>(null);

  // Fetch repos when user is authenticated
  useEffect(() => {
    if (!userContext?.user) {
      setRepos([]);
      return;
    }

    const fetchRepos = async () => {
      onLoadingChange({ isLoading: true, message: 'Fetching repositories...' });
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
        onLoadingChange({ isLoading: false, message: null });
      }
    };

    fetchRepos();
  }, [userContext?.user, onLoadingChange]);

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
      onLoadingChange({ isLoading: true, message: 'Fetching branches...' });
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
        onLoadingChange({ isLoading: false, message: null });
      }
    };

    fetchBranches();
  }, [repos, onLoadingChange]);

  // Handle branch selection and fetch tree
  const handleBranchChange = useCallback((branchName: string, excludeFolders: string, fileTypes: string) => {
    setGithubSelectionError(null);
    setGithubTree(null);
    setIsGithubTreeTruncated(false);

    if (!branchName || !selectedRepoFullName) {
      setSelectedBranchName(branchName);
      return null; // Return null to indicate no tree was fetched
    }

    setSelectedBranchName(branchName);

    const selectedRepo = repos.find(r => r.full_name === selectedRepoFullName);
    if (!selectedRepo) return null;

    const fetchTree = async () => {
      onLoadingChange({ isLoading: true, message: 'Loading file tree...' });
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
        const excludedFolders = excludeFolders.split(',').map(f => f.trim()).filter(Boolean);
        const allowedFileTypes = fileTypes.split(',').map(t => t.trim()).filter(Boolean);
        
        const filesMetadata = fullTreeFromAPI
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

        // Helper function to format file sizes
        function formatFileSize(bytes: number, decimals = 2): string {
          if (bytes === 0) return '0 Bytes';
          const k = 1024;
          const dm = decimals < 0 ? 0 : decimals;
          const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        }

        // Enhance tree with formatted sizes
        const enhancedTree = fullTreeFromAPI.map(item => {
          if (item.type === 'blob' && item.size !== undefined) {
            return { ...item, formattedSize: formatFileSize(item.size) };
          }
          return item;
        });

        setGithubTree(enhancedTree);
        setIsGithubTreeTruncated(treeData.truncated ?? false);

        return {
          filesMetadata,
          commitDate: treeData.commitDate
        };

      } catch (error: any) {
        console.error('Error during GitHub branch change:', error);
        setGithubSelectionError(error.message);
        setGithubTree(null);
        throw error;
      } finally {
        onLoadingChange({ isLoading: false, message: null });
      }
    };

    return fetchTree();
  }, [repos, selectedRepoFullName, onLoadingChange]);

  // Reset GitHub state
  const resetGitHubState = useCallback(() => {
    setSelectedRepoFullName(null);
    setSelectedBranchName(null);
    setBranches([]);
    setRepos([]);
    setGithubTree(null);
    setIsGithubTreeTruncated(false);
    setGithubSelectionError(null);
  }, []);

  return {
    // State
    repos,
    selectedRepoFullName,
    branches,
    selectedBranchName,
    githubTree,
    isGithubTreeTruncated,
    githubSelectionError,
    
    // Actions
    handleRepoChange,
    handleBranchChange,
    resetGitHubState,
    
    // Setters for external control
    setSelectedRepoFullName,
    setSelectedBranchName,
  };
}