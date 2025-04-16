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
import FileTreeNodeMemo, { InternalTreeNode } from './FileTreeNode';
import {
  buildLocalFileTree,
  buildGitHubTree,
  formatFileSize,
  getDescendantFiles,
  findNode,
  generateProjectTreeString,
  minifyCode,
  isBinaryFile
} from './fileSelectorUtils';
import { useTokenCalculator } from '../hooks/useTokenCalculator'; // Adjust path if needed
import { useClipboardCopy } from '../hooks/useClipboardCopy'; // Adjust path if needed

// Define content fetching API route
const GITHUB_CONTENT_API = '/api/github/content'; // Define once

const FileSelector = ({
  dataSource,
  selectedFiles,
  setSelectedFiles: onSelectedFilesChange,
  maxTokens,
  onTokenCountChange,
  allFiles,
  tokenCount,
}: FileSelectorProps & { tokenCount: number }) => {
  const [fileTree, setFileTree] = useState<{ [key: string]: InternalTreeNode } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredNodes, setFilteredNodes] = useState<Set<string>>(new Set());
  const [minifyOnCopy, setMinifyOnCopy] = useState<boolean>(true);
  const [tokenizerLoading, setTokenizerLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [highlightSearch, setHighlightSearch] = useState(false);

  // State to hold the get_encoding function once loaded
  const [getEncodingFunc, setGetEncodingFunc] = useState<(() => any) | null>(null);

  // Ref to track the previous data source identity
  const prevDataSourceRef = useRef<DataSource>();

  // Helper function to get all FileData from current dataSource or allFiles prop
  const getAllFilesFromDataSource = useCallback((): FileData[] => {
    if (dataSource.type === 'local' && dataSource.files) {
      return dataSource.files.map(f => ({ ...f, dataSourceType: 'local' }));
    } else if (dataSource.type === 'github' && dataSource.tree) {
      return dataSource.tree
        .filter(item => item.type === 'blob')
        .map(item => {
          const extendedItem = item as GitHubTreeItem & { lines?: number, content?: string };
          return {
            path: item.path,
            lines: extendedItem.lines || 0,
            content: extendedItem.content || '',
            size: item.size,
            sha: item.sha,
            dataSourceType: 'github'
          };
        });
    } else if (allFiles && allFiles.length > 0) { // Use allFiles prop as fallback
        console.warn("Falling back to allFiles prop in FileSelector");
        // Assume local if using fallback, or derive if FileData includes type
        return allFiles.map(f => ({ ...f, dataSourceType: f.dataSourceType || 'local' }));
    }
    return [];
  }, [dataSource, allFiles]); // Depend on dataSource and allFiles

  // Use the custom hook for token calculation
  const { isCalculatingTokens } = useTokenCalculator({
    selectedFiles,
    getAllFilesFromDataSource,
    onTokenCountChange,
    getEncodingFunc,
  });

  // Use the custom hook for clipboard copy logic
  const { copySelectedFiles, isCopying, copySuccess } = useClipboardCopy({
    fileTree,
    selectedFiles,
    minifyOnCopy,
    dataSource,
    getAllFilesFromDataSource,
  });

  // Calculate projectWideAverageLines based on getAllFilesFromDataSource
  const projectWideAverageLines = useMemo(() => {
    const files = getAllFilesFromDataSource();
    if (!files || files.length === 0) return 0;

    const filesWithLines = files.filter(f => f.lines !== undefined && f.lines > 0);
    if (filesWithLines.length === 0) return 0;

    const totalLines = filesWithLines.reduce((sum, file) => sum + (file.lines || 0), 0);
    return totalLines / filesWithLines.length;
  }, [getAllFilesFromDataSource]);

  // Calculate averageLines based on getAllFilesFromDataSource and selectedFiles
  const averageLines = useMemo(() => {
    const allFilesData = getAllFilesFromDataSource();
    if (!selectedFiles.length || !allFilesData.length) return projectWideAverageLines;
    
    const selectedFilesData = allFilesData.filter(f => selectedFiles.includes(f.path) && f.lines && f.lines > 0);
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
    
    // Rebuild tree based on dataSource or allFiles
    if (dataSource.type === 'local' && dataSource.files) {
       console.log(`Building local tree with ${dataSource.files.length} files.`);
       setFileTree(buildLocalFileTree(dataSource.files));
    } else if (dataSource.type === 'github' && dataSource.tree) {
       console.log(`Building GitHub tree with ${dataSource.tree.length} items.`);
       setFileTree(buildGitHubTree(dataSource.tree));
    } else if (allFiles && allFiles.length > 0) { // Use allFiles prop as fallback
       console.warn("DataSource invalid/incomplete, falling back to building tree from allFiles prop");
       setFileTree(buildLocalFileTree(allFiles));
    } else {
       console.warn("DataSource invalid and no fallback files available, clearing tree.");
       setFileTree(null); // Clear tree if no valid data
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

  }, [dataSource, allFiles]); // Depend on dataSource and allFiles

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

  // Handle toggling selection using the new callback prop
  const handleSelectionToggle = useCallback((path: string, isSelected: boolean) => {
    const node = findNode(fileTree!, path);
    if (!node) return;

    if (node.type === 'file') {
      // Use the onSelectedFilesChange callback prop
      onSelectedFilesChange(prev =>
        isSelected ? Array.from(new Set([...prev, node.path])) : prev.filter(p => p !== node.path)
      );
    } else if (node.type === 'directory') {
      const descendantFiles = getDescendantFiles(node);
      // Use the onSelectedFilesChange callback prop
      onSelectedFilesChange(prev => {
        if (isSelected) {
          return Array.from(new Set([...prev, ...descendantFiles]));
        } else {
          return prev.filter(p => !descendantFiles.includes(p));
        }
      });
    }
  }, [fileTree, onSelectedFilesChange]); // Depend on fileTree and the callback

  const clearSelection = useCallback(() => {
    onSelectedFilesChange([]); // Use callback
  }, [onSelectedFilesChange]);

  const selectAll = useCallback((): void => {
      const allFilesData = getAllFilesFromDataSource();
      onSelectedFilesChange(allFilesData.map(f => f.path)); // Use callback
  }, [getAllFilesFromDataSource, onSelectedFilesChange]);

  const deselectAll = useCallback((): void => {
      onSelectedFilesChange([]); // Use callback
  }, [onSelectedFilesChange]);

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
          onSelectedFilesChange(validSelections); // Use callback
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
  }, [fileTree, onSelectedFilesChange, getAllFilesFromDataSource]); // Use generateProjectTreeString from import

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
    onSelectedFilesChange(prev => Array.from(new Set([...prev, ...visibleFiles]))); // Use callback
  }, [fileTree, getVisibleFiles, onSelectedFilesChange]); // Added dependencies

  const deselectVisibleFiles = useCallback(() => {
    if (!fileTree) return;
    
    const visibleFiles = new Set(Object.values(fileTree).flatMap(getVisibleFiles));
    onSelectedFilesChange(prev => prev.filter(path => !visibleFiles.has(path))); // Use callback
  }, [fileTree, getVisibleFiles, onSelectedFilesChange]); // Added dependencies


  // Memoize the file tree nodes to render only when necessary
  const treeNodesToRender = useMemo(() => {
    if (!fileTree) return [];
    return Object.values(fileTree)
      .sort((a, b) => {
        const aIsFolder = a.type === 'directory';
        const bIsFolder = b.type === 'directory';
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return a.name.localeCompare(b.name);
      })
      .map(node => (
        <FileTreeNodeMemo
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
  }, [fileTree, selectedFiles, handleSelectionToggle, expandedNodes, toggleExpand, averageLines, searchTerm, highlightSearch]);

  // Calculate total file count and lines from getAllFilesFromDataSource
  const { totalFilesCount, totalLinesCount } = useMemo(() => {
      const files = getAllFilesFromDataSource();
      const lines = files.reduce((sum, file) => sum + (file.lines || 0), 0);
      return { totalFilesCount: files.length, totalLinesCount: lines };
  }, [getAllFilesFromDataSource]);

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
              Select All Files ({totalFilesCount})
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
                onClick={copySelectedFiles}
                disabled={selectedFiles.length === 0 || isCopying}
              >
                {isCopying ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
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
            <span> (~{tokenCount.toLocaleString()} tokens (tiktoken))</span>
          )}
        </div>
      </div>

      <div className="flex items-center py-1 px-2 border-b border-border/40">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div>{fileTree ? Object.keys(fileTree).length : 0} roots,</div>
          <div>{totalFilesCount} files,</div>
          <div>{totalLinesCount.toLocaleString()} lines</div>
          {selectedFiles.length > 0 && (
            <div className="ml-1 text-primary">({selectedFiles.length} selected)</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileSelector;