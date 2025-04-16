import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FileSelector from './FileSelector';
import { AppState, FileData, DataSource } from './types';
import { Copy, File, Folder, FileText, CheckCircle2, BarChart3, FileSymlink, Layers, AlertCircle, CopyCheck, Download, Save, AlertTriangle, Archive, ClipboardList } from 'lucide-react';
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

interface AnalysisResultProps {
  analysisResult: AppState['analysisResult'] | null;
  selectedFiles: string[];
  onSelectedFilesChange: (filesOrUpdater: string[] | ((prev: string[]) => string[])) => void;
  tokenCount: number;
  setTokenCount: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number;
  dataSource?: DataSource;
  onSaveBackup: (name: string) => void;
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
  onSaveBackup
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [activeFileTab, setActiveFileTab] = useState('selector');
  const [activeOutputTab, setActiveOutputTab] = useState('output');
  const [copyTreeSuccess, setCopyTreeSuccess] = useState(false);

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
    
    // Default to local dataSource using files from analysisResult
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

  // Function to download as file
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
    // Convert to TreeNode structure
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
        // Directories first, then files
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
    if (analysisResult?.files) {
      const treeString = generateProjectTree(selectedFilesData);
      navigator.clipboard.writeText(treeString)
        .then(() => {
          setCopyTreeSuccess(true);
          toast.success('Tree structure copied!');
          setTimeout(() => setCopyTreeSuccess(false), 2000);
        })
        .catch(err => {
          toast.error('Failed to copy tree structure');
          console.error('Failed to copy tree structure: ', err);
        });
    }
  }, [analysisResult, selectedFilesData, generateProjectTree]);

  const tokenPercentage = Math.min(100, (tokenCount / maxTokens) * 100);
  const isTokenWarning = tokenPercentage > 75;
  const isTokenExceeded = tokenPercentage >= 100;

  const selectedFilesSummary = useMemo(() => selectedFilesData.map(file =>
    `// ${file.path} - ${file.lines} lines`
  ).join('\n'), [selectedFilesData]);

  const fileOutput = useMemo(() => selectedFilesData.map(file =>
    `// File: ${file.path}\n// ${file.lines} lines\n\n${file.content}`
  ).join('\n\n// ----------------------\n\n'), [selectedFilesData]);

  const markdownSummary = useMemo(() => `# Project Analysis

## Summary
- Total selected files: ${totalSelectedFiles}
- Total lines of code: ${totalSelectedLines.toLocaleString()}
- Estimated token count: ${tokenCount.toLocaleString()}
- Token usage: ${tokenPercentage.toFixed(1)}% (${tokenCount.toLocaleString()} of ${maxTokens.toLocaleString()})

## Selected Files
${selectedFilesData.map(file => `- \`${file.path}\` (${file.lines} lines)`).join('\n')}
`, [selectedFilesData, totalSelectedFiles, totalSelectedLines, tokenCount, maxTokens, tokenPercentage]);

  const listOutput = useMemo(() => selectedFilesData.map(file =>
    `${file.path} - ${file.lines} lines`
  ).join('\n'), [selectedFilesData]);

  const handleSaveBackup = () => {
    if (backupName.trim()) {
      onSaveBackup(backupName.trim());
      setShowBackupDialog(false);
      setBackupName('');
    }
  };

  const handleCopy = useCallback((type: 'markdown' | 'list' | 'code') => {
    try {
      let text = '';
      let message = '';
      if (type === 'markdown') {
        text = markdownSummary;
        message = 'Markdown summary copied!';
      } else if (type === 'list') {
        text = listOutput;
        message = 'File list copied!';
      } else {
        text = fileOutput;
        message = 'Full code copied!';
      }
      navigator.clipboard.writeText(text);
      toast.success(message);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  }, [markdownSummary, listOutput, fileOutput]);

  if (!analysisResult) {
    return <div className="p-4 text-center text-muted-foreground">Loading analysis results...</div>;
  }

  const allAnalysisFiles = analysisResult.files || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <Toaster position="top-right" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card p-6 animate-slide-up">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Selected Files</p>
              <div className="flex items-baseline">
                <h3 className="text-2xl font-bold">
                  {totalSelectedFiles}
                </h3>
                <span className="ml-2 text-sm text-muted-foreground">of {allAnalysisFiles.length}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="glass-card p-6 animate-slide-up animation-delay-200">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-secondary-100 dark:bg-secondary-900">
              <Layers className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Selected Lines</p>
              <div className="flex items-baseline">
                <h3 className="text-2xl font-bold">
                  {totalSelectedLines.toLocaleString()}
                </h3>
                <span className="ml-2 text-sm text-muted-foreground">
                  of {(analysisResult.totalLines || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="glass-card p-6 animate-slide-up animation-delay-400">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-accent-100 dark:bg-accent-900">
              <BarChart3 className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Token Count</p>
              <div className="flex items-baseline">
                <h3 className="text-2xl font-bold">
                  {tokenCount.toLocaleString()}
                </h3>
                <span className="ml-2 text-sm text-muted-foreground">
                  of {maxTokens.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Progress 
              value={tokenPercentage} 
              className={`h-2 ${
                isTokenExceeded ? 'bg-destructive/20' : 
                isTokenWarning ? 'bg-amber-200/20 dark:bg-amber-900/20' : 
                'bg-secondary/20'
              }`}
              indicatorClassName={
                isTokenExceeded ? 'bg-destructive' : 
                isTokenWarning ? 'bg-amber-500' : 
                'bg-gradient-to-r from-primary to-secondary'
              }
            />
            {isTokenExceeded && (
              <p className="mt-2 text-xs flex items-center text-destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Token limit exceeded
              </p>
            )}
          </div>
        </Card>
      </div>

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
                dataSource={effectiveDataSource}
                selectedFiles={selectedFiles}
                setSelectedFiles={handleSetSelectedFiles}
                maxTokens={maxTokens}
                onTokenCountChange={setTokenCount}
                allFiles={allAnalysisFiles}
                tokenCount={tokenCount}
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

            <Button variant="outline" className="flex justify-between items-center text-xs sm:text-sm" onClick={() => setShowBackupDialog(true)}>
              <Badge variant="outline" className="mr-2 px-1 py-0 text-xs">BKP</Badge>
              Save Selection as Backup
            </Button>
          </div>
          
          <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Save Current Selection</DialogTitle>
                <DialogDescription>
                  Create a named backup of your currently selected files. You can restore them later.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                <Label htmlFor="backup-name" className="text-xs sm:text-sm mb-2 block">Backup Name</Label>
                <Input 
                  id="backup-name"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  placeholder="e.g., Core API Files"
                  className="text-xs sm:text-sm"
                />
              </div>
              
              <div className="text-xs text-muted-foreground">
                <p>This will save your current selection of {selectedFilesData.length} files with {tokenCount.toLocaleString()} tokens.</p>
              </div>
              
              <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowBackupDialog(false)}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveBackup}
                  disabled={!backupName.trim()}
                  size="sm"
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Backup
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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