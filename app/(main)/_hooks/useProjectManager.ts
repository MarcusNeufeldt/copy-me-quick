import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Project, LoadingStatus, UserContext } from '../_types';

interface UseProjectManagerProps {
  userContext?: UserContext;
  mutate: () => Promise<any>;
  onLoadingChange: (status: LoadingStatus) => void;
}

export function useProjectManager({ userContext, mutate, onLoadingChange }: UseProjectManagerProps) {
  
  // Convert database projects to frontend Project format
  const projects = useMemo(() => {
    if (!userContext) return [];
    
    return userContext.projects.map(dbProject => ({
      id: dbProject.id,
      name: dbProject.name,
      sourceType: dbProject.source_type,
      githubRepoFullName: dbProject.github_repo_full_name,
      githubBranch: dbProject.github_branch,
      localExcludeFolders: dbProject.local_exclude_folders,
      localFileTypes: dbProject.local_file_types,
      lastAccessed: dbProject.last_accessed * 1000, // Convert to milliseconds
      isPinned: dbProject.is_pinned === 1,
      hasDirectoryHandle: false, // We'll check this separately if needed
    })) as Project[];
  }, [userContext]);

  // Create a new project
  const createProject = useCallback(async (projectData: {
    id: string;
    name: string;
    sourceType: 'local' | 'github';
    githubRepoFullName?: string;
    githubBranch?: string;
    localExcludeFolders?: string;
    localFileTypes?: string;
  }) => {
    onLoadingChange({ isLoading: true, message: 'Creating project...' });
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create project');
      }
      
      await mutate();
      toast.success('Project created successfully!');
      return projectData.id;
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
      throw error;
    } finally {
      onLoadingChange({ isLoading: false, message: null });
    }
  }, [mutate, onLoadingChange]);

  // Update project's last accessed time
  const updateProjectAccess = useCallback(async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_accessed: Math.floor(Date.now() / 1000) }),
      });
      await mutate();
    } catch (error) {
      console.error('Error updating project access:', error);
      // Don't show error toast for this as it's not critical
    }
  }, [mutate]);

  // Pin/unpin a project
  const handlePinProject = useCallback(async (projectId: string, isPinned: boolean) => {
    onLoadingChange({ isLoading: true, message: 'Updating project...' });
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: isPinned }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update project');
      }
      
      await mutate();
      toast.success(isPinned ? 'Project pinned!' : 'Project unpinned.');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    } finally {
      onLoadingChange({ isLoading: false, message: null });
    }
  }, [mutate, onLoadingChange]);

  // Remove a project
  const handleRemoveProject = useCallback(async (projectId: string) => {
    onLoadingChange({ isLoading: true, message: 'Removing project...' });
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove project');
      }
      
      await mutate();
      toast.success('Project removed.');
      return true;
    } catch (error) {
      console.error('Error removing project:', error);
      toast.error('Failed to remove project');
      return false;
    } finally {
      onLoadingChange({ isLoading: false, message: null });
    }
  }, [mutate, onLoadingChange]);

  // Rename a project
  const handleRenameProject = useCallback(async (projectId: string, newName: string) => {
    onLoadingChange({ isLoading: true, message: 'Renaming project...' });
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to rename project');
      }
      
      await mutate();
      toast.success('Project renamed!');
    } catch (error) {
      console.error('Error renaming project:', error);
      toast.error('Failed to rename project');
    } finally {
      onLoadingChange({ isLoading: false, message: null });
    }
  }, [mutate, onLoadingChange]);

  // Find or create GitHub project
  const findOrCreateGitHubProject = useCallback(async (
    selectedRepoFullName: string,
    branchName: string
  ) => {
    let targetProjectId: string;
    const existingProject = projects.find(
      p => p.sourceType === 'github' && 
           p.githubRepoFullName === selectedRepoFullName && 
           p.githubBranch === branchName
    );

    if (existingProject) {
      targetProjectId = existingProject.id;
      // Update last accessed
      await updateProjectAccess(targetProjectId);
    } else {
      // Create new project
      targetProjectId = Date.now().toString();
      await createProject({
        id: targetProjectId,
        name: `${selectedRepoFullName} / ${branchName}`,
        sourceType: 'github',
        githubRepoFullName: selectedRepoFullName,
        githubBranch: branchName,
      });
    }

    return targetProjectId;
  }, [projects, updateProjectAccess, createProject]);

  // Get project by ID
  const getProjectById = useCallback((projectId: string): Project | undefined => {
    return projects.find(p => p.id === projectId);
  }, [projects]);

  return {
    // State
    projects,
    
    // Actions
    createProject,
    updateProjectAccess,
    handlePinProject,
    handleRemoveProject,
    handleRenameProject,
    findOrCreateGitHubProject,
    getProjectById,
  };
}