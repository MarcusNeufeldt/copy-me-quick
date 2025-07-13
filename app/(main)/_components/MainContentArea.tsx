'use client';

import { LayoutGrid } from 'lucide-react';
import { Card } from "@/components/ui/card";
import AnalysisResult from '@/components/AnalysisResult';
import { useAppContext } from '../_context/AppContext';

const MAX_TOKENS = 1048576;

export function MainContentArea() {
  const { 
    state,
    activeSourceTab,
    tokenCount,
    tokenDetails,
    githubTree,
    githubRepoInfo,
    loadingStatus,
    currentProjectId,
    actions: { handleTokenCountChange, handleSelectedFilesChange }
  } = useAppContext();

  if (state.analysisResult) {
    return (
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
        setLoadingStatus={() => {}} // Already handled by context
        loadingStatus={loadingStatus}
        currentProjectId={currentProjectId}
      />
    );
  }

  return (
    <Card className="glass-card flex flex-col items-center justify-center p-8 sm:p-12 text-center min-h-[400px]">
      <LayoutGrid className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl sm:text-2xl font-heading font-semibold mb-2">Start Analyzing</h2>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md mx-auto">
        {activeSourceTab === 'local'
          ? 'Select a project configuration or upload local files to begin.'
          : 'Choose a repository and branch to analyze.'}
      </p>
    </Card>
  );
}