import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Ban, FileType, Loader, AlertCircle, Info, RefreshCw, Upload, FileUp } from 'lucide-react';
import { AppState, FileData } from './types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Add this type declaration at the top of your file
declare module 'react' {
  interface InputHTMLAttributes<T> extends React.HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

interface FileUploadSectionProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateCurrentProject: (newState: AppState) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  onUploadComplete: (newState: AppState) => void;
  projectTypeSelected: boolean;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  state,
  setState,
  updateCurrentProject,
  setError,
  onUploadComplete,
  projectTypeSelected
}) => {
  const [progress, setProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState<{ total: number; valid: number }>({ total: 0, valid: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showInfoBox, setShowInfoBox] = useState(true);
  const [rememberPreference, setRememberPreference] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  useEffect(() => {
    const savedPreference = localStorage.getItem('showUploadInfoBox');
    if (savedPreference !== null) {
      const shouldShow = JSON.parse(savedPreference);
      setShowInfoBox(shouldShow);
    }
  }, []);

  const processFiles = useCallback(async (files: FileList) => {
    setError(null);
    setProgress(0);
    setUploadStats(prev => ({ total: files.length, valid: 0 }));
    setIsProcessing(true);
    setProcessingStatus("Initializing refresh...");

    const excludedFolders = state.excludeFolders.split(',').map(f => f.trim());
    const allowedFileTypes = state.fileTypes.split(',').map(t => t.trim());

    const newFileContentsMap = new Map<string, FileData>();
    let newTotalLines = 0;
    let processedFileCount = 0;

    setProcessingStatus("Processing files...");
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = file.webkitRelativePath || file.name;

      // Split path into components
      const pathComponents = relativePath.split('/');

      // Check 1: Skip if any path component starts with '.' (hidden files/folders)
      if (pathComponents.some(part => part.startsWith('.'))) {
        setProcessingStatus(`Skipping hidden: ${relativePath}`);
        continue;
      }

      // Check 2: Skip if any *directory* component matches an excluded folder name
      // We check components from the root up to the parent directory of the file (slice(0, -1))
      if (pathComponents.slice(0, -1).some(component => excludedFolders.includes(component))) {
        setProcessingStatus(`Skipping excluded folder component: ${relativePath}`);
        continue;
      }

      // Check 3: Skip if file type is not in the allowed list
      // Ensure type is not empty before checking endsWith
      if (!allowedFileTypes.some(type => type && relativePath.endsWith(type))) {
        setProcessingStatus(`Skipping type: ${relativePath}`);
        continue;
      }

      // If all checks pass, process the file
      setProcessingStatus(`Reading: ${relativePath}`);
      try {
        const content = await file.text();
        const lines = content.split('\n').length;

        const newFileData: FileData = {
          path: relativePath,
          lines,
          content
        };

        newFileContentsMap.set(relativePath, newFileData);
        newTotalLines += lines;
        processedFileCount++;
        setUploadStats(prev => ({ ...prev, valid: processedFileCount }));

      } catch (error) {
          console.error(`Error reading file ${relativePath}:`, error);
          setError(`Error reading file: ${relativePath}. It might be corrupted or too large.`);
          setProcessingStatus(`Error reading: ${relativePath}`);
      }

      setProgress(Math.round((i + 1) / files.length * 100));
    }

    const finalFiles: FileData[] = Array.from(newFileContentsMap.values());

    if (finalFiles.length === 0) {
      setError(`No valid files found after refresh. Processed ${files.length} files, but none matched the criteria.`);
      setIsProcessing(false);
      setProcessingStatus(null);
      return;
    }

    setProcessingStatus("Updating project tree...");
    await new Promise(resolve => setTimeout(resolve, 10));
    const newProjectTree = generateProjectTree(finalFiles);

    setProcessingStatus("Preserving selections...");
    await new Promise(resolve => setTimeout(resolve, 10));
    const preservedSelectedFiles = state.selectedFiles.filter(selectedPath =>
      newFileContentsMap.has(selectedPath)
    );

    setProcessingStatus("Finalizing state update...");
    await new Promise(resolve => setTimeout(resolve, 10));

    const newState: AppState = {
      ...state,
      analysisResult: {
        summary: {
          total_files: finalFiles.length,
          total_lines: newTotalLines
        },
        files: finalFiles,
        project_tree: newProjectTree
      },
      selectedFiles: preservedSelectedFiles,
    };

    setState(newState);
    updateCurrentProject(newState);
    onUploadComplete(newState);

    setIsProcessing(false);
    setProcessingStatus("Refresh complete.");
    setTimeout(() => setProcessingStatus(null), 2000);

  }, [state, setState, updateCurrentProject, onUploadComplete, setError]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setIsDialogOpen(false);
      processFiles(event.target.files);
    }
  };

  const handleRefreshClick = () => {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    } else {
      setError("Could not find the file input element.");
    }
  };

  const generateProjectTree = (files: FileData[]): string => {
    const tree: { [key: string]: any } = {};
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          current[part] = null;
        } else {
          current[part] = current[part] || {};
          current = current[part];
        }
      });
    });

    const stringify = (node: any, prefix = ''): string => {
      let result = '';
      for (const key in node) {
        const isDirectory = node[key] !== null;
        const icon = isDirectory ? '📁' : '📄';
        result += `${prefix}${icon} ${key}${isDirectory ? '/' : ''}\n`;
        if (isDirectory) {
          result += stringify(node[key], prefix + '  ');
        }
      }
      return result;
    };

    return stringify(tree);
  };

  const handleChooseFolder = () => {
    // If we're supposed to show the info box and it's not already open
    if (showInfoBox && !isDialogOpen) {
      setIsDialogOpen(true);
    } else {
      // Skip the dialog and go straight to file selection
      const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = '';
        fileInput.click();
      }
    }
  };

  const handleProceed = () => {
    // Remember preference if needed
    if (rememberPreference) {
      localStorage.setItem('showUploadInfoBox', 'false');
    }
    
    // Close dialog
    setIsDialogOpen(false);
    
    // Trigger file input
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  };

  return (
    <div className="space-y-3">
      <input
        id="fileInput"
        type="file"
        webkitdirectory="true"
        directory="true"
        className="hidden"
        onChange={handleFileUpload}
      />
      
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          onClick={handleChooseFolder}
          disabled={isProcessing || !projectTypeSelected}
          className="w-full"
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          Choose Project Folder
        </Button>
        
        {state.analysisResult && (
          <Button
            variant="outline"
            onClick={handleRefreshClick}
            disabled={isProcessing}
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
            Refresh Project
          </Button>
        )}
      </div>

      {(isProcessing || processingStatus) && (
        <div className="space-y-2 animate-slide-up">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              {isProcessing ? (
                <Loader className="mr-2 h-3 w-3 animate-spin text-primary" />
              ) : (
                <FileUp className="mr-2 h-3 w-3 text-primary" />
              )}
              <span className="text-xs font-medium">
                {processingStatus || "Processing files..."}
              </span>
            </div>
            {isProcessing && (
              <span className="text-xs text-muted-foreground">
                {uploadStats.valid} / {uploadStats.total} files
              </span>
            )}
          </div>
          <Progress 
            value={progress} 
            className="h-1.5"
            indicatorClassName="bg-gradient-to-r from-primary to-secondary"
          />
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>Select Project Folder</DialogTitle>
            <DialogDescription>
              This will scan your selected folder and process files according to your project configuration.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <Alert className="bg-primary-50 dark:bg-primary-900/20 border-primary-100">
              <AlertDescription className="text-sm">
                <div className="flex items-start">
                  <Info className="h-4 w-4 mr-2 text-primary mt-0.5" />
                  <div>
                    <p className="mb-1 font-medium">Important notes:</p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      <li>Only text files will be processed</li>
                      <li>File content is processed locally in your browser</li>
                      <li>Nothing is uploaded to any server</li>
                      <li>Files are filtered based on your project settings</li>
                    </ul>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="flex items-start space-x-2">
              <Checkbox
                id="remember"
                checked={rememberPreference}
                onCheckedChange={(checked) => {
                  if (checked !== "indeterminate") {
                    setRememberPreference(checked);
                  }
                }}
              />
              <Label htmlFor="remember" className="text-sm font-normal">
                Don&apos;t show this message again
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleProceed}>
              <Upload className="mr-2 h-4 w-4" />
              Select Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileUploadSection;