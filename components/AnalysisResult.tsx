import React, { useEffect, useState, useCallback, useMemo, Dispatch, SetStateAction } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FileSelector from './FileSelector';
import { AppState, FileData, DataSource, AnalysisResultProps } from './types';
import { Copy, File, Folder, FileText, CheckCircle2, BarChart3, FileSymlink, Layers, AlertCircle, CopyCheck, Download, Save, AlertTriangle, Archive, ClipboardList, Clock, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Toaster, toast } from 'sonner';
import { formatDistanceToNow, formatDistanceToNowStrict } from 'date-fns';

interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

interface TreeNodeData {
  type: 'file' | 'directory';
  name: string;
  size?: number;
  children?: { [key: string]: TreeNodeData };
}

interface TreeItemProps {
  node: TreeNodeData;
  isLast: boolean;
  prefix?: string;
}

type RecencyStatus = {
  text: string;
  colorClass: string;
  level: 'recent' | 'moderate' | 'old' | 'stale';
  tooltipText: string;
  originalTimestamp?: number;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const TreeItem: React.FC<TreeItemProps> = React.memo(({ node, isLast, prefix = '' }) => {
  const linePrefix = prefix + (isLast ? '└── ' : '├── ');
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  
  const entries = node.children 
    ? Object.entries(node.children).sort(([, a], [, b]) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
    : [];

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-0.5 rounded">
        <span className="text-muted-foreground whitespace-pre font-mono">{linePrefix}</span>
        <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
          {node.type === 'file' ? (
            <File className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-accent" />
          )}
        </span>
        <span className="font-mono">{node.name}</span>
        {node.size && (
          <span className="text-muted-foreground text-xs ml-1">({formatFileSize(node.size)})</span>
        )}
      </div>
      {entries.map(([key, childNode], index) => (
        <TreeItem
          key={key}
          node={childNode}
          isLast={index === entries.length - 1}
          prefix={childPrefix}
        />
      ))}
    </div>
  );
});
TreeItem.displayName = 'TreeItem';

const ProjectTree: React.FC<{ files: FileData[] }> = React.memo(({ files }) => {
  const tree: { [key: string]: TreeNodeData } = {};

  files.forEach(file => {
    const parts = file.path.split('/');
    let currentLevel = tree;

    parts.forEach((part, index) => {
      const isLastPart = index === parts.length - 1;
      if (!currentLevel[part]) {
        currentLevel[part] = {
          type: isLastPart ? 'file' : 'directory',
          name: part,
          size: isLastPart ? file.size : undefined,
          children: isLastPart ? undefined : {}
        };
      }
      currentLevel = currentLevel[part].children || {};
    });
  });

  const entries = Object.entries(tree).sort(([, a], [, b]) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Card className="glass-card p-4 overflow-auto max-h-96 custom-scrollbar">
      <div className="font-mono text-xs">
        {entries.map(([key, node], index) => (
          <TreeItem
            key={key}
            node={node}
            isLast={index === entries.length - 1}
          />
        ))}
      </div>
    </Card>
  );
});
ProjectTree.displayName = 'ProjectTree';

const AnalysisResult: React.FC<AnalysisResultProps> = React.memo(({
  analysisResult,
  selectedFiles,
  onSelectedFilesChange,
  tokenCount,
  setTokenCount,
  maxTokens,
  dataSource,
  setLoadingStatus,
  loadingStatus,
  namedSelections,
  onSaveNamedSelection,
  onRenameNamedSelection,
  onDeleteNamedSelection,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeFileTab, setActiveFileTab] = useState('selector');
  const [activeOutputTab, setActiveOutputTab] = useState('output');
  const [copyTreeSuccess, setCopyTreeSuccess] = useState(false);
  const [localRecencyStatus, setLocalRecencyStatus] = useState<RecencyStatus | null>(null);

  const githubCommitInfo = useMemo(() => {
    const commitDate = analysisResult?.commitDate;
    if (!commitDate || dataSource.type !== 'github') return null;

    const now = Date.now();
    try {
      const dateObject = new Date(commitDate);
      if (isNaN(dateObject.getTime())) throw new Error("Invalid date");
      const diffInMinutes = (now - dateObject.getTime()) / (1000 * 60);

      let colorClass = 'text-muted-foreground';
      let level: 'recent' | 'moderate' | 'old' = 'old';

      if (diffInMinutes < 1) {
        colorClass = 'text-green-600 dark:text-green-400 font-medium';
        level = 'recent';
      } else if (diffInMinutes < 10) {
        colorClass = 'text-amber-600 dark:text-amber-400 font-medium';
        level = 'moderate';
      }

      const formattedTime = formatDistanceToNow(dateObject, { addSuffix: true });
      const displayTimeText = (level === 'recent') ? "less than a minute ago" : formattedTime;
      const exactDateTime = dateObject.toLocaleString();

      return {
        text: `Commit ${displayTimeText}`,
        colorClass: colorClass,
        level: level,
        tooltipText: `Commit time: ${exactDateTime}`
      };
    } catch (error) {
      console.error("Error processing commit timestamp:", error);
      return null;
    }
  }, [analysisResult?.commitDate, dataSource.type]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const originalUploadTimestamp = analysisResult?.uploadTimestamp;

    const updateLocalStatus = () => {
      if (!originalUploadTimestamp) {
        setLocalRecencyStatus(null);
        return;
      }

      const now = Date.now();
      const diffInSeconds = (now - originalUploadTimestamp) / 1000;
      const diffInMinutes = diffInSeconds / 60;

      let status: RecencyStatus;
      const originalDate = new Date(originalUploadTimestamp);
      const baseTooltip = `Processed at ${originalDate.toLocaleTimeString()}`;

      if (diffInMinutes < 1) {
        status = {
          text: 'Processed just now',
          colorClass: 'text-green-600 dark:text-green-400 font-medium',
          level: 'recent',
          tooltipText: `${baseTooltip} (less than 1 min ago)`,
          originalTimestamp: originalUploadTimestamp
        };
      } else if (diffInMinutes < 5) {
        status = {
          text: `Processed ${formatDistanceToNowStrict(originalUploadTimestamp, { addSuffix: true })}`,
          colorClass: 'text-amber-600 dark:text-amber-400 font-medium',
          level: 'moderate',
          tooltipText: `${baseTooltip} (${Math.floor(diffInMinutes)} min ago)`,
          originalTimestamp: originalUploadTimestamp
        };
      } else if (diffInMinutes < 15) {
         status = {
           text: `Processed ${formatDistanceToNowStrict(originalUploadTimestamp, { addSuffix: true })}`,
           colorClass: 'text-orange-600 dark:text-orange-400 font-medium',
           level: 'old',
           tooltipText: `${baseTooltip} (${Math.floor(diffInMinutes)} min ago) - Consider refreshing`,
           originalTimestamp: originalUploadTimestamp
         };
      } else {
        status = {
          text: `Processed ${formatDistanceToNowStrict(originalUploadTimestamp, { addSuffix: true })}`,
          colorClass: 'text-red-600 dark:text-red-500 font-semibold',
          level: 'stale',
          tooltipText: `${baseTooltip} (${Math.floor(diffInMinutes)} min ago) - Refresh recommended`,
          originalTimestamp: originalUploadTimestamp
        };
      }
      setLocalRecencyStatus(status);
    };

    if (dataSource.type === 'local' && originalUploadTimestamp) {
      updateLocalStatus();
      intervalId = setInterval(updateLocalStatus, 15000);
      console.log("Local timer started, interval ID:", intervalId);
    } else {
      setLocalRecencyStatus(null);
       console.log("Clearing local timer/status.");
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log("Local timer cleared, interval ID:", intervalId);
      }
    };
  }, [analysisResult?.uploadTimestamp, dataSource.type]);

  const formattedCommitDateForSummary = useMemo(() => {
    if (!analysisResult?.commitDate) return null;
    try {
      return formatDistanceToNow(new Date(analysisResult.commitDate), { addSuffix: true });
    } catch (e) {
      return analysisResult.commitDate;
    }
  }, [analysisResult?.commitDate]);

  const effectiveDataSource = useMemo(() => {
    if (dataSource) {
      console.log("AnalysisResult: Using provided dataSource:", {
        type: dataSource.type,
        hasFiles: !!dataSource.files,
        hasTree: !!dataSource.tree,
        treeLength: dataSource.tree?.length || 0,
        hasRepoInfo: !!dataSource.repoInfo
      });
      return dataSource;
    }
    
    console.log("AnalysisResult: Creating default local dataSource");
    return {
      type: 'local' as const,
      files: analysisResult?.files || []
    };
  }, [dataSource, analysisResult?.files]);

  const selectedFilesData = useMemo(() => {
    return analysisResult?.files.filter(file => selectedFiles.includes(file.path)) || [];
  }, [analysisResult?.files, selectedFiles]);

  const totalSelectedFiles = selectedFilesData.length;
  const totalSelectedLines = useMemo(() => {
    return selectedFilesData.reduce((sum, file) => sum + file.lines, 0);
  }, [selectedFilesData]);

  const handleSetSelectedFiles = useCallback((filesOrUpdater: string[] | ((prev: string[]) => string[])) => {
    onSelectedFilesChange(filesOrUpdater);
  }, [onSelectedFilesChange]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast.success('Copied to clipboard!');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        toast.error('Failed to copy');
        console.error('Failed to copy: ', err);
      });
  };

  const downloadAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateProjectTree = useCallback((files: FileData[]): string => {
    const tree: { [key: string]: TreeNodeData } = {};

    files.forEach(file => {
      const parts = file.path.split('/');
      let currentLevel = tree;

      parts.forEach((part, index) => {
        const isLastPart = index === parts.length - 1;
        if (!currentLevel[part]) {
          currentLevel[part] = {
            type: isLastPart ? 'file' : 'directory',
            name: part,
            size: isLastPart ? file.size : undefined,
            children: isLastPart ? undefined : {}
          };
        }
        currentLevel = currentLevel[part].children || {};
      });
    });

    const buildTreeString = (obj: { [key: string]: TreeNodeData }, prefix = ''): string => {
      let result = '';
      const entries = Object.entries(obj).sort(([, a], [, b]) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      entries.forEach(([key, node], index) => {
        const isLast = index === entries.length - 1;
        const line = prefix + (isLast ? '└── ' : '├── ') + node.name;
        result += line + '\n';

        if (node.children) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          result += buildTreeString(node.children, newPrefix);
        }
      });

      return result;
    };

    return buildTreeString(tree);
  }, []);

  const handleCopyTreeStructure = useCallback(() => {
    if (!analysisResult || selectedFilesData.length === 0) {
      toast.error("No files selected to generate tree structure.");
      return;
    }
    const treeString = generateProjectTree(selectedFilesData);
    copyToClipboard(treeString);
    setCopyTreeSuccess(true);
    setTimeout(() => setCopyTreeSuccess(false), 2000);
  }, [selectedFilesData, analysisResult]);

  const tokenPercentage = Math.min(100, (tokenCount / maxTokens) * 100);
  const isTokenWarning = tokenPercentage > 75;
  const isTokenExceeded = tokenPercentage >= 100;

  const selectedFilesSummary = useMemo(() => selectedFilesData.map(file =>
    `// ${file.path} - ${file.lines} lines`
  ).join('\n'), [selectedFilesData]);

  const fileOutput = useMemo(() => selectedFilesData.map(file =>
    `// File: ${file.path}\n// ${file.lines} lines\n\n${file.content}`
  ).join('\n\n// ----------------------\n\n'), [selectedFilesData]);

  const markdownSummary = useMemo(() => {
    if (!analysisResult) return "Analysis result not available.";
    let summary = `## Project Summary\n\n`;
    summary += `- **Source:** ${dataSource.type}\n`;
    if (dataSource.type === 'github' && dataSource.repoInfo) {
      summary += `- **Repository:** ${dataSource.repoInfo.owner}/${dataSource.repoInfo.repo}\n`;
      summary += `- **Branch:** ${dataSource.repoInfo.branch}\n`;
    }
    if (formattedCommitDateForSummary && dataSource.type === 'github') {
       summary += `- **Commit Date:** ${formattedCommitDateForSummary}\n`;
    }
    if (analysisResult.uploadTimestamp && dataSource.type === 'local') {
        const uploadDate = new Date(analysisResult.uploadTimestamp);
        summary += `- **Local Files Processed:** ${uploadDate.toLocaleString()} (${formatDistanceToNow(uploadDate, { addSuffix: true })})\n`;
    }
    summary += `- **Total Files Scanned:** ${analysisResult.totalFiles ?? 'N/A'}\n`;
    summary += `- **Total Lines Scanned:** ${(analysisResult.totalLines ?? 0).toLocaleString()}\n`;
    summary += `\n## Selected Files (${totalSelectedFiles})\n\n`;
    summary += `- **Total Selected Lines:** ${totalSelectedLines.toLocaleString()}\n`;
    summary += `- **Estimated Token Count:** ${tokenCount.toLocaleString()}\n`;
    if (tokenCount > maxTokens) {
      summary += `- **Warning:** Token count exceeds the limit of ${maxTokens.toLocaleString()}\n`;
    }
    summary += `\n### File List:\n\n`;
    selectedFilesData.forEach(file => {
      summary += `- ${file.path} (${file.lines} lines)\n`;
    });
    return summary;
  }, [
    analysisResult,
    selectedFilesData,
    totalSelectedFiles,
    totalSelectedLines,
    tokenCount,
    maxTokens,
    dataSource,
    formattedCommitDateForSummary
  ]);

  const listOutput = useMemo(() => {
    return selectedFilesData.map(f => f.path).join('\n');
  }, [selectedFilesData]);

  const handleCopy = useCallback((type: 'markdown' | 'list' | 'code') => {
    if (selectedFilesData.length === 0) {
      toast.info('No files selected to copy.');
      return;
    }
    let contentToCopy = '';
    switch (type) {
      case 'markdown': contentToCopy = markdownSummary; break;
      case 'list': contentToCopy = listOutput; break;
      case 'code': contentToCopy = fileOutput; break;
    }
    copyToClipboard(contentToCopy);
  }, [selectedFilesData, markdownSummary, listOutput, fileOutput]);

  if (!analysisResult) {
    return (
      <Card className="glass-card flex items-center justify-center p-8 text-center min-h-[200px]">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground">Analysis results are not available.</p>
      </Card>
    );
  }

  const allAnalysisFiles = analysisResult.files || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <Toaster position="top-right" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in animation-delay-100">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Files Scanned
            </CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisResult.totalFiles ?? '-'}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Selected Files / Lines
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSelectedFiles} / {totalSelectedLines.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="glass-card relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estimated Token Count
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="relative z-10">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-2xl font-bold">
                    {tokenCount.toLocaleString()}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Approximate tokens for selected files.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Progress value={(tokenCount / maxTokens) * 100} className="mt-2 h-2" indicatorClassName={tokenCount > maxTokens ? 'bg-destructive' : ''} />
            <p className="text-xs text-muted-foreground mt-1">
              {tokenCount > maxTokens ? (
                <span className="text-destructive font-medium">Exceeds limit ({maxTokens.toLocaleString()})</span>
              ) : (
                `Limit: ${maxTokens.toLocaleString()}`
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {(githubCommitInfo || localRecencyStatus) && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`text-xs flex items-center justify-center gap-1.5 mb-4 px-3 py-1.5 rounded-full bg-background border border-border w-fit mx-auto cursor-default transition-colors ${ 
                  dataSource.type === 'github'
                    ? githubCommitInfo?.colorClass ?? 'text-muted-foreground'
                    : localRecencyStatus?.colorClass ?? 'text-muted-foreground'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {dataSource.type === 'github'
                    ? githubCommitInfo?.text ?? 'Loading...'
                    : localRecencyStatus?.text ?? 'Loading...'
                   }
                </span>
                {dataSource.type === 'local' && localRecencyStatus?.level === 'stale' && (
                  <RefreshCw className="h-3 w-3 ml-1 opacity-70" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {dataSource.type === 'github'
                   ? githubCommitInfo?.tooltipText ?? ''
                   : localRecencyStatus?.tooltipText ?? ''
                 }
              </p>
              {dataSource.type === 'local' && (localRecencyStatus?.level === 'old' || localRecencyStatus?.level === 'stale') && (
                   <p className="mt-1 text-muted-foreground">
                      Local files may have changed. Use the refresh button below "Choose Folder" to update.
                   </p>
               )}
               {dataSource.type === 'github' && (githubCommitInfo?.level === 'moderate' || githubCommitInfo?.level === 'old') && (
                   <p className="mt-1 text-muted-foreground">
                      Repository may have newer commits. Re-select branch to update.
                   </p>
               )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Tabs value={activeFileTab} onValueChange={setActiveFileTab} className="animate-fade-in animation-delay-200">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="selector" className="flex items-center gap-2">
            <FileSymlink className="h-4 w-4" />
            <span>File Selection</span>
          </TabsTrigger>
          <TabsTrigger value="tree" className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            <span>Project Tree</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="selector" className="mt-0 animate-slide-up">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-heading">File Selector</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <FileSelector
                dataSource={dataSource}
                selectedFiles={selectedFiles}
                setSelectedFiles={handleSetSelectedFiles}
                maxTokens={maxTokens}
                onTokenCountChange={setTokenCount}
                allFiles={allAnalysisFiles}
                tokenCount={tokenCount}
                setLoadingStatus={setLoadingStatus}
                loadingStatus={loadingStatus}
                namedSelections={namedSelections}
                onSaveNamedSelection={onSaveNamedSelection}
                onRenameNamedSelection={onRenameNamedSelection}
                onDeleteNamedSelection={onDeleteNamedSelection}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tree" className="mt-0 animate-slide-up">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-heading">Selected Files Tree</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={handleCopyTreeStructure}
                      >
                        {copyTreeSuccess ? (
                          <CopyCheck className="h-4 w-4 mr-2 text-green-500" />
                        ) : (
                          <ClipboardList className="h-4 w-4 mr-2" />
                        )}
                        <span>Copy Tree</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy Tree Structure to Clipboard</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              {selectedFilesData.length > 0 ? (
                <ProjectTree files={selectedFilesData} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-2 opacity-40" />
                  <p>No files selected</p>
                  <p className="text-sm mt-1">Select files using the File Selector tab.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Tabs value={activeOutputTab} onValueChange={setActiveOutputTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="output" className="text-xs sm:text-sm">Output Options</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs sm:text-sm">Summary</TabsTrigger>
          <TabsTrigger value="files" className="text-xs sm:text-sm">File List</TabsTrigger>
        </TabsList>
        
        <TabsContent value="output" className="space-y-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center justify-between text-xs sm:text-sm">
                  Copy As...
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleCopy('markdown')}>Copy Markdown Summary</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopy('list')}>Copy File List</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopy('code')}>Copy Full Code</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center justify-between text-xs sm:text-sm">
                  Download As...
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => downloadAsFile(markdownSummary, 'project-summary.md')}>Download Summary (.md)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadAsFile(listOutput, 'file-list.txt')}>Download File List (.txt)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadAsFile(fileOutput, 'project-code.txt')}>Download Full Code (.txt)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TabsContent>
        
        <TabsContent value="summary">
          <Textarea
            className="font-mono text-xs leading-relaxed h-80 custom-scrollbar resize-none"
            readOnly
            value={markdownSummary}
          />
          <div className="flex justify-end mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => copyToClipboard(markdownSummary)}
            >
              {copySuccess ? (
                <>
                  <CopyCheck className="h-3.5 w-3.5 mr-1.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="files">
          <Textarea
            className="font-mono text-xs leading-relaxed h-80 custom-scrollbar resize-none"
            readOnly
            value={listOutput}
          />
          <div className="flex justify-end mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => copyToClipboard(listOutput)}
            >
              {copySuccess ? (
                <>
                  <CopyCheck className="h-3.5 w-3.5 mr-1.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});
AnalysisResult.displayName = 'AnalysisResult';

export default AnalysisResult;