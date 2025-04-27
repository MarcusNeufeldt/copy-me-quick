import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Ban, FileType, Loader, AlertCircle, Info, RefreshCw, Upload, FileUp, Loader2 } from 'lucide-react';
import { AppState, FileData, AnalysisResultData } from './types';
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

// Unified Loading State Type (already defined in page.tsx, but needed here for prop type)
interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

interface FileUploadSectionProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateCurrentProject: (newState: AppState) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  onUploadComplete: (analysisResult: AnalysisResultData) => void;
  projectTypeSelected: boolean;
  buttonTooltip?: string;
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  state,
  setState,
  updateCurrentProject,
  setError,
  onUploadComplete,
  projectTypeSelected,
  buttonTooltip,
  setLoadingStatus,
  loadingStatus
}) => {
  const [progress, setProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState<{ total: number; valid: number }>({ total: 0, valid: 0 });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showInfoBox, setShowInfoBox] = useState(true);
  const [rememberPreference, setRememberPreference] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const savedPreference = localStorage.getItem('showUploadInfoBox');
    if (savedPreference !== null) {
      const shouldShow = JSON.parse(savedPreference);
      setShowInfoBox(shouldShow);
    }
  }, []);

  const processFiles = useCallback(async (files: FileList) => {
    console.log('processFiles using filters:', state.fileTypes);
    setError(null);
    setProgress(0);
    setUploadStats({ total: files.length, valid: 0 });
    setLoadingStatus({ isLoading: true, message: 'Initializing file processing...' });

    const excludedFolders = state.excludeFolders.split(',').map(f => f.trim()).filter(f => f); // Filter empty strings
    const allowedFileTypes = state.fileTypes.split(',').map(t => t.trim()).filter(t => t); // Filter empty strings
    console.log('Using latest file type filters:', allowedFileTypes);
    console.log('Using latest exclude folder filters:', excludedFolders);

    let newFileContentsMap = new Map<string, FileData>();
    let newTotalLines = 0;
    let processedFileCount = 0;

    setLoadingStatus({ isLoading: true, message: `Processing ${files.length} files...` });

    try { // Wrap the loop in try/catch for better error handling of the whole process
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath || file.name;
        if (!relativePath) {
           console.warn("Skipping file with no path:", file);
           continue; // Skip if no path can be determined
        }
        const pathComponents = relativePath.split('/');

        if (pathComponents.slice(0, -1).some(component => excludedFolders.includes(component))) {
          continue;
        }
        
        const fileExtension = relativePath.includes('.') ? '.' + relativePath.split('.').pop() : '';
        const fileMatchesType = allowedFileTypes.length === 0 || allowedFileTypes.includes('*') ||
            allowedFileTypes.some(type => {
                return relativePath === type || (type.startsWith('.') && fileExtension === type);
            });
        if (!fileMatchesType) {
            continue;
        }

        try {
          const content = await file.text();
          const lines = content.split('\n').length;
          const newFileData: FileData = { path: relativePath, lines, content, size: file.size, dataSourceType: 'local' };
          newFileContentsMap.set(relativePath, newFileData);
          newTotalLines += lines;
          processedFileCount++;
          setUploadStats(prev => ({ ...prev, valid: processedFileCount }));
        } catch (error) {
           console.error(`Error reading file ${relativePath}:`, error);
           setError(`Error reading file: ${relativePath}. It might be corrupted or unreadable.`);
           continue; // Skip to next file if one fails
        }

        setProgress(Math.round(((i + 1) / files.length) * 100));
        if (i % 50 === 0 || i === files.length - 1) {
             await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI updates
             setLoadingStatus(prev => ({ ...prev, message: `Processing files... (${i + 1}/${files.length})` }));
        }
      }

      const finalFiles: FileData[] = Array.from(newFileContentsMap.values());

      if (finalFiles.length === 0 && files.length > 0) {
        setError(`No valid files found matching the criteria after processing ${files.length} potential files. Check filters in Project Configuration.`);
        setLoadingStatus({ isLoading: false, message: 'Processing failed: No valid files found.' });
        setTimeout(() => setLoadingStatus(prev => ({ ...prev, message: null })), 4000);
        setProgress(0);
        setUploadStats({ total: files.length, valid: 0 });
        return;
      } else if (finalFiles.length === 0) {
        setError("No files were selected or found for processing.");
        setProgress(0);
        setUploadStats({ total: 0, valid: 0 });
        setLoadingStatus({ isLoading: false, message: null });
         setTimeout(() => setError(null), 4000);
        return;
      }

      setLoadingStatus({ isLoading: true, message: 'Generating project summary...' });
      await new Promise(resolve => setTimeout(resolve, 10));

      const newProjectTree = generateProjectTree(finalFiles);
      const currentTimestamp = Date.now();

      const analysisResultData: AnalysisResultData = {
        totalFiles: finalFiles.length,
        totalLines: newTotalLines,
        totalTokens: 0,
        summary: `Project contains ${finalFiles.length.toLocaleString()} files with ${newTotalLines.toLocaleString()} total lines of code.`,
        project_tree: newProjectTree,
        files: finalFiles,
        uploadTimestamp: currentTimestamp
      };

      setLoadingStatus({ isLoading: true, message: 'Finalizing...' });
      await new Promise(resolve => setTimeout(resolve, 10));

      onUploadComplete(analysisResultData);

      setLoadingStatus({ isLoading: false, message: 'Processing complete!' });
      setTimeout(() => setLoadingStatus(prev => ({ ...prev, message: null })), 2000);

    } catch (error) {
        console.error("Error during file processing:", error);
        setError(`An unexpected error occurred during file processing: ${error instanceof Error ? error.message : String(error)}`);
        setLoadingStatus({ isLoading: false, message: 'Processing failed.' });
        setTimeout(() => setLoadingStatus(prev => ({ ...prev, message: null })), 3000);
        setProgress(0);
        setUploadStats(prev => ({ ...prev, valid: 0 }));
    }

  }, [
      state.excludeFolders,
      state.fileTypes,
      onUploadComplete,
      setError,
      setLoadingStatus,
    ]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileUpload triggered:', event.target.files);
    if (event.target.files && event.target.files.length > 0) {
      setIsDialogOpen(false);
      processFiles(event.target.files);
    }
  };

  const handleRefreshClick = () => {
    if (formRef.current) {
      formRef.current.reset();
    }
    
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    if (fileInput) {
      fileInput.click();
    } else {
      setError("Could not find the file input element.");
    }
  };

  const generateProjectTree = (files: FileData[]): string => {
    const tree: { [key: string]: any } = {};
    files.forEach(file => {
      const parts = file.path.includes('/') ? file.path.split('/') : [file.path];
      let current = tree;
      parts.forEach((part, i) => {
        if (!part) return;
        if (i === parts.length - 1) {
          if (current[part] === undefined) {
            current[part] = null;
          }
        } else {
          if (current[part] === null) {
              console.warn(`Conflict: File and directory have the same name: ${part} in ${file.path}`);
              return;
          }
          current[part] = current[part] || {};
          current = current[part];
        }
      });
    });

    const stringify = (node: any, prefix = ''): string => {
        let result = '';
        const sortedKeys = Object.keys(node).sort((a, b) => {
            const aIsDir = node[a] !== null;
            const bIsDir = node[b] !== null;
            if (aIsDir !== bIsDir) {
                return aIsDir ? -1 : 1;
            }
            return a.localeCompare(b);
        });

        sortedKeys.forEach((key, index) => {
            const isDirectory = node[key] !== null;
            const isLast = index === sortedKeys.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const icon = isDirectory ? '📁' : '📄';

            result += `${prefix}${connector}${icon} ${key}\n`;
            if (isDirectory) {
                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                result += stringify(node[key], newPrefix);
            }
        });
        return result;
    };

    return stringify(tree);
  };

  const handleChooseFolder = () => {
    if (showInfoBox && !isDialogOpen) {
      setIsDialogOpen(true);
    } else {
      const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = '';
        fileInput.click();
      }
    }
  };

  const handleProceed = () => {
    if (rememberPreference) {
      localStorage.setItem('showUploadInfoBox', 'false');
    }
    
    setIsDialogOpen(false);
    
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  };

  return (
    <form ref={formRef} className="space-y-4">
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

      <Input
        id="fileInput"
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        aria-hidden="true"
      />

      <div className="flex gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={handleChooseFolder}
                disabled={!projectTypeSelected || loadingStatus.isLoading}
                className="flex-1"
              >
                 {loadingStatus.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                 {loadingStatus.isLoading ? 'Processing...' : 'Choose Folder'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{buttonTooltip || "Select your project's root folder."}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {state.analysisResult && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleRefreshClick}
                  disabled={!projectTypeSelected || loadingStatus.isLoading}
                  aria-label="Refresh files"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Re-select and process files from the same folder</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {loadingStatus.isLoading && loadingStatus.message?.includes('Processing') && (
        <div className="space-y-1 pt-2">
           <Progress value={progress} className="w-full h-2" aria-label="File processing progress" />
           <p className="text-xs text-muted-foreground text-center">
                {loadingStatus.message} ({uploadStats.valid}/{uploadStats.total} valid files)
            </p>
        </div>
       )}
    </form>
  );
};

export default FileUploadSection;