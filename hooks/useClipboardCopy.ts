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

export type CopyMode = 'full' | 'diff' | 'diff-full';

// Import LoadingStatus type (define if needed)
interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

interface UseClipboardCopyProps {
  fileTree: { [key: string]: InternalTreeNode } | null;
  selectedFiles: string[];
  minifyOnCopy: boolean;
  dataSource: DataSource;
  getAllFilesFromDataSource: () => FileData[];
  // Add unified loading state props
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus;
}

interface UseClipboardCopyReturn {
  copySelectedFiles: (mode?: CopyMode) => Promise<void>;
  // Remove isCopying as it's now handled globally
  // isCopying: boolean;
  copySuccess: boolean;
}

export function useClipboardCopy({
  fileTree,
  selectedFiles,
  minifyOnCopy,
  dataSource,
  getAllFilesFromDataSource,
  setLoadingStatus, // Destructure props
  loadingStatus
}: UseClipboardCopyProps): UseClipboardCopyReturn {
  // Remove local isCopying state
  // const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const copySelectedFiles = useCallback(async (mode: CopyMode = 'full') => {
    // Check prerequisites including global loading state
    if (!fileTree || selectedFiles.length === 0 || loadingStatus.isLoading) return;

    // Set global loading state
    setLoadingStatus({ isLoading: true, message: 'Copying files...' });
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
      let githubFetchNeeded = false;
      const shouldFetchFullContent = mode === 'full' || mode === 'diff-full';
      
      for (const file of filesToCopy) {
        if (isBinaryFile(file.path)) { // Use imported/passed function
          console.log(`Skipping binary file: ${file.path}`);
          fileContentMap.set(file.path, `// [Binary file not included: ${file.path}]`);
          continue;
        }
        
        if (shouldFetchFullContent && file.dataSourceType === 'github' && !file.content && file.path && dataSource.type === 'github' && dataSource.repoInfo) {
          githubFetchNeeded = true; // Mark that fetching is needed
          const { owner, repo } = dataSource.repoInfo;
          const fetchPromise = (async () => {
            try {
              const fileRef = file.status === 'removed'
                ? file.baseRef || dataSource.repoInfo?.baseRef || dataSource.repoInfo?.ref || dataSource.repoInfo?.branch
                : file.ref || dataSource.repoInfo?.ref || dataSource.repoInfo?.branch;
              const refParam = fileRef ? `&sha=${encodeURIComponent(fileRef)}` : '';
              const contentUrl = `${GITHUB_CONTENT_API}?owner=${owner}&repo=${repo}&path=${encodeURIComponent(file.path)}${refParam}`;
              const response = await fetch(contentUrl);
              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch content (${response.status})`);
              }
              const data = await response.json();
              fileContentMap.set(file.path, data.content);
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
      
      if (githubFetchNeeded && fetchPromises.length > 0) {
        // Update loading message if fetching GitHub content
        setLoadingStatus({ isLoading: true, message: `Fetching content for ${fetchPromises.length} GitHub files...` });
        console.log(`Fetching content for ${fetchPromises.length} GitHub files...`);
        await Promise.all(fetchPromises);
        console.log('All content fetches completed');
        // Reset message back to generic copying after fetch
        setLoadingStatus({ isLoading: true, message: 'Copying files...' });
      }
      
      let clipboardText = '';

      if (mode === 'diff' || mode === 'diff-full') {
        const diffContent = filesToCopy.map((file) => {
          const header = [
            `File: ${file.path}`,
            file.previousPath ? `Previous path: ${file.previousPath}` : null,
            file.status ? `Status: ${file.status}` : null,
            typeof file.additions === 'number' || typeof file.deletions === 'number'
              ? `Changes: +${file.additions || 0} / -${file.deletions || 0}`
              : null,
          ].filter(Boolean).join('\n');

          return `${header}\n\n${file.patch || '[No textual patch available. The file may be binary, renamed without textual changes, or too large for GitHub patch output.]'}`;
        }).join('\n\n---\n\n');

        const diffTitle = dataSource.repoInfo?.sourceMode === 'commit' ? 'Commit Diffs' : 'Pull Request Diffs';
        clipboardText = `Project Structure:\n${treeString}\n\n---\n\n${diffTitle}:\n${diffContent}`;

        if (mode === 'diff-full') {
          let fullContent = '';
          for (const file of filesToCopy) {
            const content = fileContentMap.get(file.path) || '';
            const versionLabel = file.status === 'removed' ? 'base/original' : 'PR head';

            if (isBinaryFile(file.path)) {
              fullContent += `// ${file.path} (${versionLabel})\n// [Binary file not included]\n\n`;
              continue;
            }

            if (!content) {
              fullContent += `// ${file.path} (${versionLabel})\n// [Empty file or content unavailable]\n\n`;
              continue;
            }

            const processedContent = minifyOnCopy ? minifyCode(content) : content;
            fullContent += `// ${file.path} (${versionLabel})\n${processedContent}\n\n`;
          }

          clipboardText += `\n\n---\n\nFull File Contents:\n${fullContent}`;
        }
      } else {
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

        clipboardText = `Project Structure:\n${treeString}\n\n---\n\nFile Contents:\n${combinedContent}`;
      }
      
      await navigator.clipboard.writeText(clipboardText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Could not copy text: ', err);
      setCopySuccess(false);
    } finally {
      // Clear global loading state
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [fileTree, selectedFiles, loadingStatus, minifyOnCopy, dataSource, getAllFilesFromDataSource, setLoadingStatus]); // Added dependencies

  // Return only copySelectedFiles and copySuccess
  return { copySelectedFiles, copySuccess };
}
