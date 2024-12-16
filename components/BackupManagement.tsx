import React from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Save, Download, Upload, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AppState, Backup } from './types';

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
              {state.backups.map(backup => (
                <div key={backup.id} className="flex flex-col space-y-2 p-4 border rounded-lg">
                  <div className="font-semibold">{backup.description}</div>
                  <div className="text-sm text-gray-500">{new Date(backup.timestamp).toLocaleString()}</div>
                  <div className="flex justify-between items-center mt-2">
                    <Button onClick={() => restoreBackup(backup.id)} size="sm" variant="outline">
                      Restore
                    </Button>
                    <Button onClick={() => deleteBackup(backup.id)} size="sm" variant="destructive">
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
    </div>
  );
};

export default BackupManagement;