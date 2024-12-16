import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Folder, File, ChevronRight, ChevronDown, Info, Copy, ChevronDownSquare, ChevronUpSquare, Brain, Check, ChevronsUpDown } from 'lucide-react';
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

const estimateTokens = async (content: string): Promise<number> => {
  // Simple estimation: count words and add 20% for special tokens
  const wordCount = content.split(/\s+/).length;
  const estimatedTokens = Math.ceil(wordCount * 1.2);
  return estimatedTokens;
};

// Synchronous version for immediate UI feedback
const estimateTokensSync = (content: string): number => {
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount * 1.2);
};

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

  // Calculate average lines for selected non-folder files
  const averageSelectedLines = useMemo(() => {
    if (!selectedFiles.length) return 0;
    const selectedFilesData = files.filter(f => selectedFiles.includes(f.path) && f.lines && f.lines > 0);
    if (!selectedFilesData.length) return 0;
    const total = selectedFilesData.reduce((sum, file) => sum + (file.lines || 0), 0);
    return total / selectedFilesData.length;
  }, [files, selectedFiles]);

  useEffect(() => {
    const tree = buildFileTree(files);
    setFileTree(tree);
  }, [files]);

  useEffect(() => {
    let isMounted = true;

    const estimateTokenCount = async (): Promise<void> => {
      setIsCalculatingTokens(true);
      try {
        const counts = await Promise.all(
          selectedFiles.map(async (path) => {
            const file = files.find(f => f.path === path);
            if (!file) return 0;
            return await estimateTokens(file.content);
          })
        );
        if (isMounted) {
          const newTokenCount = counts.reduce((sum, count) => sum + count, 0);
          onTokenCountChange(newTokenCount);
        }
      } catch (error) {
        console.error("Error calculating tokens:", error);
      } finally {
        if (isMounted) {
          setIsCalculatingTokens(false);
        }
      }
    };

    estimateTokenCount();
    return () => {
      isMounted = false;
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
  }, [fileTree, selectedFiles]);

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

  const minifyCode = (code: string): string => {
    return code
      // Remove all comments (single-line, multi-line, and JSDoc)
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
      // Remove console.log statements
      .replace(/console\.(log|debug|info|warn|error|trace)\s*\([^)]*\);?/g, '')
      // Remove empty lines and normalize whitespace
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      // Combine imports
      .map(line => {
        if (line.startsWith('import {')) {
          // Combine multi-line imports into single line
          return line.replace(/\s*,\s*/g, ',').replace(/\s*}\s*from/, '}from');
        }
        if (line.startsWith('import ')) {
          // Remove spaces around braces in imports
          return line.replace(/\s*{\s*/g, '{').replace(/\s*}\s*/g, '}');
        }
        return line;
      })
      // Remove unnecessary whitespace
      .map(line => {
        return line
          // Remove spaces around operators
          .replace(/\s*([=+\-*/<>!&|,;:?])\s*/g, '$1')
          // Keep one space after keywords
          .replace(/\b(if|for|while|switch|catch|return|function|class|const|let|var)\b\s*/g, '$1 ')
          // Remove spaces inside parentheses
          .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
          // Remove spaces inside brackets
          .replace(/\[\s+/g, '[').replace(/\s+\]/g, ']')
          // Remove spaces inside braces (except in object literals)
          .replace(/{\s+(?=[^:]*})/g, '{').replace(/\s+}/g, '}')
          // Preserve space after commas in lists
          .replace(/,(\S)/g, ', $1')
          // Remove extra semicolons
          .replace(/;;+/g, ';')
          // Remove trailing semicolon at end of block
          .replace(/;}/g, '}')
          // Remove newlines after opening braces and before closing braces
          .replace(/{\n/g, '{')
          .replace(/\n}/g, '}')
          // Remove newlines after semicolons
          .replace(/;\n/g, ';')
          // Remove newlines around operators
          .replace(/\n*([=+\-*/<>!&|])\n*/g, '$1')
          // Remove multiple consecutive newlines
          .replace(/\n{2,}/g, '\n')
          // Remove redundant parentheses in simple conditions
          .replace(/if\s*\(\(([^()]*)\)\)/g, 'if($1)')
          // Remove unnecessary template literals
          .replace(/`([^${}]*)`/g, (_, content) => {
            // Only convert to string if it doesn't contain expressions
            return `'${content}'`;
          })
          // Shorten boolean expressions
          .replace(/===\s*true\b/g, '')
          .replace(/===\s*false\b/g, '===false')
          .replace(/!==\s*true\b/g, '===false')
          .replace(/!==\s*false\b/g, '')
          // Remove unnecessary 'return' in arrow functions
          .replace(/=>\s*{\s*return\s+([^;{}]*)\s*;\s*}/g, '=>$1')
          // Remove unnecessary 'void' in async arrow functions
          .replace(/async\s*\(\)\s*=>\s*void/g, 'async()=>')
          // Remove type annotations in JavaScript files
          .replace(/:\s*(string|number|boolean|any|void|never)\b\s*/g, '')
          // Trim the final result
          .trim()
      })
      .join('\n'); // Join the array back into a string
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

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Project Files</CardTitle>
          <div className="flex items-center gap-2">
            {/* Tree Control Group */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
                className="flex items-center space-x-1"
              >
                <ChevronDownSquare className="h-4 w-4" />
                <span>Expand All</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAll}
                className="flex items-center space-x-1"
              >
                <ChevronUpSquare className="h-4 w-4" />
                <span>Collapse All</span>
              </Button>
            </div>

            {/* Selection Group */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-1">
                  <ChevronsUpDown className="h-4 w-4" />
                  <span>Selection</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={selectAll}>
                  <Checkbox className="h-4 w-4 mr-2" checked={true} />
                  Select All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={deselectAll}>
                  <Checkbox className="h-4 w-4 mr-2" checked={false} />
                  Deselect All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={selectAllVisible}>
                  <Checkbox className="h-4 w-4 mr-2" />
                  Select All Visible
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Copy Group */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMinifyOnCopy(!minifyOnCopy)}
                className={`flex items-center space-x-1 ${minifyOnCopy ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20' : ''}`}
              >
                <Brain className="h-4 w-4" />
                <span>Minify</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={copySelectedFilesToClipboard}
                className={`flex items-center space-x-1 ${copySuccess ? 'bg-green-50 border-green-200 dark:bg-green-900/20' : ''}`}
                disabled={selectedFiles.length === 0}
              >
                {copySuccess ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className={copySuccess ? 'text-green-600 dark:text-green-400' : ''}>
                  {copySuccess ? 'Copied!' : 'Copy'}
                </span>
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4 mt-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search files..."
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllVisible}
            disabled={isCalculatingTokens}
          >
            Select All Visible
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
          >
            Clear Selection
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[600px] -mx-6 px-6">
          {fileTree && Object.keys(fileTree).length > 0 ? (
            Object.values(fileTree)
              .sort((a, b) => {
                // Folders first, then files
                const aIsFolder = a.type === 'directory';
                const bIsFolder = b.type === 'directory';
                if (aIsFolder && !bIsFolder) return -1;
                if (!aIsFolder && bIsFolder) return 1;
                return a.name.localeCompare(b.name);
              })
              .map((node) => (
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
            <div className="text-center py-4 text-gray-500">
              No files are loaded.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FileSelector;