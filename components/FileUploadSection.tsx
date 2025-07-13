import React, { useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileUp, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

// Helper to recursively get files from a directory handle
async function getFilesFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  path: string = '',
  includeRootName: boolean = true,
  excludeFolders: string[] = [],
  allowedFileTypes: string[] = []
): Promise<File[]> {
  const files: File[] = [];
  const rootPrefix = path === '' && includeRootName ? dirHandle.name : '';
  
  try {
    // @ts-ignore: .values() is not yet in TypeScript's lib.dom.d.ts
    for await (const entry of (dirHandle as any).values()) {
      try {
        let newPath: string;
        
        if (path === '' && includeRootName) {
          newPath = `${rootPrefix}/${entry.name}`;
        } else if (path === '') {
          newPath = entry.name;
        } else {
          newPath = `${path}/${entry.name}`;
        }
        
        if (entry.kind === 'file') {
          // Check if file type is allowed before reading
          const fileExtension = entry.name.includes('.') ? '.' + entry.name.split('.').pop() : '';
          const fileMatchesType = allowedFileTypes.length === 0 || 
            allowedFileTypes.includes('*') || 
            allowedFileTypes.some(type => 
              entry.name === type || 
              (type.startsWith('.') && fileExtension === type) ||
              entry.name.endsWith(type)
            );
          
          if (fileMatchesType) {
            try {
              const file = await entry.getFile();
              Object.defineProperty(file, 'webkitRelativePath', {
                value: newPath,
                writable: true,
                enumerable: true,
              });
              files.push(file);
            } catch (fileErr) {
              console.warn(`Could not read file ${newPath}:`, fileErr);
              // Skip this file and continue
            }
          }
        } else if (entry.kind === 'directory') {
          // Check if directory is excluded before traversing
          const isExcluded = excludeFolders.some(excludeFolder => 
            entry.name === excludeFolder || 
            entry.name.includes(excludeFolder)
          );
          
          if (!isExcluded) {
            try {
              const subFiles = await getFilesFromHandle(entry, newPath, false, excludeFolders, allowedFileTypes);
              files.push(...subFiles);
            } catch (dirErr) {
              console.warn(`Could not read directory ${newPath}:`, dirErr);
              // Skip this directory and continue
            }
          } else {
            console.log(`Skipping excluded directory: ${newPath}`);
          }
        }
      } catch (entryErr) {
        console.warn(`Could not process entry:`, entryErr);
        // Skip this entry and continue
      }
    }
  } catch (iterationErr) {
    console.error(`Could not iterate through directory ${path}:`, iterationErr);
    throw new Error(`Failed to read directory contents: ${iterationErr instanceof Error ? iterationErr.message : String(iterationErr)}`);
  }
  
  return files;
}

interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

interface FileUploadSectionProps {
  onUploadComplete: (files: File[], rootHandle?: FileSystemDirectoryHandle) => void;
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus;
  excludeFolders: string[];
  allowedFileTypes: string[];
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  onUploadComplete,
  setLoadingStatus,
  loadingStatus,
  excludeFolders,
  allowedFileTypes
}) => {
  const handleChooseFolder = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      alert("Your browser doesn't support the File System Access API. Please use a modern browser like Chrome or Edge.");
      return;
    }

    try {
      setLoadingStatus({ isLoading: true, message: 'Awaiting folder selection...' });
      const dirHandle = await window.showDirectoryPicker();
      console.log('Directory handle obtained:', dirHandle.name);
      
      setLoadingStatus({ isLoading: true, message: 'Reading folder contents...' });
      
      const files = await getFilesFromHandle(dirHandle, '', true, excludeFolders, allowedFileTypes);
      console.log(`Successfully read ${files.length} files from directory`);
      
      if (files.length === 0) {
        alert("The selected folder appears to be empty or contains no accessible files.");
        setLoadingStatus({ isLoading: false, message: null });
        return;
      }
      
      onUploadComplete(files, dirHandle);
    } catch (err: any) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log("User cancelled the folder picker.");
      } else {
        console.error("Error picking directory:", err);
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        
        let errorMessage = "Could not access the selected folder.";
        if (err.message && err.message.includes('Failed to read directory contents')) {
          errorMessage = "Some files or folders in the selected directory could not be accessed. This might be due to permission issues or corrupted files.";
        } else if (err.name === 'NotFoundError') {
          errorMessage = "The selected folder could not be found or is no longer accessible.";
        }
        
        alert(errorMessage + "\n\nCheck the browser console for more details.");
      }
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [onUploadComplete, setLoadingStatus, excludeFolders, allowedFileTypes]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={handleChooseFolder}
                disabled={loadingStatus.isLoading}
                className="flex-1"
              >
                {loadingStatus.isLoading && loadingStatus.message?.includes('folder') ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="mr-2 h-4 w-4" />
                )}
                {loadingStatus.isLoading ? loadingStatus.message : 'Choose Folder'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Select your project&apos;s root folder to begin analysis.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default FileUploadSection;