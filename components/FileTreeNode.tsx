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

  const getFileSizeLevel = React.useCallback((): 'normal' | 'moderate' | 'large' => {
    if (isFolder || !node.lines || averageLines <= 0) return 'normal';
    if (node.lines > averageLines * 2.5) return 'large';
    if (node.lines > averageLines * 1.25) return 'moderate';
    return 'normal';
  }, [node.lines, averageLines, isFolder]);

  const fileSizeLevel = getFileSizeLevel();
  const isLargeFile = fileSizeLevel === 'large';
  const isModerateFile = fileSizeLevel === 'moderate';

  const getSizeRatio = React.useCallback((): number => {
    if (isFolder || !node.lines || averageLines <= 0) return 0;
    const ratio = Math.min(node.lines / (averageLines * 3), 1);
    return ratio * 100;
  }, [node.lines, averageLines, isFolder]);

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
        {!isFolder && node.lines && averageLines > 0 && (
          <div className={`${progressBarHeight} absolute bottom-0 left-0 rounded-b-md opacity-60 ${progressBarStyle}`} style={{ width: `${sizeRatio}%`, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue(`--${progressBarColor.split('-')[1]}-500`) }} />
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
      {isFolder && isExpanded && node.children && (
        <div className="ml-4 pl-2 border-l border-muted dark:border-muted/50">
          {Object.values(node.children)
            .sort((a, b) => {
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
              />
            ))}
        </div>
      )}
    </div>
  );
};

export const FileTreeNodeMemo = React.memo(FileTreeNode);
export default FileTreeNodeMemo;
