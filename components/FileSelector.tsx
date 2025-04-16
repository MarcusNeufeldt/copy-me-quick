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
  const [minifyOnCopy, setMinifyOnCopy] = useState<boolean>(true);
  const [tokenizerLoading, setTokenizerLoading] = useState(false);
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

  // Moved useEffect for token calculation to useTokenCalculator hook
  // useEffect(() => { ... }, [selectedFiles, getAllFilesFromDataSource, onTokenCountChange, getEncodingFunc]);

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
  }, [fileTree, generateProjectTreeString, setSelectedFiles, getAllFilesFromDataSource]); // Use generateProjectTreeString from import

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