import React, { useState, useEffect, useMemo, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { Toaster, toast } from 'sonner';

// Removed synchronous loading attempts

import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
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
  Ban,
  BookMarked,
  Trash2
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


// Add LoadingStatus interface definition
interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

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
  setLoadingStatus,
  loadingStatus,
}: FileSelectorProps & { tokenCount: number }) => {
  const [fileTree, setFileTree] = useState<{ [key: string]: InternalTreeNode } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredNodes, setFilteredNodes] = useState<Set<string>>(new Set());
  const [minifyOnCopy, setMinifyOnCopy] = useState<boolean>(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [highlightSearch, setHighlightSearch] = useState(false);

  // New preset state
  const [savedSelections, setSavedSelections] = useState<{ [name: string]: string[] }>({});
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  // State to hold the get_encoding function once loaded
  const [getEncodingFunc, setGetEncodingFunc] = useState<(() => any) | null>(null);

  // Ref to track the previous data source identity
  const prevDataSourceRef = useRef<DataSource>();

  // Async localStorage helpers for presets
  const getSelectionsFromStorage = async (): Promise<{ [name: string]: string[] }> => {
    return new Promise(resolve => {
      setTimeout(() => {
        try {
          const stored = localStorage.getItem('codebaseReaderSelections');
          resolve(stored ? JSON.parse(stored) : {});
        } catch (e) {
          console.error("Failed to read selections from storage", e);
          resolve({});
        }
      }, 0);
    });
  };

  const saveSelectionsToStorage = async (selections: { [name: string]: string[] }) => {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        try {
          localStorage.setItem('codebaseReaderSelections', JSON.stringify(selections));
          resolve();
        } catch (e) {
          console.error("Failed to save selections to storage", e);
          resolve(); // Still resolve so the app doesn't hang
        }
      }, 0);
    });
  };

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
  const {} =   useTokenCalculator({
    selectedFiles,
    getAllFilesFromDataSource,
    onTokenCountChange,
    getEncodingFunc,
    setLoadingStatus
  });

  // Use the custom hook for clipboard copy logic
  const { copySelectedFiles, copySuccess } = useClipboardCopy({
    fileTree,
    selectedFiles,
    minifyOnCopy,
    dataSource,
    getAllFilesFromDataSource,
    setLoadingStatus,
    loadingStatus
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
    // Use unified loading state
    setLoadingStatus({ isLoading: true, message: 'Getting AI suggestions...' });
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
      // Clear unified loading state
      setLoadingStatus({ isLoading: false, message: null });
    }
  }, [fileTree, onSelectedFilesChange, getAllFilesFromDataSource, setLoadingStatus]); // Added setLoadingStatus dependency

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

  // Preset handler functions
  const handleLoadPresets = async () => {
    const presets = await getSelectionsFromStorage();
    setSavedSelections(presets);
    setIsPresetsOpen(true);
  };

  const handleApplyPreset = (files: string[]) => {
    onSelectedFilesChange(files);
    setIsPresetsOpen(false);
    toast.success("Preset loaded.");
  };

  const handleSaveCurrentSelection = async (name: string) => {
    if (!name.trim()) {
      toast.error("Please enter a name for the preset.");
      return;
    }
    const newPreset = { [name.trim()]: selectedFiles };
    
    // Get the latest from storage to avoid race conditions
    const currentSelections = await getSelectionsFromStorage();
    const updatedSelections = { ...currentSelections, ...newPreset };

    await saveSelectionsToStorage(updatedSelections);

    // Update the local state for the UI
    setSavedSelections(updatedSelections);

    toast.success(`Preset "${name.trim()}" saved.`);
  };

  const handleDeletePreset = async (name: string) => {
    const currentSelections = await getSelectionsFromStorage();
    const updatedSelections = { ...currentSelections };
    delete updatedSelections[name];

    await saveSelectionsToStorage(updatedSelections);
    setSavedSelections(updatedSelections);

    toast.success(`Preset "${name}" deleted.`);
  };



  if (!fileTree) {
    return (
        <div className="flex flex-col h-full items-center justify-center p-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <span>Loading file structure...</span>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search files and content..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-background pl-8 h-9" // Adjusted padding and height
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
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
            {filteredNodes.size} match{filteredNodes.size !== 1 ? 'es' : ''}
          </span>
        )}

        {/* Action Buttons Group (Primary Bar - Right) */}
        <div className="flex items-center gap-2 ml-auto">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleAiSuggest}
                  disabled={loadingStatus.isLoading && loadingStatus.message?.includes('AI')}
                >
                  {loadingStatus.isLoading && loadingStatus.message?.includes('AI') ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                  <span className="sr-only">AI Suggest</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Replace selection with AI-suggested files</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                 <Button
                    variant="default"
                    size="sm"
                    className="h-9 px-3" // Adjusted padding
                    onClick={copySelectedFiles}
                    disabled={selectedFiles.length === 0 || (loadingStatus.isLoading && loadingStatus.message?.includes('Copying'))}
                >
                    {loadingStatus.isLoading && loadingStatus.message?.includes('Copying') ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Copy className="mr-2 h-4 w-4" />
                    )}
                    <span>{loadingStatus.isLoading && loadingStatus.message?.includes('Copying') ? 'Copying...' : copySuccess ? 'Copied!' : 'Copy'}</span>
                 </Button>
              </TooltipTrigger>
              <TooltipContent>
                 <p>Copy selected files ({selectedFiles.length}) to clipboard</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Tree Controls & File Size Legend (Secondary Bar) */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 border-b text-xs">
        <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Tree</span>
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
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <FileSearch className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Selection</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={selectAll}>
                  Select All ({totalFilesCount})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={deselectAll} disabled={selectedFiles.length === 0}>
                  Deselect All ({selectedFiles.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={handleLoadPresets}
            >
              <BookMarked className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Manage Presets</span>
            </Button>

        </div>

         {/* File Size Legend (Condensed) */}
        <div className="flex items-center gap-2 text-muted-foreground">
            <span>Size:</span>
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 cursor-default">
                        <File className="h-3 w-3 text-muted-foreground/70" />
                        <span className="hidden sm:inline">Normal</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Normal Size</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 cursor-default">
                        <FileWarning className="h-3 w-3 text-yellow-500" />
                         <span className="hidden sm:inline">Mod</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Moderate (1.25-2.5x avg lines)</TooltipContent>
                </Tooltip>
                <Tooltip>
                     <TooltipTrigger className="flex items-center gap-1 cursor-default">
                        <FileWarning className="h-3 w-3 text-rose-500" />
                         <span className="hidden sm:inline">Large</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Large (&gt;2.5x avg lines)</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
      </div>


      {aiError && (
        <div className="text-destructive text-sm p-2 bg-destructive/10 border-b">
          Error: {aiError}
        </div>
      )}

      {/* Main Tree View Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {searchTerm && filteredNodes.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 text-muted-foreground">
            <FileSearch className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>No files match your search &quot;{searchTerm}&quot;</p>
          </div>
        ) : (
          treeNodesToRender.length > 0 ? treeNodesToRender : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 text-muted-foreground">
               <Loader2 className="h-6 w-6 animate-spin mb-3" />
               <span>Populating file tree...</span>
            </div>
          )
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between p-2 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
           <Checkbox
            id="minify-code"
            checked={minifyOnCopy}
            onCheckedChange={(checked) => {
              if (checked !== "indeterminate") {
                setMinifyOnCopy(checked);
              }
            }}
            className="h-4 w-4"
          />
          <label
            htmlFor="minify-code"
            className="cursor-pointer select-none" // Make label clickable
          >
            Minify on copy
          </label>
        </div>
        <div className="flex items-center gap-3">
            <span>{totalFilesCount} files, {totalLinesCount.toLocaleString()} lines</span>
            <span>{selectedFiles.length} selected</span>
            {/* Token Count */}
            <div className="flex items-center">
            {loadingStatus.isLoading && loadingStatus.message?.includes('Calculating tokens') ? (
                <span className="inline-flex items-center text-muted-foreground">
                <Loader2 className="animate-spin h-3 w-3 mr-1" /> Calculating...
                </span>
            ) : (
                <span>~{tokenCount.toLocaleString()} tokens</span>
            )}
            </div>
        </div>
      </div>

      {/* Preset Management Dialog */}
      <Dialog open={isPresetsOpen} onOpenChange={setIsPresetsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Presets</DialogTitle>
            <DialogDescription>
              Save and load file selection presets
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Save Current Selection */}
            <div className="space-y-2">
              <Label htmlFor="preset-name">Save Current Selection</Label>
              <div className="flex gap-2">
                <Input
                  id="preset-name"
                  placeholder="Enter preset name..."
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      handleSaveCurrentSelection(target.value);
                      target.value = '';
                    }
                  }}
                />
                <Button
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    handleSaveCurrentSelection(input.value);
                    input.value = '';
                  }}
                  disabled={selectedFiles.length === 0}
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Load Presets */}
            {Object.keys(savedSelections).length > 0 && (
              <div className="space-y-2">
                <Label>Load Preset</Label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(savedSelections).map(([name, files]) => (
                    <div key={name} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{files.length} files</div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplyPreset(files)}
                        >
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeletePreset(name)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(savedSelections).length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <BookMarked className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No saved presets</p>
                <p className="text-xs">Save your first preset above</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPresetsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default FileSelector;