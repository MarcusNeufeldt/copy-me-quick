import React, { useState, useEffect, useMemo, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  ChevronDownSquare, 
  ChevronUpSquare, 
  Brain, 
  Check, 
  ChevronsUpDown, 
  Loader2, 
  Search, 
  X, 
  FileSearch,
  FileWarning 
} from 'lucide-react';
import { FileData, AppState, DataSource, GitHubTreeItem, GitHubRepoInfo, FileSelectorProps } from './types';

interface InternalTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: { [key: string]: InternalTreeNode };
  lines?: number;
  content?: string;
  sha?: string;
  size?: number;
  formattedSize?: string;
}

const FileTreeNode: React.FC<{
  node: InternalTreeNode;
  selectedFiles: string[];
  onToggle: (path: string, isSelected: boolean) => void;
  expandedNodes: Set<string>;
  toggleExpand: (path: string) => void;
  averageLines: number;
  searchTerm: string;
  highlightSearch: boolean;
}> = ({ node, selectedFiles, onToggle, expandedNodes, toggleExpand, averageLines, searchTerm, highlightSearch }) => {
  const isFolder = node.type === 'directory';
  const isExpanded = expandedNodes.has(node.path);

  const getAllDescendants = (node: InternalTreeNode): string[] => {
    if (node.type === 'file') return [node.path];
    if (!node.children) return [];
    return Object.values(node.children).flatMap(getAllDescendants);
  };

  const getSelectionState = () => {
    if (!isFolder) {
      return selectedFiles.includes(node.path) ? "checked" : "unchecked";
    }
    const allDescendants = getAllDescendants(node);
    const selectedDescendants = allDescendants.filter(path => selectedFiles.includes(path));
    if (selectedDescendants.length === 0) return "unchecked";
    if (selectedDescendants.length === allDescendants.length) return "checked";
    return "indeterminate";
  };

  const handleCheckboxChange = (checked: boolean) => {
    // For indeterminate state, treat it as unchecked -> checked
    onToggle(node.path, checked);
  };

  // Determine if this node matches the search
  const matchesSearch = searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase());
  // For files, also check content
  const contentMatches = !isFolder && searchTerm && !!(node.content?.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Only show this node if:
  // 1. It matches the search term
  // 2. It's a folder with children that match the search term
  // 3. There's no search term
  const isAboveLargeSize = !isFolder && node.lines && averageLines > 0 && node.lines > averageLines * 1.5;
  
  return (
    <div className={`${isFolder ? 'mb-1' : ''} ${highlightSearch && (matchesSearch || contentMatches) ? 'animate-pulse-subtle' : ''}`}>
      <div className={`flex items-center space-x-2 py-1 px-2 rounded-md transition-colors hover:bg-muted/50 ${
        selectedFiles.includes(node.path) 
          ? !isFolder && isAboveLargeSize
            ? 'bg-amber-50/60 dark:bg-amber-950/30 gradient-border' 
            : 'bg-muted/30 dark:bg-muted/10'
          : ''
      }`}>
        <div className="flex items-center">
          {isFolder ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 hover:bg-transparent hover:text-primary"
              onClick={() => toggleExpand(node.path)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : (
            <div className="w-6 flex justify-center">
              {isAboveLargeSize ? (
                <FileWarning className="h-4 w-4 text-amber-500" />
              ) : (
                <File className="h-4 w-4 text-muted-foreground/70" />
              )}
            </div>
          )}
        </div>
        <Checkbox
          id={node.path}
          checked={getSelectionState() === "checked"}
          onCheckedChange={handleCheckboxChange}
          className="h-4 w-4"
          {...(getSelectionState() === "indeterminate" && { "data-state": "indeterminate" })}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-grow truncate text-sm cursor-default">
                {isFolder ? (
                  <span className="font-medium">{node.name}</span>
                ) : (
                  <span className={`${matchesSearch ? 'text-primary font-medium' : 'text-foreground'}`}>{node.name}</span>
                )}
                {!isFolder && (
                  <>
                    {node.lines && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({node.lines.toLocaleString()} lines)
                      </span>
                    )}
                    {!node.lines && node.formattedSize && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({node.formattedSize})
                      </span>
                    )}
                  </>
                )}
                {contentMatches && !matchesSearch && !isFolder && (
                  <span className="ml-2 text-xs text-primary">
                    (content match)
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" align="start">
              <p className="text-xs break-all">{node.path}</p>
              {!isFolder && isAboveLargeSize && (
                <p className="text-xs text-amber-500 mt-1">Large file (may use more tokens)</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {isFolder && isExpanded && (
        <div className="ml-4 pl-2 border-l border-muted dark:border-muted/50">
          {Object.values(node.children!)
            .sort((a, b) => {
              // Sort directories first, then files
              const aIsFolder = a.type === 'directory';
              const bIsFolder = b.type === 'directory';
              if (aIsFolder && !bIsFolder) return -1;
              if (!aIsFolder && bIsFolder) return 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                selectedFiles={selectedFiles}
                onToggle={onToggle}
                expandedNodes={expandedNodes}
                toggleExpand={toggleExpand}
                averageLines={averageLines}
                searchTerm={searchTerm}
                highlightSearch={highlightSearch}
              />
            ))}
        </div>
      )}
    </div>
  );
};

const FileSelector = ({ 
  dataSource,
  selectedFiles, 
  setSelectedFiles, 
  maxTokens, 
  onTokenCountChange, 
  state,
  setState 
}: FileSelectorProps) => {
  const [fileTree, setFileTree] = useState<{ [key: string]: InternalTreeNode } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredNodes, setFilteredNodes] = useState<Set<string>>(new Set());
  const [copySuccess, setCopySuccess] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [minifyOnCopy, setMinifyOnCopy] = useState<boolean>(true);
  const [tokenizerLoading, setTokenizerLoading] = useState(false);
  const [isCalculatingTokens, setIsCalculatingTokens] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [highlightSearch, setHighlightSearch] = useState(false);
  
  // Ref to track the previous data source identity
  const prevDataSourceRef = useRef<DataSource>();

  // Get tokenCount from parent state for display
  const currentTokenCount = state.analysisResult?.totalTokens ?? 0;

  // Helper function to get all FileData from current dataSource (local or github processed)
  const getAllFilesFromDataSource = useCallback((): FileData[] => {
    if (dataSource.type === 'local' && dataSource.files) {
      // Add dataSourceType for local files
      return dataSource.files.map(f => ({ ...f, dataSourceType: 'local' }));
    } else if (dataSource.type === 'github' && dataSource.tree) {
      // Convert GitHub tree items to minimal FileData structure
      return dataSource.tree
        .filter(item => item.type === 'blob')
        .map(item => {
          // Use TypeScript type assertion to access the added properties
          const extendedItem = item as GitHubTreeItem & { lines?: number, content?: string };
          return {
            path: item.path,
            lines: extendedItem.lines || 0, // Use lines if available, otherwise default to 0
            content: extendedItem.content || '', // Use content if available, otherwise empty string
            size: item.size,
            sha: item.sha,
            dataSourceType: 'github' // Mark as GitHub file
          };
        });
    } else if (state.analysisResult?.files) { // Fallback to analysisResult if dataSource is weird
        console.warn("Falling back to analysisResult.files in FileSelector");
        // Ensure fallback files also get dataSourceType marked (assume local)
        return state.analysisResult.files.map(f => ({ ...f, dataSourceType: 'local' }));
    }
    return [];
  }, [dataSource, state.analysisResult]);

  // Calculate average lines for selected non-folder files
  const averageSelectedLines = useMemo(() => {
    const allFiles = getAllFilesFromDataSource(); // Use helper
    if (!selectedFiles.length || !allFiles.length) return 0;
    const selectedFilesData = allFiles.filter(f => selectedFiles.includes(f.path) && f.lines && f.lines > 0);
    if (!selectedFilesData.length) return 0;
    const total = selectedFilesData.reduce((sum, file) => sum + (file.lines || 0), 0);
    return total / selectedFilesData.length;
  }, [selectedFiles, getAllFilesFromDataSource]); // Use helper in deps

  // Token estimation - needs adaptation for GitHub (async fetch)
  useEffect(() => {
    let isMounted = true;
    setIsCalculatingTokens(true);

    const estimateTokens = async () => {
        let currentTokenCount = 0;
        const allFiles = getAllFilesFromDataSource(); // Use helper
        const filesToProcess = allFiles.filter(f => selectedFiles.includes(f.path));

        for (const file of filesToProcess) {
            let content = file.content;
            // For GitHub files, content is initially empty. TODO: Fetch later.
            if (file.dataSourceType === 'github') {
                // Placeholder: Assume a small token count or size based count?
                // For now, just count based on size if available, rough estimate
                 currentTokenCount += Math.ceil((file.size || 0) / 4); 
            } else if (content) {
              // Local file with content
              currentTokenCount += Math.ceil(content.length / 4);
            }
        }
        
        if (isMounted) {
            onTokenCountChange(currentTokenCount);
            setIsCalculatingTokens(false);
        }
    };

    const timeoutId = setTimeout(estimateTokens, 50);

    return () => { isMounted = false; clearTimeout(timeoutId); };
  }, [selectedFiles, getAllFilesFromDataSource, onTokenCountChange]); // Use helper in deps

  useEffect(() => {
    console.log("DataSource changed, rebuilding tree:", dataSource.type);
    
    // --- Determine if the source has fundamentally changed ---
    let dataSourceChangedFundamentally = false;
    const prevDataSource = prevDataSourceRef.current;

    if (!prevDataSource) {
        // Initial load is a fundamental change
        dataSourceChangedFundamentally = true;
    } else if (prevDataSource.type !== dataSource.type) {
        // Type changed (local <-> github)
        dataSourceChangedFundamentally = true;
    } else if (dataSource.type === 'github' && prevDataSource.type === 'github') {
        // For GitHub, check if repo or branch changed
        const prevRepo = prevDataSource.repoInfo;
        const currentRepo = dataSource.repoInfo;
        
        if (prevRepo?.owner !== currentRepo?.owner || 
            prevRepo?.repo !== currentRepo?.repo || 
            prevRepo?.branch !== currentRepo?.branch) {
            dataSourceChangedFundamentally = true;
        }
    }
    // --- End fundamental change check ---
    
    // Rebuild the tree based on current dataSource
    if (dataSource.type === 'local' && dataSource.files) {
       console.log(`Building local tree with ${dataSource.files.length} files.`);
      setFileTree(buildLocalFileTree(dataSource.files));
    } else if (dataSource.type === 'github' && dataSource.tree) {
       console.log(`Building GitHub tree with ${dataSource.tree.length} items.`);
       console.log("Sample GitHub tree items:", dataSource.tree.slice(0, 3));
       const builtTree = buildGitHubTree(dataSource.tree);
       console.log("Built tree structure:", Object.keys(builtTree).length, "root items");
       setFileTree(builtTree);
    } else {
       if (state.analysisResult?.files && state.analysisResult.files.length > 0) {
           console.warn("DataSource invalid/incomplete, falling back to building tree from analysisResult.files");
           setFileTree(buildLocalFileTree(state.analysisResult.files));
       } else {
          console.warn("DataSource invalid and no fallback files available, clearing tree.");
          console.log("DataSource details:", {
            type: dataSource.type,
            hasFiles: !!dataSource.files,
            hasTree: !!dataSource.tree,
            hasRepoInfo: !!dataSource.repoInfo
          });
          setFileTree(null); // Clear tree if no valid data
       }
    }
    
    // Reset expansion ONLY if the data source has fundamentally changed
    if (dataSourceChangedFundamentally) {
      console.log("Fundamental data source change detected. Resetting expanded nodes.");
      setExpandedNodes(new Set());
      // Optionally reset selection if needed
      // setSelectedFiles([]);
    }
    
    // Update the ref for the next render
    prevDataSourceRef.current = dataSource;

  }, [dataSource, state.analysisResult]); // Dependencies remain the same

  // Filter nodes when search term changes
  useEffect(() => {
    if (!searchTerm) {
      setFilteredNodes(new Set());
      return;
    }

    const term = searchTerm.toLowerCase();
    const matchingNodes = new Set<string>();

    // Helper function to check if a node or any of its descendants match
    const checkNodeAndDescendants = (node: InternalTreeNode): boolean => {
      // Check if this node matches
      const nameMatches = node.name.toLowerCase().includes(term);
      // Ensure contentMatches is always boolean
      const contentMatches = !!(node.content?.toLowerCase().includes(term));
      const thisNodeMatches = nameMatches || contentMatches;
      
      if (thisNodeMatches) {
        matchingNodes.add(node.path);
      }
      
      // For folders, check children
      if (node.type === 'directory' && node.children) {
        let anyChildMatches = false;
        Object.values(node.children).forEach(child => {
          if (checkNodeAndDescendants(child)) {
            anyChildMatches = true;
          }
        });
        
        // If any child matches, this folder should be in the filtered set too
        if (anyChildMatches) {
          matchingNodes.add(node.path);
        }
        
        return thisNodeMatches || anyChildMatches;
      }
      
      return thisNodeMatches;
    };
    
    // Start the search from all root nodes
    if (fileTree) {
      Object.values(fileTree).forEach(node => {
        checkNodeAndDescendants(node);
      });
    }
    
    setFilteredNodes(matchingNodes);
    
    // Auto-expand nodes that match search or have matching children
    if (searchTerm && matchingNodes.size > 0) {
      // Create a new set to avoid modifying the current one during iteration
      const newExpandedNodes = new Set(expandedNodes);
      
      // Add all parent directories of matching nodes
      matchingNodes.forEach(path => {
        // Split the path to get all parent directories
        const parts = path.split('/');
        
        // Build up parent paths
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
          newExpandedNodes.add(currentPath);
        }
      });
      
      setExpandedNodes(newExpandedNodes);
      // Briefly highlight the search results
      setHighlightSearch(true);
      setTimeout(() => setHighlightSearch(false), 1500);
    }
  }, [searchTerm, fileTree, expandedNodes]); // Added expandedNodes dependency

  const buildLocalFileTree = (localFiles: FileData[]): { [key: string]: InternalTreeNode } => {
    const tree: { [key: string]: InternalTreeNode } = {};
    localFiles.forEach(file => {
      const parts = file.path.split('/');
      let current: { [key: string]: InternalTreeNode } | undefined = tree;
      let currentPath = '';
      parts.forEach((part, i) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!current) return; 
        if (i === parts.length - 1) {
          current[part] = { name: part, path: currentPath, type: 'file', lines: file.lines, content: file.content, size: file.size };
        } else {
          if (!current[part]) {
            current[part] = { name: part, path: currentPath, type: 'directory', children: {} };
          } else if (current[part].type === 'file') {
             console.warn(`Path conflict: Directory path ${currentPath} conflicts with existing file path.`);
             if (!current[part].children) current[part].children = {}; 
          } else if (!current[part].children) {
             current[part].children = {};
          }
          current = current[part].children;
        }
      });
    });
    return tree;
  };

  const buildGitHubTree = (githubTreeItems: GitHubTreeItem[]): { [key: string]: InternalTreeNode } => {
    const tree: { [key: string]: InternalTreeNode } = {};
    githubTreeItems.sort((a, b) => a.path.localeCompare(b.path)); 
    githubTreeItems.forEach(item => {
      const parts = item.path.split('/');
      let current: { [key: string]: InternalTreeNode } | undefined = tree;
      let currentPath = '';
      parts.forEach((part, i) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!current) return; 
        if (i === parts.length - 1) {
          if (item.type === 'blob') {
            // Format the size for display
            const formattedSize = item.size ? formatFileSize(item.size) : '';
            
            // Type assertion to access potential extended properties
            const extendedItem = item as GitHubTreeItem & { lines?: number, content?: string };
            
            current[part] = { 
              name: part, 
              path: item.path, 
              type: 'file', 
              sha: item.sha, 
              size: item.size,
              formattedSize, // Add formatted size for display
              lines: extendedItem.lines, // Get lines directly from extended item 
              content: extendedItem.content // Get content directly from extended item
            };
          } else if (item.type === 'tree') {
            if (!current[part]) {
                current[part] = { name: part, path: item.path, type: 'directory', children: {}, sha: item.sha };
            } else {
                 current[part].type = 'directory';
                 if(!current[part].children) current[part].children = {};
                 current[part].sha = item.sha; 
            }
          } 
        } else {
          if (!current[part]) {
            current[part] = { name: part, path: currentPath, type: 'directory', children: {} };
          } else if (!current[part].children) {
             current[part].type = 'directory';
             current[part].children = {};
          }
          current = current[part].children;
        }
      });
    });
    return tree;
  };

  // Add a helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  // Get all descendant files of a node 
  const getDescendantFiles = (node: InternalTreeNode): string[] => {
    if (node.type === 'file') return [node.path];
    
    const descendantFiles: string[] = [];
    if (node.type === 'directory' && node.children) {
      Object.values(node.children).forEach(child => {
        descendantFiles.push(...getDescendantFiles(child));
      });
    }
    
    return descendantFiles;
  };

  // Handle toggling selection
  const handleSelectionToggle = useCallback((path: string, isSelected: boolean) => {
    // Find the node with the given path
    const node = findNode(fileTree!, path);
    if (!node) return;

    if (node.type === 'file') {
      // For files, just toggle their selection
      setSelectedFiles(prev => 
        isSelected ? Array.from(new Set([...prev, node.path])) : prev.filter(p => p !== node.path)
      );
    } else if (node.type === 'directory') {
      // For directories, toggle selection of all descendant files
      const descendantFiles = getDescendantFiles(node);
      
      if (isSelected) {
        // Select all descendant files that aren't already selected
        setSelectedFiles(prev => Array.from(new Set([...prev, ...descendantFiles])));
      } else {
        // Deselect all descendant files
        setSelectedFiles(prev => prev.filter(p => !descendantFiles.includes(p)));
      }
    }
  }, [fileTree, setSelectedFiles, getDescendantFiles]);

  // Find a node in the file tree by path
  const findNode = (tree: { [key: string]: InternalTreeNode }, targetPath: string): InternalTreeNode | null => {
    const parts = targetPath.split('/');
    let current: { [key: string]: InternalTreeNode } | undefined = tree;
    let currentNode: InternalTreeNode | null = null;

    for (const part of parts) {
      if (!current || !current[part]) return null;
      currentNode = current[part];
      current = currentNode.children;
    }

    return currentNode;
  };

  const clearSelection = useCallback(() => {
    setSelectedFiles([]);
  }, [setSelectedFiles]);

  const selectAll = useCallback((): void => {
      const allFiles = getAllFilesFromDataSource(); // Use helper
      // Just update the selectedFiles state, don't modify expanded nodes
      setSelectedFiles(allFiles.map(f => f.path));
  }, [getAllFilesFromDataSource, setSelectedFiles]);

  const deselectAll = useCallback((): void => {
      // Just clear selection, don't change expanded state
      setSelectedFiles([]);
  }, [setSelectedFiles]);

  const generateProjectTreeString = useCallback((tree: { [key: string]: InternalTreeNode }): string => {
    const buildString = (nodes: { [key: string]: InternalTreeNode }, prefix = ''): string => {
      const nodeStrings = Object.entries(nodes)
        .sort(([, a], [, b]) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map(([key, node]) => {
          const nodeLine = prefix + (node.type === 'directory' ? `📁 ${node.name}/` : `📄 ${node.name}`);
          if (node.type === 'directory' && node.children) {
            return nodeLine + '\n' + buildString(node.children, prefix + '  ');
          }
          return nodeLine;
        });
      
      return nodeStrings.join('\n');
    };
    
    return buildString(tree);
  }, []);

  const handleAiSuggest = useCallback(async () => {
    if (!fileTree) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const treeString = generateProjectTreeString(fileTree);
      const requestBody = { projectTree: treeString };
      const response = await fetch('/api/ai-smart-select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
      const responseClone = response.clone();
      const rawResponseText = await responseClone.text();
      if (!response.ok) throw new Error(`Error: ${response.statusText} - ${rawResponseText}`);
      const data = await response.json();

      if (data.selectedFiles && Array.isArray(data.selectedFiles) && data.selectedFiles.length > 0) {
        const allFiles = getAllFilesFromDataSource(); // Use helper
        const existingPaths = new Set(allFiles.map(f => f.path));
        // Check AI paths against existing paths derived from current data source
        const validSelections = data.selectedFiles
          .map((aiPath: string) => existingPaths.has(aiPath) ? aiPath : null)
          .filter((path: string | null): path is string => path !== null);
        
        if (validSelections.length > 0) {
          setSelectedFiles(validSelections);
        } else {
          setAiError("AI couldn't find relevant files matching your project structure.");
        }
      } else {
        setAiError("AI returned no file suggestions.");
      }
    } catch (error) {
      console.error("Error during AI suggestion:", error);
      setAiError(error instanceof Error ? error.message : "Unknown error during AI processing");
    } finally {
      setIsAiLoading(false);
    }
  }, [fileTree, generateProjectTreeString, setSelectedFiles, getAllFilesFromDataSource]); // Use helper in deps

  const minifyCode = useCallback((code: string): string => {
    if (!code) return '';
    
    // Very basic minification for various languages
    return code
      // Remove single-line comments (// for JS/TS/Java/C#, # for Python/Ruby)
      .replace(/\/\/.*|#.*/g, '')
      // Remove multi-line comments (/* ... */ for many languages)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove empty lines
      .replace(/^\s*[\r\n]/gm, '')
      // Collapse multiple spaces to single space
      .replace(/\s{2,}/g, ' ')
      // Collapse spaces around brackets and parentheses
      .replace(/\s*([{}()[\]])\s*/g, '$1')
      // Trim leading/trailing whitespace
      .trim();
  }, []);

  // Define content fetching API route
  const GITHUB_CONTENT_API = '/api/github/content'; // Define once

  const copySelectedFilesToClipboard = useCallback(async () => {
    if (!fileTree || selectedFiles.length === 0 || isCopying) return;
    
    setIsCopying(true); // Set loading state
    setCopySuccess(false); // Reset success state

    // Build the filtered tree string (unchanged)
    const filteredTreeForCopy: { [key: string]: InternalTreeNode } = {};
    selectedFiles.forEach(path => {
        const node = findNode(fileTree, path);
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
    const treeString = generateProjectTreeString(filteredTreeForCopy);
    
    let combinedContent = '';
    const allFiles = getAllFilesFromDataSource(); // Use helper
    const filesToCopy = allFiles.filter(f => selectedFiles.includes(f.path));
    
    try {
      for (const file of filesToCopy) {
        let content = file.content;
        // Fetch GitHub content if it's missing
        if (file.dataSourceType === 'github' && !content && file.path && dataSource.type === 'github' && dataSource.repoInfo) {
          try {
            const { owner, repo, branch } = dataSource.repoInfo;
            // Use encodeURIComponent for the file path param
            const contentUrl = `${GITHUB_CONTENT_API}?owner=${owner}&repo=${repo}&path=${encodeURIComponent(file.path)}`;
            console.log(`Fetching content: ${contentUrl}`); // Debug log
            const response = await fetch(contentUrl);
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Failed to fetch content (${response.status})`);
            }
            
            const data = await response.json();
            content = data.content;
            
            // Cache the content in the component's internal fileTree structure
            // Find the node and update its content if possible
            const node = findNode(fileTree, file.path);
            if (node && node.type === 'file') {
              node.content = content;
              // Also update lines count for display
              node.lines = content.split('\n').length;
            }
          } catch (err) {
            console.error(`Failed to fetch content for ${file.path}:`, err);
            content = `// Error fetching content for ${file.path}: ${err instanceof Error ? err.message : 'Unknown error'}`;
          }
        }
        
        const processedContent = minifyOnCopy ? minifyCode(content || '') : content || '';
        combinedContent += `// ${file.path}\n${processedContent}\n\n`;
      }
      
      const clipboardText = `Project Structure:\n${treeString}\n\n---\n\nFile Contents:\n${combinedContent}`;
      
      await navigator.clipboard.writeText(clipboardText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Could not copy text: ', err);
      // Optionally show an error to the user
    } finally {
      setIsCopying(false); // Clear loading state regardless of success/failure
    }

  }, [fileTree, selectedFiles, isCopying, findNode, generateProjectTreeString, minifyOnCopy, minifyCode, dataSource, getAllFilesFromDataSource]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!fileTree) return;
    
    const allPaths = new Set<string>();
    
    const addAllPaths = (tree: { [key: string]: InternalTreeNode }) => {
      Object.values(tree).forEach(node => {
        if (node.type === 'directory') {
          allPaths.add(node.path);
          if (node.children) {
            addAllPaths(node.children);
          }
        }
      });
    };
    
    addAllPaths(fileTree);
    setExpandedNodes(allPaths);
  }, [fileTree]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // Get all currently visible files (respecting search and expanded state)
  const getVisibleFiles = useCallback((node: InternalTreeNode): string[] => {
    if (node.type === 'file') {
      // Respect search filter: only include if matching or no search term
      if (!searchTerm || filteredNodes.has(node.path)) {
        return [node.path];
      }
    }
    
    // For directories:
    // 1. Must be expanded
    // 2. Must have children
    // 3. Must be visible based on search (either itself or a descendant matches)
    if (node.type === 'directory' && expandedNodes.has(node.path) && node.children && (!searchTerm || filteredNodes.has(node.path))) {
      return Object.values(node.children).flatMap(child => getVisibleFiles(child));
    }
    
    return [];
  }, [expandedNodes, searchTerm, filteredNodes]); // Added dependencies


  const selectVisibleFiles = useCallback(() => {
    if (!fileTree) return;
    
    const visibleFiles = Object.values(fileTree).flatMap(getVisibleFiles);
    setSelectedFiles(prev => Array.from(new Set([...prev, ...visibleFiles])));
  }, [fileTree, getVisibleFiles, setSelectedFiles]); // Added dependencies

  const deselectVisibleFiles = useCallback(() => {
    if (!fileTree) return;
    
    const visibleFiles = new Set(Object.values(fileTree).flatMap(getVisibleFiles));
    setSelectedFiles(prev => prev.filter(path => !visibleFiles.has(path)));
  }, [fileTree, getVisibleFiles, setSelectedFiles]); // Added dependencies


  // Memoize the file tree nodes to render only when necessary
  const treeNodesToRender = useMemo(() => {
    console.log("Re-rendering tree nodes, searchTerm:", searchTerm, "expandedNodes count:", expandedNodes.size);
    
    if (!fileTree) return [];
    
    // Only apply filtering if there's actually a search term
    if (!searchTerm) {
      // When no search term is active, render the complete tree without filtering
      return Object.values(fileTree)
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            selectedFiles={selectedFiles}
            onToggle={handleSelectionToggle}
            expandedNodes={expandedNodes}
            toggleExpand={toggleExpand}
            averageLines={averageSelectedLines}
            searchTerm={searchTerm}
            highlightSearch={highlightSearch}
          />
        ));
    }
    
    // If there is a search term, apply filtering
    // Recursively filter the tree based on the searchTerm and filteredNodes
    const filterTree = (tree: { [key: string]: InternalTreeNode }): { [key: string]: InternalTreeNode } => {
      const filtered: { [key: string]: InternalTreeNode } = {};
      Object.entries(tree).forEach(([key, node]) => {
        if (filteredNodes.has(node.path)) {
          // If the node itself matches, include it
          // If it's a directory, recursively filter its children
          if (node.type === 'directory' && node.children) {
            filtered[key] = {
              ...node,
              children: filterTree(node.children),
            };
          } else {
            filtered[key] = node;
          }
        }
      });
      return filtered;
    };
    
    const treeToDisplay = filterTree(fileTree);
    
    return Object.values(treeToDisplay)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          selectedFiles={selectedFiles}
          onToggle={handleSelectionToggle}
          expandedNodes={expandedNodes}
          toggleExpand={toggleExpand}
          averageLines={averageSelectedLines}
          searchTerm={searchTerm}
          highlightSearch={highlightSearch}
        />
      ));
  }, [fileTree, searchTerm, filteredNodes, selectedFiles, handleSelectionToggle, expandedNodes, toggleExpand, averageSelectedLines, highlightSearch]);


  if (tokenizerLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>;
  }

  if (!fileTree) {
    return <div className="p-4 text-muted-foreground">No files to display.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search files and content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-8 h-9"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {searchTerm && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filteredNodes.size} match{filteredNodes.size !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <ChevronsUpDown className="mr-2 h-3.5 w-3.5" />
              <span>Tree</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={expandAll}>
              <ChevronDownSquare className="mr-2 h-4 w-4" />
              <span>Expand All</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={collapseAll}>
              <ChevronUpSquare className="mr-2 h-4 w-4" />
              <span>Collapse All</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <FileSearch className="mr-2 h-3.5 w-3.5" />
              <span>Selection</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={selectAll}>
              Select All Files ({getAllFilesFromDataSource().length})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={deselectAll}>
              Deselect All ({selectedFiles.length})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={selectVisibleFiles}>
              Select Visible Files
            </DropdownMenuItem>
            <DropdownMenuItem onClick={deselectVisibleFiles}>
              Deselect Visible Files
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8" 
                onClick={handleAiSuggest}
                disabled={isAiLoading}
              >
                {isAiLoading ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Brain className="mr-2 h-3.5 w-3.5" />
                )}
                <span>AI Suggest</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Use AI to suggest important files for LLM context</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="default"
                size="sm" 
                className="h-8 ml-auto" 
                onClick={copySelectedFilesToClipboard}
                disabled={selectedFiles.length === 0 || isCopying}
              >
                {isCopying ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : copySuccess ? (
                  <Check className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-2 h-3.5 w-3.5" />
                )}
                <span>{isCopying ? 'Copying...' : copySuccess ? 'Copied!' : 'Copy Selected'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy selected files ({selectedFiles.length}) to clipboard</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {aiError && (
        <div className="text-destructive text-sm mb-4 p-2 bg-destructive/10 rounded-md">
          Error: {aiError}
        </div>
      )}

      <div className="border rounded-lg p-2 max-h-[500px] overflow-y-auto custom-scrollbar">
        {searchTerm && filteredNodes.size === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileSearch className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>No files match your search &quot;{searchTerm}&quot;</p>
          </div>
        ) : (
          treeNodesToRender.length > 0 ? treeNodesToRender : (
            <div className="text-center py-8 text-muted-foreground">Loading tree...</div>
          )
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center">
          <Checkbox
            id="minify-code"
            checked={minifyOnCopy}
            onCheckedChange={(checked) => {
              if (checked !== "indeterminate") {
                setMinifyOnCopy(checked);
              }
            }}
            className="h-4 w-4 mr-2"
          />
          <label
            htmlFor="minify-code"
            className="text-sm cursor-pointer text-muted-foreground"
          >
            Minify code on copy
          </label>
        </div>
        <div className="text-xs text-muted-foreground">
          {selectedFiles.length} files selected ({isCalculatingTokens ? 
            <span className="text-muted-foreground inline-flex items-center"><Loader2 className="animate-spin h-3 w-3 mr-1" /> Calculating...</span> : 
            <span>~{currentTokenCount.toLocaleString()} tokens (GitHub est. needs fetch)</span>
          })
        </div>
      </div>
    </div>
  );
};

export default FileSelector;