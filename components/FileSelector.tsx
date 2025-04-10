import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Folder, File, ChevronRight, ChevronDown, Info, Copy, ChevronDownSquare, ChevronUpSquare, Brain, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
}> = ({ node, selectedFiles, onToggle, expandedNodes, toggleExpand, averageLines }) => {
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

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <div className={`${isFolder ? 'mb-1' : ''}`}>
      <div className={`flex items-center space-x-2 py-1 px-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
        selectedFiles.includes(node.path) 
          ? !isFolder && node.lines && averageLines > 0 && node.lines > averageLines * 1.5
            ? 'bg-amber-50 dark:bg-amber-950' 
            : 'bg-gray-50 dark:bg-gray-900'
          : ''
      }`}>
        <div className="flex items-center">
          {isFolder ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 hover:bg-transparent"
              onClick={() => toggleExpand(node.path)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : (
            <div className="w-6 flex justify-center">
              <File className="h-4 w-4 text-gray-400" />
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
        <span className="flex-grow truncate text-sm">
          {isFolder ? (
            <span className="font-medium">{node.name}</span>
          ) : (
            <span className="text-gray-700 dark:text-gray-300">{node.name}</span>
          )}
          {!isFolder && node.lines && (
            <span className="ml-2 text-xs text-gray-500">
              ({node.lines.toLocaleString()} lines)
            </span>
          )}
        </span>
      </div>
      {isFolder && isExpanded && (
        <div className="ml-4 pl-2 border-l border-gray-200 dark:border-gray-700">
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
  const [copySuccess, setCopySuccess] = useState(false);
  const [isCalculatingTokens, setIsCalculatingTokens] = useState(false);
  const [minifyOnCopy, setMinifyOnCopy] = useState(true);
  const [tokenizerLoading, setTokenizerLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(calculationTimeout);
      setIsCalculatingTokens(false);
    };
  }, [selectedFiles, files, onTokenCountChange]);

  const buildFileTree = (files: FileData[]): { [key: string]: TreeNode } => {
    const tree: { [key: string]: TreeNode } = {};
    files.forEach(file => {
      const parts = file.path.split(/[\/\\]/); // Handle both forward and backward slashes
      let currentLevel: { [key: string]: TreeNode } = tree;
      let currentPath = '';
      
      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!currentLevel[part]) {
          currentLevel[part] = index === parts.length - 1
            ? { 
                name: part, 
                path: file.path, 
                type: 'file',
                lines: file.lines, 
                content: file.content 
              }
            : { 
                name: part, 
                path: currentPath, 
                type: 'directory',
                children: {} 
              };
        }
        if (index < parts.length - 1) {
          currentLevel = currentLevel[part].children!;
        }
      });
    });
    return tree;
  };

  const handleToggle = useCallback((path: string, isSelected: boolean) => {
    if (!fileTree) return;

    const getDescendantFiles = (node: TreeNode): string[] => {
      if (node.type === 'file') return [node.path];
      if (!node.children) return [];
      return Object.values(node.children).flatMap(getDescendantFiles);
    };

    const targetNode = findNode(fileTree, path);
    if (!targetNode) return;

    // Get all files that would be affected
    const filesToToggle = targetNode.type === 'file' ? [targetNode.path] : getDescendantFiles(targetNode);
    
    // Calculate new selection
    let newSelection: string[];
    if (isSelected) {
      // Add files if not already selected
      const newSet = new Set(selectedFiles);
      filesToToggle.forEach(file => newSet.add(file));
      newSelection = Array.from(newSet);
    } else {
      // Remove files
      const filesToRemoveSet = new Set(filesToToggle);
      newSelection = selectedFiles.filter(p => !filesToRemoveSet.has(p));
    }

    setSelectedFiles(newSelection);
  }, [fileTree, selectedFiles, setSelectedFiles]);

  const findNode = (tree: { [key: string]: TreeNode }, targetPath: string): TreeNode | null => {
    for (const node of Object.values(tree)) {
      if (node.path === targetPath) return node;
      if (node.children) {
        const found = findNode(node.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  };

  const clearSelection = () => {
    setSelectedFiles([]);
  };

  const selectAll = (): void => setSelectedFiles(files.map(f => f.path));
  const deselectAll = (): void => setSelectedFiles([]);

  const generateProjectTreeString = (tree: { [key: string]: TreeNode }): string => {
    const buildString = (nodes: { [key: string]: TreeNode }, prefix = ''): string => {
      let result = '';
      const entries = Object.entries(nodes).sort(([, a], [, b]) => {
        // Sort directories first, then files
        if (!!a.children !== !!b.children) return a.children ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      entries.forEach(([key, node], index) => {
        const isLast = index === entries.length - 1;
        const icon = node.type === 'directory' ? '📁' : '📄';
        result += `${prefix}${isLast ? '└── ' : '├── '}${icon} ${node.name}${node.lines ? ` (${node.lines.toLocaleString()} lines)` : ''}\n`;
        if (node.children) {
          result += buildString(node.children, `${prefix}${isLast ? '    ' : '│   '}`);
        }
      });
      return result;
    };

    return buildString(tree);
  };

  const handleAiSuggest = async () => {
    if (!fileTree || isAiLoading || tokenizerLoading) return;

    setIsAiLoading(true);
    setAiError(null);

    try {
      const projectTreeString = generateProjectTreeString(fileTree);
      
      const response = await fetch('/api/ai-smart-select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectTree: projectTreeString }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const suggestedPaths: string[] = data.selectedFiles || [];

      // Filter suggested paths to only include files that actually exist in the input `files` array
      const validPaths = suggestedPaths.filter(aiPath => 
        files.some(file => file.path === aiPath)
      );
      
      console.log("AI Suggested Valid Paths:", validPaths);
      setSelectedFiles(validPaths); // Update selection with valid paths from AI

    } catch (error) {
      console.error("AI Suggestion failed:", error);
      setAiError(error instanceof Error ? error.message : "An unknown error occurred during AI suggestion.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const minifyCode = (code: string): string => {
    return code
      // Remove all comments (single-line, multi-line, and JSDoc)
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
      // Remove empty lines and normalize whitespace
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      // Remove multiple consecutive newlines (after joining)
      .join('\n')
      .replace(/\n{2,}/g, '\n')
      // Trim the final result
      .trim();
  };

  const copySelectedFilesToClipboard = () => {
    if (fileTree) {
      // Create a new tree containing only selected files and their parent directories
      const selectedTreeNodes: { [key: string]: TreeNode } = {};
      
      selectedFiles.forEach(filePath => {
        const parts = filePath.split('/');
        let currentPath = '';
        let currentLevel = selectedTreeNodes;
        
        parts.forEach((part, index) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          const isLastPart = index === parts.length - 1;
          
          if (!currentLevel[part]) {
            const originalNode = (() => {
              let node = fileTree;
              const nodePath = currentPath.split('/');
              for (const p of nodePath) {
                if (!node[p]) return null;
                node = node[p].children || {};
              }
              return node;
            })();

            currentLevel[part] = {
              name: part,
              path: currentPath,
              type: isLastPart ? 'file' : 'directory',
              ...(isLastPart ? {
                lines: files.find(f => f.path === filePath)?.lines,
                content: files.find(f => f.path === filePath)?.content
              } : {
                children: {}
              })
            };
          }
          
          currentLevel = currentLevel[part].children || {};
        });
      });

      const projectTreeString = generateProjectTreeString(selectedTreeNodes);
      
      const selectedContents = selectedFiles
        .sort()
        .map(path => {
          const file = files.find(f => f.path === path);
          if (!file) return '';
          
          const separator = '='.repeat(80);
          const content = minifyOnCopy ? minifyCode(file.content) : file.content;
          return `${separator}\n${file.path}\n${separator}\n${content}\n\n`;
        })
        .join('');

      const fullContent = `Selected Project Structure:\n${projectTreeString}\n\nSelected Files Content:\n\n${selectedContents}`;

      navigator.clipboard.writeText(fullContent).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }, (err) => {
        console.error('Could not copy text: ', err);
      });
    }
  };

  const toggleExpand = (path: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    if (fileTree) {
      const allPaths = new Set<string>();
      const addAllPaths = (tree: { [key: string]: TreeNode }) => {
        Object.values(tree).forEach(node => {
          allPaths.add(node.path);
          if (node.children) {
            addAllPaths(node.children);
          }
        });
      };
      addAllPaths(fileTree);
      setExpandedNodes(allPaths);
    }
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const selectAllVisible = useCallback(() => {
    if (!fileTree) return;
    
    const getVisibleFiles = (node: TreeNode): string[] => {
      if (!node.children) {
        if (!searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return [node.path];
        }
        return [];
      }
      
      return Object.values(node.children)
        .flatMap(child => getVisibleFiles(child));
    };

    const visibleFiles = Object.values(fileTree).flatMap(node => getVisibleFiles(node));
    setSelectedFiles(prev => {
      const newSelection = new Set([...prev, ...visibleFiles]);
      return Array.from(newSelection);
    });
  }, [searchTerm, files]);

  if (!fileTree) {
    return <div>Loading file tree...</div>;
  }

  return (
    <Card className="flex-1 flex flex-col h-full overflow-hidden">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold">Select Files</CardTitle>
          <div className="flex items-center space-x-1">
            {tokenizerLoading && (
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Loading Tokenizer...</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
             {isCalculatingTokens && !tokenizerLoading && (
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calculating Tokens...</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleAiSuggest}
                    disabled={isAiLoading || tokenizerLoading || Object.keys(fileTree).length === 0}
                  >
                    {isAiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>AI Suggest Files (Experimental)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
                 <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={expandAll}>
                            <ChevronDownSquare className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Expand All</p></TooltipContent>
                 </Tooltip>
            </TooltipProvider>
             <TooltipProvider>
                 <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={collapseAll}>
                            <ChevronUpSquare className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Collapse All</p></TooltipContent>
                 </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <TooltipProvider>
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ChevronsUpDown className="h-4 w-4" />
                         </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Selection Options</p></TooltipContent>
                  </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={selectAll}>
                  <Check className="mr-2 h-4 w-4" />
                  <span>Select All</span>
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={deselectAll}>
                  <span className="mr-2 h-4 w-4"></span>
                  <span>Deselect All</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {aiError && (
          <div className="text-red-600 text-xs mt-1 p-1 bg-red-50 rounded border border-red-200">
            AI Suggest Error: {aiError}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-2 flex-1 overflow-y-auto">
        {Object.values(fileTree).length > 0 ? (
          Object.values(fileTree)
            .sort((a, b) => {
               const aIsFolder = a.type === 'directory';
               const bIsFolder = b.type === 'directory';
               if (aIsFolder && !bIsFolder) return -1;
               if (!aIsFolder && bIsFolder) return 1;
               return a.name.localeCompare(b.name);
             })
            .map(node => (
              <FileTreeNode
                key={node.path}
                node={node}
                selectedFiles={selectedFiles}
                onToggle={handleToggle}
                expandedNodes={expandedNodes}
                toggleExpand={toggleExpand}
                averageLines={averageSelectedLines}
              />
            ))
        ) : (
          <div className="text-center text-gray-500 mt-4">No files or folders found.</div>
        )}
      </CardContent>
      <div className="p-3 border-t flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            <Checkbox
                id="minify"
                checked={minifyOnCopy}
                onCheckedChange={(checked) => setMinifyOnCopy(checked as boolean)}
            />
            <label htmlFor="minify" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Minify on Copy
            </label>
             <TooltipProvider>
                 <Tooltip delayDuration={100}>
                    <TooltipTrigger className="cursor-help">
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Removes comments and extra whitespace. <br />May be slow or break complex code.</p>
                    </TooltipContent>
                 </Tooltip>
            </TooltipProvider>
          </div>
          <Button
            onClick={copySelectedFilesToClipboard}
            disabled={selectedFiles.length === 0 || tokenizerLoading}
            size="sm"
          >
            <Copy className="mr-2 h-4 w-4" />
            {copySuccess ? 'Copied!' : 'Copy Selected'}
          </Button>
      </div>
    </Card>
  );
};

export default FileSelector;