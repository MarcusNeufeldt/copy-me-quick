import React from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { File, FileWarning, ChevronRight, ChevronDown } from 'lucide-react';

export interface InternalTreeNode {
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

export interface FileTreeNodeProps {
  node: InternalTreeNode;
  selectedFiles: string[];
  onToggle: (path: string, isSelected: boolean) => void;
  expandedNodes: Set<string>;
  toggleExpand: (path: string) => void;
  averageLines: number;
  searchTerm: string;
  highlightSearch: boolean;
  tokenCountByPath?: Map<string, number>;
  maxTokenCount?: number;
  sortByTokens?: boolean;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  node,
  selectedFiles,
  onToggle,
  expandedNodes,
  toggleExpand,
  averageLines,
  searchTerm,
  highlightSearch,
  tokenCountByPath,
  maxTokenCount = 0,
  sortByTokens = false,
}) => {
  const isFolder = node.type === 'directory';
  const isExpanded = expandedNodes.has(node.path);

  const getAllDescendants = React.useCallback((n: InternalTreeNode): string[] => {
    if (n.type === 'file') return [n.path];
    if (!n.children) return [];
    return Object.values(n.children).flatMap(getAllDescendants);
  }, []);

  const getSelectionState = React.useCallback(() => {
    if (!isFolder) return selectedFiles.includes(node.path) ? 'checked' : 'unchecked';
    const allDescendants = getAllDescendants(node);
    const selectedDescendants = allDescendants.filter(p => selectedFiles.includes(p));
    if (selectedDescendants.length === 0) return 'unchecked';
    if (selectedDescendants.length === allDescendants.length) return 'checked';
    return 'indeterminate';
  }, [node, selectedFiles, getAllDescendants, isFolder]);

  const handleCheckboxChange = (checked: boolean) => onToggle(node.path, checked);

  const getNodeTokenCount = React.useCallback((treeNode: InternalTreeNode): number => {
    if (treeNode.type === 'file') {
      return tokenCountByPath?.get(treeNode.path) || 0;
    }

    return Object.values(treeNode.children || {}).reduce(
      (sum, child) => sum + getNodeTokenCount(child),
      0
    );
  }, [tokenCountByPath]);

  const tokenCount = getNodeTokenCount(node);
  const tokenRatio = maxTokenCount > 0 ? tokenCount / maxTokenCount : 0;
  const hasTokenSignal = tokenCount > 0 && maxTokenCount > 0;

  const getFileSizeLevel = React.useCallback((): 'normal' | 'moderate' | 'large' => {
    if (isFolder) return 'normal';

    if (hasTokenSignal) {
      if (tokenCount >= 10000 || tokenRatio >= 0.5) return 'large';
      if (tokenCount >= 3000 || tokenRatio >= 0.2) return 'moderate';
      return 'normal';
    }
    
    // If we have line count, use that (for local files or fetched GitHub files)
    if (node.lines && averageLines > 0) {
      if (node.lines > averageLines * 2.5) return 'large';
      if (node.lines > averageLines * 1.25) return 'moderate';
      return 'normal';
    }
    
    // Fallback to file size for GitHub files without content
    if (node.size) {
      if (node.size > 100000) return 'large';    // >100KB
      if (node.size > 25000) return 'moderate';  // >25KB
      return 'normal';
    }
    
    return 'normal';
  }, [node.lines, node.size, averageLines, isFolder, hasTokenSignal, tokenCount, tokenRatio]);

  const fileSizeLevel = getFileSizeLevel();
  const isLargeFile = fileSizeLevel === 'large';
  const isModerateFile = fileSizeLevel === 'moderate';

  const getSizeRatio = React.useCallback((): number => {
    if (isFolder) return 0;

    if (hasTokenSignal) {
      return Math.min(tokenRatio * 100, 100);
    }
    
    // Use line count if available
    if (node.lines && averageLines > 0) {
      const ratio = Math.min(node.lines / (averageLines * 3), 1);
      return ratio * 100;
    }
    
    // Fallback to file size for GitHub files without content
    if (node.size) {
      // Normalize file size to a 0-100 scale (100KB = 100%)
      const ratio = Math.min(node.size / 100000, 1);
      return ratio * 100;
    }
    
    return 0;
  }, [node.lines, node.size, averageLines, isFolder, hasTokenSignal, tokenRatio]);

  const sizeRatio = getSizeRatio();

  const matchesSearch = searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase());
  const contentMatches = !isFolder && searchTerm && !!node.content?.toLowerCase().includes(searchTerm.toLowerCase());

  let selectedBgClass = 'bg-muted/30 dark:bg-muted/10';
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
        selectedFiles.includes(node.path) ? selectedBgClass : ''
      }`}>
        {!isFolder && sizeRatio > 0 && (
          <div
            className={`${progressBarHeight} absolute bottom-0 left-0 rounded-b-md opacity-60 ${progressBarColor} ${progressBarStyle}`}
            style={{ width: `${sizeRatio}%` }}
          />
        )}
        <div className="flex items-center">
          {isFolder ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 hover:bg-transparent hover:text-primary"
              onClick={() => toggleExpand(node.path)}
              aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : (
            <div className="w-6 flex justify-center">
              {iconComponent}
            </div>
          )}
        </div>
        <Checkbox
          id={node.path}
          checked={getSelectionState() === 'checked'}
          onCheckedChange={handleCheckboxChange}
          className="h-4 w-4"
          {...(getSelectionState() === 'indeterminate' && { 'data-state': 'indeterminate' })}
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
                    {tokenCount > 0 && (
                      <span className={`ml-2 text-xs ${isLargeFile ? 'text-rose-600 dark:text-rose-400' : isModerateFile ? 'text-yellow-700 dark:text-yellow-400' : 'text-muted-foreground'}`}>
                        ({tokenCount.toLocaleString()} tokens)
                      </span>
                    )}
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
                {isFolder && tokenCount > 0 && (
                  <span className={`ml-2 text-xs ${tokenRatio >= 0.5 ? 'text-rose-600 dark:text-rose-400' : tokenRatio >= 0.2 ? 'text-yellow-700 dark:text-yellow-400' : 'text-muted-foreground'}`}>
                    {tokenCount.toLocaleString()} tokens
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
              {!isFolder && node.lines && averageLines > 0 && (
                <p className="text-xs mt-1">
                  <span>{node.lines.toLocaleString()} lines</span>
                  <span className="ml-2 text-muted-foreground">
                    ({(node.lines / averageLines).toFixed(1)}x avg)
                  </span>
                </p>
              )}
              {tokenCount > 0 && (
                <p className="text-xs mt-1">
                  <span>{tokenCount.toLocaleString()} selected tokens</span>
                  {maxTokenCount > 0 && (
                    <span className="ml-2 text-muted-foreground">
                      ({Math.round(tokenRatio * 100)}% of largest)
                    </span>
                  )}
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
      {isFolder && isExpanded && node.children && (
        <div className="ml-4 pl-2 border-l border-muted dark:border-muted/50">
          {Object.values(node.children)
            .sort((a, b) => {
              if (sortByTokens) {
                const tokenDiff = getNodeTokenCount(b) - getNodeTokenCount(a);
                if (tokenDiff !== 0) return tokenDiff;
              }
              const aIsFolder = a.type === 'directory';
              const bIsFolder = b.type === 'directory';
              if (aIsFolder && !bIsFolder) return -1;
              if (!aIsFolder && bIsFolder) return 1;
              return a.name.localeCompare(b.name);
            })
            .map(child => (
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
                tokenCountByPath={tokenCountByPath}
                maxTokenCount={maxTokenCount}
                sortByTokens={sortByTokens}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export const FileTreeNodeMemo = React.memo(FileTreeNode);
export default FileTreeNodeMemo;
