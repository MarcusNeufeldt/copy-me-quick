'use client';

import { Github, BookMarked, GitBranch, CheckCircle, XCircle, RefreshCw, Filter } from 'lucide-react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import RecentProjectsDisplay from '@/components/RecentProjectsDisplay';
import { useAppContext } from '../_context/AppContext';

export function GitHubSourcePanel() {
  const { 
    userContext,
    repos,
    selectedRepoFullName,
    branches,
    selectedBranchName,
    githubSelectionError,
    isGithubTreeTruncated,
    loadingStatus,
    projects,
    actions: { 
      handleRepoChange, 
      handleBranchChange, 
      handleGitHubLogout,
      handleLoadProject, 
      handlePinProject, 
      handleRemoveProject, 
      handleRenameProject,
      setIsFilterSheetOpen
    }
  } = useAppContext();

  if (!userContext?.user) {
    return <div>Loading...</div>;
  }

  return (
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
      
      <RecentProjectsDisplay 
        projects={projects.filter(p => p.sourceType === 'github')} 
        onLoadProject={handleLoadProject}
        onPinProject={handlePinProject}
        onRemoveProject={handleRemoveProject}
        onRenameProject={handleRenameProject}
      />
    </div>
  );
}