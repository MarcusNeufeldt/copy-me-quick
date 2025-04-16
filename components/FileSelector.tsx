import React, { useState, useEffect, useMemo, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { Button } from "@/components/ui/button";

// Removed synchronous loading attempts

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
  FileWarning,
  Ban
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

  // Determine file size level relative to average
  const getFileSizeLevel = (): 'normal' | 'moderate' | 'large' => {
    if (isFolder || !node.lines || averageLines <= 0) return 'normal';
    if (node.lines > averageLines * 2.5) return 'large';
    if (node.lines > averageLines * 1.25) return 'moderate';
    return 'normal';
  };

  const fileSizeLevel = getFileSizeLevel();
  const isLargeFile = fileSizeLevel === 'large';
  const isModerateFile = fileSizeLevel === 'moderate';
  const isWarningFile = isLargeFile || isModerateFile; // Files needing a warning icon

  // Calculate size ratio for progress indicator
  const getSizeRatio = (): number => {
    if (isFolder || !node.lines || averageLines <= 0) return 0;
    const ratio = Math.min(node.lines / (averageLines * 3), 1); // Cap at 3x average
    return ratio * 100; // Return as percentage
  };
  
  const sizeRatio = getSizeRatio();

  // Determine if this node matches the search
  const matchesSearch = searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase());
  // For files, also check content
  const contentMatches = !isFolder && searchTerm && !!(node.content?.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Only show this node if:
  // 1. It matches the search term
  // 2. It's a folder with children that match the search term
  // 3. There's no search term
  // const isAboveLargeSize = !isFolder && node.lines && averageLines > 0 && node.lines > averageLines * 1.5; // OLD logic removed

  // Define styles based on level
  let selectedBgClass = 'bg-muted/30 dark:bg-muted/10'; // Default selected BG
  let iconComponent = <File className="h-4 w-4 text-muted-foreground/70" />;
  let tooltipWarning = '';
  let progressBarColor = 'bg-sky-200 dark:bg-sky-900';
  let progressBarHeight = 'h-[3px]';
  let progressBarStyle = '';

  if (isLargeFile) {
    selectedBgClass = 'bg-rose-50/60 dark:bg-rose-950/30';
    iconComponent = <FileWarning className="h-4 w-4 text-rose-500" />;
    tooltipWarning = 'Very large file (may use many tokens)';
    progressBarColor = 'bg-rose-500 dark:bg-rose-600';
    progressBarHeight = 'h-[4px]';
    progressBarStyle = 'animate-pulse';
  } else if (isModerateFile) {
    selectedBgClass = 'bg-yellow-50/60 dark:bg-yellow-950/30';
    iconComponent = <FileWarning className="h-4 w-4 text-yellow-500" />;
    tooltipWarning = 'Moderately large file (may use more tokens)';
    progressBarColor = 'bg-yellow-300 dark:bg-yellow-700';
  }
  
  return (
    <div className={`${isFolder ? 'mb-1' : ''} ${highlightSearch && (matchesSearch || contentMatches) ? 'animate-pulse-subtle' : ''}`}>
      <div className={`relative flex items-center space-x-2 py-1 px-2 rounded-md transition-colors hover:bg-muted/50 ${
        selectedFiles.includes(node.path) ? selectedBgClass : '' // Apply dynamic selected BG class
      }`}>
        {!isFolder && node.lines && averageLines > 0 && (
          <div className={`absolute bottom-0 left-0 ${progressBarHeight} rounded-b-md opacity-60 ${progressBarStyle}`} 
               style={{ width: `${sizeRatio}%`, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue(`--${progressBarColor.split('-')[1]}-500`) }}></div>
        )}
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
              {iconComponent} {/* Use dynamic icon */}
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
              {!isFolder && node.lines && averageLines > 0 && (
                <p className="text-xs mt-1">
                  <span>{node.lines.toLocaleString()} lines</span>
                  <span className="ml-2 text-muted-foreground">
                    ({(node.lines / averageLines).toFixed(1)}x avg)
                  </span>
                </p>
              )}
              {tooltipWarning && (
                <p className={`text-xs mt-1 ${isLargeFile ? 'text-rose-500' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {tooltipWarning}
                </p>
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

  // State to hold the get_encoding function once loaded
  const [getEncodingFunc, setGetEncodingFunc] = useState<any | null>(null);

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

  // Calculate average lines for ALL files in the data source (fallback)
  const projectWideAverageLines = useMemo(() => {
    const allFiles = getAllFilesFromDataSource();
    if (!allFiles || allFiles.length === 0) return 0;

    const filesWithLines = allFiles.filter(f => f.lines !== undefined && f.lines > 0);
    if (filesWithLines.length === 0) return 0;

    const totalLines = filesWithLines.reduce((sum, file) => sum + (file.lines || 0), 0);
    return totalLines / filesWithLines.length;
  }, [getAllFilesFromDataSource]);

  // Calculate average lines using selected files, fallback to project-wide if needed
  const averageLines = useMemo(() => {
    const allFiles = getAllFilesFromDataSource();
    if (!selectedFiles.length || !allFiles.length) return projectWideAverageLines;
    
    const selectedFilesData = allFiles.filter(f => selectedFiles.includes(f.path) && f.lines && f.lines > 0);
    if (!selectedFilesData.length) return projectWideAverageLines;

    // Calculate the average based on selected files with lines
    const totalLines = selectedFilesData.reduce((sum, file) => sum + (file.lines || 0), 0);
    return totalLines / selectedFilesData.length;
  }, [selectedFiles, getAllFilesFromDataSource, projectWideAverageLines]);

  // Effect to dynamically load tiktoken on mount
  useEffect(() => {
    const loadTokenizer = async () => {
      setTokenizerLoading(true);
      try {
        console.log("Attempting dynamic import of tiktoken...");
        const tiktoken = await import('tiktoken');
        if (typeof tiktoken.get_encoding === 'function') {
          // Store the function itself in state
          setGetEncodingFunc(() => tiktoken.get_encoding);
          console.log("✅ Tiktoken dynamically imported and get_encoding function set in state.");
        } else {
          console.error("⚠️ Dynamic import succeeded, but get_encoding is not a function.");
          setGetEncodingFunc(null);
        }
      } catch (error) {
        console.error("⚠️ Failed to dynamically import tiktoken:", error);
        setGetEncodingFunc(null);
      } finally {
        setTokenizerLoading(false);
      }
    };

    loadTokenizer();
    // Run only once on mount
  }, []);

  // Moved useEffect for token calculation here
  // Now depends on getEncodingFunc state
  useEffect(() => {
    let isMounted = true;
    // No need to setIsCalculatingTokens here if estimateTokens does it?
    // setIsCalculatingTokens(true); // Consider if needed or if estimateTokens handles it

    const estimateTokens = async () => {
      setIsCalculatingTokens(true); // Set loading state for this calculation
      let currentTokenCount = 0;
      let usedFallback = false;
      const allFiles = getAllFilesFromDataSource();
      const filesToProcess = allFiles.filter(f => selectedFiles.includes(f.path));

      // Try to get the specific encoding instance using the function from state
      let encoding: any = null;
      if (typeof getEncodingFunc === 'function') { // Check if the function is loaded
        try {
          encoding = getEncodingFunc("cl100k_base"); // Call the function from state
          // console.log("Successfully got cl100k_base instance using function from state.");
        } catch (e) {
          console.warn("Error calling get_encoding('cl100k_base') from state function:", e);
          encoding = null; // Failed to get instance
        }
      } else {
        // console.log("getEncodingFunc from state was not a function.");
      }

      for (const file of filesToProcess) {
        let content = file.content;

        if (content && encoding) { // Check if we got the instance AND have content
          try {
              currentTokenCount += encoding.encode(content).length;
              // console.log(`Tokenized ${file.path} with tiktoken`);
          } catch(encodeError) {
              console.error(`Error encoding content for ${file.path}:`, encodeError);
              usedFallback = true;
              const estimated = Math.ceil(content.length / 4);
              currentTokenCount += estimated;
              console.log(`⚠️ Used LENGTH fallback for ${file.path} due to encode error (Length: ${content.length}, Estimated: ${estimated})`);
          }
        } else {
          usedFallback = true;
          if (file.dataSourceType === 'github' || !content) {
             const estimated = Math.ceil((file.size || 0) / 4);
             currentTokenCount += estimated;
             // Log reason based on whether the main function failed to load, or just this instance call/content issue
             const reason = getEncodingFunc ? (encoding ? 'Content unavailable' : 'Instance creation failed') : 'Tiktoken function not loaded';
             console.log(`⚠️ Used SIZE fallback for ${file.path} (Size: ${file.size}, Estimated: ${estimated}) - Reason: ${reason}`);
          } else if (content) {
             const estimated = Math.ceil(content.length / 4);
             currentTokenCount += estimated;
             // Log reason based on whether the main function failed to load or the instance call failed
             const reason = getEncodingFunc ? 'Instance creation failed' : 'Tiktoken function not loaded';
             console.log(`⚠️ Used LENGTH fallback for ${file.path} (Length: ${content.length}, Estimated: ${estimated}) - Reason: ${reason}`);
          } else {
             console.log(`⚠️ No content or size for ${file.path}, adding 0 tokens.`);
          }
        }
      }

      if (isMounted) {
        if (usedFallback) {
            console.warn("Token count includes fallback estimations.");
        } else {
            console.log("Token count calculation attempted purely with tiktoken.");
        }
        onTokenCountChange(currentTokenCount);
        setIsCalculatingTokens(false);
      }
    };

    // Only run estimation if files or function change, and function is potentially available
    // Adding a slight delay might help if WASM init is slow, but relying on state is better
    const timeoutId = setTimeout(estimateTokens, 50);

    return () => { isMounted = false; clearTimeout(timeoutId); };
    // Depend on selectedFiles, the data source helper, count change callback, AND the loaded function
  }, [selectedFiles, getAllFilesFromDataSource, onTokenCountChange, getEncodingFunc]);

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
  
  // Helper to check if a file is likely binary based on extension
  const isBinaryFile = useCallback((filePath: string): boolean => {
    const binaryExtensions = [
      '.ico', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', 
      '.webp', '.svg', '.pdf', '.zip', '.tar', '.gz', '.rar',
      '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db',
      '.woff', '.woff2', '.eot', '.ttf', '.otf'
    ];
    
    const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return binaryExtensions.includes(extension);
  }, []);

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
    
    try {
      const allFiles = getAllFilesFromDataSource(); // Get all files
      const filesToCopy = allFiles.filter(f => selectedFiles.includes(f.path));
      console.log(`Preparing to copy ${filesToCopy.length} files`);
      
      // First fetch all GitHub content if needed (in parallel)
      const fetchPromises = [];
      const fileContentMap = new Map<string, string>();
      
      for (const file of filesToCopy) {
        // Skip binary files
        if (isBinaryFile(file.path)) {
          console.log(`Skipping binary file: ${file.path}`);
          fileContentMap.set(file.path, `// [Binary file not included: ${file.path}]`);
          continue;
        }
        
        // If GitHub file with no content, fetch it
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
              
              // Cache the content in the map
              fileContentMap.set(file.path, content);
              
              // Also update the node in the fileTree
              const node = findNode(fileTree, file.path);
              if (node && node.type === 'file') {
                node.content = content;
                // Also update lines count for display
                node.lines = content.split('\n').length;
              }
            } catch (err) {
              console.error(`Failed to fetch content for ${file.path}:`, err);
              fileContentMap.set(file.path, `// Error fetching content for ${file.path}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          })();
          fetchPromises.push(fetchPromise);
        } else {
          // For local files or GitHub files with content already loaded
          fileContentMap.set(file.path, file.content || '');
        }
      }
      
      // Wait for all content fetches to complete
      if (fetchPromises.length > 0) {
        console.log(`Fetching content for ${fetchPromises.length} GitHub files...`);
        await Promise.all(fetchPromises);
        console.log('All content fetches completed');
      }
      
      // Now that we have all content, build the combined string
      let combinedContent = '';
      for (const file of filesToCopy) {
        const content = fileContentMap.get(file.path) || '';
        // Skip empty content or just use placeholder for binary files
        if (!content && !isBinaryFile(file.path)) {
          combinedContent += `// ${file.path}\n// [Empty file]\n\n`;
          continue;
        }
        
        // For binary files, just use the placeholder
        if (isBinaryFile(file.path)) {
          combinedContent += `// ${file.path}\n// [Binary file not included]\n\n`;
          continue;
        }
        
        const processedContent = minifyOnCopy ? minifyCode(content) : content;
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
  }, [fileTree, selectedFiles, isCopying, findNode, generateProjectTreeString, minifyOnCopy, minifyCode, dataSource, getAllFilesFromDataSource, isBinaryFile]);

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
            averageLines={averageLines}
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
          averageLines={averageLines}
          searchTerm={searchTerm}
          highlightSearch={highlightSearch}
        />
      ));
  }, [fileTree, searchTerm, filteredNodes, selectedFiles, handleSelectionToggle, expandedNodes, toggleExpand, averageLines, highlightSearch]);


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
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-background"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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

      {/* File Size Legend */}
      <div className="px-2 pt-1 pb-2 text-xs flex items-center gap-2 border-b border-border/50">
        <span className="text-muted-foreground">File size:</span>
        <div className="flex items-center gap-1">
          <File className="h-3 w-3 text-muted-foreground/70" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <FileWarning className="h-3 w-3 text-yellow-500" />
          <span>Moderate</span>
          <span className="text-muted-foreground">(1.25-2.5x avg)</span>
        </div>
        <div className="flex items-center gap-1">
          <FileWarning className="h-3 w-3 text-rose-500" />
          <span className="text-rose-500 font-medium">Large</span>
          <span className="text-muted-foreground">({'>'}2.5x avg)</span>
        </div>
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
  {selectedFiles.length} files selected {isCalculatingTokens ? (
  <span className="text-muted-foreground inline-flex items-center"> (<Loader2 className="animate-spin h-3 w-3 mr-1" /> Calculating...)</span>
) : (
  <span> (~{currentTokenCount.toLocaleString()} tokens (tiktoken))</span>
)}
</div>
      </div>

      <div className="flex items-center py-1 px-2 border-b border-border/40">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div>{fileTree ? Object.keys(fileTree).length : 0} roots,</div>
          <div>{state.analysisResult?.totalFiles || 0} files,</div>
          <div>{(state.analysisResult?.totalLines || 0).toLocaleString()} lines</div>
          {selectedFiles.length > 0 && (
            <div className="ml-1 text-primary">({selectedFiles.length} selected)</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileSelector;