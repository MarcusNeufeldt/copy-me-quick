import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Project } from '@/components/types';
import { Computer, Github, Pin, MoreHorizontal, Edit3, Trash2, PinOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RecentProjectItemProps {
  project: Project;
  onLoad: (projectId: string) => void;
  onPin: (projectId: string, isPinned: boolean) => void;
  onRemove: (projectId: string) => void;
  onRename: (projectId: string, newName: string) => void;
}

export default function RecentProjectItem({ 
  project, 
  onLoad, 
  onPin, 
  onRemove, 
  onRename 
}: RecentProjectItemProps) {
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(project.name);

  const handleRename = () => {
    if (newName.trim() && newName.trim() !== project.name) {
      onRename(project.id, newName.trim());
    }
    setShowRenameDialog(false);
  };

  const getProjectIcon = () => {
    if (project.isPinned) {
      return <Pin className="h-4 w-4 text-amber-500" />;
    }
    return project.sourceType === 'github' 
      ? <Github className="h-4 w-4 text-muted-foreground" />
      : <Computer className="h-4 w-4 text-muted-foreground" />;
  };

  const getProjectMetadata = () => {
    if (project.sourceType === 'github') {
      const owner = project.githubRepoFullName?.split('/')[0] || 'Unknown owner';
      const branch = project.githubBranch || 'main';
      return `${owner}/${branch}`;
    } else {
      return 'Local folder';
    }
  };

  const getDisplayName = () => {
    if (project.sourceType === 'github') {
      return project.githubRepoFullName?.split('/')[1] || project.name;
    }
    return project.name;
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group">
        <button
          onClick={() => onLoad(project.id)}
          className="flex-1 flex items-start gap-3 text-left min-w-0"
        >
          {getProjectIcon()}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {getDisplayName()}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {getProjectMetadata()}
            </div>
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              setNewName(project.name);
              setShowRenameDialog(true);
            }}>
              <Edit3 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPin(project.id, !project.isPinned)}>
              {project.isPinned ? (
                <>
                  <PinOff className="h-4 w-4 mr-2" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 mr-2" />
                  Pin to top
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onRemove(project.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new name for this project. This is just for display purposes.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRename();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}