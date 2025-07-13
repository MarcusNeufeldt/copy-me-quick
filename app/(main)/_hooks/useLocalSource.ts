import { useCallback } from 'react';
import { saveDirectoryHandle, getDirectoryHandle } from '@/lib/indexeddb';
import { toast } from 'sonner';
import { Project, FileData, AnalysisResultData, LoadingStatus } from '../_types';

interface UseLocalSourceProps {
  setLoadingStatus: (status: LoadingStatus) => void;
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

export function useLocalSource({ setLoadingStatus }: UseLocalSourceProps) {
  
  // Centralized file processing logic (files are now pre-filtered)
  const processFiles = useCallback(async (
    files: File[], 
    excludeFoldersList: string[], 
    allowedFileTypesList: string[]
  ): Promise<AnalysisResultData> => {
    let newFileContentsMap = new Map<string, FileData>();
    let newTotalLines = 0;
    setLoadingStatus({ isLoading: true, message: `Processing ${files.length} files...` });

    // Files are now pre-filtered during directory traversal, so we just need to read content
    for (const file of files) {
      const relativePath = file.webkitRelativePath || file.name;
      if (!relativePath) continue;

      try {
        const content = await file.text();
        const lines = content.split('\n').length;
        newFileContentsMap.set(relativePath, {
          path: relativePath,
          lines,
          content,
          size: file.size,
          dataSourceType: 'local'
        });
        newTotalLines += lines;
      } catch (error) {
        console.error(`Error reading file ${relativePath}:`, error);
      }
    }

    const finalFiles: FileData[] = Array.from(newFileContentsMap.values());
    setLoadingStatus({ isLoading: false, message: null });
    return {
      totalFiles: finalFiles.length,
      totalLines: newTotalLines,
      totalTokens: 0,
      summary: `Analyzed ${finalFiles.length} local files.`,
      project_tree: '',
      files: finalFiles,
      uploadTimestamp: Date.now(),
    };
  }, [setLoadingStatus]);

  // Logic to reload a local project from IndexedDB
  const handleReloadLocalProject = useCallback(async (project: Project): Promise<AnalysisResultData | null> => {
    setLoadingStatus({ isLoading: true, message: `Re-opening ${project.name}...` });
    try {
      const handle = await getDirectoryHandle(project.id);
      if (!handle) {
        console.log(`No stored handle found for project: ${project.name}`);
        toast.info(`Please re-select the folder for '${project.name}'.`);
        setLoadingStatus({ isLoading: false, message: null });
        return null;
      }
      
      // Test if the handle is still valid by trying to get permission
      let permissionState;
      try {
        if ('queryPermission' in handle) {
          permissionState = await (handle as any).queryPermission({ mode: 'read' });
        }
      } catch (err) {
        console.log("Permission query failed, handle may be stale");
      }
      
      // If permission is denied or we can't query, request it
      if (permissionState !== 'granted') {
        try {
          if ('requestPermission' in handle) {
            permissionState = await (handle as any).requestPermission({ mode: 'read' });
            if (permissionState !== 'granted') {
              throw new Error('Permission denied');
            }
          }
        } catch (err) {
          throw new Error('Permission denied or handle is stale');
        }
      }
      
      // Try to read files from the handle
      const excludeFolders = (project.localExcludeFolders || '').split(',').map(f => f.trim()).filter(Boolean);
      const fileTypes = (project.localFileTypes || '').split(',').map(t => t.trim()).filter(Boolean);
      const files = await getFilesFromHandle(handle, '', true, excludeFolders, fileTypes);
      const analysisResult = await processFiles(files, [], []);
      
      toast.success(`Reopened '${project.name}' successfully!`);
      return analysisResult;
      
    } catch (err: any) {
      console.error("Failed to auto-reload local project:", err);
      
      // Provide specific error messages based on the error type
      if (err.name === 'NotFoundError' || err.message.includes('not found')) {
        toast.error(`The folder for '${project.name}' is no longer accessible. Please re-select it.`);
      } else if (err.message.includes('Permission denied') || err.message.includes('stale')) {
        toast.error(`Access to '${project.name}' folder was denied. Please re-select it.`);
      } else {
        toast.error(`Could not open '${project.name}'. Please re-select the folder.`);
      }
      
      // Clear the stale handle from IndexedDB
      try {
        const { removeDirectoryHandle } = await import('@/lib/indexeddb');
        await removeDirectoryHandle(project.id);
      } catch (cleanupErr) {
        console.error('Failed to clean up stale handle:', cleanupErr);
      }
      
      return null;
    } finally {
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [setLoadingStatus, processFiles]);

  // Handle file upload completion (files are now pre-filtered)
  const handleDirectorySelection = useCallback(async (
    files: File[],
    rootHandle?: FileSystemDirectoryHandle,
    excludeFolders?: string,
    fileTypes?: string
  ): Promise<{ analysisResult: AnalysisResultData; projectId: string; projectName: string } | null> => {
    const analysisResult = await processFiles(files, [], []); // No additional filtering needed
    
    if (analysisResult.files.length === 0) {
      toast.error("No matching files found based on the current filters.");
      return null;
    }
    
    const newProjectId = Date.now().toString();
    const projectName = rootHandle ? rootHandle.name : `Local Project ${new Date().toLocaleDateString()}`;
    
    // Save directory handle if available
    if (rootHandle) {
      await saveDirectoryHandle(newProjectId, rootHandle);
    }
    
    return {
      analysisResult,
      projectId: newProjectId,
      projectName
    };
  }, [processFiles]);

  return {
    // Actions
    handleDirectorySelection,
    handleReloadLocalProject,
    processFiles,
  };
}