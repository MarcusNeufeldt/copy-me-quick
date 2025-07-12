import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileUp, RefreshCw, Loader2 } from 'lucide-react';
import { AppState, FileData, AnalysisResultData } from './types';
import { saveDirectoryHandle } from '@/lib/indexeddb'; // <-- IMPORT new helper

// Add this at the top of the file (after imports)
declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

// --- Helper to recursively get files from a directory handle ---
async function getFilesFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  path: string = '',
  includeRootName: boolean = true
): Promise<File[]> {
  const files: File[] = [];
  
  // If this is the root call (path is empty) and we should include root name,
  // use the directory handle's name as the root folder name
  const rootPrefix = path === '' && includeRootName ? dirHandle.name : '';
  
  // @ts-ignore: .values() is not yet in TypeScript's lib.dom.d.ts
  for await (const entry of (dirHandle as any).values()) {
    let newPath: string;
    
    if (path === '' && includeRootName) {
      // Root level: include the directory name
      newPath = `${rootPrefix}/${entry.name}`;
    } else if (path === '') {
      // Root level without including root name
      newPath = entry.name;
    } else {
      // Nested path
      newPath = `${path}/${entry.name}`;
    }
    
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      Object.defineProperty(file, 'webkitRelativePath', {
        value: newPath,
        writable: true,
        enumerable: true,
      });
      files.push(file);
    } else if (entry.kind === 'directory') {
      files.push(...(await getFilesFromHandle(entry, newPath, false))); // Don't include root name for recursive calls
    }
  }
  return files;
}

interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}
interface FileUploadSectionProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateCurrentProject: (newState: AppState, hasDirectoryHandle?: boolean) => void; // <-- MODIFIED PROP
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  onUploadComplete: (analysisResult: AnalysisResultData, rootHandle?: FileSystemDirectoryHandle) => void; // <-- MODIFIED PROP
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
  const [uploadStats, setUploadStats] = useState<{ total: number, valid: number }>({ total: 0, valid: 0 });

  // This is the core logic, now separate from the event handler
  const processFiles = useCallback(async (files: File[], rootHandle?: FileSystemDirectoryHandle) => {
    setError(null);
    setProgress(0);
    setUploadStats({ total: files.length, valid: 0 });
    setLoadingStatus({ isLoading: true, message: 'Initializing file processing...' });
    const excludedFolders = state.excludeFolders.split(',').map(f => f.trim()).filter(f => f);
    const allowedFileTypes = state.fileTypes.split(',').map(t => t.trim()).filter(t => t);
    console.log('Excluded folders:', excludedFolders);
    let newFileContentsMap = new Map<string, FileData>();
    let newTotalLines = 0;
    let processedFileCount = 0;
    setLoadingStatus({ isLoading: true, message: `Processing ${files.length} files...` });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // @ts-ignore
        const relativePath = file.webkitRelativePath || file.name;
        if (!relativePath) { continue; }
        const pathComponents = relativePath.split('/');
        const excludedComponent = pathComponents.slice(0, -1).find(component => excludedFolders.includes(component));
        if (excludedComponent) { 
          console.log(`Excluding file ${relativePath} due to folder: ${excludedComponent}`);
          continue; 
        }
        const fileExtension = relativePath.includes('.') ? '.' + relativePath.split('.').pop() : '';
        const fileMatchesType = allowedFileTypes.length === 0 || allowedFileTypes.includes('*') || allowedFileTypes.some(type => {
            return relativePath === type || (type.startsWith('.') && fileExtension === type);
        });
        if (!fileMatchesType) { continue; }

        try {
            const content = await file.text();
            const lines = content.split('\n').length;
            const newFileData: FileData = { path: relativePath, lines, content, size: file.size, dataSourceType: 'local' };
            newFileContentsMap.set(relativePath, newFileData);
            newTotalLines += lines;
        } catch (error) {
            console.error(`Error reading file ${relativePath}:`, error);
            setError(`Error reading file: ${relativePath}. It might be corrupted or unreadable.`);
            continue; // Skip to next file if one fails
        }
        processedFileCount++;
        setUploadStats(prev => ({...prev, valid: processedFileCount }));
        setProgress(Math.round(((i + 1) / files.length) * 100));
        if (i % 50 === 0 || i === files.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 0));
            setLoadingStatus(prev => ({...prev, message: `Processing files...(${i + 1}/${files.length})` }));
        }
      }

      const finalFiles: FileData[] = Array.from(newFileContentsMap.values());
      
      // Check if we have any valid files
      if (finalFiles.length === 0) {
        setError(`No valid files found matching the criteria. Processed ${files.length} files but none matched the filters.`);
        setLoadingStatus({ isLoading: false, message: 'No valid files found.' });
        setTimeout(() => setLoadingStatus(prev => ({ ...prev, message: null })), 4000);
        setProgress(0);
        setUploadStats({ total: files.length, valid: 0 });
        return;
      }
      
      const analysisResultData: AnalysisResultData = {
        totalFiles: finalFiles.length,
        totalLines: newTotalLines,
        totalTokens: 0,
        summary: `Project contains ${finalFiles.length.toLocaleString()} files with ${newTotalLines.toLocaleString()} total lines of code.`,
        project_tree: '', // You can generate the tree if needed
        files: finalFiles,
        uploadTimestamp: Date.now(),
      };
      
      setLoadingStatus({ isLoading: true, message: 'Finalizing...' });
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause for UI feedback
      
      onUploadComplete(analysisResultData, rootHandle); // Pass the handle along
      
      // Clear loading state and show success
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
  }, [state.excludeFolders, state.fileTypes, onUploadComplete, setError, setLoadingStatus]);

  // NEW: Handler for the "Choose Folder" button click
  const handleChooseFolder = async () => {
    try {
      if (!window.showDirectoryPicker) {
        setError("Your browser doesn't support the File System Access API. Please use Chrome or Edge.");
        return;
      }
      const dirHandle = await window.showDirectoryPicker();
      setLoadingStatus({ isLoading: true, message: 'Reading folder...' });
      const files = await getFilesFromHandle(dirHandle);
      await processFiles(files, dirHandle); // Pass handle to process
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log("User cancelled the folder picker.");
      } else {
        console.error("Error picking directory:", err);
        setError("Could not access the selected folder.");
      }
      setLoadingStatus({ isLoading: false, message: null });
    }
  };

  // Note: The "Refresh" functionality becomes more complex. For now, we'll have it
  // just re-trigger the folder picker. A true "refresh" would re-use the saved handle.
  const handleRefreshClick = () => {
    handleChooseFolder();
  };

  return (
    <div className="space-y-4"> {/* Changed from form to div */}
      {/* The Dialog and hidden input are no longer needed here */}
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
                <p>Re-select and process a folder</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {loadingStatus.isLoading && loadingStatus.message?.includes('Processing') && (
        <div className="space-y-1 pt-2">
          <Progress value={progress} className="w-full h-2" aria-label="File processing progress" />
          <p className="text-xs text-muted-foreground text-center">{loadingStatus.message} ({uploadStats.valid}/{uploadStats.total} valid files)</p>
        </div>
      )}
    </div>
  );
};

export default FileUploadSection;