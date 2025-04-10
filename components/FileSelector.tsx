import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { FileData } from './types';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: { [key: string]: TreeNode };
  lines?: number;
  content?: string;
}

const FileTreeNode: React.FC<{
  node: TreeNode;
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

  const getAllDescendants = (node: TreeNode): string[] => {
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
                {!isFolder && node.lines && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({node.lines.toLocaleString()} lines)
                  </span>
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

interface FileSelectorProps {
  files: FileData[];
  selectedFiles: string[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  maxTokens: number;
  onTokenCountChange: (count: number) => void;
}

const FileSelector = ({ files, selectedFiles, setSelectedFiles, maxTokens, onTokenCountChange }: FileSelectorProps) => {
  const [fileTree, setFileTree] = useState<{ [key: string]: TreeNode } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredNodes, setFilteredNodes] = useState<Set<string>>(new Set());
  const [copySuccess, setCopySuccess] = useState(false);
  const [isCalculatingTokens, setIsCalculatingTokens] = useState(false);
  const [minifyOnCopy, setMinifyOnCopy] = useState<boolean>(true);
  const [tokenizerLoading, setTokenizerLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [highlightSearch, setHighlightSearch] = useState(false);

  // Calculate average lines for selected non-folder files
  const averageSelectedLines = useMemo(() => {
    if (!selectedFiles.length) return 0;
    const selectedFilesData = files.filter(f => selectedFiles.includes(f.path) && f.lines && f.lines > 0);
    if (!selectedFilesData.length) return 0;
    const total = selectedFilesData.reduce((sum, file) => sum + (file.lines || 0), 0);
    return total / selectedFilesData.length;
  }, [files, selectedFiles]);

  // Replace tiktoken initialization with simpler approach
  useEffect(() => {
    // No need to initialize tiktoken
    setTokenizerLoading(false);
  }, []);

  useEffect(() => {
    const tree = buildFileTree(files);
    setFileTree(tree);
  }, [files]);

  // Filter nodes when search term changes
  useEffect(() => {
    if (!searchTerm) {
      setFilteredNodes(new Set());
      return;
    }

    const term = searchTerm.toLowerCase();
    const matchingNodes = new Set<string>();

    // Helper function to check if a node or any of its descendants match
    const checkNodeAndDescendants = (node: TreeNode): boolean => {
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

  // Simplified token estimation function that doesn't rely on tiktoken
  useEffect(() => {
    let isMounted = true;
    setIsCalculatingTokens(true);

    // Simple timeout to not block the UI
    const calculationTimeout = setTimeout(() => {
      try {
        let currentTokenCount = 0;
        selectedFiles.forEach(path => {
          const file = files.find(f => f.path === path);
          if (file && file.content) {
            // Simple estimation: roughly 4 chars per token for code
            currentTokenCount += Math.ceil(file.content.length / 4);
          }
        });

        if (isMounted) {
          onTokenCountChange(currentTokenCount);
        }
      } catch (error) {
        console.error("Error calculating tokens:", error);
        if (isMounted) {
          onTokenCountChange(0);
        }
      } finally {
        if (isMounted) {
          setIsCalculatingTokens(false);
        }
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(calculationTimeout);
    };
  }, [selectedFiles, files, onTokenCountChange]);

  const buildFileTree = (files: FileData[]): { [key: string]: TreeNode } => {
    const tree: { [key: string]: TreeNode } = {};

    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      let currentPath = '';

      // Process each part of the path
      parts.forEach((part, i) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (i === parts.length - 1) {
          // This is a file
          current[part] = {
            name: part,
            path: currentPath,
            type: 'file',
            lines: file.lines,
            content: file.content
          };
        } else {
          // This is a directory
          if (!current[part]) {
            current[part] = {
              name: part,
              path: currentPath,
              type: 'directory',
              children: {}
            };
          } else if (!current[part].children) {
            current[part].children = {};
          }
          current = current[part].children as { [key: string]: TreeNode };
        }
      });
    });

    return tree;
  };

  // Get all descendant files of a node 
  const getDescendantFiles = (node: TreeNode): string[] => {
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
  const findNode = (tree: { [key: string]: TreeNode }, targetPath: string): TreeNode | null => {
    const parts = targetPath.split('/');
    let current: { [key: string]: TreeNode } | undefined = tree;
    let currentNode: TreeNode | null = null;

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

  const selectAll = useCallback((): void => setSelectedFiles(files.map(f => f.path)), [files, setSelectedFiles]);
  const deselectAll = useCallback((): void => setSelectedFiles([]), [setSelectedFiles]);

  const generateProjectTreeString = useCallback((tree: { [key: string]: TreeNode }): string => {
    const buildString = (nodes: { [key: string]: TreeNode }, prefix = ''): string => {
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
      // Generate a text representation of the project tree
      const treeString = generateProjectTreeString(fileTree);
      const requestBody = { projectTree: treeString };

      // Log the request payload
      console.log("AI Suggest Request Payload (Tree String):", treeString);
      console.log("AI Suggest Request Payload (JSON Body):", JSON.stringify(requestBody));
      
      // Call the AI Smart Select API
      const response = await fetch('/api/ai-smart-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Clone the response to read the raw text without consuming the body
      const responseClone = response.clone();
      const rawResponseText = await responseClone.text();
      console.log("AI Suggest Raw Response:", rawResponseText);
      
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText} - ${rawResponseText}`); // Include raw response in error
      }
      
      // Parse the JSON from the original response
      const data = await response.json();
      
      if (data.selectedFiles && Array.isArray(data.selectedFiles) && data.selectedFiles.length > 0) {
        // Filter out any suggested files that don't exist in our actual files
        const existingPaths = new Set(files.map(f => f.path));
        
        console.log("Existing file paths in frontend state:", existingPaths);
        console.log("File paths received from AI:", data.selectedFiles);

        // Attempt to determine the root folder prefix from the first file path
        // Assumes all paths share the same root directory name
        const firstPath = files[0]?.path;
        const rootPrefix = firstPath && firstPath.includes('/') ? firstPath.split('/')[0] + '/' : ''; // e.g., "codebase-reader/" or ""
        console.log("Deduced root prefix:", rootPrefix);

        // --- START REVISED FIX: Path Prefix Adjustment & Mapping ---
        const validSelections = data.selectedFiles
          .map((aiPath: string) => {
            // Create the full path to check against the existing set
            const fullPathToCheck = rootPrefix + aiPath;
            // Check if this prefixed path actually exists in the frontend state
            if (existingPaths.has(fullPathToCheck)) {
              // If it exists, return the *prefixed* path for the new selection state
              return fullPathToCheck;
            }
            // If it doesn't exist, return null to filter out later
            return null; 
          })
          .filter((path: string | null): path is string => path !== null); // Filter out the nulls, explicit type added
        // --- END REVISED FIX ---

        console.log("Valid selections after filtering (should have prefix):", validSelections);
        
        if (validSelections.length > 0) {
          setSelectedFiles(validSelections);
        } else {
          setAiError("AI couldn't find relevant files that match your project structure.");
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
  }, [fileTree, generateProjectTreeString, files, setSelectedFiles]); // Added dependencies

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

  const copySelectedFilesToClipboard = useCallback(() => {
    if (!fileTree || selectedFiles.length === 0) return;
    
    // Convert the selected files into a filtered tree
    const filteredTree: { [key: string]: TreeNode } = {};
    selectedFiles.forEach(path => {
      const file = files.find(f => f.path === path);
      if (!file) return;
      
      const parts = file.path.split('/');
      let current = filteredTree;
      let currentPath = '';
      
      parts.forEach((part, i) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (i === parts.length - 1) {
          // This is a file
          current[part] = {
            name: part,
            path: currentPath,
            type: 'file',
            lines: file.lines,
            content: file.content
          };
        } else {
          // This is a directory
          if (!current[part]) {
            current[part] = {
              name: part,
              path: currentPath,
              type: 'directory',
              children: {}
            };
          } else if (!current[part].children) {
            current[part].children = {};
          }
          current = current[part].children as { [key: string]: TreeNode };
        }
      });
    });
    
    // Generate the project tree string
    const treeString = generateProjectTreeString(filteredTree);
    
    // Combine the content of selected files
    const selectedContents = selectedFiles.map(path => {
      const file = files.find(f => f.path === path);
      if (!file) return '';
      
      const content = minifyOnCopy ? minifyCode(file.content || '') : file.content || '';
      return `// ${file.path}\n${content}\n`;
    }).join('\n');
    
    // Copy tree structure and file contents to clipboard
    const clipboardText = `Project Structure:\n${treeString}\n\nFile Contents:\n${selectedContents}`;
    
    navigator.clipboard.writeText(clipboardText)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
      });
  }, [fileTree, selectedFiles, files, generateProjectTreeString, minifyOnCopy, minifyCode]); // Added dependencies

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
    
    const addAllPaths = (tree: { [key: string]: TreeNode }) => {
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
  const getVisibleFiles = useCallback((node: TreeNode): string[] => {
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
    
    // Recursively filter the tree based on the searchTerm and filteredNodes
    const filterTree = (tree: { [key: string]: TreeNode }): { [key: string]: TreeNode } => {
      if (!searchTerm) return tree; // No filtering needed if no search term
      
      const filtered: { [key: string]: TreeNode } = {};
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
              Select All Files ({files.length})
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
                disabled={selectedFiles.length === 0}
              >
                {copySuccess ? (
                  <Check className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-2 h-3.5 w-3.5" />
                )}
                <span>{copySuccess ? 'Copied!' : 'Copy Selected'}</span>
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
            <span className="text-muted-foreground inline-flex items-center">
              <Loader2 className="animate-spin h-3 w-3 mr-1" /> Calculating...
            </span> : 
            <span>~{maxTokens.toLocaleString()} tokens</span>
          })
        </div>
      </div>
    </div>
  );
};

export default FileSelector;