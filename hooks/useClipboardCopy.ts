import { useState, useCallback } from 'react';
import { InternalTreeNode } from '../components/FileTreeNode'; // Adjust path as needed
import { FileData, DataSource, GitHubRepoInfo } from '../components/types'; // Adjust path as needed

// Re-import or pass utility functions as arguments
import {
  findNode,
  generateProjectTreeString,
  minifyCode,
  isBinaryFile
} from '../components/fileSelectorUtils'; // Adjust path as needed

// Define the API endpoint constant within the hook or pass it
const GITHUB_CONTENT_API = '/api/github/content';

interface UseClipboardCopyProps {
  fileTree: { [key: string]: InternalTreeNode } | null;
  selectedFiles: string[];
  minifyOnCopy: boolean;
  dataSource: DataSource;
  getAllFilesFromDataSource: () => FileData[];
}

interface UseClipboardCopyReturn {
  copySelectedFiles: () => Promise<void>;
  isCopying: boolean;
  copySuccess: boolean;
}

export function useClipboardCopy({
  fileTree,
  selectedFiles,
  minifyOnCopy,
  dataSource,
  getAllFilesFromDataSource,
}: UseClipboardCopyProps): UseClipboardCopyReturn {
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const copySelectedFiles = useCallback(async () => {
    // Check prerequisites directly inside the function
    if (!fileTree || selectedFiles.length === 0 || isCopying) return;
    
    setIsCopying(true);
    setCopySuccess(false);

    // Build the filtered tree string
    const filteredTreeForCopy: { [key: string]: InternalTreeNode } = {};
    selectedFiles.forEach(path => {
        const node = findNode(fileTree, path); // Use imported/passed findNode
        if (!node || node.type !== 'file') return; 
        const parts = path.split('/');
        let current = filteredTreeForCopy;
        let currentPath = '';
        parts.forEach((part, i) => {
             currentPath = currentPath ? `${currentPath}/${part}` : part;
             if (i === parts.length - 1) {
                 current[part] = node; 
             } else {
                 if (!current[part]) {
                     current[part] = { name: part, path: currentPath, type: 'directory', children: {} };
                 } else if (!current[part].children) {
                     current[part].children = {};
                 }
                 current = current[part].children as { [key: string]: InternalTreeNode };
             }
        });
    });
    const treeString = generateProjectTreeString(filteredTreeForCopy); // Use imported/passed function
    
    try {
      const allFiles = getAllFilesFromDataSource();
      const filesToCopy = allFiles.filter(f => selectedFiles.includes(f.path));
      console.log(`Preparing to copy ${filesToCopy.length} files`);
      
      const fetchPromises = [];
      const fileContentMap = new Map<string, string>();
      
      for (const file of filesToCopy) {
        if (isBinaryFile(file.path)) { // Use imported/passed function
          console.log(`Skipping binary file: ${file.path}`);
          fileContentMap.set(file.path, `// [Binary file not included: ${file.path}]`);
          continue;
        }
        
        if (file.dataSourceType === 'github' && !file.content && file.path && dataSource.type === 'github' && dataSource.repoInfo) {
          const { owner, repo, branch } = dataSource.repoInfo;
          const fetchPromise = (async () => {
            try {
              const contentUrl = `${GITHUB_CONTENT_API}?owner=${owner}&repo=${repo}&path=${encodeURIComponent(file.path)}`;
              console.log(`Fetching content: ${contentUrl}`);
              const response = await fetch(contentUrl);
              
              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch content (${response.status})`);
              }
              
              const data = await response.json();
              const content = data.content;
              
              fileContentMap.set(file.path, content);
              
              // Note: Updating the original fileTree node content from here is tricky 
              // as this hook shouldn't directly mutate the parent's state.
              // The parent component might need to handle this separately if needed.
              // const node = findNode(fileTree, file.path);
              // if (node && node.type === 'file') {
              //   node.content = content;
              //   node.lines = content.split('\n').length;
              // }
            } catch (err) {
              console.error(`Failed to fetch content for ${file.path}:`, err);
              fileContentMap.set(file.path, `// Error fetching content for ${file.path}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          })();
          fetchPromises.push(fetchPromise);
        } else {
          fileContentMap.set(file.path, file.content || '');
        }
      }
      
      if (fetchPromises.length > 0) {
        console.log(`Fetching content for ${fetchPromises.length} GitHub files...`);
        await Promise.all(fetchPromises);
        console.log('All content fetches completed');
      }
      
      let combinedContent = '';
      for (const file of filesToCopy) {
        const content = fileContentMap.get(file.path) || '';
        if (!content && !isBinaryFile(file.path)) {
          combinedContent += `// ${file.path}\n// [Empty file]\n\n`;
          continue;
        }
        
        if (isBinaryFile(file.path)) {
          combinedContent += `// ${file.path}\n// [Binary file not included]\n\n`;
          continue;
        }
        
        const processedContent = minifyOnCopy ? minifyCode(content) : content; // Use imported/passed function
        combinedContent += `// ${file.path}\n${processedContent}\n\n`;
      }
      
      const clipboardText = `Project Structure:\n${treeString}\n\n---\n\nFile Contents:\n${combinedContent}`;
      
      await navigator.clipboard.writeText(clipboardText);
      setCopySuccess(true);
      // Reset success state after a delay
      setTimeout(() => setCopySuccess(false), 2000); 
    } catch (err) {
      console.error('Could not copy text: ', err);
      setCopySuccess(false); // Ensure success is false on error
    } finally {
      setIsCopying(false);
    }
    // Dependencies for the useCallback
  }, [fileTree, selectedFiles, isCopying, minifyOnCopy, dataSource, getAllFilesFromDataSource]); 

  return { copySelectedFiles, isCopying, copySuccess };
} 