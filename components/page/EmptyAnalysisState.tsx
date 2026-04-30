"use client";

import { Card } from '@/components/ui/card';
import { LayoutGrid } from 'lucide-react';

interface EmptyAnalysisStateProps {
  activeSourceTab: 'local' | 'github';
  isGithubTreeTruncated: boolean;
}

export function EmptyAnalysisState({ activeSourceTab, isGithubTreeTruncated }: EmptyAnalysisStateProps) {
  return (
    <Card className="glass-card flex flex-col items-center justify-center p-8 sm:p-12 text-center min-h-[400px]">
      <LayoutGrid className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl sm:text-2xl font-heading font-semibold mb-2">Start Analyzing</h2>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md mx-auto">
        {activeSourceTab === 'local'
          ? 'Select a project configuration or upload local files to begin below.'
          : 'Connect your GitHub account, then choose a repository and branch.'}
      </p>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
        {activeSourceTab === 'local'
          ? 'Your files are processed directly in your browser for privacy.'
          : 'Only committed files from the selected branch will be read.'}
        {isGithubTreeTruncated && ' (Large repos might be truncated)'}
      </p>
    </Card>
  );
}
