"use client";

import React, { useState } from 'react';
import { Project } from './types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ChevronDown, ChevronUp } from 'lucide-react';
import RecentProjectItem from './RecentProjectItem';

interface RecentProjectsDisplayProps {
  projects: Project[];
  onLoadProject: (projectId: string) => void;
  onPinProject: (projectId: string, isPinned: boolean) => void;
  onRemoveProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  maxInitialDisplay?: number; // Optional: Max projects to show before "Show More"
}

const MAX_RECENT_PROJECTS_VISIBLE_DEFAULT = 3;

const RecentProjectsDisplay: React.FC<RecentProjectsDisplayProps> = ({
  projects,
  onLoadProject,
  onPinProject,
  onRemoveProject,
  onRenameProject,
  maxInitialDisplay = MAX_RECENT_PROJECTS_VISIBLE_DEFAULT,
}) => {
  const [showAll, setShowAll] = useState(false);

  // Sort projects with pinned projects first, then by lastAccessed
  const sortedProjects = [...projects].sort((a, b) => {
    // Pinned projects always come first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    
    // Then, sort by last accessed time
    const timeA = a.lastAccessed || 0;
    const timeB = b.lastAccessed || 0;
    return timeB - timeA;
  });

  const projectsToDisplay = showAll ? sortedProjects : sortedProjects.slice(0, maxInitialDisplay);

  if (!projects || projects.length === 0) {
    return (
      <div className="space-y-2 mt-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center px-1">
          <History className="h-4 w-4 mr-2" />
          Recent Projects
        </h3>
        <p className="text-xs text-muted-foreground px-1">No projects yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-4">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center px-1">
        <History className="h-4 w-4 mr-2" />
        Recent Projects
      </h3>
      <ScrollArea className={`w-full ${showAll ? 'h-auto max-h-64' : `h-auto`} pr-3`}>
        <div className="space-y-2">
          {projectsToDisplay.map((proj) => (
            <RecentProjectItem
              key={proj.id}
              project={proj}
              onLoad={onLoadProject}
              onPin={onPinProject}
              onRemove={onRemoveProject}
              onRename={onRenameProject}
            />
          ))}
        </div>
      </ScrollArea>
      {sortedProjects.length > maxInitialDisplay && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs py-1 h-auto mt-1"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>
              Show Fewer <ChevronUp className="h-3.5 w-3.5 ml-1.5" />
            </>
          ) : (
            <>
              Show More ({sortedProjects.length - maxInitialDisplay} more) <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default RecentProjectsDisplay;
