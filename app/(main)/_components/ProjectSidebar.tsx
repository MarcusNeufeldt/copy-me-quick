'use client';

import { GitBranchPlus, RotateCcw, Computer, Github } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppContext } from '../_context/AppContext';
import { LocalSourcePanel } from './LocalSourcePanel';
import { GitHubSourcePanel } from './GitHubSourcePanel';

export function ProjectSidebar() {
  const { 
    ui,
    workspace,
    actions: { handleTabChangeAttempt, handleResetWorkspace }
  } = useAppContext();

  return (
    <aside className="flex flex-col gap-4">
      <Card className="glass-card animate-slide-up sticky top-[calc(theme(spacing.16)+1rem)]">
        <CardContent className="p-4 sm:p-5 space-y-4 sm:space-y-5">
          <div className="flex items-center gap-2 mb-2 sm:mb-4">
            <GitBranchPlus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <h2 className="font-heading font-semibold text-sm sm:text-base">Project Configuration</h2>
          </div>

          {/* Source Selection Tabs */}
          <Tabs value={ui.activeSourceTab} onValueChange={(value) => handleTabChangeAttempt(value as 'local' | 'github')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="local" className="text-xs px-2 py-1.5">
                <Computer className="h-4 w-4 mr-1.5" /> Local
              </TabsTrigger>
              <TabsTrigger value="github" className="text-xs px-2 py-1.5">
                <Github className="h-4 w-4 mr-1.5" /> GitHub
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="mt-0 space-y-4">
              <LocalSourcePanel />
            </TabsContent>

            <TabsContent value="github" className="mt-0 space-y-3">
              <GitHubSourcePanel />
            </TabsContent>
          </Tabs>

          <Button
            variant="outline"
            onClick={handleResetWorkspace}
            className="w-full transition-all hover:bg-destructive hover:text-destructive-foreground border-destructive/50 text-destructive/90"
            disabled={!workspace.analysisResult}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear Current Session
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}