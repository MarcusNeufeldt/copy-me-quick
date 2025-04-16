import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Save, Download, Upload, Trash2, Archive, Clock, ArrowUpRight } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AppState, Backup } from './types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BackupManagementProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateCurrentProject: (newState: AppState) => void;
}

const BackupManagement: React.FC<BackupManagementProps> = ({
  state,
  setState,
  updateCurrentProject
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);

  const createBackup = () => {
    if (!state.analysisResult) return;

    const description = prompt("Enter a description for this backup:", "Backup " + new Date().toLocaleString());
    if (description === null) return;

    const backup: Backup = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      description,
      selectedFiles: state.selectedFiles,
      fileContents: {}
    };

    state.selectedFiles.forEach(filePath => {
      const file = state.analysisResult!.files.find(f => f.path === filePath);
      if (file) {
        backup.fileContents[filePath] = file.content;
      }
    });

    const newState = {
      ...state,
      backups: [...state.backups, backup],
    };

    setState(newState);
    updateCurrentProject(newState);

    alert('Backup created successfully!');
  };

  const deleteBackup = (backupId: string) => {
    const newState = {
      ...state,
      backups: state.backups.filter(b => b.id !== backupId),
    };

    setState(newState);
    updateCurrentProject(newState);

    alert('Backup deleted successfully!');
  };

  const exportState = () => {
    const dataStr = JSON.stringify(state);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'codebase_reader_state.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importState = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files.length > 0) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = e => {
        if (e.target && typeof e.target.result === 'string') {
          const importedState = JSON.parse(e.target.result) as AppState;
          setState(importedState);
          updateCurrentProject(importedState);
          alert('State imported successfully!');
        }
      };
    }
  };

  const handleOpenDialog = (backup: Backup) => {
    setSelectedBackup(backup);
    setShowDialog(true);
  };

  const handleLoadSelection = () => {
    if (selectedBackup) {
      const updatedState = {
        ...state,
        selectedFiles: selectedBackup.selectedFiles,
      };

      setState(updatedState);
      updateCurrentProject(updatedState);
      setShowDialog(false);
    }
  };

  const handleDeleteBackup = (id: string) => {
    if (confirm('Are you sure you want to delete this backup?')) {
      const updatedBackups = state.backups.filter(backup => backup.id !== id);
      const updatedState = {
        ...state,
        backups: updatedBackups,
      };
      
      setState(updatedState);
      updateCurrentProject(updatedState);
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <Sheet>
        <SheetTrigger asChild>
          <Button className="w-full">
            <Save className="mr-2 h-4 w-4" /> Manage Backups
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Backup Management</SheetTitle>
            <SheetDescription>
              Create, restore, or delete backups of your project state.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <Button onClick={createBackup} disabled={!state.analysisResult} className="w-full">
              Create New Backup
            </Button>
            <Separator />
            <div className="space-y-4">
              {(Array.isArray(state.backups) ? state.backups : []).map(backup => (
                <div key={backup.id} className="flex flex-col space-y-2 p-4 border rounded-lg">
                  <div className="font-semibold">{backup.description}</div>
                  <div className="text-sm text-gray-500">{new Date(backup.timestamp).toLocaleString()}</div>
                  <div className="flex justify-between items-center mt-2">
                    <Button onClick={() => handleOpenDialog(backup)} size="sm" variant="outline">
                      Restore
                    </Button>
                    <Button onClick={() => handleDeleteBackup(backup.id)} size="sm" variant="destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Separator className="my-4" />
          <div className="space-y-4">
            <Button onClick={exportState} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Export State
            </Button>
            <Button onClick={() => document.getElementById('importInput')?.click()} className="w-full">
              <Upload className="mr-2 h-4 w-4" /> Import State
            </Button>
            <input
              id="importInput"
              type="file"
              accept=".json"
              onChange={importState}
              className="hidden"
            />
          </div>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="submit">Close</Button>
            </SheetClose>
          </SheetFooter>
          <div className="mt-4">
            {selectedBackup && (
              <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Restore</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to load the selection state from this backup? This will replace your current file selection.
                      <br />
                      <span className="text-xs text-muted-foreground">
                        Backup: {selectedBackup.description} ({formatDate(new Date(selectedBackup.timestamp).toISOString())})
                      </span>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={handleLoadSelection}>Load Selection</Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Replace the current file selection list with the one saved in this backup.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default BackupManagement;