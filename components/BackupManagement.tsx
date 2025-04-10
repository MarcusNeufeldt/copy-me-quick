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

  const restoreBackup = async (backupId: string) => {
    const selectedBackup = state.backups.find(b => b.id === backupId);
    if (!selectedBackup || !state.analysisResult) return;

    const zip = new JSZip();

    Object.entries(selectedBackup.fileContents).forEach(([path, content]) => {
      zip.file(path, content);
    });

    try {
      const zipContent = await zip.generateAsync({ type: 'blob' });
      saveAs(zipContent, `restored_backup_${selectedBackup.id}.zip`);
      alert('Backup has been prepared for download. Please extract the zip file and replace your original files with these restored versions.');
    } catch (error) {
      console.error('Error creating zip file:', error);
      alert('An error occurred while preparing the backup for download.');
    }

    const restoredFiles = state.analysisResult.files.map(file => {
      if (selectedBackup.fileContents[file.path]) {
        return {
          ...file,
          content: selectedBackup.fileContents[file.path],
          lines: selectedBackup.fileContents[file.path].split('\n').length
        };
      }
      return file;
    });

    const newState = {
      ...state,
      analysisResult: {
        ...state.analysisResult,
        files: restoredFiles
      },
      selectedFiles: selectedBackup.selectedFiles,
    };

    setState(newState);
    updateCurrentProject(newState);
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

  const handleRestoreBackup = () => {
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
        </SheetContent>
      </Sheet>
      
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              {selectedBackup?.description || 'Backup Details'}
            </DialogTitle>
            <DialogDescription>
              Created on {selectedBackup ? formatDate(selectedBackup.timestamp.toString()) : 'unknown date'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium">Selected Files</span>
              <Badge variant="outline" className="px-1.5 py-0 text-xs">
                {selectedBackup?.selectedFiles.length || 0} files
              </Badge>
            </div>
            
            <ScrollArea className="h-40 w-full border rounded-md p-2">
              <ul className="text-xs space-y-1">
                {selectedBackup?.selectedFiles.map((file, index) => (
                  <li key={index} className="truncate">
                    {file}
                  </li>
                ))}
              </ul>
            </ScrollArea>
            
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-medium">Token Count</span>
              <Badge 
                variant="secondary" 
                className="px-1.5 py-0.5 text-xs font-medium"
              >
                {(selectedBackup?.fileContents ? Object.keys(selectedBackup.fileContents).length : 0).toLocaleString()}
              </Badge>
            </div>
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowDialog(false)}
              className="w-full sm:w-auto text-xs"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRestoreBackup}
              size="sm"
              className="w-full sm:w-auto text-xs"
            >
              Restore Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BackupManagement;