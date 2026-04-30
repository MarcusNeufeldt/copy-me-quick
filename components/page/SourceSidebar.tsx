"use client";

import React from 'react';
import Image from 'next/image';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import FileUploadSection from '@/components/FileUploadSection';
import ProjectSelector from '@/components/ProjectSelector';
import RecentProjectsDisplay from '@/components/RecentProjectsDisplay';
import {
  AnalysisResultData,
  AppState,
  GitHubBranch,
  GitHubOwner,
  GitHubPullRequest,
  GitHubRepo,
  GitHubUser,
  Project,
  ProjectTemplate,
} from '@/components/types';
import {
  BookMarked,
  CheckCircle,
  Computer,
  Filter,
  GitBranch,
  GitBranchPlus,
  GitPullRequest,
  Github,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';

interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

interface SourceSidebarProps {
  activeSourceTab: 'local' | 'github';
  onSourceTabChange: (value: 'local' | 'github') => void;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onProjectTypeSelected: (selected: boolean) => void;
  projectTypes: ProjectTemplate[];
  onProjectTemplatesUpdate: (updatedTemplates: ProjectTemplate[]) => void;
  state: AppState;
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus;
  updateCurrentProject: (newState: AppState, hasDirectoryHandle?: boolean) => void;
  onUploadComplete: (analysisResult: AnalysisResultData, rootHandle?: FileSystemDirectoryHandle) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  projectTypeSelected: boolean;
  onOpenLocalFilters: () => void;
  projects: Project[];
  onLoadProject: (projectId: string) => void;
  onPinProject: (projectId: string, isPinned: boolean) => void;
  onRemoveProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  githubUser: GitHubUser | null;
  githubError: string | null;
  githubOwners: GitHubOwner[];
  selectedOwnerLogin: string | null;
  onOwnerChange: (ownerLogin: string) => void;
  repos: GitHubRepo[];
  selectedRepoFullName: string | null;
  branches: GitHubBranch[];
  selectedBranchName: string | null;
  pullRequests: GitHubPullRequest[];
  selectedPullNumber: number | null;
  pullRequestInput: string;
  onPullRequestInputChange: (value: string) => void;
  onPullRequestInputSubmit: () => void;
  onPullRequestSelect: (pullNumber: number) => void;
  githubSelectionError: string | null;
  fileLoadingMessage: string | null;
  isGithubTreeTruncated: boolean;
  githubExclusions: string;
  onGitHubLogin: () => void;
  onGitHubLogout: () => void | Promise<void>;
  onRepoChange: (repoFullName: string) => void | Promise<void>;
  onBranchChange: (branchName: string) => void | Promise<void>;
  onOpenGitHubFilters: () => void;
  onResetWorkspace: () => void;
  hasAnalysisResult: boolean;
}

export function SourceSidebar({
  activeSourceTab,
  onSourceTabChange,
  setState,
  onProjectTypeSelected,
  projectTypes,
  onProjectTemplatesUpdate,
  state,
  setLoadingStatus,
  loadingStatus,
  updateCurrentProject,
  onUploadComplete,
  setError,
  projectTypeSelected,
  onOpenLocalFilters,
  projects,
  onLoadProject,
  onPinProject,
  onRemoveProject,
  onRenameProject,
  githubUser,
  githubError,
  githubOwners,
  selectedOwnerLogin,
  onOwnerChange,
  repos,
  selectedRepoFullName,
  branches,
  selectedBranchName,
  pullRequests,
  selectedPullNumber,
  pullRequestInput,
  onPullRequestInputChange,
  onPullRequestInputSubmit,
  onPullRequestSelect,
  githubSelectionError,
  fileLoadingMessage,
  isGithubTreeTruncated,
  githubExclusions,
  onGitHubLogin,
  onGitHubLogout,
  onRepoChange,
  onBranchChange,
  onOpenGitHubFilters,
  onResetWorkspace,
  hasAnalysisResult,
}: SourceSidebarProps) {
  return (
    <aside className="flex flex-col gap-4">
      <Card className="glass-card animate-slide-up sticky top-[calc(theme(spacing.16)+1rem)]">
        <CardContent className="p-4 sm:p-5 space-y-4 sm:space-y-5">
          <div className="flex items-center gap-2 mb-2 sm:mb-4">
            <GitBranchPlus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <h2 className="font-heading font-semibold text-sm sm:text-base">Project Configuration</h2>
          </div>

          <Tabs value={activeSourceTab} onValueChange={(value) => onSourceTabChange(value as 'local' | 'github')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="local" className="text-xs px-2 py-1.5">
                <Computer className="h-4 w-4 mr-1.5" /> Local
              </TabsTrigger>
              <TabsTrigger value="github" className="text-xs px-2 py-1.5">
                <Github className="h-4 w-4 mr-1.5" /> GitHub
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="mt-0 space-y-4">
              <ProjectSelector
                setState={setState}
                onProjectTypeSelected={onProjectTypeSelected}
                projectTypes={projectTypes}
                onProjectTemplatesUpdate={onProjectTemplatesUpdate}
              />
              <FileUploadSection
                state={state}
                setState={setState}
                setLoadingStatus={setLoadingStatus}
                loadingStatus={loadingStatus}
                updateCurrentProject={updateCurrentProject}
                onUploadComplete={onUploadComplete}
                setError={setError}
                projectTypeSelected={projectTypeSelected}
                buttonTooltip="Reads current files from your disk, including uncommitted changes."
              />

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={onOpenLocalFilters}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                Customize Filters
              </Button>

              <Alert variant="default" className="mt-2 bg-primary/5 border-primary/20">
                <ShieldCheck className="h-4 w-4 text-primary/80" />
                <AlertDescription className="text-primary/90 text-xs">
                  <strong>Privacy Assured:</strong> Your local files are processed <i>only</i> in your browser and are <strong>never</strong> uploaded to any server.
                </AlertDescription>
              </Alert>

              <RecentProjectsDisplay
                projects={projects}
                onLoadProject={onLoadProject}
                onPinProject={onPinProject}
                onRemoveProject={onRemoveProject}
                onRenameProject={onRenameProject}
              />
            </TabsContent>

            <TabsContent value="github" className="mt-0 space-y-3">
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
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onGitHubLogout} title="Disconnect GitHub">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="github-owner-select" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Github className="h-3 w-3" /> Account / Org
                    </label>
                    <Select
                      value={selectedOwnerLogin || ''}
                      onValueChange={onOwnerChange}
                      disabled={loadingStatus.isLoading || githubOwners.length === 0}
                    >
                      <SelectTrigger id="github-owner-select" className="text-xs sm:text-sm">
                        <SelectValue placeholder="Select account or org..." />
                      </SelectTrigger>
                      <SelectContent>
                        {githubOwners.map((owner) => (
                          <SelectItem key={owner.login} value={owner.login} className="text-xs sm:text-sm">
                            {owner.login} {owner.type === 'Organization' ? '(org)' : '(you)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="github-repo-select" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <BookMarked className="h-3 w-3" /> Repository
                    </label>
                    <Select
                      value={selectedRepoFullName || ''}
                      onValueChange={onRepoChange}
                      disabled={loadingStatus.isLoading || repos.length === 0}
                    >
                      <SelectTrigger id="github-repo-select" className="text-xs sm:text-sm">
                        <SelectValue placeholder={loadingStatus.isLoading && loadingStatus.message?.includes('repositories') ? 'Loading...' : 'Select repository...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingStatus.isLoading && loadingStatus.message?.includes('repositories') && (
                          <div className="flex items-center justify-center p-4 text-muted-foreground text-xs">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...
                          </div>
                        )}
                        {repos.map((repo) => (
                          <SelectItem key={repo.id} value={repo.full_name} className="text-xs sm:text-sm">
                            {repo.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
                                onClick={() => selectedBranchName && onBranchChange(selectedBranchName)}
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
                          {branches.map((branch) => (
                            <Button
                              key={branch.name}
                              size="sm"
                              variant={selectedBranchName === branch.name ? 'default' : 'ghost'}
                              className="w-full justify-start text-xs mb-1 h-8"
                              onClick={() => onBranchChange(branch.name)}
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

                  {selectedRepoFullName && (
                    <div className="space-y-2">
                      <label htmlFor="github-pr-input" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <GitPullRequest className="h-3 w-3" /> Pull Request
                      </label>
                      <div className="flex gap-2">
                        <Input
                          id="github-pr-input"
                          value={pullRequestInput}
                          onChange={(event) => onPullRequestInputChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              onPullRequestInputSubmit();
                            }
                          }}
                          placeholder="PR # or GitHub PR URL"
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={onPullRequestInputSubmit}
                          disabled={loadingStatus.isLoading || !pullRequestInput.trim()}
                        >
                          Load
                        </Button>
                      </div>
                      {pullRequests.length > 0 && (
                        <Select
                          value={selectedPullNumber ? String(selectedPullNumber) : ''}
                          onValueChange={(value) => onPullRequestSelect(Number(value))}
                          disabled={loadingStatus.isLoading}
                        >
                          <SelectTrigger className="text-xs sm:text-sm">
                            <SelectValue placeholder="Select open pull request..." />
                          </SelectTrigger>
                          <SelectContent>
                            {pullRequests.map((pull) => (
                              <SelectItem key={pull.number} value={String(pull.number)} className="text-xs sm:text-sm">
                                #{pull.number} {pull.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {githubSelectionError && (
                    <Alert variant="destructive" className="text-xs mt-2"><AlertDescription>{githubSelectionError}</AlertDescription></Alert>
                  )}

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

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs mt-2"
                    onClick={onOpenGitHubFilters}
                  >
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    Filter Files ({githubExclusions.split(',').filter(Boolean).length} active)
                  </Button>
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
                          onClick={onGitHubLogin}
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

          <Button
            variant="outline"
            onClick={onResetWorkspace}
            className="w-full transition-all hover:bg-destructive hover:text-destructive-foreground border-destructive/50 text-destructive/90"
            disabled={!hasAnalysisResult}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear Current Session
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}
