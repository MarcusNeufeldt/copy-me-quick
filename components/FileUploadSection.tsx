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
        totalFiles: finalFiles.length,
        totalLines: newTotalLines,
        totalTokens: 0, // Will be calculated later
        summary: `Project contains ${finalFiles.length} files with ${newTotalLines} total lines of code.`,
        project_tree: newProjectTree,
        files: finalFiles
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
        webkitdirectory=""
        directory=""
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
      
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs sm:text-sm flex items-center justify-center"
          onClick={handleChooseFolder}
          disabled={isProcessing || !projectTypeSelected}
        >
          <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
          Choose Folder
        </Button>
        
        {state.analysisResult && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs sm:text-sm flex items-center justify-center"
            onClick={handleRefreshClick}
            disabled={isProcessing}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        )}
      </div>
      
      {isProcessing && (
        <div className="space-y-2 animate-pulse">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>
              {processingStatus || `Processing files... (${uploadStats.valid}/${uploadStats.total})`}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}
      
      {(state.excludeFolders || state.fileTypes) && (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-3 text-xs">
          <div className="flex-1">
            <div className="flex items-center">
              <Label htmlFor="excludeFolders" className="mr-1 text-muted-foreground">Exclude:</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      A comma-separated list of folder names to exclude.
                      These are applied globally (any path component match will be excluded).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="excludeFolders"
              value={state.excludeFolders}
              onChange={(e) => 
                setState(prev => ({ ...prev, excludeFolders: e.target.value }))
              }
              className="h-7 text-xs"
              placeholder="e.g., node_modules,.git,dist"
            />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center">
              <Label htmlFor="fileTypes" className="mr-1 text-muted-foreground">Include:</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      A comma-separated list of file extensions to include.
                      Files must end with one of these extensions.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="fileTypes"
              value={state.fileTypes}
              onChange={(e) => 
                setState(prev => ({ ...prev, fileTypes: e.target.value }))
              }
              className="h-7 text-xs"
              placeholder="e.g., .js,.jsx,.ts,.tsx"
            />
          </div>
        </div>
      )}
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Information</DialogTitle>
            <DialogDescription>
              This tool works best with smaller codebases or selected portions of larger ones.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2 text-sm">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm ml-2">
                All files are processed locally in your browser. No data is sent to any server.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <h4 className="font-medium">Tips for best results:</h4>
              <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                <li>Choose project-specific folders rather than your entire filesystem</li>
                <li>Exclude large binary files, assets, and dependencies using the filters</li>
                <li>Consider excluding generated files like build outputs</li>
                <li>For large projects, select only the most relevant directories</li>
              </ul>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember-pref" 
                checked={!rememberPreference} 
                onCheckedChange={(checked) => {
                  const newVal = checked !== true;
                  setRememberPreference(newVal);
                  localStorage.setItem('showUploadInfoBox', JSON.stringify(!newVal));
                }}
              />
              <label
                htmlFor="remember-pref"
                className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Show this information before uploads
              </label>
            </div>
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleProceed}
              size="sm"
              className="w-full sm:w-auto"
            >
              Choose Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileUploadSection;