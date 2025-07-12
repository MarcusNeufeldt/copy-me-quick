"use client";

import React, { useState } from 'react';
import { Project } from './types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Computer, Github, History, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RecentProjectsDisplayProps {
  projects: Project[];
  onLoadProject: (projectId: string) => void;
  maxInitialDisplay?: number; // Optional: Max projects to show before "Show More"
}

const MAX_RECENT_PROJECTS_VISIBLE_DEFAULT = 5;

const RecentProjectsDisplay: React.FC<RecentProjectsDisplayProps> = ({
  projects,
  onLoadProject,
  maxInitialDisplay = MAX_RECENT_PROJECTS_VISIBLE_DEFAULT,
}) => {
  const [showAll, setShowAll] = useState(false);

  // Sort projects by lastAccessed in descending order.
  // Projects without lastAccessed or with 0 are considered oldest.
  const sortedProjects = [...projects].sort((a, b) => {
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
      <ScrollArea className={`w-full ${showAll ? 'h-auto max-h-64' : `h-auto max-h-[calc(${maxInitialDisplay}*2.75rem)]`} pr-3`}> {/* Adjust height based on items */}
        {projectsToDisplay.map((proj) => (
          <Button
            key={proj.id}
            variant="ghost"
            className="w-full justify-start text-xs h-auto py-1.5 px-2 mb-1 flex flex-col items-start hover:bg-muted/50"
            onClick={() => onLoadProject(proj.id)}
            title={`Load ${proj.name}\nLast accessed: ${proj.lastAccessed ? formatDistanceToNow(new Date(proj.lastAccessed), { addSuffix: true }) : 'Unknown'}`}
          >
            <div className="flex items-center w-full">
              {proj.sourceType === 'local' ? (
                <Computer className="h-3.5 w-3.5 mr-1.5 shrink-0 text-blue-500" />
              ) : (
                <Github className="h-3.5 w-3.5 mr-1.5 shrink-0 text-purple-500" />
              )}
              <span className="truncate font-medium flex-grow">{proj.name}</span>
            </div>
            {proj.lastAccessed && proj.lastAccessed > 0 && (
              <span className="text-xs text-muted-foreground/90 ml-[calc(0.375rem+0.875rem+0.375rem)] pl-px opacity-90"> {/* Approx icon width + margin + tiny bit more */}
                {formatDistanceToNow(new Date(proj.lastAccessed), { addSuffix: true })}
              </span>
            )}
          </Button>
        ))}
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
